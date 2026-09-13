// src/lib/saraban-doc.test.ts
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  buildNewDoc,
  displayStatus,
  isOpen,
  isOverdue,
  makeEvent,
  matches,
  REGISTER_VIEWS,
  toMongoQuery,
  type DocFilter,
  type NewDocFields,
} from '@/lib/saraban-doc';
import type { SarabanDoc } from '@/types/saraban';

const ACTOR = { id: 'user_clerk_1', name: 'สมหญิง ใจดี' };
const NOW = '2026-10-02T02:30:00.000Z';
const TODAY = '2026-10-15';

// dueDate เริ่มต้นอยู่หลัง TODAY โดยตั้งใจ — หนังสือตั้งต้นต้องยังไม่เกินกำหนด เทสต์ที่อยากได้
// เรื่องเกินกำหนดต้องใส่ dueDate เองให้เห็นในเทสต์นั้น
function fields(overrides: Partial<NewDocFields> = {}): NewDocFields {
  return {
    register: 'in',
    ref: 'ชม 0023.1/ว 1245',
    docDate: '2026-09-28',
    party: 'ที่ทำการปกครองอำเภอหางดง',
    subject: 'ขอเชิญประชุมหัวหน้าส่วนราชการ',
    level: 'urgent',
    dueDate: '2026-10-20',
    holderUnitId: 'palad',
    ...overrides,
  };
}

// overrides ทับหลังสร้าง (ข้ามกฎของ buildNewDoc) — ใช้แก้ค่าเดียวที่เทสต์สนใจ เช่น status
// fieldOverrides ผ่าน buildNewDoc — ใช้เปลี่ยนทะเบียน จะได้สถานะ/dueDate/event ตามทะเบียนจริง
// (makeDoc({ register: 'out' }) ได้หนังสือที่เป็นไปไม่ได้: ส่งแต่ pending และมี dueDate)
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
    expect(doc.dueDate).toBe('2026-10-20');
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
    expect(displayStatus(makeDoc(), TODAY)).toBe('pending');
    expect(displayStatus(makeDoc({ status: 'void' }), TODAY)).toBe('void');
  });
});

describe('isOpen — รายการเดียวของ "ยังเปิดอยู่"', () => {
  it('รอเกษียนและดำเนินการเปิดอยู่ · เสร็จและยกเลิกปิดแล้ว', () => {
    expect(isOpen('pending')).toBe(true);
    expect(isOpen('in-progress')).toBe(true);
    expect(isOpen('done')).toBe(false);
    expect(isOpen('void')).toBe(false);
  });
});

// ---- ตัวกรองทะเบียน -------------------------------------------------------

// ตัวประเมิน query ของ Mongo แบบย่อ — รู้จักเฉพาะ operator ที่ toMongoQuery() ใช้จริง
// เจอ operator อื่นให้ throw เพื่อบังคับให้คนที่เพิ่ม operator ใหม่ใน toMongoQuery ต้องมา
// สอนตัวประเมินนี้ด้วย ไม่งั้นเทสต์เทียบสองฝั่งจะผ่านแบบไม่ได้ตรวจอะไรจริง
function evalQuery(doc: Record<string, unknown>, query: Record<string, unknown>): boolean {
  return Object.entries(query).every(([key, cond]) => {
    if (key === '$and') return (cond as Record<string, unknown>[]).every((q) => evalQuery(doc, q));
    if (key === '$or') return (cond as Record<string, unknown>[]).some((q) => evalQuery(doc, q));
    if (key.startsWith('$')) throw new Error(`evalQuery ไม่รู้จัก ${key}`);
    const value = doc[key];
    if (cond !== null && typeof cond === 'object' && !Array.isArray(cond)) {
      return Object.entries(cond as Record<string, unknown>).every(([op, arg]) => {
        switch (op) {
          case '$in':
            return (arg as unknown[]).includes(value);
          case '$ne':
            return value !== arg;
          case '$lt':
            return (value as string | number) < (arg as string | number);
          case '$gte':
            return (value as string | number) >= (arg as string | number);
          default:
            throw new Error(`evalQuery ไม่รู้จัก ${op} — เพิ่มที่นี่ก่อนใช้ใน toMongoQuery`);
        }
      });
    }
    return value === cond;
  });
}

// TODAY = '2026-10-15' — ชื่อ id บอกว่าหนังสือแต่ละเรื่องควรตกอยู่ใต้ปุ่มไหน
const FIXTURE: SarabanDoc[] = [
  makeDoc({ id: 'in-pending', no: 1, status: 'pending', dueDate: '2026-10-20' }),
  makeDoc({ id: 'in-pending-nodue', no: 2, status: 'pending', dueDate: '' }),
  makeDoc({ id: 'in-overdue', no: 3, status: 'pending', dueDate: '2026-10-01' }),
  makeDoc({ id: 'in-progress', no: 4, status: 'in-progress', dueDate: TODAY }),
  makeDoc({ id: 'in-progress-late', no: 5, status: 'in-progress', dueDate: '2026-10-14' }),
  makeDoc({ id: 'in-done', no: 6, status: 'done', dueDate: '2026-10-01' }),
  makeDoc({ id: 'in-void', no: 7, status: 'void', dueDate: '' }),
  makeDoc({ id: 'in-old-open', fiscalYear: 2569, no: 400, status: 'pending', dueDate: '' }),
  makeDoc({ id: 'in-old-done', fiscalYear: 2569, no: 401, status: 'done', dueDate: '' }),
  // ส่ง/เวียนผ่าน fieldOverrides ให้ buildNewDoc กำหนดสถานะและ dueDate ตามจริง (ดูคอมเมนต์ makeDoc)
  makeDoc({ id: 'out-waiting', no: 1 }, { register: 'out' }),
  makeDoc({ id: 'out-sent', no: 2, status: 'done' }, { register: 'out' }),
  makeDoc({ id: 'circ-waiting', no: 1 }, { register: 'circular' }),
];

