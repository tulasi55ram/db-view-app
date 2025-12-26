import { snippetCompletion } from "@codemirror/autocomplete";
import type { Completion } from "@codemirror/autocomplete";

/**
 * Built-in SQL snippet templates with interactive placeholders
 *
 * Uses CodeMirror 6 snippet syntax:
 * - ${name} - Placeholder with default text "name"
 * - ${1:default} - Numbered placeholder with custom tab order
 * - Same number (e.g., ${1:t1}) = linked fields (edit one updates all)
 * - Final ${} - Empty placeholder, deactivates snippet on Tab
 *
 * Tab navigation:
 * - Tab → Move to next placeholder
 * - Shift+Tab → Move to previous placeholder
 * - Escape → Clear snippet and return to normal editing
 */
export const SQL_SNIPPETS: Completion[] = [
  // SELECT - Basic query
  snippetCompletion(
    "SELECT ${columns}\nFROM ${table}\nWHERE ${condition}\nLIMIT ${limit};${}",
    {
      label: "SELECT",
      detail: "Basic SELECT query",
      type: "snippet",
      boost: 10,
    }
  ),

  // SELECT JOIN - Inner join with aliases
  snippetCompletion(
    "SELECT ${1:t1}.${2:column1}, ${3:t2}.${4:column2}\nFROM ${5:table1} ${1:t1}\nINNER JOIN ${6:table2} ${3:t2} ON ${1:t1}.${7:id} = ${3:t2}.${8:foreign_id}\nWHERE ${9:condition}\nLIMIT ${10:50};${}",
    {
      label: "SELECT JOIN",
      detail: "SELECT with INNER JOIN",
      type: "snippet",
      boost: 9,
    }
  ),

  // INSERT - Insert new row
  snippetCompletion(
    "INSERT INTO ${1:table} (${2:column1}, ${3:column2}, ${4:column3})\nVALUES (${5:value1}, ${6:value2}, ${7:value3})\nRETURNING *;${}",
    {
      label: "INSERT",
      detail: "Insert new row",
      type: "snippet",
      boost: 8,
    }
  ),

  // UPDATE - Update existing rows
  snippetCompletion(
    "UPDATE ${1:table}\nSET ${2:column1} = ${3:value1},\n    ${4:column2} = ${5:value2}\nWHERE ${6:id} = ${7:value}\nRETURNING *;${}",
    {
      label: "UPDATE",
      detail: "Update existing rows",
      type: "snippet",
      boost: 8,
    }
  ),

  // DELETE - Delete rows
  snippetCompletion(
    "DELETE FROM ${1:table}\nWHERE ${2:condition}\nRETURNING *;${}",
    {
      label: "DELETE",
      detail: "Delete rows",
      type: "snippet",
      boost: 8,
    }
  ),

  // CREATE TABLE - Create new table
  snippetCompletion(
    "CREATE TABLE ${1:table_name} (\n  ${2:id} SERIAL PRIMARY KEY,\n  ${3:column1} ${4:VARCHAR(255)} NOT NULL,\n  ${5:column2} ${6:INTEGER},\n  ${7:created_at} TIMESTAMP DEFAULT NOW()\n);${}",
    {
      label: "CREATE TABLE",
      detail: "Create new table",
      type: "snippet",
      boost: 7,
    }
  ),

  // LEFT JOIN - Left outer join
  snippetCompletion(
    "SELECT ${1:t1}.${2:*}\nFROM ${3:table1} ${1:t1}\nLEFT JOIN ${4:table2} ${5:t2} ON ${1:t1}.${6:id} = ${5:t2}.${7:foreign_id}\nWHERE ${8:condition};${}",
    {
      label: "LEFT JOIN",
      detail: "SELECT with LEFT JOIN",
      type: "snippet",
      boost: 9,
    }
  ),

  // COUNT GROUP - Aggregation with GROUP BY
  snippetCompletion(
    "SELECT ${1:column}, COUNT(*) as ${2:count}\nFROM ${3:table}\nGROUP BY ${1:column}\nORDER BY ${2:count} DESC\nLIMIT ${4:10};${}",
    {
      label: "COUNT GROUP",
      detail: "Count with GROUP BY",
      type: "snippet",
      boost: 7,
    }
  ),
];
