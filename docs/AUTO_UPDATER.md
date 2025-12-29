# Auto-Updater Documentation

DBView Desktop includes automatic update functionality powered by `electron-updater`. This document covers the implementation, configuration, and usage of the auto-update system.

## Overview

The auto-updater automatically checks for new versions when the app starts and notifies users when updates are available. Users can also manually check for updates via the Help menu.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Process                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  AutoUpdater Service                      │   │
│  │  - Checks for updates on app start                       │   │
│  │  - Downloads updates in background                       │   │
│  │  - Shows native dialogs for user interaction             │   │
│  │  - Handles IPC communication with renderer               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              │ IPC                               │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Preload Script                         │   │
│  │  - Exposes safe API to renderer                          │   │
│  │  - checkForUpdates, downloadUpdate, installUpdate        │   │
│  │  - onUpdateStatus event listener                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Renderer Process                            │
│  - Can listen for update status changes                         │
│  - Can trigger manual update checks                             │
│  - Can show custom UI for update progress                       │
└─────────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `apps/desktop/src/main/services/AutoUpdater.ts` | Main auto-updater service |
| `apps/desktop/src/main/main.ts` | Initializes auto-updater on app ready |
| `apps/desktop/src/main/menu.ts` | "Check for Updates" menu item |
| `apps/desktop/src/preload/preload.ts` | IPC handlers for renderer |
| `apps/desktop/src/preload/api.ts` | TypeScript types for API |
| `apps/desktop/electron-builder.yml` | Publish configuration |

## Configuration

### electron-builder.yml

The publish configuration tells electron-builder where to upload releases and where the app should check for updates:

```yaml
# Auto-update configuration
publish:
  provider: github
  owner: dbview
  repo: dbview
  releaseType: release
```

### Supported Providers

- **GitHub** (recommended): Free, integrates with GitHub releases
- **S3**: Amazon S3 bucket
- **Generic**: Any HTTP server with update files
- **DigitalOcean Spaces**: S3-compatible storage

## API Reference

### Main Process (AutoUpdater Service)

```typescript
import { getAutoUpdater } from "./services/AutoUpdater";

const autoUpdater = getAutoUpdater();

// Initialize with main window reference
autoUpdater.init(mainWindow);

// Check for updates (silent = no dialog if no update)
autoUpdater.checkForUpdates(silent: boolean);

// Download available update
autoUpdater.downloadUpdate();

// Quit and install downloaded update
autoUpdater.quitAndInstall();

// Check status
autoUpdater.isUpdateAvailable();
autoUpdater.isUpdateDownloaded();
```

### Renderer Process (via Electron API)

```typescript
const api = window.electronAPI;

// Check for updates
await api.checkForUpdates();

// Download update (returns true if started)
const started = await api.downloadUpdate();

// Install update (quits app and installs)
await api.installUpdate();

// Get current app version
const version = await api.getAppVersion();

// Listen for update status changes
const unsubscribe = api.onUpdateStatus((status) => {
  console.log('Update status:', status);
  // status.status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  // status.info?: { version, releaseDate, releaseNotes }
  // status.progress?: { bytesPerSecond, percent, transferred, total }
  // status.error?: string
});

// Clean up listener
unsubscribe();
```

### Update Status Types

```typescript
interface UpdateStatus {
  status: "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  info?: UpdateInfo;
  progress?: UpdateProgress;
  error?: string;
}

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
}

interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}
```

## Update Flow

### Automatic Check (on app start)

```
App Starts
    │
    ▼ (5 second delay)
Check for Updates
    │
    ├─► No Update Available ──► Done
    │
    └─► Update Available
            │
            ▼
    Show "Update Available" Status
            │
            ▼
    User clicks "Download" or auto-download
            │
            ▼
    Download with Progress
            │
            ▼
    Show "Restart Now" Dialog
            │
            ├─► "Restart Now" ──► Quit & Install
            │
            └─► "Later" ──► Install on next quit
```

### Manual Check (Help > Check for Updates)

```
User clicks "Check for Updates..."
    │
    ▼
Check for Updates
    │
    ├─► No Update ──► Show "You're up to date" dialog
    │
    ├─► Update Available ──► Show update notification
    │
    └─► Error ──► Show error dialog
```

## Publishing Updates

### Prerequisites

1. **GitHub Token**: Create a personal access token with `repo` scope
2. **Code Signing** (recommended for production):
   - macOS: Apple Developer certificate
   - Windows: Code signing certificate

### Build & Publish Commands

```bash
# Set GitHub token
export GH_TOKEN=your_github_token

# Build and publish (creates GitHub release)
pnpm --filter @dbview/desktop build
electron-builder --publish always

# Or build without publishing (for testing)
electron-builder --publish never
```

### Version Management

1. Update version in `apps/desktop/package.json`:
   ```json
   {
     "version": "1.0.1"
   }
   ```

2. Build and publish:
   ```bash
   electron-builder --publish always
   ```

3. This creates a GitHub release with:
   - `.dmg` and `.zip` for macOS (x64 & arm64)
   - `.exe` installer for Windows
   - `.AppImage` and `.deb` for Linux
   - `latest.yml` / `latest-mac.yml` / `latest-linux.yml` (update metadata)

## Development Mode

Auto-updates are disabled in development mode to prevent accidental updates during development. When running `pnpm dev`, the "Check for Updates" menu item will show a dialog indicating development mode.

```typescript
// In AutoUpdater.ts
private isDev(): boolean {
  return process.env.NODE_ENV === "development" || !app.isPackaged;
}
```

## Logging

The auto-updater uses `electron-log` for logging. Logs are written to:

- **macOS**: `~/Library/Logs/DBView/main.log`
- **Windows**: `%USERPROFILE%\AppData\Roaming\DBView\logs\main.log`
- **Linux**: `~/.config/DBView/logs/main.log`

Example log output:
```
[AutoUpdater] Checking for updates...
[AutoUpdater] Update available: 1.0.1
[AutoUpdater] Download progress: 45.2%
[AutoUpdater] Update downloaded: 1.0.1
```

## Security Considerations

1. **Code Signing**: Always sign your app for production releases
2. **HTTPS**: Updates are downloaded over HTTPS
3. **Signature Verification**: electron-updater verifies the signature of downloaded updates
4. **No Auto-Download by Default**: Users must consent to download

## Troubleshooting

### Update check fails

1. Check internet connection
2. Verify GitHub release exists with correct assets
3. Check `latest.yml` file in GitHub release
4. Review logs in electron-log location

### Update downloads but won't install

1. Ensure app has write permissions to temp directory
2. Check if antivirus is blocking the update
3. On macOS, ensure app is properly signed

### "No update available" when there is one

1. Verify version in `package.json` is higher than current
2. Check `latest.yml` has correct version
3. Clear electron-updater cache:
   - macOS: `~/Library/Caches/dbview-updater`
   - Windows: `%LOCALAPPDATA%\dbview-updater`

## Future Enhancements

- [ ] In-app update progress UI
- [ ] Release notes display
- [ ] Delta updates (smaller download sizes)
- [ ] Staged rollouts (percentage-based)
- [ ] Update channels (stable, beta, alpha)
