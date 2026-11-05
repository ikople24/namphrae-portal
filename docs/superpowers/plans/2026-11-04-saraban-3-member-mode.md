# ระบบสารบรรณรอบ 3 — โหมดเจ้าหน้าที่ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ผู้ถือตำแหน่งล็อกอินแล้วเห็น "งานของฉัน" ของตำแหน่งตัวเอง และเกษียน/ส่งต่อ/แจ้งเวียน/ทราบได้เอง ผู้จัดการผูกคนเข้าตำแหน่งได้ที่สมุดผู้รับ

**Architecture:** ตรรกะการเห็น/แท็บ/สิทธิ์ทำต่อเรื่องเป็นฟังก์ชันบริสุทธิ์ใน `src/lib/saraban-member.ts` (มีเทสต์ ไม่มี DB) · API ใหม่แยกใต้ `/api/admin/saraban/me/*` ใช้ guard `requireSarabanMember` แล้วเรียก `annotateTransition`/`ackTransition` ของรอบ 2 ตัวเดิม · route โหมดเต็มไม่แตะ · หน้า `/saraban/me` และ `/saraban/me/doc/[id]` เป็น shell 720px ของตัวเอง

**Tech Stack:** Next.js 16 Pages Router · React 19 · SWR 2 (`swr/infinite`) · zod 4 · Tailwind v4 (`--color-sb-*`) · vitest · MongoDB | JSON file backend

**สเปก:** `docs/superpowers/specs/2026-11-04-saraban-3-member-mode-design.md`

**Baseline:** branch `feat/saraban-3` (ต่อจาก `feat/saraban-2`) · `npx vitest run` = 39 ไฟล์ / 620 เทสต์ผ่าน · `npx tsc --noEmit` และ `npm run lint` สะอาด

**กติกาของ repo ที่ต้องทำตาม**
- AGENTS.md: "This is NOT the Next.js you know" — ถ้าต้องใช้ API ของ Next ที่ไม่ได้เห็นในโค้ดเดิม อ่าน `node_modules/next/dist/docs/` ก่อน
- คอมเมนต์ภาษาไทย ความหนาแน่นแบบไฟล์ข้างเคียง · ไม่ใส่ `undefined` ลง Mongo `$set`
- ไอคอนต้องอยู่ใน `ICON_NAMES` (`src/lib/icons.ts`) ก่อนใช้ — ชื่อที่ใช้ในแผนนี้มีอยู่แล้วทั้งหมด: `check` `arrow_forward` `arrow_back` `campaign` `group` `person` `description` `attach_file` `add`
- ห้าม `git add` โฟลเดอร์ `public/design_handoff_namphrae_ui/` และ `package-lock.json`
- commit message ลงท้ายด้วย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

**ความต่างจากสเปกที่ตัดสินตอนเขียนแผน (บันทึกไว้ให้ reviewer)**
1. โหมดเจ้าหน้าที่เห็นเฉพาะ **หนังสือรับ** (`register: 'in'`) — หนังสือส่ง/เวียนมี `holderUnitId` เป็นหน่วยผู้ออก ไม่ใช่งานที่ต้องเกษียน ถ้าไม่ตัดจะไปโผล่ในแท็บ "ส่งต่อแล้ว/จบเรื่อง" ของหน่วยนั้น
2. `memberUnitIds` ไม่ต้องมี Mongo index — สมุดมีหลักสิบรายการ อ่านทั้งหมดด้วย `listUnits()` แล้วกรอง (แนวเดียวกับ `getUnit`)
3. SSR guard `getSarabanMemberSsrProps` อยู่ใน `auth-server.ts` (ใช้ `buildSsrGuard` ที่ไม่ได้ export) ส่วน API guard อยู่ `saraban-member-guard.ts`
4. ชิปชื่อผู้ถือตำแหน่งที่หน้าสมุดผู้รับแสดงชื่อเฉพาะผู้จัดการ (รายชื่อสมาชิกมาจาก `GET /api/admin/users` ที่เป็น `requireManager`) — คนอื่นเห็นจำนวน "N คน"
5. ไม่มีไฟล์ `saraban-member-guard.test.ts` — repo ไม่ mock Mongo/Clerk ในเทสต์ กฎ "dev-open ใช้ `as` · Clerk เพิกเฉย `as`" จึงอยู่ในฟังก์ชันบริสุทธิ์ `memberUnitIdsFor` ที่เทสต์ใน `saraban-member.test.ts` แล้ว guard แค่เรียกตัวนี้

---

## โครงไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/saraban-member.ts` (ใหม่) | บริสุทธิ์: `canSeeDoc` `memberTab` `memberActions` `memberUnitIdsFor` `memberCandidateQuery` `pageMemberDocs` `countMemberTabs` |
| `src/lib/saraban-member.test.ts` (ใหม่) | เทสต์ทุกฟังก์ชันข้างบน |
| `src/lib/saraban-member-guard.ts` (ใหม่) | `requireSarabanMember` (SERVER ONLY) |
| `src/lib/saraban-schema.ts` | แยก `annotatePatchSchema`/`ackPatchSchema` · `memberPatchSchema` · `memberDocsQuerySchema` · `unitMembersSchema` |
| `src/lib/saraban-view.ts` | ข้อความ error ใหม่ 3 ตัว · `withAs` · `memberSummaryKey` · `memberDocsKey` · `memberDocKey` · `memberFileUrl` |
| `src/lib/saraban-units-store.ts` | `setUnitMembers` |
| `src/lib/saraban-store.ts` | `listMemberCandidates` · index 3 ตัว |
| `src/lib/auth-server.ts` | `buildSsrGuard` รับ allowed แบบ async · ไม่มีฟีเจอร์แต่ผูกตำแหน่ง → `/saraban/me` · `getSarabanMemberSsrProps` |
| `src/lib/api-guard-coverage.test.ts` | รับ `requireSarabanMember(` · ไฟล์ใต้ `saraban/me/` ต้องใช้ guard นี้ |
| `src/pages/api/admin/saraban/me/index.ts` (ใหม่) | GET สรุป |
| `src/pages/api/admin/saraban/me/docs/index.ts` (ใหม่) | GET รายการตามแท็บ |
| `src/pages/api/admin/saraban/me/docs/[id]/index.ts` (ใหม่) | GET/PATCH หนังสือหนึ่งเรื่อง |
| `src/pages/api/admin/saraban/me/docs/[id]/files/[fileId].ts` (ใหม่) | GET ลิงก์ไฟล์ |
| `src/pages/api/admin/saraban/units/[id]/members.ts` (ใหม่) | PUT ผูกคน (ผู้จัดการ) |
| `src/lib/saraban-api.ts` | ชนิด response + ตัวเรียก `me/*` + `setUnitMembers` |
| `src/components/saraban/MemberShell.tsx` (ใหม่) | header 720px + Toaster |
| `src/components/saraban/MemberDocCard.tsx` (ใหม่) | การ์ดหนังสือในงานของฉัน |
| `src/components/saraban/MemberActionForm.tsx` (ใหม่) | การ์ดดำเนินการ 3 ขั้น + bottom bar |
| `src/components/saraban/UnitMembersPanel.tsx` (ใหม่) | แผงผูกคนของผู้จัดการ |
| `src/pages/saraban/me/index.tsx` (ใหม่) | งานของฉัน |
| `src/pages/saraban/me/doc/[id].tsx` (ใหม่) | หน้าหนังสือ |
| `src/pages/saraban/units.tsx` | คอลัมน์ผู้ถือตำแหน่ง + ปุ่มผูกคน |
| `src/components/saraban/SarabanLayout.tsx` | ปุ่ม "งานของฉัน" |

---

### Task 1: ตรรกะบริสุทธิ์ของโหมดเจ้าหน้าที่

**Files:**
- Create: `src/lib/saraban-member.ts`
- Test: `src/lib/saraban-member.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม**

```ts
// src/lib/saraban-member.test.ts
import { describe, expect, it } from 'vitest';
import { buildNewDoc, makeEvent } from '@/lib/saraban-doc';
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

  it('ไม่แก้ doc ที่รับเข้า', () => {
    const doc = Object.freeze(makeDoc({ circulation: Object.freeze([circ('finance')]) as SarabanCirculation[] }));
    expect(() => memberTab(doc, ['finance'])).not.toThrow();
    expect(() => memberActions(doc, ['finance'])).not.toThrow();
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
  });
});
```

- [ ] **Step 2: รันให้ล้ม**

Run: `npx vitest run src/lib/saraban-member.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/saraban-member"`

- [ ] **Step 3: เขียนโค้ด**

