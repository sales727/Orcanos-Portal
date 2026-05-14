export type ToolStatus = "available" | "coming-soon";

export interface Tool {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  status: ToolStatus;
  requiredInputs: string;
  expectedOutput: string;
  avgDuration: string;
  lastRun?: string;
}

export const tools: Tool[] = [
  {
    id: "dms-uploader",
    slug: "dms-uploader",
    name: "DMS Uploader",
    description:
      "Compare files against live Orcanos DMS data and batch-upload new revisions or create new records.",
    icon: "FileText",
    category: "DMS",
    tags: ["DMS", "Upload", "API"],
    status: "available",
    requiredInputs: "PDF and DOCX files",
    expectedOutput: "Updated DMS records in Orcanos",
    avgDuration: "2–5 minutes",
  },
  {
    id: "work-item-inspector",
    slug: "work-item-inspector",
    name: "Work Item Inspector",
    description:
      "Retrieve any Orcanos work item by ID and get a structured summary with diagnostic flags.",
    icon: "Search",
    category: "ALM",
    tags: ["ALM", "Inspect", "API"],
    status: "coming-soon",
    requiredInputs: "Item ID or key",
    expectedOutput: "Structured item summary",
    avgDuration: "< 1 minute",
  },
  {
    id: "sc-summarizer",
    slug: "sc-summarizer",
    name: "SC Summarizer",
    description:
      "Convert a raw Service Call discussion into a structured technical summary with classification.",
    icon: "MessageSquare",
    category: "Support",
    tags: ["Support", "SC", "AI"],
    status: "coming-soon",
    requiredInputs: "SC discussion text",
    expectedOutput: "Structured summary + classification",
    avgDuration: "< 1 minute",
  },
  {
    id: "permission-checker",
    slug: "permission-checker",
    name: "Permission Checker",
    description:
      "Diagnose user access issues — group membership, project access, and routing notifications.",
    icon: "Shield",
    category: "Admin",
    tags: ["Admin", "Permissions", "API"],
    status: "coming-soon",
    requiredInputs: "User email + account",
    expectedOutput: "Access diagnostic report",
    avgDuration: "< 1 minute",
  },
  {
    id: "api-call-analyzer",
    slug: "api-call-analyzer",
    name: "API Call Analyzer",
    description:
      "Paste a failed Orcanos API call and get root-cause analysis plus a corrected payload.",
    icon: "Terminal",
    category: "Dev",
    tags: ["API", "Debug", "AI"],
    status: "coming-soon",
    requiredInputs: "Endpoint + payload + response",
    expectedOutput: "Root cause + corrected payload",
    avgDuration: "< 1 minute",
  },
  {
    id: "filter-assistant",
    slug: "filter-assistant",
    name: "Filter Assistant",
    description:
      "Debug filters, embedded filters, and dashboards — scope, version context, and query conditions.",
    icon: "Filter",
    category: "ALM",
    tags: ["Filters", "Debug", "API"],
    status: "coming-soon",
    requiredInputs: "Filter ID + account",
    expectedOutput: "Filter diagnostic report",
    avgDuration: "1–2 minutes",
  },
];

export const categories = ["All", ...Array.from(new Set(tools.map((t) => t.category)))];
