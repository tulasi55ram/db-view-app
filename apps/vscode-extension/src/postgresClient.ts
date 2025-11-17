import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";
import type { ConnectionConfig } from "@dbview/core";

export interface QueryResultSet {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface ObjectCounts {
  tables: number;
  views: number;
  materializedViews: number;
  functions: number;
  procedures: number;
  types: number;
}

const DEFAULT_CONFIG: PoolConfig = process.env.DBVIEW_DATABASE_URL
  ? { connectionString: process.env.DBVIEW_DATABASE_URL }
  : {
      host: process.env.DBVIEW_PG_HOST ?? "localhost",
      port: Number(process.env.DBVIEW_PG_PORT ?? 5432),
      user: process.env.DBVIEW_PG_USER ?? "postgres",
      password: process.env.DBVIEW_PG_PASSWORD ?? "postgres",
      database: process.env.DBVIEW_PG_DB ?? "postgres"
    };

interface TableListRow {
  table_name: string;
  total_bytes: string | number | null;
}

export class PostgresClient {
  private readonly config: PoolConfig;
  private pool: Pool | undefined;

  constructor(connection?: ConnectionConfig) {
    this.config = connection ? toPoolConfig(connection) : DEFAULT_CONFIG;
    console.log("[dbview] PostgresClient created with config:", {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      hasPassword: !!this.config.password
    });
  }

  async listSchemas(): Promise<string[]> {
    console.log("[dbview] Executing listSchemas query...");
    const result = await this.query<{ schema_name: string }>(
      `select schema_name
       from information_schema.schemata
       where schema_name not in ('pg_catalog', 'information_schema')
       order by schema_name`
    );
    console.log("[dbview] listSchemas query result:", result.rows.length, "schemas");
    return result.rows.map((row) => row.schema_name);
  }

  async listTables(schema: string): Promise<{ name: string; sizeBytes?: number }[]> {
    const result = await this.query<TableListRow>(
      `select table_name,
              pg_total_relation_size(
                quote_ident(table_schema) || '.' || quote_ident(table_name)
              ) as total_bytes
       from information_schema.tables
       where table_schema = $1 and table_type = 'BASE TABLE'
       order by table_name`,
      [schema]
    );
    return result.rows.map((row) => {
      const rawSize = row.total_bytes;
      const sizeNumber =
        typeof rawSize === "number"
          ? rawSize
          : rawSize !== null && rawSize !== undefined
            ? Number.parseInt(String(rawSize), 10)
            : undefined;
      return {
        name: row.table_name,
        sizeBytes: Number.isNaN(sizeNumber ?? NaN) ? undefined : sizeNumber
      };
    });
  }

  async fetchTableRows(schema: string, table: string, limit = 100): Promise<QueryResultSet> {
    const qualified = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
    const result = await this.query(
      `select * from ${qualified} limit $1`,
      [limit]
    );
    return createResultSet(result);
  }

  async runQuery(sql: string): Promise<QueryResultSet> {
    const result = await this.query(sql);
    return createResultSet(result);
  }

  async getDatabaseSize(): Promise<number> {
    const result = await this.query<{ size: string }>(
      `select pg_database_size(current_database()) as size`
    );
    return parseInt(result.rows[0]?.size ?? "0", 10);
  }

  async getObjectCounts(schema: string): Promise<ObjectCounts> {
    const tablesResult = await this.query<{ count: string }>(
      `select count(*) as count
       from information_schema.tables
       where table_schema = $1 and table_type = 'BASE TABLE'`,
      [schema]
    );

    const viewsResult = await this.query<{ count: string }>(
      `select count(*) as count
       from information_schema.views
       where table_schema = $1`,
      [schema]
    );

    const matViewsResult = await this.query<{ count: string }>(
      `select count(*) as count
       from pg_matviews
       where schemaname = $1`,
      [schema]
    );

    const functionsResult = await this.query<{ count: string }>(
      `select count(*) as count
       from pg_proc p
       join pg_namespace n on p.pronamespace = n.oid
       where n.nspname = $1 and p.prokind = 'f'`,
      [schema]
    );

    const proceduresResult = await this.query<{ count: string }>(
      `select count(*) as count
       from pg_proc p
       join pg_namespace n on p.pronamespace = n.oid
       where n.nspname = $1 and p.prokind = 'p'`,
      [schema]
    );

    const typesResult = await this.query<{ count: string }>(
      `select count(*) as count
       from pg_type t
       join pg_namespace n on t.typnamespace = n.oid
       where n.nspname = $1 and t.typtype in ('c', 'e', 'd')`,
      [schema]
    );

    return {
      tables: parseInt(tablesResult.rows[0]?.count ?? "0", 10),
      views: parseInt(viewsResult.rows[0]?.count ?? "0", 10),
      materializedViews: parseInt(matViewsResult.rows[0]?.count ?? "0", 10),
      functions: parseInt(functionsResult.rows[0]?.count ?? "0", 10),
      procedures: parseInt(proceduresResult.rows[0]?.count ?? "0", 10),
      types: parseInt(typesResult.rows[0]?.count ?? "0", 10)
    };
  }

