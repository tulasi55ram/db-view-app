'use strict';

var sqlFormatter = require('sql-formatter');

// src/documents/types.ts
function isDocumentDbType(dbType) {
  return ["mongodb", "elasticsearch", "cassandra"].includes(dbType);
}

// src/documents/getDocumentId.ts
var DB_ID_CONVENTIONS = {
  mongodb: ["_id"],
  elasticsearch: ["_id"],
  cassandra: ["id"],
  // Fallback patterns for unknown databases
  default: ["_id", "id", "ID", "Id", "uuid", "UUID"]
};
function getDocumentIdField(columns, dbType) {
  if (columns?.length) {
    const pkColumn = columns.find((col) => col.isPrimaryKey);
    if (pkColumn) {
      return pkColumn.name;
    }
  }
  const conventions = DB_ID_CONVENTIONS[dbType] || DB_ID_CONVENTIONS.default;
  if (columns?.length) {
    const columnNames = new Set(columns.map((col) => col.name));
    for (const convention of conventions) {
      if (columnNames.has(convention)) {
        return convention;
      }
    }
  }
  return conventions[0];
}
function getDocumentIdFields(columns, dbType) {
  const primaryField = getDocumentIdField(columns, dbType);
  const pkColumns = columns?.filter((col) => col.isPrimaryKey) || [];
  if (pkColumns.length > 1) {
    return {
      primaryField,
      allFields: pkColumns.map((col) => col.name),
      isComposite: true
    };
  }
  return {
    primaryField,
    allFields: [primaryField],
    isComposite: false
  };
}
function getDocumentId(document, columns, dbType) {
  const idField = getDocumentIdField(columns, dbType);
  const id = document[idField];
  if (id === null || id === void 0) {
    return "";
  }
  if (typeof id === "object" && id !== null) {
    if ("$oid" in id && typeof id.$oid === "string") {
      return id.$oid;
    }
    if ("toString" in id && typeof id.toString === "function") {
      return id.toString();
    }
    return JSON.stringify(id);
  }
  return String(id);
}
function getCompositeDocumentId(document, columns, dbType, separator = ":") {
  const idInfo = getDocumentIdFields(columns, dbType);
  if (!idInfo.isComposite) {
    return getDocumentId(document, columns, dbType);
  }
  const parts = idInfo.allFields.map((field) => {
    const value = document[field];
    if (value === null || value === void 0) {
      return "";
    }
    return String(value);
  });
  return parts.join(separator);
}
function getPrimaryKeyObject(document, columns, dbType) {
  const idInfo = getDocumentIdFields(columns, dbType);
  const pk = {};
  for (const field of idInfo.allFields) {
    pk[field] = document[field];
  }
  return pk;
}

// src/documents/pathUtils.ts
function parsePath(path) {
  if (!path) return [];
  const normalized = path.replace(/\[(\d+)\]/g, ".$1");
  return normalized.split(".").filter((segment) => segment !== "");
}
function buildPath(segments, options = {}) {
  const { arrayNotation = "dot" } = options;
  if (segments.length === 0) return "";
  if (arrayNotation === "bracket") {
    return segments.reduce((path, segment, index) => {
      if (index === 0) return segment;
      if (/^\d+$/.test(segment)) {
        return `${path}[${segment}]`;
      }
      return `${path}.${segment}`;
    }, "");
  }
  return segments.join(".");
}
function getAtPath(obj, path) {
  const segments = parsePath(path);
  let current = obj;
  for (const segment of segments) {
    if (current === null || current === void 0) {
      return void 0;
    }
    if (typeof current !== "object") {
      return void 0;
    }
    current = current[segment];
  }
  return current;
}
function hasPath(obj, path) {
  const segments = parsePath(path);
  let current = obj;
  for (let i = 0; i < segments.length; i++) {
    if (current === null || current === void 0) {
      return false;
    }
    if (typeof current !== "object") {
      return false;
    }
    const segment = segments[i];
    if (!(segment in current)) {
      return false;
    }
    current = current[segment];
  }
  return true;
}
function setAtPath(obj, path, value) {
  const segments = parsePath(path);
  if (segments.length === 0) {
    return obj;
  }
  return setAtPathRecursive(obj, segments, 0, value);
}
function setAtPathRecursive(obj, segments, index, value) {
  const segment = segments[index];
  const isArray = Array.isArray(obj);
  const isNumericSegment = /^\d+$/.test(segment);
  const copy = isArray ? [...obj] : { ...obj };
  if (index === segments.length - 1) {
    if (isArray && isNumericSegment) {
      copy[parseInt(segment, 10)] = value;
    } else {
      copy[segment] = value;
    }
    return copy;
  }
  const currentValue = isArray && isNumericSegment ? copy[parseInt(segment, 10)] : copy[segment];
  const nextSegment = segments[index + 1];
  const nextIsNumeric = /^\d+$/.test(nextSegment);
  let nextObj;
  if (currentValue === null || currentValue === void 0) {
    nextObj = nextIsNumeric ? [] : {};
  } else if (typeof currentValue === "object") {
    nextObj = currentValue;
  } else {
    nextObj = nextIsNumeric ? [] : {};
  }
  const newValue = setAtPathRecursive(nextObj, segments, index + 1, value);
  if (isArray && isNumericSegment) {
    copy[parseInt(segment, 10)] = newValue;
  } else {
    copy[segment] = newValue;
  }
  return copy;
}
function deleteAtPath(obj, path) {
  const segments = parsePath(path);
  if (segments.length === 0) {
    return obj;
  }
  return deleteAtPathRecursive(obj, segments, 0);
}
function deleteAtPathRecursive(obj, segments, index) {
  const segment = segments[index];
  const isArray = Array.isArray(obj);
  const isNumericSegment = /^\d+$/.test(segment);
  const copy = isArray ? [...obj] : { ...obj };
  if (index === segments.length - 1) {
    if (isArray && isNumericSegment) {
      copy.splice(parseInt(segment, 10), 1);
    } else {
      delete copy[segment];
    }
    return copy;
  }
  const currentValue = isArray && isNumericSegment ? copy[parseInt(segment, 10)] : copy[segment];
  if (currentValue === null || currentValue === void 0 || typeof currentValue !== "object") {
    return copy;
  }
  const newValue = deleteAtPathRecursive(
    currentValue,
    segments,
    index + 1
  );
  if (isArray && isNumericSegment) {
    copy[parseInt(segment, 10)] = newValue;
  } else {
    copy[segment] = newValue;
  }
  return copy;
}
function getParentPath(path) {
  const segments = parsePath(path);
  if (segments.length <= 1) return "";
  return buildPath(segments.slice(0, -1));
}
function getPathKey(path) {
  const segments = parsePath(path);
  return segments[segments.length - 1] || "";
}
function joinPath(...parts) {
  return parts.map(String).filter((p) => p !== "").join(".");
}

// src/transforms/inferTypes.ts
var DATE_PATTERNS = [
  // ISO 8601
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:?\d{2})?)?$/,
  // Common date formats
  /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/,
  /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/
];
var OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;
function detectValueType(value) {
  if (value === null) {
    return "null";
  }
  if (value === void 0) {
    return "undefined";
  }
  const type = typeof value;
  switch (type) {
    case "string":
      return detectStringType(value);
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return detectObjectType(value);
    default:
      return "unknown";
  }
}
function detectStringType(value) {
  if (OBJECT_ID_PATTERN.test(value)) {
    return "objectId";
  }
  for (const pattern of DATE_PATTERNS) {
    if (pattern.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return "date";
      }
    }
  }
  return "string";
}
function detectObjectType(value) {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (value instanceof Date) {
    return "date";
  }
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return "binary";
  }
  if ("$oid" in value || "_bsontype" in value && value._bsontype === "ObjectId") {
    return "objectId";
  }
  if ("$date" in value) {
    return "date";
  }
  return "object";
}
function getTypeLabel(type) {
  const labels = {
    string: "String",
    number: "Number",
    boolean: "Boolean",
    null: "Null",
    undefined: "Undefined",
    object: "Object",
    array: "Array",
    date: "Date",
    objectId: "ObjectId",
    binary: "Binary",
    unknown: "Unknown"
  };
  return labels[type] || "Unknown";
}
function getTypeColor(type) {
  const colors = {
    string: "#ce9178",
    // Orange/brown
    number: "#b5cea8",
    // Light green
    boolean: "#569cd6",
    // Blue
    null: "#808080",
    // Gray
    undefined: "#808080",
    // Gray
    object: "#dcdcaa",
    // Yellow
    array: "#c586c0",
    // Purple
    date: "#4ec9b0",
    // Teal
    objectId: "#9cdcfe",
    // Light blue
    binary: "#d7ba7d",
    // Gold
    unknown: "#808080"
    // Gray
  };
  return colors[type] || "#808080";
}
function isPrimitive(value) {
  const type = detectValueType(value);
  return ["string", "number", "boolean", "null", "undefined", "date", "objectId"].includes(type);
}
function isContainer(value) {
  const type = detectValueType(value);
  return type === "object" || type === "array";
}
function inferColumnType(values, maxSamples = 100) {
  const seenTypes = /* @__PURE__ */ new Set();
  const typeCounts = /* @__PURE__ */ new Map();
  const sampleValues = [];
  let hasNulls = false;
  let dateCount = 0;
  let jsonCount = 0;
  const samplesToCheck = values.slice(0, maxSamples);
  for (const value of samplesToCheck) {
    const type = detectValueType(value);
    seenTypes.add(type);
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    if (type === "null" || type === "undefined") {
      hasNulls = true;
    } else if (sampleValues.length < 5) {
      sampleValues.push(value);
    }
    if (type === "date") {
      dateCount++;
    } else if (type === "string") {
      const strValue = value;
      if (isDateLikeString(strValue)) {
        dateCount++;
      }
      if (isJsonLikeString(strValue)) {
        jsonCount++;
      }
    }
  }
  let primaryType = "unknown";
  let maxCount = 0;
  for (const [type, count] of typeCounts) {
    if (type !== "null" && type !== "undefined" && count > maxCount) {
      maxCount = count;
      primaryType = type;
    }
  }
  if (primaryType === "unknown" && hasNulls) {
    primaryType = "null";
  }
  const nonNullCount = samplesToCheck.length - (typeCounts.get("null") || 0) - (typeCounts.get("undefined") || 0);
  const isLikelyDate = dateCount > nonNullCount * 0.8;
  const isLikelyJson = jsonCount > nonNullCount * 0.8;
  return {
    primaryType,
    seenTypes,
    hasNulls,
    sampleValues,
    isLikelyDate,
    isLikelyJson
  };
}
function isDateLikeString(value) {
  for (const pattern of DATE_PATTERNS) {
    if (pattern.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return true;
      }
    }
  }
  return false;
}
function isJsonLikeString(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}") || trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
function formatValueForDisplay(value, maxLength = 100) {
  if (value === null) return "null";
  if (value === void 0) return "undefined";
  const type = detectValueType(value);
  switch (type) {
    case "string":
      const str = value;
      if (str.length > maxLength) {
        return `"${str.substring(0, maxLength)}..."`;
      }
      return `"${str}"`;
    case "number":
    case "boolean":
      return String(value);
    case "date":
      if (value instanceof Date) {
        return value.toISOString();
      }
      return String(value);
    case "objectId":
      if (typeof value === "object" && value !== null && "$oid" in value) {
        return `ObjectId("${value.$oid}")`;
      }
      return String(value);
    case "array":
      const arr = value;
      return `Array(${arr.length})`;
    case "object":
      const keys = Object.keys(value);
      return `Object(${keys.length} keys)`;
    case "binary":
      return "[Binary Data]";
    default:
      return String(value);
  }
}

