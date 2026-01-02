/**
 * Database-specific SQL function libraries
 *
 * Comprehensive function definitions for PostgreSQL, MySQL, MariaDB, SQL Server, and SQLite
 */

import type { SqlFunction, SqlDatabaseType, FunctionCategory } from "./types";

// Helper to create function definitions
function fn(
  name: string,
  signature: string,
  description: string,
  returnType: string,
  category: FunctionCategory,
  supportedDatabases: SqlDatabaseType[]
): SqlFunction {
  return { name, signature, description, returnType, category, supportedDatabases };
}

const ALL_DBS: SqlDatabaseType[] = ["postgres", "mysql", "mariadb", "sqlserver", "sqlite"];
const PG_ONLY: SqlDatabaseType[] = ["postgres"];
const MYSQL_MARIA: SqlDatabaseType[] = ["mysql", "mariadb"];
const SQLSERVER_ONLY: SqlDatabaseType[] = ["sqlserver"];
const SQLITE_ONLY: SqlDatabaseType[] = ["sqlite"];
const NOT_SQLITE: SqlDatabaseType[] = ["postgres", "mysql", "mariadb", "sqlserver"];

/**
 * All SQL functions organized by category
 */
export const SQL_FUNCTIONS: SqlFunction[] = [
  // ==================== AGGREGATE FUNCTIONS ====================
  fn("COUNT", "COUNT(expression)", "Count number of rows", "bigint", "aggregate", ALL_DBS),
  fn("COUNT", "COUNT(*)", "Count all rows including NULLs", "bigint", "aggregate", ALL_DBS),
  fn("COUNT", "COUNT(DISTINCT expression)", "Count unique values", "bigint", "aggregate", ALL_DBS),
  fn("SUM", "SUM(expression)", "Sum of values", "numeric", "aggregate", ALL_DBS),
  fn("AVG", "AVG(expression)", "Average of values", "numeric", "aggregate", ALL_DBS),
  fn("MIN", "MIN(expression)", "Minimum value", "same as input", "aggregate", ALL_DBS),
  fn("MAX", "MAX(expression)", "Maximum value", "same as input", "aggregate", ALL_DBS),
  fn("ARRAY_AGG", "ARRAY_AGG(expression)", "Aggregate values into array", "array", "aggregate", PG_ONLY),
  fn("STRING_AGG", "STRING_AGG(expression, delimiter)", "Concatenate strings with delimiter", "text", "aggregate", ["postgres", "sqlserver"]),
  fn("GROUP_CONCAT", "GROUP_CONCAT(expression SEPARATOR ',')", "Concatenate strings with delimiter", "text", "aggregate", MYSQL_MARIA),
  fn("JSON_AGG", "JSON_AGG(expression)", "Aggregate values as JSON array", "json", "aggregate", PG_ONLY),
  fn("JSONB_AGG", "JSONB_AGG(expression)", "Aggregate values as JSONB array", "jsonb", "aggregate", PG_ONLY),
  fn("JSON_OBJECT_AGG", "JSON_OBJECT_AGG(key, value)", "Aggregate key-value pairs as JSON object", "json", "aggregate", PG_ONLY),
  fn("BOOL_AND", "BOOL_AND(expression)", "True if all values are true", "boolean", "aggregate", PG_ONLY),
  fn("BOOL_OR", "BOOL_OR(expression)", "True if any value is true", "boolean", "aggregate", PG_ONLY),
  fn("BIT_AND", "BIT_AND(expression)", "Bitwise AND of all values", "integer", "aggregate", NOT_SQLITE),
  fn("BIT_OR", "BIT_OR(expression)", "Bitwise OR of all values", "integer", "aggregate", NOT_SQLITE),
  fn("STDDEV", "STDDEV(expression)", "Standard deviation", "numeric", "aggregate", NOT_SQLITE),
  fn("STDDEV_POP", "STDDEV_POP(expression)", "Population standard deviation", "numeric", "aggregate", NOT_SQLITE),
  fn("STDDEV_SAMP", "STDDEV_SAMP(expression)", "Sample standard deviation", "numeric", "aggregate", NOT_SQLITE),
  fn("VARIANCE", "VARIANCE(expression)", "Variance", "numeric", "aggregate", NOT_SQLITE),
  fn("VAR_POP", "VAR_POP(expression)", "Population variance", "numeric", "aggregate", NOT_SQLITE),
  fn("VAR_SAMP", "VAR_SAMP(expression)", "Sample variance", "numeric", "aggregate", NOT_SQLITE),

  // ==================== STRING FUNCTIONS ====================
  fn("CONCAT", "CONCAT(str1, str2, ...)", "Concatenate strings", "text", "string", ALL_DBS),
  fn("CONCAT_WS", "CONCAT_WS(separator, str1, str2, ...)", "Concatenate with separator", "text", "string", NOT_SQLITE),
  fn("LENGTH", "LENGTH(string)", "Length of string in characters", "integer", "string", ALL_DBS),
  fn("CHAR_LENGTH", "CHAR_LENGTH(string)", "Character length of string", "integer", "string", NOT_SQLITE),
  fn("OCTET_LENGTH", "OCTET_LENGTH(string)", "Length in bytes", "integer", "string", ["postgres", "mysql", "mariadb"]),
  fn("UPPER", "UPPER(string)", "Convert to uppercase", "text", "string", ALL_DBS),
  fn("LOWER", "LOWER(string)", "Convert to lowercase", "text", "string", ALL_DBS),
  fn("TRIM", "TRIM(string)", "Remove leading/trailing whitespace", "text", "string", ALL_DBS),
  fn("LTRIM", "LTRIM(string)", "Remove leading whitespace", "text", "string", ALL_DBS),
  fn("RTRIM", "RTRIM(string)", "Remove trailing whitespace", "text", "string", ALL_DBS),
  fn("SUBSTRING", "SUBSTRING(string FROM start FOR length)", "Extract substring", "text", "string", ALL_DBS),
  fn("SUBSTR", "SUBSTR(string, start, length)", "Extract substring", "text", "string", ALL_DBS),
  fn("LEFT", "LEFT(string, n)", "Get leftmost n characters", "text", "string", NOT_SQLITE),
  fn("RIGHT", "RIGHT(string, n)", "Get rightmost n characters", "text", "string", NOT_SQLITE),
  fn("REPLACE", "REPLACE(string, from, to)", "Replace occurrences", "text", "string", ALL_DBS),
  fn("REVERSE", "REVERSE(string)", "Reverse string", "text", "string", NOT_SQLITE),
  fn("REPEAT", "REPEAT(string, n)", "Repeat string n times", "text", "string", NOT_SQLITE),
  fn("LPAD", "LPAD(string, length, pad)", "Pad left to length", "text", "string", NOT_SQLITE),
  fn("RPAD", "RPAD(string, length, pad)", "Pad right to length", "text", "string", NOT_SQLITE),
  fn("POSITION", "POSITION(substring IN string)", "Position of substring", "integer", "string", NOT_SQLITE),
  fn("STRPOS", "STRPOS(string, substring)", "Position of substring", "integer", "string", PG_ONLY),
  fn("INSTR", "INSTR(string, substring)", "Position of substring", "integer", "string", [...MYSQL_MARIA, "sqlite"]),
  fn("SPLIT_PART", "SPLIT_PART(string, delimiter, n)", "Get nth part after splitting", "text", "string", PG_ONLY),
  fn("INITCAP", "INITCAP(string)", "Capitalize first letter of each word", "text", "string", PG_ONLY),
  fn("TRANSLATE", "TRANSLATE(string, from, to)", "Replace characters", "text", "string", PG_ONLY),
  fn("ASCII", "ASCII(character)", "ASCII code of character", "integer", "string", NOT_SQLITE),
  fn("CHR", "CHR(code)", "Character from ASCII code", "text", "string", ["postgres", "sqlite"]),
  fn("CHAR", "CHAR(code)", "Character from ASCII code", "text", "string", MYSQL_MARIA),
  fn("MD5", "MD5(string)", "MD5 hash of string", "text", "string", ["postgres", "mysql", "mariadb"]),
  fn("SHA1", "SHA1(string)", "SHA1 hash", "text", "string", MYSQL_MARIA),
  fn("SHA256", "SHA256(string)", "SHA256 hash", "text", "string", PG_ONLY),
  fn("ENCODE", "ENCODE(data, format)", "Encode binary data", "text", "string", PG_ONLY),
  fn("DECODE", "DECODE(string, format)", "Decode to binary", "bytea", "string", PG_ONLY),
  fn("FORMAT", "FORMAT(format_string, args...)", "Format string", "text", "string", ["postgres", "mysql", "mariadb", "sqlserver"]),
  fn("QUOTE_IDENT", "QUOTE_IDENT(string)", "Quote identifier", "text", "string", PG_ONLY),
  fn("QUOTE_LITERAL", "QUOTE_LITERAL(string)", "Quote literal", "text", "string", PG_ONLY),
  fn("REGEXP_REPLACE", "REGEXP_REPLACE(string, pattern, replacement)", "Regex replace", "text", "string", ["postgres", "mysql", "mariadb"]),
  fn("REGEXP_MATCHES", "REGEXP_MATCHES(string, pattern)", "Regex matches", "text[]", "string", PG_ONLY),
  fn("REGEXP_SUBSTR", "REGEXP_SUBSTR(string, pattern)", "Regex substring", "text", "string", MYSQL_MARIA),

  // ==================== NUMERIC FUNCTIONS ====================
  fn("ABS", "ABS(number)", "Absolute value", "numeric", "numeric", ALL_DBS),
  fn("ROUND", "ROUND(number, decimals)", "Round to decimals", "numeric", "numeric", ALL_DBS),
  fn("FLOOR", "FLOOR(number)", "Round down to integer", "numeric", "numeric", ALL_DBS),
  fn("CEIL", "CEIL(number)", "Round up to integer", "numeric", "numeric", ALL_DBS),
  fn("CEILING", "CEILING(number)", "Round up to integer", "numeric", "numeric", NOT_SQLITE),
  fn("TRUNC", "TRUNC(number, decimals)", "Truncate to decimals", "numeric", "numeric", ["postgres", "mysql", "mariadb"]),
  fn("TRUNCATE", "TRUNCATE(number, decimals)", "Truncate to decimals", "numeric", "numeric", MYSQL_MARIA),
  fn("MOD", "MOD(a, b)", "Modulo (remainder)", "numeric", "numeric", NOT_SQLITE),
  fn("POWER", "POWER(base, exponent)", "Raise to power", "numeric", "numeric", ALL_DBS),
  fn("SQRT", "SQRT(number)", "Square root", "numeric", "numeric", ALL_DBS),
  fn("EXP", "EXP(number)", "Exponential (e^n)", "numeric", "numeric", ALL_DBS),
  fn("LN", "LN(number)", "Natural logarithm", "numeric", "numeric", ALL_DBS),
  fn("LOG", "LOG(number)", "Logarithm base 10", "numeric", "numeric", ALL_DBS),
  fn("LOG10", "LOG10(number)", "Logarithm base 10", "numeric", "numeric", NOT_SQLITE),
  fn("LOG2", "LOG2(number)", "Logarithm base 2", "numeric", "numeric", MYSQL_MARIA),
  fn("SIGN", "SIGN(number)", "Sign of number (-1, 0, 1)", "integer", "numeric", ALL_DBS),
  fn("PI", "PI()", "Value of pi", "numeric", "numeric", NOT_SQLITE),
  fn("DEGREES", "DEGREES(radians)", "Convert radians to degrees", "numeric", "numeric", NOT_SQLITE),
  fn("RADIANS", "RADIANS(degrees)", "Convert degrees to radians", "numeric", "numeric", NOT_SQLITE),
  fn("SIN", "SIN(radians)", "Sine", "numeric", "numeric", ALL_DBS),
  fn("COS", "COS(radians)", "Cosine", "numeric", "numeric", ALL_DBS),
  fn("TAN", "TAN(radians)", "Tangent", "numeric", "numeric", ALL_DBS),
  fn("ASIN", "ASIN(number)", "Arc sine", "numeric", "numeric", ALL_DBS),
  fn("ACOS", "ACOS(number)", "Arc cosine", "numeric", "numeric", ALL_DBS),
  fn("ATAN", "ATAN(number)", "Arc tangent", "numeric", "numeric", ALL_DBS),
  fn("ATAN2", "ATAN2(y, x)", "Arc tangent of y/x", "numeric", "numeric", NOT_SQLITE),
  fn("RANDOM", "RANDOM()", "Random value between 0 and 1", "numeric", "numeric", ["postgres", "sqlite"]),
  fn("RAND", "RAND()", "Random value between 0 and 1", "numeric", "numeric", MYSQL_MARIA),
  fn("NEWID", "NEWID()", "Random UUID", "uniqueidentifier", "numeric", SQLSERVER_ONLY),
  fn("GREATEST", "GREATEST(val1, val2, ...)", "Greatest value", "same as input", "numeric", ["postgres", "mysql", "mariadb", "sqlite"]),
  fn("LEAST", "LEAST(val1, val2, ...)", "Least value", "same as input", "numeric", ["postgres", "mysql", "mariadb", "sqlite"]),

  // ==================== DATE/TIME FUNCTIONS ====================
  fn("NOW", "NOW()", "Current date and time", "timestamp", "date", NOT_SQLITE),
  fn("CURRENT_DATE", "CURRENT_DATE", "Current date", "date", "date", ALL_DBS),
  fn("CURRENT_TIME", "CURRENT_TIME", "Current time", "time", "date", ALL_DBS),
  fn("CURRENT_TIMESTAMP", "CURRENT_TIMESTAMP", "Current timestamp", "timestamp", "date", ALL_DBS),
  fn("LOCALTIMESTAMP", "LOCALTIMESTAMP", "Current timestamp without timezone", "timestamp", "date", ["postgres", "mysql", "mariadb"]),
  fn("DATE", "DATE(expression)", "Extract date part", "date", "date", ALL_DBS),
  fn("TIME", "TIME(expression)", "Extract time part", "time", "date", MYSQL_MARIA),
  fn("EXTRACT", "EXTRACT(field FROM timestamp)", "Extract date/time field", "numeric", "date", NOT_SQLITE),
  fn("DATE_PART", "DATE_PART(field, timestamp)", "Extract date/time field", "numeric", "date", PG_ONLY),
  fn("DATE_TRUNC", "DATE_TRUNC(field, timestamp)", "Truncate to specified precision", "timestamp", "date", PG_ONLY),
  fn("DATE_ADD", "DATE_ADD(date, INTERVAL n unit)", "Add interval to date", "date", "date", MYSQL_MARIA),
  fn("DATE_SUB", "DATE_SUB(date, INTERVAL n unit)", "Subtract interval from date", "date", "date", MYSQL_MARIA),
  fn("DATEADD", "DATEADD(unit, n, date)", "Add interval to date", "datetime", "date", SQLSERVER_ONLY),
  fn("DATEDIFF", "DATEDIFF(date1, date2)", "Difference between dates", "integer", "date", [...MYSQL_MARIA, "sqlserver"]),
  fn("TIMESTAMPDIFF", "TIMESTAMPDIFF(unit, start, end)", "Difference in specified units", "integer", "date", MYSQL_MARIA),
  fn("AGE", "AGE(timestamp1, timestamp2)", "Interval between timestamps", "interval", "date", PG_ONLY),
  fn("YEAR", "YEAR(date)", "Extract year", "integer", "date", [...MYSQL_MARIA, "sqlserver"]),
  fn("MONTH", "MONTH(date)", "Extract month", "integer", "date", [...MYSQL_MARIA, "sqlserver"]),
  fn("DAY", "DAY(date)", "Extract day", "integer", "date", [...MYSQL_MARIA, "sqlserver"]),
  fn("HOUR", "HOUR(time)", "Extract hour", "integer", "date", MYSQL_MARIA),
  fn("MINUTE", "MINUTE(time)", "Extract minute", "integer", "date", MYSQL_MARIA),
  fn("SECOND", "SECOND(time)", "Extract second", "integer", "date", MYSQL_MARIA),
  fn("DAYOFWEEK", "DAYOFWEEK(date)", "Day of week (1=Sunday)", "integer", "date", MYSQL_MARIA),
  fn("DAYOFYEAR", "DAYOFYEAR(date)", "Day of year", "integer", "date", MYSQL_MARIA),
  fn("WEEK", "WEEK(date)", "Week number", "integer", "date", MYSQL_MARIA),
  fn("QUARTER", "QUARTER(date)", "Quarter (1-4)", "integer", "date", MYSQL_MARIA),
  fn("TO_CHAR", "TO_CHAR(timestamp, format)", "Format timestamp as string", "text", "date", PG_ONLY),
  fn("TO_DATE", "TO_DATE(string, format)", "Parse string to date", "date", "date", PG_ONLY),
  fn("TO_TIMESTAMP", "TO_TIMESTAMP(string, format)", "Parse string to timestamp", "timestamp", "date", PG_ONLY),
  fn("STR_TO_DATE", "STR_TO_DATE(string, format)", "Parse string to date", "date", "date", MYSQL_MARIA),
  fn("DATE_FORMAT", "DATE_FORMAT(date, format)", "Format date as string", "text", "date", MYSQL_MARIA),
  fn("STRFTIME", "STRFTIME(format, datetime)", "Format datetime as string", "text", "date", SQLITE_ONLY),
  fn("DATETIME", "DATETIME(timestring, modifier...)", "Create datetime", "text", "date", SQLITE_ONLY),
  fn("JULIANDAY", "JULIANDAY(timestring)", "Julian day number", "real", "date", SQLITE_ONLY),
  fn("MAKE_DATE", "MAKE_DATE(year, month, day)", "Create date from parts", "date", "date", PG_ONLY),
  fn("MAKE_TIME", "MAKE_TIME(hour, minute, second)", "Create time from parts", "time", "date", PG_ONLY),
  fn("MAKE_TIMESTAMP", "MAKE_TIMESTAMP(year, month, day, hour, min, sec)", "Create timestamp", "timestamp", "date", PG_ONLY),
  fn("GENERATE_SERIES", "GENERATE_SERIES(start, stop, step)", "Generate series of values", "setof", "date", PG_ONLY),

  // ==================== CONVERSION FUNCTIONS ====================
  fn("CAST", "CAST(expression AS type)", "Convert to type", "varies", "conversion", ALL_DBS),
  fn("CONVERT", "CONVERT(type, expression)", "Convert to type", "varies", "conversion", SQLSERVER_ONLY),
  fn("COALESCE", "COALESCE(val1, val2, ...)", "First non-null value", "same as input", "conversion", ALL_DBS),
  fn("NULLIF", "NULLIF(val1, val2)", "NULL if values are equal", "same as input", "conversion", ALL_DBS),
  fn("IFNULL", "IFNULL(expression, default)", "Default if NULL", "same as input", "conversion", [...MYSQL_MARIA, "sqlite"]),
  fn("ISNULL", "ISNULL(expression, default)", "Default if NULL", "same as input", "conversion", SQLSERVER_ONLY),
  fn("NVL", "NVL(expression, default)", "Default if NULL", "same as input", "conversion", PG_ONLY),
  fn("TRY_CAST", "TRY_CAST(expression AS type)", "Cast or NULL on failure", "varies", "conversion", SQLSERVER_ONLY),

  // ==================== CONDITIONAL FUNCTIONS ====================
  fn("CASE", "CASE WHEN condition THEN result ELSE default END", "Conditional expression", "varies", "conditional", ALL_DBS),
  fn("IF", "IF(condition, true_val, false_val)", "Conditional value", "varies", "conditional", MYSQL_MARIA),
  fn("IIF", "IIF(condition, true_val, false_val)", "Conditional value", "varies", "conditional", SQLSERVER_ONLY),
  fn("GREATEST", "GREATEST(val1, val2, ...)", "Return greatest value", "varies", "conditional", ["postgres", "mysql", "mariadb"]),
  fn("LEAST", "LEAST(val1, val2, ...)", "Return least value", "varies", "conditional", ["postgres", "mysql", "mariadb"]),

  // ==================== WINDOW FUNCTIONS ====================
  fn("ROW_NUMBER", "ROW_NUMBER() OVER (ORDER BY ...)", "Row number in partition", "bigint", "window", NOT_SQLITE),
  fn("RANK", "RANK() OVER (ORDER BY ...)", "Rank with gaps", "bigint", "window", NOT_SQLITE),
  fn("DENSE_RANK", "DENSE_RANK() OVER (ORDER BY ...)", "Rank without gaps", "bigint", "window", NOT_SQLITE),
  fn("NTILE", "NTILE(n) OVER (ORDER BY ...)", "Divide into n buckets", "integer", "window", NOT_SQLITE),
  fn("LAG", "LAG(column, offset, default) OVER (...)", "Previous row value", "same as input", "window", NOT_SQLITE),
  fn("LEAD", "LEAD(column, offset, default) OVER (...)", "Next row value", "same as input", "window", NOT_SQLITE),
  fn("FIRST_VALUE", "FIRST_VALUE(column) OVER (...)", "First value in partition", "same as input", "window", NOT_SQLITE),
  fn("LAST_VALUE", "LAST_VALUE(column) OVER (...)", "Last value in partition", "same as input", "window", NOT_SQLITE),
  fn("NTH_VALUE", "NTH_VALUE(column, n) OVER (...)", "Nth value in partition", "same as input", "window", NOT_SQLITE),
  fn("PERCENT_RANK", "PERCENT_RANK() OVER (...)", "Relative rank (0-1)", "numeric", "window", NOT_SQLITE),
  fn("CUME_DIST", "CUME_DIST() OVER (...)", "Cumulative distribution", "numeric", "window", NOT_SQLITE),

  // ==================== JSON FUNCTIONS ====================
  // PostgreSQL JSON
  fn("JSON_BUILD_OBJECT", "JSON_BUILD_OBJECT(key1, val1, ...)", "Build JSON object", "json", "json", PG_ONLY),
  fn("JSON_BUILD_ARRAY", "JSON_BUILD_ARRAY(val1, val2, ...)", "Build JSON array", "json", "json", PG_ONLY),
  fn("JSONB_BUILD_OBJECT", "JSONB_BUILD_OBJECT(key1, val1, ...)", "Build JSONB object", "jsonb", "json", PG_ONLY),
  fn("JSONB_BUILD_ARRAY", "JSONB_BUILD_ARRAY(val1, val2, ...)", "Build JSONB array", "jsonb", "json", PG_ONLY),
  fn("JSON_EXTRACT_PATH", "JSON_EXTRACT_PATH(json, path...)", "Extract JSON path", "json", "json", PG_ONLY),
  fn("JSON_EXTRACT_PATH_TEXT", "JSON_EXTRACT_PATH_TEXT(json, path...)", "Extract JSON path as text", "text", "json", PG_ONLY),
  fn("JSONB_EXTRACT_PATH", "JSONB_EXTRACT_PATH(jsonb, path...)", "Extract JSONB path", "jsonb", "json", PG_ONLY),
  fn("JSONB_EXTRACT_PATH_TEXT", "JSONB_EXTRACT_PATH_TEXT(jsonb, path...)", "Extract JSONB path as text", "text", "json", PG_ONLY),
  fn("JSON_ARRAY_LENGTH", "JSON_ARRAY_LENGTH(json)", "Length of JSON array", "integer", "json", PG_ONLY),
  fn("JSONB_ARRAY_LENGTH", "JSONB_ARRAY_LENGTH(jsonb)", "Length of JSONB array", "integer", "json", PG_ONLY),
  fn("JSON_TYPEOF", "JSON_TYPEOF(json)", "Type of JSON value", "text", "json", PG_ONLY),
  fn("JSONB_TYPEOF", "JSONB_TYPEOF(jsonb)", "Type of JSONB value", "text", "json", PG_ONLY),
  fn("JSONB_SET", "JSONB_SET(jsonb, path, new_value)", "Set value at path", "jsonb", "json", PG_ONLY),
  fn("JSONB_INSERT", "JSONB_INSERT(jsonb, path, new_value)", "Insert value at path", "jsonb", "json", PG_ONLY),
  fn("JSONB_PRETTY", "JSONB_PRETTY(jsonb)", "Pretty print JSONB", "text", "json", PG_ONLY),
  fn("TO_JSON", "TO_JSON(value)", "Convert to JSON", "json", "json", PG_ONLY),
  fn("TO_JSONB", "TO_JSONB(value)", "Convert to JSONB", "jsonb", "json", PG_ONLY),
  fn("JSON_STRIP_NULLS", "JSON_STRIP_NULLS(json)", "Remove null values", "json", "json", PG_ONLY),
  fn("JSONB_STRIP_NULLS", "JSONB_STRIP_NULLS(jsonb)", "Remove null values", "jsonb", "json", PG_ONLY),

  // MySQL JSON
  fn("JSON_EXTRACT", "JSON_EXTRACT(json, path)", "Extract JSON value", "json", "json", MYSQL_MARIA),
  fn("JSON_UNQUOTE", "JSON_UNQUOTE(json)", "Unquote JSON string", "text", "json", MYSQL_MARIA),
  fn("JSON_OBJECT", "JSON_OBJECT(key1, val1, ...)", "Create JSON object", "json", "json", MYSQL_MARIA),
  fn("JSON_ARRAY", "JSON_ARRAY(val1, val2, ...)", "Create JSON array", "json", "json", MYSQL_MARIA),
  fn("JSON_SET", "JSON_SET(json, path, val)", "Set JSON value", "json", "json", MYSQL_MARIA),
  fn("JSON_INSERT", "JSON_INSERT(json, path, val)", "Insert JSON value", "json", "json", MYSQL_MARIA),
  fn("JSON_REPLACE", "JSON_REPLACE(json, path, val)", "Replace JSON value", "json", "json", MYSQL_MARIA),
  fn("JSON_REMOVE", "JSON_REMOVE(json, path)", "Remove JSON value", "json", "json", MYSQL_MARIA),
  fn("JSON_CONTAINS", "JSON_CONTAINS(json, value)", "Check if JSON contains value", "boolean", "json", MYSQL_MARIA),
  fn("JSON_KEYS", "JSON_KEYS(json)", "Get JSON object keys", "json", "json", MYSQL_MARIA),
  fn("JSON_LENGTH", "JSON_LENGTH(json)", "Length of JSON", "integer", "json", MYSQL_MARIA),
  fn("JSON_TYPE", "JSON_TYPE(json)", "Type of JSON value", "text", "json", MYSQL_MARIA),
  fn("JSON_VALID", "JSON_VALID(string)", "Check if valid JSON", "boolean", "json", MYSQL_MARIA),

  // SQL Server JSON
  fn("JSON_VALUE", "JSON_VALUE(json, path)", "Extract scalar value", "nvarchar", "json", SQLSERVER_ONLY),
  fn("JSON_QUERY", "JSON_QUERY(json, path)", "Extract object or array", "nvarchar", "json", SQLSERVER_ONLY),
  fn("JSON_MODIFY", "JSON_MODIFY(json, path, value)", "Modify JSON", "nvarchar", "json", SQLSERVER_ONLY),
  fn("ISJSON", "ISJSON(string)", "Check if valid JSON", "int", "json", SQLSERVER_ONLY),
  fn("OPENJSON", "OPENJSON(json)", "Parse JSON to table", "table", "json", SQLSERVER_ONLY),

  // SQLite JSON
  fn("JSON", "JSON(string)", "Validate and minify JSON", "text", "json", SQLITE_ONLY),
  fn("JSON_EXTRACT", "JSON_EXTRACT(json, path)", "Extract JSON value", "text", "json", SQLITE_ONLY),
  fn("JSON_INSERT", "JSON_INSERT(json, path, value)", "Insert JSON value", "text", "json", SQLITE_ONLY),
  fn("JSON_REPLACE", "JSON_REPLACE(json, path, value)", "Replace JSON value", "text", "json", SQLITE_ONLY),
  fn("JSON_SET", "JSON_SET(json, path, value)", "Set JSON value", "text", "json", SQLITE_ONLY),
  fn("JSON_REMOVE", "JSON_REMOVE(json, path)", "Remove JSON value", "text", "json", SQLITE_ONLY),
  fn("JSON_TYPE", "JSON_TYPE(json)", "Type of JSON value", "text", "json", SQLITE_ONLY),
  fn("JSON_VALID", "JSON_VALID(string)", "Check if valid JSON", "integer", "json", SQLITE_ONLY),
  fn("JSON_ARRAY_LENGTH", "JSON_ARRAY_LENGTH(json)", "Length of JSON array", "integer", "json", SQLITE_ONLY),
  fn("JSON_EACH", "JSON_EACH(json)", "Iterate JSON elements", "table", "json", SQLITE_ONLY),
  fn("JSON_TREE", "JSON_TREE(json)", "Walk JSON tree", "table", "json", SQLITE_ONLY),

  // ==================== ARRAY FUNCTIONS (PostgreSQL) ====================
  fn("ARRAY_LENGTH", "ARRAY_LENGTH(array, dimension)", "Length of array dimension", "integer", "array", PG_ONLY),
  fn("ARRAY_DIMS", "ARRAY_DIMS(array)", "Array dimensions as text", "text", "array", PG_ONLY),
  fn("ARRAY_UPPER", "ARRAY_UPPER(array, dimension)", "Upper bound of dimension", "integer", "array", PG_ONLY),
  fn("ARRAY_LOWER", "ARRAY_LOWER(array, dimension)", "Lower bound of dimension", "integer", "array", PG_ONLY),
  fn("ARRAY_CAT", "ARRAY_CAT(array1, array2)", "Concatenate arrays", "array", "array", PG_ONLY),
  fn("ARRAY_APPEND", "ARRAY_APPEND(array, element)", "Append element", "array", "array", PG_ONLY),
  fn("ARRAY_PREPEND", "ARRAY_PREPEND(element, array)", "Prepend element", "array", "array", PG_ONLY),
  fn("ARRAY_REMOVE", "ARRAY_REMOVE(array, element)", "Remove elements", "array", "array", PG_ONLY),
  fn("ARRAY_REPLACE", "ARRAY_REPLACE(array, from, to)", "Replace elements", "array", "array", PG_ONLY),
  fn("ARRAY_POSITION", "ARRAY_POSITION(array, element)", "Position of element", "integer", "array", PG_ONLY),
  fn("ARRAY_POSITIONS", "ARRAY_POSITIONS(array, element)", "All positions of element", "integer[]", "array", PG_ONLY),
  fn("UNNEST", "UNNEST(array)", "Expand array to rows", "setof", "array", PG_ONLY),
  fn("ARRAY_TO_STRING", "ARRAY_TO_STRING(array, delimiter)", "Convert to string", "text", "array", PG_ONLY),
  fn("STRING_TO_ARRAY", "STRING_TO_ARRAY(string, delimiter)", "Convert to array", "text[]", "array", PG_ONLY),

  // ==================== SYSTEM FUNCTIONS ====================
  fn("CURRENT_USER", "CURRENT_USER", "Current username", "text", "system", ALL_DBS),
  fn("SESSION_USER", "SESSION_USER", "Session username", "text", "system", NOT_SQLITE),
  fn("USER", "USER()", "Current user", "text", "system", [...MYSQL_MARIA, "sqlserver"]),
  fn("DATABASE", "DATABASE()", "Current database name", "text", "system", MYSQL_MARIA),
  fn("CURRENT_DATABASE", "CURRENT_DATABASE()", "Current database name", "text", "system", PG_ONLY),
  fn("CURRENT_SCHEMA", "CURRENT_SCHEMA()", "Current schema name", "text", "system", PG_ONLY),
  fn("VERSION", "VERSION()", "Database version", "text", "system", ["postgres", "mysql", "mariadb"]),
  fn("PG_TYPEOF", "PG_TYPEOF(expression)", "Data type of expression", "regtype", "system", PG_ONLY),
  fn("PG_COLUMN_SIZE", "PG_COLUMN_SIZE(expression)", "Size in bytes", "integer", "system", PG_ONLY),
  fn("PG_SIZE_PRETTY", "PG_SIZE_PRETTY(bytes)", "Pretty print size", "text", "system", PG_ONLY),
  fn("PG_TABLE_SIZE", "PG_TABLE_SIZE(table)", "Size of table", "bigint", "system", PG_ONLY),
  fn("PG_TOTAL_RELATION_SIZE", "PG_TOTAL_RELATION_SIZE(table)", "Total size with indexes", "bigint", "system", PG_ONLY),
  fn("GEN_RANDOM_UUID", "GEN_RANDOM_UUID()", "Generate random UUID", "uuid", "system", PG_ONLY),
  fn("UUID", "UUID()", "Generate UUID", "char(36)", "system", MYSQL_MARIA),
  fn("NEWID", "NEWID()", "Generate unique identifier", "uniqueidentifier", "system", SQLSERVER_ONLY),
];

