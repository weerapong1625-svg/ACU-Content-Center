import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  extractMediaEmails,
  FacilitySubmission,
  getUnifiedTeacherMediaRecords,
  InnovationSubmission,
  isValidActiveMediaRecord,
  TeacherMediaWork,
} from './submissionService';
import { FullUserProfile, getCleanRealName, resolveUserUid } from './userProfileService';

export interface GoogleSheetsConfig {
  sheetUrl: string;
  sheetName?: string;
  lastExportAt?: string;
  updatedBy?: string;
}

const SETTINGS_COLLECTION = 'system_settings';
const SHEETS_CONFIG_DOC = 'google_sheets_config';
export const DEFAULT_NEW_SHEET_URL = 'https://docs.google.com/spreadsheets/create';

/**
 * Fetch saved Google Sheets URL configuration from Firestore
 */
export async function fetchGoogleSheetsConfig(): Promise<GoogleSheetsConfig> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SHEETS_CONFIG_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as GoogleSheetsConfig;
    }
  } catch (err) {
    console.warn('fetchGoogleSheetsConfig error:', err);
  }
  return {
    sheetUrl: DEFAULT_NEW_SHEET_URL,
    sheetName: 'ACU สรุปข้อมูลสื่อนวัตกรรมการเรียนรู้และแหล่งเรียนรู้',
  };
}

/**
 * Save Google Sheets URL configuration to Firestore
 */
export async function saveGoogleSheetsConfig(
  sheetUrl: string,
  adminEmail: string
): Promise<{ success: boolean; message: string }> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SHEETS_CONFIG_DOC);
    const payload: GoogleSheetsConfig = {
      sheetUrl: sheetUrl.trim() || DEFAULT_NEW_SHEET_URL,
      sheetName: 'ACU สรุปข้อมูลสื่อนวัตกรรมการเรียนรู้และแหล่งเรียนรู้',
      lastExportAt: new Date().toISOString(),
      updatedBy: adminEmail,
    };
    await setDoc(docRef, payload, { merge: true });
    return { success: true, message: 'บันทึกลิงก์ Google Sheets สำเร็จ' };
  } catch (err: any) {
    console.error('saveGoogleSheetsConfig error:', err);
    return { success: false, message: err.message || 'บันทึกลิงก์ไม่สำเร็จ' };
  }
}

/**
 * Escape string for TSV (Google Sheets copy-paste)
 */
function cleanForTSV(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[\t\r\n]+/g, ' ').trim();
}

/**
 * Escape string for CSV (UTF-8 BOM)
 */
function cleanForCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Trigger client-side file download
 */
export function downloadFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    }
  } catch (err) {
    console.warn('Copy to clipboard failed:', err);
    return false;
  }
}

// =========================================================================
// 1. DATASET 1: สื่อนวัตกรรม 5 ชิ้น (Innovation Submissions)
// =========================================================================

export const INNOVATION_HEADERS = [
  'ลำดับ',
  'รหัสการส่ง',
  'วันเวลาที่ส่ง',
  'ชื่อ-สกุล ครูผู้สอน',
  'กลุ่มสาระการเรียนรู้ของครูผู้สอน',
  'ระดับชั้น',
  'สื่อชิ้นที่ (1-5)',
  'ชื่อสื่อ / นวัตกรรม',
  'ประเภทสื่อ',
  'การจัดทำสื่อ',
  'การนำไปใช้ (วิชา/หน่วยการเรียนรู้)',
  'URL สื่อออนไลน์',
  'ไฟล์รูปภาพประกอบ',
  'อีเมลครูผู้สอน',
  'สถานะ',
];

export function generateInnovationsTSV(list: InnovationSubmission[]): string {
  const rows = list.map((item, idx) => [
    idx + 1,
    item.id,
    new Date(item.submittedAt).toLocaleString('th-TH'),
    item.teacherName,
    item.subjectGroup || '-',
    item.gradeLevel,
    item.itemNumber,
    item.mediaTitle,
    item.mediaType,
    item.productionType,
    item.usageDetails,
    item.onlineUrl || '-',
    item.imageUrl ? (item.imageUrl.startsWith('data:') ? '[รูปภาพแนบในระบบ]' : item.imageUrl) : '-',
    item.userEmail,
    item.status,
  ].map(cleanForTSV).join('\t'));

  return [INNOVATION_HEADERS.join('\t'), ...rows].join('\n');
}

export function generateInnovationsCSV(list: InnovationSubmission[]): string {
  const rows = list.map((item, idx) => [
    idx + 1,
    item.id,
    new Date(item.submittedAt).toLocaleString('th-TH'),
    item.teacherName,
    item.subjectGroup || '-',
    item.gradeLevel,
    item.itemNumber,
    item.mediaTitle,
    item.mediaType,
    item.productionType,
    item.usageDetails,
    item.onlineUrl || '-',
    item.imageUrl ? (item.imageUrl.startsWith('data:') ? 'รูปภาพแนบในระบบ' : item.imageUrl) : '-',
    item.userEmail,
    item.status,
  ].map(cleanForCSV).join(','));

  return '\uFEFF' + [INNOVATION_HEADERS.map(cleanForCSV).join(','), ...rows].join('\r\n');
}

