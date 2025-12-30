import { useState, type FC } from "react";
import { BookOpen, Search, ChevronRight } from "lucide-react";
import clsx from "clsx";

// Comprehensive SQL commands organized by category
const SQL_COMMANDS = {
  examples: [
    { name: "Select All", desc: "Get all rows from table", example: `SELECT * FROM users LIMIT 100;` },
    { name: "Select with Filter", desc: "Filter rows with WHERE", example: `SELECT * FROM users WHERE status = 'active';` },
    { name: "Select Columns", desc: "Select specific columns", example: `SELECT id, name, email FROM users WHERE id = 1;` },
    { name: "Insert Row", desc: "Insert a new row", example: `INSERT INTO users (name, email, created_at)\nVALUES ('John Doe', 'john@example.com', NOW());` },
    { name: "Update Row", desc: "Update existing rows", example: `UPDATE users SET name = 'Jane Doe', updated_at = NOW()\nWHERE id = 1;` },
    { name: "Delete Row", desc: "Delete rows", example: `DELETE FROM users WHERE id = 1;` },
    { name: "Count Rows", desc: "Count matching rows", example: `SELECT COUNT(*) FROM users WHERE status = 'active';` },
    { name: "Join Tables", desc: "Join two tables", example: `SELECT u.name, o.total\nFROM users u\nJOIN orders o ON u.id = o.user_id\nWHERE o.status = 'completed';` },
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
    { name: "INNER JOIN", desc: "Match rows in both tables", example: `SELECT u.name, o.total\nFROM users u\nINNER JOIN orders o ON u.id = o.user_id;` },
    { name: "LEFT JOIN", desc: "All from left, matching from right", example: `SELECT u.name, o.total\nFROM users u\nLEFT JOIN orders o ON u.id = o.user_id;` },
    { name: "RIGHT JOIN", desc: "All from right, matching from left", example: `SELECT u.name, o.total\nFROM users u\nRIGHT JOIN orders o ON u.id = o.user_id;` },
    { name: "FULL OUTER JOIN", desc: "All from both tables", example: `SELECT u.name, o.total\nFROM users u\nFULL OUTER JOIN orders o ON u.id = o.user_id;` },
    { name: "CROSS JOIN", desc: "Cartesian product", example: `SELECT * FROM sizes CROSS JOIN colors;` },
    { name: "Self JOIN", desc: "Join table to itself", example: `SELECT e.name AS employee, m.name AS manager\nFROM employees e\nLEFT JOIN employees m ON e.manager_id = m.id;` },
    { name: "Multiple JOINs", desc: "Join multiple tables", example: `SELECT u.name, o.id, p.name AS product\nFROM users u\nJOIN orders o ON u.id = o.user_id\nJOIN order_items oi ON o.id = oi.order_id\nJOIN products p ON oi.product_id = p.id;` },
  ],
  aggregates: [
    { name: "COUNT(*)", desc: "Count all rows", example: `SELECT COUNT(*) FROM users;` },
    { name: "COUNT(column)", desc: "Count non-null values", example: `SELECT COUNT(email) FROM users;` },
    { name: "SUM()", desc: "Sum of values", example: `SELECT SUM(total) FROM orders WHERE status = 'completed';` },
    { name: "AVG()", desc: "Average value", example: `SELECT AVG(price) FROM products;` },
    { name: "MIN() / MAX()", desc: "Min and max values", example: `SELECT MIN(price), MAX(price) FROM products;` },
    { name: "GROUP BY", desc: "Group rows", example: `SELECT status, COUNT(*) as count\nFROM orders\nGROUP BY status;` },
    { name: "GROUP BY multiple", desc: "Group by multiple columns", example: `SELECT year, month, SUM(total) as revenue\nFROM orders\nGROUP BY year, month\nORDER BY year, month;` },
    { name: "HAVING", desc: "Filter groups", example: `SELECT user_id, COUNT(*) as order_count\nFROM orders\nGROUP BY user_id\nHAVING COUNT(*) > 5;` },
  ],
  subqueries: [
    { name: "Subquery in WHERE", desc: "Filter with subquery", example: `SELECT * FROM users\nWHERE id IN (\n  SELECT user_id FROM orders WHERE total > 1000\n);` },
    { name: "Subquery in FROM", desc: "Derived table", example: `SELECT avg_total\nFROM (\n  SELECT user_id, AVG(total) as avg_total\n  FROM orders\n  GROUP BY user_id\n) as user_averages\nWHERE avg_total > 500;` },
    { name: "Subquery in SELECT", desc: "Scalar subquery", example: `SELECT name,\n  (SELECT COUNT(*) FROM orders WHERE orders.user_id = users.id) as order_count\nFROM users;` },
    { name: "EXISTS", desc: "Check existence", example: `SELECT * FROM users u\nWHERE EXISTS (\n  SELECT 1 FROM orders o WHERE o.user_id = u.id\n);` },
    { name: "NOT EXISTS", desc: "Check non-existence", example: `SELECT * FROM users u\nWHERE NOT EXISTS (\n  SELECT 1 FROM orders o WHERE o.user_id = u.id\n);` },
  ],
  insert: [
    { name: "INSERT single", desc: "Insert one row", example: `INSERT INTO users (name, email)\nVALUES ('John Doe', 'john@example.com');` },
    { name: "INSERT multiple", desc: "Insert multiple rows", example: `INSERT INTO users (name, email) VALUES\n  ('John Doe', 'john@example.com'),\n  ('Jane Smith', 'jane@example.com'),\n  ('Bob Wilson', 'bob@example.com');` },
    { name: "INSERT from SELECT", desc: "Insert from query", example: `INSERT INTO archived_orders (id, user_id, total)\nSELECT id, user_id, total\nFROM orders\nWHERE created_at < '2023-01-01';` },
    { name: "INSERT RETURNING", desc: "Return inserted row (PostgreSQL)", example: `INSERT INTO users (name, email)\nVALUES ('John Doe', 'john@example.com')\nRETURNING id, created_at;` },
    { name: "INSERT ON CONFLICT", desc: "Upsert (PostgreSQL)", example: `INSERT INTO users (email, name)\nVALUES ('john@example.com', 'John Doe')\nON CONFLICT (email)\nDO UPDATE SET name = EXCLUDED.name;` },
  ],
  update: [
    { name: "UPDATE basic", desc: "Update rows", example: `UPDATE users SET name = 'Jane Doe' WHERE id = 1;` },
    { name: "UPDATE multiple cols", desc: "Update multiple columns", example: `UPDATE users\nSET name = 'Jane Doe', email = 'jane@example.com', updated_at = NOW()\nWHERE id = 1;` },
    { name: "UPDATE with subquery", desc: "Update from subquery", example: `UPDATE products\nSET price = price * 1.1\nWHERE category_id IN (\n  SELECT id FROM categories WHERE name = 'Electronics'\n);` },
    { name: "UPDATE with JOIN", desc: "Update with join (varies by DB)", example: `UPDATE orders o\nSET o.status = 'cancelled'\nFROM users u\nWHERE o.user_id = u.id AND u.status = 'inactive';` },
    { name: "UPDATE RETURNING", desc: "Return updated rows (PostgreSQL)", example: `UPDATE users SET status = 'inactive'\nWHERE last_login < NOW() - INTERVAL '1 year'\nRETURNING id, email;` },
  ],
  delete: [
    { name: "DELETE basic", desc: "Delete rows", example: `DELETE FROM users WHERE id = 1;` },
    { name: "DELETE with IN", desc: "Delete multiple", example: `DELETE FROM users WHERE id IN (1, 2, 3);` },
    { name: "DELETE with subquery", desc: "Delete from subquery", example: `DELETE FROM orders\nWHERE user_id IN (\n  SELECT id FROM users WHERE status = 'deleted'\n);` },
    { name: "DELETE all", desc: "Delete all rows (careful!)", example: `DELETE FROM temp_logs;` },
    { name: "TRUNCATE", desc: "Fast delete all (DDL)", example: `TRUNCATE TABLE temp_logs;` },
  ],
  ddl: [
    { name: "CREATE TABLE", desc: "Create new table", example: `CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(255) UNIQUE NOT NULL,\n  status VARCHAR(50) DEFAULT 'active',\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);` },
    { name: "CREATE INDEX", desc: "Create index", example: `CREATE INDEX idx_users_email ON users (email);` },
    { name: "CREATE UNIQUE INDEX", desc: "Create unique index", example: `CREATE UNIQUE INDEX idx_users_email_unique ON users (email);` },
    { name: "ALTER TABLE add column", desc: "Add column", example: `ALTER TABLE users ADD COLUMN phone VARCHAR(20);` },
    { name: "ALTER TABLE drop column", desc: "Drop column", example: `ALTER TABLE users DROP COLUMN phone;` },
    { name: "ALTER TABLE rename", desc: "Rename column", example: `ALTER TABLE users RENAME COLUMN name TO full_name;` },
    { name: "DROP TABLE", desc: "Drop table", example: `DROP TABLE IF EXISTS temp_data;` },
    { name: "DROP INDEX", desc: "Drop index", example: `DROP INDEX IF EXISTS idx_users_email;` },
  ],
  window: [
    { name: "ROW_NUMBER()", desc: "Row number in partition", example: `SELECT name, department,\n  ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as rank\nFROM employees;` },
    { name: "RANK()", desc: "Rank with gaps", example: `SELECT name, score,\n  RANK() OVER (ORDER BY score DESC) as rank\nFROM students;` },
    { name: "DENSE_RANK()", desc: "Rank without gaps", example: `SELECT name, score,\n  DENSE_RANK() OVER (ORDER BY score DESC) as rank\nFROM students;` },
    { name: "LAG()", desc: "Previous row value", example: `SELECT date, revenue,\n  LAG(revenue) OVER (ORDER BY date) as prev_revenue,\n  revenue - LAG(revenue) OVER (ORDER BY date) as change\nFROM daily_sales;` },
    { name: "LEAD()", desc: "Next row value", example: `SELECT date, revenue,\n  LEAD(revenue) OVER (ORDER BY date) as next_revenue\nFROM daily_sales;` },
    { name: "SUM() OVER", desc: "Running total", example: `SELECT date, amount,\n  SUM(amount) OVER (ORDER BY date) as running_total\nFROM transactions;` },
    { name: "AVG() OVER", desc: "Moving average", example: `SELECT date, price,\n  AVG(price) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as moving_avg_7d\nFROM stock_prices;` },
  ],
  cte: [
    { name: "WITH (CTE)", desc: "Common Table Expression", example: `WITH active_users AS (\n  SELECT * FROM users WHERE status = 'active'\n)\nSELECT * FROM active_users WHERE created_at > '2024-01-01';` },
    { name: "Multiple CTEs", desc: "Chain multiple CTEs", example: `WITH\n  active_users AS (\n    SELECT * FROM users WHERE status = 'active'\n  ),\n  user_orders AS (\n    SELECT user_id, COUNT(*) as order_count\n    FROM orders\n    GROUP BY user_id\n  )\nSELECT u.name, COALESCE(o.order_count, 0) as orders\nFROM active_users u\nLEFT JOIN user_orders o ON u.id = o.user_id;` },
    { name: "Recursive CTE", desc: "Recursive query", example: `WITH RECURSIVE subordinates AS (\n  SELECT id, name, manager_id, 1 as level\n  FROM employees\n  WHERE manager_id IS NULL\n  UNION ALL\n  SELECT e.id, e.name, e.manager_id, s.level + 1\n  FROM employees e\n  JOIN subordinates s ON e.manager_id = s.id\n)\nSELECT * FROM subordinates ORDER BY level, name;` },
  ],
  functions: [
    { name: "String functions", desc: "Common string functions", example: `SELECT\n  UPPER(name) as upper_name,\n  LOWER(email) as lower_email,\n  LENGTH(name) as name_length,\n  CONCAT(first_name, ' ', last_name) as full_name,\n  SUBSTRING(phone, 1, 3) as area_code\nFROM users;` },
    { name: "Date functions", desc: "Common date functions", example: `SELECT\n  NOW() as current_time,\n  CURRENT_DATE as today,\n  DATE_TRUNC('month', created_at) as month,\n  EXTRACT(YEAR FROM created_at) as year,\n  AGE(NOW(), created_at) as account_age\nFROM users;` },
    { name: "COALESCE", desc: "First non-null value", example: `SELECT COALESCE(nickname, name, 'Unknown') as display_name\nFROM users;` },
    { name: "NULLIF", desc: "Return NULL if equal", example: `SELECT total / NULLIF(quantity, 0) as unit_price\nFROM order_items;` },
    { name: "CASE expression", desc: "Conditional logic", example: `SELECT name,\n  CASE\n    WHEN age < 18 THEN 'Minor'\n    WHEN age < 65 THEN 'Adult'\n    ELSE 'Senior'\n  END as age_group\nFROM users;` },
    { name: "CAST / type conversion", desc: "Convert types", example: `SELECT\n  CAST(price AS INTEGER) as int_price,\n  total::TEXT as total_text,\n  TO_CHAR(created_at, 'YYYY-MM-DD') as date_str\nFROM orders;` },
  ],
};

