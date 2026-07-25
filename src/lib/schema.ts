import { z } from 'zod';
import { CONFIG_ID } from '@/types/portal';

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
  label: z.string().min(1),
  order: z.number().int(),
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
