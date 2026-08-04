// Domain types for the Namphrae Portal config document, plus the calendar
// jobs domain (a separate, unbounded collection — see the ปฏิทินปฏิบัติงาน
// section below). The portal config itself is a single PortalConfig object
// stored as one MongoDB document (or one local JSON file in the dev fallback
// store).

export type HeroMediaType = 'none' | 'image' | 'video';

export type HeroMedia = {
  mediaType: HeroMediaType;
  videoUrl?: string; // Cloudinary video URL
  posterUrl?: string; // still image: used as <video poster> and image fallback
  overlayOpacity: number; // 0–1, darkening overlay so text stays readable
};

export type SiteContact = {
  phone?: string;
  email?: string;
  address?: string;
};

export type Manual = {
  label: string;
  url: string;
};

export type SiteSettings = {
  orgName: string;
  orgSubName?: string;
  title: string;
  brandTitle?: string;
  tagline: string;
  logoUrl: string;
  hero: HeroMedia;
  contact: SiteContact;
  manuals?: Manual[];
};

export type Category = {
  id: string; // slug e.g. "service"
  label: string;
  order: number;
  color?: string; // curated palette hex (see src/lib/category-accent.ts)
};

export type ServiceLink = {
  id: string; // unique slug
  title: string;
  subtitle?: string;
  url: string;
  imageUrl?: string; // Cloudinary URL (or legacy hotlink)
  icon?: string; // Material Symbols name (see src/lib/icons.ts)
  categoryId: string;
  openInNewTab: boolean;
  isActive: boolean; // false = hidden from public page
  isFeatured: boolean; // true = large card at the top
  order: number;
  clickCount: number;
};

export type PortalConfig = {
  _id?: string; // always "portalConfig"
  version: number;
  updatedAt: string; // ISO string
  updatedBy?: string; // Clerk user id / email
  visitorCount: number; // continues from the legacy counter
  site: SiteSettings;
  categories: Category[];
  links: ServiceLink[];
  // LINE group ที่บอท OA ถูกเชิญเข้าไป — เก็บที่ระดับบนสุด ไม่ใช่ใน `site`
  // เพราะ toPublicConfig() คืน `site` ทั้งก้อนสู่สาธารณะ
  lineGroupId?: string;
};

// Public-facing config: admin-only fields stripped, inactive links removed.
export type PublicConfig = {
  version: number;
  updatedAt: string;
  visitorCount: number;
  site: SiteSettings;
  categories: Category[];
  links: PublicLink[];
};

export type PublicLink = Omit<ServiceLink, 'isActive'>;

// ── ปฏิทินปฏิบัติงาน ────────────────────────────────────────────────────────
// งานปฏิทินอยู่คนละ collection กับ PortalConfig (ดู src/lib/jobs-store.ts):
// config เป็นเอกสารก้อนเดียวที่เขียนทับทั้งก้อนทุกครั้ง ส่วนงานโตไม่จำกัด

// แหล่งความจริงเดียวของ union — schema.ts ใช้ z.enum(JOB_KINDS) จากอาเรย์นี้
// โดยตรง กันไม่ให้ type กับ schema เพี้ยนกันเมื่อมีการเพิ่มชนิดงานใหม่
export const JOB_KINDS = ['ems', 'rescue'] as const; // กู้ชีพ (รับ-ส่งผู้ป่วย) | กู้ภัย (งานป้องกัน)
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATUSES = ['pending', 'approved', 'done', 'cancelled'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type CalendarJob = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  date: string; // 'YYYY-MM-DD' ตามเวลาไทยตรง ๆ — ไม่แปลง UTC จึงไม่มีวันเพี้ยน
  time: string; // 'HH:mm' 24 ชม.
  title: string; // ชื่อผู้ป่วย / ชื่องาน            ← PII
  village?: string; // 'ม.3 ต.น้ำแพร่'
  origin?: string; // ต้นทาง                       ← PII
  destination?: string; // ปลายทาง                 ← PII
  phone?: string; //                               ← PII
  note?: string;
  createdAt: string;
  createdBy: string;
  decidedAt?: string; // ตอนอนุมัติ / ยกเลิก
  decidedBy?: string;
  doneAt?: string; // ตอนปิดงาน
  doneBy?: string;
};

// รายชื่อฟิลด์ที่อนุญาตให้สาธารณะเห็นคือแหล่งความจริงเดียว — ฟิลด์ไหนของ
// CalendarJob ไม่ถูกเขียนไว้ในนี้ถือว่าเป็นข้อมูลส่วนตัวโดยปริยาย (private by
// default) ไม่ใช่กลับด้าน ดังนั้นฟิลด์ใหม่ที่เพิ่มเข้า CalendarJob ทีหลัง
// (เช่น createdBy, decidedBy, doneBy ซึ่งเป็นอีเมล/Clerk id ของเจ้าหน้าที่)
// จะถูกกันไว้เป็นส่วนตัวเองโดยอัตโนมัติ ต้องเติมชื่อลงอาเรย์นี้อย่างตั้งใจ
// เท่านั้นจึงจะเปิดเผยได้ — ต่างจากการไล่ประกาศฟิลด์ต้องห้ามทีละชื่อซึ่งลืม
// เพิ่มฟิลด์ใหม่ได้ง่าย (JobPrivateField เดิมตกหล่นไปแล้วสามฟิลด์)
export const PUBLIC_JOB_FIELDS = [
  'id',
  'kind',
  'date',
  'time',
  'status',
  'village',
] as const satisfies readonly (keyof CalendarJob)[];

type PublicJobField = (typeof PUBLIC_JOB_FIELDS)[number];

// ฟิลด์ที่เหลือทั้งหมดของ CalendarJob (ไม่ว่าจะมีอยู่วันนี้หรือเพิ่มทีหลัง)
// ถูก derive มาเป็น never โดยอัตโนมัติ เพื่อให้การเผลอ spread CalendarJob
// ทั้งก้อนมาเป็น PublicJob กลายเป็น compile error ไม่ใช่แค่เทสต์จับ
type JobPrivateField = Exclude<keyof CalendarJob, PublicJobField>;

// สิ่งที่หลุดออกสู่สาธารณะได้เท่านั้น — ดู src/lib/job-public.ts
export type PublicJob = Pick<CalendarJob, PublicJobField> &
  Partial<Record<JobPrivateField, never>>;

export const JOB_KIND_LABEL: Record<JobKind, string> = {
  ems: 'รับ-ส่งผู้ป่วย',
  rescue: 'งานป้องกัน',
};

// สีเดิมจาก legend ของปฏิทินที่ระบบนี้มาแทน
export const JOB_KIND_COLOR: Record<JobKind, string> = {
  ems: '#0b8043',
  rescue: '#d81b60',
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  done: 'ดำเนินการแล้ว',
  cancelled: 'ยกเลิก',
};

export const CONFIG_ID = 'portalConfig';
