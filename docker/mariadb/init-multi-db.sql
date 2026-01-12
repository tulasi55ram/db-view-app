-- ============================================================================
-- MariaDB Multi-Database Initialization Script
-- This script creates multiple databases for testing the "Show All Databases" feature
-- ============================================================================

-- Create additional databases
CREATE DATABASE IF NOT EXISTS production_app;
CREATE DATABASE IF NOT EXISTS staging_env;
CREATE DATABASE IF NOT EXISTS development_db;
CREATE DATABASE IF NOT EXISTS reporting_system;

-- Use production_app database
USE production_app;

CREATE TABLE accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_holder VARCHAR(200) NOT NULL,
    balance DECIMAL(15, 2) DEFAULT 0,
    account_type ENUM('checking', 'savings', 'business') DEFAULT 'checking',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_id INT,
    transaction_type ENUM('deposit', 'withdrawal', 'transfer') NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    description VARCHAR(500),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

INSERT INTO accounts (account_number, account_holder, balance, account_type) VALUES
('ACC-1001', 'John Smith', 25000.00, 'checking'),
('ACC-1002', 'Jane Doe', 50000.00, 'savings'),
('ACC-1003', 'Acme Corp', 125000.00, 'business');

INSERT INTO transactions (account_id, transaction_type, amount, description) VALUES
(1, 'deposit', 5000.00, 'Payroll deposit'),
(1, 'withdrawal', 500.00, 'ATM withdrawal'),
(2, 'deposit', 10000.00, 'Transfer from checking'),
(3, 'deposit', 50000.00, 'Client payment');

-- Use staging_env database
USE staging_env;

CREATE TABLE api_endpoints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    endpoint_path VARCHAR(500) NOT NULL,
    http_method ENUM('GET', 'POST', 'PUT', 'DELETE', 'PATCH') NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    rate_limit INT DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE api_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    endpoint_id INT,
    request_method VARCHAR(10),
    status_code INT,
    response_time_ms INT,
    user_agent VARCHAR(500),
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id)
);

INSERT INTO api_endpoints (endpoint_path, http_method, description, rate_limit) VALUES
('/api/v1/users', 'GET', 'List all users', 100),
('/api/v1/users', 'POST', 'Create new user', 50),
('/api/v1/products', 'GET', 'List products', 200),
('/api/v1/orders', 'POST', 'Create order', 100);

INSERT INTO api_logs (endpoint_id, request_method, status_code, response_time_ms, ip_address) VALUES
(1, 'GET', 200, 45, '192.168.1.100'),
(1, 'GET', 200, 52, '192.168.1.101'),
(2, 'POST', 201, 123, '192.168.1.100'),
(3, 'GET', 200, 78, '192.168.1.102');

-- Use development_db database
USE development_db;

CREATE TABLE projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_name VARCHAR(200) NOT NULL,
    description TEXT,
    status ENUM('planning', 'active', 'completed', 'on_hold') DEFAULT 'planning',
    start_date DATE,
    end_date DATE,
    budget DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE developers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50),
    skill_level ENUM('junior', 'mid', 'senior', 'lead') DEFAULT 'mid',
    hourly_rate DECIMAL(8, 2),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    developer_id INT,
    hours_allocated DECIMAL(6, 2),
    hours_worked DECIMAL(6, 2) DEFAULT 0,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (developer_id) REFERENCES developers(id)
);

INSERT INTO projects (project_name, description, status, start_date, budget) VALUES
('Website Redesign', 'Complete redesign of company website', 'active', '2024-01-15', 150000.00),
('Mobile App V2', 'Version 2 of mobile app', 'planning', '2024-03-01', 300000.00),
('API Refactor', 'Refactor legacy API', 'active', '2024-02-01', 100000.00);

INSERT INTO developers (name, email, role, skill_level, hourly_rate) VALUES
('Alice Johnson', 'alice@dev.com', 'Full Stack', 'senior', 125.00),
('Bob Smith', 'bob@dev.com', 'Backend', 'mid', 85.00),
('Carol Williams', 'carol@dev.com', 'Frontend', 'senior', 110.00),
('David Brown', 'david@dev.com', 'Mobile', 'mid', 90.00);

INSERT INTO project_assignments (project_id, developer_id, hours_allocated, hours_worked) VALUES
(1, 1, 160, 85),
(1, 3, 120, 60),
(2, 4, 200, 0),
(3, 1, 80, 45),
(3, 2, 120, 70);

-- Use reporting_system database
USE reporting_system;

CREATE TABLE report_definitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_name VARCHAR(200) NOT NULL,
    report_type VARCHAR(50),
    sql_query TEXT,
    schedule VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE report_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_id INT,
    execution_time_ms INT,
    row_count INT,
    status ENUM('success', 'failed', 'timeout') DEFAULT 'success',
    error_message TEXT,
    ran_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES report_definitions(id)
);

CREATE TABLE dashboards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dashboard_name VARCHAR(200) NOT NULL,
    description TEXT,
    owner_email VARCHAR(255),
    is_public BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO report_definitions (report_name, report_type, sql_query, schedule) VALUES
('Daily Sales Report', 'sales', 'SELECT * FROM orders WHERE date = CURDATE()', 'daily'),
('Monthly Revenue', 'finance', 'SELECT SUM(amount) FROM transactions WHERE MONTH(date) = MONTH(CURDATE())', 'monthly'),
('User Activity Report', 'analytics', 'SELECT user_id, COUNT(*) FROM events GROUP BY user_id', 'weekly');

INSERT INTO report_runs (report_id, execution_time_ms, row_count, status) VALUES
(1, 234, 156, 'success'),
(1, 245, 178, 'success'),
(2, 567, 1, 'success'),
(3, 1234, 5678, 'success');

INSERT INTO dashboards (dashboard_name, description, owner_email, is_public, view_count) VALUES
('Executive Dashboard', 'High-level metrics for executives', 'ceo@company.com', FALSE, 45),
('Sales Performance', 'Sales team performance metrics', 'sales@company.com', TRUE, 234),
('System Health', 'System monitoring and health', 'ops@company.com', TRUE, 123);

-- Grant permissions on all databases
GRANT ALL PRIVILEGES ON production_app.* TO 'dbview'@'%';
GRANT ALL PRIVILEGES ON staging_env.* TO 'dbview'@'%';
GRANT ALL PRIVILEGES ON development_db.* TO 'dbview'@'%';
GRANT ALL PRIVILEGES ON reporting_system.* TO 'dbview'@'%';

FLUSH PRIVILEGES;

-- Switch back to default database
USE dbview_dev;
