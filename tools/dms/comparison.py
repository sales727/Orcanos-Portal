import os
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class DocumentFile:
    dms_number: str            # e.g. "DMS-1344"
    rev_letter: Optional[str]  # e.g. "F" — None for pure-numeric revisions
    rev_change: int             # e.g. 1
    title: str                  # e.g. "CAPA procedure"
    # File-path source (desktop / local)
    pdf_path: Optional[str] = None
    docx_path: Optional[str] = None
    # Bytes source (web uploader, Google Drive)
    pdf_bytes: Optional[bytes] = None
    docx_bytes: Optional[bytes] = None
    pdf_name: Optional[str] = None
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
    action: str   # "UPDATE" | "CREATE" | "SAME" | "HOLD"
    reason: str


# ── Filename parsing ──────────────────────────────────────────────────────────

_REV_RE = re.compile(
    r"[Rr]ev\.?\s*([A-Za-z])-?(\d+)"
    r"|[Rr]ev\.?\s*([A-Za-z])\b"
    r"|[Rr]ev\.?\s*(\d+)"
)


def build_rev_regex(rev_prefix: str) -> re.Pattern:
    if not rev_prefix:
        return _REV_RE
    p = re.escape(rev_prefix)
    return re.compile(
        rf"(?:{p})\s*([A-Za-z])-?(\d+)"
        rf"|(?:{p})\s*([A-Za-z])\b"
        rf"|(?:{p})\s*(\d+)",
        re.IGNORECASE,
    )


def parse_dms_filename(filename: str, key_prefix: str = "DMS-",
                       rev_regex: re.Pattern = None) -> Optional[DocumentFile]:
    stem = Path(filename).stem
    space_idx = stem.find(" ")
    if space_idx == -1:
        return None
    dms_number = stem[:space_idx].upper()
    prefix_upper = key_prefix.upper()
    if prefix_upper and not dms_number.startswith(prefix_upper):
        return None
    if not dms_number:
        return None

    rest = stem[space_idx + 1:]
    rev_letter = None
    rev_change = 1
    title = rest

    m = (rev_regex or _REV_RE).search(rest)
    if m:
        if m.group(1):
            rev_letter = m.group(1).upper()
            rev_change = int(m.group(2))
        elif m.group(3):
            rev_letter = m.group(3).upper()
            rev_change = 1
        elif m.group(4):
            rev_letter = None
            rev_change = int(m.group(4))
        title = rest[m.end():].strip(" -_")

    return DocumentFile(
        dms_number=dms_number,
        rev_letter=rev_letter,
        rev_change=rev_change,
        title=title,
    )


# ── Folder scanning (local/desktop) ──────────────────────────────────────────

def load_folder_files(folder_path: str, key_prefix: str = "DMS-",
                      log_fn=None, rev_regex: re.Pattern = None,
                      anomaly_filenames: set = None) -> list[DocumentFile]:
    log = log_fn or (lambda _: None)
    _anomalies = anomaly_filenames or set()
    docs: dict[str, DocumentFile] = {}
    skipped_ext: list[str] = []
    skipped_pattern: list[str] = []

    for fname in sorted(os.listdir(folder_path)):
        fpath = os.path.join(folder_path, fname)
        if not os.path.isfile(fpath):
            continue
        ext = Path(fname).suffix.lower()
        if ext not in (".pdf", ".docx"):
            skipped_ext.append(fname)
            continue

        doc = parse_dms_filename(fname, key_prefix, rev_regex)
        if not doc:
            skipped_pattern.append(fname)
            continue

        key = doc.dms_number
        if key not in docs:
            docs[key] = doc
        if fname in _anomalies:
            docs[key].anomaly = True
        if ext == ".pdf":
            docs[key].pdf_path = fpath
        elif ext == ".docx":
            docs[key].docx_path = fpath
            docs[key].rev_letter = doc.rev_letter
            docs[key].rev_change = doc.rev_change
            docs[key].title = doc.title or docs[key].title

    if skipped_ext:
        log(f"  Skipped {len(skipped_ext)} file(s) — unsupported extension")
    if skipped_pattern:
        log(f"  Skipped {len(skipped_pattern)} file(s) — no matching key prefix")

    return list(docs.values())


