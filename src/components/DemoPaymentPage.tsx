/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import {
  ShieldCheck,
  AlertTriangle,
  FileDown,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  Building2,
  FileText,
  Clock,
} from 'lucide-react';
import type { DemoInvoicePaymentView, DemoPaymentReceiptData } from '../types/index.ts';
import { formatINR, paiseToRupees, rupeesToPaise } from '../services/finance.ts';

interface DemoPaymentPageProps {
  token: string;
  onBackToApp?: () => void;
  caseIdForReset?: string;
}

export const DemoPaymentPage: React.FC<DemoPaymentPageProps> = ({
  token,
  onBackToApp,
  caseIdForReset = 'case-001',
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceView, setInvoiceView] = useState<DemoInvoicePaymentView | null>(null);
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial'>('full');
  const [partialRupeesInput, setPartialRupeesInput] = useState<string>('');
  const [payerNote, setPayerNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<DemoPaymentReceiptData | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const fetchTokenInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/demo-pay/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid or expired QR payment token.');
        setInvoiceView(null);
      } else {
        setInvoiceView(data);
        // Default partial input to 50% of outstanding balance in Rupees
        const halfPaise = Math.floor(Number(data.currentOutstandingPaise) / 2);
        if (halfPaise > 0) {
          setPartialRupeesInput(paiseToRupees(halfPaise));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Network error while verifying payment token.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTokenInvoice();
    }
  }, [token]);

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceView || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    setResetMessage(null);

    try {
      let partialAmountPaise: string | undefined;
      if (paymentMode === 'partial') {
        const cleanRupees = partialRupeesInput.trim();
        if (!cleanRupees || isNaN(Number(cleanRupees)) || Number(cleanRupees) <= 0) {
          setSubmitError('Please enter a valid positive partial payment amount in INR.');
          setSubmitting(false);
          return;
        }
        partialAmountPaise = rupeesToPaise(cleanRupees);
      }

      const res = await fetch(`/api/demo-pay/${encodeURIComponent(token)}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType: paymentMode,
          partialAmountPaise,
          payerNote: payerNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Failed to record simulated payment.');
      } else {
        setInvoiceView(data.updatedView);
        setLatestReceipt(data.receipt);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Network error while simulating payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetDemo = async () => {
    setResetMessage(null);
    setSubmitError(null);
    try {
      const res = await fetch('/api/demo-qr/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseIdForReset,
          invoiceId: invoiceView?.invoiceId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLatestReceipt(null);
        setResetMessage(data.message || 'Demo data reset to original invoice balance.');
        await fetchTokenInvoice();
      } else {
        setSubmitError(data.error || 'Could not reset demo data.');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to reset demo data.');
    }
  };

  const handleDownloadDemoReceiptPdf = (receipt: DemoPaymentReceiptData) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Header Banner
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, 210, 38, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('DUESGUARD AI — DEMONSTRATION RECEIPT', 15, 16);

    doc.setFontSize(10);
    doc.setTextColor(251, 191, 36);
    doc.text('DEMO RECEIPT – NO REAL PAYMENT PROCESSED', 15, 25);

    doc.setTextColor(212, 212, 216);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(
      'Hackathon Sandbox Verification Record · Not an Official Bank Receipt or GST Tax Invoice',
      15,
      32
    );

    // Watermark Banner Box
    doc.setDrawColor(217, 119, 6);
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(15, 46, 180, 14, 2, 2, 'FD');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(
      'IMPORTANT: DEMO RECEIPT – NO REAL PAYMENT PROCESSED (STATUS: DEMO)',
      20,
      54.5
    );

    // Receipt Details Table
    let y = 72;
    const drawRow = (label: string, value: string, boldValue = false) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(113, 113, 122);
      doc.text(label, 15, y);

      doc.setFont('helvetica', boldValue ? 'bold' : 'normal');
      doc.setTextColor(24, 24, 27);
      doc.text(value, 85, y);

      doc.setDrawColor(228, 228, 231);
      doc.line(15, y + 3, 195, y + 3);
      y += 11;
    };

    drawRow('Demo Transaction ID', receipt.demoTransactionId, true);
    drawRow('Transaction Status', 'DEMO (Simulated Environment Only)', true);
    drawRow('Invoice Number', receipt.invoiceNumber, true);
    drawRow('Seller Business Name', receipt.sellerName);
    drawRow('Buyer Entity Name', receipt.buyerName);
    drawRow(
      'Demonstration Mode',
      receipt.paymentMode === 'FULL_DEMO'
        ? 'Full Payment Demonstration'
        : 'Partial Payment Demonstration'
    );
    drawRow('Previous Balance', formatINR(receipt.previousBalancePaise));
    drawRow('Simulated Payment Amount', formatINR(receipt.simulatedPaymentAmountPaise), true);
    drawRow('Remaining Demo Balance', formatINR(receipt.remainingBalancePaise), true);
    drawRow('Simulated Timestamp', new Date(receipt.simulatedAt).toUTCString());

    if (receipt.payerNote) {
      drawRow('Demonstration Note', receipt.payerNote);
    }

    // Footer Disclaimer
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9);
    doc.text('DEMO RECEIPT – NO REAL PAYMENT PROCESSED', 15, y);

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(82, 82, 91);
    const splitDisclaimer = doc.splitTextToSize(receipt.disclaimer, 180);
    doc.text(splitDisclaimer, 15, y);

    doc.save(`DuesGuard-Demo-Receipt-${receipt.invoiceNumber}-${receipt.demoTransactionId}.pdf`);
  };

  const outstandingPaiseNum = Number(invoiceView?.currentOutstandingPaise || '0');
  const isZeroBalance = outstandingPaiseNum <= 0;

  return (
    <div
      className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 py-8 px-4 flex flex-col items-center justify-start"
      data-testid="buyer-demo-payment-page"
    >
      <div className="w-full max-w-xl space-y-5">
        {/* Top Bar with Return Link & Demo Indicator */}
        <div className="flex items-center justify-between gap-2">
          {onBackToApp ? (
            <button
              type="button"
              onClick={onBackToApp}
              data-testid="back-to-duesguard-btn"
              className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Workspace</span>
            </button>
          ) : (
            <a
              href="/"
              className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>DuesGuard AI</span>
            </a>
          )}

          <div
            data-testid="demo-mode-banner-badge"
            className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold tracking-wide whitespace-nowrap shrink-0"
          >
            DEMO MODE · NO REAL PAYMENT
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-zinc-200 dark:border-white/10 bg-zinc-950 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-400">
                DuesGuard AI · Invoice Verification &amp; Demo Settlement
              </span>
              <span className="text-[11px] font-mono text-amber-400 font-semibold whitespace-nowrap">
                SANDBOX ENVIRONMENT
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mt-1">
              Buyer Invoice Payment Demonstration
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Amounts below are deterministically calculated from the DuesGuard AI ledger. No real
              money, bank transfer, or payment gateway is invoked.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-500">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-medium">
                  Validating cryptographic token hash on server...
                </p>
              </div>
            ) : error ? (
              <div
                data-testid="demo-pay-token-error"
                className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 space-y-2"
              >
                <div className="font-bold text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Payment Link Unavailable</span>
                </div>
                <p>{error}</p>
              </div>
            ) : invoiceView ? (
              <>
                {/* Seller & Buyer Identification */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-zinc-200/80 dark:border-white/10 text-xs">
                  <div className="space-y-1">
                    <span className="text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Seller Business Name</span>
                    </span>
                    <p
                      data-testid="buyer-page-seller-name"
                      className="text-sm font-bold text-zinc-900 dark:text-white"
                    >
                      {invoiceView.sellerName}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span>Billed Buyer Entity</span>
                    </span>
                    <p
                      data-testid="buyer-page-buyer-name"
                      className="text-sm font-bold text-zinc-900 dark:text-white"
                    >
                      {invoiceView.buyerName}
                    </p>
                  </div>
                </div>

                {/* Deterministic Financial Breakdown */}
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-zinc-500 dark:text-zinc-400">Invoice Number</span>
                    <span
                      data-testid="buyer-page-invoice-number"
                      className="font-mono font-bold text-sm text-zinc-900 dark:text-white whitespace-nowrap shrink-0"
                    >
                      {invoiceView.invoiceNumber}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Original Invoice Amount
                    </span>
                    <span
                      data-testid="buyer-page-original-amount"
                      className="font-mono tabular-nums font-semibold text-zinc-900 dark:text-white whitespace-nowrap shrink-0"
                    >
                      {formatINR(invoiceView.originalAmountPaise)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Previously Paid Amount
                      {Number(invoiceView.demoSimulatedPaidPaise) > 0
                        ? ` (Incl. Demo)`
                        : ''}
                    </span>
                    <span
                      data-testid="buyer-page-paid-amount"
                      className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0"
                    >
                      {formatINR(invoiceView.totalAlreadyPaidPaise)}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                        Current Outstanding Balance
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate">
                        Deterministic backend math (`decimal.js`)
                      </span>
                    </div>
                    <span
                      data-testid="buyer-page-outstanding-amount"
                      className="text-lg sm:text-xl font-extrabold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0"
                    >
                      {formatINR(invoiceView.currentOutstandingPaise)}
                    </span>
                  </div>
                </div>

                {/* Simulated Payment Form */}
                {!isZeroBalance ? (
                  <form
                    onSubmit={handleSimulatePayment}
                    className="pt-4 border-t border-zinc-200/80 dark:border-white/10 space-y-4"
                    data-testid="demo-payment-simulation-form"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                        Select Payment Demonstration Mode
                      </h2>
                      <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                        Status: DEMO
                      </span>
                    </div>

                    {/* Full vs Partial Mode Selector */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMode('full')}
                        data-testid="select-full-demo-btn"
                        className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                          paymentMode === 'full'
                            ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-zinc-900 dark:text-white'
                            : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <div className="text-xs font-bold">Full Payment Demo</div>
                        <div className="text-[11px] font-mono tabular-nums mt-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                          {formatINR(invoiceView.currentOutstandingPaise)}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMode('partial')}
                        data-testid="select-partial-demo-btn"
                        className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                          paymentMode === 'partial'
                            ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-zinc-900 dark:text-white'
                            : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <div className="text-xs font-bold">Partial Payment Demo</div>
                        <div className="text-[11px] mt-1 text-zinc-500 dark:text-zinc-400">
                          Custom installment amount
                        </div>
                      </button>
                    </div>

                    {paymentMode === 'partial' && (
                      <div className="space-y-2">
                        <label
                          htmlFor="partial-demo-amount-input"
                          className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                        >
                          Simulated Partial Amount (INR)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="partial-demo-amount-input"
                            type="number"
                            step="0.01"
                            min="1"
                            data-testid="partial-demo-amount-input"
                            value={partialRupeesInput}
                            onChange={(e) => setPartialRupeesInput(e.target.value)}
                            placeholder="Enter simulated amount in Rs."
                            className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 text-sm font-mono tabular-nums focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPartialRupeesInput(
                                paiseToRupees(Math.floor(outstandingPaiseNum * 0.25))
                              )
                            }
                            className="px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-semibold hover:bg-zinc-200 cursor-pointer"
                          >
                            25%
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPartialRupeesInput(
                                paiseToRupees(Math.floor(outstandingPaiseNum * 0.5))
                              )
                            }
                            className="px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-semibold hover:bg-zinc-200 cursor-pointer"
                          >
                            50%
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="demo-payer-note-input"
                        className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                      >
                        Reviewer / Buyer Note (Optional)
                      </label>
                      <input
                        id="demo-payer-note-input"
                        type="text"
                        value={payerNote}
                        onChange={(e) => setPayerNote(e.target.value)}
                        placeholder="e.g., Hackathon Reviewer Mobile QR Verification"
                        className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/15 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {submitError && (
                      <p
                        data-testid="demo-pay-submit-error"
                        className="text-xs font-medium text-rose-600 dark:text-rose-400"
                      >
                        {submitError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      data-testid="execute-demo-payment-btn"
                      className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {submitting
                          ? 'Recording Simulated DEMO Transaction...'
                          : paymentMode === 'full'
                          ? `Record Full Payment Demonstration (${formatINR(invoiceView.currentOutstandingPaise)})`
                          : 'Record Partial Payment Demonstration'}
                      </span>
                    </button>
                  </form>
                ) : (
                  <div
                    data-testid="demo-invoice-fully-settled-banner"
                    className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        Demonstration balance for <strong>{invoiceView.invoiceNumber}</strong> is now{' '}
                        <strong>Rs. 0.00</strong> in the sandbox.
                      </span>
                    </div>
                  </div>
                )}

                {/* Demonstration Receipt Section */}
                {latestReceipt && (
                  <div
                    data-testid="demo-payment-receipt-card"
                    className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-300/80 dark:border-amber-500/30 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 dark:border-amber-500/20 pb-3">
                      <div>
                        <span
                          data-testid="receipt-watermark-heading"
                          className="text-xs font-extrabold tracking-wide text-amber-800 dark:text-amber-300 block"
                        >
                          {latestReceipt.receiptTitle}
                        </span>
                        <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                          Simulated Transaction Recorded · Status: <strong>DEMO</strong>
                        </span>
                      </div>
                      <span
                        data-testid="receipt-demo-txn-id"
                        className="font-mono text-xs font-bold text-zinc-900 dark:text-white"
                      >
                        {latestReceipt.demoTransactionId}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-zinc-500 dark:text-zinc-400 block">
                          Invoice Number
                        </span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-white">
                          {latestReceipt.invoiceNumber}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-zinc-400 block">
                          Simulated Payment Amount
                        </span>
                        <span
                          data-testid="receipt-simulated-amount"
                          className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400"
                        >
                          {formatINR(latestReceipt.simulatedPaymentAmountPaise)}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-zinc-400 block">
                          Previous Balance
                        </span>
                        <span
                          data-testid="receipt-previous-balance"
                          className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200"
                        >
                          {formatINR(latestReceipt.previousBalancePaise)}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-zinc-400 block">
                          Remaining Demo Balance
                        </span>
                        <span
                          data-testid="receipt-remaining-balance"
                          className="font-mono tabular-nums font-bold text-zinc-900 dark:text-white"
                        >
                          {formatINR(latestReceipt.remainingBalancePaise)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadDemoReceiptPdf(latestReceipt)}
                      data-testid="download-demo-receipt-pdf-btn"
                      className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <FileDown className="w-4 h-4" />
                      <span>Download PDF Demonstration Receipt</span>
                    </button>
                  </div>
                )}

                {/* Prior Simulated Transactions List & Admin Reset Control */}
                <div className="pt-4 border-t border-zinc-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Simulated DEMO transactions on this invoice:{' '}
                      <strong>{invoiceView.simulatedTransactions.length}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetDemo}
                    data-testid="buyer-page-reset-demo-btn"
                    className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Admin: Reset Demo Data</span>
                  </button>
                </div>

                {resetMessage && (
                  <p
                    data-testid="buyer-page-reset-message"
                    className="text-xs font-medium text-emerald-600 dark:text-emerald-400"
                  >
                    {resetMessage}
                  </p>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
