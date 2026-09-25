import React from 'react';
import { Clock, ShieldCheck, X, LogIn } from 'lucide-react';

interface SessionTimeoutModalProps {
  onClose: () => void;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({ onClose }) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-center overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Glow ambient background */}
        <div className="absolute -top-14 -right-14 w-36 h-36 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-14 -left-14 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="ปิดหน้าต่าง"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-4 text-blue-400 shadow-inner">
          <Clock className="w-8 h-8 text-blue-400 animate-pulse" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
          ออกจากระบบอัตโนมัติ
        </h3>
        <p className="text-xs text-blue-300 font-medium mb-3 tracking-wide">
          (Auto Logout Due to Inactivity)
        </p>

        {/* Description */}
        <div className="p-4 bg-slate-800/80 border border-slate-700/60 rounded-xl text-left mb-6 space-y-2">
          <p className="text-sm text-slate-200 leading-relaxed">
            ระบบได้นำท่านกลับมาที่หน้าเข้าสู่ระบบอัตโนมัติ เนื่องจาก<strong>ไม่มีการเข้าใช้งานต่อเนื่องเป็นระยะเวลา 30 นาที</strong>
          </p>
          <div className="flex items-center gap-2 pt-1 text-xs text-emerald-400">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>เพื่อความปลอดภัยของข้อมูลและบัญชีผู้ใช้งานของคุณครูและนักเรียน</span>
          </div>
        </div>

        {/* Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 active:scale-98"
        >
          <LogIn className="w-4 h-4" />
          <span>ตกลง / เข้าสู่ระบบใหม่</span>
        </button>
      </div>
    </div>
  );
};
