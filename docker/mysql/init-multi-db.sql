-- ============================================================================
-- MySQL Multi-Database Initialization Script
-- This script creates multiple databases for testing the "Show All Databases" feature
-- ============================================================================

-- Create additional databases
-- Note: The default database "dbview_dev" is already created by the environment variable
CREATE DATABASE IF NOT EXISTS ecommerce_prod;
CREATE DATABASE IF NOT EXISTS analytics_staging;
CREATE DATABASE IF NOT EXISTS inventory_system;
CREATE DATABASE IF NOT EXISTS customer_portal;
CREATE DATABASE IF NOT EXISTS test_environment;

-- Use ecommerce_prod database
USE ecommerce_prod;

-- Simple ecommerce schema
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    total_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data
INSERT INTO users (email, username, full_name) VALUES
('john@example.com', 'john_doe', 'John Doe'),
('jane@example.com', 'jane_smith', 'Jane Smith'),
('bob@example.com', 'bob_wilson', 'Bob Wilson'),
('alice@example.com', 'alice_brown', 'Alice Brown');

INSERT INTO products (name, price, stock_quantity, category) VALUES
('Laptop Pro 15"', 1299.99, 50, 'Electronics'),
('Wireless Mouse', 49.99, 200, 'Accessories'),
('Mechanical Keyboard', 129.99, 75, 'Accessories'),
('4K Monitor 27"', 449.99, 60, 'Electronics'),
('USB-C Hub', 39.99, 150, 'Accessories'),
('Gaming Headset', 149.99, 80, 'Audio'),
('Webcam HD', 89.99, 90, 'Electronics'),
('Desk Lamp LED', 34.99, 120, 'Office');

INSERT INTO orders (user_id, total_amount, status) VALUES
(1, 1349.98, 'delivered'),
(2, 179.98, 'shipped'),
(1, 449.99, 'processing'),
(3, 49.99, 'delivered'),
(4, 299.97, 'pending');

-- Use analytics_staging database
USE analytics_staging;

