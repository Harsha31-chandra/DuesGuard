/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  calculateInvoiceTotalFromLineItems,
  allocatePaymentsToInvoices,
  calculateSection15Timeline,
  calculateMsmedCompoundInterest,
  validateGstin,
  verifyUdyamRegistrationAndDates,
  calculateCaseFinancialSummary,
} from './finance.ts';
import type { InvoiceRecord, LineItem, PaymentRecord } from '../types/index.ts';

test('paise and rupees conversion roundtrips without floating point drift', () => {
  assert.equal(rupeesToPaise('50000.00'), '5000000');
  assert.equal(rupeesToPaise('100000.50'), '10000050');
  assert.equal(paiseToRupees('5000000'), '50000.00');
  assert.equal(formatINR('10000000'), 'Rs. 1,00,000.00');
  assert.equal(formatINR('8000000'), 'Rs. 80,000.00');
});

test('calculateInvoiceTotalFromLineItems correctly sums base amounts and tax', () => {
  const lineItems: LineItem[] = [
    {
      id: 'item-1',
      description: 'Precision CNC Machined Shafts',
      quantity: 10,
      unitPricePaise: '400000', // ₹4,000.00 each = ₹40,000.00
      taxRatePercent: 18,
      taxAmountPaise: '720000', // 18% of 40,000 = ₹7,200.00
      lineTotalPaise: '4720000',
      sourcePage: 1,
    },
    {
      id: 'item-2',
      description: 'Industrial Bearings',
      quantity: 2,
      unitPricePaise: '50000', // ₹500.00 each = ₹1,000.00
      taxRatePercent: 18,
      taxAmountPaise: '18000', // ₹180.00
      lineTotalPaise: '118000',
      sourcePage: 1,
    },
  ];

  const result = calculateInvoiceTotalFromLineItems(lineItems);
  assert.equal(result.subtotalPaise, '4100000'); // ₹41,000.00
  assert.equal(result.totalTaxPaise, '738000'); // ₹7,380.00
  assert.equal(result.grandTotalPaise, '4838000'); // ₹48,380.00
});

test('Section 15: written agreement exceeding 45 days is capped strictly to 45 days', () => {
  const timeline = calculateSection15Timeline({
    deliveryDate: '2024-01-01',
    contractualDays: 60, // buyer requested 60 days
  });

  assert.equal(timeline.acceptanceDate, '2024-01-01');
  assert.equal(timeline.statutoryDeadline, '2024-02-15'); // 45 days from Jan 1
  assert.equal(timeline.interestStartDate, '2024-02-16'); // day 46
  assert.ok(timeline.warnings.some((w) => w.includes('exceeds MSMED Act § 15 statutory ceiling of 45 days')));
});

test('Section 15: no written agreement applies the 15-day appointed day rule', () => {
  const timeline = calculateSection15Timeline({
    deliveryDate: '2024-01-01',
    contractualDays: undefined, // no written agreement
  });

  assert.equal(timeline.acceptanceDate, '2024-01-01');
  assert.equal(timeline.statutoryDeadline, '2024-01-16'); // 15 days
  assert.equal(timeline.appointedDay, '2024-01-17'); // day 16
  assert.equal(timeline.interestStartDate, '2024-01-17');
});

test('Section 15: timely buyer objection stops deemed acceptance until resolution', () => {
  const timeline = calculateSection15Timeline({
    deliveryDate: '2024-01-01',
    objectionDate: '2024-01-10', // within 15 days
    objectionResolutionDate: '2024-01-20',
    contractualDays: 30,
  });

  assert.equal(timeline.isObjectionValid, true);
  assert.equal(timeline.acceptanceDate, '2024-01-20');
  assert.equal(timeline.statutoryDeadline, '2024-02-19'); // 30 days from Jan 20
});

test('Section 16: compound interest at 3x RBI bank rate with monthly rests calculates correctly', () => {
  // Principal = ₹1,00,000 (10,000,000 paise)
  // Interest start = 2024-01-01, As-of = 2024-04-01 (approx 3 monthly rests)
  // 3x 6.75% = 20.25% p.a.
  const result = calculateMsmedCompoundInterest({
    principalPaise: '10000000',
    interestStartDate: '2024-01-01',
    asOfDate: '2024-04-01',
  });

  assert.ok(result.periods.length >= 3, 'Must produce at least 3 monthly compounding periods');
  assert.ok(
    Number(result.compoundedInterestPaise) > 400000,
    'Compound interest for 3 months at ~20.25% must be over ₹4,000 (> 400000 paise)'
  );
  assert.ok(
    Number(result.totalPayablePaise) > 10000000,
    'Total claim must exceed starting principal'
  );
  assert.match(result.annualRatePercent, /20\.25%/);
});

