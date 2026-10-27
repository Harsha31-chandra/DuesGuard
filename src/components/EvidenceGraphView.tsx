/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  GitFork,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  FileText,
  Truck,
  CreditCard,
  Package,
  Layers,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import type { EvidenceLink, InvoiceRecord, PurchaseOrderRecord, DeliveryRecord } from '../types/index.ts';
import { formatINR } from '../services/finance.ts';

interface EvidenceGraphViewProps {
  evidenceLinks: EvidenceLink[];
  invoices: InvoiceRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  deliveries: DeliveryRecord[];
  onOpenFinding: (findingId: string) => void;
}

export const EvidenceGraphView: React.FC<EvidenceGraphViewProps> = ({
  evidenceLinks,
  invoices,
  purchaseOrders,
  deliveries,
}) => {
  const [selectedNode, setSelectedNode] = useState<{
    type: 'po' | 'invoice' | 'delivery' | 'payment';
    id: string;
    title: string;
    details: string;
    status: string;
    amount?: string;
  } | null>({
    type: 'invoice',
    id: 'INV-102',
    title: 'Tax Invoice INV-102 (₹30,000.00)',
    details:
      'CRITICAL EVIDENCE GAP: Delivery acknowledgement / Proof of Delivery (DC-4480) missing. Under MSMED Section 15 & 16, interest trigger requires proof of physical acceptance.',
    status: 'missing',
    amount: '3000000',
  });

  const missingLinks = evidenceLinks.filter((l) => l.verificationStatus === 'missing');
  const matchedLinks = evidenceLinks.filter((l) => l.verificationStatus === 'matched');

  return (
    <div className="space-y-6">
      {/* Overview header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <GitFork className="w-5 h-5 text-indigo-600" />
            Evidence Relationship Graph & Cross-Document Reconciliation
          </h2>
          <p className="text-xs text-slate-500">
            Traces the chain of custody: <strong>Purchase Order &rarr; Invoice &rarr; Delivery Proof &rarr; Payment Receipt</strong> to identify missing, unverified, or contradictory documents.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {matchedLinks.length} Matched Chains
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-200 font-semibold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            {missingLinks.length} Critical Evidence Gap
          </span>
        </div>
      </div>

      {/* Visual Interactive Graph Canvas */}
      <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 shadow-xl overflow-x-auto">
        <div className="min-w-[850px] relative">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-8 text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 w-fit">
            <span className="font-semibold text-slate-200">Graph Legend:</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Corroborated
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Pending Review
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Missing Record
            </span>
          </div>

          {/* 4 Column Flow Container */}
          <div className="grid grid-cols-4 gap-6 relative">
            {/* Column 1: Purchase Orders */}
            <div className="space-y-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                <Package className="w-4 h-4 text-purple-400" />
                1. Purchase Orders
              </div>

              {purchaseOrders.map((po) => (
                <div
                  key={po.id}
                  onClick={() =>
                    setSelectedNode({
                      type: 'po',
                      id: po.poNumber,
                      title: `Purchase Order ${po.poNumber}`,
                      details: `Issued by ${po.buyer} to ${po.seller} on ${po.poDate}. Reconciles against Invoices INV-101 and INV-102.`,
                      status: 'matched',
                      amount: po.poTotalPaise,
                    })
                  }
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    selectedNode?.id === po.poNumber
                      ? 'bg-purple-950/70 border-purple-500 ring-2 ring-purple-500/30'
                      : 'bg-slate-900 hover:bg-slate-850 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-purple-300">{po.poNumber}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                      Matched
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white">{formatINR(po.poTotalPaise)}</div>
                  <p className="text-[11px] text-slate-400 mt-1">Order Date: {po.poDate}</p>
                  <div className="mt-2 text-[10px] text-purple-400 flex items-center gap-1">
                    <span>Covers INV-101 & INV-102</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>

            {/* Column 2: Invoices */}
            <div className="space-y-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                <FileText className="w-4 h-4 text-blue-400" />
                2. Disputed Invoices
              </div>

              {invoices.map((inv) => {
                const isInv102 = inv.invoiceNumber === 'INV-102';
                return (
                  <div
                    key={inv.id}
                    onClick={() =>
                      setSelectedNode({
                        type: 'invoice',
                        id: inv.invoiceNumber,
                        title: `Tax Invoice ${inv.invoiceNumber}`,
                        details: isInv102
                          ? 'CRITICAL EVIDENCE GAP: Missing Proof of Delivery (DC-4480). Tribunal cannot determine acceptance date without signed delivery note.'
                          : `Corroborated with PO-2024-881 and Signed Delivery Challan ${inv.deliveryReference}. 18% GST verified.`,
                        status: isInv102 ? 'missing' : 'matched',
                        amount: inv.totalAmountPaise,
                      })
                    }
                    className={`p-4 rounded-xl border transition cursor-pointer ${
                      selectedNode?.id === inv.invoiceNumber
                        ? isInv102
                          ? 'bg-rose-950/70 border-rose-500 ring-2 ring-rose-500/30'
                          : 'bg-blue-950/70 border-blue-500 ring-2 ring-blue-500/30'
                        : isInv102
                        ? 'bg-slate-900 border-rose-800/80 hover:border-rose-600'
                        : 'bg-slate-900 hover:bg-slate-850 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-blue-300">{inv.invoiceNumber}</span>
                      {isInv102 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800 font-bold animate-pulse">
                          Gap Flagged
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                          Linked
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white">{formatINR(inv.totalAmountPaise)}</div>
                    <p className="text-[11px] text-slate-400 mt-1">Date: {inv.invoiceDate}</p>

                    {isInv102 ? (
                      <div className="mt-2 text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3" />
                        <span>POD Missing (DC-4480)</span>
                      </div>
                    ) : (
                      <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>POD Confirmed ({inv.deliveryReference})</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Column 3: Delivery Records & PODs */}
            <div className="space-y-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                <Truck className="w-4 h-4 text-emerald-400" />
                3. Delivery Proof (POD)
              </div>

              {/* POD for INV-101 */}
              <div
                onClick={() =>
                  setSelectedNode({
                    type: 'delivery',
                    id: 'DC-4412',
                    title: 'Delivery Challan & Signed POD DC-4412',
                    details:
                      'LR No: VRL-BLR-8921. Physically accepted by MegaCorp Pune Project Site Engineer on 18-Jan-2024 with site rubber stamp and signature. Section 15 acceptance established.',
                    status: 'matched',
                  })
                }
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  selectedNode?.id === 'DC-4412'
                    ? 'bg-emerald-950/70 border-emerald-500 ring-2 ring-emerald-500/30'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-emerald-300">DC-4412 (LR Signed)</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                    Verified
                  </span>
                </div>
                <p className="text-xs text-slate-300">Delivered: 18-Jan-2024</p>
                <p className="text-[11px] text-slate-400 mt-1">Stamp: Pune Site In-Charge</p>
                <div className="mt-2 text-[10px] text-emerald-400 font-semibold">Links to: INV-101</div>
              </div>

              {/* DELIBERATE GAP for INV-102 */}
              <div
                onClick={() =>
                  setSelectedNode({
                    type: 'delivery',
                    id: 'MISSING-DC-4480',
                    title: 'MISSING POD: Delivery Challan DC-4480',
                    details:
                      'EVIDENCE GAP: Tax Invoice INV-102 references DC-4480, but neither a signed challan nor transporter consignment note (LR) exists in case files. Required by MSME Samadhaan.',
                    status: 'missing',
                  })
                }
                className="p-4 rounded-xl border-2 border-dashed border-rose-500/80 bg-rose-950/30 hover:bg-rose-950/50 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-rose-300 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-rose-400" />
                    Missing POD (DC-4480)
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-900 text-rose-200 font-extrabold uppercase">
                    GAP
                  </span>
                </div>
                <p className="text-xs text-rose-200 font-medium">No signed proof for INV-102</p>
                <p className="text-[11px] text-rose-400 mt-1">Action: Upload Lorry Receipt duplicate</p>
              </div>

              {/* POD for INV-103 */}
              <div
                onClick={() =>
                  setSelectedNode({
                    type: 'delivery',
                    id: 'DC-4520',
                    title: 'Delivery Challan DC-4520',
                    details: 'Delivered 05-Apr-2024. Awaiting formal customer inspection sign-off.',
                    status: 'unverified',
                  })
                }
                className="p-4 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-slate-300">DC-4520</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-medium">
                    Unverified
                  </span>
                </div>
                <p className="text-xs text-slate-400">Delivered: 05-Apr-2024</p>
              </div>
            </div>

            {/* Column 4: Payments & Allocations */}
            <div className="space-y-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                4. Payment Allocations
              </div>

              <div
                onClick={() =>
                  setSelectedNode({
                    type: 'payment',
                    id: 'PAY-STATUS',
                    title: 'Payment Status: ₹0.00 Received',
                    details:
                      'No partial payments or bank remittances recorded for INV-101 (₹50k), INV-102 (₹30k), or INV-103 (₹20k). 100% principal remains outstanding.',
                    status: 'missing',
                    amount: '0',
                  })
                }
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-slate-200">Payment Allocations</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800 font-semibold">
                    0 Payments
                  </span>
                </div>
                <div className="text-xs font-bold text-rose-400">₹0.00 Remitted</div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Total Outstanding Principal: <strong>₹1,00,000.00</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Node Inspector Drawer */}
      {selectedNode && (
        <div
          className={`rounded-xl p-5 border text-xs shadow-md transition ${
            selectedNode.status === 'missing'
              ? 'bg-rose-50/70 border-rose-200 text-rose-950'
              : selectedNode.status === 'matched'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm">{selectedNode.title}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    selectedNode.status === 'missing'
                      ? 'bg-rose-200 text-rose-900'
                      : selectedNode.status === 'matched'
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {selectedNode.status}
                </span>
              </div>
              <p className="text-xs leading-relaxed max-w-3xl">{selectedNode.details}</p>
            </div>

            {selectedNode.amount && (
              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Value</span>
                <div className="text-base font-extrabold">{formatINR(selectedNode.amount)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
