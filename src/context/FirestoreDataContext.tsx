import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FacilitySubmission,
  InnovationSubmission,
  SharedIdeaItem,
  SubmissionPaginationState,
  TeacherMediaWork,
  ensureUserOwnSubmissionsLoaded,
  getInitialCriteriaPosterUrl,
  getInitialInnovationsFromCache,
  getInitialTeacherMediaFromCache,
  getStoredFacilities,
  getStoredSharedIdeas,
  getSubmissionPaginationSnapshot,
  loadMoreFacilities as loadMoreFacilitiesService,
  loadMoreInnovations as loadMoreInnovationsService,
  loadMoreSharedIdeas as loadMoreSharedIdeasService,
  loadMoreTeacherMedia as loadMoreTeacherMediaService,
  refreshAllFacilities,
  refreshAllInnovations,
  refreshSharedIdeas,
  refreshTeacherMedia,
  subscribeAllInnovations,
  subscribeAllSubmissions,
  subscribeCriteriaPoster,
  subscribeSharedIdeas,
  subscribeSubmissionPagination,
  subscribeTeacherMedia,
} from '../services/submissionService';
import {
  FullUserProfile,
  getCachedUserProfile,
  getHasMoreUserProfiles,
  getInitialAllUserProfilesMap,
  loadMoreUserProfiles as loadMoreUserProfilesService,
  refreshAllUserProfiles,
  subscribeAllUserProfiles,
  subscribeFullUserProfile,
  subscribeUserProfilesPagination,
} from '../services/userProfileService';
import {
  LOGIN_LOGS_PAGE_SIZE,
  LoginLogEntry,
  SiteVisitSummary,
  fetchAdminLoginLogsOnce,
  fetchSiteSummaryOnce,
  getHasMoreLoginLogs,
  getLocalLoginLogs,
  getLocalSiteSummary,
  loadMoreAdminLoginLogs as loadMoreAdminLoginLogsService,
  subscribeAllLoginLogs,
  subscribeLoginLogsPagination,
  subscribeSiteSummary,
} from '../services/auditService';
import {
  TeacherPrivilegeAdminItem,
  refreshRewardClaims,
  subscribeAllTeachersPrivilegeStatus,
} from '../services/privilegeService';
import {
  AdminServerCounts,
  CoreCollectionCounts,
  fetchAdminServerCounts,
  fetchCoreCollectionCounts,
  getInitialAdminServerCountsFromCache,
  getInitialCoreCountsFromCache,
} from '../services/serverStatsService';
import { getInitialLogoUrl, subscribeSchoolLogo } from '../services/logoService';
import {
  getInitialCertificateLogoUrl,
  subscribeCertificateLogo,
} from '../services/certificateLogoService';
import {
  PopupBannerConfig,
  getCachedOrDefaultBannerConfig,
  subscribePopupBanner,
} from '../services/bannerService';

export const MANUAL_SYNC_COOLDOWN_SECONDS = 60;
const COOLDOWN_STORAGE_KEY = 'acu_manual_sync_cooldowns_v1';

export type SyncKey =
  | 'admin_all_data'
  | 'admin_login_logs'
  | 'admin_email_audit'
  | 'user_profile_stats'
  | 'teacher_media'
  | 'teacher_innovations'
  | 'facility_submissions'
  | 'shared_ideas'
  | 'system_test_logs';

function readStoredCooldowns(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const active: Record<string, number> = {};
    Object.keys(parsed).forEach((key) => {
      const expiresAt = Number(parsed[key]);
      if (Number.isFinite(expiresAt) && expiresAt > now) {
        active[key] = expiresAt;
      }
    });
    return active;
  } catch {
    return {};
  }
}

function writeStoredCooldowns(map: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const cleaned: Record<string, number> = {};
    Object.keys(map).forEach((key) => {
      if (map[key] > now) {
        cleaned[key] = map[key];
      }
    });
    localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // ignore storage errors
  }
}

export type LoadMoreCollectionKey =
  | 'innovations'
  | 'facilities'
  | 'teacherMedia'
  | 'sharedIdeas'
  | 'userProfiles'
  | 'loginLogs';

export interface FirestoreDataContextValue {
  // Global centralized collection & user state
  userEmail: string | null;
  currentUserProfile: FullUserProfile | null;
  innovations: InnovationSubmission[];
  teacherMedia: TeacherMediaWork[];
  facilities: FacilitySubmission[];
  sharedIdeas: SharedIdeaItem[];
  userProfilesMap: Record<string, FullUserProfile>;
  siteSummary: SiteVisitSummary | null;
  loginLogs: LoginLogEntry[];
  privilegeSummaries: TeacherPrivilegeAdminItem[];
  schoolLogoUrl: string;
  certificateLogoUrl: string;
  criteriaPosterUrl: string;
  popupBannerConfig: PopupBannerConfig;
  innovationsLoaded: boolean;

  // Server-side getCountFromServer() totals & breakdowns (cached 6h in localStorage)
  coreCounts: CoreCollectionCounts;
  adminServerCounts: AdminServerCounts;

