import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, isQuotaExceededError, notifyQuotaExceeded } from '../firebase';
import {
  subscribeSharedIdeas,
  subscribeAllInnovations,
  subscribeAllSubmissions,
  subscribeTeacherMedia,
  saveSharedIdea,
  SharedIdeaItem,
  InnovationSubmission,
  FacilitySubmission,
  TeacherMediaWork,
} from './submissionService';
import { getCleanRealName, subscribeAllUserProfiles, FullUserProfile } from './userProfileService';

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

// Multiplexed reward claims listener + cached summaries for 0ms opening
let sharedLatestClaimsMap: Record<string, RewardClaimRecord> | null = null;
const claimsListeners = new Set<(map: Record<string, RewardClaimRecord>) => void>();
let unsubSharedClaimsFs: (() => void) | null = null;
let sharedLatestPrivilegeSummaries: TeacherPrivilegeAdminItem[] | null = null;

function broadcastClaimsMap(map: Record<string, RewardClaimRecord>): void {
  sharedLatestClaimsMap = map;
  claimsListeners.forEach((cb) => {
    try {
      cb(map);
    } catch (e) {
      console.warn('Claims listener error:', e);
    }
  });
}

function subscribeAllClaimsMap(cb: (map: Record<string, RewardClaimRecord>) => void): () => void {
  claimsListeners.add(cb);
  if (sharedLatestClaimsMap) {
    cb(sharedLatestClaimsMap);
  }
  if (!unsubSharedClaimsFs) {
    try {
      unsubSharedClaimsFs = onSnapshot(
        collection(db, CLAIMS_COLLECTION),
        (snap) => {
          const map: Record<string, RewardClaimRecord> = {};
          snap.forEach((d) => {
            const data = d.data() as RewardClaimRecord;
            if (data.userEmail) {
              map[data.userEmail.trim().toLowerCase()] = data;
            }
          });
          broadcastClaimsMap(map);
        },
        (err) => {
          if (isQuotaExceededError(err)) notifyQuotaExceeded();
          broadcastClaimsMap(sharedLatestClaimsMap || {});
        }
      );
    } catch {
      broadcastClaimsMap(sharedLatestClaimsMap || {});
    }
  }
  return () => {
    claimsListeners.delete(cb);
    if (claimsListeners.size === 0 && unsubSharedClaimsFs) {
      try {
        unsubSharedClaimsFs();
      } catch {}
      unsubSharedClaimsFs = null;
    }
  };
}

/**
 * Get safe document id for user email
 */
export function getClaimDocId(email: string): string {
  return `claim_${encodeURIComponent(email.trim().toLowerCase())}`;
}

