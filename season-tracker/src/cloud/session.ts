import { ApiError } from './api';

/**
 * The owner's session. There is one person who edits this league, so "signing
 * in" is entering the deployment's admin pass once and having the browser
 * remember it — no accounts, no password reset, nothing to administer.
 *
 * It lives in localStorage, which means anyone with the machine has it. That is
 * the same trust boundary the tracker has always had: until now the entire
 * season lived in that same localStorage.
 */

const TOKEN_KEY = 'wor-admin-token';

let cached: string | null | undefined;

export function getAdminToken(): string | null {
  if (cached !== undefined) return cached;
  try {
    cached = localStorage.getItem(TOKEN_KEY);
  } catch {
    cached = null; // private mode, storage disabled — read as signed out
  }
  return cached;
}

export function setAdminToken(token: string): void {
  cached = token || null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to do — the token stays in memory for this tab.
  }
}

export function clearAdminToken(): void {
  setAdminToken('');
}

export const hasAdminToken = (): boolean => !!getAdminToken();

export interface AuthCheck {
  admin: boolean;
  configured: boolean;
}

/**
 * Ask the server whether the pass in hand is the right one. Called on the admin
 * screen at open and after a sign-in, so a stale or rotated one is reported as
 * such instead of failing at the first save.
 */
export async function checkAdmin(): Promise<AuthCheck> {
  const token = getAdminToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  let response: Response;
  try {
    response = await fetch('/api/db/auth', { headers });
  } catch {
    throw new ApiError(0, 'Could not reach the server.');
  }
  if (response.status === 401) {
    const body = await response.json().catch(() => ({ configured: true }));
    return { admin: false, configured: !!body.configured };
  }
  if (!response.ok) throw new ApiError(response.status, 'Could not check the admin pass.');
  return (await response.json()) as AuthCheck;
}
