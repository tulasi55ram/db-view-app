import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Play, Wand2, History, Activity, BookOpen, Save, Bookmark, X } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { SqlEditor, type SqlEditorRef } from "./SqlEditor";
import { QueryResultsGrid } from "./QueryResultsGrid";
import { QueryHistoryPanel } from "./QueryHistoryPanel";
import { ExplainPlanPanel } from "./ExplainPlanPanel";
import { SavedQueriesPanel } from "./SavedQueriesPanel";
import { SaveQueryModal } from "./SaveQueryModal";
import { getElectronAPI } from "@/electron";
import { toast } from "sonner";
import type { TableInfo, ColumnMetadata, ExplainPlan, SavedQuery, QueryHistoryEntry } from "@dbview/types";
import { useQueryHistoryStore, useSavedQueriesStore } from "@dbview/shared-state";
import type { SqlDatabaseType, ForeignKeyRelation } from "@/utils/sqlAutocomplete";

/**
 * Extract error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

// Comprehensive SQL commands organized by category
const SQL_COMMANDS = {
  examples: [
    { name: "Select All", desc: "Get all rows from table", example: `SELECT * FROM users LIMIT 100;` },
    { name: "Select with Filter", desc: "Filter rows with WHERE", example: `SELECT * FROM users WHERE status = 'active';` },
    { name: "Select Columns", desc: "Select specific columns", example: `SELECT id, name, email FROM users WHERE id = 1;` },
    { name: "Insert Row", desc: "Insert a new row", example: `INSERT INTO users (name, email, created_at)
VALUES ('John Doe', 'john@example.com', NOW());` },
    { name: "Update Row", desc: "Update existing rows", example: `UPDATE users SET name = 'Jane Doe', updated_at = NOW()
WHERE id = 1;` },
    { name: "Delete Row", desc: "Delete rows", example: `DELETE FROM users WHERE id = 1;` },
    { name: "Count Rows", desc: "Count matching rows", example: `SELECT COUNT(*) FROM users WHERE status = 'active';` },
    { name: "Join Tables", desc: "Join two tables", example: `SELECT u.name, o.total
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.status = 'completed';` },
  ],
  select: [
    { name: "SELECT *", desc: "Select all columns", example: `SELECT * FROM users;` },
    { name: "SELECT columns", desc: "Select specific columns", example: `SELECT id, name, email FROM users;` },
    { name: "SELECT DISTINCT", desc: "Select unique values", example: `SELECT DISTINCT status FROM orders;` },
    { name: "SELECT with AS", desc: "Column aliases", example: `SELECT name AS user_name, email AS contact FROM users;` },
    { name: "SELECT with LIMIT", desc: "Limit results", example: `SELECT * FROM users LIMIT 10;` },
    { name: "SELECT with OFFSET", desc: "Pagination", example: `SELECT * FROM users LIMIT 10 OFFSET 20;` },
    { name: "SELECT with ORDER BY", desc: "Sort results", example: `SELECT * FROM users ORDER BY created_at DESC;` },
    { name: "SELECT with WHERE", desc: "Filter rows", example: `SELECT * FROM users WHERE status = 'active' AND age > 18;` },
    { name: "SELECT with IN", desc: "Match multiple values", example: `SELECT * FROM users WHERE id IN (1, 2, 3, 4, 5);` },
    { name: "SELECT with BETWEEN", desc: "Range filter", example: `SELECT * FROM orders WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31';` },
    { name: "SELECT with LIKE", desc: "Pattern matching", example: `SELECT * FROM users WHERE email LIKE '%@gmail.com';` },
    { name: "SELECT with IS NULL", desc: "Check for NULL", example: `SELECT * FROM users WHERE deleted_at IS NULL;` },
  ],
  joins: [
    { name: "INNER JOIN", desc: "Match rows in both tables", example: `SELECT u.name, o.total
FROM users u
INNER JOIN orders o ON u.id = o.user_id;` },
    { name: "LEFT JOIN", desc: "All from left, matching from right", example: `SELECT u.name, o.total
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;` },
    { name: "RIGHT JOIN", desc: "All from right, matching from left", example: `SELECT u.name, o.total
FROM users u
RIGHT JOIN orders o ON u.id = o.user_id;` },
    { name: "FULL OUTER JOIN", desc: "All from both tables", example: `SELECT u.name, o.total
FROM users u
FULL OUTER JOIN orders o ON u.id = o.user_id;` },
    { name: "CROSS JOIN", desc: "Cartesian product", example: `SELECT * FROM sizes CROSS JOIN colors;` },
    { name: "Self JOIN", desc: "Join table to itself", example: `SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;` },
    { name: "Multiple JOINs", desc: "Join multiple tables", example: `SELECT u.name, o.id, p.name AS product
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id;` },
  ],
  aggregates: [
    { name: "COUNT(*)", desc: "Count all rows", example: `SELECT COUNT(*) FROM users;` },
    { name: "COUNT(column)", desc: "Count non-null values", example: `SELECT COUNT(email) FROM users;` },
    { name: "SUM()", desc: "Sum of values", example: `SELECT SUM(total) FROM orders WHERE status = 'completed';` },
    { name: "AVG()", desc: "Average value", example: `SELECT AVG(price) FROM products;` },
    { name: "MIN() / MAX()", desc: "Min and max values", example: `SELECT MIN(price), MAX(price) FROM products;` },
    { name: "GROUP BY", desc: "Group rows", example: `SELECT status, COUNT(*) as count
FROM orders
GROUP BY status;` },
    { name: "GROUP BY multiple", desc: "Group by multiple columns", example: `SELECT year, month, SUM(total) as revenue
FROM orders
GROUP BY year, month
ORDER BY year, month;` },
    { name: "HAVING", desc: "Filter groups", example: `SELECT user_id, COUNT(*) as order_count
FROM orders
GROUP BY user_id
HAVING COUNT(*) > 5;` },
  ],
  subqueries: [
    { name: "Subquery in WHERE", desc: "Filter with subquery", example: `SELECT * FROM users
WHERE id IN (
  SELECT user_id FROM orders WHERE total > 1000
);` },
    { name: "Subquery in FROM", desc: "Derived table", example: `SELECT avg_total
FROM (
  SELECT user_id, AVG(total) as avg_total
  FROM orders
  GROUP BY user_id
) as user_averages
WHERE avg_total > 500;` },
    { name: "Subquery in SELECT", desc: "Scalar subquery", example: `SELECT name,
  (SELECT COUNT(*) FROM orders WHERE orders.user_id = users.id) as order_count
FROM users;` },
    { name: "EXISTS", desc: "Check existence", example: `SELECT * FROM users u
WHERE EXISTS (
  SELECT 1 FROM orders o WHERE o.user_id = u.id
);` },
    { name: "NOT EXISTS", desc: "Check non-existence", example: `SELECT * FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.user_id = u.id
);` },
  ],
  insert: [
    { name: "INSERT single", desc: "Insert one row", example: `INSERT INTO users (name, email)
VALUES ('John Doe', 'john@example.com');` },
    { name: "INSERT multiple", desc: "Insert multiple rows", example: `INSERT INTO users (name, email) VALUES
  ('John Doe', 'john@example.com'),
  ('Jane Smith', 'jane@example.com'),
  ('Bob Wilson', 'bob@example.com');` },
    { name: "INSERT from SELECT", desc: "Insert from query", example: `INSERT INTO archived_orders (id, user_id, total)
SELECT id, user_id, total
FROM orders
WHERE created_at < '2023-01-01';` },
    { name: "INSERT RETURNING", desc: "Return inserted row (PostgreSQL)", example: `INSERT INTO users (name, email)
VALUES ('John Doe', 'john@example.com')
RETURNING id, created_at;` },
    { name: "INSERT ON CONFLICT", desc: "Upsert (PostgreSQL)", example: `INSERT INTO users (email, name)
VALUES ('john@example.com', 'John Doe')
ON CONFLICT (email)
DO UPDATE SET name = EXCLUDED.name;` },
  ],
  update: [
    { name: "UPDATE basic", desc: "Update rows", example: `UPDATE users SET name = 'Jane Doe' WHERE id = 1;` },
    { name: "UPDATE multiple cols", desc: "Update multiple columns", example: `UPDATE users
SET name = 'Jane Doe', email = 'jane@example.com', updated_at = NOW()
WHERE id = 1;` },
    { name: "UPDATE with subquery", desc: "Update from subquery", example: `UPDATE products
SET price = price * 1.1
WHERE category_id IN (
  SELECT id FROM categories WHERE name = 'Electronics'
);` },
    { name: "UPDATE with JOIN", desc: "Update with join (varies by DB)", example: `UPDATE orders o
SET o.status = 'cancelled'
FROM users u
WHERE o.user_id = u.id AND u.status = 'inactive';` },
    { name: "UPDATE RETURNING", desc: "Return updated rows (PostgreSQL)", example: `UPDATE users SET status = 'inactive'
WHERE last_login < NOW() - INTERVAL '1 year'
RETURNING id, email;` },
  ],
  delete: [
    { name: "DELETE basic", desc: "Delete rows", example: `DELETE FROM users WHERE id = 1;` },
    { name: "DELETE with IN", desc: "Delete multiple", example: `DELETE FROM users WHERE id IN (1, 2, 3);` },
    { name: "DELETE with subquery", desc: "Delete from subquery", example: `DELETE FROM orders
WHERE user_id IN (
  SELECT id FROM users WHERE status = 'deleted'
);` },
    { name: "DELETE all", desc: "Delete all rows (careful!)", example: `DELETE FROM temp_logs;` },
    { name: "TRUNCATE", desc: "Fast delete all (DDL)", example: `TRUNCATE TABLE temp_logs;` },
  ],
  ddl: [
    { name: "CREATE TABLE", desc: "Create new table", example: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);` },
    { name: "CREATE INDEX", desc: "Create index", example: `CREATE INDEX idx_users_email ON users (email);` },
    { name: "CREATE UNIQUE INDEX", desc: "Create unique index", example: `CREATE UNIQUE INDEX idx_users_email_unique ON users (email);` },
    { name: "ALTER TABLE add column", desc: "Add column", example: `ALTER TABLE users ADD COLUMN phone VARCHAR(20);` },
    { name: "ALTER TABLE drop column", desc: "Drop column", example: `ALTER TABLE users DROP COLUMN phone;` },
    { name: "ALTER TABLE rename", desc: "Rename column", example: `ALTER TABLE users RENAME COLUMN name TO full_name;` },
    { name: "DROP TABLE", desc: "Drop table", example: `DROP TABLE IF EXISTS temp_data;` },
    { name: "DROP INDEX", desc: "Drop index", example: `DROP INDEX IF EXISTS idx_users_email;` },
  ],
  window: [
    { name: "ROW_NUMBER()", desc: "Row number in partition", example: `SELECT name, department,
  ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as rank
FROM employees;` },
    { name: "RANK()", desc: "Rank with gaps", example: `SELECT name, score,
  RANK() OVER (ORDER BY score DESC) as rank
FROM students;` },
    { name: "DENSE_RANK()", desc: "Rank without gaps", example: `SELECT name, score,
  DENSE_RANK() OVER (ORDER BY score DESC) as rank
FROM students;` },
    { name: "LAG()", desc: "Previous row value", example: `SELECT date, revenue,
  LAG(revenue) OVER (ORDER BY date) as prev_revenue,
  revenue - LAG(revenue) OVER (ORDER BY date) as change
FROM daily_sales;` },
    { name: "LEAD()", desc: "Next row value", example: `SELECT date, revenue,
  LEAD(revenue) OVER (ORDER BY date) as next_revenue
FROM daily_sales;` },
    { name: "SUM() OVER", desc: "Running total", example: `SELECT date, amount,
  SUM(amount) OVER (ORDER BY date) as running_total
FROM transactions;` },
    { name: "AVG() OVER", desc: "Moving average", example: `SELECT date, price,
  AVG(price) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as moving_avg_7d
FROM stock_prices;` },
  ],
  cte: [
    { name: "WITH (CTE)", desc: "Common Table Expression", example: `WITH active_users AS (
  SELECT * FROM users WHERE status = 'active'
)
SELECT * FROM active_users WHERE created_at > '2024-01-01';` },
    { name: "Multiple CTEs", desc: "Chain multiple CTEs", example: `WITH
  active_users AS (
    SELECT * FROM users WHERE status = 'active'
  ),
  user_orders AS (
    SELECT user_id, COUNT(*) as order_count
    FROM orders
    GROUP BY user_id
  )
SELECT u.name, COALESCE(o.order_count, 0) as orders
FROM active_users u
LEFT JOIN user_orders o ON u.id = o.user_id;` },
    { name: "Recursive CTE", desc: "Recursive query", example: `WITH RECURSIVE subordinates AS (
  SELECT id, name, manager_id, 1 as level
  FROM employees
  WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, e.manager_id, s.level + 1
  FROM employees e
  JOIN subordinates s ON e.manager_id = s.id
)
SELECT * FROM subordinates ORDER BY level, name;` },
  ],
  functions: [
    { name: "String functions", desc: "Common string functions", example: `SELECT
  UPPER(name) as upper_name,
  LOWER(email) as lower_email,
  LENGTH(name) as name_length,
  CONCAT(first_name, ' ', last_name) as full_name,
  SUBSTRING(phone, 1, 3) as area_code
FROM users;` },
    { name: "Date functions", desc: "Common date functions", example: `SELECT
  NOW() as current_time,
  CURRENT_DATE as today,
  DATE_TRUNC('month', created_at) as month,
  EXTRACT(YEAR FROM created_at) as year,
  AGE(NOW(), created_at) as account_age
FROM users;` },
    { name: "COALESCE", desc: "First non-null value", example: `SELECT COALESCE(nickname, name, 'Unknown') as display_name
FROM users;` },
    { name: "NULLIF", desc: "Return NULL if equal", example: `SELECT total / NULLIF(quantity, 0) as unit_price
FROM order_items;` },
    { name: "CASE expression", desc: "Conditional logic", example: `SELECT name,
  CASE
    WHEN age < 18 THEN 'Minor'
    WHEN age < 65 THEN 'Adult'
    ELSE 'Senior'
  END as age_group
FROM users;` },
    { name: "CAST / type conversion", desc: "Convert types", example: `SELECT
  CAST(price AS INTEGER) as int_price,
  total::TEXT as total_text,
  TO_CHAR(created_at, 'YYYY-MM-DD') as date_str
FROM orders;` },
  ],
};

export interface QueryViewProps {
  tab: {
    id: string;
    connectionKey?: string;
    connectionName?: string;
    sql?: string;
    columns?: string[];
    rows?: Record<string, unknown>[];
    loading?: boolean;
    error?: string;
    history?: QueryHistoryEntry[];
    limitApplied?: boolean;
    limit?: number;
    hasMore?: boolean;
    duration?: number;
  };
  onTabUpdate: (
    tabId: string,
    updates: {
      sql?: string;
      columns?: string[];
      rows?: Record<string, unknown>[];
      loading?: boolean;
      error?: string;
      history?: QueryHistoryEntry[];
      isDirty?: boolean;
      limitApplied?: boolean;
      limit?: number;
      hasMore?: boolean;
      duration?: number;
    }
  ) => void;
}

/**
 * Extract database type from connection key
 * Connection keys have format: "dbtype:identifier"
 */
