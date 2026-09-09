"""Codeforces contest search and discovery API endpoints."""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.codeforces import cf_api

router = APIRouter(prefix="/codeforces", tags=["Codeforces"])


class CodeforcesContestSearchItem(BaseModel):
    id: int
    name: str
    type: str = "CF"
    phase: str = "FINISHED"
    startTimeSeconds: Optional[int] = None


@router.get("/search", response_model=List[CodeforcesContestSearchItem])
async def search_codeforces_contests(
    query: Optional[str] = Query(None, description="Search query by name or contest ID"),
    phase: Optional[str] = Query(None, description="Optional phase filter, e.g. FINISHED"),
) -> Any:
    """Search and discover Codeforces contests for fast addition by ID or name."""
    cf_res = await cf_api.get_contest_list()
    if not cf_res.get("success"):
        raise HTTPException(
            status_code=502,
            detail=f"Codeforces API error: {cf_res.get('error', 'Unable to retrieve contest list')}",
        )

    all_contests: List[Dict[str, Any]] = cf_res.get("result", [])

    # Filter by phase (default to FINISHED if not specified)
    target_phase = (phase or "FINISHED").upper()
    filtered = [c for c in all_contests if c.get("phase") == target_phase]

    # Filter by query if provided
    if query and query.strip():
        q_clean = query.strip().lower()
        filtered = [
            c
            for c in filtered
            if q_clean in str(c.get("id", "")).lower()
            or q_clean in str(c.get("name", "")).lower()
        ]

    # Top 50 most recent
    results = filtered[:50]

    return [
        CodeforcesContestSearchItem(
            id=c["id"],
            name=c.get("name", f"Contest {c['id']}"),
            type=c.get("type", "CF"),
            phase=c.get("phase", "FINISHED"),
            startTimeSeconds=c.get("startTimeSeconds"),
        )
        for c in results
    ]
