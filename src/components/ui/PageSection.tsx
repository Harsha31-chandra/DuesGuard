/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PageSection — Consistent enterprise container section
 * Enforces 18–24px internal padding, subtle 1px border, and clean section header alignment.
 */

import React from 'react';

export interface PageSectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  noPadding?: boolean;
  footer?: React.ReactNode;
}

export const PageSection: React.FC<PageSectionProps> = ({
  title,
  subtitle,
  eyebrow,
  actions,
  noPadding = false,
  footer,
  children,
  className = '',
  ...props
}) => {
  return (
    <section
      className={`rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 shadow-2xs overflow-hidden ${className}`.trim()}
      {...props}
    >
      {(title || eyebrow || actions) && (
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            {eyebrow && (
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-zinc-400">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      <div className={noPadding ? '' : 'p-5'}>{children}</div>

      {footer && (
        <div className="px-5 py-3 border-t border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/60 dark:bg-zinc-900/50">
          {footer}
        </div>
      )}
    </section>
  );
};
