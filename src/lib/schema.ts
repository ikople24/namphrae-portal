import { z } from 'zod';
import { CONFIG_ID } from '@/types/portal';
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

export const jobKindSchema = z.enum(['ems', 'rescue']);
export const jobStatusSchema = z.enum([
  'pending',
  'approved',
  'done',
  'cancelled',
]);

// ฟอร์มเดียวชุดฟิลด์เดียวใช้ทั้งงานกู้ชีพและกู้ภัย — งานกู้ภัยเว้นฟิลด์ที่ไม่ใช้ว่างไว้
export const jobInputSchema = z.object({
  kind: jobKindSchema,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD'),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'เวลาต้องเป็นรูปแบบ HH:mm'),
  title: z.string().min(1, 'ต้องระบุชื่อผู้ป่วย/ชื่องาน'),
  village: z.string().optional().default(''),
  origin: z.string().optional().default(''),
  destination: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  note: z.string().optional().default(''),
});

export type JobInput = z.infer<typeof jobInputSchema>;
