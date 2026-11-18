import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  increment 
} from 'firebase/firestore';
import { db, isQuotaExceededError, notifyQuotaExceeded } from '../firebase';

export const ADMIN_TARGET_EMAIL = 'weerapong1625@acu.ac.th';

// =========================================================================
// 1. ส่งสื่อ/นวัตกรรม 5 ชิ้น (Innovation Submissions)
// =========================================================================

export const GRADE_LEVELS = [
  'ปฐมวัย',
  'ประถมศึกษาปีที่ 1',
  'ประถมศึกษาปีที่ 2',
  'ประถมศึกษาปีที่ 3',
  'ประถมศึกษาปีที่ 4',
  'ประถมศึกษาปีที่ 5',
  'ประถมศึกษาปีที่ 6',
  'มัธยมศึกษาปีที่ 1',
  'มัธยมศึกษาปีที่ 2',
  'มัธยมศึกษาปีที่ 3',
  'มัธยมศึกษาปีที่ 4',
  'มัธยมศึกษาปีที่ 5',
  'มัธยมศึกษาปีที่ 6',
] as const;

export const MEDIA_ITEM_NUMBERS = [1, 2, 3, 4, 5] as const;

export const INNOVATION_MEDIA_TYPES = [
  'สื่อสิ่งพิมพ์',
  'สื่อเทคโนโลยี',
  'สื่ออื่น ๆ',
] as const;

export const PRODUCTION_TYPES = [
  'ครูผลิตสื่อเอง',
  'ครูนำสื่อจากแหล่งอื่นมาใช้',
] as const;

// Exact 9 Subject Groups requested by user (กลุ่มสาระการเรียนรู้ของครูผู้สอน)
export const SUBJECT_GROUPS = [
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

export interface InnovationSubmission {
  id: string;
  teacherName: string;
  subjectGroup?: string; // กลุ่มสาระการเรียนรู้ของครูผู้สอน (9 กลุ่มสาระ)
  gradeLevel: string;
  itemNumber: number; // 1 to 5
  mediaTitle: string;
  mediaType: string; // สื่อสิ่งพิมพ์ | สื่อเทคโนโลยี | สื่ออื่น ๆ
  productionType: string; // ครูผลิตสื่อเอง | ครูนำสื่อจากแหล่งอื่นมาใช้
  usageDetails: string; // 1)วิชา 2)หน่วยการเรียนรู้
  onlineUrl?: string; // URL สื่อ
  imageUrl?: string; // ไฟล์สื่อรูปภาพ
  coverImageUrl?: string; // ภาพปกชิ้นงาน
  userEmail: string;
  status: 'ส่งเรียบร้อย' | 'อนุมัติแล้ว' | 'รอตรวจสอบ';
  submittedAt: string;
  updatedAt?: string;
}

// =========================================================================
// 2. บันทึกแหล่งเรียนรู้ภายในโรงเรียน (Facility Submissions - 33 แหล่ง, 9 คาบ)
// =========================================================================

// Exact 33 Learning Centers / Facilities requested by user
export const LEARNING_CENTERS = [
  '1. ห้องคอมพิวเตอร์ 1 (มัธยมต้น)',
  '2. ห้องคอมพิวเตอร์ 2 (มัธยมปลาย)',
  '3. ห้องคอมพิวเตอร์ 3 (ประถมต้น)',
  '4. ห้องคอมพิวเตอร์ 4 (ประถมปลาย)',
  '5. ห้องปฏิบัติการ iPad 1',
  '6. ห้องปฏิบัติการ iPad 2',
  '7. ห้องปฏิบัติการ Robot',
  '8. ห้องสมุดสิรินธร',
  '9. ห้อง Learning Space',
  '10. ห้อง Co-Working Space 1',
  '11. ห้อง Co-Working Space 2',
  '12. ห้อง Co-Working Space 3',
  '13. ห้องนาฏศิลป์',
  '14. ห้อง Art Room (ศิลปะ)',
  '15. ห้องแลปเรียนรู้วิทยาศาสตร์ (ประถม) อาคารสัพพัญญู',
  '16. ห้องงานแนะแนว',
  '17. ห้องปฏิบัติการชีววิทยา',
  '18. ห้องปฏิบัติการเคมี',
  '19. ห้องปฏิบัติการฟิสิกส์-โลกและอวกาศ',
  '20. ห้องศูนย์ภาษาจีนและวัฒนธรรมจีน',
  '21. สนามฟุตบอล',
  '22. สนามฟุตซอล',
  '23. สนามบาสเกตบอล',
  '24. สนามวอลเลย์บอล',
  '25. สระว่ายน้ำ',
  '26. ห้องวงโยธวาทิต',
  '27. ห้อง Cover Dance',
  '28. ห้องปฏิบัติการกลอง',
  '29. ห้องปฏิบัติการเปียโน',
  '30. ห้องปฏิบัติการคีย์บอร์ด',
  '31. ห้องปฏิบัติการร้องเพลง',
  '32. ห้องปฏิบัติการอูคูเลเล่',
  '33. ห้องปฏิบัติการกีตาร์',
] as const;

// Exact 9 Periods requested
export const PERIODS_LIST = [
  'คาบเรียนที่ 1',
  'คาบเรียนที่ 2',
  'คาบเรียนที่ 3',
  'คาบเรียนที่ 4',
  'คาบเรียนที่ 5',
  'คาบเรียนที่ 6',
  'คาบเรียนที่ 7',
  'คาบเรียนที่ 8',
  'คาบเรียนที่ 9',
] as const;

export interface FacilitySubmission {
  id: string;
  teacherName: string;
  subjectGroup: string;
  learningCenter: string;
  periods: string[];
  usageDateTime: string;
  feedback: string;
  imageUrl?: string;
  userEmail: string;
  status: 'บันทึกสำเร็จ' | 'ส่งเรียบร้อย' | 'รอตรวจสอบ';
  createdAt: string;
  updatedAt?: string;
}

// =========================================================================
// 3. คลังสื่อคุณครูผลิตเอง (Teacher Media Repository)
// =========================================================================

export interface TeacherMediaWork {
  id: string;
  title: string;
  teacherName: string;
  subjectGroup: string;
  gradeLevel?: string;
  subjectName: string;
  thumbnailUrl: string;
  description: string;
  mediaType: string;
  productionType?: string;
  itemNumber?: number; // 1 to 5
  onlineUrl?: string;
  ratingAvg: number;
  ratingCount: number;
  views: number;
  likes?: number;
  likedBy?: string[];
  userRatings?: { [emailKey: string]: number };
  submittedByEmail?: string;
  createdAt: string;
}

/**
 * Check if the user has permission to modify/delete a resource.
 * Admin (weerapong1625@acu.ac.th) can modify all resources from everyone.
 * Individual teachers can only modify their own resources.
 */
export function canUserModify(targetOwnerEmail?: string, currentUserEmail?: string): boolean {
  if (!currentUserEmail) return false;
  const current = currentUserEmail.trim().toLowerCase();
  const admin = ADMIN_TARGET_EMAIL.toLowerCase();
  if (current === admin) return true;
  if (!targetOwnerEmail) return false;
  return targetOwnerEmail.trim().toLowerCase() === current;
}

// =========================================================================
// FIREBASE OPERATIONS: 1. ส่งสื่อ/นวัตกรรม 5 ชิ้น
// =========================================================================

const INNOVATIONS_COLLECTION = 'teacher_innovations_submissions';
const SYSTEM_TEST_COLLECTION = 'system_test_submissions';
const TEACHER_MEDIA_COLLECTION = 'teacher_media_repository';

export const INNOVATIONS_STORAGE_KEY = 'acu_cached_innovations_submissions';
export const TEACHER_MEDIA_STORAGE_KEY = 'acu_cached_teacher_media';
export const FACILITY_STORAGE_KEY = 'acu_cached_facility_submissions';
export const SHARED_IDEAS_STORAGE_KEY = 'acu_cached_shared_ideas';

/**
 * Legacy hardcoded seed IDs that previously caused false "submitted" status
 * for weerapong1625@acu.ac.th — stripped cleanly without touching other users' data.
 */
export const LEGACY_FAKE_SEED_IDS = new Set<string>([
  'innov_weerapong_item1',
  'innov_weerapong_item2',
  'innov_weerapong_item3',
  'innov_weerapong_item4',
  'innov_weerapong_item5',
  'work_innov_weerapong_item1',
  'work_innov_weerapong_item2',
  'work_innov_weerapong_item3',
  'work_innov_weerapong_item4',
  'work_innov_weerapong_item5',
]);

export const DEFAULT_RESTORED_INNOVATIONS: InnovationSubmission[] = [];

export const DEFAULT_RESTORED_TEACHER_MEDIA: TeacherMediaWork[] = [];

// =========================================================================
// SHARED MULTIPLEXED IN-MEMORY CACHE & REFERENCE-COUNTED FIRESTORE STREAMS
// =========================================================================

let sharedLatestInnovations: InnovationSubmission[] | null = null;
const innovationsListeners = new Set<(list: InnovationSubmission[]) => void>();
let unsubSharedInnovationsFs: (() => void) | null = null;

let sharedLatestFacilities: FacilitySubmission[] | null = null;
const facilitiesListeners = new Set<(list: FacilitySubmission[]) => void>();
let unsubSharedFacilitiesFs: (() => void) | null = null;

let sharedLatestTeacherMedia: TeacherMediaWork[] | null = null;
const teacherMediaListeners = new Set<(list: TeacherMediaWork[]) => void>();
let unsubSharedTeacherMediaFs: (() => void) | null = null;

let sharedLatestSharedIdeas: SharedIdeaItem[] | null = null;
const sharedIdeasListeners = new Set<(list: SharedIdeaItem[]) => void>();
let unsubSharedIdeasFs: (() => void) | null = null;

function safeSaveCacheList<T extends Record<string, any>>(storageKey: string, list: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(list));
  } catch {
    // Fallback if QuotaExceededError due to oversized base64 data URIs: preserve records with lightweight fallback image
    try {
      const stripped = list.map((item) => {
        const copy: any = { ...item };
        if (typeof copy.imageUrl === 'string' && copy.imageUrl.length > 60000) copy.imageUrl = '';
        if (typeof copy.coverImageUrl === 'string' && copy.coverImageUrl.length > 60000) copy.coverImageUrl = '';
        if (typeof copy.thumbnailUrl === 'string' && copy.thumbnailUrl.length > 60000) copy.thumbnailUrl = '/acu_active_logo.png';
        return copy;
      });
      localStorage.setItem(storageKey, JSON.stringify(stripped));
    } catch {
      // ignore if browser storage is completely full
    }
  }
}