// src/transforms/flattenDocument.ts
var DEFAULT_FLATTEN_OPTIONS = {
  maxDepth: Infinity,
  arrayNotation: "dot",
  includeContainers: false,
  excludePaths: [],
  sortKeys: false
};
function flattenDocument(document, options) {
  const opts = { ...DEFAULT_FLATTEN_OPTIONS, ...options };
  const fields = [];
  const excludeSet = new Set(opts.excludePaths);
  flattenRecursive(document, "", 0, fields, opts, excludeSet, false);
  if (opts.sortKeys) {
    fields.sort((a, b) => a.path.localeCompare(b.path));
  }
  return fields;
}
function flattenRecursive(value, path, depth, fields, options, excludeSet, isArrayElement, arrayIndex) {
  if (excludeSet.has(path)) {
    return;
  }
  if (depth > options.maxDepth) {
    return;
  }
  const type = detectValueType(value);
  if (type === "array") {
    const arr = value;
    if (options.includeContainers && path) {
      fields.push({
        path,
        value: arr,
        type: "array",
        depth,
        isArrayElement,
        arrayIndex
      });
    }
    arr.forEach((item, index) => {
      const itemPath = path ? options.arrayNotation === "bracket" ? `${path}[${index}]` : `${path}.${index}` : String(index);
      flattenRecursive(
        item,
        itemPath,
        depth + 1,
        fields,
        options,
        excludeSet,
        true,
        index
      );
    });
    return;
  }
  if (type === "object" && value !== null) {
    const obj = value;
    const keys = Object.keys(obj);
    if (options.sortKeys) {
      keys.sort();
    }
    if (options.includeContainers && path) {
      fields.push({
        path,
        value: obj,
        type: "object",
        depth,
        isArrayElement,
        arrayIndex
      });
    }
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      flattenRecursive(
        obj[key],
        childPath,
        depth + 1,
        fields,
        options,
        excludeSet,
        false
      );
    }
    return;
  }
  if (path) {
    fields.push({
      path,
      value,
      type,
      depth,
      isArrayElement,
      arrayIndex
    });
  }
}
function unflattenDocument(fields) {
  const result = {};
  for (const field of fields) {
    setValueAtPath(result, field.path, field.value);
  }
  return result;
}
function setValueAtPath(obj, path, value) {
  const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");
  const segments = normalizedPath.split(".");
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];
    const nextIsIndex = /^\d+$/.test(nextSegment);
    if (!(segment in current)) {
      current[segment] = nextIsIndex ? [] : {};
    }
    current = current[segment];
  }
  const lastSegment = segments[segments.length - 1];
  current[lastSegment] = value;
}
function getDocumentKeys(documents, maxDepth = 1) {
  const keys = /* @__PURE__ */ new Set();
  for (const doc of documents) {
    const flattened = flattenDocument(doc, { maxDepth, includeContainers: true });
    for (const field of flattened) {
      keys.add(field.path);
    }
  }
  return Array.from(keys).sort();
}
function countDocumentFields(document) {
  const flattened = flattenDocument(document);
  return flattened.length;
}
function getDocumentDepth(document) {
  const flattened = flattenDocument(document);
  return Math.max(0, ...flattened.map((f) => f.depth));
}

// src/transforms/nestToTree.ts
var DEFAULT_TREE_OPTIONS = {
  expandedPaths: /* @__PURE__ */ new Set(),
  maxDepth: Infinity,
  sortKeys: false
};
function nestToTree(document, options) {
  const opts = { ...DEFAULT_TREE_OPTIONS, ...options };
  return createTreeNode(
    "root",
    "root",
    document,
    0,
    opts,
    false
  );
}
function createTreeNode(key, path, value, depth, options, isArrayElement, arrayIndex) {
  const type = detectValueType(value);
  const isExpanded = options.expandedPaths.has(path);
  if (depth > options.maxDepth) {
    return {
      key,
      path,
      value,
      type,
      isExpanded: false,
      isArrayElement,
      arrayIndex
    };
  }
  if (type === "array") {
    const arr = value;
    const children = isExpanded ? arr.map(
      (item, index) => createTreeNode(
        String(index),
        `${path}.${index}`,
        item,
        depth + 1,
        options,
        true,
        index
      )
    ) : void 0;
    return {
      key,
      path,
      value: void 0,
      // Don't include raw value for containers
      type: "array",
      children,
      isExpanded,
      childCount: arr.length,
      isArrayElement,
      arrayIndex
    };
  }
  if (type === "object" && value !== null) {
    const obj = value;
    let keys = Object.keys(obj);
    if (options.sortKeys) {
      keys = keys.sort();
    }
    const children = isExpanded ? keys.map(
      (childKey) => createTreeNode(
        childKey,
        `${path}.${childKey}`,
        obj[childKey],
        depth + 1,
        options,
        false
      )
    ) : void 0;
    return {
      key,
      path,
      value: void 0,
      // Don't include raw value for containers
      type: "object",
      children,
      isExpanded,
      childCount: keys.length,
      isArrayElement,
      arrayIndex
    };
  }
  return {
    key,
    path,
    value,
    type,
    isArrayElement,
    arrayIndex
  };
}
function getExpandedPathsToDepth(document, depth) {
  const paths = /* @__PURE__ */ new Set(["root"]);
  if (depth > 0) {
    collectPathsToDepth(document, "root", 1, depth, paths);
  }
  return paths;
}
function collectPathsToDepth(value, path, currentDepth, maxDepth, paths) {
  if (currentDepth > maxDepth) return;
  const type = detectValueType(value);
  if (type === "array") {
    paths.add(path);
    const arr = value;
    arr.forEach((item, index) => {
      collectPathsToDepth(item, `${path}.${index}`, currentDepth + 1, maxDepth, paths);
    });
  } else if (type === "object" && value !== null) {
    paths.add(path);
    const obj = value;
    for (const key of Object.keys(obj)) {
      collectPathsToDepth(obj[key], `${path}.${key}`, currentDepth + 1, maxDepth, paths);
    }
  }
}
function expandPath(currentPaths, path) {
  const newPaths = new Set(currentPaths);
  const segments = path.split(".");
  let currentPath = "";
  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}.${segment}` : segment;
    newPaths.add(currentPath);
  }
  return newPaths;
}
function collapsePath(currentPaths, path) {
  const newPaths = new Set(currentPaths);
  newPaths.delete(path);
  return newPaths;
}
function togglePath(currentPaths, path) {
  if (currentPaths.has(path)) {
    return collapsePath(currentPaths, path);
  }
  return expandPath(currentPaths, path);
}
function expandAll(document) {
  return getExpandedPathsToDepth(document, Infinity);
}
function collapseAll() {
  return /* @__PURE__ */ new Set(["root"]);
}
function searchTree(node, searchTerm) {
  const matches = [];
  const term = searchTerm.toLowerCase();
  searchTreeRecursive(node, term, matches);
  return matches;
}
function searchTreeRecursive(node, term, matches) {
  if (node.key.toLowerCase().includes(term)) {
    matches.push(node.path);
  }
  if (node.value !== void 0) {
    const valueStr = String(node.value).toLowerCase();
    if (valueStr.includes(term) && !matches.includes(node.path)) {
      matches.push(node.path);
    }
  }
  if (node.children) {
    for (const child of node.children) {
      searchTreeRecursive(child, term, matches);
    }
  }
}
function getPathsToShowSearchResults(matchingPaths) {
  const paths = /* @__PURE__ */ new Set();
  for (const matchPath of matchingPaths) {
    const segments = matchPath.split(".");
    let currentPath = "";
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}.${segment}` : segment;
      paths.add(currentPath);
    }
  }
  return paths;
}

// src/utils/formatBytes.ts
var SI_UNITS = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
var BINARY_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"];
function formatBytes(bytes, options) {
  const {
    decimals = 2,
    binary = false,
    space = true
  } = options || {};
  if (bytes === 0) {
    return `0${space ? " " : ""}B`;
  }
  if (!Number.isFinite(bytes) || bytes < 0) {
    return `0${space ? " " : ""}B`;
  }
  const base = binary ? 1024 : 1e3;
  const units = binary ? BINARY_UNITS : SI_UNITS;
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    units.length - 1
  );
  const value = bytes / Math.pow(base, unitIndex);
  const unit = units[unitIndex];
  const formatted = unitIndex === 0 ? Math.round(value).toString() : value.toFixed(decimals);
  return `${formatted}${space ? " " : ""}${unit}`;
}
function parseBytes(formatted) {
  const match = formatted.trim().match(/^([\d.]+)\s*([A-Za-z]+)$/);
  if (!match) {
    return null;
  }
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (isNaN(value)) {
    return null;
  }
  let base;
  let unitIndex;
  if (unit.endsWith("IB") || unit === "B") {
    base = 1024;
    unitIndex = BINARY_UNITS.findIndex(
      (u) => u.toUpperCase() === unit || u.toUpperCase() === unit.replace("I", "")
    );
  } else {
    base = 1e3;
    unitIndex = SI_UNITS.findIndex((u) => u.toUpperCase() === unit);
  }
  if (unitIndex === -1) {
    return null;
  }
  return Math.round(value * Math.pow(base, unitIndex));
}
function formatBytesPerSecond(bytesPerSecond, options) {
  return `${formatBytes(bytesPerSecond, options)}/s`;
}

