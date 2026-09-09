"""Groups and Overview API router endpoints."""
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.group import Group
from app.models.spreadsheet import Spreadsheet
from app.schemas.group import (
    GroupCreate,
    GroupResponse,
    GroupUpdate,
    OverviewResponse,
)
from app.services.matrix_builder import build_group_overview

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.get("", response_model=List[GroupResponse])
async def list_groups(db: AsyncSession = Depends(get_db)) -> Any:
    """Retrieve all training groups ordered by creation date descending."""
    stmt = (
        select(Group)
        .options(
            selectinload(Group.spreadsheet),
            selectinload(Group.attendance_spreadsheets),
            selectinload(Group.contests),
        )
        .order_by(Group.created_at.desc())
    )
    res = await db.execute(stmt)
    groups = res.scalars().all()
    return [g.to_dict() for g in groups]


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_in: GroupCreate, db: AsyncSession = Depends(get_db)
) -> Any:
    """Create a new training group."""
    group = Group(
        name=group_in.name,
        description=group_in.description or "",
        spreadsheet_id=group_in.spreadsheet_id,
    )
    if group_in.default_participants:
        group.set_default_participants_list(group_in.default_participants)

    db.add(group)
    await db.commit()
    await db.refresh(group, ["spreadsheet", "attendance_spreadsheets", "contests"])
    return group.to_dict()


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(group_id: int, db: AsyncSession = Depends(get_db)) -> Any:
    """Retrieve details of a specific training group."""
    stmt = (
        select(Group)
        .where(Group.id == group_id)
        .options(
            selectinload(Group.spreadsheet),
            selectinload(Group.attendance_spreadsheets),
            selectinload(Group.contests),
        )
    )
    res = await db.execute(stmt)
    group = res.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Training group not found")
    return group.to_dict()


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int, group_in: GroupUpdate, db: AsyncSession = Depends(get_db)
) -> Any:
    """Update training group details, default roster, or linked spreadsheets."""
    stmt = (
        select(Group)
        .where(Group.id == group_id)
        .options(
            selectinload(Group.spreadsheet),
            selectinload(Group.attendance_spreadsheets),
            selectinload(Group.contests),
        )
    )
    res = await db.execute(stmt)
    group = res.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Training group not found")

    if group_in.name is not None:
        group.name = group_in.name
    if group_in.description is not None:
        group.description = group_in.description
    if group_in.default_participants is not None:
        group.set_default_participants_list(group_in.default_participants)
    if group_in.spreadsheet_id is not None:
        group.spreadsheet_id = group_in.spreadsheet_id if group_in.spreadsheet_id > 0 else None

    # Update attendance spreadsheets if provided
    if group_in.attendance_spreadsheet_ids is not None:
        sheets_stmt = select(Spreadsheet).where(
            Spreadsheet.id.in_(group_in.attendance_spreadsheet_ids)
        )
        sheets_res = await db.execute(sheets_stmt)
        group.attendance_spreadsheets = list(sheets_res.scalars().all())

    await db.commit()
    await db.refresh(group, ["spreadsheet", "attendance_spreadsheets", "contests"])
    return group.to_dict()


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(group_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a training group and cascade delete all its contests."""
    stmt = select(Group).where(Group.id == group_id)
    res = await db.execute(stmt)
    group = res.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Training group not found")
    await db.delete(group)
    await db.commit()


@router.get("/{group_id}/overview", response_model=OverviewResponse)
async def get_group_overview_endpoint(
    group_id: int, db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve full virtualized overview matrix for the training group."""
    overview_data = await build_group_overview(db, group_id)
    if not overview_data:
        raise HTTPException(status_code=404, detail="Training group not found")
    return overview_data


@router.post("/{group_id}/apply-participants")
async def apply_group_participants(
    group_id: int, db: AsyncSession = Depends(get_db)
) -> Any:
    """Apply group's default participants roster to all contests in the group."""
    stmt = (
        select(Group)
        .where(Group.id == group_id)
        .options(selectinload(Group.contests))
    )
    res = await db.execute(stmt)
    group = res.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Training group not found")

    default_participants = group.get_default_participants_list()
    if not default_participants:
        raise HTTPException(
            status_code=400,
            detail="No default participants configured for this training group",
        )

    updated_count = 0
    for contest in group.contests:
        contest.set_participants_list(default_participants)
        updated_count += 1

    await db.commit()
    return {
        "success": True,
        "contests_updated": updated_count,
        "participants_applied": len(default_participants),
    }