function broadcastInnovations(list: InnovationSubmission[]): void {
  sharedLatestInnovations = list;
  innovationsListeners.forEach((cb) => {
    try {
      cb(list);
    } catch (e) {
      console.warn('Innovations listener error:', e);
    }
  });
}

function broadcastFacilities(list: FacilitySubmission[]): void {
  sharedLatestFacilities = list;
  facilitiesListeners.forEach((cb) => {
    try {
      cb(list);
    } catch (e) {
      console.warn('Facilities listener error:', e);
    }
  });
}

function broadcastTeacherMedia(list: TeacherMediaWork[]): void {
  sharedLatestTeacherMedia = list;
  teacherMediaListeners.forEach((cb) => {
    try {
      cb(list);
    } catch (e) {
      console.warn('TeacherMedia listener error:', e);
    }
  });
}

function broadcastSharedIdeas(list: SharedIdeaItem[]): void {
  sharedLatestSharedIdeas = list;
  sharedIdeasListeners.forEach((cb) => {
    try {
      cb(list);
    } catch (e) {
      console.warn('SharedIdeas listener error:', e);
    }
  });
}

function notifyInnovationsChanged(): void {
  try {
    const current = sharedLatestInnovations || getStoredInnovations();
    broadcastInnovations(current);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_innovations_changed'));
    }
  } catch {
    // ignore
  }
}

function notifyFacilitiesChanged(): void {
  try {
    const current = sharedLatestFacilities || getStoredFacilities();
    broadcastFacilities(current);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_facilities_changed'));
    }
  } catch {
    // ignore
  }
}

function notifyTeacherMediaChanged(): void {
  try {
    const current = sharedLatestTeacherMedia || getStoredTeacherMedia();
    broadcastTeacherMedia(current);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_teacher_media_changed'));
    }
  } catch {
    // ignore
  }
}

function notifySharedIdeasChanged(): void {
  try {
    const current = sharedLatestSharedIdeas || getStoredSharedIdeas();
    broadcastSharedIdeas(current);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_shared_ideas_changed'));
    }
  } catch {
    // ignore
  }
}

/**
 * Get cached innovations from localStorage (stripping legacy fake seed IDs)
 */
export function getStoredInnovations(): InnovationSubmission[] {
  if (sharedLatestInnovations) return sharedLatestInnovations;
  try {
    const raw = localStorage.getItem(INNOVATIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((item: InnovationSubmission) => item && !LEGACY_FAKE_SEED_IDS.has(item.id));
        if (cleaned.length !== parsed.length) {
          saveStoredInnovations(cleaned);
        }
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('Failed to read innovations cache:', err);
  }
  return [];
}

/**
 * Save innovations to RAM + localStorage cache
 */
export function saveStoredInnovations(list: InnovationSubmission[]): void {
  const cleaned = list.filter((item) => item && !LEGACY_FAKE_SEED_IDS.has(item.id));
  sharedLatestInnovations = cleaned;
  safeSaveCacheList(INNOVATIONS_STORAGE_KEY, cleaned);
}

/**
 * Get cached facilities from localStorage
 */
export function getStoredFacilities(): FacilitySubmission[] {
  if (sharedLatestFacilities) return sharedLatestFacilities;
  try {
    const raw = localStorage.getItem(FACILITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((f: FacilitySubmission) => f && Boolean(f.learningCenter));
      }
    }
  } catch (err) {
    console.warn('Failed to read facilities cache:', err);
  }
  return [];
}

export function saveStoredFacilities(list: FacilitySubmission[]): void {
  const cleaned = list.filter((f) => f && Boolean(f.learningCenter));
  sharedLatestFacilities = cleaned;
  safeSaveCacheList(FACILITY_STORAGE_KEY, cleaned);
}

/**
 * Get cached teacher media from localStorage (stripping legacy fake seed IDs)
 */
export function getStoredTeacherMedia(): TeacherMediaWork[] {
  if (sharedLatestTeacherMedia) return sharedLatestTeacherMedia;
  try {
    const raw = localStorage.getItem(TEACHER_MEDIA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((item: TeacherMediaWork) => item && !item.id?.startsWith('seed-') && !LEGACY_FAKE_SEED_IDS.has(item.id) && item.title?.trim().length > 0);
        if (cleaned.length !== parsed.length) {
          saveStoredTeacherMedia(cleaned);
        }
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('Failed to read teacher media cache:', err);
  }
  return [];
}

/**
 * Save teacher media to RAM + localStorage cache
 */
export function saveStoredTeacherMedia(list: TeacherMediaWork[]): void {
  const cleaned = list.filter((item) => item && !item.id?.startsWith('seed-') && !LEGACY_FAKE_SEED_IDS.has(item.id) && item.title?.trim().length > 0);
  sharedLatestTeacherMedia = cleaned;
  safeSaveCacheList(TEACHER_MEDIA_STORAGE_KEY, cleaned);
}

export function getStoredSharedIdeas(): SharedIdeaItem[] {
  if (sharedLatestSharedIdeas) return sharedLatestSharedIdeas;
  try {
    const raw = localStorage.getItem(SHARED_IDEAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((i: SharedIdeaItem) => sanitizeSharedIdeaRecord(i));
      }
    }
  } catch {}
  return DEFAULT_SEED_IDEAS;
}

export function saveStoredSharedIdeas(list: SharedIdeaItem[]): void {
  sharedLatestSharedIdeas = list;
  safeSaveCacheList(SHARED_IDEAS_STORAGE_KEY, list);
}

/**
 * Keep restore API for backwards compatibility without injecting fake submissions
 */
export function restoreTeacherInnovations(targetEmail = 'weerapong1625@acu.ac.th'): {
  success: boolean;
  count: number;
} {
  try {
    const current = getStoredInnovations();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_innovations_restored', { detail: { email: targetEmail } }));
    }
    return { success: true, count: current.length };
  } catch (err) {
    console.warn('restoreTeacherInnovations error:', err);
    return { success: false, count: 0 };
  }
}

/**
 * Save innovation submission to Firebase project: System Test
 * Dual-write: updates local storage cache immediately so submission is NEVER lost!
 */
