import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  setDoc,
} from 'firebase/firestore';
import {
  db,
  isQuotaExceededError,
  notifyQuotaExceeded,
  safeLocalStorageSetItem,
  waitForAuthReady,
} from '../firebase';
import {
  BundleIndexEntry,
  toIdeaBundleEntry,
  toInnovationBundleEntry,
  toMediaBundleEntry,
  writeBundleIndex,
} from './bundleService';
import { sanitizeMediaThumbnailForFirestore } from '../utils/mediaThumbnailUtils';

export const ADMIN_OVERVIEW_COLLECTION = 'stats';
export const ADMIN_OVERVIEW_DOC_ID = 'admin_overview';
export const ADMIN_OVERVIEW_FALLBACK_COLLECTION = 'system_settings';

export const ADMIN_OVERVIEW_CACHE_KEY = 'acu_admin_overview_cache';
export const ADMIN_OVERVIEW_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours TTL
export const ADMIN_OVERVIEW_COOLDOWN_MS = 60 * 1000; // 60 seconds manual refresh cooldown

export interface YearlyAdminBreakdown {
  totalVisits: number;
  uniqueVisitors: number;
  totalMedia: number;
  totalFacilities: number;
  monthlyVisits?: Record<string, number>;
  monthlyMedia?: Record<string, number>;
  monthlyFacilities?: Record<string, number>;
}

export interface AdminOverviewStats {
  totalTeachersWithSubmissions: number;
  totalMediaCount: number;
  totalInnovationsCount: number;
  totalUnifiedSubmissions?: number;
  teachersCompleted5Count: number;
  totalFacilityLogs: number;
  totalUsersCount: number;
  totalVisitorsCount: number;
  byMediaType: Record<string, number>;
  byGradeLevel: Record<string, number>;
  bySubjectGroup: Record<string, number>;
  selfProducedCount: number;
  externalSourceCount: number;
  yearlyStats?: Record<string, YearlyAdminBreakdown>;
  updatedAt: string;
  fetchedAt?: number;
  fromQuotaFallback?: boolean;
  needsInitialSync?: boolean;
}

const DEFAULT_SUBJECT_GROUPS = [
  'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
  'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
  'กลุ่มสาระการเรียนรู้ภาษาไทย',
  'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ',
  'กลุ่มสาระการเรียนรู้สุขศึกษาและพลศึกษา',
  'กลุ่มสาระการเรียนรู้ศิลปะ',
  'กลุ่มสาระการเรียนรู้การงานอาชีพ',
  'กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม',
  'กลุ่มพัฒนาผู้เรียน',
] as const;

const LEGACY_FAKE_IDS = new Set([
  '1', '2', '3', '4', '5',
  'innov-1', 'innov-2', 'innov-3', 'innov-4', 'innov-5',
  'seed-1', 'seed-2', 'seed-3', 'seed-4', 'seed-5',
]);

let sharedAdminOverview: AdminOverviewStats | null = null;
let isFetchingOverview = false;
let inFlightOverviewFetch: Promise<AdminOverviewStats | null> | null = null;
let lastManualOverviewRefreshAt = 0;
let useSettingsFallbackDoc = false;
let lastQuotaFallbackState = false;

export function createEmptyAdminOverviewStats(): AdminOverviewStats {
  const bySubjectGroup: Record<string, number> = {};
  DEFAULT_SUBJECT_GROUPS.forEach((sg) => {
    bySubjectGroup[sg] = 0;
  });
  return {
    totalTeachersWithSubmissions: 0,
    totalMediaCount: 0,
    totalInnovationsCount: 0,
    totalUnifiedSubmissions: 0,
    teachersCompleted5Count: 0,
    totalFacilityLogs: 0,
    totalUsersCount: 0,
    totalVisitorsCount: 0,
    byMediaType: {
      'สื่อสิ่งพิมพ์': 0,
      'สื่อเทคโนโลยี': 0,
      'สื่ออื่น ๆ': 0,
    },
    byGradeLevel: {},
    bySubjectGroup,
    selfProducedCount: 0,
    externalSourceCount: 0,
    yearlyStats: {},
    updatedAt: '',
  };
}

function isPermissionDeniedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as any).code) : '';
  const msg = 'message' in err ? String((err as any).message) : '';
  return (
    code === 'permission-denied' ||
    msg.includes('permission-denied') ||
    msg.includes('Missing or insufficient permissions')
  );
}

export function isOverviewNonZero(stats?: AdminOverviewStats | null): boolean {
  if (!stats) return false;
  return (
    (stats.totalTeachersWithSubmissions || 0) > 0 ||
    (stats.totalMediaCount || 0) > 0 ||
    (stats.totalInnovationsCount || 0) > 0 ||
    (stats.totalFacilityLogs || 0) > 0 ||
    (stats.totalUsersCount || 0) > 0 ||
    (stats.totalVisitorsCount || 0) > 0
  );
}

export function isQuotaFallbackCurrentlyActive(): boolean {
  return lastQuotaFallbackState;
}

export function getAdminOverviewCooldownSeconds(): number {
  if (!lastManualOverviewRefreshAt) return 0;
  const remaining = ADMIN_OVERVIEW_COOLDOWN_MS - (Date.now() - lastManualOverviewRefreshAt);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

function emitAdminOverviewUpdated(stats: AdminOverviewStats): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('acu_admin_overview_updated', { detail: stats }));
    } catch {}
  }
}

export function getLocalAdminOverview(): AdminOverviewStats | null {
  if (sharedAdminOverview) return sharedAdminOverview;
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ADMIN_OVERVIEW_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminOverviewStats;
    if (parsed && typeof parsed === 'object' && typeof parsed.totalInnovationsCount === 'number') {
      sharedAdminOverview = parsed;
      return parsed;
    }
    try {
      localStorage.removeItem(ADMIN_OVERVIEW_CACHE_KEY);
    } catch {}
  } catch {
    try {
      localStorage.removeItem(ADMIN_OVERVIEW_CACHE_KEY);
    } catch {}
  }
  return null;
}

