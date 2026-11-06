import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { resolveActor } from '@/lib/saraban-actor';
import { CONTENT_TYPES } from '@/lib/saraban-attachment';
import { canRemoveFile, makeEvent } from '@/lib/saraban-doc';
import { isFileReferenced } from '@/lib/saraban-mark';
import { sendFileBytes } from '@/lib/saraban-raw';
import { deleteObject, isStorageConfigured, viewUrl } from '@/lib/saraban-storage';
import { getDoc, removeFile } from '@/lib/saraban-store';

// GET    /api/admin/saraban/docs/[id]/files/[fileId] — ตรวจสิทธิ์แล้ว 302 ไปลิงก์ชั่วคราว 5 นาที
//        ?raw=1 ส่ง bytes ผ่านแอปแทน (pdf.js ของ DocViewer — สเปกรอบ 4) · bucket เป็น private เสมอ
// DELETE /api/admin/saraban/docs/[id]/files/[fileId] — เอาออกจากหนังสือก่อน แล้วค่อยลบ object
//        ไฟล์ที่มีตรา/ลายมือ/การลงนามอ้าง → 409 file_referenced

// ?raw=1 ส่ง bytes ผ่านแอป (ไฟล์ถึง 10MB) — ค่าเริ่มต้นของ Next เตือนที่ 4MB
export const config = { api: { responseLimit: '11mb' } };

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
      if (req.query.raw === '1') {
        await sendFileBytes(res, file);
        return;
      }
      // ลิงก์มีอายุ — ห้าม cache การ redirect ไม่งั้นเบราว์เซอร์พาไปลิงก์ที่หมดอายุแล้ว
      res.setHeader('Cache-Control', 'no-store');
      // ไม่ return ค่าของ res.redirect — Next เตือน "API handler should not return a value"
      res.redirect(302, await viewUrl(file.key, file.name, CONTENT_TYPES[file.format]));
      return;
    }

    if (!canRemoveFile(doc)) {
      return res.status(409).json({ error: 'invalid_transition', status: doc.status });
    }
    if (isFileReferenced(doc, fileId)) return res.status(409).json({ error: 'file_referenced' });
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
