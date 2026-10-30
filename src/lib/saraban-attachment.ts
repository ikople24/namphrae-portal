// src/lib/saraban-attachment.ts
// ตรวจไฟล์แนบของสารบรรณ (สเปกข้อ 5) — client-safe ไม่ import SDK: saraban-storage.ts เป็นคน
// คุยกับ bucket แล้วส่งผลมาให้ที่นี่ตัดสิน จึงเทสต์ได้ตรง ๆ
//
// เซิร์ฟเวอร์ (uploads.ts) เป็นผู้เดียวที่เขียนลง bucket — ContentType และ metadata `pages` บน object
// จึงเชื่อได้ ส่วนสิ่งที่ client ส่งมากับคำขอบันทึกหนังสือ ({ key, name }) เชื่อไม่ได้ทั้งหมด

import type { SarabanFile, SarabanFileFormat } from '@/types/saraban';

// prefix ต้องมี '/' ปิดท้าย — 'saraban-evil/x' ขึ้นต้นด้วยคำเดียวกัน
export const SARABAN_PREFIX = 'saraban/';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_DOC = 10;

/** ContentType ที่ uploads.ts ตั้งบน object ตามชนิดที่ sniff ได้ — ลิงก์ชั่วคราวส่งค่านี้ให้เบราว์เซอร์ */
export const CONTENT_TYPES: Record<SarabanFileFormat, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
};

// Map ไม่ใช่ object literal — FORMAT_OF['constructor'] ของ object literal คืนฟังก์ชันของ
// Object.prototype ซึ่ง truthy แล้วหลุดด่านไป
const FORMAT_OF = new Map<string, SarabanFileFormat>(
  Object.entries(CONTENT_TYPES).map(([format, type]) => [type, format as SarabanFileFormat])
);

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // '%PDF-'
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// ข้อกำหนด PDF ยอมให้มีขยะนำหน้า '%PDF-' และ Acrobat เปิดได้ถ้าอยู่ใน 1024 ไบต์แรก —
// เครื่องสแกนบางรุ่นเขียนแบบนั้นจริง ตรวจเฉพาะไบต์แรกจะปฏิเสธไฟล์ที่ผู้ใช้เปิดดูได้ปกติ
const PDF_SEARCH_BYTES = 1024;

function startsWithAt(data: Uint8Array, magic: number[], at: number): boolean {
  if (data.length < at + magic.length) return false;
  return magic.every((byte, i) => data[at + i] === byte);
}

/**
 * ชนิดไฟล์จากเนื้อไฟล์ — ไม่เชื่อนามสกุลหรือ Content-Type ที่เบราว์เซอร์ส่งมา (เปลี่ยนชื่อ .html
 * เป็น .pdf ได้ง่าย ๆ แล้วไฟล์นั้นจะถูกเปิดในแท็บของผู้ใช้คนอื่น) · null = ไม่ใช่ชนิดที่รับ
 */
export function sniffFormat(data: Uint8Array): SarabanFileFormat | null {
  if (startsWithAt(data, JPEG_MAGIC, 0)) return 'jpg';
  if (startsWithAt(data, PNG_MAGIC, 0)) return 'png';
  const limit = Math.min(data.length, PDF_SEARCH_BYTES);
  for (let at = 0; at < limit; at += 1) {
    if (startsWithAt(data, PDF_MAGIC, at)) return 'pdf';
  }
  return null;
}

/** key ของไฟล์ใหม่ — id เป็น uuid ที่ uploads.ts สุ่ม ไม่ใช้ชื่อไฟล์ของผู้ใช้ (ภาษาไทย ช่องว่าง ชื่อซ้ำ) */
export function keyFor(id: string, format: SarabanFileFormat): string {
  return `${SARABAN_PREFIX}${id}.${format}`;
}

/** ส่วนที่ใช้ของผล HeadObject — saraban-storage.ts แปลงจาก ContentLength/ContentType/Metadata */
export type StoredObject = {
  key: string;
  bytes: number;
  contentType?: string;
  pages?: string; // metadata เป็นสตริงเสมอ
};

export type CheckedAttachment = Pick<SarabanFile, 'key' | 'format' | 'bytes' | 'pages'>;

export type AttachmentError = 'wrong_prefix' | 'bad_format' | 'too_large' | 'not_ours';

export type AttachmentCheck =
  | { ok: true; file: CheckedAttachment }
  | { ok: false; error: AttachmentError };

/**
 * ตรวจ object ที่ client อ้างถึงก่อนผูกเข้าหนังสือ — ส่วน "มีอยู่จริงไหม" และ "แนบกับเรื่องอื่น
 * แล้วหรือยัง" เป็นงานของ route (HeadObject ได้ 404 · attachedKeys()) เพราะต้องคุยกับ bucket/DB
 */
export function checkAttachment(o: StoredObject): AttachmentCheck {
  if (!o.key.startsWith(SARABAN_PREFIX)) return { ok: false, error: 'wrong_prefix' };
  const format = o.contentType === undefined ? undefined : FORMAT_OF.get(o.contentType);
  if (!format) return { ok: false, error: 'bad_format' };
  if (o.bytes > MAX_FILE_BYTES) return { ok: false, error: 'too_large' };
  // metadata pages มีเฉพาะ object ที่ uploads.ts เขียน — ไม่มี = ใครเอาอะไรมาวางใน bucket เอง
  if (o.pages === undefined || !/^\d+$/.test(o.pages)) return { ok: false, error: 'not_ours' };
  return { ok: true, file: { key: o.key, format, bytes: o.bytes, pages: Number(o.pages) } };
}
