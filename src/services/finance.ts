/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Decimal from 'decimal.js';
import type {
  InvoiceRecord,
  LineItem,
  MonthlyRestPeriod,
  MsmedCalculationResult,
  PaymentRecord,
  RbiBankRateEntry,
  UdyamVerificationResult,
  GstinVerificationResult,
} from '../types/index.ts';

// Configure Decimal precision for financial calculations
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

/**
 * Official RBI Bank Rate Schedule for MSMED Section 16 Adjudication
 * Statutory rate is strictly 3x RBI Bank Rate with monthly compounding rests.
 */
export const RBI_BANK_RATE_SCHEDULE: RbiBankRateEntry[] = [
  {
    effectiveDate: '2023-02-08',
    bankRatePercent: '6.75',
    statutoryRatePercent: '20.25',
    sourceReference: 'RBI Monetary Policy Statement / Notification RBI/2022-2023/178',
    verificationTimestamp: '2023-02-08T10:00:00Z',
  },
  {
    effectiveDate: '2022-12-07',
    bankRatePercent: '6.50',
    statutoryRatePercent: '19.50',
    sourceReference: 'RBI Monetary Policy Resolution Dec 2022',
    verificationTimestamp: '2022-12-07T10:00:00Z',
  },
  {
    effectiveDate: '2022-09-30',
    bankRatePercent: '6.15',
    statutoryRatePercent: '18.45',
    sourceReference: 'RBI Monetary Policy Resolution Sep 2022',
    verificationTimestamp: '2022-09-30T10:00:00Z',
  },
  {
    effectiveDate: '2022-08-05',
    bankRatePercent: '5.65',
    statutoryRatePercent: '16.95',
    sourceReference: 'RBI Monetary Policy Resolution Aug 2022',
    verificationTimestamp: '2022-08-05T10:00:00Z',
  },
  {
    effectiveDate: '2022-06-08',
    bankRatePercent: '5.15',
    statutoryRatePercent: '15.45',
    sourceReference: 'RBI Monetary Policy Resolution Jun 2022',
    verificationTimestamp: '2022-06-08T10:00:00Z',
  },
  {
    effectiveDate: '2022-05-04',
    bankRatePercent: '4.65',
    statutoryRatePercent: '13.95',
    sourceReference: 'RBI Off-cycle MPC Resolution May 2022',
    verificationTimestamp: '2022-05-04T10:00:00Z',
  },
  {
    effectiveDate: '2020-05-22',
    bankRatePercent: '4.25',
    statutoryRatePercent: '12.75',
    sourceReference: 'RBI Statement on Developmental and Regulatory Policies',
    verificationTimestamp: '2020-05-22T10:00:00Z',
  },
];

/**
 * Convert Rupees string or number to Paise string
 */
export function rupeesToPaise(rupees: string | number): string {
  const d = new Decimal(rupees || 0);
  return d.times(100).round().toFixed(0);
}

/**
 * Convert Paise string or number to Rupees formatted string
 */
export function paiseToRupees(paise: string | number): string {
  const d = new Decimal(paise || 0);
  return d.dividedBy(100).toFixed(2);
}

/**
 * Format currency with Indian Comma System (e.g. ₹1,00,000.00)
 */
export function formatINR(paise: string | number): string {
  const rupees = paiseToRupees(paise);
  const parts = rupees.split('.');
  let integerPart = parts[0];
  const decimalPart = parts.length > 1 ? '.' + parts[1] : '.00';
  const isNegative = integerPart.startsWith('-');
  if (isNegative) integerPart = integerPart.substring(1);

  // Indian numbering: last 3 digits, then groups of 2
  let lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  return (isNegative ? '-Rs. ' : 'Rs. ') + formatted + decimalPart;
}

/**
 * Calculate invoice total deterministically from line items
 */
