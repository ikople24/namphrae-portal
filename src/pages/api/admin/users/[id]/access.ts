// src/pages/api/admin/users/[id]/access.ts
import { ObjectId } from 'mongodb';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireManager } from '@/lib/auth-server';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { isEnvManager } from '@/lib/user-access';
import { upsertAccess } from '@/lib/user-access-store';
import { accessPatchSchema } from '@/lib/user-schema';

// PATCH /api/admin/users/[id]/access — ผู้จัดการแก้สิทธิ์ฟีเจอร์/สถานะผู้จัดการ
// รายคน ([id] = _id ของ registry doc เหมือน users/[id].ts) กันล็อกเอาต์สองชั้น:
// ถอดผู้จัดการตัวเองไม่ได้ และถอดผู้จัดการหลักจาก env ไม่ได้
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

    const parsed = accessPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_input', issues: parsed.error.issues });
    }

    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'not_found' });

    const target = await (await getUsersDb())
      .collection('users')
      .findOne({ _id: new ObjectId(id) }, { projection: { clerkId: 1 } });
    if (!target) return res.status(404).json({ error: 'not_found' });

    const clerkId = typeof target.clerkId === 'string' ? target.clerkId : '';
    if (!clerkId) return res.status(400).json({ error: 'no_clerk_id' });

    if (parsed.data.isManager === false) {
      if (clerkId === admin.userId) {
        return res.status(400).json({ error: 'cannot_demote_self' });
      }
      if (isEnvManager(clerkId, process.env.PORTAL_MANAGER_CLERK_ID)) {
        return res.status(400).json({ error: 'cannot_demote_env_manager' });
      }
    }

    await upsertAccess(clerkId, parsed.data, admin.email ?? admin.userId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/users/[id]/access failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
