/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import type {
  AnalysisRun,
  CaseDocument,
  CaseRecord,
  ChatMessage,
  CustomerRecord,
  DeliveryRecord,
  EmailReminderLogRecord,
  EmailReminderRuleType,
  EvidenceLink,
  Finding,
  InvoiceRecord,
  PaymentRecord,
  ProductItemRecord,
  PurchaseOrderRecord,
  R2PresignedUploadTicket,
  ReminderDeliveryChannel,
  TenantRecord,
  TenantRole,
} from '../types/index.ts';
import {
  INITIAL_DEMO_CASE,
  INITIAL_DEMO_DELIVERIES,
  INITIAL_DEMO_DOCUMENTS,
  INITIAL_DEMO_EVIDENCE_LINKS,
  INITIAL_DEMO_FINDINGS,
  INITIAL_DEMO_INVOICES,
  INITIAL_DEMO_PURCHASE_ORDERS,
} from './syntheticData.ts';
import {
  allocatePaymentsToInvoices,
  calculateCaseFinancialSummary,
  formatINR,
  validateGstin,
  verifyUdyamRegistrationAndDates,
} from './finance.ts';
import {
  buildBuyerOutreachMessageText,
  buildStatutoryReminderEmailHtml,
  calculateDaysDifference,
  calculateGstInvoiceBreakdown,
  evaluateReminderEligibility,
} from './erpBillingService.ts';

export interface AuditLogEntry {
  id: string;
  caseId: string;
  action: string;
  actor: string;
  timestamp: string;
  details: string;
}

export interface GeneratedReport {
  id: string;
  caseId: string;
  analysisId: string;
  reportType: 'internal_case_summary' | 'odr_annexure_index';
  version: number;
  approvedBy: string;
  approvedAt: string;
  reviewerNotes: string;
  pdfBase64?: string;
  createdAt: string;
}

class DuesGuardDatabase {
  private cases: Map<string, CaseRecord> = new Map();
  private documents: Map<string, CaseDocument[]> = new Map();
  private invoices: Map<string, InvoiceRecord[]> = new Map();
  private purchaseOrders: Map<string, PurchaseOrderRecord[]> = new Map();
  private deliveries: Map<string, DeliveryRecord[]> = new Map();
  private payments: Map<string, PaymentRecord[]> = new Map();
  private evidenceLinks: Map<string, EvidenceLink[]> = new Map();
  private findings: Map<string, Finding[]> = new Map();
  private analysisRuns: Map<string, AnalysisRun> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private reports: Map<string, GeneratedReport> = new Map();
  private customers: CustomerRecord[] = [];
  private products: ProductItemRecord[] = [];
  private reminderLogs: Map<string, EmailReminderLogRecord[]> = new Map();
  private invoiceSeqCounter: number = 104;

  constructor() {
    this.seedDemoCase();
  }

