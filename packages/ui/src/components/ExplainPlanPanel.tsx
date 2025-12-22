import { type FC, useState } from "react";
import type { ExplainPlan, ExplainNode } from "@dbview/core";
import {
  X,
  ChevronRight,
  ChevronDown,
  Clock,
  DollarSign,
  Database,
  AlertTriangle,
  Info,
  Layers
} from "lucide-react";
import clsx from "clsx";

export interface ExplainPlanPanelProps {
  isOpen: boolean;
  onClose: () => void;
  plan: ExplainPlan | null;
  loading?: boolean;
  error?: string;
}

export const ExplainPlanPanel: FC<ExplainPlanPanelProps> = ({
  isOpen,
  onClose,
  plan,
  loading = false,
  error
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[500px] bg-vscode-bg-light border-l border-vscode-border shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-vscode-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-vscode-accent" />
            <h2 className="text-sm font-semibold text-vscode-text">Query Execution Plan</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-vscode-text-muted hover:bg-vscode-bg-hover transition-colors"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading && <LoadingState />}
          {error && <ErrorState error={error} />}
          {!loading && !error && plan && <PlanContent plan={plan} />}
          {!loading && !error && !plan && <EmptyState />}
        </div>
      </div>
    </>
  );
};

// Loading state
const LoadingState: FC = () => (
  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-vscode-accent border-t-transparent mb-4" />
    <p className="text-sm text-vscode-text-muted">Analyzing query execution...</p>
  </div>
);

// Error state
const ErrorState: FC<{ error: string }> = ({ error }) => (
  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
    <div className="rounded-full bg-vscode-error/10 p-3 mb-4">
      <AlertTriangle className="h-6 w-6 text-vscode-error" />
    </div>
    <p className="text-sm font-medium text-vscode-text mb-2">Failed to analyze query</p>
    <p className="text-xs text-vscode-text-muted max-w-md">{error}</p>
  </div>
);

// Empty state
const EmptyState: FC = () => (
  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
    <div className="rounded-full bg-vscode-bg-lighter p-3 mb-4">
      <Info className="h-6 w-6 text-vscode-text-muted" />
    </div>
    <p className="text-sm font-medium text-vscode-text mb-2">No execution plan</p>
    <p className="text-xs text-vscode-text-muted max-w-md">
      Click "Explain" to analyze query performance
    </p>
  </div>
);

// Plan content
const PlanContent: FC<{ plan: ExplainPlan }> = ({ plan }) => {
  const totalTime = plan['Execution Time'];
  const planningTime = plan['Planning Time'];
  const totalCost = plan.Plan['Total Cost'];

  return (
    <div className="p-4 space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Execution Time"
          value={formatTime(totalTime)}
          color="text-vscode-accent"
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Total Cost"
          value={totalCost.toFixed(2)}
          color="text-vscode-warning"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Planning Time"
          value={formatTime(planningTime)}
          color="text-vscode-text-muted"
        />
        <StatCard
          icon={<Database className="h-4 w-4" />}
          label="Est. Rows"
          value={formatNumber(plan.Plan['Plan Rows'])}
          color="text-vscode-text-muted"
        />
      </div>

      {/* Performance Insights */}
      <PerformanceInsights node={plan.Plan} totalTime={totalTime} />

      {/* Execution Plan Tree */}
      <div className="border-t border-vscode-border pt-4">
        <h3 className="text-xs font-semibold text-vscode-text mb-3 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5" />
          Execution Plan
        </h3>
        <PlanNodeTree node={plan.Plan} depth={0} totalTime={totalTime} />
      </div>
    </div>
  );
};

// Stat card component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

const StatCard: FC<StatCardProps> = ({ icon, label, value, color }) => (
  <div className="rounded border border-vscode-border bg-vscode-bg p-3">
    <div className={clsx("flex items-center gap-1.5 mb-1", color)}>
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </div>
    <div className="text-lg font-semibold text-vscode-text">{value}</div>
  </div>
);

