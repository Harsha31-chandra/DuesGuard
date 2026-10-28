/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CaseStatus =
  | 'draft'
  | 'documents_uploaded'
  | 'analyzing'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'archived';

export type DocumentType =
  | 'invoice'
  | 'purchase_order'
  | 'delivery_challan'
  | 'lorry_receipt'
  | 'proof_of_delivery'
  | 'payment_receipt'
  | 'buyer_correspondence'
  | 'udyam_certificate'
  | 'gst_certificate'
  | 'other_evidence';

export interface ProvenanceRef {
  documentId: string;
  documentName: string;
  pageNumber: number;
  extractedValue: string;
  confidence: number;
  extractedAt: string;
  modelId: string;
  fieldName: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPricePaise: string;
  taxRatePercent: number;
  taxAmountPaise: string;
  lineTotalPaise: string;
  sourcePage: number;
}

export type GstSupplyType = 'INTRA_STATE' | 'INTER_STATE';

export interface InvoiceRecord {
  id: string;
  caseId: string;
  documentId: string;
  invoiceNumber: string;
  buyer: string;
  seller: string;
  buyerGstin?: string;
  sellerGstin?: string;
  buyerState?: string;
  sellerState?: string;
  buyerEmail?: string;
  customerId?: string;
  supplyType?: GstSupplyType;
  subtotalPaise?: string;
  cgstPaise?: string;
  sgstPaise?: string;
  igstPaise?: string;
  totalTaxPaise?: string;
  invoiceDate: string; // YYYY-MM-DD
  contractualDueDate?: string;
  agreedPaymentDays?: number; // e.g. 30, 45, 60
  totalAmountPaise: string;
  paidAmountPaise: string;
  outstandingAmountPaise: string;
  currency: string;
  poReference?: string;
  deliveryReference?: string;
  lineItems: LineItem[];
  provenance: Record<string, ProvenanceRef>;
  status: 'pending' | 'overdue' | 'paid' | 'disputed';
}

export interface PurchaseOrderRecord {
  id: string;
  caseId: string;
  documentId: string;
  poNumber: string;
  buyer: string;
  seller: string;
  poDate: string;
  poTotalPaise: string;
  currency: string;
  provenance: Record<string, ProvenanceRef>;
}

export interface DeliveryRecord {
  id: string;
  caseId: string;
  documentId: string;
  deliveryReference: string;
  challanNumber?: string;
  lrNumber?: string;
  podReference?: string;
  deliveryDate: string;
  actualAcceptanceDate?: string;
  buyerObjectionDate?: string;
  objectionResolutionDate?: string;
  provenance: Record<string, ProvenanceRef>;
}

export type ExternalPaymentMethod = 'UPI' | 'NEFT' | 'RTGS' | 'IMPS' | 'CHEQUE';

export interface PaymentAllocationRecord {
  id: string;
  paymentId: string;
  invoiceId: string;
  amountPaise: string;
  paymentDate: string;
}

export interface PaymentRecord {
  id: string;
  caseId: string;
  invoiceId?: string;
  paymentDate: string;
  amountPaise: string;
  reference: string;
  paymentMethod?: ExternalPaymentMethod;
  notes?: string;
  paymentDocumentId?: string;
  allocations?: PaymentAllocationRecord[];
  recordedAt?: string;
}

export interface EvidenceLink {
  id: string;
  caseId: string;
  sourceEntityType: 'purchase_order' | 'invoice' | 'delivery' | 'payment';
  sourceEntityId: string;
  sourceLabel: string;
  targetEntityType: 'invoice' | 'delivery' | 'payment' | 'buyer_acknowledgement';
  targetEntityId?: string;
  targetLabel: string;
  relationshipType: 'po_to_invoice' | 'invoice_to_delivery' | 'invoice_to_payment';
  verificationStatus: 'matched' | 'missing' | 'contradictory' | 'unverified' | 'needs_review';
  discrepancyDetails?: string;
}

export interface Finding {
  id: string;
  caseId: string;
  agentName: string;
  severity: 'info' | 'warning' | 'critical';
  code: string;
  message: string;
  sourceDocumentIds: string[];
  pageNumbers?: number[];
  status: 'needs_review' | 'verified' | 'resolved' | 'dismissed';
  reviewerNotes?: string;
  createdAt: string;
}

