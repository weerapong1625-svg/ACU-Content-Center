import { doc, getDoc, setDoc, updateDoc, arrayUnion, increment, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

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
    fullName: isMasterWeerapong ? 'มาสเตอร์วีระพงศ์ คำสอน' : (initialDisplayName || email.split('@')[0]),
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
