// src/lib/saraban-sign.ts
// ตรา/ลายมือ/ลงนามในระบบที่ต่อท้าย event annotated (สเปกรอบ 4 ข้อ 2–3) — SERVER ONLY (node:crypto)
// สอง route (โหมดเต็ม/งานของฉัน) เรียก annotateExtras ตัวเดียวกัน · I/O ของ bucket ฉีดเข้ามา เทสต์ได้โดยไม่มี bucket
// ป้ายบนจอเขียน "ลงนามในระบบ" เสมอ — ไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์ที่มีใบรับรอง (สเปกแม่ข้อ 10)

import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { validateMarks } from '@/lib/saraban-mark';
import type { SarabanDoc, SarabanEventDetail, SarabanMark, SarabanSignature } from '@/types/saraban';

/** Railway อยู่หลัง proxy — ค่าแรกของ x-forwarded-for คือเครื่องผู้ใช้ */
export function clientIp(req: { headers: IncomingHttpHeaders; socket?: { remoteAddress?: string } }): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || '';
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
  const files = await Promise.all(
    doc.files.map(async (f) => ({ fileId: f.id, name: f.name, sha256: sha256Hex(await deps.getBytes(f.key)) }))
  );
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
