import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  CheckCircle2, 
  FileSpreadsheet, 
  Clock, 
  Upload, 
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
  AlertCircle
} from 'lucide-react';
import { 
  GRADE_LEVELS, 
  MEDIA_ITEM_NUMBERS, 
  INNOVATION_MEDIA_TYPES, 
  PRODUCTION_TYPES, 
  InnovationSubmission,
  saveInnovationSubmission, 
  updateInnovationSubmission,
  deleteInnovationSubmission,
  subscribeUserInnovations,
  subscribeAllInnovations,
  exportInnovationsToGoogleSheetsCSV,
  ADMIN_TARGET_EMAIL,
  canUserModify
} from '../services/submissionService';

interface TeacherInnovationSubmissionModalProps {
  userEmail: string;
  defaultTeacherName?: string;
  onClose: () => void;
}

export const TeacherInnovationSubmissionModal: React.FC<TeacherInnovationSubmissionModalProps> = ({
  userEmail,
  defaultTeacherName = '',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'form' | 'status' | 'sheets'>('form');

  // Form states matching exact questionnaire
  const [teacherName, setTeacherName] = useState(defaultTeacherName);
  const [gradeLevel, setGradeLevel] = useState<string>(GRADE_LEVELS[0]);
  const [itemNumber, setItemNumber] = useState<number>(1);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaType, setMediaType] = useState<string>(INNOVATION_MEDIA_TYPES[0]);
  const [productionType, setProductionType] = useState<string>(PRODUCTION_TYPES[0]);
  const [usageDetails, setUsageDetails] = useState('');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Status & List states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  const [userSubmissions, setUserSubmissions] = useState<InnovationSubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<InnovationSubmission[]>([]);
  const [copyNotice, setCopyNotice] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Admin permission check
  const isAdmin = userEmail.trim().toLowerCase() === ADMIN_TARGET_EMAIL.toLowerCase();
  const [showAllUsersForAdmin, setShowAllUsersForAdmin] = useState(isAdmin);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to real-time submissions
  useEffect(() => {
    const unsubUser = subscribeUserInnovations(userEmail, (list) => {
      setUserSubmissions(list);
    });
    const unsubAll = subscribeAllInnovations((list) => {
      setAllSubmissions(list);
    });
    return () => {
      unsubUser();
      unsubAll();
    };
  }, [userEmail]);

  // Handle image upload & compression
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 900;
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
          setImagePreview(canvas.toDataURL('image/jpeg', 0.8));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    setIsSubmitting(true);

    if (editingId) {
      // Perform Update
      const res = await updateInnovationSubmission(
        editingId,
        {
          teacherName: teacherName.trim(),
          gradeLevel,
          itemNumber,
          mediaTitle: mediaTitle.trim(),
          mediaType,
          productionType,
          usageDetails: usageDetails.trim(),
          onlineUrl: onlineUrl.trim(),
          imageUrl: imagePreview || undefined,
        },
        userEmail
      );

      setIsSubmitting(false);

      if (res.success) {
        setActionNotice(`บันทึกการแก้ไขสื่อชิ้นที่ ${itemNumber} เรียบร้อยแล้ว`);
        setEditingId(null);
        setMediaTitle('');
        setUsageDetails('');
        setOnlineUrl('');
        setImagePreview(null);
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
      gradeLevel,
      itemNumber,
      mediaTitle: mediaTitle.trim(),
      mediaType,
      productionType,
      usageDetails: usageDetails.trim(),
      onlineUrl: onlineUrl.trim(),
      imageUrl: imagePreview || undefined,
      userEmail,
    });

    setIsSubmitting(false);

    if (res.success) {
      setSubmittedId(res.id);
      setSubmitSuccess(true);
      // Reset some fields for next submission
      setMediaTitle('');
      setUsageDetails('');
      setOnlineUrl('');
      setImagePreview(null);
      if (itemNumber < 5) {
        setItemNumber((prev) => prev + 1);
      }
    } else {
      alert(res.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleStartEdit = (sub: InnovationSubmission) => {
    setEditingId(sub.id);
    setTeacherName(sub.teacherName);
    setGradeLevel(sub.gradeLevel);
    setItemNumber(sub.itemNumber);
    setMediaTitle(sub.mediaTitle);
    setMediaType(sub.mediaType);
    setProductionType(sub.productionType);
    setUsageDetails(sub.usageDetails);
    setOnlineUrl(sub.onlineUrl || '');
    setImagePreview(sub.imageUrl || null);
    setActiveTab('form');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setMediaTitle('');
    setUsageDetails('');
    setOnlineUrl('');
    setImagePreview(null);
  };

  const handleDeleteSubmission = async (sub: InnovationSubmission) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลสื่อ "${sub.mediaTitle}" (ชิ้นที่ ${sub.itemNumber})?`)) {
      return;
    }
    const res = await deleteInnovationSubmission(sub.id, userEmail);
    if (res.success) {
      setActionNotice(`ลบสื่อชิ้นที่ ${sub.itemNumber} เรียบร้อยแล้ว`);
      setTimeout(() => setActionNotice(null), 3000);
    } else {
      alert(res.error || 'ไม่สามารถลบข้อมูลได้');
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
      'ลำดับ\tรหัสการส่ง\tวันเวลา\tอีเมลผู้ส่ง\tชื่อ-สกุล\tระดับชั้น\tสื่อชิ้นที่\tชื่อสื่อ/นวัตกรรม\tประเภท\tการจัดทำ\tการนำไปใช้\tURL\tสถานะ'
    ];
    const rows = dataToExport.map((sub, idx) => {
      return [
        idx + 1,
        sub.id,
        new Date(sub.submittedAt).toLocaleString('th-TH'),
        sub.userEmail,
        sub.teacherName,
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
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
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
            <span>เช็คสถานะการส่ง ({userSubmissions.length} รายการ)</span>
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
                <div className="mb-6 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-emerald-300">
                      บันทึกข้อมูลสื่อชิ้นที่ {itemNumber === 1 ? 5 : itemNumber - 1} ลงฐานข้อมูลสำเร็จ!
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      ข้อมูลถูกจัดเก็บในฐานข้อมูล Firebase Project <span className="font-semibold text-white">"System Test"</span> เรียบร้อยแล้ว พร้อมส่งต่อไปยังคลังสื่อคุณครูผลิตเอง และเชื่อมโยงไปยังอีเมล <span className="text-emerald-300">{ADMIN_TARGET_EMAIL}</span>
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSubmitSuccess(false)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                      >
                        ส่งสื่อชิ้นถัดไป (ชิ้นที่ {itemNumber})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('status')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                      >
                        ดูสถานะการส่งทั้งหมด
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                    placeholder="เช่น ม.วีระพงศ์ คำสอน / มิสกานดา รุ่งเรือง"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-white placeholder-slate-500 outline-none"
                  />
                </div>

                {/* 2. ระบุระดับชั้นของครูผู้สอน */}
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

                {/* 9. ภาพปกชิ้นงาน (Cover Image) */}
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <label className="block text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-blue-400" />
                        <span>ภาพปกชิ้นงาน (Cover Image)</span>
                      </label>
                      <p className="text-[11px] text-slate-400">
                        ภาพนี้จะนำไปแสดงเป็นภาพปกในหน้า "คลังสื่อคุณครูผลิตเอง" หน้าโปรไฟล์ และหน้าแสดงสื่อทั้งหมด
                      </p>
                    </div>
                    {imagePreview && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        มีภาพปกแล้ว
                      </span>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />

                  {imagePreview ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="relative rounded-2xl overflow-hidden border-2 border-blue-500/60 shadow-lg group w-44 h-28 bg-slate-900 flex-shrink-0">
                        <img
                          src={imagePreview}
                          alt="Cover Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setImagePreview(null)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center transition-colors shadow-md"
                          title="ลบภาพปก"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                        >
                          <Upload className="w-3.5 h-3.5 text-blue-400" />
                          <span>เปลี่ยนรูปภาพปกใหม่</span>
                        </button>
                        <p className="text-[10px] text-slate-400">
                          ระบบจะปรับสเกลขนาดและจัดเก็บเป็นภาพปกผลงานใน Firestore อัตโนมัติ
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-5 py-4 rounded-xl border border-dashed border-slate-600 hover:border-blue-400 bg-slate-900/40 hover:bg-slate-800/60 text-xs sm:text-sm text-slate-300 flex flex-col sm:flex-row items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Upload className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <span>คลิกเพื่ออัปโหลดภาพปกชิ้นงาน (JPG, PNG)...</span>
                    </button>
                  )}
                </div>

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
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>
                      {isAdmin && showAllUsersForAdmin
                        ? 'สถานะการส่งสื่อของคุณครูทุกคน (สิทธิ์ Admin)'
                        : `สถานะการส่งสื่อของอีเมล: ${userEmail}`}
                    </span>
                    {isAdmin && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                        Admin Mode
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400">
                    ส่งแล้วทั้งหมด {(isAdmin && showAllUsersForAdmin ? allSubmissions : userSubmissions).length} รายการ
                    {!(isAdmin && showAllUsersForAdmin) && ' (เป้าหมาย 5 ชิ้น)'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowAllUsersForAdmin(!showAllUsersForAdmin)}
                      className="text-xs px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-amber-300 border border-amber-500/40 font-semibold transition-colors"
                    >
                      {showAllUsersForAdmin ? 'แสดงเฉพาะของฉัน' : 'แสดงของทุกคน (Admin)'}
                    </button>
                  )}
                  {!(isAdmin && showAllUsersForAdmin) && (
                    <span className="text-xs px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      {userSubmissions.length >= 5 ? 'ครบ 5 ชิ้นแล้ว' : `ขาดอีก ${5 - userSubmissions.length} ชิ้น`}
                    </span>
                  )}
                </div>
              </div>

              {((isAdmin && showAllUsersForAdmin ? allSubmissions : userSubmissions).length === 0) ? (
                <div className="py-12 text-center text-slate-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                  <p className="text-sm">ยังไม่พบรายการส่งสื่อ (เริ่มต้น 0 รายการ)</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setActiveTab('form');
                    }}
                    className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs text-white font-semibold transition-colors"
                  >
                    ส่งสื่อชิ้นที่ 1 ตอนนี้
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {(isAdmin && showAllUsersForAdmin ? allSubmissions : userSubmissions).map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-blue-500/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {sub.imageUrl ? (
                          <img
                            src={sub.imageUrl}
                            alt={sub.mediaTitle}
                            className="w-16 h-16 rounded-xl object-cover border border-slate-600 flex-shrink-0"
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
                            <span className="text-xs text-slate-400">{sub.gradeLevel}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {sub.status}
                            </span>
                            {isAdmin && sub.userEmail !== userEmail && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30">
                                ครู: {sub.userEmail}
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
                            <span>การจัดทำ: {sub.productionType}</span>
                            <span>ครูผู้สอน: <strong>{sub.teacherName}</strong></span>
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
                            className="px-2.5 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-xs text-blue-300 flex items-center gap-1 transition-colors"
                            title="เปิดดูสื่อออนไลน์"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">เปิดดู</span>
                          </a>
                        )}

                        {canUserModify(sub.userEmail, userEmail) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(sub)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs flex items-center gap-1 transition-colors font-medium"
                              title="แก้ไขข้อมูลสื่อ"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>แก้ไข</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(sub)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs flex items-center gap-1 transition-colors font-medium"
                              title="ลบข้อมูลสื่อ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>ลบ</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GOOGLE SHEETS SUMMARY */}
          {activeTab === 'sheets' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    ปุ่มสรุปข้อมูล Google Sheets (เชื่อมต่ออีเมล: {ADMIN_TARGET_EMAIL})
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    ข้อมูลทั้งหมดถูกจัดเก็บในฐานข้อมูล Firebase Project <strong className="text-white">"System Test"</strong> สามารถสรุปผล ส่งต่อ หรือเปิดใน Google Sheets ได้ทันที
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
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
                      {(allSubmissions.length > 0 ? allSubmissions : userSubmissions).map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-800/50">
                          <td className="p-3 text-slate-500">{idx + 1}</td>
                          <td className="p-3 font-bold text-blue-300">{item.itemNumber}</td>
                          <td className="p-3 text-white font-medium">{item.teacherName}</td>
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
          )}

        </div>
      </div>
    </div>
  );
};
