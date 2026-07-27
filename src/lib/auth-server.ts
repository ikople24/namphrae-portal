import type { GetServerSideProps, GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';
import { isClerkConfigured } from '@/lib/clerk-config';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';

// SERVER ONLY. Import this only from API routes / getServerSideProps — it pulls
// in @clerk/nextjs/server. For client-safe env checks use '@/lib/clerk-config'.
//
// Clerk is optional. When configured, /admin (pages and APIs) requires a
// signed-in user who ALSO exists in the shared user registry
// (db_namphrae.users, keyed by clerkId — the same registry namphrae-map uses).
// When Clerk is unset the app runs in "dev-open" mode so it boots and is fully
// testable with zero external services. NEVER deploy to production without Clerk.

export { isClerkConfigured } from '@/lib/clerk-config';

export type AdminIdentity = { userId: string; email?: string };

type AuthCheck =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; status: 401 | 403 };

async function checkAdmin(
  req: NextApiRequest | GetServerSidePropsContext['req']
): Promise<AuthCheck> {
  if (!isClerkConfigured()) {
    return { ok: true, identity: { userId: 'dev-open', email: 'dev@local' } }; // dev-open mode
  }

  const { getAuth } = await import('@clerk/nextjs/server');
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401 };

  // File-store dev mode has no registry to consult; Clerk sign-in suffices.
  if (!isMongoConfigured()) return { ok: true, identity: { userId } };

  try {
    const db = await getUsersDb();
    const user = await db
      .collection('users')
      .findOne({ clerkId: userId }, { projection: { email: 1, name: 1 } });
    if (!user) return { ok: false, status: 403 };
    const email = (user.email ?? user.name) as string | undefined;
    return { ok: true, identity: { userId, email } };
  } catch (err) {
    console.error('checkAdmin: registry lookup failed', err);
    return { ok: false, status: 403 }; // registry unreachable → fail closed
  }
}

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
  const check = await checkAdmin(req);
  if (!check.ok) {
    res
      .status(check.status)
      .json({ error: check.status === 401 ? 'unauthorized' : 'forbidden' });
    return null;
  }
  return check.identity;
}

/**
 * SSR guard for /admin pages. Pages export this as getServerSideProps and wrap
 * their component in withMemberGuard (src/components/admin/MemberGuard.tsx),
 * which renders an access-denied screen when `member` is false.
 */
export const getMemberSsrProps: GetServerSideProps<{ member: boolean }> = async (
  ctx
) => {
  const check = await checkAdmin(ctx.req);
  return { props: { member: check.ok } };
};
