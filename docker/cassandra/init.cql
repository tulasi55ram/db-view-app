-- Cassandra initialization script for dbview development
-- Creates keyspace, tables, and sample data

-- Create keyspace with replication
CREATE KEYSPACE IF NOT EXISTS dbview_dev
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 1
};

USE dbview_dev;

-- ============================================
-- User-Defined Types (UDTs)
-- ============================================

CREATE TYPE IF NOT EXISTS address (
  street text,
  city text,
  state text,
  zip text,
  country text
);

CREATE TYPE IF NOT EXISTS phone (
  type text,
  number text
);

-- ============================================
-- Users table
-- Demonstrates: partition key, clustering key, UDT, collections
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  user_id uuid,
  email text,
  username text,
  first_name text,
  last_name text,
  address frozen<address>,
  phones set<frozen<phone>>,
  tags set<text>,
  preferences map<text, text>,
  created_at timestamp,
  updated_at timestamp,
  is_active boolean,
  PRIMARY KEY (user_id)
);

-- Create secondary index on email for lookups
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- Insert sample users
INSERT INTO users (user_id, email, username, first_name, last_name, address, phones, tags, preferences, created_at, updated_at, is_active)
VALUES (
  uuid(),
  'john.doe@example.com',
  'johndoe',
  'John',
  'Doe',
  {street: '123 Main St', city: 'San Francisco', state: 'CA', zip: '94102', country: 'USA'},
  {{type: 'mobile', number: '+1-555-0101'}, {type: 'work', number: '+1-555-0102'}},
  {'developer', 'premium', 'early-adopter'},
  {'theme': 'dark', 'language': 'en', 'notifications': 'enabled'},
  toTimestamp(now()),
  toTimestamp(now()),
  true
);

INSERT INTO users (user_id, email, username, first_name, last_name, address, phones, tags, preferences, created_at, updated_at, is_active)
VALUES (
  uuid(),
  'jane.smith@example.com',
  'janesmith',
  'Jane',
  'Smith',
  {street: '456 Oak Ave', city: 'New York', state: 'NY', zip: '10001', country: 'USA'},
  {{type: 'mobile', number: '+1-555-0201'}},
  {'designer', 'premium'},
  {'theme': 'light', 'language': 'en'},
  toTimestamp(now()),
  toTimestamp(now()),
  true
);

INSERT INTO users (user_id, email, username, first_name, last_name, address, phones, tags, preferences, created_at, updated_at, is_active)
VALUES (
  uuid(),
  'bob.wilson@example.com',
  'bobwilson',
  'Bob',
  'Wilson',
  {street: '789 Pine Rd', city: 'Seattle', state: 'WA', zip: '98101', country: 'USA'},
  {{type: 'home', number: '+1-555-0301'}},
  {'manager'},
  {'theme': 'system', 'language': 'en'},
  toTimestamp(now()),
  toTimestamp(now()),
  false
);

-- ============================================
-- Products table
-- Demonstrates: composite partition key
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  category text,
  product_id uuid,
  name text,
  description text,
  price decimal,
  stock int,
  attributes map<text, text>,
  tags list<text>,
  created_at timestamp,
  PRIMARY KEY (category, product_id)
) WITH CLUSTERING ORDER BY (product_id ASC);

-- Insert sample products
INSERT INTO products (category, product_id, name, description, price, stock, attributes, tags, created_at)
VALUES ('electronics', uuid(), 'Laptop Pro 15', 'High-performance laptop with 15-inch display', 1299.99, 50, {'brand': 'TechCorp', 'color': 'silver', 'warranty': '2 years'}, ['laptop', 'computer', 'portable'], toTimestamp(now()));

INSERT INTO products (category, product_id, name, description, price, stock, attributes, tags, created_at)
VALUES ('electronics', uuid(), 'Wireless Mouse', 'Ergonomic wireless mouse with long battery life', 49.99, 200, {'brand': 'TechCorp', 'color': 'black', 'connectivity': 'bluetooth'}, ['mouse', 'accessory', 'wireless'], toTimestamp(now()));

INSERT INTO products (category, product_id, name, description, price, stock, attributes, tags, created_at)
VALUES ('electronics', uuid(), 'USB-C Hub', 'Multi-port USB-C hub with HDMI and ethernet', 79.99, 150, {'brand': 'ConnectPlus', 'ports': '7'}, ['hub', 'accessory', 'usb-c'], toTimestamp(now()));

INSERT INTO products (category, product_id, name, description, price, stock, attributes, tags, created_at)
VALUES ('furniture', uuid(), 'Standing Desk', 'Electric height-adjustable standing desk', 599.99, 30, {'brand': 'ErgoWorks', 'material': 'bamboo', 'max_height': '48 inches'}, ['desk', 'office', 'ergonomic'], toTimestamp(now()));

INSERT INTO products (category, product_id, name, description, price, stock, attributes, tags, created_at)
VALUES ('furniture', uuid(), 'Office Chair', 'Ergonomic mesh office chair with lumbar support', 349.99, 45, {'brand': 'ErgoWorks', 'color': 'black', 'adjustable': 'yes'}, ['chair', 'office', 'ergonomic'], toTimestamp(now()));