// src/utils/truncateValue.ts
function truncateString(value, options) {
  const {
    maxLength = 100,
    ellipsis = "...",
    wordBoundary = false,
    position = "end"
  } = options || {};
  if (value.length <= maxLength) {
    return value;
  }
  const ellipsisLength = ellipsis.length;
  const availableLength = maxLength - ellipsisLength;
  if (availableLength <= 0) {
    return ellipsis.substring(0, maxLength);
  }
  switch (position) {
    case "start":
      return ellipsis + value.substring(value.length - availableLength);
    case "middle": {
      const halfLength = Math.floor(availableLength / 2);
      const startPart = value.substring(0, halfLength);
      const endPart = value.substring(value.length - (availableLength - halfLength));
      return startPart + ellipsis + endPart;
    }
    case "end":
    default: {
      let truncated = value.substring(0, availableLength);
      if (wordBoundary) {
        const lastSpace = truncated.lastIndexOf(" ");
        if (lastSpace > availableLength * 0.5) {
          truncated = truncated.substring(0, lastSpace);
        }
      }
      return truncated + ellipsis;
    }
  }
}
function truncateValue(value, maxLength = 100) {
  if (value === null) {
    return "null";
  }
  if (value === void 0) {
    return "undefined";
  }
  if (typeof value === "string") {
    return truncateString(value, { maxLength });
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const itemWord = value.length === 1 ? "item" : "items";
    return `[${value.length} ${itemWord}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    const keyWord = keys.length === 1 ? "key" : "keys";
    return `{${keys.length} ${keyWord}}`;
  }
  const str = String(value);
  return truncateString(str, { maxLength });
}
function truncateJson(json, maxLength = 500) {
  const str = typeof json === "string" ? json : JSON.stringify(json, null, 2);
  return truncateString(str, { maxLength });
}
function truncateArray(values, maxItems = 5, maxValueLength = 50) {
  if (values.length === 0) {
    return "[]";
  }
  const displayed = values.slice(0, maxItems);
  const remaining = values.length - maxItems;
  const formatted = displayed.map((v) => {
    if (typeof v === "string") {
      const truncated = truncateString(v, { maxLength: maxValueLength });
      return `"${truncated}"`;
    }
    return truncateValue(v, maxValueLength);
  });
  const result = formatted.join(", ");
  if (remaining > 0) {
    return `${result} +${remaining} more`;
  }
  return result;
}
function truncatePath(path, maxLength = 50) {
  if (path.length <= maxLength) {
    return path;
  }
  const separator = path.includes("/") ? "/" : "\\";
  const parts = path.split(separator);
  const filename = parts[parts.length - 1];
  if (filename.length >= maxLength - 3) {
    return truncateString(filename, { maxLength });
  }
  let result = filename;
  let i = parts.length - 2;
  while (i >= 0) {
    const newResult = parts[i] + separator + result;
    if (newResult.length + 3 > maxLength) {
      break;
    }
    result = newResult;
    i--;
  }
  if (i >= 0) {
    return "..." + separator + result;
  }
  return result;
}

// src/utils/generateId.ts
var ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
var sequentialCounter = 0;
function generateId(length = 8) {
  let result = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += ALPHANUMERIC[array[i] % ALPHANUMERIC.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
    }
  }
  return result;
}
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function generateSequentialId(prefix = "id") {
  sequentialCounter++;
  return `${prefix}_${sequentialCounter}`;
}
function resetSequentialCounter() {
  sequentialCounter = 0;
}
function generateTimestampId(prefix) {
  const timestamp = Date.now();
  const suffix = generateId(4);
  const id = `${timestamp}_${suffix}`;
  return prefix ? `${prefix}_${id}` : id;
}
function generateHash(input, length = 8) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const positive = Math.abs(hash);
  let result = "";
  let num = positive;
  while (result.length < length) {
    result = ALPHANUMERIC[num % ALPHANUMERIC.length] + result;
    num = Math.floor(num / ALPHANUMERIC.length);
    if (num === 0 && result.length < length) {
      num = positive + result.length;
    }
  }
  return result.substring(0, length);
}
function generateSlug(input, maxLength = 50) {
  return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").substring(0, maxLength);
}

// src/utils/connectionKey.ts
function getConnectionKey(config) {
  const dbType = config.dbType || "postgres";
  if ("name" in config && config.name) {
    return `${dbType}:${config.name}`;
  }
  switch (dbType) {
    case "sqlite":
      return `${dbType}:${config.filePath}`;
    case "mongodb":
      if ("connectionString" in config && config.connectionString) {
        return `${dbType}:${config.connectionString}`;
      }
      return buildStandardKey(dbType, config);
    case "redis":
      const redisConfig = config;
      const redisHost = redisConfig.host || "localhost";
      const redisPort = redisConfig.port || 6379;
      const redisDb = redisConfig.database || 0;
      return `${dbType}:${redisHost}:${redisPort}/${redisDb}`;
    case "elasticsearch":
      const esConfig = config;
      const esHosts = esConfig.hosts || esConfig.host || "localhost";
      return `${dbType}:${Array.isArray(esHosts) ? esHosts.join(",") : esHosts}`;
    default:
      return buildStandardKey(dbType, config);
  }
}
function buildStandardKey(dbType, config) {
  const user = config.user || config.username || "anonymous";
  const host = config.host || "localhost";
  const port = config.port || getDefaultPort(dbType);
  const database = config.database || "";
  return `${dbType}:${user}@${host}:${port}/${database}`;
}
function getDefaultPort(dbType) {
  const ports = {
    postgres: 5432,
    mysql: 3306,
    mariadb: 3306,
    sqlserver: 1433,
    sqlite: 0,
    mongodb: 27017,
    redis: 6379,
    elasticsearch: 9200,
    cassandra: 9042
  };
  return ports[dbType] || 0;
}
function parseConnectionKey(connectionKey) {
  const colonIndex = connectionKey.indexOf(":");
  if (colonIndex === -1) {
    return null;
  }
  const dbType = connectionKey.substring(0, colonIndex);
  const identifier = connectionKey.substring(colonIndex + 1);
  const validTypes = [
    "postgres",
    "mysql",
    "mariadb",
    "sqlserver",
    "sqlite",
    "mongodb",
    "redis",
    "elasticsearch",
    "cassandra"
  ];
  if (!validTypes.includes(dbType)) {
    return null;
  }
  return {
    dbType,
    identifier,
    original: connectionKey
  };
}
function getConnectionDisplayName(connectionKey) {
  const parsed = parseConnectionKey(connectionKey);
  if (!parsed) {
    return connectionKey;
  }
  const { identifier } = parsed;
  if (/^[\w\s-]+$/.test(identifier)) {
    return identifier;
  }
  const dbMatch = identifier.match(/\/([^/]+)$/);
  if (dbMatch) {
    return dbMatch[1];
  }
  const pathMatch = identifier.match(/[/\\]([^/\\]+)$/);
  if (pathMatch) {
    return pathMatch[1];
  }
  return identifier;
}
function isSameConnection(key1, key2) {
  return key1 === key2;
}
function getDbTypeFromKey(connectionKey) {
  const parsed = parseConnectionKey(connectionKey);
  return parsed?.dbType || null;
}

// src/utils/debounce.ts
function debounce(fn, wait, options) {
  const { leading = false, trailing = true, maxWait } = options || {};
  let timeoutId = null;
  let maxTimeoutId = null;
  let lastArgs = null;
  let lastCallTime = null;
  let lastInvokeTime = 0;
  function invoke() {
    if (lastArgs === null) return;
    const args = lastArgs;
    lastArgs = null;
    lastInvokeTime = Date.now();
    fn(...args);
  }
  function leadingEdge(time) {
    lastInvokeTime = time;
    if (leading) {
      invoke();
    }
    if (maxWait !== void 0) {
      maxTimeoutId = setTimeout(() => {
        if (trailing && lastArgs !== null) {
          invoke();
        }
        timeoutId = null;
        maxTimeoutId = null;
      }, maxWait);
    }
  }
  function trailingEdge() {
    timeoutId = null;
    if (trailing && lastArgs !== null) {
      invoke();
    }
    if (maxTimeoutId !== null) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = null;
    }
  }
  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);
    lastArgs = args;
    lastCallTime = time;
    if (isInvoking) {
      if (timeoutId === null) {
        leadingEdge(time);
      }
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(trailingEdge, wait);
  }
  function shouldInvoke(time) {
    if (lastCallTime === null) return true;
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    return timeSinceLastCall >= wait || maxWait !== void 0 && timeSinceLastInvoke >= maxWait;
  }
  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxTimeoutId !== null) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = null;
    }
    lastArgs = null;
    lastCallTime = null;
  };
  debounced.flush = () => {
    if (timeoutId !== null) {
      trailingEdge();
    }
  };
  debounced.pending = () => {
    return timeoutId !== null;
  };
  return debounced;
}
function throttle(fn, wait, options) {
  const { leading = true, trailing = true } = options || {};
  return debounce(fn, wait, {
    leading,
    trailing,
    maxWait: wait
  });
}
function once(fn) {
  let called = false;
  let result;
  return (...args) => {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  };
}

// src/filters/buildSqlFilter.ts
function defaultQuoteIdentifier(name) {
  return `"${name.replace(/"/g, '""')}"`;
}
function mysqlQuoteIdentifier(name) {
  return `\`${name.replace(/`/g, "``")}\``;
}
function sqlServerQuoteIdentifier(name) {
  return `[${name.replace(/\]/g, "]]")}]`;
}
function getQuoteFunction(dbType) {
  switch (dbType) {
    case "mysql":
    case "mariadb":
      return mysqlQuoteIdentifier;
    case "sqlserver":
      return sqlServerQuoteIdentifier;
    default:
      return defaultQuoteIdentifier;
  }
}
function getPlaceholderStyle(dbType) {
  switch (dbType) {
    case "postgres":
      return "positional";
    case "sqlserver":
      return "named";
    default:
      return "question";
  }
}
function getTextCastSyntax(dbType, column) {
  switch (dbType) {
    case "postgres":
      return `${column}::text`;
    case "sqlserver":
      return `CAST(${column} AS NVARCHAR(MAX))`;
    default:
      return column;
  }
}
function getLikeOperator(dbType) {
  switch (dbType) {
    case "postgres":
      return "ILIKE";
    default:
      return "LIKE";
  }
}
function getNotLikeOperator(dbType) {
  switch (dbType) {
    case "postgres":
      return "NOT ILIKE";
    default:
      return "NOT LIKE";
  }
}
function buildSqlFilter(filters, logic, options) {
  const { dbType, startIndex = 1 } = options;
  const quoteIdentifier2 = options.quoteIdentifier ?? getQuoteFunction(dbType);
  const placeholderStyle = getPlaceholderStyle(dbType);
  if (!filters || filters.length === 0) {
    return { whereClause: "", params: [] };
  }
  const conditions = [];
  const params = [];
  let paramIndex = startIndex;
  function getPlaceholder() {
    switch (placeholderStyle) {
      case "positional":
        return `$${paramIndex++}`;
      case "question":
        paramIndex++;
        return "?";
      case "named":
        return `@p${paramIndex++ - 1}`;
    }
  }
  for (const filter of filters) {
    if (!filter.columnName || !filter.operator) {
      continue;
    }
    const columnName = quoteIdentifier2(filter.columnName);
    const textColumn = getTextCastSyntax(dbType, columnName);
    const likeOp = getLikeOperator(dbType);
    const notLikeOp = getNotLikeOperator(dbType);
    switch (filter.operator) {
      case "equals":
        conditions.push(`${columnName} = ${getPlaceholder()}`);
        params.push(filter.value);
        break;
      case "not_equals":
        conditions.push(`${columnName} != ${getPlaceholder()}`);
        params.push(filter.value);
        break;
      case "contains":
        conditions.push(`${textColumn} ${likeOp} ${getPlaceholder()}`);
        params.push(`%${filter.value}%`);
        break;
      case "not_contains":
        conditions.push(`${textColumn} ${notLikeOp} ${getPlaceholder()}`);
        params.push(`%${filter.value}%`);
        break;
      case "starts_with":
        conditions.push(`${textColumn} ${likeOp} ${getPlaceholder()}`);
        params.push(`${filter.value}%`);
        break;
      case "ends_with":
        conditions.push(`${textColumn} ${likeOp} ${getPlaceholder()}`);
        params.push(`%${filter.value}`);
        break;
      case "greater_than":
        conditions.push(`${columnName} > ${getPlaceholder()}`);
        params.push(filter.value);
        break;
      case "less_than":
        conditions.push(`${columnName} < ${getPlaceholder()}`);
        params.push(filter.value);
        break;
      case "greater_or_equal":
        conditions.push(`${columnName} >= ${getPlaceholder()}`);
        params.push(filter.value);
        break;
      case "less_or_equal":
        conditions.push(`${columnName} <= ${getPlaceholder()}`);
        params.push(filter.value);
        break;
      case "is_null":
        conditions.push(`${columnName} IS NULL`);
        break;
      case "is_not_null":
        conditions.push(`${columnName} IS NOT NULL`);
        break;
      case "between":
        if (filter.value2 !== void 0) {
          const p1 = getPlaceholder();
          const p2 = getPlaceholder();
          conditions.push(`${columnName} BETWEEN ${p1} AND ${p2}`);
          params.push(filter.value, filter.value2);
        }
        break;
      case "in": {
        const values = (Array.isArray(filter.value) ? filter.value.map((v) => String(v).trim()) : String(filter.value).split(",").map((v) => v.trim())).filter((v) => v !== "");
        if (values.length > 0) {
          const placeholders = values.map(() => getPlaceholder()).join(", ");
          conditions.push(`${columnName} IN (${placeholders})`);
          params.push(...values);
        }
        break;
      }
    }
  }
  if (conditions.length === 0) {
    return { whereClause: "", params: [] };
  }
  const whereClause = conditions.join(` ${logic} `);
  return { whereClause, params };
}
function buildSqlFilterNamed(filters, logic, options) {
  const dbType = options.dbType ?? "sqlserver";
  const quoteIdentifier2 = options.quoteIdentifier ?? getQuoteFunction(dbType);
  const startIndex = options.startIndex ?? 0;
  if (!filters || filters.length === 0) {
    return { whereClause: "", params: {} };
  }
  const conditions = [];
  const params = {};
  let paramIndex = startIndex;
  function getParamName() {
    return `p${paramIndex++}`;
  }
  for (const filter of filters) {
    if (!filter.columnName || !filter.operator) {
      continue;
    }
    const columnName = quoteIdentifier2(filter.columnName);
    const textColumn = `CAST(${columnName} AS NVARCHAR(MAX))`;
    switch (filter.operator) {
      case "equals": {
        const name = getParamName();
        conditions.push(`${columnName} = @${name}`);
        params[name] = filter.value;
        break;
      }
      case "not_equals": {
        const name = getParamName();
        conditions.push(`${columnName} != @${name}`);
        params[name] = filter.value;
        break;
      }
      case "contains": {
        const name = getParamName();
        conditions.push(`${textColumn} LIKE @${name}`);
        params[name] = `%${filter.value}%`;
        break;
      }
      case "not_contains": {
        const name = getParamName();
        conditions.push(`${textColumn} NOT LIKE @${name}`);
        params[name] = `%${filter.value}%`;
        break;
      }
      case "starts_with": {
        const name = getParamName();
        conditions.push(`${textColumn} LIKE @${name}`);
        params[name] = `${filter.value}%`;
        break;
      }
      case "ends_with": {
        const name = getParamName();
        conditions.push(`${textColumn} LIKE @${name}`);
        params[name] = `%${filter.value}`;
        break;
      }
      case "greater_than": {
        const name = getParamName();
        conditions.push(`${columnName} > @${name}`);
        params[name] = filter.value;
        break;
      }
      case "less_than": {
        const name = getParamName();
        conditions.push(`${columnName} < @${name}`);
        params[name] = filter.value;
        break;
      }
      case "greater_or_equal": {
        const name = getParamName();
        conditions.push(`${columnName} >= @${name}`);
        params[name] = filter.value;
        break;
      }
      case "less_or_equal": {
        const name = getParamName();
        conditions.push(`${columnName} <= @${name}`);
        params[name] = filter.value;
        break;
      }
      case "is_null":
        conditions.push(`${columnName} IS NULL`);
        break;
      case "is_not_null":
        conditions.push(`${columnName} IS NOT NULL`);
        break;
      case "between": {
        if (filter.value2 !== void 0) {
          const name1 = getParamName();
          const name2 = getParamName();
          conditions.push(`${columnName} BETWEEN @${name1} AND @${name2}`);
          params[name1] = filter.value;
          params[name2] = filter.value2;
        }
        break;
      }
      case "in": {
        const values = (Array.isArray(filter.value) ? filter.value.map((v) => String(v).trim()) : String(filter.value).split(",").map((v) => v.trim())).filter((v) => v !== "");
        if (values.length > 0) {
          const paramNames = [];
          for (const val of values) {
            const name = getParamName();
            paramNames.push(`@${name}`);
            params[name] = val;
          }
          conditions.push(`${columnName} IN (${paramNames.join(", ")})`);
        }
        break;
      }
    }
  }
  if (conditions.length === 0) {
    return { whereClause: "", params: {} };
  }
  const whereClause = conditions.join(` ${logic} `);
  return { whereClause, params };
}
function buildWhereClause(filters, logic, dbType, quoteIdentifier2) {
  return buildSqlFilter(filters, logic, { dbType, quoteIdentifier: quoteIdentifier2 });
}

