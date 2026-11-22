import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  limit,
} from 'firebase/firestore';
import {
  db,
  isQuotaExceededError,
  notifyQuotaExceeded,
  waitForAuthReady,
  isAuthReady,
  safeLocalStorageSetItem,
} from '../firebase';
import {
  ADMIN_TARGET_EMAIL,
  isValidActiveMediaRecord,
  extractMediaEmails,
  subscribeSharedIdeas,
  subscribeAllInnovations,
  subscribeAllSubmissions,
  subscribeTeacherMedia,
  addSharedIdeaToLocalCache,
  SharedIdeaItem,
} from './submissionService';
import {
  getCleanRealName,
  getDeletedUserEmails,
  subscribeAllUserProfiles,
  FullUserProfile,
} from './userProfileService';

export const TARGET_SHARE_COUNT = 20;
export const PICKUP_LOCATION = 'ห้องพักครู Com ชั้น 3 (ม.วีระพงษ์)';
export const ADMIN_CONTACT_NAME = 'ม.วีระพงษ์ มีทรัพย์';

export interface RewardItemConfig {
  id: string;
  rank: number;
  title: string;
  shortName: string;
  icon: string;
  description: string;
  colorGradient: string;
  badgeBg: string;
}

export const REWARD_ITEMS: RewardItemConfig[] = [
  {
    id: 'doll',
    rank: 1,
    title: 'รางวัลที่ 1: ตุ๊กตา',
    shortName: 'ตุ๊กตา',
    icon: '🧸',
    description: 'ตุ๊กตาสุดน่ารักตัวใหญ่ ขนนุ่ม คุณภาพพรีเมียมลิขสิทธิ์พิเศษสำหรับคุณครู ACU',
    colorGradient: 'from-pink-500 via-rose-500 to-red-500',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
  },
  {
    id: 'snack',
    rank: 2,
    title: 'รางวัลที่ 2: ขนม',
    shortName: 'ขนม',
    icon: '🍪',
    description: 'ชุดเซ็ตขนมเบเกอรี่และของว่างแสนอร่อย คัดสรรเป็นพิเศษเพื่อเพิ่มพลังในการสอน',
    colorGradient: 'from-amber-500 via-orange-500 to-amber-600',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  },
  {
    id: 'candy',
    rank: 3,
    title: 'รางวัลที่ 3: ลูกอม',
    shortName: 'ลูกอม',
    icon: '🍬',
    description: 'ชุดลูกอมรสผลไม้นานาชนิดและของหวานเติมความสดชื่นตลอดชั่วโมงการเรียนการสอน',
    colorGradient: 'from-purple-500 via-indigo-500 to-sky-500',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
  },
];

export interface SharedPostItem {
  id: string;
  title: string;
  source: 'idea' | 'innovation' | 'facility' | 'media';
  sourceLabel: string;
  category?: string;
  url?: string;
  createdAt: string;
}

export interface RewardClaimRecord {
  id: string;
  userEmail: string;
  teacherName: string;
  subjectGroup?: string;
  totalShares: number;
  isEligible: boolean;
  claimStatus: 'not_eligible' | 'eligible' | 'pending_pickup' | 'received';
  selectedReward: string; // 'ตุ๊กตา' | 'ขนม' | 'ลูกอม' | ''
  receivedReward?: string;
  receivedAt?: string | null;
  pickupLocation: string;
  administeredBy: string;
  adminNote?: string;
  requestedAt?: string;
  updatedAt: string;
}

export interface UserPrivilegeStatus {
  userEmail: string;
  teacherName: string;
  totalShares: number;
  targetCount: number;
  remainingToTarget: number;
  isEligible: boolean;
  progressPercent: number;
  claimStatus: 'not_eligible' | 'eligible' | 'pending_pickup' | 'received';
  claimRecord: RewardClaimRecord | null;
  posts: SharedPostItem[];
  pickupLocation: string;
  contactPerson: string;
}

export interface TeacherPrivilegeAdminItem {
  email: string;
  name: string;
  role?: string;
  department?: string;
  totalShares: number;
  isEligible: boolean;
  progressPercent: number;
  claimStatus: 'not_eligible' | 'eligible' | 'pending_pickup' | 'received';
  selectedReward: string;
  receivedReward: string;
  receivedAt: string | null;
  pickupLocation: string;
  adminNote: string;
  updatedAt: string;
  posts: SharedPostItem[];
}

const CLAIMS_COLLECTION = 'reward_privilege_claims';
const CLAIMS_STORAGE_KEY = 'acu_cached_reward_claims';
const CLAIMS_FETCHED_AT_KEY = 'acu_cached_reward_claims_fetched_at';
const SINGLE_CLAIM_FETCHED_AT_KEY = 'acu_single_claim_fetched_at_map';
const CLAIMS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours TTL
const CLAIMS_COOLDOWN_MS = 60 * 1000; // 60 seconds manual refresh cooldown

