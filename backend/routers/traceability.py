import base64
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, model_validator

from tools.traceability.excel import parse_traceability_rows
from tools.traceability.orcanos import add_relation, delete_relation, parse_prefix_map

router = APIRouter(prefix="/api/traceability", tags=["traceability"])

ALLOWED_EXTENSIONS = {"xlsx"}


def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


class AuthFields(BaseModel):
    """Same two auth methods offered by the Bulk Updater and Importer tools."""

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
    account_name: str
    action: str  # "add" | "delete"
    source_key: str
    target_key: str
    relation_type: Optional[str] = None
    target_key_format: str = "custom"  # "custom" | "original" — delete only
    prefix_map: str = ""  # e.g. "BR:MR_REQ,UR:REQ" — delete + original format only


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    sheetName: str = Form(""),
    sourceCol: str = Form("Source Key"),
    targetCol: str = Form("Target Key"),
    relationCol: str = Form("Relation Type"),
):
    if not file.filename:
        raise HTTPException(400, "No file selected")
    if not _allowed_file(file.filename):
        raise HTTPException(400, "Please upload a valid Excel (.xlsx) file")

    file_bytes = await file.read()

    try:
        result = parse_traceability_rows(
            file_bytes,
            sheetName.strip(),
            sourceCol.strip(),
            targetCol.strip(),
            relationCol.strip(),
        )
    except Exception as exc:
        raise HTTPException(400, f"Error processing file: {exc}")

    return result


@router.post("/process-row")
def process_row(req: ProcessRowRequest):
    headers = _auth_headers(req)

    if req.action == "add":
        if not req.relation_type:
            raise HTTPException(400, "relation_type is required for the add action")
        success, message = add_relation(req.account_name, headers, req.source_key, req.target_key, req.relation_type)
    elif req.action == "delete":
        prefix_map = parse_prefix_map(req.prefix_map)
        success, message = delete_relation(
            req.account_name, headers, req.source_key, req.target_key, req.target_key_format, prefix_map
        )
    else:
        raise HTTPException(400, "action must be 'add' or 'delete'")

    return {"success": success, "message": message}