const CATEGORIES = [
  { id: "examples", label: "Examples", icon: "lightning" },
  { id: "select", label: "SELECT", icon: "search" },
  { id: "joins", label: "JOINs", icon: "link" },
  { id: "aggregates", label: "Aggregates", icon: "chart" },
  { id: "subqueries", label: "Subqueries", icon: "box" },
  { id: "insert", label: "INSERT", icon: "plus" },
  { id: "update", label: "UPDATE", icon: "edit" },
  { id: "delete", label: "DELETE", icon: "trash" },
  { id: "ddl", label: "DDL", icon: "build" },
  { id: "window", label: "Window", icon: "window" },
  { id: "cte", label: "CTE", icon: "refresh" },
  { id: "functions", label: "Functions", icon: "cog" },
];

interface SqlReferencePanelProps {
  onSelectExample: (sql: string) => void;
}

export const SqlReferencePanel: FC<SqlReferencePanelProps> = ({ onSelectExample }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("examples");
  const [searchTerm, setSearchTerm] = useState("");

  const commands = SQL_COMMANDS[selectedCategory as keyof typeof SQL_COMMANDS] || [];

  // Filter commands based on search
  const filteredCommands = searchTerm
    ? commands.filter(
        cmd =>
          cmd.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cmd.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cmd.example.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : commands;

  return (
    <div className="h-full flex flex-col bg-vscode-bg">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-vscode-border">
        <BookOpen className="h-4 w-4 text-vscode-text-muted" />
        <span className="text-sm font-medium text-vscode-text">SQL Reference</span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-vscode-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-vscode-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search SQL examples..."
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded bg-vscode-bg-lighter border border-vscode-border text-vscode-text placeholder-vscode-text-muted focus:outline-none focus:border-vscode-accent"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-vscode-border bg-vscode-bg-light">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategory(cat.id);
              setSearchTerm("");
            }}
            className={clsx(
              "px-2 py-1 text-2xs rounded transition-colors",
              selectedCategory === cat.id
                ? "bg-vscode-accent text-white"
                : "bg-vscode-bg-lighter text-vscode-text-muted hover:bg-vscode-bg-hover hover:text-vscode-text"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Commands list */}
      <div className="flex-1 overflow-auto">
        {filteredCommands.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-vscode-text-muted text-xs p-4">
            <Search className="h-8 w-8 mb-2 opacity-30" />
            <p>No matching examples</p>
          </div>
        ) : (
          <div className="divide-y divide-vscode-border">
            {filteredCommands.map(({ name, desc, example }) => (
              <button
                key={name}
                onClick={() => onSelectExample(example)}
                className="w-full px-3 py-2.5 text-left hover:bg-vscode-bg-hover transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <code className="text-xs font-mono text-vscode-accent font-medium">{name}</code>
                  <ChevronRight className="h-3 w-3 text-vscode-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-2xs text-vscode-text-muted mt-0.5">{desc}</p>
                <code className="text-2xs font-mono text-vscode-text-muted mt-1.5 block bg-vscode-bg-lighter px-2 py-1.5 rounded whitespace-pre-wrap line-clamp-3 overflow-hidden">
                  {example}
                </code>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-vscode-border bg-vscode-bg-light">
        <p className="text-2xs text-vscode-text-muted text-center">
          Click an example to insert it into the editor
        </p>
      </div>
    </div>
  );
};
