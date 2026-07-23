def resolve_parts(parts, row):
    """Resolve a mapping parts list (list of {type, value}) against a data row."""
    resolved = ""
    for part in parts or []:
        if not isinstance(part, dict):
            continue
        if part.get("type") == "column":
            cell_val = row.get(part.get("value"))
            if cell_val is not None:
                resolved += str(cell_val)
        elif part.get("type") == "text":
            if part.get("value") is not None:
                resolved += str(part.get("value"))
    return resolved


def custom_field_index(orcanos_fields):
    """Map ws_add_col_name (as '..._value') -> 1-based CS slot index, for CS custom fields."""
    custom_fields = [
        f
        for f in orcanos_fields
        if isinstance(f.get("name"), str) and f["name"].startswith("CS") and f["name"][2:].isdigit()
    ]
    index = {
        f["ws_add_col_name"].replace("_Name", "_value"): idx + 1
        for idx, f in enumerate(custom_fields)
    }
    return custom_fields, index


def build_api_body(mapping, row, project_config, orcanos_fields):
    """
    Resolve every mapped field against a data row and build the Orcanos API request
    body. Shared by both /validate-import and /import so the two endpoints can never
    drift apart on how a row is turned into an API call.

    Returns (api_body, is_update).
    """
    resolved_mapping = {}
    for orcanos_field, parts in mapping.items():
        if not isinstance(parts, list) or len(parts) == 0:
            continue
        resolved_mapping[orcanos_field] = resolve_parts(parts, row)

    object_id_val = resolved_mapping.get("Object_ID", "").strip()
    is_update = bool(object_id_val)

    custom_fields, cf_index = custom_field_index(orcanos_fields)

    api_body = {}
    api_body["Project_ID"] = int(project_config.get("project_id", 0))
    api_body["Major_Version"] = int(project_config.get("major_version", 0))
    api_body["Minor_Version"] = int(project_config.get("minor_version", 0))
    api_body["Object_Type"] = project_config.get("object_type_label", project_config.get("item_type", ""))

    for orcanos_field, resolved_value in resolved_mapping.items():
        if not resolved_value.strip():
            continue

        if orcanos_field in cf_index:
            n = cf_index[orcanos_field]
            field_title = next(
                (f.get("title", "") for f in custom_fields if f["ws_add_col_name"].replace("_Name", "_value") == orcanos_field),
                "",
            )
            api_body[f"CS{n}_Name"] = field_title
            api_body[f"CS{n}_value"] = resolved_value
        else:
            api_body[orcanos_field] = resolved_value

    if is_update:
        try:
            api_body["Object_ID"] = int(float(object_id_val))
        except ValueError:
            api_body["Object_ID"] = object_id_val

    if not api_body.get("Parent_ID"):
        api_body["Parent_ID"] = str(api_body["Project_ID"])

    item_type_code = (project_config.get("item_type") or "").upper()
    if item_type_code == "DEFECT":
        api_body["Project_Name"] = project_config.get("raw_project_name") or project_config.get("project_name", "")
    if is_update and item_type_code in ("T_CASE", "DEFECT"):
        api_body.pop("Release_Version", None)

    return api_body, is_update
