/**
 * DataView Router
 *
 * Routes to the appropriate data view component based on database type:
 * - SQL databases → SqlDataView (PostgreSQL, MySQL, MariaDB, SQL Server, SQLite)
 * - Document databases → DocumentDataView (MongoDB, Elasticsearch, Cassandra)
 * - Key-value databases → RedisDataView (Redis)
 */

import { useDbType } from '@/hooks/useDbType';
import { TableView } from '@/components/TableView';
import { RedisDataView } from '@/components/RedisDataView';
import { DocumentDataView } from '@/components/DocumentDataView';
import type { DataViewProps, DocumentDbType } from './types';

export interface DataViewRouterProps extends DataViewProps {}

/**
 * DataView component that routes to the appropriate viewer based on database type
 *
 * @example
 * ```tsx
 * <DataView
 *   connectionKey="postgres:user@localhost:5432/mydb"
 *   schema="public"
 *   table="users"
 * />
 * ```
 */
export function DataView({ connectionKey, schema, table }: DataViewRouterProps) {
  const { dbType, category } = useDbType(connectionKey);

  // Route to appropriate view based on database category
  switch (category) {
    case 'keyvalue':
      return (
        <RedisDataView
          connectionKey={connectionKey}
          schema={schema}
          table={table}
        />
      );

    case 'document':
      return (
        <DocumentDataView
          connectionKey={connectionKey}
          schema={schema}
          table={table}
          dbType={dbType as DocumentDbType}
        />
      );

    case 'sql':
    default:
      return (
        <TableView
          connectionKey={connectionKey}
          schema={schema}
          table={table}
        />
      );
  }
}

export default DataView;
