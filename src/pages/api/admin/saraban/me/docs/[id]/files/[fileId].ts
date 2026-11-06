import type { NextApiRequest, NextApiResponse } from 'next';
import { CONTENT_TYPES } from '@/lib/saraban-attachment';
import { canSeeDoc } from '@/lib/saraban-member';
import { requireSarabanMember } from '@/lib/saraban-member-guard';
import { sendFileBytes } from '@/lib/saraban-raw';
import { isStorageConfigured, viewUrl } from '@/lib/saraban-storage';
import { getDoc } from '@/lib/saraban-store';

// GET /api/admin/saraban/me/docs/[id]/files/[fileId] — เปิดไฟล์ด้วยเงื่อนไขเห็นเดียวกับตัวหนังสือ
// แล้ว 302 ไปลิงก์ชั่วคราว (แนวเดียวกับ route โหมดเต็ม) · ไม่มี DELETE — ไฟล์เป็นงานของธุรการ
// ?raw=1 ส่ง bytes ผ่านแอปให้ DocViewer (สเปกรอบ 4)

// ?raw=1 ส่ง bytes ผ่านแอป (ไฟล์ถึง 10MB) — ค่าเริ่มต้นของ Next เตือนที่ 4MB
export const config = { api: { responseLimit: '11mb' } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const member = await requireSarabanMember(req, res);
  if (!member) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const fileId = typeof req.query.fileId === 'string' ? req.query.fileId : '';
  if (!id || !fileId) return res.status(400).json({ error: 'missing_id' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isStorageConfigured()) return res.status(503).json({ error: 'storage_not_configured' });

  try {
    const doc = await getDoc(id);
    const file = doc && canSeeDoc(doc, member.unitIds) ? doc.files.find((f) => f.id === fileId) : undefined;
    if (!file) return res.status(404).json({ error: 'not_found' });
    if (req.query.raw === '1') {
      await sendFileBytes(res, file);
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, await viewUrl(file.key, file.name, CONTENT_TYPES[file.format]));
  } catch (err) {
    console.error('GET /api/admin/saraban/me/docs/[id]/files/[fileId] failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
