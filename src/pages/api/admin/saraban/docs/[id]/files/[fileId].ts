import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { resolveActor } from '@/lib/saraban-actor';
import { CONTENT_TYPES } from '@/lib/saraban-attachment';
import { canRemoveFile, makeEvent } from '@/lib/saraban-doc';
import { deleteObject, isStorageConfigured, viewUrl } from '@/lib/saraban-storage';
import { getDoc, removeFile } from '@/lib/saraban-store';

// GET    /api/admin/saraban/docs/[id]/files/[fileId] — ตรวจสิทธิ์แล้ว 302 ไปลิงก์ชั่วคราว 5 นาที
//        (ไม่ stream ผ่านแอป) · ลิงก์นี้คือทางเดียวที่เปิดไฟล์ได้ เพราะ bucket เป็น private
// DELETE /api/admin/saraban/docs/[id]/files/[fileId] — เอาออกจากหนังสือก่อน แล้วค่อยลบ object
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const fileId = typeof req.query.fileId === 'string' ? req.query.fileId : '';
  if (!id || !fileId) return res.status(400).json({ error: 'missing_id' });
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'GET, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isStorageConfigured()) return res.status(503).json({ error: 'storage_not_configured' });

  try {
    const doc = await getDoc(id);
    const file = doc?.files.find((f) => f.id === fileId);
    if (!doc || !file) return res.status(404).json({ error: 'not_found' });

    if (req.method === 'GET') {
      // ลิงก์มีอายุ — ห้าม cache การ redirect ไม่งั้นเบราว์เซอร์พาไปลิงก์ที่หมดอายุแล้ว
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, await viewUrl(file.key, file.name, CONTENT_TYPES[file.format]));
    }

    if (!canRemoveFile(doc)) {
      return res.status(409).json({ error: 'invalid_transition', status: doc.status });
    }
    const event = makeEvent({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actor: await resolveActor(admin),
      kind: 'file-removed',
      note: file.name,
    });
    const updated = await removeFile(id, fileId, event);
    if (!updated) return res.status(409).json({ error: 'invalid_transition' });
    // ลบ object หลัง DB สำเร็จเท่านั้น — พลาดตรงนี้ = ไฟล์กำพร้าหนึ่งไฟล์ ไม่ใช่ DB ชี้ไฟล์ที่หายไป
    await deleteObject(file.key).catch((err) =>
      console.warn('DELETE file: ลบ object ไม่สำเร็จ เหลือไฟล์กำพร้า', file.key, err)
    );
    return res.status(200).json(updated);
  } catch (err) {
    console.error(`${req.method} /api/admin/saraban/docs/[id]/files/[fileId] failed`, err);
    return res.status(500).json({ error: 'server_error' });
  }
}
