# DB-View Architecture Plan

## Executive Summary

This document outlines the architecture plan for the DB-View application, which supports both a desktop application (Electron) and a VS Code extension. The goal is to maintain **separate UIs** optimized for each platform while sharing **core business logic** to reduce duplication and bugs.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Proposed Architecture](#2-proposed-architecture)
3. [Package Responsibilities](#3-package-responsibilities)
4. [Core Package Design](#4-core-package-design)
5. [UI Package Guidelines](#5-ui-package-guidelines)
6. [Data Flow Architecture](#6-data-flow-architecture)
7. [Implementation Phases](#7-implementation-phases)
8. [Migration Guide](#8-migration-guide)
9. [Best Practices](#9-best-practices)
10. [Decision Log](#10-decision-log)

---

## 1. Current State Analysis

### 1.1 Package Structure

```
db-view-app/
├── apps/
│   ├── desktop/              # Electron main process
│   ├── vscode-extension/     # VS Code extension host
│   └── web/                  # Marketing website (Next.js)
│
├── packages/
│   ├── types/                # Shared TypeScript types
│   ├── adapters/             # Database adapters (9 databases)
│   ├── ui/                   # VS Code extension UI (React)
│   ├── desktop-ui/           # Desktop application UI (React)
│   ├── utils/                # Minimal utilities
│   └── core/                 # Currently minimal/unused
```

### 1.2 Current Problems

| Problem | Impact | Severity |
|---------|--------|----------|
| **UI Code Duplication** | ~80% of UI logic duplicated between packages | High |
| **Inconsistent Features** | Desktop has features missing in VS Code | Medium |
| **Bug Duplication** | Fixes must be applied to both UIs | High |
| **Maintenance Burden** | Two implementations to maintain | High |
| **No Shared Business Logic** | Filter building, transforms duplicated | Medium |

### 1.3 Code Duplication Analysis

| Component | Desktop-UI | VS Code UI | Overlap |
|-----------|------------|------------|---------|
| TableView | 2,484 lines | 1,024 lines | ~60% |
| DocumentDataView | 1,089 lines | 570 lines | ~40% |
| QueryView/SqlRunner | 926 lines | 752 lines | ~70% |
| FilterBuilder | 244 lines | 160 lines | ~65% |
| Export utilities | 180 lines | 120 lines | ~80% |
| Data transforms | 150 lines | 100 lines | ~90% |

### 1.4 What's Already Shared (Good)

- **`@dbview/types`** - All type definitions
- **`@dbview/adapters`** - Complete database abstraction layer
- Database drivers and connection logic

---

## 2. Proposed Architecture

### 2.1 Target Package Structure

```
db-view-app/
├── apps/
│   ├── desktop/              # Electron main process (unchanged)
│   ├── vscode-extension/     # VS Code extension host (unchanged)
│   └── web/                  # Marketing website (unchanged)
│
├── packages/
│   ├── types/                # ✅ Shared types (unchanged)
│   ├── adapters/             # ✅ Database adapters (unchanged)
│   ├── core/                 # 🆕 ENHANCED - Shared business logic
│   ├── desktop-ui/           # Desktop UI (platform-specific)
│   └── ui/                   # VS Code UI (platform-specific)
```

### 2.2 Dependency Graph

```
                    ┌─────────────────┐
                    │  @dbview/types  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────────┐ ┌─────────┐ ┌─────────────────┐
    │ @dbview/adapters│ │  @dbview│ │  @dbview/core   │
    │                 │ │  /core  │ │                 │
    └────────┬────────┘ └────┬────┘ └────────┬────────┘
             │               │               │
             │               │               │
    ┌────────┴───────────────┴───────────────┴────────┐
    │                                                  │
    ▼                                                  ▼
┌─────────────────────┐                    ┌─────────────────────┐
│ @dbview/desktop-ui  │                    │    @dbview/ui       │
│   (Electron)        │                    │   (VS Code)         │
└──────────┬──────────┘                    └──────────┬──────────┘
           │                                          │
           ▼                                          ▼
    ┌─────────────┐                          ┌─────────────────┐
    │ apps/desktop│                          │apps/vscode-ext  │
    └─────────────┘                          └─────────────────┘
```

### 2.3 Design Principles

1. **Separation of Concerns**: UI rendering separate from business logic
2. **Platform Optimization**: Each UI optimized for its platform
3. **Single Source of Truth**: Business logic in one place
4. **Type Safety**: Full TypeScript coverage
5. **Testability**: Core logic easily unit tested

---

## 3. Package Responsibilities

### 3.1 `@dbview/types`

**Purpose**: Shared TypeScript type definitions

**Contents**:
- Database connection configurations
- Column metadata types
- Filter and query types
- Tab and view state types
- ER diagram types
- Import/export types

**Dependencies**: None (leaf package)

### 3.2 `@dbview/adapters`

**Purpose**: Database abstraction layer

**Contents**:
- DatabaseAdapter interface
- 9 database implementations (Postgres, MySQL, MongoDB, etc.)
- DatabaseAdapterFactory
- Connection management
- Query execution

**Dependencies**: `@dbview/types`, database drivers

### 3.3 `@dbview/core` (Enhanced)

**Purpose**: Shared business logic (UI-agnostic)

**Contents**:
- Filter/query building
- Data transformations
- Document utilities
- Export/import logic
- Validation utilities
- SQL formatting

**Dependencies**: `@dbview/types`

**Does NOT contain**:
- React components
- Platform-specific code
- UI state management

### 3.4 `@dbview/desktop-ui`

**Purpose**: Desktop application UI (Electron renderer)

**Contents**:
- Rich React components
- Split-pane layouts
- Tree view with inline editing
- Index management panel
- Aggregation pipeline builder
- Platform-specific features

**Dependencies**: `@dbview/types`, `@dbview/core`

### 3.5 `@dbview/ui`

**Purpose**: VS Code extension UI (webview)

**Contents**:
- Lightweight React components
- Webview-optimized layouts
- Compact views
- VS Code theme integration

**Dependencies**: `@dbview/types`, `@dbview/core`

---

## 4. Core Package Design

### 4.1 Directory Structure

```
packages/core/
├── src/
│   ├── index.ts                    # Main exports
│   │
│   ├── filters/                    # Query/filter building
│   │   ├── index.ts
│   │   ├── types.ts                # Filter-specific types
│   │   ├── buildSqlFilter.ts       # SQL WHERE clause builder
│   │   ├── buildMongoFilter.ts     # MongoDB query builder
│   │   ├── buildElasticFilter.ts   # Elasticsearch query builder
│   │   ├── buildCassandraFilter.ts # CQL filter builder
│   │   ├── validateFilter.ts       # Filter validation
│   │   └── operators.ts            # Operator definitions
│   │
│   ├── transforms/                 # Data transformations
│   │   ├── index.ts
│   │   ├── flattenDocument.ts      # Nested → flat structure
│   │   ├── nestToTree.ts           # Flat → tree structure
│   │   ├── inferTypes.ts           # Detect field types
│   │   ├── normalizeRows.ts        # Normalize query results
│   │   └── columnUtils.ts          # Column type utilities
│   │
│   ├── documents/                  # Document database utilities
│   │   ├── index.ts
│   │   ├── getDocumentId.ts        # Extract document ID
│   │   ├── pathUtils.ts            # Get/set/delete at path
│   │   ├── diffDocuments.ts        # Document comparison
│   │   └── validateDocument.ts     # Document validation
│   │
│   ├── export/                     # Export functionality
│   │   ├── index.ts
│   │   ├── toCsv.ts                # Export to CSV
│   │   ├── toJson.ts               # Export to JSON
│   │   ├── toSql.ts                # Export to SQL INSERT
│   │   ├── toMarkdown.ts           # Export to Markdown table
│   │   └── parseImport.ts          # Parse imported files
│   │
│   ├── sql/                        # SQL utilities
│   │   ├── index.ts
│   │   ├── formatSql.ts            # SQL formatting
│   │   ├── validateSql.ts          # Basic SQL validation
│   │   ├── parseSql.ts             # Simple SQL parsing
│   │   └── highlightSql.ts         # SQL syntax tokens
│   │
│   ├── validation/                 # Validation utilities
│   │   ├── index.ts
│   │   ├── validateConnection.ts   # Connection config validation
│   │   ├── validateValue.ts        # Value type validation
│   │   └── sanitize.ts             # Input sanitization
│   │
│   └── utils/                      # General utilities
│       ├── index.ts
│       ├── formatBytes.ts          # Byte formatting
│       ├── truncateValue.ts        # Value truncation
│       ├── generateId.ts           # ID generation
│       ├── connectionKey.ts        # Connection key utilities
│       └── debounce.ts             # Debounce utility
│
├── package.json
├── tsconfig.json
└── tsup.config.ts                  # Build configuration
```

### 4.2 Module Specifications

#### 4.2.1 Filters Module

```typescript
// packages/core/src/filters/index.ts

export { buildSqlFilter } from './buildSqlFilter';
export { buildMongoFilter } from './buildMongoFilter';
export { buildElasticFilter } from './buildElasticFilter';
export { buildCassandraFilter } from './buildCassandraFilter';
export { validateFilter } from './validateFilter';
export { FILTER_OPERATORS, getOperatorsForType } from './operators';
export type { FilterBuilder, FilterResult } from './types';
```

**buildSqlFilter.ts**:
```typescript
import type { FilterCondition, DatabaseType } from '@dbview/types';

export interface SqlFilterResult {
  whereClause: string;
  parameters: unknown[];
}

/**
 * Builds a SQL WHERE clause from filter conditions.
 * Uses parameterized queries to prevent SQL injection.
 *
 * @param filters - Array of filter conditions
 * @param dbType - Target database type for syntax differences
 * @param logic - AND or OR logic between conditions
 * @returns WHERE clause and parameters
 *
 * @example
 * const result = buildSqlFilter(
 *   [{ columnName: 'age', operator: 'gt', value: 18 }],
 *   'postgres',
 *   'AND'
 * );
 * // result.whereClause = 'WHERE "age" > $1'
 * // result.parameters = [18]
 */
export function buildSqlFilter(
  filters: FilterCondition[],
  dbType: DatabaseType,
  logic: 'AND' | 'OR' = 'AND'
): SqlFilterResult {
  // Implementation
}
```

**buildMongoFilter.ts**:
```typescript
import type { FilterCondition } from '@dbview/types';

export interface MongoFilterResult {
  query: Record<string, unknown>;
}

/**
 * Builds a MongoDB query object from filter conditions.
 *
 * @param filters - Array of filter conditions
 * @param logic - AND or OR logic between conditions
 * @returns MongoDB query object
 *
 * @example
 * const result = buildMongoFilter(
 *   [{ columnName: 'age', operator: 'gt', value: 18 }],
 *   'AND'
 * );
 * // result.query = { age: { $gt: 18 } }
 */
export function buildMongoFilter(
  filters: FilterCondition[],
  logic: 'AND' | 'OR' = 'AND'
): MongoFilterResult {
  // Implementation
}
```

#### 4.2.2 Transforms Module

```typescript
// packages/core/src/transforms/index.ts

export { flattenDocument } from './flattenDocument';
export { nestToTree } from './nestToTree';
export { inferTypes, inferColumnType } from './inferTypes';
export { normalizeRows } from './normalizeRows';
export { getColumnDisplayName, formatColumnValue } from './columnUtils';
```

**flattenDocument.ts**:
```typescript
export interface FlattenedField {
  path: string;           // e.g., "user.address.city"
  value: unknown;
  type: string;           // "string", "number", "boolean", "object", "array", "null"
  depth: number;
}

/**
 * Flattens a nested document into dot-notation paths.
 * Used for table view display of JSON documents.
 *
 * @param document - The document to flatten
 * @param options - Flattening options
 * @returns Array of flattened fields
 *
 * @example
 * flattenDocument({ user: { name: "John", age: 30 } })
 * // [
 * //   { path: "user.name", value: "John", type: "string", depth: 2 },
 * //   { path: "user.age", value: 30, type: "number", depth: 2 }
 * // ]
 */
export function flattenDocument(
  document: Record<string, unknown>,
  options?: {
    maxDepth?: number;
    arrayNotation?: 'bracket' | 'dot';
  }
): FlattenedField[] {
  // Implementation
}
```

**nestToTree.ts**:
```typescript
export interface TreeNode {
  key: string;
  path: string;
  value: unknown;
  type: string;
  children?: TreeNode[];
  isExpanded?: boolean;
}

/**
 * Converts a document into a tree structure for tree view.
 *
 * @param document - The document to convert
 * @param expandedPaths - Set of paths that should be expanded
 * @returns Root tree node
 */
export function nestToTree(
  document: Record<string, unknown>,
  expandedPaths?: Set<string>
): TreeNode {
  // Implementation
}
```

#### 4.2.3 Documents Module

```typescript
// packages/core/src/documents/index.ts

export { getDocumentId, getDocumentIdField } from './getDocumentId';
export { getAtPath, setAtPath, deleteAtPath } from './pathUtils';
export { diffDocuments } from './diffDocuments';
export { validateDocument } from './validateDocument';
```

**getDocumentId.ts**:
```typescript
import type { DatabaseType, ColumnMetadata } from '@dbview/types';

/**
 * Determines the ID field name for a document database.
 * Uses column metadata if available, falls back to conventions.
 *
 * @param columns - Column metadata (optional)
 * @param dbType - Database type
 * @returns The ID field name
 *
 * Priority:
 * 1. Column with isPrimaryKey: true
 * 2. Database convention (_id for MongoDB/ES, id for Cassandra)
 * 3. Common patterns (id, _id, ID, Id)
 */
export function getDocumentIdField(
  columns: ColumnMetadata[] | undefined,
  dbType: DatabaseType
): string {
  // Check metadata first
  if (columns?.length) {
    const pkColumn = columns.find(col => col.isPrimaryKey);
    if (pkColumn) return pkColumn.name;
  }

  // Database conventions
  switch (dbType) {
    case 'mongodb':
    case 'elasticsearch':
      return '_id';
    case 'cassandra':
      return 'id';
    default:
      return '_id';
  }
}

/**
 * Extracts the ID value from a document.
 */
export function getDocumentId(
  document: Record<string, unknown>,
  columns: ColumnMetadata[] | undefined,
  dbType: DatabaseType
): string {
  const idField = getDocumentIdField(columns, dbType);
  const id = document[idField];
  return id != null ? String(id) : '';
}
```

**pathUtils.ts**:
```typescript
/**
 * Gets a value at a dot-notation path.
 *
 * @example
 * getAtPath({ user: { name: "John" } }, "user.name") // "John"
 */
export function getAtPath(
  obj: Record<string, unknown>,
  path: string
): unknown {
  // Implementation
}

/**
 * Sets a value at a dot-notation path (immutable).
 * Returns a new object with the value set.
 *
 * @example
 * setAtPath({ user: { name: "John" } }, "user.name", "Jane")
 * // { user: { name: "Jane" } }
 */
export function setAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  // Implementation
}

/**
 * Deletes a value at a dot-notation path (immutable).
 * Returns a new object with the value removed.
 */
export function deleteAtPath(
  obj: Record<string, unknown>,
  path: string
): Record<string, unknown> {
  // Implementation
}
```

#### 4.2.4 Export Module

```typescript
// packages/core/src/export/index.ts

export { toCsv, type CsvOptions } from './toCsv';
export { toJson, type JsonOptions } from './toJson';
export { toSql, type SqlOptions } from './toSql';
export { toMarkdown } from './toMarkdown';
export { parseImport, type ImportResult } from './parseImport';
```

**toCsv.ts**:
```typescript
export interface CsvOptions {
  delimiter?: ',' | ';' | '\t';
  includeHeaders?: boolean;
  nullValue?: string;
  dateFormat?: string;
  columns?: string[];  // Specific columns to export
}

/**
 * Converts rows to CSV format.
 *
 * @param rows - Array of row objects
 * @param options - CSV formatting options
 * @returns CSV string
 */
export function toCsv(
  rows: Record<string, unknown>[],
  options?: CsvOptions
): string {
  // Implementation
}
```

#### 4.2.5 SQL Module

```typescript
// packages/core/src/sql/index.ts

export { formatSql } from './formatSql';
export { validateSql, type SqlValidationResult } from './validateSql';
export { parseSql, type ParsedSql } from './parseSql';
```

**formatSql.ts**:
```typescript
import { format } from 'sql-formatter';
import type { DatabaseType } from '@dbview/types';

/**
 * Formats SQL for readability.
 *
 * @param sql - Raw SQL string
 * @param dbType - Database type for dialect-specific formatting
 * @returns Formatted SQL string
 */
export function formatSql(
  sql: string,
  dbType: DatabaseType = 'postgres'
): string {
  const dialectMap: Record<DatabaseType, string> = {
    postgres: 'postgresql',
    mysql: 'mysql',
    mariadb: 'mariadb',
    sqlserver: 'tsql',
    sqlite: 'sqlite',
    mongodb: 'postgresql', // Not applicable
    redis: 'postgresql',   // Not applicable
    elasticsearch: 'postgresql', // Not applicable
    cassandra: 'postgresql', // Not applicable
  };

  return format(sql, {
    language: dialectMap[dbType] || 'postgresql',
    tabWidth: 2,
    keywordCase: 'upper',
  });
}
```

#### 4.2.6 Utils Module

```typescript
// packages/core/src/utils/index.ts

export { formatBytes } from './formatBytes';
export { truncateValue } from './truncateValue';
export { generateId } from './generateId';
export { getConnectionKey, parseConnectionKey } from './connectionKey';
export { debounce } from './debounce';
```

### 4.3 Package Configuration

**package.json**:
```json
{
  "name": "@dbview/core",
  "version": "0.1.0",
  "description": "Core business logic for DB-View",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./filters": {
      "import": "./dist/filters/index.mjs",
      "require": "./dist/filters/index.js",
      "types": "./dist/filters/index.d.ts"
    },
    "./transforms": {
      "import": "./dist/transforms/index.mjs",
      "require": "./dist/transforms/index.js",
      "types": "./dist/transforms/index.d.ts"
    },
    "./documents": {
      "import": "./dist/documents/index.mjs",
      "require": "./dist/documents/index.js",
      "types": "./dist/documents/index.d.ts"
    },
    "./export": {
      "import": "./dist/export/index.mjs",
      "require": "./dist/export/index.js",
      "types": "./dist/export/index.d.ts"
    },
    "./sql": {
      "import": "./dist/sql/index.mjs",
      "require": "./dist/sql/index.js",
      "types": "./dist/sql/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@dbview/types": "workspace:*",
    "sql-formatter": "^15.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  },
  "peerDependencies": {
    "@dbview/types": "workspace:*"
  }
}
```

**tsup.config.ts**:
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'filters/index': 'src/filters/index.ts',
    'transforms/index': 'src/transforms/index.ts',
    'documents/index': 'src/documents/index.ts',
    'export/index': 'src/export/index.ts',
    'sql/index': 'src/sql/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
```

---

## 5. UI Package Guidelines

### 5.1 Desktop-UI (`@dbview/desktop-ui`)

**Target Platform**: Electron renderer process

**Design Goals**:
- Rich, feature-complete experience
- Full keyboard and mouse support
- Split-pane and resizable layouts
- Advanced features (aggregation builder, index management)

**Allowed Features**:
- Complex layouts (split panes, floating panels)
- Heavy dependencies if needed
- Rich text editors (CodeMirror with full extensions)
- Native-like interactions
- Large bundle size acceptable

**Component Patterns**:
```typescript
// Example: Rich DocumentDataView with all features
import { flattenDocument, nestToTree, getDocumentId } from '@dbview/core';

export function DocumentDataView({ connectionKey, schema, table, dbType }) {
  // Full implementation with:
  // - Document list sidebar
  // - Tree/Table/JSON view modes
  // - Inline editing
  // - Index management
  // - Aggregation pipeline builder
}
```

### 5.2 VS Code UI (`@dbview/ui`)

**Target Platform**: VS Code webview

**Design Goals**:
- Lightweight and fast
- Webview-friendly (limited APIs)
- VS Code theme integration
- Compact for side panel usage

**Constraints**:
- No Node.js APIs (webview sandbox)
- Limited bundle size
- Must work within webview security
- Message-based communication only

**Allowed Features**:
- Simple, focused layouts
- Essential features only
- Lightweight alternatives to heavy libraries
- Pagination over infinite scroll (simpler)

**Component Patterns**:
```typescript
// Example: Simplified DocumentDataView
import { flattenDocument, getDocumentId } from '@dbview/core';

export function DocumentDataView({
  dbType, schema, table, columns, rows,
  loading, onRefresh, onPageChange
}) {
  // Simplified implementation with:
  // - Table/JSON view toggle
  // - Basic pagination
  // - Read-only or simple editing
  // - No sidebar, no tree view
}
```

### 5.3 Feature Comparison

| Feature | Desktop-UI | VS Code UI | Reason |
|---------|------------|------------|--------|
| **Document List Sidebar** | ✅ Yes | ❌ No | Space constraints |
| **Tree View** | ✅ Full tree | ❌ Collapsed JSON | Complexity |
| **Table View** | ✅ Virtual scrolling | ✅ Pagination | Webview limits |
| **JSON View** | ✅ CodeMirror | ✅ Simple textarea | Bundle size |
| **Inline Editing** | ✅ Yes | ⚠️ Basic | Complexity |
| **Index Management** | ✅ Full panel | ❌ No | Advanced feature |
| **Aggregation Builder** | ✅ Visual builder | ❌ No | Advanced feature |
| **Multi-select** | ✅ Yes | ⚠️ Basic | Complexity |
| **Drag & Drop** | ✅ Yes | ❌ No | Webview limits |
| **Split Panes** | ✅ Yes | ❌ No | Space constraints |
| **Keyboard Shortcuts** | ✅ Full | ✅ Essential only | VS Code conflicts |

---

## 6. Data Flow Architecture

### 6.1 Desktop Application Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Desktop App                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Renderer Process                        │    │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐   │    │
│  │  │  React Component │  │     @dbview/core            │   │    │
│  │  │  (desktop-ui)    │──│  • flattenDocument()        │   │    │
│  │  │                  │  │  • buildMongoFilter()       │   │    │
│  │  └────────┬─────────┘  │  • toCsv()                  │   │    │
│  │           │            └─────────────────────────────┘   │    │
│  │           │                                               │    │
│  │           │ window.electronAPI.loadTableRows()            │    │
│  │           ▼                                               │    │
│  │  ┌─────────────────┐                                     │    │
│  │  │  Preload Script │                                     │    │
│  │  │  (contextBridge)│                                     │    │
│  │  └────────┬────────┘                                     │    │
│  └───────────┼──────────────────────────────────────────────┘    │
│              │ IPC (ipcRenderer.invoke)                          │
│              ▼                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Main Process                            │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐     │  │
│  │  │  IPC Handlers   │  │  ConnectionManager           │     │  │
│  │  │  (ipc/index.ts) │──│  • getAdapter(connectionKey) │     │  │
│  │  └────────┬────────┘  └─────────────────────────────┘     │  │
│  │           │                                                │  │
│  │           │                                                │  │
│  │           ▼                                                │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                 @dbview/adapters                     │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐                 │  │  │
│  │  │  │PostgresAdapter│  │MongoDBAdapter│  ...           │  │  │
│  │  │  └──────────────┘  └──────────────┘                 │  │  │
│  │  └────────────────────────┬────────────────────────────┘  │  │
│  └───────────────────────────┼────────────────────────────────┘  │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Database       │
                    │  (Postgres, Mongo)  │
                    └─────────────────────┘
```

### 6.2 VS Code Extension Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     VS Code Extension                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Webview Panel                           │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐     │  │
│  │  │  React Component │  │     @dbview/core            │     │  │
│  │  │  (ui package)    │──│  • flattenDocument()        │     │  │
│  │  │                  │  │  • buildMongoFilter()       │     │  │
│  │  └────────┬─────────┘  │  • toCsv()                  │     │  │
│  │           │            └─────────────────────────────┘     │  │
│  │           │                                                │  │
│  │           │ vscode.postMessage({ type: 'LOAD_TABLE_ROWS' })│  │
│  │           ▼                                                │  │
│  │  ┌─────────────────┐                                      │  │
│  │  │  Message Handler│                                      │  │
│  │  │  (vscode.ts)    │                                      │  │
│  │  └────────┬────────┘                                      │  │
│  └───────────┼───────────────────────────────────────────────┘  │
│              │ postMessage                                       │
│              ▼                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Extension Host                            │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐     │  │
│  │  │  mainPanel.ts   │  │  Adapter Cache               │     │  │
│  │  │  (msg handler)  │──│  • getAdapter(connectionKey) │     │  │
│  │  └────────┬────────┘  └─────────────────────────────┘     │  │
│  │           │                                                │  │
│  │           ▼                                                │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                 @dbview/adapters                     │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐                 │  │  │
│  │  │  │PostgresAdapter│  │MongoDBAdapter│  ...           │  │  │
│  │  │  └──────────────┘  └──────────────┘                 │  │  │
│  │  └────────────────────────┬────────────────────────────┘  │  │
│  └───────────────────────────┼────────────────────────────────┘  │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Database       │
                    │  (Postgres, Mongo)  │
                    └─────────────────────┘
```

### 6.3 Core Package Usage

```typescript
// Both UIs use the same core functions

// Desktop-UI: DocumentDataView.tsx
import {
  flattenDocument,
  nestToTree,
  getDocumentId,
  buildMongoFilter
} from '@dbview/core';

function DocumentDataView({ document, dbType }) {
  const id = getDocumentId(document, undefined, dbType);
  const tree = nestToTree(document, expandedPaths);
  const flat = flattenDocument(document);
  // Rich tree rendering with inline editing
}

// VS Code UI: DocumentDataView.tsx
import {
  flattenDocument,
  getDocumentId
} from '@dbview/core';

function DocumentDataView({ rows, dbType }) {
  const processedRows = rows.map(row => ({
    id: getDocumentId(row, undefined, dbType),
    fields: flattenDocument(row),
  }));
  // Simple table or JSON view
}
```

---

## 7. Implementation Phases

### Phase 1: Core Package Foundation (Week 1)

**Goal**: Create the core package with essential utilities

**Tasks**:
1. Set up `@dbview/core` package structure
2. Implement `documents` module (getDocumentId, pathUtils)
3. Implement `transforms` module (flattenDocument, nestToTree, inferTypes)
4. Implement `utils` module (formatBytes, truncateValue, generateId)
5. Add unit tests for all modules
6. Update both UIs to import from core

**Deliverables**:
- `@dbview/core` package with documents, transforms, utils modules
- Unit tests with >90% coverage
- Both UIs using core utilities

### Phase 2: Filter Building (Week 2)

**Goal**: Centralize filter/query building logic

**Tasks**:
1. Implement `filters` module with all database builders
2. Move filter logic from adapters (if duplicated)
3. Implement filter validation
4. Add comprehensive filter tests
5. Update both UIs to use core filter builders

**Deliverables**:
- Complete `filters` module
- Filter validation with helpful error messages
- Integration in both UIs

### Phase 3: Export/Import (Week 3)

**Goal**: Centralize export and import functionality

**Tasks**:
1. Implement `export` module (CSV, JSON, SQL, Markdown)
2. Implement import parsing
3. Add format detection
4. Update both UIs to use core export

**Deliverables**:
- Complete `export` module
- Support for all export formats
- Import file parsing

### Phase 4: SQL Utilities (Week 4)

**Goal**: Centralize SQL formatting and utilities

**Tasks**:
1. Implement `sql` module (formatSql, validateSql, parseSql)
2. Add database-specific formatting options
3. Update query views to use core SQL utilities

**Deliverables**:
- Complete `sql` module
- Database-aware formatting
- Basic SQL validation

### Phase 5: Cleanup & Documentation (Week 5)

**Goal**: Remove duplication and document

**Tasks**:
1. Remove duplicated code from both UIs
2. Add JSDoc comments to all core functions
3. Create API documentation
4. Add usage examples
5. Performance testing

**Deliverables**:
- Clean codebase with no duplication
- Complete API documentation
- Performance benchmarks

---

## 8. Migration Guide

### 8.1 Migrating to Core Utilities

**Before (duplicated in both UIs)**:
```typescript
// packages/ui/src/utils/document.ts
function getDocumentId(doc, dbType) {
  if (dbType === 'mongodb') return doc._id;
  return doc.id || doc._id;
}

// packages/desktop-ui/src/utils/document.ts
function getDocumentId(doc, dbType) {
  if (dbType === 'mongodb' || dbType === 'elasticsearch') return doc._id;
  return doc.id;
}
```

**After (single source)**:
```typescript
// packages/core/src/documents/getDocumentId.ts
export function getDocumentId(
  document: Record<string, unknown>,
  columns: ColumnMetadata[] | undefined,
  dbType: DatabaseType
): string {
  // Single, well-tested implementation
}

// Both UIs:
import { getDocumentId } from '@dbview/core';
```

### 8.2 Step-by-Step Migration

1. **Identify duplicated function**
2. **Create core implementation** with comprehensive tests
3. **Update desktop-ui** to import from core
4. **Verify desktop-ui** works correctly
5. **Update ui package** to import from core
6. **Verify VS Code extension** works correctly
7. **Remove old implementations** from both UIs
8. **Run full test suite**

### 8.3 Import Patterns

```typescript
// Import everything
import * as core from '@dbview/core';
core.flattenDocument(doc);

// Import specific module
import { flattenDocument, nestToTree } from '@dbview/core/transforms';

// Import specific functions
import { getDocumentId } from '@dbview/core';
```

---

## 9. Best Practices

### 9.1 Core Package Guidelines

1. **No React dependencies** - Core must be framework-agnostic
2. **No platform-specific code** - No Electron or VS Code APIs
3. **Pure functions preferred** - Easy to test, no side effects
4. **Comprehensive types** - Full TypeScript with strict mode
5. **Thorough testing** - Minimum 90% coverage
6. **Clear documentation** - JSDoc for all exports

### 9.2 UI Package Guidelines

1. **Import from core** - Never duplicate core logic
2. **Platform-specific only** - Only UI and platform code
3. **Props over state** - Prefer controlled components
4. **Composition** - Small, reusable components
5. **Accessibility** - ARIA labels, keyboard support

### 9.3 Code Review Checklist

- [ ] Is this logic UI-specific or business logic?
- [ ] If business logic, is it in core?
- [ ] Are there duplicates in the other UI package?
- [ ] Is the function pure (if possible)?
- [ ] Are there unit tests?
- [ ] Is TypeScript strict mode passing?

---

## 10. Decision Log

### Decision 1: Separate UIs

**Date**: 2024-01-XX
**Decision**: Maintain separate UI packages for desktop and VS Code
**Rationale**:
- Different platform constraints (webview vs full Electron)
- Different user expectations
- Allows independent evolution
- Desktop can have richer features

**Alternatives Considered**:
- Shared UI components: Rejected due to platform differences
- Single UI with feature flags: Rejected due to complexity

### Decision 2: Enhanced Core Package

**Date**: 2024-01-XX
**Decision**: Create `@dbview/core` for shared business logic
**Rationale**:
- Reduces code duplication
- Single source of truth for business logic
- Easier testing
- Bug fixes apply everywhere

**Alternatives Considered**:
- Keep duplication: Rejected due to maintenance burden
- Merge into adapters: Rejected to keep adapters focused on DB ops

### Decision 3: No Transport Abstraction (Initially)

**Date**: 2024-01-XX
**Decision**: Do not create transport abstraction layer
**Rationale**:
- Current IPC patterns work well
- Would add complexity without clear benefit
- Can be added later if needed

**Alternatives Considered**:
- Create DatabaseTransport interface: Deferred for future consideration

---

## Appendix A: File Mapping

| Duplicated Code | Source | Target |
|-----------------|--------|--------|
| `getDocumentId` | Both UIs | `@dbview/core/documents` |
| `flattenDocument` | Both UIs | `@dbview/core/transforms` |
| `buildSqlFilter` | adapters + UIs | `@dbview/core/filters` |
| `formatBytes` | Both UIs | `@dbview/core/utils` |
| `toCsv` | Both UIs | `@dbview/core/export` |
| `formatSql` | Both UIs | `@dbview/core/sql` |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Core** | UI-agnostic business logic package |
| **Desktop-UI** | Electron renderer React application |
| **UI** | VS Code webview React application |
| **Adapter** | Database abstraction layer implementation |
| **Transport** | Communication layer (IPC or postMessage) |
| **Webview** | VS Code's embedded browser for extension UIs |

---

*Document Version: 1.0*
*Last Updated: 2024-01-XX*
*Author: Architecture Team*