/**
 * Subscribe to a single user's privilege status in real time
 * Reuses already-multiplexed shared collections for instant 0ms rendering & zero extra collection reads.
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

  let ideasList: SharedPostItem[] = [];
  let innovationsList: SharedPostItem[] = [];
  let facilitiesList: SharedPostItem[] = [];
  let mediaList: SharedPostItem[] = [];
  let claimData: RewardClaimRecord | null = sharedLatestClaimsMap?.[normEmail] || null;
  let teacherDisplayName = userEmail.split('@')[0];
  let scheduled = false;

  const computeAndEmit = () => {
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

  const scheduleCompute = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      computeAndEmit();
    });
  };

  const unsubIdeas = subscribeSharedIdeas((all: SharedIdeaItem[]) => {
    ideasList = all
      .filter((d) => (d.creatorEmail || '').trim().toLowerCase() === normEmail && !d.id.startsWith('idea-seed-'))
      .map((d) => ({
        id: d.id,
        title: d.title || 'แชร์แหล่งการเรียนรู้/ไอเดีย',
        source: 'idea' as const,
        sourceLabel: 'คลังไอเดีย/แหล่งเรียนรู้',
        category: d.categoryLabel || d.category || 'แหล่งการเรียนรู้',
        url: d.url || '',
        createdAt: d.createdAt || new Date().toISOString(),
      }));
    scheduleCompute();
  });

  const unsubInnovations = subscribeAllInnovations((all: InnovationSubmission[]) => {
    innovationsList = all
      .filter((d) => (d.userEmail || '').trim().toLowerCase() === normEmail)
      .map((d) => {
        if (d.teacherName) teacherDisplayName = d.teacherName;
        return {
          id: d.id,
          title: d.mediaTitle ? `สื่อนวัตกรรม ชิ้นที่ ${d.itemNumber || 1}: ${d.mediaTitle}` : 'สื่อนวัตกรรมการจัดการเรียนรู้',
          source: 'innovation' as const,
          sourceLabel: 'สื่อนวัตกรรมการสอน 5 ชิ้น',
          category: d.mediaType || d.gradeLevel || 'สื่อนวัตกรรม',
          url: d.onlineUrl || '',
          createdAt: d.submittedAt || new Date().toISOString(),
        };
      });
    scheduleCompute();
  });

  const unsubFacilities = subscribeAllSubmissions((all: FacilitySubmission[]) => {
    facilitiesList = all
      .filter((d) => (d.userEmail || '').trim().toLowerCase() === normEmail && Boolean(d.learningCenter))
      .map((d) => {
        if (d.teacherName) teacherDisplayName = d.teacherName;
        return {
          id: d.id,
          title: `บันทึกการใช้ ${d.learningCenter}`,
          source: 'facility' as const,
          sourceLabel: 'แหล่งเรียนรู้ 33 แห่ง',
          category: d.subjectGroup || 'แหล่งเรียนรู้ในโรงเรียน',
          createdAt: d.createdAt || d.usageDateTime || new Date().toISOString(),
        };
      });
    scheduleCompute();
  });

  const unsubMedia = subscribeTeacherMedia((all: TeacherMediaWork[]) => {
    mediaList = all
      .filter((d) => (d.submittedByEmail || '').trim().toLowerCase() === normEmail && Boolean(d.title) && !d.id.startsWith('seed-'))
      .map((d) => ({
        id: d.id,
        title: d.title,
        source: 'media' as const,
        sourceLabel: 'คลังสื่อผลิตเอง',
        category: d.subjectGroup || d.mediaType || 'คลังสื่อ',
        url: d.onlineUrl || '',
        createdAt: d.createdAt || new Date().toISOString(),
      }));
    scheduleCompute();
  });

  const docRef = doc(db, CLAIMS_COLLECTION, getClaimDocId(normEmail));
  const unsubClaim = onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        claimData = snap.data() as RewardClaimRecord;
      } else {
        claimData = null;
      }
      scheduleCompute();
    },
    () => scheduleCompute()
  );

  // Emit initial state synchronously right away from multiplexed RAM caches
  computeAndEmit();

  return () => {
    unsubIdeas();
    unsubInnovations();
    unsubFacilities();
    unsubMedia();
    unsubClaim();
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
    if (sharedLatestClaimsMap) {
      broadcastClaimsMap({ ...sharedLatestClaimsMap, [normEmail]: payload });
    }
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
    if (sharedLatestClaimsMap) {
      const existing = sharedLatestClaimsMap[normEmail] || ({} as RewardClaimRecord);
      broadcastClaimsMap({
        ...sharedLatestClaimsMap,
        [normEmail]: { ...existing, ...updatePayload } as RewardClaimRecord,
      });
    }
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
  return saveSharedIdea({
    title: data.title,
    description: data.description.trim() || 'แชร์แหล่งการเรียนรู้เพื่อการพัฒนาคุณภาพการศึกษาและสิทธิพิเศษคลังสื่อ',
    category: 'resource_share',
    categoryLabel: data.category || 'แหล่งการเรียนรู้/สื่อนวัตกรรม',
    url: data.url,
    tags: ['สิทธิพิเศษคลังสื่อ', 'แชร์แหล่งเรียนรู้', '20โพสต์รับรางวัล'],
    creatorEmail: data.userEmail,
    creatorName: data.teacherName,
  });
}

/**
 * Subscribe to ALL teachers' privilege and rewards status for the Admin Dashboard
 * Uses shared multiplexed streams + O(N) Map grouping + instant 0ms cached emit.
 */
