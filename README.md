# dbview.app Monorepo

A modern multi-database viewer/editor for VS Code with shared React webview UI, reusable core logic, and a future Electron desktop shell.

**Supported Databases:**
- PostgreSQL
- MySQL
- SQL Server
- SQLite
- MongoDB

## Structure

```
apps/
  vscode-extension/   # VS Code extension backend + bundled webview assets
  desktop/            # Electron desktop app (Phase 8)
packages/
  ui/                 # React + Vite + Tailwind webview app
  core/               # Shared DB types and Postgres adapter stubs
docker/
  postgres/           # PostgreSQL init scripts & sample data
  mysql/              # MySQL init scripts & sample data
  mongodb/            # MongoDB init scripts & sample data
.vscode/launch.json   # Launch config to run the extension in VS Code
docker-compose.yml    # Docker Compose for test databases
package.json          # pnpm workspaces + top-level scripts
pnpm-workspace.yaml   # Workspace map
tsconfig.base.json    # Shared TS compiler options & path aliases
```

## Prerequisites

- **Node.js** v18 or higher
- **pnpm** v8 or higher (`npm install -g pnpm`)
- **VS Code** v1.84 or higher
- **Docker** (optional, for running test databases)

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Build the Project

```bash
pnpm run build:extension
```

This builds the UI bundle and compiles the extension TypeScript.

## Testing the VS Code Extension

### Option A: Using F5 (Recommended)

1. Open this project in VS Code
2. Press `F5` or go to **Run > Start Debugging**
3. Select **Run dbview Extension** from the dropdown (if prompted)
4. A new VS Code window (Extension Development Host) will open with the extension loaded

### Option B: Using Development Mode (Hot Reload)

Development mode runs three watchers in parallel for a faster feedback loop:

1. **First, build the project once:**
   ```bash
   pnpm run build:extension
   ```

2. **Start the dev watchers:**
   ```bash
   pnpm run dev:extension
   ```
   This starts:
   - `@dbview/core` - TypeScript watch mode
   - `@dbview/ui` - Vite dev server (hot reload for React)
   - `@dbview/vscode-extension` - TypeScript watch mode

3. **In VS Code, press `F5`** to launch the Extension Development Host

4. **When you make changes:**
   - **UI changes** (`packages/ui/`): Auto-rebuilds, reload webview with `Cmd+R`
   - **Extension changes** (`apps/vscode-extension/`): Auto-compiles, restart Extension Host with `Cmd+Shift+F5`
   - **Core changes** (`packages/core/`): Auto-compiles, may need to restart Extension Host

## Using the Extension

Once the Extension Development Host is running:

### 1. Configure a Database Connection

- Open Command Palette (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux)
- Run: `DBView: Configure Connection`
- Select your database type (PostgreSQL, MySQL, SQL Server, SQLite, or MongoDB)
- Enter your connection details:
  - Host (e.g., `localhost`)
  - Port (e.g., `5432` for PostgreSQL, `27017` for MongoDB)
  - Username
  - Password
  - Database name
  - For MongoDB: Auth Database (default: `admin`)
- Click **Test Connection** to verify
- Click **Save** to store the connection

### 2. Explore Your Database

- Click the **DB View** icon in the Activity Bar (left sidebar)
- Expand the connection to see:
  - Schemas (e.g., `public`)
  - Tables, Views, Functions, etc.
- Right-click on a table and select **Open Table** to view data

### 3. Run SQL Queries

- Open Command Palette (`Cmd+Shift+P`)
- Run: `DBView: Open SQL Runner`
- Write your SQL query and click **Run Query**

### 4. Manage Multiple Connections

- `DBView: Add Connection` - Add a new database connection
- `DBView: Switch Connection` - Switch between saved connections
- `DBView: Manage Connections` - View/edit/delete saved connections

## Configuration & Settings

### Autocomplete Performance Settings

DBView includes configurable limits to ensure fast autocomplete on large databases. If you have a database with hundreds or thousands of tables, you can adjust these settings in VS Code:

