/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Tax Invoices, Authoritative GST Billing & Receivables Ledger
 * Merges the Tax Invoicing & Authoritative GST Engine from VenkataSuresh-Maddi/duesgaurd
 * (Intra-State CGST+SGST vs Inter-State IGST, SKU line-item snapshotting, PDF Tax Invoice export)
 * with DuesGuard AI's deterministic `decimal.js` MSMED ledger, QR Payment, and Bank Reconciliation.
 */

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Download,
  QrCode,
  Search,
  Trash2,
  X,
  CheckCircle2,
  AlertOctagon,
  Clock,
  PlusCircle,
  Mail,
} from 'lucide-react';
import type {
  CaseRecord,
  CustomerRecord,
  ExternalPaymentMethod,
  InvoiceRecord,
  PaymentRecord,
  ProductItemRecord,
} from '../types/index.ts';
import { formatINR, paiseToRupees, rupeesToPaise } from '../services/finance.ts';
import {
  INDIAN_STATES_AND_UTS,
  calculateGstInvoiceBreakdown,
} from '../services/erpBillingService.ts';
import { generateGstTaxInvoicePdf } from '../services/pdfGenerator.ts';
import { LogPaymentModal } from './LogPaymentModal.tsx';

interface InvoicesBillingViewProps {
  caseRecord: CaseRecord;
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  customers: CustomerRecord[];
  products: ProductItemRecord[];
  asOfDate: string;
  sellerState?: string;
  initialOpenCreateModal?: boolean;
  preselectedCustomerId?: string | null;
  onClearInitialModalState?: () => void;
  onGenerateInvoice: (payload: {
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
  }) => Promise<InvoiceRecord | null>;
  onLogPayment: (payload: {
    invoiceId?: string;
    amountPaise: string;
    paymentDate: string;
    reference: string;
    paymentMethod: ExternalPaymentMethod;
    notes: string;
  }) => Promise<void>;
  onDeletePayment: (paymentId: string) => Promise<void>;
  onGenerateQrCode: (invoiceId: string) => void;
  onSendReminderForInvoice?: (invoiceId: string) => void;
}

interface DraftLineItem {
  key: string;
  productId: string;
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceRupees: string;
  costPricePaise: string;
  taxRatePercent: number;
}

