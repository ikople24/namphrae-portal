// src/lib/saraban-member-guard.ts
// guard ของ API โหมดเจ้าหน้าที่ (สเปกรอบ 3 ข้อ 2) — SERVER ONLY
// สิทธิ์ = ผูกกับตำแหน่งที่เปิดใช้อย่างน้อยหนึ่ง (ไม่ใช่ฟีเจอร์ saraban) แต่ยังต้องเป็นสมาชิก active
// ในทะเบียนก่อนเสมอ — requireAdmin ตัดสินข้อนั้น การผูกตำแหน่งไม่ใช่ทางลัดข้ามทะเบียน

import type { NextApiRequest, NextApiResponse } from 'next';
import { isClerkConfigured, requireAdmin, type AdminIdentity } from '@/lib/auth-server';
import { memberUnitIdsFor } from '@/lib/saraban-member';
import { listUnits } from '@/lib/saraban-units-store';
import { hasFeature } from '@/lib/user-access';
import type { SarabanUnit } from '@/types/saraban';

export type SarabanMember = {
  admin: AdminIdentity;
  unitIds: string[];
  units: SarabanUnit[]; // สมุดทั้งเล่ม — route ใช้ต่อกับ annotateTransition ไม่ต้องอ่านซ้ำ
  canReceive: boolean;
};

export async function requireSarabanMember(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<SarabanMember | null> {
  const admin = await requireAdmin(req, res);
  if (!admin) return null;
  let units: SarabanUnit[];
  try {
    units = await listUnits();
  } catch (err) {
    console.error('requireSarabanMember: อ่านสมุดผู้รับไม่ได้', err);
    res.status(500).json({ error: 'server_error' });
    return null;
  }
  const unitIds = memberUnitIdsFor({
    clerkOn: isClerkConfigured(),
    userId: admin.userId,
    as: typeof req.query.as === 'string' ? req.query.as : undefined,
    units,
  });
  if (unitIds.length === 0) {
    res.status(403).json({ error: 'not_member' });
    return null;
  }
  return { admin, unitIds, units, canReceive: hasFeature(admin, 'saraban') };
}
