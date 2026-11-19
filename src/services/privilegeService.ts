import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { ADMIN_TARGET_EMAIL } from './submissionService';
import { getCleanRealName } from './userProfileService';

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

/**
 * Get safe document id for user email
 */
export function getClaimDocId(email: string): string {
  return `claim_${encodeURIComponent(email.trim().toLowerCase())}`;
}

/**
 * Subscribe to a single user's privilege status in real time
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
  let claimData: RewardClaimRecord | null = null;
  let teacherDisplayName = userEmail.split('@')[0];

  const computeAndEmit = () => {
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

  // 1. Listen to shared ideas
  const unsubIdeas = onSnapshot(
    query(collection(db, 'shared_ideas'), where('creatorEmail', '==', normEmail)),
    (snap) => {
      ideasList = [];
      snap.forEach((d) => {
        const data = d.data();
        ideasList.push({
          id: d.id,
          title: data.title || 'แชร์แหล่งการเรียนรู้/ไอเดีย',
          source: 'idea',
          sourceLabel: 'คลังไอเดีย/แหล่งเรียนรู้',
          category: data.categoryLabel || data.category || 'แหล่งการเรียนรู้',
          url: data.url || '',
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });
      computeAndEmit();
    },
    () => computeAndEmit()
  );

  // 2. Listen to innovation submissions (5 items)
  const unsubInnovations = onSnapshot(
    query(collection(db, 'teacher_innovations_submissions'), where('userEmail', '==', normEmail)),
    (snap) => {
      innovationsList = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.teacherName) teacherDisplayName = data.teacherName;
        innovationsList.push({
          id: d.id,
          title: data.mediaTitle ? `สื่อนวัตกรรม ชิ้นที่ ${data.itemNumber || 1}: ${data.mediaTitle}` : 'สื่อนวัตกรรมการจัดการเรียนรู้',
          source: 'innovation',
          sourceLabel: 'สื่อนวัตกรรมการสอน 5 ชิ้น',
          category: data.mediaType || data.gradeLevel || 'สื่อนวัตกรรม',
          url: data.onlineUrl || '',
          createdAt: data.submittedAt || new Date().toISOString(),
        });
      });
      computeAndEmit();
    },
    () => computeAndEmit()
  );

  // 3. Listen to facility usage records (33 learning centers)
  const unsubFacilities = onSnapshot(
    query(collection(db, 'system_test_submissions'), where('userEmail', '==', normEmail)),
    (snap) => {
      facilitiesList = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.learningCenter) {
          if (data.teacherName) teacherDisplayName = data.teacherName;
          facilitiesList.push({
            id: d.id,
            title: `บันทึกการใช้ ${data.learningCenter}`,
            source: 'facility',
            sourceLabel: 'แหล่งเรียนรู้ 33 แห่ง',
            category: data.subjectGroup || 'แหล่งเรียนรู้ในโรงเรียน',
            createdAt: data.createdAt || data.usageDateTime || new Date().toISOString(),
          });
        }
      });
      computeAndEmit();
    },
    () => computeAndEmit()
  );

  // 4. Listen to teacher media repository (self-produced media)
  const unsubMedia = onSnapshot(
    query(collection(db, 'teacher_media_repository'), where('submittedByEmail', '==', normEmail)),
    (snap) => {
      mediaList = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.title && !d.id.startsWith('seed-')) {
          mediaList.push({
            id: d.id,
            title: data.title,
            source: 'media',
            sourceLabel: 'คลังสื่อผลิตเอง',
            category: data.subjectGroup || data.mediaType || 'คลังสื่อ',
            url: data.onlineUrl || '',
            createdAt: data.createdAt || new Date().toISOString(),
          });
        }
      });
      computeAndEmit();
    },
    () => computeAndEmit()
  );

  // 5. Listen to reward claim doc
  const docRef = doc(db, CLAIMS_COLLECTION, getClaimDocId(normEmail));
  const unsubClaim = onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        claimData = snap.data() as RewardClaimRecord;
      } else {
        claimData = null;
      }
      computeAndEmit();
    },
    () => computeAndEmit()
  );

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

    const payload = {
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

    await setDoc(docRef, payload);
    return { success: true, id };
  } catch (err: any) {
    console.error('Failed to quick share educational resource:', err);
    return { success: false, error: err?.message || 'แชร์แหล่งการเรียนรู้ไม่สำเร็จ' };
  }
}

/**
 * Subscribe to ALL teachers' privilege and rewards status for the Admin Dashboard
 */
export function subscribeAllTeachersPrivilegeStatus(
  onUpdate: (summaries: TeacherPrivilegeAdminItem[]) => void
): () => void {
  let allIdeas: { creatorEmail: string; post: SharedPostItem }[] = [];
  let allInnovations: { userEmail: string; teacherName?: string; gradeLevel?: string; post: SharedPostItem }[] = [];
  let allFacilities: { userEmail: string; teacherName?: string; subjectGroup?: string; post: SharedPostItem }[] = [];
  let allMedia: { submittedByEmail: string; post: SharedPostItem }[] = [];
  let claimsMap: Record<string, RewardClaimRecord> = {};
  let profilesMap: Record<string, any> = {};

  const computeAll = () => {
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

  // 1. Shared ideas
  const unsubIdeas = onSnapshot(
    collection(db, 'shared_ideas'),
    (snap) => {
      allIdeas = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.creatorEmail) {
          allIdeas.push({
            creatorEmail: data.creatorEmail.trim().toLowerCase(),
            post: {
              id: d.id,
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
    },
    () => computeAll()
  );

  // 2. Innovations
  const unsubInnov = onSnapshot(
    collection(db, 'teacher_innovations_submissions'),
    (snap) => {
      allInnovations = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.userEmail) {
          allInnovations.push({
            userEmail: data.userEmail.trim().toLowerCase(),
            teacherName: data.teacherName,
            gradeLevel: data.gradeLevel,
            post: {
              id: d.id,
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
    },
    () => computeAll()
  );

  // 3. Facilities
  const unsubFac = onSnapshot(
    collection(db, 'system_test_submissions'),
    (snap) => {
      allFacilities = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.userEmail && data.learningCenter) {
          allFacilities.push({
            userEmail: data.userEmail.trim().toLowerCase(),
            teacherName: data.teacherName,
            subjectGroup: data.subjectGroup,
            post: {
              id: d.id,
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
    },
    () => computeAll()
  );

  // 4. Teacher Media Repository
  const unsubMedia = onSnapshot(
    collection(db, 'teacher_media_repository'),
    (snap) => {
      allMedia = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.submittedByEmail && !d.id.startsWith('seed-')) {
          allMedia.push({
            submittedByEmail: data.submittedByEmail.trim().toLowerCase(),
            post: {
              id: d.id,
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
    },
    () => computeAll()
  );

  // 5. Reward claims
  const unsubClaims = onSnapshot(
    collection(db, CLAIMS_COLLECTION),
    (snap) => {
      claimsMap = {};
      snap.forEach((d) => {
        const data = d.data() as RewardClaimRecord;
        if (data.userEmail) {
          claimsMap[data.userEmail.trim().toLowerCase()] = data;
        }
      });
      computeAll();
    },
    () => computeAll()
  );

  // 6. User profiles for real names and roles
  const unsubProfiles = onSnapshot(
    collection(db, 'user_profiles'),
    (snap) => {
      profilesMap = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data.email) {
          profilesMap[data.email.trim().toLowerCase()] = data;
        }
      });
      computeAll();
    },
    () => computeAll()
  );

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