export function subscribeAllTeachersPrivilegeStatus(
  onUpdate: (summaries: TeacherPrivilegeAdminItem[]) => void
): () => void {
  if (sharedLatestPrivilegeSummaries) {
    onUpdate(sharedLatestPrivilegeSummaries);
  }

  let allIdeas: SharedIdeaItem[] = [];
  let allInnovations: InnovationSubmission[] = [];
  let allFacilities: FacilitySubmission[] = [];
  let allMedia: TeacherMediaWork[] = [];
  let claimsMap: Record<string, RewardClaimRecord> = sharedLatestClaimsMap || {};
  let profilesMap: Record<string, FullUserProfile> = {};
  let scheduled = false;

  const computeAll = () => {
    const postsByEmail = new Map<string, Map<string, SharedPostItem>>();
    const innovMetaByEmail = new Map<string, { teacherName?: string; gradeLevel?: string }>();
    const facMetaByEmail = new Map<string, { teacherName?: string; subjectGroup?: string }>();
    const allEmails = new Set<string>();

    const addPost = (rawEmail: string | undefined, post: SharedPostItem) => {
      const em = (rawEmail || '').trim().toLowerCase();
      if (!em) return;
      allEmails.add(em);
      let emailPosts = postsByEmail.get(em);
      if (!emailPosts) {
        emailPosts = new Map<string, SharedPostItem>();
        postsByEmail.set(em, emailPosts);
      }
      emailPosts.set(post.id, post);
    };

    for (const i of allIdeas) {
      if (!i.creatorEmail || i.id.startsWith('idea-seed-')) continue;
      addPost(i.creatorEmail, {
        id: i.id,
        title: i.title || 'แชร์แหล่งการเรียนรู้/ไอเดีย',
        source: 'idea',
        sourceLabel: 'คลังไอเดีย/แหล่งเรียนรู้',
        category: i.categoryLabel || i.category || 'แหล่งการเรียนรู้',
        url: i.url || '',
        createdAt: i.createdAt || '',
      });
    }

    for (const i of allInnovations) {
      if (!i.userEmail) continue;
      const em = i.userEmail.trim().toLowerCase();
      if (i.teacherName && !innovMetaByEmail.has(em)) {
        innovMetaByEmail.set(em, { teacherName: i.teacherName, gradeLevel: i.gradeLevel });
      }
      addPost(em, {
        id: i.id,
        title: i.mediaTitle ? `สื่อนวัตกรรม ชิ้นที่ ${i.itemNumber || 1}: ${i.mediaTitle}` : 'สื่อนวัตกรรมการจัดการเรียนรู้',
        source: 'innovation',
        sourceLabel: 'สื่อนวัตกรรมการสอน 5 ชิ้น',
        category: i.mediaType || i.gradeLevel || 'สื่อนวัตกรรม',
        url: i.onlineUrl || '',
        createdAt: i.submittedAt || '',
      });
    }

    for (const f of allFacilities) {
      if (!f.userEmail || !f.learningCenter) continue;
      const em = f.userEmail.trim().toLowerCase();
      if (f.teacherName && !facMetaByEmail.has(em)) {
        facMetaByEmail.set(em, { teacherName: f.teacherName, subjectGroup: f.subjectGroup });
      }
      addPost(em, {
        id: f.id,
        title: `บันทึกการใช้ ${f.learningCenter}`,
        source: 'facility',
        sourceLabel: 'แหล่งเรียนรู้ 33 แห่ง',
        category: f.subjectGroup || 'แหล่งเรียนรู้ในโรงเรียน',
        createdAt: f.createdAt || f.usageDateTime || '',
      });
    }

    for (const m of allMedia) {
      if (!m.submittedByEmail || m.id.startsWith('seed-')) continue;
      addPost(m.submittedByEmail, {
        id: m.id,
        title: m.title || 'คลังสื่อผลิตเอง',
        source: 'media',
        sourceLabel: 'คลังสื่อผลิตเอง',
        category: m.subjectGroup || m.mediaType || 'คลังสื่อ',
        url: m.onlineUrl || '',
        createdAt: m.createdAt || '',
      });
    }

    for (const e of Object.keys(claimsMap)) allEmails.add(e.trim().toLowerCase());
    for (const e of Object.keys(profilesMap)) allEmails.add(e.trim().toLowerCase());

    const resultList: TeacherPrivilegeAdminItem[] = [];

    allEmails.forEach((email) => {
      if (!email) return;
      const emailPostsMap = postsByEmail.get(email);
      const uniquePosts = emailPostsMap ? Array.from(emailPostsMap.values()) : [];
      uniquePosts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      const totalShares = uniquePosts.length;
      const isEligible = totalShares >= TARGET_SHARE_COUNT;
      const progressPercent = Math.min(100, Math.round((totalShares / TARGET_SHARE_COUNT) * 100));

      const claim = claimsMap[email];
      const profile = profilesMap[email];
      const innovMatch = innovMetaByEmail.get(email);
      const facMatch = facMetaByEmail.get(email);

      const rawName = claim?.teacherName || profile?.fullName || innovMatch?.teacherName || facMatch?.teacherName || profile?.displayName || email.split('@')[0];
      const name = getCleanRealName(rawName, email);
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
        updatedAt: claim?.updatedAt || '',
        posts: uniquePosts,
      });
    });

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

    sharedLatestPrivilegeSummaries = resultList;
    onUpdate(resultList);
  };

  const scheduleCompute = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      computeAll();
    });
  };

  const unsubIdeas = subscribeSharedIdeas((list) => {
    allIdeas = list;
    scheduleCompute();
  });

  const unsubInnov = subscribeAllInnovations((list) => {
    allInnovations = list;
    scheduleCompute();
  });

  const unsubFac = subscribeAllSubmissions((list) => {
    allFacilities = list;
    scheduleCompute();
  });

  const unsubMedia = subscribeTeacherMedia((list) => {
    allMedia = list;
    scheduleCompute();
  });

  const unsubClaims = subscribeAllClaimsMap((map) => {
    claimsMap = map;
    scheduleCompute();
  });

  const unsubProfiles = subscribeAllUserProfiles((map) => {
    profilesMap = map;
    scheduleCompute();
  });

  return () => {
    unsubIdeas();
    unsubInnov();
    unsubFac();
    unsubMedia();
    unsubClaims();
    unsubProfiles();
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
