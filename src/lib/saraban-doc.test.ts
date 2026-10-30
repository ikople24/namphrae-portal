// src/lib/saraban-doc.test.ts
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  buildEdit,
  buildNewDoc,
  canAddFile,
  canMarkSent,
  canRemoveFile,
  canVoid,
  displayStatus,
  EDITABLE_FIELDS,
  editableFieldsOf,
  isOpen,
  isOverdue,
  makeEvent,
  matches,
  nameUnitChanges,
  pickActorName,
  REGISTER_VIEWS,
  sentTransition,
  toMongoQuery,
  voidTransition,
  type DocFilter,
  type NewDocFields,
} from '@/lib/saraban-doc';
import { fieldLabel } from '@/lib/saraban-labels';
import { SARABAN_REGISTERS, type SarabanDoc } from '@/types/saraban';

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

// ---- กฎแก้ไข ยกเลิก ส่งแล้ว ไฟล์แนบ ----------------------------------------

describe('editableFieldsOf', () => {
  it('หนังสือรับที่รอเกษียน: แก้ได้ทุกช่องรวมเสนอถึง', () => {
    expect(editableFieldsOf({ register: 'in', status: 'pending' })).toEqual([
      'ref', 'docDate', 'party', 'subject', 'level', 'dueDate', 'holderUnitId',
    ]);
  });

  it('หนังสือรับที่เดินไปแล้ว: เปลี่ยนเสนอถึงไม่ได้ — หลังจากนี้หนังสือเดินตามการเกษียน', () => {
    for (const status of ['in-progress', 'done'] as const) {
      expect(editableFieldsOf({ register: 'in', status })).not.toContain('holderUnitId');
      expect(editableFieldsOf({ register: 'in', status })).toContain('subject');
    }
  });

  it('ส่ง/เวียน: "ที่" กับเจ้าของเรื่องล็อก (อาจพิมพ์ลงหนังสือจริงแล้ว) และไม่มีกำหนดแล้วเสร็จ', () => {
    for (const register of ['out', 'circular'] as const) {
      expect(editableFieldsOf({ register, status: 'in-progress' })).toEqual([
        'docDate', 'party', 'subject', 'level',
      ]);
    }
  });

  it('ยกเลิกแล้วแก้อะไรไม่ได้เลย', () => {
    expect(editableFieldsOf({ register: 'in', status: 'void' })).toEqual([]);
  });

  it('เลขทะเบียน ทะเบียน ปีงบ สถานะ และ audit ไม่มีทางอยู่ในรายการช่องที่แก้ได้', () => {
    const forbidden = ['id', 'no', 'register', 'fiscalYear', 'status', 'files', 'events',
      'registeredAt', 'registeredBy', 'updatedAt', 'sendMethod', 'voidReason'];
    for (const key of forbidden) {
      expect((EDITABLE_FIELDS as readonly string[]).includes(key), key).toBe(false);
    }
  });
});

describe('buildEdit', () => {
  const doc = makeDoc({ status: 'pending' });

  it('เก็บเฉพาะช่องที่เปลี่ยนจริง — ช่องที่ส่งค่าเดิมมาไม่นับ (ฟอร์มส่งมาครบทุกช่อง)', () => {
    const result = buildEdit(doc, { subject: 'เรื่องใหม่', party: doc.party });
    expect(result).toEqual({
      ok: true,
      set: { subject: 'เรื่องใหม่' },
      changes: [{ field: 'subject', from: doc.subject, to: 'เรื่องใหม่' }],
    });
  });

  it('ไม่มีอะไรเปลี่ยน → ผ่านโดยไม่มีอะไรให้เขียน', () => {
    expect(buildEdit(doc, { subject: doc.subject })).toEqual({ ok: true, set: {}, changes: [] });
  });

  it('ช่องที่ล็อกแต่ส่งค่าใหม่มา → ปฏิเสธทั้งคำขอ ไม่แก้ครึ่ง ๆ', () => {
    const moving = makeDoc({ status: 'in-progress' });
    expect(buildEdit(moving, { subject: 'ใหม่', holderUnitId: 'mayor' })).toEqual({
      ok: false,
      field: 'holderUnitId',
    });
  });

  it('ช่องที่ล็อกแต่ส่งค่าเดิมมา → ผ่าน', () => {
    const moving = makeDoc({ status: 'in-progress' });
    expect(buildEdit(moving, { holderUnitId: moving.holderUnitId }).ok).toBe(true);
  });

  it('หนังสือส่ง: แก้ "ที่" หรือกำหนดแล้วเสร็จไม่ได้', () => {
    const out = makeDoc({ register: 'out', status: 'in-progress', ref: 'ชม 55201/1', dueDate: '' });
    expect(buildEdit(out, { ref: 'ชม 55201/2' })).toEqual({ ok: false, field: 'ref' });
    expect(buildEdit(out, { dueDate: '2026-11-01' })).toEqual({ ok: false, field: 'dueDate' });
  });

  it('หลายช่องพร้อมกัน — changes เรียงตามลำดับของ EDITABLE_FIELDS', () => {
    const result = buildEdit(doc, { level: 'normal', ref: 'ชม 1/2' });
    expect(result.ok && result.changes.map((c) => c.field)).toEqual(['ref', 'level']);
  });
});

