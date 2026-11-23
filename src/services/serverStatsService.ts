import {
  collection,
  getCountFromServer,
  query,
  where,
} from 'firebase/firestore';
import { db, isQuotaExceededError, notifyQuotaExceeded, waitForAuthReady } from '../firebase';
import { GRADE_LEVELS, SUBJECT_GROUPS } from './submissionService';

export interface CoreCollectionCounts {
  totalInnovations: number;
  totalTeacherMedia: number;
  totalFacilities: number;
  totalSharedIdeas: number;
  updatedAt: number;
}

export interface AdminServerCounts extends CoreCollectionCounts {
  totalTeachers: number;
  totalLoginLogs: number;
  totalRewardClaims: number;
  receivedRewardsCount: number;
  pendingRewardsCount: number;
  mediaTypeCounts: Record<string, number>;
  selfMadeCount: number;
  sourcedCount: number;
  subjectGroupCounts: Record<string, number>;
  gradeCounts: Record<string, number>;
}

const CORE_COUNTS_CACHE_KEY = 'acu_cached_core_server_counts_v1';
const ADMIN_COUNTS_CACHE_KEY = 'acu_cached_admin_server_counts_v1';
const SERVER_COUNTS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours TTL

const EMPTY_ADMIN_COUNTS: AdminServerCounts = {
  totalInnovations: 0,
  totalTeacherMedia: 0,
  totalFacilities: 0,
  totalSharedIdeas: 0,
  totalTeachers: 0,
  totalLoginLogs: 0,
  totalRewardClaims: 0,
  receivedRewardsCount: 0,
  pendingRewardsCount: 0,
  mediaTypeCounts: {
    'สื่อสิ่งพิมพ์': 0,
    'สื่อเทคโนโลยี': 0,
    'สื่ออื่น ๆ': 0,
  },
  selfMadeCount: 0,
  sourcedCount: 0,
  subjectGroupCounts: {},
  gradeCounts: {},
  updatedAt: 0,
};

let sharedCoreCounts: CoreCollectionCounts | null = null;
let sharedAdminCounts: AdminServerCounts | null = null;
let inFlightCoreCounts: Promise<CoreCollectionCounts> | null = null;
let inFlightAdminCounts: Promise<AdminServerCounts> | null = null;

function readCachedCoreCounts(allowExpired = true): CoreCollectionCounts | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CORE_COUNTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoreCollectionCounts;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!allowExpired) {
      if (!parsed.updatedAt || Date.now() - parsed.updatedAt >= SERVER_COUNTS_TTL_MS) {
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedCoreCounts(counts: CoreCollectionCounts): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CORE_COUNTS_CACHE_KEY, JSON.stringify(counts));
  } catch {
    // ignore storage errors
  }
}

export function getInitialCoreCountsFromCache(): CoreCollectionCounts {
  return (
    sharedCoreCounts ||
    readCachedCoreCounts(true) || {
      totalInnovations: 0,
      totalTeacherMedia: 0,
      totalFacilities: 0,
      totalSharedIdeas: 0,
      updatedAt: 0,
    }
  );
}

function readCachedAdminCounts(allowExpired = true): AdminServerCounts | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ADMIN_COUNTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminServerCounts;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!allowExpired) {
      if (!parsed.updatedAt || Date.now() - parsed.updatedAt >= SERVER_COUNTS_TTL_MS) {
        return null;
      }
    }
    return {
      ...EMPTY_ADMIN_COUNTS,
      ...parsed,
      mediaTypeCounts: {
        ...EMPTY_ADMIN_COUNTS.mediaTypeCounts,
        ...(parsed.mediaTypeCounts || {}),
      },
      subjectGroupCounts: { ...(parsed.subjectGroupCounts || {}) },
      gradeCounts: { ...(parsed.gradeCounts || {}) },
    };
  } catch {
    return null;
  }
}

function saveCachedAdminCounts(counts: AdminServerCounts): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADMIN_COUNTS_CACHE_KEY, JSON.stringify(counts));
  } catch {
    // ignore storage errors
  }
}

export function getInitialAdminServerCountsFromCache(): AdminServerCounts {
  return sharedAdminCounts || readCachedAdminCounts(true) || { ...EMPTY_ADMIN_COUNTS };
}

/**
 * Safely executes getCountFromServer() and returns null on error so callers
 * can preserve existing cached values without ever overwriting them with 0.
 */
async function safeGetCount(targetQuery: any): Promise<number | null> {
  try {
    const aggSnap = await getCountFromServer(targetQuery);
    const val = aggSnap.data()?.count;
    return typeof val === 'number' && Number.isFinite(val) ? val : null;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
    }
    console.warn('[Firestore] getCountFromServer failed, preserving cached count:', err);
    return null;
  }
}

/**
 * Fetch lightweight collection totals via Firestore getCountFromServer() (6-hour localStorage TTL).
 * Avoids downloading full collections just to count `.length`.
 */
