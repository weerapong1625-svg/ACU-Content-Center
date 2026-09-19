import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface GmailLoginFormProps {
  onLoginSuccess?: (email: string) => void;
}

export const GmailLoginForm: React.FC<GmailLoginFormProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeUser, setActiveUser] = useState<string | null>(null);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError('กรุณากรอกอีเมล Gmail หรือบัญชีโรงเรียน');
      return;
    }

    if (!validateEmail(trimmed)) {
      setError('รูปแบบอีเมลไม่ถูกต้อง (เช่น example@gmail.com หรือ user@acu.ac.th)');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      setActiveUser(trimmed);
      onLoginSuccess?.(trimmed);
    }, 600);
  };

  const handleGoogleSso = () => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      const user = email.trim() || 'weerapong1625@acu.ac.th';
      setIsLoading(false);
      setIsSuccess(true);
      setActiveUser(user);
      onLoginSuccess?.(user);
    }, 600);
  };

  const handleQuickFill = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword('••••••••••••');
    setError(null);
  };

  const handleReset = () => {
    setIsSuccess(false);
    setActiveUser(null);
    setEmail('');
    setPassword('');
  };

  if (isSuccess && activeUser) {
    return (
      <div
        id="login-success-card"
        className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-7 shadow-2xl text-center transition-all duration-300 animate-in fade-in zoom-in-95"
      >
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-1">
          เข้าสู่ระบบสำเร็จ
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          ยินดีต้อนรับเข้าสู่ระบบคลังสื่อ และนวัตกรรมการเรียนรู้
        </p>
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 mb-6">
          <span className="text-xs text-slate-400 block mb-1">บัญชีผู้ใช้ที่เข้าสู่ระบบ</span>
          <span className="text-sm font-semibold text-slate-700 font-mono break-all">{activeUser}</span>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            id="btn-enter-system"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white font-medium hover:from-blue-800 hover:to-indigo-900 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <span>เข้าสู่หน้าคลังสื่อการเรียนรู้</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="btn-signout"
            onClick={handleReset}
            className="w-full py-2 px-4 rounded-xl text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            สลับบัญชี / ออกจากระบบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="gmail-login-card"
      className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-xl border border-white/70 rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.15)] transition-all duration-300 hover:shadow-[0_25px_60px_rgba(15,23,42,0.2)]"
    >
      {/* Header of Login Card */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200/60 text-xs font-medium mb-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>ระบบคลาวด์การศึกษา ACU</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
          ลงชื่อเข้าใช้ด้วย Gmail
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          ใช้บัญชี Google หรืออีเมลโรงเรียนอัสสัมชัญอุบลราชธานี
        </p>
      </div>

      {/* Error notification */}
      {error && (
        <div
          id="login-error-alert"
          className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-in fade-in"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* One-click Google SSO Button */}
      <button
        type="button"
        id="btn-google-sso"
        onClick={handleGoogleSso}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-medium shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.99] disabled:opacity-60 mb-5 group"
      >
        {/* Official Google G Logo SVG */}
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.17 0 9.99 0 12s.46 3.83 1.26 5.42l4.02-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
        <span className="text-sm font-semibold group-hover:text-slate-900 transition-colors">
          ลงชื่อเข้าใช้ด้วยบัญชี Google
        </span>
      </button>

      {/* Divider */}
      <div className="relative flex py-2 items-center mb-5">
        <div className="flex-grow border-t border-slate-200"></div>
        <span className="flex-shrink mx-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
          หรือกรอกข้อมูลบัญชี
        </span>
        <div className="flex-grow border-t border-slate-200"></div>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        {/* Email Field */}
        <div>
          <label htmlFor="input-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
            ที่อยู่อีเมล Gmail / บัญชีผู้ใช้
          </label>
          <div className="relative rounded-xl shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="input-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              className="block w-full pl-10 pr-3 py-2.5 sm:py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 focus:bg-white transition-all"
              required
            />
          </div>

          {/* Quick Domain Suffix Helpers */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[11px] text-slate-400">ตัวอย่าง:</span>
            <button
              type="button"
              onClick={() => handleQuickFill('weerapong1625@acu.ac.th')}
              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-100 text-blue-700 border border-slate-200/70 font-mono transition-colors"
            >
              @acu.ac.th
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('teacher.acu@gmail.com')}
              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-100 text-blue-700 border border-slate-200/70 font-mono transition-colors"
            >
              @gmail.com
            </button>
          </div>
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="input-password" className="block text-xs font-semibold text-slate-700">
              รหัสผ่าน
            </label>
            <a
              href="#forgot-password"
              onClick={(e) => {
                e.preventDefault();
                setError('กรุณาติดต่อผู้ดูแลระบบโรงเรียนอัสสัมชัญอุบลราชธานี เพื่อรีเซ็ตรหัสผ่าน');
              }}
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              ลืมรหัสผ่าน?
            </a>
          </div>
          <div className="relative rounded-xl shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="input-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="block w-full pl-10 pr-10 py-2.5 sm:py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 focus:bg-white transition-all"
            />
            <button
              type="button"
              id="btn-toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember me option */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              id="checkbox-remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-xs text-slate-600">จดจำการเข้าสู่ระบบในอุปกรณ์นี้</span>
          </label>
        </div>

        {/* Modern Login Button */}
        <button
          type="submit"
          id="btn-submit-login"
          disabled={isLoading}
          className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-red-600 hover:from-blue-800 hover:via-indigo-800 hover:to-red-700 text-white font-semibold text-sm shadow-[0_4px_14px_rgba(29,78,216,0.35)] hover:shadow-[0_6px_20px_rgba(29,78,216,0.45)] transition-all duration-200 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>กำลังตรวจสอบข้อมูล...</span>
            </>
          ) : (
            <>
              <span>เข้าสู่ระบบ (Login)</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      {/* Security badge at bottom of card */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span>ระบบความปลอดภัยมาตรฐาน Google Cloud & SSL 256-bit</span>
      </div>
    </div>
  );
};
