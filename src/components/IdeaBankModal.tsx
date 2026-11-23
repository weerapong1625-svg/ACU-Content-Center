import React, { useState, useEffect } from 'react';
import {
  X,
  Lightbulb,
  ExternalLink,
  Search,
  Sparkles,
  Calendar,
  Globe,
  Plus,
  Bookmark,
  CheckCircle2,
  Edit3,
  Trash2,
  ShieldCheck,
  Gift,
  AlertCircle,
  Image as ImageIcon,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  IDEA_RESOURCES,
  IDEA_CATEGORIES,
  IdeaResource,
  getIdeaFallbackImage,
  getLiveWebsiteScreenshotUrl,
  extractIdeaDomain,
  getIdeaFaviconUrl,
  isBareFacebookUrl,
  matchSeedPreviewByUrl,
} from '../data/ideaResources';
import { SpecialPrivilegesModal } from './SpecialPrivilegesModal';
import {
  saveSharedIdea,
  updateSharedIdea,
  deleteSharedIdea,
  canUserModify,
  SharedIdeaItem,
} from '../services/submissionService';
import { useFirestoreData, useSyncButtonState } from '../context/FirestoreDataContext';

interface IdeaBankModalProps {
  userEmail?: string;
  onClose: () => void;
}

type AvailableCategory = 'official_portal' | 'manual_guide' | 'research' | 'exams' | 'facebook';

function normalizeHttpUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === '#') return '';
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return trimmed;
  return `https://${trimmed}`;
}

