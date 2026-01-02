/**
 * SQL Keywords and Operators
 *
 * Context-aware keyword definitions for SQL autocomplete
 */

import type { SqlKeyword, SqlOperator, SqlClause, ColumnTypeCategory, SqlDatabaseType } from "./types";

/**
 * SQL Keywords with context information
 */
export const SQL_KEYWORDS: SqlKeyword[] = [
  // SELECT clause keywords
  { keyword: "SELECT", validAfter: ["UNKNOWN", "WITH", "UNION"], startsClause: "SELECT", description: "Select columns from table" },
  { keyword: "DISTINCT", validAfter: ["SELECT"], description: "Return unique rows only" },
  { keyword: "ALL", validAfter: ["SELECT", "UNION"], description: "Return all rows" },
  { keyword: "TOP", validAfter: ["SELECT"], description: "Limit rows (SQL Server)" },

  // FROM clause keywords
  { keyword: "FROM", validAfter: ["SELECT", "DELETE"], startsClause: "FROM", description: "Specify source table(s)" },
  { keyword: "AS", validAfter: ["SELECT", "FROM", "JOIN"], description: "Define alias" },

  // JOIN keywords
  { keyword: "JOIN", validAfter: ["FROM", "JOIN", "ON"], startsClause: "JOIN", description: "Join tables" },
  { keyword: "INNER", validAfter: ["FROM", "JOIN", "ON"], description: "Inner join modifier" },
  { keyword: "LEFT", validAfter: ["FROM", "JOIN", "ON"], description: "Left outer join" },
  { keyword: "RIGHT", validAfter: ["FROM", "JOIN", "ON"], description: "Right outer join" },
  { keyword: "FULL", validAfter: ["FROM", "JOIN", "ON"], description: "Full outer join" },
  { keyword: "OUTER", validAfter: ["FROM", "JOIN", "ON"], description: "Outer join modifier" },
  { keyword: "CROSS", validAfter: ["FROM", "JOIN", "ON"], description: "Cross join (cartesian)" },
  { keyword: "NATURAL", validAfter: ["FROM", "JOIN"], description: "Natural join" },
  { keyword: "ON", validAfter: ["JOIN"], startsClause: "ON", description: "Join condition" },
  { keyword: "USING", validAfter: ["JOIN"], description: "Join on matching columns" },

  // WHERE clause keywords
  { keyword: "WHERE", validAfter: ["FROM", "JOIN", "ON", "SET", "UPDATE", "DELETE"], startsClause: "WHERE", description: "Filter rows" },
  { keyword: "AND", validAfter: ["WHERE", "ON", "HAVING"], description: "Logical AND" },
  { keyword: "OR", validAfter: ["WHERE", "ON", "HAVING"], description: "Logical OR" },
  { keyword: "NOT", validAfter: ["WHERE", "ON", "HAVING", "AND", "OR"], description: "Logical NOT" },
  { keyword: "IN", validAfter: ["WHERE", "ON", "HAVING"], description: "Match any value in list" },
  { keyword: "BETWEEN", validAfter: ["WHERE", "ON", "HAVING"], description: "Range comparison" },
  { keyword: "LIKE", validAfter: ["WHERE", "ON", "HAVING"], description: "Pattern matching" },
  { keyword: "ILIKE", validAfter: ["WHERE", "ON", "HAVING"], description: "Case-insensitive LIKE (PostgreSQL)" },
  { keyword: "SIMILAR", validAfter: ["WHERE", "ON", "HAVING"], description: "Regex pattern (PostgreSQL)" },
  { keyword: "IS", validAfter: ["WHERE", "ON", "HAVING"], description: "NULL comparison" },
  { keyword: "NULL", validAfter: ["WHERE", "ON", "HAVING", "SET"], description: "NULL value" },
  { keyword: "EXISTS", validAfter: ["WHERE", "ON", "HAVING"], description: "Subquery exists" },
  { keyword: "ANY", validAfter: ["WHERE", "ON", "HAVING"], description: "Compare to any in subquery" },
  { keyword: "SOME", validAfter: ["WHERE", "ON", "HAVING"], description: "Same as ANY" },

  // GROUP BY / HAVING / ORDER BY
  { keyword: "GROUP", validAfter: ["FROM", "WHERE", "JOIN", "ON"], description: "Group rows" },
  { keyword: "BY", validAfter: ["GROUP", "ORDER", "PARTITION"], description: "Specify columns" },
  { keyword: "HAVING", validAfter: ["GROUP_BY"], startsClause: "HAVING", description: "Filter groups" },
  { keyword: "ORDER", validAfter: ["FROM", "WHERE", "GROUP_BY", "HAVING", "JOIN", "ON"], description: "Sort results" },
  { keyword: "ASC", validAfter: ["ORDER_BY"], description: "Ascending order" },
  { keyword: "DESC", validAfter: ["ORDER_BY"], description: "Descending order" },
  { keyword: "NULLS", validAfter: ["ORDER_BY"], description: "NULL ordering" },
  { keyword: "FIRST", validAfter: ["ORDER_BY"], description: "NULLs first" },
  { keyword: "LAST", validAfter: ["ORDER_BY"], description: "NULLs last" },

  // LIMIT / OFFSET
  { keyword: "LIMIT", validAfter: ["FROM", "WHERE", "ORDER_BY", "GROUP_BY", "HAVING"], startsClause: "LIMIT", description: "Limit rows returned" },
  { keyword: "OFFSET", validAfter: ["LIMIT"], startsClause: "OFFSET", description: "Skip rows" },
  { keyword: "FETCH", validAfter: ["ORDER_BY", "OFFSET"], description: "Fetch rows (SQL standard)" },
  { keyword: "NEXT", validAfter: ["OFFSET"], description: "Fetch next rows" },
  { keyword: "ROWS", validAfter: ["OFFSET", "LIMIT"], description: "Row count" },
  { keyword: "ONLY", validAfter: ["OFFSET"], description: "Only specified rows" },

  // SET operations
  { keyword: "UNION", validAfter: ["SELECT", "FROM", "WHERE", "ORDER_BY"], startsClause: "UNION", description: "Combine results" },
  { keyword: "INTERSECT", validAfter: ["SELECT", "FROM", "WHERE", "ORDER_BY"], description: "Common rows" },
  { keyword: "EXCEPT", validAfter: ["SELECT", "FROM", "WHERE", "ORDER_BY"], description: "Rows not in second query" },
  { keyword: "MINUS", validAfter: ["SELECT", "FROM", "WHERE", "ORDER_BY"], description: "Same as EXCEPT (Oracle)" },

  // CTE
  { keyword: "WITH", validAfter: ["UNKNOWN"], startsClause: "WITH", description: "Common Table Expression" },
  { keyword: "RECURSIVE", validAfter: ["WITH"], description: "Recursive CTE" },

  // INSERT
  { keyword: "INSERT", validAfter: ["UNKNOWN", "WITH"], startsClause: "INSERT", description: "Insert rows" },
  { keyword: "INTO", validAfter: ["INSERT"], startsClause: "INTO", description: "Target table" },
  { keyword: "VALUES", validAfter: ["INTO"], startsClause: "VALUES", description: "Values to insert" },
  { keyword: "DEFAULT", validAfter: ["VALUES", "SET"], description: "Use default value" },
  { keyword: "RETURNING", validAfter: ["INSERT", "UPDATE", "DELETE", "VALUES"], description: "Return inserted/updated rows" },
  { keyword: "ON", validAfter: ["INSERT"], description: "On conflict clause" },
  { keyword: "CONFLICT", validAfter: ["INSERT"], description: "Conflict handling" },
  { keyword: "DO", validAfter: ["INSERT"], description: "Conflict action" },
  { keyword: "NOTHING", validAfter: ["INSERT"], description: "Do nothing on conflict" },

  // UPDATE
  { keyword: "UPDATE", validAfter: ["UNKNOWN", "WITH", "INSERT"], startsClause: "UPDATE", description: "Update rows" },
  { keyword: "SET", validAfter: ["UPDATE"], startsClause: "SET", description: "Set column values" },

  // DELETE
  { keyword: "DELETE", validAfter: ["UNKNOWN", "WITH"], startsClause: "DELETE", description: "Delete rows" },

  // DDL
  { keyword: "CREATE", validAfter: ["UNKNOWN"], startsClause: "CREATE", description: "Create object" },
  { keyword: "ALTER", validAfter: ["UNKNOWN"], startsClause: "ALTER", description: "Alter object" },
  { keyword: "DROP", validAfter: ["UNKNOWN"], startsClause: "DROP", description: "Drop object" },
  { keyword: "TRUNCATE", validAfter: ["UNKNOWN"], description: "Remove all rows" },
  { keyword: "TABLE", validAfter: ["CREATE", "ALTER", "DROP", "TRUNCATE"], description: "Table object" },
  { keyword: "INDEX", validAfter: ["CREATE", "DROP"], description: "Index object" },
  { keyword: "VIEW", validAfter: ["CREATE", "ALTER", "DROP"], description: "View object" },
  { keyword: "SCHEMA", validAfter: ["CREATE", "ALTER", "DROP"], description: "Schema object" },
  { keyword: "DATABASE", validAfter: ["CREATE", "ALTER", "DROP"], description: "Database object" },
  { keyword: "SEQUENCE", validAfter: ["CREATE", "ALTER", "DROP"], description: "Sequence object" },
  { keyword: "FUNCTION", validAfter: ["CREATE", "ALTER", "DROP"], description: "Function object" },
  { keyword: "PROCEDURE", validAfter: ["CREATE", "ALTER", "DROP"], description: "Procedure object" },
  { keyword: "TRIGGER", validAfter: ["CREATE", "ALTER", "DROP"], description: "Trigger object" },
  { keyword: "TYPE", validAfter: ["CREATE", "ALTER", "DROP"], description: "Type object" },

  // Constraints
  { keyword: "PRIMARY", validAfter: ["CREATE", "ALTER"], description: "Primary key" },
  { keyword: "KEY", validAfter: ["CREATE", "ALTER"], description: "Key constraint" },
  { keyword: "FOREIGN", validAfter: ["CREATE", "ALTER"], description: "Foreign key" },
  { keyword: "REFERENCES", validAfter: ["CREATE", "ALTER"], description: "FK reference" },
  { keyword: "UNIQUE", validAfter: ["CREATE", "ALTER"], description: "Unique constraint" },
  { keyword: "CHECK", validAfter: ["CREATE", "ALTER"], description: "Check constraint" },
  { keyword: "CONSTRAINT", validAfter: ["CREATE", "ALTER"], description: "Named constraint" },

  // Column modifiers
  { keyword: "NOT", validAfter: ["CREATE", "ALTER", "WHERE"], description: "NOT modifier" },
  { keyword: "COLUMN", validAfter: ["ALTER", "ADD", "DROP"], description: "Column object" },
  { keyword: "ADD", validAfter: ["ALTER"], description: "Add column/constraint" },
  { keyword: "RENAME", validAfter: ["ALTER"], description: "Rename object" },
  { keyword: "TO", validAfter: ["ALTER", "RENAME"], description: "Rename target" },

  // Transactions
  { keyword: "BEGIN", validAfter: ["UNKNOWN"], description: "Begin transaction" },
  { keyword: "COMMIT", validAfter: ["UNKNOWN"], description: "Commit transaction" },
  { keyword: "ROLLBACK", validAfter: ["UNKNOWN"], description: "Rollback transaction" },
  { keyword: "SAVEPOINT", validAfter: ["UNKNOWN"], description: "Create savepoint" },
  { keyword: "TRANSACTION", validAfter: ["UNKNOWN"], description: "Transaction" },

  // CASE expression
  { keyword: "CASE", validAfter: ["SELECT", "WHERE", "SET", "ON", "HAVING"], description: "Conditional expression" },
  { keyword: "WHEN", validAfter: ["SELECT", "WHERE", "SET"], description: "Condition branch" },
  { keyword: "THEN", validAfter: ["SELECT", "WHERE", "SET"], description: "Result for condition" },
  { keyword: "ELSE", validAfter: ["SELECT", "WHERE", "SET"], description: "Default result" },
  { keyword: "END", validAfter: ["SELECT", "WHERE", "SET"], description: "End CASE" },

  // Window functions
  { keyword: "OVER", validAfter: ["SELECT"], description: "Window specification" },
  { keyword: "PARTITION", validAfter: ["SELECT", "OVER"], description: "Partition by" },
  { keyword: "WINDOW", validAfter: ["SELECT", "FROM", "WHERE"], description: "Named window" },
  { keyword: "RANGE", validAfter: ["SELECT", "OVER"], description: "Range frame" },
  { keyword: "ROWS", validAfter: ["SELECT", "OVER"], description: "Rows frame" },
  { keyword: "GROUPS", validAfter: ["SELECT", "OVER"], description: "Groups frame (PostgreSQL 11+)" },
  { keyword: "UNBOUNDED", validAfter: ["SELECT", "OVER"], description: "Unbounded frame" },
  { keyword: "PRECEDING", validAfter: ["SELECT", "OVER"], description: "Preceding rows" },
  { keyword: "FOLLOWING", validAfter: ["SELECT", "OVER"], description: "Following rows" },
  { keyword: "CURRENT", validAfter: ["SELECT", "OVER"], description: "Current row" },
  { keyword: "ROW", validAfter: ["SELECT", "OVER"], description: "Single row" },
  { keyword: "FILTER", validAfter: ["SELECT"], description: "Filter aggregate (PostgreSQL)" },
  { keyword: "WITHIN GROUP", validAfter: ["SELECT"], description: "Ordered-set aggregate" },
  { keyword: "EXCLUDE", validAfter: ["OVER"], description: "Exclude frame rows" },

  // Values
  { keyword: "TRUE", validAfter: ["WHERE", "SET", "VALUES", "ON", "HAVING"], description: "Boolean true" },
  { keyword: "FALSE", validAfter: ["WHERE", "SET", "VALUES", "ON", "HAVING"], description: "Boolean false" },

  // Explain
  { keyword: "EXPLAIN", validAfter: ["UNKNOWN"], description: "Query execution plan" },
  { keyword: "ANALYZE", validAfter: ["UNKNOWN", "EXPLAIN"], description: "Analyze query/table" },

  // Advanced JOIN
  { keyword: "LATERAL", validAfter: ["FROM", "JOIN"], description: "Lateral subquery (PostgreSQL)" },

  // Locking clauses
  { keyword: "FOR", validAfter: ["FROM", "WHERE", "ORDER_BY", "LIMIT"], description: "Row locking" },
  { keyword: "UPDATE", validAfter: ["FOR"], description: "Lock for update" },
  { keyword: "SHARE", validAfter: ["FOR"], description: "Lock for share" },
  { keyword: "NO KEY UPDATE", validAfter: ["FOR"], description: "Lock without key" },
  { keyword: "KEY SHARE", validAfter: ["FOR"], description: "Lock key share" },
  { keyword: "NOWAIT", validAfter: ["FOR"], description: "Don't wait for lock" },
  { keyword: "SKIP LOCKED", validAfter: ["FOR"], description: "Skip locked rows" },

  // PostgreSQL specific
  { keyword: "RETURNING", validAfter: ["INSERT", "UPDATE", "DELETE"], description: "Return affected rows" },
  { keyword: "ILIKE", validAfter: ["WHERE", "ON", "HAVING"], description: "Case-insensitive LIKE" },
  { keyword: "SIMILAR TO", validAfter: ["WHERE", "ON", "HAVING"], description: "Regex pattern match" },
  { keyword: "DISTINCT ON", validAfter: ["SELECT"], description: "Distinct on columns" },
  { keyword: "NULLS FIRST", validAfter: ["ORDER_BY"], description: "Sort NULLs first" },
  { keyword: "NULLS LAST", validAfter: ["ORDER_BY"], description: "Sort NULLs last" },

  // Common Table Expression modifiers
  { keyword: "MATERIALIZED", validAfter: ["WITH"], description: "Materialize CTE" },
  { keyword: "NOT MATERIALIZED", validAfter: ["WITH"], description: "Don't materialize CTE" },

  // Array and JSON
  { keyword: "ARRAY", validAfter: ["SELECT", "WHERE", "SET", "VALUES"], description: "Array constructor" },
  { keyword: "JSONB", validAfter: ["CREATE", "ALTER"], description: "JSONB type" },
];

