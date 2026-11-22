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
  TeacherMediaWork,
  getInitialCriteriaPosterUrl,
  refreshAllFacilities,
  refreshAllInnovations,
  refreshSharedIdeas,
  refreshTeacherMedia,
  subscribeAllInnovations,
  subscribeAllSubmissions,
  subscribeCriteriaPoster,
  subscribeSharedIdeas,
  subscribeTeacherMedia,
} from '../services/submissionService';
import {
  FullUserProfile,
  getCachedUserProfile,
  refreshAllUserProfiles,
  subscribeAllUserProfiles,
  subscribeFullUserProfile,
} from '../services/userProfileService';
import {
  LoginLogEntry,
  SiteVisitSummary,
  fetchAdminLoginLogsOnce,
  fetchSiteSummaryOnce,
  getLocalLoginLogs,
  getLocalSiteSummary,
  subscribeAllLoginLogs,
  subscribeSiteSummary,
} from '../services/auditService';
import {
  TeacherPrivilegeAdminItem,
  refreshRewardClaims,
  subscribeAllTeachersPrivilegeStatus,
} from '../services/privilegeService';
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
  const [innovations, setInnovations] = useState<InnovationSubmission[]>([]);
  const [teacherMedia, setTeacherMedia] = useState<TeacherMediaWork[]>([]);
  const [facilities, setFacilities] = useState<FacilitySubmission[]>([]);
  const [sharedIdeas, setSharedIdeas] = useState<SharedIdeaItem[]>([]);
  const [userProfilesMap, setUserProfilesMap] = useState<Record<string, FullUserProfile>>({});
  const [siteSummary, setSiteSummary] = useState<SiteVisitSummary | null>(() => getLocalSiteSummary());
  const [loginLogs, setLoginLogs] = useState<LoginLogEntry[]>(() => getLocalLoginLogs());
  const [privilegeSummaries, setPrivilegeSummaries] = useState<TeacherPrivilegeAdminItem[]>([]);
  const [innovationsLoaded, setInnovationsLoaded] = useState<boolean>(false);

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

  // Subscribe once to shared lightweight settings (24h TTL cached)
  useEffect(() => {
    const u1 = subscribeSchoolLogo(setSchoolLogoUrl);
    const u2 = subscribeCertificateLogo(setCertificateLogoUrl);
    const u3 = subscribeCriteriaPoster(setCriteriaPosterUrl);
    const u4 = subscribePopupBanner((cfg) => {
      if (cfg) setPopupBannerConfig(cfg);
    });
    return () => {
      u1();
      u2();
      u3();
      u4();
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

  const ensureInnovationsLoaded = useCallback(() => {
    if (activeStreamsRef.current.innovations) return;
    activeStreamsRef.current.innovations = true;
    const unsub = subscribeAllInnovations((list) => {
      setInnovations(list);
      setInnovationsLoaded(true);
    });
    unsubsRef.current.push(unsub);
  }, []);

  const ensureTeacherMediaLoaded = useCallback(() => {
    if (activeStreamsRef.current.media) return;
    activeStreamsRef.current.media = true;
    const unsub = subscribeTeacherMedia((works) => {
      setTeacherMedia(works);
    });
    unsubsRef.current.push(unsub);
  }, []);

  const ensureFacilitiesLoaded = useCallback(() => {
    if (activeStreamsRef.current.facilities) return;
    activeStreamsRef.current.facilities = true;
    const unsub = subscribeAllSubmissions((list) => {
      setFacilities(list);
    });
    unsubsRef.current.push(unsub);
  }, []);

  const ensureSharedIdeasLoaded = useCallback(() => {
    if (activeStreamsRef.current.ideas) return;
    activeStreamsRef.current.ideas = true;
    const unsub = subscribeSharedIdeas((ideas) => {
      setSharedIdeas(ideas);
    });
    unsubsRef.current.push(unsub);
  }, []);

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
    const fetched = await fetchAdminLoginLogsOnce(false, 30, callerEmail || userEmail || undefined);
    if (Array.isArray(fetched) && fetched.length > 0) {
      setLoginLogs(fetched);
    }
    return fetched;
  }, [userEmail]);

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
  }, [ensureInnovationsLoaded, ensureTeacherMediaLoaded]);

  const ensureAdminDashboardLoaded = useCallback(() => {
    ensureInnovationsLoaded();
    ensureFacilitiesLoaded();
    ensureTeacherMediaLoaded();
    ensureUserProfilesLoaded();
    ensurePrivilegeSummariesLoaded();
    ensureSiteSummaryLoaded();
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
  ]);

  const syncInnovations = useCallback(async () => {
    const list = await refreshAllInnovations(true);
    setInnovations(list);
    setInnovationsLoaded(true);
    return list;
  }, []);

  const syncTeacherMedia = useCallback(async () => {
    const works = await refreshTeacherMedia(true);
    setTeacherMedia(works);
    return works;
  }, []);

  const syncFacilities = useCallback(async () => {
    const list = await refreshAllFacilities(true);
    setFacilities(list);
    return list;
  }, []);

  const syncSharedIdeas = useCallback(async () => {
    const ideas = await refreshSharedIdeas(true);
    setSharedIdeas(ideas);
    return ideas;
  }, []);

  const syncProfileStats = useCallback(async () => {
    const [innovsRes, mediaRes, summaryRes] = await Promise.allSettled([
      refreshAllInnovations(true),
      refreshTeacherMedia(true),
      fetchSiteSummaryOnce(true),
    ]);
    if (innovsRes.status === 'fulfilled' && Array.isArray(innovsRes.value)) {
      setInnovations(innovsRes.value);
      setInnovationsLoaded(true);
    }
    if (mediaRes.status === 'fulfilled' && Array.isArray(mediaRes.value)) {
      setTeacherMedia(mediaRes.value);
    }
    if (summaryRes.status === 'fulfilled' && summaryRes.value) {
      setSiteSummary(summaryRes.value);
    }
  }, []);

  const syncLoginLogsAndSummary = useCallback(
    async (callerEmail?: string) => {
      const [siteRes, logsRes] = await Promise.allSettled([
        fetchSiteSummaryOnce(true),
        fetchAdminLoginLogsOnce(true, 30, callerEmail || userEmail || undefined),
      ]);
      const nextSummary = siteRes.status === 'fulfilled' ? siteRes.value : null;
      const nextLogs = logsRes.status === 'fulfilled' && Array.isArray(logsRes.value) ? logsRes.value : [];
      if (nextSummary) setSiteSummary(nextSummary);
      if (nextLogs.length > 0) setLoginLogs(nextLogs);
      return { siteSummary: nextSummary, loginLogs: nextLogs };
    },
    [userEmail]
  );

  const syncAllAdminData = useCallback(
    async (callerEmail?: string) => {
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
        fetchAdminLoginLogsOnce(true, 30, effectiveEmail),
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
        setSiteSummary(siteRes.value);
      }
      if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value) && logsRes.value.length > 0) {
        setLoginLogs(logsRes.value);
      }
      void claimsRes;
    },
    [userEmail]
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
