import { collection, serverTimestamp, getDocs, query, orderBy, limit, where, doc, setDoc, getDoc, writeBatch, increment, getCountFromServer } from 'firebase/firestore';
import { db, auth, isQuotaExceededError, notifyQuotaExceeded, waitForAuthReady, isAuthReady } from '../firebase';
import { getDeletedUserEmails, resetUserProfileVisitStats } from './userProfileService';
import { sanitizeAvatarUrl } from '../utils/avatarUtils';

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
const LOGIN_LOGS_FETCHED_AT_KEY = 'acu_login_logs_fetched_at';
export const SITE_SUMMARY_CACHE_KEY = 'acu_site_summary_cache';
export const ADMIN_OVERALL_STATS_CACHE_KEY = 'acu_admin_overall_stats_cache';
export const VISITOR_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes TTL for visitor & summary counts
export const ADMIN_STATS_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL for Admin statistics cache

export interface SiteVisitSummary {
  totalVisits: number;
  yearlyVisits: Record<string, number>;
  monthlyVisits: Record<string, Record<string, number>>;
  dailyVisits: Record<string, number>;
  updatedAt?: string;
  resetAt?: string;
  cachedAt?: number;
}

export interface AdminStatsSummary {
  totalLoginLogsCount: number;
  adminLoginLogsCount: number;
  totalUserProfilesCount: number;
  siteSummary: SiteVisitSummary | null;
  fetchedAt: number;
}

// In-memory debounce map to prevent rapid duplicate logs for the same user on this device
let lastLogTime = 0;
let lastLogEmail = '';

// Shared local listener registry (zero Firestore onSnapshot reads)
const logListeners = new Set<(logs: LoginLogEntry[]) => void>();
let sharedLatestLogs: LoginLogEntry[] | null = null;
let hasFetchedLoginLogsFromServer = false;
let lastLoginLogsFetchedAt = 0;
let inFlightLoginLogsFetch: Promise<LoginLogEntry[]> | null = null;
let isFlushingPendingLogs = false;
let windowSyncListenersAttached = false;

// Shared lightweight summary counter cache (system_settings/site_summary -> 1 getDoc read per 2 min)
const siteSummaryListeners = new Set<(summary: SiteVisitSummary | null) => void>();
let sharedSiteSummary: SiteVisitSummary | null = null;
let inFlightSiteSummaryFetch: Promise<SiteVisitSummary | null> | null = null;
let siteSummaryWindowListenerAttached = false;
let sharedAdminStatsSummary: AdminStatsSummary | null = null;
let inFlightAdminStatsFetch: Promise<AdminStatsSummary | null> | null = null;

const FAKE_SAMPLE_EMAILS = new Set([
  'kanda@acu.ac.th',
  'pranee@acu.ac.th',
  'somchai@acu.ac.th',
  'anchalee@acu.ac.th',
]);

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
  try {
    const date = input instanceof Date ? input : input !== undefined ? new Date(input) : new Date();
    if (isNaN(date.getTime())) return null;
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    const parts = formatted.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(monthIndex) || isNaN(day)) return null;
    return { year, monthIndex, day, dateKey: formatted };
  } catch {
    const date = input instanceof Date ? input : input !== undefined ? new Date(input) : new Date();
    if (isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    return {
      year: y,
      monthIndex: m,
      day: d,
      dateKey: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    };
  }
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
    if (Array.isArray(parsed)) {
      return sanitizeAuthenticLogs(parsed);
    }
    try {
      localStorage.removeItem(PENDING_LOGIN_LOGS_KEY);
    } catch {}
    return [];
  } catch {
    try {
      localStorage.removeItem(PENDING_LOGIN_LOGS_KEY);
    } catch {}
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

export function getLocalSiteSummary(): SiteVisitSummary | null {
  if (sharedSiteSummary) return sharedSiteSummary;
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SITE_SUMMARY_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SiteVisitSummary;
      if (parsed && typeof parsed.totalVisits === 'number') {
        sharedSiteSummary = parsed;
        return parsed;
      }
      try {
        localStorage.removeItem(SITE_SUMMARY_CACHE_KEY);
      } catch {}
    }
  } catch {
    try {
      localStorage.removeItem(SITE_SUMMARY_CACHE_KEY);
    } catch {}
  }
  return null;
}