export async function saveInnovationSubmission(data: {
  teacherName: string;
  subjectGroup?: string;
  gradeLevel: string;
  itemNumber: number;
  mediaTitle: string;
  mediaType: string;
  productionType: string;
  usageDetails: string;
  onlineUrl?: string;
  imageUrl?: string;
  userEmail: string;
}): Promise<{ success: boolean; id: string; error?: string }> {
  const id = `innov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();
  const selectedSubjectGroup = data.subjectGroup?.trim() || SUBJECT_GROUPS[0];
  const normalizedEmail = data.userEmail.trim().toLowerCase();
  const itemNum = Number(data.itemNumber) || 1;

  const payload: InnovationSubmission = {
    id,
    teacherName: data.teacherName.trim(),
    subjectGroup: selectedSubjectGroup,
    gradeLevel: data.gradeLevel,
    itemNumber: itemNum,
    mediaTitle: data.mediaTitle.trim(),
    mediaType: data.mediaType,
    productionType: data.productionType,
    usageDetails: data.usageDetails.trim(),
    onlineUrl: data.onlineUrl?.trim() || '',
    imageUrl: data.imageUrl || '',
    userEmail: normalizedEmail,
    status: 'ส่งเรียบร้อย',
    submittedAt: nowIso,
    updatedAt: nowIso,
  };

  const mediaDocId = `work_${id}`;
  const mediaPayload: TeacherMediaWork = {
    id: mediaDocId,
    title: data.mediaTitle.trim(),
    teacherName: data.teacherName.trim(),
    subjectGroup: selectedSubjectGroup,
    gradeLevel: data.gradeLevel,
    subjectName: data.usageDetails.trim() || 'สื่อนวัตกรรมการจัดการเรียนรู้',
    thumbnailUrl: data.imageUrl || '/acu_active_logo.png',
    description: `กลุ่มสาระ: ${selectedSubjectGroup} | นำไปใช้: ${data.usageDetails} | ประเภท: ${data.mediaType}${data.productionType ? ` (${data.productionType})` : ''}`,
    mediaType: data.mediaType,
    productionType: data.productionType,
    itemNumber: itemNum,
    onlineUrl: data.onlineUrl?.trim() || '',
    ratingAvg: 5.0,
    ratingCount: 1,
    views: 1,
    likes: 0,
    likedBy: [],
    submittedByEmail: normalizedEmail,
    createdAt: nowIso,
  };

  // 1. Immediately save into local storage caches (guarantees 0% data loss)
  try {
    const currentList = getStoredInnovations();
    const updatedList = [payload, ...currentList.filter((item) => item.id !== id)];
    saveStoredInnovations(updatedList);

    const currentMedia = getStoredTeacherMedia();
    const updatedMedia = [mediaPayload, ...currentMedia.filter((m) => m.id !== mediaDocId)];
    saveStoredTeacherMedia(updatedMedia);
  } catch (cacheErr) {
    console.warn('Local cache save warning:', cacheErr);
  }

  // 2. Write to Firebase Cloud Firestore
  try {
    const docRef = doc(db, INNOVATIONS_COLLECTION, id);
    await setDoc(docRef, payload);

    // Also record in system_test_submissions
    try {
      const sysTestRef = doc(db, SYSTEM_TEST_COLLECTION, `test_${id}`);
      await setDoc(sysTestRef, {
        ...payload,
        sourceModule: 'Innovation_5_Items',
        firebaseProject: 'System Test',
        notifiedAdminEmail: ADMIN_TARGET_EMAIL,
      });
    } catch {}

    // Feed immediately into Teacher Media Repository
    try {
      const mediaRef = doc(db, TEACHER_MEDIA_COLLECTION, mediaDocId);
      await setDoc(mediaRef, mediaPayload, { merge: true });
    } catch {}

    // Update user profile document in user_profiles
    try {
      const safeDocId = encodeURIComponent(normalizedEmail);
      const profileRef = doc(db, 'user_profiles', safeDocId);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const profData = profileSnap.data();
        const currentInnos = Array.isArray(profData.innovations) && profData.innovations.length === 5
          ? [...profData.innovations]
          : [1, 2, 3, 4, 5].map((slot) => ({
              id: slot,
              title: '',
              category: '',
              status: 'pending',
              submittedDate: '-',
              linkUrl: '',
              notes: '',
              coverImageUrl: '',
            }));

        const slotIndex = itemNum - 1;
        if (slotIndex >= 0 && slotIndex < 5) {
          currentInnos[slotIndex] = {
            id: itemNum,
            title: data.mediaTitle.trim(),
            category: data.mediaType,
            status: 'submitted',
            submittedDate: new Date().toLocaleDateString('th-TH', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
            linkUrl: data.onlineUrl?.trim() || '',
            coverImageUrl: data.imageUrl || '',
            notes: `${data.productionType}${data.usageDetails ? ` • ${data.usageDetails}` : ''}`,
          };
          await updateDoc(profileRef, {
            innovations: currentInnos,
            updatedAt: nowIso,
          });
        }
      }
    } catch (profErr) {
      console.warn('Could not sync to user_profiles:', profErr);
    }

    notifyInnovationsChanged();
    notifyTeacherMediaChanged();

    return { success: true, id };
  } catch (error: any) {
    notifyInnovationsChanged();
    notifyTeacherMediaChanged();
    if (isQuotaExceededError(error)) {
      notifyQuotaExceeded();
      console.warn('[Firestore] Quota reached during save: Saved safely in local storage recovery cache.');
      return { success: true, id };
    }
    console.error('Error saving innovation submission:', error);
    // Still return success if local cache succeeded
    return { success: true, id };
  }
}

/**
 * Update an existing innovation submission.
 * Admin can update any submission; teachers can only update their own.
 */
export async function updateInnovationSubmission(
  id: string,
  updates: Partial<InnovationSubmission>,
  currentUserEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, INNOVATIONS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: 'ไม่พบรายการที่ต้องการแก้ไข' };
    }
    const currentData = snap.data() as InnovationSubmission;

    if (!canUserModify(currentData.userEmail, currentUserEmail)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์แก้ไขผลงานของผู้อื่น (สิทธิ์เฉพาะเจ้าของผลงาน หรือ Admin เท่านั้น)' };
    }

    const payload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(docRef, payload);

    // Sync update to system test doc
    try {
      const sysRef = doc(db, SYSTEM_TEST_COLLECTION, `test_${id}`);
      await updateDoc(sysRef, payload);
    } catch {
      // ignore
    }

    // If there is a corresponding media item in teacher media repository, update or create it
    try {
      const mediaDocId = `work_${id}`;
      const mediaRef = doc(db, TEACHER_MEDIA_COLLECTION, mediaDocId);
      const mediaSnap = await getDoc(mediaRef);
      if (mediaSnap.exists()) {
        const mediaUpdate: Partial<TeacherMediaWork> = {};
        if (updates.mediaTitle) mediaUpdate.title = updates.mediaTitle;
        if (updates.imageUrl) mediaUpdate.thumbnailUrl = updates.imageUrl;
        if (updates.onlineUrl !== undefined) mediaUpdate.onlineUrl = updates.onlineUrl;
        if (updates.mediaType) mediaUpdate.mediaType = updates.mediaType;
        if (updates.productionType) mediaUpdate.productionType = updates.productionType;
        if (updates.gradeLevel) {
          mediaUpdate.gradeLevel = updates.gradeLevel;
        }
        if (updates.subjectGroup) {
          mediaUpdate.subjectGroup = updates.subjectGroup;
        }
        if (updates.usageDetails || updates.subjectGroup || updates.mediaType || updates.productionType) {
          const sGroup = updates.subjectGroup || currentData.subjectGroup || '-';
          const uDetails = updates.usageDetails || currentData.usageDetails || '-';
          const mType = updates.mediaType || currentData.mediaType || '-';
          const pType = updates.productionType || currentData.productionType || '';
          mediaUpdate.description = `กลุ่มสาระ: ${sGroup} | นำไปใช้: ${uDetails} | ประเภท: ${mType}${pType ? ` (${pType})` : ''}`;
        }
        await updateDoc(mediaRef, mediaUpdate);
      } else {
        const newMediaPayload: TeacherMediaWork = {
          id: mediaDocId,
          title: updates.mediaTitle || currentData.mediaTitle,
          teacherName: updates.teacherName || currentData.teacherName,
          subjectGroup: updates.subjectGroup || currentData.subjectGroup || SUBJECT_GROUPS[0],
          gradeLevel: updates.gradeLevel || currentData.gradeLevel,
          subjectName: updates.usageDetails || currentData.usageDetails || 'สื่อนวัตกรรมการจัดการเรียนรู้',
          thumbnailUrl: updates.imageUrl || currentData.imageUrl || '/acu_active_logo.png',
          description: `กลุ่มสาระ: ${updates.subjectGroup || currentData.subjectGroup || '-'} | นำไปใช้: ${updates.usageDetails || currentData.usageDetails || '-'} | ประเภท: ${updates.mediaType || currentData.mediaType || '-'}${updates.productionType || currentData.productionType ? ` (${updates.productionType || currentData.productionType})` : ''}`,
          mediaType: updates.mediaType || currentData.mediaType,
          productionType: updates.productionType || currentData.productionType,
          itemNumber: Number(updates.itemNumber || currentData.itemNumber) || 1,
          onlineUrl: updates.onlineUrl !== undefined ? updates.onlineUrl : currentData.onlineUrl || '',
          ratingAvg: 5.0,
          ratingCount: 1,
          views: 1,
          likes: 0,
          likedBy: [],
          submittedByEmail: currentData.userEmail,
          createdAt: currentData.submittedAt || new Date().toISOString(),
        };
        await setDoc(mediaRef, newMediaPayload, { merge: true });
      }
    } catch {
      // ignore
    }

    // Update local storage cache immediately
    try {
      const currentList = getStoredInnovations();
      const updatedList = currentList.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
      );
      saveStoredInnovations(updatedList);
      notifyInnovationsChanged();
      notifyTeacherMediaChanged();
    } catch {}

    return { success: true };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      console.warn('[Firestore] Quota reached during update: Updated in local storage recovery cache.');
      return { success: true };
    }
    console.error('Error updating innovation submission:', err);
    return { success: true };
  }
}

/**
 * Sync ONLY the deleted item's owner user_profiles innovation slot back to 'pending'
 * if no other remaining submission exists for that slot. Never modifies other users' data.
 */
async function syncUserProfileSlotOnDelete(
  ownerEmail?: string,
  itemNumber?: number
): Promise<void> {
  if (!ownerEmail || !itemNumber) return;
  const normEmail = ownerEmail.trim().toLowerCase();
  const slotNum = Number(itemNumber);
  if (!normEmail || slotNum < 1 || slotNum > 5) return;

  try {
    // Check if owner still has another live submission for this slot
    let hasOtherForSlot = false;
    try {
      const q = query(
        collection(db, INNOVATIONS_COLLECTION),
        where('userEmail', '==', normEmail)
      );
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const data = d.data() as InnovationSubmission;
        if (Number(data.itemNumber) === slotNum && !LEGACY_FAKE_SEED_IDS.has(d.id)) {
          hasOtherForSlot = true;
        }
      });
    } catch {
      // Fallback check in local cache if Firestore query fails
      const cached = getStoredInnovations();
      hasOtherForSlot = cached.some(
        (i) => (i.userEmail || '').trim().toLowerCase() === normEmail && Number(i.itemNumber) === slotNum
      );
    }

    if (hasOtherForSlot) return;

    const resetSlot = {
      id: slotNum,
      title: '',
      category: '',
      status: 'pending',
      submittedDate: '-',
      linkUrl: '',
      notes: '',
      coverImageUrl: '',
    };

    // Update local profile cache if present
    try {
      const cacheKey = `acu_user_full_profile_${normEmail}`;
      const rawProf = localStorage.getItem(cacheKey);
      if (rawProf) {
        const parsed = JSON.parse(rawProf);
        if (parsed && Array.isArray(parsed.innovations)) {
          parsed.innovations = parsed.innovations.map((slot: any) =>
            Number(slot.id) === slotNum ? resetSlot : slot
          );
          parsed.updatedAt = new Date().toISOString();
          localStorage.setItem(cacheKey, JSON.stringify(parsed));
        }
      }
    } catch {
      // ignore
    }

    // Update Firestore user_profiles doc for this specific owner only
    const safeDocId = encodeURIComponent(normEmail);
    const profileRef = doc(db, 'user_profiles', safeDocId);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      const profData = profileSnap.data();
      if (Array.isArray(profData.innovations) && profData.innovations.length === 5) {
        const updatedSlots = profData.innovations.map((slot: any) =>
          Number(slot.id) === slotNum ? resetSlot : slot
        );
        await updateDoc(profileRef, {
          innovations: updatedSlots,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.warn('Could not sync user_profiles slot on delete:', err);
  }
}

/**
 * Delete an innovation submission.
 * Admin can delete any submission (including their own); teachers can only delete their own.
 */
export async function deleteInnovationSubmission(
  id: string,
  currentUserEmail: string
): Promise<{ success: boolean; error?: string }> {
  const cachedList = getStoredInnovations();
  const cachedItem = cachedList.find((item) => item.id === id);

  try {
    const docRef = doc(db, INNOVATIONS_COLLECTION, id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      if (cachedItem && !canUserModify(cachedItem.userEmail, currentUserEmail)) {
        return { success: false, error: 'คุณไม่มีสิทธิ์ลบผลงานของผู้อื่น (สิทธิ์เฉพาะเจ้าของผลงาน หรือ Admin เท่านั้น)' };
      }

      // Clean up paired collections defensively if authorized
      if (canUserModify(cachedItem?.userEmail, currentUserEmail)) {
        try {
          await deleteDoc(doc(db, SYSTEM_TEST_COLLECTION, `test_${id}`));
        } catch {}
        try {
          await deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, `work_${id}`));
        } catch {}
      }

      saveStoredInnovations(cachedList.filter((item) => item.id !== id));
      saveStoredTeacherMedia(getStoredTeacherMedia().filter((m) => m.id !== `work_${id}`));
      if (cachedItem) {
        await syncUserProfileSlotOnDelete(cachedItem.userEmail, cachedItem.itemNumber);
      }
      notifyInnovationsChanged();
      notifyTeacherMediaChanged();
      return { success: true };
    }

    const currentData = snap.data() as InnovationSubmission;

    if (!canUserModify(currentData.userEmail, currentUserEmail)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ลบผลงานของผู้อื่น (สิทธิ์เฉพาะเจ้าของผลงาน หรือ Admin เท่านั้น)' };
    }

    await deleteDoc(docRef);

    // Also delete from system_test_submissions
    try {
      const sysRef = doc(db, SYSTEM_TEST_COLLECTION, `test_${id}`);
      await deleteDoc(sysRef);
    } catch {
      // ignore
    }

    // Also delete from teacher_media_repository if present
    try {
      const mediaDocId = `work_${id}`;
      const mediaRef = doc(db, TEACHER_MEDIA_COLLECTION, mediaDocId);
      await deleteDoc(mediaRef);
    } catch {
      // ignore
    }

    // Delete from local caches immediately
    try {
      saveStoredInnovations(getStoredInnovations().filter((item) => item.id !== id));
      saveStoredTeacherMedia(getStoredTeacherMedia().filter((m) => m.id !== `work_${id}`));
    } catch {}

    // Reset the owner's slot in user_profiles back to pending if no other item exists for that slot
    await syncUserProfileSlotOnDelete(currentData.userEmail, currentData.itemNumber);

    notifyInnovationsChanged();
    notifyTeacherMediaChanged();

    return { success: true };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      console.warn('[Firestore] Quota reached during delete: Removed from local recovery cache.');
      saveStoredInnovations(getStoredInnovations().filter((item) => item.id !== id));
      saveStoredTeacherMedia(getStoredTeacherMedia().filter((m) => m.id !== `work_${id}`));
      notifyInnovationsChanged();
      notifyTeacherMediaChanged();
      return { success: true };
    }
    console.error('Error deleting innovation submission:', err);
    return { success: false, error: err.message || 'ลบข้อมูลไม่สำเร็จ' };
  }
}

/**
 * Subscribe to ALL innovation submissions (for Google Sheets summary, admin overview, and multiplexed user views).
 * Reference-counted shared Firestore listener + 0ms RAM/localStorage emission.
 */
export function subscribeAllInnovations(
  callback: (submissions: InnovationSubmission[]) => void
): () => void {
  innovationsListeners.add(callback);

  // 1. Instant initial load from RAM or localStorage cache
  callback(sharedLatestInnovations || getStoredInnovations());

  const handleLocalChange = () => {
    callback(sharedLatestInnovations || getStoredInnovations());
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('acu_innovations_changed', handleLocalChange);
  }

  // 2. Attach single shared Firestore listener if not already active
  if (!unsubSharedInnovationsFs) {
    try {
      const colRef = collection(db, INNOVATIONS_COLLECTION);
      unsubSharedInnovationsFs = onSnapshot(
        colRef,
        (snapshot) => {
          const liveList: InnovationSubmission[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as InnovationSubmission;
            if (!LEGACY_FAKE_SEED_IDS.has(docSnap.id) && !LEGACY_FAKE_SEED_IDS.has(data?.id)) {
              liveList.push({ ...data, id: data?.id || docSnap.id });
            }
          });

          liveList.sort(
            (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
          );
          saveStoredInnovations(liveList);
          broadcastInnovations(liveList);
        },
        (err) => {
          if (isQuotaExceededError(err)) {
            notifyQuotaExceeded();
            console.warn('[Firestore] Quota reached for subscribeAllInnovations; serving from local cache.');
          } else {
            console.warn('subscribeAllInnovations listener notice:', err);
          }
          broadcastInnovations(sharedLatestInnovations || getStoredInnovations());
        }
      );
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      broadcastInnovations(sharedLatestInnovations || getStoredInnovations());
    }
  }

  return () => {
    innovationsListeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('acu_innovations_changed', handleLocalChange);
    }
    if (innovationsListeners.size === 0 && unsubSharedInnovationsFs) {
      try {
        unsubSharedInnovationsFs();
      } catch {}
      unsubSharedInnovationsFs = null;
    }
  };
}

/**
 * Subscribe to user's innovation submissions in real time.
 * Reuses the single shared innovations stream to eliminate duplicate Firestore listeners and re-subscribe flicker.
 */
export function subscribeUserInnovations(
  userEmail: string,
  callback: (submissions: InnovationSubmission[]) => void,
  teacherName?: string
): () => void {
  if (!userEmail && !teacherName) {
    callback([]);
    return () => {};
  }

  const normTargetEmail = (userEmail || '').trim().toLowerCase();
  const normTargetName = (teacherName || '').trim().toLowerCase();

  const filterUserItems = (items: InnovationSubmission[]): InnovationSubmission[] => {
    return items
      .filter((item) => {
        if (!item || LEGACY_FAKE_SEED_IDS.has(item.id)) return false;
        const itemEmail = (item.userEmail || '').trim().toLowerCase();
        const itemName = (item.teacherName || '').trim().toLowerCase();

        if (itemEmail) {
          return Boolean(normTargetEmail && itemEmail === normTargetEmail);
        }

        return Boolean(
          normTargetName &&
            (itemName === normTargetName ||
              (normTargetName.length > 3 && itemName.includes(normTargetName)) ||
              (itemName.length > 3 && normTargetName.includes(itemName)))
        );
      })
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  };

  return subscribeAllInnovations((allItems) => {
    callback(filterUserItems(allItems));
  });
}

/**
 * Export 5 innovations submissions to Google Sheets CSV (UTF-8 BOM supported)
 */
export function exportInnovationsToGoogleSheetsCSV(submissions: InnovationSubmission[]): string {
  const headers = [
    'ลำดับ',
    'รหัสการส่ง',
    'วันเวลาที่ส่ง',
    'อีเมลผู้ส่ง',
    'ชื่อ - สกุล (ครูผู้สอน)',
    'กลุ่มสาระการเรียนรู้ของครูผู้สอน',
    'ระดับชั้นของครูผู้สอน',
    'สื่อชิ้นที่',
    'ชื่อสื่อ / นวัตกรรมการสอน',
    'ประเภทของสื่อ / นวัตกรรม',
    'การจัดทำสื่อ',
    'การนำสื่อไปใช้ (วิชา/หน่วยการเรียนรู้)',
    'URL สื่อออนไลน์',
    'มีรูปภาพแนบ',
    'สถานะ',
    'อีเมลเชื่อมโยงสรุปข้อมูล',
  ];

  const escapeCSV = (str?: string | number | null) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = submissions.map((sub, index) => {
    return [
      escapeCSV(index + 1),
      escapeCSV(sub.id),
      escapeCSV(new Date(sub.submittedAt).toLocaleString('th-TH')),
      escapeCSV(sub.userEmail),
      escapeCSV(sub.teacherName),
      escapeCSV(sub.subjectGroup || '-'),
      escapeCSV(sub.gradeLevel),
      escapeCSV(sub.itemNumber),
      escapeCSV(sub.mediaTitle),
      escapeCSV(sub.mediaType),
      escapeCSV(sub.productionType),
      escapeCSV(sub.usageDetails),
      escapeCSV(sub.onlineUrl || '-'),
      escapeCSV(sub.imageUrl ? 'มีภาพแนบ' : 'ไม่มีภาพ'),
      escapeCSV(sub.status),
      escapeCSV(ADMIN_TARGET_EMAIL),
    ].join(',');
  });

  // Include UTF-8 BOM for perfect Thai font rendering in Excel and Google Sheets
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  return csvContent;
}

// =========================================================================
// FIREBASE OPERATIONS: 2. บันทึกแหล่งเรียนรู้ภายในโรงเรียน (Button 4)
// =========================================================================

/**
 * Save facility usage record into Firestore project: System Test
 */
export async function saveFacilitySubmission(data: {
  teacherName: string;
  subjectGroup: string;
  learningCenter: string;
  periods: string[];
  usageDateTime: string;
  feedback: string;
  imageUrl?: string;
  userEmail: string;
}): Promise<{ success: boolean; id: string; error?: string }> {
  const id = `fac_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  const payload: FacilitySubmission = {
    id,
    teacherName: data.teacherName.trim(),
    subjectGroup: data.subjectGroup,
    learningCenter: data.learningCenter,
    periods: data.periods,
    usageDateTime: data.usageDateTime,
    feedback: data.feedback.trim(),
    imageUrl: data.imageUrl || '',
    userEmail: data.userEmail.trim().toLowerCase(),
    status: 'บันทึกสำเร็จ',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const current = getStoredFacilities();
    saveStoredFacilities([payload, ...current.filter((f) => f.id !== id)]);
    notifyFacilitiesChanged();
  } catch {}

  try {
    const docRef = doc(db, SYSTEM_TEST_COLLECTION, id);
    await setDoc(docRef, {
      ...payload,
      firebaseProject: 'System Test',
      notifiedAdminEmail: ADMIN_TARGET_EMAIL,
    });

    return { success: true, id };
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      notifyQuotaExceeded();
      return { success: true, id };
    }
    console.error('Error saving facility submission to Firestore:', error);
    return { success: false, id: '', error: error.message || 'บันทึกข้อมูลไม่สำเร็จ' };
  }
}

