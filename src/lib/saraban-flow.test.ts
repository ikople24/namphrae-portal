// src/lib/saraban-flow.test.ts
import { describe, expect, it } from 'vitest';
import { buildNewDoc, makeEvent, type NewDocFields } from '@/lib/saraban-doc';
import {
  ackTransition,
  annotateTransition,
  canAck,
  canAnnotate,
  FLOW_ERROR_STATUS,
  flowStep,
  type AnnotateInput,
} from '@/lib/saraban-flow';
import { SARABAN_REGISTERS, SARABAN_STATUSES, type SarabanDoc, type SarabanUnit } from '@/types/saraban';

const ACTOR = { id: 'user_clerk_1', name: 'สมหญิง ใจดี' };
const NOW = '2026-11-03T03:00:00.000Z';
const STAMP = { now: NOW, eventId: 'ev-new' };

function unit(id: string, name: string, isActive = true): SarabanUnit {
  return { id, name, dept: '', refCode: '', order: 0, isActive, memberClerkIds: [] };
}

const UNITS: SarabanUnit[] = [
  unit('palad', 'ปลัดเทศบาล'),
  unit('dir-works', 'ผอ.กองช่าง'),
  unit('finance', 'กองคลัง'),
  unit('education', 'กองการศึกษา'),
  unit('closed-unit', 'หน่วยที่ปิดแล้ว', false),
];

function makeDoc(overrides: Partial<SarabanDoc> = {}, fields: Partial<NewDocFields> = {}): SarabanDoc {
  const doc = buildNewDoc(
    {
      register: 'in',
      ref: 'ชม 0023.1/ว 1245',
      docDate: '2026-10-28',
      party: 'อำเภอหางดง',
      subject: 'ขอเชิญประชุม',
      level: 'normal',
      dueDate: '',
      holderUnitId: 'palad',
      ...fields,
    },
    { id: 'doc-1', fiscalYear: 2570, no: 1, files: [], actor: ACTOR, now: NOW, eventId: 'ev-1', eventNote: '' }
  );
  return { ...doc, ...overrides };
}

const input = (over: Partial<AnnotateInput> = {}): AnnotateInput => ({
  note: 'ทราบ มอบกองช่างดำเนินการ',
  route: { kind: 'stay' },
  circulateTo: [],
  ...over,
});

describe('canAnnotate', () => {
  it('เฉพาะหนังสือรับที่ยังเปิดอยู่', () => {
    for (const register of SARABAN_REGISTERS) {
      for (const status of SARABAN_STATUSES) {
        const expected = register === 'in' && (status === 'pending' || status === 'in-progress');
        expect(canAnnotate({ register, status }), `${register}/${status}`).toBe(expected);
      }
    }
  });
});

describe('annotateTransition — ปลายทาง', () => {
  it('forward จาก pending: เปลี่ยน holder · ดำเนินการ · ชื่อมาจากสมุด', () => {
    const r = annotateTransition(makeDoc(), input({ route: { kind: 'forward', toUnitId: 'dir-works' } }), UNITS, STAMP);
    expect(r).toEqual({
      ok: true,
      set: { status: 'in-progress', holderUnitId: 'dir-works' },
      note: 'ทราบ มอบกองช่างดำเนินการ',
      detail: {
        onBehalfUnitId: 'palad',
        onBehalfName: 'ปลัดเทศบาล',
        route: 'forward',
        toUnitId: 'dir-works',
        toUnitName: 'ผอ.กองช่าง',
      },
    });
  });

  it('forward ซ้ำจาก in-progress ได้', () => {
    const doc = makeDoc({ status: 'in-progress', holderUnitId: 'dir-works' });
    const r = annotateTransition(doc, input({ route: { kind: 'forward', toUnitId: 'palad' } }), UNITS, STAMP);
    expect(r.ok && r.set).toEqual({ status: 'in-progress', holderUnitId: 'palad' });
  });

  it('close: จบเรื่อง · holder คงเดิม', () => {
    const r = annotateTransition(makeDoc({ status: 'in-progress' }), input({ route: { kind: 'close' } }), UNITS, STAMP);
    expect(r.ok && r.set).toEqual({ status: 'done' });
    expect(r.ok && r.detail.route).toBe('close');
  });

  it('stay: pending → in-progress · in-progress คงเดิม', () => {
    expect(annotateTransition(makeDoc(), input(), UNITS, STAMP)).toMatchObject({ ok: true, set: { status: 'in-progress' } });
    expect(
      annotateTransition(makeDoc({ status: 'in-progress' }), input(), UNITS, STAMP)
    ).toMatchObject({ ok: true, set: { status: 'in-progress' } });
  });

  it('ส่งต่อให้ตำแหน่งที่หนังสืออยู่แล้ว → same_holder', () => {
    const r = annotateTransition(makeDoc(), input({ route: { kind: 'forward', toUnitId: 'palad' } }), UNITS, STAMP);
    expect(r).toEqual({ ok: false, error: 'same_holder' });
  });

  it('ปลายทางปิดหรือไม่มี → invalid_unit', () => {
    for (const toUnitId of ['closed-unit', 'ghost']) {
      const r = annotateTransition(makeDoc(), input({ route: { kind: 'forward', toUnitId } }), UNITS, STAMP);
      expect(r).toEqual({ ok: false, error: 'invalid_unit', unitId: toUnitId });
    }
  });

  it('หนังสือส่ง · จบแล้ว · ยกเลิก → invalid_transition', () => {
    const docs = [
      makeDoc({}, { register: 'out' }),
      makeDoc({ status: 'done' }),
      makeDoc({ status: 'void' }),
    ];
    for (const doc of docs) {
      expect(annotateTransition(doc, input(), UNITS, STAMP)).toEqual({ ok: false, error: 'invalid_transition' });
    }
  });

  it('ชื่อตำแหน่งผู้สั่งที่ไม่มีในสมุดแล้วใช้ id แทน — ไม่ล้ม', () => {
    const r = annotateTransition(makeDoc({ holderUnitId: 'gone' }), input(), UNITS, STAMP);
    expect(r.ok && r.detail.onBehalfName).toBe('gone');
  });
});

