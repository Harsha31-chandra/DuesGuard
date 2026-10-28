/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Google Workspace Gmail Integration (`gmail.send`)
 * Authenticates via Firebase Auth (`firebase-applet-config.json`) with in-memory
 * access token caching and dispatches RFC 2822 `multipart/mixed` emails containing:
 *  - Pending Bill & Statutory Due Date Breakdown
 *  - Official PDF Soft Copy (`Buyer_Reminder_Bill_${invoiceNumber}.pdf`)
 *  - Official HTML Soft Copy (`Buyer_Notice_Portal_Preview_${invoiceNumber}.html`)
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  buildRfc2822MimeWithAttachments,
  encodeMimeToBase64Url,
  utf8ToBase64,
} from './erpBillingService.ts';

export const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'consent',
  include_granted_scopes: 'true',
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory ONLY (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window is not available'));
      return;
    }
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Google Identity Services script'))
      );
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
}

async function signInViaGisTokenClient(): Promise<{
  user: User;
  accessToken: string;
}> {
  await loadGoogleIdentityScript();
  const oauth2 = (window as any).google?.accounts?.oauth2;
  if (!oauth2 || !firebaseConfig.oAuthClientId) {
    throw new Error('Google Identity Services OAuth client is unavailable.');
  }

  return new Promise((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: firebaseConfig.oAuthClientId,
      scope: [...SCOPES, 'email', 'profile'].join(' '),
      prompt: 'consent',
      callback: async (tokenResponse: any) => {
        if (tokenResponse?.error || !tokenResponse?.access_token) {
          reject(
            new Error(
              tokenResponse?.error_description ||
                tokenResponse?.error ||
                'Google OAuth authorization was cancelled.'
            )
          );
          return;
        }
        const token = tokenResponse.access_token as string;
        cachedAccessToken = token;

        let email = auth.currentUser?.email || 'chandraharshavardhan1@gmail.com';
        let displayName = auth.currentUser?.displayName || 'Authorized Gmail Sender';
        try {
          const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (infoRes.ok) {
            const profile = await infoRes.json();
            if (profile?.email) email = profile.email;
            if (profile?.name) displayName = profile.name;
          }
        } catch {
          // Ignore profile fetch error; token is valid for Gmail send
        }

        const syntheticUser = (auth.currentUser || {
          uid: `gis-${email}`,
          email,
          displayName,
        }) as User;

        resolve({ user: syntheticUser, accessToken: token });
      },
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Initialize auth state listener. Call on component mount.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Must be called from a button click or user interaction.
 */
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        return { user: result.user, accessToken: cachedAccessToken };
      }
    } catch (firebaseErr: any) {
      console.warn(
        'Firebase signInWithPopup fallback to Google Identity Services:',
        firebaseErr?.code || firebaseErr?.message
      );
      if (
        firebaseErr?.code === 'auth/popup-closed-by-user' ||
        firebaseErr?.code === 'auth/cancelled-popup-request'
      ) {
        throw firebaseErr;
      }
    }

    // Fallback to direct Google Identity Services OAuth 2.0 TokenClient using firebaseConfig.oAuthClientId
    return await signInViaGisTokenClient();
  } catch (error: any) {
    console.error('Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

/**
 * Sends a multipart/mixed email via Gmail REST API (`users/me/messages/send`)
 * with the Buyer Reminder Bill PDF soft copy and Buyer Notice & Portal Exposure Preview HTML soft copy attached.
 */
export async function sendGmailReminderWithSoftCopy(params: {
  accessTokenOverride?: string;
  senderEmail?: string;
  senderName?: string;
  recipientEmail: string;
  subject: string;
  plainTextBody: string;
  htmlBody: string;
  pdfFilename: string;
  base64Pdf: string;
  htmlSoftCopyFilename: string;
  htmlSoftCopyContent: string;
}): Promise<{
  id: string;
  threadId?: string;
}> {
  const accessToken = params.accessTokenOverride || (await getAccessToken());
  if (!accessToken) {
    throw new Error('Gmail authentication required. Please click "Sign in with Google" first.');
  }

  const mimeMessage = buildRfc2822MimeWithAttachments({
    to: params.recipientEmail,
    fromEmail: params.senderEmail || auth.currentUser?.email || undefined,
    fromName: params.senderName || 'DuesGuard AI Statutory Billing',
    subject: params.subject,
    plainTextBody: params.plainTextBody,
    htmlBody: params.htmlBody,
    attachments: [
      {
        filename: params.pdfFilename,
        mimeType: 'application/pdf',
        base64Content: params.base64Pdf,
      },
      {
        filename: params.htmlSoftCopyFilename,
        mimeType: 'text/html',
        base64Content: utf8ToBase64(params.htmlSoftCopyContent),
      },
    ],
  });

  const raw = encodeMimeToBase64Url(mimeMessage);

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const rawMsg = errBody?.error?.message || `HTTP ${response.status}`;
    if (response.status === 401 || response.status === 403) {
      cachedAccessToken = null;
    }
    throw new Error(
      `Gmail API Error (${response.status}): ${rawMsg}. Please click "Sign in with Google" and make sure to check the permission box "Send email on your behalf".`
    );
  }

  const data = (await response.json()) as { id: string; threadId?: string };
  return data;
}
