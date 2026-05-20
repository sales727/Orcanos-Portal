const base = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface BulkUpdaterConfig {
  accountName: string;
  apiKey: string;
  filterId: number;
  projectId: number;
  itemType: string;
  descriptionMode: "template" | "html";
  templateId?: number;
  customHtml?: string;
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
      api_key: cfg.apiKey,
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

export async function updateItem(
  accountName: string,
  apiKey: string,
  itemId: string,
  projectId: number,
  descriptionHtml: string
): Promise<void> {
  const res = await fetch(`${base}/api/bulk-updater/update-item`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_name: accountName,
      api_key: apiKey,
      item_id: itemId,
      project_id: projectId,
      description_html: descriptionHtml,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Update failed");
  }
}
