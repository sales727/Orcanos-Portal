"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import SearchableSelect from "./SearchableSelect";
import type { FileData, FieldMapping, MappingPart, ProjectConfig, OrcanosField } from "@/lib/importer";

const serializeParts = (partsList: MappingPart[]): MappingPart[] =>
  partsList.map((part) => ({ type: part.type, value: part.value })).filter((part) => part.type === "column" || part.value.trim() !== "");

function parseAndNormalizeMapping(rawMap: Record<string, unknown> | null | undefined): FieldMapping {
  if (!rawMap || typeof rawMap !== "object") return {};

  const values = Object.values(rawMap);
  const isOldFormat = values.length > 0 && values.every((val) => typeof val === "string");

  const normalized: FieldMapping = {};

  if (isOldFormat) {
    Object.entries(rawMap).forEach(([excelCol, orcanosField]) => {
      if (orcanosField && orcanosField !== "-- Skip this field --") {
        normalized[orcanosField as string] = [
          { type: "text", value: "" },
          { type: "column", value: excelCol },
          { type: "text", value: "" },
        ];
      }
    });
    return normalized;
  }

  Object.entries(rawMap).forEach(([orcanosField, parts]) => {
    if (Array.isArray(parts)) {
      const cleaned: MappingPart[] = parts.filter((p) => p && (p.type === "text" || p.type === "column"));

      const merged: MappingPart[] = [];
      cleaned.forEach((part) => {
        if (part.type === "text") {
          if (merged.length > 0 && merged[merged.length - 1].type === "text") {
            merged[merged.length - 1].value += part.value;
          } else {
            merged.push({ ...part });
          }
        } else {
          merged.push({ ...part });
        }
      });

      const alternating: MappingPart[] = [];
      let expectText = true;

      merged.forEach((part) => {
        if (expectText) {
          if (part.type === "text") {
            alternating.push(part);
            expectText = false;
          } else {
            alternating.push({ type: "text", value: "" });
            alternating.push(part);
            expectText = true;
          }
        } else {
          if (part.type === "column") {
            alternating.push(part);
            expectText = true;
          } else if (alternating.length > 0) {
            alternating[alternating.length - 1].value += part.value;
          } else {
            alternating.push(part);
          }
        }
      });

      if (alternating.length === 0 || alternating[alternating.length - 1].type === "column") {
        alternating.push({ type: "text", value: "" });
      }

      normalized[orcanosField] = alternating;
    }
  });
  return normalized;
}

