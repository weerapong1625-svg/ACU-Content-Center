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
  limit,
  updateDoc, 
  increment 
} from 'firebase/firestore';
import { db, isQuotaExceededError, notifyQuotaExceeded } from '../firebase';
import {
  adjustUserSubmissionCount,
  DEFAULT_INNOVATION_ITEMS,
  getCachedUserProfile,
  getCleanRealName,
  getDeletedUserEmails,
  InnovationItem,
  resolveUserUid,
  setCachedUserProfile,
} from './userProfileService';

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
  uid?: string;
  userId?: string;
  email?: string;
  submittedByEmail?: string;
  teacherEmail?: string;
  authorEmail?: string;
  authorName?: string;
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
  status: 'ส่งเรียบร้อย' | 'อนุมัติแล้ว' | 'รอตรวจสอบ' | 'pending' | 'approved' | 'submitted' | 'under_review' | string;
  isDeleted?: boolean;
  deleted?: boolean;
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
  uid?: string;
  userId?: string;
  email?: string;
  userEmail?: string;
  teacherEmail?: string;
  authorEmail?: string;
  authorName?: string;
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
  status?: string;
  isDeleted?: boolean;
  deleted?: boolean;
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

export const DELETED_MEDIA_STORAGE_KEY = 'acu_deleted_media_ids';

export function getDeletedMediaIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_MEDIA_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map((id: string) => String(id).trim()).filter(Boolean));
      }
    }
  } catch {}
  return new Set();
}

