import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Maximize2, 
  ChevronRight, 
  ShieldCheck,
  ZoomIn
} from 'lucide-react';
import { 
  DEFAULT_BANNER_IMAGE, 
  DEFAULT_BANNER_IMAGE_2,
  fetchPopupBannerConfig, 
  getInitialBannerUrl,
  getInitialBannerUrl2,
  subscribePopupBanner 
} from '../services/bannerService';

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
  const [bannerUrl1, setBannerUrl1] = useState<string>(() => getInitialBannerUrl());
  const [bannerUrl2, setBannerUrl2] = useState<string>(() => getInitialBannerUrl2());
  const [bannerTitle1, setBannerTitle1] = useState<string>('คลังสื่อและนวัตกรรมการเรียนรู้ ACU');
  const [bannerTitle2, setBannerTitle2] = useState<string>('พระราชดำรัสฯ เกี่ยวกับการใช้ปัญญาประดิษฐ์ (AI)');
  const [dontShowToday, setDontShowToday] = useState<boolean>(false);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  // Subscribe to real-time banner updates from Cloud Firestore so mobile and desktop sync immediately without hanging
  useEffect(() => {
    const unsubscribe = subscribePopupBanner((config) => {
      if (config?.bannerImageUrl) {
        setBannerUrl1(config.bannerImageUrl);
      }
      if (config?.bannerImageUrl2) {
        setBannerUrl2(config.bannerImageUrl2);
      }
      if (config?.title) {
        setBannerTitle1(config.title);
      }
      if (config?.title2) {
        setBannerTitle2(config.title2);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomedImage) {
          setZoomedImage(null);
        } else if (isOpen) {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, zoomedImage, dontShowToday]);

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

  if (!isOpen) return null;

  return (
    <>
      {/* Modern Translucent Gray Popup Overlay */}
      <div
        id="announcement-popup-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/75 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        {/* Modern Gray Translucent Glass Container with Symmetrical Sizing */}
        <div
          id="announcement-popup-card"
          className="relative max-w-5xl w-full bg-slate-900/90 backdrop-blur-2xl border border-slate-700/70 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden p-3.5 sm:p-5 text-slate-100 flex flex-col my-auto max-h-[92vh]"
        >
          {/* Small Gray 'X' Close Button as explicitly requested */}
          <button
            type="button"
            id="btn-close-announcement-popup"
            onClick={handleClose}
            className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/70 backdrop-blur-md flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer group"
            title="ปิดหน้าต่าง (Close)"
            aria-label="Close Announcement"
          >
            <X className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>

          {/* Dual Promotional Images: Image 1 on top, Image 2 below as requested */}
          <div className="flex flex-col items-center gap-3.5 overflow-y-auto pr-1 py-1 max-h-[76vh]">
            {/* Image 1: On top */}
            <div 
              onClick={() => setZoomedImage({ url: bannerUrl1, title: 'ภาพประชาสัมพันธ์ 1' })}
              className="relative w-full flex items-center justify-center rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950/60 shadow-lg cursor-pointer hover:border-blue-500/60 transition-all duration-200 group"
              title="คลิกเพื่อดูภาพขยายเต็มจอ"
            >
              <img
                key={bannerUrl1}
                src={bannerUrl1}
                alt="ภาพประชาสัมพันธ์ 1"
                loading="eager"
                decoding="async"
                className="max-h-[36vh] w-auto max-w-full object-contain rounded-xl select-none group-hover:scale-[1.01] transition-transform duration-200"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_BANNER_IMAGE;
                }}
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2.5">
                <span className="text-xs font-medium inline-flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-sm text-white shadow">
                  <ZoomIn className="w-3.5 h-3.5 text-sky-300" />
                  <span>ขยายภาพ</span>
                </span>
              </div>
            </div>

            {/* Image 2: Below */}
            <div 
              onClick={() => setZoomedImage({ url: bannerUrl2, title: 'ภาพประชาสัมพันธ์ 2' })}
              className="relative w-full flex items-center justify-center rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950/60 shadow-lg cursor-pointer hover:border-amber-500/60 transition-all duration-200 group"
              title="คลิกเพื่อดูภาพขยายเต็มจอ"
            >
              <img
                key={bannerUrl2}
                src={bannerUrl2}
                alt="ภาพประชาสัมพันธ์ 2"
                loading="eager"
                decoding="async"
                className="max-h-[36vh] w-auto max-w-full object-contain rounded-xl select-none group-hover:scale-[1.01] transition-transform duration-200"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_BANNER_IMAGE_2;
                }}
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2.5">
                <span className="text-xs font-medium inline-flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-sm text-white shadow">
                  <ZoomIn className="w-3.5 h-3.5 text-amber-300" />
                  <span>ขยายภาพ</span>
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Controls Bar (Admin button removed as requested) */}
          <div className="mt-3 px-3 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-400">
            {/* Left: Dismiss option */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={dontShowToday}
                onChange={(e) => setDontShowToday(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-[11px] sm:text-xs text-slate-300">
                ไม่ต้องแสดงป๊อปอัปนี้อีกในวันนี้
              </span>
            </label>

            {/* Right: Enter Portal Button */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                id="btn-enter-website"
                onClick={handleClose}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md hover:shadow-blue-500/25 flex items-center justify-center gap-1.5"
              >
                <span>เข้าสู่หน้าเว็บ</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox / Zoom Modal for clicked image */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-150"
          onClick={() => setZoomedImage(null)}
        >
          <button
            type="button"
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 z-70 w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center border border-slate-600 transition-colors"
            title="ปิดภาพขยาย"
          >
            <X className="w-5 h-5" />
          </button>
          <div 
            className="relative max-w-4xl max-h-[88vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomedImage.url}
              alt={zoomedImage.title}
              className="max-h-[80vh] w-auto object-contain rounded-2xl border border-slate-700 shadow-2xl"
            />
            <p className="mt-3 text-sm text-slate-200 font-medium text-center">
              {zoomedImage.title}
            </p>
          </div>
        </div>
      )}
    </>
  );
};
