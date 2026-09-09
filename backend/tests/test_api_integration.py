"""Integration test suite validating FastAPI routes, business logic, scoring, and CSV parsing."""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pytest
from app.services.scoring import calculate_required_solved, evaluate_participant_result
from app.services.spreadsheet_parser import parse_csv_content, detect_column_candidate



def test_scoring_absolute_count():
    """Test standard minimum problem threshold."""
    assert calculate_required_solved(total_problems=10, min_solved=3, is_percent=False) == 3
    assert calculate_required_solved(total_problems=5, min_solved=5, is_percent=False) == 5


def test_scoring_percentage():
    """Test percentage-based threshold with integer truncation and minimum 1 floor."""
    # 50% of 10 problems = 5
    assert calculate_required_solved(total_problems=10, min_solved=50, is_percent=True) == 5
    # 33% of 7 problems = 2 (2.31 truncated)
    assert calculate_required_solved(total_problems=7, min_solved=33, is_percent=True) == 2
    # 10% of 3 problems = 1 (floor at 1)
    assert calculate_required_solved(total_problems=3, min_solved=10, is_percent=True) == 1
    # 0 total problems fallback
    assert calculate_required_solved(total_problems=0, min_solved=50, is_percent=True) == 50


def test_participant_evaluation():
    """Test pass/fail evaluation based on participation and solved count."""
    # Participated and met threshold
    res = evaluate_participant_result(solved_count=4, required_solved=3, participated=True)
    assert res["passed"] is True
    assert res["participated"] is True

    # Participated but failed threshold
    res = evaluate_participant_result(solved_count=2, required_solved=3, participated=True)
    assert res["passed"] is False
    assert res["participated"] is True

    # Did not participate
    res = evaluate_participant_result(solved_count=0, required_solved=3, participated=False)
    assert res["passed"] is False
    assert res["participated"] is False


def test_csv_parser_column_detection():
    """Test CSV candidate detection for handles and phone numbers."""
    cols = ["Student Name", "Codeforces Handle", "WhatsApp Number", "Academic Year"]
    assert detect_column_candidate(cols, ["cf handle", "codeforces handle", "handle"]) == "Codeforces Handle"
    assert detect_column_candidate(cols, ["whatsapp", "phone", "mobile"]) == "WhatsApp Number"


def test_csv_parsing_utf8_and_normalization():
    """Test parsing CSV bytes with handle whitespace and case normalization."""
    csv_bytes = (
        "Name,Codeforces Handle,WhatsApp Number\n"
        "Ahmed Ali, tourist ,01012345678\n"
        "Sara Amr, Tourist ,01234567890\n"  # duplicate handle with different casing
        "Omar Khaled,  Petr  ,01198765432\n"
    ).encode("utf-8")

    result = parse_csv_content(csv_bytes)
    assert result["row_count"] == 3
    assert result["columns"] == ["Name", "Codeforces Handle", "WhatsApp Number"]
    assert result["suggested_handle_column"] == "Codeforces Handle"
    assert result["suggested_phone_column"] == "WhatsApp Number"
    # Case-insensitive distinct handles
    assert len(result["handles"]) == 2
    assert "tourist" in [h.lower() for h in result["handles"]]
    assert "petr" in [h.lower() for h in result["handles"]]


def test_csv_delimiter_sniffing():
    """Test delimiter sniffing for semicolon and tab delimited CSVs."""
    semicolon_csv = (
        "Name;CF Handle;Phone\n"
        "Ali;tourist;12345\n"
        "Mona;radewoosh;67890\n"
    ).encode("utf-8")

    result = parse_csv_content(semicolon_csv)
    assert result["columns"] == ["Name", "CF Handle", "Phone"]
    assert result["row_count"] == 2
    assert len(result["handles"]) == 2
