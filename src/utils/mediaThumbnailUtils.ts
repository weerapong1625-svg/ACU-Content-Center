/**
 * Utilities for lightweight media/innovation thumbnails without storing Base64 in Firestore.
 * - Extracts YouTube video IDs -> `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`
 * - Rejects `data:` Base64 and `blob:` strings from Firestore cover thumbnails
 * - Detects link categories (YouTube, Google Drive, Canva, PDF, Print, Tech) for clean icon rendering
 */

export type MediaLinkCategory =
  | 'youtube'
  | 'gdrive'
  | 'canva'
  | 'pdf'
  | 'print'
  | 'tech'
  | 'other';

export function isDataOrBlobUri(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('data:') || trimmed.startsWith('blob:');
}

export function isPlaceholderLogoPath(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed === '/acu_active_logo.png' ||
    trimmed === '/acu n.png' ||
    trimmed === 'acu_active_logo.png' ||
    trimmed === 'acu n.png'
  );
}

/**
 * Extract 11-character YouTube video ID from standard watch, youtu.be, embed, shorts, or live URLs.
 */
export function extractYouTubeVideoId(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0] || '';
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }

      const parts = parsed.pathname.split('/').filter(Boolean);
      if (
        parts.length >= 2 &&
        ['embed', 'shorts', 'live', 'v', 'vi'].includes(parts[0].toLowerCase())
      ) {
        const candidate = parts[1];
        return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
      }
    }
  } catch {
    const regexMatch = trimmed.match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
    );
    if (regexMatch && regexMatch[1]) {
      return regexMatch[1];
    }
  }

  return null;
}

/**
 * Build canonical high-quality YouTube thumbnail URL or empty string.
 */
export function getYouTubeThumbnailUrl(url?: string | null): string {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
}

/**
 * Prepare a cover/thumbnail URL for Firestore persistence:
 * - Never writes Base64 `data:` or `blob:` URIs to Firestore.
 * - Automatically extracts YouTube thumbnail URL when `linkUrl` is a YouTube link.
 * - Preserves valid external `https://` / `http://` image URLs; returns '' otherwise.
 */
export function sanitizeMediaThumbnailForFirestore(
  rawThumb?: string | null,
  linkUrl?: string | null
): string {
  const ytThumb = getYouTubeThumbnailUrl(linkUrl);
  const trimmedThumb = typeof rawThumb === 'string' ? rawThumb.trim() : '';

  if (
    !trimmedThumb ||
    isDataOrBlobUri(trimmedThumb) ||
    isPlaceholderLogoPath(trimmedThumb)
  ) {
    return ytThumb || '';
  }

  if (/^https?:\/\//i.test(trimmedThumb)) {
    return trimmedThumb;
  }

  return ytThumb || '';
}

/**
 * Resolve the best thumbnail URL for UI rendering:
 * - Uses valid external `https://` / `http://` thumbnail URL when provided
 * - Automatically resolves YouTube thumbnail URL from `linkUrl`
 * - Returns '' for Drive/Canva/PDF/logo placeholders so components render crisp category icons
 */
export function resolveDisplayThumbnailUrl(
  rawThumb?: string | null,
  linkUrl?: string | null
): string {
  const ytThumb = getYouTubeThumbnailUrl(linkUrl);
  const trimmedThumb = typeof rawThumb === 'string' ? rawThumb.trim() : '';

  if (trimmedThumb && !isPlaceholderLogoPath(trimmedThumb)) {
    if (/^https?:\/\//i.test(trimmedThumb) || /^data:image\//i.test(trimmedThumb)) {
      return trimmedThumb;
    }
  }

  return ytThumb || '';
}

/**
 * Detect link / media category for rendering clean icons when no external thumbnail is present.
 */
export function detectMediaLinkCategory(
  linkUrl?: string | null,
  mediaType?: string | null
): { key: MediaLinkCategory; label: string } {
  const lowerUrl = (linkUrl || '').trim().toLowerCase();
  const lowerType = (mediaType || '').trim().toLowerCase();

  if (extractYouTubeVideoId(lowerUrl) || lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return { key: 'youtube', label: 'YouTube Video' };
  }
  if (
    lowerUrl.includes('drive.google.com') ||
    lowerUrl.includes('docs.google.com') ||
    lowerUrl.includes('slides.google.com') ||
    lowerUrl.includes('sheets.google.com') ||
    lowerUrl.includes('forms.gle')
  ) {
    return { key: 'gdrive', label: 'Google Drive' };
  }
  if (lowerUrl.includes('canva.com')) {
    return { key: 'canva', label: 'Canva Design' };
  }
  if (/\.pdf($|\?)/i.test(lowerUrl) || lowerType.includes('สิ่งพิมพ์') || lowerType.includes('ใบงาน')) {
    if (/\.pdf($|\?)/i.test(lowerUrl)) {
      return { key: 'pdf', label: 'PDF Document' };
    }
    return { key: 'print', label: 'สื่อสิ่งพิมพ์' };
  }
  if (lowerType.includes('เทคโนโลยี') || lowerUrl.startsWith('http')) {
    return { key: 'tech', label: 'สื่อดิจิทัล' };
  }
  return { key: 'other', label: mediaType?.trim() || 'สื่อนวัตกรรม' };
}
