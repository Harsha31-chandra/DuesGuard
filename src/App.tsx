/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileText,
  GitFork,
  Calculator,
  ShieldCheck,
  Cpu,
  UserCheck,
  FileSpreadsheet,
  MessageSquare,
  Layers,
  Building2,
  Receipt,
  Users,
  Mail,
} from 'lucide-react';
import type {
  ActiveWorkspaceSession,
  AnalysisRun,
  CaseDocument,
  CaseRecord,
  ChatMessage,
  ChatModelTier,
  ChatRolePersona,
  CustomerRecord,
  EmailReminderLogRecord,
  EmailReminderRuleType,
  Finding,
  InvoiceRecord,
  ProductItemRecord,
  ReminderDeliveryChannel,
  TenantRecord,
} from './types/index.ts';
import { DashboardView } from './components/DashboardView.tsx';
import { DocumentsView } from './components/DocumentsView.tsx';
import { EvidenceGraphView } from './components/EvidenceGraphView.tsx';
import { FinanceEngineView } from './components/FinanceEngineView.tsx';
import { ComplianceView } from './components/ComplianceView.tsx';
import { AgentTraceView } from './components/AgentTraceView.tsx';
import { ReviewApprovalView } from './components/ReviewApprovalView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { ChatbotView } from './components/ChatbotView.tsx';
import { ArchitectureHubView } from './components/ArchitectureHubView.tsx';
import { WorkspaceAuthPortalView } from './components/WorkspaceAuthPortalView.tsx';
import { AuthGateScreen } from './components/AuthGateScreen.tsx';
import { DocumentPreviewModal } from './components/DocumentPreviewModal.tsx';
import { NewCaseModal } from './components/NewCaseModal.tsx';
import { ThemeProvider } from './components/ThemeProvider.tsx';
import { FloatingAssistantPopup } from './components/FloatingAssistantPopup.tsx';
import { QrPaymentModal } from './components/QrPaymentModal.tsx';
import { DemoPaymentPage } from './components/DemoPaymentPage.tsx';
import {
  EnterpriseSidebar,
  WorkspaceTopBar,
  type SidebarNavItem,
} from './components/EnterpriseSidebar.tsx';
import { InvoicesBillingView } from './components/InvoicesBillingView.tsx';
import { CustomersProductsView } from './components/CustomersProductsView.tsx';
import { OverdueRemindersView } from './components/OverdueRemindersView.tsx';

