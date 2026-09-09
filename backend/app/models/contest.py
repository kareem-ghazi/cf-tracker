"""Contest ORM model."""
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.result import CachedResult
    from app.models.fetch_history import FetchHistory


class Contest(Base, TimestampMixin):
    """Codeforces contest tracked within a group."""

    __tablename__ = "contests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cf_contest_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    min_solved: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    min_solved_is_percent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    total_problems: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    participants: Mapped[str] = mapped_column(Text, default="", nullable=False)
    lock_participants: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_refreshed: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    group: Mapped["Group"] = relationship("Group", back_populates="contests")
    results: Mapped[List["CachedResult"]] = relationship(
        "CachedResult", back_populates="contest", cascade="all, delete-orphan", lazy="selectin"
    )
    fetch_history: Mapped[List["FetchHistory"]] = relationship(
        "FetchHistory", back_populates="contest", cascade="all, delete-orphan", lazy="selectin"
    )

    def get_participants_list(self) -> List[str]:
        """Return participants as list of handles."""
        if not self.participants:
            return []
        return [h.strip() for h in self.participants.split(",") if h.strip()]

    def set_participants_list(self, handles: List[str]) -> None:
        """Set participants from list of handles."""
        self.participants = ",".join(h.strip() for h in handles if h.strip())

    def get_required_solved(self) -> int:
        """Calculate required solved count, respecting percentage threshold."""
        if self.min_solved_is_percent and self.total_problems > 0:
            return max(1, int(self.total_problems * self.min_solved / 100))
        return self.min_solved

    def to_dict(self) -> Dict[str, Any]:
        """Serialize contest model."""
        return {
            "id": self.id,
            "group_id": self.group_id,
            "cf_contest_id": self.cf_contest_id,
            "name": self.name,
            "min_solved": self.min_solved,
            "min_solved_is_percent": self.min_solved_is_percent,
            "total_problems": self.total_problems,
            "required_solved": self.get_required_solved(),
            "participants": self.get_participants_list(),
            "lock_participants": self.lock_participants,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "last_refreshed": self.last_refreshed.isoformat() if self.last_refreshed else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "result_count": len(self.results),
        }
