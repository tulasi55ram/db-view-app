import { app, BrowserWindow, ipcMain, nativeTheme, shell, Menu, powerMonitor, dialog } from "electron";
import * as path from "path";
import { URL } from "url";
import { registerAllHandlers } from "./ipc";
import { ConnectionManager } from "./services/ConnectionManager";
import { createApplicationMenu } from "./menu";
import { getTrayManager } from "./services/TrayManager";
import { getAutoUpdater } from "./services/AutoUpdater";

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

// Singleton connection manager (initialized after app is ready)
let connectionManager: ConnectionManager | null = null;

// Check if running in development
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: "DBView",
    icon: path.join(__dirname, "../../assets/icon-256.png"),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1e1e1e" : "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent visual flash
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Load the UI
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL("http://localhost:5174").catch((err) => {
      console.error("Failed to load dev server:", err);
      console.log("Make sure to run 'pnpm dev:ui' in the UI package first");
    });

    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built renderer
    const indexPath = path.join(__dirname, "../renderer/index.html");
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error("Failed to load renderer:", err);
    });
  }

  // Handle external links - only allow safe protocols
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url);
      // Only allow http and https protocols to prevent file://, javascript:, or custom protocol attacks
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        shell.openExternal(url);
      } else {
        console.warn(`[Security] Blocked external link with disallowed protocol: ${parsedUrl.protocol}`);
      }
    } catch {
      console.warn(`[Security] Blocked invalid URL: ${url}`);
    }
    return { action: "deny" };
  });

  // Clean up on close
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Send theme changes to renderer
  nativeTheme.on("updated", () => {
    const theme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
    mainWindow?.webContents.send("theme:change", theme);
  });
}

// Register IPC handlers
function setupIPC(connManager: ConnectionManager): void {
  registerAllHandlers(connManager);

  // Theme detection handler
  ipcMain.handle("theme:get", () => {
    return nativeTheme.shouldUseDarkColors ? "dark" : "light";
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Set dock icon on macOS (using padded icon to match other dock icons)
  if (process.platform === "darwin" && app.dock) {
    const iconPath = path.join(__dirname, "../../assets/icon-padded.png");
    app.dock.setIcon(iconPath);
  }

  // Initialize connection manager after app is ready
  connectionManager = new ConnectionManager();
  setupIPC(connectionManager);
  createWindow();

  // Create application menu
  const menu = createApplicationMenu(mainWindow);
  Menu.setApplicationMenu(menu);

  // Initialize system tray (following design patterns Section 11)
  if (mainWindow && connectionManager) {
    const trayManager = getTrayManager();
    trayManager.init(mainWindow, connectionManager);
  }

  // Initialize auto-updater
  if (mainWindow) {
    const autoUpdater = getAutoUpdater();
    autoUpdater.init(mainWindow);
  }

  app.on("activate", () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS, keep app running until explicitly quit
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Cleanup on quit
app.on("before-quit", async () => {
  // Destroy system tray
  getTrayManager().destroy();

  // Disconnect all database connections
  if (connectionManager) {
    await connectionManager.disconnectAll();
  }
});

// Handle certificate errors (for development)
if (isDev) {
  app.on("certificate-error", (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
  });
}

// Security: Prevent navigation to unknown URLs
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    // Allow navigation to localhost in development
    if (isDev && parsedUrl.hostname === "localhost") {
      return;
    }

    // Block all other navigation
    event.preventDefault();
  });
});

// ==================== Sleep/Wake Handling ====================
// Handle system sleep/wake to prevent connection errors after Mac wakes from sleep

let isSystemSuspended = false;

powerMonitor.on("suspend", () => {
  console.log("[DBView] System is going to sleep - pausing health checks");
  isSystemSuspended = true;

  // Pause all health checks to prevent errors during sleep
  if (connectionManager) {
    connectionManager.pauseAllHealthChecks();
  }
});

powerMonitor.on("resume", () => {
  console.log("[DBView] System resumed from sleep - reconnecting");
  isSystemSuspended = false;

  // Give the system a moment to restore network connectivity
  setTimeout(async () => {
    if (connectionManager) {
      await connectionManager.reconnectAllAfterWake();
    }
  }, 2000); // Wait 2 seconds for network to stabilize
});

// ==================== Global Error Handling ====================
// Prevent multiple error dialogs from appearing

let errorDialogShowing = false;
let lastErrorTime = 0;
const ERROR_DEBOUNCE_MS = 5000; // Suppress duplicate errors within 5 seconds

process.on("uncaughtException", (error) => {
  console.error("[DBView] Uncaught exception:", error);

  // Don't show error dialogs during system suspend (connection errors are expected)
  if (isSystemSuspended) {
    console.log("[DBView] Suppressing error dialog during system suspend");
    return;
  }

  // Debounce error dialogs to prevent multiple alerts
  const now = Date.now();
  if (errorDialogShowing || (now - lastErrorTime < ERROR_DEBOUNCE_MS)) {
    console.log("[DBView] Suppressing duplicate error dialog");
    return;
  }

  lastErrorTime = now;
  errorDialogShowing = true;

  dialog.showMessageBox({
    type: "error",
    title: "Application Error",
    message: "An unexpected error occurred",
    detail: error.message || String(error),
    buttons: ["OK"],
  }).finally(() => {
    errorDialogShowing = false;
  });
});

process.on("unhandledRejection", (reason) => {
  console.error("[DBView] Unhandled promise rejection:", reason);

  // Don't show dialogs for connection-related errors during suspend
  if (isSystemSuspended) {
    return;
  }

  // Only log, don't show dialog for unhandled rejections (they're often less critical)
});
