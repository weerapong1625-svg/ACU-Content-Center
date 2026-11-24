import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  Mail, 
  School, 
  Layers, 
  Clock, 
  RefreshCw,
  Copy,
  Check,
  Award,
  Database,
  Eye
} from 'lucide-react';
import { 
  FullUserProfile, 
  deleteUserAccountCompletely, 
  DeleteUserAccountResult,
  getCleanRealName,
  subscribeAllUserProfiles
} from '../services/userProfileService';
import { SUPER_ADMIN_EMAIL } from '../services/logoService';
import { LoginLogEntry, subscribeAllLoginLogs } from '../services/auditService';
import { 
  InnovationSubmission, 
  FacilitySubmission,
  TeacherMediaWork,
  subscribeAllInnovations,
  subscribeAllSubmissions,
  subscribeTeacherMedia,
  getUnifiedTeacherMediaRecords,
  extractMediaEmails,
  isValidActiveMediaRecord
} from '../services/submissionService';
import {
  resolveDisplayAvatarUrl,
  sanitizeAvatarUrl,
  buildFallbackAvatarUrl,
  isUiAvatarPlaceholder,
} from '../utils/avatarUtils';
import { useFirestoreData } from '../context/FirestoreDataContext';

interface AdminUserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminEmail: string;
  userProfilesMap?: Record<string, FullUserProfile>;
  loginLogs?: LoginLogEntry[];
  innovations?: InnovationSubmission[];
  teacherMedia?: TeacherMediaWork[];
  facilities?: FacilitySubmission[];
  onUserDeleted?: (deletedEmail: string) => void;
  onOpenEmailAudit?: () => void;
  onViewUserProfile?: (user: { email: string; name: string; avatarUrl: string }) => void;
}