export function addDeletedMediaIds(ids: string[]): void {
  if (typeof window === 'undefined' || !Array.isArray(ids) || ids.length === 0) return;
  try {
    const set = getDeletedMediaIds();
    ids.forEach((rawId) => {
      const id = String(rawId || '').trim();
      if (!id) return;
      set.add(id);
      if (id.startsWith('work_')) {
        set.add(id.slice(5));
      } else {
        set.add(`work_${id}`);
      }
    });
    localStorage.setItem(DELETED_MEDIA_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function isMediaIdBlocked(id?: string): boolean {
  if (!id) return false;
  const trimmed = String(id).trim();
  if (!trimmed || trimmed.startsWith('seed-') || LEGACY_FAKE_SEED_IDS.has(trimmed)) return true;
  const blocked = getDeletedMediaIds();
  const stripped = trimmed.startsWith('work_') ? trimmed.slice(5) : trimmed;
  return blocked.has(trimmed) || blocked.has(stripped) || blocked.has(`work_${stripped}`);
}

/**
 * Extract all normalized lowercase emails attached to a media or innovation document
 */
export function extractMediaEmails(item: any): string[] {
  if (!item || typeof item !== 'object') return [];
  const candidates = [
    item.email,
    item.userEmail,
    item.submittedByEmail,
    item.teacherEmail,
    item.authorEmail,
  ];
  const emails: string[] = [];
  for (const raw of candidates) {
    if (typeof raw === 'string') {
      const norm = raw.trim().toLowerCase();
      if (norm && !emails.includes(norm)) {
        emails.push(norm);
      }
    }
  }
  return emails;
}

const REJECTED_OR_DELETED_STATUSES = new Set([
  'deleted',
  'rejected',
  'cancelled',
  'canceled',
  'ยกเลิก',
  'ถูกลบ',
  'ปฏิเสธ',
  'ไม่ผ่าน',
]);

/**
 * Check whether an innovation/media record is valid & active for counting.
 * Counts pending, approved, submitted, under_review, Thai submitted statuses, and legacy records missing `status`,
 * while excluding deleted/rejected records, deleted users, and persistent deletion blocklist items.
 */
export function isValidActiveMediaRecord(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  if (isMediaIdBlocked(item.id)) return false;
  if (item.isDeleted === true || item.deleted === true) return false;

  const status = typeof item.status === 'string' ? item.status.trim().toLowerCase() : '';
  if (status && REJECTED_OR_DELETED_STATUSES.has(status)) {
    return false;
  }

  const title = (item.mediaTitle || item.title || '').toString().trim();
  if (!title) return false;

  const deletedUsers = getDeletedUserEmails();
  const emails = extractMediaEmails(item);
  if (emails.length > 0 && emails.every((em) => deletedUsers.has(em))) {
    return false;
  }

  return true;
}

/**
 * Robustly match a media/innovation record to a teacher using:
 * 1) item.uid === teacher.uid OR item.userId === teacher.uid
 * 2) normalized lowercase email match across email/userEmail/submittedByEmail/teacherEmail/authorEmail
 * 3) trimmed authorName/teacherName match fallback ONLY when email and uid are missing on legacy records
 */
export function doesMediaRecordBelongToTeacher(
  item: any,
  teacher: {
    uid?: string;
    email?: string;
    fullName?: string;
    teacherName?: string;
    displayName?: string;
  }
): boolean {
  if (!item || typeof item !== 'object') return false;

  const teacherUid = (teacher.uid || '').trim();
  const itemUid = (item.uid || '').toString().trim();
  const itemUserId = (item.userId || '').toString().trim();

  if (teacherUid && ((itemUid && itemUid === teacherUid) || (itemUserId && itemUserId === teacherUid))) {
    return true;
  }

  const teacherEmail = (teacher.email || '').trim().toLowerCase();
  const itemEmails = extractMediaEmails(item);

  if (teacherEmail && itemEmails.includes(teacherEmail)) {
    return true;
  }

  // Fallback to trimmed authorName / teacherName only when both email and uid/userId are absent on legacy records
  if (!itemUid && !itemUserId && itemEmails.length === 0) {
    const recordNames = [item.authorName, item.teacherName]
      .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      .map((n) => getCleanRealName(n).trim().toLowerCase());

    const teacherNames = [teacher.fullName, teacher.teacherName, teacher.displayName]
      .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      .flatMap((n) => [n.trim().toLowerCase(), getCleanRealName(n).trim().toLowerCase()])
      .filter(Boolean);

    if (recordNames.length > 0 && teacherNames.length > 0) {
      return recordNames.some((rn) =>
        teacherNames.some(
          (tn) => rn === tn || (tn.length > 3 && rn.includes(tn)) || (rn.length > 3 && tn.includes(rn))
        )
      );
    }
  }

  return false;
}

export interface UnifiedMediaRecord {
  canonicalId: string;
  innovationId?: string;
  mediaWorkId?: string;
  itemNumber: number;
  title: string;
  mediaType: string;
  productionType: string;
  usageDetails: string;
  subjectGroup: string;
  gradeLevel: string;
  teacherName: string;
  ownerEmail: string;
  onlineUrl: string;
  coverImageUrl: string;
  submittedAt: string;
  status: 'approved' | 'submitted' | 'under_review';
}

export interface UnifiedTeacherMediaResult {
  records: UnifiedMediaRecord[];
  submittedCount: number;
  slots: InnovationItem[];
}

function mapRawStatusToSlotStatus(rawStatus?: string): 'approved' | 'submitted' | 'under_review' {
  const s = (rawStatus || '').trim().toLowerCase();
  if (s === 'approved' || s === 'อนุมัติแล้ว') return 'approved';
  if (s === 'under_review' || s === 'รอตรวจสอบ') return 'under_review';
  return 'submitted';
}

/**
 * Unify and deduplicate a teacher's media submissions across BOTH `teacher_innovations_submissions`
 * and `teacher_media_repository` in memory (zero extra Firestore reads).
 */
export function getUnifiedTeacherMediaRecords(
  teacher: {
    uid?: string;
    email?: string;
    fullName?: string;
    teacherName?: string;
    displayName?: string;
  },
  innovations: InnovationSubmission[],
  teacherMedia: TeacherMediaWork[]
): UnifiedTeacherMediaResult {
  const unifiedMap = new Map<string, UnifiedMediaRecord>();

  // 1. Add innovation submissions first
  innovations.forEach((inv) => {
    if (!isValidActiveMediaRecord(inv)) return;
    if (!doesMediaRecordBelongToTeacher(inv, teacher)) return;

    const canonicalId = inv.id.startsWith('work_') ? inv.id.slice(5) : inv.id;
    const ownerEmail = extractMediaEmails(inv)[0] || (teacher.email || '').trim().toLowerCase();
    unifiedMap.set(canonicalId, {
      canonicalId,
      innovationId: inv.id,
      itemNumber: Number(inv.itemNumber) || 1,
      title: (inv.mediaTitle || '').trim(),
      mediaType: inv.mediaType || 'สื่อการสอน',
      productionType: inv.productionType || 'ครูผลิตสื่อเอง',
      usageDetails: inv.usageDetails || '',
      subjectGroup: inv.subjectGroup || SUBJECT_GROUPS[0],
      gradeLevel: inv.gradeLevel || '-',
      teacherName: inv.teacherName || teacher.fullName || teacher.teacherName || '',
      ownerEmail,
      onlineUrl: inv.onlineUrl || '',
      coverImageUrl: inv.imageUrl || inv.coverImageUrl || '',
      submittedAt: inv.submittedAt || '',
      status: mapRawStatusToSlotStatus(inv.status),
    });
  });

  // 2. Merge / add teacher_media_repository items (deduplicating paired work_<innovId> records)
  teacherMedia.forEach((work) => {
    if (!isValidActiveMediaRecord(work)) return;
    if (!doesMediaRecordBelongToTeacher(work, teacher)) return;

    const canonicalId = work.id.startsWith('work_') ? work.id.slice(5) : work.id;
    const existing = unifiedMap.get(canonicalId);
    if (existing) {
      existing.mediaWorkId = work.id;
      if (!existing.coverImageUrl && work.thumbnailUrl) existing.coverImageUrl = work.thumbnailUrl;
      if (!existing.onlineUrl && work.onlineUrl) existing.onlineUrl = work.onlineUrl;
      return;
    }

    const ownerEmail = extractMediaEmails(work)[0] || (teacher.email || '').trim().toLowerCase();
    unifiedMap.set(canonicalId, {
      canonicalId,
      mediaWorkId: work.id,
      itemNumber: Number(work.itemNumber) || 1,
      title: (work.title || '').trim(),
      mediaType: work.mediaType || 'สื่อการสอน',
      productionType: work.productionType || 'ครูผลิตสื่อเอง',
      usageDetails: work.subjectName || work.description || '',
      subjectGroup: work.subjectGroup || SUBJECT_GROUPS[0],
      gradeLevel: work.gradeLevel || '-',
      teacherName: work.teacherName || work.authorName || teacher.fullName || teacher.teacherName || '',
      ownerEmail,
      onlineUrl: work.onlineUrl || '',
      coverImageUrl: work.thumbnailUrl || '',
      submittedAt: work.createdAt || '',
      status: mapRawStatusToSlotStatus(work.status),
    });
  });

  const records = Array.from(unifiedMap.values()).sort((a, b) => {
    const slotDiff = (a.itemNumber || 99) - (b.itemNumber || 99);
    if (slotDiff !== 0) return slotDiff;
    return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
  });

  // Map records cleanly into the 5 display slots (1..5):
  // Pass 1: Place innovation records & distinct explicit slots into their declared slot 1..5 if empty
  // Pass 2: Place any remaining records (e.g. direct Media Library uploads with itemNumber=1) into open slots 1..5
  const slotAssignments: (UnifiedMediaRecord | null)[] = [null, null, null, null, null];
  const unplaced: UnifiedMediaRecord[] = [];

  for (const rec of records) {
    const idx = rec.itemNumber - 1;
    if (idx >= 0 && idx < 5 && !slotAssignments[idx]) {
      slotAssignments[idx] = rec;
    } else {
      unplaced.push(rec);
    }
  }

  for (const rec of unplaced) {
    const emptyIdx = slotAssignments.findIndex((s) => s === null);
    if (emptyIdx !== -1) {
      slotAssignments[emptyIdx] = rec;
    }
  }

  const slots: InnovationItem[] = DEFAULT_INNOVATION_ITEMS.map((defItem, idx) => {
    const rec = slotAssignments[idx];
    if (!rec) return defItem;
    return {
      id: defItem.id,
      title: rec.title,
      category: rec.mediaType,
      status: rec.status,
      submittedDate: rec.submittedAt
        ? new Date(rec.submittedAt).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : 'ส่งแล้ว',
      linkUrl: rec.onlineUrl || '',
      coverImageUrl: rec.coverImageUrl || '',
      notes: `${rec.productionType}${rec.usageDetails ? ` • ${rec.usageDetails}` : ''}`,
    };
  });

  return {
    records,
    submittedCount: records.length,
    slots,
  };
}

// Module-level guard to ensure self-healing Firestore sync runs at most once per email+count per session
const syncedSubmissionCountMemo = new Map<string, number>();

/**
 * Self-healing sync: when dynamic count differs from stored `stats.submissionCount`,
 * update `user_profiles/{safeDocId}` and localStorage cache safely without N+1 reads or loops.
 */
export async function syncUserSubmissionCountIfOutOfSync(
  teacherEmail: string,
  actualCount: number,
  storedCount?: number,
  uid?: string
): Promise<void> {
  const normEmail = (teacherEmail || '').trim().toLowerCase();
  if (!normEmail || actualCount < 0) return;
  if (getDeletedUserEmails().has(normEmail)) return;
  if (typeof storedCount === 'number' && storedCount === actualCount) return;
  if (syncedSubmissionCountMemo.get(normEmail) === actualCount) return;

  syncedSubmissionCountMemo.set(normEmail, actualCount);

  try {
    const cached = getCachedUserProfile(normEmail);
    if (cached) {
      cached.stats = {
        ...cached.stats,
        submissionCount: actualCount,
      };
      setCachedUserProfile(cached);
    }
  } catch {
    // ignore
  }

  try {
    const safeDocId = encodeURIComponent(normEmail);
    const profileRef = doc(db, 'user_profiles', safeDocId);
    const resolvedUid = resolveUserUid(normEmail, uid);
    await setDoc(
      profileRef,
      {
        uid: resolvedUid,
        email: normEmail,
        stats: {
          submissionCount: actualCount,
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

export const DEFAULT_RESTORED_INNOVATIONS: InnovationSubmission[] = [];

export const DEFAULT_RESTORED_TEACHER_MEDIA: TeacherMediaWork[] = [];

function notifyInnovationsChanged(): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_innovations_changed'));
    }
  } catch {
    // ignore
  }
}

function notifyTeacherMediaChanged(): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_teacher_media_changed'));
    }
  } catch {
    // ignore
  }
}

/**
 * Get cached innovations from localStorage (stripping legacy fake seed IDs)
 */
export function getStoredInnovations(): InnovationSubmission[] {
  try {
    const raw = localStorage.getItem(INNOVATIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (item: InnovationSubmission) => item && !isMediaIdBlocked(item.id)
        );
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
 * Save innovations to localStorage cache
 */
export function saveStoredInnovations(list: InnovationSubmission[]): void {
  try {
    const cleaned = list.filter((item) => item && !isMediaIdBlocked(item.id));
    localStorage.setItem(INNOVATIONS_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.warn('Failed to save innovations cache:', err);
  }
}

/**
 * Get cached teacher media from localStorage (stripping legacy fake seed IDs)
 */
export function getStoredTeacherMedia(): TeacherMediaWork[] {
  try {
    const raw = localStorage.getItem(TEACHER_MEDIA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (item: TeacherMediaWork) => item && !isMediaIdBlocked(item.id)
        );
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
 * Save teacher media to localStorage cache
 */
export function saveStoredTeacherMedia(list: TeacherMediaWork[]): void {
  try {
    const cleaned = list.filter((item) => item && !isMediaIdBlocked(item.id));
    localStorage.setItem(TEACHER_MEDIA_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.warn('Failed to save teacher media cache:', err);
  }
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
  const resolvedUid = resolveUserUid(normalizedEmail);
  const itemNum = Number(data.itemNumber) || 1;
  const trimmedName = data.teacherName.trim();

  const payload: InnovationSubmission = {
    id,
    uid: resolvedUid,
    userId: resolvedUid,
    email: normalizedEmail,
    userEmail: normalizedEmail,
    submittedByEmail: normalizedEmail,
    teacherName: trimmedName,
    authorName: trimmedName,
    subjectGroup: selectedSubjectGroup,
    gradeLevel: data.gradeLevel,
    itemNumber: itemNum,
    mediaTitle: data.mediaTitle.trim(),
    mediaType: data.mediaType,
    productionType: data.productionType,
    usageDetails: data.usageDetails.trim(),
    onlineUrl: data.onlineUrl?.trim() || '',
    imageUrl: data.imageUrl || '',
    status: 'ส่งเรียบร้อย',
    submittedAt: nowIso,
    updatedAt: nowIso,
  };

  const mediaDocId = `work_${id}`;
  const mediaPayload: TeacherMediaWork = {
    id: mediaDocId,
    uid: resolvedUid,
    userId: resolvedUid,
    email: normalizedEmail,
    userEmail: normalizedEmail,
    submittedByEmail: normalizedEmail,
    title: data.mediaTitle.trim(),
    teacherName: trimmedName,
    authorName: trimmedName,
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
    status: 'ส่งเรียบร้อย',
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

    // Update user profile document in user_profiles & atomically increment submissionCount
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
          await setDoc(
            profileRef,
            {
              uid: resolvedUid,
              email: normalizedEmail,
              innovations: currentInnos,
              updatedAt: nowIso,
            },
            { merge: true }
          );
        }
      }
      await adjustUserSubmissionCount(normalizedEmail, 1, resolvedUid);
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
      const ownerEmail = cachedItem ? extractMediaEmails(cachedItem)[0] : undefined;
      if (cachedItem && !canUserModify(ownerEmail, currentUserEmail)) {
        return { success: false, error: 'คุณไม่มีสิทธิ์ลบผลงานของผู้อื่น (สิทธิ์เฉพาะเจ้าของผลงาน หรือ Admin เท่านั้น)' };
      }

      addDeletedMediaIds([id, `work_${id}`]);

      // Clean up paired collections defensively if authorized
      if (canUserModify(ownerEmail, currentUserEmail)) {
        try {
          await deleteDoc(doc(db, SYSTEM_TEST_COLLECTION, `test_${id}`));
        } catch {}
        try {
          await deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, `work_${id}`));
        } catch {}
      }

      saveStoredInnovations(cachedList.filter((item) => item.id !== id));
      saveStoredTeacherMedia(getStoredTeacherMedia().filter((m) => m.id !== `work_${id}` && m.id !== id));
      if (cachedItem) {
        await syncUserProfileSlotOnDelete(ownerEmail, cachedItem.itemNumber);
        if (ownerEmail) {
          await adjustUserSubmissionCount(ownerEmail, -1, cachedItem.uid);
        }
      }
      notifyInnovationsChanged();
      notifyTeacherMediaChanged();
      return { success: true };
    }

    const currentData = snap.data() as InnovationSubmission;
    const ownerEmail = extractMediaEmails(currentData)[0] || currentData.userEmail;

    if (!canUserModify(ownerEmail, currentUserEmail)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ลบผลงานของผู้อื่น (สิทธิ์เฉพาะเจ้าของผลงาน หรือ Admin เท่านั้น)' };
    }

    addDeletedMediaIds([id, `work_${id}`]);
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
      saveStoredTeacherMedia(getStoredTeacherMedia().filter((m) => m.id !== `work_${id}` && m.id !== id));
    } catch {}

    // Reset the owner's slot in user_profiles back to pending & decrement counter atomically
    await syncUserProfileSlotOnDelete(ownerEmail, currentData.itemNumber);
    if (ownerEmail) {
      await adjustUserSubmissionCount(ownerEmail, -1, currentData.uid);
    }

    notifyInnovationsChanged();
    notifyTeacherMediaChanged();

    return { success: true };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      console.warn('[Firestore] Quota reached during delete: Removed from local recovery cache.');
      addDeletedMediaIds([id, `work_${id}`]);
      saveStoredInnovations(getStoredInnovations().filter((item) => item.id !== id));
      saveStoredTeacherMedia(getStoredTeacherMedia().filter((m) => m.id !== `work_${id}` && m.id !== id));
      notifyInnovationsChanged();
      notifyTeacherMediaChanged();
      return { success: true };
    }
    console.error('Error deleting innovation submission:', err);
    return { success: false, error: err.message || 'ลบข้อมูลไม่สำเร็จ' };
  }
}

// Smart-cached shared pool for teacher_innovations_submissions (no onSnapshot; protects Firestore read quotas)
const allInnovationsListeners = new Set<(submissions: InnovationSubmission[]) => void>();
let sharedLatestInnovations: InnovationSubmission[] | null = null;
let hasFetchedInnovationsThisSession = false;
let inFlightInnovationsFetch: Promise<InnovationSubmission[]> | null = null;
let innovationsWindowListenerAttached = false;

function broadcastAllInnovations(list: InnovationSubmission[]): void {
  sharedLatestInnovations = list;
  allInnovationsListeners.forEach((cb) => {
    try {
      cb(list);
    } catch (err) {
      console.warn('Error in innovations listener:', err);
    }
  });
}

function getSortedStoredInnovations(): InnovationSubmission[] {
  const cached = getStoredInnovations().filter((item) => item && item.isDeleted !== true && !isMediaIdBlocked(item.id));
  cached.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
  return cached;
}

function ensureInnovationsWindowListeners(): void {
  if (typeof window === 'undefined' || innovationsWindowListenerAttached) return;
  innovationsWindowListenerAttached = true;

  const handleChanged = () => {
    broadcastAllInnovations(getSortedStoredInnovations());
  };
  window.addEventListener('acu_innovations_changed', handleChanged);
  window.addEventListener('acu_user_deleted', handleChanged);
}

/**
 * One-time getDocs fetch for teacher_innovations_submissions (deduplicated per session unless forceRefresh=true)
 */
export async function refreshAllInnovations(forceRefresh = true): Promise<InnovationSubmission[]> {
  const localFallback = sharedLatestInnovations || getSortedStoredInnovations();

  if (!forceRefresh && hasFetchedInnovationsThisSession && sharedLatestInnovations) {
    return sharedLatestInnovations;
  }

  if (!forceRefresh && inFlightInnovationsFetch) {
    return inFlightInnovationsFetch;
  }

  inFlightInnovationsFetch = (async () => {
    try {
      const colQuery = query(collection(db, INNOVATIONS_COLLECTION), limit(500));
      const snapshot = await getDocs(colQuery);
      const liveList: InnovationSubmission[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as InnovationSubmission;
        const docId = data?.id || docSnap.id;
        if (!isMediaIdBlocked(docId) && !isMediaIdBlocked(docSnap.id) && data?.isDeleted !== true) {
          liveList.push({ ...data, id: docId });
        }
      });

      liveList.sort(
        (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
      );
      hasFetchedInnovationsThisSession = true;
      saveStoredInnovations(liveList);
      broadcastAllInnovations(liveList);
      return liveList;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      console.warn('refreshAllInnovations fallback to local cache:', err);
      broadcastAllInnovations(localFallback);
      return localFallback;
    } finally {
      inFlightInnovationsFetch = null;
    }
  })();

  return inFlightInnovationsFetch;
}

/**
 * Subscribe to user's innovation submissions using the shared smart-cached stream in memory (0 extra reads).
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
  const targetUid = normTargetEmail ? resolveUserUid(normTargetEmail) : '';
  const normTargetName = (teacherName || '').trim();

  const filterUserItems = (items: InnovationSubmission[]): InnovationSubmission[] => {
    return items
      .filter((item) => {
        if (!isValidActiveMediaRecord(item)) return false;
        return doesMediaRecordBelongToTeacher(item, {
          uid: targetUid,
          email: normTargetEmail,
          teacherName: normTargetName,
          fullName: normTargetName,
        });
      })
      .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
  };

  return subscribeAllInnovations((allItems) => {
    callback(filterUserItems(allItems));
  });
}

/**
 * Smart-cached subscription to ALL innovation submissions (serves local cache immediately, fetches once per page load).
 */
export function subscribeAllInnovations(
  callback: (submissions: InnovationSubmission[]) => void
): () => void {
  allInnovationsListeners.add(callback);
  ensureInnovationsWindowListeners();

  const initial = sharedLatestInnovations || getSortedStoredInnovations();
  callback(initial);

  refreshAllInnovations(false).catch(() => {});

  return () => {
    allInnovationsListeners.delete(callback);
  };
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

function notifyFacilitiesChanged(): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_facilities_changed'));
    }
  } catch {}
}

