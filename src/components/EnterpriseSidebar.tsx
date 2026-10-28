/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Enterprise Sidebar & Structured Workspace Header
 * Provides reusable shell components:
 *  - BrandHeader
 *  - AppSidebar (aliased as EnterpriseSidebar)
 *  - OrganizationSwitcher
 *  - BranchSwitcher
 *  - CaseSelector
 *  - WorkspaceHeader (aliased as WorkspaceTopBar)
 */

import React, { useState } from 'react';
import {
  Scale,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Plus,
  RotateCcw,
  Receipt,
  Building2,
  GitBranch,
  FolderKanban,
  Calendar,
  PanelLeftClose,
  PanelLeftOpen,
  UserCheck,
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

export interface BrandHeaderProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelectHome: () => void;
  onCloseMobile?: () => void;
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({
  collapsed = false,
  onToggleCollapse,
  onSelectHome,
  onCloseMobile,
}) => {
  return (
    <div
      className={`h-15 border-b border-slate-200/80 dark:border-zinc-800/80 flex items-center ${
        collapsed ? 'justify-center px-2' : 'justify-between px-4'
      }`}
    >
      <button
        type="button"
        onClick={onSelectHome}
        className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer group focus:outline-none"
        title="DuesGuard AI — MSME Payment Intelligence"
      >
        <span className="w-8 h-8 rounded-md bg-slate-900 dark:bg-zinc-800 border border-slate-800 dark:border-zinc-700 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-slate-800 transition-colors">
          <Scale className="w-4 h-4 text-indigo-400" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-100 block leading-tight truncate">
              DuesGuard AI
            </span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 block leading-tight truncate mt-0.5">
              MSME Payment Intelligence
            </span>
          </div>
        )}
      </button>

      {!collapsed && onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="hidden lg:flex p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      )}

      {onCloseMobile && (
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export interface EnterpriseSidebarProps {
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
  overview: 'Workspace',
  erp: 'Billing & Receivables',
  msmed: 'Evidence & Compliance',
  workflow: 'Case Management',
  platform: 'System & Administration',
};

export const AppSidebar: React.FC<EnterpriseSidebarProps> = ({
  tabs = [],
  activeTab,
  onSelectTab,
  onLogout,
  userName,
  userRole,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const groups: Array<SidebarNavItem['group']> = [
    'overview',
    'erp',
    'msmed',
    'workflow',
    'platform',
  ];

  const displayRole =
    userRole && ROLE_LABELS[userRole as keyof typeof ROLE_LABELS]
      ? ROLE_LABELS[userRole as keyof typeof ROLE_LABELS]
      : userRole || 'Case Reviewer';

  const renderSidebarContent = (collapsedMode: boolean) => (
    <div
      className={`flex flex-col h-full bg-white dark:bg-zinc-950 border-r border-slate-200/90 dark:border-zinc-800/90 select-none transition-all duration-200 ${
        collapsedMode ? 'w-16' : 'w-60'
      } shrink-0`}
    >
      {/* Dedicated Brand Area */}
      <BrandHeader
        collapsed={collapsedMode}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        onSelectHome={() => {
          onSelectTab('dashboard');
          onCloseMobile();
        }}
        onCloseMobile={onCloseMobile}
      />

      {collapsedMode && (
        <div className="hidden lg:flex justify-center py-2 border-b border-slate-200/60 dark:border-zinc-800/60">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Logical Navigation Groups */}
      <nav
        aria-label="Primary Workspace Navigation"
        data-testid="floating-pill-navbar"
        className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4"
      >
        {groups.map((grp, groupIndex) => {
          const items = tabs.filter((t) => t.group === grp);
          if (items.length === 0) return null;

          return (
            <div
              key={grp}
              className={
                groupIndex > 0
                  ? 'pt-3 border-t border-slate-200/60 dark:border-zinc-800/60 space-y-0.5'
                  : 'space-y-0.5'
              }
            >
              {!collapsedMode && (
                <div className="px-2.5 pb-1.5 text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                  {GROUP_LABELS[grp]}
                </div>
              )}

              {items.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const showCount = typeof tab.count === 'number' && tab.count > 0;
                const displayLabel =
                  tab.id === 'review' ? 'Human Review' : tab.label;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`nav-tab-${tab.id}`}
                    title={collapsedMode ? displayLabel : undefined}
                    onClick={() => {
                      onSelectTab(tab.id);
                      onCloseMobile();
                    }}
                    className={`relative w-full h-9.5 px-2.5 rounded-md text-xs transition-colors flex items-center ${
                      collapsedMode ? 'justify-center' : 'justify-between'
                    } gap-2 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-slate-100/90 dark:bg-zinc-800/90 text-slate-900 dark:text-white font-semibold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-indigo-600 dark:before:bg-indigo-400'
                        : 'font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-400 dark:text-zinc-500'
                        }`}
                      />
                      {!collapsedMode && (
                        <span className="truncate">{displayLabel}</span>
                      )}
                    </span>

                    {!collapsedMode && showCount && (
                      <span
                        className={`text-[11px] font-mono tabular-nums shrink-0 ${
                          isActive
                            ? 'text-slate-700 dark:text-zinc-300 font-semibold'
                            : 'text-slate-400 dark:text-zinc-500'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}

                    {!collapsedMode && tab.badge && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                          tab.badge === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
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

      {/* Clean User Profile & Account Footer */}
      <div className="p-2.5 border-t border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40 space-y-2">
        {!collapsedMode ? (
          <>
            <div className="px-2 py-1.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onSelectTab('auth-workspaces');
                  onCloseMobile();
                }}
                className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
                title="Manage workspace account & roles"
              >
                <span className="w-7 h-7 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center shrink-0">
                  {(userName || 'Ananya').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {userName || 'Ananya Sundaram'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                    {displayRole}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                data-testid="floating-theme-toggle-btn"
                aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
                title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={onLogout}
              data-testid="header-logout-btn"
              className="w-full h-8 px-2.5 rounded-md text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50/80 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>Sign out</span>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              title="Toggle color theme"
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-600" />
              )}
            </button>
            <button
              type="button"
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-zinc-400 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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
        {renderSidebarContent(isCollapsed)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{renderSidebarContent(false)}</div>
        </div>
      )}
    </>
  );
};

export const EnterpriseSidebar = AppSidebar;

/* ============================================================================
 * REUSABLE HEADER SWITCHERS (OrganizationSwitcher, BranchSwitcher, CaseSelector)
 * ============================================================================ */

export interface OrganizationSwitcherProps {
  workspaceSession: ActiveWorkspaceSession | null;
  onSwitchOrganization: (organizationId: string) => void;
}

export const OrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({
  workspaceSession,
  onSwitchOrganization,
}) => {
  const activeOrg = workspaceSession?.activeOrganization;
  const accessibleOrgs = workspaceSession?.accessibleOrganizations || [];

  return (
    <div className="inline-flex items-center gap-1.5 h-9 bg-slate-50 dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-md px-2.5">
      <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
      <span className="text-[11px] text-slate-500 dark:text-zinc-400 hidden sm:inline">
        Org:
      </span>
      <select
        aria-label="Switch Active Organization Workspace"
        data-testid="header-org-switcher"
        value={activeOrg?.id || ''}
        onChange={(e) => onSwitchOrganization(e.target.value)}
        className="bg-transparent text-slate-800 dark:text-zinc-100 font-medium text-xs focus:outline-none cursor-pointer pr-1"
      >
        {accessibleOrgs.map(({ organization, role }) => (
          <option
            key={organization.id}
            value={organization.id}
            className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
          >
            {organization.displayName} ({ROLE_LABELS[role]})
          </option>
        ))}
      </select>
    </div>
  );
};

export interface BranchSwitcherProps {
  workspaceSession: ActiveWorkspaceSession | null;
  onSwitchBranch: (organizationId: string, branchId: string) => void;
}

export const BranchSwitcher: React.FC<BranchSwitcherProps> = ({
  workspaceSession,
  onSwitchBranch,
}) => {
  const activeOrg = workspaceSession?.activeOrganization;
  if (!activeOrg) return null;

  const accessibleOrgs = workspaceSession?.accessibleOrganizations || [];
  const activeOrgMembership = accessibleOrgs.find(
    (a) => a.organization.id === activeOrg.id
  );

  return (
    <div className="hidden md:inline-flex items-center gap-1.5 h-9 bg-slate-50 dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-md px-2.5">
      <GitBranch className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
      <span className="text-[11px] text-slate-500 dark:text-zinc-400">Branch:</span>
      <select
        aria-label="Switch Active Operating Branch"
        data-testid="header-branch-switcher"
        value={workspaceSession?.activeBranchId || ''}
        onChange={(e) => onSwitchBranch(activeOrg.id, e.target.value)}
        className="bg-transparent text-slate-800 dark:text-zinc-100 font-medium text-xs focus:outline-none cursor-pointer pr-1"
      >
        {activeOrgMembership?.allBranchesAccess && (
          <option
            value="ALL_BRANCHES"
            className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
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
              className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            >
              {b.branchName} ({b.city})
            </option>
          ))}
      </select>
    </div>
  );
};

export interface CaseSelectorProps {
  cases: CaseRecord[];
  activeCase: CaseRecord | null;
  onSelectCase: (caseId: string) => void;
}

export const CaseSelector: React.FC<CaseSelectorProps> = ({
  cases,
  activeCase,
  onSelectCase,
}) => {
  return (
    <div className="inline-flex items-center gap-1.5 h-8 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-md px-2.5">
      <FolderKanban className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
      <span className="text-[11px] text-slate-500 dark:text-zinc-400">Active Case:</span>
      <select
        aria-label="Select active delayed-payment case"
        value={activeCase?.id || ''}
        onChange={(e) => onSelectCase(e.target.value)}
        className="bg-transparent text-slate-800 dark:text-zinc-100 font-medium text-xs focus:outline-none cursor-pointer pr-1"
      >
        {cases.map((c) => (
          <option
            key={c.id}
            value={c.id}
            className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
          >
            {c.caseReference} — {c.buyerName}
          </option>
        ))}
      </select>
    </div>
  );
};

/* ============================================================================
 * WORKSPACE HEADER (Two-Tier Structured Enterprise Header)
 * ============================================================================ */

export interface WorkspaceTopBarProps {
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
  onOpenAccountSettings?: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceTopBarProps> = ({
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
  onOpenAccountSettings,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-slate-200/90 dark:border-zinc-800/90">
      {/* Row 1: Primary Header — Breadcrumb, Organization Selector, Branch Selector, Account Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
        {/* Left: Mobile Menu & Breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation sidebar"
            className="lg:hidden h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>

          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs truncate">
            <span className="text-slate-400 dark:text-zinc-500 hidden sm:inline">
              Workspace
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-zinc-700 hidden sm:inline">
              /
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
              {activeTabLabel}
            </span>
          </nav>
        </div>

        {/* Right: Organization Selector, Branch Selector, Theme & User Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <OrganizationSwitcher
            workspaceSession={workspaceSession}
            onSwitchOrganization={(orgId) => onQuickSwitchWorkspace(orgId)}
          />

          <BranchSwitcher
            workspaceSession={workspaceSession}
            onSwitchBranch={(orgId, branchId) => onQuickSwitchWorkspace(orgId, branchId)}
          />

          <button
            type="button"
            onClick={toggleTheme}
            data-testid="dashboard-theme-toggle-btn"
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {workspaceSession && (
            <button
              type="button"
              onClick={onOpenAccountSettings}
              data-testid="header-user-identity-btn"
              title="Workspace account & role settings"
              className="hidden sm:inline-flex items-center gap-2 h-9 px-2.5 rounded-md border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              <span className="truncate max-w-[120px]">
                {workspaceSession.user.fullName}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Secondary Context Bar — Active Case Selector, As-of Date & Quick Workspace Actions */}
      <div className="border-t border-slate-200/60 dark:border-zinc-800/60 bg-slate-50/70 dark:bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* Left: Case Selector & As-of Date */}
          <div className="flex flex-wrap items-center gap-2">
            <CaseSelector
              cases={cases}
              activeCase={activeCase}
              onSelectCase={onSelectCase}
            />

            <div className="inline-flex items-center gap-1.5 h-8 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-md px-2.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                As-of Date:
              </span>
              <input
                type="date"
                aria-label="Statutory calculation cutoff date"
                value={asOfDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-transparent text-xs font-mono tabular-nums font-medium text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Right: Secondary Context Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenGenerateInvoice}
              data-testid="topbar-generate-invoice-btn"
              className="h-8 px-3 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-medium text-xs transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>New GST Invoice</span>
            </button>

            <button
              type="button"
              onClick={onOpenNewCaseModal}
              className="h-8 px-2.5 rounded-md bg-white hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-800 font-medium text-xs transition-colors inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Case</span>
            </button>

            <button
              type="button"
              onClick={onResetDemo}
              title="Reset to default synthetic case dataset"
              aria-label="Reset to InnoSprint demo dataset"
              className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-white hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200/90 dark:border-zinc-800 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export const WorkspaceTopBar = WorkspaceHeader;
