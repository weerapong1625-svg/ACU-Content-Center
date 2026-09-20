import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
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
 * Real-time subscription to all login / visit logs for Admin Dashboard
 */
export function subscribeAllLoginLogs(callback: (logs: LoginLogEntry[]) => void): () => void {
  try {
    const logsRef = collection(db, 'login_logs');
    const q = query(logsRef, orderBy('loginTimestamp', 'desc'), limit(500));
    return onSnapshot(
      q,
      (snapshot) => {
        const logs: LoginLogEntry[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          logs.push({
            id: docSnap.id,
            email: d.email || '',
            displayName: d.displayName || d.email?.split('@')[0] || 'ผู้ใช้งาน',
            role: d.role || 'teacher',
            loginMethod: d.loginMethod || 'Google SSO',
            status: d.status || 'online',
            loginTimestamp: d.loginTimestamp || (d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString()),
            source: d.source || 'ACU Portal',
            avatarUrl: d.avatarUrl || '',
          });
        });
        callback(logs);
      },
      (err) => {
        console.warn('Realtime login logs subscription fallback:', err);
        fetchRecentLoginLogs(100).then(callback);
      }
    );
  } catch (err) {
    console.warn('Error subscribing to login logs:', err);
    fetchRecentLoginLogs(100).then(callback);
    return () => {};
  }
}

/**
 * Generate TSV data for Google Sheets paste
 */
export function generateLoginLogsTSV(logs: LoginLogEntry[]): string {
  const headers = ['ลำดับ', 'อีเมลผู้ใช้งาน', 'ชื่อ-นามสกุล / ชื่อผู้ใช้', 'บทบาท', 'วิธีเข้าสู่ระบบ', 'วันเดือนปี (พ.ศ.)', 'เวลา'];
  const rows = logs.map((log, index) => {
    const dateObj = new Date(log.loginTimestamp);
    const dateStr = isNaN(dateObj.getTime())
      ? '-'
      : dateObj.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = isNaN(dateObj.getTime())
      ? '-'
      : dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return [
      index + 1,
      log.email,
      log.displayName,
      log.role === 'teacher' ? 'ครูผู้สอน' : log.role === 'student' ? 'นักเรียน' : 'ผู้ใช้งานทั่วไป',
      log.loginMethod,
      dateStr,
      timeStr,
    ].join('\t');
  });

  return [headers.join('\t'), ...rows].join('\n');
}

/**
 * Generate CSV file for download
 */
export function generateLoginLogsCSV(logs: LoginLogEntry[]): string {
  const escapeCSV = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const headers = ['ลำดับ', 'อีเมลผู้ใช้งาน', 'ชื่อผู้ใช้', 'บทบาท', 'วิธีเข้าสู่ระบบ', 'วันเดือนปี', 'เวลา', 'ISO Timestamp'];
  const rows = logs.map((log, index) => {
    const dateObj = new Date(log.loginTimestamp);
    const dateStr = isNaN(dateObj.getTime())
      ? '-'
      : dateObj.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = isNaN(dateObj.getTime())
      ? '-'
      : dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    return [
      escapeCSV(index + 1),
      escapeCSV(log.email),
      escapeCSV(log.displayName),
      escapeCSV(log.role === 'teacher' ? 'ครูผู้สอน' : log.role === 'student' ? 'นักเรียน' : 'ผู้ใช้งานทั่วไป'),
      escapeCSV(log.loginMethod),
      escapeCSV(dateStr),
      escapeCSV(timeStr),
      escapeCSV(log.loginTimestamp),
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
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