let sessionClaimsListFetched = false;
let lastClaimsFetchedAt = 0;
let lastManualClaimsRefreshAt = 0;
let isFetchingClaimsList = false;
let inFlightClaimsListFetch: Promise<Record<string, RewardClaimRecord>> | null = null;
const sessionSingleClaimFetched = new Set<string>();
const inFlightSingleClaimFetches = new Map<string, Promise<RewardClaimRecord | null>>();

export function getRewardClaimsCooldownSeconds(): number {
  if (!lastManualClaimsRefreshAt) return 0;
  const remaining = CLAIMS_COOLDOWN_MS - (Date.now() - lastManualClaimsRefreshAt);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

function getSingleClaimFetchedAt(normEmail: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(SINGLE_CLAIM_FETCHED_AT_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const ts = Number(parsed[normEmail] || 0);
      return Number.isFinite(ts) ? ts : 0;
    }
  } catch {}
  return 0;
}

function setSingleClaimFetchedAt(normEmail: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(SINGLE_CLAIM_FETCHED_AT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const map = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    map[normEmail] = Date.now();
    safeLocalStorageSetItem(SINGLE_CLAIM_FETCHED_AT_KEY, JSON.stringify(map));
  } catch {}
}

function notifyRewardClaimsChanged(): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_reward_claims_changed'));
    }
  } catch {}
}

function getStoredRewardClaimsMap(): Record<string, RewardClaimRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CLAIMS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const deletedUsers = getDeletedUserEmails();
        const cleaned: Record<string, RewardClaimRecord> = {};
        Object.keys(parsed).forEach((k) => {
          const norm = k.trim().toLowerCase();
          if (norm && !deletedUsers.has(norm) && parsed[k]) {
            cleaned[norm] = parsed[k];
          }
        });
        if (Object.keys(cleaned).length === 0) {
          try {
            localStorage.removeItem(CLAIMS_STORAGE_KEY);
          } catch {}
        }
        return cleaned;
      }
      try {
        localStorage.removeItem(CLAIMS_STORAGE_KEY);
      } catch {}
    }
  } catch (err) {
    console.warn('Failed to read reward claims cache (clearing corrupted entry):', err);
    try {
      localStorage.removeItem(CLAIMS_STORAGE_KEY);
    } catch {}
  }
  return {};
}

function saveStoredRewardClaimsMap(
  map: Record<string, RewardClaimRecord>,
  updateFetchedAt = false
): void {
  if (typeof window === 'undefined') return;
  try {
    if (Object.keys(map).length === 0) {
      try {
        localStorage.removeItem(CLAIMS_STORAGE_KEY);
        localStorage.removeItem(CLAIMS_FETCHED_AT_KEY);
      } catch {}
      return;
    }
    const ok = safeLocalStorageSetItem(CLAIMS_STORAGE_KEY, JSON.stringify(map));
    if (ok && updateFetchedAt) {
      safeLocalStorageSetItem(CLAIMS_FETCHED_AT_KEY, String(Date.now()));
    }
  } catch (err) {
    console.warn('Failed to save reward claims cache (quota safe fallback):', err);
  }
}

function upsertStoredRewardClaim(normEmail: string, claim: RewardClaimRecord | null): void {
  const current = getStoredRewardClaimsMap();
  if (claim) {
    current[normEmail] = claim;
  } else {
    delete current[normEmail];
  }
  saveStoredRewardClaimsMap(current);
  setSingleClaimFetchedAt(normEmail);
  notifyRewardClaimsChanged();
}

async function fetchSingleClaimOnce(
  normEmail: string,
  forceRefresh = false
): Promise<RewardClaimRecord | null> {
  const cachedMap = getStoredRewardClaimsMap();
  const cachedClaim = cachedMap[normEmail] || null;
  const cachedAt = getSingleClaimFetchedAt(normEmail);
  const isSingleFresh =
    sessionSingleClaimFetched.has(normEmail) ||
    (cachedAt > 0 && Date.now() - cachedAt < CLAIMS_CACHE_TTL_MS);

  if (!forceRefresh && isSingleFresh) {
    return cachedClaim;
  }

  const existingPromise = inFlightSingleClaimFetches.get(normEmail);
  if (!forceRefresh && existingPromise) {
    return existingPromise;
  }

  const run = (async () => {
    try {
      const docRef = doc(db, CLAIMS_COLLECTION, getClaimDocId(normEmail));
      const snap = await getDoc(docRef);
      sessionSingleClaimFetched.add(normEmail);
      setSingleClaimFetchedAt(normEmail);
      const claim = snap.exists() ? (snap.data() as RewardClaimRecord) : null;
      const latestMap = getStoredRewardClaimsMap();
      if (claim) {
        latestMap[normEmail] = claim;
      } else {
        delete latestMap[normEmail];
      }
      saveStoredRewardClaimsMap(latestMap);
      return claim;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      return cachedClaim;
    } finally {
      inFlightSingleClaimFetches.delete(normEmail);
    }
  })();

  inFlightSingleClaimFetches.set(normEmail, run);
  return run;
}

let lastEmptyClaimsServerCheckAt = 0;

