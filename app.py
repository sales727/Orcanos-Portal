import streamlit as st

st.set_page_config(
    page_title="Orcanos Tech Hub",
    page_icon="🔧",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.title("🔧 Orcanos Tech Hub")
st.caption("Internal AI tools for Orcanos technicians · support · professional services")

st.divider()

# ── Tool catalog ──────────────────────────────────────────────────────────────

col1, col2, col3 = st.columns(3)

with col1:
    with st.container(border=True):
        st.markdown("### 📄 DMS Uploader")
        st.markdown(
            "Compare a Google Drive folder against live Orcanos DMS data, "
            "then batch-upload new revisions or create new records."
        )
        st.markdown("**Workflows:** Update · Create · Folder structure")
        st.page_link("pages/01_DMS_Uploader.py", label="Open DMS Uploader →", icon="📄")

with col2:
    with st.container(border=True):
        st.markdown("### 🔍 Work Item Inspector")
        st.markdown(
            "Retrieve any Orcanos work item by ID and get a structured summary "
            "with diagnostic flags, field values, and suspicious gaps."
        )
        st.markdown("**Status:** Coming soon")
        st.button("Coming Soon", key="wii", disabled=True, use_container_width=True)

with col3:
    with st.container(border=True):
        st.markdown("### 📞 SC Summarizer")
        st.markdown(
            "Convert a raw Service Call discussion into a structured technical "
            "summary with classification and customer-facing response."
        )
        st.markdown("**Status:** Coming soon")
        st.button("Coming Soon", key="sc", disabled=True, use_container_width=True)

st.divider()

col4, col5, col6 = st.columns(3)

with col4:
    with st.container(border=True):
        st.markdown("### 🔑 Permission Checker")
        st.markdown("Diagnose user access issues — group membership, project access, routing notifications.")
        st.markdown("**Status:** Coming soon")
        st.button("Coming Soon", key="perm", disabled=True, use_container_width=True)

with col5:
    with st.container(border=True):
        st.markdown("### 🔌 API Call Analyzer")
        st.markdown("Paste a failed Orcanos API call and get root-cause analysis plus a corrected payload.")
        st.markdown("**Status:** Coming soon")
        st.button("Coming Soon", key="api", disabled=True, use_container_width=True)

with col6:
    with st.container(border=True):
        st.markdown("### 📊 Filter Assistant")
        st.markdown("Debug filters, embedded filters, and dashboards — scope, version context, and conditions.")
        st.markdown("**Status:** Coming soon")
        st.button("Coming Soon", key="filter", disabled=True, use_container_width=True)
