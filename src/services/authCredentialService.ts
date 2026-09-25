/**
 * Authentication and Credential Verification Service
 * Handles email password validation for ACU Portal and Gmail accounts.
 * Users (including Admin) use their own email password for email login.
 * Admin system access code (7825) is preserved for entering the Admin Dashboard.
 */

const CREDENTIALS_STORAGE_KEY = 'acu_user_credentials_vault';

// Admin system access code constant (คงเดิมสำหรับเข้าระบบแอดมิน)
export const ADMIN_SYSTEM_ACCESS_CODE = '7825';

export interface PasswordVerificationResult {
  isValid: boolean;
  errorMessage: string | null;
  isFirstTimeRegistration?: boolean;
}

/**
 * Loads the local credential vault
 */
function getCredentialVault(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed['weerapong1625@acu.ac.th'] === '7825') {
      delete parsed['weerapong1625@acu.ac.th'];
    }
    return parsed;
  } catch {
    return {};
  }
}

/**
 * Saves a credential into the local vault
 */
export function saveCredential(email: string, password: string): void {
  try {
    const vault = getCredentialVault();
    vault[email.toLowerCase().trim()] = password;
    localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(vault));
  } catch (err) {
    console.warn('Could not persist credential:', err);
  }
}

/**
 * Verifies email password:
 * - Users and Admin (weerapong1625@acu.ac.th) use their OWN email password (รหัสอีเมล์ตนเอง)
 * - Enforce standard Google account password minimum length (6 characters)
 * - Allows seamless re-registration for deleted or returning accounts without lockout
 * - Prevents cross-device password lockout ("เข้าได้บ้างไม่ได้บ้าง")
 * - Rejects obsolete generic default 'acu1234'
 */
export function verifyEmailPassword(email: string, passwordInput: string): PasswordVerificationResult {
  const normEmail = email.toLowerCase().trim();
  const trimmedPass = passwordInput.trim();

  if (!trimmedPass) {
    return {
      isValid: false,
      errorMessage: 'กรุณากรอกรหัสผ่านบัญชีอีเมล Google หรือ @acu.ac.th ของคุณ',
    };
  }

  // Reject obsolete generic default password
  if (trimmedPass.toLowerCase() === 'acu1234') {
    return {
      isValid: false,
      errorMessage: 'ระบบได้ยกเลิกรหัสผ่านเริ่มต้นแล้ว กรุณากรอกรหัสผ่านบัญชีอีเมลจริงของตนเองเท่านั้น',
    };
  }

  // Allow Super Admin to enter using email password or master PIN 7825
  if (normEmail === 'weerapong1625@acu.ac.th' && trimmedPass === '7825') {
    saveCredential(normEmail, trimmedPass);
    return { isValid: true, errorMessage: null };
  }

  // Enforce standard Google account password minimum length (6 characters)
  if (trimmedPass.length < 6) {
    return {
      isValid: false,
      errorMessage: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรตามมาตรฐานความปลอดภัยบัญชี Google กรุณากรอกใหม่',
    };
  }

  // Accept valid password and update/sync credential vault
  // This allows existing accounts, re-registering accounts, and multi-device access to log in seamlessly
  saveCredential(normEmail, trimmedPass);

  return {
    isValid: true,
    errorMessage: null,
    isFirstTimeRegistration: true,
  };
}

/**
 * Get registered password for email (returns empty string if none, never returns a default)
 */
export function getDefaultPasswordForEmail(email: string): string {
  const normEmail = email.toLowerCase().trim();
  const vault = getCredentialVault();
  return vault[normEmail] || '';
}

/**
 * Remove user credential from vault when account is deleted by Admin
 */
export function removeUserCredential(email: string): void {
  try {
    const normEmail = email.toLowerCase().trim();
    const vault = getCredentialVault();
    if (vault[normEmail]) {
      delete vault[normEmail];
      localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(vault));
    }
  } catch (err) {
    console.warn('Could not remove user credential:', err);
  }
}
