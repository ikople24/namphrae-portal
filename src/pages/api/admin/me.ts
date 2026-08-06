import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { activeRegistryFilter } from '@/lib/registry-user';

// GET /api/admin/me — identity for the sidebar user chip. ใช้ชื่อ-ตำแหน่งจาก
// ทะเบียนสมาชิก (db_namphrae.users) เป็นหลัก เพราะชื่อในบัญชี Clerk มักว่าง
// หรือเป็นอีเมล; email ส่งไปเป็น fallback ให้ฝั่ง UI
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
      return res
        .status(200)
        .json({ name: null, position: null, email: admin.email ?? null });
    }
    const doc = await (await getUsersDb())
      .collection('users')
      .findOne(activeRegistryFilter(admin.userId), {
        projection: { name: 1, position: 1 },
      });
    return res.status(200).json({
      name: typeof doc?.name === 'string' && doc.name ? doc.name : null,
      position:
        typeof doc?.position === 'string' && doc.position ? doc.position : null,
      email: admin.email ?? null,
    });
  } catch (err) {
    console.error('GET /api/admin/me failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