function getDbTypeFromConnectionKey(connectionKey?: string): SqlDatabaseType {
  if (!connectionKey) return "postgres";
  const [dbType] = connectionKey.split(":");
  const validTypes: SqlDatabaseType[] = ["postgres", "mysql", "mariadb", "sqlserver", "sqlite"];
  return validTypes.includes(dbType as SqlDatabaseType) ? (dbType as SqlDatabaseType) : "postgres";
}

/**
 * Extract FK relationships from column metadata
 */
function extractForeignKeys(columns: Record<string, ColumnMetadata[]>): ForeignKeyRelation[] {
  const foreignKeys: ForeignKeyRelation[] = [];

  for (const [tableKey, cols] of Object.entries(columns)) {
    // Validate tableKey format
    if (!tableKey || typeof tableKey !== 'string') continue;

    const tableParts = tableKey.split(".");
    const sourceSchema = tableParts[0] || "public";
    const sourceTable = tableParts[1] || tableParts[0] || "";

    // Validate cols is an array
    if (!Array.isArray(cols)) continue;

    for (const col of cols) {
      // Validate column structure
      if (!col || typeof col !== 'object') continue;
      if (!col.isForeignKey || !col.foreignKeyRef) continue;

      // Validate foreignKeyRef is a non-empty string
      const fkRef = col.foreignKeyRef;
      if (typeof fkRef !== 'string' || !fkRef.trim()) continue;

      // foreignKeyRef format: "schema.table.column" or "table.column"
      const parts = fkRef.split(".");

      // Skip malformed references (need at least table.column)
      if (parts.length < 2 || parts.some(p => !p.trim())) {
        console.warn(`Skipping malformed foreign key reference: "${fkRef}"`);
        continue;
      }

      if (parts.length >= 3) {
        foreignKeys.push({
          sourceSchema,
          sourceTable,
          sourceColumn: col.name,
          targetSchema: parts[0],
          targetTable: parts[1],
          targetColumn: parts.slice(2).join("."), // Handle column names with dots
        });
      } else if (parts.length === 2) {
        // "table.column" format (no schema)
        foreignKeys.push({
          sourceSchema,
          sourceTable,
          sourceColumn: col.name,
          targetSchema: sourceSchema,
          targetTable: parts[0],
          targetColumn: parts[1],
        });
      }
    }
  }

  return foreignKeys;
}