export function saveLocalAdminOverview(
  nextStats: AdminOverviewStats,
  options?: { allowZeroReset?: boolean }
): AdminOverviewStats | null {
  const existing = getLocalAdminOverview();
  const allowZeroReset = Boolean(options?.allowZeroReset);

  // Strict Cache-Poisoning Guard: NEVER overwrite valid positive stats with all-zero failure output
  if (!allowZeroReset && !isOverviewNonZero(nextStats) && isOverviewNonZero(existing)) {
    return existing;
  }

  const normalized: AdminOverviewStats = {
    ...createEmptyAdminOverviewStats(),
    ...nextStats,
    byMediaType: {
      'สื่อสิ่งพิมพ์': 0,
      'สื่อเทคโนโลยี': 0,
      'สื่ออื่น ๆ': 0,
      ...(nextStats.byMediaType || {}),
    },
    byGradeLevel: { ...(nextStats.byGradeLevel || {}) },
    bySubjectGroup: {
      ...createEmptyAdminOverviewStats().bySubjectGroup,
      ...(nextStats.bySubjectGroup || {}),
    },
    yearlyStats: nextStats.yearlyStats ? { ...nextStats.yearlyStats } : existing?.yearlyStats || {},
    fetchedAt: nextStats.fetchedAt ?? Date.now(),
  };

  sharedAdminOverview = normalized;
  safeLocalStorageSetItem(ADMIN_OVERVIEW_CACHE_KEY, JSON.stringify(normalized));
  emitAdminOverviewUpdated(normalized);
  return normalized;
}

function isAdminOverviewCacheFresh(cached: AdminOverviewStats | null): boolean {
  if (!cached || typeof cached.fetchedAt !== 'number' || cached.fetchedAt <= 0) return false;
  if (!isOverviewNonZero(cached)) return false;
  return Date.now() - cached.fetchedAt < ADMIN_OVERVIEW_CACHE_TTL_MS;
}

function normalizeOverviewDocData(raw: Record<string, any>): AdminOverviewStats {
  const base = createEmptyAdminOverviewStats();
  return {
    totalTeachersWithSubmissions: Number(raw.totalTeachersWithSubmissions || 0),
    totalMediaCount: Number(raw.totalMediaCount || 0),
    totalInnovationsCount: Number(raw.totalInnovationsCount || 0),
    totalUnifiedSubmissions:
      typeof raw.totalUnifiedSubmissions === 'number'
        ? raw.totalUnifiedSubmissions
        : Math.max(Number(raw.totalInnovationsCount || 0), Number(raw.totalMediaCount || 0)),
    teachersCompleted5Count: Number(raw.teachersCompleted5Count || 0),
    totalFacilityLogs: Number(raw.totalFacilityLogs || 0),
    totalUsersCount: Number(raw.totalUsersCount || 0),
    totalVisitorsCount: Number(raw.totalVisitorsCount || 0),
    byMediaType: {
      ...base.byMediaType,
      ...(raw.byMediaType && typeof raw.byMediaType === 'object' ? raw.byMediaType : {}),
    },
    byGradeLevel: raw.byGradeLevel && typeof raw.byGradeLevel === 'object' ? raw.byGradeLevel : {},
    bySubjectGroup: {
      ...base.bySubjectGroup,
      ...(raw.bySubjectGroup && typeof raw.bySubjectGroup === 'object' ? raw.bySubjectGroup : {}),
    },
    selfProducedCount: Number(raw.selfProducedCount || 0),
    externalSourceCount: Number(raw.externalSourceCount || 0),
    yearlyStats: raw.yearlyStats && typeof raw.yearlyStats === 'object' ? raw.yearlyStats : {},
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    fetchedAt: Date.now(),
    fromQuotaFallback: false,
    needsInitialSync: false,
  };
}

async function getAdminOverviewDocSnap() {
  if (!useSettingsFallbackDoc) {
    try {
      const primarySnap = await getDoc(doc(db, ADMIN_OVERVIEW_COLLECTION, ADMIN_OVERVIEW_DOC_ID));
      if (primarySnap.exists()) {
        return primarySnap;
      }
      // If stats/admin_overview doesn't exist yet, check mirror once just in case previous write fell back
      const mirrorSnap = await getDoc(doc(db, ADMIN_OVERVIEW_FALLBACK_COLLECTION, ADMIN_OVERVIEW_DOC_ID));
      return mirrorSnap.exists() ? mirrorSnap : primarySnap;
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        useSettingsFallbackDoc = true;
        return getDoc(doc(db, ADMIN_OVERVIEW_FALLBACK_COLLECTION, ADMIN_OVERVIEW_DOC_ID));
      }
      throw err;
    }
  }
  return getDoc(doc(db, ADMIN_OVERVIEW_FALLBACK_COLLECTION, ADMIN_OVERVIEW_DOC_ID));
}

async function writeAdminOverviewDoc(payload: Record<string, any>, merge = false): Promise<void> {
  if (!useSettingsFallbackDoc) {
    try {
      await setDoc(doc(db, ADMIN_OVERVIEW_COLLECTION, ADMIN_OVERVIEW_DOC_ID), payload, { merge });
      return;
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        useSettingsFallbackDoc = true;
        await setDoc(doc(db, ADMIN_OVERVIEW_FALLBACK_COLLECTION, ADMIN_OVERVIEW_DOC_ID), payload, { merge });
        return;
      }
      throw err;
    }
  }
  await setDoc(doc(db, ADMIN_OVERVIEW_FALLBACK_COLLECTION, ADMIN_OVERVIEW_DOC_ID), payload, { merge });
}

/**
 * Single-Document Pre-Aggregated Stats Read (`stats/admin_overview` = 1 Read).
 * - Cached in memory + localStorage for 6 hours.
 * - Enforces 60-second cooldown on manual refresh.
 * - NEVER overwrites positive localStorage cache with zeros on 429/network error.
 */
export async function fetchAdminOverviewStatsOnce(
  forceRefresh = false
): Promise<AdminOverviewStats | null> {
  const cached = getLocalAdminOverview();

  if (!forceRefresh && isAdminOverviewCacheFresh(cached)) {
    return cached;
  }

  if (forceRefresh && getAdminOverviewCooldownSeconds() > 0) {
    if (inFlightOverviewFetch) return inFlightOverviewFetch;
    return cached;
  }

  if (inFlightOverviewFetch) {
    return inFlightOverviewFetch;
  }

  if (isFetchingOverview) {
    return cached;
  }

  if (forceRefresh) {
    lastManualOverviewRefreshAt = Date.now();
  }

  isFetchingOverview = true;
  inFlightOverviewFetch = (async () => {
    try {
      await waitForAuthReady();
      const snap = await getAdminOverviewDocSnap();
      if (snap.exists()) {
        const parsed = normalizeOverviewDocData(snap.data());
        lastQuotaFallbackState = false;
        if (isOverviewNonZero(parsed) || !isOverviewNonZero(cached)) {
          return saveLocalAdminOverview(parsed);
        }
        return cached;
      }

      // Document does not exist yet on server; keep cached if available, else signal needsInitialSync
      if (cached && isOverviewNonZero(cached)) {
        return cached;
      }
      return {
        ...createEmptyAdminOverviewStats(),
        needsInitialSync: true,
      };
    } catch (err) {
      if (isQuotaExceededError(err)) {
        lastQuotaFallbackState = true;
        notifyQuotaExceeded();
      } else {
        console.warn('fetchAdminOverviewStatsOnce fallback to cache:', err);
      }
      if (cached) {
        const flagged: AdminOverviewStats = {
          ...cached,
          fromQuotaFallback: isQuotaExceededError(err) || lastQuotaFallbackState,
        };
        sharedAdminOverview = flagged;
        emitAdminOverviewUpdated(flagged);
        return flagged;
      }
      return null;
    } finally {
      isFetchingOverview = false;
      inFlightOverviewFetch = null;
    }
  })();

  return inFlightOverviewFetch;
}

