import React, { useState, useRef, useEffect } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  ShieldCheck,
  UserPlus,
  ExternalLink,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth, createGoogleAuthProvider } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  fetchFullUserProfile,
  getCachedUserProfile,
  saveFullUserProfile,
  setCachedUserProfile,
} from '../services/userProfileService';
import { validateRealGmailAccount } from '../utils/emailValidation';
import { verifyEmailPassword } from '../services/authCredentialService';
import { BiometricAuthModal } from './BiometricAuthModal';

interface GmailLoginFormProps {
  onLoginSuccess?: (email: string, loginMethod?: string) => void;
}

interface SavedGoogleAccount {
  email: string;
  displayName?: string;
  photoURL?: string;
  lastUsedAt?: string;
}

const SAVED_GOOGLE_ACCOUNTS_KEY = 'acu_saved_google_accounts';
const SUPER_ADMIN_EMAIL_LOWER = 'weerapong1625@acu.ac.th';

function readSavedGoogleAccounts(): SavedGoogleAccount[] {
  if (typeof window === 'undefined') return [];
  const map = new Map<string, SavedGoogleAccount>();

  try {
    const raw = localStorage.getItem(SAVED_GOOGLE_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const norm = typeof item?.email === 'string' ? item.email.toLowerCase().trim() : '';
          if (norm && norm !== SUPER_ADMIN_EMAIL_LOWER) {
            const cached = getCachedUserProfile(norm);
            map.set(norm, {
              email: norm,
              displayName: cached?.fullName || item.displayName || norm.split('@')[0],
              photoURL: cached?.avatarUrl || item.photoURL || '',
              lastUsedAt: item.lastUsedAt,
            });
          }
        }
      }
    }
  } catch {
    // ignore corrupted storage
  }

  try {
    const remembered = (localStorage.getItem('acu_remembered_gmail') || '').toLowerCase().trim();
    if (remembered && remembered !== SUPER_ADMIN_EMAIL_LOWER && !map.has(remembered)) {
      const cached = getCachedUserProfile(remembered);
      map.set(remembered, {
        email: remembered,
        displayName: cached?.fullName || remembered.split('@')[0],
        photoURL: cached?.avatarUrl || '',
      });
    }
  } catch {
    // ignore
  }

  return Array.from(map.values());
}

