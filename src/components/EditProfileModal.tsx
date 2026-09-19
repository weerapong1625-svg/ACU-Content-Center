import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Camera, 
  Sparkles, 
  Check, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  RotateCcw,
  User,
  AlertCircle
} from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  displayName: string;
  currentAvatarUrl: string;
  onSaveAvatar: (newAvatarUrl: string) => Promise<void> | void;
}

// Curated high quality realistic portraits for ACU educators & students
export const PRESET_AVATARS = [
  {
    id: 'male-teacher-1',
    label: 'อาจารย์/ครูผู้สอน (ชาย 1)',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&h=300&q=80',
  },
  {
    id: 'male-teacher-2',
    label: 'อาจารย์/ครูผู้สอน (ชาย 2)',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&h=300&q=80',
  },
  {
    id: 'female-teacher-1',
    label: 'อาจารย์/ครูผู้สอน (หญิง 1)',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&h=300&q=80',
  },
  {
    id: 'female-teacher-2',
    label: 'อาจารย์/ครูผู้สอน (หญิง 2)',
    url: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&w=300&h=300&q=80',
  },
  {
    id: 'male-student-1',
    label: 'นักเรียน/นักศึกษา (ชาย)',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&h=300&q=80',
  },
  {
    id: 'female-student-1',
    label: 'นักเรียน/นักศึกษา (หญิง)',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&h=300&q=80',
  },
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  displayName,
  currentAvatarUrl,
  onSaveAvatar,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentAvatarUrl);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'upload' | 'preset' | 'url'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle local file upload and compress to clean Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setUploadError('ขนาดไฟล์เกิน 8MB กรุณาเลือกรูปภาพที่มีขนาดเล็กลง');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize canvas to max 320x320 for optimal performance and storage
        const canvas = document.createElement('canvas');
        const MAX_DIM = 320;
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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setSelectedAvatar(compressedDataUrl);
        } else {
          setSelectedAvatar(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setUploadError('เกิดข้อผิดพลาดในการอ่านไฟล์รูปภาพ');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!customUrlInput.trim()) return;
    setSelectedAvatar(customUrlInput.trim());
    setCustomUrlInput('');
  };

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      await onSaveAvatar(selectedAvatar);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetToDefault = () => {
    // Standard Google / ACU default avatar
    const defaultUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName || userEmail
    )}&background=1d4ed8&color=ffffff&size=256&bold=true`;
    setSelectedAvatar(defaultUrl);
  };

  return (
    <div
      id="edit-profile-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="edit-profile-modal-card"
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                แก้ไขรูปโปรไฟล์ผู้ใช้งาน
              </h3>
              <p className="text-xs text-slate-400">
                {userEmail}
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
          
          {/* Avatar Live Preview */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative group">
              <div className="w-28 h-28 rounded-full overflow-hidden p-1 bg-gradient-to-tr from-blue-600 via-indigo-500 to-red-500 shadow-xl">
                <img
                  src={selectedAvatar}
                  alt={displayName}
                  className="w-full h-full object-cover rounded-full bg-slate-800"
                  onError={(e) => {
                    // Fallback to UI avatars on broken image
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      displayName
                    )}&background=1d4ed8&color=ffffff&size=256&bold=true`;
                  }}
                />
              </div>

              {/* Status indicator on avatar */}
              <div
                className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-white shadow-md"
                title="ออนไลน์"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-white">{displayName}</p>
              <p className="text-xs text-slate-400 font-mono">{userEmail}</p>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex p-1 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => setActiveMode('upload')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeMode === 'upload'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>อัปโหลดรูปภาพ</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('preset')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeMode === 'preset'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>รูปโปรไฟล์แนะนำ</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('url')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeMode === 'url'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>ลิงก์รูปภาพ</span>
            </button>
          </div>

          {/* Tab 1: Upload from device */}
          {activeMode === 'upload' && (
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
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
                  คลิกเพื่อเลือกไฟล์รูปภาพจากอุปกรณ์ของคุณ
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  รองรับไฟล์ PNG, JPG, JPEG, WebP หรือ GIF (ขนาดไม่เกิน 8MB)
                </p>
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Preset Realistic Avatars */}
          {activeMode === 'preset' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                เลือกรูปภาพโปรไฟล์อาจารย์/บุคลากร หรือนักเรียนที่ตรงกับคุณ:
              </p>
              <div className="grid grid-cols-3 gap-3">
                {PRESET_AVATARS.map((preset) => {
                  const isCurrentSelected = selectedAvatar === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedAvatar(preset.url)}
                      className={`relative group rounded-2xl overflow-hidden p-1 transition-all text-left ${
                        isCurrentSelected
                          ? 'ring-4 ring-blue-500 bg-blue-600/20'
                          : 'border border-slate-700 hover:border-slate-500 bg-slate-800/60'
                      }`}
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-slate-800">
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      {isCurrentSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                      <p className="text-[10px] text-slate-300 font-medium truncate mt-1 px-1 text-center">
                        {preset.label.split(' ')[0]}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: Paste Direct URL */}
          {activeMode === 'url' && (
            <div className="space-y-3">
              <label className="text-xs text-slate-400 block">
                ระบุ URL ลิงก์รูปภาพโดยตรง (Direct Image Link):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://example.com/my-photo.jpg"
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
              <p className="text-[11px] text-slate-500">
                สามารถคัดลอกลิงก์รูปภาพจาก Google Drive, Social Media หรือเว็บไซต์อื่นมาวางได้
              </p>
            </div>
          )}

          {/* Reset to default option */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800">
            <span>ต้องการกลับไปใช้รูปเริ่มต้น?</span>
            <button
              type="button"
              onClick={handleResetToDefault}
              className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>รีเซ็ตเป็นค่าเริ่มต้น</span>
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
            id="btn-confirm-save-avatar"
            onClick={handleSave}
            disabled={isProcessing}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 transition-all flex items-center gap-1.5"
          >
            {isProcessing ? (
              <span>กำลังบันทึก...</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>บันทึกรูปโปรไฟล์</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