export interface AdminOverviewCounterDelta {
  totalTeachersWithSubmissions?: number;
  totalMediaCount?: number;
  totalInnovationsCount?: number;
  totalUnifiedSubmissions?: number;
  teachersCompleted5Count?: number;
  totalFacilityLogs?: number;
  totalUsersCount?: number;
  totalVisitorsCount?: number;
  mediaType?: string;
  mediaTypeDelta?: number;
  gradeLevel?: string;
  gradeLevelDelta?: number;
  subjectGroup?: string;
  subjectGroupDelta?: number;
  selfProducedCount?: number;
  externalSourceCount?: number;
  yearKey?: string;
  monthKey?: string;
  yearVisitDelta?: number;
  yearMediaDelta?: number;
  yearFacilityDelta?: number;
}

function normalizeMediaTypeKey(rawType?: string): 'สื่อสิ่งพิมพ์' | 'สื่อเทคโนโลยี' | 'สื่ออื่น ๆ' {
  if (rawType === 'สื่อสิ่งพิมพ์' || rawType === 'สื่อเทคโนโลยี') return rawType;
  return 'สื่ออื่น ๆ';
}

/**
 * Lightweight incremental update on write/delete (uses Firestore increment(1)/increment(-1)).
 * Never triggers full-collection reads and silently isolates quota/network errors.
 */
