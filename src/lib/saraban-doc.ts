// src/lib/saraban-doc.ts
// ตรรกะบริสุทธิ์ของหนังสือหนึ่งเรื่อง — client-safe: ห้าม import mongodb/cloudinary/fs/node:*
// หน้าจอใช้ displayStatus/canVoid วาดป้ายและปุ่ม ส่วน API ใช้ฟังก์ชันเดียวกันตัดสินจริง
//
// id และเวลาทุกตัวรับเป็นพารามิเตอร์ ไม่สร้างเองข้างใน — id ของหนังสือมาจาก client (เป็น
// idempotency key) ส่วน eventId กับเวลา store เป็นคนสร้าง และเทสต์ส่งค่าคงที่ได้

import type {
  DisplayStatus,
  SarabanDoc,
  SarabanEvent,
  SarabanEventKind,
  SarabanFieldChange,
  SarabanFile,
  SarabanStatus,
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
