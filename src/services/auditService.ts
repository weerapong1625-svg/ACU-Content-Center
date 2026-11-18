import { collection, serverTimestamp, getDocs, query, orderBy, limit, doc, setDoc, getDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { getDeletedUserEmails, resetUserProfileVisitStats } from './userProfileService';

export interface LoginLogEntry {
  id?: string;
  clientLogId?: string;
  deviceId?: string;
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
const PENDING_LOGIN_LOGS_KEY = 'acu_pending_login_logs';
const DEVICE_ID_STORAGE_KEY = 'acu_device_id';

// In-memory debounce map to prevent rapid duplicate logs for the same user on this device
let lastLogTime = 0;
let lastLogEmail = '';

// Shared multiplexed Firestore subscription state (prevents duplicate listeners & ensures 100% identical data across components)
const logListeners = new Set<(logs: LoginLogEntry[]) => void>();
let sharedUnsubscribeFirestore: (() => void) | null = null;
let sharedLatestLogs: LoginLogEntry[] | null = null;
let hasReceivedServerSnapshot = false;
let isFlushingPendingLogs = false;
let windowSyncListenersAttached = false;

const FAKE_SAMPLE_EMAILS = new Set([
  'kanda@acu.ac.th',
  'pranee@acu.ac.th',
  'somchai@acu.ac.th',
  'anchalee@acu.ac.th',
]);

/**
 * Cached Intl.DateTimeFormat & memo map so repeated calls across thousands of logs
 * in AdminDashboard & UserProfileModal execute in O(1) without allocating formatters.
 */
const bangkokDateFormatter = (() => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return null;
  }
})();

const bangkokPartsCache = new Map<string, { year: number; monthIndex: number; day: number; dateKey: string } | null>();

/**
 * Get consistent Thailand (Asia/Bangkok, UTC+7) date parts so all devices
 * (tablet, laptop, mobile) compute identical day/month/year regardless of OS timezone.
 */
