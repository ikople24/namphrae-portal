import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { getFile } from '@/lib/file-library-store';
import { CONTENT_TYPES } from '@/lib/saraban-attachment';
import { isStorageConfigured, viewUrl } from '@/lib/saraban-storage';

// GET /api/admin/files/[id]/view — สมาชิกทุกคน · 302 ไปลิงก์ชั่วคราว 5 นาที (ไม่ stream ผ่านแอป)
// ลิงก์นี้คือทางเดียวที่เปิดไฟล์ได้ เพราะ bucket เป็น private
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });
  if (!isStorageConfigured()) return res.status(503).json({ error: 'storage_not_configured' });

  try {
    const file = await getFile(id);
    if (!file) return res.status(404).json({ error: 'not_found' });
    // ลิงก์มีอายุ — ห้าม cache การ redirect ไม่งั้นเบราว์เซอร์พาไปลิงก์ที่หมดอายุแล้ว
    res.setHeader('Cache-Control', 'no-store');
    // ไม่ return ค่าของ res.redirect — Next เตือน "API handler should not return a value"
    res.redirect(302, await viewUrl(file.key, file.fileName, CONTENT_TYPES[file.format]));
    return;
  } catch (err) {
    console.error('GET /api/admin/files/[id]/view failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
