import requests


def _url(account_name: str, path: str) -> str:
    return f"https://app.orcanos.com/{account_name}{path}"


def parse_prefix_map(raw: str) -> dict:
    """Parse a "BR:MR_REQ,UR:REQ" style string into {"BR": "MR_REQ", "UR": "REQ"}."""
    mapping = {}
    for pair in (raw or "").split(","):
        pair = pair.strip()
        if not pair or ":" not in pair:
            continue
        old, new = pair.split(":", 1)
        old, new = old.strip(), new.strip()
        if old and new:
            mapping[old] = new
    return mapping


def convert_key_prefix(key: str, prefix_map: dict) -> str:
    prefix, sep, number = key.partition("-")
    if sep and prefix in prefix_map:
        return f"{prefix_map[prefix]}-{number}"
    return key


def add_relation(account_name: str, headers: dict, source_key: str, target_key: str, relation_type: str):
    """QW_Add_Relations_Custom_Code — expects each item's custom code."""
    url = _url(account_name, "/api/v2/Json/QW_Add_Relations_Custom_Code")
    payload = {
        "SourceIdKeys": source_key,
        "TargetIdKeys": target_key,
        "RelationType": relation_type,
    }
    return _post(url, payload, headers)


def delete_relation(
    account_name: str,
    headers: dict,
    source_key: str,
    target_key: str,
    target_key_format: str,
    prefix_map: dict,
):
    """Delete a traceability relation.

    - target_key_format == "custom": QW_Delete_Relation_Custom_Code, keys sent as-is.
    - target_key_format == "original": QW_Delete_Relation, with target_key's prefix
      converted via prefix_map (e.g. BR -> MR_REQ) since that endpoint expects the
      item's original code, not its custom code.
    """
    if target_key_format == "original":
        url = _url(account_name, "/api/v2/Json/QW_Delete_Relation")
        converted_target = convert_key_prefix(target_key, prefix_map)
        payload = {"Source_Key": source_key, "Target_Key": converted_target}
    else:
        url = _url(account_name, "/api/v2/Json/QW_Delete_Relation_Custom_Code")
        payload = {"Source_Key": source_key, "Target_Key": target_key}

    return _post(url, payload, headers)


def _post(url: str, payload: dict, headers: dict):
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        result = response.json()
    except requests.exceptions.RequestException as exc:
        return False, f"Error making API call: {exc}"
    except ValueError as exc:
        return False, f"Error decoding JSON response: {exc}"

    if result.get("IsSuccess") is True:
        return True, "Success"

    data = result.get("Data")
    if isinstance(data, dict) and data.get("ErrorInfo"):
        return False, data["ErrorInfo"]
    return False, result.get("Message") or "Unknown error"
