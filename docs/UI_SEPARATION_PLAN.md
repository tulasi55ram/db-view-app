# Database Type UI Separation Plan

## Overview

Implementing a **Hybrid Approach** where:
- **Shared Shell**: TabBar, Sidebar structure, connection management remain consistent
- **Specialized Content**: Three distinct data viewers for SQL, Document (NoSQL), and Key-Value (Redis)

## Current State

| Type | Databases | Current UI |
|------|-----------|------------|
| **SQL** | PostgreSQL, MySQL, SQLite, SQL Server, MariaDB | TableView + QueryView + ERDiagram |
| **NoSQL** | MongoDB, Elasticsearch, Cassandra | TableView (same as SQL) |
| **Key-Value** | Redis | RedisDataView (already separate) |

**Problem**: NoSQL databases are shoehorned into the SQL table paradigm, which doesn't fit well for document stores.

---

## Proposed Architecture

### Database Type Categories

```
SQL (Relational)          NoSQL (Document)           Key-Value
─────────────────         ─────────────────          ─────────────
PostgreSQL                MongoDB                    Redis
MySQL                     Elasticsearch
MariaDB                   Cassandra
SQL Server
SQLite
```

### Component Routing

```
┌─────────────────────────────────────────────────────────────┐
│                        DataView                              │
│                       (Router)                               │
│                          │                                   │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│   ┌───────────┐   ┌──────────────┐   ┌────────────┐        │
│   │SqlDataView│   │DocumentData  │   │RedisData   │        │
│   │           │   │View          │   │View        │        │
│   │ - Grid    │   │ - Tree View  │   │ - Key List │        │
│   │ - Inline  │   │ - Table View │   │ - Type     │        │
│   │   edit    │   │ - JSON View  │   │   Views    │        │
│   │ - ER Diag │   │ - Aggregation│   │ - TTL      │        │
│   └───────────┘   └──────────────┘   └────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
packages/desktop-ui/src/
├── components/
│   ├── DataView/                          # NEW: Unified entry point
│   │   ├── index.ts
│   │   ├── DataView.tsx                   # Router component
│   │   └── types.ts                       # Shared types
│   │
│   ├── SqlDataView/                       # RENAME from TableView
│   │   ├── index.ts
│   │   ├── SqlDataView.tsx                # Main SQL table grid
│   │   ├── SqlToolbar.tsx                 # SQL-specific toolbar
│   │   ├── FilterBuilder.tsx              # Keep existing
│   │   ├── FilterChips.tsx
│   │   ├── TableMetadataPanel.tsx
│   │   ├── InsertRowModal.tsx
│   │   ├── ExportDataDialog.tsx
│   │   ├── ImportDataDialog.tsx
│   │   └── ... (other existing components)
│   │
│   ├── DocumentDataView/                  # NEW: MongoDB, Elasticsearch, Cassandra
│   │   ├── index.ts
│   │   ├── DocumentDataView.tsx           # Main document viewer
│   │   ├── DocumentToolbar.tsx            # Document-specific actions
│   │   ├── DocumentList.tsx               # Left panel: document list
│   │   ├── DocumentViewer.tsx             # Right panel: selected document
│   │   ├── views/
│   │   │   ├── TreeView.tsx               # Hierarchical JSON tree
│   │   │   ├── TableView.tsx              # Flattened table view
│   │   │   └── JsonView.tsx               # Raw JSON editor
│   │   ├── components/
│   │   │   ├── TreeNode.tsx               # Expandable tree node
│   │   │   ├── ValueEditor.tsx            # Inline value editor
│   │   │   ├── ArrayBadge.tsx             # Shows array length
│   │   │   ├── ObjectBadge.tsx            # Shows object keys count
│   │   │   └── TypeIndicator.tsx          # Shows value type
│   │   ├── DocumentFilter.tsx             # MongoDB/ES query builder
│   │   ├── AggregationBuilder.tsx         # MongoDB aggregation pipeline
│   │   ├── InsertDocumentModal.tsx        # Create new document
│   │   └── types.ts
│   │
│   ├── RedisDataView/                     # EXISTING: Already separate
│   │   └── ... (keep as-is, enhance later)
│   │
│   └── Sidebar/
│       ├── Sidebar.tsx                    # UPDATE: Adapt terminology
│       └── types.ts                       # NEW: Terminology config
│
├── hooks/                                 # NEW: Shared hooks
│   ├── useDbType.ts                       # DB type detection
│   ├── useDocumentNavigation.ts           # Tree expand/collapse state
│   └── useInlineEdit.ts                   # Shared editing logic
│
└── utils/
    ├── dbTypeUtils.ts                     # NEW: DB type helpers
    └── documentUtils.ts                   # NEW: JSON/document helpers
```

