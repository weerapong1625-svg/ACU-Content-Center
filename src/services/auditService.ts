import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, doc, setDoc, getDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { getDeletedUserEmails, resetUserProfileVisitStats } from './userProfileService';

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
function getValidTimestampMs(ts?: string): number {
  if (!ts) return 0;
  const ms = new Date(ts).getTime();
  return isNaN(ms) ? 0 : ms;
}

function deduplicateConsecutiveLogs(logs: LoginLogEntry[]): LoginLogEntry[] {
  if (logs.length <= 1) return logs;
  const sorted = [...logs].sort((a, b) => getValidTimestampMs(b.loginTimestamp) - getValidTimestampMs(a.loginTimestamp));
  const result: LoginLogEntry[] = [];
  
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = result[result.length - 1];
    if (prev && prev.email.toLowerCase().trim() === current.email.toLowerCase().trim()) {
      const prevTime = getValidTimestampMs(prev.loginTimestamp);
      const currTime = getValidTimestampMs(current.loginTimestamp);
      // If within 2 minutes (120,000 ms), it is an unwanted duplicate from double-logging
      if (prevTime > 0 && currTime > 0 && Math.abs(prevTime - currTime) < 120000) {
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
  const deletedEmails = getDeletedUserEmails();
  const valid = logs.filter((log) => {
    if (!log || typeof log !== 'object') return false;
    const id = String(log.id || '');
    if (id.startsWith('seed-') || id.includes('seed-log-')) return false;
    const email = String(log.email || '').toLowerCase().trim();
    if (FAKE_SAMPLE_EMAILS.has(email) || deletedEmails.has(email)) return false;
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

  const nowDate = new Date(now);
  const nowIso = nowDate.toISOString();
  const isAdmin = normEmail === 'weerapong1625@acu.ac.th';
  const newLog: LoginLogEntry = {
    id: `log-${now}-${Math.random().toString(36).substring(2, 7)}`,
    email: normEmail,
    displayName: isAdmin ? '(Admin) ม.วีระพงษ์ มีทรัพย์' : (data.displayName || normEmail.split('@')[0]),
    role: data.role || (isAdmin ? 'admin' : 'teacher'),
    loginMethod: data.loginMethod || 'Google SSO',
    status: 'online',
    loginTimestamp: nowIso,
    loginDate: nowDate.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
    loginTime: nowDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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
 * Reset Admin's own login logs / visitor statistics to 0 immediately
 * Preserves all other users' logs and never touches media/submissions
 */
export async function resetAdminLoginLogs(
  adminEmail: string = 'weerapong1625@acu.ac.th'
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const normAdmin = adminEmail.toLowerCase().trim();
    const localLogs = getLocalLoginLogs();
    const adminLogs = localLogs.filter(l => (l.email || '').trim().toLowerCase() === normAdmin);
    let count = adminLogs.length;
    const remaining = localLogs.filter(l => (l.email || '').trim().toLowerCase() !== normAdmin);

    if (lastLogEmail === normAdmin) {
      lastLogEmail = '';
      lastLogTime = 0;
    }

    // 1. Immediately update localStorage and emit event (0ms latency)
    saveLocalLoginLogs(remaining, true);

    // 2. Clear sessionStorage visit flags for Admin
    if (typeof window !== 'undefined') {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('acu_visit_logged_') && key.includes(normAdmin)) {
            sessionStorage.removeItem(key);
          }
        }
        if ((sessionStorage.getItem('acu_last_login_logged_email') || '').toLowerCase().trim() === normAdmin) {
          sessionStorage.removeItem('acu_last_login_logged_email');
          sessionStorage.removeItem('acu_last_login_logged_time');
        }
      } catch {
        // ignore
      }
    }

    // 3. Reset profile stats for admin
    await resetUserProfileVisitStats(normAdmin, normAdmin);

    // 4. Delete Admin docs from Firestore login_logs
    try {
      const logsRef = collection(db, 'login_logs');
      const snapshot = await getDocs(logsRef);
      const docsToDelete = snapshot.docs.filter(
        d => ((d.data().email || d.data().userEmail || '') as string).toLowerCase().trim() === normAdmin
      );
      if (docsToDelete.length > count) {
        count = docsToDelete.length;
      }

      for (let i = 0; i < docsToDelete.length; i += 100) {
        const chunk = docsToDelete.slice(i, i + 100);
        const batch = writeBatch(db);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (fsErr) {
      console.warn('Firestore admin logs delete deferred (quota/offline):', fsErr);
    }

    return { success: true, count };
  } catch (err: any) {
    console.error('Failed to reset admin login logs:', err);
    return { success: false, count: 0, error: err?.message || 'เกิดข้อผิดพลาดในการรีเซ็ต' };
  }
}

/**
 * Reset all OTHER users' login logs / visitor statistics to 0 immediately
 * Preserves Admin's logs and never touches media/submissions
 */
export async function resetOthersLoginLogs(
  adminEmail: string = 'weerapong1625@acu.ac.th'
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const normAdmin = adminEmail.toLowerCase().trim();
    const localLogs = getLocalLoginLogs();
    const othersLogs = localLogs.filter(l => (l.email || '').trim().toLowerCase() !== normAdmin);
    let count = othersLogs.length;
    const remaining = localLogs.filter(l => (l.email || '').trim().toLowerCase() === normAdmin);

    if (lastLogEmail && lastLogEmail !== normAdmin) {
      lastLogEmail = '';
      lastLogTime = 0;
    }

    // 1. Immediately update localStorage and emit event (0ms latency)
    saveLocalLoginLogs(remaining, true);

    // 2. Clear sessionStorage visit flags for other users
    if (typeof window !== 'undefined') {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('acu_visit_logged_') && !key.includes(normAdmin)) {
            sessionStorage.removeItem(key);
          }
        }
        const sessEmail = (sessionStorage.getItem('acu_last_login_logged_email') || '').toLowerCase().trim();
        if (sessEmail && sessEmail !== normAdmin) {
          sessionStorage.removeItem('acu_last_login_logged_email');
          sessionStorage.removeItem('acu_last_login_logged_time');
        }
      } catch {
        // ignore
      }
    }

    // 3. Reset profile stats for others
    await resetUserProfileVisitStats('all_others', normAdmin);

    // 4. Delete other users' docs from Firestore login_logs
    try {
      const logsRef = collection(db, 'login_logs');
      const snapshot = await getDocs(logsRef);
      const docsToDelete = snapshot.docs.filter(
        d => ((d.data().email || d.data().userEmail || '') as string).toLowerCase().trim() !== normAdmin
      );
      if (docsToDelete.length > count) {
        count = docsToDelete.length;
      }

      for (let i = 0; i < docsToDelete.length; i += 100) {
        const chunk = docsToDelete.slice(i, i + 100);
        const batch = writeBatch(db);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (fsErr) {
      console.warn('Firestore others logs delete deferred (quota/offline):', fsErr);
    }

    return { success: true, count };
  } catch (err: any) {
    console.error('Failed to reset others login logs:', err);
    return { success: false, count: 0, error: err?.message || 'เกิดข้อผิดพลาดในการรีเซ็ต' };
  }
}

/**
 * Reset a specific user's login logs / visitor statistics to 0
 * Preserves all other users' logs and never touches media/submissions
 */
export async function resetUserLoginLogsByEmail(
  targetEmail: string,
  adminEmail: string = 'weerapong1625@acu.ac.th'
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const normTarget = targetEmail.toLowerCase().trim();
    const normAdmin = adminEmail.toLowerCase().trim();
    if (!normTarget) {
      return { success: false, count: 0, error: 'ไม่พบอีเมลเป้าหมาย' };
    }

    const localLogs = getLocalLoginLogs();
    const targetLogs = localLogs.filter(l => (l.email || '').trim().toLowerCase() === normTarget);
    let count = targetLogs.length;
    const remaining = localLogs.filter(l => (l.email || '').trim().toLowerCase() !== normTarget);

    if (lastLogEmail === normTarget) {
      lastLogEmail = '';
      lastLogTime = 0;
    }

    saveLocalLoginLogs(remaining, true);

    if (typeof window !== 'undefined') {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('acu_visit_logged_') && key.includes(normTarget)) {
            sessionStorage.removeItem(key);
          }
        }
        if ((sessionStorage.getItem('acu_last_login_logged_email') || '').toLowerCase().trim() === normTarget) {
          sessionStorage.removeItem('acu_last_login_logged_email');
          sessionStorage.removeItem('acu_last_login_logged_time');
        }
      } catch {
        // ignore
      }
    }

    await resetUserProfileVisitStats(normTarget, normAdmin);

    try {
      const logsRef = collection(db, 'login_logs');
      const snapshot = await getDocs(logsRef);
      const docsToDelete = snapshot.docs.filter(
        d => ((d.data().email || d.data().userEmail || '') as string).toLowerCase().trim() === normTarget
      );
      if (docsToDelete.length > count) {
        count = docsToDelete.length;
      }

      for (let i = 0; i < docsToDelete.length; i += 100) {
        const chunk = docsToDelete.slice(i, i + 100);
        const batch = writeBatch(db);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (fsErr) {
      console.warn('Firestore user logs delete deferred (quota/offline):', fsErr);
    }

    return { success: true, count };
  } catch (err: any) {
    console.error('Failed to reset user login logs:', err);
    return { success: false, count: 0, error: err?.message || 'เกิดข้อผิดพลาดในการรีเซ็ต' };
  }
}

