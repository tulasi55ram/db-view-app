import { type FC, useState, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import type { ColumnMetadata } from "@dbview/types";
import { Columns3, Eye, EyeOff, Search, Key, Link } from "lucide-react";

export interface ColumnVisibilityMenuProps {
  columns: ColumnMetadata[];
  visibleColumns: Set<string>;
  onToggleColumn: (columnName: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export const ColumnVisibilityMenu: FC<ColumnVisibilityMenuProps> = ({
  columns,
  visibleColumns,
  onToggleColumn,
  onShowAll,
  onHideAll
}) => {
  const [search, setSearch] = useState('');
  const allVisible = columns.every((col) => visibleColumns.has(col.name));
  const allHidden = columns.every((col) => !visibleColumns.has(col.name));

  // Filter columns by search
  const filteredColumns = useMemo(() => {
    if (!search) return columns;
    const searchLower = search.toLowerCase();
    return columns.filter(col =>
      col.name.toLowerCase().includes(searchLower) ||
      col.type.toLowerCase().includes(searchLower)
    );
  }, [columns, search]);

  // Group columns by type
  const groupedColumns = useMemo(() => {
    const groups: Record<string, ColumnMetadata[]> = {
      primary: [],
      foreign: [],
      regular: []
    };

    filteredColumns.forEach(col => {
      if (col.isPrimaryKey) {
        groups.primary.push(col);
      } else if (col.isForeignKey) {
        groups.foreign.push(col);
      } else {
        groups.regular.push(col);
      }
    });

    return groups;
  }, [filteredColumns]);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors text-vscode-text-muted hover:bg-vscode-bg-hover hover:text-vscode-text"
          title="Toggle column visibility"
        >
          <Columns3 className="h-4 w-4" />
          <span>Columns</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 w-80 rounded-lg border border-vscode-border bg-vscode-bg-light shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          sideOffset={5}
          align="end"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-vscode-border px-3 py-2.5">
            <h3 className="text-sm font-semibold text-vscode-text-bright">
              Column Visibility
            </h3>
            <div className="flex gap-1">
              <button
                onClick={onShowAll}
                disabled={allVisible}
                className="px-2 py-1 text-xs rounded bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Show all columns"
              >
                Show All
              </button>
              <button
                onClick={onHideAll}
                disabled={allHidden}
                className="px-2 py-1 text-xs rounded bg-vscode-bg hover:bg-vscode-bg-hover text-vscode-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Hide all columns"
              >
                Hide All
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-vscode-text-muted pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search columns..."
                className="w-full rounded border border-vscode-border bg-vscode-bg py-1.5 pl-8 pr-3 text-xs text-vscode-text placeholder:text-vscode-text-muted focus:border-vscode-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Column Groups */}
          <div className="max-h-96 overflow-y-auto">
            {/* Primary Keys */}
            {groupedColumns.primary.length > 0 && (
              <ColumnGroup
                title="Primary Keys"
                icon={<Key className="h-3 w-3" />}
                columns={groupedColumns.primary}
                visibleColumns={visibleColumns}
                onToggleColumn={onToggleColumn}
              />
            )}

            {/* Foreign Keys */}
            {groupedColumns.foreign.length > 0 && (
              <ColumnGroup
                title="Foreign Keys"
                icon={<Link className="h-3 w-3" />}
                columns={groupedColumns.foreign}
                visibleColumns={visibleColumns}
                onToggleColumn={onToggleColumn}
              />
            )}

            {/* Regular Columns */}
            {groupedColumns.regular.length > 0 && (
              <ColumnGroup
                title="Columns"
                columns={groupedColumns.regular}
                visibleColumns={visibleColumns}
                onToggleColumn={onToggleColumn}
              />
            )}

            {/* No Results */}
            {filteredColumns.length === 0 && (
              <div className="py-8 text-center text-sm text-vscode-text-muted">
                No columns found
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-vscode-border px-3 py-2 text-xs text-vscode-text-muted">
            {visibleColumns.size} of {columns.length} columns visible
          </div>

          <Popover.Arrow className="fill-vscode-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

// Column Group Component
interface ColumnGroupProps {
  title: string;
  icon?: React.ReactNode;
  columns: ColumnMetadata[];
  visibleColumns: Set<string>;
  onToggleColumn: (columnName: string) => void;
}

const ColumnGroup: FC<ColumnGroupProps> = ({
  title,
  icon,
  columns,
  visibleColumns,
  onToggleColumn,
}) => {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-vscode-text-muted">
        {icon}
        <span>{title}</span>
        <span className="ml-auto">({columns.length})</span>
      </div>
      <div className="space-y-0.5">
        {columns.map((column) => {
          const isVisible = visibleColumns.has(column.name);
          return (
            <label
              key={column.name}
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-vscode-bg-hover transition-colors"
            >
              <input
                type="checkbox"
                checked={isVisible}
                onChange={() => onToggleColumn(column.name)}
                className="w-3.5 h-3.5 rounded border-vscode-border bg-vscode-bg accent-vscode-accent cursor-pointer"
              />
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {isVisible ? (
                  <Eye className="h-3 w-3 text-vscode-accent flex-shrink-0" />
                ) : (
                  <EyeOff className="h-3 w-3 text-vscode-text-muted flex-shrink-0" />
                )}
                <span className="text-sm text-vscode-text flex-1 truncate">
                  {column.name}
                </span>
                <span className="text-xs text-vscode-text-muted flex-shrink-0">
                  {column.type}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};