/**
 * One-time getDocs fetch for reward_privilege_claims (12-hour TTL, 60s manual cooldown, explicit mutex)
 */
export async function refreshRewardClaims(
  forceRefresh = false
): Promise<Record<string, RewardClaimRecord>> {
  const localFallback = getStoredRewardClaimsMap();
  const storedAt =
    lastClaimsFetchedAt ||
    (typeof window !== 'undefined' ? Number(localStorage.getItem(CLAIMS_FETCHED_AT_KEY) || 0) : 0);
  const isFresh =
    Object.keys(localFallback).length > 0 &&
    (sessionClaimsListFetched || (storedAt > 0 && Date.now() - storedAt < CLAIMS_CACHE_TTL_MS));

  if (!forceRefresh && isFresh) {
    return localFallback;
  }

  if (
    !forceRefresh &&
    lastEmptyClaimsServerCheckAt > 0 &&
    Date.now() - lastEmptyClaimsServerCheckAt < 30000
  ) {
    return localFallback;
  }

  if (forceRefresh && getRewardClaimsCooldownSeconds() > 0) {
    if (inFlightClaimsListFetch) return inFlightClaimsListFetch;
    return localFallback;
  }

  if (inFlightClaimsListFetch) {
    return inFlightClaimsListFetch;
  }

  if (isFetchingClaimsList) {
    return localFallback;
  }

  if (forceRefresh) {
    lastManualClaimsRefreshAt = Date.now();
  }

  isFetchingClaimsList = true;
  inFlightClaimsListFetch = (async () => {
    try {
      await waitForAuthReady();
      const snap = await getDocs(query(collection(db, CLAIMS_COLLECTION), limit(500)));
      if (snap.empty && (snap.metadata?.fromCache || !isAuthReady()) && Object.keys(localFallback).length > 0) {
        return localFallback;
      }
      const deletedUsers = getDeletedUserEmails();
      const map: Record<string, RewardClaimRecord> = {};
      snap.forEach((d) => {
        const data = d.data() as RewardClaimRecord;
        if (data?.userEmail) {
          const norm = data.userEmail.trim().toLowerCase();
          if (!deletedUsers.has(norm)) {
            map[norm] = data;
          }
        }
      });
      if (Object.keys(map).length > 0) {
        sessionClaimsListFetched = true;
        lastClaimsFetchedAt = Date.now();
        lastEmptyClaimsServerCheckAt = 0;
        saveStoredRewardClaimsMap(map, true);
        notifyRewardClaimsChanged();
        return map;
      }

      if (!snap.metadata?.fromCache) {
        lastEmptyClaimsServerCheckAt = Date.now();
      }
      return localFallback;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      } else {
        console.warn('refreshRewardClaims error (using fallback cache):', err);
      }
      return localFallback;
    } finally {
      isFetchingClaimsList = false;
      inFlightClaimsListFetch = null;
    }
  })();

  return inFlightClaimsListFetch;
}

/**
 * Get safe document id for user email
 */
export function getClaimDocId(email: string): string {
  return `claim_${encodeURIComponent(email.trim().toLowerCase())}`;
}

/**
 * Subscribe to a single user's privilege status using shared smart-cached streams (zero onSnapshot listeners)
 */
