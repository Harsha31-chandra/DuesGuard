/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Platform-Independent API Client Factory (packages/api-client)
 * Shared by apps/web (Next.js/Vite) and apps/mobile (Expo React Native).
 * No browser-only (window/localStorage) or Expo-only globals are imported here.
 */

export interface ApiClientPlatformConfig {
  baseUrl: string;
  getAuthHeaders: () => Promise<Record<string, string>> | Record<string, string>;
  fetchImpl?: typeof fetch;
}

export function createDuesGuardClient(config: ApiClientPlatformConfig) {
  const customFetch = config.fetchImpl || fetch;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const authHeaders = await config.getAuthHeaders();
    const response = await customFetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errBody.error || errBody.detail || `API Error ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    health: () => request<{ status: string; version: string }>('/api/health'),
    listCases: () => request<unknown[]>('/api/cases'),
    getCaseById: (caseId: string) => request<unknown>(`/api/cases/${caseId}`),
    runAnalysis: (caseId: string, asOfDate: string) =>
      request<unknown>(`/api/cases/${caseId}/analysis`, {
        method: 'POST',
        body: JSON.stringify({ asOfDate }),
      }),
    sendChatMessage: (payload: {
      caseId: string;
      message: string;
      modelTier: 'gemini-3.1-flash-lite' | 'gemini-3.8-flash' | 'gemini-4-argon';
      rolePersona: string;
    }) =>
      request<unknown>('/api/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  };
}
