# dbview.app Monorepo

Skeleton workspace for the dbview VS Code extension, shared React webview UI, reusable core logic, and a future Electron desktop shell.

## Structure

```
apps/
  vscode-extension/   # VS Code extension backend + bundled webview assets
  desktop/            # Electron shell placeholder
packages/
  ui/                 # React + Vite + Tailwind webview app
  core/               # Shared DB types and Postgres adapter stubs
.vscode/launch.json   # Launch config to run the extension in VS Code
package.json          # pnpm workspaces + top-level scripts
pnpm-workspace.yaml   # Workspace map
tsconfig.base.json    # Shared TS compiler options & path aliases
```

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. In one terminal run the extension + webview watchers:
   ```bash
   pnpm run dev:extension
   ```
   This starts the Vite dev server for `@dbview/ui` and the `tsc --watch` task for the VS Code extension.
3. In VS Code, use the **Run dbview Extension** launch configuration (`.vscode/launch.json`) to open an Extension Development Host. Activate the `DB View` activity bar icon to explore schemas or run the `DBView: Open Sample Table` command; the table webview shows mock data and responds to messages.

## Building

- Build everything (core, UI bundle, extension, desktop stub):
  ```bash
  pnpm run -r build
  ```
- Build just the extension (includes UI bundle output to `apps/vscode-extension/media/webview`):
  ```bash
  pnpm run build:extension
  ```

## Next Steps

- Replace the mock implementations in `packages/core/src/db/postgresAdapter.ts` with real `pg` calls.
- Expand the React UI to handle pagination, editing, or additional views; reuse it in the Electron app by pointing the BrowserWindow to the built assets.
- Add real connection management, settings UI, and command palette workflows inside the extension.
