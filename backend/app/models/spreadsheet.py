"""Spreadsheet ORM model for participant metadata and attendance tracking."""
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.association import group_attendance

if TYPE_CHECKING:
    from app.models.group import Group


class Spreadsheet(Base, TimestampMixin):
    """Uploaded CSV spreadsheet storing participant info or session attendance."""

    __tablename__ = "spreadsheets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    spreadsheet_type: Mapped[str] = mapped_column(
        String(20), default="participants", index=True, nullable=False
    )  # 'participants' or 'attendance'
    handle_column: Mapped[str] = mapped_column(
        String(100), default="Codeforces Handle", nullable=False
    )
    phone_column: Mapped[str] = mapped_column(
        String(100), default="WhatsApp Number", nullable=False
    )
    data: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, default=lambda: {"columns": [], "rows": []}, nullable=False
    )

    # Relationships
    groups: Mapped[List["Group"]] = relationship(
        "Group", back_populates="spreadsheet", foreign_keys="Group.spreadsheet_id"
    )
    attendance_groups: Mapped[List["Group"]] = relationship(
        "Group", secondary=group_attendance, back_populates="attendance_spreadsheets"
    )

    def get_data(self) -> Dict[str, Any]:
        """Return parsed spreadsheet data."""
        return self.data if self.data else {"columns": [], "rows": []}

    def get_participant_row(self, handle: str) -> Optional[Dict[str, Any]]:
        """Find row data for a participant by case-insensitive handle."""
        rows = self.get_data().get("rows", [])
        handle_lower = handle.strip().lower()
        col = self.handle_column
        for row in rows:
            if str(row.get(col, "")).strip().lower() == handle_lower:
                return row
        return None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize metadata for responses."""
        data_dict = self.get_data()
        return {
            "id": self.id,
            "name": self.name,
            "filename": self.filename,
            "spreadsheet_type": self.spreadsheet_type,
            "handle_column": self.handle_column,
            "phone_column": self.phone_column,
            "columns": data_dict.get("columns", []),
            "row_count": len(data_dict.get("rows", [])),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "group_count": len(self.groups),
        }
