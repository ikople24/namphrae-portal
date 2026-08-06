import type { GetServerSideProps, GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';
import { isClerkConfigured } from '@/lib/clerk-config';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { allowAdminWithoutRegistry } from '@/lib/admin-registry-gate';
import { activeRegistryFilter } from '@/lib/registry-user';

// SERVER ONLY. Import this only from API routes / getServerSideProps — it pulls
// in @clerk/nextjs/server. For client-safe env checks use '@/lib/clerk-config'.
//
// Clerk is optional. When configured, /admin (pages and APIs) requires a
// signed-in user who ALSO exists as an ACTIVE, non-archived entry in the
// shared user registry (db_namphrae.users, keyed by clerkId — the same
// registry namphrae-map uses). When Clerk is unset the app runs in "dev-open"
// mode so it boots and is fully testable with zero external services.
// NEVER deploy to production without Clerk.

export { isClerkConfigured } from '@/lib/clerk-config';

export type AdminIdentity = { userId: string; email?: string };

type AuthCheck =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; status: 401 | 403 };

export async function checkAdmin(
  req: NextApiRequest | GetServerSidePropsContext['req']
): Promise<AuthCheck> {
  if (!isClerkConfigured()) {
    return { ok: true, identity: { userId: 'dev-open', email: 'dev@local' } }; // dev-open mode
  }

  const { getAuth } = await import('@clerk/nextjs/server');
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401 };

  // ไม่มีทะเบียนให้ตรวจ = ตัดสินไม่ได้ว่าใครเป็นเจ้าหน้าที่ ซึ่งเป็นสถานการณ์
  // เดียวกับ "ทะเบียนล่ม" ด้านล่างที่ปฏิเสธไปแล้ว — production จึงต้องปฏิเสธ
  // เหมือนกัน ไม่งั้นการลืม MONGODB_URI ตัวเดียวจะเปลี่ยนหลังบ้านให้เปิดรับ
  // ทุกคนที่ล็อกอิน Clerk ได้ โดยเว็บยังเสิร์ฟ seed ต่อไปเหมือนไม่มีอะไรเกิดขึ้น
  if (!isMongoConfigured()) {
    if (!allowAdminWithoutRegistry(process.env.NODE_ENV)) {
      console.error(
        'checkAdmin: ตั้ง Clerk ไว้แต่ไม่มี MONGODB_URI — ปฏิเสธการเข้าหลังบ้านทั้งหมด ' +
          '(ตั้ง MONGODB_URI ให้ครบเพื่อให้ทะเบียนผู้ใช้กลับมาทำงาน)'
      );
      return { ok: false, status: 403 };
    }
    console.warn('checkAdmin: Clerk configured but Mongo is not — registry gate skipped (dev)');
    return { ok: true, identity: { userId } };
  }

  try {
    const db = await getUsersDb();
    const user = await db
      .collection('users')
      .findOne(activeRegistryFilter(userId), { projection: { email: 1, name: 1 } });
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
 *
 * A signed-in visitor who is not (or no longer) an active member is redirected
 * to /apply — the application flow — instead of a dead-end screen. 401 keeps
 * the AccessDenied fallback (the proxy normally redirects signed-out visitors
 * to /sign-in before they reach here).
 */
export const getMemberSsrProps: GetServerSideProps<{ member: boolean }> = async (
  ctx
) => {
  const check = await checkAdmin(ctx.req);
  if (!check.ok && check.status === 403 && isClerkConfigured()) {
    return { redirect: { destination: '/apply', permanent: false } };
  }
  return { props: { member: check.ok } };
};
