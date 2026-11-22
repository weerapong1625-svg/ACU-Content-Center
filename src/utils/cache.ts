import { safeLocalStorageSetItem } from '../firebase';

export const APP_CACHE_VERSION = '2026.11.1';
export const APP_CACHE_VERSION_STORAGE_KEY = 'appCacheVersion';

const EXACT_DATA_CACHE_KEYS: readonly string[] = [
  'teacherMedia',
  'allInnovations',
  'admin_stats',
  'acu_cached_innovations_submissions',
  'acu_cached_innovations_fetched_at',
  'acu_cached_teacher_media',
  'acu_cached_teacher_media_fetched_at',
  'acu_cached_facility_submissions',
  'acu_cached_facilities_fetched_at',
  'acu_cached_shared_ideas',
  'acu_cached_shared_ideas_fetched_at',
  'acu_cached_all_user_profiles_map',
  'acu_cached_all_user_profiles_fetched_at',
  'acu_cached_reward_claims',
  'acu_cached_reward_claims_fetched_at',
  'acu_single_claim_fetched_at_map',
  'acu_persistent_login_logs',
  'acu_login_logs_fetched_at',
  'acu_site_summary_cache',
  'acu_admin_overall_stats_cache',
  'acu_admin_overview_cache',
  'acu_school_logo_config',
  'acu_certificate_logo_config',
  'acu_popup_banner_config',
  'acu_google_sheets_config_cache',
  'acu_criteria_poster_config',
  'acu_media_criteria_poster',
];

const EXACT_PRESERVED_AUTH_KEYS = new Set<string>([
  APP_CACHE_VERSION_STORAGE_KEY,
  'acu_current_user_email',
  'acu_user_email',
  'acu_user_role',
  'acu_last_active_time',
  'acu_remembered_gmail',
  'acu_user_credentials_vault',
  'acu_active_firestore_db_id',
  'acu_device_id',
  'acu_pending_login_logs',
  'acu_deleted_user_emails',
  'acu_deleted_media_ids',
  'acu_announcement_hidden_date',
]);

function isPreservedAuthOrSessionKey(key: string): boolean {
  if (EXACT_PRESERVED_AUTH_KEYS.has(key)) return true;
  if (key.startsWith('firebase:')) return true;
  if (key.startsWith('acu_last_auto_visit_')) return true;
  if (key.startsWith('acu_user_avatar_')) return true;
  return false;
}

function isDataCacheKey(key: string): boolean {
  if (isPreservedAuthOrSessionKey(key)) return false;
  if (EXACT_DATA_CACHE_KEYS.includes(key)) return true;
  if (key.startsWith('bundles/') || key.startsWith('bundle_')) return true;
  if (key.startsWith('acu_cached_')) return true;
  if (key.startsWith('acu_admin_')) return true;
  if (key.startsWith('acu_users_uid_cache_')) return true;
  if (key.startsWith('acu_user_full_profile_')) return true;
  if (key.endsWith('_fetched_at')) return true;
  return false;
}

/**
 * Compares APP_CACHE_VERSION against localStorage.getItem('appCacheVersion').
 * If mismatched or missing, wipes data cache keys while strictly preserving
 * authentication state and user session tokens, then stores the active version.
 *
 * Returns true if cache invalidation occurred.
 */
export function invalidateAppDataCacheIfVersionMismatch(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const storedVersion = localStorage.getItem(APP_CACHE_VERSION_STORAGE_KEY);
    if (storedVersion === APP_CACHE_VERSION) {
      return false;
    }

    for (const exactKey of EXACT_DATA_CACHE_KEYS) {
      if (!isPreservedAuthOrSessionKey(exactKey)) {
        try {
          localStorage.removeItem(exactKey);
        } catch {
          // ignore per-key removal errors
        }
      }
    }

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && isDataCacheKey(key)) {
        try {
          localStorage.removeItem(key);
        } catch {
          // ignore per-key removal errors
        }
      }
    }

    safeLocalStorageSetItem(APP_CACHE_VERSION_STORAGE_KEY, APP_CACHE_VERSION);
    window.dispatchEvent(
      new CustomEvent('acu_cache_invalidated', {
        detail: { previousVersion: storedVersion, currentVersion: APP_CACHE_VERSION },
      })
    );
    return true;
  } catch {
    return false;
  }
}
