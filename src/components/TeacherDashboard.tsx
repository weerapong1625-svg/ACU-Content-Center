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
  Send 
} from 'lucide-react';

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
      badge: 'คลังสื่อคุณครู ACU',
      description: 'รวบรวมสื่อการสอน คลิปวิดีโอ ใบงาน ปฏิสัมพันธ์ และผลงานที่คณะครูผลิตขึ้น',
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
      badge: 'พื้นที่แลกเปลี่ยนไอเดียสร้างสรรค์',
      description: 'พื้นที่ระดมความคิดและแบ่งปันไอเดียการจัดกิจกรรมการเรียนรู้แบบ Active Learning',
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
      title: 'ศูนย์ประสานงาน & คู่มือการใช้งาน',
      badge: 'บริการข้อมูลและช่วยเหลือ',
      description: 'แนวปฏิบัติ การติดต่อฝ่ายวิชาการและนวัตกรรมการเรียนรู้ ดาวน์โหลดแบบฟอร์ม และข้อเสนอแนะ',
      icon: HelpCircle,
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
              <SchoolLogo size="md" />
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

          {/* มุมขวาบนอย่างสมมาตร: คำว่า "ระบบคลังสื่อ และนวัตกรรมการเรียนรู้" */}
          <div className="w-full md:w-auto flex flex-col sm:flex-row items-center md:items-end justify-between md:justify-end gap-3">
            <div
              id="top-right-symmetric-title-box"
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-purple-950/70 to-slate-900/90 border border-indigo-400/40 shadow-[0_4px_20px_rgba(79,70,229,0.25)] backdrop-blur-md flex items-center gap-2.5"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
              <span className="font-['Prompt',sans-serif] font-bold text-sm sm:text-base md:text-lg text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-purple-200 tracking-wide select-none drop-shadow">
                ระบบคลังสื่อ และนวัตกรรมการเรียนรู้
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

      {/* Modal 1: ส่งสื่อ/นวัตกรรม 5 ชิ้น */}
      {activeModalId === 'btn-1' && (
        <div
          id="modal-innovation-5-items"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModalId(null);
          }}
        >
          <div className="relative w-full max-w-4xl bg-slate-900 border border-indigo-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-blue-900/60 via-indigo-900/50 to-slate-900 border-b border-indigo-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    1. ส่งสื่อ/นวัตกรรม 5 ชิ้น
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                      เป้าหมายครูผู้สอน
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    ติดตามและจัดการสื่อนวัตกรรมการจัดการเรียนรู้ประจำปีการศึกษาให้ครบ 5 ชิ้น
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

            {/* List of 5 Innovation Items */}
            <div className="p-5 overflow-y-auto space-y-3.5 flex-grow">
              {(profile?.innovations || []).map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-indigo-400/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      {item.id}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>
                      {item.notes && <p className="text-xs text-indigo-300/90 mt-1 italic">{item.notes}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                        item.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : item.status === 'submitted'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {item.status === 'approved' ? '✓ อนุมัติแล้ว' : item.status === 'submitted' ? 'ส่งแล้ว' : 'รอจัดส่ง'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModalId(null);
                        setIsProfileModalOpen(true);
                      }}
                      className="px-3 py-1 rounded-xl bg-slate-700 hover:bg-indigo-600 text-white text-xs font-medium transition-colors"
                    >
                      แก้ไข/แนบลิงก์
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveModalId(null);
                  setIsProfileModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
              >
                เปิดหน้าจัดการสื่อ 5 ชิ้นแบบละเอียดในโปรไฟล์
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: ศึกษาเกณฑ์/ประเภทสื่อ */}
      {activeModalId === 'btn-2' && (
        <div
          id="modal-criteria-guide"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModalId(null);
          }}
        >
          <div className="relative w-full max-w-4xl bg-slate-900 border border-sky-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-sky-900/60 via-blue-900/50 to-slate-900 border-b border-sky-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600/30 border border-sky-400/40 flex items-center justify-center text-sky-300">
                  <BookOpenCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">2. ศึกษาเกณฑ์/ประเภทสื่อและนวัตกรรม</h3>
                  <p className="text-xs text-slate-300">
                    เกณฑ์มาตรฐานฝ่ายวิชาการ โรงเรียนอัสสัมชัญอุบลราชธานี
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

            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-sky-500/30">
                  <h4 className="font-bold text-white text-base mb-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    ประเภทที่ 1: สื่อมัลติมีเดียและดิจิทัล
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs">
                    <li>วิดีโอคลิปการสอนความละเอียดสูง (อย่างน้อย 1080p)</li>
                    <li>บทเรียนปฏิสัมพันธ์ (Interactive E-Learning / SCORM)</li>
                    <li>แอปพลิเคชันหรือแพลตฟอร์มการเรียนรู้ที่ครูพัฒนาขึ้น</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/80 border border-sky-500/30">
                  <h4 className="font-bold text-white text-base mb-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    ประเภทที่ 2: แผนการสอนและชุดนวัตกรรมเชิงรุก
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs">
                    <li>แผนการจัดการเรียนรู้ Active Learning อิงสมรรถนะ</li>
                    <li>ชุดใบงาน ใบความรู้ และเครื่องมือการประเมินสภาพจริง</li>
                    <li>คู่มือการใช้สื่อนวัตกรรมที่มีขั้นตอนชัดเจน</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/80 border border-sky-500/30">
                  <h4 className="font-bold text-white text-base mb-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    ประเภทที่ 3: สื่อนวัตกรรมเกมจำลอง (Gamification)
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs">
                    <li>บอร์ดเกมการศึกษาและเกมสถานการณ์จำลอง</li>
                    <li>ชุดปฏิบัติการและโมเดลสามมิติเพื่อการอธิบายมโนทัศน์</li>
                    <li>แบบจำลองเสมือนจริง (VR / AR Simulations)</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/80 border border-sky-500/30">
                  <h4 className="font-bold text-white text-base mb-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    ประเภทที่ 4: รายงานวิจัยและผลสัมฤทธิ์นวัตกรรม
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs">
                    <li>รายงานการวิจัยในชั้นเรียน (Classroom Action Research)</li>
                    <li>การเปรียบเทียบผลสัมฤทธิ์ก่อน-หลังใช้นวัตกรรม</li>
                    <li>ผลการประเมินความพึงพอใจและข้อเสนอแนะในการพัฒนาต่อยอด</li>
                  </ul>
                </div>
              </div>

              {/* Rubric Table */}
              <div className="mt-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <h4 className="font-bold text-white mb-2">เกณฑ์การประเมินคุณภาพ (Rubric Scores)</h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-slate-800 font-semibold text-slate-200">
                    ความถูกต้องทางวิชาการ (30%)
                  </div>
                  <div className="p-2 rounded-xl bg-slate-800 font-semibold text-slate-200">
                    ความคิดสร้างสรรค์/แปลกใหม่ (25%)
                  </div>
                  <div className="p-2 rounded-xl bg-slate-800 font-semibold text-slate-200">
                    ประสิทธิภาพและการนำไปใช้จริง (25%)
                  </div>
                  <div className="p-2 rounded-xl bg-slate-800 font-semibold text-slate-200">
                    ผลสัมฤทธิ์ของผู้เรียน (20%)
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModalId(null)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                เข้าใจแล้ว / ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: คลังสื่อคุณครูผลิตเอง */}
      {activeModalId === 'btn-3' && (
        <div
          id="modal-teacher-media-repo"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModalId(null);
          }}
        >
          <div className="relative w-full max-w-4xl bg-slate-900 border border-purple-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-purple-900/60 via-violet-900/50 to-slate-900 border-b border-purple-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
                  <FolderArchive className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">3. คลังสื่อคุณครูผลิตเอง</h3>
                  <p className="text-xs text-slate-300">
                    คลังรวมสื่อการเรียนรู้ วิดีโอคลิป และเอกสารที่ครู ACU ร่วมกันสร้างสรรค์
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

            {/* Filter bar */}
            <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อสื่อ หรือครูผู้ผลิต..."
                  value={searchMedia}
                  onChange={(e) => setSearchMedia(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                {['all', 'มัธยมศึกษา', 'ประถมศึกษา', 'ปฐมวัย', 'สะเต็มศึกษา'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedCategoryFilter === cat
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {cat === 'all' ? 'ทั้งหมด' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Repository Cards */}
            <div className="p-5 overflow-y-auto space-y-3">
              {[
                { title: 'ชุดการเรียนรู้เรื่อง พันธุศาสตร์และ DNA ผ่านภาพจำลอง 3D', author: 'ม.วีระพงศ์ คำสอน', level: 'มัธยมศึกษา', views: 320, downloads: 88, format: 'วิดีโอ & สไลด์' },
                { title: 'แบบฝึกหัดคำศัพท์ภาษาอังกฤษสะเต็ม (STEM Vocabulary Challenge)', author: 'มิสรัตนาภรณ์ แสนแก้ว', level: 'มัธยมศึกษา', views: 245, downloads: 110, format: 'Interactive PDF' },
                { title: 'นิทานบูรณาการคณิตศาสตร์และคุณธรรมสำหรับเด็กปฐมวัย', author: 'มิสกานดา รุ่งเรือง', level: 'ปฐมวัย', views: 198, downloads: 74, format: 'E-Book สีสันสดใส' },
                { title: 'คู่มือทดลองเคมีในครัวเรือน (Green Chemistry Lab)', author: 'ม.ประสิทธิ์ โคตรพงษ์', level: 'มัธยมศึกษา', views: 412, downloads: 156, format: 'คู่มือปฏิบัติการ' },
              ].map((m, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-purple-400/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div>
                    <h4 className="font-bold text-white text-sm">{m.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ผู้ผลิต: <strong className="text-purple-300">{m.author}</strong> • ระดับชั้น: {m.level} • รูปแบบ: {m.format}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">เข้าชม {m.views} ครั้ง</span>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>เปิดดูสื่อ</span>
                    </button>
                  </div>
                </div>
              ))}
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

      {/* Modal 4: บันทึกแหล่งเรียนรู้ภายในโรงเรียนอัสสัมชัญอุบลราชธานี */}
      {activeModalId === 'btn-4' && (
        <div
          id="modal-internal-learning-centers"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModalId(null);
          }}
        >
          <div className="relative w-full max-w-4xl bg-slate-900 border border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-emerald-900/60 via-teal-900/50 to-slate-900 border-b border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                  <School className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">4. บันทึกแหล่งเรียนรู้ภายในโรงเรียนอัสสัมชัญอุบลราชธานี</h3>
                  <p className="text-xs text-slate-300">
                    บันทึกและสืบค้นห้องปฏิบัติการ ศูนย์การเรียนรู้ และมุมสาระภายในโรงเรียน (On-Campus)
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

            {/* Content: Form to add + List */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Add form */}
              <form onSubmit={handleAddInternal} className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30">
                <h4 className="text-sm font-bold text-emerald-300 mb-3 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  เพิ่มแหล่งเรียนรู้ภายในโรงเรียนใหม่
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-300 block mb-1">ชื่อแหล่งเรียนรู้ / ห้องปฏิบัติการ</label>
                    <input
                      type="text"
                      placeholder="เช่น ห้องดาราศาสตร์และสำรวจอวกาศ"
                      value={newInternalLocation.name}
                      onChange={(e) => setNewInternalLocation(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">อาคาร / ชั้น / พิกัดสถานที่</label>
                    <input
                      type="text"
                      placeholder="เช่น อาคารเฉลิมพระเกียรติ ชั้น 4"
                      value={newInternalLocation.zone}
                      onChange={(e) => setNewInternalLocation(prev => ({ ...prev, zone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">วัตถุประสงค์และสาระการเรียนรู้</label>
                    <input
                      type="text"
                      placeholder="เช่น การสังเกตปรากฏการณ์บนท้องฟ้า"
                      value={newInternalLocation.purpose}
                      onChange={(e) => setNewInternalLocation(prev => ({ ...prev, purpose: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">ความจุผู้เรียน</label>
                    <input
                      type="text"
                      placeholder="เช่น 40-50 คน"
                      value={newInternalLocation.capacity}
                      onChange={(e) => setNewInternalLocation(prev => ({ ...prev, capacity: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors"
                  >
                    + บันทึกข้อมูลแหล่งเรียนรู้
                  </button>
                </div>
              </form>

              {/* Registered List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  รายการแหล่งเรียนรู้ภายในที่บันทึกแล้ว ({internalLocationsList.length} แห่ง)
                </h4>
                {internalLocationsList.map((loc) => (
                  <div key={loc.id} className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <h5 className="font-bold text-white text-sm">{loc.name}</h5>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {loc.zone}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{loc.purpose}</p>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      รองรับ: {loc.capacity}
                    </span>
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
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      ติดต่อ: {loc.contact}
                    </span>
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

      {/* Modal 6: คลังไอเดีย (IDEA) */}
      {activeModalId === 'btn-6' && (
        <div
          id="modal-idea-bank"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModalId(null);
          }}
        >
          <div className="relative w-full max-w-4xl bg-slate-900 border border-yellow-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-yellow-900/60 via-amber-900/50 to-slate-900 border-b border-yellow-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-600/30 border border-yellow-400/40 flex items-center justify-center text-yellow-300">
                  <Lightbulb className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">6. คลังไอเดีย (IDEA)</h3>
                  <p className="text-xs text-slate-300">
                    พื้นที่ระดมและแบ่งปันไอเดียสร้างสรรค์การจัดการเรียนรู้สำหรับครู ACU
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
              {/* Form to submit Idea */}
              <form onSubmit={handleAddIdea} className="p-4 rounded-2xl bg-yellow-950/20 border border-yellow-500/30">
                <h4 className="text-sm font-bold text-yellow-300 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  แบ่งปันไอเดียการสอนใหม่ (Share IDEA)
                </h4>
                <div className="space-y-2 text-xs">
                  <input
                    type="text"
                    placeholder="หัวข้อไอเดียการสอน เช่น เทคนิคการใช้สถานการณ์จริงกระตุ้นความอยากรู้..."
                    value={newIdeaTitle}
                    onChange={(e) => setNewIdeaTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-yellow-400"
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={newIdeaCategory}
                      onChange={(e) => setNewIdeaCategory(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
                    >
                      <option value="เทคนิคการสอนเชิงรุก (Active Learning)">เทคนิคการสอนเชิงรุก (Active Learning)</option>
                      <option value="เทคโนโลยีดิจิทัล & AI">เทคโนโลยีดิจิทัล & AI</option>
                      <option value="Gamification & สื่อสร้างสรรค์">Gamification & สื่อสร้างสรรค์</option>
                      <option value="การวัดผลประเมินผล">การวัดผลประเมินผล</option>
                    </select>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-slate-900 font-bold text-xs shadow-md transition-colors"
                    >
                      + โพสต์ไอเดียสู่คลัง
                    </button>
                  </div>
                </div>
              </form>

              {/* Ideas List */}
              <div className="space-y-3">
                {ideasList.map((idea) => (
                  <div key={idea.id} className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                          {idea.category}
                        </span>
                        <span className="text-[11px] text-slate-400">{idea.date}</span>
                      </div>
                      <h4 className="font-bold text-white text-sm mt-1">{idea.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">แบ่งปันโดย: <strong className="text-slate-300">{idea.teacher}</strong></p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIdeasList(prev => prev.map(item => item.id === idea.id ? { ...item, likes: item.likes + 1 } : item));
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700/80 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-xs font-semibold transition-colors"
                    >
                      <Star className="w-3.5 h-3.5 fill-yellow-400" />
                      <span>{idea.likes} ชื่นชอบ</span>
                    </button>
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

      {/* Modal 7: ศูนย์ประสานงาน & คู่มือการใช้งาน (ปุ่มนี้ไม่ต้องใส่หมายเลข) */}
      {activeModalId === 'btn-7' && (
        <div
          id="modal-help-and-guidance"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModalId(null);
          }}
        >
          <div className="relative w-full max-w-4xl bg-slate-900 border border-rose-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-rose-900/60 via-red-900/50 to-slate-900 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-400/40 flex items-center justify-center text-rose-300">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">ศูนย์ประสานงาน & คู่มือการใช้งาน</h3>
                  <p className="text-xs text-slate-300">
                    คำแนะนำการใช้งานระบบ และการติดต่อประสานงานฝ่ายวิชาการและนวัตกรรม
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

            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-300">
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
                <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-rose-400" />
                  ขั้นตอนการส่งสื่อนวัตกรรมประจำภาคเรียน
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-xs">
                  <li>ตรวจสอบรายการสื่อ 5 ชิ้นในปุ่มที่ 1 หรือในหน้าโปรไฟล์ของคุณ</li>
                  <li>จัดเตรียมไฟล์ หรือ Google Drive ลิงก์ที่เปิดสิทธิ์ให้อาจารย์ฝ่ายวิชาการเข้าถึงได้</li>
                  <li>กดปุ่ม &quot;แก้ไข/แนบลิงก์&quot; เพื่อกรอก URL สื่อ หรือแนบไฟล์ให้เรียบร้อย</li>
                  <li>ฝ่ายวิชาการจะดำเนินการตรวจประเมินตามเกณฑ์ในปุ่มที่ 2 และแจ้งสถานะอนุมัติอัตโนมัติ</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
                  <h4 className="font-bold text-white mb-1">ติดต่อฝ่ายวิชาการและนวัตกรรมการเรียนรู้</h4>
                  <p className="text-xs text-slate-300">โรงเรียนอัสสัมชัญอุบลราชธานี</p>
                  <p className="text-xs text-slate-400 mt-2">
                    โทรศัพท์: 045-284-444 ต่อ ฝ่ายวิชาการ<br />
                    อีเมล: academic@acu.ac.th
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
                  <h4 className="font-bold text-white mb-1">เวลาทำการระบบสนับสนุน</h4>
                  <p className="text-xs text-slate-300">
                    วันจันทร์ - วันศุกร์: 07:30 - 16:30 น.<br />
                    วันเสาร์ (กิจกรรมวิชาการ): 08:30 - 12:00 น.
                  </p>
                </div>
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

      {/* Full User Profile Modal (Cross-device synced) */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userEmail={userEmail}
        userName={profile?.fullName || profile?.displayName || userEmail}
        avatarUrl={avatarSrc}
        onAvatarUpdated={(newAvatar) => {
          if (profile) {
            setProfile(prev => prev ? { ...prev, avatarUrl: newAvatar } : null);
          }
        }}
        onProfileUpdated={(updated) => {
          setProfile(updated);
        }}
      />
    </div>
  );
};