export function subscribeUserPrivilegeStatus(
  userEmail: string,
  onUpdate: (status: UserPrivilegeStatus) => void
): () => void {
  if (!userEmail) {
    onUpdate({
      userEmail: '',
      teacherName: '',
      totalShares: 0,
      targetCount: TARGET_SHARE_COUNT,
      remainingToTarget: TARGET_SHARE_COUNT,
      isEligible: false,
      progressPercent: 0,
      claimStatus: 'not_eligible',
      claimRecord: null,
      posts: [],
      pickupLocation: PICKUP_LOCATION,
      contactPerson: ADMIN_CONTACT_NAME,
    });
    return () => {};
  }

  const normEmail = userEmail.trim().toLowerCase();
  let isActive = true;

  let ideasList: SharedPostItem[] = [];
  let innovationsList: SharedPostItem[] = [];
  let facilitiesList: SharedPostItem[] = [];
  let mediaList: SharedPostItem[] = [];
  let claimData: RewardClaimRecord | null = getStoredRewardClaimsMap()[normEmail] || null;
  let teacherDisplayName = userEmail.split('@')[0];

  const computeAndEmit = () => {
    if (!isActive) return;
    // Combine all shared posts
    const allPostsMap = new Map<string, SharedPostItem>();
    [...ideasList, ...innovationsList, ...facilitiesList, ...mediaList].forEach((p) => {
      allPostsMap.set(p.id, p);
    });
    const combinedPosts = Array.from(allPostsMap.values());
    combinedPosts.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const totalShares = combinedPosts.length;
    const isEligible = totalShares >= TARGET_SHARE_COUNT;
    const remainingToTarget = Math.max(0, TARGET_SHARE_COUNT - totalShares);
    const progressPercent = Math.min(100, Math.round((totalShares / TARGET_SHARE_COUNT) * 100));

    let claimStatus: 'not_eligible' | 'eligible' | 'pending_pickup' | 'received' = 'not_eligible';
    if (claimData?.claimStatus === 'received') {
      claimStatus = 'received';
    } else if (claimData?.claimStatus === 'pending_pickup') {
      claimStatus = 'pending_pickup';
    } else if (isEligible) {
      claimStatus = 'eligible';
    }

    onUpdate({
      userEmail: normEmail,
      teacherName: claimData?.teacherName || teacherDisplayName,
      totalShares,
      targetCount: TARGET_SHARE_COUNT,
      remainingToTarget,
      isEligible,
      progressPercent,
      claimStatus,
      claimRecord: claimData,
      posts: combinedPosts,
      pickupLocation: PICKUP_LOCATION,
      contactPerson: ADMIN_CONTACT_NAME,
    });
  };

  // 1. Shared ideas (smart-cached stream, 0 extra reads)
  const unsubIdeas = subscribeSharedIdeas((allIdeas) => {
    ideasList = allIdeas
      .filter((data) => (data.creatorEmail || '').trim().toLowerCase() === normEmail)
      .map((data) => ({
        id: data.id,
        title: data.title || 'แชร์แหล่งการเรียนรู้/ไอเดีย',
        source: 'idea' as const,
        sourceLabel: 'คลังไอเดีย/แหล่งเรียนรู้',
        category: data.categoryLabel || data.category || 'แหล่งการเรียนรู้',
        url: data.url || '',
        createdAt: data.createdAt || new Date().toISOString(),
      }));
    computeAndEmit();
  });

  // 2. Innovation submissions (smart-cached stream, 0 extra reads)
  const unsubInnovations = subscribeAllInnovations((allInnovations) => {
    innovationsList = [];
    allInnovations.forEach((data) => {
      if (!isValidActiveMediaRecord(data)) return;
      if (!extractMediaEmails(data).includes(normEmail)) return;
      if (data.teacherName) teacherDisplayName = data.teacherName;
      innovationsList.push({
        id: data.id,
        title: data.mediaTitle
          ? `สื่อนวัตกรรม ชิ้นที่ ${data.itemNumber || 1}: ${data.mediaTitle}`
          : 'สื่อนวัตกรรมการจัดการเรียนรู้',
        source: 'innovation',
        sourceLabel: 'สื่อนวัตกรรมการสอน 5 ชิ้น',
        category: data.mediaType || data.gradeLevel || 'สื่อนวัตกรรม',
        url: data.onlineUrl || '',
        createdAt: data.submittedAt || new Date().toISOString(),
      });
    });
    computeAndEmit();
  });

  // 3. Facility usage records (smart-cached stream, 0 extra reads)
  const unsubFacilities = subscribeAllSubmissions((allFacilities) => {
    facilitiesList = [];
    allFacilities.forEach((data) => {
      if (data.learningCenter && (data.userEmail || '').trim().toLowerCase() === normEmail) {
        if (data.teacherName) teacherDisplayName = data.teacherName;
        facilitiesList.push({
          id: data.id,
          title: `บันทึกการใช้ ${data.learningCenter}`,
          source: 'facility',
          sourceLabel: 'แหล่งเรียนรู้ 33 แห่ง',
          category: data.subjectGroup || 'แหล่งเรียนรู้ในโรงเรียน',
          createdAt: data.createdAt || data.usageDateTime || new Date().toISOString(),
        });
      }
    });
    computeAndEmit();
  });

  // 4. Teacher media repository (smart-cached stream, 0 extra reads)
  const unsubMedia = subscribeTeacherMedia((allMedia) => {
    mediaList = [];
    allMedia.forEach((data) => {
      if (!isValidActiveMediaRecord(data)) return;
      if (!extractMediaEmails(data).includes(normEmail)) return;
      mediaList.push({
        id: data.id,
        title: data.title,
        source: 'media',
        sourceLabel: 'คลังสื่อผลิตเอง',
        category: data.subjectGroup || data.mediaType || 'คลังสื่อ',
        url: data.onlineUrl || '',
        createdAt: data.createdAt || new Date().toISOString(),
      });
    });
    computeAndEmit();
  });

  // 5. Reward claim doc (one-time getDoc cached per session + local change events)
  const handleClaimsChanged = () => {
    claimData = getStoredRewardClaimsMap()[normEmail] || null;
    computeAndEmit();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('acu_reward_claims_changed', handleClaimsChanged);
  }

  fetchSingleClaimOnce(normEmail, false)
    .then((fetched) => {
      if (!isActive) return;
      claimData = fetched;
      computeAndEmit();
    })
    .catch(() => {});

  return () => {
    isActive = false;
    unsubIdeas();
    unsubInnovations();
    unsubFacilities();
    unsubMedia();
    if (typeof window !== 'undefined') {
      window.removeEventListener('acu_reward_claims_changed', handleClaimsChanged);
    }
  };
}

/**
 * Submit or update teacher claim for a reward (e.g. Doll, Snack, Candy)
 */
