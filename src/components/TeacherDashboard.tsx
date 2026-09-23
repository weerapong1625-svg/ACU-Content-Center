import React, { useState, useEffect } from 'react';
import { 
  SchoolLogo 
} from './SchoolLogo';
import { 
  FullUserProfile, 
  subscribeFullUserProfile, 
  saveFullUserProfile 
} from '../services/userProfileService';
import { UserProfileModal } from './UserProfileModal';
import { FacilityUsageSubmissionModal } from './FacilityUsageSubmissionModal';
import { TeacherInnovationSubmissionModal } from './TeacherInnovationSubmissionModal';
import { MediaTypesPopupModal } from './MediaTypesPopupModal';
import { TeacherMediaRepositoryModal } from './TeacherMediaRepositoryModal';
import { IdeaBankModal } from './IdeaBankModal';
import { AdminUserManagementModal } from './AdminUserManagementModal';
import { AdminEmailAuditModal } from './AdminEmailAuditModal';
import { SUPER_ADMIN_EMAIL } from '../services/logoService';
import { 
  UploadCloud, 
  BookOpenCheck, 
  FolderArchive, 
  School, 
  Globe2, 
  Lightbulb, 
  HelpCircle, 
  User, 
  ArrowLeft, 
  LogOut, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles, 
  X, 
  Plus, 
  ExternalLink, 
  FileText, 
  Clock, 
  Star, 
  MapPin, 
  Search, 
  Check, 
  Download, 
  Share2, 
  Building, 
  Compass, 
  Layers, 
  Info, 
  Send,
  Trash2,
  Database,
  Camera
} from 'lucide-react';
import { ADMIN_TARGET_EMAIL } from '../services/submissionService';

interface TeacherDashboardProps {
  userEmail: string;
  onBackToRoles: () => void;
  onLogout: () => void;
}

