/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Download,
  Copy,
  Share2,
  Check,
  X,
  Clock,
  ShieldAlert,
  ExternalLink,
  RotateCcw,
  Ban,
} from 'lucide-react';
import type { DemoInvoicePaymentView } from '../types/index.ts';
import { formatINR } from '../services/finance.ts';

interface QrPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  invoiceId: string | null;
  organizationId?: string;
  branchId?: string;
  userId?: string;
  onOpenBuyerDemoPage: (relativePath: string) => void;
  onDemoDataChanged?: () => void;
}

interface GeneratedQrResponse {
  tokenId: string;
  paymentUrl: string;
  relativePath: string;
  qrDataUrl: string;
  qrSvg: string;
  expiresAt: string;
  invoiceSummary: DemoInvoicePaymentView;
}

export const QrPaymentModal: React.FC<QrPaymentModalProps> = ({
  isOpen,
  onClose,
  caseId,
  invoiceId,
  organizationId,
  branchId,
  userId,
  onOpenBuyerDemoPage,
  onDemoDataChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrResult, setQrResult] = useState<GeneratedQrResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharedMsg, setSharedMsg] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isRevoked, setIsRevoked] = useState(false);

  const generateQr = async () => {
    if (!invoiceId || !caseId) return;
    setLoading(true);
    setError(null);
    setActionStatus(null);
    setIsRevoked(false);

    try {
      const baseUrl = window.location.origin;
      const res = await fetch('/api/demo-qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          invoiceId,
          organizationId,
          branchId,
          userId,
          baseUrl,
          expiresInMinutes: 60,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate QR payment token.');
        setQrResult(null);
      } else {
        setQrResult(data);
      }
    } catch (err: any) {
      setError(err.message || 'Network error while generating QR code.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && invoiceId) {
      generateQr();
    } else {
      setQrResult(null);
      setError(null);
      setActionStatus(null);
    }
  }, [isOpen, invoiceId, caseId]);

  if (!isOpen || !invoiceId) return null;

  const handleCopyLink = async () => {
    if (!qrResult) return;
    try {
      await navigator.clipboard.writeText(qrResult.paymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleDownloadQr = () => {
    if (!qrResult) return;
    const link = document.createElement('a');
    link.href = qrResult.qrDataUrl;
    link.download = `DuesGuard-Demo-QR-${qrResult.invoiceSummary.invoiceNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (!qrResult) return;
    const shareData = {
      title: `DuesGuard AI Demo Payment — ${qrResult.invoiceSummary.invoiceNumber}`,
      text: `Demonstration payment link for Invoice ${qrResult.invoiceSummary.invoiceNumber} (${formatINR(qrResult.invoiceSummary.currentOutstandingPaise)}). DEMO MODE ONLY.`,
      url: qrResult.paymentUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setSharedMsg('Shared successfully');
      } catch {
        // User cancelled share sheet
      }
    } else {
      await handleCopyLink();
      setSharedMsg('Payment link copied for sharing');
    }
    setTimeout(() => setSharedMsg(null), 2500);
  };

  const handleRevokeToken = async () => {
    if (!qrResult) return;
    try {
      const res = await fetch('/api/demo-qr/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: qrResult.tokenId,
          organizationId,
          userId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsRevoked(true);
        setActionStatus('Token revoked. Scanning this QR code will now return HTTP 410 Revoked.');
      } else {
        setActionStatus(data.error || 'Could not revoke token.');
      }
    } catch (err: any) {
      setActionStatus(err.message || 'Failed to revoke token.');
    }
  };

  const handleResetDemoData = async () => {
    try {
      const res = await fetch('/api/demo-qr/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          invoiceId,
          organizationId,
          userId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionStatus(data.message || 'Demo data reset.');
        await generateQr();
        onDemoDataChanged?.();
      } else {
        setActionStatus(data.error || 'Could not reset demo data.');
      }
    } catch (err: any) {
      setActionStatus(err.message || 'Failed to reset demo data.');
    }
  };

  const summary = qrResult?.invoiceSummary;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-payment-modal-title"
      data-testid="qr-payment-modal"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="qr-payment-modal-title"
                className="text-base font-bold tracking-tight text-zinc-900 dark:text-white"
              >
                Invoice QR Payment Request
              </h2>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                DEMO MODE — NO REAL PAYMENT PROCESSED
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR Modal"
            data-testid="close-qr-modal-btn"
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[84vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-500">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-medium">
                Generating 256-bit cryptographic token &amp; computing deterministic balance...
              </p>
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Authorization or Validation Error</span>
              </div>
              <p>{error}</p>
            </div>
          ) : qrResult && summary ? (
            <>
              {/* Invoice & Payable Amount Summary */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-zinc-200/70 dark:border-white/10 pb-3">
                  <div>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                      Invoice Reference
                    </span>
                    <span
                      data-testid="qr-modal-invoice-number"
                      className="text-base font-extrabold font-mono text-zinc-900 dark:text-white whitespace-nowrap"
                    >
                      {summary.invoiceNumber}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                      Payable Outstanding Balance
                    </span>
                    <span
                      data-testid="qr-modal-payable-amount"
                      className="text-lg font-extrabold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 whitespace-nowrap"
                    >
                      {formatINR(summary.currentOutstandingPaise)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-400 dark:text-zinc-500 block">Seller (MSME)</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
                      {summary.sellerName}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 dark:text-zinc-500 block">Buyer Entity</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
                      {summary.buyerName}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 dark:text-zinc-500 block">
                      Original Invoice Amount
                    </span>
                    <span className="font-mono tabular-nums font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                      {formatINR(summary.originalAmountPaise)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 dark:text-zinc-500 block">
                      Previously Paid (Prod + Demo)
                    </span>
                    <span className="font-mono tabular-nums font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatINR(summary.totalAlreadyPaidPaise)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scannable QR Code Display */}
              <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs">
                <div className="relative">
                  <img
                    src={qrResult.qrDataUrl}
                    alt={`QR Payment Code for Invoice ${summary.invoiceNumber}`}
                    referrerPolicy="no-referrer"
                    data-testid="qr-code-image"
                    className={`w-48 h-48 object-contain ${isRevoked ? 'opacity-25 grayscale' : ''}`}
                  />
                  {isRevoked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs shadow-md">
                        TOKEN REVOKED
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 text-center space-y-1">
                  <p className="text-xs font-medium text-zinc-700">
                    Scan with any mobile camera to open the DuesGuard AI Demo Payment Page
                  </p>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 font-mono">
                    <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="whitespace-nowrap">
                      Expires: {new Date(qrResult.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · SHA-256 Hashed Token
                    </span>
                  </div>
                </div>
              </div>

              {/* Primary Action Buttons: Download QR, Copy Link, Share */}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  data-testid="download-qr-btn"
                  className="px-3 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Download QR</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  data-testid="copy-qr-link-btn"
                  className="px-3 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Copied Link</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 shrink-0" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  data-testid="share-qr-link-btn"
                  className="px-3 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Share</span>
                </button>
              </div>

              {sharedMsg && (
                <p className="text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {sharedMsg}
                </p>
              )}

              {/* Direct Reviewer Link to Open Buyer Scanning Experience */}
              <div className="pt-2.5 border-t border-zinc-200/70 dark:border-white/10 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                  <span className="truncate">{qrResult.paymentUrl}</span>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenBuyerDemoPage(qrResult.relativePath)}
                  data-testid="open-buyer-scan-page-btn"
                  className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>Simulate Buyer QR Scan (/demo-pay/...)</span>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleRevokeToken}
                    disabled={isRevoked}
                    data-testid="revoke-qr-token-btn"
                    className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    <Ban className="w-3.5 h-3.5 shrink-0" />
                    <span>Revoke Token</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetDemoData}
                    data-testid="modal-reset-demo-data-btn"
                    title="Reset simulated demo payments for this invoice"
                    className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/15 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>Reset Demo Data</span>
                  </button>
                </div>

                {actionStatus && (
                  <p
                    data-testid="qr-modal-action-status"
                    className="text-xs font-medium text-amber-600 dark:text-amber-400 pt-1"
                  >
                    {actionStatus}
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
