// src/lib/saraban-view.ts
// ตรรกะของหน้าจอสารบรรณ (รอบ 1C) — client-safe บริสุทธิ์ แยกจาก component เพื่อเทสต์ได้
// component วาดอย่างเดียว ทุกการตัดสิน (ปุ่มไหนโชว์ ข้อความไหน วันที่แบบไหน) อยู่ที่นี่

import { MAX_FILE_BYTES } from '@/lib/saraban-attachment';
import { isOpen, type RegisterView } from '@/lib/saraban-doc';
import { LEVEL_LABELS, statusLabel } from '@/lib/saraban-labels';
import type { SarabanDoc, SarabanLevel, SarabanRegister } from '@/types/saraban';

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ViewButton = { view: RegisterView; label: string; count: number };

/**
 * ปุ่มกรองของทะเบียน (สเปกข้อ 6) — REGISTER_VIEWS มีครบ 6 ค่าเพื่อ query แต่หน้าส่ง/เวียนห้ามวาด
 * "รอเกษียน/เกินกำหนด" (statusLabel('out', …) จะได้ "รอส่ง" สองปุ่ม) · "ยกเลิก" โชว์เมื่อมีอย่างน้อย 1
 */
export function viewsOf(
  register: SarabanRegister,
  counts: Record<RegisterView, number>
): ViewButton[] {
  const views: RegisterView[] =
    register === 'in'
      ? ['all', 'pending', 'in-progress', 'done', 'overdue']
      : ['all', 'in-progress', 'done'];
  if ((counts.void ?? 0) > 0) views.push('void');
  return views.map((view) => ({
    view,
    label: view === 'all' ? 'ทั้งหมด' : statusLabel(register, view),
    count: counts[view] ?? 0,
  }));
}

function isRealDate(date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** '2026-09-13' → '13 ก.ย. 2569' · ว่างหรือผิดรูป → '' */
export function thaiDate(date: string): string {
  const m = ISO_DATE.exec(date ?? '');
  if (!m) return '';
  const month = Number(m[2]);
  if (month < 1 || month > 12) return '';
  return `${Number(m[3])} ${THAI_MONTHS[month - 1]} ${Number(m[1]) + 543}`;
}

/** ISO timestamp → '13 ก.ย. 2569 09:42' เวลากรุงเทพฯ — คำนวณเอง ไม่พึ่ง timezone/ICU ของเครื่อง */
export function thaiDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + BANGKOK_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${thaiDate(d.toISOString().slice(0, 10))} ${hh}:${mm}`;
}

/**
 * คำอธิบายใต้ช่องวันที่ — ช่อง <input type="date"> รับปี 2569 ได้เงียบ ๆ (เป็นวันที่ที่มีจริงใน ค.ศ.)
 * ป้าย พ.ศ. ใต้ช่องทำให้เห็นความผิดตั้งแต่ก่อนกด (สเปกข้อ 6 หน้า /receive)
 */
export function dateHint(value: string): { text: string; warn: boolean } {
  if (!value) return { text: '', warn: false };
  const year = Number(value.slice(0, 4));
  if (year > 2100) {
    return { text: `ปี ${year} ดูเหมือนเป็น พ.ศ. — ช่องนี้ใช้ ค.ศ. (${year - 543})`, warn: true };
  }
  if (!ISO_DATE.test(value) || year < 1900 || !isRealDate(value)) {
    return { text: 'วันที่ไม่มีอยู่จริง', warn: true };
  }
  return { text: `= ${thaiDate(value)}`, warn: false };
}

export function fileSizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** แถวด่วนที่ยังไม่เสร็จได้พื้นสีอ่อน (handoff "highlightUrgent") */
export function isUrgentOpen(doc: Pick<SarabanDoc, 'level' | 'status'>): boolean {
  return doc.level !== 'normal' && isOpen(doc.status);
}

// ข้อความตามรหัสข้อผิดพลาดของ API (สเปกข้อ 8 + แผน 1B)
const ERROR_MESSAGES: Record<string, string> = {
  number_busy: 'มีคนลงรับพร้อมกัน กดอีกครั้ง',
  stale: 'มีคนแก้หนังสือนี้ไปก่อน โหลดใหม่แล้วลองอีกครั้ง',
  invalid_unit: 'ตำแหน่ง/หน่วยงานที่เลือกใช้ไม่ได้ (ถูกปิด หรือยังไม่มีรหัสส่วนราชการ)',
  invalid_file: 'ไฟล์แนบใช้ไม่ได้ ลองเลือกไฟล์ใหม่',
  file_too_large: 'ไฟล์ใหญ่เกิน 10 MB',
  bad_format: 'รับเฉพาะไฟล์ PDF, JPG, PNG',
  storage_not_configured: 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์ — แนบไฟล์ไม่ได้',
  id_conflict: 'คำขอซ้ำกับหนังสือของผู้อื่น โหลดหน้าใหม่แล้วลองอีกครั้ง',
  year_in_use: 'ปีนี้มีหนังสือแล้ว ตั้งเลขเริ่มต้นไม่ได้',
  invalid_transition: 'ทำรายการนี้กับหนังสือในสถานะนี้ไม่ได้',
  field_locked: 'มีช่องที่แก้ไม่ได้แล้วในสถานะปัจจุบัน',
  too_many_files: 'แนบได้ไม่เกิน 10 ไฟล์ต่อเรื่อง',
  invalid_input: 'ข้อมูลไม่ครบหรือไม่ถูกต้อง',
  not_found: 'ไม่พบหนังสือ',
  feature_denied: 'ไม่มีสิทธิ์ใช้ระบบสารบรรณ',
};

export function errorMessage(code: string | undefined): string {
  return code && Object.hasOwn(ERROR_MESSAGES, code)
    ? ERROR_MESSAGES[code]
    : 'เกิดข้อผิดพลาด ลองอีกครั้ง';
}

/** URL/คีย์ SWR ของทะเบียน — ใส่เฉพาะค่าที่ไม่ใช่ค่าเริ่มต้น หน้าเดียวกันจะได้ cache เดียวกัน */
export function docsKey(q: {
  register: SarabanRegister;
  year?: number;
  view?: RegisterView;
  page?: number;
}): string {
  const p = new URLSearchParams({ register: q.register });
  if (q.year) p.set('year', String(q.year));
  if (q.view && q.view !== 'all') p.set('view', q.view);
  if (q.page && q.page > 1) p.set('page', String(q.page));
  return `/api/admin/saraban/docs?${p}`;
}

/** ค่าในประวัติการแก้ไข — ชั้นความเร็วเก็บเป็นคีย์ วันที่เก็บ ISO ชื่อหน่วยเก็บเป็นชื่อแล้ว (1B) */
export function changeValue(field: string, value: string): string {
  if (!value) return '—';
  if (field === 'level' && Object.hasOwn(LEVEL_LABELS, value)) {
    return LEVEL_LABELS[value as SarabanLevel];
  }
  if (field === 'docDate' || field === 'dueDate') return thaiDate(value) || value;
  return value;
}

/** กันไฟล์ที่ไม่ผ่านแน่ ๆ ก่อนอัป ให้รู้ทันที — เซิร์ฟเวอร์ยังตรวจจากเนื้อไฟล์ซ้ำ (สเปกข้อ 5) */
export function precheckFile(file: { name: string; size: number }): string | null {
  if (file.size > MAX_FILE_BYTES) return `${file.name}: ใหญ่เกิน 10 MB`;
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return `${file.name}: รับเฉพาะ PDF, JPG, PNG`;
  return null;
}
