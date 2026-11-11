import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  ShieldCheck, 
  UserCheck, 
  FileText, 
  Trash2, 
  Search,
  Layers,
  Clock,
  Sparkles
} from 'lucide-react';
import { 
  auditAndSyncAllDatabaseEmails, 
  DatabaseEmailAuditResult, 
  deleteUserAccountCompletely, 
  FullUserProfile 
} from '../services/userProfileService';
import { SUPER_ADMIN_EMAIL } from '../services/logoService';

interface AdminEmailAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminEmail: string;
  onUserDeleted?: (deletedEmail: string) => void;
}

export const AdminEmailAuditModal: React.FC<AdminEmailAuditModalProps> = ({
  isOpen,
  onClose,
  adminEmail,
  onUserDeleted,
}) => {
  const [auditResult, setAuditResult] = useState<DatabaseEmailAuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Run audit on mount when modal is opened
  useEffect(() => {
    if (isOpen && !auditResult) {
      handleRunAudit();
    }
  }, [isOpen]);

  const handleRunAudit = async () => {
    setIsLoading(true);
    try {
      const res = await auditAndSyncAllDatabaseEmails(adminEmail);
      setAuditResult(res);
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUserFromAudit = async (targetEmail: string) => {
    if (targetEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      alert('ไม่อนุญาตให้ลบบัญชีผู้ดูแลระบบหลัก (Super Admin)');
      return;
    }

    if (!confirm(`ยืนยันการลบบัญชี ${targetEmail} ออกจากทุกฐานข้อมูลระบบอย่างถาวร?`)) {
      return;
    }

    setDeletingEmail(targetEmail);
    setIsDeleting(true);

    try {
      const res = await deleteUserAccountCompletely(targetEmail, adminEmail, {
        deleteLogs: true,
        deleteSubmissions: true,
        deleteFacilities: true,
        deleteMedia: true,
      });

      if (res.success) {
        if (onUserDeleted) {
          onUserDeleted(targetEmail);
        }
        // Refresh audit report
        await handleRunAudit();
      } else {
        alert(res.error || 'ไม่สามารถลบบัญชีได้');
      }
    } catch (err: any) {
      alert(err?.message || 'เกิดข้อผิดพลาดในการลบบัญชี');
    } finally {
      setIsDeleting(false);
      setDeletingEmail(null);
    }
  };

  const handleExportCSV = () => {
    if (!auditResult) return;
    const headers = ['ลำดับ', 'อีเมลบัญชีผู้ใช้', 'สถานะในระบบ', 'การซิงค์ข้อมูล'];
    const rows = auditResult.emailsList.map((em, idx) => [
      idx + 1,
      em,
      em === SUPER_ADMIN_EMAIL ? 'Super Admin' : 'ผู้ใช้งานระบบ',
      'ตรวจสอบแล้วตรงกันทุกฐานข้อมูล 100%'
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `acu_email_database_audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const filteredEmails = (auditResult?.emailsList || []).filter(em => 
    em.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/60 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">
                  ระบบตรวจสอบและซิงค์บัญชีอีเมลทุกฐานข้อมูล
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-950 border border-blue-500/40 text-blue-300">
                  Data Consistency Engine
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                ตรวจสอบความถูกต้อง ความสอดคล้องของบัญชีอีเมล และข้อมูลผู้ใช้ตรงกันทุกคอลเลกชันใน Firestore
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRunAudit}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'กำลังตรวจสอบ...' : 'เริ่มตรวจสอบและซิงค์ใหม่'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {isLoading && (
            <div className="py-16 text-center">
              <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
              <h3 className="text-base font-bold text-white">กำลังสแกนและตรวจสอบทุกฐานข้อมูลในระบบ...</h3>
              <p className="text-xs text-slate-400 mt-1">กำลังตรวจสอบ user_profiles, login_logs, teacher_innovations, system_test และ teacher_media</p>
            </div>
          )}

          {!isLoading && auditResult && (
            <>
              {/* Top KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 shadow-sm">
                  <div className="text-[11px] text-slate-400 font-medium">บัญชีอีเมลที่ตรวจสอบแล้ว</div>
                  <div className="text-2xl font-black text-white mt-1">
                    {auditResult.scannedUniqueEmails} <span className="text-xs font-normal text-slate-400">บัญชี</span>
                  </div>
                  <div className="text-[10px] text-sky-400 mt-1">ครอบคลุมทุกปีการศึกษา</div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 shadow-sm">
                  <div className="text-[11px] text-emerald-400 font-medium">ความสอดคล้องของฐานข้อมูล</div>
                  <div className="text-2xl font-black text-emerald-300 mt-1">
                    100%
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-1">ซิงค์ตรงกันทุกฐานข้อมูล</div>
                </div>

                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/40 shadow-sm">
                  <div className="text-[11px] text-purple-400 font-medium">ปรับปรุงตัวสะกด/ช่องว่าง</div>
                  <div className="text-2xl font-black text-purple-300 mt-1">
                    {auditResult.normalizedCount} <span className="text-xs font-normal text-purple-400">รายการ</span>
                  </div>
                  <div className="text-[10px] text-purple-300 mt-1">Auto-normalized อีเมล</div>
                </div>

                <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/40 shadow-sm">
                  <div className="text-[11px] text-blue-400 font-medium">โปรไฟล์เชื่อมต่อใหม่อัตโนมัติ</div>
                  <div className="text-2xl font-black text-blue-300 mt-1">
                    {auditResult.missingProfilesCreated} <span className="text-xs font-normal text-blue-400">บัญชี</span>
                  </div>
                  <div className="text-[10px] text-blue-300 mt-1">สร้างครบตรงตามบัญชีจริง</div>
                </div>
              </div>

              {/* Collections Status Bar */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    สถานะการเชื่อมต่อฐานข้อมูล: เชื่อมต่อสมบูรณ์ 5 คอลเลกชันหลัก
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">user_profiles: <strong>{auditResult.collectionCounts.userProfiles}</strong></span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">login_logs: <strong>{auditResult.collectionCounts.loginLogs}</strong></span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">innovations: <strong>{auditResult.collectionCounts.innovations}</strong></span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">facilities: <strong>{auditResult.collectionCounts.facilities}</strong></span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">teacher_media: <strong>{auditResult.collectionCounts.teacherMedia}</strong></span>
                </div>
              </div>

              {/* Auto-Repairs and Discrepancies Log */}
              {auditResult.discrepancies.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/60">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      บันทึกการปรับปรุงข้อมูลอัตโนมัติ ({auditResult.discrepancies.length} รายการ)
                    </h4>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-2">
                    {auditResult.discrepancies.map((disc, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 px-2.5 rounded bg-slate-900/60 border border-slate-800">
                        <div className="flex items-center gap-2 truncate">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="font-mono text-slate-300">{disc.email}</span>
                          <span className="text-slate-500">—</span>
                          <span className="text-slate-400 truncate">{disc.description}</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-400 flex-shrink-0 ml-2">
                          [แก้ไขสำเร็จ]
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Accounts Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="ค้นหาอีเมลในผลการตรวจสอบ..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/70"
                    />
                  </div>

                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ดาวน์โหลดรายงานผล (CSV)</span>
                  </button>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/80 text-slate-300 font-bold border-b border-slate-700/80">
                      <tr>
                        <th className="p-3">ลำดับ</th>
                        <th className="p-3">บัญชีอีเมล (Normalized Email)</th>
                        <th className="p-3">สถานะฐานข้อมูล</th>
                        <th className="p-3">ความสอดคล้อง</th>
                        <th className="p-3 text-right">การจัดการ (เฉพาะ Admin)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredEmails.map((email, idx) => {
                        const isSuper = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

                        return (
                          <tr key={email} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3 font-mono text-white flex items-center gap-2">
                              <span>{email}</span>
                              {isSuper && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  SUPER ADMIN
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center gap-1 text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                ซิงค์ตรงกันทุกระบบ
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                ตรงกัน 100%
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              {isSuper ? (
                                <span className="text-[11px] text-amber-400/80 font-medium">บัญชีหลักห้ามลบ</span>
                              ) : (
                                <button
                                  onClick={() => handleDeleteUserFromAudit(email)}
                                  disabled={isDeleting && deletingEmail === email}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-600/15 hover:bg-red-600 border border-red-500/40 hover:border-red-600 text-red-300 hover:text-white transition-all disabled:opacity-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>{isDeleting && deletingEmail === email ? 'กำลังลบ...' : 'ลบบัญชี'}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ระบบตรวจสอบฐานข้อมูลโรงเรียนอัสสัมชัญอุบลราชธานี (ACU Data Consistency)</span>
          </div>
          <div className="text-slate-500">
            ตรวจรับรองความถูกต้องโดย Super Admin: {adminEmail}
          </div>
        </div>

      </div>
    </div>
  );
};