function isValidHttpUrl(rawUrl?: string): boolean {
  const trimmed = (rawUrl || '').trim();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

interface SiteFaviconProps {
  url?: string;
  sizeClass?: string;
}

const SiteFavicon: React.FC<SiteFaviconProps> = ({ url, sizeClass = 'w-4 h-4' }) => {
  const [failed, setFailed] = useState(false);
  const faviconUrl = getIdeaFaviconUrl(url);

  useEffect(() => {
    setFailed(false);
  }, [faviconUrl]);

  if (!faviconUrl || failed) {
    return <Globe className={`${sizeClass} text-amber-400 flex-shrink-0`} />;
  }

  return (
    <img
      src={faviconUrl}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-xs object-contain flex-shrink-0 bg-white/95 p-0.5`}
    />
  );
};

interface WebsitePreviewSurfaceProps {
  item: IdeaResource;
  compact?: boolean;
}

const WebsitePreviewSurface: React.FC<WebsitePreviewSurfaceProps> = ({ item, compact = false }) => {
  const domain = extractIdeaDomain(item.url);
  const directPreview = item.previewImage?.trim() || '';
  const dynamicLiveUrl = !directPreview && !item.portalTheme && isValidHttpUrl(item.url)
    ? getLiveWebsiteScreenshotUrl(item.url)
    : '';
  const initialImg = directPreview || dynamicLiveUrl;
  const fallbackImg = getIdeaFallbackImage(item.category);

  const [imgSrc, setImgSrc] = useState<string>(initialImg);
  const [imgFailed, setImgFailed] = useState<boolean>(!initialImg);

  useEffect(() => {
    setImgSrc(initialImg);
    setImgFailed(!initialImg);
  }, [initialImg]);

  // 1. Real website screenshot available (or custom user imageUrl)
  if (!imgFailed && imgSrc) {
    return (
      <img
        src={imgSrc}
        alt={`ภาพตัวอย่างหน้าเว็บไซต์ ${item.title}`}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => {
          if (!item.portalTheme && imgSrc !== fallbackImg) {
            setImgSrc(fallbackImg);
          } else {
            setImgFailed(true);
          }
        }}
        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
      />
    );
  }

  // 2. Bespoke Mini Website UI Preview matching the official portal's brand & structure
  if (item.portalTheme) {
    const theme = item.portalTheme;
    return (
      <div className={`w-full h-full bg-gradient-to-br ${theme.headerBg} flex flex-col justify-between select-none relative overflow-hidden`}>
        {/* Simulated real website top navigation bar */}
        <div className={`w-full bg-slate-950/45 backdrop-blur-xs border-b border-white/10 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} flex items-center justify-between gap-2`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <SiteFavicon url={item.url} sizeClass={compact ? 'w-3 h-3' : 'w-4 h-4'} />
            <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-bold text-white truncate`}>
              {domain}
            </span>
          </div>
          {!compact && (
            <div className="flex items-center gap-1.5 overflow-hidden">
              {theme.navItems.slice(0, 3).map((nav) => (
                <span key={nav} className="text-[9px] text-white/80 bg-white/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                  {nav}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Portal Hero Canvas */}
        <div className={`flex-1 flex flex-col justify-center ${compact ? 'px-2.5 py-1.5' : 'px-4 py-3'} relative`}>
          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className={`w-8 h-1 rounded-full ${theme.accentBg} ${compact ? 'mb-1' : 'mb-2'}`} />
          <div className={`font-extrabold text-white tracking-tight leading-tight truncate ${compact ? 'text-xs' : 'text-base sm:text-lg'}`}>
            {theme.heroTitle}
          </div>
          {!compact && (
            <div className="mt-1 text-[11px] text-white/85 line-clamp-1">
              {theme.heroSub}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Clean domain-branded visual fallback (never broken)
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex flex-col items-center justify-center gap-1.5 p-3">
      <SiteFavicon url={item.url} sizeClass={compact ? 'w-5 h-5' : 'w-8 h-8'} />
      <span className="text-xs font-semibold text-slate-200 truncate max-w-full">
        {domain || item.categoryLabel}
      </span>
    </div>
  );
};

interface WebsitePreviewCardMediaProps {
  item: IdeaResource;
}

const WebsitePreviewCardMedia: React.FC<WebsitePreviewCardMediaProps> = ({ item }) => {
  const domain = extractIdeaDomain(item.url);

  return (
    <div className="relative overflow-hidden border-b border-slate-700/80 bg-slate-950">
      {/* Browser-style Address Bar Chrome */}
      <div className="px-3 py-1.5 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0" aria-hidden="true">
            <span className="w-2 h-2 rounded-full bg-slate-700" />
            <span className="w-2 h-2 rounded-full bg-slate-700" />
            <span className="w-2 h-2 rounded-full bg-slate-700" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800/90 max-w-full">
            <SiteFavicon url={item.url} sizeClass="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium text-slate-300 truncate">
              {domain || 'แหล่งเรียนรู้ครู ACU'}
            </span>
          </div>
        </div>
        {item.isOfficialCore && (
          <span className="text-[10px] font-semibold text-amber-300 flex-shrink-0">
            เว็บหลักทางการ
          </span>
        )}
      </div>

      {/* 16:9 Website Preview Surface */}
      <div className="relative aspect-[16/9] w-full bg-slate-900 overflow-hidden">
        <WebsitePreviewSurface item={item} />

        {/* Subtle bottom edge contrast + hover visit cue */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950/85 to-transparent pointer-events-none" />
        <div className="absolute bottom-2 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="text-[10px] font-semibold text-white bg-amber-600/95 px-2 py-0.5 rounded-md shadow-sm inline-flex items-center gap-1">
            <span>คลิกเปิดเว็บ</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </span>
        </div>
      </div>
    </div>
  );
};

export const IdeaBankModal: React.FC<IdeaBankModalProps> = ({ userEmail = '', onClose }) => {
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [firestoreIdeas, setFirestoreIdeas] = useState<SharedIdeaItem[]>([]);
  const [isAddingIdea, setIsAddingIdea] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newCategory, setNewCategory] = useState<AvailableCategory>('official_portal');

  // Edit State
  const [editingIdea, setEditingIdea] = useState<SharedIdeaItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editCategory, setEditCategory] = useState<AvailableCategory>('official_portal');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isSubmittingIdea, setIsSubmittingIdea] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [isDeletingIdea, setIsDeletingIdea] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPrivilegesModal, setShowPrivilegesModal] = useState<boolean>(false);
  const {
    sharedIdeas: globalIdeas,
    coreCounts,
    hasMoreSharedIdeas,
    isLoadingMore,
    loadMoreSharedIdeas,
    ensureSharedIdeasLoaded,
    syncSharedIdeas,
  } = useFirestoreData();
  const isLoadingMoreIdeas = isLoadingMore('sharedIdeas');
  const {
    isSyncing: isRefreshing,
    cooldownSeconds: refreshCooldown,
    isDisabled: isRefreshDisabled,
    triggerSync: triggerIdeasSync,
    getButtonLabel: getRefreshLabel,
  } = useSyncButtonState('shared_ideas');

  const showNotice = (type: 'success' | 'error', message: string) => {
    setActionNotice({ type, message });
    setTimeout(() => {
      setActionNotice((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    ensureSharedIdeasLoaded();
  }, [ensureSharedIdeasLoaded]);

  useEffect(() => {
    setFirestoreIdeas(globalIdeas);
  }, [globalIdeas]);

  const handleRefreshIdeas = async () => {
    if (isRefreshDisabled) return;
    const { executed } = await triggerIdeasSync(async () => {
      await syncSharedIdeas();
    });
    if (executed) {
      showNotice('success', 'ซิงค์คลังไอเดียล่าสุดเรียบร้อยแล้ว (รีเฟรชได้อีกครั้งใน 60 วินาที)');
    }
  };

  // Dynamic Thai Date for Daily Update Indicator
  const todayThai = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Convert Firestore ideas to IdeaResource format (enriches known seed URLs with real screenshots/portal themes)
  const firestoreIdeaResources: IdeaResource[] = firestoreIdeas.map((f) => {
    const matched = matchSeedPreviewByUrl(f.url);
    return {
      id: f.id,
      category: f.category as IdeaResource['category'],
      categoryLabel: f.categoryLabel,
      title: f.title,
      description: f.description,
      url: f.url || '',
      previewImage: f.imageUrl || matched.previewImage,
      portalTheme: f.imageUrl ? undefined : matched.portalTheme,
      tags: f.tags || ['ไอเดียใหม่'],
      recommendedBadge: 'ไอเดียแบ่งปันโดยครู',
      featuredDaily: true,
    };
  });

  const allList = [...firestoreIdeaResources, ...IDEA_RESOURCES];

  // Core 6 official websites
  const coreOfficialWebsites = IDEA_RESOURCES.filter((item) => item.isOfficialCore);

  const filtered = allList.filter((item) => {
    const matchesCat =
      selectedCat === 'all' ||
      item.category === selectedCat ||
      (selectedCat === 'official_portal' &&
        ((item.category as string) === 'education' || (item.category as string) === 'resource_share')) ||
      (selectedCat === 'manual_guide' && (item.category as string) === 'canva_ai');

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q)) ||
      extractIdeaDomain(item.url).toLowerCase().includes(q);

    return matchesCat && matchesSearch;
  });

  const handleCopyUrl = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2000);
    } catch {
      showNotice('error', 'ไม่สามารถคัดลอกลิงก์อัตโนมัติได้');
    }
  };

  const handleAddCustomIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingIdea) return;
    if (!newTitle.trim()) return;

    const normalizedUrl = normalizeHttpUrl(newUrl);
    if (normalizedUrl && isBareFacebookUrl(normalizedUrl)) {
      showNotice('error', 'กรุณาระบุลิงก์เว็บไซต์ปลายทางที่มีเนื้อหาจริง (ไม่ใช้หน้าหลัก facebook.com)');
      return;
    }

    const catObj = IDEA_CATEGORIES.find((c) => c.id === newCategory);
    const catLabel = catObj?.label.replace(/^[^\s]+\s*/, '') || 'คลังความรู้';

    setIsSubmittingIdea(true);
    try {
      const res = await saveSharedIdea({
        category: newCategory,
        categoryLabel: catLabel,
        title: newTitle.trim(),
        description: newDesc.trim() || 'ข้อมูลและแหล่งเรียนรู้แบ่งปันโดยคณะครู ACU',
        url: normalizedUrl,
        imageUrl: newImageUrl.trim() ? normalizeHttpUrl(newImageUrl) : undefined,
        tags: ['คลังความรู้', 'แบ่งปันโดยครู'],
        creatorEmail: userEmail || 'anonymous',
        creatorName: userEmail ? userEmail.split('@')[0] : 'ครู ACU',
      });

      if (res.success) {
        showNotice('success', 'เพิ่มข้อมูลเข้าสู่คลังไอเดียเรียบร้อยแล้ว');
        setNewTitle('');
        setNewDesc('');
        setNewUrl('');
        setNewImageUrl('');
        setIsAddingIdea(false);
      } else {
        showNotice('error', res.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } catch {
      showNotice('error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmittingIdea(false);
    }
  };

  const handleOpenEdit = (item: IdeaResource) => {
    const raw = firestoreIdeas.find((f) => f.id === item.id);
    if (!raw) {
      showNotice('error', 'รายการนี้เป็นข้อมูลมาตรฐานของระบบ ไม่สามารถแก้ไขได้');
      return;
    }
    if (!canUserModify(raw.creatorEmail, userEmail)) {
      showNotice('error', 'เฉพาะผู้สร้างรายการนี้ หรือ Admin เท่านั้นที่สามารถแก้ไขได้');
      return;
    }
    setEditingIdea(raw);
    setEditTitle(raw.title);
    setEditDesc(raw.description);
    setEditUrl(raw.url || '');
    setEditImageUrl(raw.imageUrl || '');

    let mappedCat: AvailableCategory = 'official_portal';
    if (raw.category === 'manual_guide' || raw.category === 'canva_ai') mappedCat = 'manual_guide';
    else if (raw.category === 'research') mappedCat = 'research';
    else if (raw.category === 'exams') mappedCat = 'exams';
    else if (raw.category === 'facebook') mappedCat = 'facebook';
    else mappedCat = 'official_portal';

    setEditCategory(mappedCat);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingEdit) return;
    if (!editingIdea || !editTitle.trim()) return;

    const normalizedUrl = normalizeHttpUrl(editUrl);
    if (normalizedUrl && isBareFacebookUrl(normalizedUrl)) {
      showNotice('error', 'กรุณาระบุลิงก์เว็บไซต์ปลายทางที่มีเนื้อหาจริง (ไม่ใช้หน้าหลัก facebook.com)');
      return;
    }

    const catObj = IDEA_CATEGORIES.find((c) => c.id === editCategory);
    const catLabel = catObj?.label.replace(/^[^\s]+\s*/, '') || 'คลังความรู้';

    setIsSavingEdit(true);
    try {
      const res = await updateSharedIdea(
        editingIdea.id,
        {
          title: editTitle.trim(),
          description: editDesc.trim(),
          url: normalizedUrl,
          imageUrl: editImageUrl.trim() ? normalizeHttpUrl(editImageUrl) : '',
          category: editCategory,
          categoryLabel: catLabel,
        },
        userEmail
      );

      if (res.success) {
        showNotice('success', 'แก้ไขข้อมูลเรียบร้อยแล้ว');
        setEditingIdea(null);
      } else {
        showNotice('error', res.error || 'ไม่สามารถแก้ไขได้');
      }
    } catch {
      showNotice('error', 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteIdea = async (item: IdeaResource) => {
    if (isDeletingIdea) return;
    const raw = firestoreIdeas.find((f) => f.id === item.id);
    if (!raw) {
      showNotice('error', 'รายการนี้เป็นข้อมูลมาตรฐานของระบบ ไม่สามารถลบได้');
      return;
    }
    if (!canUserModify(raw.creatorEmail, userEmail)) {
      showNotice('error', 'เฉพาะผู้สร้างรายการนี้ หรือ Admin เท่านั้นที่สามารถลบได้');
      return;
    }

    setIsDeletingIdea(true);
    try {
      const res = await deleteSharedIdea(raw.id, userEmail);
      setConfirmDeleteId(null);
      if (res.success) {
        showNotice('success', 'ลบรายการเรียบร้อยแล้ว');
      } else {
        showNotice('error', res.error || 'ไม่สามารถลบข้อมูลได้');
      }
    } catch {
      showNotice('error', 'เกิดข้อผิดพลาดในการลบข้อมูล');
    } finally {
      setIsDeletingIdea(false);
    }
  };

  return (
    <div
      id="modal-idea-bank"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-6xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Fixed Header */}
        <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-amber-950/80 via-yellow-900/50 to-slate-900 border-b border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 flex-shrink-0 shadow-inner">
              <Lightbulb className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  6. คลังไอเดียและคลังความรู้ทางการ (IDEA HUB)
                </h3>
                <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30 font-medium">
                  ภาพตัวอย่างตรงเว็บไซต์จริง · เข้าชมได้ทันที
                </span>
              </div>
              <p className="text-xs text-amber-200/80 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>
                  อัปเดต: {todayThai} • รวมคลังสื่อ สสวท./สพฐ., Wordwall, GeoGebra, PhET, insKru และ Starfish Labz
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleRefreshIdeas}
              disabled={isRefreshDisabled}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={refreshCooldown > 0 ? `รอ ${refreshCooldown} วินาทีก่อนรีเฟรชอีกครั้ง` : 'รีเฟรชข้อมูลคลังไอเดียล่าสุด'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className={isRefreshing || refreshCooldown > 0 ? '' : 'hidden sm:inline'}>
                {getRefreshLabel('รีเฟรช')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddingIdea(!isAddingIdea)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {isAddingIdea ? 'ปิดแบบฟอร์ม' : 'แชร์แหล่งเรียนรู้'}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่างคลังไอเดีย"
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Edit Modal Popup */}
        {editingIdea && (
          <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveEdit}
              className="w-full max-w-lg bg-slate-900 border border-amber-500/50 rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-400" />
                  <h4 className="text-sm font-bold text-white">แก้ไขข้อมูลแหล่งเรียนรู้ / ไอเดีย</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingIdea(null)}
                  className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">ชื่อแหล่งข้อมูล / เว็บไซต์</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">ประเภทแหล่งข้อมูล</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as AvailableCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="official_portal">🏛️ คลังความรู้ & พอร์ทัลหลัก</option>
                    <option value="manual_guide">✨ เครื่องมือ AI & สื่อการสอนเชิงโต้ตอบ</option>
                    <option value="research">📚 วิจัย วิทยานิพนธ์ & วารสาร</option>
                    <option value="exams">📝 คลังข้อสอบ & เกณฑ์ประเมิน</option>
                    <option value="facebook">👥 ชุมชนครู & แหล่งแชร์ไอเดีย</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">ลิงก์ URL เว็บไซต์จริง</label>
                  <input
                    type="text"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">ลิงก์รูปภาพปก / ตัวอย่างหน้าเว็บ (ไม่บังคับ)</label>
                <input
                  type="text"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="https://... (เว้นว่างเพื่อให้ระบบดึงตัวอย่างจากเว็บไซต์จริง)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">คำอธิบายสรุป / จุดเด่นที่ดึงดูดผู้ชม</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setEditingIdea(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  {isSavingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Single Unified Scrollable Body (Prevents grid row collapse) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Special Privileges Activity Notice Banner */}
          <div className="mx-4 sm:mx-6 mt-3 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-purple-500/15 border border-amber-400/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2.5 text-slate-200">
              <span className="text-xl">🎁</span>
              <div>
                <span className="font-bold text-amber-300">สิทธิพิเศษสำหรับผู้เข้าใช้งานระบบ:</span>{' '}
                <span>
                  เพียงแค่คุณครูโพสต์แชร์แหล่งการเรียนรู้ <strong>20 ครั้งขึ้นไป</strong> ลุ้นรับรางวัล 1.ตุ๊กตา 🧸 2.ขนม 🍪 3.ลูกอม 🍬 ติดต่อรับได้ที่ห้องพักครู Com ชั้น 3 (ม.วีระพงษ์)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPrivilegesModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm self-end sm:self-center flex-shrink-0 cursor-pointer transition-transform hover:scale-105"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>เช็คสถานะสิทธิ์</span>
            </button>
          </div>

          {/* Action notice toast */}
          {actionNotice && (
            <div
              className={`mx-4 sm:mx-6 mt-3 p-3 rounded-2xl border flex items-center justify-between text-xs font-semibold animate-in fade-in ${
                actionNotice.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {actionNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
                <span>{actionNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionNotice(null)}
                className="opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Add Idea Form Accordion */}
          {isAddingIdea && (
            <form onSubmit={handleAddCustomIdea} className="mt-3 mx-4 sm:mx-6 p-4 rounded-2xl bg-slate-950/90 border border-amber-500/30 space-y-3 animate-in fade-in">
              <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                เพิ่มเว็บไซต์ คลังความรู้ หรือเครื่องมือสอนเข้าสู่คลังไอเดีย
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="ชื่อเว็บไซต์ / แหล่งเรียนรู้..."
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as AvailableCategory)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
                >
                  <option value="official_portal">🏛️ คลังความรู้ & พอร์ทัลหลัก</option>
                  <option value="manual_guide">✨ เครื่องมือ AI & สื่อการสอนเชิงโต้ตอบ</option>
                  <option value="research">📚 วิจัย วิทยานิพนธ์ & วารสาร</option>
                  <option value="exams">📝 คลังข้อสอบ & เกณฑ์ประเมิน</option>
                  <option value="facebook">👥 ชุมชนครู & แหล่งแชร์ไอเดีย</option>
                </select>
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="ลิงก์ URL เว็บไซต์จริง (เช่น https://wordwall.net)"
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
                />
                <div className="relative">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="ลิงก์ภาพหน้าเว็บ (ไม่บังคับ)"
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>
              <textarea
                rows={2}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="สรุปจุดเด่นที่ใช้งานได้จริง เช่น ดาวน์โหลดใบงานฟรี หรือสร้างควิซใน 1 นาที..."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmittingIdea}
                  onClick={() => setIsAddingIdea(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIdea}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  {isSubmittingIdea ? 'กำลังบันทึก...' : 'บันทึกลงคลังไอเดีย'}
                </button>
              </div>
            </form>
          )}

          {/* Pinned Section: 6 Official Core Sites with Real Website Previews */}
          {selectedCat === 'all' && searchQuery.trim() === '' && (
            <div className="px-4 sm:px-6 pt-3.5 pb-3 bg-gradient-to-b from-amber-950/30 to-transparent border-b border-amber-500/20">
              <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300 tracking-wide">
                    เว็บไซต์หลักทางการและคู่มือมาตรฐาน (6 แหล่งข้อมูลหลัก)
                  </span>
                </div>
                <span className="text-[11px] text-amber-300/80">
                  คลิกการ์ดเพื่อเปิดเข้าชมเว็บไซต์จริงทันที
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {coreOfficialWebsites.map((core) => {
                  const domain = extractIdeaDomain(core.url);
                  return (
                    <a
                      key={core.id}
                      href={core.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-amber-500/30 hover:border-amber-400/80 transition-all flex flex-col justify-between group shadow-sm hover:shadow-amber-500/15 overflow-hidden cursor-pointer"
                    >
                      <div>
                        <div className="relative h-20 w-full overflow-hidden bg-slate-950 border-b border-slate-700/70">
                          <WebsitePreviewSurface item={core} compact />
                          <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-slate-950/90 to-transparent pointer-events-none" />
                          <div className="absolute bottom-1 left-2 right-2 flex items-center gap-1 min-w-0">
                            <SiteFavicon url={core.url} sizeClass="w-3 h-3" />
                            <span className="text-[10px] font-medium text-slate-100 truncate drop-shadow-xs">
                              {domain}
                            </span>
                          </div>
                        </div>
                        <div className="p-2.5 pb-1">
                          <h5 className="text-[11px] font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                            {core.title.split('(')[0].trim()}
                          </h5>
                        </div>
                      </div>
                      <div className="px-2.5 pb-2 pt-1 flex items-center justify-between text-[10px] text-amber-400 font-medium">
                        <span>เยี่ยมชมเว็บ</span>
                        <ExternalLink className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sticky Search & Category Filter Tabs */}
          <div className="sticky top-0 z-20 p-3.5 sm:px-6 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 flex flex-col gap-3">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาคลังสื่อ SciMath, Wordwall, GeoGebra, PhET, DLTV, insKru, Starfish Labz, Canva, ThaiJO..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {IDEA_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedCat === cat.id
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resource Cards Grid (Full natural height per card — never collapsed) */}
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
            {filtered.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-400 text-xs">
                <Lightbulb className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                ไม่พบข้อมูลที่ตรงกับคำค้นหา ลองเปลี่ยนคำค้นหรือเลือกหมวดหมู่อื่น
              </div>
            ) : (
              filtered.map((item) => {
                const hasValidUrl = isValidHttpUrl(item.url);
                const raw = firestoreIdeas.find((f) => f.id === item.id);
                const canEdit = raw ? canUserModify(raw.creatorEmail, userEmail) : false;

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl bg-slate-800/90 border transition-all duration-300 flex flex-col justify-between shadow-md group overflow-hidden ${
                      item.isOfficialCore
                        ? 'border-amber-500/50 hover:border-amber-400 shadow-amber-500/10'
                        : 'border-slate-700/80 hover:border-amber-500/50 hover:shadow-amber-500/10'
                    }`}
                  >
                    {/* Clickable Preview + Title Area */}
                    {hasValidUrl ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block focus:outline-hidden cursor-pointer"
                      >
                        <WebsitePreviewCardMedia item={item} />
                        <div className="p-4 pb-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mb-1.5 flex-wrap">
                            <span className="text-amber-300">{item.categoryLabel}</span>
                            {item.recommendedBadge && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className={item.isOfficialCore ? 'text-amber-200 font-semibold' : 'text-emerald-300'}>
                                  {item.recommendedBadge}
                                </span>
                              </>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors leading-snug">
                            {item.title}
                          </h4>
                          <p className="mt-2 text-xs text-slate-300/90 leading-relaxed line-clamp-3">
                            {item.description}
                          </p>
                        </div>
                      </a>
                    ) : (
                      <div>
                        <WebsitePreviewCardMedia item={item} />
                        <div className="p-4 pb-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mb-1.5 flex-wrap">
                            <span className="text-amber-300">{item.categoryLabel}</span>
                            {item.recommendedBadge && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-300">{item.recommendedBadge}</span>
                              </>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-white leading-snug">{item.title}</h4>
                          <p className="mt-2 text-xs text-slate-300/90 leading-relaxed line-clamp-3">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      {/* Tags */}
                      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                        {item.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900/90 text-slate-400 border border-slate-700/70"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {/* Card Action Footer */}
                      <div className="px-4 py-3 bg-slate-900/55 border-t border-slate-700/70 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          {raw && canEdit ? (
                            confirmDeleteId === item.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isDeletingIdea}
                                  onClick={() => handleDeleteIdea(item)}
                                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  {isDeletingIdea ? 'กำลังลบ...' : 'ยืนยันลบ'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isDeletingIdea}
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-[11px] cursor-pointer"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(item)}
                                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                  title="แก้ไขข้อมูล"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>แก้ไข</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                  title="ลบข้อมูล"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>ลบ</span>
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Bookmark className="w-3 h-3 text-amber-400" />
                              {raw ? 'ไอเดียครู ACU' : item.isOfficialCore ? 'เว็บหลักทางการ' : 'แนะนำสำหรับครู'}
                            </span>
                          )}
                        </div>

                        {hasValidUrl ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyUrl(item.id, item.url)}
                              title="คัดลอกลิงก์เว็บไซต์"
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                            >
                              {copiedId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                            >
                              <span>เปิดเข้าชมเว็บ</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 text-[11px] border border-slate-700">
                            ไม่มีลิงก์แนบ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {hasMoreSharedIdeas && (
            <div className="px-4 sm:px-6 pb-6 flex flex-col items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => loadMoreSharedIdeas()}
                disabled={isLoadingMoreIdeas}
                className="px-6 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-200 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMoreIdeas ? 'animate-spin' : ''}`} />
                <span>{isLoadingMoreIdeas ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม (ไอเดียครู 24 รายการถัดไป)'}</span>
              </button>
              <span className="text-[11px] text-slate-400">
                โหลดไอเดียครูแล้ว {firestoreIdeas.length}
                {coreCounts.totalSharedIdeas > firestoreIdeas.length ? ` / ${coreCounts.totalSharedIdeas}` : ''} รายการ
              </span>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <span>คลังความรู้และไอเดียการจัดการเรียนรู้ • โรงเรียนอัสสัมชัญอุบลราชธานี</span>
          </div>
          <span className="text-amber-300/90 text-[11px]">
            แสดง {filtered.length} แหล่งเรียนรู้ที่เข้าชมได้จริง
            {coreCounts.totalSharedIdeas > firestoreIdeas.length
              ? ` (ไอเดียครูในระบบ ${coreCounts.totalSharedIdeas} รายการ)`
              : ''}
          </span>
        </div>
      </div>

      {/* Special Privileges Modal */}
      <SpecialPrivilegesModal
        isOpen={showPrivilegesModal}
        onClose={() => setShowPrivilegesModal(false)}
        userEmail={userEmail}
      />
    </div>
  );
};


