/**
 * useDocumentOperations
 *
 * Hook for performing CRUD operations on documents.
 * Provides methods for updating, deleting, and inserting documents
 * with optimistic updates and error handling.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { getElectronAPI } from '@/electron';
import type { DocumentItem, DocumentDbType } from '../types';

export interface UseDocumentOperationsOptions {
  /** Connection key for the database */
  connectionKey: string;
  /** Schema/database name */
  schema: string;
  /** Table/collection name */
  table: string;
  /** Database type */
  dbType: DocumentDbType;
  /** Whether the connection is read-only */
  isReadOnly?: boolean;
  /** Callback when documents are updated */
  onDocumentsChange?: (documents: DocumentItem[]) => void;
  /** Callback after successful operations for refreshing data */
  onRefresh?: () => void;
}

export interface UseDocumentOperationsResult {
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Current error if any */
  error: string | null;
  /** Update a document field */
  updateField: (docId: string, path: string, value: unknown) => Promise<boolean>;
  /** Delete a field from a document */
  deleteField: (docId: string, path: string) => Promise<boolean>;
  /** Add a field to a document */
  addField: (docId: string, parentPath: string, key: string, value: unknown) => Promise<boolean>;
  /** Update entire document */
  updateDocument: (docId: string, newData: Record<string, unknown>) => Promise<boolean>;
  /** Delete a document */
  deleteDocument: (docId: string) => Promise<boolean>;
  /** Insert a new document */
  insertDocument: (data: Record<string, unknown>) => Promise<string | null>;
  /** Clear error */
  clearError: () => void;
}

/**
 * Validate array index is valid
 */
