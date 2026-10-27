/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Full-Screen Initial Authentication & Multi-Organization Gate
 * Implements:
 *  - Screen 1: Two-Column Split-Screen Enterprise Login (/login)
 *  - Screen 2: Account Registration (/register)
 *  - Screen 3: Forgot Password & Reset Password (/forgot-password & /reset-password)
 *  - Screen 4: Email Verification & Optional TOTP 2FA (/verify-email & /verify-2fa)
 *  - Screen 5: Post-Login Organization & Branch Selection Gate (/select-workspace & /select-branch)
 *  - Screen 6: New Organization & Initial Branch Onboarding (/onboarding)
 */

import React, { useState, useEffect } from 'react';
import {
  Scale,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Building2,
  GitBranch,
  Search,
  Plus,
  ShieldCheck,
  KeyRound,
  Smartphone,
  LogOut,
  FileText,
  Calculator,
  FileCheck2,
  UserPlus,
  ArrowLeft,
} from 'lucide-react';
import type { ActiveWorkspaceSession, OrganizationRecord } from '../types/index.ts';
import {
  evaluatePasswordStrength,
  ROLE_LABELS,
  validateUdyamNumberSyntax,
} from '../services/workspaceAuth.ts';
import { validateGstin } from '../services/finance.ts';

export type InitialAuthScreenMode =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'verify-email'
  | 'verify-2fa'
  | 'select-workspace'
  | 'onboarding';

