export interface IdeaResource {
  id: string;
  category: 'official_portal' | 'manual_guide' | 'research' | 'exams' | 'facebook' | 'education' | 'canva_ai';
  categoryLabel: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  recommendedBadge?: string;
  featuredDaily?: boolean;
  isOfficialCore?: boolean; // 6 core websites requested by user
}

export const IDEA_CATEGORIES = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'official_portal', label: '🏛️ คลังความรู้ & พอร์ทัลหลัก' },
  { id: 'manual_guide', label: '📖 คู่มือการใช้ AI & แนวทางการสอน' },
  { id: 'research', label: '📚 วิจัย วิทยานิพนธ์ & วารสาร' },
  { id: 'exams', label: '📝 คลังข้อสอบ & เกณฑ์ประเมิน' },
  { id: 'facebook', label: '👥 เพจเฟซบุ๊กแชร์สื่อ & ไอเดีย' },
] as const;

export const IDEA_RESOURCES: IdeaResource[] = [
  // =========================================================================
  // 1. คลังความรู้ & พอร์ทัลหลักทางการ (Official Knowledge Portals)
  // =========================================================================
  {
    id: 'core-01-scimath',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'SciMath คลังความรู้ สสวท. (สถาบันส่งเสริมการสอนวิทยาศาสตร์และเทคโนโลยี)',
    description: 'ศูนย์รวมบทความ นวัตกรรม สื่อการเรียนรู้ วิทยาศาสตร์ คณิตศาสตร์ เทคโนโลยี และสะเต็มศึกษา (STEM) ตามมาตรฐานหลักสูตรระดับชาติ',
    url: 'https://www.scimath.org/',
    tags: ['SciMath', 'สสวท.', 'วิทยาศาสตร์', 'คณิตศาสตร์', 'STEM', 'สื่อการสอน'],
    recommendedBadge: '⭐ เว็บหลัก สสวท.',
    featuredDaily: true,
    isOfficialCore: true,
  },
  {
    id: 'core-03-obec',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'OBEC Content Center (คลังเนื้อหาอิเล็กทรอนิกส์ สพฐ.)',
    description: 'ระบบคลังสื่อ นวัตกรรมการจัดการเรียนรู้ แผนการสอน แหล่งรวบรวม E-Book และบทเรียนอิเล็กทรอนิกส์มาตรฐาน สพฐ. กระทรวงศึกษาธิการ',
    url: 'https://contentcenter.obec.go.th/store/22074',
    tags: ['OBEC Content Center', 'สพฐ.', 'คลังสื่ออิเล็กทรอนิกส์', 'แผนการสอน', 'หนังสือเรียน'],
    recommendedBadge: '⭐ คลังสื่อกลาง สพฐ.',
    featuredDaily: true,
    isOfficialCore: true,
  },
  {
    id: 'core-04-opec',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน (สช. - OPEC)',
    description: 'ศูนย์รวมข้อมูล ข่าวสาร ระเบียบ แนวทางการประกันคุณภาพการศึกษา นวัตกรรม และโครงการส่งเสริมศักยภาพครูโรงเรียนเอกชนทั่วประเทศ',
    url: 'https://opec.go.th/news/detail/3373',
    tags: ['สช.', 'OPEC', 'การศึกษาเอกชน', 'ระเบียบการสอน', 'พัฒนาครู'],
    recommendedBadge: '⭐ เว็บไซต์หลัก สช.',
    featuredDaily: true,
    isOfficialCore: true,
  },
  {
    id: 'edu-01-dlit',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'DLIT (Distance Learning Information Technology) สพฐ.',
    description: 'คลังสื่อการเรียนรู้ออนไลน์ของกระทรวงศึกษาธิการ รวบรวมคลิปการสอน แผนการจัดการเรียนรู้ และสื่ออิเล็กทรอนิกส์ทุกกลุ่มสาระการเรียนรู้',
    url: 'https://www.dlit.ac.th',
    tags: ['DLIT', 'สพฐ.', 'ทุกกลุ่มสาระ', 'ประถม-มัธยม'],
    recommendedBadge: 'คลังสื่อมาตรฐาน สพฐ.',
    featuredDaily: true,
  },
  {
    id: 'edu-02-ipst',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'สสวท. IPST Learning Space (ระบบการเรียนรู้ดิจิทัล)',
    description: 'ระบบการเรียนรู้ดิจิทัล สถาบันส่งเสริมการสอนวิทยาศาสตร์และเทคโนโลยี รวบรวมสื่อ AR/VR, วิดีโอจำลองการทดลอง และสื่อสะเต็มศึกษา',
    url: 'https://learningspace.ipst.ac.th',
    tags: ['สสวท.', 'วิทยาศาสตร์', 'คณิตศาสตร์', 'เทคโนโลยี', 'สะเต็ม'],
    recommendedBadge: 'ทางการ สสวท.',
  },
  {
    id: 'edu-03-tkpark',
    category: 'official_portal',
    categoryLabel: 'คลังความรู้ & พอร์ทัลหลัก',
    title: 'TK Public Online Library (อุทยานการเรียนรู้ TK Park)',
    description: 'คลังหนังสือดิจิทัล สื่อมัลติมีเดีย และแหล่งค้นคว้าพัฒนาองค์ความรู้สำหรับครูและนักเรียน ให้บริการฟรีทั่วประเทศ',
    url: 'https://www.tkpark.or.th',
    tags: ['TK Park', 'ห้องสมุดดิจิทัล', 'E-Book', 'คลังความรู้'],
  },

  // =========================================================================
  // 2. คู่มือการใช้ AI & แนวทางการสอน (Manuals & Guidelines)
  // =========================================================================
  {
    id: 'core-02-ai-moe',
    category: 'manual_guide',
    categoryLabel: 'คู่มือการใช้ AI & แนวทางการสอน',
    title: 'E-Book คู่มือการใช้ AI สพฐ. กระทรวงศึกษาธิการ',
    description: 'เอกสารและคู่มือทางการสำหรับการประยุกต์ใช้เทคโนโลยีปัญญาประดิษฐ์ (AI) ในการจัดการเรียนรู้ขั้นพื้นฐานอย่างปลอดภัย จริยธรรม และมีประสิทธิภาพ',
    url: 'https://www.moe.go.th/e-book/%E0%B8%84%E0%B8%B9%E0%B9%88%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%83%E0%B8%8A%E0%B9%89-ai-%E0%B8%AA%E0%B8%9E%E0%B8%90/',
    tags: ['AI สพฐ.', 'คู่มือครู', 'กระทรวงศึกษาธิการ', 'E-Book', 'ปัญญาประดิษฐ์'],
    recommendedBadge: '⭐ คู่มือหลัก ศธ.',
    featuredDaily: true,
    isOfficialCore: true,
  },
  {
    id: 'guide-01-competency',
    category: 'manual_guide',
    categoryLabel: 'คู่มือการใช้ AI & แนวทางการสอน',
    title: 'คู่มือกรอบสมรรถนะดิจิทัลสำหรับครูและบุคลากรทางการศึกษาไทย (ศธ.)',
    description: 'เกณฑ์และแนวทางการพัฒนาตนเองด้านดิจิทัล ทักษะการประยุกต์ใช้เทคโนโลยีสารสนเทศเพื่อยกระดับห้องเรียน Active Learning',
    url: 'https://www.moe.go.th',
    tags: ['สมรรถนะดิจิทัล', 'กรอบพัฒนาครู', 'ศธ.', 'Active Learning'],
    recommendedBadge: 'กรอบมาตรฐานวิชาชีพ',
    featuredDaily: true,
  },
  {
    id: 'guide-02-wpa',
    category: 'manual_guide',
    categoryLabel: 'คู่มือการใช้ AI & แนวทางการสอน',
    title: 'คู่มือและหลักเกณฑ์การประเมินวิทยฐานะ ว.PA สำนักงาน ก.ค.ศ.',
    description: 'เอกสารคู่มือแนวทางการจัดทำข้อตกลงในการพัฒนางาน (PA), การเขียนแผนจัดการเรียนรู้ และแนวทางการประเมินคลิปการสอนตามเกณฑ์ ก.ค.ศ.',
    url: 'https://otepc.go.th',
    tags: ['ก.ค.ศ.', 'ว.PA', 'วิทยฐานะ', 'คู่มือประเมิน', 'แผนการสอน'],
    recommendedBadge: 'เกณฑ์ทางการ ก.ค.ศ.',
  },
  {
    id: 'guide-03-active',
    category: 'manual_guide',
    categoryLabel: 'คู่มือการใช้ AI & แนวทางการสอน',
    title: 'คู่มือแนวทางการจัดการเรียนรู้เชิงรุก (Active Learning) สพฐ.',
    description: 'แนวทางออกแบบกิจกรรมการเรียนรู้แบบ Active Learning มุ่งเน้นการคิดวิเคราะห์ กระบวนการกลุ่ม และการประเมินผลตามสภาพจริง',
    url: 'https://www.obec.go.th',
    tags: ['Active Learning', 'สพฐ.', 'การจัดการเรียนรู้', 'คู่มือครู'],
  },

  // =========================================================================
  // 3. วิจัย วิทยานิพนธ์ & วารสารวิชาการ (Research & Journals)
  // =========================================================================
  {
    id: 'core-05-tdc',
    category: 'research',
    categoryLabel: 'วิจัย & วารสารวิชาการ',
    title: 'TDC ThaiLIS (Thai Digital Collection - คลังวิทยานิพนธ์และวิจัยไทย)',
    description: 'ระบบสืบค้นและดาวน์โหลดเอกสารฉบับเต็ม (Full Text) วิทยานิพนธ์ รายงานการวิจัยทางการศึกษา และบทความวิจัยระดับชาติ',
    url: 'https://tdc.thailis.or.th/tdc/basic.php',
    tags: ['ThaiLIS', 'TDC', 'วิทยานิพนธ์', 'งานวิจัยในชั้นเรียน', 'Full Text'],
    recommendedBadge: '⭐ คลังวิจัยระดับชาติ',
    featuredDaily: true,
    isOfficialCore: true,
  },
  {
    id: 'core-06-tci-thaijo',
    category: 'research',
    categoryLabel: 'วิจัย & วารสารวิชาการ',
    title: 'TCI ThaiJO (Thai Journals Online - ฐานข้อมูลวารสารวิชาการไทย)',
    description: 'ศูนย์รวมวารสารวิชาการทางการศึกษา มนุษยศาสตร์ และวิทยาศาสตร์ ที่ผ่านการรับรองมาตรฐาน TCI ค้นคว้างานวิจัยอ้างอิงสำหรับวิทยฐานะ ว.PA',
    url: 'https://www.tci-thaijo.org/en',
    tags: ['TCI', 'ThaiJO', 'วารสารวิชาการ', 'วิทยฐานะ ว.PA', 'วิจัยทางการศึกษา'],
    recommendedBadge: '⭐ ฐานข้อมูลวารสาร TCI',
    featuredDaily: true,
    isOfficialCore: true,
  },
  {
    id: 'res-01-tci',
    category: 'research',
    categoryLabel: 'วิจัย & วารสารวิชาการ',
    title: 'ศูนย์ดัชนีการอ้างอิงวารสารไทย (TCI Thailand)',
    description: 'ตรวจสอบรายชื่อวารสารกลุ่มที่ 1 และ 2 การประเมินคุณภาพวารสารวิชาการ และฐานข้อมูลการอ้างอิงผลงานวิจัยระดับชาติ',
    url: 'https://tci-thailand.org',
    tags: ['TCI กลุ่ม 1', 'TCI กลุ่ม 2', 'คุณภาพวารสาร', 'ดัชนีอ้างอิง'],
  },
  {
    id: 'res-02-eric',
    category: 'research',
    categoryLabel: 'วิจัย & วารสารวิชาการ',
    title: 'ERIC - Education Resources Information Center',
    description: 'ฐานข้อมูลงานวิจัยทางการศึกษาที่ใหญ่ที่สุดในโลก สนับสนุนโดยกระทรวงศึกษาธิการสหรัฐฯ ค้นคว้างานวิจัย Active Learning และนวัตกรรมสากล',
    url: 'https://eric.ed.gov',
    tags: ['ERIC', 'วิจัยสากล', 'Active Learning', 'Pedagogy'],
  },
  {
    id: 'res-03-onec',
    category: 'research',
    categoryLabel: 'วิจัย & วารสารวิชาการ',
    title: 'สำนักงานเลขาธิการสภาการศึกษา (สกศ. - ONEC)',
    description: 'คลังข้อมูลงานวิจัย นโยบายการศึกษาแห่งชาติ และสถิติแนวโน้มการจัดการศึกษาในระดับประเทศและนานาชาติ',
    url: 'https://www.onec.go.th',
    tags: ['สภาการศึกษา', 'สกศ.', 'วิจัยการศึกษา', 'นโยบายการศึกษา'],
  },

  // =========================================================================
  // 4. คลังข้อสอบ & เกณฑ์ประเมิน (Exams & Assessment)
  // =========================================================================
  {
    id: 'ex-01-niets',
    category: 'exams',
    categoryLabel: 'คลังข้อสอบ & เกณฑ์ประเมิน',
    title: 'คลังข้อสอบและ Test Blueprint สทศ. (NIETS)',
    description: 'สถาบันทดสอบทางการศึกษาแห่งชาติ รวบรวมข้อสอบ O-NET, A-Level, โครงสร้างข้อสอบ (Test Blueprint) และตัวอย่างกระดาษคำตอบระดับประเทศ',
    url: 'https://www.niets.or.th',
    tags: ['สทศ.', 'NIETS', 'O-NET', 'Test Blueprint', 'เกณฑ์ข้อสอบ'],
    recommendedBadge: 'มาตรฐานระดับชาติ',
    featuredDaily: true,
  },
  {
    id: 'ex-02-pisa',
    category: 'exams',
    categoryLabel: 'คลังข้อสอบ & เกณฑ์ประเมิน',
    title: 'PISA Thailand Portal (ศูนย์สอบและกรอบวัดผล PISA)',
    description: 'ตัวอย่างข้อสอบ PISA ด้านการอ่าน คณิตศาสตร์ วิทยาศาสตร์ และแนวทางส่งเสริมสมรรถนะการคิดแก้ปัญหาขั้นสูง สสวท.',
    url: 'https://pisathailand.ipst.ac.th',
    tags: ['PISA', 'สมรรถนะการอ่าน', 'สสวท.', 'การคิดขั้นสูง'],
    recommendedBadge: 'มาตรฐาน PISA สสวท.',
  },
  {
    id: 'ex-03-bet',
    category: 'exams',
    categoryLabel: 'คลังข้อสอบ & เกณฑ์ประเมิน',
    title: 'สำนักทดสอบทางการศึกษา สพฐ. (BET OBEC)',
    description: 'คลังเครื่องมือประเมินผลการเรียนรู้ แบบทดสอบมาตรฐาน NT, เครื่องมือวัดความฉลาดรู้ และแนวทางการประเมินตามตัวชี้วัด',
    url: 'https://bet.obec.go.th',
    tags: ['สำนักทดสอบ สพฐ.', 'NT', 'เครื่องมือประเมิน', 'วัดผลสัมฤทธิ์'],
  },

  // =========================================================================
  // 5. เพจเฟซบุ๊กแชร์สื่อ & ไอเดีย (Facebook Communities)
  // =========================================================================
  {
    id: 'fb-01-inskru',
    category: 'facebook',
    categoryLabel: 'เพจเฟซบุ๊กแชร์สื่อ & ไอเดีย',
    title: 'insKru - พื้นที่แบ่งปันไอเดียการสอน',
    description: 'คอมมูนิตี้ครูที่ใหญ่ที่สุดในประเทศไทย แหล่งรวมไอเดีย Active Learning บอร์ดเกมสอน กิจกรรมละลายพฤติกรรม และใบงานแบ่งปันจากครูทั่วประเทศ',
    url: 'https://www.facebook.com/inskruinth/',
    tags: ['insKru', 'Active Learning', 'ไอเดียครู', 'เกมการสอน', 'Facebook'],
    recommendedBadge: 'เพจแนะนำอันดับ 1',
    featuredDaily: true,
  },
  {
    id: 'fb-02-krumalaew',
    category: 'facebook',
    categoryLabel: 'เพจเฟซบุ๊กแชร์สื่อ & ไอเดีย',
    title: 'เพจครูมาแล้ว (แบ่งปันสื่อการสอน ข่าวการศึกษา และวิทยฐานะ)',
    description: 'เพจแชร์สื่อการสอนฟรี ใบงาน เอกสารวิทยฐานะ ว.PA แผนการจัดการเรียนรู้ และข่าวสารทางการศึกษาที่อัปเดตต่อเนื่อง',
    url: 'https://www.facebook.com/krumalaew/',
    tags: ['ครูมาแล้ว', 'สื่อการสอนฟรี', 'วิทยฐานะ', 'ว.PA', 'Facebook'],
    recommendedBadge: 'เพจแชร์สื่อยอดนิยม',
    featuredDaily: true,
  },
  {
    id: 'fb-03-kruploykong',
    category: 'facebook',
    categoryLabel: 'เพจเฟซบุ๊กแชร์สื่อ & ไอเดีย',
    title: 'เพจครูปล่อยของ (สื่อนวัตกรรมและการจัดห้องเรียนสร้างสรรค์)',
    description: 'เพจแลกเปลี่ยนสื่อทำมือ สื่อดิจิทัล แฟ้มสะสมผลงาน และเทคนิคการสอนที่ช่วยให้ห้องเรียนเต็มไปด้วยความสุขและเสียงหัวเราะ',
    url: 'https://www.facebook.com/kruploykong/',
    tags: ['ครูปล่อยของ', 'สื่อทำมือ', 'สื่อสร้างสรรค์', 'Facebook'],
  },
  {
    id: 'fb-04-canva-group',
    category: 'facebook',
    categoryLabel: 'เพจเฟซบุ๊กแชร์สื่อ & ไอเดีย',
    title: 'Canva for Education Thailand Official Community',
    description: 'กลุ่มเฟซบุ๊กทางการของครูผู้ใช้ Canva ในไทย อัปเดตเทมเพลตใหม่สำหรับวันสำคัญ คอร์สอบรมฟรี และเคล็ดลับการออกแบบสื่อเพื่อการศึกษา',
    url: 'https://www.facebook.com/groups/canvaforeducationthailand/',
    tags: ['Canva Group', 'อบรมฟรี', 'เทมเพลตครู', 'Facebook Group'],
    recommendedBadge: 'คอมมูนิตี้ทางการ',
  },
  {
    id: 'fb-05-hongpakru',
    category: 'facebook',
    categoryLabel: 'เพจเฟซบุ๊กแชร์สื่อ & ไอเดีย',
    title: 'เพจห้องพักครู (แหล่งความรู้และสิทธิประโยชน์ครูไทย)',
    description: 'อัปเดตข่าวสารระเบียบกระทรวงฯ ข้อมูลวิทยฐานะ ว.PA และเทคนิคการประเมินผลการเรียนรู้ของครูมืออาชีพ',
    url: 'https://www.facebook.com',
    tags: ['ข่าวครู', 'วิทยฐานะ ว.PA', 'ระเบียบการศึกษา', 'Facebook'],
  },
];