export function calculateInvoiceTotalFromLineItems(lineItems: LineItem[]): {
  subtotalPaise: string;
  totalTaxPaise: string;
  grandTotalPaise: string;
} {
  let subtotal = new Decimal(0);
  let totalTax = new Decimal(0);

  for (const item of lineItems) {
    const qty = new Decimal(item.quantity || 0);
    const unitPrice = new Decimal(item.unitPricePaise || 0);
    const lineBase = qty.times(unitPrice);
    subtotal = subtotal.plus(lineBase);

    if (item.taxAmountPaise) {
      totalTax = totalTax.plus(new Decimal(item.taxAmountPaise));
    } else if (item.taxRatePercent) {
      const taxRate = new Decimal(item.taxRatePercent).dividedBy(100);
      const tax = lineBase.times(taxRate).round();
      totalTax = totalTax.plus(tax);
    }
  }

  const grandTotal = subtotal.plus(totalTax);

  return {
    subtotalPaise: subtotal.toFixed(0),
    totalTaxPaise: totalTax.toFixed(0),
    grandTotalPaise: grandTotal.toFixed(0),
  };
}

/**
 * Calculate outstanding principal and payment allocations
 */
export function allocatePaymentsToInvoices(
  invoices: InvoiceRecord[],
  payments: PaymentRecord[]
): {
  invoicesWithBalances: InvoiceRecord[];
  totalInvoicedPaise: string;
  totalPaidPaise: string;
  totalOutstandingPaise: string;
  allocations: Array<{ paymentId: string; invoiceId: string; amountPaise: string; paymentDate: string }>;
} {
  let totalInvoiced = new Decimal(0);
  let totalPaid = new Decimal(0);
  const allocations: Array<{ paymentId: string; invoiceId: string; amountPaise: string; paymentDate: string }> = [];

  // Sort invoices by date ascending (FIFO allocation)
  const sortedInvoices = [...invoices].sort(
    (a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime()
  );

  // Deep clone to track balances while preserving original status (e.g. overdue / disputed)
  const updatedInvoices = sortedInvoices.map((inv) => {
    const total = new Decimal(inv.totalAmountPaise || 0);
    totalInvoiced = totalInvoiced.plus(total);
    return {
      ...inv,
      paidAmountPaise: '0',
      outstandingAmountPaise: total.toFixed(0),
      status: (inv.status || 'pending') as InvoiceRecord['status'],
    };
  });

  // Sort payments by date ascending
  const sortedPayments = [...payments].sort(
    (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
  );

  for (const payment of sortedPayments) {
    let unallocatedPayment = new Decimal(payment.amountPaise || 0);
    totalPaid = totalPaid.plus(unallocatedPayment);

    // If payment points to specific invoice
    if (payment.invoiceId) {
      const target = updatedInvoices.find((i) => i.id === payment.invoiceId || i.invoiceNumber === payment.invoiceId);
      if (target) {
        const outstanding = new Decimal(target.outstandingAmountPaise);
        const toPay = Decimal.min(unallocatedPayment, outstanding);
        if (toPay.greaterThan(0)) {
          target.paidAmountPaise = new Decimal(target.paidAmountPaise).plus(toPay).toFixed(0);
          target.outstandingAmountPaise = outstanding.minus(toPay).toFixed(0);
          unallocatedPayment = unallocatedPayment.minus(toPay);
          allocations.push({
            paymentId: payment.id,
            invoiceId: target.id,
            amountPaise: toPay.toFixed(0),
            paymentDate: payment.paymentDate,
          });
        }
      }
    }

    // Allocate remainder FIFO across oldest unpaid invoices
    if (unallocatedPayment.greaterThan(0)) {
      for (const inv of updatedInvoices) {
        const outstanding = new Decimal(inv.outstandingAmountPaise);
        if (outstanding.greaterThan(0)) {
          const toPay = Decimal.min(unallocatedPayment, outstanding);
          inv.paidAmountPaise = new Decimal(inv.paidAmountPaise).plus(toPay).toFixed(0);
          inv.outstandingAmountPaise = outstanding.minus(toPay).toFixed(0);
          unallocatedPayment = unallocatedPayment.minus(toPay);
          allocations.push({
            paymentId: payment.id,
            invoiceId: inv.id,
            amountPaise: toPay.toFixed(0),
            paymentDate: payment.paymentDate,
          });
          if (unallocatedPayment.isZero()) break;
        }
      }
    }
  }

  // Update status based on balances (preserve overdue/disputed if still unpaid)
  for (const inv of updatedInvoices) {
    const out = new Decimal(inv.outstandingAmountPaise);
    if (out.isZero()) {
      inv.status = 'paid';
    } else if (inv.status === 'paid') {
      inv.status = 'overdue';
    }
  }

  const totalOutstanding = Decimal.max(0, totalInvoiced.minus(totalPaid));

  return {
    invoicesWithBalances: updatedInvoices,
    totalInvoicedPaise: totalInvoiced.toFixed(0),
    totalPaidPaise: totalPaid.toFixed(0),
    totalOutstandingPaise: totalOutstanding.toFixed(0),
    allocations,
  };
}

/**
 * Date arithmetic helper (add days to ISO date string)
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Difference in full days between two ISO dates
 */
export function daysBetween(startStr: string, endStr: string): number {
  const s = new Date(startStr + 'T00:00:00Z').getTime();
  const e = new Date(endStr + 'T00:00:00Z').getTime();
  const diffMs = e - s;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * MSMED Section 15 Compliance Timeline Calculation:
 * - Where there is an agreement in writing, payment date cannot exceed 45 days from day of acceptance.
 * - Where there is no agreement, payment must be on or before the appointed day (15 days from day of acceptance/deemed acceptance).
 * - Objection: Buyer objection in writing within 15 days of delivery stops deemed acceptance until resolved.
 */
export function calculateSection15Timeline(params: {
  deliveryDate: string; // Day of delivery
  contractualDays?: number; // Agreed credit days in writing (e.g. 30, 45, 60)
  objectionDate?: string;
  objectionResolutionDate?: string;
}): {
  acceptanceDate: string;
  appointedDay: string;
  statutoryDeadline: string;
  interestStartDate: string;
  isObjectionValid: boolean;
  warnings: string[];
  assumptions: string[];
} {
  const warnings: string[] = [];
  const assumptions: string[] = [];
  let isObjectionValid = false;
  let acceptanceDate = params.deliveryDate;

  // Evaluate objection
  if (params.objectionDate) {
    const daysToObjection = daysBetween(params.deliveryDate, params.objectionDate);
    if (daysToObjection <= 15 && daysToObjection >= 0) {
      isObjectionValid = true;
      if (params.objectionResolutionDate) {
        acceptanceDate = params.objectionResolutionDate;
        assumptions.push(
          `Timely buyer objection on ${params.objectionDate} (within statutory 15 days). Acceptance date established on resolution date: ${params.objectionResolutionDate}.`
        );
      } else {
        warnings.push(
          `Buyer objection recorded on ${params.objectionDate} within 15-day window without documented resolution date. Requires human reviewer inspection.`
        );
      }
    } else if (daysToObjection > 15) {
      warnings.push(
        `Buyer objection dated ${params.objectionDate} occurred ${daysToObjection} days post-delivery (> 15 days). Deemed acceptance already took effect 15 days after delivery.`
      );
    }
  }

  // Appointed Day is day immediately following the expiry of 15 days from acceptance date
  const appointedDay = addDaysToDate(acceptanceDate, 16); // day 16 (15 days + 1)

  let statutoryDeadline: string;
  let interestStartDate: string;

  if (params.contractualDays && params.contractualDays > 0) {
    if (params.contractualDays > 45) {
      warnings.push(
        `Contractual credit agreement of ${params.contractualDays} days exceeds MSMED Act § 15 statutory ceiling of 45 days. Capped strictly to 45 days by operation of law.`
      );
      statutoryDeadline = addDaysToDate(acceptanceDate, 45);
    } else {
      assumptions.push(
        `Written contractual credit terms of ${params.contractualDays} days applied from acceptance date pursuant to § 15.`
      );
      statutoryDeadline = addDaysToDate(acceptanceDate, params.contractualDays);
    }
    // Interest starts day immediately following the statutory deadline
    interestStartDate = addDaysToDate(statutoryDeadline, 1);
  } else {
    // No written agreement -> statutory deadline is appointed day
    assumptions.push(
      'No written credit agreement documented. Statutory appointed day (15 days from deemed acceptance) applies pursuant to § 15.'
    );
    statutoryDeadline = addDaysToDate(acceptanceDate, 15);
    interestStartDate = appointedDay;
  }

  return {
    acceptanceDate,
    appointedDay,
    statutoryDeadline,
    interestStartDate,
    isObjectionValid,
    warnings,
    assumptions,
  };
}

/**
 * Get applicable RBI Bank Rate for any given date
 */
export function getRbiRateForDate(dateStr: string): RbiBankRateEntry {
  const targetDate = new Date(dateStr + 'T00:00:00Z').getTime();

  for (const entry of RBI_BANK_RATE_SCHEDULE) {
    const entryDate = new Date(entry.effectiveDate + 'T00:00:00Z').getTime();
    if (targetDate >= entryDate) {
      return entry;
    }
  }

  // Fallback to earliest recorded
  return RBI_BANK_RATE_SCHEDULE[RBI_BANK_RATE_SCHEDULE.length - 1];
}

/**
 * MSMED Section 16 Interest Engine:
 * Compound interest with monthly rests at 3x RBI Bank Rate.
 * Uses exact day-count fraction compounding monthly rests, dynamically adjusting
 * balance on the exact date of partial/full payment allocations.
 */
export function calculateMsmedCompoundInterest(params: {
  principalPaise: string;
  interestStartDate: string;
  asOfDate: string;
  initialPrincipalPaise?: string;
  allocations?: Array<{
    paymentId: string;
    invoiceId: string;
    amountPaise: string;
    paymentDate: string;
  }>;
}): {
  compoundedInterestPaise: string;
  totalPayablePaise: string;
  annualRatePercent: string;
  periods: MonthlyRestPeriod[];
} {
  const netPrincipal = new Decimal(params.principalPaise || 0);
  const hasMidStreamAllocations = Boolean(params.allocations && params.allocations.length > 0 && params.initialPrincipalPaise);

  if (netPrincipal.isZero() && !hasMidStreamAllocations) {
    return {
      compoundedInterestPaise: '0',
      totalPayablePaise: '0',
      annualRatePercent: '20.25%',
      periods: [],
    };
  }

  const start = new Date(params.interestStartDate + 'T00:00:00Z');
  const end = new Date(params.asOfDate + 'T00:00:00Z');

  if (end <= start) {
    return {
      compoundedInterestPaise: '0',
      totalPayablePaise: Decimal.max(0, netPrincipal).toFixed(0),
      annualRatePercent: '20.25%',
      periods: [],
    };
  }

  // Determine starting principal at interestStartDate
  let startingBalance = hasMidStreamAllocations
    ? new Decimal(params.initialPrincipalPaise || params.principalPaise || 0)
    : netPrincipal;

  const sortedAllocations = (params.allocations || [])
    .map((a) => ({
      ...a,
      dateMs: new Date(a.paymentDate + 'T00:00:00Z').getTime(),
      amountDec: new Decimal(a.amountPaise || 0),
    }))
    .sort((a, b) => a.dateMs - b.dateMs);

  if (hasMidStreamAllocations) {
    // Deduct any payments received on or before interestStartDate
    for (const alloc of sortedAllocations) {
      if (alloc.dateMs <= start.getTime()) {
        startingBalance = Decimal.max(0, startingBalance.minus(alloc.amountDec));
      }
    }
  }

  const periods: MonthlyRestPeriod[] = [];
  let currentBalance = startingBalance;
  let cumulativeInterestAccrued = new Decimal(0);
  let cursor = new Date(start);
  let periodIndex = 1;

  while (cursor < end) {
    const periodStart = new Date(cursor);
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const nextMonthFirst = new Date(Date.UTC(year, month + 1, 1));
    const periodEnd = nextMonthFirst < end ? nextMonthFirst : new Date(end);

    const diffDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    const rbiEntry = getRbiRateForDate(periodStartStr);
    const statutoryAnnualRate = new Decimal(rbiEntry.statutoryRatePercent).dividedBy(100);

    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInYear = isLeap ? 366 : 365;

    const openingBalanceForPeriod = currentBalance;
    let periodInterest = new Decimal(0);
    const periodAllocationNotes: string[] = [];

    // Find mid-period allocations strictly inside (periodStart, periodEnd]
    const midPeriodAllocations = hasMidStreamAllocations
      ? sortedAllocations.filter(
          (a) => a.dateMs > periodStart.getTime() && a.dateMs <= periodEnd.getTime()
        )
      : [];

    if (midPeriodAllocations.length === 0) {
      periodInterest = currentBalance
        .times(statutoryAnnualRate)
        .times(diffDays)
        .dividedBy(daysInYear)
        .round();
      currentBalance = currentBalance.plus(periodInterest);
    } else {
      // Slice period by exact payment allocation dates
      let subCursorMs = periodStart.getTime();
      for (const alloc of midPeriodAllocations) {
        const subDays = Math.max(0, Math.round((alloc.dateMs - subCursorMs) / (1000 * 60 * 60 * 24)));
        if (subDays > 0 && currentBalance.greaterThan(0)) {
          const subInterest = currentBalance
            .times(statutoryAnnualRate)
            .times(subDays)
            .dividedBy(daysInYear);
          periodInterest = periodInterest.plus(subInterest);
        }
        currentBalance = Decimal.max(0, currentBalance.minus(alloc.amountDec));
        periodAllocationNotes.push(
          `${formatINR(alloc.amountPaise)} credited on ${alloc.paymentDate}`
        );
        subCursorMs = alloc.dateMs;
      }

      const remainingDays = Math.max(0, Math.round((periodEnd.getTime() - subCursorMs) / (1000 * 60 * 60 * 24)));
      if (remainingDays > 0 && currentBalance.greaterThan(0)) {
        const tailInterest = currentBalance
          .times(statutoryAnnualRate)
          .times(remainingDays)
          .dividedBy(daysInYear);
        periodInterest = periodInterest.plus(tailInterest);
      }

      periodInterest = periodInterest.round();
      currentBalance = currentBalance.plus(periodInterest);
    }

    cumulativeInterestAccrued = cumulativeInterestAccrued.plus(periodInterest);
    const closingBalance = currentBalance;

    const monthLabel = periodStart.toLocaleString('default', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const baseNote = `Compounded at 3× ${rbiEntry.bankRatePercent}% RBI Bank Rate for ${diffDays} days (${daysInYear}-day year basis)`;

    periods.push({
      periodIndex,
      monthLabel,
      startDate: periodStartStr,
      endDate: periodEndStr,
      days: diffDays,
      rbiBankRatePercent: `${rbiEntry.bankRatePercent}%`,
      statutoryRatePercent: `${rbiEntry.statutoryRatePercent}%`,
      openingPrincipalPaise: openingBalanceForPeriod.toFixed(0),
      interestAccruedPaise: periodInterest.toFixed(0),
      closingBalancePaise: closingBalance.toFixed(0),
      cumulativeInterestPaise: cumulativeInterestAccrued.toFixed(0),
      formulaNotes:
        periodAllocationNotes.length > 0
          ? `${baseNote} · Dynamic Allocation: ${periodAllocationNotes.join('; ')}`
          : baseNote,
    });

    cursor = new Date(nextMonthFirst);
    periodIndex++;
  }

  const totalCompoundedInterest = Decimal.max(0, cumulativeInterestAccrued);
  const totalPayable = Decimal.max(0, netPrincipal).plus(totalCompoundedInterest);
  const latestRate = getRbiRateForDate(params.asOfDate);

  return {
    compoundedInterestPaise: totalCompoundedInterest.toFixed(0),
    totalPayablePaise: totalPayable.toFixed(0),
    annualRatePercent: `${latestRate.statutoryRatePercent}% (3× ${latestRate.bankRatePercent}% Bank Rate)`,
    periods,
  };
}

/**
 * GSTIN Validation with Mod 36 Checksum verification
 * GSTIN Format: 15 chars (2 digit state code + 10 char PAN + 1 char entity # + 'Z' + 1 checksum char)
 */
export function validateGstin(gstin: string | undefined): GstinVerificationResult {
  if (!gstin || gstin.trim() === '') {
    return {
      gstin: '',
      syntaxValid: false,
      checksumValid: false,
      stateCode: '',
      panNumber: '',
      entityCode: '',
      status: 'not_provided',
      warnings: ['No GSTIN provided for verification.'],
    };
  }

  const clean = gstin.trim().toUpperCase();
  const warnings: string[] = [];

  // Syntax check: 2 digits, 5 alpha, 4 digit, 1 alpha, 1 alphanumeric, 'Z', 1 alphanumeric
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const syntaxValid = regex.test(clean);

  if (!syntaxValid) {
    warnings.push(`GSTIN '${clean}' does not conform to 15-character standard GSTIN syntax.`);
    return {
      gstin: clean,
      syntaxValid: false,
      checksumValid: false,
      stateCode: clean.slice(0, 2),
      panNumber: clean.slice(2, 12),
      entityCode: clean.slice(12, 13),
      status: 'invalid_format',
      warnings,
    };
  }

  // Mod-36 Checksum verification
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let factor = 1;
  let sum = 0;
  const checkChar = clean.charAt(14);

  for (let i = 0; i < 14; i++) {
    const codePoint = chars.indexOf(clean.charAt(i));
    let digit = codePoint * factor;
    factor = factor === 1 ? 2 : 1;
    digit = Math.floor(digit / 36) + (digit % 36);
    sum += digit;
  }

  const remainder = sum % 36;
  const checkCodePoint = (36 - remainder) % 36;
  const expectedCheckChar = chars.charAt(checkCodePoint);
  const checksumValid = checkChar === expectedCheckChar;

  if (!checksumValid) {
    warnings.push(
      `GSTIN checksum digit '${checkChar}' does not match computed verification character '${expectedCheckChar}'.`
    );
  }

  return {
    gstin: clean,
    syntaxValid: true,
    checksumValid,
    stateCode: clean.slice(0, 2),
    panNumber: clean.slice(2, 12),
    entityCode: clean.slice(12, 13),
    status: checksumValid ? 'verified_format' : 'invalid_format',
    warnings,
  };
}

/**
 * Udyam Registration & Transaction Date Conflict Screener
 * Flags whether supplies predate Udyam registration (Silpi Industries doctrine)
 * and whether trading activities are involved.
 */
export function verifyUdyamRegistrationAndDates(params: {
  udyamNumber: string | undefined;
  registrationDate: string | undefined;
  classification?: 'Micro' | 'Small' | 'Medium' | 'Unknown';
  registeredActivity?: 'Manufacturing' | 'Services' | 'Trading' | 'Mixed';
  invoiceDates: string[];
  deliveryDates: string[];
}): UdyamVerificationResult {
  const warnings: string[] = [];

  if (!params.udyamNumber || !params.registrationDate) {
    return {
      udyamNumber: params.udyamNumber || 'MISSING',
      registrationDate: params.registrationDate || '',
      enterpriseClassification: params.classification || 'Unknown',
      registeredActivity: params.registeredActivity || 'Manufacturing',
      status: 'registration_missing',
      warnings: ['MSME Udyam Registration Certificate details are missing. Statutory relief requires proof of registration.'],
      verifiedAt: new Date().toISOString(),
    };
  }

  const regDate = new Date(params.registrationDate + 'T00:00:00Z');
  let hasPreRegistrationSupply = false;
  let earliestSupplyDate = '';

  const allDates = [...params.invoiceDates, ...params.deliveryDates].filter(Boolean);
  if (allDates.length > 0) {
    allDates.sort();
    earliestSupplyDate = allDates[0];
    const supplyDate = new Date(earliestSupplyDate + 'T00:00:00Z');
    if (supplyDate < regDate) {
      hasPreRegistrationSupply = true;
    }
  }

  let status: UdyamVerificationResult['status'] = 'registration_verified';
  let conflictDetails: string | undefined;

  if (hasPreRegistrationSupply) {
    status = 'registration_date_conflict';
    conflictDetails = `Earliest supply/invoice date (${earliestSupplyDate}) predates Udyam registration date (${params.registrationDate}). Pursuant to Supreme Court precedent (Silpi Industries v. Kerala SRTC), delayed payment remedy under § 18 is prospective from the registration date.`;
    warnings.push(conflictDetails);
  }

  if (params.classification === 'Medium') {
    status = 'classification_needs_review';
    warnings.push(
      'Supplier is classified as "Medium Enterprise". Sections 15–23 of the MSMED Act 2006 exclusively cover "Micro" and "Small" enterprises. Medium enterprises cannot claim statutory compound interest under Section 16.'
    );
  }

  if (params.registeredActivity === 'Trading') {
    warnings.push(
      'Enterprise activity includes "Trading". While retail/wholesale traders can register on Udyam, benefits under Chapter V (Delayed Payments) are subject to specific notifications and require legal scrutiny.'
    );
  }

  return {
    udyamNumber: params.udyamNumber,
    registrationDate: params.registrationDate,
    enterpriseClassification: params.classification || 'Micro',
    registeredActivity: params.registeredActivity || 'Manufacturing',
    status,
    warnings,
    conflictDetails,
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * End-to-End Case Financial Summary Calculator
 */
export function calculateCaseFinancialSummary(params: {
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  deliveryDate: string;
  contractualDays?: number;
  objectionDate?: string;
  objectionResolutionDate?: string;
  asOfDate?: string;
}): MsmedCalculationResult {
  const asOfDate = params.asOfDate || new Date().toISOString().split('T')[0];

  // 1. Allocate payments
  const allocationResult = allocatePaymentsToInvoices(params.invoices, params.payments);

  // 2. Section 15 timeline
  const timeline = calculateSection15Timeline({
    deliveryDate: params.deliveryDate,
    contractualDays: params.contractualDays,
    objectionDate: params.objectionDate,
    objectionResolutionDate: params.objectionResolutionDate,
  });

  // 3. Section 16 compound interest (dynamically incorporates exact dates of partial payment allocations)
  const interestResult = calculateMsmedCompoundInterest({
    principalPaise: allocationResult.totalOutstandingPaise,
    initialPrincipalPaise: allocationResult.totalInvoicedPaise,
    allocations: allocationResult.allocations,
    interestStartDate: timeline.interestStartDate,
    asOfDate,
  });

  const outstandingPaise = allocationResult.totalOutstandingPaise;
  const totalClaimAmountPaise = new Decimal(outstandingPaise)
    .plus(new Decimal(interestResult.compoundedInterestPaise))
    .toFixed(0);

  // Overdue calculation: sum of overdue/disputed invoices' remaining balances, or fallback to statutoryDeadline check
  const explicitOverdueInvoices = allocationResult.invoicesWithBalances.filter(
    (inv) => inv.status === 'overdue' || inv.status === 'disputed'
  );
  const isOverdueByTimeline = new Date(asOfDate) > new Date(timeline.statutoryDeadline);
  const totalOverduePaise =
    explicitOverdueInvoices.length > 0
      ? explicitOverdueInvoices
          .reduce((acc, inv) => acc.plus(new Decimal(inv.outstandingAmountPaise || 0)), new Decimal(0))
          .toFixed(0)
      : isOverdueByTimeline
      ? outstandingPaise
      : '0';

  const warnings = [...timeline.warnings];
  if (params.contractualDays && params.contractualDays > 45) {
    warnings.push('Agreement specifies payment terms exceeding 45 days. Statutorily clamped to 45 days max.');
  }

  return {
    principalAmountPaise: allocationResult.totalInvoicedPaise,
    totalPaidPaise: allocationResult.totalPaidPaise,
    outstandingAmountPaise: outstandingPaise,
    totalOverduePaise,
    acceptanceDate: timeline.acceptanceDate,
    appointedDay: timeline.appointedDay,
    contractualDueDate: timeline.statutoryDeadline,
    statutoryDeadline: timeline.statutoryDeadline,
    interestStartDate: timeline.interestStartDate,
    annualInterestRate: interestResult.annualRatePercent,
    compoundedInterestPaise: interestResult.compoundedInterestPaise,
    totalClaimAmountPaise,
    applicableRatePeriods: interestResult.periods,
    paymentAllocations: allocationResult.allocations,
    assumptions: timeline.assumptions,
    warnings,
    policyVersion: 'MSMED_ACT_2006_SEC_15_16_V2.1',
    requiresHumanReview: warnings.length > 0 || timeline.isObjectionValid,
  };
}
