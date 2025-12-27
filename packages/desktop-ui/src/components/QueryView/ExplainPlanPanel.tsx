import { memo, useState, useCallback } from "react";
import {
  X,
  ChevronRight,
  ChevronDown,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Database,
  ArrowRight,
  BarChart3,
  Zap,
} from "lucide-react";
import { cn } from "@/utils/cn";
import type { ExplainPlan, ExplainNode } from "@dbview/types";

interface ExplainPlanPanelProps {
  open: boolean;
  onClose: () => void;
  plan: ExplainPlan | null;
  loading?: boolean;
  error?: string;
}

// Node type colors and icons
const NODE_TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  "Seq Scan": { color: "text-orange-400", icon: <Database className="w-3.5 h-3.5" /> },
  "Index Scan": { color: "text-green-400", icon: <Zap className="w-3.5 h-3.5" /> },
  "Index Only Scan": { color: "text-emerald-400", icon: <Zap className="w-3.5 h-3.5" /> },
  "Bitmap Heap Scan": { color: "text-yellow-400", icon: <Layers className="w-3.5 h-3.5" /> },
  "Bitmap Index Scan": { color: "text-yellow-400", icon: <Layers className="w-3.5 h-3.5" /> },
  "Nested Loop": { color: "text-blue-400", icon: <ArrowRight className="w-3.5 h-3.5" /> },
  "Hash Join": { color: "text-purple-400", icon: <ArrowRight className="w-3.5 h-3.5" /> },
  "Merge Join": { color: "text-indigo-400", icon: <ArrowRight className="w-3.5 h-3.5" /> },
  "Sort": { color: "text-cyan-400", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  "Aggregate": { color: "text-pink-400", icon: <Activity className="w-3.5 h-3.5" /> },
  "Group": { color: "text-pink-400", icon: <Activity className="w-3.5 h-3.5" /> },
  "Limit": { color: "text-gray-400", icon: <ChevronRight className="w-3.5 h-3.5" /> },
  "Result": { color: "text-gray-400", icon: <ChevronRight className="w-3.5 h-3.5" /> },
  "Hash": { color: "text-violet-400", icon: <Layers className="w-3.5 h-3.5" /> },
  "Materialize": { color: "text-teal-400", icon: <Database className="w-3.5 h-3.5" /> },
  "CTE Scan": { color: "text-amber-400", icon: <Database className="w-3.5 h-3.5" /> },
  "Subquery Scan": { color: "text-amber-400", icon: <Database className="w-3.5 h-3.5" /> },
};

// Get node config with fallback
function getNodeConfig(nodeType: string) {
  return NODE_TYPE_CONFIG[nodeType] || { color: "text-text-secondary", icon: <ChevronRight className="w-3.5 h-3.5" /> };
}

// Format duration in ms
function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)} μs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

// Format row count
function formatRows(rows: number): string {
  if (rows >= 1000000) return `${(rows / 1000000).toFixed(1)}M`;
  if (rows >= 1000) return `${(rows / 1000).toFixed(1)}K`;
  return rows.toString();
}

// Calculate the percentage of total time this node represents
function getTimePercentage(node: ExplainNode, totalTime: number): number {
  const nodeTime = node["Actual Total Time"] || node["Total Cost"] || 0;
  return totalTime > 0 ? (nodeTime / totalTime) * 100 : 0;
}

