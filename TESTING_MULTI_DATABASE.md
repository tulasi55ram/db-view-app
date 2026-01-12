# Testing the Multi-Database Feature

This guide explains how to test the new "Show All Databases" feature using the updated Docker setup.

## Overview

The "Show All Databases" feature allows you to browse multiple databases on a single SQL server without creating separate connections for each database. This is perfect for:
- Development environments with multiple databases
- Browsing production servers with many application databases
- Quickly switching between databases without reconnecting

## Updated Docker Setup

The Docker containers have been updated to create multiple databases with sample data for testing:

### PostgreSQL (Port 5432)
Creates **6 databases**:
1. **dbview_dev** (default) - Full demo schema with multiple schemas (public, inventory, hr, finance, analytics, cms)
2. **ecommerce_prod** - Simple ecommerce database (users, products, orders)
3. **analytics_staging** - Analytics data (page_views, events, metrics)
4. **hr_system** - HR management (departments, employees, time_off_requests)
5. **finance_app** - Financial data (accounts, transactions, invoices)
6. **test_playground** - Test/experimental data

### MySQL (Port 3306)
Creates **6 databases**:
1. **dbview_dev** (default) - Full demo schema with sample data
2. **ecommerce_prod** - E-commerce database
3. **analytics_staging** - Analytics and metrics
4. **inventory_system** - Warehouse and inventory management
5. **customer_portal** - Customer support system
6. **test_environment** - Test data and feature flags

### MariaDB (Port 3307)
Creates **5 databases**:
1. **dbview_dev** (default) - Full demo schema
2. **production_app** - Production application database
3. **staging_env** - Staging environment database
4. **development_db** - Development projects database
5. **reporting_system** - Reporting and dashboards

## Starting the Docker Containers

### Fresh Start (Recommended for Testing)

```bash
# Stop and remove existing containers
docker-compose down -v

# Start all containers (this will create the multiple databases)
docker-compose up -d

# Wait for all databases to initialize (30-60 seconds)
docker-compose logs -f postgres mysql mariadb
```

Wait until you see messages indicating the databases are ready to accept connections.

### Quick Restart (If Containers Already Exist)

```bash
# Restart containers
docker-compose restart postgres mysql mariadb
```

## Testing Steps

### 1. Launch the Application

```bash
# Install dependencies (if not done already)
pnpm install

# Start the desktop application
pnpm --filter @dbview/desktop dev
```

### 2. Test PostgreSQL Multi-Database

#### Create Connection:
1. Click **"Add Connection"** or **"New Connection"**
2. Select **PostgreSQL**
3. Fill in connection details:
   - **Connection Name**: `PostgreSQL - All Databases`
   - **Host**: `localhost`
   - **Port**: `5432`
   - **Username**: `dbview`
   - **Password**: `dbview123`
   - **Database**: `dbview_dev` (can be any database, or leave blank)
   - **✓ Check: "Show all databases"** ← This is the new feature!
4. Click **Test Connection** to verify
5. Click **Save**

#### Browse Databases:
1. In the left sidebar, click to expand the PostgreSQL connection
2. You should see **6 database nodes**:
   - 💾 dbview_dev
   - 💾 ecommerce_prod
   - 💾 analytics_staging
   - 💾 hr_system
   - 💾 finance_app
   - 💾 test_playground
3. Click on **ecommerce_prod** to expand it
4. You'll see the schemas (likely just "public")
5. Expand "public" to see:
   - 📄 Tables (3)
   - 👁 Views (if any)
6. Click on the **users** table to view its data
7. Try expanding other databases to explore their schemas and tables

### 3. Test MySQL Multi-Database

#### Create Connection:
1. Click **"Add Connection"**
2. Select **MySQL**
3. Fill in connection details:
   - **Connection Name**: `MySQL - All Databases`
   - **Host**: `localhost`
   - **Port**: `3306`
   - **Username**: `dbview`
   - **Password**: `dbview123`
   - **Database**: `dbview_dev`
   - **✓ Check: "Show all databases"**
4. Test and Save

#### Browse Databases:
1. Expand the MySQL connection in the sidebar
2. See **6 database nodes** appear
3. Expand **inventory_system**
4. Explore warehouses, inventory_items, and stock_movements tables
5. Try the **customer_portal** database to see support tickets