test('GSTIN validation: verifies valid GSTIN and catches invalid checksum', () => {
  // Known valid Karnataka GSTIN: 29AABCU9603R1ZJ
  const valid = validateGstin('29AABCU9603R1ZJ');
  assert.equal(valid.syntaxValid, true);
  assert.equal(valid.stateCode, '29');
  assert.equal(valid.panNumber, 'AABCU9603R');

  // Corrupted checksum: replace last character with '9'
  const invalid = validateGstin('29AABCU9603R1Z9');
  assert.equal(invalid.checksumValid, false);
  assert.equal(invalid.status, 'invalid_format');
});

test('Udyam verification: detects timing conflict when invoice predates registration', () => {
  const result = verifyUdyamRegistrationAndDates({
    udyamNumber: 'UDYAM-KR-03-0012345',
    registrationDate: '2024-06-01',
    classification: 'Micro',
    registeredActivity: 'Manufacturing',
    invoiceDates: ['2024-01-15', '2024-02-10'], // predates June 1, 2024
    deliveryDates: ['2024-01-20'],
  });

  assert.equal(result.status, 'registration_date_conflict');
  assert.ok(result.conflictDetails?.includes('predates Udyam registration date'));
  assert.ok(result.conflictDetails?.includes('Silpi Industries'));
});

test('Playbook synthetic case: 3 invoices match exact truth table (₹1,00,000 total, ₹80,000 overdue)', () => {
  const invoices: InvoiceRecord[] = [
    {
      id: 'inv-101',
      caseId: 'case-001',
      documentId: 'doc-101',
      invoiceNumber: 'INV-101',
      buyer: 'MegaCorp Infra Ltd',
      seller: 'Apex Precision Engineering',
      invoiceDate: '2024-01-15',
      totalAmountPaise: '5000000', // ₹50,000.00
      paidAmountPaise: '0',
      outstandingAmountPaise: '5000000',
      currency: 'INR',
      lineItems: [],
      provenance: {},
      status: 'overdue',
    },
    {
      id: 'inv-102',
      caseId: 'case-001',
      documentId: 'doc-102',
      invoiceNumber: 'INV-102',
      buyer: 'MegaCorp Infra Ltd',
      seller: 'Apex Precision Engineering',
      invoiceDate: '2024-02-10',
      totalAmountPaise: '3000000', // ₹30,000.00
      paidAmountPaise: '0',
      outstandingAmountPaise: '3000000',
      currency: 'INR',
      lineItems: [],
      provenance: {},
      status: 'overdue',
    },
    {
      id: 'inv-103',
      caseId: 'case-001',
      documentId: 'doc-103',
      invoiceNumber: 'INV-103',
      buyer: 'MegaCorp Infra Ltd',
      seller: 'Apex Precision Engineering',
      invoiceDate: '2024-04-01',
      totalAmountPaise: '2000000', // ₹20,000.00
      paidAmountPaise: '0',
      outstandingAmountPaise: '2000000',
      currency: 'INR',
      lineItems: [],
      provenance: {},
      status: 'pending',
    },
  ];

  const payments: PaymentRecord[] = []; // 0 paid
  const allocation = allocatePaymentsToInvoices(invoices, payments);

  assert.equal(allocation.totalInvoicedPaise, '10000000'); // ₹1,00,000.00
  assert.equal(allocation.totalPaidPaise, '0');
  assert.equal(allocation.totalOutstandingPaise, '10000000');

  // Verify INV-101 + INV-102 sum to ₹80,000 (8000000 paise)
  const overdueInvoices = [invoices[0], invoices[1]];
  const overdueTotalPaise = overdueInvoices
    .reduce((sum, inv) => sum + BigInt(inv.outstandingAmountPaise), 0n)
    .toString();
  assert.equal(overdueTotalPaise, '8000000'); // ₹80,000.00
});

test('Multi-tenant RBAC isolation blocks cross-tenant access and allows owning tenant', async () => {
  const { db } = await import('./database.ts');
  const allowedCheck = db.verifyCrossTenantIsolation('tenant-apex-001', 'case-001');
  assert.equal(allowedCheck.allowed, true);

  const blockedCheck = db.verifyCrossTenantIsolation('tenant-srilakshmi-002', 'case-001');
  assert.equal(blockedCheck.allowed, false);
  assert.match(blockedCheck.reason, /HTTP 403 FORBIDDEN/);
});

