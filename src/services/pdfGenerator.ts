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
