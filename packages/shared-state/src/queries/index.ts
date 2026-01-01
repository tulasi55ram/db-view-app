/**
 * TanStack Query hooks and utilities
 */

// Query client
export {
  createQueryClient,
  getQueryClient,
  resetQueryClient,
  invalidateTableQueries,
  invalidateConnectionQueries,
} from './queryClient.js';

// Table data hooks
export {
  useTableData,
  useInsertRow,
  useUpdateCell,
  useDeleteRows,
  usePrefetchTableData,
} from './useTableData.js';

export type { TableDataParams, TableDataResult } from './useTableData.js';

// Connection hooks
export {
  useConnections,
  useConnect,
  useDisconnect,
  useSaveConnection,
  useDeleteConnection,
} from './useConnections.js';

export type { ConnectionInfo } from './useConnections.js';
