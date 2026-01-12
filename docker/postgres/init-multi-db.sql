-- ============================================================================
-- PostgreSQL Multi-Database Initialization Script
-- This script creates multiple databases for testing the "Show All Databases" feature
-- ============================================================================

-- Create additional databases
-- Note: The default database "dbview_dev" is already created by the environment variable
CREATE DATABASE ecommerce_prod;
CREATE DATABASE analytics_staging;
CREATE DATABASE hr_system;
CREATE DATABASE finance_app;
CREATE DATABASE test_playground;

-- Connect to ecommerce_prod and create sample schema
\c ecommerce_prod

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Simple ecommerce schema
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample data
INSERT INTO users (email, username, full_name) VALUES
('john@example.com', 'john_doe', 'John Doe'),
('jane@example.com', 'jane_smith', 'Jane Smith'),
('bob@example.com', 'bob_wilson', 'Bob Wilson');

INSERT INTO products (name, price, stock_quantity) VALUES
('Laptop Pro 15"', 1299.99, 50),
('Wireless Mouse', 49.99, 200),
('Mechanical Keyboard', 129.99, 75),
('4K Monitor', 449.99, 60),
('USB-C Hub', 39.99, 150);

INSERT INTO orders (user_id, total_amount, status) VALUES
(1, 1349.98, 'delivered'),
(2, 179.98, 'shipped'),
(1, 449.99, 'processing'),
(3, 49.99, 'delivered');

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dbview;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dbview;

-- Connect to analytics_staging and create sample schema
\c analytics_staging

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Analytics schema
CREATE TABLE page_views (
    id BIGSERIAL PRIMARY KEY,
    page_url TEXT NOT NULL,
    user_id INTEGER,
    session_id UUID,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    user_id INTEGER,
    properties JSONB DEFAULT '{}',
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(15, 2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample analytics data
INSERT INTO events (event_type, event_name, user_id, properties) VALUES
('page_view', 'Homepage View', 1, '{"referrer": "google"}'),
('click', 'Product Click', 1, '{"product_id": 1}'),
('purchase', 'Order Complete', 1, '{"order_id": 1, "amount": 1299.99}'),
('page_view', 'Dashboard View', 2, '{"duration": 45}');

INSERT INTO metrics (metric_name, metric_value) VALUES
('daily_active_users', 1523),
('revenue_today', 45678.99),
('conversion_rate', 3.45),
('average_session_duration', 324.5);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dbview;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dbview;

-- Connect to hr_system and create sample schema
\c hr_system

-- HR schema
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    budget DECIMAL(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    employee_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    job_title VARCHAR(100) NOT NULL,
    salary NUMERIC(12, 2) NOT NULL,
    hire_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE time_off_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample HR data
INSERT INTO departments (name, budget) VALUES
('Engineering', 2500000.00),
('Sales', 1200000.00),
('Marketing', 800000.00),
('Support', 600000.00);

INSERT INTO employees (employee_number, first_name, last_name, email, department_id, job_title, salary, hire_date) VALUES
('EMP-001', 'Alice', 'Johnson', 'alice@company.com', 1, 'Senior Engineer', 95000.00, '2020-03-15'),
('EMP-002', 'Bob', 'Smith', 'bob@company.com', 1, 'Software Engineer', 75000.00, '2021-07-22'),
('EMP-003', 'Carol', 'Williams', 'carol@company.com', 3, 'UX Designer', 82000.00, '2020-11-08'),
('EMP-004', 'David', 'Brown', 'david@company.com', 4, 'Support Lead', 88000.00, '2019-05-19');

INSERT INTO time_off_requests (employee_id, start_date, end_date, status, reason) VALUES
(1, '2024-03-15', '2024-03-20', 'approved', 'Vacation'),
(2, '2024-04-01', '2024-04-03', 'pending', 'Personal'),
(3, '2024-03-25', '2024-03-26', 'approved', 'Conference');

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dbview;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dbview;

-- Connect to finance_app and create sample schema
\c finance_app

-- Finance schema
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_name VARCHAR(200) NOT NULL,
    account_type VARCHAR(50),
    balance DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id),
    transaction_type VARCHAR(20),
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(200),
    total_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample finance data
INSERT INTO accounts (account_number, account_name, account_type, balance) VALUES
('ACC-1001', 'Operating Account', 'checking', 250000.00),
('ACC-1002', 'Savings Account', 'savings', 500000.00),
('ACC-1003', 'Payroll Account', 'checking', 150000.00);

INSERT INTO transactions (account_id, transaction_type, amount, description) VALUES
(1, 'deposit', 50000.00, 'Client payment received'),
(1, 'withdrawal', 5000.00, 'Office supplies'),
(2, 'deposit', 100000.00, 'Investment income'),
(3, 'withdrawal', 80000.00, 'Monthly payroll');

INSERT INTO invoices (invoice_number, customer_name, total_amount, status, issue_date, due_date) VALUES
('INV-2024-001', 'Acme Corp', 15000.00, 'paid', '2024-01-15', '2024-02-14'),
('INV-2024-002', 'Tech Start Inc', 8500.00, 'sent', '2024-02-01', '2024-03-02'),
('INV-2024-003', 'Global Enterprises', 25000.00, 'overdue', '2023-12-15', '2024-01-14');

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dbview;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dbview;

-- Connect to test_playground and create experimental schema
\c test_playground

-- Test/experimental schema
CREATE TABLE experiments (
    id SERIAL PRIMARY KEY,
    experiment_name VARCHAR(200) NOT NULL,
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE test_data (
    id SERIAL PRIMARY KEY,
    data_type VARCHAR(50),
    data_value TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample test data
INSERT INTO experiments (experiment_name, status) VALUES
('A/B Test Homepage', 'running'),
('Feature Flag Testing', 'completed'),
('Performance Benchmark', 'running');

INSERT INTO test_data (data_type, data_value, metadata) VALUES
('string', 'Hello World', '{"source": "manual", "validated": true}'),
('number', '42', '{"unit": "integer"}'),
('json', '{"key": "value"}', '{"format": "json"}');

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dbview;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dbview;

-- Switch back to default database
\c dbview_dev

-- The original init.sql will be run after this file, creating full schema in dbview_dev
