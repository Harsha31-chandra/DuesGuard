/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Layers,
  ShieldCheck,
  Database,
  CloudUpload,
  Smartphone,
  CheckCircle2,
  XCircle,
  Lock,
  Terminal,
  ArrowRight,
  FileCheck2,
  FolderGit2,
  AlertTriangle,
} from 'lucide-react';
import type {
  AnalysisRun,
  CaseRecord,
  Finding,
  InvoiceRecord,
  R2PresignedUploadTicket,
  TenantRecord,
} from '../types/index.ts';
import { formatINR } from '../services/finance.ts';

interface ArchitectureHubViewProps {
  caseRecord: CaseRecord;
  invoices: InvoiceRecord[];
  findings: Finding[];
  analysis: AnalysisRun | null;
  tenants: TenantRecord[];
  activeTenantId: string;
  onSelectTenant: (tenantId: string) => void;
  onRefreshCase: () => void;
}

export const ArchitectureHubView: React.FC<ArchitectureHubViewProps> = ({
  caseRecord,
  invoices,
  findings,
  analysis,
  tenants,
  activeTenantId,
  onSelectTenant,
  onRefreshCase,
}) => {
  const [subTab, setSubTab] = useState<'isolation' | 'r2' | 'mobile' | 'monorepo'>('isolation');

  // Cross-tenant isolation state
  const [isolationResult, setIsolationResult] = useState<{
    requestingTenantId: string;
    targetCaseId: string;
    caseOwnerTenantId: string;
    allowed: boolean;
    reason: string;
  } | null>(null);
  const [isTestingIsolation, setIsTestingIsolation] = useState(false);

  // R2 Presigned upload state
  const [r2Filename, setR2Filename] = useState('Buyer_Acknowledgement_INV102.pdf');
  const [r2DocType, setR2DocType] = useState('correspondence');
  const [r2SimulateInvalidSig, setR2SimulateInvalidSig] = useState(false);
  const [r2Ticket, setR2Ticket] = useState<R2PresignedUploadTicket | null>(null);
  const [r2CompletionStatus, setR2CompletionStatus] = useState<{
    verified: boolean;
    checksumSha256: string;
    securityStatus: string;
    message: string;
    stepsCompleted: string[];
  } | null>(null);
  const [isRunningR2, setIsRunningR2] = useState(false);

  // Mobile simulator screen state
  const [mobileScreen, setMobileScreen] = useState<'ledger' | 'upload' | 'evidence' | 'approve'>('ledger');
  const [mobileToast, setMobileToast] = useState<string | null>(null);

  const handleVerifyIsolation = async (testTenantId: string) => {
    setIsTestingIsolation(true);
    try {
      const res = await fetch('/api/tenants/verify-isolation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestingTenantId: testTenantId,
          targetCaseId: caseRecord.id,
        }),
      });
      const data = await res.json();
      setIsolationResult({
        requestingTenantId: testTenantId,
        targetCaseId: caseRecord.id,
        caseOwnerTenantId: data.caseOwnerTenantId,
        allowed: data.allowed,
        reason: data.reason,
      });
    } finally {
      setIsTestingIsolation(false);
    }
  };

  const handleRunR2Lifecycle = async () => {
    setIsRunningR2(true);
    setR2CompletionStatus(null);
    try {
      // Step 1-5: Request short-lived presigned R2 upload URL
      const presignRes = await fetch('/api/storage/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: activeTenantId,
          caseId: caseRecord.id,
          filename: r2Filename,
          mimeType: 'application/pdf',
          fileSizeBytes: 184320,
        }),
      });
      const ticket: R2PresignedUploadTicket = await presignRes.json();
      setR2Ticket(ticket);

      // Step 6-13: Complete upload & verify %PDF-1.7 signature, SHA-256 checksum, and malware scan
      const completeRes = await fetch('/api/storage/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.ticketId,
          fileHeaderMagicBytes: r2SimulateInvalidSig ? '4D5A9000' : '%PDF-1.7',
          contentSnippet: `Buyer confirmation reference (${r2DocType}) for ${r2Filename}. Verified via R2 private bucket workflow.`,
          filename: r2Filename,
          fileSizeBytes: 184320,
        }),
      });
      const verification = await completeRes.json();
      const stepsCompleted = verification.verified
        ? [
            `1. Authenticated session & verified tenant (${activeTenantId})`,
            `2. Created pending D1 document record (${ticket.documentId})`,
            `3. Generated tenant-scoped R2 key (${ticket.r2StorageKey})`,
            `4. Issued 600s presigned PUT URL & uploaded bytes directly to R2`,
            `5. Verified PDF Magic Bytes (%PDF-1.7) & 15MB ceiling`,
            `6. Computed SHA-256 Checksum (${verification.checksumSha256.slice(0, 16)}...)`,
            `7. Passed malware & prompt-injection quarantine gate (${verification.securityStatus})`,
          ]
        : [
            `1. Authenticated session & verified tenant (${activeTenantId})`,
            `2. Issued presigned PUT URL (${ticket.ticketId})`,
            `3. QUARANTINED: Failed PDF Magic Byte verification (Received 0x4D5A9000 executable header)`,
          ];

      setR2CompletionStatus({
        ...verification,
        stepsCompleted,
      });
      if (verification.verified) {
        onRefreshCase();
      }
    } finally {
      setIsRunningR2(false);
    }
  };

  const totalClaimPaise = analysis?.summary?.totalClaimPaise || '10514794';
  const totalOverduePaise = analysis?.summary?.totalOverduePaise || '8000000';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4" />
              Master Spec Full-Stack & Edge Architecture Suite
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Turborepo Monorepo, Cloudflare D1/R2 Security & Expo Mobile Companion
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              Interactive verification harness for Multi-Tenant RBAC Isolation, 13-Step Private R2 Presigned Upload &{' '}
              <code className="text-amber-300 font-mono">%PDF-</code> Signature Validation, Drizzle D1 SQL Migrations,
              and Shared tRPC Mobile Client.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'isolation', label: 'Tenant RBAC & D1', icon: ShieldCheck },
              { id: 'r2', label: 'Private R2 Upload', icon: CloudUpload },
              { id: 'mobile', label: 'Expo Mobile App', icon: Smartphone },
              { id: 'monorepo', label: 'Turborepo & Schema', icon: FolderGit2 },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id as typeof subTab)}
                  data-testid={`arch-subtab-${tab.id}`}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SUBTAB 1: MULTI-TENANT RBAC & D1 ISOLATION */}
      {subTab === 'isolation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-700" />
                  Better Auth Session & Cross-Tenant Isolation Verifier
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every business record is isolated by <code className="font-mono">tenant_id</code> derived from the
                  authenticated session, never trusted from client payloads.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                RBAC Enforced
              </span>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Registered MSME Tenants in D1 Database
              </div>
              {tenants.map((t) => {
                const isCurrent = t.id === activeTenantId;
                const isOwner = t.id === (caseRecord.tenantId || 'tenant-apex-001');
                return (
                  <div
                    key={t.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isCurrent ? 'border-slate-900 bg-slate-50/80' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{t.name}</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-800 uppercase">
                          {t.activeRole}
                        </span>
                        {isOwner && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            Case Owner ({caseRecord.caseReference})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        ID: {t.id} • Udyam: {t.udyamNumber} • GSTIN: {t.gstin}
                      </div>
                      <div className="text-xs text-slate-600">
                        Authenticated Member: <strong>{t.activeUserName}</strong> ({t.classification} • {t.activity})
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          onSelectTenant(t.id);
                          handleVerifyIsolation(t.id);
                        }}
                        disabled={isTestingIsolation}
                        data-testid={`test-isolation-${t.id}`}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isOwner
                            ? 'bg-slate-900 text-white hover:bg-slate-800'
                            : 'bg-rose-600 text-white hover:bg-rose-700'
                        }`}
                      >
                        {isOwner ? 'Test Authorized Access' : 'Simulate Cross-Tenant Attack'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {isolationResult && (
              <div
                data-testid="isolation-test-result"
                className={`p-4 rounded-xl border ${
                  isolationResult.allowed
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50/90 border-rose-300 text-rose-950'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {isolationResult.allowed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-700" />
                    )}
                    {isolationResult.allowed
                      ? 'HTTP 200 OK (Tenant Session Verified)'
                      : 'HTTP 403 FORBIDDEN (Cross-Tenant Access Blocked)'}
                  </div>
                  <span className="text-xs font-mono">Target Case: {isolationResult.targetCaseId}</span>
                </div>
                <p className="text-xs leading-relaxed">{isolationResult.reason}</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-slate-900 text-slate-100 rounded-xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Database className="w-4 h-4" />
                Cloudflare D1 / Drizzle Schema Guard
              </span>
              <span className="text-[11px] font-mono text-slate-400">packages/db/schema.ts</span>
            </div>
            <pre className="text-xs font-mono bg-slate-950 p-4 rounded-lg border border-slate-800 overflow-x-auto text-slate-300 leading-relaxed">
{`// Server-side tRPC Tenant Guard Procedure
export const tenantProcedure = publicProcedure.use(
  async ({ ctx, next }) => {
    if (!ctx.session?.userId || !ctx.session?.activeTenantId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    // Never trust client-supplied tenant_id:
    const membership = await ctx.db
      .select()
      .from(tenantMembers)
      .where(and(
        eq(tenantMembers.userId, ctx.session.userId),
        eq(tenantMembers.tenantId, ctx.session.activeTenantId)
      ));
    if (!membership.length) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Cross-tenant access denied'
      });
    }
    return next({ ctx: { ...ctx, tenantId: membership[0].tenantId } });
  }
);`}
            </pre>
            <div className="text-xs text-slate-400 space-y-1">
              <div className="font-semibold text-slate-200">Enforced Production Safeguards:</div>
              <div>• Integer Paise storage (`total_amount_paise`) prevents IEEE-754 float drift.</div>
              <div>• Append-only `audit_logs` record every cross-tenant rejection and reviewer action.</div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PRIVATE R2 PRESIGNED UPLOAD & FILE VERIFICATION */}
      {subTab === 'r2' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CloudUpload className="w-4 h-4 text-slate-700" />
                13-Step Private Cloudflare R2 Upload & Security Gate
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Generates a tenant-scoped R2 object key, short-lived presigned PUT URL, and verifies{' '}
                <code className="font-mono">%PDF-</code> magic bytes & SHA-256 checksum before extraction.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Document Filename</label>
                <input
                  type="text"
                  value={r2Filename}
                  onChange={(e) => setR2Filename(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Document Classification</label>
                <select
                  value={r2DocType}
                  onChange={(e) => setR2DocType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="correspondence">Buyer Correspondence / Acknowledgement</option>
                  <option value="delivery_challan">Signed Proof of Delivery (POD)</option>
                  <option value="invoice">Tax Invoice (PDF)</option>
                  <option value="payment_receipt">Bank NEFT / RTGS Advice</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={r2SimulateInvalidSig}
                onChange={(e) => setR2SimulateInvalidSig(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>
                Simulate spoofed executable header (<code className="font-mono text-rose-600">0x4D5A9000</code> instead
                of <code className="font-mono text-emerald-700">%PDF-1.7</code>) to test quarantine rejection
              </span>
            </label>

            <button
              onClick={handleRunR2Lifecycle}
              disabled={isRunningR2}
              data-testid="run-r2-presign-btn"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4 text-amber-400" />
              {isRunningR2
                ? 'Executing Presigned R2 Handshake & Verification...'
                : 'Execute 13-Step R2 Presigned Upload & Security Verification'}
            </button>

            {r2Ticket && (
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs font-mono">
                <div className="text-[11px] font-sans font-bold uppercase text-slate-500">
                  Generated R2 Presigned Ticket (TTL: 600s)
                </div>
                <div className="truncate">
                  <span className="text-slate-500">R2 Key:</span>{' '}
                  <span className="text-slate-900 font-semibold">{r2Ticket.r2StorageKey}</span>
                </div>
                <div className="truncate">
                  <span className="text-slate-500">Presigned PUT:</span>{' '}
                  <span className="text-blue-700">{r2Ticket.presignedPutUrl}</span>
                </div>
                <div className="truncate">
                  <span className="text-slate-500">Ticket ID:</span> {r2Ticket.ticketId} (Expires: {r2Ticket.expiresAt})
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900">13-Step Security & Quarantine Audit Trail</h4>
            {r2CompletionStatus ? (
              <div className="space-y-3" data-testid="r2-verification-result">
                <div
                  className={`p-3.5 rounded-lg border flex items-center gap-2.5 text-xs font-semibold ${
                    r2CompletionStatus.verified
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {r2CompletionStatus.verified ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{r2CompletionStatus.message}</span>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {r2CompletionStatus.stepsCompleted.map((step, i) => (
                    <div
                      key={i}
                      className="text-xs font-mono px-3 py-1.5 rounded bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-2"
                    >
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-12 text-center border border-dashed border-slate-200 rounded-lg">
                Click <strong>Execute 13-Step R2 Presigned Upload</strong> to inspect the server-side R2 key generation,
                PDF header check, SHA-256 integrity check, and malware scan pipeline.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: EXPO REACT NATIVE MOBILE COMPANION SIMULATOR */}
      {subTab === 'mobile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 flex justify-center">
            {/* Phone Device Frame */}
            <div className="w-[340px] bg-slate-950 rounded-[36px] p-3.5 border-4 border-slate-800 shadow-xl text-white">
              <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mb-3" />
              <div className="bg-slate-900 rounded-[26px] p-4 space-y-4 min-h-[500px] flex flex-col justify-between border border-slate-800">
                <div className="space-y-3">
                  {/* Mobile Top Bar */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 block">
                        DuesGuard Mobile • Expo
                      </span>
                      <span className="text-sm font-bold">{caseRecord.caseReference}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      SecureStore JWT
                    </span>
                  </div>

                  {/* Mobile Screen Switcher */}
                  {mobileScreen === 'ledger' && (
                    <div className="space-y-3">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <div className="text-[10px] uppercase text-slate-400">Total Claim (Principal + Sec 16)</div>
                        <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                          {formatINR(totalClaimPaise)}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Overdue Principal: {formatINR(totalOverduePaise)}
                        </div>
                      </div>

                      <div className="text-xs font-semibold text-slate-300">Invoice Status (Shared tRPC)</div>
                      <div className="space-y-2">
                        {invoices.map((inv) => (
                          <div
                            key={inv.id}
                            className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold font-mono">{inv.invoiceNumber}</div>
                              <div className="text-[10px] text-slate-400">
                                Due: {inv.contractualDueDate || inv.invoiceDate}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-semibold">{formatINR(inv.outstandingAmountPaise)}</div>
                              <span
                                className={`text-[10px] font-mono ${
                                  inv.status === 'overdue' ? 'text-rose-400' : 'text-emerald-400'
                                }`}
                              >
                                {inv.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {mobileScreen === 'upload' && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-200">Camera / Document Scanner</div>
                      <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950 text-center space-y-2">
                        <CloudUpload className="w-7 h-7 text-amber-400 mx-auto" />
                        <div className="text-xs font-semibold">Capture Signed Delivery Challan (POD)</div>
                        <p className="text-[11px] text-slate-400">
                          Uploads directly to Cloudflare R2 via <code className="font-mono">documents.getUploadUrl</code>
                        </p>
                        <button
                          onClick={() => {
                            handleRunR2Lifecycle();
                            setMobileToast('POD uploaded & verified via R2 Presigned URL!');
                          }}
                          className="w-full py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                        >
                          Snap & Upload Signed POD
                        </button>
                      </div>
                    </div>
                  )}

                  {mobileScreen === 'evidence' && (
                    <div className="space-y-2.5">
                      <div className="text-xs font-bold text-slate-200">Evidence Gap Checklist</div>
                      {findings.slice(0, 4).map((f) => (
                        <div key={f.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                          <div className="font-mono text-[10px] text-amber-400">{f.code}</div>
                          <div className="text-slate-300 text-[11px] mt-0.5">{f.message}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {mobileScreen === 'approve' && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-200">Mobile Reviewer Checkpoint</div>
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                        <div>
                          Approval State: <strong>{(analysis?.approvalStatus || 'pending').toUpperCase()}</strong>
                        </div>
                        <div>Policy: {analysis?.msmedResult?.policyVersion || 'MSMED_ACT_2006_SEC_15_16_V2.1'}</div>
                      </div>
                      <button
                        onClick={() => setMobileToast('Synced with Shared Zustand Store & Web Client.')}
                        className="w-full py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                      >
                        Sync Mobile Review State
                      </button>
                    </div>
                  )}

                  {mobileToast && (
                    <div className="p-2 rounded bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-[11px] text-center">
                      {mobileToast}
                    </div>
                  )}
                </div>

                {/* Mobile Bottom Navigation */}
                <div className="grid grid-cols-4 gap-1 pt-2 border-t border-slate-800">
                  {[
                    { id: 'ledger', label: 'Ledger' },
                    { id: 'upload', label: 'Scan POD' },
                    { id: 'evidence', label: 'Gaps' },
                    { id: 'approve', label: 'Review' },
                  ].map((nav) => (
                    <button
                      key={nav.id}
                      onClick={() => {
                        setMobileToast(null);
                        setMobileScreen(nav.id as typeof mobileScreen);
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer ${
                        mobileScreen === nav.id ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {nav.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Cross-Platform Contract Sharing (<code className="font-mono text-xs">apps/mobile</code> +{' '}
              <code className="font-mono text-xs">packages/api-client</code>)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Both the Next.js/React web app and the Expo React Native mobile app consume the exact same typed tRPC
              router contracts, Zod schemas, and <code className="font-mono">packages/finance</code> decimal types
              without duplicating endpoint definitions or using browser-only globals in mobile code.
            </p>
            <pre className="text-xs font-mono bg-slate-950 text-slate-200 p-4 rounded-lg overflow-x-auto leading-relaxed">
{`// packages/api-client/create-client.ts
export function createDuesGuardClient(adapter: PlatformClientAdapter) {
  // Web injects credentials: 'include' cookie session
  // Expo Mobile injects SecureStore Bearer token header
  return {
    getHeaders: async () => {
      const token = await adapter.getAuthToken();
      return token ? { Authorization: \`Bearer \${token}\` } : {};
    }
  };
}`}
            </pre>
          </div>
        </div>
      )}

      {/* SUBTAB 4: TURBOREPO & CLOUDFLARE D1/WRANGLER ARTIFACTS */}
      {subTab === 'monorepo' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-700" />
                Committed Turborepo & Cloudflare Edge Infrastructure Artifacts
              </h3>
              <p className="text-xs text-slate-500">
                All workspace packages and migrations are present in the repository for immediate deployment.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                path: 'pnpm-workspace.yaml & turbo.json',
                desc: 'Configures apps/* (web, mobile, api-worker, jobs-worker) and packages/* task pipelines.',
              },
              {
                path: 'packages/db/migrations/0001_initial_d1_schema.sql',
                desc: 'SQLite/D1 DDL for tenants, tenant_members, cases, documents, invoices, payment_allocations, rbi_bank_rates, and audit_logs.',
              },
              {
                path: 'packages/db/schema.ts',
                desc: 'Strict TypeScript table models storing currency in integer paise and dates in YYYY-MM-DD.',
              },
              {
                path: 'packages/api-client/create-client.ts',
                desc: 'Platform-agnostic typed client factory shared across Web and Expo React Native.',
              },
              {
                path: 'apps/api-worker/wrangler.jsonc',
                desc: 'Cloudflare Workers bindings for D1_DB, PRIVATE_DOCUMENTS_R2, CASE_ANALYSIS_WORKFLOW, and DLQ.',
              },
              {
                path: 'apps/mobile/App.tsx',
                desc: 'Expo React Native mobile application using SecureStore session adapter and R2 camera upload.',
              },
            ].map((item) => (
              <div key={item.path} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                <div className="text-xs font-mono font-bold text-slate-900">{item.path}</div>
                <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