export interface AgentEvent {
  step:
    | 'document_classification'
    | 'document_extraction'
    | 'invoice_validation'
    | 'msme_verification'
    | 'evidence_reconciliation'
    | 'finance_calculation'
    | 'case_preparation';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused_for_review';
  message: string;
  timestamp: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface RbiBankRateEntry {
  effectiveDate: string;
  bankRatePercent: string; // e.g. "6.75"
  statutoryRatePercent: string; // 3x = "20.25"
  sourceReference: string;
  verificationTimestamp: string;
}

export interface MonthlyRestPeriod {
  periodIndex: number;
  monthLabel: string;
  startDate: string;
  endDate: string;
  days: number;
  rbiBankRatePercent: string;
  statutoryRatePercent: string;
  openingPrincipalPaise: string;
  interestAccruedPaise: string;
  closingBalancePaise: string;
  cumulativeInterestPaise: string;
  formulaNotes: string;
}

export interface MsmedCalculationResult {
  principalAmountPaise: string;
  totalPaidPaise: string;
  outstandingAmountPaise: string;
  totalOverduePaise: string;
  acceptanceDate: string | null;
  appointedDay: string | null;
  contractualDueDate: string | null;
  statutoryDeadline: string | null;
  interestStartDate: string | null;
  annualInterestRate: string | null; // e.g. "20.25%"
  compoundedInterestPaise: string;
  totalClaimAmountPaise: string; // outstanding + compounded interest
  applicableRatePeriods: MonthlyRestPeriod[];
  paymentAllocations: Array<{
    paymentId: string;
    invoiceId: string;
    amountPaise: string;
    paymentDate: string;
  }>;
  assumptions: string[];
  warnings: string[];
  policyVersion: string;
  requiresHumanReview: boolean;
}

export interface UdyamVerificationResult {
  udyamNumber: string;
  registrationDate: string;
  enterpriseClassification: 'Micro' | 'Small' | 'Medium' | 'Unknown';
  registeredActivity: 'Manufacturing' | 'Services' | 'Trading' | 'Mixed';
  status:
    | 'registration_verified'
    | 'registration_unverified'
    | 'registration_missing'
    | 'registration_date_conflict'
    | 'classification_needs_review'
    | 'activity_needs_review'
    | 'potentially_ineligible'
    | 'human_review_required';
  warnings: string[];
  conflictDetails?: string;
  verifiedAt: string;
}

export interface GstinVerificationResult {
  gstin: string;
  syntaxValid: boolean;
  checksumValid: boolean;
  stateCode: string;
  panNumber: string;
  entityCode: string;
  status: 'verified_format' | 'invalid_format' | 'not_provided';
  warnings: string[];
}

export interface CaseDocument {
  id: string;
  tenantId?: string;
  caseId: string;
  filename: string;
  documentType: DocumentType;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  extractionStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review';
  pageCount: number;
  contentSnippet?: string;
  fileDataUrl?: string;
  checksumSha256?: string;
  r2StorageKey?: string;
  uploadStatus?: 'pending_upload' | 'uploaded' | 'verified' | 'quarantined';
  securityStatus?: 'pending_scan' | 'verified_clean' | 'rejected_signature';
}

export interface CaseRecord {
  id: string;
  tenantId?: string;
  businessName: string;
  caseReference: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  buyerName: string;
  buyerGstin?: string;
  sellerName: string;
  sellerGstin?: string;
  sellerUdyamNumber?: string;
  sellerUdyamRegDate?: string;
  sellerClassification: 'Micro' | 'Small' | 'Medium';
  sellerActivity: 'Manufacturing' | 'Services' | 'Trading';
  contractualPaymentDays: number;
  disputeNotes?: string;
}

export interface AnalysisRun {
  id: string;
  caseId: string;
  status: 'running' | 'paused_at_checkpoint' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  agentEvents: AgentEvent[];
  findings: Finding[];
  evidenceLinks: EvidenceLink[];
  summary: {
    totalInvoicedPaise: string;
    totalPaidPaise: string;
    totalPendingPaise: string;
    totalOverduePaise: string;
    totalInterestPaise: string;
    totalClaimPaise: string;
    currency: string;
    invoiceCount: number;
    overdueCount: number;
  };
  msmedResult?: MsmedCalculationResult;
  udyamCheck?: UdyamVerificationResult;
  gstinChecks?: {
    buyer?: GstinVerificationResult;
    seller?: GstinVerificationResult;
  };
  approvalStatus: 'pending' | 'approved' | 'rejected';
  reviewerName?: string;
  reviewerDesignation?: string;
  reviewerNotes?: string;
  reviewedAt?: string;
  reportId?: string;
}

export type TenantRole = 'owner' | 'finance_lead' | 'reviewer' | 'auditor';

export interface TenantRecord {
  id: string;
  name: string;
  udyamNumber: string;
  gstin: string;
  classification: 'Micro' | 'Small' | 'Medium';
  activity: 'Manufacturing' | 'Services' | 'Trading';
  activeRole: TenantRole;
  activeUserName: string;
}

export type ChatModelTier = 'gemini-3.1-flash-lite' | 'gemini-3.8-flash' | 'gemini-4-argon';

export type ChatRolePersona =
  | 'msme_evidence_analyst'
  | 'statutory_compliance_specialist'
  | 'monorepo_cloud_architect';

export interface ChatMessage {
  id: string;
  caseId: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelTier: ChatModelTier;
  resolvedModel?: string;
  rolePersona: ChatRolePersona;
  latencyMs?: number;
  citations?: string[];
}

export interface R2PresignedUploadTicket {
  ticketId: string;
  documentId: string;
  tenantId: string;
  caseId: string;
  r2StorageKey: string;
  presignedPutUrl: string;
  expiresAt: string;
  expectedMimeType: string;
  maxBytes: number;
}

export type OrganizationRole = 'owner' | 'admin' | 'accountant' | 'case_reviewer' | 'read_only';

export type OrganizationActionPermission =
  | 'org:manage_settings'
  | 'org:manage_members'
  | 'branch:create'
  | 'document:upload'
  | 'invoice:manage'
  | 'finding:review'
  | 'report:approve'
  | 'case:view';

export interface BranchRecord {
  id: string;
  organizationId: string;
  branchName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactPhone?: string;
  caseCount: number;
  createdAt: string;
}

export interface OrganizationRecord {
  id: string;
  legalName: string;
  displayName: string;
  organizationType: 'Micro Manufacturing' | 'Small Manufacturing' | 'Services Enterprise' | 'Trading Solutions';
  gstin?: string;
  maskedGstin: string;
  gstinValidationStatus: 'verified_format' | 'invalid_format' | 'not_provided';
  udyamNumber?: string;
  udyamRegistrationDate?: string;
  registeredAddress: string;
  contactEmail: string;
  contactPhone: string;
  branches: BranchRecord[];
  createdAt: string;
}

export interface OrganizationMemberRecord {
  id: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  organizationId: string;
  role: OrganizationRole;
  allBranchesAccess: boolean;
  allowedBranchIds: string[];
  membershipStatus: 'active' | 'invited' | 'suspended' | 'revoked';
  joinedAt: string;
}

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorVerified: boolean;
  recoveryCodes: string[];
  lastOrganizationId: string;
  lastBranchId: string; // 'ALL_BRANCHES' or specific branchId
}

