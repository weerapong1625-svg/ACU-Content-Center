import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isQuotaExceededError, notifyQuotaExceeded, waitForAuthReady } from '../firebase';
import { isDataOrBlobUri, sanitizeMediaThumbnailForFirestore } from '../utils/mediaThumbnailUtils';

export const BUNDLES_COLLECTION = 'bundles';
export const BUNDLE_FALLBACK_COLLECTION = 'system_settings';

export const MEDIA_INDEX_BUNDLE_ID = 'media_index';
export const INNOVATIONS_INDEX_BUNDLE_ID = 'innovations_index';
export const IDEAS_INDEX_BUNDLE_ID = 'ideas_index';

export type BundleKind = 'media_index' | 'innovations_index' | 'ideas_index';

// Auto-shard above 800KB to guarantee every Firestore doc stays safely below 1MB
export const BUNDLE_SHARD_MAX_BYTES = 800 * 1024;
export const BUNDLE_CHUNK_TARGET_BYTES = 720 * 1024;

export interface BundleIndexEntry {
  id: string;
  title: string;
  subjectGroup: string;
  gradeLevel: string;
  mediaType: string;
  link: string;
  teacherId: string;
  teacherName: string;
  stars: number;
  views: number;
  createdAt: string;
  // Compact non-Base64 metadata for 100% UI & permission compatibility
  email?: string;
  productionType?: string;
  itemNumber?: number;
  subjectName?: string;
  usageDetails?: string;
  description?: string;
  thumbnailUrl?: string;
  ratingCount?: number;
  likes?: number;
  likedBy?: string[];
  userRatings?: Record<string, number>;
  category?: string;
  categoryLabel?: string;
  tags?: string[];
  status?: string;
}

interface BundleShardDocument {
  items: BundleIndexEntry[];
  shardIndex: number;
  shardCount: number;
  totalCount: number;
  updatedAt: string;
}

let useSettingsBundleFallback = false;

function isPermissionDeniedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as any).code) : '';
  const msg = 'message' in err ? String((err as any).message) : '';
  return (
    code === 'permission-denied' ||
    msg.includes('permission-denied') ||
    msg.includes('Missing or insufficient permissions')
  );
}

function getUtf8ByteLength(str: string): number {
  try {
    if (typeof Blob !== 'undefined') {
      return new Blob([str]).size;
    }
  } catch {}
  return str.length * 2;
}

function getBundleDocId(kind: BundleKind, shardIndex: number, useFallbackCol: boolean): string {
  const base = useFallbackCol ? `bundle_${kind}` : kind;
  return shardIndex === 0 ? base : `${base}_${shardIndex}`;
}

async function getBundleDocSnap(kind: BundleKind, shardIndex = 0) {
  if (!useSettingsBundleFallback) {
    try {
      const primaryId = getBundleDocId(kind, shardIndex, false);
      const primarySnap = await getDoc(doc(db, BUNDLES_COLLECTION, primaryId));
      if (primarySnap.exists()) {
        return primarySnap;
      }
      if (shardIndex === 0) {
        const mirrorId = getBundleDocId(kind, shardIndex, true);
        const mirrorSnap = await getDoc(doc(db, BUNDLE_FALLBACK_COLLECTION, mirrorId));
        if (mirrorSnap.exists()) {
          return mirrorSnap;
        }
      }
      return primarySnap;
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        useSettingsBundleFallback = true;
        const mirrorId = getBundleDocId(kind, shardIndex, true);
        return getDoc(doc(db, BUNDLE_FALLBACK_COLLECTION, mirrorId));
      }
      throw err;
    }
  }
  const mirrorId = getBundleDocId(kind, shardIndex, true);
  return getDoc(doc(db, BUNDLE_FALLBACK_COLLECTION, mirrorId));
}

async function writeBundleDoc(
  kind: BundleKind,
  shardIndex: number,
  payload: BundleShardDocument
): Promise<void> {
  if (!useSettingsBundleFallback) {
    try {
      const primaryId = getBundleDocId(kind, shardIndex, false);
      await setDoc(doc(db, BUNDLES_COLLECTION, primaryId), payload, { merge: false });
      return;
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        useSettingsBundleFallback = true;
        const mirrorId = getBundleDocId(kind, shardIndex, true);
        await setDoc(doc(db, BUNDLE_FALLBACK_COLLECTION, mirrorId), payload, { merge: false });
        return;
      }
      throw err;
    }
  }
  const mirrorId = getBundleDocId(kind, shardIndex, true);
  await setDoc(doc(db, BUNDLE_FALLBACK_COLLECTION, mirrorId), payload, { merge: false });
}

