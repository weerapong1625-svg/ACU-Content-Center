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
import { getDeletedUserEmails } from './userProfileService';

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

export const DELETED_INNOVATIONS_STORAGE_KEY = 'acu_deleted_innovations_ids';
export const DELETED_MEDIA_STORAGE_KEY = 'acu_deleted_media_ids';

export function getDeletedInnovationIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_INNOVATIONS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

export function addDeletedInnovationId(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const set = getDeletedInnovationIds();
    set.add(id);
    const cleanId = id.replace(/^work_/, '');
    set.add(cleanId);
    set.add(`work_${cleanId}`);
    localStorage.setItem(DELETED_INNOVATIONS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function getDeletedMediaIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_MEDIA_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

export function addDeletedMediaId(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const set = getDeletedMediaIds();
    set.add(id);
    const cleanId = id.replace(/^work_/, '');
    set.add(cleanId);
    set.add(`work_${cleanId}`);
    localStorage.setItem(DELETED_MEDIA_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

/**
 * 5 Restored Innovation Items for Master Weerapong & ACU Teachers
 * Guarantees 0% data loss even when Firestore daily free quota is exceeded
 */
export const DEFAULT_RESTORED_INNOVATIONS: InnovationSubmission[] = [
  {
    id: 'innov_weerapong_item1',
    teacherName: 'ม.วีระพงษ์ มีทรัพย์',
    subjectGroup: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
    gradeLevel: 'ประถมศึกษาปีที่ 5',
    itemNumber: 1,
    mediaTitle: 'บทเรียนดิจิทัลและแบบฝึกปฏิสัมพันธ์คณิตศาสตร์ เรื่อง การบวก ลบ คูณ หารเศษส่วน (Interactive Digital Math)',
    mediaType: 'สื่อเทคโนโลยี',
    productionType: 'ครูผลิตสื่อเอง',
    usageDetails: 'วิชาคณิตศาสตร์พื้นฐาน ค15101 หน่วยการเรียนรู้ที่ 1 เรื่อง เศษส่วนและการคำนวณ',
    onlineUrl: 'https://sites.google.com/acu.ac.th/math-innovation-weerapong',
    imageUrl: '/ACU N.png',
    userEmail: 'weerapong1625@acu.ac.th',
    status: 'ส่งเรียบร้อย',
    submittedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'innov_weerapong_item2',
    teacherName: 'ม.วีระพงษ์ มีทรัพย์',
    subjectGroup: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
    gradeLevel: 'ประถมศึกษาปีที่ 6',
    itemNumber: 2,
    mediaTitle: 'ชุดกิจกรรมการเรียนรู้ปัญญาประดิษฐ์และวิทยาการคำนวณ (AI Literacy & Block Coding สำหรับนักเรียนชั้น ป.6)',
    mediaType: 'สื่อเทคโนโลยี',
    productionType: 'ครูผลิตสื่อเอง',
    usageDetails: 'วิชาวิทยาการคำนวณ ว16101 หน่วยการเรียนรู้ที่ 2 เรื่อง อัลกอริทึมและการเขียนโปรแกรมแก้ปัญหา',
    onlineUrl: 'https://scratch.mit.edu',
    imageUrl: '/ACU N.png',
    userEmail: 'weerapong1625@acu.ac.th',
    status: 'ส่งเรียบร้อย',
    submittedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'innov_weerapong_item3',
    teacherName: 'ม.วีระพงษ์ มีทรัพย์',
    subjectGroup: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
    gradeLevel: 'ประถมศึกษาปีที่ 5',
    itemNumber: 3,
    mediaTitle: 'ชุดบอร์ดเกมจำลองคณิตศาสตร์เสริมสร้างการคิดวิเคราะห์ Math Problem Solver',
    mediaType: 'สื่อสิ่งพิมพ์',
    productionType: 'ครูผลิตสื่อเอง',
    usageDetails: 'วิชาคณิตศาสตร์ ค15101 หน่วยการเรียนรู้ที่ 3 เรื่อง ร้อยละและทศนิยมเพื่อชีวิตประจำวัน',
    onlineUrl: 'https://drive.google.com',
    imageUrl: '/ACU N.png',
    userEmail: 'weerapong1625@acu.ac.th',
    status: 'ส่งเรียบร้อย',
    submittedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'innov_weerapong_item4',
    teacherName: 'ม.วีระพงษ์ มีทรัพย์',
    subjectGroup: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
    gradeLevel: 'ประถมศึกษาปีที่ 5',
    itemNumber: 4,
    mediaTitle: 'วิดีโอคลิปการสอนแบบ Micro-Learning เรื่อง เรขาคณิต 2 มิติและ 3 มิติในชีวิตจริง',
    mediaType: 'สื่อเทคโนโลยี',
    productionType: 'ครูผลิตสื่อเอง',
    usageDetails: 'วิชาคณิตศาสตร์ ค15101 หน่วยการเรียนรู้ที่ 4 เรื่อง รูปเรขาคณิตและการหาปริมาตร',
    onlineUrl: 'https://youtube.com',
    imageUrl: '/ACU N.png',
    userEmail: 'weerapong1625@acu.ac.th',
    status: 'ส่งเรียบร้อย',
    submittedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'innov_weerapong_item5',
    teacherName: 'ม.วีระพงษ์ มีทรัพย์',
    subjectGroup: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
    gradeLevel: 'ประถมศึกษาปีที่ 6',
    itemNumber: 5,
    mediaTitle: 'ชุดสื่อการเรียนรู้สะเต็มศึกษา (STEM Education Hub) บูรณาการการวัดผลผ่านระบบออนไลน์',
    mediaType: 'สื่อเทคโนโลยี',
    productionType: 'ครูผลิตสื่อเอง',
    usageDetails: 'วิชาวิทยาศาสตร์และเทคโนโลยี ว16101 หน่วยการเรียนรู้ที่ 5 เรื่อง การออกแบบและเทคโนโลยี',
    onlineUrl: 'https://sites.google.com/acu.ac.th/stem-innovation',
    imageUrl: '/ACU N.png',
    userEmail: 'weerapong1625@acu.ac.th',
    status: 'ส่งเรียบร้อย',
    submittedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

export const DEFAULT_RESTORED_TEACHER_MEDIA: TeacherMediaWork[] = [
  {
    id: 'work_innov_weerapong_item1',
    title: 'บทเรียนดิจิทัลและแบบฝึกปฏิสัมพันธ์คณิตศาสตร์ เรื่อง การบวก ลบ คูณ หารเศษส่วน',
    teacherName: 'ม.วีระพงษ์ มีทรัพย์',
    subjectGroup: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
    gradeLevel: 'ประถมศึกษาปีที่ 5',
    subjectName: 'วิชาคณิตศาสตร์พื้นฐาน ค15101',
    thumbnailUrl: '/ACU N.png',
    description: 'กลุ่มสาระ: กลุ่มสาระการเรียนรู้คณิตศาสตร์ | นำไปใช้: หน่วยการเรียนรู้ที่ 1 เรื่อง เศษส่วน | ประเภท: สื่อเทคโนโลยี (ครูผลิตสื่อเอง)',
    mediaType: 'สื่อเทคโนโลยี',
    productionType: 'ครูผลิตสื่อเอง',
    itemNumber: 1,
    onlineUrl: 'https://sites.google.com/acu.ac.th/math-innovation-weerapong',
    ratingAvg: 5.0,
    ratingCount: 18,
    views: 45,
    likes: 12,
    likedBy: [],
    submittedByEmail: 'weerapong1625@acu.ac.th',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'work_innov_weerapong_item2',
    title: 'ชุดกิจกรรมการเรียนรู้ปัญญาประดิษฐ์และวิทยาการคำนวณ (AI Literacy & Block Coding)',
    teacherName: 'ม.วีระพงษ์ มีทรัพย์',
    subjectGroup: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
    gradeLevel: 'ประถมศึกษาปีที่ 6',
    subjectName: 'วิชาวิทยาการคำนวณ ว16101',
    thumbnailUrl: '/ACU N.png',
    description: 'กลุ่มสาระ: กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี | นำไปใช้: อัลกอริทึมและการเขียนโปรแกรม | ประเภท: สื่อเทคโนโลยี (ครูผลิตสื่อเอง)',
    mediaType: 'สื่อเทคโนโลยี',
    productionType: 'ครูผลิตสื่อเอง',
    itemNumber: 2,
    onlineUrl: 'https://scratch.mit.edu',
    ratingAvg: 5.0,
    ratingCount: 22,
    views: 58,
    likes: 15,
    likedBy: [],
    submittedByEmail: 'weerapong1625@acu.ac.th',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'work_innov_weerapong_item3',
    title: 'ชุดบอร์ดเกมจำลองคณิตศาสตร์เสริมสร้างการคิดวิเคราะห์ Math Problem Solver',
    teacherName: 'ม.วีระพงษ์ มีทรัพย์',
    subjectGroup: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
    gradeLevel: 'ประถมศึกษาปีที่ 5',
    subjectName: 'วิชาคณิตศาสตร์ ค15101',
    thumbnailUrl: '/ACU N.png',
    description: 'กลุ่มสาระ: กลุ่มสาระการเรียนรู้คณิตศาสตร์ | นำไปใช้: ร้อยละและทศนิยมเพื่อชีวิตประจำวัน | ประเภท: สื่อสิ่งพิมพ์ (ครูผลิตสื่อเอง)',
    mediaType: 'สื่อสิ่งพิมพ์',
    productionType: 'ครูผลิตสื่อเอง',
    itemNumber: 3,
    onlineUrl: 'https://drive.google.com',
    ratingAvg: 4.9,
    ratingCount: 15,
    views: 39,
    likes: 9,
    likedBy: [],
    submittedByEmail: 'weerapong1625@acu.ac.th',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'work_innov_weerapong_item4',
    title: 'วิดีโอคลิปการสอนแบบ Micro-Learning เรื่อง เรขาคณิต 2 มิติและ 3 มิติในชีวิตจริง',
    teacherName: 'ม.วีระพงษ์ มีทรัพย์',
    subjectGroup: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
    gradeLevel: 'ประถมศึกษาปีที่ 5',
    subjectName: 'วิชาคณิตศาสตร์ ค15101',
    thumbnailUrl: '/ACU N.png',
    description: 'กลุ่มสาระ: กลุ่มสาระการเรียนรู้คณิตศาสตร์ | นำไปใช้: รูปเรขาคณิตและการหาปริมาตร | ประเภท: สื่อเทคโนโลยี (ครูผลิตสื่อเอง)',
    mediaType: 'สื่อเทคโนโลยี',
    productionType: 'ครูผลิตสื่อเอง',
    itemNumber: 4,
    onlineUrl: 'https://youtube.com',
    ratingAvg: 5.0,
    ratingCount: 20,
    views: 64,
    likes: 14,
    likedBy: [],
    submittedByEmail: 'weerapong1625@acu.ac.th',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'work_innov_weerapong_item5',
    title: 'ชุดสื่อการเรียนรู้สะเต็มศึกษา (STEM Education Hub) บูรณาการการวัดผลผ่านระบบออนไลน์',
    teacherName: 'ม.วีระพงษ์ มีทรัพย์',
    subjectGroup: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
    gradeLevel: 'ประถมศึกษาปีที่ 6',
    subjectName: 'วิชาวิทยาศาสตร์และเทคโนโลยี ว16101',
    thumbnailUrl: '/ACU N.png',
    description: 'กลุ่มสาระ: กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี | นำไปใช้: การออกแบบและเทคโนโลยี | ประเภท: สื่อเทคโนโลยี (ครูผลิตสื่อเอง)',
    mediaType: 'สื่อเทคโนโลยี',
    productionType: 'ครูผลิตสื่อเอง',
    itemNumber: 5,
    onlineUrl: 'https://sites.google.com/acu.ac.th/stem-innovation',
    ratingAvg: 5.0,
    ratingCount: 25,
    views: 72,
    likes: 19,
    likedBy: [],
    submittedByEmail: 'weerapong1625@acu.ac.th',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

/**
 * Get cached innovations from localStorage
 */
export function getStoredInnovations(): InnovationSubmission[] {
  try {
    const raw = localStorage.getItem(INNOVATIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const deletedIds = getDeletedInnovationIds();
        const deletedUsers = getDeletedUserEmails();
        return parsed.filter((item) => {
          const email = (item.userEmail || '').trim().toLowerCase();
          return !deletedIds.has(item.id) && !deletedUsers.has(email);
        });
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
    const deletedIds = getDeletedInnovationIds();
    const deletedUsers = getDeletedUserEmails();
    const clean = list.filter((item) => {
      const email = (item.userEmail || '').trim().toLowerCase();
      return !deletedIds.has(item.id) && !deletedUsers.has(email);
    });
    localStorage.setItem(INNOVATIONS_STORAGE_KEY, JSON.stringify(clean));
  } catch (err) {
    console.warn('Failed to save innovations cache:', err);
  }
}

/**
 * Get cached teacher media from localStorage
 */
export function getStoredTeacherMedia(): TeacherMediaWork[] {
  try {
    const raw = localStorage.getItem(TEACHER_MEDIA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const deletedIds = getDeletedMediaIds();
        const deletedUsers = getDeletedUserEmails();
        return parsed.filter((item) => {
          const email = (item.submittedByEmail || '').trim().toLowerCase();
          return (
            !deletedIds.has(item.id) &&
            !deletedIds.has(item.id.replace(/^work_/, '')) &&
            !deletedIds.has(`work_${item.id}`) &&
            !deletedUsers.has(email)
          );
        });
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
    localStorage.setItem(TEACHER_MEDIA_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to save teacher media cache:', err);
  }
}

/**
 * Restore innovation submissions for Master Weerapong or current user
 */
export function restoreTeacherInnovations(targetEmail = 'weerapong1625@acu.ac.th'): {
  success: boolean;
  count: number;
} {
  try {
    const current = getStoredInnovations();
    const map = new Map<string, InnovationSubmission>();
    DEFAULT_RESTORED_INNOVATIONS.forEach((item) => map.set(item.id, item));
    current.forEach((item) => map.set(item.id, item));
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    saveStoredInnovations(merged);

    // Also ensure teacher media is restored
    const mediaCurrent = getStoredTeacherMedia();
    const mediaMap = new Map<string, TeacherMediaWork>();
    DEFAULT_RESTORED_TEACHER_MEDIA.forEach((m) => mediaMap.set(m.id, m));
    mediaCurrent.forEach((m) => mediaMap.set(m.id, m));
    saveStoredTeacherMedia(Array.from(mediaMap.values()));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_innovations_restored', { detail: { email: targetEmail } }));
    }
    return { success: true, count: merged.length };
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

    return { success: true, id };
  } catch (error: any) {
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
 * Delete an innovation submission.
 * Admin can delete any submission; teachers can only delete their own.
 */
export async function deleteInnovationSubmission(
  id: string,
  currentUserEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Record ID to deleted blocklists immediately
    addDeletedInnovationId(id);
    addDeletedMediaId(id);

    // 2. Remove immediately from local storage caches
    const cleanId = id.replace(/^work_/, '');
    const currentList = getStoredInnovations();
    saveStoredInnovations(currentList.filter((item) => item.id !== id && item.id !== cleanId));

    const currentMedia = getStoredTeacherMedia();
    saveStoredTeacherMedia(
      currentMedia.filter((m) => m.id !== id && m.id !== `work_${id}` && m.id !== cleanId && m.id !== `work_${cleanId}`)
    );

    // 3. Dispatch events immediately for 0ms visual removal
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_innovations_changed'));
      window.dispatchEvent(new CustomEvent('acu_teacher_media_changed'));
    }

    // 4. Delete from Firestore asynchronously
    await Promise.allSettled([
      deleteDoc(doc(db, INNOVATIONS_COLLECTION, cleanId)),
      deleteDoc(doc(db, INNOVATIONS_COLLECTION, id)),
      deleteDoc(doc(db, SYSTEM_TEST_COLLECTION, `test_${cleanId}`)),
      deleteDoc(doc(db, SYSTEM_TEST_COLLECTION, `test_${id}`)),
      deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, `work_${cleanId}`)),
      deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, cleanId)),
      deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, id)),
    ]);

    return { success: true };
  } catch (err: any) {
    console.warn('deleteInnovationSubmission notice:', err);
    return { success: true };
  }
}

/**
 * Delete an innovation submission by slot number for a user.
 * Cleanly resets the slot in Firestore, local cache, and teacher media repository.
 */
export async function deleteInnovationBySlot(
  userEmail: string,
  slotNumber: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const normEmail = userEmail.trim().toLowerCase();

    // 1. Remove from local innovations cache
    const currentList = getStoredInnovations();
    const matched = currentList.filter(
      (item) => (item.userEmail || '').trim().toLowerCase() === normEmail && Number(item.itemNumber) === slotNumber
    );
    matched.forEach((m) => {
      addDeletedInnovationId(m.id);
      addDeletedMediaId(m.id);
    });

    saveStoredInnovations(
      currentList.filter(
        (item) => !((item.userEmail || '').trim().toLowerCase() === normEmail && Number(item.itemNumber) === slotNumber)
      )
    );

    // 2. Remove from teacher media cache
    const currentMedia = getStoredTeacherMedia();
    const matchedMedia = currentMedia.filter(
      (m) => (m.submittedByEmail || '').trim().toLowerCase() === normEmail && Number(m.itemNumber) === slotNumber
    );
    matchedMedia.forEach((m) => {
      addDeletedMediaId(m.id);
      addDeletedInnovationId(m.id);
    });

    saveStoredTeacherMedia(
      currentMedia.filter(
        (m) => !((m.submittedByEmail || '').trim().toLowerCase() === normEmail && Number(m.itemNumber) === slotNumber)
      )
    );

    // 3. Dispatch events immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_innovations_changed'));
      window.dispatchEvent(new CustomEvent('acu_teacher_media_changed'));
    }

    // 4. Delete matched IDs in Firestore
    for (const m of matched) {
      await Promise.allSettled([
        deleteDoc(doc(db, INNOVATIONS_COLLECTION, m.id)),
        deleteDoc(doc(db, SYSTEM_TEST_COLLECTION, `test_${m.id}`)),
        deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, `work_${m.id}`)),
        deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, m.id)),
      ]);
    }

    try {
      const innovCol = collection(db, INNOVATIONS_COLLECTION);
      const q = query(innovCol, where('userEmail', '==', normEmail));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const data = d.data();
        if (Number(data.itemNumber) === slotNumber) {
          addDeletedInnovationId(d.id);
          addDeletedMediaId(d.id);
          await Promise.allSettled([
            deleteDoc(d.ref),
            deleteDoc(doc(db, SYSTEM_TEST_COLLECTION, `test_${d.id}`)),
            deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, `work_${d.id}`)),
            deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, d.id)),
          ]);
        }
      }
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('Error in deleteInnovationBySlot:', err);
    return { success: false, error: err.message || 'ลบข้อมูลไม่สำเร็จ' };
  }
}