/**
 * Window frame keywords for OVER clause
 */
export const WINDOW_KEYWORDS: SqlKeyword[] = [
  { keyword: "PARTITION BY", validAfter: ["OVER"], description: "Partition rows" },
  { keyword: "ORDER BY", validAfter: ["OVER"], description: "Order within partition" },
  { keyword: "ROWS", validAfter: ["OVER"], description: "Rows-based frame" },
  { keyword: "RANGE", validAfter: ["OVER"], description: "Range-based frame" },
  { keyword: "GROUPS", validAfter: ["OVER"], description: "Groups-based frame" },
  { keyword: "BETWEEN", validAfter: ["OVER"], description: "Frame between" },
  { keyword: "UNBOUNDED PRECEDING", validAfter: ["OVER"], description: "From partition start" },
  { keyword: "UNBOUNDED FOLLOWING", validAfter: ["OVER"], description: "To partition end" },
  { keyword: "CURRENT ROW", validAfter: ["OVER"], description: "Current row" },
  { keyword: "EXCLUDE CURRENT ROW", validAfter: ["OVER"], description: "Exclude current" },
  { keyword: "EXCLUDE GROUP", validAfter: ["OVER"], description: "Exclude peers" },
  { keyword: "EXCLUDE TIES", validAfter: ["OVER"], description: "Exclude ties" },
  { keyword: "EXCLUDE NO OTHERS", validAfter: ["OVER"], description: "Include all" },
];

