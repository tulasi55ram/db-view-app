/**
 * Table Data Query Hooks
 *
 * TanStack Query hooks for fetching and mutating table data.
 * Works with both VS Code extension and Desktop app through the message adapter.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnMetadata, FilterCondition } from '@dbview/types';
import { getMessageAdapter, sendMessageMulti } from '../utils/messageAdapter.js';

// Types
export interface TableDataParams {
  schema: string;
  table: string;
  limit: number;
  offset: number;
  filters?: FilterCondition[];
  filterLogic?: 'AND' | 'OR';
  sorting?: Array<{ id: string; desc: boolean }>;
  connectionName?: string;
  enabled?: boolean;
}

export interface TableDataResult {
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  totalRows: number | null;
}

interface LoadTableRowsResponse {
  type: 'LOAD_TABLE_ROWS';
  schema: string;
  table: string;
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  totalRows?: number | null;
}

interface LoadTableErrorResponse {
  type: 'LOAD_TABLE_ERROR';
  error: string;
}

/**
 * Query hook for fetching table data
 *
 * @example
 * ```tsx
 * const { data, isLoading, refetch } = useTableData({
 *   schema: 'public',
 *   table: 'users',
 *   limit: 100,
 *   offset: 0,
 * });
 * ```
 */
export function useTableData(params: TableDataParams) {
  const { schema, table, limit, offset, filters, filterLogic, sorting, connectionName, enabled = true } = params;

  return useQuery<TableDataResult, Error>({
    queryKey: ['tableData', { schema, table, limit, offset, filters, filterLogic, sorting, connectionName }],
    queryFn: async () => {
      const adapter = getMessageAdapter();

      const response = await sendMessageMulti<LoadTableRowsResponse | LoadTableErrorResponse>(
        adapter,
        {
          type: 'LOAD_TABLE_ROWS',
          schema,
          table,
          limit,
          offset,
          filters,
          filterLogic,
          sorting,
        },
        ['LOAD_TABLE_ROWS', 'LOAD_TABLE_ERROR'],
        30000
      );

      if (response.type === 'LOAD_TABLE_ERROR') {
        throw new Error(response.error);
      }

      return {
        columns: response.columns,
        rows: response.rows,
        totalRows: response.totalRows ?? null,
      };
    },
    enabled,
    staleTime: 30000, // 30 seconds
  });
}

// Mutation types
interface InsertRowParams {
  schema: string;
  table: string;
  values: Record<string, unknown>;
}

interface UpdateCellParams {
  schema: string;
  table: string;
  primaryKey: Record<string, unknown>;
  column: string;
  value: unknown;
  rowIndex?: number;
}

interface DeleteRowsParams {
  schema: string;
  table: string;
  primaryKeys: Record<string, unknown>[];
}

interface InsertSuccessResponse {
  type: 'INSERT_SUCCESS';
  newRow: Record<string, unknown>;
}

interface InsertErrorResponse {
  type: 'INSERT_ERROR';
  error: string;
}

interface UpdateSuccessResponse {
  type: 'UPDATE_SUCCESS';
  rowIndex?: number;
}

interface UpdateErrorResponse {
  type: 'UPDATE_ERROR';
  error: string;
  rowIndex?: number;
  column?: string;
}

interface DeleteSuccessResponse {
  type: 'DELETE_SUCCESS';
  deletedCount: number;
}

interface DeleteErrorResponse {
  type: 'DELETE_ERROR';
  error: string;
}

/**
 * Mutation hook for inserting a new row
 *
 * @example
 * ```tsx
 * const insertMutation = useInsertRow();
 *
 * // Insert a row
 * insertMutation.mutate({
 *   schema: 'public',
 *   table: 'users',
 *   values: { name: 'John', email: 'john@example.com' },
 * });
 * ```
 */
export function useInsertRow() {
  const queryClient = useQueryClient();

  return useMutation<InsertSuccessResponse, Error, InsertRowParams>({
    mutationFn: async (params) => {
      const adapter = getMessageAdapter();

      const response = await sendMessageMulti<InsertSuccessResponse | InsertErrorResponse>(
        adapter,
        {
          type: 'INSERT_ROW',
          ...params,
        },
        ['INSERT_SUCCESS', 'INSERT_ERROR'],
        30000
      );

      if (response.type === 'INSERT_ERROR') {
        throw new Error(response.error);
      }

      return response;
    },
    onSuccess: (_, variables) => {
      // Invalidate table data to refetch
      queryClient.invalidateQueries({
        queryKey: ['tableData', { schema: variables.schema, table: variables.table }],
        exact: false,
      });
    },
  });
}

