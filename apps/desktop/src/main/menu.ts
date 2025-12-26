import { app, Menu, BrowserWindow, dialog, MenuItemConstructorOptions } from "electron";

export function createApplicationMenu(mainWindow: BrowserWindow | null): Menu {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: "File",
      submenu: [
        {
          label: "New Query",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow?.webContents.send("menu:newQuery");
          },
        },
        {
          label: "Open SQLite Database...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog({
              filters: [
                { name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3"] },
                { name: "All Files", extensions: ["*"] },
              ],
              properties: ["openFile"],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send("menu:openSqlite", result.filePaths[0]);
            }
          },
        },
        { type: "separator" },
        {
          label: "Add Connection...",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => {
            mainWindow?.webContents.send("menu:addConnection");
          },
        },
        { type: "separator" },
        isMac ? { role: "close" as const } : { role: "quit" as const },
      ],
    },

    // Edit menu
    {
      label: "Edit",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        ...(isMac
          ? [
              { role: "pasteAndMatchStyle" as const },
              { role: "delete" as const },
              { role: "selectAll" as const },
            ]
          : [{ role: "delete" as const }, { type: "separator" as const }, { role: "selectAll" as const }]),
      ],
    },

    // View menu
    {
      label: "View",
      submenu: [
        { role: "reload" as const },
        { role: "forceReload" as const },
        { role: "toggleDevTools" as const },
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
        { type: "separator" as const },
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: () => {
            mainWindow?.webContents.send("menu:toggleSidebar");
          },
        },
      ],
    },

    // Query menu
    {
      label: "Query",
      submenu: [
        {
          label: "Run Query",
          accelerator: "CmdOrCtrl+Enter",
          click: () => {
            mainWindow?.webContents.send("menu:runQuery");
          },
        },
        {
          label: "Format SQL",
          accelerator: "CmdOrCtrl+Shift+F",
          click: () => {
            mainWindow?.webContents.send("menu:formatSql");
          },
        },
        {
          label: "Explain Query",
          accelerator: "CmdOrCtrl+E",
          click: () => {
            mainWindow?.webContents.send("menu:explainQuery");
          },
        },
      ],
    },

    // Window menu
    {
      label: "Window",
      submenu: [
        { role: "minimize" as const },
        { role: "zoom" as const },
        ...(isMac
          ? [{ type: "separator" as const }, { role: "front" as const }, { type: "separator" as const }, { role: "window" as const }]
          : [{ role: "close" as const }]),
      ],
    },

    // Help menu
    {
      role: "help" as const,
      submenu: [
        {
          label: "Documentation",
          click: async () => {
            const { shell } = require("electron");
            await shell.openExternal("https://github.com/dbview/dbview");
          },
        },
        {
          label: "Report Issue",
          click: async () => {
            const { shell } = require("electron");
            await shell.openExternal("https://github.com/dbview/dbview/issues");
          },
        },
        { type: "separator" },
        {
          label: "About DBView",
          click: () => {
            dialog.showMessageBox({
              type: "info",
              title: "About DBView",
              message: "DBView Desktop",
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nChrome: ${process.versions.chrome}`,
            });
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
