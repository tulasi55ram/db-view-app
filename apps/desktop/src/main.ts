import { app, BrowserWindow } from "electron";
import { join } from "path";

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    title: "dbview.app",
    webPreferences: {
      contextIsolation: true
    }
  });

  const htmlPath = join(app.getAppPath(), "apps/desktop/static/index.html");
  win.loadFile(htmlPath).catch((error) => {
    console.error("Failed to load desktop stub", error);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
