import { describe, it, expect } from 'vitest';
import { formatBytes, parseBytes, formatBytesPerSecond } from './formatBytes.js';

describe('formatBytes', () => {
  it('should format 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('should format bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1000)).toBe('1.00 KB');
    expect(formatBytes(1500)).toBe('1.50 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1000000)).toBe('1.00 MB');
  });

  it('should format gigabytes', () => {
    expect(formatBytes(1000000000)).toBe('1.00 GB');
  });

  it('should format terabytes', () => {
    expect(formatBytes(1000000000000)).toBe('1.00 TB');
  });

  it('should use binary units when specified', () => {
    expect(formatBytes(1024, { binary: true })).toBe('1.00 KiB');
    expect(formatBytes(1048576, { binary: true })).toBe('1.00 MiB');
  });

  it('should respect decimals option', () => {
    expect(formatBytes(1500, { decimals: 0 })).toBe('2 KB');
    expect(formatBytes(1500, { decimals: 3 })).toBe('1.500 KB');
  });

  it('should respect space option', () => {
    expect(formatBytes(1000, { space: false })).toBe('1.00KB');
  });

  it('should handle negative numbers', () => {
    expect(formatBytes(-100)).toBe('0 B');
  });

  it('should handle Infinity', () => {
    expect(formatBytes(Infinity)).toBe('0 B');
  });
});

describe('parseBytes', () => {
  it('should parse bytes', () => {
    expect(parseBytes('500 B')).toBe(500);
  });

  it('should parse kilobytes', () => {
    expect(parseBytes('1 KB')).toBe(1000);
    expect(parseBytes('1.5 KB')).toBe(1500);
  });

  it('should parse megabytes', () => {
    expect(parseBytes('1 MB')).toBe(1000000);
  });

  it('should parse binary units', () => {
    expect(parseBytes('1 KiB')).toBe(1024);
    expect(parseBytes('1 MiB')).toBe(1048576);
  });

  it('should handle missing space', () => {
    expect(parseBytes('1KB')).toBe(1000);
  });

  it('should return null for invalid input', () => {
    expect(parseBytes('invalid')).toBe(null);
    expect(parseBytes('KB')).toBe(null);
    expect(parseBytes('')).toBe(null);
  });

  it('should handle case insensitivity', () => {
    expect(parseBytes('1 kb')).toBe(1000);
    expect(parseBytes('1 KB')).toBe(1000);
  });
});

describe('formatBytesPerSecond', () => {
  it('should format transfer rate', () => {
    expect(formatBytesPerSecond(1000000)).toBe('1.00 MB/s');
    expect(formatBytesPerSecond(500)).toBe('500 B/s');
  });

  it('should pass options through', () => {
    expect(formatBytesPerSecond(1024, { binary: true })).toBe('1.00 KiB/s');
  });
});
