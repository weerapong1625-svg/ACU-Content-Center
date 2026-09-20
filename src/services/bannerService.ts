import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface PopupBannerConfig {
  bannerImageUrl: string;
  bannerImageUrl2?: string;
  title?: string;
  title2?: string;
  enabled?: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export const DEFAULT_BANNER_IMAGE = '/default_welcome_banner.jpg';
export const DEFAULT_BANNER_IMAGE_2 = '/798077767_1372050918343560_1643452051179615768_n.jpeg';

const BANNER_DOC_ID = 'popup_banner';
export const LOCAL_STORAGE_KEY = 'acu_popup_banner_config';

/**
 * Synchronously retrieve active banner URL 1 immediately on initial render.
 */
export function getInitialBannerUrl(): string {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && typeof cached.bannerImageUrl === 'string' && cached.bannerImageUrl.trim()) {
        return cached.bannerImageUrl;
      }
    }
  } catch (err) {
    console.warn('Could not read cached banner config:', err);
  }
  return DEFAULT_BANNER_IMAGE;
}

/**
 * Synchronously retrieve active banner URL 2 immediately on initial render.
 */
export function getInitialBannerUrl2(): string {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && typeof cached.bannerImageUrl2 === 'string' && cached.bannerImageUrl2.trim()) {
        return cached.bannerImageUrl2;
      }
    }
  } catch (err) {
    console.warn('Could not read cached banner config 2:', err);
  }
  return DEFAULT_BANNER_IMAGE_2;
}

/**
 * Check if a custom or cached banner configuration exists in local storage
 */
export function hasCachedBannerConfig(): boolean {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      return Boolean(cached && cached.bannerImageUrl);
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Real-time subscription to the announcement banner configuration in Firestore.
 */
export function subscribePopupBanner(onUpdate: (config: PopupBannerConfig) => void): () => void {
  try {
    const bannerRef = doc(db, 'system_settings', BANNER_DOC_ID);
    const unsubscribe = onSnapshot(
      bannerRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as PopupBannerConfig;
          if (data?.bannerImageUrl) {
            const configWithDefaults: PopupBannerConfig = {
              bannerImageUrl: data.bannerImageUrl,
              bannerImageUrl2: data.bannerImageUrl2 || DEFAULT_BANNER_IMAGE_2,
              title: data.title || 'ประชาสัมพันธ์ 1',
              title2: data.title2 || 'ประชาสัมพันธ์ 2 (พระราชดำรัสฯ ด้าน AI)',
              enabled: data.enabled !== false,
              updatedBy: data.updatedBy,
              updatedAt: data.updatedAt,
            };
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(configWithDefaults));
            } catch {
              // ignore
            }
            onUpdate(configWithDefaults);
            return;
          }
        }
        // Fallback to cache or default if document doesn't exist
        const initial1 = getInitialBannerUrl();
        const initial2 = getInitialBannerUrl2();
        onUpdate({
          bannerImageUrl: initial1,
          bannerImageUrl2: initial2,
          title: 'ประกาศ/ภาพประชาสัมพันธ์ 1',
          title2: 'ภาพประชาสัมพันธ์ 2 (พระราชดำรัสฯ ด้าน AI)',
          enabled: true,
        });
      },
      (error) => {
        console.warn('Realtime banner subscription warning:', error);
        fetchPopupBannerConfig().then(onUpdate);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Could not initialize realtime banner listener:', err);
    fetchPopupBannerConfig().then(onUpdate);
    return () => {};
  }
}

/**
 * Fetch the active popup banner configuration
 */
export async function fetchPopupBannerConfig(): Promise<PopupBannerConfig> {
  let cached: PopupBannerConfig | null = null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      cached = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Could not read cached banner config:', err);
  }

  try {
    const bannerRef = doc(db, 'system_settings', BANNER_DOC_ID);
    const snapshot = await getDoc(bannerRef);

    if (snapshot.exists()) {
      const data = snapshot.data() as PopupBannerConfig;
      if (data.bannerImageUrl) {
        const fullConfig: PopupBannerConfig = {
          bannerImageUrl: data.bannerImageUrl,
          bannerImageUrl2: data.bannerImageUrl2 || cached?.bannerImageUrl2 || DEFAULT_BANNER_IMAGE_2,
          title: data.title || 'ประกาศ/ภาพประชาสัมพันธ์ 1',
          title2: data.title2 || 'ประกาศ/ภาพประชาสัมพันธ์ 2',
          enabled: data.enabled !== false,
          updatedBy: data.updatedBy,
          updatedAt: data.updatedAt,
        };
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fullConfig));
        } catch {
          // ignore
        }
        return fullConfig;
      }
    }
  } catch (err) {
    console.error('Failed to fetch banner config from Firestore:', err);
  }

  if (cached && cached.bannerImageUrl) {
    return {
      bannerImageUrl: cached.bannerImageUrl,
      bannerImageUrl2: cached.bannerImageUrl2 || DEFAULT_BANNER_IMAGE_2,
      title: cached.title || 'ประกาศ/ภาพประชาสัมพันธ์ 1',
      title2: cached.title2 || 'ประกาศ/ภาพประชาสัมพันธ์ 2',
      enabled: true,
    };
  }

  return {
    bannerImageUrl: DEFAULT_BANNER_IMAGE,
    bannerImageUrl2: DEFAULT_BANNER_IMAGE_2,
    title: 'พระราชดำรัส สมเด็จพระกนิษฐาธิราชเจ้า กรมสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี',
    title2: 'พระราชดำรัสเกี่ยวกับการใช้ปัญญาประดิษฐ์ (AI)',
    enabled: true,
  };
}

/**
 * Save new banner configuration to Firestore and LocalStorage (Admin feature)
 */
export async function savePopupBannerConfig(config: {
  bannerImageUrl: string;
  bannerImageUrl2?: string;
  title?: string;
  title2?: string;
  updatedBy?: string;
}): Promise<boolean> {
  const current = await fetchPopupBannerConfig();
  const payload: PopupBannerConfig = {
    bannerImageUrl: config.bannerImageUrl || current.bannerImageUrl,
    bannerImageUrl2: config.bannerImageUrl2 || current.bannerImageUrl2 || DEFAULT_BANNER_IMAGE_2,
    title: config.title || current.title || 'ประกาศ/ภาพประชาสัมพันธ์ 1',
    title2: config.title2 || current.title2 || 'ประกาศ/ภาพประชาสัมพันธ์ 2',
    enabled: true,
    updatedBy: config.updatedBy || 'admin@acu.ac.th',
    updatedAt: new Date().toISOString(),
  };

  // 1. Cache immediately to LocalStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }

  // 2. Persist to Firebase Firestore
  try {
    const bannerRef = doc(db, 'system_settings', BANNER_DOC_ID);
    await setDoc(bannerRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to save banner config to Firestore:', err);
    return false;
  }
}

/**
 * Reset banner configuration back to default original images
 */
export async function resetPopupBannerConfig(): Promise<boolean> {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // ignore
  }

  try {
    const bannerRef = doc(db, 'system_settings', BANNER_DOC_ID);
    await deleteDoc(bannerRef);
    return true;
  } catch (err) {
    console.error('Failed to delete banner config from Firestore:', err);
    return false;
  }
}
