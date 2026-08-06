// src/pages/api/admin/signups/[id]/approve.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { isMongoConfigured } from '@/lib/mongodb';
import { approveBodySchema } from '@/lib/user-schema';
import { approveSignup } from '@/lib/signups-store';

// POST /api/admin/signups/[id]/approve — body { role }. Inserts the registry
// doc (db_namphrae.users) and marks the application approved. Idempotent: see
// planApproval in src/lib/signups.ts.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    if (!isMongoConfigured()) {
      return res.status(503).json({ error: 'mongo_required' });
    }

    const parsed = approveBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_input', issues: parsed.error.issues });
    }

    const id = typeof req.query.id === 'string' ? req.query.id : '';
    const result = await approveSignup(
      id,
      parsed.data.role,
      admin.email ?? admin.userId
    );
    if (!result.ok) {
      return res
        .status(result.error === 'not_found' ? 404 : 409)
        .json({ error: result.error });
    }
    return res.status(200).json(result.signup);
  } catch (err) {
    console.error('POST /api/admin/signups/[id]/approve failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
