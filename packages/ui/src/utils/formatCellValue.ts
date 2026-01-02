export interface FormattedValue {
  display: string;
  className: string;
  title?: string;
}

export function formatCellValue(value: unknown): FormattedValue {
  if (value === null) {
    return { display: "NULL", className: "cell-null", title: "NULL" };
  }

  if (value === undefined) {
    return { display: "—", className: "text-vscode-text-muted", title: "undefined" };
  }

  if (typeof value === "boolean") {
    return {
      display: value ? "true" : "false",
      className: value ? "cell-boolean" : "cell-boolean opacity-70",
      title: String(value)
    };
  }

  if (typeof value === "number") {
    // Display full precision - no rounding or truncation
    return { display: String(value), className: "cell-number", title: String(value) };
  }

  if (value instanceof Date) {
    const iso = value.toISOString();
    return { display: iso, className: "text-vscode-text", title: iso };
  }

  if (Array.isArray(value)) {
    // Display actual array content as JSON (no data hiding)
    const json = JSON.stringify(value);
    return {
      display: json,
      className: "cell-json",
      title: json
    };
  }

  if (typeof value === "object") {
    // Display actual object content as JSON (no data hiding)
    // Use compact format for display (no pretty-printing with indents)
    const json = JSON.stringify(value);
    return {
      display: json,
      className: "cell-json",
      title: json
    };
  }

  // Display full string value - no truncation
  const str = String(value);
  return {
    display: str,
    className: "text-vscode-text",
    title: str
  };
}