-- Analytics schema
CREATE TABLE page_views (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    page_url VARCHAR(500) NOT NULL,
    user_id INT,
    session_id VARCHAR(36),
    referrer VARCHAR(500),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_viewed_at (viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    user_id INT,
    properties JSON,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_event_type (event_type),
    INDEX idx_occurred_at (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE daily_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    metric_date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15, 2),
    UNIQUE KEY unique_metric (metric_date, metric_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample analytics data
INSERT INTO events (event_type, event_name, user_id, properties) VALUES
('page_view', 'Homepage View', 1, '{"referrer": "google", "device": "desktop"}'),
('click', 'Product Click', 1, '{"product_id": 1, "product_name": "Laptop Pro"}'),
('purchase', 'Order Complete', 1, '{"order_id": 1, "amount": 1299.99}'),
('page_view', 'Dashboard View', 2, '{"duration": 45, "scroll_depth": 80}'),
('signup', 'User Signup', 3, '{"source": "organic", "campaign": null}');

INSERT INTO page_views (page_url, user_id, session_id, referrer) VALUES
('/', 1, UUID(), 'https://google.com'),
('/products', 1, UUID(), '/'),
('/products/laptop-pro', 1, UUID(), '/products'),
('/cart', 1, UUID(), '/products/laptop-pro'),
('/checkout', 1, UUID(), '/cart');

INSERT INTO daily_metrics (metric_date, metric_name, metric_value) VALUES
(CURDATE(), 'daily_active_users', 1523),
(CURDATE(), 'revenue_today', 45678.99),
(CURDATE(), 'conversion_rate', 3.45),
(CURDATE(), 'average_order_value', 234.56);

-- Use inventory_system database
USE inventory_system;

-- Inventory schema
CREATE TABLE warehouses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    capacity INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_id INT,
    sku VARCHAR(50) UNIQUE NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    quantity INT DEFAULT 0,
    reorder_level INT DEFAULT 10,
    unit_cost DECIMAL(10, 2),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_movements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    inventory_item_id INT,
    movement_type ENUM('in', 'out', 'adjustment', 'transfer') NOT NULL,
    quantity INT NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample inventory data
INSERT INTO warehouses (code, name, location, capacity) VALUES
('WH-SEA', 'Seattle Main Warehouse', 'Seattle, WA', 50000),
('WH-PDX', 'Portland Distribution Center', 'Portland, OR', 35000),
('WH-SF', 'San Francisco Warehouse', 'San Francisco, CA', 28000);

INSERT INTO inventory_items (warehouse_id, sku, product_name, quantity, reorder_level, unit_cost) VALUES
(1, 'LAPTOP-001', 'Laptop Pro 15"', 50, 10, 950.00),
(1, 'MOUSE-001', 'Wireless Mouse', 200, 50, 25.00),
(1, 'KEYBOARD-001', 'Mechanical Keyboard', 75, 20, 70.00),
(2, 'MONITOR-001', '4K Monitor 27"', 60, 15, 300.00),
(2, 'HUB-001', 'USB-C Hub', 150, 40, 20.00),
(3, 'HEADSET-001', 'Gaming Headset', 80, 25, 85.00);

INSERT INTO stock_movements (inventory_item_id, movement_type, quantity, reference_number, notes) VALUES
(1, 'in', 100, 'PO-2024-001', 'Initial stock'),
(1, 'out', 50, 'SO-2024-001', 'Sold to customer'),
(2, 'in', 500, 'PO-2024-002', 'Bulk order'),
(2, 'out', 300, 'SO-2024-002', 'Various sales'),
(3, 'in', 200, 'PO-2024-003', 'Restock'),
(3, 'adjustment', -125, 'ADJ-001', 'Inventory count adjustment');

-- Use customer_portal database
USE customer_portal;

-- Customer portal schema
CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_number VARCHAR(20) UNIQUE NOT NULL,
    company_name VARCHAR(200),
    contact_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    account_status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE support_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INT,
    subject VARCHAR(300) NOT NULL,
    description TEXT,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ticket_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT,
    author_name VARCHAR(100) NOT NULL,
    comment_text TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample customer portal data
INSERT INTO customers (customer_number, company_name, contact_name, email, phone, account_status) VALUES
('CUST-001', 'Acme Corporation', 'John Acme', 'john@acme.com', '+1-555-0101', 'active'),
('CUST-002', 'TechStart Inc', 'Sarah Founder', 'sarah@techstart.com', '+1-555-0102', 'active'),
('CUST-003', 'Global Enterprises', 'Michael Global', 'michael@global.com', '+1-555-0103', 'active'),
('CUST-004', NULL, 'Emily Individual', 'emily@email.com', '+1-555-0104', 'active'),
('CUST-005', 'Beta Corp', 'Robert Beta', 'robert@beta.com', '+1-555-0105', 'inactive');

INSERT INTO support_tickets (ticket_number, customer_id, subject, description, priority, status) VALUES
('TKT-2024-001', 1, 'Login issues', 'Cannot log into the dashboard', 'high', 'in_progress'),
('TKT-2024-002', 2, 'Feature request', 'Would like bulk export functionality', 'medium', 'open'),
('TKT-2024-003', 1, 'Billing question', 'Question about recent invoice', 'low', 'resolved'),
('TKT-2024-004', 3, 'System performance', 'Slow response times', 'urgent', 'in_progress'),
('TKT-2024-005', 4, 'How to guide', 'Need help with setup', 'medium', 'closed');

INSERT INTO ticket_comments (ticket_id, author_name, comment_text, is_internal) VALUES
(1, 'Support Agent', 'Investigating the login issue', FALSE),
(1, 'John Acme', 'Tried clearing cache, still not working', FALSE),
(2, 'Product Team', 'Noted for next sprint planning', TRUE),
(3, 'Billing Team', 'Invoice sent via email', FALSE),
(4, 'DevOps', 'Scaling up servers to handle load', TRUE);

-- Use test_environment database
USE test_environment;

-- Test/experimental schema
CREATE TABLE test_runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_name VARCHAR(200) NOT NULL,
    test_type VARCHAR(50),
    status ENUM('pending', 'running', 'passed', 'failed') DEFAULT 'pending',
    duration_ms INT,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE feature_flags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flag_name VARCHAR(100) UNIQUE NOT NULL,
    flag_key VARCHAR(100) UNIQUE NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    rollout_percentage INT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sample_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data_type VARCHAR(50),
    data_value TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample test data
INSERT INTO test_runs (test_name, test_type, status, duration_ms) VALUES
('User Authentication Test', 'integration', 'passed', 234),
('Product List API Test', 'api', 'passed', 156),
('Checkout Flow Test', 'e2e', 'running', NULL),
('Database Migration Test', 'unit', 'failed', 45),
('Performance Load Test', 'performance', 'passed', 12456);

INSERT INTO feature_flags (flag_name, flag_key, is_enabled, rollout_percentage, description) VALUES
('New Dashboard', 'new_dashboard_ui', TRUE, 100, 'New redesigned dashboard interface'),
('Dark Mode', 'dark_mode_theme', TRUE, 50, 'Dark mode theme option'),
('Beta Features', 'beta_features_access', FALSE, 10, 'Access to beta features'),
('Advanced Analytics', 'advanced_analytics', TRUE, 75, 'Advanced analytics dashboard');

INSERT INTO sample_data (data_type, data_value, metadata) VALUES
('string', 'Hello World', '{"source": "manual", "validated": true}'),
('number', '42', '{"unit": "integer", "range": "0-100"}'),
('json', '{"key": "value", "nested": {"data": true}}', '{"format": "json"}'),
('array', '[1, 2, 3, 4, 5]', '{"type": "integer_array"}');

-- Grant permissions on all databases
GRANT ALL PRIVILEGES ON ecommerce_prod.* TO 'dbview'@'%';
GRANT ALL PRIVILEGES ON analytics_staging.* TO 'dbview'@'%';
GRANT ALL PRIVILEGES ON inventory_system.* TO 'dbview'@'%';
GRANT ALL PRIVILEGES ON customer_portal.* TO 'dbview'@'%';
GRANT ALL PRIVILEGES ON test_environment.* TO 'dbview'@'%';

FLUSH PRIVILEGES;

-- Switch back to default database
USE dbview_dev;

-- The original init.sql will be run after this file, creating full schema in dbview_dev