/**
 * Update an existing facility usage submission.
 * Admin can update any; teachers can only update their own.
 */
export async function updateFacilitySubmission(
  id: string,
  updates: Partial<FacilitySubmission>,
  currentUserEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, SYSTEM_TEST_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: 'ไม่พบรายการที่ต้องการแก้ไข' };
    }
    const currentData = snap.data() as FacilitySubmission;

    if (!canUserModify(currentData.userEmail, currentUserEmail)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลของผู้อื่น (เฉพาะเจ้าของหรือ Admin)' };
    }

    const updatedAt = new Date().toISOString();
    await updateDoc(docRef, {
      ...updates,
      updatedAt,
    });

    const current = getStoredFacilities();
    saveStoredFacilities(
      current.map((f) => (f.id === id ? { ...f, ...updates, updatedAt } : f))
    );
    notifyFacilitiesChanged();
    return { success: true };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      const updatedAt = new Date().toISOString();
      saveStoredFacilities(
        getStoredFacilities().map((f) => (f.id === id ? { ...f, ...updates, updatedAt } : f))
      );
      notifyFacilitiesChanged();
      return { success: true };
    }
    console.error('Error updating facility submission:', err);
    return { success: false, error: err.message || 'แก้ไขข้อมูลไม่สำเร็จ' };
  }
}