export function QueryView({ tab, onTabUpdate }: QueryViewProps) {
  const [autocompleteData, setAutocompleteData] = useState<{
    schemas: string[];
    tables: TableInfo[];
    columns: Record<string, ColumnMetadata[]>;
  }>({
    schemas: [],
    tables: [],
    columns: {},
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExplainPanel, setShowExplainPanel] = useState(false);
  const [explainPlan, setExplainPlan] = useState<ExplainPlan | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | undefined>();

  const api = getElectronAPI();
  const sqlEditorRef = useRef<SqlEditorRef>(null);

  // Use shared stores for query history and saved queries
  const {
    entries: queryHistory,
    addQuery: addQueryToHistory,
    toggleFavorite,
    clearHistory,
  } = useQueryHistoryStore();
  const {
    queries: savedQueries,
    addQuery: addSavedQuery,
    updateQuery: updateSavedQuery,
    deleteQuery: deleteSavedQuery,
  } = useSavedQueriesStore();

  // Extract database type from connection key
  const dbType = useMemo(
    () => getDbTypeFromConnectionKey(tab.connectionKey),
    [tab.connectionKey]
  );

  // Extract FK relationships from column metadata
  const foreignKeys = useMemo(
    () => extractForeignKeys(autocompleteData.columns),
    [autocompleteData.columns]
  );

  // Load autocomplete data on mount
  useEffect(() => {
    if (!tab.connectionKey || !api) {
      return;
    }

    // Track if effect is still active (prevents state updates after unmount/change)
    let isActive = true;

    api
      .getAutocompleteData(tab.connectionKey)
      .then((data) => {
        // Only update state if this effect is still active
        if (isActive) {
          setAutocompleteData({
            schemas: data.schemas || [],
            tables: data.tables || [],
            columns: data.columns || {},
          });
        }
      })
      .catch((err) => {
        // Silently ignore "Not connected" errors - they're expected when the app loads
        // before the user has connected to the database
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (isActive && !errorMessage.includes("Not connected")) {
          console.error("Failed to load autocomplete data:", err);
        }
      });

    // Cleanup: mark effect as inactive
    return () => {
      isActive = false;
    };
  }, [tab.connectionKey, api]);

  // Handle run query
  const handleRunQuery = useCallback(async (sqlToExecute?: string) => {
    // Use provided SQL (selected text) or fall back to full tab SQL
    const sqlToRun = sqlToExecute?.trim() || tab.sql?.trim();

    if (!sqlToRun || !tab.connectionKey || !api) {
      if (!tab.connectionKey) {
        toast.error("No connection selected");
      }
      return;
    }

    const startTime = Date.now();
    onTabUpdate(tab.id, { loading: true, error: undefined });

    try {
      const result = await api.runQuery({
        connectionKey: tab.connectionKey,
        sql: sqlToRun,
      });

      const duration = Date.now() - startTime;

      // Add to shared query history store
      addQueryToHistory(sqlToRun, true, duration, result.rows.length);

      onTabUpdate(tab.id, {
        columns: result.columns,
        rows: result.rows,
        loading: false,
        limitApplied: result.limitApplied,
        limit: result.limit,
        hasMore: result.hasMore,
        duration,
      });

      toast.success(`Query executed successfully (${result.rows.length} rows, ${duration}ms)`);
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = getErrorMessage(error);

      // Add failed query to shared history store
      addQueryToHistory(sqlToRun, false, duration, undefined, errorMessage);

      onTabUpdate(tab.id, {
        loading: false,
        error: errorMessage,
      });

      toast.error(`Query failed: ${errorMessage}`);
    }
  }, [tab, onTabUpdate, api, addQueryToHistory]);

  // Handle cancel query
  const handleCancelQuery = useCallback(async () => {
    if (!tab.connectionKey || !api) {
      return;
    }

    try {
      await api.cancelQuery(tab.connectionKey);

      // Update UI state
      onTabUpdate(tab.id, {
        loading: false,
        error: "Query cancelled by user",
      });

      toast.info("Query cancelled");
    } catch (error: unknown) {
      console.error("Failed to cancel query:", error);

      // Even if cancellation failed, update UI state
      onTabUpdate(tab.id, {
        loading: false,
        error: "Query cancellation failed, but query may have completed",
      });

      toast.error(`Failed to cancel query: ${getErrorMessage(error)}`);
    }
  }, [tab.connectionKey, tab.id, onTabUpdate, api]);

  // Handle format SQL
  const handleFormatSql = useCallback(async () => {
    if (!tab.sql || !api) return;

    try {
      const formatted = await api.formatSql(tab.sql);
      onTabUpdate(tab.id, { sql: formatted, isDirty: true });
      toast.success("SQL formatted successfully");
    } catch (error: unknown) {
      toast.error(`Failed to format SQL: ${getErrorMessage(error)}`);
    }
  }, [tab.sql, tab.id, onTabUpdate, api]);

  // Handle SQL change
  const handleSqlChange = useCallback(
    (sql: string) => {
      onTabUpdate(tab.id, { sql, isDirty: true });
    },
    [tab.id, onTabUpdate]
  );

  // Handle history selection
  const handleSelectFromHistory = useCallback(
    (sql: string) => {
      onTabUpdate(tab.id, { sql, isDirty: true });
    },
    [tab.id, onTabUpdate]
  );

  // Handle clear history - use shared store
  const handleClearHistory = useCallback(() => {
    clearHistory();
    toast.success("Query history cleared");
  }, [clearHistory]);

  // Handle toggle favorite for query history - use shared store
  const handleToggleFavorite = useCallback((entryId: string) => {
    toggleFavorite(entryId);
  }, [toggleFavorite]);

  // Handle save current query - opens modal
  const handleSaveQuery = useCallback(() => {
    if (!tab.sql?.trim()) {
      toast.error("No query to save");
      return;
    }
    setShowSaveModal(true);
  }, [tab.sql]);

  // Handle actual save from modal - use shared store
  const handleSaveQueryConfirm = useCallback((name: string, description: string) => {
    if (!tab.sql?.trim()) {
      return;
    }

    addSavedQuery(name, tab.sql.trim(), description || undefined);
    toast.success(`Query "${name}" saved successfully`);
  }, [tab.sql, addSavedQuery]);

  // Handle select saved query
  const handleSelectSavedQuery = useCallback(
    (sql: string) => {
      onTabUpdate(tab.id, { sql, isDirty: true });
    },
    [tab.id, onTabUpdate]
  );

  // Handle update saved query - use shared store
  const handleUpdateSavedQuery = useCallback((queryId: string, updates: Partial<SavedQuery>) => {
    updateSavedQuery(queryId, updates);
    toast.success("Query updated");
  }, [updateSavedQuery]);

  // Handle delete saved query - use shared store
  const handleDeleteSavedQuery = useCallback((queryId: string) => {
    if (!confirm("Are you sure you want to delete this saved query?")) return;

    deleteSavedQuery(queryId);
    toast.success("Query deleted");
  }, [deleteSavedQuery]);

  // Handle insert example from reference panel
  const handleInsertExample = useCallback(
    (example: string) => {
      const currentSql = tab.sql || "";
      const newSql = currentSql ? `${currentSql}\n\n${example}` : example;
      onTabUpdate(tab.id, { sql: newSql, isDirty: true });
    },
    [tab.sql, tab.id, onTabUpdate]
  );

  // Handle explain query
  const handleExplainQuery = useCallback(async () => {
    if (!tab.sql?.trim() || !tab.connectionKey || !api) {
      if (!tab.connectionKey) {
        toast.error("No connection selected");
      }
      return;
    }

    setExplainLoading(true);
    setExplainError(undefined);
    setShowExplainPanel(true);

    try {
      const result = await api.explainQuery({
        connectionKey: tab.connectionKey,
        sql: tab.sql,
      });
      setExplainPlan(result);
      toast.success("Query analyzed successfully");
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      setExplainError(errorMessage);
      toast.error(`Failed to analyze query: ${errorMessage}`);
    } finally {
      setExplainLoading(false);
    }
  }, [tab, api]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      {/* Toolbar - Compact, always visible, z-10 ensures it stays above content */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-bg-secondary relative z-10">
        <div className="flex items-center gap-2">
          {tab.loading ? (
            <button
              onClick={handleCancelQuery}
              className="h-7 px-3 rounded flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          ) : (
            <button
              onClick={() => {
                const selectedText = sqlEditorRef.current?.getSelectedText();
                handleRunQuery(selectedText);
              }}
              disabled={!tab.sql?.trim()}
              className="h-7 px-3 rounded flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-3 h-3" />
              Run
              <span className="opacity-70">(Cmd+Enter)</span>
            </button>
          )}
          <button
            onClick={handleFormatSql}
            disabled={tab.loading || !tab.sql?.trim()}
            className="h-7 px-3 rounded flex items-center gap-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wand2 className="w-3 h-3" />
            Format
          </button>
          <button
            onClick={handleExplainQuery}
            disabled={tab.loading || !tab.sql?.trim() || explainLoading}
            className="h-7 px-3 rounded flex items-center gap-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Activity className="w-3 h-3" />
            Explain
          </button>
          <button
            onClick={handleSaveQuery}
            disabled={tab.loading || !tab.sql?.trim()}
            className="h-7 px-3 rounded flex items-center gap-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-3 h-3" />
            Save
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const newValue = !showSavedQueries;
              setShowSavedQueries(newValue);
              if (newValue) {
                setShowExplainPanel(false);
                setShowHistory(false);
                setShowReference(false);
              }
            }}
            className={`h-7 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showSavedQueries ? "bg-accent/20 text-accent" : "bg-bg-tertiary hover:bg-bg-hover text-text-primary"
            }`}
          >
            <Bookmark className="w-3 h-3" />
            Saved
          </button>
          <button
            onClick={() => {
              const newValue = !showExplainPanel;
              setShowExplainPanel(newValue);
              if (newValue) {
                setShowSavedQueries(false);
                setShowHistory(false);
                setShowReference(false);
              }
            }}
            className={`h-7 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showExplainPanel ? "bg-accent/20 text-accent" : "bg-bg-tertiary hover:bg-bg-hover text-text-primary"
            }`}
          >
            <Activity className="w-3 h-3" />
            Plan
          </button>
          <button
            onClick={() => {
              const newValue = !showHistory;
              setShowHistory(newValue);
              if (newValue) {
                setShowSavedQueries(false);
                setShowExplainPanel(false);
                setShowReference(false);
              }
            }}
            className={`h-7 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showHistory ? "bg-accent/20 text-accent" : "bg-bg-tertiary hover:bg-bg-hover text-text-primary"
            }`}
          >
            <History className="w-3 h-3" />
            History
          </button>
          <button
            onClick={() => {
              const newValue = !showReference;
              setShowReference(newValue);
              if (newValue) {
                setShowSavedQueries(false);
                setShowExplainPanel(false);
                setShowHistory(false);
              }
            }}
            className={`h-7 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showReference ? "bg-accent/20 text-accent" : "bg-bg-tertiary hover:bg-bg-hover text-text-primary"
            }`}
          >
            <BookOpen className="w-3 h-3" />
            Reference
          </button>
        </div>
      </div>

      {/* Main content area with vertical resizing */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PanelGroup direction="vertical">
          {/* SQL Editor Panel - Resizable */}
          <Panel defaultSize={30} minSize={15} maxSize={60}>
            <div className="h-full flex flex-col">
              <SqlEditor
                ref={sqlEditorRef}
                value={tab.sql || ""}
                onChange={handleSqlChange}
                onRunQuery={handleRunQuery}
                loading={tab.loading || false}
                error={tab.error}
                dbType={dbType}
                schemas={autocompleteData.schemas}
                tables={autocompleteData.tables}
                columns={autocompleteData.columns}
                foreignKeys={foreignKeys}
                height="100%"
              />
            </div>
          </Panel>

          {/* Vertical Resize Handle */}
          <PanelResizeHandle className="h-1 bg-border hover:bg-accent transition-colors cursor-row-resize" />

          {/* Results Panel */}
          <Panel defaultSize={70} minSize={30}>
            <div className="h-full flex flex-col overflow-hidden">
              {/* Warning Banner - Show when limit was auto-applied */}
              {tab.limitApplied && (
                <div className="h-9 px-4 flex items-center justify-between bg-yellow-500/10 border-b border-yellow-500/30 flex-shrink-0">
                  <span className="text-xs text-yellow-600 dark:text-yellow-500 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>
                      Showing first <strong>{tab.limit?.toLocaleString()}</strong> rows. Add LIMIT to your query for a custom
                      row count.
                    </span>
                  </span>
                  {tab.hasMore && tab.sql && (
                    <button
                      onClick={() => {
                        if (!tab.sql) return;
                        // Reload query with higher limit
                        // Validate and sanitize the limit value to prevent injection
                        const currentLimit = typeof tab.limit === 'number' && Number.isInteger(tab.limit) && tab.limit > 0
                          ? tab.limit
                          : 1000;
                        const newLimit = Math.min(currentLimit + 1000, 100000); // Cap at 100k for safety
                        const modifiedSql = `${tab.sql.trim()}\nLIMIT ${newLimit}`;
                        onTabUpdate(tab.id, { sql: modifiedSql, isDirty: true });
                        handleRunQuery();
                      }}
                      className="text-xs text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 font-medium underline"
                    >
                      Load 1,000 More Rows
                    </button>
                  )}
                </div>
              )}

              {/* Results Area with horizontal panels */}
              <div className="flex-1 flex overflow-hidden">
                <PanelGroup direction="horizontal">
                  {/* Results Grid */}
                  <Panel defaultSize={showHistory || showExplainPanel || showReference || showSavedQueries ? 60 : 100} minSize={40}>
                    <QueryResultsGrid
                      columns={tab.columns || []}
                      rows={tab.rows || []}
                      loading={tab.loading || false}
                      executionTime={tab.duration}
                    />
                  </Panel>

          {/* Show panels on the right */}
          {(showHistory || showExplainPanel || showReference || showSavedQueries) && (
            <>
              {/* Resize Handle */}
              <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors cursor-col-resize" />

              {/* Side panels */}
              <Panel defaultSize={40} minSize={25} maxSize={60}>
                {showReference ? (
                  <SQLReferencePanel onSelectExample={handleInsertExample} />
                ) : showSavedQueries ? (
                  <SavedQueriesPanel
                    queries={savedQueries}
                    onSelectQuery={handleSelectSavedQuery}
                    onDeleteQuery={handleDeleteSavedQuery}
                    onUpdateQuery={handleUpdateSavedQuery}
                  />
                ) : showExplainPanel && showHistory ? (
                  <PanelGroup direction="vertical">
                    <Panel defaultSize={50} minSize={30}>
                      <ExplainPlanPanel
                        open={true}
                        onClose={() => setShowExplainPanel(false)}
                        plan={explainPlan}
                        loading={explainLoading}
                        error={explainError}
                      />
                    </Panel>
                    <PanelResizeHandle className="h-1 bg-border hover:bg-accent transition-colors cursor-row-resize" />
                    <Panel defaultSize={50} minSize={30}>
                      <QueryHistoryPanel
                        history={queryHistory}
                        onSelectQuery={handleSelectFromHistory}
                        onClearHistory={handleClearHistory}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    </Panel>
                  </PanelGroup>
                ) : showExplainPanel ? (
                  <ExplainPlanPanel
                    open={true}
                    onClose={() => setShowExplainPanel(false)}
                    plan={explainPlan}
                    loading={explainLoading}
                    error={explainError}
                  />
                ) : (
                  <QueryHistoryPanel
                    history={queryHistory}
                    onSelectQuery={handleSelectFromHistory}
                    onClearHistory={handleClearHistory}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )}
              </Panel>
            </>
          )}
                </PanelGroup>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Save Query Modal */}
      <SaveQueryModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveQueryConfirm}
      />
    </div>
  );
}

