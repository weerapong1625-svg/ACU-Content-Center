import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet, 
  Calendar, 
  Building, 
  User, 
  BookOpen, 
  Image as ImageIcon, 
  Download, 
  Copy, 
  ExternalLink, 
  Sparkles, 
  Check, 
  AlertCircle,
  Filter,
  Mail,
  Database
} from 'lucide-react';
import { 
  SUBJECT_GROUPS, 
  LEARNING_CENTERS, 
  PERIODS_LIST, 
  FacilitySubmission, 
  saveFacilitySubmission, 
  subscribeUserSubmissions, 
  subscribeAllSubmissions, 
  exportToGoogleSheetsCSV,
  ADMIN_TARGET_EMAIL
} from '../services/submissionService';

interface FacilityUsageSubmissionModalProps {
  userEmail: string;
  defaultTeacherName?: string;
  defaultSubjectGroup?: string;
  onClose: () => void;
}

/**
 * 4. บันทึกแหล่งการเรียนรู้ภายในโรงเรียนอัสสัมชัญอุบลราชธานี
 * 33 แหล่งเรียนรู้, 9 กลุ่มสาระ, 9 คาบเรียน, วันเวลา, ความคิดเห็น, แนบรูปภาพ
 * เช็คสถานะผ่านอีเมล เชื่อมโยง Firebase System Test และสรุป Google Sheets ถึง weerapong1625@acu.ac.th
 */
