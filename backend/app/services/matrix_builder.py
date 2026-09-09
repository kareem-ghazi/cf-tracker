"""Matrix Builder Service aggregating group overview data with scoring rules."""
from typing import Any, Dict, List, Set
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.group import Group
from app.models.contest import Contest
from app.models.result import CachedResult


async def build_group_overview(session: AsyncSession, group_id: int) -> Dict[str, Any]:
    """Aggregate multi-contest overview matrix for a training group."""
    # Fetch group with relationships
    stmt = (
        select(Group)
        .where(Group.id == group_id)
        .options(
            selectinload(Group.spreadsheet),
            selectinload(Group.attendance_spreadsheets),
            selectinload(Group.contests).selectinload(Contest.results),
        )
    )
    res = await session.execute(stmt)
    group = res.scalar_one_or_none()

    if not group:
        return None

    # Sort contests chronologically
    contests = sorted(
        group.contests,
        key=lambda c: (c.start_date is None, c.start_date, c.id)
    )

    if not contests:
        return {
            "group": group.to_dict(),
            "contests": [],
            "participants": [],
            "total_attendance_sheets": len(group.attendance_spreadsheets),
        }

    total_attendance_sheets = len(group.attendance_spreadsheets)

    # 1. Build attendance lookup: handle -> count of sheets they appear in
    attendance_lookup: Dict[str, int] = {}
    for sheet in group.attendance_spreadsheets:
        data = sheet.get_data()
        rows = data.get("rows", [])
        handle_col = sheet.handle_column
        for row in rows:
            handle = str(row.get(handle_col, "")).strip().lower()
            if handle:
                attendance_lookup[handle] = attendance_lookup.get(handle, 0) + 1

    # 2. Build set of handles in participant metadata spreadsheet
    spreadsheet_handles: Set[str] = set()
    if group.spreadsheet:
        data = group.spreadsheet.get_data()
        rows = data.get("rows", [])
        handle_col = group.spreadsheet.handle_column
        for row in rows:
            handle = str(row.get(handle_col, "")).strip().lower()
            if handle:
                spreadsheet_handles.add(handle)

    # 3. Collect unique handles across all contests and results
    all_handles: Set[str] = set()
    for contest in contests:
        for r in contest.results:
            all_handles.add(str(r.handle).strip().lower())

    # Also include any default participants not yet in results
    for h in group.get_default_participants_list():
        all_handles.add(h.strip().lower())

    # 4. Build participant performance matrix
    participants_list = []
    for handle_lower in sorted(all_handles):
        total_passes = 0
        total_solved = 0
        results_map: Dict[str, Dict[str, Any]] = {}

        for contest in contests:
            # Find result for this handle in contest
            matching_result = next(
                (r for r in contest.results if str(r.handle).strip().lower() == handle_lower),
                None,
            )
            if matching_result:
                results_map[str(contest.id)] = {
                    "solved_count": matching_result.solved_count,
                    "passed": matching_result.passed,
                    "participated": matching_result.participated,
                    "rank": matching_result.rank,
                }
                if matching_result.passed:
                    total_passes += 1
                total_solved += matching_result.solved_count

        attendance_count = attendance_lookup.get(handle_lower, 0)

        # Points formula: (Passes * 5) + (Solved * 1) + (Attendance * 1)
        points = (total_passes * 5) + (total_solved * 1) + (attendance_count * 1)

        participants_list.append({
            "handle": handle_lower,
            "results": results_map,
            "in_spreadsheet": handle_lower in spreadsheet_handles,
            "attendance": attendance_count,
            "total_attendance_sheets": total_attendance_sheets,
            "total_passes": total_passes,
            "total_solved": total_solved,
            "points": points,
        })

    # Sort participants: passes (desc), total_solved (desc), attendance (desc)
    participants_list.sort(
        key=lambda p: (p["total_passes"], p["total_solved"], p["attendance"]),
        reverse=True,
    )

    # 5. Build contest header definitions
    contest_headers = [
        {
            "id": c.id,
            "cf_contest_id": c.cf_contest_id,
            "name": c.name,
            "total_problems": c.total_problems,
            "min_solved": c.min_solved,
            "min_solved_is_percent": c.min_solved_is_percent,
            "required_solved": c.get_required_solved(),
        }
        for c in contests
    ]

    return {
        "group": group.to_dict(),
        "contests": contest_headers,
        "participants": participants_list,
        "total_attendance_sheets": total_attendance_sheets,
    }