export async function incrementAdminOverviewCounters(
  deltas: AdminOverviewCounterDelta
): Promise<void> {
  const nowIso = new Date().toISOString();

  // 1. Update local cache immediately if it exists
  try {
    const existing = getLocalAdminOverview();
    if (existing) {
      const next: AdminOverviewStats = {
        ...existing,
        totalTeachersWithSubmissions: Math.max(
          0,
          (existing.totalTeachersWithSubmissions || 0) + (deltas.totalTeachersWithSubmissions || 0)
        ),
        totalMediaCount: Math.max(0, (existing.totalMediaCount || 0) + (deltas.totalMediaCount || 0)),
        totalInnovationsCount: Math.max(
          0,
          (existing.totalInnovationsCount || 0) + (deltas.totalInnovationsCount || 0)
        ),
        totalUnifiedSubmissions: Math.max(
          0,
          (existing.totalUnifiedSubmissions ?? existing.totalInnovationsCount ?? 0) +
            (deltas.totalUnifiedSubmissions ?? deltas.totalInnovationsCount ?? 0)
        ),
        teachersCompleted5Count: Math.max(
          0,
          (existing.teachersCompleted5Count || 0) + (deltas.teachersCompleted5Count || 0)
        ),
        totalFacilityLogs: Math.max(
          0,
          (existing.totalFacilityLogs || 0) + (deltas.totalFacilityLogs || 0)
        ),
        totalUsersCount: Math.max(0, (existing.totalUsersCount || 0) + (deltas.totalUsersCount || 0)),
        totalVisitorsCount: Math.max(
          0,
          (existing.totalVisitorsCount || 0) + (deltas.totalVisitorsCount || 0)
        ),
        selfProducedCount: Math.max(
          0,
          (existing.selfProducedCount || 0) + (deltas.selfProducedCount || 0)
        ),
        externalSourceCount: Math.max(
          0,
          (existing.externalSourceCount || 0) + (deltas.externalSourceCount || 0)
        ),
        byMediaType: { ...(existing.byMediaType || {}) },
        byGradeLevel: { ...(existing.byGradeLevel || {}) },
        bySubjectGroup: { ...(existing.bySubjectGroup || {}) },
        yearlyStats: existing.yearlyStats ? { ...existing.yearlyStats } : {},
        updatedAt: nowIso,
      };

      if (deltas.mediaType && deltas.mediaTypeDelta) {
        const key = normalizeMediaTypeKey(deltas.mediaType);
        next.byMediaType[key] = Math.max(0, (next.byMediaType[key] || 0) + deltas.mediaTypeDelta);
      }
      if (deltas.gradeLevel && deltas.gradeLevelDelta) {
        next.byGradeLevel[deltas.gradeLevel] = Math.max(
          0,
          (next.byGradeLevel[deltas.gradeLevel] || 0) + deltas.gradeLevelDelta
        );
      }
      if (deltas.subjectGroup && deltas.subjectGroupDelta) {
        next.bySubjectGroup[deltas.subjectGroup] = Math.max(
          0,
          (next.bySubjectGroup[deltas.subjectGroup] || 0) + deltas.subjectGroupDelta
        );
      }

      if (
        deltas.yearKey &&
        (deltas.yearVisitDelta || deltas.yearMediaDelta || deltas.yearFacilityDelta)
      ) {
        const yr = deltas.yearKey;
        const prevYear = next.yearlyStats?.[yr] || {
          totalVisits: 0,
          uniqueVisitors: 0,
          totalMedia: 0,
          totalFacilities: 0,
          monthlyVisits: {},
          monthlyMedia: {},
          monthlyFacilities: {},
        };
        const mKey = deltas.monthKey;
        next.yearlyStats![yr] = {
          ...prevYear,
          totalVisits: Math.max(0, (prevYear.totalVisits || 0) + (deltas.yearVisitDelta || 0)),
          totalMedia: Math.max(0, (prevYear.totalMedia || 0) + (deltas.yearMediaDelta || 0)),
          totalFacilities: Math.max(
            0,
            (prevYear.totalFacilities || 0) + (deltas.yearFacilityDelta || 0)
          ),
          monthlyVisits:
            mKey && deltas.yearVisitDelta
              ? {
                  ...(prevYear.monthlyVisits || {}),
                  [mKey]: Math.max(
                    0,
                    ((prevYear.monthlyVisits || {})[mKey] || 0) + deltas.yearVisitDelta
                  ),
                }
              : prevYear.monthlyVisits,
          monthlyMedia:
            mKey && deltas.yearMediaDelta
              ? {
                  ...(prevYear.monthlyMedia || {}),
                  [mKey]: Math.max(
                    0,
                    ((prevYear.monthlyMedia || {})[mKey] || 0) + deltas.yearMediaDelta
                  ),
                }
              : prevYear.monthlyMedia,
          monthlyFacilities:
            mKey && deltas.yearFacilityDelta
              ? {
                  ...(prevYear.monthlyFacilities || {}),
                  [mKey]: Math.max(
                    0,
                    ((prevYear.monthlyFacilities || {})[mKey] || 0) + deltas.yearFacilityDelta
                  ),
                }
              : prevYear.monthlyFacilities,
        };
      }

      saveLocalAdminOverview(next, { allowZeroReset: false });
    }
  } catch {}

  // 2. Persist atomic Firestore increment(1/-1) on stats/admin_overview
  try {
    const fsUpdate: Record<string, any> = { updatedAt: nowIso };
    if (deltas.totalTeachersWithSubmissions) {
      fsUpdate.totalTeachersWithSubmissions = increment(deltas.totalTeachersWithSubmissions);
    }
    if (deltas.totalMediaCount) fsUpdate.totalMediaCount = increment(deltas.totalMediaCount);
    if (deltas.totalInnovationsCount) {
      fsUpdate.totalInnovationsCount = increment(deltas.totalInnovationsCount);
    }
    if (deltas.totalUnifiedSubmissions) {
      fsUpdate.totalUnifiedSubmissions = increment(deltas.totalUnifiedSubmissions);
    }
    if (deltas.teachersCompleted5Count) {
      fsUpdate.teachersCompleted5Count = increment(deltas.teachersCompleted5Count);
    }
    if (deltas.totalFacilityLogs) fsUpdate.totalFacilityLogs = increment(deltas.totalFacilityLogs);
    if (deltas.totalUsersCount) fsUpdate.totalUsersCount = increment(deltas.totalUsersCount);
    if (deltas.totalVisitorsCount) fsUpdate.totalVisitorsCount = increment(deltas.totalVisitorsCount);
    if (deltas.selfProducedCount) fsUpdate.selfProducedCount = increment(deltas.selfProducedCount);
    if (deltas.externalSourceCount) {
      fsUpdate.externalSourceCount = increment(deltas.externalSourceCount);
    }
    if (deltas.mediaType && deltas.mediaTypeDelta) {
      const mType = normalizeMediaTypeKey(deltas.mediaType);
      fsUpdate.byMediaType = { [mType]: increment(deltas.mediaTypeDelta) };
    }
    if (deltas.gradeLevel && deltas.gradeLevelDelta) {
      fsUpdate.byGradeLevel = { [deltas.gradeLevel]: increment(deltas.gradeLevelDelta) };
    }
    if (deltas.subjectGroup && deltas.subjectGroupDelta) {
      fsUpdate.bySubjectGroup = { [deltas.subjectGroup]: increment(deltas.subjectGroupDelta) };
    }
    if (deltas.yearKey) {
      const yrObj: Record<string, any> = {};
      if (deltas.yearVisitDelta) yrObj.totalVisits = increment(deltas.yearVisitDelta);
      if (deltas.yearMediaDelta) yrObj.totalMedia = increment(deltas.yearMediaDelta);
      if (deltas.yearFacilityDelta) yrObj.totalFacilities = increment(deltas.yearFacilityDelta);
      if (deltas.monthKey) {
        if (deltas.yearVisitDelta) yrObj.monthlyVisits = { [deltas.monthKey]: increment(deltas.yearVisitDelta) };
        if (deltas.yearMediaDelta) yrObj.monthlyMedia = { [deltas.monthKey]: increment(deltas.yearMediaDelta) };
        if (deltas.yearFacilityDelta) {
          yrObj.monthlyFacilities = { [deltas.monthKey]: increment(deltas.yearFacilityDelta) };
        }
      }
      if (Object.keys(yrObj).length > 0) {
        fsUpdate.yearlyStats = { [deltas.yearKey]: yrObj };
      }
    }

    if (Object.keys(fsUpdate).length > 1) {
      await writeAdminOverviewDoc(fsUpdate, true);
    }
  } catch (err) {
    if (isQuotaExceededError(err)) {
      lastQuotaFallbackState = true;
      notifyQuotaExceeded();
    }
  }
}

function getStoredDeletedEmailsSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('acu_deleted_user_emails');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map((e: any) => String(e || '').trim().toLowerCase()).filter(Boolean));
      }
    }
  } catch {}
  return new Set();
}

function getStoredDeletedMediaIdsSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('acu_deleted_media_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map((id: any) => String(id || '').trim()).filter(Boolean));
      }
    }
  } catch {}
  return new Set();
}

function extractRecordEmails(item: any): string[] {
  const candidates = [
    item?.email,
    item?.userEmail,
    item?.submittedByEmail,
    item?.teacherEmail,
    item?.authorEmail,
  ];
  const seen = new Set<string>();
  candidates.forEach((raw) => {
    if (typeof raw === 'string') {
      const norm = raw.trim().toLowerCase();
      if (norm && norm.includes('@')) seen.add(norm);
    }
  });
  return Array.from(seen);
}

function getBangkokYearMonth(input?: string): { year: string; month: string } {
  try {
    const d = input ? new Date(input) : new Date();
    if (!isNaN(d.getTime())) {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
      const [y, m] = fmt.split('-');
      if (y && m) {
        return { year: y, month: String(parseInt(m, 10) - 1) };
      }
    }
  } catch {}
  const now = new Date();
  return { year: String(now.getFullYear()), month: String(now.getMonth()) };
}

/**
 * One-Time Admin Reconciliation Action ("ซิงค์ยอดสรุปจริง"):
 * Fetches the collections once, computes exact totals across all dimensions,
 * and persists the consolidated summary into `stats/admin_overview`.
 * Never overwrites valid stats with zeros if Firestore quota is exhausted.
 */