// Performance insights
const PerformanceInsights: FC<{ node: ExplainNode; totalTime: number }> = ({ node, totalTime }) => {
  const insights: Array<{ type: 'warning' | 'info'; message: string }> = [];

  // Check for sequential scans on large tables
  if (node['Node Type'] === 'Seq Scan' && node['Plan Rows'] > 10000) {
    insights.push({
      type: 'warning',
      message: `Sequential scan on large table (${formatNumber(node['Plan Rows'])} rows). Consider adding an index.`
    });
  }

  // Check for high cost sorts
  if (node['Node Type']?.includes('Sort') && node['Total Cost'] > 1000) {
    insights.push({
      type: 'warning',
      message: 'High cost sort operation. Try reducing rows before sorting or add appropriate indexes.'
    });
  }

  // Check for rows removed by filter
  if (node['Rows Removed by Filter'] && node['Rows Removed by Filter'] > 1000) {
    const percentRemoved = (node['Rows Removed by Filter'] / (node['Actual Rows'] || 1 + node['Rows Removed by Filter'])) * 100;
    if (percentRemoved > 50) {
      insights.push({
        type: 'warning',
        message: `${percentRemoved.toFixed(0)}% of rows removed by filter. Refine WHERE clause or add index.`
      });
    }
  }

  // Check nested loops
  if (node['Node Type'] === 'Nested Loop' && node['Actual Loops'] && node['Actual Loops'] > 100) {
    insights.push({
      type: 'info',
      message: `Nested loop executed ${formatNumber(node['Actual Loops'])} times. Consider hash join for better performance.`
    });
  }

  // Recursively check child plans
  if (node.Plans) {
    node.Plans.forEach(childNode => {
      const childInsights = getNodeInsights(childNode);
      insights.push(...childInsights);
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: 'info',
      message: 'No performance issues detected. Query appears well-optimized.'
    });
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-vscode-text flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        Performance Insights
      </h3>
      {insights.map((insight, i) => (
        <div
          key={i}
          className={clsx(
            "rounded border p-2 text-xs",
            insight.type === 'warning'
              ? "border-vscode-warning/30 bg-vscode-warning/5 text-vscode-warning"
              : "border-vscode-accent/30 bg-vscode-accent/5 text-vscode-accent"
          )}
        >
          <div className="flex items-start gap-2">
            {insight.type === 'warning' ? (
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            ) : (
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            )}
            <span>{insight.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Helper function to get insights from a node
function getNodeInsights(node: ExplainNode): Array<{ type: 'warning' | 'info'; message: string }> {
  const insights: Array<{ type: 'warning' | 'info'; message: string }> = [];

  if (node['Node Type'] === 'Seq Scan' && node['Plan Rows'] > 10000) {
    insights.push({
      type: 'warning',
      message: `Sequential scan on large table (${formatNumber(node['Plan Rows'])} rows)`
    });
  }

  if (node.Plans) {
    node.Plans.forEach(childNode => {
      insights.push(...getNodeInsights(childNode));
    });
  }

  return insights;
}

// Plan node tree
interface PlanNodeTreeProps {
  node: ExplainNode;
  depth: number;
  totalTime: number;
}

const PlanNodeTree: FC<PlanNodeTreeProps> = ({ node, depth, totalTime }) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto-expand first 2 levels

  const hasChildren = node.Plans && node.Plans.length > 0;
  const actualTime = node['Actual Total Time'] || 0;
  const timePercent = totalTime > 0 ? (actualTime / totalTime) * 100 : 0;

  // Determine node color based on time percentage
  const getTimeColor = (percent: number) => {
    if (percent > 50) return 'text-red-500';
    if (percent > 25) return 'text-orange-500';
    if (percent > 10) return 'text-yellow-500';
    return 'text-vscode-text-muted';
  };

  return (
    <div className="text-xs">
      {/* Node header */}
      <div
        className={clsx(
          "flex items-start gap-2 py-1.5 px-2 rounded hover:bg-vscode-bg-hover transition-colors",
          depth > 0 && "ml-6"
        )}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 text-vscode-text-muted hover:text-vscode-text transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}

        {/* Node info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-vscode-text">{node['Node Type']}</span>
            {actualTime > 0 && (
              <span className={clsx("text-2xs font-medium", getTimeColor(timePercent))}>
                {formatTime(actualTime)} ({timePercent.toFixed(1)}%)
              </span>
            )}
          </div>

          {/* Node details */}
          <div className="space-y-0.5 text-vscode-text-muted">
            <div className="flex items-center gap-4">
              <span>Cost: {node['Total Cost'].toFixed(2)}</span>
              <span>Rows: {formatNumber(node['Actual Rows'] || node['Plan Rows'])}</span>
              {node['Actual Loops'] && node['Actual Loops'] > 1 && (
                <span>Loops: {formatNumber(node['Actual Loops'])}</span>
              )}
            </div>

            {/* Filter info */}
            {node['Filter'] && (
              <div className="text-2xs">
                <span className="text-vscode-warning">Filter:</span> {node['Filter']}
              </div>
            )}

            {/* Rows removed by filter */}
            {node['Rows Removed by Filter'] && (
              <div className="text-2xs text-vscode-error">
                Rows removed: {formatNumber(node['Rows Removed by Filter'])}
              </div>
            )}

            {/* Relation name (table) */}
            {node['Relation Name'] && (
              <div className="text-2xs">
                <span className="text-vscode-accent">Table:</span> {node['Relation Name']}
                {node['Alias'] && node['Alias'] !== node['Relation Name'] && (
                  <span> (as {node['Alias']})</span>
                )}
              </div>
            )}

            {/* Index info */}
            {node['Index Name'] && (
              <div className="text-2xs">
                <span className="text-green-500">Index:</span> {node['Index Name']}
              </div>
            )}

            {/* Join type */}
            {node['Join Type'] && (
              <div className="text-2xs">
                <span>Join Type:</span> {node['Join Type']}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Child nodes */}
      {hasChildren && isExpanded && (
        <div className="mt-1">
          {node.Plans!.map((childNode, i) => (
            <PlanNodeTree
              key={i}
              node={childNode}
              depth={depth + 1}
              totalTime={totalTime}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Utility functions
function formatTime(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatNumber(num: number): string {
  if (num < 1000) return num.toFixed(0);
  if (num < 1000000) return `${(num / 1000).toFixed(1)}k`;
  return `${(num / 1000000).toFixed(1)}M`;
}
