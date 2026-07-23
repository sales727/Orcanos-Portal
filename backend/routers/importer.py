import json
import uuid
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from tools.importer.excel import read_workbook_bytes
from tools.importer.helpers import parse_orcanos_json, serialize_value, validate_row
from tools.importer.jobs import import_jobs, import_jobs_lock
from tools.importer.mapping import build_api_body, custom_field_index, resolve_parts

router = APIRouter(prefix="/api/importer", tags=["importer"])

ALLOWED_EXTENSIONS = {"xlsx"}


def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ── Models ────────────────────────────────────────────────────────────────────

class VerifyAuthRequest(BaseModel):
    domain: str = ""
    headers: Dict[str, str] = {}


class GetItemFieldsRequest(BaseModel):
    item_type: str = ""
    project_id: Optional[int] = None
    major_version: Optional[int] = None
    minor_version: Optional[int] = None
    domain: Optional[str] = None
    headers: Optional[Dict[str, str]] = None


class ValidateImportRequest(BaseModel):
    data: List[Dict[str, Any]] = []
    mapping: Dict[str, Any] = {}
    mandatory_fields: List[str] = []
    projectConfig: Dict[str, Any] = {}
    orcanosFields: List[Dict[str, Any]] = []


class ImportRequest(BaseModel):
    data: List[Dict[str, Any]] = []
    mapping: Dict[str, Any] = {}
    domain: str = ""
    headers: Dict[str, str] = {}
    mandatory_fields: List[str] = []
    projectConfig: Dict[str, Any] = {}
    orcanosFields: List[Dict[str, Any]] = []
    stepsData: Optional[List[Dict[str, Any]]] = None
    stepsMapping: Optional[Dict[str, Any]] = None
    testCaseLinkColumn: Optional[str] = None
    stepsLinkColumn: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/verify-auth")
def verify_auth(req: VerifyAuthRequest):
    if not req.domain:
        return {"valid": False, "error": "Domain is required"}

    url = f"https://{req.domain}/api/v2/Json/QW_Login"
    try:
        response = requests.post(url, headers=req.headers, timeout=30)
    except requests.exceptions.Timeout:
        return {"valid": False, "error": "Connection timed out. Please check your domain and try again."}
    except requests.exceptions.RequestException:
        return {"valid": False, "error": "Cannot reach Orcanos. Please check your domain is correct."}

    if response.status_code in (401, 403):
        return {"valid": False, "error": "Access denied. Please check your credentials."}

    response_data, parse_error = parse_orcanos_json(response)
    if parse_error:
        return {"valid": False, "error": "Cannot reach Orcanos. Please check your domain is correct."}

    if response_data.get("IsSuccess"):
        projects = response_data.get("Data", {}).get("Projects", {}).get("Project", [])
        return {"valid": True, "projectsList": projects}

    return {"valid": False, "error": "Incorrect username or password. Please try again."}


