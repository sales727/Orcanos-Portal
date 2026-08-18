"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  uploadTraceabilityFile,
  processRelationRow,
  type TraceabilityConfig,
  type TraceabilityRow,
  type UploadResult,
} from "@/lib/traceability";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "form" | "preview" | "running" | "done";
type RowStatus = "pending" | "in-progress" | "success" | "error" | "skipped";

interface ProgressRow extends TraceabilityRow {
  status: RowStatus;
  message: string;
}

const STATUS_LABEL: Record<RowStatus, string> = {
  pending: "Pending",
  "in-progress": "⟳ In progress",
  success: "✓ Done",
  error: "✕ Error",
  skipped: "– Skipped",
};

const INITIAL_CONFIG: TraceabilityConfig = {
  accountName: "",
  authType: "apikey",
  apiKey: "",
  username: "",
  password: "",
  action: "add",
  targetKeyFormat: "custom",
  prefixMap: "BR:MR_REQ,UR:REQ",
  sheetName: "Traceability",
  sourceCol: "Source Key",
  targetCol: "Target Key",
  relationCol: "Relation Type",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TraceabilityPage() {
  const [config, setConfig] = useState<TraceabilityConfig>(INITIAL_CONFIG);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof TraceabilityConfig) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setConfig((prev) => ({ ...prev, [key]: e.target.value }));

  function handleFile(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    const picked = selected[0];
    if (!picked.name.toLowerCase().endsWith(".xlsx")) {
      setFormError("Please upload a valid Excel (.xlsx) file");
      return;
    }
    setFormError("");
    setFile(picked);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!file) {
      setFormError("Please choose an Excel file to upload");
      return;
    }
    setLoading(true);
    try {
      const result = await uploadTraceabilityFile(file, config);
      if (result.missingColumns.length > 0) {
        throw new Error(`Column(s) not found in the sheet: ${result.missingColumns.join(", ")}`);
      }
      setUploadResult(result);
      setPhase("preview");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRun() {
    if (!uploadResult) return;
    const rows: ProgressRow[] = uploadResult.rows.map((r) => ({
      ...r,
      status: r.valid ? "pending" : "skipped",
      message: r.valid ? "" : "Missing Source Key or Target Key",
    }));

    setProgressRows(rows);
    setPhase("running");

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].status === "skipped") continue;

      setProgressRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "in-progress" } : r))
      );
      try {
        const result = await processRelationRow(config, rows[i]);
        setProgressRows((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: result.success ? "success" : "error", message: result.message }
              : r
          )
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setProgressRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "error", message: msg } : r))
        );
      }
    }
    setPhase("done");
  }

  function handleReset() {
    setPhase("form");
    setConfig(INITIAL_CONFIG);
    setFile(null);
    setUploadResult(null);
    setProgressRows([]);
    setFormError("");
  }

  function downloadCsv() {
    const header = "Row,Source Key,Target Key,Relation Type,Status,Message";
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = progressRows.map((r) =>
      [r.row, r.sourceKey, r.targetKey, r.relationType, STATUS_LABEL[r.status], r.message]
        .map((v) => escape(String(v)))
        .join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `traceability_${config.action}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canUpload = config.accountName && (config.authType === "apikey" ? config.apiKey : config.username && config.password) && file;

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
        Traceability Manager
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Create or delete traceability relations in bulk from an Excel file.
      </p>

      {phase === "form" && (
        <div className="card">
          <div className="card-title">Configuration</div>
          <div className="card-subtitle">Enter your Orcanos credentials and the traceability file</div>

          <div className="info-box">
            <strong>What this tool does:</strong> Reads Source Key / Target Key rows from an Excel
            sheet and creates or deletes the matching traceability relations in Orcanos.
            <ol className="info-steps">
              <li>Fill in your account credentials and choose <em>Create</em> or <em>Delete</em>.</li>
              <li>
                For <em>Delete</em>, pick whether your Target Key is already a custom code, or an
                original code that needs its prefix converted (e.g. <code>BR</code> → <code>MR_REQ</code>).
              </li>
              <li>Upload your Excel file, then click <em>Upload &amp; Preview</em>.</li>
              <li>Review the parsed rows, then click <em>Run</em> to process them one by one.</li>
            </ol>
          </div>

          {formError && <div className="error-banner">{formError}</div>}

          <form className="config-form" onSubmit={handleUpload}>
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

            <div className="form-row form-row--top">
              <label>Authentication Method</label>
              <div className="source-options">
                <label className="source-option">
                  <input
                    type="radio"
                    name="authType"
                    checked={config.authType === "apikey"}
                    onChange={() => setConfig((p) => ({ ...p, authType: "apikey" }))}
                  />
                  API Key
                </label>
                <label className="source-option">
                  <input
                    type="radio"
                    name="authType"
                    checked={config.authType === "basic"}
                    onChange={() => setConfig((p) => ({ ...p, authType: "basic" }))}
                  />
                  Basic Auth
                </label>
              </div>
            </div>

            {config.authType === "apikey" ? (
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
            ) : (
              <>
                <div className="form-row">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    placeholder="Your Orcanos username"
                    value={config.username}
                    onChange={set("username")}
                    required
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Your Orcanos password"
                    value={config.password}
                    onChange={set("password")}
                    required
                  />
                </div>
              </>
            )}

            <div className="form-row form-row--top">
              <label>Action</label>
              <div className="source-options">
                <label className="source-option">
                  <input
                    type="radio"
                    name="action"
                    checked={config.action === "add"}
                    onChange={() => setConfig((p) => ({ ...p, action: "add" }))}
                  />
                  Create relations
                </label>
                <label className="source-option">
                  <input
                    type="radio"
                    name="action"
                    checked={config.action === "delete"}
                    onChange={() => setConfig((p) => ({ ...p, action: "delete" }))}
                  />
                  Delete relations
                </label>
              </div>
            </div>

            {config.action === "delete" && (
              <>
                <div className="form-row form-row--top">
                  <label>Target Key Format</label>
                  <div className="source-options">
                    <label className="source-option">
                      <input
                        type="radio"
                        name="targetKeyFormat"
                        checked={config.targetKeyFormat === "custom"}
                        onChange={() => setConfig((p) => ({ ...p, targetKeyFormat: "custom" }))}
                      />
                      Custom code
                    </label>
                    <label className="source-option">
                      <input
                        type="radio"
                        name="targetKeyFormat"
                        checked={config.targetKeyFormat === "original"}
                        onChange={() => setConfig((p) => ({ ...p, targetKeyFormat: "original" }))}
                      />
                      Original code
                    </label>
                  </div>
                </div>
                {config.targetKeyFormat === "original" && (
                  <div className="form-row">
                    <label htmlFor="prefixMap">Prefix Conversions</label>
                    <input
                      id="prefixMap"
                      type="text"
                      placeholder="BR:MR_REQ,UR:REQ"
                      value={config.prefixMap}
                      onChange={set("prefixMap")}
                    />
                  </div>
                )}
              </>
            )}

            <div className="form-row">
              <label htmlFor="sheetName">Sheet Name</label>
              <input
                id="sheetName"
                type="text"
                value={config.sheetName}
                onChange={set("sheetName")}
              />
            </div>
            <div className="form-row">
              <label htmlFor="sourceCol">Source Key Column</label>
              <input id="sourceCol" type="text" value={config.sourceCol} onChange={set("sourceCol")} />
            </div>
            <div className="form-row">
              <label htmlFor="targetCol">Target Key Column</label>
              <input id="targetCol" type="text" value={config.targetCol} onChange={set("targetCol")} />
            </div>
            {config.action === "add" && (
              <div className="form-row">
                <label htmlFor="relationCol">Relation Type Column</label>
                <input id="relationCol" type="text" value={config.relationCol} onChange={set("relationCol")} />
              </div>
            )}

            <div className="form-row form-row--top">
              <label>Traceability File</label>
              <div>
                <div
                  className={`upload-area${isDragging ? " upload-area--dragging" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="upload-area-title">Click to upload or drag and drop</div>
                  <div className="upload-area-hint">.xlsx only</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    style={{ display: "none" }}
                    onChange={(e) => handleFile(e.target.files)}
                  />
                </div>
                {file && (
                  <div className="upload-file-row">
                    <span>{file.name}</span>
                    <button
                      type="button"
                      className="upload-file-remove"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={loading || !canUpload}>
                {loading ? "Uploading…" : "Upload & Preview"}
              </button>
            </div>
          </form>
        </div>
      )}

      {phase === "preview" && uploadResult && (
        <PreviewSection
          result={uploadResult}
          action={config.action}
          onBack={() => setPhase("form")}
          onRun={handleRun}
        />
      )}

      {(phase === "running" || phase === "done") && (
        <ProgressSection
          rows={progressRows}
          done={phase === "done"}
          onReset={handleReset}
          onDownload={downloadCsv}
        />
      )}
    </div>
  );
}

// ── PreviewSection ─────────────────────────────────────────────────────────────

function PreviewSection({
  result,
  action,
  onBack,
  onRun,
}: {
  result: UploadResult;
  action: string;
  onBack: () => void;
  onRun: () => void;
}) {
  const invalidRows = result.totalRows - result.validRows;

  return (
    <div className="card">
      <div className="preview-section">
        <h2>File Preview</h2>
        <p className="card-subtitle">
          {result.totalRows} row{result.totalRows === 1 ? "" : "s"} found — {result.validRows} will be{" "}
          {action === "add" ? "created" : "deleted"}
          {invalidRows > 0 && `, ${invalidRows} skipped (missing Source or Target Key)`}.
        </p>

        <div className="progress-table-wrap">
          <table className="progress-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Source Key</th>
                <th>Target Key</th>
                {action === "add" && <th>Relation Type</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.row}>
                  <td>{r.row}</td>
                  <td>{r.sourceKey}</td>
                  <td>{r.targetKey}</td>
                  {action === "add" && <td>{r.relationType}</td>}
                  <td>
                    {r.valid ? (
                      <span className="badge badge-pending">Ready</span>
                    ) : (
                      <span className="badge badge-error">Missing key</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="preview-actions">
          <button className="btn-secondary" onClick={onBack}>← Back</button>
          <button className="btn-primary" onClick={onRun} disabled={result.validRows === 0}>
            Run {result.validRows} row{result.validRows === 1 ? "" : "s"} ▶
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProgressSection ────────────────────────────────────────────────────────────

function ProgressSection({
  rows,
  done,
  onReset,
  onDownload,
}: {
  rows: ProgressRow[];
  done: boolean;
  onReset: () => void;
  onDownload: () => void;
}) {
  const succeeded = rows.filter((r) => r.status === "success").length;
  const failed = rows.filter((r) => r.status === "error").length;
  const skipped = rows.filter((r) => r.status === "skipped").length;

  const summaryParts = [
    succeeded > 0 && `${succeeded} succeeded`,
    failed > 0 && `${failed} failed`,
    skipped > 0 && `${skipped} skipped`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="card">
      <div className="progress-section">
        <h2>{done ? `Finished — ${summaryParts}` : `Processing ${rows.length} rows…`}</h2>
        <div className="progress-table-wrap">
          <table className="progress-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Source Key</th>
                <th>Target Key</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.row}>
                  <td>{r.row}</td>
                  <td>{r.sourceKey}</td>
                  <td>{r.targetKey}</td>
                  <td>
                    <span className={`badge badge-${r.status === "skipped" ? "pending" : r.status}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.message && r.status === "error" && <span className="error-msg"> — {r.message}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {done && (
          <div className="summary-actions">
            <span className="summary-text">{summaryParts}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-secondary" onClick={onDownload}>Download CSV</button>
              <button className="btn-secondary" onClick={onReset}>Reset</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
