/**
 * Connection Query Hooks
 *
 * TanStack Query hooks for managing database connections.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DatabaseConnectionConfig } from '@dbview/types';
import { getMessageAdapter, sendMessageMulti } from '../utils/messageAdapter.js';

// Types
export interface ConnectionInfo {
  key: string;
  name: string;
  config: DatabaseConnectionConfig;
  isConnected: boolean;
}

interface ConnectionsResponse {
  type: 'CONNECTIONS_LIST';
  connections: ConnectionInfo[];
}

interface ConnectionsErrorResponse {
  type: 'CONNECTIONS_ERROR';
  error: string;
}

interface ConnectSuccessResponse {
  type: 'CONNECT_SUCCESS';
  key: string;
}

interface ConnectErrorResponse {
  type: 'CONNECT_ERROR';
  error: string;
}

interface DisconnectSuccessResponse {
  type: 'DISCONNECT_SUCCESS';
  key: string;
}

interface DisconnectErrorResponse {
  type: 'DISCONNECT_ERROR';
  error: string;
}

/**
 * Query hook for fetching all connections
 *
 * @example
 * ```tsx
 * const { data: connections, isLoading } = useConnections();
 * ```
 */
export function useConnections() {
  return useQuery<ConnectionInfo[], Error>({
    queryKey: ['connections'],
    queryFn: async () => {
      const adapter = getMessageAdapter();

      const response = await sendMessageMulti<ConnectionsResponse | ConnectionsErrorResponse>(
        adapter,
        { type: 'GET_CONNECTIONS' },
        ['CONNECTIONS_LIST', 'CONNECTIONS_ERROR'],
        10000
      );

      if (response.type === 'CONNECTIONS_ERROR') {
        throw new Error(response.error);
      }

      return response.connections;
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Mutation hook for connecting to a database
 *
 * @example
 * ```tsx
 * const connectMutation = useConnect();
 *
 * // Connect
 * connectMutation.mutate('connection-key');
 * ```
 */
export function useConnect() {
  const queryClient = useQueryClient();

  return useMutation<ConnectSuccessResponse, Error, string>({
    mutationFn: async (connectionKey) => {
      const adapter = getMessageAdapter();

      const response = await sendMessageMulti<ConnectSuccessResponse | ConnectErrorResponse>(
        adapter,
        { type: 'CONNECT', key: connectionKey },
        ['CONNECT_SUCCESS', 'CONNECT_ERROR'],
        30000
      );

      if (response.type === 'CONNECT_ERROR') {
        throw new Error(response.error);
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
}

/**
 * Mutation hook for disconnecting from a database
 *
 * @example
 * ```tsx
 * const disconnectMutation = useDisconnect();
 *
 * // Disconnect
 * disconnectMutation.mutate('connection-key');
 * ```
 */
export function useDisconnect() {
  const queryClient = useQueryClient();

  return useMutation<DisconnectSuccessResponse, Error, string>({
    mutationFn: async (connectionKey) => {
      const adapter = getMessageAdapter();

      const response = await sendMessageMulti<DisconnectSuccessResponse | DisconnectErrorResponse>(
        adapter,
        { type: 'DISCONNECT', key: connectionKey },
        ['DISCONNECT_SUCCESS', 'DISCONNECT_ERROR'],
        10000
      );

      if (response.type === 'DISCONNECT_ERROR') {
        throw new Error(response.error);
      }

      return response;
    },
    onSuccess: (_, connectionKey) => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      // Also invalidate any table data for this connection
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === 'tableData' &&
            typeof key[1] === 'object' &&
            key[1] !== null &&
            'connectionName' in key[1]
          );
        },
      });
    },
  });
}

/**
 * Mutation hook for saving a connection
 *
 * @example
 * ```tsx
 * const saveMutation = useSaveConnection();
 *
 * // Save
 * saveMutation.mutate({
 *   key: 'optional-key-for-update',
 *   config: { dbType: 'postgres', host: 'localhost', ... }
 * });
 * ```
 */
export function useSaveConnection() {
  const queryClient = useQueryClient();

  return useMutation<{ key: string }, Error, { key?: string; config: DatabaseConnectionConfig }>({
    mutationFn: async ({ key, config }) => {
      const adapter = getMessageAdapter();

      const response = await sendMessageMulti<{ type: 'SAVE_CONNECTION_SUCCESS'; key: string } | { type: 'SAVE_CONNECTION_ERROR'; error: string }>(
        adapter,
        { type: 'SAVE_CONNECTION', key, config },
        ['SAVE_CONNECTION_SUCCESS', 'SAVE_CONNECTION_ERROR'],
        10000
      );

      if (response.type === 'SAVE_CONNECTION_ERROR') {
        throw new Error(response.error);
      }

      return { key: response.key };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
}

/**
 * Mutation hook for deleting a connection
 *
 * @example
 * ```tsx
 * const deleteMutation = useDeleteConnection();
 *
 * // Delete
 * deleteMutation.mutate('connection-key');
 * ```
 */
export function useDeleteConnection() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (connectionKey) => {
      const adapter = getMessageAdapter();

      const response = await sendMessageMulti<{ type: 'DELETE_CONNECTION_SUCCESS' } | { type: 'DELETE_CONNECTION_ERROR'; error: string }>(
        adapter,
        { type: 'DELETE_CONNECTION', key: connectionKey },
        ['DELETE_CONNECTION_SUCCESS', 'DELETE_CONNECTION_ERROR'],
        10000
      );

      if (response.type === 'DELETE_CONNECTION_ERROR') {
        throw new Error(response.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
}
