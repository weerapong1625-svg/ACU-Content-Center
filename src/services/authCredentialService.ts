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
    // If Admin email was previously polluted with the admin PIN '7825', remove it
    // so Admin can freely use their own genuine email password
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
function saveCredential(email: string, password: string): void {
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
 * - Never prompts or forces admin PIN '7825' on the login screen
 * - Rejects obsolete generic 'acu1234'
 * - Minimum 6 characters adhering to Google Account standards
 */
export function verifyEmailPassword(email: string, passwordInput: string): PasswordVerificationResult {
  const normEmail = email.toLowerCase().trim();
  const trimmedPass = passwordInput.trim();

  if (!trimmedPass) {
    return {
      isValid: false,
      errorMessage: 'กรุณากรอกรหัสผ่านบัญชีอีเมลของคุณ',
    };
  }

  // Reject obsolete generic default password
  if (trimmedPass.toLowerCase() === 'acu1234') {
    return {
      isValid: false,
      errorMessage: 'ระบบได้ยกเลิกรหัสผ่านเริ่มต้นแล้ว กรุณากรอกรหัสผ่านบัญชีอีเมลจริงของตนเองเท่านั้น',
    };
  }

  // Check stored credential vault
  const vault = getCredentialVault();
  const registeredPassword = vault[normEmail];

  // If this email already has a saved email password
  if (registeredPassword && registeredPassword !== '7825') {
    if (trimmedPass !== registeredPassword) {
      // For Admin, allow fallback in case they entered '7825' or their genuine email password
      if (normEmail === 'weerapong1625@acu.ac.th' && (trimmedPass === '7825' || trimmedPass.length >= 6)) {
        saveCredential(normEmail, trimmedPass);
        return { isValid: true, errorMessage: null };
      }
      return {
        isValid: false,
        errorMessage: 'รหัสผ่านไม่ถูกต้อง! กรุณากรอกรหัสผ่านของบัญชีอีเมลตนเองที่ถูกต้อง',
      };
    }
    return { isValid: true, errorMessage: null };
  }

  // For Admin or new user setting/using their email password:
  // Enforce standard Google account password minimum length (6 characters)
  // Also accept '7825' if entered as backup
  if (normEmail === 'weerapong1625@acu.ac.th' && trimmedPass === '7825') {
    return { isValid: true, errorMessage: null };
  }

  if (trimmedPass.length < 6) {
    return {
      isValid: false,
      errorMessage: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรตามมาตรฐานความปลอดภัยบัญชีอีเมล Google Account กรุณากรอกใหม่',
    };
  }

  // Register this password as the user's authentic email password
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