/**
 * SQL Operators with type information
 */
export const SQL_OPERATORS: SqlOperator[] = [
  // Comparison operators
  { operator: "=", description: "Equal to", validForTypes: ["any"] },
  { operator: "<>", description: "Not equal to", validForTypes: ["any"] },
  { operator: "!=", description: "Not equal to", validForTypes: ["any"] },
  { operator: "<", description: "Less than", validForTypes: ["numeric", "date", "string"] },
  { operator: ">", description: "Greater than", validForTypes: ["numeric", "date", "string"] },
  { operator: "<=", description: "Less than or equal", validForTypes: ["numeric", "date", "string"] },
  { operator: ">=", description: "Greater than or equal", validForTypes: ["numeric", "date", "string"] },

  // Pattern matching
  { operator: "LIKE", description: "Pattern match (case-sensitive)", validForTypes: ["string"] },
  { operator: "ILIKE", description: "Pattern match (case-insensitive)", validForTypes: ["string"] },
  { operator: "SIMILAR TO", description: "Regex pattern match", validForTypes: ["string"] },
  { operator: "~", description: "Regex match (PostgreSQL)", validForTypes: ["string"] },
  { operator: "~*", description: "Regex match case-insensitive", validForTypes: ["string"] },
  { operator: "!~", description: "Regex not match", validForTypes: ["string"] },
  { operator: "!~*", description: "Regex not match case-insensitive", validForTypes: ["string"] },

  // Range/List operators
  { operator: "BETWEEN", description: "Within range (inclusive)", validForTypes: ["numeric", "date", "string"] },
  { operator: "NOT BETWEEN", description: "Outside range", validForTypes: ["numeric", "date", "string"] },
  { operator: "IN", description: "Match any in list", validForTypes: ["any"] },
  { operator: "NOT IN", description: "Not in list", validForTypes: ["any"] },

  // NULL operators
  { operator: "IS NULL", description: "Is NULL", validForTypes: ["any"] },
  { operator: "IS NOT NULL", description: "Is not NULL", validForTypes: ["any"] },
  { operator: "IS DISTINCT FROM", description: "Distinct (NULL-safe)", validForTypes: ["any"] },
  { operator: "IS NOT DISTINCT FROM", description: "Not distinct (NULL-safe)", validForTypes: ["any"] },

  // Boolean operators
  { operator: "IS TRUE", description: "Is true", validForTypes: ["boolean"] },
  { operator: "IS FALSE", description: "Is false", validForTypes: ["boolean"] },
  { operator: "IS NOT TRUE", description: "Is not true", validForTypes: ["boolean"] },
  { operator: "IS NOT FALSE", description: "Is not false", validForTypes: ["boolean"] },

  // JSON operators (PostgreSQL)
  { operator: "->", description: "Get JSON element", validForTypes: ["json"] },
  { operator: "->>", description: "Get JSON element as text", validForTypes: ["json"] },
  { operator: "#>", description: "Get JSON path", validForTypes: ["json"] },
  { operator: "#>>", description: "Get JSON path as text", validForTypes: ["json"] },
  { operator: "@>", description: "Contains JSON", validForTypes: ["json"] },
  { operator: "<@", description: "Contained by JSON", validForTypes: ["json"] },
  { operator: "?", description: "Key exists", validForTypes: ["json"] },
  { operator: "?|", description: "Any key exists", validForTypes: ["json"] },
  { operator: "?&", description: "All keys exist", validForTypes: ["json"] },

  // Array operators (PostgreSQL)
  { operator: "@>", description: "Array contains", validForTypes: ["array"] },
  { operator: "<@", description: "Array contained by", validForTypes: ["array"] },
  { operator: "&&", description: "Arrays overlap", validForTypes: ["array"] },
  { operator: "||", description: "Array concatenation", validForTypes: ["array", "string"] },

  // Arithmetic operators
  { operator: "+", description: "Addition", validForTypes: ["numeric", "date"] },
  { operator: "-", description: "Subtraction", validForTypes: ["numeric", "date"] },
  { operator: "*", description: "Multiplication", validForTypes: ["numeric"] },
  { operator: "/", description: "Division", validForTypes: ["numeric"] },
  { operator: "%", description: "Modulo", validForTypes: ["numeric"] },
  { operator: "^", description: "Exponentiation (PostgreSQL)", validForTypes: ["numeric"] },
  { operator: "|/", description: "Square root (PostgreSQL)", validForTypes: ["numeric"] },
  { operator: "||/", description: "Cube root (PostgreSQL)", validForTypes: ["numeric"] },
  { operator: "!", description: "Factorial (PostgreSQL)", validForTypes: ["numeric"] },
  { operator: "@", description: "Absolute value (PostgreSQL)", validForTypes: ["numeric"] },

  // Bitwise operators
  { operator: "&", description: "Bitwise AND", validForTypes: ["numeric"] },
  { operator: "|", description: "Bitwise OR", validForTypes: ["numeric"] },
  { operator: "#", description: "Bitwise XOR (PostgreSQL)", validForTypes: ["numeric"] },
  { operator: "~", description: "Bitwise NOT", validForTypes: ["numeric"] },
  { operator: "<<", description: "Bitwise shift left", validForTypes: ["numeric"] },
  { operator: ">>", description: "Bitwise shift right", validForTypes: ["numeric"] },
];

