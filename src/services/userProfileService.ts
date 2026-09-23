import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  increment, 
  onSnapshot, 
  collection, 
  getDocs, 
  deleteDoc, 
  writeBatch, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { removeUserCredential } from './authCredentialService';

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
  dailyStats?: Record<string, number>;
  monthlyStats?: Record<string, number>;
  yearlyStats?: Record<string, number>;
}

export interface FullUserProfile {
  email: string;
  fullName: string;
  nickname: string;
  school: string;
  displayName: string;
  avatarUrl: string;
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

/**
 * Generate a safe Firestore Doc ID from email
 */
function getSafeDocId(email: string): string {
  return encodeURIComponent(email.toLowerCase().trim());
}

/**
 * Synchronously read cached full user profile from localStorage
 */
export function getCachedUserProfile(email: string): FullUserProfile | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${email.toLowerCase().trim()}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Could not read cached profile:', err);
  }
  return null;
}

/**
 * Save profile to localStorage cache
 */
export function setCachedUserProfile(profile: FullUserProfile): void {
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_PREFIX}${profile.email.toLowerCase().trim()}`,
      JSON.stringify(profile)
    );
  } catch (err) {
    console.warn('Could not save to localStorage:', err);
  }
}

/**
 * Real-time subscription to full user profile in Firestore.
 * Automatically synchronizes profile data and avatar across all mobile and desktop devices.
 */
export function subscribeFullUserProfile(
  email: string,
  onUpdate: (profile: FullUserProfile) => void
): () => void {
  try {
    const safeDocId = getSafeDocId(email);
    const profileRef = doc(db, 'user_profiles', safeDocId);
    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const loadedProfile: FullUserProfile = {
            email: data.email || email,
            fullName: data.fullName || 'คุณครูอัสสัมชัญ',
            nickname: data.nickname || '',
            school: data.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี',
            displayName: data.displayName || data.fullName || email.split('@')[0],
            avatarUrl: data.avatarUrl || '',
            role: data.role || 'ครูผู้สอน / ผู้พัฒนานวัตกรรม',
            innovations: Array.isArray(data.innovations) && data.innovations.length === 5 
              ? data.innovations 
              : DEFAULT_INNOVATION_ITEMS,
            stats: {
              totalViews: typeof data.stats?.totalViews === 'number' ? data.stats.totalViews : 0,
              uniqueVisitors: typeof data.stats?.uniqueVisitors === 'number' ? data.stats.uniqueVisitors : 0,
              points: typeof data.stats?.points === 'number' ? data.stats.points : 0,
              averageRating: typeof data.stats?.averageRating === 'number' ? data.stats.averageRating : 0,
              totalRatings: typeof data.stats?.totalRatings === 'number' ? data.stats.totalRatings : 0,
            },
            praises: Array.isArray(data.praises) ? data.praises : DEFAULT_INITIAL_PRAISES,
            updatedAt: data.updatedAt || new Date().toISOString(),
          };
          setCachedUserProfile(loadedProfile);
          onUpdate(loadedProfile);
        } else {
          fetchFullUserProfile(email).then(onUpdate);
        }
      },
      (error) => {
        console.warn('Realtime profile subscription warning:', error);
        fetchFullUserProfile(email).then(onUpdate);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Could not initialize profile subscription:', err);
    fetchFullUserProfile(email).then(onUpdate);
    return () => {};
  }
}

/**
 * Fetch full profile from Firestore with fallback to default and localStorage
 */
export async function fetchFullUserProfile(
  email: string, 
  initialDisplayName?: string,
  initialAvatar?: string
): Promise<FullUserProfile> {
  const cached = getCachedUserProfile(email);
  const safeDocId = getSafeDocId(email);
  const profileRef = doc(db, 'user_profiles', safeDocId);

  try {
    const snapshot = await getDoc(profileRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      const loadedProfile: FullUserProfile = {
        email: data.email || email,
        fullName: data.fullName || (data.displayName || initialDisplayName || 'คุณครูอัสสัมชัญ'),
        nickname: data.nickname || '',
        school: data.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี',
        displayName: data.displayName || initialDisplayName || email.split('@')[0],
        avatarUrl: data.avatarUrl || initialAvatar || '',
        role: data.role || 'ครูผู้สอน',
        innovations: Array.isArray(data.innovations) && data.innovations.length === 5 
          ? data.innovations 
          : DEFAULT_INNOVATION_ITEMS,
        stats: {
          totalViews: typeof data.stats?.totalViews === 'number' ? data.stats.totalViews : 0,
          uniqueVisitors: typeof data.stats?.uniqueVisitors === 'number' ? data.stats.uniqueVisitors : 0,
          points: typeof data.stats?.points === 'number' ? data.stats.points : 0,
          averageRating: typeof data.stats?.averageRating === 'number' ? data.stats.averageRating : 0,
          totalRatings: typeof data.stats?.totalRatings === 'number' ? data.stats.totalRatings : 0,
        },
        praises: Array.isArray(data.praises) && data.praises.length > 0 
          ? data.praises 
          : (cached?.praises || DEFAULT_INITIAL_PRAISES),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };

      setCachedUserProfile(loadedProfile);
      return loadedProfile;
    }
  } catch (err) {
    console.error('Failed to load user profile from Firestore:', err);
  }

  // If not yet in Firestore, construct default and persist
  const isMasterWeerapong = email.toLowerCase().trim() === 'weerapong1625@acu.ac.th';
  const defaultProfile: FullUserProfile = cached || {
    email: email,
    fullName: isMasterWeerapong ? '(Admin) ม.วีระพงษ์ มีทรัพย์' : (initialDisplayName || email.split('@')[0]),
    nickname: isMasterWeerapong ? 'ครูปอย' : '',
    school: 'โรงเรียนอัสสัมชัญอุบลราชธานี',
    displayName: initialDisplayName || email.split('@')[0],
    avatarUrl: initialAvatar || '',
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
  // Asynchronously save initial document in background
  saveFullUserProfile(defaultProfile).catch((e) => console.warn('Sync initial profile error:', e));

  return defaultProfile;
}

/**
 * Save Full User Profile to Firestore & Cache
 */
export async function saveFullUserProfile(profile: FullUserProfile): Promise<boolean> {
  setCachedUserProfile(profile);

  try {
    const safeDocId = getSafeDocId(profile.email);
    const profileRef = doc(db, 'user_profiles', safeDocId);

    const payload = {
      email: profile.email,
      fullName: profile.fullName || '',
      nickname: profile.nickname || '',
      school: profile.school || '',
      displayName: profile.displayName || '',
      avatarUrl: profile.avatarUrl || '',
      role: profile.role || 'ครูผู้สอน',
      innovations: profile.innovations || DEFAULT_INNOVATION_ITEMS,
      stats: profile.stats || {
        totalViews: 0,
        uniqueVisitors: 0,
        points: 0,
        averageRating: 0,
        totalRatings: 0,
      },
      praises: profile.praises || DEFAULT_INITIAL_PRAISES,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(profileRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to save full user profile to Firestore:', err);
    return false;
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
 * Increment visit count when viewing profile
 */
export async function recordProfileVisit(profileEmail: string): Promise<void> {
  try {
    const safeDocId = getSafeDocId(profileEmail);
    const profileRef = doc(db, 'user_profiles', safeDocId);
    await updateDoc(profileRef, {
      'stats.totalViews': increment(1),
    });
  } catch {
    // silently ignore if document not ready
  }
}

/**
 * Subscribe to all user profiles in Firestore for Admin Dashboard and Certificate verification
 */
export function subscribeAllUserProfiles(
  callback: (profilesMap: Record<string, FullUserProfile>) => void
): () => void {
  try {
    const colRef = collection(db, 'user_profiles');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const map: Record<string, FullUserProfile> = {};
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.email) {
            const normEmail = d.email.toLowerCase().trim();
            map[normEmail] = {
              email: d.email,
              fullName: d.fullName || d.displayName || d.email.split('@')[0],
              nickname: d.nickname || '',
              school: d.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี',
              displayName: d.displayName || d.fullName || d.email.split('@')[0],
              avatarUrl: d.avatarUrl || '',
              role: d.role || 'ครูผู้สอน',
              innovations: d.innovations || DEFAULT_INNOVATION_ITEMS,
              stats: d.stats || {
                totalViews: 0,
                uniqueVisitors: 0,
                points: 0,
                averageRating: 0,
                totalRatings: 0,
              },
              praises: d.praises || [],
              updatedAt: d.updatedAt,
            };
          }
        });
        callback(map);
      },
      (err) => {
        console.warn('Realtime user profiles subscription fallback:', err);
      }
    );
  } catch (err) {
    console.warn('Error subscribing to all user profiles:', err);
    return () => {};
  }
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

    // 1. Delete user profile document from Firestore
    try {
      const safeDocId = getSafeDocId(normTarget);
      const profileRef = doc(db, 'user_profiles', safeDocId);
      await deleteDoc(profileRef);
      deletedCounts.profile = true;
    } catch (err) {
      console.warn('Could not delete user_profiles doc:', err);
    }

    // 2. Remove from local storage & credentials vault
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${normTarget}`);
        localStorage.removeItem(`acu_user_avatar_${normTarget}`);
      }
      removeUserCredential(normTarget);
    } catch (err) {
      console.warn('Could not clean local storage for user:', err);
    }

    // 3. Delete login logs for this user if requested
    if (options.deleteLogs) {
      try {
        const logsCol = collection(db, 'login_logs');
        const logsSnap = await getDocs(logsCol);
        const userLogDocs = logsSnap.docs.filter((d) => {
          const email = (d.data().email || '').trim().toLowerCase();
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

    // 4. Delete innovation submissions if requested
    if (options.deleteSubmissions) {
      try {
        const innovCol = collection(db, 'teacher_innovations_submissions');
        const innovSnap = await getDocs(innovCol);
        const userInnovDocs = innovSnap.docs.filter((d) => {
          const email = (d.data().userEmail || '').trim().toLowerCase();
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

    // 5. Delete facility records in system_test_submissions if requested
    if (options.deleteFacilities || options.deleteSubmissions) {
      try {
        const sysCol = collection(db, 'system_test_submissions');
        const sysSnap = await getDocs(sysCol);
        const userSysDocs = sysSnap.docs.filter((d) => {
          const email = (d.data().userEmail || '').trim().toLowerCase();
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

    // 6. Delete teacher media repository works if requested
    if (options.deleteMedia) {
      try {
        const mediaCol = collection(db, 'teacher_media_repository');
        const mediaSnap = await getDocs(mediaCol);
        const userMediaDocs = mediaSnap.docs.filter((d) => {
          const email = (d.data().submittedByEmail || '').trim().toLowerCase();
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
    // 1. Fetch all documents across all 5 major collections
    const [profilesSnap, logsSnap, innovSnap, sysSnap, mediaSnap] = await Promise.all([
      getDocs(collection(db, 'user_profiles')),
      getDocs(collection(db, 'login_logs')),
      getDocs(collection(db, 'teacher_innovations_submissions')),
      getDocs(collection(db, 'system_test_submissions')),
      getDocs(collection(db, 'teacher_media_repository')),
    ]);

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
      if (rawEmail !== normEmail) {
        normalizedCount++;
        await updateDoc(docSnap.ref, { submittedByEmail: normEmail });
      }
    }

    // F. Reconcile & Create missing user_profiles
    for (const [normEmail, record] of uniqueEmailsMap.entries()) {
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