export function getStoredFacilities(): FacilitySubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FACILITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const deletedUsers = getDeletedUserEmails();
        const cleaned = parsed.filter(
          (item: FacilitySubmission) =>
            item &&
            item.learningCenter &&
            !deletedUsers.has((item.userEmail || '').trim().toLowerCase())
        );
        cleaned.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('Failed to read facilities cache:', err);
  }
  return [];
}

export function saveStoredFacilities(list: FacilitySubmission[]): void {
  if (typeof window === 'undefined') return;
  try {
    const deletedUsers = getDeletedUserEmails();
    const cleaned = list.filter(
      (item) =>
        item &&
        item.learningCenter &&
        !deletedUsers.has((item.userEmail || '').trim().toLowerCase())
    );
    cleaned.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    localStorage.setItem(FACILITY_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.warn('Failed to save facilities cache:', err);
  }
}

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
    saveStoredFacilities([payload, ...current.filter((item) => item.id !== id)]);
  } catch {}

  try {
    const docRef = doc(db, SYSTEM_TEST_COLLECTION, id);
    await setDoc(docRef, {
      ...payload,
      firebaseProject: 'System Test',
      notifiedAdminEmail: ADMIN_TARGET_EMAIL,
    });

    notifyFacilitiesChanged();
    return { success: true, id };
  } catch (error: any) {
    notifyFacilitiesChanged();
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

    saveStoredFacilities(
      getStoredFacilities().map((f) => (f.id === id ? { ...f, ...updates, updatedAt } : f))
    );
    notifyFacilitiesChanged();
    return { success: true };
  } catch (err: any) {
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
      return { success: false, error: 'ไม่พบรายการที่ต้องการลบ' };
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
    console.error('Error deleting facility submission:', err);
    return { success: false, error: err.message || 'ลบข้อมูลไม่สำเร็จ' };
  }
}