/**
 * Delete a facility usage submission.
 * Admin can delete any; teachers can only delete their own.
 */
export async function deleteFacilitySubmission(
  id: string,
  currentUserEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, SYSTEM_TEST_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      const cached = getStoredFacilities().find((f) => f.id === id);
      if (cached && !canUserModify(cached.userEmail, currentUserEmail)) {
        return { success: false, error: 'คุณไม่มีสิทธิ์ลบข้อมูลของผู้อื่น (เฉพาะเจ้าของหรือ Admin)' };
      }
      saveStoredFacilities(getStoredFacilities().filter((f) => f.id !== id));
      notifyFacilitiesChanged();
      return { success: true };
    }
    const currentData = snap.data() as FacilitySubmission;

    if (!canUserModify(currentData.userEmail, currentUserEmail)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ลบข้อมูลของผู้อื่น (เฉพาะเจ้าของหรือ Admin)' };
    }

    await deleteDoc(docRef);
    saveStoredFacilities(getStoredFacilities().filter((f) => f.id !== id));
    notifyFacilitiesChanged();
    return { success: true };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      saveStoredFacilities(getStoredFacilities().filter((f) => f.id !== id));
      notifyFacilitiesChanged();
      return { success: true };
    }
    console.error('Error deleting facility submission:', err);
    return { success: false, error: err.message || 'ลบข้อมูลไม่สำเร็จ' };
  }
}

/**
 * Subscribe in real-time to ALL facility usage records (multiplexed + 0ms cached emission)
 */
export function subscribeAllSubmissions(
  callback: (submissions: FacilitySubmission[]) => void
): () => void {
  facilitiesListeners.add(callback);
  callback(sharedLatestFacilities || getStoredFacilities());

  const handleLocalChange = () => {
    callback(sharedLatestFacilities || getStoredFacilities());
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('acu_facilities_changed', handleLocalChange);
  }

  if (!unsubSharedFacilitiesFs) {
    try {
      const colRef = collection(db, SYSTEM_TEST_COLLECTION);
      unsubSharedFacilitiesFs = onSnapshot(
        colRef,
        (snapshot) => {
          const list: FacilitySubmission[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.learningCenter) {
              list.push({ ...(data as FacilitySubmission), id: (data as any)?.id || docSnap.id });
            }
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          saveStoredFacilities(list);
          broadcastFacilities(list);
        },
        (err) => {
          if (isQuotaExceededError(err)) notifyQuotaExceeded();
          console.warn('subscribeAllSubmissions listener warning:', err);
          broadcastFacilities(sharedLatestFacilities || getStoredFacilities());
        }
      );
    } catch (err) {
      console.error('subscribeAllSubmissions failed:', err);
      broadcastFacilities(sharedLatestFacilities || getStoredFacilities());
    }
  }

  return () => {
    facilitiesListeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('acu_facilities_changed', handleLocalChange);
    }
    if (facilitiesListeners.size === 0 && unsubSharedFacilitiesFs) {
      try {
        unsubSharedFacilitiesFs();
      } catch {}
      unsubSharedFacilitiesFs = null;
    }
  };
}

/**
 * Subscribe in real-time to submissions created by current user (reuses shared facilities stream)
 */
export function subscribeUserSubmissions(
  userEmail: string,
  callback: (submissions: FacilitySubmission[]) => void
): () => void {
  if (!userEmail) {
    callback([]);
    return () => {};
  }
  const norm = userEmail.trim().toLowerCase();
  return subscribeAllSubmissions((all) => {
    callback(all.filter((f) => (f.userEmail || '').trim().toLowerCase() === norm));
  });
}

/**
 * Export facility usage submissions to Google Sheets CSV with UTF-8 BOM
 */
export function exportToGoogleSheetsCSV(submissions: FacilitySubmission[]): string {
  const headers = [
    'ลำดับ',
    'รหัสการบันทึก',
    'วันเวลาที่ส่งข้อมูล',
    'อีเมลผู้บันทึก',
    'ชื่อ - สกุล (ครูผู้สอน)',
    'ครูผู้สอนกลุ่มสาระ',
    'แหล่งเรียนรู้ (33 แห่ง)',
    'คาบการเรียนการสอน (1-9)',
    'วัน/เวลา ที่เข้าใช้งาน',
    'ความคิดเห็น/ข้อเสนอแนะ',
    'มีรูปภาพแนบ',
    'สถานะการบันทึก',
    'ฐานข้อมูล Firebase',
    'อีเมลเชื่อมโยงสรุปข้อมูล',
  ];

  const escapeCSV = (str?: string | number | null) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = submissions.map((sub, index) => {
    const periodsJoined = Array.isArray(sub.periods) ? sub.periods.join(', ') : sub.periods;
    return [
      escapeCSV(index + 1),
      escapeCSV(sub.id),
      escapeCSV(new Date(sub.createdAt).toLocaleString('th-TH')),
      escapeCSV(sub.userEmail),
      escapeCSV(sub.teacherName),
      escapeCSV(sub.subjectGroup),
      escapeCSV(sub.learningCenter),
      escapeCSV(periodsJoined),
      escapeCSV(sub.usageDateTime ? new Date(sub.usageDateTime).toLocaleString('th-TH') : '-'),
      escapeCSV(sub.feedback || '-'),
      escapeCSV(sub.imageUrl ? 'มีรูปภาพแนบ' : 'ไม่มี'),
      escapeCSV(sub.status),
      escapeCSV('System Test'),
      escapeCSV(ADMIN_TARGET_EMAIL),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  return csvContent;
}

// =========================================================================
// FIREBASE OPERATIONS: 3. คลังสื่อคุณครูผลิตเอง (Teacher Media Repository)
// ไม่มีสื่อตัวอย่าง - แสดงเฉพาะสื่อที่มีการส่งจริงจากคุณครูเท่านั้นตามคำสั่ง
// =========================================================================

export const INITIAL_TEACHER_WORKS: TeacherMediaWork[] = [];

/**
 * Subscribe to Teacher Media Repository with live updates (multiplexed + 0ms instant cached emission)
 */
export function subscribeTeacherMedia(
  callback: (works: TeacherMediaWork[]) => void
): () => void {
  teacherMediaListeners.add(callback);

  // Emit cached data synchronously on mount so Teacher Media Repository never appears empty/slow
  const initialWorks = sharedLatestTeacherMedia || getStoredTeacherMedia();
  callback(initialWorks);

  const handleLocalChange = () => {
    const cached = (sharedLatestTeacherMedia || getStoredTeacherMedia()).filter(
      (w) => !w.id.startsWith('seed-') && !LEGACY_FAKE_SEED_IDS.has(w.id) && w.title?.trim().length > 0
    );
    cached.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    callback(cached);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('acu_teacher_media_changed', handleLocalChange);
  }

  if (!unsubSharedTeacherMediaFs) {
    try {
      const colRef = collection(db, TEACHER_MEDIA_COLLECTION);
      unsubSharedTeacherMediaFs = onSnapshot(
        colRef,
        (snapshot) => {
          const liveList: TeacherMediaWork[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as TeacherMediaWork;
            liveList.push({ ...data, id: data?.id || docSnap.id });
          });

          // Filter out legacy seed items if any exist in collection
          const realWorks = liveList.filter(
            (w) => !w.id.startsWith('seed-') && !LEGACY_FAKE_SEED_IDS.has(w.id) && w.title?.trim().length > 0
          );

          // Sort newest first so real teacher submissions appear at top
          realWorks.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          saveStoredTeacherMedia(realWorks);
          broadcastTeacherMedia(realWorks);
        },
        (err) => {
          if (isQuotaExceededError(err)) notifyQuotaExceeded();
          console.warn('subscribeTeacherMedia fallback:', err);
          broadcastTeacherMedia(sharedLatestTeacherMedia || getStoredTeacherMedia());
        }
      );
    } catch (err) {
      console.error('subscribeTeacherMedia failed:', err);
      broadcastTeacherMedia(sharedLatestTeacherMedia || getStoredTeacherMedia());
    }
  }

  return () => {
    teacherMediaListeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('acu_teacher_media_changed', handleLocalChange);
    }
    if (teacherMediaListeners.size === 0 && unsubSharedTeacherMediaFs) {
      try {
        unsubSharedTeacherMediaFs();
      } catch {}
      unsubSharedTeacherMediaFs = null;
    }
  };
}

/**
 * Update teacher's media item.
 * Admin can update any; creator can update their own.
 */
export async function updateTeacherMedia(
  id: string,
  updates: Partial<TeacherMediaWork>,
  currentUserEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, TEACHER_MEDIA_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: 'ไม่พบรายการสื่อที่ต้องการแก้ไข' };
    }
    const currentData = snap.data() as TeacherMediaWork;

    if (!canUserModify(currentData.submittedByEmail, currentUserEmail)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์แก้ไขสื่อของผู้อื่น (สิทธิ์เฉพาะผู้ส่ง หรือ Admin)' };
    }

    await updateDoc(docRef, updates);
    saveStoredTeacherMedia(
      getStoredTeacherMedia().map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
    notifyTeacherMediaChanged();
    return { success: true };
  } catch (err: any) {
    console.error('Error updating teacher media:', err);
    return { success: false, error: err.message || 'แก้ไขข้อมูลไม่สำเร็จ' };
  }
}

/**
 * Delete teacher's media item.
 * Admin can delete any (including their own); creator can delete their own.
 */