// =========================================================================
// 2. DATASET 2: สรุปผลงานตามรายชื่อครู (Teacher 5 Items Summary)
// =========================================================================

export const TEACHER_SUMMARY_HEADERS = [
  'ลำดับ',
  'ชื่อ-สกุล ครูผู้สอน',
  'กลุ่มสาระการเรียนรู้',
  'อีเมลครู',
  'ระดับชั้น',
  'ส่งแล้วกี่ชิ้น (จาก 5)',
  'สถานะครบ 5 ชิ้น',
  'สื่อชิ้นที่ 1',
  'สื่อชิ้นที่ 2',
  'สื่อชิ้นที่ 3',
  'สื่อชิ้นที่ 4',
  'สื่อชิ้นที่ 5',
  'วันเวลาส่งล่าสุด',
];

export interface TeacherSummaryItem {
  teacherName: string;
  email: string;
  subjectGroup?: string;
  gradeLevel: string;
  submittedCount: number;
  isComplete: boolean;
  item1: string;
  item2: string;
  item3: string;
  item4: string;
  item5: string;
  lastSubmittedAt: string;
}

export function aggregateTeacherSummary(
  list: InnovationSubmission[],
  teacherMediaList: TeacherMediaWork[] = [],
  userProfilesMap: Record<string, FullUserProfile> = {}
): TeacherSummaryItem[] {
  // Build lookup index of known profiles by uid and clean name so records without email still map accurately
  const uidToEmail = new Map<string, string>();
  const cleanNameToEmail = new Map<string, string>();
  Object.entries(userProfilesMap).forEach(([emKey, prof]) => {
    const normEmail = emKey.trim().toLowerCase();
    if (!normEmail) return;
    if (prof.uid) uidToEmail.set(prof.uid.trim(), normEmail);
    uidToEmail.set(resolveUserUid(normEmail), normEmail);
    const clean = getCleanRealName(prof.fullName || prof.displayName, normEmail).trim().toLowerCase();
    if (clean && clean !== normEmail.split('@')[0]) {
      cleanNameToEmail.set(clean, normEmail);
    }
  });

  // Discover distinct teacher descriptors from both innovations & teacherMedia
  const descriptorMap = new Map<string, {
    uid?: string;
    email: string;
    fullName?: string;
    teacherName?: string;
    displayName?: string;
  }>();

  const registerItemOwner = (rawItem: any) => {
    if (!isValidActiveMediaRecord(rawItem)) return;
    const itemEmails = extractMediaEmails(rawItem);
    const itemUid = (rawItem.uid || rawItem.userId || '').toString().trim();
    const rawName = (rawItem.teacherName || rawItem.authorName || '').toString().trim();
    const cleanNameKey = rawName ? getCleanRealName(rawName).trim().toLowerCase() : '';

    let canonicalEmail = itemEmails[0] || (itemUid ? uidToEmail.get(itemUid) || '' : '') || (cleanNameKey ? cleanNameToEmail.get(cleanNameKey) || '' : '');
    const key = canonicalEmail || (itemUid ? `uid:${itemUid}` : `name:${cleanNameKey || rawName}`);
    if (!key || key === 'name:') return;

    const existing = descriptorMap.get(key);
    const prof = canonicalEmail ? userProfilesMap[canonicalEmail] : undefined;
    if (!existing) {
      descriptorMap.set(key, {
        uid: prof?.uid || itemUid || (canonicalEmail ? resolveUserUid(canonicalEmail) : undefined),
        email: canonicalEmail,
        fullName: prof?.fullName || rawName || '',
        teacherName: rawName || prof?.fullName || '',
        displayName: prof?.displayName || rawName || '',
      });
    } else {
      if (!existing.uid && (itemUid || prof?.uid)) existing.uid = prof?.uid || itemUid;
      if (!existing.teacherName && rawName) existing.teacherName = rawName;
    }
  };

  list.forEach(registerItemOwner);
  teacherMediaList.forEach(registerItemOwner);

  const results: TeacherSummaryItem[] = [];

  descriptorMap.forEach((descriptor) => {
    const unified = getUnifiedTeacherMediaRecords(descriptor, list, teacherMediaList);
    if (unified.submittedCount === 0) return;

    const latestRecord = unified.records.reduce((latest, curr) => {
      const latestMs = new Date(latest.submittedAt || 0).getTime();
      const currMs = new Date(curr.submittedAt || 0).getTime();
      return currMs > latestMs ? curr : latest;
    }, unified.records[0]);

    const firstWithGroup = unified.records.find((r) => r.subjectGroup && r.subjectGroup.trim()) || latestRecord;
    const prof = descriptor.email ? userProfilesMap[descriptor.email] : undefined;
    const displayTeacherName =
      getCleanRealName(prof?.fullName || descriptor.fullName || latestRecord.teacherName, descriptor.email) ||
      latestRecord.teacherName ||
      'ไม่ระบุชื่อ';

    const formatSlot = (slotIdx: number): string => {
      const s = unified.slots[slotIdx];
      if (!s || !s.title) return '-';
      return `${s.title.trim()} (${s.category || 'สื่อการสอน'})`;
    };

    results.push({
      teacherName: displayTeacherName,
      email: descriptor.email || latestRecord.ownerEmail || '',
      subjectGroup: firstWithGroup?.subjectGroup || 'ไม่ระบุกลุ่มสาระ',
      gradeLevel: firstWithGroup?.gradeLevel || '-',
      submittedCount: unified.submittedCount,
      isComplete: unified.submittedCount >= 5,
      item1: formatSlot(0),
      item2: formatSlot(1),
      item3: formatSlot(2),
      item4: formatSlot(3),
      item5: formatSlot(4),
      lastSubmittedAt: latestRecord?.submittedAt || '',
    });
  });

  results.sort((a, b) => b.submittedCount - a.submittedCount);
  return results;
}

