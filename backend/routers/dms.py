import json
import sys
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.dms.comparison import (
    compare_with_orcanos,
    load_files_from_bytes,
    parse_orcanos_items,
)
from tools.dms.orcanos_api import OrcanosAPI
from tools.dms.uploader import Uploader

router = APIRouter(prefix="/api/dms", tags=["dms"])


def _build_endpoint(account: str) -> str:
    return f"https://app.orcanos.com/{account.strip()}/api/v2/Json"


def _file_types(doc, action: str = "") -> str:
    try:
        open_name = doc.open_name or doc.docx_name
        open_ext = (open_name.rsplit(".", 1)[-1].upper() if (open_name and "." in open_name) else
                    ("DOCX" if (doc.open_bytes or doc.docx_bytes) else None))
        has_pdf = bool(doc.pdf_name or doc.pdf_bytes)

        if action == "UPDATE":
            # PDF is not uploaded on update — only show the open format
            return open_ext or "—"

        # CREATE: show everything that was provided
        parts = (["PDF"] if has_pdf else []) + ([open_ext] if open_ext else [])
        return " + ".join(parts) if parts else "—"
    except Exception:
        return "—"


@router.get("/inspect")
async def inspect(account: str, auth_key: str, filter_id: int = 25, version_id: int = 5):
    """Debug: returns the first raw Orcanos item and first parsed item."""
    api = OrcanosAPI(_build_endpoint(account), auth_key)
    raw_items = api.get_all_items(filter_id, version_id)
    if not raw_items:
        return {"error": "no items returned"}
    raw0 = raw_items[0]
    fields_raw = raw0.get("Field") or raw0.get("Fields") or []
    parsed = parse_orcanos_items(raw_items[:3])
    return {
        "raw_keys": list(raw0.keys()),
        "raw_Id": raw0.get("Id"),
        "raw_field_names": [f.get("Name") for f in fields_raw],
        "parsed_items": [
            {"object_id": p.object_id, "key": p.key, "name": p.name}
            for p in parsed
        ],
    }


@router.post("/compare")
async def compare(
    files: List[UploadFile] = File(...),
    account: str = Form(...),
    auth_key: str = Form(...),
    project_id: int = Form(78),
    filter_id: int = Form(25),
    version_id: int = Form(5),
    mode: str = Form("compare"),
):
    file_data = [{"filename": f.filename, "bytes": await f.read()} for f in files]

    documents = load_files_from_bytes(file_data)
    if not documents:
        raise HTTPException(400, "No files matched the naming pattern.")

    if mode == "scratch":
        return [
            {
                "dms_number": d.dms_number,
                "title": d.title,
                "file_rev": d.rev_letter or str(d.rev_change),
                "orcanos_rev": "—",
                "orcanos_key": "—",
                "orcanos_id": "—",
                "action": "CREATE",
                "reason": "New record",
                "file_types": _file_types(d),
                "suspicious": False,
            }
            for d in documents
        ]

    try:
        api = OrcanosAPI(_build_endpoint(account), auth_key)
        raw_items = api.get_all_items(filter_id, version_id)
    except Exception as exc:
        raise HTTPException(502, f"Orcanos API error: {exc}")

    orcanos_items = parse_orcanos_items(raw_items)
    results = compare_with_orcanos(documents, orcanos_items)

    return [
        {
            "dms_number": r.document.dms_number,
            "title": r.document.title,
            "file_rev": r.document.rev_letter or str(r.document.rev_change),
            "orcanos_rev": (
                (r.orcanos_item.revision or str(r.orcanos_item.change_no))
                if r.orcanos_item else "—"
            ),
            "orcanos_key": (r.orcanos_item.key or str(r.orcanos_item.object_id)) if r.orcanos_item else "—",
            "orcanos_id": str(r.orcanos_item.object_id) if r.orcanos_item else "—",
            "action": r.action,
            "reason": r.reason,
            "file_types": _file_types(r.document, r.action),
            "suspicious": (
                r.action == "UPDATE"
                and r.document.pdf_bytes is not None
                and r.document.open_bytes is None
                and r.document.docx_bytes is None
            ),
        }
        for r in results
    ]


@router.post("/upload")
async def upload(
    files: List[UploadFile] = File(...),
    account: str = Form(...),
    auth_key: str = Form(...),
    project_id: int = Form(78),
    filter_id: int = Form(25),
    version_id: int = Form(5),
    parent_id: str = Form(""),
    selected_dms: str = Form(...),
    overrides: str = Form("[]"),
    mode: str = Form("compare"),
):
    from tools.dms.comparison import ComparisonResult

    selected_set = set(json.loads(selected_dms))
    overrides_map = {o["original_dms"]: o for o in json.loads(overrides)}
    file_data = [{"filename": f.filename, "bytes": await f.read()} for f in files]

    documents = load_files_from_bytes(file_data)

    log_lines: list[str] = []

    def log_fn(msg: str):
        log_lines.append(msg)

    api = OrcanosAPI(_build_endpoint(account), auth_key, logger=log_fn)

    if mode == "scratch":
        to_upload = [
            ComparisonResult(document=d, orcanos_item=None, action="CREATE", reason="From scratch")
            for d in documents
            if d.dms_number in selected_set
        ]
    else:
        try:
            raw_items = api.get_all_items(filter_id, version_id)
        except Exception as exc:
            raise HTTPException(502, f"Orcanos API error: {exc}")
        orcanos_items = parse_orcanos_items(raw_items)
        results = compare_with_orcanos(documents, orcanos_items)
        to_upload = [
            r for r in results
            if r.document.dms_number in selected_set and r.action in ("UPDATE", "CREATE")
        ]

    # Apply user-edited values (name, legacy key, revision) before uploading
    import re as _re
    for r in to_upload:
        ov = overrides_map.get(r.document.dms_number)
        if not ov:
            continue
        if ov.get("name"):
            r.document.title = ov["name"]
        if ov.get("dms_number"):
            r.document.dms_number = ov["dms_number"]
        frev = (ov.get("file_rev") or "").strip()
        if frev:
            m = _re.match(r'^([A-Za-z])(\d*)$', frev)
            if m:
                r.document.rev_letter = m.group(1).upper()
                r.document.rev_change = int(m.group(2)) if m.group(2) else 1
            else:
                m2 = _re.match(r'^(\d+)$', frev)
                if m2:
                    r.document.rev_letter = None
                    r.document.rev_change = int(m2.group(1))

    uploader = Uploader(
        api=api,
        project_id=project_id,
        version_id=version_id,
        log_fn=log_fn,
        parent_id=parent_id or "",
    )

    success, failed = 0, 0
    for r in to_upload:
        ok = uploader.upload_update(r) if r.action == "UPDATE" else uploader.upload_new(r)
        if ok:
            success += 1
        else:
            failed += 1

    return {"success": success, "failed": failed, "log": log_lines}
