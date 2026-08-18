const base = process.env.NEXT_PUBLIC_API_URL ?? "";

export type AuthType = "apikey" | "basic";
export type Action = "add" | "delete";
export type TargetKeyFormat = "custom" | "original";

export interface TraceabilityConfig {
  accountName: string;
  authType: AuthType;
  apiKey: string;
  username: string;
  password: string;
  action: Action;
  targetKeyFormat: TargetKeyFormat;
  prefixMap: string;
  sheetName: string;
  sourceCol: string;
  targetCol: string;
  relationCol: string;
}

export interface TraceabilityRow {
  row: number;
  sourceKey: string;
  targetKey: string;
  relationType: string;
  valid: boolean;
}

export interface UploadResult {
  sheetNames: string[];
  headers: string[];
  missingColumns: string[];
  rows: TraceabilityRow[];
  totalRows: number;
  validRows: number;
}

function authPayload(cfg: TraceabilityConfig) {
  return cfg.authType === "basic"
    ? { auth_type: "basic", username: cfg.username, password: cfg.password }
    : { auth_type: "apikey", api_key: cfg.apiKey };
}

export async function uploadTraceabilityFile(
  file: File,
  cfg: Pick<TraceabilityConfig, "sheetName" | "sourceCol" | "targetCol" | "relationCol">
): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("sheetName", cfg.sheetName);
  fd.append("sourceCol", cfg.sourceCol);
  fd.append("targetCol", cfg.targetCol);
  fd.append("relationCol", cfg.relationCol);

  const res = await fetch(`${base}/api/traceability/upload`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function processRelationRow(
  cfg: TraceabilityConfig,
  row: TraceabilityRow
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${base}/api/traceability/process-row`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_name: cfg.accountName,
      ...authPayload(cfg),
      action: cfg.action,
      source_key: row.sourceKey,
      target_key: row.targetKey,
      relation_type: row.relationType,
      target_key_format: cfg.targetKeyFormat,
      prefix_map: cfg.prefixMap,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = Array.isArray(err.detail) ? err.detail[0]?.msg : err.detail;
    throw new Error(detail || "Request failed");
  }
  return res.json();
}
