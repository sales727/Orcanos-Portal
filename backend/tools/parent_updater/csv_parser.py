import csv
import io
import re

REQUIRED_COLUMNS = ["Key", "Parent Key", "Name"]


def numeric_id(code: str) -> str:
    """Strip the leading TEXT- prefix, e.g. 'RISK-28743' -> '28743'."""
    m = re.search(r"(\d+)\s*$", code.strip())
    return m.group(1) if m else ""


def parse_parent_rows(file_bytes: bytes):
    """Parse an uploaded CSV of Key / Parent Key / Name rows.

    Mirrors the standalone update_orcanos_parents.py script: a row is valid
    only when both Key and Parent Key are present and end in a numeric id.
    """
    text = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    missing = [c for c in REQUIRED_COLUMNS if c not in headers]

    rows = []
    for i, row in enumerate(reader, 1):
        key = (row.get("Key") or "").strip()
        parent_key = (row.get("Parent Key") or "").strip()
        name = (row.get("Name") or "").strip()

        object_id = numeric_id(key) if key else ""
        parent_id = numeric_id(parent_key) if parent_key else ""

        rows.append({
            "row": i,
            "key": key,
            "parentKey": parent_key,
            "name": name,
            "objectId": object_id,
            "parentId": parent_id,
            "valid": bool(object_id and parent_id),
        })

    return {
        "headers": headers,
        "missingColumns": missing,
        "rows": rows,
        "totalRows": len(rows),
        "validRows": sum(1 for r in rows if r["valid"]),
    }
