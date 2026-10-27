/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Calculator,
  TrendingUp,
  Scale,
  Calendar,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  QrCode,
} from 'lucide-react';
import type { InvoiceRecord, MsmedCalculationResult } from '../types/index.ts';
import {
  formatINR,
  paiseToRupees,
  RBI_BANK_RATE_SCHEDULE,
  calculateSection15Timeline,
} from '../services/finance.ts';

interface FinanceEngineViewProps {
  invoices: InvoiceRecord[];
  msmedResult?: MsmedCalculationResult;
  contractualDays: number;
  asOfDate: string;
  onGenerateQrCode?: (invoiceId: string) => void;
}

export const FinanceEngineView: React.FC<FinanceEngineViewProps> = ({
  invoices,
  msmedResult,
  contractualDays,
  asOfDate,
  onGenerateQrCode,
}) => {
  const [showRbiSchedule, setShowRbiSchedule] = useState(false);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>('inv-101');

  // Calculate Section 15 timeline demonstration for primary batch
  const s15 = calculateSection15Timeline({
    deliveryDate: '2024-01-18',
    contractualDays,
  });

  return (
    <div className="space-y-6">
      {/* Overview header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" />
              Deterministic MSMED Compliance & Financial Engine
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Zero-Float Decimal.js
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Calculates outstanding principal, payment allocations, Section 15 statutory caps, and Section 16 compound interest at 3× RBI Bank Rate with monthly rests.
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 uppercase font-semibold">Statutory Annual Rate</span>
          <div className="text-xl font-extrabold text-indigo-600 flex items-center gap-1.5 justify-end">
            <Scale className="w-5 h-5 text-indigo-500" />
            <span>20.25% p.a.</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">3 × 6.75% RBI Bank Rate</span>
        </div>
      </div>

      {/* Section 15 Statutory Timeline Visualizer */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-indigo-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            MSMED Act Section 15 Statutory Payment Deadlines
          </h3>
          <span className="text-xs text-slate-400 font-mono">Appointed Day vs 45-Day Cap</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Step 1: Delivery Date */}
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 text-[10px] uppercase font-bold">1. Delivery Date</span>
            <div className="text-sm font-bold text-white mt-1">18-Jan-2024</div>
            <p className="text-[11px] text-slate-400 mt-1">Physical receipt by MegaCorp Site In-Charge (DC-4412)</p>
          </div>

          {/* Step 2: 15-Day Objection Window */}
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 text-[10px] uppercase font-bold">2. 15-Day Deemed Acceptance</span>
            <div className="text-sm font-bold text-emerald-400 mt-1">02-Feb-2024</div>
            <p className="text-[11px] text-slate-400 mt-1">No written buyer objection lodged within 15 days</p>
          </div>

          {/* Step 3: Statutory Deadline (§ 15) */}
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 text-[10px] uppercase font-bold">3. Statutory Deadline</span>
            <div className="text-sm font-bold text-amber-400 mt-1">{s15.statutoryDeadline}</div>
            <p className="text-[11px] text-slate-400 mt-1">Agreed {contractualDays} Days Net (Max statutory cap: 45 Days)</p>
          </div>

          {/* Step 4: Interest Trigger (§ 16) */}
          <div className="bg-indigo-900/60 p-3.5 rounded-xl border border-indigo-700">
            <span className="text-indigo-300 text-[10px] uppercase font-bold">4. Section 16 Interest Trigger</span>
            <div className="text-sm font-bold text-indigo-300 mt-1">{s15.interestStartDate}</div>
            <p className="text-[11px] text-indigo-200 mt-1">Compound interest with monthly rests begins automatically</p>
          </div>
        </div>

        {contractualDays > 45 && (
          <div className="mt-4 p-3 bg-amber-950/80 border border-amber-800 rounded-lg text-xs text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Statutory Warning:</strong> Contract terms specified {contractualDays} days. Under Section 15 of the MSMED Act, no agreement between buyer and supplier can exceed 45 days. The calculation has been capped at 45 days.
            </span>
          </div>
        )}
      </div>

      {/* Disputed Invoice Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Disputed Invoice Ledger & Line Items</h3>
          <span className="text-xs text-slate-500">Click any invoice to view detailed line-item base and tax</span>
        </div>

        <div className="divide-y divide-slate-100">
          {invoices.map((inv) => {
            const isExpanded = expandedInvoiceId === inv.id;
            return (
              <div key={inv.id} className="p-4 hover:bg-slate-50/50 transition">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-sm text-slate-900">{inv.invoiceNumber}</span>
                    <span className="text-xs text-slate-500 font-mono">Date: {inv.invoiceDate}</span>
                    <span className="text-xs text-slate-500">PO: {inv.poReference || 'None'}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs text-slate-400">Outstanding:</span>
                      <span className="font-bold text-sm font-mono text-indigo-600 ml-1.5">
                        {formatINR(inv.outstandingAmountPaise)}
                      </span>
                    </div>

                    {onGenerateQrCode && (
                      <button
                        type="button"
                        data-testid={`finance-generate-qr-btn-${inv.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateQrCode(inv.id);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Generate QR Code</span>
                      </button>
                    )}

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        inv.status === 'overdue'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : inv.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {inv.status}
                    </span>

                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {isExpanded && inv.lineItems && inv.lineItems.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50/80 rounded-lg p-3 text-xs">
                    <span className="font-semibold text-slate-700 block mb-2">Line Items (HSN & Tax Breakdown):</span>
                    <table className="w-full text-left">
                      <thead className="text-[11px] text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                          <th className="pb-1.5">Description</th>
                          <th className="pb-1.5">Qty</th>
                          <th className="pb-1.5">Unit Price</th>
                          <th className="pb-1.5">Tax (GST)</th>
                          <th className="pb-1.5 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 text-slate-700">
                        {inv.lineItems.map((li) => (
                          <tr key={li.id}>
                            <td className="py-1.5 font-medium">{li.description}</td>
                            <td className="py-1.5">{li.quantity}</td>
                            <td className="py-1.5 font-mono">{formatINR(li.unitPricePaise)}</td>
                            <td className="py-1.5">{li.taxRatePercent}%</td>
                            <td className="py-1.5 font-mono font-bold text-right">{formatINR(li.lineTotalPaise)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 16 Monthly Compounding Schedule */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Section 16 Statutory Compound Interest Schedule (Monthly Rests)
            </h3>
            <p className="text-xs text-slate-500">
              Compounded monthly at 3× RBI Bank Rate (20.25% p.a.) calculated up to {asOfDate}.
            </p>
          </div>

          <button
            onClick={() => setShowRbiSchedule(!showRbiSchedule)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            <span>{showRbiSchedule ? 'Hide RBI Notification Schedule' : 'View Historical RBI Bank Rates'}</span>
          </button>
        </div>

        {/* Historical RBI Rate schedule modal/drawer */}
        {showRbiSchedule && (
          <div className="p-4 bg-slate-900 text-white border-b border-slate-800 text-xs">
            <span className="font-bold text-indigo-300 block mb-2">
              Official Reserve Bank of India (RBI) Bank Rate Notification Schedule:
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="pb-1.5">Effective Date</th>
                    <th className="pb-1.5">RBI Bank Rate</th>
                    <th className="pb-1.5">MSMED 3× Statutory Rate</th>
                    <th className="pb-1.5">Official Source Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {RBI_BANK_RATE_SCHEDULE.map((rate, i) => (
                    <tr key={i}>
                      <td className="py-1.5 font-mono font-bold">{rate.effectiveDate}</td>
                      <td className="py-1.5">{rate.bankRatePercent}%</td>
                      <td className="py-1.5 font-bold text-indigo-400">{rate.statutoryRatePercent}%</td>
                      <td className="py-1.5 text-slate-400">{rate.sourceReference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Compounding Periods Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Date Range</th>
                <th className="py-3 px-4">Days</th>
                <th className="py-3 px-4">Statutory Rate</th>
                <th className="py-3 px-4">Opening Principal</th>
                <th className="py-3 px-4">Accrued Interest</th>
                <th className="py-3 px-4">Closing Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {msmedResult?.applicableRatePeriods && msmedResult.applicableRatePeriods.length > 0 ? (
                msmedResult.applicableRatePeriods.map((period) => (
                  <tr key={period.periodIndex} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{period.monthLabel}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px]">
                      {period.startDate} to {period.endDate}
                    </td>
                    <td className="py-2.5 px-4">{period.days}</td>
                    <td className="py-2.5 px-4 font-semibold text-indigo-600">{period.statutoryRatePercent}</td>
                    <td className="py-2.5 px-4 font-mono">{formatINR(period.openingPrincipalPaise)}</td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-emerald-600">
                      +{formatINR(period.interestAccruedPaise)}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                      {formatINR(period.closingBalancePaise)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No overdue period elapsed yet or run analysis to view monthly rest schedule.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statutory Legal Citations Box */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-xs text-slate-600 space-y-2">
        <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
          <Scale className="w-4 h-4 text-indigo-600" />
          Statutory Legal Provisions (MSMED Act 2006)
        </h4>
        <ul className="list-disc pl-5 space-y-1 leading-relaxed">
          <li>
            <strong>Section 15:</strong> The buyer must make payment on or before the agreed date, which in no case shall exceed forty-five days from the day of acceptance or deemed acceptance.
          </li>
          <li>
            <strong>Section 16:</strong> Where any buyer fails to make payment, the buyer is liable to pay compound interest with monthly rests to the supplier at three times the Bank Rate notified by the Reserve Bank of India.
          </li>
          <li>
            <strong>Section 23:</strong> Notwithstanding anything contained in the Income-tax Act, 1961, the amount of interest payable or paid by any buyer under Section 16 is <strong>strictly not allowable as deduction</strong> for the computation of taxable income.
          </li>
        </ul>
      </div>
    </div>
  );
};
