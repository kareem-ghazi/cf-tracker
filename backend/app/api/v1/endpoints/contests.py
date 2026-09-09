"""Contest management, results, standings, and refresh API endpoints."""
from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.group import Group
from app.models.contest import Contest
from app.models.result import CachedResult
from app.models.fetch_history import FetchHistory
from app.schemas.contest import (
    BatchContestCreate,
    CachedResultResponse,
    ContestCreate,
    ContestResponse,
    ContestResultsResponse,
    ContestStandingsResponse,
    ContestUpdate,
    FetchHistoryResponse,
    TaskDispatchResponse,
)
from app.services.codeforces import cf_api
from app.services.scoring import order_standings_results
from app.workers.tasks import refresh_contest_results_task

router = APIRouter(prefix="/contests", tags=["Contests"])


@router.post("", response_model=ContestResponse, status_code=status.HTTP_201_CREATED)
async def create_contest(
    contest_in: ContestCreate, db: AsyncSession = Depends(get_db)
) -> Any:
    """Create and register a new contest in a training group."""
    # Verify group exists
    group_stmt = select(Group).where(Group.id == contest_in.group_id)
    group_res = await db.execute(group_stmt)
    group = group_res.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Training group not found")

    contest_name = contest_in.name
    total_problems = 0
    start_date = None

    # Auto-fetch contest details from Codeforces if name is omitted
    if not contest_name:
        cf_data = await cf_api.get_contest_standings(contest_in.cf_contest_id)
        if cf_data.get("success"):
            res_obj = cf_data.get("result", {})
            c_meta = res_obj.get("contest", {})
            contest_name = c_meta.get("name", f"Contest {contest_in.cf_contest_id}")
            total_problems = len(res_obj.get("problems", []))
            start_time_sec = c_meta.get("startTimeSeconds")
            if start_time_sec:
                start_date = datetime.fromtimestamp(start_time_sec, tz=timezone.utc)
        else:
            contest_name = f"Contest {contest_in.cf_contest_id}"

    # Inherit default participants if empty
    participants = contest_in.participants or []
    if not participants and group.default_participants:
        participants = group.get_default_participants_list()

    contest = Contest(
        group_id=contest_in.group_id,
        cf_contest_id=contest_in.cf_contest_id,
        name=contest_name,
        min_solved=contest_in.min_solved,
        min_solved_is_percent=contest_in.min_solved_is_percent,
        total_problems=total_problems,
        participants=",".join(participants),
        lock_participants=contest_in.lock_participants,
        start_date=start_date,
    )
    db.add(contest)
    await db.commit()
    await db.refresh(contest, ["results", "fetch_history"])
    return contest.to_dict()


@router.post("/batch", response_model=List[ContestResponse], status_code=status.HTTP_201_CREATED)
async def create_contests_batch(
    batch_in: BatchContestCreate, db: AsyncSession = Depends(get_db)
) -> Any:
    """Batch add multiple contests to a training group."""
    group_stmt = select(Group).where(Group.id == batch_in.group_id)
    group_res = await db.execute(group_stmt)
    group = group_res.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Training group not found")

    created_contests = []
    defaults = group.get_default_participants_list()

    for cf_id in batch_in.contest_ids:
        cf_data = await cf_api.get_contest_standings(cf_id)
        name = f"Contest {cf_id}"
        total_problems = 0
        start_date = None

        if cf_data.get("success"):
            res_obj = cf_data.get("result", {})
            c_meta = res_obj.get("contest", {})
            name = c_meta.get("name", name)
            total_problems = len(res_obj.get("problems", []))
            start_sec = c_meta.get("startTimeSeconds")
            if start_sec:
                start_date = datetime.fromtimestamp(start_sec, tz=timezone.utc)

        contest = Contest(
            group_id=batch_in.group_id,
            cf_contest_id=cf_id,
            name=name,
            min_solved=batch_in.min_solved,
            min_solved_is_percent=batch_in.min_solved_is_percent,
            total_problems=total_problems,
            participants=",".join(defaults),
            start_date=start_date,
        )
        db.add(contest)
        created_contests.append(contest)

    await db.commit()
    for c in created_contests:
        await db.refresh(c, ["results", "fetch_history"])

    return [c.to_dict() for c in created_contests]


@router.get("/{contest_id}", response_model=ContestResponse)
async def get_contest(contest_id: int, db: AsyncSession = Depends(get_db)) -> Any:
    """Retrieve details of a tracked contest."""
    stmt = (
        select(Contest)
        .where(Contest.id == contest_id)
        .options(selectinload(Contest.results), selectinload(Contest.fetch_history))
    )
    res = await db.execute(stmt)
    contest = res.scalar_one_or_none()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    return contest.to_dict()


