"""CachedResult ORM model using PostgreSQL CITEXT for case-insensitive handles."""
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utc_now

if TYPE_CHECKING:
    from app.models.contest import Contest


class CachedResult(Base):
    """Participant evaluated outcome in a contest with case-insensitive handle."""

    __tablename__ = "cached_results"
    __table_args__ = (
        UniqueConstraint("contest_id", "handle", name="uq_contest_handle"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    contest_id: Mapped[int] = mapped_column(
        ForeignKey("contests.id", ondelete="CASCADE"), index=True, nullable=False
    )
    handle: Mapped[str] = mapped_column(CITEXT, index=True, nullable=False)
    solved_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    participated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cached_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    contest: Mapped["Contest"] = relationship("Contest", back_populates="results")

    def to_dict(self) -> Dict[str, Any]:
        """Serialize result representation."""
        return {
            "id": self.id,
            "contest_id": self.contest_id,
            "handle": str(self.handle),
            "solved_count": self.solved_count,
            "passed": self.passed,
            "participated": self.participated,
            "rank": self.rank,
            "cached_at": self.cached_at.isoformat() if self.cached_at else None,
        }
