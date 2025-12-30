import { describe, it, expect } from 'vitest';
import {
  getDocumentIdField,
  getDocumentIdFields,
  getDocumentId,
  getCompositeDocumentId,
  getPrimaryKeyObject,
} from './getDocumentId.js';
import type { ColumnMetadata } from '@dbview/types';

describe('getDocumentIdField', () => {
  it('should return _id for MongoDB without metadata', () => {
    expect(getDocumentIdField(undefined, 'mongodb')).toBe('_id');
  });

  it('should return _id for Elasticsearch without metadata', () => {
    expect(getDocumentIdField(undefined, 'elasticsearch')).toBe('_id');
  });

  it('should return id for Cassandra without metadata', () => {
    expect(getDocumentIdField(undefined, 'cassandra')).toBe('id');
  });

  it('should use primary key from metadata', () => {
    const columns: ColumnMetadata[] = [
      { name: 'user_id', dataType: 'uuid', isPrimaryKey: true },
      { name: 'name', dataType: 'text' },
    ];
    expect(getDocumentIdField(columns, 'cassandra')).toBe('user_id');
  });

  it('should fall back to convention if no primary key in metadata', () => {
    const columns: ColumnMetadata[] = [
      { name: '_id', dataType: 'ObjectId' },
      { name: 'name', dataType: 'string' },
    ];
    expect(getDocumentIdField(columns, 'mongodb')).toBe('_id');
  });

  it('should return first convention if column not found', () => {
    const columns: ColumnMetadata[] = [
      { name: 'name', dataType: 'string' },
    ];
    expect(getDocumentIdField(columns, 'mongodb')).toBe('_id');
  });
});

describe('getDocumentIdFields', () => {
  it('should return single field for non-composite key', () => {
    const result = getDocumentIdFields(undefined, 'mongodb');
    expect(result.primaryField).toBe('_id');
    expect(result.allFields).toEqual(['_id']);
    expect(result.isComposite).toBe(false);
  });

  it('should return multiple fields for composite key', () => {
    const columns: ColumnMetadata[] = [
      { name: 'user_id', dataType: 'uuid', isPrimaryKey: true },
      { name: 'timestamp', dataType: 'timestamp', isPrimaryKey: true },
      { name: 'data', dataType: 'text' },
    ];
    const result = getDocumentIdFields(columns, 'cassandra');
    expect(result.primaryField).toBe('user_id');
    expect(result.allFields).toEqual(['user_id', 'timestamp']);
    expect(result.isComposite).toBe(true);
  });
});

describe('getDocumentId', () => {
  it('should extract string ID', () => {
    const doc = { _id: '507f1f77bcf86cd799439011', name: 'John' };
    expect(getDocumentId(doc, undefined, 'mongodb')).toBe('507f1f77bcf86cd799439011');
  });

  it('should handle $oid format', () => {
    const doc = { _id: { $oid: '507f1f77bcf86cd799439011' }, name: 'John' };
    expect(getDocumentId(doc, undefined, 'mongodb')).toBe('507f1f77bcf86cd799439011');
  });

  it('should return empty string for missing ID', () => {
    const doc = { name: 'John' };
    expect(getDocumentId(doc, undefined, 'mongodb')).toBe('');
  });

  it('should convert numeric ID to string', () => {
    const doc = { id: 12345, name: 'John' };
    expect(getDocumentId(doc, undefined, 'cassandra')).toBe('12345');
  });

  it('should handle null ID', () => {
    const doc = { _id: null, name: 'John' };
    expect(getDocumentId(doc, undefined, 'mongodb')).toBe('');
  });
});

describe('getCompositeDocumentId', () => {
  it('should return simple ID for non-composite key', () => {
    const doc = { _id: 'abc123', name: 'John' };
    expect(getCompositeDocumentId(doc, undefined, 'mongodb')).toBe('abc123');
  });

  it('should join multiple fields for composite key', () => {
    const columns: ColumnMetadata[] = [
      { name: 'user_id', dataType: 'uuid', isPrimaryKey: true },
      { name: 'timestamp', dataType: 'timestamp', isPrimaryKey: true },
    ];
    const doc = { user_id: '123', timestamp: '2024-01-01', data: 'test' };
    expect(getCompositeDocumentId(doc, columns, 'cassandra')).toBe('123:2024-01-01');
  });

  it('should use custom separator', () => {
    const columns: ColumnMetadata[] = [
      { name: 'a', dataType: 'text', isPrimaryKey: true },
      { name: 'b', dataType: 'text', isPrimaryKey: true },
    ];
    const doc = { a: '1', b: '2' };
    expect(getCompositeDocumentId(doc, columns, 'cassandra', '-')).toBe('1-2');
  });
});

describe('getPrimaryKeyObject', () => {
  it('should extract single primary key', () => {
    const doc = { _id: 'abc123', name: 'John', age: 30 };
    expect(getPrimaryKeyObject(doc, undefined, 'mongodb')).toEqual({ _id: 'abc123' });
  });

  it('should extract composite primary key', () => {
    const columns: ColumnMetadata[] = [
      { name: 'user_id', dataType: 'uuid', isPrimaryKey: true },
      { name: 'timestamp', dataType: 'timestamp', isPrimaryKey: true },
    ];
    const doc = { user_id: '123', timestamp: '2024-01-01', data: 'test' };
    expect(getPrimaryKeyObject(doc, columns, 'cassandra')).toEqual({
      user_id: '123',
      timestamp: '2024-01-01',
    });
  });
});
