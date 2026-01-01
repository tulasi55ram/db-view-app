/**
 * TanStack Query Client Configuration
 *
 * Shared query client for both VS Code extension and Desktop app.
 * Provides consistent caching, error handling, and retry behavior.
 */
import { QueryClient } from '@tanstack/react-query';

/**
 * Create a configured QueryClient instance
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 30 seconds
        staleTime: 30 * 1000,

        // Cache data for 5 minutes after it becomes unused
        gcTime: 5 * 60 * 1000,

        // Don't refetch when window regains focus
        // (we handle refresh manually based on user actions)
        refetchOnWindowFocus: false,

        // Retry failed queries once
        retry: 1,

        // Don't retry on 4xx errors (client errors)
        retryOnMount: true,
      },
      mutations: {
        // Don't retry mutations by default
        retry: 0,
      },
    },
  });
}

// Singleton query client instance
let queryClient: QueryClient | null = null;

/**
 * Get singleton QueryClient instance
 */
export function getQueryClient(): QueryClient {
  if (!queryClient) {
    queryClient = createQueryClient();
  }
  return queryClient;
}

/**
 * Reset query client (useful for testing or when switching connections)
 */
export function resetQueryClient(): void {
  if (queryClient) {
    queryClient.clear();
  }
  queryClient = null;
}

/**
 * Invalidate all queries for a specific table
 */
export function invalidateTableQueries(
  client: QueryClient,
  schema: string,
  table: string
): Promise<void> {
  return client.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return (
        Array.isArray(key) &&
        key[0] === 'tableData' &&
        typeof key[1] === 'object' &&
        key[1] !== null &&
        'schema' in key[1] &&
        'table' in key[1] &&
        key[1].schema === schema &&
        key[1].table === table
      );
    },
  });
}

/**
 * Invalidate all queries for a specific connection
 */
export function invalidateConnectionQueries(
  client: QueryClient,
  connectionName: string
): Promise<void> {
  return client.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return (
        Array.isArray(key) &&
        typeof key[1] === 'object' &&
        key[1] !== null &&
        'connectionName' in key[1] &&
        key[1].connectionName === connectionName
      );
    },
  });
}
