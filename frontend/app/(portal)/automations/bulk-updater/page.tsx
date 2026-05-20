"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  fetchPreview,
  updateItem,
  type BulkUpdaterConfig,
  type PreviewItem,
} from "@/lib/bulk-updater";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "form" | "preview" | "running" | "done";

type ItemStatus = "pending" | "in-progress" | "success" | "error" | "frozen";

interface ProgressItem {
  id: string;
  name: string;
  status: ItemStatus;
  error: string | null;
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: "Pending",
  "in-progress": "⟳ In progress",
  success: "✓ Done",
  error: "✕ Error",
  frozen: "❄ Frozen",
};

const INITIAL_CONFIG: BulkUpdaterConfig = {
  accountName: "",
  apiKey: "",
  filterId: 0,
  projectId: 0,
  itemType: "",
  descriptionMode: "template",
  templateId: undefined,
  customHtml: "",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BulkUpdaterPage() {
  const [config, setConfig] = useState<BulkUpdaterConfig>(INITIAL_CONFIG);
  const [phase, setPhase] = useState<Phase>("form");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key: keyof BulkUpdaterConfig) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value =
        e.target.type === "number" ? (e.target.value === "" ? 0 : +e.target.value) : e.target.value;
      setConfig((prev) => ({ ...prev, [key]: value }));
    };

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setLoading(true);
    try {
      const result = await fetchPreview(config);
      setDescriptionHtml(result.descriptionHtml);
      setPreviewItems(result.items);
      setSelectedIds(new Set(result.items.filter((i) => !i.frozen).map((i) => i.id)));
      setPhase("preview");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleStartUpdate() {
    const toUpdate = previewItems.filter((i) => selectedIds.has(i.id));
    if (toUpdate.length === 0) return;

    const rows: ProgressItem[] = toUpdate.map((i) => ({
      id: i.id,
      name: i.name,
      status: "pending",
      error: null,
    }));

    setProgressItems(rows);
    setPhase("running");

    for (let i = 0; i < rows.length; i++) {
      setProgressItems((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "in-progress" } : r))
      );
      try {
        await updateItem(
          config.accountName,
          config.apiKey,
          rows[i].id,
          config.projectId,
          descriptionHtml
        );
        setProgressItems((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "success" } : r))
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const isFrozen = /frozen|freeze|lock/i.test(msg);
        setProgressItems((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: isFrozen ? "frozen" : "error", error: isFrozen ? null : msg }
              : r
          )
        );
      }
    }
    setPhase("done");
  }

  function handleReset() {
    setPhase("form");
    setConfig(INITIAL_CONFIG);
    setDescriptionHtml("");
    setPreviewItems([]);
    setSelectedIds(new Set());
    setProgressItems([]);
    setFormError("");
  }

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 16px 60px" }}>
      <Link
        href="/automations"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13,
          color: "var(--purple)", textDecoration: "none", marginBottom: 16 }}
      >
        ← Back to Automations
      </Link>

      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--purple)", marginBottom: 4 }}>
        Description Mass Update
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Apply a description to all items returned by a saved Orcanos filter — in bulk, in one click.
      </p>

      {(phase === "form" || phase === "preview") && (
        <div className="card">
          <div className="card-title">Configuration</div>
          <div className="card-subtitle">Enter your Orcanos credentials and filter details</div>

          <div className="info-box">
            <strong>What this tool does:</strong> Applies a Description to all items returned by a
            saved filter — in bulk, in one click. The description can come from an existing template
            work item, or you can paste your own HTML directly.
            <ol className="info-steps">
              <li>Fill in your account credentials and choose a project, filter, and item type.</li>
              <li>
                Under <em>Description Source</em>, either enter a Template Work Item ID or switch to{" "}
                <em>Paste HTML</em> and insert your own HTML description.
              </li>
              <li>
                Click <em>Preview Description</em> to see the description that will be applied and
                the list of affected items.
              </li>
              <li>Select the items you want to update, then click <em>Confirm Update</em> to apply.</li>
            </ol>
          </div>

          {formError && <div className="error-banner">{formError}</div>}

          <form className="config-form" onSubmit={handlePreview}>
            {/* Account name */}
            <div className="form-row">
              <label htmlFor="accountName">Account Name</label>
              <div className="url-input-group">
                <span className="url-prefix">https://app.orcanos.com/</span>
                <input
                  id="accountName"
                  type="text"
                  placeholder="mycompany"
                  value={config.accountName}
                  onChange={set("accountName")}
                  required
                />
              </div>
            </div>

            {/* API Key */}
            <div className="form-row">
              <label htmlFor="apiKey">API Key</label>
              <input
                id="apiKey"
                type="password"
                placeholder="Your Orcanos API key"
                value={config.apiKey}
                onChange={set("apiKey")}
                required
              />
            </div>

            {/* Project ID */}
            <div className="form-row">
              <label htmlFor="projectId">Project ID</label>
              <input
                id="projectId"
                type="number"
                placeholder="123"
                value={config.projectId || ""}
                onChange={set("projectId")}
                required
              />
            </div>

            {/* Filter ID */}
            <div className="form-row">
              <label htmlFor="filterId">Filter ID</label>
              <input
                id="filterId"
                type="number"
                placeholder="456"
                value={config.filterId || ""}
                onChange={set("filterId")}
                required
              />
            </div>

            {/* Item Type */}
            <div className="form-row">
              <label htmlFor="itemType">Item Type</label>
              <input
                id="itemType"
                type="text"
                placeholder="Requirement"
                value={config.itemType}
                onChange={set("itemType")}
                required
              />
            </div>

            {/* Description source toggle */}
            <div className="form-row form-row--top">
              <label>Description Source</label>
              <div className="source-options">
                <label className="source-option">
                  <input
                    type="radio"
                    name="descriptionMode"
                    value="template"
                    checked={config.descriptionMode === "template"}
                    onChange={() => setConfig((p) => ({ ...p, descriptionMode: "template" }))}
                  />
                  Template Work Item
                </label>
                <label className="source-option">
                  <input
                    type="radio"
                    name="descriptionMode"
                    value="html"
                    checked={config.descriptionMode === "html"}
                    onChange={() => setConfig((p) => ({ ...p, descriptionMode: "html" }))}
                  />
                  Paste HTML
                </label>
              </div>
            </div>

            {/* Conditional: template ID or HTML textarea */}
            {config.descriptionMode === "template" ? (
              <div className="form-row">
                <label htmlFor="templateId">Template Work Item ID</label>
                <input
                  id="templateId"
                  type="number"
                  placeholder="789"
                  value={config.templateId || ""}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, templateId: e.target.value ? +e.target.value : undefined }))
                  }
                  required
                />
              </div>
            ) : (
              <div className="form-row form-row--top">
                <label htmlFor="customHtml">HTML Description</label>
                <textarea
                  id="customHtml"
                  className="html-textarea"
                  placeholder="Paste your HTML description here…"
                  value={config.customHtml}
                  onChange={set("customHtml")}
                  required
                  spellCheck={false}
                />
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Fetching…" : "Preview Description"}
              </button>
            </div>
          </form>
        </div>
      )}

      {phase === "preview" && (
        <PreviewSection
          html={descriptionHtml}
          items={previewItems}
          selectedIds={selectedIds}
          onToggle={(id) =>
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            })
          }
          onSelectAll={(checked) =>
            setSelectedIds(
              checked
                ? new Set(previewItems.filter((i) => !i.frozen).map((i) => i.id))
                : new Set()
            )
          }
          onConfirm={handleStartUpdate}
          onBack={() => setPhase("form")}
        />
      )}

      {(phase === "running" || phase === "done") && (
        <ProgressSection items={progressItems} done={phase === "done"} onReset={handleReset} />
      )}
    </div>
  );
}

