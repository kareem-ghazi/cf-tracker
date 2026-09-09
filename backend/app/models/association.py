"""Association tables for many-to-many relationships."""
from sqlalchemy import Column, ForeignKey, Integer, Table
from app.models.base import Base

group_attendance = Table(
    "group_attendance",
    Base.metadata,
    Column(
        "group_id",
        Integer,
        ForeignKey("groups.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
    Column(
        "spreadsheet_id",
        Integer,
        ForeignKey("spreadsheets.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
)
