import base64
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, model_validator

from tools.parent_updater.csv_parser import parse_parent_rows
from tools.parent_updater.orcanos import update_parent

router = APIRouter(prefix="/api/parent-updater", tags=["parent-updater"])


class AuthFields(BaseModel):
    """Same two auth methods offered by the Bulk Updater, Importer, and Traceability tools."""

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


def _auth_headers(auth: AuthFields) -> dict:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if auth.auth_type == "basic":
        token = base64.b64encode(f"{auth.username}:{auth.password}".encode()).decode()
        headers["Authorization"] = f"Basic {token}"
    else:
        headers["OrcanosAPIKey"] = auth.api_key
    return headers


# ── Models ────────────────────────────────────────────────────────────────────

class ProcessRowRequest(AuthFields):
    domain: str
    view_version: str
    object_id: str
    parent_id: str
    object_name: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(400, "No file selected")
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Please upload a valid CSV (.csv) file")

    file_bytes = await file.read()

    try:
        result = parse_parent_rows(file_bytes)
    except Exception as exc:
        raise HTTPException(400, f"Error processing file: {exc}")

    return result


@router.post("/process-row")
def process_row(req: ProcessRowRequest):
    headers = _auth_headers(req)
    success, message = update_parent(
        req.domain, headers, req.object_id, req.parent_id, req.object_name, req.view_version
    )
    return {"success": success, "message": message}
