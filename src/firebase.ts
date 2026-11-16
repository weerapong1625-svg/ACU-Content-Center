import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore Database with databaseId if specified and resilient connection settings
let firestoreInstance;
try {
  const databaseId = firebaseConfig.firestoreDatabaseId || undefined;
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    databaseId
  );
} catch {
  firestoreInstance = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestoreInstance;
export const auth = getAuth(app);

export function createAcuGoogleProvider(loginHint?: string): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  const params: Record<string, string> = {
    prompt: 'select_account',
    hd: 'acu.ac.th',
  };
  if (loginHint && loginHint.trim()) {
    params.login_hint = loginHint.trim().toLowerCase();
  }
  provider.setCustomParameters(params);
  return provider;
}

export const googleAuthProvider = createAcuGoogleProvider();

export default app;

export const FIRESTORE_UPGRADE_URL =
  'https://console.firebase.google.com/project/gen-lang-client-0908819103/firestore/databases/ai-studio-b5dfcfd7-ed94-4de1-8819-b93e509f2253/data?openUpgradeDialog=true';

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
