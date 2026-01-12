import { type FC, useState, useRef, useEffect } from "react";
import { Download, Copy, Check, ChevronDown, Clock } from "lucide-react";
import { exportToCSV, exportToJSON, copyToClipboardAsTSV } from "@/utils/exportData";
import { toast } from "sonner";
import { CellValue } from "@/components/JsonCellViewer";

export interface QueryResultsGridProps {
  columns: string[];
  rows: Record<string, unknown>[];
  loading?: boolean;
  executionTime?: number; // in milliseconds
}

// Format execution time for display
function formatExecutionTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

export const QueryResultsGrid: FC<QueryResultsGridProps> = ({ columns, rows, loading = false, executionTime }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExportCSV = () => {
    exportToCSV({ columns, rows, filename: `query_results_${Date.now()}` });
    toast.success("Exported to CSV");
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    exportToJSON({ columns, rows, filename: `query_results_${Date.now()}` });
    toast.success("Exported to JSON");
    setShowExportMenu(false);
  };

  const handleCopyToClipboard = async () => {
    const success = await copyToClipboardAsTSV({ columns, rows });
    if (success) {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Failed to copy");
    }
    setShowExportMenu(false);
  };
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-secondary">
          <div className="h-8 w-8 mx-auto mb-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p>Executing query...</p>
        </div>
      </div>
    );
  }

  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary">
        <div className="text-center">
          <p className="text-lg mb-2">No Results</p>
          <p className="text-sm text-text-tertiary">Query returned no data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-bg-primary">
      {/* Status bar at top */}
      <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-secondary text-xs text-text-secondary">
        <div className="flex items-center gap-4">
          <span className="font-medium">
            {rows.length.toLocaleString()} {rows.length === 1 ? "row" : "rows"} returned
          </span>
          {executionTime !== undefined && (
            <span className="flex items-center gap-1 text-text-tertiary">
              <Clock className="w-3 h-3" />
              {formatExecutionTime(executionTime)}
            </span>
          )}
        </div>

        {/* Export dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-bg-secondary border border-border rounded-lg shadow-lg z-50 py-1">
              <button
                onClick={handleExportCSV}
                className="w-full px-3 py-2 text-left text-sm hover:bg-bg-hover flex items-center gap-2 text-text-primary"
              >
                <Download className="w-4 h-4 text-text-tertiary" />
                Export as CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full px-3 py-2 text-left text-sm hover:bg-bg-hover flex items-center gap-2 text-text-primary"
              >
                <Download className="w-4 h-4 text-text-tertiary" />
                Export as JSON
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={handleCopyToClipboard}
                className="w-full px-3 py-2 text-left text-sm hover:bg-bg-hover flex items-center gap-2 text-text-primary"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4 text-text-tertiary" />
                )}
                Copy to Clipboard
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Simple non-virtualized table (for debugging) */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          {/* Sticky header */}
          <thead className="sticky top-0 bg-bg-tertiary border-b border-border z-10">
            <tr>
              {/* Row number column */}
              <th className="px-3 py-2 text-left font-medium text-text-secondary whitespace-nowrap w-12 border-r border-border">#</th>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 text-left font-medium text-text-primary whitespace-nowrap border-r border-border">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-border hover:bg-bg-hover transition-colors">
                {/* Row number */}
                <td className="px-3 py-2 text-text-tertiary whitespace-nowrap font-mono text-xs w-12 border-r border-border">
                  {index + 1}
                </td>
                {columns.map((column) => (
                  <td
                    key={column}
                    className="px-3 py-2 whitespace-nowrap border-r border-border"
                  >
                    <CellValue value={row[column]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