// src/filters/buildMongoFilter.ts
function filterToMongoCondition(filter) {
  const { columnName, operator, value, value2 } = filter;
  if (!columnName || !operator) {
    return null;
  }
  switch (operator) {
    case "equals":
      return { [columnName]: { $eq: value } };
    case "not_equals":
      return { [columnName]: { $ne: value } };
    case "contains":
      return { [columnName]: { $regex: String(value), $options: "i" } };
    case "not_contains":
      return { [columnName]: { $not: { $regex: String(value), $options: "i" } } };
    case "starts_with":
      return { [columnName]: { $regex: `^${escapeRegex(String(value))}`, $options: "i" } };
    case "ends_with":
      return { [columnName]: { $regex: `${escapeRegex(String(value))}$`, $options: "i" } };
    case "greater_than":
      return { [columnName]: { $gt: value } };
    case "less_than":
      return { [columnName]: { $lt: value } };
    case "greater_or_equal":
      return { [columnName]: { $gte: value } };
    case "less_or_equal":
      return { [columnName]: { $lte: value } };
    case "is_null":
      return { [columnName]: { $eq: null } };
    case "is_not_null":
      return { [columnName]: { $ne: null } };
    case "between":
      if (value2 !== void 0) {
        return { [columnName]: { $gte: value, $lte: value2 } };
      }
      return null;
    case "in": {
      const values = Array.isArray(value) ? value : String(value).split(",").map((v) => v.trim()).filter((v) => v !== "");
      return { [columnName]: { $in: values } };
    }
    default:
      return null;
  }
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function buildMongoFilter(filters, logic = "AND") {
  if (!filters || filters.length === 0) {
    return { query: {} };
  }
  const conditions = [];
  for (const filter of filters) {
    const condition = filterToMongoCondition(filter);
    if (condition) {
      conditions.push(condition);
    }
  }
  if (conditions.length === 0) {
    return { query: {} };
  }
  if (conditions.length === 1) {
    return { query: conditions[0] };
  }
  const queryOperator = logic === "AND" ? "$and" : "$or";
  return { query: { [queryOperator]: conditions } };
}
function buildMongoMatchStage(filters, logic = "AND") {
  const { query } = buildMongoFilter(filters, logic);
  return { $match: Object.keys(query).length > 0 ? query : {} };
}

// src/filters/buildElasticsearchFilter.ts
function filterToEsClause(filter) {
  const { columnName, operator, value, value2 } = filter;
  if (!columnName || !operator) {
    return null;
  }
  switch (operator) {
    case "equals":
      return { term: { [columnName]: value } };
    case "not_equals":
      return { bool: { must_not: { term: { [columnName]: value } } } };
    case "contains":
      return { wildcard: { [columnName]: { value: `*${value}*`, case_insensitive: true } } };
    case "not_contains":
      return { bool: { must_not: { wildcard: { [columnName]: { value: `*${value}*`, case_insensitive: true } } } } };
    case "starts_with":
      return { prefix: { [columnName]: { value: String(value).toLowerCase(), case_insensitive: true } } };
    case "ends_with":
      return { wildcard: { [columnName]: { value: `*${value}`, case_insensitive: true } } };
    case "greater_than":
      return { range: { [columnName]: { gt: value } } };
    case "less_than":
      return { range: { [columnName]: { lt: value } } };
    case "greater_or_equal":
      return { range: { [columnName]: { gte: value } } };
    case "less_or_equal":
      return { range: { [columnName]: { lte: value } } };
    case "is_null":
      return { bool: { must_not: { exists: { field: columnName } } } };
    case "is_not_null":
      return { exists: { field: columnName } };
    case "between":
      if (value2 !== void 0) {
        return { range: { [columnName]: { gte: value, lte: value2 } } };
      }
      return null;
    case "in": {
      const values = Array.isArray(value) ? value : String(value).split(",").map((v) => v.trim()).filter((v) => v !== "");
      return { terms: { [columnName]: values } };
    }
    default:
      return null;
  }
}
function buildElasticsearchFilter(filters, logic = "AND") {
  if (!filters || filters.length === 0) {
    return { query: { bool: {} } };
  }
  const clauses = [];
  for (const filter of filters) {
    const clause = filterToEsClause(filter);
    if (clause) {
      clauses.push(clause);
    }
  }
  if (clauses.length === 0) {
    return { query: { bool: {} } };
  }
  if (logic === "AND") {
    return { query: { bool: { must: clauses } } };
  } else {
    return { query: { bool: { should: clauses, minimum_should_match: 1 } } };
  }
}
function buildElasticsearchSearchBody(filters, logic = "AND", options = {}) {
  const { query } = buildElasticsearchFilter(filters, logic);
  const { from = 0, size = 100, sort } = options;
  const body = {
    query: query.bool && Object.keys(query.bool).length > 0 ? query : { match_all: {} },
    from,
    size
  };
  if (sort && sort.length > 0) {
    body.sort = sort;
  }
  return body;
}

// src/filters/buildCassandraFilter.ts
function quoteIdentifier(name) {
  return `"${name.replace(/"/g, '""')}"`;
}
function buildCassandraFilter(filters, logic = "AND") {
  if (!filters || filters.length === 0) {
    return { whereClause: "", params: [] };
  }
  if (logic === "OR") {
    console.warn("Cassandra does not natively support OR in WHERE clauses. Results may require ALLOW FILTERING or multiple queries.");
  }
  const conditions = [];
  const params = [];
  for (const filter of filters) {
    if (!filter.columnName || !filter.operator) {
      continue;
    }
    const columnName = quoteIdentifier(filter.columnName);
    switch (filter.operator) {
      case "equals":
        conditions.push(`${columnName} = ?`);
        params.push(filter.value);
        break;
      case "not_equals":
        conditions.push(`${columnName} != ?`);
        params.push(filter.value);
        break;
      case "contains":
        conditions.push(`${columnName} CONTAINS ?`);
        params.push(filter.value);
        break;
      case "not_contains":
        console.warn("Cassandra does not support NOT CONTAINS. Filter will be applied client-side.");
        break;
      case "starts_with":
        conditions.push(`${columnName} LIKE ?`);
        params.push(`${filter.value}%`);
        break;
      case "ends_with":
        conditions.push(`${columnName} LIKE ?`);
        params.push(`%${filter.value}`);
        break;
      case "greater_than":
        conditions.push(`${columnName} > ?`);
        params.push(filter.value);
        break;
      case "less_than":
        conditions.push(`${columnName} < ?`);
        params.push(filter.value);
        break;
      case "greater_or_equal":
        conditions.push(`${columnName} >= ?`);
        params.push(filter.value);
        break;
      case "less_or_equal":
        conditions.push(`${columnName} <= ?`);
        params.push(filter.value);
        break;
      case "is_null":
        conditions.push(`${columnName} = NULL`);
        break;
      case "is_not_null":
        conditions.push(`${columnName} != NULL`);
        break;
      case "between":
        if (filter.value2 !== void 0) {
          conditions.push(`${columnName} >= ? AND ${columnName} <= ?`);
          params.push(filter.value, filter.value2);
        }
        break;
      case "in": {
        const values = Array.isArray(filter.value) ? filter.value : String(filter.value).split(",").map((v) => v.trim()).filter((v) => v !== "");
        if (values.length > 0) {
          const placeholders = values.map(() => "?").join(", ");
          conditions.push(`${columnName} IN (${placeholders})`);
          params.push(...values);
        }
        break;
      }
    }
  }
  if (conditions.length === 0) {
    return { whereClause: "", params: [] };
  }
  const whereClause = conditions.join(" AND ");
  return { whereClause, params };
}
function needsAllowFiltering(filters) {
  if (!filters || filters.length === 0) {
    return false;
  }
  const filteringRequiredOperators = [
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "greater_than",
    "less_than",
    "greater_or_equal",
    "less_or_equal",
    "between",
    "not_equals"
  ];
  return filters.some((f) => filteringRequiredOperators.includes(f.operator));
}

// src/filters/operators.ts
var OPERATOR_METADATA = {
  equals: {
    label: "Equals",
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ["string", "number", "date", "boolean", "any"]
  },
  not_equals: {
    label: "Not Equals",
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ["string", "number", "date", "boolean", "any"]
  },
  contains: {
    label: "Contains",
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ["string"]
  },
  not_contains: {
    label: "Does Not Contain",
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ["string"]
  },
  starts_with: {
    label: "Starts With",
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ["string"]
  },
  ends_with: {
    label: "Ends With",
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ["string"]
  },
  greater_than: {
    label: "Greater Than",
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ["number", "date"]
  },
  less_than: {
    label: "Less Than",
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ["number", "date"]
  },
  greater_or_equal: {
    label: "Greater or Equal",
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ["number", "date"]
  },
  less_or_equal: {
    label: "Less or Equal",
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ["number", "date"]
  },
  is_null: {
    label: "Is NULL",
    needsValue: false,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ["any"]
  },
  is_not_null: {
    label: "Is Not NULL",
    needsValue: false,
    needsTwoValues: false,
    needsCommaSeparated: false,
    applicableTypes: ["any"]
  },
  in: {
    label: "In List",
    needsValue: true,
    needsTwoValues: false,
    needsCommaSeparated: true,
    applicableTypes: ["string", "number"]
  },
  between: {
    label: "Between",
    needsValue: true,
    needsTwoValues: true,
    needsCommaSeparated: false,
    applicableTypes: ["number", "date"]
  }
};
var STRING_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "in",
  "is_null",
  "is_not_null"
];
var NUMERIC_OPERATORS = [
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "greater_or_equal",
  "less_or_equal",
  "between",
  "in",
  "is_null",
  "is_not_null"
];
var DATE_OPERATORS = [
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "greater_or_equal",
  "less_or_equal",
  "between",
  "is_null",
  "is_not_null"
];
var BOOLEAN_OPERATORS = [
  "equals",
  "is_null",
  "is_not_null"
];
var ALL_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "greater_than",
  "less_than",
  "greater_or_equal",
  "less_or_equal",
  "is_null",
  "is_not_null",
  "in",
  "between"
];
var OPERATOR_LABELS = Object.fromEntries(
  Object.entries(OPERATOR_METADATA).map(([op, meta]) => [op, meta.label])
);
function getOperatorsForType(dataType) {
  const normalizedType = dataType.toLowerCase();
  if (normalizedType.includes("int") || normalizedType.includes("numeric") || normalizedType.includes("decimal") || normalizedType.includes("real") || normalizedType.includes("double") || normalizedType.includes("float") || normalizedType.includes("money") || normalizedType === "number" || normalizedType === "bigint" || normalizedType === "smallint" || normalizedType === "tinyint") {
    return NUMERIC_OPERATORS;
  }
  if (normalizedType.includes("date") || normalizedType.includes("time") || normalizedType.includes("timestamp") || normalizedType === "datetime" || normalizedType === "datetime2" || normalizedType === "smalldatetime") {
    return DATE_OPERATORS;
  }
  if (normalizedType === "boolean" || normalizedType === "bool" || normalizedType === "bit") {
    return BOOLEAN_OPERATORS;
  }
  return STRING_OPERATORS;
}
function getOperatorMetadata(operator) {
  return OPERATOR_METADATA[operator];
}
function operatorNeedsValue(operator) {
  return OPERATOR_METADATA[operator].needsValue;
}
function operatorNeedsTwoValues(operator) {
  return OPERATOR_METADATA[operator].needsTwoValues;
}
function operatorNeedsCommaSeparated(operator) {
  return OPERATOR_METADATA[operator].needsCommaSeparated;
}
function isOperatorValidForType(operator, dataType) {
  const validOperators = getOperatorsForType(dataType);
  return validOperators.includes(operator);
}

