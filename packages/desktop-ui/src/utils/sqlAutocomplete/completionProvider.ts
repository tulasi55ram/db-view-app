/**
 * Smart SQL Completion Provider
 *
 * Context-aware SQL autocomplete that provides intelligent suggestions
 * based on cursor position, query structure, and database metadata.
 */

import type { CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";
import type { ColumnMetadata } from "@dbview/types";
import { getSqlContext, resolveQualifier } from "./contextParser";
import { getFunctionsForDatabase, searchFunctions } from "./functions";
import { SQL_KEYWORDS, getKeywordsForContext, getOperatorsForType, getDataTypes } from "./keywords";
import type {
  SqlContext,
  EnhancedAutocompleteData,
  SqlDatabaseType,
  TableReference,
} from "./types";

// Boost values for ranking (higher = more relevant)
const BOOST = {
  EXACT_MATCH: 100,
  COLUMN_IN_SCOPE: 50,
  FK_SUGGESTION: 45,
  COLUMN_QUALIFIED: 40,
  TABLE_IN_SCOPE: 35,
  SNIPPET: 30,
  FUNCTION: 25,
  TABLE: 20,
  SCHEMA: 15,
  KEYWORD_RELEVANT: 10,
  KEYWORD_OTHER: 5,
  OPERATOR: 8,
  DATA_TYPE: 7,
};

// Completion limits for smart filtering
const LIMITS = {
  MAX_TOTAL: 50,           // Maximum total completions
  MAX_COLUMNS: 30,         // Max columns per category
  MAX_TABLES: 20,          // Max tables
  MAX_FUNCTIONS: 25,       // Max functions
  MAX_KEYWORDS: 20,        // Max keywords
  MIN_PREFIX_FOR_ALL: 2,   // Minimum prefix length to show all matches
};

/**
 * Create a smart SQL completion function for CodeMirror
 */
export function createSmartSqlCompletion(
  getData: () => EnhancedAutocompleteData
): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext): CompletionResult | null => {
    const data = getData();
    const sqlContext = getSqlContext(context.state, context.pos);

    // Don't autocomplete in strings or comments
    if (sqlContext.inString || sqlContext.inComment) {
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
    const prefix = sqlContext.currentWord.toLowerCase();

    // Handle qualified completions (after dot)
    if (sqlContext.currentQualifier) {
      const qualifiedCompletions = getQualifiedCompletions(
        sqlContext,
        data,
        prefix
      );
      completions.push(...qualifiedCompletions);
    } else {
      // Regular completions based on expected type
      switch (sqlContext.expectedType) {
        case "column":
          completions.push(...getColumnCompletions(sqlContext, data, prefix));
          completions.push(...getKeywordCompletions(sqlContext, prefix));
          break;

        case "column_or_expression":
          completions.push(...getColumnCompletions(sqlContext, data, prefix));
          completions.push(...getFunctionCompletions(data.dbType, prefix));
          completions.push(...getKeywordCompletions(sqlContext, prefix));
          completions.push(...getAliasCompletions(sqlContext, prefix));
          break;

        case "table":
        case "table_or_schema":
          completions.push(...getTableCompletions(data, prefix, sqlContext.tablesInScope));
          completions.push(...getSchemaCompletions(data, prefix));
          completions.push(...getCTECompletions(sqlContext, prefix));
          completions.push(...getKeywordCompletions(sqlContext, prefix));
          break;

        case "schema":
          completions.push(...getSchemaCompletions(data, prefix));
          break;

        case "join_condition":
          completions.push(...getJoinConditionCompletions(sqlContext, data, prefix));
          completions.push(...getColumnCompletions(sqlContext, data, prefix));
          completions.push(...getAliasCompletions(sqlContext, prefix));
          break;

        case "operator":
          completions.push(...getOperatorCompletions(sqlContext, data, prefix));
          break;

        case "value":
          completions.push(...getValueCompletions(sqlContext, prefix));
          completions.push(...getFunctionCompletions(data.dbType, prefix));
          break;

        case "keyword":
          completions.push(...getKeywordCompletions(sqlContext, prefix));
          break;

        case "data_type":
          completions.push(...getDataTypeCompletions(data.dbType, prefix));
          break;

        case "any":
        default:
          // Show everything
          completions.push(...getColumnCompletions(sqlContext, data, prefix));
          completions.push(...getTableCompletions(data, prefix, sqlContext.tablesInScope));
          completions.push(...getSchemaCompletions(data, prefix));
          completions.push(...getFunctionCompletions(data.dbType, prefix));
          completions.push(...getKeywordCompletions(sqlContext, prefix));
          break;
      }
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

    // Apply smart filtering with limits
    const filteredCompletions = applySmartLimits(uniqueCompletions, prefix);

    return {
      from: word.from,
      options: filteredCompletions,
      validFor: /^[\w.]*$/,
    };
  };
}

/**
 * Apply smart limits to completions based on prefix length and relevance
 */
function applySmartLimits(completions: Completion[], prefix: string): Completion[] {
  // If user has typed enough, show all matches (they're filtering intentionally)
  if (prefix.length >= LIMITS.MIN_PREFIX_FOR_ALL) {
    return completions.slice(0, LIMITS.MAX_TOTAL * 2);
  }

  // Sort by boost (descending) to get most relevant first
  const sorted = [...completions].sort((a, b) => (b.boost || 0) - (a.boost || 0));

  // Group by type and apply per-category limits
  const byType: Record<string, Completion[]> = {};
  for (const c of sorted) {
    const type = c.type || "other";
    if (!byType[type]) byType[type] = [];
    byType[type].push(c);
  }

  // Apply limits per category
  const limited: Completion[] = [];

  // Add columns (highest priority when in scope)
  if (byType["property"]) {
    limited.push(...byType["property"].slice(0, LIMITS.MAX_COLUMNS));
  }

  // Add tables
  if (byType["class"]) {
    limited.push(...byType["class"].slice(0, LIMITS.MAX_TABLES));
  }

  // Add functions
  if (byType["function"]) {
    limited.push(...byType["function"].slice(0, LIMITS.MAX_FUNCTIONS));
  }

  // Add keywords
  if (byType["keyword"]) {
    limited.push(...byType["keyword"].slice(0, LIMITS.MAX_KEYWORDS));
  }

  // Add other types
  for (const [type, items] of Object.entries(byType)) {
    if (!["property", "class", "function", "keyword"].includes(type)) {
      limited.push(...items.slice(0, 10));
    }
  }

  // Final sort by boost and limit total
  return limited
    .sort((a, b) => (b.boost || 0) - (a.boost || 0))
    .slice(0, LIMITS.MAX_TOTAL);
}

/**
 * Get completions for qualified names (after dot)
 */
function getQualifiedCompletions(
  context: SqlContext,
  data: EnhancedAutocompleteData,
  prefix: string
): Completion[] {
  const completions: Completion[] = [];
  const qualifier = context.currentQualifier!;

  // Resolve what the qualifier refers to
  const resolved = resolveQualifier(qualifier, context.tablesInScope, context.ctesInScope);

  if (!resolved) {
    return completions;
  }

  if (resolved.type === "schema") {
    // Schema.table - suggest tables in this schema
    const schemaLower = resolved.name.toLowerCase();
    for (const table of data.tables) {
      if (table.schema?.toLowerCase() === schemaLower) {
        if (!prefix || table.name.toLowerCase().startsWith(prefix)) {
          completions.push({
            label: table.name,
            type: "class",
            detail: `${table.schema}.${table.name}`,
            info: table.rowCount ? `${formatRowCount(table.rowCount)} rows` : undefined,
            boost: BOOST.TABLE,
          });
        }
      }
    }
  } else {
    // Table or CTE - suggest columns
    const tableKey = resolved.schema
      ? `${resolved.schema}.${resolved.name}`
      : findTableKey(resolved.name, data);

    if (tableKey && data.columns[tableKey]) {
      for (const col of data.columns[tableKey]) {
        if (!prefix || col.name.toLowerCase().startsWith(prefix)) {
          completions.push({
            label: col.name,
            type: "property",
            detail: formatColumnDetail(col),
            boost: BOOST.COLUMN_QUALIFIED,
          });
        }
      }
    }

    // Also suggest * for SELECT
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
  context: SqlContext,
  data: EnhancedAutocompleteData,
  prefix: string
): Completion[] {
  const completions: Completion[] = [];
  const tablesInScope = context.tablesInScope;

  // If tables are in scope, prioritize their columns
  if (tablesInScope.length > 0) {
    for (const tableRef of tablesInScope) {
      const tableKey = tableRef.schema
        ? `${tableRef.schema}.${tableRef.table}`
        : findTableKey(tableRef.table, data);

      if (tableKey && data.columns[tableKey]) {
        for (const col of data.columns[tableKey]) {
          if (!prefix || col.name.toLowerCase().startsWith(prefix)) {
            const alias = tableRef.alias || tableRef.table;
            completions.push({
              label: col.name,
              type: "property",
              detail: `${alias}.${col.name} (${col.type})`,
              info: formatColumnInfo(col),
              boost: BOOST.COLUMN_IN_SCOPE,
            });

            // Also suggest qualified version if multiple tables
            if (tablesInScope.length > 1) {
              completions.push({
                label: `${alias}.${col.name}`,
                type: "property",
                detail: col.type,
                boost: BOOST.COLUMN_IN_SCOPE - 5,
              });
            }
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
  data: EnhancedAutocompleteData,
  prefix: string,
  tablesInScope: TableReference[]
): Completion[] {
  const completions: Completion[] = [];
  const inScopeNames = new Set(tablesInScope.map((t) => t.table.toLowerCase()));

  for (const table of data.tables) {
    if (!prefix || table.name.toLowerCase().startsWith(prefix)) {
      const isInScope = inScopeNames.has(table.name.toLowerCase());
      completions.push({
        label: table.name,
        type: "class",
        detail: table.schema ? `${table.schema}.${table.name}` : table.name,
        info: table.rowCount ? `${formatRowCount(table.rowCount)} rows` : undefined,
        boost: isInScope ? BOOST.TABLE_IN_SCOPE : BOOST.TABLE,
      });

      // Also suggest fully qualified name
      if (table.schema) {
        const fqn = `${table.schema}.${table.name}`;
        if (!prefix || fqn.toLowerCase().startsWith(prefix)) {
          completions.push({
            label: fqn,
            type: "class",
            detail: table.rowCount ? `${formatRowCount(table.rowCount)} rows` : undefined,
            boost: BOOST.TABLE - 5,
          });
        }
      }
    }
  }

  return completions;
}

/**
 * Get schema completions
 */
function getSchemaCompletions(data: EnhancedAutocompleteData, prefix: string): Completion[] {
  const completions: Completion[] = [];

  for (const schema of data.schemas) {
    if (!prefix || schema.toLowerCase().startsWith(prefix)) {
      completions.push({
        label: schema,
        type: "namespace",
        detail: "Schema",
        boost: BOOST.SCHEMA,
      });
    }
  }

  return completions;
}

/**
 * Get CTE completions
 */
function getCTECompletions(context: SqlContext, prefix: string): Completion[] {
  const completions: Completion[] = [];

  for (const cte of context.ctesInScope) {
    if (!prefix || cte.name.toLowerCase().startsWith(prefix)) {
      completions.push({
        label: cte.name,
        type: "class",
        detail: "CTE (Common Table Expression)",
        boost: BOOST.TABLE_IN_SCOPE,
      });
    }
  }

  return completions;
}

/**
 * Get function completions
 */
function getFunctionCompletions(dbType: SqlDatabaseType, prefix: string): Completion[] {
  const completions: Completion[] = [];
  const functions = prefix ? searchFunctions(dbType, prefix) : getFunctionsForDatabase(dbType);

  for (const func of functions.slice(0, 50)) { // Limit to 50 functions
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
function getKeywordCompletions(context: SqlContext, prefix: string): Completion[] {
  const completions: Completion[] = [];
  const relevantKeywords = getKeywordsForContext(context.clause);
  const relevantSet = new Set(relevantKeywords.map((k) => k.keyword));

  for (const kw of SQL_KEYWORDS) {
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
 * Get alias completions (for referencing table aliases)
 */
function getAliasCompletions(context: SqlContext, prefix: string): Completion[] {
  const completions: Completion[] = [];

  for (const table of context.tablesInScope) {
    const alias = table.alias || table.table;
    if (!prefix || alias.toLowerCase().startsWith(prefix)) {
      completions.push({
        label: alias,
        type: "variable",
        detail: `Alias for ${table.table}`,
        boost: BOOST.TABLE_IN_SCOPE + 5,
      });
    }
  }

  for (const cte of context.ctesInScope) {
    if (!prefix || cte.name.toLowerCase().startsWith(prefix)) {
      completions.push({
        label: cte.name,
        type: "variable",
        detail: "CTE",
        boost: BOOST.TABLE_IN_SCOPE + 5,
      });
    }
  }

  return completions;
}

/**
 * Get JOIN condition completions (FK-aware)
 */
function getJoinConditionCompletions(
  context: SqlContext,
  data: EnhancedAutocompleteData,
  prefix: string
): Completion[] {
  const completions: Completion[] = [];
  const tablesInScope = context.tablesInScope;

  if (tablesInScope.length < 2) {
    return completions;
  }

  // Find FK relationships between tables in scope
  for (const fk of data.foreignKeys) {
    const sourceTable = tablesInScope.find(
      (t) =>
        t.table.toLowerCase() === fk.sourceTable.toLowerCase() &&
        (!t.schema || t.schema.toLowerCase() === fk.sourceSchema.toLowerCase())
    );
    const targetTable = tablesInScope.find(
      (t) =>
        t.table.toLowerCase() === fk.targetTable.toLowerCase() &&
        (!t.schema || t.schema.toLowerCase() === fk.targetSchema.toLowerCase())
    );

    if (sourceTable && targetTable) {
      const sourceAlias = sourceTable.alias || sourceTable.table;
      const targetAlias = targetTable.alias || targetTable.table;

      // Suggest the FK join condition
      const condition = `${sourceAlias}.${fk.sourceColumn} = ${targetAlias}.${fk.targetColumn}`;

      if (!prefix || condition.toLowerCase().startsWith(prefix)) {
        completions.push({
          label: condition,
          type: "text",
          detail: `FK: ${fk.constraintName || "foreign key"}`,
          info: `Join ${sourceTable.table} to ${targetTable.table}`,
          boost: BOOST.FK_SUGGESTION,
        });
      }

      // Also suggest reverse
      const reverseCondition = `${targetAlias}.${fk.targetColumn} = ${sourceAlias}.${fk.sourceColumn}`;
      if (!prefix || reverseCondition.toLowerCase().startsWith(prefix)) {
        completions.push({
          label: reverseCondition,
          type: "text",
          detail: `FK: ${fk.constraintName || "foreign key"}`,
          boost: BOOST.FK_SUGGESTION - 5,
        });
      }
    }
  }

  return completions;
}

/**
 * Get operator completions based on column type
 */
function getOperatorCompletions(
  context: SqlContext,
  data: EnhancedAutocompleteData,
  prefix: string
): Completion[] {
  const completions: Completion[] = [];

  // Try to determine the column type from previous token
  let columnType = "any";
  if (context.previousToken) {
    // Look up the column type
    for (const [, columns] of Object.entries(data.columns)) {
      const col = columns.find(
        (c) => c.name.toLowerCase() === context.previousToken!.toLowerCase()
      );
      if (col) {
        columnType = col.type;
        break;
      }
    }
  }

  const operators = getOperatorsForType(columnType);

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
 * Get value completions (boolean, null, etc.)
 */
function getValueCompletions(_context: SqlContext, prefix: string): Completion[] {
  const completions: Completion[] = [];
  const values = ["NULL", "TRUE", "FALSE", "DEFAULT", "CURRENT_DATE", "CURRENT_TIMESTAMP", "NOW()"];

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
function getDataTypeCompletions(dbType: SqlDatabaseType, prefix: string): Completion[] {
  const completions: Completion[] = [];
  const types = getDataTypes(dbType);

  for (const dataType of types) {
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

// Helper functions

function findTableKey(tableName: string, data: EnhancedAutocompleteData): string | undefined {
  const tableNameLower = tableName.toLowerCase();

  // First check if it's a direct match
  for (const key of Object.keys(data.columns)) {
    const [, table] = key.split(".");
    if (table?.toLowerCase() === tableNameLower) {
      return key;
    }
  }

  // Check in tables list
  for (const table of data.tables) {
    if (table.name.toLowerCase() === tableNameLower) {
      return table.schema ? `${table.schema}.${table.name}` : undefined;
    }
  }

  return undefined;
}

function formatRowCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

function formatColumnDetail(col: ColumnMetadata): string {
  const parts: string[] = [col.type];

  // Add constraints badges
  const badges: string[] = [];
  if (col.isPrimaryKey) badges.push("PK");
  if (col.isForeignKey) badges.push("FK");
  if (col.isAutoIncrement) badges.push("AUTO");
  if (col.isGenerated) badges.push("GEN");
  if (!col.nullable) badges.push("NOT NULL");

  if (badges.length > 0) {
    parts.push(badges.join(" "));
  }

  return parts.join(" • ");
}

function formatColumnInfo(col: ColumnMetadata): string {
  const sections: string[] = [];

  // Type information with precision/scale
  let typeInfo = `Type: ${col.type}`;
  if (col.maxLength) typeInfo += `(${col.maxLength})`;
  if (col.numericPrecision) {
    typeInfo += `(${col.numericPrecision}${col.numericScale ? `,${col.numericScale}` : ""})`;
  }
  sections.push(typeInfo);

  // Constraints
  const constraints: string[] = [];
  if (col.isPrimaryKey) constraints.push("🔑 Primary Key");
  if (col.isForeignKey && col.foreignKeyRef) constraints.push(`🔗 FK → ${col.foreignKeyRef}`);
  if (col.isAutoIncrement) constraints.push("⚡ Auto-increment");
  if (col.isGenerated) constraints.push("📐 Generated");
  if (!col.nullable) constraints.push("⊘ NOT NULL");
  else constraints.push("○ Nullable");

  if (constraints.length > 0) {
    sections.push(constraints.join("\n"));
  }

  // Default value
  if (col.defaultValue !== undefined && col.defaultValue !== null) {
    sections.push(`Default: ${col.defaultValue}`);
  }

  // Enum values if available
  if (col.enumValues && col.enumValues.length > 0) {
    const enumDisplay = col.enumValues.slice(0, 5).join(", ");
    const suffix = col.enumValues.length > 5 ? `, +${col.enumValues.length - 5} more` : "";
    sections.push(`Enum: ${enumDisplay}${suffix}`);
  }

  // Editable status
  if (!col.editable) {
    sections.push("🔒 Read-only");
  }

  return sections.join("\n") || "";
}