**Quick Access:**
1. Open Settings: `Ctrl+,` (or `Cmd+,` on macOS)
2. Search for: `dbview autocomplete`
3. Adjust the three available settings:
   - **Max Tables Per Schema** (default: 200)
   - **Max Total Tables** (default: 500)
   - **Max Tables With Metadata** (default: 100)

**📖 Full Documentation:** See [AUTOCOMPLETE_SETTINGS.md](./AUTOCOMPLETE_SETTINGS.md) for:
- Detailed setting explanations
- Recommended configurations by database size
- Performance impact analysis
- Troubleshooting guide
- How to access tables beyond limits

**Note:** All tables are always visible in the Schema Explorer sidebar, regardless of autocomplete limits.

## Building

- Build everything (core, UI bundle, extension, desktop stub):
  ```bash
  pnpm run build
  ```
- Build just the extension:
  ```bash
  pnpm run build:extension
  ```

## Docker: Running Test Databases

The project includes Docker Compose configuration with sample data for testing.

### Available Databases

| Database   | Port  | User    | Password   | Database    | Status           |
|------------|-------|---------|------------|-------------|------------------|
| PostgreSQL | 5432  | dbview  | dbview123  | dbview_dev  | Supported        |
| MySQL      | 3306  | dbview  | dbview123  | dbview_dev  | Future (Phase 7) |
| MongoDB    | 27017 | dbview  | dbview123  | dbview_dev  | Future (Phase 7) |

### Quick Start

```bash
# Start PostgreSQL (recommended for development)
docker compose up -d postgres

# Check if container is running
docker compose ps

# View logs
docker compose logs -f postgres
```

### Container Management

```bash
# Start all databases
docker compose up -d

# Start specific database
docker compose up -d postgres
docker compose up -d mysql
docker compose up -d mongodb

# Stop all databases (keeps data)
docker compose down

# Stop and remove all data (fresh start)
docker compose down -v

# Restart a specific service
docker compose restart postgres
```

### Database Initialization (Migrations)

The init scripts run **automatically on first container start**. They are mounted from:
- PostgreSQL: `docker/postgres/init.sql` → `/docker-entrypoint-initdb.d/init.sql`
- MySQL: `docker/mysql/init.sql` → `/docker-entrypoint-initdb.d/init.sql`
- MongoDB: `docker/mongodb/init.js` → `/docker-entrypoint-initdb.d/init.js`

```bash
# Re-run init.sql manually (without resetting)
docker compose exec -T postgres psql -U dbview -d dbview_dev < docker/postgres/init.sql

# Reset database completely (removes all data, re-runs init.sql)
docker compose down -v && docker compose up -d postgres
```

### Connect to Database Shell

```bash
# PostgreSQL - connect to psql
docker compose exec postgres psql -U dbview -d dbview_dev

# MySQL - connect to mysql
docker compose exec mysql mysql -u dbview -pdbview123 dbview_dev

# MongoDB - connect to mongosh
docker compose exec mongodb mongosh -u dbview -p dbview123 --authenticationDatabase admin dbview_dev
```

### Verify Tables & Data (PostgreSQL)

```bash
# List all tables in public schema
docker compose exec postgres psql -U dbview -d dbview_dev -c "\dt"

# List tables in all schemas
docker compose exec postgres psql -U dbview -d dbview_dev -c "\dt *.*"

# List all schemas
docker compose exec postgres psql -U dbview -d dbview_dev -c "\dn"

# Check sample data
docker compose exec postgres psql -U dbview -d dbview_dev -c "SELECT * FROM users;"

# Count rows in a table
docker compose exec postgres psql -U dbview -d dbview_dev -c "SELECT COUNT(*) FROM users;"

# View table structure
docker compose exec postgres psql -U dbview -d dbview_dev -c "\d users"
```

### Quick Connection Test