@router.post("/get-item-fields")
def get_item_fields(payload: GetItemFieldsRequest, request: Request):
    domain = payload.domain
    if not domain:
        domain = request.headers.get("X-Orcanos-Domain") or request.headers.get("Domain")

    headers: Dict[str, str] = {}
    orcanos_api_key = request.headers.get("OrcanosAPIKey")
    authorization = request.headers.get("Authorization")

    if orcanos_api_key:
        headers["OrcanosAPIKey"] = orcanos_api_key
    if authorization:
        headers["Authorization"] = authorization

    payload_headers = payload.headers or {}
    for k, v in payload_headers.items():
        if k.lower() == "orcanosapikey" and not orcanos_api_key:
            headers["OrcanosAPIKey"] = v
        elif k.lower() == "authorization" and not authorization:
            headers["Authorization"] = v

    headers["Content-Type"] = "application/json"

    if not domain:
        raise HTTPException(400, "Domain is required")

    url = f"https://{domain}/api/v2/Json/QW_Get_Item_Add_Edit"
    orcanos_payload = {
        "Item_Type": payload.item_type,
        "Project_id": payload.project_id,
        "Major_Version": payload.major_version,
        "Minor_Version": payload.minor_version,
    }

    try:
        response = requests.post(url, json=orcanos_payload, headers=headers, timeout=30)
    except requests.exceptions.Timeout:
        raise HTTPException(400, "Connection timed out. Please check your domain.")
    except requests.exceptions.ConnectionError:
        raise HTTPException(400, "Could not connect to Orcanos. Please check your domain.")

    response_data, parse_error = parse_orcanos_json(response)
    if not parse_error:
        is_success = response_data.get("IsSuccess")
        http_code = response_data.get("HttpCode")
        has_fields = (
            isinstance(response_data.get("Data"), dict)
            and isinstance(response_data["Data"].get("field"), list)
            and len(response_data["Data"]["field"]) > 0
        )
        if is_success and http_code == 200 and has_fields:
            return response_data

    raise HTTPException(400, "No fields returned. Please check your Project ID, Item Type, and Version.")


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    mainSheet: str = Form(""),
    stepsSheet: str = Form(""),
):
    if not file.filename:
        raise HTTPException(400, "No file selected")
    if not _allowed_file(file.filename):
        raise HTTPException(400, "Please upload a valid Excel (.xlsx) file")

    file_bytes = await file.read()

    try:
        result = read_workbook_bytes(file_bytes, mainSheet.strip(), stepsSheet.strip())
    except Exception as exc:
        raise HTTPException(400, f"Error processing file: {str(exc)}")

    return json.loads(json.dumps(result, default=serialize_value))


@router.post("/validate-import")
def validate_import_route(payload: ValidateImportRequest):
    rows_result = []
    valid_count = 0
    invalid_count = 0

    for row_idx, row in enumerate(payload.data, 1):
        api_body, is_update = build_api_body(payload.mapping, row, payload.projectConfig, payload.orcanosFields)

        if is_update:
            reasons: List[str] = []
        else:
            reasons = validate_row(api_body, payload.mandatory_fields)
            field_name_to_title = {
                f["ws_add_col_name"].replace("_Name", "_value"): f.get("title", f.get("name", ""))
                for f in payload.orcanosFields
            }
            reasons = [
                next((r.replace(fname, title) for fname, title in field_name_to_title.items() if fname in r), r)
                for r in reasons
            ]

        is_valid = len(reasons) == 0
        if is_valid:
            valid_count += 1
        else:
            invalid_count += 1

        item_type_code = (payload.projectConfig.get("item_type") or "").upper()
        display_name = api_body.get("Synopsis", "") if item_type_code == "DEFECT" else api_body.get("Object_Name", "")
        row_number = row.get("_originalRowNumber") or row_idx

        rows_result.append({
            "row": row_number,
            "objectName": serialize_value(display_name) or "",
            "objectType": serialize_value(api_body.get("Object_Type", "")) or "",
            "valid": is_valid,
            "reasons": reasons,
        })

    return {
        "totalRows": len(payload.data),
        "validRows": valid_count,
        "invalidRows": invalid_count,
        "rows": rows_result,
    }


@router.post("/import/{job_id}/cancel")
def cancel_import(job_id: str):
    with import_jobs_lock:
        job = import_jobs.get(job_id)
        if not job:
            return {"ok": True, "processedRows": 0, "alreadyDone": True, "results": []}
        job["cancelled"] = True
        processed = job["processed_rows"]
        results_list = list(job["results"])
    return {"ok": True, "processedRows": processed, "results": results_list}


