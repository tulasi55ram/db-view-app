import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ElectronApp } from "./ElectronApp";
import { isElectron } from "./electron";
import "./styles/index.css";

// Render the appropriate app based on platform
const RootApp = isElectron() ? ElectronApp : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
