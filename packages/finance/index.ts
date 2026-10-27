/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * @duesguard/finance — Pure TypeScript MSMED Act §§ 15 & 16 Calculation Engine
 * Uses decimal.js (precision: 30, ROUND_HALF_UP) for zero-float precision,
 * dynamic partial payment allocations, and 3x RBI Bank Rate monthly compounding rests.
 */

export {
  RBI_BANK_RATE_SCHEDULE,
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  calculateInvoiceTotalFromLineItems,
  allocatePaymentsToInvoices,
  calculateSection15Timeline,
  getRbiRateForDate,
  calculateMsmedCompoundInterest,
  validateGstin,
  verifyUdyamRegistrationAndDates,
  calculateCaseFinancialSummary,
} from '../../src/services/finance.ts';
