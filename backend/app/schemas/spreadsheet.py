"""Pydantic schemas for Spreadsheets, Column Mapping, and Roster Linkage."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SpreadsheetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    spreadsheet_type: str = Field(default="participants", pattern="^(participants|attendance)$")
    handle_column: str = Field(default="Codeforces Handle", max_length=100)
    phone_column: str = Field(default="WhatsApp Number", max_length=100)


class SpreadsheetCreate(SpreadsheetBase):
    filename: Optional[str] = ""


class SpreadsheetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    spreadsheet_type: Optional[str] = Field(None, pattern="^(participants|attendance)$")
    handle_column: Optional[str] = Field(None, max_length=100)
    phone_column: Optional[str] = Field(None, max_length=100)


class SpreadsheetResponse(SpreadsheetBase):
    id: int
    filename: str
    columns: List[str] = Field(default_factory=list)
    row_count: int = 0
    created_at: Optional[str] = None
    group_count: int = 0

    class Config:
        from_attributes = True


class SpreadsheetDataResponse(BaseModel):
    id: int
    name: str
    filename: str
    spreadsheet_type: str
    handle_column: str
    phone_column: str
    columns: List[str] = Field(default_factory=list)
    rows: List[Dict[str, Any]] = Field(default_factory=list)


class ApplyParticipantsResponse(BaseModel):
    success: bool
    contests_updated: int
    participants_applied: int