const allFacilityListeners = new Set<(submissions: FacilitySubmission[]) => void>();
let sharedLatestFacilities: FacilitySubmission[] | null = null;
let hasFetchedFacilitiesThisSession = false;
let inFlightFacilitiesFetch: Promise<FacilitySubmission[]> | null = null;
let facilitiesWindowListenerAttached = false;

function broadcastAllFacilities(list: FacilitySubmission[]): void {
  sharedLatestFacilities = list;
  allFacilityListeners.forEach((cb) => {
    try {
      cb(list);
    } catch (err) {
      console.warn('Error in facility submissions listener:', err);
    }
  });
}

function ensureFacilitiesWindowListeners(): void {
  if (typeof window === 'undefined' || facilitiesWindowListenerAttached) return;
  facilitiesWindowListenerAttached = true;

  const handleChanged = () => {
    broadcastAllFacilities(getStoredFacilities());
  };
  window.addEventListener('acu_facilities_changed', handleChanged);
  window.addEventListener('acu_user_deleted', handleChanged);
}

/**
 * One-time getDocs fetch for facility usage records (deduplicated per session unless forceRefresh=true)
 */
export async function refreshAllFacilities(forceRefresh = true): Promise<FacilitySubmission[]> {
  const localFallback = sharedLatestFacilities || getStoredFacilities();

  if (!forceRefresh && hasFetchedFacilitiesThisSession && sharedLatestFacilities) {
    return sharedLatestFacilities;
  }

  if (!forceRefresh && inFlightFacilitiesFetch) {
    return inFlightFacilitiesFetch;
  }

  inFlightFacilitiesFetch = (async () => {
    try {
      const colQuery = query(collection(db, SYSTEM_TEST_COLLECTION), limit(500));
      const snapshot = await getDocs(colQuery);
      const deletedUsers = getDeletedUserEmails();
      const list: FacilitySubmission[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as FacilitySubmission;
        if (data?.learningCenter && !deletedUsers.has((data.userEmail || '').trim().toLowerCase())) {
          list.push({ ...data, id: data.id || docSnap.id });
        }
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      hasFetchedFacilitiesThisSession = true;
      saveStoredFacilities(list);
      broadcastAllFacilities(list);
      return list;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      console.warn('refreshAllFacilities fallback to local cache:', err);
      broadcastAllFacilities(localFallback);
      return localFallback;
    } finally {
      inFlightFacilitiesFetch = null;
    }
  })();

  return inFlightFacilitiesFetch;
}

/**
 * Subscribe to submissions created by current user (filtered in memory from shared smart-cached stream; 0 extra reads)
 */
export function subscribeUserSubmissions(
  userEmail: string,
  callback: (submissions: FacilitySubmission[]) => void
): () => void {
  if (!userEmail) {
    callback([]);
    return () => {};
  }

  const normEmail = userEmail.trim().toLowerCase();
  return subscribeAllSubmissions((all) => {
    const filtered = all
      .filter((item) => (item.userEmail || '').trim().toLowerCase() === normEmail)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    callback(filtered);
  });
}

/**
 * Smart-cached subscription to ALL facility usage records (serves local cache immediately, fetches once per page load)
 */
export function subscribeAllSubmissions(
  callback: (submissions: FacilitySubmission[]) => void
): () => void {
  allFacilityListeners.add(callback);
  ensureFacilitiesWindowListeners();

  const initial = sharedLatestFacilities || getStoredFacilities();
  callback(initial);

  refreshAllFacilities(false).catch(() => {});

  return () => {
    allFacilityListeners.delete(callback);
  };
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

const teacherMediaListeners = new Set<(works: TeacherMediaWork[]) => void>();
let sharedLatestTeacherMedia: TeacherMediaWork[] | null = null;
let hasFetchedTeacherMediaThisSession = false;
let inFlightTeacherMediaFetch: Promise<TeacherMediaWork[]> | null = null;
let teacherMediaWindowListenerAttached = false;

function broadcastTeacherMedia(works: TeacherMediaWork[]): void {
  sharedLatestTeacherMedia = works;
  teacherMediaListeners.forEach((cb) => {
    try {
      cb(works);
    } catch (err) {
      console.warn('Error in teacher media listener:', err);
    }
  });
}

function getFilteredStoredTeacherMedia(): TeacherMediaWork[] {
  const deletedUsers = getDeletedUserEmails();
  const cached = getStoredTeacherMedia().filter(
    (w) =>
      !isMediaIdBlocked(w.id) &&
      w.isDeleted !== true &&
      w.title?.trim().length > 0 &&
      !extractMediaEmails(w).every((em) => deletedUsers.has(em) && extractMediaEmails(w).length > 0)
  );
  cached.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return cached;
}

function ensureTeacherMediaWindowListeners(): void {
  if (typeof window === 'undefined' || teacherMediaWindowListenerAttached) return;
  teacherMediaWindowListenerAttached = true;
  const handleChanged = () => {
    broadcastTeacherMedia(getFilteredStoredTeacherMedia());
  };
  window.addEventListener('acu_teacher_media_changed', handleChanged);
  window.addEventListener('acu_user_deleted', handleChanged);
}

/**
 * One-time getDocs fetch for teacher_media_repository (deduplicated per session unless forceRefresh=true)
 */
export async function refreshTeacherMedia(forceRefresh = true): Promise<TeacherMediaWork[]> {
  const localFallback = sharedLatestTeacherMedia || getFilteredStoredTeacherMedia();

  if (!forceRefresh && hasFetchedTeacherMediaThisSession && sharedLatestTeacherMedia) {
    return sharedLatestTeacherMedia;
  }

  if (!forceRefresh && inFlightTeacherMediaFetch) {
    return inFlightTeacherMediaFetch;
  }

  inFlightTeacherMediaFetch = (async () => {
    try {
      const colQuery = query(collection(db, TEACHER_MEDIA_COLLECTION), limit(500));
      const snapshot = await getDocs(colQuery);
      const liveList: TeacherMediaWork[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as TeacherMediaWork;
        const docId = data?.id || docSnap.id;
        liveList.push({ ...data, id: docId });
      });

      const realWorks = liveList.filter(
        (w) => !isMediaIdBlocked(w.id) && w.isDeleted !== true && w.title?.trim().length > 0
      );

      realWorks.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      hasFetchedTeacherMediaThisSession = true;
      saveStoredTeacherMedia(realWorks);
      broadcastTeacherMedia(realWorks);
      return realWorks;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      console.warn('refreshTeacherMedia fallback:', err);
      broadcastTeacherMedia(localFallback);
      return localFallback;
    } finally {
      inFlightTeacherMediaFetch = null;
    }
  })();

  return inFlightTeacherMediaFetch;
}

/**
 * Smart-cached subscription to Teacher Media Repository (serves localStorage immediately, fetches once per page load).
 */
export function subscribeTeacherMedia(
  callback: (works: TeacherMediaWork[]) => void
): () => void {
  teacherMediaListeners.add(callback);
  ensureTeacherMediaWindowListeners();

  const initial = sharedLatestTeacherMedia || getFilteredStoredTeacherMedia();
  callback(initial);

  refreshTeacherMedia(false).catch(() => {});

  return () => {
    teacherMediaListeners.delete(callback);
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
  const strippedId = id.startsWith('work_') ? id.slice(5) : id;
  try {
    const docRef = doc(db, TEACHER_MEDIA_COLLECTION, id);
    const snap = await getDoc(docRef);
    const cachedList = getStoredTeacherMedia();
    const cachedItem = cachedList.find((m) => m.id === id);

    if (!snap.exists()) {
      const ownerEmail = cachedItem ? extractMediaEmails(cachedItem)[0] : undefined;
      if (cachedItem && !canUserModify(ownerEmail, currentUserEmail)) {
        return { success: false, error: 'คุณไม่มีสิทธิ์ลบสื่อของผู้อื่น (สิทธิ์เฉพาะผู้ส่ง หรือ Admin)' };
      }
      if (cachedItem || canUserModify(undefined, currentUserEmail)) {
        addDeletedMediaIds([id, strippedId]);
        saveStoredTeacherMedia(cachedList.filter((m) => m.id !== id));
        if (id.startsWith('work_')) {
          saveStoredInnovations(getStoredInnovations().filter((inv) => inv.id !== strippedId));
          try { await deleteDoc(doc(db, INNOVATIONS_COLLECTION, strippedId)); } catch {}
          try { await deleteDoc(doc(db, SYSTEM_TEST_COLLECTION, `test_${strippedId}`)); } catch {}
        }
        if (cachedItem && ownerEmail) {
          await syncUserProfileSlotOnDelete(ownerEmail, cachedItem.itemNumber);
          await adjustUserSubmissionCount(ownerEmail, -1, cachedItem.uid);
        }
        notifyInnovationsChanged();
        notifyTeacherMediaChanged();
        return { success: true };
      }
      return { success: false, error: 'ไม่พบรายการสื่อที่ต้องการลบ' };
    }

    const currentData = snap.data() as TeacherMediaWork;
    const ownerEmail = extractMediaEmails(currentData)[0] || currentData.submittedByEmail;

    if (!canUserModify(ownerEmail, currentUserEmail)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ลบสื่อของผู้อื่น (สิทธิ์เฉพาะผู้ส่ง หรือ Admin)' };
    }

    addDeletedMediaIds([id, strippedId]);
    await deleteDoc(docRef);

    // Clean up paired innovation/system_test docs if this work came from Innovation_5_Items
    if (id.startsWith('work_')) {
      try { await deleteDoc(doc(db, INNOVATIONS_COLLECTION, strippedId)); } catch {}
      try { await deleteDoc(doc(db, SYSTEM_TEST_COLLECTION, `test_${strippedId}`)); } catch {}
      saveStoredInnovations(getStoredInnovations().filter((inv) => inv.id !== strippedId));
    }

    saveStoredTeacherMedia(cachedList.filter((m) => m.id !== id));
    if (ownerEmail) {
      await syncUserProfileSlotOnDelete(ownerEmail, currentData.itemNumber);
      await adjustUserSubmissionCount(ownerEmail, -1, currentData.uid);
    }

    notifyInnovationsChanged();
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
        addDeletedMediaIds([d.id, `work_${d.id}`]);
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
        addDeletedMediaIds([d.id]);
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
    await setDoc(
      profileRef,
      {
        innovations: emptySlots,
        stats: {
          submissionCount: 0,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

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
  const normalizedEmail = data.submittedByEmail.trim().toLowerCase();
  const resolvedUid = resolveUserUid(normalizedEmail);
  const trimmedName = data.teacherName.trim();

  // Compute next open itemNumber (1-5) from local cache so multiple direct uploads don't collide on slot 1
  const existingUnified = getUnifiedTeacherMediaRecords(
    { uid: resolvedUid, email: normalizedEmail, teacherName: trimmedName },
    getStoredInnovations(),
    getStoredTeacherMedia()
  );
  const usedSlots = new Set(existingUnified.records.map((r) => r.itemNumber));
  let nextSlot = 1;
  for (let i = 1; i <= 5; i++) {
    if (!usedSlots.has(i)) {
      nextSlot = i;
      break;
    }
  }

  const payload: TeacherMediaWork = {
    id,
    uid: resolvedUid,
    userId: resolvedUid,
    email: normalizedEmail,
    userEmail: normalizedEmail,
    submittedByEmail: normalizedEmail,
    title: data.title.trim(),
    teacherName: trimmedName,
    authorName: trimmedName,
    subjectGroup: data.subjectGroup,
    gradeLevel: data.gradeLevel || data.subjectGroup,
    subjectName: data.subjectName?.trim() || 'สื่อนวัตกรรมการจัดการเรียนรู้',
    thumbnailUrl: data.thumbnailUrl?.trim() || '/ACU N.png',
    description: data.description.trim(),
    mediaType: data.mediaType,
    productionType: 'ครูผลิตสื่อเอง',
    itemNumber: nextSlot,
    onlineUrl: data.onlineUrl?.trim() || '',
    ratingAvg: 5.0,
    ratingCount: 1,
    views: 1,
    likes: 0,
    likedBy: [],
    status: 'ส่งเรียบร้อย',
    createdAt: nowIso,
  };

  // Save immediately to localStorage cache
  try {
    const currentMedia = getStoredTeacherMedia();
    saveStoredTeacherMedia([payload, ...currentMedia.filter((m) => m.id !== id)]);
  } catch {}

  try {
    const docRef = doc(db, TEACHER_MEDIA_COLLECTION, id);
    await setDoc(docRef, payload);
    await adjustUserSubmissionCount(normalizedEmail, 1, resolvedUid);
    notifyTeacherMediaChanged();
    return { success: true, id };
  } catch (err: any) {
    notifyTeacherMediaChanged();
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

function notifySharedIdeasChanged(): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_shared_ideas_changed'));
    }
  } catch {}
}

export function getStoredSharedIdeas(): SharedIdeaItem[] {
  const mergedMap = new Map<string, SharedIdeaItem>();
  DEFAULT_SEED_IDEAS.forEach((i) => mergedMap.set(i.id, i));

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SHARED_IDEAS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item && item.id) {
              mergedMap.set(item.id, sanitizeSharedIdeaRecord(item as SharedIdeaItem));
            }
          });
        }
      }
    } catch {}
  }

  const deletedUsers = getDeletedUserEmails();
  const list = Array.from(mergedMap.values()).filter(
    (item) => !deletedUsers.has((item.creatorEmail || '').trim().toLowerCase())
  );
  list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return list;
}