@router.put("/{contest_id}", response_model=ContestResponse)
async def update_contest(
    contest_id: int, contest_in: ContestUpdate, db: AsyncSession = Depends(get_db)
) -> Any:
    """Update contest settings or participant roster."""
    stmt = (
        select(Contest)
        .where(Contest.id == contest_id)
        .options(selectinload(Contest.results), selectinload(Contest.fetch_history))
    )
    res = await db.execute(stmt)
    contest = res.scalar_one_or_none()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    if contest_in.name is not None:
        contest.name = contest_in.name
    if contest_in.min_solved is not None:
        contest.min_solved = contest_in.min_solved
    if contest_in.min_solved_is_percent is not None:
        contest.min_solved_is_percent = contest_in.min_solved_is_percent
    if contest_in.lock_participants is not None:
        contest.lock_participants = contest_in.lock_participants
    if contest_in.participants is not None:
        contest.set_participants_list(contest_in.participants)

    await db.commit()
    await db.refresh(contest, ["results", "fetch_history"])
    return contest.to_dict()


@router.delete("/{contest_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contest(contest_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a contest and its results."""
    stmt = select(Contest).where(Contest.id == contest_id)
    res = await db.execute(stmt)
    contest = res.scalar_one_or_none()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    await db.delete(contest)
    await db.commit()


@router.post("/{contest_id}/refresh", response_model=TaskDispatchResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_contest_refresh(
    contest_id: int, db: AsyncSession = Depends(get_db)
) -> Any:
    """Enqueue background worker task to refresh contest standings from Codeforces."""
    stmt = select(Contest).where(Contest.id == contest_id)
    res = await db.execute(stmt)
    contest = res.scalar_one_or_none()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    # Enqueue Celery task
    task = refresh_contest_results_task.delay(contest_id)

    return {
        "status": "QUEUED",
        "task_id": task.id,
        "message": "Contest refresh job submitted to background worker queue",
    }


@router.get("/{contest_id}/results", response_model=ContestResultsResponse)
async def get_contest_results(
    contest_id: int,
    status_filter: str = Query("all", alias="status"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve contest participant results filtered by status."""
    stmt = (
        select(Contest)
        .where(Contest.id == contest_id)
        .options(selectinload(Contest.results))
    )
    res = await db.execute(stmt)
    contest = res.scalar_one_or_none()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    all_results = contest.results
    total = len(all_results)
    passed_count = sum(1 for r in all_results if r.passed)
    failed_count = sum(1 for r in all_results if r.participated and not r.passed)
    not_participated_count = sum(1 for r in all_results if not r.participated)

    # Filter
    filtered = all_results
    if status_filter == "passed":
        filtered = [r for r in all_results if r.passed]
    elif status_filter == "failed":
        filtered = [r for r in all_results if r.participated and not r.passed]
    elif status_filter == "participated":
        filtered = [r for r in all_results if r.participated]
    elif status_filter == "not_participated":
        filtered = [r for r in all_results if not r.participated]

    return {
        "contest": contest.to_dict(),
        "total": total,
        "passed": passed_count,
        "failed": failed_count,
        "not_participated": not_participated_count,
        "results": [r.to_dict() for r in filtered],
    }


@router.get("/{contest_id}/standings", response_model=ContestStandingsResponse)
async def get_contest_standings_endpoint(
    contest_id: int, db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve contest standings ordered by official rank."""
    stmt = (
        select(Contest)
        .where(Contest.id == contest_id)
        .options(selectinload(Contest.results))
    )
    res = await db.execute(stmt)
    contest = res.scalar_one_or_none()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    ordered = order_standings_results(contest.results)

    participated = [r for r in contest.results if r.participated]
    not_participated = [r for r in contest.results if not r.participated]

    return {
        "contest": contest.to_dict(),
        "standings": [r.to_dict() for r in ordered],
        "summary": {
            "total": len(contest.results),
            "participated": len(participated),
            "not_participated": len(not_participated),
        },
    }


@router.get("/{contest_id}/progress", response_model=List[FetchHistoryResponse])
async def get_contest_progress(
    contest_id: int, db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve chronological pass rate history snapshots."""
    stmt = (
        select(FetchHistory)
        .where(FetchHistory.contest_id == contest_id)
        .order_by(FetchHistory.fetch_date.asc())
    )
    res = await db.execute(stmt)
    history = res.scalars().all()
    return [h.to_dict() for h in history]