export async function deleteTeacherMedia(
  id: string,
  currentUserEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, TEACHER_MEDIA_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      const cachedList = getStoredTeacherMedia();
      const cachedItem = cachedList.find((m) => m.id === id);
      if (cachedItem && !canUserModify(cachedItem.submittedByEmail, currentUserEmail)) {
        return { success: false, error: 'คุณไม่มีสิทธิ์ลบสื่อของผู้อื่น (สิทธิ์เฉพาะผู้ส่ง หรือ Admin)' };
      }
      if (cachedItem || canUserModify(undefined, currentUserEmail)) {
        saveStoredTeacherMedia(cachedList.filter((m) => m.id !== id));
        notifyTeacherMediaChanged();
        return { success: true };
      }
      return { success: false, error: 'ไม่พบรายการสื่อที่ต้องการลบ' };
    }

    const currentData = snap.data() as TeacherMediaWork;

    if (!canUserModify(currentData.submittedByEmail, currentUserEmail)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ลบสื่อของผู้อื่น (สิทธิ์เฉพาะผู้ส่ง หรือ Admin)' };
    }

    await deleteDoc(docRef);
    saveStoredTeacherMedia(getStoredTeacherMedia().filter((m) => m.id !== id));
    notifyTeacherMediaChanged();
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting teacher media:', err);
    return { success: false, error: err.message || 'ลบข้อมูลไม่สำเร็จ' };
  }
}

/**
 * Strictly remove ONLY Admin's (weerapong1625@acu.ac.th) own media submissions and reset
 * ONLY Admin's own 5-item innovation slots in user_profiles to pending.
 * NEVER touches any other user's data.
 */
export async function clearAdminOwnMedia(
  adminEmail: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const normAdmin = (adminEmail || '').trim().toLowerCase();
  const targetAdmin = ADMIN_TARGET_EMAIL.toLowerCase();
  if (normAdmin !== targetAdmin) {
    return { success: false, deletedCount: 0, error: 'สงวนสิทธิ์เฉพาะผู้ดูแลระบบหลัก (Admin) เท่านั้น' };
  }

  let deletedCount = 0;

  try {
    // 1. Delete only weerapong1625@acu.ac.th's docs in teacher_innovations_submissions
    const innovSnap = await getDocs(collection(db, INNOVATIONS_COLLECTION));
    for (const d of innovSnap.docs) {
      const data = d.data() as InnovationSubmission;
      const docOwner = (data?.userEmail || '').trim().toLowerCase();
      if (docOwner === targetAdmin || LEGACY_FAKE_SEED_IDS.has(d.id)) {
        await deleteDoc(d.ref);
        deletedCount++;
        try {
          await deleteDoc(doc(db, SYSTEM_TEST_COLLECTION, `test_${d.id}`));
        } catch {}
        try {
          await deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, `work_${d.id}`));
        } catch {}
      }
    }

    // 2. Delete only weerapong1625@acu.ac.th's docs in teacher_media_repository
    const mediaSnap = await getDocs(collection(db, TEACHER_MEDIA_COLLECTION));
    for (const d of mediaSnap.docs) {
      const data = d.data() as TeacherMediaWork;
      const docOwner = (data?.submittedByEmail || '').trim().toLowerCase();
      if (docOwner === targetAdmin || LEGACY_FAKE_SEED_IDS.has(d.id)) {
        await deleteDoc(d.ref);
        deletedCount++;
      }
    }

    // 3. Delete only weerapong1625@acu.ac.th's Innovation_5_Items docs in system_test_submissions
    const sysSnap = await getDocs(collection(db, SYSTEM_TEST_COLLECTION));
    for (const d of sysSnap.docs) {
      const data = d.data() as any;
      const docOwner = (data?.userEmail || '').trim().toLowerCase();
      if (docOwner === targetAdmin && (data?.sourceModule === 'Innovation_5_Items' || d.id.startsWith('test_innov_'))) {
        await deleteDoc(d.ref);
      }
    }

    // 4. Reset ONLY weerapong1625@acu.ac.th's 5 innovation slots in user_profiles
    const emptySlots = [1, 2, 3, 4, 5].map((slot) => ({
      id: slot,
      title: '',
      category: '',
      status: 'pending',
      submittedDate: '-',
      linkUrl: '',
      notes: '',
      coverImageUrl: '',
    }));

    const safeDocId = encodeURIComponent(targetAdmin);
    const profileRef = doc(db, 'user_profiles', safeDocId);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      await updateDoc(profileRef, {
        innovations: emptySlots,
        updatedAt: new Date().toISOString(),
      });
    }

    // 5. Clean only weerapong1625@acu.ac.th items from localStorage caches
    saveStoredInnovations(
      getStoredInnovations().filter((item) => (item.userEmail || '').trim().toLowerCase() !== targetAdmin)
    );
    saveStoredTeacherMedia(
      getStoredTeacherMedia().filter((m) => (m.submittedByEmail || '').trim().toLowerCase() !== targetAdmin)
    );

    try {
      const cacheKey = `acu_user_full_profile_${targetAdmin}`;
      const rawProf = localStorage.getItem(cacheKey);
      if (rawProf) {
        const parsed = JSON.parse(rawProf);
        if (parsed) {
          parsed.innovations = emptySlots;
          parsed.updatedAt = new Date().toISOString();
          localStorage.setItem(cacheKey, JSON.stringify(parsed));
        }
      }
    } catch {}

    notifyInnovationsChanged();
    notifyTeacherMediaChanged();

    return { success: true, deletedCount };
  } catch (err: any) {
    console.error('Error clearing Admin own media:', err);
    return { success: false, deletedCount, error: err?.message || 'ไม่สามารถลบสื่อของ Admin ได้' };
  }
}

/**
 * Add a new media work directly to Teacher Media Repository
 * Accessible to Admin and Teachers
 */