export const InvoicesBillingView: React.FC<InvoicesBillingViewProps> = ({
  caseRecord,
  invoices,
  payments,
  customers,
  products,
  sellerState = 'Karnataka',
  initialOpenCreateModal = false,
  preselectedCustomerId = null,
  onClearInitialModalState,
  onGenerateInvoice,
  onLogPayment,
  onDeletePayment,
  onGenerateQrCode,
  onSendReminderForInvoice,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'pending' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(initialOpenCreateModal);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoiceIdForPay, setSelectedInvoiceIdForPay] = useState<string | undefined>(
    undefined
  );

  // Invoice Generator Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    preselectedCustomerId || customers[0]?.id || ''
  );
  const [buyerName, setBuyerName] = useState<string>(customers[0]?.name || caseRecord.buyerName);
  const [buyerState, setBuyerState] = useState<string>(customers[0]?.state || 'Maharashtra');
  const [buyerGstin, setBuyerGstin] = useState<string>(
    customers[0]?.gstin || caseRecord.buyerGstin || ''
  );
  const [buyerEmail, setBuyerEmail] = useState<string>(
    customers[0]?.email || 'accounts.payable@bharatheavyind.in'
  );
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('2024-02-20');
  const [dueDate, setDueDate] = useState<string>('2024-03-21');
  const [poReference, setPoReference] = useState<string>('PO-2024-881');
  const [deliveryReference, setDeliveryReference] = useState<string>('DC-4510');
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const defaultProd = products[0];
  const [draftItems, setDraftItems] = useState<DraftLineItem[]>([
    {
      key: 'item-1',
      productId: defaultProd?.id || 'prod-cnc-01',
      sku: defaultProd?.sku || 'SKU-CNC-8810',
      description: defaultProd?.name || '5-Axis CNC Machined Impeller & Turbine Housing',
      quantity: 2,
      unit: defaultProd?.unit || 'PCS',
      unitPriceRupees: defaultProd ? paiseToRupees(defaultProd.sellingPricePaise) : '25000.00',
      costPricePaise: defaultProd?.costPricePaise || '1650000',
      taxRatePercent: defaultProd?.gstRatePercent ?? 18,
    },
  ]);

  useEffect(() => {
    if (initialOpenCreateModal) {
      setIsCreateModalOpen(true);
      if (preselectedCustomerId) {
        handleCustomerSelect(preselectedCustomerId);
      }
      onClearInitialModalState?.();
    }
  }, [initialOpenCreateModal, preselectedCustomerId]);

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setBuyerName(found.name);
      setBuyerState(found.state);
      setBuyerGstin(found.gstin || '');
      setBuyerEmail(found.email);
    }
  };

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    setDraftItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (!prod) return { ...item, productId: '' };
        return {
          ...item,
          productId: prod.id,
          sku: prod.sku,
          description: prod.name,
          unit: prod.unit,
          unitPriceRupees: paiseToRupees(prod.sellingPricePaise),
          costPricePaise: prod.costPricePaise,
          taxRatePercent: prod.gstRatePercent,
        };
      })
    );
  };

  const handleAddLineItem = () => {
    const p = products[draftItems.length % Math.max(1, products.length)];
    setDraftItems((prev) => [
      ...prev,
      {
        key: `item-${Date.now()}-${prev.length}`,
        productId: p?.id || '',
        sku: p?.sku || 'CUSTOM',
        description: p?.name || 'Custom Industrial Supply',
        quantity: 1,
        unit: p?.unit || 'PCS',
        unitPriceRupees: p ? paiseToRupees(p.sellingPricePaise) : '10000.00',
        costPricePaise: p?.costPricePaise || '650000',
        taxRatePercent: p?.gstRatePercent ?? 18,
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (draftItems.length <= 1) return;
    setDraftItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Live deterministic GST breakdown for the modal
  const liveGstCalc = calculateGstInvoiceBreakdown({
    sellerState,
    buyerState,
    items: draftItems.map((it) => ({
      productId: it.productId,
      sku: it.sku,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unitPricePaise: rupeesToPaise(it.unitPriceRupees || '0'),
      costPricePaise: it.costPricePaise,
      taxRatePercent: it.taxRatePercent,
    })),
  });

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || draftItems.length === 0) {
      setFormError('Buyer name and at least one line item are required.');
      return;
    }
    setFormError(null);
    setIsSubmittingInvoice(true);
    try {
      const created = await onGenerateInvoice({
        customerId: selectedCustomerId || undefined,
        buyerName: buyerName.trim(),
        buyerGstin: buyerGstin.trim(),
        buyerState,
        buyerEmail: buyerEmail.trim(),
        sellerState,
        invoiceNumber: invoiceNumber.trim() || undefined,
        invoiceDate,
        dueDate,
        poReference: poReference.trim() || 'PO-2024-881',
        deliveryReference: deliveryReference.trim() || 'DC-4510',
        paymentStatus,
        items: draftItems.map((it) => ({
          productId: it.productId || undefined,
          sku: it.sku,
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unit: it.unit,
          unitPricePaise: rupeesToPaise(it.unitPriceRupees || '0'),
          costPricePaise: it.costPricePaise,
          taxRatePercent: Number(it.taxRatePercent) || 18,
        })),
      });
      if (created) {
        setIsCreateModalOpen(false);
        setInvoiceNumber('');
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to generate invoice');
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  const handleDownloadInvoicePdf = (inv: InvoiceRecord) => {
    const doc = generateGstTaxInvoicePdf({
      invoice: inv,
      caseRecord,
      customerState: inv.buyerState || 'Maharashtra',
    });
    doc.save(`Tax_Invoice_${inv.invoiceNumber}.pdf`);
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    const isPaid = inv.status === 'paid' || Number(inv.outstandingAmountPaise) === 0;
    const isOverdue = !isPaid && (inv.status === 'overdue' || inv.status === 'disputed');
    if (statusFilter === 'paid' && !isPaid) return false;
    if (statusFilter === 'overdue' && !isOverdue) return false;
    if (statusFilter === 'pending' && (isPaid || isOverdue)) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.buyer.toLowerCase().includes(q) ||
      (inv.poReference || '').toLowerCase().includes(q) ||
      (inv.deliveryReference || '').toLowerCase().includes(q)
    );
  });

  const totalBilledPaise = invoices.reduce(
    (acc, i) => acc + BigInt(i.totalAmountPaise || '0'),
    0n
  );
  const totalPaidPaise = invoices.reduce(
    (acc, i) => acc + BigInt(i.paidAmountPaise || '0'),
    0n
  );
  const totalOutstandingPaise = invoices.reduce(
    (acc, i) => acc + BigInt(i.outstandingAmountPaise || '0'),
    0n
  );

  return (
    <div className="space-y-6" data-testid="invoices-billing-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            Authoritative GST Tax Engine · Intra-State (CGST+SGST) &amp; Inter-State (IGST)
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mt-0.5">
            Tax Invoices &amp; Receivables Ledger
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Generate sequential GST-compliant tax invoices, download statutory PDFs, and reconcile partial bank settlements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            data-testid="open-create-gst-invoice-btn"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate GST Invoice</span>
          </button>

          <button
            type="button"
            data-testid="invoices-log-payment-btn"
            onClick={() => {
              setSelectedInvoiceIdForPay(invoices[0]?.id);
              setIsPaymentModalOpen(true);
            }}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Total Billed Across {invoices.length} Invoices
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-zinc-900 dark:text-white mt-1">
            {formatINR(totalBilledPaise.toString())}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            Supplier Origin: {sellerState} · GSTIN {caseRecord.sellerGstin}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            Verified Collections &amp; Allocations
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {formatINR(totalPaidPaise.toString())}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            {payments.length} bank/UPI payment receipts reconciled
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">
            Net Principal Balance Due
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
            {formatINR(totalOutstandingPaise.toString())}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            Subject to MSMED Act § 16 (3× RBI Bank Rate @ 20.25% p.a.)
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-3">
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg">
          {(['all', 'overdue', 'pending', 'paid'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {st === 'all'
                ? `All Invoices (${invoices.length})`
                : st === 'overdue'
                ? 'Overdue (§ 16)'
                : st === 'pending'
                ? 'Current / Not Due'
                : 'Settled (Paid)'}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Filter invoices by number, buyer, or PO"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by Invoice #, Buyer, or PO..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* High-Density Tax Invoices Table */}
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Buyer &amp; Place of Supply</th>
                <th className="py-3 px-4">Dates (Issued / Due)</th>
                <th className="py-3 px-4">PO / Delivery</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/70">
              {filteredInvoices.map((inv) => {
                const isPaid = inv.status === 'paid' || Number(inv.outstandingAmountPaise) === 0;
                const isOverdue = !isPaid && (inv.status === 'overdue' || inv.status === 'disputed');
                return (
                  <tr
                    key={inv.id}
                    data-testid={`invoice-row-${inv.invoiceNumber}`}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 dark:text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-900 dark:text-white">
                        {inv.buyer}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {inv.buyerState || 'Maharashtra'} ·{' '}
                        {inv.supplyType === 'INTRA_STATE' ? 'CGST+SGST' : 'IGST (Inter-State)'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums">
                      <div className="text-zinc-800 dark:text-zinc-200">{inv.invoiceDate}</div>
                      <div className="text-[11px] text-zinc-500">
                        Due: {inv.contractualDueDate || '30d'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        {inv.poReference || '—'}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {inv.deliveryReference || 'Missing POD'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-zinc-900 dark:text-white">
                      {formatINR(inv.totalAmountPaise)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatINR(inv.paidAmountPaise || '0')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-zinc-900 dark:text-white">
                      {formatINR(inv.outstandingAmountPaise)}
                    </td>
                    <td className="py-3.5 px-4">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Paid</span>
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                          <AlertOctagon className="w-3.5 h-3.5" />
                          <span>Overdue (§16)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Current</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoicePdf(inv)}
                          title={`Download GST Tax Invoice PDF for ${inv.invoiceNumber}`}
                          data-testid={`download-tax-pdf-btn-${inv.invoiceNumber}`}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                        >
                          <Download className="w-3 h-3" />
                          <span>Tax PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onGenerateQrCode(inv.id)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                        >
                          <QrCode className="w-3 h-3" />
                          <span>QR</span>
                        </button>

                        {!isPaid && onSendReminderForInvoice && (
                          <button
                            type="button"
                            data-testid={`remind-invoice-btn-${inv.invoiceNumber}`}
                            onClick={() => onSendReminderForInvoice(inv.id)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                          >
                            <Mail className="w-3 h-3" />
                            <span>Remind</span>
                          </button>
                        )}

                        {!isPaid && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoiceIdForPay(inv.id);
                              setIsPaymentModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition cursor-pointer whitespace-nowrap"
                          >
                            + Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recorded Payments History */}
      {payments.length > 0 && (
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-500" />
              <span>Recorded Bank &amp; UPI Payment Reconciliations ({payments.length})</span>
            </h3>
            <span className="text-xs text-zinc-500 font-mono">
              FIFO &amp; Targeted Invoice Allocations
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {payments.map((pay) => (
              <div
                key={pay.id}
                className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-mono font-bold text-zinc-900 dark:text-white">
                    {formatINR(pay.amountPaise)} · {pay.paymentMethod || 'NEFT'} · {pay.paymentDate}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                    UTR/Ref: {pay.reference}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeletePayment(pay.id)}
                  aria-label={`Delete payment ${pay.reference}`}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: GENERATE GST TAX INVOICE */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  Generate Authoritative GST Tax Invoice
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Automatic Place of Supply calculation: Intra-State (CGST+SGST) vs Inter-State (IGST)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close invoice generator modal"
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4 text-xs">
              {/* Customer & Place of Supply Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Select Registered Customer
                  </label>
                  <select
                    aria-label="Select Customer"
                    data-testid="select-invoice-customer"
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  >
                    <option value="">-- Custom Buyer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.state})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Buyer Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Buyer State (Place of Supply) *
                  </label>
                  <select
                    aria-label="Buyer State"
                    data-testid="select-invoice-buyer-state"
                    value={buyerState}
                    onChange={(e) => setBuyerState(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  >
                    {INDIAN_STATES_AND_UTS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Invoice Meta Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Invoice # (Auto if blank)
                  </label>
                  <input
                    type="text"
                    data-testid="input-invoice-number"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g., INV-104"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Due Date (≤45d) *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Payment Status
                  </label>
                  <select
                    aria-label="Initial Payment Status"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as 'unpaid' | 'paid')}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  >
                    <option value="unpaid">Unpaid (Add to Receivables)</option>
                    <option value="paid">Already Paid (Settled)</option>
                  </select>
                </div>
              </div>

              {/* Line Items Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Line Items (Snapshot from Product Catalogue)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    + Add Line Item
                  </button>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {draftItems.map((item, idx) => (
                    <div
                      key={item.key}
                      className="grid grid-cols-12 gap-2 items-center bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800"
                    >
                      <div className="col-span-12 sm:col-span-4">
                        <select
                          aria-label={`Select SKU for row ${idx + 1}`}
                          value={item.productId}
                          onChange={(e) => handleProductSelect(idx, e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-xs"
                        >
                          <option value="">Custom Item</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} — {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <input
                          type="number"
                          min={1}
                          aria-label={`Quantity for row ${idx + 1}`}
                          value={item.quantity}
                          onChange={(e) =>
                            setDraftItems((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, quantity: Number(e.target.value) || 1 } : r
                              )
                            )
                          }
                          className="w-full px-2 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono text-right"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          aria-label={`Unit price INR for row ${idx + 1}`}
                          value={item.unitPriceRupees}
                          onChange={(e) =>
                            setDraftItems((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, unitPriceRupees: e.target.value } : r
                              )
                            )
                          }
                          className="w-full px-2 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono text-right"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <select
                          aria-label={`GST rate for row ${idx + 1}`}
                          value={item.taxRatePercent}
                          onChange={(e) =>
                            setDraftItems((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? { ...r, taxRatePercent: Number(e.target.value) }
                                  : r
                              )
                            )
                          }
                          className="w-full px-2 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                        >
                          <option value={0}>0% GST</option>
                          <option value={5}>5% GST</option>
                          <option value={12}>12% GST</option>
                          <option value={18}>18% GST</option>
                          <option value={28}>28% GST</option>
                        </select>
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          aria-label={`Remove line item ${idx + 1}`}
                          className="text-zinc-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Authoritative GST Calculation Summary Box */}
              <div
                data-testid="live-gst-breakdown-box"
                className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <span>
                    Place of Supply: {sellerState} → {buyerState} (
                    {liveGstCalc.supplyType === 'INTRA_STATE'
                      ? 'Intra-State CGST + SGST'
                      : 'Inter-State IGST'}
                    )
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    Est. Gross Margin: {formatINR(liveGstCalc.estimatedGrossMarginPaise)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-zinc-200/70 dark:border-zinc-800 font-mono tabular-nums">
                  <div>
                    <div className="text-[11px] text-zinc-500">Taxable Subtotal</div>
                    <div className="font-bold text-zinc-900 dark:text-white">
                      {formatINR(liveGstCalc.subtotalPaise)}
                    </div>
                  </div>
                  {liveGstCalc.supplyType === 'INTRA_STATE' ? (
                    <>
                      <div>
                        <div className="text-[11px] text-zinc-500">CGST (50% Tax)</div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {formatINR(liveGstCalc.cgstPaise)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-500">SGST (50% Tax)</div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {formatINR(liveGstCalc.sgstPaise)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2">
                      <div className="text-[11px] text-zinc-500">IGST (100% Inter-State Tax)</div>
                      <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {formatINR(liveGstCalc.igstPaise)}
                      </div>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-[11px] text-zinc-500">Grand Total (INR)</div>
                    <div
                      data-testid="live-gst-grand-total"
                      className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400"
                    >
                      {formatINR(liveGstCalc.grandTotalPaise)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvoice}
                  data-testid="submit-generate-gst-invoice-btn"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingInvoice
                    ? 'Generating...'
                    : 'Generate GST Invoice & Update Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <LogPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        invoices={invoices}
        preselectedInvoiceId={selectedInvoiceIdForPay}
        onSubmitPayment={onLogPayment}
      />
    </div>
  );
};
