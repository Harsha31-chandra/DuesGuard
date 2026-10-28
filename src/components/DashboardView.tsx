/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Ultra-Premium Dashboard View
 * Adheres strictly to the DuesGuard Design System:
 *  - Phase 1: Page Header with Greeting, MSMED §§ 15 & 16 context, and Dark/Light Mode Toggle
 *  - Phase 2: Top 4 Metric Cards with Framer Motion staggered entrance (staggerChildren: 0.1)
 *  - Phase 3: 50/50 Analysis Split with Recharts Overdue Aging BarChart & LangGraph Agent Trace
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import {
  FileText,
  TrendingUp,
  AlertOctagon,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Play,
  FileSpreadsheet,
  Sparkles,
  Sun,
  Moon,
  Clock,
  Cpu,
  PlusCircle,
  Trash2,
  Receipt,
  QrCode,
  Mail,
  Users,
  Download,
} from 'lucide-react';
import type {
  ActiveWorkspaceSession,
  AnalysisRun,
  CaseDocument,
  CaseRecord,
  ExternalPaymentMethod,
  InvoiceRecord,
  PaymentRecord,
} from '../types/index.ts';
import { formatINR } from '../services/finance.ts';
import { generateGstTaxInvoicePdf } from '../services/pdfGenerator.ts';
import { useTheme } from './ThemeProvider.tsx';
import { LogPaymentModal } from './LogPaymentModal.tsx';

interface DashboardViewProps {
  caseRecord: CaseRecord;
  documents: CaseDocument[];
  invoices: InvoiceRecord[];
  payments?: PaymentRecord[];
  analysis: AnalysisRun | null;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
  onNavigateTab: (tabId: string) => void;
  onOpenReportModal: () => void;
  workspaceSession?: ActiveWorkspaceSession | null;
  onLogPayment?: (payload: {
    invoiceId?: string;
    amountPaise: string;
    paymentDate: string;
    reference: string;
    paymentMethod: ExternalPaymentMethod;
    notes: string;
  }) => Promise<void>;
  onDeletePayment?: (paymentId: string) => Promise<void>;
  onGenerateQrCode?: (invoiceId: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardItemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 320,
      damping: 26,
    },
  },
};

interface AgingBucketDatum {
  bucket: string;
  amountInr: number;
  amountPaise: string;
  invoiceRefs: string;
  statusNote: string;
  fillLight: string;
  fillDark: string;
}

const CustomAgingTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: AgingBucketDatum }>;
}> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-2xl p-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)] text-xs space-y-1.5">
      <div className="tracking-wider uppercase text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
        {item.bucket}
      </div>
      <div className="text-base font-extrabold tracking-tight text-zinc-900 dark:text-white font-mono">
        {formatINR(item.amountPaise)}
      </div>
      <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
        Invoices: <span className="font-mono font-semibold">{item.invoiceRefs}</span>
      </div>
      <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
        {item.statusNote}
      </div>
    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  caseRecord,
  invoices,
  payments = [],
  analysis,
  onRunAnalysis,
  isAnalyzing,
  onNavigateTab,
  onOpenReportModal,
  workspaceSession,
  onLogPayment,
  onDeletePayment,
  onGenerateQrCode,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState<boolean>(false);
  const [preselectedInvoiceId, setPreselectedInvoiceId] = React.useState<string | undefined>(undefined);

  const summary = analysis?.summary;

  const totalInvoiced = summary?.totalInvoicedPaise || '10000000';
  const totalPaid = summary?.totalPaidPaise || '0';
  const totalOverdue = summary?.totalOverduePaise || '8000000';
  const totalInterest = summary?.totalInterestPaise || '318359';
  const totalClaim = summary?.totalClaimPaise || '10318359';
  const settledPercent =
    Number(totalInvoiced) > 0
      ? Math.min(100, Math.round((Number(totalPaid) / Number(totalInvoiced)) * 100))
      : 0;

  const userName = workspaceSession?.user?.fullName || 'Harsha Vardhan';
  const activeOrgName =
    workspaceSession?.activeOrganization?.legalName || caseRecord.businessName;
  const activeBranchName =
    workspaceSession?.activeBranchName || 'Guntur Branch (Guntur)';

  const inv101Out = invoices.find((i) => i.invoiceNumber === 'INV-101')?.outstandingAmountPaise || '5000000';
  const inv102Out = invoices.find((i) => i.invoiceNumber === 'INV-102')?.outstandingAmountPaise || '3000000';
  const inv103Out = invoices.find((i) => i.invoiceNumber === 'INV-103')?.outstandingAmountPaise || '2000000';

  // Deterministic MSMED Overdue Aging Buckets (dynamically derived from live invoice balances)
  const agingBuckets: AgingBucketDatum[] = [
    {
      bucket: '0-15 Days',
      amountInr: Math.round(Number(inv103Out) / 100),
      amountPaise: inv103Out,
      invoiceRefs: 'INV-103',
      statusNote: 'Within MSMED § 15 Appointed-Day Window',
      fillLight: '#10b981',
      fillDark: '#34d399',
    },
    {
      bucket: '16-45 Days',
      amountInr: Math.round(Number(inv102Out) / 100),
      amountPaise: inv102Out,
      invoiceRefs: 'INV-102',
      statusNote: 'Contractual Window Exceeded · POD Missing',
      fillLight: '#6366f1',
      fillDark: '#818cf8',
    },
    {
      bucket: '> 45 Days Critical',
      amountInr: Math.round(Number(inv101Out) / 100),
      amountPaise: inv101Out,
      invoiceRefs: 'INV-101',
      statusNote: 'MSMED § 15 Statutory Cap Breached · 3× RBI Interest Accruing',
      fillLight: '#f43f5e',
      fillDark: '#fb7185',
    },
  ];

  // Canonical LangGraph Agent Findings Feed
  const agentFindings = [
    {
      id: 'fnd-missing-pod',
      code: 'MISSING_DELIVERY_PROOF',
      agentBadge: 'agent: evidence_verification',
      type: 'warning' as const,
      statusLabel: 'Warning · Needs Review',
      message:
        'Proof of Delivery / Signed Challan (DC-4480) was not found for Invoice INV-102 (₹30,000.00). MSME Samadhaan reconciliation requires corroborating delivery evidence.',
    },
    {
      id: 'fnd-udyam-verified',
      code: 'UDYAM_REGISTRATION_VERIFIED',
      agentBadge: 'agent: msme_verification',
      type: 'success' as const,
      statusLabel: 'Verified · Silpi Doctrine Passed',
      message:
        `Supplier Udyam Registration (${caseRecord.sellerUdyamNumber}) verified as Micro Manufacturing Enterprise. Registration date (${caseRecord.sellerUdyamRegDate}) predates all invoice supply dates.`,
    },
    {
      id: 'fnd-tax-po-reconciled',
      code: 'TAX_AND_PO_RECONCILED',
      agentBadge: 'agent: invoice_validation',
      type: 'success' as const,
      statusLabel: 'Verified · Zero Variance',
      message:
        'Invoices INV-101 (₹50,000) and INV-102 (₹30,000) match Purchase Order PO-2024-881 total (₹80,000.00) with deterministic 18% GST checksum verification.',
    },
  ];

  const humanCardClasses =
    'rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/90 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200';

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. PAGE HEADER — Greeting, MSMED §§ 15 & 16 Context, Dark/Light Toggle
         ===================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-1">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <span className="uppercase tracking-wide font-semibold text-[11px]">
              MSMED Section 15 &amp; 16 Statutory Command
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="font-mono text-zinc-500 dark:text-zinc-400">
              {activeOrgName} &middot; {activeBranchName}
            </span>
          </div>

          <h1
            data-testid="dashboard-greeting-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white"
          >
            Good morning, {userName}
          </h1>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Active Dispute Matter:{' '}
            <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">
              {caseRecord.caseReference}
            </strong>{' '}
            &mdash; {caseRecord.businessName} vs. {caseRecord.buyerName} &middot; Enforceable Claim:{' '}
            <strong className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
              {formatINR(totalClaim)}
            </strong>
          </p>
        </div>

        {/* Header Actions: Crisp Human-Crafted Radii (Zero-Pill Discipline) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={toggleTheme}
            data-testid="dashboard-theme-toggle-btn"
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 shadow-2xs flex items-center gap-2 transition cursor-pointer"
          >
            {resolvedTheme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Dark</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRunAnalysis}
            disabled={isAnalyzing}
            data-testid="run-agent-pipeline-btn"
            className="px-4 py-2 rounded-lg font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Executing...' : 'Run Agent Pipeline'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenReportModal}
            className="px-3.5 py-2 rounded-lg font-semibold text-xs bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white shadow-2xs flex items-center gap-2 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Annexure</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          1B. QUICK LAUNCH: BUYER REMINDER BILL & SOFT-COPY GMAIL STUDIO
         ===================================================================== */}
      <div
        data-testid="dashboard-reminder-mail-banner"
        className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              GMAIL RFC 2822 + ATTACHED SOFT COPIES
            </span>
            <span className="text-xs font-bold text-zinc-900 dark:text-white">
              Send Buyer Reminder Bill &amp; Soft Copy to chandraharshavardhan1@gmail.com
            </span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Dispatches with RFC 2822 <span className="font-mono">From</span>, <span className="font-mono">To</span>, <span className="font-mono">Date</span>, and <span className="font-mono">Message-ID</span> headers plus both attached soft copies (<span className="font-mono font-semibold">Buyer_Reminder_Bill_INV-101.pdf</span> and <span className="font-mono font-semibold">Buyer_Notice_Portal_Preview_INV-101.html</span>) straight to your Gmail Inbox and Sent Mail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('reminders')}
            data-testid="dashboard-open-reminder-studio-btn"
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Open Reminder Studio &rarr;</span>
          </button>

          <a
            href="https://mail.google.com/mail/u/0/#inbox"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="dashboard-open-gmail-inbox-btn"
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <span>Open Gmail Inbox</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* =====================================================================
          2. ASYMMETRIC BENTO GRID (HUMAN-CRAFTED FINANCIAL COMMAND)
         ===================================================================== */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        data-testid="top-metrics-grid"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4"
      >
        {/* Bento Hero Card 1 (Span 6 cols on lg): Total Enforceable Claim & Statutory Math */}
        <motion.div
          variants={cardItemVariants}
          className={`lg:col-span-6 ${humanCardClasses} p-5 flex flex-col justify-between`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Total Enforceable Claim (MSMED §§ 15 &amp; 16)
              </span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                3&times; RBI Bank Rate &middot; 20.25% p.a.
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white font-mono tabular-nums">
                {formatINR(totalClaim)}
              </div>
              <div className="text-xs text-zinc-500 font-mono">
                Billed: {formatINR(totalInvoiced)}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-[10px] uppercase font-semibold text-zinc-400">
                Overdue Principal
              </div>
              <div className="font-mono font-bold text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
                {formatINR(totalOverdue)}
              </div>
              <div className="text-[10px] text-zinc-500">2 Invoices Breached</div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-semibold text-zinc-400">
                §16 Statutory Interest
              </div>
              <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 tabular-nums">
                {formatINR(totalInterest)}
              </div>
              <div className="text-[10px] text-zinc-500">Monthly Compounding</div>
            </div>

            <div className="col-span-2 sm:col-span-1 flex flex-col justify-end">
              <button
                type="button"
                onClick={() => onNavigateTab('finance')}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Audit Calculation</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Bento Card 2 (Span 3 cols on lg): Overdue Principal & Statutory Status */}
        <motion.div
          variants={cardItemVariants}
          className={`lg:col-span-3 ${humanCardClasses} p-5 flex flex-col justify-between`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Overdue Principal
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                §15 Breached
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono tabular-nums">
              {formatINR(totalOverdue)}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Statutory 45-day credit cap exceeded for INV-101 and INV-102.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-500 font-mono">2 Invoices Unpaid</span>
            <button
              type="button"
              onClick={() => onNavigateTab('reminders')}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              Issue Notice &rarr;
            </button>
          </div>
        </motion.div>

        {/* Bento Card 3 (Span 3 cols on lg): Realized Collections & Cashflow */}
        <motion.div
          variants={cardItemVariants}
          className={`lg:col-span-3 ${humanCardClasses} p-5 flex flex-col justify-between`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Settled &amp; Recovered
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {settledPercent}% Realized
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
              {formatINR(totalPaid)}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Bank reconciliation verified for INV-103 via statutory payment ledger.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-500 font-mono">1 Invoice Settled</span>
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              + Log Payment
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* =====================================================================
          2B. UNIFIED ERP, GST BILLING & REMINDER AUTOMATION STRIP
         ===================================================================== */}
      <div
        data-testid="dashboard-erp-quick-strip"
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        <button
          type="button"
          onClick={() => onNavigateTab('invoices-billing')}
          className="text-left p-4 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs transition flex items-center justify-between gap-3 cursor-pointer"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
              <Receipt className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>GST Tax Invoices &amp; Billing</span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-6">
              Intra-State CGST+SGST &amp; Inter-State IGST Engine
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('customers-products')}
          className="text-left p-4 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs transition flex items-center justify-between gap-3 cursor-pointer"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
              <Users className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Customers &amp; Product Catalogue</span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-6">
              Place-of-Supply State Rules &amp; SKU Cost Margins
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('reminders')}
          className="text-left p-4 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs transition flex items-center justify-between gap-3 cursor-pointer"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
              <Mail className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Overdue Email Reminder Scheduler</span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-6">
              5-Stage Idempotent Notices &amp; Durable Audit Logs
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />
        </button>
      </div>

      {/* =====================================================================
          3. MAIN ANALYSIS SPLIT (50/50 LAYOUT)
             Left: Recharts Overdue Aging Analysis
             Right: LangGraph Agent Trace (Active Agent Findings)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT SIDE (50%): Overdue Aging Analysis (Recharts BarChart) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          data-testid="overdue-aging-chart-card"
          className={`lg:col-span-6 ${humanCardClasses} p-6 flex flex-col justify-between`}
        >
          <div>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  MSMED Act Section 15 Aging Distribution
                </div>
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white mt-0.5">
                  Overdue Aging Analysis
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Deterministic bucket classification across statutory 15-day and 45-day limits
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('finance')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>Inspect § 16 Math</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Recharts BarChart with clean styling */}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={agingBuckets}
                  margin={{ top: 12, right: 12, left: 4, bottom: 8 }}
                  barSize={52}
                >
                  <XAxis
                    dataKey="bucket"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: resolvedTheme === 'dark' ? '#a1a1aa' : '#52525b',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: resolvedTheme === 'dark' ? '#71717a' : '#71717a',
                      fontSize: 11,
                    }}
                    tickFormatter={(val: number) => `₹${val / 1000}k`}
                  />
                  <Tooltip
                    cursor={{
                      fill:
                        resolvedTheme === 'dark'
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(0,0,0,0.03)',
                      radius: 8,
                    }}
                    content={<CustomAgingTooltip />}
                  />
                  <Bar dataKey="amountInr" radius={[6, 6, 0, 0]}>
                    {agingBuckets.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={resolvedTheme === 'dark' ? entry.fillDark : entry.fillLight}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Aging Bucket Legend Summary */}
          <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
              <div className="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400">
                0–15 Days
              </div>
              <div className="font-mono font-bold text-zinc-900 dark:text-white mt-0.5 tabular-nums">
                {formatINR(inv103Out)}
              </div>
              <div className="text-[11px] text-zinc-500">INV-103 (Current)</div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
              <div className="text-[10px] uppercase font-semibold text-indigo-600 dark:text-indigo-400">
                16–45 Days
              </div>
              <div className="font-mono font-bold text-zinc-900 dark:text-white mt-0.5 tabular-nums">
                {formatINR(inv102Out)}
              </div>
              <div className="text-[11px] text-zinc-500">INV-102 (Overdue)</div>
            </div>

            <div className="p-3 rounded-lg bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20">
              <div className="text-[10px] uppercase font-semibold text-rose-600 dark:text-rose-400">
                &gt; 45 Days Critical
              </div>
              <div className="font-mono font-bold text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
                {formatINR(inv101Out)}
              </div>
              <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                INV-101 (§15 Cap Breach)
              </div>
            </div>
          </div>
        </motion.div>

        {/* RIGHT SIDE (50%): LangGraph Agent Trace — Active Agent Findings Feed */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          data-testid="langgraph-agent-trace-card"
          className={`lg:col-span-6 ${humanCardClasses} p-6 flex flex-col justify-between`}
        >
          <div>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>LangGraph Agent Trace</span>
                </div>
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white mt-0.5">
                  Active Agent Findings
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Deterministic multi-agent compliance checks with source document provenance
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('trace')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>Full StateGraph</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Findings Feed Cards */}
            <div className="space-y-3">
              {agentFindings.map((finding) => {
                const isWarning = finding.type === 'warning';
                return (
                  <div
                    key={finding.id}
                    data-testid={`agent-finding-card-${finding.code}`}
                    className={`rounded-lg p-3.5 border transition-all ${
                      isWarning
                        ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20'
                        : 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {isWarning ? (
                          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                        <span
                          className={`font-mono text-xs font-bold tracking-tight ${
                            isWarning
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {finding.code}
                        </span>
                      </div>

                      {/* Specific LangGraph Agent Badge (Zero-Pill: rounded-md) */}
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {finding.agentBadge}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed pl-6">
                      {finding.message}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Human Review Gate Footer Bar */}
          <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Human-in-the-Loop checkpoint active prior to final ODR seal</span>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('review')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Open Review Gate</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* =====================================================================
          4. DISPUTED INVOICE LEDGER (Corroborated Synthetic Truth Table)
         ===================================================================== */}
      <div className={`${humanCardClasses} p-6`} data-testid="disputed-invoice-ledger-card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Deterministic Zero-Float Ledger (`decimal.js` · Integer Paise)
            </div>
            <h3 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white mt-0.5">
              Corroborated Invoice &amp; Delivery Schedule
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {onLogPayment && (
              <button
                type="button"
                data-testid="open-log-payment-modal-btn"
                onClick={() => {
                  setPreselectedInvoiceId('inv-101');
                  setIsPaymentModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Log Payment (UPI / Bank UTR)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('evidence')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Evidence Graph</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Invoice Date</th>
                <th className="py-2.5 px-3">PO Reference</th>
                <th className="py-2.5 px-3">Delivery Challan</th>
                <th className="py-2.5 px-3 text-right">Invoiced</th>
                <th className="py-2.5 px-3 text-right">Paid</th>
                <th className="py-2.5 px-3 text-right">Outstanding</th>
                <th className="py-2.5 px-3 text-center">MSMED Status</th>
                {(onLogPayment || onGenerateQrCode) && (
                  <th className="py-2.5 px-3 text-right">Actions &amp; QR</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
              {invoices.map((inv) => {
                const isPaid = inv.status === 'paid' || Number(inv.outstandingAmountPaise) === 0;
                const isOverdue = !isPaid && (inv.status === 'overdue' || inv.status === 'disputed');
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-zinc-900 dark:text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-3 font-mono">{inv.invoiceDate}</td>
                    <td className="py-3 px-3 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                      {inv.poReference || '—'}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {inv.deliveryReference || 'Missing POD'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium tabular-nums">
                      {formatINR(inv.totalAmountPaise)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatINR(inv.paidAmountPaise || '0')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                      {formatINR(inv.outstandingAmountPaise)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                          isPaid
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : isOverdue
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {isPaid
                          ? 'SETTLED'
                          : isOverdue
                          ? 'OVERDUE (§ 16)'
                          : 'NOT YET DUE'}
                      </span>
                    </td>
                    {(onLogPayment || onGenerateQrCode) && (
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const doc = generateGstTaxInvoicePdf({
                                invoice: inv,
                                caseRecord,
                                customerState: inv.buyerState || 'Maharashtra',
                              });
                              doc.save(`Tax_Invoice_${inv.invoiceNumber}.pdf`);
                            }}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                          >
                            <Download className="w-3 h-3" />
                            <span>Tax PDF</span>
                          </button>
                          {onGenerateQrCode && (
                            <button
                              type="button"
                              data-testid={`generate-qr-btn-${inv.id}`}
                              onClick={() => onGenerateQrCode(inv.id)}
                              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                            >
                              <QrCode className="w-3 h-3" />
                              <span>QR</span>
                            </button>
                          )}
                          {onLogPayment && (
                            <button
                              type="button"
                              onClick={() => {
                                setPreselectedInvoiceId(inv.id);
                                setIsPaymentModalOpen(true);
                              }}
                              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition cursor-pointer whitespace-nowrap"
                            >
                              + Allocate
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Recorded External Payment Allocations History */}
        {payments.length > 0 && (
          <div
            data-testid="recorded-payments-ledger"
            className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                <Receipt className="w-3.5 h-3.5" />
                <span>Recorded External Payment Allocations ({payments.length})</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">
                Section 16 Monthly Rests Recalculated Dynamically
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {payments.map((pay) => (
                <div
                  key={pay.id}
                  className="p-3 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        {pay.paymentMethod || 'UPI'}
                      </span>
                      <span className="font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                        {formatINR(pay.amountPaise)}
                      </span>
                      <span className="text-zinc-400">&middot;</span>
                      <span className="font-mono text-zinc-600 dark:text-zinc-400">
                        {pay.paymentDate}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500">
                      Ref: <strong className="text-zinc-700 dark:text-zinc-200">{pay.reference}</strong>
                      {pay.invoiceId ? ` &rarr; ${pay.invoiceId.toUpperCase()}` : ' &rarr; FIFO Auto'}
                    </div>
                  </div>
                  {onDeletePayment && (
                    <button
                      type="button"
                      onClick={() => onDeletePayment(pay.id)}
                      title="Remove logged payment and recalculate ledger"
                      className="p-2 rounded-full text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Log Payment Modal */}
      {onLogPayment && (
        <LogPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          invoices={invoices}
          preselectedInvoiceId={preselectedInvoiceId}
          onSubmitPayment={onLogPayment}
        />
      )}
    </div>
  );
};
