import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export function useAuthenticatedApi() {
  const { getIdToken, signOutUser } = useAuth();
  return useCallback(async function authenticatedFetch(path: string, init: RequestInit = {}) {
    const token = await getIdToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(path, { ...init, headers });
    if (response.status !== 401) return response;
    const refreshedHeaders = new Headers(init.headers);
    refreshedHeaders.set('Authorization', `Bearer ${await getIdToken(true)}`);
    const retried = await fetch(path, { ...init, headers: refreshedHeaders });
    if (retried.status === 401) await signOutUser();
    return retried;
  }, [getIdToken, signOutUser]);
}

export async function readApiError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string; code?: string } | null;
  return payload?.error || `Request failed (${response.status}).`;
}
