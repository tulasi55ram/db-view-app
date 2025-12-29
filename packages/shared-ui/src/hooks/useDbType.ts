/**
 * useDbType Hook
 *
 * Hook for determining database type and category from a connection key.
 * Used to route to the appropriate data view component.
 */

import { useMemo } from 'react';
import type { DatabaseType } from '@dbview/types';
import {
  getDbTypeFromConnectionKey,
  getDbCategory,
  getTerminology,
  type DbCategory,
  type SidebarTerminology,
} from '@/utils/dbTypeUtils';

export interface UseDbTypeResult {
  /** The database type (postgres, mongodb, redis, etc.) */
  dbType: DatabaseType;
  /** The UI category (sql, document, keyvalue) */
  category: DbCategory;
  /** Terminology for sidebar labels */
  terminology: SidebarTerminology;
  /** Whether this is a SQL database */
  isSql: boolean;
  /** Whether this is a document database (MongoDB, Elasticsearch, Cassandra) */
  isDocument: boolean;
  /** Whether this is a key-value database (Redis) */
  isKeyValue: boolean;
}

/**
 * Hook to get database type information from a connection key
 *
 * @param connectionKey - The connection key (e.g., "postgres:user@host:5432/db")
 * @returns Database type information including category and terminology
 *
 * @example
 * ```tsx
 * const { dbType, category, isDocument } = useDbType(connectionKey);
 *
 * if (isDocument) {
 *   return <DocumentDataView />;
 * }
 * ```
 */
export function useDbType(connectionKey: string): UseDbTypeResult {
  return useMemo(() => {
    const dbType = getDbTypeFromConnectionKey(connectionKey);
    const category = getDbCategory(dbType);
    const terminology = getTerminology(dbType);

    return {
      dbType,
      category,
      terminology,
      isSql: category === 'sql',
      isDocument: category === 'document',
      isKeyValue: category === 'keyvalue',
    };
  }, [connectionKey]);
}

export default useDbType;