```ts
// src/lib/saraban-member.ts
// โหมดเจ้าหน้าที่ (สเปกรอบ 3 ข้อ 2) — บริสุทธิ์ client-safe · ใครเห็นเรื่องไหน อยู่แท็บไหน ทำอะไรได้
// ตัดสินที่นี่ที่เดียว API ทุกตัวใต้ /me และหน้าจอใช้ชุดเดียวกัน สองแบ็กเอนด์จึงได้ผลเท่ากันโดยโครงสร้าง
//
// เฉพาะหนังสือรับ: หนังสือส่ง/เวียนมี holderUnitId เป็นหน่วยผู้ออก ไม่ใช่งานที่ต้องเกษียน

import { isOpen } from '@/lib/saraban-doc';
import { canAck, canAnnotate } from '@/lib/saraban-flow';
import type { SarabanDoc, SarabanUnit } from '@/types/saraban';

export const MEMBER_TABS = ['todo', 'forwarded', 'done'] as const;
export type MemberTab = (typeof MEMBER_TABS)[number];
export const MEMBER_PAGE_SIZE = 20;

type MemberDocView = Pick<SarabanDoc, 'register' | 'status' | 'holderUnitId' | 'circulation' | 'events'>;

/** ถืออยู่ · ถูกเวียนถึง · เคยเกษียน/ส่งต่อในนามตำแหน่งนี้ (สเปกรอบ 3 ข้อ 1.2) */
export function canSeeDoc(doc: MemberDocView, unitIds: readonly string[]): boolean {
  if (doc.register !== 'in') return false;
  const mine = new Set(unitIds);
  return (
    mine.has(doc.holderUnitId) ||
    doc.circulation.some((c) => mine.has(c.unitId)) ||
    doc.events.some((e) => Boolean(e.onBehalfUnitId) && mine.has(e.onBehalfUnitId as string))
  );
}

function pendingAcks(doc: MemberDocView, mine: Set<string>): string[] {
  return doc.circulation.filter((c) => mine.has(c.unitId) && !c.ackAt).map((c) => c.unitId);
}

/**
 * แท็บของเรื่องหนึ่ง · null = ไม่แสดง (ไม่เกี่ยว หรือยกเลิก)
 * แถวเวียนที่ยังไม่ทราบชนะสถานะ done — ทราบย้อนหลังได้ (สเปกรอบ 2 ข้อ 1.5) จึงยังเป็นงานค้าง
 */
export function memberTab(doc: MemberDocView, unitIds: readonly string[]): MemberTab | null {
  if (doc.status === 'void' || !canSeeDoc(doc, unitIds)) return null;
  const mine = new Set(unitIds);
  const holds = canAnnotate(doc) && mine.has(doc.holderUnitId);
  if (holds || pendingAcks(doc, mine).length > 0) return 'todo';
  if (doc.status === 'done') return 'done';
  return isOpen(doc.status) ? 'forwarded' : null;
}

export type MemberActions = { annotateAs: string | null; ackUnitIds: string[] };

export function memberActions(doc: MemberDocView, unitIds: readonly string[]): MemberActions {
  const mine = new Set(unitIds);
  return {
    annotateAs: canAnnotate(doc) && mine.has(doc.holderUnitId) ? doc.holderUnitId : null,
    ackUnitIds: canAck(doc) ? pendingAcks(doc, mine) : [],
  };
}

/**
 * ตำแหน่งของผู้ใช้ — Clerk: จาก memberClerkIds ของตำแหน่งที่เปิดใช้ · dev-open: ทุกคนคือ 'dev-open'
 * ที่ไม่ได้ผูกกับอะไร จึงสวมตำแหน่งจาก ?as= ได้ตำแหน่งเดียวเพื่อทดสอบ · ตั้ง Clerk แล้ว as ไม่มีผลเสมอ
 */
export function memberUnitIdsFor(args: {
  clerkOn: boolean;
  userId: string;
  as: string | undefined;
  units: readonly SarabanUnit[];
}): string[] {
  const active = args.units.filter((u) => u.isActive);
  if (!args.clerkOn) return active.some((u) => u.id === args.as) ? [args.as as string] : [];
  return active.filter((u) => u.memberClerkIds.includes(args.userId)).map((u) => u.id);
}

/** query หยาบของ Mongo — แท็บตัดสินด้วย memberTab ใน memory ต่อ (ตำแหน่งหนึ่งเกี่ยวหลักร้อยเรื่อง) */
export function memberCandidateQuery(unitIds: readonly string[]): Record<string, unknown> {
  const $in = [...unitIds];
  return {
    register: 'in',
    status: { $ne: 'void' },
    $or: [
      { holderUnitId: { $in } },
      { 'circulation.unitId': { $in } },
      { 'events.onBehalfUnitId': { $in } },
    ],
  };
}

function byRecent(a: SarabanDoc, b: SarabanDoc): number {
  return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
}

export function pageMemberDocs(
  docs: readonly SarabanDoc[],
  unitIds: readonly string[],
  tab: MemberTab,
  page: number
): { items: SarabanDoc[]; total: number } {
  const all = docs.filter((d) => memberTab(d, unitIds) === tab).sort(byRecent);
  const skip = (page - 1) * MEMBER_PAGE_SIZE;
  return { items: all.slice(skip, skip + MEMBER_PAGE_SIZE), total: all.length };
}

export function countMemberTabs(docs: readonly SarabanDoc[], unitIds: readonly string[]): Record<MemberTab, number> {
  const counts: Record<MemberTab, number> = { todo: 0, forwarded: 0, done: 0 };
  for (const doc of docs) {
    const tab = memberTab(doc, unitIds);
    if (tab) counts[tab] += 1;
  }
  return counts;
}
```

หมายเหตุ: `pageMemberDocs` ใช้ `.filter()` ก่อน `.sort()` — ไม่ sort array ที่รับเข้า

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run src/lib/saraban-member.test.ts`
Expected: PASS ทุกเทสต์

- [ ] **Step 5: tsc + commit**

```bash
npx tsc --noEmit
git add src/lib/saraban-member.ts src/lib/saraban-member.test.ts
git commit -m "feat(saraban): ตรรกะโหมดเจ้าหน้าที่ — การเห็น แท็บ และสิทธิ์ทำต่อเรื่อง

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: schema · ข้อความ error · คีย์ SWR

**Files:**
- Modify: `src/lib/saraban-schema.ts` (บล็อก `docPatchSchema` บรรทัด ~100–123)
- Modify: `src/lib/saraban-view.ts` (`ERROR_MESSAGES` และท้ายไฟล์)
- Test: `src/lib/saraban-schema.test.ts`, `src/lib/saraban-view.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** — ต่อท้าย `src/lib/saraban-schema.test.ts` (import เพิ่มที่หัวไฟล์ตามที่ใช้)

```ts
import { memberDocsQuerySchema, memberPatchSchema, unitMembersSchema } from '@/lib/saraban-schema';

describe('memberPatchSchema', () => {
  it('รับ annotate และ ack', () => {
    expect(
      memberPatchSchema.safeParse({ action: 'annotate', updatedAt: 'x', note: 'ทราบ', route: { kind: 'close' } }).success
    ).toBe(true);
    expect(memberPatchSchema.safeParse({ action: 'ack', updatedAt: 'x', unitId: 'palad' }).success).toBe(true);
  });

  it('ไม่รับ edit / void / sent', () => {
    expect(memberPatchSchema.safeParse({ action: 'void', updatedAt: 'x', reason: 'ผิด' }).success).toBe(false);
    expect(memberPatchSchema.safeParse({ action: 'edit', updatedAt: 'x', edit: {} }).success).toBe(false);
    expect(memberPatchSchema.safeParse({ action: 'sent', updatedAt: 'x', method: 'post' }).success).toBe(false);
  });
});

describe('memberDocsQuerySchema', () => {
  it('ค่าเริ่มต้น tab=todo page=1 · tab ผิดไม่ผ่าน', () => {
    expect(memberDocsQuerySchema.parse({})).toEqual({ tab: 'todo', page: 1 });
    expect(memberDocsQuerySchema.parse({ tab: 'done', page: '2' })).toEqual({ tab: 'done', page: 2 });
    expect(memberDocsQuerySchema.safeParse({ tab: 'all' }).success).toBe(false);
  });
});

describe('unitMembersSchema', () => {
  it('ว่างได้ (ถอดทุกคน) · ไม่เกิน 10 · ห้ามซ้ำ', () => {
    expect(unitMembersSchema.safeParse({ clerkIds: [] }).success).toBe(true);
    expect(unitMembersSchema.safeParse({ clerkIds: ['a', 'b'] }).success).toBe(true);
    expect(unitMembersSchema.safeParse({ clerkIds: ['a', 'a'] }).success).toBe(false);
    expect(unitMembersSchema.safeParse({ clerkIds: Array.from({ length: 11 }, (_, i) => `u${i}`) }).success).toBe(false);
  });
});
```

ต่อท้าย `src/lib/saraban-view.test.ts`:

```ts
import { errorMessage, memberDocKey, memberDocsKey, memberFileUrl, memberSummaryKey, withAs } from '@/lib/saraban-view';

describe('คีย์โหมดเจ้าหน้าที่', () => {
  it('ต่อ as เมื่อมี (dev-open) · ไม่มีก็ไม่ใส่', () => {
    expect(withAs('/api/x', undefined)).toBe('/api/x');
    expect(withAs('/api/x', 'palad')).toBe('/api/x?as=palad');
    expect(withAs('/api/x?tab=done', 'palad')).toBe('/api/x?tab=done&as=palad');
  });

  it('รูปคีย์', () => {
    expect(memberSummaryKey(undefined)).toBe('/api/admin/saraban/me');
    expect(memberDocsKey({ tab: 'todo', page: 1 })).toBe('/api/admin/saraban/me/docs?tab=todo');
    expect(memberDocsKey({ tab: 'done', page: 3, as: 'palad' })).toBe('/api/admin/saraban/me/docs?tab=done&page=3&as=palad');
    expect(memberDocKey('doc 1', 'palad')).toBe('/api/admin/saraban/me/docs/doc%201?as=palad');
    expect(memberFileUrl('d', 'f', undefined)).toBe('/api/admin/saraban/me/docs/d/files/f');
  });

  it('ข้อความ error ใหม่', () => {
    expect(errorMessage('not_member')).toContain('ยังไม่ได้ผูก');
    expect(errorMessage('not_holder')).toContain('ไม่ได้อยู่กับตำแหน่งของคุณ');
    expect(errorMessage('invalid_member')).toContain('ไม่ใช่สมาชิก');
  });
});
```

- [ ] **Step 2: รันให้ล้ม**

Run: `npx vitest run src/lib/saraban-schema.test.ts src/lib/saraban-view.test.ts`
Expected: FAIL — export ไม่มี

- [ ] **Step 3: แก้ `saraban-schema.ts`** — แยก annotate/ack ออกเป็นค่าคงที่ แล้วใช้ทั้งใน `docPatchSchema` และ `memberPatchSchema` (แทนบล็อก `docPatchSchema` เดิมทั้งก้อน):

```ts
const annotatePatchSchema = z.object({
  action: z.literal('annotate'),
  updatedAt: z.string().min(1),
  note: requiredText(1000, 'ต้องมีข้อความเกษียน'),
  route: annotateRouteSchema,
  circulateTo: z
    .array(z.string().min(1).max(100))
    .max(MAX_CIRCULATE, `เวียนได้ไม่เกิน ${MAX_CIRCULATE} ตำแหน่งต่อครั้ง`)
    .refine((ids) => new Set(ids).size === ids.length, 'เลือกตำแหน่งซ้ำ')
    .default([]),
});
const ackPatchSchema = z.object({ action: z.literal('ack'), updatedAt: z.string().min(1), unitId: z.string().min(1).max(100) });

export const docPatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('edit'), updatedAt: z.string().min(1), edit: editSchema }),
  z.object({
    action: z.literal('void'),
    updatedAt: z.string().min(1),
    reason: requiredText(500, 'ต้องระบุเหตุผลที่ยกเลิก'),
  }),
  z.object({ action: z.literal('sent'), updatedAt: z.string().min(1), method: z.enum(SEND_METHODS) }),
  annotatePatchSchema,
  ackPatchSchema,
]);
export type DocPatch = z.infer<typeof docPatchSchema>;

// PATCH /api/admin/saraban/me/docs/[id] — เจ้าตัวทำได้แค่เกษียนกับทราบ (สเปกรอบ 3 ข้อ 3)
// แก้ข้อมูล/ยกเลิก/ไฟล์ยังเป็นงานของธุรการในโหมดเต็ม
export const memberPatchSchema = z.discriminatedUnion('action', [annotatePatchSchema, ackPatchSchema]);
export type MemberPatch = z.infer<typeof memberPatchSchema>;
```

ต่อท้ายไฟล์ (import `MEMBER_TABS` จาก `@/lib/saraban-member` ที่หัวไฟล์ — `saraban-member.ts` ไม่ import schema จึงไม่วน):

```ts
// GET /api/admin/saraban/me/docs
export const memberDocsQuerySchema = z.object({
  tab: z.enum(MEMBER_TABS).default('todo'),
  page: z.coerce.number().int().min(1).default(1),
});

