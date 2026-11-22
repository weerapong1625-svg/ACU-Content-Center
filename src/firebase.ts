import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Strictly lock Firestore databaseId to the active production database (never reset to default)
export const FIRESTORE_DATABASE_ID = 'ai-studio-edustorefirebase-e5054019-9ee3-4efc-9f69-ffe3fd887313';

const ACTIVE_DB_MARKER_KEY = 'acu_active_firestore_db_id';

export function safeLocalStorageSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeLocalStorageRemoveItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// One-time cleanup of stale/empty localStorage caches if the browser previously connected to a different databaseId
if (typeof window !== 'undefined') {
  try {
    const prevDbId = localStorage.getItem(ACTIVE_DB_MARKER_KEY);
    if (prevDbId !== FIRESTORE_DATABASE_ID) {
      const exactCacheKeysToReset = [
        'acu_cached_innovations_submissions',
        'acu_cached_innovations_fetched_at',
        'acu_cached_teacher_media',
        'acu_cached_teacher_media_fetched_at',
        'acu_cached_facility_submissions',
        'acu_cached_facilities_fetched_at',
        'acu_cached_shared_ideas',
        'acu_cached_shared_ideas_fetched_at',
        'acu_cached_all_user_profiles_map',
        'acu_cached_reward_claims',
        'acu_persistent_login_logs',
        'acu_login_logs_fetched_at',
        'acu_site_summary_cache',
        'acu_admin_overall_stats_cache',
        'acu_school_logo_config',
        'acu_certificate_logo_config',
        'acu_popup_banner_config',
        'acu_google_sheets_config_cache',
        'acu_criteria_poster_config',
      ];
      exactCacheKeysToReset.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('acu_users_uid_cache_')) {
          try {
            localStorage.removeItem(key);
          } catch {}
        }
      }
      safeLocalStorageSetItem(ACTIVE_DB_MARKER_KEY, FIRESTORE_DATABASE_ID);
    }
  } catch {
    // ignore storage errors on restricted mobile browsers
  }
}

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore Database strictly with FIRESTORE_DATABASE_ID and resilient connection settings
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    FIRESTORE_DATABASE_ID
  );
} catch {
  firestoreInstance = getFirestore(app, FIRESTORE_DATABASE_ID);
}

export const db = firestoreInstance;
export const auth = getAuth(app);

let authInitialized = false;
let resolveAuthReadyFn: () => void = () => {};
const authReadyPromise = new Promise<void>((resolve) => {
  resolveAuthReadyFn = resolve;
});

const markAuthReady = (emitEvent = true) => {
  if (!authInitialized) {
    authInitialized = true;
    resolveAuthReadyFn();
    if (emitEvent && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_auth_ready'));
    }
  }
};

if (typeof window !== 'undefined') {
  try {
    const unsubAuth = onAuthStateChanged(auth, () => {
      markAuthReady(true);
      unsubAuth();
    });
    setTimeout(() => {
      markAuthReady(true);
    }, 400);
  } catch {
    markAuthReady(false);
  }
} else {
  markAuthReady(false);
}

export function isAuthReady(): boolean {
  return authInitialized;
}

export async function waitForAuthReady(): Promise<void> {
  if (authInitialized) return;
  await authReadyPromise;
}

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('email');
googleAuthProvider.addScope('profile');
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});

export function createGoogleAuthProvider(loginHint?: string): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  const params: Record<string, string> = { prompt: 'select_account' };
  if (loginHint && loginHint.trim()) {
    params.login_hint = loginHint.trim().toLowerCase();
  }
  provider.setCustomParameters(params);
  return provider;
}

export default app;

export const FIRESTORE_UPGRADE_URL =
  `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`;

/**
 * Check if a Firestore error is caused by daily free read quota exhaustion
 */
export function isQuotaExceededError(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === 'object' && err !== null && 'message' in err
    ? String((err as any).message)
    : String(err);
  const code = typeof err === 'object' && err !== null && 'code' in err
    ? String((err as any).code)
    : '';

  return (
    code === 'resource-exhausted' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Free daily read units per project')
  );
}

/**
 * Notify application components that Firestore quota has been reached
 */
export function notifyQuotaExceeded(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('acu_firestore_quota_exceeded'));
  }
}
