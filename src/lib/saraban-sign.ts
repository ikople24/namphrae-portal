// src/lib/saraban-sign.ts
// ตรา/ลายมือ/ลงนามในระบบที่ต่อท้าย event annotated (สเปกรอบ 4 ข้อ 2–3) — SERVER ONLY (node:crypto)
// สอง route (โหมดเต็ม/งานของฉัน) เรียก annotateExtras ตัวเดียวกัน · I/O ของ bucket ฉีดเข้ามา เทสต์ได้โดยไม่มี bucket
// ป้ายบนจอเขียน "ลงนามในระบบ" เสมอ — ไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์ที่มีใบรับรอง (สเปกแม่ข้อ 10)

import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { isIP } from 'node:net';
import { validateMarks } from '@/lib/saraban-mark';
import type { SarabanDoc, SarabanEventDetail, SarabanMark, SarabanSignature } from '@/types/saraban';

/**
 * IP ที่ proxy เห็น — x-real-ip (edge ของ Railway ตั้งเอง) → ค่าขวาสุดของ x-forwarded-for (hop ที่ proxy ต่อให้
 * ค่าซ้ายสุด client ปลอมได้) → socket → '' · ค่าที่ไม่ใช่ IP ข้ามไป (isIP กันความยาวด้วย)
 * ต้องตรวจหลัง deploy ว่า Railway ส่ง header ไหนจริง · เป็นหลักฐานว่า proxy เห็นอะไร ไม่ใช่พิสูจน์ตัวบุคคล
 */
export function clientIp(req: { headers: IncomingHttpHeaders; socket?: { remoteAddress?: string } }): string {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const fwd = one(req.headers['x-forwarded-for'])?.split(',');
  const candidates = [one(req.headers['x-real-ip']), fwd?.[fwd.length - 1], req.socket?.remoteAddress];
  for (const c of candidates) {
    const v = c?.trim();
    if (v && isIP(v) !== 0) return v;
  }
  return '';
}

export function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export type SignDeps = { storageConfigured: boolean; getBytes: (key: string) => Promise<Uint8Array> };

/** null = มีไฟล์แต่ไม่ได้ตั้ง bucket (คำนวณ hash ไม่ได้) · ไม่มีไฟล์ = ลงนามข้อความเกษียน files: [] */
export async function buildSignature(
  doc: Pick<SarabanDoc, 'files'>,
  ip: string,
  deps: SignDeps
): Promise<SarabanSignature | null> {
  if (doc.files.length > 0 && !deps.storageConfigured) return null;
  // ทีละไฟล์ (ไม่ใช้ Promise.all) — ไฟล์ละได้ถึง 10 MB × 10 ไฟล์ ให้ memory สูงสุดเท่าไฟล์เดียว
  const files: SarabanSignature['files'] = [];
  for (const f of doc.files) {
    files.push({ fileId: f.id, name: f.name, sha256: sha256Hex(await deps.getBytes(f.key)) });
  }
  return { ip, files };
}

export type ExtrasResult =
  | { ok: true; detail: SarabanEventDetail }
  | { ok: false; status: 400; error: 'invalid_mark' }
  | { ok: false; status: 503; error: 'storage_not_configured' };

/** เรียกหลัง transition ผ่านแล้ว (การลงนามอ่านไฟล์ทั้งหมด — ไม่ทำถ้าคำขอจะตกอยู่แล้ว) */
export async function annotateExtras(
  doc: Pick<SarabanDoc, 'files'>,
  input: { marks: readonly SarabanMark[]; sign: boolean },
  ip: string,
  deps: SignDeps
): Promise<ExtrasResult> {
  if (!validateMarks(doc, input.marks).ok) return { ok: false, status: 400, error: 'invalid_mark' };
  const detail: SarabanEventDetail = {};
  if (input.marks.length > 0) detail.marks = [...input.marks];
  if (input.sign) {
    const signature = await buildSignature(doc, ip, deps);
    if (!signature) return { ok: false, status: 503, error: 'storage_not_configured' };
    detail.signature = signature;
  }
  return { ok: true, detail };
}
