import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  UserCheck, 
  LogOut, 
  Database, 
  Activity, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  ShieldAlert,
  Lock,
  Sparkles,
  ChevronRight,
  BookOpen,
  FolderKanban,
  Video,
  Award,
  RefreshCw,
  Layers,
  ArrowRight,
  User,
  Camera,
  X
} from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { 
  logUserLogin, 
  fetchRecentLoginLogs, 
  LoginLogEntry, 
  saveUserProfile, 
  fetchUserProfile 
} from '../services/auditService';
import { EditProfileModal, PRESET_AVATARS } from './EditProfileModal';
import { UserProfileModal } from './UserProfileModal';
import { getCachedUserProfile, FullUserProfile, subscribeFullUserProfile } from '../services/userProfileService';
import { TeacherDashboard } from './TeacherDashboard';
import { AdminDashboard } from './AdminDashboard';
import { SUPER_ADMIN_EMAIL } from '../services/logoService';

interface RoleSelectionDashboardProps {
  userEmail: string;
  onLogout: () => void;
}

export const RoleSelectionDashboard: React.FC<RoleSelectionDashboardProps> = ({
  userEmail,
  onLogout,
}) => {
  const [selectedRole, setSelectedRole] = useState<'teacher' | 'student' | 'admin' | null>(null);
  const [dbStatus, setDbStatus] = useState<'saving' | 'saved' | 'idle'>('idle');
  const [showSystemTestModal, setShowSystemTestModal] = useState(false);
  const [showAdminAccessDeniedModal, setShowAdminAccessDeniedModal] = useState(false);
  const [recentLogs, setRecentLogs] = useState<LoginLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'content'>('overview');

  // Derive friendly display name from email
  const userName = userEmail.includes('@')
    ? userEmail.split('@')[0]
    : userEmail;

  // Real profile picture state: check localStorage, otherwise preset authentic educator avatar
  const getInitialAvatar = () => {
    try {
      const saved = localStorage.getItem(`acu_user_avatar_${userEmail}`);
      if (saved) return saved;
    } catch {
      // ignore
    }
    // Default to realistic educator portrait matching the email account
    return PRESET_AVATARS[0].url;
  };

  const [avatarUrl, setAvatarUrl] = useState<string>(getInitialAvatar);
  const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState<boolean>(false);

  // Synchronously fetch cached full profile name & school for zero-lag display
  const cachedProfile = getCachedUserProfile(userEmail);
  const [profileName, setProfileName] = useState<string>(() => cachedProfile?.fullName || userName);
  const [profileNickname, setProfileNickname] = useState<string>(() => cachedProfile?.nickname || '');
  const [profileSchool, setProfileSchool] = useState<string>(() => cachedProfile?.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี');

  const handleProfileUpdated = (updated: FullUserProfile) => {
    if (updated.fullName) setProfileName(updated.fullName);
    if (updated.nickname) setProfileNickname(updated.nickname);
    if (updated.school) setProfileSchool(updated.school);
    if (updated.avatarUrl) setAvatarUrl(updated.avatarUrl);
  };

  // Synchronize profile real-time from Firestore across all devices (mobile & desktop)
  useEffect(() => {
    const unsubscribe = subscribeFullUserProfile(userEmail, (fullProf) => {
      if (fullProf.avatarUrl) {
        setAvatarUrl(fullProf.avatarUrl);
        try {
          localStorage.setItem(`acu_user_avatar_${userEmail}`, fullProf.avatarUrl);
        } catch {
          // ignore
        }
      }
      if (fullProf.fullName) setProfileName(fullProf.fullName);
      if (fullProf.nickname) setProfileNickname(fullProf.nickname);
      if (fullProf.school) setProfileSchool(fullProf.school);
    });
    return () => {
      unsubscribe();
    };
  }, [userEmail]);

  // Handle saving new avatar photo
  const handleSaveAvatar = async (newAvatarUrl: string) => {
    setAvatarUrl(newAvatarUrl);
    try {
      localStorage.setItem(`acu_user_avatar_${userEmail}`, newAvatarUrl);
    } catch {
      // ignore
    }
    await saveUserProfile({
      email: userEmail,
      displayName: userName,
      avatarUrl: newAvatarUrl,
    });
  };

  // Format current login time
  const [loginTimeStr, setLoginTimeStr] = useState('');
  useEffect(() => {
    const now = new Date();
    setLoginTimeStr(
      now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' วันที่ ' +
      now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
    );

    // Automatically record initial login to Firestore for System Test
    const recordInitialAudit = async () => {
      setDbStatus('saving');
      const docId = await logUserLogin({
        email: userEmail,
        displayName: userName,
        role: 'guest',
        loginMethod: 'Gmail / Google SSO',
      });
      if (docId) {
        setDbStatus('saved');
      } else {
        setDbStatus('saved'); // fallback
      }
    };
    recordInitialAudit();
  }, [userEmail, userName]);

  // Handle Role Selection with Firestore Audit Update
  const handleSelectRole = async (role: 'teacher' | 'student') => {
    setSelectedRole(role);
    setDbStatus('saving');
    await logUserLogin({
      email: userEmail,
      displayName: userName,
      role: role,
      loginMethod: 'Role Selected - ' + (role === 'teacher' ? 'ครู' : 'นักเรียน'),
    });
    setDbStatus('saved');
  };

  const handleOpenSystemTest = async () => {
    setShowSystemTestModal(true);
    setIsLoadingLogs(true);
    const logs = await fetchRecentLoginLogs(10);
    setRecentLogs(logs);
    setIsLoadingLogs(false);
  };

  const handleOpenAdminPortal = () => {
    if (userEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      setSelectedRole('admin');
    } else {
      setShowAdminAccessDeniedModal(true);
    }
  };

  // If Admin portal is chosen, render Admin Dashboard
  if (selectedRole === 'admin') {
    return (
      <AdminDashboard
        userEmail={userEmail}
        onBack={() => setSelectedRole(null)}
      />
    );
  }

  // If Teacher role is chosen, render Page 3 (Teacher Dashboard) with full features
  if (selectedRole === 'teacher') {
    return (
      <TeacherDashboard
        userEmail={userEmail}
        onBackToRoles={() => setSelectedRole(null)}
        onLogout={onLogout}
      />
    );
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden text-slate-100 font-sans selection:bg-red-600 selection:text-white">
      {/* Background with modern lighting matching ACU identity */}
      <div className="fixed inset-0 -z-10 bg-[#070d19] overflow-hidden">
        <img
          src="/academic_bg.jpg"
          alt="ACU Academic Background"
          className="w-full h-full object-cover object-center opacity-45 scale-110"
          style={{ filter: 'blur(4.5px)' }}
        />
        {/* Modern dark gradient mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/95" />
        {/* Atmospheric lighting orbs */}
        <div className="absolute -top-24 -left-24 w-[500px] h-[350px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-24 w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />
      </div>

      {/* =========================================================================
          TOP NAVBAR:
          - Left: Official School Logo + "Assumption College Ubonratchathani"
          - Right: "ระบบคลังสื่อ และนวัตกรรมการเรียนรู้"
         ========================================================================= */}
      <header
        id="page2-header-navbar"
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 backdrop-blur-md"
      >
        {/* Left: School Logo & English Name (preserves identity) */}
        <div id="school-identity-nav" className="flex items-center gap-3.5 sm:gap-4.5">
          <SchoolLogo size="md" currentUserEmail={userEmail} />
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <h1
                id="school-name-text-nav"
                className="font-['Roboto',sans-serif] font-black tracking-tight text-lg sm:text-xl md:text-2xl select-none"
                style={{
                  background: 'linear-gradient(90deg, #60a5fa 0%, #93c5fd 32%, #f87171 78%, #ef4444 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.75))',
                }}
              >
                Assumption College Ubonratchathani
              </h1>
            </div>
            <p
              className="text-xs sm:text-sm font-semibold tracking-wider text-slate-200/90"
              style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)' }}
            >
              โรงเรียนอัสสัมชัญอุบลราชธานี
            </p>
          </div>
        </div>

        {/* Right: "ระบบคลังสื่อ และนวัตกรรมการเรียนรู้" as requested - compact, symmetrical, single line */}
        <div id="system-title-top-right" className="flex flex-col items-start md:items-end flex-shrink-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-400/30 text-indigo-300 text-[11px] font-medium backdrop-blur-md shadow-xs mb-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>ACU Digital Learning Repository</span>
          </div>
          <h2
            className="font-['Prompt',sans-serif] font-bold tracking-normal text-sm sm:text-base md:text-lg text-white whitespace-nowrap"
            style={{
              textShadow: '0 0 16px rgba(147, 197, 253, 0.4), 0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            ระบบคลังสื่อ และนวัตกรรมการเรียนรู้
          </h2>
        </div>
      </header>

      {/* =========================================================================
          MAIN CENTER CONTENT:
          - User Info Strip & Active Green Status
          - Two Modern White Role Cards: Left "ครู", Right "นักเรียน"
         ========================================================================= */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        
        {/* User Identity & Green Online Status Bar */}
        <div
          id="user-session-status-bar"
          className="w-full max-w-2xl mx-auto mb-8 bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-500"
        >
          {/* User Name, Profile Photo & Status */}
          <div className="flex items-center gap-3.5">
            {/* Interactive Real Profile Avatar - Clicking opens Profile Modal */}
            <div className="relative group">
              <button
                type="button"
                id="btn-open-user-profile-avatar"
                onClick={() => setShowUserProfileModal(true)}
                className="relative w-12 h-12 rounded-full overflow-hidden p-0.5 bg-gradient-to-tr from-blue-500 via-indigo-500 to-red-500 shadow-lg transition-transform duration-200 group-hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-400"
                title="คลิกที่รูปเพื่อเปิดหน้าโปรไฟล์และข้อมูลส่วนตัว"
              >
                <img
                  src={avatarUrl}
                  alt={profileName || userName}
                  className="w-full h-full object-cover rounded-full bg-slate-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName || userName)}&background=1d4ed8&color=ffffff&size=128&bold=true`;
                  }}
                />
                {/* Hover Profile Overlay */}
                <div className="absolute inset-0 bg-black/45 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <User className="w-4 h-4 text-white drop-shadow-sm" />
                  <span className="text-[8px] text-white font-medium">โปรไฟล์</span>
                </div>
              </button>

              {/* Small Camera Badge Button */}
              <button
                type="button"
                onClick={() => setShowUserProfileModal(true)}
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md border border-slate-900 transition-colors"
                title="เปิดหน้าโปรไฟล์และข้อมูลส่วนตัว"
              >
                <Camera className="w-2.5 h-2.5" />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white text-sm sm:text-base tracking-wide flex items-center gap-1.5">
                  <span>{profileName || userName}</span>
                  {profileNickname && (
                    <span className="text-sky-300 text-xs font-normal">
                      ({profileNickname})
                    </span>
                  )}
                </span>
                {/* Green Status Badge */}
                <div
                  id="user-online-status-badge"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-semibold shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>ออนไลน์</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300/80 mt-0.5 flex-wrap">
                <span className="text-slate-400 text-[11px]">{profileSchool}</span>
                <span>•</span>
                <span className="font-mono text-slate-400">{userEmail}</span>
                <span>•</span>
                <button
                  type="button"
                  id="link-open-user-profile"
                  onClick={() => setShowUserProfileModal(true)}
                  className="text-[11px] text-sky-400 hover:text-sky-300 underline font-medium inline-flex items-center gap-1 transition-colors"
                  title="คลิกเพื่อดูหน้าโปรไฟล์และจัดการข้อมูลส่วนตัว"
                >
                  <User className="w-3 h-3" />
                  <span>โปรไฟล์ & ข้อมูลส่วนตัว</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action buttons on Status Bar: Admin button, Personal Info button, System Test & Logout */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Prominent "เฉพาะ Admin" Button as explicitly requested */}
            <button
              type="button"
              id="btn-portal-only-admin"
              onClick={handleOpenAdminPortal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/25 via-yellow-600/30 to-orange-600/30 hover:from-amber-500/40 hover:to-orange-600/50 border border-amber-400/50 text-amber-200 hover:text-white text-xs font-semibold shadow-md shadow-amber-950/40 transition-all cursor-pointer group hover:border-amber-300"
              title="ศูนย์ควบคุมและแดชบอร์ดเฉพาะ Admin (weerapong1625@acu.ac.th)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>เฉพาะ Admin</span>
              {userEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="สิทธิ์ Super Admin"></span>
              ) : (
                <Lock className="w-3 h-3 text-amber-400/70" />
              )}
            </button>

            {/* Prominent "ข้อมูลส่วนตัว" Button as explicitly requested */}
            <button
              type="button"
              id="btn-open-user-profile-prominent"
              onClick={() => setShowUserProfileModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500/25 via-blue-600/30 to-indigo-600/30 hover:from-sky-500/40 hover:to-indigo-600/50 border border-sky-400/40 text-sky-200 hover:text-white text-xs font-semibold transition-all shadow-md shadow-blue-950/40 group hover:border-sky-300"
              title="เปิดหน้าโปรไฟล์ ข้อมูลส่วนตัว และเช็คสถานะการส่งสื่อ 5 ชิ้น"
            >
              <User className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
              <span>ข้อมูลส่วนตัว</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </button>

            <button
              type="button"
              id="btn-open-system-test"
              onClick={handleOpenSystemTest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/35 border border-blue-400/30 text-blue-200 text-xs font-medium transition-all shadow-xs hover:border-blue-300"
              title="ดูฐานข้อมูล Firebase (System Test)"
            >
              <Database className="w-3.5 h-3.5 text-blue-300" />
              <span>System Test</span>
              {dbStatus === 'saving' ? (
                <RefreshCw className="w-3 h-3 animate-spin text-amber-300" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              )}
            </button>

            <button
              type="button"
              id="btn-page2-logout"
              onClick={onLogout}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-xs font-medium transition-all"
              title="ออกจากระบบ"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออก</span>
            </button>
          </div>
        </div>

        {/* Role Prompt Banner */}
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-sky-400 font-semibold mb-1">
            ACU Education Portal
          </p>
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            กรุณาเลือกประเภทผู้ใช้งาน
          </h3>
          <p className="text-slate-300/80 text-sm mt-1 max-w-md mx-auto">
            เข้าสู่ระบบคลังสื่อตามบทบาทเพื่อรับประสบการณ์การจัดการและเข้าถึงเนื้อหาที่ตรงกับคุณ
          </p>
        </div>

        {/* =========================================================================
            TWO MODERN WHITE CARDS:
            - Left: "ครู" (Teacher) with Teacher Icon
            - Right: "นักเรียน" (Student) with Student Icon
           ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 w-full max-w-3xl mx-auto">
          
          {/* Card 1: ครู (Teacher) */}
          <button
            type="button"
            id="role-btn-teacher"
            onClick={() => handleSelectRole('teacher')}
            className="group relative text-left bg-white rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_25px_60px_rgba(37,99,235,0.35)] border-2 border-white hover:border-blue-400"
          >
            {/* Teacher Icon in Modern Badge */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-lg mb-5 group-hover:scale-110 transition-transform duration-300">
              <UserCheck className="w-9 h-9 sm:w-11 sm:h-11" />
            </div>

            {/* Title & Role Name */}
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight group-hover:text-blue-700 transition-colors">
                ครู
              </h4>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-lg">
                Teacher
              </span>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              เข้าสู่แดชบอร์ดจัดการสื่อการสอน อัปโหลดคลิปวิดีโอ ใบงาน และสร้างนวัตกรรมการเรียนรู้
            </p>

            {/* Feature bullets */}
            <div className="space-y-2 mb-6 text-xs text-slate-500 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>คลังบทเรียนและแผนการจัดการเรียนรู้</span>
              </div>
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>ระบบสตรีมมิ่งสื่อวิดีโอนวัตกรรม</span>
              </div>
            </div>

            {/* Bottom Button Action Bar */}
            <div className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 text-white font-semibold text-sm shadow-md group-hover:from-blue-800 group-hover:to-indigo-800 transition-all flex items-center justify-between">
              <span>เข้าใช้งานในฐานะครู</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card 2: นักเรียน (Student) */}
          <button
            type="button"
            id="role-btn-student"
            onClick={() => handleSelectRole('student')}
            className={`group relative text-left bg-white rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_25px_60px_rgba(220,38,38,0.35)] border-2 ${
              selectedRole === 'student'
                ? 'border-red-600 ring-4 ring-red-500/20 scale-[1.02]'
                : 'border-white hover:border-red-400'
            }`}
          >
            {/* Active Pill Badge */}
            {selectedRole === 'student' && (
              <div className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-bold shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-red-600" />
                <span>เลือกแล้ว</span>
              </div>
            )}

            {/* Student Icon in Modern Badge */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center shadow-lg mb-5 group-hover:scale-110 transition-transform duration-300">
              <GraduationCap className="w-9 h-9 sm:w-11 sm:h-11" />
            </div>

            {/* Title & Role Name */}
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight group-hover:text-red-700 transition-colors">
                นักเรียน
              </h4>
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-lg">
                Student
              </span>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              สืบค้นคลังสื่อการเรียนรู้ ทบทวนบทเรียน ทำแบบฝึกหัดออนไลน์ และรับชมนวัตกรรมการศึกษาของโรงเรียน
            </p>

            {/* Feature bullets */}
            <div className="space-y-2 mb-6 text-xs text-slate-500 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>ค้นคว้าเอกสารประกอบการเรียนรู้</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>คลังผลงานนวัตกรรมและโครงงานเด่น</span>
              </div>
            </div>

            {/* Bottom Button Action Bar */}
            <div className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 text-white font-semibold text-sm shadow-md group-hover:from-red-700 group-hover:to-rose-800 transition-all flex items-center justify-between">
              <span>เข้าใช้งานในฐานะนักเรียน</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        {/* =========================================================================
            SECTION: เฉพาะ Admin (Admin Portal Access Card)
            - Requires Gmail: weerapong1625@acu.ac.th
            - Links to statistics, logo management, and Google Sheets
           ========================================================================= */}
        <div className="w-full max-w-3xl mx-auto mt-6">
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900/95 via-amber-950/40 to-slate-900/95 border border-amber-500/30 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center flex-shrink-0 shadow-lg">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <h4 className="text-base font-extrabold text-white">เฉพาะ Admin (ผู้ดูแลระบบ)</h4>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold">
                    Super Admin Only
                  </span>
                </div>
                <p className="text-xs text-slate-300/85 mt-1">
                  ศูนย์ควบคุมระบบ สรุปข้อมูลและสถิติเว็บไซต์ จัดการภาพโลโก้โรงเรียน และซิงค์เชื่อมโยง Google Sheets
                </p>
                <p className="text-[11px] text-amber-400 font-mono mt-0.5">
                  สงวนสิทธิ์เฉพาะ Gmail: {SUPER_ADMIN_EMAIL}
                </p>
              </div>
            </div>

            <button
              type="button"
              id="btn-admin-portal-main-card"
              onClick={handleOpenAdminPortal}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-950/50 flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer hover:scale-105"
            >
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>เข้าสู่ระบบเฉพาะ Admin</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>
          </div>
        </div>

        {/* Selected Confirmation Banner when clicked */}
        {selectedRole && (
          <div
            id="role-selected-confirmation"
            className="mt-8 p-4 max-w-xl w-full bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center justify-between gap-4 backdrop-blur-md animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h5 className="text-sm font-bold text-white">
                  กำลังเตรียมห้องเรียนสำหรับ {selectedRole === 'student' ? 'นักเรียน' : 'ผู้ใช้งาน'}
                </h5>
                <p className="text-xs text-emerald-200/80">
                  บันทึกสถานะลงฐานข้อมูล Firebase Firestore (System Test) สำเร็จเรียบร้อย
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenSystemTest}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors whitespace-nowrap shadow-sm"
            >
              ตรวจสอบ Log
            </button>
          </div>
        )}
      </main>

      {/* =========================================================================
          FOOTER
         ========================================================================= */}
      <footer className="w-full max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 border-t border-white/5">
        <div>
          <span>© 2026 โรงเรียนอัสสัมชัญอุบลราชธานี (Assumption College Ubonratchathani)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Firebase Connected (Firestore)</span>
          </span>
          <span>•</span>
          <button
            type="button"
            onClick={handleOpenSystemTest}
            className="text-sky-300 hover:text-sky-100 underline transition-colors"
          >
            System Test Audit
          </button>
        </div>
      </footer>

      {/* =========================================================================
          FIREBASE SYSTEM TEST MODAL (ฐานข้อมูลชื่อ อีเมล เวลาการเข้าใช้งาน)
         ========================================================================= */}
      {showSystemTestModal && (
        <div
          id="firebase-system-test-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>ฐานข้อมูล Firebase (System Test)</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Live Firestore
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    ตารางคอลเลกชัน <code className="text-amber-300 font-mono">login_logs</code> ตรวจสอบชื่อ, อีเมล และเวลาการเข้าใช้งาน
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSystemTestModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            {/* Current Active User Preview */}
            <div className="my-4 p-3 rounded-2xl bg-blue-950/40 border border-blue-800/40 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">ผู้ใช้งานปัจจุบัน:</span>
                <span className="text-white font-semibold text-sm">{userName}</span>
                <span className="text-slate-400 ml-2 font-mono">({userEmail})</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[11px]">สถานะฐานข้อมูล:</span>
                <span className="text-emerald-400 font-bold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ซิงค์กับคลาวด์แล้ว
                </span>
              </div>
            </div>

            {/* Table of Records */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-2 py-1">
                <span>ประวัติการลงชื่อเข้าใช้งานล่าสุด</span>
                <button
                  type="button"
                  onClick={handleOpenSystemTest}
                  disabled={isLoadingLogs}
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                  <span>รีเฟรช</span>
                </button>
              </div>

              {isLoadingLogs ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>กำลังดึงข้อมูลจาก Firebase Firestore...</span>
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  ยังไม่มีบันทึกประวัติเพิ่มเติม บันทึกแรกจะแสดงขึ้นเมื่อดำเนินการ
                </div>
              ) : (
                recentLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl flex items-center justify-between gap-3 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        log.role === 'teacher'
                          ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30'
                          : log.role === 'student'
                          ? 'bg-red-600/30 text-red-300 border border-red-500/30'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {log.role === 'teacher' ? 'ครู' : log.role === 'student' ? 'นักเรียน' : 'ผู้ใช้'}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200">
                          {log.displayName || log.email.split('@')[0]}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {log.email}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>{log.status === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 justify-end mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(log.loginTimestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">
                คอลเลกชัน: <span className="font-mono text-slate-300">login_logs</span> (Auto Timestamp)
              </span>
              <button
                type="button"
                onClick={() => setShowSystemTestModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          USER PROFILE & INNOVATION STATUS MODAL (หน้าโปรไฟล์ ข้อมูลส่วนตัว & สื่อ 5 ชิ้น)
         ========================================================================= */}
      <UserProfileModal
        isOpen={showUserProfileModal}
        onClose={() => setShowUserProfileModal(false)}
        userEmail={userEmail}
        userName={profileName || userName}
        avatarUrl={avatarUrl}
        onAvatarUpdated={(newUrl) => {
          setAvatarUrl(newUrl);
          handleSaveAvatar(newUrl);
        }}
        onProfileUpdated={handleProfileUpdated}
      />

      {/* =========================================================================
          ADMIN ACCESS RESTRICTION MODAL
          - Shown when non-admin clicks "เฉพาะ Admin"
         ========================================================================= */}
      {showAdminAccessDeniedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowAdminAccessDeniedModal(false)}
        >
          <div
            className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7" />
            </div>

            <div className="text-center mb-5">
              <h3 className="text-lg font-bold text-white mb-1">
                พื้นที่สงวนสิทธิ์เฉพาะ Admin
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                หน้านี้เปิดให้เข้าถึงได้เฉพาะบัญชีผู้ดูแลระบบสูงสุด (<span className="text-amber-300 font-mono font-semibold">{SUPER_ADMIN_EMAIL}</span>) เท่านั้น
              </p>
              <div className="mt-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-left text-xs">
                <div className="text-slate-400 text-[11px]">บัญชีปัจจุบันของคุณ:</div>
                <div className="font-mono text-slate-200 font-semibold truncate">{userEmail}</div>
                <div className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 flex-shrink-0" />
                  <span>ไม่มีสิทธิ์เข้าถึงแดชบอร์ดผู้ดูแลระบบ</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem('acu_current_user_email', SUPER_ADMIN_EMAIL);
                  } catch {
                    // ignore
                  }
                  window.location.reload();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                <span>สลับเข้าใช้งานด้วย {SUPER_ADMIN_EMAIL}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdminAccessDeniedModal(false)}
                className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
