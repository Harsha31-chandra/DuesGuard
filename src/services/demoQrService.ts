/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Invoice-Linked Demo QR Payment & Simulation Service
 *
 * CRITICAL SECURITY & PRODUCT BOUNDARY:
 * 1. Hackathon demonstration feature ONLY — never processes real payments or integrates gateways.
 * 2. Generates 256-bit cryptographically random tokens (`crypto.randomBytes(32)`).
 * 3. Stores ONLY the SHA-256 hex digest (`tokenHash`) in the database — raw token is never persisted.
 * 4. Calculates outstanding invoice balances deterministically using `decimal.js` and `allocatePaymentsToInvoices`.
 * 5. Records simulated payments strictly with `status: 'DEMO'` in an isolated store so production
 *    MSMED Section 15 & 16 calculations are never polluted by demo scans.
 */

import crypto from 'node:crypto';
import Decimal from 'decimal.js';
import QRCode from 'qrcode';
import { z } from 'zod';
import type {
  DemoInvoicePaymentView,
  DemoPaymentReceiptData,
  DemoPaymentSimulationRecord,
  DemoQrTokenRecord,
} from '../types/index.ts';
import { db } from './database.ts';
import { allocatePaymentsToInvoices, formatINR } from './finance.ts';
import { workspaceAuth, ROLE_LABELS } from './workspaceAuth.ts';

// Configure Decimal precision to match finance.ts
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

export const GenerateQrRequestSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
  invoiceId: z.string().min(1, 'invoiceId is required'),
  organizationId: z.string().min(1, 'organizationId is required').optional(),
  branchId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  baseUrl: z.string().url('Valid application baseUrl is required').optional(),
  expiresInMinutes: z.number().int().min(1).max(1440).default(60),
});

export const TokenParamSchema = z.object({
  token: z
    .string()
    .min(24, 'Invalid payment token format')
    .max(128, 'Invalid payment token length')
    .regex(/^[A-Za-z0-9_-]+$/, 'Token must be URL-safe base64url'),
});

export const SimulateDemoPaymentSchema = z
  .object({
    token: z
      .string()
      .min(24, 'Invalid payment token format')
      .max(128, 'Invalid payment token length')
      .regex(/^[A-Za-z0-9_-]+$/, 'Token must be URL-safe base64url'),
    paymentType: z.enum(['full', 'partial']),
    partialAmountPaise: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => (val !== undefined && val !== '' ? String(val) : undefined)),
    payerNote: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentType === 'partial') {
      if (!data.partialAmountPaise) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Partial payment amount is required when paymentType is partial.',
          path: ['partialAmountPaise'],
        });
        return;
      }
      const parsed = Number(data.partialAmountPaise);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Partial payment amount in paise must be a positive integer.',
          path: ['partialAmountPaise'],
        });
      }
    }
  });

export const RevokeQrTokenSchema = z.object({
  tokenId: z.string().min(1, 'tokenId is required'),
  organizationId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
});

export const ResetDemoQrDataSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
  invoiceId: z.string().optional(),
  organizationId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
});

// ============================================================================
// CRYPTOGRAPHIC HELPERS
// ============================================================================

export function generateSecurePaymentToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashPaymentToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashPaymentToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// ============================================================================
// DEMO QR PAYMENT SERVICE
// ============================================================================

class DemoQrPaymentService {
  // Keyed by tokenId — stores ONLY tokenHash, never rawToken
  private tokensById: Map<string, DemoQrTokenRecord> = new Map();
  // Index from tokenHash -> tokenId for O(1) lookup
  private tokenIdByHash: Map<string, string> = new Map();
  // Isolated demonstration payment records keyed by `${caseId}:${invoiceId}`
  private demoSimulationsByInvoice: Map<string, DemoPaymentSimulationRecord[]> = new Map();
  // Sliding-window rate limiter keyed by client identifier (IP)
  private rateLimitLog: Map<string, number[]> = new Map();
  private rateLimitWindowMs = 60_000; // 1 minute
  private maxRequestsPerWindow = 35;