// ==================== Performance Optimizations ====================

// Cache for functions by database type
const functionCacheByDb = new Map<SqlDatabaseType, SqlFunction[]>();

// Cache for functions by category
const functionCacheByCategory = new Map<string, SqlFunction[]>();

// Pre-computed lowercase function names for faster search
const functionNamesLower = new Map<SqlFunction, string>();

// Initialize lowercase names cache
for (const fn of SQL_FUNCTIONS) {
  functionNamesLower.set(fn, fn.name.toLowerCase());
}

/**
 * Get functions for a specific database type (cached)
 */
export function getFunctionsForDatabase(dbType: SqlDatabaseType): SqlFunction[] {
  // Check cache first
  const cached = functionCacheByDb.get(dbType);
  if (cached) return cached;

  // Compute and cache
  const result = SQL_FUNCTIONS.filter((f) => f.supportedDatabases.includes(dbType));
  functionCacheByDb.set(dbType, result);
  return result;
}

/**
 * Get functions by category for a specific database (cached)
 */
export function getFunctionsByCategory(
  dbType: SqlDatabaseType,
  category: FunctionCategory
): SqlFunction[] {
  const cacheKey = `${dbType}:${category}`;

  // Check cache first
  const cached = functionCacheByCategory.get(cacheKey);
  if (cached) return cached;

  // Compute and cache
  const result = SQL_FUNCTIONS.filter(
    (f) => f.supportedDatabases.includes(dbType) && f.category === category
  );
  functionCacheByCategory.set(cacheKey, result);
  return result;
}