function saveLocalSiteSummary(summary: SiteVisitSummary, allowZeroReset = false): void {
  const existing = getLocalSiteSummary();
  if (!allowZeroReset && summary.totalVisits === 0 && !summary.resetAt && existing && existing.totalVisits > 0) {
    return;
  }
  const stamped: SiteVisitSummary = {
    ...summary,
    cachedAt: summary.cachedAt ?? Date.now(),
  };
  sharedSiteSummary = stamped;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SITE_SUMMARY_CACHE_KEY, JSON.stringify(stamped));
      window.dispatchEvent(new CustomEvent('acu_site_summary_updated', { detail: stamped }));
    } catch {}
  }
  siteSummaryListeners.forEach((cb) => {
    try {
      cb(stamped);
    } catch {}
  });
}

function isSiteSummaryFresh(summary: SiteVisitSummary | null): boolean {
  if (!summary || typeof summary.cachedAt !== 'number') return false;
  if (summary.totalVisits === 0 && !summary.resetAt) return false;
  return Date.now() - summary.cachedAt < VISITOR_CACHE_TTL_MS;
}

/**
 * Fetch lightweight summary counter (`system_settings/site_summary`) via a single getDoc read.
 * Cached in localStorage for 2 minutes; NEVER overwrites positive local counts with 0 on failure/empty.
 */
export async function fetchSiteSummaryOnce(forceRefresh = false): Promise<SiteVisitSummary | null> {
  const cached = getLocalSiteSummary();
  if (!forceRefresh && isSiteSummaryFresh(cached)) {
    return cached;
  }
  if (!forceRefresh && inFlightSiteSummaryFetch) {
    return inFlightSiteSummaryFetch;
  }

  inFlightSiteSummaryFetch = (async () => {
    try {
      await waitForAuthReady();
      const ref = doc(db, 'system_settings', 'site_summary');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data() as Partial<SiteVisitSummary>;
        const fetched: SiteVisitSummary = {
          totalVisits: typeof d.totalVisits === 'number' ? d.totalVisits : 0,
          yearlyVisits: d.yearlyVisits && typeof d.yearlyVisits === 'object' ? d.yearlyVisits : {},
          monthlyVisits: d.monthlyVisits && typeof d.monthlyVisits === 'object' ? d.monthlyVisits : {},
          dailyVisits: d.dailyVisits && typeof d.dailyVisits === 'object' ? d.dailyVisits : {},
          updatedAt: d.updatedAt || new Date().toISOString(),
          resetAt: d.resetAt,
          cachedAt: Date.now(),
        };
        if (fetched.totalVisits > 0 || Boolean(fetched.resetAt) || !cached || cached.totalVisits === 0) {
          saveLocalSiteSummary(fetched, Boolean(fetched.resetAt));
          return fetched;
        }
      }
      return cached;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      return cached;
    } finally {
      inFlightSiteSummaryFetch = null;
    }
  })();

  return inFlightSiteSummaryFetch;
}

export function subscribeSiteSummary(
  callback: (summary: SiteVisitSummary | null) => void
): () => void {
  siteSummaryListeners.add(callback);

  if (typeof window !== 'undefined' && !siteSummaryWindowListenerAttached) {
    siteSummaryWindowListenerAttached = true;
    window.addEventListener('acu_site_summary_updated', (e: Event) => {
      const detail = (e as CustomEvent<SiteVisitSummary>)?.detail;
      if (detail) {
        sharedSiteSummary = detail;
        siteSummaryListeners.forEach((cb) => {
          try {
            cb(detail);
          } catch {}
        });
      }
    });
  }

  const initial = getLocalSiteSummary();
  if (initial) {
    callback(initial);
  }

  if (!isSiteSummaryFresh(initial)) {
    fetchSiteSummaryOnce(false)
      .then((res) => {
        if (res) callback(res);
      })
      .catch(() => {});
  }

  return () => {
    siteSummaryListeners.delete(callback);
  };
}