// Check for performance warnings
function getWarnings(node: ExplainNode): string[] {
  const warnings: string[] = [];

  // Sequential scan on large table
  if (node["Node Type"] === "Seq Scan" && (node["Actual Rows"] || node["Plan Rows"]) > 10000) {
    warnings.push("Sequential scan on large table - consider adding an index");
  }

  // Many rows removed by filter
  if (node["Rows Removed by Filter"] && node["Rows Removed by Filter"] > (node["Actual Rows"] || 0) * 10) {
    warnings.push(`High filter rejection ratio (${formatRows(node["Rows Removed by Filter"])} rows removed)`);
  }

  // Nested loop with many iterations
  if (node["Node Type"] === "Nested Loop" && (node["Actual Loops"] || 1) > 1000) {
    warnings.push(`Nested loop executed ${formatRows(node["Actual Loops"] || 0)} times`);
  }

  // Row estimate mismatch
  if (node["Actual Rows"] !== undefined && node["Plan Rows"]) {
    const ratio = node["Actual Rows"] / node["Plan Rows"];
    if (ratio > 10 || ratio < 0.1) {
      warnings.push(`Row estimate mismatch: planned ${formatRows(node["Plan Rows"])}, actual ${formatRows(node["Actual Rows"])}`);
    }
  }

  return warnings;
}

