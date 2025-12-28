#!/bin/sh

# SQLite Database Initialization Script
DB_FILE="/data/dbview_dev.db"

# Remove existing database if present
rm -f "$DB_FILE"

echo "Creating SQLite database at $DB_FILE..."

# Create database and tables
sqlite3 "$DB_FILE" <<'EOF'
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    quantity INTEGER DEFAULT 0,
    category TEXT,
    is_available INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    status TEXT DEFAULT 'pending',
    total_amount REAL,
    shipping_address TEXT,
    notes TEXT,
    ordered_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Order items table
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
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
EOF

# Generate 10000 more users using a shell loop
echo "Generating 10000 additional users..."

# Use space-separated strings instead of bash arrays
FIRST_NAMES="James Mary John Patricia Robert Jennifer Michael Linda William Barbara David Elizabeth Richard Susan Joseph Jessica Thomas Sarah Charles Karen Christopher Nancy Daniel Lisa Matthew Betty Anthony Margaret Mark Sandra Donald Ashley Steven Kimberly Paul Emily Andrew Donna Joshua Michelle Kenneth Dorothy Kevin Carol Brian Amanda George Melissa Timothy Deborah"

LAST_NAMES="Smith Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez Hernandez Lopez Gonzalez Wilson Anderson Thomas Taylor Moore Jackson Martin Lee Perez Thompson White Harris Sanchez Clark Ramirez Lewis Robinson Walker Young Allen King Wright Scott Torres Nguyen Hill Flores Green Adams Nelson Baker Hall Rivera Campbell Mitchell Carter Roberts"

DEPARTMENTS="Engineering Sales Marketing Support HR Finance Operations Design Product QA"

ROLES="user user user user moderator admin"

# Helper function to get nth word from a string
get_word() {
    local string="$1"
    local index=$2
    echo "$string" | awk -v idx="$index" '{print $(idx + 1)}'
}

for i in $(seq 1 10000); do
    first_idx=$((i % 50))
    last_idx=$((i % 50))
    dept_idx=$((i % 10))
    role_idx=$((i % 6))

    first_name=$(get_word "$FIRST_NAMES" $first_idx)
    last_name=$(get_word "$LAST_NAMES" $last_idx)
    full_name="${first_name} ${last_name}"
    dept=$(get_word "$DEPARTMENTS" $dept_idx)
    role=$(get_word "$ROLES" $role_idx)
    level=$((1 + (i % 5)))
    is_active=1

    if [ $((i % 10)) -eq 0 ]; then
        is_active=0
    fi

    email="user${i}@example.com"
    metadata="{\"department\": \"${dept}\", \"level\": ${level}}"

    sqlite3 "$DB_FILE" "INSERT INTO users (email, name, role, is_active, metadata) VALUES ('${email}', '${full_name}', '${role}', ${is_active}, '${metadata}');"
done

# Insert sample products
sqlite3 "$DB_FILE" <<'EOF'
INSERT INTO products (sku, name, description, price, quantity, category) VALUES
('LAPTOP-001', 'Pro Laptop 15"', 'High-performance laptop for professionals', 1299.99, 50, 'Electronics'),
('MOUSE-001', 'Wireless Mouse', 'Ergonomic wireless mouse', 49.99, 200, 'Accessories'),
('KEYBOARD-001', 'Mechanical Keyboard', 'RGB mechanical keyboard', 129.99, 75, 'Accessories'),
('MONITOR-001', '27" 4K Monitor', 'Ultra HD monitor with HDR', 449.99, 30, 'Electronics'),
('HEADSET-001', 'Noise Cancelling Headset', 'Premium wireless headset', 199.99, 100, 'Audio');

-- Insert sample orders
INSERT INTO orders (user_id, status, total_amount, shipping_address, notes) VALUES
(1, 'completed', 1349.98, '{"street": "123 Main St", "city": "Seattle", "zip": "98101"}', NULL),
(2, 'pending', 179.98, '{"street": "456 Oak Ave", "city": "Portland", "zip": "97201"}', 'Gift wrap please'),
(1, 'shipped', 449.99, '{"street": "123 Main St", "city": "Seattle", "zip": "98101"}', NULL),
(3, 'completed', 49.99, '{"street": "789 Pine Rd", "city": "San Francisco", "zip": "94102"}', NULL);

-- Insert sample order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES
(1, 1, 1, 1299.99, 1299.99),
(1, 2, 1, 49.99, 49.99),
(2, 3, 1, 129.99, 129.99),
(2, 2, 1, 49.99, 49.99),
(3, 4, 1, 449.99, 449.99),
(4, 2, 1, 49.99, 49.99);
EOF

echo "SQLite database initialized successfully with 10020 users!"

# Set permissions
chmod 644 "$DB_FILE"
