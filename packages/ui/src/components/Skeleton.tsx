/**
 * Skeleton Loading Components
 *
 * Reusable skeleton loaders for various UI patterns.
 * Uses the .skeleton CSS class defined in styles/index.css
 */

import type { FC } from 'react';
import clsx from 'clsx';

// ============================================
// Base Skeleton Component
// ============================================

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

export const Skeleton: FC<SkeletonProps> = ({
  className,
  width,
  height,
  rounded = 'md',
}) => {
  const roundedClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div
      className={clsx('skeleton', roundedClasses[rounded], className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
};

// ============================================
// Table Skeleton
// ============================================

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  showRowNumbers?: boolean;
  showHeader?: boolean;
  rowHeight?: number;
}

export const TableSkeleton: FC<TableSkeletonProps> = ({
  columns = 5,
  rows = 8,
  showRowNumbers = false,
  showHeader = true,
  rowHeight = 36,
}) => {
  const totalCols = showRowNumbers ? columns + 1 : columns;

  // Generate varied widths for more realistic appearance
  const getRandomWidth = (colIndex: number) => {
    const baseWidths = [40, 60, 80, 50, 70, 55, 65, 45, 75, 85];
    return `${baseWidths[colIndex % baseWidths.length]}%`;
  };

  return (
    <div className="overflow-hidden">
      {showHeader && (
        <div className="flex border-b border-vscode-border bg-vscode-bg-lighter">
          {showRowNumbers && (
            <div className="flex-shrink-0 w-10 px-2 py-2">
              <Skeleton height={16} width={16} />
            </div>
          )}
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={i}
              className="flex-1 px-3 py-2"
              style={{ minWidth: '80px' }}
            >
              <Skeleton height={16} width="70%" />
            </div>
          ))}
        </div>
      )}
      <div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className={clsx(
              'flex border-b border-vscode-border',
              rowIndex % 2 === 1 ? 'bg-vscode-bg/50' : ''
            )}
            style={{ height: rowHeight }}
          >
            {showRowNumbers && (
              <div className="flex-shrink-0 w-10 px-2 py-2 flex items-center">
                <Skeleton height={14} width={20} />
              </div>
            )}
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="flex-1 px-3 py-2 flex items-center"
                style={{ minWidth: '80px' }}
              >
                <Skeleton height={14} width={getRandomWidth(colIndex + rowIndex)} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// Tree/Sidebar Skeleton
// ============================================

interface TreeSkeletonProps {
  items?: number;
  depth?: number;
}

export const TreeSkeleton: FC<TreeSkeletonProps> = ({
  items = 5,
  depth = 0,
}) => {
  const paddingLeft = 12 + depth * 16;

  return (
    <div className="space-y-0.5">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center py-1.5 px-2"
          style={{ paddingLeft }}
        >
          {/* Chevron/Folder icon placeholder */}
          <Skeleton width={16} height={16} className="mr-2 flex-shrink-0" />
          {/* Text placeholder */}
          <Skeleton
            height={14}
            width={`${50 + Math.random() * 30}%`}
            className="flex-1"
          />
        </div>
      ))}
    </div>
  );
};

// ============================================
// List Item Skeleton
// ============================================

interface ListSkeletonProps {
  items?: number;
  showIcon?: boolean;
  showSecondaryText?: boolean;
  itemHeight?: number;
}

export const ListSkeleton: FC<ListSkeletonProps> = ({
  items = 5,
  showIcon = true,
  showSecondaryText = false,
  itemHeight = 40,
}) => {
  return (
    <div className="space-y-1">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center px-3 py-2 rounded"
          style={{ minHeight: itemHeight }}
        >
          {showIcon && (
            <Skeleton
              width={20}
              height={20}
              rounded="sm"
              className="mr-3 flex-shrink-0"
            />
          )}
          <div className="flex-1 space-y-1.5">
            <Skeleton height={14} width={`${60 + Math.random() * 30}%`} />
            {showSecondaryText && (
              <Skeleton height={10} width={`${40 + Math.random() * 20}%`} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// Card Skeleton
// ============================================

interface CardSkeletonProps {
  showHeader?: boolean;
  showFooter?: boolean;
  lines?: number;
}

export const CardSkeleton: FC<CardSkeletonProps> = ({
  showHeader = true,
  showFooter = false,
  lines = 3,
}) => {
  return (
    <div className="border border-vscode-border rounded-lg bg-vscode-bg-light p-4 space-y-3">
      {showHeader && (
        <div className="flex items-center gap-3">
          <Skeleton width={32} height={32} rounded="full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton height={14} width="50%" />
            <Skeleton height={10} width="30%" />
          </div>
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            height={12}
            width={i === lines - 1 ? '70%' : '100%'}
          />
        ))}
      </div>
      {showFooter && (
        <div className="flex gap-2 pt-2">
          <Skeleton height={24} width={60} rounded="sm" />
          <Skeleton height={24} width={60} rounded="sm" />
        </div>
      )}
    </div>
  );
};

// ============================================
// Document Preview Skeleton (for MongoDB/DocumentDB views)
// ============================================

interface DocumentSkeletonProps {
  items?: number;
}

export const DocumentSkeleton: FC<DocumentSkeletonProps> = ({
  items = 5,
}) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="border border-vscode-border rounded bg-vscode-bg-light p-3 space-y-2"
        >
          {/* Document ID header */}
          <div className="flex items-center gap-2">
            <Skeleton width={14} height={14} rounded="sm" />
            <Skeleton height={12} width="40%" />
          </div>
          {/* Document fields */}
          <div className="pl-4 space-y-1.5">
            {Array.from({ length: 2 + (i % 3) }).map((_, j) => (
              <div key={j} className="flex gap-2">
                <Skeleton height={10} width={60} />
                <Skeleton height={10} width={`${40 + Math.random() * 40}%`} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// Metadata Panel Skeleton
// ============================================

export const MetadataSkeleton: FC = () => {
  return (
    <div className="p-4 space-y-4">
      {/* Table info section */}
      <div className="space-y-2">
        <Skeleton height={16} width={100} />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton height={12} width="80%" />
          <Skeleton height={12} width="60%" />
          <Skeleton height={12} width="70%" />
          <Skeleton height={12} width="50%" />
        </div>
      </div>

      {/* Columns section */}
      <div className="space-y-2">
        <Skeleton height={16} width={80} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1">
            <Skeleton width={16} height={16} rounded="sm" />
            <Skeleton height={12} width={100} />
            <Skeleton height={10} width={60} />
          </div>
        ))}
      </div>

      {/* Indexes section */}
      <div className="space-y-2">
        <Skeleton height={16} width={70} />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 py-1">
            <Skeleton width={14} height={14} rounded="sm" />
            <Skeleton height={12} width={120} />
          </div>
        ))}
      </div>
    </div>
  );
};
