import React, { useState } from 'react';
import {
  X,
  Gift,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  ExternalLink,
  Award,
  AlertCircle,
  FolderArchive,
  Save,
  Check
} from 'lucide-react';
import {
  TeacherPrivilegeAdminItem,
  adminUpdateRewardClaim,
  REWARD_ITEMS,
  PICKUP_LOCATION,
  ADMIN_CONTACT_NAME
} from '../services/privilegeService';

interface AdminPrivilegeRewardModalProps {
  teacher: TeacherPrivilegeAdminItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const AdminPrivilegeRewardModal: React.FC<AdminPrivilegeRewardModalProps> = ({
  teacher,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [claimStatus, setClaimStatus] = useState<'eligible' | 'pending_pickup' | 'received' | 'not_eligible'>(
    teacher.claimStatus
  );
  const [selectedReward, setSelectedReward] = useState<string>(
    teacher.receivedReward || teacher.selectedReward || '1. ตุ๊กตา'
  );
  const [adminNote, setAdminNote] = useState<string>(teacher.adminNote || '');
  const [administeredBy, setAdministeredBy] = useState<string>(ADMIN_CONTACT_NAME);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'reward' | 'posts'>('reward');

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const res = await adminUpdateRewardClaim({
      userEmail: teacher.email,
      teacherName: teacher.name,
      claimStatus,
      receivedReward: claimStatus === 'received' ? selectedReward : '',
      adminNote,
      administeredBy,
    });

    setIsSaving(false);
    if (res.success) {
      onSuccess(`บันทึกสถานะของ ${teacher.name} สำเร็จแล้ว (${claimStatus === 'received' ? `มอบ ${selectedReward} เรียบร้อย` : 'อัปเดตสถานะสำเร็จ'})`);
      onClose();
    } else {
      alert(res.error || 'เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  return (
    <div
      id="modal-admin-privilege-reward"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-['Prompt',sans-serif] select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center">
              <Gift className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>จัดการสิทธิพิเศษและการมอบรางวัล (Admin)</span>
              </h3>
              <p className="text-xs text-slate-300">
                คุณครู: <strong className="text-white">{teacher.name}</strong> ({teacher.email})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-5 pt-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('reward')}
            className={`px-3.5 py-1.5 rounded-t-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'reward'
                ? 'bg-slate-800 text-amber-300 border-t-2 border-amber-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>บันทึกการมอบรางวัล</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={`px-3.5 py-1.5 rounded-t-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'posts'
                ? 'bg-slate-800 text-amber-300 border-t-2 border-amber-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>ตรวจสอบโพสต์ที่แชร์ทั้งหมด ({teacher.posts?.length || 0} ชิ้น)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-grow">
          {activeTab === 'reward' ? (
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              
              {/* Teacher Summary Overview Card */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-slate-400">สถิติการแชร์แหล่งเรียนรู้:</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-2xl font-black text-amber-400">{teacher.totalShares}</span>
                    <span className="text-xs text-slate-300">/ 20 ครั้ง</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        teacher.isEligible
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                      }`}
                    >
                      {teacher.isEligible ? '✓ ผ่านเกณฑ์ครบ 20 ครั้ง' : `กำลังสะสม (ขาดอีก ${Math.max(0, 20 - teacher.totalShares)} ครั้ง)`}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-400">รางวัลที่ครูเลือกไว้:</span>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {teacher.selectedReward || 'ยังไม่ได้ระบุ'}
                  </div>
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  สถานะการรับรางวัล (Claim Status):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'not_eligible', label: 'ยังไม่ถึงเกณฑ์', color: 'border-slate-700 bg-slate-800' },
                    { id: 'eligible', label: 'มีสิทธิ์ (ครบ 20)', color: 'border-blue-500/40 bg-blue-950/40' },
                    { id: 'pending_pickup', label: 'ยื่นขอรับแล้ว', color: 'border-amber-500/40 bg-amber-950/40' },
                    { id: 'received', label: 'รับมอบรางวัลแล้ว', color: 'border-emerald-500/40 bg-emerald-950/40' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setClaimStatus(st.id as any)}
                      className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                        claimStatus === st.id
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow-md ring-1 ring-amber-400'
                          : `${st.color} text-slate-400 hover:text-white`
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reward Selection */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  ของรางวัลที่มอบให้ (1. ตุ๊กตา, 2. ขนม, 3. ลูกอม):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { title: '1. ตุ๊กตา', short: 'ตุ๊กตา', icon: '🧸' },
                    { title: '2. ขนม', short: 'ขนม', icon: '🍪' },
                    { title: '3. ลูกอม', short: 'ลูกอม', icon: '🍬' },
                  ].map((rw) => {
                    const isPicked = selectedReward.includes(rw.short);
                    return (
                      <div
                        key={rw.short}
                        onClick={() => setSelectedReward(rw.title)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isPicked
                            ? 'bg-amber-950/50 border-amber-400 text-white shadow-md'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{rw.icon}</span>
                          <span className="font-bold">{rw.title}</span>
                        </div>
                        {isPicked && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Place & Admin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    สถานที่รับรางวัล:
                  </label>
                  <input
                    type="text"
                    value={PICKUP_LOCATION}
                    disabled
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    ผู้ดำเนินการ / ผู้มอบรางวัล:
                  </label>
                  <input
                    type="text"
                    value={administeredBy}
                    onChange={(e) => setAdministeredBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  หมายเหตุ / รายละเอียดเพิ่มเติม:
                </label>
                <input
                  type="text"
                  placeholder="เช่น มอบให้เรียบร้อยเมื่อวันพุธคาบ 4, ม.วีระพงษ์ เป็นผู้ส่งมอบ"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Submit */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการมอบรางวัล'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                <span>รายการโพสต์/สื่อทั้งหมดที่ครูท่านนี้แชร์ในระบบ:</span>
                <span className="font-bold text-white">{teacher.posts?.length || 0} รายการ</span>
              </div>

              {(!teacher.posts || teacher.posts.length === 0) ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  ไม่พบรายการโพสต์ที่แชร์
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {teacher.posts.map((post, idx) => (
                    <div
                      key={post.id}
                      className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs flex items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-slate-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white">{post.title}</span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
                              {post.sourceLabel}
                            </span>
                            {post.category && (
                              <span className="text-[10px] text-slate-400">
                                ({post.category})
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            {new Date(post.createdAt).toLocaleString('th-TH')}
                          </span>
                        </div>
                      </div>

                      {post.url && (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-blue-300 text-[11px] flex items-center gap-1 flex-shrink-0"
                        >
                          <span>ลิงก์</span>
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

      </div>
    </div>
  );
};
