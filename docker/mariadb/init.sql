-- Sample data for MariaDB development
-- MariaDB is MySQL-compatible, but includes some additional features

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
-- First insert 20 named users
INSERT INTO users (email, name, role, metadata) VALUES
('alice@example.com', 'Alice Johnson', 'admin', '{"department": "Engineering", "level": 5}'),
('bob@example.com', 'Bob Smith', 'user', '{"department": "Sales", "level": 2}'),
('carol@example.com', 'Carol Williams', 'user', '{"department": "Marketing", "level": 3}'),
('david@example.com', 'David Brown', 'moderator', '{"department": "Support", "level": 4}'),
('eve@example.com', 'Eve Davis', 'user', NULL),
('frank@example.com', 'Frank Miller', 'user', '{"department": "Engineering", "level": 3}'),
('grace@example.com', 'Grace Lee', 'user', '{"department": "HR", "level": 4}'),
('henry@example.com', 'Henry Wilson', 'admin', '{"department": "Engineering", "level": 6}'),
('iris@example.com', 'Iris Moore', 'user', '{"department": "QA", "level": 2}'),
('jack@example.com', 'Jack Taylor', 'user', '{"department": "DevOps", "level": 4}'),
('kate@example.com', 'Kate Anderson', 'user', '{"department": "Marketing", "level": 3}'),
('liam@example.com', 'Liam Thomas', 'moderator', '{"department": "Community", "level": 3}'),
('maya@example.com', 'Maya Jackson', 'user', '{"department": "Design", "level": 3}'),
('noah@example.com', 'Noah White', 'user', '{"department": "Mobile", "level": 4}'),
('olivia@example.com', 'Olivia Harris', 'user', '{"department": "Product", "level": 5}'),
('peter@example.com', 'Peter Martin', 'user', '{"department": "Sales", "level": 2}'),
('quinn@example.com', 'Quinn Garcia', 'user', '{"department": "Intern", "level": 1}'),
('rachel@example.com', 'Rachel Martinez', 'user', '{"department": "HR", "level": 4}'),
('sam@example.com', 'Sam Robinson', 'user', '{"department": "Finance", "level": 3}'),
('tina@example.com', 'Tina Clark', 'user', '{"department": "Content", "level": 3}');

-- Generate 1000 more users using a stored procedure
DELIMITER $$
CREATE PROCEDURE generate_users()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE first_names TEXT DEFAULT 'James,Mary,John,Patricia,Robert,Jennifer,Michael,Linda,William,Barbara,David,Elizabeth,Richard,Susan,Joseph,Jessica,Thomas,Sarah,Charles,Karen,Christopher,Nancy,Daniel,Lisa,Matthew,Betty,Anthony,Margaret,Mark,Sandra,Donald,Ashley,Steven,Kimberly,Paul,Emily,Andrew,Donna,Joshua,Michelle,Kenneth,Dorothy,Kevin,Carol,Brian,Amanda,George,Melissa,Timothy,Deborah';
    DECLARE last_names TEXT DEFAULT 'Smith,Johnson,Williams,Brown,Jones,Garcia,Miller,Davis,Rodriguez,Martinez,Hernandez,Lopez,Gonzalez,Wilson,Anderson,Thomas,Taylor,Moore,Jackson,Martin,Lee,Perez,Thompson,White,Harris,Sanchez,Clark,Ramirez,Lewis,Robinson,Walker,Young,Allen,King,Wright,Scott,Torres,Nguyen,Hill,Flores,Green,Adams,Nelson,Baker,Hall,Rivera,Campbell,Mitchell,Carter,Roberts';
    DECLARE departments TEXT DEFAULT 'Engineering,Sales,Marketing,Support,HR,Finance,Operations,Design,Product,QA';
    DECLARE roles TEXT DEFAULT 'user,user,user,user,moderator,admin';

    WHILE i <= 1000 DO
        INSERT INTO users (email, name, role, is_active, metadata)
        VALUES (
            CONCAT('user', i, '@example.com'),
            CONCAT(
                SUBSTRING_INDEX(SUBSTRING_INDEX(first_names, ',', 1 + (i % 50)), ',', -1),
                ' ',
                SUBSTRING_INDEX(SUBSTRING_INDEX(last_names, ',', 1 + (i % 50)), ',', -1)
            ),
            SUBSTRING_INDEX(SUBSTRING_INDEX(roles, ',', 1 + (i % 6)), ',', -1),
            IF(i % 10 = 0, FALSE, TRUE),
            JSON_OBJECT(
                'department', SUBSTRING_INDEX(SUBSTRING_INDEX(departments, ',', 1 + (i % 10)), ',', -1),
                'level', 1 + (i % 5)
            )
        );
        SET i = i + 1;
    END WHILE;
END$$
DELIMITER ;

CALL generate_users();
DROP PROCEDURE generate_users;

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
