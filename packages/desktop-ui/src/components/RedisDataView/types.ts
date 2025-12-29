// Redis data types
export type RedisDataType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream' | 'none';

// Key info with metadata
export interface RedisKeyInfo {
  key: string;
  type: RedisDataType;
  ttl: number; // -1 = no expiry, -2 = key doesn't exist
  memoryUsage?: number; // bytes
  encoding?: string;
  length?: number; // element count for collections
}

// Type display configuration
export interface TypeDisplayConfig {
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const TYPE_CONFIG: Record<RedisDataType, TypeDisplayConfig> = {
  string: {
    name: 'String',
    icon: 'Type',
    color: 'text-blue-500',
    description: 'Simple key-value pair'
  },
  hash: {
    name: 'Hash',
    icon: 'Hash',
    color: 'text-purple-500',
    description: 'Field-value pairs (like an object)'
  },
  list: {
    name: 'List',
    icon: 'List',
    color: 'text-green-500',
    description: 'Ordered collection of strings'
  },
  set: {
    name: 'Set',
    icon: 'Circle',
    color: 'text-orange-500',
    description: 'Unordered collection of unique strings'
  },
  zset: {
    name: 'Sorted Set',
    icon: 'BarChart2',
    color: 'text-pink-500',
    description: 'Set ordered by score'
  },
  stream: {
    name: 'Stream',
    icon: 'Activity',
    color: 'text-cyan-500',
    description: 'Append-only log data structure'
  },
  none: {
    name: 'None',
    icon: 'HelpCircle',
    color: 'text-gray-500',
    description: 'Key does not exist'
  },
};

// Value format types
export type ValueFormat = 'auto' | 'json' | 'text' | 'hex' | 'binary';

// Parsed value with detected format
export interface ParsedValue {
  raw: string;
  formatted: string;
  format: ValueFormat;
  isJson: boolean;
  jsonParsed?: unknown;
}