export function getLocalAdminStatsSummary(): AdminStatsSummary | null {
  if (sharedAdminStatsSummary) return sharedAdminStatsSummary;
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ADMIN_OVERALL_STATS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdminStatsSummary;
      if (parsed && typeof parsed.fetchedAt === 'number') {
        sharedAdminStatsSummary = parsed;
        return parsed;
      }
      try {
        localStorage.removeItem(ADMIN_OVERALL_STATS_CACHE_KEY);
      } catch {}
    }
  } catch {
    try {
      localStorage.removeItem(ADMIN_OVERALL_STATS_CACHE_KEY);
    } catch {}
  }
  return null;
}

function saveLocalAdminStatsSummary(summary: AdminStatsSummary, allowZeroReset = false): void {
  const existing = getLocalAdminStatsSummary();
  const next: AdminStatsSummary = allowZeroReset
    ? summary
    : {
        totalLoginLogsCount:
          summary.totalLoginLogsCount > 0
            ? summary.totalLoginLogsCount
            : existing?.totalLoginLogsCount || 0,
        adminLoginLogsCount:
          summary.adminLoginLogsCount > 0
            ? summary.adminLoginLogsCount
            : existing?.adminLoginLogsCount || 0,
        totalUserProfilesCount:
          summary.totalUserProfilesCount > 0
            ? summary.totalUserProfilesCount
            : existing?.totalUserProfilesCount || 0,
        siteSummary: summary.siteSummary || existing?.siteSummary || null,
        fetchedAt: summary.fetchedAt || Date.now(),
      };

  // Never overwrite non-zero cached summary with all-zero failure output
  if (
    !allowZeroReset &&
    next.totalLoginLogsCount === 0 &&
    next.totalUserProfilesCount === 0 &&
    existing &&
    (existing.totalLoginLogsCount > 0 || existing.totalUserProfilesCount > 0)
  ) {
    return;
  }

  sharedAdminStatsSummary = next;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ADMIN_OVERALL_STATS_CACHE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('acu_admin_stats_updated', { detail: next }));
    } catch {}
  }
}

/**
 * Fetch Admin aggregate counts (`getCountFromServer` on `login_logs` & `user_profiles` + `site_summary`)
 * in parallel using Promise.allSettled with a 3-minute localStorage TTL.
 * Waits for Firebase Auth + verifies Admin role before querying; never writes empty zeros to cache.
 */
