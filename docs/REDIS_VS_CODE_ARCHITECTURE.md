# Redis View Architecture

> Frontend architecture for Redis data visualization in the VS Code extension.

## Overview

The Redis View provides a split-pane interface for exploring Redis keys and their values, with support for all Redis data types and server-side search capabilities.

---

## Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ VS Code Window                                                       │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                       │
│  Connection  │         Webview Panel (RedisDataView)                │
│  Sidebar     │  ┌─────────────────────────────────────────────────┐ │
│              │  │ Toolbar: [Redis] db0 / keys    [Export][Refresh]│ │
│  (Native     │  ├─────────────────────────────────────────────────┤ │
│   VS Code)   │  │ Type Tabs: [Strings][Hashes][Lists][Sets]...    │ │
│              │  ├────────────┬────────────────────────────────────┤ │
│ ○ Redis Conn │  │            │                                    │ │
│   ├─ Strings │  │  Key List  │     Key Value Viewer               │ │
│   ├─ Hashes  │  │  Sidebar   │                                    │ │
│   ├─ Lists   │  │            │     ┌────────────────────────┐    │ │
│   └─ Sets    │  │ [🔍 search]│     │ Key Info Header        │    │ │
│              │  │            │     │ user:123  STRING       │    │ │
│              │  │ ○ user:1   │     │ TTL: 24h  Memory: 1KB  │    │ │
│              │  │ ○ user:2   │     └────────────────────────┘    │ │
│              │  │ ● user:123 │                                    │ │
│              │  │ ○ user:456 │     ┌────────────────────────┐    │ │
│              │  │            │     │ Type-Specific View     │    │ │
│              │  │ [Load more]│     │ (String/Hash/List...)  │    │ │
│              │  │            │     │                        │    │ │
│              │  │ 100+ keys  │     │ {"name": "John"...}    │    │ │
│              │  └────────────┴─────└────────────────────────┘────┤ │
│              │  Status: Pattern: *user*  |  Redis  |  Read-only   │ │
└──────────────┴──────────────────────────────────────────────────────┘
```

### Two Sidebar System

| Sidebar | Location | Technology | Purpose |
|---------|----------|------------|---------|
| **Connection Sidebar** | VS Code native panel | TypeScript TreeView | Browse connections, open data views |
| **Key List Sidebar** | Inside webview | React component | Browse/search keys, select for viewing |

---

## Component Hierarchy

```
RedisDataView
├── DataViewToolbar          # Top toolbar with actions
├── TypeSelector             # Type filter tabs (String, Hash, etc.)
├── [Split Layout]
│   ├── RedisKeyList         # Left sidebar - key browser
│   │   ├── Search Input     # Pattern-based search
│   │   ├── Key Items        # Scrollable key list
│   │   └── Load More        # Pagination button
│   │
│   └── [Key Viewer]         # Right panel - value display
│       ├── KeyInfoHeader    # Key metadata (TTL, memory, type)
│       └── Type-Specific View
│           ├── RedisStringView
│           ├── RedisHashView
│           ├── RedisListView
│           ├── RedisSetView
│           ├── RedisSortedSetView
│           └── RedisStreamView
│
└── DataViewStatusBar        # Bottom status bar
```

---

## Search Architecture

### Search Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER TYPES IN SEARCH                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    300ms DEBOUNCE TIMER                          │
│                    (prevents excessive queries)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PATTERN GENERATION                             │
│                                                                  │
│   Input: "user"     →  Pattern: "*user*"                        │
│   Input: "user:*"   →  Pattern: "user:*"  (kept as-is)          │
│   Input: "cache:??" →  Pattern: "cache:??" (kept as-is)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              EXTENSION MESSAGE (postMessage)                     │
│                                                                  │
│   {                                                              │
│     type: "SCAN_REDIS_KEYS",                                    │
│     schema: "db0",                                               │
│     pattern: "*user*",                                          │
│     cursor: "0",                                                 │
│     count: 100                                                   │
│   }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTENSION HOST                                │
│                                                                  │
│   Redis SCAN cursor MATCH pattern COUNT 100                     │
│   + TYPE command for each key (parallel)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  RESPONSE TO WEBVIEW                             │
│                                                                  │
│   {                                                              │
│     type: "REDIS_SCAN_RESPONSE",                                │
│     keys: [{key: "user:1", type: "hash"}, ...],                │
│     cursor: "1234",                                             │
│     hasMore: true                                                │
│   }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UI UPDATE                                     │
│                                                                  │
│   - Update key list with results                                │
│   - Show "Load more" if hasMore                                 │
│   - Display pattern in status bar                               │
└─────────────────────────────────────────────────────────────────┘
```

