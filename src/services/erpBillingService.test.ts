/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  determineGstPlaceOfSupply,
  calculateGstInvoiceBreakdown,
  evaluateReminderEligibility,
  calculateFiveBucketAgingAnalytics,
  buildStatutoryReminderEmailHtml,
  buildBuyerOutreachMessageText,
  computeReminderFinancialSummary,
  buildRfc2822MimeWithAttachments,
  encodeMimeToBase64Url,
} from './erpBillingService.ts';
import type { InvoiceRecord } from '../types/index.ts';

test('determineGstPlaceOfSupply returns INTRA_STATE when seller and buyer state match', () => {
  assert.equal(determineGstPlaceOfSupply('Karnataka', 'karnataka'), 'INTRA_STATE');
  assert.equal(determineGstPlaceOfSupply('Maharashtra', 'Karnataka'), 'INTER_STATE');
});

test('calculateGstInvoiceBreakdown splits CGST + SGST for Intra-State and IGST for Inter-State', () => {
  const intra = calculateGstInvoiceBreakdown({
    sellerState: 'Karnataka',
    buyerState: 'Karnataka',
    items: [
      {
        description: 'CNC Precision Turbine Housing',
        quantity: 2,
        unitPricePaise: '2500000', // Rs. 25,000.00 each -> Rs. 50,000.00 subtotal
        costPricePaise: '1800000', // Rs. 18,000.00 cost -> Rs. 36,000.00 cost total
        taxRatePercent: 18,
      },
    ],
  });

  assert.equal(intra.supplyType, 'INTRA_STATE');
  assert.equal(intra.subtotalPaise, '5000000');
  assert.equal(intra.cgstPaise, '450000'); // 9% = Rs. 4,500
  assert.equal(intra.sgstPaise, '450000'); // 9% = Rs. 4,500
  assert.equal(intra.igstPaise, '0');
  assert.equal(intra.totalTaxPaise, '900000');
  assert.equal(intra.grandTotalPaise, '5900000');
  assert.equal(intra.internalCostTotalPaise, '3600000');
  assert.equal(intra.estimatedGrossMarginPaise, '1400000');

  const inter = calculateGstInvoiceBreakdown({
    sellerState: 'Karnataka',
    buyerState: 'Maharashtra',
    items: [
      {
        description: 'CNC Precision Turbine Housing',
        quantity: 2,
        unitPricePaise: '2500000',
        costPricePaise: '1800000',
        taxRatePercent: 18,
      },
    ],
  });

  assert.equal(inter.supplyType, 'INTER_STATE');
  assert.equal(inter.cgstPaise, '0');
  assert.equal(inter.sgstPaise, '0');
  assert.equal(inter.igstPaise, '900000'); // 18% = Rs. 9,000
  assert.equal(inter.grandTotalPaise, '5900000');
});

test('evaluateReminderEligibility classifies 5-stage overdue rules accurately', () => {
  const esc = evaluateReminderEligibility({
    invoiceNumber: 'INV-101',
    businessName: 'Apex Precision Engineering',
    dueDate: '2024-02-14',
    asOfDate: '2024-04-15',
    balanceDuePaise: '5000000',
    status: 'overdue',
  });
  assert.equal(esc.eligible, true);
  assert.equal(esc.reminderType, 'overdue_15d_escalation');
  assert.equal(esc.daysOverdue, 61);

  const paid = evaluateReminderEligibility({
    invoiceNumber: 'INV-101',
    businessName: 'Apex Precision Engineering',
    dueDate: '2024-02-14',
    asOfDate: '2024-04-15',
    balanceDuePaise: '0',
    status: 'paid',
  });
  assert.equal(paid.eligible, false);
});

test('calculateFiveBucketAgingAnalytics buckets invoices by overdue days', () => {
  const sampleInvoices: InvoiceRecord[] = [
    {
      id: 'inv-1',
      caseId: 'case-001',
      documentId: 'doc-1',
      invoiceNumber: 'INV-101',
      buyer: 'Bharat Heavy Electricals',
      seller: 'Apex Precision',
      invoiceDate: '2024-01-15',
      contractualDueDate: '2024-02-14',
      totalAmountPaise: '5000000',
      paidAmountPaise: '0',
      outstandingAmountPaise: '5000000',
      currency: 'INR',
      lineItems: [],
      provenance: {},
      status: 'overdue',
    },
    {
      id: 'inv-3',
      caseId: 'case-001',
      documentId: 'doc-3',
      invoiceNumber: 'INV-103',
      buyer: 'Bharat Heavy Electricals',
      seller: 'Apex Precision',
      invoiceDate: '2024-04-01',
      contractualDueDate: '2024-05-01',
      totalAmountPaise: '2000000',
      paidAmountPaise: '0',
      outstandingAmountPaise: '2000000',
      currency: 'INR',
      lineItems: [],
      provenance: {},
      status: 'pending',
    },
  ];

  const buckets = calculateFiveBucketAgingAnalytics(sampleInvoices, '2024-04-15');
  const currentBucket = buckets.find((b) => b.bucketKey === 'current');
  const criticalBucket = buckets.find((b) => b.bucketKey === 'days_gt_45');

  assert.equal(currentBucket?.amountPaise, '2000000');
  assert.equal(criticalBucket?.amountPaise, '5000000');
});

