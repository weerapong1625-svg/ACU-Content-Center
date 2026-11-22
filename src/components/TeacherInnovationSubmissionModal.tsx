import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  CheckCircle2, 
  FileSpreadsheet, 
  Clock, 
  Image as ImageIcon, 
  Sparkles, 
  ExternalLink,
  Layers,
  Database,
  Mail,
  Copy,
  Download,
  BookOpen,
  Edit3,
  Trash2,
  AlertCircle,
  Search,
  RefreshCw,
  Youtube,
  FileText,
  Palette,
  HardDrive,
  Globe
} from 'lucide-react';
import { 
  GRADE_LEVELS, 
  SUBJECT_GROUPS,
  MEDIA_ITEM_NUMBERS, 
  INNOVATION_MEDIA_TYPES, 
  PRODUCTION_TYPES, 
  InnovationSubmission,
  TeacherMediaWork,
  saveInnovationSubmission, 
  updateInnovationSubmission,
  deleteInnovationSubmission,
  deleteTeacherMedia,
  subscribeAllInnovations,
  subscribeTeacherMedia,
  refreshAllInnovations,
  refreshTeacherMedia,
  exportInnovationsToGoogleSheetsCSV,
  ADMIN_TARGET_EMAIL,
  canUserModify,
  isValidActiveMediaRecord,
  doesMediaRecordBelongToTeacher,
  extractMediaEmails,
  getUnifiedTeacherMediaRecords
} from '../services/submissionService';
import { resolveUserUid } from '../services/userProfileService';
import {
  detectMediaLinkCategory,
  getYouTubeThumbnailUrl,
  isDataOrBlobUri,
  resolveDisplayThumbnailUrl,
  sanitizeMediaThumbnailForFirestore,
} from '../utils/mediaThumbnailUtils';

interface TeacherInnovationSubmissionModalProps {
  userEmail: string;
  defaultTeacherName?: string;
  initialTab?: 'form' | 'status' | 'sheets';
  onClose: () => void;
}