/**
 * Search functions by name prefix (optimized)
 */
export function searchFunctions(
  dbType: SqlDatabaseType,
  prefix: string
): SqlFunction[] {
  const prefixLower = prefix.toLowerCase();
  const dbFunctions = getFunctionsForDatabase(dbType); // Use cached version

  return dbFunctions.filter((f) => {
    const nameLower = functionNamesLower.get(f) || f.name.toLowerCase();
    return nameLower.startsWith(prefixLower);
  });
}

/**
 * Search functions with fuzzy matching (for typo tolerance)
 */
export function searchFunctionsFuzzy(
  dbType: SqlDatabaseType,
  query: string,
  maxResults: number = 20
): SqlFunction[] {
  const queryLower = query.toLowerCase();
  const dbFunctions = getFunctionsForDatabase(dbType);

  // Score-based fuzzy matching
  const scored = dbFunctions
    .map((f) => {
      const nameLower = functionNamesLower.get(f) || f.name.toLowerCase();
      let score = 0;

      // Exact prefix match (highest priority)
      if (nameLower.startsWith(queryLower)) {
        score = 100 - nameLower.length; // Shorter names rank higher
      }
      // Contains match
      else if (nameLower.includes(queryLower)) {
        score = 50 - nameLower.indexOf(queryLower);
      }
      // Abbreviation match (e.g., "rn" matches "ROW_NUMBER")
      else {
        const abbrev = nameLower.split("_").map((p) => p[0]).join("");
        if (abbrev.startsWith(queryLower)) {
          score = 30;
        }
      }

      return { fn: f, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return scored.map((item) => item.fn);
}

/**
 * Clear function caches (useful for testing or when database changes)
 */
export function clearFunctionCaches(): void {
  functionCacheByDb.clear();
  functionCacheByCategory.clear();
}