export async function fetchAdminStatsSummaryOnce(
  forceRefresh = false,
  callerEmail?: string
): Promise<AdminStatsSummary | null> {
  const cached = getLocalAdminStatsSummary();
  if (!isAdminLogViewer(callerEmail)) {
    return cached;
  }

  const isFresh =
    cached !== null &&
    (cached.totalLoginLogsCount > 0 || cached.totalUserProfilesCount > 0) &&
    typeof cached.fetchedAt === 'number' &&
    Date.now() - cached.fetchedAt < ADMIN_STATS_CACHE_TTL_MS;

  if (!forceRefresh && isFresh) {
    return cached;
  }

  if (!forceRefresh && inFlightAdminStatsFetch) {
    return inFlightAdminStatsFetch;
  }

  inFlightAdminStatsFetch = (async () => {
    try {
      await waitForAuthReady();
      if (!isAdminLogViewer(callerEmail)) {
        return cached;
      }

      const logsCol = collection(db, 'login_logs');
      const profilesCol = collection(db, 'user_profiles');
      const adminEmail = 'weerapong1625@acu.ac.th';

      const [totalLogsRes, adminLogsRes, totalProfilesRes, siteSummaryRes] = await Promise.allSettled([
        getCountFromServer(logsCol),
        getCountFromServer(query(logsCol, where('email', '==', adminEmail))),
        getCountFromServer(profilesCol),
        fetchSiteSummaryOnce(forceRefresh),
      ]);

      const totalLogsVal =
        totalLogsRes.status === 'fulfilled'
          ? totalLogsRes.value.data().count
          : cached?.totalLoginLogsCount || 0;
      const adminLogsVal =
        adminLogsRes.status === 'fulfilled'
          ? adminLogsRes.value.data().count
          : cached?.adminLoginLogsCount || 0;
      const totalProfilesVal =
        totalProfilesRes.status === 'fulfilled'
          ? totalProfilesRes.value.data().count
          : cached?.totalUserProfilesCount || 0;
      const siteSummaryVal =
        siteSummaryRes.status === 'fulfilled' && siteSummaryRes.value
          ? siteSummaryRes.value
          : cached?.siteSummary || getLocalSiteSummary();

      const hasAnySuccess =
        totalLogsRes.status === 'fulfilled' ||
        totalProfilesRes.status === 'fulfilled' ||
        (siteSummaryRes.status === 'fulfilled' && Boolean(siteSummaryRes.value));

      if (!hasAnySuccess && cached) {
        return cached;
      }

      const nextSummary: AdminStatsSummary = {
        totalLoginLogsCount: totalLogsVal,
        adminLoginLogsCount: adminLogsVal,
        totalUserProfilesCount: totalProfilesVal,
        siteSummary: siteSummaryVal,
        fetchedAt: Date.now(),
      };

      saveLocalAdminStatsSummary(nextSummary, false);
      return getLocalAdminStatsSummary() || nextSummary;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      return cached;
    } finally {
      inFlightAdminStatsFetch = null;
    }
  })();

  return inFlightAdminStatsFetch;
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
        if (parsed.length === 0) {
          try {
            localStorage.removeItem(LOGIN_LOGS_STORAGE_KEY);
          } catch {}
          return [];
        }
        const authentic = sanitizeAuthenticLogs(parsed);
        if (authentic.length !== parsed.length) {
          try {
            localStorage.setItem(LOGIN_LOGS_STORAGE_KEY, JSON.stringify(authentic));
          } catch {}
        }
        return authentic;
      }
      try {
        localStorage.removeItem(LOGIN_LOGS_STORAGE_KEY);
      } catch {}
    }
  } catch (err) {
    console.warn('Could not read local login logs (clearing corrupted entry):', err);
    try {
      localStorage.removeItem(LOGIN_LOGS_STORAGE_KEY);
    } catch {}
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
    avatarUrl: sanitizeAvatarUrl(data.avatarUrl),
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

  const bkkParts = getBangkokDateParts(nowDate) || {
    year: nowDate.getFullYear(),
    monthIndex: nowDate.getMonth(),
    day: nowDate.getDate(),
    dateKey: nowIso.split('T')[0],
  };
  const yearKey = String(bkkParts.year);
  const monthKey = String(bkkParts.monthIndex);
  const dateKey = bkkParts.dateKey;

  // Immediately update local site summary cache & broadcast so active React state reflects +1 right away
  try {
    const prevSum = getLocalSiteSummary() || {
      totalVisits: 0,
      yearlyVisits: {},
      monthlyVisits: {},
      dailyVisits: {},
    };
    const nextYearCount = (prevSum.yearlyVisits?.[yearKey] || 0) + 1;
    const prevYearMonths = prevSum.monthlyVisits?.[yearKey] || {};
    const nextMonthCount = (prevYearMonths[monthKey] || 0) + 1;
    const nextDailyCount = (prevSum.dailyVisits?.[dateKey] || 0) + 1;
    saveLocalSiteSummary({
      ...prevSum,
      totalVisits: (prevSum.totalVisits || 0) + 1,
      yearlyVisits: { ...(prevSum.yearlyVisits || {}), [yearKey]: nextYearCount },
      monthlyVisits: {
        ...(prevSum.monthlyVisits || {}),
        [yearKey]: { ...prevYearMonths, [monthKey]: nextMonthCount },
      },
      dailyVisits: { ...(prevSum.dailyVisits || {}), [dateKey]: nextDailyCount },
      updatedAt: nowIso,
      cachedAt: Date.now(),
    });
  } catch {}

  // Immediately update local user profile visit stats cache & notify mounted profile UI
  try {
    if (typeof window !== 'undefined') {
      const profKey = `acu_user_full_profile_${normEmail}`;
      const rawProf = localStorage.getItem(profKey);
      if (rawProf) {
        const parsed = JSON.parse(rawProf);
        if (parsed && parsed.stats) {
          const nextTotal = (parsed.stats.totalViews || 0) + 1;
          const prevYearly = parsed.stats.yearlyStats || {};
          const nextYearlyVal = (prevYearly[yearKey] || 0) + 1;
          parsed.stats = {
            ...parsed.stats,
            totalViews: nextTotal,
            yearlyStats: { ...prevYearly, [yearKey]: nextYearlyVal },
          };
          parsed.updatedAt = nowIso;
          localStorage.setItem(profKey, JSON.stringify(parsed));
          window.dispatchEvent(new CustomEvent('acu_user_profile_updated', { detail: parsed }));
          window.dispatchEvent(new CustomEvent('acu_user_profiles_changed', { detail: parsed }));
        }
      }
    }
  } catch {}

  // 2. Persist log + atomic increment(1) summary counters in Firestore
  try {
    const docRef = doc(db, 'login_logs', logId);
    await setDoc(docRef, {
      ...newLog,
      createdAt: serverTimestamp(),
    });
    removePendingLoginLogByIds(new Set([logId]));

    // Atomic increment(1) on lightweight site summary counter (system_settings/site_summary)
    setDoc(
      doc(db, 'system_settings', 'site_summary'),
      {
        totalVisits: increment(1),
        yearlyVisits: { [yearKey]: increment(1) },
        monthlyVisits: { [yearKey]: { [monthKey]: increment(1) } },
        dailyVisits: { [dateKey]: increment(1) },
        updatedAt: nowIso,
      },
      { merge: true }
    ).catch(() => {});

    // Atomic increment(1) on user's own profile visit counters
    const safeDocId = encodeURIComponent(normEmail);
    setDoc(
      doc(db, 'user_profiles', safeDocId),
      {
        email: normEmail,
        stats: {
          totalViews: increment(1),
          yearlyStats: { [yearKey]: increment(1) },
        },
        updatedAt: nowIso,
      },
      { merge: true }
    ).catch(() => {});

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

    // 1. Clear local storage & site summary cache immediately (0ms)
    saveLocalLoginLogs([], true);
    const resetAtIso = new Date().toISOString();
    const emptySiteSum: SiteVisitSummary = {
      totalVisits: 0,
      yearlyVisits: {},
      monthlyVisits: {},
      dailyVisits: {},
      updatedAt: resetAtIso,
      resetAt: resetAtIso,
      cachedAt: Date.now(),
    };
    saveLocalSiteSummary(emptySiteSum, true);
    saveLocalAdminStatsSummary(
      {
        totalLoginLogsCount: 0,
        adminLoginLogsCount: 0,
        totalUserProfilesCount: sharedAdminStatsSummary?.totalUserProfilesCount || 0,
        siteSummary: emptySiteSum,
        fetchedAt: Date.now(),
      },
      true
    );

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

    // 3. Reset all user profile visit stats & site summary doc (never touches innovations/media)
    await resetUserProfileVisitStats('all');
    try {
      await setDoc(doc(db, 'system_settings', 'site_summary'), {
        totalVisits: 0,
        yearlyVisits: {},
        monthlyVisits: {},
        dailyVisits: {},
        updatedAt: resetAtIso,
        resetAt: resetAtIso,
      });
    } catch {}

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

  // Async delete from Firestore (indexed filter + limit)
  try {
    getDocs(query(collection(db, 'login_logs'), where('email', '==', norm), limit(200)))
      .then((snapshot) => {
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.docs.forEach(d => batch.delete(d.ref));
          batch.commit().catch(() => {});
        }
      })
      .catch(() => {});
  } catch {
    // ignore
  }
}

