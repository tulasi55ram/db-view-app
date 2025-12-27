import { type FC, memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { ERDiagramColumn } from '@dbview/types';
import { Key, Link2, Table2 } from 'lucide-react';

export interface TableNodeData {
  schema: string;
  name: string;
  columns: ERDiagramColumn[];
  onTableClick?: (schema: string, table: string) => void;
}

export const TableNode: FC<{ data: TableNodeData }> = memo(({ data }) => {
  const primaryKeys = data.columns.filter(col => col.isPrimaryKey);
  const foreignKeys = data.columns.filter(col => col.isForeignKey);
  const regularColumns = data.columns.filter(col => !col.isPrimaryKey && !col.isForeignKey);

  const handleClick = () => {
    if (data.onTableClick) {
      data.onTableClick(data.schema, data.name);
    }
  };

  return (
    <div
      className="bg-vscode-bg-light border-2 border-vscode-border rounded-lg shadow-lg min-w-[200px] max-w-[300px] hover:border-vscode-accent transition-colors cursor-pointer"
      onClick={handleClick}
    >
      {/* Connection Handles */}
      <Handle type="target" position={Position.Top} className="!bg-vscode-accent !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-vscode-accent !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-vscode-accent !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-vscode-accent !w-2 !h-2" />

      {/* Table Header */}
      <div className="flex items-center gap-2 bg-vscode-accent/10 border-b border-vscode-border px-3 py-2">
        <Table2 className="h-4 w-4 text-vscode-accent flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-vscode-text truncate">
            {data.name}
          </div>
          <div className="text-2xs text-vscode-text-muted truncate">
            {data.schema}
          </div>
        </div>
      </div>

      {/* Columns List */}
      <div className="px-2 py-1.5 max-h-[300px] overflow-y-auto">
        {/* Primary Keys */}
        {primaryKeys.length > 0 && (
          <div className="mb-1">
            {primaryKeys.map((col, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 py-1 px-1.5 text-xs rounded hover:bg-vscode-bg-hover group"
              >
                <Key className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                <span className="font-mono text-vscode-text truncate flex-1" title={col.name}>
                  {col.name}
                </span>
                <span className="text-2xs text-vscode-text-muted truncate" title={col.type}>
                  {col.type.length > 15 ? col.type.substring(0, 12) + '...' : col.type}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Foreign Keys */}
        {foreignKeys.length > 0 && (
          <div className="mb-1">
            {foreignKeys.map((col, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 py-1 px-1.5 text-xs rounded hover:bg-vscode-bg-hover group"
              >
                <Link2 className="h-3 w-3 text-blue-500 flex-shrink-0" />
                <span className="font-mono text-vscode-text truncate flex-1" title={col.name}>
                  {col.name}
                </span>
                <span className="text-2xs text-vscode-text-muted truncate" title={col.type}>
                  {col.type.length > 15 ? col.type.substring(0, 12) + '...' : col.type}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Regular Columns */}
        {regularColumns.slice(0, 5).map((col, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1.5 py-1 px-1.5 text-xs rounded hover:bg-vscode-bg-hover group"
          >
            <div className="w-3 h-3 flex-shrink-0" />
            <span className="font-mono text-vscode-text truncate flex-1" title={col.name}>
              {col.name}
            </span>
            <span className="text-2xs text-vscode-text-muted truncate" title={col.type}>
              {col.type.length > 15 ? col.type.substring(0, 12) + '...' : col.type}
            </span>
          </div>
        ))}

        {/* Show "X more" if there are many columns */}
        {regularColumns.length > 5 && (
          <div className="text-2xs text-vscode-text-muted text-center py-1">
            + {regularColumns.length - 5} more column{regularColumns.length - 5 !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
});

TableNode.displayName = 'TableNode';
