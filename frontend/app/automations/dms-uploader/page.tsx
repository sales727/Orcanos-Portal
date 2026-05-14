"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Play, X, AlertTriangle, FileText, Info, Pencil } from "lucide-react";
import { compareFiles, uploadFiles, type CompareForm, type ComparisonRow } from "@/lib/api";

const ACTION_STYLE: Record<string, string> = {
  UPDATE: "bg-yellow-100 text-yellow-800",
  CREATE: "bg-green-100 text-green-800",
  SAME: "bg-gray-100 text-gray-600",
  HOLD: "bg-red-100 text-red-700",
};

const DEFAULT_FORM: CompareForm = {
  account: "",
  auth_key: "",
  project_id: 78,
  filter_id: 25,
  version_id: 5,
  parent_id: "",
  mode: "compare",
};

export default function DMSUploaderPage() {
  const [form, setForm] = useState<CompareForm>(DEFAULT_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ComparisonRow[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number; log: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof CompareForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "number" ? +e.target.value : e.target.value }));

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter((f) =>
      [".pdf", ".docx", ".xlsx", ".pptx"].some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    setFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, j) => j !== i));

  const toggleRow = (i: number, checked: boolean) =>
    setResults((prev) => prev!.map((r, j) => (j === i ? { ...r, selected: checked } : r)));

  const canRun = form.account && form.auth_key && files.length > 0;
  const selectedRows = results?.filter((r) => r.selected && (r.action === "UPDATE" || r.action === "CREATE")) ?? [];
  const eligibleRows = results?.filter((r) => (r.action === "UPDATE" || r.action === "CREATE") && !r.suspicious) ?? [];
  const allSelected = eligibleRows.length > 0 && eligibleRows.every((r) => r.selected);
  const someSelected = !allSelected && eligibleRows.some((r) => r.selected);

  const updateResult = (i: number, field: "title" | "dms_number" | "file_rev", value: string) =>
    setResults((prev) => prev!.map((r, j) => (j === i ? { ...r, [field]: value } : r)));

  const toggleAll = () => {
    const next = !allSelected;
    setResults((prev) =>
      prev!.map((r) =>
        (r.action === "UPDATE" || r.action === "CREATE") && !r.suspicious ? { ...r, selected: next } : r
      )
    );
  };

  async function handleRun() {
    setIsRunning(true);
    setResults(null);
    setRunError(null);
    setUploadResult(null);
    try {
      const data = await compareFiles(files, form);
      setResults(data);
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }

  async function handleUpload() {
    if (!results) return;
    setIsUploading(true);
    setUploadResult(null);
    try {
      const data = await uploadFiles(files, form, selectedRows);
      setUploadResult(data);
    } catch (err: unknown) {
      setUploadResult({ success: 0, failed: selectedRows.length, log: [String(err)] });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Back link */}
        <Link href="/automations" className="inline-flex items-center gap-1.5 text-sm text-purple-medium hover:text-purple-primary mb-6 transition-colors">
          <ArrowLeft size={15} />
          Back to Automations
        </Link>

        {/* Header */}
        <h1 className="text-2xl font-bold text-purple-primary mb-1">DMS Uploader</h1>
        <p className="text-body text-sm mb-8">
          Compare files against live <span className="text-purple-medium">Orcanos DMS</span> data, then batch-upload revisions or create new records.
        </p>

        {/* Description card */}
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <h2 className="text-base font-semibold text-heading mb-3">Description</h2>
          <p className="text-body text-sm leading-relaxed mb-4">
            The DMS Uploader compares your local files against the live Orcanos DMS directory and classifies each document before uploading. Files are matched by the DMS number in their filename. The filename must use a space to separate the DMS number from the title (e.g. <span className="font-mono text-xs bg-gray-100 px-1 rounded">DMS-1234 Rev B Title.pdf</span>). Files without a space will appear with the full filename stem as the DMS key. Files with an unsupported extension are ignored.
          </p>

          <div className="mb-4">
            <p className="text-xs font-semibold text-heading uppercase tracking-wide mb-2">Action types</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {[
                ["UPDATE", "bg-yellow-100 text-yellow-800", "Your file has a newer revision — the existing record will be updated."],
                ["CREATE", "bg-green-100 text-green-800", "No matching record found — a new DMS item will be created."],
                ["SAME", "bg-gray-100 text-gray-600", "Your file matches the current Orcanos revision. No action needed."],
                ["HOLD", "bg-red-100 text-red-700", "Your file is older than the Orcanos record. Manual review required."],
              ].map(([label, cls, desc]) => (
                <div key={label} className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
                  <span className="text-body text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-heading uppercase tracking-wide mb-2">Upload mechanism</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-body">
              <div>
                <span className="font-medium text-heading">UPDATE</span> — 2 uploads to existing record:
                <ol className="list-decimal list-inside mt-1 space-y-0.5 ml-1">
                  <li>Original open-format file (DOCX / XLSX / PPTX)</li>
                  <li>Clean copy (renamed to document title)</li>
                </ol>
              </div>
              <div>
                <span className="font-medium text-heading">CREATE</span> — 3 uploads to new record:
                <ol className="list-decimal list-inside mt-1 space-y-0.5 ml-1">
                  <li>PDF → becomes revision A1</li>
                  <li>Original open-format file → revision A2</li>
                  <li>Clean copy → revision A3</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs font-semibold text-heading uppercase tracking-wide mb-2">How to use</p>
            <ol className="text-body text-sm space-y-1 list-decimal list-inside">
              <li>Enter your Orcanos account name and API key below.</li>
              <li>Upload all relevant files — PDF for the signed copy, DOCX / XLSX / PPTX for the editable source.</li>
              <li>Click <span className="font-medium text-heading">Run Automation</span> to compare against the live DMS.</li>
              <li>Review the results table — you can edit Name, Legacy Key, and Legacy Revision inline before uploading.</li>
              <li>Deselect any rows you want to skip, then click <span className="font-medium text-heading">Upload Selected</span>.</li>
            </ol>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm border-t border-border pt-4">
            {[
              ["Accepted Files", "PDF, DOCX, XLSX, PPTX"],
              ["Expected Output", "Updated DMS records"],
              ["Avg. Duration", "2–5 minutes"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-body">{label}</p>
                <p className="text-heading font-medium mt-1">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Configuration card */}
        <div className="bg-card rounded-xl border border-border p-6 mb-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-heading">Configuration</h2>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg text-sm">
              {(["compare", "scratch"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setForm((f) => ({ ...f, mode: m })); setResults(null); }}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    form.mode === m ? "bg-white text-heading shadow-sm" : "text-body hover:text-heading"
                  }`}
                >
                  {m === "compare" ? "Compare with Orcanos" : "Upload from scratch"}
                </button>
              ))}
            </div>
          </div>

          {form.mode === "scratch" && (
            <p className="text-xs text-body bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              All uploaded files will be treated as new records — no Orcanos comparison is performed. Filter ID is not used in this mode.
            </p>
          )}

          <Field label="Account Name" required>
            <input type="text" placeholder="e.g. shirfrank" value={form.account} onChange={set("account")} className={inputCls} />
          </Field>

          <Field label="API Authentication Key" required>
            <input type="password" placeholder="Enter your API authentication key" value={form.auth_key} onChange={set("auth_key")} className={inputCls} />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Project ID" required>
              <input type="number" value={form.project_id} onChange={set("project_id")} className={inputCls} />
            </Field>
            <div className={form.mode === "scratch" ? "opacity-40 pointer-events-none" : ""}>
              <Field label="Filter ID">
                <input type="number" value={form.filter_id} onChange={set("filter_id")} className={inputCls} />
              </Field>
            </div>
            <Field label="View ID" required tooltip="Taken from the Orcanos view URL">
              <input type="number" value={form.version_id} onChange={set("version_id")} className={inputCls} />
            </Field>
          </div>

          <Field label="Parent ID">
            <input type="text" placeholder="Leave blank for project pool" value={form.parent_id} onChange={set("parent_id")} className={inputCls} />
          </Field>

          {/* File upload */}
          <Field label="DMS Files" required>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-purple-medium bg-purple-light/20"
                  : "border-border bg-gray-50 hover:border-purple-medium hover:bg-purple-light/10"
              }`}
            >
              <Upload className="mx-auto mb-3 text-body" size={22} />
              <p className="text-sm font-medium text-heading">Click to upload or drag and drop</p>
              <p className="text-xs text-body mt-1">PDF, DOCX, XLSX, PPTX</p>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.pptx" className="hidden"
                onChange={(e) => addFiles(e.target.files)} />
            </div>
            {files.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-sm text-body bg-gray-50 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-2 truncate">
                      <FileText size={13} className="shrink-0" />{f.name}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="ml-2 shrink-0">
                      <X size={13} className="hover:text-red-500 transition-colors" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 bg-warning-bg border border-warning-border rounded-lg px-4 py-3 mb-6">
          <AlertTriangle size={15} className="text-orange-500 mt-0.5 shrink-0" />
          <p className="text-sm text-orange-800">
            This action interacts with Orcanos API. Only authorized technicians should execute.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mb-8">
          <Link href="/automations">
            <button className="px-5 py-2.5 text-sm font-medium text-heading border border-border rounded-full hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </Link>
          <button
            onClick={handleRun}
            disabled={isRunning || !canRun}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-primary rounded-full hover:bg-purple-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play size={13} fill="currentColor" />
            {isRunning ? "Running…" : form.mode === "scratch" ? "Preview Files" : "Run Automation"}
          </button>
        </div>

        {/* Error */}
        {runError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6 text-sm text-red-700">
            {runError}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-base font-semibold text-heading mb-4">Results</h2>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {(["CREATE", "UPDATE", "SAME", "HOLD"] as const).map((a) => {
                const count = results.filter((r) => r.action === a).length;
                return count > 0 ? (
                  <span key={a} className={`px-2.5 py-1 rounded-full text-xs font-medium ${ACTION_STYLE[a]}`}>
                    {a}: {count}
                  </span>
                ) : null;
              })}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left bg-gray-50">
                    <th className="py-2.5 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected; }}
                        onChange={toggleAll}
                        className="w-4 h-4 accent-purple-primary cursor-pointer"
                        title={allSelected ? "Deselect all" : "Select all"}
                      />
                    </th>
                    {["Action", "Legacy Key", "Orcanos Key", "Name", "Legacy Revision", "Orcanos Revision", "Files", "Note", ""].map((h) => (
                      <th key={h} className="py-2.5 px-3 font-medium text-body text-xs uppercase tracking-wide whitespace-nowrap">
                        {["Legacy Key", "Name", "Legacy Revision"].includes(h) ? (
                          <span className="inline-flex items-center gap-1">{h}<Pencil size={9} className="text-gray-400" /></span>
                        ) : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-3">
                        {(r.action === "UPDATE" || r.action === "CREATE") && !r.suspicious && (
                          <input type="checkbox" checked={r.selected}
                            onChange={(e) => toggleRow(i, e.target.checked)}
                            className="w-4 h-4 accent-purple-primary cursor-pointer" />
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_STYLE[r.action]}`}>
                          {r.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-heading whitespace-nowrap">
                        {(r.action === "UPDATE" || r.action === "CREATE") ? (
                          <input value={r.dms_number} onChange={(e) => updateResult(i, "dms_number", e.target.value)}
                            className={editInputCls} />
                        ) : r.dms_number}
                      </td>
                      <td className="py-3 px-3 text-body whitespace-nowrap">{r.orcanos_key}</td>
                      <td className="py-3 px-3 text-body">
                        {(r.action === "UPDATE" || r.action === "CREATE") ? (
                          <input value={r.title} onChange={(e) => updateResult(i, "title", e.target.value)}
                            className={editInputCls} />
                        ) : r.title}
                      </td>
                      <td className="py-3 px-3 text-heading whitespace-nowrap">
                        {(r.action === "UPDATE" || r.action === "CREATE") ? (
                          <input value={r.file_rev} onChange={(e) => updateResult(i, "file_rev", e.target.value)}
                            className={`${editInputCls} w-16`} />
                        ) : r.file_rev}
                      </td>
                      <td className="py-3 px-3 text-body whitespace-nowrap">{r.orcanos_rev}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-xs text-body">{r.file_types}</span>
                      </td>
                      <td className="py-3 px-3 text-body text-xs min-w-48">{renderReason(r.reason)}</td>
                      <td className="py-3 px-3">
                        {r.suspicious && (
                          <span
                            title="Only a PDF was uploaded for this UPDATE. Provide the editable source (DOCX / XLSX / PPTX) to proceed."
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium whitespace-nowrap cursor-help"
                          >
                            <Info size={11} />
                            PDF only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Upload */}
            <div className="flex justify-end mt-5">
              <button
                onClick={handleUpload}
                disabled={isUploading || selectedRows.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-primary rounded-full hover:bg-purple-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Play size={13} fill="currentColor" />
                {isUploading ? "Uploading…" : `Upload Selected (${selectedRows.length})`}
              </button>
            </div>

            {/* Upload result */}
            {uploadResult && (
              <div className="mt-5">
                <p className={`text-sm font-medium mb-2 ${uploadResult.failed > 0 ? "text-orange-700" : "text-green-700"}`}>
                  {uploadResult.failed === 0
                    ? `✓ Upload complete — ${uploadResult.success} succeeded`
                    : `Upload finished — ${uploadResult.success} succeeded, ${uploadResult.failed} failed`}
                </p>
                <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-auto max-h-64 leading-relaxed">
                  {uploadResult.log.join("\n")}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function renderReason(reason: string) {
  const parts = reason.split("⚠");
  if (parts.length === 1) return <>{reason}</>;
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="font-bold text-orange-500 text-base leading-none">⚠</span>}
          {part}
        </span>
      ))}
    </>
  );
}

const inputCls =
  "w-full px-4 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:border-purple-medium focus:ring-2 focus:ring-purple-light transition-colors bg-white";

const editInputCls =
  "w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-medium focus:outline-none text-sm py-0.5 transition-colors";

function Field({ label, required, tooltip, children }: { label: string; required?: boolean; tooltip?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-heading mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
        {tooltip && (
          <span title={tooltip} className="cursor-help text-body hover:text-heading transition-colors">
            <Info size={13} />
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
