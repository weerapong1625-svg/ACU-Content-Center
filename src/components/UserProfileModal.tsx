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
  RotateCcw,
  Printer,
  Trash2,
  Gift,
  Youtube,
  HardDrive,
  Palette,
  Globe
} from 'lucide-react';
import {
  detectMediaLinkCategory,
  resolveDisplayThumbnailUrl,
} from '../utils/mediaThumbnailUtils';
import { SpecialPrivilegesModal } from './SpecialPrivilegesModal';
import { 
  FullUserProfile, 
  InnovationItem, 
  subscribeFullUserProfile,
  saveFullUserProfile, 
  saveUserPhotoToFirestore,
  addVisitorPraiseAndRating, 
  getCachedUserProfile,
  DEFAULT_INNOVATION_ITEMS,
  getCleanRealName
} from '../services/userProfileService';
import {
  resolveDisplayAvatarUrl,
  sanitizeAvatarUrl,
  getMatchingAuthPhotoUrl,
  buildFallbackAvatarUrl,
  isUiAvatarPlaceholder,
} from '../utils/avatarUtils';
import { SUPER_ADMIN_EMAIL, isSuperAdmin } from '../services/logoService';
import { 
  subscribeAllInnovations,
  deleteInnovationSubmission,
  deleteTeacherMedia,
  InnovationSubmission,
  subscribeTeacherMedia, 
  TeacherMediaWork,
  isValidActiveMediaRecord,
  doesMediaRecordBelongToTeacher,
  getUnifiedTeacherMediaRecords,
  syncUserSubmissionCountIfOutOfSync,
  refreshAllInnovations,
  refreshTeacherMedia
} from '../services/submissionService';
import { 
  subscribeAllLoginLogs, 
  subscribeSiteSummary,
  fetchSiteSummaryOnce,
  getLocalSiteSummary,
  SiteVisitSummary,
  LoginLogEntry, 
  resetAllLoginLogs,
  resetAdminLoginLogs,
  resetUserLoginLogsByEmail,
  getBangkokDateParts
} from '../services/auditService';
import { EditProfileModal } from './EditProfileModal';
import { OnlineCertificateModal } from './OnlineCertificateModal';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName: string;
  avatarUrl: string;
  onAvatarUpdated: (newUrl: string) => void;
  onProfileUpdated?: (updated: FullUserProfile) => void;
  currentUserEmail?: string;
  onUserDeleted?: (deletedEmail: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  userName,
  avatarUrl,
  onAvatarUpdated,
  onProfileUpdated,
  currentUserEmail,
  onUserDeleted,
}) => {
  // Active Tab: 'info' (ข้อมูลส่วนตัว) | 'innovations' (สถานะส่งสื่อ 5 ชิ้น) | 'stats' (สถิติการเข้าชม) | 'praise' (ให้ดาวและชื่นชม)
  const [activeTab, setActiveTab] = useState<'info' | 'innovations' | 'stats' | 'praise'>('info');

  // Profile Data State initialized synchronously to prevent delay
  const isMasterWeerapong = userEmail.toLowerCase().trim() === 'weerapong1625@acu.ac.th';

  // Check if current active session user is Admin (weerapong1625@acu.ac.th)
  const activeViewerEmail = (
    currentUserEmail ||
    (typeof window !== 'undefined' ? (localStorage.getItem('acu_current_user_email') || localStorage.getItem('acu_user_email') || '') : '') ||
    userEmail ||
    ''
  ).trim().toLowerCase();
  const isViewerAdmin = isSuperAdmin(activeViewerEmail);
  const isAdmin = isViewerAdmin;
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
  const [isSavingInnovationItem, setIsSavingInnovationItem] = useState<boolean>(false);
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

  // Verified login logs & Year selector (strictly read from local/memory cache on open — 0 Firestore reads)
  const [loginLogs, setLoginLogs] = useState<LoginLogEntry[]>([]);
  const [siteSummary, setSiteSummary] = useState<SiteVisitSummary | null>(() => getLocalSiteSummary());
  const [selectedYear, setSelectedYear] = useState<string>(() => String(getBangkokDateParts()?.year || new Date().getFullYear()));
  const [teacherMediaList, setTeacherMediaList] = useState<TeacherMediaWork[]>([]);
  const [allInnovationsList, setAllInnovationsList] = useState<InnovationSubmission[]>([]);
  const [deletingSlotId, setDeletingSlotId] = useState<number | null>(null);
  const [isResettingLogs, setIsResettingLogs] = useState<boolean>(false);
  const [resetLogsSuccess, setResetLogsSuccess] = useState<string | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState<boolean>(false);
  const [refreshCooldownNotice, setRefreshCooldownNotice] = useState<string | null>(null);
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);
  const [showPrivilegesModal, setShowPrivilegesModal] = useState<boolean>(false);

  // Subscribe to cached login logs + cached site_summary (0 Firestore reads on modal open or tab switch)
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeAllLoginLogs((logs) => {
      setLoginLogs((prev) => (logs.length > 0 || prev.length === 0 ? logs : prev));
    });
    const unsubSummary = subscribeSiteSummary((summary) => {
      if (summary) {
        setSiteSummary((prev) => {
          if (!prev) return summary;
          if ((summary.totalVisits || 0) === 0 && !summary.resetAt && (prev.totalVisits || 0) > 0) {
            return prev;
          }
          return summary;
        });
      }
    });

    return () => {
      unsub();
      unsubSummary();
    };
  }, [isOpen]);

  // Subscribe to cached teacher media repository (6h localStorage TTL)
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeTeacherMedia((works) => {
      setTeacherMediaList((prev) => (works.length > 0 || prev.length === 0 ? works : prev));
    });
    return () => unsub();
  }, [isOpen]);

  const handleManualRefreshProfileStats = async () => {
    if (isManualRefreshing) return;
    setRefreshCooldownNotice(null);
    setIsManualRefreshing(true);
    try {
      const [innovsRes, mediaRes, summaryRes] = await Promise.allSettled([
        refreshAllInnovations(true),
        refreshTeacherMedia(true),
        fetchSiteSummaryOnce(true),
      ]);
      if (innovsRes.status === 'fulfilled' && Array.isArray(innovsRes.value) && innovsRes.value.length > 0) {
        setAllInnovationsList(innovsRes.value);
      }
      if (mediaRes.status === 'fulfilled' && Array.isArray(mediaRes.value) && mediaRes.value.length > 0) {
        setTeacherMediaList(mediaRes.value);
      }
      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        setSiteSummary(summaryRes.value);
      }
    } finally {
      setIsManualRefreshing(false);
    }
  };

  // Handle Admin's OWN visitor logs reset to 0 (never touches other users)
  const handleResetAdminOnlyStats = async () => {
    if (!window.confirm(`ยืนยันการรีเซ็ตสถิติการเข้าชมเฉพาะของ Admin (${SUPER_ADMIN_EMAIL}) เป็น 0 ใช่หรือไม่? (ข้อมูลคนอื่นจะคงเดิม)`)) {
      return;
    }
    setIsResettingLogs(true);
    try {
      const res = await resetAdminLoginLogs(SUPER_ADMIN_EMAIL);
      if (res.success) {
        const normAdmin = SUPER_ADMIN_EMAIL.toLowerCase().trim();
        setLoginLogs((prev) => prev.filter((l) => (l.email || '').trim().toLowerCase() !== normAdmin));
        if (isMasterWeerapong) {
          setProfile((prev) => {
            const next = {
              ...prev,
              stats: { ...prev.stats, totalViews: 0, uniqueVisitors: 0 },
            };
            onProfileUpdated?.(next);
            return next;
          });
        }
        setResetLogsSuccess(`รีเซ็ตสถิติการเข้าชมของ Admin เป็น 0 สำเร็จแล้ว (ล้างประวัติ ${res.count} รายการ)`);
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

  // Handle resetting a specific viewed user's visitor logs to 0 (never touches other users)
  const handleResetTargetUserStats = async () => {
    const targetNorm = userEmail.toLowerCase().trim();
    if (!window.confirm(`ยืนยันการรีเซ็ตสถิติการเข้าชมของ ${targetNorm} เป็น 0 ใช่หรือไม่? (ข้อมูลของคนอื่นจะคงเดิม)`)) {
      return;
    }
    setIsResettingLogs(true);
    try {
      const res = await resetUserLoginLogsByEmail(targetNorm, SUPER_ADMIN_EMAIL);
      if (res.success) {
        setLoginLogs((prev) => prev.filter((l) => (l.email || '').trim().toLowerCase() !== targetNorm));
        setProfile((prev) => {
          const next = {
            ...prev,
            stats: { ...prev.stats, totalViews: 0, uniqueVisitors: 0 },
          };
          onProfileUpdated?.(next);
          return next;
        });
        setResetLogsSuccess(`รีเซ็ตสถิติการเข้าชมของ ${targetNorm} เป็น 0 สำเร็จแล้ว (ล้างประวัติ ${res.count} รายการ)`);
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

  // Handle Admin visitor logs reset ALL users to 0
  const handleResetAllVisitorLogs = async () => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตสถิติการเข้าชมของทุกคนในระบบ (ทั้ง Admin และผู้ใช้งานทุกคน) เป็น 0 เพื่อเริ่มนับตามจำนวนครั้งจริง?')) {
      return;
    }
    setIsResettingLogs(true);
    try {
      const res = await resetAllLoginLogs();
      if (res.success) {
        setLoginLogs([]);
        setProfile((prev) => {
          const next = {
            ...prev,
            stats: { ...prev.stats, totalViews: 0, uniqueVisitors: 0 },
          };
          onProfileUpdated?.(next);
          return next;
        });
        setResetLogsSuccess(`รีเซ็ตสถิติผู้เข้าชมทุกคนในระบบเป็น 0 สำเร็จแล้ว (ลบประวัติเดิม ${res.count} รายการ)`);
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

  // Sync profile data in real-time across all devices (without clobbering active unsaved inputs)
  const initializedFormKeyRef = useRef<string>('');
  useEffect(() => {
    if (!isOpen) {
      initializedFormKeyRef.current = '';
      return;
    }

    const normEmail = userEmail.toLowerCase().trim();
    const formKey = `${normEmail}::open`;
    const localAvatar = typeof window !== 'undefined'
      ? (localStorage.getItem(`acu_user_avatar_${normEmail}`) || localStorage.getItem(`acu_user_avatar_${userEmail.trim()}`) || '')
      : '';

    const applyProfileSnapshot = (incoming: FullUserProfile, allowFormReset: boolean) => {
      const latestCached = getCachedUserProfile(userEmail);
      const latestLocalAvatar = typeof window !== 'undefined'
        ? (localStorage.getItem(`acu_user_avatar_${normEmail}`) || localStorage.getItem(`acu_user_avatar_${userEmail.trim()}`) || '')
        : '';
      const resolvedRaw = resolveDisplayAvatarUrl({
        customPhotoUrl: incoming.photoURL,
        firestoreAvatarUrl: incoming.avatarUrl,
        authPhotoUrl: getMatchingAuthPhotoUrl(userEmail),
        localCachedAvatarUrl:
          sanitizeAvatarUrl(latestCached?.avatarUrl) ||
          sanitizeAvatarUrl(latestLocalAvatar) ||
          sanitizeAvatarUrl(localAvatar) ||
          sanitizeAvatarUrl(avatarUrl),
        fallbackSeedName: incoming.fullName || userName,
      });
      const effectiveAvatar = isUiAvatarPlaceholder(resolvedRaw) ? '' : resolvedRaw;
      const mergedData: FullUserProfile = {
        ...incoming,
        avatarUrl: effectiveAvatar,
        photoURL: effectiveAvatar,
      };
      setProfile(mergedData);
      if (allowFormReset) {
        setFullNameInput(mergedData.fullName || userName || '');
        setNicknameInput(mergedData.nickname || '');
        setSchoolInput(mergedData.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี');
        setRoleInput(mergedData.role || 'ครูผู้สอน / ผู้พัฒนานวัตกรรม');
      }
    };

    const cached = getCachedUserProfile(userEmail);
    if (cached) {
      applyProfileSnapshot(cached, initializedFormKeyRef.current !== formKey);
      initializedFormKeyRef.current = formKey;
    } else if (initializedFormKeyRef.current !== formKey) {
      setFullNameInput(isMasterWeerapong ? '(Admin) ม.วีระพงษ์ มีทรัพย์' : (userName || userEmail.split('@')[0]));
      setNicknameInput('');
      setSchoolInput('โรงเรียนอัสสัมชัญอุบลราชธานี');
      setRoleInput(isMasterWeerapong ? 'ผู้ดูแลระบบและพัฒนานวัตกรรม' : 'ครูผู้สอน / ผู้พัฒนานวัตกรรม');
    }

    let isMounted = true;
    const unsubProfile = subscribeFullUserProfile(userEmail, (liveProf) => {
      if (!isMounted || !liveProf) return;
      const shouldInitForm = initializedFormKeyRef.current !== formKey;
      applyProfileSnapshot(liveProf, shouldInitForm);
      initializedFormKeyRef.current = formKey;
    });

    return () => {
      isMounted = false;
      unsubProfile();
    };
  }, [isOpen, userEmail, userName, isMasterWeerapong]);

  // Subscribe to all innovations via 6h cached stream
  useEffect(() => {
    if (!isOpen || !userEmail) return;
    const unsubscribe = subscribeAllInnovations((allInnos) => {
      setAllInnovationsList((prev) => (allInnos.length > 0 || prev.length === 0 ? allInnos : prev));
    });
    return () => unsubscribe();
  }, [isOpen, userEmail]);

  const liveUserSubmissions = React.useMemo(() => {
    const teacherMatcher = {
      uid: profile?.uid,
      email: userEmail,
      fullName: profile?.fullName || userName,
      displayName: profile?.displayName,
    };
    return allInnovationsList
      .filter((item) => isValidActiveMediaRecord(item) && doesMediaRecordBelongToTeacher(item, teacherMatcher))
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [allInnovationsList, profile?.uid, profile?.fullName, profile?.displayName, userEmail, userName]);

  // Unified submissions across BOTH teacher_innovations_submissions and teacher_media_repository (deduplicated)
  const unifiedMedia = React.useMemo(() => {
    return getUnifiedTeacherMediaRecords(
      {
        uid: profile?.uid,
        email: userEmail,
        fullName: profile?.fullName || userName,
        displayName: profile?.displayName,
      },
      allInnovationsList,
      teacherMediaList
    );
  }, [profile?.uid, profile?.fullName, profile?.displayName, userEmail, userName, allInnovationsList, teacherMediaList]);

  // Merge unified 5-slot display items cleanly (preserving valid legacy profile slots for non-master accounts when needed)
  const mergedInnovations: InnovationItem[] = React.useMemo(() => {
    return DEFAULT_INNOVATION_ITEMS.map((defItem, idx) => {
      const unifiedSlot = unifiedMedia.slots[idx];
      if (unifiedSlot && (unifiedSlot.title || unifiedSlot.status !== 'pending')) {
        return unifiedSlot;
      }
      if (!isMasterWeerapong) {
        const existing = profile.innovations?.find((ex) => ex.id === defItem.id);
        if (existing && existing.title && existing.status !== 'pending') {
          return existing;
        }
      }
      return defItem;
    });
  }, [unifiedMedia.slots, profile.innovations, isMasterWeerapong]);

  // Calculate dynamic completed count (prefer unified media count across both collections)
  const completedInnovationsCount = Math.max(
    unifiedMedia.submittedCount,
    mergedInnovations.filter(
      (i) => i.status === 'approved' || i.status === 'submitted' || i.status === 'under_review' || (i.title && i.status !== 'pending')
    ).length
  );
  const progressPercent = Math.min(100, Math.round((completedInnovationsCount / 5) * 100));

  // Self-healing sync: keep user_profiles stats.submissionCount in sync only when media caches are populated
  useEffect(() => {
    if (!isOpen || !userEmail) return;
    if (
      (allInnovationsList.length > 0 || teacherMediaList.length > 0) &&
      completedInnovationsCount !== profile?.stats?.submissionCount
    ) {
      syncUserSubmissionCountIfOutOfSync(
        userEmail,
        completedInnovationsCount,
        profile?.stats?.submissionCount,
        profile?.uid
      );
    }
  }, [
    isOpen,
    userEmail,
    allInnovationsList.length,
    teacherMediaList.length,
    completedInnovationsCount,
    profile?.stats?.submissionCount,
    profile?.uid,
  ]);

  // Media posted by this teacher and total likes (Kudos points) - Strictly year-by-year (ปีต่อปีเท่านั้น ไม่ใช้กับปีอื่น ๆ)
  const targetYearNum = parseInt(selectedYear, 10) || getBangkokDateParts()?.year || new Date().getFullYear();

  const myMediaWorks = React.useMemo(() => {
    const teacherMatcher = {
      uid: profile?.uid,
      email: userEmail,
      fullName: profile?.fullName || userName,
      displayName: profile?.displayName,
    };
    return teacherMediaList.filter((m) => {
      if (!isValidActiveMediaRecord(m)) return false;
      if (!doesMediaRecordBelongToTeacher(m, teacherMatcher)) return false;
      // Filter strictly by the selected academic/calendar year (Asia/Bangkok)
      if (m.createdAt) {
        const parts = getBangkokDateParts(m.createdAt);
        if (parts) {
          return parts.year === targetYearNum;
        }
      }
      return true;
    });
  }, [teacherMediaList, profile?.uid, profile?.fullName, profile?.displayName, userEmail, userName, targetYearNum]);

  // Real-time points accumulated from praise/likes given to teacher's media at repository (starts at 0, strictly year-by-year)
  const teacherKudosPoints = React.useMemo(() => {
    return myMediaWorks.reduce((sum, item) => sum + (item.likes || 0), 0);
  }, [myMediaWorks]);

  // Real-time verified visitor statistics based on authentic Firestore login logs (consistent Bangkok timezone across all devices)
  const verifiedStats = React.useMemo(() => {
    const nowParts = getBangkokDateParts() || {
      year: new Date().getFullYear(),
      monthIndex: new Date().getMonth(),
      day: new Date().getDate(),
      dateKey: new Date().toISOString().split('T')[0],
    };
    const yearNum = parseInt(selectedYear, 10) || nowParts.year;
    const isCurrentYear = nowParts.year === yearNum;
    const currentMonthIdx = nowParts.monthIndex;
    const normTargetEmail = (userEmail || '').toLowerCase().trim();

    const isSameBangkokDay = (ts?: string) => {
      const parts = ts ? getBangkokDateParts(ts) : null;
      return Boolean(parts && parts.dateKey === nowParts.dateKey);
    };

    // Filter by user's email
    const myLogs = loginLogs.filter(
      (l) => l.email?.toLowerCase().trim() === normTargetEmail
    );

    // All logs that fall in selected target year (Bangkok calendar)
    const allYearLogs = loginLogs.filter((l) => {
      const parts = l.loginTimestamp ? getBangkokDateParts(l.loginTimestamp) : null;
      return Boolean(parts && parts.year === yearNum);
    });

    // User's logs in selected target year (Bangkok calendar)
    const myYearLogs = myLogs.filter((l) => {
      const parts = l.loginTimestamp ? getBangkokDateParts(l.loginTimestamp) : null;
      return Boolean(parts && parts.year === yearNum);
    });

    const profileViews = profile?.stats?.totalViews || 0;
    const yearKeyStr = String(yearNum);
    const profileYearlyViews =
      typeof profile?.stats?.yearlyStats?.[yearKeyStr] === 'number'
        ? profile.stats.yearlyStats[yearKeyStr]
        : (isCurrentYear ? profileViews : 0);
    // Fallback for accounts with recorded profile views when login_logs entry is absent
    const useProfileViewsFallback = myYearLogs.length === 0 && profileYearlyViews > 0;

    // Monthly breakdown for selected year (1-12), merging uncapped site_summary counts when available
    const monthNames = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    const summaryYearMonths = siteSummary?.monthlyVisits?.[yearKeyStr] || {};
    const monthlyData = monthNames.map((name, idx) => {
      let myCount = myYearLogs.filter((l) => {
        const parts = getBangkokDateParts(l.loginTimestamp);
        return parts ? parts.monthIndex === idx : false;
      }).length;
      let allCount = allYearLogs.filter((l) => {
        const parts = getBangkokDateParts(l.loginTimestamp);
        return parts ? parts.monthIndex === idx : false;
      }).length;

      if (useProfileViewsFallback && idx === currentMonthIdx) {
        myCount += profileYearlyViews;
        allCount += profileYearlyViews;
      }

      const summaryMonthVal = Number(summaryYearMonths[String(idx)] || 0);
      if (summaryMonthVal > allCount) {
        allCount = summaryMonthVal;
      }

      return {
        monthName: name,
        monthIndex: idx + 1,
        myCount,
        allCount,
      };
    });

    const myYearVisits = Math.max(
      monthlyData.reduce((sum, m) => sum + m.myCount, 0),
      profileYearlyViews
    );
    const monthlySumAll = monthlyData.reduce((sum, m) => sum + m.allCount, 0);
    const summaryYearTotal = Number(siteSummary?.yearlyVisits?.[yearKeyStr] || 0);
    const allYearVisits = Math.max(monthlySumAll, summaryYearTotal);

    const myTodayVisits = isCurrentYear
      ? myYearLogs.filter((l) => isSameBangkokDay(l.loginTimestamp)).length
      : 0;
    const myMonthVisits = isCurrentYear
      ? (monthlyData[currentMonthIdx]?.myCount || 0)
      : 0;

    const allTodayFromLogs = isCurrentYear
      ? allYearLogs.filter((l) => isSameBangkokDay(l.loginTimestamp)).length
      : 0;
    const allTodayFromSummary = isCurrentYear
      ? Number(siteSummary?.dailyVisits?.[nowParts.dateKey] || 0)
      : 0;
    const allTodayVisits = Math.max(allTodayFromLogs, allTodayFromSummary);
    const allMonthVisits = isCurrentYear
      ? (monthlyData[currentMonthIdx]?.allCount || 0)
      : 0;

    const uniqueEmailsInYear = new Set(
      allYearLogs.map((l) => l.email?.toLowerCase().trim()).filter(Boolean)
    );
    if (useProfileViewsFallback && normTargetEmail) {
      uniqueEmailsInYear.add(normTargetEmail);
    }
    const uniqueVerifiedUsersYear = uniqueEmailsInYear.size;

    const uniqueAllUsers = Math.max(
      new Set(loginLogs.map((l) => l.email?.toLowerCase().trim()).filter(Boolean)).size,
      uniqueVerifiedUsersYear
    );

    return {
      myTodayVisits,
      myMonthVisits,
      myYearVisits,
      myTotalVisits: Math.max(myLogs.length, myYearVisits, profileViews),
      allTodayVisits,
      allMonthVisits,
      allYearVisits,
      uniqueVerifiedUsersYear,
      allTotalVisits: Math.max(loginLogs.length, allYearVisits, siteSummary?.totalVisits || 0),
      uniqueAllUsers,
      monthlyData,
      myRecentLogs: myLogs.slice(0, 8),
      systemRecentLogs: loginLogs.slice(0, 8),
    };
  }, [loginLogs, siteSummary, userEmail, selectedYear, profile?.stats?.totalViews, profile?.stats?.yearlyStats]);

  if (!isOpen) return null;

  // Handle Save Personal Information
  const handleSaveProfile = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const normEmail = userEmail.toLowerCase().trim();
      const localStoredAvatar = typeof window !== 'undefined'
        ? (localStorage.getItem(`acu_user_avatar_${normEmail}`) || localStorage.getItem(`acu_user_avatar_${userEmail.trim()}`) || '')
        : '';
      const cachedNow = getCachedUserProfile(userEmail);
      const rawPreserved = resolveDisplayAvatarUrl({
        customPhotoUrl: profile.photoURL,
        firestoreAvatarUrl: profile.avatarUrl,
        authPhotoUrl: getMatchingAuthPhotoUrl(userEmail),
        localCachedAvatarUrl:
          sanitizeAvatarUrl(cachedNow?.avatarUrl) ||
          sanitizeAvatarUrl(localStoredAvatar) ||
          sanitizeAvatarUrl(avatarUrl),
        fallbackSeedName: fullNameInput.trim() || userName,
      });
      const preservedAvatar = isUiAvatarPlaceholder(rawPreserved) ? '' : rawPreserved;

      const updatedProfile: FullUserProfile = {
        ...profile,
        fullName: fullNameInput.trim() || userName,
        nickname: nicknameInput.trim(),
        school: schoolInput.trim() || 'โรงเรียนอัสสัมชัญอุบลราชธานี',
        role: roleInput.trim() || 'ครูผู้สอน',
        avatarUrl: preservedAvatar,
        photoURL: preservedAvatar,
        updatedAt: new Date().toISOString(),
      };

      const success = await saveFullUserProfile(updatedProfile);
      if (success) {
        setProfile(updatedProfile);
        if (preservedAvatar) {
          try {
            localStorage.setItem(`acu_user_avatar_${normEmail}`, preservedAvatar);
          } catch {}
          onAvatarUpdated(preservedAvatar);
        }
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
    if (isSavingInnovationItem) return;
    setIsSavingInnovationItem(true);
    try {
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
    } catch (err) {
      console.error('Failed to update innovation item:', err);
    } finally {
      setIsSavingInnovationItem(false);
    }
  };

  // Handle deleting a specific innovation slot item (Admin or profile owner)
  const handleDeleteInnovationSlot = async (slotId: number, itemTitle?: string) => {
    const isOwnerOrAdmin = isAdmin || activeViewerEmail === userEmail.toLowerCase().trim();
    if (!isOwnerOrAdmin) {
      alert('คุณไม่มีสิทธิ์ลบผลงานของผู้อื่น');
      return;
    }

    const displayTitle = itemTitle?.trim() || `ชิ้นที่ ${slotId}`;
    if (!window.confirm(`ยืนยันการลบสื่อ "${displayTitle}" (ชิ้นที่ ${slotId}) ออกจากระบบใช่หรือไม่?`)) {
      return;
    }

    setDeletingSlotId(slotId);
    try {
      const actorEmail = activeViewerEmail || userEmail;
      const trimmedTitle = (itemTitle || '').trim();
      const matchingSubs = liveUserSubmissions.filter(
        (s) => Number(s.itemNumber) === slotId || (trimmedTitle && s.mediaTitle?.trim() === trimmedTitle)
      );
      for (const sub of matchingSubs) {
        const res = await deleteInnovationSubmission(sub.id, actorEmail);
        if (!res.success) {
          alert(res.error || 'เกิดข้อผิดพลาดในการลบสื่อ');
          return;
        }
      }

      // Also delete any direct teacher_media_repository record mapped to this slot or title
      const matchingMediaRecords = unifiedMedia.records.filter(
        (rec) => rec.mediaWorkId && !rec.innovationId && (rec.itemNumber === slotId || (trimmedTitle && rec.title === trimmedTitle))
      );
      for (const rec of matchingMediaRecords) {
        if (rec.mediaWorkId) {
          const res = await deleteTeacherMedia(rec.mediaWorkId, actorEmail);
          if (!res.success) {
            alert(res.error || 'เกิดข้อผิดพลาดในการลบสื่อในคลังสื่อ');
            return;
          }
        }
      }

      const defaultSlot = DEFAULT_INNOVATION_ITEMS.find((d) => d.id === slotId) || {
        id: slotId,
        title: '',
        category: '',
        status: 'pending' as const,
        submittedDate: '-',
        linkUrl: '',
        notes: '',
        coverImageUrl: '',
      };

      const updatedInnovations = mergedInnovations.map((item) =>
        item.id === slotId ? defaultSlot : item
      );

      const updatedProfile: FullUserProfile = {
        ...profile,
        innovations: updatedInnovations,
        updatedAt: new Date().toISOString(),
      };

      setProfile(updatedProfile);
      await saveFullUserProfile(updatedProfile);
      if (editingInnovationId === slotId) {
        setEditingInnovationId(null);
      }
    } catch (err: any) {
      alert('ไม่สามารถลบสื่อได้: ' + (err?.message || 'โปรดลองใหม่'));
    } finally {
      setDeletingSlotId(null);
    }
  };

  // Handle Visitor Praise and Star Rating Submission
  const handleSubmitPraise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingPraise) return;
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
                  src={resolveDisplayAvatarUrl({
                    customPhotoUrl: profile.photoURL,
                    firestoreAvatarUrl: profile.avatarUrl || avatarUrl,
                    authPhotoUrl: getMatchingAuthPhotoUrl(userEmail),
                    fallbackSeedName: profile.fullName || userName,
                    size: 128,
                  })}
                  alt={profile.fullName || userName}
                  className="w-full h-full object-cover rounded-[14px] bg-slate-800"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    const fallback = buildFallbackAvatarUrl(profile.fullName || userName, 128);
                    if (el.src !== fallback) el.src = fallback;
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

          <div className="flex items-center gap-2">
            {/* Manual Refresh Button (60s cooldown) */}
            <button
              type="button"
              id="btn-profile-manual-refresh"
              onClick={handleManualRefreshProfileStats}
              disabled={isManualRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-sky-300 hover:text-white border border-slate-700/60 text-xs font-medium transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              title="รีเฟรชข้อมูลสถิติและสื่อจากฐานข้อมูล (คูลดาวน์ 60 วินาที)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isManualRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>

            {/* Special Privileges Check Status Button */}
            <button
              type="button"
              id="btn-profile-check-privileges"
              onClick={() => setShowPrivilegesModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/25 via-orange-500/25 to-red-500/25 hover:from-amber-500/40 hover:to-orange-500/40 border border-amber-400/50 text-amber-200 hover:text-white text-xs font-semibold transition-all shadow-xs cursor-pointer group"
              title="เช็คสถานะสิทธิพิเศษ: โพสต์แชร์แหล่งเรียนรู้ 20 ครั้งขึ้นไป ลุ้นรับ 1.ตุ๊กตา 2.ขนม 3.ลูกอม"
            >
              <Gift className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform animate-pulse" />
              <span>สิทธิพิเศษ (แชร์ 20 ครั้ง)</span>
            </button>

            {/* Quick Exit Button (กดออกหน้านี้) */}
            <button
              type="button"
              id="btn-close-profile-modal"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition-colors shadow-xs cursor-pointer"
              title="กดออกหน้านี้ (ปิดหน้าต่าง)"
            >
              <LogOut className="w-3.5 h-3.5 rotate-180 text-rose-400" />
              <span className="hidden sm:inline">กดออกหน้านี้</span>
              <X className="w-3.5 h-3.5 sm:hidden" />
            </button>
          </div>
        </div>

        {refreshCooldownNotice && (
          <div className="mt-2 px-3 py-1.5 rounded-xl bg-amber-950/70 border border-amber-500/40 text-amber-200 text-[11px] flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>{refreshCooldownNotice}</span>
          </div>
        )}

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
                      placeholder="ระบุชื่อ-นามสกุลจริง"
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
                    placeholder="ระบุชื่อเล่น (ถ้ามี)"
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
                {mergedInnovations.map((item, idx) => {
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
                        <span>{isAdmin ? 'ผ่านการอนุมัติแล้ว' : 'ส่งแล้ว'}</span>
                      </span>
                    );
                  } else if (item.status === 'submitted') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>ส่งแล้ว</span>
                      </span>
                    );
                  } else if (item.status === 'under_review') {
                    if (isAdmin) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-medium">
                          <RefreshCw className="w-3 h-3 text-purple-400" />
                          <span>อยู่ระหว่างตรวจสอบ</span>
                        </span>
                      );
                    } else {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>ส่งแล้ว</span>
                        </span>
                      );
                    }
                  }

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70 hover:border-slate-600 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Cover Image Thumbnail (YouTube / External URL) or Number/Category Badge */}
                        {(() => {
                          const resolvedSlotThumb = resolveDisplayThumbnailUrl(item.coverImageUrl, item.linkUrl);
                          if (resolvedSlotThumb) {
                            return (
                              <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 flex-shrink-0 relative group/thumb shadow-sm">
                                <img
                                  src={resolvedSlotThumb}
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
                            );
                          }
                          return (
                            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold text-sm flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </div>
                          );
                        })()}

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
                                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 focus:border-blue-500 outline-none text-xs text-white placeholder-slate-500"
                                placeholder="ชื่อชิ้นงานสื่อ / นวัตกรรม"
                              />
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Only Admin can choose status dropdown; for general users show fixed 'ส่งแล้ว' */}
                                {isAdmin ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-amber-300 font-semibold whitespace-nowrap">
                                      สถานะ (Admin):
                                    </span>
                                    <select
                                      id={`edit-item-status-${item.id}`}
                                      defaultValue={item.status}
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-500/50 hover:border-amber-400 text-xs text-slate-100 focus:border-amber-400 outline-none cursor-pointer"
                                      title="เฉพาะ Admin เท่านั้นที่สามารถเปลี่ยนสถานะได้"
                                    >
                                      <option value="under_review">อยู่ระหว่างตรวจสอบ</option>
                                      <option value="submitted">ส่งแล้ว</option>
                                      <option value="approved">ผ่านการอนุมัติแล้ว</option>
                                      <option value="pending">รอส่งผลงาน</option>
                                    </select>
                                  </div>
                                ) : (
                                  <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-300 inline-flex items-center gap-1.5 shadow-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>สถานะ: ส่งแล้ว</span>
                                  </div>
                                )}
                                <input
                                  type="text"
                                  id={`edit-item-link-${item.id}`}
                                  defaultValue={item.linkUrl || ''}
                                  className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 focus:border-blue-500 outline-none text-xs text-white placeholder-slate-500"
                                  placeholder="ลิงก์ผลงาน (Google Drive / YouTube / เว็บไซต์)"
                                />
                                <button
                                  type="button"
                                  disabled={isSavingInnovationItem}
                                  onClick={() => {
                                    const titleEl = document.getElementById(`edit-item-title-${item.id}`) as HTMLInputElement;
                                    const statusEl = document.getElementById(`edit-item-status-${item.id}`) as HTMLSelectElement | null;
                                    const linkEl = document.getElementById(`edit-item-link-${item.id}`) as HTMLInputElement;
                                    
                                    // Only admin can set custom status from dropdown; general users default to 'submitted' (ส่งแล้ว)
                                    const newStatus = isAdmin && statusEl
                                      ? (statusEl.value as any)
                                      : 'submitted';

                                    handleUpdateInnovation(item.id, {
                                      title: titleEl?.value || item.title,
                                      status: newStatus,
                                      linkUrl: linkEl?.value || item.linkUrl,
                                      submittedDate: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }),
                                    });
                                  }}
                                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                                >
                                  {isSavingInnovationItem ? 'กำลังบันทึก...' : 'บันทึกชิ้นนี้'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isSavingInnovationItem}
                                  onClick={() => setEditingInnovationId(null)}
                                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-lg text-xs cursor-pointer transition-colors"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <h4 className="text-sm font-semibold text-white tracking-normal line-clamp-1">
                                {item.title || (
                                  <span className="text-slate-400 italic font-normal">
                                    ยังไม่ได้ส่งสื่อชิ้นที่ {item.id} (รอการส่งผลงาน)
                                  </span>
                                )}
                              </h4>
                              {item.notes ? (
                                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                                  {item.notes}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                  สามารถกดปุ่ม "ส่งสื่อ 5 ชิ้น" ที่หน้าแรกเพื่ออัปโหลดชิ้นงานนี้
                                </p>
                              )}
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                                <span>วันที่ส่ง: {item.submittedDate || '-'}</span>
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

                      {/* Action buttons (edit & delete) */}
                      {!isEditing && (
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => setEditingInnovationId(item.id)}
                            className="px-3 py-1.5 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                            <span>อัปเดตชิ้นงาน</span>
                          </button>

                          {(item.status !== 'pending' || Boolean(item.title)) &&
                            (isAdmin || activeViewerEmail === userEmail.toLowerCase().trim()) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteInnovationSlot(item.id, item.title)}
                                disabled={deletingSlotId === item.id}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                title={`ลบสื่อชิ้นที่ ${item.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{deletingSlotId === item.id ? 'กำลังลบ...' : 'ลบสื่อ'}</span>
                              </button>
                            )}
                        </div>
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
              
              {/* Admin Reset Banner (Visible whenever logged-in Admin views any profile or own profile) */}
              {isViewerAdmin && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950/60 to-slate-900 border border-red-500/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-red-200">เครื่องมือแอดมิน: รีเซ็ตสถิติการเข้าชมเป็น 0</p>
                      <p className="text-[11px] text-slate-400">
                        เลือกรีเซ็ตเฉพาะของ Admin, เฉพาะบัญชีนี้ หรือรีเซ็ตทุกคนในระบบเป็น 0 (ข้อมูลสื่อและผลงานคงเดิม)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto">
                    {!isMasterWeerapong && (
                      <button
                        type="button"
                        onClick={handleResetTargetUserStats}
                        disabled={isResettingLogs}
                        className="px-3 py-1.5 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isResettingLogs ? 'animate-spin' : ''}`} />
                        <span>รีเซ็ตผู้ใช้นี้เป็น 0</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleResetAdminOnlyStats}
                      disabled={isResettingLogs}
                      className="px-3 py-1.5 rounded-xl bg-rose-700/80 hover:bg-rose-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isResettingLogs ? 'animate-spin' : ''}`} />
                      <span>รีเซ็ตของฉัน (Admin) เป็น 0</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAllVisitorLogs}
                      disabled={isResettingLogs}
                      className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isResettingLogs ? 'animate-spin' : ''}`} />
                      <span>{isResettingLogs ? 'กำลังรีเซ็ต...' : 'รีเซ็ตทั้งระบบ (ทุกคน) เป็น 0'}</span>
                    </button>
                  </div>
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
                    <h4 className="text-xs font-bold text-white">สถิติการเข้าใช้งาน</h4>
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
                    <span>ผู้เข้าชม: {verifiedStats.uniqueVerifiedUsersYear} บัญชี</span>
                    <span>วันนี้: {verifiedStats.allTodayVisits} ครั้ง</span>
                  </div>
                </div>

                {/* Metric 3: คะแนนดาวสะสม (การเข้าชม 1 ครั้ง = 1 ดาว ปีต่อปี) */}
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      </div>
                      {verifiedStats.myYearVisits >= 100 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                          <Award className="w-3 h-3 text-amber-400" />
                          <span>ครบ 100 ครั้ง</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          ขาด {100 - verifiedStats.myYearVisits} ครบ 100
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">คะแนนดาวสะสม ({selectedYear})</p>
                    <p className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
                      {verifiedStats.myYearVisits} <span className="text-xs font-normal text-slate-400">ดาว</span>
                    </p>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-700/50">
                    {verifiedStats.myYearVisits >= 100 ? (
                      <button
                        type="button"
                        onClick={() => setShowCertificateModal(true)}
                        className="w-full py-1 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3 h-3" />
                        <span>กดพิมพ์เกียรติบัตรออนไลน์</span>
                      </button>
                    ) : (
                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>1 ครั้ง = 1 ดาว (ปีต่อปี)</span>
                        <span className="text-amber-400/80">เกณฑ์เกียรติบัตร: 100 ครั้ง</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metric 4: แต้มสะสมชื่นชม (จากผลงานสื่อที่โพสต์แล้วมีคนกดถูกใจ ปีต่อปี) */}
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-2">
                    <Heart className="w-4 h-4 fill-rose-400 text-rose-400" />
                  </div>
                  <p className="text-xs text-slate-400">แต้มสะสมชื่นชม ({selectedYear})</p>
                  <p className="text-xl sm:text-2xl font-black text-rose-400 mt-0.5">
                    {teacherKudosPoints} <span className="text-xs font-normal text-slate-400">แต้ม</span>
                  </p>
                  <div className="mt-1 text-[10px] text-slate-400 border-t border-slate-700/50 pt-1">
                    <span>สื่อปี {selectedYear} ({myMediaWorks.length} ชิ้น) • ถูกใจ {teacherKudosPoints} ครั้ง</span>
                  </div>
                </div>
              </div>

              {/* Monthly Statistics Breakdown Table for Selected Year */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/70">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-purple-400" />
                    <span>สรุปสถิติการเข้าใช้งานรายเดือน ประจำปี {selectedYear}</span>
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
                    ยอดรวมแต่ละเดือนตรงกับยอดสรุป 100%
                  </span>
                </div>
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
              
              {/* Section 1: คะแนนดาวสะสมจากการเข้าชมระบบ (Star Points - ปีต่อปีเท่านั้น) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-850 to-slate-900 border border-amber-500/30 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        คะแนนดาวสะสมจากการเข้าชมเว็บไซต์ ประจำปี {selectedYear} (1 ครั้ง = 1 แต้มดาว)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        คิดคะแนนเป็นปีต่อปีเท่านั้น ไม่ใช้คะแนนนี้กับปีอื่น ๆ (อ้างอิงจากข้อมูลการเข้าชมระบบของตนเอง)
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-black flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-300" />
                    <span>{verifiedStats.myYearVisits} แต้มดาว</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-slate-700/60 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400">คะแนนดาวปี {selectedYear}</span>
                    <p className="text-base font-bold text-amber-400 mt-0.5">{verifiedStats.myYearVisits} ดาว</p>
                    <span className="text-[9px] text-slate-500">เข้าชม {verifiedStats.myYearVisits} ครั้ง</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400">คะแนนดาวเดือนนี้</span>
                    <p className="text-base font-bold text-white mt-0.5">{verifiedStats.myMonthVisits} ดาว</p>
                    <span className="text-[9px] text-slate-500">เข้าชม {verifiedStats.myMonthVisits} ครั้ง</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400">คะแนนดาววันนี้</span>
                    <p className="text-base font-bold text-white mt-0.5">{verifiedStats.myTodayVisits} ดาว</p>
                    <span className="text-[9px] text-slate-500">เข้าชม {verifiedStats.myTodayVisits} ครั้ง</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400">เกณฑ์การคิดคะแนน</span>
                    <p className="text-xs font-semibold text-emerald-400 mt-1">ปีต่อปีเท่านั้น</p>
                    <span className="text-[9px] text-slate-500">ไม่สะสมข้ามปี</span>
                  </div>
                </div>
              </div>

              {/* Online Certificate Card (เงื่อนไข: เข้าชม 100 ครั้งขึ้นไป ได้รับเกียรติบัตรออนไลน์ มีปุ่มกดพิมพ์ทันที) */}
              <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                verifiedStats.myYearVisits >= 100
                  ? 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-900/40 border-amber-500/60 shadow-xl shadow-amber-500/10'
                  : 'bg-slate-850/80 border-slate-750'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      verifiedStats.myYearVisits >= 100
                        ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/50'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                          <span>เกียรติบัตรออนไลน์ ประจำปี {selectedYear}</span>
                        </h4>
                        {verifiedStats.myYearVisits >= 100 ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ได้รับสิทธิ์เกียรติบัตรแล้ว</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-medium">
                            สะสม {verifiedStats.myYearVisits}/100 ครั้ง
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {verifiedStats.myYearVisits >= 100 ? (
                          <span>
                            ยินดีด้วย! คุณมีสถิติการเข้าชมระบบครบถ้วนตามเกณฑ์ <strong className="text-amber-400 font-bold">100 ครั้งขึ้นไป</strong> (เข้าชมจริง {verifiedStats.myYearVisits} ครั้ง) สามารถกดพิมพ์เกียรติบัตรออนไลน์ได้ทันที
                          </span>
                        ) : (
                          <span>
                            เงื่อนไข: หากเข้าชมเว็บไซต์ครบ <strong className="text-amber-400">100 ครั้งขึ้นไปต่อปี</strong> จะได้รับเกียรติบัตรออนไลน์เชิดชูเกียรติ พร้อมระบบกดพิมพ์ใบประกาศทันที (ขาดอีก <strong className="text-blue-400 font-bold">{Math.max(0, 100 - verifiedStats.myYearVisits)}</strong> ครั้ง)
                          </span>
                        )}
                      </p>

                      <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                        <span>ชื่อ-สกุล บนเกียรติบัตร:</span>
                        <strong className="text-amber-200 bg-slate-800/90 px-2.5 py-0.5 rounded-md border border-slate-700 text-xs">
                          {getCleanRealName(fullNameInput || profile.fullName || userName, userEmail)}
                        </strong>
                        <span className="text-[10px] text-slate-500">(เฉพาะชื่อ-นามสกุลจริงตามระบบ)</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button & Progress */}
                  <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
                    {verifiedStats.myYearVisits >= 100 ? (
                      <button
                        type="button"
                        onClick={() => setShowCertificateModal(true)}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>กดพิมพ์เกียรติบัตร ทันที</span>
                      </button>
                    ) : (
                      <div className="w-full sm:w-48 space-y-1.5">
                        <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                          <span>ความคืบหน้า</span>
                          <span>{Math.min(100, verifiedStats.myYearVisits)}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-amber-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (verifiedStats.myYearVisits / 100) * 100)}%` }}
                          ></div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCertificateModal(true)}
                          className="w-full text-center text-[11px] text-slate-400 hover:text-amber-300 underline underline-offset-2 transition-colors cursor-pointer pt-1"
                        >
                          ดูตัวอย่างเกียรติบัตรล่วงหน้า
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: แต้มสะสมชื่นชมจากผลงานสื่อนวัตกรรม (Teacher Media Kudos - ปีต่อปีเท่านั้น) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-rose-950/40 via-slate-850 to-slate-900 border border-rose-500/30 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                      <Heart className="w-5 h-5 fill-rose-400 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        คะแนนแต้มสะสมชื่นชมจากผลงานสื่อ ประจำปี {selectedYear} (ปีต่อปีเท่านั้น)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        นับแต้มจากผลงานสื่อประจำปี {selectedYear} ที่มีคนกดถูกใจ (คิดคะแนนปีต่อปี ไม่ใช้คะแนนนี้กับปีอื่น ๆ)
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
                      ผลงานสื่อของคุณครูในคลัง ประจำปี {selectedYear} ({myMediaWorks.length} ชิ้น):
                    </span>
                    <span className="text-[11px] text-rose-400 font-medium">
                      ถูกใจรวม {teacherKudosPoints} ครั้ง (ปีต่อปี)
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
                            {(() => {
                              const resolvedWorkThumb = resolveDisplayThumbnailUrl(work.thumbnailUrl, work.onlineUrl);
                              if (resolvedWorkThumb) {
                                return (
                                  <img
                                    src={resolvedWorkThumb}
                                    alt={work.title}
                                    className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-slate-700"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = '/ACU N.png';
                                    }}
                                  />
                                );
                              }
                              const workCat = detectMediaLinkCategory(work.onlineUrl, work.mediaType);
                              return (
                                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center flex-shrink-0">
                                  {workCat.key === 'youtube' ? (
                                    <Youtube className="w-4 h-4 text-rose-400" />
                                  ) : workCat.key === 'gdrive' ? (
                                    <HardDrive className="w-4 h-4 text-emerald-400" />
                                  ) : workCat.key === 'canva' ? (
                                    <Palette className="w-4 h-4 text-cyan-400" />
                                  ) : workCat.key === 'tech' ? (
                                    <Globe className="w-4 h-4 text-blue-400" />
                                  ) : (
                                    <FileText className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                              );
                            })()}
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
                        คุณครูยังไม่มีผลงานสื่อในคลังสื่อสำหรับปี {selectedYear} (แต้มสะสมชื่นชมประจำปีคงค่า 0 แต้ม)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        เมื่อส่งผลงานสื่อในปีนี้และมีผู้เข้าชมกดถูกใจที่หน้าคลังสื่อ แต้มจะถูกนำมารวมที่นี่โดยอัตโนมัติ (คิดคะแนนปีต่อปี ไม่สะสมข้ามปี)
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
          </div>
        </div>

      </div>

      {/* Online Certificate Modal (สำหรับพิมพ์เกียรติบัตรออนไลน์) */}
      {showCertificateModal && (
        <OnlineCertificateModal
          isOpen={showCertificateModal}
          onClose={() => setShowCertificateModal(false)}
          recipientName={getCleanRealName(fullNameInput || profile.fullName || userName, userEmail)}
          recipientEmail={userEmail}
          academicYear={selectedYear}
          visitCount={verifiedStats.myYearVisits}
          schoolName={profile.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี'}
        />
      )}

      {/* Embedded Avatar Editor Modal */}
      {showAvatarEditModal && (
        <EditProfileModal
          isOpen={showAvatarEditModal}
          onClose={() => setShowAvatarEditModal(false)}
          userEmail={userEmail}
          displayName={profile.fullName || userName}
          currentAvatarUrl={sanitizeAvatarUrl(profile.photoURL || profile.avatarUrl || avatarUrl)}
          onSaveAvatar={async (newAvatarUrl) => {
            const savedPhotoUrl = await saveUserPhotoToFirestore(userEmail, newAvatarUrl, profile.uid);
            const updatedProfile: FullUserProfile = {
              ...profile,
              avatarUrl: savedPhotoUrl,
              photoURL: savedPhotoUrl,
              updatedAt: new Date().toISOString(),
            };
            setProfile(updatedProfile);
            await saveFullUserProfile(updatedProfile);
            onAvatarUpdated(savedPhotoUrl);
            if (onProfileUpdated) {
              onProfileUpdated(updatedProfile);
            }
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3500);
            setShowAvatarEditModal(false);
          }}
        />
      )}

      {/* Special Privileges & Rewards Status Modal */}
      <SpecialPrivilegesModal
        isOpen={showPrivilegesModal}
        onClose={() => setShowPrivilegesModal(false)}
        userEmail={userEmail}
        teacherName={profile.fullName || userName}
      />
    </div>
  );
};