function idsFor(filter: DocFilter): string[] {
  return FIXTURE.filter((d) => matches(d, filter, TODAY)).map((d) => d.id);
}

describe('matches — ปุ่มกรองแยกขาดตามป้ายที่เห็น', () => {
  const view = (v: DocFilter['view']): DocFilter => ({ register: 'in', fiscalYear: 2570, view: v });

  it('ทั้งหมด = ทุกเรื่องของทะเบียนและปีงบนั้น รวมที่ยกเลิก', () => {
    expect(idsFor(view('all'))).toEqual([
      'in-pending', 'in-pending-nodue', 'in-overdue', 'in-progress',
      'in-progress-late', 'in-done', 'in-void',
    ]);
  });

  it('รอเกษียนไม่รวมเรื่องที่เกินกำหนด — เรื่องนั้นอยู่ใต้ปุ่มเกินกำหนดที่เดียว', () => {
    expect(idsFor(view('pending'))).toEqual(['in-pending', 'in-pending-nodue']);
    expect(idsFor(view('overdue'))).toEqual(['in-overdue', 'in-progress-late']);
  });

  it('ดำเนินการ · เสร็จสิ้น · ยกเลิก', () => {
    expect(idsFor(view('in-progress'))).toEqual(['in-progress']);
    expect(idsFor(view('done'))).toEqual(['in-done']);
    expect(idsFor(view('void'))).toEqual(['in-void']);
  });

  it('ตัวเลขบนปุ่มทุกปุ่ม (ยกเว้นทั้งหมด) รวมกันได้เท่ากับทั้งหมดพอดี', () => {
    const sum = REGISTER_VIEWS.filter((v) => v !== 'all')
      .map((v) => idsFor(view(v)).length)
      .reduce((a, b) => a + b, 0);
    expect(sum).toBe(idsFor(view('all')).length);
  });

  it('หนังสือส่งไม่มีทางเกินกำหนด และแยกจากหนังสือเวียน', () => {
    expect(idsFor({ register: 'out', fiscalYear: 2570, view: 'in-progress' })).toEqual(['out-waiting']);
    expect(idsFor({ register: 'out', fiscalYear: 2570, view: 'done' })).toEqual(['out-sent']);
    expect(idsFor({ register: 'out', fiscalYear: 2570, view: 'overdue' })).toEqual([]);
    expect(idsFor({ register: 'circular', fiscalYear: 2570 })).toEqual(['circ-waiting']);
  });
});

describe('matches — สถานะดิบ (badge และแถบค้างข้ามปี)', () => {
  it('badge: รอเกษียนทุกปีงบ รวมเรื่องที่เกินกำหนด', () => {
    expect(idsFor({ register: 'in', statusIn: ['pending'] })).toEqual([
      'in-pending', 'in-pending-nodue', 'in-overdue', 'in-old-open',
    ]);
  });

  it('แถบค้างข้ามปี: เรื่องที่ยังเปิดอยู่ของปีงบก่อนหน้า', () => {
    expect(
      idsFor({ register: 'in', beforeFiscalYear: 2570, statusIn: ['pending', 'in-progress'] })
    ).toEqual(['in-old-open']);
  });
});

describe('toMongoQuery — ต้องพูดกฎเดียวกับ matches ทุกกรณี', () => {
  const FILTERS: DocFilter[] = [
    { register: 'in' },
    { register: 'in', fiscalYear: 2569 },
    ...REGISTER_VIEWS.map((view): DocFilter => ({ register: 'in', fiscalYear: 2570, view })),
    ...REGISTER_VIEWS.map((view): DocFilter => ({ register: 'out', fiscalYear: 2570, view })),
    { register: 'circular', fiscalYear: 2570, view: 'in-progress' },
    { register: 'in', statusIn: ['pending'] },
    { register: 'in', beforeFiscalYear: 2570, statusIn: ['pending', 'in-progress'] },
  ];

  it.each(FILTERS)('%j', (filter) => {
    const query = toMongoQuery(filter, TODAY);
    for (const doc of FIXTURE) {
      expect(evalQuery(doc as unknown as Record<string, unknown>, query), doc.id).toBe(
        matches(doc, filter, TODAY)
      );
    }
  });

  it('ตัวกรองทะเบียนอย่างเดียวได้ query แบนธรรมดา ไม่ห่อ $and', () => {
    expect(toMongoQuery({ register: 'in' }, TODAY)).toEqual({ register: 'in' });
  });
});
