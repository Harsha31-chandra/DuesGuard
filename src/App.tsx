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
  Sparkles,
  Building2,
} from 'lucide-react';
import type {
  ActiveWorkspaceSession,
  AnalysisRun,
  CaseDocument,
  CaseRecord,
  ChatMessage,
  ChatModelTier,
  ChatRolePersona,
  Finding,
  InvoiceRecord,
  TenantRecord,
} from './types/index.ts';
import { Header } from './components/Header.tsx';
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
import { FloatingNavbar } from './components/FloatingNavbar.tsx';
import { FloatingAssistantPopup } from './components/FloatingAssistantPopup.tsx';
import { QrPaymentModal } from './components/QrPaymentModal.tsx';
import { DemoPaymentPage } from './components/DemoPaymentPage.tsx';
import { ROLE_LABELS } from './services/workspaceAuth.ts';

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

  // Fetch active case details
  const fetchCaseDetails = async (caseId: string) => {
    setIsLoading(true);
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

  const activeCase = caseData?.case || cases.find((c) => c.id === activeCaseId) || null;
  const analysis = caseData?.latestAnalysis || null;
  const invoices = caseData?.invoices || [];
  const documents = caseData?.documents || [];
  const deliveries = caseData?.deliveries || [];
  const purchaseOrders = caseData?.purchaseOrders || [];
  const evidenceLinks = caseData?.evidenceLinks || [];
  const findings = caseData?.findings || [];

  const navTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'auth-workspaces',
      label: 'Workspaces',
      icon: Building2,
      count: workspaceSession?.accessibleOrganizations.length,
    },
    { id: 'documents', label: 'Documents', icon: FileText, count: documents.length },
    { id: 'evidence', label: 'Evidence', icon: GitFork },
    { id: 'finance', label: 'MSMED Finance', icon: Calculator },
    { id: 'compliance', label: 'Udyam & GST', icon: ShieldCheck },
    { id: 'trace', label: 'Workflow', icon: Cpu },
    {
      id: 'review',
      label: 'Review Gate',
      icon: UserCheck,
      badge: analysis?.approvalStatus === 'approved' ? 'Approved' : 'Pending',
    },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    {
      id: 'chatbot',
      label: 'AI Chat',
      icon: MessageSquare,
      count: chatHistory.length,
    },
    {
      id: 'architecture',
      label: 'Cloud & Mobile',
      icon: Layers,
    },
  ];

  const activeOrg = workspaceSession?.activeOrganization;
  const accessibleOrgs = workspaceSession?.accessibleOrganizations || [];
  const activeOrgMembership = accessibleOrgs.find((a) => a.organization.id === activeOrg?.id);

  if (demoPayToken) {
    return (
      <ThemeProvider attribute="class" defaultTheme="dark">
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
      <ThemeProvider attribute="class" defaultTheme="dark">
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
    <ThemeProvider attribute="class" defaultTheme="dark">
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans relative overflow-x-hidden transition-colors duration-300">
        {/* Top-Center Ambient Radial Glow (Light & Dark Mode) */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_75%_55%_at_50%_-15%,rgba(99,102,241,0.10),transparent)] dark:bg-[radial-gradient(ellipse_75%_55%_at_50%_-15%,rgba(99,102,241,0.18),transparent)] z-0"
        />

        {/* Fixed Floating Pill Navigation (Taskbar) */}
        <FloatingNavbar
          tabs={navTabs}
          activeTab={activeTab}
          onSelectTab={(tabId: string) => setActiveTab(tabId)}
          onLogout={handleLogout}
          userName={workspaceSession?.user?.fullName}
        />

        {/* Contextual Multi-Organization, Branch & Case Selector Strip */}
        <div className="relative z-20 pt-20 pb-2 px-4 max-w-7xl w-full mx-auto">
          <div className="rounded-full px-4 py-2 bg-white/75 dark:bg-zinc-900/50 backdrop-blur-xl border border-zinc-200/70 dark:border-white/8 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Organization & Branch Quick Switchers */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Org:
                </span>
                <select
                  aria-label="Switch Active Organization Workspace"
                  data-testid="header-org-switcher"
                  value={activeOrg?.id || ''}
                  onChange={(e) => handleQuickSwitchWorkspace(e.target.value)}
                  className="bg-transparent text-zinc-900 dark:text-zinc-100 font-semibold text-xs focus:outline-none cursor-pointer"
                >
                  {accessibleOrgs.map(({ organization, role }) => (
                    <option
                      key={organization.id}
                      value={organization.id}
                      className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    >
                      {organization.displayName} ({ROLE_LABELS[role]})
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-zinc-300 dark:text-zinc-700">|</span>

              {activeOrg && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Branch:
                  </span>
                  <select
                    aria-label="Switch Active Operating Branch"
                    data-testid="header-branch-switcher"
                    value={workspaceSession?.activeBranchId || ''}
                    onChange={(e) => handleQuickSwitchWorkspace(activeOrg.id, e.target.value)}
                    className="bg-transparent text-zinc-900 dark:text-zinc-100 font-semibold text-xs focus:outline-none cursor-pointer"
                  >
                    {activeOrgMembership?.allBranchesAccess && (
                      <option
                        value="ALL_BRANCHES"
                        className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                      >
                        All Branches ({activeOrg.branches.length})
                      </option>
                    )}
                    {activeOrg.branches
                      .filter(
                        (b) =>
                          activeOrgMembership?.allBranchesAccess ||
                          activeOrgMembership?.allowedBranchIds.includes(b.id)
                      )
                      .map((b) => (
                        <option
                          key={b.id}
                          value={b.id}
                          className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                        >
                          {b.branchName} ({b.city})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Active Case & Statutory Cutoff Date */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Case:
                </span>
                <select
                  aria-label="Select active delayed-payment case"
                  value={activeCase?.id || ''}
                  onChange={(e) => setActiveCaseId(e.target.value)}
                  className="bg-transparent text-zinc-900 dark:text-zinc-100 font-semibold text-xs focus:outline-none cursor-pointer"
                >
                  {cases.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                      className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    >
                      {c.caseReference}: {c.buyerName}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-zinc-300 dark:text-zinc-700">|</span>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  As-of:
                </span>
                <input
                  type="date"
                  aria-label="Statutory calculation cutoff date"
                  value={asOfDate}
                  onChange={(e) => {
                    setAsOfDate(e.target.value);
                    handleRunAnalysis();
                  }}
                  className="bg-transparent text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsNewCaseModalOpen(true)}
                className="px-2.5 py-1 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold text-[11px] transition cursor-pointer"
              >
                + New Case
              </button>
            </div>
          </div>
        </div>

        {/* Main View Area */}
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold">Loading DuesGuard AI Compliance Engine...</p>
            </div>
          ) : !caseRecordExists(caseData) ? (
            <div className="text-center py-20">
              <p className="text-zinc-500 text-sm">No active case selected.</p>
              <button
                onClick={handleResetDemo}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-semibold cursor-pointer"
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

        {/* Footer */}
        <footer className="relative z-10 border-t border-zinc-200/60 dark:border-white/5 py-5 px-6 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong className="text-zinc-800 dark:text-zinc-200">DuesGuard AI</strong> — MSMED Act
              2006 Statutory Resolution &amp; Evidence Preparation Platform.
            </span>
            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              Policy: MSMED_ACT_2006_SEC_15_16_V2.1 · Zero-Float Deterministic Engine · Multi-Org &amp;
              Branch RBAC
            </span>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}

function caseRecordExists(data: any): data is { case: CaseRecord } {
  return data && data.case && data.case.id;
}
