import { z } from 'zod';
import { CONFIG_ID, JOB_KINDS, JOB_STATUSES } from '@/types/portal';
import { SOURCE_FORMATS } from '@/types/map';
import { CATEGORY_COLOR_VALUES } from '@/lib/category-accent';

// A single Zod source of truth, reused by API routes and admin forms.

export const heroMediaSchema = z.object({
  mediaType: z.enum(['none', 'image', 'video']),
  videoUrl: z.string().url().or(z.literal('')).optional(),
  posterUrl: z.string().url().or(z.literal('')).optional(),
  overlayOpacity: z.number().min(0).max(1),
});

export const siteSettingsSchema = z.object({
  orgName: z.string().min(1, 'ต้องระบุชื่อหน่วยงาน'),
  orgSubName: z.string().optional(),
  title: z.string().min(1),
  brandTitle: z.string().optional(),
  tagline: z.string().default(''),
  logoUrl: z.string().url().or(z.literal('')),
  hero: heroMediaSchema,
  contact: z.object({
    phone: z.string().optional(),
    email: z.string().email().or(z.literal('')).optional(),
    address: z.string().optional(),
  }),
  manuals: z
    .array(z.object({ label: z.string().min(1), url: z.string().url() }))
    .optional(),
});

export const categorySchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'slug ใช้ a-z, 0-9, - เท่านั้น'),
  label: z.string().min(1, 'ต้องระบุชื่อหมวด'),
  order: z.number().int(),
  // Curated palette only (see CATEGORY_COLORS); absent = legacy per-id hue.
  color: z.enum(CATEGORY_COLOR_VALUES).optional(),
});

// The editable shape of a link as submitted from the admin form.
export const linkInputSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'slug ใช้ a-z, 0-9, - เท่านั้น'),
  title: z.string().min(1, 'ต้องระบุชื่อบริการ'),
  subtitle: z.string().optional().default(''),
  url: z.string().url('ต้องเป็น URL ที่ถูกต้อง').or(z.literal('')),
  imageUrl: z.string().url().or(z.literal('')).optional().default(''),
  // Material Symbols name (see src/lib/icons.ts). Empty = fall back by id.
  icon: z
    .string()
    .regex(/^[a-z0-9_]*$/, 'ชื่อไอคอนใช้ a-z, 0-9, _ เท่านั้น')
    .optional()
    .default(''),
  categoryId: z.string().min(1),
  openInNewTab: z.boolean().default(true),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  order: z.number().int().default(0),
});

// Full stored link adds the server-owned clickCount.
export const serviceLinkSchema = linkInputSchema.extend({
  clickCount: z.number().int().nonnegative().default(0),
});

export const portalConfigSchema = z.object({
  _id: z.string().default(CONFIG_ID),
  version: z.number().int().nonnegative(),
  updatedAt: z.string(),
  updatedBy: z.string().optional(),
  visitorCount: z.number().int().nonnegative().default(0),
  site: siteSettingsSchema,
  categories: z.array(categorySchema),
  links: z.array(serviceLinkSchema),
  lineGroupId: z.string().optional(),
});

// Import payload: what /admin/data accepts. _id/updatedAt/version are optional
// because a user may paste a hand-edited export.
export const importConfigSchema = portalConfigSchema.partial({
  _id: true,
  version: true,
  updatedAt: true,
  visitorCount: true,
});

export type LinkInput = z.infer<typeof linkInputSchema>;
export type ImportConfig = z.infer<typeof importConfigSchema>;

// ── ปฏิทินปฏิบัติงาน ────────────────────────────────────────────────────────

export const jobKindSchema = z.enum(JOB_KINDS);
export const jobStatusSchema = z.enum(JOB_STATUSES);

// ฟอร์มเดียวชุดฟิลด์เดียวใช้ทั้งงานกู้ชีพและกู้ภัย — งานกู้ภัยเว้นฟิลด์ที่ไม่ใช้ว่างไว้
export const jobInputSchema = z.object({
  kind: jobKindSchema,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD')
    .refine((s) => {
      // เทียบ round-trip เพื่อจับวันที่ที่ไม่มีจริง เช่น 2026-02-30 ที่ Date
      // จะเลื่อนไปเป็น 2 มี.ค. เงียบ ๆ
      const d = new Date(`${s}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }, 'วันที่ไม่มีอยู่จริง'),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'เวลาต้องเป็นรูปแบบ HH:mm'),
  title: z.string().trim().min(1, 'ต้องระบุชื่อผู้ป่วย/ชื่องาน').max(200),
  village: z.string().trim().max(200).optional().default(''),
  origin: z.string().trim().max(200).optional().default(''),
  destination: z.string().trim().max(200).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  // เก็บ note ให้พอส่งต่อเป็นข้อความ LINE push ได้ (LINE จำกัดข้อความที่ 5000
  // ตัวอักษร ค่านี้เว้นระยะกว้าง ๆ ไว้ไม่ให้การ push ล้มเพราะ note ยาวเกิน)
  note: z.string().trim().max(1000).optional().default(''),
});

export type JobInput = z.infer<typeof jobInputSchema>;

// ── คลังไฟล์แผนที่ ──────────────────────────────────────────────────────────

// สิ่งที่เบราว์เซอร์ส่งมาหลังอัปไฟล์ตรงเข้า Cloudinary สำเร็จแล้ว — ตัวไฟล์ไม่ได้
// วิ่งผ่าน API route (เพดาน body 1MB) มีแต่ตัวชี้ไปที่ไฟล์
export const versionRegisterSchema = z.object({
  publicId: z.string().min(1),
  fileName: z.string().min(1).max(300),
  bytes: z.number().int().nonnegative(),
  // ชนิดไฟล์ที่ผู้ใช้เลือกมาแต่แรก — ใช้บันทึกที่มาเท่านั้น ไม่ได้ใช้ตัดสินใจอะไร
  // เพราะ .zip ถูกแปลงเป็น GeoJSON ที่เบราว์เซอร์ไปแล้วก่อนอัป
  sourceFormat: z.enum(SOURCE_FORMATS),
  note: z.string().trim().max(500).optional().default(''),
});

export type VersionRegisterInput = z.infer<typeof versionRegisterSchema>;

// ตั้งค่าเลเยอร์ — ทุกฟิลด์เป็น optional เพราะหน้าตั้งค่าส่งมาทีละส่วน
export const layerPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000),
    keyFields: z.array(z.string().min(1)).max(5),
    keyComposition: z.array(z.array(z.string().min(1)).min(1).max(6)).max(5),
    visibility: z.enum(['public', 'staff']),
    publicFields: z.array(z.string().min(1)).max(200),
    order: z.number().int(),
  })
  .partial()
  .refine(
    (v) =>
      // keyComposition คือ "สูตรประกอบ keyFields[0] กลับจากฟิลด์อื่น" จึงมี
      // ความหมายเฉพาะตอนคีย์เป็นฟิลด์เดียว คีย์ประกอบ (เช่นถนนที่ใช้
      // full_id + zone_id) ไม่มีค่าเดียวให้ประกอบกลับ
      !v.keyComposition ||
      v.keyComposition.length === 0 ||
      (v.keyFields ?? []).length === 1,
    { message: 'ตั้งสูตรประกอบคีย์ได้เฉพาะเลเยอร์ที่ใช้คีย์ฟิลด์เดียว', path: ['keyComposition'] }
  );

export type LayerPatchInput = z.infer<typeof layerPatchSchema>;
