// src/lib/saraban-doc.test.ts
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  buildNewDoc,
  displayStatus,
  isOverdue,
  makeEvent,
  type NewDocFields,
} from '@/lib/saraban-doc';
import type { SarabanDoc } from '@/types/saraban';

const ACTOR = { id: 'user_clerk_1', name: 'สมหญิง ใจดี' };
const NOW = '2026-10-02T02:30:00.000Z';
const TODAY = '2026-10-15';

function fields(overrides: Partial<NewDocFields> = {}): NewDocFields {
  return {
    register: 'in',
    ref: 'ชม 0023.1/ว 1245',
    docDate: '2026-09-28',
    party: 'ที่ทำการปกครองอำเภอหางดง',
    subject: 'ขอเชิญประชุมหัวหน้าส่วนราชการ',
    level: 'urgent',
    dueDate: '2026-10-10',
    holderUnitId: 'palad',
    ...overrides,
  };
}

function makeDoc(
  overrides: Partial<SarabanDoc> = {},
  fieldOverrides: Partial<NewDocFields> = {}
): SarabanDoc {
  const doc = buildNewDoc(fields(fieldOverrides), {
    id: 'doc-1',
    fiscalYear: 2570,
    no: 1,
    files: [],
    actor: ACTOR,
    now: NOW,
    eventId: 'ev-1',
    eventNote: 'ลงรับ เสนอปลัดเทศบาล',
  });
  return { ...doc, ...overrides };
}

// รายชื่อคีย์ทุกตัวของ SarabanDoc — expectTypeOf ด้านล่างทำให้ tsc ล้มถ้ามีคนเพิ่มฟิลด์
// ใน SarabanDoc แล้วลืมเพิ่มที่นี่ เทสต์ "คีย์ครบ" จึงไม่ล้าสมัยเงียบ ๆ
const DOC_KEYS = [
  'id', 'register', 'fiscalYear', 'no', 'ref', 'docDate', 'party', 'subject', 'level',
  'dueDate', 'holderUnitId', 'status', 'sendMethod', 'voidReason', 'files', 'events',
  'registeredAt', 'registeredBy', 'updatedAt',
] as const satisfies readonly (keyof SarabanDoc)[];

describe('buildNewDoc', () => {
  it('DOC_KEYS ครอบทุกฟิลด์ของ SarabanDoc (ตรวจตอน tsc)', () => {
    expectTypeOf<Exclude<keyof SarabanDoc, (typeof DOC_KEYS)[number]>>().toBeNever();
  });

  it('เขียนทุกคีย์เสมอแม้ค่าว่าง — แบบเดียวกับ buildNewJob', () => {
    const doc = makeDoc();
    expect(Object.keys(doc).sort()).toEqual([...DOC_KEYS].sort());
    expect(doc.sendMethod).toBe('');
    expect(doc.voidReason).toBe('');
  });

  it('หนังสือรับ: รอเกษียน · event ลงรับ · เก็บกำหนดแล้วเสร็จ', () => {
    const doc = makeDoc();
    expect(doc.status).toBe('pending');
    expect(doc.dueDate).toBe('2026-10-10');
    expect(doc.events).toEqual([
      {
        id: 'ev-1',
        at: NOW,
        by: 'user_clerk_1',
        byName: 'สมหญิง ใจดี',
        kind: 'received',
        note: 'ลงรับ เสนอปลัดเทศบาล',
      },
    ]);
  });

  it('หนังสือส่ง/เวียน: รอส่ง · event ออกเลข · กำหนดแล้วเสร็จถูกล้างเป็น "" เสมอ', () => {
    for (const register of ['out', 'circular'] as const) {
      const doc = makeDoc({}, { register, dueDate: '2026-10-10' });
      expect(doc.status).toBe('in-progress');
      expect(doc.dueDate).toBe('');
      expect(doc.events[0].kind).toBe('issued');
    }
  });

  it('audit: ผู้ลงทะเบียนคือ actor และ updatedAt เริ่มเท่ากับเวลาลงทะเบียน', () => {
    const doc = makeDoc();
    expect(doc.registeredBy).toBe('user_clerk_1');
    expect(doc.registeredAt).toBe(NOW);
    expect(doc.updatedAt).toBe(NOW);
  });
});

describe('makeEvent', () => {
  it('ไม่มี changes ก็ไม่มีคีย์ changes และ note ว่างเป็นค่าเริ่มต้น', () => {
    const e = makeEvent({ id: 'e', at: NOW, actor: ACTOR, kind: 'voided' });
    expect('changes' in e).toBe(false);
    expect(e.note).toBe('');
  });

  it('มี changes ก็เก็บไว้', () => {
    const changes = [{ field: 'subject', from: 'ก', to: 'ข' }];
    const e = makeEvent({ id: 'e', at: NOW, actor: ACTOR, kind: 'edited', changes });
    expect(e.changes).toEqual(changes);
  });
});

describe('isOverdue — คำนวณ ไม่ได้เก็บ', () => {
  it('หนังสือรับที่ยังรอเกษียนและเลยกำหนดแล้ว → เกิน', () => {
    expect(isOverdue(makeDoc({ dueDate: '2026-10-14' }), TODAY)).toBe(true);
  });

  it('วันกำหนดพอดียังไม่เกิน', () => {
    expect(isOverdue(makeDoc({ dueDate: TODAY }), TODAY)).toBe(false);
  });

  it('ไม่ได้กำหนดวัน ("") ไม่มีทางเกิน — ทั้งที่ "" น้อยกว่าทุกวันที่เมื่อเทียบสตริง', () => {
    expect(isOverdue(makeDoc({ dueDate: '' }), TODAY)).toBe(false);
  });

  it('ดำเนินการอยู่และเลยกำหนด → เกิน', () => {
    expect(isOverdue(makeDoc({ status: 'in-progress', dueDate: '2026-10-01' }), TODAY)).toBe(true);
  });

  it('เสร็จแล้วหรือยกเลิกแล้วไม่เกิน', () => {
    expect(isOverdue(makeDoc({ status: 'done', dueDate: '2026-10-01' }), TODAY)).toBe(false);
    expect(isOverdue(makeDoc({ status: 'void', dueDate: '2026-10-01' }), TODAY)).toBe(false);
  });

  it('หนังสือส่งไม่เกินกำหนดแม้ข้อมูลเสียจนมี dueDate ค้างอยู่', () => {
    const broken = makeDoc({ register: 'out', status: 'in-progress', dueDate: '2026-10-01' });
    expect(isOverdue(broken, TODAY)).toBe(false);
  });
});

describe('displayStatus', () => {
  it('เกินกำหนดแสดงแทนสถานะจริง', () => {
    expect(displayStatus(makeDoc({ dueDate: '2026-10-01' }), TODAY)).toBe('overdue');
  });

  it('ไม่เกินก็แสดงสถานะจริง', () => {
    // ต้องระบุ dueDate เอง — ค่าเริ่มต้นของ fixture (2026-10-10) เลย TODAY ไปแล้ว
    expect(displayStatus(makeDoc({ dueDate: '2026-10-20' }), TODAY)).toBe('pending');
    expect(displayStatus(makeDoc({ status: 'void' }), TODAY)).toBe('void');
  });
});
