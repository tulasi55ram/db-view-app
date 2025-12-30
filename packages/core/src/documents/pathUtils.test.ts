import { describe, it, expect } from 'vitest';
import {
  parsePath,
  buildPath,
  getAtPath,
  hasPath,
  setAtPath,
  deleteAtPath,
  getParentPath,
  getPathKey,
  joinPath,
} from './pathUtils.js';

describe('parsePath', () => {
  it('should parse simple dot notation', () => {
    expect(parsePath('user.name')).toEqual(['user', 'name']);
  });

  it('should parse bracket notation', () => {
    expect(parsePath('items[0].value')).toEqual(['items', '0', 'value']);
  });

  it('should handle empty string', () => {
    expect(parsePath('')).toEqual([]);
  });

  it('should handle single segment', () => {
    expect(parsePath('name')).toEqual(['name']);
  });

  it('should handle mixed notation', () => {
    expect(parsePath('users[0].addresses[1].city')).toEqual([
      'users', '0', 'addresses', '1', 'city'
    ]);
  });
});

describe('buildPath', () => {
  it('should build dot notation path', () => {
    expect(buildPath(['user', 'name'])).toBe('user.name');
  });

  it('should build bracket notation for array indices', () => {
    expect(buildPath(['items', '0', 'value'], { arrayNotation: 'bracket' }))
      .toBe('items[0].value');
  });

  it('should handle empty array', () => {
    expect(buildPath([])).toBe('');
  });

  it('should handle single segment', () => {
    expect(buildPath(['name'])).toBe('name');
  });
});

describe('getAtPath', () => {
  const obj = {
    user: {
      name: 'John',
      addresses: [
        { city: 'NYC', zip: '10001' }
      ]
    }
  };

  it('should get nested value with dot notation', () => {
    expect(getAtPath(obj, 'user.name')).toBe('John');
  });

  it('should get array element', () => {
    expect(getAtPath(obj, 'user.addresses.0.city')).toBe('NYC');
  });

  it('should get array element with bracket notation', () => {
    expect(getAtPath(obj, 'user.addresses[0].city')).toBe('NYC');
  });

  it('should return undefined for missing path', () => {
    expect(getAtPath(obj, 'user.missing')).toBeUndefined();
  });

  it('should return undefined for path through non-object', () => {
    expect(getAtPath(obj, 'user.name.foo')).toBeUndefined();
  });

  it('should return root object for empty path', () => {
    expect(getAtPath(obj, '')).toBe(obj);
  });
});

describe('hasPath', () => {
  const obj = {
    user: { name: 'John' },
    nullValue: null
  };

  it('should return true for existing path', () => {
    expect(hasPath(obj, 'user.name')).toBe(true);
  });

  it('should return false for missing path', () => {
    expect(hasPath(obj, 'user.age')).toBe(false);
  });

  it('should return false for path through null', () => {
    expect(hasPath(obj, 'nullValue.foo')).toBe(false);
  });
});

describe('setAtPath', () => {
  it('should set value at existing path', () => {
    const obj = { user: { name: 'John' } };
    const result = setAtPath(obj, 'user.name', 'Jane');
    expect(result).toEqual({ user: { name: 'Jane' } });
    // Original unchanged
    expect(obj).toEqual({ user: { name: 'John' } });
  });

  it('should create intermediate objects', () => {
    const obj = { user: {} };
    const result = setAtPath(obj, 'user.address.city', 'NYC');
    expect(result).toEqual({ user: { address: { city: 'NYC' } } });
  });

  it('should create intermediate arrays', () => {
    const obj = {};
    const result = setAtPath(obj, 'items.0.name', 'First');
    expect(result).toEqual({ items: [{ name: 'First' }] });
  });

  it('should handle array modification', () => {
    const obj = { items: ['a', 'b', 'c'] };
    const result = setAtPath(obj, 'items.1', 'B');
    expect(result).toEqual({ items: ['a', 'B', 'c'] });
  });

  it('should return unchanged object for empty path', () => {
    const obj = { a: 1 };
    expect(setAtPath(obj, '', 'value')).toBe(obj);
  });
});

describe('deleteAtPath', () => {
  it('should delete value at path', () => {
    const obj = { user: { name: 'John', age: 30 } };
    const result = deleteAtPath(obj, 'user.age');
    expect(result).toEqual({ user: { name: 'John' } });
    // Original unchanged
    expect(obj).toEqual({ user: { name: 'John', age: 30 } });
  });

  it('should handle non-existent path gracefully', () => {
    const obj = { user: { name: 'John' } };
    const result = deleteAtPath(obj, 'user.missing.deep');
    expect(result).toEqual({ user: { name: 'John' } });
  });

  it('should delete array element', () => {
    const obj = { items: ['a', 'b', 'c'] };
    const result = deleteAtPath(obj, 'items.1');
    expect(result).toEqual({ items: ['a', 'c'] });
  });

  it('should return unchanged object for empty path', () => {
    const obj = { a: 1 };
    expect(deleteAtPath(obj, '')).toBe(obj);
  });
});

describe('getParentPath', () => {
  it('should return parent path', () => {
    expect(getParentPath('user.address.city')).toBe('user.address');
  });

  it('should return empty string for root level', () => {
    expect(getParentPath('user')).toBe('');
  });

  it('should return empty string for empty path', () => {
    expect(getParentPath('')).toBe('');
  });
});

describe('getPathKey', () => {
  it('should return last segment', () => {
    expect(getPathKey('user.address.city')).toBe('city');
  });

  it('should return the path for single segment', () => {
    expect(getPathKey('user')).toBe('user');
  });

  it('should return empty string for empty path', () => {
    expect(getPathKey('')).toBe('');
  });
});

describe('joinPath', () => {
  it('should join path parts', () => {
    expect(joinPath('user', 'address', 'city')).toBe('user.address.city');
  });

  it('should handle numeric parts', () => {
    expect(joinPath('items', 0, 'name')).toBe('items.0.name');
  });

  it('should filter empty parts', () => {
    expect(joinPath('user', '', 'name')).toBe('user.name');
  });
});
