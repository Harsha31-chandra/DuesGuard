/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  UploadCloud,
  FileText,
  FileCheck,
  CheckCircle,
  Eye,
  Search,
  Tag,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import type { CaseDocument, DocumentType } from '../types/index.ts';

interface DocumentsViewProps {
  documents: CaseDocument[];
  onUploadDocument: (file: {
    filename: string;
    documentType: DocumentType;
    mimeType: string;
    fileSizeBytes: number;
    contentSnippet: string;
  }) => void;
  onPreviewDocument: (doc: CaseDocument) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  onUploadDocument,
  onPreviewDocument,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType>('invoice');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSimulatedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setTimeout(() => {
      onUploadDocument({
        filename: file.name,
        documentType: selectedType,
        mimeType: file.type || 'application/pdf',
        fileSizeBytes: file.size,
        contentSnippet: `Uploaded document: ${file.name}. Processed with Gemini Multimodal Document Parser with page-level provenance.`,
      });
      setIsUploading(false);
      e.target.value = '';
    }, 600);
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesFilter = filterType === 'all' || doc.documentType === filterType;
    const matchesSearch =
      doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.contentSnippet && doc.contentSnippet.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Upload Section */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-indigo-600" />
              Multimodal Document Ingestion & Vision Parsing
            </h2>
            <p className="text-xs text-slate-500">
              Extracts invoices, purchase orders, delivery challans, and proof-of-delivery documents with page-level provenance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Document Type:</span>
            <select
              aria-label="Upload document classification"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as DocumentType)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="invoice">Tax Invoice</option>
              <option value="purchase_order">Purchase Order (PO)</option>
              <option value="proof_of_delivery">Signed Proof of Delivery (POD)</option>
              <option value="delivery_challan">Delivery Challan / Lorry Receipt</option>
              <option value="udyam_certificate">Udyam Registration Certificate</option>
              <option value="payment_receipt">Bank Payment Receipt / Advice</option>
              <option value="buyer_correspondence">Buyer Email / Objection</option>
              <option value="other_evidence">Other Corroborating Record</option>
            </select>
          </div>
        </div>

        {/* Drag & Drop Upload Zone */}
        <label
          htmlFor="doc-file-input"
          className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/60 hover:bg-indigo-50/30 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition group"
        >
          <div className="w-12 h-12 rounded-full bg-indigo-100 group-hover:bg-indigo-200 text-indigo-600 flex items-center justify-center mb-3 transition">
            <UploadCloud className="w-6 h-6" />
          </div>
          <span className="text-sm font-semibold text-slate-800">
            {isUploading ? 'Parsing Document with Gemini Vision...' : 'Click to Upload or Drag & Drop Documents'}
          </span>
          <p className="text-xs text-slate-500 mt-1">
            Supported formats: PDF, TIFF, PNG, JPEG (Up to 15MB). Automatically tags page-level provenance.
          </p>
          <input
            id="doc-file-input"
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.tiff"
            onChange={handleSimulatedUpload}
            disabled={isUploading}
          />
        </label>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {['all', 'invoice', 'purchase_order', 'proof_of_delivery', 'udyam_certificate'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                filterType === type
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search documents or extracted snippets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-64 shadow-sm"
          />
        </div>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => {
          const isInvoice = doc.documentType === 'invoice';
          const isPod = doc.documentType === 'proof_of_delivery';
          const isPo = doc.documentType === 'purchase_order';
          const isUdyam = doc.documentType === 'udyam_certificate';

          return (
            <div
              key={doc.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between hover:border-indigo-300 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isInvoice
                          ? 'bg-blue-100 text-blue-700'
                          : isPod
                          ? 'bg-emerald-100 text-emerald-700'
                          : isPo
                          ? 'bg-purple-100 text-purple-700'
                          : isUdyam
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-xs truncate max-w-[170px]" title={doc.filename}>
                        {doc.filename}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {(doc.fileSizeBytes / 1024).toFixed(1)} KB • {doc.pageCount} Page(s)
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isInvoice
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : isPod
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isPo
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : isUdyam
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {doc.documentType.replace('_', ' ')}
                  </span>
                </div>

                {/* Content snippet */}
                <div className="bg-slate-50 rounded-lg p-2.5 my-3 border border-slate-100 text-[11px] text-slate-600 line-clamp-3 font-mono leading-relaxed">
                  {doc.contentSnippet || 'Document content extracted.'}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Gemini Vision Parsed</span>
                </div>

                <button
                  onClick={() => onPreviewDocument(doc)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect Provenance</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
