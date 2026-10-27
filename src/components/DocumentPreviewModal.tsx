/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, FileText, CheckCircle2, Eye, Shield, Tag, Sparkles } from 'lucide-react';
import type { CaseDocument, InvoiceRecord } from '../types/index.ts';

interface DocumentPreviewModalProps {
  document: CaseDocument | null;
  invoice?: InvoiceRecord;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  document,
  invoice,
  onClose,
}) => {
  if (!document) return null;

  const provenance = invoice?.provenance || {};
  const provKeys = Object.keys(provenance);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">{document.filename}</h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {document.documentType.toUpperCase()} • {(document.fileSizeBytes / 1024).toFixed(1)} KB • {document.pageCount} Page
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Simulated Document Viewer Pane */}
          <div className="border border-slate-300 rounded-xl bg-slate-50 p-4 font-mono text-[11px] text-slate-800 leading-relaxed space-y-2 shadow-inner">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <span>Simulated Document View (Page 1)</span>
              <span>Gemini 3.8 Flash Vision Parse</span>
            </div>
            <p className="whitespace-pre-line text-slate-700">
              {document.contentSnippet || 'Extracted document content.'}
            </p>
          </div>

          {/* Page-Level Provenance Table */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Page-Level Provenance & OCR Attribution
            </h4>

            {provKeys.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2 px-3">Field</th>
                      <th className="py-2 px-3">Page</th>
                      <th className="py-2 px-3">Extracted Value</th>
                      <th className="py-2 px-3">Confidence</th>
                      <th className="py-2 px-3">Parser Model</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {provKeys.map((key) => {
                      const p = provenance[key];
                      return (
                        <tr key={key}>
                          <td className="py-2 px-3 font-semibold text-slate-900 capitalize">
                            {p.fieldName || key}
                          </td>
                          <td className="py-2 px-3 font-mono">Page {p.pageNumber}</td>
                          <td className="py-2 px-3 font-bold text-indigo-700">{p.extractedValue}</td>
                          <td className="py-2 px-3 text-emerald-600 font-semibold">
                            {(p.confidence * 100).toFixed(0)}%
                          </td>
                          <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{p.modelId}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 text-[11px]">
                Extracted metadata logged under document ID {document.id}.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Close Provenance Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