// ── PreviewSection ─────────────────────────────────────────────────────────────

function PreviewSection({
  html,
  items,
  selectedIds,
  onToggle,
  onSelectAll,
  onConfirm,
  onBack,
}: {
  html: string;
  items: PreviewItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const updatable = items.filter((i) => !i.frozen);
  const frozenCount = items.length - updatable.length;
  const allSelected = updatable.length > 0 && selectedIds.size === updatable.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < updatable.length;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <div className="card">
      <div className="preview-section">
        <h2>Template Description Preview</h2>
        <p className="card-subtitle">Review the description that will be copied to the selected items</p>
        <div className="preview-html" dangerouslySetInnerHTML={{ __html: html }} />

        <div className="item-select-header">
          <span className="item-select-title">Items to update</span>
          <span className="item-select-count">
            {selectedIds.size} of {updatable.length} selected
            {frozenCount > 0 && (
              <>
                {" · "}
                <span className="frozen-count">{frozenCount} frozen</span>
              </>
            )}
          </span>
        </div>

        <div className="item-select-list">
          <div className="item-select-row item-select-row--header">
            <label className="item-checkbox-label">
              <input
                type="checkbox"
                ref={selectAllRef}
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
              <span className="item-col-id">ID</span>
              <span className="item-col-name">Name</span>
            </label>
          </div>
          {items.length === 0 && (
            <div className="item-select-empty">No items found in filter</div>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className={`item-select-row${item.frozen ? " item-select-row--frozen" : ""}`}
            >
              <label className="item-checkbox-label">
                <input
                  type="checkbox"
                  checked={!item.frozen && selectedIds.has(item.id)}
                  disabled={item.frozen}
                  onChange={() => onToggle(item.id)}
                />
                <span className="item-col-id item-id">#{item.id}</span>
                <span className="item-col-name item-name">{item.name}</span>
                {item.frozen && <span className="badge badge-frozen">Frozen</span>}
              </label>
            </div>
          ))}
        </div>

        <div className="preview-actions">
          <button className="btn-secondary" onClick={onBack}>← Back</button>
          <button
            className="btn-primary"
            onClick={onConfirm}
            disabled={selectedIds.size === 0}
          >
            Update {selectedIds.size} item{selectedIds.size === 1 ? "" : "s"} ▶
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProgressSection ────────────────────────────────────────────────────────────

const TERMINAL: ItemStatus[] = ["success", "error", "frozen"];

function ProgressSection({
  items,
  done,
  onReset,
}: {
  items: ProgressItem[];
  done: boolean;
  onReset: () => void;
}) {
  const succeeded = items.filter((i) => i.status === "success").length;
  const failed = items.filter((i) => i.status === "error").length;
  const frozen = items.filter((i) => i.status === "frozen").length;

  const summaryParts = [
    succeeded > 0 && `${succeeded} updated`,
    failed > 0 && `${failed} failed`,
    frozen > 0 && `${frozen} frozen`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="card">
      <div className="progress-section">
        <h2>
          {done
            ? `Finished — ${summaryParts}`
            : `Updating ${items.length} item${items.length !== 1 ? "s" : ""}…`}
        </h2>
        {!done && items.every((i) => i.status === "pending") && items.length > 0 && (
          <p className="status-hint">Preparing…</p>
        )}
        <div className="progress-table-wrap">
          <table className="progress-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td title={item.error || ""}>{item.name}</td>
                  <td>
                    <span className={`badge badge-${item.status}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    {item.error && <span className="error-msg"> — {item.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {done && (
          <div className="summary-actions">
            <span className="summary-text">{summaryParts}</span>
            <button className="btn-secondary" onClick={onReset}>Reset</button>
          </div>
        )}
      </div>
    </div>
  );
}
