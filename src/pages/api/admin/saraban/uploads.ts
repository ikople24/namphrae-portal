import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { readRawBody } from '@/lib/raw-body';
import { CONTENT_TYPES, keyFor, MAX_FILE_BYTES, sniffFormat } from '@/lib/saraban-attachment';
import { countPdfPages } from '@/lib/saraban-pdf';
import { isStorageConfigured, putObject } from '@/lib/saraban-storage';

// body เป็นเนื้อไฟล์ดิบ — ปิด bodyParser แล้วอ่านเองพร้อมเพดาน (raw-body.ts)
export const config = { api: { bodyParser: false } };

// POST /api/admin/saraban/uploads — อัปไฟล์หนึ่งไฟล์ผ่านแอปเข้า bucket (สเปกข้อ 5)
// ตอบ { key, format, bytes, pages } — ฟอร์มส่งแค่ { key, name } ต่อไปกับคำขอบันทึกหนังสือ แล้ว
// เซิร์ฟเวอร์ตรวจ object ซ้ำอีกรอบ (checkAttachment) ไม่เชื่อค่าที่ตอบกลับไปตรงนี้
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isStorageConfigured()) {
    return res.status(503).json({ error: 'storage_not_configured' });
  }

  // บอกขนาดมาเกินตั้งแต่ header → ตอบเลยโดยไม่อ่าน body (fetch ที่ส่ง File ใส่ Content-Length เสมอ)
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_FILE_BYTES) {
    return res.status(413).json({ error: 'file_too_large' });
  }

  try {
    const body = await readRawBody(req, MAX_FILE_BYTES);
    if (body === null) return res.status(413).json({ error: 'file_too_large' });
    const format = sniffFormat(body);
    if (!format) return res.status(400).json({ error: 'bad_format' });

    const pages = format === 'pdf' ? await countPdfPages(body) : 1;
    const key = keyFor(crypto.randomUUID(), format);
    await putObject(key, body, CONTENT_TYPES[format], pages);
    return res.status(201).json({ key, format, bytes: body.length, pages });
  } catch (err) {
    console.error('POST /api/admin/saraban/uploads failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
