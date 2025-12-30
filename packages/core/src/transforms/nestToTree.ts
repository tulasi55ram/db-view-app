/**
 * Tree representation utilities
 *
 * Converts documents into tree structures suitable for hierarchical display.
 */

import type { TreeNode, TreeOptions } from './types.js';
import { detectValueType } from './inferTypes.js';

/**
 * Default options for tree creation
 */
const DEFAULT_TREE_OPTIONS: Required<TreeOptions> = {
  expandedPaths: new Set<string>(),
  maxDepth: Infinity,
  sortKeys: false,
};

/**
 * Converts a document into a tree structure.
 *
 * Creates a hierarchical representation suitable for tree view UIs,
 * with expand/collapse state based on provided paths.
 *
 * @param document - The document to convert
 * @param options - Tree options including expanded paths
 * @returns Root tree node
 *
 * @example
 * ```typescript
 * const doc = {
 *   user: { name: 'John', age: 30 },
 *   items: ['a', 'b']
 * };
 *
 * const tree = nestToTree(doc, {
 *   expandedPaths: new Set(['root', 'root.user'])
 * });
 * // {
 * //   key: 'root',
 * //   path: 'root',
 * //   type: 'object',
 * //   isExpanded: true,
 * //   children: [
 * //     { key: 'user', path: 'root.user', type: 'object', isExpanded: true, children: [...] },
 * //     { key: 'items', path: 'root.items', type: 'array', isExpanded: false, childCount: 2 }
 * //   ]
 * // }
 * ```
 */
export function nestToTree(
  document: Record<string, unknown>,
  options?: TreeOptions
): TreeNode {
  const opts = { ...DEFAULT_TREE_OPTIONS, ...options };

  return createTreeNode(
    'root',
    'root',
    document,
    0,
    opts,
    false
  );
}

/**
 * Creates a tree node for a value.
 */
function createTreeNode(
  key: string,
  path: string,
  value: unknown,
  depth: number,
  options: Required<TreeOptions>,
  isArrayElement: boolean,
  arrayIndex?: number
): TreeNode {
  const type = detectValueType(value);
  const isExpanded = options.expandedPaths.has(path);

  // Check max depth
  if (depth > options.maxDepth) {
    return {
      key,
      path,
      value,
      type,
      isExpanded: false,
      isArrayElement,
      arrayIndex,
    };
  }

  // Handle arrays
  if (type === 'array') {
    const arr = value as unknown[];
    const children = isExpanded
      ? arr.map((item, index) =>
          createTreeNode(
            String(index),
            `${path}.${index}`,
            item,
            depth + 1,
            options,
            true,
            index
          )
        )
      : undefined;

    return {
      key,
      path,
      value: undefined, // Don't include raw value for containers
      type: 'array',
      children,
      isExpanded,
      childCount: arr.length,
      isArrayElement,
      arrayIndex,
    };
  }

  // Handle objects
  if (type === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    let keys = Object.keys(obj);

    if (options.sortKeys) {
      keys = keys.sort();
    }

    const children = isExpanded
      ? keys.map((childKey) =>
          createTreeNode(
            childKey,
            `${path}.${childKey}`,
            obj[childKey],
            depth + 1,
            options,
            false
          )
        )
      : undefined;

    return {
      key,
      path,
      value: undefined, // Don't include raw value for containers
      type: 'object',
      children,
      isExpanded,
      childCount: keys.length,
      isArrayElement,
      arrayIndex,
    };
  }

  // Handle primitives
  return {
    key,
    path,
    value,
    type,
    isArrayElement,
    arrayIndex,
  };
}

/**
 * Gets all paths that should be expanded for a given depth.
 *
 * @param document - The document
 * @param depth - Depth to expand (0 = root only, 1 = first level, etc.)
 * @returns Set of paths to expand
 *
 * @example
 * ```typescript
 * const expandedPaths = getExpandedPathsToDepth(doc, 2);
 * // Set(['root', 'root.user', 'root.items'])
 * ```
 */
