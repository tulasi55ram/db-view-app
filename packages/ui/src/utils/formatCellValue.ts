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
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
    return { display: formatted, className: "cell-number", title: String(value) };
  }

  if (value instanceof Date) {
    const iso = value.toISOString();
    return { display: iso, className: "text-vscode-text", title: iso };
  }

  if (Array.isArray(value)) {
    const json = JSON.stringify(value);
    return {
      display: `[${value.length}]`,
      className: "cell-json",
      title: json
    };
  }

  if (typeof value === "object") {
    const json = JSON.stringify(value, null, 2);
    return {
      display: "{...}",
      className: "cell-json",
      title: json
    };
  }

  const str = String(value);
  const isLong = str.length > 100;
  return {
    display: isLong ? str.slice(0, 100) + "…" : str,
    className: "text-vscode-text",
    title: str
  };
}