---

## Implementation Phases

### Phase 1: Foundation ✅ (Complete)
- [x] Create `DataView` router component
- [x] Create `useDbType` hook
- [x] Create `dbTypeUtils.ts` utilities
- [x] Create basic `DocumentDataView` shell with tree/table/JSON views
- [x] Update `App.tsx` to use new DataView router
- [ ] Rename `TableView` → `SqlDataView` (optional cleanup, deferred)

### Phase 2: Document Tree View ✅ (Complete)
- [x] Implement `TreeView` component with expand/collapse
- [x] Add `TreeNode` recursive component with memoization
- [x] Implement path-based state management
- [x] Add `TypeIndicator` component for value type badges
- [x] Add `ValueEditor` component for inline editing
- [x] Add expand all / collapse all functionality
- [x] Add copy, edit, delete action buttons on hover

### Phase 3: Document List & Navigation ✅ (Complete)
- [x] Create `DocumentList` with virtualized scrolling (TanStack Virtual)
- [x] Create `DocumentPreview` component with smart field extraction
- [x] Add document search with text highlighting
- [x] Add keyboard navigation (Arrow Up/Down, Enter)
- [x] Add pagination/infinite scroll with auto-load on scroll
- [x] Add document count display with "more available" indicator

### Phase 4: Alternative Views
- [ ] Implement flattened `TableView` for documents
- [ ] Implement `JsonView` (raw JSON editor)
- [ ] Add view mode persistence

### Phase 5: Sidebar Adaptation
- [ ] Add terminology config by DB type
- [ ] Update icons based on DB type
- [ ] Adapt context menu options
- [ ] Show document counts vs row counts

### Phase 6: Query Editors
- [ ] Add MongoDB query/aggregation editor
- [ ] Add Elasticsearch Query DSL editor
- [ ] Integrate with QueryView

### Phase 7: Redis Enhancements
- [ ] Add namespace grouping in sidebar
- [ ] Improve memory visualization
- [ ] Add TTL indicators in list

---

## Type Definitions

### DocumentDataView Types

```typescript
export type DocumentDbType = 'mongodb' | 'elasticsearch' | 'cassandra';

export type ViewMode = 'tree' | 'table' | 'json';

export interface DocumentField {
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object' | 'date' | 'objectId';
  path: string;           // e.g., "address.city" or "orders[0].product"
  depth: number;
  isExpanded?: boolean;
  childCount?: number;    // For arrays/objects
}

export interface Document {
  _id: string;
  _source: Record<string, unknown>;
  _metadata?: {
    index?: string;       // ES index
    score?: number;       // ES relevance score
  };
}

export interface DocumentFilter {
  type: 'simple' | 'query';
  field?: string;
  operator?: 'equals' | 'contains' | 'gt' | 'lt' | 'exists';
  value?: unknown;
  rawQuery?: string;      // MongoDB query JSON or ES Query DSL
}
```

### Sidebar Terminology

```typescript
export interface SidebarTerminology {
  schemaLabel: string;    // "Schema" | "Database" | "Keyspace"
  tableLabel: string;     // "Table" | "Collection" | "Index"
  rowLabel: string;       // "rows" | "docs" | "keys"
  columnLabel: string;    // "Columns" | "Fields"
}

export const SIDEBAR_TERMINOLOGY: Record<DatabaseType, SidebarTerminology> = {
  postgres:      { schemaLabel: 'Schema',   tableLabel: 'Tables',      rowLabel: 'rows', columnLabel: 'Columns' },
  mysql:         { schemaLabel: 'Database', tableLabel: 'Tables',      rowLabel: 'rows', columnLabel: 'Columns' },
  mongodb:       { schemaLabel: 'Database', tableLabel: 'Collections', rowLabel: 'docs', columnLabel: 'Fields' },
  elasticsearch: { schemaLabel: 'Cluster',  tableLabel: 'Indices',     rowLabel: 'docs', columnLabel: 'Mappings' },
  cassandra:     { schemaLabel: 'Keyspace', tableLabel: 'Tables',      rowLabel: 'rows', columnLabel: 'Columns' },
  redis:         { schemaLabel: 'Database', tableLabel: 'Keys',        rowLabel: 'keys', columnLabel: 'Fields' },
};
```

