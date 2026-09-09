"""Training Group ORM model."""
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.association import group_attendance

if TYPE_CHECKING:
    from app.models.spreadsheet import Spreadsheet
    from app.models.contest import Contest


class Group(Base, TimestampMixin):
    """Training group containing multiple contests and participants."""

    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    default_participants: Mapped[str] = mapped_column(Text, default="", nullable=False)
    spreadsheet_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("spreadsheets.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    spreadsheet: Mapped[Optional["Spreadsheet"]] = relationship(
        "Spreadsheet", back_populates="groups", foreign_keys=[spreadsheet_id]
    )
    attendance_spreadsheets: Mapped[List["Spreadsheet"]] = relationship(
        "Spreadsheet", secondary=group_attendance, back_populates="attendance_groups"
    )
    contests: Mapped[List["Contest"]] = relationship(
        "Contest", back_populates="group", cascade="all, delete-orphan", lazy="selectin"
    )

    def get_default_participants_list(self) -> List[str]:
        """Return default participant handles as a list."""
        if not self.default_participants:
            return []
        return [h.strip() for h in self.default_participants.split(",") if h.strip()]

    def set_default_participants_list(self, handles: List[str]) -> None:
        """Store list of handles as comma-separated string."""
        self.default_participants = ",".join(h.strip() for h in handles if h.strip())

    def to_dict(self) -> Dict[str, Any]:
        """Serialize group representation."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "default_participants": self.get_default_participants_list(),
            "spreadsheet_id": self.spreadsheet_id,
            "spreadsheet": self.spreadsheet.to_dict() if self.spreadsheet else None,
            "attendance_spreadsheets": [s.to_dict() for s in self.attendance_spreadsheets],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "contest_count": len(self.contests),
        }
