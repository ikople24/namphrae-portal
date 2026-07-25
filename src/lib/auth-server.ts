import type { NextApiRequest, NextApiResponse } from 'next';
import { isClerkConfigured } from '@/lib/clerk-config';

// SERVER ONLY. Import this only from API routes / getServerSideProps — it pulls
// in @clerk/nextjs/server. For client-safe env checks use '@/lib/clerk-config'.
//
// Clerk is optional. When configured, /api/admin/* requires an authenticated
// admin. When unset the app runs in "dev-open" mode so it boots and is fully
// testable with zero external services. NEVER deploy to production without Clerk.

export { isClerkConfigured } from '@/lib/clerk-config';

// Optional allowlist. If ADMIN_EMAILS is set, the signed-in user's email must be
// in it. Otherwise any signed-in Clerk user is treated as admin.
function emailAllowed(email: string | null | undefined): boolean {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return true;
  if (!email) return false;
  const allow = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

export type AdminIdentity = { userId: string; email?: string };

/**
 * Guard an API route. Returns the admin identity, or null after having already
 * written a 401/403 response.
 *
 *   const admin = await requireAdmin(req, res);
 *   if (!admin) return; // response already sent
 */
export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AdminIdentity | null> {
  if (!isClerkConfigured()) {
    return { userId: 'dev-open', email: 'dev@local' }; // dev-open mode
  }

  const { getAuth, clerkClient } = await import('@clerk/nextjs/server');
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }

  let email: string | undefined;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress;
  } catch {
    // If the email cannot be resolved but an allowlist is required, deny below.
  }

  if (!emailAllowed(email)) {
    res.status(403).json({ error: 'forbidden' });
    return null;
  }

  return { userId, email };
}
