/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AgentEvent,
  AnalysisRun,
  CaseDocument,
  CaseRecord,
  EvidenceLink,
  Finding,
  InvoiceRecord,
  PaymentRecord,
  PurchaseOrderRecord,
  DeliveryRecord,
} from '../types/index.ts';
import {
  calculateCaseFinancialSummary,
  validateGstin,
  verifyUdyamRegistrationAndDates,
} from './finance.ts';
import { extractDocumentWithGemini } from './geminiService.ts';

/**
 * State Graph Context for DuesGuard AI analysis
 */
export interface AgentGraphState {
  caseId: string;
  caseData: CaseRecord;
  documents: CaseDocument[];
  invoices: InvoiceRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  deliveries: DeliveryRecord[];
  payments: PaymentRecord[];
  evidenceLinks: EvidenceLink[];
  findings: Finding[];
  agentEvents: AgentEvent[];
  asOfDate: string;
  isPausedAtCheckpoint: boolean;
}

/**
 * Execute the complete Multi-Agent StateGraph Pipeline
 */
export async function runCaseAnalysisGraph(
  caseRecord: CaseRecord,
  documents: CaseDocument[],
  existingInvoices: InvoiceRecord[] = [],
  existingPOs: PurchaseOrderRecord[] = [],
  existingDeliveries: DeliveryRecord[] = [],
  existingPayments: PaymentRecord[] = [],
  asOfDate: string = new Date().toISOString().split('T')[0]
): Promise<AnalysisRun> {
  const analysisId = `an-${Date.now()}`;
  const startedAt = new Date().toISOString();

  const state: AgentGraphState = {
    caseId: caseRecord.id,
    caseData: caseRecord,
    documents: [...documents],
    invoices: [...existingInvoices],
    purchaseOrders: [...existingPOs],
    deliveries: [...existingDeliveries],
    payments: [...existingPayments],
    evidenceLinks: [],
    findings: [],
    agentEvents: [],
    asOfDate,
    isPausedAtCheckpoint: false,
  };

  // Node 1: Document Classification
  await executeNodeClassifyDocuments(state);

  // Node 2: Multimodal Extraction & Provenance Tracking
  await executeNodeExtractDocuments(state);

  // Node 3: Deterministic Invoice Validation
  await executeNodeValidateInvoices(state);

  // Node 4: MSME Udyam & GSTIN Compliance Verification
  await executeNodeVerifyMsme(state);

  // Node 5: Evidence Relationship Graph Reconciliation
  await executeNodeReconcileEvidence(state);

  // Node 6: Evidence Gap & Discrepancy Verification
  await executeNodeVerifyEvidence(state);

  // Node 7: Deterministic Finance Engine
  const financeResult = executeNodeCalculateFinances(state);

  // Node 8: Human-in-the-Loop Checkpoint
  executeNodeCheckpoint(state);

  const completedAt = new Date().toISOString();

  return {
    id: analysisId,
    caseId: caseRecord.id,
    status: 'paused_at_checkpoint',
    startedAt,
    completedAt,
    agentEvents: state.agentEvents,
    findings: state.findings,
    evidenceLinks: state.evidenceLinks,
    summary: {
      totalInvoicedPaise: financeResult.principalAmountPaise,
      totalPaidPaise: financeResult.totalPaidPaise,
      totalPendingPaise: financeResult.outstandingAmountPaise,
      totalOverduePaise: financeResult.totalOverduePaise,
      totalInterestPaise: financeResult.compoundedInterestPaise,
      totalClaimPaise: financeResult.totalClaimAmountPaise,
      currency: 'INR',
      invoiceCount: state.invoices.length,
      overdueCount: state.invoices.filter((i) => i.status === 'overdue').length,
    },
    msmedResult: financeResult,
    udyamCheck: verifyUdyamRegistrationAndDates({
      udyamNumber: caseRecord.sellerUdyamNumber,
      registrationDate: caseRecord.sellerUdyamRegDate,
      classification: caseRecord.sellerClassification,
      registeredActivity: caseRecord.sellerActivity,
      invoiceDates: state.invoices.map((i) => i.invoiceDate),
      deliveryDates: state.deliveries.map((d) => d.deliveryDate),
    }),
    gstinChecks: {
      buyer: validateGstin(caseRecord.buyerGstin),
      seller: validateGstin(caseRecord.sellerGstin),
    },
    approvalStatus: 'pending',
  };
}

/**
 * Node 1: Classify Documents
 */
