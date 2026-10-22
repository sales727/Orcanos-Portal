import requests


def update_parent(
    domain: str,
    headers: dict,
    object_id: str,
    parent_id: str,
    object_name: str,
    view_version: str,
):
    """QW_Update_Object — sets Parent_ID on an existing work item."""
    url = f"https://{domain}/api/v2/Json/QW_Update_Object"
    payload = {
        "Object_ID": object_id,
        "View_Version": view_version,
        "Object_Name": object_name,
        "Parent_ID": parent_id,
    }

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
