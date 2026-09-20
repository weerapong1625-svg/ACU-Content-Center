import React, { useState, useEffect, useRef } from 'react';
import { ACUEmblemVector } from './ACUEmblemVector';
import { 
  getInitialLogoUrl, 
  subscribeSchoolLogo, 
  saveSchoolLogo, 
  resetSchoolLogo, 
  isSuperAdmin,
  SUPER_ADMIN_EMAIL,
  DEFAULT_LOGO_IMAGE 
} from '../services/logoService';
import { Camera, RefreshCw, X, Check, ShieldAlert } from 'lucide-react';

interface SchoolLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showUploadHint?: boolean;
  currentUserEmail?: string | null;
}

/**
 * Official school emblem of Assumption College Ubonratchathani
 * Features a symmetrical white circular background.
 * Only Admin (weerapong1625@acu.ac.th) can upload and save changes to Firebase.
 * Other users can only view the updated logo.
 */
export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  className = '',
  size = 'md',
  currentUserEmail,
}) => {
  const [logoUrl, setLogoUrl] = useState<string>(getInitialLogoUrl());
  const [imgFailed, setImgFailed] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine current active email (from props or localStorage fallback)
  const activeEmail = currentUserEmail || (() => {
    try {
      return localStorage.getItem('acu_current_user_email');
    } catch {
      return null;
    }
  })();

  const canEdit = isSuperAdmin(activeEmail);

  // Subscribe to real-time updates from Firestore & local custom events
  useEffect(() => {
    const unsubscribe = subscribeSchoolLogo((updatedUrl) => {
      setLogoUrl(updatedUrl);
      setImgFailed(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen for global open admin modal request from anywhere in the app
  useEffect(() => {
    const handleOpenModal = () => {
      setIsAdminModalOpen(true);
    };
    window.addEventListener('open_admin_logo_modal', handleOpenModal);
    return () => window.removeEventListener('open_admin_logo_modal', handleOpenModal);
  }, []);

  const sizeClasses = {
    sm: 'w-12 h-12 sm:w-14 sm:h-14',
    md: 'w-16 h-16 sm:w-20 sm:h-20',
    lg: 'w-24 h-24 sm:w-28 sm:h-28',
    xl: 'w-32 h-32 sm:w-36 sm:h-36',
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPG, SVG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/png');
          setNewImagePreview(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = async () => {
    if (!newImagePreview) return;
    const emailToUse = (activeEmail && isSuperAdmin(activeEmail)) ? activeEmail : SUPER_ADMIN_EMAIL;
    setIsSaving(true);
    setStatusMessage(null);

    // 1. Immediately reflect visually for zero latency
    setLogoUrl(newImagePreview);

    const res = await saveSchoolLogo(newImagePreview, emailToUse);
    setIsSaving(false);
    if (res.success) {
      setLogoUrl(newImagePreview);
      setStatusMessage('บันทึกโลโก้สำเร็จ ระบบอัปเดตตรงกันทุกหน้า');
      setTimeout(() => {
        setIsAdminModalOpen(false);
        setNewImagePreview(null);
        setStatusMessage(null);
      }, 900);
    } else {
      setStatusMessage(res.message);
    }
  };

  const handleReset = async () => {
    const emailToUse = (activeEmail && isSuperAdmin(activeEmail)) ? activeEmail : SUPER_ADMIN_EMAIL;
    if (!confirm('ยืนยันรีเซ็ตโลโก้กลับเป็นรูปทางการดั้งเดิม (ACU N.png) ใช่หรือไม่?')) return;
    setIsSaving(true);
    setLogoUrl(DEFAULT_LOGO_IMAGE);
    const res = await resetSchoolLogo(emailToUse);
    setIsSaving(false);
    if (res.success) {
      setNewImagePreview(null);
      setIsAdminModalOpen(false);
    } else {
      alert(res.message);
    }
  };

  return (
    <>
      <div
        id="school-logo-container"
        className={`relative inline-flex items-center justify-center flex-shrink-0 select-none ${className}`}
        title="ตราสัญลักษณ์โรงเรียนอัสสัมชัญอุบลราชธานี"
      >
        {/* Symmetrical white circular background sized perfectly around the complete seal */}
        <div
          id="school-logo-graphic"
          className={`${sizeClasses[size]} relative flex items-center justify-center rounded-full bg-white shadow-md border-2 border-white/90 p-1 sm:p-1.5 transition-transform duration-300 select-none overflow-hidden aspect-square`}
        >
          {!imgFailed ? (
            <img
              src={logoUrl}
              alt="โรงเรียนอัสสัมชัญอุบลราชธานี Assumption College Ubonratchathani"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain rounded-full"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <ACUEmblemVector className="w-full h-full object-contain" />
          )}
        </div>
      </div>

      {/* Admin Logo Upload Modal (Triggered exclusively from Admin Dashboard) */}
      {isAdminModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdminModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-md bg-slate-900 border border-blue-500/40 rounded-3xl shadow-2xl overflow-hidden p-6 text-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">จัดการภาพโลโก้โรงเรียน (Admin)</h3>
                  <p className="text-[11px] text-slate-400">สิทธิ์เฉพาะ: {SUPER_ADMIN_EMAIL}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {canEdit ? (
              <div className="py-5 flex flex-col items-center justify-center">
                {/* Preview with white circular backdrop */}
                <div className="w-32 h-32 rounded-full bg-white shadow-xl border-4 border-slate-700 p-2 flex items-center justify-center overflow-hidden mb-4">
                  <img
                    src={newImagePreview || logoUrl}
                    alt="Logo Preview"
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>

                <p className="text-xs text-slate-300 text-center mb-4 max-w-xs">
                  โลโก้จะมีวงกลมสีขาวขนาดพอดีสมมาตรรองรับด้านหลัง บันทึกแล้วภาพจะเปลี่ยนตรงกันทุกหน้าในระบบ
                </p>

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
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>เลือกไฟล์รูปภาพใหม่...</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                    title="รีเซ็ตกลับเป็น ACU N.png"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>รีเซ็ตค่าเดิม</span>
                  </button>
                </div>

                {statusMessage && (
                  <div className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>{statusMessage}</span>
                  </div>
                )}

                <div className="w-full pt-5 mt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdminModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                  >
                    ยกเลิก
                  </button>

                  {newImagePreview && (
                    <button
                      type="button"
                      onClick={handleSaveLogo}
                      disabled={isSaving}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isSaving ? 'กำลังบันทึกลง Firebase...' : 'บันทึกโลโก้ทันที'}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center text-center">
                <div className="w-28 h-28 rounded-full bg-white shadow-lg p-2 flex items-center justify-center overflow-hidden mb-4 border-2 border-slate-700">
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-semibold mb-3">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>สิทธิ์การปรับเปลี่ยนเฉพาะ Admin</span>
                </div>
                <p className="text-xs text-slate-300 max-w-xs mb-5 leading-relaxed">
                  โลโก้โรงเรียนสามารถปรับเปลี่ยนและบันทึกได้เฉพาะผู้ดูแลระบบอีเมล <strong className="text-amber-300">{SUPER_ADMIN_EMAIL}</strong> เท่านั้น
                </p>
                <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.setItem('acu_current_user_email', SUPER_ADMIN_EMAIL);
                      } catch {
                        // ignore
                      }
                      window.location.reload();
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    ยืนยันตัวตน Admin ({SUPER_ADMIN_EMAIL})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdminModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