After starting PostgreSQL, connect with the extension using:
- **Host:** localhost
- **Port:** 5432
- **User:** dbview
- **Password:** dbview123
- **Database:** dbview_dev

### Sample Data Included

The databases are initialized with **comprehensive test data** across **6 schemas** and **30+ tables**:

#### Quick Stats
- **20+ users** with diverse roles (admin, moderator, user, guest)
- **20+ products** across multiple categories (Electronics, Office, Clothing)
- **10+ employees** across 7 departments (Engineering, Sales, Marketing, etc.)
- **6 orders** with order items and tracking
- **5 projects** with tasks and time entries
- **5 invoices** with payments and expenses
- **10+ analytics events** with page views
- **5 blog posts** with comments and media

#### Database Schema Overview

| Schema | Tables | Description | Key Features |
|--------|--------|-------------|--------------|
| **public** | 4 tables | Core app data | users (28 cols), orders, sessions |
| **inventory** | 5 tables | Product catalog | products (35 cols!), categories, warehouses, stock |
| **hr** | 6 tables | Human resources | employees (30 cols), departments, projects, tasks |
| **finance** | 5 tables | Financial data | customers, invoices, payments, expenses |
| **analytics** | 3 tables | Event tracking | events, page_views, user_metrics |
| **cms** | 5 tables | Content management | posts (27 cols), comments, media, pages |

#### PostgreSQL Features Included
✅ **All Data Types**: INTEGER, BIGINT, DECIMAL, REAL, VARCHAR, TEXT, BOOLEAN, DATE, TIME, TIMESTAMP, INTERVAL, JSON, JSONB, UUID, INET, BYTEA, Arrays
✅ **Advanced Features**: Generated columns, CHECK constraints, foreign keys, triggers, views, functions
✅ **Performance**: Indexes (including GIN for JSONB/arrays), analyzed tables
✅ **Sample Queries**: JOINs, aggregations, window functions, CTEs, recursive queries

📖 **For complete database documentation, see** [docker/README.md](./docker/README.md)

## Desktop App (Electron) - Phase 8

The desktop app is planned for Phase 8. Currently, a placeholder exists at `apps/desktop/`.

### Current Status

The desktop app is a **placeholder** that will eventually:
- Reuse `@dbview/ui` and `@dbview/core` packages
- Provide a standalone database client (no VS Code required)
- Support offline mode and local workspaces

### Building the Desktop Stub

```bash
# Build the desktop package
pnpm --filter @dbview/desktop run build
```

### Running in Development

```bash
# Run the Electron dev mode (placeholder)
pnpm --filter @dbview/desktop run dev
```

### Future Roadmap (Phase 8)

See [FEATURES.md](./FEATURES.md) for planned desktop features:
- Shared UI & core logic with VS Code extension
- Local workspace for saved connections, views, and filters
- Offline mode (useful for SQLite)
- Auto-updates and native installers (`.exe`, `.dmg`)

## Troubleshooting

### Extension not showing in Activity Bar
- Make sure you ran `pnpm run build:extension` before launching
- Check the **Output** panel in VS Code for errors (select "DBView" from dropdown)

### Connection errors
- Verify PostgreSQL is running and accessible
- Check if your firewall allows connections to the database port
- Ensure the database user has proper permissions

### Webview shows blank/error
- Rebuild the UI: `pnpm --filter @dbview/ui run build`
- Reload the Extension Development Host window

## Development Tips

- **View extension logs**: In the Extension Development Host, go to **Help > Toggle Developer Tools** and check the Console tab
- **Reload extension**: Press `Cmd+R` (Mac) or `Ctrl+R` (Windows/Linux) in the Extension Development Host
- **Debug breakpoints**: Set breakpoints in the extension TypeScript files; they work in the debug session

## Next Steps

See [FEATURES.md](./FEATURES.md) for the complete feature roadmap including:
- Data editing (inline edit, insert, delete)
- Advanced filtering and pagination
- ER diagrams
- Multi-database support (MySQL, SQLite, MongoDB)
- Desktop app via Electron
