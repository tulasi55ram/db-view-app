-- Sample data for MySQL development

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    quantity INT DEFAULT 0,
    category VARCHAR(100),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(12, 2),
    shipping_address JSON,
    notes TEXT,
    ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Order items table
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Create a view
CREATE VIEW user_order_summary AS
SELECT
    u.id,
    u.name,
    u.email,
    COUNT(o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as lifetime_value
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name, u.email;

-- Insert sample data
INSERT INTO users (email, name, role, metadata) VALUES
('alice@example.com', 'Alice Johnson', 'admin', '{"department": "Engineering", "level": 5}'),
('bob@example.com', 'Bob Smith', 'user', '{"department": "Sales", "level": 2}'),
('carol@example.com', 'Carol Williams', 'user', '{"department": "Marketing", "level": 3}'),
('david@example.com', 'David Brown', 'moderator', '{"department": "Support", "level": 4}'),
('eve@example.com', 'Eve Davis', 'user', NULL);

INSERT INTO products (sku, name, description, price, quantity, category) VALUES
('LAPTOP-001', 'Pro Laptop 15"', 'High-performance laptop for professionals', 1299.99, 50, 'Electronics'),
('MOUSE-001', 'Wireless Mouse', 'Ergonomic wireless mouse', 49.99, 200, 'Accessories'),
('KEYBOARD-001', 'Mechanical Keyboard', 'RGB mechanical keyboard', 129.99, 75, 'Accessories'),
('MONITOR-001', '27" 4K Monitor', 'Ultra HD monitor with HDR', 449.99, 30, 'Electronics'),
('HEADSET-001', 'Noise Cancelling Headset', 'Premium wireless headset', 199.99, 100, 'Audio');

INSERT INTO orders (user_id, status, total_amount, shipping_address, notes) VALUES
(1, 'completed', 1349.98, '{"street": "123 Main St", "city": "Seattle", "zip": "98101"}', NULL),
(2, 'pending', 179.98, '{"street": "456 Oak Ave", "city": "Portland", "zip": "97201"}', 'Gift wrap please'),
(1, 'shipped', 449.99, '{"street": "123 Main St", "city": "Seattle", "zip": "98101"}', NULL),
(3, 'completed', 49.99, '{"street": "789 Pine Rd", "city": "San Francisco", "zip": "94102"}', NULL);

INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES
(1, 1, 1, 1299.99, 1299.99),
(1, 2, 1, 49.99, 49.99),
(2, 3, 1, 129.99, 129.99),
(2, 2, 1, 49.99, 49.99),
(3, 4, 1, 449.99, 449.99),
(4, 2, 1, 49.99, 49.99);
