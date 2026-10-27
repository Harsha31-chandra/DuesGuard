/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit & Security Tests for DuesGuard AI Demo QR Payment System
 * Covers:
 * 1. QR generation & SHA-256 hash-only storage (no raw token in DB, no internal IDs in URL)
 * 2. Correct invoice resolution & deterministic outstanding balance calculation
 * 3. Invalid token rejection (HTTP 404)
 * 4. Expired token rejection (HTTP 410)
 * 5. Revoked token rejection (HTTP 410)
 * 6. Partial payment demonstration (records DEMO status, updates demo balance only, leaves production untouched)
 * 7. Full payment demonstration (records DEMO status, reduces remaining demo balance to 0)
 * 8. Receipt generation ('DEMO RECEIPT – NO REAL PAYMENT PROCESSED')
 * 9. Cross-organization & RBAC branch access restrictions (HTTP 403)
 * 10. Rate-limiting enforcement (HTTP 429) & Admin Reset Demo Data
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './database.ts';
import { demoQrService, hashPaymentToken } from './demoQrService.ts';

test('1. QR generation creates cryptographic token, stores only SHA-256 hash, and builds clean /demo-pay/[token] URL', async () => {
  db.seedDemoCase();
  demoQrService.clearRateLimits();
  demoQrService.resetDemoPaymentsForCase({
    caseId: 'case-001',
    userId: 'user-harsha-001',
    organizationId: 'org-apex-001',
  });

  const generated = await demoQrService.generateInvoiceQrCode({
    caseId: 'case-001',
    invoiceId: 'inv-101',
    organizationId: 'org-apex-001',
    branchId: 'br-blr-peenya',
    userId: 'user-harsha-001',
    baseUrl: 'https://duesguard.example.com',
    expiresInMinutes: 60,
  });

  assert.ok(generated.tokenId.startsWith('qtk-'));
  assert.ok(generated.paymentUrl.startsWith('https://duesguard.example.com/demo-pay/'));
  assert.ok(generated.qrDataUrl.startsWith('data:image/png;base64,'));
  assert.ok(generated.qrSvg.includes('<svg'));

  // Ensure URL never leaks internal DB identifiers or organization confidential info
  assert.equal(generated.paymentUrl.includes('inv-101'), false);
  assert.equal(generated.paymentUrl.includes('case-001'), false);
  assert.equal(generated.paymentUrl.includes('org-apex-001'), false);

  const rawToken = generated.relativePath.replace('/demo-pay/', '');
  const storedRecord = demoQrService.getStoredTokenRecordById(generated.tokenId);
  assert.ok(storedRecord);
  // Stored record must contain the SHA-256 hash, never the raw token
  assert.equal(storedRecord.tokenHash, hashPaymentToken(rawToken));
  assert.equal(JSON.stringify(storedRecord).includes(rawToken), false);
});

test('2. Buyer scanning resolves correct invoice details and deterministic outstanding balance', async () => {
  db.seedDemoCase();
  demoQrService.clearRateLimits();

  // Add a real external payment of Rs. 10,000 (1000000 paise) to INV-101 (originally Rs. 50,000 = 5000000 paise)
  db.addPayment('case-001', {
    invoiceId: 'inv-101',
    amountPaise: '1000000',
    paymentDate: '2024-02-01',
    paymentMethod: 'NEFT',
    reference: 'UTR-PROD-1001',
  });

  const generated = await demoQrService.generateInvoiceQrCode({
    caseId: 'case-001',
    invoiceId: 'inv-101',
    organizationId: 'org-apex-001',
    branchId: 'br-blr-peenya',
    userId: 'user-harsha-001',
    baseUrl: 'http://localhost:3000',
  });

  const rawToken = generated.relativePath.replace('/demo-pay/', '');
  const buyerView = demoQrService.resolveBuyerPaymentToken(rawToken, {
    clientIp: '10.0.0.10',
  });

  assert.equal(buyerView.invoiceId, 'inv-101');
  assert.equal(buyerView.invoiceNumber, 'INV-101');
  assert.equal(buyerView.sellerName, 'Apex Precision Engineering Pvt Ltd');
  assert.equal(buyerView.buyerName, 'MegaCorp Infrastructure & Projects Ltd');
  assert.equal(buyerView.originalAmountPaise, '5000000'); // Rs. 50,000.00
  assert.equal(buyerView.productionPaidAmountPaise, '1000000'); // Rs. 10,000.00
  assert.equal(buyerView.currentOutstandingPaise, '4000000'); // Rs. 40,000.00 deterministically calculated
  assert.equal(buyerView.demoModeBadge, 'DEMO MODE — NO REAL PAYMENT PROCESSED');

  // Restore clean demo seed
  db.seedDemoCase();
});