function saveGoogleAccountToDevice(account: SavedGoogleAccount): void {
  if (typeof window === 'undefined') return;
  const norm = (account.email || '').toLowerCase().trim();
  if (!norm || norm === SUPER_ADMIN_EMAIL_LOWER) return;

  try {
    const existing = readSavedGoogleAccounts().filter((a) => a.email !== norm);
    const updated: SavedGoogleAccount[] = [
      {
        email: norm,
        displayName: account.displayName || norm.split('@')[0],
        photoURL: account.photoURL || '',
        lastUsedAt: new Date().toISOString(),
      },
      ...existing,
    ].slice(0, 8);
    localStorage.setItem(SAVED_GOOGLE_ACCOUNTS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function removeGoogleAccountFromDevice(emailToRemove: string): SavedGoogleAccount[] {
  const norm = emailToRemove.toLowerCase().trim();
  const remaining = readSavedGoogleAccounts().filter((a) => a.email !== norm);
  try {
    localStorage.setItem(SAVED_GOOGLE_ACCOUNTS_KEY, JSON.stringify(remaining));
    const remembered = (localStorage.getItem('acu_remembered_gmail') || '').toLowerCase().trim();
    if (remembered === norm) {
      localStorage.removeItem('acu_remembered_gmail');
    }
  } catch {
    // ignore
  }
  return remaining;
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

  const emailInputRef = useRef<HTMLInputElement>(null);
  const googleEmailInputRef = useRef<HTMLInputElement>(null);

  // Biometric Verification Modal State (Face Scan / Fingerprint / Skip)
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState<{ email: string; method: string } | null>(null);

  // Google Account Chooser & Add Account Modal State
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [savedGoogleAccounts, setSavedGoogleAccounts] = useState<SavedGoogleAccount[]>([]);
  const [googleModalView, setGoogleModalView] = useState<'chooser' | 'add'>('chooser');
  const [popupNotice, setPopupNotice] = useState<string | null>(null);
  const [unauthorizedHost, setUnauthorizedHost] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googlePassword, setGooglePassword] = useState('');
  const [showGooglePassword, setShowGooglePassword] = useState(false);
  const [rememberGoogleEmail, setRememberGoogleEmail] = useState(true);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleSuggestedFix, setGoogleSuggestedFix] = useState<string | null>(null);

  // Warm & preserve existing user profile without overwriting existing data
  const preserveAndSyncUserProfile = async (
    userEmail: string,
    googleDisplayName?: string | null,
    googlePhotoURL?: string | null
  ) => {
    const norm = userEmail.toLowerCase().trim();
    try {
      const existing = await fetchFullUserProfile(
        norm,
        googleDisplayName || undefined,
        googlePhotoURL || undefined
      );

      if (existing) {
        let needsSave = false;
        const nextProfile = { ...existing };

        // Preserve any custom uploaded avatar; only fill from Google if empty
        if (googlePhotoURL && !nextProfile.avatarUrl) {
          nextProfile.avatarUrl = googlePhotoURL;
          needsSave = true;
        }

        // Preserve user's edited fullName; only fill from Google if still generic prefix
        const emailPrefix = norm.split('@')[0];
        if (
          googleDisplayName &&
          norm !== SUPER_ADMIN_EMAIL_LOWER &&
          (!nextProfile.fullName || nextProfile.fullName === emailPrefix || nextProfile.fullName === 'คุณครูอัสสัมชัญ')
        ) {
          nextProfile.fullName = googleDisplayName;
          nextProfile.displayName = googleDisplayName;
          needsSave = true;
        }

        setCachedUserProfile(nextProfile);
        if (nextProfile.avatarUrl) {
          try {
            localStorage.setItem(`acu_user_avatar_${norm}`, nextProfile.avatarUrl);
          } catch {
            // ignore
          }
        }

        if (needsSave) {
          await saveFullUserProfile(nextProfile);
        }

        return nextProfile;
      }
    } catch {
      // Never block login if offline or Firestore quota reached
    }
    return getCachedUserProfile(norm);
  };

  // Finalizes login and passes accurate login method
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

  // Handle returning from signInWithRedirect (for standalone/mobile browsers on other devices)
  useEffect(() => {
    let isMounted = true;
    getRedirectResult(auth)
      .then(async (result) => {
        if (!isMounted || !result?.user?.email) return;
        const userEmail = result.user.email.toLowerCase().trim();
        setIsLoading(true);
        const syncedProfile = await preserveAndSyncUserProfile(
          userEmail,
          result.user.displayName,
          result.user.photoURL
        );
        saveGoogleAccountToDevice({
          email: userEmail,
          displayName: syncedProfile?.fullName || result.user.displayName || userEmail.split('@')[0],
          photoURL: syncedProfile?.avatarUrl || result.user.photoURL || '',
        });
        if (isMounted) {
          await finalizeLogin(userEmail, 'Google Account SSO (เข้าสู่ระบบด้วย Google)');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Google Redirect Result notice:', err?.code || err);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Direct Email & Password login handler (preserved fully)
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

  // Open Google Account Chooser / Add Account fallback dialog
  const handleOpenGoogleChooser = (
    notice?: string | null,
    forceAddView?: boolean,
    unauthHost?: string | null
  ) => {
    setError(null);
    setSuggestedFix(null);
    const accounts = readSavedGoogleAccounts();
    setSavedGoogleAccounts(accounts);

    // Ensure Admin email is never remembered in local chooser
    try {
      const remembered = (localStorage.getItem('acu_remembered_gmail') || '').toLowerCase().trim();
      if (remembered === SUPER_ADMIN_EMAIL_LOWER) {
        localStorage.removeItem('acu_remembered_gmail');
      }
    } catch {
      // ignore
    }

    setPopupNotice(notice || null);
    setUnauthorizedHost(unauthHost || null);
    setGoogleModalView(forceAddView || accounts.length === 0 ? 'add' : 'chooser');
    setGoogleEmail('');
    setGooglePassword('');
    setGoogleError(null);
    setGoogleSuggestedFix(null);
    setShowGooglePassword(false);
    setIsGoogleModalOpen(true);
  };

  // Direct Google Identity Services (accounts.google.com) OAuth popup fallback
  const attemptGisGoogleSignIn = (loginHint?: string): Promise<'success' | 'cancelled' | 'unavailable'> => {
    return new Promise((resolve) => {
      const googleOAuth2 = typeof window !== 'undefined' ? (window as any).google?.accounts?.oauth2 : null;
      const clientId = (firebaseConfig as any)?.oAuthClientId;
      if (!googleOAuth2 || !clientId) {
        resolve('unavailable');
        return;
      }

      let settled = false;
      const done = (status: 'success' | 'cancelled' | 'unavailable') => {
        if (!settled) {
          settled = true;
          resolve(status);
        }
      };

      try {
        const tokenClient = googleOAuth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          prompt: 'select_account',
          ...(loginHint && loginHint.trim() ? { login_hint: loginHint.trim().toLowerCase() } : {}),
          callback: async (tokenResponse: any) => {
            if (!tokenResponse?.access_token) {
              done('unavailable');
              return;
            }
            try {
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                  Authorization: `Bearer ${tokenResponse.access_token}`,
                },
              });
              if (!userInfoRes.ok) {
                done('unavailable');
                return;
              }
              const userInfo = await userInfoRes.json();
              const userEmail = typeof userInfo?.email === 'string' ? userInfo.email.toLowerCase().trim() : '';
              if (!userEmail) {
                done('unavailable');
                return;
              }

              // Link Firebase Auth session silently if supported on this domain
              try {
                const credential = GoogleAuthProvider.credential(null, tokenResponse.access_token);
                await signInWithCredential(auth, credential);
              } catch {
                // Proceed even if domain is not in Firebase Authorized Domains
              }

              const syncedProfile = await preserveAndSyncUserProfile(
                userEmail,
                userInfo.name || null,
                userInfo.picture || null
              );

              saveGoogleAccountToDevice({
                email: userEmail,
                displayName: syncedProfile?.fullName || userInfo.name || userEmail.split('@')[0],
                photoURL: syncedProfile?.avatarUrl || userInfo.picture || '',
              });

              setIsGoogleModalOpen(false);
              await finalizeLogin(userEmail, 'Google Account SSO (เข้าสู่ระบบด้วย Google)');
              done('success');
            } catch {
              done('unavailable');
            }
          },
          error_callback: (err: any) => {
            if (err?.type === 'popup_closed') {
              done('cancelled');
            } else {
              done('unavailable');
            }
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch {
        done('unavailable');
      }
    });
  };

  // Launch native Google Account Chooser popup (with redirect & GIS support for other devices)
  const attemptNativeGooglePopup = async (
    loginHint?: string
  ): Promise<{ status: 'success' | 'cancelled' | 'redirecting' | 'fallback' | 'error'; code?: string }> => {
    try {
      const provider = createGoogleAuthProvider(loginHint);
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      const userEmail = googleUser.email?.toLowerCase().trim();

      if (!userEmail) {
        setError('ไม่พบอีเมลจากบัญชี Google กรุณาลองใหม่อีกครั้ง');
        return { status: 'error' };
      }

      const syncedProfile = await preserveAndSyncUserProfile(
        userEmail,
        googleUser.displayName,
        googleUser.photoURL
      );

      saveGoogleAccountToDevice({
        email: userEmail,
        displayName: syncedProfile?.fullName || googleUser.displayName || userEmail.split('@')[0],
        photoURL: syncedProfile?.avatarUrl || googleUser.photoURL || '',
      });

      setIsGoogleModalOpen(false);
      await finalizeLogin(userEmail, 'Google Account SSO (เข้าสู่ระบบด้วย Google)');
      return { status: 'success' };
    } catch (err: any) {
      const code = err?.code || '';
      console.warn('Google Sign-In notice:', code || err);

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return { status: 'cancelled', code };
      }

      // On standalone/mobile browsers (not inside iframe), redirect directly to Google Sign-In page if popup was blocked
      const isTopLevelWindow = typeof window !== 'undefined' && window.self === window.top;
      if (
        isTopLevelWindow &&
        (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment')
      ) {
        try {
          const provider = createGoogleAuthProvider(loginHint);
          await signInWithRedirect(auth, provider);
          return { status: 'redirecting', code };
        } catch (redirErr: any) {
          console.warn('Google Redirect fallback notice:', redirErr?.code || redirErr);
        }
      }

      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/unauthorized-domain' ||
        code === 'auth/operation-not-allowed' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/internal-error' ||
        code === 'auth/network-request-failed'
      ) {
        return { status: 'fallback', code };
      }

      setError(err?.message || 'ไม่สามารถเชื่อมต่อบัญชี Google ได้ กรุณาลองใหม่อีกครั้ง');
      return { status: 'error', code };
    }
  };

  // Main Google button click handler
  const handleGoogleSignInDirect = async () => {
    setError(null);
    setSuggestedFix(null);
    setGoogleError(null);
    setIsLoading(true);

    const res = await attemptNativeGooglePopup();
    if (res.status === 'redirecting') {
      return; // Browser is navigating to Google Sign-In page
    }

    if (res.status === 'fallback') {
      // Try direct Google Identity Services (accounts.google.com) if Firebase popup failed (e.g. unauthorized-domain on shared URL)
      const gisStatus = await attemptGisGoogleSignIn();
      setIsLoading(false);

      if (gisStatus === 'success' || gisStatus === 'cancelled') {
        return;
      }

      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      const isUnauthDomain = res.code === 'auth/unauthorized-domain';
      handleOpenGoogleChooser(
        isUnauthDomain
          ? 'โดเมนนี้ยังไม่ได้เปิดสิทธิ์ป๊อปอัป Google ในระบบคลาวด์ คุณสามารถกดปุ่มเปิดหน้าต่าง Google ด้านล่าง หรือเลือก/เพิ่มบัญชี Google เพื่อเข้าใช้งานได้ทันที'
          : 'เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป Google อัตโนมัติ คุณสามารถกดปุ่มเปิดหน้าต่าง Google ด้านล่าง หรือเลือก/เพิ่มบัญชี Google เพื่อเข้าสู่ระบบได้ทันที',
        false,
        isUnauthDomain ? currentHost : null
      );
      return;
    }

    setIsLoading(false);
  };

  // Click a saved Google account from the Account Chooser
  const handleSelectSavedGoogleAccount = async (account: SavedGoogleAccount) => {
    setGoogleError(null);
    setIsGoogleSubmitting(true);
    try {
      const synced = await preserveAndSyncUserProfile(account.email, account.displayName, account.photoURL);
      saveGoogleAccountToDevice({
        email: account.email,
        displayName: synced?.fullName || account.displayName,
        photoURL: synced?.avatarUrl || account.photoURL,
      });
      setIsGoogleModalOpen(false);
      await finalizeLogin(account.email, 'Google Account SSO (เข้าสู่ระบบด้วย Google)');
    } catch (err: any) {
      setGoogleError(err?.message || 'ไม่สามารถเข้าสู่ระบบด้วยบัญชีนี้ได้ กรุณาลองใหม่');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // Add / Sign-In with a Google account inside the chooser modal
  const handleGoogleSsoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleError(null);
    setGoogleSuggestedFix(null);

    const trimmedEmail = googleEmail.trim();
    if (!trimmedEmail) {
      setGoogleError('กรุณากรอกอีเมล Gmail หรือบัญชี Google ของคุณ');
      return;
    }

    const validation = validateRealGmailAccount(trimmedEmail);
    if (!validation.isValid) {
      setGoogleError(validation.errorMessage);
      setGoogleSuggestedFix(validation.suggestedFix || null);
      return;
    }

    if (!googlePassword.trim()) {
      setGoogleError('กรุณากรอกรหัสผ่านบัญชี Google ของคุณ');
      return;
    }

    const validEmail = (validation.normalizedEmail || trimmedEmail).toLowerCase().trim();

    const passCheck = verifyEmailPassword(validEmail, googlePassword);
    if (!passCheck.isValid) {
      setGoogleError(passCheck.errorMessage);
      setGooglePassword('');
      return;
    }

    setIsGoogleSubmitting(true);
    try {
      const synced = await preserveAndSyncUserProfile(validEmail);

      if (rememberGoogleEmail && validEmail !== SUPER_ADMIN_EMAIL_LOWER) {
        try {
          localStorage.setItem('acu_remembered_gmail', validEmail);
        } catch {
          // ignore
        }
        saveGoogleAccountToDevice({
          email: validEmail,
          displayName: synced?.fullName || validEmail.split('@')[0],
          photoURL: synced?.avatarUrl || '',
        });
      } else if (!rememberGoogleEmail) {
        try {
          const currentRem = (localStorage.getItem('acu_remembered_gmail') || '').toLowerCase().trim();
          if (currentRem === validEmail) {
            localStorage.removeItem('acu_remembered_gmail');
          }
        } catch {
          // ignore
        }
      }

      setIsGoogleModalOpen(false);
      await finalizeLogin(validEmail, 'Google Account SSO (เข้าสู่ระบบด้วย Google)');
    } catch (err: any) {
      setGoogleError(err?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // Synchronous user-gesture trigger for Google Sign-In directly from inside the modal
  const handleTryGooglePopupWithHint = async () => {
    setGoogleError(null);
    setGoogleSuggestedFix(null);
    setIsGoogleSubmitting(true);

    const hintEmail = googleEmail.trim().toLowerCase();
    const hint = hintEmail.includes('@') ? hintEmail : undefined;

    // Try direct GIS OAuth first if domain wasn't authorized in Firebase Auth, otherwise Firebase Popup
    if (unauthorizedHost) {
      const gisStatus = await attemptGisGoogleSignIn(hint);
      setIsGoogleSubmitting(false);
      if (gisStatus === 'success' || gisStatus === 'cancelled') return;
    } else {
      const res = await attemptNativeGooglePopup(hint);
      if (res.status === 'redirecting') return;
      if (res.status === 'success' || res.status === 'cancelled') {
        setIsGoogleSubmitting(false);
        return;
      }
      const gisStatus = await attemptGisGoogleSignIn(hint);
      setIsGoogleSubmitting(false);
      if (gisStatus === 'success' || gisStatus === 'cancelled') return;
    }

    setPopupNotice(
      'ไม่สามารถเปิดหน้าต่าง Google บนอุปกรณ์/เบราว์เซอร์นี้ได้ กรุณาเลือกบัญชีด้านล่าง หรือกรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบได้ทันที'
    );
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

  const handleQuickFillGoogle = (suffix: string) => {
    if (googleEmail.includes('@')) {
      const prefix = googleEmail.split('@')[0];
      setGoogleEmail(`${prefix}${suffix}`);
    } else if (googleEmail.trim()) {
      setGoogleEmail(`${googleEmail.trim()}${suffix}`);
    } else {
      setGoogleEmail(suffix);
    }
    setGoogleError(null);
    setGoogleSuggestedFix(null);
    googleEmailInputRef.current?.focus();
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
        onClick={handleGoogleSignInDirect}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-medium shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.99] disabled:opacity-60 mb-5 group cursor-pointer"
        title="เข้าสู่ระบบด้วยบัญชี Google ที่คุณใช้งาน (เลือกบัญชี Google หรือเพิ่มบัญชีใหม่)"
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
        <span className="text-sm font-semibold group-hover:text-slate-900 transition-colors">
          {isLoading ? 'กำลังเชื่อมต่อไปยังบัญชี Google...' : 'ลงชื่อเข้าใช้ด้วยบัญชี Google'}
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

      {/* Google Account Chooser & Add Account Dialog (Fallback / Quick Account Switcher) */}
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
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 relative text-left max-h-[92vh] overflow-y-auto"
          >
            {/* Close Button */}
            <button
              type="button"
              id="btn-close-google-sso"
              onClick={() => setIsGoogleModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Google G Logo & Title */}
            <div className="text-center mb-5">
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
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                {googleModalView === 'chooser' ? 'เลือกบัญชี Google เพื่อเข้าสู่ระบบ' : 'เพิ่มบัญชี Google E-mail'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                เพื่อเข้าสู่ระบบคลังสื่อนวัตกรรมการศึกษา โรงเรียนอัสสัมชัญอุบลราชธานี
              </p>
            </div>

            {/* Info notice when browser/iframe/domain blocked automatic popup */}
            {(popupNotice || unauthorizedHost) && (
              <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs leading-relaxed flex flex-col gap-2">
                {popupNotice && <span>{popupNotice}</span>}
                {unauthorizedHost && (
                  <div className="text-[11px] bg-white/80 border border-blue-200/80 rounded-lg p-2 text-slate-700">
                    <span className="font-semibold text-blue-900">หมายเหตุสำหรับผู้ดูแลระบบ:</span>{' '}
                    โดเมน <span className="font-mono font-semibold text-blue-700 break-all">{unauthorizedHost}</span>{' '}
                    ยังไม่ได้รับอนุญาตใน Firebase Authentication → Settings → Authorized domains
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTryGooglePopupWithHint}
                    disabled={isGoogleSubmitting}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-blue-100/70 border border-blue-300 text-blue-700 font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>เปิดหน้าต่างบัญชี Google</span>
                  </button>
                  {typeof window !== 'undefined' && window.self !== window.top && (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิดในแท็บเต็มจอ</span>
                    </a>
                  )}
                </div>
              </div>
            )}

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

            {/* Account Chooser List View */}
            {googleModalView === 'chooser' && savedGoogleAccounts.length > 0 && (
              <div className="space-y-2.5">
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
                  {savedGoogleAccounts.map((acc) => {
                    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      acc.displayName || acc.email
                    )}&background=2563eb&color=ffffff&size=96&bold=true`;
                    return (
                      <div
                        key={acc.email}
                        className="flex items-center justify-between gap-2 px-3.5 py-3 hover:bg-blue-50/70 transition-colors"
                      >
                        <button
                          type="button"
                          disabled={isGoogleSubmitting}
                          onClick={() => handleSelectSavedGoogleAccount(acc)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer disabled:opacity-60"
                        >
                          <img
                            src={acc.photoURL || fallbackAvatar}
                            alt={acc.displayName || acc.email}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0 bg-slate-100"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = fallbackAvatar;
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {acc.displayName || acc.email.split('@')[0]}
                            </p>
                            <p className="text-xs text-slate-500 font-mono truncate">{acc.email}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = removeGoogleAccountFromDevice(acc.email);
                            setSavedGoogleAccounts(updated);
                            if (updated.length === 0) {
                              setGoogleModalView('add');
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                          title="นำบัญชีนี้ออกจากรายการอุปกรณ์"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  id="btn-google-add-another-account"
                  onClick={() => {
                    setGoogleError(null);
                    setGoogleSuggestedFix(null);
                    setGoogleModalView('add');
                  }}
                  className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/40 text-slate-700 hover:text-blue-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>ใช้บัญชีอื่น / เพิ่มบัญชี Google E-mail</span>
                </button>
              </div>
            )}

            {/* Add Another Google Account Form */}
            {googleModalView === 'add' && (
              <form onSubmit={handleGoogleSsoSubmit} noValidate className="space-y-4">
                {savedGoogleAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleError(null);
                      setGoogleModalView('chooser');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>กลับไปเลือกบัญชี Google ที่บันทึกไว้ ({savedGoogleAccounts.length})</span>
                  </button>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    อีเมล Gmail / บัญชี Google
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      ref={googleEmailInputRef}
                      type="email"
                      id="input-google-email"
                      value={googleEmail}
                      onChange={(e) => {
                        setGoogleEmail(e.target.value);
                        if (googleError) setGoogleError(null);
                        if (googleSuggestedFix) setGoogleSuggestedFix(null);
                      }}
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
                      onClick={() => handleQuickFillGoogle('@gmail.com')}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 text-blue-600 border border-slate-200 transition-colors cursor-pointer"
                    >
                      @gmail.com
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickFillGoogle('@acu.ac.th')}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 text-blue-600 border border-slate-200 transition-colors cursor-pointer"
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
                      onChange={(e) => {
                        setGooglePassword(e.target.value);
                        if (googleError) setGoogleError(null);
                      }}
                      placeholder="ป้อนรหัสผ่าน Google ของคุณ"
                      className="block w-full pl-10 pr-10 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGooglePassword(!showGooglePassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
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
                    จดจำบัญชี Google นี้ในอุปกรณ์ (คลิกเลือกเข้าใช้งานได้ทันทีในครั้งถัดไป)
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsGoogleModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    id="btn-google-sso-submit"
                    disabled={isGoogleSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-70 cursor-pointer"
                  >
                    {isGoogleSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>กำลังเข้าสู่ระบบ...</span>
                      </>
                    ) : (
                      <span>เพิ่มบัญชีและเข้าสู่ระบบ</span>
                    )}
                  </button>
                </div>
              </form>
            )}
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
          setPendingLoginData(null);
          setIsLoading(false);
        }}
      />
    </div>
  );
};