  // 24-item pagination state & Load More handlers
  hasMoreInnovations: boolean;
  hasMoreFacilities: boolean;
  hasMoreTeacherMedia: boolean;
  hasMoreSharedIdeas: boolean;
  hasMoreUserProfiles: boolean;
  hasMoreLoginLogs: boolean;
  loadingMoreMap: Record<LoadMoreCollectionKey, boolean>;
  isLoadingMore: (key: LoadMoreCollectionKey) => boolean;
  loadMoreInnovations: () => Promise<InnovationSubmission[]>;
  loadMoreFacilities: () => Promise<FacilitySubmission[]>;
  loadMoreTeacherMedia: () => Promise<TeacherMediaWork[]>;
  loadMoreSharedIdeas: () => Promise<SharedIdeaItem[]>;
  loadMoreUserProfiles: () => Promise<Record<string, FullUserProfile>>;
  loadMoreLoginLogs: (callerEmail?: string) => Promise<LoginLogEntry[]>;

  // Centralized lazy-activation guards (mount once per app lifecycle, never re-fetch on component remount)
  ensureInnovationsLoaded: () => void;
  ensureTeacherMediaLoaded: () => void;
  ensureFacilitiesLoaded: () => void;
  ensureSharedIdeasLoaded: () => void;
  ensureUserProfilesLoaded: () => void;
  ensureSiteSummaryLoaded: () => void;
  ensureLoginLogsLoaded: (callerEmail?: string) => Promise<LoginLogEntry[]>;
  ensurePrivilegeSummariesLoaded: () => void;
  ensureTeacherCoreLoaded: () => void;
  ensureAdminDashboardLoaded: () => void;

  // Centralized manual refresh helpers (force-refresh + update state)
  syncInnovations: () => Promise<InnovationSubmission[]>;
  syncTeacherMedia: () => Promise<TeacherMediaWork[]>;
  syncFacilities: () => Promise<FacilitySubmission[]>;
  syncSharedIdeas: () => Promise<SharedIdeaItem[]>;
  syncProfileStats: () => Promise<void>;
  syncLoginLogsAndSummary: (callerEmail?: string) => Promise<{
    siteSummary: SiteVisitSummary | null;
    loginLogs: LoginLogEntry[];
  }>;
  syncAllAdminData: (callerEmail?: string) => Promise<void>;

  // Centralized 60-second debounce & cooldown management
  syncingKeys: Record<string, boolean>;
  getCooldownSeconds: (key: SyncKey | string) => number;
  isKeySyncing: (key: SyncKey | string) => boolean;
  executeWithCooldown: <T = void>(
    key: SyncKey | string,
    task: () => Promise<T>
  ) => Promise<{ executed: boolean; result?: T }>;
}

const FirestoreDataContext = createContext<FirestoreDataContextValue | null>(null);

interface FirestoreDataProviderProps {
  userEmail: string | null;
  children: React.ReactNode;
}