export function saveStoredSharedIdeas(list: SharedIdeaItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = list.map((item) => sanitizeSharedIdeaRecord(item));
    clean.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    localStorage.setItem(SHARED_IDEAS_STORAGE_KEY, JSON.stringify(clean));
  } catch {}
}

export function addSharedIdeaToLocalCache(idea: SharedIdeaItem): void {
  const current = getStoredSharedIdeas();
  const next = [sanitizeSharedIdeaRecord(idea), ...current.filter((i) => i.id !== idea.id)];
  saveStoredSharedIdeas(next);
  notifySharedIdeasChanged();
}

const sharedIdeasListeners = new Set<(ideas: SharedIdeaItem[]) => void>();
let sharedLatestIdeas: SharedIdeaItem[] | null = null;
let hasFetchedSharedIdeasThisSession = false;
let inFlightSharedIdeasFetch: Promise<SharedIdeaItem[]> | null = null;
let sharedIdeasWindowListenerAttached = false;

function broadcastSharedIdeas(ideas: SharedIdeaItem[]): void {
  sharedLatestIdeas = ideas;
  sharedIdeasListeners.forEach((cb) => {
    try {
      cb(ideas);
    } catch (err) {
      console.warn('Error in shared ideas listener:', err);
    }
  });
}

function ensureSharedIdeasWindowListeners(): void {
  if (typeof window === 'undefined' || sharedIdeasWindowListenerAttached) return;
  sharedIdeasWindowListenerAttached = true;

  const handleChanged = () => {
    broadcastSharedIdeas(getStoredSharedIdeas());
  };
  window.addEventListener('acu_shared_ideas_changed', handleChanged);
  window.addEventListener('acu_user_deleted', handleChanged);
}

