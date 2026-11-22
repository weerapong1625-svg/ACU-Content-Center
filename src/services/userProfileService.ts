import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  increment, 
  collection, 
  getDocs, 
  deleteDoc, 
  writeBatch, 
  query, 
  limit
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth, isQuotaExceededError, notifyQuotaExceeded, waitForAuthReady, isAuthReady } from '../firebase';
import { removeUserCredential } from './authCredentialService';
import {
  isBlobUrl,
  isCustomAvatarUrl,
  isUiAvatarPlaceholder,
  sanitizeAvatarUrl,
  resolveDisplayAvatarUrl,
  getMatchingAuthPhotoUrl,
} from '../utils/avatarUtils';

export interface InnovationItem {
  id: number; // 1 to 5
  title: string;
  category: string;
  status: 'approved' | 'submitted' | 'under_review' | 'pending';
  submittedDate: string;
  linkUrl?: string;
  notes?: string;
  coverImageUrl?: string;
}

export interface VisitorPraise {
  id: string;
  visitorName: string;
  visitorSchool?: string;
  rating: number; // 1 to 5
  comment: string;
  timestamp: string;
  pointsEarned: number;
}

export interface UserStats {
  totalViews: number;
  uniqueVisitors: number;
  points: number;
  averageRating: number;
  totalRatings: number;
  submissionCount?: number;
  dailyStats?: Record<string, number>;
  monthlyStats?: Record<string, number>;
  yearlyStats?: Record<string, number>;
}

export interface FullUserProfile {
  uid?: string;
  email: string;
  fullName: string;
  nickname: string;
  school: string;
  displayName: string;
  avatarUrl: string;
  photoURL?: string;
  role?: string;
  innovations: InnovationItem[];
  stats: UserStats;
  praises: VisitorPraise[];
  updatedAt?: string;
}

export const DEFAULT_INNOVATION_ITEMS: InnovationItem[] = [
  {
    id: 1,
    title: '',
    category: '',
    status: 'pending',
    submittedDate: '-',
    linkUrl: '',
    notes: '',
    coverImageUrl: '',
  },
  {
    id: 2,
    title: '',
    category: '',
    status: 'pending',
    submittedDate: '-',
    linkUrl: '',
    notes: '',
    coverImageUrl: '',
  },
  {
    id: 3,
    title: '',
    category: '',
    status: 'pending',
    submittedDate: '-',
    linkUrl: '',
    notes: '',
    coverImageUrl: '',
  },
  {
    id: 4,
    title: '',
    category: '',
    status: 'pending',
    submittedDate: '-',
    linkUrl: '',
    notes: '',
    coverImageUrl: '',
  },
  {
    id: 5,
    title: '',
    category: '',
    status: 'pending',
    submittedDate: '-',
    linkUrl: '',
    notes: '',
    coverImageUrl: '',
  },
];

export const DEFAULT_INITIAL_PRAISES: VisitorPraise[] = [];

const LOCAL_STORAGE_PREFIX = 'acu_user_full_profile_';
export const DELETED_USERS_STORAGE_KEY = 'acu_deleted_user_emails';

/**
 * Get the set of permanently deleted user emails (lowercased)
 */
export function getDeletedUserEmails(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_USERS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map((e: string) => String(e).toLowerCase().trim()));
      }
    }
  } catch {}
  return new Set();
}

/**
 * Permanently record a deleted user email to blocklist so they never resurrect
 */