export async function addTeacherMediaDirectly(data: {
  title: string;
  teacherName: string;
  subjectGroup: string;
  subjectName?: string;
  gradeLevel?: string;
  mediaType: string;
  description: string;
  thumbnailUrl?: string;
  onlineUrl?: string;
  submittedByEmail: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const id = `work_direct_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  const payload: TeacherMediaWork = {
    id,
    title: data.title.trim(),
    teacherName: data.teacherName.trim(),
    subjectGroup: data.subjectGroup,
    gradeLevel: data.gradeLevel || data.subjectGroup,
    subjectName: data.subjectName?.trim() || 'สื่อนวัตกรรมการจัดการเรียนรู้',
    thumbnailUrl: data.thumbnailUrl?.trim() || '/acu_active_logo.png',
    description: data.description.trim(),
    mediaType: data.mediaType,
    itemNumber: 1,
    onlineUrl: data.onlineUrl?.trim() || '',
    ratingAvg: 5.0,
    ratingCount: 1,
    views: 1,
    likes: 0,
    likedBy: [],
    submittedByEmail: data.submittedByEmail.trim().toLowerCase(),
    createdAt: nowIso,
  };

  try {
    const currentMedia = getStoredTeacherMedia();
    saveStoredTeacherMedia([payload, ...currentMedia.filter((m) => m.id !== id)]);
    notifyTeacherMediaChanged();
  } catch {}

  try {
    const docRef = doc(db, TEACHER_MEDIA_COLLECTION, id);
    await setDoc(docRef, payload);
    return { success: true, id };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      return { success: true, id };
    }
    console.error('Error adding teacher media:', err);
    return { success: false, error: err.message || 'เพิ่มสื่อไม่สำเร็จ' };
  }
}

// =========================================================================
// 3.5 คลังไอเดีย (Shared Idea Bank) - Firestore Sync, User Ratings, Admin Oversight
// =========================================================================

export interface SharedIdeaItem {
  id: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  url?: string;
  imageUrl?: string;
  tags: string[];
  creatorEmail: string;
  creatorName: string;
  createdAt: string;
  ratingAvg: number;
  ratingCount: number;
  userRatings?: { [emailKey: string]: number }; // tracks who gave what rating!
}

const SHARED_IDEAS_COLLECTION = 'shared_ideas';

const DEFAULT_SEED_IDEAS: SharedIdeaItem[] = [
  {
    id: 'idea-seed-1',
    title: 'Canva Magic Studio สำหรับครูยุค AI',
    description: 'เทคนิคการใช้ AI ใน Canva เจนเนอเรทสไลด์สอน สรุปเนื้อหา และสร้างภาพประกอบบทเรียนอย่างรวดเร็ว',
    category: 'canva_ai',
    categoryLabel: 'Canva AI',
    url: 'https://www.canva.com/th_th/education/',
    tags: ['Canva', 'AI', 'การสร้างสื่อ'],
    creatorEmail: ADMIN_TARGET_EMAIL,
    creatorName: '(Admin) ม.วีระพงษ์ มีทรัพย์',
    createdAt: '2026-03-01T08:00:00.000Z',
    ratingAvg: 5.0,
    ratingCount: 12,
    userRatings: { 'weerapong1625_acu_ac_th': 5 },
  },
  {
    id: 'idea-seed-2',
    title: 'คลังข้อสอบและแนวทาง O-NET / NT สพฐ.',
    description: 'รวมแบบทดสอบวัดผลสัมฤทธิ์ทางการศึกษา และคลังข้อสอบมาตรฐานพร้อมเฉลยละเอียด',
    category: 'exams',
    categoryLabel: 'คลังข้อสอบ',
    url: 'https://www.niets.or.th/',
    tags: ['ข้อสอบ', 'O-NET', 'วัดผล'],
    creatorEmail: ADMIN_TARGET_EMAIL,
    creatorName: '(Admin) ม.วีระพงษ์ มีทรัพย์',
    createdAt: '2026-03-02T09:00:00.000Z',
    ratingAvg: 4.8,
    ratingCount: 9,
    userRatings: { 'weerapong1625_acu_ac_th': 5 },
  },
  {
    id: 'idea-seed-3',
    title: 'ฐานข้อมูลงานวิจัยในชั้นเรียน TCI & ThaiLIS',
    description: 'สืบค้นงานวิจัยทางการศึกษา นวัตกรรมการจัดการเรียนรู้ และบทความทางวิชาการ',
    category: 'research',
    categoryLabel: 'วิจัยในชั้นเรียน',
    url: 'https://tdc.thailis.or.th/tdc/basic.php',
    tags: ['งานวิจัย', 'R&D', 'วิชาการ'],
    creatorEmail: ADMIN_TARGET_EMAIL,
    creatorName: '(Admin) ม.วีระพงษ์ มีทรัพย์',
    createdAt: '2026-03-03T10:00:00.000Z',
    ratingAvg: 4.9,
    ratingCount: 15,
    userRatings: { 'weerapong1625_acu_ac_th': 5 },
  },
  {
    id: 'idea-seed-4',
    title: 'insKru & ชุมชนครู PLC แบ่งปันสื่อการสอน',
    description: 'แหล่งรวมไอเดีย Active Learning ใบงาน สื่อการสอน PowerPoint และแผนการจัดการเรียนรู้ที่เข้าชมได้จริง',
    category: 'facebook',
    categoryLabel: 'ชุมชนครู & แหล่งแชร์ไอเดีย',
    url: 'https://inskru.com/',
    tags: ['PLC', 'ชุมชนครู', 'แชร์สื่อ'],
    creatorEmail: ADMIN_TARGET_EMAIL,
    creatorName: '(Admin) ม.วีระพงษ์ มีทรัพย์',
    createdAt: '2026-03-04T11:00:00.000Z',
    ratingAvg: 4.7,
    ratingCount: 8,
    userRatings: { 'weerapong1625_acu_ac_th': 5 },
  },
];

function sanitizeSharedIdeaRecord(item: SharedIdeaItem): SharedIdeaItem {
  const rawUrl = (item.url || '').trim();
  const isBareFb = /^https?:\/\/(www\.|m\.|web\.)?facebook\.com\/?(\?.*)?$/i.test(rawUrl) || /^https?:\/\/fb\.com\/?$/i.test(rawUrl);

  let nextUrl = rawUrl;
  let nextTitle = item.title;
  let nextCategoryLabel = item.categoryLabel;

  if (item.id === 'idea-seed-4' && (!rawUrl || isBareFb)) {
    nextUrl = 'https://inskru.com/';
    nextTitle = 'insKru & ชุมชนครู PLC แบ่งปันสื่อการสอน';
    nextCategoryLabel = 'ชุมชนครู & แหล่งแชร์ไอเดีย';
  } else if (isBareFb) {
    nextUrl = 'https://inskru.com/';
  }

  return {
    ...item,
    title: nextTitle,
    categoryLabel: nextCategoryLabel,
    url: nextUrl,
  };
}

/**
 * Subscribe to Shared Ideas in real time (multiplexed + instant cached emission)
 */
export function subscribeSharedIdeas(
  callback: (ideas: SharedIdeaItem[]) => void
): () => void {
  sharedIdeasListeners.add(callback);
  callback(sharedLatestSharedIdeas || getStoredSharedIdeas());

  const handleLocalChange = () => {
    callback(sharedLatestSharedIdeas || getStoredSharedIdeas());
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('acu_shared_ideas_changed', handleLocalChange);
  }

  if (!unsubSharedIdeasFs) {
    try {
      const colRef = collection(db, SHARED_IDEAS_COLLECTION);
      unsubSharedIdeasFs = onSnapshot(
        colRef,
        (snapshot) => {
          const liveList: SharedIdeaItem[] = [];
          snapshot.forEach((docSnap) => {
            liveList.push(sanitizeSharedIdeaRecord({ ...(docSnap.data() as SharedIdeaItem), id: docSnap.id }));
          });

          const mergedMap = new Map<string, SharedIdeaItem>();
          DEFAULT_SEED_IDEAS.forEach((i) => mergedMap.set(i.id, i));
          liveList.forEach((i) => mergedMap.set(i.id, i));

          const finalIdeas = Array.from(mergedMap.values());
          finalIdeas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          saveStoredSharedIdeas(finalIdeas);
          broadcastSharedIdeas(finalIdeas);
        },
        (err) => {
          if (isQuotaExceededError(err)) notifyQuotaExceeded();
          console.warn('subscribeSharedIdeas fallback to cache/seed:', err);
          broadcastSharedIdeas(sharedLatestSharedIdeas || getStoredSharedIdeas());
        }
      );
    } catch (err) {
      console.error('subscribeSharedIdeas failed:', err);
      broadcastSharedIdeas(sharedLatestSharedIdeas || getStoredSharedIdeas());
    }
  }

  return () => {
    sharedIdeasListeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('acu_shared_ideas_changed', handleLocalChange);
    }
    if (sharedIdeasListeners.size === 0 && unsubSharedIdeasFs) {
      try {
        unsubSharedIdeasFs();
      } catch {}
      unsubSharedIdeasFs = null;
    }
  };
}

/**
 * Save a new shared idea from any teacher
 */
export async function saveSharedIdea(data: {
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  url?: string;
  imageUrl?: string;
  tags?: string[];
  creatorEmail: string;
  creatorName: string;
}): Promise<{ success: boolean; id: string; error?: string }> {
  const id = `idea_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  const payload: SharedIdeaItem = {
    id,
    title: data.title.trim(),
    description: data.description.trim(),
    category: data.category,
    categoryLabel: data.categoryLabel,
    url: data.url?.trim() || '',
    ...(data.imageUrl?.trim() ? { imageUrl: data.imageUrl.trim() } : {}),
    tags: data.tags && data.tags.length > 0 ? data.tags : ['ไอเดียใหม่', 'แบ่งปันโดยครู ACU'],
    creatorEmail: data.creatorEmail.trim().toLowerCase(),
    creatorName: data.creatorName.trim() || data.creatorEmail,
    createdAt: nowIso,
    ratingAvg: 5.0,
    ratingCount: 1,
    userRatings: {
      [data.creatorEmail.replace(/[^a-zA-Z0-9]/g, '_')]: 5,
    },
  };

  try {
    const current = getStoredSharedIdeas();
    saveStoredSharedIdeas([payload, ...current.filter((i) => i.id !== id)]);
    notifySharedIdeasChanged();
  } catch {}

  try {
    const docRef = doc(db, SHARED_IDEAS_COLLECTION, id);
    await setDoc(docRef, payload);
    return { success: true, id };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      return { success: true, id };
    }
    console.error('Error saving shared idea:', err);
    return { success: false, id: '', error: err.message || 'บันทึกไอเดียไม่สำเร็จ' };
  }
}

/**
 * Rate a shared idea (1-5 stars).
 * Updates each user's rating in userRatings map and recalculates average.
 */
export async function rateSharedIdea(
  ideaId: string,
  stars: number,
  userEmail: string
): Promise<boolean> {
  try {
    const safeEmailKey = (userEmail || 'anonymous').replace(/[^a-zA-Z0-9]/g, '_');
    const docRef = doc(db, SHARED_IDEAS_COLLECTION, ideaId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as SharedIdeaItem;
      const userRatings = data.userRatings || {};
      userRatings[safeEmailKey] = stars;

      const ratingValues = Object.values(userRatings) as number[];
      const count = ratingValues.length;
      const sum = ratingValues.reduce((a, b) => a + b, 0);
      const avg = Number((sum / count).toFixed(1));

      await updateDoc(docRef, {
        ratingAvg: avg,
        ratingCount: count,
        userRatings,
      });

      saveStoredSharedIdeas(
        getStoredSharedIdeas().map((item) =>
          item.id === ideaId ? { ...item, ratingAvg: avg, ratingCount: count, userRatings } : item
        )
      );
      notifySharedIdeasChanged();
      return true;
    } else {
      const seed = DEFAULT_SEED_IDEAS.find((s) => s.id === ideaId);
      const initialRatings: { [key: string]: number } = { ...(seed?.userRatings || {}) };
      initialRatings[safeEmailKey] = stars;

      const ratingValues = Object.values(initialRatings) as number[];
      const count = ratingValues.length;
      const sum = ratingValues.reduce((a, b) => a + b, 0);
      const avg = Number((sum / count).toFixed(1));

      await setDoc(docRef, {
        ...(seed || {
          id: ideaId,
          title: 'ไอเดียการจัดการเรียนรู้',
          description: '',
          category: 'education',
          categoryLabel: 'การศึกษา',
          tags: ['ไอเดีย'],
          creatorEmail: ADMIN_TARGET_EMAIL,
          creatorName: '(Admin) ม.วีระพงษ์ มีทรัพย์',
          createdAt: new Date().toISOString(),
        }),
        ratingAvg: avg,
        ratingCount: count,
        userRatings: initialRatings,
      });
      return true;
    }
  } catch (err) {
    console.error('Failed to rate shared idea:', err);
    return false;
  }
}

/**
 * Delete a shared idea.
 * Admin can delete any idea; teachers can only delete ideas they created.
 */
export async function deleteSharedIdea(
  ideaId: string,
  currentUserEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, SHARED_IDEAS_COLLECTION, ideaId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      if (currentUserEmail.trim().toLowerCase() === ADMIN_TARGET_EMAIL.toLowerCase()) {
        saveStoredSharedIdeas(getStoredSharedIdeas().filter((i) => i.id !== ideaId));
        notifySharedIdeasChanged();
        return { success: true };
      }
      return { success: false, error: 'ไม่พบรายการไอเดียที่ต้องการลบ' };
    }
    const currentData = snap.data() as SharedIdeaItem;

    if (!canUserModify(currentData.creatorEmail, currentUserEmail)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ลบไอเดียของผู้อื่น (เฉพาะผู้สร้างไอเดีย หรือ Admin)' };
    }

    await deleteDoc(docRef);
    saveStoredSharedIdeas(getStoredSharedIdeas().filter((i) => i.id !== ideaId));
    notifySharedIdeasChanged();
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting shared idea:', err);
    return { success: false, error: err.message || 'ลบข้อมูลไม่สำเร็จ' };
  }
}

/**
 * Update a shared idea.
 * Admin can update any; creator can update their own.
 */
export async function updateSharedIdea(
  ideaId: string,
  updates: Partial<SharedIdeaItem>,
  currentUserEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, SHARED_IDEAS_COLLECTION, ideaId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: 'ไม่พบรายการไอเดียที่ต้องการแก้ไข' };
    }
    const currentData = snap.data() as SharedIdeaItem;

    if (!canUserModify(currentData.creatorEmail, currentUserEmail)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์แก้ไขไอเดียของผู้อื่น (เฉพาะผู้สร้างไอเดีย หรือ Admin)' };
    }

    await updateDoc(docRef, updates);
    saveStoredSharedIdeas(
      getStoredSharedIdeas().map((i) => (i.id === ideaId ? { ...i, ...updates } : i))
    );
    notifySharedIdeasChanged();
    return { success: true };
  } catch (err: any) {
    console.error('Error updating shared idea:', err);
    return { success: false, error: err.message || 'แก้ไขข้อมูลไม่สำเร็จ' };
  }
}

