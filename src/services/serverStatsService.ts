import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db, isQuotaExceededError, notifyQuotaExceeded } from '../firebase';

const SERVER_STATS_CACHE_KEY = 'acu_dashboard_server_stats_v1';
const SERVER_STATS_FETCHED_AT_KEY = 'acu_dashboard_server_stats_fetched_at_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export const STATS_SUBJECT_GROUPS = [
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

export interface DashboardServerStats {
  totalInnovationsCount: number;
  totalTeacherMediaCount: number;
  totalFacilitiesCount: number;
  totalUsersCount: number;
  completedTeachersCount: number;
  totalSharedIdeasCount: number;
  mediaTypeCounts: {
    'สื่อสิ่งพิมพ์': number;
    'สื่อเทคโนโลยี': number;
    'สื่ออื่น ๆ': number;
  };
  productionTypeCounts: {
    selfMadeCount: number;
    sourcedCount: number;
  };
  subjectGroupCounts: Record<string, number>;
  fetchedAt: number;
}

const DEFAULT_SERVER_STATS: DashboardServerStats = {
  totalInnovationsCount: 0,
  totalTeacherMediaCount: 0,
  totalFacilitiesCount: 0,
  totalUsersCount: 0,
  completedTeachersCount: 0,
  totalSharedIdeasCount: 0,
  mediaTypeCounts: {
    'สื่อสิ่งพิมพ์': 0,
    'สื่อเทคโนโลยี': 0,
    'สื่ออื่น ๆ': 0,
  },
  productionTypeCounts: {
    selfMadeCount: 0,
    sourcedCount: 0,
  },
  subjectGroupCounts: {},
  fetchedAt: 0,
};

const statsListeners = new Set<(stats: DashboardServerStats) => void>();
let sharedServerStats: DashboardServerStats | null = null;
let inFlightStatsFetch: Promise<DashboardServerStats> | null = null;

export function getCachedServerStats(): DashboardServerStats {
  if (sharedServerStats && sharedServerStats.fetchedAt > 0) {
    return sharedServerStats;
  }
  if (typeof window === 'undefined') return { ...DEFAULT_SERVER_STATS };
  try {
    const raw = localStorage.getItem(SERVER_STATS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const merged: DashboardServerStats = {
          ...DEFAULT_SERVER_STATS,
          ...parsed,
          mediaTypeCounts: {
            ...DEFAULT_SERVER_STATS.mediaTypeCounts,
            ...(parsed.mediaTypeCounts || {}),
          },
          productionTypeCounts: {
            ...DEFAULT_SERVER_STATS.productionTypeCounts,
            ...(parsed.productionTypeCounts || {}),
          },
          subjectGroupCounts: {
            ...(parsed.subjectGroupCounts || {}),
          },
        };
        sharedServerStats = merged;
        return merged;
      }
    }
  } catch (err) {
    console.warn('Could not read cached dashboard server stats:', err);
  }
  return { ...DEFAULT_SERVER_STATS };
}

function saveCachedServerStats(stats: DashboardServerStats, updateFetchedTimestamp = true): void {
  sharedServerStats = stats;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SERVER_STATS_CACHE_KEY, JSON.stringify(stats));
      if (updateFetchedTimestamp) {
        localStorage.setItem(SERVER_STATS_FETCHED_AT_KEY, String(Date.now()));
      }
    } catch (err) {
      console.warn('Could not persist dashboard server stats:', err);
    }
  }
  statsListeners.forEach((cb) => {
    try {
      cb(stats);
    } catch {
      // ignore
    }
  });
}

function isServerStatsCacheFresh(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const ts = Number(localStorage.getItem(SERVER_STATS_FETCHED_AT_KEY) || 0);
    if (!ts || isNaN(ts)) return false;
    const raw = localStorage.getItem(SERVER_STATS_CACHE_KEY);
    if (!raw) return false;
    return Date.now() - ts < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

async function safeGetCount(q: any, fallbackValue: number): Promise<number> {
  try {
    const snap = await getCountFromServer(q);
    const val = snap?.data()?.count;
    return typeof val === 'number' ? val : fallbackValue;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
    }
    throw err;
  }
}

/**
 * Fetch dashboard summary counts using Firestore getCountFromServer() aggregation queries.
 * - Strictly reads ONLY existing collections (no stats/* or bundles/* collections).
 * - Never touches `login_logs` on dashboard load.
 * - Uses 6-hour localStorage TTL cache and in-flight deduplication.
 * - On error, preserves existing localStorage cached values without resetting to 0.
 */