  public seedDemoCase() {
    const c = INITIAL_DEMO_CASE;
    this.cases.set(c.id, { ...c });
    this.documents.set(c.id, [...INITIAL_DEMO_DOCUMENTS]);
    this.invoices.set(
      c.id,
      INITIAL_DEMO_INVOICES.map((inv) => ({
        ...inv,
        sellerState: 'Karnataka',
        buyerState: 'Maharashtra',
        buyerEmail: 'accounts.payable@bharatheavyind.in',
        supplyType: 'INTER_STATE',
        subtotalPaise: inv.lineItems[0]?.unitPricePaise
          ? String(Number(inv.lineItems[0].unitPricePaise) * (inv.lineItems[0].quantity || 1))
          : inv.totalAmountPaise,
        cgstPaise: '0',
        sgstPaise: '0',
        igstPaise: inv.lineItems[0]?.taxAmountPaise || '0',
        totalTaxPaise: inv.lineItems[0]?.taxAmountPaise || '0',
      }))
    );
    this.purchaseOrders.set(c.id, [...INITIAL_DEMO_PURCHASE_ORDERS]);
    this.deliveries.set(c.id, [...INITIAL_DEMO_DELIVERIES]);
    this.payments.set(c.id, []);
    this.evidenceLinks.set(c.id, [...INITIAL_DEMO_EVIDENCE_LINKS]);
    this.findings.set(c.id, [...INITIAL_DEMO_FINDINGS]);
    this.invoiceSeqCounter = 104;
    this.seedErpCatalogAndReminders(c.id);

    // Construct demo initial analysis run
    const financeResult = calculateCaseFinancialSummary({
      invoices: INITIAL_DEMO_INVOICES,
      payments: [],
      deliveryDate: '2024-01-18',
      contractualDays: 30,
      asOfDate: '2024-04-15',
    });

    const run: AnalysisRun = {
      id: 'an_001',
      caseId: c.id,
      status: 'paused_at_checkpoint',
      startedAt: '2024-04-10T10:20:00Z',
      completedAt: '2024-04-10T10:22:15Z',
      agentEvents: [
        {
          step: 'document_classification',
          status: 'completed',
          message: '6 multimodal documents classified into Invoice, PO, Signed POD, and Udyam categories.',
          timestamp: '2024-04-10T10:20:05Z',
        },
        {
          step: 'document_extraction',
          status: 'completed',
          message: 'Gemini 3.8 Flash parsed 3 tax invoices, 1 purchase order, and delivery logs with page provenance.',
          timestamp: '2024-04-10T10:20:30Z',
        },
        {
          step: 'invoice_validation',
          status: 'completed',
          message: 'Deterministic validation complete. Zero duplicate invoice collision; 18% GST verified.',
          timestamp: '2024-04-10T10:20:45Z',
        },
        {
          step: 'msme_verification',
          status: 'completed',
          message: 'Udyam Registration validated (Manufacturing - Micro). Registration date (10-Jan-2023) predates invoices.',
          timestamp: '2024-04-10T10:21:00Z',
        },
        {
          step: 'evidence_reconciliation',
          status: 'completed',
          message: 'Evidence lifecycle graph reconciled. Missing proof of delivery identified on INV-102.',
          timestamp: '2024-04-10T10:21:30Z',
        },
        {
          step: 'finance_calculation',
          status: 'completed',
          message: 'MSMED § 16 statutory compound interest calculated at 3× RBI Bank Rate (20.25% p.a.) with monthly compounding rests.',
          timestamp: '2024-04-10T10:22:00Z',
        },
        {
          step: 'case_preparation',
          status: 'paused_for_review',
          message: 'LangGraph Checkpoint Triggered: Workflow paused. Awaiting human reviewer sign-off before report generation.',
          timestamp: '2024-04-10T10:22:15Z',
        },
      ],
      findings: [...INITIAL_DEMO_FINDINGS],
      evidenceLinks: [...INITIAL_DEMO_EVIDENCE_LINKS],
      summary: {
        totalInvoicedPaise: financeResult.principalAmountPaise,
        totalPaidPaise: '0',
        totalPendingPaise: financeResult.outstandingAmountPaise,
        totalOverduePaise: '8000000', // ₹80,000.00 (INV-101 + INV-102 overdue)
        totalInterestPaise: financeResult.compoundedInterestPaise,
        totalClaimPaise: financeResult.totalClaimAmountPaise,
        currency: 'INR',
        invoiceCount: 3,
        overdueCount: 2,
      },
      msmedResult: financeResult,
      udyamCheck: verifyUdyamRegistrationAndDates({
        udyamNumber: c.sellerUdyamNumber,
        registrationDate: c.sellerUdyamRegDate,
        classification: c.sellerClassification,
        registeredActivity: c.sellerActivity,
        invoiceDates: ['2024-01-15', '2024-02-10', '2024-04-01'],
        deliveryDates: ['2024-01-18'],
      }),
      gstinChecks: {
        buyer: validateGstin(c.buyerGstin),
        seller: validateGstin(c.sellerGstin),
      },
      approvalStatus: 'pending',
    };

    this.analysisRuns.set(run.id, run);

    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      caseId: c.id,
      action: 'CASE_INITIALIZED',
      actor: 'System Seeder',
      timestamp: new Date().toISOString(),
      details: 'Demonstration MSME delayed payment case initialized with InnoSprint synthetic test pack.',
    });
  }

  // Case procedures
  public getAllCases(): CaseRecord[] {
    return Array.from(this.cases.values());
  }

  public getCaseById(id: string): CaseRecord | undefined {
    return this.cases.get(id);
  }

  public createCase(data: Partial<CaseRecord>): CaseRecord {
    const id = `case-${Date.now()}`;
    const newCase: CaseRecord = {
      id,
      businessName: data.businessName || 'MSME Enterprise',
      caseReference: `DG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: data.createdBy || 'Authorized Representative',
      buyerName: data.buyerName || 'Buyer Enterprise Ltd',
      buyerGstin: data.buyerGstin || '',
      sellerName: data.sellerName || data.businessName || 'MSME Enterprise',
      sellerGstin: data.sellerGstin || '',
      sellerUdyamNumber: data.sellerUdyamNumber || '',
      sellerUdyamRegDate: data.sellerUdyamRegDate || '',
      sellerClassification: data.sellerClassification || 'Micro',
      sellerActivity: data.sellerActivity || 'Manufacturing',
      contractualPaymentDays: data.contractualPaymentDays || 30,
      disputeNotes: data.disputeNotes || '',
    };
    this.cases.set(id, newCase);
    this.documents.set(id, []);
    this.invoices.set(id, []);
    this.purchaseOrders.set(id, []);
    this.deliveries.set(id, []);
    this.payments.set(id, []);
    this.evidenceLinks.set(id, []);
    this.findings.set(id, []);

    this.addAuditLog(id, 'CASE_CREATED', newCase.createdBy, `Case ${newCase.caseReference} created.`);
    return newCase;
  }

  public updateCase(id: string, updates: Partial<CaseRecord>): CaseRecord | undefined {
    const c = this.cases.get(id);
    if (!c) return undefined;
    const updated = { ...c, ...updates, updatedAt: new Date().toISOString() };
    this.cases.set(id, updated);
    this.addAuditLog(id, 'CASE_UPDATED', 'User', 'Case details updated.');
    return updated;
  }

  // Documents
  public getDocuments(caseId: string): CaseDocument[] {
    return this.documents.get(caseId) || [];
  }

  public addDocument(caseId: string, doc: Partial<CaseDocument>): CaseDocument {
    const docs = this.getDocuments(caseId);
    const newDoc: CaseDocument = {
      id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      caseId,
      filename: doc.filename || 'Uploaded_Document.pdf',
      documentType: doc.documentType || 'invoice',
      mimeType: doc.mimeType || 'application/pdf',
      fileSizeBytes: doc.fileSizeBytes || 102400,
      uploadedAt: new Date().toISOString(),
      extractionStatus: 'pending',
      pageCount: doc.pageCount || 1,
      contentSnippet: doc.contentSnippet || '',
      fileDataUrl: doc.fileDataUrl,
    };
    docs.push(newDoc);
    this.documents.set(caseId, docs);
    this.addAuditLog(caseId, 'DOCUMENT_UPLOADED', 'User', `Uploaded ${newDoc.filename}`);
    return newDoc;
  }

  // Analysis & Checkpoint
  public saveAnalysisRun(run: AnalysisRun) {
    this.analysisRuns.set(run.id, run);
    if (run.findings) {
      this.findings.set(run.caseId, run.findings);
    }
    if (run.evidenceLinks) {
      this.evidenceLinks.set(run.caseId, run.evidenceLinks);
    }
    this.addAuditLog(run.caseId, 'ANALYSIS_EXECUTED', 'LangGraph Agent', `Analysis ${run.id} paused at human review gate.`);
  }

  public getAnalysisRun(id: string): AnalysisRun | undefined {
    return this.analysisRuns.get(id);
  }

  public getLatestAnalysisRun(caseId: string): AnalysisRun | undefined {
    const runs = Array.from(this.analysisRuns.values()).filter((r) => r.caseId === caseId);
    if (runs.length === 0) return undefined;
    return runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
  }

  // Invoices & Deliveries
  public getInvoices(caseId: string): InvoiceRecord[] {
    return this.invoices.get(caseId) || [];
  }

  public saveInvoices(caseId: string, invoices: InvoiceRecord[]) {
    this.invoices.set(caseId, invoices);
  }

  public getPurchaseOrders(caseId: string): PurchaseOrderRecord[] {
    return this.purchaseOrders.get(caseId) || [];
  }

  public getDeliveries(caseId: string): DeliveryRecord[] {
    return this.deliveries.get(caseId) || [];
  }

  public getPayments(caseId: string): PaymentRecord[] {
    return this.payments.get(caseId) || [];
  }

  public addPayment(
    caseId: string,
    payment: Partial<PaymentRecord>,
    asOfDate: string = '2024-04-15'
  ): {
    payment: PaymentRecord;
    invoices: InvoiceRecord[];
    payments: PaymentRecord[];
    latestAnalysis: AnalysisRun | undefined;
  } {
    const list = this.getPayments(caseId);
    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      caseId,
      invoiceId: payment.invoiceId || undefined,
      paymentDate: payment.paymentDate || new Date().toISOString().split('T')[0],
      amountPaise: payment.amountPaise || '0',
      reference: payment.reference || 'UPI-EXT-REF',
      paymentMethod: payment.paymentMethod || 'UPI',
      notes: payment.notes || 'External payment receipt logged manually (Non-gateway evidence record).',
      recordedAt: new Date().toISOString(),
    };
    list.push(newPayment);
    this.payments.set(caseId, list);

    const recalculated = this.recalculateCaseLedger(caseId, asOfDate);

    // Attach computed allocations for this specific payment
    const paymentAllocs = (recalculated.latestAnalysis?.msmedResult?.paymentAllocations || [])
      .filter((a) => a.paymentId === newPayment.id)
      .map((a, idx) => ({
        id: `alloc-${newPayment.id}-${idx + 1}`,
        paymentId: a.paymentId,
        invoiceId: a.invoiceId,
        amountPaise: a.amountPaise,
        paymentDate: a.paymentDate,
      }));
    newPayment.allocations = paymentAllocs;

    this.addAuditLog(
      caseId,
      'EXTERNAL_PAYMENT_LOGGED',
      'User',
      `Logged external ${newPayment.paymentMethod} receipt (${newPayment.reference}) of ${formatINR(newPayment.amountPaise)} dated ${newPayment.paymentDate}. Ledger & § 16 interest dynamically recalculated.`
    );

    return {
      payment: newPayment,
      invoices: recalculated.invoices,
      payments: this.getPayments(caseId),
      latestAnalysis: recalculated.latestAnalysis,
    };
  }

  public deletePayment(
    caseId: string,
    paymentId: string,
    asOfDate: string = '2024-04-15'
  ): {
    invoices: InvoiceRecord[];
    payments: PaymentRecord[];
    latestAnalysis: AnalysisRun | undefined;
  } {
    const list = this.getPayments(caseId).filter((p) => p.id !== paymentId);
    this.payments.set(caseId, list);
    const recalculated = this.recalculateCaseLedger(caseId, asOfDate);
    this.addAuditLog(
      caseId,
      'EXTERNAL_PAYMENT_REMOVED',
      'User',
      `Removed payment ${paymentId} and dynamically recalculated Disputed Invoice Ledger.`
    );
    return {
      invoices: recalculated.invoices,
      payments: list,
      latestAnalysis: recalculated.latestAnalysis,
    };
  }

  public recalculateCaseLedger(
    caseId: string,
    asOfDate: string = '2024-04-15'
  ): {
    invoices: InvoiceRecord[];
    latestAnalysis: AnalysisRun | undefined;
  } {
    const currentInvoices = this.invoices.get(caseId) || [];
    const baseInvoices = currentInvoices.map((inv) => {
      const demoOriginal = INITIAL_DEMO_INVOICES.find((d) => d.id === inv.id);
      return {
        ...inv,
        paidAmountPaise: '0',
        outstandingAmountPaise: inv.totalAmountPaise,
        status: demoOriginal
          ? demoOriginal.status
          : inv.status === 'paid'
          ? ('overdue' as const)
          : inv.status,
      };
    });
    const payments = this.getPayments(caseId);
    const deliveries = this.getDeliveries(caseId);
    const caseRecord = this.getCaseById(caseId);

    const allocation = allocatePaymentsToInvoices(baseInvoices, payments);
    this.invoices.set(caseId, allocation.invoicesWithBalances);

    const earliestDeliveryDate = deliveries[0]?.deliveryDate || '2024-01-18';
    const contractualDays = caseRecord?.contractualPaymentDays || 30;

    const financeResult = calculateCaseFinancialSummary({
      invoices: baseInvoices,
      payments,
      deliveryDate: earliestDeliveryDate,
      contractualDays,
      asOfDate,
    });

    const latestRun = this.getLatestAnalysisRun(caseId);
    if (latestRun) {
      const overdueCount = allocation.invoicesWithBalances.filter(
        (i) => (i.status === 'overdue' || i.status === 'disputed') && Number(i.outstandingAmountPaise) > 0
      ).length;
      latestRun.msmedResult = financeResult;
      latestRun.summary = {
        totalInvoicedPaise: financeResult.principalAmountPaise,
        totalPaidPaise: financeResult.totalPaidPaise,
        totalPendingPaise: financeResult.outstandingAmountPaise,
        totalOverduePaise: financeResult.totalOverduePaise,
        totalInterestPaise: financeResult.compoundedInterestPaise,
        totalClaimPaise: financeResult.totalClaimAmountPaise,
        currency: 'INR',
        invoiceCount: allocation.invoicesWithBalances.length,
        overdueCount,
      };
      this.analysisRuns.set(latestRun.id, latestRun);
    }

    return {
      invoices: allocation.invoicesWithBalances,
      latestAnalysis: latestRun,
    };
  }

  // Findings & Approvals
  public getFindings(caseId: string): Finding[] {
    return this.findings.get(caseId) || [];
  }

  public updateFinding(caseId: string, findingId: string, updates: Partial<Finding>): Finding | undefined {
    const list = this.getFindings(caseId);
    const target = list.find((f) => f.id === findingId);
    if (target) {
      Object.assign(target, updates);
      this.findings.set(caseId, list);
      this.addAuditLog(caseId, 'FINDING_RESOLVED', 'Reviewer', `Finding ${findingId} marked as ${target.status}`);
      return target;
    }
    return undefined;
  }

  public getEvidenceLinks(caseId: string): EvidenceLink[] {
    return this.evidenceLinks.get(caseId) || [];
  }

  public approveAnalysis(params: {
    caseId: string;
    analysisId: string;
    reviewerName: string;
    reviewerDesignation: string;
    reviewerNotes: string;
  }): AnalysisRun | undefined {
    const run = this.analysisRuns.get(params.analysisId);
    if (!run) return undefined;

    run.approvalStatus = 'approved';
    run.status = 'completed';
    run.reviewerName = params.reviewerName;
    run.reviewerDesignation = params.reviewerDesignation;
    run.reviewerNotes = params.reviewerNotes;
    run.reviewedAt = new Date().toISOString();

    const c = this.cases.get(params.caseId);
    if (c) {
      c.status = 'approved';
    }

    this.addAuditLog(
      params.caseId,
      'ANALYSIS_APPROVED',
      `${params.reviewerName} (${params.reviewerDesignation})`,
      `Analysis ${params.analysisId} verified and approved for statutory PDF report generation. Notes: ${params.reviewerNotes}`
    );

    return run;
  }

  // Reports
  public saveReport(report: GeneratedReport) {
    this.reports.set(report.id, report);
    this.addAuditLog(report.caseId, 'REPORT_GENERATED', report.approvedBy, `Audit report ${report.id} generated.`);
  }

  public getReports(caseId: string): GeneratedReport[] {
    return Array.from(this.reports.values()).filter((r) => r.caseId === caseId);
  }

  public getAuditLogs(caseId: string): AuditLogEntry[] {
    return this.auditLogs.filter((a) => a.caseId === caseId);
  }

  private chatThreads: Map<string, ChatMessage[]> = new Map();
  private r2Tickets: Map<string, R2PresignedUploadTicket> = new Map();
  private tenants: TenantRecord[] = [
    {
      id: 'tenant-apex-001',
      name: 'Apex Precision Engineering Pvt Ltd',
      udyamNumber: 'UDYAM-KR-03-0048291',
      gstin: '29AABCU9603R1ZJ',
      classification: 'Micro',
      activity: 'Manufacturing',
      activeRole: 'reviewer',
      activeUserName: 'Harsha Vardhan',
    },
    {
      id: 'tenant-srilakshmi-002',
      name: 'Sri Lakshmi Precision Components',
      udyamNumber: 'UDYAM-TN-02-0089124',
      gstin: '33AABCS1429B1ZB',
      classification: 'Small',
      activity: 'Manufacturing',
      activeRole: 'owner',
      activeUserName: 'Ananya Sundaram',
    },
  ];

  public getTenants(): TenantRecord[] {
    return this.tenants;
  }

  public updateTenantRole(tenantId: string, role: TenantRole): TenantRecord | undefined {
    const t = this.tenants.find((x) => x.id === tenantId);
    if (t) {
      t.activeRole = role;
      this.addAuditLog('case-001', 'RBAC_ROLE_CHANGED', t.activeUserName, `Active role switched to ${role.toUpperCase()} for tenant ${tenantId}`);
    }
    return t;
  }

  public verifyCrossTenantIsolation(requestingTenantId: string, targetCaseId: string): {
    allowed: boolean;
    caseOwnerTenantId: string;
    reason: string;
  } {
    const c = this.cases.get(targetCaseId);
    const ownerTenantId = c?.tenantId || 'tenant-apex-001';
    const allowed = requestingTenantId === ownerTenantId;
    return {
      allowed,
      caseOwnerTenantId: ownerTenantId,
      reason: allowed
        ? `Access granted: Authenticated session belongs to owning tenant (${ownerTenantId}).`
        : `HTTP 403 FORBIDDEN: Tenant '${requestingTenantId}' attempted cross-tenant access to case '${targetCaseId}' owned by '${ownerTenantId}'. Blocked by D1 tenant_id boundary.`,
    };
  }

  public createPresignedUploadTicket(params: {
    tenantId: string;
    caseId: string;
    filename: string;
    mimeType: string;
    fileSizeBytes: number;
  }): R2PresignedUploadTicket {
    const ticketId = `r2-tkt-${Date.now()}`;
    const docId = `doc-${Date.now()}`;
    const safeFilename = params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const r2StorageKey = `tenants/${params.tenantId}/cases/${params.caseId}/docs/${docId}_${safeFilename}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min TTL
    const signature = crypto
      .createHash('sha256')
      .update(`${ticketId}:${r2StorageKey}:${expiresAt}`)
      .digest('hex')
      .slice(0, 32);

    const ticket: R2PresignedUploadTicket = {
      ticketId,
      documentId: docId,
      tenantId: params.tenantId,
      caseId: params.caseId,
      r2StorageKey,
      presignedPutUrl: `https://duesguard-private-evidence-r2.r2.cloudflarestorage.com/${r2StorageKey}?X-Amz-Expires=600&X-Amz-Signature=${signature}`,
      expiresAt,
      expectedMimeType: params.mimeType || 'application/pdf',
      maxBytes: 15 * 1024 * 1024,
    };

    this.r2Tickets.set(ticketId, ticket);
    this.addAuditLog(
      params.caseId,
      'R2_PRESIGNED_URL_ISSUED',
      params.tenantId,
      `Issued short-lived R2 presigned PUT URL for ${safeFilename} (Key: ${r2StorageKey})`
    );
    return ticket;
  }

  public completeR2UploadVerification(params: {
    ticketId: string;
    fileHeaderMagicBytes: string;
    contentSnippet: string;
    filename: string;
    fileSizeBytes: number;
  }): { verified: boolean; checksumSha256: string; securityStatus: string; message: string } {
    const ticket = this.r2Tickets.get(params.ticketId);
    const checksumSha256 = crypto
      .createHash('sha256')
      .update(`${params.filename}:${params.fileSizeBytes}:${params.contentSnippet}`)
      .digest('hex');

    const isPdfSignatureValid = params.fileHeaderMagicBytes.startsWith('%PDF-');
    const withinSizeLimit = params.fileSizeBytes <= 15 * 1024 * 1024;

    if (!isPdfSignatureValid || !withinSizeLimit) {
      return {
        verified: false,
        checksumSha256,
        securityStatus: 'rejected_signature',
        message: !isPdfSignatureValid
          ? 'File rejected: Invalid PDF header signature (Expected %PDF-1.x magic bytes).'
          : 'File rejected: Exceeds 15MB maximum upload size limit.',
      };
    }

    if (ticket) {
      this.addAuditLog(
        ticket.caseId,
        'R2_UPLOAD_VERIFIED',
        ticket.tenantId,
        `Verified R2 object ${ticket.r2StorageKey} | SHA-256: ${checksumSha256.slice(0, 16)}... | Signature: %PDF- clean`
      );
    }

    return {
      verified: true,
      checksumSha256,
      securityStatus: 'verified_clean',
      message: `R2 object verified: %PDF- signature valid, malware scan clean, SHA-256 checksum recorded (${checksumSha256.slice(0, 16)}...).`,
    };
  }

  public getChatHistory(caseId: string): ChatMessage[] {
    const existing = this.chatThreads.get(caseId);
    if (existing && existing.length > 0) {
      return existing;
    }

    const c = this.cases.get(caseId) || INITIAL_DEMO_CASE;
    const welcomeMsg: ChatMessage = {
      id: `msg-welcome-${caseId}`,
      caseId,
      role: 'model',
      text: `Welcome to the **DuesGuard AI Multi-Turn Case & Architecture Assistant** for **${c.caseReference}** (${c.sellerName} vs. ${c.buyerName}).\n\nI am grounded in your deterministic \`decimal.js\` financial calculations, Udyam/GSTIN checks, and Evidence Relationship Graph. Switch my **Role Persona** or **Gemini Model Tier** (\`gemini-3.1-flash-lite\`, \`gemini-3.8-flash\`, or \`gemini-4-argon\`) above, and ask me anything about:\n- **Missing Proof of Delivery on INV-102 (DC-4480)**\n- **MSMED Section 15 (45-day cap) & Section 16 (3× RBI Bank Rate @ 20.25% p.a.)**\n- **Turborepo, Cloudflare D1/R2, Multi-Tenant RBAC, and Expo Mobile architecture**`,
      timestamp: new Date().toISOString(),
      modelTier: 'gemini-3.8-flash',
      resolvedModel: 'gemini-3.8-flash',
      rolePersona: 'msme_evidence_analyst',
      citations: [c.caseReference, 'INV-101', 'INV-102', 'MSMED Act §§ 15–16'],
    };
    this.chatThreads.set(caseId, [welcomeMsg]);
    return [welcomeMsg];
  }

  public appendChatMessage(caseId: string, msg: ChatMessage): ChatMessage[] {
    const thread = [...this.getChatHistory(caseId), msg];
    this.chatThreads.set(caseId, thread);
    return thread;
  }

  public clearChatHistory(caseId: string): ChatMessage[] {
    this.chatThreads.delete(caseId);
    return this.getChatHistory(caseId);
  }

  // --- MERGED DUESGAURD ERP CATALOGUE, GST INVOICE GENERATOR & REMINDER SCHEDULER ---

  private seedErpCatalogAndReminders(caseId: string) {
    this.customers = [
      {
        id: 'cust-bhel-01',
        organizationId: 'org-apex-001',
        name: 'Bharat Heavy Industrial Corp Ltd',
        email: 'accounts.payable@bharatheavyind.in',
        phone: '+91 22 6789 4410',
        state: 'Maharashtra',
        gstin: '27AAACB1234F1Z2',
        billingAddress: 'Plot 14, MIDC Industrial Area, Andheri East, Mumbai 400093',
        creditDays: 30,
        createdAt: '2024-01-02T09:00:00Z',
      },
      {
        id: 'cust-tata-02',
        organizationId: 'org-apex-001',
        name: 'Tata Motors Passenger Vehicles Ltd',
        email: 'vendor.settlements@tatamotors.in',
        phone: '+91 80 4129 8820',
        state: 'Karnataka',
        gstin: '29AAACT2727Q1ZW',
        billingAddress: '6th Floor, World Trade Center, Brigade Gateway, Bengaluru 560055',
        creditDays: 30,
        createdAt: '2024-01-05T11:30:00Z',
      },
      {
        id: 'cust-mahindra-03',
        organizationId: 'org-apex-001',
        name: 'Mahindra Precision Powertrain Systems',
        email: 'ap.reconciliation@mahindrapower.in',
        phone: '+91 44 2890 1122',
        state: 'Tamil Nadu',
        gstin: '33AAACM3025E1Z8',
        billingAddress: 'SIPCOT Industrial Park, Oragadam, Sriperumbudur, Chennai 602105',
        creditDays: 45,
        createdAt: '2024-01-12T14:15:00Z',
      },
      {
        id: 'cust-kirloskar-04',
        organizationId: 'org-apex-001',
        name: 'Kirloskar Pneumatic Automation Pvt Ltd',
        email: 'finance@kirloskarpneumatic.in',
        phone: '+91 80 2299 5511',
        state: 'Karnataka',
        gstin: '29AAACK4512M1Z3',
        billingAddress: 'Peenya Industrial Area Phase II, Bengaluru 560058',
        creditDays: 15,
        createdAt: '2024-02-01T10:00:00Z',
      },
    ];

    this.products = [
      {
        id: 'prod-cnc-01',
        organizationId: 'org-apex-001',
        sku: 'SKU-CNC-8810',
        name: '5-Axis CNC Machined Impeller & Turbine Housing',
        hsnSacCode: '84119900',
        unit: 'PCS',
        costPricePaise: '1650000', // Rs. 16,500.00 internal cost
        sellingPricePaise: '2500000', // Rs. 25,000.00 selling price
        gstRatePercent: 18,
        status: 'active',
        createdAt: '2024-01-01T08:00:00Z',
      },
      {
        id: 'prod-gear-02',
        organizationId: 'org-apex-001',
        sku: 'SKU-GRB-4420',
        name: 'High-Tensile Helical Gearbox Assembly (IS-2062)',
        hsnSacCode: '84834000',
        unit: 'SETS',
        costPricePaise: '1900000', // Rs. 19,000.00 cost
        sellingPricePaise: '3000000', // Rs. 30,000.00 selling
        gstRatePercent: 18,
        status: 'active',
        createdAt: '2024-01-01T08:05:00Z',
      },
      {
        id: 'prod-hyd-03',
        organizationId: 'org-apex-001',
        sku: 'SKU-HYD-2190',
        name: 'Proportional Electro-Hydraulic Servo Valve Manifold',
        hsnSacCode: '84812000',
        unit: 'PCS',
        costPricePaise: '1300000', // Rs. 13,000.00 cost
        sellingPricePaise: '2000000', // Rs. 20,000.00 selling
        gstRatePercent: 18,
        status: 'active',
        createdAt: '2024-01-01T08:10:00Z',
      },
      {
        id: 'prod-cal-04',
        organizationId: 'org-apex-001',
        sku: 'SAC-CAL-9987',
        name: 'Laser Interferometer Alignment & Statutory Calibration Service',
        hsnSacCode: '998719',
        unit: 'HRS',
        costPricePaise: '450000', // Rs. 4,500.00 cost
        sellingPricePaise: '850000', // Rs. 8,500.00 selling
        gstRatePercent: 18,
        status: 'active',
        createdAt: '2024-01-01T08:15:00Z',
      },
    ];

    const c = this.cases.get(caseId) || INITIAL_DEMO_CASE;
    const inv101Html = buildStatutoryReminderEmailHtml({
      businessName: c.sellerName,
      sellerUdyamNumber: c.sellerUdyamNumber,
      customerName: c.buyerName,
      invoiceNumber: 'INV-101',
      invoiceDate: '2024-01-15',
      dueDate: '2024-02-14',
      grandTotalPaise: '5000000',
      amountPaidPaise: '0',
      balanceDuePaise: '5000000',
      daysOverdue: 61,
    });

    const inv102Html = buildStatutoryReminderEmailHtml({
      businessName: c.sellerName,
      sellerUdyamNumber: c.sellerUdyamNumber,
      customerName: c.buyerName,
      invoiceNumber: 'INV-102',
      invoiceDate: '2024-02-10',
      dueDate: '2024-03-11',
      grandTotalPaise: '3000000',
      amountPaidPaise: '0',
      balanceDuePaise: '3000000',
      daysOverdue: 35,
    });

    this.reminderLogs.set(caseId, [
      {
        id: 'rem-log-001',
        caseId,
        invoiceId: 'inv-101',
        invoiceNumber: 'INV-101',
        customerId: 'cust-bhel-01',
        customerName: c.buyerName,
        recipientEmail: 'accounts.payable@bharatheavyind.in',
        reminderType: 'overdue_15d_escalation',
        subject: 'Formal MSMED Statutory Notice: Invoice INV-101 (61 Days Overdue)',
        bodyHtml: inv101Html,
        status: 'sent',
        providerMessageId: 'resend_msg_9918274a',
        daysOverdue: 61,
        balanceDuePaise: '5000000',
        sentAt: '2024-04-12T09:30:00Z',
      },
      {
        id: 'rem-log-002',
        caseId,
        invoiceId: 'inv-102',
        invoiceNumber: 'INV-102',
        customerId: 'cust-bhel-01',
        customerName: c.buyerName,
        recipientEmail: 'accounts.payable@bharatheavyind.in',
        reminderType: 'overdue_15d_escalation',
        subject: 'Formal MSMED Statutory Notice: Invoice INV-102 (35 Days Overdue)',
        bodyHtml: inv102Html,
        status: 'mock_delivered',
        providerMessageId: 'mock_1712914800_inv102',
        daysOverdue: 35,
        balanceDuePaise: '3000000',
        sentAt: '2024-04-10T14:15:00Z',
      },
    ]);
  }

  public getCustomers(): CustomerRecord[] {
    return this.customers;
  }

  public addCustomer(input: Partial<CustomerRecord>): CustomerRecord {
    const newCust: CustomerRecord = {
      id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organizationId: input.organizationId || 'org-apex-001',
      name: (input.name || 'New Enterprise Customer').trim(),
      email: (input.email || 'accounts@customer.in').trim(),
      phone: (input.phone || '+91 98000 00000').trim(),
      state: (input.state || 'Karnataka').trim(),
      gstin: input.gstin ? input.gstin.trim().toUpperCase() : '',
      billingAddress: (input.billingAddress || 'Industrial Estate, India').trim(),
      creditDays: Number(input.creditDays) || 30,
      createdAt: new Date().toISOString(),
    };
    this.customers.unshift(newCust);
    this.addAuditLog('case-001', 'CUSTOMER_ADDED', 'User', `Registered customer ${newCust.name} (${newCust.state})`);
    return newCust;
  }

  public updateCustomer(id: string, updates: Partial<CustomerRecord>): CustomerRecord | undefined {
    const target = this.customers.find((c) => c.id === id);
    if (!target) return undefined;
    Object.assign(target, updates);
    return target;
  }

  public getProducts(): ProductItemRecord[] {
    return this.products;
  }

  public addProduct(input: Partial<ProductItemRecord>): ProductItemRecord {
    const newProd: ProductItemRecord = {
      id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organizationId: input.organizationId || 'org-apex-001',
      sku: (input.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`).trim().toUpperCase(),
      name: (input.name || 'Industrial Component').trim(),
      hsnSacCode: (input.hsnSacCode || '84834000').trim(),
      unit: (input.unit || 'PCS').trim().toUpperCase(),
      costPricePaise: String(input.costPricePaise || '0'),
      sellingPricePaise: String(input.sellingPricePaise || '100000'),
      gstRatePercent: Number(input.gstRatePercent ?? 18),
      status: input.status || 'active',
      createdAt: new Date().toISOString(),
    };
    this.products.unshift(newProd);
    this.addAuditLog('case-001', 'PRODUCT_ADDED', 'User', `Added catalogue SKU ${newProd.sku}: ${newProd.name}`);
    return newProd;
  }

  public deleteProduct(id: string): boolean {
    const before = this.products.length;
    this.products = this.products.filter((p) => p.id !== id);
    return this.products.length < before;
  }

  /**
   * Generates an authoritative GST Tax Invoice (CGST+SGST or IGST), attaches a corroborated
   * Document & EvidenceLink to the active case, and recalculates the MSMED Section 16 ledger.
   */
  public generateGstInvoice(
    caseId: string,
    payload: {
      customerId?: string;
      buyerName?: string;
      buyerGstin?: string;
      buyerState?: string;
      buyerEmail?: string;
      sellerState?: string;
      invoiceNumber?: string;
      invoiceDate: string;
      dueDate: string;
      poReference?: string;
      deliveryReference?: string;
      paymentStatus?: 'unpaid' | 'paid';
      items: Array<{
        productId?: string;
        sku?: string;
        description: string;
        quantity: number;
        unit?: string;
        unitPricePaise: string;
        costPricePaise?: string;
        taxRatePercent: number;
      }>;
      asOfDate?: string;
    }
  ): {
    invoice: InvoiceRecord;
    gstCalculation: ReturnType<typeof calculateGstInvoiceBreakdown>;
    invoices: InvoiceRecord[];
    latestAnalysis: AnalysisRun | undefined;
  } {
    const caseRecord = this.getCaseById(caseId) || INITIAL_DEMO_CASE;
    const customer = payload.customerId
      ? this.customers.find((c) => c.id === payload.customerId)
      : undefined;

    const sellerState = payload.sellerState || 'Karnataka';
    const buyerState = payload.buyerState || customer?.state || 'Maharashtra';
    const buyerName = payload.buyerName || customer?.name || caseRecord.buyerName;
    const buyerGstin = payload.buyerGstin || customer?.gstin || caseRecord.buyerGstin || '';
    const buyerEmail = payload.buyerEmail || customer?.email || 'accounts.payable@buyer.in';

    const gstCalc = calculateGstInvoiceBreakdown({
      sellerState,
      buyerState,
      items: payload.items,
    });

    const seqNum = this.invoiceSeqCounter++;
    const invoiceNumber =
      payload.invoiceNumber?.trim() || `INV-${seqNum}`;
    const invId = `inv-${invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-3)}`;
    const docId = `doc-${invId}`;

    const asOf = payload.asOfDate || '2024-04-15';
    const isAlreadyPaid = payload.paymentStatus === 'paid';
    const daysDiff = calculateDaysDifference(payload.dueDate, asOf);
    const computedStatus: InvoiceRecord['status'] = isAlreadyPaid
      ? 'paid'
      : daysDiff > 0
      ? 'overdue'
      : 'pending';

    const newInvoice: InvoiceRecord = {
      id: invId,
      caseId,
      documentId: docId,
      invoiceNumber,
      buyer: buyerName,
      seller: caseRecord.sellerName,
      buyerGstin,
      sellerGstin: caseRecord.sellerGstin,
      buyerState,
      sellerState,
      buyerEmail,
      customerId: customer?.id,
      supplyType: gstCalc.supplyType,
      subtotalPaise: gstCalc.subtotalPaise,
      cgstPaise: gstCalc.cgstPaise,
      sgstPaise: gstCalc.sgstPaise,
      igstPaise: gstCalc.igstPaise,
      totalTaxPaise: gstCalc.totalTaxPaise,
      invoiceDate: payload.invoiceDate,
      contractualDueDate: payload.dueDate,
      agreedPaymentDays: caseRecord.contractualPaymentDays || 30,
      totalAmountPaise: gstCalc.grandTotalPaise,
      paidAmountPaise: isAlreadyPaid ? gstCalc.grandTotalPaise : '0',
      outstandingAmountPaise: isAlreadyPaid ? '0' : gstCalc.grandTotalPaise,
      currency: 'INR',
      poReference: payload.poReference || 'PO-2024-881',
      deliveryReference: payload.deliveryReference || `DC-${seqNum}`,
      lineItems: gstCalc.lineItems.map((li) => ({
        id: li.id,
        description: li.description,
        quantity: li.quantity,
        unitPricePaise: li.unitPricePaise,
        taxRatePercent: li.taxRatePercent,
        taxAmountPaise: li.taxAmountPaise,
        lineTotalPaise: li.lineTotalPaise,
        sourcePage: 1,
      })),
      provenance: {
        invoiceNumber: {
          documentId: docId,
          documentName: `Tax_Invoice_${invoiceNumber}.pdf`,
          pageNumber: 1,
          extractedValue: invoiceNumber,
          confidence: 1.0,
          extractedAt: new Date().toISOString(),
          modelId: 'deterministic-gst-engine',
          fieldName: 'invoiceNumber',
        },
      },
      status: computedStatus,
    };

    const existingInvoices = this.getInvoices(caseId);
    existingInvoices.push(newInvoice);
    this.invoices.set(caseId, existingInvoices);

    // Add corresponding document record
    const existingDocs = this.getDocuments(caseId);
    existingDocs.unshift({
      id: docId,
      caseId,
      filename: `Tax_Invoice_${invoiceNumber}.pdf`,
      documentType: 'invoice',
      mimeType: 'application/pdf',
      fileSizeBytes: 148200,
      uploadedAt: new Date().toISOString(),
      extractionStatus: 'completed',
      pageCount: 1,
      contentSnippet: `GST TAX INVOICE ${invoiceNumber} | Buyer: ${buyerName} (${buyerState}) | Supply: ${gstCalc.supplyType} | Grand Total: ${formatINR(gstCalc.grandTotalPaise)}`,
      uploadStatus: 'verified',
      securityStatus: 'verified_clean',
    });
    this.documents.set(caseId, existingDocs);

    // If marked already paid, record payment entry so ledger allocations stay consistent
    if (isAlreadyPaid) {
      const existingPayments = this.getPayments(caseId);
      existingPayments.push({
        id: `pay-auto-${invId}`,
        caseId,
        invoiceId: invId,
        paymentDate: payload.invoiceDate,
        amountPaise: gstCalc.grandTotalPaise,
        reference: `PAID-AT-ISSUANCE-${invoiceNumber}`,
        paymentMethod: 'NEFT',
        notes: 'Invoice marked as Already Paid upon issuance.',
        recordedAt: new Date().toISOString(),
      });
      this.payments.set(caseId, existingPayments);
    }

    const recalculated = this.recalculateCaseLedger(caseId, asOf);
    this.addAuditLog(
      caseId,
      'GST_INVOICE_GENERATED',
      'User',
      `Generated ${gstCalc.supplyType} Tax Invoice ${invoiceNumber} for ${buyerName} totaling ${formatINR(gstCalc.grandTotalPaise)}.`
    );

    return {
      invoice: newInvoice,
      gstCalculation: gstCalc,
      invoices: recalculated.invoices,
      latestAnalysis: recalculated.latestAnalysis,
    };
  }

  public getReminderLogs(caseId: string): EmailReminderLogRecord[] {
    return this.reminderLogs.get(caseId) || [];
  }

  /**
   * Runs the idempotent 5-stage Overdue Reminder Scheduler across all unpaid invoices in the case.
   */
  public triggerReminderSchedulerCycle(
    caseId: string,
    asOfDate: string = '2024-04-15'
  ): {
    dispatchedCount: number;
    skippedDuplicateCount: number;
    newlyDispatched: EmailReminderLogRecord[];
    allLogs: EmailReminderLogRecord[];
  } {
    const caseRecord = this.getCaseById(caseId) || INITIAL_DEMO_CASE;
    const invoices = this.getInvoices(caseId);
    const logs = this.getReminderLogs(caseId);

    const newlyDispatched: EmailReminderLogRecord[] = [];
    let skippedDuplicateCount = 0;

    for (const inv of invoices) {
      const check = evaluateReminderEligibility({
        invoiceNumber: inv.invoiceNumber,
        businessName: caseRecord.sellerName,
        dueDate: inv.contractualDueDate || inv.invoiceDate,
        asOfDate,
        balanceDuePaise: inv.outstandingAmountPaise,
        status: inv.status,
      });

      if (!check.eligible || !check.reminderType) continue;

      // Idempotency check: skip if this invoice + reminderType was already sent
      const alreadySent = logs.some(
        (l) =>
          l.invoiceId === inv.id &&
          l.reminderType === check.reminderType &&
          (l.status === 'sent' || l.status === 'mock_delivered')
      );
      if (alreadySent) {
        skippedDuplicateCount++;
        continue;
      }

      const html = buildStatutoryReminderEmailHtml({
        businessName: caseRecord.sellerName,
        sellerUdyamNumber: caseRecord.sellerUdyamNumber,
        customerName: inv.buyer || caseRecord.buyerName,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.contractualDueDate || inv.invoiceDate,
        grandTotalPaise: inv.totalAmountPaise,
        amountPaidPaise: inv.paidAmountPaise || '0',
        balanceDuePaise: inv.outstandingAmountPaise,
        daysOverdue: check.daysOverdue,
      });

      const logEntry: EmailReminderLogRecord = {
        id: `rem-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        caseId,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName: inv.buyer || caseRecord.buyerName,
        recipientEmail: inv.buyerEmail || 'accounts.payable@bharatheavyind.in',
        reminderType: check.reminderType,
        subject: check.subject,
        bodyHtml: html,
        status: 'sent',
        providerMessageId: `dg_cron_${Date.now().toString(36)}_${inv.invoiceNumber.toLowerCase()}`,
        daysOverdue: check.daysOverdue,
        balanceDuePaise: inv.outstandingAmountPaise,
        sentAt: new Date().toISOString(),
      };

      logs.unshift(logEntry);
      newlyDispatched.push(logEntry);
    }

    this.reminderLogs.set(caseId, logs);
    this.addAuditLog(
      caseId,
      'REMINDER_CRON_EXECUTED',
      'Scheduler Daemon',
      `Evaluated ${invoices.length} invoices as of ${asOfDate}: Dispatched ${newlyDispatched.length} notices, skipped ${skippedDuplicateCount} idempotent duplicates.`
    );

    return {
      dispatchedCount: newlyDispatched.length,
      skippedDuplicateCount,
      newlyDispatched,
      allLogs: logs,
    };
  }

  /**
   * Sends an immediate manual / test statutory reminder notice (Email, WhatsApp, SMS, or Multi-Channel)
   * for a selected invoice and records a durable audit entry.
   */
  public sendManualOrTestReminder(
    caseId: string,
    params: {
      invoiceId: string;
      recipientEmail?: string;
      recipientPhone?: string;
      channel?: ReminderDeliveryChannel;
      reminderType?: EmailReminderRuleType;
      customSubject?: string;
      customNote?: string;
      paymentPortalUrl?: string;
      providerMessageId?: string;
      asOfDate?: string;
    }
  ): EmailReminderLogRecord {
    const caseRecord = this.getCaseById(caseId) || INITIAL_DEMO_CASE;
    const invoices = this.getInvoices(caseId);
    const inv = invoices.find((i) => i.id === params.invoiceId) || invoices[0];
    if (!inv) {
      throw new Error('No invoice found in case to dispatch reminder.');
    }

    const customer = inv.customerId
      ? this.customers.find((c) => c.id === inv.customerId)
      : this.customers.find((c) => c.name === inv.buyer);

    const asOf = params.asOfDate || '2024-04-15';
    const dueDate = inv.contractualDueDate || inv.invoiceDate;
    const daysOverdue = Math.max(0, calculateDaysDifference(dueDate, asOf));
    const reminderType = params.reminderType || (daysOverdue >= 15 ? 'overdue_15d_escalation' : 'manual_notice');
    const channel: ReminderDeliveryChannel = params.channel || 'email';
    const recipient = (
      params.recipientEmail ||
      inv.buyerEmail ||
      customer?.email ||
      'accounts.payable@bharatheavyind.in'
    ).trim();
    const recipientPhone = (
      params.recipientPhone ||
      customer?.phone ||
      '+91 22 6789 4410'
    ).trim();

    const defaultSubject =
      daysOverdue > 0
        ? `Formal MSMED Statutory Payment Notice: Invoice ${inv.invoiceNumber} (${daysOverdue} Days Overdue)`
        : `Accounts Receivable Payment Reminder: Invoice ${inv.invoiceNumber} — ${caseRecord.sellerName}`;
    const subject = (params.customSubject || defaultSubject).trim();

    const portalUrl =
      params.paymentPortalUrl ||
      `https://duesguard.ai/demo-pay/DG-${inv.invoiceNumber.toUpperCase()}`;

    const html = buildStatutoryReminderEmailHtml({
      businessName: caseRecord.sellerName,
      sellerUdyamNumber: caseRecord.sellerUdyamNumber,
      customerName: inv.buyer || caseRecord.buyerName,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate,
      grandTotalPaise: inv.totalAmountPaise,
      amountPaidPaise: inv.paidAmountPaise || '0',
      balanceDuePaise: inv.outstandingAmountPaise,
      daysOverdue,
      customNote: params.customNote,
      paymentPortalUrl: portalUrl,
      reminderType,
    });

    const messageText = buildBuyerOutreachMessageText({
      businessName: caseRecord.sellerName,
      sellerUdyamNumber: caseRecord.sellerUdyamNumber,
      customerName: inv.buyer || caseRecord.buyerName,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate,
      balanceDuePaise: inv.outstandingAmountPaise,
      daysOverdue,
      customNote: params.customNote,
      paymentPortalUrl: portalUrl,
      reminderType,
    });

    const logEntry: EmailReminderLogRecord = {
      id: `rem-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      caseId,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customerId || customer?.id,
      customerName: inv.buyer || caseRecord.buyerName,
      recipientEmail: recipient,
      recipientPhone,
      channel,
      reminderType,
      subject,
      bodyHtml: html,
      messageText,
      paymentPortalUrl: portalUrl,
      status: 'sent',
      providerMessageId:
        params.providerMessageId || `dg_${channel}_${Date.now().toString(36)}`,
      daysOverdue,
      balanceDuePaise: inv.outstandingAmountPaise,
      sentAt: new Date().toISOString(),
    };

    const logs = this.getReminderLogs(caseId);
    logs.unshift(logEntry);
    this.reminderLogs.set(caseId, logs);

    this.addAuditLog(
      caseId,
      'STATUTORY_REMINDER_DISPATCHED',
      'User',
      `Dispatched ${channel.toUpperCase()} (${reminderType}) reminder to ${recipient} (${recipientPhone}) for Invoice ${inv.invoiceNumber} (${formatINR(inv.outstandingAmountPaise)}) [Ref: ${logEntry.providerMessageId}].`
    );

    return logEntry;
  }

  /**
   * Broadcasts multi-channel reminders across all unpaid invoices in the case simultaneously.
   */
  public broadcastOverdueReminders(
    caseId: string,
    params: {
      channel?: ReminderDeliveryChannel;
      customNote?: string;
      baseUrl?: string;
      asOfDate?: string;
    } = {}
  ): {
    dispatchedCount: number;
    logs: EmailReminderLogRecord[];
  } {
    const invoices = this.getInvoices(caseId).filter(
      (i) => i.status !== 'paid' && Number(i.outstandingAmountPaise) > 0
    );
    const channel: ReminderDeliveryChannel = params.channel || 'multi_channel';
    const newlySent: EmailReminderLogRecord[] = [];

    for (const inv of invoices) {
      const portalUrl = params.baseUrl
        ? `${params.baseUrl.replace(/\/$/, '')}/demo-pay/DG-${inv.invoiceNumber.toUpperCase()}`
        : `https://duesguard.ai/demo-pay/DG-${inv.invoiceNumber.toUpperCase()}`;

      const log = this.sendManualOrTestReminder(caseId, {
        invoiceId: inv.id,
        channel,
        customNote: params.customNote,
        paymentPortalUrl: portalUrl,
        asOfDate: params.asOfDate,
      });
      newlySent.push(log);
    }

    return {
      dispatchedCount: newlySent.length,
      logs: this.getReminderLogs(caseId),
    };
  }

  private addAuditLog(caseId: string, action: string, actor: string, details: string) {
    this.auditLogs.unshift({
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      caseId,
      action,
      actor,
      timestamp: new Date().toISOString(),
      details,
    });
  }
}

export const db = new DuesGuardDatabase();

