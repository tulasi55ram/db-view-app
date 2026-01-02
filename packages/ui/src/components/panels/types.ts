/**
 * Shared types for the panel system
 */

export type PanelType =
  | "insert"
  | "json-editor"
  | "metadata"
  | "saved-views"
  | "document-editor"
  | "cassandra-editor";

export interface InsertPanelData {
  initialValues?: Record<string, unknown>;
  mode: "insert" | "duplicate";
}

export interface JsonEditorPanelData {
  rowIndex: number;
  columnKey: string;
  columnName: string;
  columnType: string;
  value: unknown;
  isNullable?: boolean;
}

export interface DocumentEditorPanelData {
  document: Record<string, unknown>;
  documentId: string;
  isNew?: boolean;
}

export interface CassandraEditorPanelData {
  rowIndex: number;
  columnKey: string;
  columnName: string;
  columnType: string;
  value: unknown;
}

export type PanelData = {
  insert?: InsertPanelData;
  "json-editor"?: JsonEditorPanelData;
  metadata?: Record<string, never>;
  "saved-views"?: Record<string, never>;
  "document-editor"?: DocumentEditorPanelData;
  "cassandra-editor"?: CassandraEditorPanelData;
};

export interface PanelState {
  activePanel: PanelType | null;
  data: PanelData;
}

export interface SidePanelProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  className?: string;
}

export interface QuickAccessBarProps {
  onOpenPanel: (type: PanelType) => void;
  activePanel: PanelType | null;
  hasUnsavedChanges?: boolean;
  hasSelectedCell?: boolean;
}
