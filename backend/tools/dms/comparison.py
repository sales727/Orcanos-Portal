import os
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class DocumentFile:
    dms_number: str
    rev_letter: Optional[str]
    rev_change: int
    title: str
    pdf_path: Optional[str] = None
    docx_path: Optional[str] = None
    pdf_bytes: Optional[bytes] = None
    open_bytes: Optional[bytes] = None   # docx / xlsx / pptx
    open_name: Optional[str] = None
    pdf_name: Optional[str] = None
    # kept for backward compatibility
    docx_bytes: Optional[bytes] = None
    docx_name: Optional[str] = None
    anomaly: bool = False


@dataclass
class OrcanosItem:
    object_id: int
    key: str
    name: str
    revision: str
    change_no: int


@dataclass
class ComparisonResult:
    document: DocumentFile
    orcanos_item: Optional[OrcanosItem]
    action: str
    reason: str


_REV_RE = re.compile(
    r"[Rr]ev\.?\s*([A-Za-z])-?(\d+)"
    r"|[Rr]ev\.?\s*([A-Za-z])\b"
    r"|[Rr]ev\.?\s*(\d+)"
)


def parse_dms_filename(filename: str, key_prefix: str = "DMS-",
                       rev_regex: re.Pattern = None) -> Optional[DocumentFile]:
    stem = Path(filename).stem
    space_idx = stem.find(" ")
    if space_idx == -1:
        dms_number = stem.upper()
        if key_prefix.upper() and not dms_number.startswith(key_prefix.upper()):
            return None
        return DocumentFile(dms_number=dms_number, rev_letter=None, rev_change=1, title="")
    dms_number = stem[:space_idx].upper()
    if key_prefix.upper() and not dms_number.startswith(key_prefix.upper()):
        return None

    rest = stem[space_idx + 1:]
    rev_letter, rev_change, title = None, 1, rest

    m = (rev_regex or _REV_RE).search(rest)
    if m:
        if m.group(1):
            rev_letter, rev_change = m.group(1).upper(), int(m.group(2))
        elif m.group(3):
            rev_letter, rev_change = m.group(3).upper(), 1
        elif m.group(4):
            rev_letter, rev_change = None, int(m.group(4))
        title = rest[m.end():].strip(" -_")

    return DocumentFile(dms_number=dms_number, rev_letter=rev_letter,
                        rev_change=rev_change, title=title)


_OPEN_FORMATS = {".docx", ".xlsx", ".pptx"}


def load_files_from_bytes(file_data: list[dict], key_prefix: str = "",
                          rev_regex: re.Pattern = None,
                          log_fn=None) -> list[DocumentFile]:
    """Load DocumentFile list from a list of {filename, bytes} dicts (FastAPI uploads)."""
    log = log_fn or (lambda _: None)
    docs: dict[str, DocumentFile] = {}
    skipped = []

    for item in file_data:
        fname = item["filename"]
        file_bytes = item["bytes"]
        ext = Path(fname).suffix.lower()
        if ext not in {".pdf"} | _OPEN_FORMATS:
            continue

        doc = parse_dms_filename(fname, key_prefix, rev_regex)
        if not doc:
            skipped.append(fname)
            continue

        key = doc.dms_number
        if key not in docs:
            docs[key] = doc

        if ext == ".pdf":
            docs[key].pdf_bytes = file_bytes
            docs[key].pdf_name = fname
        elif ext in _OPEN_FORMATS:
            docs[key].open_bytes = file_bytes
            docs[key].open_name = fname
            # keep legacy alias in sync
            docs[key].docx_bytes = file_bytes
            docs[key].docx_name = fname
            docs[key].rev_letter = doc.rev_letter
            docs[key].rev_change = doc.rev_change
            docs[key].title = doc.title or docs[key].title

    if skipped:
        log(f"  Skipped {len(skipped)} file(s) — could not parse DMS number")

    return list(docs.values())


def detect_naming_convention_from_names(filenames: list[str]) -> dict:
    prefix_counter: Counter = Counter()
    key_examples, rev_examples = [], []

    for fname in filenames:
        if Path(fname).suffix.lower() not in (".pdf", ".docx"):
            continue
        stem = Path(fname).stem
        tokens = stem.split()
        if not tokens:
            continue
        first = tokens[0]
        m = re.match(r'^([A-Za-z][A-Za-z0-9-]*-)?(\d)', first)
        if m:
            prefix = (m.group(1) or "").upper()
            prefix_counter[prefix] += 1
            if len(key_examples) < 3 and first.upper() not in key_examples:
                key_examples.append(first.upper())
        rev_m = _REV_RE.search(stem)
        if rev_m and len(rev_examples) < 3:
            sample = rev_m.group(0)
            if sample not in rev_examples:
                rev_examples.append(sample)

    suggested = prefix_counter.most_common(1)[0][0] if prefix_counter else "DMS-"
    return {"key_prefix": suggested, "key_examples": key_examples, "rev_examples": rev_examples}