export function getBangkokDateParts(input?: string | number | Date): {
  year: number;
  monthIndex: number; // 0-11
  day: number; // 1-31
  dateKey: string; // YYYY-MM-DD
} | null {
  if (typeof input === 'string' && input) {
    const cached = bangkokPartsCache.get(input);
    if (cached !== undefined) return cached;
  }

  let result: { year: number; monthIndex: number; day: number; dateKey: string } | null = null;
  try {
    const date = input instanceof Date ? input : input !== undefined ? new Date(input) : new Date();
    if (isNaN(date.getTime())) {
      result = null;
    } else if (bangkokDateFormatter) {
      const formatted = bangkokDateFormatter.format(date);
      const parts = formatted.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(monthIndex) && !isNaN(day)) {
          result = { year, monthIndex, day, dateKey: formatted };
        }
      }
    } else {
      const y = date.getFullYear();
      const m = date.getMonth();
      const d = date.getDate();
      result = {
        year: y,
        monthIndex: m,
        day: d,
        dateKey: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      };
    }
  } catch {
    try {
      const date = input instanceof Date ? input : input !== undefined ? new Date(input) : new Date();
      if (!isNaN(date.getTime())) {
        const y = date.getFullYear();
        const m = date.getMonth();
        const d = date.getDate();
        result = {
          year: y,
          monthIndex: m,
          day: d,
          dateKey: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        };
      }
    } catch {
      result = null;
    }
  }

  if (typeof input === 'string' && input) {
    if (bangkokPartsCache.size > 4000) {
      bangkokPartsCache.clear();
    }
    bangkokPartsCache.set(input, result);
  }
  return result;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!deviceId || !deviceId.trim()) {
      deviceId = `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return `dev-mem-${Math.random().toString(36).substring(2, 8)}`;
  }
}

function getValidTimestampMs(ts?: string): number {
  if (!ts) return 0;
  const ms = new Date(ts).getTime();
  return isNaN(ms) ? 0 : ms;
}

/**
 * Deduplicate only genuine duplicate writes (same doc/clientLogId, or rapid double-fire
 * within 15s on the SAME device or legacy logs without deviceId).
 * NEVER collapses legitimate logins from different devices (tablet vs laptop vs mobile)!
 */
function deduplicateConsecutiveLogs(logs: LoginLogEntry[]): LoginLogEntry[] {
  if (logs.length <= 1) return logs;
  const sorted = [...logs].sort((a, b) => getValidTimestampMs(b.loginTimestamp) - getValidTimestampMs(a.loginTimestamp));
  const result: LoginLogEntry[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const uniqueKey = current.clientLogId || current.id;
    if (uniqueKey && seenKeys.has(uniqueKey)) {
      continue;
    }

    const currEmail = (current.email || '').toLowerCase().trim();
    const currTime = getValidTimestampMs(current.loginTimestamp);
    const currDev = current.deviceId || '';

    // Check against recent entries for same email only within 15 seconds on same/unknown device
    let isDoubleFire = false;
    for (let j = result.length - 1; j >= 0; j--) {
      const prev = result[j];
      const prevTime = getValidTimestampMs(prev.loginTimestamp);
      if (prevTime > 0 && currTime > 0 && Math.abs(prevTime - currTime) >= 15000) {
        break; // sorted descending, so older entries are >= 15s away
      }
      if ((prev.email || '').toLowerCase().trim() === currEmail) {
        const prevDev = prev.deviceId || '';
        // Only treat as double-fire if BOTH come from the exact same deviceId or legacy entries without deviceId
        const sameOrUnknownDevice = (currDev && prevDev && currDev === prevDev) || (!currDev && !prevDev);
        if (sameOrUnknownDevice) {
          isDoubleFire = true;
          break;
        }
      }
    }

    if (isDoubleFire) {
      continue;
    }

    if (uniqueKey) seenKeys.add(uniqueKey);
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
 * Pending outbox helpers (logs created locally on this device awaiting Firestore confirmation)
 */
function getPendingLoginLogs(): LoginLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_LOGIN_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sanitizeAuthenticLogs(parsed) : [];
  } catch {
    return [];
  }
}

function savePendingLoginLogs(logs: LoginLogEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = sanitizeAuthenticLogs(logs);
    localStorage.setItem(PENDING_LOGIN_LOGS_KEY, JSON.stringify(clean));
  } catch {
    // ignore
  }
}

function addPendingLoginLog(entry: LoginLogEntry): void {
  const current = getPendingLoginLogs();
  const key = entry.clientLogId || entry.id;
  if (key && current.some((l) => (l.clientLogId || l.id) === key)) return;
  savePendingLoginLogs([entry, ...current]);
}

function removePendingLoginLogByIds(confirmedIds: Set<string>): void {
  if (confirmedIds.size === 0) return;
  const current = getPendingLoginLogs();
  if (current.length === 0) return;
  const remaining = current.filter((l) => {
    const idMatch = l.id && confirmedIds.has(l.id);
    const clientMatch = l.clientLogId && confirmedIds.has(l.clientLogId);
    return !idMatch && !clientMatch;
  });
  if (remaining.length !== current.length) {
    savePendingLoginLogs(remaining);
  }
}

function broadcastLogsToListeners(logs: LoginLogEntry[]): void {
  sharedLatestLogs = logs;
  logListeners.forEach((cb) => {
    try {
      cb(logs);
    } catch (err) {
      console.warn('Error in login log subscriber:', err);
    }
  });
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
      broadcastLogsToListeners(sanitized);
      window.dispatchEvent(new CustomEvent('acu_login_logs_updated', { detail: sanitized }));
    }
  } catch (err) {
    console.warn('Could not save login logs to localStorage:', err);
  }
}

/**
 * Merge Firestore logs with pending/local logs without duplicates
 */
function mergeLogs(primary: LoginLogEntry[], secondary: LoginLogEntry[]): LoginLogEntry[] {
  const cleanPrimary = sanitizeAuthenticLogs(primary);
  const cleanSecondary = sanitizeAuthenticLogs(secondary);
  const map = new Map<string, LoginLogEntry>();

  cleanPrimary.forEach((log) => {
    const key = log.clientLogId || log.id || `${log.email}_${log.loginTimestamp}`;
    map.set(key, log);
  });

  cleanSecondary.forEach((log) => {
    const key = log.clientLogId || log.id || `${log.email}_${log.loginTimestamp}`;
    if (!map.has(key)) {
      map.set(key, log);
    }
  });

  const merged = Array.from(map.values());
  return deduplicateConsecutiveLogs(merged);
}

/**
 * Retry writing any unconfirmed pending local login logs to Firestore using deterministic IDs (idempotent).
 */
export async function flushPendingLoginLogs(): Promise<void> {
  if (typeof window === 'undefined' || isFlushingPendingLogs) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const pending = getPendingLoginLogs();
  if (pending.length === 0) return;

  isFlushingPendingLogs = true;
  try {
    const confirmedIds = new Set<string>();
    for (const entry of pending.slice(0, 20)) {
      const docId = entry.id || entry.clientLogId;
      if (!docId) continue;
      try {
        const docRef = doc(db, 'login_logs', docId);
        await setDoc(docRef, {
          ...entry,
          id: docId,
          clientLogId: entry.clientLogId || docId,
          deviceId: entry.deviceId || getOrCreateDeviceId(),
          createdAt: serverTimestamp(),
        }, { merge: true });
        confirmedIds.add(docId);
        if (entry.clientLogId) confirmedIds.add(entry.clientLogId);
      } catch {
        // Leave in outbox to retry on next reconnect / focus
        break;
      }
    }
    if (confirmedIds.size > 0) {
      removePendingLoginLogByIds(confirmedIds);
    }
  } finally {
    isFlushingPendingLogs = false;
  }
}

/**
 * Record a user login or portal visit event
 * Strict 1 login = 1 log entry (visit)
 * Uses deterministic document ID via setDoc + persistent pending outbox so every device syncs identically to Firestore.
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

  // Deduplication check: ignore duplicate calls within 15 seconds on this exact browser tab/device
  if (normEmail === lastLogEmail && now - lastLogTime < 15000) {
    return null;
  }

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const sessEmail = sessionStorage.getItem('acu_last_login_logged_email');
      const sessTime = Number(sessionStorage.getItem('acu_last_login_logged_time') || 0);
      if (sessEmail === normEmail && now - sessTime < 15000) {
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

  const deviceId = getOrCreateDeviceId();
  const logId = `log_${now}_${deviceId}_${Math.random().toString(36).substring(2, 7)}`;
  const nowDate = new Date(now);
  const nowIso = nowDate.toISOString();
  const isAdmin = normEmail === 'weerapong1625@acu.ac.th';
  const newLog: LoginLogEntry = {
    id: logId,
    clientLogId: logId,
    deviceId,
    email: normEmail,
    displayName: isAdmin ? '(Admin) ม.วีระพงษ์ มีทรัพย์' : (data.displayName || normEmail.split('@')[0]),
    role: data.role || (isAdmin ? 'admin' : 'teacher'),
    loginMethod: data.loginMethod || 'Email Login',
    status: 'online',
    loginTimestamp: nowIso,
    loginDate: nowDate.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric' }),
    loginTime: nowDate.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    source: 'ACU Learning Media & Innovation Portal',
    avatarUrl: data.avatarUrl || '',
  };

  // 1. Add to pending outbox + local cache immediately (0ms UI responsiveness)
  addPendingLoginLog(newLog);
  try {
    const baseLogs = sharedLatestLogs || getLocalLoginLogs();
    const updated = mergeLogs([newLog], baseLogs);
    saveLocalLoginLogs(updated, true);
  } catch (localErr) {
    console.warn('Could not save local log:', localErr);
  }

  // 2. Persist to Firestore using deterministic doc ID (idempotent across retries)
  try {
    const docRef = doc(db, 'login_logs', logId);
    await setDoc(docRef, {
      ...newLog,
      createdAt: serverTimestamp(),
    });
    removePendingLoginLogByIds(new Set([logId]));
    return logId;
  } catch (err) {
    console.warn('Login log Firestore write queued in outbox for retry:', err);
    return logId;
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
    const localLogs = sharedLatestLogs || getLocalLoginLogs();
    const adminLogs = localLogs.filter(l => (l.email || '').trim().toLowerCase() === normAdmin);
    let count = adminLogs.length;
    const remaining = localLogs.filter(l => (l.email || '').trim().toLowerCase() !== normAdmin);

    savePendingLoginLogs(getPendingLoginLogs().filter(l => (l.email || '').trim().toLowerCase() !== normAdmin));

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
    const localLogs = sharedLatestLogs || getLocalLoginLogs();
    const othersLogs = localLogs.filter(l => (l.email || '').trim().toLowerCase() !== normAdmin);
    let count = othersLogs.length;
    const remaining = localLogs.filter(l => (l.email || '').trim().toLowerCase() === normAdmin);

    savePendingLoginLogs(getPendingLoginLogs().filter(l => (l.email || '').trim().toLowerCase() === normAdmin));

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

    const localLogs = sharedLatestLogs || getLocalLoginLogs();
    const targetLogs = localLogs.filter(l => (l.email || '').trim().toLowerCase() === normTarget);
    let count = targetLogs.length;
    const remaining = localLogs.filter(l => (l.email || '').trim().toLowerCase() !== normTarget);

    savePendingLoginLogs(getPendingLoginLogs().filter(l => (l.email || '').trim().toLowerCase() !== normTarget));

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
    const localLogs = sharedLatestLogs || getLocalLoginLogs();
    let count = localLogs.length;

    lastLogEmail = '';
    lastLogTime = 0;
    savePendingLoginLogs([]);

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
  const current = sharedLatestLogs || getLocalLoginLogs();
  const filtered = current.filter(l => (l.email || '').trim().toLowerCase() !== norm);
  savePendingLoginLogs(getPendingLoginLogs().filter(l => (l.email || '').trim().toLowerCase() !== norm));
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

function ensureSharedFirestoreSubscription(): void {
  if (sharedUnsubscribeFirestore) return;

  // Flush any pending logs from previous offline sessions
  flushPendingLoginLogs().catch(() => {});

  if (typeof window !== 'undefined' && !windowSyncListenersAttached) {
    windowSyncListenersAttached = true;
    const handleResumeSync = () => {
      flushPendingLoginLogs().catch(() => {});
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        flushPendingLoginLogs().catch(() => {});
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOGIN_LOGS_STORAGE_KEY && !hasReceivedServerSnapshot) {
        const merged = mergeLogs(getLocalLoginLogs(), getPendingLoginLogs());
        broadcastLogsToListeners(merged);
      }
    };
    const handleUserDeleted = () => {
      const base = sharedLatestLogs || getLocalLoginLogs();
      const cleaned = sanitizeAuthenticLogs(base);
      saveLocalLoginLogs(cleaned, true);
    };

    window.addEventListener('online', handleResumeSync);
    window.addEventListener('focus', handleResumeSync);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('acu_user_deleted', handleUserDeleted);
  }

  try {
    const logsRef = collection(db, 'login_logs');
    sharedUnsubscribeFirestore = onSnapshot(
      logsRef,
      (snapshot) => {
        const fsLogs: LoginLogEntry[] = [];
        const confirmedIds = new Set<string>();

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

          confirmedIds.add(docSnap.id);
          if (d.clientLogId) confirmedIds.add(String(d.clientLogId));

          fsLogs.push({
            id: docSnap.id,
            clientLogId: d.clientLogId || docSnap.id,
            deviceId: d.deviceId || '',
            email: resolvedEmail,
            displayName: d.displayName || resolvedEmail.split('@')[0] || 'ผู้ใช้งาน',
            role: d.role || 'teacher',
            loginMethod: d.loginMethod || 'Email Login',
            status: d.status || 'online',
            loginTimestamp: resolvedTimestamp,
            loginDate:
              d.loginDate ||
              (validDate ? tsDate.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric' }) : '-'),
            loginTime:
              d.loginTime ||
              (validDate ? tsDate.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'),
            source: d.source || 'ACU Portal',
            avatarUrl: d.avatarUrl || '',
          });
        });

        let merged: LoginLogEntry[];
        if (!snapshot.metadata.fromCache) {
          hasReceivedServerSnapshot = true;
          // Server confirmed docs can leave the outbox
          removePendingLoginLogByIds(confirmedIds);
          // Authoritative server state + only unconfirmed outbox items from this device
          const remainingPending = getPendingLoginLogs();
          merged = mergeLogs(fsLogs, remainingPending);
        } else {
          // Cache-only emission while offline/connecting: do not overwrite newer server state if already received
          const fallbackLocal = hasReceivedServerSnapshot && sharedLatestLogs
            ? sharedLatestLogs
            : mergeLogs(getLocalLoginLogs(), getPendingLoginLogs());
          merged = mergeLogs(fsLogs, fallbackLocal);
        }

        saveLocalLoginLogs(merged, false);
        broadcastLogsToListeners(merged);
      },
      (err) => {
        console.warn('Realtime login logs Firestore subscription fallback (quota/network):', err);
        const fallback = sharedLatestLogs || mergeLogs(getLocalLoginLogs(), getPendingLoginLogs());
        broadcastLogsToListeners(fallback);
      }
    );
  } catch (err) {
    console.warn('Error subscribing to login logs:', err);
    const fallback = sharedLatestLogs || mergeLogs(getLocalLoginLogs(), getPendingLoginLogs());
    broadcastLogsToListeners(fallback);
  }
}

/**
 * Real-time subscription to all login / visit logs for Admin Dashboard and User Profiles
 * Uses a single shared Firestore listener so every component and device stays 100% synchronized.
 */
export function subscribeAllLoginLogs(callback: (logs: LoginLogEntry[]) => void): () => void {
  logListeners.add(callback);

  // Immediately emit current authoritative in-memory snapshot or local/pending cache
  const initial = sharedLatestLogs || mergeLogs(getLocalLoginLogs(), getPendingLoginLogs());
  callback(initial);

  // Ensure the shared real-time Firestore subscription is active
  ensureSharedFirestoreSubscription();

  return () => {
    logListeners.delete(callback);
    if (logListeners.size === 0 && sharedUnsubscribeFirestore) {
      sharedUnsubscribeFirestore();
      sharedUnsubscribeFirestore = null;
      hasReceivedServerSnapshot = false;
    }
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
