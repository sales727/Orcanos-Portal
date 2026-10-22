const base = process.env.NEXT_PUBLIC_API_URL ?? "";

export type AuthType = "apikey" | "basic";

export interface ParentUpdaterConfig {
  domain: string;
  authType: AuthType;
  apiKey: string;
  username: string;
  password: string;
  viewVersion: string;
}

export interface ParentRow {
  row: number;
  key: string;
  parentKey: string;
  name: string;
  objectId: string;
  parentId: string;
  valid: boolean;
}

export interface UploadResult {
  headers: string[];
  missingColumns: string[];
  rows: ParentRow[];
  totalRows: number;
  validRows: number;
}

function authPayload(cfg: ParentUpdaterConfig) {
  return cfg.authType === "basic"
    ? { auth_type: "basic", username: cfg.username, password: cfg.password }
    : { auth_type: "apikey", api_key: cfg.apiKey };
}

export async function uploadParentFile(file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${base}/api/parent-updater/upload`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function processParentRow(
  cfg: ParentUpdaterConfig,
  row: ParentRow
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${base}/api/parent-updater/process-row`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: cfg.domain,
      ...authPayload(cfg),
      view_version: cfg.viewVersion,
      object_id: row.objectId,
      parent_id: row.parentId,
      object_name: row.name,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = Array.isArray(err.detail) ? err.detail[0]?.msg : err.detail;
    throw new Error(detail || "Request failed");
  }
  return res.json();
}