interface AuthGateScreenProps {
  initialMode?: InitialAuthScreenMode;
  workspaceSession: ActiveWorkspaceSession | null;
  onSessionAuthenticated: (session: ActiveWorkspaceSession, enterDashboardImmediately: boolean) => void;
  onEnterDashboard: () => void;
  onLogout: () => void;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({
  initialMode = 'login',
  workspaceSession,
  onSessionAuthenticated,
  onEnterDashboard,
  onLogout,
}) => {
  const [mode, setMode] = useState<InitialAuthScreenMode>(initialMode);
  const [banner, setBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Login Form State
  const [email, setEmail] = useState('harsha@duesguard.in');
  const [password, setPassword] = useState('DuesGuard@2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [require2faStep, setRequire2faStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // Registration Form State
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCountryCode, setRegCountryCode] = useState('+91');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regAcceptedTerms, setRegAcceptedTerms] = useState(false);

  // Forgot & Reset Password State
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resetLinkDispatched, setResetLinkDispatched] = useState(false);
  const [issuedResetToken, setIssuedResetToken] = useState('');
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetCooldown, setResetCooldown] = useState(0);

  // Email Verification & 2FA State
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('rohan.pending@msme.in');
  const [verifyCooldown, setVerifyCooldown] = useState(0);
  const [totpCode, setTotpCode] = useState('482910');

  // Workspace & Branch Selector State
  const [orgSearch, setOrgSearch] = useState('');

  // Onboarding New Organization State
  const [onboardLegalName, setOnboardLegalName] = useState('');
  const [onboardDisplayName, setOnboardDisplayName] = useState('');
  const [onboardType, setOnboardType] =
    useState<OrganizationRecord['organizationType']>('Micro Manufacturing');
  const [onboardGstin, setOnboardGstin] = useState('');
  const [onboardUdyam, setOnboardUdyam] = useState('');
  const [onboardUdyamDate, setOnboardUdyamDate] = useState('2022-05-12');
  const [onboardAddress, setOnboardAddress] = useState('');
  const [onboardEmail, setOnboardEmail] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('+91 ');
  const [onboardBranchName, setOnboardBranchName] = useState('Head Office / Main Branch');
  const [onboardCity, setOnboardCity] = useState('');
  const [onboardState, setOnboardState] = useState('Andhra Pradesh');
  const [onboardPincode, setOnboardPincode] = useState('');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (resetCooldown > 0) {
      const t = setTimeout(() => setResetCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resetCooldown]);

  useEffect(() => {
    if (verifyCooldown > 0) {
      const t = setTimeout(() => setVerifyCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [verifyCooldown]);

  const validateLoginInputs = () => {
    const errs: { email?: string; password?: string } = {};
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      errs.email = 'Business email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errs.email = 'Enter a valid business email format (e.g., name@company.in).';
    }
    if (!password) {
      errs.password = 'Password is required.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (!validateLoginInputs()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (data.success && data.session) {
        if (require2faStep) {
          onSessionAuthenticated(data.session, false);
          setBanner({
            type: 'info',
            text: 'Primary credentials verified. Complete your Two-Factor Authentication (TOTP / Recovery Code) challenge.',
          });
          setMode('verify-2fa');
          return;
        }

        if (data.autoSelectWorkspace) {
          // Single-organization user: automatically open their workspace dashboard
          onSessionAuthenticated(data.session, true);
        } else {
          // Multi-organization user: proceed to Organization & Branch selection screen
          onSessionAuthenticated(data.session, false);
          setBanner({
            type: 'success',
            text: `Welcome back, ${data.session.user.fullName}. Select which company and branch workspace you want to open.`,
          });
          setMode('select-workspace');
        }
      } else {
        setBanner({
          type: 'error',
          text: data.message || 'Authentication failed. Please check your credentials.',
        });
        if (data.code === 'EMAIL_UNVERIFIED') {
          setPendingVerifyEmail(email.trim());
        }
      }
    } catch {
      setBanner({
        type: 'error',
        text: 'Network error while connecting to DuesGuard AI authentication service. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regFullName,
          email: regEmail,
          mobileNumber: `${regCountryCode} ${regMobile.trim()}`,
          password: regPassword,
          confirmPassword: regConfirmPassword,
          acceptedTerms: regAcceptedTerms,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPendingVerifyEmail(regEmail.trim());
        setVerifyCooldown(30);
        setBanner({
          type: 'success',
          text: data.message,
        });
        setMode('verify-email');
      } else {
        setBanner({ type: 'error', text: data.message });
      }
    } catch {
      setBanner({ type: 'error', text: 'Network error during registration.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (!recoveryEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail.trim())) {
      setBanner({ type: 'error', text: 'Please enter a valid business email address.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      });
      const data = await res.json();
      setResetLinkDispatched(true);
      setIssuedResetToken(data.demoResetToken || '');
      setResetTokenInput(data.demoResetToken || '');
      setResetCooldown(30);
      setBanner({
        type: 'info',
        text: data.genericMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetTokenInput.trim(),
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPassword(newPassword);
        setResetLinkDispatched(false);
        setBanner({
          type: 'success',
          text: data.message,
        });
        setMode('login');
      } else {
        setBanner({ type: 'error', text: data.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmEmailVerification = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingVerifyEmail }),
      });
      const data = await res.json();
      setEmail(pendingVerifyEmail);
      setBanner({
        type: 'success',
        text: data.message,
      });
      setMode('login');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (data.success) {
        setBanner({ type: 'success', text: data.message });
        setMode('select-workspace');
      } else {
        setBanner({ type: 'error', text: data.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchWorkspace = async (organizationId: string, branchId?: string) => {
    setBanner(null);
    const res = await fetch('/api/workspaces/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, branchId }),
    });
    const data = await res.json();
    if (data.success && data.session) {
      onSessionAuthenticated(data.session, false);
      setBanner({ type: 'success', text: data.message });
    } else {
      setBanner({ type: 'error', text: data.message });
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setIsSubmitting(true);
    try {
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
        onSessionAuthenticated(data.session, false);
        setBanner({
          type: 'success',
          text: `${data.message} ${data.warnings?.join(' ') || ''}`,
        });
        setMode('select-workspace');
      } else {
        setBanner({ type: 'error', text: data.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const regStrength = evaluatePasswordStrength(regPassword);
  const resetStrength = evaluatePasswordStrength(newPassword);
  const liveGstinCheck = onboardGstin.trim() ? validateGstin(onboardGstin.trim()) : null;
  const liveUdyamCheck = validateUdyamNumberSyntax(onboardUdyam);

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
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans text-slate-900">
      {/* =====================================================================
          LEFT PANEL — Deep Navy Brand & Product Introduction (Persistent Split-Screen)
         ===================================================================== */}
      <aside className="lg:w-[46%] xl:w-[44%] bg-[#0B132B] text-white p-8 sm:p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800">
        {/* Subtle Architectural Grid Accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        <div className="relative z-10 space-y-8">
          {/* Brand Logo & Wordmark */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center border border-blue-400/30 shadow-sm">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  DuesGuard <span className="text-blue-400 font-extrabold">AI</span>
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  From Delayed Payments to Evidence-Ready Resolution.
                </div>
              </div>
            </div>
          </div>

          {/* Product Headline & Short Description */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-mono uppercase tracking-wider text-blue-400">
              Enterprise Multi-Organization MSME Platform
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              One Identity Across Every MSME Company, GSTIN, and Operating Branch.
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              DuesGuard AI is a financial documentation and delayed-payment intelligence platform designed for Indian
              MSMEs. Upload invoices, purchase orders, delivery proofs, and Udyam certificates to prepare audit-ready
              MSMED Act case documentation.
            </p>
          </div>

          {/* Three Feature Highlights */}
          <div className="space-y-4 pt-1">
            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/75 border border-slate-800/90">
              <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800/70 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">1. AI-powered document intelligence</div>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Multimodal extraction of invoices, purchase orders, delivery challans, and signed PODs with strict
                  page-level provenance.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/75 border border-slate-800/90">
              <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800/70 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">2. Invoice and payment tracking</div>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Deterministic zero-float decimal arithmetic for MSMED Section 15 appointed-day deadlines and Section
                  16 (3× RBI Bank Rate) monthly compounding.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/75 border border-slate-800/90">
              <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800/70 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">3. Evidence-ready case preparation</div>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Reconciles PO → Invoice → Delivery → Payment timelines with human-in-the-loop review gates and
                  versioned PDF annexures.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Refined Financial Dashboard Illustration / Invoice Intelligence Visual */}
        <div className="relative z-10 mt-8 pt-6 border-t border-slate-800/90">
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400">MULTI-ENTITY WORKSPACE TOPOLOGY</span>
              <span className="font-mono text-emerald-400">1 Login → 3 Companies → 8 Branches</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/80">
                <div className="font-semibold text-white truncate">Apex Precision Eng.</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">29AABCA••••K1Z5</div>
                <div className="text-[11px] text-blue-400 mt-1">Bengaluru · Mysuru · Hubballi</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/80">
                <div className="font-semibold text-white truncate">ABC Manufacturing</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">37AABCU••••K1Z2</div>
                <div className="text-[11px] text-blue-400 mt-1">Guntur · Vijayawada · Hyd</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/80">
                <div className="font-semibold text-white truncate">XYZ Trading LLP</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">33AABCS••••B1ZB</div>
                <div className="text-[11px] text-blue-400 mt-1">Chennai · Visakhapatnam</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          RIGHT PANEL — Authentication, Registration, Password Reset & Workspace Selection
         ===================================================================== */}
      <main className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-14 bg-white overflow-y-auto">
        {/* Top Utility Navigation Bar */}
        <div className="max-w-xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Better Auth · Multi-Tenant Session Guard</span>
          </div>

          <div className="flex items-center gap-2">
            {mode !== 'login' && mode !== 'select-workspace' && (
              <button
                type="button"
                onClick={() => {
                  setBanner(null);
                  setMode('login');
                }}
                className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            )}

            {mode === 'select-workspace' && (
              <button
                type="button"
                data-testid="auth-gate-logout-btn"
                onClick={() => {
                  onLogout();
                  setBanner({
                    type: 'info',
                    text: 'You have signed out. Sign in below with your business email and password.',
                  });
                  setMode('login');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out ({workspaceSession?.user.fullName.split(' ')[0]})</span>
              </button>
            )}
          </div>
        </div>

        {/* Center Content Container */}
        <div className="max-w-xl w-full mx-auto my-auto py-8 space-y-6">
          {/* Status / Error / Info Banner */}
          {banner && (
            <div
              data-testid="auth-gate-banner"
              className={`p-4 rounded-xl border text-xs font-medium flex items-start justify-between gap-3 ${
                banner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : banner.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : 'bg-blue-50 border-blue-200 text-blue-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {banner.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{banner.text}</span>
              </div>
              {banner.text.includes('Email verification required') && (
                <button
                  type="button"
                  onClick={() => setMode('verify-email')}
                  className="shrink-0 underline font-bold text-rose-900 cursor-pointer"
                >
                  Verify Email →
                </button>
              )}
            </div>
          )}

          {/* ===============================================================
              MODE 1: SPLIT-SCREEN ENTERPRISE LOGIN (/login)
             =============================================================== */}
          {mode === 'login' && (
            <div className="space-y-6" data-testid="login-screen-container">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Sign in with your business credentials to access your MSME organizations, branches, and delayed-payment
                  cases.
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Business Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      data-testid="login-email-input"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                      }}
                      placeholder="name@company.in"
                      className={`w-full pl-10 pr-3.5 py-2.5 text-sm border rounded-xl focus:outline-none transition ${
                        fieldErrors.email
                          ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                          : 'border-slate-300 bg-white focus:border-blue-600'
                      }`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-xs text-rose-600 font-medium mt-1">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      data-testid="forgot-password-link"
                      onClick={() => {
                        setBanner(null);
                        setRecoveryEmail(email);
                        setMode('forgot-password');
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      data-testid="login-password-input"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                      }}
                      placeholder="Enter your password"
                      className={`w-full pl-10 pr-10 py-2.5 text-sm border rounded-xl focus:outline-none transition ${
                        fieldErrors.password
                          ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                          : 'border-slate-300 bg-white focus:border-blue-600'
                      }`}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs text-rose-600 font-medium mt-1">{fieldErrors.password}</p>
                  )}
                </div>

                {/* Remember Me & Optional 2FA Step Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Remember me for 30 days</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={require2faStep}
                      onChange={(e) => setRequire2faStep(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Require 2FA TOTP step on login</span>
                  </label>
                </div>

                {/* Primary Sign In Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="login-submit-btn"
                  className="w-full py-3 px-4 bg-[#0B132B] hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Optional Google OAuth Button */}
              <div className="space-y-3">
                <div className="relative flex py-1 items-center">
                  <div className="grow border-t border-slate-200" />
                  <span className="shrink mx-3 text-xs text-slate-400">Or continue with</span>
                  <div className="grow border-t border-slate-200" />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('harsha@duesguard.in');
                    setPassword('DuesGuard@2026!');
                    setBanner({
                      type: 'info',
                      text: 'Google Workspace identity matched to harsha@duesguard.in. Click Sign In to continue.',
                    });
                  }}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  <span>Sign in with Google Workspace</span>
                </button>
              </div>

              {/* Demo Accounts Quick-Fill Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Demo Accounts (1-Click Fill to Test Multi-Org vs. Single-Org Login)
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">Password: DuesGuard@2026!</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    data-testid="preset-harsha-btn"
                    onClick={() => {
                      setEmail('harsha@duesguard.in');
                      setPassword('DuesGuard@2026!');
                      setBanner(null);
                    }}
                    className={`text-left p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                      email === 'harsha@duesguard.in'
                        ? 'border-blue-600 bg-blue-50/50 text-slate-900'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="font-bold">Harsha Vardhan</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">3 Companies · 8 Branches</div>
                  </button>

                  <button
                    type="button"
                    data-testid="preset-ananya-btn"
                    onClick={() => {
                      setEmail('ananya@xyztrading.in');
                      setPassword('Ananya@MSME2026!');
                      setBanner(null);
                    }}
                    className={`text-left p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                      email === 'ananya@xyztrading.in'
                        ? 'border-blue-600 bg-blue-50/50 text-slate-900'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="font-bold">Ananya Sundaram</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">1 Company · Auto-Opens</div>
                  </button>

                  <button
                    type="button"
                    data-testid="preset-rohan-btn"
                    onClick={() => {
                      setEmail('rohan.pending@msme.in');
                      setPassword('Rohan@2026!');
                      setBanner(null);
                    }}
                    className={`text-left p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                      email === 'rohan.pending@msme.in'
                        ? 'border-amber-600 bg-amber-50/50 text-slate-900'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="font-bold">Rohan Kulkarni</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Unverified Email Gate</div>
                  </button>
                </div>
              </div>

              {/* Create Account Link */}
              <div className="pt-2 text-center text-xs text-slate-600">
                Don&apos;t have a DuesGuard AI account yet?{' '}
                <button
                  type="button"
                  data-testid="go-to-register-btn"
                  onClick={() => {
                    setBanner(null);
                    setMode('register');
                  }}
                  className="font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </div>
          )}

          {/* ===============================================================
              MODE 2: REGISTRATION & ACCOUNT CREATION (/register)
             =============================================================== */}
          {mode === 'register' && (
            <div className="space-y-5" data-testid="register-screen-container">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h2>
                <p className="text-xs text-slate-500 mt-1">
                  One identity lets you manage multiple MSME organizations, GSTINs, and branches. Company GSTIN and
                  Udyam details are collected after sign-up during organization onboarding.
                </p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g., Vikramaditya Rao"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Business Email</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="vikram@company.in"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile Number (with Country Code)
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={regCountryCode}
                        onChange={(e) => setRegCountryCode(e.target.value)}
                        className="px-2.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl bg-slate-50"
                      >
                        <option value="+91">+91 (IN)</option>
                        <option value="+971">+971 (AE)</option>
                        <option value="+65">+65 (SG)</option>
                        <option value="+1">+1 (US)</option>
                      </select>
                      <input
                        type="tel"
                        required
                        value={regMobile}
                        onChange={(e) => setRegMobile(e.target.value)}
                        placeholder="98480 12345"
                        className="flex-1 px-3 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Minimum 10 characters"
                        className="w-full px-3.5 pr-9 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword((s) => !s)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
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
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                {/* Password Strength Indicator */}
                {regPassword && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Password Strength:</span>
                      <span className="font-bold text-slate-900">{regStrength.label}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          regStrength.score >= 3
                            ? 'bg-emerald-600 w-full'
                            : regStrength.score === 2
                            ? 'bg-amber-500 w-2/3'
                            : 'bg-rose-500 w-1/3'
                        }`}
                      />
                    </div>
                    {regStrength.feedback.length > 0 && (
                      <p className="text-[11px] text-slate-500">{regStrength.feedback.join(' · ')}</p>
                    )}
                  </div>
                )}

                <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    required
                    checked={regAcceptedTerms}
                    onChange={(e) => setRegAcceptedTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600"
                  />
                  <span>
                    I agree to the DuesGuard AI <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>,
                    and understand that DuesGuard AI prepares financial estimates and evidence indices for human review.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-[#0B132B] hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isSubmitting ? 'Creating Account...' : 'Create Account & Verify Email'}</span>
                </button>
              </form>
            </div>
          )}

          {/* ===============================================================
              MODE 3: FORGOT PASSWORD & PASSWORD RESET (/forgot-password)
             =============================================================== */}
          {mode === 'forgot-password' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Password Recovery</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your business email to receive a password reset link via Resend. For security, our response
                  never discloses whether an email belongs to an active account.
                </p>
              </div>

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Email</label>
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="name@company.in"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || resetCooldown > 0}
                  className="w-full py-2.5 px-4 bg-[#0B132B] hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  {resetCooldown > 0 ? `Resend Reset Link (${resetCooldown}s)` : 'Send Password Reset Link'}
                </button>
              </form>

              {resetLinkDispatched && (
                <form
                  onSubmit={handleCompleteResetPassword}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-blue-600" />
                    <span>Complete Password Reset (Token Verification)</span>
                  </div>
                  {issuedResetToken && (
                    <div className="text-[11px] font-mono text-slate-600 bg-white p-2 rounded border border-slate-200">
                      Issued Reset Token: <strong>{issuedResetToken}</strong>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Reset Token</label>
                    <input
                      type="text"
                      required
                      value={resetTokenInput}
                      onChange={(e) => setResetTokenInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        required
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                  {newPassword && (
                    <div className="text-[11px] text-slate-600">
                      Strength: <strong>{resetStrength.label}</strong>
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
                  >
                    Reset Password & Revoke Old Sessions
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ===============================================================
              MODE 4: EMAIL VERIFICATION & 2FA (/verify-email & /verify-2fa)
             =============================================================== */}
          {mode === 'verify-email' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Verify your business email</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Unverified accounts cannot access protected MSME financial workspaces. Click below to confirm your
                  email verification token.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs text-slate-700">
                  Verification pending for: <strong className="font-mono">{pendingVerifyEmail}</strong>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmEmailVerification}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    Confirm Email Verification Now
                  </button>
                  <button
                    type="button"
                    disabled={verifyCooldown > 0}
                    onClick={() => {
                      setVerifyCooldown(30);
                      setBanner({
                        type: 'info',
                        text: `Verification email resent to ${pendingVerifyEmail}.`,
                      });
                    }}
                    className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    {verifyCooldown > 0 ? `Resend Email (${verifyCooldown}s)` : 'Resend Verification Email'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'verify-2fa' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  <span>Two-Factor Authentication (TOTP)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enter the 6-digit code from your authenticator app or one of your backup recovery codes (Demo TOTP:{' '}
                  <code className="font-mono font-bold">482910</code> or Recovery Code:{' '}
                  <code className="font-mono font-bold">DG26-994A</code>).
                </p>
              </div>

              <form onSubmit={handleVerify2faSubmit} className="space-y-4">
                <input
                  type="text"
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full px-4 py-3 text-base font-mono tracking-widest text-center border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-[#0B132B] hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition cursor-pointer"
                >
                  Verify 2FA Code & Continue
                </button>
              </form>
            </div>
          )}

          {/* ===============================================================
              MODE 5: POST-LOGIN ORGANIZATION & BRANCH SELECTOR (/select-workspace)
             =============================================================== */}
          {mode === 'select-workspace' && workspaceSession && (
            <div className="space-y-6" data-testid="select-workspace-screen">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-blue-600 font-semibold">
                    STEP 2 OF 2 · WORKSPACE & BRANCH CONTEXT
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                    Select Your Organization & Branch
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Signed in as <strong>{workspaceSession.user.fullName}</strong> ({workspaceSession.user.email})
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setBanner(null);
                    setMode('onboarding');
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold transition shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Organization</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  placeholder="Filter organizations by legal name, trade name, or GSTIN..."
                  className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Step A: Organization Cards */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>1. Choose Organization ({filteredOrgs.length} Accessible)</span>
                </div>

                {filteredOrgs.map(({ organization, role, allBranchesAccess, allowedBranchIds }) => {
                  const isSelected = organization.id === workspaceSession.activeOrganization.id;
                  return (
                    <div
                      key={organization.id}
                      onClick={() => handleSwitchWorkspace(organization.id)}
                      data-testid={`gate-org-card-${organization.id}`}
                      className={`p-4 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">{organization.legalName}</span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs font-semibold text-blue-700">{ROLE_LABELS[role]}</span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-1">
                            GSTIN: {organization.maskedGstin} · Udyam: {organization.udyamNumber || 'N/A'} ·{' '}
                            {allBranchesAccess
                              ? `${organization.branches.length} Branches (All Access)`
                              : `${allowedBranchIds.length} Permitted Branch`}
                          </div>
                        </div>

                        <div
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Step B: Branch Selection for Active Organization */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    2. Choose Operating Branch in {workspaceSession.activeOrganization.displayName}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeOrgMembership?.allBranchesAccess && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSwitchWorkspace(workspaceSession.activeOrganization.id, 'ALL_BRANCHES')
                      }
                      className={`text-left p-3 rounded-xl border text-xs transition cursor-pointer ${
                        workspaceSession.activeBranchId === 'ALL_BRANCHES'
                          ? 'border-blue-600 bg-blue-50/50 text-slate-900'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="font-bold">All Branches (Consolidated)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        View all {workspaceSession.activeOrganization.branches.length} branches together
                      </div>
                    </button>
                  )}

                  {workspaceSession.activeOrganization.branches
                    .filter(
                      (b) =>
                        activeOrgMembership?.allBranchesAccess ||
                        activeOrgMembership?.allowedBranchIds.includes(b.id)
                    )
                    .map((branch) => {
                      const isCurrent = workspaceSession.activeBranchId === branch.id;
                      return (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() =>
                            handleSwitchWorkspace(workspaceSession.activeOrganization.id, branch.id)
                          }
                          className={`text-left p-3 rounded-xl border text-xs transition cursor-pointer ${
                            isCurrent
                              ? 'border-blue-600 bg-blue-50/50 text-slate-900'
                              : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          <div className="font-bold">{branch.branchName}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {branch.city}, {branch.state} · {branch.caseCount} Cases
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Primary CTA to Open the Main DuesGuard AI Case Dashboard */}
              <button
                type="button"
                data-testid="enter-workspace-dashboard-btn"
                onClick={onEnterDashboard}
                className="w-full py-3.5 px-5 bg-[#0B132B] hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span>
                  Open {workspaceSession.activeOrganization.displayName} ({workspaceSession.activeBranchName})
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ===============================================================
              MODE 6: ONBOARD NEW ORGANIZATION & INITIAL BRANCH (/onboarding)
             =============================================================== */}
          {mode === 'onboarding' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Onboard New MSME Organization & Initial Branch</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Creates the organization, validates GSTIN & Udyam format, creates the first branch, and assigns you
                    as Owner.
                  </p>
                </div>
                {workspaceSession && (
                  <button
                    type="button"
                    onClick={() => setMode('select-workspace')}
                    className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    ← Back to Workspaces
                  </button>
                )}
              </div>

              <form onSubmit={handleOnboardSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Legal Company Name</label>
                    <input
                      type="text"
                      required
                      value={onboardLegalName}
                      onChange={(e) => setOnboardLegalName(e.target.value)}
                      placeholder="e.g. Kaveri Industrial Fasteners Pvt. Ltd."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Display / Trade Name</label>
                    <input
                      type="text"
                      required
                      value={onboardDisplayName}
                      onChange={(e) => setOnboardDisplayName(e.target.value)}
                      placeholder="e.g. Kaveri Fasteners"
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
                      <option value="Micro Services">Micro Services</option>
                      <option value="Small Services">Small Services</option>
                      <option value="Trading Solutions">Trading Solutions</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN (Optional)</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={onboardGstin}
                      onChange={(e) => setOnboardGstin(e.target.value.toUpperCase())}
                      placeholder="29AABCK5512R1Z2"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg uppercase"
                    />
                    {liveGstinCheck && (
                      <div
                        className={`text-[10px] mt-0.5 ${
                          liveGstinCheck.checksumValid ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {liveGstinCheck.checksumValid
                          ? `Valid Mod-36 (State ${liveGstinCheck.stateCode})`
                          : 'Invalid GSTIN format/checksum'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Udyam Number (Optional)</label>
                    <input
                      type="text"
                      value={onboardUdyam}
                      onChange={(e) => setOnboardUdyam(e.target.value.toUpperCase())}
                      placeholder="UDYAM-KR-08-0091234"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg uppercase"
                    />
                    {onboardUdyam && (
                      <div
                        className={`text-[10px] mt-0.5 ${
                          liveUdyamCheck.valid ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {liveUdyamCheck.valid ? 'Valid Udyam format' : 'Expected UDYAM-XX-00-0000000'}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Address</label>
                  <input
                    type="text"
                    required
                    value={onboardAddress}
                    onChange={(e) => setOnboardAddress(e.target.value)}
                    placeholder="Plot 88, Industrial Estate..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Company Email</label>
                    <input
                      type="email"
                      required
                      value={onboardEmail}
                      onChange={(e) => setOnboardEmail(e.target.value)}
                      placeholder="accounts@company.in"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      required
                      value={onboardPhone}
                      onChange={(e) => setOnboardPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <div className="text-xs font-bold text-slate-800 mb-2">Initial Operating Branch Details</div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Branch Name</label>
                      <input
                        type="text"
                        required
                        value={onboardBranchName}
                        onChange={(e) => setOnboardBranchName(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">City</label>
                      <input
                        type="text"
                        required
                        value={onboardCity}
                        onChange={(e) => setOnboardCity(e.target.value)}
                        placeholder="Guntur"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">PIN Code</label>
                      <input
                        type="text"
                        required
                        value={onboardPincode}
                        onChange={(e) => setOnboardPincode(e.target.value)}
                        placeholder="522001"
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-[#0B132B] hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Create Organization & Initial Branch
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer Links */}
        <footer className="max-w-xl w-full mx-auto pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>© 2026 DuesGuard AI · MSMED Act 2006 Evidence Preparation</span>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-600 cursor-pointer">Terms of Service</span>
            <span>·</span>
            <span className="hover:text-slate-600 cursor-pointer">Privacy Policy</span>
          </div>
        </footer>
      </main>
    </div>
  );
};