function MappingInputBuilder({
  value,
  onChange,
  excelColumns,
  isMandatory,
}: {
  value: MappingPart[];
  onChange: (parts: MappingPart[]) => void;
  excelColumns: string[];
  isMandatory: boolean;
}) {
  const parts = Array.isArray(value) && value.length > 0 ? value : [{ type: "text" as const, value: "" }];
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [focusedInput, setFocusedInput] = useState<{ index: number | null; offset: number | null }>({ index: null, offset: null });
  const [pendingFocus, setPendingFocus] = useState<{ index: number; offset: number } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dropdownOpen && searchRef.current) searchRef.current.focus();
  }, [dropdownOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    if (dropdownOpen) {
      setSearchTerm("");
      setHighlightedIndex(0);
    }
  }, [dropdownOpen]);

  const wasOpen = useRef(dropdownOpen);
  useEffect(() => {
    if (wasOpen.current && !dropdownOpen) triggerRef.current?.focus();
    wasOpen.current = dropdownOpen;
  }, [dropdownOpen]);

  useEffect(() => {
    if (dropdownOpen && activeOptionRef.current) activeOptionRef.current.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, dropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (pendingFocus !== null) {
      const { index, offset } = pendingFocus;
      const el = inputRefs.current[index];
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(offset, offset);
        } catch {
          // ignore
        }
      }
      setPendingFocus(null);
    }
  }, [pendingFocus, parts]);

  const handleTextChange = (idx: number, textVal: string) => {
    const newParts = [...parts];
    newParts[idx] = { ...newParts[idx], value: textVal };
    onChange(newParts);
  };

  const handleTextInteraction = (idx: number, e: React.SyntheticEvent<HTMLInputElement>) => {
    setFocusedInput({ index: idx, offset: (e.target as HTMLInputElement).selectionStart });
  };

  const handleSelectColumn = (colName: string) => {
    let targetIdx = focusedInput.index;
    let offset = focusedInput.offset;

    if (targetIdx === null || targetIdx < 0 || targetIdx >= parts.length || parts[targetIdx].type !== "text") {
      targetIdx = parts.length - 1;
      offset = parts[targetIdx].value.length;
    }

    const targetTextPart = parts[targetIdx];
    const textVal = targetTextPart.value;
    const leftText = textVal.slice(0, offset ?? textVal.length);
    const rightText = " " + textVal.slice(offset ?? textVal.length);

    const newParts: MappingPart[] = [
      ...parts.slice(0, targetIdx),
      { type: "text", value: leftText },
      { type: "column", value: colName },
      { type: "text", value: rightText },
      ...parts.slice(targetIdx + 1),
    ];

    onChange(newParts);
    setPendingFocus({ index: targetIdx + 2, offset: 1 });
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const { selectionStart, selectionEnd } = e.target as HTMLInputElement;
      if (selectionStart === 0 && selectionEnd === 0 && idx > 0) {
        e.preventDefault();

        const prevTextPart = parts[idx - 2];
        const currentTextPart = parts[idx];

        const mergedText = (prevTextPart?.value || "") + (currentTextPart?.value || "");
        const cursorOffset = (prevTextPart?.value || "").length;

        const newParts = [...parts.slice(0, idx - 2), { type: "text" as const, value: mergedText }, ...parts.slice(idx + 1)];

        onChange(newParts);
        setPendingFocus({ index: idx - 2, offset: cursorOffset });
      }
    }
  };

  const handleRemoveChip = (idx: number) => {
    const prevTextPart = parts[idx - 1];
    const nextTextPart = parts[idx + 1];

    const mergedText = (prevTextPart?.value || "") + (nextTextPart?.value || "");
    const cursorOffset = (prevTextPart?.value || "").length;

    const newParts = [...parts.slice(0, idx - 1), { type: "text" as const, value: mergedText }, ...parts.slice(idx + 2)];

    onChange(newParts);
    setPendingFocus({ index: idx - 1, offset: cursorOffset });
  };

  const isEmpty = !parts.some((p) => p.type === "column" || (p.type === "text" && p.value.trim() !== ""));
  const showWarning = isMandatory && isEmpty;

  const filteredColumns = excelColumns.filter((col) => (col || "").toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={`flex items-center justify-between border rounded-lg py-1.5 px-2.5 bg-white min-h-[36px] transition-all cursor-text focus-within:ring-1 focus-within:ring-purple-primary focus-within:border-transparent ${
          showWarning ? "border-amber-400 bg-amber-50/10" : "border-gray-300"
        }`}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName !== "INPUT" && !target.closest("button") && !target.closest(".bg-purple-100")) {
            const lastIdx = parts.length - 1;
            inputRefs.current[lastIdx]?.focus();
          }
        }}
      >
        <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
          {parts.map((part, idx) =>
            part.type === "column" ? (
              <div
                key={idx}
                className="bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1 select-none border border-purple-200"
              >
                <span>{part.value}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveChip(idx);
                  }}
                  className="text-purple-600 hover:text-purple-900 font-bold focus:outline-none text-[11px] leading-none"
                >
                  ×
                </button>
              </div>
            ) : (
              <div key={idx} className="relative inline-grid grid-cols-1 items-center max-w-full min-w-[4px]">
                <input
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  value={part.value}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onKeyUp={(e) => handleTextInteraction(idx, e)}
                  onClick={(e) => handleTextInteraction(idx, e)}
                  onFocus={(e) => handleTextInteraction(idx, e)}
                  className="absolute inset-0 w-full h-full bg-transparent border-none outline-none p-0 m-0 font-sans text-sm text-gray-800 focus:ring-0 focus:border-none focus:outline-none"
                  style={{ border: "none", boxShadow: "none" }}
                />
                <span className="col-start-1 row-start-1 invisible whitespace-pre pointer-events-none p-0 m-0 font-sans text-sm min-w-[4px] block">
                  {part.value || " "}
                </span>
              </div>
            )
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 pl-1 border-l border-gray-200 ml-2">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            className="text-gray-400 hover:text-purple-primary p-1 transition focus:outline-none"
            title="Insert Excel Column"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>

      {showWarning && (
        <span className="text-[11px] text-amber-600 font-medium absolute -bottom-4 left-1 leading-none">
          * Mandatory field is not mapped
        </span>
      )}

      {dropdownOpen && (
        <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 flex flex-col max-h-60">
          <div className="relative mb-2 flex-shrink-0">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              role="combobox"
              aria-expanded={dropdownOpen}
              aria-autocomplete="list"
              aria-controls="columns-listbox"
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-primary focus:border-transparent"
            />
          </div>
          <div id="columns-listbox" role="listbox" className="overflow-y-auto flex-1 space-y-0.5 max-h-40 pr-1">
            {filteredColumns.map((col, cIdx) => (
              <button
                key={cIdx}
                id={`col-option-${cIdx}`}
                role="option"
                aria-selected={false}
                ref={cIdx === highlightedIndex ? activeOptionRef : null}
                type="button"
                onClick={() => {
                  handleSelectColumn(col);
                  setDropdownOpen(false);
                }}
                tabIndex={-1}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition font-medium truncate ${
                  cIdx === highlightedIndex ? "bg-purple-100 text-purple-primary" : "text-gray-700 hover:bg-purple-light hover:text-purple-700"
                }`}
              >
                {col}
              </button>
            ))}
            {filteredColumns.length === 0 && <div className="text-xs text-gray-400 text-center py-4">No columns found</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const STEP_FIELDS = [
  { key: "StepNumber", label: "Step Number", mandatory: false },
  { key: "Description", label: "Description", mandatory: true },
  { key: "ExpectedValue", label: "Expected Value", mandatory: false },
  { key: "LowerLimit", label: "Lower Limit", mandatory: false },
  { key: "UpperLimit", label: "Upper Limit", mandatory: false },
];

function buildEmptyStepsMapping(stepsHeaders: string[]): FieldMapping {
  const m: FieldMapping = {};
  STEP_FIELDS.forEach((f) => {
    const cleanKey = f.key.toLowerCase().replace(/[_\s-]+/g, "");
    const cleanLabel = f.label.toLowerCase().replace(/[_\s-]+/g, "");
    const match = stepsHeaders.find((h) => {
      const nh = (h || "").trim().toLowerCase().replace(/[_\s-]+/g, "");
      return nh === cleanKey || nh === cleanLabel;
    });
    m[f.key] = match
      ? [{ type: "text", value: "" }, { type: "column", value: match }, { type: "text", value: "" }]
      : [{ type: "text", value: "" }];
  });
  return m;
}

interface Step4MappingProps {
  fileData: FileData | null;
  existingMapping: FieldMapping | null;
  existingStepsMapping: FieldMapping | null;
  existingTestCaseLinkColumn: string | null;
  existingStepsLinkColumn: string | null;
  projectConfig: ProjectConfig | null;
  orcanosFields: OrcanosField[];
  mandatoryFields: OrcanosField[];
  onComplete: (result: {
    mapping: FieldMapping;
    stepsMapping: FieldMapping | null;
    testCaseLinkColumn: string | null;
    stepsLinkColumn: string | null;
  }) => void;
  onBack: () => void;
  onResetToStep2: () => void;
}

export default function Step4Mapping({
  fileData,
  existingMapping,
  existingStepsMapping,
  existingTestCaseLinkColumn,
  existingStepsLinkColumn,
  projectConfig,
  orcanosFields = [],
  mandatoryFields = [],
  onComplete,
  onBack,
  onResetToStep2,
}: Step4MappingProps) {
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [stepsMapping, setStepsMapping] = useState<FieldMapping>({});
  const [testCaseLinkColumn, setTestCaseLinkColumn] = useState("");
  const [stepsLinkColumn, setStepsLinkColumn] = useState("");
  const [error, setError] = useState("");

  const hasSteps = !!(fileData?.stepsData && fileData.stepsData.length > 0);

  const mainHeaderOptions = useMemo(() => (fileData?.headers || []).map((h) => ({ value: h, label: h })), [fileData?.headers]);
  const stepsHeaderOptions = useMemo(() => (fileData?.stepsHeaders || []).map((h) => ({ value: h, label: h })), [fileData?.stepsHeaders]);

  const mappedFields = (() => {
    const fields = [...orcanosFields];
    if (!fields.some((f) => f.ws_add_col_name === "Parent_ID")) {
      fields.push({ name: "Parent_ID", ws_add_col_name: "Parent_ID", title: "Parent ID", is_mandatory: "0" });
    }
    if (!fields.some((f) => f.ws_add_col_name === "Object_ID")) {
      fields.push({ name: "Object_ID", ws_add_col_name: "Object_ID", title: "Object ID", is_mandatory: "0" });
    }
    return fields;
  })();

  useEffect(() => {
    if (!fileData) return;

    if (existingMapping) {
      setMapping(parseAndNormalizeMapping(existingMapping));
    } else {
      const autoMapping: Record<string, MappingPart[]> = {};
      mappedFields.forEach((field) => {
        const wsName = /^CS\d+_Name$/.test(field.ws_add_col_name) ? field.ws_add_col_name.replace("_Name", "_value") : field.ws_add_col_name;

        const cleanName = (field.name || "").toLowerCase().replace(/[\s_-]+/g, "");
        const cleanTitle = (field.title || "").toLowerCase().replace(/[\s_-]+/g, "");

        const matchedHeader = fileData.headers.find((header) => {
          const normalizedHeader = header.trim().toLowerCase().replace(/[\s_-]+/g, "");
          return cleanName === normalizedHeader || cleanTitle === normalizedHeader;
        });

        autoMapping[wsName] = matchedHeader
          ? [{ type: "text", value: "" }, { type: "column", value: matchedHeader }, { type: "text", value: " " }]
          : [{ type: "text", value: "" }];
      });
      setMapping(parseAndNormalizeMapping(autoMapping));
    }

    if (hasSteps) {
      if (existingStepsMapping) {
        setStepsMapping(parseAndNormalizeMapping(existingStepsMapping));
      } else {
        setStepsMapping(buildEmptyStepsMapping(fileData.stepsHeaders || []));
      }

      const linkKeywords = ["testcasenumber", "tcnumber", "tcno", "testcaseid", "tcid", "caseno", "casenumber"];
      const findLink = (arr: string[]) => arr.find((h) => linkKeywords.includes((h || "").toLowerCase().replace(/[\s_-]+/g, ""))) || "";

      if (existingTestCaseLinkColumn) {
        setTestCaseLinkColumn(existingTestCaseLinkColumn);
      } else {
        const tcHeaders = fileData.headers || [];
        setTestCaseLinkColumn(findLink(tcHeaders) || tcHeaders[0] || "");
      }

      if (existingStepsLinkColumn) {
        setStepsLinkColumn(existingStepsLinkColumn);
      } else {
        const stepHeaders = fileData.stepsHeaders || [];
        setStepsLinkColumn(findLink(stepHeaders) || stepHeaders[0] || "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileData, existingMapping, existingStepsMapping, existingTestCaseLinkColumn, existingStepsLinkColumn, orcanosFields]);

  const handleMappingChange = (orcanosField: string, parts: MappingPart[]) => {
    setMapping((prev) => ({ ...prev, [orcanosField]: parts }));
    setError("");
  };

  const handleStepsMappingChange = (stepField: string, parts: MappingPart[]) => {
    setStepsMapping((prev) => ({ ...prev, [stepField]: parts }));
    setError("");
  };

  const validateMapping = () => {
    if (hasSteps) {
      const descParts = stepsMapping["Description"] || [];
      const descEmpty = !descParts.some((p) => p.type === "column" || (p.type === "text" && p.value.trim() !== ""));
      if (descEmpty) {
        setError("Steps Description mapping is required.");
        return false;
      }
      if (!testCaseLinkColumn) {
        setError("Please select the Test Case link column from the main sheet.");
        return false;
      }
      if (!stepsLinkColumn) {
        setError("Please select the Steps link column from the steps sheet.");
        return false;
      }
    }
    return true;
  };

  const handleLoadPreviousMapping = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.mapping) {
          setMapping(parseAndNormalizeMapping(data.mapping));
          setError("");
        } else {
          setError("Invalid mapping file format");
        }
      } catch (err) {
        setError("Error reading mapping file: " + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  const handleSaveMapping = () => {
    const serializedMapping: Record<string, MappingPart[]> = {};
    Object.entries(mapping).forEach(([field, parts]) => {
      serializedMapping[field] = serializeParts(parts);
    });

    const dataStr = JSON.stringify({ mapping: serializedMapping }, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "field-mapping.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveAndImport = () => {
    if (!validateMapping()) return;

    const serializedMapping: Record<string, MappingPart[]> = {};
    Object.entries(mapping).forEach(([field, parts]) => {
      serializedMapping[field] = serializeParts(parts);
    });

    const serializedStepsMapping: Record<string, MappingPart[]> = {};
    Object.entries(stepsMapping).forEach(([field, parts]) => {
      serializedStepsMapping[field] = serializeParts(parts);
    });

    onComplete({
      mapping: serializedMapping,
      stepsMapping: hasSteps ? serializedStepsMapping : null,
      testCaseLinkColumn: hasSteps ? testCaseLinkColumn : null,
      stepsLinkColumn: hasSteps ? stepsLinkColumn : null,
    });
  };

  if (!fileData || !fileData.headers) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <p className="text-gray-600">No file data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Map Fields</h2>
        {projectConfig && (
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500 bg-purple-light border border-purple-100 rounded-full px-3 py-1 font-medium select-none">
            <span>Project:</span>
            <span className="text-purple-primary hover:underline cursor-pointer select-none" onClick={onResetToStep2}>
              {projectConfig.project_name || ""}
            </span>
            <span className="text-purple-300">|</span>
            <span>Item Type:</span>
            <span className="text-purple-primary hover:underline cursor-pointer select-none" onClick={onResetToStep2}>
              {projectConfig.object_type_label || projectConfig.item_type || ""}
            </span>
          </div>
        )}
      </div>

      <div className="mb-6">
        <label className="bg-purple-primary hover:bg-purple-medium text-white font-medium py-2 px-4 rounded-lg cursor-pointer inline-block transition text-sm sm:text-base">
          Load Previous Mapping
          <input type="file" accept=".json" onChange={handleLoadPreviousMapping} className="hidden" />
        </label>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {hasSteps && (
        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs flex items-center justify-center font-bold">1</span>
          Test Case Fields
        </h3>
      )}

      <div className="mb-8 overflow-visible border border-gray-300 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-1/3">Orcanos Field</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-2/3">Mapping Builder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mappedFields.map((field, idx) => {
              const wsName = /^CS\d+_Name$/.test(field.ws_add_col_name) ? field.ws_add_col_name.replace("_Name", "_value") : field.ws_add_col_name;
              const isMandatory = field.is_mandatory === "1";
              const currentParts = mapping[wsName] || [{ type: "text" as const, value: "" }];

              return (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-2 text-sm font-semibold text-gray-700 w-1/3 align-middle">
                    <div className="flex items-center gap-1">
                      <span>{field.title || field.name}</span>
                      {isMandatory && (
                        <span className="text-red-500 font-bold" title="Mandatory field">
                          *
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-2 text-sm w-2/3 align-middle overflow-visible">
                    <MappingInputBuilder
                      value={currentParts}
                      onChange={(newParts) => handleMappingChange(wsName, newParts)}
                      excelColumns={fileData.headers}
                      isMandatory={isMandatory}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasSteps && (
        <div className="mb-8">
          <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-light text-purple-primary text-xs flex items-center justify-center font-bold">2</span>
            Step Fields
          </h3>

          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-purple-light border border-gray-200 rounded-lg">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Test Case link column <span className="text-red-500">*</span>
                <span className="font-normal text-gray-500 ml-1">(main sheet)</span>
              </label>
              <SearchableSelect
                value={testCaseLinkColumn}
                onChange={setTestCaseLinkColumn}
                options={mainHeaderOptions}
                placeholder="— Select column —"
                searchPlaceholder="Search columns..."
              />
              <p className="text-xs text-gray-500 mt-1">The column in the main sheet that contains the test case number / ID</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Steps link column <span className="text-red-500">*</span>
                <span className="font-normal text-gray-500 ml-1">(steps sheet)</span>
              </label>
              <SearchableSelect
                value={stepsLinkColumn}
                onChange={setStepsLinkColumn}
                options={stepsHeaderOptions}
                placeholder="— Select column —"
                searchPlaceholder="Search columns..."
              />
              <p className="text-xs text-gray-500 mt-1">The column in the steps sheet that references the test case number / ID</p>
            </div>
          </div>

          <div className="overflow-visible border border-gray-300 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-1/3">Step Field</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-2/3">Mapping Builder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {STEP_FIELDS.map((field, idx) => {
                  const currentParts = stepsMapping[field.key] || [{ type: "text" as const, value: "" }];
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-2 text-sm font-semibold text-gray-700 w-1/3 align-middle">
                        <div className="flex items-center gap-1">
                          <span>{field.label}</span>
                          {field.mandatory && (
                            <span className="text-red-500 font-bold" title="Mandatory field">
                              *
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-2 text-sm w-2/3 align-middle overflow-visible">
                        <MappingInputBuilder
                          value={currentParts}
                          onChange={(newParts) => handleStepsMappingChange(field.key, newParts)}
                          excelColumns={fileData.stepsHeaders || []}
                          isMandatory={field.mandatory}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mandatoryFields.length > 0 && (
        <div className="mb-6 bg-purple-light border border-purple-200 rounded-lg p-4">
          <p className="text-purple-primary font-semibold mb-2">Mandatory Fields:</p>
          <p className="text-purple-800 text-sm">{mandatoryFields.map((f) => f.title || f.name).join(", ")}</p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 bg-white border border-purple-primary text-purple-primary hover:border-purple-medium hover:text-purple-medium disabled:opacity-50 disabled:cursor-not-allowed font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
        >
          Back
        </button>
        <button
          onClick={handleSaveMapping}
          className="flex-1 border border-purple-primary text-purple-primary hover:bg-blue-50 font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
        >
          Save
        </button>
        <button
          onClick={handleSaveAndImport}
          className="flex-1 bg-purple-primary hover:bg-purple-medium text-white font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
        >
          Save & Import
        </button>
      </div>
    </div>
  );
}
