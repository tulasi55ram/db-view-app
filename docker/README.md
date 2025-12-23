# Docker Database Setup

This directory contains Docker configurations for multiple database systems used for development and testing of the DBView extension.

## 📦 What's Included

The comprehensive database setup includes:

### **6 Schemas**
- `public` - Core application data (users, orders, sessions)
- `inventory` - Product catalog and stock management
- `analytics` - Event tracking and metrics
- `hr` - Human resources and project management
- `finance` - Invoicing, payments, and expenses
- `cms` - Content management (posts, comments, media)

### **30+ Tables** with diverse column types
- Users (28 columns including UUID, JSONB, arrays, INET)
- Products (35 columns with full e-commerce fields)
- Employees, Departments, Projects, Tasks
- Orders, Invoices, Payments, Expenses
- Blog Posts, Comments, Media, Pages
- Analytics events and metrics
- And many more...

### **PostgreSQL Data Types Covered**
✅ **Numeric**: INTEGER, BIGINT, SMALLINT, SERIAL, BIGSERIAL, DECIMAL, NUMERIC, REAL
✅ **Text**: VARCHAR, TEXT, CHAR
✅ **Date/Time**: DATE, TIME, TIMESTAMP, TIMESTAMPTZ, INTERVAL
✅ **Boolean**: BOOLEAN
✅ **JSON**: JSON, JSONB
✅ **Arrays**: TEXT[], INTEGER[]
✅ **UUID**: UUID with uuid-ossp extension
✅ **Network**: INET (IP addresses)
✅ **Binary**: BYTEA
✅ **Generated**: Computed columns (GENERATED ALWAYS AS)
✅ **Constraints**: PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, DEFAULT, NOT NULL

### **Sample Data**
- **1020+ users** in PostgreSQL (20 named + 1000 generated)
- **1020+ users** in MySQL (20 named + 1000 generated via stored procedure)
- **1020+ users** in SQL Server (20 named + 1000 generated via T-SQL loop)
- **1020+ users** in SQLite (20 named + 1000 generated via shell script)
- **20 products** across multiple categories (PostgreSQL only)
- **10 employees** across 7 departments (PostgreSQL only)
- **5 projects** with tasks and time entries (PostgreSQL only)
- **6 orders** with order items
- **5 invoices** with payments (PostgreSQL only)
- **10 analytics events** (PostgreSQL only)
- **5 blog posts** with comments (PostgreSQL only)
- And much more...

### **Views**
- `public.user_order_summary` - User order statistics
- `inventory.product_summary` - Product overview with categories
- `hr.employee_summary` - Employee details with departments
- `finance.invoice_summary` - Invoice payment status

### **Functions**
- `public.get_user_orders()` - Get orders for a user
- `inventory.get_low_stock_products()` - Find products below reorder level
- `hr.get_employee_projects()` - Get projects for an employee

### **Triggers**
- Auto-update `updated_at` timestamps
- Maintain data integrity

### **Indexes**
- Performance-optimized indexes on frequently queried columns
- GIN indexes for JSONB and array columns
- Full-text search support with pg_trgm

## 🚀 Quick Start

### Start Databases
```bash
# Start only PostgreSQL
docker-compose up -d postgres

# Start PostgreSQL, MySQL, and SQL Server
docker-compose up -d postgres mysql sqlserver

# Start all databases (PostgreSQL, MySQL, SQL Server, SQLite, MongoDB)
docker-compose up -d
```

### Connect to Databases
```bash
# PostgreSQL using psql
psql -h localhost -U dbview -d dbview_dev
# Password: dbview123

# MySQL using mysql client
docker exec -it dbview-mysql mysql -u dbview -pdbview123 dbview_dev

# SQL Server using sqlcmd
docker exec -it dbview-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "DbView123!" -d dbview_dev

# SQLite using sqlite3
sqlite3 ./docker/sqlite/dbview.db

# MongoDB using mongosh
docker exec -it dbview-mongodb mongosh -u dbview -p dbview123 --authenticationDatabase admin dbview

# Or use the DBView VS Code extension!
```

### Connection Details

#### PostgreSQL (Ready to use)
- **Host**: localhost
- **Port**: 5432
- **Database**: dbview_dev
- **Username**: dbview
- **Password**: dbview123

