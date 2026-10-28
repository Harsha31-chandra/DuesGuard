/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StatusPill UI Component
 * Strictly reserved for authentic business status states (Overdue, Settled, etc.).
 * No static metadata pills.
 */

import React from 'react';

export type StatusVariant =
  | 'overdue'
  | 'settled'
  | 'pending'
  | 'needs_review'
  | 'partial'
  | 'disputed'
  | 'draft'
  | 'active'
  | 'default';

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusVariant;
  label?: string;
  withDot?: boolean;
}

const variantStyles: Record<StatusVariant, { container: string; dot: string }> = {
  overdue: {
    container: 'bg-red-50 text-danger border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60',
    dot: 'bg-danger dark:bg-red-400',
  },
  settled: {
    container: 'bg-emerald-50 text-ok border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60',
    dot: 'bg-ok dark:bg-emerald-400',
  },
  pending: {
    container: 'bg-amber-50 text-warn border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60',
    dot: 'bg-warn dark:bg-amber-400',
  },
  needs_review: {
    container: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/60',
    dot: 'bg-sky-600 dark:bg-sky-400',
  },
  partial: {
    container: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60',
    dot: 'bg-indigo-600 dark:bg-indigo-400',
  },
  disputed: {
    container: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/60',
    dot: 'bg-orange-600 dark:bg-orange-400',
  },
  draft: {
    container: 'bg-zinc-100 text-muted border-line dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700/60',
    dot: 'bg-muted dark:bg-zinc-400',
  },
  active: {
    container: 'bg-teal-50 text-accent border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/60',
    dot: 'bg-accent dark:bg-teal-400',
  },
  default: {
    container: 'bg-zinc-100 text-ink border-line dark:bg-zinc-800/60 dark:text-zinc-300 dark:border-zinc-700/60',
    dot: 'bg-ink dark:bg-zinc-300',
  },
};

export function resolveStatusVariant(statusStr?: string | null): StatusVariant {
  if (!statusStr) return 'default';
  const s = statusStr.toLowerCase().replace(/[-_\s]+/g, '');
  if (s.includes('overdue') || s.includes('breach') || s.includes('default') || s.includes('fail')) return 'overdue';
  if (s.includes('paid') || s.includes('settled') || s.includes('cleared') || s.includes('complete') || s.includes('approved')) return 'settled';
  if (s.includes('review') || s.includes('signoff') || s.includes('audit')) return 'needs_review';
  if (s.includes('partial')) return 'partial';
  if (s.includes('dispute') || s.includes('hold') || s.includes('objection')) return 'disputed';
  if (s.includes('pending') || s.includes('sent') || s.includes('awaiting')) return 'pending';
  if (s.includes('draft')) return 'draft';
  if (s.includes('active') || s.includes('live')) return 'active';
  return 'default';
}

export const StatusPill: React.FC<StatusPillProps> = ({
  variant = 'default',
  label,
  children,
  withDot = true,
  className = '',
  ...props
}) => {
  const styles = variantStyles[variant] || variantStyles.default;
  const content = label || children;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles.container} ${className}`.trim()}
      {...props}
    >
      {withDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{content}</span>
    </span>
  );
};
