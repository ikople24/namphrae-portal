import { z } from 'zod';

// Zod source of truth for the signup/user-management endpoints, reused by the
// admin forms (same pattern as src/lib/schema.ts).

// ฟอร์มสมัครสมาชิก (/apply). ตั้งใจไม่มีฟิลด์ role — ผู้ดูแลเป็นคนกำหนดตอน
// อนุมัติ ผู้สมัครเลือกเองไม่ได้
export const applyInputSchema = z.object({
  name: z.string().trim().min(1, 'ต้องระบุชื่อ-นามสกุล').max(200),
  position: z.string().trim().min(1, 'ต้องระบุตำแหน่ง').max(200),
  department: z.string().trim().min(1, 'ต้องระบุแผนก/กลุ่มงาน').max(200),
  phone: z.string().trim().min(1, 'ต้องระบุเบอร์โทร').max(50),
});
export type ApplyInput = z.infer<typeof applyInputSchema>;

export const approveBodySchema = z.object({
  role: z.string().trim().min(1, 'ต้องระบุ role').max(100),
});

export const rejectBodySchema = z.object({
  note: z.string().trim().max(500).optional().default(''),
});

export const memberPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    position: z.string().trim().max(200).optional(),
    department: z.string().trim().max(200).optional(),
    role: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().max(50).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'ต้องมีอย่างน้อยหนึ่งฟิลด์',
  });
export type MemberPatchBody = z.infer<typeof memberPatchSchema>;
