import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import {
  fileNameSchema,
  libraryKey,
  PAGE_SIZE,
  parseListQuery,
  titleSchema,
  toListItem,
} from '@/lib/file-library';
import { insertFile, listFiles } from '@/lib/file-library-store';
import { readRawBody } from '@/lib/raw-body';
import { CONTENT_TYPES, MAX_FILE_BYTES, sniffFormat } from '@/lib/saraban-attachment';
import { deleteObject, isStorageConfigured, putObject } from '@/lib/saraban-storage';
import { hasFeature } from '@/lib/user-access';
import type { LibraryFile, LibraryPage } from '@/types/file-library';

// POST ส่งเนื้อไฟล์ดิบ — ปิด bodyParser แล้วอ่านเองพร้อมเพดาน (raw-body.ts) · GET ไม่มี body ไม่กระทบ
export const config = { api: { bodyParser: false } };

// GET  /api/admin/files?q=&page= — รายการคลังไฟล์ สมาชิกทุกคน (สเปก 2026-10-31 ข้อ 4)
// POST /api/admin/files?title=&name= — อัปโหลดหนึ่งไฟล์ = หนึ่งรายการ เฉพาะผู้มีสิทธิ์ files
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') return list(req, res);
  if (req.method === 'POST') {
    if (!hasFeature(admin, 'files')) return res.status(403).json({ error: 'feature_denied' });
    return upload(req, res);
  }
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}

async function list(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { q, page } = parseListQuery(req.query);
    const { items, total } = await listFiles(q, page);
    const body: LibraryPage = { items, total, page, pageSize: PAGE_SIZE };
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (err) {
    console.error('GET /api/admin/files failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function upload(req: NextApiRequest, res: NextApiResponse) {
  if (!isStorageConfigured()) return res.status(503).json({ error: 'storage_not_configured' });

  const title = titleSchema.safeParse(req.query.title);
  if (!title.success) return res.status(400).json({ error: 'invalid_title' });
  const name = fileNameSchema.safeParse(req.query.name);
  if (!name.success) return res.status(400).json({ error: 'invalid_name' });

  // บอกขนาดมาเกินตั้งแต่ header → ตอบเลยโดยไม่อ่าน body (แนวเดียวกับ saraban/uploads.ts)
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_FILE_BYTES) {
    return res.status(413).json({ error: 'file_too_large' });
  }

  let key: string | undefined;
  try {
    const body = await readRawBody(req, MAX_FILE_BYTES);
    if (body === null) return res.status(413).json({ error: 'file_too_large' });
    // ชนิดจากเนื้อไฟล์ ไม่เชื่อนามสกุลหรือ Content-Type (กัน .html ปลอมเป็น .pdf)
    const format = sniffFormat(body);
    if (!format) return res.status(400).json({ error: 'bad_format' });

    const id = crypto.randomUUID();
    key = libraryKey(id, format);
    await putObject(key, body, CONTENT_TYPES[format], 1);
    const file: LibraryFile = {
      id,
      title: title.data,
      fileName: name.data,
      key,
      format,
      bytes: body.length,
      uploadedAt: new Date().toISOString(),
    };
    await insertFile(file);
    return res.status(201).json(toListItem(file));
  } catch (err) {
    console.error('POST /api/admin/files failed', err);
    // บันทึกรายการล้มหลัง put แล้ว = object ไม่มีใครอ้าง — ลบทิ้ง ไม่ให้ค้างใน bucket
    if (key) {
      const orphan = key;
      await deleteObject(orphan).catch((e) =>
        console.warn('POST /api/admin/files: ลบ object ไม่สำเร็จ เหลือไฟล์กำพร้า', orphan, e)
      );
    }
    return res.status(500).json({ error: 'server_error' });
  }
}
