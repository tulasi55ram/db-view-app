import { type FC, useState } from "react";
import { ChevronRight, Copy, Check } from "lucide-react";
import type { DatabaseType } from "@dbview/types";
import {
  MONGO_COMMANDS,
  ES_COMMANDS,
  CASSANDRA_COMMANDS,
} from "../constants";

interface DocumentReferencePanelProps {
  dbType: DatabaseType;
  onInsertExample: (example: string) => void;
}

// Get commands based on database type
function getCommands(dbType: DatabaseType): Record<string, { name: string; desc: string; example: string }[]> {
  switch (dbType) {
    case 'mongodb':
      return MONGO_COMMANDS;
    case 'elasticsearch':
      return ES_COMMANDS;
    case 'cassandra':
      return CASSANDRA_COMMANDS;
    default:
      return {};
  }
}

// Get category labels for each database
function getCategoryLabels(dbType: DatabaseType): Record<string, string> {
  switch (dbType) {
    case 'mongodb':
      return {
        examples: 'Examples',
        stages: 'Aggregation Stages',
        comparison: 'Comparison',
        logical: 'Logical',
        element: 'Element',
        evaluation: 'Evaluation',
        array: 'Array',
        accumulators: 'Accumulators',
        dateOps: 'Date Operations',
        stringOps: 'String Operations',
        mathOps: 'Math Operations',
        conditional: 'Conditional',
        update: 'Update Operators',
      };
    case 'elasticsearch':
      return {
        examples: 'Examples',
        fullText: 'Full-Text Queries',
        termLevel: 'Term-Level Queries',
        compound: 'Compound Queries',
        nested: 'Nested/Join Queries',
        metricAggs: 'Metric Aggregations',
        bucketAggs: 'Bucket Aggregations',
        sorting: 'Sorting & Pagination',
        highlight: 'Highlighting',
        suggest: 'Suggestions',
        geo: 'Geo Queries',
        source: 'Source Filtering',
      };
    case 'cassandra':
      return {
        examples: 'Examples',
        select: 'SELECT Queries',
        insert: 'INSERT Queries',
        update: 'UPDATE Queries',
        delete: 'DELETE Queries',
        ddl: 'DDL (Schema)',
        collections: 'Collections',
        functions: 'Functions',
        aggregates: 'Aggregates',
        batch: 'Batch Operations',
        admin: 'Admin Commands',
      };
    default:
      return {};
  }
}

// Get accent color for database type
function getAccentColor(dbType: DatabaseType): string {
  switch (dbType) {
    case 'mongodb':
      return 'text-green-500';
    case 'elasticsearch':
      return 'text-yellow-500';
    case 'cassandra':
      return 'text-blue-500';
    default:
      return 'text-vscode-accent';
  }
}

export const DocumentReferencePanel: FC<DocumentReferencePanelProps> = ({
  dbType,
  onInsertExample
}) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('examples');
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const commands = getCommands(dbType);
  const categoryLabels = getCategoryLabels(dbType);
  const accentColor = getAccentColor(dbType);

  const handleCopy = async (example: string, itemName: string) => {
    await navigator.clipboard.writeText(example);
    setCopiedItem(itemName);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleInsert = (example: string) => {
    onInsertExample(example);
  };

  return (
    <div className="h-full flex flex-col bg-vscode-sidebar overflow-hidden">
      <div className="px-3 py-2 border-b border-vscode-border">
        <h3 className="text-xs font-medium text-vscode-text-muted uppercase tracking-wide">
          Reference
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {Object.entries(commands).map(([category, items]) => {
          const label = categoryLabels[category] || category;
          const isExpanded = expandedCategory === category;

          return (
            <div key={category} className="border-b border-vscode-border last:border-b-0">
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-vscode-list-hover text-left"
              >
                <ChevronRight
                  className={`h-3 w-3 text-vscode-text-muted transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
                <span className="text-xs font-medium text-vscode-text">
                  {label}
                </span>
                <span className="text-xs text-vscode-text-muted ml-auto">
                  {items.length}
                </span>
              </button>

              {isExpanded && (
                <div className="pb-1">
                  {items.map((item) => (
                    <div
                      key={item.name}
                      className="mx-2 mb-1 rounded bg-vscode-input border border-vscode-border"
                    >
                      <div className="px-2 py-1.5 flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-medium ${accentColor}`}>
                            {item.name}
                          </div>
                          <div className="text-xs text-vscode-text-muted mt-0.5 line-clamp-2">
                            {item.desc}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => handleCopy(item.example, item.name)}
                            className="p-1 rounded hover:bg-vscode-list-hover text-vscode-text-muted hover:text-vscode-text"
                            title="Copy to clipboard"
                          >
                            {copiedItem === item.name ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={() => handleInsert(item.example)}
                            className={`px-1.5 py-0.5 text-xs rounded bg-vscode-button hover:bg-vscode-button-hover text-vscode-button-fg`}
                            title="Insert into editor"
                          >
                            Use
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
