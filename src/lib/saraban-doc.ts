// src/lib/saraban-doc.ts
// ตรรกะบริสุทธิ์ของหนังสือหนึ่งเรื่อง — client-safe: ห้าม import mongodb/cloudinary/fs/node:*
// หน้าจอใช้ displayStatus/canVoid วาดป้ายและปุ่ม ส่วน API ใช้ฟังก์ชันเดียวกันตัดสินจริง
//
// id และเวลาทุกตัวรับเป็นพารามิเตอร์ ไม่สร้างเองข้างใน — id ของหนังสือมาจาก client (เป็น
// idempotency key) ส่วน eventId กับเวลา store เป็นคนสร้าง และเทสต์ส่งค่าคงที่ได้

import {
  DISPLAY_STATUSES,
  type DisplayStatus,
  type SarabanDoc,
  type SarabanEvent,
  type SarabanEventKind,
  type SarabanFieldChange,
  type SarabanFile,
  type SarabanRegister,
  type SarabanStatus,
} from '@/types/saraban';

export type Actor = { id: string; name: string };

export function makeEvent(args: {
  id: string;
  at: string;
  actor: Actor;
  kind: SarabanEventKind;
  note?: string;
  changes?: SarabanFieldChange[];
}): SarabanEvent {
  const event: SarabanEvent = {
    id: args.id,
    at: args.at,
    by: args.actor.id,
    byName: args.actor.name,
    kind: args.kind,
    note: args.note ?? '',
  };
  if (args.changes) event.changes = args.changes;
  return event;
}

// ช่องที่ผู้เรียกกำหนด — รับ: มาจากฟอร์มที่ผ่าน zod · ส่ง/เวียน: ref ประกอบจาก refFor() และ
// dueDate เป็น '' (buildNewDoc บังคับซ้ำอีกชั้น) · ส่วนที่ระบบกำหนดเองอยู่ใน NewDocMeta
// Pick จาก SarabanDoc ไม่เขียนชนิดซ้ำ — แก้ชนิดใน types/saraban.ts แล้วที่นี่ตามเอง
export type NewDocFields = Pick<
  SarabanDoc,
  'register' | 'ref' | 'docDate' | 'party' | 'subject' | 'level' | 'dueDate' | 'holderUnitId'
>;

export type NewDocMeta = {
  id: string;
  fiscalYear: number;
  no: number;
  files: SarabanFile[];
  actor: Actor;
  now: string;
  eventId: string;
  eventNote: string;
};

/**
 * ประกอบหนังสือใหม่ — เขียนทุกคีย์เสมอแม้ค่าว่าง ('' ไม่ใช่ตัดคีย์ทิ้ง) แนวเดียวกับ buildNewJob
 * เหตุผลที่หนักที่สุดของที่นี่: query ของ Mongo ใน toMongoQuery() ถาม { dueDate: '' } ซึ่ง
 * ไม่ตรงกับเอกสารที่ไม่มีคีย์นั้นเลย ถ้าบางเรื่องไม่มีคีย์ Mongo จะทำหนังสือหายจากปุ่มกรองเงียบ ๆ
 * ขณะที่ matches() ของแบ็กเอนด์ไฟล์ยังเห็น — dev กับ production เห็นทะเบียนไม่ตรงกัน
 *
 * สถานะเริ่มต้นตามทะเบียน: รับ → รอเกษียน · ส่ง/เวียน → รอส่ง (ออกเลขแล้วแต่ยังไม่ส่ง)
 * dueDate ของส่ง/เวียนถูกบังคับเป็น '' ที่นี่ — toMongoQuery() พึ่งข้อนี้อยู่ (ดูที่นั่น)
 */
export function buildNewDoc(fields: NewDocFields, meta: NewDocMeta): SarabanDoc {
  const isIn = fields.register === 'in';
  return {
    id: meta.id,
    register: fields.register,
    fiscalYear: meta.fiscalYear,
    no: meta.no,
    ref: fields.ref,
    docDate: fields.docDate,
    party: fields.party,
    subject: fields.subject,
    level: fields.level,
    dueDate: isIn ? fields.dueDate : '',
    holderUnitId: fields.holderUnitId,
    status: isIn ? 'pending' : 'in-progress',
    sendMethod: '',
    voidReason: '',
    files: meta.files,
    events: [
      makeEvent({
        id: meta.eventId,
        at: meta.now,
        actor: meta.actor,
        kind: isIn ? 'received' : 'issued',
        note: meta.eventNote,
      }),
    ],
    registeredAt: meta.now,
    registeredBy: meta.actor.id,
    updatedAt: meta.now,
  };
}

// สถานะที่หนังสือยัง "เปิดอยู่" — ใช้ร่วมทุกกฎที่ถามคำถามนี้ (เกินกำหนด · ยกเลิกได้ · ลบไฟล์ได้ ·
// query เกินกำหนดของ Mongo · แถบค้างข้ามปี) ไม่ให้แต่ละที่เขียนรายการเองแล้วเพี้ยนกันทีหลัง
export const OPEN_STATUSES = ['pending', 'in-progress'] as const satisfies readonly SarabanStatus[];

export function isOpen(status: SarabanStatus): boolean {
  return (OPEN_STATUSES as readonly SarabanStatus[]).includes(status);
}

type OverdueInput = Pick<SarabanDoc, 'register' | 'dueDate' | 'status'>;

