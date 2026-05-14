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

    def _post_json(self, url, payload, timeout=60, retries=1):
        delay = 5
        for attempt in range(retries + 1):
            try:
                return requests.post(url, json=payload, headers=self._json_headers, timeout=timeout)
            except (Timeout, ReqConnectionError) as exc:
                if attempt < retries:
                    self._log(f"  ⚠ {type(exc).__name__} — retrying in {delay}s")
                    time.sleep(delay)
                else:
                    raise

    def _log_exchange(self, url, payload, resp, log_response_body=False):
        safe = {k: ("***" if k == "OrcanosAPIKey" else v) for k, v in payload.items()}
        self._log(f"POST {url}  payload={json.dumps(safe)}  status={resp.status_code}")
        if log_response_body or not resp.ok:
            try:
                self._log(f"  response={json.dumps(resp.json())}")
            except Exception:
                self._log(f"  response(raw)={resp.text[:500]}")

    def get_filter_results(self, filter_id, version_id, item_type="DMS",
                           page_no=1, page_size=500, log_response_body=False):
        url = f"{self.base}/QW_Get_Filter_Results"
        payload = {
            "Filter_id": str(filter_id), "Page_no": str(page_no),
            "Page_Size": str(page_size), "Item_Type": item_type,
            "Version_id": str(version_id), "IsNewPaging": "",
            "IsReturnPageCount": "", "IncludeProtectedCol": True,
        }
        resp = requests.post(url, json=payload, headers=self._json_headers, timeout=60)
        self._log_exchange(url, payload, resp, log_response_body)
        resp.raise_for_status()
        return resp.json()

    def get_all_items(self, filter_id, version_id, item_type="DMS"):
        all_items, page = [], 1
        while True:
            result = self.get_filter_results(filter_id, version_id, item_type, page, 500)
            if not result.get("IsSuccess"):
                raise RuntimeError(result.get("Message", "get_filter_results failed"))
            data = result.get("Data", {})
            items = data.get("Object") or []
            all_items.extend(items)
            total = int(data.get("Total_records") or data.get("TotalRecords") or 0)
            self._log(f"  Page {page}: {len(items)} items ({len(all_items)}/{total})")
            if not items or len(all_items) >= total:
                break
            page += 1
        return all_items

    def add_object(self, project_id, object_name, object_type="DMS Item", parent_id=""):
        url = f"{self.base}/QW_Add_Object"
        payload = {
            "Project_ID": project_id, "Major_Version": 1, "Minor_Version": 0,
            "Object_Name": object_name, "Object_Type": object_type,
            "Release_Version": "0", "Build_Version": "0",
            "Insert_to_Pool": "N" if parent_id else "Y", "SkipIfNameExists": "Y",
        }
        if parent_id:
            payload["Parent_ID"] = str(parent_id)
        resp = self._post_json(url, payload, timeout=60, retries=1)
        self._log_exchange(url, payload, resp, log_response_body=True)
        resp.raise_for_status()
        return resp.json()

    def add_folder(self, project_id, folder_name, parent_id=""):
        return self.add_object(project_id, folder_name, "DMS Folder", parent_id)

    def add_attachment_bytes(self, object_id, file_bytes, filename, description=""):
        url = f"{self.base}/Add_Attachment"
        params = {"Object_ID": object_id, "Object_Type": "DMS",
                  "Attachment_Type": "DMS", "Attachment_Desc": description}
        mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        self._log(f"POST {url} — {filename} ({mime})")
        resp = requests.post(url, params=params,
                             files={"File1": (filename, file_bytes, mime)},
                             headers=self._file_headers, timeout=120)
        self._log(f"  Status: {resp.status_code}")
        if not resp.ok:
            self._log(f"  Response: {resp.text[:500]}")
        resp.raise_for_status()
        return resp.json()

    def update_object(self, object_id, version_id, object_name=None, custom_fields=None):
        url = f"{self.base}/QW_Update_Object"
        payload = {"Object_ID": object_id, "Object_Type": "DMS Item",
                   "View_Version": str(version_id)}
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