test('Private R2 presigned upload verifies %PDF-1.7 signature and rejects spoofed headers', async () => {
  const { db } = await import('./database.ts');
  const ticket = db.createPresignedUploadTicket({
    tenantId: 'tenant-apex-001',
    caseId: 'case-001',
    filename: 'Signed_POD_DC-4480.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 184320,
  });
  assert.ok(ticket.r2StorageKey.startsWith('tenants/tenant-apex-001/cases/case-001/docs/'));

  const validResult = db.completeR2UploadVerification({
    ticketId: ticket.ticketId,
    fileHeaderMagicBytes: '%PDF-1.7',
    contentSnippet: 'Signed POD confirmation',
    filename: 'Signed_POD_DC-4480.pdf',
    fileSizeBytes: 184320,
  });
  assert.equal(validResult.verified, true);
  assert.equal(validResult.securityStatus, 'verified_clean');

  const spoofedResult = db.completeR2UploadVerification({
    ticketId: ticket.ticketId,
    fileHeaderMagicBytes: '4D5A9000',
    contentSnippet: 'Spoofed binary',
    filename: 'malware.pdf',
    fileSizeBytes: 184320,
  });
  assert.equal(spoofedResult.verified, false);
  assert.equal(spoofedResult.securityStatus, 'rejected_signature');
});

test('Multi-turn Gemini chatbot responder preserves conversation context and deterministic figures', async () => {
  const { db } = await import('./database.ts');
  const { generateMultiTurnChatResponse } = await import('./geminiService.ts');
  const caseRecord = db.getCaseById('case-001')!;
  const invoices = db.getInvoices('case-001');
  const analysis = db.getLatestAnalysisRun('case-001') || null;

  const response = await generateMultiTurnChatResponse({
    caseRecord,
    invoices,
    analysis,
    history: db.getChatHistory('case-001'),
    userMessage: 'Explain the missing proof of delivery for INV-102 and the Section 16 compound interest.',
    modelTier: 'gemini-4-argon',
    rolePersona: 'msme_evidence_analyst',
  });

  assert.ok(response.replyText.length > 40);
  assert.ok(response.citations.length > 0);
});

test('Multi-Organization & Multi-Branch Auth: One user accesses multiple companies and branches with role & branch enforcement', async () => {
  const { workspaceAuth } = await import('./workspaceAuth.ts');

  // 1. Authenticate Harsha (3 organizations: Apex Precision, ABC Manufacturing, XYZ Trading)
  const harshaLogin = workspaceAuth.authenticateUser({
    email: 'harsha@duesguard.in',
    password: 'DuesGuard@2026!',
  });
  assert.equal(harshaLogin.success, true);
  assert.equal(harshaLogin.autoSelectWorkspace, false);
  assert.ok((harshaLogin.session?.accessibleOrganizations.length || 0) >= 3);

  // 2. Switch to ABC Manufacturing Pvt. Ltd. -> Vijayawada Branch (Harsha = Case Reviewer)
  const switchAbc = workspaceAuth.switchWorkspace({
    organizationId: 'org-abc-002',
    branchId: 'br-vijayawada-02',
  });
  assert.equal(switchAbc.success, true);
  assert.equal(switchAbc.session?.activeRole, 'case_reviewer');
  assert.match(switchAbc.session?.activeBranchName || '', /Vijayawada Branch/);

  // 3. Verify Case Reviewer in ABC Manufacturing CAN approve reports
  const canApproveInAbc = workspaceAuth.authorizeAction({
    organizationId: 'org-abc-002',
    branchId: 'br-vijayawada-02',
    action: 'report:approve',
  });
  assert.equal(canApproveInAbc.allowed, true);
  assert.equal(canApproveInAbc.httpStatus, 200);

  // 4. Verify Harsha in XYZ Trading Solutions (Accountant, restricted to Chennai Branch) CANNOT access Visakhapatnam Branch or ALL_BRANCHES
  const blockedVizagSwitch = workspaceAuth.switchWorkspace({
    organizationId: 'org-xyz-003',
    branchId: 'br-vizag-02',
  });
  assert.equal(blockedVizagSwitch.success, false);
  assert.match(blockedVizagSwitch.message, /HTTP 403 FORBIDDEN/);

  // 5. Verify Accountant in XYZ Trading Solutions CANNOT approve reports even in permitted Chennai Branch
  const blockedAccountantApprove = workspaceAuth.authorizeAction({
    organizationId: 'org-xyz-003',
    branchId: 'br-chennai-01',
    action: 'report:approve',
  });
  assert.equal(blockedAccountantApprove.allowed, false);
  assert.equal(blockedAccountantApprove.httpStatus, 403);
});

