// src/lib/saraban-member.test.ts
import { describe, expect, it } from 'vitest';
import { buildNewDoc, makeEvent, withDefaults } from '@/lib/saraban-doc';
import {
  canSeeDoc,
  countMemberTabs,
  MEMBER_PAGE_SIZE,
  memberActions,
  memberCandidateQuery,
  memberTab,
  memberUnitIdsFor,
  pageMemberDocs,
} from '@/lib/saraban-member';
import type { SarabanCirculation, SarabanDoc, SarabanUnit } from '@/types/saraban';

const ACTOR = { id: 'user_clerk_1', name: 'สมหญิง ใจดี' };
const NOW = '2026-11-04T03:00:00.000Z';

function unit(id: string, members: string[] = [], isActive = true): SarabanUnit {
  return { id, name: id, dept: '', refCode: '', order: 0, isActive, memberClerkIds: members };
}

function makeDoc(overrides: Partial<SarabanDoc> = {}): SarabanDoc {
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
    },
    { id: 'doc-1', fiscalYear: 2570, no: 1, files: [], actor: ACTOR, now: NOW, eventId: 'ev-1', eventNote: '' }
  );
  return { ...doc, ...overrides };
}

function circ(unitId: string, ackAt = ''): SarabanCirculation {
  return { unitId, unitName: unitId, sentAt: NOW, sentEventId: 'ev-2', ackAt, ackBy: ackAt ? 'u' : '', ackByName: ackAt ? 'u' : '' };
}

// เรื่องที่ปลัดเกษียนส่งต่อกองช่างไปแล้ว
function forwardedFromPalad(overrides: Partial<SarabanDoc> = {}): SarabanDoc {
  const ev = makeEvent({
    id: 'ev-2',
    at: NOW,
    actor: ACTOR,
    kind: 'annotated',
    note: 'มอบกองช่าง',
    detail: { onBehalfUnitId: 'palad', onBehalfName: 'ปลัดเทศบาล', route: 'forward', toUnitId: 'works', toUnitName: 'กองช่าง' },
  });
  const base = makeDoc();
  return { ...base, status: 'in-progress', holderUnitId: 'works', events: [...base.events, ev], ...overrides };
}

describe('canSeeDoc', () => {
  it('ถืออยู่ · ถูกเวียนถึง · เคยเกษียนในนามตำแหน่ง → เห็น', () => {
    expect(canSeeDoc(makeDoc(), ['palad'])).toBe(true);
    expect(canSeeDoc(makeDoc({ circulation: [circ('finance')] }), ['finance'])).toBe(true);
    expect(canSeeDoc(forwardedFromPalad(), ['palad'])).toBe(true);
  });

  it('ไม่เคยเกี่ยว → ไม่เห็น', () => {
    expect(canSeeDoc(makeDoc(), ['works'])).toBe(false);
    expect(canSeeDoc(makeDoc(), [])).toBe(false);
  });

  it('หนังสือส่ง/เวียนไม่อยู่ในโหมดเจ้าหน้าที่ แม้ holder เป็นตำแหน่งฉัน', () => {
    expect(canSeeDoc(makeDoc({ register: 'out' }), ['palad'])).toBe(false);
    expect(canSeeDoc(makeDoc({ register: 'circular' }), ['palad'])).toBe(false);
  });
});

describe('canSeeDoc ตรงกับกฎที่ memberCandidateQuery สะท้อน', () => {
  const legacy = makeDoc();
  delete (legacy as Partial<SarabanDoc>).circulation;
  const cases: Array<[string, SarabanDoc, boolean]> = [
    ['holder', makeDoc(), true],
    ['circulated', makeDoc({ holderUnitId: 'works', circulation: [circ('palad')] }), true],
    ['onBehalf-only', forwardedFromPalad(), true],
    ['void', makeDoc({ status: 'void' }), false],
    ["register 'out'", makeDoc({ register: 'out' }), false],
    ['legacy ไม่มี circulation', legacy, true],
    ['unrelated', makeDoc({ holderUnitId: 'finance' }), false],
  ];
  it.each(cases)('%s', (_name, d, expected) => {
    expect(canSeeDoc(withDefaults(d), ['palad'])).toBe(expected);
  });
});

