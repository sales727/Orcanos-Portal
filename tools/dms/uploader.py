import os
import time
from typing import Callable, Optional

from tools.dms.orcanos_api import OrcanosAPI
from tools.dms.comparison import ComparisonResult


class Uploader:
    def __init__(self, api: OrcanosAPI, project_id: int,
                 object_type: str = "DMS Item", version_id: int = 5,
                 log_fn: Optional[Callable[[str], None]] = None,
                 parent_id: str = ""):
        self.api = api
        self.project_id = project_id
        self.object_type = object_type
        self.version_id = version_id
        self.log = log_fn or print
        self.parent_id = parent_id

    # ── Update existing record ─────────────────────────────────────────────────

    def upload_update(self, result: ComparisonResult) -> bool:
        item = result.orcanos_item
        doc = result.document
        self.log(f"[UPDATE] {doc.dms_number} → existing record ID {item.object_id}")

        clean_fname = f"{doc.title}.docx"

        if doc.docx_bytes:
            orig_name = doc.docx_name or f"{doc.dms_number}.docx"
            if not self._attach_bytes(item.object_id, doc.docx_bytes, orig_name, "DOCX (original)"):
                return False
            if not self._attach_bytes(item.object_id, doc.docx_bytes, clean_fname, "DOCX (clean name)"):
                return False
        elif doc.docx_path:
            if not self._attach_file(item.object_id, doc.docx_path, "DOCX (original)"):
                return False
            if not self._attach_file(item.object_id, doc.docx_path, "DOCX (clean name)",
                                     upload_as=clean_fname):
                return False
        else:
            self.log("  ✗ No DOCX file found — skipping update")
            return False

        self._update_fields(item.object_id, doc.title, doc.rev_letter or "", doc.dms_number)
        return True

    # ── Create new record ──────────────────────────────────────────────────────

    def upload_new(self, result: ComparisonResult) -> bool:
        doc = result.document
        object_name = f"{doc.dms_number} {doc.title}".strip()
        self.log(f"[CREATE] {doc.dms_number} → new record: '{object_name}'")

        try:
            resp = self.api.add_object(self.project_id, object_name, self.object_type,
                                       parent_id=self.parent_id)
        except Exception as exc:
            self.log(f"  ✗ add_object error: {exc}")
            return False

        if not resp.get("IsSuccess"):
            self.log(f"  ✗ add_object failed: {resp.get('Message', 'unknown error')}")
            return False

        object_id = resp.get("Data")
        self.log(f"  ✓ Created with ID {object_id}")

        clean_fname = f"{doc.title}.docx"

        if doc.pdf_bytes:
            pdf_name = doc.pdf_name or f"{doc.dms_number}.pdf"
            if not self._attach_bytes(object_id, doc.pdf_bytes, pdf_name, "PDF → A1"):
                return False
        elif doc.pdf_path:
            if not self._attach_file(object_id, doc.pdf_path, "PDF → A1"):
                return False

        if doc.docx_bytes:
            orig_name = doc.docx_name or f"{doc.dms_number}.docx"
            if not self._attach_bytes(object_id, doc.docx_bytes, orig_name, "DOCX (original) → A2"):
                return False
            if not self._attach_bytes(object_id, doc.docx_bytes, clean_fname, "DOCX (clean name) → A3"):
                return False
        elif doc.docx_path:
            if not self._attach_file(object_id, doc.docx_path, "DOCX (original) → A2"):
                return False
            if not self._attach_file(object_id, doc.docx_path, "DOCX (clean name) → A3",
                                     upload_as=clean_fname):
                return False

        self._update_fields(object_id, doc.title, doc.rev_letter or "", doc.dms_number)
        return True

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _attach_bytes(self, object_id: int, file_bytes: bytes,
                      filename: str, label: str) -> bool:
        try:
            resp = self.api.add_attachment_bytes(object_id, file_bytes, filename)
        except Exception as exc:
            self.log(f"  ✗ {label} upload error: {exc}")
            return False

        if resp.get("IsSuccess"):
            self.log(f"  ✓ {label}: {filename}")
            time.sleep(0.5)
            return True

        self.log(f"  ✗ {label} failed: {resp.get('Message', 'unknown error')} — {filename}")
        return False

    def _attach_file(self, object_id: int, fpath: str, label: str,
                     upload_as: str = None) -> bool:
        display = upload_as or os.path.basename(fpath)
        try:
            resp = self.api.add_attachment(object_id, fpath, upload_as=upload_as)
        except Exception as exc:
            self.log(f"  ✗ {label} upload error: {exc}")
            return False

        if resp.get("IsSuccess"):
            self.log(f"  ✓ {label}: {display}")
            time.sleep(0.5)
            return True

        self.log(f"  ✗ {label} failed: {resp.get('Message', 'unknown error')} — {display}")
        return False

    def _update_fields(self, object_id: int, name: str,
                       revision: str, key: str) -> None:
        try:
            resp = self.api.update_object(
                object_id, self.version_id,
                object_name=name,
                custom_fields={"Legacy Revision": revision, "Legacy Key": key},
            )
            if resp.get("IsSuccess"):
                self.log(f"  ✓ Fields updated — Name='{name}', "
                         f"Legacy Revision='{revision}', Legacy Key='{key}'")
            else:
                self.log(f"  ✗ Field update failed: {resp.get('Message', 'unknown')}")
        except Exception as exc:
            self.log(f"  ✗ Field update error: {exc}")

    # ── Batch processing ──────────────────────────────────────────────────────

    def process(self, results: list[ComparisonResult],
                actions: set = None,
                progress_fn: Optional[Callable[[int, int], None]] = None) -> dict:
        if actions is None:
            actions = {"UPDATE", "CREATE"}

        to_process = [r for r in results if r.action in actions]
        stats = {"success": 0, "failed": 0, "skipped": len(results) - len(to_process)}

        for i, result in enumerate(to_process):
            if result.action == "UPDATE":
                ok = self.upload_update(result)
            elif result.action == "CREATE":
                ok = self.upload_new(result)
            else:
                continue

            if ok:
                stats["success"] += 1
            else:
                stats["failed"] += 1

            if progress_fn:
                progress_fn(i + 1, len(to_process))

        self.log(
            f"\nDone — {stats['success']} succeeded, "
            f"{stats['failed']} failed, {stats['skipped']} skipped."
        )
        return stats
