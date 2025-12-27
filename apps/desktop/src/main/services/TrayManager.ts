import { app, Tray, Menu, nativeImage, BrowserWindow } from "electron";
import * as path from "path";
import { ConnectionManager } from "./ConnectionManager";

/**
 * TrayManager - Manages the system tray icon and menu
 *
 * Following desktop app design patterns (Section 11):
 * - System tray icon with context menu
 * - Quick access to connections
 * - Show/hide window toggle
 */
export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private connectionManager: ConnectionManager | null = null;

  /**
   * Initialize the system tray
   */
  init(mainWindow: BrowserWindow, connectionManager: ConnectionManager): void {
    this.mainWindow = mainWindow;
    this.connectionManager = connectionManager;

    // Get the icon path - use different icons for different states
    const iconPath = this.getIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    // Create tray with smaller icon for system tray
    // On macOS, use Template image for dark/light mode support
    if (process.platform === "darwin") {
      icon.setTemplateImage(true);
    }

    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    this.tray.setToolTip("DBView - Database Viewer");

    // Update context menu
    this.updateContextMenu();

    // Handle tray click
    this.tray.on("click", () => {
      this.toggleWindow();
    });

    // Listen for connection changes to update menu
    if (this.connectionManager) {
      // Refresh menu periodically to show connection status
      setInterval(() => {
        this.updateContextMenu();
      }, 5000);
    }
  }

  /**
   * Get the appropriate icon path based on platform
   */
  private getIconPath(): string {
    const assetsPath = path.join(__dirname, "../../../assets");

    if (process.platform === "darwin") {
      // Use template icon for macOS (16x16 or 32x32)
      return path.join(assetsPath, "icon-16.png");
    } else if (process.platform === "win32") {
      // Use ICO for Windows
      return path.join(assetsPath, "icon-16.png");
    } else {
      // Linux
      return path.join(assetsPath, "icon-16.png");
    }
  }

  /**
   * Toggle window visibility
   */
  private toggleWindow(): void {
    if (!this.mainWindow) return;

    if (this.mainWindow.isVisible()) {
      if (this.mainWindow.isFocused()) {
        this.mainWindow.hide();
      } else {
        this.mainWindow.focus();
      }
    } else {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  /**
   * Update the context menu with current connection status
   */
  private async updateContextMenu(): Promise<void> {
    if (!this.tray) return;

    // getConnectionsWithStatus returns a Promise
    const connections = await this.connectionManager?.getConnectionsWithStatus() || [];

    // Build connections submenu
    const connectionsSubmenu: Electron.MenuItemConstructorOptions[] = connections.length > 0
      ? connections.map((conn) => ({
          label: conn.config.name || "Unnamed Connection",
          enabled: false,
        }))
      : [{ label: "No connections", enabled: false }];

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show DBView",
        click: () => {
          this.mainWindow?.show();
          this.mainWindow?.focus();
        },
      },
      { type: "separator" },
      {
        label: "Connections",
        submenu: connectionsSubmenu,
      },
      { type: "separator" },
      {
        label: "New Query",
        accelerator: "CmdOrCtrl+N",
        click: () => {
          this.mainWindow?.show();
          this.mainWindow?.webContents.send("tray:new-query");
        },
      },
      { type: "separator" },
      {
        label: "Quit DBView",
        accelerator: "CmdOrCtrl+Q",
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Get status indicator icon (colored dot)
   */
  private getStatusIcon(_status: string): Electron.NativeImage | undefined {
    // Return undefined - icons in menu items can be complex
    // The status is shown via the connection name styling instead
    return undefined;
  }

  /**
   * Update tray icon to indicate connection status
   */
  updateIcon(hasActiveConnections: boolean): void {
    // Could update icon to show different state
    // For now, we keep the same icon
  }

  /**
   * Destroy the tray
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

// Singleton instance
let trayManager: TrayManager | null = null;

export function getTrayManager(): TrayManager {
  if (!trayManager) {
    trayManager = new TrayManager();
  }
  return trayManager;
}