// PUT /api/admin/saraban/units/[id]/members — ว่าง = ถอดทุกคน · สูงสุด 10 คนต่อตำแหน่ง (รักษาการแทน)
export const MAX_UNIT_MEMBERS = 10;
export const unitMembersSchema = z.object({
  clerkIds: z
    .array(z.string().min(1).max(100))
    .max(MAX_UNIT_MEMBERS, `ผูกได้ไม่เกิน ${MAX_UNIT_MEMBERS} คนต่อตำแหน่ง`)
    .refine((ids) => new Set(ids).size === ids.length, 'เลือกคนซ้ำ'),
});
```

- [ ] **Step 4: แก้ `saraban-view.ts`** — เพิ่มใน `ERROR_MESSAGES` (ก่อน `not_found`):

```ts
  not_member: 'ยังไม่ได้ผูกกับตำแหน่งใด ติดต่อผู้ดูแลระบบ',
  not_holder: 'หนังสือนี้ไม่ได้อยู่กับตำแหน่งของคุณแล้ว',
  invalid_member: 'มีรายชื่อที่ไม่ใช่สมาชิกในระบบ',
```

ต่อท้ายไฟล์ (import `type MemberTab` จาก `@/lib/saraban-member`):

```ts
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
```

- [ ] **Step 5: รันให้ผ่าน + ทั้งชุด**

Run: `npx vitest run src/lib/saraban-schema.test.ts src/lib/saraban-view.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS ทั้งหมด (เทสต์เดิมของ `docPatchSchema` ต้องผ่านโดยไม่แก้)

- [ ] **Step 6: Commit**