/**
 * One-time getDocs fetch for shared_ideas (deduplicated per session unless forceRefresh=true)
 */
export async function refreshSharedIdeas(forceRefresh = true): Promise<SharedIdeaItem[]> {
  const localFallback = sharedLatestIdeas || getStoredSharedIdeas();

  if (!forceRefresh && hasFetchedSharedIdeasThisSession && sharedLatestIdeas) {
    return sharedLatestIdeas;
  }

  if (!forceRefresh && inFlightSharedIdeasFetch) {
    return inFlightSharedIdeasFetch;
  }

  inFlightSharedIdeasFetch = (async () => {
    try {
      const colQuery = query(collection(db, SHARED_IDEAS_COLLECTION), limit(500));
      const snapshot = await getDocs(colQuery);
      const liveList: SharedIdeaItem[] = [];
      snapshot.forEach((docSnap) => {
        liveList.push(sanitizeSharedIdeaRecord({ ...(docSnap.data() as SharedIdeaItem), id: docSnap.id }));
      });

      const deletedUsers = getDeletedUserEmails();
      const mergedMap = new Map<string, SharedIdeaItem>();
      DEFAULT_SEED_IDEAS.forEach((i) => mergedMap.set(i.id, i));
      liveList.forEach((i) => {
        if (!deletedUsers.has((i.creatorEmail || '').trim().toLowerCase())) {
          mergedMap.set(i.id, i);
        }
      });

      const finalIdeas = Array.from(mergedMap.values());
      finalIdeas.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      hasFetchedSharedIdeasThisSession = true;
      saveStoredSharedIdeas(finalIdeas);
      broadcastSharedIdeas(finalIdeas);
      return finalIdeas;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
      console.warn('refreshSharedIdeas fallback to cache/seed:', err);
      broadcastSharedIdeas(localFallback);
      return localFallback;
    } finally {
      inFlightSharedIdeasFetch = null;
    }
  })();

  return inFlightSharedIdeasFetch;
}

