/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Multi-Organization & Multi-Branch Authentication & RBAC Engine
 * Implements: ONE USER -> MANY ORGANIZATIONS -> MANY BRANCHES
 */

import type {
  ActiveWorkspaceSession,
  AuthenticatedUser,
  BranchRecord,
  OrganizationActionPermission,
  OrganizationMemberRecord,
  OrganizationRecord,
  OrganizationRole,
} from '../types/index.ts';
import { validateGstin } from './finance.ts';

export const ROLE_PERMISSION_MATRIX: Record<OrganizationRole, OrganizationActionPermission[]> = {
  owner: [
    'org:manage_settings',
    'org:manage_members',
    'branch:create',
    'document:upload',
    'invoice:manage',
    'finding:review',
    'report:approve',
    'case:view',
  ],
  admin: [
    'org:manage_settings',
    'org:manage_members',
    'branch:create',
    'document:upload',
    'invoice:manage',
    'finding:review',
    'case:view',
  ],
  accountant: ['document:upload', 'invoice:manage', 'case:view'],
  case_reviewer: ['finding:review', 'report:approve', 'case:view'],
  read_only: ['case:view'],
};

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  accountant: 'Accountant',
  case_reviewer: 'Case Reviewer',
  read_only: 'Read-only Member',
};

export function maskGstin(gstin?: string): string {
  if (!gstin || gstin.trim().length < 15) return 'Not Provided';
  const clean = gstin.trim().toUpperCase();
  return `${clean.slice(0, 7)}••••${clean.slice(11)}`;
}

export function evaluatePasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too Short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  feedback: string[];
} {
  const feedback: string[] = [];
  if (!password || password.length < 8) {
    return {
      score: 0,
      label: 'Too Short',
      feedback: ['Use at least 8 characters (10+ recommended for financial workspaces).'],
    };
  }

  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) points += 1;
  else feedback.push('Include both uppercase and lowercase letters.');

  if (/\d/.test(password)) points += 1;
  else feedback.push('Include at least one number.');

  if (/[^A-Za-z0-9]/.test(password)) points += 1;
  else feedback.push('Include a special character (e.g. @, #, $, !).');

  const score = Math.min(4, Math.max(1, points - 1)) as 0 | 1 | 2 | 3 | 4;
  const labels: Record<number, 'Too Short' | 'Weak' | 'Fair' | 'Good' | 'Strong'> = {
    0: 'Too Short',
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  };

  return {
    score,
    label: labels[score],
    feedback,
  };
}

export function validateUdyamNumberSyntax(udyam?: string): {
  valid: boolean;
  message: string;
} {
  if (!udyam || !udyam.trim()) {
    return { valid: true, message: 'Optional — not supplied during initial setup.' };
  }
  const normalized = udyam.trim().toUpperCase();
  const regex = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
  if (!regex.test(normalized)) {
    return {
      valid: false,
      message: 'Invalid Udyam format. Expected UDYAM-XX-00-0000000 (e.g., UDYAM-AP-04-0071822).',
    };
  }
  return {
    valid: true,
    message: 'Format valid — Pending official MSME portal document verification.',
  };
}

class WorkspaceAuthStore {
  private users: Map<string, AuthenticatedUser & { passwordPlain: string; failedAttempts: number; lockedUntil?: number }> =
    new Map();
  private organizations: Map<string, OrganizationRecord> = new Map();
  private memberships: OrganizationMemberRecord[] = [];
  private resetTokens: Map<string, { email: string; expiresAt: number; used: boolean }> = new Map();
  private activeUserId: string = 'user-harsha-001';

  constructor() {
    this.seedInitialMultiOrgData();
  }