/**
 * เกินกำหนด = หนังสือรับที่ยังเปิดอยู่และกำหนดแล้วเสร็จผ่านไปแล้ว — วันกำหนดพอดียังไม่เกิน
 * คำนวณทุกครั้ง ไม่เก็บเป็นสถานะ: ถ้าเก็บต้องมี cron คอยเปลี่ยน วันที่ cron ไม่ทำงาน
 * สถานะจะผิดเงียบ ๆ
 *
 * @param today 'YYYY-MM-DD' ตามเวลากรุงเทพฯ จาก bangkokDateOf() เท่านั้น — ห้ามส่ง ISO เต็ม
 *   ('2026-10-15' < '2026-10-15T01:00…' เป็นจริง เรื่องที่ครบกำหนดวันนี้จะกลายเป็นเกิน) และ
 *   ห้ามตัดวันที่จาก UTC (ช้ากว่ากรุงเทพฯ ได้ถึง 7 ชั่วโมง)
 */
export function isOverdue(doc: OverdueInput, today: string): boolean {
  return doc.register === 'in' && doc.dueDate !== '' && doc.dueDate < today && isOpen(doc.status);
}

/** สถานะที่แสดงบนจอ — เกินกำหนดแสดงแทนสถานะจริง · today: ดู isOverdue */
export function displayStatus(doc: OverdueInput, today: string): DisplayStatus {
  return isOverdue(doc, today) ? 'overdue' : doc.status;
}

// ---- ตัวกรองทะเบียน -------------------------------------------------------

// ปุ่ม "ทั้งหมด" + ทุกสถานะที่แสดงบนจอ — สร้างจาก DISPLAY_STATUSES ไม่พิมพ์รายการซ้ำ
// เพิ่มสถานะใหม่ใน types/saraban.ts แล้วปุ่มกรองกับ docListQuerySchema ตามมาเอง
export const REGISTER_VIEWS = ['all', ...DISPLAY_STATUSES] as const;
export type RegisterView = (typeof REGISTER_VIEWS)[number];

/**
 * ตัวกรองของทะเบียน — ทุกช่องต่อกันแบบ AND
 * - view: ปุ่มกรองบนหน้าทะเบียน แยกขาดตาม "ป้ายที่เห็น" (displayStatus) — เรื่องที่เกิน
 *   กำหนดอยู่ใต้ปุ่มเกินกำหนดที่เดียว ไม่ซ้ำใต้รอเกษียน ตัวเลขบนปุ่มจึงรวมกันได้พอดี
 * - statusIn: สถานะดิบ ไม่สนเกินกำหนด — badge (รอเกษียนทุกเรื่อง) และแถบค้างข้ามปี
 */
export type DocFilter = {
  register: SarabanRegister;
  fiscalYear?: number;
  beforeFiscalYear?: number;
  view?: RegisterView;
  statusIn?: readonly SarabanStatus[];
};

/**
 * กฎกรองของแบ็กเอนด์ไฟล์ — toMongoQuery() ด้านล่างพูดกฎเดียวกันแยกคนละที่ ถ้าแก้ฝั่งหนึ่ง
 * ต้องแก้อีกฝั่ง saraban-doc.test.ts เทียบสองฝั่งให้ทุกคู่ (หนังสือ × ตัวกรอง)
 */
export function matches(doc: SarabanDoc, f: DocFilter, today: string): boolean {
  if (doc.register !== f.register) return false;
  if (f.fiscalYear !== undefined && doc.fiscalYear !== f.fiscalYear) return false;
  if (f.beforeFiscalYear !== undefined && doc.fiscalYear >= f.beforeFiscalYear) return false;
  if (f.statusIn && !f.statusIn.includes(doc.status)) return false;
  if (f.view && f.view !== 'all' && displayStatus(doc, today) !== f.view) return false;
  return true;
}

// 'YYYY-MM-DD' เทียบแบบสตริงได้ผลตรงกับเทียบวันที่ แต่ '' น้อยกว่าทุกวันที่ จึงต้องมี
// $ne: '' กำกับทุกครั้งที่ถาม "เลยกำหนดแล้ว"
//
// ไม่เช็ค register === 'in' ในเงื่อนไข "ไม่เกินกำหนด" ของปุ่มรอเกษียน/ดำเนินการ เพราะ
// buildNewDoc บังคับ dueDate ของส่ง/เวียนเป็น '' เสมอ และกฎแก้ไข (editableFieldsOf)
// ไม่ให้แก้ dueDate ของส่ง/เวียน — ถ้าวันหนึ่งสองข้อนี้เปลี่ยน ต้องกลับมาแก้ตรงนี้
function viewQuery(view: Exclude<RegisterView, 'all'>, today: string): Record<string, unknown> {
  const notOverdue = { $or: [{ dueDate: '' }, { dueDate: { $gte: today } }] };
  switch (view) {
    case 'pending':
    case 'in-progress':
      return { status: view, ...notOverdue };
    case 'done':
    case 'void':
      return { status: view };
    case 'overdue':
      return {
        register: 'in',
        status: { $in: [...OPEN_STATUSES] },
        dueDate: { $ne: '', $lt: today },
      };
  }
}

/** query ของ Mongo ที่ให้ผลเดียวกับ matches() — ตัวกรองทะเบียนอย่างเดียวได้ query แบน ๆ */
export function toMongoQuery(f: DocFilter, today: string): Record<string, unknown> {
  const and: Record<string, unknown>[] = [{ register: f.register }];
  if (f.fiscalYear !== undefined) and.push({ fiscalYear: f.fiscalYear });
  if (f.beforeFiscalYear !== undefined) and.push({ fiscalYear: { $lt: f.beforeFiscalYear } });
  if (f.statusIn) and.push({ status: { $in: [...f.statusIn] } });
  if (f.view && f.view !== 'all') and.push(viewQuery(f.view, today));
  return and.length === 1 ? and[0] : { $and: and };
}