test('buildStatutoryReminderEmailHtml and buildBuyerOutreachMessageText embed buyer portal link and custom notes', () => {
  const html = buildStatutoryReminderEmailHtml({
    businessName: 'Apex Precision Engineering Pvt Ltd',
    sellerUdyamNumber: 'UDYAM-MH-01-0012345',
    customerName: 'MegaCorp Infrastructure & Projects Ltd',
    invoiceNumber: 'INV-101',
    invoiceDate: '2024-01-15',
    dueDate: '2024-02-14',
    grandTotalPaise: '5000000',
    amountPaidPaise: '0',
    balanceDuePaise: '5000000',
    daysOverdue: 61,
    customNote: 'Kindly process NEFT before Friday audit closure.',
    paymentPortalUrl: 'https://duesguard.ai/demo-pay/DG-INV-101',
  });

  assert.ok(html.includes('Kindly process NEFT before Friday audit closure.'));
  assert.ok(html.includes('https://duesguard.ai/demo-pay/DG-INV-101'));

  const textMsg = buildBuyerOutreachMessageText({
    businessName: 'Apex Precision Engineering Pvt Ltd',
    sellerUdyamNumber: 'UDYAM-MH-01-0012345',
    customerName: 'MegaCorp Infrastructure & Projects Ltd',
    invoiceNumber: 'INV-101',
    invoiceDate: '2024-01-15',
    dueDate: '2024-02-14',
    balanceDuePaise: '5000000',
    daysOverdue: 61,
    customNote: 'Kindly process NEFT before Friday audit closure.',
    paymentPortalUrl: 'https://duesguard.ai/demo-pay/DG-INV-101',
  });

  assert.ok(textMsg.includes('INV-101'));
  assert.ok(textMsg.includes('https://duesguard.ai/demo-pay/DG-INV-101'));
  assert.ok(textMsg.includes('MSMED Sec 16 Statutory Interest'));
});

test('computeReminderFinancialSummary and buildRfc2822MimeWithAttachments construct valid Gmail multipart/mixed MIME with soft copies', () => {
  const fin = computeReminderFinancialSummary('5000000', 61);
  assert.equal(fin.principalPaise, '5000000');
  assert.equal(fin.statutoryInterestPaise, '169212');
  assert.equal(fin.totalPayablePaise, '5169212');

  const mime = buildRfc2822MimeWithAttachments({
    to: 'chandraharshavardhan1@gmail.com',
    subject: 'Buyer Reminder Bill: Invoice INV-101 (Due: 2024-02-14)',
    plainTextBody: 'Pending Principal: Rs. 50,000.00 | Due Date: 2024-02-14',
    htmlBody: '<html><body><h1>Buyer Reminder Bill</h1></body></html>',
    attachments: [
      {
        filename: 'Buyer_Reminder_Bill_INV-101.pdf',
        mimeType: 'application/pdf',
        base64Content: 'JVBERi0xLjQK',
      },
      {
        filename: 'Buyer_Notice_Portal_Preview_INV-101.html',
        mimeType: 'text/html',
        base64Content: 'PGh0bWw+PC9odG1sPg==',
      },
    ],
  });

  assert.ok(mime.includes('To: chandraharshavardhan1@gmail.com'));
  assert.ok(mime.includes('Content-Type: multipart/mixed;'));
  assert.ok(mime.includes('filename="Buyer_Reminder_Bill_INV-101.pdf"'));
  assert.ok(mime.includes('filename="Buyer_Notice_Portal_Preview_INV-101.html"'));

  const rawUrlSafe = encodeMimeToBase64Url(mime);
  assert.ok(!rawUrlSafe.includes('+'));
  assert.ok(!rawUrlSafe.includes('/'));
  assert.ok(!rawUrlSafe.endsWith('='));
});


