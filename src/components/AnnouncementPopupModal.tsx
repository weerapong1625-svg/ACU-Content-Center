import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Sparkles, 
  Maximize2, 
  ChevronRight, 
  ShieldCheck 
} from 'lucide-react';
import { 
  DEFAULT_BANNER_IMAGE, 
  fetchPopupBannerConfig, 
  getInitialBannerUrl,
  subscribePopupBanner 
} from '../services/bannerService';
import { AdminBannerManagerModal } from './AdminBannerManagerModal';

interface AnnouncementPopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdminManager?: () => void;
}

export const AnnouncementPopupModal: React.FC<AnnouncementPopupModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Synchronously initialize state from local storage cache so there is ZERO delay or flash of old image
  const [bannerUrl, setBannerUrl] = useState<string>(() => getInitialBannerUrl());
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [dontShowToday, setDontShowToday] = useState<boolean>(false);

  // Subscribe to real-time banner updates from Cloud Firestore so mobile and desktop sync immediately without hanging
  useEffect(() => {
    const unsubscribe = subscribePopupBanner((config) => {
      if (config?.bannerImageUrl) {
        setBannerUrl(config.bannerImageUrl);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showAdminModal) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showAdminModal, dontShowToday]);

  const handleClose = () => {
    if (dontShowToday) {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        localStorage.setItem('acu_announcement_hidden_date', todayStr);
      } catch {
        // ignore
      }
    }
    onClose();
  };

  const handleBannerUpdated = (newUrl: string) => {
    setBannerUrl(newUrl);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modern Translucent Gray Popup Overlay */}
      <div
        id="announcement-popup-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/70 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        {/* Modern Gray Translucent Glass Container with Symmetrical Sizing */}
        <div
          id="announcement-popup-card"
          className="relative max-w-3xl lg:max-w-4xl w-full bg-slate-900/85 backdrop-blur-2xl border border-slate-700/70 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden p-3 sm:p-4 text-slate-100 flex flex-col my-auto"
        >
          {/* Small Gray 'X' Close Button as explicitly requested */}
          <button
            type="button"
            id="btn-close-announcement-popup"
            onClick={handleClose}
            className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-30 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800/85 hover:bg-slate-700/90 text-slate-400 hover:text-white border border-slate-600/60 backdrop-blur-md flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer group"
            title="ปิดหน้าต่าง (Close)"
            aria-label="Close Announcement"
          >
            <X className="w-3.5 h-3.5 sm:w-4 h-4 transition-transform group-hover:scale-110" />
          </button>

          {/* Symmetrical Aspect-Ratio Banner Image Display */}
          <div className="relative w-full aspect-[2.35/1] sm:aspect-[2.4/1] rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-950/80 shadow-inner flex items-center justify-center">
            <img
              key={bannerUrl}
              src={bannerUrl}
              alt="ระบบคลังสื่อ และนวัตกรรมการเรียนรู้ โรงเรียนอัสสัมชัญอุบลราชธานี"
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover object-center select-none"
              onError={(e) => {
                // Fallback to default original royal banner if image fails
                (e.target as HTMLImageElement).src = DEFAULT_BANNER_IMAGE;
              }}
            />

            {/* Subtle Inner Glow Border */}
            <div className="absolute inset-0 pointer-events-none rounded-2xl border border-white/5" />
          </div>

          {/* Bottom Symmetrical Controls Bar */}
          <div className="mt-2.5 sm:mt-3 px-3 py-2 sm:py-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-400">
            {/* Left: Dismiss option */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={dontShowToday}
                onChange={(e) => setDontShowToday(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-600 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-[11px] sm:text-xs text-slate-300">
                ไม่ต้องแสดงป๊อปอัปนี้อีกในวันนี้
              </span>
            </label>

            {/* Right: Admin Action Button & Enter Portal Button */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {/* Admin Button to change image anytime */}
              <button
                type="button"
                id="btn-admin-open-banner-manager"
                onClick={() => setShowAdminModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[11px] sm:text-xs font-medium transition-all shadow-xs"
                title="สำหรับผู้ดูแลระบบ: เปลี่ยนหรืออัปเดตรูปภาพป๊อปอัป"
              >
                <Settings className="w-3.5 h-3.5 text-amber-400" />
                <span>เปลี่ยนรูปภาพ (Admin)</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600/85 hover:bg-blue-600 text-white text-[11px] sm:text-xs font-medium transition-colors shadow-xs"
              >
                เข้าสู่หน้าเว็บ
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Banner Manager Modal */}
      <AdminBannerManagerModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        currentBannerUrl={bannerUrl}
        onBannerUpdated={handleBannerUpdated}
      />
    </>
  );
};
