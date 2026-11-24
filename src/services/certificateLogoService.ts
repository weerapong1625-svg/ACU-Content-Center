import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isQuotaExceededError, notifyQuotaExceeded } from '../firebase';
import { SUPER_ADMIN_EMAIL, getInitialLogoUrl } from './logoService';
import { ADMIN_TARGET_EMAIL } from './submissionService';

export const CERTIFICATE_LOGO_DOC_ID = 'certificate_logo';
export const CERTIFICATE_LOGO_STORAGE_KEY = 'acu_certificate_logo_config';
const SETTINGS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CertificateLogoConfig {
  logoUrl: string;
  updatedBy?: string;
  updatedAt?: string;
  cachedAt?: number;
  isDefaultFallback?: boolean;
}

let inFlightCertLogoFetch: Promise<string> | null = null;
let sessionCertLogoFetched = false;

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

function readCachedCertLogoEntry(): CertificateLogoConfig | null {
  try {
    const raw = localStorage.getItem(CERTIFICATE_LOGO_STORAGE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as CertificateLogoConfig;
      if (cached && typeof cached.logoUrl === 'string') {
        return cached;
      }
    }
  } catch (err) {
    console.warn('Could not read cached certificate logo:', err);
  }
  return null;
}

function isCertLogoCacheFresh(cached: CertificateLogoConfig | null): boolean {
  if (!cached || typeof cached.cachedAt !== 'number') return false;
  return Date.now() - cached.cachedAt < SETTINGS_CACHE_TTL_MS;
}

/**
 * Synchronously get initial certificate logo URL from local storage or fallback to school logo
 */
export function getInitialCertificateLogoUrl(): string {
  const cached = readCachedCertLogoEntry();
  if (cached && !cached.isDefaultFallback && cached.logoUrl.trim()) {
    return cached.logoUrl;
  }
  return getInitialLogoUrl();
}

/**
 * One-time getDoc fetch for certificate logo with 24h localStorage cache
 */
export async function fetchCertificateLogoOnce(force = false): Promise<string> {
  if (inFlightCertLogoFetch) {
    return inFlightCertLogoFetch;
  }

  const cached = readCachedCertLogoEntry();
  if (!force && (sessionCertLogoFetched || isCertLogoCacheFresh(cached))) {
    return getInitialCertificateLogoUrl();
  }

  inFlightCertLogoFetch = (async () => {
    try {
      const docRef = doc(db, 'system_settings', CERTIFICATE_LOGO_DOC_ID);
      const snapshot = await getDoc(docRef);
      sessionCertLogoFetched = true;

      if (snapshot.exists()) {
        const data = snapshot.data() as CertificateLogoConfig;
        if (data?.logoUrl) {
          try {
            localStorage.setItem(
              CERTIFICATE_LOGO_STORAGE_KEY,
              JSON.stringify({ ...data, cachedAt: Date.now(), isDefaultFallback: false })
            );
          } catch {}
          try {
            window.dispatchEvent(new CustomEvent('acu_certificate_logo_changed', { detail: data.logoUrl }));
          } catch {}
          return data.logoUrl;
        }
      }

      const fallbackUrl = getInitialLogoUrl();
      try {
        localStorage.setItem(
          CERTIFICATE_LOGO_STORAGE_KEY,
          JSON.stringify({ logoUrl: '', cachedAt: Date.now(), isDefaultFallback: true })
        );
      } catch {}
      return fallbackUrl;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        notifyQuotaExceeded();
        console.warn('[Firestore] Daily read quota exceeded for certificate logo fetch; using cached/default logo.');
      } else {
        console.warn('Certificate logo fetch fallback:', error);
      }
      return getInitialCertificateLogoUrl();
    } finally {
      inFlightCertLogoFetch = null;
    }
  })();

  return inFlightCertLogoFetch;
}

/**
 * Smart-cached subscription to certificate logo in Firestore (24h TTL + local event sync)
 */
export function subscribeCertificateLogo(onUpdate: (url: string) => void): () => void {
  onUpdate(getInitialCertificateLogoUrl());

  const handleCustomUpdate = (e: Event) => {
    const custom = e as CustomEvent<string>;
    if (custom.detail) {
      onUpdate(custom.detail);
    }
  };
  window.addEventListener('acu_certificate_logo_changed', handleCustomUpdate);

  let active = true;
  fetchCertificateLogoOnce(false)
    .then((url) => {
      if (active && url) {
        onUpdate(url);
      }
    })
    .catch(() => {
      if (active) onUpdate(getInitialCertificateLogoUrl());
    });

  return () => {
    active = false;
    window.removeEventListener('acu_certificate_logo_changed', handleCustomUpdate);
  };
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
    localStorage.setItem(
      CERTIFICATE_LOGO_STORAGE_KEY,
      JSON.stringify({ ...payload, cachedAt: Date.now(), isDefaultFallback: false })
    );
    sessionCertLogoFetched = true;
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
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      return { success: true, message: 'บันทึกภาพโลโก้ในเครื่องเรียบร้อยแล้ว (ฐานข้อมูลออนไลน์เกินโควตารายวัน)' };
    }
    console.warn('Failed to save certificate logo to Firestore:', err);
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
    localStorage.setItem(
      CERTIFICATE_LOGO_STORAGE_KEY,
      JSON.stringify({ logoUrl: '', cachedAt: Date.now(), isDefaultFallback: true })
    );
    sessionCertLogoFetched = true;
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
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      return { success: true, message: 'รีเซ็ตโลโก้ในเครื่องเรียบร้อยแล้ว' };
    }
    console.warn('Failed to reset certificate logo:', err);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการรีเซ็ตโลโก้เกียรติบัตร',
    };
  }
}
