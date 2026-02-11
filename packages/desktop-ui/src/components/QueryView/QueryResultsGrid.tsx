import { type FC, useState, useRef, useEffect } from "react";
import { Download, Copy, Check, ChevronDown, Clock, Play, Database, Sparkles, Terminal, Table2 } from "lucide-react";
import { exportToCSV, exportToJSON, copyToClipboardAsTSV } from "@/utils/exportData";
import { toast } from "sonner";
import { CellValue } from "@/components/JsonCellViewer";
import { useVirtualizer } from "@tanstack/react-virtual";

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
  const parentRef = useRef<HTMLDivElement>(null);

  // Column widths state - initialize with default widths
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    columns.forEach(col => {
      widths[col] = 200; // Default width
    });
    return widths;
  });

  // Resizing state
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  // Update column widths when columns change
  useEffect(() => {
    setColumnWidths(prev => {
      const newWidths: Record<string, number> = {};
      columns.forEach(col => {
        newWidths[col] = prev[col] || 200; // Keep existing width or use default
      });
      return newWidths;
    });
  }, [columns]);

  // Handle column resize
  const handleResizeStart = (column: string, startX: number) => {
    setResizingColumn(column);
    resizeStartX.current = startX;
    resizeStartWidth.current = columnWidths[column];
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingColumn) return;

    const diff = e.clientX - resizeStartX.current;
    const newWidth = Math.max(100, resizeStartWidth.current + diff); // Min width 100px

    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth,
    }));
  };

  const handleResizeEnd = () => {
    setResizingColumn(null);
  };

  // Add/remove mouse event listeners for resizing
  useEffect(() => {
    if (resizingColumn) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);

      return () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingColumn, columnWidths]);

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

  // Virtualization setup - must be before early returns
  const ROW_HEIGHT = 33; // Height of each row in pixels

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10, // Render 10 extra rows above and below viewport for smooth scrolling
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <Database className="absolute inset-0 m-auto w-5 h-5 text-accent" />
          </div>
          <p className="text-text-primary font-medium mb-1">Executing Query</p>
          <p className="text-sm text-text-tertiary">Fetching results from database...</p>
        </div>
      </div>
    );
  }

  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary p-8">
        <div className="text-center max-w-md">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
            <Table2 className="w-8 h-8 text-accent" />
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Results</h3>
          <p className="text-sm text-text-secondary mb-6">
            Write a query above and press <kbd className="px-1.5 py-0.5 mx-1 rounded bg-bg-tertiary border border-border text-xs font-mono">⌘ Enter</kbd> to execute
          </p>

          {/* Quick Tips */}
          <div className="grid grid-cols-1 gap-3 text-left">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-bg-secondary border border-border">
              <div className="w-8 h-8 rounded-md bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Play className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Run Query</p>
                <p className="text-xs text-text-tertiary">Select text to run part of your query, or run the entire editor</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-bg-secondary border border-border">
              <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Smart Autocomplete</p>
                <p className="text-xs text-text-tertiary">Press <kbd className="px-1 py-0.5 rounded bg-bg-tertiary border border-border text-[10px] font-mono">Ctrl+Space</kbd> for table and column suggestions</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-bg-secondary border border-border">
              <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Terminal className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">SQL Snippets</p>
                <p className="text-xs text-text-tertiary">Type common keywords like SELECT, INSERT, JOIN for quick templates</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-bg-primary">
      {/* Status bar at top */}
      <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg-secondary text-xs text-text-secondary flex-shrink-0">
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

      {/* Virtualized table container */}
      <div ref={parentRef} className="flex-1 overflow-auto" style={{ contain: 'strict' }}>
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {/* Sticky header - positioned at top */}
          <div
            className="sticky top-0 bg-bg-tertiary border-b border-border z-20"
            style={{
              display: 'flex',
              width: '100%'
            }}
          >
            {/* Row number column header */}
            <div className="px-3 py-2 text-left font-medium text-text-secondary whitespace-nowrap border-r border-border text-sm" style={{ minWidth: '60px', maxWidth: '60px' }}>
              #
            </div>
            {/* Data column headers */}
            {columns.map((column) => (
              <div
                key={column}
                className="px-3 py-2 text-left font-medium text-text-primary whitespace-nowrap border-r border-border text-sm overflow-hidden relative group"
                style={{ width: `${columnWidths[column]}px`, flexShrink: 0 }}
              >
                <span className="truncate block">{column}</span>
                {/* Resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/50 group-hover:bg-accent/30"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleResizeStart(column, e.clientX);
                  }}
                  style={{
                    background: resizingColumn === column ? 'rgb(var(--accent) / 0.5)' : undefined,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Virtual rows */}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'flex',
                }}
                className="border-b border-border hover:bg-bg-hover transition-colors"
              >
                {/* Row number cell */}
                <div className="px-3 py-2 text-text-tertiary whitespace-nowrap font-mono text-xs border-r border-border flex items-center" style={{ minWidth: '60px', maxWidth: '60px' }}>
                  {virtualRow.index + 1}
                </div>
                {/* Data cells */}
                {columns.map((column) => (
                  <div
                    key={column}
                    className="px-3 py-2 whitespace-nowrap border-r border-border text-sm flex items-center overflow-hidden"
                    style={{ width: `${columnWidths[column]}px`, flexShrink: 0 }}
                  >
                    <div className="truncate w-full">
                      <CellValue value={row[column]} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