#### MySQL (Phase 7 - Ready)
- **Host**: localhost
- **Port**: 3306
- **Database**: dbview_dev
- **Username**: dbview
- **Password**: dbview123
- **Root Password**: root123
- **Features**: 1020+ users, products, orders tables

#### SQL Server (Phase 7 - Ready)
- **Host**: localhost
- **Port**: 1433
- **Database**: dbview_dev
- **Username**: sa
- **Password**: DbView123!
- **Features**: 1020+ users, products, orders tables, T-SQL support

#### SQLite (Phase 7 - Ready)
- **Database File**: ./docker/sqlite/dbview.db
- **Features**: 1020+ users, products, orders tables, file-based access
- **Note**: No username/password required

#### MongoDB (Phase 7 - Ready)
- **Host**: localhost
- **Port**: 27017
- **Database**: dbview (or admin for authentication)
- **Username**: dbview
- **Password**: dbview123
- **Auth Database**: admin
- **Features**: Users, products, orders collections, views, nested documents, arrays

## 📊 Database Schema Overview

### Public Schema
```
users (28 columns)
├── Basic info: id, uuid, email, username, first_name, last_name
├── Auth: password_hash, role, status, is_active, is_verified
├── Profile: age, bio, phone_number, website_url
├── Financial: salary, bonus_percentage
├── JSON: metadata, preferences
├── Arrays: tags
├── Network: ip_address
├── Timestamps: created_at, updated_at, deleted_at, last_login_at
└── Foreign keys → orders, sessions

orders (17 columns)
├── Basic: id, order_number, status, payment_method
├── Amounts: total_amount, discount_amount, tax_amount, shipping_cost
├── Addresses: shipping_address (JSONB), billing_address (JSONB)
├── Tracking: tracking_number, estimated_delivery
└── Timestamps: ordered_at, delivered_at, cancelled_at

order_items (10 columns)
└── Links orders to products with pricing details

sessions (10 columns)
└── User session tracking with device info
```

### Inventory Schema
```
categories (10 columns)
├── Hierarchical structure with parent_id
└── Self-referencing for category trees

products (35 columns!)
├── Identifiers: id, uuid, sku, barcode, slug
├── Descriptions: name, description, short_description
├── Pricing: price, cost, compare_at_price, discount_percentage
├── Stock: quantity, reserved_quantity, reorder_level
├── Physical: weight, dimensions (JSONB), volume, color, size
├── Media: images (JSONB array)
├── Metadata: tags (TEXT[]), attributes (JSONB), rating
└── Flags: is_available, is_featured, is_new, is_bestseller

warehouses (9 columns)
└── Physical locations with capacity tracking

stock_movements (10 columns)
└── Inventory transaction log
```

### HR Schema
```
departments (14 columns)
├── Hierarchical with parent_department_id
└── Budget and headcount tracking

employees (30 columns)
├── Personal: first_name, last_name, email, phone, date_of_birth
├── Employment: job_title, employment_type, employment_status
├── Compensation: salary, hourly_rate, commission_rate
├── Benefits: benefits (JSONB), emergency_contact (JSONB)
├── Time off: vacation_days_total, vacation_days_used, sick_days_used
└── Reviews: performance_rating, last_review_date, next_review_date

projects (19 columns)
├── Planning: budget, estimated_hours, start_date, end_date
├── Tracking: actual_cost, actual_hours, progress_percentage
└── Status: status, priority, tags

tasks (14 columns)
├── Assignment: assigned_to, created_by
├── Planning: estimated_hours, due_date
├── Dependencies: dependencies (INTEGER[])
└── Attachments: attachments (JSONB)

time_entries (11 columns)
└── Time tracking with break duration (INTERVAL)
```

### Finance Schema
```
customers (19 columns)
├── Business: company_name, tax_id, customer_type
├── Credit: credit_limit, payment_terms
├── Metrics: total_purchases, total_outstanding
└── Addresses: billing_address (JSONB), shipping_address (JSONB)

invoices (22 columns)
├── Amounts: subtotal, tax_amount, discount_amount, total_amount
├── Payment: amount_paid, amount_due, paid_date
├── Recurring: is_recurring, recurring_frequency, next_invoice_date
└── Status: status (draft, sent, partial, paid, overdue)

invoice_items (8 columns)
payments (13 columns)
expenses (18 columns)
```

