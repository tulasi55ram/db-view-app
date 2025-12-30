/**
 * TypeIndicator
 *
 * Visual indicator showing the type of a field value.
 * Used in the tree view to help users quickly identify data types.
 */

import type { FC } from 'react';
import clsx from 'clsx';
import type { FieldType } from './types';

interface TypeIndicatorProps {
  type: FieldType;
  className?: string;
}

/**
 * Color mapping for field types (VS Code compatible)
 */
const TYPE_COLORS: Record<FieldType, string> = {
  string: 'bg-green-500/20 text-green-400 border-green-500/30',
  number: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  boolean: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  null: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  undefined: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  array: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  object: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  date: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  objectId: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  binary: 'bg-red-500/20 text-red-400 border-red-500/30',
  unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

/**
 * Short labels for types
 */
const TYPE_LABELS: Record<FieldType, string> = {
  string: 'str',
  number: 'num',
  boolean: 'bool',
  null: 'null',
  undefined: 'undef',
  array: 'arr',
  object: 'obj',
  date: 'date',
  objectId: 'oid',
  binary: 'bin',
  unknown: '?',
};

export const TypeIndicator: FC<TypeIndicatorProps> = ({ type, className }) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium border',
        TYPE_COLORS[type],
        className
      )}
    >
      {TYPE_LABELS[type]}
    </span>
  );
};

export default TypeIndicator;
