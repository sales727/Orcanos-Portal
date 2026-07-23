import math

import requests
from dateutil import parser as dateutil_parser


def serialize_value(obj):
    """Safe JSON serialization for NaN, None, infinite values."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
    return str(obj)


def _response_is_json(response):
    content_type = response.headers.get("Content-Type", "")
    return "application/json" in content_type.lower()


def parse_orcanos_json(response):
    """
    Parse an Orcanos API response body only when Content-Type is application/json.
    Returns (data, error_message). error_message is None on success.
    """
    text = response.text or ""
    if not text.strip():
        return None, "Server returned empty response. Please check your domain URL."
    if not _response_is_json(response):
        return None, (
            "Server returned unexpected response. Please check your domain URL is correct. "
            f"Received: {text[:200]}"
        )
    try:
        return response.json(), None
    except (ValueError, requests.exceptions.JSONDecodeError) as e:
        return None, f"Invalid JSON response: {str(e)}"


def validate_row(api_body, mandatory_fields=None):
    if mandatory_fields is None:
        mandatory_fields = []

    reasons = []

    for field in mandatory_fields:
        val = api_body.get(field)
        if val is None or (isinstance(val, str) and val.strip() == ""):
            reasons.append(f"{field} is required")

    obj_name = api_body.get("Object_Name")
    if obj_name is not None and isinstance(obj_name, str) and len(obj_name) > 255:
        reasons.append("Object_Name must not exceed 255 characters")

    desc = api_body.get("Description")
    if desc is not None and isinstance(desc, str) and desc.strip() == "":
        if "Description is required" not in reasons:
            reasons.append("Description must not be empty or just whitespace")

    for date_field in ["Due_date", "Start_Date", "Created_date"]:
        val = api_body.get(date_field)
        if val is not None and val != "":
            val_str = str(val).strip()
            if val_str:
                try:
                    dateutil_parser.parse(val_str)
                except (ValueError, TypeError):
                    reasons.append(f"{date_field} must be a valid date format")

    return reasons
