/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StatusBadge — Restrained enterprise status indicator
 * Uses controlled red for overdue/risk, subtle green for settled/verified,
 * muted amber for pending review, and neutral slate for informational states.
 */

import React from 'react';

export type BadgeStatus =
  | 'overdue'
  | 'settled'
  | 'pending'
  | 'review'
  | 'verified'
  | 'neutral';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
  label?: React.ReactNode;
  showDot?: boolean;
}

const STATUS_STYLES: Record<BadgeStatus, { wrapper: string; dot: string }> = {
  overdue: {
    wrapper:
      'bg-red-50 text-red-700 border-red-200/80 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60',
    dot: 'bg-red-600 dark:bg-red-400',
  },
  settled: {
    wrapper:
      'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
  },
  verified: {
    wrapper:
      'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
  },
  pending: {
    wrapper:
      'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
    dot: 'bg-amber-600 dark:bg-amber-400',
  },
  review: {
    wrapper:
      'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
    dot: 'bg-amber-600 dark:bg-amber-400',
  },
  neutral: {
    wrapper:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    dot: 'bg-slate-500 dark:bg-zinc-400',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'neutral',
  label,
  children,
  showDot = true,
  className = '',
  ...props
}) => {
  const style = STATUS_STYLES[status] || STATUS_STYLES.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${style.wrapper} ${className}`.trim()}
      {...props}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} aria-hidden="true" />
      )}
      <span>{label ?? children}</span>
    </span>
  );
};