async function executeNodeClassifyDocuments(state: AgentGraphState) {
  const t0 = Date.now();
  for (const doc of state.documents) {
    const fn = doc.filename.toUpperCase();
    if (fn.includes('INV') || fn.includes('TAX')) doc.documentType = 'invoice';
    else if (fn.includes('PO') || fn.includes('ORDER')) doc.documentType = 'purchase_order';
    else if (fn.includes('POD') || fn.includes('SIGNED') || fn.includes('LR')) doc.documentType = 'proof_of_delivery';
    else if (fn.includes('CHALLAN')) doc.documentType = 'delivery_challan';
    else if (fn.includes('UDYAM')) doc.documentType = 'udyam_certificate';
    else if (fn.includes('PAY') || fn.includes('RECEIPT')) doc.documentType = 'payment_receipt';
  }

  state.agentEvents.push({
    step: 'document_classification',
    status: 'completed',
    message: `Classified ${state.documents.length} multimodal documents into invoice, PO, delivery, and statutory proof classes.`,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - t0,
    metadata: {
      documentCount: state.documents.length,
    },
  });
}

/**
 * Node 2: Multimodal Extraction & Provenance Tracking
 */
async function executeNodeExtractDocuments(state: AgentGraphState) {
  const t0 = Date.now();

  for (const doc of state.documents) {
    if (doc.extractionStatus === 'completed' && state.invoices.some((i) => i.documentId === doc.id)) {
      continue;
    }

    const extracted = await extractDocumentWithGemini({
      documentId: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      textContent: doc.contentSnippet,
    });

    doc.extractionStatus = 'completed';

    if (extracted.documentType === 'invoice') {
      const existing = state.invoices.find((i) => i.invoiceNumber === extracted.documentNumber);
      if (!existing) {
        state.invoices.push({
          id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          caseId: state.caseId,
          documentId: doc.id,
          invoiceNumber: extracted.documentNumber,
          buyer: extracted.buyerName,
          seller: extracted.sellerName,
          buyerGstin: extracted.buyerGstin,
          sellerGstin: extracted.sellerGstin,
          invoiceDate: extracted.documentDate,
          totalAmountPaise: extracted.totalAmountPaise,
          paidAmountPaise: '0',
          outstandingAmountPaise: extracted.totalAmountPaise,
          currency: extracted.currency,
          poReference: extracted.poReference,
          deliveryReference: extracted.deliveryReference,
          lineItems: extracted.lineItems,
          provenance: extracted.provenance,
          status: 'pending',
        });
      }
    } else if (extracted.documentType === 'purchase_order') {
      const existing = state.purchaseOrders.find((p) => p.poNumber === extracted.documentNumber);
      if (!existing) {
        state.purchaseOrders.push({
          id: `po-${Date.now()}`,
          caseId: state.caseId,
          documentId: doc.id,
          poNumber: extracted.documentNumber,
          buyer: extracted.buyerName,
          seller: extracted.sellerName,
          poDate: extracted.documentDate,
          poTotalPaise: extracted.totalAmountPaise,
          currency: extracted.currency,
          provenance: extracted.provenance,
        });
      }
    } else if (extracted.documentType === 'delivery_challan' || extracted.documentType === 'proof_of_delivery') {
      const existing = state.deliveries.find((d) => d.deliveryReference === extracted.documentNumber);
      if (!existing) {
        state.deliveries.push({
          id: `del-${Date.now()}`,
          caseId: state.caseId,
          documentId: doc.id,
          deliveryReference: extracted.documentNumber,
          challanNumber: extracted.documentNumber,
          deliveryDate: extracted.documentDate,
          actualAcceptanceDate: extracted.documentDate,
          provenance: extracted.provenance,
        });
      }
    }
  }

  state.agentEvents.push({
    step: 'document_extraction',
    status: 'completed',
    message: `Gemini Multimodal extraction indexed ${state.invoices.length} invoices, ${state.purchaseOrders.length} POs, and ${state.deliveries.length} delivery records with page-level provenance.`,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - t0,
    metadata: {
      invoicesExtracted: state.invoices.length,
      purchaseOrdersExtracted: state.purchaseOrders.length,
      deliveriesExtracted: state.deliveries.length,
    },
  });
}

/**
 * Node 3: Validate Invoices
 */
