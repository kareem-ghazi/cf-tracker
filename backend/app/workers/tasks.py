"""Celery background tasks for rate-limited Codeforces synchronization."""
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.workers.celery_app import celery_app
from app.core.database import async_session_factory
from app.models.contest import Contest
from app.models.result import CachedResult
from app.models.fetch_history import FetchHistory
from app.services.codeforces import cf_api
from app.services.scoring import evaluate_participant_result


async def _async_refresh_contest(task_instance, contest_id: int) -> Dict[str, Any]:
    """Execute asynchronous contest standings refresh adhering to rate limits."""
    async with async_session_factory() as session:
        # 1. Fetch contest
        stmt = (
            select(Contest)
            .where(Contest.id == contest_id)
            .options(selectinload(Contest.results))
        )
        res = await session.execute(stmt)
        contest = res.scalar_one_or_none()
        if not contest:
            raise ValueError(f"Contest {contest_id} not found")

        task_instance.update_state(
            state="PROGRESS",
            meta={"progress": 20, "message": "Fetching standings from Codeforces..."},
        )

        # 2. Fetch standings from Codeforces (rate limited)
        standings = await cf_api.get_contest_standings(contest.cf_contest_id)
        if not standings.get("success"):
            error_msg = standings.get("error", "Unknown error from Codeforces")
            raise RuntimeError(f"Failed to fetch standings: {error_msg}")

        task_instance.update_state(
            state="PROGRESS",
            meta={"progress": 50, "message": "Processing participant results..."},
        )

        # 3. Update total problems count
        problems = standings.get("result", {}).get("problems", [])
        if problems:
            contest.total_problems = len(problems)

        # 4. Auto-update participants from Codeforces if not locked
        if not contest.lock_participants:
            rows = standings.get("result", {}).get("rows", [])
            cf_handles = set()
            for row in rows:
                party = row.get("party", {})
                for member in party.get("members", []):
                    h = member.get("handle", "").strip()
                    if h:
                        cf_handles.add(h)

            existing_handles = set(contest.get_participants_list())
            merged = list(existing_handles.union(cf_handles))
            if len(merged) > len(existing_handles):
                contest.set_participants_list(merged)

        participants = contest.get_participants_list()
        required_solved = contest.get_required_solved()

        # 5. Clear old results for this contest
        del_stmt = delete(CachedResult).where(CachedResult.contest_id == contest_id)
        await session.execute(del_stmt)

        # 6. Evaluate and insert new CachedResult rows
        now = datetime.now(timezone.utc)
        passed_count = 0
        failed_count = 0
        not_participated_count = 0

        for handle in participants:
            p_data = cf_api.get_participant_data(standings, handle)
            solved_count = p_data["solved_count"]
            participated = p_data["participated"]
            rank = p_data["rank"]

            eval_res = evaluate_participant_result(solved_count, required_solved, participated)
            passed = eval_res["passed"]

            if not participated:
                not_participated_count += 1
            elif passed:
                passed_count += 1
            else:
                failed_count += 1

            new_res = CachedResult(
                contest_id=contest_id,
                handle=handle,
                solved_count=solved_count,
                passed=passed,
                participated=participated,
                rank=rank,
                cached_at=now,
            )
            session.add(new_res)

        contest.last_refreshed = now

        # 7. Record / Update daily progress FetchHistory
        today = now.date()
        hist_stmt = select(FetchHistory).where(
            FetchHistory.contest_id == contest_id,
            FetchHistory.fetch_date == today,
        )
        hist_res = await session.execute(hist_stmt)
        history_entry = hist_res.scalar_one_or_none()

        if history_entry:
            history_entry.passed_count = passed_count
            history_entry.failed_count = failed_count
            history_entry.not_participated_count = not_participated_count
            history_entry.total_count = len(participants)
        else:
            history_entry = FetchHistory(
                contest_id=contest_id,
                fetch_date=today,
                passed_count=passed_count,
                failed_count=failed_count,
                not_participated_count=not_participated_count,
                total_count=len(participants),
            )
            session.add(history_entry)

        await session.commit()

        return {
            "contest_id": contest_id,
            "participants_count": len(participants),
            "passed_count": passed_count,
            "failed_count": failed_count,
            "not_participated_count": not_participated_count,
        }


@celery_app.task(bind=True, name="refresh_contest_results")
def refresh_contest_results_task(self, contest_id: int) -> Dict[str, Any]:
    """Celery worker task entry point for contest refresh."""
    return asyncio.run(_async_refresh_contest(self, contest_id))