# ── Web uploader source ───────────────────────────────────────────────────────

def load_files_from_upload(uploaded_files, key_prefix: str = "DMS-",
                           rev_regex: re.Pattern = None,
                           log_fn=None) -> list[DocumentFile]:
    """Load DocumentFile list from Streamlit UploadedFile objects.
    Reads bytes immediately so they remain available after widget reruns."""
    log = log_fn or (lambda _: None)
    docs: dict[str, DocumentFile] = {}
    skipped_pattern: list[str] = []

    for uf in uploaded_files:
        fname = uf.name
        ext = Path(fname).suffix.lower()
        if ext not in (".pdf", ".docx"):
            continue

        doc = parse_dms_filename(fname, key_prefix, rev_regex)
        if not doc:
            skipped_pattern.append(fname)
            continue

        file_bytes = uf.read()

        key = doc.dms_number
        if key not in docs:
            docs[key] = doc

        if ext == ".pdf":
            docs[key].pdf_bytes = file_bytes
            docs[key].pdf_name = fname
        elif ext == ".docx":
            docs[key].docx_bytes = file_bytes
            docs[key].docx_name = fname
            docs[key].rev_letter = doc.rev_letter
            docs[key].rev_change = doc.rev_change
            docs[key].title = doc.title or docs[key].title

    if skipped_pattern:
        log(f"  Skipped {len(skipped_pattern)} file(s) — no matching key prefix: "
            + ", ".join(skipped_pattern[:5]))

    return list(docs.values())


# ── Convention detection ──────────────────────────────────────────────────────

def detect_naming_convention(folder_path: str) -> dict:
    prefix_counter: Counter = Counter()
    key_examples: list[str] = []
    rev_examples: list[str] = []

    for fname in sorted(os.listdir(folder_path)):
        fpath = os.path.join(folder_path, fname)
        if not os.path.isfile(fpath):
            continue
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
    return {
        "key_prefix": suggested,
        "prefix_counts": dict(prefix_counter.most_common(5)),
        "key_examples": key_examples,
        "rev_examples": rev_examples,
    }


def detect_naming_convention_from_names(filenames: list[str]) -> dict:
    """Same as detect_naming_convention but works from a list of filenames."""
    prefix_counter: Counter = Counter()
    key_examples: list[str] = []
    rev_examples: list[str] = []

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
    return {
        "key_prefix": suggested,
        "prefix_counts": dict(prefix_counter.most_common(5)),
        "key_examples": key_examples,
        "rev_examples": rev_examples,
    }


# ── Orcanos response parsing ──────────────────────────────────────────────────

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
                name = f.get("Name", "")
                text = f.get("Text") or ""
                fields[name] = str(text)
        elif "Fields" in raw:
            for f in raw["Fields"]:
                fields[f.get("Name", "")] = str(f.get("Value") or "")
        else:
            fields = {k: str(v) for k, v in raw.items()}

        key = (fields.get("User_Prefix") or fields.get("Key") or fields.get("key") or "").strip()
        name = (fields.get("Obj_name") or fields.get("Document Title")
                or fields.get("Name") or fields.get("Title") or "").strip()
        revision = (fields.get("DMS_Revision") or fields.get("Revision") or "").strip().upper()

        change_no = 1
        dms_file = fields.get("DMS_File_name", "")
        if dms_file:
            parsed_file = parse_dms_filename(dms_file)
            if parsed_file and parsed_file.rev_letter:
                if parsed_file.rev_letter.upper() == revision:
                    change_no = parsed_file.rev_change
                elif not revision:
                    revision = parsed_file.rev_letter.upper()
                    change_no = parsed_file.rev_change

        if key:
            items.append(OrcanosItem(
                object_id=int(object_id),
                key=key,
                name=name,
                revision=revision,
                change_no=change_no,
            ))
    return items


# ── Revision comparison ───────────────────────────────────────────────────────