// src/filters/validateFilter.ts
function validateFilter(filter) {
  const errors = [];
  if (!filter.id) {
    errors.push("Filter must have an id");
  }
  if (!filter.columnName || filter.columnName.trim() === "") {
    errors.push("Column name is required");
  }
  if (!filter.operator) {
    errors.push("Operator is required");
  } else if (!ALL_OPERATORS.includes(filter.operator)) {
    errors.push(`Invalid operator: ${filter.operator}`);
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  if (operatorNeedsValue(filter.operator)) {
    if (filter.value === void 0 || filter.value === null) {
      errors.push(`Operator '${filter.operator}' requires a value`);
    } else if (typeof filter.value === "string" && filter.value.trim() === "") {
      if (!["equals", "not_equals"].includes(filter.operator)) {
        errors.push(`Value cannot be empty for operator '${filter.operator}'`);
      }
    }
  }
  if (operatorNeedsTwoValues(filter.operator)) {
    if (filter.value2 === void 0 || filter.value2 === null) {
      errors.push(`Operator '${filter.operator}' requires a second value`);
    }
  }
  if (filter.operator === "in") {
    const values = Array.isArray(filter.value) ? filter.value : String(filter.value || "").split(",").map((v) => v.trim()).filter((v) => v !== "");
    if (values.length === 0) {
      errors.push("IN operator requires at least one value");
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    errors: [],
    normalizedFilter: normalizeFilter(filter)
  };
}
function validateFilters(filters) {
  return filters.map(validateFilter);
}
function areFiltersValid(filters) {
  return filters.every((f) => validateFilter(f).valid);
}
function getFilterErrors(filters) {
  const errors = [];
  filters.forEach((filter, index) => {
    const result = validateFilter(filter);
    if (!result.valid) {
      const context = filter.columnName || `Filter ${index + 1}`;
      result.errors.forEach((err) => {
        errors.push(`${context}: ${err}`);
      });
    }
  });
  return errors;
}
function normalizeFilter(filter) {
  const normalized = {
    id: filter.id,
    columnName: filter.columnName.trim(),
    operator: filter.operator,
    value: filter.value
  };
  if (typeof normalized.value === "string") {
    normalized.value = normalized.value.trim();
  }
  if (filter.value2 !== void 0) {
    normalized.value2 = typeof filter.value2 === "string" ? filter.value2.trim() : filter.value2;
  }
  if (filter.operator === "in" && typeof normalized.value === "string") {
    normalized.value = normalized.value.split(",").map((v) => v.trim()).filter((v) => v !== "");
  }
  return normalized;
}
function createFilter(columnName, operator = "equals") {
  return {
    id: generateFilterId(),
    columnName,
    operator,
    value: ""
  };
}
function generateFilterId() {
  return `filter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
function isFilterEmpty(filter) {
  if (!operatorNeedsValue(filter.operator)) {
    return false;
  }
  if (filter.value === void 0 || filter.value === null) {
    return true;
  }
  if (typeof filter.value === "string" && filter.value.trim() === "") {
    return true;
  }
  if (Array.isArray(filter.value) && filter.value.length === 0) {
    return true;
  }
  return false;
}
function removeEmptyFilters(filters) {
  return filters.filter((f) => !isFilterEmpty(f));
}

// src/export/toCsv.ts
var DEFAULT_OPTIONS = {
  includeHeaders: true,
  delimiter: ",",
  lineEnding: "\n",
  nullValue: ""
};
function toCsv(rows, columns, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines = [];
  if (opts.includeHeaders) {
    lines.push(
      columns.map((col) => escapeField(col, opts.delimiter)).join(opts.delimiter)
    );
  }
  for (const row of rows) {
    const values = columns.map((col) => {
      const value = row[col];
      const formatted = formatValue(value, opts.nullValue);
      return escapeField(formatted, opts.delimiter);
    });
    lines.push(values.join(opts.delimiter));
  }
  return lines.join(opts.lineEnding);
}
function escapeField(value, delimiter) {
  const needsEscaping = value.includes(delimiter) || value.includes("\n") || value.includes("\r") || value.includes('"');
  if (needsEscaping) {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return value;
}
function formatValue(value, nullValue) {
  if (value === null || value === void 0) {
    return nullValue;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

// src/export/toJson.ts
var DEFAULT_OPTIONS2 = {
  pretty: true,
  indent: 2,
  columns: []
};
function toJson(rows, options = {}) {
  const opts = { ...DEFAULT_OPTIONS2, ...options };
  let data = rows;
  if (opts.columns && opts.columns.length > 0) {
    data = rows.map((row) => {
      const filtered = {};
      for (const col of opts.columns) {
        if (col in row) {
          filtered[col] = row[col];
        }
      }
      return filtered;
    });
  }
  if (opts.pretty) {
    return JSON.stringify(data, null, opts.indent);
  }
  return JSON.stringify(data);
}
function toJsonLines(rows, options = {}) {
  const lines = [];
  for (const row of rows) {
    let data = row;
    if (options.columns && options.columns.length > 0) {
      data = {};
      for (const col of options.columns) {
        if (col in row) {
          data[col] = row[col];
        }
      }
    }
    lines.push(JSON.stringify(data));
  }
  return lines.join("\n");
}

// src/export/toSql.ts
var DEFAULT_OPTIONS3 = {
  dbType: "postgres",
  schema: "",
  includeColumns: true,
  batchSize: 1
};
function toSql(rows, columns, options) {
  const opts = { ...DEFAULT_OPTIONS3, ...options };
  const statements = [];
  const quoteId = getIdentifierQuoter(opts.dbType);
  const quoteVal = getValueQuoter(opts.dbType);
  const tableRef = opts.schema ? `${quoteId(opts.schema)}.${quoteId(opts.table)}` : quoteId(opts.table);
  const columnList = opts.includeColumns ? ` (${columns.map(quoteId).join(", ")})` : "";
  if (opts.batchSize > 1) {
    for (let i = 0; i < rows.length; i += opts.batchSize) {
      const batch = rows.slice(i, i + opts.batchSize);
      const valuesList = batch.map((row) => {
        const values = columns.map((col) => quoteVal(row[col]));
        return `(${values.join(", ")})`;
      }).join(",\n  ");
      statements.push(`INSERT INTO ${tableRef}${columnList} VALUES
  ${valuesList};`);
    }
  } else {
    for (const row of rows) {
      const values = columns.map((col) => quoteVal(row[col]));
      statements.push(
        `INSERT INTO ${tableRef}${columnList} VALUES (${values.join(", ")});`
      );
    }
  }
  return statements.join("\n");
}
function getIdentifierQuoter(dbType) {
  switch (dbType) {
    case "mysql":
      return (id) => `\`${id.replace(/`/g, "``")}\``;
    case "sqlserver":
      return (id) => `[${id.replace(/\]/g, "]]")}]`;
    case "postgres":
    case "sqlite":
    default:
      return (id) => `"${id.replace(/"/g, '""')}"`;
  }
}
function getValueQuoter(dbType) {
  return (value) => {
    if (value === null || value === void 0) {
      return "NULL";
    }
    if (typeof value === "number") {
      if (Number.isNaN(value)) return "NULL";
      if (!Number.isFinite(value)) return "NULL";
      return String(value);
    }
    if (typeof value === "boolean") {
      if (dbType === "mysql" || dbType === "sqlserver") {
        return value ? "1" : "0";
      }
      return value ? "TRUE" : "FALSE";
    }
    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }
    if (typeof value === "object") {
      const json = JSON.stringify(value);
      return `'${escapeString(json)}'`;
    }
    return `'${escapeString(String(value))}'`;
  };
}
function escapeString(str) {
  return str.replace(/'/g, "''");
}

// src/export/toMarkdown.ts
var DEFAULT_OPTIONS4 = {
  alignment: "left",
  maxColumnWidth: 0,
  // 0 = no limit
  nullValue: ""
};
function toMarkdown(rows, columns, options = {}) {
  const opts = { ...DEFAULT_OPTIONS4, ...options };
  const lines = [];
  const widths = calculateColumnWidths(rows, columns, opts);
  const headerCells = columns.map((col, i) => padCell(col, widths[i], "left"));
  lines.push(`| ${headerCells.join(" | ")} |`);
  const separatorCells = columns.map((col, i) => {
    const align = getColumnAlignment(col, opts.alignment);
    return createSeparator(widths[i], align);
  });
  lines.push(`|${separatorCells.join("|")}|`);
  for (const row of rows) {
    const cells = columns.map((col, i) => {
      const value = formatValue2(row[col], opts.nullValue, opts.maxColumnWidth);
      const align = getColumnAlignment(col, opts.alignment);
      return padCell(value, widths[i], align);
    });
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}
function calculateColumnWidths(rows, columns, opts) {
  const widths = columns.map((col) => col.length);
  for (const row of rows) {
    columns.forEach((col, i) => {
      const value = formatValue2(row[col], opts.nullValue, opts.maxColumnWidth);
      widths[i] = Math.max(widths[i], value.length);
    });
  }
  if (opts.maxColumnWidth > 0) {
    return widths.map((w) => Math.min(w, opts.maxColumnWidth));
  }
  return widths.map((w) => Math.max(w, 3));
}
function getColumnAlignment(column, alignment) {
  if (typeof alignment === "object") {
    return alignment[column] || "left";
  }
  return alignment || "left";
}
function createSeparator(width, align) {
  const dashes = "-".repeat(Math.max(width, 1));
  switch (align) {
    case "center":
      return `:${dashes}:`;
    case "right":
      return `${dashes}:`;
    case "left":
    default:
      return `:${dashes}`;
  }
}
function padCell(value, width, align) {
  const padding = Math.max(0, width - value.length);
  switch (align) {
    case "center": {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return " ".repeat(left) + value + " ".repeat(right);
    }
    case "right":
      return " ".repeat(padding) + value;
    case "left":
    default:
      return value + " ".repeat(padding);
  }
}
function formatValue2(value, nullValue, maxWidth) {
  let result;
  if (value === null || value === void 0) {
    result = nullValue;
  } else if (value instanceof Date) {
    result = value.toISOString();
  } else if (typeof value === "object") {
    result = JSON.stringify(value);
  } else {
    result = String(value);
  }
  result = result.replace(/\|/g, "\\|");
  result = result.replace(/\n/g, "<br>");
  if (maxWidth > 0 && result.length > maxWidth) {
    result = result.substring(0, maxWidth - 3) + "...";
  }
  return result;
}

// src/export/parseImport.ts
var DEFAULT_CSV_OPTIONS = {
  hasHeaders: true,
  delimiter: ",",
  skipEmptyLines: true,
  trimValues: true
};
var DEFAULT_JSON_OPTIONS = {
  dataPath: ""
};
function parseCsv(content, options = {}) {
  const opts = { ...DEFAULT_CSV_OPTIONS, ...options };
  const warnings = [];
  let lines = content.split(/\r?\n/);
  if (opts.skipEmptyLines) {
    lines = lines.filter((line) => line.trim().length > 0);
  }
  if (lines.length === 0) {
    throw new Error("Empty CSV content");
  }
  const firstLine = parseCSVLine(lines[0], opts.delimiter);
  let columns;
  let dataStartIndex;
  if (opts.hasHeaders) {
    columns = firstLine.map((col, i) => {
      const trimmed = opts.trimValues ? col.trim() : col;
      if (!trimmed) {
        warnings.push(`Empty column header at position ${i + 1}, using "column_${i + 1}"`);
        return `column_${i + 1}`;
      }
      return trimmed;
    });
    dataStartIndex = 1;
  } else {
    columns = firstLine.map((_, i) => `column_${i + 1}`);
    dataStartIndex = 0;
  }
  const seen = /* @__PURE__ */ new Set();
  columns = columns.map((col, i) => {
    if (seen.has(col)) {
      const newName = `${col}_${i + 1}`;
      warnings.push(`Duplicate column name "${col}" renamed to "${newName}"`);
      seen.add(newName);
      return newName;
    }
    seen.add(col);
    return col;
  });
  const rows = [];
  const expectedColumns = columns.length;
  for (let i = dataStartIndex; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], opts.delimiter);
    if (values.length !== expectedColumns) {
      warnings.push(
        `Row ${i + 1} has ${values.length} columns, expected ${expectedColumns}`
      );
    }
    const row = {};
    columns.forEach((col, idx) => {
      let value = values[idx];
      if (opts.trimValues && typeof value === "string") {
        value = value.trim();
      }
      if (value === "" || value === void 0) {
        value = null;
      }
      row[col] = value;
    });
    rows.push(row);
  }
  return {
    columns,
    rows,
    rowCount: rows.length,
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
function parseCSVLine(line, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
function parseJson(content, options = {}) {
  const opts = { ...DEFAULT_JSON_OPTIONS, ...options };
  const warnings = [];
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }
  if (opts.dataPath) {
    const pathParts = opts.dataPath.split(".");
    for (const part of pathParts) {
      if (parsed && typeof parsed === "object" && part in parsed) {
        parsed = parsed[part];
      } else {
        throw new Error(`Data path "${opts.dataPath}" not found in JSON`);
      }
    }
  }
  if (!Array.isArray(parsed)) {
    throw new Error("JSON data must be an array of objects");
  }
  if (parsed.length === 0) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      warnings: ["Empty JSON array"]
    };
  }
  const columnSet = /* @__PURE__ */ new Set();
  for (const item of parsed) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      Object.keys(item).forEach((key) => columnSet.add(key));
    }
  }
  const columns = Array.from(columnSet);
  if (columns.length === 0) {
    throw new Error("No valid objects found in JSON array");
  }
  const rows = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      warnings.push(`Item at index ${i} is not an object, skipping`);
      continue;
    }
    rows.push(item);
  }
  return {
    columns,
    rows,
    rowCount: rows.length,
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
function parseJsonLines(content) {
  const warnings = [];
  const rows = [];
  const columnSet = /* @__PURE__ */ new Set();
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    throw new Error("Empty JSON Lines content");
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        warnings.push(`Line ${i + 1} is not an object, skipping`);
        continue;
      }
      Object.keys(parsed).forEach((key) => columnSet.add(key));
      rows.push(parsed);
    } catch (e) {
      warnings.push(`Line ${i + 1} has invalid JSON: ${e.message}`);
    }
  }
  return {
    columns: Array.from(columnSet),
    rows,
    rowCount: rows.length,
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
function detectFormat(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return "json";
  }
  if (trimmed.startsWith("{")) {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > 1 && lines.every((l) => l.trim().startsWith("{"))) {
      return "jsonlines";
    }
    return "json";
  }
  if (trimmed.includes("\n") || trimmed.includes(",")) {
    return "csv";
  }
  return null;
}
var DIALECT_MAP = {
  postgres: "postgresql",
  mysql: "mysql",
  mariadb: "mariadb",
  sqlite: "sqlite",
  sqlserver: "tsql",
  bigquery: "bigquery",
  redshift: "redshift",
  spark: "spark",
  trino: "trino"
};
var DEFAULT_OPTIONS5 = {
  dialect: "postgres",
  tabWidth: 2,
  keywordCase: "upper",
  dataTypeCase: "preserve",
  functionCase: "preserve",
  identifierCase: "preserve",
  useTabs: false,
  commaPosition: "after",
  logicalOperatorNewline: "before",
  lineWidth: 80
};
function formatSql(sql, options = {}) {
  const opts = { ...DEFAULT_OPTIONS5, ...options };
  try {
    const language = DIALECT_MAP[opts.dialect] || "postgresql";
    return sqlFormatter.format(sql, {
      language,
      tabWidth: opts.tabWidth,
      useTabs: opts.useTabs,
      keywordCase: opts.keywordCase,
      dataTypeCase: opts.dataTypeCase,
      functionCase: opts.functionCase,
      identifierCase: opts.identifierCase,
      linesBetweenQueries: 2
    });
  } catch {
    return sql;
  }
}
function minifySql(sql) {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([(),])\s*/g, "$1").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
}
function hasMultipleStatements(sql) {
  const cleaned = sql.replace(/'[^']*'/g, '""').replace(/"[^"]*"/g, '""').replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const statements = cleaned.split(";").filter((s) => s.trim().length > 0);
  return statements.length > 1;
}
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];
    if (!inString && !inBlockComment && char === "-" && nextChar === "-") {
      inLineComment = true;
    }
    if (inLineComment && char === "\n") {
      inLineComment = false;
    }
    if (!inString && !inLineComment && char === "/" && nextChar === "*") {
      inBlockComment = true;
    }
    if (inBlockComment && char === "*" && nextChar === "/") {
      inBlockComment = false;
      current += "*/";
      i++;
      continue;
    }
    if (!inLineComment && !inBlockComment) {
      if (!inString && (char === "'" || char === '"')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        if (nextChar !== stringChar) {
          inString = false;
        } else {
          current += char;
          i++;
        }
      }
    }
    if (!inString && !inLineComment && !inBlockComment && char === ";") {
      const stmt = current.trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      current = "";
      continue;
    }
    current += char;
  }
  const final = current.trim();
  if (final.length > 0) {
    statements.push(final);
  }
  return statements;
}

