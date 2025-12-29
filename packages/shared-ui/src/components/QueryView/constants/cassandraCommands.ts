/**
 * Cassandra CQL Commands and Keywords
 * Comprehensive Cassandra CQL commands organized by category for query builder and autocomplete
 */

export interface CassandraCommand {
  name: string;
  desc: string;
  example: string;
}

export const CQL_KEYWORDS: string[] = [
  "SELECT", "FROM", "WHERE", "AND", "OR", "IN", "CONTAINS", "CONTAINS KEY",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "CREATE", "TABLE", "KEYSPACE", "INDEX", "TYPE", "FUNCTION",
  "DROP", "ALTER", "TRUNCATE",
  "IF", "EXISTS", "NOT EXISTS",
  "PRIMARY KEY", "CLUSTERING ORDER", "WITH",
  "TTL", "TIMESTAMP", "WRITETIME",
  "LIMIT", "ORDER BY", "ASC", "DESC",
  "ALLOW FILTERING", "TOKEN", "USING",
  "BATCH", "APPLY", "BEGIN", "UNLOGGED",
  "GRANT", "REVOKE", "LIST", "PERMISSIONS",
  "UUID", "TIMEUUID", "NOW", "TODATE", "TOUNIXTIMESTAMP",
];

export const CASSANDRA_COMMANDS: Record<string, CassandraCommand[]> = {
  examples: [
    { name: "Select All", desc: "Get all rows (limited)", example: `SELECT * FROM my_keyspace.my_table LIMIT 100;` },
    { name: "Select with Filter", desc: "Filter by partition key", example: `SELECT * FROM users WHERE user_id = 'abc123';` },
    { name: "Select Columns", desc: "Select specific columns", example: `SELECT name, email, created_at FROM users WHERE user_id = 'abc123';` },
    { name: "Insert Row", desc: "Insert a new row", example: `INSERT INTO users (user_id, name, email, created_at)
VALUES (uuid(), 'John Doe', 'john@example.com', toTimestamp(now()));` },
    { name: "Update Row", desc: "Update existing row", example: `UPDATE users SET name = 'Jane Doe', email = 'jane@example.com'
WHERE user_id = 'abc123';` },
    { name: "Delete Row", desc: "Delete a row", example: `DELETE FROM users WHERE user_id = 'abc123';` },
    { name: "Count Rows", desc: "Count matching rows", example: `SELECT COUNT(*) FROM users;` },
    { name: "Describe Table", desc: "Show table schema", example: `DESCRIBE TABLE my_keyspace.my_table;` },
  ],
  select: [
    { name: "SELECT *", desc: "Select all columns", example: `SELECT * FROM users WHERE user_id = 'abc123';` },
    { name: "SELECT columns", desc: "Select specific columns", example: `SELECT user_id, name, email FROM users WHERE user_id = 'abc123';` },
    { name: "SELECT DISTINCT", desc: "Distinct partition keys", example: `SELECT DISTINCT user_id FROM users;` },
    { name: "SELECT COUNT", desc: "Count rows", example: `SELECT COUNT(*) FROM users WHERE status = 'active' ALLOW FILTERING;` },
    { name: "SELECT with IN", desc: "Multiple partition keys", example: `SELECT * FROM users WHERE user_id IN ('id1', 'id2', 'id3');` },
    { name: "SELECT with LIMIT", desc: "Limit results", example: `SELECT * FROM events WHERE partition_key = 'key1' LIMIT 100;` },
    { name: "SELECT with ORDER BY", desc: "Order by clustering column", example: `SELECT * FROM events
WHERE partition_key = 'key1'
ORDER BY event_time DESC
LIMIT 50;` },
    { name: "SELECT with TOKEN", desc: "Token-based pagination", example: `SELECT * FROM users
WHERE TOKEN(user_id) > TOKEN('last_id')
LIMIT 100;` },
    { name: "SELECT with ALLOW FILTERING", desc: "Filter on non-key columns", example: `SELECT * FROM users
WHERE status = 'active'
ALLOW FILTERING;` },
    { name: "SELECT TTL", desc: "Get TTL of column", example: `SELECT user_id, TTL(name) FROM users WHERE user_id = 'abc123';` },
    { name: "SELECT WRITETIME", desc: "Get write timestamp", example: `SELECT user_id, WRITETIME(name) FROM users WHERE user_id = 'abc123';` },
    { name: "SELECT JSON", desc: "Return as JSON", example: `SELECT JSON * FROM users WHERE user_id = 'abc123';` },
  ],
  insert: [
    { name: "INSERT basic", desc: "Basic insert", example: `INSERT INTO users (user_id, name, email)
VALUES ('abc123', 'John Doe', 'john@example.com');` },
    { name: "INSERT with UUID", desc: "Auto-generate UUID", example: `INSERT INTO users (user_id, name, email)
VALUES (uuid(), 'John Doe', 'john@example.com');` },
    { name: "INSERT with TIMEUUID", desc: "Time-based UUID", example: `INSERT INTO events (event_id, event_type, created_at)
VALUES (now(), 'login', toTimestamp(now()));` },
    { name: "INSERT with TTL", desc: "Set time-to-live", example: `INSERT INTO sessions (session_id, user_id, data)
VALUES ('sess123', 'user456', 'session_data')
USING TTL 3600;` },
    { name: "INSERT with TIMESTAMP", desc: "Set write timestamp", example: `INSERT INTO users (user_id, name)
VALUES ('abc123', 'John Doe')
USING TIMESTAMP 1609459200000000;` },
    { name: "INSERT IF NOT EXISTS", desc: "Conditional insert (LWT)", example: `INSERT INTO users (user_id, name, email)
VALUES ('abc123', 'John Doe', 'john@example.com')
IF NOT EXISTS;` },
    { name: "INSERT JSON", desc: "Insert from JSON", example: `INSERT INTO users JSON '{"user_id": "abc123", "name": "John Doe", "email": "john@example.com"}';` },
    { name: "INSERT with DEFAULT", desc: "Use default values", example: `INSERT INTO users (user_id, name, created_at)
VALUES ('abc123', 'John Doe', toTimestamp(now()))
USING TTL 86400;` },
  ],
  update: [
    { name: "UPDATE basic", desc: "Basic update", example: `UPDATE users SET name = 'Jane Doe' WHERE user_id = 'abc123';` },
    { name: "UPDATE multiple", desc: "Update multiple columns", example: `UPDATE users
SET name = 'Jane Doe', email = 'jane@example.com', updated_at = toTimestamp(now())
WHERE user_id = 'abc123';` },
    { name: "UPDATE with TTL", desc: "Set TTL on update", example: `UPDATE users USING TTL 3600
SET session_token = 'token123'
WHERE user_id = 'abc123';` },
    { name: "UPDATE with TIMESTAMP", desc: "Set timestamp on update", example: `UPDATE users USING TIMESTAMP 1609459200000000
SET name = 'Jane Doe'
WHERE user_id = 'abc123';` },
    { name: "UPDATE IF EXISTS", desc: "Conditional update (LWT)", example: `UPDATE users SET name = 'Jane Doe'
WHERE user_id = 'abc123'
IF EXISTS;` },
    { name: "UPDATE IF condition", desc: "Update with condition (LWT)", example: `UPDATE users SET status = 'inactive'
WHERE user_id = 'abc123'
IF status = 'active';` },
    { name: "UPDATE counter", desc: "Increment counter column", example: `UPDATE user_stats SET login_count = login_count + 1
WHERE user_id = 'abc123';` },
    { name: "UPDATE list append", desc: "Append to list", example: `UPDATE users SET tags = tags + ['new_tag']
WHERE user_id = 'abc123';` },
    { name: "UPDATE list prepend", desc: "Prepend to list", example: `UPDATE users SET tags = ['first_tag'] + tags
WHERE user_id = 'abc123';` },
    { name: "UPDATE set add", desc: "Add to set", example: `UPDATE users SET roles = roles + {'admin'}
WHERE user_id = 'abc123';` },
    { name: "UPDATE set remove", desc: "Remove from set", example: `UPDATE users SET roles = roles - {'guest'}
WHERE user_id = 'abc123';` },
    { name: "UPDATE map put", desc: "Add/update map entry", example: `UPDATE users SET preferences['theme'] = 'dark'
WHERE user_id = 'abc123';` },
    { name: "UPDATE map remove", desc: "Remove map entry", example: `UPDATE users SET preferences = preferences - {'old_key'}
WHERE user_id = 'abc123';` },
  ],
  delete: [
    { name: "DELETE row", desc: "Delete entire row", example: `DELETE FROM users WHERE user_id = 'abc123';` },
    { name: "DELETE column", desc: "Delete specific column", example: `DELETE email FROM users WHERE user_id = 'abc123';` },
    { name: "DELETE multiple columns", desc: "Delete multiple columns", example: `DELETE email, phone FROM users WHERE user_id = 'abc123';` },
    { name: "DELETE with IN", desc: "Delete multiple rows", example: `DELETE FROM users WHERE user_id IN ('id1', 'id2', 'id3');` },
    { name: "DELETE IF EXISTS", desc: "Conditional delete (LWT)", example: `DELETE FROM users WHERE user_id = 'abc123' IF EXISTS;` },
    { name: "DELETE IF condition", desc: "Delete with condition (LWT)", example: `DELETE FROM users
WHERE user_id = 'abc123'
IF status = 'inactive';` },
    { name: "DELETE list element", desc: "Remove from list by value", example: `DELETE tags['old_tag'] FROM users WHERE user_id = 'abc123';` },
    { name: "DELETE with range", desc: "Delete range (clustering)", example: `DELETE FROM events
WHERE partition_key = 'pk1'
AND event_time >= '2024-01-01'
AND event_time < '2024-02-01';` },
  ],
  ddl: [
    { name: "CREATE KEYSPACE", desc: "Create new keyspace", example: `CREATE KEYSPACE IF NOT EXISTS my_keyspace
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 3
};` },
    { name: "CREATE KEYSPACE (NetworkTopology)", desc: "Multi-datacenter keyspace", example: `CREATE KEYSPACE IF NOT EXISTS my_keyspace
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'dc1': 3,
  'dc2': 2
};` },
    { name: "CREATE TABLE", desc: "Create new table", example: `CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY,
  name TEXT,
  email TEXT,
  created_at TIMESTAMP
);` },
    { name: "CREATE TABLE (compound key)", desc: "Compound primary key", example: `CREATE TABLE IF NOT EXISTS events (
  partition_key TEXT,
  event_time TIMESTAMP,
  event_type TEXT,
  data TEXT,
  PRIMARY KEY (partition_key, event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);` },
    { name: "CREATE TABLE (composite partition)", desc: "Composite partition key", example: `CREATE TABLE IF NOT EXISTS user_events (
  user_id UUID,
  year INT,
  event_time TIMESTAMP,
  event_type TEXT,
  PRIMARY KEY ((user_id, year), event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);` },
    { name: "CREATE INDEX", desc: "Create secondary index", example: `CREATE INDEX IF NOT EXISTS users_email_idx
ON users (email);` },
    { name: "CREATE INDEX (collection)", desc: "Index on collection", example: `CREATE INDEX IF NOT EXISTS users_tags_idx
ON users (VALUES(tags));` },
    { name: "CREATE MATERIALIZED VIEW", desc: "Create materialized view", example: `CREATE MATERIALIZED VIEW users_by_email AS
SELECT * FROM users
WHERE email IS NOT NULL AND user_id IS NOT NULL
PRIMARY KEY (email, user_id);` },
    { name: "ALTER TABLE add", desc: "Add column", example: `ALTER TABLE users ADD phone TEXT;` },
    { name: "ALTER TABLE drop", desc: "Drop column", example: `ALTER TABLE users DROP phone;` },
    { name: "ALTER TABLE rename", desc: "Rename column", example: `ALTER TABLE users RENAME old_column TO new_column;` },
    { name: "DROP TABLE", desc: "Drop table", example: `DROP TABLE IF EXISTS users;` },
    { name: "DROP KEYSPACE", desc: "Drop keyspace", example: `DROP KEYSPACE IF EXISTS my_keyspace;` },
    { name: "DROP INDEX", desc: "Drop index", example: `DROP INDEX IF EXISTS users_email_idx;` },
    { name: "TRUNCATE", desc: "Remove all data", example: `TRUNCATE users;` },
  ],
  collections: [
    { name: "List column", desc: "Define list column", example: `-- In CREATE TABLE:
tags LIST<TEXT>

-- Insert:
INSERT INTO users (user_id, tags) VALUES ('abc', ['tag1', 'tag2']);

-- Append:
UPDATE users SET tags = tags + ['tag3'] WHERE user_id = 'abc';` },
    { name: "Set column", desc: "Define set column", example: `-- In CREATE TABLE:
roles SET<TEXT>

-- Insert:
INSERT INTO users (user_id, roles) VALUES ('abc', {'admin', 'user'});

-- Add:
UPDATE users SET roles = roles + {'editor'} WHERE user_id = 'abc';` },
    { name: "Map column", desc: "Define map column", example: `-- In CREATE TABLE:
preferences MAP<TEXT, TEXT>

-- Insert:
INSERT INTO users (user_id, preferences) VALUES ('abc', {'theme': 'dark', 'lang': 'en'});

-- Update entry:
UPDATE users SET preferences['theme'] = 'light' WHERE user_id = 'abc';` },
    { name: "Frozen collection", desc: "Immutable collection", example: `-- In CREATE TABLE (for nested or as clustering key):
address FROZEN<MAP<TEXT, TEXT>>

-- Must replace entire value:
UPDATE users SET address = {'street': '123 Main', 'city': 'NYC'} WHERE user_id = 'abc';` },
    { name: "Query CONTAINS", desc: "Filter by collection value", example: `SELECT * FROM users
WHERE tags CONTAINS 'premium'
ALLOW FILTERING;` },
    { name: "Query CONTAINS KEY", desc: "Filter by map key", example: `SELECT * FROM users
WHERE preferences CONTAINS KEY 'theme'
ALLOW FILTERING;` },
  ],
  functions: [
    { name: "now()", desc: "Current time UUID", example: `INSERT INTO events (event_id, event_type)
VALUES (now(), 'login');` },
    { name: "uuid()", desc: "Random UUID", example: `INSERT INTO users (user_id, name)
VALUES (uuid(), 'John Doe');` },
    { name: "toTimestamp()", desc: "Convert to timestamp", example: `SELECT toTimestamp(now()) AS current_time FROM system.local;` },
    { name: "toDate()", desc: "Convert to date", example: `SELECT toDate(now()) AS current_date FROM system.local;` },
    { name: "toUnixTimestamp()", desc: "Convert to Unix timestamp", example: `SELECT toUnixTimestamp(now()) AS unix_ts FROM system.local;` },
    { name: "dateOf()", desc: "Extract date from timeuuid", example: `SELECT dateOf(event_id) FROM events WHERE partition_key = 'pk1';` },
    { name: "minTimeuuid()", desc: "Min timeuuid for date", example: `SELECT * FROM events
WHERE partition_key = 'pk1'
AND event_id >= minTimeuuid('2024-01-01 00:00:00+0000')
AND event_id < maxTimeuuid('2024-02-01 00:00:00+0000');` },
    { name: "maxTimeuuid()", desc: "Max timeuuid for date", example: `SELECT * FROM events
WHERE partition_key = 'pk1'
AND event_id <= maxTimeuuid('2024-01-31 23:59:59+0000');` },
    { name: "token()", desc: "Get partition token", example: `SELECT token(user_id), * FROM users;` },
    { name: "TTL()", desc: "Get column TTL", example: `SELECT TTL(session_token) FROM users WHERE user_id = 'abc123';` },
    { name: "WRITETIME()", desc: "Get write timestamp", example: `SELECT WRITETIME(name) FROM users WHERE user_id = 'abc123';` },
    { name: "CAST()", desc: "Type casting", example: `SELECT CAST(created_at AS DATE) FROM users WHERE user_id = 'abc123';` },
    { name: "blobAsText()", desc: "Convert blob to text", example: `SELECT blobAsText(data) FROM binary_data WHERE id = 'abc';` },
    { name: "textAsBlob()", desc: "Convert text to blob", example: `INSERT INTO binary_data (id, data) VALUES ('abc', textAsBlob('hello'));` },
  ],
  aggregates: [
    { name: "COUNT(*)", desc: "Count all rows", example: `SELECT COUNT(*) FROM users;` },
    { name: "COUNT(column)", desc: "Count non-null values", example: `SELECT COUNT(email) FROM users;` },
    { name: "SUM()", desc: "Sum numeric column", example: `SELECT SUM(amount) FROM orders WHERE user_id = 'abc123';` },
    { name: "AVG()", desc: "Average of column", example: `SELECT AVG(price) FROM products WHERE category = 'electronics' ALLOW FILTERING;` },
    { name: "MIN()", desc: "Minimum value", example: `SELECT MIN(created_at) FROM users;` },
    { name: "MAX()", desc: "Maximum value", example: `SELECT MAX(price) FROM products;` },
    { name: "GROUP BY", desc: "Group aggregates", example: `SELECT status, COUNT(*)
FROM users
GROUP BY status;` },
    { name: "GROUP BY (partition)", desc: "Group by partition key", example: `SELECT user_id, COUNT(*), SUM(amount)
FROM orders
GROUP BY user_id;` },
  ],
  batch: [
    { name: "BATCH (logged)", desc: "Atomic batch (default)", example: `BEGIN BATCH
  INSERT INTO users (user_id, name) VALUES ('id1', 'User 1');
  INSERT INTO users (user_id, name) VALUES ('id2', 'User 2');
  UPDATE user_stats SET count = count + 2 WHERE stat_id = 'total';
APPLY BATCH;` },
    { name: "BATCH (unlogged)", desc: "Non-atomic batch", example: `BEGIN UNLOGGED BATCH
  INSERT INTO logs (log_id, message) VALUES (now(), 'Log 1');
  INSERT INTO logs (log_id, message) VALUES (now(), 'Log 2');
  INSERT INTO logs (log_id, message) VALUES (now(), 'Log 3');
APPLY BATCH;` },
    { name: "BATCH (counter)", desc: "Counter batch", example: `BEGIN COUNTER BATCH
  UPDATE page_views SET views = views + 1 WHERE page_id = 'home';
  UPDATE page_views SET views = views + 1 WHERE page_id = 'about';
APPLY BATCH;` },
    { name: "BATCH with TTL", desc: "Batch with TTL", example: `BEGIN BATCH USING TTL 3600
  INSERT INTO sessions (session_id, user_id) VALUES ('s1', 'u1');
  INSERT INTO sessions (session_id, user_id) VALUES ('s2', 'u2');
APPLY BATCH;` },
    { name: "BATCH with TIMESTAMP", desc: "Batch with timestamp", example: `BEGIN BATCH USING TIMESTAMP 1609459200000000
  INSERT INTO audit (id, action) VALUES (uuid(), 'create');
  INSERT INTO audit (id, action) VALUES (uuid(), 'update');
APPLY BATCH;` },
  ],
  admin: [
    { name: "DESCRIBE KEYSPACES", desc: "List all keyspaces", example: `DESCRIBE KEYSPACES;` },
    { name: "DESCRIBE KEYSPACE", desc: "Describe keyspace", example: `DESCRIBE KEYSPACE my_keyspace;` },
    { name: "DESCRIBE TABLES", desc: "List tables in keyspace", example: `DESCRIBE TABLES;` },
    { name: "DESCRIBE TABLE", desc: "Describe table schema", example: `DESCRIBE TABLE users;` },
    { name: "USE keyspace", desc: "Switch keyspace", example: `USE my_keyspace;` },
    { name: "CONSISTENCY", desc: "Set consistency level", example: `CONSISTENCY QUORUM;
-- Options: ANY, ONE, TWO, THREE, QUORUM, ALL, LOCAL_QUORUM, EACH_QUORUM, LOCAL_ONE` },
    { name: "TRACING ON", desc: "Enable query tracing", example: `TRACING ON;
SELECT * FROM users WHERE user_id = 'abc123';
TRACING OFF;` },
    { name: "EXPAND ON", desc: "Vertical output format", example: `EXPAND ON;
SELECT * FROM users LIMIT 1;
EXPAND OFF;` },
    { name: "SOURCE", desc: "Execute CQL file", example: `SOURCE '/path/to/script.cql';` },
    { name: "COPY TO", desc: "Export to CSV", example: `COPY users (user_id, name, email) TO '/tmp/users.csv' WITH HEADER = TRUE;` },
    { name: "COPY FROM", desc: "Import from CSV", example: `COPY users (user_id, name, email) FROM '/tmp/users.csv' WITH HEADER = TRUE;` },
  ],
};