export const FirestoreDataProvider: React.FC<FirestoreDataProviderProps> = ({
  userEmail,
  children,
}) => {
  const [currentUserProfile, setCurrentUserProfile] = useState<FullUserProfile | null>(() =>
    userEmail ? getCachedUserProfile(userEmail) : null
  );
  const [innovations, setInnovations] = useState<InnovationSubmission[]>(() =>
    getInitialInnovationsFromCache()
  );
  const [teacherMedia, setTeacherMedia] = useState<TeacherMediaWork[]>(() =>
    getInitialTeacherMediaFromCache()
  );
  const [facilities, setFacilities] = useState<FacilitySubmission[]>(() =>
    getStoredFacilities()
  );
  const [sharedIdeas, setSharedIdeas] = useState<SharedIdeaItem[]>(() =>
    getStoredSharedIdeas()
  );
  const [userProfilesMap, setUserProfilesMap] = useState<Record<string, FullUserProfile>>(() =>
    getInitialAllUserProfilesMap()
  );
  const [siteSummary, setSiteSummary] = useState<SiteVisitSummary | null>(() => getLocalSiteSummary());
  const [loginLogs, setLoginLogs] = useState<LoginLogEntry[]>(() => getLocalLoginLogs());
  const [privilegeSummaries, setPrivilegeSummaries] = useState<TeacherPrivilegeAdminItem[]>([]);
  const [innovationsLoaded, setInnovationsLoaded] = useState<boolean>(
    () => getInitialInnovationsFromCache().length > 0
  );

  // Server-side counts & pagination state
  const [coreCounts, setCoreCounts] = useState<CoreCollectionCounts>(() =>
    getInitialCoreCountsFromCache()
  );
  const [adminServerCounts, setAdminServerCounts] = useState<AdminServerCounts>(() =>
    getInitialAdminServerCountsFromCache()
  );
  const [submissionPagination, setSubmissionPagination] = useState<SubmissionPaginationState>(() =>
    getSubmissionPaginationSnapshot()
  );
  const [hasMoreUserProfiles, setHasMoreUserProfiles] = useState<boolean>(() =>
    getHasMoreUserProfiles()
  );
  const [hasMoreLoginLogs, setHasMoreLoginLogs] = useState<boolean>(() =>
    getHasMoreLoginLogs()
  );
  const [loadingMoreMap, setLoadingMoreMap] = useState<Record<LoadMoreCollectionKey, boolean>>({
    innovations: false,
    facilities: false,
    teacherMedia: false,
    sharedIdeas: false,
    userProfiles: false,
    loginLogs: false,
  });

  // Lightweight cached settings
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string>(() => getInitialLogoUrl());
  const [certificateLogoUrl, setCertificateLogoUrl] = useState<string>(() => getInitialCertificateLogoUrl());
  const [criteriaPosterUrl, setCriteriaPosterUrl] = useState<string>(() => getInitialCriteriaPosterUrl());
  const [popupBannerConfig, setPopupBannerConfig] = useState<PopupBannerConfig>(() =>
    getCachedOrDefaultBannerConfig()
  );

  // Track which streams have been activated in this provider instance
  const activeStreamsRef = useRef<{
    innovations: boolean;
    media: boolean;
    facilities: boolean;
    ideas: boolean;
    profiles: boolean;
    siteSummary: boolean;
    loginLogs: boolean;
    privileges: boolean;
  }>({
    innovations: false,
    media: false,
    facilities: false,
    ideas: false,
    profiles: false,
    siteSummary: false,
    loginLogs: false,
    privileges: false,
  });
  const unsubsRef = useRef<Array<() => void>>([]);

  // Cooldown & syncing state (persisted in localStorage so closing/reopening modals respects 60s lock)
  const [syncingKeys, setSyncingKeys] = useState<Record<string, boolean>>({});
  const [cooldownsMap, setCooldownsMap] = useState<Record<string, number>>(() => readStoredCooldowns());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const syncingRef = useRef<Record<string, boolean>>({});
  const inFlightSyncTasksRef = useRef<Map<string, Promise<unknown>>>(new Map());

  // Tick every second only while at least one cooldown is active
  const hasActiveCooldown = useMemo(() => {
    return Object.values(cooldownsMap).some((expiresAt) => expiresAt > nowMs);
  }, [cooldownsMap, nowMs]);

  useEffect(() => {
    if (!hasActiveCooldown) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      setCooldownsMap((prev) => {
        const next: Record<string, number> = {};
        let changed = false;
        Object.keys(prev).forEach((k) => {
          if (prev[k] > current) {
            next[k] = prev[k];
          } else {
            changed = true;
          }
        });
        if (changed) {
          writeStoredCooldowns(next);
          return next;
        }
        return prev;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasActiveCooldown]);

  // Subscribe once to shared lightweight settings (24h TTL cached) + pagination states
  useEffect(() => {
    const u1 = subscribeSchoolLogo(setSchoolLogoUrl);
    const u2 = subscribeCertificateLogo(setCertificateLogoUrl);
    const u3 = subscribeCriteriaPoster(setCriteriaPosterUrl);
    const u4 = subscribePopupBanner((cfg) => {
      if (cfg) setPopupBannerConfig(cfg);
    });
    const u5 = subscribeSubmissionPagination(setSubmissionPagination);
    const u6 = subscribeUserProfilesPagination(setHasMoreUserProfiles);
    const u7 = subscribeLoginLogsPagination(setHasMoreLoginLogs);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
    };
  }, []);

  // Subscribe once at root to active user's profile (single doc, 6h TTL)
  useEffect(() => {
    if (!userEmail) {
      setCurrentUserProfile(null);
      return;
    }
    const cached = getCachedUserProfile(userEmail);
    if (cached) {
      setCurrentUserProfile(cached);
    }
    const unsub = subscribeFullUserProfile(userEmail, (loaded) => {
      setCurrentUserProfile(loaded);
    });
    return () => unsub();
  }, [userEmail]);

  // Clean up lazily-activated collection subscriptions on unmount
  useEffect(() => {
    return () => {
      unsubsRef.current.forEach((u) => {
        try {
          u();
        } catch {}
      });
      unsubsRef.current = [];
    };
  }, []);

  const refreshCoreCountsSafe = useCallback(async (force = false) => {
    try {
      const next = await fetchCoreCollectionCounts(force);
      setCoreCounts((prev) => ({
        totalInnovations: Math.max(prev.totalInnovations, next.totalInnovations),
        totalTeacherMedia: Math.max(prev.totalTeacherMedia, next.totalTeacherMedia),
        totalFacilities: Math.max(prev.totalFacilities, next.totalFacilities),
        totalSharedIdeas: Math.max(prev.totalSharedIdeas, next.totalSharedIdeas),
        updatedAt: next.updatedAt || prev.updatedAt,
      }));
    } catch (err) {
      console.warn('[FirestoreDataContext] refreshCoreCountsSafe failed, preserving cached counts:', err);
    }
  }, []);

  const refreshAdminCountsSafe = useCallback(async (force = false) => {
    try {
      const next = await fetchAdminServerCounts(force, true);
      setAdminServerCounts(next);
      setCoreCounts({
        totalInnovations: next.totalInnovations,
        totalTeacherMedia: next.totalTeacherMedia,
        totalFacilities: next.totalFacilities,
        totalSharedIdeas: next.totalSharedIdeas,
        updatedAt: next.updatedAt,
      });
    } catch (err) {
      console.warn('[FirestoreDataContext] refreshAdminCountsSafe failed, preserving cached counts:', err);
    }
  }, []);

  const ensureInnovationsLoaded = useCallback(() => {
    if (!activeStreamsRef.current.innovations) {
      activeStreamsRef.current.innovations = true;
      const unsub = subscribeAllInnovations((list) => {
        setInnovations(list);
        setInnovationsLoaded(true);
      });
      unsubsRef.current.push(unsub);
    }
    if (userEmail) {
      ensureUserOwnSubmissionsLoaded(userEmail, false).catch(() => {});
    }
    refreshCoreCountsSafe(false);
  }, [refreshCoreCountsSafe, userEmail]);

  const ensureTeacherMediaLoaded = useCallback(() => {
    if (!activeStreamsRef.current.media) {
      activeStreamsRef.current.media = true;
      const unsub = subscribeTeacherMedia((works) => {
        setTeacherMedia(works);
      });
      unsubsRef.current.push(unsub);
    }
    if (userEmail) {
      ensureUserOwnSubmissionsLoaded(userEmail, false).catch(() => {});
    }
    refreshCoreCountsSafe(false);
  }, [refreshCoreCountsSafe, userEmail]);

  const ensureFacilitiesLoaded = useCallback(() => {
    if (!activeStreamsRef.current.facilities) {
      activeStreamsRef.current.facilities = true;
      const unsub = subscribeAllSubmissions((list) => {
        setFacilities(list);
      });
      unsubsRef.current.push(unsub);
    }
    if (userEmail) {
      ensureUserOwnSubmissionsLoaded(userEmail, false).catch(() => {});
    }
    refreshCoreCountsSafe(false);
  }, [refreshCoreCountsSafe, userEmail]);

  const ensureSharedIdeasLoaded = useCallback(() => {
    if (!activeStreamsRef.current.ideas) {
      activeStreamsRef.current.ideas = true;
      const unsub = subscribeSharedIdeas((ideas) => {
        setSharedIdeas(ideas);
      });
      unsubsRef.current.push(unsub);
    }
    refreshCoreCountsSafe(false);
  }, [refreshCoreCountsSafe]);

  const ensureUserProfilesLoaded = useCallback(() => {
    if (activeStreamsRef.current.profiles) return;
    activeStreamsRef.current.profiles = true;
    const unsub = subscribeAllUserProfiles((profiles) => {
      setUserProfilesMap(profiles);
    });
    unsubsRef.current.push(unsub);
  }, []);

  const ensureSiteSummaryLoaded = useCallback(() => {
    if (activeStreamsRef.current.siteSummary) return;
    activeStreamsRef.current.siteSummary = true;
    const unsub = subscribeSiteSummary((summary) => {
      if (summary) {
        setSiteSummary((prev) => {
          if (!prev) return summary;
          if ((summary.totalVisits || 0) === 0 && !summary.resetAt && (prev.totalVisits || 0) > 0) {
            return prev;
          }
          return summary;
        });
      }
    });
    unsubsRef.current.push(unsub);
  }, []);

  const ensureLoginLogsLoaded = useCallback(async (callerEmail?: string): Promise<LoginLogEntry[]> => {
    if (!activeStreamsRef.current.loginLogs) {
      activeStreamsRef.current.loginLogs = true;
      const unsub = subscribeAllLoginLogs((logs) => {
        setLoginLogs((prev) => (logs.length > 0 || prev.length === 0 ? logs : prev));
      });
      unsubsRef.current.push(unsub);
    }
    try {
      const fetched = await fetchAdminLoginLogsOnce(false, LOGIN_LOGS_PAGE_SIZE, callerEmail || userEmail || undefined);
      if (Array.isArray(fetched) && fetched.length > 0) {
        setLoginLogs(fetched);
      }
      return fetched;
    } catch (err) {
      console.warn('[FirestoreDataContext] ensureLoginLogsLoaded failed, preserving cached logs:', err);
      return loginLogs;
    }
  }, [userEmail, loginLogs]);

  const ensurePrivilegeSummariesLoaded = useCallback(() => {
    if (activeStreamsRef.current.privileges) return;
    activeStreamsRef.current.privileges = true;
    ensureSharedIdeasLoaded();
    ensureInnovationsLoaded();
    ensureFacilitiesLoaded();
    ensureTeacherMediaLoaded();
    ensureUserProfilesLoaded();
    const unsub = subscribeAllTeachersPrivilegeStatus((list) => {
      setPrivilegeSummaries(list);
    });
    unsubsRef.current.push(unsub);
  }, [
    ensureFacilitiesLoaded,
    ensureInnovationsLoaded,
    ensureSharedIdeasLoaded,
    ensureTeacherMediaLoaded,
    ensureUserProfilesLoaded,
  ]);

  const ensureTeacherCoreLoaded = useCallback(() => {
    ensureInnovationsLoaded();
    ensureTeacherMediaLoaded();
    refreshCoreCountsSafe(false);
    if (userEmail) {
      ensureUserOwnSubmissionsLoaded(userEmail, false).catch(() => {});
    }
  }, [ensureInnovationsLoaded, ensureTeacherMediaLoaded, refreshCoreCountsSafe, userEmail]);

  const ensureAdminDashboardLoaded = useCallback(() => {
    ensureInnovationsLoaded();
    ensureFacilitiesLoaded();
    ensureTeacherMediaLoaded();
    ensureUserProfilesLoaded();
    ensurePrivilegeSummariesLoaded();
    ensureSiteSummaryLoaded();
    refreshAdminCountsSafe(false);
    if (!activeStreamsRef.current.loginLogs) {
      activeStreamsRef.current.loginLogs = true;
      const unsub = subscribeAllLoginLogs((logs) => {
        setLoginLogs((prev) => (logs.length > 0 || prev.length === 0 ? logs : prev));
      });
      unsubsRef.current.push(unsub);
    }
  }, [
    ensureFacilitiesLoaded,
    ensureInnovationsLoaded,
    ensurePrivilegeSummariesLoaded,
    ensureSiteSummaryLoaded,
    ensureTeacherMediaLoaded,
    ensureUserProfilesLoaded,
    refreshAdminCountsSafe,
  ]);

  // Paginated Load More handlers (batches of 24 with startAfter)
  const isLoadingMore = useCallback(
    (key: LoadMoreCollectionKey): boolean => Boolean(loadingMoreMap[key]),
    [loadingMoreMap]
  );

  const loadMoreInnovations = useCallback(async () => {
    setLoadingMoreMap((prev) => ({ ...prev, innovations: true }));
    try {
      const next = await loadMoreInnovationsService();
      if (Array.isArray(next) && next.length > 0) {
        setInnovations(next);
      }
      return next;
    } catch (err) {
      console.warn('[FirestoreDataContext] loadMoreInnovations failed, preserving loaded items:', err);
      return innovations;
    } finally {
      setLoadingMoreMap((prev) => ({ ...prev, innovations: false }));
    }
  }, [innovations]);

  const loadMoreFacilities = useCallback(async () => {
    setLoadingMoreMap((prev) => ({ ...prev, facilities: true }));
    try {
      const next = await loadMoreFacilitiesService();
      if (Array.isArray(next) && next.length > 0) {
        setFacilities(next);
      }
      return next;
    } catch (err) {
      console.warn('[FirestoreDataContext] loadMoreFacilities failed, preserving loaded items:', err);
      return facilities;
    } finally {
      setLoadingMoreMap((prev) => ({ ...prev, facilities: false }));
    }
  }, [facilities]);

  const loadMoreTeacherMedia = useCallback(async () => {
    setLoadingMoreMap((prev) => ({ ...prev, teacherMedia: true }));
    try {
      const next = await loadMoreTeacherMediaService();
      if (Array.isArray(next) && next.length > 0) {
        setTeacherMedia(next);
      }
      return next;
    } catch (err) {
      console.warn('[FirestoreDataContext] loadMoreTeacherMedia failed, preserving loaded items:', err);
      return teacherMedia;
    } finally {
      setLoadingMoreMap((prev) => ({ ...prev, teacherMedia: false }));
    }
  }, [teacherMedia]);

  const loadMoreSharedIdeas = useCallback(async () => {
    setLoadingMoreMap((prev) => ({ ...prev, sharedIdeas: true }));
    try {
      const next = await loadMoreSharedIdeasService();
      if (Array.isArray(next) && next.length > 0) {
        setSharedIdeas(next);
      }
      return next;
    } catch (err) {
      console.warn('[FirestoreDataContext] loadMoreSharedIdeas failed, preserving loaded items:', err);
      return sharedIdeas;
    } finally {
      setLoadingMoreMap((prev) => ({ ...prev, sharedIdeas: false }));
    }
  }, [sharedIdeas]);

  const loadMoreUserProfiles = useCallback(async () => {
    setLoadingMoreMap((prev) => ({ ...prev, userProfiles: true }));
    try {
      const next = await loadMoreUserProfilesService();
      if (next && Object.keys(next).length > 0) {
        setUserProfilesMap(next);
      }
      return next;
    } catch (err) {
      console.warn('[FirestoreDataContext] loadMoreUserProfiles failed, preserving loaded items:', err);
      return userProfilesMap;
    } finally {
      setLoadingMoreMap((prev) => ({ ...prev, userProfiles: false }));
    }
  }, [userProfilesMap]);

  const loadMoreLoginLogs = useCallback(
    async (callerEmail?: string) => {
      setLoadingMoreMap((prev) => ({ ...prev, loginLogs: true }));
      try {
        const next = await loadMoreAdminLoginLogsService(callerEmail || userEmail || undefined);
        if (Array.isArray(next) && next.length > 0) {
          setLoginLogs(next);
        }
        return next;
      } catch (err) {
        console.warn('[FirestoreDataContext] loadMoreLoginLogs failed, preserving loaded logs:', err);
        return loginLogs;
      } finally {
        setLoadingMoreMap((prev) => ({ ...prev, loginLogs: false }));
      }
    },
    [loginLogs, userEmail]
  );

  const syncInnovations = useCallback(async () => {
    try {
      const [list] = await Promise.all([
        refreshAllInnovations(true),
        refreshCoreCountsSafe(true),
        userEmail ? ensureUserOwnSubmissionsLoaded(userEmail, true) : Promise.resolve(),
      ]);
      if (Array.isArray(list) && list.length > 0) {
        setInnovations(list);
      }
      setInnovationsLoaded(true);
      return list;
    } catch (err) {
      console.warn('[FirestoreDataContext] syncInnovations failed, preserving cached state:', err);
      setInnovationsLoaded(true);
      return innovations;
    }
  }, [innovations, refreshCoreCountsSafe, userEmail]);

  const syncTeacherMedia = useCallback(async () => {
    try {
      const [works] = await Promise.all([
        refreshTeacherMedia(true),
        refreshCoreCountsSafe(true),
        userEmail ? ensureUserOwnSubmissionsLoaded(userEmail, true) : Promise.resolve(),
      ]);
      if (Array.isArray(works) && works.length > 0) {
        setTeacherMedia(works);
      }
      return works;
    } catch (err) {
      console.warn('[FirestoreDataContext] syncTeacherMedia failed, preserving cached state:', err);
      return teacherMedia;
    }
  }, [refreshCoreCountsSafe, teacherMedia, userEmail]);

  const syncFacilities = useCallback(async () => {
    try {
      const [list] = await Promise.all([
        refreshAllFacilities(true),
        refreshCoreCountsSafe(true),
        userEmail ? ensureUserOwnSubmissionsLoaded(userEmail, true) : Promise.resolve(),
      ]);
      if (Array.isArray(list) && list.length > 0) {
        setFacilities(list);
      }
      return list;
    } catch (err) {
      console.warn('[FirestoreDataContext] syncFacilities failed, preserving cached state:', err);
      return facilities;
    }
  }, [facilities, refreshCoreCountsSafe, userEmail]);

  const syncSharedIdeas = useCallback(async () => {
    try {
      const [ideas] = await Promise.all([
        refreshSharedIdeas(true),
        refreshCoreCountsSafe(true),
      ]);
      if (Array.isArray(ideas) && ideas.length > 0) {
        setSharedIdeas(ideas);
      }
      return ideas;
    } catch (err) {
      console.warn('[FirestoreDataContext] syncSharedIdeas failed, preserving cached state:', err);
      return sharedIdeas;
    }
  }, [refreshCoreCountsSafe, sharedIdeas]);

  const syncProfileStats = useCallback(async () => {
    try {
      const [innovsRes, mediaRes, summaryRes] = await Promise.allSettled([
        refreshAllInnovations(true),
        refreshTeacherMedia(true),
        fetchSiteSummaryOnce(true),
        refreshCoreCountsSafe(true),
        userEmail ? ensureUserOwnSubmissionsLoaded(userEmail, true) : Promise.resolve(),
      ]);
      if (innovsRes.status === 'fulfilled' && Array.isArray(innovsRes.value) && innovsRes.value.length > 0) {
        setInnovations(innovsRes.value);
        setInnovationsLoaded(true);
      }
      if (mediaRes.status === 'fulfilled' && Array.isArray(mediaRes.value) && mediaRes.value.length > 0) {
        setTeacherMedia(mediaRes.value);
      }
      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        const nextSummary = summaryRes.value;
        setSiteSummary((prev) => {
          if (!prev) return nextSummary;
          if ((nextSummary.totalVisits || 0) === 0 && !nextSummary.resetAt && (prev.totalVisits || 0) > 0) {
            return prev;
          }
          return nextSummary;
        });
      }
    } catch (err) {
      console.warn('[FirestoreDataContext] syncProfileStats failed, preserving cached stats:', err);
    }
  }, [refreshCoreCountsSafe, userEmail]);

  const syncLoginLogsAndSummary = useCallback(
    async (callerEmail?: string) => {
      try {
        const [siteRes, logsRes] = await Promise.allSettled([
          fetchSiteSummaryOnce(true),
          fetchAdminLoginLogsOnce(true, LOGIN_LOGS_PAGE_SIZE, callerEmail || userEmail || undefined),
        ]);
        const nextSummary = siteRes.status === 'fulfilled' ? siteRes.value : null;
        const nextLogs = logsRes.status === 'fulfilled' && Array.isArray(logsRes.value) ? logsRes.value : [];
        if (nextSummary) {
          setSiteSummary((prev) => {
            if (!prev) return nextSummary;
            if ((nextSummary.totalVisits || 0) === 0 && !nextSummary.resetAt && (prev.totalVisits || 0) > 0) {
              return prev;
            }
            return nextSummary;
          });
        }
        if (nextLogs.length > 0) setLoginLogs(nextLogs);
        return {
          siteSummary: nextSummary || siteSummary,
          loginLogs: nextLogs.length > 0 ? nextLogs : loginLogs,
        };
      } catch (err) {
        console.warn('[FirestoreDataContext] syncLoginLogsAndSummary failed, preserving cached state:', err);
        return { siteSummary, loginLogs };
      }
    },
    [userEmail, siteSummary, loginLogs]
  );

  const syncAllAdminData = useCallback(
    async (callerEmail?: string) => {
      try {
        const effectiveEmail = callerEmail || userEmail || undefined;
        const [
          innovRes,
          mediaRes,
          facRes,
          profilesRes,
          claimsRes,
          ideasRes,
          siteRes,
          logsRes,
        ] = await Promise.allSettled([
          refreshAllInnovations(true),
          refreshTeacherMedia(true),
          refreshAllFacilities(true),
          refreshAllUserProfiles(true),
          refreshRewardClaims(true),
          refreshSharedIdeas(true),
          fetchSiteSummaryOnce(true),
          fetchAdminLoginLogsOnce(true, LOGIN_LOGS_PAGE_SIZE, effectiveEmail),
          refreshAdminCountsSafe(true),
        ]);
        if (innovRes.status === 'fulfilled' && Array.isArray(innovRes.value) && innovRes.value.length > 0) {
          setInnovations(innovRes.value);
          setInnovationsLoaded(true);
        }
        if (mediaRes.status === 'fulfilled' && Array.isArray(mediaRes.value) && mediaRes.value.length > 0) {
          setTeacherMedia(mediaRes.value);
        }
        if (facRes.status === 'fulfilled' && Array.isArray(facRes.value) && facRes.value.length > 0) {
          setFacilities(facRes.value);
        }
        if (profilesRes.status === 'fulfilled' && profilesRes.value && Object.keys(profilesRes.value).length > 0) {
          setUserProfilesMap(profilesRes.value);
        }
        if (ideasRes.status === 'fulfilled' && Array.isArray(ideasRes.value) && ideasRes.value.length > 0) {
          setSharedIdeas(ideasRes.value);
        }
        if (siteRes.status === 'fulfilled' && siteRes.value) {
          const nextSummary = siteRes.value;
          setSiteSummary((prev) => {
            if (!prev) return nextSummary;
            if ((nextSummary.totalVisits || 0) === 0 && !nextSummary.resetAt && (prev.totalVisits || 0) > 0) {
              return prev;
            }
            return nextSummary;
          });
        }
        if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value) && logsRes.value.length > 0) {
          setLoginLogs(logsRes.value);
        }
        void claimsRes;
      } catch (err) {
        console.warn('[FirestoreDataContext] syncAllAdminData failed, preserving cached state:', err);
      }
    },
    [refreshAdminCountsSafe, userEmail]
  );

  const getCooldownSeconds = useCallback(
    (key: SyncKey | string): number => {
      const expiresAt = cooldownsMap[key] || 0;
      if (expiresAt <= nowMs) return 0;
      return Math.ceil((expiresAt - nowMs) / 1000);
    },
    [cooldownsMap, nowMs]
  );

  const isKeySyncing = useCallback(
    (key: SyncKey | string): boolean => Boolean(syncingKeys[key]),
    [syncingKeys]
  );

  const executeWithCooldown = useCallback(
    async <T = void>(
      key: SyncKey | string,
      task: () => Promise<T>
    ): Promise<{ executed: boolean; result?: T }> => {
      // 1. In-flight debounce: if already running for this key, share / skip
      if (syncingRef.current[key] || inFlightSyncTasksRef.current.has(key)) {
        const existing = inFlightSyncTasksRef.current.get(key) as Promise<T> | undefined;
        if (existing) {
          const result = await existing;
          return { executed: false, result };
        }
        return { executed: false };
      }

      // 2. Enforce 60-second cooldown after a previous successful sync
      const current = Date.now();
      const storedExpires = cooldownsMap[key] || readStoredCooldowns()[key] || 0;
      if (storedExpires > current) {
        setNowMs(current);
        setCooldownsMap((prev) => ({ ...prev, [key]: storedExpires }));
        return { executed: false };
      }

      syncingRef.current[key] = true;
      setSyncingKeys((prev) => ({ ...prev, [key]: true }));

      const runPromise = (async () => {
        try {
          const result = await task();
          const completedAt = Date.now();
          const expiresAt = completedAt + MANUAL_SYNC_COOLDOWN_SECONDS * 1000;
          setNowMs(completedAt);
          setCooldownsMap((prev) => {
            const next = { ...prev, [key]: expiresAt };
            writeStoredCooldowns(next);
            return next;
          });
          return { executed: true, result };
        } finally {
          syncingRef.current[key] = false;
          inFlightSyncTasksRef.current.delete(key);
          setSyncingKeys((prev) => ({ ...prev, [key]: false }));
        }
      })();

      inFlightSyncTasksRef.current.set(key, runPromise);
      return runPromise;
    },
    [cooldownsMap]
  );

  const value = useMemo<FirestoreDataContextValue>(
    () => ({
      userEmail,
      currentUserProfile,
      innovations,
      teacherMedia,
      facilities,
      sharedIdeas,
      userProfilesMap,
      siteSummary,
      loginLogs,
      privilegeSummaries,
      schoolLogoUrl,
      certificateLogoUrl,
      criteriaPosterUrl,
      popupBannerConfig,
      innovationsLoaded,
      coreCounts,
      adminServerCounts,
      hasMoreInnovations: submissionPagination.innovations,
      hasMoreFacilities: submissionPagination.facilities,
      hasMoreTeacherMedia: submissionPagination.teacherMedia,
      hasMoreSharedIdeas: submissionPagination.sharedIdeas,
      hasMoreUserProfiles,
      hasMoreLoginLogs,
      loadingMoreMap,
      isLoadingMore,
      loadMoreInnovations,
      loadMoreFacilities,
      loadMoreTeacherMedia,
      loadMoreSharedIdeas,
      loadMoreUserProfiles,
      loadMoreLoginLogs,
      ensureInnovationsLoaded,
      ensureTeacherMediaLoaded,
      ensureFacilitiesLoaded,
      ensureSharedIdeasLoaded,
      ensureUserProfilesLoaded,
      ensureSiteSummaryLoaded,
      ensureLoginLogsLoaded,
      ensurePrivilegeSummariesLoaded,
      ensureTeacherCoreLoaded,
      ensureAdminDashboardLoaded,
      syncInnovations,
      syncTeacherMedia,
      syncFacilities,
      syncSharedIdeas,
      syncProfileStats,
      syncLoginLogsAndSummary,
      syncAllAdminData,
      syncingKeys,
      getCooldownSeconds,
      isKeySyncing,
      executeWithCooldown,
    }),
    [
      userEmail,
      currentUserProfile,
      innovations,
      teacherMedia,
      facilities,
      sharedIdeas,
      userProfilesMap,
      siteSummary,
      loginLogs,
      privilegeSummaries,
      schoolLogoUrl,
      certificateLogoUrl,
      criteriaPosterUrl,
      popupBannerConfig,
      innovationsLoaded,
      coreCounts,
      adminServerCounts,
      submissionPagination,
      hasMoreUserProfiles,
      hasMoreLoginLogs,
      loadingMoreMap,
      isLoadingMore,
      loadMoreInnovations,
      loadMoreFacilities,
      loadMoreTeacherMedia,
      loadMoreSharedIdeas,
      loadMoreUserProfiles,
      loadMoreLoginLogs,
      ensureInnovationsLoaded,
      ensureTeacherMediaLoaded,
      ensureFacilitiesLoaded,
      ensureSharedIdeasLoaded,
      ensureUserProfilesLoaded,
      ensureSiteSummaryLoaded,
      ensureLoginLogsLoaded,
      ensurePrivilegeSummariesLoaded,
      ensureTeacherCoreLoaded,
      ensureAdminDashboardLoaded,
      syncInnovations,
      syncTeacherMedia,
      syncFacilities,
      syncSharedIdeas,
      syncProfileStats,
      syncLoginLogsAndSummary,
      syncAllAdminData,
      syncingKeys,
      getCooldownSeconds,
      isKeySyncing,
      executeWithCooldown,
    ]
  );

  return <FirestoreDataContext.Provider value={value}>{children}</FirestoreDataContext.Provider>;
};

