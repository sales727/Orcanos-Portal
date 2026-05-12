import json
import mimetypes
import time

import requests
from requests.exceptions import ConnectionError as ReqConnectionError, Timeout


class OrcanosAPI:
    def __init__(self, endpoint_base: str, auth_key: str, logger=None):
        self.base = endpoint_base.rstrip("/")
        self.auth_key = auth_key.strip()
        self._json_headers = {"OrcanosAPIKey": self.auth_key, "Content-Type": "application/json"}
        self._file_headers = {"OrcanosAPIKey": self.auth_key}
        self._log = logger or (lambda _: None)

    def _post_json(self, url: str, payload: dict, timeout: int = 60,
                   retries: int = 1) -> requests.Response:
        delay = 5
        for attempt in range(retries + 1):
            try:
                return requests.post(url, json=payload,
                                     headers=self._json_headers, timeout=timeout)
            except (Timeout, ReqConnectionError) as exc:
                if attempt < retries:
                    self._log(f"  ⚠ {type(exc).__name__} — retrying in {delay}s "
                              f"(attempt {attempt + 1}/{retries})…")
                    time.sleep(delay)
                else:
                    raise

    def _log_exchange(self, url: str, payload: dict, resp: requests.Response,
                      log_response_body: bool = False):
        safe_payload = {k: ("***" if k == "OrcanosAPIKey" else v) for k, v in payload.items()}
        self._log(f"POST {url}")
        self._log(f"  Payload: {json.dumps(safe_payload)}")
        self._log(f"  Status : {resp.status_code}")
        if log_response_body or not resp.ok:
            try:
                self._log(f"  Response: {json.dumps(resp.json())}")
            except Exception:
                self._log(f"  Response (raw): {resp.text[:500]}")

    def get_filter_results(self, filter_id: int, version_id: int,
                           item_type: str = "DMS", page_no: int = 1,
                           page_size: int = 500,
                           log_response_body: bool = False) -> dict:
        url = f"{self.base}/QW_Get_Filter_Results"
        payload = {
            "Filter_id": str(filter_id),
            "Page_no": str(page_no),
            "Page_Size": str(page_size),
            "Item_Type": item_type,
            "Version_id": str(version_id),
            "IsNewPaging": "",
            "IsReturnPageCount": "",
            "IncludeProtectedCol": True,
        }
        resp = requests.post(url, json=payload, headers=self._json_headers, timeout=60)
        self._log_exchange(url, payload, resp, log_response_body=log_response_body)
        resp.raise_for_status()
        return resp.json()

    def get_all_items(self, filter_id: int, version_id: int,
                      item_type: str = "DMS") -> list:
        all_items = []
        page = 1
        while True:
            result = self.get_filter_results(filter_id, version_id, item_type, page, 500)
            if not result.get("IsSuccess"):
                raise RuntimeError(result.get("Message", "get_filter_results failed"))
            data = result.get("Data", {})
            items = data.get("Object") or []
            all_items.extend(items)
            total = int(data.get("Total_records") or data.get("TotalRecords") or 0)
            self._log(f"  Page {page}: {len(items)} items (total {len(all_items)}/{total})")
            if not items or len(all_items) >= total:
                break
            page += 1
        return all_items

    def add_object(self, project_id: int, object_name: str,
                   object_type: str = "DMS Item",
                   parent_id: str = "") -> dict:
        url = f"{self.base}/QW_Add_Object"
        payload = {
            "Project_ID": project_id,
            "Major_Version": 1,
            "Minor_Version": 0,
            "Object_Name": object_name,
            "Object_Type": object_type,
            "Release_Version": "0",
            "Build_Version": "0",
            "Insert_to_Pool": "N" if parent_id else "Y",
            "SkipIfNameExists": "Y",
        }
        if parent_id:
            payload["Parent_ID"] = str(parent_id)
        resp = self._post_json(url, payload, timeout=60, retries=1)
        self._log_exchange(url, payload, resp, log_response_body=True)
        resp.raise_for_status()
        return resp.json()

    def add_folder(self, project_id: int, folder_name: str,
                   parent_id: str = "") -> dict:
        """Create a DMS Folder in Orcanos."""
        return self.add_object(project_id, folder_name, "DMS Folder", parent_id)

    def add_attachment(self, object_id: int, file_path: str,
                       description: str = "", upload_as: str = None) -> dict:
        """Upload a file from disk path as a new DMS revision."""
        import os
        url = f"{self.base}/Add_Attachment"
        fname = upload_as or os.path.basename(file_path)
        params = {
            "Object_ID": object_id,
            "Object_Type": "DMS",
            "Attachment_Type": "DMS",
            "Attachment_Desc": description,
        }
        mime = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
        self._log(f"POST {url} — {fname} ({mime})")
        with open(file_path, "rb") as fh:
            resp = requests.post(
                url,
                params=params,
                files={"File1": (fname, fh, mime)},
                headers=self._file_headers,
                timeout=120,
            )
        self._log(f"  Status : {resp.status_code}")
        if not resp.ok:
            self._log(f"  Response (raw): {resp.text[:500]}")
        resp.raise_for_status()
        return resp.json()

    def add_attachment_bytes(self, object_id: int, file_bytes: bytes,
                             filename: str, description: str = "") -> dict:
        """Upload file from bytes (Streamlit uploader, Google Drive, etc.)."""
        url = f"{self.base}/Add_Attachment"
        params = {
            "Object_ID": object_id,
            "Object_Type": "DMS",
            "Attachment_Type": "DMS",
            "Attachment_Desc": description,
        }
        mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        self._log(f"POST {url} — {filename} ({mime})")
        resp = requests.post(
            url,
            params=params,
            files={"File1": (filename, file_bytes, mime)},
            headers=self._file_headers,
            timeout=120,
        )
        self._log(f"  Status : {resp.status_code}")
        if not resp.ok:
            self._log(f"  Response (raw): {resp.text[:500]}")
        resp.raise_for_status()
        return resp.json()

    def update_object(self, object_id: int, version_id: int,
                      object_name: str = None,
                      custom_fields: dict = None) -> dict:
        url = f"{self.base}/QW_Update_Object"
        payload = {
            "Object_ID": object_id,
            "Object_Type": "DMS Item",
            "View_Version": str(version_id),
        }
        if object_name is not None:
            payload["Object_Name"] = object_name
        if custom_fields:
            for i, (name, value) in enumerate(custom_fields.items(), start=1):
                payload[f"CS{i}_Name"] = name
                payload[f"CS{i}_value"] = str(value)
        resp = self._post_json(url, payload, timeout=60, retries=1)
        self._log_exchange(url, payload, resp, log_response_body=True)
        resp.raise_for_status()
        return resp.json()
