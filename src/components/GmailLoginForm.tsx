import React, { useState } from 'react';
import { Mail, ArrowRight, CheckCircle2, AlertCircle, Sparkles, ShieldCheck, UserPlus } from 'lucide-react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider, createAcuGoogleProvider } from '../firebase';
import { getCachedUserProfile, setCachedUserProfile } from '../services/userProfileService';
import { validateRealGmailAccount } from '../utils/emailValidation';

interface GmailLoginFormProps {
  onLoginSuccess?: (email: string) => void;
}

export const GmailLoginForm: React.FC<GmailLoginFormProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedFix, setSuggestedFix] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeUser, setActiveUser] = useState<string | null>(null);

  const finalizeLogin = (verifiedEmail: string) => {
    try {
      localStorage.setItem('acu_current_user_email', verifiedEmail);
      if (rememberMe && verifiedEmail.toLowerCase() !== 'weerapong1625@acu.ac.th') {
        localStorage.setItem('acu_remembered_gmail', verifiedEmail);
      }
    } catch {
      // ignore
    }

    setIsLoading(false);
    setIsSuccess(true);
    setActiveUser(verifiedEmail);
    onLoginSuccess?.(verifiedEmail);
  };

  // Core authentic Google OAuth popup flow:
  // - Opens Google's real account chooser automatically (prompt=select_account, hd=acu.ac.th)
  // - Allows selecting existing Google @acu.ac.th account or adding a real Google account + real Google password
  // - Strictly rejects non-@acu.ac.th or unverified accounts
  const authenticateWithGooglePopup = async (loginHint?: string) => {
    setError(null);
    setSuggestedFix(null);
    setIsLoading(true);

    try {
      const provider = loginHint ? createAcuGoogleProvider(loginHint) : googleAuthProvider;
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      const userEmail = (googleUser.email || '').toLowerCase().trim();

      if (!userEmail) {
        await signOut(auth).catch(() => {});
        setError('ไม่พบข้อมูลอีเมลจากบัญชี Google กรุณาลองใหม่อีกครั้ง');
        setIsLoading(false);
        return;
      }

      // Strictly enforce @acu.ac.th domain only
      if (!userEmail.endsWith('@acu.ac.th')) {
        await signOut(auth).catch(() => {});
        setError(
          `บัญชี "${userEmail}" ไม่ใช่โดเมน @acu.ac.th ระบบรองรับเฉพาะอีเมลของโรงเรียนอัสสัมชัญอุบลราชธานี (@acu.ac.th) ที่มีบัญชี Google จริงเท่านั้น กรุณาเลือกหรือเพิ่มบัญชี @acu.ac.th`
        );
        setIsLoading(false);
        return;
      }

      // Require Google-verified account
      if (googleUser.emailVerified === false) {
        await signOut(auth).catch(() => {});
        setError(
          `บัญชี "${userEmail}" ยังไม่ได้รับการยืนยันจาก Google กรุณาใช้บัญชี Google ที่ยืนยันตัวตนแล้วเท่านั้น`
        );
        setIsLoading(false);
        return;
      }

      // Sync authentic Google display name & photo URL into local profile cache
      if (googleUser.displayName || googleUser.photoURL) {
        try {
          const cached = getCachedUserProfile(userEmail);
          if (cached) {
            if (googleUser.photoURL && !cached.avatarUrl) {
              cached.avatarUrl = googleUser.photoURL;
            }
            if (googleUser.displayName && (!cached.fullName || cached.fullName === userEmail.split('@')[0])) {
              cached.fullName = googleUser.displayName;
              cached.displayName = googleUser.displayName;
            }
            setCachedUserProfile(cached);
          }
          if (googleUser.photoURL) {
            const avatarKey = `acu_user_avatar_${userEmail}`;
            if (!localStorage.getItem(avatarKey)) {
              localStorage.setItem(avatarKey, googleUser.photoURL);
            }
          }
        } catch {
          // ignore
        }
      }

      finalizeLogin(userEmail);
    } catch (err: any) {
      console.warn('Google Sign-In notice:', err);
      setIsLoading(false);

      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return;
      }

      if (err?.code === 'auth/popup-blocked') {
        setError(
          'เบราว์เซอร์บล็อกหน้าต่างเลือกบัญชี Google กรุณาอนุญาตป๊อปอัป (Pop-ups) สำหรับเว็บไซต์นี้ แล้วกดปุ่ม "ลงชื่อเข้าใช้ด้วยบัญชี Google" อีกครั้ง'
        );
        return;
      }

      if (err?.code === 'auth/unauthorized-domain') {
        setError(
          'โดเมนของเว็บไซต์นี้ยังไม่ได้รับอนุญาตใน Firebase Authentication กรุณาตรวจสอบการตั้งค่า Authorized Domains'
        );
        return;
      }

      if (err?.code === 'auth/network-request-failed') {
        setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ Google ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่');
        return;
      }

      if (err?.code === 'auth/user-disabled') {
        setError('บัญชี Google นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบโรงเรียน');
        return;
      }

      setError(err?.message || 'ไม่สามารถยืนยันบัญชี Google ได้ กรุณาใช้บัญชี Google @acu.ac.th ที่มีอยู่จริงเท่านั้น');
    }
  };

  // Launch native Google Account Chooser popup ("เด้งไปยังบัญชี Google E-mail ของผู้ใช้งานโดยอัตโนมัติ หรือเพิ่มบัญชี")
  const handleGoogleSignInDirect = () => {
    void authenticateWithGooglePopup();
  };

  // Validate typed @acu.ac.th email and trigger real Google Sign-In pre-filled with that account
  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuggestedFix(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError('กรุณากรอกอีเมลบัญชีโรงเรียนโดเมน @acu.ac.th หรือกดปุ่ม "ลงชื่อเข้าใช้ด้วยบัญชี Google" ด้านบน');
      return;
    }

    // Strict validation: ONLY @acu.ac.th allowed
    const validation = validateRealGmailAccount(trimmed);
    if (!validation.isValid) {
      setError(validation.errorMessage);
      setSuggestedFix(validation.suggestedFix || null);
      return;
    }

    const validEmail = validation.normalizedEmail || trimmed.toLowerCase();
    // Must authenticate with real Google E-mail & Password via Google OAuth
    void authenticateWithGooglePopup(validEmail);
  };

  const handleAppendDomain = () => {
    const suffix = '@acu.ac.th';
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
  };

  const handleReset = () => {
    setIsSuccess(false);
    setActiveUser(null);
    setEmail('');
    signOut(auth).catch(() => {});
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
          <span className="text-xs text-slate-400 block mb-1">บัญชี Google ที่ยืนยันตัวตนแล้ว</span>
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
          ลงชื่อเข้าใช้ด้วยบัญชี Google
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          รองรับเฉพาะอีเมลโรงเรียนอัสสัมชัญอุบลราชธานี (<span className="font-mono font-semibold text-blue-700">@acu.ac.th</span>) ที่มีบัญชี Google จริงเท่านั้น
        </p>
      </div>

      {/* Error notification */}
      {error && (
        <div
          id="login-error-alert"
          className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex flex-col gap-1.5 animate-in fade-in"
        >
          <div className="flex items-start gap-2 font-medium leading-relaxed">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
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
      <div className="mb-4 p-3 rounded-xl bg-blue-50/80 border border-blue-100 text-[11px] text-slate-700 flex items-start gap-2 leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <span>
          ตรวจสอบตัวตนผ่านบัญชี Google จริงโดยตรง (E-mail และรหัสผ่านต้องเป็นบัญชี <strong>@acu.ac.th</strong> ที่ลงทะเบียนกับ Google แล้วเท่านั้น)
        </span>
      </div>

      {/* One-click Google SSO Button -> Auto-opens Google Account Chooser & Add Account */}
      <button
        type="button"
        id="btn-google-sso"
        onClick={handleGoogleSignInDirect}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-white border-2 border-slate-200 hover:border-blue-500 text-slate-800 font-semibold shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.99] disabled:opacity-60 mb-2.5 group cursor-pointer"
        title="กดเพื่อเปิดหน้าเลือกบัญชี Google หรือเพิ่มบัญชี @acu.ac.th ที่ใช้งานจริง"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
        ) : (
          /* Official Google G Logo SVG */
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
        )}
        <span className="text-sm font-bold group-hover:text-blue-700 transition-colors">
          {isLoading ? 'กำลังเชื่อมต่อไปยังบัญชี Google...' : 'ลงชื่อเข้าใช้ด้วยบัญชี Google (@acu.ac.th)'}
        </span>
      </button>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 mb-5">
        <UserPlus className="w-3.5 h-3.5 text-blue-500" />
        <span>กดปุ่มด้านบนเพื่อเลือกบัญชี Google ของคุณอัตโนมัติ หรือกดเพิ่มบัญชีใหม่ได้ทันที</span>
      </div>

      {/* Divider */}
      <div className="relative flex py-2 items-center mb-4">
        <div className="flex-grow border-t border-slate-200"></div>
        <span className="flex-shrink mx-3 text-[11px] font-medium text-slate-400">
          หรือระบุอีเมล @acu.ac.th เพื่อยืนยันผ่าน Google
        </span>
        <div className="flex-grow border-t border-slate-200"></div>
      </div>

      {/* Form for targeted @acu.ac.th account sign-in via real Google OAuth */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <label htmlFor="input-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
            ที่อยู่อีเมลโรงเรียน (<span className="font-mono text-blue-700">@acu.ac.th</span> เท่านั้น)
          </label>
          <div className="relative rounded-xl shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="input-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
                if (suggestedFix) setSuggestedFix(null);
              }}
              placeholder="username@acu.ac.th"
              className="block w-full pl-10 pr-3 py-2.5 sm:py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 focus:bg-white transition-all"
              required
            />
          </div>

          {/* Quick Domain Suffix Helper (@acu.ac.th only) */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">เติมโดเมน:</span>
              <button
                type="button"
                onClick={handleAppendDomain}
                className="text-[11px] px-2.5 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-mono font-semibold transition-colors cursor-pointer"
              >
                @acu.ac.th
              </button>
            </div>
            <span className="text-[11px] text-slate-400">
              ยืนยันรหัสผ่านกับ Google จริง
            </span>
          </div>
        </div>

        {/* Remember me option */}
        <div className="flex items-center justify-between pt-0.5">
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

        {/* Submit Button -> Opens Google Auth directly for that @acu.ac.th email */}
        <button
          type="submit"
          id="btn-submit-login"
          disabled={isLoading}
          className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-red-600 hover:from-blue-800 hover:via-indigo-800 hover:to-red-700 text-white font-semibold text-sm shadow-[0_4px_14px_rgba(29,78,216,0.35)] hover:shadow-[0_6px_20px_rgba(29,78,216,0.45)] transition-all duration-200 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2 mt-1 cursor-pointer"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>กำลังเชื่อมต่อบัญชี Google...</span>
            </>
          ) : (
            <>
              <span>ยืนยันบัญชีและรหัสผ่านกับ Google</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      {/* Security badge at bottom of card */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span>ตรวจสอบบัญชี Google จริง (@acu.ac.th) มาตรฐาน SSL 256-bit</span>
      </div>
    </div>
  );
};

