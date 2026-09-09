"""FetchHistory ORM model for chronological contest progress tracking."""
from datetime import date
from typing import TYPE_CHECKING, Any, Dict
from sqlalchemy import Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.contest import Contest


class FetchHistory(Base):
    """Daily snapshot of contest outcomes for tracking pass rate trends over time."""

    __tablename__ = "fetch_history"
    __table_args__ = (
        UniqueConstraint("contest_id", "fetch_date", name="uq_contest_fetch_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    contest_id: Mapped[int] = mapped_column(
        ForeignKey("contests.id", ondelete="CASCADE"), index=True, nullable=False
    )
    fetch_date: Mapped[date] = mapped_column(Date, nullable=False)
    passed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    not_participated_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    contest: Mapped["Contest"] = relationship("Contest", back_populates="fetch_history")

    def to_dict(self) -> Dict[str, Any]:
        """Serialize snapshot record."""
        return {
            "id": self.id,
            "contest_id": self.contest_id,
            "fetch_date": self.fetch_date.isoformat() if self.fetch_date else None,
            "passed_count": self.passed_count,
            "failed_count": self.failed_count,
            "not_participated_count": self.not_participated_count,
            "total_count": self.total_count,
        }
