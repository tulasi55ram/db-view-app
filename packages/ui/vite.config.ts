import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react()
  ],
  base: "./",
  resolve: {
    alias: {
      // Resolve @/ imports from shared-ui to the shared-ui/src directory
      "@/": resolve(__dirname, "../shared-ui/src") + "/",
      // Also allow direct @dbview/shared-ui imports to work during development
      "@dbview/shared-ui": resolve(__dirname, "../shared-ui/src"),
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  build: {
    outDir: resolve(__dirname, "../../apps/vscode-extension/media/webview"),
    emptyOutDir: true,
    assetsDir: ".",
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: "main.js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]"
      }
    }
  }
});