def parse_orcanos_items(raw_items: list) -> list[OrcanosItem]:
    items = []
    for raw in raw_items:
        object_id = (raw.get("Id") or raw.get("ID") or raw.get("id")
                     or raw.get("ObjectID") or raw.get("ItemID"))
        if not object_id:
            continue

        fields: dict[str, str] = {}
        if "Field" in raw:
            for f in raw["Field"]:
                fields[f.get("Name", "")] = str(f.get("Text") or "")
        elif "Fields" in raw:
            for f in raw["Fields"]:
                fields[f.get("Name", "")] = str(f.get("Value") or "")
        else:
            fields = {k: str(v) for k, v in raw.items()}

        raw_key = (fields.get("User_Prefix") or fields.get("Key") or "").strip()
        # Require at least one digit — guards against invisible chars or bare prefix "DMS-"
        key = raw_key if re.search(r'\d', raw_key) else ""

        name = (fields.get("Obj_name") or fields.get("Document Title")
                or fields.get("Name") or "").strip()
        revision = (fields.get("DMS_Revision") or fields.get("Revision") or "").strip().upper()

        # Fallback: extract first DMS-XXXX pattern from the item name
        if not key and name:
            m = re.search(r'\b[A-Za-z]+-\d[\w-]*', name)
            if m:
                key = m.group(0).upper()

        change_no = 1
        dms_file = fields.get("DMS_File_name", "")
        if dms_file:
            pf = parse_dms_filename(dms_file)
            if pf and pf.rev_letter:
                if pf.rev_letter.upper() == revision:
                    change_no = pf.rev_change
                elif not revision:
                    revision = pf.rev_letter.upper()
                    change_no = pf.rev_change

        # Include item even without a key so title-matching can still find it
        items.append(OrcanosItem(object_id=int(object_id), key=key,
                                 name=name, revision=revision, change_no=change_no))
    return items


def _revision_gap(orcanos: OrcanosItem, doc: DocumentFile) -> list[str]:
    o_l = orcanos.revision.upper() if orcanos.revision else ""
    d_l = doc.rev_letter.upper() if doc.rev_letter else ""
    if d_l and o_l and d_l > o_l:
        return [chr(ord(o_l) + i) for i in range(1, ord(d_l) - ord(o_l))]
    if not d_l and not o_l:
        gap = doc.rev_change - orcanos.change_no - 1
        if gap > 0:
            return [str(orcanos.change_no + i) for i in range(1, gap + 1)]
    return []


def _compare_revisions(orcanos: OrcanosItem, doc: DocumentFile) -> str:
    o_l = orcanos.revision.upper() if orcanos.revision else ""
    d_l = doc.rev_letter.upper() if doc.rev_letter else ""
    if d_l and o_l:
        if d_l > o_l: return "NEWER"
        if d_l < o_l: return "OLDER"
        if doc.rev_change > orcanos.change_no: return "NEWER"
        if doc.rev_change == orcanos.change_no: return "SAME"
        return "OLDER"
    if not d_l and not o_l:
        if doc.rev_change > orcanos.change_no: return "NEWER"
        if doc.rev_change == orcanos.change_no: return "SAME"
        return "OLDER"
    return "HOLD"


def compare_with_orcanos(documents: list[DocumentFile],
                          orcanos_items: list[OrcanosItem],
                          key_prefix: str = "DMS-") -> list[ComparisonResult]:
    by_key = {item.key.upper(): item for item in orcanos_items}
    by_embedded: dict[str, OrcanosItem] = {}
    if key_prefix:
        key_re = re.compile(rf"\b{re.escape(key_prefix)}[\w]+(?:-[\w]+)*", re.IGNORECASE)
        for item in orcanos_items:
            m = key_re.search(item.name)
            if m:
                embedded = m.group(0).upper()
                if embedded not in by_key:
                    by_embedded[embedded] = item

    by_title: dict[str, OrcanosItem] = {}
    seen: set[str] = set()
    for item in orcanos_items:
        norm = item.name.strip().lower()
        if norm in seen:
            by_title.pop(norm, None)
        else:
            seen.add(norm)
            by_title[norm] = item

    results = []
    for doc in documents:
        dms_upper = doc.dms_number.upper()
        oi = by_key.get(dms_upper)
        match_via = "key" if oi else None
        if not oi:
            oi = by_embedded.get(dms_upper)
            if oi: match_via = "embedded key"
        if not oi:
            oi = by_title.get(doc.title.strip().lower())
            if oi: match_via = "title"

        if not oi:
            results.append(ComparisonResult(document=doc, orcanos_item=None,
                                            action="CREATE",
                                            reason="No matching record found in Orcanos"))
            continue

        cmp = _compare_revisions(oi, doc)
        d_rev = f"{doc.rev_letter or ''}{doc.rev_change}"
        o_rev = f"{oi.revision}{oi.change_no}"
        via = f" [matched by {match_via}]" if match_via != "key" else ""

        if cmp == "NEWER":
            gap = _revision_gap(oi, doc)
            gap_note = f" ⚠ skips {', '.join(gap)}" if gap else ""
            action, reason = "UPDATE", f"File {d_rev} > Orcanos {o_rev}{via}{gap_note}"
        elif cmp == "SAME":
            action, reason = "SAME", f"Both at {d_rev}{via}"
        elif cmp == "OLDER":
            action, reason = "HOLD", f"File {d_rev} < Orcanos {o_rev} — possible downgrade{via}"
        else:
            action, reason = "HOLD", f"Mixed revision format — manual review needed{via}"

        results.append(ComparisonResult(document=doc, orcanos_item=oi,
                                        action=action, reason=reason))

    return sorted(results, key=lambda r: r.action)
