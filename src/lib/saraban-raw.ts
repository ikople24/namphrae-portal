// src/lib/saraban-raw.ts
// ส่ง bytes ของไฟล์แนบผ่านแอป (same-origin) ให้ pdf.js/<img> ของ DocViewer — SERVER ONLY
// ทางเลือกนี้แทนการตั้ง CORS ที่ bucket (สเปกรอบ 4 ข้อ 1.4) · เปิดแท็บใหม่ยังใช้ 302 แบบเดิม
// route ที่เรียกต้องตั้ง `export const config = { api: { responseLimit: '11mb' } }` — ไฟล์ใหญ่ได้ 10MB

import type { NextApiResponse } from 'next';
import { CONTENT_TYPES, inlineDisposition } from '@/lib/saraban-attachment';
import { getObjectBytes } from '@/lib/saraban-storage';
import type { SarabanFile } from '@/types/saraban';

export async function sendFileBytes(res: NextApiResponse, file: SarabanFile): Promise<void> {
  const bytes = await getObjectBytes(file.key);
  res.setHeader('Content-Type', CONTENT_TYPES[file.format]);
  res.setHeader('Content-Length', String(bytes.length));
  res.setHeader('Content-Disposition', inlineDisposition(file.name));
  // ห้ามเบราว์เซอร์เดาชนิดเอง — ให้เชื่อ Content-Type ที่เราตรวจจาก magic bytes เท่านั้น
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // private: ห้าม proxy/CDN เก็บ — ไฟล์ราชการต้องผ่านการตรวจสิทธิ์ทุกครั้ง
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.status(200).send(Buffer.from(bytes));
}
