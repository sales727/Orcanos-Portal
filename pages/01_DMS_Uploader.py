import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import streamlit as st
import pandas as pd

from tools.dms.orcanos_api import OrcanosAPI
from tools.dms.comparison import (
    load_files_from_upload,
    parse_orcanos_items,
    compare_with_orcanos,
    detect_naming_convention_from_names,
    parse_dms_filename,
)
from tools.dms.uploader import Uploader

st.set_page_config(
    page_title="DMS Uploader · Orcanos Tech Hub",
    page_icon="📄",
    layout="wide",
)

# ── Sidebar ────────────────────────────────────────────────────────────────────

with st.sidebar:
    st.markdown("## ⚙️ Settings")

    with st.expander("🔗 Connection", expanded=True):
        endpoint = st.text_input(
            "Orcanos Endpoint",
            key="endpoint",
            placeholder="https://app.orcanos.com/ACCOUNT/api/v2/Json",
        )
        auth_key = st.text_input("API Key", key="auth_key", type="password")

        if st.button("Test Connection", use_container_width=True):
            if endpoint and auth_key:
                with st.spinner("Testing…"):
                    try:
                        api = OrcanosAPI(endpoint, auth_key)
                        api.get_filter_results(
                            st.session_state.get("filter_id", 25),
                            st.session_state.get("version_id", 5),
                            page_size=1,
                        )
                        st.success("Connected ✓")
                    except Exception as e:
                        st.error(f"Failed: {e}")
            else:
                st.warning("Enter endpoint and API key first.")

    with st.expander("📁 Project Settings"):
        project_id = st.number_input("Project ID", key="project_id", value=78, min_value=1)
        filter_id = st.number_input("Filter ID", key="filter_id", value=25, min_value=1)
        version_id = st.number_input("Version ID", key="version_id", value=5, min_value=1)
        key_prefix = st.text_input("Key Prefix", key="key_prefix", value="DMS-")
        parent_id = st.text_input(
            "Parent ID (optional)",
            key="parent_id",
            value="",
            help="Leave blank to insert into project pool",
        )

    st.divider()
    st.page_link("app.py", label="← Back to Hub", icon="🔧")


# ── Page header ────────────────────────────────────────────────────────────────

st.title("📄 DMS Uploader")
st.caption("Upload and update DMS documents in Orcanos · compare, review, then upload")

st.divider()

# ── Step 1: Upload files ───────────────────────────────────────────────────────

st.subheader("1 · Upload Files")
st.markdown("Drop your PDF and DOCX files below. You can upload multiple files at once.")

uploaded_files = st.file_uploader(
    "DMS files",
    type=["pdf", "docx"],
    accept_multiple_files=True,
    label_visibility="collapsed",
)

if not uploaded_files:
    st.info("Upload PDF and DOCX files to get started.")
    st.stop()

# Auto-detect naming convention from filenames
filenames = [f.name for f in uploaded_files]
convention = detect_naming_convention_from_names(filenames)
detected_prefix = convention.get("key_prefix", "DMS-")

# Prefer user-set prefix from sidebar; fall back to auto-detected
active_prefix = st.session_state.get("key_prefix") or detected_prefix

# Parse all filenames to show a preview
parsed = [(f.name, parse_dms_filename(f.name, active_prefix)) for f in uploaded_files]
ok_files = [(n, d) for n, d in parsed if d]
bad_files = [(n, d) for n, d in parsed if not d]

col_a, col_b, col_c = st.columns(3)
col_a.metric("Files uploaded", len(uploaded_files))
col_b.metric("Parsed successfully", len(ok_files))
col_c.metric("Unrecognised", len(bad_files))

if bad_files:
    with st.expander(f"⚠ {len(bad_files)} file(s) couldn't be parsed — click to review"):
        for name, _ in bad_files:
            st.text(f"  • {name}")
        if detected_prefix != active_prefix:
            st.caption(
                f"Auto-detected prefix: **{detected_prefix or '(none)'}** · "
                f"Active prefix: **{active_prefix}**. Adjust Key Prefix in sidebar if needed."
            )

if not ok_files:
    st.error("No files matched the expected naming pattern. Check the Key Prefix in the sidebar.")
    st.stop()

st.divider()

# ── Step 2: Compare ────────────────────────────────────────────────────────────

st.subheader("2 · Compare with Orcanos")

if not endpoint or not auth_key:
    st.warning("Enter Orcanos endpoint and API key in the sidebar before comparing.")
    st.stop()

if st.button("▶  Compare with Orcanos", type="primary"):
    st.session_state.pop("comparison_results", None)
    st.session_state.pop("upload_log", None)

    with st.spinner("Fetching Orcanos items…"):
        try:
            api = OrcanosAPI(endpoint, auth_key)
            raw_items = api.get_all_items(
                int(st.session_state.get("filter_id", 25)),
                int(st.session_state.get("version_id", 5)),
            )
            orcanos_items = parse_orcanos_items(raw_items)
        except Exception as e:
            st.error(f"Failed to fetch Orcanos data: {e}")
            st.stop()

    with st.spinner("Comparing files…"):
        documents = load_files_from_upload(uploaded_files, active_prefix)
        results = compare_with_orcanos(documents, orcanos_items, active_prefix)
        st.session_state["comparison_results"] = results
        st.session_state["orcanos_count"] = len(orcanos_items)