INSERT INTO products (category, product_id, name, description, price, stock, attributes, tags, created_at)
VALUES ('books', uuid(), 'Database Design Patterns', 'Comprehensive guide to database design', 54.99, 100, {'author': 'Jane Developer', 'pages': '450', 'format': 'paperback'}, ['book', 'technical', 'database'], toTimestamp(now()));

-- ============================================
-- Orders table
-- Demonstrates: time-series data pattern with clustering
-- ============================================

CREATE TABLE IF NOT EXISTS orders (
  customer_id uuid,
  order_date date,
  order_id timeuuid,
  status text,
  total_amount decimal,
  items list<frozen<map<text, text>>>,
  shipping_address frozen<address>,
  PRIMARY KEY ((customer_id), order_date, order_id)
) WITH CLUSTERING ORDER BY (order_date DESC, order_id DESC);

-- ============================================
-- Events table (time-series)
-- Demonstrates: time-series with TTL
-- ============================================

CREATE TABLE IF NOT EXISTS events (
  event_date date,
  event_time timeuuid,
  event_type text,
  user_id uuid,
  properties map<text, text>,
  PRIMARY KEY ((event_date), event_time)
) WITH CLUSTERING ORDER BY (event_time DESC)
AND default_time_to_live = 2592000; -- 30 days TTL

-- Insert sample events
INSERT INTO events (event_date, event_time, event_type, user_id, properties)
VALUES (toDate(now()), now(), 'page_view', uuid(), {'page': '/home', 'referrer': 'google.com'});

INSERT INTO events (event_date, event_time, event_type, user_id, properties)
VALUES (toDate(now()), now(), 'button_click', uuid(), {'button': 'signup', 'page': '/home'});

INSERT INTO events (event_date, event_time, event_type, user_id, properties)
VALUES (toDate(now()), now(), 'purchase', uuid(), {'product_id': 'laptop-001', 'amount': '1299.99'});

-- ============================================
-- Metrics table (counter)
-- Demonstrates: counter columns
-- ============================================

CREATE TABLE IF NOT EXISTS metrics (
  metric_name text,
  metric_date date,
  count counter,
  PRIMARY KEY ((metric_name, metric_date))
);

-- Update counters (note: counters can only be updated, not inserted with specific values)
UPDATE metrics SET count = count + 150 WHERE metric_name = 'page_views' AND metric_date = '2024-01-15';
UPDATE metrics SET count = count + 45 WHERE metric_name = 'signups' AND metric_date = '2024-01-15';
UPDATE metrics SET count = count + 12 WHERE metric_name = 'purchases' AND metric_date = '2024-01-15';
UPDATE metrics SET count = count + 180 WHERE metric_name = 'page_views' AND metric_date = '2024-01-16';
UPDATE metrics SET count = count + 52 WHERE metric_name = 'signups' AND metric_date = '2024-01-16';
UPDATE metrics SET count = count + 18 WHERE metric_name = 'purchases' AND metric_date = '2024-01-16';

-- ============================================
-- Sessions table
-- Demonstrates: blob type and wide rows
-- ============================================

CREATE TABLE IF NOT EXISTS sessions (
  session_id text,
  user_id uuid,
  created_at timestamp,
  expires_at timestamp,
  ip_address inet,
  user_agent text,
  data blob,
  PRIMARY KEY (session_id)
) WITH default_time_to_live = 86400; -- 24 hours TTL

-- ============================================
-- Materialized View
-- Demonstrates: materialized views for different query patterns
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS users_by_email AS
  SELECT * FROM users
  WHERE email IS NOT NULL AND user_id IS NOT NULL
  PRIMARY KEY (email, user_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS products_by_name AS
  SELECT * FROM products
  WHERE name IS NOT NULL AND category IS NOT NULL AND product_id IS NOT NULL
  PRIMARY KEY (name, category, product_id);

-- ============================================
-- Additional sample data for users
-- ============================================

INSERT INTO users (user_id, email, username, first_name, last_name, address, phones, tags, preferences, created_at, updated_at, is_active)
VALUES (uuid(), 'alice.johnson@example.com', 'alicej', 'Alice', 'Johnson', {street: '321 Elm St', city: 'Austin', state: 'TX', zip: '78701', country: 'USA'}, {{type: 'mobile', number: '+1-555-0401'}}, {'analyst', 'data-team'}, {'theme': 'dark', 'language': 'es'}, toTimestamp(now()), toTimestamp(now()), true);

INSERT INTO users (user_id, email, username, first_name, last_name, address, phones, tags, preferences, created_at, updated_at, is_active)
VALUES (uuid(), 'charlie.brown@example.com', 'charlieb', 'Charlie', 'Brown', {street: '654 Maple Dr', city: 'Denver', state: 'CO', zip: '80202', country: 'USA'}, {{type: 'work', number: '+1-555-0501'}}, {'admin', 'security'}, {'theme': 'light', 'language': 'en', 'two_factor': 'enabled'}, toTimestamp(now()), toTimestamp(now()), true);
