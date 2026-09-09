"""Pydantic schemas for Dashboard Analytics and Group Performance Cards."""
from typing import List, Optional
from pydantic import BaseModel, Field


class DashboardSummary(BaseModel):
    total_groups: int = Field(default=0, ge=0)
    total_contests: int = Field(default=0, ge=0)
    total_participants: int = Field(default=0, ge=0)
    total_results: int = Field(default=0, ge=0)
    overall_pass_rate: float = Field(default=0.0, ge=0.0, le=100.0)


class GroupAnalyticsCard(BaseModel):
    id: int
    name: str
    description: Optional[str] = ""
    contest_count: int = 0
    participant_count: int = 0
    pass_rate: float = 0.0
    passed_count: int = 0
    total_results: int = 0
    created_at: Optional[str] = None


class AnalyticsResponse(BaseModel):
    summary: DashboardSummary
    groups: List[GroupAnalyticsCard] = Field(default_factory=list)
