import Store from "electron-store";
import type { DatabaseConnectionConfig } from "@dbview/core";

// Connection config without password (passwords stored in keytar)
export type StoredConnectionConfig = Omit<DatabaseConnectionConfig, "password">;

interface StoreSchema {
  connections: StoredConnectionConfig[];
  activeConnectionName: string | null;
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  recentSqliteFiles: string[];
  sidebarWidth: number;
  sidebarVisible: boolean;
}

// Lazy-initialized store (electron-store requires app.getPath which isn't available at module load)
let _store: Store<StoreSchema> | null = null;

function getStore(): Store<StoreSchema> {
  if (!_store) {
    _store = new Store<StoreSchema>({
      name: "dbview-settings",
      defaults: {
        connections: [],
        activeConnectionName: null,
        windowBounds: {
          width: 1400,
          height: 900,
        },
        recentSqliteFiles: [],
        sidebarWidth: 260,
        sidebarVisible: true,
      },
    });
  }
  return _store;
}

// Connection management helpers
export function getAllConnections(): StoredConnectionConfig[] {
  return getStore().get("connections", []);
}

export function getConnection(name: string): StoredConnectionConfig | undefined {
  const connections = getAllConnections();
  return connections.find((c) => c.name === name);
}

export function saveConnection(config: StoredConnectionConfig): void {
  const connections = getAllConnections();
  const existingIndex = connections.findIndex((c) => c.name === config.name);

  if (existingIndex >= 0) {
    connections[existingIndex] = config;
  } else {
    connections.push(config);
  }

  getStore().set("connections", connections);
}

export function deleteConnectionConfig(name: string): void {
  const connections = getAllConnections().filter((c) => c.name !== name);
  getStore().set("connections", connections);

  // Clear active connection if it was deleted
  if (getStore().get("activeConnectionName") === name) {
    getStore().set("activeConnectionName", null);
  }
}

export function getActiveConnectionName(): string | null {
  return getStore().get("activeConnectionName", null);
}

export function setActiveConnectionName(name: string | null): void {
  getStore().set("activeConnectionName", name);
}

// Window bounds
export function getWindowBounds(): StoreSchema["windowBounds"] {
  return getStore().get("windowBounds");
}

export function saveWindowBounds(bounds: StoreSchema["windowBounds"]): void {
  getStore().set("windowBounds", bounds);
}

// Recent SQLite files
export function getRecentSqliteFiles(): string[] {
  return getStore().get("recentSqliteFiles", []);
}

export function addRecentSqliteFile(filePath: string): void {
  const recent = getRecentSqliteFiles().filter((f) => f !== filePath);
  recent.unshift(filePath);
  getStore().set("recentSqliteFiles", recent.slice(0, 10)); // Keep last 10
}

// Sidebar settings
export function getSidebarWidth(): number {
  return getStore().get("sidebarWidth", 260);
}

export function setSidebarWidth(width: number): void {
  getStore().set("sidebarWidth", width);
}

export function getSidebarVisible(): boolean {
  return getStore().get("sidebarVisible", true);
}

export function setSidebarVisible(visible: boolean): void {
  getStore().set("sidebarVisible", visible);
}