test('3. Invalid, expired, and revoked tokens are rejected with appropriate HTTP status codes', async () => {
  db.seedDemoCase();
  demoQrService.clearRateLimits();

  // 3a. Invalid token
  assert.throws(
    () => {
      demoQrService.resolveBuyerPaymentToken('invalid_random_token_1234567890_abcdef');
    },
    (err: any) => err.httpStatus === 404 && err.message.includes('404')
  );

  // 3b. Expired token
  const startNow = 1_700_000_000_000;
  const expiredGen = await demoQrService.generateInvoiceQrCode(
    {
      caseId: 'case-001',
      invoiceId: 'inv-102',
      organizationId: 'org-apex-001',
      userId: 'user-harsha-001',
      expiresInMinutes: 15,
    },
    { nowMs: startNow }
  );
  const expiredRawToken = expiredGen.relativePath.replace('/demo-pay/', '');

  assert.throws(
    () => {
      // 16 minutes later
      demoQrService.resolveBuyerPaymentToken(expiredRawToken, {
        nowMs: startNow + 16 * 60 * 1000,
      });
    },
    (err: any) => err.httpStatus === 410 && err.message.includes('expired')
  );

  // 3c. Revoked token
  const activeGen = await demoQrService.generateInvoiceQrCode({
    caseId: 'case-001',
    invoiceId: 'inv-102',
    organizationId: 'org-apex-001',
    userId: 'user-harsha-001',
    expiresInMinutes: 60,
  });
  const activeRawToken = activeGen.relativePath.replace('/demo-pay/', '');

  demoQrService.revokeQrToken({
    tokenId: activeGen.tokenId,
    organizationId: 'org-apex-001',
    userId: 'user-harsha-001',
  });

  assert.throws(
    () => {
      demoQrService.resolveBuyerPaymentToken(activeRawToken);
    },
    (err: any) => err.httpStatus === 410 && err.message.includes('revoked')
  );
});

test('4. Partial & Full payment demonstrations update isolated demo balance, generate DEMO receipt, and never mutate production financial ledger', async () => {
  db.seedDemoCase();
  demoQrService.clearRateLimits();
  demoQrService.resetDemoPaymentsForCase({
    caseId: 'case-001',
    userId: 'user-harsha-001',
    organizationId: 'org-apex-001',
  });

  // INV-102 is Rs. 30,000.00 (3,000,000 paise)
  const gen = await demoQrService.generateInvoiceQrCode({
    caseId: 'case-001',
    invoiceId: 'inv-102',
    organizationId: 'org-apex-001',
    userId: 'user-harsha-001',
  });
  const rawToken = gen.relativePath.replace('/demo-pay/', '');

  // Step 1: Partial payment demonstration of Rs. 12,000.00 (1,200,000 paise)
  const partialResult = demoQrService.simulateBuyerDemoPayment({
    token: rawToken,
    paymentType: 'partial',
    partialAmountPaise: '1200000',
    payerNote: 'Hackathon Partial Demo Scan',
  });

  assert.equal(partialResult.simulation.status, 'DEMO');
  assert.equal(partialResult.simulation.paymentMode, 'PARTIAL_DEMO');
  assert.equal(partialResult.simulation.previousBalancePaise, '3000000');
  assert.equal(partialResult.simulation.simulatedAmountPaise, '1200000');
  assert.equal(partialResult.simulation.remainingBalancePaise, '1800000');
  assert.equal(partialResult.updatedView.currentOutstandingPaise, '1800000');
  assert.equal(
    partialResult.receipt.receiptTitle,
    'DEMO RECEIPT – NO REAL PAYMENT PROCESSED'
  );
  assert.ok(partialResult.receipt.demoTransactionId.startsWith('DEMO-TXN-'));

  // Verify production invoice in database is 100% untouched (still 3,000,000 paise outstanding, 0 production payments)
  const prodInvoices = db.getInvoices('case-001');
  const prodInv102 = prodInvoices.find((i) => i.id === 'inv-102')!;
  assert.equal(prodInv102.outstandingAmountPaise, '3000000');
  assert.equal(db.getPayments('case-001').length, 0);

  // Step 2: Full payment demonstration for the remaining Rs. 18,000.00 (1,800,000 paise)
  const fullResult = demoQrService.simulateBuyerDemoPayment({
    token: rawToken,
    paymentType: 'full',
  });

  assert.equal(fullResult.simulation.status, 'DEMO');
  assert.equal(fullResult.simulation.paymentMode, 'FULL_DEMO');
  assert.equal(fullResult.simulation.previousBalancePaise, '1800000');
  assert.equal(fullResult.simulation.simulatedAmountPaise, '1800000');
  assert.equal(fullResult.simulation.remainingBalancePaise, '0');
  assert.equal(fullResult.updatedView.currentOutstandingPaise, '0');

  // Step 3: Admin Reset Demo Data restores demo balance back to Rs. 30,000.00
  const resetInfo = demoQrService.resetDemoPaymentsForCase({
    caseId: 'case-001',
    userId: 'user-harsha-001',
    organizationId: 'org-apex-001',
  });
  assert.equal(resetInfo.clearedSimulationsCount, 2);

  const restoredView = demoQrService.resolveBuyerPaymentToken(rawToken);
  assert.equal(restoredView.currentOutstandingPaise, '3000000');
});