/**
 * SQL Data Types by database
 */
export const SQL_DATA_TYPES: Record<SqlDatabaseType, string[]> = {
  postgres: [
    // Numeric
    "SMALLINT", "INTEGER", "INT", "BIGINT", "DECIMAL", "NUMERIC", "REAL", "DOUBLE PRECISION",
    "SMALLSERIAL", "SERIAL", "BIGSERIAL", "MONEY",
    // Character
    "CHAR", "CHARACTER", "VARCHAR", "CHARACTER VARYING", "TEXT",
    // Binary
    "BYTEA",
    // Date/Time
    "DATE", "TIME", "TIME WITH TIME ZONE", "TIMESTAMP", "TIMESTAMP WITH TIME ZONE",
    "TIMESTAMPTZ", "TIMETZ", "INTERVAL",
    // Boolean
    "BOOLEAN", "BOOL",
    // UUID
    "UUID",
    // JSON
    "JSON", "JSONB",
    // Array
    "ARRAY", "INTEGER[]", "TEXT[]", "VARCHAR[]",
    // Geometric
    "POINT", "LINE", "LSEG", "BOX", "PATH", "POLYGON", "CIRCLE",
    // Network
    "CIDR", "INET", "MACADDR", "MACADDR8",
    // Other
    "BIT", "BIT VARYING", "VARBIT", "TSVECTOR", "TSQUERY", "XML",
  ],
  mysql: [
    // Numeric
    "TINYINT", "SMALLINT", "MEDIUMINT", "INT", "INTEGER", "BIGINT",
    "DECIMAL", "DEC", "NUMERIC", "FLOAT", "DOUBLE", "DOUBLE PRECISION", "REAL",
    "BIT",
    // Character
    "CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT",
    // Binary
    "BINARY", "VARBINARY", "TINYBLOB", "BLOB", "MEDIUMBLOB", "LONGBLOB",
    // Date/Time
    "DATE", "DATETIME", "TIMESTAMP", "TIME", "YEAR",
    // JSON
    "JSON",
    // Other
    "ENUM", "SET", "GEOMETRY", "POINT", "LINESTRING", "POLYGON",
  ],
  mariadb: [
    // Same as MySQL plus some additions
    "TINYINT", "SMALLINT", "MEDIUMINT", "INT", "INTEGER", "BIGINT",
    "DECIMAL", "DEC", "NUMERIC", "FLOAT", "DOUBLE", "DOUBLE PRECISION", "REAL",
    "BIT",
    "CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT",
    "BINARY", "VARBINARY", "TINYBLOB", "BLOB", "MEDIUMBLOB", "LONGBLOB",
    "DATE", "DATETIME", "TIMESTAMP", "TIME", "YEAR",
    "JSON",
    "ENUM", "SET", "GEOMETRY", "POINT", "LINESTRING", "POLYGON",
    // MariaDB specific
    "UUID",
  ],
  sqlserver: [
    // Exact numerics
    "BIGINT", "INT", "SMALLINT", "TINYINT", "BIT",
    "DECIMAL", "DEC", "NUMERIC", "MONEY", "SMALLMONEY",
    // Approximate numerics
    "FLOAT", "REAL",
    // Character
    "CHAR", "VARCHAR", "TEXT", "NCHAR", "NVARCHAR", "NTEXT",
    // Binary
    "BINARY", "VARBINARY", "IMAGE",
    // Date/Time
    "DATE", "TIME", "DATETIME", "DATETIME2", "SMALLDATETIME", "DATETIMEOFFSET",
    // Other
    "UNIQUEIDENTIFIER", "XML", "SQL_VARIANT", "GEOGRAPHY", "GEOMETRY", "HIERARCHYID",
  ],
  sqlite: [
    // SQLite has dynamic typing with these affinities
    "INTEGER", "INT", "TINYINT", "SMALLINT", "MEDIUMINT", "BIGINT",
    "UNSIGNED BIG INT", "INT2", "INT8",
    "REAL", "DOUBLE", "DOUBLE PRECISION", "FLOAT",
    "TEXT", "CHARACTER", "VARCHAR", "VARYING CHARACTER", "NCHAR",
    "NATIVE CHARACTER", "NVARCHAR", "CLOB",
    "BLOB", "NONE",
    "NUMERIC", "DECIMAL", "BOOLEAN", "DATE", "DATETIME",
  ],
};

