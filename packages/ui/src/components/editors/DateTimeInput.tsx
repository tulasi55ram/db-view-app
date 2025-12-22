import { type FC, useState, useEffect, useRef } from "react";
import type { PostgreSQLType } from "@dbview/core";

export interface DateTimeInputProps {
  value: unknown;
  columnType: PostgreSQLType;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export const DateTimeInput: FC<DateTimeInputProps> = ({
  value,
  columnType,
  onSave,
  onCancel
}) => {
  const [editValue, setEditValue] = useState(() => {
    if (!value) return "";
    const dateStr = String(value);

    // Convert PostgreSQL timestamp to HTML5 datetime-local format
    if (columnType.includes("timestamp")) {
      // PostgreSQL: "2024-01-15 10:30:45" or "2024-01-15 10:30:45.123456"
      // HTML5 datetime-local supports: "2024-01-15T10:30:45"
      // Remove timezone info if present
      const cleanStr = dateStr.split('+')[0].split('-').slice(0, 3).join('-') + dateStr.split('+')[0].split('-').slice(3).join('-');
      return cleanStr.replace(" ", "T").slice(0, 19); // Keep seconds
    } else if (columnType === "date") {
      // PostgreSQL: "2024-01-15" -> HTML5: "2024-01-15"
      return dateStr.slice(0, 10);
    } else if (columnType.includes("time")) {
      // PostgreSQL: "10:30:45" -> HTML5: "10:30:45"
      // Remove timezone info if present
      const timeStr = dateStr.split('+')[0].split('-')[0];
      return timeStr.slice(0, 8); // Keep seconds
    }
    return dateStr;
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSave = () => {
    if (!editValue) {
      onSave("");
      return;
    }

    // Convert HTML5 format back to PostgreSQL format
    let pgValue = editValue;
    if (columnType.includes("timestamp") && editValue.includes("T")) {
      // HTML5: "2024-01-15T10:30:45" -> PostgreSQL: "2024-01-15 10:30:45"
      // If seconds are missing, append ":00"
      pgValue = editValue.replace("T", " ");
      const parts = pgValue.split(':');
      if (parts.length === 2) {
        pgValue += ":00"; // Only add seconds if missing
      }
    }

    onSave(pgValue);
  };

  // Use datetime-local for timestamp, date for date, time for time
  // Note: HTML5 time and datetime-local inputs support seconds with step="1"
  const inputType = columnType.includes("timestamp")
    ? "datetime-local"
    : columnType === "date"
    ? "date"
    : columnType.includes("time")
    ? "time"
    : "text";

  const step = columnType.includes("time") || columnType.includes("timestamp") ? "1" : undefined;

  return (
    <input
      ref={inputRef}
      type={inputType}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSave}
      step={step}
      className="w-full h-full px-2 py-1 bg-vscode-bg-lighter border-2 border-vscode-accent outline-none text-sm"
    />
  );
};
