// src/pages/api/admin/signups/[id]/reject.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { isMongoConfigured } from '@/lib/mongodb';
import { rejectBodySchema } from '@/lib/user-schema';
import { rejectSignup } from '@/lib/signups-store';

// POST /api/admin/signups/[id]/reject — body { note? }. Only a pending
// application can be rejected; the applicant sees the note and may re-apply.
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

    const parsed = rejectBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_input', issues: parsed.error.issues });
    }

    const id = typeof req.query.id === 'string' ? req.query.id : '';
    const result = await rejectSignup(
      id,
      parsed.data.note,
      admin.email ?? admin.userId
    );
    if (!result.ok) {
      return res
        .status(result.error === 'not_found' ? 404 : 409)
        .json({ error: result.error });
    }
    return res.status(200).json(result.signup);
  } catch (err) {
    console.error('POST /api/admin/signups/[id]/reject failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
