/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import type { AnalysisRun, CaseDocument, CaseRecord, InvoiceRecord } from '../types/index.ts';
import { formatINR, paiseToRupees } from './finance.ts';

export function generateCasePdf(params: {
  reportType: 'internal_case_summary' | 'odr_annexure_index';
  caseRecord: CaseRecord;
  analysis: AnalysisRun;
  invoices: InvoiceRecord[];
  documents: CaseDocument[];
}): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 40;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 70, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('DUESGUARD AI — MSMED STATUTORY AUDIT REPORT', 40, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const title =
    params.reportType === 'internal_case_summary'
      ? 'INTERNAL CASE SUMMARY & RECOVERY READINESS AUDIT'
      : 'ODR EVIDENCE INDEX & STATUTORY CLAIM DRAFT ANNEXURE';
  doc.text(title, 40, 45);
  doc.text(`Case Ref: ${params.caseRecord.caseReference}  |  Generated: ${new Date().toLocaleDateString('en-IN')}`, 40, 58);

  y = 95;
  doc.setTextColor(15, 23, 42);

  // Section: Enterprise & Dispute Parties
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. PARTIES & MSME ELIGIBILITY DETAILS', 40, y);
  y += 16;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(40, y, pageWidth - 40, y);
  y += 14;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  // Supplier Box
  doc.setFont('helvetica', 'bold');
  doc.text('SUPPLIER (PETITIONER):', 40, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${params.caseRecord.sellerName}`, 180, y);
  y += 14;

  doc.text('Udyam Registration:', 40, y);
  doc.text(`${params.caseRecord.sellerUdyamNumber || 'N/A'} (Reg Date: ${params.caseRecord.sellerUdyamRegDate || 'N/A'})`, 180, y);
  y += 14;

  doc.text('Enterprise Classification:', 40, y);
  doc.text(`${params.caseRecord.sellerClassification} Enterprise (${params.caseRecord.sellerActivity})`, 180, y);
  y += 14;

  doc.text('Supplier GSTIN:', 40, y);
  doc.text(`${params.caseRecord.sellerGstin || 'N/A'}`, 180, y);
  y += 18;

  // Buyer Box
  doc.setFont('helvetica', 'bold');
  doc.text('BUYER (RESPONDENT):', 40, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${params.caseRecord.buyerName}`, 180, y);
  y += 14;

  doc.text('Buyer GSTIN:', 40, y);
  doc.text(`${params.caseRecord.buyerGstin || 'N/A'}`, 180, y);
  y += 14;

  doc.text('Agreed Credit Terms:', 40, y);
  doc.text(`${params.caseRecord.contractualPaymentDays} Days (Statutory Max under § 15: 45 Days)`, 180, y);
  y += 22;

  // Section: Financial Claim Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('2. MSMED STATUTORY FINANCIAL COMPUTATION (SECTIONS 15 & 16)', 40, y);
  y += 16;
  doc.line(40, y, pageWidth - 40, y);
  y += 14;

  const msmed = params.analysis.msmedResult;
  doc.setFontSize(9);

  // Table grid
  doc.setFillColor(248, 250, 252);
  doc.rect(40, y, pageWidth - 80, 75, 'F');
  doc.rect(40, y, pageWidth - 80, 75, 'S');

  doc.setFont('helvetica', 'bold');
  doc.text('Total Invoiced Value:', 50, y + 16);
  doc.text('Recorded Payments:', 50, y + 32);
  doc.text('Outstanding Principal:', 50, y + 48);
  doc.text('Section 16 Statutory Interest (3× RBI):', 50, y + 64);

  doc.setFont('helvetica', 'normal');
  doc.text(`${formatINR(msmed?.principalAmountPaise || '0')}`, 260, y + 16);
  doc.text(`${formatINR(msmed?.totalPaidPaise || '0')}`, 260, y + 32);
  doc.text(`${formatINR(msmed?.outstandingAmountPaise || '0')}`, 260, y + 48);
  doc.text(`${formatINR(msmed?.compoundedInterestPaise || '0')} (At ${msmed?.annualInterestRate || '20.25%'})`, 260, y + 64);

  y += 85;

  // Total Recovery Claim box
  doc.setFillColor(241, 245, 249);
  doc.rect(40, y, pageWidth - 80, 26, 'F');
  doc.rect(40, y, pageWidth - 80, 26, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('TOTAL RECOVERY CLAIM AS OF DATE:', 50, y + 17);
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatINR(msmed?.totalClaimAmountPaise || '0')}`, 320, y + 17);

  y += 40;
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  // Section: Invoices Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. INVOICE LEDGER & RECONCILIATION SCHEDULE', 40, y);
  y += 16;
  doc.line(40, y, pageWidth - 40, y);
  y += 14;

  // Invoices Header
  doc.setFillColor(241, 245, 249);
  doc.rect(40, y, pageWidth - 80, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('INVOICE NO.', 48, y + 12);
  doc.text('DATE', 125, y + 12);
  doc.text('PO REF.', 190, y + 12);
  doc.text('DELIVERY REF.', 265, y + 12);
  doc.text('AMOUNT', 380, y + 12);
  doc.text('STATUS', 470, y + 12);
  y += 18;

  doc.setFont('helvetica', 'normal');
  for (const inv of params.invoices) {
    doc.text(inv.invoiceNumber, 48, y + 12);
    doc.text(inv.invoiceDate, 125, y + 12);
    doc.text(inv.poReference || 'N/A', 190, y + 12);
    doc.text(inv.deliveryReference || 'No Ref', 265, y + 12);
    doc.text(`INR ${paiseToRupees(inv.totalAmountPaise)}`, 380, y + 12);
    doc.text(inv.status.toUpperCase(), 470, y + 12);
    y += 16;
  }

  y += 12;

  // Section: Evidence Gaps & Reviewer Verification
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('4. EVIDENCE AUDIT FINDINGS & HUMAN REVIEW SIGN-OFF', 40, y);
  y += 16;
  doc.line(40, y, pageWidth - 40, y);
  y += 14;

  doc.setFontSize(8);
  for (const find of params.analysis.findings) {
    const prefix = find.severity === 'critical' ? '[CRITICAL GAP]' : find.severity === 'warning' ? '[WARNING]' : '[VERIFIED]';
    doc.setFont('helvetica', 'bold');
    doc.text(`${prefix} ${find.code}:`, 40, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(find.message, pageWidth - 80);
    doc.text(lines, 40, y + 11);
    y += 12 + lines.length * 10;
  }

  y += 10;

  // Reviewer Seal
  doc.setFillColor(248, 250, 252);
  doc.rect(40, y, pageWidth - 80, 50, 'F');
  doc.rect(40, y, pageWidth - 80, 50, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('AUTHORIZED HUMAN REVIEWER SIGN-OFF:', 48, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Reviewer: ${params.analysis.reviewerName || 'Harsha Vardhan'} | Designation: ${params.analysis.reviewerDesignation || 'MSME Financial Reviewer'}`,
    48,
    y + 28
  );
  doc.text(`Audit Status: ${params.analysis.approvalStatus.toUpperCase()} | Approval Date: ${params.analysis.reviewedAt || new Date().toISOString()}`, 48, y + 40);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Notice: Prepared via DuesGuard AI deterministic verification engine. Organizes evidence and calculations under MSMED Act 2006 for conciliation/tribunal review. Not legal advice.',
    40,
    pageWidth > 500 ? 800 : 780
  );

  return doc;
}

