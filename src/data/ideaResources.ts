import ideaPortalStemImg from '../assets/images/idea_portal_stem_1795006423985.jpg';
import ideaAiClassroomImg from '../assets/images/idea_ai_classroom_1795006424450.jpg';
import ideaResearchLibraryImg from '../assets/images/idea_research_library_1795006424373.jpg';
import ideaExamAnalyticsImg from '../assets/images/idea_exam_analytics_1795006425134.jpg';
import ideaTeacherCommunityImg from '../assets/images/idea_teacher_community_1795006425639.jpg';

export interface PortalPreviewTheme {
  headerBg: string;
  accentBg: string;
  navItems: string[];
  heroTitle: string;
  heroSub: string;
}

export interface IdeaResource {
  id: string;
  category: 'official_portal' | 'manual_guide' | 'research' | 'exams' | 'facebook' | 'education' | 'canva_ai' | 'resource_share';
  categoryLabel: string;
  title: string;
  description: string;
  url: string;
  previewImage?: string;
  portalTheme?: PortalPreviewTheme;
  tags: string[];
  recommendedBadge?: string;
  featuredDaily?: boolean;
  isOfficialCore?: boolean;
}

export const IDEA_CATEGORIES = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'official_portal', label: '🏛️ คลังความรู้ & พอร์ทัลหลัก' },
  { id: 'manual_guide', label: '✨ เครื่องมือ AI & สื่อการสอนเชิงโต้ตอบ' },
  { id: 'research', label: '📚 วิจัย วิทยานิพนธ์ & วารสาร' },
  { id: 'exams', label: '📝 คลังข้อสอบ & เกณฑ์ประเมิน' },
  { id: 'facebook', label: '👥 ชุมชนครู & แหล่งแชร์ไอเดีย' },
] as const;

export function getIdeaFallbackImage(category: string): string {
  switch (category) {
    case 'manual_guide':
    case 'canva_ai':
      return ideaAiClassroomImg;
    case 'research':
      return ideaResearchLibraryImg;
    case 'exams':
      return ideaExamAnalyticsImg;
    case 'facebook':
    case 'community':
      return ideaTeacherCommunityImg;
    case 'official_portal':
    case 'education':
    case 'resource_share':
    default:
      return ideaPortalStemImg;
  }
}

export function getIdeaPreviewImage(category: string, customImageUrl?: string): string {
  const trimmed = (customImageUrl || '').trim();
  if (
    trimmed &&
    (trimmed.startsWith('/previews/') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('data:image/'))
  ) {
    return trimmed;
  }
  return getIdeaFallbackImage(category);
}

export function getLiveWebsiteScreenshotUrl(url?: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return '';
  return `https://image.thum.io/get/width/800/crop/450/noanimate/${trimmed}`;
}

