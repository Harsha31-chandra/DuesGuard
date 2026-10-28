/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Money UI Component & formatRupees Helper
 * Indian Comma System (₹1,00,000.00) with strict tabular numerals.
 */

import React from 'react';

export interface FormatRupeesOptions {
  showDecimals?: boolean;
  compact?: boolean;
  symbol?: string;
  showSign?: boolean;
}

/**
 * Format integer paise or rupees into standard Indian numbering format (₹1,00,000.00)
 */
export function formatRupees(
  input: string | number | null | undefined,
  options: FormatRupeesOptions = {}
): string {
  if (input === null || input === undefined || input === '') {
    return '₹0.00';
  }

  const {
    showDecimals = true,
    compact = false,
    symbol = '₹',
    showSign = false,
  } = options;

  let rawPaiseNum: number;
  if (typeof input === 'number') {
    rawPaiseNum = input;
  } else {
    const cleaned = String(input).replace(/[^\d.-]/g, '');
    rawPaiseNum = parseFloat(cleaned);
    if (isNaN(rawPaiseNum)) return '₹0.00';
  }

  const isNegative = rawPaiseNum < 0;
  const absPaise = Math.abs(rawPaiseNum);
  const rupees = absPaise / 100;

  if (compact) {
    let formattedCompact = '';
    if (rupees >= 10000000) {
      formattedCompact = `${(rupees / 10000000).toFixed(2)} Cr`;
    } else if (rupees >= 100000) {
      formattedCompact = `${(rupees / 100000).toFixed(2)} L`;
    } else if (rupees >= 1000) {
      formattedCompact = `${(rupees / 1000).toFixed(1)} K`;
    } else {
      formattedCompact = rupees.toFixed(0);
    }
    const signPrefix = isNegative ? '-' : showSign ? '+' : '';
    return `${signPrefix}${symbol}${formattedCompact}`;
  }

  const fixed = rupees.toFixed(showDecimals ? 2 : 0);
  const parts = fixed.split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1] ? `.${parts[1]}` : '';

  // Indian grouping: last 3 digits, then groups of 2
  let lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  const sign = isNegative ? '-' : showSign ? '+' : '';
  return `${sign}${symbol}${formattedInteger}${decimalPart}`;
}

export interface MoneyProps extends React.HTMLAttributes<HTMLSpanElement> {
  paise?: string | number | null;
  value?: string | number | null; // alias for paise
  showDecimals?: boolean;
  compact?: boolean;
  symbol?: string;
  showSign?: boolean;
  coloredSign?: boolean;
}

export const Money: React.FC<MoneyProps> = ({
  paise,
  value,
  showDecimals = true,
  compact = false,
  symbol = '₹',
  showSign = false,
  coloredSign = false,
  className = '',
  ...props
}) => {
  const target = paise !== undefined ? paise : value;
  const formatted = formatRupees(target, { showDecimals, compact, symbol, showSign });

  const num = typeof target === 'number' ? target : parseFloat(String(target || 0));
  const isPositive = num > 0;
  const isNegative = num < 0;

  const colorClass = coloredSign
    ? isNegative
      ? 'text-danger'
      : isPositive
      ? 'text-ok'
      : 'text-ink'
    : '';

  return (
    <span
      className={`tabular-nums font-mono tracking-tight ${colorClass} ${className}`.trim()}
      {...props}
    >
      {formatted}
    </span>
  );
};