```bash
git add src/lib/saraban-schema.ts src/lib/saraban-schema.test.ts src/lib/saraban-view.ts src/lib/saraban-view.test.ts
git commit -m "feat(saraban): schema เกษียน/ทราบของเจ้าตัว ผูกคน และคีย์โหมดเจ้าหน้าที่

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: store — ผูกคน และรายการหนังสือของตำแหน่ง

**Files:**
- Modify: `src/lib/saraban-units-store.ts` (ท้ายไฟล์)
- Modify: `src/lib/saraban-store.ts` (`ensureIndexes` และส่วน "อ่าน")

ไม่มีเทสต์ใหม่ในงานนี้ — ตรรกะกรองอยู่ใน `saraban-member.ts` ที่เทสต์แล้ว (repo ไม่มี DB ในเทสต์) · store แค่ดึงข้อมูล

- [ ] **Step 1: `saraban-units-store.ts`** ต่อท้ายไฟล์:

```ts
/** ผูกคนเข้าตำแหน่ง (สเปกรอบ 3 ข้อ 2) — แทนทั้งรายการ · route ตรวจทะเบียนสมาชิกมาก่อนแล้ว */
export async function setUnitMembers(id: string, clerkIds: string[]): Promise<SarabanUnit | null> {
  if (isMongoConfigured()) {
    await ensureSeeded();
    return (await unitsCollection()).findOneAndUpdate(
      { id },
      { $set: { memberClerkIds: clerkIds } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  }
  const units = await fileRead();
  const index = units.findIndex((unit) => unit.id === id);
  if (index === -1) return null;
  units[index] = { ...units[index], memberClerkIds: clerkIds };
  await writeJsonArray(RUNTIME_FILE, units);
  return units[index];
}
```

- [ ] **Step 2: `saraban-store.ts`** — ใน `ensureIndexes` ต่อท้ายอาร์เรย์ของ `createIndexes`:

```ts
        // โหมดเจ้าหน้าที่ (รอบ 3) ค้นเรื่องที่ตำแหน่งเกี่ยวสามทาง — memberCandidateQuery
        { key: { holderUnitId: 1 } },
        { key: { 'circulation.unitId': 1 } },
        { key: { 'events.onBehalfUnitId': 1 } },
```

import เพิ่ม: `import { canSeeDoc, memberCandidateQuery } from '@/lib/saraban-member';`

ต่อจาก `listFiscalYears`:

```ts
/**
 * หนังสือทุกเรื่องที่ตำแหน่งเหล่านี้เกี่ยว (ยังไม่แบ่งแท็บ) — แท็บ/จำนวน/หน้า ตัดสินด้วย pageMemberDocs
 * กับ countMemberTabs ใน memory · ตำแหน่งหนึ่งเกี่ยวหลักร้อยเรื่องต่อปี ถ้าเกินหลักพันค่อยย้ายไป aggregate
 */
export async function listMemberCandidates(unitIds: readonly string[]): Promise<SarabanDoc[]> {
  if (unitIds.length === 0) return [];
  if (isMongoConfigured()) {
    const docs = await (await docsCollection())
      .find(memberCandidateQuery(unitIds) as Filter<SarabanDoc>, { projection: { _id: 0 } })
      .toArray();
    return docs.map(withDefaults);
  }
  return (await readDocs()).map(withDefaults).filter((doc) => doc.status !== 'void' && canSeeDoc(doc, unitIds));
}
```

- [ ] **Step 3: ตรวจ**

Run: `npx tsc --noEmit && npx vitest run`
Expected: สะอาด / 620+ ผ่าน

- [ ] **Step 4: Commit**

```bash
git add src/lib/saraban-units-store.ts src/lib/saraban-store.ts
git commit -m "feat(saraban): store ผูกคนเข้าตำแหน่ง และดึงหนังสือที่ตำแหน่งเกี่ยว

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: guard ของโหมดเจ้าหน้าที่ + SSR + เทสต์ guard coverage

**Files:**
- Create: `src/lib/saraban-member-guard.ts`
- Modify: `src/lib/auth-server.ts` (`buildSsrGuard` และท้ายส่วน SSR)
- Modify: `src/lib/api-guard-coverage.test.ts`

- [ ] **Step 1: เขียนเทสต์ guard coverage ที่ล้ม** — ใน `api-guard-coverage.test.ts`:

ในเงื่อนไข `guarded` เพิ่มบรรทัด (ก่อน `src.includes("from '@/lib/layer-routes'")`):

```ts
        // โหมดเจ้าหน้าที่ (สารบรรณรอบ 3) — สิทธิ์มาจากการผูกตำแหน่ง ไม่ใช่ฟีเจอร์ ดูเทสต์ด้านล่าง
        src.includes('requireSarabanMember(') ||
```

ต่อท้ายไฟล์:

```ts
describe('สารบรรณโหมดเจ้าหน้าที่: ทุก route ใต้ saraban/me ใช้ guard ของการผูกตำแหน่ง', () => {
  const ME_DIR = join(API_DIR, 'saraban', 'me');
  const files = walk(ME_DIR);

  it('มี route อย่างน้อยหนึ่งไฟล์ (กันเทสต์ผ่านเพราะโฟลเดอร์ว่าง)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = relative(API_DIR, file);
    it(rel, () => {
      const src = readFileSync(file, 'utf8');
      expect(src).toContain('requireSarabanMember(');
      // คนละสิทธิ์ — requireFeature('saraban') จะตัดคนที่ผูกตำแหน่งอย่างเดียวออก
      expect(src).not.toContain("requireFeature(req, res, 'saraban')");
    });
  }

  it('ผูกคนเข้าตำแหน่งเป็นของผู้จัดการเท่านั้น', () => {
    const src = readFileSync(join(API_DIR, 'saraban', 'units', '[id]', 'members.ts'), 'utf8');
    expect(src).toContain('requireManager(');
  });
});
```

Run: `npx vitest run src/lib/api-guard-coverage.test.ts`
Expected: FAIL — `ENOENT ... saraban/me` (ยังไม่มีโฟลเดอร์ — จะผ่านหลัง Task 5–7) **อย่า commit เทสต์นี้แยก** ให้ไปพร้อม Task 7 ตามขั้นตอนข้างล่าง: ตอนนี้แค่เก็บไว้ใน working tree

- [ ] **Step 2: สร้าง `src/lib/saraban-member-guard.ts`**

```ts
// src/lib/saraban-member-guard.ts
// guard ของ API โหมดเจ้าหน้าที่ (สเปกรอบ 3 ข้อ 2) — SERVER ONLY
// สิทธิ์ = ผูกกับตำแหน่งที่เปิดใช้อย่างน้อยหนึ่ง (ไม่ใช่ฟีเจอร์ saraban) แต่ยังต้องเป็นสมาชิก active
// ในทะเบียนก่อนเสมอ — requireAdmin ตัดสินข้อนั้น การผูกตำแหน่งไม่ใช่ทางลัดข้ามทะเบียน

import type { NextApiRequest, NextApiResponse } from 'next';
import { isClerkConfigured, requireAdmin, type AdminIdentity } from '@/lib/auth-server';
import { memberUnitIdsFor } from '@/lib/saraban-member';
import { listUnits } from '@/lib/saraban-units-store';
import { hasFeature } from '@/lib/user-access';
import type { SarabanUnit } from '@/types/saraban';

export type SarabanMember = {
  admin: AdminIdentity;
  unitIds: string[];
  units: SarabanUnit[]; // สมุดทั้งเล่ม — route ใช้ต่อกับ annotateTransition ไม่ต้องอ่านซ้ำ
  canReceive: boolean;
};

export async function requireSarabanMember(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<SarabanMember | null> {
  const admin = await requireAdmin(req, res);
  if (!admin) return null;
  let units: SarabanUnit[];
  try {
    units = await listUnits();
  } catch (err) {
    console.error('requireSarabanMember: อ่านสมุดผู้รับไม่ได้', err);
    res.status(500).json({ error: 'server_error' });
    return null;
  }
  const unitIds = memberUnitIdsFor({
    clerkOn: isClerkConfigured(),
    userId: admin.userId,
    as: typeof req.query.as === 'string' ? req.query.as : undefined,
    units,
  });
  if (unitIds.length === 0) {
    res.status(403).json({ error: 'not_member' });
    return null;
  }
  return { admin, unitIds, units, canReceive: hasFeature(admin, 'saraban') };
}
```

- [ ] **Step 3: แก้ `auth-server.ts`**

import เพิ่มที่หัวไฟล์:

```ts
import { memberUnitIdsFor } from '@/lib/saraban-member';
import { listUnits } from '@/lib/saraban-units-store';
```

แทน `buildSsrGuard` เดิมทั้งฟังก์ชัน (คงคอมเมนต์บล็อกเดิมไว้ แล้วต่อบรรทัดเรื่องรอบ 3):

```ts
// - (สารบรรณรอบ 3) ไม่มีฟีเจอร์ใดเลยแต่ผูกตำแหน่ง → /saraban/me · เช็คเฉพาะกรณีนี้ คำขอทั่วไป
//   จึงไม่ต้องอ่านสมุดเพิ่ม · ปลายทางผ่าน guard ของตัวเองเพราะ getSarabanMemberSsrProps นับการผูก
function buildSsrGuard(
  allowed: (identity: AdminIdentity) => boolean | Promise<boolean>
): GetServerSideProps<AdminPageProps> {
  return async (ctx) => {
    const check = await checkAdmin(ctx.req);
    if (!check.ok) {
      if (check.status === 403 && isClerkConfigured()) {
        return { redirect: { destination: '/apply', permanent: false } };
      }
      return { props: { member: false } };
    }
    if (await allowed(check.identity)) return { props: { member: true } };
    const destination =
      firstAllowedPath(check.identity) ??
      ((await isSarabanUnitMember(check.identity.userId)) ? '/saraban/me' : null);
    if (destination) return { redirect: { destination, permanent: false } };
    return { props: { member: true, forbidden: true } };
  };
}

/** ผูกกับตำแหน่งที่เปิดใช้อย่างน้อยหนึ่ง — อ่านสมุดไม่ได้ถือว่าไม่ได้ผูก (fail closed) */
async function isSarabanUnitMember(userId: string): Promise<boolean> {
  try {
    return memberUnitIdsFor({ clerkOn: true, userId, as: undefined, units: await listUnits() }).length > 0;
  } catch (err) {
    console.error('isSarabanUnitMember: อ่านสมุดผู้รับไม่ได้', err);
    return false;
  }
}
```

ต่อท้ายส่วน SSR (หลัง `getMemberSsrProps`):

```ts
/**
 * หน้าโหมดเจ้าหน้าที่ /saraban/me* (สเปกรอบ 3 ข้อ 2) — มีสิทธิ์ saraban หรือผูกตำแหน่ง · dev-open ผ่าน
 * ด้วยสิทธิ์ครบ แล้วหน้าจอให้เลือกตำแหน่งที่จะสวม (?as=)
 */
export const getSarabanMemberSsrProps: GetServerSideProps<AdminPageProps> = buildSsrGuard(
  async (identity) => hasFeature(identity, 'saraban') || (await isSarabanUnitMember(identity.userId))
);
```

- [ ] **Step 4: ตรวจ (ยกเว้นเทสต์ coverage ที่รอโฟลเดอร์ me/)**

Run: `npx tsc --noEmit && npx vitest run --exclude src/lib/api-guard-coverage.test.ts`
Expected: สะอาด / ผ่าน

- [ ] **Step 5: Commit (ไม่รวม `api-guard-coverage.test.ts`)**

```bash
git add src/lib/saraban-member-guard.ts src/lib/auth-server.ts
git commit -m "feat(saraban): guard โหมดเจ้าหน้าที่ และพาคนที่ผูกตำแหน่งอย่างเดียวไปงานของฉัน

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: API สรุปและรายการ — `me/index.ts` · `me/docs/index.ts`

**Files:**
- Create: `src/pages/api/admin/saraban/me/index.ts`
- Create: `src/pages/api/admin/saraban/me/docs/index.ts`

- [ ] **Step 1: `me/index.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { countMemberTabs } from '@/lib/saraban-member';
import { requireSarabanMember } from '@/lib/saraban-member-guard';
import { listMemberCandidates } from '@/lib/saraban-store';

// GET /api/admin/saraban/me — ตำแหน่งที่ผูก · จำนวนต่อแท็บ · ลงรับได้ไหม (สเปกรอบ 3 ข้อ 3)
// ไม่ได้ผูก → 403 not_member (shell โหมดเต็มใช้ตัวนี้ตัดสินว่าโชว์ปุ่ม "งานของฉัน" ไหม)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const member = await requireSarabanMember(req, res);
  if (!member) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const docs = await listMemberCandidates(member.unitIds);
    return res.status(200).json({
      units: member.units
        .filter((u) => member.unitIds.includes(u.id))
        .map(({ id, name }) => ({ id, name })),
      canReceive: member.canReceive,
      counts: countMemberTabs(docs, member.unitIds),
    });
  } catch (err) {
    console.error('GET /api/admin/saraban/me failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
```

- [ ] **Step 2: `me/docs/index.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { MEMBER_PAGE_SIZE, pageMemberDocs } from '@/lib/saraban-member';
import { requireSarabanMember } from '@/lib/saraban-member-guard';
import { memberDocsQuerySchema } from '@/lib/saraban-schema';
import { listMemberCandidates } from '@/lib/saraban-store';

// GET /api/admin/saraban/me/docs?tab=todo|forwarded|done&page= — หน้าละ 20 แก้ล่าสุดก่อน
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const member = await requireSarabanMember(req, res);
  if (!member) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const parsed = memberDocsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  }
  const { tab, page } = parsed.data;
  try {
    const docs = await listMemberCandidates(member.unitIds);
    const { items, total } = pageMemberDocs(docs, member.unitIds, tab, page);
    return res.status(200).json({ items, total, page, pageSize: MEMBER_PAGE_SIZE });
  } catch (err) {
    console.error('GET /api/admin/saraban/me/docs failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
```

หมายเหตุ: `req.query` มี `as` ด้วย — `z.object` ของ zod 4 ตัดคีย์ที่ไม่รู้จักทิ้ง (strip) ไม่ error

- [ ] **Step 3: ตรวจ**

Run: `npx tsc --noEmit && npm run lint`
Expected: สะอาด

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/saraban/me/index.ts src/pages/api/admin/saraban/me/docs/index.ts
git commit -m "feat(saraban): API สรุปงานของฉัน และรายการตามแท็บ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: API หนังสือหนึ่งเรื่องและไฟล์ — `me/docs/[id]`

**Files:**
- Create: `src/pages/api/admin/saraban/me/docs/[id]/index.ts`
- Create: `src/pages/api/admin/saraban/me/docs/[id]/files/[fileId].ts`

- [ ] **Step 1: `me/docs/[id]/index.ts`**

```ts
import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveActor } from '@/lib/saraban-actor';
import { makeEvent } from '@/lib/saraban-doc';
import { ackTransition, annotateTransition, FLOW_ERROR_STATUS } from '@/lib/saraban-flow';
import { canSeeDoc, memberActions } from '@/lib/saraban-member';
import { requireSarabanMember } from '@/lib/saraban-member-guard';
import { memberPatchSchema } from '@/lib/saraban-schema';
import { applyPatch, getDoc } from '@/lib/saraban-store';

// GET   /api/admin/saraban/me/docs/[id] — { doc, actions, units } · ตำแหน่งไม่เคยเกี่ยว → 404 ไม่ใช่ 403
//       (ไม่บอกว่ามีหนังสือเรื่องนี้อยู่ — สเปกรอบ 3 ข้อ 3)
// PATCH /api/admin/saraban/me/docs/[id] — เจ้าตัวเกษียน/ทราบเอง ใช้ transition ของรอบ 2 ตัวเดิม
//       ต่างจาก route โหมดเต็มแค่ "ทำในนามตำแหน่งที่ตัวเองถือเท่านั้น" → 403 not_holder
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const member = await requireSarabanMember(req, res);
  if (!member) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const current = await getDoc(id);
    if (!current || !canSeeDoc(current, member.unitIds)) return res.status(404).json({ error: 'not_found' });

    if (req.method === 'GET') {
      return res.status(200).json({
        doc: current,
        actions: memberActions(current, member.unitIds),
        // ชิปปลายทาง — ไม่ส่ง memberClerkIds ออกไปให้เจ้าหน้าที่
        units: member.units.filter((u) => u.isActive).map(({ id: unitId, name, dept }) => ({ id: unitId, name, dept })),
      });
    }

    const parsed = memberPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    }
    const patch = parsed.data;
    if (current.updatedAt !== patch.updatedAt) return res.status(409).json({ error: 'stale' });

    const actingUnit = patch.action === 'annotate' ? current.holderUnitId : patch.unitId;
    if (!member.unitIds.includes(actingUnit)) return res.status(403).json({ error: 'not_holder' });

    // เวลา/eventId สร้างครั้งเดียวแบบ route โหมดเต็ม — ใช้ทั้งใน transition และ event
    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();
    const actor = await resolveActor(member.admin);
    const result =
      patch.action === 'annotate'
        ? annotateTransition(current, patch, member.units, { now, eventId })
        : ackTransition(current, patch.unitId, { now, actor });
    if (!result.ok) {
      const body =
        result.error === 'invalid_transition'
          ? { error: result.error, action: patch.action, status: current.status }
          : { error: result.error, ...('unitId' in result ? { unitId: result.unitId } : {}) };
      return res.status(FLOW_ERROR_STATUS[result.error]).json(body);
    }

    const event = makeEvent({
      id: eventId,
      at: now,
      actor,
      kind: patch.action === 'annotate' ? 'annotated' : 'acknowledged',
      note: result.note,
      detail: result.detail,
    });
    const updated = await applyPatch(id, patch.updatedAt, result.set, event);
    if (updated) return res.status(200).json(updated);
    return (await getDoc(id))
      ? res.status(409).json({ error: 'stale' })
      : res.status(404).json({ error: 'not_found' });
  } catch (err) {
    console.error(`${req.method} /api/admin/saraban/me/docs/[id] failed`, err);
    return res.status(500).json({ error: 'server_error' });
  }
}
```

- [ ] **Step 2: `me/docs/[id]/files/[fileId].ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { CONTENT_TYPES } from '@/lib/saraban-attachment';
import { canSeeDoc } from '@/lib/saraban-member';
import { requireSarabanMember } from '@/lib/saraban-member-guard';
import { isStorageConfigured, viewUrl } from '@/lib/saraban-storage';
import { getDoc } from '@/lib/saraban-store';