// 7 Modern Color Schemes for the 7 Cards
interface MenuCardItem {
  id: string;
  number?: string; // numbers 1-6; empty for button 7 as requested
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  bgLight: string;
  borderClass: string;
  shadowColor: string;
  hoverScale: string;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  userEmail,
  onBackToRoles,
  onLogout,
}) => {
  // Real-time synced profile from Cloud Firestore (same across mobile & desktop)
  const [profile, setProfile] = useState<FullUserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showUserManagementModal, setShowUserManagementModal] = useState(false);
  const [showEmailAuditModal, setShowEmailAuditModal] = useState(false);

  // Active view modal when a button is clicked
  const [activeModalId, setActiveModalId] = useState<string | null>(null);

  // Search & Filter state for Media Repository
  const [searchMedia, setSearchMedia] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Form states for adding items in modals
  const [newInternalLocation, setNewInternalLocation] = useState({ name: '', zone: '', purpose: '', capacity: '' });
  const [internalLocationsList, setInternalLocationsList] = useState([
    { id: 1, name: 'ศูนย์การเรียนรู้ดิจิทัล & Maker Space', zone: 'อาคารเฉลิมพระเกียรติ ชั้น 3', purpose: 'การจัดการเรียนรู้สะเต็มศึกษา (STEM) และการสร้างสรรค์สิ่งประดิษฐ์อัจฉริยะ', capacity: '50 คน' },
    { id: 2, name: 'ห้องปฏิบัติการวิทยาศาสตร์เฉลิมพระเกียรติ', zone: 'อาคารเซนต์หลุยส์ ชั้น 2', purpose: 'การทดลองฟิสิกส์ เคมี ชีววิทยา และนวัตกรรมสิ่งแวดล้อม', capacity: '45 คน' },
    { id: 3, name: 'หอประชุมนักบุญหลุยส์มารีย์ (St. Gabriel Hall)', zone: 'อาคารอำนวยการ ชั้น 1', purpose: 'นิทรรศการวิชาการ การสัมมนา และการเผยแพร่ผลงานสื่อสร้างสรรค์', capacity: '300 คน' },
    { id: 4, name: 'ศูนย์ปัญญาประดิษฐ์และหุ่นยนต์ (AI & Robotics Hub)', zone: 'อาคารสารสนเทศ ชั้น 4', purpose: 'การเขียนโค้ดและพัฒนาโครงงานระบบอัตโนมัติของนักเรียนและครู', capacity: '40 คน' },
    { id: 5, name: 'สวนพฤกษศาสตร์และศูนย์เกษตรอินทรีย์โรงเรียน', zone: 'พื้นที่อนุรักษ์ธรรมชาติ ทิศตะวันออก', purpose: 'แหล่งเรียนรู้ธรรมชาติ สิ่งแวดล้อม และระบบนิเวศท้องถิ่น', capacity: '80 คน' },
    { id: 6, name: 'ห้องสมุดดิจิทัลและศูนย์การเรียนรู้ศตวรรษที่ 21', zone: 'อาคารมงฟอร์ต ชั้น 2', purpose: 'สืบค้นข้อมูล ฐานข้อมูลงานวิจัย และสื่อมัลติมีเดียสากล', capacity: '120 คน' },
  ]);

  const [newExternalLocation, setNewExternalLocation] = useState({ name: '', location: '', relevance: '', contact: '' });
  const [externalLocationsList, setExternalLocationsList] = useState([
    { id: 1, name: 'ศูนย์ศิลปวัฒนธรรมอุบลราชธานี', location: 'ถนนอุปราช ต.ในเมือง อ.เมือง จ.อุบลราชธานี', relevance: 'บูรณาการการเรียนรู้ประวัติศาสตร์ วัฒนธรรมอีสาน และภูมิปัญญาท้องถิ่น', contact: '045-255-097' },
    { id: 2, name: 'หอดูดาวเฉลิมพระเกียรติฯ อุบลราชธานี', location: 'ต.ดอนมดแดง อ.ดอนมดแดง จ.อุบลราชธานี', relevance: 'การเรียนรู้ดาราศาสตร์ อวกาศ ฟิสิกส์ และเทคโนโลยีสำรวจจักรวาล', contact: '045-950-891' },
    { id: 3, name: 'พิพิธภัณฑสถานแห่งชาติ อุบลราชธานี', location: 'ถนนเขื่อนธานี ต.ในเมือง อ.เมือง จ.อุบลราชธานี', relevance: 'แหล่งศึกษาโบราณคดี ศิลปะ วิถีชีวิต และรากเหง้าเมืองอุบลราชธานี', contact: '045-251-011' },
    { id: 4, name: 'ศูนย์การเรียนรู้ลุ่มน้ำโขงและนิเวศวิทยาชุมชน', location: 'อ.โขงเจียม จ.อุบลราชธานี', relevance: 'ศึกษาความหลากหลายทางชีวภาพ การอนุรักษ์น้ำ และนิเวศวิทยาแม่น้ำโขง', contact: '045-351-153' },
    { id: 5, name: 'อุทยานแห่งชาติผาแต้มและแหล่งภาพเขียนสีก่อนประวัติศาสตร์', location: 'ต.ห้วยไผ่ อ.โขงเจียม จ.อุบลราชธานี', relevance: 'ธรณีวิทยา ธรณีสัณฐาน และภาพเขียนสียุคก่อนประวัติศาสตร์ 3,000 ปี', contact: '045-252-581' },
  ]);

  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [newIdeaDesc, setNewIdeaDesc] = useState('');
  const [newIdeaCategory, setNewIdeaCategory] = useState('เทคนิคการสอนเชิงรุก (Active Learning)');
  const [ideasList, setIdeasList] = useState([
    { id: 1, title: 'การใช้ AI Generative ในการสร้างสถานการณ์จำลองวิชาสังคมศึกษา', teacher: 'ครูปอย (มาสเตอร์วีระพงศ์)', category: 'เทคโนโลยีดิจิทัล & AI', likes: 24, date: '18 มี.ค. 2569' },
    { id: 2, title: 'บอร์ดเกมกระตุ้นทักษะการคำนวณและตรรกศาสตร์สำหรับเด็กยุคใหม่', teacher: 'ครูศิริพร สุวรรณโคตร', category: 'Gamification & สื่อสร้างสรรค์', likes: 19, date: '17 มี.ค. 2569' },
    { id: 3, title: 'Micro-Learning Clips 3 นาที สรุปสูตรเคมีก่อนสอบจริง', teacher: 'ครูกิตติพงษ์ เจริญสุข', category: 'สื่อวิดีโอ & มัลติมีเดีย', likes: 31, date: '15 มี.ค. 2569' },
    { id: 4, title: 'สมุดบันทึกสะท้อนคิดดิจิทัล (Digital Reflection Journal)', teacher: 'ครูอรัญญา พิลาวัลย์', category: 'การวัดผลประเมินผล', likes: 16, date: '14 มี.ค. 2569' },
  ]);

  // Subscribe to real-time full profile across devices
  useEffect(() => {
    const unsubscribe = subscribeFullUserProfile(userEmail, (loaded) => {
      setProfile(loaded);
    });
    return () => {
      unsubscribe();
    };
  }, [userEmail]);

  // 7 Button Configurations exactly matching user's specification
  const menuButtons: MenuCardItem[] = [
    {
      id: 'btn-1',
      number: '1',
      title: 'ส่งสื่อ/นวัตกรรม 5 ชิ้น',
      badge: 'เป้าหมายประจำปี 5 รายการ',
      description: 'ระบบอัปโหลดและติดตามสถานะการส่งสื่อนวัตกรรมการจัดการเรียนรู้ตามเกณฑ์ 5 ชิ้น',
      icon: UploadCloud,
      gradient: 'from-blue-600 via-indigo-600 to-indigo-700',
      bgLight: 'bg-indigo-50/70 hover:bg-indigo-50',
      borderClass: 'border-indigo-200/90 hover:border-indigo-400',
      shadowColor: 'hover:shadow-indigo-500/20',
      hoverScale: 'group-hover:translate-y-[-4px]',
    },
    {
      id: 'btn-2',
      number: '2',
      title: 'ศึกษาเกณฑ์/ประเภทสื่อ',
      badge: 'มาตรฐานฝ่ายวิชาการ',
      description: 'คู่มือและเกณฑ์ประเมินประเภทสื่อนวัตกรรมทางการศึกษา รูบริกส์คะแนน และตัวชี้วัด',
      icon: BookOpenCheck,
      gradient: 'from-sky-500 via-cyan-600 to-blue-600',
      bgLight: 'bg-sky-50/70 hover:bg-sky-50',
      borderClass: 'border-sky-200/90 hover:border-sky-400',
      shadowColor: 'hover:shadow-sky-500/20',
      hoverScale: 'group-hover:translate-y-[-4px]',
    },
    {
      id: 'btn-3',
      number: '3',
      title: 'คลังสื่อคุณครูผลิตเอง',
      badge: 'สุ่มแสดงผลทุกวัน (สูงสุด 100 สื่อ)',
      description: 'รวบรวมสื่อการสอน คลิปวิดีโอ ใบงาน และผลงานครู สุ่มแสดงผลทุกวัน สูงสุดไม่เกิน 100 รายการ',
      icon: FolderArchive,
      gradient: 'from-purple-600 via-violet-600 to-fuchsia-600',
      bgLight: 'bg-purple-50/70 hover:bg-purple-50',
      borderClass: 'border-purple-200/90 hover:border-purple-400',
      shadowColor: 'hover:shadow-purple-500/20',
      hoverScale: 'group-hover:translate-y-[-4px]',
    },
    {
      id: 'btn-4',
      number: '4',
      title: 'บันทึกแหล่งเรียนรู้ภายในโรงเรียนอัสสัมชัญอุบลราชธานี',
      badge: 'ภายในโรงเรียน (On-Campus)',
      description: 'ระบบบันทึก จัดการ และสืบค้นห้องปฏิบัติการ ศูนย์การเรียนรู้ และมุมสาระภายในโรงเรียน',
      icon: School,
      gradient: 'from-emerald-600 via-teal-600 to-green-700',
      bgLight: 'bg-emerald-50/70 hover:bg-emerald-50',
      borderClass: 'border-emerald-200/90 hover:border-emerald-400',
      shadowColor: 'hover:shadow-emerald-500/20',
      hoverScale: 'group-hover:translate-y-[-4px]',
    },
    {
      id: 'btn-5',
      number: '5',
      title: 'บันทึกแหล่งเรียนรู้ภายนอกโรงเรียนอัสสัมชัญอุบลราชธานี',
      badge: 'ภายนอกโรงเรียน (Off-Campus)',
      description: 'ฐานข้อมูลแหล่งเรียนรู้ชุมชน แหล่งวัฒนธรรม พิพิธภัณฑ์ และภูมิปัญญาท้องถิ่นอุบลราชธานี',
      icon: Globe2,
      gradient: 'from-amber-500 via-orange-600 to-red-500',
      bgLight: 'bg-amber-50/70 hover:bg-amber-50',
      borderClass: 'border-amber-200/90 hover:border-amber-400',
      shadowColor: 'hover:shadow-amber-500/20',
      hoverScale: 'group-hover:translate-y-[-4px]',
    },
    {
      id: 'btn-6',
      number: '6',
      title: 'คลังไอเดีย (IDEA)',
      badge: 'พอร์ทัลคลังความรู้ & ไอเดียการสอน',
      description: 'รวมเว็บไซต์หลักทางการ สสวท. สพฐ. สช. คู่มือ AI ศธ. คลังวิจัย ThaiLIS/TCI ข้อสอบ และเพจแชร์สื่อ',
      icon: Lightbulb,
      gradient: 'from-yellow-500 via-amber-500 to-orange-500',
      bgLight: 'bg-yellow-50/70 hover:bg-yellow-50',
      borderClass: 'border-yellow-200/90 hover:border-yellow-400',
      shadowColor: 'hover:shadow-yellow-500/20',
      hoverScale: 'group-hover:translate-y-[-4px]',
    },
    {
      id: 'btn-7',
      // Explicitly: ปุ่มนี้ไม่ต้องใส่หมายเลข
      number: undefined,
      title: 'ส่งสื่อเข้าประกวด',
      badge: 'การประกวดสื่อนวัตกรรม',
      description: 'ระบบเปิดรับและจัดส่งผลงานสื่อนวัตกรรมการจัดการเรียนรู้เข้าสู่การประกวดประจำปี',
      icon: Sparkles,
      gradient: 'from-rose-500 via-pink-600 to-red-600',
      bgLight: 'bg-rose-50/70 hover:bg-rose-50',
      borderClass: 'border-rose-200/90 hover:border-rose-400',
      shadowColor: 'hover:shadow-rose-500/20',
      hoverScale: 'group-hover:translate-y-[-4px]',
    },
  ];

  const handleAddInternal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInternalLocation.name.trim()) return;
    setInternalLocationsList(prev => [
      {
        id: Date.now(),
        name: newInternalLocation.name.trim(),
        zone: newInternalLocation.zone.trim() || 'ภายในโรงเรียน',
        purpose: newInternalLocation.purpose.trim() || 'แหล่งเรียนรู้เพื่อการพัฒนาผู้เรียน',
        capacity: newInternalLocation.capacity.trim() || '30-50 คน',
      },
      ...prev
    ]);
    setNewInternalLocation({ name: '', zone: '', purpose: '', capacity: '' });
  };

  const handleAddExternal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExternalLocation.name.trim()) return;
    setExternalLocationsList(prev => [
      {
        id: Date.now(),
        name: newExternalLocation.name.trim(),
        location: newExternalLocation.location.trim() || 'จังหวัดอุบลราชธานี',
        relevance: newExternalLocation.relevance.trim() || 'แหล่งเรียนรู้บูรณาการสาระการเรียนรู้',
        contact: newExternalLocation.contact.trim() || 'โทร. ประสานงานโรงเรียน',
      },
      ...prev
    ]);
    setNewExternalLocation({ name: '', location: '', relevance: '', contact: '' });
  };

  const handleAddIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdeaTitle.trim()) return;
    setIdeasList(prev => [
      {
        id: Date.now(),
        title: newIdeaTitle.trim(),
        teacher: profile?.fullName || profile?.nickname || 'คุณครูอัสสัมชัญอุบลราชธานี',
        category: newIdeaCategory,
        likes: 1,
        date: 'วันนี้',
      },
      ...prev
    ]);
    setNewIdeaTitle('');
    setNewIdeaDesc('');
  };

  // Avatar calculation
  const avatarSrc = profile?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(
    profile?.fullName || userEmail
  )}&background=1e40af&color=ffffff&size=160&bold=true`;

  return (
    <div
      id="teacher-dashboard-viewport"
      className="relative min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col justify-between overflow-x-hidden select-none font-['Prompt',sans-serif]"
    >
      {/* Background Decor - Crisp Academic Gradient Mesh */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/academic_bg.jpg"
          alt="ACU Academic Background"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-30 scale-105"
          style={{ filter: 'blur(5px)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-900/90 to-blue-950/95" />
        <div className="absolute top-0 right-0 w-[550px] h-[350px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-0 w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Main Responsive Wrapper */}
      <div className="relative z-10 w-full flex flex-col flex-grow py-5 px-4 sm:px-6 md:px-10 lg:px-12 max-w-7xl mx-auto">
        
        {/* =========================================================================
            HEADER: Symmetrical Layout matching User Instructions:
            1. ขอบซ้าย: โลโก้โรงเรียน (School Logo) + ชื่อโรงเรียน
            2. มุมขวาบนอย่างสมมาตร: "ระบบคลังสื่อ และนวัตกรรมการเรียนรู้"
           ========================================================================= */}
        <header
          id="teacher-dashboard-header"
          className="w-full flex flex-col md:flex-row items-center justify-between gap-4 pb-5 border-b border-slate-700/60"
        >
          {/* ขอบซ้าย: คง ในส่วนของโลโก้โรงเรียน (School Logo + Title) */}
          <div className="flex items-center gap-3.5 sm:gap-4 w-full md:w-auto justify-start">
            <div className="flex-shrink-0">
              <SchoolLogo size="md" currentUserEmail={userEmail} />
            </div>

            <div className="flex flex-col">
              <h1 className="font-['Roboto',sans-serif] font-black text-lg sm:text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-sky-200 to-red-400 drop-shadow-sm">
                Assumption College Ubonratchathani
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-slate-300 tracking-wide">
                  โรงเรียนอัสสัมชัญอุบลราชธานี
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  ห้องปฏิบัติการครูผู้สอน
                </span>
              </div>
            </div>
          </div>

          {/* มุมขวาบนอย่างสมมาตร: คำว่า "ระบบคลังสื่อและนวัตกรรมการเรียนรู้" บรรทัดเดียวกัน ไม่ขาดคำหรือตกบรรทัด */}
          <div className="w-full md:w-auto flex flex-wrap sm:flex-nowrap items-center justify-between md:justify-end gap-3 flex-shrink-0">
            <div
              id="top-right-symmetric-title-box"
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-purple-950/70 to-slate-900/90 border border-indigo-400/40 shadow-[0_4px_20px_rgba(79,70,229,0.25)] backdrop-blur-md flex items-center gap-2.5 flex-shrink-0"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping flex-shrink-0" />
              <span className="font-['Prompt',sans-serif] font-bold text-sm sm:text-base md:text-lg text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-purple-200 tracking-wide select-none drop-shadow whitespace-nowrap">
                ระบบคลังสื่อและนวัตกรรมการเรียนรู้
              </span>
            </div>

            {/* User Profile Chip & Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-teacher-profile-chip"
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition-all duration-200 hover:scale-[1.02] shadow-sm group"
                title="คลิกเพื่อดูและแก้ไขโปรไฟล์ของคุณ"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border border-blue-400/60 shadow-sm flex-shrink-0 bg-slate-700">
                  <img
                    src={avatarSrc}
                    alt={profile?.fullName || userEmail}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userEmail)}&background=2563eb&color=ffffff&size=160&bold=true`;
                    }}
                  />
                </div>
                <div className="flex flex-col min-w-0 pr-1">
                  <span className="text-xs font-semibold text-slate-200 truncate max-w-[130px] group-hover:text-blue-300 transition-colors">
                    {profile?.fullName || profile?.displayName || userEmail.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {profile?.nickname ? `(${profile.nickname}) ` : ''}ครูผู้สอน
                  </span>
                </div>
              </button>

              {/* Quick Admin Actions (เฉพาะ Super Admin) */}
              {userEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowUserManagementModal(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                    title="ลบบัญชีผู้ใช้งานระบบ (เฉพาะ Admin)"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span className="hidden sm:inline">ลบบัญชีผู้ใช้</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEmailAuditModal(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 text-blue-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                    title="ตรวจสอบและซิงค์อีเมลทุกฐานข้อมูล"
                  >
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                    <span className="hidden sm:inline">ตรวจสอบอีเมล</span>
                  </button>
                </>
              )}

              <button
                type="button"
                id="btn-back-to-roles"
                onClick={onBackToRoles}
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                title="กลับสู่หน้าเลือกสถานะ (Role Selection)"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">เปลี่ยนบทบาท</span>
              </button>

              <button
                type="button"
                id="btn-teacher-logout"
                onClick={onLogout}
                className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-100 border border-red-800/50 text-xs transition-colors shadow-sm"
                title="ออกจากระบบ"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* User Welcome Notice Banner */}
        <section className="my-5 p-4 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-500/30 shadow-lg backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center flex-shrink-0 text-blue-300">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  ยินดีต้อนรับสู่ระบบงานคลังสื่อนวัตกรรมครู
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-medium">
                  ออนไลน์เชื่อมต่อ Firebase
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                เลือกทำรายการตาม 7 ภารกิจหลักด้านล่าง เพื่อส่งสื่อ ค้นคว้า หรือบันทึกแหล่งเรียนรู้โรงเรียนอัสสัมชัญอุบลราชธานี
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setActiveModalId('btn-1')}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-transform hover:scale-105 flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>ส่งสื่อนวัตกรรม 5 ชิ้น</span>
            </button>
          </div>
        </section>

        {/* =========================================================================
            CENTER SECTION: 7 Modern Multi-Colored Buttons
            "ส่วนตรงกลาง ให้สร้างเป็นกรอบสีคละกันแบบทันสมัย 7 ปุ่ม และแต่ละปุ่มมีข้อความดังนี้"
            1. ส่งสื่อ/นวัตกรรม 5 ชิ้น
            2. ศึกษาเกณฑ์/ประเภทสื่อ
            3. คลังสื่อคุณครูผลิตเอง
            4. บันทึกแหล่งเรียนรู้ภายในโรงเรียนอัสสัมชัญอุบลราชธานี
            5. บันทึกแหล่งเรียนรู้ภายนอกโรงเรียนอัสสัมชัญอุบลราชธานี
            6. คลังไอเดีย (IDEA)
            7. ปุ่มนี้ไม่ต้องใส่หมายเลข
           ========================================================================= */}
        <main
          id="center-7-buttons-grid"
          className="my-auto py-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5"
        >
          {menuButtons.map((btn, index) => {
            const IconComponent = btn.icon;
            // Distinct visual card styling
            return (
              <div
                key={btn.id}
                id={`teacher-menu-card-${index + 1}`}
                onClick={() => setActiveModalId(btn.id)}
                className={`group relative rounded-3xl p-5 sm:p-6 bg-slate-900/85 hover:bg-slate-800/90 border ${btn.borderClass} shadow-xl ${btn.shadowColor} backdrop-blur-xl transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[190px] sm:min-h-[210px] overflow-hidden ${btn.hoverScale}`}
              >
                {/* Glow ambient background highlight */}
                <div
                  className={`absolute -top-16 -right-16 w-36 h-36 rounded-full bg-gradient-to-br ${btn.gradient} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-300 pointer-events-none`}
                />

                {/* Top Row: Icon + Number Badge */}
                <div className="relative z-10 flex items-start justify-between gap-3">
                  {/* Modern Universal Icon Box with Vibrant Gradient */}
                  <div
                    className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr ${btn.gradient} p-0.5 shadow-md flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-2`}
                  >
                    <div className="w-full h-full rounded-[14px] bg-slate-950/20 backdrop-blur-sm flex items-center justify-center text-white">
                      <IconComponent className="w-7 h-7 sm:w-8 sm:h-8" />
                    </div>
                  </div>

                  {/* Badge & Number indicator */}
                  <div className="flex flex-col items-end gap-1">
                    {btn.number && (
                      <span className="w-7 h-7 rounded-full bg-white/10 border border-white/20 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                        {btn.number}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/80">
                      {btn.badge}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Title + Description + Action indicator */}
                <div className="relative z-10 mt-4 flex flex-col">
                  <h3 className="font-['Prompt',sans-serif] font-bold text-base sm:text-lg text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-200 transition-colors leading-snug">
                    {btn.number ? `${btn.number}. ${btn.title.replace(/^\d+\.\s*/, '')}` : btn.title}
                  </h3>

                  <p className="mt-1 text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {btn.description}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-slate-400 group-hover:text-white transition-colors">
                    <span className="flex items-center gap-1 text-[11px] text-blue-400 group-hover:underline">
                      เปิดหน้ารายการ
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            );
          })}
        </main>

        {/* Footer note */}
        <footer className="mt-6 pt-4 border-t border-slate-800/60 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>โรงเรียนอัสสัมชัญอุบลราชธานี • ระบบคลังสื่อ และนวัตกรรมการเรียนรู้ ภาคเรียนปัจจุบัน</span>
          <span className="text-[11px] text-slate-400">
            บัญชีผู้ใช้: <strong className="text-slate-300">{userEmail}</strong> (เชื่อมต่อฐานข้อมูลเรียบร้อย)
          </span>
        </footer>
      </div>

      {/* =========================================================================
          INTERACTIVE MODALS FOR EACH OF THE 7 BUTTONS
         ========================================================================= */}

      {/* Modal 1: ส่งสื่อ/นวัตกรรม 5 ชิ้น (แบบฟอร์ม 5 ชิ้น, ระดับชั้น, กลุ่มสาระ, เช็คสถานะผ่านอีเมล, สรุป Google Sheets ถึง weerapong1625@acu.ac.th ฐานข้อมูล System Test) */}
      {activeModalId === 'btn-1' && (
        <TeacherInnovationSubmissionModal
          userEmail={userEmail}
          defaultTeacherName={profile?.fullName}
          onClose={() => setActiveModalId(null)}
        />
      )}

      {/* Modal 2: ศึกษาเกณฑ์/ประเภทสื่อ (แสดงเฉพาะกราฟิกป๊อปอัปไฟล์ ประเภทสื่อ .png เท่านั้น - แอดมิน weerapong1625@acu.ac.th อัปโหลดได้คนเดียว) */}
      {activeModalId === 'btn-2' && (
        <MediaTypesPopupModal
          userEmail={userEmail}
          onClose={() => setActiveModalId(null)}
        />
      )}

      {/* Modal 3: คลังสื่อคุณครูผลิตเอง (สุ่มสื่อ 5 ชิ้น มีภาพตัวอย่างเล็กๆ คุณครู กลุ่มสาระ วิชา กดชม และให้คะแนนดาวได้) */}
      {activeModalId === 'btn-3' && (
        <TeacherMediaRepositoryModal
          userEmail={userEmail}
          onClose={() => setActiveModalId(null)}
        />
      )}

      {/* Modal 4: บันทึกแหล่งการเรียนรู้ภายในโรงเรียนอัสสัมชัญอุบลราชธานี (33 แหล่งเรียนรู้, 9 กลุ่มสาระ, 9 คาบเรียน, สรุป Google Sheets ถึง weerapong1625@acu.ac.th) */}
      {activeModalId === 'btn-4' && (
        <FacilityUsageSubmissionModal
          userEmail={userEmail}
          defaultTeacherName={profile?.fullName}
          onClose={() => setActiveModalId(null)}
        />
      )}

      {/* Modal 5: บันทึกแหล่งเรียนรู้ภายนอกโรงเรียนอัสสัมชัญอุบลราชธานี */}
      {activeModalId === 'btn-5' && (
        <div
          id="modal-external-learning-centers"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModalId(null);
          }}
        >
          <div className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-amber-900/60 via-orange-900/50 to-slate-900 border-b border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600/30 border border-amber-400/40 flex items-center justify-center text-amber-300">
                  <Globe2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">5. บันทึกแหล่งเรียนรู้ภายนอกโรงเรียนอัสสัมชัญอุบลราชธานี</h3>
                  <p className="text-xs text-slate-300">
                    ฐานข้อมูลแหล่งเรียนรู้ชุมชน แหล่งวัฒนธรรม และศูนย์การเรียนรู้ภายนอก (Off-Campus)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalId(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Add form */}
              <form onSubmit={handleAddExternal} className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30">
                <h4 className="text-sm font-bold text-amber-300 mb-3 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  เพิ่มแหล่งเรียนรู้ภายนอกโรงเรียนใหม่
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-300 block mb-1">ชื่อแหล่งเรียนรู้ภายนอก</label>
                    <input
                      type="text"
                      placeholder="เช่น สวนพฤกษศาสตร์ดงฟ้าห่วน"
                      value={newExternalLocation.name}
                      onChange={(e) => setNewExternalLocation(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">ที่ตั้ง / อำเภอ / พิกัด</label>
                    <input
                      type="text"
                      placeholder="เช่น ต.ขามใหญ่ อ.เมือง จ.อุบลราชธานี"
                      value={newExternalLocation.location}
                      onChange={(e) => setNewExternalLocation(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">ความสอดคล้องกับหลักสูตร</label>
                    <input
                      type="text"
                      placeholder="เช่น ชีววิทยา พันธุ์ไม้ท้องถิ่น และนิเวศวิทยา"
                      value={newExternalLocation.relevance}
                      onChange={(e) => setNewExternalLocation(prev => ({ ...prev, relevance: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">เบอร์ติดต่อ / หน่วยงานประสาน</label>
                    <input
                      type="text"
                      placeholder="เช่น 045-xxxxxx"
                      value={newExternalLocation.contact}
                      onChange={(e) => setNewExternalLocation(prev => ({ ...prev, contact: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-colors"
                  >
                    + บันทึกแหล่งเรียนรู้ภายนอก
                  </button>
                </div>
              </form>

              {/* List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  แหล่งเรียนรู้ภายนอกแนะนำประจำจังหวัด ({externalLocationsList.length} แห่ง)
                </h4>
                {externalLocationsList.map((loc) => (
                  <div key={loc.id} className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <h5 className="font-bold text-white text-sm">{loc.name}</h5>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">ที่ตั้ง: {loc.location}</p>
                      <p className="text-xs text-amber-300/90 mt-0.5">สาระ: {loc.relevance}</p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                      <span className="text-xs text-slate-400">
                        ติดต่อ: {loc.contact}
                      </span>
                      {userEmail.trim().toLowerCase() === ADMIN_TARGET_EMAIL.toLowerCase() && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Admin: ต้องการลบแหล่งเรียนรู้ "${loc.name}" ใช่หรือไม่?`)) {
                              setExternalLocationsList(prev => prev.filter(item => item.id !== loc.id));
                            }
                          }}
                          className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors"
                          title="Admin: ลบแหล่งเรียนรู้นี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModalId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: คลังไอเดีย (IDEA) (รวมเว็บการศึกษา วิจัย คลังข้อสอบ เพจเฟซบุ๊ก Canva AI อัปเดตทุกวัน) */}
      {activeModalId === 'btn-6' && (
        <IdeaBankModal 
          userEmail={userEmail}
          onClose={() => setActiveModalId(null)} 
        />
      )}

      {/* Modal 7: ส่งสื่อเข้าประกวด (ปุ่มนี้ไม่ต้องใส่หมายเลข และด้านในให้ว่างไว้ตามสั่ง) */}
      {activeModalId === 'btn-7' && (
        <div
          id="modal-contest-submission"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModalId(null);
          }}
        >
          <div className="relative w-full max-w-3xl bg-slate-900 border border-rose-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[360px]">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-rose-900/60 via-pink-900/50 to-slate-900 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-400/40 flex items-center justify-center text-rose-300">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">ส่งสื่อเข้าประกวด</h3>
                  <p className="text-xs text-slate-300">
                    งานพัฒนาสื่อและนวัตกรรมการเรียนรู้ โรงเรียนอัสสัมชัญอุบลราชธานี
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalId(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content: Empty inside as requested (ด้านในว่างไว้) */}
            <div className="p-8 sm:p-16 flex-grow flex flex-col items-center justify-center text-center">
              {/* Intentionally kept blank/empty per user requirement */}
            </div>

            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModalId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full User Profile Modal (Cross-device synced) */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userEmail={userEmail}
        userName={profile?.fullName || profile?.displayName || userEmail}
        avatarUrl={avatarSrc}
        currentUserEmail={userEmail}
        onAvatarUpdated={(newAvatar) => {
          if (profile) {
            setProfile(prev => prev ? { ...prev, avatarUrl: newAvatar } : null);
          }
        }}
        onProfileUpdated={(updated) => {
          setProfile(updated);
        }}
      />

      {/* Admin Quick Action Modals (เฉพาะ Admin: weerapong1625@acu.ac.th) */}
      {userEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && (
        <>
          <AdminUserManagementModal
            isOpen={showUserManagementModal}
            onClose={() => setShowUserManagementModal(false)}
            adminEmail={SUPER_ADMIN_EMAIL}
            onOpenEmailAudit={() => {
              setShowUserManagementModal(false);
              setShowEmailAuditModal(true);
            }}
          />

          <AdminEmailAuditModal
            isOpen={showEmailAuditModal}
            onClose={() => setShowEmailAuditModal(false)}
            adminEmail={SUPER_ADMIN_EMAIL}
          />
        </>
      )}
    </div>
  );
};
