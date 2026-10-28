/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Enterprise SaaS Workspace Sidebar & Contextual Top Header
 * Implements the SaaS Dashboard Design Guidelines:
 *  - Left Sidebar Navigation (264px desktop, responsive slide-over on mobile)
 *  - Categorized workflow navigation uniting ERP GST Billing, Reminders, and MSMED Dispute Resolution
 */

import React from 'react';
import {
  Scale,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  PlusCircle,
  RotateCcw,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from './ThemeProvider.tsx';
import type { ActiveWorkspaceSession, CaseRecord } from '../types/index.ts';
import { ROLE_LABELS } from '../services/workspaceAuth.ts';

export interface SidebarNavItem {
  id: string;
  label: string;
  group: 'overview' | 'erp' | 'msmed' | 'workflow' | 'platform';
  icon: LucideIcon;
  count?: number;
  badge?: string;
}

interface EnterpriseSidebarProps {
  tabs: SidebarNavItem[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onLogout: () => void;
  userName?: string;
  userRole?: string;
  activeOrgName?: string;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const GROUP_LABELS: Record<SidebarNavItem['group'], string> = {
  overview: 'Command Center',
  erp: 'Billing, ERP & Receivables',
  msmed: 'MSMED Evidence & Finance',
  workflow: 'Agentic ODR & Review',
  platform: 'Workspace & Architecture',
};

export const EnterpriseSidebar: React.FC<EnterpriseSidebarProps> = ({
  tabs = [],
  activeTab,
  onSelectTab,
  onLogout,
  userName,
  userRole,
  activeOrgName,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const groups: Array<SidebarNavItem['group']> = ['overview', 'erp', 'msmed', 'workflow', 'platform'];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-[#0c0d12] border-r border-zinc-200/80 dark:border-zinc-800/80 w-64 shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80">
        <button
          type="button"
          onClick={() => {
            onSelectTab('dashboard');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left cursor-pointer"
        >
          <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4" />
          </span>
          <div>
            <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-white block leading-none">
              DuesGuard AI
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5 truncate max-w-[155px]">
              {activeOrgName || 'MSMED Resolution Suite'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Categorized Navigation Links */}
      <nav
        aria-label="Primary Workspace Navigation"
        data-testid="floating-pill-navbar"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-5"
      >
        {groups.map((grp) => {
          const items = tabs.filter((t) => t.group === grp);
          if (items.length === 0) return null;
          return (
            <div key={grp} className="space-y-1">
              <div className="px-2.5 pb-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-wide">
                {GROUP_LABELS[grp]}
              </div>
              {items.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`nav-tab-${tab.id}`}
                    onClick={() => {
                      onSelectTab(tab.id);
                      onCloseMobile();
                    }}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between gap-2 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? 'text-white'
                            : 'text-zinc-400 dark:text-zinc-500'
                        }`}
                      />
                      <span className="truncate">{tab.label}</span>
                    </span>

                    {tab.count !== undefined && (
                      <span
                        className={`text-[11px] font-mono tabular-nums shrink-0 ${
                          isActive
                            ? 'text-indigo-100'
                            : 'text-zinc-400 dark:text-zinc-500'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}

                    {tab.badge && (
                      <span
                        className={`text-[10px] font-mono shrink-0 ${
                          isActive
                            ? 'text-indigo-100'
                            : tab.badge === 'Approved'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Footer: Account, Theme Toggle & Log Out */}
      <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
        <div className="px-2.5 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {userName || 'Harsha Vardhan'}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {userRole || 'Case Reviewer'}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            data-testid="floating-theme-toggle-btn"
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onLogout}
          data-testid="header-logout-btn"
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/15 transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out of Workspace</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Permanent Sidebar */}
      <aside
        data-testid="enterprise-sidebar"
        className="hidden lg:block sticky top-0 h-screen z-30"
      >
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{renderSidebarContent()}</div>
        </div>
      )}
    </>
  );
};

interface WorkspaceTopBarProps {
  activeTabLabel: string;
  workspaceSession: ActiveWorkspaceSession | null;
  cases: CaseRecord[];
  activeCase: CaseRecord | null;
  asOfDate: string;
  onSelectCase: (caseId: string) => void;
  onDateChange: (date: string) => void;
  onQuickSwitchWorkspace: (organizationId: string, branchId?: string) => void;
  onOpenNewCaseModal: () => void;
  onOpenGenerateInvoice: () => void;
  onResetDemo: () => void;
  onOpenMobileMenu: () => void;
}

export const WorkspaceTopBar: React.FC<WorkspaceTopBarProps> = ({
  activeTabLabel,
  workspaceSession,
  cases,
  activeCase,
  asOfDate,
  onSelectCase,
  onDateChange,
  onQuickSwitchWorkspace,
  onOpenNewCaseModal,
  onOpenGenerateInvoice,
  onResetDemo,
  onOpenMobileMenu,
}) => {
  const activeOrg = workspaceSession?.activeOrganization;
  const accessibleOrgs = workspaceSession?.accessibleOrganizations || [];
  const activeOrgMembership = accessibleOrgs.find((a) => a.organization.id === activeOrg?.id);

  return (
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-[#0c0d12]/90 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left Zone: Mobile Menu + Breadcrumb + Workspace / Branch / Case Selectors */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation sidebar"
            className="lg:hidden p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 cursor-pointer"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 font-medium">
            <span className="text-zinc-900 dark:text-zinc-100 font-semibold whitespace-nowrap">
              {activeTabLabel}
            </span>
            <span aria-hidden="true">/</span>
          </div>

          {/* Organization Selector */}
          <div className="flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg px-2.5 py-1">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Org:</span>
            <select
              aria-label="Switch Active Organization Workspace"
              data-testid="header-org-switcher"
              value={activeOrg?.id || ''}
              onChange={(e) => onQuickSwitchWorkspace(e.target.value)}
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

          {/* Branch Selector */}
          {activeOrg && (
            <div className="hidden md:flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg px-2.5 py-1">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Branch:</span>
              <select
                aria-label="Switch Active Operating Branch"
                data-testid="header-branch-switcher"
                value={workspaceSession?.activeBranchId || ''}
                onChange={(e) => onQuickSwitchWorkspace(activeOrg.id, e.target.value)}
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

          {/* Active Case Selector */}
          <div className="flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg px-2.5 py-1">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Case:</span>
            <select
              aria-label="Select active delayed-payment case"
              value={activeCase?.id || ''}
              onChange={(e) => onSelectCase(e.target.value)}
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

          {/* As-Of Cutoff Date */}
          <div className="hidden xl:flex items-center gap-1.5 bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg px-2.5 py-1">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">As-of:</span>
            <input
              type="date"
              aria-label="Statutory calculation cutoff date"
              value={asOfDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-xs font-mono tabular-nums font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Right Zone: Primary Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenGenerateInvoice}
            data-testid="topbar-generate-invoice-btn"
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>+ GST Invoice</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewCaseModal}
            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs transition flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Case</span>
          </button>

          <button
            type="button"
            onClick={onResetDemo}
            title="Reset to official InnoSprint synthetic test pack"
            aria-label="Reset to InnoSprint demo dataset"
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
