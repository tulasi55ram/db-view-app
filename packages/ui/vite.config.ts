import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react()
  ],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    fs: {
      // Allow serving files from the monorepo root
      allow: ['../..']
    }
  },
  optimizeDeps: {
    // Exclude workspace packages from optimization
    exclude: ['@dbview/core', '@dbview/shared-state', '@dbview/types']
  },
  build: {
    outDir: resolve(__dirname, "../../apps/vscode-extension/media/webview"),
    emptyOutDir: true,
    assetsDir: ".",
    cssCodeSplit: false,
    sourcemap: true, // Enable source maps for better debugging
    minify: false, // Disable minification to see actual variable names in errors
    rollupOptions: {
      output: {
        entryFileNames: "main.js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]"
      }
    }
  }
});