function validateArrayIndex(index: number, arr: unknown[], path: string): void {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid array index "${index}" in path "${path}"`);
  }
  if (index >= arr.length) {
    throw new Error(`Array index ${index} out of bounds (length: ${arr.length}) in path "${path}"`);
  }
}

/**
 * Check if a value is a plain object (not null, not an array, not a primitive)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Ensure value is a plain object, throw descriptive error if not
 */
function ensureObject(value: unknown, context: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    throw new Error(`Expected object at ${context}, but found ${type}`);
  }
  return value;
}

/**
 * Set a value at a path in an object (immutably)
 */
function setAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return obj;

  // Skip 'root' prefix if present
  if (parts[0] === 'root') {
    parts.shift();
  }

  if (parts.length === 0) return obj;

  const result = { ...obj };
  let current: Record<string, unknown> = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);

    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      const arr = current[key];

      if (!Array.isArray(arr)) {
        throw new Error(`Expected array at "${key}" in path "${path}"`);
      }

      validateArrayIndex(index, arr, path);
      const newArr = [...arr];
      // Validate that array element is an object before spreading
      const elementObj = ensureObject(newArr[index], `"${key}[${index}]" in path "${path}"`);
      newArr[index] = { ...elementObj };
      current[key] = newArr;
      current = newArr[index] as Record<string, unknown>;
    } else {
      if (current[part] === undefined || current[part] === null) {
        current[part] = {};
      }
      // Validate that current[part] is an object before spreading
      const partObj = ensureObject(current[part], `"${part}" in path "${path}"`);
      current[part] = { ...partObj };
      current = current[part] as Record<string, unknown>;
    }
  }

  const lastPart = parts[parts.length - 1];
  const arrayMatch = lastPart.match(/^(\w+)\[(\d+)\]$/);

  if (arrayMatch) {
    const [, key, indexStr] = arrayMatch;
    const index = parseInt(indexStr, 10);
    const arr = current[key];

    if (!Array.isArray(arr)) {
      throw new Error(`Expected array at "${key}" in path "${path}"`);
    }

    // For setting, allow index === arr.length to append
    if (index > arr.length) {
      throw new Error(`Array index ${index} out of bounds (length: ${arr.length}) in path "${path}"`);
    }

    const newArr = [...arr];
    newArr[index] = value;
    current[key] = newArr;
  } else {
    current[lastPart] = value;
  }

  return result;
}

/**
 * Delete a value at a path in an object (immutably)
 */
function deleteAtPath(
  obj: Record<string, unknown>,
  path: string
): Record<string, unknown> {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return obj;

  // Skip 'root' prefix if present
  if (parts[0] === 'root') {
    parts.shift();
  }

  if (parts.length === 0) return obj;

  const result = { ...obj };
  let current: Record<string, unknown> = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);

    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      const arr = current[key];

      if (!Array.isArray(arr)) {
        throw new Error(`Expected array at "${key}" in path "${path}"`);
      }

      validateArrayIndex(index, arr, path);
      const newArr = [...arr];
      // Validate that array element is an object before spreading
      const elementObj = ensureObject(newArr[index], `"${key}[${index}]" in path "${path}"`);
      newArr[index] = { ...elementObj };
      current[key] = newArr;
      current = newArr[index] as Record<string, unknown>;
    } else {
      if (current[part] === undefined || current[part] === null) {
        throw new Error(`Path "${part}" does not exist in document`);
      }
      // Validate that current[part] is an object before spreading
      const partObj = ensureObject(current[part], `"${part}" in path "${path}"`);
      current[part] = { ...partObj };
      current = current[part] as Record<string, unknown>;
    }
  }

  const lastPart = parts[parts.length - 1];
  const arrayMatch = lastPart.match(/^(\w+)\[(\d+)\]$/);

  if (arrayMatch) {
    const [, key, indexStr] = arrayMatch;
    const index = parseInt(indexStr, 10);
    const arr = current[key];

    if (!Array.isArray(arr)) {
      throw new Error(`Expected array at "${key}" in path "${path}"`);
    }

    validateArrayIndex(index, arr, path);
    const newArr = [...arr];
    newArr.splice(index, 1);
    current[key] = newArr;
  } else {
    delete current[lastPart];
  }

  return result;
}

/**
 * Get the ID field name based on database type
 */
function getIdFieldName(dbType: DocumentDbType): string {
  switch (dbType) {
    case 'mongodb':
      return '_id';
    case 'elasticsearch':
      return '_id';
    case 'cassandra':
      return 'id'; // Cassandra typically uses 'id' as primary key
    default:
      return '_id';
  }
}

export function useDocumentOperations({
  connectionKey,
  schema,
  table,
  dbType,
  isReadOnly = false,
  onRefresh,
}: UseDocumentOperationsOptions): UseDocumentOperationsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = getElectronAPI();

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Update a field in a document
  const updateField = useCallback(
    async (docId: string, path: string, value: unknown): Promise<boolean> => {
      if (isReadOnly) {
        toast.error('Cannot edit in read-only mode');
        return false;
      }

      if (!api) {
        setError('API not available');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Extract the field name from the path (remove 'root.' prefix)
        const fieldPath = path.startsWith('root.') ? path.slice(5) : path;

        // For document databases, we update the entire document
        // First, we need to load the current document
        const result = await api.loadTableRows({
          connectionKey,
          schema,
          table,
          limit: 1,
          offset: 0,
          filters: [{ id: 'docId', columnName: getIdFieldName(dbType), operator: 'equals' as const, value: docId }],
        });

        // Validate API response structure
        if (!result || !Array.isArray(result.rows)) {
          throw new Error(`Invalid API response while updating field "${fieldPath}"`);
        }

        if (result.rows.length === 0) {
          throw new Error(`Document not found (id: ${docId})`);
        }

        const currentDoc = result.rows[0] as Record<string, unknown>;
        const updatedDoc = setAtPath(currentDoc, fieldPath, value);

        // Use updateCell for the field update
        await api.updateCell({
          connectionKey,
          schema,
          table,
          primaryKey: { [getIdFieldName(dbType)]: docId },
          column: fieldPath.split('.')[0], // Top-level field
          value: updatedDoc[fieldPath.split('.')[0]],
        });

        toast.success('Field updated');
        onRefresh?.();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update field';
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [api, connectionKey, schema, table, dbType, isReadOnly, onRefresh]
  );

  // Delete a field from a document
  const deleteField = useCallback(
    async (docId: string, path: string): Promise<boolean> => {
      if (isReadOnly) {
        toast.error('Cannot delete in read-only mode');
        return false;
      }

      if (!api) {
        setError('API not available');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const fieldPath = path.startsWith('root.') ? path.slice(5) : path;

        // Load current document
        const result = await api.loadTableRows({
          connectionKey,
          schema,
          table,
          limit: 1,
          offset: 0,
          filters: [{ id: 'docId', columnName: getIdFieldName(dbType), operator: 'equals' as const, value: docId }],
        });

        // Validate API response structure
        if (!result || !Array.isArray(result.rows)) {
          throw new Error(`Invalid API response while deleting field "${fieldPath}"`);
        }

        if (result.rows.length === 0) {
          throw new Error(`Document not found (id: ${docId})`);
        }

        const currentDoc = result.rows[0] as Record<string, unknown>;
        const updatedDoc = deleteAtPath(currentDoc, fieldPath);

        // Update the document
        const topLevelField = fieldPath.split('.')[0];
        await api.updateCell({
          connectionKey,
          schema,
          table,
          primaryKey: { [getIdFieldName(dbType)]: docId },
          column: topLevelField,
          value: updatedDoc[topLevelField],
        });

        toast.success('Field deleted');
        onRefresh?.();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete field';
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [api, connectionKey, schema, table, dbType, isReadOnly, onRefresh]
  );

  // Add a field to a document
  const addField = useCallback(
    async (docId: string, parentPath: string, key: string, value: unknown): Promise<boolean> => {
      if (isReadOnly) {
        toast.error('Cannot add in read-only mode');
        return false;
      }

      if (!api) {
        setError('API not available');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Build the full path
        let fullPath = parentPath;
        if (fullPath === 'root' || fullPath === '') {
          fullPath = key;
        } else {
          fullPath = parentPath.startsWith('root.')
            ? `${parentPath.slice(5)}.${key}`
            : `${parentPath}.${key}`;
        }

        // Load current document
        const result = await api.loadTableRows({
          connectionKey,
          schema,
          table,
          limit: 1,
          offset: 0,
          filters: [{ id: 'docId', columnName: getIdFieldName(dbType), operator: 'equals' as const, value: docId }],
        });

        // Validate API response structure
        if (!result || !Array.isArray(result.rows)) {
          throw new Error(`Invalid API response while adding field "${fullPath}"`);
        }

        if (result.rows.length === 0) {
          throw new Error(`Document not found (id: ${docId})`);
        }

        const currentDoc = result.rows[0] as Record<string, unknown>;
        const updatedDoc = setAtPath(currentDoc, fullPath, value);

        // Update the document
        const topLevelField = fullPath.split('.')[0];
        await api.updateCell({
          connectionKey,
          schema,
          table,
          primaryKey: { [getIdFieldName(dbType)]: docId },
          column: topLevelField,
          value: updatedDoc[topLevelField],
        });

        toast.success('Field added');
        onRefresh?.();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add field';
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [api, connectionKey, schema, table, dbType, isReadOnly, onRefresh]
  );

  // Update entire document
  const updateDocument = useCallback(
    async (docId: string, newData: Record<string, unknown>): Promise<boolean> => {
      if (isReadOnly) {
        toast.error('Cannot update in read-only mode');
        return false;
      }

      if (!api) {
        setError('API not available');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Update each top-level field
        const idField = getIdFieldName(dbType);
        for (const [column, value] of Object.entries(newData)) {
          if (column === idField) continue; // Skip the ID field

          await api.updateCell({
            connectionKey,
            schema,
            table,
            primaryKey: { [idField]: docId },
            column,
            value,
          });
        }

        toast.success('Document updated');
        onRefresh?.();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update document';
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [api, connectionKey, schema, table, dbType, isReadOnly, onRefresh]
  );

  // Delete a document
  const deleteDocument = useCallback(
    async (docId: string): Promise<boolean> => {
      if (isReadOnly) {
        toast.error('Cannot delete in read-only mode');
        return false;
      }

      if (!api) {
        setError('API not available');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const idField = getIdFieldName(dbType);
        await api.deleteRows({
          connectionKey,
          schema,
          table,
          primaryKeys: [{ [idField]: docId }],
        });

        toast.success('Document deleted');
        onRefresh?.();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete document';
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [api, connectionKey, schema, table, dbType, isReadOnly, onRefresh]
  );

  // Insert a new document
  const insertDocument = useCallback(
    async (data: Record<string, unknown>): Promise<string | null> => {
      if (isReadOnly) {
        toast.error('Cannot insert in read-only mode');
        return null;
      }

      if (!api) {
        setError('API not available');
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await api.insertRow({
          connectionKey,
          schema,
          table,
          values: data,
        });

        const idField = getIdFieldName(dbType);
        const newId = result[idField] as string;

        toast.success('Document inserted');
        onRefresh?.();
        return newId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to insert document';
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [api, connectionKey, schema, table, dbType, isReadOnly, onRefresh]
  );

  return {
    isLoading,
    error,
    updateField,
    deleteField,
    addField,
    updateDocument,
    deleteDocument,
    insertDocument,
    clearError,
  };
}

export default useDocumentOperations;
