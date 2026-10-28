/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LoadingState — Clean, non-intrusive loading indicator for financial modules
 */

import React from 'react';
import { Skeleton, TableSkeleton } from './Skeleton.tsx';

export interface LoadingStateProps {
  message?: string;
  rows?: number;
  variant?: 'spinner' | 'skeleton';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading workspace records...',
  rows = 4,
  variant = 'skeleton',
}) => {
  if (variant === 'spinner') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-zinc-400">
        <div className="w-7 h-7 border-2 border-slate-300 dark:border-zinc-700 border-t-slate-800 dark:border-t-zinc-200 rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">{message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2" aria-busy="true" aria-label={message}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
      </div>
      <TableSkeleton rows={rows} cols={5} />
    </div>
  );
};
