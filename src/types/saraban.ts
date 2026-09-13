// src/types/saraban.ts
// ชนิดข้อมูลของระบบสารบรรณ — ดู docs/superpowers/specs/2026-09-13-saraban-design.md ข้อ 3
//
// อาเรย์ `as const` เป็นแหล่งความจริงเดียวของ union แต่ละตัว (แนวเดียวกับ JOB_STATUSES
// ใน portal.ts) — ที่ใดต้องเช็คค่าตอนรัน (z.enum ใน saraban-schema.ts, ปุ่มกรองใน
// saraban-doc.ts) ให้สร้างจากอาเรย์เหล่านี้ ไม่พิมพ์รายการซ้ำเอง
//
// คีย์เป็นภาษาอังกฤษ ป้ายภาษาไทยอยู่ใน saraban-labels.ts — ป้ายสถานะของหนังสือส่งต่างจาก
// หนังสือรับ (รอส่ง/ส่งแล้ว vs ดำเนินการ/เสร็จสิ้น) คีย์เดียวจึงมีสองป้าย

export const SARABAN_REGISTERS = ['in', 'out', 'circular'] as const; // รับ | ส่ง | เวียน
export type SarabanRegister = (typeof SARABAN_REGISTERS)[number];

export const SARABAN_LEVELS = ['normal', 'urgent', 'very-urgent', 'most-urgent'] as const;
export type SarabanLevel = (typeof SARABAN_LEVELS)[number];

export const SARABAN_STATUSES = ['pending', 'in-progress', 'done', 'void'] as const;
export type SarabanStatus = (typeof SARABAN_STATUSES)[number];

// สถานะที่แสดงบนจอ — "เกินกำหนด" คำนวณจาก dueDate ไม่ได้เก็บ (สเปกข้อ 3)
// ปุ่มกรองของทะเบียน (REGISTER_VIEWS ใน saraban-doc.ts) สร้างจากอาเรย์นี้ เพิ่มสถานะ
// ใหม่ใน SARABAN_STATUSES แล้วปุ่มกรองกับ schema ของ query ตามมาเอง
export const DISPLAY_STATUSES = [...SARABAN_STATUSES, 'overdue'] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

export const SEND_METHODS = ['system', 'post', 'hand'] as const; // ระบบ | ไปรษณีย์ | พนักงานเดินหนังสือ
export type SendMethod = (typeof SEND_METHODS)[number];

export const SARABAN_FILE_FORMATS = ['pdf', 'jpg', 'png'] as const;
export type SarabanFileFormat = (typeof SARABAN_FILE_FORMATS)[number];

// ชนิด resource ของ Cloudinary ที่รับ — PDF อัปเป็น image (ได้จำนวนหน้า) ถอยไป raw ได้
// ถ้าบัญชีส่ง PDF แบบ image ไม่ได้ (สเปกข้อ 12)
export const SARABAN_RESOURCE_TYPES = ['image', 'raw'] as const;
export type SarabanResourceType = (typeof SARABAN_RESOURCE_TYPES)[number];

export const SARABAN_EVENT_KINDS = [
  'received', // ลงรับ
  'issued', // ออกเลขส่ง/เวียน
  'edited',
  'file-added',
  'file-removed',
  'sent',
  'voided',
] as const;
export type SarabanEventKind = (typeof SARABAN_EVENT_KINDS)[number];

export type SarabanFile = {
  id: string; // uuid — ใช้ใน URL แทน publicId ที่มี '/'
  publicId: string;
  resourceType: SarabanResourceType;
  name: string; // ชื่อไฟล์เดิมจากเครื่องผู้ใช้
  format: SarabanFileFormat;
  bytes: number; // อ่านจาก Cloudinary ไม่ใช่จาก client
  pages: number; // อ่านจาก Cloudinary · รูปภาพ = 1 · 0 = ไม่รู้ (PDF ที่อัปแบบ raw)
  uploadedAt: string; // ISO
  uploadedBy: string; // clerkId หรือ 'dev-open'
};

export type SarabanFieldChange = { field: string; from: string; to: string };

export type SarabanEvent = {
  id: string;
  at: string; // ISO
  by: string; // clerkId หรือ 'dev-open'
  byName: string; // ชื่อ ณ เวลาที่ทำ — audit trail ต้องไม่ถูกแก้ย้อนหลังเมื่อเปลี่ยนชื่อ
  kind: SarabanEventKind;
  note: string; // '' = ไม่มี
  // optional โดยตั้งใจ ต่างจากช่องอื่นที่ใช้ '' — event ต่อท้ายอย่างเดียวและสร้างผ่าน
  // makeEvent() ที่ใส่คีย์นี้เฉพาะเมื่อมีค่า จึงไม่มีทางถูกเขียนเป็น null ลง Mongo
  changes?: SarabanFieldChange[]; // เฉพาะ edited
};

export type SarabanDoc = {
  id: string; // uuid ที่ client สร้าง — เป็น idempotency key ของการออกเลขด้วย
  register: SarabanRegister;
  fiscalYear: number; // ปีงบ พ.ศ. ของวันที่ลงรับ/ออกเลข (ไม่ใช่ของ docDate)
  no: number; // ต่อ (register, fiscalYear) — เริ่มที่ 1 หรือที่เลขเริ่มต้นที่ตั้งไว้
  ref: string; // ที่หนังสือ — รับ: พิมพ์เอง · ส่ง/เวียน: composeRef()
  docDate: string; // ลงวันที่ 'YYYY-MM-DD' ปี ค.ศ. (ต่างจาก fiscalYear ที่เป็น พ.ศ.)
  party: string; // รับ: จาก · ส่ง/เวียน: ถึง
  subject: string;
  level: SarabanLevel;
  dueDate: string; // 'YYYY-MM-DD' ปี ค.ศ. · '' = ไม่กำหนด · ส่ง/เวียนเป็น '' เสมอ
  holderUnitId: string; // รับ: อยู่กับตำแหน่งไหน · ส่ง/เวียน: ส่วนราชการเจ้าของเรื่อง
  status: SarabanStatus;
  sendMethod: SendMethod | ''; // '' จนกว่าจะบันทึกว่าส่งแล้ว
  voidReason: string; // '' ถ้าไม่ได้ยกเลิก
  files: SarabanFile[];
  events: SarabanEvent[];
  registeredAt: string; // ISO
  registeredBy: string; // clerkId หรือ 'dev-open' — ค่าเดียวกับ by ของ event แรก
  updatedAt: string; // ISO — เป็นเวอร์ชันกันการเขียนทับกันด้วย (ดู applyPatch)
};

export type SarabanUnit = {
  id: string; // seed: slug อ่านง่าย · สร้างจากหน้าเว็บ: uuid
  name: string;
  dept: string;
  refCode: string; // 'ชม 55201' — '' = ออกหนังสือส่งไม่ได้
  order: number;
  isActive: boolean; // ปิดแทนการลบ — หนังสืออ้าง id อยู่
  memberClerkIds: string[]; // เริ่มใช้ในรอบ 3
};

// เลขเริ่มต้นของ (ทะเบียน, ปีงบ) — Mongo เก็บด้วย _id = `${register}-${fiscalYear}`
export type SarabanYear = {
  register: SarabanRegister;
  fiscalYear: number; // พ.ศ.
  startNo: number;
  setAt: string; // ISO
  setBy: string; // clerkId หรือ 'dev-open'
};