### Analytics Schema
```
events (19 columns)
├── Tracking: event_type, event_name, properties (JSONB)
├── Session: user_id, session_id, device_type, browser, os
├── Location: country, city, latitude, longitude
└── Network: ip_address (INET), user_agent

page_views (10 columns)
user_metrics (13 columns)
└── Lifetime value, engagement score, churn risk
```

### CMS Schema
```
posts (27 columns)
├── Content: title, slug, excerpt, content, featured_image
├── SEO: seo_title, seo_description, seo_keywords (TEXT[])
├── Visibility: status, visibility, password_hash
├── Engagement: view_count, like_count, comment_count
└── Media: images (JSONB array)

comments (13 columns)
├── Threaded with parent_comment_id
└── Moderation: status (pending, approved, spam)

media (20 columns)
├── File info: filename, file_path, file_url, mime_type, file_size
├── Dimensions: width, height, duration (for videos)
└── Organization: folder, tags (TEXT[]), metadata (JSONB)

pages (12 columns)
settings (8 columns - key-value store)
```

## 🧪 Testing the Extension Features

This database is designed to thoroughly test all DBView extension features:

### Phase 1 - MVP Features
- ✅ Browse all schemas (6 schemas available)
- ✅ View tables with many columns (users: 28, products: 35, employees: 30)
- ✅ Test SQL runner with complex queries
- ✅ View query results with diverse data types

### Phase 2 - Data Editing (Current)
- ✅ **Inline editing** - Edit cells with all data types
- ✅ **Type-based editors**:
  - Boolean → Test with `users.is_active`, `products.is_featured`
  - JSON → Test with `users.metadata`, `products.attributes`
  - Date → Test with `employees.hire_date`, `orders.estimated_delivery`
  - Timestamp → Test with `users.created_at`, `orders.ordered_at`
  - Numeric → Test with `products.price`, `employees.salary`
  - Arrays → Test with `users.tags`, `products.tags`
  - Text → Test with `users.bio`, `posts.content`
- ✅ **Insert rows** - Try inserting into any table
- ✅ **Delete rows** - Test single and multi-row deletion
- ✅ **Column visibility** - Hide/show columns with many options

### Phase 3 - Advanced Features (Next)
- 🔄 **Filtering** - Tables with lots of data to filter
- 🔄 **Pagination** - Large tables (products, events, page_views)
- 🔄 **Advanced search** - Rich text content to search

### Phase 5 - Export/Import
- 🔄 **Export** - Large datasets ready for CSV/JSON export
- 🔄 **Import** - Tables ready to accept bulk imports

## 🔍 Interesting Queries to Try

### Complex Joins
```sql
-- Get user order history with product details
SELECT
    u.username,
    u.email,
    o.order_number,
    o.status,
    oi.product_name,
    oi.quantity,
    oi.unit_price
FROM public.users u
JOIN public.orders o ON u.id = o.user_id
JOIN public.order_items oi ON o.id = oi.order_id
ORDER BY o.ordered_at DESC;
```

### JSON Queries
```sql
-- Find users by metadata
SELECT username, email, metadata
FROM public.users
WHERE metadata->>'department' = 'Engineering';

-- Find products by dimensions
SELECT name, price, dimensions
FROM inventory.products
WHERE (dimensions->>'width')::numeric > 40;
```

### Array Queries
```sql
-- Find users with specific tags
SELECT username, email, tags
FROM public.users
WHERE 'engineering' = ANY(tags);

-- Find products with multiple tags
SELECT name, tags
FROM inventory.products
WHERE tags && ARRAY['laptop', 'gaming'];
```

### Aggregations
```sql
-- Department salary analysis
SELECT
    d.name as department,
    COUNT(e.id) as employee_count,
    AVG(e.salary) as avg_salary,
    MIN(e.salary) as min_salary,
    MAX(e.salary) as max_salary
FROM hr.departments d
LEFT JOIN hr.employees e ON d.id = e.department_id
GROUP BY d.name
ORDER BY avg_salary DESC;
```

### Window Functions
```sql
-- Rank employees by salary within each department
SELECT
    employee_number,
    first_name || ' ' || last_name as full_name,
    d.name as department,
    salary,
    RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) as salary_rank
FROM hr.employees e
JOIN hr.departments d ON e.department_id = d.id
ORDER BY d.name, salary_rank;
```

