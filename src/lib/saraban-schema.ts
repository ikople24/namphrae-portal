// src/lib/saraban-schema.ts
// zod ของทุกคำขอในระบบสารบรรณรอบ 1 — ใช้ร่วมทั้ง API และฟอร์ม (แนวเดียวกับ schema.ts)

import { z } from 'zod';
import { MAX_FILES_PER_DOC } from '@/lib/saraban-attachment';
import { REGISTER_VIEWS } from '@/lib/saraban-doc';
import { SARABAN_LEVELS, SARABAN_REGISTERS, SEND_METHODS } from '@/types/saraban';

/**
 * วันที่ในฟอร์ม — round-trip จับวันที่ไม่มีจริง (2026-02-30) แบบ jobInputSchema บวกช่วงปี
 * ค.ศ. 1900–2100 แบบ iso-date.ts: ช่อง <input type="date"> รับปี 2569 ได้เงียบ ๆ ซึ่งเป็นวันที่
 * ที่มีจริง (ค.ศ. 2569) ผ่านการตรวจแรกไปสบาย แต่คลาดไป 543 ปี
 */
export const realDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'วันที่ไม่มีอยู่จริง')
  .refine((s) => {
    const year = Number(s.slice(0, 4));
    return year >= 1900 && year <= 2100;
  }, 'ปีต้องเป็น ค.ศ. — ดูเหมือนจะพิมพ์ปี พ.ศ. ลงไป');

const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);

// สิ่งที่เบราว์เซอร์ส่งมาหลังอัปผ่าน uploads.ts — ตัวชี้อย่างเดียว ชนิด ขนาด และจำนวนหน้า
// เซิร์ฟเวอร์อ่านจาก object เอง (checkAttachment) ไม่รับจากตรงนี้ · zod ทิ้งคีย์ที่ไม่ได้ประกาศ
export const fileRefSchema = z.object({
  key: z.string().min(1).max(300),
  name: z.string().trim().min(1).max(200),
});
export type FileRef = z.infer<typeof fileRefSchema>;

const filesSchema = z
  .array(fileRefSchema)
  .max(MAX_FILES_PER_DOC, `แนบได้ไม่เกิน ${MAX_FILES_PER_DOC} ไฟล์`)
  .default([]);

// id สร้างที่ client ครั้งเดียวต่อการเปิดฟอร์ม — กดซ้ำหรือเน็ตหลุดแล้วส่งใหม่ได้หนังสือเดิม
// ไม่ได้เลขที่สอง (สเปกข้อ 4 "idempotency")
export const receiveInputSchema = z.object({
  id: z.uuid(),
  ref: requiredText(100, 'ต้องระบุที่หนังสือ'),
  docDate: realDateSchema,
  party: requiredText(200, 'ต้องระบุหน่วยงานผู้ส่ง'),
  subject: requiredText(500, 'ต้องระบุเรื่อง'),
  level: z.enum(SARABAN_LEVELS).default('normal'),
  holderUnitId: z.string().min(1, 'ต้องเลือกผู้รับเสนอ').max(100),
  dueDate: realDateSchema.or(z.literal('')).default(''),
  files: filesSchema,
});
export type ReceiveInput = z.infer<typeof receiveInputSchema>;

// ไม่มีช่อง "ที่" — ระบบประกอบจาก refCode ของเจ้าของเรื่องกับเลขที่ออกให้ (composeRef)
export const sendInputSchema = z.object({
  id: z.uuid(),
  ownerUnitId: z.string().min(1, 'ต้องเลือกส่วนราชการเจ้าของเรื่อง').max(100),
  circular: z.boolean().default(false),
  docDate: realDateSchema,
  party: requiredText(200, 'ต้องระบุผู้รับหนังสือ'),
  subject: requiredText(500, 'ต้องระบุเรื่อง'),
  level: z.enum(SARABAN_LEVELS).default('normal'),
  files: filesSchema,
});
export type SendInput = z.infer<typeof sendInputSchema>;