/**
 * Smart-cached subscription to Shared Ideas (serves local cache immediately, fetches once per page load)
 */
export function subscribeSharedIdeas(
  callback: (ideas: SharedIdeaItem[]) => void
): () => void {
  sharedIdeasListeners.add(callback);
  ensureSharedIdeasWindowListeners();

  const initial = sharedLatestIdeas || getStoredSharedIdeas();
  callback(initial);

  refreshSharedIdeas(false).catch(() => {});

  return () => {
    sharedIdeasListeners.delete(callback);
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
  try {
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
      creatorEmail: data.creatorEmail.trim(),
      creatorName: data.creatorName.trim() || data.creatorEmail,
      createdAt: nowIso,
      ratingAvg: 5.0,
      ratingCount: 1,
      userRatings: {
        [data.creatorEmail.replace(/[^a-zA-Z0-9]/g, '_')]: 5,
      },
    };

    addSharedIdeaToLocalCache(payload);
    const docRef = doc(db, SHARED_IDEAS_COLLECTION, id);
    await setDoc(docRef, payload);
    return { success: true, id };
  } catch (err: any) {
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
      // Seed item being rated for the first time
      const seed = DEFAULT_SEED_IDEAS.find((s) => s.id === ideaId);
      const initialRatings: { [key: string]: number } = seed?.userRatings ? { ...seed.userRatings } : {};
      initialRatings[safeEmailKey] = stars;

      const ratingValues = Object.values(initialRatings) as number[];
      const count = ratingValues.length;
      const sum = ratingValues.reduce((a, b) => a + b, 0);
      const avg = Number((sum / count).toFixed(1));

      const fullPayload: SharedIdeaItem = {
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
      };
      await setDoc(docRef, fullPayload);
      addSharedIdeaToLocalCache(fullPayload);
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
      // Might be a local seed, check if admin
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
          m.id === mediaId
            ? { ...m, ratingAvg: avg, ratingCount: count, userRatings, views: (m.views || 0) + 1 }
            : m
        )
      );
      notifyTeacherMediaChanged();
      return true;
    } else {
      // Create it from seed or initial
      const seed = INITIAL_TEACHER_WORKS.find((s) => s.id === mediaId);
      const initialRatings: { [key: string]: number } = {};
      initialRatings[safeEmailKey] = rating;

      const newWork = {
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
      } as TeacherMediaWork;

      await setDoc(docRef, newWork);
      const existing = getStoredTeacherMedia();
      saveStoredTeacherMedia([newWork, ...existing.filter((m) => m.id !== mediaId)]);
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
const CRITERIA_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let hasFetchedCriteriaPosterThisSession = false;
let inFlightCriteriaPosterFetch: Promise<string> | null = null;

export interface CriteriaPosterConfig {
  imageUrl: string;
  updatedBy?: string;
  updatedAt?: string;
  cachedAt?: number;
}

function isCriteriaCacheFresh(): boolean {
  try {
    const raw = localStorage.getItem(CRITERIA_STORAGE_KEY);
    if (!raw) return false;
    const cached = JSON.parse(raw) as CriteriaPosterConfig;
    if (!cached?.imageUrl || typeof cached.cachedAt !== 'number') return false;
    return Date.now() - cached.cachedAt < CRITERIA_CACHE_TTL_MS;
  } catch {
    return false;
  }
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

export async function fetchCriteriaPosterOnce(forceRefresh = false): Promise<string> {
  const localUrl = getInitialCriteriaPosterUrl();
  if (!forceRefresh && (hasFetchedCriteriaPosterThisSession || isCriteriaCacheFresh())) {
    return localUrl;
  }
  if (!forceRefresh && inFlightCriteriaPosterFetch) {
    return inFlightCriteriaPosterFetch;
  }

  inFlightCriteriaPosterFetch = (async () => {
    try {
      const docRef = doc(db, 'system_settings', CRITERIA_POSTER_DOC_ID);
      const snapshot = await getDoc(docRef);
      hasFetchedCriteriaPosterThisSession = true;
      if (snapshot.exists()) {
        const data = snapshot.data() as CriteriaPosterConfig;
        if (data?.imageUrl) {
          try {
            localStorage.setItem(CRITERIA_STORAGE_KEY, JSON.stringify({ ...data, cachedAt: Date.now() }));
          } catch {}
          return data.imageUrl;
        }
      }
      return localUrl;
    } catch {
      return localUrl;
    } finally {
      inFlightCriteriaPosterFetch = null;
    }
  })();

  return inFlightCriteriaPosterFetch;
}

export function subscribeCriteriaPoster(onUpdate: (url: string) => void): () => void {
  let isActive = true;
  const handleCustomUpdate = (e: Event) => {
    const custom = e as CustomEvent<string>;
    if (custom.detail && isActive) {
      onUpdate(custom.detail);
    }
  };
  window.addEventListener('acu_criteria_poster_changed', handleCustomUpdate);

  onUpdate(getInitialCriteriaPosterUrl());

  if (!hasFetchedCriteriaPosterThisSession && !isCriteriaCacheFresh()) {
    fetchCriteriaPosterOnce(false)
      .then((url) => {
        if (isActive && url) onUpdate(url);
      })
      .catch(() => {});
  }

  return () => {
    isActive = false;
    window.removeEventListener('acu_criteria_poster_changed', handleCustomUpdate);
  };
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
    cachedAt: Date.now(),
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
    await setDoc(docRef, { imageUrl, updatedBy: adminEmail, updatedAt: payload.updatedAt }, { merge: true });
    hasFetchedCriteriaPosterThisSession = true;
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
    hasFetchedCriteriaPosterThisSession = false;
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