export async function fetchDashboardServerStats(
  forceRefresh = false
): Promise<DashboardServerStats> {
  const existingCache = getCachedServerStats();

  if (!forceRefresh && isServerStatsCacheFresh() && existingCache.fetchedAt > 0) {
    return existingCache;
  }

  if (!forceRefresh && inFlightStatsFetch) {
    return inFlightStatsFetch;
  }

  inFlightStatsFetch = (async () => {
    try {
      const innovCol = collection(db, 'teacher_innovations_submissions');
      const mediaCol = collection(db, 'teacher_media_repository');
      const facCol = collection(db, 'system_test_submissions');
      const usersCol = collection(db, 'user_profiles');
      const ideasCol = collection(db, 'shared_ideas');

      const [
        totalInnovationsCount,
        totalTeacherMediaCount,
        totalFacilitiesCount,
        totalUsersCount,
        completedTeachersCount,
        totalSharedIdeasCount,
        printCount,
        techCount,
        otherCount,
        selfMadeCount,
        sourcedCount,
        ...subjectGroupResults
      ] = await Promise.all([
        safeGetCount(innovCol, existingCache.totalInnovationsCount),
        safeGetCount(mediaCol, existingCache.totalTeacherMediaCount),
        safeGetCount(facCol, existingCache.totalFacilitiesCount),
        safeGetCount(usersCol, existingCache.totalUsersCount),
        safeGetCount(query(usersCol, where('stats.submissionCount', '>=', 5)), existingCache.completedTeachersCount),
        safeGetCount(ideasCol, existingCache.totalSharedIdeasCount),
        safeGetCount(query(innovCol, where('mediaType', '==', 'สื่อสิ่งพิมพ์')), existingCache.mediaTypeCounts['สื่อสิ่งพิมพ์']),
        safeGetCount(query(innovCol, where('mediaType', '==', 'สื่อเทคโนโลยี')), existingCache.mediaTypeCounts['สื่อเทคโนโลยี']),
        safeGetCount(query(innovCol, where('mediaType', '==', 'สื่ออื่น ๆ')), existingCache.mediaTypeCounts['สื่ออื่น ๆ']),
        safeGetCount(query(innovCol, where('productionType', '==', 'ครูผลิตสื่อเอง')), existingCache.productionTypeCounts.selfMadeCount),
        safeGetCount(query(innovCol, where('productionType', '==', 'ครูนำสื่อจากแหล่งอื่นมาใช้')), existingCache.productionTypeCounts.sourcedCount),
        ...STATS_SUBJECT_GROUPS.map((sg) =>
          safeGetCount(
            query(innovCol, where('subjectGroup', '==', sg)),
            existingCache.subjectGroupCounts[sg] || 0
          )
        ),
      ]);

      const subjectGroupCounts: Record<string, number> = {};
      STATS_SUBJECT_GROUPS.forEach((sg, idx) => {
        subjectGroupCounts[sg] = subjectGroupResults[idx] ?? (existingCache.subjectGroupCounts[sg] || 0);
      });

      const nextStats: DashboardServerStats = {
        totalInnovationsCount,
        totalTeacherMediaCount,
        totalFacilitiesCount,
        totalUsersCount,
        completedTeachersCount,
        totalSharedIdeasCount,
        mediaTypeCounts: {
          'สื่อสิ่งพิมพ์': printCount,
          'สื่อเทคโนโลยี': techCount,
          'สื่ออื่น ๆ': otherCount,
        },
        productionTypeCounts: {
          selfMadeCount,
          sourcedCount,
        },
        subjectGroupCounts,
        fetchedAt: Date.now(),
      };

      saveCachedServerStats(nextStats, true);
      return nextStats;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      console.warn('getCountFromServer failed, preserving cached dashboard stats:', err);
      // Strictly preserve existing cache without clearing state to 0
      return existingCache;
    } finally {
      inFlightStatsFetch = null;
    }
  })();

  return inFlightStatsFetch;
}

/**
 * Subscribe to dashboard server stats (serves cached counts immediately, refreshes only if 6h TTL expired).
 */
export function subscribeDashboardServerStats(
  callback: (stats: DashboardServerStats) => void
): () => void {
  statsListeners.add(callback);
  const cached = getCachedServerStats();
  callback(cached);

  fetchDashboardServerStats(false).catch(() => {});

  return () => {
    statsListeners.delete(callback);
  };
}

/**
 * Locally adjust cached server counts after create/delete without re-fetching Firestore.
 */
export function adjustServerStatsLocally(delta: {
  innovationsDelta?: number;
  teacherMediaDelta?: number;
  facilitiesDelta?: number;
  usersDelta?: number;
  mediaType?: string;
  productionType?: string;
  subjectGroup?: string;
}): void {
  const cur = getCachedServerStats();
  const next: DashboardServerStats = {
    ...cur,
    mediaTypeCounts: { ...cur.mediaTypeCounts },
    productionTypeCounts: { ...cur.productionTypeCounts },
    subjectGroupCounts: { ...cur.subjectGroupCounts },
  };

  if (typeof delta.innovationsDelta === 'number' && delta.innovationsDelta !== 0) {
    next.totalInnovationsCount = Math.max(0, cur.totalInnovationsCount + delta.innovationsDelta);
    if (delta.mediaType && next.mediaTypeCounts[delta.mediaType as keyof typeof next.mediaTypeCounts] !== undefined) {
      const k = delta.mediaType as keyof typeof next.mediaTypeCounts;
      next.mediaTypeCounts[k] = Math.max(0, next.mediaTypeCounts[k] + delta.innovationsDelta);
    }
    if (delta.productionType === 'ครูผลิตสื่อเอง') {
      next.productionTypeCounts.selfMadeCount = Math.max(
        0,
        next.productionTypeCounts.selfMadeCount + delta.innovationsDelta
      );
    } else if (delta.productionType) {
      next.productionTypeCounts.sourcedCount = Math.max(
        0,
        next.productionTypeCounts.sourcedCount + delta.innovationsDelta
      );
    }
    if (delta.subjectGroup) {
      next.subjectGroupCounts[delta.subjectGroup] = Math.max(
        0,
        (next.subjectGroupCounts[delta.subjectGroup] || 0) + delta.innovationsDelta
      );
    }
  }

  if (typeof delta.teacherMediaDelta === 'number' && delta.teacherMediaDelta !== 0) {
    next.totalTeacherMediaCount = Math.max(0, cur.totalTeacherMediaCount + delta.teacherMediaDelta);
  }

  if (typeof delta.facilitiesDelta === 'number' && delta.facilitiesDelta !== 0) {
    next.totalFacilitiesCount = Math.max(0, cur.totalFacilitiesCount + delta.facilitiesDelta);
  }

  if (typeof delta.usersDelta === 'number' && delta.usersDelta !== 0) {
    next.totalUsersCount = Math.max(0, cur.totalUsersCount + delta.usersDelta);
  }

  saveCachedServerStats(next, false);
}