describe('annotateTransition — แจ้งเวียน', () => {
  it('ต่อท้าย circulation พร้อมเวลาและ event id · detail มีรายชื่อ', () => {
    const r = annotateTransition(makeDoc(), input({ circulateTo: ['finance', 'education'] }), UNITS, STAMP);
    expect(r.ok && r.set.circulation).toEqual([
      { unitId: 'finance', unitName: 'กองคลัง', sentAt: NOW, sentEventId: 'ev-new', ackAt: '', ackBy: '', ackByName: '' },
      { unitId: 'education', unitName: 'กองการศึกษา', sentAt: NOW, sentEventId: 'ev-new', ackAt: '', ackBy: '', ackByName: '' },
    ]);
    expect(r.ok && r.detail.circulateTo).toEqual([
      { unitId: 'finance', unitName: 'กองคลัง' },
      { unitId: 'education', unitName: 'กองการศึกษา' },
    ]);
  });

  it('เวียนพร้อมส่งต่อในครั้งเดียว', () => {
    const r = annotateTransition(
      makeDoc(),
      input({ route: { kind: 'forward', toUnitId: 'dir-works' }, circulateTo: ['finance'] }),
      UNITS,
      STAMP
    );
    expect(r.ok && r.set.holderUnitId).toBe('dir-works');
    expect(r.ok && r.set.circulation?.map((c) => c.unitId)).toEqual(['finance']);
  });

  it('ไม่เวียน = ไม่แตะ circulation', () => {
    const r = annotateTransition(makeDoc(), input(), UNITS, STAMP);
    expect(r.ok && 'circulation' in r.set).toBe(false);
    expect(r.ok && 'circulateTo' in r.detail).toBe(false);
  });

  it('เวียนซ้ำตำแหน่งที่อยู่ในรายการแล้ว หรือซ้ำกันเองใน body → already_circulated', () => {
    const first = annotateTransition(makeDoc(), input({ circulateTo: ['finance'] }), UNITS, STAMP);
    const doc = makeDoc({ circulation: first.ok ? first.set.circulation! : [] });
    expect(annotateTransition(doc, input({ circulateTo: ['finance'] }), UNITS, STAMP)).toEqual({
      ok: false,
      error: 'already_circulated',
      unitId: 'finance',
    });
    expect(annotateTransition(makeDoc(), input({ circulateTo: ['education', 'education'] }), UNITS, STAMP)).toEqual({
      ok: false,
      error: 'already_circulated',
      unitId: 'education',
    });
  });

  it('เวียนถึงตำแหน่งที่ปิด → invalid_unit', () => {
    expect(annotateTransition(makeDoc(), input({ circulateTo: ['closed-unit'] }), UNITS, STAMP)).toEqual({
      ok: false,
      error: 'invalid_unit',
      unitId: 'closed-unit',
    });
  });
});