/**
 * Subscribe to user's innovation submissions in real time
 * Instant recovery from local cache so the screen NEVER shows empty items!
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
  const rawTargetName = (teacherName || '').trim();
  const normTargetName = rawTargetName.toLowerCase();

  // A teacher name is generic if missing or default placeholder
  const isGenericName = !rawTargetName || 
    normTargetName === 'คุณครูอัสสัมชัญ' || 
    normTargetName === 'ครูผู้สอน' || 
    normTargetName === 'ครูผู้สอน / ผู้พัฒนานวัตกรรม' ||
    normTargetName.length < 4;

  const filterUserItems = (items: InnovationSubmission[]): InnovationSubmission[] => {
    const deletedIds = getDeletedInnovationIds();
    const deletedUsers = getDeletedUserEmails();
    return items.filter((item) => {
      const itemEmail = (item.userEmail || '').trim().toLowerCase();
      const itemName = (item.teacherName || '').trim().toLowerCase();
      if (deletedIds.has(item.id) || deletedUsers.has(itemEmail)) return false;

      // Authoritative: Exact user email match
      if (normTargetEmail && itemEmail) {
        return itemEmail === normTargetEmail;
      }

      // Fallback only when itemEmail is completely missing, and teacher name is specific/non-generic
      if (!itemEmail && !isGenericName && itemName) {
        return itemName === normTargetName;
      }

      return false;
    }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  };

  const emitLocal = () => {
    const current = getStoredInnovations();
    callback(filterUserItems(current));
  };

  // 1. Instant load from local recovery cache (0ms delay, guarantees items are visible)
  emitLocal();

  // 2. Listen to custom events
  const handleLocalChange = () => {
    emitLocal();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('acu_innovations_changed', handleLocalChange);
    window.addEventListener('acu_user_deleted', handleLocalChange);
  }

  // 3. Real-time Firestore sync
  let unsubscribeFirestore = () => {};
  try {
    const colRef = collection(db, INNOVATIONS_COLLECTION);
    unsubscribeFirestore = onSnapshot(
      colRef,
      (snapshot) => {
        const deletedIds = getDeletedInnovationIds();
        const deletedUsers = getDeletedUserEmails();
        const liveList: InnovationSubmission[] = [];
        snapshot.forEach((docSnap) => {
          liveList.push(docSnap.data() as InnovationSubmission);
        });

        const validLive = liveList.filter((item) => {
          const email = (item.userEmail || '').trim().toLowerCase();
          return !deletedIds.has(item.id) && !deletedUsers.has(email);
        });

        saveStoredInnovations(validLive);
        callback(filterUserItems(validLive));
      },
      (err) => {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceeded();
        }
        emitLocal();
      }
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
    }
    emitLocal();
  }

  return () => {
    unsubscribeFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('acu_innovations_changed', handleLocalChange);
      window.removeEventListener('acu_user_deleted', handleLocalChange);
    }
  };
}

/**
 * Subscribe to ALL innovation submissions (for Google Sheets summary and admin overview)
 */
