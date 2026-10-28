/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DataTable UI Component
 * Crisp, 1px border data table designed for dense financial records,
 * tabular figures, sortable columns, and zero-pill typography.
 */

import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { EmptyState } from './EmptyState.tsx';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  accessor?: (item: T) => React.ReactNode;
  sortValue?: (item: T) => string | number | boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  loading?: boolean;
  className?: string;
  footer?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching the selected view.',
  emptyAction,
  loading = false,
  className = '',
  footer,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (colKey: string, hasSort: boolean) => {
    if (!hasSort) return;
    if (sortKey === colKey) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(colKey);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.sortValue) return data;

    const sorter = col.sortValue;
    return [...data].sort((a, b) => {
      const valA = sorter(a);
      const valB = sorter(b);

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA ?? '').toLowerCase();
      const strB = String(valB ?? '').toLowerCase();
      return sortDir === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }, [data, sortKey, sortDir, columns]);

  return (
    <div className={`border border-line rounded-lg bg-surface overflow-hidden shadow-xs ${className}`.trim()}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-line bg-paper/60 text-muted font-medium">
              {columns.map((col) => {
                const canSort = Boolean(col.sortValue);
                const isSorted = sortKey === col.key;
                const alignClass =
                  col.align === 'right'
                    ? 'text-right justify-end'
                    : col.align === 'center'
                    ? 'text-center justify-center'
                    : 'text-left justify-start';

                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width }}
                    className={`px-3.5 py-2.5 font-medium select-none ${
                      col.hideOnMobile ? 'hidden md:table-cell' : ''
                    } ${col.className || ''}`}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key, canSort)}
                        className={`inline-flex items-center gap-1 hover:text-ink transition-colors cursor-pointer w-full ${alignClass}`}
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDir === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-accent" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-accent" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-muted/60" />
                        )}
                      </button>
                    ) : (
                      <div className={`flex items-center ${alignClass}`}>
                        {col.header}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-line/60">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              sortedData.map((item, idx) => {
                const key = keyExtractor(item, idx);
                const isInteractive = Boolean(onRowClick);

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(item)}
                    className={`transition-colors ${
                      isInteractive
                        ? 'hover:bg-paper/80 cursor-pointer'
                        : 'hover:bg-paper/40'
                    }`}
                  >
                    {columns.map((col) => {
                      const alignClass =
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left';

                      const content = col.accessor
                        ? col.accessor(item)
                        : (item as Record<string, unknown>)[col.key] !== undefined
                        ? String((item as Record<string, unknown>)[col.key])
                        : null;

                      return (
                        <td
                          key={col.key}
                          className={`px-3.5 py-2.5 text-ink ${alignClass} ${
                            col.hideOnMobile ? 'hidden md:table-cell' : ''
                          } ${col.className || ''}`}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {footer && (
        <div className="px-3.5 py-2 border-t border-line bg-paper/30 text-xs text-muted flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
}
