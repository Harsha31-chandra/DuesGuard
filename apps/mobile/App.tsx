/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Expo React Native Mobile Companion (apps/mobile)
 * Consumes shared packages/api-client and packages/finance contracts.
 * Uses platform-injected SecureStore session tokens (never browser cookies/window).
 */

import { createDuesGuardClient } from '../../packages/api-client/create-client.ts';

export interface MobileSessionAdapter {
  getSecureToken: () => Promise<string | null>;
  setSecureToken: (token: string) => Promise<void>;
  clearSecureToken: () => Promise<void>;
}

export function createMobileApiClient(apiBaseUrl: string, storage: MobileSessionAdapter) {
  return createDuesGuardClient({
    baseUrl: apiBaseUrl,
    getAuthHeaders: async (): Promise<Record<string, string>> => {
      const token = await storage.getSecureToken();
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
      return {};
    },
  });
}

export const EXPO_MOBILE_SCREENS = [
  'CaseDashboardScreen',
  'DocumentScannerUploadScreen',
  'EvidenceChecklistScreen',
  'StatutoryInterestBreakdownScreen',
  'ReviewerSignOffScreen',
  'GeminiCaseAssistantScreen',
] as const;