// src/sql/validateSql.ts
var DANGEROUS_KEYWORDS = [
  "DROP",
  "TRUNCATE",
  "DELETE",
  "ALTER",
  "CREATE",
  "GRANT",
  "REVOKE"
];
var VALIDATION_PATTERNS = {
  // Check for basic syntax issues
  emptyQuery: /^\s*$/,
  // Check for dangerous operations
  dangerousOps: new RegExp(`\\b(${DANGEROUS_KEYWORDS.join("|")})\\b`, "i")
};
function validateSql(sql) {
  const warnings = [];
  if (VALIDATION_PATTERNS.emptyQuery.test(sql)) {
    return { valid: false, error: "Empty SQL query" };
  }
  const quoteBalance = checkQuoteBalance(sql);
  if (!quoteBalance.valid) {
    return {
      valid: false,
      error: quoteBalance.error,
      position: quoteBalance.position
    };
  }
  const parenBalance = checkParenthesesBalance(sql);
  if (!parenBalance.valid) {
    return {
      valid: false,
      error: parenBalance.error,
      position: parenBalance.position
    };
  }
  if (VALIDATION_PATTERNS.dangerousOps.test(sql)) {
    const match = sql.match(VALIDATION_PATTERNS.dangerousOps);
    if (match) {
      warnings.push(`Query contains potentially dangerous operation: ${match[1].toUpperCase()}`);
    }
  }
  if (/^\s*DELETE\s+FROM\b/i.test(sql) && !/\bWHERE\b/i.test(sql)) {
    warnings.push("DELETE without WHERE clause will delete all rows");
  }
  if (/^\s*UPDATE\b/i.test(sql) && !/\bWHERE\b/i.test(sql)) {
    warnings.push("UPDATE without WHERE clause will update all rows");
  }
  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : void 0
  };
}
function checkQuoteBalance(sql) {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let lastQuotePos = { line: 1, column: 1, offset: 0 };
  let line = 1;
  let column = 1;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
    if (i > 0 && sql[i - 1] === "\\") {
      continue;
    }
    if (char === "'" && !inDoubleQuote) {
      if (sql[i + 1] === "'" && inSingleQuote) {
        i++;
        column++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      if (inSingleQuote) {
        lastQuotePos = { line, column, offset: i };
      }
    } else if (char === '"' && !inSingleQuote) {
      if (sql[i + 1] === '"' && inDoubleQuote) {
        i++;
        column++;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      if (inDoubleQuote) {
        lastQuotePos = { line, column, offset: i };
      }
    }
  }
  if (inSingleQuote) {
    return {
      valid: false,
      error: "Unclosed single quote",
      position: lastQuotePos
    };
  }
  if (inDoubleQuote) {
    return {
      valid: false,
      error: "Unclosed double quote",
      position: lastQuotePos
    };
  }
  return { valid: true };
}
function checkParenthesesBalance(sql) {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let lastOpenPos = { line: 1, column: 1, offset: 0 };
  let line = 1;
  let column = 1;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
    if (char === "'" && !inDoubleQuote) {
      if (sql[i + 1] !== "'") {
        inSingleQuote = !inSingleQuote;
      } else {
        i++;
        column++;
      }
    } else if (char === '"' && !inSingleQuote) {
      if (sql[i + 1] !== '"') {
        inDoubleQuote = !inDoubleQuote;
      } else {
        i++;
        column++;
      }
    }
    if (!inSingleQuote && !inDoubleQuote) {
      if (char === "(") {
        if (depth === 0) {
          lastOpenPos = { line, column, offset: i };
        }
        depth++;
      } else if (char === ")") {
        depth--;
        if (depth < 0) {
          return {
            valid: false,
            error: "Unexpected closing parenthesis",
            position: { line, column, offset: i }
          };
        }
      }
    }
  }
  if (depth > 0) {
    return {
      valid: false,
      error: "Unclosed parenthesis",
      position: lastOpenPos
    };
  }
  return { valid: true };
}
function isReadOnlyQuery(sql) {
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith("WITH")) {
    const withoutCte = sql.replace(/WITH\s+[\s\S]*?(?=SELECT|INSERT|UPDATE|DELETE)/i, "");
    return isReadOnlyQuery(withoutCte);
  }
  if (trimmed.startsWith("EXPLAIN")) {
    return true;
  }
  if (trimmed.startsWith("SELECT")) {
    return !/\bINTO\b/i.test(sql);
  }
  if (trimmed.startsWith("SHOW")) {
    return true;
  }
  if (trimmed.startsWith("DESCRIBE") || trimmed.startsWith("DESC")) {
    return true;
  }
  return false;
}
function detectDangerousOperations(sql) {
  const detected = [];
  const upperSql = sql.toUpperCase();
  for (const keyword of DANGEROUS_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(upperSql)) {
      detected.push(keyword);
    }
  }
  if (/DELETE\s+FROM\b/i.test(sql) && !/\bWHERE\b/i.test(sql)) {
    detected.push("DELETE_ALL");
  }
  if (/UPDATE\s+\w+\s+SET\b/i.test(sql) && !/\bWHERE\b/i.test(sql)) {
    detected.push("UPDATE_ALL");
  }
  return detected;
}

