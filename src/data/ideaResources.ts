export interface IdeaResource {
  id: string;
  category: 'education' | 'research' | 'exams' | 'facebook' | 'canva_ai';
  categoryLabel: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  recommendedBadge?: string;
  featuredDaily?: boolean;
}

export const IDEA_CATEGORIES = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'canva_ai', label: '🎨 การทำสื่อด้วย Canva & AI' },
  { id: 'education', label: '🌐 เว็บไซต์การศึกษา' },
  { id: 'research', label: '📚 วิจัย & บทความวิชาการ' },
  { id: 'exams', label: '📝 คลังข้อสอบ & การประเมิน' },
  { id: 'facebook', label: '👥 เพจเฟซบุ๊กครูยอดนิยม' },
] as const;

export const IDEA_RESOURCES: IdeaResource[] = [
  // 1. Canva & AI for Education
  {
    id: 'ai-01',
    category: 'canva_ai',
    categoryLabel: 'การทำสื่อด้วย Canva & AI',
    title: 'Canva for Education Thailand (แคนวาเพื่อการศึกษา)',
    description: 'แพลตฟอร์มออกแบบสื่อสากล ฟรีสำหรับครูและนักเรียน พร้อมเครื่องมือ Magic Studio AI สร้างใบงาน สไลด์ เกม และโปสเตอร์ภาษาไทยได้ในไม่กี่วินาที',
    url: 'https://www.canva.com/th_th/education/',
    tags: ['Canva', 'Magic Studio', 'สื่อการสอนฟรี', 'สไลด์โต้ตอบ'],
    recommendedBadge: 'ยอดนิยมสำหรับครู',
    featuredDaily: true,
  },
  {
    id: 'ai-02',
    category: 'canva_ai',
    categoryLabel: 'การทำสื่อด้วย Canva & AI',
    title: 'Google Gemini for Educators & Workspace',
    description: 'เครื่องมือ Generative AI อัจฉริยะ ช่วยคิดแผนการสอน Active Learning, สรุปบทเรียน, ออกข้อสอบตามระดับ Bloom Taxonomy และสร้างรูบริกประเมิน',
    url: 'https://gemini.google.com',
    tags: ['AI ผู้ช่วยครู', 'แผนการสอน', 'ข้อสอบอัตโนมัติ', 'Gemini'],
    recommendedBadge: 'แนะนำประจำวัน',
    featuredDaily: true,
  },
  {
    id: 'ai-03',
    category: 'canva_ai',
    categoryLabel: 'การทำสื่อด้วย Canva & AI',
    title: 'Gamma App (AI ออกแบบสไลด์และเอกสารการสอน)',
    description: 'พิมพ์หัวข้อบทเรียน AI จะสร้างสไลด์บรรยายสวยงามพร้อมรูปภาพ เนื้อหาครบถ้วน สามารถแก้ไขและส่งออกเป็น PDF/PowerPoint ได้ทันที',
    url: 'https://gamma.app',
    tags: ['สไลด์ AI', 'สร้างงานนำเสนอ', 'อินโฟกราฟิก'],
  },
  {
    id: 'ai-04',
    category: 'canva_ai',
    categoryLabel: 'การทำสื่อด้วย Canva & AI',
    title: 'Suno AI (สร้างเพลงและจังหวะช่วยจำในบทเรียน)',
    description: 'แต่งเพลงเพื่อการศึกษา ใส่เนื้อหา สูตรคณิตศาสตร์ หรือคำศัพท์ภาษาต่างประเทศ AI จะแต่งทำนองและร้องออกมาเพื่อให้นักเรียนจดจำได้อย่างสนุกสนาน',
    url: 'https://suno.com',
    tags: ['ดนตรีการสอน', 'Edutainment', 'นวัตกรรมจำบทเรียน'],
  },
  {
    id: 'ai-05',
    category: 'canva_ai',
    categoryLabel: 'การทำสื่อด้วย Canva & AI',
    title: 'Claude AI (ช่วยตรวจทานและจัดทำเอกสาร ว.PA)',
    description: 'AI วิเคราะห์ภาษาและเรียบเรียงเอกสารวิชาการ ข้อตกลงในการพัฒนางาน (PA) และการสังเคราะห์ผลการจัดการเรียนรู้',
    url: 'https://claude.ai',
    tags: ['งานวิจัยในชั้นเรียน', 'ว.PA', 'วิเคราะห์ข้อมูล'],
  },

  // 2. เว็บไซต์เกี่ยวกับการศึกษา
  {
    id: 'edu-01',
    category: 'education',
    categoryLabel: 'เว็บไซต์การศึกษา',
    title: 'DLIT (Distance Learning Information Technology) สพฐ.',
    description: 'คลังสื่อการเรียนรู้ออนไลน์ของกระทรวงศึกษาธิการ รวบรวมคลิปการสอน แผนการจัดการเรียนรู้ และสื่ออิเล็กทรอนิกส์ทุกกลุ่มสาระการเรียนรู้',
    url: 'https://www.dlit.ac.th',
    tags: ['สพฐ.', 'สื่อดิจิทัล', 'ทุกกลุ่มสาระ', 'ประถม-มัธยม'],
    recommendedBadge: 'คลังสื่อมาตรฐาน',
    featuredDaily: true,
  },
  {
    id: 'edu-02',
    category: 'education',
    categoryLabel: 'เว็บไซต์การศึกษา',
    title: 'สสวท. IPST Learning Space',
    description: 'ระบบการเรียนรู้ดิจิทัล สถาบันส่งเสริมการสอนวิทยาศาสตร์และเทคโนโลยี รวบรวมสื่อ AR/VR, วิดีโอจำลองการทดลอง และสื่อคณิตศาสตร์-วิทยาศาสตร์',
    url: 'https://learningspace.ipst.ac.th',
    tags: ['สสวท.', 'วิทยาศาสตร์', 'คณิตศาสตร์', 'เทคโนโลยี', 'สะเต็ม'],
    recommendedBadge: 'ทางการ สสวท.',
  },
  {
    id: 'edu-03',
    category: 'education',
    categoryLabel: 'เว็บไซต์การศึกษา',
    title: 'EdTech Hub Thailand & MOE e-Learning',
    description: 'ศูนย์นวัตกรรมและเทคโนโลยีการศึกษา รวบรวมแนวทางจัดการเรียนรู้ยุคใหม่ อบรมครูดิจิทัล และแพลตฟอร์มการเรียนรู้ตลอดชีวิต',
    url: 'https://moe.go.th',
    tags: ['กระทรวงศึกษาธิการ', 'EdTech', 'อบรมครู'],
  },
  {
    id: 'edu-04',
    category: 'education',
    categoryLabel: 'เว็บไซต์การศึกษา',
    title: 'PhET Interactive Simulations (แบบจำลองเสมือนจริง)',
    description: 'แบบจำลองฟิสิกส์ เคมี ชีววิทยา และคณิตศาสตร์ รองรับภาษาไทย ให้นักเรียนได้ทดลองปรับตัวแปรและเห็นผลลัพธ์ทันทีบนหน้าจอ',
    url: 'https://phet.colorado.edu/th/',
    tags: ['ทดลองเสมือนจริง', 'STEM', 'ฟิสิกส์', 'เคมี', 'Interactive'],
  },

  // 3. วิจัยและบทความวิชาการ
  {
    id: 'res-01',
    category: 'research',
    categoryLabel: 'วิจัย & บทความวิชาการ',
    title: 'ThaiLIS (Digital Collection - คลังวิทยานิพนธ์ไทย)',
    description: 'เครือข่ายห้องสมุดมหาวิทยาลัยในประเทศไทย รวบรวมวิทยานิพนธ์ วิจัยในชั้นเรียน และผลงานทางวิชาการทางการศึกษาดาวน์โหลดฉบับเต็มได้ฟรี',
    url: 'https://tdc.thailis.or.th',
    tags: ['วิจัยในชั้นเรียน', 'วิทยานิพนธ์', 'ThaiLIS', 'งานวิชาการ'],
    recommendedBadge: 'ฐานข้อมูลวิจัยไทย',
    featuredDaily: true,
  },
  {
    id: 'res-02',
    category: 'research',
    categoryLabel: 'วิจัย & บทความวิชาการ',
    title: 'TCI (ศูนย์ดัชนีการอ้างอิงวารสารไทย)',
    description: 'ระบบสืบค้นวารสารวิชาการทางการศึกษาที่ผ่านการรับรองมาตรฐาน TCI กลุ่ม 1 และกลุ่ม 2 เพื่อค้นคว้าอ้างอิงสำหรับทำผลงานวิชาการครูเชี่ยวชาญ',
    url: 'https://tci-thailand.org',
    tags: ['TCI', 'วารสารครุศาสตร์', 'อ้างอิงวิชาการ', 'วิทยฐานะ'],
  },
  {
    id: 'res-03',
    category: 'research',
    categoryLabel: 'วิจัย & บทความวิชาการ',
    title: 'ERIC (Education Resources Information Center)',
    description: 'ฐานข้อมูลวิจัยทางการศึกษาที่ใหญ่ที่สุดในโลก สนับสนุนโดยกระทรวงศึกษาธิการสหรัฐฯ รวบรวมงานวิจัย Active Learning และนวัตกรรมสากล',
    url: 'https://eric.ed.gov',
    tags: ['วิจัยสากล', 'Active Learning', 'ERIC', 'Pedagogy'],
  },

  // 4. คลังข้อสอบและการประเมิน
  {
    id: 'ex-01',
    category: 'exams',
    categoryLabel: 'คลังข้อสอบ & การประเมิน',
    title: 'คลังข้อสอบ สทศ. (NIETS Test Blueprint & Archive)',
    description: 'สถาบันทดสอบทางการศึกษาแห่งชาติ รวบรวมข้อสอบ O-NET, A-Level, โครงสร้างข้อสอบ (Test Blueprint) และเฉลยแนวคำตอบเพื่อใช้วิเคราะห์ผลสัมฤทธิ์',
    url: 'https://www.niets.or.th',
    tags: ['สทศ.', 'O-NET', 'A-Level', 'Test Blueprint', 'เกณฑ์ข้อสอบ'],
    recommendedBadge: 'มาตรฐานระดับชาติ',
    featuredDaily: true,
  },
  {
    id: 'ex-02',
    category: 'exams',
    categoryLabel: 'คลังข้อสอบ & การประเมิน',
    title: 'PISA Thailand Portal (ศูนย์สอบและกรอบวัดผล PISA)',
    description: 'ตัวอย่างข้อสอบ PISA ด้านการอ่าน คณิตศาสตร์ และวิทยาศาสตร์ พร้อมแนวทางการจัดการเรียนรู้เพื่อส่งเสริมทรรศนะการคิดขั้นสูง',
    url: 'https://pisathailand.ipst.ac.th',
    tags: ['PISA', 'สมรรถนะการอ่าน', 'การแก้ปัญหาขั้นสูง'],
  },
  {
    id: 'ex-03',
    category: 'exams',
    categoryLabel: 'คลังข้อสอบ & การประเมิน',
    title: 'Wordwall (สร้างข้อสอบและเกมตอบคำถามแบบโต้ตอบ)',
    description: 'สร้างวงล้อสุ่มคำถาม, จับคู่, แบบทดสอบจับเวลา และเปิดป้ายปริศนา ใช้งานได้ทั้งบนคอมพิวเตอร์ โปรเจกเตอร์ และสมาร์ตโฟนของนักเรียน',
    url: 'https://wordwall.net/th',
    tags: ['เกมคำถาม', 'ประเมินระหว่างเรียน', 'Gamification'],
  },
  {
    id: 'ex-04',
    category: 'exams',
    categoryLabel: 'คลังข้อสอบ & การประเมิน',
    title: 'Quizizz for Schools & Liveworksheets',
    description: 'แพลตฟอร์มแบบฝึกหัดโต้ตอบตรวจคะแนนอัตโนมัติ ส่งรายงานผลคะแนนแยกตามตัวชี้วัดเข้าสู่อีเมลคุณครูได้ทันที',
    url: 'https://quizizz.com',
    tags: ['Quizizz', 'ใบงานดิจิทัล', 'ตรวจอัตโนมัติ'],
  },

  // 5. เพจเฟซบุ๊กครูยอดนิยม
  {
    id: 'fb-01',
    category: 'facebook',
    categoryLabel: 'เพจเฟซบุ๊กครูยอดนิยม',
    title: 'insKru - พื้นที่แบ่งปันไอเดียการสอน',
    description: 'คอมมูนิตี้ครูที่ใหญ่ที่สุดในประเทศไทย แหล่งรวมไอเดีย Active Learning บอร์ดเกมสอน กิจกรรมละลายพฤติกรรม และใบงานแบ่งปันจากครูทั่วประเทศ',
    url: 'https://www.facebook.com/inskruinth/',
    tags: ['insKru', 'Active Learning', 'ไอเดียครู', 'เกมการสอน'],
    recommendedBadge: 'เพจแนะนำอันดับ 1',
    featuredDaily: true,
  },
  {
    id: 'fb-02',
    category: 'facebook',
    categoryLabel: 'เพจเฟซบุ๊กครูยอดนิยม',
    title: 'ครูปล่อยของ (สื่อนวัตกรรมและการจัดห้องเรียนสร้างสรรค์)',
    description: 'เพจแลกเปลี่ยนสื่อทำมือ สื่อดิจิทัล แฟ้มสะสมผลงาน และเทคนิคการสอนที่ช่วยให้ห้องเรียนเต็มไปด้วยความสุขและเสียงหัวเราะ',
    url: 'https://www.facebook.com',
    tags: ['ครูปล่อยของ', 'สื่อทำมือ', 'สื่อสร้างสรรค์'],
  },
  {
    id: 'fb-03',
    category: 'facebook',
    categoryLabel: 'เพจเฟซบุ๊กครูยอดนิยม',
    title: 'Canva for Education Thailand Official Group',
    description: 'กลุ่มเฟซบุ๊กทางการของครูผู้ใช้ Canva ในไทย อัปเดตเทมเพลตใหม่สำหรับวันสำคัญ คอร์สอบรมฟรี และเคล็ดลับการใช้ AI เพื่อการศึกษา',
    url: 'https://www.facebook.com/groups/canvaforeducationthailand',
    tags: ['Canva Group', 'อบรมฟรี', 'เทมเพลตครู'],
  },
  {
    id: 'fb-04',
    category: 'facebook',
    categoryLabel: 'เพจเฟซบุ๊กครูยอดนิยม',
    title: 'ห้องพักครู - แหล่งความรู้และสิทธิประโยชน์ครูไทย',
    description: 'อัปเดตข่าวสารระเบียบกระทรวงฯ ข้อมูลวิทยฐานะ ว.PA และเทคนิคการประเมินผลการเรียนรู้ของครูมืออาชีพ',
    url: 'https://www.facebook.com',
    tags: ['ข่าวครู', 'วิทยฐานะ ว.PA', 'ระเบียบการศึกษา'],
  },
];
