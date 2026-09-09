"""Spreadsheet upload, management, and participant lookup API endpoints."""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.spreadsheet import Spreadsheet
from app.models.group import Group
from app.schemas.spreadsheet import (
    SpreadsheetDataResponse,
    SpreadsheetResponse,
    SpreadsheetUpdate,
)
from app.services.spreadsheet_parser import parse_csv_content

router = APIRouter(prefix="/spreadsheets", tags=["Spreadsheets"])


@router.post("/preview")
async def preview_csv(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Parse CSV without saving to detect columns and suggested mapping."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    try:
        parsed = parse_csv_content(content)
        return {
            "filename": file.filename,
            "columns": parsed["columns"],
            "suggested_handle_column": parsed["suggested_handle_column"],
            "suggested_phone_column": parsed["suggested_phone_column"],
            "sample_rows": parsed["rows"][:5],
            "total_rows": parsed["row_count"],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")


@router.post("/upload", response_model=SpreadsheetResponse, status_code=status.HTTP_201_CREATED)
@router.post("", response_model=SpreadsheetResponse, status_code=status.HTTP_201_CREATED)
async def upload_spreadsheet(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    spreadsheet_type: str = Form("participants"),
    handle_column: Optional[str] = Form(None),
    phone_column: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Upload and process CSV spreadsheet into JSONB storage."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    sheet_name = (name or file.filename or "Untitled Spreadsheet").strip()
    if not sheet_name:
        sheet_name = "Untitled Spreadsheet"

    try:
        parsed = parse_csv_content(content, handle_column=handle_column, phone_column=phone_column)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    spreadsheet = Spreadsheet(
        name=sheet_name,
        filename=file.filename or "",
        spreadsheet_type=spreadsheet_type if spreadsheet_type in ("participants", "attendance") else "participants",
        handle_column=parsed["handle_column"],
        phone_column=parsed["phone_column"] or "",
        data={"columns": parsed["columns"], "rows": parsed["rows"]},
    )
    db.add(spreadsheet)
    await db.commit()
    await db.refresh(spreadsheet, ["groups"])

    return spreadsheet.to_dict()


@router.get("", response_model=List[SpreadsheetResponse])
async def list_spreadsheets(
    type: Optional[str] = Query(None, alias="type"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """List all spreadsheets, optionally filtered by type (participants or attendance)."""
    stmt = select(Spreadsheet).options(selectinload(Spreadsheet.groups))
    if type:
        stmt = stmt.where(Spreadsheet.spreadsheet_type == type)
    stmt = stmt.order_by(Spreadsheet.created_at.desc())

    res = await db.execute(stmt)
    sheets = res.scalars().all()
    return [s.to_dict() for s in sheets]


@router.get("/participant/{handle}")
async def lookup_participant_global(
    handle: str, db: AsyncSession = Depends(get_db)
) -> Any:
    """Lookup participant metadata across latest participant spreadsheets."""
    stmt = (
        select(Spreadsheet)
        .where(Spreadsheet.spreadsheet_type == "participants")
        .order_by(Spreadsheet.created_at.desc())
    )
    res = await db.execute(stmt)
    sheets = res.scalars().all()

    for sheet in sheets:
        row = sheet.get_participant_row(handle)
        if row:
            return {
                "handle": handle,
                "spreadsheet_id": sheet.id,
                "spreadsheet_name": sheet.name,
                "handle_column": sheet.handle_column,
                "phone_column": sheet.phone_column,
                "row": row,
            }

    raise HTTPException(status_code=404, detail=f"Participant '{handle}' not found in any spreadsheet")


@router.get("/{spreadsheet_id}", response_model=SpreadsheetResponse)
async def get_spreadsheet_metadata(
    spreadsheet_id: int, db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve metadata for a specific spreadsheet."""
    stmt = (
        select(Spreadsheet)
        .where(Spreadsheet.id == spreadsheet_id)
        .options(selectinload(Spreadsheet.groups))
    )
    res = await db.execute(stmt)
    sheet = res.scalar_one_or_none()
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")
    return sheet.to_dict()


@router.get("/{spreadsheet_id}/data", response_model=SpreadsheetDataResponse)
async def get_spreadsheet_data(
    spreadsheet_id: int, db: AsyncSession = Depends(get_db)
) -> Any:
    """Retrieve full spreadsheet data including parsed rows."""
    stmt = select(Spreadsheet).where(Spreadsheet.id == spreadsheet_id)
    res = await db.execute(stmt)
    sheet = res.scalar_one_or_none()
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    data = sheet.get_data()
    return {
        "id": sheet.id,
        "name": sheet.name,
        "filename": sheet.filename,
        "spreadsheet_type": sheet.spreadsheet_type,
        "handle_column": sheet.handle_column,
        "phone_column": sheet.phone_column,
        "columns": data.get("columns", []),
        "rows": data.get("rows", []),
    }


@router.get("/{spreadsheet_id}/participant/{handle}")
async def get_participant_from_sheet(
    spreadsheet_id: int, handle: str, db: AsyncSession = Depends(get_db)
) -> Any:
    """Get single participant row from a specific spreadsheet."""
    stmt = select(Spreadsheet).where(Spreadsheet.id == spreadsheet_id)
    res = await db.execute(stmt)
    sheet = res.scalar_one_or_none()
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    row = sheet.get_participant_row(handle)
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"Participant '{handle}' not found in spreadsheet {spreadsheet_id}",
        )
    return row


@router.put("/{spreadsheet_id}", response_model=SpreadsheetResponse)
async def update_spreadsheet(
    spreadsheet_id: int,
    sheet_in: SpreadsheetUpdate,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update spreadsheet settings (name, column mappings, type)."""
    stmt = (
        select(Spreadsheet)
        .where(Spreadsheet.id == spreadsheet_id)
        .options(selectinload(Spreadsheet.groups))
    )
    res = await db.execute(stmt)
    sheet = res.scalar_one_or_none()
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    if sheet_in.name is not None:
        sheet.name = sheet_in.name
    if sheet_in.spreadsheet_type is not None:
        sheet.spreadsheet_type = sheet_in.spreadsheet_type
    if sheet_in.handle_column is not None:
        sheet.handle_column = sheet_in.handle_column
    if sheet_in.phone_column is not None:
        sheet.phone_column = sheet_in.phone_column

    await db.commit()
    await db.refresh(sheet, ["groups"])
    return sheet.to_dict()


@router.delete("/{spreadsheet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_spreadsheet(
    spreadsheet_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a spreadsheet and unlink it from any training groups."""
    stmt = (
        select(Spreadsheet)
        .where(Spreadsheet.id == spreadsheet_id)
        .options(selectinload(Spreadsheet.groups))
    )
    res = await db.execute(stmt)
    sheet = res.scalar_one_or_none()
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    # Unlink groups using this sheet
    for group in sheet.groups:
        group.spreadsheet_id = None

    await db.delete(sheet)
    await db.commit()