/**
 * Reset all login logs / visitor statistics in Firestore and localStorage to 0
 * Never touches media or submission databases
 */
export async function resetAllLoginLogs(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const localLogs = getLocalLoginLogs();
    let count = localLogs.length;

    lastLogEmail = '';
    lastLogTime = 0;

    // 1. Clear local storage immediately (0ms)
    saveLocalLoginLogs([], true);

    // 2. Clear all sessionStorage visit flags
    if (typeof window !== 'undefined') {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('acu_visit_logged_')) {
            sessionStorage.removeItem(key);
          }
        }
        sessionStorage.removeItem('acu_last_login_logged_email');
        sessionStorage.removeItem('acu_last_login_logged_time');
      } catch {
        // ignore
      }
    }

    // 3. Reset all user profile visit stats (never touches innovations/media)
    await resetUserProfileVisitStats('all');

    // 4. Attempt to clear Firestore
    try {
      const logsRef = collection(db, 'login_logs');
      const snapshot = await getDocs(logsRef);
      const docs = snapshot.docs;
      if (docs.length > count) {
        count = docs.length;
      }

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
 * Delete all login logs belonging to a specific user email
 */
export function deleteLoginLogsByEmail(targetEmail: string): void {
  const norm = targetEmail.trim().toLowerCase();
  const current = getLocalLoginLogs();
  const filtered = current.filter(l => (l.email || '').trim().toLowerCase() !== norm);
  saveLocalLoginLogs(filtered, true);

  // Clear sessionStorage visit flag
  if (typeof window !== 'undefined') {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('acu_visit_logged_') && key.includes(norm)) {
          sessionStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  }

  // Async delete from Firestore
  try {
    getDocs(collection(db, 'login_logs')).then((snapshot) => {
      const matchingDocs = snapshot.docs.filter(
        d => (d.data().email || '').toLowerCase().trim() === norm
      );
      if (matchingDocs.length > 0) {
        const batch = writeBatch(db);
        matchingDocs.forEach(d => batch.delete(d.ref));
        batch.commit().catch(() => {});
      }
    }).catch(() => {});
  } catch {
    // ignore
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

  const handleUserDeleted = () => {
    callback(getLocalLoginLogs());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('acu_login_logs_updated', handleLocalUpdate);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('acu_user_deleted', handleUserDeleted);
  }

  // 3. Subscribe to ALL Firestore login_logs (without limit(500) or orderBy exclusion)
  let unsubscribeFirestore = () => {};
  try {
    const logsRef = collection(db, 'login_logs');
    unsubscribeFirestore = onSnapshot(
      logsRef,
      (snapshot) => {
        const fsLogs: LoginLogEntry[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const resolvedEmail = (d.email || d.userEmail || '').toString().trim().toLowerCase();
          const resolvedTimestamp =
            d.loginTimestamp ||
            (d.createdAt?.toDate
              ? d.createdAt.toDate().toISOString()
              : typeof d.createdAt === 'string'
                ? d.createdAt
                : '') ||
            d.timestamp ||
            new Date().toISOString();
          const tsDate = new Date(resolvedTimestamp);
          const validDate = !isNaN(tsDate.getTime());

          fsLogs.push({
            id: docSnap.id,
            email: resolvedEmail,
            displayName: d.displayName || resolvedEmail.split('@')[0] || 'ผู้ใช้งาน',
            role: d.role || 'teacher',
            loginMethod: d.loginMethod || 'Google SSO',
            status: d.status || 'online',
            loginTimestamp: resolvedTimestamp,
            loginDate:
              d.loginDate ||
              (validDate ? tsDate.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'),
            loginTime:
              d.loginTime ||
              (validDate ? tsDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'),
            source: d.source || 'ACU Portal',
            avatarUrl: d.avatarUrl || '',
          });
        });

        const nowMs = Date.now();
        // Preserve very recent local logs (<15s) while addDoc is in flight,
        // otherwise respect authoritative Firestore state when not from cache (so resets sync to 0 cleanly)
        const pendingLocalLogs = getLocalLoginLogs().filter((l) => {
          const ts = getValidTimestampMs(l.loginTimestamp);
          return ts > 0 && nowMs - ts < 15000;
        });

        const baseLocal = snapshot.metadata.fromCache ? getLocalLoginLogs() : pendingLocalLogs;
        const merged = mergeLogs(fsLogs, baseLocal);
        saveLocalLoginLogs(merged, false);
        callback(merged);
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
      window.removeEventListener('acu_user_deleted', handleUserDeleted);
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