async function deleteBundleDocIfPossible(kind: BundleKind, shardIndex: number): Promise<void> {
  if (shardIndex <= 0) return;
  try {
    const col = useSettingsBundleFallback ? BUNDLE_FALLBACK_COLLECTION : BUNDLES_COLLECTION;
    const docId = getBundleDocId(kind, shardIndex, useSettingsBundleFallback);
    await deleteDoc(doc(db, col, docId));
  } catch {
    // Non-fatal cleanup
  }
}

function cleanBundleString(val: unknown, maxLen = 400): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed || isDataOrBlobUri(trimmed)) return '';
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

/**
 * Enforce strictly lightweight, Base64-free bundle entry metadata.
 */
export function sanitizeBundleEntry(raw: Partial<BundleIndexEntry> & { id: string }): BundleIndexEntry {
  const link = cleanBundleString(raw.link, 500);
  const safeThumb = sanitizeMediaThumbnailForFirestore(raw.thumbnailUrl, link);
  const entry: BundleIndexEntry = {
    id: String(raw.id).trim(),
    title: cleanBundleString(raw.title, 220),
    subjectGroup: cleanBundleString(raw.subjectGroup, 120),
    gradeLevel: cleanBundleString(raw.gradeLevel, 80),
    mediaType: cleanBundleString(raw.mediaType, 80),
    link,
    teacherId: cleanBundleString(raw.teacherId || raw.email, 120),
    teacherName: cleanBundleString(raw.teacherName, 120),
    stars: typeof raw.stars === 'number' && Number.isFinite(raw.stars) ? raw.stars : 0,
    views: typeof raw.views === 'number' && Number.isFinite(raw.views) ? raw.views : 0,
    createdAt: cleanBundleString(raw.createdAt, 60) || new Date().toISOString(),
  };

  const cleanEmail = cleanBundleString(raw.email, 120).toLowerCase();
  if (cleanEmail) entry.email = cleanEmail;
  if (raw.productionType) entry.productionType = cleanBundleString(raw.productionType, 80);
  if (typeof raw.itemNumber === 'number' && raw.itemNumber > 0) entry.itemNumber = raw.itemNumber;
  if (raw.subjectName) entry.subjectName = cleanBundleString(raw.subjectName, 160);
  if (raw.usageDetails) entry.usageDetails = cleanBundleString(raw.usageDetails, 240);
  if (raw.description) entry.description = cleanBundleString(raw.description, 260);
  if (safeThumb) entry.thumbnailUrl = safeThumb;
  if (typeof raw.ratingCount === 'number') entry.ratingCount = raw.ratingCount;
  if (typeof raw.likes === 'number') entry.likes = raw.likes;
  if (Array.isArray(raw.likedBy) && raw.likedBy.length > 0) {
    entry.likedBy = raw.likedBy
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0 && !isDataOrBlobUri(x))
      .slice(0, 200);
  }
  if (raw.userRatings && typeof raw.userRatings === 'object' && Object.keys(raw.userRatings).length > 0) {
    entry.userRatings = raw.userRatings;
  }
  if (raw.category) entry.category = cleanBundleString(raw.category, 60);
  if (raw.categoryLabel) entry.categoryLabel = cleanBundleString(raw.categoryLabel, 80);
  if (Array.isArray(raw.tags) && raw.tags.length > 0) {
    entry.tags = raw.tags.filter((t): t is string => typeof t === 'string' && !isDataOrBlobUri(t)).slice(0, 10);
  }
  if (raw.status) entry.status = cleanBundleString(raw.status, 40);

  return entry;
}

