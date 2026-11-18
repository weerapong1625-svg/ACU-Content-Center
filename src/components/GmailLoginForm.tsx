import React, { useState, useRef } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { validateRealGmailAccount } from '../utils/emailValidation';
import { verifyEmailPassword } from '../services/authCredentialService';
import { BiometricAuthModal } from './BiometricAuthModal';

interface GmailLoginFormProps {
  onLoginSuccess?: (email: string, loginMethod?: string) => void;
}

const SUPER_ADMIN_EMAIL_LOWER = 'weerapong1625@acu.ac.th';

export const GmailLoginForm: React.FC<GmailLoginFormProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedFix, setSuggestedFix] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeUser, setActiveUser] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);

  // Biometric Verification Modal State (Face Scan / Fingerprint / Skip)
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState<{ email: string; method: string } | null>(null);

  // Finalizes login after biometric verification or skip
  const finalizeLogin = async (verifiedEmail: string, method: string) => {
    const norm = verifiedEmail.toLowerCase().trim();
    setIsLoading(true);
    setIsBiometricModalOpen(false);
    setPendingLoginData(null);

    try {
      localStorage.setItem('acu_current_user_email', norm);
      if (rememberMe && norm !== SUPER_ADMIN_EMAIL_LOWER) {
        localStorage.setItem('acu_remembered_gmail', norm);
      } else if (!rememberMe) {
        const currentRem = (localStorage.getItem('acu_remembered_gmail') || '').toLowerCase().trim();
        if (currentRem === norm) {
          localStorage.removeItem('acu_remembered_gmail');
        }
      }
    } catch {
      // ignore
    }

    setIsLoading(false);
    setIsSuccess(true);
    setActiveUser(norm);
    onLoginSuccess?.(norm, method);
  };

  // Direct Email & Password login handler
  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuggestedFix(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError('กรุณากรอกอีเมล Gmail หรือบัญชีโรงเรียน @acu.ac.th');
      return;
    }

    const validation = validateRealGmailAccount(trimmed);
    if (!validation.isValid) {
      setError(validation.errorMessage);
      setSuggestedFix(validation.suggestedFix || null);
      return;
    }

    if (!password) {
      setError('กรุณากรอกรหัสผ่าน');
      return;
    }

    const validEmail = (validation.normalizedEmail || trimmed).toLowerCase().trim();

    const passCheck = verifyEmailPassword(validEmail, password);
    if (!passCheck.isValid) {
      setError(passCheck.errorMessage);
      setPassword('');
      return;
    }

    // Proceed to Biometric Verification (Face Scan / Fingerprint or Skip)
    setPendingLoginData({
      email: validEmail,
      method: 'Email & Password Login',
    });
    setIsBiometricModalOpen(true);
  };

  const handleAppendDomain = (suffix: string) => {
    if (email.includes('@')) {
      const prefix = email.split('@')[0];
      setEmail(`${prefix}${suffix}`);
    } else if (email.trim()) {
      setEmail(`${email.trim()}${suffix}`);
    } else {
      setEmail(suffix);
    }
    setError(null);
    setSuggestedFix(null);
    emailInputRef.current?.focus();
  };

  const handleReset = () => {
    setIsSuccess(false);
    setActiveUser(null);
    setEmail('');
    setPassword('');
    try {
      localStorage.removeItem('acu_current_user_email');
    } catch {
      // ignore
    }
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
            onClick={() => onLoginSuccess?.(activeUser)}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white font-medium hover:from-blue-800 hover:to-indigo-900 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
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
          กรอกที่อยู่อีเมล Gmail หรือบัญชีโรงเรียนอัสสัมชัญอุบลราชธานี
        </p>
      </div>

      {/* Error notification */}
      {error && (
        <div
          id="login-error-alert"
          className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex flex-col gap-1.5 animate-in fade-in"
        >
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          {suggestedFix && (
            <div className="pl-6 flex items-center gap-2">
              <span className="text-[11px] text-slate-600">แนะนำ:</span>
              <button
                type="button"
                onClick={() => {
                  setEmail(suggestedFix);
                  setError(null);
                  setSuggestedFix(null);
                }}
                className="text-[11px] font-mono font-bold text-blue-600 underline hover:text-blue-800 cursor-pointer"
              >
                {suggestedFix} (คลิกเพื่อนำไปใช้)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Security validation badge */}
      <div className="mb-5 p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-slate-600 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span>ระบบตรวจสอบอีเมลจริง (@acu.ac.th / @gmail.com) และระบบสแกนชีวมิติ (ใบหน้า/ลายนิ้วมือ)</span>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleEmailLogin} noValidate className="space-y-4">
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
              ref={emailInputRef}
              id="input-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
                if (suggestedFix) setSuggestedFix(null);
              }}
              placeholder="example@gmail.com"
              className="block w-full pl-10 pr-3 py-2.5 sm:py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 focus:bg-white transition-all"
              required
            />
          </div>

          {/* Quick Domain Suffix Helpers */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[11px] text-slate-400">เติมโดเมนด่วน:</span>
            <button
              type="button"
              onClick={() => handleAppendDomain('@acu.ac.th')}
              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-100 text-blue-700 border border-slate-200/70 font-mono transition-colors cursor-pointer"
            >
              @acu.ac.th
            </button>
            <button
              type="button"
              onClick={() => handleAppendDomain('@gmail.com')}
              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-100 text-blue-700 border border-slate-200/70 font-mono transition-colors cursor-pointer"
            >
              @gmail.com
            </button>
          </div>
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="input-password" className="block text-xs font-semibold text-slate-700">
              รหัสผ่านบัญชีอีเมลตนเอง
            </label>
            <a
              href="#forgot-password"
              onClick={(e) => {
                e.preventDefault();
                setError('กรุณาติดต่อผู้ดูแลระบบโรงเรียนอัสสัมชัญอุบลราชธานี เพื่อตรวจสอบสิทธิ์หรือรีเซ็ตรหัสผ่าน');
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="กรอกรหัสผ่านอีเมลตนเอง..."
              className="block w-full pl-10 pr-10 py-2.5 sm:py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 focus:bg-white transition-all"
            />
            <button
              type="button"
              id="btn-toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-0.5">
            <span className="text-[11px] text-slate-500">
              ใช้รหัสผ่านของบัญชีอีเมลตนเองเท่านั้น (อ้างอิงจาก Gmail / Google จริง)
            </span>
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
          className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-red-600 hover:from-blue-800 hover:via-indigo-800 hover:to-red-700 text-white font-semibold text-sm shadow-[0_4px_14px_rgba(29,78,216,0.35)] hover:shadow-[0_6px_20px_rgba(29,78,216,0.45)] transition-all duration-200 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2 mt-2 cursor-pointer"
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

      {/* Biometric Security Verification Modal (Face Scan / Fingerprint / Skip) */}
      <BiometricAuthModal
        isOpen={isBiometricModalOpen}
        userEmail={pendingLoginData?.email || ''}
        onSuccess={() => {
          if (pendingLoginData) {
            finalizeLogin(pendingLoginData.email, pendingLoginData.method);
          }
        }}
        onSkip={() => {
          if (pendingLoginData) {
            finalizeLogin(pendingLoginData.email, pendingLoginData.method);
          }
        }}
        onClose={() => {
          setIsBiometricModalOpen(false);
          setPendingLoginData(null);
          setIsLoading(false);
        }}
      />
    </div>
  );
};
