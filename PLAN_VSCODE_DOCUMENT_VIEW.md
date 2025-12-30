# Implementation Plan: VS Code Extension Document View

## Problem Statement

The VS Code extension UI for document databases (MongoDB, Elasticsearch, Cassandra) does not match the desktop app UI. The desktop app has a rich, feature-complete DocumentDataView while the VS Code extension has a basic implementation.

## Current Architecture

```
packages/
├── desktop-ui/              # Desktop app UI (Electron)
│   └── src/components/
│       └── DocumentDataView/
│           ├── DocumentDataView.tsx (1089 lines - RICH)
│           ├── views/
│           │   ├── TreeView.tsx
│           │   ├── TableView.tsx
│           │   └── JsonView.tsx
│           ├── components/
│           │   ├── DocumentList.tsx
│           │   ├── TreeNode.tsx
│           │   ├── QueryFilterBuilder.tsx
│           │   └── ... (12+ components)
│           └── hooks/
│               └── useDocumentOperations.ts
│
└── ui/                      # VS Code extension UI
    └── src/components/
        └── dataViews/
            └── DocumentDataView.tsx (570 lines - BASIC)
```

## Proposed Solution Options

### Option A: Copy Desktop Components to UI Package (Recommended)
**Effort: Medium | Risk: Low**

Copy the desktop-ui DocumentDataView and all its sub-components to packages/ui, adapting the API calls to use VS Code messaging.

**Pros:**
- Full feature parity with desktop
- Maintains separation between packages
- No architectural changes needed

**Cons:**
- Code duplication (can be refactored later into shared package)
- Need to adapt IPC communication

### Option B: Create Shared UI Components Package
**Effort: High | Risk: Medium**

Create a new package `@dbview/shared-ui` that contains all reusable UI components, then have both desktop-ui and ui import from it.

**Pros:**
- No code duplication
- Single source of truth
- Better maintainability long-term

**Cons:**
- Significant refactoring effort
- Need to abstract IPC layer
- May break existing code

### Option C: Import Desktop-UI into UI Package
**Effort: Low | Risk: High**

Make packages/ui depend on packages/desktop-ui and import components directly.

**Pros:**
- Fastest to implement
- No code duplication

**Cons:**
- Circular dependency risk
- Desktop-specific code in VS Code
- Bundle size concerns

---

## Recommended Approach: Option A (Phased)

### Phase 1: Core Document View (MVP)
Copy and adapt the essential components for document display.

**Components to copy:**
1. `DocumentDataView.tsx` (main orchestrator)
2. `views/TreeView.tsx` (hierarchical JSON view)
3. `views/TableView.tsx` (flattened table view)
4. `views/JsonView.tsx` (raw JSON editor)
5. `components/DocumentList.tsx` (virtualized sidebar)
6. `components/DocumentPreview.tsx` (list item)
7. `components/TreeNode.tsx` (recursive tree nodes)
8. `components/TypeIndicator.tsx` (field type badges)
9. `types.ts` (shared types)

**Adaptations needed:**
- Replace `api.loadTableRows()` with `vscode.postMessage({ type: "LOAD_TABLE_ROWS" })`
- Replace `api.updateCell()` with `vscode.postMessage({ type: "UPDATE_CELL" })`
- Handle async responses via `window.addEventListener("message", ...)`

### Phase 2: Editing & CRUD Operations
Add document modification capabilities.

**Components to copy:**
1. `components/ValueEditor.tsx` (inline editing)
2. `components/AddFieldModal.tsx` (add new fields)
3. `components/DeleteDocumentDialog.tsx` (confirm delete)
4. `hooks/useDocumentOperations.ts` (CRUD abstraction)

**Adaptations needed:**
- Create message types for UPDATE_DOCUMENT, DELETE_DOCUMENT, INSERT_DOCUMENT
- Handle response messages for success/error

### Phase 3: Filtering & Search
Add query capabilities.

**Components to copy:**
1. `components/QueryFilterBuilder.tsx` (visual query builder)
2. Filter conversion utilities

**Adaptations needed:**
- Connect filter state to LOAD_TABLE_ROWS message with filters param

### Phase 4: MongoDB-Specific Features (Optional)
Add MongoDB tools if needed.

**Components to copy:**
1. `components/IndexManagementPanel.tsx`
2. `components/AggregationPipelineBuilder.tsx`

**Adaptations needed:**
- Create new message types: GET_INDEXES, CREATE_INDEX, DROP_INDEX, RUN_AGGREGATION
- Add handlers in mainPanel.ts

---

## Implementation Details: Phase 1

### Step 1: Create Directory Structure

