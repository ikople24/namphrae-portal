import type { GetServerSideProps, GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';
import { isClerkConfigured } from '@/lib/clerk-config';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { allowAdminWithoutRegistry } from '@/lib/admin-registry-gate';
import { activeRegistryFilter } from '@/lib/registry-user';
import {
  FEATURES,
  firstAllowedPath,
  hasFeature,
  resolveAccess,
  type FeatureKey,
} from '@/lib/user-access';
import { getAccessDoc } from '@/lib/user-access-store';

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

export type AdminIdentity = {
  userId: string;
  email?: string;
  features: FeatureKey[];
  isManager: boolean;
};

type AuthCheck =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; status: 401 | 403 };

export async function checkAdmin(
  req: NextApiRequest | GetServerSidePropsContext['req']
): Promise<AuthCheck> {
  if (!isClerkConfigured()) {
    // dev-open mode — เปิดครบทุกสิทธิ์ให้ทดสอบได้โดยไม่ตั้งค่าอะไรเลย
    return {
      ok: true,
      identity: {
        userId: 'dev-open',
        email: 'dev@local',
        features: [...FEATURES],
        isManager: true,
      },
    };
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
    return {
      ok: true,
      identity: { userId, features: [...FEATURES], isManager: true },
    };
  }

  try {
    const db = await getUsersDb();
    const user = await db
      .collection('users')
      .findOne(activeRegistryFilter(userId), { projection: { email: 1, name: 1 } });
    if (!user) return { ok: false, status: 403 };
    const email = (user.email ?? user.name) as string | undefined;
    // ชั้นสิทธิ์ของ Portal เอง (namphrae_portal.userAccess) — อยู่ใน try เดียว
    // กับ registry: อ่านพลาดเมื่อไหร่ก็ fail closed แบบเดียวกัน
    const access = resolveAccess({
      doc: await getAccessDoc(userId),
      clerkId: userId,
      managerEnvId: process.env.PORTAL_MANAGER_CLERK_ID,
    });
    return { ok: true, identity: { userId, email, ...access } };
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

/** Guard API ตามฟีเจอร์: สมาชิกที่ไม่ได้รับฟีเจอร์นั้น → 403 feature_denied */
export async function requireFeature(
  req: NextApiRequest,
  res: NextApiResponse,
  feature: FeatureKey
): Promise<AdminIdentity | null> {
  const admin = await requireAdmin(req, res);
  if (!admin) return null;
  if (!hasFeature(admin, feature)) {
    res.status(403).json({ error: 'feature_denied' });
    return null;
  }
  return admin;
}

/** Guard API เฉพาะผู้จัดการ (จัดการสมาชิก/สิทธิ์) */
export async function requireManager(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AdminIdentity | null> {
  const admin = await requireAdmin(req, res);
  if (!admin) return null;
  if (!admin.isManager) {
    res.status(403).json({ error: 'manager_only' });
    return null;
  }
  return admin;
}

export type AdminPageProps = { member: boolean; forbidden?: boolean };

/**
 * SSR guard ของหน้า /admin. Pages export ตัวนี้เป็น getServerSideProps และห่อ
 * component ด้วย withMemberGuard (src/components/admin/MemberGuard.tsx)
 *
 * - ไม่ใช่สมาชิก (403 + Clerk on) → redirect /apply เหมือนเดิม; 401 คงการ์ด
 *   AccessDenied (ปกติ proxy เด้งคนยังไม่ล็อกอินไป /sign-in ก่อนถึงตรงนี้)
 * - เป็นสมาชิกแต่ไม่มีสิทธิ์หน้านี้ → เด้งไปหน้าแรกที่ตัวเองมีสิทธิ์ ปลายทาง
 *   ผ่าน guard ของตัวเองเสมอเพราะ firstAllowedPath เลือกจาก features ของคน
 *   นั้นเอง — ไม่มีลูป
 * - ไม่มีสิทธิ์ฟีเจอร์ใดเลย → การ์ด forbidden (ห้าม redirect ไม่งั้นวนลูป)
 */
function buildSsrGuard(
  allowed: (identity: AdminIdentity) => boolean
): GetServerSideProps<AdminPageProps> {
  return async (ctx) => {
    const check = await checkAdmin(ctx.req);
    if (!check.ok) {
      if (check.status === 403 && isClerkConfigured()) {
        return { redirect: { destination: '/apply', permanent: false } };
      }
      return { props: { member: false } };
    }
    if (allowed(check.identity)) return { props: { member: true } };
    const destination = firstAllowedPath(check.identity);
    if (destination) return { redirect: { destination, permanent: false } };
    return { props: { member: true, forbidden: true } };
  };
}

export function getFeatureSsrProps(
  feature: FeatureKey
): GetServerSideProps<AdminPageProps> {
  return buildSsrGuard((identity) => hasFeature(identity, feature));
}

export const getManagerSsrProps: GetServerSideProps<AdminPageProps> =
  buildSsrGuard((identity) => identity.isManager);
