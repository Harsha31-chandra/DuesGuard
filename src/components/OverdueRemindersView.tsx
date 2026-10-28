/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Multi-Channel Buyer Reminder, Mail & Statutory Outreach Hub
 * Located in: Billing, ERP & Receivables -> Overdue Reminders
 *
 * Capabilities:
 *  - 5-Stage Idempotent Overdue Escalation Scheduler (-3d, Due Today, +1d, +7d, +15d+ MSMED §§ 15-16)
 *  - Multi-Channel Composer: Email (Resend/SMTP + Direct mailto: client), WhatsApp Business, SMS, & Broadcast
 *  - Embedded DuesGuard AI Buyer Settlement & Verification Portal link (/demo-pay/...) for buyer exposure
 *  - 1-Click "Raise Reminder" cards per buyer/invoice + Bulk "Broadcast to All Unpaid Buyers"
 *  - Durable Multi-Channel Delivery Audit Logs with HTML & Plain-Text Notice inspection
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  Zap,
  Send,
  Eye,
  CheckCircle2,
  Clock,
  X,
  AlertTriangle,
  MessageSquare,
  Phone,
  Copy,
  ExternalLink,
  Megaphone,
  QrCode,
  Sparkles,
  FileDown,
  Paperclip,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  CaseRecord,
  CustomerRecord,
  EmailReminderLogRecord,
  EmailReminderRuleType,
  InvoiceRecord,
  ReminderDeliveryChannel,
} from '../types/index.ts';
import { formatINR } from '../services/finance.ts';
import {
  buildBuyerOutreachMessageText,
  buildStatutoryReminderEmailHtml,
  calculateDaysDifference,
  computeReminderFinancialSummary,
} from '../services/erpBillingService.ts';
import { generateBuyerReminderSoftCopyPdf } from '../services/pdfGenerator.ts';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  sendGmailReminderWithSoftCopy,
} from '../services/gmailService.ts';

interface OverdueRemindersViewProps {
  caseRecord: CaseRecord;
  invoices: InvoiceRecord[];
  customers?: CustomerRecord[];
  reminderLogs: EmailReminderLogRecord[];
  asOfDate: string;
  preselectedInvoiceId?: string | null;
  preselectedCustomerId?: string | null;
  onClearPreselection?: () => void;
  onTriggerSchedulerCycle: () => Promise<{
    dispatchedCount: number;
    skippedDuplicateCount: number;
  }>;
  onSendManualNotice: (params: {
    invoiceId: string;
    recipientEmail: string;
    recipientPhone?: string;
    channel?: ReminderDeliveryChannel;
    reminderType?: EmailReminderRuleType;
    customSubject?: string;
    customNote?: string;
    paymentPortalUrl?: string;
    providerMessageId?: string;
    softCopyBase64Pdf?: string;
    softCopyFilename?: string;
  }) => Promise<void>;
  onBroadcastAllOverdue?: (params: {
    channel: ReminderDeliveryChannel;
    customNote?: string;
    baseUrl?: string;
  }) => Promise<{ dispatchedCount: number }>;
  onGenerateQrCode?: (invoiceId: string) => void;
}

const REMINDER_RULE_LABELS: Record<string, string> = {
  upcoming_3d: 'Stage 1 (T-3d) · Upcoming Courtesy Reminder',
  due_today: 'Stage 2 (T-0) · Payment Due Today Notice',
  overdue_1d: 'Stage 3 (T+1d) · Initial Overdue & UTR Request',
  overdue_7d: 'Stage 4 (T+7d) · Urgent AR Follow-Up (§15 Cap)',
  overdue_15d_escalation: 'Stage 5 (T+15d+) · Formal MSMED §§ 15–16 Demand',
  manual_notice: 'Custom Buyer Payment & Portal Notice',
};

const CHANNEL_BADGES: Record<
  ReminderDeliveryChannel,
  { label: string; className: string }
> = {
  email: {
    label: 'EMAIL + SOFT COPY',
    className:
      'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
  },
  whatsapp: {
    label: 'WHATSAPP',
    className:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  },
  sms: {
    label: 'SMS ALERT',
    className:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  },
  multi_channel: {
    label: 'ALL CHANNELS + SOFT COPY',
    className:
      'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
  },
};

const DEFAULT_USER_TEST_EMAIL = 'chandraharshavardhan1@gmail.com';

