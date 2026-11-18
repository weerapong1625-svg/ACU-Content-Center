import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  RotateCcw, 
  Check, 
  Settings, 
  Sparkles,
  AlertCircle,
  Eye
} from 'lucide-react';
import { DEFAULT_BANNER_IMAGE, savePopupBannerConfig, resetPopupBannerConfig } from '../services/bannerService';

interface AdminBannerManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBannerUrl: string;
  onBannerUpdated: (newUrl: string) => void;
}

export const PRESET_SYSTEM_BANNERS = [
  {
    id: 'royal-tribute-default',
    title: 'พระราชดำรัสฯ ด้านการศึกษา (ภาพเริ่มต้นตามไฟล์แนบ)',
    url: DEFAULT_BANNER_IMAGE,
    description: 'ภาพพระราชดำรัส สมเด็จพระกนิษฐาธิราชเจ้า กรมสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี',
  },
  {
    id: 'school-event-1',
    title: 'นวัตกรรมและเทคโนโลยีการเรียนรู้ ACU',
    url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80',
    description: 'ภาพประชาสัมพันธ์การใช้นวัตกรรมและการเรียนการสอนในยุคดิจิทัล',
  },
  {
    id: 'school-event-2',
    title: 'คลังสื่อการสอนและผลงานทางวิชาการ',
    url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80',
    description: 'ภาพคลังหนังสือและห้องสมุดดิจิทัลโรงเรียนอัสสัมชัญอุบลราชธานี',
  },
];

export const AdminBannerManagerModal: React.FC<AdminBannerManagerModalProps> = ({
  isOpen,
  onClose,
  currentBannerUrl,
  onBannerUpdated,
}) => {
  const [selectedUrl, setSelectedUrl] = useState<string>(currentBannerUrl);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'preset' | 'url'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle local file upload (compress to base64)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (PNG, JPG, WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('ขนาดไฟล์เกิน 10MB กรุณาเลือกรูปภาพที่มีขนาดเล็กลง');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize canvas to max 960 width with 0.76 quality to optimize instant loading across mobile and desktop
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 960;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.76);
          setSelectedUrl(compressed);
        } else {
          setSelectedUrl(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setErrorMsg('เกิดข้อผิดพลาดในการอ่านไฟล์รูปภาพ');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!customUrlInput.trim()) return;
    setSelectedUrl(customUrlInput.trim());
    setCustomUrlInput('');
  };

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      const success = await savePopupBannerConfig({
        bannerImageUrl: selectedUrl,
        title: 'ป๊อปอัปประชาสัมพันธ์หน้าแรก',
        updatedBy: 'admin@acu.ac.th',
      });
      if (success) {
        onBannerUpdated(selectedUrl);
        onClose();
      } else {
        setErrorMsg('ไม่สามารถบันทึกไปยัง Firebase ได้ แต่บันทึกลงในเครื่องเรียบร้อย');
        onBannerUpdated(selectedUrl);
        onClose();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    setIsProcessing(true);
    try {
      await resetPopupBannerConfig();
      setSelectedUrl(DEFAULT_BANNER_IMAGE);
      onBannerUpdated(DEFAULT_BANNER_IMAGE);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="admin-banner-manager-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="admin-banner-manager-card"
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                ผู้ดูแลระบบ: เปลี่ยนรูปภาพป๊อปอัปหน้าแรก
              </h3>
              <p className="text-xs text-slate-400">
                หากไม่มีการเปลี่ยนระบบจะคงใช้งานรูปภาพเริ่มต้น (ไฟล์พระราชดำรัสฯ)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-1">
          
          {/* Live Preview of Banner */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-sky-400" />
              <span>ภาพตัวอย่างที่จะแสดงในป๊อปอัปหน้าแรก (Current Preview):</span>
            </label>
            <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-inner group aspect-[21/9] sm:aspect-[2.4/1]">
              <img
                src={selectedUrl}
                alt="Popup Banner Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_BANNER_IMAGE;
                }}
              />
              <div className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-[11px] text-slate-300 font-mono">
                {selectedUrl === DEFAULT_BANNER_IMAGE ? 'รูปภาพเดิม (Default)' : 'รูปภาพกำหนดเอง (Custom)'}
              </div>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex p-1 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>อัปโหลดรูปภาพใหม่</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preset')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'preset'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>รูปภาพระบบ</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'url'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>ระบุ URL</span>
            </button>
          </div>

          {/* Tab 1: Upload from device */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/jpg, image/webp"
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-800/40 hover:bg-slate-800/80 group"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-blue-600/15 group-hover:bg-blue-600/30 text-blue-400 flex items-center justify-center mb-3 transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  คลิกเพื่อเลือกไฟล์รูปภาพประชาสัมพันธ์จากเครื่อง
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  รองรับไฟล์ PNG, JPG, WebP อัตราส่วนแนวนอน (แนะนำความละเอียด 1200x500 พิกเซลขึ้นไป)
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: System Presets */}
          {activeTab === 'preset' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                เลือกรูปภาพประชาสัมพันธ์ที่เตรียมไว้ในระบบ:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PRESET_SYSTEM_BANNERS.map((preset) => {
                  const isSelected = selectedUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedUrl(preset.url)}
                      className={`relative rounded-xl overflow-hidden p-1.5 transition-all text-left flex flex-col ${
                        isSelected
                          ? 'ring-2 ring-blue-500 bg-blue-600/20'
                          : 'border border-slate-700 hover:border-slate-500 bg-slate-800/60'
                      }`}
                    >
                      <div className="aspect-[16/9] w-full rounded-lg overflow-hidden bg-slate-950 mb-2">
                        <img
                          src={preset.url}
                          alt={preset.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-200 line-clamp-1">
                        {preset.title}
                      </span>
                      <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: Paste Direct URL */}
          {activeTab === 'url' && (
            <div className="space-y-3">
              <label className="text-xs text-slate-400 block">
                ระบุ URL ลิงก์รูปภาพโดยตรง (Direct Image URL):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://example.com/announcement-banner.jpg"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  พรีวิว
                </button>
              </div>
            </div>
          )}

          {/* Reset button note */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800">
            <span>ต้องการยกเลิกและคืนค่ารูปภาพเดิม?</span>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>คืนค่ารูปเดิม (พระราชดำรัสฯ)</span>
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            id="btn-admin-save-banner"
            onClick={handleSave}
            disabled={isProcessing}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 transition-all flex items-center gap-1.5"
          >
            {isProcessing ? (
              <span>กำลังบันทึก...</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>บันทึกและเผยแพร่</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