### 4. Test MariaDB Multi-Database

#### Create Connection:
1. Click **"Add Connection"**
2. Select **MariaDB**
3. Fill in connection details:
   - **Connection Name**: `MariaDB - All Databases`
   - **Host**: `localhost`
   - **Port**: `3307` (Note: different port!)
   - **Username**: `dbview`
   - **Password**: `dbview123`
   - **Database**: `dbview_dev`
   - **✓ Check: "Show all databases"**
4. Test and Save

#### Browse Databases:
1. Expand the MariaDB connection
2. See **5 database nodes**
3. Explore **development_db** with projects and developers
4. Check out **reporting_system** with dashboards and reports

### 5. Compare with Single-Database Mode

To see the difference, create another PostgreSQL connection **WITHOUT** checking "Show all databases":

1. Add new connection: `PostgreSQL - Single DB`
2. Same credentials, but **uncheck** "Show all databases"
3. Save and expand
4. Notice it directly shows schemas instead of databases
5. You can only access the specified database (dbview_dev)

## Expected Behavior

### ✅ What You Should See

1. **Loading States**:
   - Spinning icon when clicking to expand connection
   - Smooth transition to database list

2. **Database Icons**:
   - 💾 Cyan-colored database icons
   - Clear visual hierarchy: Connection → Databases → Schemas → Tables

3. **Lazy Loading**:
   - Databases load only when connection is expanded
   - Schemas load only when specific database is expanded
   - Tables load only when schema is expanded

4. **Animations**:
   - Smooth chevron animations (right arrow → down arrow)
   - Fade transitions when loading

5. **System Databases Filtered**:
   - Should NOT see: postgres, mysql, information_schema, performance_schema
   - Only user-created databases appear

### ❌ What You Should NOT See

1. Loading icons that don't disappear
2. Chevrons stuck in loading state
3. System databases in the list
4. Error messages when expanding databases
5. Duplicate database entries

## Troubleshooting

### Databases Not Showing Up

```bash
# Check if init scripts ran
docker-compose logs postgres | grep "database system is ready"
docker-compose logs mysql | grep "ready for connections"

# Connect directly to verify databases exist
docker exec -it dbview-postgres psql -U dbview -l
docker exec -it dbview-mysql mysql -udbview -pdbview123 -e "SHOW DATABASES;"
docker exec -it dbview-mariadb mysql -udbview -pdbview123 -e "SHOW DATABASES;"
```

### Connection Fails

```bash
# Verify containers are running
docker-compose ps

# Check container health
docker-compose ps postgres mysql mariadb

# Restart specific database
docker-compose restart postgres
```

### Need to Reset Everything

```bash
# Complete reset (WARNING: Deletes all data)
docker-compose down -v
docker volume prune -f
docker-compose up -d
```

## Feature Verification Checklist

- [ ] PostgreSQL connection with "Show all databases" shows 6 databases
- [ ] MySQL connection with "Show all databases" shows 6 databases
- [ ] MariaDB connection with "Show all databases" shows 5 databases
- [ ] Can expand each database to see its schemas
- [ ] Can expand schemas to see tables
- [ ] Can click tables to view data
- [ ] Chevron icons animate correctly (→ spinner → ↓)
- [ ] System databases are filtered out
- [ ] Loading states work properly
- [ ] No errors in console
- [ ] Single-database mode still works (without checkbox)
- [ ] Can switch between databases without reconnecting
- [ ] Edit connection preserves "Show all databases" setting

## Sample Data Overview

Each database contains realistic sample data:

- **Users**: 20-10,000 users with various roles
- **Products**: 20-50 products with SKUs, prices, inventory
- **Orders**: Sample orders with line items
- **Analytics**: Page views, events, metrics
- **HR**: Employees, departments, projects, time tracking
- **Finance**: Invoices, payments, accounts, transactions

Perfect for testing queries, filtering, sorting, and all database operations!

## Next Steps

1. Try querying across multiple databases
2. Test filtering and sorting on different database tables
3. Create saved queries for frequently accessed databases
4. Test with your own local database servers
5. Try the feature with real production databases (carefully!)

## Feedback

If you encounter any issues or have suggestions:
1. Check the browser/Electron console for errors
2. Look at Docker logs for database errors
3. File an issue on GitHub with details

Happy testing! 🎉
