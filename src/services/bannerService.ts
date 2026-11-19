import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isQuotaExceededError, notifyQuotaExceeded } from '../firebase';

export interface PopupBannerConfig {
  bannerImageUrl: string;
  bannerImageUrl2?: string;
  title?: string;
  title2?: string;
  enabled?: boolean;
  updatedBy?: string;
  updatedAt?: string;
  cachedAt?: number;
}

export const DEFAULT_BANNER_IMAGE = '/default_welcome_banner.jpg';
export const DEFAULT_BANNER_IMAGE_2 = '/798077767_1372050918343560_1643452051179615768_n.jpeg';

const BANNER_DOC_ID = 'popup_banner';
export const LOCAL_STORAGE_KEY = 'acu_popup_banner_config';
const SETTINGS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let inFlightBannerFetch: Promise<PopupBannerConfig> | null = null;
let sessionBannerFetched = false;

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

function isBannerCacheFresh(cached: PopupBannerConfig | null): boolean {
  if (!cached || typeof cached.cachedAt !== 'number') return false;
  return Date.now() - cached.cachedAt < SETTINGS_CACHE_TTL_MS;
}

function getDefaultBannerConfig(): PopupBannerConfig {
  return {
    bannerImageUrl: DEFAULT_BANNER_IMAGE,
    bannerImageUrl2: DEFAULT_BANNER_IMAGE_2,
    title: 'พระราชดำรัส สมเด็จพระกนิษฐาธิราชเจ้า กรมสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี',
    title2: 'พระราชดำรัสเกี่ยวกับการใช้ปัญญาประดิษฐ์ (AI)',
    enabled: true,
  };
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
  return getDefaultBannerConfig();
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
 * Fetch the active popup banner configuration (one-time getDoc cached 24h in localStorage)
 */
export async function fetchPopupBannerConfig(force = false): Promise<PopupBannerConfig> {
  const cached = getCachedBannerConfig();
  if (!force && (sessionBannerFetched || isBannerCacheFresh(cached))) {
    return getCachedOrDefaultBannerConfig();
  }

  if (!force && inFlightBannerFetch) {
    return inFlightBannerFetch;
  }

  inFlightBannerFetch = (async () => {
    try {
      const bannerRef = doc(db, 'system_settings', BANNER_DOC_ID);
      const snapshot = await getDoc(bannerRef);
      sessionBannerFetched = true;

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
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...fullConfig, cachedAt: Date.now() }));
          } catch {
            // ignore
          }
          try {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('acu_popup_banner_changed', { detail: fullConfig }));
            }
          } catch {}
          return fullConfig;
        }
      }

      const defaultCfg = getDefaultBannerConfig();
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...defaultCfg, cachedAt: Date.now() }));
      } catch {}
      return defaultCfg;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
        console.warn('[Firestore] Daily read quota exceeded while fetching banner config; using local/default fallback.');
      } else {
        console.warn('Notice fetching banner config from Firestore; using fallback:', err);
      }
      return getCachedOrDefaultBannerConfig();
    } finally {
      inFlightBannerFetch = null;
    }
  })();

  return inFlightBannerFetch;
}

/**
 * Smart-cached subscription to the announcement banner configuration in Firestore (24h TTL + local event sync)
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

  let active = true;
  fetchPopupBannerConfig(false)
    .then((cfg) => {
      if (active) onUpdate(cfg);
    })
    .catch(() => {
      if (active) onUpdate(getCachedOrDefaultBannerConfig());
    });

  return () => {
    active = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('acu_popup_banner_changed', handleCustomUpdate);
    }
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
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...payload, cachedAt: Date.now() }));
    sessionBannerFetched = true;
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
  const defaultCfg = getDefaultBannerConfig();
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...defaultCfg, cachedAt: Date.now() }));
    sessionBannerFetched = true;
  } catch {
    // ignore
  }
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