export interface ActiveWorkspaceSession {
  user: AuthenticatedUser;
  activeOrganization: OrganizationRecord;
  activeBranchId: string; // 'ALL_BRANCHES' or specific branchId
  activeBranchName: string;
  activeRole: OrganizationRole;
  permittedActions: OrganizationActionPermission[];
  accessibleOrganizations: Array<{
    organization: OrganizationRecord;
    role: OrganizationRole;
    allBranchesAccess: boolean;
    allowedBranchIds: string[];
  }>;
}

export type DemoQrTokenStatus = 'active' | 'expired' | 'revoked';

export interface DemoQrTokenRecord {
  id: string;
  tokenHash: string; // SHA-256 hex digest — raw token is never persisted in DB
  organizationId: string;
  branchId: string;
  caseId: string;
  invoiceId: string;
  createdByUserId: string;
  expiresAt: string;
  revokedAt?: string;
  status: DemoQrTokenStatus;
  createdAt: string;
}

export interface DemoPaymentSimulationRecord {
  id: string; // e.g., DEMO-TXN-20261027-4812
  tokenId: string;
  organizationId: string;
  caseId: string;
  invoiceId: string;
  invoiceNumber: string;
  paymentMode: 'FULL_DEMO' | 'PARTIAL_DEMO';
  simulatedAmountPaise: string;
  previousBalancePaise: string;
  remainingBalancePaise: string;
  status: 'DEMO';
  payerNote?: string;
  simulatedAt: string;
}