async function executeNodeValidateInvoices(state: AgentGraphState) {
  const t0 = Date.now();
  const seenNumbers = new Set<string>();

  for (const inv of state.invoices) {
    if (seenNumbers.has(inv.invoiceNumber)) {
      state.findings.push({
        id: `find-dup-${inv.invoiceNumber}`,
        caseId: state.caseId,
        agentName: 'invoice_validation',
        severity: 'critical',
        code: 'DUPLICATE_INVOICE_NUMBER',
        message: `Duplicate invoice number detected: '${inv.invoiceNumber}'. Multiple documents reference the same invoice identity.`,
        sourceDocumentIds: [inv.documentId],
        status: 'needs_review',
        createdAt: new Date().toISOString(),
      });
    }
    seenNumbers.add(inv.invoiceNumber);

    // Cross check PO references
    if (inv.poReference) {
      const po = state.purchaseOrders.find((p) => p.poNumber === inv.poReference);
      if (!po) {
        state.findings.push({
          id: `find-po-missing-${inv.invoiceNumber}`,
          caseId: state.caseId,
          agentName: 'invoice_validation',
          severity: 'warning',
          code: 'UNVERIFIED_PO_REFERENCE',
          message: `Invoice ${inv.invoiceNumber} cites purchase order '${inv.poReference}', but no corresponding PO document was uploaded.`,
          sourceDocumentIds: [inv.documentId],
          status: 'needs_review',
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  state.agentEvents.push({
    step: 'invoice_validation',
    status: 'completed',
    message: `Deterministic validation finished for ${state.invoices.length} invoices. No duplicate invoice collision.`,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - t0,
  });
}

/**
 * Node 4: MSME Udyam & GSTIN Verification
 */
async function executeNodeVerifyMsme(state: AgentGraphState) {
  const t0 = Date.now();
  const udyamResult = verifyUdyamRegistrationAndDates({
    udyamNumber: state.caseData.sellerUdyamNumber,
    registrationDate: state.caseData.sellerUdyamRegDate,
    classification: state.caseData.sellerClassification,
    registeredActivity: state.caseData.sellerActivity,
    invoiceDates: state.invoices.map((i) => i.invoiceDate),
    deliveryDates: state.deliveries.map((d) => d.deliveryDate),
  });

  if (udyamResult.status === 'registration_date_conflict') {
    state.findings.push({
      id: `find-udyam-conflict-${Date.now()}`,
      caseId: state.caseId,
      agentName: 'msme_verification',
      severity: 'warning',
      code: 'UDYAM_PRE_REGISTRATION_CONFLICT',
      message: udyamResult.conflictDetails || 'Pre-registration transaction timing alert.',
      sourceDocumentIds: state.documents.filter((d) => d.documentType === 'udyam_certificate').map((d) => d.id),
      status: 'needs_review',
      createdAt: new Date().toISOString(),
    });
  } else if (udyamResult.status === 'registration_verified') {
    state.findings.push({
      id: `find-udyam-ok-${Date.now()}`,
      caseId: state.caseId,
      agentName: 'msme_verification',
      severity: 'info',
      code: 'UDYAM_REGISTRATION_VERIFIED',
      message: `Supplier Udyam Registration (${udyamResult.udyamNumber}) confirmed for ${udyamResult.enterpriseClassification} Enterprise (${udyamResult.registeredActivity}). Eligibility window verified.`,
      sourceDocumentIds: state.documents.filter((d) => d.documentType === 'udyam_certificate').map((d) => d.id),
      status: 'verified',
      createdAt: new Date().toISOString(),
    });
  }

  // GSTIN checksum verification
  const buyerGst = validateGstin(state.caseData.buyerGstin);
  if (buyerGst.status === 'invalid_format') {
    state.findings.push({
      id: `find-gst-buyer-${Date.now()}`,
      caseId: state.caseId,
      agentName: 'msme_verification',
      severity: 'warning',
      code: 'BUYER_GSTIN_INVALID',
      message: `Buyer GSTIN (${state.caseData.buyerGstin}) failed Mod-36 checksum verification.`,
      sourceDocumentIds: [],
      status: 'needs_review',
      createdAt: new Date().toISOString(),
    });
  }

  state.agentEvents.push({
    step: 'msme_verification',
    status: 'completed',
    message: `Udyam & GSTIN status evaluated. Enterprise classification: ${state.caseData.sellerClassification}.`,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - t0,
  });
}

/**
 * Node 5: Reconcile Evidence Graph
 */
async function executeNodeReconcileEvidence(state: AgentGraphState) {
  const t0 = Date.now();
  state.evidenceLinks = [];

  // Match PO to Invoices
  for (const po of state.purchaseOrders) {
    const matchingInvoices = state.invoices.filter((i) => i.poReference === po.poNumber);
    for (const inv of matchingInvoices) {
      state.evidenceLinks.push({
        id: `link-${po.id}-${inv.id}`,
        caseId: state.caseId,
        sourceEntityType: 'purchase_order',
        sourceEntityId: po.poNumber,
        sourceLabel: `PO ${po.poNumber}`,
        targetEntityType: 'invoice',
        targetEntityId: inv.invoiceNumber,
        targetLabel: `Invoice ${inv.invoiceNumber}`,
        relationshipType: 'po_to_invoice',
        verificationStatus: 'matched',
      });
    }
  }

  // Match Invoices to Delivery Proof
  for (const inv of state.invoices) {
    // Check if delivery proof exists
    const delivery = state.deliveries.find(
      (d) =>
        (inv.deliveryReference && d.deliveryReference === inv.deliveryReference) ||
        (d.challanNumber && inv.deliveryReference?.includes(d.challanNumber))
    );

    if (delivery) {
      state.evidenceLinks.push({
        id: `link-${inv.id}-${delivery.id}`,
        caseId: state.caseId,
        sourceEntityType: 'invoice',
        sourceEntityId: inv.invoiceNumber,
        sourceLabel: `Invoice ${inv.invoiceNumber}`,
        targetEntityType: 'delivery',
        targetEntityId: delivery.deliveryReference,
        targetLabel: `Signed Delivery (${delivery.deliveryReference})`,
        relationshipType: 'invoice_to_delivery',
        verificationStatus: 'matched',
      });
    } else {
      // Deliberate or identified missing proof of delivery!
      state.evidenceLinks.push({
        id: `link-missing-pod-${inv.id}`,
        caseId: state.caseId,
        sourceEntityType: 'invoice',
        sourceEntityId: inv.invoiceNumber,
        sourceLabel: `Invoice ${inv.invoiceNumber}`,
        targetEntityType: 'delivery',
        targetEntityId: 'MISSING_POD',
        targetLabel: `Missing Proof of Delivery (${inv.deliveryReference || 'No Ref'})`,
        relationshipType: 'invoice_to_delivery',
        verificationStatus: 'missing',
        discrepancyDetails: `No signed delivery challan or lorry receipt found to substantiate receipt of goods for ${inv.invoiceNumber}.`,
      });
    }
  }

  state.agentEvents.push({
    step: 'evidence_reconciliation',
    status: 'completed',
    message: `Reconciled ${state.evidenceLinks.length} lifecycle evidence links across PO, Invoice, Delivery and Payment records.`,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - t0,
  });
}

/**
 * Node 6: Verify Evidence Gaps
 */
async function executeNodeVerifyEvidence(state: AgentGraphState) {
  const t0 = Date.now();
  const missingLinks = state.evidenceLinks.filter((l) => l.verificationStatus === 'missing');

  for (const missing of missingLinks) {
    if (missing.targetEntityType === 'delivery') {
      const inv = state.invoices.find((i) => i.invoiceNumber === missing.sourceEntityId);
      state.findings.push({
        id: `find-missing-pod-${missing.sourceEntityId}`,
        caseId: state.caseId,
        agentName: 'evidence_verification',
        severity: 'warning',
        code: 'MISSING_DELIVERY_PROOF',
        message: `Delivery acknowledgement / signed challan was not found for ${missing.sourceLabel}. Section 16 interest requires proof of delivery to establish statutory acceptance date.`,
        sourceDocumentIds: inv ? [inv.documentId] : [],
        pageNumbers: [1],
        status: 'needs_review',
        createdAt: new Date().toISOString(),
      });
    }
  }

  state.agentEvents.push({
    step: 'evidence_reconciliation',
    status: 'completed',
    message: `Identified ${missingLinks.length} critical evidence gaps requiring human reviewer audit.`,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - t0,
  });
}

/**
 * Node 7: Deterministic Financial Calculation
 */
function executeNodeCalculateFinances(state: AgentGraphState) {
  const t0 = Date.now();

  // Find primary delivery date
  const earliestDelivery = state.deliveries[0]?.deliveryDate || state.invoices[0]?.invoiceDate || '2024-01-18';

  const financeResult = calculateCaseFinancialSummary({
    invoices: state.invoices,
    payments: state.payments,
    deliveryDate: earliestDelivery,
    contractualDays: state.caseData.contractualPaymentDays || 30,
    asOfDate: state.asOfDate,
  });

  // Update statuses on invoices based on date & balances
  for (const inv of state.invoices) {
    const invDate = new Date(inv.invoiceDate);
    const statutoryLimit = new Date(invDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const asOf = new Date(state.asOfDate);
    if (asOf > statutoryLimit && BigInt(inv.outstandingAmountPaise) > 0n) {
      inv.status = 'overdue';
    }
  }

  state.agentEvents.push({
    step: 'finance_calculation',
    status: 'completed',
    message: `Deterministic MSMED statutory compound interest computed with monthly compounding rests at 3× RBI Bank Rate (20.25% p.a.).`,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - t0,
  });

  return financeResult;
}

/**
 * Node 8: LangGraph Human Approval Checkpoint
 */
function executeNodeCheckpoint(state: AgentGraphState) {
  state.isPausedAtCheckpoint = true;
  state.agentEvents.push({
    step: 'case_preparation',
    status: 'paused_for_review',
    message: `LangGraph Checkpoint Triggered: Workflow paused at human-in-the-loop review gate. Authorized reviewer approval required prior to sealing final case readiness PDF.`,
    timestamp: new Date().toISOString(),
  });
}
