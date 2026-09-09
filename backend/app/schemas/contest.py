"""Pydantic schemas for Contests, Results, Standings, and Progress."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ContestCreate(BaseModel):
    group_id: int
    cf_contest_id: int
    name: Optional[str] = None
    min_solved: int = Field(default=1, ge=0)
    min_solved_is_percent: bool = False
    participants: Optional[List[str]] = Field(default_factory=list)
    lock_participants: bool = False


class BatchContestCreate(BaseModel):
    group_id: int
    contest_ids: List[int] = Field(..., min_length=1)
    min_solved: int = Field(default=1, ge=0)
    min_solved_is_percent: bool = False


class ContestUpdate(BaseModel):
    name: Optional[str] = None
    min_solved: Optional[int] = None
    min_solved_is_percent: Optional[bool] = None
    participants: Optional[List[str]] = None
    lock_participants: Optional[bool] = None


class ContestResponse(BaseModel):
    id: int
    group_id: int
    cf_contest_id: int
    name: str
    min_solved: int
    min_solved_is_percent: bool
    total_problems: int
    required_solved: int
    participants: List[str]
    lock_participants: bool
    start_date: Optional[str] = None
    last_refreshed: Optional[str] = None
    created_at: Optional[str] = None
    result_count: int = 0

    class Config:
        from_attributes = True


class CachedResultResponse(BaseModel):
    id: int
    contest_id: int
    handle: str
    solved_count: int
    passed: bool
    participated: bool
    rank: int
    cached_at: Optional[str] = None

    class Config:
        from_attributes = True


class ContestResultsResponse(BaseModel):
    contest: Dict[str, Any]
    total: int
    passed: int
    failed: int
    not_participated: int
    results: List[CachedResultResponse]


class ContestStandingsResponse(BaseModel):
    contest: Dict[str, Any]
    standings: List[CachedResultResponse]
    summary: Dict[str, int]


class FetchHistoryResponse(BaseModel):
    id: int
    contest_id: int
    fetch_date: str
    passed_count: int
    failed_count: int
    not_participated_count: int
    total_count: int

    class Config:
        from_attributes = True


class TaskDispatchResponse(BaseModel):
    status: str = "QUEUED"
    task_id: str
    message: str
