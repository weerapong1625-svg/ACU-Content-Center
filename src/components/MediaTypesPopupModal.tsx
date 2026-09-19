import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  Download, 
  BookOpenCheck,
  Upload,
  Camera,
  RefreshCw,
  Check,
  ShieldCheck
} from 'lucide-react';
import { 
  subscribeCriteriaPoster, 
  saveCriteriaPoster, 
  resetCriteriaPoster,
  getInitialCriteriaPosterUrl,
  ADMIN_TARGET_EMAIL,
  DEFAULT_CRITERIA_POSTER
} from '../services/submissionService';

interface MediaTypesPopupModalProps {
  userEmail?: string | null;
  onClose: () => void;
}

/**
 * 2. ศึกษาเกณฑ์/ประเภทสื่อ
 * Displays exclusively the official graphic poster as a popup.
 * Strictly: Only Admin (weerapong1625@acu.ac.th) can upload and save a new graphic poster.
 * Other users can ONLY view the poster that was updated.
 */
export const MediaTypesPopupModal: React.FC<MediaTypesPopupModalProps> = ({ 
  userEmail,
  onClose 
}) => {
  const [posterUrl, setPosterUrl] = useState<string>(getInitialCriteriaPosterUrl());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isAdminUploadOpen, setIsAdminUploadOpen] = useState(false);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine if active user is Admin
  const activeEmail = userEmail || (() => {
    try {
      return localStorage.getItem('acu_current_user_email');
    } catch {
      return '';
    }
  })();

  const isAdmin = (activeEmail || '').trim().toLowerCase() === ADMIN_TARGET_EMAIL.toLowerCase();

  // Real-time subscription to criteria poster
  useEffect(() => {
    const unsub = subscribeCriteriaPoster((url) => {
      setPosterUrl(url);
    });
    return () => unsub();
  }, []);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => setZoomLevel(1);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          // Compress as high quality JPEG (~150KB - 250KB) - safe for Firestore 1MB document limit
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setNewImagePreview(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSavePoster = async () => {
    if (!newImagePreview) return;
    setIsSaving(true);
    setSaveSuccessNotice(null);

    // 1. Immediately reflect the change on the screen
    setPosterUrl(newImagePreview);

    const emailToUse = (activeEmail && activeEmail.includes('@')) ? activeEmail : ADMIN_TARGET_EMAIL;
    const res = await saveCriteriaPoster(newImagePreview, emailToUse);
    setIsSaving(false);

    if (res.success) {
      setPosterUrl(newImagePreview);
      setSaveSuccessNotice('บันทึกภาพเกณฑ์/ประเภทสื่อลงระบบสำเร็จ ภาพเปลี่ยนทันที');
      setTimeout(() => {
        setIsAdminUploadOpen(false);
        setNewImagePreview(null);
        setSaveSuccessNotice(null);
      }, 900);
    } else {
      alert(res.message);
    }
  };

  const handleResetDefault = async () => {
    const emailToUse = (activeEmail && activeEmail.includes('@')) ? activeEmail : ADMIN_TARGET_EMAIL;
    if (!confirm('ยืนยันรีเซ็ตกลับเป็นภาพดั้งเดิม (ประเภทสื่อ .png) ใช่หรือไม่?')) return;
    setIsSaving(true);
    setPosterUrl(DEFAULT_CRITERIA_POSTER);
    const res = await resetCriteriaPoster(emailToUse);
    setIsSaving(false);
    if (res.success) {
      setNewImagePreview(null);
      setIsAdminUploadOpen(false);
    } else {
      alert(res.message);
    }
  };

  return (
    <div
      id="modal-media-types-popup"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-cyan-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header Bar */}
        <div className="p-3 sm:p-4 bg-gradient-to-r from-sky-900/80 via-cyan-900/60 to-slate-900 border-b border-cyan-500/30 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 flex-shrink-0">
              <BookOpenCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-1.5 sm:gap-2">
                2. ศึกษาเกณฑ์/ประเภทสื่อ
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  Infographic
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-300">
                งานพัฒนาสื่อและนวัตกรรม โรงเรียนอัสสัมชัญอุบลราชธานี
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.75}
                title="ย่อภาพ"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2 py-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 2.5}
                title="ขยายภาพ"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Admin Upload Trigger */}
            {isAdmin ? (
              <button
                type="button"
                id="btn-admin-edit-criteria-poster"
                onClick={() => setIsAdminUploadOpen(true)}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                title="อัปเดตภาพโปสเตอร์ (Admin: weerapong1625@acu.ac.th)"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>เปลี่ยนภาพโปสเตอร์ (Admin)</span>
              </button>
            ) : (
              <button
                type="button"
                id="btn-verify-admin-criteria-poster"
                onClick={() => {
                  const input = prompt('ยืนยันอีเมล Admin เพื่อแก้ไขภาพ (สิทธิ์: weerapong1625@acu.ac.th):', 'weerapong1625@acu.ac.th');
                  if (input && input.trim().toLowerCase() === ADMIN_TARGET_EMAIL.toLowerCase()) {
                    try {
                      localStorage.setItem('acu_current_user_email', ADMIN_TARGET_EMAIL);
                    } catch {
                      // ignore
                    }
                    setIsAdminUploadOpen(true);
                  } else if (input) {
                    alert('ไม่อนุญาต: สิทธิ์เฉพาะ ' + ADMIN_TARGET_EMAIL + ' เท่านั้น');
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-300 text-xs flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
                title="เข้าสู่ระบบ Admin เพื่อเปลี่ยนภาพ"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">เปลี่ยนภาพ (Admin)</span>
              </button>
            )}

            {/* Download Button */}
            <a
              href={posterUrl}
              download="ACU_Media_Criteria_Infographic.png"
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              title="ดาวน์โหลดภาพต้นฉบับ"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">ดาวน์โหลด</span>
            </a>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Graphic Viewer Body */}
        <div className="flex-1 overflow-auto p-3 sm:p-6 flex items-center justify-center bg-slate-950/80 min-h-[55vh]">
          <div
            className="transition-transform duration-200 ease-out flex items-center justify-center max-w-full"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
          >
            <img
              src={posterUrl}
              alt="เกณฑ์และประเภทสื่อ โรงเรียนอัสสัมชัญอุบลราชธานี"
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl border border-cyan-500/30"
              onError={(e) => {
                // Fallback to default
                const target = e.target as HTMLImageElement;
                if (target.src !== DEFAULT_CRITERIA_POSTER) {
                  target.src = DEFAULT_CRITERIA_POSTER;
                }
              }}
            />
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 px-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>แสดงผลกราฟิกเต็มรูปแบบทั้งสมาร์ตโฟนและคอมพิวเตอร์</span>
          </div>
          {isAdmin ? (
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              สิทธิ์ผู้ดูแลระบบ (Admin: {ADMIN_TARGET_EMAIL})
            </span>
          ) : (
            <span>โหมดผู้ใช้งาน: แสดงภาพที่อัปเดตล่าสุด</span>
          )}
        </div>
      </div>

      {/* Admin Upload Graphic Modal */}
      {isAdminUploadOpen && isAdmin && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdminUploadOpen(false);
          }}
        >
          <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/50 rounded-3xl shadow-2xl overflow-hidden p-6 text-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">อัปเดตภาพเกณฑ์/ประเภทสื่อ (Admin)</h3>
                  <p className="text-[11px] text-slate-400">สิทธิ์เฉพาะ: {ADMIN_TARGET_EMAIL}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminUploadOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-5 flex flex-col items-center">
              {/* Preview image */}
              <div className="w-full max-h-60 rounded-2xl bg-slate-950 border border-slate-700 overflow-hidden flex items-center justify-center mb-4 p-2">
                <img
                  src={newImagePreview || posterUrl}
                  alt="New Poster Preview"
                  className="max-h-56 max-w-full object-contain rounded-xl"
                />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>เลือกไฟล์ภาพใหม่...</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>รีเซ็ตค่าเดิม</span>
                </button>
              </div>

              {saveSuccessNotice && (
                <div className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>{saveSuccessNotice}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdminUploadOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
              >
                ยกเลิก
              </button>

              {newImagePreview && (
                <button
                  type="button"
                  onClick={handleSavePoster}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'กำลังบันทึกลง Firebase...' : 'บันทึกภาพทันที'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