### CTEs and Recursive Queries
```sql
-- Get category hierarchy
WITH RECURSIVE category_tree AS (
    SELECT id, name, parent_id, 0 as level
    FROM inventory.categories
    WHERE parent_id IS NULL
    UNION ALL
    SELECT c.id, c.name, c.parent_id, ct.level + 1
    FROM inventory.categories c
    JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT
    REPEAT('  ', level) || name as category_hierarchy,
    level
FROM category_tree
ORDER BY level, name;
```

## 🛠️ Management Commands

### Restart Databases
```bash
docker-compose restart postgres
```

### Stop All Databases
```bash
docker-compose down
```

### Stop and Remove All Data
```bash
docker-compose down -v
```

### View Logs
```bash
# PostgreSQL logs
docker-compose logs -f postgres

# All databases
docker-compose logs -f
```

### Recreate Database from Scratch
```bash
# Stop and remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d postgres
```

## 📝 Notes

- The init.sql file is only executed when the database is created for the first time
- To reload the schema, you must remove the Docker volume: `docker-compose down -v`
- All sample data uses realistic values for better testing
- Foreign key relationships are properly set up for referential integrity
- Indexes are created for commonly queried columns
- The database includes CHECK constraints for data validation

## 🎯 Testing Checklist

Use this database to test:

- [x] Viewing tables with 25+ columns
- [x] Editing cells with all PostgreSQL data types
- [x] Inserting rows with required fields
- [x] Deleting single and multiple rows
- [x] Hiding/showing columns (many columns available)
- [x] Sorting by different column types
- [x] JSON field editing and validation
- [x] Boolean toggle switches
- [x] Date/time pickers
- [x] Array field editing
- [x] NULL value handling
- [x] Foreign key relationships
- [x] Tables without primary keys (some views)
- [x] Read-only views
- [x] Multiple schemas
- [x] Complex queries with JOINs
- [x] Aggregate functions
- [x] Window functions
- [x] Functions and stored procedures

## 🐛 Troubleshooting

### Can't connect to database
```bash
# Check if container is running
docker ps | grep postgres

# Check container logs
docker-compose logs postgres

# Restart the container
docker-compose restart postgres
```

### Port 5432 already in use
```bash
# Stop local PostgreSQL
sudo service postgresql stop

# Or change the port in docker-compose.yml
# Change "5432:5432" to "5433:5432"
```

### Database not initialized
```bash
# Remove volumes and recreate
docker-compose down -v
docker-compose up -d postgres
```

## 🔗 Connection Strings

### PostgreSQL
```
postgresql://dbview:dbview123@localhost:5432/dbview_dev
```

### MySQL
```
mysql://dbview:dbview123@localhost:3306/dbview_dev
```

### SQL Server
```
Server=localhost,1433;Database=dbview_dev;User Id=sa;Password=DbView123!;TrustServerCertificate=True
```

### SQLite
```
./docker/sqlite/dbview.db
```

### MongoDB
```
mongodb://dbview:dbview123@localhost:27017/dbview?authSource=admin
```

## 📝 Quick Verification

After starting the databases, verify they have 1020+ users:

```bash
# PostgreSQL
docker exec -it dbview-postgres psql -U dbview -d dbview_dev -c "SELECT COUNT(*) FROM public.users;"

# MySQL
docker exec -it dbview-mysql mysql -u dbview -pdbview123 dbview_dev -e "SELECT COUNT(*) FROM users;"

# SQL Server (after initialization completes, ~60 seconds)
docker exec -it dbview-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "DbView123!" -d dbview_dev -Q "SELECT COUNT(*) FROM users;"

# SQLite
sqlite3 ./docker/sqlite/dbview.db "SELECT COUNT(*) FROM users;"

# MongoDB
docker exec -it dbview-mongodb mongosh -u dbview -p dbview123 --authenticationDatabase admin dbview --eval "db.users.countDocuments()" --quiet
```

PostgreSQL, MySQL, SQL Server, and SQLite should return **1020** users!
MongoDB should return **5** users with sample data (products: 5, orders: 4).

## 📚 Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [SQL Server Documentation](https://learn.microsoft.com/en-us/sql/sql-server/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [MongoDB Documentation](https://www.mongodb.com/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [DBView Extension Repository](https://github.com/yourusername/db-view-app)
