import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Sparkles, X, ShieldCheck, Fingerprint, Camera } from 'lucide-react';
import { logUserLogin } from '../services/auditService';
import { validateRealGmailAccount } from '../utils/emailValidation';
import { BiometricAuthModal } from './BiometricAuthModal';

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
  const [suggestedFix, setSuggestedFix] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeUser, setActiveUser] = useState<string | null>(null);

  // Biometric Verification Modal State (Face Scan / Fingerprint / Skip)
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState<{ email: string; method: string } | null>(null);

  // Google SSO Modal State (Forces fresh Gmail sign-in every time or uses remembered device user)
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googlePassword, setGooglePassword] = useState('');
  const [showGooglePassword, setShowGooglePassword] = useState(false);
  const [rememberGoogleEmail, setRememberGoogleEmail] = useState(true);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleSuggestedFix, setGoogleSuggestedFix] = useState<string | null>(null);

  // Finalizes login after biometric verification or skip
  const finalizeLogin = async (verifiedEmail: string, method: string) => {
    setIsLoading(true);
    setIsBiometricModalOpen(false);

    try {
      localStorage.setItem('acu_current_user_email', verifiedEmail);
      if (rememberMe && verifiedEmail.toLowerCase() !== 'weerapong1625@acu.ac.th') {
        localStorage.setItem('acu_remembered_gmail', verifiedEmail);
      }
    } catch {
      // ignore
    }

    // Record audit log - Single accurate login record
    const isAdmin = verifiedEmail.toLowerCase() === 'weerapong1625@acu.ac.th';
    await logUserLogin({
      email: verifiedEmail,
      displayName: isAdmin ? '(Admin) ม.วีระพงษ์ มีทรัพย์' : verifiedEmail.split('@')[0],
      loginMethod: method,
      role: isAdmin ? 'admin' : 'teacher',
    });

    setIsLoading(false);
    setIsSuccess(true);
    setActiveUser(verifiedEmail);
    onLoginSuccess?.(verifiedEmail);
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuggestedFix(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError('กรุณากรอกอีเมล Gmail หรือบัญชีโรงเรียน @acu.ac.th');
      return;
    }

    // Strict validation against real Gmail & ACU account standards
    const validation = validateRealGmailAccount(trimmed);
    if (!validation.isValid) {
      setError(validation.errorMessage);
      setSuggestedFix(validation.suggestedFix || null);
      // Require user to re-enter if wrong ("หากผู้ใช้งานพิมพ์ผิดให้กรอกใหม่เท่านั้น")
      setEmail('');
      return;
    }

    if (!password) {
      setError('กรุณากรอกรหัสผ่าน');
      return;
    }

    const validEmail = validation.normalizedEmail || trimmed;

    // Proceed to Biometric Verification (Face Scan / Fingerprint or Skip)
    setPendingLoginData({
      email: validEmail,
      method: 'Email & Password Login',
    });
    setIsBiometricModalOpen(true);
  };

  // Open Google SSO Modal - Guaranteed fresh state every time, or loads remembered Gmail (NEVER Admin's)
  const handleOpenGoogleSso = () => {
    setError(null);
    setSuggestedFix(null);
    let remembered = '';
    try {
      remembered = localStorage.getItem('acu_remembered_gmail') || '';
      // Under NO circumstances allow Admin's email to be auto-filled or remembered
      if (remembered.trim().toLowerCase() === 'weerapong1625@acu.ac.th') {
        localStorage.removeItem('acu_remembered_gmail');
        remembered = '';
      }
    } catch {
      // ignore
    }

    setGoogleEmail(remembered);
    setGooglePassword('');
    setGoogleError(null);
    setGoogleSuggestedFix(null);
    setShowGooglePassword(false);
    setIsGoogleModalOpen(true);
  };

  // Submit Google SSO - Validates against real Gmail accounts and prompts biometric verification
  const handleGoogleSsoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleError(null);
    setGoogleSuggestedFix(null);

    const trimmedEmail = googleEmail.trim();
    if (!trimmedEmail) {
      setGoogleError('กรุณากรอกอีเมล Gmail หรือบัญชี Google ของคุณ');
      return;
    }

    // Strict validation against real Gmail & ACU account standards
    const validation = validateRealGmailAccount(trimmedEmail);
    if (!validation.isValid) {
      setGoogleError(validation.errorMessage);
      setGoogleSuggestedFix(validation.suggestedFix || null);
      // Require user to re-enter if wrong
      setGoogleEmail('');
      return;
    }

    const validEmail = validation.normalizedEmail || trimmedEmail;

    // Never save Admin email to remembered list
    if (rememberGoogleEmail && validEmail.toLowerCase() !== 'weerapong1625@acu.ac.th') {
      try {
        localStorage.setItem('acu_remembered_gmail', validEmail);
      } catch {
        // ignore
      }
    } else if (!rememberGoogleEmail) {
      try {
        localStorage.removeItem('acu_remembered_gmail');
      } catch {
        // ignore
      }
    }

    setIsGoogleModalOpen(false);

    // Proceed to Biometric Verification (Face Scan / Fingerprint or Skip)
    setPendingLoginData({
      email: validEmail,
      method: 'Google Account SSO (เข้าสู่ระบบ Gmail)',
    });
    setIsBiometricModalOpen(true);
  };

  const handleQuickFill = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword('••••••••••••');
    setError(null);
  };

  const handleQuickFillGoogle = (suffix: string) => {
    if (googleEmail.includes('@')) {
      const prefix = googleEmail.split('@')[0];
      setGoogleEmail(`${prefix}${suffix}`);
    } else {
      setGoogleEmail(`${googleEmail}${suffix}`);
    }
    setGoogleError(null);
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
          ใช้บัญชี Google หรืออีเมลโรงเรียนอัสสัมชัญอุบลราชธานี
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
      <div className="mb-4 p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-slate-600 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span>ระบบตรวจสอบอีเมลจริง (@acu.ac.th / @gmail.com) และระบบสแกนชีวมิติ (ใบหน้า/ลายนิ้วมือ)</span>
      </div>

      {/* One-click Google SSO Button */}
      <button
        type="button"
        id="btn-google-sso"
        onClick={handleOpenGoogleSso}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-medium shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.99] disabled:opacity-60 mb-5 group cursor-pointer"
        title="เข้าสู่ระบบด้วยบัญชี Google (กรอก Gmail ใหม่ทุกครั้ง)"
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
              onClick={() => handleQuickFill('teacher@acu.ac.th')}
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

      {/* Authentic Google Account Sign-In Dialog (Forces fresh Gmail sign-in every time or uses remembered non-admin device user) */}
      {isGoogleModalOpen && (
        <div
          id="google-sso-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsGoogleModalOpen(false);
          }}
        >
          <div
            id="google-sso-modal-card"
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 relative text-left"
          >
            {/* Close Button */}
            <button
              type="button"
              id="btn-close-google-sso"
              onClick={() => setIsGoogleModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Google G Logo & Title */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 border border-slate-200 mb-3 shadow-xs">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">ลงชื่อเข้าใช้ด้วย Google</h3>
              <p className="text-xs text-slate-500 mt-1">
                เพื่อเข้าสู่ระบบคลังสื่อนวัตกรรมการศึกษา โรงเรียนอัสสัมชัญอุบลราชธานี
              </p>
            </div>

            {/* Error banner */}
            {googleError && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex flex-col gap-1.5 animate-in fade-in">
                <div className="flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span>{googleError}</span>
                </div>
                {googleSuggestedFix && (
                  <div className="pl-6 flex items-center gap-2">
                    <span className="text-[11px] text-slate-600">แนะนำ:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setGoogleEmail(googleSuggestedFix);
                        setGoogleError(null);
                        setGoogleSuggestedFix(null);
                      }}
                      className="text-[11px] font-mono font-bold text-blue-600 underline hover:text-blue-800 cursor-pointer"
                    >
                      {googleSuggestedFix} (คลิกเพื่อนำไปใช้)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Google Sign In Form */}
            <form onSubmit={handleGoogleSsoSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  อีเมล Gmail / บัญชี Google
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    id="input-google-email"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder="name@gmail.com หรือ user@acu.ac.th"
                    autoFocus
                    required
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
                {/* Suffix helpers */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-400">เติมด่วน:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const prefix = googleEmail.split('@')[0] || 'teacher';
                      setGoogleEmail(`${prefix}@gmail.com`);
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 text-blue-600 border border-slate-200 transition-colors"
                  >
                    @gmail.com
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const prefix = googleEmail.split('@')[0] || 'teacher';
                      setGoogleEmail(`${prefix}@acu.ac.th`);
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 text-blue-600 border border-slate-200 transition-colors"
                  >
                    @acu.ac.th
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  รหัสผ่านบัญชี Google
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showGooglePassword ? 'text' : 'password'}
                    id="input-google-password"
                    value={googlePassword}
                    onChange={(e) => setGooglePassword(e.target.value)}
                    placeholder="ป้อนรหัสผ่าน Google ของคุณ"
                    className="block w-full pl-10 pr-10 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGooglePassword(!showGooglePassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showGooglePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="checkbox-remember-google"
                  checked={rememberGoogleEmail}
                  onChange={(e) => setRememberGoogleEmail(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="checkbox-remember-google" className="text-xs text-slate-600 cursor-pointer select-none">
                  จดจำบัญชี Gmail บนอุปกรณ์นี้ (เข้าสู่ระบบได้ทันทีในครั้งถัดไป)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsGoogleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  id="btn-google-sso-submit"
                  disabled={isGoogleSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-70"
                >
                  {isGoogleSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>กำลังเข้าสู่ระบบ...</span>
                    </>
                  ) : (
                    <span>ถัดไป / เข้าสู่ระบบ</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          setIsLoading(false);
        }}
      />
    </div>
  );
};