// src/sql/parseSql.ts
var SQL_KEYWORDS = {
  statements: [
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "CREATE",
    "ALTER",
    "DROP",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "BEGIN",
    "COMMIT",
    "ROLLBACK",
    "WITH",
    "EXPLAIN",
    "ANALYZE",
    "VACUUM",
    "MERGE",
    "UPSERT"
  ],
  clauses: [
    "FROM",
    "WHERE",
    "AND",
    "OR",
    "NOT",
    "IN",
    "EXISTS",
    "BETWEEN",
    "LIKE",
    "ILIKE",
    "IS",
    "NULL",
    "TRUE",
    "FALSE",
    "AS",
    "ON",
    "USING",
    "JOIN",
    "LEFT",
    "RIGHT",
    "INNER",
    "OUTER",
    "CROSS",
    "FULL",
    "NATURAL",
    "GROUP",
    "BY",
    "HAVING",
    "ORDER",
    "ASC",
    "DESC",
    "NULLS",
    "FIRST",
    "LAST",
    "LIMIT",
    "OFFSET",
    "FETCH",
    "NEXT",
    "ROWS",
    "ONLY",
    "PERCENT",
    "UNION",
    "INTERSECT",
    "EXCEPT",
    "ALL",
    "DISTINCT",
    "INTO",
    "VALUES",
    "SET",
    "DEFAULT",
    "RETURNING",
    "CASE",
    "WHEN",
    "THEN",
    "ELSE",
    "END",
    "OVER",
    "PARTITION",
    "WINDOW",
    "RANGE",
    "PRECEDING",
    "FOLLOWING",
    "UNBOUNDED",
    "CURRENT",
    "ROW"
  ],
  operators: [
    "=",
    "<>",
    "!=",
    "<",
    ">",
    "<=",
    ">=",
    "+",
    "-",
    "*",
    "/",
    "%",
    "||",
    "&&",
    "!",
    "~",
    "^",
    "&",
    "|",
    "::",
    "->",
    "->>",
    "#>",
    "#>>"
  ],
  functions: [
    "COUNT",
    "SUM",
    "AVG",
    "MIN",
    "MAX",
    "COALESCE",
    "NULLIF",
    "GREATEST",
    "LEAST",
    "CAST",
    "CONVERT",
    "EXTRACT",
    "DATE_PART",
    "DATE_TRUNC",
    "UPPER",
    "LOWER",
    "TRIM",
    "LTRIM",
    "RTRIM",
    "LENGTH",
    "SUBSTRING",
    "REPLACE",
    "CONCAT",
    "CONCAT_WS",
    "STRING_AGG",
    "ARRAY_AGG",
    "JSON_AGG",
    "JSONB_AGG",
    "ROW_NUMBER",
    "RANK",
    "DENSE_RANK",
    "NTILE",
    "LAG",
    "LEAD",
    "FIRST_VALUE",
    "LAST_VALUE",
    "NOW",
    "CURRENT_DATE",
    "CURRENT_TIME",
    "CURRENT_TIMESTAMP",
    "ABS",
    "CEIL",
    "FLOOR",
    "ROUND",
    "TRUNC",
    "POWER",
    "SQRT",
    "MOD",
    "RANDOM",
    "GENERATE_SERIES",
    "UNNEST"
  ],
  dataTypes: [
    "INT",
    "INTEGER",
    "SMALLINT",
    "BIGINT",
    "TINYINT",
    "DECIMAL",
    "NUMERIC",
    "REAL",
    "FLOAT",
    "DOUBLE",
    "PRECISION",
    "CHAR",
    "VARCHAR",
    "TEXT",
    "NCHAR",
    "NVARCHAR",
    "NTEXT",
    "DATE",
    "TIME",
    "TIMESTAMP",
    "DATETIME",
    "INTERVAL",
    "BOOLEAN",
    "BOOL",
    "BIT",
    "BINARY",
    "VARBINARY",
    "BLOB",
    "BYTEA",
    "JSON",
    "JSONB",
    "XML",
    "UUID",
    "SERIAL",
    "BIGSERIAL",
    "ARRAY",
    "ENUM",
    "POINT",
    "LINE",
    "POLYGON",
    "CIRCLE"
  ],
  literals: ["NULL", "TRUE", "FALSE"]
};
function parseSql(sql) {
  const normalized = normalizeWhitespace(sql);
  const type = detectStatementType(normalized);
  return {
    type,
    tables: extractTables(normalized, type),
    columns: extractColumns(normalized, type),
    hasWhere: /\bWHERE\b/i.test(normalized),
    hasLimit: /\bLIMIT\b/i.test(normalized) || /\bFETCH\s+(?:FIRST|NEXT)\b/i.test(normalized),
    hasOrderBy: /\bORDER\s+BY\b/i.test(normalized),
    isModifying: isModifyingStatement(type),
    sql
  };
}
function normalizeWhitespace(sql) {
  return sql.replace(/\s+/g, " ").trim();
}
function detectStatementType(sql) {
  const upperSql = sql.toUpperCase().trim();
  if (upperSql.startsWith("SELECT")) return "SELECT";
  if (upperSql.startsWith("INSERT")) return "INSERT";
  if (upperSql.startsWith("UPDATE")) return "UPDATE";
  if (upperSql.startsWith("DELETE")) return "DELETE";
  if (upperSql.startsWith("CREATE")) return "CREATE";
  if (upperSql.startsWith("ALTER")) return "ALTER";
  if (upperSql.startsWith("DROP")) return "DROP";
  if (upperSql.startsWith("TRUNCATE")) return "TRUNCATE";
  if (upperSql.startsWith("GRANT")) return "GRANT";
  if (upperSql.startsWith("REVOKE")) return "REVOKE";
  if (upperSql.startsWith("BEGIN")) return "BEGIN";
  if (upperSql.startsWith("COMMIT")) return "COMMIT";
  if (upperSql.startsWith("ROLLBACK")) return "ROLLBACK";
  if (upperSql.startsWith("WITH")) return "WITH";
  if (upperSql.startsWith("EXPLAIN")) return "EXPLAIN";
  return "UNKNOWN";
}
function isModifyingStatement(type) {
  return ["INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "TRUNCATE"].includes(type);
}
function extractTables(sql, type) {
  const tables = [];
  const cleaned = sql.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
  const fromMatch = cleaned.match(/\bFROM\s+([^,\s]+(?:\s*,\s*[^,\s]+)*)/i);
  if (fromMatch) {
    const tableList = fromMatch[1].split(/\s*,\s*/);
    for (const t of tableList) {
      const tableName = extractTableName(t);
      if (tableName && !tables.includes(tableName)) {
        tables.push(tableName);
      }
    }
  }
  const joinMatches = cleaned.matchAll(/\bJOIN\s+(\S+)/gi);
  for (const match of joinMatches) {
    const tableName = extractTableName(match[1]);
    if (tableName && !tables.includes(tableName)) {
      tables.push(tableName);
    }
  }
  if (type === "INSERT") {
    const insertMatch = cleaned.match(/\bINSERT\s+INTO\s+(\S+)/i);
    if (insertMatch) {
      const tableName = extractTableName(insertMatch[1]);
      if (tableName && !tables.includes(tableName)) {
        tables.push(tableName);
      }
    }
  }
  if (type === "UPDATE") {
    const updateMatch = cleaned.match(/\bUPDATE\s+(\S+)/i);
    if (updateMatch) {
      const tableName = extractTableName(updateMatch[1]);
      if (tableName && !tables.includes(tableName)) {
        tables.push(tableName);
      }
    }
  }
  if (type === "DELETE") {
    const deleteMatch = cleaned.match(/\bDELETE\s+FROM\s+(\S+)/i);
    if (deleteMatch) {
      const tableName = extractTableName(deleteMatch[1]);
      if (tableName && !tables.includes(tableName)) {
        tables.push(tableName);
      }
    }
  }
  return tables;
}
function extractTableName(raw) {
  let name = raw.replace(/\s+(?:AS\s+)?\w+$/i, "").trim();
  if (name.startsWith("(")) return null;
  name = name.replace(/["`\[\]]/g, "");
  const parts = name.split(".");
  return parts[parts.length - 1] || null;
}
function extractColumns(sql, type) {
  if (type !== "SELECT") return [];
  const columns = [];
  const selectMatch = sql.match(/\bSELECT\s+(.*?)\s+FROM\b/is);
  if (!selectMatch) return columns;
  const selectList = selectMatch[1];
  if (selectList.trim() === "*") {
    return ["*"];
  }
  const parts = splitSelectList(selectList);
  for (const part of parts) {
    const column = extractColumnName(part.trim());
    if (column && !columns.includes(column)) {
      columns.push(column);
    }
  }
  return columns;
}
function splitSelectList(selectList) {
  const parts = [];
  let current = "";
  let depth = 0;
  for (const char of selectList) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current);
  }
  return parts;
}
function extractColumnName(expr) {
  const cleaned = expr.replace(/^\s*DISTINCT\s+/i, "").trim();
  const aliasMatch = cleaned.match(/\s+(?:AS\s+)?["'`\[]?(\w+)["'`\]]?\s*$/i);
  if (aliasMatch) {
    return aliasMatch[1];
  }
  const dotMatch = cleaned.match(/\.["'`\[]?(\w+)["'`\]]?\s*$/);
  if (dotMatch) {
    return dotMatch[1];
  }
  const simpleMatch = cleaned.match(/^["'`\[]?(\w+)["'`\]]?$/);
  if (simpleMatch) {
    return simpleMatch[1];
  }
  return null;
}
function getSqlKeywords() {
  return SQL_KEYWORDS;
}
function isSqlKeyword(word) {
  const upper = word.toUpperCase();
  return SQL_KEYWORDS.statements.includes(upper) || SQL_KEYWORDS.clauses.includes(upper) || SQL_KEYWORDS.functions.includes(upper) || SQL_KEYWORDS.dataTypes.includes(upper) || SQL_KEYWORDS.literals.includes(upper);
}

exports.ALL_OPERATORS = ALL_OPERATORS;
exports.BOOLEAN_OPERATORS = BOOLEAN_OPERATORS;
exports.DATE_OPERATORS = DATE_OPERATORS;
exports.NUMERIC_OPERATORS = NUMERIC_OPERATORS;
exports.OPERATOR_LABELS = OPERATOR_LABELS;
exports.OPERATOR_METADATA = OPERATOR_METADATA;
exports.SQL_KEYWORDS = SQL_KEYWORDS;
exports.STRING_OPERATORS = STRING_OPERATORS;
exports.areFiltersValid = areFiltersValid;
exports.buildCassandraFilter = buildCassandraFilter;
exports.buildElasticsearchFilter = buildElasticsearchFilter;
exports.buildElasticsearchSearchBody = buildElasticsearchSearchBody;
exports.buildMongoFilter = buildMongoFilter;
exports.buildMongoMatchStage = buildMongoMatchStage;
exports.buildPath = buildPath;
exports.buildSqlFilter = buildSqlFilter;
exports.buildSqlFilterNamed = buildSqlFilterNamed;
exports.buildWhereClause = buildWhereClause;
exports.collapseAll = collapseAll;
exports.collapsePath = collapsePath;
exports.countDocumentFields = countDocumentFields;
exports.createFilter = createFilter;
exports.debounce = debounce;
exports.deleteAtPath = deleteAtPath;
exports.detectDangerousOperations = detectDangerousOperations;
exports.detectFormat = detectFormat;
exports.detectValueType = detectValueType;
exports.expandAll = expandAll;
exports.expandPath = expandPath;
exports.flattenDocument = flattenDocument;
exports.formatBytes = formatBytes;
exports.formatBytesPerSecond = formatBytesPerSecond;
exports.formatSql = formatSql;
exports.formatValueForDisplay = formatValueForDisplay;
exports.generateHash = generateHash;
exports.generateId = generateId;
exports.generateSequentialId = generateSequentialId;
exports.generateSlug = generateSlug;
exports.generateTimestampId = generateTimestampId;
exports.generateUUID = generateUUID;
exports.getAtPath = getAtPath;
exports.getCompositeDocumentId = getCompositeDocumentId;
exports.getConnectionDisplayName = getConnectionDisplayName;
exports.getConnectionKey = getConnectionKey;
exports.getDbTypeFromKey = getDbTypeFromKey;
exports.getDocumentDepth = getDocumentDepth;
exports.getDocumentId = getDocumentId;
exports.getDocumentIdField = getDocumentIdField;
exports.getDocumentIdFields = getDocumentIdFields;
exports.getDocumentKeys = getDocumentKeys;
exports.getExpandedPathsToDepth = getExpandedPathsToDepth;
exports.getFilterErrors = getFilterErrors;
exports.getOperatorMetadata = getOperatorMetadata;
exports.getOperatorsForType = getOperatorsForType;
exports.getParentPath = getParentPath;
exports.getPathKey = getPathKey;
exports.getPathsToShowSearchResults = getPathsToShowSearchResults;
exports.getPrimaryKeyObject = getPrimaryKeyObject;
exports.getSqlKeywords = getSqlKeywords;
exports.getTypeColor = getTypeColor;
exports.getTypeLabel = getTypeLabel;
exports.hasMultipleStatements = hasMultipleStatements;
exports.hasPath = hasPath;
exports.inferColumnType = inferColumnType;
exports.isContainer = isContainer;
exports.isDocumentDbType = isDocumentDbType;
exports.isFilterEmpty = isFilterEmpty;
exports.isOperatorValidForType = isOperatorValidForType;
exports.isPrimitive = isPrimitive;
exports.isReadOnlyQuery = isReadOnlyQuery;
exports.isSameConnection = isSameConnection;
exports.isSqlKeyword = isSqlKeyword;
exports.joinPath = joinPath;
exports.minifySql = minifySql;
exports.needsAllowFiltering = needsAllowFiltering;
exports.nestToTree = nestToTree;
exports.normalizeFilter = normalizeFilter;
exports.once = once;
exports.operatorNeedsCommaSeparated = operatorNeedsCommaSeparated;
exports.operatorNeedsTwoValues = operatorNeedsTwoValues;
exports.operatorNeedsValue = operatorNeedsValue;
exports.parseBytes = parseBytes;
exports.parseConnectionKey = parseConnectionKey;
exports.parseCsv = parseCsv;
exports.parseJson = parseJson;
exports.parseJsonLines = parseJsonLines;
exports.parsePath = parsePath;
exports.parseSql = parseSql;
exports.removeEmptyFilters = removeEmptyFilters;
exports.resetSequentialCounter = resetSequentialCounter;
exports.searchTree = searchTree;
exports.setAtPath = setAtPath;
exports.splitStatements = splitStatements;
exports.throttle = throttle;
exports.toCsv = toCsv;
exports.toJson = toJson;
exports.toJsonLines = toJsonLines;
exports.toMarkdown = toMarkdown;
exports.toSql = toSql;
exports.togglePath = togglePath;
exports.truncateArray = truncateArray;
exports.truncateJson = truncateJson;
exports.truncatePath = truncatePath;
exports.truncateString = truncateString;
exports.truncateValue = truncateValue;
exports.unflattenDocument = unflattenDocument;
exports.validateFilter = validateFilter;
exports.validateFilters = validateFilters;
exports.validateSql = validateSql;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map