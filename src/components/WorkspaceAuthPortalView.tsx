/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Authentication & Multi-Organization / Multi-Branch Access Module
 * Relationship: ONE USER -> MANY ORGANIZATIONS -> MANY BRANCHES
 */

import React, { useState, useEffect } from 'react';
import {
  Building2,
  GitBranch,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  UserPlus,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  ArrowRight,
  Users,
  Scale,
  Smartphone,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import type {
  ActiveWorkspaceSession,
  OrganizationActionPermission,
  OrganizationMemberRecord,
  OrganizationRecord,
  OrganizationRole,
} from '../types/index.ts';
import {
  evaluatePasswordStrength,
  ROLE_LABELS,
  ROLE_PERMISSION_MATRIX,
  validateUdyamNumberSyntax,
} from '../services/workspaceAuth.ts';
import { validateGstin } from '../services/finance.ts';

export type AuthRouteTab =
  | 'select-workspace'
  | 'login'
  | 'register'
  | 'recovery-2fa'
  | 'onboarding'
  | 'rbac-members';

interface WorkspaceAuthPortalViewProps {
  workspaceSession: ActiveWorkspaceSession | null;
  onSessionUpdated: (session: ActiveWorkspaceSession) => void;
  onNavigateToDashboard: () => void;
  initialRoute?: AuthRouteTab;
  isLoggedOut?: boolean;
  onLogout?: () => void;
}

export const WorkspaceAuthPortalView: React.FC<WorkspaceAuthPortalViewProps> = ({
  workspaceSession,
  onSessionUpdated,
  onNavigateToDashboard,
  initialRoute,
  isLoggedOut = false,
  onLogout,
}) => {
  const [activeRoute, setActiveRoute] = useState<AuthRouteTab>(
    isLoggedOut ? 'login' : initialRoute || 'select-workspace'
  );
  const [orgSearch, setOrgSearch] = useState('');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(
    isLoggedOut
      ? {
          type: 'info',
          text: 'You are currently signed out. Sign in below using your business email and password (or click a Quick-Fill Test Identity).',
        }
      : null
  );

  useEffect(() => {
    if (isLoggedOut) {
      setActiveRoute('login');
      setStatusBanner({
        type: 'info',
        text: 'You have signed out of DuesGuard AI. Sign in below or select a Quick-Fill Test Identity.',
      });
    } else if (initialRoute) {
      setActiveRoute(initialRoute);
    }
  }, [isLoggedOut, initialRoute]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('harsha@duesguard.in');
  const [loginPassword, setLoginPassword] = useState('DuesGuard@2026!');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Registration form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regMobile, setRegMobile] = useState('+91 ');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regTerms, setRegTerms] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Password Recovery, Email Verification & 2FA state
  const [forgotEmail, setForgotEmail] = useState('harsha@duesguard.in');
  const [issuedResetToken, setIssuedResetToken] = useState('');
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [verifyEmailAddress, setVerifyEmailAddress] = useState('rohan.pending@msme.in');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [totpCode, setTotpCode] = useState('482910');

  // Organization & Branch Onboarding state
  const [onboardLegalName, setOnboardLegalName] = useState('Kaveri Industrial Fasteners Pvt. Ltd.');
  const [onboardDisplayName, setOnboardDisplayName] = useState('Kaveri Fasteners');
  const [onboardType, setOnboardType] =
    useState<OrganizationRecord['organizationType']>('Micro Manufacturing');
  const [onboardGstin, setOnboardGstin] = useState('29AABCK5512R1Z2');
  const [onboardUdyam, setOnboardUdyam] = useState('UDYAM-KR-08-0091234');
  const [onboardUdyamDate, setOnboardUdyamDate] = useState('2022-05-12');
  const [onboardAddress, setOnboardAddress] = useState(
    'Plot 88, Bommasandra Industrial Area, Hosur Road, Bengaluru 560099'
  );
  const [onboardEmail, setOnboardEmail] = useState('accounts@kaverifasteners.in');
  const [onboardPhone, setOnboardPhone] = useState('+91 80 2783 9901');
  const [onboardBranchName, setOnboardBranchName] = useState('Bommasandra Plant 1');
  const [onboardCity, setOnboardCity] = useState('Bengaluru');
  const [onboardState, setOnboardState] = useState('Karnataka');
  const [onboardPincode, setOnboardPincode] = useState('560099');

  // Add Branch to active org state
  const [newBranchName, setNewBranchName] = useState('Tirupati Industrial Branch');
  const [newBranchAddress, setNewBranchAddress] = useState('Renigunta Industrial Corridor, Shed 14');
  const [newBranchCity, setNewBranchCity] = useState('Tirupati');
  const [newBranchState, setNewBranchState] = useState('Andhra Pradesh');
  const [newBranchPincode, setNewBranchPincode] = useState('517520');

  // RBAC & Member Management state
  const [members, setMembers] = useState<OrganizationMemberRecord[]>([]);
  const [inviteEmail, setInviteEmail] = useState('suresh.accounts@abcmanufacturing.co.in');
  const [inviteName, setInviteName] = useState('Suresh Babu (Senior Accountant)');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('accountant');
  const [inviteAllBranches, setInviteAllBranches] = useState(false);

  // Permission Verifier state
  const [testAction, setTestAction] = useState<OrganizationActionPermission>('report:approve');
  const [testTargetOrgId, setTestTargetOrgId] = useState('org-xyz-003');
  const [testTargetBranchId, setTestTargetBranchId] = useState('br-vizag-02');
  const [permCheckResult, setPermCheckResult] = useState<{
    allowed: boolean;
    httpStatus: number;
    role?: string;
    reason: string;
  } | null>(null);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (workspaceSession?.activeOrganization?.id) {
      fetch(`/api/organizations/${workspaceSession.activeOrganization.id}/members`)
        .then((r) => r.json())
        .then((data) => setMembers(data))
        .catch(() => {});
    }
  }, [workspaceSession?.activeOrganization?.id]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        onSessionUpdated(data.session);
        setStatusBanner({
          type: 'success',
          text: data.autoSelectWorkspace
            ? `${data.message} Only 1 organization found — automatically opened ${data.session.activeOrganization.displayName}.`
            : `${data.message} Select your active company and branch workspace below.`,
        });
        setActiveRoute('select-workspace');
      } else {
        setStatusBanner({ type: 'error', text: data.message || 'Sign in failed.' });
        if (data.code === 'EMAIL_UNVERIFIED') {
          setVerifyEmailAddress(loginEmail);
        }
      }
    } catch {
      setStatusBanner({ type: 'error', text: 'Network error while communicating with authentication service.' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regFullName,
          email: regEmail,
          mobileNumber: regMobile,
          password: regPassword,
          confirmPassword: regConfirmPassword,
          acceptedTerms: regTerms,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVerifyEmailAddress(regEmail);
        setStatusBanner({ type: 'success', text: data.message });
        setActiveRoute('recovery-2fa');
      } else {
        setStatusBanner({ type: 'error', text: data.message });
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSwitchWorkspace = async (organizationId: string, branchId?: string) => {
    setStatusBanner(null);
    const res = await fetch('/api/workspaces/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, branchId }),
    });
    const data = await res.json();
    if (data.success && data.session) {
      onSessionUpdated(data.session);
      setStatusBanner({ type: 'success', text: data.message });
    } else {
      setStatusBanner({ type: 'error', text: data.message });
    }
  };

  const handleOnboardOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);
    const res = await fetch('/api/organizations/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legalName: onboardLegalName,
        displayName: onboardDisplayName,
        organizationType: onboardType,
        gstin: onboardGstin,
        udyamNumber: onboardUdyam,
        udyamRegistrationDate: onboardUdyamDate,
        registeredAddress: onboardAddress,
        contactEmail: onboardEmail,
        contactPhone: onboardPhone,
        branchName: onboardBranchName,
        branchAddress: onboardAddress,
        city: onboardCity,
        state: onboardState,
        pincode: onboardPincode,
      }),
    });
    const data = await res.json();
    if (data.success && data.session) {
      onSessionUpdated(data.session);
      setStatusBanner({
        type: 'success',
        text: `${data.message} ${data.warnings?.join(' ') || ''}`,
      });
      setActiveRoute('select-workspace');
    } else {
      setStatusBanner({ type: 'error', text: data.message });
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceSession) return;
    const res = await fetch(`/api/organizations/${workspaceSession.activeOrganization.id}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchName: newBranchName,
        address: newBranchAddress,
        city: newBranchCity,
        state: newBranchState,
        pincode: newBranchPincode,
      }),
    });
    const data = await res.json();
    if (data.success && data.session) {
      onSessionUpdated(data.session);
      setStatusBanner({ type: 'success', text: data.message });
    } else {
      setStatusBanner({ type: 'error', text: data.message });
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceSession) return;
    const activeOrg = workspaceSession.activeOrganization;
    const res = await fetch(`/api/organizations/${activeOrg.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inviteEmail,
        fullName: inviteName,
        role: inviteRole,
        allBranchesAccess: inviteAllBranches,
        allowedBranchIds: inviteAllBranches
          ? activeOrg.branches.map((b) => b.id)
          : [activeOrg.branches[0]?.id].filter(Boolean),
      }),
    });
    const data = await res.json();
    if (data.members) setMembers(data.members);
    setStatusBanner({
      type: data.success ? 'success' : 'error',
      text: data.message,
    });
  };

  const handleRunPermissionTest = async () => {
    const res = await fetch('/api/workspaces/check-permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: testTargetOrgId,
        branchId: testTargetBranchId,
        action: testAction,
      }),
    });
    const data = await res.json();
    setPermCheckResult(data);
  };

  const regPasswordEval = evaluatePasswordStrength(regPassword);
  const resetPasswordEval = evaluatePasswordStrength(newResetPassword);
  const liveGstinValidation = onboardGstin.trim() ? validateGstin(onboardGstin.trim()) : null;
  const liveUdyamValidation = validateUdyamNumberSyntax(onboardUdyam);

  const accessibleOrgs = workspaceSession?.accessibleOrganizations || [];
  const filteredOrgs = accessibleOrgs.filter(
    (item) =>
      item.organization.legalName.toLowerCase().includes(orgSearch.toLowerCase()) ||
      item.organization.displayName.toLowerCase().includes(orgSearch.toLowerCase()) ||
      (item.organization.gstin || '').toLowerCase().includes(orgSearch.toLowerCase())
  );

  const activeOrgMembership = accessibleOrgs.find(
    (a) => a.organization.id === workspaceSession?.activeOrganization.id
  );

  return (
    <div className="space-y-6">
      {/* Module Top Header & Route Switcher */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-indigo-400 tracking-wide mb-1">
              Better Auth · Multi-Organization & Multi-Branch Access Architecture
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              One User Identity → Multiple Organizations → Multiple Branches
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              Manage multiple legally distinct MSMEs with separate GSTINs, Udyam registrations, branch locations, and
              role-based permissions under a single unified login.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            {[
              { id: 'select-workspace', label: '1. Select Workspace & Branch', icon: Building2 },
              { id: 'login', label: '2. Split-Screen Login', icon: Lock },
              { id: 'register', label: '3. Register Account', icon: UserPlus },
              { id: 'recovery-2fa', label: '4. Password Reset & 2FA', icon: KeyRound },
              { id: 'onboarding', label: '5. Onboard Org & Branch', icon: Plus },
              { id: 'rbac-members', label: '6. RBAC & Security Gate', icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeRoute === tab.id;
              return (
                <button
                  key={tab.id}
                  data-testid={`auth-route-${tab.id}`}
                  onClick={() => {
                    setStatusBanner(null);
                    setActiveRoute(tab.id as AuthRouteTab);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status Notification Banner */}
      {statusBanner && (
        <div
          data-testid="auth-status-banner"
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : statusBanner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : 'bg-indigo-50 border-indigo-200 text-indigo-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button
            onClick={() => setStatusBanner(null)}
            className="text-slate-500 hover:text-slate-800 font-semibold px-2 py-0.5 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ROUTE 1: MULTI-ORGANIZATION & BRANCH SELECTION (/select-workspace & /select-branch) */}
      {activeRoute === 'select-workspace' && workspaceSession && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Organization Selector Column */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Select Organization Workspace ({accessibleOrgs.length} Accessible)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Signed in as <strong>{workspaceSession.user.fullName}</strong> ({workspaceSession.user.email}) · Switch
                  companies without logging out.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveRoute('onboarding')}
                  data-testid="open-onboard-org-btn"
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Organization</span>
                </button>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    data-testid="workspace-logout-btn"
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                placeholder="Search organizations by legal name, trade name, or GSTIN..."
                className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>

            {/* Organization List */}
            <div className="space-y-3">
              {filteredOrgs.map(({ organization, role, allBranchesAccess, allowedBranchIds }) => {
                const isSelected = organization.id === workspaceSession.activeOrganization.id;
                const initials = organization.displayName
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={organization.id}
                    data-testid={`org-card-${organization.id}`}
                    className={`p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'
                          }`}
                        >
                          {initials}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">{organization.legalName}</span>
                            <span className="text-xs text-slate-500">·</span>
                            <span className="text-xs font-semibold text-indigo-700">{ROLE_LABELS[role]}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                            <span>GSTIN: {organization.maskedGstin}</span>
                            <span>·</span>
                            <span>Udyam: {organization.udyamNumber || 'Not Provided'}</span>
                            <span>·</span>
                            <span>
                              {allBranchesAccess
                                ? `${organization.branches.length} Branches (All Access)`
                                : `${allowedBranchIds.length} of ${organization.branches.length} Branches Permitted`}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600">{organization.registeredAddress}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSwitchWorkspace(organization.id)}
                        data-testid={`select-org-btn-${organization.id}`}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                        }`}
                      >
                        {isSelected ? 'Active Workspace' : 'Select Workspace'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Branch Selection Column (/select-branch) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <div className="text-xs font-mono text-indigo-600">
                Active Organization: {workspaceSession.activeOrganization.displayName}
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-slate-700" />
                Select Operating Branch
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Branch visibility and the Consolidated All-Branches view are strictly governed by your assigned
                organization and branch memberships.
              </p>
            </div>

            {/* All Branches Option */}
            {activeOrgMembership?.allBranchesAccess ? (
              <button
                onClick={() => handleSwitchWorkspace(workspaceSession.activeOrganization.id, 'ALL_BRANCHES')}
                data-testid="select-branch-ALL_BRANCHES"
                className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                  workspaceSession.activeBranchId === 'ALL_BRANCHES'
                    ? 'border-indigo-600 bg-indigo-50/40'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">All Branches (Consolidated Organization View)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Aggregates invoices, deliveries, and MSMED claims across all{' '}
                    {workspaceSession.activeOrganization.branches.length} branches
                  </div>
                </div>
                <span className="text-xs font-semibold text-indigo-600">
                  {workspaceSession.activeBranchId === 'ALL_BRANCHES' ? 'Selected' : 'Select'}
                </span>
              </button>
            ) : (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900">
                <strong>Branch-Scoped Membership Active:</strong> In{' '}
                <strong>{workspaceSession.activeOrganization.displayName}</strong>, your role (
                {ROLE_LABELS[workspaceSession.activeRole]}) is restricted to assigned branches only. The{' '}
                <em>All Branches</em> option is hidden/locked.
              </div>
            )}

            {/* Individual Branch Cards */}
            <div className="space-y-2.5">
              {workspaceSession.activeOrganization.branches.map((branch) => {
                const isPermitted =
                  activeOrgMembership?.allBranchesAccess ||
                  activeOrgMembership?.allowedBranchIds.includes(branch.id);
                const isCurrentBranch = workspaceSession.activeBranchId === branch.id;

                return (
                  <div
                    key={branch.id}
                    className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                      isCurrentBranch
                        ? 'border-indigo-600 bg-indigo-50/30'
                        : isPermitted
                        ? 'border-slate-200 bg-white'
                        : 'border-slate-200 bg-slate-50 opacity-75'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{branch.branchName}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-600">
                          {branch.city}, {branch.state} {branch.pincode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {branch.address} · {branch.caseCount} Active Dispute Cases
                      </div>
                    </div>

                    <button
                      onClick={() => handleSwitchWorkspace(workspaceSession.activeOrganization.id, branch.id)}
                      data-testid={`select-branch-${branch.id}`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                        isCurrentBranch
                          ? 'bg-indigo-600 text-white'
                          : isPermitted
                          ? 'bg-slate-900 hover:bg-slate-800 text-white'
                          : 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                      }`}
                    >
                      {isCurrentBranch ? 'Active Branch' : isPermitted ? 'Switch Branch' : 'Restricted (Test 403)'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Active Role: <strong className="text-slate-900">{ROLE_LABELS[workspaceSession.activeRole]}</strong>
              </div>
              <button
                onClick={onNavigateToDashboard}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-500 cursor-pointer"
              >
                <span>Open Case Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROUTE 2: TWO-COLUMN SPLIT-SCREEN ENTERPRISE LOGIN (/login) */}
      {activeRoute === 'login' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-white min-h-[580px]">
          {/* Left Panel — Deep Navy Brand & Product Introduction */}
          <div className="lg:col-span-6 bg-slate-900 text-white p-8 lg:p-10 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-lg font-bold tracking-tight">DuesGuard AI</div>
                  <div className="text-xs text-indigo-300">From Delayed Payments to Evidence-Ready Resolution.</div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="text-2xl font-bold tracking-tight leading-snug text-white">
                  Unified Delayed-Payment Intelligence Across Every MSME Company & Branch.
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Organize invoices, purchase orders, and delivery acknowledgements across multiple GSTINs and Udyam
                  registrations with one enterprise identity.
                </p>
              </div>

              {/* Three Mandatory Feature Highlights */}
              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-slate-800 text-indigo-400 flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                    01
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">AI-Powered Document Intelligence</div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Multimodal extraction of invoices, purchase orders, and signed proofs of delivery with page-level
                      provenance.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-slate-800 text-indigo-400 flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                    02
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Invoice and Payment Tracking</div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Deterministic zero-float decimal arithmetic for MSMED Section 15 deadlines and Section 16 (3× RBI
                      Bank Rate) monthly compounding.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md bg-slate-800 text-indigo-400 flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                    03
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Evidence-Ready Case Preparation</div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Human-reviewed discrepancy graphs and versioned PDF annexures for MSME Samadhaan / ODR resolution.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Abstract Financial Intelligence Preview Card */}
            <div className="mt-8 p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Multi-Entity Ledger Preview</span>
                <span className="font-mono text-emerald-400">3 Organizations · 8 Branches</span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
                <div>
                  <div className="text-slate-500">ABC Manufacturing</div>
                  <div className="font-mono font-semibold text-white mt-0.5">Guntur · Vijayawada · Hyd</div>
                </div>
                <div>
                  <div className="text-slate-500">XYZ Trading</div>
                  <div className="font-mono font-semibold text-white mt-0.5">Chennai · Visakhapatnam</div>
                </div>
                <div>
                  <div className="text-slate-500">Apex Precision</div>
                  <div className="font-mono font-semibold text-white mt-0.5">Bengaluru · Mysuru</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel — Enterprise Authentication Form */}
          <div className="lg:col-span-6 p-8 lg:p-10 flex flex-col justify-between bg-white">
            <div className="space-y-5">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Welcome back</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Sign in with your unified DuesGuard AI credentials to access all authorized organizations and
                  branches.
                </p>
              </div>

              {/* Demo Quick-Fill Presets */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-[11px] font-semibold text-slate-600">
                  Quick-Fill Test Identities (Verify Single vs. Multi-Organization Routing):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    data-testid="preset-harsha-btn"
                    onClick={() => {
                      setLoginEmail('harsha@duesguard.in');
                      setLoginPassword('DuesGuard@2026!');
                    }}
                    className="px-2.5 py-1 rounded bg-white border border-slate-300 hover:border-indigo-600 text-[11px] font-semibold text-slate-800 cursor-pointer"
                  >
                    Harsha (3 Companies · 8 Branches)
                  </button>
                  <button
                    type="button"
                    data-testid="preset-ananya-btn"
                    onClick={() => {
                      setLoginEmail('ananya@xyztrading.in');
                      setLoginPassword('Ananya@MSME2026!');
                    }}
                    className="px-2.5 py-1 rounded bg-white border border-slate-300 hover:border-indigo-600 text-[11px] font-semibold text-slate-800 cursor-pointer"
                  >
                    Ananya (1 Company · Auto-Open)
                  </button>
                  <button
                    type="button"
                    data-testid="preset-unverified-btn"
                    onClick={() => {
                      setLoginEmail('rohan.pending@msme.in');
                      setLoginPassword('Rohan@2026!');
                    }}
                    className="px-2.5 py-1 rounded bg-white border border-slate-300 hover:border-amber-600 text-[11px] font-semibold text-slate-800 cursor-pointer"
                  >
                    Rohan (Unverified Email Test)
                  </button>
                </div>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      data-testid="login-email-input"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="name@company.in"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => setActiveRoute('recovery-2fa')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      data-testid="login-password-input"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-9 pr-9 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                    />
                    <button
                      type="button"
                      aria-label="Toggle password visibility"
                      onClick={() => setShowLoginPassword((s) => !s)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span>Remember session for 30 days</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Turnstile Bot Protection Active</span>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  data-testid="login-submit-btn"
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  {isLoggingIn ? 'Authenticating Session...' : 'Sign In to DuesGuard AI'}
                </button>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-slate-200"></div>
                <span className="shrink mx-3 text-[11px] text-slate-400">New to DuesGuard AI?</span>
                <div className="grow border-t border-slate-200"></div>
              </div>

              <button
                type="button"
                onClick={() => setActiveRoute('register')}
                className="w-full py-2 px-4 border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Create Unified MSME Account
              </button>
            </div>

            <div className="pt-6 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100">
              <span>Protected by Better Auth & Cloudflare D1</span>
              <div className="flex items-center gap-3">
                <span>Terms of Service</span>
                <span>·</span>
                <span>Privacy Policy</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ROUTE 3: REGISTRATION & ACCOUNT CREATION (/register) */}
      {activeRoute === 'register' && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 p-6 lg:p-8 space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-900">Create Your Unified DuesGuard AI Identity</h3>
            <p className="text-xs text-slate-500 mt-1">
              Register once with your personal business email. Company GSTIN, Udyam registration, and branch locations
              are configured afterward in the Organization Onboarding workflow.
            </p>
          </div>

          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="e.g. Vikramaditya Rao"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number (with Country Code)
                </label>
                <input
                  type="tel"
                  required
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value)}
                  placeholder="+91 98480 12345"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Business Email Address</label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="vikram@company.in"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="At least 10 characters"
                    className="w-full pl-3 pr-9 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((s) => !s)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Password Strength Indicator */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Password Strength</span>
                <span className="font-mono font-bold text-slate-900">{regPasswordEval.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 h-1.5">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`rounded-full ${
                      regPasswordEval.score >= level
                        ? regPasswordEval.score >= 3
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                        : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              {regPasswordEval.feedback.length > 0 && (
                <div className="text-[11px] text-slate-500">{regPasswordEval.feedback.join(' ')}</div>
              )}
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={regTerms}
                onChange={(e) => setRegTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-300"
              />
              <span>
                I accept the DuesGuard AI Terms of Service, Privacy Notice, and Indian DPDP Act data-processing terms. I
                understand DuesGuard AI prepares financial evidence for human review and does not provide legal advice.
              </span>
            </label>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setActiveRoute('login')}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Already have an account? Sign In
              </button>
              <button
                type="submit"
                disabled={isRegistering}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {isRegistering ? 'Creating Account...' : 'Create Account & Send Verification'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ROUTE 4: PASSWORD RECOVERY, EMAIL VERIFICATION & 2FA TOTP (/recovery-2fa) */}
      {activeRoute === 'recovery-2fa' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Forgot & Reset Password */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                Forgot & Reset Password
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Uses a generic response so public endpoints never leak whether an email address belongs to an existing
                account.
              </p>
            </div>

            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-slate-700">Account Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <button
                  type="button"
                  data-testid="send-reset-link-btn"
                  onClick={async () => {
                    const res = await fetch('/api/auth/forgot-password', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: forgotEmail }),
                    });
                    const data = await res.json();
                    setIssuedResetToken(data.demoResetToken);
                    setResetTokenInput(data.demoResetToken);
                    setStatusBanner({ type: 'info', text: data.genericMessage });
                  }}
                  className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer shrink-0"
                >
                  Send Link
                </button>
              </div>
            </div>

            {issuedResetToken && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700">
                Dispatched Reset Token: <strong>{issuedResetToken}</strong>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="text-xs font-semibold text-slate-800">Complete Password Reset</div>
              <input
                type="text"
                value={resetTokenInput}
                onChange={(e) => setResetTokenInput(e.target.value)}
                placeholder="Paste reset token (e.g. rst_...)"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
              />
              <input
                type="password"
                value={newResetPassword}
                onChange={(e) => setNewResetPassword(e.target.value)}
                placeholder="New strong password"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
              <input
                type="password"
                value={confirmResetPassword}
                onChange={(e) => setConfirmResetPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
              <div className="text-[11px] text-slate-500">
                Strength: <strong>{resetPasswordEval.label}</strong>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      token: resetTokenInput,
                      newPassword: newResetPassword,
                      confirmPassword: confirmResetPassword,
                    }),
                  });
                  const data = await res.json();
                  setStatusBanner({
                    type: data.success ? 'success' : 'error',
                    text: data.message,
                  });
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Reset Password & Revoke Old Sessions
              </button>
            </div>
          </div>

          {/* Card 2: Email Verification Workflow */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-600" />
                Email Verification Gate
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Unverified accounts cannot access protected organization cases until email ownership is confirmed.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Target Email Address</label>
              <input
                type="email"
                value={verifyEmailAddress}
                onChange={(e) => setVerifyEmailAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={resendCooldown > 0}
                onClick={() => {
                  setResendCooldown(30);
                  setStatusBanner({
                    type: 'info',
                    text: `Verification email resent to ${verifyEmailAddress} via Resend (30s cooldown active).`,
                  });
                }}
                className="flex-1 py-2 px-3 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold rounded-lg cursor-pointer"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification'}
              </button>

              <button
                type="button"
                data-testid="confirm-email-verification-btn"
                onClick={async () => {
                  const res = await fetch('/api/auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: verifyEmailAddress }),
                  });
                  const data = await res.json();
                  setStatusBanner({ type: 'success', text: data.message });
                }}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Verify Email Now
              </button>
            </div>
          </div>

          {/* Card 3: Two-Factor Authentication (TOTP & Recovery Codes) */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                Two-Factor Authentication (TOTP)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Validates 6-digit Authenticator TOTP codes or 8-character backup recovery codes on the server.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Enter 6-Digit TOTP or Backup Recovery Code
              </label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="482910 or DG26-994A"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <button
              type="button"
              data-testid="verify-2fa-btn"
              onClick={async () => {
                const res = await fetch('/api/auth/verify-2fa', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code: totpCode }),
                });
                const data = await res.json();
                setStatusBanner({
                  type: data.success ? 'success' : 'error',
                  text: data.message,
                });
              }}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Verify 2FA Challenge
            </button>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-[11px] text-slate-600">
              <div className="font-semibold text-slate-800">Active Backup Recovery Codes:</div>
              <div className="font-mono">DG26-994A · DG26-731B · DG26-408C · DG26-112F</div>
            </div>
          </div>
        </div>
      )}

      {/* ROUTE 5: ORGANIZATION & BRANCH ONBOARDING (/onboarding/organization & /onboarding/branch) */}
      {activeRoute === 'onboarding' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Onboard New MSME Organization & Initial Branch</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Validates GSTIN format & Mod-36 checksum deterministically without falsely claiming government portal
                verification.
              </p>
            </div>

            <form onSubmit={handleOnboardOrganization} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Legal Company Name *</label>
                  <input
                    type="text"
                    required
                    value={onboardLegalName}
                    onChange={(e) => setOnboardLegalName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name *</label>
                  <input
                    type="text"
                    required
                    value={onboardDisplayName}
                    onChange={(e) => setOnboardDisplayName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Type</label>
                  <select
                    value={onboardType}
                    onChange={(e) => setOnboardType(e.target.value as OrganizationRecord['organizationType'])}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Micro Manufacturing">Micro Manufacturing</option>
                    <option value="Small Manufacturing">Small Manufacturing</option>
                    <option value="Services Enterprise">Services Enterprise</option>
                    <option value="Trading Solutions">Trading Solutions</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={onboardGstin}
                    onChange={(e) => setOnboardGstin(e.target.value)}
                    placeholder="15-char GSTIN"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Udyam Number (Optional)</label>
                  <input
                    type="text"
                    value={onboardUdyam}
                    onChange={(e) => setOnboardUdyam(e.target.value)}
                    placeholder="UDYAM-KR-08-0091234"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Live Deterministic Validation Feedback */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                <div>
                  <strong>GSTIN Mod-36 Check:</strong>{' '}
                  {liveGstinValidation ? (
                    <span
                      className={
                        liveGstinValidation.checksumValid
                          ? 'text-emerald-700 font-semibold'
                          : 'text-rose-700 font-semibold'
                      }
                    >
                      {liveGstinValidation.checksumValid
                        ? `Syntax & Checksum Valid (PAN: ${liveGstinValidation.panNumber}, State: ${liveGstinValidation.stateCode}) — Pending Official GSTN Portal Verification`
                        : liveGstinValidation.warnings.join(' ')}
                    </span>
                  ) : (
                    <span className="text-slate-500">Not supplied (Optional for exempt MSMEs)</span>
                  )}
                </div>
                <div>
                  <strong>Udyam Syntax Check:</strong>{' '}
                  <span className={liveUdyamValidation.valid ? 'text-emerald-700' : 'text-rose-700'}>
                    {liveUdyamValidation.message}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Udyam Reg. Date</label>
                  <input
                    type="date"
                    value={onboardUdyamDate}
                    onChange={(e) => setOnboardUdyamDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email *</label>
                  <input
                    type="email"
                    required
                    value={onboardEmail}
                    onChange={(e) => setOnboardEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    required
                    value={onboardPhone}
                    onChange={(e) => setOnboardPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Business Address *</label>
                <input
                  type="text"
                  required
                  value={onboardAddress}
                  onChange={(e) => setOnboardAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-900 mb-2">Initial Operating Branch Details</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Name *</label>
                    <input
                      type="text"
                      required
                      value={onboardBranchName}
                      onChange={(e) => setOnboardBranchName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={onboardCity}
                      onChange={(e) => setOnboardCity(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">State *</label>
                    <input
                      type="text"
                      required
                      value={onboardState}
                      onChange={(e) => setOnboardState(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Code *</label>
                    <input
                      type="text"
                      required
                      value={onboardPincode}
                      onChange={(e) => setOnboardPincode(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                data-testid="submit-onboard-org-btn"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Create Organization Workspace & Initial Branch
              </button>
            </form>
          </div>

          {/* Add Branch to Existing Organization */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <div className="text-xs font-mono text-indigo-600">
                Target: {workspaceSession?.activeOrganization.legalName}
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">Add New Branch to Active Organization</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Requires <code className="font-mono">branch:create</code> permission (Owner or Admin role).
              </p>
            </div>

            <form onSubmit={handleAddBranch} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Address *</label>
                <input
                  type="text"
                  required
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={newBranchCity}
                    onChange={(e) => setNewBranchCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={newBranchState}
                    onChange={(e) => setNewBranchState(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Code *</label>
                  <input
                    type="text"
                    required
                    value={newBranchPincode}
                    onChange={(e) => setNewBranchPincode(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                data-testid="add-branch-submit-btn"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Add Branch to {workspaceSession?.activeOrganization.displayName}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ROUTE 6: RBAC ROLES, MEMBERS & BACKEND AUTHORIZATION GATE (/rbac-members) */}
      {activeRoute === 'rbac-members' && workspaceSession && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Organization Members & Invitation */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-700" />
                  Organization Members & Role Assignments ({workspaceSession.activeOrganization.displayName})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Roles: Owner, Admin, Accountant, Case Reviewer, and Read-only Member.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-600">
                Your Role: <strong>{ROLE_LABELS[workspaceSession.activeRole]}</strong>
              </span>
            </div>

            <div className="space-y-2.5">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {m.userFullName} <span className="font-normal text-slate-500">({m.userEmail})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Status: <strong>{m.membershipStatus.toUpperCase()}</strong> · Branch Scope:{' '}
                      {m.allBranchesAccess ? 'All Branches' : `${m.allowedBranchIds.length} Assigned Branch(es)`}
                    </div>
                  </div>
                  <div className="font-mono font-semibold text-indigo-700">{ROLE_LABELS[m.role]}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleInviteMember} className="pt-4 border-t border-slate-100 space-y-3">
              <div className="text-xs font-bold text-slate-900">Invite or Update Organization Member</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Full Name"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@company.in"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="accountant">Accountant</option>
                  <option value="case_reviewer">Case Reviewer</option>
                  <option value="read_only">Read-only Member</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inviteAllBranches}
                    onChange={(e) => setInviteAllBranches(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Grant access to All Branches (uncheck to restrict to primary branch)</span>
                </label>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Invite / Save Role
                </button>
              </div>
            </form>
          </div>

          {/* Server-Side Permission & Branch Scope Enforcement Tester */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Backend RBAC & Branch Isolation Verifier
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tests <code className="font-mono">POST /api/workspaces/check-permission</code> against server-side
                session memberships.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Organization</label>
                <select
                  value={testTargetOrgId}
                  onChange={(e) => setTestTargetOrgId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="org-apex-001">Apex Precision Engineering (Harsha = Owner)</option>
                  <option value="org-abc-002">ABC Manufacturing Pvt. Ltd. (Harsha = Case Reviewer)</option>
                  <option value="org-xyz-003">XYZ Trading Solutions (Harsha = Accountant, Chennai Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Branch Scope</label>
                <select
                  value={testTargetBranchId}
                  onChange={(e) => setTestTargetBranchId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="br-chennai-01">Chennai Branch (Permitted in XYZ Trading)</option>
                  <option value="br-vizag-02">Visakhapatnam Branch (Unauthorized for Harsha in XYZ)</option>
                  <option value="ALL_BRANCHES">ALL_BRANCHES (Consolidated View)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Requested Protected Action</label>
                <select
                  value={testAction}
                  onChange={(e) => setTestAction(e.target.value as OrganizationActionPermission)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                >
                  <option value="report:approve">report:approve (Owner / Case Reviewer only)</option>
                  <option value="document:upload">document:upload (Owner / Admin / Accountant)</option>
                  <option value="org:manage_members">org:manage_members (Owner / Admin)</option>
                  <option value="branch:create">branch:create (Owner / Admin)</option>
                  <option value="case:view">case:view (All active roles)</option>
                </select>
              </div>

              <button
                type="button"
                data-testid="verify-rbac-permission-btn"
                onClick={handleRunPermissionTest}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Verify Backend Authorization</span>
              </button>
            </div>

            {permCheckResult && (
              <div
                data-testid="rbac-permission-result"
                className={`p-3.5 rounded-xl border text-xs ${
                  permCheckResult.allowed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="font-bold mb-1">
                  HTTP {permCheckResult.httpStatus} — {permCheckResult.allowed ? 'AUTHORIZED' : 'REJECTED'}
                </div>
                <div>{permCheckResult.reason}</div>
              </div>
            )}

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-[11px] text-slate-600">
              <div className="font-semibold text-slate-800">Active Role Permissions in Selected Workspace:</div>
              <div className="font-mono">
                {ROLE_PERMISSION_MATRIX[workspaceSession.activeRole].join(' · ')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