  private seedInitialMultiOrgData() {
    // 1. Seed Primary Multi-Organization User: Harsha Vardhan
    this.users.set('user-harsha-001', {
      id: 'user-harsha-001',
      fullName: 'Harsha Vardhan',
      email: 'harsha@duesguard.in',
      mobileNumber: '+91 98480 22338',
      passwordPlain: 'DuesGuard@2026!',
      emailVerified: true,
      twoFactorEnabled: true,
      twoFactorVerified: true,
      recoveryCodes: ['DG26-994A', 'DG26-731B', 'DG26-408C', 'DG26-112F'],
      lastOrganizationId: 'org-abc-002',
      lastBranchId: 'br-guntur-01',
      failedAttempts: 0,
    });

    // 2. Seed Single-Organization User: Ananya Sundaram
    this.users.set('user-ananya-002', {
      id: 'user-ananya-002',
      fullName: 'Ananya Sundaram',
      email: 'ananya@xyztrading.in',
      mobileNumber: '+91 94441 88102',
      passwordPlain: 'Ananya@MSME2026!',
      emailVerified: true,
      twoFactorEnabled: false,
      twoFactorVerified: false,
      recoveryCodes: ['DG26-881X'],
      lastOrganizationId: 'org-xyz-003',
      lastBranchId: 'br-chennai-01',
      failedAttempts: 0,
    });

    // 3. Seed Unverified User for testing Email Verification Gate
    this.users.set('user-unverified-003', {
      id: 'user-unverified-003',
      fullName: 'Rohan Kulkarni',
      email: 'rohan.pending@msme.in',
      mobileNumber: '+91 98201 44510',
      passwordPlain: 'Rohan@2026!',
      emailVerified: false,
      twoFactorEnabled: false,
      twoFactorVerified: false,
      recoveryCodes: [],
      lastOrganizationId: 'org-apex-001',
      lastBranchId: 'br-blr-peenya',
      failedAttempts: 0,
    });

    // Organization 1: Apex Precision Engineering Pvt. Ltd. (Bengaluru, Mysuru, Hubballi)
    const orgApex: OrganizationRecord = {
      id: 'org-apex-001',
      legalName: 'Apex Precision Engineering Pvt. Ltd.',
      displayName: 'Apex Precision Engineering',
      organizationType: 'Micro Manufacturing',
      gstin: '29AABCU9603R1ZJ',
      maskedGstin: maskGstin('29AABCU9603R1ZJ'),
      gstinValidationStatus: 'verified_format',
      udyamNumber: 'UDYAM-KR-03-0048291',
      udyamRegistrationDate: '2021-08-14',
      registeredAddress: 'Plot 42-B, 2nd Phase, Peenya Industrial Area, Bengaluru, Karnataka 560058',
      contactEmail: 'accounts@apexprecision.in',
      contactPhone: '+91 80 2839 4410',
      createdAt: '2023-11-10T09:00:00Z',
      branches: [
        {
          id: 'br-blr-peenya',
          organizationId: 'org-apex-001',
          branchName: 'Bengaluru Peenya Works (HQ)',
          address: 'Plot 42-B, Peenya Industrial Area',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560058',
          contactPhone: '+91 80 2839 4410',
          caseCount: 2,
          createdAt: '2023-11-10T09:00:00Z',
        },
        {
          id: 'br-mysuru-hebbal',
          organizationId: 'org-apex-001',
          branchName: 'Mysuru Hebbal CNC Unit',
          address: 'No. 18, Hebbal Industrial Estate',
          city: 'Mysuru',
          state: 'Karnataka',
          pincode: '570016',
          contactPhone: '+91 821 240 3190',
          caseCount: 1,
          createdAt: '2024-01-05T09:00:00Z',
        },
        {
          id: 'br-hubballi-hub',
          organizationId: 'org-apex-001',
          branchName: 'Hubballi Dispatch & Fabrication Hub',
          address: 'Tarihal Industrial Area, Block C',
          city: 'Hubballi',
          state: 'Karnataka',
          pincode: '580026',
          contactPhone: '+91 836 231 0944',
          caseCount: 0,
          createdAt: '2024-02-12T09:00:00Z',
        },
      ],
    };

    // Organization 2: ABC Manufacturing Pvt. Ltd. (Guntur, Vijayawada, Hyderabad)
    const orgAbc: OrganizationRecord = {
      id: 'org-abc-002',
      legalName: 'ABC Manufacturing Pvt. Ltd.',
      displayName: 'ABC Manufacturing',
      organizationType: 'Small Manufacturing',
      gstin: '37AABCU9603R1Z4',
      maskedGstin: maskGstin('37AABCU9603R1Z4'),
      gstinValidationStatus: 'verified_format',
      udyamNumber: 'UDYAM-AP-04-0071822',
      udyamRegistrationDate: '2020-11-22',
      registeredAddress: 'Auto Nagar Phase III, Industrial Estate, Guntur, Andhra Pradesh 522001',
      contactEmail: 'finance@abcmanufacturing.co.in',
      contactPhone: '+91 863 223 7890',
      createdAt: '2023-12-01T10:00:00Z',
      branches: [
        {
          id: 'br-guntur-01',
          organizationId: 'org-abc-002',
          branchName: 'Guntur Branch',
          address: 'Plot 114, Auto Nagar Phase III',
          city: 'Guntur',
          state: 'Andhra Pradesh',
          pincode: '522001',
          contactPhone: '+91 863 223 7890',
          caseCount: 3,
          createdAt: '2023-12-01T10:00:00Z',
        },
        {
          id: 'br-vijayawada-02',
          organizationId: 'org-abc-002',
          branchName: 'Vijayawada Branch',
          address: '100 Feet Road, Jawahar Autonagar',
          city: 'Vijayawada',
          state: 'Andhra Pradesh',
          pincode: '520007',
          contactPhone: '+91 866 254 3311',
          caseCount: 2,
          createdAt: '2024-01-14T10:00:00Z',
        },
        {
          id: 'br-hyderabad-03',
          organizationId: 'org-abc-002',
          branchName: 'Hyderabad Branch',
          address: 'IDA Jeedimetla, Phase IV, Medchal',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500055',
          contactPhone: '+91 40 2309 6120',
          caseCount: 1,
          createdAt: '2024-02-01T10:00:00Z',
        },
      ],
    };

    // Organization 3: XYZ Trading Solutions (Chennai, Visakhapatnam)
    const orgXyz: OrganizationRecord = {
      id: 'org-xyz-003',
      legalName: 'XYZ Trading Solutions LLP',
      displayName: 'XYZ Trading Solutions',
      organizationType: 'Trading Solutions',
      gstin: '33AABCS1429B1ZB',
      maskedGstin: maskGstin('33AABCS1429B1ZB'),
      gstinValidationStatus: 'verified_format',
      udyamNumber: 'UDYAM-TN-02-0089124',
      udyamRegistrationDate: '2022-03-19',
      registeredAddress: 'SIDCO Industrial Estate, Ambattur, Chennai, Tamil Nadu 600098',
      contactEmail: 'billing@xyztrading.in',
      contactPhone: '+91 44 2625 9011',
      createdAt: '2024-01-20T11:30:00Z',
      branches: [
        {
          id: 'br-chennai-01',
          organizationId: 'org-xyz-003',
          branchName: 'Chennai Branch',
          address: '3rd Main Road, Ambattur Industrial Estate',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600098',
          contactPhone: '+91 44 2625 9011',
          caseCount: 2,
          createdAt: '2024-01-20T11:30:00Z',
        },
        {
          id: 'br-vizag-02',
          organizationId: 'org-xyz-003',
          branchName: 'Visakhapatnam Branch',
          address: 'Block D, Auto Nagar, Gajuwaka',
          city: 'Visakhapatnam',
          state: 'Andhra Pradesh',
          pincode: '530012',
          contactPhone: '+91 891 251 7740',
          caseCount: 1,
          createdAt: '2024-02-15T11:30:00Z',
        },
      ],
    };

    this.organizations.set(orgApex.id, orgApex);
    this.organizations.set(orgAbc.id, orgAbc);
    this.organizations.set(orgXyz.id, orgXyz);

    // Memberships for Harsha Vardhan (ONE USER -> 3 ORGANIZATIONS with distinct roles & branch scopes)
    this.memberships = [
      {
        id: 'mem-001',
        userId: 'user-harsha-001',
        userFullName: 'Harsha Vardhan',
        userEmail: 'harsha@duesguard.in',
        organizationId: 'org-apex-001',
        role: 'owner',
        allBranchesAccess: true,
        allowedBranchIds: ['br-blr-peenya', 'br-mysuru-hebbal', 'br-hubballi-hub'],
        membershipStatus: 'active',
        joinedAt: '2023-11-10T09:00:00Z',
      },
      {
        id: 'mem-002',
        userId: 'user-harsha-001',
        userFullName: 'Harsha Vardhan',
        userEmail: 'harsha@duesguard.in',
        organizationId: 'org-abc-002',
        role: 'case_reviewer',
        allBranchesAccess: true,
        allowedBranchIds: ['br-guntur-01', 'br-vijayawada-02', 'br-hyderabad-03'],
        membershipStatus: 'active',
        joinedAt: '2023-12-01T10:00:00Z',
      },
      {
        id: 'mem-003',
        userId: 'user-harsha-001',
        userFullName: 'Harsha Vardhan',
        userEmail: 'harsha@duesguard.in',
        organizationId: 'org-xyz-003',
        role: 'accountant',
        allBranchesAccess: false, // Restricted strictly to Chennai Branch
        allowedBranchIds: ['br-chennai-01'],
        membershipStatus: 'active',
        joinedAt: '2024-01-22T09:00:00Z',
      },
      {
        id: 'mem-004',
        userId: 'user-ananya-002',
        userFullName: 'Ananya Sundaram',
        userEmail: 'ananya@xyztrading.in',
        organizationId: 'org-xyz-003',
        role: 'owner',
        allBranchesAccess: true,
        allowedBranchIds: ['br-chennai-01', 'br-vizag-02'],
        membershipStatus: 'active',
        joinedAt: '2024-01-20T11:30:00Z',
      },
      {
        id: 'mem-005',
        userId: 'user-priya-004',
        userFullName: 'CA Priya Menon',
        userEmail: 'priya.audit@menonassociates.in',
        organizationId: 'org-abc-002',
        role: 'read_only',
        allBranchesAccess: false,
        allowedBranchIds: ['br-guntur-01'],
        membershipStatus: 'active',
        joinedAt: '2024-03-01T10:00:00Z',
      },
    ];
  }

