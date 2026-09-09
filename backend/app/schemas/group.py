"""Pydantic schemas for Groups and Overview Matrix."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class GroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = ""
    default_participants: Optional[List[str]] = Field(default_factory=list)
    spreadsheet_id: Optional[int] = None


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_participants: Optional[List[str]] = None
    spreadsheet_id: Optional[int] = None
    attendance_spreadsheet_ids: Optional[List[int]] = None


class GroupResponse(BaseModel):
    id: int
    name: str
    description: str
    default_participants: List[str]
    spreadsheet_id: Optional[int] = None
    spreadsheet: Optional[Dict[str, Any]] = None
    attendance_spreadsheets: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: Optional[str] = None
    contest_count: int = 0

    class Config:
        from_attributes = True


class ContestResultCell(BaseModel):
    solved_count: int = 0
    passed: bool = False
    participated: bool = False
    rank: int = 0


class ParticipantOverview(BaseModel):
    handle: str
    results: Dict[str, ContestResultCell] = Field(default_factory=dict)
    in_spreadsheet: bool = False
    attendance: int = 0
    total_attendance_sheets: int = 0
    total_passes: int = 0
    total_solved: int = 0
    points: int = 0


class ContestOverviewHeader(BaseModel):
    id: int
    cf_contest_id: int
    name: str
    total_problems: int
    min_solved: int
    min_solved_is_percent: bool
    required_solved: int


class OverviewResponse(BaseModel):
    group: Dict[str, Any]
    contests: List[ContestOverviewHeader]
    participants: List[ParticipantOverview]
    total_attendance_sheets: int
