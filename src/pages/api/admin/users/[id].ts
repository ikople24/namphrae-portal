// src/pages/api/admin/users/[id].ts
import { ObjectId } from 'mongodb';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireManager } from '@/lib/auth-server';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { buildMemberPatch, serializeMember } from '@/lib/registry-user';
import { memberPatchSchema } from '@/lib/user-schema';

// PATCH /api/admin/users/[id] — edit profile fields and/or toggle isActive.
// กันล็อกตัวเองออก: ปิดการใช้งานบัญชีของตัวเองไม่ได้ (ไม่งั้นแอดมินคนสุดท้าย
// กดพลาดทีเดียว ทั้งหลังบ้านไม่เหลือใครเข้าได้)
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireManager(req, res);
  if (!admin) return;

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    if (!isMongoConfigured()) {
      return res.status(503).json({ error: 'mongo_required' });
    }

    const parsed = memberPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_input', issues: parsed.error.issues });
    }

    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'not_found' });

    const users = (await getUsersDb()).collection('users');
    const existing = await users.findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).json({ error: 'not_found' });

    if (parsed.data.isActive === false && existing.clerkId === admin.userId) {
      return res.status(400).json({ error: 'cannot_deactivate_self' });
    }

    await users.updateOne(
      { _id: existing._id },
      { $set: buildMemberPatch(parsed.data, new Date()) }
    );
    const updated = await users.findOne({ _id: existing._id });
    return res.status(200).json(serializeMember(updated ?? existing));
  } catch (err) {
    console.error('PATCH /api/admin/users/[id] failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
