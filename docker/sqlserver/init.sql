-- SQL Server Database Initialization Script
-- Wait for SQL Server to be ready
-- This script will be executed manually after container starts

USE master;
GO

-- Create database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'dbview_dev')
BEGIN
    CREATE DATABASE dbview_dev;
END
GO

USE dbview_dev;
GO

-- Users table
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    email NVARCHAR(255) UNIQUE NOT NULL,
    name NVARCHAR(100) NOT NULL,
    role NVARCHAR(50) DEFAULT 'user',
    is_active BIT DEFAULT 1,
    metadata NVARCHAR(MAX), -- JSON stored as string
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Products table
CREATE TABLE products (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sku NVARCHAR(50) UNIQUE NOT NULL,
    name NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX),
    price DECIMAL(10, 2) NOT NULL,
    quantity INT DEFAULT 0,
    category NVARCHAR(100),
    is_available BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Orders table
CREATE TABLE orders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    status NVARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(12, 2),
    shipping_address NVARCHAR(MAX), -- JSON stored as string
    notes NVARCHAR(MAX),
    ordered_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
GO

-- Order items table
CREATE TABLE order_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
GO

-- Create a view
CREATE VIEW user_order_summary AS
SELECT
    u.id,
    u.name,
    u.email,
    COUNT(o.id) as total_orders,
    ISNULL(SUM(o.total_amount), 0) as lifetime_value
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name, u.email;
GO

-- Insert initial sample users
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
GO

-- Generate 1000 more users using a loop
DECLARE @i INT = 1;
DECLARE @first_names TABLE (idx INT, name NVARCHAR(50));
DECLARE @last_names TABLE (idx INT, name NVARCHAR(50));
DECLARE @departments TABLE (idx INT, name NVARCHAR(50));
DECLARE @roles TABLE (idx INT, name NVARCHAR(50));

INSERT INTO @first_names VALUES
(0, 'James'), (1, 'Mary'), (2, 'John'), (3, 'Patricia'), (4, 'Robert'),
(5, 'Jennifer'), (6, 'Michael'), (7, 'Linda'), (8, 'William'), (9, 'Barbara'),
(10, 'David'), (11, 'Elizabeth'), (12, 'Richard'), (13, 'Susan'), (14, 'Joseph'),
(15, 'Jessica'), (16, 'Thomas'), (17, 'Sarah'), (18, 'Charles'), (19, 'Karen'),
(20, 'Christopher'), (21, 'Nancy'), (22, 'Daniel'), (23, 'Lisa'), (24, 'Matthew'),
(25, 'Betty'), (26, 'Anthony'), (27, 'Margaret'), (28, 'Mark'), (29, 'Sandra'),
(30, 'Donald'), (31, 'Ashley'), (32, 'Steven'), (33, 'Kimberly'), (34, 'Paul'),
(35, 'Emily'), (36, 'Andrew'), (37, 'Donna'), (38, 'Joshua'), (39, 'Michelle'),
(40, 'Kenneth'), (41, 'Dorothy'), (42, 'Kevin'), (43, 'Carol'), (44, 'Brian'),
(45, 'Amanda'), (46, 'George'), (47, 'Melissa'), (48, 'Timothy'), (49, 'Deborah');

INSERT INTO @last_names VALUES
(0, 'Smith'), (1, 'Johnson'), (2, 'Williams'), (3, 'Brown'), (4, 'Jones'),
(5, 'Garcia'), (6, 'Miller'), (7, 'Davis'), (8, 'Rodriguez'), (9, 'Martinez'),
(10, 'Hernandez'), (11, 'Lopez'), (12, 'Gonzalez'), (13, 'Wilson'), (14, 'Anderson'),
(15, 'Thomas'), (16, 'Taylor'), (17, 'Moore'), (18, 'Jackson'), (19, 'Martin'),
(20, 'Lee'), (21, 'Perez'), (22, 'Thompson'), (23, 'White'), (24, 'Harris'),
(25, 'Sanchez'), (26, 'Clark'), (27, 'Ramirez'), (28, 'Lewis'), (29, 'Robinson'),
(30, 'Walker'), (31, 'Young'), (32, 'Allen'), (33, 'King'), (34, 'Wright'),
(35, 'Scott'), (36, 'Torres'), (37, 'Nguyen'), (38, 'Hill'), (39, 'Flores'),
(40, 'Green'), (41, 'Adams'), (42, 'Nelson'), (43, 'Baker'), (44, 'Hall'),
(45, 'Rivera'), (46, 'Campbell'), (47, 'Mitchell'), (48, 'Carter'), (49, 'Roberts');

