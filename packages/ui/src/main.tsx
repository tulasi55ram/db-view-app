import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ElectronApp } from "./ElectronApp";
import { VSCodeApp } from "./VSCodeApp";
// Initialize VS Code API first (sets up window.vscodeAPI for platform detection)
import "./vscode";
// Then import platform detection
import { isElectron, isVSCode } from "@dbview/shared-ui";
import "./styles/index.css";

// Render the appropriate app based on platform
// Priority: Electron > VS Code > Legacy App
function getRootApp() {
  if (isElectron()) {
    console.log("[main] Running in Electron mode");
    return ElectronApp;
  }
  if (isVSCode()) {
    console.log("[main] Running in VS Code mode with shared-ui components");
    return VSCodeApp;
  }
  // Fallback to legacy App (shouldn't happen in production)
  console.log("[main] Running in legacy mode");
  return App;
}

const RootApp = getRootApp();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
