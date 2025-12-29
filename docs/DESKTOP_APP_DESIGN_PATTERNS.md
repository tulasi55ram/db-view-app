# Desktop Application Design Patterns & Best Practices

A comprehensive reference guide for building modern, cross-platform desktop applications. This document synthesizes industry best practices, architectural patterns, and implementation guidelines.

---

## Table of Contents

1. [Architecture Patterns](#1-architecture-patterns)
2. [Process Model & IPC](#2-process-model--ipc)
3. [State Management](#3-state-management)
4. [UI/UX Design Principles](#4-uiux-design-principles)
5. [Navigation & Menu Patterns](#5-navigation--menu-patterns)
6. [Security Best Practices](#6-security-best-practices)
7. [Performance Optimization](#7-performance-optimization)
8. [Offline-First & Local Storage](#8-offline-first--local-storage)
9. [Configuration & Settings](#9-configuration--settings)
10. [Window Management](#10-window-management)
11. [Native OS Integration](#11-native-os-integration)
12. [Auto-Update Mechanisms](#12-auto-update-mechanisms)
13. [Error Handling & Logging](#13-error-handling--logging)
14. [Testing Strategies](#14-testing-strategies)
15. [Packaging & Distribution](#15-packaging--distribution)
16. [Keyboard Shortcuts & Accessibility](#16-keyboard-shortcuts--accessibility)
17. [Deep Linking & URL Protocols](#17-deep-linking--url-protocols)
18. [Framework Comparison](#18-framework-comparison)
19. [Implementation Checklist](#19-implementation-checklist)

---

## 1. Architecture Patterns

### 1.1 MVVM (Model-View-ViewModel)

The MVVM pattern decouples application logic from the user interface, making code more testable and maintainable.

```
┌─────────────────────────────────────────────────────────┐
│                         View                             │
│  (UI Components - React/Vue/Svelte)                     │
└─────────────────────┬───────────────────────────────────┘
                      │ Data Binding
┌─────────────────────▼───────────────────────────────────┐
│                     ViewModel                            │
│  (State + Business Logic + UI State Management)         │
└─────────────────────┬───────────────────────────────────┘
                      │ Data Access
┌─────────────────────▼───────────────────────────────────┐
│                       Model                              │
│  (Data Layer - Database, API, File System)              │
└─────────────────────────────────────────────────────────┘
```

**Key Benefits:**
- Clear separation of concerns
- Testable business logic
- Reusable view models across different views
- Decoupled UI from data layer

### 1.2 Layered (N-Tier) Architecture

Organize components into horizontal layers with clearly defined responsibilities:

```
┌─────────────────────────────────────────────────────────┐
│              Presentation Layer                          │
│  (UI Components, Views, User Interaction)               │
├─────────────────────────────────────────────────────────┤
│              Business Logic Layer                        │
│  (Application Rules, Validation, Transformations)       │
├─────────────────────────────────────────────────────────┤
│              Data Access Layer                           │
│  (Database Queries, File I/O, External APIs)            │
└─────────────────────────────────────────────────────────┘
```

**Best Practices:**
- Each layer should only communicate with adjacent layers
- Use interfaces/abstractions between layers for flexibility
- Keep layers loosely coupled for easier testing and maintenance

### 1.3 Event-Driven Architecture

Highly adaptable for dynamic and scalable development environments:

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Producer   │ ───▶ │  Event Bus   │ ───▶ │   Consumer   │
│  (Actions)   │      │   (Queue)    │      │  (Handlers)  │
└──────────────┘      └──────────────┘      └──────────────┘
```

**When to Use:**
- Real-time applications
- Asynchronous data streams
- Complex user interactions
- Decoupled feature modules

### 1.4 Frontend-Backend Separation

Modern desktop apps separate frontend (UI) and backend (system operations):

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Renderer)                   │
│  React/Vue/Angular + HTML/CSS + JavaScript              │
└─────────────────────────┬───────────────────────────────┘
                          │ IPC / Message Passing
┌─────────────────────────▼───────────────────────────────┐
│                    Backend (Main Process)                │
│  Node.js / Rust + Native APIs + System Access           │
└─────────────────────────────────────────────────────────┘
```

**Communication Options:**
- Unix Sockets with gRPC
- Local HTTP Servers with REST API
- JSON over stdin/stdout
- Native IPC mechanisms (Electron ipcMain/ipcRenderer, Tauri invoke)

---

## 2. Process Model & IPC

### 2.1 Multi-Process Architecture

Desktop frameworks like Electron and Tauri use multi-process architectures for security and stability.

#### Electron Process Model

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process                          │
│  - Node.js runtime                                       │
│  - System API access                                     │
│  - Window management                                     │
│  - Application lifecycle                                 │
└─────────────────────┬───────────────────────────────────┘
                      │ IPC (ipcMain ↔ ipcRenderer)
┌─────────────────────▼───────────────────────────────────┐
│               Renderer Processes (per window)            │
│  - Chromium browser context                              │
│  - UI rendering                                          │
│  - Isolated from system resources                        │
└─────────────────────────────────────────────────────────┘
```

#### Tauri Process Model

```
┌─────────────────────────────────────────────────────────┐
│                 Core Process (Rust)                      │
│  - Native system APIs                                    │
│  - Command handlers (#[tauri::command])                  │
│  - Security enforcement                                  │
└─────────────────────┬───────────────────────────────────┘
                      │ invoke() / Events
┌─────────────────────▼───────────────────────────────────┐
│              WebView (OS Native)                         │
│  - WKWebView (macOS), WebView2 (Windows)                │
│  - Web frontend (any JS framework)                       │
└─────────────────────────────────────────────────────────┘
```

### 2.2 IPC Patterns

#### Pattern 1: Request-Response (Invoke Pattern)

```typescript
// Renderer (Frontend)
const result = await invoke('get_user', { userId: 123 });

// Main Process (Backend)
#[tauri::command]
fn get_user(user_id: i32) -> User {
    database.find_user(user_id)
}
```

#### Pattern 2: Event Broadcasting

```typescript
// Main Process - Emit event
mainWindow.webContents.send('notification', { message: 'Update available' });

// Renderer - Listen for events
ipcRenderer.on('notification', (event, data) => {
    showNotification(data.message);
});
```

#### Pattern 3: Two-Way Channel

```typescript
// Establish persistent channel for streaming data
const channel = new MessageChannel();
ipcRenderer.postMessage('subscribe-logs', null, [channel.port2]);
channel.port1.onmessage = (event) => {
    appendLog(event.data);
};
```

### 2.3 IPC Security Best Practices

1. **Never expose full ipcRenderer API** - Create a limited preload bridge
2. **Validate all incoming messages** - Sanitize data from renderer
3. **Use context isolation** - Separate preload scripts from renderer context
4. **Whitelist allowed channels** - Only expose necessary IPC channels

```typescript
// Secure preload script example
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Only expose specific, validated methods
    fetchTableData: (tableName: string) => {
        if (!isValidTableName(tableName)) throw new Error('Invalid table');
        return ipcRenderer.invoke('db:fetch-table', tableName);
    },
    onNotification: (callback: Function) => {
        ipcRenderer.on('notification', (_, data) => callback(data));
    }
});
```

---

## 3. State Management

### 3.1 State Management Patterns

#### Centralized Store Pattern

A single source of truth for application state:

```typescript
// Store structure
interface AppState {
    user: UserState;
    connections: ConnectionState;
    ui: UIState;
    settings: SettingsState;
}

// Actions modify state through reducers/mutations
dispatch({ type: 'CONNECTION_ADDED', payload: newConnection });
```

**When to Use:**
- Multiple components need access to the same state
- State changes need to be tracked/debugged
- Complex state transitions

#### Observable/Publish-Subscribe Pattern

```typescript
class StateStore {
    private subscribers: Map<string, Set<Function>> = new Map();

    subscribe(key: string, callback: Function) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        this.subscribers.get(key).add(callback);
    }

    notify(key: string, value: any) {
        this.subscribers.get(key)?.forEach(cb => cb(value));
    }
}
```

### 3.2 State Categories

| Type | Description | Storage | Example |
|------|-------------|---------|---------|
| **UI State** | Transient, view-specific | Memory | Modal open/closed, selected tab |
| **Application State** | Shared across components | Memory + Persistence | Current user, active connection |
| **Server State** | Data from external sources | Cache + Memory | Database query results |
| **Persistent State** | Survives app restart | File/DB | User preferences, saved connections |

### 3.3 Best Practices

1. **Lift state up** - Move shared state to common ancestors
2. **Colocate state** - Keep state close to where it's used when possible
3. **Normalize complex state** - Avoid deeply nested structures
4. **Separate concerns** - Don't mix UI state with domain data
5. **Use immutable updates** - Prevent accidental mutations

---

## 4. UI/UX Design Principles

### 4.1 Core Principles for 2025

#### Simplicity & Minimalism
- Prioritize essential content
- Remove unnecessary elements
- One primary action per screen/context

#### Clarity & Intuition
- Users should never have to stop and think
- Clear visual hierarchy
- Consistent patterns throughout the app

#### Responsive Design
- Adapt to different window sizes
- Support multiple monitor setups
- Handle window resizing gracefully

### 4.2 Visual Design Guidelines

```
┌─────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────┐   │
│  │  Primary Action Area (Most Important)           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────┐  ┌───────────────────────────┐   │
│  │ Secondary        │  │ Content Area              │   │
│  │ Navigation       │  │                           │   │
│  │                  │  │                           │   │
│  │                  │  │                           │   │
│  └──────────────────┘  └───────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Status Bar / Footer (Contextual Info)          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Microinteractions

Subtle animations and feedback that enhance user experience:

- **Hover states** - Visual feedback on interactive elements
- **Loading indicators** - Progress feedback for async operations
- **Transition animations** - Smooth state changes
- **Success/Error feedback** - Clear outcome indicators

### 4.4 Accessibility Considerations

- **Color contrast** - Meet WCAG 2.1 AA standards (4.5:1 for text)
- **Focus indicators** - Visible keyboard focus states
- **Screen reader support** - Proper ARIA labels
- **Keyboard navigation** - Full app usability without mouse

---

## 5. Navigation & Menu Patterns

### 5.1 Desktop Navigation Patterns

#### Vertical Sidebar Navigation

Best for applications with many sections or complex hierarchies:

```
┌─────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌───────────────────────────────────────┐ │
│ │ 📊 DB    │ │                                       │ │
│ │ 📁 Files │ │        Main Content Area              │ │
│ │ ⚙️ Config │ │                                       │ │
│ │          │ │                                       │ │
│ │ ───────  │ │                                       │ │
│ │ 👤 User  │ │                                       │ │
│ │ ❓ Help  │ │                                       │ │
│ └──────────┘ └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Guidelines:**
- Place on left side (users have left-side visual attention)
- Keep visible - don't hide in hamburger menus on desktop
- Use icons + labels for clarity
- Highlight current location

#### Horizontal Tab Navigation

Best for content that can be categorized into sections:

```
┌─────────────────────────────────────────────────────────┐
│ ┌──────────┬──────────┬──────────┬──────────┐          │
│ │ Overview │ Settings │ Security │ Advanced │          │
│ └──────────┴──────────┴──────────┴──────────┘          │
│ ┌───────────────────────────────────────────────────┐  │
│ │                                                   │  │
│ │              Tab Content Area                     │  │
│ │                                                   │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Menu Design Best Practices

1. **Visibility is key** - Never hide navigation on desktop
2. **Limit submenu depth** - Maximum 2-3 levels
3. **6-item rule** - Keep submenus to ~6 items or fewer
4. **Clear indicators** - Show which items have submenus
5. **Keyboard shortcuts** - Show in menu items
6. **Consistent placement** - Same location across views

### 5.3 Context Menus

```typescript
// Right-click context menu structure
const contextMenu = [
    { label: 'Open', accelerator: 'Enter', click: handleOpen },
    { type: 'separator' },
    { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: handleCopy },
    { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: handlePaste },
    { type: 'separator' },
    { label: 'Delete', accelerator: 'Delete', click: handleDelete },
    { type: 'separator' },
    { label: 'Properties', click: handleProperties }
];
```

---

## 6. Security Best Practices

### 6.1 OWASP Desktop Top 10 Considerations

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Injection** | SQL, command injection | Parameterized queries, input sanitization |
| **Broken Auth** | Weak credential storage | Use OS keychain/credential manager |
| **Sensitive Data** | Plaintext storage | Encrypt at rest, use secure storage APIs |
| **Insecure Communication** | Plaintext protocols | TLS for all network, validate certificates |
| **Improper Crypto** | Weak algorithms | Use modern crypto (AES-256, RSA-2048+) |
| **Memory Corruption** | Buffer overflows | Use memory-safe languages (Rust), ASLR/DEP |

### 6.2 Principle of Least Privilege

```typescript
// Bad - Full system access
const fs = require('fs');
fs.readFileSync('/etc/passwd');

// Good - Sandboxed file access
const { dialog } = require('electron');
const filePath = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Documents', extensions: ['pdf', 'docx'] }]
});
```

### 6.3 Secure IPC Implementation

```typescript
// Main process - validate all inputs
ipcMain.handle('execute-query', async (event, query: string) => {
    // 1. Validate sender
    if (!validateSender(event.sender)) {
        throw new Error('Unauthorized');
    }

    // 2. Sanitize input
    const sanitizedQuery = sanitizeSQL(query);

    // 3. Execute with least privilege
    return await db.query(sanitizedQuery, { readOnly: true });
});
```

### 6.4 Content Security Policy

```typescript
// Electron BrowserWindow configuration
const mainWindow = new BrowserWindow({
    webPreferences: {
        contextIsolation: true,        // Isolate preload from renderer
        nodeIntegration: false,        // No Node.js in renderer
        sandbox: true,                 // Enable sandboxing
        webSecurity: true,             // Enforce same-origin policy
    }
});
```

### 6.5 Secure Storage

```typescript
// Use OS-provided secure storage
import { safeStorage } from 'electron';

// Encrypt sensitive data
const encrypted = safeStorage.encryptString(password);
store.set('credentials', encrypted.toString('base64'));

// Decrypt when needed
const decrypted = safeStorage.decryptString(
    Buffer.from(store.get('credentials'), 'base64')
);
```

---

## 7. Performance Optimization

### 7.1 Performance Patterns

#### Lazy Loading

Load resources only when needed:

```typescript
// Lazy load heavy modules
const heavyModule = await import('./heavy-feature');

// Lazy load UI components
const DataGrid = lazy(() => import('./components/DataGrid'));
```

#### Caching Strategy

```typescript
class QueryCache {
    private cache = new Map<string, { data: any; timestamp: number }>();
    private TTL = 5 * 60 * 1000; // 5 minutes

    async get(key: string, fetcher: () => Promise<any>) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.TTL) {
            return cached.data;
        }
        const data = await fetcher();
        this.cache.set(key, { data, timestamp: Date.now() });
        return data;
    }
}
```

#### Virtual Scrolling

For large lists/tables:

```typescript
// Only render visible rows
const visibleRows = data.slice(
    scrollTop / rowHeight,
    (scrollTop + containerHeight) / rowHeight + buffer
);
```

### 7.2 Memory Management

```typescript
// Clean up resources
class ConnectionManager {
    private connections = new Map<string, Connection>();

    dispose(id: string) {
        const conn = this.connections.get(id);
        if (conn) {
            conn.close();
            this.connections.delete(id);
        }
    }

    disposeAll() {
        this.connections.forEach((conn, id) => this.dispose(id));
    }
}

// Clean up on window close
window.addEventListener('beforeunload', () => {
    connectionManager.disposeAll();
});
```

### 7.3 Async Operations

```typescript
// Use Web Workers for CPU-intensive tasks
const worker = new Worker('./data-processor.worker.js');

worker.postMessage({ type: 'PROCESS', data: largeDataset });

worker.onmessage = (event) => {
    const processedData = event.data;
    updateUI(processedData);
};
```

### 7.4 Performance Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Startup Time** | < 1 second | Time from launch to interactive |
| **Memory Usage** | < 200MB idle | Task manager monitoring |
| **UI Response** | < 100ms | User interaction to visual feedback |
| **Query Time** | < 500ms | Database query to result display |

---

## 8. Offline-First & Local Storage

### 8.1 Offline-First Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User Interface                       │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                   Local Database                         │
│  (SQLite / IndexedDB / LevelDB)                         │
│  - Primary source of truth                              │
│  - Immediate reads/writes                               │
└─────────────────────────┬───────────────────────────────┘
                          │ Background Sync
┌─────────────────────────▼───────────────────────────────┐
│                   Remote Server                          │
│  (Cloud Database / API)                                 │
│  - Eventual consistency                                 │
│  - Conflict resolution                                  │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Local Database Options

| Database | Use Case | Pros | Cons |
|----------|----------|------|------|
| **SQLite** | Structured data, complex queries | SQL support, reliable | Larger footprint |
| **LevelDB** | Key-value storage | Fast, simple | No SQL |
| **IndexedDB** | Browser/web-based apps | Built-in, async | Complex API |
| **Realm** | Mobile + Desktop | Easy sync | Proprietary |

### 8.3 Sync Strategies

#### Pull-Based Sync

```typescript
// On demand or navigation-based
async function loadData(screen: string) {
    // 1. Show cached data immediately
    const cached = await localDb.get(screen);
    renderUI(cached);

    // 2. Fetch fresh data in background
    try {
        const fresh = await api.fetch(screen);
        await localDb.put(screen, fresh);
        renderUI(fresh);
    } catch (error) {
        // Still have cached data
        console.log('Offline, using cached data');
    }
}
```

#### Push-Based Sync

```typescript
// Server pushes updates via WebSocket/SSE
socket.on('data-update', async (update) => {
    await localDb.merge(update);
    notifyUI('Data updated');
});
```

### 8.4 Conflict Resolution

| Strategy | Description | Use When |
|----------|-------------|----------|
| **Last Write Wins** | Latest timestamp wins | Simple cases, single-user |
| **First Write Wins** | Original change preserved | Preserving initial input |
| **Merge** | Combine changes | Non-conflicting fields |
| **Manual Resolution** | User decides | Critical data |

---

## 9. Configuration & Settings

### 9.1 Settings Storage Patterns

#### Platform-Specific Locations

| Platform | User Settings | App Settings |
|----------|---------------|--------------|
| **Windows** | `%APPDATA%\AppName` | `%LOCALAPPDATA%\AppName` |
| **macOS** | `~/Library/Preferences` | `~/Library/Application Support/AppName` |
| **Linux** | `~/.config/appname` | Follow XDG Base Directory Spec |

### 9.2 Settings Architecture

```typescript
interface AppSettings {
    // Application-scoped (read-only for users)
    app: {
        version: string;
        updateChannel: 'stable' | 'beta';
    };

    // User-scoped (customizable)
    user: {
        theme: 'light' | 'dark' | 'system';
        language: string;
        recentConnections: string[];
    };

    // Window-scoped (per-window state)
    window: {
        bounds: { x: number; y: number; width: number; height: number };
        isMaximized: boolean;
    };
}
```

### 9.3 Settings Manager Implementation

```typescript
class SettingsStore {
    private path: string;
    private cache: AppSettings;

    constructor(appName: string) {
        this.path = path.join(app.getPath('userData'), 'settings.json');
        this.cache = this.load();
    }

    private load(): AppSettings {
        try {
            return JSON.parse(fs.readFileSync(this.path, 'utf-8'));
        } catch {
            return this.getDefaults();
        }
    }

    get<K extends keyof AppSettings>(key: K): AppSettings[K] {
        return this.cache[key];
    }

    set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
        this.cache[key] = value;
        fs.writeFileSync(this.path, JSON.stringify(this.cache, null, 2));
    }
}
```

### 9.4 Best Practices

1. **Never store secrets in plain text** - Use OS keychain/credential manager
2. **Provide defaults** - App should work without settings file
3. **Validate on load** - Handle corrupted/malformed settings
4. **Support migration** - Handle settings from older app versions
5. **Roaming vs Local** - Decide what syncs across devices

---

## 10. Window Management

### 10.1 Multi-Window Architecture

```typescript
class WindowManager {
    private windows = new Map<string, BrowserWindow>();

    create(id: string, options: WindowOptions): BrowserWindow {
        const window = new BrowserWindow({
            ...options,
            webPreferences: {
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js'),
            }
        });

        this.windows.set(id, window);

        window.on('closed', () => {
            this.windows.delete(id);
        });

        return window;
    }

    get(id: string): BrowserWindow | undefined {
        return this.windows.get(id);
    }

    focus(id: string) {
        const window = this.windows.get(id);
        if (window) {
            if (window.isMinimized()) window.restore();
            window.focus();
        }
    }
}
```

### 10.2 Window State Persistence

```typescript
class WindowStateManager {
    private state: WindowState;
    private stateFile: string;

    restore(window: BrowserWindow) {
        const state = this.load();

        // Validate bounds are on a visible display
        const validBounds = this.validateBounds(state.bounds);

        window.setBounds(validBounds);
        if (state.isMaximized) window.maximize();
    }

    track(window: BrowserWindow) {
        const saveState = () => {
            if (!window.isMaximized() && !window.isMinimized()) {
                this.state.bounds = window.getBounds();
            }
            this.state.isMaximized = window.isMaximized();
            this.save();
        };

        window.on('resize', saveState);
        window.on('move', saveState);
        window.on('close', saveState);
    }
}
```

### 10.3 Window Types

| Type | Use Case | Characteristics |
|------|----------|-----------------|
| **Main Window** | Primary app interface | Single instance, always present |
| **Modal Dialog** | Blocking user input | Parent-child relationship |
| **Tool Window** | Floating panels | Always-on-top option |
| **Child Window** | Secondary views | Independent but related |

---

## 11. Native OS Integration

### 11.1 System Tray

```typescript
class TrayManager {
    private tray: Tray;

    init() {
        this.tray = new Tray(nativeImage.createFromPath('icon.png'));

        const contextMenu = Menu.buildFromTemplate([
            { label: 'Show App', click: () => mainWindow.show() },
            { label: 'Quick Connect', submenu: this.getRecentConnections() },
            { type: 'separator' },
            { label: 'Quit', click: () => app.quit() }
        ]);

        this.tray.setToolTip('DB View');
        this.tray.setContextMenu(contextMenu);

        this.tray.on('click', () => {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        });
    }
}
```

### 11.2 Native Notifications

```typescript
function showNotification(title: string, body: string, options?: NotificationOptions) {
    if (Notification.isSupported()) {
        new Notification({
            title,
            body,
            icon: path.join(__dirname, 'icon.png'),
            silent: options?.silent ?? false,
        }).show();
    }
}

// Usage
showNotification('Query Complete', 'Exported 1,234 rows to CSV');
```

### 11.3 File Associations

```yaml
# electron-builder.yml
fileAssociations:
  - ext: dbview
    name: DB View Connection
    description: Database connection file
    mimeType: application/x-dbview
    role: Editor
```

```typescript
// Handle file open
app.on('open-file', (event, filePath) => {
    event.preventDefault();
    handleConnectionFile(filePath);
});
```

### 11.4 Dock/Taskbar Integration

```typescript
// macOS Dock
app.dock.setBadge('3'); // Show notification count
app.dock.setIcon(nativeImage.createFromPath('icon.png'));

// Windows Taskbar
mainWindow.setProgressBar(0.5); // Show progress
mainWindow.flashFrame(true);    // Flash for attention
```

---

## 12. Auto-Update Mechanisms

### 12.1 Update Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application                           │
│  1. Check for updates (on start or interval)            │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTP Request
┌─────────────────────────▼───────────────────────────────┐
│               Update Server / CDN                        │
│  - latest.yml / update.json                             │
│  - Full installer or delta packages                     │
└─────────────────────────┬───────────────────────────────┘
                          │ Download
┌─────────────────────────▼───────────────────────────────┐
│              Local Update Cache                          │
│  - Verify signature                                     │
│  - Install on quit or restart                           │
└─────────────────────────────────────────────────────────┘
```

### 12.2 Update Strategies

| Strategy | Description | User Experience |
|----------|-------------|-----------------|
| **Silent Background** | Download + install on quit | Seamless, no interruption |
| **Notify + Prompt** | Alert user, they choose when | User control, may delay |
| **Forced Update** | Must update to continue | Security critical only |
| **Delta Updates** | Only download changes | Faster, less bandwidth |

### 12.3 Implementation (electron-updater)

```typescript
import { autoUpdater } from 'electron-updater';

class UpdateManager {
    init() {
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;

        autoUpdater.on('update-available', (info) => {
            dialog.showMessageBox({
                type: 'info',
                title: 'Update Available',
                message: `Version ${info.version} is available. Download now?`,
                buttons: ['Yes', 'Later']
            }).then((result) => {
                if (result.response === 0) {
                    autoUpdater.downloadUpdate();
                }
            });
        });

        autoUpdater.on('update-downloaded', () => {
            dialog.showMessageBox({
                type: 'info',
                title: 'Update Ready',
                message: 'Restart now to apply the update?',
                buttons: ['Restart', 'Later']
            }).then((result) => {
                if (result.response === 0) {
                    autoUpdater.quitAndInstall();
                }
            });
        });
    }

    checkForUpdates() {
        autoUpdater.checkForUpdates();
    }
}
```

### 12.4 Update Server Options

- **GitHub Releases** - Free, integrated with CI/CD
- **AWS S3 / CloudFront** - Scalable, pay-per-use
- **Custom Server** - Full control, additional maintenance
- **Electron Forge Publishers** - Snapcraft, Mac App Store

---

## 13. Error Handling & Logging

### 13.1 Log Levels

| Level | Use Case | Example |
|-------|----------|---------|
| **FATAL** | Catastrophic failures | App crash, data corruption |
| **ERROR** | Recoverable errors | Failed query, network timeout |
| **WARN** | Potential issues | Deprecated feature used |
| **INFO** | Significant events | Connection established |
| **DEBUG** | Detailed diagnostics | Query parameters, timing |

### 13.2 Logging Architecture

```typescript
class Logger {
    private transports: LogTransport[] = [];

    constructor() {
        // Console output for development
        if (isDev) {
            this.transports.push(new ConsoleTransport());
        }

        // File logging for production
        this.transports.push(new FileTransport({
            path: path.join(app.getPath('logs'), 'app.log'),
            maxSize: '10M',
            maxFiles: 5
        }));

        // Remote logging for crash reports
        this.transports.push(new RemoteTransport({
            endpoint: 'https://logs.example.com/api/logs'
        }));
    }

    log(level: LogLevel, message: string, context?: object) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...context
        };

        this.transports.forEach(t => t.write(entry));
    }
}
```

### 13.3 Structured Logging

```typescript
// Good - Structured, searchable
logger.info('Query executed', {
    query: 'SELECT * FROM users',
    duration: 123,
    rowCount: 50,
    connectionId: 'conn-123'
});

// Bad - Unstructured
logger.info(`Query SELECT * FROM users took 123ms and returned 50 rows`);
```

### 13.4 Error Boundaries

```typescript
// React Error Boundary
class ErrorBoundary extends React.Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        logger.error('React error boundary caught error', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack
        });
    }

    render() {
        if (this.state.hasError) {
            return <ErrorFallback error={this.state.error} />;
        }
        return this.props.children;
    }
}
```

### 13.5 Crash Reporting

```typescript
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught exception', { error: error.stack });
    // Attempt to save any pending work
    saveRecoveryData();
    // Notify user
    dialog.showErrorBox('Application Error',
        'An unexpected error occurred. The application will restart.');
    app.relaunch();
    app.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', { reason });
});
```

---

## 14. Testing Strategies

### 14.1 Testing Pyramid

```
         ╱╲
        ╱  ╲     E2E Tests (5-10%)
       ╱────╲    - Critical user journeys
      ╱      ╲   - Full application flow
     ╱────────╲
    ╱          ╲ Integration Tests (15-20%)
   ╱────────────╲ - Component interaction
  ╱              ╲ - IPC communication
 ╱────────────────╲
╱                  ╲ Unit Tests (70-80%)
╱────────────────────╲ - Individual functions
                       - Isolated components
```

### 14.2 Unit Testing

```typescript
// Test utility functions
describe('QueryParser', () => {
    it('should extract table names from SELECT', () => {
        const query = 'SELECT * FROM users JOIN orders ON users.id = orders.user_id';
        const tables = extractTables(query);
        expect(tables).toEqual(['users', 'orders']);
    });

    it('should handle malformed queries', () => {
        expect(() => extractTables('SELEC * FORM users')).not.toThrow();
    });
});
```

### 14.3 Integration Testing

```typescript
// Test IPC communication
describe('Database IPC', () => {
    let mainProcess: ElectronApplication;

    beforeAll(async () => {
        mainProcess = await electron.launch({ args: ['.'] });
    });

    it('should execute queries via IPC', async () => {
        const window = await mainProcess.firstWindow();
        const result = await window.evaluate(async () => {
            return await window.api.executeQuery('SELECT 1 as test');
        });
        expect(result.rows[0].test).toBe(1);
    });
});
```

### 14.4 E2E Testing

```typescript
// Using Playwright
describe('Connection Flow', () => {
    let app: ElectronApplication;
    let page: Page;

    beforeAll(async () => {
        app = await electron.launch({ args: ['dist/main.js'] });
        page = await app.firstWindow();
    });

    it('should connect to database and show tables', async () => {
        // Fill connection form
        await page.fill('[data-testid="host-input"]', 'localhost');
        await page.fill('[data-testid="database-input"]', 'testdb');
        await page.click('[data-testid="connect-button"]');

        // Wait for table list
        await expect(page.locator('[data-testid="table-list"]')).toBeVisible();

        // Verify tables loaded
        const tables = await page.locator('[data-testid="table-item"]').count();
        expect(tables).toBeGreaterThan(0);
    });
});
```

### 14.5 Testing Tools

| Tool | Purpose | Use Case |
|------|---------|----------|
| **Jest** | Unit testing | Functions, utilities |
| **Vitest** | Unit testing (Vite) | Fast, ESM-native |
| **Playwright** | E2E testing | Full app automation |
| **Spectron** | Electron testing | Legacy Electron apps |
| **Testing Library** | Component testing | React/Vue components |

---

## 15. Packaging & Distribution

### 15.1 Build Targets

| Platform | Formats | Tool |
|----------|---------|------|
| **Windows** | NSIS, MSI, Portable, AppX | electron-builder |
| **macOS** | DMG, PKG, Mac App Store | electron-builder |
| **Linux** | AppImage, DEB, RPM, Snap, Flatpak | electron-builder |

### 15.2 electron-builder Configuration

```yaml
# electron-builder.yml
appId: com.example.dbview
productName: DB View
directories:
  output: dist
  buildResources: build

files:
  - "dist/**/*"
  - "package.json"

mac:
  category: public.app-category.developer-tools
  icon: build/icon.icns
  hardenedRuntime: true
  entitlements: build/entitlements.mac.plist
  target:
    - dmg
    - zip

win:
  icon: build/icon.ico
  target:
    - nsis
    - portable

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true

linux:
  icon: build/icons
  category: Development
  target:
    - AppImage
    - deb
    - rpm

publish:
  provider: github
  owner: your-org
  repo: db-view
```

### 15.3 Code Signing

```yaml
# macOS Code Signing
mac:
  identity: "Developer ID Application: Your Company (TEAMID)"
  notarize:
    teamId: TEAMID

# Windows Code Signing (via environment)
win:
  certificateFile: ${env.WIN_CSC_LINK}
  certificatePassword: ${env.WIN_CSC_KEY_PASSWORD}
```

### 15.4 CI/CD Pipeline

```yaml
# GitHub Actions workflow
name: Build & Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm run build

      - name: Package
        run: pnpm run package
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: dist/*.{dmg,exe,AppImage,deb}
```

---

## 16. Keyboard Shortcuts & Accessibility

### 16.1 Standard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| New | Ctrl+N | Cmd+N |
| Open | Ctrl+O | Cmd+O |
| Save | Ctrl+S | Cmd+S |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Y | Cmd+Shift+Z |
| Cut | Ctrl+X | Cmd+X |
| Copy | Ctrl+C | Cmd+C |
| Paste | Ctrl+V | Cmd+V |
| Find | Ctrl+F | Cmd+F |
| Settings | Ctrl+, | Cmd+, |
| Quit | Alt+F4 | Cmd+Q |

### 16.2 Custom Shortcuts Implementation

```typescript
// Global shortcuts
globalShortcut.register('CommandOrControl+Shift+D', () => {
    openDevTools();
});

// Menu shortcuts
const menu = Menu.buildFromTemplate([
    {
        label: 'Query',
        submenu: [
            {
                label: 'Execute Query',
                accelerator: 'F5',
                click: () => executeQuery()
            },
            {
                label: 'Format SQL',
                accelerator: 'CommandOrControl+Shift+F',
                click: () => formatSQL()
            }
        ]
    }
]);
```

### 16.3 Accessibility Checklist

- [ ] **Keyboard Navigation** - All features accessible via keyboard
- [ ] **Focus Indicators** - Visible focus states on all interactive elements
- [ ] **Screen Reader Support** - Proper ARIA labels and roles
- [ ] **Color Contrast** - 4.5:1 ratio for normal text
- [ ] **Text Scaling** - UI adapts to system font size settings
- [ ] **Motion Sensitivity** - Reduce/disable animations option
- [ ] **Error Identification** - Errors identified by more than color alone

### 16.4 ARIA Implementation

```tsx
// Accessible table implementation
<table role="grid" aria-label="Query Results">
    <thead>
        <tr role="row">
            {columns.map(col => (
                <th
                    role="columnheader"
                    aria-sort={sortColumn === col ? sortDirection : 'none'}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleSort(col)}
                >
                    {col.name}
                </th>
            ))}
        </tr>
    </thead>
    <tbody>
        {rows.map((row, i) => (
            <tr role="row" aria-rowindex={i + 1}>
                {columns.map((col, j) => (
                    <td
                        role="gridcell"
                        aria-colindex={j + 1}
                        tabIndex={-1}
                    >
                        {row[col.name]}
                    </td>
                ))}
            </tr>
        ))}
    </tbody>
</table>
```

---

## 17. Deep Linking & URL Protocols

### 17.1 Custom Protocol Registration

```typescript
// Register protocol handler
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('dbview', process.execPath, [
            path.resolve(process.argv[1])
        ]);
    }
} else {
    app.setAsDefaultProtocolClient('dbview');
}

// Handle protocol URLs
app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
});

// Windows: Handle in single instance lock
app.on('second-instance', (event, argv) => {
    const url = argv.find(arg => arg.startsWith('dbview://'));
    if (url) handleDeepLink(url);
});
```

### 17.2 URL Schema Design

```
dbview://action/resource?params

Examples:
dbview://connect?host=localhost&database=mydb
dbview://query?sql=SELECT%20*%20FROM%20users
dbview://table/users?schema=public
dbview://export?table=orders&format=csv
```

### 17.3 Security Considerations

```typescript
function handleDeepLink(url: string) {
    const parsed = new URL(url);

    // Validate protocol
    if (parsed.protocol !== 'dbview:') return;

    // Validate and sanitize action
    const allowedActions = ['connect', 'query', 'table', 'export'];
    const action = parsed.pathname.replace(/^\/+/, '');

    if (!allowedActions.includes(action)) {
        logger.warn('Invalid deep link action', { url });
        return;
    }

    // Confirm with user for sensitive actions
    if (action === 'connect') {
        const confirmed = await dialog.showMessageBox({
            type: 'question',
            message: 'An external application wants to open a database connection. Allow?',
            buttons: ['Allow', 'Deny']
        });

        if (confirmed.response !== 0) return;
    }

    // Handle action
    executeAction(action, Object.fromEntries(parsed.searchParams));
}
```

---

## 18. Framework Comparison

### 18.1 Overview

| Framework | Language | Binary Size | Memory | Best For |
|-----------|----------|-------------|--------|----------|
| **Electron** | JS/TS + Node | 100MB+ | 200-300MB | Feature-rich apps, VS Code-like |
| **Tauri** | JS/TS + Rust | 3-10MB | 30-50MB | Lightweight tools, security-focused |
| **Flutter** | Dart | 15-30MB | 100-150MB | Custom UI, mobile + desktop |

### 18.2 Electron

**Pros:**
- Massive ecosystem (npm)
- Node.js integration
- Consistent cross-platform rendering (Chromium)
- Proven at scale (VS Code, Slack, Discord)

**Cons:**
- Large binary size
- High memory usage
- Security requires careful configuration

**Best For:**
- Complex feature-rich applications
- Apps requiring extensive Node.js packages
- When consistent rendering is critical

### 18.3 Tauri

**Pros:**
- Tiny binary size
- Low memory footprint
- Rust backend (performance, security)
- Security-first design

**Cons:**
- WebView inconsistencies across platforms
- Smaller ecosystem
- Rust learning curve

**Best For:**
- Lightweight utilities
- Security-sensitive applications
- When performance matters

### 18.4 Flutter

**Pros:**
- Single codebase for mobile + desktop
- Custom rendering (no WebView)
- Hot reload development
- Google backing

**Cons:**
- Dart language (less common)
- Larger apps than Tauri
- Desktop support newer

**Best For:**
- Cross-platform (including mobile)
- Highly custom UI designs
- Consistent look across all platforms

---

## 19. Implementation Checklist

### 19.1 Project Setup

- [ ] Choose framework (Electron/Tauri/Flutter)
- [ ] Set up build tooling (Vite, webpack, etc.)
- [ ] Configure TypeScript/linting
- [ ] Set up testing framework
- [ ] Configure CI/CD pipeline

### 19.2 Architecture

- [ ] Define process model (main/renderer separation)
- [ ] Design IPC communication layer
- [ ] Plan state management approach
- [ ] Design data persistence layer
- [ ] Define error handling strategy

### 19.3 Security

- [ ] Enable context isolation
- [ ] Implement secure IPC
- [ ] Use OS credential storage
- [ ] Configure Content Security Policy
- [ ] Implement input validation

### 19.4 User Experience

- [ ] Design navigation structure
- [ ] Implement keyboard shortcuts
- [ ] Add accessibility features
- [ ] Design settings/preferences UI
- [ ] Implement theme support (light/dark)

### 19.5 Native Integration

- [ ] System tray implementation
- [ ] Native notifications
- [ ] File associations
- [ ] Deep linking / URL protocols
- [ ] Dock/taskbar integration

### 19.6 Distribution

- [ ] Configure build targets (DMG, NSIS, AppImage)
- [ ] Set up code signing
- [ ] Implement auto-updates
- [ ] Create installer assets
- [ ] Plan update server/CDN

### 19.7 Quality

- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Set up error monitoring
- [ ] Configure logging

---

## References & Resources

### Official Documentation

- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [Tauri Documentation](https://v2.tauri.app/)
- [Flutter Desktop](https://docs.flutter.dev/desktop)

### Architecture & Patterns

- [14 Software Architecture Patterns - Red Hat](https://www.redhat.com/en/blog/14-software-architecture-patterns)
- [OWASP Desktop App Security Top 10](https://owasp.org/www-project-desktop-app-security-top-10/)
- [Microsoft Windows App Design](https://learn.microsoft.com/en-us/windows/apps/design/)

### UI/UX Design

- [Nielsen Norman Group - Navigation](https://www.nngroup.com/articles/menu-design/)
- [Material Design Patterns](https://m1.material.io/patterns/navigation.html)
- [Keyboard Accessibility - W3C](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

### Performance & Optimization

- [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Logging Best Practices](https://betterstack.com/community/guides/logging/logging-best-practices/)

### Testing

- [Playwright - Electron Testing](https://playwright.dev/docs/api/class-electron)
- [Testing Library](https://testing-library.com/)

---

*Document Version: 1.0*
*Last Updated: December 2025*