def _revision_gap(orcanos: OrcanosItem, doc: DocumentFile) -> list[str]:
    o_letter = orcanos.revision.upper() if orcanos.revision else ""
    d_letter = doc.rev_letter.upper() if doc.rev_letter else ""
    if d_letter and o_letter and d_letter > o_letter:
        skipped = [chr(ord(o_letter) + i) for i in range(1, ord(d_letter) - ord(o_letter))]
        return skipped
    if not d_letter and not o_letter:
        gap = doc.rev_change - orcanos.change_no - 1
        if gap > 0:
            return [str(orcanos.change_no + i) for i in range(1, gap + 1)]
    return []


def _compare_revisions(orcanos: OrcanosItem, doc: DocumentFile) -> str:
    o_letter = orcanos.revision.upper() if orcanos.revision else ""
    o_change = orcanos.change_no
    d_letter = doc.rev_letter.upper() if doc.rev_letter else ""
    d_change = doc.rev_change

    if d_letter and o_letter:
        if d_letter > o_letter:
            return "NEWER"
        if d_letter < o_letter:
            return "OLDER"
        if d_change > o_change:
            return "NEWER"
        if d_change == o_change:
            return "SAME"
        return "OLDER"

    if not d_letter and not o_letter:
        if d_change > o_change:
            return "NEWER"
        if d_change == o_change:
            return "SAME"
        return "OLDER"

    return "HOLD"


def _extract_key_from_name(name: str, key_re: re.Pattern) -> Optional[str]:
    m = key_re.search(name)
    return m.group(0).upper() if m else None


# ── Main comparison ───────────────────────────────────────────────────────────

def compare_with_orcanos(documents: list[DocumentFile],
                          orcanos_items: list[OrcanosItem],
                          key_prefix: str = "DMS-") -> list[ComparisonResult]:
    by_key = {item.key.upper(): item for item in orcanos_items}

    by_embedded: dict[str, OrcanosItem] = {}
    if key_prefix:
        key_re = re.compile(
            rf"\b{re.escape(key_prefix)}[\w]+(?:-[\w]+)*", re.IGNORECASE)
        for item in orcanos_items:
            embedded = _extract_key_from_name(item.name, key_re)
            if embedded and embedded not in by_key:
                by_embedded[embedded] = item

    by_title: dict[str, OrcanosItem] = {}
    _title_seen: set[str] = set()
    for item in orcanos_items:
        norm = item.name.strip().lower()
        if norm in _title_seen:
            by_title.pop(norm, None)
        else:
            _title_seen.add(norm)
            by_title[norm] = item

    results = []
    for doc in documents:
        dms_upper = doc.dms_number.upper()

        orcanos_item = by_key.get(dms_upper)
        match_via = "key" if orcanos_item else None

        if not orcanos_item:
            orcanos_item = by_embedded.get(dms_upper)
            if orcanos_item:
                match_via = "embedded key"

        if not orcanos_item:
            norm_title = doc.title.strip().lower()
            orcanos_item = by_title.get(norm_title)
            if orcanos_item:
                match_via = "title"

        if not orcanos_item:
            results.append(ComparisonResult(
                document=doc,
                orcanos_item=None,
                action="CREATE",
                reason="No matching record found in Orcanos",
            ))
            continue

        cmp = _compare_revisions(orcanos_item, doc)
        d_rev = f"{doc.rev_letter or ''}{doc.rev_change}"
        o_rev = f"{orcanos_item.revision}{orcanos_item.change_no}"
        via = f" [matched by {match_via}]" if match_via != "key" else ""

        if cmp == "NEWER":
            gap = _revision_gap(orcanos_item, doc)
            gap_note = f" ⚠ skips {', '.join(gap)}" if gap else ""
            action, reason = "UPDATE", f"File {d_rev} > Orcanos {o_rev}{via}{gap_note}"
        elif cmp == "SAME":
            action, reason = "SAME", f"Both at {d_rev} — confirm content changed before uploading{via}"
        elif cmp == "OLDER":
            action, reason = "HOLD", f"File {d_rev} < Orcanos {o_rev} — possible downgrade{via}"
        else:
            action, reason = "HOLD", f"Mixed revision format — manual review needed{via}"

        results.append(ComparisonResult(
            document=doc,
            orcanos_item=orcanos_item,
            action=action,
            reason=reason,
        ))

    return sorted(results, key=lambda r: r.action)
