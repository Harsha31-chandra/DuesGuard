/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Dynamic External Payment Logging Modal
 * Strict Product Boundary: DuesGuard AI is an evidence-preparation platform and NEVER
 * collects payments or executes UPI transfers. Users record external bank/UPI receipts
 * here to dynamically allocate integer paise to invoices and recalculate MSMED § 16
 * statutory compound interest (3x RBI Bank Rate, monthly rests).
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShieldCheck,
  Receipt,
  Calendar,
  Hash,
  Calculator,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import type { ExternalPaymentMethod, InvoiceRecord } from '../types/index.ts';
import { formatINR, rupeesToPaise } from '../services/finance.ts';

interface LogPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: InvoiceRecord[];
  preselectedInvoiceId?: string;
  onSubmitPayment: (payload: {
    invoiceId?: string;
    amountPaise: string;
    paymentDate: string;
    reference: string;
    paymentMethod: ExternalPaymentMethod;
    notes: string;
  }) => Promise<void>;
}

const PAYMENT_METHODS: ExternalPaymentMethod[] = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'CHEQUE'];

export const LogPaymentModal: React.FC<LogPaymentModalProps> = ({
  isOpen,
  onClose,
  invoices,
  preselectedInvoiceId,
  onSubmitPayment,
}) => {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(preselectedInvoiceId || 'inv-101');
  const [amountRupees, setAmountRupees] = useState<string>('15000.00');
  const [paymentDate, setPaymentDate] = useState<string>('2024-03-10');
  const [paymentMethod, setPaymentMethod] = useState<ExternalPaymentMethod>('UPI');
  const [reference, setReference] = useState<string>('UPI/407019283741/AXIS');
  const [notes, setNotes] = useState<string>(
    'Partial payment received externally via UPI; credited against overdue principal.'
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (preselectedInvoiceId) {
      setSelectedInvoiceId(preselectedInvoiceId);
    }
  }, [preselectedInvoiceId]);

  if (!isOpen) return null;

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  const handlePreset = (rupees: string, invId: string, method: ExternalPaymentMethod, ref: string) => {
    setAmountRupees(rupees);
    setSelectedInvoiceId(invId);
    setPaymentMethod(method);
    setReference(ref);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const numericRupees = Number(amountRupees);
    if (!Number.isFinite(numericRupees) || numericRupees <= 0) {
      setErrorMsg('Please enter a valid positive payment amount in Rupees (₹).');
      return;
    }

    if (!reference.trim()) {
      setErrorMsg('Please provide the external UPI Transaction ID or Bank UTR reference.');
      return;
    }

    const amountPaise = rupeesToPaise(numericRupees.toFixed(2));
    setIsSubmitting(true);
    try {
      await onSubmitPayment({
        invoiceId: selectedInvoiceId === 'FIFO_AUTO' ? undefined : selectedInvoiceId,
        amountPaise,
        paymentDate,
        reference: reference.trim(),
        paymentMethod,
        notes: notes.trim(),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to log payment allocation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-md"
        data-testid="log-payment-modal-backdrop"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          data-testid="log-payment-modal"
          className="w-full max-w-xl rounded-[2rem] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-zinc-200/80 dark:border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.22)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.65)] overflow-hidden"
        >
          {/* Header */}
          <div className="px-7 pt-6 pb-4 border-b border-zinc-100 dark:border-white/10 flex items-start justify-between gap-4">
            <div>
              <div className="tracking-wider uppercase text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                <span>Dynamic Disputed Invoice Ledger</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white mt-1">
                Log External Payment &amp; Allocate
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Dynamically recalculates Outstanding Principal &amp; MSMED § 16 Monthly Compounding Rests
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-7 space-y-5">
            {/* Strict Product Boundary Notice */}
            <div className="rounded-2xl p-3.5 bg-indigo-500/[0.06] dark:bg-indigo-500/[0.1] border border-indigo-500/20 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                  Evidence Preparation Only (Non-Gateway Boundary):
                </strong>{' '}
                DuesGuard AI never initiates, collects, or processes UPI/bank transfers. Record payments settled
                outside the platform to update integer <code className="font-mono">paise</code> allocations and
                recompute statutory interest on the exact payment date.
              </div>
            </div>

            {/* Quick Presets for Rapid Verification */}
            <div>
              <span className="block tracking-wider uppercase text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-2">
                Quick Verification Presets
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="preset-partial-upi-btn"
                  onClick={() =>
                    handlePreset('15000.00', 'inv-101', 'UPI', 'UPI/407019283741/AXIS')
                  }
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200 border border-zinc-200/70 dark:border-white/10 transition cursor-pointer"
                >
                  ₹15,000 Partial UPI → INV-101
                </button>
                <button
                  type="button"
                  data-testid="preset-settle-inv102-btn"
                  onClick={() =>
                    handlePreset('30000.00', 'inv-102', 'NEFT', 'UTR-HDFCR5202403109912')
                  }
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200 border border-zinc-200/70 dark:border-white/10 transition cursor-pointer"
                >
                  ₹30,000 NEFT → Settle INV-102
                </button>
                <button
                  type="button"
                  data-testid="preset-settle-inv101-btn"
                  onClick={() =>
                    handlePreset('50000.00', 'inv-101', 'RTGS', 'UTR-SBINR1202403188821')
                  }
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200 border border-zinc-200/70 dark:border-white/10 transition cursor-pointer"
                >
                  ₹50,000 RTGS → Settle INV-101
                </button>
              </div>
            </div>

            {/* Target Invoice Allocation */}
            <div>
              <label className="block tracking-wider uppercase text-[11px] font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">
                Target Invoice Allocation (<code className="font-mono">payment_allocations</code>)
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  data-testid="payment-invoice-select"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs font-semibold bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — Outstanding: {formatINR(inv.outstandingAmountPaise)} (Invoiced:{' '}
                      {formatINR(inv.totalAmountPaise)})
                    </option>
                  ))}
                  <option value="FIFO_AUTO">
                    FIFO Auto-Allocation (Oldest Overdue Invoice First)
                  </option>
                </select>
              </div>
              {selectedInvoice && (
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                  Selected: {selectedInvoice.invoiceNumber} · Current Balance:{' '}
                  <strong className="text-zinc-800 dark:text-zinc-200">
                    {formatINR(selectedInvoice.outstandingAmountPaise)}
                  </strong>
                </p>
              )}
            </div>

            {/* Amount & Date Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block tracking-wider uppercase text-[11px] font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Payment Amount (₹ INR)
                </label>
                <div className="relative">
                  <Calculator className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                    data-testid="payment-amount-input"
                    placeholder="15000.00"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <span className="block mt-1 text-[10px] font-mono text-zinc-400">
                  Stored as integer paise:{' '}
                  {Number(amountRupees) > 0
                    ? `${rupeesToPaise(Number(amountRupees).toFixed(2))} paise`
                    : '0 paise'}
                </span>
              </div>

              <div>
                <label className="block tracking-wider uppercase text-[11px] font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Exact Payment Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    data-testid="payment-date-input"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <span className="block mt-1 text-[10px] text-zinc-400">
                  Reduces principal on this exact date for § 16 rests
                </span>
              </div>
            </div>

            {/* Channel & Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block tracking-wider uppercase text-[11px] font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Channel
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as ExternalPaymentMethod)}
                  data-testid="payment-method-select"
                  className="w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block tracking-wider uppercase text-[11px] font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">
                  UPI Txn ID / Bank UTR Reference
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    data-testid="payment-reference-input"
                    placeholder="UPI/407019283741/AXIS or UTR-..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs font-mono font-semibold bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {errorMsg}
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="submit-log-payment-btn"
                className="px-5 py-2.5 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Recalculating Ledger...'
                    : 'Record Payment & Recalculate § 16 Interest'}
                </span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
