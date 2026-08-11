// src/pages/api/admin/users/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireManager } from '@/lib/auth-server';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { serializeMember } from '@/lib/registry-user';
import { isEnvManager, resolveAccess } from '@/lib/user-access';
import { getAccessMap } from '@/lib/user-access-store';

// GET /api/admin/users — every registry member (db_namphrae.users), including
// deactivated ones. The portal never deletes registry docs.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireManager(req, res);
  if (!admin) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    if (!isMongoConfigured()) {
      return res.status(503).json({ error: 'mongo_required' });
    }

    const docs = await (await getUsersDb())
      .collection('users')
      .find({})
      .sort({ name: 1 })
      .toArray();
    const members = docs.map(serializeMember);
    const managerEnvId = process.env.PORTAL_MANAGER_CLERK_ID;
    const accessMap = await getAccessMap(
      members.map((m) => m.clerkId).filter((c): c is string => Boolean(c))
    );
    return res.status(200).json({
      members: members.map((m) => ({
        ...m,
        access: m.clerkId
          ? resolveAccess({
              doc: accessMap.get(m.clerkId) ?? null,
              clerkId: m.clerkId,
              managerEnvId,
            })
          : null, // registry doc รุ่นเก่าที่ไม่มี clerkId — กำหนดสิทธิ์ไม่ได้
        isEnvManager: isEnvManager(m.clerkId, managerEnvId),
      })),
    });
  } catch (err) {
    console.error('GET /api/admin/users failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
