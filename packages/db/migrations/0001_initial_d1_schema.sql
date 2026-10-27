-- Cloudflare D1 / SQLite Production Migration: 0001_initial_d1_schema.sql
-- DuesGuard AI — Multi-Tenant MSMED Financial Intelligence & Evidence Platform

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trade_name TEXT,
  udyam_number TEXT,
  udyam_reg_date TEXT,
  classification TEXT NOT NULL DEFAULT 'Micro',
  activity TEXT NOT NULL DEFAULT 'Manufacturing',
  gstin TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'finance_lead', 'reviewer', 'auditor')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  case_reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_gstin TEXT,
  seller_name TEXT NOT NULL,
  seller_gstin TEXT,
  seller_udyam_number TEXT,
  seller_udyam_reg_date TEXT,
  seller_classification TEXT NOT NULL,
  seller_activity TEXT NOT NULL,
  contractual_payment_days INTEGER NOT NULL DEFAULT 30,
  dispute_notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  document_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  r2_storage_key TEXT NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'completed',
  security_status TEXT NOT NULL DEFAULT 'verified_clean',
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  page_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  buyer TEXT NOT NULL,
  seller TEXT NOT NULL,
  buyer_gstin TEXT,
  seller_gstin TEXT,
  invoice_date TEXT NOT NULL,
  due_date TEXT,
  total_amount_paise TEXT NOT NULL,
  paid_amount_paise TEXT NOT NULL DEFAULT '0',
  outstanding_amount_paise TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  po_reference TEXT,
  delivery_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS evidence_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT,
  relationship_type TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  review_notes TEXT
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  severity TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_review',
  reviewer_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rbi_bank_rates (
  effective_date TEXT PRIMARY KEY,
  bank_rate_percent TEXT NOT NULL,
  statutory_rate_percent TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  verified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cases_tenant ON cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_case ON documents(tenant_id, case_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_case ON invoices(tenant_id, case_id);
CREATE INDEX IF NOT EXISTS idx_findings_tenant_case ON findings(tenant_id, case_id);