export const AdminUserManagementModal: React.FC<AdminUserManagementModalProps> = ({
  isOpen,
  onClose,
  adminEmail,
  userProfilesMap,
  loginLogs,
  innovations,
  teacherMedia,
  facilities,
  onUserDeleted,
  onOpenEmailAudit,
  onViewUserProfile,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Deletion Target State
  const [deletingUser, setDeletingUser] = useState<{
    email: string;
    name: string;
    school?: string;
  } | null>(null);

  // Deletion Options
  const [deleteOptions, setDeleteOptions] = useState({
    deleteLogs: true,
    deleteSubmissions: true,
    deleteFacilities: true,
    deleteMedia: true,
  });

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<DeleteUserAccountResult | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Internal state when props are not passed
  const [internalProfiles, setInternalProfiles] = useState<Record<string, FullUserProfile>>({});
  const [internalLogs, setInternalLogs] = useState<LoginLogEntry[]>([]);
  const [internalInnovations, setInternalInnovations] = useState<InnovationSubmission[]>([]);
  const [internalTeacherMedia, setInternalTeacherMedia] = useState<TeacherMediaWork[]>([]);
  const [internalFacilities, setInternalFacilities] = useState<FacilitySubmission[]>([]);

  const {
    hasMoreUserProfiles,
    isLoadingMore,
    loadMoreUserProfiles,
    adminServerCounts,
  } = useFirestoreData();
  const isLoadingMoreProfiles = isLoadingMore('userProfiles');

  useEffect(() => {
    if (!isOpen) return;

    let unsubProfiles = () => {};
    let unsubLogs = () => {};
    let unsubInnovations = () => {};
    let unsubTeacherMedia = () => {};
    let unsubFacilities = () => {};

    if (!userProfilesMap) {
      unsubProfiles = subscribeAllUserProfiles((map) => {
        setInternalProfiles(map);
      });
    }

    if (!loginLogs) {
      unsubLogs = subscribeAllLoginLogs((logs) => {
        setInternalLogs(logs);
      });
    }

    if (!innovations) {
      unsubInnovations = subscribeAllInnovations((list) => {
        setInternalInnovations(list);
      });
    }

    if (!teacherMedia) {
      unsubTeacherMedia = subscribeTeacherMedia((works) => {
        setInternalTeacherMedia(works);
      });
    }

    if (!facilities) {
      unsubFacilities = subscribeAllSubmissions((list) => {
        setInternalFacilities(list);
      });
    }

    return () => {
      unsubProfiles();
      unsubLogs();
      unsubInnovations();
      unsubTeacherMedia();
      unsubFacilities();
    };
  }, [isOpen, userProfilesMap, loginLogs, innovations, teacherMedia, facilities]);

  const activeProfilesMap = userProfilesMap || internalProfiles;
  const activeLogs = loginLogs || internalLogs;
  const activeInnovations = innovations || internalInnovations;
  const activeTeacherMedia = teacherMedia || internalTeacherMedia;
  const activeFacilities = facilities || internalFacilities;

  // Gather all unique users across userProfilesMap, loginLogs, innovations, and facilities
  const allUsers = useMemo(() => {
    const map = new Map<string, {
      email: string;
      fullName: string;
      displayName: string;
      school: string;
      avatarUrl: string;
      role: string;
      loginCount: number;
      lastLogin?: string;
      innovationCount: number;
      facilityCount: number;
      isMasterAdmin: boolean;
    }>();

    // 1. From profiles
    Object.entries(activeProfilesMap).forEach(([emailKey, prof]) => {
      const normEmail = emailKey.trim().toLowerCase();
      const isMaster = normEmail === SUPER_ADMIN_EMAIL.toLowerCase();
        const resolvedProfAvatar = resolveDisplayAvatarUrl({
          customPhotoUrl: prof.photoURL,
          firestoreAvatarUrl: prof.avatarUrl,
          fallbackSeedName: prof.fullName || prof.displayName || normEmail,
        });
        map.set(normEmail, {
          email: normEmail,
          fullName: prof.fullName || prof.displayName || normEmail.split('@')[0],
          displayName: prof.displayName || prof.fullName || normEmail.split('@')[0],
          school: prof.school || 'โรงเรียนอัสสัมชัญอุบลราชธานี',
          avatarUrl: isUiAvatarPlaceholder(resolvedProfAvatar) ? '' : resolvedProfAvatar,
          role: prof.role || (isMaster ? 'ผู้ดูแลระบบและพัฒนานวัตกรรม' : 'ครูผู้สอน'),
          loginCount: 0,
          innovationCount: 0,
          facilityCount: 0,
          isMasterAdmin: isMaster,
        });
      });

      // 2. Aggregate login logs
      activeLogs.forEach((log) => {
        const normEmail = (log.email || '').trim().toLowerCase();
        if (!normEmail) return;
        const isMaster = normEmail === SUPER_ADMIN_EMAIL.toLowerCase();

        let userObj = map.get(normEmail);
        if (!userObj) {
          userObj = {
            email: normEmail,
            fullName: log.displayName || normEmail.split('@')[0],
            displayName: log.displayName || normEmail.split('@')[0],
            school: 'โรงเรียนอัสสัมชัญอุบลราชธานี',
            avatarUrl: sanitizeAvatarUrl(log.avatarUrl),
            role: isMaster ? 'ผู้ดูแลระบบและพัฒนานวัตกรรม' : (log.role || 'ครูผู้สอน'),
            loginCount: 0,
            innovationCount: 0,
            facilityCount: 0,
            isMasterAdmin: isMaster,
          };
          map.set(normEmail, userObj);
        } else if (!userObj.avatarUrl && log.avatarUrl) {
          userObj.avatarUrl = sanitizeAvatarUrl(log.avatarUrl);
        }
      userObj.loginCount++;
      if (!userObj.lastLogin || new Date(log.loginTimestamp) > new Date(userObj.lastLogin)) {
        userObj.lastLogin = log.loginTimestamp;
      }
    });

    // 3. Register users from innovations & teacher media repository (create entry if missing)
    const ensureUserFromMedia = (rawItem: any) => {
      if (!isValidActiveMediaRecord(rawItem)) return;
      const normEmail = extractMediaEmails(rawItem)[0] || '';
      if (!normEmail) return;
      const isMaster = normEmail === SUPER_ADMIN_EMAIL.toLowerCase();
      let userObj = map.get(normEmail);
      const itemTeacherName = (rawItem.teacherName || rawItem.authorName || '').toString().trim();
      if (!userObj) {
        userObj = {
          email: normEmail,
          fullName: itemTeacherName || normEmail.split('@')[0],
          displayName: itemTeacherName || normEmail.split('@')[0],
          school: 'โรงเรียนอัสสัมชัญอุบลราชธานี',
          avatarUrl: '',
          role: isMaster ? 'ผู้ดูแลระบบและพัฒนานวัตกรรม' : 'ครูผู้สอน',
          loginCount: 0,
          innovationCount: 0,
          facilityCount: 0,
          isMasterAdmin: isMaster,
        };
        map.set(normEmail, userObj);
      } else if (itemTeacherName && userObj.fullName === normEmail.split('@')[0]) {
        userObj.fullName = itemTeacherName;
      }
    };

    activeInnovations.forEach(ensureUserFromMedia);
    activeTeacherMedia.forEach(ensureUserFromMedia);

    // 4. Aggregate facilities (create entry if missing)
    activeFacilities.forEach((fac) => {
      const normEmail = (fac.userEmail || '').trim().toLowerCase();
      if (!normEmail) return;
      const isMaster = normEmail === SUPER_ADMIN_EMAIL.toLowerCase();
      let userObj = map.get(normEmail);
      if (!userObj) {
        userObj = {
          email: normEmail,
          fullName: fac.teacherName || normEmail.split('@')[0],
          displayName: fac.teacherName || normEmail.split('@')[0],
          school: 'โรงเรียนอัสสัมชัญอุบลราชธานี',
          avatarUrl: '',
          role: isMaster ? 'ผู้ดูแลระบบและพัฒนานวัตกรรม' : 'ครูผู้สอน',
          loginCount: 0,
          innovationCount: 0,
          facilityCount: 0,
          isMasterAdmin: isMaster,
        };
        map.set(normEmail, userObj);
      }
      userObj.facilityCount++;
      if (fac.teacherName && userObj.fullName === normEmail.split('@')[0]) {
        userObj.fullName = fac.teacherName;
      }
    });

    // 5. Dynamically calculate unified media counts (innovations + teacher_media_repository) & loginCount fallback
    map.forEach((userObj, normEmail) => {
      const prof = activeProfilesMap[normEmail];
      const unified = getUnifiedTeacherMediaRecords(
        {
          uid: prof?.uid,
          email: normEmail,
          fullName: prof?.fullName || userObj.fullName,
          displayName: prof?.displayName || userObj.displayName,
        },
        activeInnovations,
        activeTeacherMedia
      );
      userObj.innovationCount = unified.submittedCount;

      if (userObj.loginCount === 0) {
        const profViews = prof?.stats?.totalViews || 0;
        if (profViews > 0) {
          userObj.loginCount = profViews;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Super admin first, then by login count desc
      if (a.isMasterAdmin) return -1;
      if (b.isMasterAdmin) return 1;
      return b.loginCount - a.loginCount;
    });
  }, [activeProfilesMap, activeLogs, activeInnovations, activeTeacherMedia, activeFacilities]);

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allUsers;
    return allUsers.filter((u) => 
      u.email.toLowerCase().includes(term) ||
      u.fullName.toLowerCase().includes(term) ||
      u.displayName.toLowerCase().includes(term) ||
      u.school.toLowerCase().includes(term)
    );
  }, [allUsers, searchTerm]);

  if (!isOpen) return null;

  const handleCopyEmail = (email: string) => {
    navigator.clipboard?.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleStartDelete = (user: { email: string; fullName: string; school: string }) => {
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      alert('ไม่อนุญาตให้ลบบัญชีผู้ดูแลระบบหลัก (Super Admin)');
      return;
    }
    setDeletingUser({
      email: user.email,
      name: getCleanRealName(user.fullName, user.email),
      school: user.school,
    });
    setDeleteError(null);
    setDeleteResult(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    setDeleteError(null);

    const result = await deleteUserAccountCompletely(deletingUser.email, adminEmail, deleteOptions);

    setIsDeleting(false);
    if (result.success) {
      setDeleteResult(result);
      const targetNorm = deletingUser.email.toLowerCase().trim();
      setInternalProfiles(prev => {
        const next = { ...prev };
        delete next[targetNorm];
        return next;
      });
      setInternalLogs(prev => prev.filter(l => (l.email || '').trim().toLowerCase() !== targetNorm));
      setInternalInnovations(prev => prev.filter(inv => (inv.userEmail || '').trim().toLowerCase() !== targetNorm));
      setInternalFacilities(prev => prev.filter(fac => (fac.userEmail || '').trim().toLowerCase() !== targetNorm));

      if (onUserDeleted) {
        onUserDeleted(deletingUser.email);
      }
      setTimeout(() => {
        setDeletingUser(null);
        setDeleteResult(null);
      }, 2500);
    } else {
      setDeleteError(result.error || 'ไม่สามารถลบบัญชีผู้ใช้ได้');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-inner">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">
                  ระบบจัดการและลบบัญชีผู้ใช้งาน
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-950/80 border border-red-500/40 text-red-300">
                  เฉพาะ Admin
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                ค้นหา ตรวจสอบ และลบบัญชีผู้ใช้ถาวรออกจากทุกฐานข้อมูล (โปรไฟล์, ประวัติการเข้าใช้, ข้อมูลการส่งสื่อ)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onOpenEmailAudit && (
              <button
                onClick={() => {
                  onClose();
                  onOpenEmailAudit();
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 transition-all shadow-sm"
              >
                <Database className="w-4 h-4 text-blue-400" />
                <span>ตรวจสอบอีเมลทุกฐานข้อมูล</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Toolbar & Search */}
        <div className="px-6 py-3.5 bg-slate-800/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อ, นามสกุล, อีเมล หรือสังกัดโรงเรียน..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-red-500/70 focus:ring-1 focus:ring-red-500/50 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-sky-400" />
              <span>พบบัญชีทั้งหมด: <strong className="text-white">{allUsers.length}</strong> บัญชี</span>
            </div>
            {searchTerm && (
              <div className="px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-700/40 text-red-300">
                ตรงกับคำค้นหา: <strong className="text-white">{filteredUsers.length}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Users Table / List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <User className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-base font-semibold text-slate-300">ไม่พบบัญชีผู้ใช้งานที่ตรงกับเงื่อนไข</p>
              <p className="text-xs text-slate-500 mt-1">ลองพิมพ์ค้นหาด้วยชื่อหรืออีเมลอื่น</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {filteredUsers.map((user) => {
                const isSuper = user.isMasterAdmin;
                const cleanName = getCleanRealName(user.fullName, user.email);

                return (
                  <div
                    key={user.email}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isSuper
                        ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/60'
                        : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/70 hover:border-slate-600'
                    }`}
                  >
                    {/* User Info */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {sanitizeAvatarUrl(user.avatarUrl) ? (
                          <img
                            src={sanitizeAvatarUrl(user.avatarUrl)}
                            alt={cleanName}
                            className="w-11 h-11 rounded-full object-cover border border-slate-600 shadow bg-slate-800"
                            onError={(e) => {
                              const el = e.target as HTMLImageElement;
                              const fallback = buildFallbackAvatarUrl(cleanName, 128);
                              if (el.src !== fallback) el.src = fallback;
                            }}
                          />
                        ) : (
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm border ${
                            isSuper 
                              ? 'bg-amber-600/30 text-amber-200 border-amber-500/50' 
                              : 'bg-slate-700 text-slate-200 border-slate-600'
                          }`}>
                            {cleanName.charAt(0)}
                          </div>
                        )}
                        {isSuper && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-slate-950 shadow-sm" title="Super Admin">
                            <ShieldCheck className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-white truncate max-w-xs sm:max-w-md">
                            {cleanName}
                          </h4>
                          {isSuper ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              SUPER ADMIN (ห้ามลบ)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-700/60 text-slate-300 border border-slate-600/50">
                              {user.role}
                            </span>
                          )}
                        </div>

                        {/* Email & School */}
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          <div className="flex items-center gap-1.5 font-mono text-slate-300">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{user.email}</span>
                            <button
                              onClick={() => handleCopyEmail(user.email)}
                              className="p-1 hover:text-white transition-colors"
                              title="คัดลอกอีเมล"
                            >
                              {copiedEmail === user.email ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400" />
                              )}
                            </button>
                          </div>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400 truncate max-w-xs">{user.school}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats badges */}
                    <div className="hidden md:flex items-center gap-2.5 px-3">
                      <div className="text-center px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-700/50">
                        <div className="text-[10px] text-slate-400">เข้าชม</div>
                        <div className="text-xs font-bold text-sky-300">{user.loginCount} ครั้ง</div>
                      </div>
                      <div className="text-center px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-700/50">
                        <div className="text-[10px] text-slate-400">ส่งสื่อ 5 ชิ้น</div>
                        <div className="text-xs font-bold text-purple-300">{user.innovationCount} รายการ</div>
                      </div>
                      <div className="text-center px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-700/50">
                        <div className="text-[10px] text-slate-400">ใช้ห้อง 33 แห่ง</div>
                        <div className="text-xs font-bold text-emerald-300">{user.facilityCount} รายการ</div>
                      </div>
                    </div>

                    {/* Action: View profile & Delete user account */}
                    <div className="flex items-center gap-2 pl-3">
                      {onViewUserProfile && (
                        <button
                          type="button"
                          onClick={() =>
                            onViewUserProfile({
                              email: user.email,
                              name: cleanName,
                              avatarUrl: user.avatarUrl,
                            })
                          }
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-sky-600/20 hover:bg-sky-600 border border-sky-500/40 hover:border-sky-500 text-sky-300 hover:text-white transition-all shadow-sm cursor-pointer"
                          title={`ดูโปรไฟล์ของ ${cleanName}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ดูโปรไฟล์</span>
                        </button>
                      )}
                      {isSuper ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-600/30 text-amber-300 text-xs font-medium cursor-not-allowed select-none">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                          <span>บัญชีหลัก</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartDelete(user)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600/15 hover:bg-red-600 border border-red-500/40 hover:border-red-600 text-red-300 hover:text-white transition-all shadow-sm active:scale-95 group"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400 group-hover:text-white transition-colors" />
                          <span>ลบบัญชี</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMoreUserProfiles && (
            <div className="mt-5 flex flex-col items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => loadMoreUserProfiles()}
                disabled={isLoadingMoreProfiles}
                className="px-6 py-2.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/35 border border-sky-500/40 text-sky-200 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMoreProfiles ? 'animate-spin' : ''}`} />
                <span>{isLoadingMoreProfiles ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม (รายชื่อผู้ใช้ 24 รายการถัดไป)'}</span>
              </button>
              <span className="text-[11px] text-slate-400">
                โหลดโปรไฟล์แล้ว {Object.keys(activeProfilesMap).length}
                {adminServerCounts.totalTeachers > Object.keys(activeProfilesMap).length
                  ? ` / ${adminServerCounts.totalTeachers}`
                  : ''} บัญชี
              </span>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>สิทธิ์ดำเนินการ: <strong>{adminEmail}</strong> (Super Admin)</span>
          </div>
          <div className="text-slate-500">
            ระบบป้องกัน: บัญชีผู้ดูแลระบบหลัก (Super Admin) ไม่สามารถถูกลบได้เพื่อความปลอดภัยสูงสุด
          </div>
        </div>

        {/* =========================================================================
            Confirm Deletion Modal
           ========================================================================= */}
        {deletingUser && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg bg-slate-900 border border-red-600/50 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 flex-shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    ยืนยันการลบบัญชีผู้ใช้งานระบบ
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    การดำเนินการนี้จะลบบัญชีผู้ใช้และข้อมูลที่เกี่ยวข้องอย่างถาวรจากฐานข้อมูล Firestore
                  </p>
                </div>
              </div>

              {/* Target User Info Card */}
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 mb-4 space-y-1">
                <div className="text-xs text-slate-400">บัญชีผู้ใช้ที่จะลบ:</div>
                <div className="text-sm font-bold text-white">{deletingUser.name}</div>
                <div className="text-xs font-mono text-red-300">{deletingUser.email}</div>
                <div className="text-xs text-slate-400">{deletingUser.school}</div>
              </div>

              {/* Deletion Checkboxes Options */}
              <div className="space-y-2 mb-5">
                <div className="text-xs font-semibold text-slate-300 mb-1">
                  กำหนดขอบเขตข้อมูลที่ต้องการลบ:
                </div>
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50">
                  <input
                    type="checkbox"
                    checked={deleteOptions.deleteLogs}
                    onChange={(e) => setDeleteOptions({ ...deleteOptions, deleteLogs: e.target.checked })}
                    className="rounded text-red-600 focus:ring-red-500 bg-slate-900 border-slate-700"
                  />
                  <span>ลบประวัติการเข้าใช้งานทั้งหมด (Login Activity Logs)</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50">
                  <input
                    type="checkbox"
                    checked={deleteOptions.deleteSubmissions}
                    onChange={(e) => setDeleteOptions({ ...deleteOptions, deleteSubmissions: e.target.checked })}
                    className="rounded text-red-600 focus:ring-red-500 bg-slate-900 border-slate-700"
                  />
                  <span>ลบข้อมูลผลงานสื่อนวัตกรรม 5 ชิ้น (Teacher Innovations Submissions)</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50">
                  <input
                    type="checkbox"
                    checked={deleteOptions.deleteFacilities}
                    onChange={(e) => setDeleteOptions({ ...deleteOptions, deleteFacilities: e.target.checked })}
                    className="rounded text-red-600 focus:ring-red-500 bg-slate-900 border-slate-700"
                  />
                  <span>ลบประวัติการใช้ห้อง/แหล่งเรียนรู้ 33 แห่ง (Facility Records)</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50">
                  <input
                    type="checkbox"
                    checked={deleteOptions.deleteMedia}
                    onChange={(e) => setDeleteOptions({ ...deleteOptions, deleteMedia: e.target.checked })}
                    className="rounded text-red-600 focus:ring-red-500 bg-slate-900 border-slate-700"
                  />
                  <span>ลบสื่อในคลังส่วนตัว (Teacher Media Repository)</span>
                </label>
              </div>

              {/* Error Display */}
              {deleteError && (
                <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              {/* Success Display */}
              {deleteResult && (
                <div className="mb-4 p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>ลบบัญชีผู้ใช้ {deleteResult.targetEmail} สำเร็จเรียบร้อย!</span>
                  </div>
                  <div className="text-[11px] text-emerald-400/90 pl-6">
                    ลบโปรไฟล์, ล้างประวัติเข้าสู่ระบบ {deleteResult.deletedCounts.loginLogs} รายการ, 
                    สื่อ 5 ชิ้น {deleteResult.deletedCounts.innovations} รายการ, 
                    แหล่งเรียนรู้ {deleteResult.deletedCounts.facilities} รายการ
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeleting || deleteResult !== null}
                  onClick={handleConfirmDelete}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 transition-all disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังลบข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ยืนยันลบบัญชีถาวร</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
