// src/pages/api/admin/signups/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { isMongoConfigured } from '@/lib/mongodb';
import { countPendingSignups, listPendingSignups } from '@/lib/signups-store';

// GET /api/admin/signups             → { signups, pendingCount }
// GET /api/admin/signups?countOnly=1 → { pendingCount }  (sidebar badge — cheap)
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    if (!isMongoConfigured()) {
      return res.status(503).json({ error: 'mongo_required' });
    }

    if (req.query.countOnly) {
      return res.status(200).json({ pendingCount: await countPendingSignups() });
    }
    const signups = await listPendingSignups();
    return res.status(200).json({ signups, pendingCount: signups.length });
  } catch (err) {
    console.error('GET /api/admin/signups failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
