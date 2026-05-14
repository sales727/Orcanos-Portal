export interface CompareForm {
  account: string;
  auth_key: string;
  project_id: number;
  filter_id: number;
  version_id: number;
  parent_id: string;
  mode: "compare" | "scratch";
}

export interface ComparisonRow {
  dms_number: string;
  original_dms: string;   // immutable — original DMS number from filename
  title: string;
  file_rev: string;
  orcanos_rev: string;
  orcanos_key: string;
  orcanos_id: string;
  action: "UPDATE" | "CREATE" | "SAME" | "HOLD";
  reason: string;
  file_types: string;
  suspicious: boolean;
  selected: boolean;
}

export async function compareFiles(
  files: File[],
  form: CompareForm
): Promise<ComparisonRow[]> {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  fd.append("account", form.account);
  fd.append("auth_key", form.auth_key);
  fd.append("project_id", String(form.project_id));
  fd.append("filter_id", String(form.filter_id));
  fd.append("version_id", String(form.version_id));
  fd.append("mode", form.mode);

  const base = process.env.NEXT_PUBLIC_API_URL ?? "";
  const res = await fetch(`${base}/api/dms/compare`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Compare failed");
  }
  const data: Omit<ComparisonRow, "selected" | "original_dms">[] = await res.json();
  return data.map((r) => ({
    ...r,
    original_dms: r.dms_number,
    selected: (r.action === "UPDATE" || r.action === "CREATE") && !r.suspicious,
  }));
}

export async function uploadFiles(
  files: File[],
  form: CompareForm,
  selectedRows: ComparisonRow[]
): Promise<{ success: number; failed: number; log: string[] }> {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  fd.append("account", form.account);
  fd.append("auth_key", form.auth_key);
  fd.append("project_id", String(form.project_id));
  fd.append("filter_id", String(form.filter_id));
  fd.append("version_id", String(form.version_id));
  fd.append("parent_id", form.parent_id);
  fd.append("mode", form.mode);
  fd.append("selected_dms", JSON.stringify(selectedRows.map((r) => r.original_dms)));
  fd.append("overrides", JSON.stringify(selectedRows.map((r) => ({
    original_dms: r.original_dms,
    name: r.title,
    dms_number: r.dms_number,
    file_rev: r.file_rev,
  }))));

  const base = process.env.NEXT_PUBLIC_API_URL ?? "";
  const res = await fetch(`${base}/api/dms/upload`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}
