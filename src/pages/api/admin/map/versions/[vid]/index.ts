import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { destroyRawAsset } from '@/lib/cloudinary';
import { getVersion, patchVersion } from '@/lib/map-store';

// ทิ้งร่าง — ทิ้งได้เฉพาะร่างเท่านั้น
//
// เอกสารไม่ถูกลบ แค่เปลี่ยนสถานะเป็น discarded: ประวัติว่าใครอัปอะไรเมื่อไรและ
// ผลตรวจเป็นอย่างไรคือร่องรอยของงานราชการ ห้ามหายไปพร้อมไฟล์ ส่วนตัวไฟล์เต็ม
// ถูกลบทิ้งจริงเพราะร่างที่ถูกทิ้งไม่มีทางถูกเผยแพร่ได้อีก
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const version = await getVersion(String(req.query.vid));
  if (!version) return res.status(404).json({ error: 'version_not_found' });

  if (version.status !== 'draft') {
    return res.status(409).json({
      error: 'not_a_draft',
      message:
        'ทิ้งได้เฉพาะร่างที่ยังไม่เผยแพร่ — เวอร์ชันที่เคยเผยแพร่แล้วต้องเก็บไว้เป็นประวัติและเพื่อให้ย้อนกลับได้',
    });
  }

  if (version.fullAsset) {
    try {
      await destroyRawAsset(version.fullAsset.publicId, 'authenticated');
    } catch (err) {
      // ลบไฟล์ไม่สำเร็จไม่ควรกันไม่ให้ทิ้งร่าง — ไฟล์กำพร้าเก็บกวาดทีหลังได้
      console.warn('map discard: destroying full asset failed', err);
    }
  }

  await patchVersion(version.id, { status: 'discarded', fullAsset: null });
  return res.status(200).json({ ok: true });
}
