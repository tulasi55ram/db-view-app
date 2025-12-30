/**
 * DataViewContainer - Unified container that routes to the appropriate
 * data view component based on database type.
 *
 * This component serves as the main entry point for displaying database data,
 * automatically selecting the correct view for:
 * - SQL databases (PostgreSQL, MySQL, MariaDB, SQL Server, SQLite)
 * - Document databases (MongoDB, Elasticsearch, Cassandra)
 * - Redis
 */

import type { FC } from "react";
import { useMemo } from "react";
import type { ColumnMetadata, DatabaseType, FilterCondition } from "@dbview/types";
import type { SortingState } from "@tanstack/react-table";
import type { RedisKeyType } from "./types";
import { SqlDataView } from "./SqlDataView";
import { DocumentDataView } from "./DocumentDataView";
import { RedisDataView } from "./RedisDataView";

/**
 * Props for the DataViewContainer
 */
export interface DataViewContainerProps {
  // Required props
  dbType: DatabaseType;
  schema: string;
  table: string;
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  loading: boolean;
  totalRows: number | null;

  // Pagination
  limit: number;
  offset: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;

  // Refresh
  onRefresh: () => void;

  // Read-only mode
  readOnly?: boolean;

  // SQL-specific props (optional)
  filters?: FilterCondition[];
  filterLogic?: 'AND' | 'OR';
  onFiltersChange?: (filters: FilterCondition[], logic: 'AND' | 'OR') => void;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  onUpdateCell?: (primaryKey: Record<string, unknown>, column: string, value: unknown) => void;
  onInsertRow?: (values: Record<string, unknown>) => void;
  onDeleteRows?: (primaryKeys: Record<string, unknown>[]) => void;

  // MongoDB-specific props (optional)
  viewMode?: 'table' | 'json';
  onViewModeChange?: (mode: 'table' | 'json') => void;
  expandedDocuments?: Set<string>;
  onToggleExpand?: (documentId: string) => void;
  onUpdateDocument?: (documentId: string, updates: Record<string, unknown>) => void;
  onInsertDocument?: (document: Record<string, unknown>) => void;
  onDeleteDocuments?: (documentIds: string[]) => void;

  // Redis-specific props (optional)
  keyType?: RedisKeyType;
  onKeyTypeChange?: (type: RedisKeyType) => void;
  keyPattern?: string;
  onKeyPatternChange?: (pattern: string) => void;
}

/**
 * Helper to determine if dbType is a SQL database
 */
function isSqlDbType(dbType: DatabaseType): dbType is 'postgres' | 'mysql' | 'mariadb' | 'sqlserver' | 'sqlite' {
  return ['postgres', 'mysql', 'mariadb', 'sqlserver', 'sqlite'].includes(dbType);
}

/**
 * DataViewContainer Component
 *
 * Automatically routes to the appropriate view based on database type:
 * - SqlDataView for PostgreSQL, MySQL, MariaDB, SQL Server, SQLite
 * - DocumentDataView for MongoDB, Elasticsearch, Cassandra
 * - RedisDataView for Redis
 */
export const DataViewContainer: FC<DataViewContainerProps> = (props) => {
  const {
    dbType,
    schema,
    table,
    columns,
    rows,
    loading,
    totalRows,
    limit,
    offset,
    onPageChange,
    onPageSizeChange,
    onRefresh,
    readOnly = false,
    // SQL props
    filters,
    filterLogic,
    onFiltersChange,
    sorting,
    onSortingChange,
    onUpdateCell,
    onInsertRow,
    onDeleteRows,
    // MongoDB props
    viewMode = 'tree',
    onViewModeChange,
    expandedDocuments,
    onToggleExpand,
    onUpdateDocument,
    onInsertDocument,
    onDeleteDocuments,
    // Redis props
    keyType = 'string',
    onKeyTypeChange,
    keyPattern,
    onKeyPatternChange,
  } = props;

  // Memoize which view to render
  const ViewComponent = useMemo(() => {
    if (isSqlDbType(dbType)) {
      return (
        <SqlDataView
          dbType={dbType}
          schema={schema}
          table={table}
          columns={columns}
          rows={rows}
          loading={loading}
          totalRows={totalRows}
          limit={limit}
          offset={offset}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onRefresh={onRefresh}
          readOnly={readOnly}
          filters={filters}
          filterLogic={filterLogic}
          onFiltersChange={onFiltersChange}
          sorting={sorting}
          onSortingChange={onSortingChange}
        />
      );
    }

    if (dbType === 'mongodb' || dbType === 'elasticsearch' || dbType === 'cassandra') {
      return (
        <DocumentDataView
          dbType={dbType}
          schema={schema}
          table={table}
          columns={columns}
          rows={rows}
          loading={loading}
          totalRows={totalRows}
          limit={limit}
          offset={offset}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onRefresh={onRefresh}
          readOnly={readOnly}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          expandedDocuments={expandedDocuments}
          onToggleExpand={onToggleExpand}
          onUpdateDocument={onUpdateDocument}
          onInsertDocument={onInsertDocument}
          onDeleteDocuments={onDeleteDocuments}
        />
      );
    }

    if (dbType === 'redis') {
      return (
        <RedisDataView
          dbType={dbType}
          schema={schema}
          table={table}
          columns={columns}
          rows={rows}
          loading={loading}
          totalRows={totalRows}
          limit={limit}
          offset={offset}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onRefresh={onRefresh}
          readOnly={readOnly}
          keyType={keyType}
          onKeyTypeChange={onKeyTypeChange}
          keyPattern={keyPattern}
          onKeyPatternChange={onKeyPatternChange}
        />
      );
    }

    // Fallback for unsupported database types (Elasticsearch, Cassandra, etc.)
    // Use SQL view as a reasonable fallback
    return (
      <SqlDataView
        dbType={dbType as any}
        schema={schema}
        table={table}
        columns={columns}
        rows={rows}
        loading={loading}
        totalRows={totalRows}
        limit={limit}
        offset={offset}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onRefresh={onRefresh}
        readOnly={readOnly}
      />
    );
  }, [
    dbType,
    schema,
    table,
    columns,
    rows,
    loading,
    totalRows,
    limit,
    offset,
    onPageChange,
    onPageSizeChange,
    onRefresh,
    readOnly,
    filters,
    filterLogic,
    onFiltersChange,
    sorting,
    onSortingChange,
    viewMode,
    onViewModeChange,
    expandedDocuments,
    onToggleExpand,
    onUpdateDocument,
    onInsertDocument,
    onDeleteDocuments,
    keyType,
    onKeyTypeChange,
    keyPattern,
    onKeyPatternChange,
  ]);

  return ViewComponent;
};

export default DataViewContainer;
