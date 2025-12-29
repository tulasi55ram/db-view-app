/**
 * QueryView Router
 *
 * Routes to the appropriate query editor based on database type:
 * - SQL databases → QueryView (SQL Editor)
 * - Redis → RedisQueryView (Redis Command Editor)
 * - MongoDB/Elasticsearch/Cassandra → DocumentQueryView (JSON/CQL Editor)
 */

import { useDbType } from '@/hooks/useDbType';
import { QueryView, type QueryViewProps } from './QueryView';
import { RedisQueryView } from './RedisQueryView';
import { DocumentQueryView } from './DocumentQueryView';

export interface QueryViewRouterProps extends QueryViewProps {}

/**
 * QueryViewRouter routes to the appropriate query editor based on the
 * database type derived from the connection key.
 */
export function QueryViewRouter({ tab, onTabUpdate }: QueryViewRouterProps) {
  // Get database type from connection key
  const connectionKey = tab.connectionKey || '';
  const { dbType, category } = useDbType(connectionKey);

  // Route to appropriate query view
  switch (category) {
    case 'keyvalue':
      // Redis uses command-based interface
      return <RedisQueryView tab={tab} onTabUpdate={onTabUpdate} />;

    case 'document':
      // MongoDB, Elasticsearch, Cassandra use JSON/CQL
      return (
        <DocumentQueryView
          tab={tab}
          onTabUpdate={onTabUpdate}
          dbType={dbType as 'mongodb' | 'elasticsearch' | 'cassandra'}
        />
      );

    case 'sql':
    default:
      // SQL databases use standard SQL editor
      return <QueryView tab={tab} onTabUpdate={onTabUpdate} />;
  }
}

export default QueryViewRouter;
