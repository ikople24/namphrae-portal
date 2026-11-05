# แผนลงมือรอบ 2 — เกษียน · ส่งต่อ · แจ้งเวียนภายใน · ติดตามเต็ม

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หนังสือรับเดินได้ — ธุรการบันทึกเกษียนแทนตำแหน่งที่หนังสืออยู่ ส่งต่อ/จบเรื่อง/เวียนให้ทราบ
ติ๊กทราบแทน และดูความคืบหน้าบนแถบ 5 ขั้น

**Architecture:** state machine บริสุทธิ์ไฟล์ใหม่ `saraban-flow.ts` (แบบ `job-status.ts`) ตัดสินทุกอย่าง ·
PATCH route เดิมรับ action ใหม่ `annotate` / `ack` แล้วเขียนผ่าน `applyPatch` ที่มี optimistic
concurrency อยู่แล้ว · หน้าใหม่ `/saraban/annotate/[id]` + หน้าติดตามฉบับเต็ม · component บาง ๆ

**Tech Stack:** Next.js 16 Pages Router · React 19 · Tailwind v4 (`--color-sb-*`) · SWR 2 · zod 4 · vitest

**สเปก:** [2026-11-03-saraban-2-annotate-design.md](../specs/2026-11-03-saraban-2-annotate-design.md) ·
**สเปกแม่:** [2026-09-13-saraban-design.md](../specs/2026-09-13-saraban-design.md)

---

## โครงไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/types/saraban.ts` | **แก้** — event kind ใหม่ · `SarabanEventDetail` · `SarabanCirculation` · `doc.circulation` |
| `src/lib/saraban-doc.ts` (+test) | **แก้** — `makeEvent` รับ `detail` · `buildNewDoc` เขียน `circulation: []` · `withDefaults` |
| `src/lib/saraban-labels.ts` | **แก้** — ป้าย event ใหม่ · `FLOW_STEP_LABELS` · `QUICK_NOTES` · `ROUTE_LABELS` |
| `src/lib/saraban-flow.ts` (+test) | **ใหม่** — `canAnnotate` · `canAck` · `annotateTransition` · `ackTransition` · `flowStep` · `FLOW_ERROR_STATUS` |
| `src/lib/saraban-schema.ts` (+test) | **แก้** — action `annotate` / `ack` · `scope=open` ของทะเบียน |
| `src/lib/saraban-store.ts` | **แก้** — `DocSet` รวม `circulation` · ทุกทางที่คืนหนังสือผ่าน `withDefaults` |
| `src/lib/saraban-view.ts` | **แก้** — ข้อความ error ใหม่ · `docsKey` รับ `scope` |
| `src/pages/api/admin/saraban/docs/index.ts` | **แก้** — `scope=open` |
| `src/pages/api/admin/saraban/docs/[id]/index.ts` | **แก้** — action `annotate` / `ack` |
| `src/lib/saraban-api.ts` | **แก้** — `annotateDoc` · `ackCirculation` |
| `src/components/saraban/FlowSteps.tsx` | **ใหม่** — แถบ 5 ขั้น |
| `src/components/saraban/EventDetail.tsx` | **ใหม่** — บรรทัดรายละเอียดของ event รอบ 2 (ในนาม · → ปลายทาง · เวียน) |
| `src/components/saraban/CirculationCard.tsx` | **ใหม่** — การ์ดแจ้งเวียน + ปุ่มทราบ |
| `src/components/saraban/AnnotateForm.tsx` | **ใหม่** — ฟอร์มสั่งการ |
| `src/pages/saraban/annotate/[id].tsx` | **ใหม่** — หน้าเกษียน |
| `src/pages/saraban/track/[id].tsx` | **แก้** — รายการซ้าย · แถบ 5 ขั้น · การ์ดเวียน · ปุ่มเกษียน · ไทม์ไลน์ |
| `src/components/saraban/RegisterPage.tsx` | **แก้** — คอลัมน์ "อยู่กับ" · ปุ่ม "เกษียน" (เฉพาะทะเบียนรับ) |

## ข้อตกลงของรอบนี้

- baseline (2026-11-03 บน `feat/saraban-2`): `npx vitest run` **38 ไฟล์ 584 เทสต์** · `npx tsc --noEmit` สะอาด
- component ไม่มีเทสต์หน่วย (repo เทสต์ตรรกะบริสุทธิ์) — การตัดสินทุกอย่างอยู่ใน `saraban-flow.ts`
- ไอคอนที่ใช้ (`assignment` · `arrow_forward` · `campaign` · `check_circle` · `history`) มีใน
  `ICON_NAMES` แล้ว — ห้ามใช้ชื่ออื่นโดยไม่เพิ่มใน `src/lib/icons.ts` ก่อน
- commit ท้ายทุกงาน · ข้อความ commit ภาษาไทยแบบ `feat(saraban): …` ลงท้ายด้วย
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

### Task 1: ชนิดข้อมูล + makeEvent detail + circulation ใน buildNewDoc