/**
 * Mutation hook for updating a cell value
 *
 * @example
 * ```tsx
 * const updateMutation = useUpdateCell();
 *
 * // Update a cell
 * updateMutation.mutate({
 *   schema: 'public',
 *   table: 'users',
 *   primaryKey: { id: 1 },
 *   column: 'name',
 *   value: 'Jane',
 * });
 * ```
 */
export function useUpdateCell() {
  const queryClient = useQueryClient();

  return useMutation<UpdateSuccessResponse, Error, UpdateCellParams>({
    mutationFn: async (params) => {
      const adapter = getMessageAdapter();

      const response = await sendMessageMulti<UpdateSuccessResponse | UpdateErrorResponse>(
        adapter,
        {
          type: 'UPDATE_CELL',
          ...params,
        },
        ['UPDATE_SUCCESS', 'UPDATE_ERROR'],
        30000
      );

      if (response.type === 'UPDATE_ERROR') {
        throw new Error(response.error);
      }

      return response;
    },
    onSuccess: (_, variables) => {
      // Invalidate table data to refetch
      queryClient.invalidateQueries({
        queryKey: ['tableData', { schema: variables.schema, table: variables.table }],
        exact: false,
      });
    },
  });
}

/**
 * Mutation hook for deleting rows
 *
 * @example
 * ```tsx
 * const deleteMutation = useDeleteRows();
 *
 * // Delete rows
 * deleteMutation.mutate({
 *   schema: 'public',
 *   table: 'users',
 *   primaryKeys: [{ id: 1 }, { id: 2 }],
 * });
 * ```
 */
export function useDeleteRows() {
  const queryClient = useQueryClient();

  return useMutation<DeleteSuccessResponse, Error, DeleteRowsParams>({
    mutationFn: async (params) => {
      const adapter = getMessageAdapter();

      const response = await sendMessageMulti<DeleteSuccessResponse | DeleteErrorResponse>(
        adapter,
        {
          type: 'DELETE_ROWS',
          ...params,
        },
        ['DELETE_SUCCESS', 'DELETE_ERROR'],
        30000
      );

      if (response.type === 'DELETE_ERROR') {
        throw new Error(response.error);
      }

      return response;
    },
    onSuccess: (_, variables) => {
      // Invalidate table data to refetch
      queryClient.invalidateQueries({
        queryKey: ['tableData', { schema: variables.schema, table: variables.table }],
        exact: false,
      });
    },
  });
}

/**
 * Hook to prefetch table data
 *
 * @example
 * ```tsx
 * const prefetchTable = usePrefetchTableData();
 *
 * // Prefetch on hover
 * <TableItem onMouseEnter={() => prefetchTable({ schema: 'public', table: 'users', limit: 100, offset: 0 })} />
 * ```
 */
export function usePrefetchTableData() {
  const queryClient = useQueryClient();

  return async (params: Omit<TableDataParams, 'enabled'>) => {
    const { schema, table, limit, offset, filters, filterLogic, sorting, connectionName } = params;
    const adapter = getMessageAdapter();

    await queryClient.prefetchQuery({
      queryKey: ['tableData', { schema, table, limit, offset, filters, filterLogic, sorting, connectionName }],
      queryFn: async () => {
        const response = await sendMessageMulti<LoadTableRowsResponse | LoadTableErrorResponse>(
          adapter,
          {
            type: 'LOAD_TABLE_ROWS',
            schema,
            table,
            limit,
            offset,
            filters,
            filterLogic,
            sorting,
          },
          ['LOAD_TABLE_ROWS', 'LOAD_TABLE_ERROR'],
          30000
        );

        if (response.type === 'LOAD_TABLE_ERROR') {
          throw new Error(response.error);
        }

        return {
          columns: response.columns,
          rows: response.rows,
          totalRows: response.totalRows ?? null,
        };
      },
      staleTime: 30000,
    });
  };
}
