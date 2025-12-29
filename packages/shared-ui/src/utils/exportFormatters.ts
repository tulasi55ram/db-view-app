/**
 * Export Formatters - Convert table data to CSV, JSON, and SQL formats
 */

export type ExportFormat = "csv" | "json" | "sql";

export function formatAsCSV(
  rows: Record<string, unknown>[],
  columns: string[],
  includeHeaders: boolean = true
): string {
  const lines: string[] = [];

  // Add header row
  if (includeHeaders) {
    lines.push(columns.map(escapeCSVField).join(","));
  }

  // Add data rows
  for (const row of rows) {
    const values = columns.map((col) => {
      const value = row[col];
      return escapeCSVField(formatValue(value));
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

export function formatAsJSON(rows: Record<string, unknown>[]): string {
  return JSON.stringify(rows, null, 2);
}

export function formatAsSQL(
  rows: Record<string, unknown>[],
  columns: string[],
  schema: string,
  table: string
): string {
  const statements: string[] = [];
  const quotedTable = `"${schema}"."${table}"`;

  for (const row of rows) {
    const cols = columns.filter((col) => row[col] !== undefined);
    const quotedCols = cols.map((c) => `"${c}"`).join(", ");
    const values = cols.map((col) => formatSQLValue(row[col])).join(", ");

    statements.push(`INSERT INTO ${quotedTable} (${quotedCols}) VALUES (${values});`);
  }

  return statements.join("\n");
}

function escapeCSVField(value: string): string {
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatSQLValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}