describe('canSeeDoc: หนังสือที่ยกเลิก', () => {
  it('void → ไม่เห็น แม้ถืออยู่/ถูกเวียนถึง/เคยเกษียน', () => {
    expect(canSeeDoc(makeDoc({ status: 'void' }), ['palad'])).toBe(false);
    expect(canSeeDoc(makeDoc({ status: 'void', holderUnitId: 'works', circulation: [circ('palad')] }), ['palad'])).toBe(false);
    expect(canSeeDoc(forwardedFromPalad({ status: 'void' }), ['palad'])).toBe(false);
  });
});

describe('memberTab', () => {
  it('ถือหนังสือที่ยังเปิด → todo', () => {
    expect(memberTab(makeDoc(), ['palad'])).toBe('todo');
    expect(memberTab(makeDoc({ status: 'in-progress' }), ['palad'])).toBe('todo');
  });

  it('ถูกเวียนถึงแต่ยังไม่ทราบ → todo · ทราบแล้วและยังเปิด → forwarded', () => {
    expect(memberTab(makeDoc({ circulation: [circ('finance')] }), ['finance'])).toBe('todo');
    expect(memberTab(makeDoc({ circulation: [circ('finance', NOW)] }), ['finance'])).toBe('forwarded');
  });

  it('ส่งต่อไปแล้ว ยังเปิด → forwarded · ผู้ถือใหม่ได้ todo', () => {
    expect(memberTab(forwardedFromPalad(), ['palad'])).toBe('forwarded');
    expect(memberTab(forwardedFromPalad(), ['works'])).toBe('todo');
  });

  it('จบเรื่อง → done · แต่ถ้ายังมีแถวเวียนของฉันค้าง → todo (ทราบย้อนหลังได้)', () => {
    expect(memberTab(forwardedFromPalad({ status: 'done' }), ['palad'])).toBe('done');
    expect(memberTab(forwardedFromPalad({ status: 'done', circulation: [circ('palad')] }), ['palad'])).toBe('todo');
  });

  it('ยกเลิก หรือไม่เกี่ยว → null', () => {
    expect(memberTab(makeDoc({ status: 'void' }), ['palad'])).toBeNull();
    expect(memberTab(makeDoc({ status: 'void', circulation: [circ('palad')] }), ['palad'])).toBeNull();
    expect(memberTab(makeDoc(), ['works'])).toBeNull();
  });

  it('หลายตำแหน่ง: ตำแหน่งใดตำแหน่งหนึ่งถืออยู่ก็ todo', () => {
    expect(memberTab(forwardedFromPalad(), ['palad', 'works'])).toBe('todo');
  });

  it('เรื่องเก่าที่ไม่มี circulation → ทำงานได้', () => {
    const legacy = makeDoc();
    delete (legacy as Partial<SarabanDoc>).circulation;
    expect(memberTab(withDefaults(legacy), ['palad'])).toBe('todo');
  });

  it('เกษียนในนามอย่างเดียวและเรื่องจบแล้ว → done', () => {
    expect(memberTab(forwardedFromPalad({ status: 'done' }), ['palad'])).toBe('done');
  });

  it('ไม่แก้ input', () => {
    const docs = [makeDoc({ circulation: [circ('finance')] }), forwardedFromPalad({ id: 'c' })];
    const ids = ['finance', 'palad'];
    const docsClone = structuredClone(docs);
    const idsClone = structuredClone(ids);
    for (const d of docs) {
      memberTab(d, ids);
      memberActions(d, ids);
    }
    pageMemberDocs(docs, ids, 'todo', 1);
    countMemberTabs(docs, ids);
    expect(docs).toEqual(docsClone);
    expect(ids).toEqual(idsClone);
  });
});

describe('memberActions', () => {
  it('ถืออยู่และยังเปิด → annotateAs = holder', () => {
    expect(memberActions(makeDoc(), ['palad'])).toEqual({ annotateAs: 'palad', ackUnitIds: [] });
  });

  it('จบแล้ว → เกษียนไม่ได้ แต่ทราบแถวเวียนที่ค้างได้', () => {
    const doc = makeDoc({ status: 'done', circulation: [circ('palad'), circ('finance')] });
    expect(memberActions(doc, ['palad'])).toEqual({ annotateAs: null, ackUnitIds: ['palad'] });
  });

  it('ยกเลิก → ทำอะไรไม่ได้ · แถวที่ทราบแล้วไม่นับ', () => {
    expect(memberActions(makeDoc({ status: 'void', circulation: [circ('palad')] }), ['palad'])).toEqual({ annotateAs: null, ackUnitIds: [] });
    expect(memberActions(makeDoc({ circulation: [circ('finance', NOW)] }), ['finance'])).toEqual({ annotateAs: null, ackUnitIds: [] });
  });
});

