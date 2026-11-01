import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { renameBodySchema, toListItem } from '@/lib/file-library';
import { removeFile, renameFile } from '@/lib/file-library-store';
import { deleteObject, isStorageConfigured } from '@/lib/saraban-storage';

// PATCH  /api/admin/files/[id] { title } — แก้ชื่อเรื่อง
// DELETE /api/admin/files/[id] — ลบรายการก่อน แล้วค่อยลบ object
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'files');
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method === 'PATCH') {
    const parsed = renameBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_title' });
    try {
      const updated = await renameFile(id, parsed.data.title);
      if (!updated) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(toListItem(updated));
    } catch (err) {
      console.error('PATCH /api/admin/files/[id] failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (req.method === 'DELETE') {
    // ไม่มี storage = ลบ object ไม่ได้ — ห้ามลบแถวแล้วทิ้ง object ไว้เงียบ ๆ (ไม่มีเครื่องมือไล่หาไฟล์
    // กำพร้าใต้ files/) ตอบ 503 ก่อนแตะ DB แบบเดียวกับ saraban/docs/[id]/files/[fileId].ts
    if (!isStorageConfigured()) return res.status(503).json({ error: 'storage_not_configured' });
    try {
      const removed = await removeFile(id);
      if (!removed) return res.status(404).json({ error: 'not_found' });
      // ลบ object หลัง DB สำเร็จเท่านั้น — พลาดตรงนี้ = ไฟล์กำพร้าหนึ่งไฟล์ ไม่ใช่รายการที่ชี้ไฟล์ที่หายไป
      await deleteObject(removed.key).catch((err) =>
        console.warn('DELETE /api/admin/files/[id]: ลบ object ไม่สำเร็จ เหลือไฟล์กำพร้า', removed.key, err)
      );
      return res.status(204).end();
    } catch (err) {
      console.error('DELETE /api/admin/files/[id] failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