describe('ackTransition', () => {
  function circulated(over: Partial<SarabanDoc> = {}): SarabanDoc {
    const r = annotateTransition(makeDoc(), input({ circulateTo: ['finance', 'education'] }), UNITS, STAMP);
    if (!r.ok) throw new Error('fixture');
    return makeDoc({ status: 'in-progress', circulation: r.set.circulation!, ...over });
  }
  const ACK = { now: '2026-11-04T02:00:00.000Z', actor: ACTOR };

  it('เขียน ackAt/ackBy เฉพาะแถวนั้น · detail มีชื่อตำแหน่ง', () => {
    const r = ackTransition(circulated(), 'education', ACK);
    expect(r.ok && r.set.circulation?.map((c) => [c.unitId, c.ackAt, c.ackBy, c.ackByName])).toEqual([
      ['finance', '', '', ''],
      ['education', ACK.now, 'user_clerk_1', 'สมหญิง ใจดี'],
    ]);
    expect(r.ok && r.detail).toEqual({ unitId: 'education', unitName: 'กองการศึกษา' });
    expect(r.ok && r.note).toBe('');
  });

  it('ได้แม้เรื่องจบแล้ว · ไม่ได้ถ้ายกเลิก', () => {
    expect(ackTransition(circulated({ status: 'done' }), 'finance', ACK).ok).toBe(true);
    expect(ackTransition(circulated({ status: 'void' }), 'finance', ACK)).toEqual({ ok: false, error: 'invalid_transition' });
    expect(canAck({ status: 'done' })).toBe(true);
    expect(canAck({ status: 'void' })).toBe(false);
  });

  it('ตำแหน่งที่ไม่ได้ถูกเวียน → not_circulated · ทราบซ้ำ → already_acknowledged', () => {
    expect(ackTransition(circulated(), 'palad', ACK)).toEqual({ ok: false, error: 'not_circulated' });
    const once = ackTransition(circulated(), 'finance', ACK);
    const doc = circulated({ circulation: once.ok ? once.set.circulation! : [] });
    expect(ackTransition(doc, 'finance', ACK)).toEqual({ ok: false, error: 'already_acknowledged' });
  });
});

describe('flowStep — แถบ 5 ขั้นคำนวณจาก events', () => {
  const annotated = (route: 'forward' | 'stay' | 'close', i: number) =>
    makeEvent({ id: `a${i}`, at: NOW, actor: ACTOR, kind: 'annotated', note: 'x', detail: { route } });

  it('ยังไม่เกษียน = ขั้น 2 · forward 1 ครั้ง = 3 · ≥ 2 = 4 · done = 5', () => {
    const base = makeDoc();
    expect(flowStep(base)).toBe(2);
    expect(flowStep({ ...base, status: 'in-progress', events: [...base.events, annotated('stay', 1)] })).toBe(2);
    expect(flowStep({ ...base, status: 'in-progress', events: [...base.events, annotated('forward', 1)] })).toBe(3);
    expect(
      flowStep({ ...base, status: 'in-progress', events: [...base.events, annotated('forward', 1), annotated('forward', 2)] })
    ).toBe(4);
    expect(flowStep({ ...base, status: 'done' })).toBe(5);
  });

  it('แก้ "เสนอถึง" ตอนรอเกษียน (event edited) ไม่นับเป็นขั้น', () => {
    const base = makeDoc();
    const edited = makeEvent({ id: 'e', at: NOW, actor: ACTOR, kind: 'edited', changes: [{ field: 'holderUnitId', from: 'ปลัดเทศบาล', to: 'นายกเทศมนตรี' }] });
    expect(flowStep({ ...base, events: [...base.events, edited] })).toBe(2);
  });

  it('หนังสือส่ง/เวียน และเรื่องที่ยกเลิก ไม่มีแถบ', () => {
    expect(flowStep(makeDoc({}, { register: 'out' }))).toBeNull();
    expect(flowStep(makeDoc({ status: 'void' }))).toBeNull();
  });
});

describe('FLOW_ERROR_STATUS', () => {
  it('สถานะผิดลำดับ/ทราบซ้ำ = 409 · ข้อมูลผิด = 400', () => {
    expect(FLOW_ERROR_STATUS.invalid_transition).toBe(409);
    expect(FLOW_ERROR_STATUS.already_acknowledged).toBe(409);
    expect(FLOW_ERROR_STATUS.same_holder).toBe(400);
    expect(FLOW_ERROR_STATUS.invalid_unit).toBe(400);
  });
});
