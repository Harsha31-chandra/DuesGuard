/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  FileCheck,
  Send,
  Lock,
  UserCheck,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import type { AnalysisRun, CaseRecord, Finding } from '../types/index.ts';

interface ReviewApprovalViewProps {
  caseRecord: CaseRecord;
  analysis: AnalysisRun | null;
  onApprove: (data: {
    analysisId: string;
    reviewerName: string;
    reviewerDesignation: string;
    reviewerNotes: string;
  }) => void;
  onUpdateFinding: (findingId: string, updates: Partial<Finding>) => void;
  onOpenReportModal: () => void;
}

export const ReviewApprovalView: React.FC<ReviewApprovalViewProps> = ({
  caseRecord,
  analysis,
  onApprove,
  onUpdateFinding,
  onOpenReportModal,
}) => {
  const [reviewerName, setReviewerName] = useState(analysis?.reviewerName || 'Harsha Vardhan');
  const [reviewerDesignation, setReviewerDesignation] = useState(
    analysis?.reviewerDesignation || 'MSME Financial Reviewer / Lead Auditor'
  );
  const [reviewerNotes, setReviewerNotes] = useState(
    analysis?.reviewerNotes ||
      'Verified against uploaded tax invoices, purchase order PO-2024-881, and Signed Delivery Challan DC-4412. Delivery proof gap for INV-102 noted for transporter duplicate retrieval.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const findings = analysis?.findings || [];
  const isApproved = analysis?.approvalStatus === 'approved';

  const handleApproveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!analysis) return;
    setIsSubmitting(true);
    setTimeout(() => {
      onApprove({
        analysisId: analysis.id,
        reviewerName,
        reviewerDesignation,
        reviewerNotes,
      });
      setIsSubmitting(false);
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              Human-in-the-Loop Review & Statutory Approval Gate
            </h2>
            {isApproved ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Case Formally Approved & Sealed
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Awaiting Authorized Reviewer Sign-off
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Inspect extracted findings, corroborate evidence references, resolve or annotate discrepancies, and formally authorize case report export.
          </p>
        </div>

        {isApproved && (
          <button
            onClick={onOpenReportModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Approved PDF Reports</span>
          </button>
        )}
      </div>

      {/* Findings Review List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Findings & Discrepancies Requiring Review</h3>
          <span className="text-xs text-slate-500">{findings.length} findings logged</span>
        </div>

        <div className="divide-y divide-slate-100">
          {findings.map((f) => (
            <div key={f.id} className="p-4 hover:bg-slate-50/60 transition space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {f.severity === 'critical' ? (
                      <AlertOctagon className="w-5 h-5 text-rose-600" />
                    ) : f.severity === 'warning' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-slate-900">{f.code}</span>
                      <span
                        className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase ${
                          f.severity === 'critical'
                            ? 'bg-rose-100 text-rose-800'
                            : f.severity === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {f.severity}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">Agent: {f.agentName}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{f.message}</p>
                    {f.reviewerNotes && (
                      <p className="text-xs text-indigo-700 font-medium mt-1 bg-indigo-50 p-2 rounded border border-indigo-100">
                        <strong>Reviewer Note:</strong> {f.reviewerNotes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {f.status === 'resolved' || f.status === 'verified' ? (
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Resolved
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        onUpdateFinding(f.id, {
                          status: 'resolved',
                          reviewerNotes: 'Verified and approved by authorized reviewer.',
                        })
                      }
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-slate-700 transition cursor-pointer"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Official Sign-off and Seal Form */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base text-white">Authorized Reviewer Formal Sign-Off</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">LangGraph Checkpoint Resolution</span>
        </div>

        <form onSubmit={handleApproveSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Reviewer Name (Authorized Person):</label>
              <input
                type="text"
                required
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Designation / Role:</label>
              <input
                type="text"
                required
                value={reviewerDesignation}
                onChange={(e) => setReviewerDesignation(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-slate-300 font-semibold mb-1">
              Reviewer Audit Notes (Recorded into Case Provenance):
            </label>
            <textarea
              rows={3}
              required
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white leading-relaxed focus:ring-1 focus:ring-indigo-500"
              placeholder="State any verified documents, delivery exceptions, or legal notices..."
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800">
            <div className="text-xs text-slate-400 max-w-lg leading-relaxed">
              By authorizing, you confirm that all invoice figures and Section 15 & 16 interest computations have been inspected and match uploaded case evidence.
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-2 cursor-pointer ${
                isApproved
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/20'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isApproved ? 'Update Reviewer Seal' : 'Approve Case & Seal Final Audit Report'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