test('5. Cross-organization and unauthorized branch access are blocked with HTTP 403', async () => {
  db.seedDemoCase();
  demoQrService.clearRateLimits();

  // 5a. User Ananya (member of org-xyz-003 only) attempting to generate QR for org-apex-001
  await assert.rejects(
    async () => {
      await demoQrService.generateInvoiceQrCode({
        caseId: 'case-001',
        invoiceId: 'inv-101',
        organizationId: 'org-apex-001',
        userId: 'user-ananya-002',
      });
    },
    (err: any) => err.httpStatus === 403 && err.message.includes('403')
  );

  // 5b. User Harsha attempting to access restricted branch br-vizag-02 in org-xyz-003 (only permitted br-chennai-01)
  await assert.rejects(
    async () => {
      await demoQrService.generateInvoiceQrCode({
        caseId: 'case-001',
        invoiceId: 'inv-101',
        organizationId: 'org-xyz-003',
        branchId: 'br-vizag-02',
        userId: 'user-harsha-001',
      });
    },
    (err: any) => err.httpStatus === 403 && err.message.includes('Branch isolation violation')
  );

  // 5c. Explicit cross-organization mismatch between requesting org and case owner org
  await assert.rejects(
    async () => {
      await demoQrService.generateInvoiceQrCode(
        {
          caseId: 'case-001',
          invoiceId: 'inv-101',
          organizationId: 'org-xyz-003',
          branchId: 'br-chennai-01',
          userId: 'user-harsha-001',
        },
        { caseOwnerOrganizationId: 'org-apex-001' }
      );
    },
    (err: any) => err.httpStatus === 403 && err.message.includes('Cross-organization access denied')
  );
});

test('6. Public payment page rate-limiting blocks excessive token scans with HTTP 429', async () => {
  db.seedDemoCase();
  demoQrService.clearRateLimits();
  demoQrService.setRateLimitMaxForTesting(3);

  const gen = await demoQrService.generateInvoiceQrCode({
    caseId: 'case-001',
    invoiceId: 'inv-101',
    organizationId: 'org-apex-001',
    userId: 'user-harsha-001',
  });
  const rawToken = gen.relativePath.replace('/demo-pay/', '');

  // First 3 requests from same IP succeed
  demoQrService.resolveBuyerPaymentToken(rawToken, { clientIp: '203.0.113.55' });
  demoQrService.resolveBuyerPaymentToken(rawToken, { clientIp: '203.0.113.55' });
  demoQrService.resolveBuyerPaymentToken(rawToken, { clientIp: '203.0.113.55' });

  // 4th request within window is rate-limited with 429
  assert.throws(
    () => {
      demoQrService.resolveBuyerPaymentToken(rawToken, { clientIp: '203.0.113.55' });
    },
    (err: any) => err.httpStatus === 429 && err.message.includes('429')
  );

  // Restore default rate limit
  demoQrService.setRateLimitMaxForTesting(35);
  demoQrService.clearRateLimits();
});
