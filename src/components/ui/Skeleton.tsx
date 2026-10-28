/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Skeleton UI Component
 * Content-shaped placeholder loaders with calm low-contrast shimmer.
 */

import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'text' | 'rect' | 'circle' | 'stat';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  style,
  ...props
}) => {
  const variantClass =
    variant === 'circle'
      ? 'rounded-full'
      : variant === 'stat'
      ? 'rounded-lg h-16'
      : variant === 'rect'
      ? 'rounded-md'
      : 'rounded h-3.5';

  return (
    <div
      className={`animate-pulse bg-line/60 dark:bg-line/40 ${variantClass} ${className}`.trim()}
      style={{
        width,
        height,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => {
  return (
    <div className="w-full border border-line rounded-lg overflow-hidden bg-surface">
      <div className="border-b border-line p-3 bg-paper/50 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-line/40 p-1">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-3 flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
