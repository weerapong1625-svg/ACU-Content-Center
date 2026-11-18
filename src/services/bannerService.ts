import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, isQuotaExceededError, notifyQuotaExceeded } from '../firebase';

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

function getCachedBannerConfig(): PopupBannerConfig | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as PopupBannerConfig;
    }
  } catch (err) {
    console.warn('Could not read cached banner config:', err);
  }
  return null;
}

function getCachedOrDefaultBannerConfig(): PopupBannerConfig {
  const cached = getCachedBannerConfig();
  if (cached && cached.bannerImageUrl) {
    return {
      bannerImageUrl: cached.bannerImageUrl,
      bannerImageUrl2: cached.bannerImageUrl2 || DEFAULT_BANNER_IMAGE_2,
      title: cached.title || 'ประกาศ/ภาพประชาสัมพันธ์ 1',
      title2: cached.title2 || 'ประกาศ/ภาพประชาสัมพันธ์ 2',
      enabled: cached.enabled !== false,
      updatedBy: cached.updatedBy,
      updatedAt: cached.updatedAt,
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
 * Synchronously retrieve active banner URL 1 immediately on initial render.
 */
export function getInitialBannerUrl(): string {
  const cached = getCachedBannerConfig();
  if (cached && typeof cached.bannerImageUrl === 'string' && cached.bannerImageUrl.trim()) {
    return cached.bannerImageUrl;
  }
  return DEFAULT_BANNER_IMAGE;
}

/**
 * Synchronously retrieve active banner URL 2 immediately on initial render.
 */
export function getInitialBannerUrl2(): string {
  const cached = getCachedBannerConfig();
  if (cached && typeof cached.bannerImageUrl2 === 'string' && cached.bannerImageUrl2.trim()) {
    return cached.bannerImageUrl2;
  }
  return DEFAULT_BANNER_IMAGE_2;
}

/**
 * Check if a custom or cached banner configuration exists in local storage
 */
export function hasCachedBannerConfig(): boolean {
  const cached = getCachedBannerConfig();
  return Boolean(cached && cached.bannerImageUrl);
}

/**
 * Real-time subscription to the announcement banner configuration in Firestore.
 */
export function subscribePopupBanner(onUpdate: (config: PopupBannerConfig) => void): () => void {
  onUpdate(getCachedOrDefaultBannerConfig());

  const handleCustomUpdate = (e: Event) => {
    const custom = e as CustomEvent<PopupBannerConfig>;
    if (custom.detail) {
      onUpdate(custom.detail);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('acu_popup_banner_changed', handleCustomUpdate);
  }

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
        onUpdate(getCachedOrDefaultBannerConfig());
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          notifyQuotaExceeded();
          console.warn('[Firestore] Daily read quota exceeded for banner subscription; using cached/default banner.');
          onUpdate(getCachedOrDefaultBannerConfig());
          return;
        }
        console.warn('Realtime banner subscription warning:', error);
        onUpdate(getCachedOrDefaultBannerConfig());
      }
    );
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('acu_popup_banner_changed', handleCustomUpdate);
      }
      unsubscribe();
    };
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
    }
    console.warn('Could not initialize realtime banner listener:', err);
    onUpdate(getCachedOrDefaultBannerConfig());
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('acu_popup_banner_changed', handleCustomUpdate);
      }
    };
  }
}

/**
 * Fetch the active popup banner configuration
 */
export async function fetchPopupBannerConfig(): Promise<PopupBannerConfig> {
  const cached = getCachedBannerConfig();

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
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      console.warn('[Firestore] Daily read quota exceeded while fetching banner config; using local/default fallback.');
    } else {
      console.warn('Notice fetching banner config from Firestore; using fallback:', err);
    }
  }

  return getCachedOrDefaultBannerConfig();
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
  const current = getCachedOrDefaultBannerConfig();
  const payload: PopupBannerConfig = {
    bannerImageUrl: config.bannerImageUrl || current.bannerImageUrl,
    bannerImageUrl2: config.bannerImageUrl2 || current.bannerImageUrl2 || DEFAULT_BANNER_IMAGE_2,
    title: config.title || current.title || 'ประกาศ/ภาพประชาสัมพันธ์ 1',
    title2: config.title2 || current.title2 || 'ประกาศ/ภาพประชาสัมพันธ์ 2',
    enabled: true,
    updatedBy: config.updatedBy || 'weerapong1625@acu.ac.th',
    updatedAt: new Date().toISOString(),
  };

  // 1. Cache immediately to LocalStorage & notify components instantly
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_popup_banner_changed', { detail: payload }));
    }
  } catch {}

  // 2. Persist to Firebase Firestore
  try {
    const bannerRef = doc(db, 'system_settings', BANNER_DOC_ID);
    await setDoc(bannerRef, payload, { merge: true });
    return true;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      console.warn('[Firestore] Quota exceeded while saving banner config; preserved locally.');
      return true;
    }
    console.warn('Failed to save banner config to Firestore:', err);
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
  const defaultCfg: PopupBannerConfig = {
    bannerImageUrl: DEFAULT_BANNER_IMAGE,
    bannerImageUrl2: DEFAULT_BANNER_IMAGE_2,
    title: 'พระราชดำรัส สมเด็จพระกนิษฐาธิราชเจ้า กรมสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี',
    title2: 'พระราชดำรัสเกี่ยวกับการใช้ปัญญาประดิษฐ์ (AI)',
    enabled: true,
  };
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('acu_popup_banner_changed', { detail: defaultCfg }));
    }
  } catch {}

  try {
    const bannerRef = doc(db, 'system_settings', BANNER_DOC_ID);
    await deleteDoc(bannerRef);
    return true;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
      console.warn('[Firestore] Quota exceeded while resetting banner config.');
      return true;
    }
    console.warn('Failed to delete banner config from Firestore:', err);
    return false;
  }
}