export const FacilityUsageSubmissionModal: React.FC<FacilityUsageSubmissionModalProps> = ({
  userEmail,
  defaultTeacherName = '',
  defaultSubjectGroup = '',
  onClose,
}) => {
  // Tabs: 'form' | 'status' | 'sheets'
  const [activeTab, setActiveTab] = useState<'form' | 'status' | 'sheets'>('form');

  // Form Fields as specified by user
  const [teacherName, setTeacherName] = useState(defaultTeacherName);
  const [subjectGroup, setSubjectGroup] = useState<string>(defaultSubjectGroup || SUBJECT_GROUPS[1]);
  const [learningCenter, setLearningCenter] = useState<string>(LEARNING_CENTERS[0]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(['คาบเรียนที่ 1']);
  const [usageDateTime, setUsageDateTime] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [feedback, setFeedback] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Status & Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Submissions lists (Real-time from Firestore Project: System Test)
  const [userSubmissions, setUserSubmissions] = useState<FacilitySubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<FacilitySubmission[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync user submissions in real-time
  useEffect(() => {
    const unsub = subscribeUserSubmissions(userEmail, (data) => {
      setUserSubmissions(data);
    });
    return () => unsub();
  }, [userEmail]);

  // Sync all submissions for Google Sheets export
  useEffect(() => {
    const unsub = subscribeAllSubmissions((data) => {
      setAllSubmissions(data);
    });
    return () => unsub();
  }, []);

  // Handle Period Checkbox Toggle (ผู้ตอบจะเลือกเท่าไรก็ได้)
  const togglePeriod = (period: string) => {
    setSelectedPeriods((prev) => {
      if (prev.includes(period)) {
        return prev.filter((p) => p !== period);
      } else {
        return [...prev, period].sort();
      }
    });
  };

  // Handle Image Upload with Canvas Optimization
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์ภาพถ่าย (JPG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
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
          setImagePreview(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teacherName.trim()) {
      alert('กรุณากรอก ชื่อ - สกุล (ครูผู้สอน)');
      return;
    }

    if (selectedPeriods.length === 0) {
      alert('กรุณาเลือกคาบการเรียนการสอนอย่างน้อย 1 คาบ');
      return;
    }

    setIsSubmitting(true);
    setSubmitSuccessMsg(null);

    const result = await saveFacilitySubmission({
      teacherName: teacherName.trim(),
      subjectGroup,
      learningCenter,
      periods: selectedPeriods,
      usageDateTime,
      feedback: feedback.trim(),
      imageUrl: imagePreview || undefined,
      userEmail,
    });

    setIsSubmitting(false);

    if (result.success) {
      setSubmitSuccessMsg(`บันทึกข้อมูลการใช้ ${learningCenter} ลงระบบเรียบร้อยแล้ว (รหัส: ${result.id})`);
      setFeedback('');
      setImagePreview(null);
      setTimeout(() => {
        setActiveTab('status');
      }, 1500);
    } else {
      alert(result.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleDownloadCSV = () => {
    const list = allSubmissions.length > 0 ? allSubmissions : userSubmissions;
    const csvData = exportToGoogleSheetsCSV(list);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ACU_Facility_Usage_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyForSheets = () => {
    const list = allSubmissions.length > 0 ? allSubmissions : userSubmissions;
    const headers = [
      'ลำดับ\tรหัสบันทึก\tวันเวลาส่ง\tอีเมลผู้ส่ง\tชื่อ-สกุล\tกลุ่มสาระ\tแหล่งเรียนรู้\tคาบเรียน\tวันเวลาเข้าใช้\tข้อเสนอแนะ\tสถานะ'
    ];
    const rows = list.map((item, idx) => {
      return [
        idx + 1,
        item.id,
        new Date(item.createdAt).toLocaleString('th-TH'),
        item.userEmail,
        item.teacherName,
        item.subjectGroup,
        item.learningCenter,
        item.periods.join(', '),
        item.usageDateTime.replace('T', ' '),
        item.feedback || '-',
        item.status,
      ].join('\t');
    });

    const fullTsv = [...headers, ...rows].join('\n');
    navigator.clipboard.writeText(fullTsv).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  const handleSendEmailNotification = () => {
    const subject = encodeURIComponent(`[สรุปการใช้แหล่งเรียนรู้ภายใน] โรงเรียนอัสสัมชัญอุบลราชธานี`);
    const count = allSubmissions.length > 0 ? allSubmissions.length : userSubmissions.length;
    const body = encodeURIComponent(
      `เรียน ผู้ดูแลระบบ (${ADMIN_TARGET_EMAIL}),\n\nสรุปรายงานการบันทึกใช้แหล่งเรียนรู้ภายในโรงเรียนอัสสัมชัญอุบลราชธานี:\n` +
      `- จำนวนรายการที่บันทึกแล้ว: ${count} รายการ\n` +
      `- ฐานข้อมูลเชื่อมโยง: Firebase Project "System Test"\n` +
      `- ผู้ส่งข้อมูลล่าสุด: ${teacherName || userEmail}\n` +
      `- แหล่งเรียนรู้: ${learningCenter}\n` +
      `- ข้อมูลถูกเชื่อมโยงสรุปผลเรียบร้อยแล้ว\n\n` +
      `โรงเรียนอัสสัมชัญอุบลราชธานี`
    );
    window.location.href = `mailto:${ADMIN_TARGET_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <div
      id="modal-facility-usage-submission"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950/80 via-teal-900/60 to-slate-900 border-b border-emerald-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 flex-shrink-0">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                4. บันทึกแหล่งการเรียนรู้ภายในโรงเรียนอัสสัมชัญอุบลราชธานี
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-medium">
                  System Test
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                บันทึกการใช้แหล่งเรียนรู้ 33 แห่ง • เชื่อมโยง Firebase System Test และสรุป Google Sheets ถึง {ADMIN_TARGET_EMAIL}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-facility-submission-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 pt-2 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2 overflow-x-auto select-none">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'form'
                ? 'bg-slate-900 text-emerald-300 border-emerald-500'
                : 'text-slate-400 hover:text-white border-transparent'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>แบบฟอร์มบันทึกการใช้งาน</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'status'
                ? 'bg-slate-900 text-emerald-300 border-emerald-500'
                : 'text-slate-400 hover:text-white border-transparent'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>เช็คสถานะผ่านอีเมล ({userSubmissions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sheets')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'sheets'
                ? 'bg-slate-900 text-emerald-300 border-emerald-500'
                : 'text-slate-400 hover:text-white border-transparent'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>สรุปข้อมูล (Google Sheets)</span>
          </button>
        </div>

        {/* Tab 1: Form Body */}
        {activeTab === 'form' && (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-grow space-y-4 text-slate-200">
            {submitSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 flex items-center gap-2.5 text-emerald-300 text-xs sm:text-sm animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>{submitSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ชื่อ - สกุล (ครูผู้สอน) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  ชื่อ - สกุล (ครูผู้สอน) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="เช่น ม.วีระพงศ์ คำสอน / มิสกานดา รุ่งเรือง"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* ครูผู้สอนกลุ่มสาระ */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                  ครูผู้สอนกลุ่มสาระ <span className="text-rose-400">*</span>
                </label>
                <select
                  value={subjectGroup}
                  onChange={(e) => setSubjectGroup(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  {SUBJECT_GROUPS.map((group) => (
                    <option key={group} value={group} className="bg-slate-900 text-white">
                      {group}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* แหล่งเรียนรู้ (33 แหล่งเรียนรู้) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-emerald-400" />
                แหล่งเรียนรู้ <span className="text-rose-400">*</span>
              </label>
              <select
                value={learningCenter}
                onChange={(e) => setLearningCenter(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {LEARNING_CENTERS.map((room) => (
                  <option key={room} value={room} className="bg-slate-900 text-white">
                    {room}
                  </option>
                ))}
              </select>
            </div>

            {/* คาบการเรียนการสอน (ผู้ตอบจะเลือกเท่าไรก็ได้) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  คาบการเรียนการสอน <span className="text-rose-400">*</span>
                  <span className="text-[11px] text-emerald-300 font-normal">(ผู้ตอบจะเลือกเท่าไรก็ได้)</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  เลือกแล้ว: {selectedPeriods.length} คาบ
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
                {PERIODS_LIST.map((period) => {
                  const isChecked = selectedPeriods.includes(period);
                  return (
                    <button
                      type="button"
                      key={period}
                      onClick={() => togglePeriod(period)}
                      className={`px-2 py-2 rounded-xl text-xs font-medium border transition-all text-center flex flex-col items-center justify-center ${
                        isChecked
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                      }`}
                    >
                      <span className="text-[10px] opacity-75">คาบ</span>
                      <span className="font-bold text-xs">{period.replace('คาบเรียนที่ ', '')}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* วัน/เวลา ที่เข้าใช้งาน */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  วัน/เวลา ที่เข้าใช้งาน <span className="text-rose-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={usageDateTime}
                  onChange={(e) => setUsageDateTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* อีเมลผู้เข้าระบบ */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  อีเมลผู้บันทึก (ตรวจสอบผ่านระบบ)
                </label>
                <input
                  type="text"
                  disabled
                  value={userEmail}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/40 border border-slate-700/60 text-slate-400 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            {/* การตอบกลับของผู้ตอบ */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                การตอบกลับของผู้ตอบ (บันทึกสะท้อนผลการจัดกิจกรรม / ข้อเสนอแนะ)
              </label>
              <textarea
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="ระบุกิจกรรมการจัดการเรียนรู้ ผลการใช้งานสื่อ เครื่องมือ หรือความต้องการเพิ่มเติม..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* แนบรูปภาพขณะทำการใช้แหล่งเรียนรู้ */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                แนบรูปภาพขณะทำการใช้แหล่งเรียนรู้
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  เลือกรูปภาพจากอุปกรณ์
                </button>

                {imagePreview && (
                  <div className="relative inline-flex items-center gap-2 p-1.5 rounded-xl bg-slate-800 border border-slate-700">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-14 h-14 object-cover rounded-lg"
                    />
                    <div className="text-left pr-2">
                      <p className="text-[11px] font-semibold text-emerald-300">แนบรูปภาพแล้ว</p>
                      <button
                        type="button"
                        onClick={() => setImagePreview(null)}
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        ลบรูปภาพ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>บันทึกเข้า Firebase Project: "System Test"</span>
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
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{isSubmitting ? 'กำลังบันทึกลงฐานข้อมูล...' : 'บันทึกข้อมูลการใช้งาน'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Check Status via Email */}
        {activeTab === 'status' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-grow space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  ตรวจสอบสถานะการบันทึกของ: <span className="text-emerald-300">{userEmail}</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  พบข้อมูลทั้งหมด {userSubmissions.length} รายการ (อัปเดตแบบเรียลไทม์จาก System Test)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-center transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                บันทึกรายการใหม่
              </button>
            </div>

            {userSubmissions.length === 0 ? (
              <div className="text-center py-12 rounded-2xl bg-slate-950/40 border border-slate-800">
                <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h5 className="text-sm font-bold text-slate-300">ยังไม่พบข้อมูลการส่งสำหรับอีเมลนี้</h5>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  เมื่อท่านกรอกแบบฟอร์มส่งข้อมูล รายการสถานะและวันเวลาที่ส่งจะปรากฏที่นี่ทันที
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors"
                >
                  เริ่มกรอกแบบฟอร์ม
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {userSubmissions.map((sub, idx) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 hover:border-emerald-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-sm font-bold text-white">{sub.learningCenter}</h5>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                            {sub.subjectGroup}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          ครูผู้สอน: <strong>{sub.teacherName}</strong> • คาบ: {sub.periods.join(', ')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          วัน/เวลาที่เข้าใช้: {sub.usageDateTime.replace('T', ' ')} • วันที่ส่ง: {new Date(sub.createdAt).toLocaleString('th-TH')}
                        </p>
                        {sub.feedback && (
                          <p className="text-xs text-emerald-200/90 mt-1.5 italic bg-slate-900/60 p-2 rounded-lg border border-slate-700/60">
                            "{sub.feedback}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                      {sub.imageUrl && (
                        <a
                          href={sub.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          ดูรูปภาพ
                        </a>
                      )}
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {sub.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Google Sheets Summary & Real Export */}
        {activeTab === 'sheets' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-grow space-y-4">
            {/* Action Bar */}
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  สรุปข้อมูลสำหรับ Google Sheets (เชื่อมต่อ: {ADMIN_TARGET_EMAIL})
                </h4>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  รวบรวมข้อมูลทั้งหมด {allSubmissions.length} รายการ จาก Firebase Project "System Test" สามารถดาวน์โหลด CSV หรือส่งต่อได้ทันที
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลด CSV (Google Sheets)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyForSheets}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-600 flex items-center gap-1.5 transition-colors"
                >
                  {copySuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>คัดลอกแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-300" />
                      <span>คัดลอกลง Google Sheets</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSendEmailNotification}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>ส่งสรุปถึง Admin</span>
                </button>
              </div>
            </div>

            {/* Preview Table */}
            <div className="rounded-2xl border border-slate-700 bg-slate-950/80 overflow-x-auto shadow-inner">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/90 text-slate-200 border-b border-slate-700">
                  <tr>
                    <th className="p-3 font-semibold">#</th>
                    <th className="p-3 font-semibold">วันเวลาส่ง</th>
                    <th className="p-3 font-semibold">ชื่อ - สกุล (ครูผู้สอน)</th>
                    <th className="p-3 font-semibold">กลุ่มสาระ</th>
                    <th className="p-3 font-semibold">แหล่งเรียนรู้</th>
                    <th className="p-3 font-semibold">คาบเรียน</th>
                    <th className="p-3 font-semibold">วัน/เวลาเข้าใช้</th>
                    <th className="p-3 font-semibold">การตอบกลับ</th>
                    <th className="p-3 font-semibold">อีเมลผู้ส่ง</th>
                    <th className="p-3 font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(allSubmissions.length > 0 ? allSubmissions : userSubmissions).map((row, index) => (
                    <tr key={row.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="p-3 font-bold text-slate-400">{index + 1}</td>
                      <td className="p-3 whitespace-nowrap text-slate-400">
                        {new Date(row.createdAt).toLocaleDateString('th-TH')}
                      </td>
                      <td className="p-3 font-medium text-white whitespace-nowrap">{row.teacherName}</td>
                      <td className="p-3 whitespace-nowrap text-emerald-300">{row.subjectGroup}</td>
                      <td className="p-3 font-medium text-slate-200 whitespace-nowrap">{row.learningCenter}</td>
                      <td className="p-3 whitespace-nowrap text-cyan-300">{row.periods.join(', ')}</td>
                      <td className="p-3 whitespace-nowrap text-slate-400">{row.usageDateTime.replace('T', ' ')}</td>
                      <td className="p-3 max-w-[200px] truncate" title={row.feedback}>{row.feedback || '-'}</td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">{row.userEmail}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
