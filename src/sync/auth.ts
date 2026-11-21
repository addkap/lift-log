// Microsoft sign-in (MSAL). Loaded on demand so the app starts fast and works with no signal.
// Sign-in uses a full-page redirect because pop-ups do not work in an iPhone Home Screen app.

import type { AccountInfo, IPublicClientApplication } from '@azure/msal-browser';
import { GRAPH_SCOPES, MS_CLIENT_ID } from '../config';
import { NeedsAuthError } from './graph';

export const RETURN_TAB_KEY = 'lift-return-tab';

export const isConfigured = () => MS_CLIENT_ID.trim().length > 0;

let appPromise: Promise<IPublicClientApplication> | null = null;
let redirectError: string | null = null;

/** A sign-in problem from the last trip to Microsoft's page, shown once in Settings. */
export function takeRedirectError(): string | null {
  const e = redirectError;
  redirectError = null;
  return e;
}

function getApp(): Promise<IPublicClientApplication> {
  if (!isConfigured()) return Promise.reject(new Error('OneDrive sync is not set up in this copy of the app (no client ID).'));
  appPromise ??= (async () => {
    const { createStandardPublicClientApplication } = await import('@azure/msal-browser');
    const app = await createStandardPublicClientApplication({
      auth: {
        clientId: MS_CLIENT_ID.trim(),
        authority: 'https://login.microsoftonline.com/consumers', // personal Microsoft accounts only
        redirectUri: window.location.origin + import.meta.env.BASE_URL, // must match the redirect URI in the Entra app registration
      },
      cache: { cacheLocation: 'localStorage' }, // stay signed in between visits
    });
    // If we just came back from the Microsoft sign-in page, this picks up the result.
    // (If the user cancelled or Microsoft returned an error, remember it and carry on: it must not break sign-in.)
    const result = await app.handleRedirectPromise().catch((e: unknown) => {
      redirectError = e instanceof Error ? e.message : 'Sign-in did not finish.';
      return null;
    });
    const account = result?.account ?? app.getAllAccounts()[0] ?? null;
    if (account) app.setActiveAccount(account);
    return app;
  })();
  // If setup fails (e.g. offline) allow a later retry.
  appPromise.catch(() => { appPromise = null; });
  return appPromise;
}

export interface AccountSummary { name: string; username: string }

/** Who is signed in on this phone, if anyone. Never contacts Microsoft's servers beyond first-time setup. */
export async function getAccount(): Promise<AccountSummary | null> {
  if (!isConfigured()) return null;
  const app = await getApp();
  const a: AccountInfo | null = app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
  return a ? { name: a.name || a.username, username: a.username } : null;
}

/** Go to the Microsoft sign-in page (and come back). `returnTab` is the tab to reopen afterwards. */
export async function signIn(returnTab = 'Workout'): Promise<void> {
  const app = await getApp();
  try { localStorage.setItem(RETURN_TAB_KEY, returnTab); } catch { /* ignore */ }
  const account = app.getActiveAccount();
  if (account) await app.acquireTokenRedirect({ scopes: GRAPH_SCOPES, account });
  else await app.loginRedirect({ scopes: GRAPH_SCOPES });
}

/** Forget the sign-in on this phone. Saved workouts and the folder choice stay. */
export async function signOut(): Promise<void> {
  const app = await getApp();
  await app.clearCache();
}

/**
 * A Graph access token, quietly (no screens). If that is impossible (the ~24 hour sign-in expired,
 * or iOS blocked the quiet refresh) we throw NeedsAuthError, which the app shows as "Tap to sync".
 */
export async function getToken(): Promise<string> {
  const app = await getApp();
  const account = app.getActiveAccount() ?? app.getAllAccounts()[0];
  if (!account) throw new NeedsAuthError();
  try {
    const res = await app.acquireTokenSilent({ scopes: GRAPH_SCOPES, account });
    return res.accessToken;
  } catch (e) {
    // No connection is not an expired sign-in: let the caller treat it as "offline".
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new TypeError('offline', { cause: e });
    throw new NeedsAuthError();
  }
}
