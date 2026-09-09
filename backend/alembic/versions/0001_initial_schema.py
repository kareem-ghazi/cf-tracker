"""Initial database migration: Create CITEXT extension and all application tables.

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-09-09 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import CITEXT

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Ensure CITEXT extension is enabled
    op.execute('CREATE EXTENSION IF NOT EXISTS "citext";')

    # 2. Table: spreadsheets
    op.create_table(
        "spreadsheets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("filename", sa.String(length=255), server_default="", nullable=False),
        sa.Column("spreadsheet_type", sa.String(length=20), server_default="participants", nullable=False),
        sa.Column("handle_column", sa.String(length=100), server_default="Codeforces Handle", nullable=False),
        sa.Column("phone_column", sa.String(length=100), server_default="WhatsApp Number", nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_spreadsheets_spreadsheet_type"), "spreadsheets", ["spreadsheet_type"], unique=False)

    # 3. Table: groups
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("default_participants", sa.Text(), server_default="", nullable=False),
        sa.Column("spreadsheet_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["spreadsheet_id"], ["spreadsheets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 4. Table: group_attendance
    op.create_table(
        "group_attendance",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("spreadsheet_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["spreadsheet_id"], ["spreadsheets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("group_id", "spreadsheet_id"),
    )

    # 5. Table: contests
    op.create_table(
        "contests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("cf_contest_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("min_solved", sa.Integer(), server_default="1", nullable=False),
        sa.Column("min_solved_is_percent", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("total_problems", sa.Integer(), server_default="0", nullable=False),
        sa.Column("participants", sa.Text(), server_default="", nullable=False),
        sa.Column("lock_participants", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_refreshed", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_contests_cf_contest_id"), "contests", ["cf_contest_id"], unique=False)
    op.create_index(op.f("ix_contests_group_id"), "contests", ["group_id"], unique=False)

    # 6. Table: cached_results
    op.create_table(
        "cached_results",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("contest_id", sa.Integer(), nullable=False),
        sa.Column("handle", CITEXT(), nullable=False),
        sa.Column("solved_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("passed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("participated", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("rank", sa.Integer(), server_default="0", nullable=False),
        sa.Column("cached_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("contest_id", "handle", name="uq_contest_handle"),
    )
    op.create_index(op.f("ix_cached_results_contest_id"), "cached_results", ["contest_id"], unique=False)
    op.create_index(op.f("ix_cached_results_handle"), "cached_results", ["handle"], unique=False)
    op.create_index(op.f("ix_cached_results_passed"), "cached_results", ["passed"], unique=False)

    # 7. Table: fetch_history
    op.create_table(
        "fetch_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("contest_id", sa.Integer(), nullable=False),
        sa.Column("fetch_date", sa.Date(), nullable=False),
        sa.Column("passed_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("failed_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("not_participated_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_count", sa.Integer(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("contest_id", "fetch_date", name="uq_contest_fetch_date"),
    )
    op.create_index(op.f("ix_fetch_history_contest_id"), "fetch_history", ["contest_id"], unique=False)


def downgrade() -> None:
    op.drop_table("fetch_history")
    op.drop_table("cached_results")
    op.drop_table("contests")
    op.drop_table("group_attendance")
    op.drop_table("groups")
    op.drop_table("spreadsheets")
    op.execute('DROP EXTENSION IF EXISTS "citext";')