// GET /api/admin/saraban/me/docs/[id]/files/[fileId] — เปิดไฟล์ด้วยเงื่อนไขเห็นเดียวกับตัวหนังสือ
// แล้ว 302 ไปลิงก์ชั่วคราว (แนวเดียวกับ route โหมดเต็ม) · ไม่มี DELETE — ไฟล์เป็นงานของธุรการ
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const member = await requireSarabanMember(req, res);
  if (!member) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const fileId = typeof req.query.fileId === 'string' ? req.query.fileId : '';
  if (!id || !fileId) return res.status(400).json({ error: 'missing_id' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isStorageConfigured()) return res.status(503).json({ error: 'storage_not_configured' });

  try {
    const doc = await getDoc(id);
    const file = doc && canSeeDoc(doc, member.unitIds) ? doc.files.find((f) => f.id === fileId) : undefined;
    if (!file) return res.status(404).json({ error: 'not_found' });
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, await viewUrl(file.key, file.name, CONTENT_TYPES[file.format]));
  } catch (err) {
    console.error('GET /api/admin/saraban/me/docs/[id]/files/[fileId] failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
```

- [ ] **Step 3: ตรวจ**

Run: `npx tsc --noEmit && npm run lint`
Expected: สะอาด

- [ ] **Step 4: Commit**

```bash
git add "src/pages/api/admin/saraban/me/docs/[id]"
git commit -m "feat(saraban): API เจ้าตัวเกษียน ส่งต่อ ทราบ และเปิดไฟล์ของหนังสือที่เกี่ยว

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: API ผูกคน + เปิดเทสต์ guard coverage

**Files:**
- Create: `src/pages/api/admin/saraban/units/[id]/members.ts`
- Commit: `src/lib/api-guard-coverage.test.ts` (แก้ไว้แล้วใน Task 4 Step 1)

- [ ] **Step 1: `units/[id]/members.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireManager } from '@/lib/auth-server';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { activeRegistryFilter } from '@/lib/registry-user';
import { unitMembersSchema } from '@/lib/saraban-schema';
import { setUnitMembers } from '@/lib/saraban-units-store';

// PUT /api/admin/saraban/units/[id]/members — ผูกคนเข้าตำแหน่ง (สเปกรอบ 3 ข้อ 2) ผู้จัดการเท่านั้น
// เพราะผูกคน = ให้สิทธิ์เห็นหนังสือของตำแหน่งนั้น · แยกจาก PATCH units/[id] ที่ธุรการใช้แก้ชื่อ/รหัส
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireManager(req, res);
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const parsed = unitMembersSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  }
  const { clerkIds } = parsed.data;

  try {
    // ทุกคนต้องเป็นสมาชิก active ในทะเบียน · ไม่มีทะเบียน (dev / แบ็กเอนด์ไฟล์) ข้ามการตรวจ
    // แนวเดียวกับ checkAdmin ที่ข้ามทะเบียนใน dev
    if (isMongoConfigured() && clerkIds.length > 0) {
      const users = (await getUsersDb()).collection('users');
      const found = await Promise.all(
        clerkIds.map((clerkId) => users.countDocuments(activeRegistryFilter(clerkId), { limit: 1 }))
      );
      if (found.some((n) => n === 0)) return res.status(400).json({ error: 'invalid_member' });
    }
    const unit = await setUnitMembers(id, clerkIds);
    return unit ? res.status(200).json(unit) : res.status(404).json({ error: 'not_found' });
  } catch (err) {
    console.error('PUT /api/admin/saraban/units/[id]/members failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
```

- [ ] **Step 2: รันเทสต์ guard coverage ที่รอไว้**

Run: `npx vitest run src/lib/api-guard-coverage.test.ts`
Expected: PASS — รวมเคสใหม่ของ `saraban/me/*` 4 ไฟล์ และ `members.ts`

- [ ] **Step 3: ทั้งชุด**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: ผ่านทั้งหมด

- [ ] **Step 4: Commit**

```bash
git add "src/pages/api/admin/saraban/units/[id]/members.ts" src/lib/api-guard-coverage.test.ts
git commit -m "feat(saraban): API ผูกคนเข้าตำแหน่ง (ผู้จัดการ) และตรึง guard ของ route โหมดเจ้าหน้าที่

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: ตัวเรียก API ฝั่งเบราว์เซอร์

**Files:**
- Modify: `src/lib/saraban-api.ts`

- [ ] **Step 1: เพิ่มใน `saraban-api.ts`** (import `MemberActions`, `MemberTab` เป็น type จาก `@/lib/saraban-member` และ `memberDocKey` จาก `@/lib/saraban-view`)

```ts
// ---- โหมดเจ้าหน้าที่ (สเปกรอบ 3) — ทุกคำขอต่อ ?as= ของ dev-open ผ่าน withAs ในตัวสร้างคีย์ ----

export type UnitRef = { id: string; name: string; dept?: string };
export type MemberSummary = { units: UnitRef[]; canReceive: boolean; counts: Record<MemberTab, number> };
export type MemberDocsResponse = { items: SarabanDoc[]; total: number; page: number; pageSize: number };
export type MemberDocResponse = { doc: SarabanDoc; actions: MemberActions; units: UnitRef[] };

type MemberBody = Extract<z.input<typeof memberPatchSchema>, { action: 'annotate' }>;

export function memberAnnotate(
  doc: Pick<SarabanDoc, 'id' | 'updatedAt'>,
  body: Omit<MemberBody, 'action' | 'updatedAt'>,
  as: string | undefined
): Promise<SarabanDoc> {
  return call(memberDocKey(doc.id, as), jsonInit('PATCH', { action: 'annotate', updatedAt: doc.updatedAt, ...body }));
}

export function memberAck(doc: Pick<SarabanDoc, 'id' | 'updatedAt'>, unitId: string, as: string | undefined): Promise<SarabanDoc> {
  return call(memberDocKey(doc.id, as), jsonInit('PATCH', { action: 'ack', updatedAt: doc.updatedAt, unitId }));
}

export function setUnitMembers(id: string, clerkIds: string[]): Promise<SarabanUnit> {
  return call(`${UNITS_KEY}/${encodeURIComponent(id)}/members`, jsonInit('PUT', { clerkIds }));
}
```

และเพิ่ม `memberPatchSchema` ในรายการ `import type { … } from '@/lib/saraban-schema'`

- [ ] **Step 2: ตรวจ + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/lib/saraban-api.ts
git commit -m "feat(saraban): ตัวเรียก API โหมดเจ้าหน้าที่และผูกคน

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: หน้า "งานของฉัน" — `MemberShell` · `MemberDocCard` · `/saraban/me`

**Files:**
- Create: `src/components/saraban/MemberShell.tsx`
- Create: `src/components/saraban/MemberDocCard.tsx`
- Create: `src/pages/saraban/me/index.tsx`

- [ ] **Step 1: `MemberShell.tsx`**

```tsx
// shell ของโหมดเจ้าหน้าที่ (ต้นแบบ "โหมดเจ้าหน้าที่") — จอเดียวกว้างไม่เกิน 720px ไม่มี sidebar
// ปุ่มหลักอยู่ bottom bar ของแต่ละหน้า (ส่งเข้ามาทาง bottom)
import Head from 'next/head';
import Link from 'next/link';
import type { ReactNode } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import { Toaster } from '@/components/saraban/toast';
import { adminFetcher } from '@/lib/admin-api';
import { isClerkPublicConfigured } from '@/lib/clerk-config';
import { sarabanFont } from '@/lib/saraban-font';

export default function MemberShell({
  title,
  subtitle,
  canFull,
  back,
  bottom,
  children,
}: {
  title: string;
  subtitle?: string; // ชื่อตำแหน่ง
  canFull: boolean; // มีสิทธิ์ saraban → โชว์ปุ่ม "โหมดเต็ม"
  back?: string; // href ปุ่มย้อน (หน้าหนังสือ)
  bottom?: ReactNode;
  children: ReactNode;
}) {
  const clerkOn = isClerkPublicConfigured();
  const { data: me } = useSWR<{ name: string | null; email: string | null }>(
    clerkOn ? '/api/admin/me' : null,
    adminFetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const who = me?.name ?? me?.email ?? (clerkOn ? '' : 'โหมดทดสอบ (dev-open)');

  return (
    <>
      <Head>
        <title>{`${title} · ระบบสารบรรณ`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className={`saraban ${sarabanFont.className} min-h-screen bg-[#F7F9FB] text-sb-ink antialiased`}>
        <div className="mx-auto flex min-h-screen max-w-[720px] flex-col">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-sb-line bg-white px-4 py-3">
            {back ? (
              <Link href={back} aria-label="ย้อนกลับ" className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-sb-muted hover:bg-sb-hover">
                <Icon name="arrow_back" size={22} />
              </Link>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- ตราเล็กไฟล์เดียว
              <img src="/saraban/logo.jpeg" alt="ตราเทศบาล" className="h-9 w-9 flex-none rounded-full object-cover" />
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <h1 className="truncate text-base font-bold">{title}</h1>
              <p className="truncate text-xs text-sb-muted">{[who, subtitle].filter(Boolean).join(' · ')}</p>
            </div>
            {canFull ? (
              <Link href="/saraban/inbox" className="inline-flex h-11 flex-none items-center rounded-xl border border-sb-line px-3 text-sm font-semibold text-sb-ink-2 hover:bg-sb-hover">
                โหมดเต็ม
              </Link>
            ) : null}
          </header>
          <main className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-4">{children}</main>
          {bottom ? (
            <div className="sticky bottom-0 border-t border-sb-line bg-white/85 px-4 py-3 backdrop-blur">{bottom}</div>
          ) : null}
        </div>
      </div>
      <Toaster />
    </>
  );
}
```

- [ ] **Step 2: `MemberDocCard.tsx`**

```tsx
// การ์ดหนังสือของงานของฉัน (ต้นแบบ A) — แตะการ์ด = เปิดหน้าหนังสือ · ปุ่มลัดทำได้ทันทีไม่ต้องเข้า
import Link from 'next/link';
import Icon from '@/components/Icon';
import { LevelText, StatusPill } from '@/components/saraban/bits';
import type { MemberActions } from '@/lib/saraban-member';
import { thaiDate } from '@/lib/saraban-view';
import type { SarabanDoc } from '@/types/saraban';

export default function MemberDocCard({
  doc,
  href,
  actions,
  busy,
  onQuickClose,
  onQuickAck,
}: {
  doc: SarabanDoc;
  href: string;
  actions: MemberActions | null; // null = แท็บที่ไม่มีปุ่มลัด
  busy: boolean;
  onQuickClose: () => void;
  onQuickAck: (unitId: string) => void;
}) {
  const ackUnit = actions?.ackUnitIds[0];
  return (
    <article className="rounded-2xl border border-sb-line bg-white p-4">
      <Link href={href} className="block">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sb-muted">
          <span className="font-semibold text-sb-ink-2">รับที่ {doc.no}</span>
          <span>{thaiDate(doc.docDate)}</span>
          {doc.level !== 'normal' ? <LevelText level={doc.level} /> : null}
          <span className="flex-1" />
          <StatusPill register={doc.register} status={doc.status} />
        </div>
        <h2 className="mt-1.5 text-[15px] font-semibold leading-snug">{doc.subject}</h2>
        <p className="mt-0.5 text-[13px] text-sb-muted">จาก {doc.party}</p>
      </Link>
      {actions && (actions.annotateAs || ackUnit) ? (
        <div className="mt-3 flex gap-2">
          {actions.annotateAs ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onQuickClose}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-sb-success text-sm font-semibold text-sb-success hover:bg-[#F1F5FA] disabled:opacity-50"
              >
                <Icon name="check" size={18} />
                ทราบ · จบเรื่อง
              </button>
              <Link
                href={href}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-sb-accent text-sm font-semibold text-white hover:bg-sb-accent-hover"
              >
                <Icon name="arrow_forward" size={18} />
                สั่งการ / ส่งต่อ
              </Link>
            </>
          ) : ackUnit ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onQuickAck(ackUnit)}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-sb-success text-sm font-semibold text-sb-success hover:bg-[#F1F5FA] disabled:opacity-50"
            >
              <Icon name="check" size={18} />
              ทราบ (แจ้งเวียน)
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 3: `src/pages/saraban/me/index.tsx`**

```tsx
// งานของฉัน (สเปกรอบ 3 ข้อ 4 · ต้นแบบ A) — หนังสือที่ตำแหน่งของฉันเกี่ยว แยก 3 แท็บ
// dev-open: ยังไม่ได้เลือกตำแหน่ง (ไม่มี ?as=) → เลือกตำแหน่งที่จะสวมก่อน
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import useSWRInfinite from 'swr/infinite';
import MemberDocCard from '@/components/saraban/MemberDocCard';
import MemberShell from '@/components/saraban/MemberShell';
import { showToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getSarabanMemberSsrProps } from '@/lib/auth-server';
import { isClerkPublicConfigured } from '@/lib/clerk-config';
import {
  memberAck,
  memberAnnotate,
  messageOf,
  sarabanFetcher,
  SarabanApiError,
  UNITS_KEY,
  type MemberDocsResponse,
  type MemberSummary,
} from '@/lib/saraban-api';
import { MEMBER_TABS, memberActions, type MemberTab } from '@/lib/saraban-member';
import { errorMessage, memberDocsKey, memberSummaryKey, withAs } from '@/lib/saraban-view';
import type { SarabanDoc, SarabanUnit } from '@/types/saraban';

const TAB_LABELS: Record<MemberTab, string> = { todo: 'รอฉันทำ', forwarded: 'ส่งต่อแล้ว', done: 'จบเรื่อง' };
const EMPTY: Record<MemberTab, string> = {
  todo: 'ไม่มีหนังสือรอคุณ',
  forwarded: 'ยังไม่มีเรื่องที่ส่งต่อไป',
  done: 'ยังไม่มีเรื่องที่จบ',
};

function MyWorkPage() {
  const router = useRouter();
  const as = typeof router.query.as === 'string' ? router.query.as : undefined;
  const tab: MemberTab = MEMBER_TABS.find((t) => t === router.query.tab) ?? 'todo';
  const { mutate: globalMutate } = useSWRConfig();
  const [busyId, setBusyId] = useState('');

  const { data: summary, error: summaryError } = useSWR<MemberSummary>(memberSummaryKey(as), sarabanFetcher, {
    shouldRetryOnError: false,
  });
  const notMember = summaryError instanceof SarabanApiError && summaryError.code === 'not_member';
  const list = useSWRInfinite<MemberDocsResponse>(
    (index) => (summary ? memberDocsKey({ tab, page: index + 1, as }) : null),
    sarabanFetcher
  );
  const docs = list.data?.flatMap((p) => p.items) ?? [];
  const total = list.data?.[0]?.total ?? 0;
  const unitIds = summary?.units.map((u) => u.id) ?? [];

  const refresh = () => {
    void globalMutate((k) => typeof k === 'string' && k.startsWith('/api/admin/saraban/me'));
    void list.mutate();
  };

  async function run(doc: SarabanDoc, action: () => Promise<unknown>, done: string) {
    setBusyId(doc.id);
    try {
      await action();
      showToast(done);
    } catch (err) {
      showToast(messageOf(err));
    } finally {
      setBusyId('');
      refresh();
    }
  }

  const tabHref = (t: MemberTab) => withAs(`/saraban/me?tab=${t}`, as);
  const docHref = (id: string) => withAs(`/saraban/me/doc/${encodeURIComponent(id)}`, as);

  if (notMember) {
    return (
      <MemberShell title="งานของฉัน" canFull>
        {isClerkPublicConfigured() ? (
          <p className="rounded-2xl border border-sb-line bg-white p-6 text-center text-sm text-sb-muted">{errorMessage('not_member')}</p>
        ) : (
          <DevUnitPicker />
        )}
      </MemberShell>
    );
  }

  return (
    <MemberShell
      title="งานของฉัน"
      subtitle={summary?.units.map((u) => u.name).join(' · ')}
      canFull={summary?.canReceive ?? false}
      bottom={
        summary?.canReceive ? (
          <Link href="/saraban/receive" className="flex h-[52px] items-center justify-center rounded-xl bg-sb-success text-base font-semibold text-white">
            + ลงรับหนังสือใหม่
          </Link>
        ) : undefined
      }
    >
      <div role="tablist" aria-label="แท็บงาน" className="grid grid-cols-3 gap-2">
        {MEMBER_TABS.map((t) => (
          <Link
            key={t}
            role="tab"
            aria-selected={t === tab}
            href={tabHref(t)}
            replace
            className={`flex min-h-[64px] flex-col items-center justify-center rounded-2xl border px-2 py-2 ${
              t === tab ? 'border-[#1B2430] bg-white' : 'border-sb-line bg-white/60 text-sb-muted'
            }`}
          >
            <span className={`text-[22px] font-bold leading-none ${t === tab ? 'text-[#1B2430]' : ''}`}>{summary?.counts[t] ?? '–'}</span>
            <span className="mt-1 text-xs font-semibold">{TAB_LABELS[t]}</span>
          </Link>
        ))}
      </div>

      {summaryError && !notMember ? <p className="text-center text-sm text-sb-danger">{messageOf(summaryError)}</p> : null}
      {list.data && docs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sb-line p-8 text-center text-sm text-sb-muted">{EMPTY[tab]}</p>
      ) : null}
      {docs.map((doc) => (
        <MemberDocCard
          key={doc.id}
          doc={doc}
          href={docHref(doc.id)}
          actions={tab === 'todo' ? memberActions(doc, unitIds) : null}
          busy={busyId === doc.id}
          onQuickClose={() => {
            if (!confirm('ทราบและจบเรื่อง — จบแล้วเปิดกลับไม่ได้ ยืนยัน?')) return;
            void run(doc, () => memberAnnotate(doc, { note: 'ทราบ', route: { kind: 'close' } }, as), 'จบเรื่องแล้ว');
          }}
          onQuickAck={(unitId) => void run(doc, () => memberAck(doc, unitId, as), 'บันทึกว่าทราบแล้ว')}
        />
      ))}
      {docs.length < total ? (
        <button type="button" onClick={() => void list.setSize(list.size + 1)} className="h-11 rounded-xl border border-sb-line bg-white text-sm font-semibold text-sb-ink-2">
          โหลดเพิ่ม
        </button>
      ) : null}
    </MemberShell>
  );
}

/** dev-open เท่านั้น — ทุกคนคือผู้ใช้คนเดียว เลือกตำแหน่งที่จะสวมเพื่อทดสอบ (สเปกรอบ 3 ข้อ 2) */
function DevUnitPicker() {
  const { data: units } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  return (
    <div className="rounded-2xl border border-sb-line bg-white p-4">
      <p className="mb-3 text-sm text-sb-muted">โหมดทดสอบ (dev-open): เลือกตำแหน่งที่จะสวม</p>
      <div className="flex flex-wrap gap-2">
        {(units ?? []).filter((u) => u.isActive).map((u) => (
          <Link key={u.id} href={`/saraban/me?as=${encodeURIComponent(u.id)}`} className="inline-flex h-10 items-center rounded-full border border-sb-line px-4 text-sm hover:bg-sb-hover">
            {u.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

export const getServerSideProps = getSarabanMemberSsrProps;
export default withMemberGuard(MyWorkPage);
```

ถ้า `withMemberGuard`/`StatusPill` ต้องการ props ต่างจากนี้ ให้ดูการใช้งานใน `src/pages/saraban/units.tsx` และ `RegisterPage.tsx` แล้วทำตาม · `StatusPill` รับ `DisplayStatus` — `SarabanStatus` เป็นส่วนหนึ่งของมันอยู่แล้ว

- [ ] **Step 4: ตรวจ**

Run: `npx tsc --noEmit && npm run lint`
Expected: สะอาด

- [ ] **Step 5: Commit**

```bash
git add src/components/saraban/MemberShell.tsx src/components/saraban/MemberDocCard.tsx src/pages/saraban/me/index.tsx
git commit -m "feat(saraban): หน้างานของฉัน — 3 แท็บ การ์ดหนังสือ และปุ่มทราบ/จบเรื่องทันที

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: หน้าหนังสือของเจ้าตัว — `MemberActionForm` · `/saraban/me/doc/[id]`

**Files:**
- Create: `src/components/saraban/MemberActionForm.tsx`
- Create: `src/pages/saraban/me/doc/[id].tsx`

- [ ] **Step 1: `MemberActionForm.tsx`**

```tsx
// การ์ดดำเนินการของหน้าหนังสือ (ต้นแบบ B) — 1. ทำอะไร → 2. ส่งถึงใคร → 3. ข้อความ → สรุป
// ตัดสินจริงที่เซิร์ฟเวอร์ (annotateTransition) ฟอร์มแค่ไม่ให้เลือกสิ่งที่รู้ว่าผิดแน่
import { useState } from 'react';
import Icon from '@/components/Icon';
import type { AnnotateSubmit } from '@/components/saraban/AnnotateForm';
import type { UnitRef } from '@/lib/saraban-api';
import { MAX_CIRCULATE } from '@/lib/saraban-flow';
import { QUICK_NOTES } from '@/lib/saraban-labels';
import type { SarabanDoc } from '@/types/saraban';

type Choice = 'close' | 'forward' | 'circulate';

const CHOICES: { key: Choice; label: string; tone: string }[] = [
  { key: 'close', label: 'ทราบ · จบเรื่อง', tone: 'border-sb-success text-sb-success' },
  { key: 'forward', label: 'ส่งต่อ / สั่งการ', tone: 'border-sb-accent text-sb-accent' },
  { key: 'circulate', label: 'แจ้งเวียน', tone: 'border-[#8A5A00] text-[#8A5A00]' },
];

export default function MemberActionForm({
  doc,
  units,
  busy,
  onSubmit,
}: {
  doc: SarabanDoc;
  units: UnitRef[]; // ตำแหน่งที่เปิดใช้
  busy: boolean;
  onSubmit: (body: AnnotateSubmit) => void;
}) {
  const [choice, setChoice] = useState<Choice>('forward');
  const [rawTo, setTo] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');

  const already = new Set(doc.circulation.map((c) => c.unitId));
  const targets = units.filter((u) => u.id !== doc.holderUnitId);
  const circulatable = units.filter((u) => !already.has(u.id));
  // refetch แล้วตัวเลือกเดิมอาจใช้ไม่ได้ — คิดใหม่จากข้อมูลปัจจุบันทุกครั้ง (บทเรียน AnnotateForm รอบ 2)
  const to = targets.some((u) => u.id === rawTo) ? rawTo : '';
  const circulateTo = choice === 'circulate' ? [...picked].filter((id) => circulatable.some((u) => u.id === id)) : [];
  const tooMany = circulateTo.length > MAX_CIRCULATE;

  const nameOf = (id: string) => units.find((u) => u.id === id)?.name ?? id;
  const summary =
    choice === 'close'
      ? 'จะจบเรื่องและส่งคืนสารบรรณ — เปิดกลับไม่ได้'
      : choice === 'forward'
        ? to
          ? `หนังสือจะไปอยู่ที่ ${nameOf(to)}`
          : 'เลือกตำแหน่งที่จะส่งต่อ'
        : circulateTo.length
          ? `เวียนให้ทราบ ${circulateTo.length} ตำแหน่ง · หนังสือยังอยู่กับคุณ`
          : 'เลือกตำแหน่งที่จะแจ้งเวียน';
  const submitLabel = choice === 'close' ? 'ยืนยันทราบและจบเรื่อง' : choice === 'forward' ? 'ยืนยันส่งต่อ' : 'ยืนยันแจ้งเวียน';
  const blocked =
    busy || !note.trim() || (choice === 'forward' && !to) || (choice === 'circulate' && circulateTo.length === 0) || tooMany;

  function submit() {
    if (blocked) return;
    if (choice === 'close' && !confirm('จบเรื่องแล้วเปิดกลับไม่ได้ ยืนยัน?')) return;
    onSubmit({
      note: note.trim(),
      route: choice === 'close' ? { kind: 'close' } : choice === 'forward' ? { kind: 'forward', toUnitId: to } : { kind: 'stay' },
      circulateTo,
    });
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const chip = (on: boolean) =>
    `inline-flex h-10 items-center rounded-full border px-4 text-sm ${on ? 'border-sb-accent bg-sb-accent-light font-semibold text-sb-accent' : 'border-sb-line bg-white'}`;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-sb-line bg-white p-4" aria-label="ดำเนินการ">
      <div>
        <p className="mb-2 text-sm font-semibold">1. ต้องการทำอะไร</p>
        <div className="grid grid-cols-3 gap-2">
          {CHOICES.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={choice === c.key}
              onClick={() => setChoice(c.key)}
              className={`h-12 rounded-xl border text-sm font-semibold ${choice === c.key ? `${c.tone} bg-[#F5F7FA]` : 'border-sb-line text-sb-ink-2'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {choice !== 'close' ? (
        <div>
          <p className="mb-2 text-sm font-semibold">2. ส่งถึงใคร</p>
          <div role="group" aria-label="ตำแหน่งปลายทาง" className="flex flex-wrap gap-2">
            {choice === 'forward'
              ? targets.map((u) => (
                  <button key={u.id} type="button" aria-pressed={to === u.id} onClick={() => setTo(u.id)} className={chip(to === u.id)}>
                    {u.name}
                  </button>
                ))
              : units.map((u) => {
                  const sent = already.has(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={sent}
                      aria-pressed={sent || picked.has(u.id)}
                      onClick={() => togglePick(u.id)}
                      className={`${chip(picked.has(u.id))} ${sent ? 'opacity-50' : ''}`}
                    >
                      {u.name}
                      {sent ? ' (เวียนแล้ว)' : ''}
                    </button>
                  );
                })}
          </div>
          {tooMany ? <p className="mt-2 text-xs text-sb-danger">เวียนได้ไม่เกิน {MAX_CIRCULATE} ตำแหน่งต่อครั้ง</p> : null}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-semibold">{choice === 'close' ? '2' : '3'}. ข้อความ</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_NOTES.map((q) => (
            <button
              key={q}
              type="button"
              className="inline-flex h-9 items-center rounded-full border border-sb-line px-3 text-xs hover:bg-sb-hover"
              onClick={() => setNote((note.trim() ? `${note.trim()} ${q}` : q).slice(0, 1000))}
            >
              {q}
            </button>
          ))}
        </div>
        <textarea
          aria-label="ข้อความเกษียน/สั่งการ"
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-sb-line-input px-3 py-2 text-[15px]"
        />
      </div>

      <p aria-live="polite" className="rounded-xl bg-sb-panel px-3 py-2 text-[13px]">{summary}</p>

      <button
        type="button"
        disabled={blocked}
        onClick={submit}
        className="sticky bottom-3 flex h-[52px] items-center justify-center gap-1.5 rounded-xl bg-sb-success text-base font-semibold text-white shadow-sm disabled:opacity-50"
      >
        <Icon name={choice === 'forward' ? 'arrow_forward' : choice === 'circulate' ? 'campaign' : 'check'} size={20} />
        {submitLabel}
      </button>
    </section>
  );
}
```

- [ ] **Step 2: `src/pages/saraban/me/doc/[id].tsx`**

```tsx
// หน้าหนังสือของเจ้าตัว (สเปกรอบ 3 ข้อ 4 · ต้นแบบ B) — ดู · ประวัติย่อ · ดำเนินการในจอเดียว
import { useRouter } from 'next/router';
import { useState } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import type { AnnotateSubmit } from '@/components/saraban/AnnotateForm';
import EventDetail, { eventByline } from '@/components/saraban/EventDetail';
import MemberActionForm from '@/components/saraban/MemberActionForm';
import MemberShell from '@/components/saraban/MemberShell';
import { LevelText, StatusPill } from '@/components/saraban/bits';
import { showToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getSarabanMemberSsrProps } from '@/lib/auth-server';
import {
  memberAck,
  memberAnnotate,
  messageOf,
  sarabanFetcher,
  SarabanApiError,
  type MemberDocResponse,
} from '@/lib/saraban-api';
import { EVENT_KIND_LABELS } from '@/lib/saraban-labels';
import { memberDocKey, memberFileUrl, thaiDate, thaiDateTime, withAs } from '@/lib/saraban-view';

function MemberDocPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const as = typeof router.query.as === 'string' ? router.query.as : undefined;
  const home = withAs('/saraban/me', as);
  const { data, error, mutate } = useSWR<MemberDocResponse>(id ? memberDocKey(id, as) : null, sarabanFetcher, {
    shouldRetryOnError: false,
  });
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      showToast(done);
      await router.push(home);
    } catch (err) {
      showToast(messageOf(err));
      // not_holder / stale: หนังสือเปลี่ยนไปแล้ว โหลดใหม่ การ์ดดำเนินการจะหายเองถ้าไม่ใช่ของเราแล้ว
      if (err instanceof SarabanApiError) void mutate();
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <MemberShell title="หนังสือ" canFull={false} back={home}>
        <p className="rounded-2xl border border-sb-line bg-white p-6 text-center text-sm text-sb-muted">{messageOf(error)}</p>
      </MemberShell>
    );
  }
  if (!data) {
    return (
      <MemberShell title="หนังสือ" canFull={false} back={home}>
        <p className="p-6 text-center text-sm text-sb-muted">กำลังโหลด…</p>
      </MemberShell>
    );
  }

  const { doc, actions, units } = data;
  const holderName = units.find((u) => u.id === doc.holderUnitId)?.name ?? doc.holderUnitId;
  const events = [...doc.events].reverse();

  return (
    <MemberShell title={`รับที่ ${doc.no}`} canFull={false} back={home}>
      <section className="rounded-2xl border border-sb-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-sb-muted">
          <span>{doc.ref}</span>
          <span>{thaiDate(doc.docDate)}</span>
          {doc.level !== 'normal' ? <LevelText level={doc.level} /> : null}
          <span className="flex-1" />
          <StatusPill register={doc.register} status={doc.status} />
        </div>
        <h2 className="mt-1.5 text-[17px] font-semibold leading-snug">{doc.subject}</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-sb-muted">จาก</dt>
          <dd>{doc.party}</dd>
          <dt className="text-sb-muted">อยู่กับ</dt>
          <dd>{holderName}</dd>
          {doc.dueDate ? (
            <>
              <dt className="text-sb-muted">กำหนดแล้วเสร็จ</dt>
              <dd>{thaiDate(doc.dueDate)}</dd>
            </>
          ) : null}
        </dl>
        {doc.files.length ? (
          <div className="mt-3 flex flex-col gap-1.5">
            {doc.files.map((f) => (
              <a
                key={f.id}
                href={memberFileUrl(doc.id, f.id, as)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-2 rounded-xl border border-sb-line px-3 text-sm hover:bg-sb-hover"
              >
                <Icon name="attach_file" size={18} />
                <span className="truncate">{f.name}</span>
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-sb-line bg-white p-4" aria-label="ที่ผ่านมา">
        <h3 className="mb-2 text-sm font-semibold">ที่ผ่านมา</h3>
        <ol className="flex flex-col gap-3">
          {events.map((e) => (
            <li key={e.id} className="border-l-2 border-[#C9E3D5] pl-3">
              <p className="text-xs text-sb-muted">
                {thaiDateTime(e.at)} · {eventByline(e)}
              </p>
              <p className="text-[13px] font-semibold">{EVENT_KIND_LABELS[e.kind]}</p>
              {e.note ? <p className="text-[13px]">{e.note}</p> : null}
              <EventDetail event={e} />
            </li>
          ))}
        </ol>
      </section>

      {actions.annotateAs ? (
        <MemberActionForm
          doc={doc}
          units={units}
          busy={busy}
          onSubmit={(body: AnnotateSubmit) =>
            void run(
              () => memberAnnotate(doc, body, as),
              body.route.kind === 'close' ? 'จบเรื่องแล้ว' : body.route.kind === 'forward' ? 'ส่งต่อแล้ว' : 'แจ้งเวียนแล้ว'
            )
          }
        />
      ) : null}

      {actions.ackUnitIds.map((unitId) => (
        <button
          key={unitId}
          type="button"
          disabled={busy}
          onClick={() => void run(() => memberAck(doc, unitId, as), 'บันทึกว่าทราบแล้ว')}
          className="flex h-[52px] items-center justify-center gap-1.5 rounded-xl bg-sb-success text-base font-semibold text-white disabled:opacity-50"
        >
          <Icon name="check" size={20} />
          ทราบ (แจ้งเวียนถึง {doc.circulation.find((c) => c.unitId === unitId)?.unitName ?? unitId})
        </button>
      ))}
    </MemberShell>
  );
}

export const getServerSideProps = getSarabanMemberSsrProps;
export default withMemberGuard(MemberDocPage);
```

- [ ] **Step 3: ตรวจ**

Run: `npx tsc --noEmit && npm run lint`
Expected: สะอาด

- [ ] **Step 4: Commit**

```bash
git add src/components/saraban/MemberActionForm.tsx "src/pages/saraban/me/doc/[id].tsx"
git commit -m "feat(saraban): หน้าหนังสือของเจ้าตัว — ทราบ/จบเรื่อง ส่งต่อ แจ้งเวียน ในจอเดียว

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: สมุดผู้รับผูกคน + ปุ่ม "งานของฉัน" ใน shell โหมดเต็ม

**Files:**
- Create: `src/components/saraban/UnitMembersPanel.tsx`
- Modify: `src/pages/saraban/units.tsx`
- Modify: `src/components/saraban/SarabanLayout.tsx` (header ก่อนปุ่ม "ลงรับหนังสือ")

- [ ] **Step 1: `UnitMembersPanel.tsx`**

```tsx
// แผงผูกคนเข้าตำแหน่ง (สเปกรอบ 3 ข้อ 4) — ผู้จัดการเท่านั้น · รายชื่อจากทะเบียนสมาชิกที่ active และมี clerkId
import { useState } from 'react';
import { outlineButton, primaryButton } from '@/components/saraban/bits';
import { showToast } from '@/components/saraban/toast';
import { messageOf, setUnitMembers } from '@/lib/saraban-api';
import { MAX_UNIT_MEMBERS } from '@/lib/saraban-schema';
import type { SarabanUnit } from '@/types/saraban';

export type MemberOption = { clerkId: string; name: string; position: string };

export default function UnitMembersPanel({
  unit,
  options,
  onClose,
  onSaved,
}: {
  unit: SarabanUnit;
  options: MemberOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(unit.memberClerkIds));
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const q = query.trim();
  const shown = q ? options.filter((o) => `${o.name} ${o.position}`.includes(q)) : options;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    try {
      await setUnitMembers(unit.id, [...picked]);
      showToast('บันทึกผู้ถือตำแหน่งแล้ว');
      onSaved();
      onClose();
    } catch (err) {
      showToast(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-sb-line bg-[#FAFBFD] p-3">
      <input
        aria-label="ค้นหาชื่อ"
        placeholder="ค้นหาชื่อหรือตำแหน่ง"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-10 rounded-lg border border-sb-line-input px-3 text-sm"
      />
      <div role="group" aria-label={`ผู้ถือตำแหน่ง ${unit.name}`} className="grid max-h-64 gap-1 overflow-y-auto [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        {shown.map((o) => (
          <label key={o.clerkId} className="flex min-h-11 items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white">
            <input type="checkbox" className="mt-0.5" checked={picked.has(o.clerkId)} onChange={() => toggle(o.clerkId)} />
            <span>
              {o.name || o.clerkId}
              <span className="block text-[11px] text-sb-muted">{o.position}</span>
            </span>
          </label>
        ))}
      </div>
      {picked.size > MAX_UNIT_MEMBERS ? <p className="text-xs text-sb-danger">ผูกได้ไม่เกิน {MAX_UNIT_MEMBERS} คนต่อตำแหน่ง</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" className={outlineButton} disabled={busy} onClick={onClose}>
          ยกเลิก
        </button>
        <button type="button" className={primaryButton} disabled={busy || picked.size > MAX_UNIT_MEMBERS} onClick={() => void save()}>
          บันทึก ({picked.size} คน)
        </button>
      </div>
    </div>
  );
}
```

หมายเหตุ: `saraban-schema.ts` import zod — ใช้ใน client ได้อยู่แล้ว (`saraban-api.ts` import type จากมัน และฟอร์มรอบ 1 ใช้ schema ตรง) ถ้าไม่อยาก import ค่าจาก schema ฝั่ง client ให้ย้าย `MAX_UNIT_MEMBERS` ไปไว้ `saraban-member.ts` แล้ว schema import จากที่นั่น

- [ ] **Step 2: แก้ `units.tsx`**

import เพิ่ม:

```tsx
import UnitMembersPanel, { type MemberOption } from '@/components/saraban/UnitMembersPanel';
import { adminFetcher } from '@/lib/admin-api';
```

ใน `UnitsPage` ต่อจาก `useSWR` ของ units:

```tsx
  // ผูกคน = ผู้จัดการ (สเปกรอบ 3 ข้อ 1.4) — รายชื่อสมาชิกอ่านได้เฉพาะผู้จัดการ คนอื่นเห็นแค่จำนวน
  const { data: me } = useSWR<{ isManager: boolean }>('/api/admin/me', adminFetcher, { revalidateOnFocus: false });
  const isManager = me?.isManager === true;
  const { data: people } = useSWR<{ members: { clerkId: string | null; name: string; position: string; isActive: boolean; isArchived: boolean }[] }>(
    isManager ? '/api/admin/users' : null,
    adminFetcher,
    { shouldRetryOnError: false }
  );
  const options: MemberOption[] = (people?.members ?? [])
    .filter((m): m is typeof m & { clerkId: string } => Boolean(m.clerkId) && m.isActive && !m.isArchived)
    .map(({ clerkId, name, position }) => ({ clerkId, name, position }));
```

หัวตาราง: เพิ่ม `<th className="px-2.5 py-3 font-semibold">ผู้ถือตำแหน่ง</th>` ก่อนคอลัมน์ "สถานะ" และขยาย `min-w-[760px]` เป็น `min-w-[900px]`

แถว: ส่ง props `isManager`, `options` ให้ `UnitRow` → `<UnitRow key={u.id} unit={u} isManager={isManager} options={options} onSaved={() => mutate()} />`

ใน `UnitRow` (signature เพิ่ม `isManager: boolean; options: MemberOption[]`) เพิ่ม state `const [binding, setBinding] = useState(false);` แล้ว:
- เพิ่ม `<td>` ก่อนช่องสถานะ:

```tsx
      <td className="px-2.5 py-1.5">
        {isManager ? (
          <div className="flex flex-wrap items-center gap-1">
            {unit.memberClerkIds.map((cid) => (
              <span key={cid} className="rounded-full bg-sb-accent-light px-2 py-0.5 text-xs text-sb-accent">
                {options.find((o) => o.clerkId === cid)?.name || `${cid.slice(0, 10)}…`}
              </span>
            ))}
            <button type="button" className="text-xs text-sb-accent hover:underline" onClick={() => setBinding(!binding)}>
              ผูกคน
            </button>
          </div>
        ) : (
          <span className="text-xs text-sb-muted">{unit.memberClerkIds.length ? `${unit.memberClerkIds.length} คน` : '—'}</span>
        )}
      </td>
```

- เปลี่ยน return ของ `UnitRow` เป็น fragment ที่มีแถวแผงต่อท้ายเมื่อ `binding`:

```tsx
  return (
    <>
      <tr …เดิม…>…เดิม + td ใหม่…</tr>
      {binding ? (
        <tr>
          <td colSpan={7} className="px-4 pb-3">
            <UnitMembersPanel unit={unit} options={options} onClose={() => setBinding(false)} onSaved={onSaved} />
          </td>
        </tr>
      ) : null}
    </>
  );
```

ถ้ายังไม่มี Mongo (dev) `GET /api/admin/users` ตอบ 503 → `options` ว่าง แผงแสดงรายการว่าง — ยอมรับได้ (ผูกคนต้องมีทะเบียนจริงอยู่แล้ว)

- [ ] **Step 3: แก้ `SarabanLayout.tsx`** — import `memberSummaryKey` จาก `@/lib/saraban-view` แล้วต่อจาก `useSWR` ของ `me`:

```tsx
  // ปุ่ม "งานของฉัน" (สเปกรอบ 3 ข้อ 2) — โชว์เมื่อผูกตำแหน่ง (403 not_member = ซ่อน) · dev-open โชว์เสมอ
  // เพราะไม่มีใครผูกได้ ไปเลือกตำแหน่งที่จะสวมที่หน้านั้น
  const { data: memberSummary } = useSWR(clerkOn ? memberSummaryKey(undefined) : null, sarabanFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const showMyWork = !clerkOn || Boolean(memberSummary);
```

ใน header ก่อน `<Link href="/saraban/receive" …>`:

```tsx
            {showMyWork ? (
              <Link
                href="/saraban/me"
                className="inline-flex h-9 flex-none items-center gap-1 whitespace-nowrap rounded-[10px] border border-sb-line px-3 text-sm font-semibold text-sb-ink-2 hover:bg-sb-hover"
              >
                <Icon name="person" size={18} />
                <span className="hidden sm:inline">งานของฉัน</span>
              </Link>
            ) : null}
```

- [ ] **Step 4: ตรวจ**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: ผ่านทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add src/components/saraban/UnitMembersPanel.tsx src/pages/saraban/units.tsx src/components/saraban/SarabanLayout.tsx
git commit -m "feat(saraban): สมุดผู้รับผูกคนเข้าตำแหน่ง และปุ่มสลับไปงานของฉัน

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: ตรวจทั้งชุด + smoke บน dev server

ไม่มีโค้ดใหม่ ยกเว้นแก้สิ่งที่ smoke เจอ

- [ ] **Step 1: ตรวจทั้งชุด**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npx next build`
Expected: ผ่านทั้งหมด (เทสต์มากกว่า 620)

- [ ] **Step 2: เปิด dev server แบบ dev-open บนแบ็กเอนด์ไฟล์**

ใช้ worktree แยก (ห้ามแตะ `data/` ของ working tree หลัก) แบบรอบ 2: `git worktree add <scratchpad>/smoke3 HEAD` → `npm ci` ในนั้น → 
`env -u MONGODB_URI -u CLERK_SECRET_KEY -u NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY npx next dev --webpack -p 3100` (Turbopack โหลด next/font ใน worktree ไม่ได้)

- [ ] **Step 3: smoke ด้วย curl** (ไล่ตามลำดับ เก็บ `updatedAt` จากแต่ละคำตอบ)

1. ลงรับหนึ่งเรื่องผ่าน `POST /api/admin/saraban/docs?kind=receive` ให้ `holderUnitId` = ปลัด (id จาก `GET /api/admin/saraban/units`)
2. `GET /api/admin/saraban/me` (ไม่มี as) → 403 `not_member`
3. `GET /api/admin/saraban/me?as=<ปลัด>` → `counts.todo ≥ 1`
4. `GET /api/admin/saraban/me/docs/<id>?as=<กองช่าง>` → 404
5. `PATCH /api/admin/saraban/me/docs/<id>?as=<ปลัด>` annotate forward → กองช่าง + `circulateTo: [<กองคลัง>]` → 200
6. ปลัด `GET me/docs?tab=forwarded&as=<ปลัด>` มีเรื่องนี้ · กองช่าง `tab=todo` มี · กองคลัง `tab=todo` มี
7. ปลัด PATCH annotate อีกครั้งด้วย `updatedAt` ล่าสุด → 403 `not_holder`
8. กองคลัง PATCH ack `unitId=<กองคลัง>` → 200 · ack ซ้ำ → 409 `already_acknowledged`
9. กองคลัง PATCH ack `unitId=<ปลัด>` → 403 `not_holder`
10. PATCH ด้วย `action: 'void'` → 400 `invalid_input`
11. กองช่าง annotate close → 200 · ปลัด `tab=done` มีเรื่องนี้
12. หน้า `/saraban/me`, `/saraban/me?as=<ปลัด>`, `/saraban/me/doc/<id>?as=<ปลัด>`, `/saraban/units` → 200

- [ ] **Step 4: เก็บกวาด** — หยุด server ลบ worktree (`git worktree remove --force …`)

- [ ] **Step 5: ถ้าแก้อะไรระหว่าง smoke ให้ commit แยกเป็น `fix(saraban): …`**