/**
 * Get keywords valid for current context
 */
export function getKeywordsForContext(clause: SqlClause): SqlKeyword[] {
  return SQL_KEYWORDS.filter((k) => k.validAfter.includes(clause));
}

/**
 * Get operators valid for column type
 */
export function getOperatorsForType(columnType: string): SqlOperator[] {
  const category = getColumnTypeCategory(columnType);
  return SQL_OPERATORS.filter(
    (op) => op.validForTypes.includes("any") || op.validForTypes.includes(category)
  );
}

/**
 * Determine column type category from SQL type
 */
export function getColumnTypeCategory(sqlType: string): ColumnTypeCategory {
  const type = sqlType.toUpperCase();

  if (/INT|SERIAL|DECIMAL|NUMERIC|REAL|DOUBLE|FLOAT|MONEY|NUMBER/.test(type)) {
    return "numeric";
  }
  if (/CHAR|TEXT|VARCHAR|STRING|CLOB/.test(type)) {
    return "string";
  }
  if (/DATE|TIME|TIMESTAMP|INTERVAL|YEAR/.test(type)) {
    return "date";
  }
  if (/BOOL/.test(type)) {
    return "boolean";
  }
  if (/JSON/.test(type)) {
    return "json";
  }
  if (/\[\]|ARRAY/.test(type)) {
    return "array";
  }
  if (/BYTEA|BLOB|BINARY|IMAGE/.test(type)) {
    return "binary";
  }
  if (/UUID|UNIQUEIDENTIFIER/.test(type)) {
    return "uuid";
  }

  return "any";
}

/**
 * Get data types for a database
 */
export function getDataTypes(dbType: SqlDatabaseType): string[] {
  return SQL_DATA_TYPES[dbType] || [];
}
