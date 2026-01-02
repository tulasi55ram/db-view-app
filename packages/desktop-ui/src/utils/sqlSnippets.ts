import { snippetCompletion } from "@codemirror/autocomplete";
import type { Completion } from "@codemirror/autocomplete";

/**
 * Built-in SQL snippet templates with interactive placeholders
 *
 * Uses CodeMirror 6 snippet syntax:
 * - ${name} - Placeholder with default text "name"
 * - ${1:default} - Numbered placeholder with custom tab order
 * - Same number (e.g., ${1:t1}) = linked fields (edit one updates all)
 * - Final ${} - Empty placeholder, deactivates snippet on Tab
 *
 * Tab navigation:
 * - Tab → Move to next placeholder
 * - Shift+Tab → Move to previous placeholder
 * - Escape → Clear snippet and return to normal editing
 */
export const SQL_SNIPPETS: Completion[] = [
  // ==================== BASIC QUERIES ====================

  // SELECT - Basic query
  snippetCompletion(
    "SELECT ${1:*}\nFROM ${2:table_name}\nWHERE ${3:condition}\nLIMIT ${4:100};${}",
    {
      label: "SELECT",
      detail: "Basic SELECT query",
      type: "snippet",
      boost: 10,
    }
  ),

  // SELECT with columns
  snippetCompletion(
    "SELECT ${1:col1}, ${2:col2}, ${3:col3}\nFROM ${4:table_name}\nWHERE ${5:id} = ${6:value};${}",
    {
      label: "SELECT columns",
      detail: "SELECT specific columns",
      type: "snippet",
      boost: 10,
    }
  ),

  // SELECT DISTINCT
  snippetCompletion(
    "SELECT DISTINCT ${1:column}\nFROM ${2:table_name}\nORDER BY ${1:column};${}",
    {
      label: "SELECT DISTINCT",
      detail: "Select unique values",
      type: "snippet",
      boost: 9,
    }
  ),

  // ==================== JOINS ====================

  // SELECT JOIN - Inner join with aliases
  snippetCompletion(
    "SELECT ${1:t1}.${2:col1}, ${3:t2}.${4:col2}\nFROM ${5:table1} ${1:t1}\nINNER JOIN ${6:table2} ${3:t2} ON ${1:t1}.${7:id} = ${3:t2}.${8:foreign_id}\nWHERE ${9:1=1}\nLIMIT ${10:100};${}",
    {
      label: "SELECT JOIN",
      detail: "SELECT with INNER JOIN",
      type: "snippet",
      boost: 9,
    }
  ),

  // LEFT JOIN
  snippetCompletion(
    "SELECT ${1:t1}.*, ${2:t2}.*\nFROM ${3:table1} ${1:t1}\nLEFT JOIN ${4:table2} ${2:t2} ON ${1:t1}.${5:id} = ${2:t2}.${6:foreign_id}\nWHERE ${7:1=1};${}",
    {
      label: "LEFT JOIN",
      detail: "SELECT with LEFT JOIN",
      type: "snippet",
      boost: 9,
    }
  ),

  // Multiple JOINs
  snippetCompletion(
    "SELECT\n  ${1:a}.${2:col1},\n  ${3:b}.${4:col2},\n  ${5:c}.${6:col3}\nFROM ${7:table1} ${1:a}\nJOIN ${8:table2} ${3:b} ON ${1:a}.${9:id} = ${3:b}.${10:a_id}\nJOIN ${11:table3} ${5:c} ON ${3:b}.${12:id} = ${5:c}.${13:b_id}\nWHERE ${14:1=1};${}",
    {
      label: "MULTI JOIN",
      detail: "SELECT with multiple JOINs",
      type: "snippet",
      boost: 8,
    }
  ),

  // Self JOIN
  snippetCompletion(
    "SELECT\n  ${1:child}.${2:name} AS ${3:child_name},\n  ${4:parent}.${2:name} AS ${5:parent_name}\nFROM ${6:table} ${1:child}\nLEFT JOIN ${6:table} ${4:parent} ON ${1:child}.${7:parent_id} = ${4:parent}.${8:id};${}",
    {
      label: "SELF JOIN",
      detail: "Join table to itself",
      type: "snippet",
      boost: 8,
    }
  ),

  // ==================== AGGREGATIONS ====================

  // COUNT GROUP
  snippetCompletion(
    "SELECT ${1:column}, COUNT(*) AS ${2:count}\nFROM ${3:table_name}\nGROUP BY ${1:column}\nORDER BY ${2:count} DESC\nLIMIT ${4:10};${}",
    {
      label: "COUNT GROUP",
      detail: "Count with GROUP BY",
      type: "snippet",
      boost: 8,
    }
  ),

  // SUM/AVG GROUP
  snippetCompletion(
    "SELECT\n  ${1:group_column},\n  SUM(${2:amount}) AS total,\n  AVG(${2:amount}) AS average,\n  COUNT(*) AS count\nFROM ${3:table_name}\nGROUP BY ${1:group_column}\nHAVING SUM(${2:amount}) > ${4:0}\nORDER BY total DESC;${}",
    {
      label: "SUM AVG GROUP",
      detail: "Aggregations with GROUP BY",
      type: "snippet",
      boost: 8,
    }
  ),

  // ==================== WINDOW FUNCTIONS ====================

  // ROW_NUMBER
  snippetCompletion(
    "SELECT\n  ${1:*},\n  ROW_NUMBER() OVER (ORDER BY ${2:column}) AS row_num\nFROM ${3:table_name};${}",
    {
      label: "ROW_NUMBER",
      detail: "Row number window function",
      type: "snippet",
      boost: 8,
    }
  ),

  // ROW_NUMBER with PARTITION
  snippetCompletion(
    "SELECT\n  ${1:*},\n  ROW_NUMBER() OVER (\n    PARTITION BY ${2:partition_column}\n    ORDER BY ${3:order_column}\n  ) AS row_num\nFROM ${4:table_name};${}",
    {
      label: "ROW_NUMBER PARTITION",
      detail: "Row number with partition",
      type: "snippet",
      boost: 8,
    }
  ),

  // RANK / DENSE_RANK
  snippetCompletion(
    "SELECT\n  ${1:*},\n  RANK() OVER (ORDER BY ${2:score} DESC) AS rank,\n  DENSE_RANK() OVER (ORDER BY ${2:score} DESC) AS dense_rank\nFROM ${3:table_name};${}",
    {
      label: "RANK",
      detail: "Rank window functions",
      type: "snippet",
      boost: 8,
    }
  ),

  // LAG / LEAD
  snippetCompletion(
    "SELECT\n  ${1:date},\n  ${2:value},\n  LAG(${2:value}) OVER (ORDER BY ${1:date}) AS prev_value,\n  LEAD(${2:value}) OVER (ORDER BY ${1:date}) AS next_value,\n  ${2:value} - LAG(${2:value}) OVER (ORDER BY ${1:date}) AS change\nFROM ${3:table_name};${}",
    {
      label: "LAG LEAD",
      detail: "Previous/next row values",
      type: "snippet",
      boost: 8,
    }
  ),

  // Running total
  snippetCompletion(
    "SELECT\n  ${1:date},\n  ${2:amount},\n  SUM(${2:amount}) OVER (ORDER BY ${1:date}) AS running_total\nFROM ${3:table_name}\nORDER BY ${1:date};${}",
    {
      label: "RUNNING TOTAL",
      detail: "Cumulative sum",
      type: "snippet",
      boost: 8,
    }
  ),

  // Moving average
  snippetCompletion(
    "SELECT\n  ${1:date},\n  ${2:value},\n  AVG(${2:value}) OVER (\n    ORDER BY ${1:date}\n    ROWS BETWEEN ${3:6} PRECEDING AND CURRENT ROW\n  ) AS moving_avg\nFROM ${4:table_name};${}",
    {
      label: "MOVING AVG",
      detail: "Moving average window",
      type: "snippet",
      boost: 7,
    }
  ),

  // ==================== CTEs ====================

  // Basic CTE
  snippetCompletion(
    "WITH ${1:cte_name} AS (\n  SELECT ${2:*}\n  FROM ${3:table_name}\n  WHERE ${4:condition}\n)\nSELECT *\nFROM ${1:cte_name};${}",
    {
      label: "WITH CTE",
      detail: "Common Table Expression",
      type: "snippet",
      boost: 9,
    }
  ),

  // Multiple CTEs
  snippetCompletion(
    "WITH\n  ${1:cte1} AS (\n    SELECT ${2:*}\n    FROM ${3:table1}\n    WHERE ${4:condition1}\n  ),\n  ${5:cte2} AS (\n    SELECT ${6:*}\n    FROM ${7:table2}\n    WHERE ${8:condition2}\n  )\nSELECT *\nFROM ${1:cte1}\nJOIN ${5:cte2} ON ${1:cte1}.${9:id} = ${5:cte2}.${10:id};${}",
    {
      label: "WITH MULTIPLE CTE",
      detail: "Multiple CTEs",
      type: "snippet",
      boost: 8,
    }
  ),

  // Recursive CTE
  snippetCompletion(
    "WITH RECURSIVE ${1:cte_name} AS (\n  -- Base case\n  SELECT ${2:id}, ${3:parent_id}, ${4:name}, 1 AS level\n  FROM ${5:table_name}\n  WHERE ${3:parent_id} IS NULL\n  \n  UNION ALL\n  \n  -- Recursive case\n  SELECT t.${2:id}, t.${3:parent_id}, t.${4:name}, c.level + 1\n  FROM ${5:table_name} t\n  JOIN ${1:cte_name} c ON t.${3:parent_id} = c.${2:id}\n)\nSELECT * FROM ${1:cte_name}\nORDER BY level, ${4:name};${}",
    {
      label: "WITH RECURSIVE",
      detail: "Recursive CTE for hierarchies",
      type: "snippet",
      boost: 8,
    }
  ),

  // ==================== CASE EXPRESSIONS ====================

  // Simple CASE
  snippetCompletion(
    "SELECT\n  ${1:column},\n  CASE ${1:column}\n    WHEN ${2:value1} THEN ${3:'Result 1'}\n    WHEN ${4:value2} THEN ${5:'Result 2'}\n    ELSE ${6:'Default'}\n  END AS ${7:result}\nFROM ${8:table_name};${}",
    {
      label: "CASE simple",
      detail: "Simple CASE expression",
      type: "snippet",
      boost: 8,
    }
  ),

  // Searched CASE
  snippetCompletion(
    "SELECT\n  ${1:column},\n  CASE\n    WHEN ${1:column} ${2:>} ${3:100} THEN ${4:'High'}\n    WHEN ${1:column} ${2:>} ${5:50} THEN ${6:'Medium'}\n    ELSE ${7:'Low'}\n  END AS ${8:category}\nFROM ${9:table_name};${}",
    {
      label: "CASE searched",
      detail: "Searched CASE with conditions",
      type: "snippet",
      boost: 8,
    }
  ),

  // CASE in aggregation
  snippetCompletion(
    "SELECT\n  COUNT(CASE WHEN ${1:status} = ${2:'active'} THEN 1 END) AS active_count,\n  COUNT(CASE WHEN ${1:status} = ${3:'inactive'} THEN 1 END) AS inactive_count,\n  COUNT(*) AS total\nFROM ${4:table_name};${}",
    {
      label: "CASE COUNT",
      detail: "Conditional counting",
      type: "snippet",
      boost: 7,
    }
  ),

  // ==================== SUBQUERIES ====================

  // Subquery in WHERE
  snippetCompletion(
    "SELECT *\nFROM ${1:table1}\nWHERE ${2:column} IN (\n  SELECT ${2:column}\n  FROM ${3:table2}\n  WHERE ${4:condition}\n);${}",
    {
      label: "SUBQUERY IN",
      detail: "Subquery in WHERE clause",
      type: "snippet",
      boost: 7,
    }
  ),

  // EXISTS subquery
  snippetCompletion(
    "SELECT *\nFROM ${1:table1} ${2:t1}\nWHERE EXISTS (\n  SELECT 1\n  FROM ${3:table2} ${4:t2}\n  WHERE ${4:t2}.${5:foreign_id} = ${2:t1}.${6:id}\n);${}",
    {
      label: "EXISTS",
      detail: "EXISTS subquery",
      type: "snippet",
      boost: 7,
    }
  ),

  // NOT EXISTS
  snippetCompletion(
    "SELECT *\nFROM ${1:table1} ${2:t1}\nWHERE NOT EXISTS (\n  SELECT 1\n  FROM ${3:table2} ${4:t2}\n  WHERE ${4:t2}.${5:foreign_id} = ${2:t1}.${6:id}\n);${}",
    {
      label: "NOT EXISTS",
      detail: "NOT EXISTS subquery",
      type: "snippet",
      boost: 7,
    }
  ),

  // Correlated subquery
  snippetCompletion(
    "SELECT\n  ${1:t1}.*,\n  (SELECT COUNT(*)\n   FROM ${2:table2} ${3:t2}\n   WHERE ${3:t2}.${4:foreign_id} = ${1:t1}.${5:id}) AS ${6:count}\nFROM ${7:table1} ${1:t1};${}",
    {
      label: "CORRELATED",
      detail: "Correlated subquery",
      type: "snippet",
      boost: 7,
    }
  ),

  // ==================== INSERT ====================

  // INSERT single
  snippetCompletion(
    "INSERT INTO ${1:table_name} (${2:col1}, ${3:col2}, ${4:col3})\nVALUES (${5:val1}, ${6:val2}, ${7:val3})\nRETURNING *;${}",
    {
      label: "INSERT",
      detail: "Insert single row",
      type: "snippet",
      boost: 8,
    }
  ),

  // INSERT multiple
  snippetCompletion(
    "INSERT INTO ${1:table_name} (${2:col1}, ${3:col2}, ${4:col3})\nVALUES\n  (${5:val1}, ${6:val2}, ${7:val3}),\n  (${8:val4}, ${9:val5}, ${10:val6}),\n  (${11:val7}, ${12:val8}, ${13:val9})\nRETURNING *;${}",
    {
      label: "INSERT MULTI",
      detail: "Insert multiple rows",
      type: "snippet",
      boost: 8,
    }
  ),

  // INSERT SELECT
  snippetCompletion(
    "INSERT INTO ${1:target_table} (${2:col1}, ${3:col2})\nSELECT ${4:col1}, ${5:col2}\nFROM ${6:source_table}\nWHERE ${7:condition}\nRETURNING *;${}",
    {
      label: "INSERT SELECT",
      detail: "Insert from SELECT",
      type: "snippet",
      boost: 7,
    }
  ),

  // UPSERT (PostgreSQL)
  snippetCompletion(
    "INSERT INTO ${1:table_name} (${2:id}, ${3:col1}, ${4:col2})\nVALUES (${5:1}, ${6:val1}, ${7:val2})\nON CONFLICT (${2:id})\nDO UPDATE SET\n  ${3:col1} = EXCLUDED.${3:col1},\n  ${4:col2} = EXCLUDED.${4:col2}\nRETURNING *;${}",
    {
      label: "UPSERT",
      detail: "Insert or update on conflict",
      type: "snippet",
      boost: 8,
    }
  ),

  // UPSERT DO NOTHING
  snippetCompletion(
    "INSERT INTO ${1:table_name} (${2:col1}, ${3:col2})\nVALUES (${4:val1}, ${5:val2})\nON CONFLICT (${2:col1})\nDO NOTHING\nRETURNING *;${}",
    {
      label: "UPSERT NOTHING",
      detail: "Insert or ignore on conflict",
      type: "snippet",
      boost: 7,
    }
  ),

  // ==================== UPDATE ====================

  // UPDATE basic
  snippetCompletion(
    "UPDATE ${1:table_name}\nSET\n  ${2:col1} = ${3:val1},\n  ${4:col2} = ${5:val2}\nWHERE ${6:id} = ${7:value}\nRETURNING *;${}",
    {
      label: "UPDATE",
      detail: "Update rows",
      type: "snippet",
      boost: 8,
    }
  ),

  // UPDATE with FROM (PostgreSQL)
  snippetCompletion(
    "UPDATE ${1:target} t\nSET ${2:column} = s.${3:value}\nFROM ${4:source} s\nWHERE t.${5:id} = s.${6:id}\nRETURNING t.*;${}",
    {
      label: "UPDATE FROM",
      detail: "Update with JOIN",
      type: "snippet",
      boost: 7,
    }
  ),

  // ==================== DELETE ====================

  // DELETE basic
  snippetCompletion(
    "DELETE FROM ${1:table_name}\nWHERE ${2:id} = ${3:value}\nRETURNING *;${}",
    {
      label: "DELETE",
      detail: "Delete rows",
      type: "snippet",
      boost: 8,
    }
  ),

  // DELETE with subquery
  snippetCompletion(
    "DELETE FROM ${1:table_name}\nWHERE ${2:id} IN (\n  SELECT ${2:id}\n  FROM ${3:other_table}\n  WHERE ${4:condition}\n)\nRETURNING *;${}",
    {
      label: "DELETE SUBQUERY",
      detail: "Delete with subquery",
      type: "snippet",
      boost: 7,
    }
  ),

  // ==================== DDL ====================

  // CREATE TABLE
  snippetCompletion(
    "CREATE TABLE ${1:table_name} (\n  ${2:id} SERIAL PRIMARY KEY,\n  ${3:name} VARCHAR(${4:255}) NOT NULL,\n  ${5:email} VARCHAR(${6:255}) UNIQUE,\n  ${7:created_at} TIMESTAMP DEFAULT NOW(),\n  ${8:updated_at} TIMESTAMP DEFAULT NOW()\n);${}",
    {
      label: "CREATE TABLE",
      detail: "Create new table",
      type: "snippet",
      boost: 7,
    }
  ),

  // CREATE INDEX
  snippetCompletion(
    "CREATE INDEX ${1:idx_name}\nON ${2:table_name} (${3:column});${}",
    {
      label: "CREATE INDEX",
      detail: "Create index",
      type: "snippet",
      boost: 6,
    }
  ),

  // CREATE UNIQUE INDEX
  snippetCompletion(
    "CREATE UNIQUE INDEX ${1:idx_name}\nON ${2:table_name} (${3:column});${}",
    {
      label: "CREATE UNIQUE INDEX",
      detail: "Create unique index",
      type: "snippet",
      boost: 6,
    }
  ),

  // ALTER TABLE ADD COLUMN
  snippetCompletion(
    "ALTER TABLE ${1:table_name}\nADD COLUMN ${2:column_name} ${3:VARCHAR(255)};${}",
    {
      label: "ALTER ADD COLUMN",
      detail: "Add column to table",
      type: "snippet",
      boost: 6,
    }
  ),

  // ==================== SPECIAL QUERIES ====================

  // DISTINCT ON (PostgreSQL)
  snippetCompletion(
    "SELECT DISTINCT ON (${1:column})\n  ${2:*}\nFROM ${3:table_name}\nORDER BY ${1:column}, ${4:created_at} DESC;${}",
    {
      label: "DISTINCT ON",
      detail: "PostgreSQL DISTINCT ON",
      type: "snippet",
      boost: 7,
    }
  ),

  // UNION
  snippetCompletion(
    "SELECT ${1:col1}, ${2:col2}\nFROM ${3:table1}\nWHERE ${4:condition1}\n\nUNION ALL\n\nSELECT ${1:col1}, ${2:col2}\nFROM ${5:table2}\nWHERE ${6:condition2}\n\nORDER BY ${1:col1};${}",
    {
      label: "UNION",
      detail: "Combine query results",
      type: "snippet",
      boost: 7,
    }
  ),

  // Pagination
  snippetCompletion(
    "SELECT *\nFROM ${1:table_name}\nORDER BY ${2:id}\nLIMIT ${3:20}\nOFFSET ${4:0};${}",
    {
      label: "PAGINATION",
      detail: "Paginated query",
      type: "snippet",
      boost: 7,
    }
  ),

  // FOR UPDATE (row locking)
  snippetCompletion(
    "SELECT *\nFROM ${1:table_name}\nWHERE ${2:id} = ${3:value}\nFOR UPDATE;${}",
    {
      label: "FOR UPDATE",
      detail: "Lock rows for update",
      type: "snippet",
      boost: 6,
    }
  ),

  // COALESCE
  snippetCompletion(
    "SELECT\n  ${1:column},\n  COALESCE(${2:nullable_column}, ${3:'default'}) AS ${4:safe_column}\nFROM ${5:table_name};${}",
    {
      label: "COALESCE",
      detail: "Handle NULL values",
      type: "snippet",
      boost: 7,
    }
  ),

  // JSON query (PostgreSQL)
  snippetCompletion(
    "SELECT\n  ${1:id},\n  ${2:data}->>'${3:key}' AS ${4:value},\n  ${2:data}->'${5:nested}'->'${6:key}' AS ${7:nested_value}\nFROM ${8:table_name}\nWHERE ${2:data}->>'${3:key}' = ${9:'value'};${}",
    {
      label: "JSON QUERY",
      detail: "Query JSON/JSONB columns",
      type: "snippet",
      boost: 7,
    }
  ),

  // Date range query
  snippetCompletion(
    "SELECT *\nFROM ${1:table_name}\nWHERE ${2:created_at} >= ${3:'2024-01-01'}::date\n  AND ${2:created_at} < ${4:'2024-02-01'}::date\nORDER BY ${2:created_at};${}",
    {
      label: "DATE RANGE",
      detail: "Query date range",
      type: "snippet",
      boost: 7,
    }
  ),

  // Date truncation (PostgreSQL)
  snippetCompletion(
    "SELECT\n  DATE_TRUNC('${1:month}', ${2:created_at}) AS ${3:period},\n  COUNT(*) AS count\nFROM ${4:table_name}\nGROUP BY ${3:period}\nORDER BY ${3:period};${}",
    {
      label: "DATE TRUNC",
      detail: "Group by date period",
      type: "snippet",
      boost: 7,
    }
  ),
];
