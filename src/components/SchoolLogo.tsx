import React, { useState } from 'react';
import { ACUEmblemVector } from './ACUEmblemVector';

interface SchoolLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showUploadHint?: boolean;
}

/**
 * Permanent official school emblem of Assumption College Ubonratchathani (ACU N.png)
 * Embedded automatically across all pages and viewports with high-resolution vector rendering.
 */
export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14 sm:w-16 sm:h-16',
    lg: 'w-20 h-20 sm:w-24 sm:h-24',
    xl: 'w-28 h-28 sm:w-32 sm:h-32',
  };

  return (
    <div
      id="school-logo-container"
      className={`relative inline-flex items-center justify-center flex-shrink-0 group ${className}`}
      title="ตราสัญลักษณ์โรงเรียนอัสสัมชัญอุบลราชธานี (ACU N)"
    >
      <div
        id="school-logo-graphic"
        className={`${sizeClasses[size]} relative flex items-center justify-center rounded-full bg-white shadow-md border border-slate-100/90 p-0.5 sm:p-1 transition-transform duration-300 group-hover:scale-105 select-none overflow-hidden`}
      >
        {/* Render high-fidelity vector emblem directly for 100% crisp retina clarity and zero upload requirement */}
        {!imgFailed ? (
          <img
            src="/acu_n.png"
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
  );
};