---

## UI Layouts

### SqlDataView (Existing TableView)

```
┌─────────────────────────────────────────────────────────────┐
│ [Filter] [+ Add Row] [Export] [Import] [ER Diagram] [⟳]    │
├─────────────────────────────────────────────────────────────┤
│ id │ name      │ email           │ created_at              │
│────┼───────────┼─────────────────┼─────────────────────────│
│ 1  │ John Doe  │ john@test.com   │ 2024-01-01 10:00:00    │
│ 2  │ Jane Doe  │ jane@test.com   │ 2024-01-02 11:30:00    │
│ 3  │ Bob Smith │ bob@test.com    │ 2024-01-03 09:15:00    │
├─────────────────────────────────────────────────────────────┤
│ Rows 1-100 of 1,234    [◀] [1] [2] [3] ... [▶]             │
└─────────────────────────────────────────────────────────────┘
```

### DocumentDataView (New)

```
┌─────────────────────────────────────────────────────────────┐
│ [🌳Tree] [📊Table] [{}JSON]  [Filter] [+ Insert] [⟳]       │
├──────────────────────┬──────────────────────────────────────┤
│ Documents            │ Document Viewer                      │
│ ──────────────────── │ ────────────────                     │
│ 🔍 Search...         │                                      │
│                      │ ▼ { _id: "507f1f77..." }             │
│ ▸ 507f1f77bcf86...  │   ├─ name: "John Doe"     ✏️         │
│ ▸ 507f191e810c1...  │   ├─ email: "john@x.com"  ✏️         │
│ ▸ 5f8d0f1b2c3a4...  │   ▼ address: { } (3 fields)          │
│                      │     ├─ street: "123 Main St"         │
│                      │     ├─ city: "New York"              │
│                      │     └─ zip: "10001"                  │
│                      │   ▼ orders: [ ] (2 items)            │
│                      │     ├─ [0]: { product: "Widget" }    │
│                      │     └─ [1]: { product: "Gadget" }    │
│ ──────────────────── │                                      │
│ 1-50 of 5,432 docs   │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

### RedisDataView (Existing - Enhanced)

```
┌─────────────────────────────────────────────────────────────┐
│ [Hash] user:*   [+ Add Key] [⟳]         TTL: 3600s  Mem: 2KB│
├──────────────────────┬──────────────────────────────────────┤
│ Keys                 │ Value                                │
│ ──────────────────── │ ────────────────                     │
│ 🔍 Filter keys...    │ ┌─ Hash ────────────────────────────┐│
│                      │ │ name      │ John Doe              ││
│ 📝 user:1           │ │ email     │ john@example.com      ││
│ 📝 user:2           │ │ role      │ admin                 ││
│ 📝 user:3           │ │ created   │ 2024-01-01            ││
│ 📋 user:1:orders    │ └─────────────────────────────────────┘│
│ 🔢 stats:visits     │                                      │
│                      │                                      │
│ ──────────────────── │                                      │
│ 100+ keys            │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

---

## Migration Notes

1. **Non-Breaking**: New components added alongside existing ones
2. **DB Detection**: Uses connectionKey prefix to determine DB type
3. **Gradual Rollout**: Can enable per-database type
4. **Backward Compatible**: SQL databases continue using proven TableView

---

## References

- [MongoDB Compass UI](https://www.mongodb.com/products/tools/compass)
- [Studio 3T View Modes](https://studio3t.com/knowledge-base/articles/table-view/)
- [Redis Insight](https://redis.io/insight/)
- [Elasticvue](https://elasticvue.com/)
- [Data Table UX Best Practices](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)