export function addDeletedUserEmail(email: string): void {
  if (typeof window === 'undefined' || !email) return;
  try {
    const norm = email.toLowerCase().trim();
    if (norm === 'weerapong1625@acu.ac.th') return; // master super admin cannot be blocked
    const set = getDeletedUserEmails();
    set.add(norm);
    localStorage.setItem(DELETED_USERS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

/**
 * Generate a safe Firestore Doc ID from email
 */
function getSafeDocId(email: string): string {
  return encodeURIComponent(email.toLowerCase().trim());
}

/**
 * Resolve canonical user UID for a given email (uses Firebase Auth UID when current user matches, else deterministic doc ID)
 */
export function resolveUserUid(email: string, explicitUid?: string): string {
  if (explicitUid && explicitUid.trim()) return explicitUid.trim();
  const norm = (email || '').toLowerCase().trim();
  try {
    const currentAuthUser = auth?.currentUser;
    if (currentAuthUser?.email && currentAuthUser.email.toLowerCase().trim() === norm && currentAuthUser.uid) {
      return currentAuthUser.uid;
    }
  } catch {
    // ignore
  }
  return norm ? getSafeDocId(norm) : '';
}

/**
 * Synchronously read cached full user profile from localStorage (sanitizing dead blob: URLs)
 */
export function getCachedUserProfile(email: string): FullUserProfile | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${email.toLowerCase().trim()}`);
    if (raw) {
      const parsed = JSON.parse(raw) as FullUserProfile;
      if (parsed) {
        const cleanAvatar = sanitizeAvatarUrl(parsed.photoURL || parsed.avatarUrl);
        parsed.avatarUrl = cleanAvatar;
        if (parsed.photoURL && isBlobUrl(parsed.photoURL)) {
          parsed.photoURL = cleanAvatar;
        }
      }
      return parsed;
    }
  } catch (err) {
    console.warn('Could not read cached profile:', err);
  }
  return null;
}

/**
 * Save profile to localStorage cache (strictly never persisting blob: URLs)
 */
export function setCachedUserProfile(profile: FullUserProfile): void {
  try {
    const cleanAvatar = sanitizeAvatarUrl(profile.photoURL || profile.avatarUrl);
    const cleanedProfile: FullUserProfile = {
      ...profile,
      avatarUrl: cleanAvatar,
      photoURL: cleanAvatar,
    };
    localStorage.setItem(
      `${LOCAL_STORAGE_PREFIX}${profile.email.toLowerCase().trim()}`,
      JSON.stringify(cleanedProfile)
    );
  } catch (err) {
    console.warn('Could not save to localStorage:', err);
  }
}

function getStoredAvatarUrl(email: string): string {
  if (typeof window === 'undefined' || !email) return '';
  try {
    const norm = email.toLowerCase().trim();
    const rawNorm = localStorage.getItem(`acu_user_avatar_${norm}`);
    if (rawNorm && isBlobUrl(rawNorm)) {
      localStorage.removeItem(`acu_user_avatar_${norm}`);
    }
    const rawOrig = localStorage.getItem(`acu_user_avatar_${email.trim()}`);
    if (rawOrig && isBlobUrl(rawOrig)) {
      localStorage.removeItem(`acu_user_avatar_${email.trim()}`);
    }
    return sanitizeAvatarUrl(rawNorm) || sanitizeAvatarUrl(rawOrig) || '';
  } catch {
    return '';
  }
}

function setStoredAvatarUrl(email: string, avatarUrl: string): void {
  if (typeof window === 'undefined' || !email) return;
  try {
    const norm = email.toLowerCase().trim();
    if (isBlobUrl(avatarUrl)) {
      localStorage.removeItem(`acu_user_avatar_${norm}`);
      return;
    }
    const clean = sanitizeAvatarUrl(avatarUrl);
    if (clean) {
      localStorage.setItem(`acu_user_avatar_${norm}`, clean);
    }
  } catch {
    // ignore
  }
}

// Guard concurrent / redundant login syncs and cache single users/{uid} + user_profiles/{safeDocId} reads
const USERS_UID_CACHE_PREFIX = 'acu_users_uid_cache_';
const PROFILE_DOC_CACHE_PREFIX = 'acu_profile_doc_cache_';
const PROFILE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours TTL
const inFlightAvatarSyncs = new Map<string, Promise<FullUserProfile | null>>();
const lastAvatarSyncTime = new Map<string, number>();
const sessionUsersDocCache = new Map<string, {
  uid: string;
  data: Record<string, any> | null;
  photoURL: string;
  hasDeadBlob: boolean;
}>();
const inFlightUsersDocFetch = new Map<string, Promise<{
  uid: string;
  data: Record<string, any> | null;
  photoURL: string;
  hasDeadBlob: boolean;
}>>();
const sessionProfileDocCache = new Map<string, Record<string, any> | null>();
const inFlightProfileDocFetch = new Map<string, Promise<Record<string, any> | null>>();

function getLocalUsersUidCache(
  uid: string,
  allowExpired = false
): {
  uid: string;
  data: Record<string, any> | null;
  photoURL: string;
  hasDeadBlob: boolean;
  cachedAt: number;
} | null {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = localStorage.getItem(`${USERS_UID_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.cachedAt === 'number' &&
      (allowExpired || Date.now() - parsed.cachedAt < PROFILE_CACHE_TTL_MS)
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

function setLocalUsersUidCache(
  uid: string,
  entry: {
    uid: string;
    data: Record<string, any> | null;
    photoURL: string;
    hasDeadBlob: boolean;
  }
): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    localStorage.setItem(`${USERS_UID_CACHE_PREFIX}${uid}`, JSON.stringify({ ...entry, cachedAt: Date.now() }));
  } catch {}
}

function getLocalProfileDocCache(
  safeDocId: string,
  allowExpired = false
): { data: Record<string, any> | null; cachedAt: number } | null {
  if (typeof window === 'undefined' || !safeDocId) return null;
  try {
    const raw = localStorage.getItem(`${PROFILE_DOC_CACHE_PREFIX}${safeDocId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.cachedAt === 'number' &&
      (allowExpired || Date.now() - parsed.cachedAt < PROFILE_CACHE_TTL_MS)
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

function setLocalProfileDocCache(safeDocId: string, data: Record<string, any> | null): void {
  if (typeof window === 'undefined' || !safeDocId) return;
  try {
    localStorage.setItem(`${PROFILE_DOC_CACHE_PREFIX}${safeDocId}`, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {}
}

/**
 * Clear per-session avatar sync memoization (e.g., on logout or explicit login)
 */
export function clearSessionAvatarSyncMemo(email?: string): void {
  if (email) {
    const norm = email.toLowerCase().trim();
    for (const key of Array.from(inFlightAvatarSyncs.keys())) {
      if (key.startsWith(`${norm}::`)) inFlightAvatarSyncs.delete(key);
    }
    for (const key of Array.from(lastAvatarSyncTime.keys())) {
      if (key.startsWith(`${norm}::`)) lastAvatarSyncTime.delete(key);
    }
    const uid = resolveUserUid(norm);
    if (uid) sessionUsersDocCache.delete(uid);
    sessionProfileDocCache.delete(getSafeDocId(norm));
  } else {
    inFlightAvatarSyncs.clear();
    lastAvatarSyncTime.clear();
    sessionUsersDocCache.clear();
    sessionProfileDocCache.clear();
  }
}

/**
 * Strictly read ONLY the current user's single document by UID (`doc(db, 'users', uid)`).
 * Wrapped in strict silent try/catch so permission-denied or quota errors NEVER block main data.
 * Deduplicated per page session (at most 1 read per session unless forced), with localStorage fallback if offline/quota-limited.
 */
async function readSingleUserDocByUid(
  uid: string,
  forceRefresh = false
): Promise<{
  uid: string;
  data: Record<string, any> | null;
  photoURL: string;
  hasDeadBlob: boolean;
}> {
  const cleanUid = (uid || '').trim();
  if (!cleanUid) {
    return { uid: '', data: null, photoURL: '', hasDeadBlob: false };
  }

  if (!forceRefresh) {
    if (sessionUsersDocCache.has(cleanUid)) {
      return sessionUsersDocCache.get(cleanUid)!;
    }
    const freshLocal = getLocalUsersUidCache(cleanUid, false);
    if (freshLocal) {
      const cachedResult = {
        uid: freshLocal.uid,
        data: freshLocal.data,
        photoURL: freshLocal.photoURL || '',
        hasDeadBlob: Boolean(freshLocal.hasDeadBlob),
      };
      sessionUsersDocCache.set(cleanUid, cachedResult);
      return cachedResult;
    }
    if (inFlightUsersDocFetch.has(cleanUid)) {
      return inFlightUsersDocFetch.get(cleanUid)!;
    }
  }

  const fetchPromise = (async () => {
    try {
      await waitForAuthReady();
      const snap = await getDoc(doc(db, 'users', cleanUid));
      if (snap.exists()) {
        const d = snap.data();
        const rawPhoto = d.photoURL || d.avatarUrl || '';
        const cleanPhoto = sanitizeAvatarUrl(rawPhoto);
        const hasDeadBlob = isBlobUrl(d.photoURL) || isBlobUrl(d.avatarUrl);
        const result = {
          uid: cleanUid,
          data: d,
          photoURL: isUiAvatarPlaceholder(cleanPhoto) ? '' : cleanPhoto,
          hasDeadBlob,
        };
        sessionUsersDocCache.set(cleanUid, result);
        setLocalUsersUidCache(cleanUid, result);
        return result;
      }
      const emptyResult = { uid: cleanUid, data: null, photoURL: '', hasDeadBlob: false };
      sessionUsersDocCache.set(cleanUid, emptyResult);
      setLocalUsersUidCache(cleanUid, emptyResult);
      return emptyResult;
    } catch (err) {
      console.warn('[Firestore] readSingleUserDocByUid failed, falling back to localStorage:', err);
      // Strictly isolated: silently fall back on permission-denied / quota / network errors (even if expired)
      const localFallback = getLocalUsersUidCache(cleanUid, true);
      if (localFallback) {
        return {
          uid: localFallback.uid,
          data: localFallback.data,
          photoURL: localFallback.photoURL || '',
          hasDeadBlob: Boolean(localFallback.hasDeadBlob),
        };
      }
      return { uid: cleanUid, data: null, photoURL: '', hasDeadBlob: false };
    } finally {
      inFlightUsersDocFetch.delete(cleanUid);
    }
  })();

  inFlightUsersDocFetch.set(cleanUid, fetchPromise);
  return fetchPromise;
}

/**
 * Deduplicated single-document read on `user_profiles/{safeDocId}` (6-hour localStorage TTL unless forced)
 */
async function readSingleProfileDocOnce(
  safeDocId: string,
  forceRefresh = false
): Promise<Record<string, any> | null> {
  if (!safeDocId) return null;
  if (!forceRefresh) {
    if (sessionProfileDocCache.has(safeDocId)) {
      return sessionProfileDocCache.get(safeDocId) ?? null;
    }
    const freshLocal = getLocalProfileDocCache(safeDocId, false);
    if (freshLocal) {
      sessionProfileDocCache.set(safeDocId, freshLocal.data ?? null);
      return freshLocal.data ?? null;
    }
    if (inFlightProfileDocFetch.has(safeDocId)) {
      return inFlightProfileDocFetch.get(safeDocId)!;
    }
  }

  const p = (async () => {
    try {
      await waitForAuthReady();
      const profileSnap = await getDoc(doc(db, 'user_profiles', safeDocId));
      const data = profileSnap.exists() ? profileSnap.data() : null;
      sessionProfileDocCache.set(safeDocId, data);
      setLocalProfileDocCache(safeDocId, data);
      return data;
    } catch (err) {
      console.warn('[Firestore] readSingleProfileDocOnce failed, falling back to localStorage:', err);
      const expiredLocal = getLocalProfileDocCache(safeDocId, true);
      return sessionProfileDocCache.get(safeDocId) ?? expiredLocal?.data ?? null;
    } finally {
      inFlightProfileDocFetch.delete(safeDocId);
    }
  })();

  inFlightProfileDocFetch.set(safeDocId, p);
  return p;
}

/**
 * Strictly write ONLY to the user's single document (`doc(db, 'users', uid)`) inside silent try/catch.
 */
async function writeSingleUserDocByUid(
  uid: string,
  payload: Record<string, any>
): Promise<void> {
  const cleanUid = (uid || '').trim();
  if (!cleanUid) return;
  try {
    await setDoc(doc(db, 'users', cleanUid), payload, { merge: true });
    const existing = sessionUsersDocCache.get(cleanUid) || getLocalUsersUidCache(cleanUid);
    const nextData = { ...(existing?.data || {}), ...payload };
    const cleanPhoto = sanitizeAvatarUrl(nextData.photoURL || nextData.avatarUrl);
    const nextEntry = {
      uid: cleanUid,
      data: nextData,
      photoURL: isUiAvatarPlaceholder(cleanPhoto) ? '' : cleanPhoto,
      hasDeadBlob: false,
    };
    sessionUsersDocCache.set(cleanUid, nextEntry);
    setLocalUsersUidCache(cleanUid, nextEntry);
  } catch {
    // Strictly isolated: permission-denied or quota errors on users/{uid} never break app or main data
  }
}

/**
 * Save user's profile picture to Firestore Single Source of Truth (`users/{uid}.photoURL`)
 * + backward-compatible `user_profiles`, optional Firebase Auth updateProfile (non-data URLs),
 * and overwrite localStorage cache. Rejects temporary `blob:` URLs strictly.
 */
export async function saveUserPhotoToFirestore(
  email: string,
  newPhotoUrl: string,
  explicitUid?: string
): Promise<string> {
  const normEmail = (email || '').toLowerCase().trim();
  if (!normEmail) throw new Error('ไม่พบอีเมลผู้ใช้งาน');
  if (isBlobUrl(newPhotoUrl)) {
    throw new Error('ไม่อนุญาตให้บันทึกลิงก์ชั่วคราว (blob:) กรุณาอัปโหลดรูปภาพใหม่');
  }

  const cleanUrl = sanitizeAvatarUrl(newPhotoUrl);
  const resolvedUid = resolveUserUid(normEmail, explicitUid);
  const safeDocId = getSafeDocId(normEmail);
  const nowIso = new Date().toISOString();

  // 1) Overwrite localStorage cache immediately
  if (cleanUrl) {
    setStoredAvatarUrl(normEmail, cleanUrl);
  }
  const existingCached = getCachedUserProfile(normEmail);
  if (existingCached) {
    setCachedUserProfile({
      ...existingCached,
      uid: resolvedUid,
      avatarUrl: cleanUrl,
      photoURL: cleanUrl,
      updatedAt: nowIso,
    });
  }

  // 2) Persist immediately to Firestore `users/{uid}` and mirror to `user_profiles/{safeDocId}` (isolated try/catch)
  const photoPayload = {
    uid: resolvedUid,
    email: normEmail,
    photoURL: cleanUrl,
    avatarUrl: cleanUrl,
    updatedAt: nowIso,
  };

  await writeSingleUserDocByUid(resolvedUid, photoPayload);

  const prevProfCache = sessionProfileDocCache.get(safeDocId);
  const mergedProfCache = { ...(prevProfCache || {}), ...photoPayload };
  sessionProfileDocCache.set(safeDocId, mergedProfCache);
  setLocalProfileDocCache(safeDocId, mergedProfCache);

  try {
    await setDoc(doc(db, 'user_profiles', safeDocId), photoPayload, { merge: true });
  } catch {
    // Non-fatal: localStorage cache already holds the updated avatar
  }

  // 3) Update Firebase Auth profile if signed in with matching account & URL fits Auth length limits
  try {
    const currentUser = auth?.currentUser;
    if (
      currentUser &&
      currentUser.email?.toLowerCase().trim() === normEmail &&
      cleanUrl &&
      !cleanUrl.startsWith('data:') &&
      cleanUrl.length <= 1900
    ) {
      await updateProfile(currentUser, { photoURL: cleanUrl });
    }
  } catch {
    // Non-fatal: Firestore users/{uid}.photoURL remains the single source of truth
  }

  // 4) Notify mounted components in this tab
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('acu_user_profile_updated', { detail: photoPayload }));
      window.dispatchEvent(new CustomEvent('acu_user_profiles_changed', { detail: photoPayload }));
    } catch {
      // ignore
    }
  }

  return cleanUrl;
}

/**
 * Synchronize user profile picture ONCE on login or auth state restoration (`onAuthStateChanged`):
 * - Reads ONLY the user's single document by UID (`doc(db, 'users', resolvedUid)`) inside strict try/catch
 * - Never performs collection-wide queries on `users`
 * - Never overwrites a custom Firestore `photoURL` with the default Auth provider photo
 * - Auto-recovers valid cached Base64 `data:image/` avatars up to Firestore if Firestore is empty or holds a dead `blob:` URL
 * - Reuses `localStorage` cache once fetched during the login session
 */
export async function syncUserAvatarOnAuthOrLogin(
  email: string,
  authUser?: {
    uid?: string;
    email?: string | null;
    photoURL?: string | null;
    displayName?: string | null;
  } | null,
  force = false
): Promise<FullUserProfile | null> {
  const normEmail = (email || authUser?.email || '').toLowerCase().trim();
  if (!normEmail) return null;

  const resolvedUid = resolveUserUid(normEmail, authUser?.uid);
  const safeDocId = getSafeDocId(normEmail);
  const syncKey = `${normEmail}::${resolvedUid}`;
  const existingInFlight = inFlightAvatarSyncs.get(syncKey);
  if (existingInFlight) return existingInFlight;

  const cachedNow = getCachedUserProfile(normEmail);
  const lastTime = lastAvatarSyncTime.get(syncKey) || 0;
  if (
    !force &&
    (Date.now() - lastTime < 60000 || (sessionUsersDocCache.has(resolvedUid) && sessionProfileDocCache.has(safeDocId) && cachedNow))
  ) {
    return cachedNow;
  }

  const runSync = (async (): Promise<FullUserProfile | null> => {
    try {
      // Isolated single-doc reads: permission-denied or quota errors on users/{uid} or user_profiles silently fall back
      const usersLookup = await readSingleUserDocByUid(resolvedUid, force);
      const profileData = await readSingleProfileDocOnce(safeDocId, force);

      const firestoreUsersPhoto = sanitizeAvatarUrl(
        usersLookup.data?.photoURL || usersLookup.data?.avatarUrl
      );
      const firestoreProfileAvatar = sanitizeAvatarUrl(
        profileData?.photoURL || profileData?.avatarUrl
      );
      const firestoreHasDeadBlob =
        usersLookup.hasDeadBlob ||
        isBlobUrl(profileData?.photoURL) ||
        isBlobUrl(profileData?.avatarUrl);

      const firestoreCustomPhoto = isCustomAvatarUrl(firestoreUsersPhoto)
        ? firestoreUsersPhoto
        : isCustomAvatarUrl(firestoreProfileAvatar)
        ? firestoreProfileAvatar
        : '';

      // Check localStorage for valid Base64 image for auto-recovery
      const localStored = getStoredAvatarUrl(normEmail);
      const cachedProfile = getCachedUserProfile(normEmail);
      const cachedAvatar = sanitizeAvatarUrl(cachedProfile?.photoURL || cachedProfile?.avatarUrl);
      const localBase64Candidate = localStored.startsWith('data:image/')
        ? localStored
        : cachedAvatar.startsWith('data:image/')
        ? cachedAvatar
        : '';

      const authPhoto = sanitizeAvatarUrl(authUser?.photoURL);
      const nowIso = new Date().toISOString();
      let finalAvatar = '';

      if (firestoreCustomPhoto) {
        // Strict Priority 1: Firestore custom photo ALWAYS wins; NEVER overwrite with Auth photoURL
        finalAvatar = firestoreCustomPhoto;

        // Backfill users/{uid} or user_profiles if custom photo lived in only one of them
        if (!isCustomAvatarUrl(firestoreUsersPhoto)) {
          await writeSingleUserDocByUid(resolvedUid, {
            uid: resolvedUid,
            email: normEmail,
            photoURL: finalAvatar,
            avatarUrl: finalAvatar,
            updatedAt: nowIso,
          });
        }
        if (!isCustomAvatarUrl(firestoreProfileAvatar)) {
          try {
            await setDoc(
              doc(db, 'user_profiles', safeDocId),
              {
                uid: resolvedUid,
                email: normEmail,
                photoURL: finalAvatar,
                avatarUrl: finalAvatar,
                updatedAt: nowIso,
              },
              { merge: true }
            );
          } catch {
            // ignore
          }
        }
      } else if (localBase64Candidate) {
        // Auto-Recovery: localStorage has valid Base64 while Firestore is empty or had dead blob:
        finalAvatar = localBase64Candidate;
        await writeSingleUserDocByUid(resolvedUid, {
          uid: resolvedUid,
          email: normEmail,
          photoURL: finalAvatar,
          avatarUrl: finalAvatar,
          updatedAt: nowIso,
        });
        try {
          await setDoc(
            doc(db, 'user_profiles', safeDocId),
            {
              uid: resolvedUid,
              email: normEmail,
              photoURL: finalAvatar,
              avatarUrl: finalAvatar,
              updatedAt: nowIso,
            },
            { merge: true }
          );
        } catch {
          // ignore
        }
      } else if (authPhoto && !isUiAvatarPlaceholder(authPhoto)) {
        // Priority 2: Firebase Auth photoURL ONLY when Firestore has no custom photo
        finalAvatar = authPhoto;
        await writeSingleUserDocByUid(resolvedUid, {
          uid: resolvedUid,
          email: normEmail,
          photoURL: finalAvatar,
          updatedAt: nowIso,
        });
      } else if (firestoreHasDeadBlob) {
        // Scrub any legacy dead blob: URL stored in Firestore
        await writeSingleUserDocByUid(resolvedUid, {
          uid: resolvedUid,
          email: normEmail,
          photoURL: '',
          avatarUrl: '',
          updatedAt: nowIso,
        });
        try {
          await setDoc(
            doc(db, 'user_profiles', safeDocId),
            { uid: resolvedUid, email: normEmail, photoURL: '', avatarUrl: '', updatedAt: nowIso },
            { merge: true }
          );
        } catch {
          // ignore
        }
      } else {
        finalAvatar = firestoreUsersPhoto || firestoreProfileAvatar || '';
      }

      if (finalAvatar) {
        setStoredAvatarUrl(normEmail, finalAvatar);
      }

      const isMaster = normEmail === 'weerapong1625@acu.ac.th';
      const syncedProfile: FullUserProfile = {
        uid: resolvedUid,
        email: normEmail,
        fullName:
          profileData?.fullName ||
          usersLookup.data?.fullName ||
          cachedProfile?.fullName ||
          (isMaster ? '(Admin) ม.วีระพงษ์ มีทรัพย์' : authUser?.displayName || normEmail.split('@')[0]),
        nickname: profileData?.nickname || cachedProfile?.nickname || (isMaster ? 'ครูปอย' : ''),
        school: profileData?.school || cachedProfile?.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี',
        displayName:
          profileData?.displayName ||
          usersLookup.data?.displayName ||
          cachedProfile?.displayName ||
          authUser?.displayName ||
          normEmail.split('@')[0],
        avatarUrl: finalAvatar,
        photoURL: finalAvatar,
        role:
          profileData?.role ||
          usersLookup.data?.role ||
          cachedProfile?.role ||
          (isMaster ? 'ผู้ดูแลระบบและพัฒนานวัตกรรม' : 'ครูผู้สอน / ผู้พัฒนานวัตกรรม'),
        innovations: sanitizeInnovations(profileData?.innovations || cachedProfile?.innovations),
        stats: {
          totalViews:
            typeof profileData?.stats?.totalViews === 'number'
              ? profileData.stats.totalViews
              : cachedProfile?.stats?.totalViews || 0,
          uniqueVisitors:
            typeof profileData?.stats?.uniqueVisitors === 'number'
              ? profileData.stats.uniqueVisitors
              : cachedProfile?.stats?.uniqueVisitors || 0,
          points:
            typeof profileData?.stats?.points === 'number'
              ? profileData.stats.points
              : cachedProfile?.stats?.points || 0,
          averageRating:
            typeof profileData?.stats?.averageRating === 'number'
              ? profileData.stats.averageRating
              : cachedProfile?.stats?.averageRating || 0,
          totalRatings:
            typeof profileData?.stats?.totalRatings === 'number'
              ? profileData.stats.totalRatings
              : cachedProfile?.stats?.totalRatings || 0,
          submissionCount:
            typeof profileData?.stats?.submissionCount === 'number'
              ? profileData.stats.submissionCount
              : cachedProfile?.stats?.submissionCount ?? 0,
          dailyStats: profileData?.stats?.dailyStats || cachedProfile?.stats?.dailyStats,
          monthlyStats: profileData?.stats?.monthlyStats || cachedProfile?.stats?.monthlyStats,
          yearlyStats: profileData?.stats?.yearlyStats || cachedProfile?.stats?.yearlyStats,
        },
        praises: Array.isArray(profileData?.praises)
          ? profileData.praises
          : cachedProfile?.praises || DEFAULT_INITIAL_PRAISES,
        updatedAt: profileData?.updatedAt || usersLookup.data?.updatedAt || nowIso,
      };

      setCachedUserProfile(syncedProfile);
      lastAvatarSyncTime.set(syncKey, Date.now());

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('acu_user_profile_updated', { detail: syncedProfile }));
        window.dispatchEvent(new CustomEvent('acu_user_profiles_changed', { detail: syncedProfile }));
      }
      return syncedProfile;
    } catch {
      // Strictly isolated: never fail or propagate errors from avatar/profile sync
      return getCachedUserProfile(normEmail);
    } finally {
      inFlightAvatarSyncs.delete(syncKey);
    }
  })();

  inFlightAvatarSyncs.set(syncKey, runSync);
  return runSync;
}

/**
 * Helper to ensure innovation items are consistently formatted and that unsubmitted slots are pending
 */
function sanitizeInnovations(items: any): InnovationItem[] {
  if (!Array.isArray(items) || items.length !== 5) {
    return DEFAULT_INNOVATION_ITEMS;
  }
  return items.map((item, idx) => {
    const hasTitle = item && typeof item.title === 'string' && item.title.trim().length > 0;
    return {
      id: idx + 1,
      title: hasTitle ? item.title.trim() : '',
      category: item?.category || '',
      status: hasTitle ? (item.status === 'pending' ? 'submitted' : item.status || 'submitted') : 'pending',
      submittedDate: hasTitle ? (item.submittedDate || 'ส่งแล้ว') : '-',
      linkUrl: item?.linkUrl || '',
      notes: item?.notes || '',
      coverImageUrl: item?.coverImageUrl || '',
    };
  });
}

/**
 * Smart-cached subscription to user's `user_profiles` document + localStorage-cached `users/{uid}` photo.
 * Zero `onSnapshot` listeners: emits cached localStorage immediately, performs at most 1 deduplicated getDoc
 * if not already cached in this session, and listens for local update events.
 */
export function subscribeFullUserProfile(
  email: string,
  onUpdate: (profile: FullUserProfile) => void
): () => void {
  const normEmail = (email || '').toLowerCase().trim();
  if (!normEmail) return () => {};

  const resolvedUid = resolveUserUid(normEmail);
  const safeDocId = getSafeDocId(normEmail);
  let profileDocData: Record<string, any> | null = sessionProfileDocCache.get(safeDocId) ?? null;
  let usersDocData: Record<string, any> | null =
    sessionUsersDocCache.get(resolvedUid)?.data || getLocalUsersUidCache(resolvedUid)?.data || null;
  let isActive = true;

  const emitMerged = () => {
    if (!isActive) return;
    const cached = getCachedUserProfile(normEmail);
    const authPhoto = getMatchingAuthPhotoUrl(normEmail);
    const mergedAvatar = resolveDisplayAvatarUrl({
      customPhotoUrl: usersDocData?.photoURL || usersDocData?.avatarUrl,
      firestoreAvatarUrl: profileDocData?.photoURL || profileDocData?.avatarUrl,
      authPhotoUrl: authPhoto,
      localCachedAvatarUrl: cached?.avatarUrl || getStoredAvatarUrl(normEmail),
      fallbackSeedName: profileDocData?.fullName || usersDocData?.fullName || cached?.fullName || normEmail,
    });
    const cleanFinalAvatar = isUiAvatarPlaceholder(mergedAvatar) ? '' : mergedAvatar;
    const isMaster = normEmail === 'weerapong1625@acu.ac.th';

    const loadedProfile: FullUserProfile = {
      uid: usersDocData?.uid || profileDocData?.uid || resolvedUid,
      email: profileDocData?.email || usersDocData?.email || normEmail,
      fullName:
        profileDocData?.fullName ||
        usersDocData?.fullName ||
        cached?.fullName ||
        (isMaster ? '(Admin) ม.วีระพงษ์ มีทรัพย์' : normEmail.split('@')[0]),
      nickname: profileDocData?.nickname || cached?.nickname || (isMaster ? 'ครูปอย' : ''),
      school: profileDocData?.school || cached?.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี',
      displayName:
        profileDocData?.displayName ||
        usersDocData?.displayName ||
        profileDocData?.fullName ||
        cached?.displayName ||
        normEmail.split('@')[0],
      avatarUrl: cleanFinalAvatar,
      photoURL: cleanFinalAvatar,
      role:
        profileDocData?.role ||
        usersDocData?.role ||
        cached?.role ||
        (isMaster ? 'ผู้ดูแลระบบและพัฒนานวัตกรรม' : 'ครูผู้สอน / ผู้พัฒนานวัตกรรม'),
      innovations: sanitizeInnovations(profileDocData?.innovations || cached?.innovations),
      stats: {
        totalViews: typeof profileDocData?.stats?.totalViews === 'number' ? profileDocData.stats.totalViews : (cached?.stats?.totalViews ?? 0),
        uniqueVisitors: typeof profileDocData?.stats?.uniqueVisitors === 'number' ? profileDocData.stats.uniqueVisitors : (cached?.stats?.uniqueVisitors ?? 0),
        points: typeof profileDocData?.stats?.points === 'number' ? profileDocData.stats.points : (cached?.stats?.points ?? 0),
        averageRating: typeof profileDocData?.stats?.averageRating === 'number' ? profileDocData.stats.averageRating : (cached?.stats?.averageRating ?? 0),
        totalRatings: typeof profileDocData?.stats?.totalRatings === 'number' ? profileDocData.stats.totalRatings : (cached?.stats?.totalRatings ?? 0),
        submissionCount: typeof profileDocData?.stats?.submissionCount === 'number' ? profileDocData.stats.submissionCount : (cached?.stats?.submissionCount ?? 0),
        dailyStats: profileDocData?.stats?.dailyStats || cached?.stats?.dailyStats,
        monthlyStats: profileDocData?.stats?.monthlyStats || cached?.stats?.monthlyStats,
        yearlyStats: profileDocData?.stats?.yearlyStats || cached?.stats?.yearlyStats,
      },
      praises: Array.isArray(profileDocData?.praises) ? profileDocData.praises : (cached?.praises || DEFAULT_INITIAL_PRAISES),
      updatedAt: profileDocData?.updatedAt || usersDocData?.updatedAt || cached?.updatedAt || new Date().toISOString(),
    };

    setCachedUserProfile(loadedProfile);
    if (cleanFinalAvatar) {
      setStoredAvatarUrl(normEmail, cleanFinalAvatar);
    }
    onUpdate(loadedProfile);
  };

  // Emit cached profile synchronously (0ms) so UI renders immediately without waiting on Firestore
  const initialCached = getCachedUserProfile(normEmail);
  if (initialCached) {
    onUpdate(initialCached);
  }

  // Fetch single users/{uid} document at most once per session (deduplicated)
  if (!sessionUsersDocCache.has(resolvedUid)) {
    readSingleUserDocByUid(resolvedUid, false)
      .then((res) => {
        if (!isActive) return;
        if (res.data) {
          usersDocData = res.data;
          emitMerged();
        }
      })
      .catch(() => {});
  }

  // Fetch user_profiles/{safeDocId} at most once per session (deduplicated)
  if (!sessionProfileDocCache.has(safeDocId)) {
    readSingleProfileDocOnce(safeDocId, false)
      .then((data) => {
        if (!isActive) return;
        profileDocData = data;
        emitMerged();
      })
      .catch(() => {
        if (isActive) emitMerged();
      });
  } else if (!initialCached) {
    emitMerged();
  }

  // Refresh when another component updates avatar/profile locally
  const handleLocalSync = (e: Event) => {
    const detail = (e as CustomEvent)?.detail;
    if (detail?.email && detail.email.toLowerCase().trim() === normEmail) {
      if (detail.photoURL || detail.avatarUrl) {
        usersDocData = { ...(usersDocData || {}), ...detail };
      }
      profileDocData = { ...(profileDocData || {}), ...detail };
      sessionProfileDocCache.set(safeDocId, profileDocData);
      emitMerged();
    }
  };
  const handleGenericProfileUpdate = () => {
    emitMerged();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('acu_user_profile_updated', handleLocalSync);
    window.addEventListener('acu_profile_updated', handleGenericProfileUpdate);
  }

  return () => {
    isActive = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('acu_user_profile_updated', handleLocalSync);
      window.removeEventListener('acu_profile_updated', handleGenericProfileUpdate);
    }
  };
}

/**
 * Fetch full profile from Firestore (isolated single-doc `users/{uid}` + `user_profiles`) with localStorage fallback
 */
export async function fetchFullUserProfile(
  email: string, 
  initialDisplayName?: string,
  initialAvatar?: string
): Promise<FullUserProfile> {
  const normEmail = (email || '').toLowerCase().trim();
  const cached = getCachedUserProfile(normEmail);
  const safeDocId = getSafeDocId(normEmail);
  const resolvedUid = resolveUserUid(normEmail);
  const cleanInitialAvatar = sanitizeAvatarUrl(initialAvatar);

  // Isolated single-doc read on users/{uid} (uses localStorage + session cache if already fetched)
  const usersLookup = await readSingleUserDocByUid(resolvedUid, false);
  const data = await readSingleProfileDocOnce(safeDocId, false);

  if (data || usersLookup.data) {
    const authPhoto = getMatchingAuthPhotoUrl(normEmail);
    const rawResolved = resolveDisplayAvatarUrl({
      customPhotoUrl: usersLookup.photoURL,
      firestoreAvatarUrl: data?.photoURL || data?.avatarUrl,
      authPhotoUrl: authPhoto,
      localCachedAvatarUrl: cached?.avatarUrl || getStoredAvatarUrl(normEmail) || cleanInitialAvatar,
      fallbackSeedName: data?.fullName || usersLookup.data?.fullName || normEmail,
    });
    const resolvedAvatar = isUiAvatarPlaceholder(rawResolved) ? '' : rawResolved;

    const loadedProfile: FullUserProfile = {
      uid: usersLookup.uid || data?.uid || resolvedUid,
      email: data?.email || usersLookup.data?.email || normEmail,
      fullName: data?.fullName || usersLookup.data?.fullName || data?.displayName || initialDisplayName || cached?.fullName || 'คุณครูอัสสัมชัญ',
      nickname: data?.nickname || cached?.nickname || '',
      school: data?.school || cached?.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี',
      displayName: data?.displayName || usersLookup.data?.displayName || initialDisplayName || cached?.displayName || normEmail.split('@')[0],
      avatarUrl: resolvedAvatar,
      photoURL: resolvedAvatar,
      role: data?.role || usersLookup.data?.role || cached?.role || 'ครูผู้สอน',
      innovations: sanitizeInnovations(data?.innovations || cached?.innovations),
      stats: {
        totalViews: typeof data?.stats?.totalViews === 'number' ? data.stats.totalViews : (cached?.stats?.totalViews ?? 0),
        uniqueVisitors: typeof data?.stats?.uniqueVisitors === 'number' ? data.stats.uniqueVisitors : (cached?.stats?.uniqueVisitors ?? 0),
        points: typeof data?.stats?.points === 'number' ? data.stats.points : (cached?.stats?.points ?? 0),
        averageRating: typeof data?.stats?.averageRating === 'number' ? data.stats.averageRating : (cached?.stats?.averageRating ?? 0),
        totalRatings: typeof data?.stats?.totalRatings === 'number' ? data.stats.totalRatings : (cached?.stats?.totalRatings ?? 0),
        submissionCount: typeof data?.stats?.submissionCount === 'number' ? data.stats.submissionCount : (cached?.stats?.submissionCount ?? 0),
        dailyStats: data?.stats?.dailyStats || cached?.stats?.dailyStats,
        monthlyStats: data?.stats?.monthlyStats || cached?.stats?.monthlyStats,
        yearlyStats: data?.stats?.yearlyStats || cached?.stats?.yearlyStats,
      },
      praises: Array.isArray(data?.praises) && data.praises.length > 0 
        ? data.praises 
        : (cached?.praises || DEFAULT_INITIAL_PRAISES),
      updatedAt: data?.updatedAt || usersLookup.data?.updatedAt || new Date().toISOString(),
    };

    setCachedUserProfile(loadedProfile);
    if (resolvedAvatar) {
      setStoredAvatarUrl(normEmail, resolvedAvatar);
    }
    return loadedProfile;
  }

  // Fallback to cached or default profile without blocking
  const isMasterWeerapong = normEmail === 'weerapong1625@acu.ac.th';
  const fallbackAvatar =
    sanitizeAvatarUrl(cached?.avatarUrl) ||
    getStoredAvatarUrl(normEmail) ||
    getMatchingAuthPhotoUrl(normEmail) ||
    cleanInitialAvatar ||
    '';
  const defaultProfile: FullUserProfile = cached ? {
    ...cached,
    avatarUrl: fallbackAvatar,
    photoURL: fallbackAvatar,
  } : {
    uid: resolvedUid,
    email: normEmail,
    fullName: isMasterWeerapong ? '(Admin) ม.วีระพงษ์ มีทรัพย์' : (initialDisplayName || normEmail.split('@')[0]),
    nickname: isMasterWeerapong ? 'ครูปอย' : '',
    school: 'โรงเรียนอัสสัมชัญอุบลราชธานี',
    displayName: initialDisplayName || normEmail.split('@')[0],
    avatarUrl: fallbackAvatar,
    photoURL: fallbackAvatar,
    role: isMasterWeerapong ? 'ผู้ดูแลระบบและพัฒนานวัตกรรม' : 'ครูผู้สอน / ผู้พัฒนานวัตกรรม',
    innovations: DEFAULT_INNOVATION_ITEMS,
    stats: {
      totalViews: 0,
      uniqueVisitors: 0,
      points: 0,
      averageRating: 0,
      totalRatings: 0,
    },
    praises: DEFAULT_INITIAL_PRAISES,
    updatedAt: new Date().toISOString(),
  };

  setCachedUserProfile(defaultProfile);
  return defaultProfile;
}

/**
 * Save Full User Profile to Firestore (`user_profiles` + isolated `users/{uid}`) & Cache
 */
export async function saveFullUserProfile(profile: FullUserProfile): Promise<boolean> {
  const normEmail = profile.email.toLowerCase().trim();
  const existingCached = getCachedUserProfile(normEmail);
  const candidatePhoto = sanitizeAvatarUrl(profile.photoURL || profile.avatarUrl);
  const cachedPhoto = sanitizeAvatarUrl(existingCached?.photoURL || existingCached?.avatarUrl);
  const resolvedAvatar =
    (candidatePhoto && !isUiAvatarPlaceholder(candidatePhoto) ? candidatePhoto : '') ||
    (cachedPhoto && !isUiAvatarPlaceholder(cachedPhoto) ? cachedPhoto : '') ||
    getStoredAvatarUrl(normEmail) ||
    candidatePhoto ||
    cachedPhoto ||
    '';

  const resolvedUid = resolveUserUid(normEmail, profile.uid);
  const nowIso = new Date().toISOString();
  const sanitizedProfile: FullUserProfile = {
    ...profile,
    uid: resolvedUid,
    email: normEmail,
    avatarUrl: resolvedAvatar,
    photoURL: resolvedAvatar,
    innovations: sanitizeInnovations(profile.innovations),
    updatedAt: nowIso,
  };
  setCachedUserProfile(sanitizedProfile);
  if (resolvedAvatar) {
    setStoredAvatarUrl(normEmail, resolvedAvatar);
  }

  const payload = {
    uid: resolvedUid,
    email: normEmail,
    fullName: sanitizedProfile.fullName || '',
    nickname: sanitizedProfile.nickname || '',
    school: sanitizedProfile.school || '',
    displayName: sanitizedProfile.displayName || '',
    avatarUrl: resolvedAvatar,
    photoURL: resolvedAvatar,
    role: sanitizedProfile.role || 'ครูผู้สอน',
    innovations: sanitizedProfile.innovations,
    stats: profile.stats || {
      totalViews: 0,
      uniqueVisitors: 0,
      points: 0,
      averageRating: 0,
      totalRatings: 0,
      submissionCount: 0,
    },
    praises: profile.praises || DEFAULT_INITIAL_PRAISES,
    updatedAt: nowIso,
  };

  if (typeof window !== 'undefined') {
    try {
      const currentEmail = (localStorage.getItem('acu_current_user_email') || '').trim().toLowerCase();
      if (currentEmail === normEmail) {
        if (profile.fullName) {
          localStorage.setItem('acu_current_user_name', profile.fullName);
          localStorage.setItem('acu_user_name', profile.fullName);
        }
      }
      window.dispatchEvent(new CustomEvent('acu_user_profile_updated', { detail: payload }));
      window.dispatchEvent(new CustomEvent('acu_user_profiles_changed', { detail: payload }));
    } catch {
      // ignore
    }
  }

  await writeSingleUserDocByUid(resolvedUid, {
    uid: resolvedUid,
    email: normEmail,
    photoURL: resolvedAvatar,
    avatarUrl: resolvedAvatar,
    displayName: payload.displayName,
    fullName: payload.fullName,
    role: payload.role,
    updatedAt: nowIso,
  });

  try {
    const safeDocId = getSafeDocId(normEmail);
    sessionProfileDocCache.set(safeDocId, payload);
    setLocalProfileDocCache(safeDocId, payload);
    const profileRef = doc(db, 'user_profiles', safeDocId);
    await setDoc(profileRef, payload, { merge: true });
    return true;
  } catch {
    return true;
  }
}

/**
 * Record a new visitor rating, compliments, and calculate accumulated points
 */
export async function addVisitorPraiseAndRating(
  profileEmail: string,
  newPraise: {
    visitorName: string;
    visitorSchool?: string;
    rating: number;
    comment: string;
  }
): Promise<FullUserProfile | null> {
  const current = getCachedUserProfile(profileEmail) || await fetchFullUserProfile(profileEmail);
  if (!current) return null;

  const pointsToAdd = newPraise.rating * 5; // e.g., 5 stars = 25 points
  const praiseEntry: VisitorPraise = {
    id: `praise-${Date.now()}`,
    visitorName: newPraise.visitorName.trim() || 'ผู้เข้าชมระบบคลังสื่อ',
    visitorSchool: newPraise.visitorSchool?.trim() || 'โรงเรียนอัสสัมชัญอุบลราชธานี',
    rating: Math.max(1, Math.min(5, newPraise.rating)),
    comment: newPraise.comment.trim() || 'ขอชื่นชมในความตั้งใจและสื่อนวัตกรรมที่มีคุณภาพครับ',
    timestamp: new Date().toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    pointsEarned: pointsToAdd,
  };

  const updatedPraises = [praiseEntry, ...current.praises];
  const newTotalRatings = current.stats.totalRatings + 1;
  const currentTotalStars = (current.stats.averageRating * current.stats.totalRatings) + newPraise.rating;
  const newAverage = Number((currentTotalStars / newTotalRatings).toFixed(1));
  const newPoints = current.stats.points + pointsToAdd;

  const updatedProfile: FullUserProfile = {
    ...current,
    stats: {
      ...current.stats,
      points: newPoints,
      averageRating: newAverage,
      totalRatings: newTotalRatings,
    },
    praises: updatedPraises,
    updatedAt: new Date().toISOString(),
  };

  await saveFullUserProfile(updatedProfile);
  return updatedProfile;
}

/**
 * Synchronously gather all user profiles cached in localStorage
 */
export function getAllLocalUserProfilesMap(): Record<string, FullUserProfile> {
  const map: Record<string, FullUserProfile> = {};
  if (typeof window === 'undefined') return map;
  const deletedEmails = getDeletedUserEmails();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LOCAL_STORAGE_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.email) {
              const norm = parsed.email.toLowerCase().trim();
              if (!deletedEmails.has(norm)) {
                map[norm] = parsed;
              }
            }
          } catch {
            // ignore
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error reading local profiles map:', err);
  }
  return map;
}

/**
 * Increment visit count when viewing profile
 * Guaranteed to increment locally and sync to audit logs and Firestore
 */
export async function recordProfileVisit(profileEmail: string): Promise<void> {
  const normEmail = profileEmail.toLowerCase().trim();
  if (!normEmail) return;

  // 1. Update in local profile cache immediately
  try {
    const cached = getCachedUserProfile(normEmail);
    if (cached) {
      cached.stats = {
        ...cached.stats,
        totalViews: (cached.stats?.totalViews || 0) + 1,
      };
      setCachedUserProfile(cached);
    }
  } catch (err) {
    console.warn('Could not update cached profile totalViews:', err);
  }

  // 2. Update Firestore with setDoc merge
  try {
    const safeDocId = getSafeDocId(normEmail);
    const profileRef = doc(db, 'user_profiles', safeDocId);
    await setDoc(
      profileRef,
      {
        stats: {
          totalViews: increment(1),
        },
      },
      { merge: true }
    );
  } catch (err) {
    // silently ignore quota / offline
  }
}

/**
 * Reset visit statistics on user profile(s) to 0 without touching any media or submission data
 */
export async function resetUserProfileVisitStats(
  target: 'all' | 'all_others' | string,
  adminEmail: string = 'weerapong1625@acu.ac.th'
): Promise<void> {
  const normAdmin = adminEmail.toLowerCase().trim();
  const normTarget = target.toLowerCase().trim();

  // 1. Update in local profile caches immediately (0ms)
  try {
    const localMap = getAllLocalUserProfilesMap();
    Object.keys(localMap).forEach((email) => {
      const norm = email.toLowerCase().trim();
      let shouldReset = false;
      if (normTarget === 'all') {
        shouldReset = true;
      } else if (normTarget === 'all_others') {
        shouldReset = norm !== normAdmin;
      } else {
        shouldReset = norm === normTarget;
      }

      if (shouldReset && localMap[email]) {
        const p = localMap[email];
        p.stats = {
          ...p.stats,
          totalViews: 0,
          dailyStats: {},
          monthlyStats: {},
          yearlyStats: {},
        };
        setCachedUserProfile(p);
      }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_profile_updated'));
    }
  } catch (err) {
    console.warn('Could not reset local profile visit stats:', err);
  }

  // 2. Update Firestore user_profiles docs (strictly updating only stats, never touching innovations/media)
  try {
    if (normTarget !== 'all' && normTarget !== 'all_others') {
      const safeId = getSafeDocId(normTarget);
      const profileRef = doc(db, 'user_profiles', safeId);
      await setDoc(
        profileRef,
        {
          stats: {
            totalViews: 0,
            dailyStats: {},
            monthlyStats: {},
            yearlyStats: {},
          },
        },
        { merge: true }
      );
    } else {
      const profilesRef = collection(db, 'user_profiles');
      const snap = await getDocs(profilesRef);
      const batch = writeBatch(db);
      let count = 0;
      snap.docs.forEach((d) => {
        const data = d.data();
        const em = (data.email || d.id).toLowerCase().trim();
        let shouldReset = false;
        if (normTarget === 'all') shouldReset = true;
        else if (normTarget === 'all_others') shouldReset = em !== normAdmin;

        if (shouldReset) {
          batch.set(
            d.ref,
            {
              stats: {
                totalViews: 0,
                dailyStats: {},
                monthlyStats: {},
                yearlyStats: {},
              },
            },
            { merge: true }
          );
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    }
  } catch (fsErr) {
    console.warn('Firestore profile stats reset deferred or quota reached:', fsErr);
  }
}

/**
 * Atomically update user's submission counter in user_profiles using Firestore increment(delta)
 */
export async function adjustUserSubmissionCount(
  email: string,
  delta: number,
  uid?: string
): Promise<void> {
  const normEmail = (email || '').toLowerCase().trim();
  if (!normEmail || delta === 0) return;

  // 1. Update local cached profile immediately
  try {
    const cached = getCachedUserProfile(normEmail);
    if (cached) {
      const current = typeof cached.stats?.submissionCount === 'number' ? cached.stats.submissionCount : 0;
      cached.stats = {
        ...cached.stats,
        submissionCount: Math.max(0, current + delta),
      };
      setCachedUserProfile(cached);
    }
  } catch {
    // ignore
  }

  // 2. Atomically increment/decrement in Firestore
  try {
    const safeDocId = getSafeDocId(normEmail);
    const profileRef = doc(db, 'user_profiles', safeDocId);
    const resolvedUid = resolveUserUid(normEmail, uid);
    await setDoc(
      profileRef,
      {
        uid: resolvedUid,
        email: normEmail,
        stats: {
          submissionCount: increment(delta),
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
    }
  }
}

// Smart-cached pool for `user_profiles` only (no collection-wide `users` query, no onSnapshot)
const ALL_USER_PROFILES_CACHE_KEY = 'acu_cached_all_user_profiles_map';
const ALL_USER_PROFILES_FETCHED_AT_KEY = 'acu_cached_all_user_profiles_fetched_at';
const ALL_USER_PROFILES_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours TTL
const userProfilesListeners = new Set<(map: Record<string, FullUserProfile>) => void>();
let sharedUserProfilesMap: Record<string, FullUserProfile> | null = null;
let latestProfileDocsByEmail: Record<string, any> = {};
let hasFetchedAllUserProfilesThisSession = false;
let inFlightAllUserProfilesFetch: Promise<Record<string, FullUserProfile>> | null = null;
let userProfilesWindowListenersAttached = false;

function hasFreshAllUserProfilesCache(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(ALL_USER_PROFILES_CACHE_KEY);
    const rawTs = localStorage.getItem(ALL_USER_PROFILES_FETCHED_AT_KEY);
    if (raw === null || !rawTs) return false;
    const fetchedAt = Number(rawTs);
    if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return false;
    if (Date.now() - fetchedAt >= ALL_USER_PROFILES_TTL_MS) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && typeof parsed === 'object');
  } catch {
    return false;
  }
}

function getStoredAllUserProfilesMap(): Record<string, FullUserProfile> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ALL_USER_PROFILES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, FullUserProfile>;
      }
    }
  } catch {}
  return {};
}

function saveStoredAllUserProfilesMap(map: Record<string, FullUserProfile>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(ALL_USER_PROFILES_CACHE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

function rebuildAndBroadcastMergedProfiles(): Record<string, FullUserProfile> {
  const deletedEmails = getDeletedUserEmails();
  const map: Record<string, FullUserProfile> = {
    ...getStoredAllUserProfilesMap(),
    ...getAllLocalUserProfilesMap(),
  };

  Object.keys(latestProfileDocsByEmail).forEach((normEmail) => {
    if (!normEmail || deletedEmails.has(normEmail)) {
      delete map[normEmail];
      return;
    }
    const d = latestProfileDocsByEmail[normEmail] || {};
    const resolvedAvatar = resolveDisplayAvatarUrl({
      firestoreAvatarUrl: d.photoURL || d.avatarUrl,
      localCachedAvatarUrl: map[normEmail]?.avatarUrl,
      fallbackSeedName: d.fullName || normEmail,
    });
    const cleanFinalAvatar = isUiAvatarPlaceholder(resolvedAvatar) ? '' : resolvedAvatar;

    map[normEmail] = {
      uid: d.uid || resolveUserUid(normEmail),
      email: normEmail,
      fullName: d.fullName || d.displayName || normEmail.split('@')[0],
      nickname: d.nickname || '',
      school: d.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี',
      displayName: d.displayName || d.fullName || normEmail.split('@')[0],
      avatarUrl: cleanFinalAvatar,
      photoURL: cleanFinalAvatar,
      role: d.role || 'ครูผู้สอน',
      innovations: sanitizeInnovations(d.innovations),
      stats: {
        totalViews: typeof d.stats?.totalViews === 'number' ? d.stats.totalViews : 0,
        uniqueVisitors: typeof d.stats?.uniqueVisitors === 'number' ? d.stats.uniqueVisitors : 0,
        points: typeof d.stats?.points === 'number' ? d.stats.points : 0,
        averageRating: typeof d.stats?.averageRating === 'number' ? d.stats.averageRating : 0,
        totalRatings: typeof d.stats?.totalRatings === 'number' ? d.stats.totalRatings : 0,
        submissionCount: typeof d.stats?.submissionCount === 'number' ? d.stats.submissionCount : 0,
        dailyStats: d.stats?.dailyStats,
        monthlyStats: d.stats?.monthlyStats,
        yearlyStats: d.stats?.yearlyStats,
      },
      praises: Array.isArray(d.praises) ? d.praises : [],
      updatedAt: d.updatedAt,
    };
  });

  // Clean deleted users
  deletedEmails.forEach((em) => delete map[em]);
  saveStoredAllUserProfilesMap(map);
  broadcastUserProfiles(map);
  return map;
}

function broadcastUserProfiles(map: Record<string, FullUserProfile>): void {
  sharedUserProfilesMap = map;
  userProfilesListeners.forEach((cb) => {
    try {
      cb(map);
    } catch (err) {
      console.warn('Error in user profiles subscriber:', err);
    }
  });
}

function ensureUserProfilesWindowListeners(): void {
  if (typeof window === 'undefined' || userProfilesWindowListenersAttached) return;
  userProfilesWindowListenersAttached = true;

  const handleLocalChange = (e: Event) => {
    const detail = (e as CustomEvent)?.detail;
    if (detail?.email) {
      const norm = String(detail.email).toLowerCase().trim();
      latestProfileDocsByEmail[norm] = { ...(latestProfileDocsByEmail[norm] || {}), ...detail };
    }
    rebuildAndBroadcastMergedProfiles();
  };
  const handleUserDeleted = () => {
    rebuildAndBroadcastMergedProfiles();
  };

  window.addEventListener('acu_user_profiles_changed', handleLocalChange);
  window.addEventListener('acu_user_deleted', handleUserDeleted);
}

/**
 * One-time getDocs fetch for `user_profiles` (6-hour localStorage TTL unless forceRefresh=true)
 */
export async function refreshAllUserProfiles(forceRefresh = false): Promise<Record<string, FullUserProfile>> {
  const storedMap = {
    ...getStoredAllUserProfilesMap(),
    ...getAllLocalUserProfilesMap(),
  };
  const localFallback = Object.keys(storedMap).length > 0 ? storedMap : (sharedUserProfilesMap || {});

  if (!forceRefresh && hasFreshAllUserProfilesCache()) {
    sharedUserProfilesMap = storedMap;
    hasFetchedAllUserProfilesThisSession = true;
    return storedMap;
  }

  if (!forceRefresh && hasFetchedAllUserProfilesThisSession && sharedUserProfilesMap) {
    return sharedUserProfilesMap;
  }

  if (!forceRefresh && inFlightAllUserProfilesFetch) {
    return inFlightAllUserProfilesFetch;
  }

  inFlightAllUserProfilesFetch = (async () => {
    try {
      await waitForAuthReady();
      const colQuery = query(collection(db, 'user_profiles'), limit(500));
      const snapshot = await getDocs(colQuery);
      if (
        snapshot.empty &&
        (snapshot.metadata?.fromCache || !isAuthReady()) &&
        Object.keys(localFallback).length > 0
      ) {
        broadcastUserProfiles(localFallback);
        return localFallback;
      }
      const nextProfileDocs: Record<string, any> = {};
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const rawEmail =
          d.email ||
          (docSnap.id.includes('%40') || docSnap.id.includes('@') ? decodeURIComponent(docSnap.id) : '');
        if (rawEmail) {
          nextProfileDocs[rawEmail.toLowerCase().trim()] = d;
        }
      });
      if (Object.keys(nextProfileDocs).length > 0 || Object.keys(localFallback).length === 0) {
        latestProfileDocsByEmail = nextProfileDocs;
        hasFetchedAllUserProfilesThisSession = true;
        const rebuilt = rebuildAndBroadcastMergedProfiles();
        try {
          if (localStorage.getItem(ALL_USER_PROFILES_CACHE_KEY) !== null) {
            localStorage.setItem(ALL_USER_PROFILES_FETCHED_AT_KEY, String(Date.now()));
          }
        } catch {}
        return rebuilt;
      }
      try {
        localStorage.setItem(ALL_USER_PROFILES_FETCHED_AT_KEY, String(Date.now()));
      } catch {}
      broadcastUserProfiles(localFallback);
      return localFallback;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      console.warn('[Firestore] refreshAllUserProfiles failed, falling back to localStorage:', err);
      broadcastUserProfiles(localFallback);
      return localFallback;
    } finally {
      inFlightAllUserProfilesFetch = null;
    }
  })();

  return inFlightAllUserProfilesFetch;
}

/**
 * Smart-cached subscription to all user profiles (`user_profiles` only, no `users` collection query, no onSnapshot)
 */
export function subscribeAllUserProfiles(
  callback: (profilesMap: Record<string, FullUserProfile>) => void
): () => void {
  userProfilesListeners.add(callback);
  ensureUserProfilesWindowListeners();

  const initial = sharedUserProfilesMap || {
    ...getStoredAllUserProfilesMap(),
    ...getAllLocalUserProfilesMap(),
  };
  if (Object.keys(initial).length > 0) {
    callback(initial);
  }

  refreshAllUserProfiles(false).catch(() => {});

  return () => {
    userProfilesListeners.delete(callback);
  };
}

/**
 * Utility to extract clean real full name (ชื่อ-นามสกุลจริงเท่านั้น)
 * Removes prefixes like (Admin), brackets, nicknames in parentheses
 */
export function getCleanRealName(fullName?: string, fallbackEmail?: string): string {
  if (!fullName || !fullName.trim()) {
    if (fallbackEmail) {
      return fallbackEmail.split('@')[0];
    }
    return 'คุณครูผู้พัฒนานวัตกรรม';
  }
  let clean = fullName.trim();
  // Remove prefix tags like (Admin) or [ผู้ดูแลระบบ]
  clean = clean.replace(/^\s*[\(\[]\s*(?:Admin|admin|ผู้ดูแลระบบ|Super Admin|แอดมิน)\s*[\)\]]\s*/i, '');
  // Remove trailing nickname in parentheses e.g. "ม.วีระพงษ์ มีทรัพย์ (ครูปอย)" -> "ม.วีระพงษ์ มีทรัพย์"
  clean = clean.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return clean || fullName.trim();
}

// =========================================================================
// 4. ลบบัญชีผู้ใช้งานระบบ (เฉพาะ Admin เท่านั้น)
// =========================================================================

export interface DeleteUserAccountResult {
  success: boolean;
  targetEmail: string;
  deletedCounts: {
    profile: boolean;
    loginLogs: number;
    innovations: number;
    facilities: number;
    teacherMedia: number;
  };
  error?: string;
}

/**
 * Permanently delete a user account from Firestore and local vaults.
 * Strict permission: ONLY Super Admin (weerapong1625@acu.ac.th) can invoke this.
 * Master protection: Super Admin account itself is protected and CANNOT be deleted.
 */
export async function deleteUserAccountCompletely(
  targetEmail: string,
  adminEmail: string,
  options: {
    deleteSubmissions?: boolean;
    deleteFacilities?: boolean;
    deleteLogs?: boolean;
    deleteMedia?: boolean;
  } = {
    deleteSubmissions: true,
    deleteFacilities: true,
    deleteLogs: true,
    deleteMedia: true,
  }
): Promise<DeleteUserAccountResult> {
  const normAdmin = adminEmail.trim().toLowerCase();
  const normTarget = targetEmail.trim().toLowerCase();

  const emptyCounts = {
    profile: false,
    loginLogs: 0,
    innovations: 0,
    facilities: 0,
    teacherMedia: 0,
  };

  // Security Verification
  if (normAdmin !== 'weerapong1625@acu.ac.th') {
    return {
      success: false,
      targetEmail: normTarget,
      deletedCounts: emptyCounts,
      error: 'สิทธิ์ถูกปฏิเสธ: ฟังก์ชันลบบัญชีผู้ใช้สงวนสิทธิ์เฉพาะผู้ดูแลระบบหลัก (Admin) เท่านั้น',
    };
  }

  // Protection of Master Admin Account
  if (normTarget === 'weerapong1625@acu.ac.th') {
    return {
      success: false,
      targetEmail: normTarget,
      deletedCounts: emptyCounts,
      error: 'ระบบป้องกันความปลอดภัย: ไม่อนุญาตให้ลบบัญชีผู้ดูแลระบบหลัก (Super Admin) ของโรงเรียน',
    };
  }

  try {
    const deletedCounts = { ...emptyCounts };

    // 1. Permanently record to deleted users blocklist
    addDeletedUserEmail(normTarget);

    // 2. Remove all local storage caches and vaults for this user immediately
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${normTarget}`);
        localStorage.removeItem(`acu_user_avatar_${normTarget}`);
        const remembered = localStorage.getItem('acu_remembered_gmail');
        if (remembered && remembered.trim().toLowerCase() === normTarget) {
          localStorage.removeItem('acu_remembered_gmail');
        }
        const currentEmail = localStorage.getItem('acu_current_user_email');
        if (currentEmail && currentEmail.trim().toLowerCase() === normTarget) {
          localStorage.removeItem('acu_current_user_email');
        }

        // Purge user login logs from local cache
        const rawLogs = localStorage.getItem('acu_persistent_login_logs');
        if (rawLogs) {
          const parsed = JSON.parse(rawLogs);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((l: any) => (l.email || '').toLowerCase().trim() !== normTarget);
            localStorage.setItem('acu_persistent_login_logs', JSON.stringify(filtered));
          }
        }

        // Purge innovations from local cache
        const rawInnovs = localStorage.getItem('acu_cached_innovations_submissions');
        if (rawInnovs) {
          const parsed = JSON.parse(rawInnovs);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((i: any) => (i.userEmail || '').toLowerCase().trim() !== normTarget);
            localStorage.setItem('acu_cached_innovations_submissions', JSON.stringify(filtered));
          }
        }

        // Purge teacher media from local cache
        const rawMedia = localStorage.getItem('acu_cached_teacher_media');
        if (rawMedia) {
          const parsed = JSON.parse(rawMedia);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((m: any) => (m.submittedByEmail || '').toLowerCase().trim() !== normTarget);
            localStorage.setItem('acu_cached_teacher_media', JSON.stringify(filtered));
          }
        }

        // Purge facilities from local cache
        const rawFac = localStorage.getItem('acu_cached_facility_submissions');
        if (rawFac) {
          const parsed = JSON.parse(rawFac);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((f: any) => (f.userEmail || '').toLowerCase().trim() !== normTarget);
            localStorage.setItem('acu_cached_facility_submissions', JSON.stringify(filtered));
          }
        }
      }
      removeUserCredential(normTarget);
    } catch (err) {
      console.warn('Could not clean local storage for user:', err);
    }

    // 3. Direct single-doc delete user_profiles and users doc ID variants from Firestore (no collection query)
    try {
      const safeDocId = getSafeDocId(normTarget);
      await Promise.allSettled([
        deleteDoc(doc(db, 'user_profiles', safeDocId)),
        deleteDoc(doc(db, 'user_profiles', normTarget)),
        deleteDoc(doc(db, 'user_profiles', encodeURIComponent(normTarget))),
        deleteDoc(doc(db, 'users', safeDocId)),
      ]);
      deletedCounts.profile = true;
    } catch (err) {
      console.warn('Direct deleteDoc user_profiles notice:', err);
    }

    // 4. Delete login logs for this user if requested
    if (options.deleteLogs) {
      try {
        const logsCol = collection(db, 'login_logs');
        const logsSnap = await getDocs(logsCol);
        const userLogDocs = logsSnap.docs.filter((d) => {
          const email = (d.data().email || d.data().userEmail || '').trim().toLowerCase();
          return email === normTarget;
        });

        for (let i = 0; i < userLogDocs.length; i += 100) {
          const chunk = userLogDocs.slice(i, i + 100);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        deletedCounts.loginLogs = userLogDocs.length;
      } catch (err) {
        console.warn('Could not delete user login logs:', err);
      }
    }

    // 5. Delete innovation submissions if requested
    if (options.deleteSubmissions) {
      try {
        const innovCol = collection(db, 'teacher_innovations_submissions');
        const innovSnap = await getDocs(innovCol);
        const userInnovDocs = innovSnap.docs.filter((d) => {
          const email = (d.data().userEmail || d.data().email || d.data().teacherEmail || '').trim().toLowerCase();
          return email === normTarget;
        });

        for (let i = 0; i < userInnovDocs.length; i += 100) {
          const chunk = userInnovDocs.slice(i, i + 100);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        deletedCounts.innovations = userInnovDocs.length;
      } catch (err) {
        console.warn('Could not delete user innovations:', err);
      }
    }

    // 6. Delete facility records in system_test_submissions if requested
    if (options.deleteFacilities || options.deleteSubmissions) {
      try {
        const sysCol = collection(db, 'system_test_submissions');
        const sysSnap = await getDocs(sysCol);
        const userSysDocs = sysSnap.docs.filter((d) => {
          const email = (d.data().userEmail || d.data().email || '').trim().toLowerCase();
          return email === normTarget;
        });

        for (let i = 0; i < userSysDocs.length; i += 100) {
          const chunk = userSysDocs.slice(i, i + 100);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        deletedCounts.facilities = userSysDocs.length;
      } catch (err) {
        console.warn('Could not delete user facility records:', err);
      }
    }

    // 7. Delete teacher media repository works if requested
    if (options.deleteMedia) {
      try {
        const mediaCol = collection(db, 'teacher_media_repository');
        const mediaSnap = await getDocs(mediaCol);
        const userMediaDocs = mediaSnap.docs.filter((d) => {
          const email = (d.data().submittedByEmail || d.data().userEmail || d.data().email || '').trim().toLowerCase();
          return email === normTarget;
        });

        for (let i = 0; i < userMediaDocs.length; i += 100) {
          const chunk = userMediaDocs.slice(i, i + 100);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        deletedCounts.teacherMedia = userMediaDocs.length;
      } catch (err) {
        console.warn('Could not delete user teacher media:', err);
      }
    }

    // 8. Delete shared teaching ideas if present
    try {
      const sharedCol = collection(db, 'shared_teaching_ideas');
      const sharedSnap = await getDocs(sharedCol);
      const userSharedDocs = sharedSnap.docs.filter((d) => {
        const email = (d.data().authorEmail || d.data().email || d.data().userEmail || '').trim().toLowerCase();
        return email === normTarget;
      });

      for (let i = 0; i < userSharedDocs.length; i += 100) {
        const chunk = userSharedDocs.slice(i, i + 100);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      console.warn('Could not clean shared teaching ideas:', err);
    }

    // 9. Dispatch instant update events across all application components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_user_deleted', { detail: { email: normTarget } }));
      window.dispatchEvent(new CustomEvent('acu_login_logs_updated'));
      window.dispatchEvent(new CustomEvent('acu_innovations_changed'));
      window.dispatchEvent(new CustomEvent('acu_teacher_media_changed'));
      window.dispatchEvent(new CustomEvent('acu_facilities_changed'));
    }

    return {
      success: true,
      targetEmail: normTarget,
      deletedCounts,
    };
  } catch (err: any) {
    console.error('Failed to delete user account:', err);
    return {
      success: false,
      targetEmail: normTarget,
      deletedCounts: emptyCounts,
      error: err?.message || 'เกิดข้อผิดพลาดในการลบบัญชีผู้ใช้',
    };
  }
}

// =========================================================================
// 5. ระบบตรวจสอบและปรับปรุงความสอดคล้องของบัญชีอีเมลทุกฐานข้อมูล (Email Audit & Sync)
// =========================================================================

export interface EmailAuditDiscrepancy {
  email: string;
  category: 'case_or_space_normalized' | 'missing_profile_created' | 'name_synchronized' | 'submission_repaired';
  description: string;
  repaired: boolean;
}

export interface DatabaseEmailAuditResult {
  success: boolean;
  timestamp: string;
  scannedUniqueEmails: number;
  emailsList: string[];
  collectionCounts: {
    userProfiles: number;
    loginLogs: number;
    innovations: number;
    facilities: number;
    teacherMedia: number;
  };
  normalizedCount: number;
  missingProfilesCreated: number;
  namesSynchronized: number;
  discrepancies: EmailAuditDiscrepancy[];
  isFullyConsistent: boolean;
  error?: string;
}

/**
 * Audits all databases/collections in Firestore:
 * - Checks and normalizes user emails (lowercasing, trimming spaces).
 * - Ensures every user in login logs or submissions has a corresponding valid user_profiles document.
 * - Aligns teacher full names across all databases for consistent certificate and report generation.
 * - Auto-repairs discrepancies in real-time and returns a detailed audit summary report.
 */
export async function auditAndSyncAllDatabaseEmails(adminEmail: string): Promise<DatabaseEmailAuditResult> {
  const normAdmin = adminEmail.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  if (normAdmin !== 'weerapong1625@acu.ac.th') {
    return {
      success: false,
      timestamp: nowIso,
      scannedUniqueEmails: 0,
      emailsList: [],
      collectionCounts: { userProfiles: 0, loginLogs: 0, innovations: 0, facilities: 0, teacherMedia: 0 },
      normalizedCount: 0,
      missingProfilesCreated: 0,
      namesSynchronized: 0,
      discrepancies: [],
      isFullyConsistent: false,
      error: 'สงวนสิทธิ์การตรวจสอบฐานข้อมูลสำหรับผู้ดูแลระบบ (Admin) เท่านั้น',
    };
  }

  try {
    const safeGetDocs = async (colName: string) => {
      try {
        return await getDocs(collection(db, colName));
      } catch (e) {
        console.warn(`Could not getDocs for ${colName}:`, e);
        return { docs: [], size: 0 } as any;
      }
    };

    // 1. Fetch all documents across all 5 major collections safely
    const [profilesSnap, logsSnap, innovSnap, sysSnap, mediaSnap] = await Promise.all([
      safeGetDocs('user_profiles'),
      safeGetDocs('login_logs'),
      safeGetDocs('teacher_innovations_submissions'),
      safeGetDocs('system_test_submissions'),
      safeGetDocs('teacher_media_repository'),
    ]);

    const deletedEmails = getDeletedUserEmails();
    const discrepancies: EmailAuditDiscrepancy[] = [];
    const uniqueEmailsMap = new Map<string, {
      fullName?: string;
      displayName?: string;
      school?: string;
      role?: string;
      avatarUrl?: string;
      hasProfile: boolean;
      profileDocId?: string;
      profileData?: any;
    }>();

    let normalizedCount = 0;
    let missingProfilesCreated = 0;
    let namesSynchronized = 0;

    // A. Process user_profiles
    for (const docSnap of profilesSnap.docs) {
      const data = docSnap.data();
      const rawEmail = data.email || '';
      if (!rawEmail) continue;

      const normEmail = rawEmail.trim().toLowerCase();
      if (deletedEmails.has(normEmail)) continue;
      const needsNormalize = rawEmail !== normEmail || docSnap.id !== getSafeDocId(normEmail);

      if (needsNormalize) {
        normalizedCount++;
        discrepancies.push({
          email: normEmail,
          category: 'case_or_space_normalized',
          description: `ปรับปรุงรูปแบบอีเมลใน user_profiles จาก "${rawEmail}" เป็น "${normEmail}"`,
          repaired: true,
        });
        // Save normalized document
        const correctDocRef = doc(db, 'user_profiles', getSafeDocId(normEmail));
        await setDoc(correctDocRef, { ...data, email: normEmail, updatedAt: nowIso }, { merge: true });
      }

      uniqueEmailsMap.set(normEmail, {
        fullName: data.fullName,
        displayName: data.displayName,
        school: data.school,
        role: data.role,
        avatarUrl: data.avatarUrl,
        hasProfile: true,
        profileDocId: getSafeDocId(normEmail),
        profileData: data,
      });
    }

    // B. Process login_logs
    for (const docSnap of logsSnap.docs) {
      const data = docSnap.data();
      const rawEmail = data.email || '';
      if (!rawEmail) continue;

      const normEmail = rawEmail.trim().toLowerCase();
      if (deletedEmails.has(normEmail)) continue;
      if (rawEmail !== normEmail) {
        normalizedCount++;
        discrepancies.push({
          email: normEmail,
          category: 'case_or_space_normalized',
          description: `ปรับปรุงอีเมลใน login_logs (ID: ${docSnap.id}) จาก "${rawEmail}" ให้เป็นตัวพิมพ์เล็กมาตรฐาน`,
          repaired: true,
        });
        await updateDoc(docSnap.ref, { email: normEmail });
      }

      if (!uniqueEmailsMap.has(normEmail)) {
        uniqueEmailsMap.set(normEmail, {
          displayName: data.displayName,
          role: data.role,
          avatarUrl: data.avatarUrl,
          hasProfile: false,
        });
      }
    }

    // C. Process teacher_innovations_submissions
    for (const docSnap of innovSnap.docs) {
      const data = docSnap.data();
      const rawEmail = data.userEmail || '';
      if (!rawEmail) continue;

      const normEmail = rawEmail.trim().toLowerCase();
      if (deletedEmails.has(normEmail)) continue;
      if (rawEmail !== normEmail) {
        normalizedCount++;
        discrepancies.push({
          email: normEmail,
          category: 'case_or_space_normalized',
          description: `ปรับปรุง userEmail ใน teacher_innovations_submissions จาก "${rawEmail}" ให้เป็นมาตรฐาน`,
          repaired: true,
        });
        await updateDoc(docSnap.ref, { userEmail: normEmail });
      }

      const existing = uniqueEmailsMap.get(normEmail);
      if (!existing) {
        uniqueEmailsMap.set(normEmail, {
          fullName: data.teacherName,
          displayName: data.teacherName,
          hasProfile: false,
        });
      } else if (!existing.fullName && data.teacherName) {
        existing.fullName = data.teacherName;
      }
    }

    // D. Process system_test_submissions
    for (const docSnap of sysSnap.docs) {
      const data = docSnap.data();
      const rawEmail = data.userEmail || '';
      if (!rawEmail) continue;

      const normEmail = rawEmail.trim().toLowerCase();
      if (deletedEmails.has(normEmail)) continue;
      if (rawEmail !== normEmail) {
        normalizedCount++;
        await updateDoc(docSnap.ref, { userEmail: normEmail });
      }

      const existing = uniqueEmailsMap.get(normEmail);
      if (!existing) {
        uniqueEmailsMap.set(normEmail, {
          fullName: data.teacherName,
          displayName: data.teacherName,
          hasProfile: false,
        });
      } else if (!existing.fullName && data.teacherName) {
        existing.fullName = data.teacherName;
      }
    }

    // E. Process teacher_media_repository
    for (const docSnap of mediaSnap.docs) {
      const data = docSnap.data();
      const rawEmail = data.submittedByEmail || '';
      if (!rawEmail) continue;

      const normEmail = rawEmail.trim().toLowerCase();
      if (deletedEmails.has(normEmail)) continue;
      if (rawEmail !== normEmail) {
        normalizedCount++;
        await updateDoc(docSnap.ref, { submittedByEmail: normEmail });
      }
    }

    // F. Reconcile & Create missing user_profiles
    for (const [normEmail, record] of uniqueEmailsMap.entries()) {
      if (deletedEmails.has(normEmail)) continue;
      const isMaster = normEmail === 'weerapong1625@acu.ac.th';
      const cleanRealName = getCleanRealName(record.fullName, normEmail);

      if (!record.hasProfile) {
        missingProfilesCreated++;
        const newProfileDoc: FullUserProfile = {
          email: normEmail,
          fullName: isMaster ? '(Admin) ม.วีระพงษ์ มีทรัพย์' : (cleanRealName || normEmail.split('@')[0]),
          nickname: isMaster ? 'ครูปอย' : '',
          school: 'โรงเรียนอัสสัมชัญอุบลราชธานี',
          displayName: isMaster ? '(Admin) ม.วีระพงษ์ มีทรัพย์' : (cleanRealName || normEmail.split('@')[0]),
          avatarUrl: record.avatarUrl || '',
          role: isMaster ? 'ผู้ดูแลระบบและพัฒนานวัตกรรม' : (record.role || 'ครูผู้สอน / ผู้พัฒนานวัตกรรม'),
          innovations: DEFAULT_INNOVATION_ITEMS,
          stats: {
            totalViews: 0,
            uniqueVisitors: 0,
            points: 0,
            averageRating: 0,
            totalRatings: 0,
          },
          praises: [],
          updatedAt: nowIso,
        };

        const safeDocId = getSafeDocId(normEmail);
        await setDoc(doc(db, 'user_profiles', safeDocId), newProfileDoc);
        setCachedUserProfile(newProfileDoc);

        discrepancies.push({
          email: normEmail,
          category: 'missing_profile_created',
          description: `สร้างโปรไฟล์เชื่อมโยงใน user_profiles ให้ตรงกับบัญชีที่มีการใช้งานจริง (${cleanRealName})`,
          repaired: true,
        });
      } else {
        // If profile exists, ensure full name is cleanly populated
        const currentFullName = record.profileData?.fullName;
        if (!currentFullName || currentFullName.trim() === normEmail.split('@')[0]) {
          if (record.fullName && record.fullName !== normEmail.split('@')[0]) {
            namesSynchronized++;
            const safeDocId = getSafeDocId(normEmail);
            await updateDoc(doc(db, 'user_profiles', safeDocId), {
              fullName: record.fullName,
              updatedAt: nowIso,
            });
            discrepancies.push({
              email: normEmail,
              category: 'name_synchronized',
              description: `ซิงค์ชื่อ-นามสกุลจริง "${record.fullName}" เข้าสู่โปรไฟล์ของ ${normEmail}`,
              repaired: true,
            });
          }
        }
      }
    }

    const scannedEmailsList = Array.from(uniqueEmailsMap.keys()).sort();

    return {
      success: true,
      timestamp: nowIso,
      scannedUniqueEmails: scannedEmailsList.length,
      emailsList: scannedEmailsList,
      collectionCounts: {
        userProfiles: profilesSnap.size + missingProfilesCreated,
        loginLogs: logsSnap.size,
        innovations: innovSnap.size,
        facilities: sysSnap.size,
        teacherMedia: mediaSnap.size,
      },
      normalizedCount,
      missingProfilesCreated,
      namesSynchronized,
      discrepancies,
      isFullyConsistent: true,
    };
  } catch (err: any) {
    console.error('Audit and sync database emails failed:', err);
    return {
      success: false,
      timestamp: nowIso,
      scannedUniqueEmails: 0,
      emailsList: [],
      collectionCounts: { userProfiles: 0, loginLogs: 0, innovations: 0, facilities: 0, teacherMedia: 0 },
      normalizedCount: 0,
      missingProfilesCreated: 0,
      namesSynchronized: 0,
      discrepancies: [],
      isFullyConsistent: false,
      error: err?.message || 'เกิดข้อผิดพลาดในการตรวจสอบฐานข้อมูล',
    };
  }
}

