import React, { useState, useEffect } from 'react';
import {
  X,
  Gift,
  Award,
  Sparkles,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  Share2,
  ExternalLink,
  ChevronRight,
  Send,
  AlertCircle,
  FolderArchive,
  BookOpen,
  School,
  Lightbulb,
  Check,
  Flame,
  PartyPopper
} from 'lucide-react';
import {
  subscribeUserPrivilegeStatus,
  submitTeacherRewardClaim,
  quickShareEducationalResource,
  UserPrivilegeStatus,
  REWARD_ITEMS,
  TARGET_SHARE_COUNT,
  PICKUP_LOCATION,
  ADMIN_CONTACT_NAME
} from '../services/privilegeService';

interface SpecialPrivilegesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  teacherName?: string;
  onOpenMediaUpload?: () => void;
  onOpenIdeaBank?: () => void;
}

export const SpecialPrivilegesModal: React.FC<SpecialPrivilegesModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  teacherName,
  onOpenMediaUpload,
  onOpenIdeaBank,
}) => {
  const [statusData, setStatusData] = useState<UserPrivilegeStatus | null>(null);
  const [selectedReward, setSelectedReward] = useState<string>('ตุ๊กตา');
  const [claimNote, setClaimNote] = useState<string>('');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState<boolean>(false);
  const [claimMessage, setClaimMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Quick Share Form state
  const [showQuickShareForm, setShowQuickShareForm] = useState<boolean>(false);
  const [quickTitle, setQuickTitle] = useState<string>('');
  const [quickUrl, setQuickUrl] = useState<string>('');
  const [quickCategory, setQuickCategory] = useState<string>('แหล่งเรียนรู้และสื่อการสอน');
  const [quickDesc, setQuickDesc] = useState<string>('');
  const [isSubmittingShare, setIsSubmittingShare] = useState<boolean>(false);
  const [quickShareSuccess, setQuickShareSuccess] = useState<string | null>(null);

  // Active tab: 'status' | 'rewards' | 'history' | 'quick_share'
  const [activeTab, setActiveTab] = useState<'status' | 'rewards' | 'history'>('status');

  // Real-time Firestore subscription to user privilege status
  useEffect(() => {
    if (!isOpen || !userEmail) return;
    const unsubscribe = subscribeUserPrivilegeStatus(userEmail, (status) => {
      setStatusData(status);
      if (status.claimRecord?.selectedReward) {
        setSelectedReward(status.claimRecord.selectedReward);
      }
    });
    return () => unsubscribe();
  }, [isOpen, userEmail]);

  if (!isOpen) return null;

  const totalShares = statusData?.totalShares || 0;
  const isEligible = totalShares >= TARGET_SHARE_COUNT;
  const progressPercent = Math.min(100, Math.round((totalShares / TARGET_SHARE_COUNT) * 100));
  const remaining = Math.max(0, TARGET_SHARE_COUNT - totalShares);
  const claimStatus = statusData?.claimStatus || 'not_eligible';

  // Handle Reward Claim Submission
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEligible) {
      setClaimMessage({
        type: 'error',
        text: `คุณยังแชร์แหล่งเรียนรู้ไม่ครบ ${TARGET_SHARE_COUNT} ครั้ง (ปัจจุบัน ${totalShares} ครั้ง ขาดอีก ${remaining} ครั้ง)`,
      });
      return;
    }

    setIsSubmittingClaim(true);
    setClaimMessage(null);

    const res = await submitTeacherRewardClaim({
      userEmail,
      teacherName: teacherName || statusData?.teacherName || userEmail,
      selectedReward,
      totalShares,
      note: claimNote,
    });

    setIsSubmittingClaim(false);
    if (res.success) {
      setClaimMessage({
        type: 'success',
        text: `🎉 ยืนยันสิทธิ์สำเร็จ! กรุณาติดต่อรับ "${selectedReward}" ได้ที่ ${PICKUP_LOCATION}`,
      });
    } else {
      setClaimMessage({
        type: 'error',
        text: res.error || 'เกิดข้อผิดพลาดในการส่งคำขอรับรางวัล',
      });
    }
  };

  // Handle Quick Share educational resource
  const handleQuickShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    setIsSubmittingShare(true);
    setQuickShareSuccess(null);

    const res = await quickShareEducationalResource({
      title: quickTitle,
      description: quickDesc,
      url: quickUrl,
      category: quickCategory,
      userEmail,
      teacherName: teacherName || statusData?.teacherName || userEmail,
    });

    setIsSubmittingShare(false);
    if (res.success) {
      setQuickShareSuccess('แชร์แหล่งการเรียนรู้เรียบร้อย! ระบบนับสถิติเพิ่ม +1 ครั้งทันที');
      setQuickTitle('');
      setQuickUrl('');
      setQuickDesc('');
      setTimeout(() => {
        setQuickShareSuccess(null);
        setShowQuickShareForm(false);
      }, 3000);
    } else {
      alert(res.error || 'เกิดข้อผิดพลาดในการแชร์');
    }
  };

  return (
    <div
      id="modal-special-privileges"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-['Prompt',sans-serif] select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-[0_20px_60px_rgba(245,158,11,0.25)] overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header with Festive Gold & Amber Theme */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 border-b border-amber-500/30 flex items-center justify-between overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-1/4 w-72 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 p-0.5 shadow-lg shadow-amber-500/20 flex-shrink-0 animate-pulse">
              <div className="w-full h-full rounded-[14px] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center text-white">
                <Gift className="w-6 h-6 text-amber-300" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-white">
                  สิทธิพิเศษ สำหรับผู้เข้าใช้งานระบบคลังสื่อนวัตกรรม
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[11px] font-bold flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3 h-3 text-amber-300 animate-spin" />
                  <span>กิจกรรมพิเศษประจำภาคเรียน</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                โรงเรียนอัสสัมชัญอุบลราชธานี • ห้องพักครู Com ชั้น 3 ({ADMIN_CONTACT_NAME})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="relative z-10 w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 transition-colors shadow-sm cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Condition Banner Box - Prominent and Clear */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-purple-500/15 border-b border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping flex-shrink-0" />
            <span>
              <strong className="text-amber-300 font-bold">เงื่อนไข:</strong> เพียงแค่คุณครูโพสต์แชร์แหล่งการเรียนรู้{' '}
              <strong className="text-white underline decoration-amber-400 decoration-2 font-black text-sm">20 ครั้งขึ้นไป</strong>{' '}
              ลุ้นรับรางวัลที่ <strong className="text-pink-300">1.ตุ๊กตา</strong>,{' '}
              <strong className="text-amber-300">2.ขนม</strong>,{' '}
              <strong className="text-purple-300">3.ลูกอม</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
            <div className="px-3 py-1 rounded-xl bg-slate-800/90 border border-amber-400/40 text-amber-200 font-medium flex items-center gap-1.5 shadow-sm">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>ติดต่อรับ: {PICKUP_LOCATION}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs inside modal */}
        <div className="px-5 pt-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2 rounded-t-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'status'
                ? 'bg-slate-800 text-amber-300 border-t-2 border-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>เช็คสถานะ & ขอรับรางวัล ({totalShares}/{TARGET_SHARE_COUNT})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rewards')}
            className={`px-4 py-2 rounded-t-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rewards'
                ? 'bg-slate-800 text-amber-300 border-t-2 border-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>ของรางวัลทั้ง 3 รายการ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-t-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-slate-800 text-amber-300 border-t-2 border-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>รายการที่แชร์แล้ว ({statusData?.posts?.length || 0} รายการ)</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-grow">
          
          {/* TAB 1: Status & Claim */}
          {activeTab === 'status' && (
            <div className="space-y-6">
              
              {/* Teacher Status Card */}
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-800/90 to-slate-900 border border-slate-700 shadow-xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                        บัญชีครูผู้สอน
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-semibold">
                        {userEmail}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                      {statusData?.teacherName || teacherName || userEmail.split('@')[0]}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      โรงเรียนอัสสัมชัญอุบลราชธานี • ระบบบันทึกและตรวจสอบสิทธิพิเศษอัตโนมัติ
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="flex flex-col items-start sm:items-end">
                    {claimStatus === 'received' ? (
                      <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50">
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>รับมอบรางวัลแล้ว: {statusData?.claimRecord?.receivedReward || 'รางวัลพิเศษ'}</span>
                      </div>
                    ) : claimStatus === 'pending_pickup' ? (
                      <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-950/50">
                        <Clock className="w-4 h-4 text-amber-200 animate-spin" />
                        <span>ยื่นขอรับแล้ว (รอติดต่อรับ)</span>
                      </div>
                    ) : isEligible ? (
                      <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-950/50 animate-bounce">
                        <PartyPopper className="w-4 h-4 text-yellow-300" />
                        <span>ผ่านเกณฑ์ 20 ครั้งแล้ว! มีสิทธิ์รับรางวัล</span>
                      </div>
                    ) : (
                      <div className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-2">
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        <span>กำลังสะสมผลงาน (ขาดอีก {remaining} ครั้ง)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar Section */}
                <div className="mt-6 pt-5 border-t border-slate-700/80">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <span>ความคืบหน้าการแชร์แหล่งเรียนรู้:</span>
                      <strong className="text-white text-sm font-black">{totalShares}</strong>
                      <span className="text-slate-400">/ {TARGET_SHARE_COUNT} ครั้ง</span>
                    </span>
                    <span className="font-extrabold text-amber-400 text-sm">
                      {progressPercent}%
                    </span>
                  </div>

                  {/* Visual Progress Track */}
                  <div className="relative w-full h-4 rounded-full bg-slate-950 border border-slate-700 overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${
                        isEligible
                          ? 'from-amber-400 via-orange-500 to-emerald-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
                          : 'from-blue-600 via-indigo-600 to-purple-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Milestone Markers */}
                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span className={totalShares >= 5 ? 'text-blue-300 font-bold' : ''}>5 ครั้ง</span>
                    <span className={totalShares >= 10 ? 'text-indigo-300 font-bold' : ''}>10 ครั้ง</span>
                    <span className={totalShares >= 15 ? 'text-purple-300 font-bold' : ''}>15 ครั้ง</span>
                    <span className={totalShares >= 20 ? 'text-amber-300 font-black flex items-center gap-0.5' : ''}>
                      🎯 20 ครั้ง (รับรางวัล!)
                    </span>
                  </div>
                </div>

                {/* Quick Share action button inside status card */}
                <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    นับรวมจาก: โพสต์แชร์ไอเดีย, สื่อนวัตกรรมการสอน 5 ชิ้น, บันทึกแหล่งเรียนรู้ 33 แห่ง และคลังสื่อครู
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQuickShareForm((prev) => !prev)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{showQuickShareForm ? 'ซ่อนแบบฟอร์มแชร์' : '+ โพสต์แชร์แหล่งเรียนรู้เพิ่ม'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Share Form Drawer (Toggled) */}
              {showQuickShareForm && (
                <form
                  onSubmit={handleQuickShare}
                  className="p-5 rounded-3xl bg-slate-800/90 border border-amber-500/40 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-3 duration-200"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>แบบฟอร์มแชร์แหล่งการเรียนรู้ (นับสถิติเพิ่มทันที)</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      เพิ่มยอดแชร์สะสมทันทีเมื่อกดบันทึก
                    </span>
                  </div>

                  {quickShareSuccess && (
                    <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-300" />
                      <span>{quickShareSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 mb-1 font-semibold">
                        ชื่อแหล่งการเรียนรู้ / หัวข้อสื่อที่ต้องการแชร์ <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น แหล่งเรียนรู้ดาราศาสตร์ สสวท. หรือ เทคนิคสร้างสื่อ AI ด้วย Canva"
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">
                        หมวดหมู่แหล่งเรียนรู้
                      </label>
                      <select
                        value={quickCategory}
                        onChange={(e) => setQuickCategory(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value="แหล่งเรียนรู้และสื่อการสอน">แหล่งเรียนรู้และสื่อการสอน</option>
                        <option value="เทคโนโลยีดิจิทัล & AI ทางการศึกษา">เทคโนโลยีดิจิทัล & AI ทางการศึกษา</option>
                        <option value="งานวิจัยในชั้นเรียน / PLC">งานวิจัยในชั้นเรียน / PLC</option>
                        <option value="คลังข้อสอบและแบบวัดผล">คลังข้อสอบและแบบวัดผล</option>
                        <option value="แหล่งเรียนรู้ภายนอก/ชุมชน">แหล่งเรียนรู้ภายนอก/ชุมชน</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">
                        URL แหล่งเรียนรู้ หรือเว็บไซต์อ้างอิง (ถ้ามี)
                      </label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={quickUrl}
                        onChange={(e) => setQuickUrl(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 mb-1 font-semibold">
                        คำอธิบาย / ประโยชน์ที่เพื่อนครูจะได้รับ
                      </label>
                      <textarea
                        rows={2}
                        placeholder="อธิบายสั้นๆ เกี่ยวกับแหล่งเรียนรู้นี้เพื่อเป็นประโยชน์ในการจัดการเรียนรู้..."
                        value={quickDesc}
                        onChange={(e) => setQuickDesc(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowQuickShareForm(false)}
                      className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingShare}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmittingShare ? 'กำลังแชร์...' : 'แชร์แหล่งเรียนรู้นี้ (+1 ครั้ง)'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Claim Reward Form (Active when >= 20 or already submitted) */}
              <div className="p-5 sm:p-6 rounded-3xl bg-slate-800/80 border border-amber-500/30 shadow-xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Gift className="w-5 h-5 text-amber-400" />
                    <span>ยื่นขอใช้สิทธิ์ลุ้นรับรางวัล (เลือกรางวัลที่ต้องการ)</span>
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-amber-300">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>ติดต่อรับที่: <strong>{PICKUP_LOCATION}</strong></span>
                  </div>
                </div>

                {claimMessage && (
                  <div
                    className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                      claimMessage.type === 'success'
                        ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200'
                        : 'bg-rose-500/20 border border-rose-400/40 text-rose-200'
                    }`}
                  >
                    {claimMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-300" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-300" />
                    )}
                    <span>{claimMessage.text}</span>
                  </div>
                )}

                {/* 3 Radio Selectable Reward Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {REWARD_ITEMS.map((item) => {
                    const isSelected = selectedReward === item.shortName;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedReward(item.shortName)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-gradient-to-br from-amber-950/60 to-slate-900 border-amber-400 shadow-lg shadow-amber-500/20 scale-[1.02]'
                            : 'bg-slate-900/60 hover:bg-slate-900 border-slate-700/80 hover:border-slate-600'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">{item.icon}</span>
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                isSelected
                                  ? 'border-amber-400 bg-amber-400 text-slate-950'
                                  : 'border-slate-600'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                          <h5 className="font-bold text-white text-sm">
                            {item.title}
                          </h5>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-amber-300 font-semibold">
                          {isSelected ? '✓ รางวัลที่เลือก' : 'คลิกเพื่อเลือกรางวัลนี้'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Note input and Submit button */}
                <form onSubmit={handleSubmitClaim} className="pt-2 space-y-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      ข้อความหรือหมายเหตุถึง {ADMIN_CONTACT_NAME} (ถ้ามี):
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ขอมารับวันศุกร์บ่าย หรือ ติดต่อประสานงานไว้แล้ว..."
                      value={claimNote}
                      onChange={(e) => setClaimNote(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span>
                        สถานที่รับ: <strong>ห้องพักครู Com ชั้น 3 ({ADMIN_CONTACT_NAME})</strong>
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingClaim || !isEligible}
                      className={`px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
                        isEligible
                          ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-amber-500/25 hover:scale-105 active:scale-95'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <Gift className="w-4 h-4" />
                      <span>
                        {isEligible
                          ? `ยืนยันขอรับรางวัล (${selectedReward})`
                          : `ยังแชร์ไม่ครบ (ขาดอีก ${remaining} ครั้ง)`}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Information Cards: Where and How */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-xs">สถานที่ติดต่อรับของรางวัล</h5>
                    <p className="text-xs text-amber-300 font-semibold mt-0.5">
                      ห้องพักครู Com ชั้น 3 ({ADMIN_CONTACT_NAME})
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      คุณครูสามารถแวะไปรับของรางวัลได้ในวันและเวลาราชการ พร้อมแจ้งชื่อหรือแสดงหน้าจอเช็คสถานะนี้
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-xs">การนับสถิติอัตโนมัติ</h5>
                    <p className="text-xs text-slate-300 mt-0.5">
                      ระบบตรวจจับการโพสต์และแชร์แบบ Real-time
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      ทุกการแชร์ในคลังไอเดีย, สื่อนวัตกรรม 5 ชิ้น, หรือการบันทึกแหล่งเรียนรู้ จะถูกนำมารวมในสิทธิพิเศษทันที
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: 3 Rewards Details */}
          {activeTab === 'rewards' && (
            <div className="space-y-5">
              <div className="text-center max-w-xl mx-auto mb-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  ของรางวัลพิเศษสำหรับคุณครูผู้ร่วมสร้างสรรค์คลังสื่อนวัตกรรม
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  เพียงแชร์แหล่งการเรียนรู้สะสมครบ 20 ครั้งขึ้นไป ลุ้นรับ 1 ใน 3 รายการสุดพิเศษนี้ได้ที่ {PICKUP_LOCATION}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {REWARD_ITEMS.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-3xl bg-slate-800/80 border border-slate-700 hover:border-amber-400/60 transition-all flex flex-col justify-between shadow-lg group hover:scale-[1.02]"
                  >
                    <div>
                      {/* Badge rank */}
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${item.badgeBg}`}>
                          {item.title}
                        </span>
                        <span className="text-3xl filter drop-shadow group-hover:scale-125 transition-transform">
                          {item.icon}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                        {item.title}
                      </h4>

                      <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-700/80">
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>เกณฑ์การรับ:</span>
                        <strong className="text-amber-300">แชร์ครบ 20 ครั้งขึ้นไป</strong>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between mt-1">
                        <span>ติดต่อรับ:</span>
                        <span className="text-slate-200">ห้องพักครู Com ชั้น 3</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReward(item.shortName);
                          setActiveTab('status');
                        }}
                        className="w-full mt-3 py-2 rounded-xl bg-slate-700 hover:bg-amber-600 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>เลือกรับ {item.shortName}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Instructions banner */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-xs text-slate-300 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-amber-200">ขั้นตอนและวิธีการขอรับรางวัล:</h5>
                  <ol className="list-decimal list-inside space-y-1 mt-1 text-[11px] text-slate-300">
                    <li>สะสมการแชร์แหล่งเรียนรู้ / สื่อการสอน ให้ครบ 20 ครั้งขึ้นไป (ตรวจสอบได้ที่แท็บ เช็คสถานะ)</li>
                    <li>เมื่อครบ 20 ครั้งแล้ว ให้เลือกของรางวัลที่ต้องการ (ตุ๊กตา, ขนม หรือ ลูกอม) แล้วกดยืนยัน</li>
                    <li>ติดต่อรับของรางวัลจริงได้ที่ <strong>ห้องพักครู Com ชั้น 3 (ม.วีระพงษ์)</strong></li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: History of shared posts */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>รายการแหล่งเรียนรู้และสื่อที่คุณครูแชร์ ({statusData?.posts?.length || 0} รายการ)</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    รวบรวมประวัติการแบ่งปันสื่อ นวัตกรรม และแหล่งเรียนรู้ทั้งหมดของคุณครูในระบบ
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('status');
                    setShowQuickShareForm(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>+ แชร์เพิ่ม</span>
                </button>
              </div>

              {(!statusData?.posts || statusData.posts.length === 0) ? (
                <div className="p-10 rounded-2xl bg-slate-800/40 border border-slate-700/60 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
                    <FolderArchive className="w-6 h-6" />
                  </div>
                  <h5 className="font-bold text-white text-sm">ยังไม่มีประวัติการแชร์แหล่งเรียนรู้</h5>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                    เริ่มต้นโพสต์แชร์แหล่งเรียนรู้ ชิ้นงาน หรือบันทึกการใช้แหล่งเรียนรู้ เพื่อเริ่มสะสมแต้มให้ครบ 20 ครั้ง!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('status');
                      setShowQuickShareForm(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md cursor-pointer"
                  >
                    + เริ่มแชร์แหล่งเรียนรู้ตอนนี้
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {statusData.posts.map((post, idx) => (
                    <div
                      key={post.id}
                      className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/80 hover:border-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 text-slate-300 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-bold text-white text-sm">
                              {post.title}
                            </h5>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-semibold">
                              {post.sourceLabel}
                            </span>
                            {post.category && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px]">
                                {post.category}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1 block">
                            แชร์เมื่อ: {new Date(post.createdAt).toLocaleString('th-TH')}
                          </span>
                        </div>
                      </div>

                      {post.url && (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-blue-300 hover:text-white text-xs font-medium flex items-center gap-1 self-end sm:self-center flex-shrink-0 transition-colors"
                        >
                          <span>เปิดลิงก์</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-400 text-center sm:text-left">
            <span>
              เงื่อนไข: แชร์แหล่งเรียนรู้ครบ 20 ครั้งขึ้นไป ลุ้นรับ 1.ตุ๊กตา 2.ขนม 3.ลูกอม
            </span>
            <span className="hidden sm:inline"> • </span>
            <span className="text-amber-300 font-semibold block sm:inline">
              ติดต่อรับได้ที่ห้องพักครู Com ชั้น 3 ({ADMIN_CONTACT_NAME})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
