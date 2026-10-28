/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PageHeader UI Component
 * Editorial Source Serif 4 title, contextual subtitle, and action slots.
 * Avoids centered templates, floating hero badges, and sparkle icons.
 */

import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string; onClick?: () => void }>;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  children,
  className = '',
}) => {
  return (
    <div className={`mb-6 pb-4 border-b border-line ${className}`.trim()}>
      {/* Optional Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1.5 text-xs text-muted">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <li key={idx} className="flex items-center gap-1.5">
                  {crumb.onClick || crumb.href ? (
                    <button
                      type="button"
                      onClick={crumb.onClick}
                      className="hover:text-ink transition-colors cursor-pointer"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className={isLast ? 'text-ink font-medium' : ''}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <span aria-hidden="true" className="text-line">/</span>}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Main Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-ink tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <div className="mt-1 text-sm text-muted max-w-3xl">
              {subtitle}
            </div>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 shrink-0 pt-1 sm:pt-0">
            {actions}
          </div>
        )}
      </div>

      {/* Extra contextual widgets (e.g. tabs or filter bars) */}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};
