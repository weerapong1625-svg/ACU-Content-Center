import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SUPER_ADMIN_EMAIL, getInitialLogoUrl } from './logoService';
import { ADMIN_TARGET_EMAIL } from './submissionService';

export const CERTIFICATE_LOGO_DOC_ID = 'certificate_logo';
export const CERTIFICATE_LOGO_STORAGE_KEY = 'acu_certificate_logo_config';

export interface CertificateLogoConfig {
  logoUrl: string;
  updatedBy?: string;
  updatedAt?: string;
}

/**
 * Check if the email has admin rights to modify certificate logo
 */
export function canManageCertificateLogo(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized === SUPER_ADMIN_EMAIL.toLowerCase() ||
    normalized === ADMIN_TARGET_EMAIL.toLowerCase() ||
    normalized.endsWith('@acu.ac.th')
  );
}

/**
 * Synchronously get initial certificate logo URL from local storage or fallback to school logo
 */
export function getInitialCertificateLogoUrl(): string {
  try {
    const raw = localStorage.getItem(CERTIFICATE_LOGO_STORAGE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && typeof cached.logoUrl === 'string' && cached.logoUrl.trim()) {
        return cached.logoUrl;
      }
    }
  } catch (err) {
    console.warn('Could not read cached certificate logo:', err);
  }
  // Fall back to current official school logo
  return getInitialLogoUrl();
}

/**
 * Real-time subscription to certificate logo in Firestore
 */
export function subscribeCertificateLogo(onUpdate: (url: string) => void): () => void {
  const handleCustomUpdate = (e: Event) => {
    const custom = e as CustomEvent<string>;
    if (custom.detail) {
      onUpdate(custom.detail);
    }
  };
  window.addEventListener('acu_certificate_logo_changed', handleCustomUpdate);

  try {
    const docRef = doc(db, 'system_settings', CERTIFICATE_LOGO_DOC_ID);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as CertificateLogoConfig;
          if (data?.logoUrl) {
            try {
              localStorage.setItem(CERTIFICATE_LOGO_STORAGE_KEY, JSON.stringify(data));
            } catch {
              // ignore
            }
            onUpdate(data.logoUrl);
            return;
          }
        }
        // Fall back to school logo
        onUpdate(getInitialCertificateLogoUrl());
      },
      (error) => {
        console.warn('Realtime certificate logo subscription error:', error);
        onUpdate(getInitialCertificateLogoUrl());
      }
    );

    return () => {
      window.removeEventListener('acu_certificate_logo_changed', handleCustomUpdate);
      unsubscribe();
    };
  } catch (err) {
    console.warn('Failed to initialize certificate logo listener:', err);
    onUpdate(getInitialCertificateLogoUrl());
    return () => {
      window.removeEventListener('acu_certificate_logo_changed', handleCustomUpdate);
    };
  }
}

/**
 * Save new certificate logo to Firestore
 */
export async function saveCertificateLogo(
  logoUrl: string,
  adminEmail: string
): Promise<{ success: boolean; message: string }> {
  if (!canManageCertificateLogo(adminEmail)) {
    return {
      success: false,
      message: `ไม่อนุญาต: เฉพาะผู้ดูแลระบบ (${SUPER_ADMIN_EMAIL}) เท่านั้นที่สามารถเปลี่ยนภาพโลโก้บนเกียรติบัตรได้`,
    };
  }

  const payload: CertificateLogoConfig = {
    logoUrl,
    updatedBy: adminEmail,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(CERTIFICATE_LOGO_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }

  try {
    window.dispatchEvent(new CustomEvent('acu_certificate_logo_changed', { detail: logoUrl }));
  } catch {
    // ignore
  }

  try {
    const docRef = doc(db, 'system_settings', CERTIFICATE_LOGO_DOC_ID);
    await setDoc(docRef, payload, { merge: true });
    return { success: true, message: 'บันทึกภาพโลโก้บนเกียรติบัตรเรียบร้อยแล้ว' };
  } catch (err: any) {
    console.error('Failed to save certificate logo to Firestore:', err);
    return {
      success: false,
      message: err.message || 'เกิดข้อผิดพลาดในการบันทึกภาพโลโก้เกียรติบัตรลงฐานข้อมูล',
    };
  }
}

/**
 * Reset certificate logo back to default school logo
 */
export async function resetCertificateLogo(
  adminEmail: string
): Promise<{ success: boolean; message: string }> {
  if (!canManageCertificateLogo(adminEmail)) {
    return {
      success: false,
      message: `ไม่อนุญาต: เฉพาะผู้ดูแลระบบ (${SUPER_ADMIN_EMAIL}) เท่านั้นที่สามารถรีเซ็ตได้`,
    };
  }

  try {
    localStorage.removeItem(CERTIFICATE_LOGO_STORAGE_KEY);
  } catch {
    // ignore
  }

  const defaultUrl = getInitialLogoUrl();
  try {
    window.dispatchEvent(new CustomEvent('acu_certificate_logo_changed', { detail: defaultUrl }));
  } catch {
    // ignore
  }

  try {
    const docRef = doc(db, 'system_settings', CERTIFICATE_LOGO_DOC_ID);
    await deleteDoc(docRef);
    return {
      success: true,
      message: 'รีเซ็ตโลโก้บนเกียรติบัตรกลับเป็นภาพโลโก้ทางการของโรงเรียนเรียบร้อยแล้ว',
    };
  } catch (err) {
    console.error('Failed to reset certificate logo:', err);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการรีเซ็ตโลโก้เกียรติบัตร',
    };
  }
}