export async function submitTeacherRewardClaim(data: {
  userEmail: string;
  teacherName: string;
  selectedReward: string; // 'ตุ๊กตา' | 'ขนม' | 'ลูกอม'
  totalShares: number;
  note?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const normEmail = data.userEmail.trim().toLowerCase();
    const docId = getClaimDocId(normEmail);
    const docRef = doc(db, CLAIMS_COLLECTION, docId);
    const nowIso = new Date().toISOString();

    const existingSnap = await getDoc(docRef);
    const prevData = existingSnap.exists() ? (existingSnap.data() as RewardClaimRecord) : null;

    const payload: RewardClaimRecord = {
      id: docId,
      userEmail: normEmail,
      teacherName: data.teacherName.trim() || normEmail,
      totalShares: data.totalShares,
      isEligible: data.totalShares >= TARGET_SHARE_COUNT,
      claimStatus: prevData?.claimStatus === 'received' ? 'received' : 'pending_pickup',
      selectedReward: data.selectedReward,
      receivedReward: prevData?.receivedReward || '',
      receivedAt: prevData?.receivedAt || null,
      pickupLocation: PICKUP_LOCATION,
      administeredBy: ADMIN_CONTACT_NAME,
      adminNote: data.note ? data.note.trim() : prevData?.adminNote || '',
      requestedAt: prevData?.requestedAt || nowIso,
      updatedAt: nowIso,
    };

    await setDoc(docRef, payload, { merge: true });
    upsertStoredRewardClaim(normEmail, payload);
    return { success: true };
  } catch (err: any) {
    console.error('Error submitting reward claim:', err);
    return { success: false, error: err?.message || 'ส่งคำขอรับรางวัลไม่สำเร็จ' };
  }
}

/**
 * Admin updates the reward claim record (Mark as handed over, change prize, update notes)
 */
export async function adminUpdateRewardClaim(data: {
  userEmail: string;
  teacherName?: string;
  claimStatus: 'eligible' | 'pending_pickup' | 'received' | 'not_eligible';
  receivedReward?: string; // '1. ตุ๊กตา' | '2. ขนม' | '3. ลูกอม'
  adminNote?: string;
  administeredBy?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const normEmail = data.userEmail.trim().toLowerCase();
    const docId = getClaimDocId(normEmail);
    const docRef = doc(db, CLAIMS_COLLECTION, docId);
    const nowIso = new Date().toISOString();

    const prevCached = getStoredRewardClaimsMap()[normEmail] || null;
    const updatePayload: Partial<RewardClaimRecord> = {
      id: docId,
      userEmail: normEmail,
      claimStatus: data.claimStatus,
      updatedAt: nowIso,
      pickupLocation: PICKUP_LOCATION,
      administeredBy: data.administeredBy || ADMIN_CONTACT_NAME,
    };

    if (data.teacherName) {
      updatePayload.teacherName = data.teacherName;
    }

    if (data.receivedReward !== undefined) {
      updatePayload.receivedReward = data.receivedReward;
    }

    if (data.claimStatus === 'received') {
      updatePayload.receivedAt = nowIso;
    } else if (data.receivedReward === '') {
      updatePayload.receivedAt = null;
    }

    if (data.adminNote !== undefined) {
      updatePayload.adminNote = data.adminNote;
    }

    await setDoc(docRef, updatePayload, { merge: true });
    const mergedRecord: RewardClaimRecord = {
      ...(prevCached || {
        id: docId,
        userEmail: normEmail,
        teacherName: data.teacherName || normEmail,
        totalShares: 0,
        isEligible: data.claimStatus !== 'not_eligible',
        claimStatus: data.claimStatus,
        selectedReward: '',
        pickupLocation: PICKUP_LOCATION,
        administeredBy: ADMIN_CONTACT_NAME,
        updatedAt: nowIso,
      }),
      ...updatePayload,
    } as RewardClaimRecord;
    upsertStoredRewardClaim(normEmail, mergedRecord);
    return { success: true };
  } catch (err: any) {
    console.error('Error updating reward claim by admin:', err);
    return { success: false, error: err?.message || 'บันทึกการมอบรางวัลไม่สำเร็จ' };
  }
}

/**
 * Quick share educational resource to Shared Ideas (increases post count immediately)
 */
