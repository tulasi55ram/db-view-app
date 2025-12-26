import { type ReactNode } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarDefaultSize?: number;
  sidebarMinSize?: number;
  sidebarMaxSize?: number;
  sidebarCollapsed?: boolean;
}

export function AppShell({
  sidebar,
  children,
  sidebarDefaultSize = 20,
  sidebarMinSize = 15,
  sidebarMaxSize = 40,
  sidebarCollapsed = false,
}: AppShellProps) {
  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      {/* Main content area with resizable panels */}
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Sidebar Panel */}
        {!sidebarCollapsed && (
          <>
            <Panel
              id="sidebar"
              order={1}
              defaultSize={sidebarDefaultSize}
              minSize={sidebarMinSize}
              maxSize={sidebarMaxSize}
              className="bg-bg-secondary"
            >
              {sidebar}
            </Panel>
            <PanelResizeHandle className="w-px bg-border hover:bg-accent transition-colors cursor-col-resize group">
              <div className="w-1 h-full -ml-px group-hover:bg-accent/30 transition-colors" />
            </PanelResizeHandle>
          </>
        )}

        {/* Main Content Panel */}
        <Panel id="main" order={2} minSize={50}>
          <div className="h-full flex flex-col overflow-hidden">{children}</div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

// Optional: Split panel for main content area
interface SplitPanelProps {
  top: ReactNode;
  bottom: ReactNode;
  defaultTopSize?: number;
  minTopSize?: number;
}

export function VerticalSplitPanel({
  top,
  bottom,
  defaultTopSize = 50,
  minTopSize = 20,
}: SplitPanelProps) {
  return (
    <PanelGroup direction="vertical">
      <Panel defaultSize={defaultTopSize} minSize={minTopSize}>
        {top}
      </Panel>
      <PanelResizeHandle className="h-px bg-border hover:bg-accent transition-colors cursor-row-resize group">
        <div className="h-1 w-full -mt-px group-hover:bg-accent/30 transition-colors" />
      </PanelResizeHandle>
      <Panel minSize={20}>{bottom}</Panel>
    </PanelGroup>
  );
}
