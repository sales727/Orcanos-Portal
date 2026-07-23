"use client";

import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import ImportResultsTable from "./ImportResultsTable";
import {
  IMPORTER_API_BASE,
  type Credentials,
  type ProjectConfig,
  type OrcanosField,
  type FileData,
  type FieldMapping,
  type ImportResultRow,
} from "@/lib/importer";

interface ValidationRow {
  row: number;
  objectName: string;
  objectType: string;
  valid: boolean;
  reasons: string[];
}

interface ValidationResponse {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ValidationRow[];
}

interface ImportSummary {
  total: number;
  success: number;
  added: number;
  updated: number;
  failed: number;
  skipped: number;
}

interface ImportResultsState {
  type: "done" | "cancelled";
  results: ImportResultRow[];
  summary: ImportSummary;
}

interface Step5ImportProps {
  fileData: FileData | null;
  originalFileData: FileData | null;
  onUpdateFileData: (fileData: FileData) => void;
  mapping: FieldMapping | null;
  stepsMapping: FieldMapping | null;
  testCaseLinkColumn: string | null;
  stepsLinkColumn: string | null;
  credentials: Credentials | null;
  projectConfig: ProjectConfig | null;
  orcanosFields: OrcanosField[];
  mandatoryFields: OrcanosField[];
  onStartOver: () => void;
  onBack: () => void;
  setImportInProgress: (inProgress: boolean) => void;
  onResetToStep2: () => void;
  onHasResultsChange: (hasResults: boolean) => void;
}