/**
 * Give a star rating to a teacher's media item
 */
export async function rateTeacherMedia(
  mediaId: string,
  rating: number,
  userEmail: string
): Promise<boolean> {
  try {
    const safeEmailKey = (userEmail || 'anonymous').replace(/[^a-zA-Z0-9]/g, '_');
    const docRef = doc(db, TEACHER_MEDIA_COLLECTION, mediaId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as TeacherMediaWork;
      const userRatings = data.userRatings || {};
      userRatings[safeEmailKey] = rating;

      const ratingValues = Object.values(userRatings) as number[];
      const count = ratingValues.length;
      const sum = ratingValues.reduce((a, b) => a + b, 0);
      const avg = Number((sum / count).toFixed(1));

      await updateDoc(docRef, {
        ratingAvg: avg,
        ratingCount: count,
        userRatings,
        views: increment(1),
      });
      saveStoredTeacherMedia(
        getStoredTeacherMedia().map((m) =>
          m.id === mediaId ? { ...m, ratingAvg: avg, ratingCount: count, userRatings, views: (m.views || 0) + 1 } : m
        )
      );
      notifyTeacherMediaChanged();
      return true;
    } else {
      // Create it from seed or initial
      const seed = INITIAL_TEACHER_WORKS.find((s) => s.id === mediaId);
      const initialRatings: { [key: string]: number } = {};
      initialRatings[safeEmailKey] = rating;

      const newWork: TeacherMediaWork = {
        ...(seed || {
          id: mediaId,
          title: 'สื่อนวัตกรรมการจัดการเรียนรู้',
          teacherName: 'ครูผู้สอน ACU',
          subjectGroup: 'กลุ่มสาระการเรียนรู้',
          subjectName: 'รายวิชาพื้นฐาน',
          thumbnailUrl: '/ACU N.png',
          description: '',
          mediaType: 'สื่อเทคโนโลยี',
          views: 1,
          createdAt: new Date().toISOString(),
        }),
        ratingAvg: rating,
        ratingCount: 1,
        userRatings: initialRatings,
      };
      await setDoc(docRef, newWork);
      const cur = getStoredTeacherMedia();
      saveStoredTeacherMedia(
        cur.some((m) => m.id === mediaId)
          ? cur.map((m) => (m.id === mediaId ? { ...m, ...newWork } : m))
          : [newWork, ...cur]
      );
      notifyTeacherMediaChanged();
      return true;
    }
  } catch (err) {
    console.error('Failed to rate media:', err);
    return false;
  }
}

/**
 * Toggle like for a teacher media item.
 * Increments or decrements like count and tracks user email in likedBy array.
 * When users like a teacher's media, it accumulates points on the teacher's profile!
 */
export async function toggleLikeTeacherMedia(
  mediaId: string,
  userEmail: string
): Promise<{ success: boolean; likes: number; isLiked: boolean; error?: string }> {
  try {
    const normEmail = (userEmail || 'anonymous').toLowerCase().trim();
    const docRef = doc(db, TEACHER_MEDIA_COLLECTION, mediaId);
    const snap = await getDoc(docRef);

    let currentLikes = 0;
    let likedBy: string[] = [];
    let authorEmail: string | undefined;

    if (snap.exists()) {
      const data = snap.data() as TeacherMediaWork;
      currentLikes = typeof data.likes === 'number' ? data.likes : 0;
      likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
      authorEmail = data.submittedByEmail;
    } else {
      const cached = getStoredTeacherMedia().find((m) => m.id === mediaId);
      if (cached) {
        currentLikes = typeof cached.likes === 'number' ? cached.likes : 0;
        likedBy = Array.isArray(cached.likedBy) ? cached.likedBy : [];
        authorEmail = cached.submittedByEmail;
      }
    }

    const isAlreadyLiked = likedBy.includes(normEmail);
    let newLikes: number;
    let isLiked: boolean;

    if (isAlreadyLiked) {
      likedBy = likedBy.filter((e) => e !== normEmail);
      newLikes = Math.max(0, currentLikes - 1);
      isLiked = false;
    } else {
      likedBy.push(normEmail);
      newLikes = currentLikes + 1;
      isLiked = true;
    }

    await setDoc(
      docRef,
      {
        likes: newLikes,
        likedBy,
      },
      { merge: true }
    );

    saveStoredTeacherMedia(
      getStoredTeacherMedia().map((m) =>
        m.id === mediaId ? { ...m, likes: newLikes, likedBy } : m
      )
    );
    notifyTeacherMediaChanged();

    // If media has an author email, sync stats.points on their user profile in Firestore
    if (authorEmail && authorEmail.trim()) {
      try {
        const safeDocId = encodeURIComponent(authorEmail.toLowerCase().trim());
        const profileRef = doc(db, 'user_profiles', safeDocId);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const currentPoints = profileSnap.data()?.stats?.points ?? 0;
          const updatedPoints = isLiked ? currentPoints + 1 : Math.max(0, currentPoints - 1);
          await updateDoc(profileRef, {
            'stats.points': updatedPoints,
          });
        }
      } catch (err) {
        console.warn('Could not sync points to author user_profiles:', err);
      }
    }

    return { success: true, likes: newLikes, isLiked };
  } catch (err: any) {
    console.error('Failed to toggle like on teacher media:', err);
    return { success: false, likes: 0, isLiked: false, error: err?.message || 'ไม่สามารถกดถูกใจได้' };
  }
}

// =========================================================================
// 4. ศึกษาเกณฑ์/ประเภทสื่อ (Criteria Poster Service - Admin Only Upload)
// =========================================================================

const CRITERIA_POSTER_DOC_ID = 'media_criteria_infographic';
export const DEFAULT_CRITERIA_POSTER = '/ประเภทสื่อ .png';
export const CRITERIA_STORAGE_KEY = 'acu_media_criteria_poster';

export interface CriteriaPosterConfig {
  imageUrl: string;
  updatedBy?: string;
  updatedAt?: string;
}

export function getInitialCriteriaPosterUrl(): string {
  try {
    const raw = localStorage.getItem(CRITERIA_STORAGE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached?.imageUrl) return cached.imageUrl;
    }
  } catch {
    // ignore
  }
  return DEFAULT_CRITERIA_POSTER;
}

export function subscribeCriteriaPoster(onUpdate: (url: string) => void): () => void {
  onUpdate(getInitialCriteriaPosterUrl());

  const handleCustomUpdate = (e: Event) => {
    const custom = e as CustomEvent<string>;
    if (custom.detail) {
      onUpdate(custom.detail);
    }
  };
  window.addEventListener('acu_criteria_poster_changed', handleCustomUpdate);

  try {
    const docRef = doc(db, 'system_settings', CRITERIA_POSTER_DOC_ID);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as CriteriaPosterConfig;
          if (data?.imageUrl) {
            try {
              localStorage.setItem(CRITERIA_STORAGE_KEY, JSON.stringify(data));
            } catch {
              // ignore
            }
            onUpdate(data.imageUrl);
            return;
          }
        }
        try {
          localStorage.removeItem(CRITERIA_STORAGE_KEY);
        } catch {}
        onUpdate(DEFAULT_CRITERIA_POSTER);
      },
      () => {
        onUpdate(getInitialCriteriaPosterUrl());
      }
    );
    return () => {
      window.removeEventListener('acu_criteria_poster_changed', handleCustomUpdate);
      unsubscribe();
    };
  } catch {
    onUpdate(getInitialCriteriaPosterUrl());
    return () => {
      window.removeEventListener('acu_criteria_poster_changed', handleCustomUpdate);
    };
  }
}

export async function saveCriteriaPoster(
  imageUrl: string,
  adminEmail: string
): Promise<{ success: boolean; message: string }> {
  if (adminEmail.trim().toLowerCase() !== ADMIN_TARGET_EMAIL.toLowerCase()) {
    return {
      success: false,
      message: `ไม่อนุญาต: สิทธิ์เฉพาะผู้ดูแลระบบ (${ADMIN_TARGET_EMAIL}) เท่านั้น`,
    };
  }

  const payload: CriteriaPosterConfig = {
    imageUrl,
    updatedBy: adminEmail,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(CRITERIA_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }

  // Instant notification to all active components
  try {
    window.dispatchEvent(new CustomEvent('acu_criteria_poster_changed', { detail: imageUrl }));
  } catch {
    // ignore
  }

  try {
    const docRef = doc(db, 'system_settings', CRITERIA_POSTER_DOC_ID);
    await setDoc(docRef, payload, { merge: true });
    return { success: true, message: 'บันทึกภาพกราฟิกเกณฑ์/ประเภทสื่อเรียบร้อยแล้ว' };
  } catch (err: any) {
    console.error('Failed to save criteria poster:', err);
    return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการบันทึกภาพลงฐานข้อมูล' };
  }
}

export async function resetCriteriaPoster(
  adminEmail: string
): Promise<{ success: boolean; message: string }> {
  if (adminEmail.trim().toLowerCase() !== ADMIN_TARGET_EMAIL.toLowerCase()) {
    return {
      success: false,
      message: `ไม่อนุญาต: สิทธิ์เฉพาะผู้ดูแลระบบ (${ADMIN_TARGET_EMAIL}) เท่านั้น`,
    };
  }

  try {
    localStorage.removeItem(CRITERIA_STORAGE_KEY);
  } catch {
    // ignore
  }

  try {
    window.dispatchEvent(new CustomEvent('acu_criteria_poster_changed', { detail: DEFAULT_CRITERIA_POSTER }));
  } catch {
    // ignore
  }

  try {
    const docRef = doc(db, 'system_settings', CRITERIA_POSTER_DOC_ID);
    await deleteDoc(docRef);
    return { success: true, message: 'รีเซ็ตกลับเป็นภาพเดิม (ประเภทสื่อ .png) สำเร็จ' };
  } catch (err: any) {
    console.error('Failed to reset criteria poster:', err);
    return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการรีเซ็ต' };
  }
}
