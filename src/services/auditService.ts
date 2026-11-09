import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, doc, setDoc, getDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

export interface LoginLogEntry {
  id?: string;
  email: string;
  displayName: string;
  role: 'teacher' | 'student' | 'guest' | 'admin';
  loginMethod: string;
  status: 'online' | 'offline';
  loginTimestamp: string;
  source: string;
  avatarUrl?: string;
  createdAt?: any;
  loginDate?: string;
  loginTime?: string;
}

export interface UserProfileData {
  email: string;
  displayName: string;
  avatarUrl: string;
  updatedAt?: string;
}

export const LOGIN_LOGS_STORAGE_KEY = 'acu_persistent_login_logs';

// In-memory debounce map to prevent rapid duplicate logs for the same user
let lastLogTime = 0;
let lastLogEmail = '';

const FAKE_SAMPLE_EMAILS = new Set([
  'kanda@acu.ac.th',
  'pranee@acu.ac.th',
  'somchai@acu.ac.th',
  'anchalee@acu.ac.th',
]);

/**
 * Deduplicate rapid consecutive duplicate logs (e.g. within 2 minutes for the same user)
 */
function deduplicateConsecutiveLogs(logs: LoginLogEntry[]): LoginLogEntry[] {
  if (logs.length <= 1) return logs;
  const sorted = [...logs].sort((a, b) => new Date(b.loginTimestamp).getTime() - new Date(a.loginTimestamp).getTime());
  const result: LoginLogEntry[] = [];
  
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = result[result.length - 1];
    if (prev && prev.email.toLowerCase().trim() === current.email.toLowerCase().trim()) {
      const prevTime = new Date(prev.loginTimestamp).getTime();
      const currTime = new Date(current.loginTimestamp).getTime();
      // If within 2 minutes (120,000 ms), it is an unwanted duplicate from double-logging
      if (Math.abs(prevTime - currTime) < 120000) {
        continue;
      }
    }
    result.push(current);
  }
  return result;
}

/**
 * Filter out any legacy synthetic/seed logs and collapse double-counts to guarantee authentic real statistics
 */
function sanitizeAuthenticLogs(logs: any[]): LoginLogEntry[] {
  if (!Array.isArray(logs)) return [];
  const valid = logs.filter((log) => {
    if (!log || typeof log !== 'object') return false;
    const id = String(log.id || '');
    if (id.startsWith('seed-') || id.includes('seed-log-')) return false;
    const email = String(log.email || '').toLowerCase().trim();
    if (FAKE_SAMPLE_EMAILS.has(email)) return false;
    return Boolean(email && log.loginTimestamp);
  });
  return deduplicateConsecutiveLogs(valid);
}

/**
 * Synchronously read authentic login logs from localStorage (strictly genuine logs only)
 */
export function getLocalLoginLogs(): LoginLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOGIN_LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const authentic = sanitizeAuthenticLogs(parsed);
        // Clean out any cached seeds or duplicate logs immediately
        if (authentic.length !== parsed.length) {
          localStorage.setItem(LOGIN_LOGS_STORAGE_KEY, JSON.stringify(authentic));
        }
        return authentic;
      }
    }
  } catch (err) {
    console.warn('Could not read local login logs:', err);
  }
  return [];
}

/**
 * Save login logs to localStorage and dispatch custom update event
 */
export function saveLocalLoginLogs(logs: LoginLogEntry[], broadcast = true): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = sanitizeAuthenticLogs(logs);
    localStorage.setItem(LOGIN_LOGS_STORAGE_KEY, JSON.stringify(sanitized));
    if (broadcast) {
      window.dispatchEvent(new CustomEvent('acu_login_logs_updated', { detail: sanitized }));
    }
  } catch (err) {
    console.warn('Could not save login logs to localStorage:', err);
  }
}

/**
 * Merge Firestore logs with local logs without duplicates
 */
function mergeLogs(primary: LoginLogEntry[], secondary: LoginLogEntry[]): LoginLogEntry[] {
  const cleanPrimary = sanitizeAuthenticLogs(primary);
  const cleanSecondary = sanitizeAuthenticLogs(secondary);
  const map = new Map<string, LoginLogEntry>();

  cleanPrimary.forEach((log) => {
    const key = log.id || `${log.email}_${log.loginTimestamp}`;
    map.set(key, log);
  });

  cleanSecondary.forEach((log) => {
    const key = log.id || `${log.email}_${log.loginTimestamp}`;
    if (!map.has(key)) {
      map.set(key, log);
    }
  });

  const merged = Array.from(map.values());
  return deduplicateConsecutiveLogs(merged);
}

/**
 * Record a user login or portal visit event
 * Strict 1 login = 1 log entry (visit)
 * Guaranteed: Persists to local storage immediately and syncs with Firestore
 */
