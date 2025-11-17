# dbview Monorepo – Project Overview

This document introduces the structure, runtime flow, and UI layers of the dbview workspace so a new contributor can become productive quickly. The explanations assume no prior experience with VS Code extensions or Electron.

---

## 0. Concepts & Prerequisites

- **VS Code extension** – A Node.js process that runs inside VS Code and can register commands, contribute tree views, and spawn webviews.
- **TreeDataProvider** – API that lets you create a sidebar tree. You return nodes (`TreeItem`s), VS Code renders them, and you can attach commands/context menus.
- **Webview** – An isolated browser window inside VS Code that can load any HTML/JS bundle. Communication happens via `window.postMessage` and `webview.postMessage`.
- **pnpm workspace** – A single `pnpm install` installs dependencies for every package; `pnpm --filter` runs scripts inside a specific package.
- **Electron shell** – Desktop app hosting Chromium + Node. Included here for future reuse of the React UI outside VS Code.

If you can run Node.js ≥18 and have PostgreSQL credentials to test against, you’re good to go.

---

## 1. Repository Layout

```
apps/
  vscode-extension/     VS Code extension entry point (commands, tree view, webviews)
  desktop/              Electron shell that hosts the UI bundle for future desktop builds
packages/
  ui/                   Shared React + Vite webview application (Table view, SQL runner)
  core/                 Database types and Postgres adapter helpers shared across targets
```

| Path | Purpose |
| --- | --- |
| `apps/vscode-extension/src` | Extension commands, tree provider, Postgres client, VS Code APIs |
| `packages/ui/src` | React app rendered inside VS Code webviews (table grid, SQL runner) |
| `packages/core` | `ConnectionConfig` types and placeholder adapters for reuse |
| `apps/desktop` | Electron boilerplate that loads the compiled UI bundle |

Monorepo tooling is pnpm workspaces; root scripts fan out with `pnpm --filter`.

---

## 2. High-Level Architecture

```
VS Code Commands  <--->  Schema Explorer Tree (TreeDataProvider)
     |                             |
     v                             v
PostgresClient <----> Connection settings (globalState + secrets)
     |
     v
React Webview (packages/ui) <----> Webview messaging bridge
```

1. **Activation** – `apps/vscode-extension/src/extension.ts` registers commands (`dbview.configureConnection`, `dbview.openTable`, etc.) and the `SchemaExplorerProvider`. This is analogous to `main()` for the extension.
2. **Tree Rendering** – `SchemaExplorerProvider` queries `PostgresClient` for schemas/tables and emits tree nodes with context menus (refresh, edit, delete, copy connection string). The provider reacts to `refresh()` calls to re-run queries.
3. **Connection State** – Stored in VS Code `globalState` and `secrets` using helpers in `connectionSettings.ts`. Supports multiple named connections, active connection tracking, and deletion. Secrets API keeps passwords encrypted.
4. **Webview UI** – When a table or SQL runner is opened, the extension calls `openTablePanel` / `openSqlRunnerPanel`. These host the React bundle (from `packages/ui`) and communicate via `postMessage`. Think of it as “React app in an iframe.”
5. **Data Flow** – The extension fetches data via `PostgresClient` (wrapping `pg`). Results are serialized to the webview, where React components render grids, handle SQL submissions, and send commands back. Every request/response is logged with `[dbview-ui]` or `[dbview]` prefixes to aid debugging.

---

## 3. Detailed Data Flow

### 3.1 Schema Explorer

1. User configures or selects a connection.
2. `SchemaExplorerProvider` root node shows DB size (via `PostgresClient.getDatabaseSize`).
3. Expanding the root shows schemas and grouped object types (Tables, Views, etc.).
4. For tables, `listTables` returns `name` + `sizeBytes`; tree labels display `users (12.4 MB)` and tooltips show `schema.table · size`.
5. Context menu actions:
   - Refresh – reruns `refresh()` to requery schema data.
   - Edit/Delete/Copy – uses `connectionSettings` helpers and VS Code clipboard APIs.

### 3.2 Table Webview

1. Command `dbview.openTable` calls `openTablePanel`, creating/retrieving one React webview per table.
2. The webview loads the Vite-built bundle from `packages/ui`.
3. Initial message `INIT_TABLE_VIEW` notifies React to request rows.
4. React `TableView` (in `packages/ui/src/components/TableView.tsx`) uses `getVsCodeApi()` to `postMessage({ type: "LOAD_TABLE_ROWS" })`.
5. The extension listens for that message and responds with `LOAD_TABLE_ROWS` containing columns/rows from `PostgresClient.fetchTableRows`.

### 3.3 SQL Runner Webview

1. `dbview.openSqlRunner` opens a webview hosting `SqlRunnerView`.
2. User writes SQL; pressing Run posts `RUN_QUERY` to the extension.
3. Extension executes `postgresClient.runQuery(sql)` and sends either `QUERY_RESULT` or `QUERY_ERROR`.
4. UI displays a grid using the shared `DataGrid` component.

### 3.4 Example Event Timeline

```
User clicks "users" table in tree
└─ VS Code runs command dbview.openTable with { schema: "public", table: "users" }
   └─ openTablePanel loads (or reuses) a webview, sends INIT_TABLE_VIEW
      └─ React App receives INIT_TABLE_VIEW, calls requestTableRows()
         └─ requestTableRows posts LOAD_TABLE_ROWS (request) to extension
            └─ extension PostgresClient runs SELECT * FROM public.users LIMIT 100
               └─ results returned; extension posts LOAD_TABLE_ROWS (response)
                  └─ React updates DataGrid with new rows
```

