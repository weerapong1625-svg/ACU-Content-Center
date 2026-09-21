import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft,
  ShieldCheck, 
  ShieldAlert, 
  BarChart3, 
  FileSpreadsheet, 
  Layers, 
  Users, 
  Image as ImageIcon, 
  UploadCloud, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  Copy, 
  Download, 
  Camera, 
  Sparkles, 
  School, 
  Eye, 
  X, 
  Check, 
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  FolderArchive,
  Edit3,
  Trash2,
  Calendar,
  TrendingUp,
  UserCheck,
  FileText,
  Upload
} from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { 
  SUPER_ADMIN_EMAIL, 
  saveSchoolLogo, 
  resetSchoolLogo, 
  subscribeSchoolLogo, 
  DEFAULT_LOGO_IMAGE 
} from '../services/logoService';
import { 
  InnovationSubmission, 
  FacilitySubmission, 
  subscribeAllInnovations, 
  subscribeAllSubmissions,
  saveCriteriaPoster,
  subscribeCriteriaPoster,
  DEFAULT_CRITERIA_POSTER,
  GRADE_LEVELS,
  updateInnovationSubmission,
  deleteInnovationSubmission,
  updateFacilitySubmission,
  deleteFacilitySubmission,
  MEDIA_ITEM_NUMBERS,
  INNOVATION_MEDIA_TYPES,
  PRODUCTION_TYPES
} from '../services/submissionService';
import { 
  fetchGoogleSheetsConfig, 
  saveGoogleSheetsConfig, 
  generateInnovationsTSV, 
  generateInnovationsCSV,
  generateFacilitiesTSV,
  generateFacilitiesCSV,
  aggregateTeacherSummary,
  generateTeacherSummaryTSV,
  generateTeacherSummaryCSV,
  downloadFile,
  copyToClipboard,
  DEFAULT_NEW_SHEET_URL,
  TeacherSummaryItem
} from '../services/googleSheetsService';
import {
  LoginLogEntry,
  subscribeAllLoginLogs,
  generateLoginLogsTSV,
  generateLoginLogsCSV
} from '../services/auditService';
import {
  PopupBannerConfig,
  subscribePopupBanner,
  savePopupBannerConfig,
  DEFAULT_BANNER_IMAGE,
  DEFAULT_BANNER_IMAGE_2
} from '../services/bannerService';