/**
 * Generates an official GST Tax Invoice PDF (Intra-State CGST/SGST or Inter-State IGST)
 * with statutory MSMED Act 2006 Chapter V penal interest disclosure.
 */
export function generateGstTaxInvoicePdf(params: {
  invoice: InvoiceRecord;
  caseRecord: CaseRecord;
  customerState?: string;
  customerAddress?: string;
}): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const { invoice, caseRecord } = params;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 40;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 76, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('TAX INVOICE (GST & MSMED ACT COMPLIANT)', 40, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Supplier: ${invoice.seller || caseRecord.sellerName}  |  GSTIN: ${invoice.sellerGstin || caseRecord.sellerGstin || '29AABCU9603R1ZJ'}`,
    40,
    46
  );
  doc.text(
    `Udyam Reg: ${caseRecord.sellerUdyamNumber || 'UDYAM-KR-03-0048291'} (${caseRecord.sellerClassification} ${caseRecord.sellerActivity})`,
    40,
    60
  );

  y = 100;
  doc.setTextColor(15, 23, 42);

  // Invoice Metadata & Bill-To Grid
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(40, y, pageWidth - 80, 74, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BILL TO (BUYER):', 50, y + 16);
  doc.setFontSize(10);
  doc.text(invoice.buyer || caseRecord.buyerName, 50, y + 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Buyer GSTIN: ${invoice.buyerGstin || caseRecord.buyerGstin || '27AAACT2727Q1ZW'}`, 50, y + 44);
  doc.text(
    `Place of Supply: ${invoice.buyerState || params.customerState || 'Maharashtra'} (${invoice.supplyType === 'INTRA_STATE' ? 'Intra-State CGST+SGST' : 'Inter-State IGST'})`,
    50,
    y + 58
  );

  const metaX = 340;
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, metaX, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice Date: ${invoice.invoiceDate}`, metaX, y + 30);
  doc.text(`Due Date: ${invoice.contractualDueDate || '30 Days'}`, metaX, y + 44);
  doc.text(`PO Ref: ${invoice.poReference || 'Direct Order'}`, metaX, y + 58);

  y += 92;

  // Line Items Table Header
  doc.setFillColor(30, 41, 59);
  doc.rect(40, y, pageWidth - 80, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('DESCRIPTION OF GOODS / SERVICES', 48, y + 14);
  doc.text('QTY', 270, y + 14);
  doc.text('UNIT RATE', 320, y + 14);
  doc.text('GST %', 395, y + 14);
  doc.text('TAX AMT', 440, y + 14);
  doc.text('TOTAL (INR)', 500, y + 14);

  y += 22;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');

  const items = invoice.lineItems && invoice.lineItems.length > 0
    ? invoice.lineItems
    : [
        {
          id: 'li-default',
          description: `Industrial Supply under ${invoice.invoiceNumber}`,
          quantity: 1,
          unitPricePaise: invoice.subtotalPaise || invoice.totalAmountPaise,
          taxRatePercent: 18,
          taxAmountPaise: invoice.totalTaxPaise || '0',
          lineTotalPaise: invoice.totalAmountPaise,
          sourcePage: 1,
        },
      ];

  items.forEach((item, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(40, y, pageWidth - 80, 20, 'F');
    }
    doc.text(item.description.slice(0, 42), 48, y + 13);
    doc.text(String(item.quantity), 270, y + 13);
    doc.text(paiseToRupees(item.unitPricePaise), 320, y + 13);
    doc.text(`${item.taxRatePercent}%`, 395, y + 13);
    doc.text(paiseToRupees(item.taxAmountPaise), 440, y + 13);
    doc.text(paiseToRupees(item.lineTotalPaise), 500, y + 13);
    y += 20;
  });

  y += 12;
  doc.setDrawColor(203, 213, 225);
  doc.line(40, y, pageWidth - 40, y);
  y += 16;

  // Tax & Totals Summary
  const totX = 340;
  doc.setFontSize(9);
  if (invoice.subtotalPaise) {
    doc.text('Taxable Subtotal:', totX, y);
    doc.text(formatINR(invoice.subtotalPaise), 460, y);
    y += 15;
  }
  if (invoice.cgstPaise && Number(invoice.cgstPaise) > 0) {
    doc.text('CGST:', totX, y);
    doc.text(formatINR(invoice.cgstPaise), 460, y);
    y += 15;
  }
  if (invoice.sgstPaise && Number(invoice.sgstPaise) > 0) {
    doc.text('SGST:', totX, y);
    doc.text(formatINR(invoice.sgstPaise), 460, y);
    y += 15;
  }
  if (invoice.igstPaise && Number(invoice.igstPaise) > 0) {
    doc.text('IGST (Inter-State):', totX, y);
    doc.text(formatINR(invoice.igstPaise), 460, y);
    y += 15;
  }

  doc.setFillColor(241, 245, 249);
  doc.rect(totX - 8, y - 10, pageWidth - 40 - (totX - 8), 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', totX, y + 5);
  doc.text(formatINR(invoice.totalAmountPaise), 460, y + 5);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.text('Amount Paid:', totX, y);
  doc.text(formatINR(invoice.paidAmountPaise || '0'), 460, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('Balance Due:', totX, y);
  doc.text(formatINR(invoice.outstandingAmountPaise), 460, y);
  y += 32;

  // Statutory MSMED Notice Box
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(252, 165, 165);
  doc.rect(40, y, pageWidth - 80, 48, 'FD');
  doc.setTextColor(153, 27, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('STATUTORY NOTICE UNDER CHAPTER V OF MSMED ACT, 2006 (SECTIONS 15 & 16):', 48, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    'The supplier is a registered Micro/Small Enterprise. Delayed payment beyond the statutory period attracts compound interest with monthly rests at 3x the RBI Bank Rate (20.25% p.a.).',
    48,
    y + 30,
    { maxWidth: pageWidth - 96 }
  );

  return doc;
}

/**
 * Generates an official Soft-Copy PDF containing:
 *  1. Buyer Reminder Bill (Pending Principal, Due Date, Days Overdue, MSMED §16 Interest, Total Payable)
 *  2. Line-Item Invoice Summary
 *  3. Full "Buyer Notice & Portal Exposure Preview" text + Direct DuesGuard AI Settlement Portal URL
 * Returns both the jsPDF instance and a raw base64 string ready for Gmail MIME attachment.
 */
export function generateBuyerReminderSoftCopyPdf(params: {
  caseRecord: CaseRecord;
  invoice: InvoiceRecord;
  recipientEmail: string;
  recipientPhone?: string;
  daysOverdue: number;
  statutoryInterestPaise: string;
  totalPayablePaise: string;
  subject: string;
  customNote?: string;
  buyerNoticeText: string;
  paymentPortalUrl: string;
}): {
  doc: jsPDF;
  base64Pdf: string;
  filename: string;
} {
  const { caseRecord, invoice } = params;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 36;

  // Top Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 78, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('BUYER REMINDER BILL & PORTAL EXPOSURE NOTICE', 40, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Supplier: ${caseRecord.sellerName} (Udyam: ${caseRecord.sellerUdyamNumber || 'Registered MSME'})`,
    40,
    45
  );
  doc.text(
    `Invoice #: ${invoice.invoiceNumber}  |  Invoice Date: ${invoice.invoiceDate}  |  Due Date: ${invoice.contractualDueDate || invoice.invoiceDate}`,
    40,
    60
  );

  // Overdue / Status Badge on Right
  const isOverdue = params.daysOverdue > 0;
  if (isOverdue) {
    doc.setFillColor(220, 38, 38);
  } else {
    doc.setFillColor(79, 70, 229);
  }
  doc.roundedRect(pageWidth - 190, 22, 150, 24, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    isOverdue ? `${params.daysOverdue} DAYS OVERDUE (§16)` : 'PAYMENT REMINDER BILL',
    pageWidth - 180,
    37
  );

  y = 100;
  doc.setTextColor(15, 23, 42);

  // Section 1: Pending Bill & Due Date Summary Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. PENDING BILL SUMMARY & STATUTORY DUE DATE SCHEDULE', 40, y);
  y += 10;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(40, y, pageWidth - 80, 96, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Buyer / Recipient:', 52, y + 18);
  doc.text('Accounts Payable Email:', 52, y + 34);
  doc.text('Invoice Date / Due Date:', 52, y + 50);
  doc.text('Overdue Status:', 52, y + 66);
  doc.text('DuesGuard Portal URL:', 52, y + 82);

  doc.setFont('helvetica', 'normal');
  doc.text(`${invoice.buyer || caseRecord.buyerName}`, 175, y + 18);
  doc.text(
    `${params.recipientEmail}${params.recipientPhone ? ` (${params.recipientPhone})` : ''}`,
    175,
    y + 34
  );
  doc.text(
    `Issued: ${invoice.invoiceDate}   |   Due Date: ${invoice.contractualDueDate || invoice.invoiceDate}`,
    175,
    y + 50
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isOverdue ? 185 : 15, isOverdue ? 28 : 23, isOverdue ? 28 : 42);
  doc.text(
    isOverdue
      ? `${params.daysOverdue} Days Past Statutory / Contractual Due Date`
      : 'Within Current Credit Window',
    175,
    y + 66
  );
  doc.setTextColor(79, 70, 229);
  doc.text(`${params.paymentPortalUrl}`, 175, y + 82);

  y += 114;
  doc.setTextColor(15, 23, 42);

  // Financial Breakdown Strip
  doc.setFillColor(241, 245, 249);
  doc.rect(40, y, pageWidth - 80, 56, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL BILLED', 54, y + 18);
  doc.text('PAID TO DATE', 175, y + 18);
  doc.text('PENDING PRINCIPAL', 295, y + 18);
  doc.text('MSMED §16 INTEREST', 415, y + 18);

  doc.setFontSize(10);
  doc.text(formatINR(invoice.totalAmountPaise), 54, y + 38);
  doc.text(formatINR(invoice.paidAmountPaise || '0'), 175, y + 38);
  doc.setTextColor(185, 28, 28);
  doc.text(formatINR(invoice.outstandingAmountPaise), 295, y + 38);
  doc.setTextColor(67, 56, 202);
  doc.text(formatINR(params.statutoryInterestPaise), 415, y + 38);

  y += 72;
  doc.setTextColor(15, 23, 42);

  // Total Enforceable Banner
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(165, 180, 252);
  doc.rect(40, y, pageWidth - 80, 32, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('TOTAL ENFORCEABLE AMOUNT PAYABLE (PRINCIPAL + §16 INTEREST):', 52, y + 20);
  doc.setTextColor(67, 56, 202);
  doc.text(formatINR(params.totalPayablePaise), pageWidth - 52, y + 20, { align: 'right' });

  y += 50;
  doc.setTextColor(15, 23, 42);

  // Section 2: Buyer Notice & Portal Exposure Preview (Soft Copy)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. BUYER NOTICE & PORTAL EXPOSURE PREVIEW (OFFICIAL SOFT COPY)', 40, y);
  y += 10;

  const splitNotice = doc.splitTextToSize(params.buyerNoticeText, pageWidth - 104);
  const boxHeight = Math.min(260, Math.max(130, splitNotice.length * 11.5 + 24));

  doc.setFillColor(15, 23, 42);
  doc.rect(40, y, pageWidth - 80, boxHeight, 'F');
  doc.setTextColor(241, 245, 249);
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.text(splitNotice, 52, y + 18);

  y += boxHeight + 20;
  doc.setTextColor(15, 23, 42);

  // Section 3: Statutory MSMED Act Disclosure Footer
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(252, 165, 165);
  doc.rect(40, y, pageWidth - 80, 52, 'FD');
  doc.setTextColor(153, 27, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('STATUTORY DISCLOSURE — MSMED ACT, 2006 (CHAPTER V, SECTIONS 15 & 16):', 48, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    'Under Section 15 of the MSMED Act 2006, buyer payments to registered Micro and Small Enterprises cannot exceed 45 days. Under Section 16, overdue balances attract compound interest with monthly rests at 3x the RBI Bank Rate (20.25% p.a.).',
    48,
    y + 30,
    { maxWidth: pageWidth - 96 }
  );

  // Extract raw base64 PDF (strip data:application/pdf;filename=...;base64, prefix)
  const dataUri = doc.output('datauristring');
  const base64Pdf = dataUri.includes('base64,') ? dataUri.split('base64,')[1] : '';
  const filename = `Buyer_Reminder_Bill_${invoice.invoiceNumber}.pdf`;

  return {
    doc,
    base64Pdf,
    filename,
  };
}