```
packages/ui/src/components/DocumentDataView/
├── DocumentDataView.tsx       # Main component
├── types.ts                   # Types & constants
├── views/
│   ├── TreeView.tsx
│   ├── TableView.tsx
│   └── JsonView.tsx
├── components/
│   ├── DocumentList.tsx
│   ├── DocumentPreview.tsx
│   ├── TreeNode.tsx
│   └── TypeIndicator.tsx
└── hooks/
    └── useDocumentApi.ts      # VS Code message abstraction
```

### Step 2: Create VS Code API Abstraction

```typescript
// hooks/useDocumentApi.ts
export function useDocumentApi() {
  const vscode = getVsCodeApi();

  const loadDocuments = useCallback(async (params: LoadParams): Promise<LoadResult> => {
    return new Promise((resolve, reject) => {
      const messageId = generateId();

      const handler = (event: MessageEvent) => {
        if (event.data.messageId === messageId) {
          window.removeEventListener("message", handler);
          if (event.data.error) reject(new Error(event.data.error));
          else resolve(event.data.result);
        }
      };

      window.addEventListener("message", handler);
      vscode?.postMessage({
        type: "LOAD_TABLE_ROWS",
        messageId,
        ...params
      });
    });
  }, [vscode]);

  // Similar for updateDocument, deleteDocument, etc.

  return { loadDocuments, updateDocument, deleteDocument, ... };
}
```

### Step 3: Adapt DocumentDataView

Key changes from desktop-ui version:
1. Replace `const api = useElectronApi()` with `const api = useDocumentApi()`
2. Remove direct Electron IPC calls
3. Use VS Code message passing pattern
4. Simplify where possible (remove features not needed in VS Code)

### Step 4: Update App.tsx

```typescript
// In App.tsx, update the table tab rendering
if (activeTab.type === 'table') {
  if (activeTab.dbType && isDocumentDb(activeTab.dbType)) {
    return (
      <DocumentDataView
        connectionKey={activeTab.connectionName || ''}
        schema={activeTab.schema}
        table={activeTab.table}
        dbType={activeTab.dbType}
      />
    );
  }
  // Fall back to TableView for SQL
  return <TableView ... />;
}
```

### Step 5: Update Extension Message Handlers

Add/update handlers in `mainPanel.ts`:
- Ensure LOAD_TABLE_ROWS works with document databases
- Add TABLE_METADATA handler for document schemas
- Add UPDATE_CELL handler for document updates (path-based)

---

## File Mapping

| Desktop-UI File | VS Code UI Target |
|-----------------|-------------------|
| `DocumentDataView.tsx` | `DocumentDataView/DocumentDataView.tsx` |
| `views/TreeView.tsx` | `DocumentDataView/views/TreeView.tsx` |
| `views/TableView.tsx` | `DocumentDataView/views/TableView.tsx` |
| `views/JsonView.tsx` | `DocumentDataView/views/JsonView.tsx` |
| `components/DocumentList.tsx` | `DocumentDataView/components/DocumentList.tsx` |
| `components/DocumentPreview.tsx` | `DocumentDataView/components/DocumentPreview.tsx` |
| `components/TreeNode.tsx` | `DocumentDataView/components/TreeNode.tsx` |
| `components/TypeIndicator.tsx` | `DocumentDataView/components/TypeIndicator.tsx` |

---

## Estimated Effort

| Phase | Components | Estimated Work |
|-------|------------|----------------|
| Phase 1 (Core) | 9 components | Main implementation |
| Phase 2 (CRUD) | 4 components | Add editing |
| Phase 3 (Filter) | 2 components | Add filtering |
| Phase 4 (MongoDB) | 2 components | Optional features |

---

## Dependencies to Add

```json
// packages/ui/package.json
{
  "dependencies": {
    "@tanstack/react-virtual": "^3.x",  // For virtualized lists
    // Already has: codemirror, @codemirror/lang-json, etc.
  }
}
```

---

## Testing Strategy

1. Open MongoDB collection → Should show DocumentDataView with split pane
2. Switch view modes (Tree/Table/JSON) → Should work correctly
3. Navigate documents → Should highlight and display selected doc
4. Expand/collapse tree nodes → Should work in Tree view
5. Pagination/infinite scroll → Should load more documents
6. Edit field value → Should update and persist (Phase 2)

---

## Questions for User

Before proceeding, please confirm:

1. **Scope**: Do you want all features (Tree/Table/JSON views, document list, filtering) or a subset?
2. **Priority**: Which view mode is most important? (Tree is the most distinctive)
3. **MongoDB features**: Do you need index management and aggregation pipeline builder?
4. **Editing**: Do you need inline editing or read-only is fine for now?
