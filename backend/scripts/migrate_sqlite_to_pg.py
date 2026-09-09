"""Script to migrate legacy SQLite database data to PostgreSQL with Async SQLAlchemy."""
import argparse
import asyncio
import json
import os
import sqlite3
import sys
from datetime import datetime, date
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, text
from app.core.database import async_session_factory, engine
from app.models.base import Base
from app.models.spreadsheet import Spreadsheet
from app.models.group import Group
from app.models.contest import Contest
from app.models.result import CachedResult
from app.models.fetch_history import FetchHistory
from app.models.association import group_attendance


def parse_date(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, (datetime, date)):
        return val
    try:
        return datetime.fromisoformat(str(val))
    except Exception:
        return None


def parse_date_only(val: Any) -> Optional[date]:
    dt = parse_date(val)
    return dt.date() if dt else None


async def migrate(sqlite_path: str) -> None:
    if not os.path.exists(sqlite_path):
        print(f"Error: SQLite database file not found at: {sqlite_path}")
        return

    print(f"Connecting to SQLite database at: {sqlite_path}")
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Check available tables in SQLite
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"Found SQLite tables: {', '.join(tables)}")

    async with async_session_factory() as pg_session:
        # 1. Migrate Spreadsheets
        if "spreadsheets" in tables:
            print("\nMigrating spreadsheets...")
            cursor.execute("SELECT * FROM spreadsheets;")
            sheet_rows = cursor.fetchall()
            count = 0
            for row in sheet_rows:
                r_dict = dict(row)
                data_val = r_dict.get("data") or "{}"
                if isinstance(data_val, str):
                    try:
                        data_json = json.loads(data_val)
                    except Exception:
                        data_json = {"columns": [], "rows": []}
                else:
                    data_json = data_val

                sheet = Spreadsheet(
                    id=r_dict["id"],
                    name=r_dict["name"],
                    filename=r_dict.get("filename") or "",
                    spreadsheet_type=r_dict.get("spreadsheet_type") or "participants",
                    handle_column=r_dict.get("handle_column") or "Codeforces Handle",
                    phone_column=r_dict.get("phone_column") or "WhatsApp Number",
                    data=data_json,
                )
                if r_dict.get("created_at"):
                    sheet.created_at = parse_date(r_dict["created_at"])
                pg_session.add(sheet)
                count += 1
            await pg_session.flush()
            print(f"  Successfully imported {count} spreadsheets.")

        # 2. Migrate Groups
        if "groups" in tables:
            print("\nMigrating groups...")
            cursor.execute("SELECT * FROM groups;")
            group_rows = cursor.fetchall()
            count = 0
            for row in group_rows:
                r_dict = dict(row)
                grp = Group(
                    id=r_dict["id"],
                    name=r_dict["name"],
                    description=r_dict.get("description") or "",
                    default_participants=r_dict.get("default_participants") or "",
                    spreadsheet_id=r_dict.get("spreadsheet_id"),
                )
                if r_dict.get("created_at"):
                    grp.created_at = parse_date(r_dict["created_at"])
                pg_session.add(grp)
                count += 1
            await pg_session.flush()
            print(f"  Successfully imported {count} groups.")

        # 3. Migrate Group Attendance Association
        if "group_attendance" in tables:
            print("\nMigrating group attendance links...")
            cursor.execute("SELECT * FROM group_attendance;")
            att_rows = cursor.fetchall()
            count = 0
            for row in att_rows:
                r_dict = dict(row)
                stmt = group_attendance.insert().values(
                    group_id=r_dict["group_id"],
                    spreadsheet_id=r_dict["spreadsheet_id"],
                )
                await pg_session.execute(stmt)
                count += 1
            await pg_session.flush()
            print(f"  Successfully imported {count} attendance links.")

        # 4. Migrate Contests
        if "contests" in tables:
            print("\nMigrating contests...")
            cursor.execute("SELECT * FROM contests;")
            contest_rows = cursor.fetchall()
            count = 0
            for row in contest_rows:
                r_dict = dict(row)
                contest = Contest(
                    id=r_dict["id"],
                    group_id=r_dict["group_id"],
                    cf_contest_id=r_dict["cf_contest_id"],
                    name=r_dict["name"],
                    min_solved=r_dict.get("min_solved", 1),
                    min_solved_is_percent=bool(r_dict.get("min_solved_is_percent", 0)),
                    total_problems=r_dict.get("total_problems", 0),
                    participants=r_dict.get("participants") or "",
                    lock_participants=bool(r_dict.get("lock_participants", 0)),
                )
                if r_dict.get("start_date"):
                    contest.start_date = parse_date(r_dict["start_date"])
                if r_dict.get("last_refreshed"):
                    contest.last_refreshed = parse_date(r_dict["last_refreshed"])
                if r_dict.get("created_at"):
                    contest.created_at = parse_date(r_dict["created_at"])
                pg_session.add(contest)
                count += 1
            await pg_session.flush()
            print(f"  Successfully imported {count} contests.")

        # 5. Migrate Cached Results
        if "cached_results" in tables:
            print("\nMigrating cached results...")
            cursor.execute("SELECT * FROM cached_results;")
            result_rows = cursor.fetchall()
            count = 0
            for row in result_rows:
                r_dict = dict(row)
                res = CachedResult(
                    id=r_dict.get("id"),
                    contest_id=r_dict["contest_id"],
                    handle=r_dict["handle"],
                    solved_count=r_dict.get("solved_count", 0),
                    passed=bool(r_dict.get("passed", 0)),
                    participated=bool(r_dict.get("participated", 0)),
                    rank=r_dict.get("rank", 0),
                )
                if r_dict.get("cached_at"):
                    res.cached_at = parse_date(r_dict["cached_at"])
                pg_session.add(res)
                count += 1
            await pg_session.flush()
            print(f"  Successfully imported {count} cached results.")

        # 6. Migrate Fetch History
        if "fetch_history" in tables:
            print("\nMigrating fetch history...")
            cursor.execute("SELECT * FROM fetch_history;")
            hist_rows = cursor.fetchall()
            count = 0
            for row in hist_rows:
                r_dict = dict(row)
                fdate = parse_date_only(r_dict["fetch_date"])
                if not fdate:
                    continue
                hist = FetchHistory(
                    id=r_dict.get("id"),
                    contest_id=r_dict["contest_id"],
                    fetch_date=fdate,
                    passed_count=r_dict.get("passed_count", 0),
                    failed_count=r_dict.get("failed_count", 0),
                    not_participated_count=r_dict.get("not_participated_count", 0),
                    total_count=r_dict.get("total_count", 0),
                )
                pg_session.add(hist)
                count += 1
            await pg_session.flush()
            print(f"  Successfully imported {count} fetch history records.")

        # 7. Reset PostgreSQL sequences to max ID
        print("\nResetting PostgreSQL serial sequences...")
        for tbl in ["spreadsheets", "groups", "contests", "cached_results", "fetch_history"]:
            try:
                seq_query = text(
                    f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), COALESCE(MAX(id), 1)) FROM {tbl};"
                )
                await pg_session.execute(seq_query)
            except Exception as e:
                print(f"  Note: Sequence reset for {tbl}: {e}")

        await pg_session.commit()
        print("\n[SUCCESS] SQLite migration to PostgreSQL completed successfully!")

    conn.close()


def main():
    parser = argparse.ArgumentParser(description="Migrate SQLite DB to PostgreSQL")
    parser.add_argument(
        "--sqlite-path",
        default="instance/database.db",
        help="Path to SQLite database file (default: instance/database.db)",
    )
    args = parser.parse_args()
    asyncio.run(migrate(args.sqlite_path))


if __name__ == "__main__":
    main()