  async listViews(schema: string): Promise<string[]> {
    const result = await this.query<{ table_name: string }>(
      `select table_name
       from information_schema.views
       where table_schema = $1
       order by table_name`,
      [schema]
    );
    return result.rows.map((row) => row.table_name);
  }

  async listMaterializedViews(schema: string): Promise<string[]> {
    const result = await this.query<{ matviewname: string }>(
      `select matviewname
       from pg_matviews
       where schemaname = $1
       order by matviewname`,
      [schema]
    );
    return result.rows.map((row) => row.matviewname);
  }

  async listFunctions(schema: string): Promise<string[]> {
    const result = await this.query<{ proname: string }>(
      `select p.proname
       from pg_proc p
       join pg_namespace n on p.pronamespace = n.oid
       where n.nspname = $1 and p.prokind = 'f'
       order by p.proname`,
      [schema]
    );
    return result.rows.map((row) => row.proname);
  }

  async listProcedures(schema: string): Promise<string[]> {
    const result = await this.query<{ proname: string }>(
      `select p.proname
       from pg_proc p
       join pg_namespace n on p.pronamespace = n.oid
       where n.nspname = $1 and p.prokind = 'p'
       order by p.proname`,
      [schema]
    );
    return result.rows.map((row) => row.proname);
  }

  async listTypes(schema: string): Promise<string[]> {
    const result = await this.query<{ typname: string }>(
      `select t.typname
       from pg_type t
       join pg_namespace n on t.typnamespace = n.oid
       where n.nspname = $1 and t.typtype in ('c', 'e', 'd')
       order by t.typname`,
      [schema]
    );
    return result.rows.map((row) => row.typname);
  }

  private async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    console.log("[dbview] Executing query:", text.substring(0, 50) + "...");
    const pool = this.pool ?? (this.pool = new Pool(this.config));
    try {
      const result = await pool.query<T>(text, params);
      console.log("[dbview] Query successful, rows:", result.rows.length);
      return result;
    } catch (error) {
      console.error("[dbview] Query failed:", error);
      throw error;
    }
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function createResultSet(result: QueryResult): QueryResultSet {
  const columns = result.fields.map((field) => field.name);
  return {
    columns,
    rows: result.rows as Record<string, unknown>[]
  };
}

function toPoolConfig(connection: ConnectionConfig): PoolConfig {
  return {
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password,
    database: connection.database,
    ssl: connection.ssl
  };
}

export async function testConnection(
  connection: ConnectionConfig
): Promise<{ success: boolean; message: string }> {
  const pool = new Pool(toPoolConfig(connection));

  try {
    console.log("[dbview] Testing connection to:", {
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.user
    });

    // Test the connection with a simple query
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT version()");
      const version = result.rows[0]?.version;

      console.log("[dbview] Connection test successful:", version);

      // Extract PostgreSQL version number
      const versionMatch = version?.match(/PostgreSQL ([\d.]+)/);
      const versionNumber = versionMatch ? versionMatch[1] : "unknown";

      return {
        success: true,
        message: `Connected successfully to PostgreSQL ${versionNumber}`
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[dbview] Connection test failed:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide more helpful error messages
    if (errorMessage.includes("password authentication failed")) {
      return {
        success: false,
        message: "Authentication failed. Please check your username and password."
      };
    } else if (errorMessage.includes("ECONNREFUSED")) {
      return {
        success: false,
        message: `Cannot connect to ${connection.host}:${connection.port}. Is PostgreSQL running?`
      };
    } else if (errorMessage.includes("does not exist")) {
      return {
        success: false,
        message: `Database "${connection.database}" does not exist.`
      };
    } else {
      return {
        success: false,
        message: errorMessage
      };
    }
  } finally {
    await pool.end();
  }
}