export async function fetchCoreCollectionCounts(forceRefresh = false): Promise<CoreCollectionCounts> {
  const cachedAny = sharedCoreCounts || readCachedCoreCounts(true) || getInitialCoreCountsFromCache();

  if (inFlightCoreCounts) {
    return inFlightCoreCounts;
  }

  if (!forceRefresh) {
    const fresh = readCachedCoreCounts(false);
    if (fresh) {
      sharedCoreCounts = fresh;
      return fresh;
    }
  }

  inFlightCoreCounts = (async () => {
    try {
      await waitForAuthReady();
      const [innovCount, mediaCount, sysTotalCount, sysInnovTestCount, ideasCount] = await Promise.all([
        safeGetCount(collection(db, 'teacher_innovations_submissions')),
        safeGetCount(collection(db, 'teacher_media_repository')),
        safeGetCount(collection(db, 'system_test_submissions')),
        safeGetCount(query(collection(db, 'system_test_submissions'), where('sourceModule', '==', 'Innovation_5_Items'))),
        safeGetCount(collection(db, 'shared_ideas')),
      ]);

      const resolvedFacilities =
        sysTotalCount !== null && sysInnovTestCount !== null
          ? Math.max(0, sysTotalCount - sysInnovTestCount)
          : sysTotalCount !== null
            ? sysTotalCount
            : cachedAny.totalFacilities;

      const allFailed =
        innovCount === null &&
        mediaCount === null &&
        sysTotalCount === null &&
        ideasCount === null;

      if (allFailed) {
        return cachedAny;
      }

      const next: CoreCollectionCounts = {
        totalInnovations: innovCount !== null ? innovCount : cachedAny.totalInnovations,
        totalTeacherMedia: mediaCount !== null ? mediaCount : cachedAny.totalTeacherMedia,
        totalFacilities: resolvedFacilities,
        totalSharedIdeas: ideasCount !== null ? ideasCount : cachedAny.totalSharedIdeas,
        updatedAt: Date.now(),
      };

      sharedCoreCounts = next;
      saveCachedCoreCounts(next);
      return next;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      console.warn('[Firestore] fetchCoreCollectionCounts failed, preserving localStorage:', err);
      return cachedAny;
    } finally {
      inFlightCoreCounts = null;
    }
  })();

  return inFlightCoreCounts;
}

/**
 * Fetch comprehensive Admin Dashboard summary counts via Firestore getCountFromServer()
 * (6-hour localStorage TTL, single-field index aggregations only — zero composite indexes).
 */
