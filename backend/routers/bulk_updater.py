import base64
from typing import Optional

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, model_validator

router = APIRouter(prefix="/api/bulk-updater", tags=["bulk-updater"])


def _url(account_name: str, path: str) -> str:
    return f"https://app.orcanos.com/{account_name}{path}"


class AuthFields(BaseModel):
    """Shared by every request that needs to authenticate against Orcanos.

    Either an API key, or a Basic Auth username/password — same two methods
    the Importer tool offers.
    """

    auth_type: str = "apikey"  # "apikey" | "basic"
    api_key: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

    @model_validator(mode="after")
    def _check_credentials(self):
        if self.auth_type == "basic":
            if not self.username or not self.password:
                raise ValueError("username and password are required for basic auth")
        elif not self.api_key:
            raise ValueError("api_key is required for apikey auth")
        return self


def _auth_headers(auth: AuthFields, content_type: Optional[str] = None) -> dict:
    headers = {"Accept": "application/json"}
    if content_type:
        headers["Content-Type"] = content_type
    if auth.auth_type == "basic":
        token = base64.b64encode(f"{auth.username}:{auth.password}".encode()).decode()
        headers["Authorization"] = f"Basic {token}"
    else:
        headers["OrcanosAPIKey"] = auth.api_key
    return headers


def _fetch_item_fields(account_name: str, auth: AuthFields, item_id: str | int) -> dict:
    for path in [
        f"/api/v2/Json/Get_Object/{item_id}",
        f"/api/v2/Json/QW_Get_Object/{item_id}",
    ]:
        try:
            r = requests.get(_url(account_name, path), headers=_auth_headers(auth), timeout=30)
            if r.status_code == 404:
                continue
            data = r.json()
            if not data.get("IsSuccess"):
                continue
            fields = data.get("Data", {}).get("Field") or data.get("Data", {}).get("Fields") or []
            return {f["Name"]: f.get("Value") or f.get("Text") for f in fields}
        except Exception:
            continue
    return {}


def _is_frozen(item: dict) -> bool:
    if item.get("Freeze") in ("1", 1, True):
        return True
    for f in item.get("Field", []):
        if f.get("Name") in ("Freeze", "Is_Frozen"):
            if str(f.get("Text", "")).lower() in ("1", "true", "frozen"):
                return True
    return False


# ── Models ────────────────────────────────────────────────────────────────────

class PreviewRequest(AuthFields):
    account_name: str
    filter_id: int
    project_id: int
    item_type: str
    description_mode: str        # "template" | "html"
    template_id: Optional[int] = None
    custom_html: Optional[str] = None


class PreviewItem(BaseModel):
    id: str
    name: str
    frozen: bool


class PreviewResponse(BaseModel):
    description_html: str
    items: list[PreviewItem]


class UpdateItemRequest(AuthFields):
    account_name: str
    item_id: str
    project_id: int
    description_html: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/preview", response_model=PreviewResponse)
def preview(req: PreviewRequest):
    # Resolve description HTML
    if req.description_mode == "html":
        if not req.custom_html:
            raise HTTPException(400, "custom_html required for html mode")
        description_html = req.custom_html
    else:
        if not req.template_id:
            raise HTTPException(400, "template_id required for template mode")
        fields = _fetch_item_fields(req.account_name, req, req.template_id)
        if "Description" not in fields:
            raise HTTPException(400, "Description field not found on template item. Check Account Name and credentials.")
        description_html = fields.get("Description") or ""

    # Fetch all filter pages
    items: list[PreviewItem] = []
    page = 1
    while True:
        body = {
            "Filter_id": req.filter_id,
            "Version_id": req.project_id,
            "Item_Type": req.item_type,
            "Page_no": page,
            "Page_Size": 50,
        }
        try:
            r = requests.post(
                _url(req.account_name, "/api/v2/Json/QW_Get_Filter_Results"),
                headers=_auth_headers(req, content_type="application/json"),
                json=body,
                timeout=30,
            )
            data = r.json()
        except Exception as exc:
            raise HTTPException(502, f"Orcanos API error: {exc}")

        if not data.get("IsSuccess"):
            raise HTTPException(400, data.get("Message") or "QW_Get_Filter_Results failed")

        page_items = data.get("Data", {}).get("Object") or []
        for item in page_items:
            name = str(item.get("Synopsis") or item.get("Name") or "")
            items.append(PreviewItem(id=str(item["Id"]), name=name, frozen=_is_frozen(item)))

        total = int(data.get("Data", {}).get("Total_records") or 0)
        page_size = int(data.get("Data", {}).get("Page_size") or 50)
        if not page_items or page * page_size >= total:
            break
        page += 1

    return PreviewResponse(description_html=description_html, items=items)


@router.post("/update-item")
def update_item(req: UpdateItemRequest):
    current = _fetch_item_fields(req.account_name, req, req.item_id)

    payload = {
        **current,
        "Object_ID": req.item_id,
        "View_Version": str(req.project_id),
        "Description": req.description_html,
        "Updated_By": "API.User",
    }

    try:
        r = requests.post(
            _url(req.account_name, "/api/v2/Json/QW_Update_Object"),
            headers=_auth_headers(req, content_type="application/json"),
            json=payload,
            timeout=30,
        )
        data = r.json()
    except Exception as exc:
        raise HTTPException(502, str(exc))

    if not data.get("IsSuccess"):
        raise HTTPException(400, data.get("Message") or "QW_Update_Object failed")

    return {"success": True}
