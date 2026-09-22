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
import { db } from '../firebase';

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

export interface InnovationSubmission {
  id: string;
  teacherName: string;
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

// Exact 9 Subject Groups requested by user
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
  itemNumber?: number; // 1 to 5
  onlineUrl?: string;
  ratingAvg: number;
  ratingCount: number;
  views: number;
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

/**
 * Save innovation submission to Firebase project: System Test
 * If teacher produced the media, automatically register/update into teacher_media_repository!
 */
export async function saveInnovationSubmission(data: {
  teacherName: string;
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
  try {
    const id = `innov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const payload: InnovationSubmission = {
      id,
      teacherName: data.teacherName.trim(),
      gradeLevel: data.gradeLevel,
      itemNumber: Number(data.itemNumber) || 1,
      mediaTitle: data.mediaTitle.trim(),
      mediaType: data.mediaType,
      productionType: data.productionType,
      usageDetails: data.usageDetails.trim(),
      onlineUrl: data.onlineUrl?.trim() || '',
      imageUrl: data.imageUrl || '',
      userEmail: data.userEmail.trim(),
      status: 'ส่งเรียบร้อย',
      submittedAt: nowIso,
      updatedAt: nowIso,
    };

    // 1. Save to teacher_innovations_submissions
    const docRef = doc(db, INNOVATIONS_COLLECTION, id);
    await setDoc(docRef, payload);

    // 2. Also record in system_test_submissions with tag for cross-query audit
    const sysTestRef = doc(db, SYSTEM_TEST_COLLECTION, `test_${id}`);
    await setDoc(sysTestRef, {
      ...payload,
      sourceModule: 'Innovation_5_Items',
      firebaseProject: 'System Test',
      notifiedAdminEmail: ADMIN_TARGET_EMAIL,
    });

    // 3. If teacher produced media themselves, feed into Teacher Media Repository
    if (data.productionType === 'ครูผลิตสื่อเอง') {
      const mediaDocId = `work_${id}`;
      const mediaPayload: TeacherMediaWork = {
        id: mediaDocId,
        title: data.mediaTitle.trim(),
        teacherName: data.teacherName.trim(),
        subjectGroup: data.gradeLevel,
        gradeLevel: data.gradeLevel,
        subjectName: data.usageDetails.trim() || 'สื่อนวัตกรรมการจัดการเรียนรู้',
        thumbnailUrl: data.imageUrl || '/ACU N.png',
        description: `นำไปใช้: ${data.usageDetails} | ประเภท: ${data.mediaType}`,
        mediaType: data.mediaType,
        itemNumber: Number(data.itemNumber) || 1,
        onlineUrl: data.onlineUrl?.trim() || '',
        ratingAvg: 5.0,
        ratingCount: 1,
        views: 1,
        submittedByEmail: data.userEmail.trim(),
        createdAt: nowIso,
      };
      const mediaRef = doc(db, TEACHER_MEDIA_COLLECTION, mediaDocId);
      await setDoc(mediaRef, mediaPayload, { merge: true });
    }

    return { success: true, id };
  } catch (error: any) {
    console.error('Error saving innovation submission:', error);
    return { success: false, id: '', error: error.message || 'บันทึกข้อมูลไม่สำเร็จ' };
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

    // If there is a corresponding media item in teacher media repository, update it as well
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
        if (updates.gradeLevel) {
          mediaUpdate.gradeLevel = updates.gradeLevel;
          mediaUpdate.subjectGroup = updates.gradeLevel;
        }
        if (updates.usageDetails) {
          mediaUpdate.description = `นำไปใช้: ${updates.usageDetails} | ประเภท: ${updates.mediaType || currentData.mediaType}`;
        }
        await updateDoc(mediaRef, mediaUpdate);
      }
    } catch {
      // ignore
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error updating innovation submission:', err);
    return { success: false, error: err.message || 'แก้ไขข้อมูลไม่สำเร็จ' };
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
    const docRef = doc(db, INNOVATIONS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: 'ไม่พบรายการที่ต้องการลบ' };
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

    return { success: true };
  } catch (err: any) {
    console.error('Error deleting innovation submission:', err);
    return { success: false, error: err.message || 'ลบข้อมูลไม่สำเร็จ' };
  }
}

/**
 * Subscribe to user's innovation submissions in real time
 */
export function subscribeUserInnovations(
  userEmail: string,
  callback: (submissions: InnovationSubmission[]) => void
): () => void {
  if (!userEmail) {
    callback([]);
    return () => {};
  }

  try {
    const colRef = collection(db, INNOVATIONS_COLLECTION);
    const q = query(colRef, where('userEmail', '==', userEmail.trim()));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: InnovationSubmission[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as InnovationSubmission);
        });
        // Sort descending by submission time
        list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        callback(list);
      },
      (err) => {
        console.warn('subscribeUserInnovations listener error:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('subscribeUserInnovations failed:', err);
    return () => {};
  }
}

/**
 * Subscribe to ALL innovation submissions (for Google Sheets summary and admin overview)
 */
export function subscribeAllInnovations(
  callback: (submissions: InnovationSubmission[]) => void
): () => void {
  try {
    const colRef = collection(db, INNOVATIONS_COLLECTION);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: InnovationSubmission[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as InnovationSubmission);
        });
        list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        callback(list);
      },
      (err) => {
        console.warn('subscribeAllInnovations listener error:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('subscribeAllInnovations failed:', err);
    return () => {};
  }
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
  try {
    const colRef = collection(db, TEACHER_MEDIA_COLLECTION);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const liveList: TeacherMediaWork[] = [];
        snapshot.forEach((docSnap) => {
          liveList.push(docSnap.data() as TeacherMediaWork);
        });

        // Filter out any legacy seed items if any exist in collection
        const realWorks = liveList.filter(
          (w) => !w.id.startsWith('seed-') && w.title?.trim().length > 0
        );

        // Sort newest first so real teacher submissions appear at top
        realWorks.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        callback(realWorks);
      },
      (err) => {
        console.warn('subscribeTeacherMedia fallback:', err);
        callback([]);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('subscribeTeacherMedia failed:', err);
    callback([]);
    return () => {};
  }
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
    const docRef = doc(db, TEACHER_MEDIA_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: 'ไม่พบรายการสื่อที่ต้องการลบ' };
    }
    const currentData = snap.data() as TeacherMediaWork;

    if (!canUserModify(currentData.submittedByEmail, currentUserEmail)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์ลบสื่อของผู้อื่น (สิทธิ์เฉพาะผู้ส่ง หรือ Admin)' };
    }

    await deleteDoc(docRef);
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting teacher media:', err);
    return { success: false, error: err.message || 'ลบข้อมูลไม่สำเร็จ' };
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
