/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Deterministic ERP, GST Place-of-Supply & Overdue Reminder Engine
 * Merges the core features of VenkataSuresh-Maddi/duesgaurd with DuesGuard AI's
 * zero-float `decimal.js` architecture.
 */

import Decimal from 'decimal.js';
import type {
  EmailReminderRuleType,
  FiveBucketAgingDatum,
  GstInvoiceCalculation,
  GstLineItemCalculation,
  GstSupplyType,
  InvoiceRecord,
} from '../types/index.ts';
import { formatINR } from './finance.ts';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

/**
 * Normalizes state names for Place of Supply comparison under IGST Act 2017.
 */
export function normalizeIndianState(state?: string): string {
  return (state || 'Karnataka').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Determines whether a transaction is INTRA_STATE (CGST + SGST) or INTER_STATE (IGST).
 */
export function determineGstPlaceOfSupply(sellerState?: string, buyerState?: string): GstSupplyType {
  const s = normalizeIndianState(sellerState);
  const b = normalizeIndianState(buyerState);
  return s === b ? 'INTRA_STATE' : 'INTER_STATE';
}

/**
 * Deterministically computes GST invoice breakdown (CGST/SGST vs IGST) and internal cost margins
 * using integer paise and Decimal.js (zero floating-point drift).
 */
export function calculateGstInvoiceBreakdown(params: {
  sellerState?: string;
  buyerState?: string;
  items: Array<{
    id?: string;
    productId?: string;
    sku?: string;
    description: string;
    quantity: number;
    unit?: string;
    unitPricePaise: string | number;
    costPricePaise?: string | number;
    taxRatePercent: number;
  }>;
}): GstInvoiceCalculation {
  const sellerStateClean = (params.sellerState || 'Karnataka').trim();
  const buyerStateClean = (params.buyerState || 'Maharashtra').trim();
  const supplyType = determineGstPlaceOfSupply(sellerStateClean, buyerStateClean);

  let subtotal = new Decimal(0);
  let totalCgst = new Decimal(0);
  let totalSgst = new Decimal(0);
  let totalIgst = new Decimal(0);
  let totalInternalCost = new Decimal(0);

  const computedItems: GstLineItemCalculation[] = params.items.map((item, idx) => {
    const qty = new Decimal(Math.max(0, Number(item.quantity) || 0));
    const unitPrice = new Decimal(item.unitPricePaise || 0);
    const costPrice = new Decimal(item.costPricePaise || 0);
    const rate = new Decimal(Math.max(0, Number(item.taxRatePercent) || 0));

    const itemSubtotal = unitPrice.times(qty).round();
    const itemCostTotal = costPrice.times(qty).round();
    const totalTax = itemSubtotal.times(rate).dividedBy(100).round();

    let itemCgst = new Decimal(0);
    let itemSgst = new Decimal(0);
    let itemIgst = new Decimal(0);

    if (supplyType === 'INTRA_STATE') {
      // Split equally between CGST and SGST, preserving exact total tax paise
      itemCgst = totalTax.dividedBy(2).floor();
      itemSgst = totalTax.minus(itemCgst);
    } else {
      itemIgst = totalTax;
    }

    const lineTotal = itemSubtotal.plus(totalTax);

    subtotal = subtotal.plus(itemSubtotal);
    totalCgst = totalCgst.plus(itemCgst);
    totalSgst = totalSgst.plus(itemSgst);
    totalIgst = totalIgst.plus(itemIgst);
    totalInternalCost = totalInternalCost.plus(itemCostTotal);

    return {
      id: item.id || `li-${idx + 1}`,
      productId: item.productId,
      sku: item.sku,
      description: item.description,
      quantity: qty.toNumber(),
      unit: item.unit || 'PCS',
      unitPricePaise: unitPrice.toFixed(0),
      costPricePaise: costPrice.toFixed(0),
      taxRatePercent: rate.toNumber(),
      subtotalPaise: itemSubtotal.toFixed(0),
      cgstPaise: itemCgst.toFixed(0),
      sgstPaise: itemSgst.toFixed(0),
      igstPaise: itemIgst.toFixed(0),
      taxAmountPaise: totalTax.toFixed(0),
      lineTotalPaise: lineTotal.toFixed(0),
    };
  });

  const totalTax = totalCgst.plus(totalSgst).plus(totalIgst);
  const grandTotal = subtotal.plus(totalTax);
  const estimatedMargin = subtotal.minus(totalInternalCost);

  return {
    supplyType,
    sellerState: sellerStateClean,
    buyerState: buyerStateClean,
    subtotalPaise: subtotal.toFixed(0),
    cgstPaise: totalCgst.toFixed(0),
    sgstPaise: totalSgst.toFixed(0),
    igstPaise: totalIgst.toFixed(0),
    totalTaxPaise: totalTax.toFixed(0),
    grandTotalPaise: grandTotal.toFixed(0),
    internalCostTotalPaise: totalInternalCost.toFixed(0),
    estimatedGrossMarginPaise: estimatedMargin.toFixed(0),
    lineItems: computedItems,
  };
}

/**
 * Calculates whole-day difference between `asOfDate` and `dueDate` (YYYY-MM-DD).
 * Positive (> 0) means overdue; Negative (< 0) means upcoming; 0 means due today.
 */
export function calculateDaysDifference(dueDateStr: string, asOfDateStr: string): number {
  const due = new Date(`${dueDateStr}T00:00:00Z`);
  const asOf = new Date(`${asOfDateStr}T00:00:00Z`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(asOf.getTime())) {
    return 0;
  }
  return Math.round((asOf.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Evaluates idempotent reminder eligibility rules from VenkataSuresh-Maddi/duesgaurd:
 * - upcoming_3d: -3 to -1 days before due date
 * - due_today: 0 days (due today)
 * - overdue_1d: 1 to 6 days overdue
 * - overdue_7d: 7 to 14 days overdue
 * - overdue_15d_escalation: >= 15 days overdue (Formal MSMED Statutory Notice)
 */
export function evaluateReminderEligibility(params: {
  invoiceNumber: string;
  businessName: string;
  dueDate: string;
  asOfDate: string;
  balanceDuePaise: string;
  status: string;
}): {
  eligible: boolean;
  daysDifference: number;
  daysOverdue: number;
  reminderType: EmailReminderRuleType | null;
  subject: string;
} {
  const balance = new Decimal(params.balanceDuePaise || '0');
  if (balance.lte(0) || params.status === 'paid') {
    return {
      eligible: false,
      daysDifference: 0,
      daysOverdue: 0,
      reminderType: null,
      subject: '',
    };
  }

  const diff = calculateDaysDifference(params.dueDate, params.asOfDate);
  const daysOverdue = Math.max(0, diff);

  if (diff >= -3 && diff < 0) {
    return {
      eligible: true,
      daysDifference: diff,
      daysOverdue: 0,
      reminderType: 'upcoming_3d',
      subject: `Upcoming Payment Notice: Invoice ${params.invoiceNumber} from ${params.businessName}`,
    };
  }

  if (diff === 0) {
    return {
      eligible: true,
      daysDifference: 0,
      daysOverdue: 0,
      reminderType: 'due_today',
      subject: `Payment Due Today: Invoice ${params.invoiceNumber} from ${params.businessName}`,
    };
  }

  if (diff >= 1 && diff < 7) {
    return {
      eligible: true,
      daysDifference: diff,
      daysOverdue,
      reminderType: 'overdue_1d',
      subject: `Payment Overdue (${diff}d): Invoice ${params.invoiceNumber} — ${params.businessName}`,
    };
  }

  if (diff >= 7 && diff < 15) {
    return {
      eligible: true,
      daysDifference: diff,
      daysOverdue,
      reminderType: 'overdue_7d',
      subject: `Urgent Follow-Up (${diff} Days Overdue): Invoice ${params.invoiceNumber}`,
    };
  }

  if (diff >= 15) {
    return {
      eligible: true,
      daysDifference: diff,
      daysOverdue,
      reminderType: 'overdue_15d_escalation',
      subject: `Formal MSMED Statutory Notice: Invoice ${params.invoiceNumber} (${diff} Days Overdue)`,
    };
  }

  return {
    eligible: false,
    daysDifference: diff,
    daysOverdue: 0,
    reminderType: null,
    subject: '',
  };
}

/**
 * Generates clean HTML reminder email content incorporating MSMED Act 2006 Chapter V statutory disclosure,
 * deterministic Section 16 compound interest breakdown, custom supplier note, and direct DuesGuard AI
 * Buyer Settlement Portal link for maximum application exposure.
 */
export function buildStatutoryReminderEmailHtml(params: {
  businessName: string;
  sellerUdyamNumber?: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  grandTotalPaise: string;
  amountPaidPaise: string;
  balanceDuePaise: string;
  daysOverdue: number;
  statutoryInterestPaise?: string;
  totalClaimablePaise?: string;
  customNote?: string;
  paymentPortalUrl?: string;
  reminderType?: EmailReminderRuleType;
}): string {
  const isOverdue = params.daysOverdue > 0;
  const statusColor = isOverdue ? '#dc2626' : '#4f46e5';
  const statusLabel = isOverdue
    ? `OVERDUE BY ${params.daysOverdue} DAYS · MSMED SECTION 16 ACTIVE`
    : 'UPCOMING / DUE PAYMENT REMINDER';

  const balanceDec = new Decimal(params.balanceDuePaise || '0');
  // Deterministic Section 16 compound interest estimate if not explicitly passed
  const interestDec = params.statutoryInterestPaise
    ? new Decimal(params.statutoryInterestPaise)
    : isOverdue
    ? balanceDec
        .times(0.2025)
        .times(params.daysOverdue)
        .dividedBy(365)
        .round()
    : new Decimal(0);
  const totalClaimDec = params.totalClaimablePaise
    ? new Decimal(params.totalClaimablePaise)
    : balanceDec.plus(interestDec);

  const portalUrl =
    params.paymentPortalUrl ||
    `https://duesguard.ai/demo-pay/DG-${params.invoiceNumber.toUpperCase()}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px; color: #0f172a; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 24px; color: #ffffff; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .badge { display: inline-block; padding: 5px 12px; background: ${statusColor}; color: #ffffff; font-size: 11px; font-weight: 700; border-radius: 6px; margin-top: 10px; letter-spacing: 0.4px; }
    .content { padding: 28px; font-size: 14px; line-height: 1.6; }
    .amount-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0; text-align: center; }
    .amount-box .lbl { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .amount-box .val { font-size: 26px; color: #0f172a; font-weight: 800; font-family: monospace; margin-top: 4px; }
    .amount-box .sub { font-size: 12px; color: #dc2626; font-weight: 700; margin-top: 6px; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    td:last-child { text-align: right; font-weight: 600; font-family: monospace; }
    .note-box { background: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 6px; padding: 12px 14px; margin: 16px 0; font-size: 13px; color: #1e1b4b; }
    .cta-wrap { text-align: center; margin: 24px 0; }
    .cta-btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 13px; padding: 12px 24px; border-radius: 8px; }
    .msme-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12px; color: #9f1239; }
    .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${params.businessName}</h1>
      <div class="badge">${statusLabel}</div>
    </div>
    <div class="content">
      <p>Dear <strong>${params.customerName}</strong> Accounts Payable &amp; Finance Team,</p>
      <p>This is an official accounts receivable reminder regarding GST Tax Invoice <strong>${params.invoiceNumber}</strong> issued by <strong>${params.businessName}</strong>${params.sellerUdyamNumber ? ` (Udyam Reg: ${params.sellerUdyamNumber})` : ''}.</p>
      ${
        params.customNote
          ? `<div class="note-box"><strong>Message from ${params.businessName}:</strong><br/>${params.customNote}</div>`
          : ''
      }
      <div class="amount-box">
        <div class="lbl">Total Enforceable Amount Payable</div>
        <div class="val">${formatINR(totalClaimDec.toFixed(0))}</div>
        ${
          isOverdue
            ? `<div class="sub">Includes Principal ${formatINR(balanceDec.toFixed(0))} + MSMED §16 Interest ${formatINR(interestDec.toFixed(0))}</div>`
            : ''
        }
      </div>
      <table>
        <tr><td>Invoice Number</td><td>${params.invoiceNumber}</td></tr>
        <tr><td>Invoice Date</td><td>${params.invoiceDate}</td></tr>
        <tr><td>Statutory / Contractual Due Date</td><td>${params.dueDate}</td></tr>
        <tr><td>Total Billed Amount</td><td>${formatINR(params.grandTotalPaise)}</td></tr>
        <tr><td>Verified Payments Received</td><td>${formatINR(params.amountPaidPaise)}</td></tr>
        <tr><td>Outstanding Principal Balance</td><td>${formatINR(balanceDec.toFixed(0))}</td></tr>
        ${
          isOverdue
            ? `<tr><td>Accrued MSMED Section 16 Interest (20.25% p.a.)</td><td>${formatINR(interestDec.toFixed(0))}</td></tr>`
            : ''
        }
      </table>
      <div class="cta-wrap">
        <a href="${portalUrl}" class="cta-btn">Inspect Invoice &amp; Settle Online via DuesGuard AI &rarr;</a>
        <div style="font-size:11px;color:#64748b;margin-top:8px;font-family:monospace;">Direct Portal: ${portalUrl}</div>
      </div>
      <div class="msme-box">
        <strong>Statutory Disclosure under Chapter V of the MSMED Act, 2006 (Sections 15 &amp; 16):</strong>
        Payments to registered Micro and Small Enterprises must be settled within the agreed credit period (not exceeding 45 days from acceptance). Delayed payments attract compound interest with monthly rests at 3&times; the RBI-notified Bank Rate (20.25% p.a.).
      </div>
      <p>Kindly click the settlement portal link above to pay via UPI/QR/NEFT or share the UTR remittance advice once transferred.</p>
      <p>Sincerely,<br/><strong>${params.businessName} — Finance &amp; Compliance Desk</strong></p>
    </div>
    <div class="footer">
      Powered by <strong>DuesGuard AI</strong> · MSME Receivables, GST Billing &amp; Statutory Resolution Platform
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates a structured plain-text message for WhatsApp Business, SMS, or direct Email client (`mailto:`)
 * that raises a clear payment reminder to the buyer and shares the DuesGuard AI Buyer Settlement Link.
 */
export function buildBuyerOutreachMessageText(params: {
  businessName: string;
  sellerUdyamNumber?: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  balanceDuePaise: string;
  daysOverdue: number;
  statutoryInterestPaise?: string;
  customNote?: string;
  paymentPortalUrl?: string;
  reminderType?: EmailReminderRuleType;
}): string {
  const isOverdue = params.daysOverdue > 0;
  const balanceDec = new Decimal(params.balanceDuePaise || '0');
  const interestDec = params.statutoryInterestPaise
    ? new Decimal(params.statutoryInterestPaise)
    : isOverdue
    ? balanceDec
        .times(0.2025)
        .times(params.daysOverdue)
        .dividedBy(365)
        .round()
    : new Decimal(0);
  const totalDec = balanceDec.plus(interestDec);
  const portalUrl =
    params.paymentPortalUrl ||
    `https://duesguard.ai/demo-pay/DG-${params.invoiceNumber.toUpperCase()}`;

  const headerLine = isOverdue
    ? `[STATUTORY PAYMENT REMINDER — ${params.daysOverdue} DAYS OVERDUE]`
    : `[UPCOMING INVOICE PAYMENT REMINDER]`;

  const lines = [
    headerLine,
    `Dear ${params.customerName} Finance & Accounts Payable Team,`,
    ``,
    `This is an official payment reminder from ${params.businessName}${
      params.sellerUdyamNumber ? ` (Udyam: ${params.sellerUdyamNumber})` : ''
    } regarding GST Tax Invoice ${params.invoiceNumber}.`,
  ];

  if (params.customNote && params.customNote.trim()) {
    lines.push(``, `Note from Supplier: "${params.customNote.trim()}"`);
  }

  lines.push(
    ``,
    `• Invoice Number: ${params.invoiceNumber}`,
    `• Invoice Date: ${params.invoiceDate} | Due Date: ${params.dueDate}`,
    `• Principal Balance Due: ${formatINR(balanceDec.toFixed(0))}`
  );

  if (isOverdue) {
    lines.push(
      `• MSMED Sec 16 Statutory Interest (20.25% p.a.): ${formatINR(interestDec.toFixed(0))}`,
      `• Total Enforceable Payable: ${formatINR(totalDec.toFixed(0))}`
    );
  }

  lines.push(
    ``,
    `View Verified Invoice & Settle Instantly via DuesGuard AI Buyer Portal:`,
    `${portalUrl}`,
    ``,
    `Statutory Notice: Under Sections 15 & 16 of the MSMED Act 2006, delayed payments beyond the statutory credit limit attract compound interest at 3x RBI Bank Rate (20.25% p.a.) with monthly rests.`,
    ``,
    `Regards,`,
    `${params.businessName} (via DuesGuard AI Compliance Suite)`
  );

  return lines.join('\n');
}

/**
 * Computes the 5-bucket statutory MSME aging distribution across active invoices.
 */
export function calculateFiveBucketAgingAnalytics(
  invoices: InvoiceRecord[],
  asOfDate: string
): FiveBucketAgingDatum[] {
  const buckets: Record<
    FiveBucketAgingDatum['bucketKey'],
    {
      bucketLabel: string;
      shortLabel: string;
      amountPaise: Decimal;
      invoiceRefs: string[];
      statutoryNote: string;
    }
  > = {
    current: {
      bucketLabel: 'Current (Not Yet Due)',
      shortLabel: 'Current',
      amountPaise: new Decimal(0),
      invoiceRefs: [],
      statutoryNote: 'Within contractual / appointed credit window',
    },
    days_1_7: {
      bucketLabel: '1–7 Days Overdue',
      shortLabel: '1–7 Days',
      amountPaise: new Decimal(0),
      invoiceRefs: [],
      statutoryNote: 'Early overdue · 1st & 7th day reminder window',
    },
    days_8_15: {
      bucketLabel: '8–15 Days Overdue',
      shortLabel: '8–15 Days',
      amountPaise: new Decimal(0),
      invoiceRefs: [],
      statutoryNote: 'MSMED § 15 Appointed-Day threshold window',
    },
    days_16_45: {
      bucketLabel: '16–45 Days Overdue',
      shortLabel: '16–45 Days',
      amountPaise: new Decimal(0),
      invoiceRefs: [],
      statutoryNote: 'Approaching 45-day statutory credit cap',
    },
    days_gt_45: {
      bucketLabel: '> 45 Days Critical',
      shortLabel: '> 45 Days',
      amountPaise: new Decimal(0),
      invoiceRefs: [],
      statutoryNote: 'MSMED § 15 Cap Breached · 3× RBI Interest Accruing',
    },
  };

  for (const inv of invoices) {
    const out = new Decimal(inv.outstandingAmountPaise || '0');
    if (out.lte(0) || inv.status === 'paid') continue;

    const dueDate = inv.contractualDueDate || inv.invoiceDate;
    const diff = calculateDaysDifference(dueDate, asOfDate);

    if (diff <= 0) {
      buckets.current.amountPaise = buckets.current.amountPaise.plus(out);
      buckets.current.invoiceRefs.push(inv.invoiceNumber);
    } else if (diff <= 7) {
      buckets.days_1_7.amountPaise = buckets.days_1_7.amountPaise.plus(out);
      buckets.days_1_7.invoiceRefs.push(inv.invoiceNumber);
    } else if (diff <= 15) {
      buckets.days_8_15.amountPaise = buckets.days_8_15.amountPaise.plus(out);
      buckets.days_8_15.invoiceRefs.push(inv.invoiceNumber);
    } else if (diff <= 45) {
      buckets.days_16_45.amountPaise = buckets.days_16_45.amountPaise.plus(out);
      buckets.days_16_45.invoiceRefs.push(inv.invoiceNumber);
    } else {
      buckets.days_gt_45.amountPaise = buckets.days_gt_45.amountPaise.plus(out);
      buckets.days_gt_45.invoiceRefs.push(inv.invoiceNumber);
    }
  }

  return (Object.keys(buckets) as Array<FiveBucketAgingDatum['bucketKey']>).map((key) => {
    const b = buckets[key];
    return {
      bucketKey: key,
      bucketLabel: b.bucketLabel,
      shortLabel: b.shortLabel,
      amountPaise: b.amountPaise.toFixed(0),
      amountInr: b.amountPaise.dividedBy(100).round().toNumber(),
      invoiceCount: b.invoiceRefs.length,
      invoiceRefs: b.invoiceRefs,
      statutoryNote: b.statutoryNote,
    };
  });
}

/**
 * Deterministically computes the Principal, MSMED Section 16 Interest (20.25% p.a.),
 * and Total Enforceable Payable in Paise for a reminder bill & soft copy.
 */
export function computeReminderFinancialSummary(
  balanceDuePaise: string,
  daysOverdue: number
): {
  principalPaise: string;
  statutoryInterestPaise: string;
  totalPayablePaise: string;
} {
  const balanceDec = new Decimal(balanceDuePaise || '0');
  const interestDec =
    daysOverdue > 0
      ? balanceDec.times(0.2025).times(daysOverdue).dividedBy(365).round()
      : new Decimal(0);
  const totalDec = balanceDec.plus(interestDec);
  return {
    principalPaise: balanceDec.toFixed(0),
    statutoryInterestPaise: interestDec.toFixed(0),
    totalPayablePaise: totalDec.toFixed(0),
  };
}

/**
 * Cross-platform UTF-8 to standard Base64 encoder (works in both Browser and Node.js).
 */
export function utf8ToBase64(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64');
  }
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Splits a base64 string into RFC 2045 compliant 76-character lines.
 */
function chunkBase64Lines(b64: string): string {
  const clean = b64.replace(/\r?\n/g, '');
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 76) {
    chunks.push(clean.slice(i, i + 76));
  }
  return chunks.join('\r\n');
}

/**
 * Constructs an RFC 2822 `multipart/mixed` email message containing:
 *  - `multipart/alternative` with both plain-text (`text/plain`) and rich HTML (`text/html`) bodies
 *  - One or more base64-encoded file attachments (such as the Buyer Reminder Bill PDF & Soft-Copy Notice HTML)
 */
export function buildRfc2822MimeWithAttachments(params: {
  to: string;
  fromEmail?: string;
  fromName?: string;
  subject: string;
  plainTextBody: string;
  htmlBody: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    base64Content: string;
  }>;
}): string {
  const mixedBoundary = '====DuesGuard_Mixed_Boundary_2026====';
  const altBoundary = '====DuesGuard_Alt_Boundary_2026====';
  const encodedSubject = `=?UTF-8?B?${utf8ToBase64(params.subject)}?=`;
  const msgId = `<dg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@duesguard.ai>`;
  const senderDisplay = (params.fromName || 'DuesGuard AI Statutory Billing').replace(/"/g, '');

  const lines: string[] = [];
  if (params.fromEmail && params.fromEmail.trim()) {
    lines.push(`From: "${senderDisplay}" <${params.fromEmail.trim()}>`);
  }
  lines.push(
    `To: ${params.to.trim()}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${msgId}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    ``,
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    chunkBase64Lines(utf8ToBase64(params.plainTextBody)),
    ``,
    `--${altBoundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    chunkBase64Lines(utf8ToBase64(params.htmlBody)),
    ``,
    `--${altBoundary}--`
  );

  for (const att of params.attachments || []) {
    if (!att.base64Content) continue;
    lines.push(
      ``,
      `--${mixedBoundary}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      chunkBase64Lines(att.base64Content)
    );
  }

  lines.push(``, `--${mixedBoundary}--`, ``);
  return lines.join('\r\n');
}

/**
 * Encodes an RFC 2822 MIME message string into URL-safe Base64 (`base64url`)
 * as required by the Gmail REST API (`POST /gmail/v1/users/me/messages/send`).
 */
export function encodeMimeToBase64Url(mimeMessage: string): string {
  return utf8ToBase64(mimeMessage)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