export interface DemoInvoicePaymentView {
  tokenId: string;
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
  expiresAt: string;
  tokenStatus: DemoQrTokenStatus;
  demoModeBadge: 'DEMO MODE — NO REAL PAYMENT PROCESSED';
  simulatedTransactions: DemoPaymentSimulationRecord[];
}

export interface DemoPaymentReceiptData {
  receiptTitle: 'DEMO RECEIPT – NO REAL PAYMENT PROCESSED';
  demoTransactionId: string;
  invoiceNumber: string;
  sellerName: string;
  buyerName: string;
  paymentMode: 'FULL_DEMO' | 'PARTIAL_DEMO';
  previousBalancePaise: string;
  simulatedPaymentAmountPaise: string;
  remainingBalancePaise: string;
  status: 'DEMO';
  simulatedAt: string;
  payerNote?: string;
  disclaimer: string;
}

// --- MERGED DUESGAURD ERP, GST BILLING & OVERDUE REMINDER TYPES ---

export interface CustomerRecord {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phone: string;
  state: string;
  gstin?: string;
  billingAddress: string;
  creditDays: number;
  createdAt: string;
}

export interface ProductItemRecord {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  hsnSacCode: string;
  unit: 'PCS' | 'SETS' | 'KGS' | 'HRS' | 'LOTS' | string;
  costPricePaise: string; // Internal cost price (private to MSME)
  sellingPricePaise: string; // Client billing price
  gstRatePercent: number; // 0, 5, 12, 18, 28
  status: 'active' | 'archived';
  createdAt: string;
}

export interface GstLineItemCalculation {
  id: string;
  productId?: string;
  sku?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPricePaise: string;
  costPricePaise: string;
  taxRatePercent: number;
  subtotalPaise: string;
  cgstPaise: string;
  sgstPaise: string;
  igstPaise: string;
  taxAmountPaise: string;
  lineTotalPaise: string;
}

export interface GstInvoiceCalculation {
  supplyType: GstSupplyType;
  sellerState: string;
  buyerState: string;
  subtotalPaise: string;
  cgstPaise: string;
  sgstPaise: string;
  igstPaise: string;
  totalTaxPaise: string;
  grandTotalPaise: string;
  internalCostTotalPaise: string;
  estimatedGrossMarginPaise: string;
  lineItems: GstLineItemCalculation[];
}

export type EmailReminderRuleType =
  | 'upcoming_3d'
  | 'due_today'
  | 'overdue_1d'
  | 'overdue_7d'
  | 'overdue_15d_escalation'
  | 'manual_notice';

export type ReminderDeliveryChannel = 'email' | 'whatsapp' | 'sms' | 'multi_channel';

export interface EmailReminderLogRecord {
  id: string;
  caseId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId?: string;
  customerName: string;
  recipientEmail: string;
  recipientPhone?: string;
  channel?: ReminderDeliveryChannel;
  reminderType: EmailReminderRuleType;
  subject: string;
  bodyHtml: string;
  messageText?: string;
  paymentPortalUrl?: string;
  statutoryInterestPaise?: string;
  totalClaimablePaise?: string;
  status: 'sent' | 'mock_delivered' | 'failed';
  providerMessageId: string;
  daysOverdue: number;
  balanceDuePaise: string;
  sentAt: string;
}

export interface FiveBucketAgingDatum {
  bucketKey: 'current' | 'days_1_7' | 'days_8_15' | 'days_16_45' | 'days_gt_45';
  bucketLabel: string;
  shortLabel: string;
  amountPaise: string;
  amountInr: number;
  invoiceCount: number;
  invoiceRefs: string[];
  statutoryNote: string;
}