function ensureLocalLogWindowSync(): void {
  if (typeof window === 'undefined' || windowSyncListenersAttached) return;
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
    if (e.key === LOGIN_LOGS_STORAGE_KEY) {
      const merged = mergeLogs(getLocalLoginLogs(), getPendingLoginLogs());
      broadcastLogsToListeners(merged);
    }
  };
  const handleUserDeleted = () => {
    const base = sharedLatestLogs || getLocalLoginLogs();
    const cleaned = sanitizeAuthenticLogs(base);
    saveLocalLoginLogs(cleaned, true);
  };
  const handleCustomLogsUpdated = () => {
    const base = sharedLatestLogs || mergeLogs(getLocalLoginLogs(), getPendingLoginLogs());
    broadcastLogsToListeners(base);
  };

  window.addEventListener('online', handleResumeSync);
  window.addEventListener('focus', handleResumeSync);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('storage', handleStorage);
  window.addEventListener('acu_user_deleted', handleUserDeleted);
  window.addEventListener('acu_login_logs_updated', handleCustomLogsUpdated);
}

function mapLoginLogSnapshot(docSnap: any): LoginLogEntry {
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

  return {
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
    avatarUrl: sanitizeAvatarUrl(d.avatarUrl),
  };
}

function isAdminLogViewer(callerEmail?: string): boolean {
  const adminEmail = 'weerapong1625@acu.ac.th';
  const candidates = [
    callerEmail,
    auth?.currentUser?.email,
    typeof window !== 'undefined' ? localStorage.getItem('acu_current_user_email') : null,
  ];
  return candidates.some((em) => (em || '').trim().toLowerCase() === adminEmail);
}

