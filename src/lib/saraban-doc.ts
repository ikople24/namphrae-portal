// src/lib/saraban-doc.ts
// ตรรกะบริสุทธิ์ของหนังสือหนึ่งเรื่อง — client-safe: ห้าม import mongodb/cloudinary/fs/node:*
// หน้าจอใช้ displayStatus/canVoid วาดป้ายและปุ่ม ส่วน API ใช้ฟังก์ชันเดียวกันตัดสินจริง
//
// id และเวลารับเป็นพารามิเตอร์ ไม่สร้างเองข้างใน — store เป็นคนสร้าง (node:crypto)
// และเทสต์ส่งค่าคงที่ได้

import type {
  DisplayStatus,
  SarabanDoc,
  SarabanEvent,
  SarabanEventKind,
  SarabanFieldChange,
  SarabanFile,
  SarabanLevel,
  SarabanRegister,
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

// ช่องที่มาจากฟอร์ม (ผ่าน zod แล้ว) — ส่วนที่ระบบกำหนดเองอยู่ใน NewDocMeta
export type NewDocFields = {
  register: SarabanRegister;
  ref: string;
  docDate: string;
  party: string;
  subject: string;
  level: SarabanLevel;
  dueDate: string;
  holderUnitId: string;
};

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
 * ประกอบหนังสือใหม่ — เขียนทุกคีย์เสมอแม้ค่าว่าง (sendMethod/voidReason = '')
 * เหตุผลเดียวกับ buildNewJob ใน jobs-store.ts: หนังสือที่ไม่เคยยกเลิกกับที่ยกเลิกแล้วต้องมี
 * รูปร่างเดียวกัน ไม่งั้นโค้ดที่เช็ค `'voidReason' in doc` จะแสดงผลสองแบบ
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

type OverdueInput = Pick<SarabanDoc, 'register' | 'dueDate' | 'status'>;

/**
 * เกินกำหนด = หนังสือรับที่ยังเปิดอยู่และกำหนดแล้วเสร็จผ่านไปแล้ว — วันกำหนดพอดียังไม่เกิน
 * คำนวณทุกครั้ง ไม่เก็บเป็นสถานะ: ถ้าเก็บต้องมี cron คอยเปลี่ยน วันที่ cron ไม่ทำงาน
 * สถานะจะผิดเงียบ ๆ
 */
export function isOverdue(doc: OverdueInput, today: string): boolean {
  return (
    doc.register === 'in' &&
    doc.dueDate !== '' &&
    doc.dueDate < today &&
    (doc.status === 'pending' || doc.status === 'in-progress')
  );
}

/** สถานะที่แสดงบนจอ — เกินกำหนดแสดงแทนสถานะจริง */
export function displayStatus(doc: OverdueInput, today: string): DisplayStatus {
  return isOverdue(doc, today) ? 'overdue' : doc.status;
}
