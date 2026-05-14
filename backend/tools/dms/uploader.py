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

    def upload_update(self, result: ComparisonResult) -> bool:
        item = result.orcanos_item
        doc = result.document
        self.log(f"[UPDATE] {doc.dms_number} → record ID {item.object_id}")

        open_bytes = doc.open_bytes or doc.docx_bytes
        open_name = doc.open_name or doc.docx_name
        ext = "." + open_name.rsplit(".", 1)[-1] if open_name else ".docx"
        clean_fname = f"{doc.title}{ext}"

        if open_bytes:
            orig = open_name or f"{doc.dms_number}{ext}"
            if not self._attach_bytes(item.object_id, open_bytes, orig, f"{ext[1:].upper()} (original)"):
                return False
            if not self._attach_bytes(item.object_id, open_bytes, clean_fname, f"{ext[1:].upper()} (clean)"):
                return False
        else:
            self.log("  ✗ No open-format file — skipping")
            return False

        self._update_fields(item.object_id, doc.title, doc.rev_letter or "", doc.dms_number)
        return True

    def upload_new(self, result: ComparisonResult) -> bool:
        doc = result.document
        object_name = f"{doc.dms_number} {doc.title}".strip()
        self.log(f"[CREATE] {doc.dms_number} → '{object_name}'")

        try:
            resp = self.api.add_object(self.project_id, object_name,
                                       self.object_type, parent_id=self.parent_id)
        except Exception as exc:
            self.log(f"  ✗ add_object error: {exc}")
            return False

        if not resp.get("IsSuccess"):
            self.log(f"  ✗ add_object failed: {resp.get('Message', 'unknown')}")
            return False

        object_id = resp.get("Data")
        self.log(f"  ✓ Created with ID {object_id}")
        clean_fname = f"{doc.title}.docx"

        open_bytes = doc.open_bytes or doc.docx_bytes
        open_name = doc.open_name or doc.docx_name
        ext = "." + open_name.rsplit(".", 1)[-1] if open_name else ".docx"
        clean_fname = f"{doc.title}{ext}"

        if doc.pdf_bytes:
            pdf_name = doc.pdf_name or f"{doc.dms_number}.pdf"
            if not self._attach_bytes(object_id, doc.pdf_bytes, pdf_name, "PDF → A1"):
                return False

        if open_bytes:
            orig = open_name or f"{doc.dms_number}{ext}"
            label = ext[1:].upper()
            if not self._attach_bytes(object_id, open_bytes, orig, f"{label} → A2"):
                return False
            if not self._attach_bytes(object_id, open_bytes, clean_fname, f"{label} (clean) → A3"):
                return False

        self._update_fields(object_id, doc.title, doc.rev_letter or "", doc.dms_number)
        return True

    def _attach_bytes(self, object_id, file_bytes, filename, label) -> bool:
        try:
            resp = self.api.add_attachment_bytes(object_id, file_bytes, filename)
        except Exception as exc:
            self.log(f"  ✗ {label} error: {exc}")
            return False
        if resp.get("IsSuccess"):
            self.log(f"  ✓ {label}: {filename}")
            time.sleep(0.5)
            return True
        self.log(f"  ✗ {label} failed: {resp.get('Message', 'unknown')} — {filename}")
        return False

    def _update_fields(self, object_id, name, revision, key) -> None:
        try:
            resp = self.api.update_object(
                object_id, self.version_id, object_name=name,
                custom_fields={"Legacy Revision": revision, "Legacy Key": key},
            )
            if resp.get("IsSuccess"):
                self.log(f"  ✓ Fields updated — Name='{name}', Revision='{revision}'")
            else:
                self.log(f"  ✗ Field update failed: {resp.get('Message', 'unknown')}")
        except Exception as exc:
            self.log(f"  ✗ Field update error: {exc}")