/**
 * One-time getDocs fetch of latest login logs (limit 50) — invoked ONLY when Admin opens the Login Logs tab
 * or explicitly refreshes, and cached in memory + localStorage (3-minute TTL) to protect Firestore daily read quotas.
 * Regular users (Teachers/Students) NEVER read the login_logs collection.
 */
export async function fetchAdminLoginLogsOnce(
  forceRefresh = false,
  maxCount = 50,
  callerEmail?: string
): Promise<LoginLogEntry[]> {
  const safeLimit = Math.min(Math.max(1, maxCount), 50);
  const localFallback = sharedLatestLogs || mergeLogs(getLocalLoginLogs(), getPendingLoginLogs());

  if (!isAdminLogViewer(callerEmail)) {
    return localFallback;
  }

  const storedFetchedAt =
    lastLoginLogsFetchedAt ||
    (typeof window !== 'undefined' ? Number(localStorage.getItem(LOGIN_LOGS_FETCHED_AT_KEY) || 0) : 0);
  const isLogsCacheFresh = storedFetchedAt > 0 && Date.now() - storedFetchedAt < ADMIN_STATS_CACHE_TTL_MS;

  if (!forceRefresh && hasFetchedLoginLogsFromServer && isLogsCacheFresh && sharedLatestLogs && sharedLatestLogs.length > 0) {
    return sharedLatestLogs;
  }

  if (!forceRefresh && inFlightLoginLogsFetch) {
    return inFlightLoginLogsFetch;
  }

  inFlightLoginLogsFetch = (async () => {
    try {
      await waitForAuthReady();
      if (!isAdminLogViewer(callerEmail)) {
        return localFallback;
      }
      await flushPendingLoginLogs();

      const logsRef = collection(db, 'login_logs');
      let snapshot;
      try {
        snapshot = await getDocs(query(logsRef, orderBy('loginTimestamp', 'desc'), limit(safeLimit)));
      } catch {
        // Fallback single query without composite/field index; sorted descending in memory below
        snapshot = await getDocs(query(logsRef, limit(safeLimit)));
      }

      if (snapshot.empty && (snapshot.metadata?.fromCache || !isAuthReady()) && localFallback.length > 0) {
        broadcastLogsToListeners(localFallback);
        return localFallback;
      }

      const fsLogs: LoginLogEntry[] = [];
      const confirmedIds = new Set<string>();
      snapshot.forEach((docSnap) => {
        const mapped = mapLoginLogSnapshot(docSnap);
        confirmedIds.add(docSnap.id);
        if (mapped.clientLogId) confirmedIds.add(String(mapped.clientLogId));
        fsLogs.push(mapped);
      });

      fsLogs.sort((a, b) => getValidTimestampMs(b.loginTimestamp) - getValidTimestampMs(a.loginTimestamp));

      hasFetchedLoginLogsFromServer = true;
      lastLoginLogsFetchedAt = Date.now();
      removePendingLoginLogByIds(confirmedIds);

      const remainingPending = getPendingLoginLogs();
      const merged = mergeLogs(fsLogs, remainingPending);
      if (merged.length > 0 || (localFallback.length === 0 && !snapshot.metadata?.fromCache)) {
        try {
          localStorage.setItem(LOGIN_LOGS_FETCHED_AT_KEY, String(lastLoginLogsFetchedAt));
        } catch {}
        saveLocalLoginLogs(merged, false);
        broadcastLogsToListeners(merged);
        return merged;
      }
      broadcastLogsToListeners(localFallback);
      return localFallback;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      console.warn('Login logs one-time fetch fallback (using cached logs):', err);
      broadcastLogsToListeners(localFallback);
      return localFallback;
    } finally {
      inFlightLoginLogsFetch = null;
    }
  })();

  return inFlightLoginLogsFetch;
}

