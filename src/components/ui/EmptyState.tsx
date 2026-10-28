/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * EmptyState UI Component
 * Calm, contextual empty state that explains what belongs here and how to start.
 */

import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto ${className}`.trim()}
    >
      <div className="w-10 h-10 rounded-lg bg-paper flex items-center justify-center text-muted mb-3 border border-line">
        {icon || <Inbox className="w-5 h-5 text-muted" />}
      </div>

      <h3 className="text-sm font-semibold text-ink mb-1">{title}</h3>

      {description && (
        <p className="text-xs text-muted leading-relaxed mb-4">{description}</p>
      )}

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