export const TeacherInnovationSubmissionModal: React.FC<TeacherInnovationSubmissionModalProps> = ({
  userEmail,
  defaultTeacherName = '',
  initialTab = 'form',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'form' | 'status' | 'sheets'>(initialTab);

  // Form states matching exact questionnaire
  const [teacherName, setTeacherName] = useState(defaultTeacherName);
  const [subjectGroup, setSubjectGroup] = useState<string>(SUBJECT_GROUPS[0]);
  const [gradeLevel, setGradeLevel] = useState<string>(GRADE_LEVELS[0]);
  const [itemNumber, setItemNumber] = useState<number>(1);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaType, setMediaType] = useState<string>(INNOVATION_MEDIA_TYPES[0]);
  const [productionType, setProductionType] = useState<string>(PRODUCTION_TYPES[0]);
  const [usageDetails, setUsageDetails] = useState('');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string>('');

  // Filter state for viewing by Subject Group & Status search
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [statusSearchTerm, setStatusSearchTerm] = useState<string>('');
  const [selectedTeacherView, setSelectedTeacherView] = useState<string>('my'); // 'my' | 'all' | email
  const [statusCompletionFilter, setStatusCompletionFilter] = useState<'all' | 'complete' | 'incomplete'>('all');

  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Status & List states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  const [allSubmissions, setAllSubmissions] = useState<InnovationSubmission[]>([]);
  const [teacherMedia, setTeacherMedia] = useState<TeacherMediaWork[]>([]);
  const [copyNotice, setCopyNotice] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Admin permission check
  const isAdmin = userEmail.trim().toLowerCase() === ADMIN_TARGET_EMAIL.toLowerCase();
  const [showAllUsersForAdmin, setShowAllUsersForAdmin] = useState(isAdmin);

  // Subscribe once via shared multiplexed streams (zero extra Firestore reads; never tear down on editingId change)
  useEffect(() => {
    const unsubAll = subscribeAllInnovations((list) => {
      setAllSubmissions(list);
    });
    const unsubMedia = subscribeTeacherMedia((works) => {
      setTeacherMedia(works);
    });
    return () => {
      unsubAll();
      unsubMedia();
    };
  }, [userEmail]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([refreshAllInnovations(true), refreshTeacherMedia(true)]);
      setActionNotice('อัปเดตข้อมูลล่าสุดเรียบร้อยแล้ว');
      setTimeout(() => setActionNotice(null), 2500);
    } finally {
      setIsRefreshing(false);
    }
  };

  const currentUserUid = React.useMemo(() => resolveUserUid(userEmail), [userEmail]);

  const activeAllSubmissions = React.useMemo(() => {
    return allSubmissions.filter((sub) => isValidActiveMediaRecord(sub));
  }, [allSubmissions]);

  // Robustly match user submissions by uid, userId, normalized lowercase emails, or legacy authorName/teacherName
  const effectiveUserSubmissions = React.useMemo(() => {
    const teacherMatcher = {
      uid: currentUserUid,
      email: userEmail,
      teacherName: teacherName || defaultTeacherName,
      fullName: defaultTeacherName,
    };

    return activeAllSubmissions
      .filter((sub) => doesMediaRecordBelongToTeacher(sub, teacherMatcher))
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [activeAllSubmissions, currentUserUid, userEmail, teacherName, defaultTeacherName]);

  // Unified count across both teacher_innovations_submissions and teacher_media_repository
  const unifiedUserMedia = React.useMemo(() => {
    return getUnifiedTeacherMediaRecords(
      {
        uid: currentUserUid,
        email: userEmail,
        teacherName: teacherName || defaultTeacherName,
        fullName: defaultTeacherName,
      },
      activeAllSubmissions,
      teacherMedia
    );
  }, [currentUserUid, userEmail, teacherName, defaultTeacherName, activeAllSubmissions, teacherMedia]);

  // Prefill subjectGroup from existing user submission when not editing
  useEffect(() => {
    if (editingId || effectiveUserSubmissions.length === 0) return;
    const prevGroup = effectiveUserSubmissions.find((s) => s.subjectGroup)?.subjectGroup;
    if (prevGroup) {
      setSubjectGroup((curr) => (curr === SUBJECT_GROUPS[0] ? prevGroup : curr));
    }
  }, [effectiveUserSubmissions, editingId]);

  const userSubmissions = effectiveUserSubmissions;

  // Calculate next unsubmitted item slot (1 to 5)
  const nextUnsubmittedSlot = React.useMemo(() => {
    for (let i = 1; i <= 5; i++) {
      const slotUsed = unifiedUserMedia.slots[i - 1] && (unifiedUserMedia.slots[i - 1].title || unifiedUserMedia.slots[i - 1].status !== 'pending');
      if (!slotUsed) return i;
    }
    return 1;
  }, [unifiedUserMedia.slots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!teacherName.trim()) {
      alert('กรุณากรอก ชื่อ - สกุล');
      return;
    }
    if (!mediaTitle.trim()) {
      alert('กรุณากรอก ชื่อสื่อ / นวัตกรรมการสอน');
      return;
    }
    if (!usageDetails.trim()) {
      alert('กรุณากรอก ระบุการนำสื่อไปใช้อย่างไร 1)วิชา 2)หน่วยการเรียนรู้');
      return;
    }
    if (isDataOrBlobUri(imagePreview)) {
      alert('ไม่รองรับรูปภาพแบบ Base64 หรือ blob: เพื่อประหยัดพื้นที่ฐานข้อมูล กรุณาใช้ลิงก์ https:// หรือปล่อยว่างให้ระบบดึงปกจาก YouTube / ไอคอนอัตโนมัติ');
      return;
    }

    const sanitizedCoverUrl = sanitizeMediaThumbnailForFirestore(imagePreview, onlineUrl.trim());

    setIsSubmitting(true);
    try {
      if (editingId) {
        // Perform Update
        const res = await updateInnovationSubmission(
          editingId,
          {
            teacherName: teacherName.trim(),
            subjectGroup,
            gradeLevel,
            itemNumber,
            mediaTitle: mediaTitle.trim(),
            mediaType,
            productionType,
            usageDetails: usageDetails.trim(),
            onlineUrl: onlineUrl.trim(),
            imageUrl: sanitizedCoverUrl,
            coverImageUrl: sanitizedCoverUrl,
          },
          userEmail
        );

        if (res.success) {
          setActionNotice(`บันทึกการแก้ไขสื่อชิ้นที่ ${itemNumber} เรียบร้อยแล้ว`);
          setEditingId(null);
          setMediaTitle('');
          setUsageDetails('');
          setOnlineUrl('');
          setImagePreview('');
          setActiveTab('status');
          setTimeout(() => setActionNotice(null), 3000);
        } else {
          alert(res.error || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
        }
        return;
      }

      // Perform Create
      const res = await saveInnovationSubmission({
        teacherName: teacherName.trim(),
        subjectGroup,
        gradeLevel,
        itemNumber,
        mediaTitle: mediaTitle.trim(),
        mediaType,
        productionType,
        usageDetails: usageDetails.trim(),
        onlineUrl: onlineUrl.trim(),
        imageUrl: sanitizedCoverUrl || undefined,
        userEmail,
      });

      if (res.success) {
        setSubmittedId(res.id);
        setSubmitSuccess(true);
        // Reset some fields for next submission
        setMediaTitle('');
        setUsageDetails('');
        setOnlineUrl('');
        setImagePreview('');
        if (itemNumber < 5) {
          setItemNumber((prev) => prev + 1);
        }
      } else {
        alert(res.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (sub: InnovationSubmission) => {
    setEditingId(sub.id);
    setTeacherName(sub.teacherName);
    setSubjectGroup(sub.subjectGroup || SUBJECT_GROUPS[0]);
    setGradeLevel(sub.gradeLevel);
    setItemNumber(sub.itemNumber);
    setMediaTitle(sub.mediaTitle);
    setMediaType(sub.mediaType);
    setProductionType(sub.productionType);
    setUsageDetails(sub.usageDetails);
    setOnlineUrl(sub.onlineUrl || '');
    setImagePreview(sanitizeMediaThumbnailForFirestore(sub.imageUrl || sub.coverImageUrl, sub.onlineUrl));
    setActiveTab('form');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setMediaTitle('');
    setUsageDetails('');
    setOnlineUrl('');
    setImagePreview('');
  };

  const handleDeleteSubmission = async (sub: InnovationSubmission) => {
    if (deletingSubmissionId) return;
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลสื่อ "${sub.mediaTitle}" (ชิ้นที่ ${sub.itemNumber})?`)) {
      return;
    }
    setDeletingSubmissionId(sub.id);
    try {
      const res = await deleteInnovationSubmission(sub.id, userEmail);
      if (res.success) {
        setActionNotice(`ลบสื่อชิ้นที่ ${sub.itemNumber} เรียบร้อยแล้ว`);
        setTimeout(() => setActionNotice(null), 3000);
      } else {
        alert(res.error || 'ไม่สามารถลบข้อมูลได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    } finally {
      setDeletingSubmissionId(null);
    }
  };

  const handleDownloadCSV = () => {
    const dataToExport = allSubmissions.length > 0 ? allSubmissions : userSubmissions;
    const csvData = exportInnovationsToGoogleSheetsCSV(dataToExport);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ACU_Innovation_5_Items_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyGoogleSheetsTab = () => {
    const dataToExport = allSubmissions.length > 0 ? allSubmissions : userSubmissions;
    const headers = [
      'ลำดับ\tรหัสการส่ง\tวันเวลา\tอีเมลผู้ส่ง\tชื่อ-สกุล\tกลุ่มสาระการเรียนรู้\tระดับชั้น\tสื่อชิ้นที่\tชื่อสื่อ/นวัตกรรม\tประเภท\tการจัดทำ\tการนำไปใช้\tURL\tสถานะ'
    ];
    const rows = dataToExport.map((sub, idx) => {
      return [
        idx + 1,
        sub.id,
        new Date(sub.submittedAt).toLocaleString('th-TH'),
        sub.userEmail,
        sub.teacherName,
        sub.subjectGroup || '-',
        sub.gradeLevel,
        `ชิ้นที่ ${sub.itemNumber}`,
        sub.mediaTitle,
        sub.mediaType,
        sub.productionType,
        sub.usageDetails,
        sub.onlineUrl || '-',
        sub.status,
      ].join('\t');
    });

    const fullTsv = [...headers, ...rows].join('\n');
    navigator.clipboard.writeText(fullTsv).then(() => {
      setCopyNotice(true);
      setTimeout(() => setCopyNotice(false), 2500);
    });
  };

  const handleSendEmailSummary = () => {
    const subject = encodeURIComponent(`[สรุปข้อมูลส่งสื่อ/นวัตกรรม 5 ชิ้น] โรงเรียนอัสสัมชัญอุบลราชธานี`);
    const count = allSubmissions.length > 0 ? allSubmissions.length : userSubmissions.length;
    const body = encodeURIComponent(
      `เรียน ผู้ดูแลระบบ (${ADMIN_TARGET_EMAIL}),\n\nสรุปรายการส่งสื่อ/นวัตกรรม 5 ชิ้น ผ่านระบบคลังสื่อ ACU:\n` +
      `- จำนวนรายการที่บันทึกแล้ว: ${count} รายการ\n` +
      `- ฐานข้อมูลเชื่อมโยง: Firebase Project "System Test"\n` +
      `- ผู้ส่งข้อมูลล่าสุด: ${teacherName || userEmail}\n` +
      `- ตรวจสอบและดาวน์โหลดตารางสรุปข้อมูลได้ที่ระบบคลังสื่อ หรือนำเข้า Google Sheets ได้ทันที\n\n` +
      `โรงเรียนอัสสัมชัญอุบลราชธานี`
    );
    window.location.href = `mailto:${ADMIN_TARGET_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <div
      id="modal-innovation-submission"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-blue-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-900/80 via-indigo-900/60 to-slate-900 border-b border-blue-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                1. ส่งสื่อ/นวัตกรรม 5 ชิ้น
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  System Test
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                แบบฟอร์มประเมินและจัดส่งสื่อนวัตกรรมการจัดการเรียนรู้ โรงเรียนอัสสัมชัญอุบลราชธานี
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="รีเฟรชข้อมูลการส่งสื่อล่าสุด"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-4 sm:px-6 pt-2 gap-2 overflow-x-auto select-none">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'form'
                ? 'border-blue-400 text-blue-300 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>แบบฟอร์มส่งสื่อ (ชิ้นที่ {itemNumber}/5)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'status'
                ? 'border-blue-400 text-blue-300 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>เช็คสถานะการส่ง ({unifiedUserMedia.submittedCount}/5 ชิ้น)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sheets')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'sheets'
                ? 'border-emerald-400 text-emerald-300 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-emerald-300'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>สรุปข้อมูล (Google Sheets)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 text-slate-200">
          
          {/* Action notification toast */}
          {actionNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-between gap-3 text-emerald-300 text-xs font-semibold animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{actionNotice}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setActionNotice(null)}
                className="text-emerald-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: FORM */}
          {activeTab === 'form' && (
            <div>
              {editingId && (
                <div className="mb-5 p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 flex items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <Edit3 className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-amber-300">
                        กำลังอยู่ในโหมดแก้ไขข้อมูล: สื่อชิ้นที่ {itemNumber}
                      </h4>
                      <p className="text-[11px] text-amber-200/70">
                        ปรับแก้ข้อมูลตามต้องการ แล้วกดปุ่ม "บันทึกการแก้ไข" ด้านล่าง
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                  >
                    ยกเลิกการแก้ไข
                  </button>
                </div>
              )}

              {submitSuccess && !editingId && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 flex items-start gap-3 shadow-lg shadow-emerald-950/50 animate-in fade-in">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-emerald-300">
                      บันทึกข้อมูลสื่อชิ้นที่ {itemNumber === 1 ? 5 : itemNumber - 1} ลงฐานข้อมูลสำเร็จ!
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      ข้อมูลถูกจัดเก็บในฐานข้อมูล Firebase Project <span className="font-semibold text-white">"System Test"</span> เรียบร้อยแล้ว พร้อมนำไปแสดงผลในคลังสื่อคุณครู และบันทึกสถานะการส่ง {effectiveUserSubmissions.length}/5 ชิ้น
                    </p>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setActiveTab('status')}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>ตรวจสอบสถานะส่งสื่อ 5 ชิ้น ทันที</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitSuccess(false);
                          setItemNumber(nextUnsubmittedSlot);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                      >
                        ส่งสื่อชิ้นถัดไป (ชิ้นที่ {itemNumber})
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 5-Item Progress Chips Bar */}
              <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white">ความคืบหน้าการส่งสื่อ:</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold text-[11px] border border-blue-400/30">
                      {unifiedUserMedia.submittedCount} จาก 5 ชิ้น ({Math.min(100, Math.round((unifiedUserMedia.submittedCount / 5) * 100))}%)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('status')}
                    className="text-blue-400 hover:text-blue-300 font-semibold underline text-xs flex items-center gap-1 transition-colors"
                  >
                    <span>เปิดหน้าเช็คสถานะละเอียด</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((slot) => {
                    const found = effectiveUserSubmissions.find((s) => Number(s.itemNumber) === slot);
                    const unifiedSlot = unifiedUserMedia.slots[slot - 1];
                    const hasSlotItem = Boolean(found || (unifiedSlot && unifiedSlot.title));
                    const slotTitle = found?.mediaTitle || unifiedSlot?.title || '';
                    const isSelected = itemNumber === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          setItemNumber(slot);
                          if (found && !editingId) {
                            handleStartEdit(found);
                          }
                        }}
                        className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-400 bg-blue-600/30 text-white font-bold ring-2 ring-blue-500/40 shadow-sm'
                            : hasSlotItem
                            ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300 font-medium hover:border-emerald-400'
                            : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                        }`}
                        title={hasSlotItem ? `ชิ้นที่ ${slot}: ${slotTitle}${found ? ' (คลิกเพื่อแก้ไข)' : ''}` : `ชิ้นที่ ${slot}: ยังไม่ส่ง (คลิกเพื่อส่ง)`}
                      >
                        <div className="text-[10px] opacity-80">ชิ้นที่ {slot}</div>
                        <div className="text-xs font-bold truncate mt-0.5">
                          {hasSlotItem ? '✔ ส่งแล้ว' : 'รอส่ง'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Information Header */}
                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>เข้าสู่ระบบด้วย: <strong className="text-white">{userEmail}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-blue-300">
                    <Database className="w-3.5 h-3.5" />
                    <span>Firebase Project: System Test</span>
                  </div>
                </div>

                {/* 1. ชื่อ - สกุล */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                    ชื่อ - สกุล (ครูผู้สอน) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="เช่น ม.วีระพงษ์ มีทรัพย์ / มิสกานดา รุ่งเรือง"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-white placeholder-slate-500 outline-none"
                  />
                </div>

                {/* 2. กลุ่มสาระการเรียนรู้ของครูผู้สอน (ต่อจากชื่อ-สกุล ครูผู้สอน) */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                    <span>กลุ่มสาระการเรียนรู้ของครูผู้สอน <span className="text-rose-400">*</span></span>
                    <span className="text-[11px] text-blue-400 font-normal">9 กลุ่มสาระตามหลักสูตร</span>
                  </label>
                  <select
                    value={subjectGroup}
                    onChange={(e) => setSubjectGroup(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-white outline-none cursor-pointer"
                  >
                    {SUBJECT_GROUPS.map((sg) => (
                      <option key={sg} value={sg} className="bg-slate-900 text-white">
                        {sg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. ระบุระดับชั้นของครูผู้สอน */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                    ระบุระดับชั้นของครูผู้สอน <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-white outline-none cursor-pointer"
                  >
                    {GRADE_LEVELS.map((g) => (
                      <option key={g} value={g} className="bg-slate-900 text-white">
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. สื่อชิ้นที่ 1-5 */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-200 mb-2">
                    สื่อชิ้นที่ <span className="text-rose-400">*</span>
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {MEDIA_ITEM_NUMBERS.map((num) => {
                      const isSelected = itemNumber === num;
                      const hasSubmittedThis = userSubmissions.some((s) => s.itemNumber === num);
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setItemNumber(num)}
                          className={`py-2.5 rounded-xl text-center text-sm font-bold border transition-all flex flex-col items-center justify-center relative ${
                            isSelected
                              ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30'
                              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <span>{num}</span>
                          <span className="text-[10px] font-normal opacity-80">ชิ้นที่ {num}</span>
                          {hasSubmittedThis && (
                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400" title="เคยส่งแล้ว" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. ชื่อสื่อ / นวัตกรรมการสอน */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                    ชื่อสื่อ / นวัตกรรมการสอน <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    placeholder="เช่น ชุดจำลองการทดลองทางวิทยาศาสตร์เสมือนจริง / บอร์ดเกมคำศัพท์ภาษาอังกฤษ"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-white placeholder-slate-500 outline-none"
                  />
                </div>

                {/* 5. ประเภทของสื่อ / นวัตกรรม */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-200 mb-2">
                    ประเภทของสื่อ / นวัตกรรม <span className="text-rose-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {INNOVATION_MEDIA_TYPES.map((type) => (
                      <label
                        key={type}
                        className={`px-4 py-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                          mediaType === type
                            ? 'bg-blue-950/60 border-blue-400 text-white'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="mediaType"
                          value={type}
                          checked={mediaType === type}
                          onChange={() => setMediaType(type)}
                          className="text-blue-500 focus:ring-0"
                        />
                        <span className="text-xs sm:text-sm font-medium">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 6. การจัดทำสื่อ */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-200 mb-2">
                    การจัดทำสื่อ <span className="text-rose-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PRODUCTION_TYPES.map((prod) => (
                      <label
                        key={prod}
                        className={`px-4 py-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                          productionType === prod
                            ? 'bg-indigo-950/70 border-indigo-400 text-white'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="productionType"
                          value={prod}
                          checked={productionType === prod}
                          onChange={() => setProductionType(prod)}
                          className="text-indigo-500 focus:ring-0"
                        />
                        <span className="text-xs sm:text-sm font-medium">{prod}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 7. ระบุการนำสื่อไปใช้อย่างไร 1)วิชา 2หน่วยการเรียนรู้ */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                    ระบุการนำสื่อไปใช้อย่างไร 1)วิชา 2)หน่วยการเรียนรู้ <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={usageDetails}
                    onChange={(e) => setUsageDetails(e.target.value)}
                    placeholder="ตัวอย่าง : 1) วิชาวิทยาการคำนวณ 2) หน่วยฯที่ 1 แนวคิดเชิงคำนวณกับการแก้ไขปัญหา"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-white placeholder-slate-500 outline-none"
                  />
                </div>

                {/* 8. URL : สื่อที่อัปโหลดไว้ในออนไลน์ */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                    URL : สื่อที่อัปโหลดไว้ในออนไลน์ (Google Drive / Canva / YouTube / ลิงก์ออนไลน์)
                  </label>
                  <input
                    type="url"
                    value={onlineUrl}
                    onChange={(e) => setOnlineUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-white placeholder-slate-500 outline-none"
                  />
                </div>

                {/* 9. ภาพปกชิ้นงานอัตโนมัติ (YouTube / ไอคอน / External URL) */}
                {(() => {
                  const autoYtThumb = getYouTubeThumbnailUrl(onlineUrl);
                  const resolvedPreview = resolveDisplayThumbnailUrl(imagePreview, onlineUrl);
                  const linkCat = detectMediaLinkCategory(onlineUrl, mediaType);
                  const renderCategoryIcon = () => {
                    switch (linkCat.key) {
                      case 'youtube':
                        return <Youtube className="w-7 h-7 text-rose-400" />;
                      case 'gdrive':
                        return <HardDrive className="w-7 h-7 text-emerald-400" />;
                      case 'canva':
                        return <Palette className="w-7 h-7 text-cyan-400" />;
                      case 'pdf':
                      case 'print':
                        return <FileText className="w-7 h-7 text-amber-400" />;
                      case 'tech':
                        return <Globe className="w-7 h-7 text-blue-400" />;
                      default:
                        return <Layers className="w-7 h-7 text-indigo-400" />;
                    }
                  };

                  return (
                    <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <label className="block text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4 text-blue-400" />
                            <span>ภาพปกชิ้นงาน (ประหยัดพื้นที่ฐานข้อมูลอัตโนมัติ)</span>
                          </label>
                          <p className="text-[11px] text-slate-400">
                            วางลิงก์ YouTube เพื่อดึงภาพปกอัตโนมัติ หรือแสดงไอคอนหมวดหมู่สื่อสำหรับ Google Drive / Canva / PDF
                          </p>
                        </div>
                        {autoYtThumb && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                            ดึงปก YouTube อัตโนมัติ
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-lg w-44 h-24 bg-slate-900 flex-shrink-0 flex items-center justify-center">
                          {resolvedPreview ? (
                            <img
                              src={resolvedPreview}
                              alt="Cover Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1 text-center px-2">
                              {renderCategoryIcon()}
                              <span className="text-[10px] font-semibold text-slate-300">{linkCat.label}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 w-full space-y-2">
                          <label className="block text-[11px] text-slate-300 font-medium">
                            ลิงก์รูปภาพปกภายนอก (ไม่บังคับ — เฉพาะลิงก์ https:// เท่านั้น)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              value={imagePreview}
                              onChange={(e) => setImagePreview(e.target.value)}
                              placeholder="https://... (เว้นว่างไว้หากใช้ปก YouTube หรือไอคอนอัตโนมัติ)"
                              className="flex-1 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 focus:border-blue-500 text-xs text-white placeholder-slate-500 outline-none"
                            />
                            {imagePreview && (
                              <button
                                type="button"
                                onClick={() => setImagePreview('')}
                                className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                                title="ล้างลิงก์ภาพปก"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            ระบบงดบันทึกไฟล์ภาพ Base64 ลงในคลังสื่อ เพื่อรองรับผลงานคุณครูหลายพันรายการได้อย่างรวดเร็วและไม่เต็มโควต้า 1GB
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Form Action Buttons */}
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                    <span>บันทึกเข้าระบบ Firebase Project "System Test" ทันที</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-lg flex items-center gap-2 transition-all disabled:opacity-50 ${
                        editingId 
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/25' 
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {isSubmitting 
                          ? 'กำลังบันทึก...' 
                          : editingId 
                            ? `บันทึกการแก้ไขสื่อชิ้นที่ ${itemNumber}` 
                            : `ส่งสื่อชิ้นที่ ${itemNumber}`}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: STATUS */}
          {activeTab === 'status' && (() => {
            // Determine all unique teachers across BOTH innovations and teacher_media_repository (deduplicated)
            const teacherMap = new Map<string, { email: string; name: string; count: number; group: string; seenIds: Set<string> }>();
            const registerTeacherItem = (item: any, fallbackTitle: string) => {
              if (!isValidActiveMediaRecord(item)) return;
              const email = extractMediaEmails(item)[0] || '';
              const name = (item.teacherName || item.authorName || '').trim();
              const emailKey = email || name.toLowerCase();
              if (!emailKey || !fallbackTitle) return;
              const canonicalId = String(item.id || '').startsWith('work_') ? String(item.id).slice(5) : String(item.id || '');
              const existing = teacherMap.get(emailKey);
              if (existing) {
                if (canonicalId && existing.seenIds.has(canonicalId)) return;
                if (canonicalId) existing.seenIds.add(canonicalId);
                existing.count++;
              } else {
                const seenIds = new Set<string>();
                if (canonicalId) seenIds.add(canonicalId);
                teacherMap.set(emailKey, {
                  email: email || emailKey,
                  name: name || email,
                  count: 1,
                  group: item.subjectGroup || '',
                  seenIds,
                });
              }
            };
            activeAllSubmissions.forEach((s) => registerTeacherItem(s, s.mediaTitle));
            teacherMedia.forEach((m) => registerTeacherItem(m, m.title));
            const distinctTeachers = Array.from(teacherMap.values());

            // Active teacher focus for the 5-slot matrix
            const isViewingSelf = selectedTeacherView === 'my' || selectedTeacherView === userEmail.toLowerCase().trim();
            const activeTeacherEmail = isViewingSelf ? userEmail.trim().toLowerCase() : selectedTeacherView;
            const focusedTeacherName = isViewingSelf
              ? (teacherName || defaultTeacherName || userEmail)
              : (teacherMap.get(activeTeacherEmail)?.name || activeTeacherEmail);

            const focusedMatcher = {
              uid: isViewingSelf ? currentUserUid : (activeTeacherEmail.includes('@') ? resolveUserUid(activeTeacherEmail) : ''),
              email: activeTeacherEmail.includes('@') ? activeTeacherEmail : '',
              teacherName: focusedTeacherName,
              fullName: focusedTeacherName,
            };

            const focusedUnified = isViewingSelf
              ? unifiedUserMedia
              : getUnifiedTeacherMediaRecords(focusedMatcher, activeAllSubmissions, teacherMedia);

            // Submissions belonging to the focused teacher for the 5-slot board
            const focusedTeacherSubmissions = isViewingSelf
              ? effectiveUserSubmissions
              : activeAllSubmissions.filter((s) => doesMediaRecordBelongToTeacher(s, focusedMatcher));

            // Filter submissions list based on search, view mode, subject group, and completion
            const baseSubmissions = selectedTeacherView === 'my'
              ? effectiveUserSubmissions
              : selectedTeacherView === 'all'
              ? activeAllSubmissions
              : activeAllSubmissions.filter((s) => doesMediaRecordBelongToTeacher(s, focusedMatcher));

            const displayedSubmissions = baseSubmissions.filter((sub) => {
              // Subject group filter
              if (selectedGroupFilter !== 'all' && sub.subjectGroup !== selectedGroupFilter) {
                return false;
              }

              // Search term filter (teacher name, title, usage details, email)
              if (statusSearchTerm.trim()) {
                const term = statusSearchTerm.trim().toLowerCase();
                const matchName = (sub.teacherName || '').toLowerCase().includes(term);
                const matchTitle = (sub.mediaTitle || '').toLowerCase().includes(term);
                const matchUsage = (sub.usageDetails || '').toLowerCase().includes(term);
                const matchEmail = (sub.userEmail || extractMediaEmails(sub)[0] || '').toLowerCase().includes(term);
                const matchGroup = (sub.subjectGroup || '').toLowerCase().includes(term);
                if (!matchName && !matchTitle && !matchUsage && !matchEmail && !matchGroup) {
                  return false;
                }
              }

              return true;
            });

            const completedSlotsCount = focusedUnified.submittedCount;
            const progressPercent = Math.min(100, Math.round((completedSlotsCount / 5) * 100));

            return (
              <div className="space-y-5">
                {/* 1. Header & Search / Switcher Bar */}
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3.5 shadow-md">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span>ระบบตรวจสอบและติดตามสถานะการส่งสื่อ 5 ชิ้น</span>
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        ตรวจสอบความคืบหน้ารายชิ้นงาน (ชิ้นที่ 1-5) พร้อมค้นหาและตรวจสอบสถานะของคุณครูได้ทุกท่าน
                      </p>
                    </div>

                    {/* View Switcher: My Submissions vs All Teachers */}
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-700/80 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedTeacherView('my')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          selectedTeacherView === 'my'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ผลงานของฉัน ({unifiedUserMedia.submittedCount}/5)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTeacherView('all')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          selectedTeacherView === 'all'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        คุณครูทั้งหมด ({activeAllSubmissions.length} รายการ)
                      </button>
                    </div>
                  </div>

                  {/* Search and Filters Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-slate-700/60">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={statusSearchTerm}
                        onChange={(e) => setStatusSearchTerm(e.target.value)}
                        placeholder="ค้นหาชื่อครู, ชื่อสื่อ, กลุ่มสาระ, อีเมล..."
                        className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                      />
                      {statusSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setStatusSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Subject Group Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700">
                      <span className="text-xs text-slate-400 whitespace-nowrap">กลุ่มสาระ:</span>
                      <select
                        value={selectedGroupFilter}
                        onChange={(e) => setSelectedGroupFilter(e.target.value)}
                        className="bg-transparent text-xs text-indigo-300 font-semibold focus:outline-none cursor-pointer w-full truncate"
                      >
                        <option value="all" className="bg-slate-900 text-white">ทุกกลุ่มสาระการเรียนรู้</option>
                        {SUBJECT_GROUPS.map((sg) => (
                          <option key={sg} value={sg} className="bg-slate-900 text-white">
                            {sg}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Teacher Select Dropdown */}
                    <div className="flex items-center gap-1.5 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700">
                      <span className="text-xs text-slate-400 whitespace-nowrap">เลือกครู:</span>
                      <select
                        value={selectedTeacherView}
                        onChange={(e) => setSelectedTeacherView(e.target.value)}
                        className="bg-transparent text-xs text-amber-300 font-semibold focus:outline-none cursor-pointer w-full truncate"
                      >
                        <option value="my" className="bg-slate-900 text-white">
                          บัญชีของฉัน ({userEmail})
                        </option>
                        <option value="all" className="bg-slate-900 text-white">
                          -- แสดงคุณครูทุกท่าน ({distinctTeachers.length} ท่าน) --
                        </option>
                        {distinctTeachers.map((t) => (
                          <option key={t.email} value={t.email.toLowerCase()} className="bg-slate-900 text-white">
                            {t.name} ({t.count}/5 ชิ้น) - {t.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Visual 5-Item Progress Board */}
                <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border border-blue-500/30 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-400" />
                          <span>แผงสถานะการส่งสื่อ 5 ชิ้น:</span>
                          <span className="text-amber-300 font-extrabold">{focusedTeacherName}</span>
                        </span>
                        {isViewingSelf && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 font-semibold">
                            บัญชีของคุณ
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300">
                        เกณฑ์มาตรฐาน: ส่งสื่อการจัดการเรียนรู้อย่างน้อย 5 ชิ้น ในปีการศึกษาปัจจุบัน
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-sm ${
                        completedSlotsCount >= 5
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                      }`}>
                        <CheckCircle2 className={`w-3.5 h-3.5 ${completedSlotsCount >= 5 ? 'text-emerald-400' : 'text-blue-400'}`} />
                        <span>ส่งแล้ว {completedSlotsCount} จาก 5 ชิ้น ({progressPercent}%)</span>
                      </div>
                      {completedSlotsCount < 5 && (
                        <span className="text-xs px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                          ขาดอีก {5 - completedSlotsCount} ชิ้น
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2.5 rounded-full bg-slate-800/90 overflow-hidden p-0.5 border border-slate-700/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* 5 Distinct Item Cards (ชิ้นที่ 1 ถึง ชิ้นที่ 5) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
                    {[1, 2, 3, 4, 5].map((slotNumber) => {
                      const match = focusedTeacherSubmissions.find((s) => Number(s.itemNumber) === slotNumber);
                      const unifiedSlot = focusedUnified.slots[slotNumber - 1];
                      const unifiedRec = unifiedSlot?.title
                        ? focusedUnified.records.find((r) => r.title === unifiedSlot.title)
                        : undefined;
                      const isSubmitted = Boolean(match || (unifiedSlot && unifiedSlot.title));
                      const displayTitle = match?.mediaTitle || unifiedSlot?.title || '';
                      const displayMediaType = match?.mediaType || unifiedSlot?.category || 'สื่อการสอน';
                      const displayOnlineUrl = match?.onlineUrl || unifiedSlot?.linkUrl || '';
                      const displayImageUrl = resolveDisplayThumbnailUrl(
                        match?.imageUrl || match?.coverImageUrl || unifiedSlot?.coverImageUrl,
                        displayOnlineUrl
                      );
                      const slotLinkCat = detectMediaLinkCategory(displayOnlineUrl, displayMediaType);
                      const displaySubjectGroup = match?.subjectGroup || unifiedRec?.subjectGroup || '-';
                      const displayDateText = match?.submittedAt
                        ? new Date(match.submittedAt).toLocaleDateString('th-TH')
                        : (unifiedSlot?.submittedDate || 'ส่งแล้ว');
                      const ownerEmailForAction = match?.userEmail || unifiedRec?.ownerEmail || '';

                      const renderSlotCategoryIcon = () => {
                        switch (slotLinkCat.key) {
                          case 'youtube':
                            return <Youtube className="w-6 h-6 text-rose-400" />;
                          case 'gdrive':
                            return <HardDrive className="w-6 h-6 text-emerald-400" />;
                          case 'canva':
                            return <Palette className="w-6 h-6 text-cyan-400" />;
                          case 'pdf':
                          case 'print':
                            return <FileText className="w-6 h-6 text-amber-400" />;
                          case 'tech':
                            return <Globe className="w-6 h-6 text-blue-400" />;
                          default:
                            return <Layers className="w-6 h-6 text-indigo-400" />;
                        }
                      };

                      return (
                        <div
                          key={slotNumber}
                          className={`rounded-2xl p-3.5 border transition-all flex flex-col justify-between ${
                            isSubmitted
                              ? 'bg-slate-800/90 border-emerald-500/50 shadow-md shadow-emerald-950/20 hover:border-emerald-400'
                              : 'bg-slate-900/60 border-dashed border-slate-700/80 hover:border-slate-600'
                          }`}
                        >
                          <div>
                            {/* Card Header: Slot Number & Status Badge */}
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span className="text-xs font-black text-white px-2 py-0.5 rounded-md bg-slate-950/60 border border-slate-700">
                                ชิ้นที่ {slotNumber}
                              </span>
                              {isSubmitted ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>ส่งแล้ว</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>รอส่ง</span>
                                </span>
                              )}
                            </div>

                            {/* Card Body: Thumbnail or Category Icon */}
                            {isSubmitted ? (
                              <div className="space-y-2">
                                {displayImageUrl ? (
                                  <div className="w-full h-20 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 relative">
                                    <img
                                      src={displayImageUrl}
                                      alt={displayTitle}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/acu_active_logo.png';
                                      }}
                                    />
                                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white font-medium">
                                      {displayMediaType}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-full h-16 rounded-xl bg-slate-900/80 border border-slate-700/80 flex flex-col items-center justify-center gap-0.5 relative">
                                    {renderSlotCategoryIcon()}
                                    <span className="text-[9px] font-semibold text-slate-300">{slotLinkCat.label}</span>
                                  </div>
                                )}
                                <div>
                                  <h5 className="text-xs font-bold text-white line-clamp-2 leading-tight" title={displayTitle}>
                                    {displayTitle}
                                  </h5>
                                  <p className="text-[10px] text-slate-400 truncate mt-1">
                                    {displaySubjectGroup}
                                  </p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {displayDateText}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="py-6 text-center space-y-1.5">
                                <div className="w-10 h-10 rounded-2xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-slate-500">
                                  <Layers className="w-5 h-5" />
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium">
                                  ยังไม่ได้ส่งสื่อชิ้นนี้
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Card Footer Actions */}
                          <div className="mt-3 pt-2.5 border-t border-slate-700/60">
                            {isSubmitted ? (
                              <div className="flex items-center gap-1.5 justify-between">
                                {displayOnlineUrl ? (
                                  <a
                                    href={displayOnlineUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-sky-300 text-[11px] font-medium flex items-center gap-1 transition-colors"
                                    title="เปิดดูสื่อออนไลน์"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>เปิดดู</span>
                                  </a>
                                ) : (
                                  <span />
                                )}

                                {canUserModify(ownerEmailForAction, userEmail) && (
                                  <div className="flex items-center gap-1">
                                    {match && (
                                      <button
                                        type="button"
                                        onClick={() => handleStartEdit(match)}
                                        className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                        title="แก้ไขข้อมูลสื่อ"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                        <span>แก้ไข</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      disabled={Boolean(deletingSubmissionId)}
                                      onClick={async () => {
                                        if (match) {
                                          handleDeleteSubmission(match);
                                        } else if (unifiedRec?.mediaWorkId && !deletingSubmissionId) {
                                          if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลสื่อ "${displayTitle}"?`)) {
                                            setDeletingSubmissionId(unifiedRec.mediaWorkId);
                                            try {
                                              const res = await deleteTeacherMedia(unifiedRec.mediaWorkId, userEmail);
                                              if (res.success) {
                                                setActionNotice(`ลบสื่อ "${displayTitle}" เรียบร้อยแล้ว`);
                                                setTimeout(() => setActionNotice(null), 3000);
                                              } else {
                                                alert(res.error || 'ไม่สามารถลบข้อมูลได้');
                                              }
                                            } catch {
                                              alert('เกิดข้อผิดพลาดในการลบข้อมูล');
                                            } finally {
                                              setDeletingSubmissionId(null);
                                            }
                                          }
                                        }
                                      }}
                                      className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 disabled:opacity-50 text-rose-300 border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                      title="ลบสื่อนี้"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>
                                        {(match && deletingSubmissionId === match.id) || (unifiedRec?.mediaWorkId && deletingSubmissionId === unifiedRec.mediaWorkId)
                                          ? 'กำลังลบ...'
                                          : 'ลบ'}
                                      </span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setItemNumber(slotNumber);
                                  setEditingId(null);
                                  setActiveTab('form');
                                }}
                                className="w-full py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <span>+ ส่งชิ้นที่ {slotNumber}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Detailed Submissions Records List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span>
                      รายการผลงานที่แสดง: <strong className="text-white">{displayedSubmissions.length}</strong> รายการ
                      {statusSearchTerm && ` (ค้นหา "${statusSearchTerm}")`}
                    </span>
                    {displayedSubmissions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleCopyGoogleSheetsTab}
                        className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>คัดลอกตาราง ({displayedSubmissions.length})</span>
                      </button>
                    )}
                  </div>

                  {displayedSubmissions.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 space-y-3">
                      <BookOpen className="w-10 h-10 mx-auto text-slate-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-300">
                          {statusSearchTerm
                            ? `ไม่พบผลงานที่ตรงกับคำค้นหา "${statusSearchTerm}"`
                            : 'ยังไม่พบรายการส่งสื่อตามเงื่อนไขที่เลือก'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          คุณครูสามารถคลิกปุ่มด้านล่างเพื่อส่งสื่อนวัตกรรมชิ้นแรกได้ทันที
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGroupFilter('all');
                          setStatusSearchTerm('');
                          setItemNumber(nextUnsubmittedSlot);
                          setEditingId(null);
                          setActiveTab('form');
                        }}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold transition-colors shadow-md shadow-blue-600/30"
                      >
                        ส่งสื่อชิ้นที่ {nextUnsubmittedSlot} ตอนนี้
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayedSubmissions.map((sub) => (
                        <div
                          key={sub.id}
                          className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-blue-500/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {sub.imageUrl ? (
                              <img
                                src={sub.imageUrl}
                                alt={sub.mediaTitle}
                                className="w-16 h-16 rounded-xl object-cover border border-slate-600 flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/acu_active_logo.png';
                                }}
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-blue-900/40 border border-blue-500/30 flex items-center justify-center text-blue-300 flex-shrink-0">
                                <Layers className="w-6 h-6" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-bold text-xs">
                                  สื่อชิ้นที่ {sub.itemNumber}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium text-xs">
                                  {sub.subjectGroup || 'กลุ่มสาระการเรียนรู้คณิตศาสตร์'}
                                </span>
                                <span className="text-xs text-slate-400">{sub.gradeLevel}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                                  {sub.status || 'ส่งเรียบร้อย'}
                                </span>
                                {sub.userEmail && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30 font-mono">
                                    {sub.userEmail}
                                  </span>
                                )}
                              </div>
                              <h5 className="text-sm font-bold text-white truncate">{sub.mediaTitle}</h5>
                              <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                                {sub.usageDetails}
                              </p>
                              <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  {new Date(sub.submittedAt).toLocaleString('th-TH')}
                                </span>
                                <span>การจัดทำ: <strong className="text-slate-300">{sub.productionType}</strong></span>
                                <span>ครูผู้สอน: <strong className="text-white">{sub.teacherName}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Actions: Open URL, Edit, Delete */}
                          <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                            {sub.onlineUrl && (
                              <a
                                href={sub.onlineUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-xs text-blue-300 flex items-center gap-1 transition-colors font-medium"
                                title="เปิดดูสื่อออนไลน์"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>เปิดดู</span>
                              </a>
                            )}

                            {canUserModify(sub.userEmail, userEmail) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(sub)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs flex items-center gap-1 transition-colors font-bold cursor-pointer"
                                  title="แก้ไขข้อมูลสื่อ"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>แก้ไข</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={Boolean(deletingSubmissionId)}
                                  onClick={() => handleDeleteSubmission(sub)}
                                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-50 text-rose-300 border border-rose-500/30 text-xs flex items-center gap-1 transition-colors font-bold cursor-pointer"
                                  title="ลบข้อมูลสื่อ"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{deletingSubmissionId === sub.id ? 'กำลังลบ...' : 'ลบ'}</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* TAB 3: GOOGLE SHEETS SUMMARY */}
          {activeTab === 'sheets' && (() => {
            const baseSubmissions = (allSubmissions.length > 0 ? allSubmissions : userSubmissions);
            const displayedSubmissions = baseSubmissions.filter((sub) => {
              if (selectedGroupFilter === 'all') return true;
              return sub.subjectGroup === selectedGroupFilter;
            });

            return (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      ปุ่มสรุปข้อมูล Google Sheets (เชื่อมต่ออีเมล: {ADMIN_TARGET_EMAIL})
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      ข้อมูลทั้งหมดถูกจัดเก็บในฐานข้อมูล Firebase Project <strong className="text-white">"System Test"</strong> สามารถสรุปผล แยกดูตามกลุ่มสาระ หรือเปิดใน Google Sheets ได้ทันที
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Filter in Sheets tab */}
                    <div className="flex items-center gap-1.5 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700">
                      <span className="text-xs text-slate-400">กลุ่มสาระ:</span>
                      <select
                        value={selectedGroupFilter}
                        onChange={(e) => setSelectedGroupFilter(e.target.value)}
                        className="bg-transparent text-xs text-emerald-300 font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value="all" className="bg-slate-900 text-white">ทุกกลุ่มสาระ ({baseSubmissions.length})</option>
                        {SUBJECT_GROUPS.map((sg) => (
                          <option key={sg} value={sg} className="bg-slate-900 text-white">
                            {sg}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadCSV}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      <span>ดาวน์โหลด CSV สำหรับ Google Sheets</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyGoogleSheetsTab}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
                    >
                      <Copy className="w-4 h-4 text-emerald-400" />
                      <span>{copyNotice ? 'คัดลอกตารางแล้ว!' : 'คัดลอกลง Google Sheets'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSendEmailSummary}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors shadow-md"
                    >
                      <Mail className="w-4 h-4" />
                      <span>ส่งรายงานสรุปถึง Admin</span>
                    </button>
                  </div>
                </div>

                {/* Data Table */}
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-800 text-slate-300 uppercase sticky top-0 border-b border-slate-700">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">ชิ้นที่</th>
                          <th className="p-3">ชื่อ - สกุล</th>
                          <th className="p-3 text-indigo-300">กลุ่มสาระการเรียนรู้</th>
                          <th className="p-3">ระดับชั้น</th>
                          <th className="p-3">ชื่อสื่อ / นวัตกรรม</th>
                          <th className="p-3">ประเภท</th>
                          <th className="p-3">การจัดทำ</th>
                          <th className="p-3">วันเวลาส่ง</th>
                          <th className="p-3">อีเมล</th>
                          <th className="p-3">สถานะ</th>
                          {isAdmin && <th className="p-3 text-center text-amber-300 font-semibold">จัดการ (Admin)</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {displayedSubmissions.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-800/50">
                            <td className="p-3 text-slate-500">{idx + 1}</td>
                            <td className="p-3 font-bold text-blue-300">{item.itemNumber}</td>
                            <td className="p-3 text-white font-medium">{item.teacherName}</td>
                            <td className="p-3 font-semibold text-indigo-300 whitespace-nowrap">{item.subjectGroup || '-'}</td>
                            <td className="p-3">{item.gradeLevel}</td>
                            <td className="p-3 max-w-xs truncate font-medium text-slate-200">{item.mediaTitle}</td>
                            <td className="p-3">{item.mediaType}</td>
                            <td className="p-3">{item.productionType}</td>
                            <td className="p-3 text-slate-400 whitespace-nowrap">
                              {new Date(item.submittedAt).toLocaleDateString('th-TH')}
                            </td>
                            <td className="p-3 text-slate-400 whitespace-nowrap">{item.userEmail}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
                                {item.status}
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="p-3 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(item)}
                                    className="p-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                                    title="Admin: แก้ไขสื่อนี้"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSubmission(item)}
                                    className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30"
                                    title="Admin: ลบสื่อนี้"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
};