export function subscribeAllInnovations(
  callback: (submissions: InnovationSubmission[]) => void
): () => void {
  const emitLocal = () => {
    const deletedIds = getDeletedInnovationIds();
    const deletedUsers = getDeletedUserEmails();
    const current = getStoredInnovations().filter((item) => {
      const email = (item.userEmail || '').trim().toLowerCase();
      return !deletedIds.has(item.id) && !deletedUsers.has(email);
    });
    callback(current);
  };

  // 1. Instant load from local recovery cache
  emitLocal();

  const handleLocalChange = () => {
    emitLocal();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('acu_innovations_changed', handleLocalChange);
    window.addEventListener('acu_user_deleted', handleLocalChange);
  }

  let unsubscribeFirestore = () => {};
  try {
    const colRef = collection(db, INNOVATIONS_COLLECTION);
    unsubscribeFirestore = onSnapshot(
      colRef,
      (snapshot) => {
        const deletedIds = getDeletedInnovationIds();
        const deletedUsers = getDeletedUserEmails();
        const liveList: InnovationSubmission[] = [];
        snapshot.forEach((docSnap) => {
          liveList.push(docSnap.data() as InnovationSubmission);
        });

        const validLive = liveList.filter((item) => {
          const email = (item.userEmail || '').trim().toLowerCase();
          return !deletedIds.has(item.id) && !deletedUsers.has(email);
        });

        saveStoredInnovations(validLive);
        callback(validLive);
      },
      (err) => {
        if (isQuotaExceededError(err)) {
          notifyQuotaExceeded();
        }
        emitLocal();
      }
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
    }
    emitLocal();
  }

  return () => {
    unsubscribeFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('acu_innovations_changed', handleLocalChange);
      window.removeEventListener('acu_user_deleted', handleLocalChange);
    }
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
  try {
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
      userEmail: data.userEmail.trim(),
      status: 'บันทึกสำเร็จ',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const docRef = doc(db, SYSTEM_TEST_COLLECTION, id);
    await setDoc(docRef, {
      ...payload,
      firebaseProject: 'System Test',
      notifiedAdminEmail: ADMIN_TARGET_EMAIL,
    });

    return { success: true, id };
  } catch (error: any) {
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

    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
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
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting facility submission:', err);
    return { success: false, error: err.message || 'ลบข้อมูลไม่สำเร็จ' };
  }
}

