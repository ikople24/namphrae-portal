// src/pages/api/apply.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { isClerkConfigured } from '@/lib/clerk-config';
import { isMongoConfigured } from '@/lib/mongodb';
import { applyInputSchema } from '@/lib/user-schema';
import { rateLimit } from '@/lib/rate-limit';
import {
  createSignup,
  findRegistryUserByClerkId,
  getLatestSignupByClerkId,
  DuplicatePendingSignupError,
} from '@/lib/signups-store';

// POST /api/apply — submit a membership application. Identity (clerkId, email)
// comes from the Clerk session, NEVER from the body — ไม่งั้นใครก็ยื่นสมัคร
// แทนคนอื่นได้. Not under /api/admin: applicants are by definition not members.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    // dev-open mode has no signup concept — everyone is already "in".
    if (!isClerkConfigured()) {
      return res.status(400).json({ error: 'clerk_not_configured' });
    }
    // ใบสมัครเป็นข้อมูลบุคคล ต้องลง Mongo เท่านั้น — ไม่มี file fallback แบบ
    // jobs-store โดยตั้งใจ
    if (!isMongoConfigured()) {
      return res.status(503).json({ error: 'mongo_required' });
    }

    const { getAuth, clerkClient } = await import('@clerk/nextjs/server');
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    // Applying is a rare, deliberate human action, not something a legit
    // client ever retries in a loop — 5/min per user is generous headroom
    // while still blunting double-submits and abuse.
    if (!rateLimit(`apply:${userId}`, 5, 60_000)) {
      return res.status(429).json({ error: 'rate_limited' });
    }

    const parsed = applyInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_input', issues: parsed.error.issues });
    }

    const registry = await findRegistryUserByClerkId(userId);
    if (registry) {
      const active = registry.isActive !== false && registry.isArchived !== true;
      return res
        .status(active ? 409 : 403)
        .json({ error: active ? 'already_member' : 'deactivated' });
    }

    const latest = await getLatestSignupByClerkId(userId);
    if (latest?.status === 'pending') {
      return res.status(409).json({ error: 'already_pending' });
    }

    // email is best-effort display data for the queue — the application stands
    // without it.
    let email: string | null = null;
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      email = user.primaryEmailAddress?.emailAddress ?? null;
    } catch (err) {
      console.warn('apply: could not fetch email from Clerk', err);
    }

    const signup = await createSignup(userId, email, parsed.data);
    return res.status(201).json(signup);
  } catch (err) {
    // A concurrent duplicate insert caught by the unique partial index on
    // pendingSignups (see signups-store.ts) surfaces here as the same
    // already_pending response the upfront check produces.
    if (err instanceof DuplicatePendingSignupError) {
      return res.status(409).json({ error: 'already_pending' });
    }
    console.error('POST /api/apply failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