Tracing this path helps when debugging why data is missing. Open VS Code Developer Tools (Help → Toggle Developer Tools) to see both extension host logs and webview console logs.

---

## 4. React UI Components (`packages/ui`)

| Component | Path | Notes |
| --- | --- | --- |
| `App.tsx` | `packages/ui/src/App.tsx` | Routes between Table view and SQL runner based on incoming messages from VS Code |
| `TableView` | `packages/ui/src/components/TableView.tsx` | Displays schema/table header, refresh button, and `DataGrid` |
| `SqlRunnerView` | `packages/ui/src/components/SqlRunnerView.tsx` | Textarea editor for SQL with Run button, error state, and grid for results |
| `DataGrid` | `packages/ui/src/components/DataGrid.tsx` | Lightweight grid component (sorting/editing TBD) |

Styles rely on Tailwind classes defined in `packages/ui/tailwind.config.ts` and `src/styles/index.css`.

---

## 5. Backend: PostgresClient

Located at `apps/vscode-extension/src/postgresClient.ts`.

Capabilities:

- Connection pool via `pg` (`Pool`).
- `listSchemas`, `listTables` (with `pg_total_relation_size` for sizes), `listViews`, `listFunctions`, etc.
- `fetchTableRows(schema, table, limit)` for table grids.
- `runQuery(sql)` for SQL runner.
- Helper `testConnection` for the config UI “Test Connection” button.

Error handling logs to the VS Code dev console and surfaces user-friendly messages.

---

## 6. Connection Configuration Flow

1. Command `dbview.configureConnection` opens `connectionConfigPanel.ts`, a custom webview form.
2. Form allows entry of name, host, port, DB, user, password, “Save connection” checkbox, test button, and explicit “Save Connection” action.
3. Submission sends `{ command: "submit", ... }` back to the extension. Pressing “Save Connection” forces the `saveConnection` checkbox to true and requires a connection name.
4. Extension saves credentials via `saveConnectionWithName` (if named) or legacy single connection fields for single-use sessions.
5. Active connection is updated, `SchemaExplorerProvider` refreshes, and the new client is created. If the deleted connection was active, the extension falls back to another saved connection or clears the explorer entirely.

Secrets (passwords) are stored using `context.secrets`. Metadata lives in `globalState`.

---

## 7. Desktop Shell (Future)

`apps/desktop` is a simple Electron bootstrap:

- `main.ts` creates a `BrowserWindow` pointing at `apps/desktop/static/index.html`.
- Intended to load the same React bundle for a standalone app.

---

## 8. Development Workflow

1. `pnpm install` to bootstrap deps (installs root + every workspace).
2. `pnpm run dev:extension` (or equivalent) to watch `@dbview/ui` and the extension. This runs the TypeScript compiler in watch mode and the Vite dev server, so webviews hot-reload.
3. Launch the “Run dbview Extension” configuration from VS Code to open an Extension Development Host (a second VS Code window with the extension loaded from your sources).
4. In the Dev Host, open the new `DB View` activity bar icon (left sidebar). Click “Connect to Database” and fill in credentials. Once connected, expand schemas and open tables.

Build commands:

```bash
pnpm --filter @dbview/ui build            # Bundle React webview
pnpm --filter @dbview/vscode-extension compile  # Type-check extension
pnpm run -r build                         # Build everything
```

---

## 9. Key Files to Explore

- `apps/vscode-extension/src/extension.ts` – main orchestration file (commands, context menu logic, webview wiring).
- `apps/vscode-extension/src/schemaExplorer.ts` – tree provider showing schemas/tables with sizes and inline actions.
- `apps/vscode-extension/src/tablePanel.ts` / `sqlRunnerPanel.ts` – utilities for opening/maintaining VS Code webviews.
- `apps/vscode-extension/src/connectionSettings.ts` – getters/setters for stored connections.
- `packages/ui/src/App.tsx` – entry point for React webview, message handling.
- `packages/ui/src/components/*` – particular UI modules.

---

## 10. Future Enhancements (from `FEATURES.md`)

- Inline editing, inserts, deletes, pagination, advanced filtering, saved views.
- Schema metadata panels, ER diagrams, query history, SQL formatter, autocomplete.
- Read-only mode, large-table virtualization, connection health monitoring.

These milestones serve as a roadmap for contributions.

---

### FAQ / Troubleshooting

- **“DB Explorer shows no nodes even after configuring a connection.”** Ensure `connection` is stored (check Developer Tools console). Use the context menu “Refresh Connection”.
- **“Table size not appearing.”** Confirm extension has been recompiled (`pnpm --filter @dbview/vscode-extension compile`) and reload VS Code (`Developer: Reload Window`).
- **“Webview not responding.”** Make sure `packages/ui` bundle is built or the dev server is running when launching the extension.
- **“How do I inspect webview messages?”** In the Extension Development Host, open Developer Tools → Sources. Each webview is listed; select it and view the console to watch `postMessage` calls.
- **“Where do logs go?”** Extension host logs appear in the `dbview` output channel (`View → Output → dbview`). Webview logs appear in Developer Tools console.

---

With this overview you can navigate the repo, understand how data flows from Postgres to the VS Code tree and webviews, and identify where to extend the UI or backend next.