**Files:**
- Modify: `src/types/saraban.ts`
- Modify: `src/lib/saraban-doc.ts` (`makeEvent`, `buildNewDoc`, เพิ่ม `withDefaults`)
- Modify: `src/lib/saraban-labels.ts` (`EVENT_KIND_LABELS`)
- Test: `src/lib/saraban-doc.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** — ใน `src/lib/saraban-doc.test.ts`

แก้ `DOC_KEYS` ให้มี `'circulation'` (ต่อท้ายหลัง `'events'`):

```ts
const DOC_KEYS = [
  'id', 'register', 'fiscalYear', 'no', 'ref', 'docDate', 'party', 'subject', 'level',
  'dueDate', 'holderUnitId', 'status', 'sendMethod', 'voidReason', 'files', 'events',
  'circulation', 'registeredAt', 'registeredBy', 'updatedAt',
] as const satisfies readonly (keyof SarabanDoc)[];
```

เพิ่ม `withDefaults` ใน import จาก `@/lib/saraban-doc` แล้วเพิ่มท้ายไฟล์:

```ts
describe('รอบ 2 — circulation และ detail ของ event', () => {
  it('buildNewDoc เขียน circulation: [] เสมอ', () => {
    expect(makeDoc().circulation).toEqual([]);
    expect(makeDoc({}, { register: 'out' }).circulation).toEqual([]);
  });

  it('withDefaults เติม circulation ให้หนังสือรอบ 1 ที่ไม่มีคีย์ · ของที่มีแล้วคืนตัวเดิม', () => {
    const { circulation: _drop, ...legacy } = makeDoc();
    const fixed = withDefaults(legacy as SarabanDoc);
    expect(fixed.circulation).toEqual([]);
    const current = makeDoc();
    expect(withDefaults(current)).toBe(current);
  });

  it('makeEvent ใส่ detail เฉพาะคีย์ที่มีค่า — ไม่เขียน undefined ลง Mongo', () => {
    const ev = makeEvent({
      id: 'e',
      at: NOW,
      actor: ACTOR,
      kind: 'annotated',
      note: 'ทราบ',
      detail: { onBehalfUnitId: 'palad', onBehalfName: 'ปลัดเทศบาล', route: 'stay', toUnitId: undefined },
    });
    expect(ev).toEqual({
      id: 'e',
      at: NOW,
      by: 'user_clerk_1',
      byName: 'สมหญิง ใจดี',
      kind: 'annotated',
      note: 'ทราบ',
      onBehalfUnitId: 'palad',
      onBehalfName: 'ปลัดเทศบาล',
      route: 'stay',
    });
    expect('toUnitId' in ev).toBe(false);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run src/lib/saraban-doc.test.ts`
Expected: FAIL — `withDefaults` ไม่มี export / `circulation` เป็น undefined

- [ ] **Step 3: แก้ชนิดใน `src/types/saraban.ts`**

ต่อท้าย `SARABAN_EVENT_KINDS`:

```ts
export const SARABAN_EVENT_KINDS = [
  'received', // ลงรับ
  'issued', // ออกเลขส่ง/เวียน
  'edited',
  'file-added',
  'file-removed',
  'sent',
  'voided',
  'annotated', // เกษียน/สั่งการ (รอบ 2) — ธุรการบันทึกแทนตำแหน่งที่หนังสืออยู่
  'acknowledged', // ติ๊กทราบแทนตำแหน่งที่ถูกเวียน (รอบ 2)
] as const;
```

เพิ่มถัดจาก `SarabanEventKind`:

```ts
// ปลายทางของการเกษียน — forward: ส่งต่อ · close: ส่งคืนสารบรรณ (จบเรื่อง) · stay: คงไว้ที่เดิม
export const ANNOTATE_ROUTES = ['forward', 'close', 'stay'] as const;
export type AnnotateRouteKind = (typeof ANNOTATE_ROUTES)[number];

export type SarabanUnitRef = { unitId: string; unitName: string };

// รายละเอียดเฉพาะ event รอบ 2 — optional ทั้งหมดด้วยเหตุผลเดียวกับ changes: makeEvent ใส่เฉพาะ
// คีย์ที่มีค่า · ชื่อทุกตัวเก็บ ณ เวลาที่ทำ (สเปกแม่ข้อ 3) ไม่เปลี่ยนตามสมุดผู้รับทีหลัง
export type SarabanEventDetail = {
  onBehalfUnitId?: string; // annotated: ตำแหน่งที่สั่ง = holderUnitId ตอนบันทึก
  onBehalfName?: string;
  route?: AnnotateRouteKind;
  toUnitId?: string; // annotated + forward
  toUnitName?: string;
  circulateTo?: SarabanUnitRef[]; // annotated ที่มีการเวียน
  unitId?: string; // acknowledged
  unitName?: string;
};
```

เปลี่ยน `SarabanEvent` เป็น intersection:

```ts
export type SarabanEvent = {
  id: string;
  at: string; // ISO
  by: string; // clerkId หรือ 'dev-open'
  byName: string; // ชื่อ ณ เวลาที่ทำ — audit trail ต้องไม่ถูกแก้ย้อนหลังเมื่อเปลี่ยนชื่อ
  kind: SarabanEventKind;
  note: string; // '' = ไม่มี
  // optional โดยตั้งใจ ต่างจากช่องอื่นที่ใช้ '' — event ต่อท้ายอย่างเดียวและสร้างผ่าน
  // makeEvent() ที่ใส่คีย์นี้เฉพาะเมื่อมีค่า จึงไม่มีทางถูกเขียนเป็น null ลง Mongo
  changes?: SarabanFieldChange[]; // เฉพาะ edited
} & SarabanEventDetail;

// แจ้งเวียนภายใน (รอบ 2) — หนึ่งแถวต่อตำแหน่ง ตำแหน่งหนึ่งอยู่ในรายการได้ครั้งเดียว
export type SarabanCirculation = {
  unitId: string;
  unitName: string; // ณ เวลาที่เวียน
  sentAt: string; // ISO
  sentEventId: string; // event annotated ที่เวียน
  ackAt: string; // '' = ยังไม่ทราบ
  ackBy: string; // clerkId · '' ถ้ายังไม่ทราบ
  ackByName: string;
};
```

ใน `SarabanDoc` เพิ่มหลัง `events`:

```ts
  events: SarabanEvent[];
  circulation: SarabanCirculation[]; // รอบ 2 — หนังสือรอบ 1 ไม่มีคีย์นี้ อ่านผ่าน withDefaults
```

- [ ] **Step 4: แก้ `src/lib/saraban-doc.ts`**

import เพิ่ม `type SarabanEventDetail` จาก `@/types/saraban` แล้วแทน `makeEvent`:

```ts
export function makeEvent(args: {
  id: string;
  at: string;
  actor: Actor;
  kind: SarabanEventKind;
  note?: string;
  changes?: SarabanFieldChange[];
  detail?: SarabanEventDetail;
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
  // ใส่เฉพาะคีย์ที่มีค่า — คีย์ undefined ใน $push ของ Mongo กลายเป็น null ในเอกสาร
  for (const [key, value] of Object.entries(args.detail ?? {})) {
    if (value !== undefined) (event as Record<string, unknown>)[key] = value;
  }
  return event;
}
```

ใน `buildNewDoc` เพิ่มหลังบล็อก `events: [...]`:

```ts
    circulation: [],
```

เพิ่มถัดจาก `buildNewDoc`:

```ts
/**
 * หนังสือที่บันทึกก่อนรอบ 2 ไม่มีคีย์ circulation — เติม [] ตอนอ่าน ไม่ต้อง migrate
 * (สเปกรอบ 2 ข้อ 3) · store เรียกตัวนี้ทุกทางที่คืนหนังสือออกไป หน้าจอและ flow จึงเชื่อได้ว่ามีเสมอ
 * คืนตัวเดิมเมื่อมีแล้ว ไม่ copy ทิ้งทุกครั้ง
 */
export function withDefaults(doc: SarabanDoc): SarabanDoc {
  return Array.isArray(doc.circulation) ? doc : { ...doc, circulation: [] };
}
```

- [ ] **Step 5: เติมป้ายใน `src/lib/saraban-labels.ts`** (เทสต์ "ป้ายครบทุกค่า" เดิมจะบังคับ)

```ts
export const EVENT_KIND_LABELS: Record<SarabanEventKind, string> = {
  received: 'ลงรับหนังสือ',
  issued: 'ออกเลขหนังสือ',
  edited: 'แก้ไขข้อมูล',
  'file-added': 'แนบไฟล์',
  'file-removed': 'ลบไฟล์แนบ',
  sent: 'ส่งหนังสือแล้ว',
  voided: 'ยกเลิกเลขทะเบียน',
  annotated: 'เกษียน/สั่งการ',
  acknowledged: 'รับทราบ (แจ้งเวียน)',
};
```

- [ ] **Step 6: รันเทสต์และ tsc**

Run: `npx vitest run src/lib/saraban-doc.test.ts src/lib/saraban-labels.test.ts && npx tsc --noEmit`
Expected: PASS · tsc สะอาด (ถ้า tsc บ่นว่า fixture ใน `*.test.ts` อื่นขาด `circulation` ให้เติม
`circulation: []` ใน object literal นั้น — ห้ามทำ `circulation` เป็น optional)

- [ ] **Step 7: Commit**

```bash
git add src/types/saraban.ts src/lib/saraban-doc.ts src/lib/saraban-doc.test.ts src/lib/saraban-labels.ts
git commit -m "feat(saraban): ชนิดข้อมูลรอบ 2 — event เกษียน/ทราบ และรายการแจ้งเวียนบนหนังสือ"
```

---

### Task 2: state machine `saraban-flow.ts`

**Files:**
- Create: `src/lib/saraban-flow.ts`
- Test: `src/lib/saraban-flow.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** — สร้าง `src/lib/saraban-flow.test.ts`

```ts
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
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run src/lib/saraban-flow.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/saraban-flow"`

- [ ] **Step 3: เขียน `src/lib/saraban-flow.ts`**

```ts
// src/lib/saraban-flow.ts
// state machine ของการเกษียน/ส่งต่อ/แจ้งเวียน (สเปกรอบ 2 ข้อ 3) — client-safe บริสุทธิ์ แบบ job-status.ts
// หน้าจอใช้ canAnnotate/canAck/flowStep วาดปุ่มและแถบ · API ใช้ annotateTransition/ackTransition
// ตัดสินจริง หน้าจอกับเซิร์ฟเวอร์จึงเห็นตรงกัน · เวลา/eventId/ผู้ทำรับเป็นพารามิเตอร์ (เทสต์ส่งค่าคงที่ได้)
//
// ชื่อตำแหน่งทุกตัวอ่านจากสมุด (units) ที่ส่งเข้ามา ไม่เชื่อชื่อจาก client

import { isOpen, type Actor } from '@/lib/saraban-doc';
import type {
  AnnotateRouteKind,
  SarabanCirculation,
  SarabanDoc,
  SarabanEventDetail,
  SarabanStatus,
  SarabanUnit,
} from '@/types/saraban';

export const MAX_CIRCULATE = 30;

export type AnnotateRoute =
  | { kind: 'forward'; toUnitId: string }
  | { kind: 'close' }
  | { kind: 'stay' };

export type AnnotateInput = { note: string; route: AnnotateRoute; circulateTo: readonly string[] };

/** ช่องที่ flow เขียนได้ — route ส่งต่อให้ applyPatch ตรง ๆ */
export type FlowSet = Partial<Pick<SarabanDoc, 'status' | 'holderUnitId' | 'circulation'>>;

export type FlowOk = { ok: true; set: FlowSet; note: string; detail: SarabanEventDetail };
export type FlowError =
  | { ok: false; error: 'invalid_transition' }
  | { ok: false; error: 'invalid_unit'; unitId: string }
  | { ok: false; error: 'same_holder' }
  | { ok: false; error: 'already_circulated'; unitId: string }
  | { ok: false; error: 'not_circulated' }
  | { ok: false; error: 'already_acknowledged' };
export type FlowResult = FlowOk | FlowError;

// สเปกรอบ 2 ข้อ 6 — ทำผิดลำดับ/ทำซ้ำ = 409 (ข้อมูลถูกแต่สถานะไม่ให้) · ข้อมูลผิด = 400
export const FLOW_ERROR_STATUS: Record<FlowError['error'], 400 | 409> = {
  invalid_transition: 409,
  invalid_unit: 400,
  same_holder: 400,
  already_circulated: 400,
  not_circulated: 400,
  already_acknowledged: 409,
};

/** เกษียนได้เฉพาะหนังสือรับที่ยังเปิดอยู่ — ส่ง/เวียนยังใช้วงจร "รอส่ง → ส่งแล้ว" ของรอบ 1 */
export function canAnnotate(doc: Pick<SarabanDoc, 'register' | 'status'>): boolean {
  return doc.register === 'in' && isOpen(doc.status);
}

/** ติ๊กทราบได้ทุกสถานะยกเว้นยกเลิก — กระดาษเวียนกลับมาหลังจบเรื่องได้ (สเปกรอบ 2 ข้อ 1.5) */
export function canAck(doc: Pick<SarabanDoc, 'status'>): boolean {
  return doc.status !== 'void';
}

// stay บน pending ก็ได้ in-progress — มีคนสั่งการแล้ว เรื่องไม่ได้ "รอเกษียน" อีกต่อไป
function statusAfter(route: AnnotateRouteKind): SarabanStatus {
  return route === 'close' ? 'done' : 'in-progress';
}

export function annotateTransition(
  doc: SarabanDoc,
  input: AnnotateInput,
  units: readonly SarabanUnit[],
  stamp: { now: string; eventId: string }
): FlowResult {
  if (!canAnnotate(doc)) return { ok: false, error: 'invalid_transition' };
  const activeUnit = (id: string) => units.find((u) => u.id === id && u.isActive);
  const nameOf = (id: string) => units.find((u) => u.id === id)?.name ?? id;

  const set: FlowSet = { status: statusAfter(input.route.kind) };
  const detail: SarabanEventDetail = {
    onBehalfUnitId: doc.holderUnitId,
    onBehalfName: nameOf(doc.holderUnitId),
    route: input.route.kind,
  };

  if (input.route.kind === 'forward') {
    const to = activeUnit(input.route.toUnitId);
    if (!to) return { ok: false, error: 'invalid_unit', unitId: input.route.toUnitId };
    if (to.id === doc.holderUnitId) return { ok: false, error: 'same_holder' };
    set.holderUnitId = to.id;
    detail.toUnitId = to.id;
    detail.toUnitName = to.name;
  }

  if (input.circulateTo.length > 0) {
    const seen = new Set(doc.circulation.map((c) => c.unitId));
    const added: SarabanCirculation[] = [];
    for (const unitId of input.circulateTo) {
      if (seen.has(unitId)) return { ok: false, error: 'already_circulated', unitId };
      const target = activeUnit(unitId);
      if (!target) return { ok: false, error: 'invalid_unit', unitId };
      seen.add(unitId);
      added.push({
        unitId,
        unitName: target.name,
        sentAt: stamp.now,
        sentEventId: stamp.eventId,
        ackAt: '',
        ackBy: '',
        ackByName: '',
      });
    }
    set.circulation = [...doc.circulation, ...added];
    detail.circulateTo = added.map(({ unitId, unitName }) => ({ unitId, unitName }));
  }

  return { ok: true, set, note: input.note, detail };
}

export function ackTransition(
  doc: SarabanDoc,
  unitId: string,
  stamp: { now: string; actor: Actor }
): FlowResult {
  if (!canAck(doc)) return { ok: false, error: 'invalid_transition' };
  const row = doc.circulation.find((c) => c.unitId === unitId);
  if (!row) return { ok: false, error: 'not_circulated' };
  if (row.ackAt) return { ok: false, error: 'already_acknowledged' };
  const circulation = doc.circulation.map((c) =>
    c.unitId === unitId ? { ...c, ackAt: stamp.now, ackBy: stamp.actor.id, ackByName: stamp.actor.name } : c
  );
  return { ok: true, set: { circulation }, note: '', detail: { unitId, unitName: row.unitName } };
}

export type FlowStepNo = 1 | 2 | 3 | 4 | 5;

/**
 * ขั้นปัจจุบันของแถบ 5 ขั้น (ลงรับ → เสนอ/เกษียน → มอบหมาย → ดำเนินการ → จบเรื่อง) — คำนวณจาก
 * events ไม่เก็บ · นับเฉพาะ annotated ที่ route = forward การแก้ "เสนอถึง" ตอนรอเกษียนเป็นการแก้ที่
 * ลงรับผิด ไม่ใช่การส่งต่อ · null = ไม่แสดงแถบ (ส่ง/เวียน หรือยกเลิก)
 */
export function flowStep(doc: Pick<SarabanDoc, 'register' | 'status' | 'events'>): FlowStepNo | null {
  if (doc.register !== 'in' || doc.status === 'void') return null;
  if (doc.status === 'done') return 5;
  const forwards = doc.events.filter((e) => e.kind === 'annotated' && e.route === 'forward').length;
  return forwards === 0 ? 2 : forwards === 1 ? 3 : 4;
}
```

- [ ] **Step 4: รันเทสต์**

Run: `npx vitest run src/lib/saraban-flow.test.ts && npx tsc --noEmit`
Expected: PASS ทุกตัว · tsc สะอาด

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-flow.ts src/lib/saraban-flow.test.ts
git commit -m "feat(saraban): state machine เกษียน ส่งต่อ แจ้งเวียน และแถบ 5 ขั้น"
```

---

### Task 3: zod — action `annotate` / `ack` และ `scope=open`

**Files:**
- Modify: `src/lib/saraban-schema.ts`
- Test: `src/lib/saraban-schema.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** — เพิ่มใน `describe('docPatchSchema — แยกตาม action', …)`

```ts
  it('annotate: ข้อความบังคับ · route สามแบบ · circulateTo ค่าเริ่มต้น []', () => {
    const base = { action: 'annotate', updatedAt: 't', note: ' ทราบ ' };
    expect(docPatchSchema.parse({ ...base, route: { kind: 'stay' } })).toEqual({
      action: 'annotate',
      updatedAt: 't',
      note: 'ทราบ',
      route: { kind: 'stay' },
      circulateTo: [],
    });
    expect(docPatchSchema.safeParse({ ...base, route: { kind: 'close' } }).success).toBe(true);
    expect(docPatchSchema.safeParse({ ...base, route: { kind: 'forward', toUnitId: 'dir-works' } }).success).toBe(true);
    expect(docPatchSchema.safeParse({ ...base, route: { kind: 'forward' } }).success).toBe(false);
    expect(docPatchSchema.safeParse({ ...base, route: { kind: 'teleport' } }).success).toBe(false);
    expect(docPatchSchema.safeParse({ ...base, note: '  ', route: { kind: 'stay' } }).success).toBe(false);
    expect(docPatchSchema.safeParse({ ...base, note: 'ก'.repeat(1001), route: { kind: 'stay' } }).success).toBe(false);
  });

  it('annotate: เวียนได้ไม่เกิน 30 ตำแหน่ง', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
    const body = (n: number) => ({ action: 'annotate', updatedAt: 't', note: 'ทราบ', route: { kind: 'stay' }, circulateTo: ids(n) });
    expect(docPatchSchema.safeParse(body(30)).success).toBe(true);
    expect(docPatchSchema.safeParse(body(31)).success).toBe(false);
  });

  it('ack ต้องมี unitId', () => {
    expect(docPatchSchema.safeParse({ action: 'ack', updatedAt: 't', unitId: 'finance' }).success).toBe(true);
    expect(docPatchSchema.safeParse({ action: 'ack', updatedAt: 't', unitId: '' }).success).toBe(false);
  });
```

และเพิ่ม `it` นี้ใน `describe('docListQuerySchema — ค่าจาก query string เป็นสตริงทั้งหมด', …)` ที่มีอยู่:

```ts
  it('scope=open ผ่าน · ค่าอื่นไม่ผ่าน · ไม่ใส่ = undefined', () => {
    expect(docListQuerySchema.parse({ register: 'in', scope: 'open' }).scope).toBe('open');
    expect(docListQuerySchema.parse({ register: 'in' }).scope).toBeUndefined();
    expect(docListQuerySchema.safeParse({ register: 'in', scope: 'all' }).success).toBe(false);
  });
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run src/lib/saraban-schema.test.ts`
Expected: FAIL — action `annotate` ไม่อยู่ใน union · `scope` ถูกทิ้ง

- [ ] **Step 3: แก้ `src/lib/saraban-schema.ts`**

import เพิ่ม:

```ts
import { MAX_CIRCULATE } from '@/lib/saraban-flow';
```

เหนือ `docPatchSchema` เพิ่ม:

```ts
// ปลายทางของการเกษียน (สเปกรอบ 2 ข้อ 4) — ชื่อตำแหน่งเซิร์ฟเวอร์เติมจากสมุดเอง ไม่รับจากตรงนี้
const annotateRouteSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('forward'), toUnitId: z.string().min(1).max(100) }),
  z.object({ kind: z.literal('close') }),
  z.object({ kind: z.literal('stay') }),
]);
```

ต่อท้าย array ของ `docPatchSchema`:

```ts
  z.object({
    action: z.literal('annotate'),
    updatedAt: z.string().min(1),
    note: requiredText(1000, 'ต้องมีข้อความเกษียน'),
    route: annotateRouteSchema,
    circulateTo: z
      .array(z.string().min(1).max(100))
      .max(MAX_CIRCULATE, `เวียนได้ไม่เกิน ${MAX_CIRCULATE} ตำแหน่งต่อครั้ง`)
      .default([]),
  }),
  z.object({ action: z.literal('ack'), updatedAt: z.string().min(1), unitId: z.string().min(1).max(100) }),
```

ใน `docListQuerySchema` เพิ่ม:

```ts
  // open = หนังสือที่ยังเปิดอยู่ทุกปีงบ (รายการซ้ายของหน้าติดตาม) — ไม่สน year/view
  scope: z.enum(['open']).optional(),
```

แก้คอมเมนต์บรรทัดแรกของไฟล์จาก "รอบ 1" เป็น "รอบ 1–2"

- [ ] **Step 4: รันเทสต์**

Run: `npx vitest run src/lib/saraban-schema.test.ts && npx tsc --noEmit`
Expected: PASS · tsc สะอาด (ไม่มี import วน: `saraban-flow` import แค่ `saraban-doc` ซึ่งไม่ import schema)

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-schema.ts src/lib/saraban-schema.test.ts
git commit -m "feat(saraban): schema ของการเกษียน ติ๊กทราบ และรายการหนังสือที่ยังเปิด"
```

---

### Task 4: store เติมค่าเริ่มต้น · route ทะเบียนรับ `scope=open` · ข้อความ error

**Files:**
- Modify: `src/lib/saraban-store.ts`
- Modify: `src/pages/api/admin/saraban/docs/index.ts:46-75`
- Modify: `src/lib/saraban-view.ts` (`ERROR_MESSAGES`, `docsKey`)
- Test: `src/lib/saraban-view.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** — ใน `src/lib/saraban-view.test.ts` (import `docsKey`, `errorMessage` ถ้ายังไม่มี)

```ts
describe('รอบ 2 — docsKey scope และข้อความ error', () => {
  it('scope=open อยู่ใน key', () => {
    expect(docsKey({ register: 'in', scope: 'open' })).toBe('/api/admin/saraban/docs?register=in&scope=open');
  });

  it('รหัสใหม่มีข้อความไทย', () => {
    for (const code of ['same_holder', 'already_circulated', 'not_circulated', 'already_acknowledged']) {
      expect(errorMessage(code)).not.toBe('เกิดข้อผิดพลาด ลองอีกครั้ง');
    }
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run src/lib/saraban-view.test.ts`
Expected: FAIL

- [ ] **Step 3: แก้ `src/lib/saraban-view.ts`**

ใน `ERROR_MESSAGES` เพิ่ม:

```ts
  same_holder: 'หนังสืออยู่กับตำแหน่งนี้อยู่แล้ว เลือกปลายทางอื่น',
  already_circulated: 'มีตำแหน่งที่เวียนถึงแล้ว เอาออกจากรายการแล้วบันทึกอีกครั้ง',
  not_circulated: 'ตำแหน่งนี้ไม่ได้อยู่ในรายการแจ้งเวียน',
  already_acknowledged: 'ตำแหน่งนี้ทราบแล้ว',
```

แก้ `stale` ให้ใช้ได้ทั้งการแก้และการเกษียน:

```ts
  stale: 'มีคนบันทึกหนังสือนี้ไปก่อน โหลดใหม่แล้ว ลองอีกครั้ง',
```

แก้ `docsKey`:

```ts
export function docsKey(q: {
  register: SarabanRegister;
  year?: number;
  view?: RegisterView;
  page?: number;
  scope?: 'open';
}): string {
  const p = new URLSearchParams({ register: q.register });
  if (q.year) p.set('year', String(q.year));
  if (q.view && q.view !== 'all') p.set('view', q.view);
  if (q.page && q.page > 1) p.set('page', String(q.page));
  if (q.scope) p.set('scope', q.scope);
  return `/api/admin/saraban/docs?${p}`;
}
```

- [ ] **Step 4: แก้ `src/lib/saraban-store.ts`**

import `withDefaults` จาก `@/lib/saraban-doc` แล้ว:

1. `DocSet` รวมช่องของ flow:

```ts
/** ช่องที่ applyPatch เขียนได้ — ผลของ buildEdit() · Transition.set · FlowSet (saraban-flow.ts) เท่านั้น */
export type DocSet = Partial<
  Pick<SarabanDoc, EditableField | 'status' | 'voidReason' | 'sendMethod' | 'circulation'>
>;
```

2. `getDoc`:

```ts
export async function getDoc(id: string): Promise<SarabanDoc | null> {
  const doc = isMongoConfigured()
    ? await (await docsCollection()).findOne({ id }, { projection: { _id: 0 } })
    : ((await readDocs()).find((d) => d.id === id) ?? null);
  return doc && withDefaults(doc);
}
```

3. `listDocs`: ฝั่ง Mongo `return { docs: docs.map(withDefaults), total };` · ฝั่งไฟล์
   `return { docs: all.slice(skip, skip + PAGE_SIZE).map(withDefaults), total: all.length };`

4. `applyPatch` · `addFile` · `removeFile`: ฝั่ง Mongo ห่อผล

```ts
    const updated = await (await docsCollection()).findOneAndUpdate(/* …เดิม… */);
    return updated && withDefaults(updated);
```

   ฝั่งไฟล์ `return withDefaults(docs[index]);` — ใน `applyPatch` ฝั่งไฟล์ ให้ประกอบจาก
   `withDefaults(docs[index])` ก่อน spread `set` เพื่อให้ไฟล์ที่เขียนกลับมี `circulation` เสมอ:

```ts
  const current = withDefaults(docs[index]);
  docs[index] = { ...current, ...set, updatedAt: event.at, events: [...current.events, event] };
  await writeJsonArray(DOCS_FILE, docs);
  return docs[index];
```

- [ ] **Step 5: แก้ `list()` ใน `src/pages/api/admin/saraban/docs/index.ts`**

```ts
    const { register, view, page, scope } = parsed.data;
    const today = bangkokDateOf(new Date());
    const currentYear = fiscalYearOf(today);
    const fiscalYear = parsed.data.year ?? currentYear;
    // scope=open: หนังสือที่ยังเปิดอยู่ทุกปีงบ (รายการซ้ายของหน้าติดตาม สเปกรอบ 2 ข้อ 5)
    const filter = scope === 'open' ? { register, statusIn: OPEN_STATUSES } : { register, fiscalYear, view };
    const [result, counts, years, carryOver] = await Promise.all([
      listDocs(filter, page, today),
      registerCounts(register, fiscalYear, today),
      listFiscalYears(register, currentYear),
      countDocs({ register, beforeFiscalYear: fiscalYear, statusIn: OPEN_STATUSES }, today),
    ]);
```

- [ ] **Step 6: รันทั้งชุด**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS ทั้งหมด (584 + เทสต์ใหม่ของงาน 1–4) · tsc สะอาด

- [ ] **Step 7: Commit**

```bash
git add src/lib/saraban-store.ts src/lib/saraban-view.ts src/lib/saraban-view.test.ts src/pages/api/admin/saraban/docs/index.ts
git commit -m "feat(saraban): store เติมรายการเวียนให้หนังสือเก่า และทะเบียนรับแบบเฉพาะเรื่องที่ยังเปิด"
```

---

### Task 5: PATCH route รับ `annotate` / `ack`

**Files:**
- Modify: `src/pages/api/admin/saraban/docs/[id]/index.ts`

ไม่มีเทสต์หน่วยของ route (repo ไม่เทสต์ route) — ตรรกะทั้งหมดอยู่ใน `saraban-flow.ts` ที่เทสต์แล้ว
`api-guard-coverage.test.ts` ยังผ่านเพราะ guard ไม่เปลี่ยน

- [ ] **Step 1: แก้ import**

```ts
import { ackTransition, annotateTransition, FLOW_ERROR_STATUS } from '@/lib/saraban-flow';
import type { SarabanEventDetail, SarabanEventKind, SarabanFieldChange } from '@/types/saraban';
```

และแก้คอมเมนต์หัวไฟล์:

```ts
// PATCH /api/admin/saraban/docs/[id]  body { action: 'edit' | 'void' | 'sent' | 'annotate' | 'ack', updatedAt, … }
```

- [ ] **Step 2: แทนช่วงตั้งแต่ `let set: DocSet;` จนถึงก่อน `const updated = await applyPatch(…)`**

```ts
    // เวลากับ eventId สร้างครั้งเดียว — flow ใช้เป็น sentAt/sentEventId ของรายการเวียน และ
    // applyPatch ใช้ event.at เป็น updatedAt ใหม่ ทั้งสามต้องตรงกัน
    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();
    const actor = await resolveActor(admin);

    let set: DocSet;
    let kind: SarabanEventKind;
    let note = '';
    let changes: SarabanFieldChange[] | undefined;
    let detail: SarabanEventDetail | undefined;

    if (patch.action === 'edit') {
      const result = buildEdit(current, patch.edit);
      if (!result.ok) return res.status(409).json({ error: 'field_locked', field: result.field });
      // ไม่มีอะไรเปลี่ยน → คืนเรื่องเดิม ไม่ต่อ event "แก้ไขข้อมูล" เปล่า ๆ (handoff ของแผน 1A)
      if (result.changes.length === 0) return res.status(200).json(current);
      const units = await listUnits();
      if (result.set.holderUnitId !== undefined) {
        const target = units.find((u) => u.id === result.set.holderUnitId);
        if (!target?.isActive) return res.status(400).json({ error: 'invalid_unit' });
      }
      const nameOf = (unitId: string) => units.find((u) => u.id === unitId)?.name ?? unitId;
      set = result.set;
      kind = 'edited';
      changes = nameUnitChanges(result.changes, nameOf);
    } else if (patch.action === 'annotate' || patch.action === 'ack') {
      const result =
        patch.action === 'annotate'
          ? annotateTransition(current, patch, await listUnits(), { now, eventId })
          : ackTransition(current, patch.unitId, { now, actor });
      if (!result.ok) {
        const { ok: _ok, ...body } = result;
        return res.status(FLOW_ERROR_STATUS[result.error]).json(
          result.error === 'invalid_transition' ? { ...body, action: patch.action, status: current.status } : body
        );
      }
      set = result.set;
      kind = patch.action === 'annotate' ? 'annotated' : 'acknowledged';
      note = result.note;
      detail = result.detail;
    } else {
      const transition =
        patch.action === 'void'
          ? voidTransition(current, patch.reason)
          : sentTransition(current, patch.method);
      if (!transition) {
        return res.status(409).json({ error: 'invalid_transition', action: patch.action, status: current.status });
      }
      ({ set, kind, note } = transition);
    }

    const event = makeEvent({ id: eventId, at: now, actor, kind, note, changes, detail });
```

(ลบ `const event = makeEvent({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: await resolveActor(admin), … })` ตัวเดิม)

- [ ] **Step 3: ตรวจ**

Run: `npx tsc --noEmit && npx vitest run src/lib/api-guard-coverage.test.ts && npm run lint`
Expected: สะอาด · PASS

- [ ] **Step 4: smoke ด้วย dev (แบ็กเอนด์ไฟล์ — ไม่มี MONGODB_URI)**

```bash
MONGODB_URI= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= npx next dev -p 3100
```

อีกเทอร์มินัล (dev-open mode ไม่ต้องล็อกอิน):

```bash
ID=$(node -e 'console.log(crypto.randomUUID())')
curl -s -X POST 'localhost:3100/api/admin/saraban/docs?kind=receive' -H 'content-type: application/json' \
  -d "{\"id\":\"$ID\",\"ref\":\"ทดสอบ 1\",\"docDate\":\"2026-11-01\",\"party\":\"อำเภอ\",\"subject\":\"ทดสอบเกษียน\",\"holderUnitId\":\"palad\"}" | head -c 200; echo
U=$(curl -s localhost:3100/api/admin/saraban/docs/$ID | node -pe 'JSON.parse(require("fs").readFileSync(0)).updatedAt')
curl -s -X PATCH localhost:3100/api/admin/saraban/docs/$ID -H 'content-type: application/json' \
  -d "{\"action\":\"annotate\",\"updatedAt\":\"$U\",\"note\":\"ทราบ มอบกองช่าง\",\"route\":{\"kind\":\"forward\",\"toUnitId\":\"dir-works\"},\"circulateTo\":[\"finance\"]}" \
  | node -pe 'const d=JSON.parse(require("fs").readFileSync(0)); [d.status,d.holderUnitId,d.circulation.length,d.events.at(-1).kind].join(" ")'
```

Expected: `in-progress dir-works 1 annotated` · ส่ง PATCH เดิมซ้ำด้วย `updatedAt` เก่าได้ `{"error":"stale"}`
แล้วหยุด dev server · ลบหนังสือทดสอบออกจาก `data/saraban-docs.json` (ไฟล์ gitignore — เช็คด้วย
`git status` ว่าไม่โผล่)

- [ ] **Step 5: Commit**

```bash
git add "src/pages/api/admin/saraban/docs/[id]/index.ts"
git commit -m "feat(saraban): API เกษียน ส่งต่อ แจ้งเวียน และติ๊กทราบแทน"
```

---

### Task 6: ตัวเรียก API ฝั่งเบราว์เซอร์ + ป้ายของ flow

**Files:**
- Modify: `src/lib/saraban-api.ts`
- Modify: `src/lib/saraban-labels.ts`
- Test: `src/lib/saraban-labels.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** — ใน `src/lib/saraban-labels.test.ts` (เพิ่ม import `FLOW_STEP_LABELS`, `QUICK_NOTES`, `ROUTE_LABELS` และ `ANNOTATE_ROUTES` จาก types)

```ts
describe('ป้ายของรอบ 2', () => {
  it('แถบ 5 ขั้นตามต้นแบบ', () => {
    expect(FLOW_STEP_LABELS).toEqual(['ลงรับ', 'เสนอ/เกษียน', 'มอบหมาย', 'ดำเนินการ', 'จบเรื่อง']);
  });

  it('ปลายทางครบทุกแบบ · ข้อความสำเร็จรูปไม่ว่าง', () => {
    for (const r of ANNOTATE_ROUTES) expect(ROUTE_LABELS[r]).toBeTruthy();
    expect(QUICK_NOTES.length).toBeGreaterThan(0);
    for (const n of QUICK_NOTES) expect(n.trim()).toBe(n);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run src/lib/saraban-labels.test.ts`
Expected: FAIL — export ไม่มี

- [ ] **Step 3: เพิ่มใน `src/lib/saraban-labels.ts`** (import `AnnotateRouteKind` จาก types)

```ts
// แถบ 5 ขั้นของหน้าติดตาม (ต้นแบบจอ 6) — ลำดับตรงกับ flowStep() ใน saraban-flow.ts (ขั้น 1 = index 0)
export const FLOW_STEP_LABELS = ['ลงรับ', 'เสนอ/เกษียน', 'มอบหมาย', 'ดำเนินการ', 'จบเรื่อง'] as const;

export const ROUTE_LABELS: Record<AnnotateRouteKind, string> = {
  forward: 'ส่งต่อ',
  close: 'ส่งคืนสารบรรณ (จบเรื่อง)',
  stay: 'คงไว้ที่เดิม',
};

// ชิปข้อความสำเร็จรูปของฟอร์มเกษียน — ค่าคงที่ไปก่อน ยังไม่มีหน้าตั้งค่า (สเปกรอบ 2 ข้อ 1.8)
export const QUICK_NOTES = [
  'ทราบ',
  'ทราบ มอบดำเนินการ',
  'เพื่อโปรดพิจารณา',
  'ทราบ แจ้งเวียนให้ทราบ',
  'ทราบ เก็บเข้าแฟ้ม',
] as const;
```

- [ ] **Step 4: เพิ่มใน `src/lib/saraban-api.ts`**

```ts
import type { AnnotateRoute } from '@/lib/saraban-flow';
```

ถัดจาก `patchDoc`:

```ts
export function annotateDoc(
  doc: Pick<SarabanDoc, 'id' | 'updatedAt'>,
  body: { note: string; route: AnnotateRoute; circulateTo: string[] }
): Promise<SarabanDoc> {
  return patchDoc(doc.id, { action: 'annotate', updatedAt: doc.updatedAt, ...body });
}

export function ackCirculation(doc: Pick<SarabanDoc, 'id' | 'updatedAt'>, unitId: string): Promise<SarabanDoc> {
  return patchDoc(doc.id, { action: 'ack', updatedAt: doc.updatedAt, unitId });
}
```

- [ ] **Step 5: รันเทสต์**

Run: `npx vitest run src/lib/saraban-labels.test.ts && npx tsc --noEmit`
Expected: PASS · สะอาด

- [ ] **Step 6: Commit**

```bash
git add src/lib/saraban-api.ts src/lib/saraban-labels.ts src/lib/saraban-labels.test.ts
git commit -m "feat(saraban): ตัวเรียก API เกษียน/ทราบ และป้ายแถบ 5 ขั้น"
```

---

### Task 7: component — FlowSteps · EventDetail · CirculationCard

**Files:**
- Create: `src/components/saraban/FlowSteps.tsx`
- Create: `src/components/saraban/EventDetail.tsx`
- Create: `src/components/saraban/CirculationCard.tsx`

- [ ] **Step 1: `src/components/saraban/FlowSteps.tsx`**

```tsx
// แถบ 5 ขั้นของหน้าติดตาม (ต้นแบบจอ 6) — ขั้นมาจาก flowStep() · ผ่านแล้วเขียว · ปัจจุบัน accent
// หรือแดงถ้าเกินกำหนด · ที่เหลือ #E3E8EF
import { FLOW_STEP_LABELS } from '@/lib/saraban-labels';
import type { FlowStepNo } from '@/lib/saraban-flow';

export default function FlowSteps({ step, overdue }: { step: FlowStepNo; overdue: boolean }) {
  return (
    <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="ขั้นของหนังสือ">
      {FLOW_STEP_LABELS.map((label, i) => {
        const n = i + 1;
        // ขั้น 5 คือจบเรื่องแล้ว — ถือว่าผ่าน ไม่ใช่ "กำลังทำ"
        const done = n < step || step === 5;
        const current = n === step && step !== 5;
        const bar = done ? 'bg-sb-success' : current ? (overdue ? 'bg-sb-danger' : 'bg-sb-accent') : 'bg-[#E3E8EF]';
        const text = done ? 'text-sb-success' : current ? (overdue ? 'text-sb-danger' : 'text-sb-accent') : 'text-sb-muted';
        return (
          <li key={label} aria-current={current ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full ${bar}`} />
            <p className={`mt-1.5 text-center text-[11px] leading-tight ${current ? 'font-semibold' : ''} ${text}`}>{label}</p>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: `src/components/saraban/EventDetail.tsx`**

```tsx
// บรรทัดรายละเอียดของ event รอบ 2 บนไทม์ไลน์ (หน้าติดตามและหน้าเกษียนใช้ร่วม) — แสดงจากชื่อที่เก็บ
// ใน event ณ เวลาที่ทำ ไม่ค้นสมุดใหม่ (สเปกแม่ข้อ 3)
import type { SarabanEvent } from '@/types/saraban';

export default function EventDetail({ event }: { event: SarabanEvent }) {
  if (event.kind === 'acknowledged') {
    return <p className="mt-0.5 text-[13px]">{event.unitName} ทราบแล้ว</p>;
  }
  if (event.kind !== 'annotated') return null;
  return (
    <div className="mt-1 flex flex-col gap-0.5 text-[13px]">
      {event.route === 'forward' ? <p className="font-medium text-sb-accent">→ ส่งต่อ {event.toUnitName}</p> : null}
      {event.route === 'close' ? <p className="font-medium text-sb-success">→ ส่งคืนสารบรรณ (จบเรื่อง)</p> : null}
      {event.circulateTo?.length ? (
        <p className="text-sb-warning-ink">เวียนให้ทราบ: {event.circulateTo.map((c) => c.unitName).join(' · ')}</p>
      ) : null}
    </div>
  );
}

/** หัวบรรทัดผู้ทำ — เกษียนแสดง "ตำแหน่ง · บันทึกโดย ชื่อ" เพราะธุรการบันทึกแทน (สเปกรอบ 2 ข้อ 1.1) */
export function eventByline(event: SarabanEvent): string {
  return event.kind === 'annotated' && event.onBehalfName
    ? `${event.onBehalfName} · บันทึกโดย ${event.byName}`
    : event.byName;
}
```

- [ ] **Step 3: `src/components/saraban/CirculationCard.tsx`**

```tsx
// การ์ดแจ้งเวียนของหน้าติดตาม — ธุรการติ๊ก "ทราบ" แทนเมื่อกระดาษเวียนกลับมาครบลายเซ็น (สเปกรอบ 2 ข้อ 1.2)
import Icon from '@/components/Icon';
import { card } from '@/components/saraban/bits';
import { canAck } from '@/lib/saraban-flow';
import { thaiDateTime } from '@/lib/saraban-view';
import type { SarabanDoc } from '@/types/saraban';

export default function CirculationCard({
  doc,
  busy,
  onAck,
}: {
  doc: SarabanDoc;
  busy: boolean;
  onAck: (unitId: string) => void;
}) {
  if (doc.circulation.length === 0) return null;
  const acked = doc.circulation.filter((c) => c.ackAt).length;
  const ackable = canAck(doc);
  return (
    <section className={`${card} p-[22px]`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-semibold">
          <Icon name="campaign" size={18} />
          แจ้งเวียนภายใน
        </h3>
        <span className="text-[13px] text-sb-muted">
          ทราบแล้ว {acked}/{doc.circulation.length}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {doc.circulation.map((c) => (
          <li key={c.unitId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-sb-line px-3 py-2 text-[13px]">
            <span className="min-w-0 flex-1 font-medium">{c.unitName}</span>
            <span className="text-xs text-sb-muted">เวียน {thaiDateTime(c.sentAt)}</span>
            {c.ackAt ? (
              <span className="inline-flex items-center gap-1 text-xs text-sb-success">
                <Icon name="check_circle" size={16} />
                ทราบ {thaiDateTime(c.ackAt)} · {c.ackByName}
              </span>
            ) : ackable ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onAck(c.unitId)}
                className="rounded-lg border border-sb-success px-2.5 py-1 text-xs font-medium text-sb-success hover:bg-sb-success-bg disabled:opacity-60"
              >
                ทราบ
              </button>
            ) : (
              <span className="text-xs text-sb-muted">ยังไม่ทราบ</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: ตรวจ**

Run: `npx tsc --noEmit && npm run lint`
Expected: สะอาด (โทเคน `sb-accent-light` · `sb-success-bg` · `sb-warning-ink` มีใน `globals.css` แล้ว)

- [ ] **Step 5: Commit**

```bash
git add src/components/saraban/FlowSteps.tsx src/components/saraban/EventDetail.tsx src/components/saraban/CirculationCard.tsx
git commit -m "feat(saraban): แถบ 5 ขั้น การ์ดแจ้งเวียน และรายละเอียดเกษียนบนไทม์ไลน์"
```

---

### Task 8: ฟอร์มเกษียน `AnnotateForm`

**Files:**
- Create: `src/components/saraban/AnnotateForm.tsx`

- [ ] **Step 1: เขียน component**

```tsx
// ฟอร์มบันทึกเกษียน/สั่งการ (ต้นแบบจอ 5 ด้านขวา) — ธุรการพิมพ์คำสั่งในนามตำแหน่งที่หนังสืออยู่
// ตัดสินจริงที่ annotateTransition ฝั่งเซิร์ฟเวอร์ ฟอร์มนี้แค่ไม่ให้เลือกสิ่งที่รู้ว่าผิดแน่
// (ปลายทาง = ที่อยู่ปัจจุบัน · ตำแหน่งที่เวียนไปแล้ว)
import { useState, type FormEvent } from 'react';
import Icon from '@/components/Icon';
import { Field, inputClass, outlineButton, primaryButton } from '@/components/saraban/bits';
import type { AnnotateRoute } from '@/lib/saraban-flow';
import { QUICK_NOTES, ROUTE_LABELS } from '@/lib/saraban-labels';
import type { SarabanDoc, SarabanUnit } from '@/types/saraban';

export type AnnotateSubmit = { note: string; route: AnnotateRoute; circulateTo: string[] };

const STAY = '__stay';
const CLOSE = '__close';

export default function AnnotateForm({
  doc,
  units,
  busy,
  note,
  onNoteChange,
  onSubmit,
}: {
  doc: SarabanDoc;
  units: SarabanUnit[]; // active เรียงตาม order แล้ว
  busy: boolean;
  // ข้อความยกขึ้นไปเก็บที่หน้า — 409 stale แล้ว refetch ข้อความที่พิมพ์ไว้ต้องไม่หาย (สเปกรอบ 2 ข้อ 6)
  note: string;
  onNoteChange: (note: string) => void;
  onSubmit: (body: AnnotateSubmit) => void;
}) {
  const [target, setTarget] = useState<string>(STAY);
  const [circulating, setCirculating] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const already = new Set(doc.circulation.map((c) => c.unitId));
  const choosable = units.filter((u) => !already.has(u.id));
  const targets = units.filter((u) => u.id !== doc.holderUnitId);
  const circulateTo = circulating ? [...picked] : [];
  const route: AnnotateRoute =
    target === STAY ? { kind: 'stay' } : target === CLOSE ? { kind: 'close' } : { kind: 'forward', toUnitId: target };
  const targetName = units.find((u) => u.id === target)?.name;

  const summary = [
    route.kind === 'forward' ? `หนังสือจะไปอยู่ที่ ${targetName}` : null,
    route.kind === 'close' ? 'จะจบเรื่องและส่งคืนสารบรรณ — เปิดกลับไม่ได้' : null,
    route.kind === 'stay' ? 'หนังสือยังอยู่ที่เดิม' : null,
    circulateTo.length ? `เวียนให้ทราบ ${circulateTo.length} ตำแหน่ง` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const submitLabel = route.kind === 'forward' ? 'บันทึกและส่งต่อ' : route.kind === 'close' ? 'บันทึกและจบเรื่อง' : 'บันทึก';
  const blocked = busy || !note.trim() || (circulating && picked.size === 0);

  function togglePick(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (blocked) return;
    if (route.kind === 'close' && !confirm('จบเรื่องแล้วเปิดกลับไม่ได้ ยืนยันจบเรื่อง?')) return;
    onSubmit({ note: note.trim(), route, circulateTo });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_NOTES.map((q) => (
          <button
            key={q}
            type="button"
            className="rounded-full border border-sb-line bg-white px-3 py-1 text-xs hover:bg-sb-hover"
            onClick={() => onNoteChange(note.trim() ? `${note.trim()} ${q}` : q)}
          >
            {q}
          </button>
        ))}
      </div>
      <Field label="ข้อความเกษียน/สั่งการ" required>
        <textarea className={inputClass} rows={3} maxLength={1000} value={note} onChange={(e) => onNoteChange(e.target.value)} />
      </Field>
      <Field label="ส่งต่อถึง">
        <select className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value={STAY}>{ROUTE_LABELS.stay}</option>
          {targets.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
          <option value={CLOSE}>{ROUTE_LABELS.close}</option>
        </select>
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={circulating} onChange={(e) => setCirculating(e.target.checked)} />
        แจ้งเวียนให้ตำแหน่งอื่นทราบ
      </label>
      {circulating ? (
        <div className="rounded-[10px] border border-sb-line bg-[#FAFBFD] p-3">
          <div className="mb-2 flex gap-3 text-xs">
            <button type="button" className="text-sb-accent hover:underline" onClick={() => setPicked(new Set(choosable.map((u) => u.id)))}>
              เลือกทั้งหมด
            </button>
            <button type="button" className="text-sb-muted hover:underline" onClick={() => setPicked(new Set())}>
              ล้าง
            </button>
          </div>
          <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
            {units.map((u) => {
              const sent = already.has(u.id);
              return (
                <label key={u.id} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] ${sent ? 'text-sb-muted' : 'hover:bg-white'}`}>
                  <input type="checkbox" disabled={sent} checked={sent || picked.has(u.id)} onChange={() => togglePick(u.id)} className="mt-0.5" />
                  <span>
                    {u.name}
                    <span className="block text-[11px] text-sb-muted">{sent ? 'เวียนแล้ว' : u.dept}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      <p className="rounded-[10px] bg-sb-panel px-3 py-2 text-[13px]">{summary}</p>
      <div className="flex justify-end gap-2.5">
        <button type="reset" className={outlineButton} disabled={busy} onClick={() => { onNoteChange(''); setTarget(STAY); setCirculating(false); setPicked(new Set()); }}>
          ล้างฟอร์ม
        </button>
        <button type="submit" className={primaryButton} disabled={blocked}>
          <Icon name={route.kind === 'forward' ? 'arrow_forward' : 'check'} size={18} />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: ตรวจ**

Run: `npx tsc --noEmit && npm run lint`
Expected: สะอาด

- [ ] **Step 3: Commit**

```bash
git add src/components/saraban/AnnotateForm.tsx
git commit -m "feat(saraban): ฟอร์มเกษียน ส่งต่อ และเลือกตำแหน่งแจ้งเวียน"
```

---

### Task 9: หน้าเกษียน `/saraban/annotate/[id]`

**Files:**
- Create: `src/pages/saraban/annotate/[id].tsx`

- [ ] **Step 1: เขียนหน้า**

```tsx
// หน้าเกษียน (สเปกรอบ 2 ข้อ 5 · ต้นแบบจอ 5) — ซ้าย "เอกสาร": ตัวอย่างไฟล์แนบจากลิงก์ชั่วคราว
// (รอบ 4 วางปากกา/ตราที่ช่องนี้) · ขวา: ประวัติเกษียน + ฟอร์มสั่งการ
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import SarabanLayout from '@/components/saraban/SarabanLayout';
import AnnotateForm, { type AnnotateSubmit } from '@/components/saraban/AnnotateForm';
import EventDetail, { eventByline } from '@/components/saraban/EventDetail';
import { ErrorBox, StatusPill, card } from '@/components/saraban/bits';
import { showToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import {
  annotateDoc,
  docKey,
  fileUrl,
  messageOf,
  sarabanFetcher,
  SarabanApiError,
  SUMMARY_KEY,
  UNITS_KEY,
  type SummaryResponse,
} from '@/lib/saraban-api';
import { displayStatus } from '@/lib/saraban-doc';
import { canAnnotate } from '@/lib/saraban-flow';
import { formatNo } from '@/lib/saraban-number';
import { thaiDateTime } from '@/lib/saraban-view';
import type { SarabanDoc, SarabanUnit } from '@/types/saraban';

function AnnotatePage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { data: doc, error, mutate } = useSWR<SarabanDoc>(id ? docKey(id) : null, sarabanFetcher);
  const { data: units } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  const { data: summary } = useSWR<SummaryResponse>(SUMMARY_KEY, sarabanFetcher);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [fileId, setFileId] = useState<string | null>(null);

  if (error) {
    return (
      <SarabanLayout title="เกษียนหนังสือ">
        <ErrorBox>{messageOf(error)}</ErrorBox>
      </SarabanLayout>
    );
  }
  if (!doc) {
    return (
      <SarabanLayout title="เกษียนหนังสือ">
        <p className="text-[13px] text-sb-muted">กำลังโหลด…</p>
      </SarabanLayout>
    );
  }

  // GET /units คืนตามลำดับที่ตั้งแล้ว (listUnits เรียงด้วย byUnitOrder ฝั่งเซิร์ฟเวอร์)
  const active = (units ?? []).filter((u) => u.isActive);
  const holderName = units?.find((u) => u.id === doc.holderUnitId)?.name ?? doc.holderUnitId;
  const status = summary?.today ? displayStatus(doc, summary.today) : doc.status;
  const annotations = doc.events.filter((e) => e.kind === 'annotated');
  const file = doc.files.find((f) => f.id === fileId) ?? doc.files[0];

  async function submit(body: AnnotateSubmit) {
    if (!doc) return;
    setBusy(true);
    try {
      const updated = await annotateDoc(doc, body);
      setNote('');
      const no = formatNo(doc.register, doc.no);
      if (body.route.kind === 'stay') {
        await mutate(updated, { revalidate: false });
        showToast(`บันทึกเกษียนรับที่ ${no} แล้ว`);
      } else {
        const toName = active.find((u) => body.route.kind === 'forward' && u.id === body.route.toUnitId)?.name;
        showToast(body.route.kind === 'forward' ? `รับที่ ${no} ส่งต่อ ${toName} แล้ว` : `รับที่ ${no} จบเรื่องแล้ว`);
        await router.push('/saraban/inbox');
      }
    } catch (err) {
      showToast(messageOf(err));
      // stale: โหลดฉบับล่าสุด — note อยู่ใน state ของหน้า ข้อความที่พิมพ์ไว้จึงไม่หาย
      if (err instanceof SarabanApiError && err.code === 'stale') await mutate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <SarabanLayout title="เกษียนหนังสือ">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href="/saraban/inbox" className="text-[13px] text-sb-muted hover:text-sb-accent">
          ‹ กลับทะเบียน
        </Link>
        <Link href={`/saraban/track/${doc.id}`} className="text-[13px] text-sb-accent hover:underline">
          ติดตาม
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold">
            รับที่ {formatNo(doc.register, doc.no)} · {doc.subject}
          </h2>
          <p className="mt-0.5 text-[13px] text-sb-muted">
            จาก {doc.party} · ที่ {doc.ref} · อยู่กับ: <span className="font-medium text-sb-ink">{holderName}</span>
          </p>
        </div>
        <StatusPill register={doc.register} status={status} />
      </div>

      <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr))]">
        <section className={`${card} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-sb-line bg-sb-panel px-4 py-2.5">
            <Icon name="description" size={18} className="text-sb-muted" />
            {doc.files.length === 0 ? (
              <span className="text-[13px] text-sb-muted">หนังสือนี้ไม่มีไฟล์แนบ</span>
            ) : (
              doc.files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFileId(f.id)}
                  className={`max-w-[200px] truncate rounded-lg px-2.5 py-1 text-xs ${f.id === file?.id ? 'bg-sb-accent text-white' : 'bg-white hover:bg-sb-hover'}`}
                >
                  {f.name}
                </button>
              ))
            )}
          </div>
          {file ? (
            file.format === 'pdf' ? (
              <iframe key={file.id} src={fileUrl(doc.id, file.id)} title={file.name} className="h-[70vh] min-h-[400px] w-full bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- ลิงก์ชั่วคราวจาก bucket ไม่ผ่าน next/image
              <img src={fileUrl(doc.id, file.id)} alt={file.name} className="w-full bg-white" />
            )
          ) : (
            <div className="flex min-h-[300px] items-center justify-center text-[13px] text-sb-muted">ไม่มีเอกสารให้แสดง</div>
          )}
        </section>

        <section className={`${card} flex flex-col gap-4 p-[22px]`}>
          <h3 className="flex items-center gap-1.5 font-semibold">
            <Icon name="assignment" size={18} />
            บันทึกเกษียน/สั่งการ
          </h3>
          {annotations.length === 0 ? (
            <p className="text-[13px] text-sb-muted">ยังไม่มีการเกษียน</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {annotations.map((ev) => (
                <li key={ev.id} className="flex gap-2.5">
                  <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-sb-accent-light text-xs font-semibold text-sb-accent">
                    {(ev.onBehalfName ?? ev.byName).slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-[13px] font-semibold">{eventByline(ev)}</p>
                      <p className="text-xs text-sb-muted">{thaiDateTime(ev.at)}</p>
                    </div>
                    <p className="mt-1 rounded-lg bg-sb-panel px-3 py-2 text-[13px] leading-normal">{ev.note}</p>
                    <EventDetail event={ev} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canAnnotate(doc) ? (
            <div className="border-t border-sb-line pt-4">
              <p className="mb-3 text-xs text-sb-muted">บันทึกในนาม {holderName}</p>
              <AnnotateForm doc={doc} units={active} busy={busy} note={note} onNoteChange={setNote} onSubmit={submit} />
            </div>
          ) : (
            <p className="rounded-[10px] bg-sb-panel px-3 py-2 text-[13px] text-sb-muted">
              {doc.register !== 'in'
                ? 'เกษียนได้เฉพาะหนังสือรับ'
                : doc.status === 'done'
                  ? 'เรื่องนี้จบแล้ว'
                  : 'เลขทะเบียนนี้ถูกยกเลิกแล้ว'}
            </p>
          )}
        </section>
      </div>
    </SarabanLayout>
  );
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(AnnotatePage);
```

**ห้าม import อะไรจาก `saraban-units-store.ts` / `saraban-store.ts` ในหน้า** — เป็นไฟล์ฝั่งเซิร์ฟเวอร์
(mongodb · fs) ชนิดใช้ `import type` ได้เท่านั้น

- [ ] **Step 2: ตรวจ**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: สะอาด · PASS ทั้งหมด

- [ ] **Step 3: ลองบนเบราว์เซอร์** (dev แบ็กเอนด์ไฟล์แบบ Task 5 Step 4)

ลงรับหนังสือใหม่ที่ `/saraban/receive` → เปิด `/saraban/annotate/<id>` → กดชิป "ทราบ" → เลือก
ส่งต่อ ผอ.กองช่าง → ติ๊กแจ้งเวียน เลือก 2 ตำแหน่ง → กล่องสรุปขึ้น "หนังสือจะไปอยู่ที่ ผอ.กองช่าง ·
เวียนให้ทราบ 2 ตำแหน่ง" → บันทึก → กลับทะเบียนพร้อม toast · เปิดหน้าเดิมอีกครั้ง: เห็นบล็อกเกษียน
"ปลัดเทศบาล · บันทึกโดย …" และ "อยู่กับ: ผอ.กองช่าง" · ลองเลือก "ส่งคืนสารบรรณ" ต้องมี confirm

- [ ] **Step 4: Commit**

```bash
git add "src/pages/saraban/annotate/[id].tsx"
git commit -m "feat(saraban): หน้าเกษียนหนังสือ — ดูเอกสาร บันทึกคำสั่ง ส่งต่อ แจ้งเวียน"
```

---

### Task 10: หน้าติดตามฉบับเต็ม

**Files:**
- Modify: `src/pages/saraban/track/[id].tsx`

- [ ] **Step 1: เพิ่ม import**

```tsx
import CirculationCard from '@/components/saraban/CirculationCard';
import EventDetail, { eventByline } from '@/components/saraban/EventDetail';
import FlowSteps from '@/components/saraban/FlowSteps';
import { ackCirculation, type DocListResponse } from '@/lib/saraban-api';
import { canAnnotate, flowStep } from '@/lib/saraban-flow';
import { docsKey } from '@/lib/saraban-view';
```

(รวมเข้ากับบรรทัด import เดิมของ `@/lib/saraban-api` และ `@/lib/saraban-view` — ไม่ import ซ้ำโมดูล)
แก้คอมเมนต์หัวไฟล์เป็น "หน้าติดตามหนังสือ (สเปกรอบ 2 ข้อ 5 · ต้นแบบจอ 6)" และคงประโยคเรื่องฟังก์ชัน
ที่ปุ่มใช้ไว้

- [ ] **Step 2: ดึงรายการซ้ายใน `TrackPage`** — ถัดจาก `useSWR` ของ summary

```tsx
  // รายการซ้าย: หนังสือรับที่ยังเปิดอยู่ทุกปีงบ (หน้าแรก 50 เรื่อง) — ซ่อนบนจอแคบ
  const { data: openList } = useSWR<DocListResponse>(docsKey({ register: 'in', scope: 'open' }), sarabanFetcher);
```

- [ ] **Step 3: แทน JSX ตั้งแต่ `<div className="grid items-start gap-5 lg:grid-cols-[…]">` จนถึง `</div>` ปิดของมัน**

โครงใหม่ = grid สามคอลัมน์บน `xl` (รายการ · เนื้อหา · เส้นทาง) — ให้ห่อของเดิมดังนี้:

```tsx
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <aside className={`${card} hidden max-h-[80vh] overflow-y-auto p-2 xl:block`} aria-label="หนังสือที่ยังเปิดอยู่">
          <p className="px-2 pb-2 pt-1 text-xs font-semibold text-sb-muted">หนังสือรับที่ยังเปิดอยู่</p>
          {openList?.docs.length ? (
            openList.docs.map((d) => (
              <Link
                key={d.id}
                href={`/saraban/track/${d.id}`}
                className={`mb-1 block rounded-[10px] border px-3 py-2 text-[13px] ${
                  d.id === doc.id ? 'border-sb-accent bg-sb-accent-light' : 'border-transparent hover:bg-sb-hover'
                }`}
              >
                <span className="text-xs font-semibold text-sb-accent">รับที่ {formatNo(d.register, d.no)}</span>
                <span className="block truncate">{d.subject}</span>
              </Link>
            ))
          ) : (
            <p className="px-2 text-[13px] text-sb-muted">ไม่มีหนังสือค้าง</p>
          )}
        </aside>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* ↓ คอลัมน์ซ้ายเดิม (การ์ดหัว · panel · ไฟล์แนบ) + การ์ดแจ้งเวียน */}
          {/* ↓ section "เส้นทางหนังสือ" เดิม */}
        </div>
      </div>
```

ย้าย `<div className="flex flex-col gap-3.5">…</div>` เดิมและ `<section>` เส้นทางหนังสือเดิม เข้าไปแทน
คอมเมนต์สองบรรทัดนั้นตามลำดับ (ลบคอมเมนต์ทิ้ง)

- [ ] **Step 4: ในการ์ดหัว** — หลัง `</dl>` และก่อนแถวปุ่ม

```tsx
            {(() => {
              const step = flowStep(doc);
              return step ? <FlowSteps step={step} overdue={status === 'overdue'} /> : null;
            })()}
```

ในแถวปุ่ม ใส่เป็นปุ่มแรก:

```tsx
              {canAnnotate(doc) ? (
                <Link href={`/saraban/annotate/${doc.id}`} className={primaryButton}>
                  <Icon name="assignment" size={18} />
                  เกษียน
                </Link>
              ) : null}
```

- [ ] **Step 5: การ์ดแจ้งเวียน** — ใต้ panel (ก่อน section ไฟล์แนบ)

```tsx
          <CirculationCard
            doc={doc}
            busy={busy}
            onAck={(unitId) => {
              const name = doc.circulation.find((c) => c.unitId === unitId)?.unitName ?? unitId;
              void run(() => ackCirculation(doc, unitId), `บันทึกว่า ${name} ทราบแล้ว`);
            }}
          />
```

- [ ] **Step 6: ไทม์ไลน์** — ใน `doc.events.map` แทน `<p className="mt-0.5 text-[13px] text-sb-muted">{ev.byName}</p>` ด้วย

```tsx
                <p className="mt-0.5 text-[13px] text-sb-muted">{eventByline(ev)}</p>
                <EventDetail event={ev} />
```

- [ ] **Step 7: ตรวจ**

Run: `npx tsc --noEmit && npm run lint`
Expected: สะอาด

- [ ] **Step 8: ลองบนเบราว์เซอร์** (dev แบ็กเอนด์ไฟล์)

หนังสือที่เกษียนไว้ใน Task 9: แถบขั้นอยู่ที่ "มอบหมาย" (forward 1 ครั้ง) · การ์ดแจ้งเวียน "ทราบแล้ว 0/2" ·
กด "ทราบ" แถวแรก → "ทราบแล้ว 1/2" และไทม์ไลน์มี "รับทราบ (แจ้งเวียน)" · รายการซ้ายไฮไลต์เรื่องนี้
(จอกว้าง ≥ 1280px) · หนังสือส่งไม่มีแถบขั้นและไม่มีปุ่มเกษียน

- [ ] **Step 9: Commit**

```bash
git add "src/pages/saraban/track/[id].tsx"
git commit -m "feat(saraban): หน้าติดตามเต็ม — แถบ 5 ขั้น รายการเรื่องค้าง และการ์ดแจ้งเวียน"
```

---

### Task 11: ทะเบียนรับ — คอลัมน์ "อยู่กับ" และปุ่ม "เกษียน"

**Files:**
- Modify: `src/components/saraban/RegisterPage.tsx`

- [ ] **Step 1: import และดึงสมุด**

```tsx
import { sarabanFetcher, UNITS_KEY, type DocListResponse } from '@/lib/saraban-api';
import { canAnnotate } from '@/lib/saraban-flow';
import type { SarabanRegister, SarabanUnit } from '@/types/saraban';
```

ใน component หลัง `useSWR` ทะเบียน:

```tsx
  const { data: units } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  const unitName = (id: string) => units?.find((u) => u.id === id)?.name ?? '—';
```

- [ ] **Step 2: หัวตาราง** — หลัง `<th …>เรื่อง</th>`

```tsx
                {isIn ? <th className="px-2.5 py-3 font-semibold">อยู่กับ</th> : null}
```

และเปลี่ยนความกว้างคอลัมน์เรื่องจาก `w-[34%]` เป็น `${isIn ? 'w-[28%]' : 'w-[34%]'}`

- [ ] **Step 3: แถว** — หลัง `<td>` ของเรื่อง

```tsx
                  {isIn ? <td className="whitespace-nowrap px-2.5 py-3 text-sb-muted">{unitName(doc.holderUnitId)}</td> : null}
```

ใน `<td>` ท้ายแถว ใส่ก่อนลิงก์ "ติดตาม":

```tsx
                    {canAnnotate(doc) ? (
                      <Link
                        href={`/saraban/annotate/${doc.id}`}
                        className="mr-1.5 rounded-lg bg-sb-accent-light px-2.5 py-[5px] text-xs font-medium text-sb-accent hover:bg-sb-hover"
                      >
                        เกษียน
                      </Link>
                    ) : null}
```

- [ ] **Step 4: ตรวจทั้งหมด**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npx next build`
Expected: เทสต์ PASS ทั้งหมด (มากกว่า baseline 584) · tsc/lint สะอาด · build สำเร็จ และมี route
`/saraban/annotate/[id]` ในรายการ

- [ ] **Step 5: ลองบนเบราว์เซอร์**

`/saraban/inbox`: คอลัมน์ "อยู่กับ" ขึ้นชื่อตำแหน่ง · ปุ่ม "เกษียน" มีเฉพาะเรื่องรอเกษียน/ดำเนินการ ·
เรื่องที่จบแล้วเหลือแค่ "ติดตาม" · `/saraban/outbox` ไม่มีคอลัมน์และปุ่มใหม่

- [ ] **Step 6: Commit**

```bash
git add src/components/saraban/RegisterPage.tsx
git commit -m "feat(saraban): ทะเบียนรับแสดงตำแหน่งที่หนังสืออยู่ และปุ่มเกษียน"
```

---

## ส่งต่อรอบ 3

- `SarabanEvent.by` กับ `onBehalfUnitId` พร้อมแยก "คนกดเอง" vs "ธุรการบันทึกแทน" แล้ว — รอบ 3 แค่เช็คว่า
  `by` อยู่ใน `memberClerkIds` ของตำแหน่งนั้นตอนแสดงผล
- `ackTransition` รับ `actor` อยู่แล้ว — รอบ 3 ให้ guard `requireSarabanMember` เช็คว่าผู้กดผูกกับ
  `unitId` แล้วเรียกฟังก์ชันเดิม
- งานของฉัน = `holderUnitId ∈ ตำแหน่งของฉัน` + `circulation` ที่ `ackAt === ''` ของตำแหน่งฉัน