export const OverdueRemindersView: React.FC<OverdueRemindersViewProps> = ({
  caseRecord,
  invoices,
  customers = [],
  reminderLogs,
  asOfDate,
  preselectedInvoiceId,
  preselectedCustomerId,
  onClearPreselection,
  onTriggerSchedulerCycle,
  onSendManualNotice,
  onBroadcastAllOverdue,
  onGenerateQrCode,
}) => {
  const [isRunningCycle, setIsRunningCycle] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [cycleBanner, setCycleBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [previewLog, setPreviewLog] = useState<EmailReminderLogRecord | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);

  // Google Workspace Gmail OAuth state (in-memory token managed by gmailService.ts)
  const [needsAuth, setNeedsAuth] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);

  // Confirmation modal before sending email on behalf of user (Mandatory per workspace-integration)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [lastGmailSentId, setLastGmailSentId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setNeedsAuth(false);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoggingInGoogle(true);
    setErrorBanner(null);
    setModalError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setNeedsAuth(false);
        setCycleBanner(
          `Connected Google Workspace Gmail (${result.user.email || 'Authorized'}). Ready to send the email with RFC 2822 From, To, Date, and Message-ID headers plus both attached soft copies (${softCopyPdfFilename} and ${softCopyHtmlFilename}) straight to your Gmail Inbox and Sent Mail.`
        );
        setIsConfirmModalOpen(true);
      }
    } catch (err: any) {
      setErrorBanner(
        err?.message || 'Google Sign-In was cancelled or blocked by popup settings.'
      );
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setGoogleToken(null);
    setNeedsAuth(true);
  };

  const unpaidInvoices = useMemo(
    () =>
      invoices.filter(
        (i) => i.status !== 'paid' && Number(i.outstandingAmountPaise) > 0
      ),
    [invoices]
  );

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    preselectedInvoiceId || unpaidInvoices[0]?.id || invoices[0]?.id || ''
  );
  const [selectedChannel, setSelectedChannel] =
    useState<ReminderDeliveryChannel>('multi_channel');
  const [selectedReminderType, setSelectedReminderType] =
    useState<EmailReminderRuleType>('overdue_15d_escalation');
  const [recipientEmail, setRecipientEmail] = useState<string>(
    unpaidInvoices[0]?.buyerEmail || DEFAULT_USER_TEST_EMAIL
  );
  const [recipientPhone, setRecipientPhone] = useState<string>('+91 22 6789 4410');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>(
    'Please find attached the official Buyer Reminder Bill (PDF Soft Copy) and Buyer Notice & Portal Exposure Preview. Kindly review the pending balance and statutory due date schedule and settle online via the DuesGuard AI Buyer Portal link.'
  );
  const [livePreviewMode, setLivePreviewMode] = useState<'text' | 'html'>('text');
  const [isSendingNotice, setIsSendingNotice] = useState(false);

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === selectedInvoiceId) || invoices[0],
    [invoices, selectedInvoiceId]
  );

  // Sync recipient details & recommended stage whenever selectedInvoice changes
  useEffect(() => {
    if (!selectedInvoice) return;
    const matchedCustomer =
      customers.find((c) => c.id === selectedInvoice.customerId) ||
      customers.find(
        (c) => c.name.toLowerCase() === (selectedInvoice.buyer || '').toLowerCase()
      ) ||
      customers[0];

    setRecipientEmail(
      selectedInvoice.buyerEmail ||
        matchedCustomer?.email ||
        DEFAULT_USER_TEST_EMAIL
    );
    setRecipientPhone(matchedCustomer?.phone || '+91 22 6789 4410');

    const dueDate = selectedInvoice.contractualDueDate || selectedInvoice.invoiceDate;
    const diff = calculateDaysDifference(dueDate, asOfDate);
    const daysOver = Math.max(0, diff);

    if (daysOver >= 15) {
      setSelectedReminderType('overdue_15d_escalation');
      setCustomSubject(
        `Buyer Reminder Bill & MSMED Notice: Invoice ${selectedInvoice.invoiceNumber} (Due: ${dueDate} · ${daysOver} Days Overdue)`
      );
    } else if (daysOver >= 7) {
      setSelectedReminderType('overdue_7d');
      setCustomSubject(
        `Urgent Buyer Reminder Bill: Invoice ${selectedInvoice.invoiceNumber} (Due: ${dueDate} · ${daysOver} Days Overdue)`
      );
    } else if (daysOver >= 1) {
      setSelectedReminderType('overdue_1d');
      setCustomSubject(
        `Overdue Payment Reminder Bill: Invoice ${selectedInvoice.invoiceNumber} — ${caseRecord.sellerName}`
      );
    } else if (diff === 0) {
      setSelectedReminderType('due_today');
      setCustomSubject(
        `Payment Due Today (${dueDate}): Invoice ${selectedInvoice.invoiceNumber} — ${caseRecord.sellerName}`
      );
    } else {
      setSelectedReminderType('upcoming_3d');
      setCustomSubject(
        `Upcoming Payment Courtesy Bill: Invoice ${selectedInvoice.invoiceNumber} (Due: ${dueDate})`
      );
    }
  }, [selectedInvoice, customers, asOfDate, caseRecord.sellerName]);

  // Handle cross-view preselection from Customers or Invoices tabs
  useEffect(() => {
    if (preselectedInvoiceId) {
      setSelectedInvoiceId(preselectedInvoiceId);
      onClearPreselection?.();
    } else if (preselectedCustomerId) {
      const cust = customers.find((c) => c.id === preselectedCustomerId);
      if (cust) {
        const custInv = invoices.find(
          (i) =>
            i.customerId === cust.id ||
            (i.buyer || '').toLowerCase() === cust.name.toLowerCase()
        );
        if (custInv) {
          setSelectedInvoiceId(custInv.id);
        }
        setRecipientEmail(cust.email);
        setRecipientPhone(cust.phone);
      }
      onClearPreselection?.();
    }
  }, [preselectedInvoiceId, preselectedCustomerId, customers, invoices, onClearPreselection]);

  const appOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://duesguard.ai';

  const buyerPortalUrl = selectedInvoice
    ? `${appOrigin}/demo-pay/DG-${selectedInvoice.invoiceNumber.toUpperCase()}`
    : `${appOrigin}/demo-pay/DG-INV-101`;

  const selectedDueDate = selectedInvoice
    ? selectedInvoice.contractualDueDate || selectedInvoice.invoiceDate
    : asOfDate;

  const selectedDaysOverdue = useMemo(() => {
    if (!selectedInvoice) return 0;
    const due = selectedInvoice.contractualDueDate || selectedInvoice.invoiceDate;
    return Math.max(0, calculateDaysDifference(due, asOfDate));
  }, [selectedInvoice, asOfDate]);

  const financialSummary = useMemo(() => {
    if (!selectedInvoice) {
      return {
        principalPaise: '0',
        statutoryInterestPaise: '0',
        totalPayablePaise: '0',
      };
    }
    return computeReminderFinancialSummary(
      selectedInvoice.outstandingAmountPaise,
      selectedDaysOverdue
    );
  }, [selectedInvoice, selectedDaysOverdue]);

  const liveMessageText = useMemo(() => {
    if (!selectedInvoice) return '';
    return buildBuyerOutreachMessageText({
      businessName: caseRecord.sellerName,
      sellerUdyamNumber: caseRecord.sellerUdyamNumber,
      customerName: selectedInvoice.buyer || caseRecord.buyerName,
      invoiceNumber: selectedInvoice.invoiceNumber,
      invoiceDate: selectedInvoice.invoiceDate,
      dueDate: selectedDueDate,
      balanceDuePaise: selectedInvoice.outstandingAmountPaise,
      daysOverdue: selectedDaysOverdue,
      statutoryInterestPaise: financialSummary.statutoryInterestPaise,
      customNote,
      paymentPortalUrl: buyerPortalUrl,
      reminderType: selectedReminderType,
    });
  }, [
    selectedInvoice,
    caseRecord,
    selectedDueDate,
    selectedDaysOverdue,
    financialSummary.statutoryInterestPaise,
    customNote,
    buyerPortalUrl,
    selectedReminderType,
  ]);

  const liveEmailHtml = useMemo(() => {
    if (!selectedInvoice) return '';
    return buildStatutoryReminderEmailHtml({
      businessName: caseRecord.sellerName,
      sellerUdyamNumber: caseRecord.sellerUdyamNumber,
      customerName: selectedInvoice.buyer || caseRecord.buyerName,
      invoiceNumber: selectedInvoice.invoiceNumber,
      invoiceDate: selectedInvoice.invoiceDate,
      dueDate: selectedDueDate,
      grandTotalPaise: selectedInvoice.totalAmountPaise,
      amountPaidPaise: selectedInvoice.paidAmountPaise || '0',
      balanceDuePaise: selectedInvoice.outstandingAmountPaise,
      daysOverdue: selectedDaysOverdue,
      statutoryInterestPaise: financialSummary.statutoryInterestPaise,
      totalClaimablePaise: financialSummary.totalPayablePaise,
      customNote,
      paymentPortalUrl: buyerPortalUrl,
      reminderType: selectedReminderType,
    });
  }, [
    selectedInvoice,
    caseRecord,
    selectedDueDate,
    selectedDaysOverdue,
    financialSummary,
    customNote,
    buyerPortalUrl,
    selectedReminderType,
  ]);

  const softCopyPdfFilename = selectedInvoice
    ? `Buyer_Reminder_Bill_${selectedInvoice.invoiceNumber}.pdf`
    : 'Buyer_Reminder_Bill.pdf';

  const softCopyHtmlFilename = selectedInvoice
    ? `Buyer_Notice_Portal_Preview_${selectedInvoice.invoiceNumber}.html`
    : 'Buyer_Notice_Portal_Preview.html';

  const mailtoHref = useMemo(() => {
    const email = recipientEmail.trim();
    const subj = encodeURIComponent(
      customSubject || `Payment Reminder: ${selectedInvoice?.invoiceNumber || ''}`
    );
    const body = encodeURIComponent(liveMessageText);
    return `mailto:${email}?subject=${subj}&body=${body}`;
  }, [recipientEmail, customSubject, selectedInvoice, liveMessageText]);

  const gmailWebComposeHref = useMemo(() => {
    const email = encodeURIComponent(recipientEmail.trim());
    const subj = encodeURIComponent(
      customSubject ||
        `Buyer Reminder Bill: Invoice ${selectedInvoice?.invoiceNumber || ''} (Due: ${selectedDueDate})`
    );
    const body = encodeURIComponent(liveMessageText);
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subj}&body=${body}`;
  }, [recipientEmail, customSubject, selectedInvoice, selectedDueDate, liveMessageText]);

  const handleDownloadSoftCopyPdf = () => {
    if (!selectedInvoice) return;
    const { doc, filename } = generateBuyerReminderSoftCopyPdf({
      caseRecord,
      invoice: selectedInvoice,
      recipientEmail: recipientEmail.trim(),
      recipientPhone: recipientPhone.trim(),
      daysOverdue: selectedDaysOverdue,
      statutoryInterestPaise: financialSummary.statutoryInterestPaise,
      totalPayablePaise: financialSummary.totalPayablePaise,
      subject: customSubject || `Buyer Reminder Bill: ${selectedInvoice.invoiceNumber}`,
      customNote,
      buyerNoticeText: liveMessageText,
      paymentPortalUrl: buyerPortalUrl,
    });
    doc.save(filename);
    setCopiedFeedback(`Downloaded Soft Copy: ${filename}`);
    setTimeout(() => setCopiedFeedback(null), 3000);
  };

  const handleRunCycle = async () => {
    setIsRunningCycle(true);
    setErrorBanner(null);
    try {
      const res = await onTriggerSchedulerCycle();
      setCycleBanner(
        `5-Stage Scheduler cycle completed as of ${asOfDate}: Dispatched ${res.dispatchedCount} new reminder(s), skipped ${res.skippedDuplicateCount} idempotent duplicate(s).`
      );
    } finally {
      setIsRunningCycle(false);
    }
  };

  const handleBroadcastAll = async () => {
    if (!onBroadcastAllOverdue) return;
    setIsBroadcasting(true);
    setErrorBanner(null);
    try {
      const res = await onBroadcastAllOverdue({
        channel: selectedChannel,
        customNote,
        baseUrl: appOrigin,
      });
      setCycleBanner(
        `Broadcast completed: Raised and dispatched ${res.dispatchedCount} multi-channel buyer reminder(s) with embedded DuesGuard AI Buyer Settlement links.`
      );
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Step 1: Open the mandatory confirmation dialog before sending the email
  const handleRequestDispatchConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !recipientEmail.trim()) return;
    setErrorBanner(null);
    setModalError(null);
    setIsConfirmModalOpen(true);
  };

  // Step 2A: Send REAL Email with PDF + HTML Soft Copies via Gmail API (triggers Google OAuth popup if not signed in)
  const handleSendRealEmailViaGmail = async () => {
    if (!selectedInvoice || !recipientEmail.trim()) return;
    setIsSendingNotice(true);
    setErrorBanner(null);
    setModalError(null);

    try {
      // 1. If not signed in with Google yet, trigger Google OAuth popup FIRST on user click
      let activeToken = googleToken;
      let activeSenderEmail = googleUser?.email || undefined;
      if (needsAuth || !activeToken) {
        const signInRes = await googleSignIn();
        if (!signInRes?.accessToken) {
          throw new Error(
            'Google Sign-In did not return a Gmail access token. Please allow the Google popup and check "Send email on your behalf".'
          );
        }
        activeToken = signInRes.accessToken;
        activeSenderEmail = signInRes.user.email || undefined;
        setGoogleUser(signInRes.user);
        setGoogleToken(signInRes.accessToken);
        setNeedsAuth(false);
      }

      // 2. Generate the official Soft-Copy PDF (Pending Bill + Due Date + Buyer Notice & Portal Exposure Preview)
      const { base64Pdf, filename: pdfFilename } = generateBuyerReminderSoftCopyPdf({
        caseRecord,
        invoice: selectedInvoice,
        recipientEmail: recipientEmail.trim(),
        recipientPhone: recipientPhone.trim(),
        daysOverdue: selectedDaysOverdue,
        statutoryInterestPaise: financialSummary.statutoryInterestPaise,
        totalPayablePaise: financialSummary.totalPayablePaise,
        subject:
          customSubject.trim() ||
          `Buyer Reminder Bill: Invoice ${selectedInvoice.invoiceNumber}`,
        customNote: customNote.trim(),
        buyerNoticeText: liveMessageText,
        paymentPortalUrl: buyerPortalUrl,
      });

      // 3. Dispatch real multipart/mixed email with PDF + HTML soft copies via Gmail REST API
      const gmailRes = await sendGmailReminderWithSoftCopy({
        accessTokenOverride: activeToken,
        senderEmail: activeSenderEmail,
        senderName: `${caseRecord.sellerName} (via DuesGuard AI)`,
        recipientEmail: recipientEmail.trim(),
        subject:
          customSubject.trim() ||
          `Buyer Reminder Bill: Invoice ${selectedInvoice.invoiceNumber}`,
        plainTextBody: liveMessageText,
        htmlBody: liveEmailHtml,
        pdfFilename,
        base64Pdf,
        htmlSoftCopyFilename: softCopyHtmlFilename,
        htmlSoftCopyContent: liveEmailHtml,
      });

      const gmailMessageId = `gmail_${gmailRes.id}`;
      setLastGmailSentId(gmailRes.id);

      // 4. Record in durable audit log
      await onSendManualNotice({
        invoiceId: selectedInvoice.id,
        recipientEmail: recipientEmail.trim(),
        recipientPhone: recipientPhone.trim(),
        channel: selectedChannel,
        reminderType: selectedReminderType,
        customSubject: customSubject.trim(),
        customNote: customNote.trim(),
        paymentPortalUrl: buyerPortalUrl,
        providerMessageId: gmailMessageId,
        softCopyBase64Pdf: base64Pdf,
        softCopyFilename: pdfFilename,
      });

      setIsConfirmModalOpen(false);
      setCycleBanner(
        `Sent the email with RFC 2822 From, To, Date, and Message-ID headers plus both attached soft copies (${pdfFilename} and ${softCopyHtmlFilename}) straight to your Gmail Inbox and Sent Mail (${recipientEmail.trim()} · Message ID: ${gmailRes.id}).`
      );
    } catch (err: any) {
      setModalError(
        err?.message ||
          'Could not send via Gmail API. Please click "Sign in with Google" or use "Open Pre-Filled Gmail Web + Download PDF Soft Copy" below.'
      );
    } finally {
      setIsSendingNotice(false);
    }
  };

  // Step 2B: Record in Audit Log (and server-side Resend if configured)
  const handleConfirmAndDispatchNotice = async () => {
    if (!selectedInvoice || !recipientEmail.trim()) return;
    setIsSendingNotice(true);
    setErrorBanner(null);
    setModalError(null);

    try {
      const { base64Pdf, filename: pdfFilename } = generateBuyerReminderSoftCopyPdf({
        caseRecord,
        invoice: selectedInvoice,
        recipientEmail: recipientEmail.trim(),
        recipientPhone: recipientPhone.trim(),
        daysOverdue: selectedDaysOverdue,
        statutoryInterestPaise: financialSummary.statutoryInterestPaise,
        totalPayablePaise: financialSummary.totalPayablePaise,
        subject:
          customSubject.trim() ||
          `Buyer Reminder Bill: Invoice ${selectedInvoice.invoiceNumber}`,
        customNote: customNote.trim(),
        buyerNoticeText: liveMessageText,
        paymentPortalUrl: buyerPortalUrl,
      });

      let gmailMessageId: string | undefined;
      if (!needsAuth && googleToken) {
        const gmailRes = await sendGmailReminderWithSoftCopy({
          accessTokenOverride: googleToken,
          senderEmail: googleUser?.email || undefined,
          senderName: `${caseRecord.sellerName} (via DuesGuard AI)`,
          recipientEmail: recipientEmail.trim(),
          subject:
            customSubject.trim() ||
            `Buyer Reminder Bill: Invoice ${selectedInvoice.invoiceNumber}`,
          plainTextBody: liveMessageText,
          htmlBody: liveEmailHtml,
          pdfFilename,
          base64Pdf,
          htmlSoftCopyFilename: softCopyHtmlFilename,
          htmlSoftCopyContent: liveEmailHtml,
        });
        gmailMessageId = `gmail_${gmailRes.id}`;
        setLastGmailSentId(gmailRes.id);
      }

      await onSendManualNotice({
        invoiceId: selectedInvoice.id,
        recipientEmail: recipientEmail.trim(),
        recipientPhone: recipientPhone.trim(),
        channel: selectedChannel,
        reminderType: selectedReminderType,
        customSubject: customSubject.trim(),
        customNote: customNote.trim(),
        paymentPortalUrl: buyerPortalUrl,
        providerMessageId: gmailMessageId,
        softCopyBase64Pdf: base64Pdf,
        softCopyFilename: pdfFilename,
      });

      setIsConfirmModalOpen(false);
      if (gmailMessageId) {
        setCycleBanner(
          `Sent the email with RFC 2822 From, To, Date, and Message-ID headers plus both attached soft copies (${pdfFilename} and ${softCopyHtmlFilename}) straight to your Gmail Inbox and Sent Mail (${recipientEmail.trim()} · ${gmailMessageId}).`
        );
      } else {
        setCycleBanner(
          `Logged Buyer Reminder Bill (${pdfFilename} and ${softCopyHtmlFilename}) for ${recipientEmail.trim()} in Audit Trail. Click "Sign in with Google" or "Open Gmail Inbox" to view and manage your emails.`
        );
      }
    } catch (err: any) {
      setModalError(err?.message || 'Failed to dispatch Buyer Reminder Bill.');
    } finally {
      setIsSendingNotice(false);
    }
  };

  const handleCopyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFeedback(label);
      setTimeout(() => setCopiedFeedback(null), 2500);
    } catch {
      setCopiedFeedback(label);
      setTimeout(() => setCopiedFeedback(null), 2500);
    }
  };

  return (
    <div className="space-y-6" data-testid="overdue-reminders-view">
      {/* Page Header & Bulk Outreach Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            Billing, ERP &amp; Receivables &rarr; Overdue Reminders &amp; Buyer Outreach Studio
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mt-0.5">
            Buyer Reminder Bill, Soft-Copy Mail &amp; Multi-Channel Outreach
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Send official Buyer Reminder Bills with RFC 2822 From, To, Date, and Message-ID headers plus attached PDF &amp; HTML soft copies ({softCopyPdfFilename} and {softCopyHtmlFilename}) straight to your Gmail Inbox and Sent Mail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onBroadcastAllOverdue && (
            <button
              type="button"
              onClick={handleBroadcastAll}
              disabled={isBroadcasting || unpaidInvoices.length === 0}
              data-testid="broadcast-all-overdue-btn"
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>
                {isBroadcasting
                  ? 'Broadcasting...'
                  : `Raise Reminders to All Unpaid Buyers (${unpaidInvoices.length})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRunCycle}
            disabled={isRunningCycle}
            data-testid="run-reminder-scheduler-btn"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isRunningCycle ? 'Running Cycle...' : 'Run Scheduler Cycle'}</span>
          </button>
        </div>
      </div>

      {/* Gmail Direct Delivery & Soft-Copy Connection Card */}
      <div
        data-testid="gmail-integration-bar"
        className="bg-white dark:bg-zinc-900/60 border border-indigo-500/30 dark:border-indigo-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              RFC 2822 FROM · TO · DATE · MESSAGE-ID + SOFT COPIES
            </span>
            {!needsAuth && googleUser ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Connected as {googleUser.email}</span>
              </span>
            ) : (
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Sign in with Google to immediately send the email + soft copies to your Gmail Inbox &amp; Sent Mail
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Dispatches with RFC 2822 headers (<span className="font-mono">From</span>, <span className="font-mono">To</span>, <span className="font-mono">Date</span>, <span className="font-mono">Message-ID</span>) plus both attached soft copies (<span className="font-mono text-zinc-900 dark:text-zinc-200">{softCopyPdfFilename}</span> and <span className="font-mono text-zinc-900 dark:text-zinc-200">{softCopyHtmlFilename}</span>) straight to your Gmail Inbox and Sent Mail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href="https://mail.google.com/mail/u/0/#inbox"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="open-gmail-inbox-btn"
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Gmail Inbox</span>
          </a>

          {needsAuth || !googleToken ? (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoggingInGoogle}
              data-testid="google-signin-gmail-btn"
              className="gsi-material-button inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-100 text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper flex items-center gap-2">
                <div className="gsi-material-button-icon w-4 h-4 shrink-0">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="w-4 h-4 block"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingInGoogle ? 'Connecting Gmail...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleLogout}
              data-testid="google-logout-gmail-btn"
              className="px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect Google</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation / Status Banner */}
      {cycleBanner && (
        <div
          data-testid="reminder-status-banner"
          className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{cycleBanner}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://mail.google.com/mail/u/0/#inbox"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="status-open-gmail-inbox-btn"
              className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-500 inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open Gmail Inbox</span>
            </a>
            <button
              type="button"
              onClick={() => setCycleBanner(null)}
              aria-label="Dismiss notification"
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorBanner && (
        <div
          data-testid="reminder-error-banner"
          className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            aria-label="Dismiss error"
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Buyer Receivables — 1-Click Raise Reminder Strip */}
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Active Buyer Receivables — 1-Click Reminder Selection ({unpaidInvoices.length} Unpaid)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select any buyer invoice below to pre-load its pending balance, contractual due date, and soft-copy reminder bill.
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-500">
            Cutoff: {asOfDate} · 3× RBI Rate (20.25% p.a.)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {invoices.map((inv) => {
            const due = inv.contractualDueDate || inv.invoiceDate;
            const daysOver = Math.max(0, calculateDaysDifference(due, asOfDate));
            const isSelected = inv.id === selectedInvoiceId;
            const isPaid = inv.status === 'paid' || Number(inv.outstandingAmountPaise) <= 0;

            return (
              <div
                key={inv.id}
                data-testid={`buyer-receivable-card-${inv.id}`}
                className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
                    : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-zinc-900 dark:text-white">
                      {inv.invoiceNumber}
                    </span>
                    <span
                      className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                        isPaid
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : daysOver > 0
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {isPaid
                        ? 'Settled'
                        : daysOver > 0
                        ? `${daysOver}d Overdue (§16)`
                        : 'Upcoming / Current'}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                    {inv.buyer || caseRecord.buyerName}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono truncate">
                    Due Date: {due} · {inv.buyerEmail || 'accounts.payable@bharatheavyind.in'}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase text-zinc-400 font-semibold">
                      Pending Principal
                    </div>
                    <div className="text-xs font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                      {formatINR(inv.outstandingAmountPaise)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onGenerateQrCode && (
                      <button
                        type="button"
                        onClick={() => onGenerateQrCode(inv.id)}
                        title="Open Interactive Buyer QR & Payment Link"
                        className="px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <QrCode className="w-3 h-3 text-indigo-500" />
                        <span>QR</span>
                      </button>
                    )}

                    <button
                      type="button"
                      data-testid={`quick-raise-reminder-btn-${inv.id}`}
                      onClick={() => setSelectedInvoiceId(inv.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-900 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {isSelected ? 'Selected in Composer' : 'Raise Reminder'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Multi-Channel Composer & Live Message / Email Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 cols: Multi-Channel Buyer Mail & Soft-Copy Bill Composer */}
        <div className="lg:col-span-6 bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-500" />
                <span>Send Buyer Reminder Bill &amp; Soft Copy via Mail</span>
              </h2>
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                PDF + HTML Soft Copy Attached
              </span>
            </div>

            {/* Delivery Channel Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                1. Select Outreach Channel
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'multi_channel', label: 'All Channels', icon: Sparkles },
                    { id: 'email', label: 'Email + Soft Copy', icon: Mail },
                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                    { id: 'sms', label: 'SMS Alert', icon: Phone },
                  ] as const
                ).map((ch) => {
                  const Icon = ch.icon;
                  const active = selectedChannel === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      data-testid={`channel-select-${ch.id}`}
                      onClick={() => setSelectedChannel(ch.id)}
                      className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{ch.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleRequestDispatchConfirmation} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    2. Target Buyer Invoice Bill
                  </label>
                  <select
                    aria-label="Select Invoice for Reminder"
                    data-testid="select-reminder-invoice"
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono text-xs"
                  >
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} — {inv.buyer} (Due: {inv.contractualDueDate || inv.invoiceDate} · {formatINR(inv.outstandingAmountPaise)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    3. Statutory Escalation Stage
                  </label>
                  <select
                    aria-label="Select Statutory Escalation Stage"
                    data-testid="select-reminder-stage"
                    value={selectedReminderType}
                    onChange={(e) =>
                      setSelectedReminderType(e.target.value as EmailReminderRuleType)
                    }
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-xs"
                  >
                    <option value="overdue_15d_escalation">
                      Stage 5 (T+15d+): Formal MSMED §§ 15–16 Notice
                    </option>
                    <option value="overdue_7d">
                      Stage 4 (T+7d): Urgent AR Follow-Up (§15 Cap)
                    </option>
                    <option value="overdue_1d">
                      Stage 3 (T+1d): Initial Overdue &amp; UTR Request
                    </option>
                    <option value="due_today">
                      Stage 2 (T-0): Same-Day Settlement Notice
                    </option>
                    <option value="upcoming_3d">
                      Stage 1 (T-3d): Polite Pre-Due Reminder
                    </option>
                    <option value="manual_notice">
                      Custom Buyer Payment &amp; Portal Invitation
                    </option>
                  </select>
                </div>
              </div>

              {/* Pending Bill & Due Date Breakdown Strip */}
              {selectedInvoice && (
                <div
                  data-testid="pending-bill-due-date-summary"
                  className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-zinc-400">
                      Due Date &amp; Delay
                    </div>
                    <div className="font-mono font-bold text-zinc-900 dark:text-white mt-0.5">
                      {selectedDueDate}
                    </div>
                    <div className="text-[10px] font-mono text-rose-600 dark:text-rose-400">
                      {selectedDaysOverdue > 0
                        ? `${selectedDaysOverdue} Days Overdue`
                        : 'Within Credit Period'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-zinc-400">
                      Pending Principal
                    </div>
                    <div className="font-mono font-bold text-zinc-900 dark:text-white mt-0.5 tabular-nums">
                      {formatINR(financialSummary.principalPaise)}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Billed: {formatINR(selectedInvoice.totalAmountPaise)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-zinc-400">
                      MSMED §16 Interest
                    </div>
                    <div className="font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                      {formatINR(financialSummary.statutoryInterestPaise)}
                    </div>
                    <div className="text-[10px] text-zinc-500">3× RBI (20.25% p.a.)</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-zinc-400">
                      Total Payable Bill
                    </div>
                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 tabular-nums">
                      {formatINR(financialSummary.totalPayablePaise)}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Soft Copy Ready
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor="input-reminder-email"
                      className="font-semibold text-zinc-700 dark:text-zinc-300"
                    >
                      Recipient Email Address *
                    </label>
                    <button
                      type="button"
                      data-testid="use-my-email-btn"
                      onClick={() =>
                        setRecipientEmail(
                          googleUser?.email || DEFAULT_USER_TEST_EMAIL
                        )
                      }
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Use My Email ({googleUser?.email || DEFAULT_USER_TEST_EMAIL})
                    </button>
                  </div>
                  <input
                    id="input-reminder-email"
                    type="email"
                    required
                    placeholder="Enter buyer or recipient email..."
                    data-testid="input-reminder-email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-reminder-phone"
                    className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    Buyer WhatsApp / Mobile Number
                  </label>
                  <input
                    id="input-reminder-phone"
                    type="text"
                    data-testid="input-reminder-phone"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="input-reminder-subject"
                  className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  Email / Notice Subject Line
                </label>
                <input
                  id="input-reminder-subject"
                  type="text"
                  data-testid="input-reminder-subject"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="input-reminder-note"
                  className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  Custom Supplier Message / Remittance Instructions
                </label>
                <textarea
                  id="input-reminder-note"
                  rows={2}
                  data-testid="input-reminder-note"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Add custom bank NEFT/RTGS instructions or settlement deadline note..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white resize-none"
                />
              </div>

              {/* Soft-Copy Attachments & Portal Link Box */}
              <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    <Paperclip className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Attached Soft Copies (Included Automatically in Email)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadSoftCopyPdf}
                    data-testid="composer-download-soft-copy-btn"
                    className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <FileDown className="w-3 h-3" />
                    <span>Download PDF Soft Copy</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
                  <div className="px-2.5 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 truncate">
                    1. {softCopyPdfFilename} (PDF Bill + Notice)
                  </div>
                  <div className="px-2.5 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 truncate">
                    2. {softCopyHtmlFilename} (Portal Preview)
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between gap-2 border-t border-indigo-500/10">
                  <div className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                    Portal Link: {buyerPortalUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(buyerPortalUrl, 'Portal Link Copied!')}
                    className="px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Link</span>
                  </button>
                </div>
              </div>

              {/* Primary Dispatch & Direct Client Launch Buttons */}
              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="submit"
                  disabled={isSendingNotice}
                  data-testid="send-manual-reminder-btn"
                  className="flex-1 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSendingNotice
                      ? 'Sending Reminder Bill & Soft Copy...'
                      : `Send Buyer Reminder Bill & Soft Copy to ${recipientEmail.trim() || 'Email'}`}
                  </span>
                </button>

                <a
                  href={gmailWebComposeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleDownloadSoftCopyPdf()}
                  data-testid="open-gmail-web-compose-link"
                  className="py-2.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Gmail Web + PDF</span>
                </a>

                <a
                  href={mailtoHref}
                  target="_top"
                  data-testid="open-mailto-link"
                  className="py-2.5 px-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-semibold text-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mail App</span>
                </a>
              </div>
            </form>
          </div>

          <div className="pt-3 border-t border-zinc-200/70 dark:border-zinc-800 text-[11px] text-zinc-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>
              Includes Pending Principal ({formatINR(financialSummary.principalPaise)}), Due Date ({selectedDueDate}), MSMED §16 Interest ({formatINR(financialSummary.statutoryInterestPaise)}), and Soft-Copy PDF/HTML attachments.
            </span>
          </div>
        </div>

        {/* Right 6 cols: Live Dual Preview (WhatsApp/SMS/Mail Text + Rich HTML Email) */}
        <div className="lg:col-span-6 bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Live Buyer Notice &amp; Portal Exposure Preview (Soft Copy)
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Exact soft-copy notice &amp; pending bill statement sent to {recipientEmail}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => setLivePreviewMode('text')}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    livePreviewMode === 'text'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Soft-Copy Text Preview
                </button>
                <button
                  type="button"
                  onClick={() => setLivePreviewMode('html')}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    livePreviewMode === 'html'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Rich HTML Email Soft Copy
                </button>
              </div>
            </div>

            {livePreviewMode === 'text' ? (
              <div className="rounded-xl bg-zinc-950 text-zinc-100 p-4 border border-zinc-800 font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[420px] overflow-y-auto">
                {liveMessageText}
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white max-h-[420px] overflow-y-auto">
                <iframe
                  title="Live Statutory Email Preview"
                  srcDoc={liveEmailHtml}
                  className="w-full h-[400px] border-0"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-200/70 dark:border-zinc-800">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              {copiedFeedback || `Soft Copy: ${softCopyPdfFilename}`}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="download-soft-copy-pdf-btn"
                onClick={handleDownloadSoftCopyPdf}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download Soft-Copy PDF</span>
              </button>

              <button
                type="button"
                data-testid="copy-buyer-message-btn"
                onClick={() =>
                  handleCopyText(
                    liveMessageText,
                    'Copied full buyer reminder & portal link to clipboard!'
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Notice &amp; Link</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Durable Multi-Channel Reminder & Outreach Audit Logs Table */}
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Durable Multi-Channel Buyer Reminder Audit Logs ({reminderLogs.length})
            </h3>
            <p className="text-[11px] text-zinc-500">
              Tamper-evident record of every Email, Soft-Copy Bill, WhatsApp, and SMS statutory payment notice dispatched to buyers.
            </p>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            Supplier: {caseRecord.sellerName}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Buyer &amp; Recipient Email</th>
                <th className="py-3 px-4">Escalation Stage &amp; Subject</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4">Delivery Status</th>
                <th className="py-3 px-4">Dispatched At</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/70">
              {reminderLogs.map((log) => {
                const ch = log.channel || 'email';
                const badge = CHANNEL_BADGES[ch] || CHANNEL_BADGES.email;
                return (
                  <tr
                    key={log.id}
                    data-testid={`reminder-log-row-${log.id}`}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 dark:text-white">
                      {log.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-900 dark:text-white">
                        {log.customerName}
                      </div>
                      <div className="font-mono text-[11px] text-zinc-500">
                        {log.recipientEmail}
                        {log.recipientPhone ? ` · ${log.recipientPhone}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {REMINDER_RULE_LABELS[log.reminderType] || log.reminderType}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate max-w-xs">
                        {log.subject}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-zinc-900 dark:text-white">
                      {formatINR(log.balanceDuePaise)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {String(log.providerMessageId || '').startsWith('gmail_')
                            ? 'Sent via Gmail + Soft Copy'
                            : log.status === 'sent'
                            ? 'Delivered + Soft Copy'
                            : 'Logged'}
                        </span>
                      </span>
                      <div className="font-mono text-[10px] text-zinc-400">
                        {log.providerMessageId}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        <span>{new Date(log.sentAt).toLocaleDateString('en-IN')}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        data-testid={`preview-reminder-html-btn-${log.id}`}
                        onClick={() => setPreviewLog(log)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview Notice</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MANDATORY CONFIRMATION MODAL BEFORE SENDING EMAIL ON BEHALF OF USER */}
      {isConfirmModalOpen && selectedInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-send-email-title"
          data-testid="confirm-send-email-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-500" />
                <h3
                  id="confirm-send-email-title"
                  className="text-sm font-bold text-zinc-900 dark:text-white"
                >
                  Confirm Sending Buyer Reminder Bill &amp; Soft Copy
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                aria-label="Close confirmation dialog"
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
              <p>
                Please confirm that you want to send this official <strong>Buyer Reminder Bill</strong> and attached <strong>Buyer Notice &amp; Portal Exposure Preview Soft Copy</strong> to:
              </p>

              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Recipient Email:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {recipientEmail.trim()}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Invoice &amp; Buyer:</span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                    {selectedInvoice.invoiceNumber} ({selectedInvoice.buyer || caseRecord.buyerName})
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Statutory Due Date:</span>
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                    {selectedDueDate} ({selectedDaysOverdue} Days Overdue)
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Pending Principal:</span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                    {formatINR(financialSummary.principalPaise)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">MSMED §16 Interest (20.25%):</span>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                    {formatINR(financialSummary.statutoryInterestPaise)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-1.5 border-t border-zinc-200 dark:border-zinc-800">
                  <span className="font-bold text-zinc-900 dark:text-white">
                    Total Enforceable Bill:
                  </span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {formatINR(financialSummary.totalPayablePaise)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-1">
                <div className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Soft-Copy Files Attached to Email:</span>
                </div>
                <div className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                  • {softCopyPdfFilename} (PDF Bill + Due Date + Notice Preview)
                </div>
                <div className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                  • {softCopyHtmlFilename} (HTML Buyer Notice &amp; Portal Soft Copy)
                </div>
              </div>

              {/* Connection status inside modal */}
              {needsAuth || !googleToken ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span>Google Gmail Authorization Required for Real Inbox Delivery</span>
                  </div>
                  <p>
                    Clicking <strong>&ldquo;Sign in with Google &amp; Send Real Email&rdquo;</strong> below will open the Google permission popup. Make sure to check the box <strong>&ldquo;Send email on your behalf&rdquo;</strong> so Gmail delivers this email + PDF soft copy directly to <strong>{recipientEmail.trim()}</strong>.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>
                    Connected as <strong>{googleUser?.email}</strong> — Ready to deliver directly to <strong>{recipientEmail.trim()}</strong> via Gmail API.
                  </span>
                </div>
              )}

              {modalError && (
                <div
                  data-testid="modal-gmail-error"
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-700 dark:text-rose-300 space-y-2"
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>{modalError}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={gmailWebComposeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        handleDownloadSoftCopyPdf();
                        setIsConfirmModalOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Pre-Filled Gmail Web + Auto-Download PDF Soft Copy</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  data-testid="send-real-gmail-btn"
                  onClick={handleSendRealEmailViaGmail}
                  disabled={isSendingNotice}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSendingNotice
                      ? 'Sending Real Email + Soft Copies via Gmail...'
                      : needsAuth || !googleToken
                      ? `Sign in with Google & Send Real Email to ${recipientEmail.trim()}`
                      : `Send Real Email + Soft Copies to ${recipientEmail.trim()} Now`}
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <a
                  href={gmailWebComposeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    handleDownloadSoftCopyPdf();
                    setIsConfirmModalOpen(false);
                  }}
                  data-testid="modal-gmail-web-fallback-btn"
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-semibold inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Pre-Filled Gmail Web + Download PDF Soft Copy</span>
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="confirm-dispatch-email-btn"
                    onClick={handleConfirmAndDispatchNotice}
                    disabled={isSendingNotice}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold cursor-pointer"
                  >
                    Log in Audit Trail
                  </button>

                  <button
                    type="button"
                    data-testid="cancel-send-email-btn"
                    onClick={() => setIsConfirmModalOpen(false)}
                    disabled={isSendingNotice}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW STATUTORY REMINDER EMAIL HTML & MESSAGE */}
      {previewLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  {previewLog.subject}
                </h3>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  To: {previewLog.recipientEmail}
                  {previewLog.recipientPhone ? ` (${previewLog.recipientPhone})` : ''} · Msg ID:{' '}
                  {previewLog.providerMessageId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLog(null)}
                aria-label="Close email preview"
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white max-h-[60vh] overflow-y-auto">
              <iframe
                title="Statutory Reminder Email Preview"
                srcDoc={previewLog.bodyHtml}
                className="w-full h-[420px] border-0"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-mono text-zinc-500 truncate max-w-md">
                Portal Link: {previewLog.paymentPortalUrl || buyerPortalUrl}
              </span>
              <button
                type="button"
                onClick={() => setPreviewLog(null)}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