export function extractIdeaDomain(rawUrl?: string): string {
  const urlStr = (rawUrl || '').trim();
  if (!urlStr || urlStr === '#') return '';
  try {
    const normalized =
      urlStr.startsWith('http://') || urlStr.startsWith('https://') ? urlStr : `https://${urlStr}`;
    const parsed = new URL(normalized);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export function getIdeaFaviconUrl(rawUrl?: string): string {
  const domain = extractIdeaDomain(rawUrl);
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export function isBareFacebookUrl(rawUrl?: string): boolean {
  const val = (rawUrl || '').trim().toLowerCase();
  if (!val) return false;
  return (
    /^https?:\/\/(www\.|m\.|web\.)?facebook\.com\/?(\?.*)?$/.test(val) ||
    /^https?:\/\/fb\.com\/?$/.test(val)
  );
}

export function matchSeedPreviewByUrl(url?: string): { previewImage?: string; portalTheme?: PortalPreviewTheme } {
  const domain = extractIdeaDomain(url).toLowerCase();
  if (!domain) return {};
  const match = IDEA_RESOURCES.find((r) => extractIdeaDomain(r.url).toLowerCase() === domain);
  if (!match) return {};
  return {
    previewImage: match.previewImage,
    portalTheme: match.portalTheme,
  };
}

export const IDEA_RESOURCES: IdeaResource[] = [
  // =========================================================================
  // 1. คลังความรู้ & พอร์ทัลหลักทางการ (Official Knowledge Portals)
  // =========================================================================
  {
    id: 'core-01-scimath',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'SciMath คลังความรู้ สสวท.',
    description: 'แหล่งรวมสื่อวิทย์-คณิต-เทคโนโลยีระดับชาติ ค้นหาแผนการสอน วิดีโอ และ E-Book สสวท. ฟรีครบทุกช่วงชั้น',
    url: 'https://www.scimath.org/',
    previewImage: '/previews/core-01-scimath.png',
    tags: ['SciMath', 'สสวท.', 'วิทยาศาสตร์', 'STEM'],
    recommendedBadge: 'เว็บหลัก สสวท.',
    featuredDaily: true,
    isOfficialCore: true,
  },
  {
    id: 'core-03-obec',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'OBEC Content Center (คลังสื่อ สพฐ.)',
    description: 'คลังสื่ออิเล็กทรอนิกส์กลางของ สพฐ. ดาวน์โหลด E-Book แผนจัดการเรียนรู้ และสื่อดิจิทัลมาตรฐานกระทรวงฯ',
    url: 'https://contentcenter.obec.go.th/',
    portalTheme: {
      headerBg: 'from-sky-700 via-blue-800 to-indigo-900',
      accentBg: 'bg-sky-400',
      navItems: ['หน้าแรก', 'คลังสื่อ E-Book', 'วิดีโอสอน', 'แอปพลิเคชัน'],
      heroTitle: 'OBEC Content Center',
      heroSub: 'คลังเนื้อหาอิเล็กทรอนิกส์ สพฐ. ครบทุกกลุ่มสาระ',
    },
    tags: ['OBEC', 'สพฐ.', 'E-Book', 'แผนการสอน'],
    recommendedBadge: 'คลังสื่อกลาง สพฐ.',
    featuredDaily: true,
    isOfficialCore: true,
  },
  {
    id: 'core-04-opec',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน (สช.)',
    description: 'ศูนย์รวมระเบียบ แนวทางพัฒนาหลักสูตร ประกันคุณภาพ และโครงการอบรมสำหรับครูโรงเรียนเอกชน',
    url: 'https://opec.go.th/',
    portalTheme: {
      headerBg: 'from-cyan-800 via-teal-800 to-slate-900',
      accentBg: 'bg-amber-400',
      navItems: ['หน้าหลัก สช.', 'ประกาศ/ระเบียบ', 'พัฒนาครู', 'บริการ E-Service'],
      heroTitle: 'OPEC · สช.',
      heroSub: 'สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน',
    },
    tags: ['สช.', 'OPEC', 'การศึกษาเอกชน', 'พัฒนาครู'],
    recommendedBadge: 'เว็บไซต์หลัก สช.',
    featuredDaily: true,
    isOfficialCore: true,
  },
  {
    id: 'edu-04-dltv',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'DLTV (แผนการสอน ใบงาน และสไลด์ฟรี)',
    description: 'ดาวน์โหลดแผนการสอน ใบงาน PDF และสไลด์ PowerPoint สำเร็จรูปพร้อมใช้ ตั้งแต่ระดับอนุบาลถึงมัธยมศึกษา',
    url: 'https://www.dltv.ac.th/',
    previewImage: '/previews/edu-04-dltv.png',
    tags: ['DLTV', 'ใบงานฟรี', 'แผนการสอน', 'PowerPoint'],
    recommendedBadge: 'ดาวน์โหลดใบงานฟรี',
    featuredDaily: true,
  },
  {
    id: 'edu-02-ipst',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'IPST Learning Space (แพลตฟอร์มดิจิทัล สสวท.)',
    description: 'รวมระบบเรียนออนไลน์ สื่อ AR/VR การทดลองเสมือน และคอร์สอบรมพัฒนาครูวิทยาศาสตร์-คณิตศาสตร์',
    url: 'https://learningspace.ipst.ac.th/',
    previewImage: '/previews/edu-02-ipst.png',
    tags: ['สสวท.', 'สื่อ AR/VR', 'คอร์สครู', 'สะเต็ม'],
    recommendedBadge: 'ทางการ สสวท.',
  },
  {
    id: 'edu-05-proj14',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'Project 14 สสวท. (คลังวิดีโอการสอน ป.1–ม.6)',
    description: 'วิดีโออธิบายบทเรียนคณิต-วิทย์-เทคโนโลยี เรียงตามตัวชี้วัด เปิดประกอบการสอนหรือทบทวนได้ทันที',
    url: 'https://proj14.ipst.ac.th/',
    previewImage: '/previews/edu-05-proj14.png',
    tags: ['Project 14', 'สสวท.', 'วิดีโอสอน', 'ป.1-ม.6'],
    recommendedBadge: 'คลิปสอนเรียงตามบท',
  },
  {
    id: 'edu-03-tkpark',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'TK Public Online Library (ห้องสมุดดิจิทัลฟรี)',
    description: 'ยืมอ่าน E-Book หนังสือเด็ก วรรณกรรม และหนังสือพัฒนาทักษะการสอนออนไลน์ฟรีทั่วประเทศ',
    url: 'https://www.tkpark.or.th/',
    previewImage: '/previews/edu-03-tkpark.png',
    tags: ['TK Park', 'E-Book', 'ห้องสมุดดิจิทัล', 'อ่านฟรี'],
  },
  {
    id: 'edu-01-dlit',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'DLIT สพฐ. (คลังสื่อการเรียนรู้ออนไลน์ 8 กลุ่มสาระ)',
    description: 'คลังคลิปการสอนจากครูต้นแบบ แผนการจัดการเรียนรู้ และทรัพยากรการสอนครบทุกกลุ่มสาระของ สพฐ.',
    url: 'https://www.dlit.ac.th/',
    portalTheme: {
      headerBg: 'from-orange-700 via-amber-700 to-slate-900',
      accentBg: 'bg-orange-400',
      navItems: ['DLIT Classroom', 'DLIT Library', 'DLIT Resources', 'PLC'],
      heroTitle: 'DLIT OBEC',
      heroSub: 'เทคโนโลยีสารสนเทศเพื่อการศึกษาทางไกล สพฐ.',
    },
    tags: ['DLIT', 'สพฐ.', 'ทุกกลุ่มสาระ', 'ครูต้นแบบ'],
    recommendedBadge: 'คลังสื่อ 8 กลุ่มสาระ',
  },

  // =========================================================================
  // 2. เครื่องมือ AI & สื่อการสอนเชิงโต้ตอบ (AI, Simulations & Classroom Games)
  // =========================================================================
  {
    id: 'core-02-ai-moe',
    category: 'manual_guide',
    categoryLabel: 'เครื่องมือ AI & สื่อการสอนเชิงโต้ตอบ',
    title: 'กระทรวงศึกษาธิการ (ศธ.) — นโยบายและคู่มือ AI การศึกษา',
    description: 'ติดตามประกาศหลักสูตร คู่มือการใช้ AI อย่างปลอดภัยในห้องเรียน และแนวทางพัฒนาสมรรถนะครูไทย',
    url: 'https://www.moe.go.th/',
    portalTheme: {
      headerBg: 'from-emerald-800 via-teal-900 to-slate-950',
      accentBg: 'bg-emerald-400',
      navItems: ['หน้าหลัก ศธ.', 'นโยบายการศึกษา', 'คลัง E-Book', 'ข่าวประชาสัมพันธ์'],
      heroTitle: 'กระทรวงศึกษาธิการ (ศธ.)',
      heroSub: 'Ministry of Education Thailand · คู่มือและนโยบายครู',
    },
    tags: ['AI การศึกษา', 'คู่มือครู', 'ศธ.', 'นโยบาย'],
    recommendedBadge: 'เว็บไซต์หลัก ศธ.',
    featuredDaily: true,
    isOfficialCore: true,
  },
  {
    id: 'tool-01-wordwall',
    category: 'manual_guide',
    categoryLabel: 'เครื่องมือ AI & สื่อการสอนเชิงโต้ตอบ',
    title: 'Wordwall (สร้างเกมการสอน & แบบทดสอบใน 1 นาที)',
    description: 'เปลี่ยนคำถามธรรมดาเป็นเกมจับคู่ วงล้อสุ่ม ควิซแข่งเวลา และใบงานพิมพ์แจก มีคลังเกมสำเร็จรูปกว่า 30 ล้านชิ้น',
    url: 'https://wordwall.net/',
    previewImage: '/previews/tool-01-wordwall.png',
    tags: ['Wordwall', 'เกมการสอน', 'Active Learning', 'ควิซ'],
    recommendedBadge: 'ครูนิยมใช้อันดับ 1',
    featuredDaily: true,
  },
  {
    id: 'guide-05-phet',
    category: 'manual_guide',
    categoryLabel: 'เครื่องมือ AI & สื่อการสอนเชิงโต้ตอบ',
    title: 'PhET Interactive Simulations (ห้องทดลองเสมือนจริง ภาษาไทย)',
    description: 'จำลองการทดลองฟิสิกส์ เคมี ชีววิทยา และคณิตศาสตร์แบบ Interactive ให้นักเรียนลองปรับค่าได้จริงบนหน้าจอ',
    url: 'https://phet.colorado.edu/th/',
    previewImage: '/previews/guide-05-phet.png',
    tags: ['PhET', 'ห้องทดลองเสมือน', 'STEM', 'ภาษาไทย'],
    recommendedBadge: 'ทดลองเสมือนฟรี',
    featuredDaily: true,
  },
  {
    id: 'tool-03-geogebra',
    category: 'manual_guide',
    categoryLabel: 'เครื่องมือ AI & สื่อการสอนเชิงโต้ตอบ',
    title: 'GeoGebra (สื่อคณิตศาสตร์ 2D/3D โต้ตอบฟรี)',
    description: 'วาดกราฟ เรขาคณิต 3 มิติ สถิติ และแคลคูลัสแบบขยับตัวแปรโชว์หน้าชั้นเรียน ช่วยให้เด็กเห็นภาพคณิตศาสตร์ชัดขึ้น',
    url: 'https://www.geogebra.org/',
    previewImage: '/previews/tool-03-geogebra.png',
    tags: ['GeoGebra', 'คณิตศาสตร์', 'กราฟ 3D', 'สื่อโต้ตอบ'],
    recommendedBadge: 'เครื่องมือคณิตศาสตร์ฟรี',
  },
  {
    id: 'guide-04-canva-edu',
    category: 'manual_guide',
    categoryLabel: 'เครื่องมือ AI & สื่อการสอนเชิงโต้ตอบ',
    title: 'Canva for Education (AI สร้างสไลด์ & ใบงานฟรีสำหรับครู)',
    description: 'ปลดล็อกเทมเพลตสไลด์ ใบงาน อินโฟกราฟิก และ Magic Studio AI ช่วยร่างบทเรียน-แต่งภาพประกอบฟรีสำหรับครู',
    url: 'https://www.canva.com/th_th/education/',
    portalTheme: {
      headerBg: 'from-cyan-600 via-blue-600 to-violet-700',
      accentBg: 'bg-cyan-300',
      navItems: ['เทมเพลตสื่อ', 'Magic Studio AI', 'ไวท์บอร์ดห้องเรียน', 'สำหรับครู'],
      heroTitle: 'Canva for Education',
      heroSub: 'ออกแบบสไลด์ ใบงาน และสื่อ AI ฟรี 100% สำหรับครู',
    },
    tags: ['Canva Edu', 'AI สร้างสื่อ', 'ใบงาน', 'สไลด์สอน'],
    recommendedBadge: 'ใช้ฟรีสำหรับครู',
    featuredDaily: true,
  },
  {
    id: 'guide-03-active',
    category: 'manual_guide',
    categoryLabel: 'เครื่องมือ AI & สื่อการสอนเชิงโต้ตอบ',
    title: 'สพฐ. (OBEC) — แนวทาง Active Learning & โครงการพัฒนาครู',
    description: 'เว็บไซต์หลักสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน รวมประกาศ E-Service และแนวทางจัดการเรียนรู้เชิงรุก',
    url: 'https://www.obec.go.th/',
    previewImage: '/previews/guide-03-active.png',
    tags: ['สพฐ.', 'OBEC', 'Active Learning', 'E-Service'],
  },
  {
    id: 'guide-02-wpa',
    category: 'manual_guide',
    categoryLabel: 'เครื่องมือ AI & สื่อการสอนเชิงโต้ตอบ',
    title: 'สำนักงาน ก.ค.ศ. (คู่มือวิทยฐานะ ว.PA & PA)',
    description: 'หลักเกณฑ์และแบบฟอร์มข้อตกลงพัฒนางาน (PA) แนวทางเขียนแผนการสอนและประเมินคลิปการสอนตามเกณฑ์ล่าสุด',
    url: 'https://otepc.go.th/',
    portalTheme: {
      headerBg: 'from-indigo-800 via-blue-900 to-slate-950',
      accentBg: 'bg-amber-400',
      navItems: ['ระบบ DPA', 'หลักเกณฑ์ ว.PA', 'หนังสือเวียน', 'คู่มือประเมิน'],
      heroTitle: 'สำนักงาน ก.ค.ศ. (OTEPC)',
      heroSub: 'เกณฑ์วิทยฐานะ ว.PA และแนวทางการพัฒนางานครู',
    },
    tags: ['ก.ค.ศ.', 'ว.PA', 'วิทยฐานะ', 'DPA'],
    recommendedBadge: 'เกณฑ์ทางการ ก.ค.ศ.',
  },

  // =========================================================================
  // 3. วิจัย วิทยานิพนธ์ & วารสารวิชาการ (Research & Journals)
  // =========================================================================
  {
    id: 'core-05-tdc',
    category: 'research',
    categoryLabel: 'วิจัย & วารสารวิชาการ',
    title: 'TDC ThaiLIS (คลังวิทยานิพนธ์ & วิจัยฉบับเต็ม)',
    description: 'ค้นหาและดาวน์โหลดไฟล์ Full-Text วิทยานิพนธ์และงานวิจัยในชั้นเรียนจากมหาวิทยาลัยทั่วไทยเพื่อใช้อ้างอิง',
    url: 'https://tdc.thailis.or.th/tdc/basic.php',
    portalTheme: {
      headerBg: 'from-violet-900 via-indigo-900 to-slate-950',
      accentBg: 'bg-violet-400',
      navItems: ['สืบค้นพื้นฐาน', 'สืบค้นขั้นสูง', 'วิทยานิพนธ์', 'รายงานวิจัย'],
      heroTitle: 'TDC · ThaiLIS',
      heroSub: 'ฐานข้อมูลวิทยานิพนธ์และงานวิจัยฉบับเต็มระดับชาติ',
    },
    tags: ['ThaiLIS', 'TDC', 'วิทยานิพนธ์', 'วิจัยชั้นเรียน'],
    recommendedBadge: 'คลังวิจัยระดับชาติ',
    featuredDaily: true,
    isOfficialCore: true,
  },
  {
    id: 'core-06-tci-thaijo',
    category: 'research',
    categoryLabel: 'วิจัย & วารสารวิชาการ',
    title: 'TCI ThaiJO (ฐานข้อมูลวารสารวิชาการไทยออนไลน์)',
    description: 'รวมบทความวิจัยทางการศึกษาที่ผ่านการรับรองมาตรฐาน TCI กว่า 400,000+ บทความ ค้นคว้าอ้างอิงทำผลงาน ว.PA',
    url: 'https://www.tci-thaijo.org/',
    previewImage: '/previews/core-06-tci-thaijo.png',
    tags: ['TCI', 'ThaiJO', 'วารสารวิชาการ', 'วิทยฐานะ'],
    recommendedBadge: 'ฐานข้อมูลวารสาร TCI',
    featuredDaily: true,
    isOfficialCore: true,
  },
  {
    id: 'res-01-tci',
    category: 'research',
    categoryLabel: 'วิจัย & วารสารวิชาการ',
    title: 'ศูนย์ดัชนีการอ้างอิงวารสารไทย (TCI Centre)',
    description: 'ตรวจสอบรายชื่อวารสารวิชาการกลุ่ม 1 และกลุ่ม 2 พร้อมดัชนีคุณภาพวารสารก่อนตีพิมพ์เผยแพร่ผลงานวิจัย',
    url: 'https://tci-thailand.org/',
    previewImage: '/previews/res-01-tci.png',
    tags: ['TCI กลุ่ม 1', 'TCI กลุ่ม 2', 'ตีพิมพ์วิจัย'],
  },
  {
    id: 'res-02-eric',
    category: 'research',
    categoryLabel: 'วิจัย & วารสารวิชาการ',
    title: 'ERIC (ฐานข้อมูลวิจัยการศึกษาสากล)',
    description: 'คลังงานวิจัยด้านการสอนและนวัตกรรมการศึกษาที่ใหญ่ที่สุดในโลก ค้นคว้าเอกสาร Peer-Reviewed PDF ฟรี',
    url: 'https://eric.ed.gov/',
    previewImage: '/previews/res-02-eric.png',
    tags: ['ERIC', 'วิจัยสากล', 'Pedagogy', 'PDF ฟรี'],
  },
  {
    id: 'res-03-onec',
    category: 'research',
    categoryLabel: 'วิจัย & วารสารวิชาการ',
    title: 'สำนักงานเลขาธิการสภาการศึกษา (สกศ.)',
    description: 'คลังรายงานวิจัย นโยบายการศึกษาชาติ และข้อมูลเปรียบเทียบสมรรถนะการศึกษาไทยกับนานาชาติ',
    url: 'https://www.onec.go.th/',
    portalTheme: {
      headerBg: 'from-rose-900 via-red-950 to-slate-950',
      accentBg: 'bg-rose-400',
      navItems: ['นโยบายการศึกษา', 'รายงานวิจัย สกศ.', 'สถิติการศึกษา', 'ดาวน์โหลด'],
      heroTitle: 'สกศ. · ONEC',
      heroSub: 'สำนักงานเลขาธิการสภาการศึกษา กระทรวงศึกษาธิการ',
    },
    tags: ['สกศ.', 'ONEC', 'วิจัยนโยบาย', 'สถิติการศึกษา'],
  },

  // =========================================================================
  // 4. คลังข้อสอบ & เกณฑ์ประเมิน (Exams & Assessment)
  // =========================================================================
  {
    id: 'ex-02-pisa',
    category: 'exams',
    categoryLabel: 'คลังข้อสอบ & เกณฑ์ประเมิน',
    title: 'PISA Thailand (ตัวอย่างข้อสอบ & กรอบวัดสมรรถนะ สสวท.)',
    description: 'คลังตัวอย่างข้อสอบ PISA การอ่าน-คณิต-วิทย์ พร้อมเฉลยแนวคิด และสื่ออินโฟกราฟิกฝึกคิดวิเคราะห์ขั้นสูง',
    url: 'https://pisathailand.ipst.ac.th/',
    previewImage: '/previews/ex-02-pisa.png',
    tags: ['PISA', 'คิดวิเคราะห์', 'สสวท.', 'แนวข้อสอบ'],
    recommendedBadge: 'มาตรฐาน PISA สสวท.',
    featuredDaily: true,
  },
  {
    id: 'ex-01-niets',
    category: 'exams',
    categoryLabel: 'คลังข้อสอบ & เกณฑ์ประเมิน',
    title: 'สทศ. NIETS (คลังข้อสอบ O-NET / A-Level & Blueprint)',
    description: 'ดาวน์โหลดข้อสอบเก่าระดับชาติ Test Blueprint และผังการสร้างข้อสอบจริงจากสถาบันทดสอบทางการศึกษาแห่งชาติ',
    url: 'https://www.niets.or.th/',
    portalTheme: {
      headerBg: 'from-blue-900 via-indigo-950 to-slate-950',
      accentBg: 'bg-sky-400',
      navItems: ['ข้อสอบ O-NET', 'Test Blueprint', 'ตารางสอบ', 'ค่าสถิติระดับชาติ'],
      heroTitle: 'สทศ. · NIETS',
      heroSub: 'คลังข้อสอบ O-NET และโครงสร้าง Test Blueprint',
    },
    tags: ['สทศ.', 'O-NET', 'Test Blueprint', 'ข้อสอบเก่า'],
    recommendedBadge: 'มาตรฐานระดับชาติ',
  },
  {
    id: 'ex-03-bet',
    category: 'exams',
    categoryLabel: 'คลังข้อสอบ & เกณฑ์ประเมิน',
    title: 'สำนักทดสอบทางการศึกษา สพฐ. (NT / RT)',
    description: 'คลังแบบทดสอบ NT ป.3 และ RT ป.1 พร้อมคู่มือวัดความฉลาดรู้และการประเมินตามตัวชี้วัด',
    url: 'https://bet.obec.go.th/',
    portalTheme: {
      headerBg: 'from-teal-900 via-emerald-950 to-slate-950',
      accentBg: 'bg-teal-400',
      navItems: ['คลังข้อสอบ NT', 'แบบประเมิน RT', 'ความฉลาดรู้', 'คู่มือวัดผล'],
      heroTitle: 'BET · OBEC',
      heroSub: 'สำนักทดสอบทางการศึกษา สพฐ. (แบบทดสอบ NT / RT)',
    },
    tags: ['NT', 'RT', 'สำนักทดสอบ สพฐ.', 'วัดผล'],
  },

  // =========================================================================
  // 5. ชุมชนครู & แหล่งแชร์ไอเดีย (Open Thai Teacher Communities)
  // =========================================================================
  {
    id: 'fb-01-inskru',
    category: 'facebook',
    categoryLabel: 'ชุมชนครู & แหล่งแชร์ไอเดีย',
    title: 'insKru — ห้องสมุดไอเดียการสอนของครูไทย',
    description: 'เปิดดูไอเดียกิจกรรม Active Learning เกมเปิดคาบ และเทคนิคจัดการชั้นเรียนจากเพื่อนครูทั่วไทยได้ทันทีไม่ต้องล็อกอิน',
    url: 'https://inskru.com/',
    previewImage: '/previews/fb-01-inskru.png',
    tags: ['insKru', 'Active Learning', 'ไอเดียครู', 'เกมเปิดคาบ'],
    recommendedBadge: 'เปิดชมได้ทันที',
    featuredDaily: true,
  },
  {
    id: 'fb-02-starfishlabz',
    category: 'facebook',
    categoryLabel: 'ชุมชนครู & แหล่งแชร์ไอเดีย',
    title: 'Starfish Labz — คอร์สพัฒนาครู & ชุมชน PLC ออนไลน์',
    description: 'แหล่งรวมเวิร์กช็อป นวัตกรรม Makerspace เทคนิคสอนศตวรรษที่ 21 และหลักสูตรเรียนออนไลน์รับเกียรติบัตรฟรี',
    url: 'https://www.starfishlabz.com/',
    previewImage: '/previews/fb-02-starfishlabz.png',
    tags: ['Starfish Labz', 'PLC', 'คอร์สฟรี', 'เกียรติบัตร'],
    recommendedBadge: 'ชุมชนครู PLC ยอดนิยม',
    featuredDaily: true,
  },
  {
    id: 'fb-03-trueplookpanya',
    category: 'facebook',
    categoryLabel: 'ชุมชนครู & แหล่งแชร์ไอเดีย',
    title: 'ทรูปลูกปัญญา (คลังบทเรียน ใบงาน & แผนสอน 8 กลุ่มสาระ)',
    description: 'แหล่งค้นคว้าบทเรียน คลังข้อสอบ ใบงาน และสื่อวิดีโอแยกตามระดับชั้น เปิดให้ครูและนักเรียนเข้าใช้งานได้ทันที',
    url: 'https://www.trueplookpanya.com/',
    portalTheme: {
      headerBg: 'from-red-700 via-rose-800 to-slate-900',
      accentBg: 'bg-rose-400',
      navItems: ['คลังความรู้', 'คลังข้อสอบ', 'แผนการสอน', 'ห้องเรียนครู'],
      heroTitle: 'TruePlookpanya',
      heroSub: 'คลังบทเรียน ใบงาน และข้อสอบออนไลน์ฟรี 8 กลุ่มสาระ',
    },
    tags: ['ทรูปลูกปัญญา', 'ใบงานฟรี', '8 กลุ่มสาระ', 'คลังข้อสอบ'],
    recommendedBadge: 'ครบ 8 กลุ่มสาระ',
  },
  {
    id: 'fb-04-thaimooc',
    category: 'facebook',
    categoryLabel: 'ชุมชนครู & แหล่งแชร์ไอเดีย',
    title: 'ThaiMOOC (เรียนออนไลน์ฟรีจากมหาวิทยาลัยทั่วไทย)',
    description: 'คอร์สอัปสกิลดิจิทัล การสร้างสื่อยุค AI และการวิจัยทางการศึกษาจากคณาจารย์มหาวิทยาลัย เรียนฟรีมีเกียรติบัตร',
    url: 'https://thaimooc.org/',
    portalTheme: {
      headerBg: 'from-sky-800 via-indigo-900 to-slate-950',
      accentBg: 'bg-sky-400',
      navItems: ['รายวิชาทั้งหมด', 'หมวดศึกษาศาสตร์', 'เทคโนโลยี AI', 'เกียรติบัตร'],
      heroTitle: 'ThaiMOOC',
      heroSub: 'ระบบเรียนออนไลน์เปิดกว้างระดับชาติ เรียนฟรีมีเกียรติบัตร',
    },
    tags: ['ThaiMOOC', 'เรียนฟรี', 'เกียรติบัตรครู', 'พัฒนาตนเอง'],
    recommendedBadge: 'เรียนฟรีมีเกียรติบัตร',
  },
];


