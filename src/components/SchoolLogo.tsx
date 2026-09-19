import React, { useState, useEffect, useRef } from 'react';
import { ACUEmblemVector } from './ACUEmblemVector';
import { Upload, RefreshCw } from 'lucide-react';

interface SchoolLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showUploadHint?: boolean;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  className = '',
  size = 'md',
  showUploadHint = false,
}) => {
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [useVector, setUseVector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if user has uploaded a custom logo into local storage
    try {
      const stored = localStorage.getItem('acu_custom_logo_v2');
      if (stored) {
        setCustomLogoUrl(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setCustomLogoUrl(result);
          setUseVector(false);
          try {
            localStorage.setItem('acu_custom_logo_v2', result);
          } catch {
            // storage quota fallback
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetLogo = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.removeItem('acu_custom_logo_v2');
    } catch {
      // ignore
    }
    setCustomLogoUrl(null);
    setUseVector(true);
  };

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14 sm:w-16 sm:h-16',
    lg: 'w-20 h-20 sm:w-24 sm:h-24',
    xl: 'w-28 h-28 sm:w-32 sm:h-32',
  };

  // Determine current image source
  const currentSrc = customLogoUrl || '/acu_logo.svg';

  return (
    <div
      id="school-logo-container"
      className={`relative inline-flex items-center justify-center flex-shrink-0 group ${className}`}
      title="ตราสัญลักษณ์โรงเรียนอัสสัมชัญอุบลราชธานี"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div
        id="school-logo-graphic"
        className={`${sizeClasses[size]} relative flex items-center justify-center rounded-full bg-white shadow-md border border-slate-100/90 p-0.5 sm:p-1 transition-transform duration-300 group-hover:scale-105 select-none`}
      >
        {useVector || !currentSrc ? (
          <ACUEmblemVector className="w-full h-full object-contain" />
        ) : (
          <img
            src={currentSrc}
            alt="โรงเรียนอัสสัมชัญอุบลราชธานี Assumption College Ubonratchathani"
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain rounded-full"
            onError={() => {
              // Gracefully switch to pure inline vector emblem
              setUseVector(true);
            }}
          />
        )}
      </div>

      {/* Optional upload / reset overlay button for user convenience */}
      {showUploadHint && (
        <div className="absolute -bottom-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/95 rounded-full p-1 shadow-md border border-slate-200">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="อัปโหลดไฟล์ตราโรงเรียน (ACU N.png) จากเครื่องของคุณ"
            className="p-1 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
          >
            <Upload className="w-3 h-3" />
          </button>
          {customLogoUrl && (
            <button
              type="button"
              onClick={handleResetLogo}
              title="รีเซ็ตกลับเป็นตราสัญลักษณ์มาตรฐาน"
              className="p-1 hover:bg-red-50 rounded-full text-red-500 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
