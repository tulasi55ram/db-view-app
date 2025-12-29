import { autoUpdater, UpdateInfo, ProgressInfo } from "electron-updater";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import log from "electron-log";

export interface UpdateStatus {
  status: "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  info?: UpdateInfo;
  progress?: ProgressInfo;
  error?: string;
}

/**
 * AutoUpdater - Manages automatic updates for the desktop app
 *
 * Uses electron-updater to:
 * - Check for updates on app start
 * - Download updates in background
 * - Notify user when update is ready
 * - Install update on quit or user request
 */
class AutoUpdaterService {
  private mainWindow: BrowserWindow | null = null;
  private updateAvailable = false;
  private updateDownloaded = false;

  constructor() {
    // Configure logging
    log.transports.file.level = "info";
    autoUpdater.logger = log;

    // Disable auto-download - we'll control when to download
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    this.setupEventListeners();
  }

  /**
   * Initialize the auto-updater with the main window reference
   */
  init(window: BrowserWindow): void {
    this.mainWindow = window;

    // Register IPC handlers
    this.registerIPCHandlers();

    // Check for updates after a short delay (let app settle)
    if (!this.isDev()) {
      setTimeout(() => {
        this.checkForUpdates(true); // silent check on startup
      }, 5000);
    }
  }

  /**
   * Check if running in development mode
   */
  private isDev(): boolean {
    return process.env.NODE_ENV === "development" || !app.isPackaged;
  }

  /**
   * Set up event listeners for auto-updater events
   */
  private setupEventListeners(): void {
    autoUpdater.on("checking-for-update", () => {
      log.info("[AutoUpdater] Checking for updates...");
      this.sendStatusToRenderer({
        status: "checking",
      });
    });

    autoUpdater.on("update-available", (info: UpdateInfo) => {
      log.info("[AutoUpdater] Update available:", info.version);
      this.updateAvailable = true;
      this.sendStatusToRenderer({
        status: "available",
        info,
      });
    });

    autoUpdater.on("update-not-available", (info: UpdateInfo) => {
      log.info("[AutoUpdater] No updates available. Current version:", info.version);
      this.sendStatusToRenderer({
        status: "not-available",
        info,
      });
    });

    autoUpdater.on("download-progress", (progress: ProgressInfo) => {
      log.info(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`);
      this.sendStatusToRenderer({
        status: "downloading",
        progress,
      });
    });

    autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
      log.info("[AutoUpdater] Update downloaded:", info.version);
      this.updateDownloaded = true;
      this.sendStatusToRenderer({
        status: "downloaded",
        info,
      });

      // Show notification dialog
      this.showUpdateReadyDialog(info);
    });

    autoUpdater.on("error", (error: Error) => {
      log.error("[AutoUpdater] Error:", error.message);
      this.sendStatusToRenderer({
        status: "error",
        error: error.message,
      });
    });
  }

  /**
   * Register IPC handlers for renderer communication
   */
  private registerIPCHandlers(): void {
    // Check for updates manually
    ipcMain.handle("updater:check", async () => {
      return this.checkForUpdates(false);
    });

    // Download available update
    ipcMain.handle("updater:download", async () => {
      if (this.updateAvailable) {
        await autoUpdater.downloadUpdate();
        return true;
      }
      return false;
    });

    // Install downloaded update (quit and install)
    ipcMain.handle("updater:install", async () => {
      if (this.updateDownloaded) {
        autoUpdater.quitAndInstall(false, true);
        return true;
      }
      return false;
    });

    // Get current version
    ipcMain.handle("updater:getVersion", () => {
      return app.getVersion();
    });
  }

  /**
   * Send update status to renderer
   */
  private sendStatusToRenderer(status: UpdateStatus): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("updater:status", status);
    }
  }

  /**
   * Check for updates
   * @param silent - If true, don't show dialog when no update is available
   */
  async checkForUpdates(silent = false): Promise<void> {
    if (this.isDev()) {
      log.info("[AutoUpdater] Skipping update check in development mode");
      if (!silent) {
        dialog.showMessageBox({
          type: "info",
          title: "Development Mode",
          message: "Auto-updates are disabled in development mode.",
          detail: `Current version: ${app.getVersion()}`,
        });
      }
      return;
    }

    try {
      const result = await autoUpdater.checkForUpdates();

      if (!silent && !result?.updateInfo) {
        dialog.showMessageBox({
          type: "info",
          title: "No Updates Available",
          message: "You're running the latest version.",
          detail: `Current version: ${app.getVersion()}`,
        });
      }
    } catch (error) {
      log.error("[AutoUpdater] Check for updates failed:", error);
      if (!silent) {
        dialog.showMessageBox({
          type: "error",
          title: "Update Check Failed",
          message: "Failed to check for updates.",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Download available update
   */
  async downloadUpdate(): Promise<void> {
    if (this.updateAvailable) {
      await autoUpdater.downloadUpdate();
    }
  }

  /**
   * Show dialog when update is downloaded and ready
   */
  private showUpdateReadyDialog(info: UpdateInfo): void {
    const dialogOpts = {
      type: "info" as const,
      buttons: ["Restart Now", "Later"],
      title: "Update Ready",
      message: `Version ${info.version} has been downloaded.`,
      detail: "A new version has been downloaded. Restart the application to apply the update.",
    };

    dialog.showMessageBox(dialogOpts).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  }

  /**
   * Quit and install update
   */
  quitAndInstall(): void {
    if (this.updateDownloaded) {
      autoUpdater.quitAndInstall(false, true);
    }
  }

  /**
   * Get whether an update is available
   */
  isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  /**
   * Get whether an update is downloaded
   */
  isUpdateDownloaded(): boolean {
    return this.updateDownloaded;
  }
}

// Singleton instance
let autoUpdaterService: AutoUpdaterService | null = null;

/**
 * Get the AutoUpdater service singleton
 */
export function getAutoUpdater(): AutoUpdaterService {
  if (!autoUpdaterService) {
    autoUpdaterService = new AutoUpdaterService();
  }
  return autoUpdaterService;
}
