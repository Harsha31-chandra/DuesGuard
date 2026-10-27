/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, PlusCircle, Building2, Scale } from 'lucide-react';
import type { CaseRecord } from '../types/index.ts';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCase: (data: Partial<CaseRecord>) => void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({
  isOpen,
  onClose,
  onCreateCase,
}) => {
  const [businessName, setBusinessName] = useState('Sri Lakshmi Precision Components');
  const [sellerUdyamNumber, setSellerUdyamNumber] = useState('UDYAM-TN-02-0089124');
  const [sellerUdyamRegDate, setSellerUdyamRegDate] = useState('2022-11-15');
  const [sellerClassification, setSellerClassification] = useState<'Micro' | 'Small' | 'Medium'>('Micro');
  const [sellerActivity, setSellerActivity] = useState<'Manufacturing' | 'Services' | 'Trading'>('Manufacturing');
  const [sellerGstin, setSellerGstin] = useState('33AABCS1429B1ZB');
  const [buyerName, setBuyerName] = useState('Titan Engineering Solutions Ltd');
  const [buyerGstin, setBuyerGstin] = useState('29AABCT8812K1Z4');
  const [contractualPaymentDays, setContractualPaymentDays] = useState(30);
  const [disputeNotes, setDisputeNotes] = useState(
    'Delay of over 90 days in settlement of tooling invoices despite delivery challan receipt.'
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateCase({
      businessName,
      sellerName: businessName,
      sellerUdyamNumber,
      sellerUdyamRegDate,
      sellerClassification,
      sellerActivity,
      sellerGstin,
      buyerName,
      buyerGstin,
      contractualPaymentDays,
      disputeNotes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base text-white">Create New MSMED Delayed Payment Case</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider border-b border-slate-100 pb-1">
              1. Supplier MSME Details (Applicant)
            </h4>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Supplier Business Name:</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Udyam Registration Number:</label>
                <input
                  type="text"
                  required
                  placeholder="UDYAM-XX-00-0000000"
                  value={sellerUdyamNumber}
                  onChange={(e) => setSellerUdyamNumber(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-800 uppercase focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Udyam Registration Date:</label>
                <input
                  type="date"
                  required
                  value={sellerUdyamRegDate}
                  onChange={(e) => setSellerUdyamRegDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Classification:</label>
                <select
                  value={sellerClassification}
                  onChange={(e) => setSellerClassification(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Micro">Micro Enterprise</option>
                  <option value="Small">Small Enterprise</option>
                  <option value="Medium">Medium Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Major Activity:</label>
                <select
                  value={sellerActivity}
                  onChange={(e) => setSellerActivity(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Services">Services</option>
                  <option value="Trading">Trading</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Supplier GSTIN:</label>
                <input
                  type="text"
                  value={sellerGstin}
                  onChange={(e) => setSellerGstin(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono uppercase text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider border-b border-slate-100 pb-1">
              2. Buyer Entity Details (Respondent)
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Buyer Legal Name:</label>
                <input
                  type="text"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Buyer GSTIN:</label>
                <input
                  type="text"
                  value={buyerGstin}
                  onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono uppercase text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Agreed Credit Days (Max 45 under § 15):
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  required
                  value={contractualPaymentDays}
                  onChange={(e) => setContractualPaymentDays(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Dispute Brief / Notes:</label>
              <textarea
                rows={2}
                value={disputeNotes}
                onChange={(e) => setDisputeNotes(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-sm transition cursor-pointer"
            >
              Create Case & Proceed to Uploads
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