// ช่องที่แก้ได้ทุกช่องเป็น optional — ช่องไหนแก้ได้จริงตัดสินที่ buildEdit() ตามสถานะ
const editSchema = z
  .object({
    ref: requiredText(100, 'ต้องระบุที่หนังสือ'),
    docDate: realDateSchema,
    party: requiredText(200, 'ต้องระบุหน่วยงาน'),
    subject: requiredText(500, 'ต้องระบุเรื่อง'),
    level: z.enum(SARABAN_LEVELS),
    dueDate: realDateSchema.or(z.literal('')),
    holderUnitId: z.string().min(1).max(100),
  })
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'ต้องมีอย่างน้อยหนึ่งช่อง',
  });

/**
 * PATCH /api/admin/saraban/docs/[id] — แยกตาม action (สเปกข้อ 6) แนวเดียวกับ PATCH ของ
 * ปฏิทินที่รวมการแก้กับการเปลี่ยนสถานะไว้ที่ route เดียว
 *
 * updatedAt = เวอร์ชันของหนังสือที่หน้าจอเห็นตอนกด — applyPatch เขียนได้เฉพาะเมื่อยังตรง
 * กับใน DB กันสองคนแก้/ยกเลิกเรื่องเดียวกันพร้อมกันแล้วคนหลังเขียนทับเงียบ ๆ
 */
export const docPatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('edit'), updatedAt: z.string().min(1), edit: editSchema }),
  z.object({
    action: z.literal('void'),
    updatedAt: z.string().min(1),
    reason: requiredText(500, 'ต้องระบุเหตุผลที่ยกเลิก'),
  }),
  z.object({ action: z.literal('sent'), updatedAt: z.string().min(1), method: z.enum(SEND_METHODS) }),
]);
export type DocPatch = z.infer<typeof docPatchSchema>;

// ระบบต่อ "/เลข" ท้ายรหัสเอง — รหัสที่มี '/' จะได้ "ที่" หน้าตาเพี้ยนอย่าง 'ชม 55201//388'
const refCodeSchema = z
  .string()
  .trim()
  .max(30)
  .refine((s) => !s.includes('/'), "รหัสส่วนราชการห้ามมี '/' — ระบบต่อ /เลข ให้เอง");

const unitFields = {
  name: requiredText(100, 'ต้องระบุชื่อตำแหน่ง/หน่วยงาน'),
  dept: z.string().trim().max(100),
  refCode: refCodeSchema,
  order: z.number().int(),
  isActive: z.boolean(),
};

export const unitInputSchema = z.object({
  ...unitFields,
  dept: unitFields.dept.default(''),
  refCode: unitFields.refCode.default(''),
  order: unitFields.order.default(0),
  isActive: unitFields.isActive.default(true),
});
export type UnitInput = z.infer<typeof unitInputSchema>;

export const unitPatchSchema = z
  .object(unitFields)
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'ต้องมีอย่างน้อยหนึ่งช่อง',
  });
export type UnitPatch = z.infer<typeof unitPatchSchema>;

export const yearStartSchema = z.object({
  register: z.enum(SARABAN_REGISTERS),
  fiscalYear: z.number().int().min(2500).max(2700),
  startNo: z.number().int().min(1, 'เลขเริ่มต้นต้องไม่น้อยกว่า 1').max(99999),
});
export type YearStartInput = z.infer<typeof yearStartSchema>;

// GET /api/admin/saraban/docs — ค่าจาก query string เป็นสตริงทั้งหมดจึงต้อง coerce
export const docListQuerySchema = z.object({
  register: z.enum(SARABAN_REGISTERS),
  year: z.coerce.number().int().min(2500).max(2700).optional(),
  view: z.enum(REGISTER_VIEWS).default('all'),
  page: z.coerce.number().int().min(1).default(1),
});
export type DocListQuery = z.infer<typeof docListQuerySchema>;
