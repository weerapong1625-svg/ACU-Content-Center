import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isQuotaExceededError, notifyQuotaExceeded } from '../firebase';

export const SUPER_ADMIN_EMAIL = 'weerapong1625@acu.ac.th';
export const DEFAULT_LOGO_IMAGE = '/acu_active_logo.png';

const LOGO_DOC_ID = 'school_logo';
export const LOGO_STORAGE_KEY = 'acu_school_logo_config';
const SETTINGS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SchoolLogoConfig {
  logoUrl: string;
  updatedBy?: string;
  updatedAt?: string;
  cachedAt?: number;
}

let inFlightLogoFetch: Promise<string> | null = null;
let sessionLogoFetched = false;

/**
 * Check if the provided email is the designated Super Admin
 */
export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

function readCachedLogoEntry(): SchoolLogoConfig | null {
  try {
    const raw = localStorage.getItem(LOGO_STORAGE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as SchoolLogoConfig;
      if (cached && typeof cached.logoUrl === 'string' && cached.logoUrl.trim()) {
        return cached;
      }
    }
  } catch (err) {
    console.warn('Could not read cached logo config:', err);
  }
  return null;
}

function isLogoCacheFresh(cached: SchoolLogoConfig | null): boolean {
  if (!cached || typeof cached.cachedAt !== 'number') return false;
  return Date.now() - cached.cachedAt < SETTINGS_CACHE_TTL_MS;
}

/**
 * Synchronously get initial logo URL from local cache or fallback
 */
export function getInitialLogoUrl(): string {
  const cached = readCachedLogoEntry();
  if (cached?.logoUrl) {
    return cached.logoUrl;
  }
  return DEFAULT_LOGO_IMAGE;
}

/**
 * Fetch school logo once from Firestore (respecting 24h localStorage cache unless force=true)
 */
export async function fetchSchoolLogoOnce(force = false): Promise<string> {
  if (inFlightLogoFetch) {
    return inFlightLogoFetch;
  }

  const cached = readCachedLogoEntry();
  if (!force && (sessionLogoFetched || isLogoCacheFresh(cached))) {
    return cached?.logoUrl || DEFAULT_LOGO_IMAGE;
  }

  inFlightLogoFetch = (async () => {
    try {
      const logoRef = doc(db, 'system_settings', LOGO_DOC_ID);
      const snapshot = await getDoc(logoRef);
      sessionLogoFetched = true;

      if (snapshot.exists()) {
        const data = snapshot.data() as SchoolLogoConfig;
        if (data?.logoUrl) {
          const toCache: SchoolLogoConfig = { ...data, cachedAt: Date.now() };
          try {
            localStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify(toCache));
          } catch {
            // ignore
          }
          try {
            window.dispatchEvent(new CustomEvent('acu_school_logo_changed', { detail: data.logoUrl }));
          } catch {}
          return data.logoUrl;
        }
      }

      // Cache default state for 24h so missing doc doesn't cause repeated reads
      const defaultEntry: SchoolLogoConfig = { logoUrl: DEFAULT_LOGO_IMAGE, cachedAt: Date.now() };
      try {
        localStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify(defaultEntry));
      } catch {}
      return DEFAULT_LOGO_IMAGE;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        notifyQuotaExceeded();
        console.warn('[Firestore] Daily read quota exceeded for logo fetch; using cached/default logo.');
      } else {
        console.warn('School logo fetch fallback:', error);
      }
      return getInitialLogoUrl();
    } finally {
      inFlightLogoFetch = null;
    }
  })();

  return inFlightLogoFetch;
}

/**
 * Smart-cached subscription to school logo (one-time getDoc cached for 24h + instant local event sync)
 */
export function subscribeSchoolLogo(onUpdate: (logoUrl: string) => void): () => void {
  onUpdate(getInitialLogoUrl());

  const handleCustomUpdate = (e: Event) => {
    const custom = e as CustomEvent<string>;
    if (custom.detail) {
      onUpdate(custom.detail);
    }
  };
  window.addEventListener('acu_school_logo_changed', handleCustomUpdate);

  let active = true;
  fetchSchoolLogoOnce(false)
    .then((url) => {
      if (active && url) {
        onUpdate(url);
      }
    })
    .catch(() => {
      if (active) onUpdate(getInitialLogoUrl());
    });

  return () => {
    active = false;
    window.removeEventListener('acu_school_logo_changed', handleCustomUpdate);
  };
}

/**
 * Save new school logo (strictly permitted for weerapong1625@acu.ac.th only)
 */
export async function saveSchoolLogo(
  logoUrl: string,
  adminEmail: string
): Promise<{ success: boolean; message: string }> {
  if (!isSuperAdmin(adminEmail)) {
    return {
      success: false,
      message: `ไม่อนุญาต: เฉพาะผู้ดูแลระบบ (${SUPER_ADMIN_EMAIL}) เท่านั้นที่สามารถเปลี่ยนโลโก้โรงเรียนได้`,
    };
  }

  const payload: SchoolLogoConfig = {
    logoUrl,
    updatedBy: adminEmail,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify({ ...payload, cachedAt: Date.now() }));
    sessionLogoFetched = true;
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }

  // Dispatch custom event for instantaneous UI update across all components
  try {
    window.dispatchEvent(new CustomEvent('acu_school_logo_changed', { detail: logoUrl }));
  } catch {
    // ignore
  }

  try {
    const logoRef = doc(db, 'system_settings', LOGO_DOC_ID);
    await setDoc(logoRef, payload, { merge: true });
    return { success: true, message: 'บันทึกโลโก้โรงเรียนเรียบร้อยแล้ว' };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      console.warn('[Firestore] Quota exceeded while saving school logo; preserved locally.');
      return { success: true, message: 'บันทึกโลโก้โรงเรียนในเครื่องเรียบร้อยแล้ว (ฐานข้อมูลออนไลน์เกินโควตารายวัน)' };
    }
    console.warn('Failed to save school logo to Firestore:', err);
    return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล' };
  }
}

/**
 * Reset school logo back to default ACU N.png (strictly permitted for weerapong1625@acu.ac.th only)
 */
export async function resetSchoolLogo(
  adminEmail: string
): Promise<{ success: boolean; message: string }> {
  if (!isSuperAdmin(adminEmail)) {
    return {
      success: false,
      message: `ไม่อนุญาต: เฉพาะผู้ดูแลระบบ (${SUPER_ADMIN_EMAIL}) เท่านั้นที่สามารถรีเซ็ตโลโก้โรงเรียนได้`,
    };
  }

  try {
    localStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify({ logoUrl: DEFAULT_LOGO_IMAGE, cachedAt: Date.now() }));
    sessionLogoFetched = true;
  } catch {
    // ignore
  }

  try {
    window.dispatchEvent(new CustomEvent('acu_school_logo_changed', { detail: DEFAULT_LOGO_IMAGE }));
  } catch {
    // ignore
  }

  try {
    const logoRef = doc(db, 'system_settings', LOGO_DOC_ID);
    await deleteDoc(logoRef);
    return { success: true, message: 'รีเซ็ตโลโก้กลับเป็นค่าเริ่มต้นทางการเรียบร้อยแล้ว' };
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      return { success: true, message: 'รีเซ็ตโลโก้ในเครื่องเรียบร้อยแล้ว' };
    }
    console.warn('Failed to delete school logo from Firestore:', err);
    return { success: false, message: 'เกิดข้อผิดพลาดในการรีเซ็ตโลโก้' };
  }
}
