import React from 'react';
import { Clock, ShieldAlert, ArrowRight, LogOut } from 'lucide-react';

interface InactivityWarningModalProps {
  remainingSeconds: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  remainingSeconds,
  onStayLoggedIn,
  onLogout,
}) => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
    >
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 shadow-2xl text-center overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Glow ambient background */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4 text-amber-400 shadow-inner">
          <Clock className="w-8 h-8 animate-pulse text-amber-400" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
          แจ้งเตือน: ใกล้หมดเวลาการใช้งาน
        </h3>

        {/* Body Text */}
        <p className="text-sm text-slate-300 leading-relaxed mb-5">
          ท่านไม่ได้ทำรายการหรือใช้งานระบบเป็นระยะเวลาเกือบ 30 นาที เพื่อความปลอดภัยของข้อมูล ระบบจะออกจากระบบและกลับสู่หน้า Login อัตโนมัติในอีก:
        </p>

        {/* Countdown Timer Display */}
        <div className="mb-6 py-3 px-4 bg-slate-800/90 border border-amber-500/30 rounded-xl flex items-center justify-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black font-mono text-amber-400 tracking-wider">
              {timeFormatted}
            </span>
            <span className="text-xs text-slate-400 font-medium">นาที</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={onStayLoggedIn}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <span>ใช้งานต่อ</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-medium text-sm transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>ออกจากระบบทันที</span>
          </button>
        </div>
      </div>
    </div>
  );
};