describe('canVoid / canMarkSent / canAddFile / canRemoveFile', () => {
  it('ยกเลิกได้เฉพาะเรื่องที่ยังเปิดอยู่', () => {
    expect(canVoid({ status: 'pending' })).toBe(true);
    expect(canVoid({ status: 'in-progress' })).toBe(true);
    expect(canVoid({ status: 'done' })).toBe(false);
    expect(canVoid({ status: 'void' })).toBe(false);
  });

  it('บันทึกว่าส่งแล้วได้เฉพาะส่ง/เวียนที่รอส่ง', () => {
    expect(canMarkSent({ register: 'out', status: 'in-progress' })).toBe(true);
    expect(canMarkSent({ register: 'circular', status: 'in-progress' })).toBe(true);
    expect(canMarkSent({ register: 'out', status: 'done' })).toBe(false);
    expect(canMarkSent({ register: 'in', status: 'in-progress' })).toBe(false);
  });

  it('เพิ่มไฟล์ได้ทุกสถานะยกเว้นยกเลิก · ลบไฟล์ได้เฉพาะเรื่องที่ยังเปิดอยู่', () => {
    expect(canAddFile({ status: 'done' })).toBe(true);
    expect(canAddFile({ status: 'void' })).toBe(false);
    expect(canRemoveFile({ status: 'pending' })).toBe(true);
    expect(canRemoveFile({ status: 'in-progress' })).toBe(true);
    expect(canRemoveFile({ status: 'done' })).toBe(false);
    expect(canRemoveFile({ status: 'void' })).toBe(false);
  });
});

describe('voidTransition / sentTransition', () => {
  it('ยกเลิก: สถานะ void + เหตุผล และเหตุผลเป็นข้อความของ event', () => {
    expect(voidTransition({ status: 'pending' }, 'ลงรับซ้ำ')).toEqual({
      set: { status: 'void', voidReason: 'ลงรับซ้ำ' },
      kind: 'voided',
      note: 'ลงรับซ้ำ',
    });
  });

  it('ยกเลิกเรื่องที่เสร็จแล้วไม่ได้ → null (route ตอบ 409)', () => {
    expect(voidTransition({ status: 'done' }, 'x')).toBeNull();
  });

  it('ส่งแล้ว: สถานะ done + วิธีส่ง และป้ายวิธีส่งเป็นข้อความของ event', () => {
    expect(sentTransition({ register: 'out', status: 'in-progress' }, 'post')).toEqual({
      set: { status: 'done', sendMethod: 'post' },
      kind: 'sent',
      note: 'ส่งทางไปรษณีย์',
    });
  });

  it('หนังสือรับบันทึกว่าส่งแล้วไม่ได้ → null', () => {
    expect(sentTransition({ register: 'in', status: 'in-progress' }, 'post')).toBeNull();
  });
});

// fieldLabel ใช้ map แบบ string key (ต้องแปลชื่อช่องของ event เก่าได้แม้ช่องนั้นเลิกใช้แล้ว)
// คอมไพเลอร์จึงไม่เช็คให้ — เทสต์นี้กันเพิ่มช่องใน EDITABLE_FIELDS แล้วลืมตั้งชื่อไทย
describe('EDITABLE_FIELDS มีชื่อไทยครบ', () => {
  it('ทุกช่องที่แก้ได้มีชื่อไทยในประวัติการแก้ไข ทุกทะเบียน', () => {
    for (const register of SARABAN_REGISTERS) {
      for (const field of EDITABLE_FIELDS) {
        expect(fieldLabel(register, field), `${register}.${field}`).not.toBe(field);
      }
    }
  });
});

describe('pickActorName — ชื่อที่ประทับใน event', () => {
  it('ชื่อจากทะเบียนสมาชิกก่อน (ตัดช่องว่าง)', () => {
    expect(pickActorName('  สมหญิง ใจดี ', 'a@b.c', 'user_1')).toBe('สมหญิง ใจดี');
  });

  it('ไม่มีชื่อ → อีเมล → clerkId แบบ /api/admin/me', () => {
    expect(pickActorName(undefined, 'a@b.c', 'user_1')).toBe('a@b.c');
    expect(pickActorName('   ', undefined, 'user_1')).toBe('user_1');
    expect(pickActorName(42, undefined, 'user_1')).toBe('user_1');
  });
});

describe('nameUnitChanges — ประวัติเก็บชื่อหน่วย ณ ขณะนั้น ไม่ใช่ id', () => {
  it('แปลงเฉพาะ holderUnitId ช่องอื่นคงเดิม', () => {
    const names: Record<string, string> = { palad: 'ปลัดเทศบาล', mayor: 'นายกเทศมนตรี' };
    const result = nameUnitChanges(
      [
        { field: 'subject', from: 'ก', to: 'ข' },
        { field: 'holderUnitId', from: 'palad', to: 'mayor' },
      ],
      (id) => names[id] ?? id
    );
    expect(result).toEqual([
      { field: 'subject', from: 'ก', to: 'ข' },
      { field: 'holderUnitId', from: 'ปลัดเทศบาล', to: 'นายกเทศมนตรี' },
    ]);
  });
});