export function toMediaBundleEntry(item: any): BundleIndexEntry {
  const link = item?.onlineUrl || item?.link || '';
  const email = (
    item?.submittedByEmail ||
    item?.userEmail ||
    item?.email ||
    item?.teacherEmail ||
    item?.authorEmail ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase();

  return sanitizeBundleEntry({
    id: String(item?.id || ''),
    title: item?.title || item?.mediaTitle || '',
    subjectGroup: item?.subjectGroup || '',
    gradeLevel: item?.gradeLevel || '',
    mediaType: item?.mediaType || 'สื่ออื่น ๆ',
    link,
    teacherId: String(item?.uid || item?.userId || item?.teacherId || email || ''),
    teacherName: item?.teacherName || item?.authorName || '',
    stars: typeof item?.ratingAvg === 'number' ? item.ratingAvg : Number(item?.stars || 0),
    views: Number(item?.views || 0),
    createdAt: item?.createdAt || new Date().toISOString(),
    email,
    productionType: item?.productionType || 'ครูผลิตสื่อเอง',
    itemNumber: typeof item?.itemNumber === 'number' ? item.itemNumber : undefined,
    subjectName: item?.subjectName || '',
    description: item?.description || '',
    thumbnailUrl: sanitizeMediaThumbnailForFirestore(item?.thumbnailUrl, link),
    ratingCount: typeof item?.ratingCount === 'number' ? item.ratingCount : 0,
    likes: typeof item?.likes === 'number' ? item.likes : 0,
    likedBy: Array.isArray(item?.likedBy) ? item.likedBy : undefined,
    userRatings: item?.userRatings,
    status: item?.status || 'ส่งเรียบร้อย',
  });
}

export function toInnovationBundleEntry(item: any): BundleIndexEntry {
  const link = item?.onlineUrl || item?.link || '';
  const email = (
    item?.userEmail ||
    item?.email ||
    item?.submittedByEmail ||
    item?.teacherEmail ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase();

  return sanitizeBundleEntry({
    id: String(item?.id || ''),
    title: item?.mediaTitle || item?.title || '',
    subjectGroup: item?.subjectGroup || '',
    gradeLevel: item?.gradeLevel || '',
    mediaType: item?.mediaType || 'สื่ออื่น ๆ',
    link,
    teacherId: String(item?.uid || item?.userId || item?.teacherId || email || ''),
    teacherName: item?.teacherName || item?.authorName || '',
    stars: Number(item?.stars || 0),
    views: Number(item?.views || 0),
    createdAt: item?.submittedAt || item?.createdAt || new Date().toISOString(),
    email,
    productionType: item?.productionType || 'ครูผลิตสื่อเอง',
    itemNumber: Number(item?.itemNumber) || 1,
    usageDetails: item?.usageDetails || '',
    thumbnailUrl: sanitizeMediaThumbnailForFirestore(item?.imageUrl || item?.coverImageUrl, link),
    status: item?.status || 'ส่งเรียบร้อย',
  });
}

export function toIdeaBundleEntry(item: any): BundleIndexEntry {
  const link = item?.url || item?.link || '';
  const email = (item?.creatorEmail || item?.email || '').toString().trim().toLowerCase();

  return sanitizeBundleEntry({
    id: String(item?.id || ''),
    title: item?.title || '',
    subjectGroup: item?.categoryLabel || '',
    gradeLevel: '',
    mediaType: item?.category || 'official_portal',
    link,
    teacherId: email,
    teacherName: item?.creatorName || item?.teacherName || '',
    stars: typeof item?.ratingAvg === 'number' ? item.ratingAvg : Number(item?.stars || 5),
    views: Number(item?.views || 0),
    createdAt: item?.createdAt || new Date().toISOString(),
    email,
    description: item?.description || '',
    thumbnailUrl: sanitizeMediaThumbnailForFirestore(item?.imageUrl || item?.thumbnailUrl, link),
    ratingCount: typeof item?.ratingCount === 'number' ? item.ratingCount : 0,
    userRatings: item?.userRatings,
    category: item?.category || '',
    categoryLabel: item?.categoryLabel || '',
    tags: Array.isArray(item?.tags) ? item.tags : undefined,
  });
}

/**
 * Split entries into shard chunks where each chunk stays under BUNDLE_CHUNK_TARGET_BYTES (< 800KB).
 */
function buildShardedChunks(entries: BundleIndexEntry[]): BundleIndexEntry[][] {
  const sanitized = entries.map((e) => sanitizeBundleEntry(e));
  const singlePayload: BundleShardDocument = {
    items: sanitized,
    shardIndex: 0,
    shardCount: 1,
    totalCount: sanitized.length,
    updatedAt: new Date().toISOString(),
  };

  if (getUtf8ByteLength(JSON.stringify(singlePayload)) <= BUNDLE_SHARD_MAX_BYTES) {
    return [sanitized];
  }

  const chunks: BundleIndexEntry[][] = [];
  let currentChunk: BundleIndexEntry[] = [];
  let currentBytes = 128; // envelope overhead

  for (const item of sanitized) {
    const itemBytes = getUtf8ByteLength(JSON.stringify(item)) + 2;
    if (currentChunk.length > 0 && currentBytes + itemBytes > BUNDLE_CHUNK_TARGET_BYTES) {
      chunks.push(currentChunk);
      currentChunk = [item];
      currentBytes = 128 + itemBytes;
    } else {
      currentChunk.push(item);
      currentBytes += itemBytes;
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  return chunks.length > 0 ? chunks : [[]];
}

/**
 * Read a single-document index bundle (auto-reading `_1`, `_2` shards only if `shardCount > 1`).
 */
export async function readBundleIndexOnce(
  kind: BundleKind
): Promise<{ exists: boolean; items: BundleIndexEntry[] }> {
  await waitForAuthReady();
  const rootSnap = await getBundleDocSnap(kind, 0);
  if (!rootSnap.exists()) {
    return { exists: false, items: [] };
  }

  const rootData = rootSnap.data() as Partial<BundleShardDocument> | undefined;
  const rootItems = Array.isArray(rootData?.items) ? rootData!.items : [];
  const shardCount =
    typeof rootData?.shardCount === 'number' && rootData.shardCount > 1
      ? Math.min(rootData.shardCount, 25)
      : 1;

  if (shardCount === 1) {
    return {
      exists: true,
      items: rootItems.filter((it) => it && it.id).map((it) => sanitizeBundleEntry(it)),
    };
  }

  const shardIndices = Array.from({ length: shardCount - 1 }, (_, i) => i + 1);
  const shardResults = await Promise.all(
    shardIndices.map((idx) => getBundleDocSnap(kind, idx).catch(() => null))
  );

  const combined: BundleIndexEntry[] = [...rootItems];
  shardResults.forEach((snap) => {
    if (snap && snap.exists()) {
      const data = snap.data() as Partial<BundleShardDocument> | undefined;
      if (Array.isArray(data?.items)) {
        combined.push(...data.items);
      }
    }
  });

  return {
    exists: true,
    items: combined.filter((it) => it && it.id).map((it) => sanitizeBundleEntry(it)),
  };
}

/**
 * Write an entire bundle index to Firestore, automatically sharding into `_1`, `_2` when > 800KB.
 */
export async function writeBundleIndex(
  kind: BundleKind,
  entries: BundleIndexEntry[],
  previousShardCount = 1
): Promise<{ shardCount: number; totalCount: number }> {
  const chunks = buildShardedChunks(entries);
  const shardCount = chunks.length;
  const totalCount = entries.length;
  const nowIso = new Date().toISOString();

  await Promise.all(
    chunks.map((chunk, idx) =>
      writeBundleDoc(kind, idx, {
        items: chunk,
        shardIndex: idx,
        shardCount,
        totalCount,
        updatedAt: nowIso,
      })
    )
  );

  // Clean up any trailing shards if bundle shrank
  if (previousShardCount > shardCount) {
    for (let idx = shardCount; idx < previousShardCount; idx++) {
      await deleteBundleDocIfPossible(kind, idx);
    }
  }

  return { shardCount, totalCount };
}

/**
 * Upsert one entry in a bundle document so the index stays 100% up-to-date on create/edit/rate/like.
 * Uses provided in-memory items when present (0 extra reads before write).
 */
export async function upsertBundleEntry(
  kind: BundleKind,
  entry: BundleIndexEntry,
  cachedEntries?: BundleIndexEntry[]
): Promise<void> {
  try {
    const cleanEntry = sanitizeBundleEntry(entry);
    let baseEntries: BundleIndexEntry[];

    if (cachedEntries && cachedEntries.length > 0) {
      baseEntries = cachedEntries.map((e) => sanitizeBundleEntry(e));
    } else {
      const serverRes = await readBundleIndexOnce(kind);
      baseEntries = serverRes.items;
    }

    const existingIdx = baseEntries.findIndex((e) => e.id === cleanEntry.id);
    if (existingIdx >= 0) {
      baseEntries[existingIdx] = { ...baseEntries[existingIdx], ...cleanEntry };
    } else {
      baseEntries = [cleanEntry, ...baseEntries];
    }

    await writeBundleIndex(kind, baseEntries);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
    } else {
      console.warn(`upsertBundleEntry(${kind}) skipped:`, err);
    }
  }
}

/**
 * Remove one or more IDs from a bundle document on delete.
 */
export async function removeBundleEntries(
  kind: BundleKind,
  idsToRemove: string[],
  cachedEntries?: BundleIndexEntry[]
): Promise<void> {
  if (!idsToRemove || idsToRemove.length === 0) return;
  const removeSet = new Set(idsToRemove.map((id) => String(id).trim()).filter(Boolean));
  if (removeSet.size === 0) return;

  try {
    let baseEntries: BundleIndexEntry[];
    if (cachedEntries && cachedEntries.length > 0) {
      baseEntries = cachedEntries.map((e) => sanitizeBundleEntry(e));
    } else {
      const serverRes = await readBundleIndexOnce(kind);
      if (!serverRes.exists) return;
      baseEntries = serverRes.items;
    }

    const nextEntries = baseEntries.filter((e) => !removeSet.has(e.id));
    await writeBundleIndex(kind, nextEntries);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      notifyQuotaExceeded();
    } else {
      console.warn(`removeBundleEntries(${kind}) skipped:`, err);
    }
  }
}
