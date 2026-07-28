const base = process.env.NEXT_PUBLIC_API_URL ?? "";

export type AuthType = "apikey" | "basic";

export interface BulkUpdaterConfig {
  accountName: string;
  authType: AuthType;
  apiKey: string;
  username: string;
  password: string;
  filterId: number;
  projectId: number;
  itemType: string;
  descriptionMode: "template" | "html";
  templateId?: number;
  customHtml?: string;
}

function authPayload(cfg: BulkUpdaterConfig) {
  return cfg.authType === "basic"
    ? { auth_type: "basic", username: cfg.username, password: cfg.password }
    : { auth_type: "apikey", api_key: cfg.apiKey };
}

export interface PreviewItem {
  id: string;
  name: string;
  frozen: boolean;
}

export interface PreviewResult {
  descriptionHtml: string;
  items: PreviewItem[];
}

export async function fetchPreview(cfg: BulkUpdaterConfig): Promise<PreviewResult> {
  const res = await fetch(`${base}/api/bulk-updater/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_name: cfg.accountName,
      ...authPayload(cfg),
      filter_id: cfg.filterId,
      project_id: cfg.projectId,
      item_type: cfg.itemType,
      description_mode: cfg.descriptionMode,
      template_id: cfg.templateId ?? null,
      custom_html: cfg.customHtml ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Preview failed");
  }
  const data = await res.json();
  return {
    descriptionHtml: data.description_html,
    items: data.items,
  };
}

export async function updateItem(cfg: BulkUpdaterConfig, itemId: string, descriptionHtml: string): Promise<void> {
  const res = await fetch(`${base}/api/bulk-updater/update-item`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_name: cfg.accountName,
      ...authPayload(cfg),
      item_id: itemId,
      project_id: cfg.projectId,
      description_html: descriptionHtml,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Update failed");
  }
}