if "comparison_results" not in st.session_state:
    st.stop()

results = st.session_state["comparison_results"]

# Summary counts
action_counts = {}
for r in results:
    action_counts[r.action] = action_counts.get(r.action, 0) + 1

m1, m2, m3, m4, m5 = st.columns(5)
m1.metric("Orcanos items", st.session_state.get("orcanos_count", "?"))
m2.metric("🟢 CREATE", action_counts.get("CREATE", 0))
m3.metric("🟡 UPDATE", action_counts.get("UPDATE", 0))
m4.metric("⚪ SAME", action_counts.get("SAME", 0))
m5.metric("🔴 HOLD", action_counts.get("HOLD", 0))

# Results table
ACTION_ICON = {"UPDATE": "🟡", "CREATE": "🟢", "SAME": "⚪", "HOLD": "🔴"}

rows = []
for r in results:
    rows.append({
        "Upload?": r.action in ("UPDATE", "CREATE"),
        "Action": f"{ACTION_ICON.get(r.action, '')} {r.action}",
        "DMS #": r.document.dms_number,
        "Title": r.document.title,
        "File Rev": f"{r.document.rev_letter or ''}{r.document.rev_change}",
        "Orcanos Rev": (
            f"{r.orcanos_item.revision}{r.orcanos_item.change_no}"
            if r.orcanos_item else "—"
        ),
        "Orcanos ID": str(r.orcanos_item.object_id) if r.orcanos_item else "—",
        "Note": r.reason,
    })

df = pd.DataFrame(rows)

edited_df = st.data_editor(
    df,
    column_config={
        "Upload?": st.column_config.CheckboxColumn("Upload?", width="small"),
        "Action": st.column_config.TextColumn("Action", width="small"),
        "DMS #": st.column_config.TextColumn("DMS #", width="small"),
        "File Rev": st.column_config.TextColumn("File Rev", width="small"),
        "Orcanos Rev": st.column_config.TextColumn("Orcanos Rev", width="small"),
        "Orcanos ID": st.column_config.TextColumn("Orcanos ID", width="small"),
        "Note": st.column_config.TextColumn("Note", width="large"),
    },
    disabled=["Action", "DMS #", "Title", "File Rev", "Orcanos Rev", "Orcanos ID", "Note"],
    use_container_width=True,
    hide_index=True,
)

selected_dms = set(
    edited_df[edited_df["Upload?"] == True]["DMS #"].tolist()
)

st.divider()

# ── Step 3: Upload ─────────────────────────────────────────────────────────────

st.subheader("3 · Upload")

to_upload = [
    r for r in results
    if r.document.dms_number in selected_dms and r.action in ("UPDATE", "CREATE")
]

if not to_upload:
    st.info("No items selected for upload. Check the 'Upload?' boxes in the table above.")
    st.stop()

n_update = sum(1 for r in to_upload if r.action == "UPDATE")
n_create = sum(1 for r in to_upload if r.action == "CREATE")
st.caption(
    f"Ready to upload **{len(to_upload)}** item(s) — "
    f"{n_update} update(s) · {n_create} new record(s)"
)

if st.button(f"⬆  Upload {len(to_upload)} item(s)", type="primary"):
    log_lines: list[str] = []

    def log_fn(msg: str):
        log_lines.append(msg)

    progress_bar = st.progress(0, text="Starting upload…")
    log_placeholder = st.empty()

    uploader = Uploader(
        api=OrcanosAPI(endpoint, auth_key, logger=log_fn),
        project_id=int(st.session_state.get("project_id", 78)),
        version_id=int(st.session_state.get("version_id", 5)),
        log_fn=log_fn,
        parent_id=st.session_state.get("parent_id", "") or "",
    )

    success_count = 0
    fail_count = 0

    for i, result in enumerate(to_upload):
        progress_bar.progress(
            (i + 1) / len(to_upload),
            text=f"Uploading {result.document.dms_number} ({i + 1}/{len(to_upload)})…",
        )

        if result.action == "UPDATE":
            ok = uploader.upload_update(result)
        else:
            ok = uploader.upload_new(result)

        if ok:
            success_count += 1
        else:
            fail_count += 1

        log_placeholder.code("\n".join(log_lines[-30:]), language=None)

    st.session_state["upload_log"] = log_lines
    progress_bar.empty()

    if fail_count == 0:
        st.success(f"Upload complete — {success_count} succeeded, {fail_count} failed.")
    else:
        st.warning(f"Upload finished — {success_count} succeeded, {fail_count} failed. See log below.")

if "upload_log" in st.session_state:
    with st.expander("📋 Full Upload Log"):
        st.code("\n".join(st.session_state["upload_log"]), language=None)
