import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export const SUPER_ADMIN_EMAIL = 'weerapong1625@acu.ac.th';
export const DEFAULT_LOGO_IMAGE = '/ACU N.png';

const LOGO_DOC_ID = 'school_logo';
export const LOGO_STORAGE_KEY = 'acu_school_logo_config';

export interface SchoolLogoConfig {
  logoUrl: string;
  updatedBy?: string;
  updatedAt?: string;
}

/**
 * Check if the provided email is the designated Super Admin
 */
export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

/**
 * Synchronously get initial logo URL from local cache or fallback
 */
export function getInitialLogoUrl(): string {
  try {
    const raw = localStorage.getItem(LOGO_STORAGE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && typeof cached.logoUrl === 'string' && cached.logoUrl.trim()) {
        return cached.logoUrl;
      }
    }
  } catch (err) {
    console.warn('Could not read cached logo config:', err);
  }
  return DEFAULT_LOGO_IMAGE;
}

/**
 * Real-time subscription to school logo stored in Firestore
 */
export function subscribeSchoolLogo(onUpdate: (logoUrl: string) => void): () => void {
  const handleCustomUpdate = (e: Event) => {
    const custom = e as CustomEvent<string>;
    if (custom.detail) {
      onUpdate(custom.detail);
    }
  };
  window.addEventListener('acu_school_logo_changed', handleCustomUpdate);

  try {
    const logoRef = doc(db, 'system_settings', LOGO_DOC_ID);
    const unsubscribe = onSnapshot(
      logoRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as SchoolLogoConfig;
          if (data?.logoUrl) {
            try {
              localStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify(data));
            } catch {
              // ignore
            }
            onUpdate(data.logoUrl);
            return;
          }
        }
        // Fallback
        const initial = getInitialLogoUrl();
        onUpdate(initial);
      },
      (error) => {
        console.warn('Realtime logo subscription warning:', error);
        onUpdate(getInitialLogoUrl());
      }
    );
    return () => {
      window.removeEventListener('acu_school_logo_changed', handleCustomUpdate);
      unsubscribe();
    };
  } catch (err) {
    console.warn('Could not initialize realtime logo listener:', err);
    onUpdate(getInitialLogoUrl());
    return () => {
      window.removeEventListener('acu_school_logo_changed', handleCustomUpdate);
    };
  }
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
    localStorage.setItem(LOGO_STORAGE_KEY, JSON.stringify(payload));
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
    console.error('Failed to save school logo to Firestore:', err);
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
    localStorage.removeItem(LOGO_STORAGE_KEY);
  } catch {
    // ignore
  }

  try {
    const logoRef = doc(db, 'system_settings', LOGO_DOC_ID);
    await deleteDoc(logoRef);
    return { success: true, message: 'รีเซ็ตโลโก้กลับเป็นค่าเริ่มต้นทางการ (ACU N.png) เรียบร้อยแล้ว' };
  } catch (err) {
    console.error('Failed to delete school logo from Firestore:', err);
    return { success: false, message: 'เกิดข้อผิดพลาดในการรีเซ็ตโลโก้' };
  }
}