export function getExpandedPathsToDepth(
  document: Record<string, unknown>,
  depth: number
): Set<string> {
  const paths = new Set<string>(['root']);

  if (depth > 0) {
    collectPathsToDepth(document, 'root', 1, depth, paths);
  }

  return paths;
}

/**
 * Recursively collects paths up to a given depth.
 */
function collectPathsToDepth(
  value: unknown,
  path: string,
  currentDepth: number,
  maxDepth: number,
  paths: Set<string>
): void {
  if (currentDepth > maxDepth) return;

  const type = detectValueType(value);

  if (type === 'array') {
    paths.add(path);
    const arr = value as unknown[];
    arr.forEach((item, index) => {
      collectPathsToDepth(item, `${path}.${index}`, currentDepth + 1, maxDepth, paths);
    });
  } else if (type === 'object' && value !== null) {
    paths.add(path);
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      collectPathsToDepth(obj[key], `${path}.${key}`, currentDepth + 1, maxDepth, paths);
    }
  }
}

/**
 * Expands a path and all its parents.
 *
 * @param currentPaths - Current set of expanded paths
 * @param path - Path to expand
 * @returns New set with the path and all parents expanded
 */
export function expandPath(currentPaths: Set<string>, path: string): Set<string> {
  const newPaths = new Set(currentPaths);
  const segments = path.split('.');
  let currentPath = '';

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}.${segment}` : segment;
    newPaths.add(currentPath);
  }

  return newPaths;
}

/**
 * Collapses a path (removes it from expanded set).
 *
 * @param currentPaths - Current set of expanded paths
 * @param path - Path to collapse
 * @returns New set with the path removed
 */
export function collapsePath(currentPaths: Set<string>, path: string): Set<string> {
  const newPaths = new Set(currentPaths);
  newPaths.delete(path);
  return newPaths;
}

/**
 * Toggles a path's expanded state.
 *
 * @param currentPaths - Current set of expanded paths
 * @param path - Path to toggle
 * @returns New set with the path toggled
 */
export function togglePath(currentPaths: Set<string>, path: string): Set<string> {
  if (currentPaths.has(path)) {
    return collapsePath(currentPaths, path);
  }
  return expandPath(currentPaths, path);
}

/**
 * Expands all paths in a document.
 *
 * @param document - The document
 * @returns Set of all container paths
 */
export function expandAll(document: Record<string, unknown>): Set<string> {
  return getExpandedPathsToDepth(document, Infinity);
}

/**
 * Collapses all paths (returns set with just root).
 *
 * @returns Set with only root expanded
 */
export function collapseAll(): Set<string> {
  return new Set(['root']);
}

/**
 * Finds tree nodes matching a search term.
 *
 * @param node - Root node to search from
 * @param searchTerm - Term to search for (case-insensitive)
 * @returns Array of matching paths
 */
export function searchTree(node: TreeNode, searchTerm: string): string[] {
  const matches: string[] = [];
  const term = searchTerm.toLowerCase();

  searchTreeRecursive(node, term, matches);

  return matches;
}

/**
 * Recursive helper for tree search.
 */
function searchTreeRecursive(
  node: TreeNode,
  term: string,
  matches: string[]
): void {
  // Check if key matches
  if (node.key.toLowerCase().includes(term)) {
    matches.push(node.path);
  }

  // Check if value matches (for primitives)
  if (node.value !== undefined) {
    const valueStr = String(node.value).toLowerCase();
    if (valueStr.includes(term) && !matches.includes(node.path)) {
      matches.push(node.path);
    }
  }

  // Recursively search children
  if (node.children) {
    for (const child of node.children) {
      searchTreeRecursive(child, term, matches);
    }
  }
}

/**
 * Gets paths that should be expanded to show search results.
 *
 * @param matchingPaths - Array of paths that match the search
 * @returns Set of paths to expand
 */
export function getPathsToShowSearchResults(matchingPaths: string[]): Set<string> {
  const paths = new Set<string>();

  for (const matchPath of matchingPaths) {
    // Expand all parent paths
    const segments = matchPath.split('.');
    let currentPath = '';

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}.${segment}` : segment;
      paths.add(currentPath);
    }
  }

  return paths;
}