export default function App() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string>('case-001');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [asOfDate, setAsOfDate] = useState<string>('2024-04-15');
  const [caseData, setCaseData] = useState<{
    case: CaseRecord;
    documents: CaseDocument[];
    invoices: InvoiceRecord[];
    deliveries: any[];
    purchaseOrders: any[];
    payments: any[];
    findings: Finding[];
    evidenceLinks: any[];
    latestAnalysis: AnalysisRun | null;
    customers?: CustomerRecord[];
    products?: ProductItemRecord[];
    reminderLogs?: EmailReminderLogRecord[];
  } | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>('tenant-apex-001');
  const [workspaceSession, setWorkspaceSession] = useState<ActiveWorkspaceSession | null>(null);
  const [isLoggedOut, setIsLoggedOut] = useState<boolean>(false);
  const [authInitialRoute, setAuthInitialRoute] = useState<
    'select-workspace' | 'login' | 'register' | 'recovery-2fa' | 'onboarding' | 'rbac-members'
  >('select-workspace');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [previewDocument, setPreviewDocument] = useState<CaseDocument | null>(null);
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState<boolean>(false);
  const [qrModalInvoiceId, setQrModalInvoiceId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [openInvoiceGeneratorOnMount, setOpenInvoiceGeneratorOnMount] = useState<boolean>(false);
  const [preselectedCustomerForInvoice, setPreselectedCustomerForInvoice] = useState<string | null>(
    null
  );
  const [preselectedInvoiceForReminder, setPreselectedInvoiceForReminder] = useState<string | null>(
    null
  );
  const [preselectedCustomerForReminder, setPreselectedCustomerForReminder] = useState<
    string | null
  >(null);
  const [demoPayToken, setDemoPayToken] = useState<string | null>(() => {
    const match = window.location.pathname.match(/^\/demo-pay\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  });

  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/^\/demo-pay\/([^/]+)$/);
      setDemoPayToken(match ? decodeURIComponent(match[1]) : null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Log Out current user and return to the full-screen Split-Screen Login page
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    setIsLoggedOut(true);
    setAuthInitialRoute('login');
  };

  // Fetch all cases
  const fetchCases = async () => {
    try {
      const res = await fetch('/api/cases');
      if (res.ok) {
        const data = await res.json();
        setCases(data);
      }
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    }
  };

  // Fetch tenants
  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/tenants');
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    }
  };

  // Fetch active Multi-Organization & Branch Workspace Session
  const fetchWorkspaceSession = async () => {
    try {
      const res = await fetch('/api/workspaces/current');
      if (res.ok) {
        const data = await res.json();
        setWorkspaceSession(data);
      }
    } catch (err) {
      console.error('Failed to fetch workspace session:', err);
    }
  };

  // Quick-switch Organization or Branch from Header
  const handleQuickSwitchWorkspace = async (organizationId: string, branchId?: string) => {
    try {
      const res = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, branchId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setWorkspaceSession(data.session);
        }
      }
    } catch (err) {
      console.error('Failed to switch workspace:', err);
    }
  };

  // Fetch chat history for active case
  const fetchChatHistory = async (caseId: string) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/chat`);
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
    }
  };

  // Fetch active case details (without unmounting active view on background refresh)
  const fetchCaseDetails = async (caseId: string) => {
    if (!caseData || caseData.case.id !== caseId) {
      setIsLoading(true);
    }
    try {
      const res = await fetch(`/api/cases/${caseId}`);
      if (res.ok) {
        const data = await res.json();
        setCaseData(data);
      }
    } catch (err) {
      console.error('Failed to fetch case details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
    fetchTenants();
    fetchWorkspaceSession();
  }, []);

  useEffect(() => {
    if (activeCaseId) {
      fetchCaseDetails(activeCaseId);
      fetchChatHistory(activeCaseId);
    }
  }, [activeCaseId]);

  // Send Multi-Turn Chat Message
  const handleSendChatMessage = async (payload: {
    message: string;
    modelTier: ChatModelTier;
    rolePersona: ChatRolePersona;
  }) => {
    if (!activeCaseId) return;
    setIsSendingChat(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: activeCaseId,
          ...payload,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.history) {
          setChatHistory(data.history);
        } else {
          await fetchChatHistory(activeCaseId);
        }
      }
    } catch (err) {
      console.error('Failed to send chat message:', err);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Clear Chat History
  const handleClearChat = async () => {
    if (!activeCaseId) return;
    try {
      const res = await fetch(`/api/cases/${activeCaseId}/chat`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data);
      }
    } catch (err) {
      console.error('Failed to clear chat history:', err);
    }
  };

  // Run LangGraph Agent Pipeline
  const handleRunAnalysis = async () => {
    if (!activeCaseId) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/cases/${activeCaseId}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asOfDate }),
      });
      if (res.ok) {
        await fetchCaseDetails(activeCaseId);
      }
    } catch (err) {
      console.error('Failed to run analysis:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Human Review Approval
  const handleApprove = async (approvalData: {
    analysisId: string;
    reviewerName: string;
    reviewerDesignation: string;
    reviewerNotes: string;
  }) => {
    if (!activeCaseId) return;
    try {
      const res = await fetch(`/api/cases/${activeCaseId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvalData),
      });
      if (res.ok) {
        await fetchCaseDetails(activeCaseId);
      }
    } catch (err) {
      console.error('Failed to approve analysis:', err);
    }
  };

  // Document Upload
  const handleUploadDocument = async (docData: any) => {
    if (!activeCaseId) return;
    try {
      const res = await fetch(`/api/cases/${activeCaseId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docData),
      });
      if (res.ok) {
        await fetchCaseDetails(activeCaseId);
      }
    } catch (err) {
      console.error('Failed to upload document:', err);
    }
  };

  // Update finding notes
  const handleUpdateFinding = async (findingId: string, updates: Partial<Finding>) => {
    if (!activeCaseId) return;
    try {
      const res = await fetch(`/api/cases/${activeCaseId}/findings/${findingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        await fetchCaseDetails(activeCaseId);
      }
    } catch (err) {
      console.error('Failed to update finding:', err);
    }
  };

  // Log external payment receipt and dynamically recalculate Disputed Invoice Ledger
  const handleLogPayment = async (payload: {
    invoiceId?: string;
    amountPaise: string;
    paymentDate: string;
    reference: string;
    paymentMethod: string;
    notes: string;
  }) => {
    if (!activeCaseId) return;
    const res = await fetch(`/api/cases/${activeCaseId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, asOfDate }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to log payment');
    }
    await fetchCaseDetails(activeCaseId);
  };

  // Remove logged payment and recalculate ledger
  const handleDeletePayment = async (paymentId: string) => {
    if (!activeCaseId) return;
    const res = await fetch(
      `/api/cases/${activeCaseId}/payments/${paymentId}?asOfDate=${encodeURIComponent(asOfDate)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      await fetchCaseDetails(activeCaseId);
    }
  };

  // Reset Demo Case
  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/cases/reset-demo', { method: 'POST' });
      if (res.ok) {
        await fetchCases();
        setActiveCaseId('case-001');
        await fetchCaseDetails('case-001');
        await fetchChatHistory('case-001');
      }
    } catch (err) {
      console.error('Failed to reset demo:', err);
    }
  };

  // Create New Case
  const handleCreateCase = async (newCaseData: Partial<CaseRecord>) => {
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCaseData),
      });
      if (res.ok) {
        const created = await res.json();
        await fetchCases();
        setActiveCaseId(created.id);
        setActiveTab('documents');
      }
    } catch (err) {
      console.error('Failed to create case:', err);
    }
  };

  // Generate Authoritative GST Invoice
  const handleGenerateGstInvoice = async (payload: {
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
  }): Promise<InvoiceRecord | null> => {
    if (!activeCaseId) return null;
    const res = await fetch(`/api/cases/${activeCaseId}/invoices/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, asOfDate }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate GST invoice');
    }
    const data = await res.json();
    await fetchCaseDetails(activeCaseId);
    return data.invoice || null;
  };

  // Add Customer
  const handleAddCustomer = async (customer: Partial<CustomerRecord>) => {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...customer,
        organizationId: workspaceSession?.activeOrganization?.id || 'org-apex-001',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add customer');
    }
    if (activeCaseId) {
      await fetchCaseDetails(activeCaseId);
    }
  };

  // Add Product SKU
  const handleAddProduct = async (product: Partial<ProductItemRecord>) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...product,
        organizationId: workspaceSession?.activeOrganization?.id || 'org-apex-001',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add product');
    }
    if (activeCaseId) {
      await fetchCaseDetails(activeCaseId);
    }
  };

  // Delete Product SKU
  const handleDeleteProduct = async (productId: string) => {
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    if (res.ok && activeCaseId) {
      await fetchCaseDetails(activeCaseId);
    }
  };

  // Trigger Automated 5-Stage Overdue Reminder Scheduler Cycle
  const handleTriggerReminderCycle = async () => {
    if (!activeCaseId) return { dispatchedCount: 0, skippedDuplicateCount: 0 };
    const res = await fetch(`/api/cases/${activeCaseId}/reminders/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asOfDate }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to trigger reminder cycle');
    }
    const data = await res.json();
    await fetchCaseDetails(activeCaseId);
    return {
      dispatchedCount: data.dispatchedCount || 0,
      skippedDuplicateCount: data.skippedDuplicateCount || 0,
    };
  };

  // Send Manual or Test Reminder Notice (Email, WhatsApp, SMS, or Multi-Channel)
  const handleSendManualReminder = async (params: {
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
  }) => {
    if (!activeCaseId) return;
    const res = await fetch(`/api/cases/${activeCaseId}/reminders/send-notice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, asOfDate }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to dispatch statutory notice');
    }
    await fetchCaseDetails(activeCaseId);
  };

  // Broadcast Reminders across all unpaid/overdue invoices
  const handleBroadcastAllOverdue = async (params: {
    channel: ReminderDeliveryChannel;
    customNote?: string;
    baseUrl?: string;
  }) => {
    if (!activeCaseId) return { dispatchedCount: 0 };
    const res = await fetch(`/api/cases/${activeCaseId}/reminders/broadcast-overdue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, asOfDate }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to broadcast overdue reminders');
    }
    const data = await res.json();
    await fetchCaseDetails(activeCaseId);
    return { dispatchedCount: data.dispatchedCount || 0 };
  };

  const activeCase = caseData?.case || cases.find((c) => c.id === activeCaseId) || null;
  const analysis = caseData?.latestAnalysis || null;
  const invoices = caseData?.invoices || [];
  const documents = caseData?.documents || [];
  const deliveries = caseData?.deliveries || [];
  const purchaseOrders = caseData?.purchaseOrders || [];
  const evidenceLinks = caseData?.evidenceLinks || [];
  const findings = caseData?.findings || [];
  const customers = caseData?.customers || [];
  const products = caseData?.products || [];
  const reminderLogs = caseData?.reminderLogs || [];

  const navTabs: SidebarNavItem[] = [
    { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard, group: 'overview' },
    {
      id: 'invoices-billing',
      label: 'GST Tax Invoices',
      icon: Receipt,
      count: invoices.length,
      group: 'erp',
    },
    {
      id: 'customers-products',
      label: 'Customers & Catalogue',
      icon: Users,
      count: customers.length + products.length,
      group: 'erp',
    },
    {
      id: 'reminders',
      label: 'Overdue Reminders',
      icon: Mail,
      count: reminderLogs.length,
      group: 'erp',
    },
    {
      id: 'documents',
      label: 'Document Vault',
      icon: FileText,
      count: documents.length,
      group: 'msmed',
    },
    { id: 'evidence', label: 'Evidence Graph', icon: GitFork, group: 'msmed' },
    { id: 'finance', label: 'MSMED Interest Engine', icon: Calculator, group: 'msmed' },
    { id: 'compliance', label: 'Udyam & GST Audit', icon: ShieldCheck, group: 'msmed' },
    { id: 'trace', label: 'Agent Pipeline', icon: Cpu, group: 'workflow' },
    {
      id: 'review',
      label: 'Human Review',
      icon: UserCheck,
      badge: analysis?.approvalStatus === 'approved' ? 'Approved' : 'Pending',
      group: 'workflow',
    },
    { id: 'reports', label: 'ODR & PDF Annexures', icon: FileSpreadsheet, group: 'workflow' },
    {
      id: 'chatbot',
      label: 'AI Legal Assistant',
      icon: MessageSquare,
      count: chatHistory.length,
      group: 'platform',
    },
    {
      id: 'auth-workspaces',
      label: 'Org & RBAC Workspaces',
      icon: Building2,
      count: workspaceSession?.accessibleOrganizations.length,
      group: 'platform',
    },
    {
      id: 'architecture',
      label: 'Cloud & Mobile Hub',
      icon: Layers,
      group: 'platform',
    },
  ];

  const activeNavTabItem = navTabs.find((t) => t.id === activeTab);

  if (demoPayToken) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light">
        <DemoPaymentPage
          token={demoPayToken}
          caseIdForReset={activeCaseId}
          onBackToApp={() => {
            window.history.pushState({}, '', '/');
            setDemoPayToken(null);
            fetchCaseDetails(activeCaseId);
          }}
        />
      </ThemeProvider>
    );
  }

  if (isLoggedOut) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light">
        <AuthGateScreen
          initialMode="login"
          workspaceSession={workspaceSession}
          onSessionAuthenticated={(session, enterDashboardImmediately) => {
            setWorkspaceSession(session);
            if (enterDashboardImmediately) {
              setIsLoggedOut(false);
              setActiveTab('dashboard');
            }
          }}
          onEnterDashboard={() => {
            setIsLoggedOut(false);
            setActiveTab('dashboard');
          }}
          onLogout={handleLogout}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <div className="min-h-screen bg-[#f8fafc] dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex font-sans relative overflow-x-hidden transition-colors duration-200">
        {/* Left Categorized Enterprise SaaS Sidebar */}
        <EnterpriseSidebar
          tabs={navTabs}
          activeTab={activeTab}
          onSelectTab={(tabId) => setActiveTab(tabId)}
          onLogout={handleLogout}
          userName={workspaceSession?.user?.fullName}
          userRole={workspaceSession?.activeRole}
          activeOrgName={workspaceSession?.activeOrganization?.displayName}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Right Workspace Content Column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Sticky Contextual Top Header */}
          <WorkspaceTopBar
            activeTabLabel={activeNavTabItem?.label || 'Command Center'}
            workspaceSession={workspaceSession}
            cases={cases}
            activeCase={activeCase}
            asOfDate={asOfDate}
            onSelectCase={(caseId) => setActiveCaseId(caseId)}
            onDateChange={(date) => {
              setAsOfDate(date);
              handleRunAnalysis();
            }}
            onQuickSwitchWorkspace={handleQuickSwitchWorkspace}
            onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
            onOpenGenerateInvoice={() => {
              setOpenInvoiceGeneratorOnMount(true);
              setActiveTab('invoices-billing');
            }}
            onResetDemo={handleResetDemo}
            onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
            onOpenAccountSettings={() => setActiveTab('auth-workspaces')}
          />

          {/* Main View Area */}
          <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mb-3" />
                <p className="text-xs font-medium">Loading DuesGuard AI Workspace...</p>
              </div>
            ) : !caseRecordExists(caseData) ? (
              <div className="text-center py-20">
                <p className="text-slate-500 text-sm">No active case selected.</p>
                <button
                  onClick={handleResetDemo}
                  className="mt-3 px-4 py-2 bg-slate-900 text-white rounded-md text-xs font-medium cursor-pointer"
                >
                  Load InnoSprint Demo Case
                </button>
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <DashboardView
                    caseRecord={caseData.case}
                    documents={documents}
                    invoices={invoices}
                    payments={caseData.payments || []}
                    analysis={analysis}
                    onRunAnalysis={handleRunAnalysis}
                    isAnalyzing={isAnalyzing}
                    onNavigateTab={(tab) => setActiveTab(tab)}
                    onOpenReportModal={() => setActiveTab('reports')}
                    workspaceSession={workspaceSession}
                    onLogPayment={handleLogPayment}
                    onDeletePayment={handleDeletePayment}
                    onGenerateQrCode={(invId) => setQrModalInvoiceId(invId)}
                  />
                )}

                {activeTab === 'invoices-billing' && (
                  <InvoicesBillingView
                    caseRecord={caseData.case}
                    invoices={invoices}
                    payments={caseData.payments || []}
                    customers={customers}
                    products={products}
                    asOfDate={asOfDate}
                    sellerState="Maharashtra"
                    initialOpenCreateModal={openInvoiceGeneratorOnMount}
                    preselectedCustomerId={preselectedCustomerForInvoice}
                    onClearInitialModalState={() => {
                      setOpenInvoiceGeneratorOnMount(false);
                      setPreselectedCustomerForInvoice(null);
                    }}
                    onGenerateInvoice={handleGenerateGstInvoice}
                    onLogPayment={handleLogPayment}
                    onDeletePayment={handleDeletePayment}
                    onGenerateQrCode={(invId) => setQrModalInvoiceId(invId)}
                    onSendReminderForInvoice={(invId) => {
                      setPreselectedInvoiceForReminder(invId);
                      setActiveTab('reminders');
                    }}
                  />
                )}

                {activeTab === 'customers-products' && (
                  <CustomersProductsView
                    customers={customers}
                    products={products}
                    sellerState="Maharashtra"
                    onAddCustomer={handleAddCustomer}
                    onAddProduct={handleAddProduct}
                    onDeleteProduct={handleDeleteProduct}
                    onOpenInvoiceForCustomer={(customerId) => {
                      setPreselectedCustomerForInvoice(customerId);
                      setOpenInvoiceGeneratorOnMount(true);
                      setActiveTab('invoices-billing');
                    }}
                    onSendReminderForCustomer={(customerId) => {
                      setPreselectedCustomerForReminder(customerId);
                      setActiveTab('reminders');
                    }}
                  />
                )}

                {activeTab === 'reminders' && (
                  <OverdueRemindersView
                    caseRecord={caseData.case}
                    invoices={invoices}
                    customers={customers}
                    reminderLogs={reminderLogs}
                    asOfDate={asOfDate}
                    preselectedInvoiceId={preselectedInvoiceForReminder}
                    preselectedCustomerId={preselectedCustomerForReminder}
                    onClearPreselection={() => {
                      setPreselectedInvoiceForReminder(null);
                      setPreselectedCustomerForReminder(null);
                    }}
                    onTriggerSchedulerCycle={handleTriggerReminderCycle}
                    onSendManualNotice={handleSendManualReminder}
                    onBroadcastAllOverdue={handleBroadcastAllOverdue}
                    onGenerateQrCode={(invId) => setQrModalInvoiceId(invId)}
                  />
                )}

                {activeTab === 'auth-workspaces' && (
                  <WorkspaceAuthPortalView
                    workspaceSession={workspaceSession}
                    onSessionUpdated={(session) => setWorkspaceSession(session)}
                    onNavigateToDashboard={() => setActiveTab('dashboard')}
                    initialRoute={authInitialRoute}
                    isLoggedOut={isLoggedOut}
                    onLogout={handleLogout}
                  />
                )}

                {activeTab === 'documents' && (
                  <DocumentsView
                    documents={documents}
                    onUploadDocument={handleUploadDocument}
                    onPreviewDocument={(doc) => setPreviewDocument(doc)}
                  />
                )}

                {activeTab === 'evidence' && (
                  <EvidenceGraphView
                    evidenceLinks={evidenceLinks}
                    invoices={invoices}
                    purchaseOrders={purchaseOrders}
                    deliveries={deliveries}
                    onOpenFinding={() => setActiveTab('review')}
                  />
                )}

                {activeTab === 'finance' && (
                  <FinanceEngineView
                    invoices={invoices}
                    msmedResult={analysis?.msmedResult}
                    contractualDays={caseData.case.contractualPaymentDays || 30}
                    asOfDate={asOfDate}
                    onGenerateQrCode={(invId) => setQrModalInvoiceId(invId)}
                  />
                )}

                {activeTab === 'compliance' && (
                  <ComplianceView
                    caseRecord={caseData.case}
                    udyamCheck={analysis?.udyamCheck}
                    gstinChecks={analysis?.gstinChecks}
                    invoiceDates={invoices.map((i) => i.invoiceDate)}
                  />
                )}

                {activeTab === 'trace' && (
                  <AgentTraceView
                    analysis={analysis}
                    onRunAnalysis={handleRunAnalysis}
                    isAnalyzing={isAnalyzing}
                    onNavigateTab={(tab) => setActiveTab(tab)}
                  />
                )}

                {activeTab === 'review' && (
                  <ReviewApprovalView
                    caseRecord={caseData.case}
                    analysis={analysis}
                    onApprove={handleApprove}
                    onUpdateFinding={handleUpdateFinding}
                    onOpenReportModal={() => setActiveTab('reports')}
                  />
                )}

                {activeTab === 'reports' && (
                  <ReportsView
                    caseRecord={caseData.case}
                    analysis={analysis}
                    invoices={invoices}
                    documents={documents}
                    onNavigateTab={(tab) => setActiveTab(tab)}
                  />
                )}

                {activeTab === 'chatbot' && (
                  <ChatbotView
                    caseRecord={caseData.case}
                    invoices={invoices}
                    analysis={analysis}
                    chatHistory={chatHistory}
                    onSendMessage={handleSendChatMessage}
                    onClearChat={handleClearChat}
                    isSending={isSendingChat}
                  />
                )}

                {activeTab === 'architecture' && (
                  <ArchitectureHubView
                    caseRecord={caseData.case}
                    invoices={invoices}
                    findings={findings}
                    analysis={analysis}
                    tenants={tenants}
                    activeTenantId={activeTenantId}
                    onSelectTenant={(tId) => setActiveTenantId(tId)}
                    onRefreshCase={() => fetchCaseDetails(activeCaseId)}
                  />
                )}
              </>
            )}
          </main>

          {/* Footer */}
          <footer className="relative z-10 border-t border-zinc-200 dark:border-zinc-800/80 py-4 px-6 text-xs text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-950/60">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong className="text-zinc-800 dark:text-zinc-200">DuesGuard AI</strong> — Unified
                MSME GST Billing, Automated Overdue Reminder Engine &amp; MSMED Act 2006 Statutory
                Resolution Platform.
              </span>
              <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                Policy: MSMED_ACT_2006_SEC_15_16_V2.1 · Intra/Inter-State GST · 5-Stage Reminder
                Scheduler
              </span>
            </div>
          </footer>
        </div>

        {/* Document Provenance Modal */}
        <DocumentPreviewModal
          document={previewDocument}
          invoice={invoices.find((i) => i.documentId === previewDocument?.id)}
          onClose={() => setPreviewDocument(null)}
        />

        {/* New Case Creation Modal */}
        <NewCaseModal
          isOpen={isNewCaseModalOpen}
          onClose={() => setIsNewCaseModalOpen(false)}
          onCreateCase={handleCreateCase}
        />

        {/* Invoice-Linked Demo QR Code Modal */}
        <QrPaymentModal
          isOpen={!!qrModalInvoiceId}
          onClose={() => setQrModalInvoiceId(null)}
          caseId={activeCaseId}
          invoiceId={qrModalInvoiceId}
          organizationId={workspaceSession?.activeOrganization?.id}
          branchId={workspaceSession?.activeBranchId}
          userId={workspaceSession?.user?.id}
          onOpenBuyerDemoPage={(relativePath) => {
            setQrModalInvoiceId(null);
            window.history.pushState({}, '', relativePath);
            const match = relativePath.match(/^\/demo-pay\/([^/]+)$/);
            if (match) {
              setDemoPayToken(decodeURIComponent(match[1]));
            }
          }}
          onDemoDataChanged={() => fetchCaseDetails(activeCaseId)}
        />

        {/* Floating Bottom-Right AI Assistant Popup */}
        <FloatingAssistantPopup
          caseRecord={caseData?.case}
          invoices={invoices}
          analysis={analysis}
          chatHistory={chatHistory}
          onSendMessage={handleSendChatMessage}
          onClearChat={handleClearChat}
          isSending={isSendingChat}
          onOpenFullChatbot={() => setActiveTab('chatbot')}
        />
      </div>
    </ThemeProvider>
  );
}

function caseRecordExists(data: any): data is { case: CaseRecord } {
  return data && data.case && data.case.id;
}
