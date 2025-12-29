/**
 * Import Parsers - Parse CSV and JSON files into table data
 */

export function parseCSV(
  content: string,
  hasHeaders: boolean = true
): {
  columns: string[];
  rows: Record<string, unknown>[];
} {
  const lines = content.split("\n").filter((line) => line.trim());

  if (lines.length === 0) {
    throw new Error("Empty CSV file");
  }

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  };

  const columns = hasHeaders
    ? parseCSVLine(lines[0])
    : Array.from({ length: parseCSVLine(lines[0]).length }, (_, i) => `column_${i + 1}`);

  const dataStartIndex = hasHeaders ? 1 : 0;
  const rows: Record<string, unknown>[] = [];

  for (let i = dataStartIndex; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, unknown> = {};

    columns.forEach((col, idx) => {
      const value = values[idx]?.trim();
      row[col] = value === "" ? null : value;
    });

    rows.push(row);
  }

  return { columns, rows };
}

export function parseJSON(content: string): {
  columns: string[];
  rows: Record<string, unknown>[];
} {
  const parsed = JSON.parse(content);

  if (!Array.isArray(parsed)) {
    throw new Error("JSON must be an array of objects");
  }

  if (parsed.length === 0) {
    throw new Error("Empty JSON array");
  }

  // Extract columns from first object
  const columns = Object.keys(parsed[0]);

  return { columns, rows: parsed };
}