export async function syncAdminOverviewSummary(
  callerEmail?: string
): Promise<{
  success: boolean;
  stats?: AdminOverviewStats;
  quotaExceeded?: boolean;
  error?: string;
}> {
  const normCaller = (callerEmail || '').trim().toLowerCase();
  if (normCaller && normCaller !== 'weerapong1625@acu.ac.th') {
    return { success: false, error: 'สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น' };
  }

  try {
    await waitForAuthReady();
    const [innovRes, mediaRes, facRes, profilesRes, siteSumRes, logsCountRes] =
      await Promise.allSettled([
        getDocs(query(collection(db, 'teacher_innovations_submissions'), limit(5000))),
        getDocs(query(collection(db, 'teacher_media_repository'), limit(5000))),
        getDocs(query(collection(db, 'system_test_submissions'), limit(5000))),
        getDocs(query(collection(db, 'user_profiles'), limit(2000))),
        getDoc(doc(db, 'system_settings', 'site_summary')),
        getCountFromServer(collection(db, 'login_logs')),
      ]);

    const rejectedErrors = [innovRes, mediaRes, facRes, profilesRes, siteSumRes, logsCountRes]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason);

    const anyQuotaError = rejectedErrors.some((e) => isQuotaExceededError(e));
    if (anyQuotaError) {
      lastQuotaFallbackState = true;
      notifyQuotaExceeded();
    }

    // Abort if core collections failed so we NEVER poison stats/admin_overview with 0s
    if (
      innovRes.status !== 'fulfilled' ||
      mediaRes.status !== 'fulfilled' ||
      facRes.status !== 'fulfilled' ||
      profilesRes.status !== 'fulfilled'
    ) {
      return {
        success: false,
        quotaExceeded: anyQuotaError,
        error: anyQuotaError
          ? 'โควต้าการอ่านข้อมูล Firestore วันนี้เต็ม ระบบยังคงแสดงข้อมูลจากแคชล่าสุด'
          : 'ไม่สามารถซิงค์ข้อมูลบางส่วนได้ กรุณาลองใหม่อีกครั้ง',
      };
    }

    const deletedEmails = getStoredDeletedEmailsSet();
    const deletedMediaIds = getStoredDeletedMediaIdsSet();

    const isBlockedId = (rawId: string): boolean => {
      const stripped = rawId.startsWith('work_') ? rawId.slice(5) : rawId;
      return (
        LEGACY_FAKE_IDS.has(rawId) ||
        LEGACY_FAKE_IDS.has(stripped) ||
        deletedMediaIds.has(rawId) ||
        deletedMediaIds.has(stripped)
      );
    };

    const innovations: any[] = [];
    innovRes.value.forEach((d) => {
      const data = d.data();
      const docId = data?.id || d.id;
      if (isBlockedId(docId) || data?.isDeleted === true || data?.deleted === true) return;
      const title = (data?.mediaTitle || '').trim();
      const emails = extractRecordEmails(data);
      if (!title || (emails.length > 0 && emails.every((em) => deletedEmails.has(em)))) return;
      innovations.push({ ...data, id: docId });
    });

    const teacherMedia: any[] = [];
    mediaRes.value.forEach((d) => {
      const data = d.data();
      const docId = data?.id || d.id;
      if (isBlockedId(docId) || data?.isDeleted === true || data?.deleted === true) return;
      const title = (data?.title || '').trim();
      const emails = extractRecordEmails(data);
      if (!title || (emails.length > 0 && emails.every((em) => deletedEmails.has(em)))) return;
      teacherMedia.push({ ...data, id: docId });
    });

    const facilities: any[] = [];
    facRes.value.forEach((d) => {
      const data = d.data();
      if (!data?.learningCenter) return;
      const em = String(data.userEmail || '').trim().toLowerCase();
      if (em && deletedEmails.has(em)) return;
      facilities.push({ ...data, id: data.id || d.id });
    });

    const userEmailsSet = new Set<string>();
    profilesRes.value.forEach((d) => {
      const data = d.data();
      const rawEm =
        data?.email ||
        (d.id.includes('%40') || d.id.includes('@') ? decodeURIComponent(d.id) : '');
      const norm = String(rawEm || '').trim().toLowerCase();
      if (norm && !deletedEmails.has(norm)) {
        userEmailsSet.add(norm);
      }
    });

    // Build deduplicated teacher -> work count map (matching aggregateTeacherSummary)
    const unifiedByCanonicalId = new Map<string, any>();
    const teacherWorksMap = new Map<string, Set<string>>();

    innovations.forEach((inv) => {
      const canonicalId = inv.id.startsWith('work_') ? inv.id.slice(5) : inv.id;
      unifiedByCanonicalId.set(canonicalId, {
        canonicalId,
        mediaType: inv.mediaType || 'สื่ออื่น ๆ',
        gradeLevel: inv.gradeLevel || '',
        subjectGroup: inv.subjectGroup || DEFAULT_SUBJECT_GROUPS[0],
        productionType: inv.productionType || 'ครูผลิตสื่อเอง',
        timestamp: inv.submittedAt || '',
      });
      const ownerKey = extractRecordEmails(inv)[0] || String(inv.teacherName || '').trim().toLowerCase();
      if (ownerKey) {
        if (!teacherWorksMap.has(ownerKey)) teacherWorksMap.set(ownerKey, new Set());
        teacherWorksMap.get(ownerKey)!.add(canonicalId);
      }
    });

    teacherMedia.forEach((work) => {
      const canonicalId = work.id.startsWith('work_') ? work.id.slice(5) : work.id;
      if (!unifiedByCanonicalId.has(canonicalId)) {
        unifiedByCanonicalId.set(canonicalId, {
          canonicalId,
          mediaType: work.mediaType || 'สื่ออื่น ๆ',
          gradeLevel: work.gradeLevel || '',
          subjectGroup: work.subjectGroup || DEFAULT_SUBJECT_GROUPS[0],
          productionType: work.productionType || 'ครูผลิตสื่อเอง',
          timestamp: work.createdAt || '',
        });
      }
      const ownerKey = extractRecordEmails(work)[0] || String(work.teacherName || work.authorName || '').trim().toLowerCase();
      if (ownerKey) {
        if (!teacherWorksMap.has(ownerKey)) teacherWorksMap.set(ownerKey, new Set());
        teacherWorksMap.get(ownerKey)!.add(canonicalId);
      }
    });

    const unifiedWorks = Array.from(unifiedByCanonicalId.values());
    let teachersCompleted5Count = 0;
    teacherWorksMap.forEach((set) => {
      if (set.size >= 5) teachersCompleted5Count++;
    });

    const byMediaType: Record<string, number> = {
      'สื่อสิ่งพิมพ์': 0,
      'สื่อเทคโนโลยี': 0,
      'สื่ออื่น ๆ': 0,
    };
    const byGradeLevel: Record<string, number> = {};
    const bySubjectGroup: Record<string, number> = {};
    DEFAULT_SUBJECT_GROUPS.forEach((sg) => {
      bySubjectGroup[sg] = 0;
    });
    let selfProducedCount = 0;
    let externalSourceCount = 0;

    // Also compute yearly breakdown
    const yearlyStats: Record<string, YearlyAdminBreakdown> = {};
    const ensureYear = (yr: string) => {
      if (!yearlyStats[yr]) {
        yearlyStats[yr] = {
          totalVisits: 0,
          uniqueVisitors: 0,
          totalMedia: 0,
          totalFacilities: 0,
          monthlyVisits: {},
          monthlyMedia: {},
          monthlyFacilities: {},
        };
      }
      return yearlyStats[yr];
    };

    unifiedWorks.forEach((w) => {
      const mType = normalizeMediaTypeKey(w.mediaType);
      byMediaType[mType] = (byMediaType[mType] || 0) + 1;

      if (w.gradeLevel) {
        byGradeLevel[w.gradeLevel] = (byGradeLevel[w.gradeLevel] || 0) + 1;
      }

      const sg = w.subjectGroup || DEFAULT_SUBJECT_GROUPS[0];
      bySubjectGroup[sg] = (bySubjectGroup[sg] || 0) + 1;

      if (w.productionType === 'ครูผลิตสื่อเอง') {
        selfProducedCount++;
      } else {
        externalSourceCount++;
      }

      const { year, month } = getBangkokYearMonth(w.timestamp);
      const yBucket = ensureYear(year);
      yBucket.totalMedia++;
      yBucket.monthlyMedia![month] = (yBucket.monthlyMedia![month] || 0) + 1;
    });

    facilities.forEach((f) => {
      const { year, month } = getBangkokYearMonth(f.createdAt || f.usageDateTime);
      const yBucket = ensureYear(year);
      yBucket.totalFacilities++;
      yBucket.monthlyFacilities![month] = (yBucket.monthlyFacilities![month] || 0) + 1;
    });

    const siteSumData =
      siteSumRes.status === 'fulfilled' && siteSumRes.value.exists()
        ? siteSumRes.value.data()
        : null;
    const siteTotalVisits = Number(siteSumData?.totalVisits || 0);
    const serverLogsCount =
      logsCountRes.status === 'fulfilled' ? Number(logsCountRes.value.data().count || 0) : 0;
    const totalVisitorsCount = Math.max(siteTotalVisits, serverLogsCount);

    if (siteSumData?.yearlyVisits && typeof siteSumData.yearlyVisits === 'object') {
      Object.entries(siteSumData.yearlyVisits).forEach(([yr, val]) => {
        const yBucket = ensureYear(yr);
        yBucket.totalVisits = Number(val || 0);
      });
    }
    if (siteSumData?.monthlyVisits && typeof siteSumData.monthlyVisits === 'object') {
      Object.entries(siteSumData.monthlyVisits).forEach(([yr, monthsObj]: [string, any]) => {
        if (monthsObj && typeof monthsObj === 'object') {
          const yBucket = ensureYear(yr);
          yBucket.monthlyVisits = { ...monthsObj };
        }
      });
    }

    const nowIso = new Date().toISOString();
    const computedStats: AdminOverviewStats = {
      totalTeachersWithSubmissions: teacherWorksMap.size,
      totalMediaCount: teacherMedia.length,
      totalInnovationsCount: innovations.length,
      totalUnifiedSubmissions: unifiedWorks.length,
      teachersCompleted5Count,
      totalFacilityLogs: facilities.length,
      totalUsersCount: Math.max(userEmailsSet.size, teacherWorksMap.size),
      totalVisitorsCount,
      byMediaType,
      byGradeLevel,
      bySubjectGroup,
      selfProducedCount,
      externalSourceCount,
      yearlyStats,
      updatedAt: nowIso,
      fetchedAt: Date.now(),
      fromQuotaFallback: false,
      needsInitialSync: false,
    };

    const existingCached = getLocalAdminOverview();
    if (!isOverviewNonZero(computedStats) && isOverviewNonZero(existingCached)) {
      return {
        success: false,
        error: 'ไม่พบข้อมูลใหม่จากเซิร์ฟเวอร์ ระบบยังคงข้อมูลแคชเดิมไว้',
      };
    }

    // Persist single summary document cleanly
    const { fromQuotaFallback: _fq, needsInitialSync: _ns, fetchedAt: _fa, ...docPayload } = computedStats;
    await writeAdminOverviewDoc(docPayload, false);

    lastQuotaFallbackState = false;
    lastManualOverviewRefreshAt = Date.now();
    saveLocalAdminOverview(computedStats, { allowZeroReset: true });

    return {
      success: true,
      stats: computedStats,
    };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      lastQuotaFallbackState = true;
      notifyQuotaExceeded();
      return {
        success: false,
        quotaExceeded: true,
        error: 'โควต้าอ่านข้อมูล Firestore วันนี้เต็ม (429) ระบบยังคงแสดงข้อมูลจากแคชล่าสุด',
      };
    }
    return {
      success: false,
      error: err?.message || 'ไม่สามารถซิงค์ยอดสรุปจริงได้ในขณะนี้',
    };
  }
}

