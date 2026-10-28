/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Enterprise Financial Operations Dashboard
 * Provides reusable operational components:
 *  - DashboardWelcome
 *  - ReminderNotification
 *  - FinancialMetricCard & FinancialOverview
 *  - RecentCasesTable
 *  - PendingReviewPanel & RecentActivity
 */

import React from 'react';
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
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Play,
  FileSpreadsheet,
  Cpu,
  Plus,
  Trash2,
  Receipt,
  QrCode,
  Mail,
  Users,
  Download,
  ExternalLink,
  Clock,
  FolderCheck,
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
import { StatusBadge, type BadgeStatus } from './ui/StatusBadge.tsx';
import { PageSection } from './ui/PageSection.tsx';
import { EmptyState } from './ui/EmptyState.tsx';

export interface DashboardViewProps {
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

/* ============================================================================
 * 1. DASHBOARD WELCOME SECTION
 * ============================================================================ */

export interface DashboardWelcomeProps {
  greetingName: string;
  caseRecord: CaseRecord;
  totalClaimPaise: string;
  isAnalyzing: boolean;
  onRunAnalysis: () => void;
  onExportAnnexure: () => void;
}

export const DashboardWelcome: React.FC<DashboardWelcomeProps> = ({
  greetingName,
  caseRecord,
  totalClaimPaise,
  isAnalyzing,
  onRunAnalysis,
  onExportAnnexure,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-zinc-800/80">
      <div className="space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          MSMED SECTION 15 &amp; 16
        </div>
        <h1
          data-testid="dashboard-greeting-heading"
          className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100"
        >
          Good morning, {greetingName}
        </h1>
        <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
          Active Case{' '}
          <span className="font-mono font-medium text-slate-900 dark:text-zinc-200">
            {caseRecord.caseReference}
          </span>{' '}
          &middot; {caseRecord.businessName} vs.{' '}
          <span className="font-medium text-slate-800 dark:text-zinc-200">
            {caseRecord.buyerName}
          </span>{' '}
          &middot; Enforceable Claim:{' '}
          <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
            {formatINR(totalClaimPaise)}
          </span>
        </p>
      </div>

      {/* Primary & Secondary Actions */}
      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
          data-testid="run-agent-pipeline-btn"
          className="h-9 px-4 rounded-md font-medium text-xs bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-2xs inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Play className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
          <span>{isAnalyzing ? 'Running Pipeline...' : 'Run Agent Pipeline'}</span>
        </button>

        <button
          type="button"
          onClick={onExportAnnexure}
          className="h-9 px-3.5 rounded-md font-medium text-xs bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-800 shadow-2xs inline-flex items-center gap-2 transition-colors cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
          <span>Export Annexure</span>
        </button>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. COMPACT REMINDER & NOTIFICATION PANEL
 * ============================================================================ */

export interface ReminderNotificationProps {
  recipientEmail: string;
  overdueCount: number;
  attachedDocumentCount?: number;
  lastDispatchStatus?: string;
  onOpenReminderStudio: () => void;
}

export const ReminderNotification: React.FC<ReminderNotificationProps> = ({
  recipientEmail,
  overdueCount,
  attachedDocumentCount = 2,
  lastDispatchStatus = 'RFC 2822 Ready · PDF Bill + HTML Portal Preview',
  onOpenReminderStudio,
}) => {
  if (overdueCount === 0) {
    return (
      <div
        data-testid="dashboard-reminder-mail-banner"
        className="rounded-lg bg-slate-50/70 dark:bg-zinc-900/50 border border-slate-200/80 dark:border-zinc-800 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-zinc-400"
      >
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-slate-400" />
          <span>No overdue invoice reminders pending dispatch.</span>
        </div>
        <button
          type="button"
          onClick={onOpenReminderStudio}
          data-testid="dashboard-open-reminder-studio-btn"
          className="text-xs font-medium text-slate-700 dark:text-zinc-300 hover:underline cursor-pointer"
        >
          Open Reminder Studio
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="dashboard-reminder-mail-banner"
      className="rounded-lg bg-slate-50/90 dark:bg-zinc-900/60 border border-slate-200/90 dark:border-zinc-800 px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-md bg-white dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 flex items-center justify-center shrink-0 text-slate-600 dark:text-zinc-300">
          <Mail className="w-4 h-4" />
        </div>

        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span className="font-semibold text-slate-900 dark:text-zinc-100">
              Overdue Reminder Notice
            </span>
            <span className="text-slate-300 dark:text-zinc-700" aria-hidden="true">
              &middot;
            </span>
            <span className="text-slate-600 dark:text-zinc-300">
              Recipient:{' '}
              <span className="font-mono font-medium text-slate-900 dark:text-zinc-100">
                {recipientEmail}
              </span>
            </span>
            <span className="text-slate-300 dark:text-zinc-700" aria-hidden="true">
              &middot;
            </span>
            <span className="text-slate-600 dark:text-zinc-400">
              {attachedDocumentCount} attached documents (
              <span className="font-mono text-[11px]">Buyer_Reminder_Bill_INV-101.pdf</span>,{' '}
              <span className="font-mono text-[11px]">Buyer_Notice_Portal_Preview_INV-101.html</span>)
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Status: {lastDispatchStatus} ({overdueCount} overdue{' '}
            {overdueCount === 1 ? 'invoice' : 'invoices'})
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenReminderStudio}
          data-testid="dashboard-open-reminder-studio-btn"
          className="h-8 px-3 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Open Reminder Studio</span>
        </button>

        <a
          href="https://mail.google.com/mail/u/0/#inbox"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="dashboard-open-gmail-inbox-btn"
          className="h-8 px-3 rounded-md bg-white hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-700 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
        >
          <span>Open Gmail</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. FINANCIAL OVERVIEW — 4 UNIFORM KPI METRIC CARDS
 * ============================================================================ */

export interface FinancialMetricCardProps {
  label: string;
  value: string;
  description: string;
  statusLabel?: string;
  statusTone?: BadgeStatus;
  valueTone?: 'neutral' | 'danger' | 'success';
  actionLabel?: string;
  onAction?: () => void;
}

export const FinancialMetricCard: React.FC<FinancialMetricCardProps> = ({
  label,
  value,
  description,
  statusLabel,
  statusTone = 'neutral',
  valueTone = 'neutral',
  actionLabel,
  onAction,
}) => {
  const valueColorClass =
    valueTone === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : valueTone === 'success'
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-slate-900 dark:text-zinc-100';

  return (
    <div className="rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 p-5 flex flex-col justify-between min-h-[136px]">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            {label}
          </span>
          {statusLabel && (
            <StatusBadge status={statusTone} label={statusLabel} showDot={false} />
          )}
        </div>

        <div
          className={`text-2xl font-semibold tracking-tight font-mono tabular-nums ${valueColorClass}`}
        >
          {value}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 dark:text-zinc-400 truncate">
          {description}
        </span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white inline-flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>{actionLabel}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export interface FinancialOverviewProps {
  totalClaimPaise: string;
  totalInvoicedPaise: string;
  totalInterestPaise: string;
  totalOverduePaise: string;
  totalPaidPaise: string;
  overdueInvoiceCount: number;
  settledPercent: number;
  onNavigateTab: (tabId: string) => void;
  onOpenPaymentModal: () => void;
}

export const FinancialOverview: React.FC<FinancialOverviewProps> = ({
  totalClaimPaise,
  totalInvoicedPaise,
  totalInterestPaise,
  totalOverduePaise,
  totalPaidPaise,
  overdueInvoiceCount,
  settledPercent,
  onNavigateTab,
  onOpenPaymentModal,
}) => {
  return (
    <div
      data-testid="top-metrics-grid"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {/* 1. Total Outstanding */}
      <FinancialMetricCard
        label="Total Outstanding"
        value={formatINR(totalClaimPaise)}
        description={`Billed principal: ${formatINR(totalInvoicedPaise)}`}
        statusLabel="MSMED §§ 15–16"
        statusTone="neutral"
        valueTone="neutral"
        actionLabel="Breakdown"
        onAction={() => onNavigateTab('finance')}
      />

      {/* 2. Statutory Interest Estimate */}
      <FinancialMetricCard
        label="Statutory Interest Estimate"
        value={formatINR(totalInterestPaise)}
        description="3× RBI Bank Rate (20.25% p.a.)"
        statusLabel="Monthly Rests"
        statusTone="neutral"
        valueTone="neutral"
        actionLabel="Schedule"
        onAction={() => onNavigateTab('finance')}
      />

      {/* 3. Overdue Invoices */}
      <FinancialMetricCard
        label="Overdue Invoices"
        value={formatINR(totalOverduePaise)}
        description={`${overdueInvoiceCount} ${
          overdueInvoiceCount === 1 ? 'invoice' : 'invoices'
        } past § 15 cap`}
        statusLabel={overdueInvoiceCount > 0 ? '§ 15 Breached' : 'On Schedule'}
        statusTone={overdueInvoiceCount > 0 ? 'overdue' : 'settled'}
        valueTone={overdueInvoiceCount > 0 ? 'danger' : 'neutral'}
        actionLabel="Remind"
        onAction={() => onNavigateTab('reminders')}
      />

      {/* 4. Amount Recovered */}
      <FinancialMetricCard
        label="Amount Recovered"
        value={formatINR(totalPaidPaise)}
        description={`${settledPercent}% of billed value realized`}
        statusLabel={`${settledPercent}% Settled`}
        statusTone="settled"
        valueTone="success"
        actionLabel="Log Payment"
        onAction={onOpenPaymentModal}
      />
    </div>
  );
};

/* ============================================================================
 * 4. PRIMARY OPERATIONAL TABLE — RECENT CASES / ACTIVE DISPUTED INVOICES
 * ============================================================================ */

export interface RecentCasesTableProps {
  caseRecord: CaseRecord;
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  onLogPaymentClick: (invoiceId?: string) => void;
  onDeletePayment?: (paymentId: string) => Promise<void>;
  onGenerateQrCode?: (invoiceId: string) => void;
  onNavigateTab: (tabId: string) => void;
}

export const RecentCasesTable: React.FC<RecentCasesTableProps> = ({
  caseRecord,
  invoices,
  payments,
  onLogPaymentClick,
  onDeletePayment,
  onGenerateQrCode,
  onNavigateTab,
}) => {
  return (
    <PageSection
      data-testid="disputed-invoice-ledger-card"
      eyebrow={`Active Dispute Matter · ${caseRecord.caseReference}`}
      title="Recent Cases & Active Disputed Invoices"
      subtitle={`Buyer: ${caseRecord.buyerName} (${caseRecord.buyerGstin || 'GSTIN on file'}) · Contractual credit: ${
        caseRecord.contractualPaymentDays || 30
      } days`}
      noPadding
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="open-log-payment-modal-btn"
            onClick={() => onLogPaymentClick('inv-101')}
            className="h-8 px-3 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Payment</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('evidence')}
            className="h-8 px-3 rounded-md text-xs font-medium bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Evidence Graph</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50 text-slate-500 dark:text-zinc-400 font-medium">
              <th className="py-2.5 px-4">Invoice / Case ID</th>
              <th className="py-2.5 px-4">Buyer &amp; PO Ref</th>
              <th className="py-2.5 px-4">Delivery Proof</th>
              <th className="py-2.5 px-4 text-right">Invoiced</th>
              <th className="py-2.5 px-4 text-right">Paid</th>
              <th className="py-2.5 px-4 text-right">Outstanding</th>
              <th className="py-2.5 px-4 text-center">Current Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200/60 dark:divide-zinc-800/70 text-slate-700 dark:text-zinc-300">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8">
                  <EmptyState
                    title="No invoices recorded"
                    description="Create a GST tax invoice or import case documents to track overdue balances."
                  />
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const isPaid =
                  inv.status === 'paid' || Number(inv.outstandingAmountPaise) === 0;
                const isOverdue =
                  !isPaid && (inv.status === 'overdue' || inv.status === 'disputed');
                const missingPod =
                  !inv.deliveryReference ||
                  inv.deliveryReference.toLowerCase().includes('missing');

                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-slate-900 dark:text-zinc-100">
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                        Issued {inv.invoiceDate}
                        {inv.contractualDueDate ? ` · Due ${inv.contractualDueDate}` : ''}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-zinc-100">
                        {caseRecord.buyerName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                        PO: {inv.poReference || '—'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`font-mono text-xs ${
                          missingPod
                            ? 'text-amber-700 dark:text-amber-400 font-medium'
                            : 'text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        {inv.deliveryReference || 'Missing POD'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                      {formatINR(inv.totalAmountPaise)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                      {formatINR(inv.paidAmountPaise || '0')}
                    </td>

                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                        isOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-900 dark:text-zinc-100'
                      }`}
                    >
                      {formatINR(inv.outstandingAmountPaise)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <StatusBadge
                        status={
                          isPaid ? 'settled' : isOverdue ? 'overdue' : 'neutral'
                        }
                        label={
                          isPaid
                            ? 'Settled'
                            : isOverdue
                            ? 'Overdue (§ 16)'
                            : 'Not Yet Due'
                        }
                      />
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
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
                          className="h-7 px-2 rounded text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                          title="Download GST Tax Invoice PDF"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>

                        {onGenerateQrCode && (
                          <button
                            type="button"
                            data-testid={`generate-qr-btn-${inv.id}`}
                            onClick={() => onGenerateQrCode(inv.id)}
                            className="h-7 px-2 rounded text-[11px] font-medium bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                            title="Generate Buyer Payment QR"
                          >
                            <QrCode className="w-3 h-3" />
                            <span>QR</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onLogPaymentClick(inv.id)}
                          className="h-7 px-2 rounded text-[11px] font-medium bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          + Allocate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Recorded External Payment Allocations */}
      {payments.length > 0 && (
        <div
          data-testid="recorded-payments-ledger"
          className="px-5 py-4 border-t border-slate-200/80 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/40 space-y-2.5"
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-zinc-200">
              <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Recorded Payment Allocations ({payments.length})</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
              Section 16 monthly rests updated automatically
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {payments.map((pay) => (
              <div
                key={pay.id}
                className="px-3.5 py-2.5 rounded-md bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50">
                      {pay.paymentMethod || 'UPI'}
                    </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">
                      {formatINR(pay.amountPaise)}
                    </span>
                    <span className="text-slate-300 dark:text-zinc-700">&middot;</span>
                    <span className="font-mono text-slate-500 dark:text-zinc-400">
                      {pay.paymentDate}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 truncate">
                    Ref: <span className="text-slate-700 dark:text-zinc-200">{pay.reference}</span>
                    {pay.invoiceId
                      ? ` → ${pay.invoiceId.toUpperCase()}`
                      : ' → FIFO Allocation'}
                  </div>
                </div>

                {onDeletePayment && (
                  <button
                    type="button"
                    onClick={() => onDeletePayment(pay.id)}
                    title="Remove payment and recalculate ledger"
                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </PageSection>
  );
};

/* ============================================================================
 * 5. SECONDARY OPERATIONAL PANELS — PENDING REVIEWS, AGENT ACTIVITY & DOCUMENTS
 * ============================================================================ */

export interface AgentActivityItem {
  id: string;
  code: string;
  agentBadge: string;
  type: 'warning' | 'success';
  statusLabel: string;
  message: string;
}

export interface PendingReviewPanelProps {
  findings: AgentActivityItem[];
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  onOpenReviewGate: () => void;
  onOpenTrace: () => void;
}

export const PendingReviewPanel: React.FC<PendingReviewPanelProps> = ({
  findings,
  approvalStatus = 'pending',
  onOpenReviewGate,
  onOpenTrace,
}) => {
  return (
    <PageSection
      data-testid="langgraph-agent-trace-card"
      eyebrow="Verification & Audit Trail"
      title="Pending Human Reviews & Agent Activity"
      subtitle="Multi-agent compliance verification checks with source document provenance"
      actions={
        <button
          type="button"
          onClick={onOpenTrace}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
        >
          <span>Full Pipeline</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Review Status:{' '}
              <strong className="font-medium text-slate-900 dark:text-zinc-100">
                {approvalStatus === 'approved'
                  ? 'Approved for ODR Filing'
                  : 'Pending Reviewer Sign-off'}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenReviewGate}
            className="h-8 px-3 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Open Human Review</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      }
    >
      <div className="space-y-2.5">
        {findings.map((finding) => {
          const isWarning = finding.type === 'warning';
          return (
            <div
              key={finding.id}
              data-testid={`agent-finding-card-${finding.code}`}
              className="rounded-md p-3.5 border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  {isWarning ? (
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <span className="font-mono text-xs font-semibold text-slate-900 dark:text-zinc-100">
                    {finding.code}
                  </span>
                  <StatusBadge
                    status={isWarning ? 'review' : 'verified'}
                    label={isWarning ? 'Needs Review' : 'Verified'}
                    showDot={false}
                  />
                </div>

                <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                  {finding.agentBadge}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed pl-6">
                {finding.message}
              </p>
            </div>
          );
        })}
      </div>
    </PageSection>
  );
};

export const RecentActivity = PendingReviewPanel;

/* ============================================================================
 * 6. AGING DISTRIBUTION & RECENT DOCUMENTS PANEL
 * ============================================================================ */

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
    <div className="rounded-md p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-md text-xs space-y-1">
      <div className="font-medium text-slate-500 dark:text-zinc-400">
        {item.bucket}
      </div>
      <div className="text-sm font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
        {formatINR(item.amountPaise)}
      </div>
      <div className="text-[11px] text-slate-600 dark:text-zinc-300">
        Invoices: <span className="font-mono">{item.invoiceRefs}</span>
      </div>
      <div className="text-[11px] text-slate-500 dark:text-zinc-400">
        {item.statusNote}
      </div>
    </div>
  );
};

/* ============================================================================
 * MAIN DASHBOARD VIEW
 * ============================================================================ */

export const DashboardView: React.FC<DashboardViewProps> = ({
  caseRecord,
  documents,
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
  const { resolvedTheme } = useTheme();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState<boolean>(false);
  const [preselectedInvoiceId, setPreselectedInvoiceId] = React.useState<string | undefined>(
    undefined
  );

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

  // Use "Ananya" as the clean default welcome persona or the signed-in user's name
  const rawUserName = workspaceSession?.user?.fullName;
  const greetingName =
    rawUserName && rawUserName !== 'Harsha Vardhan'
      ? rawUserName.split(' ')[0]
      : 'Ananya';

  const overdueInvoices = invoices.filter(
    (inv) =>
      inv.status !== 'paid' &&
      Number(inv.outstandingAmountPaise) > 0 &&
      (inv.status === 'overdue' || inv.status === 'disputed')
  );

  const inv101Out =
    invoices.find((i) => i.invoiceNumber === 'INV-101')?.outstandingAmountPaise ||
    '5000000';
  const inv102Out =
    invoices.find((i) => i.invoiceNumber === 'INV-102')?.outstandingAmountPaise ||
    '3000000';
  const inv103Out =
    invoices.find((i) => i.invoiceNumber === 'INV-103')?.outstandingAmountPaise ||
    '2000000';

  const agingBuckets: AgingBucketDatum[] = [
    {
      bucket: '0–15 Days',
      amountInr: Math.round(Number(inv103Out) / 100),
      amountPaise: inv103Out,
      invoiceRefs: 'INV-103',
      statusNote: 'Within MSMED § 15 Appointed-Day Window',
      fillLight: '#15803d',
      fillDark: '#34d399',
    },
    {
      bucket: '16–45 Days',
      amountInr: Math.round(Number(inv102Out) / 100),
      amountPaise: inv102Out,
      invoiceRefs: 'INV-102',
      statusNote: 'Contractual Window Exceeded · POD Pending',
      fillLight: '#475569',
      fillDark: '#94a3b8',
    },
    {
      bucket: '> 45 Days',
      amountInr: Math.round(Number(inv101Out) / 100),
      amountPaise: inv101Out,
      invoiceRefs: 'INV-101',
      statusNote: 'MSMED § 15 Cap Breached · 3× RBI Interest Accruing',
      fillLight: '#dc2626',
      fillDark: '#f87171',
    },
  ];

  const agentFindings: AgentActivityItem[] = [
    {
      id: 'fnd-missing-pod',
      code: 'MISSING_DELIVERY_PROOF',
      agentBadge: 'agent: evidence_verification',
      type: 'warning',
      statusLabel: 'Needs Review',
      message:
        'Proof of Delivery / Signed Challan (DC-4480) was not found for Invoice INV-102 (₹30,000.00). MSME Samadhaan reconciliation requires corroborating delivery evidence.',
    },
    {
      id: 'fnd-udyam-verified',
      code: 'UDYAM_REGISTRATION_VERIFIED',
      agentBadge: 'agent: msme_verification',
      type: 'success',
      statusLabel: 'Verified',
      message: `Supplier Udyam Registration (${caseRecord.sellerUdyamNumber}) verified as Micro Manufacturing Enterprise. Registration date (${caseRecord.sellerUdyamRegDate}) predates all invoice supply dates.`,
    },
    {
      id: 'fnd-tax-po-reconciled',
      code: 'TAX_AND_PO_RECONCILED',
      agentBadge: 'agent: invoice_validation',
      type: 'success',
      statusLabel: 'Verified',
      message:
        'Invoices INV-101 (₹50,000) and INV-102 (₹30,000) match Purchase Order PO-2024-881 total (₹80,000.00) with deterministic 18% GST checksum verification.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Welcome Header */}
      <DashboardWelcome
        greetingName={greetingName}
        caseRecord={caseRecord}
        totalClaimPaise={totalClaim}
        isAnalyzing={isAnalyzing}
        onRunAnalysis={onRunAnalysis}
        onExportAnnexure={onOpenReportModal}
      />

      {/* 2. Compact Reminder & Notification Panel */}
      <ReminderNotification
        recipientEmail="chandraharshavardhan1@gmail.com"
        overdueCount={overdueInvoices.length}
        attachedDocumentCount={2}
        onOpenReminderStudio={() => onNavigateTab('reminders')}
      />

      {/* 3. Four Standardized Financial KPI Cards */}
      <FinancialOverview
        totalClaimPaise={totalClaim}
        totalInvoicedPaise={totalInvoiced}
        totalInterestPaise={totalInterest}
        totalOverduePaise={totalOverdue}
        totalPaidPaise={totalPaid}
        overdueInvoiceCount={overdueInvoices.length}
        settledPercent={settledPercent}
        onNavigateTab={onNavigateTab}
        onOpenPaymentModal={() => {
          setPreselectedInvoiceId(undefined);
          setIsPaymentModalOpen(true);
        }}
      />

      {/* 4. Compact Operational Module Navigation Strip */}
      <div
        data-testid="dashboard-erp-quick-strip"
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        <button
          type="button"
          onClick={() => onNavigateTab('invoices-billing')}
          className="text-left px-4 py-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors flex items-center justify-between gap-3 cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Receipt className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                GST Tax Invoices
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                CGST/SGST &amp; IGST billing ledger
              </div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('customers-products')}
          className="text-left px-4 py-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors flex items-center justify-between gap-3 cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Users className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                Customers &amp; Catalogue
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                Buyer GSTIN directory &amp; HSN rates
              </div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('reminders')}
          className="text-left px-4 py-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors flex items-center justify-between gap-3 cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Clock className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                Overdue Reminders
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                Automated 5-stage statutory notices
              </div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </div>

      {/* 5. Primary Section: Recent Cases & Active Disputed Invoices Table */}
      <RecentCasesTable
        caseRecord={caseRecord}
        invoices={invoices}
        payments={payments}
        onLogPaymentClick={(invId) => {
          setPreselectedInvoiceId(invId);
          setIsPaymentModalOpen(true);
        }}
        onDeletePayment={onDeletePayment}
        onGenerateQrCode={onGenerateQrCode}
        onNavigateTab={onNavigateTab}
      />

      {/* 6. Secondary Section: Overdue Aging + Recent Documents & Pending Human Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Overdue Aging Distribution & Recent Documents */}
        <div className="lg:col-span-5 space-y-6">
          <PageSection
            data-testid="overdue-aging-chart-card"
            eyebrow="MSMED Section 15 Window"
            title="Overdue Aging Analysis"
            subtitle="Distribution across 15-day and 45-day statutory thresholds"
            actions={
              <button
                type="button"
                onClick={() => onNavigateTab('finance')}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <span>§ 16 Math</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={agingBuckets}
                  margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                  barSize={40}
                >
                  <XAxis
                    dataKey="bucket"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: resolvedTheme === 'dark' ? '#a1a1aa' : '#64748b',
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                    dy={6}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: resolvedTheme === 'dark' ? '#71717a' : '#64748b',
                      fontSize: 11,
                    }}
                    tickFormatter={(val: number) => `₹${val / 1000}k`}
                  />
                  <Tooltip
                    cursor={{
                      fill:
                        resolvedTheme === 'dark'
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(15,23,42,0.03)',
                    }}
                    content={<CustomAgingTooltip />}
                  />
                  <Bar dataKey="amountInr" radius={[4, 4, 0, 0]}>
                    {agingBuckets.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={
                          resolvedTheme === 'dark'
                            ? entry.fillDark
                            : entry.fillLight
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-zinc-800 text-xs">
              <div className="p-2.5 rounded bg-slate-50 dark:bg-zinc-800/50">
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  0–15 Days
                </div>
                <div className="font-mono font-semibold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {formatINR(inv103Out)}
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-50 dark:bg-zinc-800/50">
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  16–45 Days
                </div>
                <div className="font-mono font-semibold text-slate-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {formatINR(inv102Out)}
                </div>
              </div>

              <div className="p-2.5 rounded bg-red-50/60 dark:bg-red-950/30 border border-red-200/50 dark:border-red-900/40">
                <div className="text-[11px] text-red-700 dark:text-red-300 font-medium">
                  &gt; 45 Days
                </div>
                <div className="font-mono font-semibold text-red-600 dark:text-red-400 mt-0.5 tabular-nums">
                  {formatINR(inv101Out)}
                </div>
              </div>
            </div>
          </PageSection>

          {/* Recent Documents List */}
          <PageSection
            eyebrow="Evidence Vault"
            title="Recent Case Documents"
            actions={
              <button
                type="button"
                onClick={() => onNavigateTab('documents')}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Open Vault ({documents.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            {documents.length === 0 ? (
              <EmptyState
                title="No documents uploaded"
                description="Upload invoices, purchase orders, and delivery challans."
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-zinc-800/70 -my-2">
                {documents.slice(0, 4).map((doc) => (
                  <div
                    key={doc.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                          {doc.filename}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 capitalize">
                          {doc.documentType.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                    <FolderCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </PageSection>
        </div>

        {/* Right Column (7 cols): Pending Human Reviews & Recent Agent Activity */}
        <div className="lg:col-span-7">
          <PendingReviewPanel
            findings={agentFindings}
            approvalStatus={analysis?.approvalStatus}
            onOpenReviewGate={() => onNavigateTab('review')}
            onOpenTrace={() => onNavigateTab('trace')}
          />
        </div>
      </div>

      {/* Log Payment Modal */}
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
