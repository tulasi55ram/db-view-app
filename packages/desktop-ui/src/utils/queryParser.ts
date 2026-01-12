/**
 * Query parsing utilities for SQL editor
 */

/**
 * Split SQL text into individual queries by semicolons
 * Handles string literals and quoted identifiers to avoid splitting on semicolons within strings
 */
export function splitQueries(sql: string): string[] {
  const queries: string[] = [];
  let currentQuery = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inDollarQuote = false;
  let dollarQuoteTag = "";

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Handle dollar-quoted strings (PostgreSQL)
    if (char === "$" && !inSingleQuote && !inDoubleQuote && !inBacktick) {
      // Check if this starts a dollar quote
      const dollarMatch = sql.substring(i).match(/^\$(\w*)\$/);
      if (dollarMatch) {
        const tag = dollarMatch[1];
        if (inDollarQuote && tag === dollarQuoteTag) {
          // End of dollar quote
          currentQuery += dollarMatch[0];
          i += dollarMatch[0].length - 1;
          inDollarQuote = false;
          dollarQuoteTag = "";
          continue;
        } else if (!inDollarQuote) {
          // Start of dollar quote
          currentQuery += dollarMatch[0];
          i += dollarMatch[0].length - 1;
          inDollarQuote = true;
          dollarQuoteTag = tag;
          continue;
        }
      }
    }

    // Skip if we're in a dollar quote
    if (inDollarQuote) {
      currentQuery += char;
      continue;
    }

    // Handle escape sequences
    if (char === "\\" && (inSingleQuote || inDoubleQuote)) {
      currentQuery += char + (nextChar || "");
      i++; // Skip next character
      continue;
    }

    // Toggle quote states
    if (char === "'" && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote;
      currentQuery += char;
      continue;
    }

    if (char === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
      currentQuery += char;
      continue;
    }

    if (char === "`" && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
      currentQuery += char;
      continue;
    }

    // Handle semicolon outside quotes
    if (char === ";" && !inSingleQuote && !inDoubleQuote && !inBacktick) {
      currentQuery += char;
      const trimmed = currentQuery.trim();
      if (trimmed) {
        queries.push(trimmed);
      }
      currentQuery = "";
      continue;
    }

    currentQuery += char;
  }

  // Add the last query if it exists
  const trimmed = currentQuery.trim();
  if (trimmed) {
    queries.push(trimmed);
  }

  return queries;
}

/**
 * Find which query the cursor is positioned in
 * Returns the query text or undefined if not found
 */
export function getQueryAtCursor(sql: string, cursorPosition: number): string | undefined {
  const queries = splitQueries(sql);

  let currentPosition = 0;
  for (const query of queries) {
    // Find this query's position in the original text
    const queryStart = sql.indexOf(query, currentPosition);
    const queryEnd = queryStart + query.length;

    // Check if cursor is within this query
    if (cursorPosition >= queryStart && cursorPosition <= queryEnd) {
      return query;
    }

    currentPosition = queryEnd;
  }

  return undefined;
}

/**
 * Get all queries from SQL text, filtering out empty ones
 */
export function getAllQueries(sql: string): string[] {
  return splitQueries(sql).filter((q) => q.trim().length > 0);
}