interface AdminDashboardProps {
  userEmail: string;
  onBack: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ userEmail, onBack }) => {
  const isSuperAdmin = userEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'stats' | 'visitors' | 'innovations' | 'teachers' | 'facilities' | 'settings'>('stats');

  // Real-time Firestore data
  const [innovations, setInnovations] = useState<InnovationSubmission[]>([]);
  const [facilities, setFacilities] = useState<FacilitySubmission[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Yearly Stats Filter
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // Visitor logs search filter
  const [visitorSearchTerm, setVisitorSearchTerm] = useState('');

  // Innovation Editing / Deleting Modal States
  const [editingInnovation, setEditingInnovation] = useState<InnovationSubmission | null>(null);
  const [isSavingInnovationEdit, setIsSavingInnovationEdit] = useState(false);
  const [deletingInnovationId, setDeletingInnovationId] = useState<string | null>(null);
  const [deletingInnovationTitle, setDeletingInnovationTitle] = useState<string>('');
  const [isDeletingInnovation, setIsDeletingInnovation] = useState(false);

  // Facility Editing / Deleting Modal States
  const [editingFacility, setEditingFacility] = useState<FacilitySubmission | null>(null);
  const [isSavingFacilityEdit, setIsSavingFacilityEdit] = useState(false);
  const [deletingFacilityId, setDeletingFacilityId] = useState<string | null>(null);
  const [deletingFacilityTitle, setDeletingFacilityTitle] = useState<string>('');
  const [isDeletingFacility, setIsDeletingFacility] = useState(false);

  // Popup Banner Management State (2 images)
  const [bannerConfig, setBannerConfig] = useState<PopupBannerConfig>({
    bannerImageUrl: DEFAULT_BANNER_IMAGE,
    bannerImageUrl2: DEFAULT_BANNER_IMAGE_2,
    title: 'ประกาศ/ภาพประชาสัมพันธ์ 1',
    title2: 'ประกาศ/ภาพประชาสัมพันธ์ 2 (พระราชดำรัสฯ ด้าน AI)',
  });
  const [banner1Preview, setBanner1Preview] = useState<string | null>(null);
  const [banner2Preview, setBanner2Preview] = useState<string | null>(null);
  const [banner1Title, setBanner1Title] = useState('ภาพประชาสัมพันธ์ 1');
  const [banner2Title, setBanner2Title] = useState('ภาพประชาสัมพันธ์ 2 (พระราชดำรัสฯ ด้าน AI)');
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  const [bannerStatusMsg, setBannerStatusMsg] = useState<string | null>(null);
  const banner1FileInputRef = React.useRef<HTMLInputElement>(null);
  const banner2FileInputRef = React.useRef<HTMLInputElement>(null);

  // Logo management state
  const [currentLogoUrl, setCurrentLogoUrl] = useState(DEFAULT_LOGO_IMAGE);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [logoStatusMsg, setLogoStatusMsg] = useState<string | null>(null);

  // Criteria Poster management state
  const [currentPosterUrl, setCurrentPosterUrl] = useState(DEFAULT_CRITERIA_POSTER);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [isSavingPoster, setIsSavingPoster] = useState(false);
  const [posterStatusMsg, setPosterStatusMsg] = useState<string | null>(null);

  // Google Sheets configuration state
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(DEFAULT_NEW_SHEET_URL);
  const [isSavingSheetUrl, setIsSavingSheetUrl] = useState(false);
  const [sheetUrlMsg, setSheetUrlMsg] = useState<string | null>(null);

  // Copy & export feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Image preview modal state
  const [previewModalImg, setPreviewModalImg] = useState<{ url: string; title: string } | null>(null);

  // Search & Filters for Innovations
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');
  const [selectedMediaTypeFilter, setSelectedMediaTypeFilter] = useState('all');

  // File inputs
  const logoFileInputRef = React.useRef<HTMLInputElement>(null);
  const posterFileInputRef = React.useRef<HTMLInputElement>(null);

  // Show Toast
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 1. Subscribe to real-time collections
  useEffect(() => {
    setIsLoading(true);
    const unsubInnovations = subscribeAllInnovations((list) => {
      setInnovations(list);
      setIsLoading(false);
    });

    const unsubFacilities = subscribeAllSubmissions((list) => {
      setFacilities(list);
    });

    const unsubLogo = subscribeSchoolLogo((url: string) => {
      setCurrentLogoUrl(url);
    });

    const unsubPoster = subscribeCriteriaPoster((url: string) => {
      setCurrentPosterUrl(url);
    });

    const unsubLogs = subscribeAllLoginLogs((logs) => {
      setLoginLogs(logs);
    });

    const unsubBanner = subscribePopupBanner((cfg) => {
      if (cfg) {
        setBannerConfig(cfg);
        if (cfg.title) setBanner1Title(cfg.title);
        if (cfg.title2) setBanner2Title(cfg.title2);
      }
    });

    // Fetch Google Sheets Config
    fetchGoogleSheetsConfig().then((cfg) => {
      if (cfg.sheetUrl) setGoogleSheetsUrl(cfg.sheetUrl);
    });

    return () => {
      unsubInnovations();
      unsubFacilities();
      unsubLogo();
      unsubPoster();
      unsubLogs();
      unsubBanner();
    };
  }, []);

  // Compute aggregated summaries
  const teacherSummaries = useMemo(() => {
    return aggregateTeacherSummary(innovations);
  }, [innovations]);

  // Filtered innovations list
  const filteredInnovations = useMemo(() => {
    return innovations.filter((item) => {
      const matchSearch = searchTerm === '' || 
        item.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.mediaTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.usageDetails.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchGrade = selectedGradeFilter === 'all' || item.gradeLevel === selectedGradeFilter;
      const matchType = selectedMediaTypeFilter === 'all' || item.mediaType === selectedMediaTypeFilter;

      return matchSearch && matchGrade && matchType;
    });
  }, [innovations, searchTerm, selectedGradeFilter, selectedMediaTypeFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalSubmissions = innovations.length;
    const totalTeachers = teacherSummaries.length;
    const completed5Count = teacherSummaries.filter(t => t.isComplete).length;
    const inProgressCount = totalTeachers - completed5Count;
    const totalFacilities = facilities.length;

    // By Grade
    const gradeCounts: Record<string, number> = {};
    innovations.forEach(i => {
      gradeCounts[i.gradeLevel] = (gradeCounts[i.gradeLevel] || 0) + 1;
    });

    // By Media Type
    const mediaTypeCounts: Record<string, number> = {
      'สื่อสิ่งพิมพ์': 0,
      'สื่อเทคโนโลยี': 0,
      'สื่ออื่น ๆ': 0,
    };
    innovations.forEach(i => {
      if (mediaTypeCounts[i.mediaType] !== undefined) {
        mediaTypeCounts[i.mediaType]++;
      } else {
        mediaTypeCounts['สื่ออื่น ๆ']++;
      }
    });

    // By Production Type
    let selfMadeCount = 0;
    let sourcedCount = 0;
    innovations.forEach(i => {
      if (i.productionType === 'ครูผลิตสื่อเอง') selfMadeCount++;
      else sourcedCount++;
    });

    return {
      totalSubmissions,
      totalTeachers,
      completed5Count,
      inProgressCount,
      totalFacilities,
      gradeCounts,
      mediaTypeCounts,
      selfMadeCount,
      sourcedCount,
    };
  }, [innovations, teacherSummaries, facilities]);

  // Handle Logo Upload
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 500;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/png');
          setLogoPreview(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = async () => {
    if (!logoPreview) return;
    setIsSavingLogo(true);
    setLogoStatusMsg(null);
    const res = await saveSchoolLogo(logoPreview, SUPER_ADMIN_EMAIL);
    setIsSavingLogo(false);
    if (res.success) {
      setCurrentLogoUrl(logoPreview);
      setLogoPreview(null);
      setLogoStatusMsg('บันทึกภาพโลโก้โรงเรียนสำเร็จ ระบบอัปเดตตรงกันทุกหน้า');
      showToast('บันทึกโลโก้โรงเรียนเรียบร้อย');
    } else {
      setLogoStatusMsg(res.message);
    }
  };

  const handleResetLogo = async () => {
    if (!confirm('ยืนยันรีเซ็ตโลโก้กลับเป็นตราดั้งเดิม (ACU N.png) ใช่หรือไม่?')) return;
    setIsSavingLogo(true);
    const res = await resetSchoolLogo(SUPER_ADMIN_EMAIL);
    setIsSavingLogo(false);
    if (res.success) {
      setLogoPreview(null);
      setLogoStatusMsg('รีเซ็ตโลโก้กลับเป็นค่าเดิมเรียบร้อย');
      showToast('รีเซ็ตโลโก้กลับเป็นค่าเดิมสำเร็จ');
    }
  };

  // Handle Criteria Poster Upload
  const handlePosterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setPosterPreview(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSavePoster = async () => {
    if (!posterPreview) return;
    setIsSavingPoster(true);
    setPosterStatusMsg(null);
    const res = await saveCriteriaPoster(posterPreview, SUPER_ADMIN_EMAIL);
    setIsSavingPoster(false);
    if (res.success) {
      setCurrentPosterUrl(posterPreview);
      setPosterPreview(null);
      setPosterStatusMsg('บันทึกภาพเกณฑ์/ประเภทสื่อสำเร็จ ภาพเปลี่ยนทันที');
      showToast('บันทึกภาพเกณฑ์/ประเภทสื่อเรียบร้อย');
    } else {
      setPosterStatusMsg(res.message);
    }
  };

  // Handle Google Sheets URL Save
  const handleSaveSheetUrl = async () => {
    setIsSavingSheetUrl(true);
    setSheetUrlMsg(null);
    const res = await saveGoogleSheetsConfig(googleSheetsUrl, SUPER_ADMIN_EMAIL);
    setIsSavingSheetUrl(false);
    setSheetUrlMsg(res.message);
    if (res.success) {
      showToast('บันทึกลิงก์ Google Sheets เรียบร้อย');
    }
  };

  // Copy to Google Sheets Actions (TSV format for direct paste)
  const handleCopyInnovationsTSV = async () => {
    const tsv = generateInnovationsTSV(innovations);
    const success = await copyToClipboard(tsv);
    if (success) {
      showToast('คัดลอกตารางแล้ว! สามารถเปิด Google Sheets แล้วกด Ctrl+V (วาง) ได้ทันที');
    } else {
      alert('ไม่สามารถคัดลอกได้อัตโนมัติ กรุณาดาวน์โหลดเป็นไฟล์ CSV แทน');
    }
  };

  const handleCopyTeachersTSV = async () => {
    const tsv = generateTeacherSummaryTSV(teacherSummaries);
    const success = await copyToClipboard(tsv);
    if (success) {
      showToast('คัดลอกตารางสรุปรายชื่อครูแล้ว! วางลง Google Sheets ได้ทันที');
    }
  };

  const handleCopyFacilitiesTSV = async () => {
    const tsv = generateFacilitiesTSV(facilities);
    const success = await copyToClipboard(tsv);
    if (success) {
      showToast('คัดลอกตารางแหล่งเรียนรู้แล้ว! วางลง Google Sheets ได้ทันที');
    }
  };

  // Filtered visitor login logs
  const filteredLoginLogs = useMemo(() => {
    if (!visitorSearchTerm.trim()) return loginLogs;
    const term = visitorSearchTerm.toLowerCase();
    return loginLogs.filter(
      (l) => l.email.toLowerCase().includes(term) || l.displayName.toLowerCase().includes(term)
    );
  }, [loginLogs, visitorSearchTerm]);

  // Yearly Stats calculation
  const yearlyStats = useMemo(() => {
    const targetYear = parseInt(selectedYear) || 2026;

    const yearInnovations = innovations.filter(i => {
      const d = new Date(i.submittedAt);
      return !isNaN(d.getTime()) && d.getFullYear() === targetYear;
    });

    const yearFacilities = facilities.filter(f => {
      const d = new Date(f.createdAt || f.usageDateTime);
      return !isNaN(d.getTime()) && d.getFullYear() === targetYear;
    });

    const yearLogs = loginLogs.filter(l => {
      const d = new Date(l.loginTimestamp);
      return !isNaN(d.getTime()) && d.getFullYear() === targetYear;
    });

    const uniqueVisitorEmails = new Set(yearLogs.map(l => l.email.trim().toLowerCase())).size;

    const monthNames = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    const monthlyBreakdown = monthNames.map((name, idx) => {
      const visits = yearLogs.filter(l => {
        const d = new Date(l.loginTimestamp);
        return !isNaN(d.getTime()) && d.getMonth() === idx;
      }).length;
      const mediaCount = yearInnovations.filter(i => {
        const d = new Date(i.submittedAt);
        return !isNaN(d.getTime()) && d.getMonth() === idx;
      }).length;
      const facCount = yearFacilities.filter(f => {
        const d = new Date(f.createdAt || f.usageDateTime);
        return !isNaN(d.getTime()) && d.getMonth() === idx;
      }).length;

      return {
        monthName: name,
        monthIndex: idx + 1,
        visits,
        mediaCount,
        facCount,
      };
    });

    return {
      targetYear,
      totalVisits: yearLogs.length,
      uniqueVisitors: uniqueVisitorEmails,
      totalMedia: yearInnovations.length,
      totalFacilities: yearFacilities.length,
      monthlyBreakdown,
    };
  }, [innovations, facilities, loginLogs, selectedYear]);

  // Handle Innovation Edit Save
  const handleSaveInnovationEdit = async () => {
    if (!editingInnovation) return;
    setIsSavingInnovationEdit(true);
    const res = await updateInnovationSubmission(
      editingInnovation.id,
      {
        teacherName: editingInnovation.teacherName,
        gradeLevel: editingInnovation.gradeLevel,
        itemNumber: editingInnovation.itemNumber,
        mediaType: editingInnovation.mediaType,
        productionType: editingInnovation.productionType,
        mediaTitle: editingInnovation.mediaTitle,
        usageDetails: editingInnovation.usageDetails,
        onlineUrl: editingInnovation.onlineUrl,
        imageUrl: editingInnovation.imageUrl,
        coverImageUrl: editingInnovation.coverImageUrl,
      },
      userEmail
    );
    setIsSavingInnovationEdit(false);
    if (res.success) {
      showToast('บันทึกการแก้ไขข้อมูลสื่อเรียบร้อยแล้ว');
      setEditingInnovation(null);
    } else {
      alert(res.error || 'เกิดข้อผิดพลาดในการแก้ไขสื่อ');
    }
  };

  // Handle Innovation Delete
  const handleDeleteInnovation = async () => {
    if (!deletingInnovationId) return;
    setIsDeletingInnovation(true);
    const res = await deleteInnovationSubmission(deletingInnovationId, userEmail);
    setIsDeletingInnovation(false);
    if (res.success) {
      showToast('ลบข้อมูลสื่อออกจากระบบสำเร็จ');
      setDeletingInnovationId(null);
      setDeletingInnovationTitle('');
    } else {
      alert(res.error || 'เกิดข้อผิดพลาดในการลบสื่อ');
    }
  };

  // Handle Facility Edit Save
  const handleSaveFacilityEdit = async () => {
    if (!editingFacility) return;
    setIsSavingFacilityEdit(true);
    const res = await updateFacilitySubmission(
      editingFacility.id,
      {
        teacherName: editingFacility.teacherName,
        subjectGroup: editingFacility.subjectGroup,
        learningCenter: editingFacility.learningCenter,
        periods: editingFacility.periods,
        usageDateTime: editingFacility.usageDateTime,
        feedback: editingFacility.feedback,
        imageUrl: editingFacility.imageUrl,
      },
      userEmail
    );
    setIsSavingFacilityEdit(false);
    if (res.success) {
      showToast('บันทึกการแก้ไขข้อมูลแหล่งเรียนรู้เรียบร้อย');
      setEditingFacility(null);
    } else {
      alert(res.error || 'เกิดข้อผิดพลาดในการแก้ไขแหล่งเรียนรู้');
    }
  };

  // Handle Facility Delete
  const handleDeleteFacility = async () => {
    if (!deletingFacilityId) return;
    setIsDeletingFacility(true);
    const res = await deleteFacilitySubmission(deletingFacilityId, userEmail);
    setIsDeletingFacility(false);
    if (res.success) {
      showToast('ลบข้อมูลบันทึกแหล่งเรียนรู้ออกจากระบบสำเร็จ');
      setDeletingFacilityId(null);
      setDeletingFacilityTitle('');
    } else {
      alert(res.error || 'เกิดข้อผิดพลาดในการลบแหล่งเรียนรู้');
    }
  };

  // Handle Banner Files Upload
  const handleBanner1FileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_W = 1200;
        let w = img.width;
        let h = img.height;
        if (w > MAX_W) {
          h = Math.round((h * MAX_W) / w);
          w = MAX_W;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setBanner1Preview(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleBanner2FileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_W = 1200;
        let w = img.width;
        let h = img.height;
        if (w > MAX_W) {
          h = Math.round((h * MAX_W) / w);
          w = MAX_W;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setBanner2Preview(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBanners = async () => {
    setIsSavingBanner(true);
    setBannerStatusMsg(null);
    const success = await savePopupBannerConfig({
      bannerImageUrl: banner1Preview || bannerConfig.bannerImageUrl,
      bannerImageUrl2: banner2Preview || bannerConfig.bannerImageUrl2,
      title: banner1Title || bannerConfig.title,
      title2: banner2Title || bannerConfig.title2,
      updatedBy: userEmail,
    });
    setIsSavingBanner(false);
    if (success) {
      setBannerStatusMsg('บันทึกภาพป๊อปอัปประชาสัมพันธ์หน้าแรกสำเร็จ อัปเดตทันที');
      showToast('บันทึกภาพป๊อปอัปหน้าแรกเรียบร้อย');
      setBanner1Preview(null);
      setBanner2Preview(null);
    } else {
      setBannerStatusMsg('เกิดข้อผิดพลาดในการบันทึกภาพป๊อปอัป');
    }
  };

  const handleResetBanners = async () => {
    if (!confirm('ต้องการรีเซ็ตภาพป๊อปอัปประชาสัมพันธ์กลับเป็นค่าเริ่มต้นใช่หรือไม่?')) return;
    setIsSavingBanner(true);
    const success = await savePopupBannerConfig({
      bannerImageUrl: DEFAULT_BANNER_IMAGE,
      bannerImageUrl2: DEFAULT_BANNER_IMAGE_2,
      title: 'พระราชดำรัส สมเด็จพระกนิษฐาธิราชเจ้า กรมสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี',
      title2: 'พระราชดำรัสเกี่ยวกับการใช้ปัญญาประดิษฐ์ (AI)',
      updatedBy: userEmail,
    });
    setIsSavingBanner(false);
    if (success) {
      setBanner1Preview(null);
      setBanner2Preview(null);
      setBanner1Title('พระราชดำรัส สมเด็จพระกนิษฐาธิราชเจ้า กรมสมเด็จพระเทพรัตนราชสุดาฯ สยามบรมราชกุมารี');
      setBanner2Title('พระราชดำรัสเกี่ยวกับการใช้ปัญญาประดิษฐ์ (AI)');
      setBannerStatusMsg('รีเซ็ตภาพป๊อปอัปกลับเป็นค่าเริ่มต้นเรียบร้อย');
      showToast('รีเซ็ตภาพป๊อปอัปเรียบร้อย');
    }
  };

  // Visitor Logs Copy / Download
  const handleCopyVisitorLogsTSV = async () => {
    const tsv = generateLoginLogsTSV(filteredLoginLogs);
    const ok = await copyToClipboard(tsv);
    if (ok) {
      showToast('คัดลอกสถิติผู้เข้าชมสำเร็จ! วางลง Google Sheets ได้ทันที (Ctrl+V)');
    } else {
      alert('ไม่สามารถคัดลอกได้อัตโนมัติ กรุณาดาวน์โหลดเป็น CSV แทน');
    }
  };

  // If unauthorized, render strict access-denied screen
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-['Prompt',sans-serif]">
        <div className="w-full max-w-md bg-slate-900 border border-red-500/30 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-400/40 text-red-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">พื้นที่สงวนสิทธิ์เฉพาะ Admin</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            ระบบตรวจสอบพบว่าอีเมลปัจจุบันของคุณ (<span className="text-amber-300 font-mono">{userEmail || 'ยังไม่ได้เข้าสู่ระบบ'}</span>) ไม่ได้รับสิทธิ์ผู้ดูแลระบบสูงสุด หน้านี้เปิดให้เข้าถึงได้เฉพาะบัญชี Gmail:
            <br />
            <strong className="text-red-400 font-mono text-sm block mt-1">{SUPER_ADMIN_EMAIL}</strong>
          </p>

          <div className="space-y-3">
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
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg transition-all"
            >
              เข้าสู่ระบบในฐานะ Admin ({SUPER_ADMIN_EMAIL})
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              ← กลับหน้าเลือกบทบาท
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-['Prompt',sans-serif] select-none">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-[200] animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold shadow-2xl border border-white/20 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Top Header Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          
          {/* Left: Back button & Title */}
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="กลับหน้าเลือกบทบาท"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">กลับ</span>
            </button>

            <div className="w-10 h-10 rounded-full bg-white p-1 flex items-center justify-center shadow-md overflow-hidden flex-shrink-0">
              <img
                src={currentLogoUrl}
                alt="School Logo"
                className="w-full h-full object-contain rounded-full"
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>แดชบอร์ดเฉพาะ Admin (ผู้ดูแลระบบ)</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  <span>Super Admin</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                โรงเรียนอัสสัมชัญอุบลราชธานี • บัญชีผู้ดูแล: <span className="text-blue-300 font-mono">{SUPER_ADMIN_EMAIL}</span>
              </p>
            </div>
          </div>

          {/* Right: Quick Google Sheets Button & Active Sheet Link */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap">
            <button
              type="button"
              onClick={() => window.open(googleSheetsUrl || DEFAULT_NEW_SHEET_URL, '_blank')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
              title="เปิด Google Sheets เปรดชีตใหม่"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>เปิด Google Sheets (เปรดชีต)</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-400/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="เปลี่ยนภาพโลโก้และตั้งค่า"
            >
              <Camera className="w-3.5 h-3.5 text-blue-300" />
              <span>เปลี่ยนภาพโลโก้ / ตั้งค่า</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto mt-3 flex items-center gap-1 overflow-x-auto pb-1 text-xs scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>สถิติและสรุปประจำปี</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('visitors')}
            className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'visitors'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>สถิติผู้เข้าชม ({loginLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('innovations')}
            className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'innovations'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>ข้อมูลการส่งสื่อ 5 ชิ้น ({innovations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('teachers')}
            className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'teachers'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>สรุปรายชื่อครู ({teacherSummaries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('facilities')}
            className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'facilities'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <School className="w-3.5 h-3.5" />
            <span>บันทึกแหล่งเรียนรู้ 33 แหล่ง ({facilities.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-300 hover:text-white hover:bg-amber-500/20'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>จัดการโลโก้ & โปสเตอร์ & ป๊อปอัป</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-grow">
        
        {/* =========================================================================
            TAB 1: สถิติและภาพรวมเว็บไซต์ (Stats & Overview)
           ========================================================================= */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            
            {/* 4 Hero Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-950/60 to-slate-900 border border-blue-500/30 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-300">ครูที่ส่งผลงานทั้งหมด</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black text-white">{stats.totalTeachers} <span className="text-sm font-normal text-slate-400">ท่าน</span></div>
                <div className="text-[11px] text-slate-400 mt-1">ลงชื่อเข้าใช้และส่งสื่อผ่านระบบ</div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/30 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-indigo-300">สื่อและนวัตกรรมทั้งหมด</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black text-white">{stats.totalSubmissions} <span className="text-sm font-normal text-slate-400">ชิ้น</span></div>
                <div className="text-[11px] text-slate-400 mt-1">เป้าหมายสูงสุด 5 ชิ้น/ท่าน</div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-emerald-300">ครูที่ส่งครบ 5 ชิ้นแล้ว</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black text-white">{stats.completed5Count} <span className="text-sm font-normal text-slate-400">ท่าน</span></div>
                <div className="text-[11px] text-emerald-400/90 mt-1">ส่งผลงานครบตามเกณฑ์ 100%</div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/60 to-slate-900 border border-amber-500/30 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-amber-300">การบันทึกแหล่งเรียนรู้</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                    <School className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-black text-white">{stats.totalFacilities} <span className="text-sm font-normal text-slate-400">ครั้ง</span></div>
                <div className="text-[11px] text-slate-400 mt-1">33 แหล่งเรียนรู้ 9 คาบเรียน</div>
              </div>
            </div>

            {/* Breakdown Visual Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Media Types Breakdown */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span>การจำแนกตามประเภทของสื่อ / นวัตกรรม</span>
                </h3>

                <div className="space-y-4">
                  {Object.entries(stats.mediaTypeCounts).map(([type, count]) => {
                    const percent = stats.totalSubmissions > 0 
                      ? Math.round((count / stats.totalSubmissions) * 100) 
                      : 0;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-300">{type}</span>
                          <span className="font-semibold text-white">{count} ชิ้น ({percent}%)</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Production Types Summary */}
                <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-slate-800/50">
                    <div className="text-xs text-slate-400">ครูผลิตสื่อเอง</div>
                    <div className="text-xl font-bold text-emerald-400 mt-0.5">{stats.selfMadeCount} ชิ้น</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/50">
                    <div className="text-xs text-slate-400">นำสื่อจากแหล่งอื่นมาใช้</div>
                    <div className="text-xl font-bold text-sky-400 mt-0.5">{stats.sourcedCount} ชิ้น</div>
                  </div>
                </div>
              </div>

              {/* Grade Levels Breakdown */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <span>การส่งสื่อแยกตามระดับชั้นครูผู้สอน</span>
                </h3>

                <div className="max-h-72 overflow-y-auto pr-2 space-y-3 scrollbar-thin">
                  {GRADE_LEVELS.map((grade) => {
                    const count = stats.gradeCounts[grade] || 0;
                    const percent = stats.totalSubmissions > 0 
                      ? Math.round((count / stats.totalSubmissions) * 100) 
                      : 0;
                    return (
                      <div key={grade}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-300">{grade}</span>
                          <span className="font-semibold text-slate-200">{count} ชิ้น</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Yearly Statistical Summary View */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>สรุปข้อมูลสถิติประจำปี (Yearly Summary)</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                        พ.ศ. {parseInt(selectedYear) + 543}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">สรุปภาพรวมยอดผู้เข้าชม การส่งสื่อ และการใช้แหล่งเรียนรู้ตามปีปฏิทิน</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">เลือกปี:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-300 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="2026">2026 (พ.ศ. 2569)</option>
                    <option value="2025">2025 (พ.ศ. 2568)</option>
                    <option value="2024">2024 (พ.ศ. 2567)</option>
                  </select>
                </div>
              </div>

              {/* 4 Cards for the selected year */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>ผู้เข้าชมทั้งหมดปี {selectedYear}</span>
                  </div>
                  <div className="text-2xl font-black text-white mt-1">
                    {yearlyStats.totalVisits} <span className="text-xs font-normal text-slate-400">ครั้ง</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ผู้เข้าชมไม่ซ้ำ (อีเมล)</span>
                  </div>
                  <div className="text-2xl font-black text-emerald-300 mt-1">
                    {yearlyStats.uniqueVisitors} <span className="text-xs font-normal text-slate-400">บัญชี</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>ส่งสื่อในปี {selectedYear}</span>
                  </div>
                  <div className="text-2xl font-black text-indigo-300 mt-1">
                    {yearlyStats.totalMedia} <span className="text-xs font-normal text-slate-400">ชิ้น</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5 text-amber-400" />
                    <span>ใช้แหล่งเรียนรู้ปี {selectedYear}</span>
                  </div>
                  <div className="text-2xl font-black text-amber-300 mt-1">
                    {yearlyStats.totalFacilities} <span className="text-xs font-normal text-slate-400">ครั้ง</span>
                  </div>
                </div>
              </div>

              {/* 12-Month Table Breakdown */}
              <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/60 border-b border-slate-700/60 text-xs font-bold text-white flex items-center justify-between">
                  <span>สถิติรายเดือนประจำปี {selectedYear} (มกราคม - ธันวาคม)</span>
                  <span className="text-[11px] text-slate-400 font-normal">ข้อมูลสรุป 12 เดือน</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">เดือน</th>
                        <th className="py-2.5 px-3 text-center">ยอดเข้าชม (ครั้ง)</th>
                        <th className="py-2.5 px-3 text-center">ส่งสื่อการสอน (ชิ้น)</th>
                        <th className="py-2.5 px-3 text-center">ใช้แหล่งเรียนรู้ (ครั้ง)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {yearlyStats.monthlyBreakdown.map((m) => (
                        <tr key={m.monthName} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-3 font-medium text-white">{m.monthName}</td>
                          <td className="py-2 px-3 text-center font-mono text-sky-300">
                            {m.visits > 0 ? m.visits : <span className="text-slate-600">0</span>}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-indigo-300">
                            {m.mediaCount > 0 ? m.mediaCount : <span className="text-slate-600">0</span>}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-amber-300">
                            {m.facCount > 0 ? m.facCount : <span className="text-slate-600">0</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick Actions & Google Sheets Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-900 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <span>ส่งออกและซิงค์ข้อมูลไปยัง Google Sheets (เปรดชีต)</span>
                </h4>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  ข้อมูลการส่งสื่อ 5 ชิ้น, แหล่งเรียนรู้, สถิติผู้เข้าชม สามารถคัดลอกหรือส่งออกแยกเป็นไฟล์ชีตได้อย่างสะดวกรวดเร็ว
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyInnovationsTSV}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>คัดลอกตารางเพื่อวางลง Google Sheets</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadFile('ACU_สื่อนวัตกรรม_5_ชิ้น.csv', generateInnovationsCSV(innovations))}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลด CSV</span>
                </button>
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            TAB: ตารางสถิติผู้เข้าชมระบบ (Visitor Logs Table)
           ========================================================================= */}
        {activeTab === 'visitors' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>สถิติผู้เข้าชมระบบ (Visitor Statistics & Logs)</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-semibold">
                    {filteredLoginLogs.length} รายการ
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  บันทึกประวัติการเข้าใช้งานจริงตามอีเมล Google SSO แสดงชื่อ เวลา วันเดือนปีอย่างละเอียด
                </p>
              </div>

              <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
                <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={visitorSearchTerm}
                    onChange={(e) => setVisitorSearchTerm(e.target.value)}
                    placeholder="ค้นหาอีเมล หรือชื่อผู้ใช้..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCopyVisitorLogsTSV}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="คัดลอกข้อมูลสถิติผู้เข้าชมเพื่อนำไปวางลง Google Sheets"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกลง Google Sheets</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadFile('ACU_สถิติผู้เข้าชมระบบ.csv', generateLoginLogsCSV(filteredLoginLogs))}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="ดาวน์โหลดไฟล์สถิติ CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ส่งออก CSV</span>
                </button>
              </div>
            </div>

            {/* Visitors Table */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/90 text-slate-400 font-semibold border-b border-slate-700 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="py-3 px-3.5 text-center w-12">ลำดับ</th>
                      <th className="py-3 px-3.5">อีเมลผู้ใช้งาน (Google Account)</th>
                      <th className="py-3 px-3.5">ชื่อ-นามสกุล / ชื่อผู้ใช้</th>
                      <th className="py-3 px-3.5 text-center">บทบาท</th>
                      <th className="py-3 px-3.5 text-center">วิธีเข้าสู่ระบบ</th>
                      <th className="py-3 px-3.5 text-center">วันเดือนปี (พ.ศ.)</th>
                      <th className="py-3 px-3.5 text-center">เวลา</th>
                      <th className="py-3 px-3.5 text-center">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredLoginLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          {visitorSearchTerm ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา' : 'ยังไม่มีประวัติการเข้าชมระบบที่บันทึกไว้'}
                        </td>
                      </tr>
                    ) : (
                      filteredLoginLogs.map((log, index) => {
                        const dateObj = new Date(log.loginTimestamp);
                        const dateStr = isNaN(dateObj.getTime())
                          ? '-'
                          : dateObj.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
                        const timeStr = isNaN(dateObj.getTime())
                          ? '-'
                          : dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                        return (
                          <tr key={log.id || index} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3.5 text-center text-slate-400">{index + 1}</td>
                            <td className="py-3 px-3.5 font-mono text-sky-300 font-medium">{log.email}</td>
                            <td className="py-3 px-3.5 text-white font-medium">{log.displayName}</td>
                            <td className="py-3 px-3.5 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px]">
                                {log.role === 'teacher' ? 'ครูผู้สอน' : log.role === 'student' ? 'นักเรียน' : 'ผู้ใช้งาน'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-center text-slate-400 text-[11px]">{log.loginMethod}</td>
                            <td className="py-3 px-3.5 text-center text-slate-300 whitespace-nowrap">{dateStr}</td>
                            <td className="py-3 px-3.5 text-center font-mono text-slate-300 whitespace-nowrap">{timeStr}</td>
                            <td className="py-3 px-3.5 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>เข้าสู่ระบบ</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: ข้อมูลการส่งสื่อ 5 ชิ้น (Innovation Submissions Table)
           ========================================================================= */}
        {activeTab === 'innovations' && (
          <div className="space-y-4">
            
            {/* Top Toolbar: Search, Filters, and Google Sheets Export */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap">
                <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ค้นหาชื่อครู, สื่อ, วิชา..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <select
                  value={selectedGradeFilter}
                  onChange={(e) => setSelectedGradeFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="all">ทุกระดับชั้น ({innovations.length})</option>
                  {GRADE_LEVELS.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>

                <select
                  value={selectedMediaTypeFilter}
                  onChange={(e) => setSelectedMediaTypeFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="all">ทุกประเภทสื่อ</option>
                  <option value="สื่อสิ่งพิมพ์">สื่อสิ่งพิมพ์</option>
                  <option value="สื่อเทคโนโลยี">สื่อเทคโนโลยี</option>
                  <option value="สื่ออื่น ๆ">สื่ออื่น ๆ</option>
                </select>
              </div>

              {/* Export buttons for this table */}
              <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleCopyInnovationsTSV}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="คัดลอกข้อมูลตารางเพื่อวางลง Google Sheets ทันที"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกลง Google Sheets</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadFile('ACU_สื่อนวัตกรรม_5_ชิ้น.csv', generateInnovationsCSV(innovations))}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="ดาวน์โหลดไฟล์ CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ส่งออก CSV</span>
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-3.5 text-center w-12">ลำดับ</th>
                      <th className="py-3 px-3.5">ชื่อ-สกุลครูผู้สอน</th>
                      <th className="py-3 px-3.5">ระดับชั้น</th>
                      <th className="py-3 px-3 text-center">ชิ้นที่</th>
                      <th className="py-3 px-3.5">ชื่อสื่อ / นวัตกรรม</th>
                      <th className="py-3 px-3.5">ประเภท & การจัดทำ</th>
                      <th className="py-3 px-3.5">การนำไปใช้</th>
                      <th className="py-3 px-3 text-center">ลิงก์ / รูปภาพ</th>
                      <th className="py-3 px-3.5 text-center">วันเวลาที่ส่ง</th>
                      <th className="py-3 px-3.5 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredInnovations.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-500">
                          {isLoading ? 'กำลังโหลดข้อมูลจาก Firestore...' : 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา'}
                        </td>
                      </tr>
                    ) : (
                      filteredInnovations.map((item, index) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3.5 text-center text-slate-400">{index + 1}</td>
                          <td className="py-3 px-3.5 font-medium text-white">
                            <div>{item.teacherName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{item.userEmail}</div>
                          </td>
                          <td className="py-3 px-3.5 text-slate-300 whitespace-nowrap">{item.gradeLevel}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 font-bold text-xs border border-blue-400/30">
                              {item.itemNumber}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-sky-300 max-w-xs truncate" title={item.mediaTitle}>
                            {item.mediaTitle}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="text-slate-200">{item.mediaType}</div>
                            <div className="text-[10px] text-slate-400">{item.productionType}</div>
                          </td>
                          <td className="py-3 px-3.5 text-slate-400 max-w-xs truncate" title={item.usageDetails}>
                            {item.usageDetails}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.onlineUrl && (
                                <a
                                  href={item.onlineUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 transition-colors"
                                  title={`เปิดลิงก์สื่อ: ${item.onlineUrl}`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {item.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewModalImg({ url: item.imageUrl!, title: `${item.mediaTitle} - ${item.teacherName}` })}
                                  className="p-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 transition-colors cursor-pointer"
                                  title="คลิกเพื่อดูรูปภาพแนบขนาดเต็ม"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {!item.onlineUrl && !item.imageUrl && (
                                <span className="text-slate-600 text-[10px]">-</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-center text-slate-400 text-[11px] whitespace-nowrap">
                            {new Date(item.submittedAt).toLocaleDateString('th-TH', {
                              day: '2-digit',
                              month: 'short',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingInnovation(item)}
                                className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 transition-colors cursor-pointer"
                                title="แก้ไขข้อมูลสื่อ"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingInnovationId(item.id);
                                  setDeletingInnovationTitle(item.mediaTitle);
                                }}
                                className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition-colors cursor-pointer"
                                title="ลบสื่อนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            TAB 3: สรุปรายชื่อครูและสถานะการส่งสื่อ (Teachers Progress)
           ========================================================================= */}
        {activeTab === 'teachers' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-white">ตารางสรุปสถานะการส่งสื่อ 5 ชิ้น แยกตามรายชื่อครูผู้สอน</h3>
                <p className="text-xs text-slate-400">ตรวจสอบได้ทันทีว่าคุณครูท่านใดส่งครบ 5 ชิ้นแล้ว หรือยังขาดชิ้นใด</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyTeachersTSV}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="คัดลอกข้อมูลตารางเพื่อวางลง Google Sheets"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกลง Google Sheets</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadFile('ACU_สรุปรายชื่อครูผู้ส่งสื่อ.csv', generateTeacherSummaryCSV(teacherSummaries))}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ส่งออก CSV</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-3.5 text-center w-12">ลำดับ</th>
                      <th className="py-3 px-3.5">ชื่อ-สกุลครูผู้สอน</th>
                      <th className="py-3 px-3.5">อีเมลบัญชี</th>
                      <th className="py-3 px-3.5 text-center">ความคืบหน้า (จาก 5 ชิ้น)</th>
                      <th className="py-3 px-3.5 text-center">สถานะ</th>
                      <th className="py-3 px-3.5">ชิ้นที่ 1</th>
                      <th className="py-3 px-3.5">ชิ้นที่ 2</th>
                      <th className="py-3 px-3.5">ชิ้นที่ 3</th>
                      <th className="py-3 px-3.5">ชิ้นที่ 4</th>
                      <th className="py-3 px-3.5">ชิ้นที่ 5</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {teacherSummaries.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-500">
                          ยังไม่มีข้อมูลการส่งสื่อจากคุณครู
                        </td>
                      </tr>
                    ) : (
                      teacherSummaries.map((teacher, index) => (
                        <tr key={teacher.email || index} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3.5 text-center text-slate-400">{index + 1}</td>
                          <td className="py-3 px-3.5 font-bold text-white whitespace-nowrap">{teacher.teacherName}</td>
                          <td className="py-3 px-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">{teacher.email}</td>
                          <td className="py-3 px-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-bold text-white">{teacher.submittedCount}/5</span>
                              <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${teacher.isComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                  style={{ width: `${(teacher.submittedCount / 5) * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            {teacher.isComplete ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                                ครบ 5 ชิ้นแล้ว
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px]">
                                ขาดอีก {5 - teacher.submittedCount} ชิ้น
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-slate-400 max-w-[120px] truncate" title={teacher.item1}>{teacher.item1}</td>
                          <td className="py-3 px-3.5 text-slate-400 max-w-[120px] truncate" title={teacher.item2}>{teacher.item2}</td>
                          <td className="py-3 px-3.5 text-slate-400 max-w-[120px] truncate" title={teacher.item3}>{teacher.item3}</td>
                          <td className="py-3 px-3.5 text-slate-400 max-w-[120px] truncate" title={teacher.item4}>{teacher.item4}</td>
                          <td className="py-3 px-3.5 text-slate-400 max-w-[120px] truncate" title={teacher.item5}>{teacher.item5}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: บันทึกแหล่งเรียนรู้ 33 แหล่ง (Facility Usages)
           ========================================================================= */}
        {activeTab === 'facilities' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-white">บันทึกการใช้แหล่งเรียนรู้ภายในโรงเรียน (33 แหล่ง 9 คาบ)</h3>
                <p className="text-xs text-slate-400">ข้อมูลการจองและใช้ห้องปฏิบัติการ ศูนย์การเรียนรู้ และห้องสมุด</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyFacilitiesTSV}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="คัดลอกข้อมูลตารางเพื่อวางลง Google Sheets"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกลง Google Sheets</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadFile('ACU_บันทึกแหล่งเรียนรู้ภายในโรงเรียน.csv', generateFacilitiesCSV(facilities))}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ส่งออก CSV</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-3.5 text-center w-12">ลำดับ</th>
                      <th className="py-3 px-3.5">ชื่อครูผู้สอน</th>
                      <th className="py-3 px-3.5">กลุ่มสาระการเรียนรู้</th>
                      <th className="py-3 px-3.5">แหล่งเรียนรู้ / ห้อง</th>
                      <th className="py-3 px-3.5 text-center">คาบเรียน</th>
                      <th className="py-3 px-3.5">วันเวลาที่ใช้งาน</th>
                      <th className="py-3 px-3.5 text-center">วันเดือนปีที่ส่ง</th>
                      <th className="py-3 px-3.5">ข้อเสนอแนะ / ผลลัพธ์</th>
                      <th className="py-3 px-3 text-center">ภาพ</th>
                      <th className="py-3 px-3.5 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {facilities.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-500">
                          ยังไม่มีบันทึกการใช้แหล่งเรียนรู้ในระบบ
                        </td>
                      </tr>
                    ) : (
                      facilities.map((fac, idx) => {
                        const submittedDate = fac.createdAt
                          ? new Date(fac.createdAt).toLocaleDateString('th-TH', {
                              day: '2-digit',
                              month: 'short',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : (fac.usageDateTime || '-');

                        return (
                          <tr key={fac.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3.5 text-center text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-3.5 font-semibold text-white whitespace-nowrap">{fac.teacherName}</td>
                            <td className="py-3 px-3.5 text-slate-300">{fac.subjectGroup}</td>
                            <td className="py-3 px-3.5 text-sky-300 font-medium">{fac.learningCenter}</td>
                            <td className="py-3 px-3.5 text-center">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[11px]">
                                {Array.isArray(fac.periods) ? fac.periods.join(', ') : fac.periods}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-slate-400 whitespace-nowrap">{fac.usageDateTime || '-'}</td>
                            <td className="py-3 px-3.5 text-center text-slate-400 text-[11px] whitespace-nowrap">{submittedDate}</td>
                            <td className="py-3 px-3.5 text-slate-300 max-w-xs truncate" title={fac.feedback}>{fac.feedback || '-'}</td>
                            <td className="py-3 px-3 text-center">
                              {fac.imageUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewModalImg({ url: fac.imageUrl!, title: `${fac.learningCenter} - ${fac.teacherName}` })}
                                  className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 transition-colors cursor-pointer"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingFacility(fac)}
                                  className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 transition-colors cursor-pointer"
                                  title="แก้ไขบันทึกแหล่งเรียนรู้"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeletingFacilityId(fac.id);
                                    setDeletingFacilityTitle(`${fac.learningCenter} (${fac.teacherName})`);
                                  }}
                                  className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition-colors cursor-pointer"
                                  title="ลบบันทึกนี้"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: จัดการโลโก้ & โปสเตอร์ & Google Sheets (Settings & Assets)
           ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            
            {/* Section 1: เปลี่ยนภาพโลโก้โรงเรียน (School Logo Management) */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-400/30 text-blue-300 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">จัดการและเปลี่ยนภาพโลโก้โรงเรียน (School Logo)</h3>
                  <p className="text-xs text-slate-400">สิทธิ์เฉพาะ Admin: weerapong1625@acu.ac.th มีวงกลมสีขาวรองรับสมมาตรพอดีสวยงาม บันทึกแล้วเปลี่ยนทุกหน้า</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                {/* Logo Preview with white circular frame */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-36 h-36 rounded-full bg-white shadow-2xl border-4 border-slate-700 p-2 flex items-center justify-center overflow-hidden">
                    <img
                      src={logoPreview || currentLogoUrl}
                      alt="Logo Preview"
                      className="w-full h-full object-contain rounded-full"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-2">พรีวิวโลโก้พร้อมวงกลมขาวสมมาตร</span>
                </div>

                {/* Upload & Save Controls */}
                <div className="flex-grow space-y-4 w-full">
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />

                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                    <h4 className="text-xs font-semibold text-slate-300 mb-1">เลือกภาพโลโก้โรงเรียนใหม่</h4>
                    <p className="text-xs text-slate-400 mb-3">
                      ระบบจะบีบอัดและจัดวางบนพื้นหลังวงกลมสีขาวให้ได้สัดส่วนสมมาตรโดยอัตโนมัติ เพื่อให้แสดงผลคมชัดทุกหน้าจอ
                    </p>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>เลือกไฟล์รูปภาพโลโก้...</span>
                      </button>

                      {logoPreview && (
                        <button
                          type="button"
                          onClick={handleSaveLogo}
                          disabled={isSavingLogo}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          <span>{isSavingLogo ? 'กำลังบันทึก...' : 'บันทึกภาพโลโก้ใหม่ลงระบบ'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleResetLogo}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>รีเซ็ตกลับเป็นโลโก้เดิม</span>
                      </button>
                    </div>

                    {logoStatusMsg && (
                      <div className="mt-3 px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2 border border-emerald-500/30">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>{logoStatusMsg}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: เปลี่ยนภาพเกณฑ์และประเภทสื่อ (Criteria Infographic) */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-400/30 text-purple-300 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">จัดการภาพเกณฑ์และประเภทสื่อการสอน (Criteria Poster)</h3>
                  <p className="text-xs text-slate-400">อัปโหลดภาพโปสเตอร์หรืออินโฟกราฟิกแสดงเกณฑ์ประเภทสื่อ เพื่อให้คุณครูเปิดดูจากหน้าส่งผลงานได้</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                {/* Poster Preview */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div 
                    onClick={() => setPreviewModalImg({ url: posterPreview || currentPosterUrl, title: 'ภาพเกณฑ์/ประเภทสื่อการสอน' })}
                    className="w-44 h-60 rounded-2xl bg-slate-800 shadow-xl border-2 border-slate-700 overflow-hidden cursor-pointer group relative"
                    title="คลิกเพื่อดูภาพขนาดเต็ม"
                  >
                    <img
                      src={posterPreview || currentPosterUrl}
                      alt="Criteria Poster"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <Eye className="w-6 h-6" />
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-2">คลิกเพื่อดูภาพขนาดเต็ม</span>
                </div>

                {/* Upload & Save Controls */}
                <div className="flex-grow space-y-4 w-full">
                  <input
                    ref={posterFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePosterFileChange}
                    className="hidden"
                  />

                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                    <h4 className="text-xs font-semibold text-slate-300 mb-1">เลือกภาพเกณฑ์/ประเภทสื่อใหม่</h4>
                    <p className="text-xs text-slate-400 mb-3">
                      ระบบจะปรับขนาดภาพให้อยู่ในสเกลที่พอดี และบันทึกลง Firestore ทันที
                    </p>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => posterFileInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>เลือกไฟล์โปสเตอร์/อินโฟกราฟิกใหม่...</span>
                      </button>

                      {posterPreview && (
                        <button
                          type="button"
                          onClick={handleSavePoster}
                          disabled={isSavingPoster}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          <span>{isSavingPoster ? 'กำลังบันทึก...' : 'บันทึกภาพเกณฑ์ทันที'}</span>
                        </button>
                      )}
                    </div>

                    {posterStatusMsg && (
                      <div className="mt-3 px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2 border border-emerald-500/30">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>{posterStatusMsg}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: จัดการภาพป๊อปอัปประชาสัมพันธ์หน้าแรก (2 รูป) */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-400/30 text-amber-300 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">จัดการภาพป๊อปอัปประชาสัมพันธ์หน้าแรก (Popup Banners 2 รูป)</h3>
                  <p className="text-xs text-slate-400">
                    กำหนดและเปลี่ยนภาพป๊อปอัปที่เด้งขึ้นมาในหน้าแรกเมื่อผู้ใช้เปิดเว็บไซต์ แยกเป็น 2 รูป พร้อมเปิด/ปิดการแสดงผลได้
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Banner 1 */}
                <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[11px] font-bold">1</span>
                      <span>ภาพป๊อปอัปที่ 1 (ประชาสัมพันธ์ทั่วไป)</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-medium">
                      {banner1Preview ? 'เลือกภาพใหม่แล้ว' : 'ภาพปัจจุบัน'}
                    </span>
                  </div>

                  {/* Preview Banner 1 */}
                  <div
                    onClick={() => {
                      const img = banner1Preview || bannerConfig.bannerImageUrl || DEFAULT_BANNER_IMAGE;
                      setPreviewModalImg({ url: img, title: banner1Title || 'ภาพป๊อปอัปที่ 1' });
                    }}
                    className="w-full h-44 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer group relative"
                  >
                    <img
                      src={banner1Preview || bannerConfig.bannerImageUrl || DEFAULT_BANNER_IMAGE}
                      alt="Banner 1 Preview"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <Eye className="w-5 h-5" />
                    </div>
                  </div>

                  <input
                    ref={banner1FileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBanner1FileChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => banner1FileInputRef.current?.click()}
                    className="w-full py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>เปลี่ยนภาพป๊อปอัปที่ 1</span>
                  </button>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ข้อความหัวข้อภาพที่ 1</label>
                    <input
                      type="text"
                      value={banner1Title}
                      onChange={(e) => setBanner1Title(e.target.value)}
                      placeholder="เช่น ประกาศ/ภาพประชาสัมพันธ์ 1"
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Banner 2 */}
                <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[11px] font-bold">2</span>
                      <span>ภาพป๊อปอัปที่ 2 (พระราชดำรัสฯ ด้าน AI)</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-medium">
                      {banner2Preview ? 'เลือกภาพใหม่แล้ว' : 'ภาพปัจจุบัน'}
                    </span>
                  </div>

                  {/* Preview Banner 2 */}
                  <div
                    onClick={() => {
                      const img = banner2Preview || bannerConfig.bannerImageUrl2 || DEFAULT_BANNER_IMAGE_2;
                      setPreviewModalImg({ url: img, title: banner2Title || 'ภาพป๊อปอัปที่ 2' });
                    }}
                    className="w-full h-44 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer group relative"
                  >
                    <img
                      src={banner2Preview || bannerConfig.bannerImageUrl2 || DEFAULT_BANNER_IMAGE_2}
                      alt="Banner 2 Preview"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <Eye className="w-5 h-5" />
                    </div>
                  </div>

                  <input
                    ref={banner2FileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBanner2FileChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => banner2FileInputRef.current?.click()}
                    className="w-full py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>เปลี่ยนภาพป๊อปอัปที่ 2</span>
                  </button>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ข้อความหัวข้อภาพที่ 2</label>
                    <input
                      type="text"
                      value={banner2Title}
                      onChange={(e) => setBanner2Title(e.target.value)}
                      placeholder="เช่น ประกาศ/ภาพประชาสัมพันธ์ 2 (พระราชดำรัสฯ ด้าน AI)"
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Banner Actions */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleSaveBanners}
                  disabled={isSavingBanner}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-950/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingBanner ? 'กำลังบันทึกป๊อปอัป...' : 'บันทึกการตั้งค่าภาพป๊อปอัปทั้ง 2 รูป'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetBanners}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>รีเซ็ตกลับเป็นค่าเริ่มต้น</span>
                </button>

                {bannerStatusMsg && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs flex items-center gap-1.5 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{bannerStatusMsg}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 4: ลิงก์เชื่อมโยง Google Sheets (Google Sheets Integration Config) */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">ตั้งค่าและเชื่อมโยง Google Sheets (เปรดชีต)</h3>
                  <p className="text-xs text-slate-400">กำหนดหรือบันทึกลิงก์ Google Spreadsheet กลางของโรงเรียน เพื่อให้ผู้ดูแลระบบเปิดใช้งานและซิงค์ข้อมูลได้ตลอดเวลา</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    URL ของ Google Spreadsheet (เปรดชีต)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={googleSheetsUrl}
                      onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="flex-grow px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveSheetUrl}
                      disabled={isSavingSheetUrl}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingSheetUrl ? 'กำลังบันทึก...' : 'บันทึกลิงก์'}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(googleSheetsUrl || DEFAULT_NEW_SHEET_URL, '_blank')}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>เปิดชีต</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {sheetUrlMsg && (
                  <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{sheetUrlMsg}</span>
                  </div>
                )}

                <div className="pt-2 flex items-center gap-2 flex-wrap text-xs text-slate-400">
                  <span>ตัวเลือกลัด:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleSheetsUrl(DEFAULT_NEW_SHEET_URL);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 text-[11px] underline cursor-pointer"
                  >
                    ตั้งเป็นสร้างสเปรดชีตใหม่เสมอ (sheets.new)
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Image Preview Modal */}
      {previewModalImg && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewModalImg(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl p-4 shadow-2xl flex flex-col items-center overflow-hidden text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-3 px-2">
              <span className="text-sm font-semibold truncate max-w-md">{previewModalImg.title}</span>
              <button
                type="button"
                onClick={() => setPreviewModalImg(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-grow overflow-auto max-h-[70vh] flex items-center justify-center p-2">
              <img
                src={previewModalImg.url}
                alt={previewModalImg.title}
                className="max-w-full max-h-[68vh] object-contain rounded-xl shadow-lg"
              />
            </div>

            <div className="w-full pt-3 mt-2 border-t border-slate-800 flex items-center justify-end gap-2 px-2">
              <a
                href={previewModalImg.url}
                download="ACU_Media_Attachment.png"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลดรูปภาพ</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewModalImg(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Edit Innovation Modal
         ========================================================================= */}
      {editingInnovation && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setEditingInnovation(null)}
        >
          <div
            className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-white space-y-4 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">แก้ไขข้อมูลสื่อ / นวัตกรรมการเรียนรู้</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingInnovation(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">ชื่อสื่อ / นวัตกรรม</label>
                <input
                  type="text"
                  value={editingInnovation.mediaTitle}
                  onChange={(e) => setEditingInnovation({ ...editingInnovation, mediaTitle: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ชิ้นที่ (1 - 5)</label>
                  <select
                    value={editingInnovation.itemNumber}
                    onChange={(e) => setEditingInnovation({ ...editingInnovation, itemNumber: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>ชิ้นที่ {n}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ระดับชั้น</label>
                  <select
                    value={editingInnovation.gradeLevel}
                    onChange={(e) => setEditingInnovation({ ...editingInnovation, gradeLevel: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                  >
                    {GRADE_LEVELS.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ประเภทสื่อ</label>
                  <select
                    value={editingInnovation.mediaType}
                    onChange={(e) => setEditingInnovation({ ...editingInnovation, mediaType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                  >
                    <option value="สื่อสิ่งพิมพ์">สื่อสิ่งพิมพ์</option>
                    <option value="สื่อเทคโนโลยี">สื่อเทคโนโลยี</option>
                    <option value="สื่ออื่น ๆ">สื่ออื่น ๆ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">รูปแบบการจัดทำ</label>
                  <select
                    value={editingInnovation.productionType}
                    onChange={(e) => setEditingInnovation({ ...editingInnovation, productionType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                  >
                    <option value="ครูผลิตเอง">ครูผลิตเอง</option>
                    <option value="นำสื่อจากแหล่งอื่นมาใช้">นำสื่อจากแหล่งอื่นมาใช้</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">การนำไปใช้ / รายวิชา / รายละเอียด</label>
                <textarea
                  rows={2}
                  value={editingInnovation.usageDetails}
                  onChange={(e) => setEditingInnovation({ ...editingInnovation, usageDetails: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">ลิงก์สื่อออนไลน์ (URL)</label>
                <input
                  type="url"
                  value={editingInnovation.onlineUrl || ''}
                  onChange={(e) => setEditingInnovation({ ...editingInnovation, onlineUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">ลิงก์ภาพปกชิ้นงาน (Cover Image URL)</label>
                <input
                  type="url"
                  value={editingInnovation.coverImageUrl || ''}
                  onChange={(e) => setEditingInnovation({ ...editingInnovation, coverImageUrl: e.target.value })}
                  placeholder="https://... หรือ Data URL"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingInnovation(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveInnovationEdit}
                disabled={isSavingInnovationEdit}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingInnovationEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Delete Innovation Confirmation Modal
         ========================================================================= */}
      {deletingInnovationId && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            setDeletingInnovationId(null);
            setDeletingInnovationTitle('');
          }}
        >
          <div
            className="relative w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl p-6 shadow-2xl text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">ยืนยันการลบสื่อ / นวัตกรรม</h3>
                <p className="text-xs text-slate-400">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
              ต้องการลบสื่อ: <span className="font-semibold text-rose-300">{deletingInnovationTitle}</span> ใช่หรือไม่?
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setDeletingInnovationId(null);
                  setDeletingInnovationTitle('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteInnovation}
                disabled={isDeletingInnovation}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingInnovation ? 'กำลังลบ...' : 'ยืนยันลบสื่อ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Edit Facility Modal
         ========================================================================= */}
      {editingFacility && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setEditingFacility(null)}
        >
          <div
            className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-white space-y-4 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">แก้ไขบันทึกการใช้แหล่งเรียนรู้</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingFacility(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ชื่อครูผู้สอน</label>
                  <input
                    type="text"
                    value={editingFacility.teacherName}
                    onChange={(e) => setEditingFacility({ ...editingFacility, teacherName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">กลุ่มสาระการเรียนรู้</label>
                  <input
                    type="text"
                    value={editingFacility.subjectGroup}
                    onChange={(e) => setEditingFacility({ ...editingFacility, subjectGroup: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">แหล่งเรียนรู้ / ห้อง</label>
                <input
                  type="text"
                  value={editingFacility.learningCenter}
                  onChange={(e) => setEditingFacility({ ...editingFacility, learningCenter: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">วันเวลาที่ใช้งาน</label>
                <input
                  type="text"
                  value={editingFacility.usageDateTime || ''}
                  onChange={(e) => setEditingFacility({ ...editingFacility, usageDateTime: e.target.value })}
                  placeholder="เช่น 15 มีนาคม 2569 เวลา 09:00 น."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">ข้อเสนอแนะ / ผลลัพธ์</label>
                <textarea
                  rows={3}
                  value={editingFacility.feedback || ''}
                  onChange={(e) => setEditingFacility({ ...editingFacility, feedback: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingFacility(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveFacilityEdit}
                disabled={isSavingFacilityEdit}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingFacilityEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Delete Facility Confirmation Modal
         ========================================================================= */}
      {deletingFacilityId && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            setDeletingFacilityId(null);
            setDeletingFacilityTitle('');
          }}
        >
          <div
            className="relative w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl p-6 shadow-2xl text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">ยืนยันการลบบันทึกแหล่งเรียนรู้</h3>
                <p className="text-xs text-slate-400">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
              ต้องการลบบันทึก: <span className="font-semibold text-rose-300">{deletingFacilityTitle}</span> ใช่หรือไม่?
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setDeletingFacilityId(null);
                  setDeletingFacilityTitle('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteFacility}
                disabled={isDeletingFacility}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingFacility ? 'กำลังลบ...' : 'ยืนยันลบบันทึก'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