### Search Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Debounced** | Typing | 300ms delay, then auto-search |
| **Immediate** | Press Enter | Instant search, no delay |
| **Clear** | Press Escape or ✕ | Reset to show all keys |

### Pattern Syntax

```
*           Match any characters
?           Match single character
[abc]       Match character class

Examples:
  user:*        All keys starting with "user:"
  *session*     All keys containing "session"
  cache:???     Keys like "cache:abc", "cache:123"
```

---

## Pagination Architecture

### Load More Flow

```
┌──────────────────────────────────────────────┐
│ Initial Load                                  │
│                                              │
│ SCAN cursor=0 COUNT=100                      │
│ Returns: keys[0-99], cursor="4521"           │
│                                              │
│ UI shows: "100+ loaded" [Load more]          │
└──────────────────────────────────────────────┘
                    │
                    │ User clicks "Load more"
                    ▼
┌──────────────────────────────────────────────┐
│ Subsequent Load                               │
│                                              │
│ SCAN cursor=4521 COUNT=100                   │
│ Returns: keys[100-199], cursor="8934"        │
│                                              │
│ UI shows: "200+ loaded" [Load more]          │
└──────────────────────────────────────────────┘
                    │
                    │ Continue until cursor="0"
                    ▼
┌──────────────────────────────────────────────┐
│ Final Load                                    │
│                                              │
│ SCAN cursor=8934 COUNT=100                   │
│ Returns: keys[200-245], cursor="0"           │
│                                              │
│ UI shows: "245 keys" (no Load more)          │
└──────────────────────────────────────────────┘
```

---

## Message Protocol

### Webview → Extension

| Message Type | Purpose | Payload |
|--------------|---------|---------|
| `SCAN_REDIS_KEYS` | Server-side search | pattern, cursor, count, keyType |
| `GET_REDIS_KEY_VALUE` | Fetch key data | key |
| `GET_REDIS_DBSIZE` | Get total key count | schema |
| `LOAD_REDIS_KEYS` | Load keys page | keyType, limit, offset |

### Extension → Webview

| Message Type | Purpose | Payload |
|--------------|---------|---------|
| `REDIS_SCAN_RESPONSE` | Search results | keys[], cursor, hasMore |
| `REDIS_KEY_VALUE_RESPONSE` | Key data | key, data (type-specific) |
| `REDIS_DBSIZE_RESPONSE` | Total count | size |
| `REDIS_ERROR` | Error notification | error message |

---

## Type-Specific Views

Each Redis data type has a dedicated view component:

### String View
```
┌─────────────────────────────────────┐
│ String Value                        │
│ (1,234 characters)       [Copy][↻] │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ {                         [JSON]│ │
│ │   "name": "John Doe",           │ │
│ │   "email": "john@example.com"   │ │
│ │ }                               │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Hash View
```
┌───────────────────┬─────────────────┐
│ Hash Fields (5)   │                 │
├───────────────────┤  Field: name    │
│ [🔍 Search...]    │                 │
├───────────────────┤  ┌───────────┐  │
│ ○ name            │  │ "John"    │  │
│ ● email      [📋] │  └───────────┘  │
│ ○ age             │                 │
│ ○ city            │                 │
└───────────────────┴─────────────────┘
```

### List View
```
┌───────────────────┬─────────────────┐
│ List Items (100)  │                 │
├───────────────────┤  Index: [3]     │
│ [🔍 Search...]    │                 │
├───────────────────┤  ┌───────────┐  │
│ [0] item-a        │  │ "item-d"  │  │
│ [1] item-b        │  └───────────┘  │
│ [2] item-c        │                 │
│ [3] item-d   ●    │                 │
└───────────────────┴─────────────────┘
```

### Sorted Set View
```
┌───────────────────┬─────────────────┐
│ Members (4)  [↕]  │                 │
├───────────────────┤  Score: 100     │
│ [🔍 Search...]    │                 │
├───────────────────┤  ┌───────────┐  │
│ [100] player1  ●  │  │ "player1" │  │
│ [85]  player2     │  └───────────┘  │
│ [72]  player3     │                 │
│ [65]  player4     │                 │
└───────────────────┴─────────────────┘
      ↑ score
```

---

## Value Preview

The `ValuePreview` component auto-detects value format:

```
┌─────────────────────────────────────┐
│ Format Detection                     │
├─────────────────────────────────────┤
│                                     │
│ Starts with { or [  →  Try JSON     │
│         ↓                           │
│ Valid JSON?  →  Yes  →  [JSON] badge│
│         ↓              Syntax color │
│         No             Expand/collapse
│         ↓                           │
│ Has binary chars?  →  [HEX] badge   │
│         ↓              Hex display  │
│         No                          │
│         ↓                           │
│ Plain text  →  [TEXT] badge         │
│                Raw display          │
└─────────────────────────────────────┘
```

---

## State Management

### Key States in RedisDataView

```typescript
// Type Selection
localKeyType          // Currently selected Redis type tab

// Key Selection
selectedKey           // Currently selected key name
selectedKeyData       // Data for selected key (value, TTL, etc.)

// Search
keySearchQuery        // Current search input
searchPattern         // Pattern sent to server
serverSearchLoading   // Search in progress

// Pagination
hasMoreKeys           // More keys available
loadingMore           // Load more in progress

// Metadata
dbSize                // Total keys (from DBSIZE)
```

### Data Flow

```
User Action
    │
    ▼
Local State Update (optimistic)
    │
    ▼
postMessage to Extension
    │
    ▼
Extension processes (Redis commands)
    │
    ▼
Message back to Webview
    │
    ▼
State Update + Re-render
```

---

## File Structure

```
packages/ui/src/components/dataViews/
├── redisView/
│   ├── index.ts              # Exports
│   ├── types.ts              # TypeScript interfaces
│   ├── utils.ts              # Utility functions
│   ├── RedisKeyList.tsx      # Key browser sidebar
│   ├── ValuePreview.tsx      # Smart value display
│   └── views/
│       ├── index.ts
│       ├── RedisStringView.tsx
│       ├── RedisHashView.tsx
│       ├── RedisListView.tsx
│       ├── RedisSetView.tsx
│       ├── RedisSortedSetView.tsx
│       └── RedisStreamView.tsx
│
└── RedisDataView.tsx         # Main container component
```

---

## Performance Optimizations

| Optimization | Description |
|--------------|-------------|
| **Debounced Search** | 300ms delay prevents excessive server queries |
| **Cursor-based Pagination** | Loads keys in batches, not all at once |
| **Lazy Type Loading** | Key types fetched on-demand |
| **Memoized Filtering** | `useMemo` for client-side filtering |
| **Virtual Scrolling Ready** | Component structure supports virtualization |

---

## Comparison: Desktop vs VS Code

| Feature | Desktop UI | VS Code Extension |
|---------|-----------|-------------------|
| Search | Server SCAN + Client filter | Server SCAN (debounced) |
| Hierarchy | Full tree by namespace | Flat list + prefix display |
| Pagination | Cursor + Load more | Load more button |
| Key Types | Color icons | Color icons |
| TTL Display | On hover (lazy) | In header |
| Memory | On hover (lazy) | In header |
