// src/lib/saraban-view.ts
// ตรรกะของหน้าจอสารบรรณ (รอบ 1C) — client-safe บริสุทธิ์ แยกจาก component เพื่อเทสต์ได้
// component วาดอย่างเดียว ทุกการตัดสิน (ปุ่มไหนโชว์ ข้อความไหน วันที่แบบไหน) อยู่ที่นี่

import { arabicDigits } from '@/lib/iso-date';
import { MAX_FILE_BYTES } from '@/lib/saraban-attachment';
import { isOpen, type RegisterView } from '@/lib/saraban-doc';
import { LEVEL_LABELS, statusLabel } from '@/lib/saraban-labels';
import type { MemberTab } from '@/lib/saraban-member';
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

/** ISO ค.ศ. → 'วว/ดด/ปปปป' พ.ศ. ของช่องกรอกวันที่ · ว่างหรือผิดรูป → '' */
export function isoToThaiInput(iso: string): string {
  const m = ISO_DATE.exec(iso ?? '');
  if (!m) return '';
  return `${m[3]}/${m[2]}/${Number(m[1]) + 543}`;
}

export type ThaiDateParse = { ok: true; iso: string } | { ok: false; error: string };

const THAI_INPUT = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;

/**
 * วันที่ที่ผู้ใช้พิมพ์แบบไทย 'วว/ดด/ปปปป' (ปี พ.ศ.) → ISO ค.ศ. ที่ API รับ
 * - คั่นด้วย / - . ได้ · เลขไทยได้ · ปีสองหลักเป็น 25xx ('31/10/69' = 2569) แบบที่เขียนกันในหนังสือ
 * - ปีที่ดูเป็น ค.ศ. (ต่ำกว่า 2400) ปฏิเสธพร้อมบอกเหตุ — ช่องนี้เป็น พ.ศ. เสมอ ห้ามเดาว่าเป็น ค.ศ.
 *   เพราะเดาผิดทีเดียวคลาด 543 ปีบนทะเบียนราชการ
 * - ว่าง = ok + iso '' (ช่องไม่บังคับ เช่น กำหนดแล้วเสร็จ) ช่องบังคับให้ฟอร์มตัดสินเอง
 */
export function parseThaiInput(text: string): ThaiDateParse {
  const s = arabicDigits(text ?? '').trim();
  if (!s) return { ok: true, iso: '' };
  const m = THAI_INPUT.exec(s);
  if (!m) return { ok: false, error: 'ใช้รูปแบบ วว/ดด/ปปปป เช่น 31/10/2569' };
  const be = m[3].length === 2 ? 2500 + Number(m[3]) : Number(m[3]);
  if (be < 2400) return { ok: false, error: 'ใส่ปีเป็น พ.ศ. เช่น 2569' };
  const iso = `${be - 543}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const year = be - 543;
  if (year < 1900 || year > 2100 || !isRealDate(iso)) return { ok: false, error: 'วันที่ไม่มีอยู่จริง' };
  return { ok: true, iso };
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
  stale: 'มีคนบันทึกหนังสือนี้ไปก่อน โหลดใหม่แล้ว ลองอีกครั้ง',
  invalid_unit: 'ตำแหน่ง/หน่วยงานที่เลือกใช้ไม่ได้ — อาจถูกปิดในสมุดผู้รับ (หรือยังไม่มีรหัสส่วนราชการ กรณีออกเลขส่ง)',
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
  same_holder: 'หนังสืออยู่กับตำแหน่งนี้อยู่แล้ว เลือกปลายทางอื่น',
  already_circulated: 'มีตำแหน่งที่เวียนถึงแล้ว เอาออกจากรายการแล้วบันทึกอีกครั้ง',
  not_circulated: 'ตำแหน่งนี้ไม่ได้อยู่ในรายการแจ้งเวียน',
  already_acknowledged: 'ตำแหน่งนี้ทราบแล้ว',
  not_member: 'ยังไม่ได้ผูกกับตำแหน่งใด ติดต่อผู้ดูแลระบบ',
  not_holder: 'หนังสือนี้ไม่ได้อยู่กับตำแหน่งของคุณแล้ว',
  invalid_member: 'มีรายชื่อที่ไม่ใช่สมาชิกในระบบ',
  not_found: 'ไม่พบหนังสือ',
  feature_denied: 'ไม่มีสิทธิ์ใช้ระบบสารบรรณ',
  manager_only: 'เฉพาะผู้จัดการระบบเท่านั้น',
  self_only: 'ลายมือและการลงนามต้องทำเองในงานของฉัน',
  invalid_mark: 'ตรา/ลายมืออ้างไฟล์หรือหน้าที่ไม่มีในหนังสือนี้ — โหลดใหม่แล้ววางอีกครั้ง',
  file_referenced: 'ไฟล์นี้มีตรา ลายมือ หรือการลงนามอ้างอยู่ ลบไม่ได้',
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
  scope?: 'open';
}): string {
  const p = new URLSearchParams({ register: q.register });
  // scope=open: server ไม่ใช้ year/view — ไม่ใส่ในคีย์ จะได้ cache เดียวกันไม่ว่าหน้าอื่นเลือกปี/ตัวกรองอะไร
  if (q.scope) p.set('scope', q.scope);
  else {
    if (q.year) p.set('year', String(q.year));
    if (q.view && q.view !== 'all') p.set('view', q.view);
  }
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

const ME_BASE = '/api/admin/saraban/me';

/** ?as= ของ dev-open (สเปกรอบ 3 ข้อ 2) — ต่อท้ายทุกคำขอใต้ /me · ตั้ง Clerk แล้วเซิร์ฟเวอร์ไม่สนค่านี้ */
export function withAs(url: string, as: string | undefined): string {
  if (!as) return url;
  return `${url}${url.includes('?') ? '&' : '?'}as=${encodeURIComponent(as)}`;
}

export const memberSummaryKey = (as: string | undefined) => withAs(ME_BASE, as);

export function memberDocsKey(q: { tab: MemberTab; page: number; as?: string }): string {
  const p = new URLSearchParams({ tab: q.tab });
  if (q.page > 1) p.set('page', String(q.page));
  return withAs(`${ME_BASE}/docs?${p}`, q.as);
}

export const memberDocKey = (id: string, as: string | undefined) =>
  withAs(`${ME_BASE}/docs/${encodeURIComponent(id)}`, as);

export const memberFileUrl = (id: string, fileId: string, as: string | undefined) =>
  withAs(`${ME_BASE}/docs/${encodeURIComponent(id)}/files/${encodeURIComponent(fileId)}`, as);

/** ลิงก์ไฟล์ดิบ (same-origin) ให้ pdf.js/<img> — route ตรวจสิทธิ์เดิมแล้วส่ง bytes แทน 302 */
export function withRaw(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}raw=1`;
}
