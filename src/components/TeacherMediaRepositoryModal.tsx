import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  FolderArchive, 
  Star, 
  Search, 
  Eye, 
  Shuffle, 
  Sparkles, 
  ExternalLink, 
  User, 
  BookOpen, 
  Filter,
  Layers,
  GraduationCap,
  Edit3,
  Trash2,
  CheckCircle2,
  Calendar,
  Plus,
  Heart,
  RefreshCw,
  Youtube,
  FileText,
  Palette,
  HardDrive,
  Globe
} from 'lucide-react';
import {
  detectMediaLinkCategory,
  isDataOrBlobUri,
  resolveDisplayThumbnailUrl,
  sanitizeMediaThumbnailForFirestore,
} from '../utils/mediaThumbnailUtils';
import { 
  TeacherMediaWork, 
  subscribeTeacherMedia, 
  refreshTeacherMedia,
  getManualRefreshCooldownSeconds,
  rateTeacherMedia, 
  toggleLikeTeacherMedia,
  updateTeacherMedia,
  deleteTeacherMedia,
  addTeacherMediaDirectly,
  incrementTeacherMediaViews,
  canUserModify,
  SUBJECT_GROUPS 
} from '../services/submissionService';

interface TeacherMediaRepositoryModalProps {
  userEmail: string;
  onClose: () => void;
}

// Maximum allowed media items displayed in Teacher Media Repository
const MAX_MEDIA_DISPLAY_LIMIT = 100;

/**
 * Generate a deterministic seed based on current date (YYYY-MM-DD)
 * to ensure all users see the same randomized selection for that day,
 * and it automatically re-randomizes every new day.
 */
const getDailyRandomSeed = (date: Date = new Date()): number => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 20260921;
};

/**
 * Seeded pseudo-random generator
 */
const seededRng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

/**
 * Shuffle an array deterministically using a seed
 */
function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const rng = seededRng(seed);
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const MediaThumbnailOrIcon: React.FC<{
  thumbnailUrl?: string;
  onlineUrl?: string;
  mediaType?: string;
  title: string;
  size?: 'sm' | 'lg';
}> = ({ thumbnailUrl, onlineUrl, mediaType, title, size = 'sm' }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const resolvedUrl = resolveDisplayThumbnailUrl(thumbnailUrl, onlineUrl);
  const cat = detectMediaLinkCategory(onlineUrl, mediaType);

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedUrl]);

  if (resolvedUrl && !imgFailed) {
    return (
      <img
        src={resolvedUrl}
        alt={title}
        loading="lazy"
        decoding="async"
        onError={() => setImgFailed(true)}
        className={
          size === 'lg'
            ? 'w-full max-h-72 object-contain rounded-2xl bg-slate-950 border border-slate-800 mb-4'
            : 'w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300'
        }
      />
    );
  }

  const iconSize = size === 'lg' ? 'w-12 h-12' : 'w-6 h-6';
  const renderIcon = () => {
    switch (cat.key) {
      case 'youtube':
        return <Youtube className={`${iconSize} text-rose-400`} />;
      case 'gdrive':
        return <HardDrive className={`${iconSize} text-emerald-400`} />;
      case 'canva':
        return <Palette className={`${iconSize} text-cyan-400`} />;
      case 'pdf':
      case 'print':
        return <FileText className={`${iconSize} text-amber-400`} />;
      case 'tech':
        return <Globe className={`${iconSize} text-blue-400`} />;
      default:
        return <Layers className={`${iconSize} text-purple-400`} />;
    }
  };

  if (size === 'lg') {
    return (
      <div className="w-full h-44 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/40 border border-slate-800 mb-4 flex flex-col items-center justify-center gap-2">
        {renderIcon()}
        <span className="text-xs font-semibold text-slate-300">{cat.label}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 to-purple-950/50 flex flex-col items-center justify-center gap-0.5 p-1 text-center">
      {renderIcon()}
      <span className="text-[8px] font-semibold text-slate-300 leading-tight line-clamp-1">
        {cat.key === 'youtube' ? 'YouTube' : cat.key === 'gdrive' ? 'Drive' : cat.key === 'canva' ? 'Canva' : cat.key === 'pdf' ? 'PDF' : ''}
      </span>
    </div>
  );
};