export function generateTeacherSummaryTSV(summaryList: TeacherSummaryItem[]): string {
  const rows = summaryList.map((t, idx) => [
    idx + 1,
    t.teacherName,
    t.subjectGroup || '-',
    t.email,
    t.gradeLevel,
    `${t.submittedCount}/5`,
    t.isComplete ? 'ครบ 5 ชิ้นแล้ว' : `ขาดอีก ${5 - t.submittedCount} ชิ้น`,
    t.item1,
    t.item2,
    t.item3,
    t.item4,
    t.item5,
    new Date(t.lastSubmittedAt).toLocaleString('th-TH'),
  ].map(cleanForTSV).join('\t'));

  return [TEACHER_SUMMARY_HEADERS.join('\t'), ...rows].join('\n');
}

export function generateTeacherSummaryCSV(summaryList: TeacherSummaryItem[]): string {
  const rows = summaryList.map((t, idx) => [
    idx + 1,
    t.teacherName,
    t.subjectGroup || '-',
    t.email,
    t.gradeLevel,
    `${t.submittedCount}/5`,
    t.isComplete ? 'ครบ 5 ชิ้นแล้ว' : `ขาดอีก ${5 - t.submittedCount} ชิ้น`,
    t.item1,
    t.item2,
    t.item3,
    t.item4,
    t.item5,
    new Date(t.lastSubmittedAt).toLocaleString('th-TH'),
  ].map(cleanForCSV).join(','));

  return '\uFEFF' + [TEACHER_SUMMARY_HEADERS.map(cleanForCSV).join(','), ...rows].join('\r\n');
}

// =========================================================================
// 3. DATASET 3: การใช้แหล่งเรียนรู้ 33 แหล่ง (Facility Submissions)
// =========================================================================

export const FACILITY_HEADERS = [
  'ลำดับ',
  'รหัสการบันทึก',
  'วันเวลาที่บันทึก',
  'ชื่อครูผู้สอน',
  'กลุ่มสาระการเรียนรู้',
  'แหล่งเรียนรู้/ห้องปฏิบัติการ',
  'คาบเรียนที่ใช้',
  'วันเวลาที่ใช้งาน',
  'ข้อเสนอแนะ/บันทึกผล',
  'ภาพประกอบ',
  'อีเมลครูผู้สอน',
  'สถานะ',
];

export function generateFacilitiesTSV(list: FacilitySubmission[]): string {
  const rows = list.map((item, idx) => [
    idx + 1,
    item.id,
    new Date(item.createdAt).toLocaleString('th-TH'),
    item.teacherName,
    item.subjectGroup,
    item.learningCenter,
    Array.isArray(item.periods) ? item.periods.join(', ') : item.periods,
    item.usageDateTime || '-',
    item.feedback || '-',
    item.imageUrl ? (item.imageUrl.startsWith('data:') ? '[รูปภาพแนบในระบบ]' : item.imageUrl) : '-',
    item.userEmail,
    item.status,
  ].map(cleanForTSV).join('\t'));

  return [FACILITY_HEADERS.join('\t'), ...rows].join('\n');
}

export function generateFacilitiesCSV(list: FacilitySubmission[]): string {
  const rows = list.map((item, idx) => [
    idx + 1,
    item.id,
    new Date(item.createdAt).toLocaleString('th-TH'),
    item.teacherName,
    item.subjectGroup,
    item.learningCenter,
    Array.isArray(item.periods) ? item.periods.join(', ') : item.periods,
    item.usageDateTime || '-',
    item.feedback || '-',
    item.imageUrl ? (item.imageUrl.startsWith('data:') ? 'รูปภาพแนบในระบบ' : item.imageUrl) : '-',
    item.userEmail,
    item.status,
  ].map(cleanForCSV).join(','));

  return '\uFEFF' + [FACILITY_HEADERS.map(cleanForCSV).join(','), ...rows].join('\r\n');
}
