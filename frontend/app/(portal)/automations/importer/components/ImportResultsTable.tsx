import type { ImportResultRow } from "@/lib/importer";

function rowBgClass(status: string) {
  if (status === "added") return "bg-green-50";
  if (status === "updated") return "bg-blue-50";
  if (status === "failed") return "bg-red-50";
  return "bg-gray-50";
}

function StatusBadge({ status, error }: { status: string; error: string | null }) {
  if (status === "added") {
    return <span className="px-3 py-1 rounded-full text-xs font-medium bg-success/20 text-success">Added</span>;
  }
  if (status === "updated") {
    return <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-600">Updated</span>;
  }
  if (status === "failed") {
    return <span className="px-3 py-1 rounded-full text-xs font-medium bg-danger/20 text-danger">Failed</span>;
  }
  if (status === "skipped" && error === "Cancelled before import") {
    return <span className="px-3 py-1 rounded-full text-xs font-medium bg-warning/20 text-warning-dark">Cancelled</span>;
  }
  return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700">Skipped</span>;
}

interface ImportResultsTableProps {
  rows: ImportResultRow[];
  itemTypeCode: string;
  buildUrl: (objectId: number) => string | null;
}

export default function ImportResultsTable({ rows, itemTypeCode, buildUrl }: ImportResultsTableProps) {
  const hasSteps = rows.some((r) => r.stepsTotal != null);

  return (
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
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Object ID</th>
            {hasSteps && <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Steps</th>}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Error Message</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200">
          {rows.map((result, idx) => (
            <tr key={idx} className={rowBgClass(result.status)}>
              <td className="px-4 py-3 text-sm text-gray-900">{result.row}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{result.objectName}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{result.objectType}</td>
              <td className="px-4 py-3 text-sm">
                <StatusBadge status={result.status} error={result.error} />
              </td>
              <td className="px-4 py-3 text-sm">
                {(result.status === "added" || result.status === "updated") && result.objectId > 0 ? (
                  (() => {
                    const url = buildUrl(result.objectId);
                    return url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-purple-primary hover:text-purple-medium font-medium underline underline-offset-2 transition-colors"
                        title={`Open object ${itemTypeCode}-${result.objectId} in Orcanos`}
                      >
                        {itemTypeCode}-{result.objectId}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                        </svg>
                      </a>
                    ) : (
                      <span className="text-gray-900">
                        {itemTypeCode}-{result.objectId}
                      </span>
                    );
                  })()
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              {hasSteps && (
                <td className="px-4 py-3 text-sm">
                  {result.stepsTotal != null ? (
                    <span className={`text-xs font-medium ${(result.stepsFailed ?? 0) > 0 ? "text-danger" : "text-success"}`}>
                      {result.stepsAdded}/{result.stepsTotal} added
                      {(result.stepsFailed ?? 0) > 0 && <span className="text-danger ml-1">({result.stepsFailed} failed)</span>}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              )}
              <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                {result.error || <span className="text-gray-400">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