export const TeacherMediaRepositoryModal: React.FC<TeacherMediaRepositoryModalProps> = ({
  userEmail,
  onClose,
}) => {
  const [rawMediaList, setRawMediaList] = useState<TeacherMediaWork[]>([]);
  const [sortOrder, setSortOrder] = useState<'newest' | 'shuffle'>('newest');
  const [shuffleSeed, setShuffleSeed] = useState<number>(() => getDailyRandomSeed());
  const [onlyMyPosts, setOnlyMyPosts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [activeViewItem, setActiveViewItem] = useState<TeacherMediaWork | null>(null);
  const [hoverRating, setHoverRating] = useState<{ [id: string]: number }>({});
  const [userVotedStars, setUserVotedStars] = useState<{ [id: string]: number }>({});
  const [voteSuccessMsg, setVoteSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<TeacherMediaWork | null>(null);
  const [isDeletingTarget, setIsDeletingTarget] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCooldownSec, setRefreshCooldownSec] = useState<number>(() =>
    getManualRefreshCooldownSeconds('teacherMedia')
  );

  // Edit item state
  const [editingItem, setEditingItem] = useState<TeacherMediaWork | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    onlineUrl: '',
    thumbnailUrl: '',
  });

  // Add new item state (Accessible to Admin and Teachers)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [addForm, setAddForm] = useState<{
    title: string;
    teacherName: string;
    subjectGroup: string;
    subjectName: string;
    mediaType: string;
    description: string;
    onlineUrl: string;
    thumbnailUrl: string;
  }>({
    title: '',
    teacherName: userEmail.toLowerCase() === 'weerapong1625@acu.ac.th' ? 'ม.วีระพงษ์ มีทรัพย์' : 'คุณครูอัสสัมชัญอุบลฯ',
    subjectGroup: String(SUBJECT_GROUPS[0] || 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี'),
    subjectName: '',
    mediaType: 'สื่อเทคโนโลยี',
    description: '',
    onlineUrl: '',
    thumbnailUrl: '',
  });

  const showSuccessFeedback = (msg: string, ms = 3000) => {
    setErrorMsg(null);
    setVoteSuccessMsg(msg);
    setTimeout(() => setVoteSuccessMsg((cur) => (cur === msg ? null : cur)), ms);
  };

  const showErrorFeedback = (msg: string, ms = 4000) => {
    setVoteSuccessMsg(null);
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg((cur) => (cur === msg ? null : cur)), ms);
  };

  // Current Thai Date string
  const todayThai = useMemo(
    () =>
      new Date().toLocaleDateString('th-TH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  // Subscribe once to teacher media works (0ms instant cached render + one-time fetch)
  useEffect(() => {
    const unsub = subscribeTeacherMedia((items) => {
      setRawMediaList(items);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (refreshCooldownSec <= 0) return;
    const timer = setInterval(() => {
      setRefreshCooldownSec(getManualRefreshCooldownSeconds('teacherMedia'));
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshCooldownSec]);

  const handleRefreshMedia = async () => {
    const remaining = getManualRefreshCooldownSeconds('teacherMedia');
    if (remaining > 0) {
      setRefreshCooldownSec(remaining);
      showSuccessFeedback(`กรุณารออีก ${remaining} วินาทีก่อนรีเฟรชอีกครั้ง`);
      return;
    }
    setIsRefreshing(true);
    try {
      await refreshTeacherMedia(true);
      setRefreshCooldownSec(getManualRefreshCooldownSeconds('teacherMedia') || 60);
      showSuccessFeedback('อัปเดตคลังสื่อล่าสุดเรียบร้อยแล้ว');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleViewMedia = (item: TeacherMediaWork, openDetailModal = false) => {
    const nextViews = (item.views || 0) + 1;
    const updatedItem: TeacherMediaWork = { ...item, views: nextViews };
    setRawMediaList((prev) => prev.map((m) => (m.id === item.id ? updatedItem : m)));
    if (openDetailModal) {
      setActiveViewItem(updatedItem);
    } else if (activeViewItem && activeViewItem.id === item.id) {
      setActiveViewItem(updatedItem);
    }
    incrementTeacherMediaViews(item.id).catch(() => {});
  };

  // Compute sorted/shuffled list in memory in 0ms without re-subscribing to Firestore
  const mediaList = useMemo(() => {
    if (sortOrder === 'shuffle') {
      return shuffleWithSeed(rawMediaList, shuffleSeed).slice(0, MAX_MEDIA_DISPLAY_LIMIT);
    }
    return rawMediaList.slice(0, MAX_MEDIA_DISPLAY_LIMIT);
  }, [rawMediaList, sortOrder, shuffleSeed]);

  const handleStartEdit = (item: TeacherMediaWork) => {
    setEditingItem(item);
    setEditForm({
      title: item.title,
      description: item.description,
      onlineUrl: item.onlineUrl || '',
      thumbnailUrl: sanitizeMediaThumbnailForFirestore(item.thumbnailUrl, item.onlineUrl),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    if (isDataOrBlobUri(editForm.thumbnailUrl)) {
      showErrorFeedback('ไม่รองรับลิงก์ภาพ Base64 (data:) เพื่อประหยัดพื้นที่ กรุณาใช้ลิงก์ https:// หรือเว้นว่างให้ระบบดึงปกอัตโนมัติ');
      return;
    }
    const cleanThumb = sanitizeMediaThumbnailForFirestore(editForm.thumbnailUrl, editForm.onlineUrl.trim());
    const updates = {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      onlineUrl: editForm.onlineUrl.trim(),
      thumbnailUrl: cleanThumb,
    };

    const res = await updateTeacherMedia(editingItem.id, updates, userEmail);

    if (res.success) {
      showSuccessFeedback(`บันทึกการแก้ไขสื่อ "${editForm.title}" สำเร็จ`);
      setEditingItem(null);
      setRawMediaList(prev => prev.map(m => m.id === editingItem.id ? { ...m, ...updates } : m));
    } else {
      showErrorFeedback(res.error || 'แก้ไขข้อมูลไม่สำเร็จ');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteTarget) return;
    const item = confirmDeleteTarget;
    setIsDeletingTarget(true);
    const res = await deleteTeacherMedia(item.id, userEmail);
    setIsDeletingTarget(false);
    if (res.success) {
      setConfirmDeleteTarget(null);
      setRawMediaList(prev => prev.filter(m => m.id !== item.id));
      if (activeViewItem && activeViewItem.id === item.id) {
        setActiveViewItem(null);
      }
      showSuccessFeedback(`ลบสื่อ "${item.title}" เรียบร้อยแล้ว`);
    } else {
      setConfirmDeleteTarget(null);
      showErrorFeedback(res.error || 'ลบข้อมูลไม่สำเร็จ');
    }
  };

  const handleSaveNewMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.title.trim()) {
      showErrorFeedback('กรุณากรอกชื่อสื่อ/นวัตกรรม');
      return;
    }
    if (!addForm.teacherName.trim()) {
      showErrorFeedback('กรุณากรอกชื่อครูผู้จัดทำ');
      return;
    }
    if (isDataOrBlobUri(addForm.thumbnailUrl)) {
      showErrorFeedback('ไม่รองรับภาพ Base64 เพื่อประหยัดพื้นที่ฐานข้อมูล กรุณาใช้ลิงก์ https:// หรือปล่อยว่าง');
      return;
    }

    const cleanThumb = sanitizeMediaThumbnailForFirestore(addForm.thumbnailUrl, addForm.onlineUrl.trim());

    setIsSubmittingNew(true);
    const res = await addTeacherMediaDirectly({
      title: addForm.title.trim(),
      teacherName: addForm.teacherName.trim(),
      subjectGroup: addForm.subjectGroup,
      subjectName: addForm.subjectName.trim() || 'สื่อนวัตกรรมการจัดการเรียนรู้',
      mediaType: addForm.mediaType,
      description: addForm.description.trim() || `สื่อการสอนวิชา ${addForm.subjectGroup}`,
      thumbnailUrl: cleanThumb,
      onlineUrl: addForm.onlineUrl.trim(),
      submittedByEmail: userEmail,
    });
    setIsSubmittingNew(false);

    if (res.success) {
      const savedTitle = addForm.title;
      setIsAddModalOpen(false);
      setSortOrder('newest');
      setAddForm({
        title: '',
        teacherName: userEmail.toLowerCase() === 'weerapong1625@acu.ac.th' ? 'ม.วีระพงษ์ มีทรัพย์' : 'คุณครูอัสสัมชัญอุบลฯ',
        subjectGroup: SUBJECT_GROUPS[0] || 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
        subjectName: '',
        mediaType: 'สื่อเทคโนโลยี',
        description: '',
        onlineUrl: '',
        thumbnailUrl: '',
      });
      showSuccessFeedback(`เพิ่มสื่อ "${savedTitle}" เข้าสู่คลังเรียบร้อยแล้ว`, 3500);
    } else {
      showErrorFeedback(res.error || 'เพิ่มข้อมูลสื่อไม่สำเร็จ');
    }
  };

  // Filter items (memoized)
  const filteredList = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const normUser = userEmail.toLowerCase().trim();
    const emailPrefix = normUser.split('@')[0];
    return mediaList.filter((item) => {
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.teacherName.toLowerCase().includes(q) ||
        item.subjectName.toLowerCase().includes(q) ||
        (item.gradeLevel && item.gradeLevel.toLowerCase().includes(q));
      const matchesGroup = selectedGroup === 'all' || item.subjectGroup === selectedGroup;
      const matchesMyPosts =
        !onlyMyPosts ||
        (item.submittedByEmail
          ? item.submittedByEmail.toLowerCase().trim() === normUser
          : item.teacherName.toLowerCase().includes(emailPrefix));
      return matchesSearch && matchesGroup && matchesMyPosts;
    });
  }, [mediaList, searchTerm, selectedGroup, onlyMyPosts, userEmail]);

  // Handle star rating click
  const handleRate = async (item: TeacherMediaWork, stars: number) => {
    setUserVotedStars(prev => ({ ...prev, [item.id]: stars }));
    showSuccessFeedback(`ให้คะแนน ${stars} ดาวแก่สื่อ "${item.title}" เรียบร้อยแล้ว`, 2500);

    await rateTeacherMedia(item.id, stars, userEmail);

    setRawMediaList(prev =>
      prev.map(m => {
        if (m.id === item.id) {
          const currentTotal = m.ratingAvg * m.ratingCount;
          const newCount = m.ratingCount + 1;
          const newAvg = Number(((currentTotal + stars) / newCount).toFixed(1));
          return { ...m, ratingAvg: newAvg, ratingCount: newCount };
        }
        return m;
      })
    );
  };

  // Handle like toggle (Appreciation points for teacher)
  const handleToggleLike = async (item: TeacherMediaWork) => {
    const res = await toggleLikeTeacherMedia(item.id, userEmail);
    if (res.success) {
      const normEmail = userEmail.toLowerCase().trim();
      const updateLikes = (list: TeacherMediaWork[]) =>
        list.map((m) => {
          if (m.id === item.id) {
            const prevLikedBy = Array.isArray(m.likedBy) ? m.likedBy : [];
            const newLikedBy = res.isLiked
              ? [...prevLikedBy.filter((e) => e !== normEmail), normEmail]
              : prevLikedBy.filter((e) => e !== normEmail);
            return {
              ...m,
              likes: res.likes,
              likedBy: newLikedBy,
            };
          }
          return m;
        });

      setRawMediaList((prev) => updateLikes(prev));

      if (activeViewItem && activeViewItem.id === item.id) {
        setActiveViewItem((prev) =>
          prev
            ? {
                ...prev,
                likes: res.likes,
                likedBy: res.isLiked
                  ? [...(prev.likedBy || []).filter((e) => e !== normEmail), normEmail]
                  : (prev.likedBy || []).filter((e) => e !== normEmail),
              }
            : null
        );
      }

      if (res.isLiked) {
        showSuccessFeedback(`กดถูกใจสื่อ "${item.title}" สะสมแต้มชื่นชม +1 ให้คุณครู ${item.teacherName} สำเร็จ!`);
      } else {
        showSuccessFeedback(`ยกเลิกการถูกใจสื่อ "${item.title}"`);
      }
    }
  };

  // Re-shuffle / randomize items in memory in 0ms
  const handleShuffle = () => {
    if (rawMediaList.length === 0) return;
    const randomSeed = Math.floor(Math.random() * 1000000) + 1;
    setShuffleSeed(randomSeed);
    setSortOrder('shuffle');
    const count = Math.min(rawMediaList.length, MAX_MEDIA_DISPLAY_LIMIT);
    showSuccessFeedback(`สุ่มแสดงผลสื่อชุดใหม่เรียบร้อยแล้ว (${count} รายการ จากทั้งหมด ${rawMediaList.length} รายการ)`, 2500);
  };

  const handleShowNewest = () => {
    setSortOrder('newest');
    showSuccessFeedback('แสดงผลสื่อเรียงตามล่าสุด (ส่งสื่อนวัตกรรมใหม่แสดงผลทันทีด้านบนสุด)', 2500);
  };

  return (
    <div
      id="modal-teacher-media-repo"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl bg-slate-900 border border-purple-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-900/80 via-indigo-900/60 to-slate-900 border-b border-purple-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 flex-shrink-0">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  3. คลังสื่อคุณครูผลิตเอง
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 font-medium ${
                  sortOrder === 'newest'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                }`}>
                  {sortOrder === 'newest' ? (
                    <>
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>แสดงสื่อล่าสุดทันที ({rawMediaList.length} รายการ)</span>
                    </>
                  ) : (
                    <>
                      <Shuffle className="w-3 h-3 text-purple-400" />
                      <span>สุ่มแสดงผลประจำวัน</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 flex-wrap mt-0.5">
                <span>รวบรวมสื่อคุณครู ACU คุณครูส่งปุ๊บแสดงผลทันที พร้อมให้คะแนนดาวและกดเข้าชม</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-medium">
                  <Calendar className="w-3 h-3" />
                  {todayThai}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              title="เพิ่มสื่อการสอนเข้าสู่คลังสื่อ"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มสื่อเข้าคลัง</span>
            </button>

            <button
              type="button"
              onClick={handleShuffle}
              className={`px-3 py-1.5 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer ${
                sortOrder === 'shuffle'
                  ? 'bg-purple-600 ring-2 ring-purple-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title="สุ่มลำดับสื่อชุดใหม่ (สูงสุด 100 รายการ)"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">สุ่มสื่อชุดใหม่</span>
            </button>

            <button
              type="button"
              onClick={handleRefreshMedia}
              disabled={isRefreshing || refreshCooldownSec > 0}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title={refreshCooldownSec > 0 ? `รอรีเฟรชได้อีกครั้งใน ${refreshCooldownSec} วินาที` : 'รีเฟรชข้อมูลคลังสื่อล่าสุด'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {refreshCooldownSec > 0 ? `รีเฟรช (${refreshCooldownSec}s)` : 'รีเฟรช'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-950/60 border-b border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาชื่อสื่อ, ครูผู้จัดทำ, วิชา..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 outline-none cursor-pointer focus:border-purple-500"
              >
                <option value="all">ทุกกลุ่มสาระการเรียนรู้</option>
                {SUBJECT_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort Toggle */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={handleShowNewest}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  sortOrder === 'newest'
                    ? 'bg-purple-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>ล่าสุด</span>
              </button>
              <button
                type="button"
                onClick={handleShuffle}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  sortOrder === 'shuffle'
                    ? 'bg-purple-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>สุ่มสลับ</span>
              </button>
            </div>

            {/* My Submissions Filter */}
            <button
              type="button"
              onClick={() => setOnlyMyPosts(!onlyMyPosts)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                onlyMyPosts
                  ? 'bg-indigo-600/30 border-indigo-400 text-indigo-300 shadow-sm'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="แสดงเฉพาะสื่อที่คุณครูเป็นผู้ส่ง"
            >
              <User className="w-3.5 h-3.5" />
              <span>ผลงานของฉัน</span>
            </button>
          </div>
        </div>

        {/* Feedback Toasts */}
        {voteSuccessMsg && (
          <div className="bg-emerald-600/90 text-white text-xs py-2 px-4 text-center font-medium shadow-md transition-all">
            {voteSuccessMsg}
          </div>
        )}
        {errorMsg && (
          <div className="bg-rose-600/90 text-white text-xs py-2 px-4 text-center font-medium shadow-md transition-all">
            {errorMsg}
          </div>
        )}

        {/* Media Works Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredList.map((item) => {
              const currentHover = hoverRating[item.id] || 0;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-purple-500/60 p-4 transition-all hover:shadow-xl hover:shadow-purple-500/10 flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Thumbnail + Meta */}
                    <div className="flex items-start gap-3 mb-3">
                      {/* Small thumbnail preview or crisp category icon */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 flex-shrink-0 relative group/thumb">
                        <MediaThumbnailOrIcon
                          thumbnailUrl={item.thumbnailUrl}
                          onlineUrl={item.onlineUrl}
                          mediaType={item.mediaType}
                          title={item.title}
                          size="sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleViewMedia(item, true)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                          title="ดูรายละเอียด"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                            {item.mediaType}
                          </span>
                          {item.itemNumber && (
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-700 text-slate-300 text-[10px]">
                              ชิ้นที่ {item.itemNumber}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-purple-300 transition-colors">
                          {item.title}
                        </h4>
                      </div>
                    </div>

                    {/* Teacher & Subject Info */}
                    <div className="space-y-1 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 mb-3">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        <span className="font-semibold text-white truncate">
                          {item.teacherName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{item.gradeLevel || item.subjectGroup}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <BookOpen className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{item.subjectName}</span>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mb-3">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Rating & Actions Bottom */}
                  <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2 flex-wrap">
                    {/* 5-Star interactive rating & Like button */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const isFilled = (currentHover || item.ratingAvg) >= star;
                          return (
                            <button
                              key={star}
                              type="button"
                              onMouseEnter={() => setHoverRating(prev => ({ ...prev, [item.id]: star }))}
                              onMouseLeave={() => setHoverRating(prev => ({ ...prev, [item.id]: 0 }))}
                              onClick={() => handleRate(item, star)}
                              className="text-slate-600 hover:text-amber-400 focus:outline-none transition-colors"
                              title={`ให้คะแนน ${star} ดาว`}
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  isFilled
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-slate-600'
                                }`}
                              />
                            </button>
                          );
                        })}
                        <span className="text-[11px] text-amber-400 font-bold ml-1">
                          {item.ratingAvg.toFixed(1)}
                        </span>
                      </div>

                      {/* Like / ชื่นชม Button (สะสมแต้มให้คุณครูผู้โพสต์) */}
                      <button
                        type="button"
                        onClick={() => handleToggleLike(item)}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          item.likedBy?.includes(userEmail.toLowerCase().trim())
                            ? 'bg-rose-500/25 border border-rose-500/60 text-rose-300 shadow-sm shadow-rose-500/20'
                            : 'bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-rose-400'
                        }`}
                        title={
                          item.likedBy?.includes(userEmail.toLowerCase().trim())
                            ? 'คุณกดถูกใจแล้ว (คลิกเพื่อยกเลิก)'
                            : `กดถูกใจสื่อนี้ เพื่อมอบแต้มสะสมชื่นชมให้คุณครู ${item.teacherName} (+1 แต้ม)`
                        }
                      >
                        <Heart
                          className={`w-3.5 h-3.5 transition-transform ${
                            item.likedBy?.includes(userEmail.toLowerCase().trim())
                              ? 'text-rose-400 fill-rose-400 scale-110'
                              : 'text-slate-400'
                          }`}
                        />
                        <span>{item.likes || 0}</span>
                      </button>
                    </div>

                    {/* View Media & Management Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {canUserModify(item.submittedByEmail, userEmail) && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors"
                            title="แก้ไขข้อมูลสื่อ"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTarget(item)}
                            className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                            title="ลบสื่อนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-700/70 text-[11px] text-sky-300 font-semibold"
                        title="ยอดการเข้าชมสื่อนี้"
                      >
                        <Eye className="w-3 h-3 text-sky-400" />
                        <span>{item.views || 0}</span>
                      </span>

                      {item.onlineUrl ? (
                        <a
                          href={item.onlineUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleViewMedia(item, false)}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>กดชม</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleViewMedia(item, true)}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>กดชม</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredList.length === 0 && (
            <div className="py-16 text-center text-slate-400">
              <FolderArchive className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-sm">ไม่พบสื่อที่ตรงกับเงื่อนไขการค้นหา</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 px-6 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span>แสดงสื่อในคลัง: <strong className="text-purple-300">{filteredList.length}</strong> รายการ</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">สุ่มแสดงผลอัตโนมัติประจำวัน (ไม่เกิน {MAX_MEDIA_DISPLAY_LIMIT} สื่อ จากทั้งหมด {rawMediaList.length} รายการ)</span>
          </div>
          <span>เฉพาะเจ้าของผลงาน หรือ Admin เท่านั้นที่แก้ไข/ลบได้</span>
        </div>
      </div>

      {/* Edit Media Modal */}
      {editingItem && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setEditingItem(null)}
        >
          <div
            className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl p-6 text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h4 className="text-base font-bold text-white">แก้ไขข้อมูลสื่อในคลัง</h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">ชื่อสื่อ / นวัตกรรมการสอน</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">รายละเอียด / การนำไปใช้</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">ลิงก์เปิดดูสื่อออนไลน์ (URL)</label>
                <input
                  type="url"
                  value={editForm.onlineUrl}
                  onChange={(e) => setEditForm(prev => ({ ...prev, onlineUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">URL รูปภาพตัวอย่างสื่อภายนอก (ไม่บังคับ — ระบบดึงปก YouTube หรือแสดงไอคอนอัตโนมัติ)</label>
                <input
                  type="url"
                  value={editForm.thumbnailUrl}
                  onChange={(e) => setEditForm(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
                  placeholder="https://... (เว้นว่างไว้หากใช้ปก YouTube หรือไอคอนหมวดหมู่)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-500/20"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Detail Modal */}
      {activeViewItem && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveViewItem(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-slate-900 border border-purple-500/40 rounded-3xl shadow-2xl overflow-hidden p-6 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-4 border-b border-slate-800 gap-3">
              <div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                  {activeViewItem.mediaType}
                </span>
                <h3 className="text-lg font-bold mt-2">{activeViewItem.title}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  ผู้จัดทำ: {activeViewItem.teacherName} | {activeViewItem.subjectGroup}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveViewItem(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4">
              <MediaThumbnailOrIcon
                thumbnailUrl={activeViewItem.thumbnailUrl}
                onlineUrl={activeViewItem.onlineUrl}
                mediaType={activeViewItem.mediaType}
                title={activeViewItem.title}
                size="lg"
              />

              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 text-xs space-y-2">
                <div>
                  <strong className="text-purple-300">วิชา/หน่วยการเรียนรู้: </strong>
                  <span>{activeViewItem.subjectName}</span>
                </div>
                {activeViewItem.description && (
                  <div>
                    <strong className="text-purple-300">รายละเอียด: </strong>
                    <span>{activeViewItem.description}</span>
                  </div>
                )}
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <strong className="text-purple-300">คะแนนเฉลี่ย: </strong>
                    <span>⭐ {activeViewItem.ratingAvg} / 5 ({activeViewItem.ratingCount} รีวิว)</span>
                  </div>
                  <div>
                    <strong className="text-sky-300">ยอดเข้าชม: </strong>
                    <span>👁️ {activeViewItem.views || 0} ครั้ง</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                เข้าสู่ระบบด้วย: {userEmail}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {canUserModify(activeViewItem.submittedByEmail, userEmail) && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteTarget(activeViewItem)}
                    className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="ลบสื่อนี้"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ลบสื่อนี้</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleToggleLike(activeViewItem)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeViewItem.likedBy?.includes(userEmail.toLowerCase().trim())
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title="กดถูกใจเพื่อสะสมแต้มชื่นชมให้คุณครู"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      activeViewItem.likedBy?.includes(userEmail.toLowerCase().trim())
                        ? 'fill-white text-white'
                        : 'text-rose-400'
                    }`}
                  />
                  <span>ถูกใจ ({activeViewItem.likes || 0})</span>
                </button>

                {activeViewItem.onlineUrl && (
                  <a
                    href={activeViewItem.onlineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleViewMedia(activeViewItem, false)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>เปิดดูสื่อฉบับเต็ม</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setActiveViewItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Media Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/50 rounded-3xl shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Plus className="w-4 h-4" />
                </div>
                <h4 className="text-base font-bold text-white">เพิ่มสื่อ/นวัตกรรมใหม่เข้าสู่คลัง</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewMedia} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  ชื่อผลงานสื่อ / นวัตกรรม <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  placeholder="เช่น สื่อมัลติมีเดียการจำลองระบบสุริยะ..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    ชื่อครูผู้จัดทำ <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.teacherName}
                    onChange={(e) => setAddForm({ ...addForm, teacherName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    ประเภทสื่อ
                  </label>
                  <select
                    value={addForm.mediaType}
                    onChange={(e) => setAddForm({ ...addForm, mediaType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="สื่อเทคโนโลยี">สื่อเทคโนโลยี (Digital / Video / App)</option>
                    <option value="สื่อสิ่งพิมพ์">สื่อสิ่งพิมพ์ (ใบงาน / แบบฝึก / บอร์ด)</option>
                    <option value="สื่ออื่น ๆ">สื่ออื่น ๆ / นวัตกรรมบูรณาการ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  กลุ่มสาระการเรียนรู้
                </label>
                <select
                  value={addForm.subjectGroup}
                  onChange={(e) => setAddForm({ ...addForm, subjectGroup: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-hidden focus:border-emerald-500"
                >
                  {SUBJECT_GROUPS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  วิชา / หน่วยการเรียนรู้
                </label>
                <input
                  type="text"
                  value={addForm.subjectName}
                  onChange={(e) => setAddForm({ ...addForm, subjectName: e.target.value })}
                  placeholder="เช่น วิทยาศาสตร์ ว21101 หน่วยที่ 2"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  รายละเอียด / คำอธิบายการนำไปใช้
                </label>
                <textarea
                  rows={2}
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  placeholder="อธิบายการนำสื่อไปประยุกต์ใช้ในการจัดการเรียนรู้..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-hidden focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  ลิงก์ไฟล์งานออนไลน์ / Google Drive / Canva / YouTube
                </label>
                <input
                  type="url"
                  value={addForm.onlineUrl}
                  onChange={(e) => setAddForm({ ...addForm, onlineUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmittingNew ? 'กำลังบันทึก...' : 'บันทึกเข้าสู่คลังสื่อ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Delete Confirmation Modal */}
      {confirmDeleteTarget && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => !isDeletingTarget && setConfirmDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-rose-500/50 rounded-3xl shadow-2xl p-6 text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">ยืนยันการลบสื่อออกจากคลัง</h4>
                <p className="text-xs text-slate-400">"{confirmDeleteTarget.title}"</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              คุณต้องการลบสื่อรายการนี้ออกจากคลังสื่อคุณครูผลิตเองใช่หรือไม่?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeletingTarget}
                onClick={() => setConfirmDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeletingTarget}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {isDeletingTarget ? 'กำลังลบ...' : 'ยืนยันการลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
