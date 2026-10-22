"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  uploadParentFile,
  processParentRow,
  type ParentUpdaterConfig,
  type ParentRow,
  type UploadResult,
} from "@/lib/parent-updater";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "form" | "preview" | "running" | "done";
type RowStatus = "pending" | "in-progress" | "success" | "error" | "skipped";

interface ProgressRow extends ParentRow {
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

const INITIAL_CONFIG: ParentUpdaterConfig = {
  domain: "",
  authType: "apikey",
  apiKey: "",
  username: "",
  password: "",
  viewVersion: "36",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ParentUpdaterPage() {
  const [config, setConfig] = useState<ParentUpdaterConfig>(INITIAL_CONFIG);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof ParentUpdaterConfig) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setConfig((prev) => ({ ...prev, [key]: e.target.value }));

  function handleFile(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    const picked = selected[0];
    if (!picked.name.toLowerCase().endsWith(".csv")) {
      setFormError("Please upload a valid CSV (.csv) file");
      return;
    }
    setFormError("");
    setFile(picked);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!file) {
      setFormError("Please choose a CSV file to upload");
      return;
    }
    setLoading(true);
    try {
      const result = await uploadParentFile(file);
      if (result.missingColumns.length > 0) {
        throw new Error(`Column(s) not found in the CSV: ${result.missingColumns.join(", ")}`);
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
      message: r.valid ? "" : "Missing or unparsable Key / Parent Key",
    }));

    setProgressRows(rows);
    setPhase("running");

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].status === "skipped") continue;

      setProgressRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "in-progress" } : r))
      );
      try {
        const result = await processParentRow(config, rows[i]);
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
    const header = "Row,Key,Parent Key,Name,Status,Message";
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = progressRows.map((r) =>
      [r.row, r.key, r.parentKey, r.name, STATUS_LABEL[r.status], r.message]
        .map((v) => escape(String(v)))
        .join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "parent_updater_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const canUpload =
    config.domain &&
    config.viewVersion &&
    (config.authType === "apikey" ? config.apiKey : config.username && config.password) &&
    file;

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
        Parent Updater
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Bulk-set the Parent_ID of work items from a CSV of Key / Parent Key pairs.
      </p>

      {phase === "form" && (
        <div className="card">
          <div className="card-title">Configuration</div>
          <div className="card-subtitle">Enter your Orcanos credentials and the parent-mapping CSV</div>

          <div className="info-box">
            <strong>What this tool does:</strong> Reads Key / Parent Key / Name rows from a CSV
            file and sets each item&apos;s Parent_ID in Orcanos via QW_Update_Object.
            <ol className="info-steps">
              <li>Fill in your domain, credentials, and the View Version used by your project.</li>
              <li>
                Upload a CSV with <code>Key</code>, <code>Parent Key</code>, and <code>Name</code>{" "}
                columns (e.g. <code>RISK-28743</code>, <code>PAR-29628</code>).
              </li>
              <li>Click <em>Upload &amp; Preview</em>, review the parsed rows.</li>
              <li>Click <em>Run</em> to apply the updates one by one.</li>
            </ol>
          </div>

          {formError && <div className="error-banner">{formError}</div>}

          <form className="config-form" onSubmit={handleUpload}>
            <div className="form-row">
              <label htmlFor="domain">Orcanos Domain</label>
              <input
                id="domain"
                type="text"
                placeholder="app.orcanos.com/your company"
                value={config.domain}
                onChange={set("domain")}
                required
              />
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

            <div className="form-row">
              <label htmlFor="viewVersion">View Version</label>
              <input
                id="viewVersion"
                type="text"
                value={config.viewVersion}
                onChange={set("viewVersion")}
                required
              />
            </div>

            <div className="form-row form-row--top">
              <label>Parent Mapping File</label>
              <div>
                <div
                  className={`upload-area${isDragging ? " upload-area--dragging" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="upload-area-title">Click to upload or drag and drop</div>
                  <div className="upload-area-hint">.csv only</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
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
        <PreviewSection result={uploadResult} onBack={() => setPhase("form")} onRun={handleRun} />
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
  onBack,
  onRun,
}: {
  result: UploadResult;
  onBack: () => void;
  onRun: () => void;
}) {
  const invalidRows = result.totalRows - result.validRows;

  return (
    <div className="card">
      <div className="preview-section">
        <h2>File Preview</h2>
        <p className="card-subtitle">
          {result.totalRows} row{result.totalRows === 1 ? "" : "s"} found — {result.validRows} will be updated
          {invalidRows > 0 && `, ${invalidRows} skipped (missing or unparsable Key / Parent Key)`}.
        </p>

        <div className="progress-table-wrap">
          <table className="progress-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Key</th>
                <th>Parent Key</th>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.row}>
                  <td>{r.row}</td>
                  <td>{r.key}</td>
                  <td>{r.parentKey}</td>
                  <td>{r.name}</td>
                  <td>
                    {r.valid ? (
                      <span className="badge badge-pending">Ready</span>
                    ) : (
                      <span className="badge badge-error">Invalid key</span>
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
                <th>Key</th>
                <th>Parent Key</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.row}>
                  <td>{r.row}</td>
                  <td>{r.key}</td>
                  <td>{r.parentKey}</td>
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
