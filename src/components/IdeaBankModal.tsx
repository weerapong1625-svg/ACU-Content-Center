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
  BookOpen, 
  GraduationCap, 
  FileText, 
  Users, 
  Library, 
  Award, 
  ShieldCheck,
  Gift
} from 'lucide-react';
import { IDEA_RESOURCES, IDEA_CATEGORIES, IdeaResource } from '../data/ideaResources';
import { SpecialPrivilegesModal } from './SpecialPrivilegesModal';
import { 
  subscribeSharedIdeas, 
  saveSharedIdea, 
  updateSharedIdea, 
  deleteSharedIdea, 
  canUserModify,
  SharedIdeaItem
} from '../services/submissionService';

interface IdeaBankModalProps {
  userEmail?: string;
  onClose: () => void;
}

type AvailableCategory = 'official_portal' | 'manual_guide' | 'research' | 'exams' | 'facebook';

export const IdeaBankModal: React.FC<IdeaBankModalProps> = ({ userEmail = '', onClose }) => {
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [firestoreIdeas, setFirestoreIdeas] = useState<SharedIdeaItem[]>([]);
  const [isAddingIdea, setIsAddingIdea] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState<AvailableCategory>('official_portal');
  
  // Edit State
  const [editingIdea, setEditingIdea] = useState<SharedIdeaItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editCategory, setEditCategory] = useState<AvailableCategory>('official_portal');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [showPrivilegesModal, setShowPrivilegesModal] = useState<boolean>(false);

  // Subscribe to real-time shared ideas
  useEffect(() => {
    const unsubscribe = subscribeSharedIdeas((ideas) => {
      setFirestoreIdeas(ideas);
    });
    return () => unsubscribe();
  }, []);

  // Dynamic Thai Date for Daily Update Indicator
  const todayThai = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Convert Firestore ideas to IdeaResource format
  const firestoreIdeaResources: IdeaResource[] = firestoreIdeas.map((f) => ({
    id: f.id,
    category: f.category as any,
    categoryLabel: f.categoryLabel,
    title: f.title,
    description: f.description,
    url: f.url || '#',
    tags: f.tags || ['ไอเดียใหม่'],
    recommendedBadge: 'ไอเดียแบ่งปัน',
    featuredDaily: true,
  }));

  const allList = [...firestoreIdeaResources, ...IDEA_RESOURCES];

  // Core 6 official websites requested by user
  const coreOfficialWebsites = IDEA_RESOURCES.filter(item => item.isOfficialCore);

  const filtered = allList.filter((item) => {
    const matchesCat = 
      selectedCat === 'all' || 
      item.category === selectedCat ||
      (selectedCat === 'official_portal' && (item.category as string) === 'education') ||
      (selectedCat === 'manual_guide' && (item.category as string) === 'canva_ai');

    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCat && matchesSearch;
  });

  const handleAddCustomIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const catObj = IDEA_CATEGORIES.find(c => c.id === newCategory);
    const catLabel = catObj?.label.replace(/^[^\s]+\s*/, '') || 'คลังความรู้';

    const res = await saveSharedIdea({
      category: newCategory,
      categoryLabel: catLabel,
      title: newTitle.trim(),
      description: newDesc.trim() || 'ข้อมูลและแหล่งเรียนรู้แบ่งปันโดยคณะครู ACU',
      url: newUrl.trim().startsWith('http') ? newUrl.trim() : (newUrl.trim() ? `https://${newUrl.trim()}` : '#'),
      tags: ['คลังความรู้', 'แบ่งปันโดยครู'],
      creatorEmail: userEmail || 'anonymous',
      creatorName: userEmail ? userEmail.split('@')[0] : 'ครู ACU',
    });

    if (res.success) {
      setActionNotice('เพิ่มข้อมูลเข้าสู่คลังไอเดียเรียบร้อยแล้ว');
      setTimeout(() => setActionNotice(null), 3000);
      setNewTitle('');
      setNewDesc('');
      setNewUrl('');
      setIsAddingIdea(false);
    } else {
      alert(res.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleOpenEdit = (item: IdeaResource) => {
    const raw = firestoreIdeas.find(f => f.id === item.id);
    if (!raw) {
      alert('รายการนี้เป็นข้อมูลมาตรฐานของระบบ ไม่สามารถแก้ไขได้');
      return;
    }
    if (!canUserModify(raw.creatorEmail, userEmail)) {
      alert('เฉพาะผู้สร้างรายการนี้ หรือ Admin เท่านั้นที่สามารถแก้ไขได้');
      return;
    }
    setEditingIdea(raw);
    setEditTitle(raw.title);
    setEditDesc(raw.description);
    setEditUrl(raw.url || '');
    
    // Map legacy categories
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
    if (!editingIdea || !editTitle.trim()) return;

    const catObj = IDEA_CATEGORIES.find(c => c.id === editCategory);
    const catLabel = catObj?.label.replace(/^[^\s]+\s*/, '') || 'คลังความรู้';

    const res = await updateSharedIdea(
      editingIdea.id,
      {
        title: editTitle.trim(),
        description: editDesc.trim(),
        url: editUrl.trim().startsWith('http') ? editUrl.trim() : (editUrl.trim() ? `https://${editUrl.trim()}` : '#'),
        category: editCategory,
        categoryLabel: catLabel,
      },
      userEmail
    );

    if (res.success) {
      setActionNotice('แก้ไขข้อมูลเรียบร้อยแล้ว');
      setTimeout(() => setActionNotice(null), 3000);
      setEditingIdea(null);
    } else {
      alert(res.error || 'ไม่สามารถแก้ไขได้');
    }
  };

  const handleDeleteIdea = async (item: IdeaResource) => {
    const raw = firestoreIdeas.find(f => f.id === item.id);
    if (!raw) {
      alert('รายการนี้เป็นข้อมูลมาตรฐานของระบบ ไม่สามารถลบได้');
      return;
    }
    if (!canUserModify(raw.creatorEmail, userEmail)) {
      alert('เฉพาะผู้สร้างรายการนี้ หรือ Admin เท่านั้นที่สามารถลบได้');
      return;
    }
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "${item.title}"?`)) {
      return;
    }

    const res = await deleteSharedIdea(raw.id, userEmail);
    if (res.success) {
      setActionNotice('ลบรายการเรียบร้อยแล้ว');
      setTimeout(() => setActionNotice(null), 3000);
    } else {
      alert(res.error || 'ไม่สามารถลบข้อมูลได้');
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
      <div className="relative w-full max-w-5xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-950/80 via-yellow-900/60 to-slate-900 border-b border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 flex-shrink-0 shadow-inner">
              <Lightbulb className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  6. คลังไอเดียและคลังความรู้ทางการ (IDEA HUB)
                </h3>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 font-medium inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  อัปเดตทุกวัน
                </span>
              </div>
              <p className="text-xs text-amber-200/80 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                อัปเดตข้อมูล: {todayThai} • รวมเว็บไซต์หลักทางการ, คู่มือ AI ศธ., คลังวิจัย ThaiLIS/TCI, ข้อสอบ และเพจแชร์สื่อ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
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
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Special Privileges Activity Notice Banner */}
        <div className="mx-4 sm:mx-6 mt-3 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-purple-500/15 border border-amber-400/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2.5 text-slate-200">
            <span className="text-xl">🎁</span>
            <div>
              <span className="font-bold text-amber-300">สิทธิพิเศษสำหรับผู้เข้าใช้งานระบบ:</span>{' '}
              <span>เพียงแค่คุณครูโพสต์แชร์แหล่งการเรียนรู้ <strong>20 ครั้งขึ้นไป</strong> ลุ้นรับรางวัล 1.ตุ๊กตา 🧸 2.ขนม 🍪 3.ลูกอม 🍬 ติดต่อรับได้ที่ห้องพักครู Com ชั้น 3 (ม.วีระพงษ์)</span>
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
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 flex items-center justify-between text-emerald-300 text-xs font-semibold animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{actionNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="text-emerald-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Edit Modal Popup */}
        {editingIdea && (
          <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <form onSubmit={handleSaveEdit} className="w-full max-w-lg bg-slate-900 border border-amber-500/50 rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-400" />
                  <h4 className="text-sm font-bold text-white">แก้ไขข้อมูลแหล่งเรียนรู้ / ไอเดีย</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingIdea(null)}
                  className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
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
                    <option value="manual_guide">📖 คู่มือการใช้ AI & แนวทางการสอน</option>
                    <option value="research">📚 วิจัย วิทยานิพนธ์ & วารสาร</option>
                    <option value="exams">📝 คลังข้อสอบ & เกณฑ์ประเมิน</option>
                    <option value="facebook">👥 เพจเฟซบุ๊กแชร์สื่อ & ไอเดีย</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">ลิงก์ URL</label>
                  <input
                    type="text"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">คำอธิบายสรุป / ประโยชน์การใช้งาน</label>
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
                  onClick={() => setEditingIdea(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Add Idea Form Accordion */}
        {isAddingIdea && (
          <form onSubmit={handleAddCustomIdea} className="p-4 bg-slate-950/90 border-b border-amber-500/30 space-y-3 animate-in fade-in">
            <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              เพิ่มเว็บไซต์ คลังความรู้ หรือคู่มือเข้าสู่คลังไอเดีย
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="ชื่อเว็บไซต์ / เพจ / คู่มือ..."
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as AvailableCategory)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
              >
                <option value="official_portal">🏛️ คลังความรู้ & พอร์ทัลหลัก</option>
                <option value="manual_guide">📖 คู่มือการใช้ AI & แนวทางการสอน</option>
                <option value="research">📚 วิจัย วิทยานิพนธ์ & วารสาร</option>
                <option value="exams">📝 คลังข้อสอบ & เกณฑ์ประเมิน</option>
                <option value="facebook">👥 เพจเฟซบุ๊กแชร์สื่อ & ไอเดีย</option>
              </select>
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="ลิงก์ URL (เช่น https://...)"
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
              />
            </div>
            <textarea
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="คำอธิบายสรุปประโยชน์ หรือแนวทางการนำข้อมูลไปใช้..."
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingIdea(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
              >
                บันทึกลงคลังไอเดีย
              </button>
            </div>
          </form>
        )}

        {/* Pinned Section: 6 Official Core Sites & Manuals (Always featured & clearly visible) */}
        {selectedCat === 'all' && searchQuery.trim() === '' && (
          <div className="px-4 pt-3.5 pb-2 bg-gradient-to-b from-amber-950/30 to-transparent border-b border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-300 tracking-wide uppercase">
                  เว็บไซต์หลักทางการและคู่มือมาตรฐาน (6 แหล่งข้อมูลหลัก)
                </span>
              </div>
              <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                คัดสรรโดยกระทรวงฯ & หน่วยงานระดับชาติ
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {coreOfficialWebsites.map((core) => (
                <a
                  key={core.id}
                  href={core.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-amber-500/30 hover:border-amber-400/60 transition-all flex flex-col justify-between group shadow-sm hover:shadow-amber-500/15"
                >
                  <div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 line-clamp-1">
                      {core.recommendedBadge}
                    </span>
                    <h5 className="mt-1.5 text-xs font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-tight">
                      {core.title.split('(')[0].trim()}
                    </h5>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-amber-400/90 font-medium">
                    <span>เปิดเว็บไซต์</span>
                    <ExternalLink className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Search & Category Filter Tabs */}
        <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-col gap-3">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาคลังความรู้ SciMath, คู่มือ AI สพฐ., OBEC Content, สช., TDC ThaiLIS, TCI ThaiJO, เพจเฟซบุ๊ก..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-amber-500 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {IDEA_CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
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

        {/* Resource Cards Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-400 text-xs">
              <Lightbulb className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              ไม่พบข้อมูลที่ตรงกับคำค้นหา ลองเปลี่ยนคำค้นหรือเลือกหมวดหมู่อื่น
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl bg-slate-800/90 border p-4 transition-all duration-300 flex flex-col justify-between shadow-md group ${
                  item.isOfficialCore 
                    ? 'border-amber-500/50 hover:border-amber-400 shadow-amber-500/5 bg-gradient-to-b from-slate-800 to-slate-850' 
                    : 'border-slate-700/80 hover:border-amber-500/50 hover:shadow-amber-500/10'
                }`}
              >
                <div>
                  {/* Category & Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                      {item.categoryLabel}
                    </span>
                    {item.recommendedBadge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        item.isOfficialCore
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-xs'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {item.recommendedBadge}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h4 className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors leading-snug">
                    {item.title}
                  </h4>

                  {/* Description */}
                  <p className="mt-2 text-xs text-slate-300/90 leading-relaxed line-clamp-3">
                    {item.description}
                  </p>

                  {/* Tags */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900/90 text-slate-400 border border-slate-700/70"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="mt-4 pt-3 border-t border-slate-700/80 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    {(() => {
                      const raw = firestoreIdeas.find(f => f.id === item.id);
                      const canEdit = raw ? canUserModify(raw.creatorEmail, userEmail) : false;
                      
                      if (raw && canEdit) {
                        return (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors"
                              title="แก้ไขข้อมูล"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>แก้ไข</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteIdea(item)}
                              className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors"
                              title="ลบข้อมูล"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>ลบ</span>
                            </button>
                          </div>
                        );
                      }

                      return (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Bookmark className="w-3 h-3 text-amber-400" />
                          {raw ? 'ไอเดียครู ACU' : (item.isOfficialCore ? 'เว็บไซต์หลักทางการ' : 'แหล่งเรียนรู้แนะนำ')}
                        </span>
                      );
                    })()}
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <span>เปิดเว็บไซต์</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <span>คลังความรู้และไอเดียการจัดการเรียนรู้ • โรงเรียนอัสสัมชัญอุบลราชธานี</span>
          </div>
          <span className="text-amber-300/90 text-[11px]">แสดง {filtered.length} แหล่งข้อมูลทางการและเพจแบ่งปัน</span>
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