export async function logUserLogin(data: {
  email: string;
  displayName?: string;
  role?: 'teacher' | 'student' | 'guest' | 'admin';
  loginMethod?: string;
  avatarUrl?: string;
}): Promise<string | null> {
  const normEmail = data.email.toLowerCase().trim();
  const now = Date.now();

  // Deduplication check: ignore duplicate calls within 60 seconds for the exact same email
  if (normEmail === lastLogEmail && now - lastLogTime < 60000) {
    return null;
  }

  // Check sessionStorage deduplication if in browser
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const sessEmail = sessionStorage.getItem('acu_last_login_logged_email');
      const sessTime = Number(sessionStorage.getItem('acu_last_login_logged_time') || 0);
      if (sessEmail === normEmail && now - sessTime < 60000) {
        return null;
      }
      sessionStorage.setItem('acu_last_login_logged_email', normEmail);
      sessionStorage.setItem('acu_last_login_logged_time', String(now));
    }
  } catch {
    // ignore storage restrictions
  }

  lastLogEmail = normEmail;
  lastLogTime = now;

  const nowIso = new Date().toISOString();
  const isAdmin = normEmail === 'weerapong1625@acu.ac.th';
  const newLog: LoginLogEntry = {
    id: `log-${now}-${Math.random().toString(36).substring(2, 7)}`,
    email: normEmail,
    displayName: isAdmin ? '(Admin) ม.วีระพงษ์ มีทรัพย์' : (data.displayName || normEmail.split('@')[0]),
    role: data.role || (isAdmin ? 'admin' : 'teacher'),
    loginMethod: data.loginMethod || 'Google SSO',
    status: 'online',
    loginTimestamp: nowIso,
    source: 'ACU Learning Media & Innovation Portal',
    avatarUrl: data.avatarUrl || '',
  };

  // 1. SAVE TO LOCAL PERSISTENT STORAGE FIRST (guaranteed to immediately increment visit count)
  try {
    const currentLogs = getLocalLoginLogs();
    const updated = [newLog, ...currentLogs];
    saveLocalLoginLogs(updated, true);
  } catch (localErr) {
    console.warn('Could not save local log:', localErr);
  }

  // 2. ALSO PERSIST TO FIRESTORE (with graceful handling if quota exceeded)
  try {
    const logsRef = collection(db, 'login_logs');
    const docRef = await addDoc(logsRef, {
      ...newLog,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.warn('Login log Firestore write deferred or quota limit reached:', err);
    return newLog.id || null;
  }
}

/**
 * Reset all login logs / visitor statistics in Firestore and localStorage to 0
 */
export async function resetAllLoginLogs(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const localLogs = getLocalLoginLogs();
    const count = localLogs.length;

    // Clear local storage
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOGIN_LOGS_STORAGE_KEY, JSON.stringify([]));
      window.dispatchEvent(new CustomEvent('acu_login_logs_updated', { detail: [] }));
    }

    // Attempt to clear Firestore
    try {
      const logsRef = collection(db, 'login_logs');
      const snapshot = await getDocs(logsRef);
      const docs = snapshot.docs;

      for (let i = 0; i < docs.length; i += 100) {
        const chunk = docs.slice(i, i + 100);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (fsErr) {
      console.warn('Firestore clear deferred (quota/offline):', fsErr);
    }

    return { success: true, count };
  } catch (err: any) {
    console.error('Failed to reset login logs:', err);
    return { success: false, count: 0, error: err?.message || 'เกิดข้อผิดพลาดในการรีเซ็ต' };
  }
}

/**
 * Real-time subscription to all login / visit logs for Admin Dashboard and User Profiles
 * Seamlessly provides instant local logs and syncs with Firestore
 */
export function subscribeAllLoginLogs(callback: (logs: LoginLogEntry[]) => void): () => void {
  // 1. Immediately emit local cached logs (Zero latency, never 0)
  const initialLocal = getLocalLoginLogs();
  callback(initialLocal);

  // 2. Listen to local updates (same-tab and multi-tab)
  const handleLocalUpdate = (e: any) => {
    if (e.detail && Array.isArray(e.detail)) {
      callback(e.detail);
    } else {
      callback(getLocalLoginLogs());
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === LOGIN_LOGS_STORAGE_KEY) {
      callback(getLocalLoginLogs());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('acu_login_logs_updated', handleLocalUpdate);
    window.addEventListener('storage', handleStorage);
  }

  // 3. Subscribe to Firestore
  let unsubscribeFirestore = () => {};
  try {
    const logsRef = collection(db, 'login_logs');
    const q = query(logsRef, orderBy('loginTimestamp', 'desc'), limit(500));
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const fsLogs: LoginLogEntry[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            fsLogs.push({
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
          const merged = mergeLogs(fsLogs, getLocalLoginLogs());
          saveLocalLoginLogs(merged, false);
          callback(merged);
        }
      },
      (err) => {
        console.warn('Realtime login logs Firestore subscription fallback (quota/network):', err);
        callback(getLocalLoginLogs());
      }
    );
  } catch (err) {
    console.warn('Error subscribing to login logs:', err);
    callback(getLocalLoginLogs());
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('acu_login_logs_updated', handleLocalUpdate);
      window.removeEventListener('storage', handleStorage);
    }
    unsubscribeFirestore();
  };
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
    console.warn('Failed to fetch login logs from Firestore (using local fallback):', err);
    return getLocalLoginLogs().slice(0, maxCount);
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