export async function quickShareEducationalResource(data: {
  title: string;
  description: string;
  url?: string;
  category: string;
  userEmail: string;
  teacherName: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const id = `idea_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const docRef = doc(db, 'shared_ideas', id);

    const payload: SharedIdeaItem = {
      id,
      title: data.title.trim(),
      description: data.description.trim() || 'แชร์แหล่งการเรียนรู้เพื่อการพัฒนาคุณภาพการศึกษาและสิทธิพิเศษคลังสื่อ',
      category: 'resource_share',
      categoryLabel: data.category || 'แหล่งการเรียนรู้/สื่อนวัตกรรม',
      url: data.url?.trim() || '',
      tags: ['สิทธิพิเศษคลังสื่อ', 'แชร์แหล่งเรียนรู้', '20โพสต์รับรางวัล'],
      creatorEmail: data.userEmail.trim().toLowerCase(),
      creatorName: data.teacherName.trim() || data.userEmail,
      createdAt: nowIso,
      ratingAvg: 5.0,
      ratingCount: 1,
      userRatings: {
        [data.userEmail.replace(/[^a-zA-Z0-9]/g, '_')]: 5,
      },
    };

    addSharedIdeaToLocalCache(payload);
    await setDoc(docRef, payload);
    return { success: true, id };
  } catch (err: any) {
    console.error('Failed to quick share educational resource:', err);
    return { success: false, error: err?.message || 'แชร์แหล่งการเรียนรู้ไม่สำเร็จ' };
  }
}

/**
 * Subscribe to ALL teachers' privilege and rewards status for the Admin Dashboard
 * Reuses smart-cached streams (zero onSnapshot listeners)
 */
export function subscribeAllTeachersPrivilegeStatus(
  onUpdate: (summaries: TeacherPrivilegeAdminItem[]) => void,
  options?: { autoFetch?: boolean; skipFetch?: boolean }
): () => void {
  let isActive = true;
  let allIdeas: { creatorEmail: string; post: SharedPostItem }[] = [];
  let allInnovations: { userEmail: string; teacherName?: string; gradeLevel?: string; post: SharedPostItem }[] = [];
  let allFacilities: { userEmail: string; teacherName?: string; subjectGroup?: string; post: SharedPostItem }[] = [];
  let allMedia: { submittedByEmail: string; post: SharedPostItem }[] = [];
  let claimsMap: Record<string, RewardClaimRecord> = getStoredRewardClaimsMap();
  let profilesMap: Record<string, FullUserProfile> = {};

  const computeAll = () => {
    if (!isActive) return;
    // Gather all teacher emails
    const allEmails = new Set<string>();
    allIdeas.forEach((i) => i.creatorEmail && allEmails.add(i.creatorEmail));
    allInnovations.forEach((i) => i.userEmail && allEmails.add(i.userEmail));
    allFacilities.forEach((f) => f.userEmail && allEmails.add(f.userEmail));
    allMedia.forEach((m) => m.submittedByEmail && allEmails.add(m.submittedByEmail));
    Object.keys(claimsMap).forEach((e) => allEmails.add(e));
    Object.keys(profilesMap).forEach((e) => allEmails.add(e));

    const resultList: TeacherPrivilegeAdminItem[] = [];

    allEmails.forEach((rawEmail) => {
      const email = rawEmail.trim().toLowerCase();
      if (!email) return;

      // Collect teacher posts
      const posts: SharedPostItem[] = [];
      allIdeas.filter((i) => i.creatorEmail === email).forEach((i) => posts.push(i.post));
      allInnovations.filter((i) => i.userEmail === email).forEach((i) => posts.push(i.post));
      allFacilities.filter((f) => f.userEmail === email).forEach((f) => posts.push(f.post));
      allMedia.filter((m) => m.submittedByEmail === email).forEach((m) => posts.push(m.post));

      // Deduplicate posts by ID
      const uniquePostsMap = new Map<string, SharedPostItem>();
      posts.forEach((p) => uniquePostsMap.set(p.id, p));
      const uniquePosts = Array.from(uniquePostsMap.values());
      uniquePosts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      const totalShares = uniquePosts.length;
      const isEligible = totalShares >= TARGET_SHARE_COUNT;
      const progressPercent = Math.min(100, Math.round((totalShares / TARGET_SHARE_COUNT) * 100));

      const claim = claimsMap[email];
      const profile = profilesMap[email];

      // Discover best teacher name
      const innovMatch = allInnovations.find((i) => i.userEmail === email && i.teacherName);
      const facMatch = allFacilities.find((f) => f.userEmail === email && f.teacherName);
      const rawName = claim?.teacherName || profile?.fullName || innovMatch?.teacherName || facMatch?.teacherName || profile?.displayName || email.split('@')[0];
      const name = getCleanRealName(rawName, email);

      // Department or subject
      const department = profile?.school || innovMatch?.gradeLevel || facMatch?.subjectGroup || 'โรงเรียนอัสสัมชัญอุบลราชธานี';

      let claimStatus: 'not_eligible' | 'eligible' | 'pending_pickup' | 'received' = 'not_eligible';
      if (claim?.claimStatus === 'received') {
        claimStatus = 'received';
      } else if (claim?.claimStatus === 'pending_pickup') {
        claimStatus = 'pending_pickup';
      } else if (isEligible) {
        claimStatus = 'eligible';
      }

      resultList.push({
        email,
        name,
        role: profile?.role || 'ครูผู้สอน',
        department,
        totalShares,
        isEligible,
        progressPercent,
        claimStatus,
        selectedReward: claim?.selectedReward || '',
        receivedReward: claim?.receivedReward || (claimStatus === 'received' ? 'มอบรางวัลเรียบร้อย' : ''),
        receivedAt: claim?.receivedAt || null,
        pickupLocation: PICKUP_LOCATION,
        adminNote: claim?.adminNote || '',
        updatedAt: claim?.updatedAt || new Date().toISOString(),
        posts: uniquePosts,
      });
    });

    // Sort: received/pending_pickup first, then eligible (>= 20), then by total shares descending
    resultList.sort((a, b) => {
      const score = (item: TeacherPrivilegeAdminItem) => {
        if (item.claimStatus === 'received') return 4;
        if (item.claimStatus === 'pending_pickup') return 3;
        if (item.isEligible) return 2;
        return 1;
      };
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return b.totalShares - a.totalShares;
    });

    onUpdate(resultList);
  };

  const shouldAutoFetch = Boolean(options?.autoFetch) && !options?.skipFetch;

  // 1. Shared ideas (reuses smart-cached stream)
  const unsubIdeas = subscribeSharedIdeas((ideas) => {
    allIdeas = [];
    ideas.forEach((data) => {
      if (data.creatorEmail) {
        allIdeas.push({
          creatorEmail: data.creatorEmail.trim().toLowerCase(),
          post: {
            id: data.id,
            title: data.title || 'แชร์แหล่งการเรียนรู้/ไอเดีย',
            source: 'idea',
            sourceLabel: 'คลังไอเดีย/แหล่งเรียนรู้',
            category: data.categoryLabel || data.category || 'แหล่งการเรียนรู้',
            url: data.url || '',
            createdAt: data.createdAt || new Date().toISOString(),
          },
        });
      }
    });
    computeAll();
  }, { autoFetch: shouldAutoFetch });

  // 2. Innovations (reuses smart-cached stream)
  const unsubInnov = subscribeAllInnovations((innovations) => {
    allInnovations = [];
    innovations.forEach((data) => {
      if (!isValidActiveMediaRecord(data)) return;
      const ownerEmail = extractMediaEmails(data)[0] || '';
      if (ownerEmail) {
        allInnovations.push({
          userEmail: ownerEmail,
          teacherName: data.teacherName,
          gradeLevel: data.gradeLevel,
          post: {
            id: data.id,
            title: data.mediaTitle ? `สื่อนวัตกรรม ชิ้นที่ ${data.itemNumber || 1}: ${data.mediaTitle}` : 'สื่อนวัตกรรมการจัดการเรียนรู้',
            source: 'innovation',
            sourceLabel: 'สื่อนวัตกรรมการสอน 5 ชิ้น',
            category: data.mediaType || data.gradeLevel || 'สื่อนวัตกรรม',
            url: data.onlineUrl || '',
            createdAt: data.submittedAt || new Date().toISOString(),
          },
        });
      }
    });
    computeAll();
  }, { autoFetch: shouldAutoFetch });

  // 3. Facilities (reuses smart-cached stream)
  const unsubFac = subscribeAllSubmissions((facilities) => {
    allFacilities = [];
    facilities.forEach((data) => {
      if (data.userEmail && data.learningCenter) {
        allFacilities.push({
          userEmail: data.userEmail.trim().toLowerCase(),
          teacherName: data.teacherName,
          subjectGroup: data.subjectGroup,
          post: {
            id: data.id,
            title: `บันทึกการใช้ ${data.learningCenter}`,
            source: 'facility',
            sourceLabel: 'แหล่งเรียนรู้ 33 แห่ง',
            category: data.subjectGroup || 'แหล่งเรียนรู้ในโรงเรียน',
            createdAt: data.createdAt || data.usageDateTime || new Date().toISOString(),
          },
        });
      }
    });
    computeAll();
  }, { autoFetch: shouldAutoFetch });

  // 4. Teacher Media Repository (reuses smart-cached stream)
  const unsubMedia = subscribeTeacherMedia((works) => {
    allMedia = [];
    works.forEach((data) => {
      if (!isValidActiveMediaRecord(data)) return;
      const ownerEmail = extractMediaEmails(data)[0] || '';
      if (ownerEmail) {
        allMedia.push({
          submittedByEmail: ownerEmail,
          post: {
            id: data.id,
            title: data.title || 'คลังสื่อผลิตเอง',
            source: 'media',
            sourceLabel: 'คลังสื่อผลิตเอง',
            category: data.subjectGroup || data.mediaType || 'คลังสื่อ',
            url: data.onlineUrl || '',
            createdAt: data.createdAt || new Date().toISOString(),
          },
        });
      }
    });
    computeAll();
  }, { autoFetch: shouldAutoFetch });

  // 5. User profiles (reuses smart-cached stream)
  const unsubProfiles = subscribeAllUserProfiles((map) => {
    profilesMap = map;
    computeAll();
  }, { autoFetch: shouldAutoFetch });

  // 6. Reward claims (cached one-time getDocs per 12h + local change events)
  const handleClaimsChanged = () => {
    claimsMap = getStoredRewardClaimsMap();
    computeAll();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('acu_reward_claims_changed', handleClaimsChanged);
    window.addEventListener('acu_user_deleted', handleClaimsChanged);
  }

  if (shouldAutoFetch) {
    refreshRewardClaims(false)
      .then((map) => {
        if (!isActive) return;
        claimsMap = map;
        computeAll();
      })
      .catch(() => {});
  }

  return () => {
    isActive = false;
    unsubIdeas();
    unsubInnov();
    unsubFac();
    unsubMedia();
    unsubProfiles();
    if (typeof window !== 'undefined') {
      window.removeEventListener('acu_reward_claims_changed', handleClaimsChanged);
      window.removeEventListener('acu_user_deleted', handleClaimsChanged);
    }
  };
}

/**
 * Generate CSV formatted for Excel / Google Sheets with UTF-8 BOM
 */
export function generatePrivilegesCSV(summaries: TeacherPrivilegeAdminItem[]): string {
  const escapeCSV = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const headers = [
    'ลำดับ',
    'ชื่อ-สกุลจริง (ครูผู้สอน)',
    'อีเมลผู้ใช้งาน',
    'สังกัด/กลุ่มสาระ/โรงเรียน',
    'จำนวนครั้งที่โพสต์แชร์แหล่งเรียนรู้',
    'เป้าหมายตามเกณฑ์ (ครั้ง)',
    'สถานะคุณสมบัติ',
    'สถานะการรับรางวัล',
    'ของรางวัลที่เลือก',
    'ของรางวัลที่ได้รับมอบ',
    'วันเวลาที่รับมอบรางวัล',
    'สถานที่ติดต่อรับรางวัล',
    'ผู้มอบรางวัล',
    'หมายเหตุ Admin',
  ];

  const rows = summaries.map((s, idx) => {
    let statusLabel = 'กำลังสะสมผลงาน';
    if (s.claimStatus === 'received') statusLabel = 'รับมอบรางวัลเรียบร้อยแล้ว';
    else if (s.claimStatus === 'pending_pickup') statusLabel = 'ยื่นขอรับรางวัลแล้ว (รอติดต่อรับ)';
    else if (s.isEligible) statusLabel = 'ผ่านเกณฑ์ครบ 20 ครั้งแล้ว (มีสิทธิ์รับรางวัล)';

    return [
      escapeCSV(idx + 1),
      escapeCSV(s.name),
      escapeCSV(s.email),
      escapeCSV(s.department),
      escapeCSV(s.totalShares),
      escapeCSV(TARGET_SHARE_COUNT),
      escapeCSV(s.isEligible ? 'ผ่านเกณฑ์ (>= 20 ครั้ง)' : `สะสม ${s.totalShares}/${TARGET_SHARE_COUNT} ครั้ง`),
      escapeCSV(statusLabel),
      escapeCSV(s.selectedReward || '-'),
      escapeCSV(s.receivedReward || '-'),
      escapeCSV(s.receivedAt ? new Date(s.receivedAt).toLocaleString('th-TH') : '-'),
      escapeCSV(s.pickupLocation),
      escapeCSV(ADMIN_CONTACT_NAME),
      escapeCSV(s.adminNote || '-'),
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Generate TSV for direct copy-paste into Google Sheets
 */
export function generatePrivilegesTSV(summaries: TeacherPrivilegeAdminItem[]): string {
  const clean = (val: any) => String(val ?? '').replace(/[\t\r\n]/g, ' ').trim();
  const headers = [
    'ลำดับ',
    'ชื่อ-สกุลจริง',
    'อีเมล',
    'สังกัด/กลุ่มสาระ',
    'จำนวนโพสต์แชร์ (ครั้ง)',
    'สถานะเกณฑ์ 20 ครั้ง',
    'สถานะรางวัล',
    'รางวัลที่เลือก',
    'รางวัลที่ได้รับมอบ',
    'วันที่รับมอบ',
    'สถานที่รับมอบ',
    'ผู้มอบ',
    'หมายเหตุ',
  ];

  const rows = summaries.map((s, idx) => {
    let statusLabel = 'กำลังสะสม';
    if (s.claimStatus === 'received') statusLabel = 'รับมอบรางวัลแล้ว';
    else if (s.claimStatus === 'pending_pickup') statusLabel = 'ยื่นขอรับแล้ว (รอรับ)';
    else if (s.isEligible) statusLabel = 'ผ่านเกณฑ์แล้ว (มีสิทธิ์)';

    return [
      idx + 1,
      clean(s.name),
      clean(s.email),
      clean(s.department),
      s.totalShares,
      s.isEligible ? 'ผ่านเกณฑ์ (>= 20)' : `${s.totalShares}/${TARGET_SHARE_COUNT}`,
      statusLabel,
      clean(s.selectedReward || '-'),
      clean(s.receivedReward || '-'),
      s.receivedAt ? new Date(s.receivedAt).toLocaleDateString('th-TH') : '-',
      clean(s.pickupLocation),
      ADMIN_CONTACT_NAME,
      clean(s.adminNote || '-'),
    ].join('\t');
  });

  return [headers.join('\t'), ...rows].join('\n');
}
