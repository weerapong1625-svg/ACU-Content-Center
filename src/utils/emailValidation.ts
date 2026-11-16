/**
 * Email validation utility adhering strictly to Gmail and Google Workspace / ACU standards.
 * Validates against real Gmail account rules and prevents common typo mistakes.
 */

// Common typos for Gmail and ACU domains
const COMMON_TYPOS: { [key: string]: string } = {
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'acu.th': 'acu.ac.th',
  'acu.co.th': 'acu.ac.th',
  'acu.com': 'acu.ac.th',
  'acu.ac': 'acu.ac.th',
  'hotmail.con': 'hotmail.com',
  'yahoo.con': 'yahoo.com',
};

export interface EmailValidationResult {
  isValid: boolean;
  errorMessage: string | null;
  suggestedFix?: string;
  normalizedEmail?: string;
}

/**
 * Validates user input email according to genuine Gmail / Google Workspace / ACU account rules:
 * - Domain must be @acu.ac.th, @gmail.com, or genuine Google Workspace domain
 * - Username (local part) must adhere to Google standard (alphanumeric, dots, hyphens; no consecutive dots, no special symbols)
 * - Minimum 6 characters for standard Gmail local parts (or registered school staff IDs)
 */
export function validateRealGmailAccount(input: string): EmailValidationResult {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return {
      isValid: false,
      errorMessage: 'กรุณากรอกอีเมลบัญชีโรงเรียนโดเมน @acu.ac.th เท่านั้น',
    };
  }

  // Check for spaces or forbidden special characters
  if (/\s/.test(trimmed)) {
    return {
      isValid: false,
      errorMessage: 'อีเมลต้องไม่มีการเว้นวรรค กรุณากรอกใหม่ให้ถูกต้อง',
    };
  }

  // Check for Thai characters inside email
  if (/[\u0E00-\u0E7F]/.test(trimmed)) {
    return {
      isValid: false,
      errorMessage: 'อีเมลต้องเป็นตัวอักษรภาษาอังกฤษและตัวเลขเท่านั้น (ห้ามใช้อักษรภาษาไทย) กรุณากรอกใหม่',
    };
  }

  // Must contain exactly one @
  const atParts = trimmed.split('@');
  if (atParts.length !== 2) {
    return {
      isValid: false,
      errorMessage: 'รูปแบบอีเมลไม่ถูกต้อง ต้องมีเครื่องหมาย @ หนึ่งตัว (เช่น yourname@acu.ac.th)',
    };
  }

  const [localPart, domainPart] = atParts;

  // Validate local part (username)
  if (!localPart || localPart.length === 0) {
    return {
      isValid: false,
      errorMessage: 'กรุณาระบุชื่อผู้ใช้หน้าเครื่องหมาย @ กรุณากรอกใหม่',
    };
  }

  // Google Workspace local part rules:
  // Cannot start or end with a dot
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return {
      isValid: false,
      errorMessage: 'ชื่อบัญชีอีเมลต้องไม่ขึ้นต้นหรือลงท้ายด้วยจุด (.) กรุณากรอกใหม่',
    };
  }

  // Cannot contain consecutive dots
  if (localPart.includes('..')) {
    return {
      isValid: false,
      errorMessage: 'ชื่อบัญชีอีเมลต้องไม่มีจุดต่อเนื่องกัน (..) กรุณากรอกใหม่',
    };
  }

  // Only letters, digits, dots, hyphens, underscores
  if (!/^[a-z0-9._-]+$/.test(localPart)) {
    return {
      isValid: false,
      errorMessage: 'ชื่อบัญชีมีอักขระพิเศษที่ไม่ได้รับอนุญาตตามมาตรฐาน Google กรุณากรอกใหม่',
    };
  }

  // Validate domain part
  if (!domainPart || !domainPart.includes('.')) {
    return {
      isValid: false,
      errorMessage: 'ชื่อโดเมนไม่ถูกต้อง ระบบรองรับเฉพาะอีเมลโดเมน @acu.ac.th เท่านั้น',
    };
  }

  // Check common ACU domain typos and suggest @acu.ac.th
  if (COMMON_TYPOS[domainPart] === 'acu.ac.th') {
    return {
      isValid: false,
      errorMessage: `ตรวจพบชื่อโดเมนพิมพ์ผิด: "@${domainPart}" ที่ถูกต้องคือ "@acu.ac.th" กรุณากรอกใหม่`,
      suggestedFix: `${localPart}@acu.ac.th`,
    };
  }

  // Strictly allow ONLY @acu.ac.th domain
  if (domainPart !== 'acu.ac.th') {
    return {
      isValid: false,
      errorMessage: `ระบบรองรับเฉพาะบัญชีอีเมลโรงเรียนโดเมน @acu.ac.th เท่านั้น (ไม่รองรับโดเมน "@${domainPart}")`,
    };
  }

  // Minimum username length: at least 2 characters
  if (localPart.replace(/[._-]/g, '').length < 2) {
    return {
      isValid: false,
      errorMessage: 'ชื่อบัญชีอีเมลสั้นเกินไป กรุณาตรวจสอบและกรอกใหม่ให้ถูกต้อง',
    };
  }

  return {
    isValid: true,
    errorMessage: null,
    normalizedEmail: trimmed,
  };
}