  /**
   * Enforce sliding-window rate limit for public buyer payment endpoints
   */
  public checkRateLimit(clientKey: string = 'anonymous-ip', nowMs: number = Date.now()): {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
  } {
    const timestamps = this.rateLimitLog.get(clientKey) || [];
    const windowStart = nowMs - this.rateLimitWindowMs;
    const recent = timestamps.filter((t) => t > windowStart);

    if (recent.length >= this.maxRequestsPerWindow) {
      const oldestInWindow = recent[0] || nowMs;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldestInWindow + this.rateLimitWindowMs - nowMs) / 1000)
      );
      this.rateLimitLog.set(clientKey, recent);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    recent.push(nowMs);
    this.rateLimitLog.set(clientKey, recent);
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequestsPerWindow - recent.length),
      retryAfterSeconds: 0,
    };
  }

  public setRateLimitMaxForTesting(maxRequests: number) {
    this.maxRequestsPerWindow = maxRequests;
  }

  public clearRateLimits() {
    this.rateLimitLog.clear();
  }

  /**
   * Verify Organization & Branch RBAC permissions for QR creation/management
   */
  public verifyQrManagementAccess(params: {
    userId?: string;
    organizationId?: string;
    branchId?: string;
    caseOwnerOrganizationId?: string;
  }): {
    allowed: boolean;
    httpStatus: 200 | 401 | 403;
    organizationId: string;
    branchId: string;
    userId: string;
    reason: string;
  } {
    const activeSession = workspaceAuth.getActiveWorkspaceSession(params.userId);
    const targetOrgId = params.organizationId || activeSession.activeOrganization.id;
    const targetBranchId = params.branchId || activeSession.activeBranchId;
    const targetUserId = params.userId || activeSession.user.id;

    // Cross-organization check if case explicitly belongs to a different organization
    if (
      params.caseOwnerOrganizationId &&
      params.organizationId &&
      params.caseOwnerOrganizationId !== params.organizationId
    ) {
      return {
        allowed: false,
        httpStatus: 403,
        organizationId: targetOrgId,
        branchId: targetBranchId,
        userId: targetUserId,
        reason: `HTTP 403 FORBIDDEN: Cross-organization access denied. Organization '${params.organizationId}' cannot generate or manage QR tokens for invoice belonging to '${params.caseOwnerOrganizationId}'.`,
      };
    }

    // Check membership and branch scope in workspaceAuth
    const caseViewAuth = workspaceAuth.authorizeAction({
      userId: targetUserId,
      organizationId: targetOrgId,
      branchId: targetBranchId,
      action: 'case:view',
    });

    if (!caseViewAuth.allowed) {
      return {
        allowed: false,
        httpStatus: caseViewAuth.httpStatus,
        organizationId: targetOrgId,
        branchId: targetBranchId,
        userId: targetUserId,
        reason: caseViewAuth.reason,
      };
    }

    // Read-only role cannot generate or revoke payment QR tokens
    if (caseViewAuth.role === 'read_only') {
      return {
        allowed: false,
        httpStatus: 403,
        organizationId: targetOrgId,
        branchId: targetBranchId,
        userId: targetUserId,
        reason: `HTTP 403 FORBIDDEN: Role '${ROLE_LABELS[caseViewAuth.role]}' is read-only and not permitted to generate or manage invoice QR payment tokens.`,
      };
    }

    return {
      allowed: true,
      httpStatus: 200,
      organizationId: targetOrgId,
      branchId: targetBranchId,
      userId: targetUserId,
      reason: `Authorized QR token management for ${targetOrgId} (${targetBranchId}).`,
    };
  }

  /**
   * Deterministically calculate invoice balances from database records + isolated demo simulations.
   * Never mutates production payment ledger.
   */
  public computeDeterministicInvoiceBalance(caseId: string, invoiceId: string): {
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    organizationId: string;
    sellerName: string;
    buyerName: string;
    originalAmountPaise: string;
    productionPaidAmountPaise: string;
    demoSimulatedPaidPaise: string;
    totalAlreadyPaidPaise: string;
    currentOutstandingPaise: string;
    currency: string;
    simulatedTransactions: DemoPaymentSimulationRecord[];
  } {
    const caseRecord = db.getCaseById(caseId);
    if (!caseRecord) {
      throw new Error(`Case '${caseId}' not found in database.`);
    }

    const rawInvoices = db.getInvoices(caseId);
    const productionPayments = db.getPayments(caseId);

    // Run deterministic allocation on production invoices & payments
    const allocation = allocatePaymentsToInvoices(rawInvoices, productionPayments);
    const targetInvoice = allocation.invoicesWithBalances.find((inv) => inv.id === invoiceId);

    if (!targetInvoice) {
      throw new Error(`Invoice '${invoiceId}' not found in case '${caseId}'.`);
    }

    const originalDecimal = new Decimal(targetInvoice.totalAmountPaise || '0');
    const prodPaidDecimal = new Decimal(targetInvoice.paidAmountPaise || '0');

    // Sum isolated DEMO simulated transactions for this invoice
    const simKey = `${caseId}:${invoiceId}`;
    const simulatedTransactions = this.demoSimulationsByInvoice.get(simKey) || [];
    let demoPaidDecimal = new Decimal(0);
    for (const sim of simulatedTransactions) {
      if (sim.status === 'DEMO') {
        demoPaidDecimal = demoPaidDecimal.plus(new Decimal(sim.simulatedAmountPaise));
      }
    }

    const totalAlreadyPaidDecimal = Decimal.min(
      originalDecimal,
      prodPaidDecimal.plus(demoPaidDecimal)
    );
    const currentOutstandingDecimal = Decimal.max(
      new Decimal(0),
      originalDecimal.minus(totalAlreadyPaidDecimal)
    );

    const activeSession = workspaceAuth.getActiveWorkspaceSession();
    const organizationId =
      caseRecord.tenantId || activeSession?.activeOrganization?.id || 'org-apex-001';

    return {
      invoiceId: targetInvoice.id,
      invoiceNumber: targetInvoice.invoiceNumber,
      invoiceDate: targetInvoice.invoiceDate,
      organizationId,
      sellerName: targetInvoice.seller || caseRecord.sellerName || caseRecord.businessName,
      buyerName: targetInvoice.buyer || caseRecord.buyerName,
      originalAmountPaise: originalDecimal.toFixed(0),
      productionPaidAmountPaise: prodPaidDecimal.toFixed(0),
      demoSimulatedPaidPaise: demoPaidDecimal.toFixed(0),
      totalAlreadyPaidPaise: totalAlreadyPaidDecimal.toFixed(0),
      currentOutstandingPaise: currentOutstandingDecimal.toFixed(0),
      currency: targetInvoice.currency || 'INR',
      simulatedTransactions: [...simulatedTransactions],
    };
  }

  /**
   * Generate a cryptographically random QR payment token, store ONLY its SHA-256 hash,
   * and render the QR code pointing to `/demo-pay/[secure-token]`.
   */
  public async generateInvoiceQrCode(
    input: z.input<typeof GenerateQrRequestSchema>,
    options?: { caseOwnerOrganizationId?: string; nowMs?: number }
  ): Promise<{
    tokenId: string;
    paymentUrl: string;
    relativePath: string;
    qrDataUrl: string;
    qrSvg: string;
    expiresAt: string;
    invoiceSummary: DemoInvoicePaymentView;
  }> {
    const parsed = GenerateQrRequestSchema.parse(input);
    const nowMs = options?.nowMs ?? Date.now();

    // Enforce RBAC and cross-organization security boundary
    const access = this.verifyQrManagementAccess({
      userId: parsed.userId,
      organizationId: parsed.organizationId,
      branchId: parsed.branchId,
      caseOwnerOrganizationId: options?.caseOwnerOrganizationId,
    });

    if (!access.allowed) {
      const err: any = new Error(access.reason);
      err.httpStatus = access.httpStatus;
      throw err;
    }

    // Calculate live deterministic invoice balance
    const balance = this.computeDeterministicInvoiceBalance(parsed.caseId, parsed.invoiceId);

    // Generate cryptographically random token and store ONLY its SHA-256 hash
    const { rawToken, tokenHash } = generateSecurePaymentToken();
    const tokenId = `qtk-${nowMs}-${crypto.randomBytes(3).toString('hex')}`;
    const expiresAt = new Date(nowMs + parsed.expiresInMinutes * 60 * 1000).toISOString();

    const record: DemoQrTokenRecord = {
      id: tokenId,
      tokenHash,
      organizationId: access.organizationId,
      branchId: access.branchId,
      caseId: parsed.caseId,
      invoiceId: parsed.invoiceId,
      createdByUserId: access.userId,
      expiresAt,
      status: 'active',
      createdAt: new Date(nowMs).toISOString(),
    };

    this.tokensById.set(tokenId, record);
    this.tokenIdByHash.set(tokenHash, tokenId);

    const cleanBaseUrl = (parsed.baseUrl || 'http://localhost:3000').replace(/\/+$/, '');
    const relativePath = `/demo-pay/${rawToken}`;
    const paymentUrl = `${cleanBaseUrl}${relativePath}`;

    // Generate QR Code Data URL and SVG using `qrcode` package
    const qrDataUrl = await QRCode.toDataURL(paymentUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#09090b',
        light: '#ffffff',
      },
    });

    const qrSvg = await QRCode.toString(paymentUrl, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    const invoiceSummary: DemoInvoicePaymentView = {
      tokenId,
      ...balance,
      expiresAt,
      tokenStatus: 'active',
      demoModeBadge: 'DEMO MODE — NO REAL PAYMENT PROCESSED',
    };

    return {
      tokenId,
      paymentUrl,
      relativePath,
      qrDataUrl,
      qrSvg,
      expiresAt,
      invoiceSummary,
    };
  }

  /**
   * Resolve and validate a buyer's scanned QR token on the server.
   * Checks SHA-256 token hash, revocation status, and expiration timestamp.
   */
  public resolveBuyerPaymentToken(
    rawTokenInput: string,
    options?: { clientIp?: string; nowMs?: number }
  ): DemoInvoicePaymentView {
    const nowMs = options?.nowMs ?? Date.now();
    const rateCheck = this.checkRateLimit(options?.clientIp || 'public-scanner', nowMs);
    if (!rateCheck.allowed) {
      const err: any = new Error(
        `HTTP 429 TOO MANY REQUESTS: Rate limit exceeded for public payment page. Please retry in ${rateCheck.retryAfterSeconds}s.`
      );
      err.httpStatus = 429;
      throw err;
    }

    const parsedToken = TokenParamSchema.safeParse({ token: rawTokenInput });
    if (!parsedToken.success) {
      const err: any = new Error('HTTP 404 NOT FOUND: Invalid or malformed QR payment token.');
      err.httpStatus = 404;
      throw err;
    }

    const tokenHash = hashPaymentToken(parsedToken.data.token);
    const tokenId = this.tokenIdByHash.get(tokenHash);
    const record = tokenId ? this.tokensById.get(tokenId) : undefined;

    if (!record) {
      const err: any = new Error('HTTP 404 NOT FOUND: Payment request token not found.');
      err.httpStatus = 404;
      throw err;
    }

    if (record.status === 'revoked' || record.revokedAt) {
      const err: any = new Error(
        'HTTP 410 GONE: This QR payment request link has been revoked by the seller organization.'
      );
      err.httpStatus = 410;
      throw err;
    }

    if (new Date(record.expiresAt).getTime() <= nowMs || record.status === 'expired') {
      record.status = 'expired';
      const err: any = new Error(
        'HTTP 410 GONE: This QR payment request link has expired. Please request a fresh QR code from the seller.'
      );
      err.httpStatus = 410;
      throw err;
    }

    const balance = this.computeDeterministicInvoiceBalance(record.caseId, record.invoiceId);

    return {
      tokenId: record.id,
      ...balance,
      organizationId: record.organizationId,
      expiresAt: record.expiresAt,
      tokenStatus: record.status,
      demoModeBadge: 'DEMO MODE — NO REAL PAYMENT PROCESSED',
    };
  }

  /**
   * Execute a simulated Full or Partial Payment Demonstration.
   * Records transaction strictly with `status: 'DEMO'` and returns receipt data.
   */
  public simulateBuyerDemoPayment(
    input: z.input<typeof SimulateDemoPaymentSchema>,
    options?: { clientIp?: string; nowMs?: number }
  ): {
    simulation: DemoPaymentSimulationRecord;
    updatedView: DemoInvoicePaymentView;
    receipt: DemoPaymentReceiptData;
  } {
    const nowMs = options?.nowMs ?? Date.now();
    const parsed = SimulateDemoPaymentSchema.parse(input);

    // First validate token (includes rate limit, hash lookup, revocation & expiry check)
    const currentView = this.resolveBuyerPaymentToken(parsed.token, {
      clientIp: options?.clientIp,
      nowMs,
    });

    const previousBalanceDecimal = new Decimal(currentView.currentOutstandingPaise);
    if (previousBalanceDecimal.lte(0)) {
      const err: any = new Error(
        'HTTP 400 BAD REQUEST: This invoice already has zero outstanding balance in the demonstration environment.'
      );
      err.httpStatus = 400;
      throw err;
    }

    let simulatedAmountDecimal: Decimal;
    if (parsed.paymentType === 'full') {
      simulatedAmountDecimal = previousBalanceDecimal;
    } else {
      simulatedAmountDecimal = new Decimal(parsed.partialAmountPaise || '0');
      if (simulatedAmountDecimal.gt(previousBalanceDecimal)) {
        const err: any = new Error(
          `HTTP 400 BAD REQUEST: Partial demonstration payment (${formatINR(simulatedAmountDecimal.toFixed(0))}) cannot exceed current outstanding balance (${formatINR(previousBalanceDecimal.toFixed(0))}).`
        );
        err.httpStatus = 400;
        throw err;
      }
    }

    const remainingBalanceDecimal = previousBalanceDecimal.minus(simulatedAmountDecimal);
    const tokenRecord = this.tokensById.get(currentView.tokenId)!;

    const dateStamp = new Date(nowMs).toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const demoTxnId = `DEMO-TXN-${dateStamp}-${randomSuffix}`;

    const simulation: DemoPaymentSimulationRecord = {
      id: demoTxnId,
      tokenId: tokenRecord.id,
      organizationId: tokenRecord.organizationId,
      caseId: tokenRecord.caseId,
      invoiceId: tokenRecord.invoiceId,
      invoiceNumber: currentView.invoiceNumber,
      paymentMode: parsed.paymentType === 'full' ? 'FULL_DEMO' : 'PARTIAL_DEMO',
      simulatedAmountPaise: simulatedAmountDecimal.toFixed(0),
      previousBalancePaise: previousBalanceDecimal.toFixed(0),
      remainingBalancePaise: remainingBalanceDecimal.toFixed(0),
      status: 'DEMO',
      payerNote:
        parsed.payerNote?.trim() ||
        'Simulated hackathon buyer QR scan — no real bank or UPI transfer executed.',
      simulatedAt: new Date(nowMs).toISOString(),
    };

    const simKey = `${tokenRecord.caseId}:${tokenRecord.invoiceId}`;
    const existingList = this.demoSimulationsByInvoice.get(simKey) || [];
    existingList.push(simulation);
    this.demoSimulationsByInvoice.set(simKey, existingList);

    const updatedBalance = this.computeDeterministicInvoiceBalance(
      tokenRecord.caseId,
      tokenRecord.invoiceId
    );

    const updatedView: DemoInvoicePaymentView = {
      tokenId: tokenRecord.id,
      ...updatedBalance,
      organizationId: tokenRecord.organizationId,
      expiresAt: tokenRecord.expiresAt,
      tokenStatus: tokenRecord.status,
      demoModeBadge: 'DEMO MODE — NO REAL PAYMENT PROCESSED',
    };

    const receipt: DemoPaymentReceiptData = {
      receiptTitle: 'DEMO RECEIPT – NO REAL PAYMENT PROCESSED',
      demoTransactionId: simulation.id,
      invoiceNumber: currentView.invoiceNumber,
      sellerName: currentView.sellerName,
      buyerName: currentView.buyerName,
      paymentMode: simulation.paymentMode,
      previousBalancePaise: simulation.previousBalancePaise,
      simulatedPaymentAmountPaise: simulation.simulatedAmountPaise,
      remainingBalancePaise: simulation.remainingBalancePaise,
      status: 'DEMO',
      simulatedAt: simulation.simulatedAt,
      payerNote: simulation.payerNote,
      disclaimer:
        'DEMO RECEIPT – NO REAL PAYMENT PROCESSED. This document is generated strictly for hackathon demonstration purposes inside the DuesGuard AI sandbox. It is NOT an official bank receipt, UPI confirmation, or GST tax document, and does not alter production MSMED statutory ledgers.',
    };

    return {
      simulation,
      updatedView,
      receipt,
    };
  }

  /**
   * Revoke an active QR payment token
   */
  public revokeQrToken(input: z.input<typeof RevokeQrTokenSchema>): DemoQrTokenRecord {
    const parsed = RevokeQrTokenSchema.parse(input);
    const record = this.tokensById.get(parsed.tokenId);
    if (!record) {
      const err: any = new Error('HTTP 404 NOT FOUND: QR token record not found.');
      err.httpStatus = 404;
      throw err;
    }

    const access = this.verifyQrManagementAccess({
      userId: parsed.userId,
      organizationId: parsed.organizationId || record.organizationId,
      caseOwnerOrganizationId: record.organizationId,
    });

    if (!access.allowed) {
      const err: any = new Error(access.reason);
      err.httpStatus = access.httpStatus;
      throw err;
    }

    record.status = 'revoked';
    record.revokedAt = new Date().toISOString();
    this.tokensById.set(record.id, record);
    return { ...record };
  }

  /**
   * Reset simulated DEMO transactions (and optionally tokens) for a case or invoice
   */
  public resetDemoPaymentsForCase(input: z.input<typeof ResetDemoQrDataSchema>): {
    clearedSimulationsCount: number;
    message: string;
  } {
    const parsed = ResetDemoQrDataSchema.parse(input);
    const access = this.verifyQrManagementAccess({
      userId: parsed.userId,
      organizationId: parsed.organizationId,
    });

    if (!access.allowed) {
      const err: any = new Error(access.reason);
      err.httpStatus = access.httpStatus;
      throw err;
    }

    let clearedCount = 0;
    for (const [key, list] of this.demoSimulationsByInvoice.entries()) {
      if (parsed.invoiceId) {
        if (key === `${parsed.caseId}:${parsed.invoiceId}`) {
          clearedCount += list.length;
          this.demoSimulationsByInvoice.delete(key);
        }
      } else if (key.startsWith(`${parsed.caseId}:`)) {
        clearedCount += list.length;
        this.demoSimulationsByInvoice.delete(key);
      }
    }

    return {
      clearedSimulationsCount: clearedCount,
      message: `Reset ${clearedCount} demonstration payment simulation(s) for case ${parsed.caseId}. Production invoice ledgers remain untouched.`,
    };
  }

  /**
   * Inspect stored token record by ID (verifies that only tokenHash is stored)
   */
  public getStoredTokenRecordById(tokenId: string): DemoQrTokenRecord | undefined {
    const rec = this.tokensById.get(tokenId);
    return rec ? { ...rec } : undefined;
  }

  /**
   * Get all demo simulations for a case
   */
  public getCaseDemoSimulations(caseId: string): DemoPaymentSimulationRecord[] {
    const results: DemoPaymentSimulationRecord[] = [];
    for (const [key, list] of this.demoSimulationsByInvoice.entries()) {
      if (key.startsWith(`${caseId}:`)) {
        results.push(...list);
      }
    }
    return results.sort(
      (a, b) => new Date(b.simulatedAt).getTime() - new Date(a.simulatedAt).getTime()
    );
  }
}

export const demoQrService = new DemoQrPaymentService();
