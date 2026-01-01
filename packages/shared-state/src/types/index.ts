/**
 * Re-export types from @dbview/types for convenience
 * and add shared-state specific types
 */
export type {
  Tab,
  TabType,
  TableTab,
  QueryTab,
  ERDiagramTab,
  BaseTab,
  TabState,
  DatabaseType,
  ColumnMetadata,
  FilterCondition,
  FilterOperator,
} from '@dbview/types';

/**
 * Message adapter interface for abstracting VS Code/Electron communication
 */
export interface MessageAdapter {
  postMessage: (message: unknown) => void;
  onMessage: (handler: (message: unknown) => void) => () => void;
}

/**
 * Table data query parameters
 */
export interface TableDataParams {
  schema: string;
  table: string;
  limit: number;
  offset: number;
  filters?: import('@dbview/types').FilterCondition[];
  filterLogic?: 'AND' | 'OR';
  sorting?: Array<{ id: string; desc: boolean }>;
}

/**
 * Table data query result
 */
export interface TableDataResult {
  columns: import('@dbview/types').ColumnMetadata[];
  rows: Record<string, unknown>[];
  totalRows: number | null;
}
