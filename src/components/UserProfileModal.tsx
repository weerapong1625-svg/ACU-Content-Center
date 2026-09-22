import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  Award, 
  Star, 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  Save, 
  LogOut, 
  Camera, 
  Eye, 
  Sparkles, 
  Send, 
  ExternalLink, 
  FileText, 
  Check, 
  AlertCircle, 
  School, 
  Layers, 
  ThumbsUp, 
  BookmarkCheck,
  Edit3,
  RefreshCw,
  Share2,
  Heart,
  RotateCcw
} from 'lucide-react';
import { 
  FullUserProfile, 
  InnovationItem, 
  fetchFullUserProfile, 
  saveFullUserProfile, 
  addVisitorPraiseAndRating, 
  recordProfileVisit,
  getCachedUserProfile,
  DEFAULT_INNOVATION_ITEMS
} from '../services/userProfileService';
import { 
  subscribeUserInnovations, 
  subscribeTeacherMedia, 
  TeacherMediaWork 
} from '../services/submissionService';
import { 
  subscribeAllLoginLogs, 
  LoginLogEntry, 
  resetAllLoginLogs 
} from '../services/auditService';
import { EditProfileModal } from './EditProfileModal';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName: string;
  avatarUrl: string;
  onAvatarUpdated: (newUrl: string) => void;
  onProfileUpdated?: (updated: FullUserProfile) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  userName,
  avatarUrl,
  onAvatarUpdated,
  onProfileUpdated,
}) => {
  // Active Tab: 'info' (ข้อมูลส่วนตัว) | 'innovations' (สถานะส่งสื่อ 5 ชิ้น) | 'stats' (สถิติการเข้าชม) | 'praise' (ให้ดาวและชื่นชม)
  const [activeTab, setActiveTab] = useState<'info' | 'innovations' | 'stats' | 'praise'>('info');

  // Profile Data State initialized synchronously to prevent delay
  const isMasterWeerapong = userEmail.toLowerCase().trim() === 'weerapong1625@acu.ac.th';
  const [profile, setProfile] = useState<FullUserProfile>(() => {
    return getCachedUserProfile(userEmail) || {
      email: userEmail,
      fullName: isMasterWeerapong ? '(Admin) ม.วีระพงษ์ มีทรัพย์' : (userName || userEmail.split('@')[0]),
      nickname: isMasterWeerapong ? 'ครูปอย' : '',
      school: 'โรงเรียนอัสสัมชัญอุบลราชธานี',
      displayName: userName || userEmail.split('@')[0],
      avatarUrl: avatarUrl,
      role: isMasterWeerapong ? 'ผู้ดูแลระบบและพัฒนานวัตกรรม' : 'ครูผู้สอน / ผู้พัฒนานวัตกรรม',
      innovations: DEFAULT_INNOVATION_ITEMS,
      stats: {
        totalViews: 0,
        uniqueVisitors: 0,
        points: 0,
        averageRating: 0,
        totalRatings: 0,
      },
      praises: [],
      updatedAt: new Date().toISOString(),
    };
  });

  // Form Inputs
  const [fullNameInput, setFullNameInput] = useState<string>('');
  const [nicknameInput, setNicknameInput] = useState<string>('');
  const [schoolInput, setSchoolInput] = useState<string>('');
  const [roleInput, setRoleInput] = useState<string>('');
  
  // Status states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [showAvatarEditModal, setShowAvatarEditModal] = useState<boolean>(false);
  const [editingInnovationId, setEditingInnovationId] = useState<number | null>(null);

  // Visitor Praise form state
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [visitorNameInput, setVisitorNameInput] = useState<string>('');
  const [visitorSchoolInput, setVisitorSchoolInput] = useState<string>('โรงเรียนอัสสัมชัญอุบลราชธานี');
  const [commentInput, setCommentInput] = useState<string>('');
  const [isSubmittingPraise, setIsSubmittingPraise] = useState<boolean>(false);
  const [praiseSuccessNotice, setPraiseSuccessNotice] = useState<string | null>(null);

  // Real-time verified login logs & Year selector
  const [loginLogs, setLoginLogs] = useState<LoginLogEntry[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [teacherMediaList, setTeacherMediaList] = useState<TeacherMediaWork[]>([]);
  const [isResettingLogs, setIsResettingLogs] = useState<boolean>(false);
  const [resetLogsSuccess, setResetLogsSuccess] = useState<string | null>(null);

  // Subscribe to real-time login logs
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeAllLoginLogs((logs) => {
      setLoginLogs(logs);
    });
    return () => unsub();
  }, [isOpen]);

  // Subscribe to real-time teacher media repository for kudos/likes counting
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeTeacherMedia((works) => {
      setTeacherMediaList(works);
    });
    return () => unsub();
  }, [isOpen]);

  // Handle Admin visitor logs reset to 0
  const handleResetAllVisitorLogs = async () => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตสถิติผู้เข้าชมและประวัติการเข้าใช้งานทั้งระบบเป็น 0 เพื่อเริ่มนับตามจำนวนครั้งจริงตั้งแต่วันนี้?')) {
      return;
    }
    setIsResettingLogs(true);
    try {
      const res = await resetAllLoginLogs();
      if (res.success) {
        setLoginLogs([]);
        setResetLogsSuccess(`รีเซ็ตสถิติผู้เข้าชมเป็น 0 สำเร็จแล้ว (ลบประวัติเดิม ${res.count} รายการ เริ่มนับจริงทีละ 1)`);
        setTimeout(() => setResetLogsSuccess(null), 4000);
      } else {
        alert(res.error || 'เกิดข้อผิดพลาดในการรีเซ็ต');
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + (err?.message || 'ไม่สามารถรีเซ็ตได้'));
    } finally {
      setIsResettingLogs(false);
    }
  };

  // Sync profile data on mount & record visit
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadData = async () => {
      try {
        const fullData = await fetchFullUserProfile(userEmail, userName, avatarUrl);
        if (isMounted && fullData) {
          setProfile(fullData);
          setFullNameInput(fullData.fullName || userName || '');
          setNicknameInput(fullData.nickname || '');
          setSchoolInput(fullData.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี');
          setRoleInput(fullData.role || 'ครูผู้สอน / ผู้พัฒนานวัตกรรม');
        }
        // Increment visit count
        recordProfileVisit(userEmail);
      } catch (err) {
        console.error('Error loading full profile:', err);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, userEmail, userName, avatarUrl]);

  // Sync input fields when profile state updates
  useEffect(() => {
    if (profile) {
      setFullNameInput(profile.fullName || userName || '');
      setNicknameInput(profile.nickname || '');
      setSchoolInput(profile.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี');
      setRoleInput(profile.role || 'ครูผู้สอน');
    }
  }, [profile, userName]);

  // Synchronize user innovations dynamically from Firestore in real-time
  useEffect(() => {
    if (!isOpen || !userEmail) return;

    const unsubscribe = subscribeUserInnovations(userEmail, (userInnos) => {
      setProfile((prev) => {
        // Map real submissions into the 5 slots
        const updatedInnovations = DEFAULT_INNOVATION_ITEMS.map((defItem) => {
          const match = userInnos.find((u) => u.itemNumber === defItem.id);
          if (match) {
            return {
              id: defItem.id,
              title: match.mediaTitle,
              category: match.mediaType,
              status: 'submitted' as const,
              submittedDate: match.submittedAt
                ? new Date(match.submittedAt).toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'ส่งแล้ว',
              linkUrl: match.onlineUrl || '',
              coverImageUrl: match.imageUrl || '',
              notes: `${match.productionType}${match.usageDetails ? ` • ${match.usageDetails}` : ''}`,
            };
          }
          return defItem;
        });

        return {
          ...prev,
          innovations: updatedInnovations,
        };
      });
    });

    return () => unsubscribe();
  }, [isOpen, userEmail]);

  // Media posted by this teacher and total likes (Kudos points)
  const myMediaWorks = React.useMemo(() => {
    const norm = userEmail.toLowerCase().trim();
    return teacherMediaList.filter(
      (m) => m.submittedByEmail?.toLowerCase().trim() === norm
    );
  }, [teacherMediaList, userEmail]);

  // Real-time points accumulated from praise/likes given to teacher's media at repository (starts at 0)
  const teacherKudosPoints = React.useMemo(() => {
    return myMediaWorks.reduce((sum, item) => sum + (item.likes || 0), 0);
  }, [myMediaWorks]);

  // Real-time verified visitor statistics based on authentic login logs
  const verifiedStats = React.useMemo(() => {
    const targetYearNum = parseInt(selectedYear) || 2026;
    const now = new Date();
    const isCurrentYear = now.getFullYear() === targetYearNum;
    const currentMonthIdx = now.getMonth();
    const todayStr = now.toISOString().split('T')[0];

    // Filter by user's email
    const myLogs = loginLogs.filter(
      (l) => l.email?.toLowerCase().trim() === userEmail?.toLowerCase().trim()
    );

    // All logs that fall in selected target year
    const allYearLogs = loginLogs.filter((l) => {
      if (!l.loginTimestamp) return false;
      const d = new Date(l.loginTimestamp);
      return !isNaN(d.getTime()) && d.getFullYear() === targetYearNum;
    });
    const allYearVisits = allYearLogs.length;

    // User's logs in selected target year
    const myYearLogs = myLogs.filter((l) => {
      if (!l.loginTimestamp) return false;
      const d = new Date(l.loginTimestamp);
      return !isNaN(d.getTime()) && d.getFullYear() === targetYearNum;
    });
    const myYearVisits = myYearLogs.length;

    // Monthly breakdown for selected year (1-12)
    // Guarantee: Each log in allYearLogs falls into EXACTLY ONE month (d.getMonth() === idx).
    // Therefore, the sum of allCount over 12 months is STRICTLY EQUAL to allYearVisits!
    const monthNames = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    const monthlyData = monthNames.map((name, idx) => {
      const myCount = myYearLogs.filter((l) => {
        const d = new Date(l.loginTimestamp);
        return d.getMonth() === idx;
      }).length;
      const allCount = allYearLogs.filter((l) => {
        const d = new Date(l.loginTimestamp);
        return d.getMonth() === idx;
      }).length;
      return {
        monthName: name,
        monthIndex: idx + 1,
        myCount,
        allCount,
      };
    });

    const allTodayVisits = isCurrentYear
      ? allYearLogs.filter((l) => l.loginTimestamp?.startsWith(todayStr)).length
      : 0;
    const allMonthVisits = isCurrentYear
      ? (monthlyData[currentMonthIdx]?.allCount || 0)
      : 0;

    const myTodayVisits = isCurrentYear
      ? myYearLogs.filter((l) => l.loginTimestamp?.startsWith(todayStr)).length
      : 0;
    const myMonthVisits = isCurrentYear
      ? (monthlyData[currentMonthIdx]?.myCount || 0)
      : 0;

    const uniqueVerifiedUsersYear = new Set(
      allYearLogs.map((l) => l.email?.toLowerCase().trim()).filter(Boolean)
    ).size;

    const uniqueAllUsers = new Set(
      loginLogs.map((l) => l.email?.toLowerCase().trim()).filter(Boolean)
    ).size;

    return {
      myTodayVisits,
      myMonthVisits,
      myYearVisits,
      myTotalVisits: myLogs.length, // 1 visit = 1 star point
      allTodayVisits,
      allMonthVisits,
      allYearVisits, // strictly equals sum of 12 monthly allCount
      uniqueVerifiedUsersYear,
      allTotalVisits: loginLogs.length,
      uniqueAllUsers,
      monthlyData,
      myRecentLogs: myLogs.slice(0, 8),
      systemRecentLogs: loginLogs.slice(0, 8),
    };
  }, [loginLogs, userEmail, selectedYear]);

  if (!isOpen) return null;

  // Handle Save Personal Information
  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updatedProfile: FullUserProfile = {
        ...profile,
        fullName: fullNameInput.trim() || userName,
        nickname: nicknameInput.trim(),
        school: schoolInput.trim() || 'โรงเรียนอัสสัมชัญอุบลราชธานี',
        role: roleInput.trim() || 'ครูผู้สอน',
        updatedAt: new Date().toISOString(),
      };

      const success = await saveFullUserProfile(updatedProfile);
      if (success) {
        setProfile(updatedProfile);
        setSaveSuccess(true);
        if (onProfileUpdated) {
          onProfileUpdated(updatedProfile);
        }
        setTimeout(() => setSaveSuccess(false), 3500);
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Innovation status or title update
  const handleUpdateInnovation = async (
    id: number, 
    fields: Partial<InnovationItem>
  ) => {
    const updatedInnovations = profile.innovations.map((item) => {
      if (item.id === id) {
        return { ...item, ...fields };
      }
      return item;
    });

    const updatedProfile: FullUserProfile = {
      ...profile,
      innovations: updatedInnovations,
      updatedAt: new Date().toISOString(),
    };

    setProfile(updatedProfile);
    await saveFullUserProfile(updatedProfile);
    setEditingInnovationId(null);
  };

  // Handle Visitor Praise and Star Rating Submission
  const handleSubmitPraise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() && ratingInput <= 0) return;

    setIsSubmittingPraise(true);
    setPraiseSuccessNotice(null);

    try {
      const updated = await addVisitorPraiseAndRating(userEmail, {
        visitorName: visitorNameInput.trim() || 'ผู้เข้าชมระบบคลังสื่อ',
        visitorSchool: visitorSchoolInput.trim() || 'โรงเรียนอัสสัมชัญอุบลราชธานี',
        rating: ratingInput,
        comment: commentInput.trim() || 'ขอชื่นชมในความตั้งใจและสื่อนวัตกรรมที่มีคุณภาพครับ',
      });

      if (updated) {
        setProfile(updated);
        setCommentInput('');
        setPraiseSuccessNotice(`ขอบคุณสำหรับการให้ ${ratingInput} ดาวและร่วมสะสมแต้ม +${ratingInput * 5} แต้ม!`);
        setTimeout(() => setPraiseSuccessNotice(null), 4000);
      }
    } catch (err) {
      console.error('Failed to add praise:', err);
    } finally {
      setIsSubmittingPraise(false);
    }
  };

  // Calculate completed innovations
  const completedInnovationsCount = profile.innovations.filter(
    (i) => i.status === 'approved' || i.status === 'submitted'
  ).length;
  const progressPercent = Math.round((completedInnovationsCount / 5) * 100);

  // Quick comment templates for visitors
  const QUICK_PRAISE_TEMPLATES = [
    'สื่อนวัตกรรมยอดเยี่ยม ใช้งานได้จริงในห้องเรียน',
    'เนื้อหาเข้าใจง่าย สื่อทันสมัย สวยงามมากครับ',
    'แผนการจัดการเรียนรู้บูรณาการได้ครบถ้วน ชื่นชมครับ',
    'นวัตกรรมสร้างสรรค์ ตอบโจทย์การเรียนรู้ยุคใหม่',
  ];

  return (
    <div
      id="user-profile-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="user-profile-modal-card"
        className="relative bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full p-4 sm:p-6 md:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[94vh] text-slate-100 my-auto"
      >
        {/* Top Header with Profile Identity & Exit Button */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* User Avatar with Edit Trigger */}
            <div className="relative group flex-shrink-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-blue-500 via-indigo-500 to-red-500 shadow-lg">
                <img
                  src={profile.avatarUrl || avatarUrl}
                  alt={profile.fullName || userName}
                  className="w-full h-full object-cover rounded-[14px] bg-slate-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      profile.fullName || userName
                    )}&background=1d4ed8&color=ffffff&size=128&bold=true`;
                  }}
                />
              </div>
              {/* Camera edit badge */}
              <button
                type="button"
                id="btn-edit-avatar-from-profile"
                onClick={() => setShowAvatarEditModal(true)}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md border-2 border-slate-900 transition-colors"
                title="เปลี่ยนรูปภาพโปรไฟล์"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span>{profile.fullName || userName}</span>
                  {profile.nickname && (
                    <span className="text-sm font-semibold text-sky-400">
                      ({profile.nickname})
                    </span>
                  )}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-600/25 border border-blue-400/30 text-blue-300 text-[11px] font-medium">
                  {profile.role || 'ครูผู้สอน'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <School className="w-3.5 h-3.5 text-slate-500" />
                <span>{profile.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี'}</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-slate-500">{userEmail}</span>
              </p>
            </div>
          </div>

          {/* Quick Exit Button (กดออกหน้านี้) */}
          <button
            type="button"
            id="btn-close-profile-modal"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition-colors shadow-xs"
            title="กดออกหน้านี้ (ปิดหน้าต่าง)"
          >
            <LogOut className="w-3.5 h-3.5 rotate-180 text-rose-400" />
            <span className="hidden sm:inline">กดออกหน้านี้</span>
            <X className="w-3.5 h-3.5 sm:hidden" />
          </button>
        </div>

        {/* 4 Interactive Functional Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 pt-4 pb-3 border-b border-slate-800/80 overflow-x-auto no-scrollbar text-xs">
          {/* Tab 1: ข้อมูลส่วนตัว */}
          <button
            type="button"
            id="tab-btn-personal-info"
            onClick={() => setActiveTab('info')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === 'info'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <User className="w-4 h-4" />
            <span>ข้อมูลส่วนตัว</span>
          </button>

          {/* Tab 2: ปุ่มเช็คสถานะการส่งสื่อและนวัตกรรม 5 ชิ้น */}
          <button
            type="button"
            id="tab-btn-innovations-status"
            onClick={() => setActiveTab('innovations')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === 'innovations'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>สถานะส่งสื่อ 5 ชิ้น</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-bold">
              {completedInnovationsCount}/5
            </span>
          </button>

          {/* Tab 3: เช็คสถิติการเข้าชม */}
          <button
            type="button"
            id="tab-btn-stats-analytics"
            onClick={() => setActiveTab('stats')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === 'stats'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>สถิติการเข้าชม</span>
          </button>

          {/* Tab 4: คะแนนดาว & แต้มสะสมชื่นชม */}
          <button
            type="button"
            id="tab-btn-praise-ratings"
            onClick={() => setActiveTab('praise')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === 'praise'
                ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md shadow-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span>คะแนนดาว & แต้มสะสมชื่นชม</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-bold">
              {teacherKudosPoints} แต้ม
            </span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 pr-1 space-y-4">
          
          {/* =========================================================================
              TAB 1: ข้อมูลส่วนตัว (Personal Info Editor)
              - ชื่อ-นามสกุล, ชื่อเล่น, โรงเรียน, บทบาท
              - บันทึกและแก้ไขได้ตลอดเวลา
             ========================================================================= */}
          {activeTab === 'info' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Alert notification when saved successfully */}
              {saveSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>บันทึกข้อมูลส่วนตัวลงในระบบและเชื่อมต่อ Firebase สำเร็จเรียบร้อยแล้ว</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">Synced</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. ชื่อ-นามสกุล */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    ชื่อ-นามสกุล <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="input-profile-fullname"
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      placeholder="เช่น ม.วีระพงษ์ มีทรัพย์"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white text-sm transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">ชื่อและนามสกุลจริงสำหรับการออกเกียรติบัตรและแสดงในคลังสื่อ</p>
                </div>

                {/* 2. ชื่อเล่น */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    ชื่อเล่น (Nickname)
                  </label>
                  <input
                    type="text"
                    id="input-profile-nickname"
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    placeholder="เช่น ครูปอย / น้องกานต์"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white text-sm transition-all"
                  />
                  <p className="text-[11px] text-slate-500">ชื่อเล่นสำหรับการเรียกขานอย่างเป็นกันเองในระบบ</p>
                </div>

                {/* 3. โรงเรียน */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    โรงเรียน / สังกัดสถานศึกษา <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="input-profile-school"
                      value={schoolInput}
                      onChange={(e) => setSchoolInput(e.target.value)}
                      placeholder="โรงเรียนอัสสัมชัญอุบลราชธานี"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white text-sm transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">ระบุชื่อโรงเรียนที่ปฏิบัติงานหรือกำลังศึกษาอยู่</p>
                </div>

                {/* 4. ตำแหน่ง / บทบาท */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    ตำแหน่ง / บทบาทในระบบ
                  </label>
                  <input
                    type="text"
                    id="input-profile-role"
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    placeholder="ครูผู้สอน / บุคลากรทางการศึกษา / นักเรียน"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white text-sm transition-all"
                  />
                  <p className="text-[11px] text-slate-500">แสดงกำกับบนการ์ดผลงานและสื่อนวัตกรรม</p>
                </div>
              </div>

              {/* Account Security & Google SSO info */}
              <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span>บัญชียืนยันตัวตน Google SSO:</span>
                  <span className="font-mono text-white font-medium">{userEmail}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAvatarEditModal(true)}
                  className="text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1 transition-colors text-xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>เปลี่ยนรูปโปรไฟล์</span>
                </button>
              </div>

              {/* Save Button */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                <span className="text-xs text-slate-500">
                  * สามารถกลับมาแก้ไขข้อมูลได้ตลอดเวลา ข้อมูลจะอัปเดตทันที
                </span>
                <button
                  type="button"
                  id="btn-save-personal-info"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังบันทึกข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>บันทึกข้อมูลส่วนตัว</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: ปุ่มเช็คสถานะการส่งสื่อและนวัตกรรม 5 ชิ้น
              - แสดงภาพรวม 5 ชิ้น พร้อมความคืบหน้า Progress bar
              - สามารถตรวจสอบและกดอัปเดตสถานะของแต่ละชิ้นงานได้
             ========================================================================= */}
          {activeTab === 'innovations' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Progress Summary Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-500/30 shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2.5">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>สถานะการส่งผลงานสื่อและนวัตกรรมการเรียนรู้ (5 ชิ้น)</span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      ตามเกณฑ์มาตรฐานการพัฒนาคลังสื่อและนวัตกรรมการศึกษา โรงเรียนอัสสัมชัญอุบลราชธานี
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/30 border border-blue-400/40 text-blue-300 text-xs font-bold">
                    <span>ส่งแล้ว {completedInnovationsCount} จาก 5 ชิ้น</span>
                    <span>({progressPercent}%)</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* 5 Innovation Items List */}
              <div className="space-y-3">
                {profile.innovations.map((item, idx) => {
                  const isEditing = editingInnovationId === item.id;
                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium">
                      <Clock className="w-3 h-3" />
                      <span>รอส่งผลงาน</span>
                    </span>
                  );

                  if (item.status === 'approved') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>ผ่านการอนุมัติแล้ว</span>
                      </span>
                    );
                  } else if (item.status === 'submitted') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-medium">
                        <Check className="w-3 h-3 text-blue-400" />
                        <span>ส่งผลงานแล้ว</span>
                      </span>
                    );
                  } else if (item.status === 'under_review') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-medium">
                        <RefreshCw className="w-3 h-3 text-purple-400" />
                        <span>อยู่ระหว่างตรวจสอบ</span>
                      </span>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70 hover:border-slate-600 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Cover Image Thumbnail or Number badge */}
                        {item.coverImageUrl ? (
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 flex-shrink-0 relative group/thumb shadow-sm">
                            <img
                              src={item.coverImageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/ACU N.png';
                              }}
                            />
                            <div className="absolute top-0.5 left-0.5 bg-black/70 px-1 rounded text-[9px] text-white font-bold">
                              #{idx + 1}
                            </div>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold text-sm flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                              ชิ้นที่ {item.id}: {item.category}
                            </span>
                            {statusBadge}
                          </div>

                          {isEditing ? (
                            <div className="space-y-2 mt-2">
                              <input
                                type="text"
                                defaultValue={item.title}
                                id={`edit-item-title-${item.id}`}
                                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-xs text-white"
                                placeholder="ชื่อชิ้นงานสื่อ / นวัตกรรม"
                              />
                              <div className="flex items-center gap-2 flex-wrap">
                                <select
                                  id={`edit-item-status-${item.id}`}
                                  defaultValue={item.status}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-xs text-slate-200"
                                >
                                  <option value="approved">ผ่านการอนุมัติแล้ว</option>
                                  <option value="submitted">ส่งผลงานแล้ว</option>
                                  <option value="under_review">อยู่ระหว่างตรวจสอบ</option>
                                  <option value="pending">รอส่งผลงาน</option>
                                </select>
                                <input
                                  type="text"
                                  id={`edit-item-link-${item.id}`}
                                  defaultValue={item.linkUrl || ''}
                                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-xs text-white"
                                  placeholder="ลิงก์ผลงาน (Google Drive / YouTube / เว็บไซต์)"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const titleEl = document.getElementById(`edit-item-title-${item.id}`) as HTMLInputElement;
                                    const statusEl = document.getElementById(`edit-item-status-${item.id}`) as HTMLSelectElement;
                                    const linkEl = document.getElementById(`edit-item-link-${item.id}`) as HTMLInputElement;
                                    handleUpdateInnovation(item.id, {
                                      title: titleEl?.value || item.title,
                                      status: (statusEl?.value as any) || item.status,
                                      linkUrl: linkEl?.value || item.linkUrl,
                                      submittedDate: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }),
                                    });
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                                >
                                  บันทึกชิ้นนี้
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingInnovationId(null)}
                                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <h4 className="text-sm font-semibold text-white tracking-normal line-clamp-1">
                                {item.title}
                              </h4>
                              {item.notes && (
                                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                                  {item.notes}
                                </p>
                              )}
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                                <span>วันที่ส่ง: {item.submittedDate}</span>
                                {item.linkUrl && (
                                  <a
                                    href={item.linkUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sky-400 hover:text-sky-300 underline inline-flex items-center gap-0.5"
                                  >
                                    <span>ดูผลงาน</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Action edit button */}
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => setEditingInnovationId(item.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium inline-flex items-center gap-1 transition-colors self-end sm:self-center"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                          <span>อัปเดตชิ้นงาน</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 3: เช็คสถิติการเข้าชม (Visitor & Engagement Statistics)
              - ยอดวิว ยอดผู้เข้าชมที่ไม่ซ้ำ แต้มสะสม และสถิติวิเคราะห์
             ========================================================================= */}
          {/* =========================================================================
              TAB 3: เช็คสถิติการเข้าชม (Visitor & Engagement Statistics)
              - คิดตามจำนวนคนที่เข้าต่อครั้งจริงเท่านั้น ไม่บวกเพิ่ม
              - ยอดรวมทั้งระบบและยอดรวมแต่ละเดือนตรงกัน 100%
              - ผู้ดูแลระบบสามารถรีเซ็ตสถิติเพื่อเริ่มนับจริงได้
             ========================================================================= */}
          {activeTab === 'stats' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Admin Reset Banner (Only for Admin weerapong1625@acu.ac.th) */}
              {isMasterWeerapong && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950/60 to-slate-900 border border-red-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-red-200">เครื่องมือแอดมิน: รีเซ็ตสถิติผู้เข้าชมทั้งระบบเป็น 0</p>
                      <p className="text-[11px] text-slate-400">ล้างประวัติการเข้าใช้งานเดิมทั้งหมด เพื่อเริ่มนับตามจำนวนครั้งจริง 1 ครั้ง = 1 ยอดเข้าชม</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetAllVisitorLogs}
                    disabled={isResettingLogs}
                    className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50 self-end sm:self-auto"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isResettingLogs ? 'animate-spin' : ''}`} />
                    <span>{isResettingLogs ? 'กำลังรีเซ็ต...' : 'รีเซ็ตสถิติเป็น 0'}</span>
                  </button>
                </div>
              )}

              {/* Reset Success Notice */}
              {resetLogsSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{resetLogsSuccess}</span>
                </div>
              )}

              {/* Year Filter & Real Audit Notice */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">สถิติการเข้าใช้งานจริง (คิดตามจริงต่อครั้ง ไม่บวกเพิ่ม)</h4>
                    <p className="text-[11px] text-slate-400">คำนวณตามประวัติการเข้าสู่ระบบจริง ยอดสรุปรวมตรงกับรายเดือน 100%</p>
                  </div>
                </div>

                {/* Year Selector */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-xs text-slate-300 font-medium">เลือกปีที่เข้าชม:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {Array.from({ length: 13 }, (_, i) => {
                      const yr = (new Date().getFullYear() || 2026) + 10 - i;
                      return (
                        <option key={yr} value={yr.toString()}>
                          พ.ศ. {yr + 543} ({yr})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Stat Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Metric 1: ยอดเข้าชมของตนเอง */}
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-2">
                    <Eye className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-slate-400">ยอดเข้าชมของตัวเอง ({selectedYear})</p>
                  <p className="text-xl sm:text-2xl font-black text-white mt-0.5">
                    {verifiedStats.myYearVisits} <span className="text-xs font-normal text-slate-400">ครั้ง</span>
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-700/50 pt-1">
                    <span>วันนี้: {verifiedStats.myTodayVisits}</span>
                    <span>เดือนนี้: {verifiedStats.myMonthVisits}</span>
                  </div>
                </div>

                {/* Metric 2: ยอดรวมผู้เข้าชมทั้งระบบคิดตามจริง */}
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2">
                    <User className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-slate-400">ยอดเข้าชมทั้งระบบ ({selectedYear})</p>
                  <p className="text-xl sm:text-2xl font-black text-indigo-300 mt-0.5">
                    {verifiedStats.allYearVisits} <span className="text-xs font-normal text-slate-400">ครั้ง</span>
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-700/50 pt-1">
                    <span>ผู้ใช้จริง: {verifiedStats.uniqueVerifiedUsersYear} บัญชี</span>
                    <span>วันนี้: {verifiedStats.allTodayVisits} ครั้ง</span>
                  </div>
                </div>

                {/* Metric 3: คะแนนดาวสะสม (การเข้าชม 1 ครั้ง = 1 ดาว) */}
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </div>
                  <p className="text-xs text-slate-400">คะแนนดาวสะสม (การเข้าชม)</p>
                  <p className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
                    {verifiedStats.myTotalVisits} <span className="text-xs font-normal text-slate-400">ดาว</span>
                  </p>
                  <div className="mt-1 text-[10px] text-slate-400 border-t border-slate-700/50 pt-1">
                    <span>1 ครั้ง = 1 ดาว (เข้าจริง {verifiedStats.myTotalVisits} ครั้ง)</span>
                  </div>
                </div>

                {/* Metric 4: แต้มสะสมชื่นชม (จากผลงานสื่อที่โพสต์แล้วมีคนกดถูกใจ) */}
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-2">
                    <Heart className="w-4 h-4 fill-rose-400 text-rose-400" />
                  </div>
                  <p className="text-xs text-slate-400">แต้มสะสมชื่นชม (ผลงานสื่อ)</p>
                  <p className="text-xl sm:text-2xl font-black text-rose-400 mt-0.5">
                    {teacherKudosPoints} <span className="text-xs font-normal text-slate-400">แต้ม</span>
                  </p>
                  <div className="mt-1 text-[10px] text-slate-400 border-t border-slate-700/50 pt-1">
                    <span>สื่อ {myMediaWorks.length} ชิ้น • ถูกใจ {teacherKudosPoints} ครั้ง</span>
                  </div>
                </div>
              </div>

              {/* Monthly Statistics Breakdown Table for Selected Year */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/70">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-purple-400" />
                    <span>สรุปสถิติการเข้าใช้งานรายเดือน ประจำปี {selectedYear} (คิดตามจริง ไม่บวกเพิ่ม)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">12 เดือน ตรงกับยอดรวม</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-2 text-center">
                  {verifiedStats.monthlyData.map((m) => (
                    <div
                      key={m.monthIndex}
                      className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between"
                    >
                      <span className="text-[11px] font-semibold text-slate-300">{m.monthName}</span>
                      <span className="text-sm font-bold text-indigo-300 my-0.5">{m.allCount}</span>
                      <span className="text-[9px] text-slate-400">ตนเอง: {m.myCount}</span>
                    </div>
                  ))}
                </div>

                {/* Mathematical Alignment Guarantee Summary */}
                <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 gap-1.5">
                  <span className="font-medium">
                    ยอดรวมทั้งปี {selectedYear}: เข้าชมทั้งระบบ <strong className="text-indigo-400">{verifiedStats.allYearVisits}</strong> ครั้ง | ของตนเอง <strong className="text-blue-400">{verifiedStats.myYearVisits}</strong> ครั้ง
                  </span>
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ยอดรวมแต่ละเดือนตรงกับยอดสรุป 100% คิดตามจริง ไม่บวกเพิ่ม
                  </span>
                </div>
              </div>

              {/* Real Activity & Login Audit Log */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <span>บันทึกความเคลื่อนไหวการเข้าสู่ระบบล่าสุดของคุณ (คิด 1 ครั้ง = 1 ดาว)</span>
                </h4>
                
                {verifiedStats.myRecentLogs.length > 0 ? (
                  <div className="space-y-1.5">
                    {verifiedStats.myRecentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="text-slate-200 font-medium truncate max-w-[200px] sm:max-w-xs">{log.email}</span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px]">
                            {log.loginMethod || 'Google'}
                          </span>
                        </div>
                        <div className="text-right text-[11px] text-slate-400 flex-shrink-0">
                          {log.loginDate} {log.loginTime}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-slate-400 bg-slate-900/40 rounded-xl">
                    เริ่มนับสถิติการเข้าสู่ระบบตามความเป็นจริงตั้งแต่วันนี้เป็นต้นไป
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 4: คะแนนดาว & แต้มสะสมชื่นชม
              - คะแนนดาว: คำนวณจากการเข้าชมเว็บไซต์ ครั้งละ 1 แต้ม อ้างอิงประวัติการเข้าชมตนเอง
              - แต้มสะสมชื่นชม: เริ่มต้นคงค่า 0 แต้ม นับจากเมื่อคุณครูโพสต์สื่อ และมีคนกดถูกใจที่หน้าคลังสื่อ
              - สมุดบันทึกข้อความชื่นชมและคำนิยม
             ========================================================================= */}
          {activeTab === 'praise' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Section 1: คะแนนดาวสะสมจากการเข้าชมระบบ (Star Points) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-850 to-slate-900 border border-amber-500/30 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        คะแนนดาวสะสมจากการเข้าชมเว็บไซต์ (1 ครั้ง = 1 แต้มดาว)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        อ้างอิงจากข้อมูลการเข้าชมระบบของตนเองของผู้ใช้งานจริง นับตามจำนวนครั้งจริง
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-black flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-300" />
                    <span>{verifiedStats.myTotalVisits} แต้มดาว</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-slate-700/60 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400">เข้าชมทั้งหมด</span>
                    <p className="text-base font-bold text-amber-400 mt-0.5">{verifiedStats.myTotalVisits} ครั้ง</p>
                    <span className="text-[9px] text-slate-500">={verifiedStats.myTotalVisits} ดาว</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400">เข้าชมปี {selectedYear}</span>
                    <p className="text-base font-bold text-white mt-0.5">{verifiedStats.myYearVisits} ครั้ง</p>
                    <span className="text-[9px] text-slate-500">={verifiedStats.myYearVisits} ดาว</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400">เข้าชมเดือนนี้</span>
                    <p className="text-base font-bold text-white mt-0.5">{verifiedStats.myMonthVisits} ครั้ง</p>
                    <span className="text-[9px] text-slate-500">={verifiedStats.myMonthVisits} ดาว</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400">เข้าชมวันนี้</span>
                    <p className="text-base font-bold text-white mt-0.5">{verifiedStats.myTodayVisits} ครั้ง</p>
                    <span className="text-[9px] text-slate-500">={verifiedStats.myTodayVisits} ดาว</span>
                  </div>
                </div>
              </div>

              {/* Section 2: แต้มสะสมชื่นชมจากผลงานสื่อนวัตกรรม (Teacher Media Kudos) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-rose-950/40 via-slate-850 to-slate-900 border border-rose-500/30 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                      <Heart className="w-5 h-5 fill-rose-400 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        คะแนนแต้มสะสมชื่นชมจากผลงานสื่อ (คงค่า 0 แต้มเริ่มต้น)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        นับแต้มจากเมื่อคุณครูโพสต์สื่อ และสื่อของคุณครูคนนั้นมีคนกดถูกใจที่หน้าคลังสื่อ
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-xs font-black flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 fill-rose-300" />
                    <span>{teacherKudosPoints} แต้ม</span>
                  </div>
                </div>

                {/* Teacher's media works list and their like counts */}
                <div className="mt-3 pt-3 border-t border-slate-700/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">
                      ผลงานสื่อของคุณครูในคลัง ({myMediaWorks.length} ชิ้น):
                    </span>
                    <span className="text-[11px] text-rose-400 font-medium">
                      ถูกใจรวม {teacherKudosPoints} ครั้ง
                    </span>
                  </div>

                  {myMediaWorks.length > 0 ? (
                    <div className="space-y-2">
                      {myMediaWorks.map((work) => (
                        <div
                          key={work.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {work.thumbnailUrl ? (
                              <img
                                src={work.thumbnailUrl}
                                alt={work.title}
                                className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-slate-700"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-400">
                                <FileText className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">{work.title}</p>
                              <p className="text-[10px] text-slate-400 truncate">{work.subjectGroup || work.subjectName || work.mediaType || 'สื่อนวัตกรรม'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                              <span>{work.likes || 0} ถูกใจ</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-center space-y-2">
                      <p className="text-xs text-slate-400">
                        คุณครูยังไม่มีผลงานสื่อในคลังสื่อ (แต้มสะสมชื่นชมคงค่า 0 แต้ม)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        เมื่อส่งผลงานสื่อและมีผู้เข้าชมกดถูกใจที่หน้าคลังสื่อ แต้มจะถูกนำมารวมที่นี่โดยอัตโนมัติ
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('innovations')}
                        className="mt-1 px-3.5 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 text-xs font-medium transition-colors"
                      >
                        ไปยังหน้าส่งสื่อนวัตกรรม 5 ชิ้น
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: แบบฟอร์มส่งข้อความชื่นชมและคำนิยม (Wall of Praises) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/80 border border-slate-700 shadow-md space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                      <ThumbsUp className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        สมุดบันทึกข้อความชื่นชมและคำนิยม
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        ร่วมเขียนข้อความชื่นชม ให้กำลังใจ และเสนอแนะแก่ผู้พัฒนานวัตกรรม
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">
                    {profile.praises?.length || 0} ข้อความ
                  </span>
                </div>

                {praiseSuccessNotice && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{praiseSuccessNotice}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitPraise} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        ชื่อผู้เข้าชม / ผู้ร่วมชื่นชม:
                      </label>
                      <input
                        type="text"
                        value={visitorNameInput}
                        onChange={(e) => setVisitorNameInput(e.target.value)}
                        placeholder="เช่น ครูวิชาญ / นักเรียน ม.4"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        โรงเรียน / หน่วยงานผู้เข้าชม:
                      </label>
                      <input
                        type="text"
                        value={visitorSchoolInput}
                        onChange={(e) => setVisitorSchoolInput(e.target.value)}
                        placeholder="โรงเรียนอัสสัมชัญอุบลราชธานี"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      ข้อความชื่นชมและข้อเสนอแนะ:
                    </label>
                    <textarea
                      rows={2}
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="เขียนข้อความชื่นชม ให้กำลังใจ หรือแสดงความประทับใจในสื่อนวัตกรรม..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                    />

                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span className="text-[10px] text-slate-500">ข้อความด่วน:</span>
                      {QUICK_PRAISE_TEMPLATES.map((tmpl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCommentInput(tmpl)}
                          className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-slate-300 hover:text-white transition-colors"
                        >
                          {tmpl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSubmittingPraise}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-semibold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingPraise ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังส่ง...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>ส่งข้อความชื่นชม</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Display list of praises if any */}
                {profile.praises && profile.praises.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-slate-700/60">
                    <h5 className="text-xs font-semibold text-slate-300">ข้อความชื่นชมล่าสุด:</h5>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {profile.praises.slice(0, 10).map((praise, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200">{praise.visitorName || 'ผู้เข้าชม'}</span>
                            <span className="text-[10px] text-slate-400">{praise.timestamp || ''}</span>
                          </div>
                          {praise.comment && (
                            <p className="text-slate-300 text-xs">{praise.comment}</p>
                          )}
                          {praise.visitorSchool && (
                            <p className="text-[10px] text-slate-500">{praise.visitorSchool}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Sticky Exit / Action Bar */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>สถานะระบบ: เชื่อมต่อฐานข้อมูลออนไลน์</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-bottom-exit-profile"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium transition-colors inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5 rotate-180" />
              <span>กดออกหน้านี้</span>
            </button>
            {activeTab === 'info' && (
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md transition-colors inline-flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>บันทึก</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Embedded Avatar Editor Modal */}
      {showAvatarEditModal && (
        <EditProfileModal
          isOpen={showAvatarEditModal}
          onClose={() => setShowAvatarEditModal(false)}
          userEmail={userEmail}
          displayName={profile.fullName || userName}
          currentAvatarUrl={profile.avatarUrl || avatarUrl}
          onSaveAvatar={async (newAvatarUrl) => {
            const updatedProfile: FullUserProfile = {
              ...profile,
              avatarUrl: newAvatarUrl,
              updatedAt: new Date().toISOString(),
            };
            setProfile(updatedProfile);
            await saveFullUserProfile(updatedProfile);
            onAvatarUpdated(newAvatarUrl);
            setShowAvatarEditModal(false);
          }}
        />
      )}
    </div>
  );
};
