"""Asynchronous Codeforces API client with HMAC-SHA512 signing and rate limiting."""
import asyncio
import hashlib
import random
import string
import time
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import settings
from app.core.rate_limiter import cf_rate_limiter


class CodeforcesAPI:
    """Async client for interacting with Codeforces API with HMAC-SHA512 signing."""

    BASE_URL = "https://codeforces.com/api"

    def __init__(self):
        self.api_key = settings.CF_API_KEY
        self.api_secret = settings.CF_API_SECRET

    def _generate_api_sig(self, method: str, params: Dict[str, Any]) -> Optional[str]:
        """Generate Codeforces API signature for authenticated requests."""
        if not self.api_key or not self.api_secret:
            return None

        rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
        sorted_params = sorted(params.items())
        param_str = "&".join(f"{k}={v}" for k, v in sorted_params)
        sig_str = f"{rand}/{method}?{param_str}#{self.api_secret}"
        hash_sig = hashlib.sha512(sig_str.encode("utf-8")).hexdigest()
        return f"{rand}{hash_sig}"

    async def _make_request_async(
        self, method: str, params: Optional[Dict[str, Any]] = None, max_retries: int = 3
    ) -> Dict[str, Any]:
        """Make an asynchronous rate-limited request with exponential backoff."""
        if params is None:
            params = {}

        if self.api_key and self.api_secret:
            params["apiKey"] = self.api_key
            params["time"] = int(time.time())
            api_sig = self._generate_api_sig(method, params)
            if api_sig:
                params["apiSig"] = api_sig

        url = f"{self.BASE_URL}/{method}"

        backoff = 2.0
        for attempt in range(max_retries):
            # Enforce distributed rate limit
            await cf_rate_limiter.acquire_async()

            try:
                async with httpx.AsyncClient(timeout=35.0) as client:
                    response = await client.get(url, params=params)

                    if response.status_code in (429, 503) and attempt < max_retries - 1:
                        await asyncio.sleep(backoff)
                        backoff *= 2.0
                        continue

                    response.raise_for_status()
                    data = response.json()

                    if data.get("status") == "OK":
                        return {"success": True, "result": data.get("result")}
                    else:
                        return {"success": False, "error": data.get("comment", "Unknown API error")}

            except httpx.HTTPStatusError as e:
                if attempt == max_retries - 1:
                    return {"success": False, "error": f"HTTP error {e.response.status_code}: {e.response.text}"}
                await asyncio.sleep(backoff)
                backoff *= 2.0
            except (httpx.RequestError, ValueError) as e:
                if attempt == max_retries - 1:
                    return {"success": False, "error": f"Request failed: {str(e)}"}
                await asyncio.sleep(backoff)
                backoff *= 2.0

        return {"success": False, "error": "Max retries exceeded"}

    def _make_request_sync(
        self, method: str, params: Optional[Dict[str, Any]] = None, max_retries: int = 3
    ) -> Dict[str, Any]:
        """Make a synchronous request for Celery workers with exponential backoff."""
        if params is None:
            params = {}

        if self.api_key and self.api_secret:
            params["apiKey"] = self.api_key
            params["time"] = int(time.time())
            api_sig = self._generate_api_sig(method, params)
            if api_sig:
                params["apiSig"] = api_sig

        url = f"{self.BASE_URL}/{method}"
        backoff = 2.0

        for attempt in range(max_retries):
            cf_rate_limiter.acquire_sync()
            try:
                with httpx.Client(timeout=35.0) as client:
                    response = client.get(url, params=params)
                    if response.status_code in (429, 503) and attempt < max_retries - 1:
                        time.sleep(backoff)
                        backoff *= 2.0
                        continue

                    response.raise_for_status()
                    data = response.json()

                    if data.get("status") == "OK":
                        return {"success": True, "result": data.get("result")}
                    else:
                        return {"success": False, "error": data.get("comment", "Unknown API error")}

            except Exception as e:
                if attempt == max_retries - 1:
                    return {"success": False, "error": str(e)}
                time.sleep(backoff)
                backoff *= 2.0

        return {"success": False, "error": "Max retries exceeded"}

    async def get_contest_list(self, gym: bool = False) -> Dict[str, Any]:
        """Get list of Codeforces contests."""
        params = {"gym": str(gym).lower()}
        return await self._make_request_async("contest.list", params)

    async def get_contest_standings(
        self, contest_id: int, handles: Optional[List[str]] = None, show_unofficial: bool = True
    ) -> Dict[str, Any]:
        """Fetch contest standings asynchronously."""
        params: Dict[str, Any] = {
            "contestId": contest_id,
            "showUnofficial": str(show_unofficial).lower(),
        }
        if handles:
            params["handles"] = ";".join(handles)
        return await self._make_request_async("contest.standings", params)

    def get_contest_standings_sync(
        self, contest_id: int, handles: Optional[List[str]] = None, show_unofficial: bool = True
    ) -> Dict[str, Any]:
        """Fetch contest standings synchronously (for Celery task workers)."""
        params: Dict[str, Any] = {
            "contestId": contest_id,
            "showUnofficial": str(show_unofficial).lower(),
        }
        if handles:
            params["handles"] = ";".join(handles)
        return self._make_request_sync("contest.standings", params)

    async def get_user_info(self, handles: List[str]) -> Dict[str, Any]:
        """Fetch user info for a list of handles."""
        if not handles:
            return {"success": False, "error": "No handles provided"}
        params = {"handles": ";".join(handles)}
        return await self._make_request_async("user.info", params)

    @staticmethod
    def get_participant_data(standings_result: Dict[str, Any], handle: str) -> Dict[str, Any]:
        """Parse participant performance data from standings result."""
        default_result = {
            "solved_count": 0,
            "rank": 0,
            "participated": False,
        }

        if not standings_result.get("success"):
            return default_result

        result = standings_result.get("result", {})
        rows = result.get("rows", [])
        handle_lower = handle.strip().lower()

        for row in rows:
            party = row.get("party", {})
            members = party.get("members", [])

            for member in members:
                if member.get("handle", "").strip().lower() == handle_lower:
                    problem_results = row.get("problemResults", [])
                    solved = sum(1 for pr in problem_results if pr.get("points", 0) > 0)
                    rank = row.get("rank", 0)
                    return {
                        "solved_count": solved,
                        "rank": rank,
                        "participated": True,
                    }

        return default_result


# Singleton client instance
cf_api = CodeforcesAPI()