// Recursive node component
const PlanNode = memo(function PlanNode({
  node,
  totalTime,
  depth = 0,
  isLast = false,
}: {
  node: ExplainNode;
  totalTime: number;
  depth?: number;
  isLast?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.Plans && node.Plans.length > 0;
  const config = getNodeConfig(node["Node Type"]);
  const warnings = getWarnings(node);
  const timePercent = getTimePercentage(node, totalTime);

  const actualTime = node["Actual Total Time"];
  const planRows = node["Plan Rows"];
  const actualRows = node["Actual Rows"];
  const actualLoops = node["Actual Loops"];

  return (
    <div className="relative">
      {/* Connector lines */}
      {depth > 0 && (
        <>
          {/* Vertical line from parent */}
          <div
            className="absolute left-0 top-0 w-px bg-border"
            style={{
              left: (depth - 1) * 24 + 11,
              height: isLast ? 14 : "100%",
            }}
          />
          {/* Horizontal line to node */}
          <div
            className="absolute h-px bg-border"
            style={{
              left: (depth - 1) * 24 + 11,
              top: 14,
              width: 12,
            }}
          />
        </>
      )}

      {/* Node content */}
      <div
        className="flex items-start gap-2 py-1.5 pr-2 rounded hover:bg-bg-hover/50 transition-colors cursor-pointer group"
        style={{ paddingLeft: depth * 24 + 8 }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {/* Expand/collapse icon */}
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
            )
          ) : null}
        </div>

        {/* Node type icon */}
        <div className={cn("flex-shrink-0 mt-0.5", config.color)}>
          {config.icon}
        </div>

        {/* Node info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Node type */}
            <span className={cn("text-xs font-medium", config.color)}>
              {node["Node Type"]}
            </span>

            {/* Relation/Index name */}
            {node["Relation Name"] && (
              <span className="text-xs text-text-secondary">
                on <span className="text-text-primary">{node["Relation Name"]}</span>
              </span>
            )}
            {node["Index Name"] && (
              <span className="text-xs text-text-secondary">
                using <span className="text-accent">{node["Index Name"]}</span>
              </span>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <span className="flex items-center gap-1 text-orange-400" title={warnings.join("\n")}>
                <AlertTriangle className="w-3 h-3" />
              </span>
            )}
          </div>

          {/* Metrics row */}
          <div className="flex items-center gap-3 mt-1 text-[10px] text-text-tertiary flex-wrap">
            {/* Time */}
            {actualTime !== undefined && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(actualTime)}
                {actualLoops && actualLoops > 1 && (
                  <span className="text-text-tertiary/70">×{actualLoops}</span>
                )}
              </span>
            )}

            {/* Rows */}
            {(actualRows !== undefined || planRows !== undefined) && (
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {actualRows !== undefined ? formatRows(actualRows) : formatRows(planRows)} rows
              </span>
            )}

            {/* Cost */}
            {node["Total Cost"] !== undefined && (
              <span>Cost: {node["Total Cost"].toFixed(2)}</span>
            )}

            {/* Time percentage bar */}
            {timePercent > 1 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      timePercent > 50 ? "bg-error" : timePercent > 25 ? "bg-orange-400" : "bg-accent"
                    )}
                    style={{ width: `${Math.min(100, timePercent)}%` }}
                  />
                </div>
                <span className={cn(
                  timePercent > 50 ? "text-error" : timePercent > 25 ? "text-orange-400" : "text-accent"
                )}>
                  {timePercent.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Filter condition */}
          {node["Filter"] && (
            <div className="mt-1 text-[10px] text-text-tertiary font-mono truncate" title={node["Filter"]}>
              Filter: {node["Filter"]}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.Plans!.map((child, i) => (
            <PlanNode
              key={i}
              node={child}
              totalTime={totalTime}
              depth={depth + 1}
              isLast={i === node.Plans!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export const ExplainPlanPanel = memo(function ExplainPlanPanel({
  open,
  onClose,
  plan,
  loading,
  error,
}: ExplainPlanPanelProps) {
  if (!open) return null;

  const totalTime = plan?.["Execution Time"] || plan?.Plan?.["Actual Total Time"] || plan?.Plan?.["Total Cost"] || 0;

  // Count warnings across all nodes
  const countWarnings = useCallback((node: ExplainNode): number => {
    let count = getWarnings(node).length;
    if (node.Plans) {
      count += node.Plans.reduce((acc, child) => acc + countWarnings(child), 0);
    }
    return count;
  }, []);

  const warningCount = plan ? countWarnings(plan.Plan) : 0;

  return (
    <div className="flex flex-col h-full bg-bg-primary border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Query Execution Plan</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">
            <Activity className="w-4 h-4 animate-pulse mr-2" />
            Analyzing query...
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-error/10 border border-error/20">
              <AlertTriangle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-error">Failed to analyze query</p>
                <p className="text-xs text-error/80 mt-1">{error}</p>
              </div>
            </div>
          </div>
        ) : !plan ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <Activity className="w-8 h-8 text-text-tertiary mb-2" />
            <p className="text-sm text-text-secondary">No execution plan</p>
            <p className="text-xs text-text-tertiary mt-1">
              Click "Explain" to analyze your query
            </p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="px-4 py-3 border-b border-border bg-bg-secondary/50">
              <div className="flex items-center gap-6 text-xs">
                {/* Planning Time */}
                {plan["Planning Time"] !== undefined && (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-accent/10">
                      <Clock className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div>
                      <p className="text-text-tertiary">Planning</p>
                      <p className="font-medium text-text-primary">{formatDuration(plan["Planning Time"])}</p>
                    </div>
                  </div>
                )}

                {/* Execution Time */}
                {plan["Execution Time"] !== undefined && (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-green-500/10">
                      <Zap className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-text-tertiary">Execution</p>
                      <p className="font-medium text-text-primary">{formatDuration(plan["Execution Time"])}</p>
                    </div>
                  </div>
                )}

                {/* Total Cost */}
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-purple-500/10">
                    <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-text-tertiary">Total Cost</p>
                    <p className="font-medium text-text-primary">{plan.Plan["Total Cost"].toFixed(2)}</p>
                  </div>
                </div>

                {/* Warnings */}
                {warningCount > 0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <div className="p-1.5 rounded bg-orange-500/10">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-text-tertiary">Warnings</p>
                      <p className="font-medium text-orange-400">{warningCount}</p>
                    </div>
                  </div>
                )}

                {warningCount === 0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <div className="p-1.5 rounded bg-green-500/10">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-text-tertiary">Status</p>
                      <p className="font-medium text-green-400">Optimal</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Plan Tree */}
            <div className="p-2">
              <PlanNode node={plan.Plan} totalTime={totalTime} />
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-border bg-bg-secondary/50">
        <div className="flex items-center gap-4 text-[10px] text-text-tertiary flex-wrap">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            Index Scan
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            Seq Scan
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            Joins
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            Aggregates
          </span>
        </div>
      </div>
    </div>
  );
});