describe('memberUnitIdsFor', () => {
  const units = [unit('palad', ['user_a']), unit('works', ['user_a', 'user_b']), unit('closed', ['user_a'], false)];

  it('Clerk: ตำแหน่งที่เปิดใช้และมีคนนี้ · เพิกเฉย as เสมอ', () => {
    expect(memberUnitIdsFor({ clerkOn: true, userId: 'user_a', as: 'closed', units })).toEqual(['palad', 'works']);
    expect(memberUnitIdsFor({ clerkOn: true, userId: 'user_c', as: 'palad', units })).toEqual([]);
  });

  it('dev-open: ใช้ as ตำแหน่งเดียว ต้องเป็นตำแหน่งที่เปิดใช้', () => {
    expect(memberUnitIdsFor({ clerkOn: false, userId: 'dev-open', as: 'works', units })).toEqual(['works']);
    expect(memberUnitIdsFor({ clerkOn: false, userId: 'dev-open', as: 'closed', units })).toEqual([]);
    expect(memberUnitIdsFor({ clerkOn: false, userId: 'dev-open', as: undefined, units })).toEqual([]);
  });
});

describe('memberCandidateQuery', () => {
  it('หนังสือรับที่ไม่ยกเลิก และเกี่ยวกับตำแหน่งทางใดทางหนึ่ง', () => {
    expect(memberCandidateQuery(['palad'])).toEqual({
      register: 'in',
      status: { $ne: 'void' },
      $or: [
        { holderUnitId: { $in: ['palad'] } },
        { 'circulation.unitId': { $in: ['palad'] } },
        { 'events.onBehalfUnitId': { $in: ['palad'] } },
      ],
    });
  });
});

describe('pageMemberDocs / countMemberTabs', () => {
  const docs = [
    makeDoc({ id: 'a', updatedAt: '2026-11-01T00:00:00.000Z' }),
    makeDoc({ id: 'b', updatedAt: '2026-11-03T00:00:00.000Z' }),
    forwardedFromPalad({ id: 'c' }),
    makeDoc({ id: 'other', holderUnitId: 'finance' }),
  ];

  it('กรองตามแท็บ เรียงแก้ล่าสุดก่อน ไม่รั่วเรื่องของตำแหน่งอื่น', () => {
    const { items, total } = pageMemberDocs(docs, ['palad'], 'todo', 1);
    expect(items.map((d) => d.id)).toEqual(['b', 'a']);
    expect(total).toBe(2);
    expect(countMemberTabs(docs, ['palad'])).toEqual({ todo: 2, forwarded: 1, done: 0 });
  });

  it('แบ่งหน้าละ MEMBER_PAGE_SIZE', () => {
    const many = Array.from({ length: MEMBER_PAGE_SIZE + 3 }, (_, i) =>
      makeDoc({ id: `d${String(i).padStart(3, '0')}`, updatedAt: NOW })
    );
    expect(pageMemberDocs(many, ['palad'], 'todo', 1).items).toHaveLength(MEMBER_PAGE_SIZE);
    const second = pageMemberDocs(many, ['palad'], 'todo', 2);
    expect(second.items).toHaveLength(3);
    expect(second.total).toBe(MEMBER_PAGE_SIZE + 3);
    // เวลาเท่ากัน → เรียงตาม id
    expect(pageMemberDocs(many, ['palad'], 'todo', 1).items[0].id).toBe('d000');
    expect(second.items.map((d) => d.id)).toEqual(['d020', 'd021', 'd022']);
    const past = pageMemberDocs(many, ['palad'], 'todo', 3);
    expect(past.items).toEqual([]);
    expect(past.total).toBe(MEMBER_PAGE_SIZE + 3);
  });
});
