import type { NextApiRequest, NextApiResponse } from 'next';
import { requireManager } from '@/lib/auth-server';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { activeRegistryFilter } from '@/lib/registry-user';
import { unitMembersSchema } from '@/lib/saraban-schema';
import { setUnitMembers } from '@/lib/saraban-units-store';

// PUT /api/admin/saraban/units/[id]/members — ผูกคนเข้าตำแหน่ง (สเปกรอบ 3 ข้อ 2) ผู้จัดการเท่านั้น
// เพราะผูกคน = ให้สิทธิ์เห็นหนังสือของตำแหน่งนั้น · แยกจาก PATCH units/[id] ที่ธุรการใช้แก้ชื่อ/รหัส
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireManager(req, res);
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const parsed = unitMembersSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  }
  const { clerkIds } = parsed.data;

  try {
    // ทุกคนต้องเป็นสมาชิก active ในทะเบียน · ไม่มีทะเบียน (dev / แบ็กเอนด์ไฟล์) ข้ามการตรวจ
    // แนวเดียวกับ checkAdmin ที่ข้ามทะเบียนใน dev
    if (isMongoConfigured() && clerkIds.length > 0) {
      const users = (await getUsersDb()).collection('users');
      const found = await Promise.all(
        clerkIds.map((clerkId) => users.countDocuments(activeRegistryFilter(clerkId), { limit: 1 }))
      );
      if (found.some((n) => n === 0)) return res.status(400).json({ error: 'invalid_member' });
    }
    const unit = await setUnitMembers(id, clerkIds);
    return unit ? res.status(200).json(unit) : res.status(404).json({ error: 'not_found' });
  } catch (err) {
    console.error('PUT /api/admin/saraban/units/[id]/members failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