export async function fetchAdminServerCounts(
  forceRefresh = false,
  includeLoginLogsCount = true
): Promise<AdminServerCounts> {
  const cachedAny = sharedAdminCounts || readCachedAdminCounts(true) || getInitialAdminServerCountsFromCache();

  if (inFlightAdminCounts) {
    return inFlightAdminCounts;
  }

  if (!forceRefresh) {
    const fresh = readCachedAdminCounts(false);
    if (fresh) {
      sharedAdminCounts = fresh;
      return fresh;
    }
  }

  inFlightAdminCounts = (async () => {
    try {
      await waitForAuthReady();

      const baseQueries = [
        safeGetCount(collection(db, 'teacher_innovations_submissions')),
        safeGetCount(collection(db, 'teacher_media_repository')),
        safeGetCount(collection(db, 'system_test_submissions')),
        safeGetCount(query(collection(db, 'system_test_submissions'), where('sourceModule', '==', 'Innovation_5_Items'))),
        safeGetCount(collection(db, 'shared_ideas')),
        safeGetCount(collection(db, 'user_profiles')),
        includeLoginLogsCount ? safeGetCount(collection(db, 'login_logs')) : Promise.resolve(cachedAny.totalLoginLogs),
        safeGetCount(collection(db, 'reward_privilege_claims')),
        safeGetCount(query(collection(db, 'reward_privilege_claims'), where('claimStatus', '==', 'received'))),
        safeGetCount(query(collection(db, 'reward_privilege_claims'), where('claimStatus', '==', 'pending_pickup'))),
      ] as const;

      const mediaTypeKeys = ['สื่อสิ่งพิมพ์', 'สื่อเทคโนโลยี', 'สื่ออื่น ๆ'] as const;
      const mediaTypePromises = mediaTypeKeys.map((mt) =>
        safeGetCount(query(collection(db, 'teacher_innovations_submissions'), where('mediaType', '==', mt)))
      );

      const selfMadePromise = safeGetCount(
        query(collection(db, 'teacher_innovations_submissions'), where('productionType', '==', 'ครูผลิตสื่อเอง'))
      );
      const sourcedPromise = safeGetCount(
        query(collection(db, 'teacher_innovations_submissions'), where('productionType', '==', 'ครูนำสื่อจากแหล่งอื่นมาใช้'))
      );

      const subjectGroupPromises = SUBJECT_GROUPS.map((sg) =>
        safeGetCount(query(collection(db, 'teacher_innovations_submissions'), where('subjectGroup', '==', sg)))
      );

      const gradePromises = GRADE_LEVELS.map((grade) =>
        safeGetCount(query(collection(db, 'teacher_innovations_submissions'), where('gradeLevel', '==', grade)))
      );

      const [
        baseResults,
        mediaTypeResults,
        selfMadeRes,
        sourcedRes,
        subjectGroupResults,
        gradeResults,
      ] = await Promise.all([
        Promise.all(baseQueries),
        Promise.all(mediaTypePromises),
        selfMadePromise,
        sourcedPromise,
        Promise.all(subjectGroupPromises),
        Promise.all(gradePromises),
      ]);

      const [
        innovCount,
        mediaCount,
        sysTotalCount,
        sysInnovTestCount,
        ideasCount,
        profilesCount,
        loginLogsCount,
        claimsCount,
        receivedRewardsRes,
        pendingRewardsRes,
      ] = baseResults;

      const anySucceeded =
        baseResults.some((r) => r !== null) ||
        mediaTypeResults.some((r) => r !== null) ||
        selfMadeRes !== null ||
        subjectGroupResults.some((r) => r !== null) ||
        gradeResults.some((r) => r !== null);

      if (!anySucceeded) {
        return cachedAny;
      }

      const resolvedFacilities =
        sysTotalCount !== null && sysInnovTestCount !== null
          ? Math.max(0, sysTotalCount - sysInnovTestCount)
          : sysTotalCount !== null
            ? sysTotalCount
            : cachedAny.totalFacilities;

      const nextMediaTypes: Record<string, number> = { ...cachedAny.mediaTypeCounts };
      mediaTypeKeys.forEach((mt, idx) => {
        if (mediaTypeResults[idx] !== null) {
          nextMediaTypes[mt] = mediaTypeResults[idx]!;
        }
      });

      const nextSubjectGroups: Record<string, number> = { ...cachedAny.subjectGroupCounts };
      SUBJECT_GROUPS.forEach((sg, idx) => {
        if (subjectGroupResults[idx] !== null) {
          nextSubjectGroups[sg] = subjectGroupResults[idx]!;
        }
      });

      const nextGrades: Record<string, number> = { ...cachedAny.gradeCounts };
      GRADE_LEVELS.forEach((grade, idx) => {
        if (gradeResults[idx] !== null) {
          nextGrades[grade] = gradeResults[idx]!;
        }
      });

      const totalInnov = innovCount !== null ? innovCount : cachedAny.totalInnovations;
      const nextSelfMade = selfMadeRes !== null ? selfMadeRes : cachedAny.selfMadeCount;
      const nextSourced =
        sourcedRes !== null
          ? sourcedRes
          : innovCount !== null && selfMadeRes !== null
            ? Math.max(0, totalInnov - nextSelfMade)
            : cachedAny.sourcedCount;

      const nextAdminCounts: AdminServerCounts = {
        totalInnovations: totalInnov,
        totalTeacherMedia: mediaCount !== null ? mediaCount : cachedAny.totalTeacherMedia,
        totalFacilities: resolvedFacilities,
        totalSharedIdeas: ideasCount !== null ? ideasCount : cachedAny.totalSharedIdeas,
        totalTeachers: profilesCount !== null ? profilesCount : cachedAny.totalTeachers,
        totalLoginLogs: loginLogsCount !== null ? loginLogsCount : cachedAny.totalLoginLogs,
        totalRewardClaims: claimsCount !== null ? claimsCount : cachedAny.totalRewardClaims,
        receivedRewardsCount:
          receivedRewardsRes !== null ? receivedRewardsRes : cachedAny.receivedRewardsCount,
        pendingRewardsCount:
          pendingRewardsRes !== null ? pendingRewardsRes : cachedAny.pendingRewardsCount,
        mediaTypeCounts: nextMediaTypes,
        selfMadeCount: nextSelfMade,
        sourcedCount: nextSourced,
        subjectGroupCounts: nextSubjectGroups,
        gradeCounts: nextGrades,
        updatedAt: Date.now(),
      };

      sharedAdminCounts = nextAdminCounts;
      saveCachedAdminCounts(nextAdminCounts);

      // Keep core counts in sync too
      const nextCore: CoreCollectionCounts = {
        totalInnovations: nextAdminCounts.totalInnovations,
        totalTeacherMedia: nextAdminCounts.totalTeacherMedia,
        totalFacilities: nextAdminCounts.totalFacilities,
        totalSharedIdeas: nextAdminCounts.totalSharedIdeas,
        updatedAt: nextAdminCounts.updatedAt,
      };
      sharedCoreCounts = nextCore;
      saveCachedCoreCounts(nextCore);

      return nextAdminCounts;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      console.warn('[Firestore] fetchAdminServerCounts failed, preserving localStorage:', err);
      return cachedAny;
    } finally {
      inFlightAdminCounts = null;
    }
  })();

  return inFlightAdminCounts;
}