// SQL Reference Panel Component
function SQLReferencePanel({ onSelectExample }: { onSelectExample: (example: string) => void }) {
  const [selectedCategory, setSelectedCategory] = useState<string>("examples");

  const categories = [
    { id: "examples", label: "Examples", icon: "⚡" },
    { id: "select", label: "SELECT", icon: "🔍" },
    { id: "joins", label: "JOINs", icon: "🔗" },
    { id: "aggregates", label: "Aggregates", icon: "📊" },
    { id: "subqueries", label: "Subqueries", icon: "📦" },
    { id: "insert", label: "INSERT", icon: "➕" },
    { id: "update", label: "UPDATE", icon: "✏️" },
    { id: "delete", label: "DELETE", icon: "🗑️" },
    { id: "ddl", label: "DDL", icon: "🏗️" },
    { id: "window", label: "Window", icon: "🪟" },
    { id: "cte", label: "CTE", icon: "🔄" },
    { id: "functions", label: "Functions", icon: "⚙️" },
  ];

  const commands = SQL_COMMANDS[selectedCategory as keyof typeof SQL_COMMANDS] || [];

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      <div className="p-2 border-b border-border">
        <h3 className="text-xs font-medium text-text-primary flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5" />
          SQL Reference
        </h3>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-bg-tertiary">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              selectedCategory === cat.id
                ? "bg-accent text-white"
                : "bg-bg-secondary text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            <span className="mr-1">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Commands list */}
      <div className="flex-1 overflow-auto">
        {commands.map(({ name, desc, example }) => (
          <button
            key={name}
            onClick={() => onSelectExample(example)}
            className="w-full px-3 py-2 text-left hover:bg-bg-hover border-b border-border/50 transition-colors"
          >
            <div className="flex items-start gap-2">
              <code className="text-xs font-mono text-accent font-medium">{name}</code>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
            <code className="text-xs font-mono text-text-tertiary mt-1 block bg-bg-tertiary px-2 py-1 rounded whitespace-pre-wrap max-h-20 overflow-hidden">
              {example.length > 100 ? example.substring(0, 100) + "..." : example}
            </code>
          </button>
        ))}
      </div>
    </div>
  );
}