/**
 * Zero-read local subscription to login logs (emits cached/memory logs and local updates).
 * Does NOT open any Firestore onSnapshot listener or issue background queries.
 * Admin Logs tab explicitly calls fetchAdminLoginLogsOnce() on tab open / refresh.
 */
export function subscribeAllLoginLogs(callback: (logs: LoginLogEntry[]) => void): () => void {
  logListeners.add(callback);
  ensureLocalLogWindowSync();

  const initial = sharedLatestLogs || mergeLogs(getLocalLoginLogs(), getPendingLoginLogs());
  callback(initial);

  return () => {
    logListeners.delete(callback);
  };
}

/**
 * Flush pending login logs and optionally fetch latest 50 logs when explicitly forced by Admin
 */
export async function syncLoginLogsFromServer(force = false): Promise<LoginLogEntry[]> {
  try {
    await flushPendingLoginLogs();
    if (force) {
      return await fetchAdminLoginLogsOnce(true, 50);
    }
  } catch {
    // non-fatal fallback to local cache
  }
  return sharedLatestLogs || mergeLogs(getLocalLoginLogs(), getPendingLoginLogs());
}

/**
 * Zero-read compatibility helper (background live polling/listeners disabled to protect Firestore quota)
 */
export function acquireLiveStatsSync(_intervalMs = 3500): () => void {
  return () => {};
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
 * Fetch latest login logs for the Admin System Test dashboard (reuses cached logs unless forceRefresh=true)
 */
export async function fetchRecentLoginLogs(
  maxCount = 30,
  forceRefresh = false,
  callerEmail?: string
): Promise<LoginLogEntry[]> {
  const safeCount = Math.min(Math.max(1, maxCount), 30);
  const logs = await fetchAdminLoginLogsOnce(forceRefresh, safeCount, callerEmail);
  return logs.slice(0, safeCount);
}

/**
 * Save customized user profile picture to Firestore
 */
export async function saveUserProfile(profile: UserProfileData): Promise<boolean> {
  try {
    const normEmail = profile.email.toLowerCase().trim();
    const cleanAvatar = sanitizeAvatarUrl(profile.avatarUrl);
    const safeDocId = encodeURIComponent(normEmail);
    const profileRef = doc(db, 'user_profiles', safeDocId);
    await setDoc(profileRef, {
      email: normEmail,
      displayName: profile.displayName,
      avatarUrl: cleanAvatar,
      photoURL: cleanAvatar,
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
