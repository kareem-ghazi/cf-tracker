"""CSV parsing service with column detection, handle normalization, and encoding handling."""
import csv
import io
import re
from typing import Any, Dict, List, Optional, Tuple


HANDLE_CANDIDATES = [
    "codeforces handle",
    "cf handle",
    "handle",
    "cf_handle",
    "codeforces_handle",
    "username",
    "cf username",
    "codeforces",
    "cf",
]

PHONE_CANDIDATES = [
    "whatsapp number",
    "whatsapp",
    "phone",
    "mobile",
    "phone number",
    "mobile number",
    "phone_number",
    "tel",
    "contact",
]


def detect_column_candidate(columns: List[str], candidates: List[str]) -> Optional[str]:
    """Find the best matching column from candidate names using normalized substring matching."""
    norm_cols = {re.sub(r"[\s_\-]+", " ", col.strip().lower()): col for col in columns}

    # Exact normalized match first
    for cand in candidates:
        if cand in norm_cols:
            return norm_cols[cand]

    # Substring match
    for cand in candidates:
        for norm_col, original in norm_cols.items():
            if cand in norm_col or norm_col in cand:
                return original

    return None


def parse_csv_content(
    content_bytes: bytes,
    handle_column: Optional[str] = None,
    phone_column: Optional[str] = None,
) -> Dict[str, Any]:
    """Parse raw CSV bytes into structured rows, columns, and normalized handles.

    Supports UTF-8 (with or without BOM), UTF-16, and Latin-1 encodings.
    """
    # 1. Decode text
    text = ""
    for enc in ("utf-8-sig", "utf-8", "utf-16", "latin-1", "cp1252"):
        try:
            text = content_bytes.decode(enc)
            break
        except (UnicodeDecodeError, LookupError):
            continue

    if not text:
        raise ValueError("Unable to decode CSV file with supported encodings.")

    # 2. Determine delimiter
    sample = text[:4096]
    delimiter = ","
    try:
        sniffer = csv.Sniffer()
        dialect = sniffer.sniff(sample, delimiters=",;\t|")
        delimiter = dialect.delimiter
    except Exception:
        delimiter = ","

    # 3. Read CSV
    stream = io.StringIO(text.strip())
    reader = csv.DictReader(stream, delimiter=delimiter)
    raw_columns = reader.fieldnames or []
    columns = [c.strip() for c in raw_columns if c and c.strip()]

    if not columns:
        raise ValueError("CSV contains no valid header columns.")

    rows: List[Dict[str, Any]] = []
    for row in reader:
        # Clean row entries
        cleaned_row = {
            k.strip(): (v.strip() if isinstance(v, str) else v)
            for k, v in row.items()
            if k and k.strip()
        }
        # Only keep rows with at least one non-empty value
        if any(bool(v) for v in cleaned_row.values()):
            rows.append(cleaned_row)

    # 4. Detect or validate columns
    suggested_handle = detect_column_candidate(columns, HANDLE_CANDIDATES) or (
        columns[0] if columns else "Codeforces Handle"
    )
    suggested_phone = detect_column_candidate(columns, PHONE_CANDIDATES) or ""

    active_handle_col = handle_column if (handle_column and handle_column in columns) else suggested_handle
    active_phone_col = phone_column if (phone_column and phone_column in columns) else suggested_phone

    # 5. Extract and normalize handles
    handles: List[str] = []
    seen = set()
    if active_handle_col in columns:
        for r in rows:
            h = str(r.get(active_handle_col, "")).strip()
            if h and h.lower() not in seen:
                seen.add(h.lower())
                handles.append(h)

    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "suggested_handle_column": suggested_handle,
        "suggested_phone_column": suggested_phone,
        "handle_column": active_handle_col,
        "phone_column": active_phone_col,
        "handles": handles,
    }
