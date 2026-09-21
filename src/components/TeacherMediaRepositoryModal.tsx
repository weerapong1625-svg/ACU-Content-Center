import React, { useState, useEffect } from 'react';
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
  Calendar
} from 'lucide-react';
import { 
  TeacherMediaWork, 
  subscribeTeacherMedia, 
  rateTeacherMedia, 
  updateTeacherMedia,
  deleteTeacherMedia,
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

export const TeacherMediaRepositoryModal: React.FC<TeacherMediaRepositoryModalProps> = ({
  userEmail,
  onClose,
}) => {
  const [rawMediaList, setRawMediaList] = useState<TeacherMediaWork[]>([]);
  const [mediaList, setMediaList] = useState<TeacherMediaWork[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [activeViewItem, setActiveViewItem] = useState<TeacherMediaWork | null>(null);
  const [hoverRating, setHoverRating] = useState<{ [id: string]: number }>({});
  const [userVotedStars, setUserVotedStars] = useState<{ [id: string]: number }>({});
  const [voteSuccessMsg, setVoteSuccessMsg] = useState<string | null>(null);

  // Edit item state
  const [editingItem, setEditingItem] = useState<TeacherMediaWork | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    onlineUrl: '',
    thumbnailUrl: '',
  });

  // Current Thai Date string
  const todayThai = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Subscribe to teacher media works, shuffle with daily seed and limit to max 100
  useEffect(() => {
    const unsub = subscribeTeacherMedia((items) => {
      setRawMediaList(items);
      const seed = getDailyRandomSeed();
      const dailyShuffled = shuffleWithSeed(items, seed).slice(0, MAX_MEDIA_DISPLAY_LIMIT);
      setMediaList(dailyShuffled);
    });
    return () => unsub();
  }, []);

  const handleStartEdit = (item: TeacherMediaWork) => {
    setEditingItem(item);
    setEditForm({
      title: item.title,
      description: item.description,
      onlineUrl: item.onlineUrl || '',
      thumbnailUrl: item.thumbnailUrl,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    const updates = {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      onlineUrl: editForm.onlineUrl.trim(),
      thumbnailUrl: editForm.thumbnailUrl.trim() || editingItem.thumbnailUrl,
    };

    const res = await updateTeacherMedia(editingItem.id, updates, userEmail);

    if (res.success) {
      setVoteSuccessMsg(`บันทึกการแก้ไขสื่อ "${editForm.title}" สำเร็จ`);
      setEditingItem(null);
      setMediaList(prev => prev.map(m => m.id === editingItem.id ? { ...m, ...updates } : m));
      setRawMediaList(prev => prev.map(m => m.id === editingItem.id ? { ...m, ...updates } : m));
      setTimeout(() => setVoteSuccessMsg(null), 3000);
    } else {
      alert(res.error || 'แก้ไขข้อมูลไม่สำเร็จ');
    }
  };

  const handleDelete = async (item: TeacherMediaWork) => {
    if (!window.confirm(`คุณต้องการลบสื่อ "${item.title}" ออกจากคลังสื่อใช่หรือไม่?`)) {
      return;
    }
    const res = await deleteTeacherMedia(item.id, userEmail);
    if (res.success) {
      setVoteSuccessMsg(`ลบสื่อ "${item.title}" เรียบร้อยแล้ว`);
      setMediaList(prev => prev.filter(m => m.id !== item.id));
      setRawMediaList(prev => prev.filter(m => m.id !== item.id));
      setTimeout(() => setVoteSuccessMsg(null), 3000);
    } else {
      alert(res.error || 'ลบข้อมูลไม่สำเร็จ');
    }
  };

  // Filter items
  const filteredList = mediaList.filter((item) => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.gradeLevel && item.gradeLevel.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesGroup = selectedGroup === 'all' || item.subjectGroup === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  // Handle star rating click
  const handleRate = async (item: TeacherMediaWork, stars: number) => {
    setUserVotedStars(prev => ({ ...prev, [item.id]: stars }));
    setVoteSuccessMsg(`ให้คะแนน ${stars} ดาวแก่สื่อ "${item.title}" เรียบร้อยแล้ว`);

    // Update in Firestore
    await rateTeacherMedia(item.id, stars, userEmail);

    // Update local state smoothly
    const updateList = (list: TeacherMediaWork[]) => list.map(m => {
      if (m.id === item.id) {
        const currentTotal = m.ratingAvg * m.ratingCount;
        const newCount = m.ratingCount + 1;
        const newAvg = Number(((currentTotal + stars) / newCount).toFixed(1));
        return {
          ...m,
          ratingAvg: newAvg,
          ratingCount: newCount,
        };
      }
      return m;
    });

    setMediaList(prev => updateList(prev));
    setRawMediaList(prev => updateList(prev));

    setTimeout(() => {
      setVoteSuccessMsg(null);
    }, 2500);
  };

  // Re-shuffle / randomize items on demand (up to 100 items)
  const handleShuffle = () => {
    if (rawMediaList.length === 0) return;
    const randomSeed = Math.floor(Math.random() * 1000000) + 1;
    const shuffled = shuffleWithSeed(rawMediaList, randomSeed).slice(0, MAX_MEDIA_DISPLAY_LIMIT);
    setMediaList(shuffled);
    setVoteSuccessMsg(`สุ่มแสดงผลสื่อชุดใหม่เรียบร้อยแล้ว (${shuffled.length} รายการ จากทั้งหมด ${rawMediaList.length} รายการ)`);
    setTimeout(() => setVoteSuccessMsg(null), 2500);
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
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 flex items-center gap-1 font-medium">
                  <Shuffle className="w-3 h-3 text-purple-400" />
                  สุ่มแสดงผลทุกวัน (สูงสุด 100 สื่อ)
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 flex-wrap mt-0.5">
                <span>รวบรวมสื่อคุณครู ACU สุ่มสลับผลงานแสดงไม่เกิน 100 รายการทุกวัน พร้อมให้คะแนนดาวและกดเข้าชม</span>
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
              onClick={handleShuffle}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="สุ่มลำดับสื่อชุดใหม่ (สูงสุด 100 รายการ)"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">สุ่มสื่อชุดใหม่</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อสื่อ, คุณครูผู้จัดทำ, วิชา..."
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

        {/* Vote Success Toast */}
        {voteSuccessMsg && (
          <div className="bg-emerald-600/90 text-white text-xs py-2 px-4 text-center font-medium shadow-md transition-all">
            {voteSuccessMsg}
          </div>
        )}

        {/* Media Works Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredList.map((item) => {
              const currentHover = hoverRating[item.id] || 0;
              const voted = userVotedStars[item.id];
              return (
                <div
                  key={item.id}
                  className="rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-purple-500/60 p-4 transition-all hover:shadow-xl hover:shadow-purple-500/10 flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Thumbnail + Meta */}
                    <div className="flex items-start gap-3 mb-3">
                      {/* Small thumbnail preview */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 flex-shrink-0 relative group/thumb">
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/ACU N.png';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setActiveViewItem(item)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                          title="ดูภาพขยาย"
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
                  <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                    {/* 5-Star interactive rating */}
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
                            onClick={() => handleDelete(item)}
                            className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors"
                            title="ลบสื่อนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (item.onlineUrl) {
                            window.open(item.onlineUrl, '_blank');
                          } else {
                            setActiveViewItem(item);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>กดชม</span>
                      </button>
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
                <label className="block text-slate-300 mb-1 font-semibold">URL รูปภาพตัวอย่างสื่อ</label>
                <input
                  type="text"
                  value={editForm.thumbnailUrl}
                  onChange={(e) => setEditForm(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
                  placeholder="https://..."
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
              <img
                src={activeViewItem.thumbnailUrl}
                alt={activeViewItem.title}
                className="w-full max-h-72 object-contain rounded-2xl bg-slate-950 border border-slate-800 mb-4"
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
                <div>
                  <strong className="text-purple-300">คะแนนเฉลี่ย: </strong>
                  <span>⭐ {activeViewItem.ratingAvg} / 5 ({activeViewItem.ratingCount} รีวิว)</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                เข้าสู่ระบบด้วย: {userEmail}
              </span>
              <div className="flex items-center gap-2">
                {activeViewItem.onlineUrl && (
                  <a
                    href={activeViewItem.onlineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
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
    </div>
  );
};