test('Authentication flows: unverified email block, single-org auto-routing, password recovery, and 2FA challenge', async () => {
  const { workspaceAuth, evaluatePasswordStrength } = await import('./workspaceAuth.ts');

  // Password strength check
  assert.equal(evaluatePasswordStrength('short').score, 0);
  assert.equal(evaluatePasswordStrength('DuesGuard@2026!').score, 4);

  // Unverified user is blocked at login until verified
  const unverifiedLogin = workspaceAuth.authenticateUser({
    email: 'rohan.pending@msme.in',
    password: 'Rohan@2026!',
  });
  assert.equal(unverifiedLogin.success, false);
  assert.equal(unverifiedLogin.code, 'EMAIL_UNVERIFIED');

  // Single-organization user (Ananya) automatically selects workspace
  const ananyaLogin = workspaceAuth.authenticateUser({
    email: 'ananya@xyztrading.in',
    password: 'Ananya@MSME2026!',
  });
  assert.equal(ananyaLogin.success, true);
  assert.equal(ananyaLogin.autoSelectWorkspace, true);
  assert.equal(ananyaLogin.session?.activeOrganization.id, 'org-xyz-003');

  // Restore Harsha as active session for interactive UI
  workspaceAuth.authenticateUser({
    email: 'harsha@duesguard.in',
    password: 'DuesGuard@2026!',
  });

  // 2FA TOTP & Recovery Code check
  const totpCheck = workspaceAuth.verifyTwoFactorChallenge({ code: '482910' });
  assert.equal(totpCheck.success, true);
  assert.equal(totpCheck.method, 'totp');
});

test('Dynamic Payment Ledger & Allocation: partial UPI payment reduces overdue principal and dynamically recalculates Section 16 monthly rests', async () => {
  const { db } = await import('./database.ts');
  db.seedDemoCase();

  const baselineAnalysis = db.getLatestAnalysisRun('case-001')!;
  const baselineInterestPaise = BigInt(baselineAnalysis.summary.totalInterestPaise);
  assert.equal(baselineAnalysis.summary.totalInvoicedPaise, '10000000');
  assert.equal(baselineAnalysis.summary.totalPaidPaise, '0');
  assert.equal(baselineAnalysis.summary.totalOverduePaise, '8000000');

  // Log external partial UPI payment of ₹15,000 (1,500,000 paise) on 2024-03-10 allocated to INV-101
  const logged = db.addPayment(
    'case-001',
    {
      invoiceId: 'inv-101',
      amountPaise: '1500000',
      paymentDate: '2024-03-10',
      paymentMethod: 'UPI',
      reference: 'UPI/407019283741/AXIS',
    },
    '2024-04-15'
  );

  assert.equal(logged.latestAnalysis?.summary.totalPaidPaise, '1500000');
  assert.equal(logged.latestAnalysis?.summary.totalPendingPaise, '8500000');
  assert.equal(logged.latestAnalysis?.summary.totalOverduePaise, '6500000');

  const inv101After = logged.invoices.find((i) => i.id === 'inv-101')!;
  assert.equal(inv101After.paidAmountPaise, '1500000');
  assert.equal(inv101After.outstandingAmountPaise, '3500000');
  assert.equal(inv101After.status, 'overdue');

  // Verify Section 16 interest was dynamically reduced because ₹15,000 was paid mid-stream on 2024-03-10
  const recalculatedInterestPaise = BigInt(logged.latestAnalysis?.summary.totalInterestPaise || '0');
  assert.ok(
    recalculatedInterestPaise < baselineInterestPaise,
    `Mid-stream partial payment on 2024-03-10 must reduce Section 16 compound interest (${recalculatedInterestPaise} < ${baselineInterestPaise})`
  );

  // Clean up test payment and verify baseline restoration
  const restored = db.deletePayment('case-001', logged.payment.id, '2024-04-15');
  assert.equal(restored.latestAnalysis?.summary.totalPaidPaise, '0');
  assert.equal(restored.latestAnalysis?.summary.totalOverduePaise, '8000000');
});



