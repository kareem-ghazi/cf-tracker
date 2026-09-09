"""Scoring service for pass/fail thresholds and standings sorting."""
from typing import Any, Dict, List
from app.models.result import CachedResult


def calculate_required_solved(
    total_problems: int, min_solved: int, is_percent: bool = False
) -> int:
    """Calculate the required number of problems to pass a contest.

    Respects percentage thresholds with integer truncation and minimum 1 problem floor.
    """
    if is_percent and total_problems > 0:
        return max(1, int(total_problems * min_solved / 100))
    return min_solved


def evaluate_participant_result(
    solved_count: int, required_solved: int, participated: bool
) -> Dict[str, bool]:
    """Evaluate whether a participant passed or failed based on required solved threshold."""
    if not participated:
        return {"passed": False, "participated": False}

    passed = solved_count >= required_solved
    return {"passed": passed, "participated": True}


def order_standings_results(results: List[CachedResult]) -> List[CachedResult]:
    """Order contest results by official rank.

    Ranked/participated competitors appear first sorted by rank (asc) and solved count (desc).
    Unranked or unentered participants appear at the bottom.
    """
    participated = [r for r in results if r.participated]
    not_participated = [r for r in results if not r.participated]

    # Sort participated by rank (rank 0 at end of participated), then solved_count desc
    participated.sort(key=lambda r: (r.rank == 0, r.rank, -r.solved_count))

    return participated + not_participated
