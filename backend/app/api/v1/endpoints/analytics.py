"""Analytics aggregation service and dashboard API endpoint."""
from typing import Any, Dict, List, Set
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.group import Group
from app.models.contest import Contest
from app.models.result import CachedResult
from app.schemas.analytics import AnalyticsResponse, DashboardSummary, GroupAnalyticsCard

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("", response_model=AnalyticsResponse)
async def get_dashboard_analytics(db: AsyncSession = Depends(get_db)) -> Any:
    """Compute aggregate high-level metrics across all training groups, contests, and results."""
    # 1. Fetch groups with contests
    group_stmt = (
        select(Group)
        .options(selectinload(Group.contests))
        .order_by(Group.created_at.desc())
    )
    group_res = await db.execute(group_stmt)
    groups = group_res.scalars().all()

    # 2. Fetch all contests
    contest_stmt = select(Contest)
    contest_res = await db.execute(contest_stmt)
    contests = contest_res.scalars().all()

    # 3. Fetch all cached results
    result_stmt = select(CachedResult)
    result_res = await db.execute(result_stmt)
    results = result_res.scalars().all()

    # Pre-index results by contest_id
    results_by_contest: Dict[int, List[CachedResult]] = {}
    for r in results:
        results_by_contest.setdefault(r.contest_id, []).append(r)

    # 4. Global statistics
    all_handles: Set[str] = set()
    for r in results:
        if r.handle:
            all_handles.add(r.handle.lower())

    # Also include default participants from groups
    for g in groups:
        for h in g.get_default_participants_list():
            all_handles.add(h.lower())

    total_results_count = len(results)
    passed_results_count = sum(1 for r in results if r.passed)
    overall_pass_rate = (
        round(passed_results_count / total_results_count * 100, 1)
        if total_results_count > 0
        else 0.0
    )

    summary = DashboardSummary(
        total_groups=len(groups),
        total_contests=len(contests),
        total_participants=len(all_handles),
        total_results=total_results_count,
        overall_pass_rate=overall_pass_rate,
    )

    # 5. Group breakdown
    group_cards: List[GroupAnalyticsCard] = []
    for g in groups:
        group_contest_ids = [c.id for c in g.contests]
        group_results: List[CachedResult] = []
        for cid in group_contest_ids:
            group_results.extend(results_by_contest.get(cid, []))

        group_handles: Set[str] = set()
        for r in group_results:
            if r.handle:
                group_handles.add(r.handle.lower())
        for h in g.get_default_participants_list():
            group_handles.add(h.lower())

        group_passed = sum(1 for r in group_results if r.passed)
        group_total = len(group_results)
        group_pass_rate = (
            round(group_passed / group_total * 100, 1) if group_total > 0 else 0.0
        )

        group_cards.append(
            GroupAnalyticsCard(
                id=g.id,
                name=g.name,
                description=g.description,
                contest_count=len(g.contests),
                participant_count=len(group_handles),
                pass_rate=group_pass_rate,
                passed_count=group_passed,
                total_results=group_total,
                created_at=g.created_at.isoformat() if g.created_at else None,
            )
        )

    return AnalyticsResponse(summary=summary, groups=group_cards)
