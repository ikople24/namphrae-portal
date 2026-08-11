import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { hasFeature } from '@/lib/user-access';
import { getConfig, saveConfig } from '@/lib/config-store';
import { revalidateHome } from '@/lib/revalidate';
import { importConfigSchema } from '@/lib/schema';
import { CONFIG_ID, type PortalConfig } from '@/types/portal';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const config = await getConfig();
    return res.status(200).json(config);
  }

  // PUT = full import (overwrite the whole document) — เป็นของฟีเจอร์ data
  // (หน้า นำเข้า/ส่งออก) ส่วน GET เปิดให้สมาชิกทุกคนเพราะหน้า links/categories/
  // data/settings อ่าน config ร่วมกัน
  if (req.method === 'PUT') {
    if (!hasFeature(admin, 'data')) {
      return res.status(403).json({ error: 'feature_denied' });
    }
    const parsed = importConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_config', issues: parsed.error.issues });
    }
    const current = await getConfig();
    const next: PortalConfig = {
      _id: CONFIG_ID,
      version: current.version, // saveConfig bumps this
      updatedAt: current.updatedAt,
      visitorCount: parsed.data.visitorCount ?? current.visitorCount,
      site: parsed.data.site,
      categories: parsed.data.categories,
      links: parsed.data.links,
      // ใช้ || ไม่ใช่ ?? โดยตั้งใจ: import เปลี่ยนค่านี้ได้ แต่ backup เก่าที่
      // เก็บ '' (ยุคก่อนมี LINE) ต้องไม่ไปเคลียร์ค่าที่ตั้งอยู่แล้วทิ้งเงียบ ๆ
      // — group id เป็นค่าโครงสร้างพื้นฐานที่ webhook จับตอนบอทเข้ากลุ่ม
      // ครั้งเดียว ไม่มีทางเรียก webhook ซ้ำเพื่อกู้คืน หายแล้วแจ้งเตือนเงียบ
      lineGroupId: parsed.data.lineGroupId || current.lineGroupId,
    };
    const saved = await saveConfig(next, admin.email ?? admin.userId);
    await revalidateHome(res);
    return res.status(200).json(saved);
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'method_not_allowed' });
}