export function useFirestoreData(): FirestoreDataContextValue {
  const ctx = useContext(FirestoreDataContext);
  if (!ctx) {
    throw new Error('useFirestoreData must be used inside FirestoreDataProvider');
  }
  return ctx;
}

/**
 * Convenience hook for manual Sync/Refresh buttons:
 * - Disables button while syncing and shows "กำลังซิงค์..."
 * - Keeps button disabled for 60 seconds after a successful fetch with live countdown
 */
export function useSyncButtonState(key: SyncKey | string) {
  const { isKeySyncing, getCooldownSeconds, executeWithCooldown } = useFirestoreData();
  const isSyncing = isKeySyncing(key);
  const cooldownSeconds = getCooldownSeconds(key);
  const isDisabled = isSyncing || cooldownSeconds > 0;

  const triggerSync = useCallback(
    async <T = void>(task: () => Promise<T>) => {
      return executeWithCooldown(key, task);
    },
    [executeWithCooldown, key]
  );

  const getButtonLabel = useCallback(
    (idleLabel = 'รีเฟรช') => {
      if (isSyncing) return 'กำลังซิงค์...';
      if (cooldownSeconds > 0) return `${idleLabel} (${cooldownSeconds} วินาที)`;
      return idleLabel;
    },
    [cooldownSeconds, isSyncing]
  );

  return {
    isSyncing,
    cooldownSeconds,
    isDisabled,
    triggerSync,
    getButtonLabel,
  };
}
