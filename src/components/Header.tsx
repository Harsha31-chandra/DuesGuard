/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ShieldCheck,
  RotateCcw,
  PlusCircle,
  AlertTriangle,
  Scale,
  Calendar,
  Building2,
  GitBranch,
  UserCheck,
  LogOut,
  LogIn,
} from 'lucide-react';
import type { ActiveWorkspaceSession, CaseRecord } from '../types/index.ts';
import { ROLE_LABELS } from '../services/workspaceAuth.ts';

interface HeaderProps {
  cases: CaseRecord[];
  activeCase: CaseRecord | null;
  onSelectCase: (caseId: string) => void;
  onNewCase: () => void;
  onResetDemo: () => void;
  asOfDate: string;
  onDateChange: (date: string) => void;
  isAnalyzing: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  workspaceSession: ActiveWorkspaceSession | null;
  onQuickSwitchWorkspace: (organizationId: string, branchId?: string) => void;
  onOpenAuthPortal: () => void;
  isLoggedOut: boolean;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cases,
  activeCase,
  onSelectCase,
  onNewCase,
  onResetDemo,
  asOfDate,
  onDateChange,
  approvalStatus,
  workspaceSession,
  onQuickSwitchWorkspace,
  onOpenAuthPortal,
  isLoggedOut,
  onLogout,
  onOpenLogin,
}) => {
  const activeOrg = workspaceSession?.activeOrganization;
  const accessibleOrgs = workspaceSession?.accessibleOrganizations || [];
  const activeOrgMembership = accessibleOrgs.find((a) => a.organization.id === activeOrg?.id);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
      {/* Top Regulatory & Multi-Organization Workspace Switcher Bar */}
      <div className="bg-slate-950 border-b border-slate-800/80 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-300">
        {/* Persistent Multi-Organization & Branch Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {!isLoggedOut && (
            <>
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-md px-2 py-0.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-slate-400 text-[11px]">Org:</span>
                <select
                  aria-label="Switch Active Organization Workspace"
                  data-testid="header-org-switcher"
                  value={activeOrg?.id || ''}
                  onChange={(e) => onQuickSwitchWorkspace(e.target.value)}
                  className="bg-slate-900 text-white font-semibold text-xs focus:outline-none cursor-pointer"
                >
                  {accessibleOrgs.map(({ organization, role }) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.displayName} ({ROLE_LABELS[role]})
                    </option>
                  ))}
                </select>
              </div>

              {activeOrg && (
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-md px-2 py-0.5">
                  <GitBranch className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-slate-400 text-[11px]">Branch:</span>
                  <select
                    aria-label="Switch Active Operating Branch"
                    data-testid="header-branch-switcher"
                    value={workspaceSession?.activeBranchId || ''}
                    onChange={(e) => onQuickSwitchWorkspace(activeOrg.id, e.target.value)}
                    className="bg-slate-900 text-white font-semibold text-xs focus:outline-none cursor-pointer"
                  >
                    {activeOrgMembership?.allBranchesAccess && (
                      <option value="ALL_BRANCHES">All Branches ({activeOrg.branches.length})</option>
                    )}
                    {activeOrg.branches
                      .filter(
                        (b) =>
                          activeOrgMembership?.allBranchesAccess ||
                          activeOrgMembership?.allowedBranchIds.includes(b.id)
                      )
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.branchName} ({b.city})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </>
          )}

          {!isLoggedOut && workspaceSession ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenAuthPortal}
                data-testid="header-user-identity-btn"
                title="Click to switch organizations, branches, or account settings"
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-800/70 text-[11px] font-medium transition cursor-pointer"
              >
                <UserCheck className="w-3 h-3 text-indigo-400" />
                <span>{workspaceSession.user.fullName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-indigo-300">{ROLE_LABELS[workspaceSession.activeRole]}</span>
              </button>

              <button
                onClick={onLogout}
                data-testid="header-logout-btn"
                title="Sign out of DuesGuard AI and return to the Login screen"
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-950/90 hover:bg-rose-900 text-rose-200 border border-rose-800/80 text-[11px] font-semibold transition cursor-pointer"
              >
                <LogOut className="w-3 h-3 text-rose-400" />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              data-testid="header-login-btn"
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition cursor-pointer"
            >
              <LogIn className="w-3 h-3" />
              <span>Sign In to Workspace</span>
            </button>
          )}
        </div>

        {/* Statutory Cut-off Date & Gate Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400 hidden md:inline">As-of Date:</span>
            <input
              type="date"
              aria-label="Statutory calculation cutoff date"
              value={asOfDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {approvalStatus === 'approved' ? (
              <span className="inline-flex items-center gap-1 text-emerald-300 text-[11px] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Audit Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-300 text-[11px] font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Review Gate Active
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center border border-indigo-400/30">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                DuesGuard <span className="text-indigo-400 font-extrabold">AI</span>
              </h1>
              {activeOrg && (
                <span className="text-xs text-slate-400 hidden sm:inline">
                  · {activeOrg.legalName} ({activeOrg.maskedGstin})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              From Delayed Payments to Evidence-Ready Resolution · MSMED Act 2006 §§ 15–16 (3× RBI Rate @ 20.25% p.a.)
            </p>
          </div>
        </div>

        {/* Case selector & Quick actions */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center bg-slate-800/80 rounded-lg p-1 border border-slate-700">
            <span className="text-xs text-slate-400 px-2 font-medium">Case:</span>
            <select
              aria-label="Select active delayed-payment case"
              value={activeCase?.id || ''}
              onChange={(e) => onSelectCase(e.target.value)}
              className="bg-slate-900 border-none text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseReference}: {c.buyerName} ({c.businessName})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onNewCase}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            aria-label="Create New Dispute Case"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Case</span>
          </button>

          <button
            onClick={onResetDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition cursor-pointer"
            title="Reset to official InnoSprint synthetic test pack"
            aria-label="Reset to InnoSprint demo dataset"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset Demo Pack</span>
          </button>
        </div>
      </div>
    </header>
  );
};
