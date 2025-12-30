/**
 * Redis View Types
 *
 * Types for the Redis data view components
 */

import type { FC, SVGProps } from 'react';
import { Key, Hash, List, Circle, BarChart2, Activity, HelpCircle } from 'lucide-react';

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
  icon: FC<{ className?: string }>;
  color: string;
  bgColor: string;
  description: string;
}

export const TYPE_CONFIG: Record<RedisDataType, TypeDisplayConfig> = {
  string: {
    name: 'String',
    icon: Key,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/15',
    description: 'Simple key-value pair'
  },
  hash: {
    name: 'Hash',
    icon: Hash,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/15',
    description: 'Field-value pairs (like an object)'
  },
  list: {
    name: 'List',
    icon: List,
    color: 'text-green-500',
    bgColor: 'bg-green-500/15',
    description: 'Ordered collection of strings'
  },
  set: {
    name: 'Set',
    icon: Circle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/15',
    description: 'Unordered collection of unique strings'
  },
  zset: {
    name: 'Sorted Set',
    icon: BarChart2,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/15',
    description: 'Set ordered by score'
  },
  stream: {
    name: 'Stream',
    icon: Activity,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/15',
    description: 'Append-only log data structure'
  },
  none: {
    name: 'None',
    icon: HelpCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/15',
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

// Hash field
export interface HashField {
  field: string;
  value: string;
}

// List item
export interface ListItem {
  index: number;
  value: string;
}

// Set member
export interface SetMember {
  value: string;
}

// Sorted set member
export interface ZSetMember {
  value: string;
  score: number;
}

// Stream entry
export interface StreamEntry {
  id: string;
  fields: Record<string, unknown>;
}