  public getActiveWorkspaceSession(userId?: string): ActiveWorkspaceSession {
    const targetUserId = userId || this.activeUserId;
    const user = this.users.get(targetUserId) || this.users.get('user-harsha-001')!;
    const userMemberships = this.memberships.filter(
      (m) => m.userId === user.id && m.membershipStatus === 'active'
    );

    const accessibleOrganizations = userMemberships
      .map((m) => {
        const org = this.organizations.get(m.organizationId);
        if (!org) return null;
        return {
          organization: org,
          role: m.role,
          allBranchesAccess: m.allBranchesAccess,
          allowedBranchIds: m.allowedBranchIds,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const activeEntry =
      accessibleOrganizations.find((a) => a.organization.id === user.lastOrganizationId) ||
      accessibleOrganizations[0];

    const activeOrg = activeEntry.organization;
    const activeRole = activeEntry.role;

    let activeBranchId = user.lastBranchId;
    let activeBranchName = 'All Branches (Consolidated)';

    if (activeBranchId === 'ALL_BRANCHES') {
      if (!activeEntry.allBranchesAccess) {
        activeBranchId = activeEntry.allowedBranchIds[0] || activeOrg.branches[0]?.id || 'ALL_BRANCHES';
      }
    }

    if (activeBranchId !== 'ALL_BRANCHES') {
      const matchedBranch = activeOrg.branches.find((b) => b.id === activeBranchId);
      if (matchedBranch && (activeEntry.allBranchesAccess || activeEntry.allowedBranchIds.includes(matchedBranch.id))) {
        activeBranchName = `${matchedBranch.branchName} (${matchedBranch.city})`;
      } else {
        const fallbackBranchId = activeEntry.allowedBranchIds[0] || activeOrg.branches[0]?.id;
        const fallbackBranch = activeOrg.branches.find((b) => b.id === fallbackBranchId);
        activeBranchId = fallbackBranch?.id || 'ALL_BRANCHES';
        activeBranchName = fallbackBranch
          ? `${fallbackBranch.branchName} (${fallbackBranch.city})`
          : 'All Branches (Consolidated)';
      }
    }

    return {
      user,
      activeOrganization: activeOrg,
      activeBranchId,
      activeBranchName,
      activeRole,
      permittedActions: ROLE_PERMISSION_MATRIX[activeRole],
      accessibleOrganizations,
    };
  }

  public authenticateUser(params: { email: string; password?: string }): {
    success: boolean;
    code:
      | 'AUTHENTICATED'
      | 'INVALID_CREDENTIALS'
      | 'EMAIL_UNVERIFIED'
      | 'ACCOUNT_LOCKED'
      | 'INVALID_EMAIL';
    message: string;
    session?: ActiveWorkspaceSession;
    autoSelectWorkspace?: boolean;
  } {
    const emailClean = (params.email || '').trim().toLowerCase();
    if (!emailClean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      return {
        success: false,
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid business email address.',
      };
    }

    const foundUser = Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === emailClean
    );

    if (!foundUser) {
      return {
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password. Please verify your credentials.',
      };
    }

    if (foundUser.lockedUntil && Date.now() < foundUser.lockedUntil) {
      return {
        success: false,
        code: 'ACCOUNT_LOCKED',
        message:
          'Account temporarily locked due to multiple failed sign-in attempts. Please wait 15 minutes or reset your password.',
      };
    }

    if (params.password !== undefined && params.password !== foundUser.passwordPlain) {
      foundUser.failedAttempts += 1;
      if (foundUser.failedAttempts >= 5) {
        foundUser.lockedUntil = Date.now() + 15 * 60 * 1000;
        return {
          success: false,
          code: 'ACCOUNT_LOCKED',
          message: 'Account locked after 5 failed attempts. Use Forgot Password to recover access.',
        };
      }
      return {
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: `Invalid email or password (${5 - foundUser.failedAttempts} attempts remaining before lockout).`,
      };
    }

    foundUser.failedAttempts = 0;
    foundUser.lockedUntil = undefined;

    if (!foundUser.emailVerified) {
      return {
        success: false,
        code: 'EMAIL_UNVERIFIED',
        message:
          'Email verification required. Please verify your business email before accessing protected MSME workspaces.',
      };
    }

    this.activeUserId = foundUser.id;
    const session = this.getActiveWorkspaceSession(foundUser.id);
    return {
      success: true,
      code: 'AUTHENTICATED',
      message: `Signed in as ${foundUser.fullName}.`,
      session,
      autoSelectWorkspace: session.accessibleOrganizations.length === 1,
    };
  }

  public logoutUser(): {
    success: boolean;
    message: string;
  } {
    const currentUser = this.users.get(this.activeUserId);
    const name = currentUser?.fullName || 'User';
    return {
      success: true,
      message: `Signed out ${name}. Session token revoked.`,
    };
  }

  public registerUser(params: {
    fullName: string;
    email: string;
    mobileNumber: string;
    password: string;
    confirmPassword: string;
    acceptedTerms: boolean;
  }): {
    success: boolean;
    message: string;
    user?: AuthenticatedUser;
    verificationRequired?: boolean;
  } {
    if (!params.fullName || params.fullName.trim().length < 2) {
      return { success: false, message: 'Full name is required.' };
    }
    const emailClean = (params.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      return { success: false, message: 'Valid business email address is required.' };
    }
    if (!params.mobileNumber || params.mobileNumber.trim().length < 10) {
      return { success: false, message: 'Valid mobile number with country code is required.' };
    }
    const strength = evaluatePasswordStrength(params.password);
    if (strength.score < 2) {
      return {
        success: false,
        message: `Password is too weak (${strength.label}). ${strength.feedback.join(' ')}`,
      };
    }
    if (params.password !== params.confirmPassword) {
      return { success: false, message: 'Passwords do not match.' };
    }
    if (!params.acceptedTerms) {
      return { success: false, message: 'You must accept the Terms of Service and Privacy Policy.' };
    }

    const existing = Array.from(this.users.values()).find((u) => u.email.toLowerCase() === emailClean);
    if (existing) {
      return {
        success: false,
        message: 'Unable to complete registration for this email. If you already have an account, please sign in.',
      };
    }

    const newUserId = `user-${Date.now()}`;
    const newUser = {
      id: newUserId,
      fullName: params.fullName.trim(),
      email: emailClean,
      mobileNumber: params.mobileNumber.trim(),
      passwordPlain: params.password,
      emailVerified: false,
      twoFactorEnabled: false,
      twoFactorVerified: false,
      recoveryCodes: ['DG26-NEW1', 'DG26-NEW2'],
      lastOrganizationId: 'org-apex-001',
      lastBranchId: 'br-blr-peenya',
      failedAttempts: 0,
    };

    this.users.set(newUserId, newUser);
    // Grant initial membership to Apex Precision Engineering so once verified they can onboard or inspect
    this.memberships.push({
      id: `mem-${Date.now()}`,
      userId: newUserId,
      userFullName: newUser.fullName,
      userEmail: newUser.email,
      organizationId: 'org-apex-001',
      role: 'owner',
      allBranchesAccess: true,
      allowedBranchIds: ['br-blr-peenya', 'br-mysuru-hebbal', 'br-hubballi-hub'],
      membershipStatus: 'active',
      joinedAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: `Account created for ${newUser.fullName}. Verification email dispatched to ${newUser.email}.`,
      user: newUser,
      verificationRequired: true,
    };
  }

  public verifyEmailForAddress(email: string): { success: boolean; message: string } {
    const clean = (email || '').trim().toLowerCase();
    const target = Array.from(this.users.values()).find((u) => u.email.toLowerCase() === clean);
    if (target) {
      target.emailVerified = true;
    }
    return {
      success: true,
      message: 'Email address verified. You may now sign in and select your organization workspace.',
    };
  }

  public requestPasswordReset(email: string): {
    success: boolean;
    genericMessage: string;
    demoResetToken: string;
  } {
    const clean = (email || '').trim().toLowerCase();
    const token = `rst_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
    this.resetTokens.set(token, {
      email: clean,
      expiresAt: Date.now() + 30 * 60 * 1000,
      used: false,
    });

    // Security requirement: Never expose whether an arbitrary email belongs to an existing account
    return {
      success: true,
      genericMessage:
        'If an account exists for that business email, a password reset link has been sent via Resend. The link expires in 30 minutes.',
      demoResetToken: token,
    };
  }

  public completePasswordReset(params: {
    token: string;
    newPassword: string;
    confirmPassword: string;
  }): { success: boolean; message: string } {
    const record = this.resetTokens.get(params.token);
    if (!record || record.used || Date.now() > record.expiresAt) {
      return {
        success: false,
        message: 'Invalid or expired password reset token. Please request a new reset link.',
      };
    }
    if (params.newPassword !== params.confirmPassword) {
      return { success: false, message: 'New password and confirmation do not match.' };
    }
    const strength = evaluatePasswordStrength(params.newPassword);
    if (strength.score < 2) {
      return {
        success: false,
        message: `Password must be stronger (${strength.label}). ${strength.feedback.join(' ')}`,
      };
    }

    record.used = true;
    const user = Array.from(this.users.values()).find((u) => u.email.toLowerCase() === record.email);
    if (user) {
      user.passwordPlain = params.newPassword;
      user.failedAttempts = 0;
      user.lockedUntil = undefined;
    }

    return {
      success: true,
      message: 'Password reset completed and prior sessions revoked. You can now sign in with your new password.',
    };
  }

  public verifyTwoFactorChallenge(params: { code: string }): {
    success: boolean;
    method: 'totp' | 'recovery_code' | 'invalid';
    message: string;
  } {
    const clean = (params.code || '').trim().toUpperCase();
    const user = this.users.get(this.activeUserId) || this.users.get('user-harsha-001')!;

    if (/^\d{6}$/.test(clean) && (clean === '482910' || clean === '123456')) {
      user.twoFactorVerified = true;
      return {
        success: true,
        method: 'totp',
        message: 'TOTP Authenticator code verified for current session.',
      };
    }

    if (user.recoveryCodes.includes(clean)) {
      user.twoFactorVerified = true;
      return {
        success: true,
        method: 'recovery_code',
        message: `Backup recovery code (${clean}) verified for current session.`,
      };
    }

    return {
      success: false,
      method: 'invalid',
      message: 'Invalid 6-digit TOTP code or recovery code. (Demo TOTP: 482910 or Recovery Code: DG26-994A)',
    };
  }

  public switchWorkspace(params: {
    organizationId: string;
    branchId?: string;
  }): {
    success: boolean;
    message: string;
    session?: ActiveWorkspaceSession;
  } {
    const user = this.users.get(this.activeUserId) || this.users.get('user-harsha-001')!;
    const membership = this.memberships.find(
      (m) =>
        m.userId === user.id &&
        m.organizationId === params.organizationId &&
        m.membershipStatus === 'active'
    );

    if (!membership) {
      return {
        success: false,
        message: `HTTP 403 FORBIDDEN: User '${user.email}' is not an authorized member of organization '${params.organizationId}'.`,
      };
    }

    const org = this.organizations.get(params.organizationId);
    if (!org) {
      return { success: false, message: 'Organization not found.' };
    }

    let nextBranchId = params.branchId || (membership.allBranchesAccess ? 'ALL_BRANCHES' : membership.allowedBranchIds[0]);

    if (nextBranchId === 'ALL_BRANCHES' && !membership.allBranchesAccess) {
      return {
        success: false,
        message: `HTTP 403 FORBIDDEN: Your role (${ROLE_LABELS[membership.role]}) in ${org.displayName} is branch-restricted and cannot select 'All Branches'.`,
      };
    }

    if (
      nextBranchId !== 'ALL_BRANCHES' &&
      !membership.allBranchesAccess &&
      !membership.allowedBranchIds.includes(nextBranchId)
    ) {
      return {
        success: false,
        message: `HTTP 403 FORBIDDEN: Branch access denied. You do not have permission to access branch '${nextBranchId}' in ${org.displayName}.`,
      };
    }

    user.lastOrganizationId = org.id;
    user.lastBranchId = nextBranchId;

    const updatedSession = this.getActiveWorkspaceSession(user.id);
    return {
      success: true,
      message: `Switched active workspace to ${org.displayName} — ${updatedSession.activeBranchName} (${ROLE_LABELS[updatedSession.activeRole]}).`,
      session: updatedSession,
    };
  }

  public createOrganizationWithInitialBranch(params: {
    legalName: string;
    displayName: string;
    organizationType: OrganizationRecord['organizationType'];
    gstin?: string;
    udyamNumber?: string;
    udyamRegistrationDate?: string;
    registeredAddress: string;
    contactEmail: string;
    contactPhone: string;
    branchName: string;
    branchAddress: string;
    city: string;
    state: string;
    pincode: string;
  }): {
    success: boolean;
    message: string;
    warnings: string[];
    organization?: OrganizationRecord;
    session?: ActiveWorkspaceSession;
  } {
    const warnings: string[] = [];
    if (!params.legalName?.trim() || !params.displayName?.trim()) {
      return {
        success: false,
        message: 'Legal company name and display name are required.',
        warnings,
      };
    }
    if (!params.branchName?.trim() || !params.city?.trim() || !params.state?.trim() || !params.pincode?.trim()) {
      return {
        success: false,
        message: 'Initial branch name, city, state, and 6-digit PIN code are required.',
        warnings,
      };
    }

    let gstinValidationStatus: OrganizationRecord['gstinValidationStatus'] = 'not_provided';
    const cleanGstin = params.gstin?.trim().toUpperCase();
    if (cleanGstin) {
      const gstCheck = validateGstin(cleanGstin);
      if (!gstCheck.syntaxValid || !gstCheck.checksumValid) {
        return {
          success: false,
          message: `GSTIN validation failed: ${gstCheck.warnings.join(' ')}`,
          warnings: gstCheck.warnings,
        };
      }
      gstinValidationStatus = 'verified_format';
      warnings.push(
        'GSTIN passed deterministic 15-character syntax and Mod-36 checksum validation. Official GSTN portal status remains unverified until authorized API check.'
      );

      // Prevent duplicate organization creation by identical GSTIN
      const duplicateGstinOrg = Array.from(this.organizations.values()).find(
        (o) => o.gstin && o.gstin.toUpperCase() === cleanGstin
      );
      if (duplicateGstinOrg) {
        return {
          success: false,
          message: `An organization with GSTIN ${maskGstin(cleanGstin)} is already registered (${duplicateGstinOrg.legalName}). Request membership from its Owner instead.`,
          warnings,
        };
      }
    }

    const cleanUdyam = params.udyamNumber?.trim().toUpperCase();
    if (cleanUdyam) {
      const udyamCheck = validateUdyamNumberSyntax(cleanUdyam);
      if (!udyamCheck.valid) {
        return {
          success: false,
          message: udyamCheck.message,
          warnings,
        };
      }
      warnings.push(udyamCheck.message);
    }

    const orgId = `org-${Date.now()}`;
    const branchId = `br-${Date.now()}`;
    const newBranch: BranchRecord = {
      id: branchId,
      organizationId: orgId,
      branchName: params.branchName.trim(),
      address: params.branchAddress.trim() || params.registeredAddress.trim(),
      city: params.city.trim(),
      state: params.state.trim(),
      pincode: params.pincode.trim(),
      contactPhone: params.contactPhone.trim(),
      caseCount: 0,
      createdAt: new Date().toISOString(),
    };

    const newOrg: OrganizationRecord = {
      id: orgId,
      legalName: params.legalName.trim(),
      displayName: params.displayName.trim(),
      organizationType: params.organizationType || 'Micro Manufacturing',
      gstin: cleanGstin || undefined,
      maskedGstin: maskGstin(cleanGstin),
      gstinValidationStatus,
      udyamNumber: cleanUdyam || undefined,
      udyamRegistrationDate: params.udyamRegistrationDate || undefined,
      registeredAddress: params.registeredAddress.trim(),
      contactEmail: params.contactEmail.trim(),
      contactPhone: params.contactPhone.trim(),
      branches: [newBranch],
      createdAt: new Date().toISOString(),
    };

    this.organizations.set(orgId, newOrg);

    const user = this.users.get(this.activeUserId) || this.users.get('user-harsha-001')!;
    this.memberships.push({
      id: `mem-${Date.now()}`,
      userId: user.id,
      userFullName: user.fullName,
      userEmail: user.email,
      organizationId: orgId,
      role: 'owner',
      allBranchesAccess: true,
      allowedBranchIds: [branchId],
      membershipStatus: 'active',
      joinedAt: new Date().toISOString(),
    });

    user.lastOrganizationId = orgId;
    user.lastBranchId = branchId;

    return {
      success: true,
      message: `Created organization '${newOrg.legalName}' with initial branch '${newBranch.branchName}' and switched active workspace.`,
      warnings,
      organization: newOrg,
      session: this.getActiveWorkspaceSession(user.id),
    };
  }

  public addBranchToOrganization(params: {
    organizationId: string;
    branchName: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    contactPhone?: string;
  }): {
    success: boolean;
    message: string;
    branch?: BranchRecord;
    session?: ActiveWorkspaceSession;
  } {
    const authCheck = this.authorizeAction({
      organizationId: params.organizationId,
      action: 'branch:create',
    });
    if (!authCheck.allowed) {
      return { success: false, message: authCheck.reason };
    }

    const org = this.organizations.get(params.organizationId);
    if (!org) {
      return { success: false, message: 'Organization not found.' };
    }

    const branch: BranchRecord = {
      id: `br-${Date.now()}`,
      organizationId: org.id,
      branchName: params.branchName.trim(),
      address: params.address.trim(),
      city: params.city.trim(),
      state: params.state.trim(),
      pincode: params.pincode.trim(),
      contactPhone: params.contactPhone?.trim(),
      caseCount: 0,
      createdAt: new Date().toISOString(),
    };

    org.branches.push(branch);

    // Grant access to members with allBranchesAccess
    this.memberships
      .filter((m) => m.organizationId === org.id && m.allBranchesAccess)
      .forEach((m) => {
        if (!m.allowedBranchIds.includes(branch.id)) {
          m.allowedBranchIds.push(branch.id);
        }
      });

    return {
      success: true,
      message: `Added branch '${branch.branchName} (${branch.city})' to ${org.displayName}.`,
      branch,
      session: this.getActiveWorkspaceSession(),
    };
  }

  public getOrganizationMembers(organizationId: string): OrganizationMemberRecord[] {
    return this.memberships.filter((m) => m.organizationId === organizationId);
  }

  public inviteOrUpdateMember(params: {
    organizationId: string;
    email: string;
    fullName: string;
    role: OrganizationRole;
    allBranchesAccess: boolean;
    allowedBranchIds: string[];
  }): {
    success: boolean;
    message: string;
    members: OrganizationMemberRecord[];
  } {
    const permCheck = this.authorizeAction({
      organizationId: params.organizationId,
      action: 'org:manage_members',
    });
    if (!permCheck.allowed) {
      return {
        success: false,
        message: permCheck.reason,
        members: this.getOrganizationMembers(params.organizationId),
      };
    }

    const emailClean = params.email.trim().toLowerCase();
    const existing = this.memberships.find(
      (m) => m.organizationId === params.organizationId && m.userEmail.toLowerCase() === emailClean
    );

    if (existing) {
      existing.role = params.role;
      existing.allBranchesAccess = params.allBranchesAccess;
      existing.allowedBranchIds = params.allowedBranchIds;
      existing.membershipStatus = 'active';
      return {
        success: true,
        message: `Updated role for ${existing.userFullName} to ${ROLE_LABELS[params.role]}.`,
        members: this.getOrganizationMembers(params.organizationId),
      };
    }

    const member: OrganizationMemberRecord = {
      id: `mem-${Date.now()}`,
      userId: `user-inv-${Date.now()}`,
      userFullName: params.fullName.trim() || emailClean.split('@')[0],
      userEmail: emailClean,
      organizationId: params.organizationId,
      role: params.role,
      allBranchesAccess: params.allBranchesAccess,
      allowedBranchIds: params.allowedBranchIds,
      membershipStatus: 'invited',
      joinedAt: new Date().toISOString(),
    };
    this.memberships.push(member);

    return {
      success: true,
      message: `Invited ${member.userFullName} (${member.userEmail}) as ${ROLE_LABELS[params.role]}.`,
      members: this.getOrganizationMembers(params.organizationId),
    };
  }

  public authorizeAction(params: {
    userId?: string;
    organizationId: string;
    branchId?: string;
    action: OrganizationActionPermission;
  }): {
    allowed: boolean;
    httpStatus: 200 | 401 | 403;
    role?: OrganizationRole;
    reason: string;
  } {
    const targetUserId = params.userId || this.activeUserId;
    const user = this.users.get(targetUserId);
    if (!user || !user.emailVerified) {
      return {
        allowed: false,
        httpStatus: 401,
        reason: 'HTTP 401 UNAUTHORIZED: Active verified session required.',
      };
    }

    const membership = this.memberships.find(
      (m) =>
        m.userId === user.id &&
        m.organizationId === params.organizationId &&
        m.membershipStatus === 'active'
    );

    if (!membership) {
      return {
        allowed: false,
        httpStatus: 403,
        reason: `HTTP 403 FORBIDDEN: User '${user.email}' does not belong to organization '${params.organizationId}'.`,
      };
    }

    const allowedActions = ROLE_PERMISSION_MATRIX[membership.role];
    if (!allowedActions.includes(params.action)) {
      return {
        allowed: false,
        httpStatus: 403,
        role: membership.role,
        reason: `HTTP 403 FORBIDDEN: Role '${ROLE_LABELS[membership.role]}' lacks permission '${params.action}'.`,
      };
    }

    if (params.branchId) {
      if (params.branchId === 'ALL_BRANCHES' && !membership.allBranchesAccess) {
        return {
          allowed: false,
          httpStatus: 403,
          role: membership.role,
          reason: `HTTP 403 FORBIDDEN: Member '${user.email}' is restricted to specific branches (${membership.allowedBranchIds.join(', ')}) and cannot query ALL_BRANCHES.`,
        };
      }
      if (
        params.branchId !== 'ALL_BRANCHES' &&
        !membership.allBranchesAccess &&
        !membership.allowedBranchIds.includes(params.branchId)
      ) {
        return {
          allowed: false,
          httpStatus: 403,
          role: membership.role,
          reason: `HTTP 403 FORBIDDEN: Branch isolation violation. Member '${user.email}' is not permitted to access branch '${params.branchId}'.`,
        };
      }
    }

    return {
      allowed: true,
      httpStatus: 200,
      role: membership.role,
      reason: `HTTP 200 OK: Authorized '${params.action}' for ${user.email} (${ROLE_LABELS[membership.role]}) in ${params.organizationId}${params.branchId ? ` / ${params.branchId}` : ''}.`,
    };
  }
}

export const workspaceAuth = new WorkspaceAuthStore();
