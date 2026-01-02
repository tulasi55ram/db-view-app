/**
 * CQL Smart Completion Provider
 *
 * Context-aware CQL autocomplete for Cassandra queries.
 * Reuses patterns from SQL autocomplete with Cassandra-specific enhancements.
 */

import type { CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";
import type { ColumnMetadata } from "@dbview/types";
import { getCqlContext, resolveQualifier } from "./contextParser";
import { CQL_FUNCTIONS, searchCqlFunctions } from "./functions";
import { CQL_KEYWORDS, CQL_DATA_TYPES, getCqlKeywordsForContext, getCqlOperatorsForContext } from "./keywords";
import type {
  CqlContext,
  CqlAutocompleteData,
  CqlTableReference,
  CqlColumnMetadata,
} from "./types";

// Boost values for ranking
const BOOST = {
  EXACT_MATCH: 100,
  COLUMN_IN_SCOPE: 50,
  COLUMN_PARTITION: 55, // Partition keys get higher priority
  COLUMN_CLUSTERING: 52,
  COLUMN_QUALIFIED: 40,
  TABLE_IN_SCOPE: 35,
  SNIPPET: 30,
  FUNCTION: 25,
  TABLE: 20,
  KEYSPACE: 15,
  KEYWORD_RELEVANT: 10,
  KEYWORD_OTHER: 5,
  OPERATOR: 8,
  DATA_TYPE: 7,
};

// Completion limits
const LIMITS = {
  MAX_TOTAL: 50,
  MAX_COLUMNS: 30,
  MAX_TABLES: 20,
  MAX_FUNCTIONS: 25,
  MAX_KEYWORDS: 20,
  MIN_PREFIX_FOR_ALL: 2,
};

/**
 * Create a smart CQL completion function for CodeMirror
 */
export function createSmartCqlCompletion(
  getData: () => CqlAutocompleteData
): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext): CompletionResult | null => {
    const data = getData();
    const cqlContext = getCqlContext(context.state, context.pos);

    // Don't autocomplete in strings or comments
    if (cqlContext.inString || cqlContext.inComment) {
      return null;
    }

    // Get the word being typed
    const word = context.matchBefore(/[\w.]*/) || { from: context.pos, to: context.pos, text: "" };

    // Don't show completions for empty input unless explicit
    if (!word.text && !context.explicit) {
      return null;
    }

    // Build completions based on context
    const completions: Completion[] = [];
    const prefix = cqlContext.currentWord.toLowerCase();

    // Handle qualified completions (after dot)
    if (cqlContext.currentQualifier) {
      const qualifiedCompletions = getQualifiedCompletions(
        cqlContext,
        data,
        prefix
      );
      completions.push(...qualifiedCompletions);
    } else {
      // Regular completions based on expected type
      switch (cqlContext.expectedType) {
        case "column":
          completions.push(...getColumnCompletions(cqlContext, data, prefix));
          completions.push(...getKeywordCompletions(cqlContext, prefix));
          break;

        case "column_or_expression":
          completions.push(...getColumnCompletions(cqlContext, data, prefix));
          completions.push(...getFunctionCompletions(prefix));
          completions.push(...getKeywordCompletions(cqlContext, prefix));
          break;

        case "table":
        case "table_or_keyspace":
          completions.push(...getTableCompletions(data, prefix, cqlContext.tablesInScope));
          completions.push(...getKeyspaceCompletions(data, prefix));
          completions.push(...getKeywordCompletions(cqlContext, prefix));
          break;

        case "keyspace":
          completions.push(...getKeyspaceCompletions(data, prefix));
          break;

        case "operator":
          completions.push(...getOperatorCompletions(cqlContext, prefix));
          break;

        case "value":
          completions.push(...getValueCompletions(cqlContext, prefix));
          completions.push(...getFunctionCompletions(prefix));
          break;

        case "keyword":
          completions.push(...getKeywordCompletions(cqlContext, prefix));
          // Add TTL and TIMESTAMP for USING clause
          if (cqlContext.usingClause) {
            completions.push(...getUsingClauseCompletions(prefix));
          }
          break;

        case "data_type":
        case "collection_type":
          completions.push(...getDataTypeCompletions(prefix));
          break;

        case "any":
        default:
          completions.push(...getColumnCompletions(cqlContext, data, prefix));
          completions.push(...getTableCompletions(data, prefix, cqlContext.tablesInScope));
          completions.push(...getKeyspaceCompletions(data, prefix));
          completions.push(...getFunctionCompletions(prefix));
          completions.push(...getKeywordCompletions(cqlContext, prefix));
          break;
      }
    }

    // Add CQL-specific snippets
    if (cqlContext.clause === "UNKNOWN" || cqlContext.clause === "BATCH") {
      completions.push(...getCqlSnippets(prefix));
    }

    if (completions.length === 0) {
      return null;
    }

    // Deduplicate by label
    const seen = new Set<string>();
    const uniqueCompletions = completions.filter((c) => {
      const key = `${c.label}:${c.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Apply smart limits
    const filteredCompletions = applySmartLimits(uniqueCompletions, prefix);

    return {
      from: word.from,
      options: filteredCompletions,
      validFor: /^[\w.]*$/,
    };
  };
}

/**
 * Apply smart limits to completions
 */
function applySmartLimits(completions: Completion[], prefix: string): Completion[] {
  if (prefix.length >= LIMITS.MIN_PREFIX_FOR_ALL) {
    return completions.slice(0, LIMITS.MAX_TOTAL * 2);
  }

  const sorted = [...completions].sort((a, b) => (b.boost || 0) - (a.boost || 0));
  const byType: Record<string, Completion[]> = {};

  for (const c of sorted) {
    const type = c.type || "other";
    if (!byType[type]) byType[type] = [];
    byType[type].push(c);
  }

  const limited: Completion[] = [];

  if (byType["property"]) limited.push(...byType["property"].slice(0, LIMITS.MAX_COLUMNS));
  if (byType["class"]) limited.push(...byType["class"].slice(0, LIMITS.MAX_TABLES));
  if (byType["function"]) limited.push(...byType["function"].slice(0, LIMITS.MAX_FUNCTIONS));
  if (byType["keyword"]) limited.push(...byType["keyword"].slice(0, LIMITS.MAX_KEYWORDS));

  for (const [type, items] of Object.entries(byType)) {
    if (!["property", "class", "function", "keyword"].includes(type)) {
      limited.push(...items.slice(0, 10));
    }
  }

  return limited
    .sort((a, b) => (b.boost || 0) - (a.boost || 0))
    .slice(0, LIMITS.MAX_TOTAL);
}

/**
 * Get completions for qualified names (keyspace.table or table.column)
 */
function getQualifiedCompletions(
  context: CqlContext,
  data: CqlAutocompleteData,
  prefix: string
): Completion[] {
  const completions: Completion[] = [];
  const qualifier = context.currentQualifier!;

  const resolved = resolveQualifier(qualifier, context.tablesInScope, data.keyspaces);

  if (!resolved) return completions;

  if (resolved.type === "keyspace") {
    // Keyspace.table - suggest tables in this keyspace
    const keyspaceLower = resolved.name.toLowerCase();
    for (const table of data.tables) {
      if (table.keyspace?.toLowerCase() === keyspaceLower) {
        if (!prefix || table.name.toLowerCase().startsWith(prefix)) {
          completions.push({
            label: table.name,
            type: "class",
            detail: `${table.keyspace}.${table.name}`,
            boost: BOOST.TABLE,
          });
        }
      }
    }
  } else {
    // Table.column - suggest columns
    const tableKey = resolved.keyspace
      ? `${resolved.keyspace}.${resolved.name}`
      : findTableKey(resolved.name, data);

    if (tableKey && data.columns[tableKey]) {
      for (const col of data.columns[tableKey]) {
        if (!prefix || col.name.toLowerCase().startsWith(prefix)) {
          completions.push({
            label: col.name,
            type: "property",
            detail: formatColumnDetail(col),
            info: formatColumnInfo(col),
            boost: getColumnBoost(col),
          });
        }
      }
    }

    // Suggest * for SELECT
    if (context.clause === "SELECT" && (!prefix || "*".startsWith(prefix))) {
      completions.push({
        label: "*",
        type: "keyword",
        detail: "All columns",
        boost: BOOST.COLUMN_QUALIFIED + 5,
      });
    }
  }

  return completions;
}

/**
 * Get column completions for tables in scope
 */
function getColumnCompletions(
  context: CqlContext,
  data: CqlAutocompleteData,
  prefix: string
): Completion[] {
  const completions: Completion[] = [];
  const tablesInScope = context.tablesInScope;

  if (tablesInScope.length > 0) {
    for (const tableRef of tablesInScope) {
      const tableKey = tableRef.keyspace
        ? `${tableRef.keyspace}.${tableRef.table}`
        : findTableKey(tableRef.table, data);

      if (tableKey && data.columns[tableKey]) {
        for (const col of data.columns[tableKey]) {
          if (!prefix || col.name.toLowerCase().startsWith(prefix)) {
            completions.push({
              label: col.name,
              type: "property",
              detail: formatColumnDetail(col),
              info: formatColumnInfo(col),
              boost: getColumnBoost(col),
            });
          }
        }
      }
    }
  } else {
    // No tables in scope - show all columns
    for (const [tableKey, columns] of Object.entries(data.columns)) {
      for (const col of columns) {
        if (!prefix || col.name.toLowerCase().startsWith(prefix)) {
          completions.push({
            label: col.name,
            type: "property",
            detail: `${tableKey}.${col.name} (${col.type})`,
            boost: BOOST.TABLE,
          });
        }
      }
    }
  }

  // Suggest * in SELECT clause
  if (context.clause === "SELECT" && (!prefix || "*".startsWith(prefix))) {
    completions.push({
      label: "*",
      type: "keyword",
      detail: "All columns",
      boost: BOOST.COLUMN_IN_SCOPE + 10,
    });
  }

  return completions;
}

/**
 * Get table completions
 */
function getTableCompletions(
  data: CqlAutocompleteData,
  prefix: string,
  tablesInScope: CqlTableReference[]
): Completion[] {
  const completions: Completion[] = [];
  const inScopeNames = new Set(tablesInScope.map((t) => t.table.toLowerCase()));

  for (const table of data.tables) {
    if (!prefix || table.name.toLowerCase().startsWith(prefix)) {
      const isInScope = inScopeNames.has(table.name.toLowerCase());
      const detail = table.keyspace ? `${table.keyspace}.${table.name}` : table.name;

      completions.push({
        label: table.name,
        type: "class",
        detail,
        info: formatTableInfo(table),
        boost: isInScope ? BOOST.TABLE_IN_SCOPE : BOOST.TABLE,
      });

      // Also suggest fully qualified name
      if (table.keyspace) {
        const fqn = `${table.keyspace}.${table.name}`;
        if (!prefix || fqn.toLowerCase().startsWith(prefix)) {
          completions.push({
            label: fqn,
            type: "class",
            boost: BOOST.TABLE - 5,
          });
        }
      }
    }
  }

  return completions;
}

/**
 * Get keyspace completions
 */
function getKeyspaceCompletions(data: CqlAutocompleteData, prefix: string): Completion[] {
  const completions: Completion[] = [];

  for (const keyspace of data.keyspaces) {
    if (!prefix || keyspace.toLowerCase().startsWith(prefix)) {
      completions.push({
        label: keyspace,
        type: "namespace",
        detail: "Keyspace",
        boost: BOOST.KEYSPACE,
      });
    }
  }

  return completions;
}

/**
 * Get function completions
 */
function getFunctionCompletions(prefix: string): Completion[] {
  const completions: Completion[] = [];
  const functions = prefix ? searchCqlFunctions(prefix) : CQL_FUNCTIONS;

  for (const func of functions.slice(0, 30)) {
    completions.push({
      label: func.name,
      type: "function",
      detail: func.signature,
      info: func.description,
      apply: `${func.name}()`,
      boost: BOOST.FUNCTION,
    });
  }

  return completions;
}

/**
 * Get keyword completions
 */
function getKeywordCompletions(context: CqlContext, prefix: string): Completion[] {
  const completions: Completion[] = [];
  const relevantKeywords = getCqlKeywordsForContext(context.clause);
  const relevantSet = new Set(relevantKeywords.map((k) => k.keyword));

  for (const kw of CQL_KEYWORDS) {
    if (!prefix || kw.keyword.toLowerCase().startsWith(prefix)) {
      const isRelevant = relevantSet.has(kw.keyword);
      completions.push({
        label: kw.keyword,
        type: "keyword",
        detail: kw.description,
        boost: isRelevant ? BOOST.KEYWORD_RELEVANT : BOOST.KEYWORD_OTHER,
      });
    }
  }

  return completions;
}

/**
 * Get USING clause completions (TTL, TIMESTAMP)
 */
function getUsingClauseCompletions(prefix: string): Completion[] {
  const completions: Completion[] = [];
  const options = [
    { label: "TTL", detail: "Time To Live in seconds", apply: "TTL " },
    { label: "TIMESTAMP", detail: "Write timestamp in microseconds", apply: "TIMESTAMP " },
  ];

  for (const opt of options) {
    if (!prefix || opt.label.toLowerCase().startsWith(prefix)) {
      completions.push({
        label: opt.label,
        type: "keyword",
        detail: opt.detail,
        apply: opt.apply,
        boost: BOOST.KEYWORD_RELEVANT + 5,
      });
    }
  }

  return completions;
}

/**
 * Get operator completions
 */
function getOperatorCompletions(context: CqlContext, prefix: string): Completion[] {
  const completions: Completion[] = [];
  const opContext = context.clause === "WHERE" ? "where" : context.clause === "IF" ? "if" : "set";
  const operators = getCqlOperatorsForContext(opContext);

  for (const op of operators) {
    if (!prefix || op.operator.toLowerCase().startsWith(prefix)) {
      completions.push({
        label: op.operator,
        type: "operator",
        detail: op.description,
        boost: BOOST.OPERATOR,
      });
    }
  }

  return completions;
}

/**
 * Get value completions
 */
function getValueCompletions(_context: CqlContext, prefix: string): Completion[] {
  const completions: Completion[] = [];
  const values = [
    "NULL",
    "TRUE",
    "FALSE",
    "now()",
    "uuid()",
    "currentDate()",
    "currentTime()",
    "currentTimestamp()",
  ];

  for (const val of values) {
    if (!prefix || val.toLowerCase().startsWith(prefix)) {
      completions.push({
        label: val,
        type: "keyword",
        boost: BOOST.KEYWORD_RELEVANT,
      });
    }
  }

  return completions;
}

/**
 * Get data type completions
 */
function getDataTypeCompletions(prefix: string): Completion[] {
  const completions: Completion[] = [];

  for (const dataType of CQL_DATA_TYPES) {
    if (!prefix || dataType.toLowerCase().startsWith(prefix)) {
      completions.push({
        label: dataType,
        type: "type",
        boost: BOOST.DATA_TYPE,
      });
    }
  }

  return completions;
}

/**
 * Get CQL-specific snippets
 */
function getCqlSnippets(prefix: string): Completion[] {
  const snippets: Completion[] = [
    {
      label: "SELECT",
      type: "text",
      detail: "Basic SELECT query",
      apply: "SELECT * FROM table_name WHERE partition_key = value LIMIT 100;",
      boost: BOOST.SNIPPET,
    },
    {
      label: "INSERT",
      type: "text",
      detail: "Insert row",
      apply: "INSERT INTO table_name (col1, col2) VALUES (val1, val2);",
      boost: BOOST.SNIPPET,
    },
    {
      label: "INSERT TTL",
      type: "text",
      detail: "Insert with TTL",
      apply: "INSERT INTO table_name (col1, col2) VALUES (val1, val2) USING TTL 86400;",
      boost: BOOST.SNIPPET,
    },
    {
      label: "UPDATE",
      type: "text",
      detail: "Update row",
      apply: "UPDATE table_name SET col1 = val1 WHERE partition_key = value;",
      boost: BOOST.SNIPPET,
    },
    {
      label: "DELETE",
      type: "text",
      detail: "Delete row",
      apply: "DELETE FROM table_name WHERE partition_key = value;",
      boost: BOOST.SNIPPET,
    },
    {
      label: "BEGIN BATCH",
      type: "text",
      detail: "Batch statement",
      apply: "BEGIN BATCH\n  INSERT INTO table_name (col1, col2) VALUES (val1, val2);\n  UPDATE table_name SET col1 = val1 WHERE key = value;\nAPPLY BATCH;",
      boost: BOOST.SNIPPET,
    },
    {
      label: "CREATE TABLE",
      type: "text",
      detail: "Create table",
      apply: "CREATE TABLE IF NOT EXISTS keyspace.table_name (\n  id UUID,\n  name TEXT,\n  created_at TIMESTAMP,\n  PRIMARY KEY (id)\n);",
      boost: BOOST.SNIPPET,
    },
    {
      label: "CREATE TABLE COMPOUND",
      type: "text",
      detail: "Create table with compound key",
      apply: "CREATE TABLE IF NOT EXISTS keyspace.table_name (\n  partition_key TEXT,\n  clustering_key TIMEUUID,\n  data TEXT,\n  PRIMARY KEY ((partition_key), clustering_key)\n) WITH CLUSTERING ORDER BY (clustering_key DESC);",
      boost: BOOST.SNIPPET,
    },
    {
      label: "CREATE INDEX",
      type: "text",
      detail: "Create secondary index",
      apply: "CREATE INDEX IF NOT EXISTS idx_name ON keyspace.table_name (column_name);",
      boost: BOOST.SNIPPET,
    },
    {
      label: "LWT UPDATE",
      type: "text",
      detail: "Lightweight transaction update",
      apply: "UPDATE table_name SET col1 = new_value WHERE key = value IF col1 = old_value;",
      boost: BOOST.SNIPPET,
    },
    {
      label: "LWT INSERT",
      type: "text",
      detail: "Lightweight transaction insert",
      apply: "INSERT INTO table_name (col1, col2) VALUES (val1, val2) IF NOT EXISTS;",
      boost: BOOST.SNIPPET,
    },
    {
      label: "TOKEN",
      type: "text",
      detail: "Token-based range query",
      apply: "SELECT * FROM table_name WHERE TOKEN(partition_key) >= TOKEN(start_value) AND TOKEN(partition_key) <= TOKEN(end_value);",
      boost: BOOST.SNIPPET,
    },
  ];

  return snippets.filter(
    (s) => !prefix || s.label.toLowerCase().startsWith(prefix)
  );
}

// Helper functions

function findTableKey(tableName: string, data: CqlAutocompleteData): string | undefined {
  const tableNameLower = tableName.toLowerCase();

  for (const key of Object.keys(data.columns)) {
    const [, table] = key.split(".");
    if (table?.toLowerCase() === tableNameLower) {
      return key;
    }
  }

  for (const table of data.tables) {
    if (table.name.toLowerCase() === tableNameLower) {
      return table.keyspace ? `${table.keyspace}.${table.name}` : undefined;
    }
  }

  return undefined;
}

function getColumnBoost(col: ColumnMetadata & { keyKind?: string }): number {
  if (col.keyKind === "partition") return BOOST.COLUMN_PARTITION;
  if (col.keyKind === "clustering") return BOOST.COLUMN_CLUSTERING;
  if (col.isPrimaryKey) return BOOST.COLUMN_PARTITION;
  return BOOST.COLUMN_IN_SCOPE;
}

function formatColumnDetail(col: ColumnMetadata & { keyKind?: string }): string {
  const parts: string[] = [col.type];

  const badges: string[] = [];
  if (col.keyKind === "partition") badges.push("PK");
  else if (col.keyKind === "clustering") badges.push("CK");
  else if (col.isPrimaryKey) badges.push("PK");

  if ((col as CqlColumnMetadata).isStatic) badges.push("STATIC");

  if (badges.length > 0) {
    parts.push(badges.join(" "));
  }

  return parts.join(" • ");
}

function formatColumnInfo(col: ColumnMetadata & { keyKind?: string; clusteringOrder?: string }): string {
  const sections: string[] = [];

  sections.push(`Type: ${col.type}`);

  const constraints: string[] = [];
  if (col.keyKind === "partition") constraints.push("🔑 Partition Key");
  else if (col.keyKind === "clustering") {
    const order = col.clusteringOrder || "ASC";
    constraints.push(`📊 Clustering Column (${order})`);
  }
  else if (col.isPrimaryKey) constraints.push("🔑 Primary Key");

  if ((col as CqlColumnMetadata).isStatic) constraints.push("📌 Static");

  if (constraints.length > 0) {
    sections.push(constraints.join("\n"));
  }

  return sections.join("\n") || "";
}

function formatTableInfo(table: { partitionKeys?: string[]; clusteringColumns?: string[] }): string {
  const parts: string[] = [];

  if (table.partitionKeys && table.partitionKeys.length > 0) {
    parts.push(`Partition: ${table.partitionKeys.join(", ")}`);
  }

  if (table.clusteringColumns && table.clusteringColumns.length > 0) {
    parts.push(`Clustering: ${table.clusteringColumns.join(", ")}`);
  }

  return parts.join("\n") || "";
}
