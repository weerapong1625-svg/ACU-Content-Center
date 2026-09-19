import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { InnovationSubmission, FacilitySubmission } from './submissionService';

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

export function aggregateTeacherSummary(list: InnovationSubmission[]): TeacherSummaryItem[] {
  const map = new Map<string, TeacherSummaryItem>();

  list.forEach((sub) => {
    const key = sub.userEmail.toLowerCase().trim() || sub.teacherName.trim();
    let current = map.get(key);
    if (!current) {
      current = {
        teacherName: sub.teacherName || 'ไม่ระบุชื่อ',
        email: sub.userEmail,
        gradeLevel: sub.gradeLevel || '-',
        submittedCount: 0,
        isComplete: false,
        item1: '-',
        item2: '-',
        item3: '-',
        item4: '-',
        item5: '-',
        lastSubmittedAt: sub.submittedAt,
      };
      map.set(key, current);
    }

    // Assign items
    const itemNum = sub.itemNumber;
    const title = `${sub.mediaTitle} (${sub.mediaType})`;
    if (itemNum === 1) current.item1 = title;
    else if (itemNum === 2) current.item2 = title;
    else if (itemNum === 3) current.item3 = title;
    else if (itemNum === 4) current.item4 = title;
    else if (itemNum === 5) current.item5 = title;

    if (new Date(sub.submittedAt).getTime() > new Date(current.lastSubmittedAt).getTime()) {
      current.lastSubmittedAt = sub.submittedAt;
    }
  });

  // Calculate counts
  const results = Array.from(map.values()).map((t) => {
    let count = 0;
    if (t.item1 !== '-') count++;
    if (t.item2 !== '-') count++;
    if (t.item3 !== '-') count++;
    if (t.item4 !== '-') count++;
    if (t.item5 !== '-') count++;
    t.submittedCount = count;
    t.isComplete = count >= 5;
    return t;
  });

  results.sort((a, b) => b.submittedCount - a.submittedCount);
  return results;
}

export function generateTeacherSummaryTSV(summaryList: TeacherSummaryItem[]): string {
  const rows = summaryList.map((t, idx) => [
    idx + 1,
    t.teacherName,
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
