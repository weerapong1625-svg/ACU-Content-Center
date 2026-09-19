import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface PopupBannerConfig {
  bannerImageUrl: string;
  title?: string;
  enabled?: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export const DEFAULT_BANNER_IMAGE = '/default_welcome_banner.jpg';

const BANNER_DOC_ID = 'popup_banner';
export const LOCAL_STORAGE_KEY = 'acu_popup_banner_config';

/**
 * Synchronously retrieve the active banner URL immediately on initial render.
 * Prevents any delay or flash of the old default image during page refresh.
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
 * Ensures mobile and desktop screens receive newly uploaded banners instantly without hanging.
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
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
            } catch {
              // ignore
            }
            onUpdate(data);
            return;
          }
        }
        // Fallback to cache or default if document doesn't exist
        const initial = getInitialBannerUrl();
        onUpdate({
          bannerImageUrl: initial,
          title: 'ประกาศ/ภาพประชาสัมพันธ์',
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
 * Checks Firestore first, then falls back to LocalStorage, and finally DEFAULT_BANNER_IMAGE
 */
export async function fetchPopupBannerConfig(): Promise<PopupBannerConfig> {
  // Try to load cached config from LocalStorage first for instant rendering
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
        // Cache to LocalStorage
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        } catch {
          // ignore
        }
        return data;
      }
    }
  } catch (err) {
    console.error('Failed to fetch banner config from Firestore:', err);
  }

  // If cached has custom image, use that; otherwise default original image
  if (cached && cached.bannerImageUrl) {
    return cached;
  }

  return {
    bannerImageUrl: DEFAULT_BANNER_IMAGE,
    title: 'พระราชดำรัส สมเด็จพระกนิษฐาธิราชเจ้า กรมสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี',
    enabled: true,
  };
}

/**
 * Save new banner configuration to Firestore and LocalStorage (Admin feature)
 */
export async function savePopupBannerConfig(config: {
  bannerImageUrl: string;
  title?: string;
  updatedBy?: string;
}): Promise<boolean> {
  const payload: PopupBannerConfig = {
    bannerImageUrl: config.bannerImageUrl,
    title: config.title || 'ประกาศ/ภาพประชาสัมพันธ์',
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
 * Reset banner configuration back to default original image
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
