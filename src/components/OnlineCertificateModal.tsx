import React, { useRef } from 'react';
import { Award, Printer, X, CheckCircle2, Shield, Calendar, Download, Sparkles, School } from 'lucide-react';
import { DEFAULT_LOGO_IMAGE } from '../services/logoService';
import { getCleanRealName } from '../services/userProfileService';

interface OnlineCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  recipientEmail?: string;
  academicYear?: string; // e.g. "2026"
  visitCount: number; // e.g. 100+
  schoolName?: string;
  certificateCode?: string;
}

export const OnlineCertificateModal: React.FC<OnlineCertificateModalProps> = ({
  isOpen,
  onClose,
  recipientName,
  recipientEmail,
  academicYear = '2026',
  visitCount,
  schoolName = 'โรงเรียนอัสสัมชัญอุบลราชธานี',
  certificateCode,
}) => {
  const certificateRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Clean real name strictly (ชื่อ-นามสกุลจริงเท่านั้น)
  const cleanName = getCleanRealName(recipientName, recipientEmail);

  // Convert Gregorian year to Buddhist Era (พ.ศ.)
  const yearNumber = parseInt(academicYear, 10) || new Date().getFullYear();
  const beYear = yearNumber < 2500 ? yearNumber + 543 : yearNumber;

  // Generated unique certificate code if not provided
  const generatedCode =
    certificateCode ||
    `ACU-CERT-${academicYear}-${Math.abs(
      (recipientEmail || cleanName).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 17
    ).toString(16).toUpperCase().padStart(6, '0')}`;

  const todayStrThai = new Date().toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Print-specific style tag injection for perfect A4 landscape layout */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #acu-printable-certificate, #acu-printable-certificate * {
            visibility: visible;
          }
          #acu-printable-certificate {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            margin: 0;
            padding: 12mm;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 landscape;
            margin: 0;
          }
        }
      `}</style>

      <div className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[96vh] print:max-h-none print:border-0 print:shadow-none print:bg-white">
        
        {/* Modal Top Control Bar (Hidden during printing) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-amber-500/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>เกียรติบัตรออนไลน์ประจำปี พ.ศ. {beYear}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  เข้าชมครบ {visitCount} ครั้ง
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                ออกให้แก่: <strong className="text-amber-300 font-medium">{cleanName}</strong> (ชื่อ-นามสกุลจริงตามระบบ)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              title="พิมพ์เกียรติบัตร หรือบันทึกเป็น PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์เกียรติบัตร (Print / PDF)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Certificate Display Area (Scrollable in Modal) */}
        <div className="p-3 sm:p-6 overflow-y-auto bg-slate-950/60 flex items-center justify-center print:p-0 print:bg-white print:overflow-visible">
          
          {/* =========================================================================
              THE PRINTABLE CERTIFICATE
             ========================================================================= */}
          <div
            id="acu-printable-certificate"
            ref={certificateRef}
            className="w-full aspect-[1.414/1] max-w-[840px] bg-gradient-to-br from-[#FFFDF9] via-[#FAF6EE] to-[#F7F2E7] text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-10 border-[6px] border-[#B8860B] relative overflow-hidden flex flex-col justify-between font-['Prompt',sans-serif]"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45), inset 0 0 100px rgba(212, 175, 55, 0.08)',
            }}
          >
            {/* Elegant Double Inner Golden Frame */}
            <div className="absolute inset-2 sm:inset-3 border-2 border-[#D4AF37]/70 rounded-xl pointer-events-none"></div>
            <div className="absolute inset-3 sm:inset-4 border border-[#B8860B]/40 rounded-lg pointer-events-none"></div>

            {/* Corner Filigree Accents (Thai / Classical Certificate Ornament) */}
            <div className="absolute top-4 left-4 w-8 h-8 sm:w-10 sm:h-10 border-t-2 border-l-2 border-[#B8860B] pointer-events-none"></div>
            <div className="absolute top-4 right-4 w-8 h-8 sm:w-10 sm:h-10 border-t-2 border-r-2 border-[#B8860B] pointer-events-none"></div>
            <div className="absolute bottom-4 left-4 w-8 h-8 sm:w-10 sm:h-10 border-b-2 border-l-2 border-[#B8860B] pointer-events-none"></div>
            <div className="absolute bottom-4 right-4 w-8 h-8 sm:w-10 sm:h-10 border-b-2 border-r-2 border-[#B8860B] pointer-events-none"></div>

            {/* Subtle Center Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none select-none">
              <img src={DEFAULT_LOGO_IMAGE} alt="ACU Seal" className="w-80 h-80 object-contain filter grayscale" />
            </div>

            {/* Header Section */}
            <div className="relative z-10 text-center flex flex-col items-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <img
                  src={DEFAULT_LOGO_IMAGE}
                  alt="Assumption College Ubonratchathani"
                  className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-md"
                />
              </div>

              <h2 className="text-base sm:text-xl font-bold text-[#1E293B] tracking-wide">
                {schoolName}
              </h2>
              <p className="text-[11px] sm:text-xs text-[#475569] font-medium mt-0.5">
                ฝ่ายวิชาการ • ศูนย์พัฒนานวัตกรรมการจัดการเรียนรู้และแหล่งเรียนรู้
              </p>

              <div className="my-2 sm:my-3 flex items-center justify-center gap-2">
                <span className="h-[1.5px] w-12 sm:w-20 bg-gradient-to-r from-transparent via-[#B8860B] to-transparent"></span>
                <span className="text-[10px] sm:text-xs font-semibold tracking-widest text-[#B8860B] uppercase">
                  Certificate of Recognition
                </span>
                <span className="h-[1.5px] w-12 sm:w-20 bg-gradient-to-r from-transparent via-[#B8860B] to-transparent"></span>
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#92400E] tracking-tight drop-shadow-sm font-['Prompt',sans-serif]">
                เกียรติบัตรออนไลน์
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-medium">
                มอบให้ไว้เพื่อแสดงว่า
              </p>
            </div>

            {/* Recipient Name Section (เอาเฉพาะชื่อ นามสกุลจริงเท่านั้น) */}
            <div className="relative z-10 text-center my-2 sm:my-3">
              <div className="inline-block relative px-6 sm:px-10 py-1">
                <p className="text-xl sm:text-2xl md:text-3xl font-black text-[#1E3A8A] tracking-normal drop-shadow-sm border-b-2 border-[#D4AF37] pb-1 font-['Prompt',sans-serif]">
                  {cleanName}
                </p>
              </div>

              {recipientEmail && (
                <p className="text-[10px] sm:text-xs text-[#64748B] mt-1 font-mono opacity-80">
                  บัญชีผู้ใช้งาน: {recipientEmail}
                </p>
              )}
            </div>

            {/* Achievement / Citation Text */}
            <div className="relative z-10 text-center max-w-xl mx-auto px-4">
              <p className="text-xs sm:text-sm md:text-[15px] leading-relaxed text-[#334155] font-medium">
                เป็นผู้มีความมุ่งมั่น วิริยะอุตสาหะ และเข้าใช้งานระบบสื่อนวัตกรรมการจัดการเรียนรู้และแหล่งเรียนรู้
                <br className="hidden sm:inline" />
                ครบถ้วนตามเกณฑ์ <strong className="text-[#92400E] font-bold">๑๐๐ ครั้งขึ้นไป</strong> (สถิติการเข้าชมสะสม <strong>{visitCount}</strong> ครั้ง)
                <br />
                ประจำปีการศึกษา พุทธศักราช <strong className="text-[#1E293B] font-bold">{beYear}</strong>
              </p>
              <p className="text-[11px] sm:text-xs text-[#64748B] mt-1.5 italic">
                ขอให้รักษาคุณความดีและเกียรติประวัตินี้ไว้ เพื่อเป็นแบบอย่างที่ดีในการจัดการเรียนรู้สืบไป
              </p>
            </div>

            {/* Footer / Signatures / Seal */}
            <div className="relative z-10 mt-3 sm:mt-6 pt-3 sm:pt-4 border-t border-[#E2E8F0] flex items-end justify-between px-2 sm:px-6">
              
              {/* Left: Issue Date & Verification Code */}
              <div className="text-left space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-[#475569]">
                  <Calendar className="w-3.5 h-3.5 text-[#B8860B]" />
                  <span>ให้ไว้ ณ วันที่ {todayStrThai}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-[#64748B] font-mono">
                  <Shield className="w-3 h-3 text-emerald-600" />
                  <span>รหัสรับรอง: {generatedCode}</span>
                </div>
                <div className="text-[8px] sm:text-[9px] text-[#94A3B8]">
                  ระบบสื่อนวัตกรรมและคลังสื่อออนไลน์ ACU
                </div>
              </div>

              {/* Center: Gold Seal Embellishment */}
              <div className="hidden sm:flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#B8860B] via-[#F59E0B] to-[#FEF3C7] p-0.5 shadow-md flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] border border-[#B8860B] flex flex-col items-center justify-center text-[#92400E]">
                    <Sparkles className="w-4 h-4 text-[#D97706]" />
                    <span className="text-[7px] font-black uppercase tracking-tighter mt-0.5">ACU VERIFIED</span>
                  </div>
                </div>
              </div>

              {/* Right: Signature Line */}
              <div className="text-center space-y-1 min-w-[150px] sm:min-w-[190px]">
                <div className="h-7 sm:h-9 flex items-center justify-center">
                  <span className="font-serif italic text-base sm:text-lg text-slate-700 font-semibold tracking-wider">
                    ACU Academic Center
                  </span>
                </div>
                <div className="w-full h-[1px] bg-[#94A3B8]"></div>
                <p className="text-[10px] sm:text-xs font-bold text-[#1E293B] mt-1">
                  ฝ่ายวิชาการและศูนย์พัฒนานวัตกรรม
                </p>
                <p className="text-[9px] sm:text-[10px] text-[#64748B]">
                  โรงเรียนอัสสัมชัญอุบลราชธานี
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Bottom Footer / Quick Action */}
        <div className="no-print p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              เกียรติบัตรออนไลน์ตรวจสอบแล้ว: เข้าชม <strong>{visitCount}</strong> ครั้ง (ตรงตามเกณฑ์ 100 ครั้งขึ้นไป)
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์เกียรติบัตรทันที</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700 transition-colors cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
