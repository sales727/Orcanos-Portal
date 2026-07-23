export const IMPORTER_API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/importer`;

export interface MappingPart {
  type: "text" | "column";
  value: string;
}

export type FieldMapping = Record<string, MappingPart[]>;

export interface OrcanosField {
  name: string;
  ws_add_col_name: string;
  title?: string;
  is_mandatory?: string;
}

export interface ProjectConfig {
  project_name?: string;
  raw_project_name?: string;
  item_type: string;
  object_type_label?: string;
  project_id: number;
  major_version: number;
  minor_version: number;
  ver_id?: number | null;
  itemType?: string;
  projectId?: number;
  majorVersion?: number;
  minorVersion?: number;
}

export interface Credentials {
  domain: string;
  authType: "basic" | "apikey";
  username?: string;
  password?: string;
  apiKey?: string;
  headers: Record<string, string>;
}

export interface FileData {
  headers: string[];
  preview: Record<string, unknown>[];
  data: Record<string, unknown>[];
  totalRows: number;
  sheetNames: string[];
  stepsHeaders?: string[];
  stepsData?: Record<string, unknown>[];
}

export interface ImportResultRow {
  row: number;
  objectName: string;
  objectType: string;
  status: "pending" | "in-progress" | "added" | "updated" | "failed" | "skipped";
  objectId: number;
  error: string | null;
  stepsTotal?: number;
  stepsAdded?: number;
  stepsFailed?: number;
}
