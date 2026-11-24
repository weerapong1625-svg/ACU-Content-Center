import { auth } from '../firebase';

export const MAX_AVATAR_DIM = 200;
export const DEFAULT_AVATAR_QUALITY = 0.75;
export const MAX_AVATAR_BYTES = 80 * 1024; // Strictly under 80KB

/**
 * Returns true if the URL is a temporary browser blob: URL (never persist or render across devices)
 */
export function isBlobUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.trim().toLowerCase().startsWith('blob:');
}

/**
 * Returns true if the URL is a generic ui-avatars.com generated initials URL
 */
export function isUiAvatarPlaceholder(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.trim().toLowerCase().includes('ui-avatars.com/api');
}

/**
 * Strip invalid / temporary blob: URLs and whitespace
 */
export function sanitizeAvatarUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || isBlobUrl(trimmed)) return '';
  return trimmed;
}

/**
 * Returns true if URL is a real custom photo (valid non-blob, non-placeholder image URL or Base64 data URL)
 */
export function isCustomAvatarUrl(url?: string | null): boolean {
  const clean = sanitizeAvatarUrl(url);
  if (!clean) return false;
  return !isUiAvatarPlaceholder(clean);
}

/**
 * Build deterministic initials fallback avatar URL
 */
export function buildFallbackAvatarUrl(nameOrEmail?: string | null, size = 160): string {
  const seed = (nameOrEmail || 'ACU User').trim() || 'ACU User';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    seed
  )}&background=1d4ed8&color=ffffff&size=${size}&bold=true`;
}

/**
 * Resolve display avatar URL following strict priority:
 * 1) Custom photoURL stored in Firestore users/{uid} document (valid, non-blob)
 * 2) Custom avatarUrl stored in Firestore user_profiles document (valid, non-blob)
 * 3) Firebase Auth user.photoURL (valid, non-blob)
 * 4) Cached local avatar (valid, non-blob — used during offline/initial hydration)
 * 5) Fallback user initials / default avatar URL
 */
export function resolveDisplayAvatarUrl(options: {
  customPhotoUrl?: string | null;
  firestoreAvatarUrl?: string | null;
  authPhotoUrl?: string | null;
  localCachedAvatarUrl?: string | null;
  fallbackSeedName?: string | null;
  size?: number;
}): string {
  const size = options.size || 160;
  const usersPhoto = sanitizeAvatarUrl(options.customPhotoUrl);
  const profilePhoto = sanitizeAvatarUrl(options.firestoreAvatarUrl);
  const authPhoto = sanitizeAvatarUrl(options.authPhotoUrl);
  const localPhoto = sanitizeAvatarUrl(options.localCachedAvatarUrl);

  // 1) Custom photo from Firestore users/{uid}
  if (usersPhoto && !isUiAvatarPlaceholder(usersPhoto)) {
    return usersPhoto;
  }
  // 2) Custom photo from Firestore user_profiles
  if (profilePhoto && !isUiAvatarPlaceholder(profilePhoto)) {
    return profilePhoto;
  }
  // 3) Firebase Auth provider photoURL
  if (authPhoto && !isUiAvatarPlaceholder(authPhoto)) {
    return authPhoto;
  }
  // 4) Local cached photo (non-placeholder, non-blob)
  if (localPhoto && !isUiAvatarPlaceholder(localPhoto)) {
    return localPhoto;
  }
  // 5) Fallback initials avatar
  return buildFallbackAvatarUrl(options.fallbackSeedName, size);
}

/**
 * Safely get Firebase Auth user's photoURL only if their email matches the target email
 */
export function getMatchingAuthPhotoUrl(targetEmail?: string | null): string {
  const norm = (targetEmail || '').toLowerCase().trim();
  if (!norm) return '';
  try {
    const currentUser = auth?.currentUser;
    if (
      currentUser?.email &&
      currentUser.email.toLowerCase().trim() === norm &&
      currentUser.photoURL
    ) {
      return sanitizeAvatarUrl(currentUser.photoURL);
    }
  } catch {
    // ignore
  }
  return '';
}

/**
 * Compute accurate UTF-8 byte length of a string / Data URL
 */
export function getDataUrlByteLength(dataUrl: string): number {
  if (!dataUrl) return 0;
  try {
    if (typeof Blob !== 'undefined') {
      return new Blob([dataUrl]).size;
    }
  } catch {
    // fallback
  }
  return dataUrl.length;
}

/**
 * Compress an uploaded image File on client-side using HTML5 <canvas>:
 * - Max 200x200px (aspect ratio preserved)
 * - JPEG quality 0.75 (automatically stepped down if needed so Base64 Data URL is strictly < 80KB)
 */
export function compressAvatarFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPG, PNG, WebP)'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์รูปภาพ'));
    reader.onload = (event) => {
      const rawResult = event.target?.result;
      if (typeof rawResult !== 'string' || !rawResult.startsWith('data:image/')) {
        reject(new Error('รูปแบบไฟล์รูปภาพไม่ถูกต้อง'));
        return;
      }

      const img = new Image();
      img.onerror = () =>
        reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ กรุณาลองเลือกไฟล์อื่น (JPG, PNG, WebP)'));
      img.onload = () => {
        const tryRender = (maxDim: number, quality: number): string => {
          let width = img.width || maxDim;
          let height = img.height || maxDim;

          if (width > height) {
            if (width > maxDim) {
              height = Math.max(1, Math.round((height * maxDim) / width));
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.max(1, Math.round((width * maxDim) / height));
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('ไม่สามารถประมวลผลรูปภาพผ่าน Canvas ได้');
          }
          // Fill white background before drawing in case of transparent PNG/WebP
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          return canvas.toDataURL('image/jpeg', quality);
        };

        try {
          // Primary attempt: max 200x200px, JPEG quality 0.75
          let dataUrl = tryRender(MAX_AVATAR_DIM, DEFAULT_AVATAR_QUALITY);

          // Step down quality if >= 78KB to guarantee strictly under 80KB Spark Plan budget
          const qualitySteps = [0.65, 0.55, 0.45, 0.35];
          for (const q of qualitySteps) {
            if (getDataUrlByteLength(dataUrl) < 78000) break;
            dataUrl = tryRender(MAX_AVATAR_DIM, q);
          }

          // Final dimension fallback if still >= 78KB
          const dimSteps = [160, 128, 96];
          for (const d of dimSteps) {
            if (getDataUrlByteLength(dataUrl) < 78000) break;
            dataUrl = tryRender(d, 0.55);
          }

          if (getDataUrlByteLength(dataUrl) >= MAX_AVATAR_BYTES) {
            dataUrl = tryRender(96, 0.4);
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('ไม่สามารถบีบอัดรูปภาพได้'));
        }
      };
      img.src = rawResult;
    };

    reader.readAsDataURL(file);
  });
}