export default function Step5Import({
  fileData,
  originalFileData,
  onUpdateFileData,
  mapping,
  stepsMapping,
  testCaseLinkColumn,
  stepsLinkColumn,
  credentials,
  projectConfig,
  orcanosFields = [],
  mandatoryFields = [],
  onStartOver,
  onBack,
  setImportInProgress,
  onResetToStep2,
  onHasResultsChange,
}: Step5ImportProps) {
  const [validating, setValidating] = useState(true);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [validationError, setValidationError] = useState("");

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentRow, setCurrentRow] = useState(0);
  const [results, setResults] = useState<ImportResultsState | null>(null);
  const [error, setError] = useState("");
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false);

  const [previouslyImportedRows, setPreviouslyImportedRows] = useState<ImportResultRow[]>([]);

  const [cancelled, setCancelled] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const resultsMapRef = useRef(new Map<number, ImportResultRow>());
  const preContinueSnapshotRef = useRef<ImportResultsState | null>(null);
  const originalTotalRowsRef = useRef<number | null>(null);
  const continuingRef = useRef(false);
  const startingRef = useRef(false);
  const jobIdRef = useRef<string | null>(null);

  const handleBadgeClick = () => {
    if (importing) return;
    onResetToStep2();
  };

  const badgeClass = importing
    ? "font-semibold text-purple-primary select-none"
    : "font-semibold text-purple-primary hover:underline cursor-pointer select-none";

  useEffect(() => {
    setImportInProgress(importing);
  }, [importing, setImportInProgress]);

  useEffect(() => {
    onHasResultsChange(!!results);
  }, [results, onHasResultsChange]);

  useEffect(() => {
    if (fileData && mapping) {
      runValidation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runValidation = async (customData?: Record<string, unknown>[]) => {
    setValidating(true);
    setValidationError("");
    setValidation(null);

    const targetData = customData || fileData?.data || [];

    try {
      const response = await fetch(`${IMPORTER_API_BASE}/validate-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: targetData,
          mapping: mapping,
          mandatory_fields: mandatoryFields.map((f) => {
            const wsName = f.ws_add_col_name || f.name;
            return /^CS\d+_Name$/.test(wsName) ? wsName.replace("_Name", "_value") : wsName;
          }),
          projectConfig: projectConfig,
          orcanosFields: orcanosFields,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setValidationError(errorData.error || errorData.detail || "Validation failed");
        setValidating(false);
        return;
      }

      const data = await response.json();
      setValidation(data);
    } catch (err) {
      setValidationError("Error during validation: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setValidating(false);
    }
  };

  const handleStartImport = async () => {
    if (!validation || !fileData || !fileData.data) return;
    if (fileData.data.length === 0) return;
    if (startingRef.current) return;
    startingRef.current = true;
    preContinueSnapshotRef.current = null;

    setCancelled(false);
    setImporting(true);
    setCancelling(false);
    setProgress(0);
    setError("");
    jobIdRef.current = null;

    const isFirstBatch = originalTotalRowsRef.current === null;
    if (isFirstBatch) {
      originalTotalRowsRef.current = fileData.data.length;
      resultsMapRef.current = new Map();
    }

    try {
      const response = await fetch(`${IMPORTER_API_BASE}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: fileData.data,
          mapping: mapping,
          domain: credentials?.domain,
          headers: credentials?.headers,
          mandatory_fields: mandatoryFields.map((f) => {
            const wsName = f.ws_add_col_name || f.name;
            return /^CS\d+_Name$/.test(wsName) ? wsName.replace("_Name", "_value") : wsName;
          }),
          projectConfig: projectConfig,
          orcanosFields: orcanosFields,
          ...(stepsMapping && fileData?.stepsData && fileData.stepsData.length > 0
            ? { stepsData: fileData.stepsData, stepsMapping, testCaseLinkColumn, stepsLinkColumn }
            : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || errorData.detail || "Error during import");
        setImporting(false);
        startingRef.current = false;
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line);

          if (data.type === "started") {
            jobIdRef.current = data.job_id;
          } else if (data.type === "progress") {
            const sessionTotal = originalTotalRowsRef.current ?? data.total;
            setCurrentRow(data.row);
            setProgress((data.row / sessionTotal) * 100);
          } else if (data.type === "done" || data.type === "cancelled") {
            for (const r of data.results || []) {
              resultsMapRef.current.set(r.row, r);
            }
            const allResults = Array.from(resultsMapRef.current.values()).sort((a, b) => a.row - b.row);
            const summary: ImportSummary = {
              total: allResults.length,
              added: allResults.filter((r) => r.status === "added").length,
              updated: allResults.filter((r) => r.status === "updated").length,
              failed: allResults.filter((r) => r.status === "failed").length,
              skipped: allResults.filter((r) => r.status === "skipped").length,
              success: allResults.filter((r) => r.status === "added" || r.status === "updated").length,
            };
            setResults({ type: data.type, results: allResults, summary });

            if (data.type === "done") {
              originalTotalRowsRef.current = null;
              setImporting(false);
            } else {
              setCancelled(true);
              setImporting(false);
              setCancelling(false);
            }
          }
        }
      }
    } catch (err) {
      setError("Error during import: " + (err instanceof Error ? err.message : String(err)));
      setImporting(false);
      setCancelling(false);
    } finally {
      startingRef.current = false;
    }
  };

  const handleCancelImport = async () => {
    setShowCancelConfirm(false);
    setCancelling(true);
    if (jobIdRef.current) {
      try {
        await fetch(`${IMPORTER_API_BASE}/import/${jobIdRef.current}/cancel`, { method: "POST" });
      } catch (err) {
        console.error("Failed to cancel import:", err);
      }
    }
  };

  const handleContinueImport = () => {
    if (continuingRef.current) return;
    continuingRef.current = true;

    if (!results || !results.results) {
      continuingRef.current = false;
      return;
    }

    preContinueSnapshotRef.current = results;

    const skippedRowNumbers = results.results.filter((r) => r.status === "skipped").map((r) => r.row);

    const baseFileData = originalFileData || fileData;
    if (!baseFileData || !baseFileData.data) {
      continuingRef.current = false;
      return;
    }

    const nextData = baseFileData.data.filter((_, idx) => skippedRowNumbers.includes(idx + 1));
    const nextFileData: FileData = { ...baseFileData, data: nextData, totalRows: nextData.length };
    onUpdateFileData(nextFileData);

    setPreviouslyImportedRows(
      Array.from(resultsMapRef.current.values()).filter((r) => r.status === "added" || r.status === "updated" || r.status === "failed")
    );

    setResults(null);
    setCancelled(false);
    setImporting(false);
    setCancelling(false);
    setProgress(0);
    setCurrentRow(0);

    runValidation(nextData);
    continuingRef.current = false;
  };

  const handleBackClick = () => {
    if (results) {
      setShowBackConfirm(true);
    } else if (preContinueSnapshotRef.current) {
      setResults(preContinueSnapshotRef.current);
      setCancelled(true);
    } else {
      onBack();
    }
  };

  const handleConfirmBack = () => {
    setShowBackConfirm(false);
    setPreviouslyImportedRows([]);
    onBack();
  };

  const itemTypeCode = projectConfig?.item_type || projectConfig?.itemType || "";

  const buildOrcanosObjectUrl = (objectId: number): string | null => {
    if (!objectId || !credentials?.domain || !projectConfig) return null;

    const domainStr = credentials.domain || "";
    const slashIdx = domainStr.indexOf("/");
    const company = slashIdx !== -1 ? domainStr.slice(slashIdx + 1) : domainStr;

    const versionId = projectConfig.ver_id ?? `${projectConfig.major_version ?? projectConfig.majorVersion}.${projectConfig.minor_version ?? projectConfig.minorVersion}`;

    if (!company || !itemTypeCode || !versionId) return null;

    return `https://app.orcanos.com/${company}/web/${versionId}/items/view?Item=${itemTypeCode}&ItemId=${objectId}`;
  };

  const handleExportResults = () => {
    if (!results || !results.results) return;

    const hasStepsCols = results.results.some((r) => r.stepsTotal != null);
    const objectNameHeader = itemTypeCode === "DEFECT" ? "Synopsis" : "Object Name";
    const headers = ["Row", objectNameHeader, "Object Type", "Status", "Object ID", "Error Message", ...(hasStepsCols ? ["Steps Added", "Steps Failed"] : [])];

    const dataRows = results.results.map((r) => [
      r.row,
      r.objectName || "",
      r.objectType || "",
      r.status,
      null,
      r.error || "",
      ...(hasStepsCols ? [r.stepsAdded ?? "", r.stepsFailed ?? ""] : []),
    ]);

    const aoa = [headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    results.results.forEach((r, i) => {
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 4 });
      if ((r.status === "added" || r.status === "updated") && r.objectId > 0) {
        const url = buildOrcanosObjectUrl(r.objectId);
        const displayText = `${itemTypeCode}-${r.objectId}`;
        if (url) {
          ws[cellRef] = { t: "s", v: displayText, l: { Target: url, Tooltip: `Open ${displayText} in Orcanos` } };
        } else {
          ws[cellRef] = { t: "s", v: displayText };
        }
      } else {
        ws[cellRef] = { t: "s", v: r.objectId ? String(r.objectId) : "—" };
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import Results");
    XLSX.writeFile(wb, "orcanos_results.xlsx");
  };

  if (!fileData || !mapping || !credentials) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <p className="text-gray-600">Missing required data</p>
      </div>
    );
  }

  const ProjectBadge = () =>
    projectConfig ? (
      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500 bg-purple-light border border-purple-100 rounded-full px-3 py-1 font-medium select-none">
        <span>Project:</span>
        <span className={badgeClass} onClick={handleBadgeClick}>
          {projectConfig.project_name || ""}
        </span>
        <span className="text-purple-300">|</span>
        <span>Item Type:</span>
        <span className={badgeClass} onClick={handleBadgeClick}>
          {projectConfig.object_type_label || projectConfig.item_type || projectConfig.itemType || ""}
        </span>
      </div>
    ) : null;

  // ─── Phase 1: Validating ───
  if (validating) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Validating Data</h2>
          <ProjectBadge />
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-primary border-t-transparent mb-4"></div>
          <p className="text-gray-600 text-lg">Validating your data before import…</p>
          <p className="text-gray-400 text-sm mt-2">Checking {fileData.data.length} rows</p>
        </div>
      </div>
    );
  }

  // ─── Validation error ───
  if (validationError) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Validation Error</h2>
          <ProjectBadge />
        </div>
        <div className="bg-red-50 border border-danger/30 rounded-lg p-4 mb-6">
          <p className="text-danger">{validationError}</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 bg-white border border-purple-primary text-purple-primary hover:border-purple-medium hover:text-purple-medium disabled:opacity-50 disabled:cursor-not-allowed font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
          >
            Back
          </button>
          <button onClick={() => runValidation()} className="flex-1 bg-purple-primary hover:bg-purple-medium text-white font-medium py-2 px-4 rounded-lg transition">
            Retry Validation
          </button>
        </div>
      </div>
    );
  }

  // ─── Phase 2: Validation complete, show results + start import ───
  if (validation && !results) {
    const isEmpty = validation.totalRows === 0;
    const allInvalid = !isEmpty && validation.validRows === 0;
    const allValid = !isEmpty && validation.invalidRows === 0;

    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Import Data</h2>
          <ProjectBadge />
        </div>

        {!importing && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-purple-light border border-purple-200 rounded-lg p-4">
              <p className="text-purple-800 text-sm font-medium">Total Rows</p>
              <p className="text-2xl font-bold text-purple-primary">{originalTotalRowsRef.current ?? validation.totalRows}</p>
            </div>
            <div className="bg-green-50 border border-success/30 rounded-lg p-4">
              <p className="text-green-800 text-sm font-medium">Valid</p>
              <p className="text-2xl font-bold text-success">{validation.validRows}</p>
            </div>
            <div className="bg-red-50 border border-danger/30 rounded-lg p-4">
              <p className="text-red-800 text-sm font-medium">Invalid</p>
              <p className="text-2xl font-bold text-danger">{validation.invalidRows}</p>
            </div>
          </div>
        )}

        {!importing && allValid && (
          <div className="bg-green-50 border border-success/30 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-semibold flex items-center gap-2">
              <span className="text-lg">✓</span>
              All rows are valid. Ready to import!
            </p>
          </div>
        )}

        {!importing && allInvalid && (
          <div className="bg-red-50 border border-danger/30 rounded-lg p-4 mb-6">
            <p className="text-danger font-semibold flex items-center gap-2">
              <span className="text-lg">✗</span>
              No valid rows to import. Please fix your Excel file and try again.
            </p>
          </div>
        )}

        {!importing && isEmpty && (
          <div className="bg-page border border-border rounded-lg p-4 mb-6">
            <p className="text-purple-primary font-semibold flex items-center gap-2">
              <span className="text-lg">⚠</span>
              No rows to import.
            </p>
          </div>
        )}

        {!importing && !allValid && !allInvalid && !isEmpty && (
          <div className="bg-warning/10 border border-warning/40 rounded-lg p-4 mb-6">
            <p className="text-warning-dark font-semibold">{validation.validRows} rows valid and ready to import</p>
            <p className="text-warning-dark/80 text-sm mt-1">{validation.invalidRows} rows have issues and will be skipped</p>
          </div>
        )}

        {importing && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <p className="text-gray-700 font-medium">
                Processing row {currentRow} of {originalTotalRowsRef.current ?? fileData.data.length}
              </p>
              <div className="flex items-center gap-3">
                <p className="text-gray-700 font-medium">{Math.round(progress)}%</p>
                <button disabled={cancelling} onClick={() => setShowCancelConfirm(true)} className="btn-secondary py-1 px-3 text-sm disabled:opacity-50">
                  {cancelling ? "Cancelling..." : "Cancel Importing"}
                </button>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-purple-primary h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-danger/30 rounded-lg p-4">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {!importing && (
          <div className="mb-6 overflow-x-auto border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Row</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    {itemTypeCode === "DEFECT" ? "Synopsis" : "Object Name"}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Object Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previouslyImportedRows
                  .slice()
                  .sort((a, b) => a.row - b.row)
                  .map((row, idx) => (
                    <tr key={`prev-${idx}`} className="bg-purple-light">
                      <td className="px-4 py-3 text-sm text-gray-400">{row.row}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{row.objectName}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{row.objectType}</td>
                      <td className="px-4 py-3 text-sm">
                        {row.status === "failed" ? (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-danger/15 text-danger">Failed</span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-primary/15 text-purple-primary">
                            {row.status === "updated" ? "Updated" : "Imported"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{row.status === "failed" ? row.error || "—" : "—"}</td>
                    </tr>
                  ))}
                {validation.rows.map((row, idx) => (
                  <tr key={`cur-${idx}`} className={row.valid ? "bg-green-50" : "bg-red-50"}>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.row}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.objectName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.objectType}</td>
                    <td className="px-4 py-3 text-sm">
                      {row.valid ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-success/20 text-success">Ready</span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-danger/20 text-danger">Will be skipped</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                      {row.reasons && row.reasons.length > 0 ? (
                        <ul className="list-disc list-inside text-danger text-xs space-y-0.5">
                          {row.reasons.map((reason, rIdx) => (
                            <li key={rIdx}>{reason}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-success text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={handleBackClick} disabled={importing} className="btn-secondary flex-1 text-sm sm:text-base">
            Back
          </button>
          {!importing && !isEmpty && (
            <button onClick={handleStartImport} className="btn-primary flex-1 text-sm sm:text-base order-1 sm:order-2">
              Start Import ({fileData.data.length} rows)
            </button>
          )}
        </div>

        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Cancel Importing?</h3>
              <p className="text-gray-600 mb-6 text-sm">Rows already imported will remain in Orcanos. Remaining rows will not be imported.</p>
              <div className="flex gap-4">
                <button type="button" onClick={() => setShowCancelConfirm(false)} className="btn-secondary flex-1 text-sm sm:text-base">
                  Keep Importing
                </button>
                <button type="button" onClick={handleCancelImport} className="btn-danger flex-1 text-sm sm:text-base">
                  Cancel Importing
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Phase 3b: Import cancelled ───
  if (results?.type === "cancelled") {
    const X = results.summary.success || 0;
    const Y = results.summary.total || fileData.data.length || 0;
    const bannerText = X === 0 ? "No rows had been processed yet." : `Import cancelled — ${X} of ${Y} rows were imported before you stopped it.`;

    const rows = results.results || [];
    const addedCount = rows.filter((r) => r.status === "added").length;
    const updatedCount = rows.filter((r) => r.status === "updated").length;
    const cancelledCount = rows.filter((r) => r.status === "skipped" && r.error === "Cancelled before import").length;
    const failedCount = rows.filter((r) => r.status === "failed").length;

    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Import Cancelled</h2>
          <ProjectBadge />
        </div>

        <div className="bg-warning/10 border border-warning/40 rounded-lg p-4 mb-6">
          <p className="text-warning-dark font-semibold flex items-center gap-2">
            <span className="text-warning text-lg">⚠</span>
            {bannerText}
          </p>
        </div>

        <ImportResultsTable rows={rows} itemTypeCode={itemTypeCode} buildUrl={buildOrcanosObjectUrl} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 border border-success/30 rounded-lg p-4">
            <p className="text-green-800 text-sm font-medium">Added</p>
            <p className="text-2xl font-bold text-success">{addedCount}</p>
          </div>
          <div className="bg-blue-50 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-800 text-sm font-medium">Updated</p>
            <p className="text-2xl font-bold text-blue-600">{updatedCount}</p>
          </div>
          <div className="bg-warning/10 border border-warning/40 rounded-lg p-4">
            <p className="text-warning-dark text-sm font-medium">Cancelled</p>
            <p className="text-2xl font-bold text-warning-dark">{cancelledCount}</p>
          </div>
          {failedCount > 0 && (
            <div className="bg-red-50 border border-danger/30 rounded-lg p-4">
              <p className="text-red-800 text-sm font-medium">Failed</p>
              <p className="text-2xl font-bold text-danger">{failedCount}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={handleBackClick} className="btn-secondary flex-1 text-sm sm:text-base">
            Back
          </button>
          <button onClick={handleContinueImport} className="btn-primary flex-1 text-sm sm:text-base">
            Continue Import
          </button>
          <button onClick={handleExportResults} className="btn-secondary flex-1 text-sm sm:text-base">
            Export Results
          </button>
          <button onClick={() => setShowStartOverConfirm(true)} className="btn-secondary flex-1 text-sm sm:text-base order-1 sm:order-2">
            Start Over
          </button>
        </div>

        {showBackConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Going Back?</h3>
              <p className="text-gray-600 mb-6">Going back will clear your import results. Are you sure?</p>
              <div className="flex gap-4">
                <button onClick={() => setShowBackConfirm(false)} className="btn-secondary flex-1 text-sm sm:text-base">
                  Cancel
                </button>
                <button onClick={handleConfirmBack} className="btn-danger flex-1 text-sm sm:text-base">
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}

        {showStartOverConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Start Over?</h3>
              <p className="text-gray-600 mb-6 text-sm">This will clear all current data and return you to Step 1.</p>
              <div className="flex gap-4">
                <button type="button" onClick={() => setShowStartOverConfirm(false)} className="btn-secondary flex-1 text-sm sm:text-base">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStartOverConfirm(false);
                    resultsMapRef.current = new Map();
                    originalTotalRowsRef.current = null;
                    setPreviouslyImportedRows([]);
                    onStartOver();
                  }}
                  className="btn-primary flex-1 text-sm sm:text-base"
                >
                  Start Over
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Phase 3: Import complete ───
  if (results) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Import Results</h2>
          <ProjectBadge />
        </div>

        <ImportResultsTable rows={results.results || []} itemTypeCode={itemTypeCode} buildUrl={buildOrcanosObjectUrl} />

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="bg-purple-light border border-purple-200 rounded-lg p-4">
            <p className="text-purple-800 text-sm font-medium">Total</p>
            <p className="text-2xl font-bold text-purple-primary">{results.summary.total}</p>
          </div>
          <div className="bg-green-50 border border-success/30 rounded-lg p-4">
            <p className="text-green-800 text-sm font-medium">Added</p>
            <p className="text-2xl font-bold text-success">{results.summary.added ?? 0}</p>
          </div>
          <div className="bg-blue-50 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-800 text-sm font-medium">Updated</p>
            <p className="text-2xl font-bold text-blue-600">{results.summary.updated ?? 0}</p>
          </div>
          <div className="bg-red-50 border border-danger/30 rounded-lg p-4">
            <p className="text-red-800 text-sm font-medium">Failed</p>
            <p className="text-2xl font-bold text-danger">{results.summary.failed}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-gray-800 text-sm font-medium">Skipped</p>
            <p className="text-2xl font-bold text-gray-900">{results.summary.skipped}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={handleBackClick} disabled={importing} className="btn-secondary flex-1 text-sm sm:text-base">
            Back
          </button>
          <button onClick={handleExportResults} className="btn-secondary flex-1 text-sm sm:text-base">
            Export Results
          </button>
          <button
            onClick={() => !importing && setShowStartOverConfirm(true)}
            disabled={importing}
            className="btn-primary flex-1 text-sm sm:text-base order-1 sm:order-3"
          >
            Start Over
          </button>
        </div>

        {showBackConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Going Back?</h3>
              <p className="text-gray-600 mb-6">Going back will clear your import results. Are you sure?</p>
              <div className="flex gap-4">
                <button onClick={() => setShowBackConfirm(false)} className="btn-secondary flex-1 text-sm sm:text-base">
                  Cancel
                </button>
                <button onClick={handleConfirmBack} className="btn-danger flex-1 text-sm sm:text-base">
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}

        {showStartOverConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Start Over?</h3>
              <p className="text-gray-600 mb-6 text-sm">This will clear all current data and return you to Step 1.</p>
              <div className="flex gap-4">
                <button type="button" onClick={() => setShowStartOverConfirm(false)} disabled={importing} className="btn-secondary flex-1 text-sm sm:text-base">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStartOverConfirm(false);
                    resultsMapRef.current = new Map();
                    originalTotalRowsRef.current = null;
                    setPreviouslyImportedRows([]);
                    onStartOver();
                  }}
                  disabled={importing}
                  className="btn-primary flex-1 text-sm sm:text-base"
                >
                  Start Over
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
