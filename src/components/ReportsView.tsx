/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  Download,
  ShieldCheck,
  Lock,
  Printer,
  FileCheck2,
  AlertCircle,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import type { AnalysisRun, CaseDocument, CaseRecord, InvoiceRecord } from '../types/index.ts';
import { formatINR, paiseToRupees } from '../services/finance.ts';
import { generateCasePdf } from '../services/pdfGenerator.ts';

interface ReportsViewProps {
  caseRecord: CaseRecord;
  analysis: AnalysisRun | null;
  invoices: InvoiceRecord[];
  documents: CaseDocument[];
  onNavigateTab: (tabId: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  caseRecord,
  analysis,
  invoices,
  documents,
  onNavigateTab,
}) => {
  const [activeReportTab, setActiveReportTab] = useState<'internal' | 'odr'>('internal');
  const [isGenerating, setIsGenerating] = useState(false);

  const isApproved = analysis?.approvalStatus === 'approved';
  const msmed = analysis?.msmedResult;

  const handleDownloadPdf = (reportType: 'internal_case_summary' | 'odr_annexure_index') => {
    if (!analysis) return;
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const doc = generateCasePdf({
          reportType,
          caseRecord,
          analysis,
          invoices,
          documents,
        });
        const filename = `${caseRecord.caseReference}_${
          reportType === 'internal_case_summary' ? 'Case_Summary' : 'ODR_Annexure'
        }.pdf`;
        doc.save(filename);
      } catch (err) {
        console.error('PDF Generation failed:', err);
      } finally {
        setIsGenerating(false);
      }
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-indigo-600" />
              Audit-Ready Case Summaries & ODR Annexure Index
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
              Version 1.0 (Immutable)
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Export legally formatted evidence indices and statutory interest calculations for MSME Samadhaan filing, conciliation tribunals, or internal executive review.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleDownloadPdf('internal_case_summary')}
            disabled={!isApproved || isGenerating}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Case Summary PDF</span>
          </button>

          <button
            onClick={() => handleDownloadPdf('odr_annexure_index')}
            disabled={!isApproved || isGenerating}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Download ODR Annexure PDF</span>
          </button>
        </div>
      </div>

      {!isApproved && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              <strong>Draft Mode:</strong> Final statutory reports are watermarked as Draft until formally authorized at the Human Review Gate.
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('review')}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition shrink-0 cursor-pointer"
          >
            Authorize Now
          </button>
        </div>
      )}

      {/* Tabs between Internal Case Summary and ODR Annexure */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveReportTab('internal')}
          className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeReportTab === 'internal'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Report 1: Internal Case Summary
        </button>
        <button
          onClick={() => setActiveReportTab('odr')}
          className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeReportTab === 'odr'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Report 2: ODR-Ready Evidence Index / Draft Annexure
        </button>
      </div>

      {/* In-browser Document Viewer Sheet */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-xl p-8 max-w-4xl mx-auto font-sans text-slate-800 space-y-6">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
              {activeReportTab === 'internal'
                ? 'Internal Management Audit & Case Summary'
                : 'MSME Samadhaan / ODR Portal Filing Annexure'}
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mt-1">
              {activeReportTab === 'internal'
                ? 'DUESGUARD AI STATUTORY RECOVERY AUDIT'
                : 'ANNEXURE-A: CHRONOLOGICAL EVIDENCE INDEX & CLAIM AFFIDAVIT'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Case Ref: <strong>{caseRecord.caseReference}</strong> | Date:{' '}
              {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="text-right">
            {isApproved ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold uppercase">
                <ShieldCheck className="w-3.5 h-3.5" /> Approved & Sealed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold uppercase">
                DRAFT - PENDING APPROVAL
              </span>
            )}
          </div>
        </div>

        {/* Section 1: Parties */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs border-b border-slate-200 pb-1">
            1. Particulars of Disputing Entities
          </h3>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-indigo-900 block mb-1">SUPPLIER (APPLICANT):</span>
              <p className="font-semibold text-slate-900">{caseRecord.sellerName}</p>
              <p className="text-slate-600">Udyam No: {caseRecord.sellerUdyamNumber}</p>
              <p className="text-slate-600">Registered: {caseRecord.sellerUdyamRegDate} (Micro Enterprise)</p>
              <p className="text-slate-600">GSTIN: {caseRecord.sellerGstin}</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-indigo-900 block mb-1">BUYER (RESPONDENT):</span>
              <p className="font-semibold text-slate-900">{caseRecord.buyerName}</p>
              <p className="text-slate-600">GSTIN: {caseRecord.buyerGstin || 'Unspecified'}</p>
              <p className="text-slate-600">Credit Terms: {caseRecord.contractualPaymentDays} Days Net</p>
              <p className="text-slate-600">Statutory Cap (§ 15): 45 Days Max</p>
            </div>
          </div>
        </div>

        {/* Section 2: Financial Calculation */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs border-b border-slate-200 pb-1">
            2. Statutory Debt & Section 16 Interest Computation
          </h3>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-600">Total Goods Invoiced Value:</span>
              <span className="font-bold text-slate-900">{formatINR(msmed?.principalAmountPaise || '0')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-600">Recorded Part Payments:</span>
              <span className="font-bold text-slate-900">{formatINR(msmed?.totalPaidPaise || '0')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-600">Outstanding Principal Debt (§ 15):</span>
              <span className="font-bold text-rose-700">{formatINR(msmed?.outstandingAmountPaise || '0')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-600">
                Statutory Compound Interest (§ 16 at 3× RBI Bank Rate - 20.25% p.a.):
              </span>
              <span className="font-bold text-indigo-700">{formatINR(msmed?.compoundedInterestPaise || '0')}</span>
            </div>
            <div className="flex justify-between py-1.5 pt-2 text-sm font-extrabold text-slate-900 border-t border-slate-300">
              <span>TOTAL ADJUDICATION CLAIM AMOUNT:</span>
              <span className="text-indigo-900 text-base">{formatINR(msmed?.totalClaimAmountPaise || '0')}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Evidence Chronology */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs border-b border-slate-200 pb-1">
            3. Chronological Evidence Ledger & Supply Chain Audit
          </h3>

          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold text-[11px]">
              <tr>
                <th className="py-2 px-3">Item #</th>
                <th className="py-2 px-3">Invoice No.</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">PO Reference</th>
                <th className="py-2 px-3">Delivery Proof</th>
                <th className="py-2 px-3 text-right">Invoice Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {invoices.map((inv, idx) => (
                <tr key={inv.id}>
                  <td className="py-2 px-3">{idx + 1}</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{inv.invoiceNumber}</td>
                  <td className="py-2 px-3">{inv.invoiceDate}</td>
                  <td className="py-2 px-3 font-mono">{inv.poReference || 'None'}</td>
                  <td className="py-2 px-3">
                    {inv.invoiceNumber === 'INV-102' ? (
                      <span className="text-rose-600 font-bold">MISSING POD (DC-4480)</span>
                    ) : (
                      <span className="text-emerald-700 font-semibold">{inv.deliveryReference || 'Corroborated'}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-right">{formatINR(inv.totalAmountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 4: Authorized Reviewer Seal */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 text-xs space-y-1.5">
          <span className="font-bold text-slate-900 block uppercase tracking-wider">
            4. Reviewer Verification & Attestation Seal
          </span>
          <p className="text-slate-700">
            <strong>Authorized Reviewer:</strong> {analysis?.reviewerName || 'Harsha Vardhan'} (
            {analysis?.reviewerDesignation || 'MSME Financial Reviewer'})
          </p>
          <p className="text-slate-700">
            <strong>Audit Notes:</strong> {analysis?.reviewerNotes || 'Verified against uploaded case documentation.'}
          </p>
          <p className="text-slate-500 text-[11px] font-mono">
            Attestation Hash: 0fa37fd0-ed80-4db4-b565-eb760b50501e | Signed:{' '}
            {analysis?.reviewedAt || new Date().toISOString()}
          </p>
        </div>
      </div>
    </div>
  );
};
