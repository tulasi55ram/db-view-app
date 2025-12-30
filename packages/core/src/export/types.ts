/**
 * Export/Import Type Definitions
 * @dbview/core - Phase 3: Export/Import
 */

/**
 * Options for CSV export
 */
export interface CsvExportOptions {
  /** Include column headers as first row (default: true) */
  includeHeaders?: boolean;
  /** Delimiter character (default: ',') */
  delimiter?: string;
  /** Line ending (default: '\n') */
  lineEnding?: string;
  /** Null value representation (default: '') */
  nullValue?: string;
}

/**
 * Options for JSON export
 */
export interface JsonExportOptions {
  /** Pretty print with indentation (default: true) */
  pretty?: boolean;
  /** Indentation spaces when pretty printing (default: 2) */
  indent?: number;
  /** Only include specified columns */
  columns?: string[];
}

/**
 * Options for SQL export
 */
export interface SqlExportOptions {
  /** Database type for syntax variations */
  dbType?: 'postgres' | 'mysql' | 'sqlite' | 'sqlserver';
  /** Schema name (optional, some DBs don't use schemas) */
  schema?: string;
  /** Table name (required) */
  table: string;
  /** Include column names in INSERT statements (default: true) */
  includeColumns?: boolean;
  /** Batch size for multi-row INSERT (default: 1, no batching) */
  batchSize?: number;
}

/**
 * Options for Markdown export
 */
export interface MarkdownExportOptions {
  /** Column alignment: 'left' | 'center' | 'right' (default: 'left') */
  alignment?: 'left' | 'center' | 'right' | Record<string, 'left' | 'center' | 'right'>;
  /** Maximum column width before truncation (default: no limit) */
  maxColumnWidth?: number;
  /** Null value representation (default: '') */
  nullValue?: string;
}

/**
 * Options for CSV import
 */
export interface CsvImportOptions {
  /** First row contains headers (default: true) */
  hasHeaders?: boolean;
  /** Delimiter character (default: ',') */
  delimiter?: string;
  /** Skip empty lines (default: true) */
  skipEmptyLines?: boolean;
  /** Trim whitespace from values (default: true) */
  trimValues?: boolean;
}

/**
 * Options for JSON import
 */
export interface JsonImportOptions {
  /** Property path if data is nested (e.g., 'data.results') */
  dataPath?: string;
}

/**
 * Result of import parsing
 */
export interface ImportResult {
  /** Detected column names */
  columns: string[];
  /** Parsed data rows */
  rows: Record<string, unknown>[];
  /** Number of rows parsed */
  rowCount: number;
  /** Any warnings during parsing */
  warnings?: string[];
}

/**
 * Export format types
 */
export type ExportFormat = 'csv' | 'json' | 'sql' | 'markdown';

/**
 * Generic row data type
 */
export type RowData = Record<string, unknown>;
