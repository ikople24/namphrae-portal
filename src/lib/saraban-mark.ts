// src/lib/saraban-mark.ts
// ตรา/ลายมือ/การลงนามบนหนังสือ (สเปกรอบ 4 ข้อ 2) — client-safe บริสุทธิ์: ห้าม import node:*
// เซิร์ฟเวอร์ใช้ validateMarks/isFileReferenced ตัดสินจริง หน้าจอใช้ตัวเดียวกันซ่อนปุ่ม/นับ

import type { SarabanDoc, SarabanEvent, SarabanFile, SarabanMark } from '@/types/saraban';

// ต่อการเกษียนหนึ่งครั้ง — กันเอกสาร Mongo บวม (หนังสือหนึ่งเรื่อง = เอกสารเดียว เพดาน 16 MB)
export const MAX_STAMPS = 20;
export const MAX_STROKES = 200;
export const MAX_INK_POINTS = 5000; // คู่ x,y = 1 จุด
export const MAX_MARK_PAGE = 500; // PDF ที่นับหน้าไม่ได้ตอนอัป (pages = 0)

/** หน้าสุดท้ายที่วางได้ — รูปภาพ = 1 เสมอ */
export function maxPageOf(file: Pick<SarabanFile, 'format' | 'pages'>): number {
  if (file.format !== 'pdf') return 1;
  return file.pages > 0 ? file.pages : MAX_MARK_PAGE;
}

export type MarkCheck = { ok: true } | { ok: false; error: 'invalid_mark'; index: number };

/** fileId ต้องเป็นไฟล์ของหนังสือนี้ และหน้าต้องมีจริง (ช่วงพิกัด/จำนวนตรวจที่ schema แล้ว) */
export function validateMarks(doc: Pick<SarabanDoc, 'files'>, marks: readonly SarabanMark[]): MarkCheck {
  for (const [index, mark] of marks.entries()) {
    const file = doc.files.find((f) => f.id === mark.fileId);
    if (!file || mark.page > maxPageOf(file)) return { ok: false, error: 'invalid_mark', index };
  }
  return { ok: true };
}

/** ไฟล์ที่มีตรา/ลายมือ/การลงนามอ้างอยู่ห้ามลบ — ไม่งั้นหลักฐานชี้ไฟล์ที่หายไป */
export function isFileReferenced(doc: Pick<SarabanDoc, 'events'>, fileId: string): boolean {
  return doc.events.some(
    (e) => e.marks?.some((m) => m.fileId === fileId) || e.signature?.files.some((f) => f.fileId === fileId)
  );
}

/** ลายมือและการลงนามต้องเป็นเจ้าตัว (โหมดงานของฉัน) — โหมดเต็มที่ธุรการทำแทนวางได้แค่ตรา */
export function hasSelfOnlyMarks(input: { marks: readonly SarabanMark[]; sign: boolean }): boolean {
  return input.sign || input.marks.some((m) => m.type === 'ink');
}

export function inkPointCount(marks: readonly SarabanMark[]): number {
  return marks.reduce(
    (n, m) => (m.type === 'ink' ? n + m.strokes.reduce((k, s) => k + s.length / 2, 0) : n),
    0
  );
}

/** จำนวนหน้าที่มีลายมือ (ไฟล์ × หน้า) — บรรทัด "มีลายมือ n หน้า" บนไทม์ไลน์ */
export function inkPageCount(marks: readonly SarabanMark[]): number {
  return new Set(marks.filter((m) => m.type === 'ink').map((m) => `${m.fileId}:${m.page}`)).size;
}

/** ตรา/ลายมือของการเกษียนที่ผ่านมาบนหน้าหนึ่ง (ชั้นอ่านอย่างเดียวของ DocViewer) */
export function marksOn(events: readonly SarabanEvent[], fileId: string, page: number): SarabanMark[] {
  return events
    .filter((e) => e.kind === 'annotated')
    .flatMap((e) => e.marks ?? [])
    .filter((m) => m.fileId === fileId && m.page === page);
}