@router.post("/import")
def import_data(payload: ImportRequest):
    data = payload.data
    mapping = payload.mapping
    domain = payload.domain
    headers = payload.headers

    if not domain:
        raise HTTPException(400, "Domain is required")

    steps_data = payload.stepsData or []
    steps_mapping = payload.stepsMapping or {}
    tc_link_col = payload.testCaseLinkColumn or ""
    step_link_col = payload.stepsLinkColumn or ""
    has_steps_import = bool(steps_data and steps_mapping and tc_link_col and step_link_col)

    job_id = str(uuid.uuid4())
    with import_jobs_lock:
        import_jobs[job_id] = {
            "cancelled": False,
            "processed_rows": 0,
            "total_rows": len(data),
            "results": [],
        }

    def generate():
        added_count = 0
        updated_count = 0
        failed_count = 0
        skipped_count = 0

        yield json.dumps({"type": "started", "job_id": job_id}) + "\n"

        try:
            row_number = 0
            for row_idx, row in enumerate(data, 1):
                with import_jobs_lock:
                    if import_jobs[job_id]["cancelled"]:
                        break

                try:
                    api_body, is_update = build_api_body(mapping, row, payload.projectConfig, payload.orcanosFields)
                    item_type_code = (payload.projectConfig.get("item_type") or "").upper()

                    validation_errors = [] if is_update else validate_row(api_body, payload.mandatory_fields)

                    display_name = api_body.get("Synopsis", "") if item_type_code == "DEFECT" else api_body.get("Object_Name", "")
                    row_number = row.get("_originalRowNumber") or row_idx
                    result = {
                        "row": row_number,
                        "objectName": serialize_value(display_name),
                        "objectType": serialize_value(api_body.get("Object_Type", "")),
                        "status": "pending",
                        "objectId": 0,
                        "error": "",
                    }

                    if validation_errors:
                        result["status"] = "skipped"
                        result["error"] = f"Validation failed: {', '.join(validation_errors)}"
                        skipped_count += 1
                    else:
                        try:
                            if item_type_code == "DEFECT":
                                url = f"https://{domain}/api/v2/Json/QW_Update_Defect" if is_update else f"https://{domain}/api/v2/Json/QW_Add_Defect"
                            elif is_update:
                                url = f"https://{domain}/api/v2/Json/QW_Update_Object"
                            else:
                                url = f"https://{domain}/api/v2/Json/QW_Add_Object"

                            response = requests.post(url, json=api_body, headers=headers, timeout=30)

                            if response.status_code == 200:
                                response_data, parse_error = parse_orcanos_json(response)
                                if parse_error:
                                    result["status"] = "failed"
                                    result["error"] = parse_error
                                    failed_count += 1
                                else:
                                    object_id = response_data.get("Data", 0)
                                    fallback_msg = "Object was not updated." if is_update else "Object was not created."

                                    if isinstance(object_id, dict):
                                        error_info = object_id.get("ErrorInfo", "") or ""
                                        if "There is no row at position 0." in error_info:
                                            error_info = "object does not exist"
                                        result["status"] = "failed"
                                        result["error"] = error_info if error_info else fallback_msg
                                        failed_count += 1
                                    elif object_id and isinstance(object_id, (int, float)) and int(object_id) > 0:
                                        result["status"] = "updated" if is_update else "added"
                                        result["objectId"] = int(object_id)
                                        if is_update:
                                            updated_count += 1
                                        else:
                                            added_count += 1

                                        if has_steps_import:
                                            resolved_tc_key = str(row.get(tc_link_col, "")).strip()
                                            matching_steps = [
                                                s for s in steps_data
                                                if str(s.get(step_link_col, "")).strip() == resolved_tc_key
                                            ]
                                            steps_total = len(matching_steps)
                                            steps_added = 0
                                            steps_failed = 0

                                            for step_row in matching_steps:
                                                step_body = {
                                                    "ItemId": int(object_id),
                                                    "ObjectType": "DEFECT" if item_type_code == "DEFECT" else "OBJECT",
                                                    "StepNumber": resolve_parts(steps_mapping.get("StepNumber"), step_row).strip(),
                                                    "Description": resolve_parts(steps_mapping.get("Description"), step_row).strip(),
                                                    "ExpectedValue": resolve_parts(steps_mapping.get("ExpectedValue"), step_row).strip(),
                                                    "LowerLimit": resolve_parts(steps_mapping.get("LowerLimit"), step_row).strip(),
                                                    "UpperLimit": resolve_parts(steps_mapping.get("UpperLimit"), step_row).strip(),
                                                }
                                                try:
                                                    step_url = f"https://{domain}/api/v2/Json/AddStep"
                                                    step_resp = requests.post(step_url, json=step_body, headers=headers, timeout=30)
                                                    if step_resp.status_code == 200:
                                                        step_data, step_err = parse_orcanos_json(step_resp)
                                                        if step_err or not step_data or not step_data.get("IsSuccess"):
                                                            steps_failed += 1
                                                        else:
                                                            steps_added += 1
                                                    else:
                                                        steps_failed += 1
                                                except Exception:
                                                    steps_failed += 1

                                            result["stepsTotal"] = steps_total
                                            result["stepsAdded"] = steps_added
                                            result["stepsFailed"] = steps_failed
                                    else:
                                        msg = response_data.get("Message", "") or ""
                                        if "There is no row at position 0." in msg:
                                            msg = "object does not exist"
                                        result["status"] = "failed"
                                        result["error"] = msg if msg else fallback_msg
                                        failed_count += 1
                            else:
                                result["status"] = "failed"
                                result["error"] = f"API error: {response.status_code} - {response.text[:200]}"
                                failed_count += 1
                        except requests.exceptions.Timeout:
                            result["status"] = "failed"
                            result["error"] = "Request timeout - API server not responding"
                            failed_count += 1
                        except requests.exceptions.RequestException as e:
                            result["status"] = "failed"
                            result["error"] = f"Network error: {str(e)}"
                            failed_count += 1
                        except Exception as e:
                            result["status"] = "failed"
                            result["error"] = str(e)
                            failed_count += 1

                except Exception as e:
                    row_number = row.get("_originalRowNumber") or row_idx
                    result = {
                        "row": row_number,
                        "objectName": "",
                        "objectType": "",
                        "status": "failed",
                        "objectId": 0,
                        "error": f"Error processing row: {str(e)}",
                    }
                    failed_count += 1

                with import_jobs_lock:
                    import_jobs[job_id]["processed_rows"] = row_idx
                    if job_id in import_jobs:
                        import_jobs[job_id]["results"].append(result)

                yield json.dumps({
                    "type": "progress",
                    "row": row_number,
                    "total": len(data),
                }, default=serialize_value) + "\n"

            with import_jobs_lock:
                was_cancelled = import_jobs[job_id]["cancelled"]
                processed_rows = import_jobs[job_id]["processed_rows"]

            results = list(import_jobs[job_id]["results"]) if job_id in import_jobs else []

            if was_cancelled:
                remaining_count = len(data) - processed_rows
                skipped_count += remaining_count

                item_type_code = (payload.projectConfig.get("item_type") or "").upper()
                target_field = "Synopsis" if item_type_code == "DEFECT" else "Object_Name"

                for rem_idx in range(processed_rows + 1, len(data) + 1):
                    rem_row = data[rem_idx - 1]
                    resolved_name = resolve_parts(mapping.get(target_field), rem_row)
                    row_number = rem_row.get("_originalRowNumber") or rem_idx
                    skipped_result = {
                        "row": row_number,
                        "objectName": serialize_value(resolved_name),
                        "objectType": serialize_value(payload.projectConfig.get("object_type_label", payload.projectConfig.get("item_type", ""))),
                        "status": "skipped",
                        "objectId": 0,
                        "error": "Cancelled before import",
                    }
                    results.append(skipped_result)
                    with import_jobs_lock:
                        if job_id in import_jobs:
                            import_jobs[job_id]["results"].append(skipped_result)

            summary = {
                "total": len(data),
                "success": added_count + updated_count,
                "added": added_count,
                "updated": updated_count,
                "failed": failed_count,
                "skipped": skipped_count,
            }

            if was_cancelled:
                yield json.dumps({
                    "type": "cancelled",
                    "processedRows": processed_rows,
                    "totalRows": len(data),
                    "results": results,
                    "summary": summary,
                }, default=serialize_value) + "\n"
            else:
                yield json.dumps({
                    "type": "done",
                    "results": results,
                    "summary": summary,
                }, default=serialize_value) + "\n"

        finally:
            with import_jobs_lock:
                import_jobs.pop(job_id, None)

    return StreamingResponse(generate(), media_type="application/x-ndjson")