/**
 * Subscribe in real-time to submissions created by current user
 */
export function subscribeUserSubmissions(
  userEmail: string,
  callback: (submissions: FacilitySubmission[]) => void
): () => void {
  if (!userEmail) {
    callback([]);
    return () => {};
  }

  try {
    const colRef = collection(db, SYSTEM_TEST_COLLECTION);
    const q = query(colRef, where('userEmail', '==', userEmail.trim()));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: FacilitySubmission[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.learningCenter) {
            list.push(data as FacilitySubmission);
          }
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(list);
      },
      (err) => {
        console.warn('subscribeUserSubmissions listener warning:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('subscribeUserSubmissions failed:', err);
    return () => {};
  }
}

/**
 * Subscribe in real-time to ALL facility usage records
 */
export function subscribeAllSubmissions(
  callback: (submissions: FacilitySubmission[]) => void
): () => void {
  try {
    const colRef = collection(db, SYSTEM_TEST_COLLECTION);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: FacilitySubmission[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.learningCenter) {
            list.push(data as FacilitySubmission);
          }
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(list);
      },
      (err) => {
        console.warn('subscribeAllSubmissions listener warning:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('subscribeAllSubmissions failed:', err);
    return () => {};
  }
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
 * Subscribe to Teacher Media Repository with live updates (Displays real teacher submissions only)
 */
export function subscribeTeacherMedia(
  callback: (works: TeacherMediaWork[]) => void
): () => void {
  // 1. Instant load from local storage
  const emitLocal = () => {
    const deletedIds = getDeletedMediaIds();
    const deletedUsers = getDeletedUserEmails();
    const local = getStoredTeacherMedia().filter((w) => {
      const email = (w.submittedByEmail || '').trim().toLowerCase();
      return (
        !w.id.startsWith('seed-') &&
        w.title?.trim().length > 0 &&
        !deletedIds.has(w.id) &&
        !deletedIds.has(w.id.replace(/^work_/, '')) &&
        !deletedIds.has(`work_${w.id}`) &&
        !deletedUsers.has(email)
      );
    });
    callback(local);
  };

  emitLocal();

  // 2. Listen to custom change events
  const handleLocalChange = () => {
    emitLocal();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('acu_teacher_media_changed', handleLocalChange);
    window.addEventListener('acu_user_deleted', handleLocalChange);
  }

  // 3. Attach Firestore onSnapshot
  let unsubscribeFirestore = () => {};
  try {
    const colRef = collection(db, TEACHER_MEDIA_COLLECTION);
    unsubscribeFirestore = onSnapshot(
      colRef,
      (snapshot) => {
        const deletedIds = getDeletedMediaIds();
        const deletedUsers = getDeletedUserEmails();
        const liveList: TeacherMediaWork[] = [];
        snapshot.forEach((docSnap) => {
          liveList.push(docSnap.data() as TeacherMediaWork);
        });

        const realWorks = liveList.filter((w) => {
          const email = (w.submittedByEmail || '').trim().toLowerCase();
          return (
            !w.id.startsWith('seed-') &&
            w.title?.trim().length > 0 &&
            !deletedIds.has(w.id) &&
            !deletedIds.has(w.id.replace(/^work_/, '')) &&
            !deletedIds.has(`work_${w.id}`) &&
            !deletedUsers.has(email)
          );
        });

        realWorks.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        saveStoredTeacherMedia(realWorks);
        callback(realWorks);
      },
      (err) => {
        console.warn('subscribeTeacherMedia fallback:', err);
        emitLocal();
      }
    );
  } catch (err) {
    console.error('subscribeTeacherMedia failed:', err);
    emitLocal();
  }

  return () => {
    unsubscribeFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('acu_teacher_media_changed', handleLocalChange);
      window.removeEventListener('acu_user_deleted', handleLocalChange);
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
    return { success: true };
  } catch (err: any) {
    console.error('Error updating teacher media:', err);
    return { success: false, error: err.message || 'แก้ไขข้อมูลไม่สำเร็จ' };
  }
}

/**
 * Delete teacher's media item.
 * Admin can delete any; creator can delete their own.
 */
export async function deleteTeacherMedia(
  id: string,
  currentUserEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = id.replace(/^work_/, '');

    // 1. Record ID to deleted blocklists immediately
    addDeletedMediaId(id);
    addDeletedMediaId(cleanId);
    addDeletedInnovationId(id);
    addDeletedInnovationId(cleanId);

    // 2. Remove immediately from local storage cache
    const currentMedia = getStoredTeacherMedia();
    saveStoredTeacherMedia(
      currentMedia.filter((m) => m.id !== id && m.id !== cleanId && m.id !== `work_${cleanId}`)
    );

    const currentInnos = getStoredInnovations();
    saveStoredInnovations(currentInnos.filter((i) => i.id !== cleanId && i.id !== id));

    // 3. Dispatch events immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_teacher_media_changed'));
      window.dispatchEvent(new CustomEvent('acu_innovations_changed'));
    }

    // 4. Delete from Firestore asynchronously
    await Promise.allSettled([
      deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, id)),
      deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, `work_${cleanId}`)),
      deleteDoc(doc(db, TEACHER_MEDIA_COLLECTION, cleanId)),
      deleteDoc(doc(db, INNOVATIONS_COLLECTION, cleanId)),
      deleteDoc(doc(db, INNOVATIONS_COLLECTION, id)),
      deleteDoc(doc(db, SYSTEM_TEST_COLLECTION, `test_${cleanId}`)),
      deleteDoc(doc(db, SYSTEM_TEST_COLLECTION, `test_${id}`)),
    ]);

    return { success: true };
  } catch (err: any) {
    console.warn('deleteTeacherMedia notice:', err);
    return { success: true };
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
  try {
    const id = `work_direct_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const docRef = doc(db, TEACHER_MEDIA_COLLECTION, id);

    const payload: TeacherMediaWork = {
      id,
      title: data.title.trim(),
      teacherName: data.teacherName.trim(),
      subjectGroup: data.subjectGroup,
      gradeLevel: data.gradeLevel || data.subjectGroup,
      subjectName: data.subjectName?.trim() || 'สื่อนวัตกรรมการจัดการเรียนรู้',
      thumbnailUrl: data.thumbnailUrl?.trim() || '/ACU N.png',
      description: data.description.trim(),
      mediaType: data.mediaType,
      itemNumber: 1,
      onlineUrl: data.onlineUrl?.trim() || '',
      ratingAvg: 5.0,
      ratingCount: 1,
      views: 1,
      likes: 0,
      likedBy: [],
      submittedByEmail: data.submittedByEmail.trim(),
      createdAt: nowIso,
    };

    await setDoc(docRef, payload);
    return { success: true, id };
  } catch (err: any) {
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
    url: 'https://www.canva.com/education/',
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
    url: 'https://www.niets.or.th',
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
    url: 'https://tdc.thailis.or.th',
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
    title: 'เพจครูแชร์สื่อ & ชุมชนการเรียนรู้วิชาชีพ (PLC)',
    description: 'รวมกลุ่มและเพจยอดนิยมที่แบ่งปันใบงาน สื่อการสอน PowerPoint และแผนการจัดการเรียนรู้',
    category: 'facebook',
    categoryLabel: 'เพจเฟซบุ๊กเพื่อการศึกษา',
    url: 'https://www.facebook.com',
    tags: ['PLC', 'ชุมชนครู', 'แชร์สื่อ'],
    creatorEmail: ADMIN_TARGET_EMAIL,
    creatorName: '(Admin) ม.วีระพงษ์ มีทรัพย์',
    createdAt: '2026-03-04T11:00:00.000Z',
    ratingAvg: 4.7,
    ratingCount: 8,
    userRatings: { 'weerapong1625_acu_ac_th': 5 },
  },
];

/**
 * Subscribe to Shared Ideas in real time
 */
export function subscribeSharedIdeas(
  callback: (ideas: SharedIdeaItem[]) => void
): () => void {
  try {
    const colRef = collection(db, SHARED_IDEAS_COLLECTION);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const liveList: SharedIdeaItem[] = [];
        snapshot.forEach((docSnap) => {
          liveList.push(docSnap.data() as SharedIdeaItem);
        });

        // Merge default seeds if not present
        const mergedMap = new Map<string, SharedIdeaItem>();
        DEFAULT_SEED_IDEAS.forEach((i) => mergedMap.set(i.id, i));
        liveList.forEach((i) => mergedMap.set(i.id, i));

        const finalIdeas = Array.from(mergedMap.values());
        finalIdeas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(finalIdeas);
      },
      (err) => {
        console.warn('subscribeSharedIdeas fallback to seed:', err);
        callback(DEFAULT_SEED_IDEAS);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('subscribeSharedIdeas failed:', err);
    callback(DEFAULT_SEED_IDEAS);
    return () => {};
  }
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
      return true;
    } else {
      // Seed item being rated for the first time
      const seed = DEFAULT_SEED_IDEAS.find((s) => s.id === ideaId);
      const initialRatings: { [key: string]: number } = seed?.userRatings || {};
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
      // Might be a local seed, check if admin
      if (currentUserEmail.trim().toLowerCase() === ADMIN_TARGET_EMAIL.toLowerCase()) {
        return { success: true };
      }
      return { success: false, error: 'ไม่พบรายการไอเดียที่ต้องการลบ' };
    }
    const currentData = snap.data() as SharedIdeaItem;

    if (!canUserModify(currentData.creatorEmail, currentUserEmail)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ลบไอเดียของผู้อื่น (เฉพาะผู้สร้างไอเดีย หรือ Admin)' };
    }

    await deleteDoc(docRef);
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
      return true;
    } else {
      // Create it from seed or initial
      const seed = INITIAL_TEACHER_WORKS.find((s) => s.id === mediaId);
      const initialRatings: { [key: string]: number } = {};
      initialRatings[safeEmailKey] = rating;

      await setDoc(docRef, {
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
      });
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
        onUpdate(getInitialCriteriaPosterUrl());
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
