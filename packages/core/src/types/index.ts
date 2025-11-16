export interface ConnectionConfig {
  name?: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}

export interface Column {
  name: string;
  dataType: string;
  nullable: boolean;
}

export interface Table {
  schema: string;
  name: string;
  columns: Column[];
}

export type Row = Record<string, unknown>;
