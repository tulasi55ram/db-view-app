# VS Code Extension Refactoring Plan

## Overview

This document outlines the comprehensive plan to refactor the `apps/vscode-extension` to match the `apps/desktop` application in UI/UX and functionality.

**Goal:** Create a unified codebase where both the VS Code extension and desktop app share the same UI components, features, and user experience.

**Priority Order:**
1. UI/UX consistency first
2. All 9 databases supported
3. Single shared UI package

---

## Table of Contents

1. [Current Architecture](#current-architecture)
2. [Target Architecture](#target-architecture)
3. [Implementation Phases](#implementation-phases)
4. [Detailed Steps](#detailed-steps)
5. [File Reference](#file-reference)
6. [API Reference](#api-reference)
7. [Testing Strategy](#testing-strategy)
8. [Risk Mitigation](#risk-mitigation)

---

## Current Architecture

### Package Structure

```
db-view-app/
├── apps/
│   ├── desktop/              # Electron desktop application
│   └── vscode-extension/     # VS Code extension
├── packages/
│   ├── types/                # Shared TypeScript types
│   ├── adapters/             # Database adapters (9 databases)
│   ├── shared-ui/            # Shared React UI (renamed from desktop-ui)
│   ├── ui/                   # VS Code webview UI
│   └── utils/                # Shared utilities
```

### Comparison: Desktop vs VS Code Extension

| Feature | Desktop App | VS Code Extension |
|---------|-------------|-------------------|
| **UI Framework** | React + Tailwind + Radix UI | Prebuilt webview assets |
| **UI Package** | `packages/shared-ui` | `packages/ui` → builds to `media/webview/` |
| **Communication** | Electron IPC | VS Code postMessage |
| **Database Support** | 9 databases | 5 databases |
| **Tab System** | Multi-tab + split panes | VS Code native tabs |
| **Filter System** | Rich builder + presets | Basic filtering |
| **Query History** | With starring | Basic |
| **Saved Views** | Full support | Limited |

### Database Support Comparison

| Database | Desktop | VS Code | Package |
|----------|---------|---------|---------|
| PostgreSQL | ✅ | ✅ | `pg` |
| MySQL | ✅ | ✅ | `mysql2` |
| MariaDB | ✅ | ❌ | `mysql2` |
| SQL Server | ✅ | ✅ | `mssql` |
| SQLite | ✅ | ✅ | `better-sqlite3` |
| MongoDB | ✅ | ✅ | `mongodb` |
| Redis | ✅ | ❌ | `ioredis` |
| Elasticsearch | ✅ | ❌ | `@elastic/elasticsearch` |
| Cassandra | ✅ | ❌ | `cassandra-driver` |

---

## Target Architecture

### Unified Package Structure

```
db-view-app/
├── apps/
│   ├── desktop/              # Uses @dbview/shared-ui directly
│   └── vscode-extension/     # Uses @dbview/shared-ui via webview build
├── packages/
│   ├── types/                # Shared TypeScript types
│   ├── adapters/             # Database adapters (all 9)
│   ├── shared-ui/            # SINGLE shared React UI package
│   │   ├── src/
│   │   │   ├── api/          # Platform abstraction layer
│   │   │   │   ├── types.ts  # Shared API types
│   │   │   │   └── index.ts  # Platform detection + VS Code API
│   │   │   ├── components/   # All UI components
│   │   │   ├── primitives/   # Design system primitives
│   │   │   ├── design-system/# Theme provider, tokens
│   │   │   └── electron.ts   # Electron-specific extensions
│   │   └── vite.config.ts    # Builds for both platforms
│   └── utils/                # Shared utilities
```

### Communication Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     @dbview/shared-ui                        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    DatabaseAPI Interface                │ │
│  │  - getConnections()    - runQuery()                    │ │
│  │  - listSchemas()       - formatSql()                   │ │
│  │  - loadTableRows()     - getFilterPresets()            │ │
│  │  - updateCell()        - onThemeChange()               │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│              ┌─────────────┴─────────────┐                  │
│              ▼                           ▼                  │
│  ┌───────────────────┐       ┌───────────────────┐         │
│  │   Electron API    │       │   VS Code API     │         │
│  │   (window.        │       │   (postMessage)   │         │
│  │    electronAPI)   │       │                   │         │
│  └─────────┬─────────┘       └─────────┬─────────┘         │
└────────────┼─────────────────────────────┼──────────────────┘
             │                             │
             ▼                             ▼
┌────────────────────────┐     ┌────────────────────────┐
│   Electron Main        │     │   VS Code Extension    │
│   Process              │     │   Host                 │
│   - ConnectionManager  │     │   - schemaExplorer     │
│   - SettingsStore      │     │   - mainPanel          │
│   - IPC Handlers       │     │   - Message Handlers   │
└────────────────────────┘     └────────────────────────┘
             │                             │
             └──────────────┬──────────────┘
                            ▼
              ┌────────────────────────┐
              │   @dbview/adapters     │
              │   DatabaseAdapter      │
              │   Factory Pattern      │
              └────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Package Unification ✅ (Completed)

**Status:** All steps completed

| Step | Status | Description |
|------|--------|-------------|
| 1.1 | ✅ | Rename `packages/desktop-ui` → `packages/shared-ui` |
| 1.2 | ✅ | Add platform detection API abstraction |
| 1.3 | ✅ | Fix component compatibility with optional APIs |
| 1.4 | ✅ | Update `packages/ui` to use shared-ui |
| 1.5 | ✅ | Update `apps/desktop` to use shared-ui |

### Phase 2: Styling Unification ✅ (Completed)

**Status:** All steps completed

| Step | Status | Description |
|------|--------|-------------|
| 2.1 | ✅ | Map VS Code theme variables to shared-ui tokens |
| 2.2 | ✅ | Update Tailwind config with design system |
| 2.3 | ✅ | Test with VS Code light/dark/high-contrast themes |

### Phase 3: Component Migration

| Step | Status | Description |
|------|--------|-------------|
| 3.1 | 🔲 | Migrate primitives (Button, Input, Dialog, etc.) |
| 3.2 | 🔲 | Migrate TableView with FilterBuilder |
| 3.3 | 🔲 | Migrate QueryView with history panel |
| 3.4 | 🔲 | Migrate database-specific views (Document, Redis) |
| 3.5 | 🔲 | Migrate ER Diagram panel |

### Phase 4: Database Support ✅ (Completed)

**Status:** All dependencies and connection handling added

| Step | Status | Description |
|------|--------|-------------|
| 4.1 | ✅ | Add MariaDB support (uses mysql2 driver) |
| 4.2 | ✅ | Add Redis support (ioredis dependency added) |
| 4.3 | ✅ | Add Elasticsearch support (@elastic/elasticsearch added) |
| 4.4 | ✅ | Add Cassandra support (cassandra-driver added) |

**Changes made:**
- Added `@elastic/elasticsearch`, `ioredis`, `cassandra-driver` to package.json
- Updated schemaExplorer.ts with connection key generation for all 9 database types
- Updated welcome messages to list all supported databases

### Phase 5: Feature Completion

| Step | Status | Description |
|------|--------|-------------|
| 5.1 | 🔲 | Filter presets system |
| 5.2 | 🔲 | Query history with starring |
| 5.3 | 🔲 | Enhanced saved views |
| 5.4 | 🔲 | Import/export improvements |

### Phase 6: Extension Host Updates

| Step | Status | Description |
|------|--------|-------------|
| 6.1 | 🔲 | Add IPC handlers for new features |
| 6.2 | 🔲 | Update connection settings storage |
| 6.3 | 🔲 | Add new database dependencies |

---

## Detailed Steps

### Step 1.4: Update packages/ui to use shared-ui

**Files to modify:**
- `packages/ui/package.json` - Add dependency on `@dbview/shared-ui`
- `packages/ui/src/main.tsx` - Import from shared-ui
- `packages/ui/src/App.tsx` - Use shared-ui App component
- `packages/ui/vite.config.ts` - Update build config

**Approach:**
1. Add `@dbview/shared-ui` as a dependency
2. Re-export components from shared-ui
3. Keep VS Code-specific webview initialization
4. Ensure build output goes to `apps/vscode-extension/media/webview/`

### Step 1.5: Update apps/desktop

**Files to modify:**
- `apps/desktop/package.json` - Reference `@dbview/shared-ui`
- Build scripts already updated

**Note:** Desktop app already works with shared-ui (previously desktop-ui)

### Step 2: Styling Unification

**CSS Variable Mapping:**

```css
/* VS Code to shared-ui mapping */
:root {
  --bg-primary: var(--vscode-editor-background);
  --bg-secondary: var(--vscode-sideBar-background);
  --bg-tertiary: var(--vscode-editorWidget-background);
  --text-primary: var(--vscode-editor-foreground);
  --text-secondary: var(--vscode-descriptionForeground);
  --border-default: var(--vscode-panel-border);
  --accent: var(--vscode-focusBorder);
  --accent-hover: var(--vscode-button-hoverBackground);
}
```

**Files to create/modify:**
- `packages/shared-ui/src/styles/vscode-theme.css`
- `packages/shared-ui/tailwind.config.ts`

### Step 3: Component Migration

**Components to migrate (Priority Order):**

1. **Primitives** (`src/primitives/`)
   - Button, IconButton
   - Input, TextArea
   - Dialog, Popover, Tooltip
   - Select, Switch

2. **TableView** (`src/components/TableView/`)
   - TableView.tsx - Virtual scrolling table
   - FilterBuilder.tsx - AND/OR filter logic
   - FilterChips.tsx - Active filter display
   - FilterPresets.tsx - Save/load filters
   - SaveViewDialog.tsx, SavedViewsPanel.tsx
   - ExportDataDialog.tsx, ImportDataDialog.tsx
   - InsertRowModal.tsx
   - TableMetadataPanel.tsx

3. **QueryView** (`src/components/QueryView/`)
   - QueryView.tsx - SQL editor
   - SqlEditor.tsx - CodeMirror integration
   - QueryResultsGrid.tsx
   - QueryHistoryPanel.tsx - With starring
   - SavedQueriesPanel.tsx
   - ExplainPlanPanel.tsx

4. **Database-Specific Views**
   - DocumentDataView/ - MongoDB/Elasticsearch/Cassandra
   - RedisDataView/ - Redis key-value browser
   - QueryViewRouter.tsx - Route by DB type

5. **Other Components**
   - ERDiagramPanel.tsx
   - Sidebar/
   - TabBar/
   - HomeView/

### Step 4: Database Support

**Dependencies to add to `apps/vscode-extension/package.json`:**

```json
{
  "dependencies": {
    "ioredis": "^5.8.2",
    "@elastic/elasticsearch": "^8.17.0",
    "cassandra-driver": "^4.7.2"
  }
}
```

**Files to modify:**
- `apps/vscode-extension/src/schemaExplorer.ts` - Add tree nodes
- `apps/vscode-extension/src/connectionConfigPanel.ts` - Add forms
- `apps/vscode-extension/src/mainPanel.ts` - Add handlers

### Step 5: Feature Completion

**Filter Presets System:**

Message types:
- `GET_FILTER_PRESETS`
- `SAVE_FILTER_PRESET`
- `DELETE_FILTER_PRESET`

Storage: `workspaceState` or `globalState`

**Query History with Starring:**

Message types:
- `GET_QUERY_HISTORY`
- `ADD_QUERY_HISTORY`
- `TOGGLE_QUERY_STAR`
- `DELETE_QUERY_HISTORY_ENTRY`

Storage: `globalState` per connection

---

## File Reference

### Completed Changes

| File | Change |
|------|--------|
| `packages/shared-ui/package.json` | Renamed from `@dbview/desktop-ui` to `@dbview/shared-ui`, added exports |
| `packages/shared-ui/src/api/types.ts` | **NEW** - Shared API types |
| `packages/shared-ui/src/api/index.ts` | **NEW** - Platform detection + VS Code API |
| `packages/shared-ui/src/electron.ts` | Updated to re-export from api/ |
| `packages/ui/package.json` | Added `@dbview/shared-ui` dependency |
| `packages/ui/src/electron.ts` | Updated to re-export from shared-ui |
| `packages/ui/src/vscode.ts` | Updated to initialize window.vscodeAPI |
| `packages/ui/src/platform.ts` | Updated to use shared-ui platform detection |
| `packages/ui/src/main.tsx` | Updated to use shared-ui imports |
| `packages/ui/src/styles/index.css` | Added shared-ui semantic CSS variables |
| `packages/ui/tailwind.config.ts` | Unified with shared-ui design tokens |
| `package.json` | Updated build scripts |
| `.github/workflows/ci.yml` | Updated package references |
| `.github/workflows/release.yml` | Updated package references |
| `.gitignore` | Updated dist path |

### Component Fixes Applied

| File | Fix |
|------|-----|
| `AddConnectionDialog.tsx` | Added `showOpenDialog` null check |
| `AddConnectionView.tsx` | Added `showOpenDialog` null check |
| `ExportModal.tsx` | Added `showSaveDialog` null check |
| `JSONEditor.tsx` | Added `readFromClipboard` null check |
| `JsonCellViewer.tsx` | Removed unused `ReactNode` import |
| `JsonTreeRenderer.tsx` | Removed unused `cn` import |
| `KeyboardShortcutsDialog.tsx` | Removed unused `DialogTrigger` import |
| `QueryView.tsx` | Added `duration` to tab interface |

### Files to Modify (Pending)

| File | Change |
|------|--------|
| `packages/ui/package.json` | Add shared-ui dependency |
| `packages/ui/src/main.tsx` | Import from shared-ui |
| `packages/ui/src/App.tsx` | Use shared-ui App |
| `apps/vscode-extension/package.json` | Add database dependencies |
| `apps/vscode-extension/src/mainPanel.ts` | Add message handlers |
| `apps/vscode-extension/src/schemaExplorer.ts` | Add DB tree nodes |

---

## API Reference

### DatabaseAPI Interface

```typescript
interface DatabaseAPI {
  // Connection management
  getConnections(): Promise<ConnectionInfo[]>;
  saveConnection(config: DatabaseConnectionConfig): Promise<void>;
  deleteConnection(name: string): Promise<void>;
  testConnection(config: DatabaseConnectionConfig): Promise<TestResult>;
  connectToDatabase(connectionKey: string): Promise<void>;
  disconnectFromDatabase(connectionKey: string): Promise<void>;

  // Schema operations
  listSchemas(connectionKey: string): Promise<string[]>;
  listTables(connectionKey: string, schema: string): Promise<TableInfo[]>;
  listColumns(connectionKey: string, schema: string, table: string): Promise<ColumnInfo[]>;
  // ... more schema operations

  // Table operations
  loadTableRows(params: LoadTableRowsParams): Promise<TableData>;
  getRowCount(params: GetRowCountParams): Promise<number>;
  updateCell(params: UpdateCellParams): Promise<void>;
  insertRow(params: InsertRowParams): Promise<Record<string, unknown>>;
  deleteRows(params: DeleteRowsParams): Promise<number>;

  // Query operations
  runQuery(params: RunQueryParams): Promise<QueryResult>;
  formatSql(sql: string): Promise<string>;
  explainQuery(params: ExplainQueryParams): Promise<ExplainPlan>;

  // Views & Presets
  getViews(params: GetViewsParams): Promise<SavedView[]>;
  saveView(params: SaveViewParams): Promise<void>;
  getFilterPresets(schema: string, table: string): Promise<FilterPreset[]>;
  saveFilterPreset(schema: string, table: string, preset: FilterPreset): Promise<void>;

  // Query History
  getQueryHistory(connectionKey: string): Promise<QueryHistoryEntry[]>;
  addQueryHistoryEntry(connectionKey: string, entry: QueryHistoryEntry): Promise<void>;
  toggleQueryHistoryStar(connectionKey: string, entryId: string, starred: boolean): Promise<void>;

  // Events
  onConnectionStatusChange(callback: (data: StatusData) => void): () => void;
  onThemeChange(callback: (theme: "light" | "dark") => void): () => void;
}
```

### Platform Detection

```typescript
import { detectPlatform, isElectron, isVSCode, getAPI } from "@dbview/shared-ui";

// Detect current platform
const platform = detectPlatform(); // "electron" | "vscode" | "web"

// Platform checks
if (isElectron()) {
  // Electron-specific code
}

if (isVSCode()) {
  // VS Code-specific code
}

// Get platform-appropriate API
const api = getAPI();
if (api) {
  const connections = await api.getConnections();
}
```

---

## Testing Strategy

### Unit Tests

1. Platform detection functions
2. API wrapper methods
3. Component rendering

### Integration Tests

1. Each database type connection
2. Filter builder with complex AND/OR conditions
3. Query history persistence
4. Theme switching (light/dark/high contrast)

### E2E Tests

1. Full user flows
2. Large dataset handling (10k+ rows)
3. Import/export with various formats

### Manual Testing Checklist

- [ ] PostgreSQL connection and operations
- [ ] MySQL connection and operations
- [ ] MariaDB connection and operations
- [ ] SQL Server connection and operations
- [ ] SQLite connection and operations
- [ ] MongoDB connection and operations
- [ ] Redis connection and operations
- [ ] Elasticsearch connection and operations
- [ ] Cassandra connection and operations
- [ ] Filter presets save/load
- [ ] Query history starring
- [ ] Theme switching
- [ ] Export to CSV/JSON/SQL
- [ ] Import from CSV/JSON

---

## Risk Mitigation

### Bundle Size

**Risk:** Adding all database drivers may increase webview bundle size significantly.

**Mitigation:**
- Use dynamic imports for database-specific views
- Consider code splitting for rarely used features
- Monitor bundle size in CI

### VS Code Theme Compatibility

**Risk:** CSS variable mapping may not work with all VS Code themes.

**Mitigation:**
- Test with popular themes (Dark+, Light+, High Contrast)
- Provide fallback values
- Use VS Code's recommended color tokens

### Performance

**Risk:** Virtual scrolling may behave differently in webview context.

**Mitigation:**
- Test with large datasets early
- Profile performance in VS Code webview
- Keep TanStack Virtual configuration consistent

### Breaking Changes

**Risk:** Existing saved connections may not work after refactoring.

**Mitigation:**
- Version storage format
- Add migration logic for old formats
- Test upgrade scenarios

---

## Estimated Scope

| Area | Files Affected | Complexity |
|------|----------------|------------|
| UI Package Merge | ~50 files | High |
| Styling System | ~10 files | Medium |
| Component Migration | ~40 files | High |
| API Bridge | ~5 files | Medium |
| Database Support | ~8 files | Medium |
| Feature Completion | ~10 files | Medium |
| **Total** | **~120 files** | **High** |

---

## Appendix: Build Commands

```bash
# Development
pnpm dev:desktop        # Run desktop app
pnpm dev:extension      # Run VS Code extension
pnpm dev:shared-ui      # Run shared-ui dev server

# Build
pnpm build:types        # Build types package
pnpm build:adapters     # Build adapters package
pnpm build:desktop      # Build desktop app
pnpm build:extension    # Build VS Code extension

# Clean
pnpm clean:desktop      # Clean desktop builds
```

---

*Document created: December 2024*
*Last updated: December 2024*
