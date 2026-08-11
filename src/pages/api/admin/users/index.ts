// src/pages/api/admin/users/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireManager } from '@/lib/auth-server';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { serializeMember } from '@/lib/registry-user';

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
    return res.status(200).json({ members: docs.map(serializeMember) });
  } catch (err) {
    console.error('GET /api/admin/users failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