/**
 * One-Time Admin Action: "สร้างดัชนีข้อมูลรวมใหม่ (Rebuild Index Bundle)"
 * - Fetches collections once
 * - Strips heavy Base64 cover thumbnails & resolves YouTube thumbnails
 * - Writes clean, auto-sharded index bundles:
 *   `bundles/media_index`, `bundles/innovations_index`, `bundles/ideas_index`
 * - Also updates `stats/admin_overview` and hydrates in-memory / 6h localStorage caches.
 */
export async function rebuildAllIndexBundles(
  callerEmail?: string
): Promise<{
  success: boolean;
  mediaCount?: number;
  innovationsCount?: number;
  ideasCount?: number;
  stats?: AdminOverviewStats;
  quotaExceeded?: boolean;
  error?: string;
}> {
  const normCaller = (callerEmail || '').trim().toLowerCase();
  if (normCaller && normCaller !== 'weerapong1625@acu.ac.th') {
    return { success: false, error: 'สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น' };
  }

  try {
    await waitForAuthReady();
    const [innovRes, mediaRes, ideasRes, facRes, profilesRes, siteSumRes, logsCountRes] =
      await Promise.allSettled([
        getDocs(query(collection(db, 'teacher_innovations_submissions'), limit(5000))),
        getDocs(query(collection(db, 'teacher_media_repository'), limit(5000))),
        getDocs(query(collection(db, 'shared_ideas'), limit(5000))),
        getDocs(query(collection(db, 'system_test_submissions'), limit(5000))),
        getDocs(query(collection(db, 'user_profiles'), limit(2000))),
        getDoc(doc(db, 'system_settings', 'site_summary')),
        getCountFromServer(collection(db, 'login_logs')),
      ]);

    const rejectedErrors = [
      innovRes,
      mediaRes,
      ideasRes,
      facRes,
      profilesRes,
      siteSumRes,
      logsCountRes,
    ]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason);

    const anyQuotaError = rejectedErrors.some((e) => isQuotaExceededError(e));
    if (anyQuotaError) {
      lastQuotaFallbackState = true;
      notifyQuotaExceeded();
    }

    if (
      innovRes.status !== 'fulfilled' ||
      mediaRes.status !== 'fulfilled' ||
      ideasRes.status !== 'fulfilled'
    ) {
      return {
        success: false,
        quotaExceeded: anyQuotaError,
        error: anyQuotaError
          ? 'โควต้าการอ่านข้อมูล Firestore วันนี้เต็ม ไม่สามารถสร้างดัชนีใหม่ได้ชั่วคราว'
          : 'ไม่สามารถอ่านข้อมูลจากฐานข้อมูลได้ครบถ้วน กรุณาลองใหม่อีกครั้ง',
      };
    }

    const deletedEmails = getStoredDeletedEmailsSet();
    const deletedMediaIds = getStoredDeletedMediaIdsSet();

    const isBlockedId = (rawId: string): boolean => {
      const stripped = rawId.startsWith('work_') ? rawId.slice(5) : rawId;
      return (
        LEGACY_FAKE_IDS.has(rawId) ||
        LEGACY_FAKE_IDS.has(stripped) ||
        deletedMediaIds.has(rawId) ||
        deletedMediaIds.has(stripped)
      );
    };

    const innovations: any[] = [];
    innovRes.value.forEach((d) => {
      const data = d.data();
      const docId = data?.id || d.id;
      if (isBlockedId(docId) || data?.isDeleted === true || data?.deleted === true) return;
      const title = (data?.mediaTitle || '').trim();
      const emails = extractRecordEmails(data);
      if (!title || (emails.length > 0 && emails.every((em) => deletedEmails.has(em)))) return;
      const cleanThumb = sanitizeMediaThumbnailForFirestore(
        data?.imageUrl || data?.coverImageUrl,
        data?.onlineUrl
      );
      innovations.push({
        ...data,
        id: docId,
        imageUrl: cleanThumb,
        coverImageUrl: cleanThumb,
      });
    });

    const teacherMedia: any[] = [];
    mediaRes.value.forEach((d) => {
      const data = d.data();
      const docId = data?.id || d.id;
      if (isBlockedId(docId) || data?.isDeleted === true || data?.deleted === true) return;
      const title = (data?.title || '').trim();
      const emails = extractRecordEmails(data);
      if (!title || (emails.length > 0 && emails.every((em) => deletedEmails.has(em)))) return;
      const cleanThumb = sanitizeMediaThumbnailForFirestore(data?.thumbnailUrl, data?.onlineUrl);
      teacherMedia.push({
        ...data,
        id: docId,
        thumbnailUrl: cleanThumb,
      });
    });

    const sharedIdeas: any[] = [];
    ideasRes.value.forEach((d) => {
      const data = d.data();
      const docId = data?.id || d.id;
      if (!data || data?.isDeleted === true || data?.deleted === true) return;
      const title = (data?.title || '').trim();
      if (!title) return;
      const cleanThumb = sanitizeMediaThumbnailForFirestore(
        data?.imageUrl || data?.thumbnailUrl,
        data?.url || data?.link
      );
      sharedIdeas.push({
        ...data,
        id: docId,
        imageUrl: cleanThumb,
      });
    });

    // Sort newest first consistently
    innovations.sort(
      (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
    );
    teacherMedia.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    sharedIdeas.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const innovationEntries: BundleIndexEntry[] = innovations.map((item) => toInnovationBundleEntry(item));
    const mediaEntries: BundleIndexEntry[] = teacherMedia.map((item) => toMediaBundleEntry(item));
    const ideaEntries: BundleIndexEntry[] = sharedIdeas.map((item) => toIdeaBundleEntry(item));

    // Write all 3 index bundles cleanly (auto-shards above 800KB)
    await Promise.all([
      writeBundleIndex('innovations_index', innovationEntries),
      writeBundleIndex('media_index', mediaEntries),
      writeBundleIndex('ideas_index', ideaEntries),
    ]);

    // Also update stats/admin_overview if facility/profile fetches succeeded
    let updatedStats: AdminOverviewStats | undefined;
    if (facRes.status === 'fulfilled' && profilesRes.status === 'fulfilled') {
      const facilities: any[] = [];
      facRes.value.forEach((d) => {
        const data = d.data();
        if (!data?.learningCenter) return;
        const em = String(data.userEmail || '').trim().toLowerCase();
        if (em && deletedEmails.has(em)) return;
        facilities.push({ ...data, id: data.id || d.id });
      });

      const userEmailsSet = new Set<string>();
      profilesRes.value.forEach((d) => {
        const data = d.data();
        const rawEm =
          data?.email ||
          (d.id.includes('%40') || d.id.includes('@') ? decodeURIComponent(d.id) : '');
        const norm = String(rawEm || '').trim().toLowerCase();
        if (norm && !deletedEmails.has(norm)) {
          userEmailsSet.add(norm);
        }
      });

      const unifiedByCanonicalId = new Map<string, any>();
      const teacherWorksMap = new Map<string, Set<string>>();

      innovations.forEach((inv) => {
        const canonicalId = inv.id.startsWith('work_') ? inv.id.slice(5) : inv.id;
        unifiedByCanonicalId.set(canonicalId, {
          canonicalId,
          mediaType: inv.mediaType || 'สื่ออื่น ๆ',
          gradeLevel: inv.gradeLevel || '',
          subjectGroup: inv.subjectGroup || DEFAULT_SUBJECT_GROUPS[0],
          productionType: inv.productionType || 'ครูผลิตสื่อเอง',
          timestamp: inv.submittedAt || '',
        });
        const ownerKey =
          extractRecordEmails(inv)[0] || String(inv.teacherName || '').trim().toLowerCase();
        if (ownerKey) {
          if (!teacherWorksMap.has(ownerKey)) teacherWorksMap.set(ownerKey, new Set());
          teacherWorksMap.get(ownerKey)!.add(canonicalId);
        }
      });

      teacherMedia.forEach((work) => {
        const canonicalId = work.id.startsWith('work_') ? work.id.slice(5) : work.id;
        if (!unifiedByCanonicalId.has(canonicalId)) {
          unifiedByCanonicalId.set(canonicalId, {
            canonicalId,
            mediaType: work.mediaType || 'สื่ออื่น ๆ',
            gradeLevel: work.gradeLevel || '',
            subjectGroup: work.subjectGroup || DEFAULT_SUBJECT_GROUPS[0],
            productionType: work.productionType || 'ครูผลิตสื่อเอง',
            timestamp: work.createdAt || '',
          });
        }
        const ownerKey =
          extractRecordEmails(work)[0] ||
          String(work.teacherName || work.authorName || '').trim().toLowerCase();
        if (ownerKey) {
          if (!teacherWorksMap.has(ownerKey)) teacherWorksMap.set(ownerKey, new Set());
          teacherWorksMap.get(ownerKey)!.add(canonicalId);
        }
      });

      const unifiedWorks = Array.from(unifiedByCanonicalId.values());
      let teachersCompleted5Count = 0;
      teacherWorksMap.forEach((set) => {
        if (set.size >= 5) teachersCompleted5Count++;
      });

      const byMediaType: Record<string, number> = {
        'สื่อสิ่งพิมพ์': 0,
        'สื่อเทคโนโลยี': 0,
        'สื่ออื่น ๆ': 0,
      };
      const byGradeLevel: Record<string, number> = {};
      const bySubjectGroup: Record<string, number> = {};
      DEFAULT_SUBJECT_GROUPS.forEach((sg) => {
        bySubjectGroup[sg] = 0;
      });
      let selfProducedCount = 0;
      let externalSourceCount = 0;

      const yearlyStats: Record<string, YearlyAdminBreakdown> = {};
      const ensureYear = (yr: string) => {
        if (!yearlyStats[yr]) {
          yearlyStats[yr] = {
            totalVisits: 0,
            uniqueVisitors: 0,
            totalMedia: 0,
            totalFacilities: 0,
            monthlyVisits: {},
            monthlyMedia: {},
            monthlyFacilities: {},
          };
        }
        return yearlyStats[yr];
      };

      unifiedWorks.forEach((w) => {
        const mType = normalizeMediaTypeKey(w.mediaType);
        byMediaType[mType] = (byMediaType[mType] || 0) + 1;
        if (w.gradeLevel) {
          byGradeLevel[w.gradeLevel] = (byGradeLevel[w.gradeLevel] || 0) + 1;
        }
        const sg = w.subjectGroup || DEFAULT_SUBJECT_GROUPS[0];
        bySubjectGroup[sg] = (bySubjectGroup[sg] || 0) + 1;
        if (w.productionType === 'ครูผลิตสื่อเอง') {
          selfProducedCount++;
        } else {
          externalSourceCount++;
        }
        const { year, month } = getBangkokYearMonth(w.timestamp);
        const yBucket = ensureYear(year);
        yBucket.totalMedia++;
        yBucket.monthlyMedia![month] = (yBucket.monthlyMedia![month] || 0) + 1;
      });

      facilities.forEach((f) => {
        const { year, month } = getBangkokYearMonth(f.createdAt || f.usageDateTime);
        const yBucket = ensureYear(year);
        yBucket.totalFacilities++;
        yBucket.monthlyFacilities![month] = (yBucket.monthlyFacilities![month] || 0) + 1;
      });

      const siteSumData =
        siteSumRes.status === 'fulfilled' && siteSumRes.value.exists()
          ? siteSumRes.value.data()
          : null;
      const siteTotalVisits = Number(siteSumData?.totalVisits || 0);
      const serverLogsCount =
        logsCountRes.status === 'fulfilled' ? Number(logsCountRes.value.data().count || 0) : 0;
      const totalVisitorsCount = Math.max(siteTotalVisits, serverLogsCount);

      if (siteSumData?.yearlyVisits && typeof siteSumData.yearlyVisits === 'object') {
        Object.entries(siteSumData.yearlyVisits).forEach(([yr, val]) => {
          const yBucket = ensureYear(yr);
          yBucket.totalVisits = Number(val || 0);
        });
      }
      if (siteSumData?.monthlyVisits && typeof siteSumData.monthlyVisits === 'object') {
        Object.entries(siteSumData.monthlyVisits).forEach(([yr, monthsObj]: [string, any]) => {
          if (monthsObj && typeof monthsObj === 'object') {
            const yBucket = ensureYear(yr);
            yBucket.monthlyVisits = { ...monthsObj };
          }
        });
      }

      const computedStats: AdminOverviewStats = {
        totalTeachersWithSubmissions: teacherWorksMap.size,
        totalMediaCount: teacherMedia.length,
        totalInnovationsCount: innovations.length,
        totalUnifiedSubmissions: unifiedWorks.length,
        teachersCompleted5Count,
        totalFacilityLogs: facilities.length,
        totalUsersCount: Math.max(userEmailsSet.size, teacherWorksMap.size),
        totalVisitorsCount,
        byMediaType,
        byGradeLevel,
        bySubjectGroup,
        selfProducedCount,
        externalSourceCount,
        yearlyStats,
        updatedAt: new Date().toISOString(),
        fetchedAt: Date.now(),
        fromQuotaFallback: false,
        needsInitialSync: false,
      };

      const { fromQuotaFallback: _fq, needsInitialSync: _ns, fetchedAt: _fa, ...docPayload } =
        computedStats;
      await writeAdminOverviewDoc(docPayload, false);
      saveLocalAdminOverview(computedStats, { allowZeroReset: true });
      updatedStats = computedStats;
    }

    lastQuotaFallbackState = false;
    lastManualOverviewRefreshAt = Date.now();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('acu_bundles_rebuilt', {
          detail: { innovationEntries, mediaEntries, ideaEntries },
        })
      );
    }

    return {
      success: true,
      mediaCount: mediaEntries.length,
      innovationsCount: innovationEntries.length,
      ideasCount: ideaEntries.length,
      stats: updatedStats,
    };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      lastQuotaFallbackState = true;
      notifyQuotaExceeded();
      return {
        success: false,
        quotaExceeded: true,
        error: 'โควต้า Firestore วันนี้เต็ม (429) ไม่สามารถสร้างดัชนีใหม่ได้ชั่วคราว',
      };
    }
    return {
      success: false,
      error: err?.message || 'ไม่สามารถสร้างดัชนีข้อมูลรวมใหม่ได้ในขณะนี้',
    };
  }
}
