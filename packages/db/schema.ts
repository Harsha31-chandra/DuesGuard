/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * @duesguard/db — Cloudflare D1 SQLite Relational Schema & Multi-Tenant RBAC Specification
 * Defines `payments` and `payment_allocations` tables storing all currency as integer `paise`,
 * alongside organizations, branches, cases, invoices, deliveries, and evidence links.
 */

export const D1_RELATIONAL_DDL_PAYMENTS_AND_ALLOCATIONS = `
-- ============================================================================
-- DUESGUARD AI — CLOUDFLARE D1 (SQLite) DYNAMIC PAYMENT LEDGER & ALLOCATIONS
-- CRITICAL BOUNDARY: Evidence preparation only. No payment gateway transfers.
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  invoice_id TEXT,
  payment_date TEXT NOT NULL,           -- ISO-8601 YYYY-MM-DD
  amount_paise INTEGER NOT NULL,        -- Strict integer paise (₹1.00 = 100 paise)
  payment_method TEXT NOT NULL DEFAULT 'UPI', -- UPI | NEFT | RTGS | IMPS | CHEQUE
  reference TEXT NOT NULL,              -- External UPI Txn ID / Bank UTR
  notes TEXT,
  payment_document_id TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_case ON payments(tenant_id, case_id);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  allocated_amount_paise INTEGER NOT NULL, -- Strict integer paise allocated to invoice_id
  allocation_date TEXT NOT NULL,           -- Exact date principal was reduced for § 16 rests
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);

-- ============================================================================
-- HACKATHON DEMO QR PAYMENT SYSTEM (ISOLATED FROM PRODUCTION LEDGER)
-- Stores ONLY SHA-256 token hashes and isolated DEMO simulated transactions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS demo_qr_payment_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,      -- SHA-256 hex digest of cryptographic token
  organization_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,             -- ISO-8601 expiration timestamp
  revoked_at TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | expired | revoked
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_demo_qr_token_hash ON demo_qr_payment_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_demo_qr_invoice ON demo_qr_payment_tokens(case_id, invoice_id);

CREATE TABLE IF NOT EXISTS demo_payment_simulations (
  id TEXT PRIMARY KEY,                  -- e.g. DEMO-TXN-20261027-8841
  token_id TEXT NOT NULL REFERENCES demo_qr_payment_tokens(id),
  organization_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  payment_mode TEXT NOT NULL,           -- FULL_DEMO | PARTIAL_DEMO
  simulated_amount_paise INTEGER NOT NULL,
  previous_balance_paise INTEGER NOT NULL,
  remaining_balance_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'DEMO',  -- Strictly 'DEMO' — never a real captured payment
  payer_note TEXT,
  simulated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_demo_simulations_invoice ON demo_payment_simulations(case_id, invoice_id);
`;

export { db } from '../../src/services/database.ts';