INSERT INTO @departments VALUES
(0, 'Engineering'), (1, 'Sales'), (2, 'Marketing'), (3, 'Support'),
(4, 'HR'), (5, 'Finance'), (6, 'Operations'), (7, 'Design'),
(8, 'Product'), (9, 'QA');

INSERT INTO @roles VALUES
(0, 'user'), (1, 'user'), (2, 'user'), (3, 'user'),
(4, 'moderator'), (5, 'admin');

WHILE @i <= 10000
BEGIN
    DECLARE @email NVARCHAR(255) = 'user' + CAST(@i AS NVARCHAR) + '@example.com';
    DECLARE @first_name NVARCHAR(50);
    DECLARE @last_name NVARCHAR(50);
    DECLARE @full_name NVARCHAR(100);
    DECLARE @role NVARCHAR(50);
    DECLARE @is_active BIT;
    DECLARE @dept NVARCHAR(50);
    DECLARE @level INT;
    DECLARE @metadata NVARCHAR(MAX);

    SELECT @first_name = name FROM @first_names WHERE idx = @i % 50;
    SELECT @last_name = name FROM @last_names WHERE idx = @i % 50;
    SELECT @role = name FROM @roles WHERE idx = @i % 6;
    SELECT @dept = name FROM @departments WHERE idx = @i % 10;

    SET @full_name = @first_name + ' ' + @last_name;
    SET @is_active = CASE WHEN @i % 10 = 0 THEN 0 ELSE 1 END;
    SET @level = 1 + (@i % 5);
    SET @metadata = '{"department": "' + @dept + '", "level": ' + CAST(@level AS NVARCHAR) + '}';

    INSERT INTO users (email, name, role, is_active, metadata)
    VALUES (@email, @full_name, @role, @is_active, @metadata);

    SET @i = @i + 1;
END;
GO

-- Insert sample products
INSERT INTO products (sku, name, description, price, quantity, category) VALUES
('LAPTOP-001', 'Pro Laptop 15"', 'High-performance laptop for professionals', 1299.99, 50, 'Electronics'),
('MOUSE-001', 'Wireless Mouse', 'Ergonomic wireless mouse', 49.99, 200, 'Accessories'),
('KEYBOARD-001', 'Mechanical Keyboard', 'RGB mechanical keyboard', 129.99, 75, 'Accessories'),
('MONITOR-001', '27" 4K Monitor', 'Ultra HD monitor with HDR', 449.99, 30, 'Electronics'),
('HEADSET-001', 'Noise Cancelling Headset', 'Premium wireless headset', 199.99, 100, 'Audio');
GO

-- Insert sample orders
INSERT INTO orders (user_id, status, total_amount, shipping_address, notes) VALUES
(1, 'completed', 1349.98, '{"street": "123 Main St", "city": "Seattle", "zip": "98101"}', NULL),
(2, 'pending', 179.98, '{"street": "456 Oak Ave", "city": "Portland", "zip": "97201"}', 'Gift wrap please'),
(1, 'shipped', 449.99, '{"street": "123 Main St", "city": "Seattle", "zip": "98101"}', NULL),
(3, 'completed', 49.99, '{"street": "789 Pine Rd", "city": "San Francisco", "zip": "94102"}', NULL);
GO

-- Insert sample order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES
(1, 1, 1, 1299.99, 1299.99),
(1, 2, 1, 49.99, 49.99),
(2, 3, 1, 129.99, 129.99),
(2, 2, 1, 49.99, 49.99),
(3, 4, 1, 449.99, 449.99),
(4, 2, 1, 49.99, 49.99);
GO

PRINT 'Database initialization completed successfully!';
GO
