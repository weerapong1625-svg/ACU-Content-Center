import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface LoginLogEntry {
  id?: string;
  email: string;
  displayName: string;
  role: 'teacher' | 'student' | 'guest';
  loginMethod: string;
  status: 'online' | 'offline';
  loginTimestamp: string;
  source: string;
  avatarUrl?: string;
  createdAt?: any;
}

export interface UserProfileData {
  email: string;
  displayName: string;
  avatarUrl: string;
  updatedAt?: string;
}

/**
 * Record a user login event to Firestore (System Test)
 */
export async function logUserLogin(data: {
  email: string;
  displayName?: string;
  role?: 'teacher' | 'student' | 'guest';
  loginMethod?: string;
  avatarUrl?: string;
}): Promise<string | null> {
  try {
    const logsRef = collection(db, 'login_logs');
    const nowIso = new Date().toISOString();
    const docRef = await addDoc(logsRef, {
      email: data.email,
      displayName: data.displayName || data.email.split('@')[0],
      role: data.role || 'guest',
      loginMethod: data.loginMethod || 'Google SSO',
      status: 'online',
      loginTimestamp: nowIso,
      source: 'System Test - ACU Learning Media & Innovation',
      avatarUrl: data.avatarUrl || '',
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.error('Failed to log login event to Firebase Firestore:', err);
    return null;
  }
}

/**
 * Fetch latest login logs for the System Test dashboard
 */
export async function fetchRecentLoginLogs(maxCount = 10): Promise<LoginLogEntry[]> {
  try {
    const logsRef = collection(db, 'login_logs');
    const q = query(logsRef, orderBy('createdAt', 'desc'), limit(maxCount));
    const snapshot = await getDocs(q);
    const logs: LoginLogEntry[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      logs.push({
        id: docSnap.id,
        email: d.email || '',
        displayName: d.displayName || '',
        role: d.role || 'guest',
        loginMethod: d.loginMethod || 'Google SSO',
        status: d.status || 'online',
        loginTimestamp: d.loginTimestamp || new Date().toISOString(),
        source: d.source || 'System Test',
        avatarUrl: d.avatarUrl || '',
      });
    });
    return logs;
  } catch (err) {
    console.error('Failed to fetch login logs from Firestore:', err);
    return [];
  }
}

/**
 * Save customized user profile picture to Firestore
 */
export async function saveUserProfile(profile: UserProfileData): Promise<boolean> {
  try {
    const safeDocId = encodeURIComponent(profile.email.toLowerCase().trim());
    const profileRef = doc(db, 'user_profiles', safeDocId);
    await setDoc(profileRef, {
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to save user profile to Firestore:', err);
    return false;
  }
}

/**
 * Fetch user profile from Firestore
 */
export async function fetchUserProfile(email: string): Promise<UserProfileData | null> {
  try {
    const safeDocId = encodeURIComponent(email.toLowerCase().trim());
    const profileRef = doc(db, 'user_profiles', safeDocId);
    const snapshot = await getDoc(profileRef);
    if (snapshot.exists()) {
      return snapshot.data() as UserProfileData;
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch user profile from Firestore:', err);
    return null;
  }
}
