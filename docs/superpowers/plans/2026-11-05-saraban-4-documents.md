# สารบรรณรอบ 4 — เอกสาร ตรา ลายมือ ลงนามในระบบ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ดูไฟล์แนบในระบบด้วย pdf.js พร้อมวางตรา/ลายมือเป็นชั้นบนหน้า และลงนามในระบบ (ชื่อ เวลา IP sha256 ของไฟล์) ไปพร้อมการเกษียน

**Architecture:** ตรา/ลายมือ/การลงนามเป็นข้อมูลต่อท้าย event `annotated` (`marks?`, `signature?`) ผ่าน `makeEvent` ตัวเดิม · ตรรกะตรวจเป็นฟังก์ชันบริสุทธิ์ใน `saraban-mark.ts` (client-safe) และ `saraban-sign.ts` (server) ที่สอง route เรียกร่วม · หน้าจอใช้ `DocViewer` ตัวเดียว เรนเดอร์ PDF ผ่าน `PdfPage` ที่โหลดด้วย `next/dynamic({ ssr: false })` และดึง bytes same-origin จาก `…/files/[fileId]?raw=1`

**Tech Stack:** Next.js 16.2 Pages Router · React 19 · zod 4 · SWR 2 · Tailwind v4 (`sb-*` tokens) · vitest · `pdfjs-dist` (ใหม่) · `@aws-sdk/client-s3` (มีแล้ว)

สเปก: [docs/superpowers/specs/2026-11-05-saraban-4-documents-design.md](../specs/2026-11-05-saraban-4-documents-design.md)

**กติกาของ repo ที่ต้องถือ:**
- ห้าม `git add` โฟลเดอร์ `public/design_handoff_namphrae_ui/` · `package-lock.json` commit เฉพาะใน Task 7 (ส่วน pdfjs-dist)
- ห้าม push · ห้ามทดสอบกับ bucket จริง · `.env.local` ในเครื่องชี้ Mongo + bucket จริง — smoke ทำใน worktree ที่ไม่มี `.env.local` เท่านั้น
- ไอคอนต้องอยู่ใน `ICON_NAMES` (`src/lib/icons.ts`) — แผนนี้ใช้เฉพาะที่มีแล้ว: `edit`, `delete`, `close`, `check_circle`, `chevron_left`, `chevron_right`, `open_in_new`, `description`
- AGENTS.md: Next 16 ไม่ใช่ตัวที่คุ้น — อ่าน `node_modules/next/dist/docs/` ก่อนใช้ API ใหม่ (อ่านแล้ว: `next/dynamic` `{ ssr: false }` ใช้ได้ใน Pages Router · API route ตั้ง `export const config = { api: { responseLimit: '11mb' } }` ได้ ค่าเริ่มต้นเตือนที่ 4MB)
- คำสั่งเทสต์: `npx vitest run <ไฟล์>` · ทั้งชุด `npm test` · `npm run lint` · `npx tsc --noEmit`

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `src/types/saraban.ts` (แก้) | `STAMP_KINDS`, `SarabanMark`, `SarabanSignature`, คีย์ `marks?`/`signature?` ใน `SarabanEventDetail` |
| `src/lib/saraban-labels.ts` (แก้) | `STAMP_LABELS`, `STAMP_COLORS` |
| `src/lib/saraban-view.ts` (แก้) | ข้อความ error ใหม่ 3 ตัว · `withRaw()` |
| `src/lib/saraban-mark.ts` (ใหม่) | บริสุทธิ์ client-safe: ขีดจำกัด, `validateMarks`, `isFileReferenced`, `hasSelfOnlyMarks`, `inkPointCount`, `inkPageCount`, `marksOn` |
| `src/lib/saraban-viewer.ts` (ใหม่) | บริสุทธิ์: พิกัดจอ ↔ สัดส่วน, แก้ร่าง (เพิ่ม/ย้าย/ลบตรา, ต่อเส้น, ล้างลายมือ) |
| `src/lib/saraban-schema.ts` (แก้) | `marks`/`sign` ใน `annotatePatchSchema` |
| `src/lib/saraban-sign.ts` (ใหม่) | server: `clientIp`, `sha256Hex`, `buildSignature`, `annotateExtras` |
| `src/lib/saraban-raw.ts` (ใหม่) | server: `sendFileBytes(res, file)` |
| `src/pages/api/admin/saraban/docs/[id]/index.ts` (แก้) | `self_only` + `annotateExtras` |
| `src/pages/api/admin/saraban/me/docs/[id]/index.ts` (แก้) | `annotateExtras` |
| `src/pages/api/admin/saraban/docs/[id]/files/[fileId].ts` (แก้) | `?raw=1` · DELETE `file_referenced` |
| `src/pages/api/admin/saraban/me/docs/[id]/files/[fileId].ts` (แก้) | `?raw=1` |
| `src/components/saraban/PdfPage.tsx` (ใหม่) | pdf.js หนึ่งหน้าลง canvas — import ผ่าน dynamic เท่านั้น |
| `src/components/saraban/DocViewer.tsx` (ใหม่) | เลือกไฟล์ · หน้า · ชั้นตรา/ลายมือ · เครื่องมือ |
| `src/components/saraban/EventDetail.tsx` (แก้) | ตรา · ลายมือ n หน้า · ลงนามในระบบ |
| `src/components/saraban/AnnotateForm.tsx` (แก้) | `AnnotateSubmit` เพิ่ม `sign?` |
| `src/components/saraban/MemberActionForm.tsx` (แก้) | ช่องติ๊ก "ลงนามในระบบ" |
| `src/pages/saraban/annotate/[id].tsx` (แก้) | ใช้ `DocViewer` (ตราอย่างเดียว) |
| `src/pages/saraban/me/doc/[id].tsx` (แก้) | ใช้ `DocViewer` (ตรา + ปากกา) |
| `src/pages/saraban/track/[id].tsx` (แก้) | ซ่อนปุ่มลบไฟล์ที่ถูกอ้าง |
| `src/lib/saraban-doc.ts` (แก้) | คอมเมนต์ `canRemoveFile` ชี้ไป `isFileReferenced` |

---

### Task 1: ชนิดข้อมูล ป้าย และข้อความ error

**Files:**
- Modify: `src/types/saraban.ts`
- Modify: `src/lib/saraban-labels.ts`
- Modify: `src/lib/saraban-view.ts`
- Test: `src/lib/saraban-mark.test.ts` (สร้างใหม่ ใช้ต่อใน Task 3)

- [ ] **Step 1: เขียนเทสต์ที่ล้ม**

สร้าง `src/lib/saraban-mark.test.ts`:

```ts
// src/lib/saraban-mark.test.ts
import { describe, expect, it } from 'vitest';
import { STAMP_COLORS, STAMP_LABELS } from '@/lib/saraban-labels';
import { errorMessage } from '@/lib/saraban-view';
import { STAMP_KINDS } from '@/types/saraban';

describe('ป้ายและสีตรา', () => {
  it('ครบทุกชนิดตรา ตามต้นแบบ', () => {
    expect(STAMP_KINDS.map((k) => STAMP_LABELS[k])).toEqual(['ทราบ', 'ดำเนินการ', 'แจ้งเวียน', 'เห็นชอบ']);
    expect(STAMP_KINDS.map((k) => STAMP_COLORS[k])).toEqual(['#1E4D8C', '#1C7C54', '#8A5A00', '#5B3A8C']);
  });

  it('มีข้อความของ error ใหม่', () => {
    for (const code of ['self_only', 'invalid_mark', 'file_referenced']) {
      expect(errorMessage(code)).not.toBe('เกิดข้อผิดพลาด ลองอีกครั้ง');
    }
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run src/lib/saraban-mark.test.ts`
Expected: FAIL — `STAMP_KINDS` / `STAMP_LABELS` ไม่มี

- [ ] **Step 3: เพิ่มชนิดใน `src/types/saraban.ts`**

ต่อจากบล็อก `ANNOTATE_ROUTES` (ก่อน `SarabanUnitRef`):

```ts
// ตรา (สเปกรอบ 4 ข้อ 2) — ป้าย/สีอยู่ใน saraban-labels.ts
export const STAMP_KINDS = ['ack', 'act', 'circ', 'approve'] as const; // ทราบ | ดำเนินการ | แจ้งเวียน | เห็นชอบ
export type StampKind = (typeof STAMP_KINDS)[number];

// พิกัดทุกตัวเป็นสัดส่วน 0–1 ของกรอบหน้า (x ซ้าย→ขวา, y บน→ล่าง) · page เริ่ม 1
type MarkBase = { fileId: string; page: number };
export type StampMark = MarkBase & { type: 'stamp'; stamp: StampKind; x: number; y: number; rot: number }; // x,y = กึ่งกลาง · rot องศา
export type InkMark = MarkBase & { type: 'ink'; strokes: number[][] }; // แต่ละเส้น [x1,y1,x2,y2,…] · หนึ่งหน้า = InkMark เดียว
export type SarabanMark = StampMark | InkMark;

// ผู้ลงนาม/เวลา = by/byName/at ของ event เดียวกัน · sha256 เซิร์ฟเวอร์คำนวณเองตอนลงนาม
export type SarabanSignature = { ip: string; files: { fileId: string; name: string; sha256: string }[] };
```

ใน `SarabanEventDetail` เพิ่มท้ายสุด:

```ts
  marks?: SarabanMark[]; // annotated (รอบ 4) — ใส่เฉพาะเมื่อไม่ว่าง · แก้/ลบทีหลังไม่ได้
  signature?: SarabanSignature; // annotated ที่ติ๊กลงนามในระบบ (โหมดเจ้าหน้าที่เท่านั้น)
```

- [ ] **Step 4: เพิ่มป้ายใน `src/lib/saraban-labels.ts`**

เพิ่ม `StampKind` ใน import type แล้วต่อท้ายไฟล์:

```ts
// ตรา (สเปกรอบ 4) — สีจากต้นแบบจอ 5
export const STAMP_LABELS: Record<StampKind, string> = {
  ack: 'ทราบ',
  act: 'ดำเนินการ',
  circ: 'แจ้งเวียน',
  approve: 'เห็นชอบ',
};

export const STAMP_COLORS: Record<StampKind, string> = {
  ack: '#1E4D8C',
  act: '#1C7C54',
  circ: '#8A5A00',
  approve: '#5B3A8C',
};
```

- [ ] **Step 5: เพิ่ม error และ `withRaw` ใน `src/lib/saraban-view.ts`**

ใน `ERROR_MESSAGES` ต่อจาก `manager_only`:

```ts
  self_only: 'ลายมือและการลงนามต้องทำเองในงานของฉัน',
  invalid_mark: 'ตรา/ลายมืออ้างไฟล์หรือหน้าที่ไม่มีในหนังสือนี้ — โหลดใหม่แล้ววางอีกครั้ง',
  file_referenced: 'ไฟล์นี้มีตรา ลายมือ หรือการลงนามอ้างอยู่ ลบไม่ได้',
```

ต่อท้ายไฟล์:

```ts
/** ลิงก์ไฟล์ดิบ (same-origin) ให้ pdf.js/<img> — route ตรวจสิทธิ์เดิมแล้วส่ง bytes แทน 302 */
export function withRaw(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}raw=1`;
}
```

- [ ] **Step 6: รันเทสต์**

Run: `npx vitest run src/lib/saraban-mark.test.ts && npx tsc --noEmit`
Expected: PASS · tsc ไม่มี error

- [ ] **Step 7: Commit**

```bash
git add src/types/saraban.ts src/lib/saraban-labels.ts src/lib/saraban-view.ts src/lib/saraban-mark.test.ts
git commit -m "feat(saraban): ชนิดข้อมูลตรา ลายมือ การลงนาม และป้าย/ข้อความ error ของรอบ 4"
```

---

### Task 2: ตรรกะบริสุทธิ์ของ mark (`saraban-mark.ts`)

**Files:**
- Create: `src/lib/saraban-mark.ts`
- Modify: `src/lib/saraban-doc.ts` (คอมเมนต์เหนือ `canAddFile`)
- Test: `src/lib/saraban-mark.test.ts`

- [ ] **Step 1: เพิ่มเทสต์ที่ล้ม** — ต่อท้าย `src/lib/saraban-mark.test.ts` (เพิ่ม import ด้านบนไฟล์):

```ts
import {
  hasSelfOnlyMarks,
  inkPageCount,
  inkPointCount,
  isFileReferenced,
  marksOn,
  maxPageOf,
  validateMarks,
} from '@/lib/saraban-mark';
import type { SarabanEvent, SarabanFile, SarabanMark } from '@/types/saraban';

const file = (over: Partial<SarabanFile>): SarabanFile => ({
  id: 'f1', key: 'saraban/f1.pdf', name: 'a.pdf', format: 'pdf', bytes: 10, pages: 3,
  uploadedAt: '2026-11-05T00:00:00.000Z', uploadedBy: 'dev-open', ...over,
});
const stamp = (over: Partial<Extract<SarabanMark, { type: 'stamp' }>> = {}): SarabanMark => ({
  type: 'stamp', fileId: 'f1', page: 1, stamp: 'ack', x: 0.5, y: 0.5, rot: 0, ...over,
});
const ink = (over: Partial<Extract<SarabanMark, { type: 'ink' }>> = {}): SarabanMark => ({
  type: 'ink', fileId: 'f1', page: 1, strokes: [[0.1, 0.1, 0.2, 0.2]], ...over,
});
const ev = (over: Partial<SarabanEvent>): SarabanEvent => ({
  id: 'e1', at: '2026-11-05T00:00:00.000Z', by: 'u', byName: 'ก', kind: 'annotated', note: 'x', ...over,
});

describe('maxPageOf', () => {
  it('PDF ใช้จำนวนหน้าจริง · อ่านไม่ได้ (0) ยอม 500 · รูป = 1', () => {
    expect(maxPageOf(file({ pages: 3 }))).toBe(3);
    expect(maxPageOf(file({ pages: 0 }))).toBe(500);
    expect(maxPageOf(file({ format: 'jpg', pages: 1 }))).toBe(1);
    expect(maxPageOf(file({ format: 'png', pages: 0 }))).toBe(1);
  });
});

describe('validateMarks', () => {
  const doc = { files: [file({}), file({ id: 'img', format: 'png', pages: 1 })] };
  it('ว่าง/ถูกต้อง ผ่าน', () => {
    expect(validateMarks(doc, [])).toEqual({ ok: true });
    expect(validateMarks(doc, [stamp({ page: 3 }), ink({ fileId: 'img' })])).toEqual({ ok: true });
  });
  it('ไฟล์ไม่อยู่ในหนังสือ → invalid_mark พร้อม index', () => {
    expect(validateMarks(doc, [stamp(), stamp({ fileId: 'other' })])).toEqual({ ok: false, error: 'invalid_mark', index: 1 });
  });
  it('หน้าเกิน → invalid_mark', () => {
    expect(validateMarks(doc, [stamp({ page: 4 })])).toEqual({ ok: false, error: 'invalid_mark', index: 0 });
    expect(validateMarks(doc, [ink({ fileId: 'img', page: 2 })])).toEqual({ ok: false, error: 'invalid_mark', index: 0 });
  });
});

describe('isFileReferenced', () => {
  it('อ้างด้วย mark หรือ signature', () => {
    expect(isFileReferenced({ events: [ev({})] }, 'f1')).toBe(false);
    expect(isFileReferenced({ events: [ev({ marks: [stamp()] })] }, 'f1')).toBe(true);
    expect(isFileReferenced({ events: [ev({ marks: [stamp()] })] }, 'f2')).toBe(false);
    expect(
      isFileReferenced({ events: [ev({ signature: { ip: '', files: [{ fileId: 'f2', name: 'b', sha256: 'x' }] } })] }, 'f2')
    ).toBe(true);
  });
});

describe('นับลายมือ / self-only / marksOn', () => {
  it('นับจุด (คู่ x,y) และหน้า', () => {
    const ms = [ink({ strokes: [[0, 0, 1, 1], [0, 0, 0.5, 0.5, 1, 1]] }), ink({ page: 2 }), stamp()];
    expect(inkPointCount(ms)).toBe(7);
    expect(inkPageCount(ms)).toBe(2);
  });
  it('ลายมือหรือ sign = ต้องเป็นเจ้าตัว', () => {
    expect(hasSelfOnlyMarks({ marks: [stamp()], sign: false })).toBe(false);
    expect(hasSelfOnlyMarks({ marks: [ink()], sign: false })).toBe(true);
    expect(hasSelfOnlyMarks({ marks: [], sign: true })).toBe(true);
  });
  it('marksOn เอาเฉพาะ annotated ของไฟล์/หน้านั้น', () => {
    const events = [ev({ marks: [stamp(), stamp({ page: 2 })] }), ev({ kind: 'edited', marks: [stamp()] }), ev({ marks: [ink({ fileId: 'f2' })] })];
    expect(marksOn(events, 'f1', 1)).toHaveLength(1);
    expect(marksOn(events, 'f2', 1)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: รันให้ล้ม**

Run: `npx vitest run src/lib/saraban-mark.test.ts`
Expected: FAIL — ไม่พบโมดูล `@/lib/saraban-mark`

- [ ] **Step 3: สร้าง `src/lib/saraban-mark.ts`**

```ts
// src/lib/saraban-mark.ts
// ตรา/ลายมือ/การลงนามบนหนังสือ (สเปกรอบ 4 ข้อ 2) — client-safe บริสุทธิ์: ห้าม import node:*
// เซิร์ฟเวอร์ใช้ validateMarks/isFileReferenced ตัดสินจริง หน้าจอใช้ตัวเดียวกันซ่อนปุ่ม/นับ

import type { SarabanDoc, SarabanEvent, SarabanFile, SarabanMark } from '@/types/saraban';

// ต่อการเกษียนหนึ่งครั้ง — กันเอกสาร Mongo บวม (หนังสือหนึ่งเรื่อง = เอกสารเดียว เพดาน 16 MB)
export const MAX_STAMPS = 20;
export const MAX_STROKES = 200;
export const MAX_INK_POINTS = 5000; // คู่ x,y = 1 จุด
export const MAX_MARK_PAGE = 500; // PDF ที่นับหน้าไม่ได้ตอนอัป (pages = 0)

/** หน้าสุดท้ายที่วางได้ — รูปภาพ = 1 เสมอ */
export function maxPageOf(file: Pick<SarabanFile, 'format' | 'pages'>): number {
  if (file.format !== 'pdf') return 1;
  return file.pages > 0 ? file.pages : MAX_MARK_PAGE;
}

export type MarkCheck = { ok: true } | { ok: false; error: 'invalid_mark'; index: number };

/** fileId ต้องเป็นไฟล์ของหนังสือนี้ และหน้าต้องมีจริง (ช่วงพิกัด/จำนวนตรวจที่ schema แล้ว) */
export function validateMarks(doc: Pick<SarabanDoc, 'files'>, marks: readonly SarabanMark[]): MarkCheck {
  for (const [index, mark] of marks.entries()) {
    const file = doc.files.find((f) => f.id === mark.fileId);
    if (!file || mark.page > maxPageOf(file)) return { ok: false, error: 'invalid_mark', index };
  }
  return { ok: true };
}

/** ไฟล์ที่มีตรา/ลายมือ/การลงนามอ้างอยู่ห้ามลบ — ไม่งั้นหลักฐานชี้ไฟล์ที่หายไป */
export function isFileReferenced(doc: Pick<SarabanDoc, 'events'>, fileId: string): boolean {
  return doc.events.some(
    (e) => e.marks?.some((m) => m.fileId === fileId) || e.signature?.files.some((f) => f.fileId === fileId)
  );
}

/** ลายมือและการลงนามต้องเป็นเจ้าตัว (โหมดงานของฉัน) — โหมดเต็มที่ธุรการทำแทนวางได้แค่ตรา */
export function hasSelfOnlyMarks(input: { marks: readonly SarabanMark[]; sign: boolean }): boolean {
  return input.sign || input.marks.some((m) => m.type === 'ink');
}

export function inkPointCount(marks: readonly SarabanMark[]): number {
  return marks.reduce(
    (n, m) => (m.type === 'ink' ? n + m.strokes.reduce((k, s) => k + s.length / 2, 0) : n),
    0
  );
}

/** จำนวนหน้าที่มีลายมือ (ไฟล์ × หน้า) — บรรทัด "มีลายมือ n หน้า" บนไทม์ไลน์ */
export function inkPageCount(marks: readonly SarabanMark[]): number {
  return new Set(marks.filter((m) => m.type === 'ink').map((m) => `${m.fileId}:${m.page}`)).size;
}

/** ตรา/ลายมือของการเกษียนที่ผ่านมาบนหน้าหนึ่ง (ชั้นอ่านอย่างเดียวของ DocViewer) */
export function marksOn(events: readonly SarabanEvent[], fileId: string, page: number): SarabanMark[] {
  return events
    .filter((e) => e.kind === 'annotated')
    .flatMap((e) => e.marks ?? [])
    .filter((m) => m.fileId === fileId && m.page === page);
}
```

- [ ] **Step 4: แก้คอมเมนต์ใน `src/lib/saraban-doc.ts`**

แทนบรรทัด `// (รอบ 4 ต้องห้ามลบไฟล์ที่มีตรา/ลายมือ/การลงนามอ้างอยู่ด้วย)` ด้วย:

```ts
// ไฟล์ที่มีตรา/ลายมือ/การลงนามอ้างอยู่ห้ามลบอีกชั้น — isFileReferenced (saraban-mark.ts)
```

- [ ] **Step 5: รันเทสต์**

Run: `npx vitest run src/lib/saraban-mark.test.ts`
Expected: PASS ทั้งหมด

- [ ] **Step 6: Commit**

```bash
git add src/lib/saraban-mark.ts src/lib/saraban-mark.test.ts src/lib/saraban-doc.ts
git commit -m "feat(saraban): ตรวจตรา/ลายมือกับไฟล์ของหนังสือ และหาไฟล์ที่ถูกอ้าง"
```

---

### Task 3: schema `marks` / `sign`

**Files:**
- Modify: `src/lib/saraban-schema.ts`
- Test: `src/lib/saraban-schema.test.ts`

- [ ] **Step 1: เพิ่มเทสต์ที่ล้ม** — ต่อท้าย `src/lib/saraban-schema.test.ts`:

```ts
describe('annotate: marks / sign (รอบ 4)', () => {
  const base = { action: 'annotate', updatedAt: 'v1', note: 'ทราบ', route: { kind: 'stay' } } as const;
  const stamp = { type: 'stamp', fileId: 'f1', page: 1, stamp: 'ack', x: 0.5, y: 0.25, rot: -4 } as const;
  const ink = { type: 'ink', fileId: 'f1', page: 1, strokes: [[0.1, 0.1, 0.2, 0.2]] } as const;
  const parse = (extra: object) => docPatchSchema.safeParse({ ...base, ...extra });

  it('ค่าเริ่มต้น marks = [] · sign = false', () => {
    const r = docPatchSchema.parse(base);
    expect(r).toMatchObject({ marks: [], sign: false });
  });
  it('รับตราและลายมือที่ถูกต้อง (ทั้งสองโหมด)', () => {
    expect(parse({ marks: [stamp, ink], sign: true }).success).toBe(true);
    expect(memberPatchSchema.safeParse({ ...base, marks: [stamp, ink], sign: true }).success).toBe(true);
  });
  it('พิกัดนอก 0–1 / rot เกิน ±15 / ชนิดตราแปลก ไม่ผ่าน', () => {
    expect(parse({ marks: [{ ...stamp, x: 1.2 }] }).success).toBe(false);
    expect(parse({ marks: [{ ...stamp, rot: 20 }] }).success).toBe(false);
    expect(parse({ marks: [{ ...stamp, stamp: 'reject' }] }).success).toBe(false);
    expect(parse({ marks: [{ ...stamp, page: 0 }] }).success).toBe(false);
  });
  it('เส้นต้อง ≥ 2 จุดและเป็นคู่', () => {
    expect(parse({ marks: [{ ...ink, strokes: [[0.1, 0.1]] }] }).success).toBe(false);
    expect(parse({ marks: [{ ...ink, strokes: [[0.1, 0.1, 0.2, 0.2, 0.3]] }] }).success).toBe(false);
  });
  it('ตราเกิน 20 / จุดลายมือเกิน 5000 / เส้นเกิน 200 ไม่ผ่าน', () => {
    expect(parse({ marks: Array.from({ length: 21 }, () => stamp) }).success).toBe(false);
    expect(parse({ marks: Array.from({ length: 20 }, () => stamp) }).success).toBe(true);
    const long = Array.from({ length: 5001 * 2 }, () => 0.5);
    expect(parse({ marks: [{ ...ink, strokes: [long] }] }).success).toBe(false);
    const many = Array.from({ length: 201 }, () => [0.1, 0.1, 0.2, 0.2]);
    expect(parse({ marks: [{ ...ink, strokes: many }] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: รันให้ล้ม**

Run: `npx vitest run src/lib/saraban-schema.test.ts`
Expected: FAIL — `marks`/`sign` ไม่อยู่ในผล parse และเคสที่ควรไม่ผ่านกลับผ่าน

- [ ] **Step 3: แก้ `src/lib/saraban-schema.ts`**

เพิ่ม import:

```ts
import { inkPointCount, MAX_INK_POINTS, MAX_MARK_PAGE, MAX_STAMPS, MAX_STROKES } from '@/lib/saraban-mark';
import { SARABAN_LEVELS, SARABAN_REGISTERS, SEND_METHODS, STAMP_KINDS } from '@/types/saraban';
```

(บรรทัด import `@/types/saraban` เดิมให้แทนด้วยบรรทัดนี้)

วางก่อน `const annotatePatchSchema`:

```ts
// ตรา/ลายมือ (สเปกรอบ 4 ข้อ 2) — ช่วงพิกัด/จำนวนตรวจที่นี่ · ไฟล์/หน้าตรวจกับหนังสือที่ validateMarks
const unitCoord = z.number().min(0).max(1);
const markBase = {
  fileId: z.string().min(1).max(100),
  page: z.number().int().min(1).max(MAX_MARK_PAGE),
};
const strokeSchema = z
  .array(unitCoord)
  .min(4, 'เส้นลายมือต้องมีอย่างน้อย 2 จุด')
  .max(MAX_INK_POINTS * 2)
  .refine((s) => s.length % 2 === 0, 'จุดลายมือต้องเป็นคู่ x,y');
const markSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stamp'),
    ...markBase,
    stamp: z.enum(STAMP_KINDS),
    x: unitCoord,
    y: unitCoord,
    rot: z.number().min(-15).max(15),
  }),
  z.object({ type: z.literal('ink'), ...markBase, strokes: z.array(strokeSchema).min(1).max(MAX_STROKES) }),
]);
const marksSchema = z
  .array(markSchema)
  .max(MAX_STAMPS + MAX_STROKES)
  .refine((ms) => ms.filter((m) => m.type === 'stamp').length <= MAX_STAMPS, `วางตราได้ไม่เกิน ${MAX_STAMPS} อันต่อครั้ง`)
  .refine(
    (ms) => ms.reduce((n, m) => (m.type === 'ink' ? n + m.strokes.length : n), 0) <= MAX_STROKES,
    `ลายมือได้ไม่เกิน ${MAX_STROKES} เส้นต่อครั้ง`
  )
  .refine((ms) => inkPointCount(ms) <= MAX_INK_POINTS, 'ลายมือยาวเกินไป ล้างแล้วเขียนใหม่ให้สั้นลง')
  .default([]);
```

ใน `annotatePatchSchema` เพิ่มสองช่องต่อจาก `circulateTo`:

```ts
  // รอบ 4 — ใช้ร่วมสองโหมด · route โหมดเต็มปฏิเสธลายมือ/sign เอง (400 self_only)
  marks: marksSchema,
  sign: z.boolean().default(false),
```

- [ ] **Step 4: รันเทสต์**

Run: `npx vitest run src/lib/saraban-schema.test.ts && npx tsc --noEmit`
Expected: PASS · tsc ผ่าน (`AnnotateBody`/`MemberBody` ใน `saraban-api.ts` ได้ `marks?`/`sign?` เองจาก `z.input`)

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-schema.ts src/lib/saraban-schema.test.ts
git commit -m "feat(saraban): schema เกษียนรับตรา ลายมือ และช่องลงนามในระบบ"
```

---

### Task 4: ลงนามในระบบ (`saraban-sign.ts`)

**Files:**
- Create: `src/lib/saraban-sign.ts`
- Test: `src/lib/saraban-sign.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** — `src/lib/saraban-sign.test.ts`:

```ts
// src/lib/saraban-sign.test.ts
import { describe, expect, it } from 'vitest';
import { annotateExtras, buildSignature, clientIp, sha256Hex } from '@/lib/saraban-sign';
import type { SarabanFile, SarabanMark } from '@/types/saraban';

const enc = (s: string) => new TextEncoder().encode(s);
const file = (id: string): SarabanFile => ({
  id, key: `saraban/${id}.pdf`, name: `${id}.pdf`, format: 'pdf', bytes: 3, pages: 1,
  uploadedAt: '2026-11-05T00:00:00.000Z', uploadedBy: 'dev-open',
});
const deps = (configured = true) => ({
  storageConfigured: configured,
  getBytes: async (key: string) => enc(key === 'saraban/a.pdf' ? 'abc' : 'other'),
});
const stamp: SarabanMark = { type: 'stamp', fileId: 'a', page: 1, stamp: 'ack', x: 0.5, y: 0.5, rot: 0 };

describe('clientIp', () => {
  it('ค่าแรกของ x-forwarded-for ก่อน แล้ว socket แล้ว ""', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, socket: { remoteAddress: '::1' } })).toBe('1.2.3.4');
    expect(clientIp({ headers: { 'x-forwarded-for': ['5.6.7.8'] }, socket: {} })).toBe('5.6.7.8');
    expect(clientIp({ headers: {}, socket: { remoteAddress: '::1' } })).toBe('::1');
    expect(clientIp({ headers: { 'x-forwarded-for': ' ' }, socket: {} })).toBe('');
  });
});

describe('buildSignature', () => {
  it('sha256 ของทุกไฟล์ คำนวณจาก bytes เอง', async () => {
    expect(sha256Hex(enc('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const sig = await buildSignature({ files: [file('a')] }, '1.2.3.4', deps());
    expect(sig).toEqual({
      ip: '1.2.3.4',
      files: [{ fileId: 'a', name: 'a.pdf', sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' }],
    });
  });
  it('ไม่มีไฟล์ → files: [] แม้ไม่ได้ตั้ง bucket · มีไฟล์แต่ไม่ได้ตั้ง → null', async () => {
    expect(await buildSignature({ files: [] }, '', deps(false))).toEqual({ ip: '', files: [] });
    expect(await buildSignature({ files: [file('a')] }, '', deps(false))).toBeNull();
  });
});

describe('annotateExtras', () => {
  const doc = { files: [file('a')] };
  it('ไม่มีอะไร → detail ว่าง (ไม่ใส่ marks: [])', async () => {
    expect(await annotateExtras(doc, { marks: [], sign: false }, '', deps())).toEqual({ ok: true, detail: {} });
  });
  it('mark ถูกต้อง + sign', async () => {
    const r = await annotateExtras(doc, { marks: [stamp], sign: true }, 'ip', deps());
    expect(r.ok && r.detail.marks).toEqual([stamp]);
    expect(r.ok && r.detail.signature?.files[0].fileId).toBe('a');
  });
  it('mark ผิดไฟล์ → 400 invalid_mark · sign ไม่มี bucket → 503', async () => {
    expect(await annotateExtras(doc, { marks: [{ ...stamp, fileId: 'x' }], sign: false }, '', deps())).toEqual({
      ok: false, status: 400, error: 'invalid_mark',
    });
    expect(await annotateExtras(doc, { marks: [], sign: true }, '', deps(false))).toEqual({
      ok: false, status: 503, error: 'storage_not_configured',
    });
  });
});
```

- [ ] **Step 2: รันให้ล้ม**

Run: `npx vitest run src/lib/saraban-sign.test.ts`
Expected: FAIL — ไม่พบโมดูล

- [ ] **Step 3: สร้าง `src/lib/saraban-sign.ts`**

```ts
// src/lib/saraban-sign.ts
// ตรา/ลายมือ/ลงนามในระบบที่ต่อท้าย event annotated (สเปกรอบ 4 ข้อ 2–3) — SERVER ONLY (node:crypto)
// สอง route (โหมดเต็ม/งานของฉัน) เรียก annotateExtras ตัวเดียวกัน · I/O ของ bucket ฉีดเข้ามา เทสต์ได้โดยไม่มี bucket
// ป้ายบนจอเขียน "ลงนามในระบบ" เสมอ — ไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์ที่มีใบรับรอง (สเปกแม่ข้อ 10)

import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { validateMarks } from '@/lib/saraban-mark';
import type { SarabanDoc, SarabanEventDetail, SarabanMark, SarabanSignature } from '@/types/saraban';

/** Railway อยู่หลัง proxy — ค่าแรกของ x-forwarded-for คือเครื่องผู้ใช้ */
export function clientIp(req: { headers: IncomingHttpHeaders; socket?: { remoteAddress?: string } }): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || '';
}

export function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export type SignDeps = { storageConfigured: boolean; getBytes: (key: string) => Promise<Uint8Array> };

/** null = มีไฟล์แต่ไม่ได้ตั้ง bucket (คำนวณ hash ไม่ได้) · ไม่มีไฟล์ = ลงนามข้อความเกษียน files: [] */
export async function buildSignature(
  doc: Pick<SarabanDoc, 'files'>,
  ip: string,
  deps: SignDeps
): Promise<SarabanSignature | null> {
  if (doc.files.length > 0 && !deps.storageConfigured) return null;
  const files = await Promise.all(
    doc.files.map(async (f) => ({ fileId: f.id, name: f.name, sha256: sha256Hex(await deps.getBytes(f.key)) }))
  );
  return { ip, files };
}

export type ExtrasResult =
  | { ok: true; detail: SarabanEventDetail }
  | { ok: false; status: 400; error: 'invalid_mark' }
  | { ok: false; status: 503; error: 'storage_not_configured' };

/** เรียกหลัง transition ผ่านแล้ว (การลงนามอ่านไฟล์ทั้งหมด — ไม่ทำถ้าคำขอจะตกอยู่แล้ว) */
export async function annotateExtras(
  doc: Pick<SarabanDoc, 'files'>,
  input: { marks: readonly SarabanMark[]; sign: boolean },
  ip: string,
  deps: SignDeps
): Promise<ExtrasResult> {
  if (!validateMarks(doc, input.marks).ok) return { ok: false, status: 400, error: 'invalid_mark' };
  const detail: SarabanEventDetail = {};
  if (input.marks.length > 0) detail.marks = [...input.marks];
  if (input.sign) {
    const signature = await buildSignature(doc, ip, deps);
    if (!signature) return { ok: false, status: 503, error: 'storage_not_configured' };
    detail.signature = signature;
  }
  return { ok: true, detail };
}
```

- [ ] **Step 4: รันเทสต์**

Run: `npx vitest run src/lib/saraban-sign.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-sign.ts src/lib/saraban-sign.test.ts
git commit -m "feat(saraban): ลงนามในระบบ — IP และ sha256 ของไฟล์ที่เซิร์ฟเวอร์คำนวณเอง"
```

---

### Task 5: ต่อเข้า route เกษียนสองโหมด

**Files:**
- Modify: `src/pages/api/admin/saraban/docs/[id]/index.ts`
- Modify: `src/pages/api/admin/saraban/me/docs/[id]/index.ts`
- Test: `src/lib/api-guard-coverage.test.ts`

- [ ] **Step 1: เพิ่ม source-scan ที่ล้ม** — ใน `describe('สารบรรณโหมดเจ้าหน้าที่…')` ของ `src/lib/api-guard-coverage.test.ts` ต่อท้าย (ก่อน `});` ปิด describe):

```ts
  it('docs/[id]: โหมดเต็มปฏิเสธลายมือ/ลงนาม (self_only) ก่อนอ่านหนังสือ · ใช้ annotateExtras', () => {
    const src = readFileSync(join(API_DIR, 'saraban', 'docs', '[id]', 'index.ts'), 'utf8');
    expect(src).toContain("'self_only'");
    expect(src.indexOf('hasSelfOnlyMarks(patch)')).toBeGreaterThan(-1);
    expect(src.indexOf('hasSelfOnlyMarks(patch)')).toBeLessThan(src.indexOf('const current = await getDoc(id)'));
    expect(src).toContain('annotateExtras(current, patch');
  });

  it('me/docs/[id]: ตรวจ marks และลงนามผ่าน annotateExtras หลัง not_holder', () => {
    const src = readFileSync(join(ME_DIR, 'docs', '[id]', 'index.ts'), 'utf8');
    expect(src).toContain('annotateExtras(current, patch');
    expect(src.indexOf('not_holder')).toBeLessThan(src.indexOf('annotateExtras(current, patch'));
  });
```

- [ ] **Step 2: รันให้ล้ม**

Run: `npx vitest run src/lib/api-guard-coverage.test.ts`
Expected: FAIL สองเคสใหม่

- [ ] **Step 3: แก้ route โหมดเต็ม `src/pages/api/admin/saraban/docs/[id]/index.ts`**

import เพิ่ม:

```ts
import { hasSelfOnlyMarks } from '@/lib/saraban-mark';
import { annotateExtras, clientIp } from '@/lib/saraban-sign';
import { getObjectBytes, isStorageConfigured } from '@/lib/saraban-storage';
```

ต่อจากบล็อก `manager_only`:

```ts
  // ลายมือและการลงนามต้องเป็นเจ้าตัว (สเปกรอบ 4 ข้อ 1.3) — ธุรการทำแทนวางได้แค่ตรา
  if (patch.action === 'annotate' && hasSelfOnlyMarks(patch)) {
    return res.status(400).json({ error: 'self_only' });
  }
```

ในกิ่ง `annotate || ack` แทน `detail = result.detail;` ด้วย:

```ts
      detail = result.detail;
      if (patch.action === 'annotate') {
        const extras = await annotateExtras(current, patch, clientIp(req), {
          storageConfigured: isStorageConfigured(),
          getBytes: getObjectBytes,
        });
        if (!extras.ok) return res.status(extras.status).json({ error: extras.error });
        detail = { ...detail, ...extras.detail };
      }
```

แก้คอมเมนต์หัวไฟล์ เพิ่มบรรทัด:

```ts
//   annotate รับ marks (ตราเท่านั้น) — ลายมือหรือ sign → 400 self_only (ต้องทำในงานของฉัน)
```

- [ ] **Step 4: แก้ route โหมดเจ้าหน้าที่ `src/pages/api/admin/saraban/me/docs/[id]/index.ts`**

import เพิ่ม:

```ts
import { annotateExtras, clientIp } from '@/lib/saraban-sign';
import { getObjectBytes, isStorageConfigured } from '@/lib/saraban-storage';
import type { SarabanEventDetail } from '@/types/saraban';
```

ต่อจากบล็อก `if (!result.ok) { … }` และก่อน `const event = makeEvent(`:

```ts
    let detail: SarabanEventDetail = result.detail;
    if (patch.action === 'annotate') {
      // ตรา + ลายมือ + ลงนามในระบบ (สเปกรอบ 4) — เจ้าตัวทำได้ครบ
      const extras = await annotateExtras(current, patch, clientIp(req), {
        storageConfigured: isStorageConfigured(),
        getBytes: getObjectBytes,
      });
      if (!extras.ok) return res.status(extras.status).json({ error: extras.error });
      detail = { ...detail, ...extras.detail };
    }
```

แล้วใน `makeEvent({...})` เปลี่ยน `detail: result.detail,` เป็น `detail,`

- [ ] **Step 5: รันเทสต์ + tsc**

Run: `npx vitest run src/lib/api-guard-coverage.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add 'src/pages/api/admin/saraban/docs/[id]/index.ts' 'src/pages/api/admin/saraban/me/docs/[id]/index.ts' src/lib/api-guard-coverage.test.ts
git commit -m "feat(saraban): บันทึกตรา ลายมือ และการลงนามไปกับการเกษียน — ลายมือ/ลงนามเฉพาะเจ้าตัว"
```

---

### Task 6: ไฟล์ดิบ `?raw=1` และห้ามลบไฟล์ที่ถูกอ้าง

**Files:**
- Create: `src/lib/saraban-raw.ts`
- Modify: `src/pages/api/admin/saraban/docs/[id]/files/[fileId].ts`
- Modify: `src/pages/api/admin/saraban/me/docs/[id]/files/[fileId].ts`
- Test: `src/lib/api-guard-coverage.test.ts`

- [ ] **Step 1: เพิ่ม source-scan ที่ล้ม** — ต่อท้าย describe เดียวกับ Task 5:

```ts
  it('route ไฟล์ทั้งสองส่ง bytes เมื่อ ?raw=1 และขยาย responseLimit (ไฟล์ถึง 10MB)', () => {
    for (const p of [
      join(API_DIR, 'saraban', 'docs', '[id]', 'files', '[fileId].ts'),
      join(ME_DIR, 'docs', '[id]', 'files', '[fileId].ts'),
    ]) {
      const src = readFileSync(p, 'utf8');
      expect(src).toContain("req.query.raw === '1'");
      expect(src).toContain('sendFileBytes(res, file)');
      expect(src).toContain("responseLimit: '11mb'");
    }
  });

  it('DELETE ไฟล์: ห้ามลบไฟล์ที่ถูกอ้าง ก่อน removeFile', () => {
    const src = readFileSync(join(API_DIR, 'saraban', 'docs', '[id]', 'files', '[fileId].ts'), 'utf8');
    expect(src).toContain("'file_referenced'");
    expect(src.indexOf('isFileReferenced(doc, fileId)')).toBeGreaterThan(-1);
    expect(src.indexOf('isFileReferenced(doc, fileId)')).toBeLessThan(src.indexOf('removeFile(id, fileId'));
  });
```

- [ ] **Step 2: รันให้ล้ม**

Run: `npx vitest run src/lib/api-guard-coverage.test.ts`
Expected: FAIL สองเคสใหม่

- [ ] **Step 3: สร้าง `src/lib/saraban-raw.ts`**

```ts
// src/lib/saraban-raw.ts
// ส่ง bytes ของไฟล์แนบผ่านแอป (same-origin) ให้ pdf.js/<img> ของ DocViewer — SERVER ONLY
// ทางเลือกนี้แทนการตั้ง CORS ที่ bucket (สเปกรอบ 4 ข้อ 1.4) · เปิดแท็บใหม่ยังใช้ 302 แบบเดิม
// route ที่เรียกต้องตั้ง `export const config = { api: { responseLimit: '11mb' } }` — ไฟล์ใหญ่ได้ 10MB

import type { NextApiResponse } from 'next';
import { CONTENT_TYPES, inlineDisposition } from '@/lib/saraban-attachment';
import { getObjectBytes } from '@/lib/saraban-storage';
import type { SarabanFile } from '@/types/saraban';

export async function sendFileBytes(res: NextApiResponse, file: SarabanFile): Promise<void> {
  const bytes = await getObjectBytes(file.key);
  res.setHeader('Content-Type', CONTENT_TYPES[file.format]);
  res.setHeader('Content-Length', String(bytes.length));
  res.setHeader('Content-Disposition', inlineDisposition(file.name));
  // private: ห้าม proxy/CDN เก็บ — ไฟล์ราชการต้องผ่านการตรวจสิทธิ์ทุกครั้ง
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.status(200).send(Buffer.from(bytes));
}
```

(ตรวจก่อนว่า `inlineDisposition` และ `CONTENT_TYPES` export จาก `src/lib/saraban-attachment.ts` — ทั้งสองถูก import อยู่แล้วใน `saraban-storage.ts` และ route ไฟล์)

- [ ] **Step 4: แก้ route โหมดเต็ม `src/pages/api/admin/saraban/docs/[id]/files/[fileId].ts`**

import เพิ่ม:

```ts
import { isFileReferenced } from '@/lib/saraban-mark';
import { sendFileBytes } from '@/lib/saraban-raw';
```

เหนือ `export default` เพิ่ม:

```ts
// ?raw=1 ส่ง bytes ผ่านแอป (ไฟล์ถึง 10MB) — ค่าเริ่มต้นของ Next เตือนที่ 4MB
export const config = { api: { responseLimit: '11mb' } };
```

ในกิ่ง `if (req.method === 'GET') {` ใส่เป็นบรรทัดแรก:

```ts
      if (req.query.raw === '1') return sendFileBytes(res, file);
```

หลังบล็อก `if (!canRemoveFile(doc)) { … }`:

```ts
    if (isFileReferenced(doc, fileId)) return res.status(409).json({ error: 'file_referenced' });
```

แก้คอมเมนต์หัวไฟล์:

```ts
// GET    /api/admin/saraban/docs/[id]/files/[fileId] — ตรวจสิทธิ์แล้ว 302 ไปลิงก์ชั่วคราว 5 นาที
//        ?raw=1 ส่ง bytes ผ่านแอปแทน (pdf.js ของ DocViewer — สเปกรอบ 4) · bucket เป็น private เสมอ
// DELETE /api/admin/saraban/docs/[id]/files/[fileId] — เอาออกจากหนังสือก่อน แล้วค่อยลบ object
//        ไฟล์ที่มีตรา/ลายมือ/การลงนามอ้าง → 409 file_referenced
```

หมายเหตุ: `return sendFileBytes(...)` คืน Promise<void> — Next เตือนเฉพาะเมื่อ handler คืนค่าที่ไม่ใช่ undefined; ถ้า lint/รันแล้วมีเตือน "API handler should not return a value" ให้เขียนเป็น `{ await sendFileBytes(res, file); return; }`

- [ ] **Step 5: แก้ route โหมดเจ้าหน้าที่ `src/pages/api/admin/saraban/me/docs/[id]/files/[fileId].ts`**

import `sendFileBytes` และเพิ่ม `export const config = { api: { responseLimit: '11mb' } };` แบบเดียวกัน · หลัง `if (!file) return res.status(404)…`:

```ts
    if (req.query.raw === '1') {
      await sendFileBytes(res, file);
      return;
    }
```

คอมเมนต์หัวไฟล์ต่อท้าย: `// ?raw=1 ส่ง bytes ผ่านแอปให้ DocViewer (สเปกรอบ 4)`

(ใช้รูป `await …; return;` ทั้งสองไฟล์ให้เหมือนกัน — ถ้าเลือกแบบนี้ใน Step 4 ด้วย source-scan ยังผ่าน)

- [ ] **Step 6: รันเทสต์ + tsc**

Run: `npx vitest run src/lib/api-guard-coverage.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/saraban-raw.ts 'src/pages/api/admin/saraban/docs/[id]/files/[fileId].ts' 'src/pages/api/admin/saraban/me/docs/[id]/files/[fileId].ts' src/lib/api-guard-coverage.test.ts
git commit -m "feat(saraban): ส่งไฟล์ดิบ same-origin ให้ตัวดูเอกสาร และห้ามลบไฟล์ที่มีตรา/ลงนามอ้าง"
```

---

### Task 7: ติดตั้ง `pdfjs-dist`

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: เก็บ lock ในเครื่องไว้ แล้วเริ่มจาก lock ที่ commit แล้ว**

```bash
cp package-lock.json /private/tmp/claude-501/-Users-thanawatsodsri-Fullstack-namphrae-portal/9477396c-17b0-4b58-a8f8-79a6ed856c9e/scratchpad/package-lock.local.json
git checkout package-lock.json
npm install pdfjs-dist@latest
```

- [ ] **Step 2: ตรวจ diff ของ lock**

Run: `git diff --stat package-lock.json && git diff package-lock.json | grep '^[+-]' | grep -v 'pdfjs-dist\|napi-rs' | head -40`
Expected: มีแต่รายการของ `pdfjs-dist` และ dependency ของมัน (เช่น `@napi-rs/canvas*` ที่เป็น optional) · ถ้ามีบรรทัด `"peer": true` ที่ไม่เกี่ยวโผล่มา ให้กรองด้วย:

```bash
node -e "
const fs=require('fs'),cp=require('child_process');
const now=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
const base=JSON.parse(cp.execSync('git show HEAD:package-lock.json'));
for (const [k,v] of Object.entries(now.packages)) if (!(k in base.packages)) base.packages[k]=v;
base.packages['']=now.packages[''];
fs.writeFileSync('package-lock.json', JSON.stringify(base,null,2)+'\n');"
npm ls pdfjs-dist
```

Expected: `npm ls` แสดง `pdfjs-dist@<เวอร์ชัน>` ไม่มี error

- [ ] **Step 3: ดู API ของรุ่นที่ได้**

Run: `node -p "require('./node_modules/pdfjs-dist/package.json').version" && ls node_modules/pdfjs-dist/build | grep worker && grep -n "canvasContext\|canvas:" node_modules/pdfjs-dist/types/src/display/api.d.ts | head`
จดไว้ใช้ใน Task 9: ชื่อไฟล์ worker (`pdf.worker.min.mjs` หรือชื่ออื่น) และ `RenderParameters` ต้องการ `canvas` หรือ `canvasContext`

- [ ] **Step 4: Commit (เฉพาะสองไฟล์)**

```bash
git add package.json package-lock.json
git commit -m "chore(saraban): เพิ่ม pdfjs-dist สำหรับตัวดูเอกสาร"
```

---

### Task 8: เรขาคณิตและร่างของ viewer (`saraban-viewer.ts`)

**Files:**
- Create: `src/lib/saraban-viewer.ts`
- Test: `src/lib/saraban-viewer.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** — `src/lib/saraban-viewer.test.ts`:

```ts
// src/lib/saraban-viewer.test.ts
import { describe, expect, it } from 'vitest';
import {
  addStamp,
  appendStroke,
  canAddStamp,
  clearInk,
  moveStamp,
  removeMark,
  round4,
  strokePoints,
  toUnit,
} from '@/lib/saraban-viewer';
import type { SarabanMark } from '@/types/saraban';

const at = { fileId: 'f1', page: 1 };
const rect = { left: 100, top: 50, width: 400, height: 800 };

describe('พิกัด', () => {
  it('round4 / toUnit ปัดทศนิยม 4 ตำแหน่ง และหนีบ 0–1', () => {
    expect(round4(0.123456)).toBe(0.1235);
    expect(toUnit(300, 450, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(toUnit(0, 2000, rect)).toEqual({ x: 0, y: 1 });
    expect(toUnit(100 + 400 / 3, 50, rect)).toEqual({ x: 0.3333, y: 0 });
  });
  it('strokePoints เป็นรูป polyline ของ SVG', () => {
    expect(strokePoints([0.1, 0.2, 0.3, 0.4])).toBe('0.1,0.2 0.3,0.4');
  });
});

describe('ร่างตรา', () => {
  it('addStamp วางกลางหน้า เอียงต่างกันเล็กน้อย', () => {
    const a = addStamp([], at, 'ack');
    expect(a[0]).toMatchObject({ type: 'stamp', fileId: 'f1', page: 1, stamp: 'ack', x: 0.5, y: 0.5 });
    const b = addStamp(a, at, 'approve');
    expect(b).toHaveLength(2);
    expect(Math.abs((b[1] as { rot: number }).rot)).toBeLessThanOrEqual(15);
    expect((b[1] as { rot: number }).rot).not.toBe((b[0] as { rot: number }).rot);
  });
  it('moveStamp / removeMark ไม่แก้ของเดิม', () => {
    const a = addStamp([], at, 'ack');
    const m = moveStamp(a, 0, { x: 0.1, y: 0.9 });
    expect(m[0]).toMatchObject({ x: 0.1, y: 0.9 });
    expect(a[0]).toMatchObject({ x: 0.5 });
    expect(removeMark(m, 0)).toEqual([]);
  });
  it('canAddStamp หยุดที่ 20', () => {
    let d: SarabanMark[] = [];
    for (let i = 0; i < 20; i++) d = addStamp(d, at, 'ack');
    expect(canAddStamp(d)).toBe(false);
  });
});

describe('ร่างลายมือ', () => {
  it('หน้าเดียวกันรวมเป็น InkMark เดียว · หน้าอื่นแยก', () => {
    let d = appendStroke([], at, [0.1, 0.1, 0.2, 0.2]);
    d = appendStroke(d, at, [0.3, 0.3, 0.4, 0.4]);
    d = appendStroke(d, { fileId: 'f1', page: 2 }, [0.1, 0.1, 0.2, 0.2]);
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ type: 'ink', page: 1, strokes: [[0.1, 0.1, 0.2, 0.2], [0.3, 0.3, 0.4, 0.4]] });
  });
  it('เส้นที่สั้นกว่า 2 จุดทิ้ง · ตัดให้อยู่ในงบ 5000 จุด', () => {
    expect(appendStroke([], at, [0.1, 0.1])).toEqual([]);
    const big = Array.from({ length: 4999 * 2 }, () => 0.5);
    const d = appendStroke(appendStroke([], at, big), at, [0.1, 0.1, 0.2, 0.2, 0.3, 0.3]);
    // เหลืองบ 1 จุด = เส้นใหม่สั้นกว่า 2 จุด → ทิ้ง
    expect((d[0] as { strokes: number[][] }).strokes).toHaveLength(1);
  });
  it('clearInk เอาลายมือออก ตราคงไว้', () => {
    const d = appendStroke(addStamp([], at, 'ack'), at, [0.1, 0.1, 0.2, 0.2]);
    expect(clearInk(d)).toHaveLength(1);
    expect(clearInk(d)[0].type).toBe('stamp');
  });
});
```

- [ ] **Step 2: รันให้ล้ม**

Run: `npx vitest run src/lib/saraban-viewer.test.ts`
Expected: FAIL — ไม่พบโมดูล

- [ ] **Step 3: สร้าง `src/lib/saraban-viewer.ts`**

```ts
// src/lib/saraban-viewer.ts
// พิกัดและร่างตรา/ลายมือของ DocViewer — client-safe บริสุทธิ์ (เทสต์ได้โดยไม่มี DOM)
// ทุกฟังก์ชันคืนอาเรย์ใหม่ ไม่แก้ของเดิม (ใช้เป็น React state ตรง ๆ)

import { inkPointCount, MAX_INK_POINTS, MAX_STAMPS } from '@/lib/saraban-mark';
import type { SarabanMark, StampKind } from '@/types/saraban';

type At = { fileId: string; page: number };
type Rect = { left: number; top: number; width: number; height: number };

export const round4 = (n: number): number => Math.round(n * 10000) / 10000;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** จุดบนจอ → สัดส่วน 0–1 ของกรอบหน้า (ไม่ขึ้นกับขนาดจอ — สเปกรอบ 4 ข้อ 2) */
export function toUnit(clientX: number, clientY: number, rect: Rect): { x: number; y: number } {
  return {
    x: round4(clamp01((clientX - rect.left) / rect.width)),
    y: round4(clamp01((clientY - rect.top) / rect.height)),
  };
}

/** [x1,y1,x2,y2,…] → "x1,y1 x2,y2" ของ <polyline points> ใน viewBox 0 0 1 1 */
export function strokePoints(stroke: readonly number[]): string {
  const out: string[] = [];
  for (let i = 0; i + 1 < stroke.length; i += 2) out.push(`${stroke[i]},${stroke[i + 1]}`);
  return out.join(' ');
}

export function canAddStamp(draft: readonly SarabanMark[]): boolean {
  return draft.filter((m) => m.type === 'stamp').length < MAX_STAMPS;
}

// เอียงเล็กน้อยแบบตรายางจริง วนตามลำดับ — คงที่ (ไม่สุ่ม) ให้เทสต์และ re-render ได้ค่าเดิม
const TILTS = [-4, 3, -2, 5, -5, 2];

export function addStamp(draft: readonly SarabanMark[], at: At, stamp: StampKind): SarabanMark[] {
  if (!canAddStamp(draft)) return [...draft];
  const n = draft.filter((m) => m.type === 'stamp').length;
  return [...draft, { type: 'stamp', ...at, stamp, x: 0.5, y: 0.5, rot: TILTS[n % TILTS.length] }];
}

export function moveStamp(draft: readonly SarabanMark[], index: number, p: { x: number; y: number }): SarabanMark[] {
  return draft.map((m, i) => (i === index && m.type === 'stamp' ? { ...m, x: p.x, y: p.y } : m));
}

export function removeMark(draft: readonly SarabanMark[], index: number): SarabanMark[] {
  return draft.filter((_, i) => i !== index);
}

/** ต่อเส้นลงหน้านั้น (หนึ่งหน้า = InkMark เดียว) · ตัดให้อยู่ในงบจุดรวม · สั้นกว่า 2 จุดทิ้ง */
export function appendStroke(draft: readonly SarabanMark[], at: At, stroke: readonly number[]): SarabanMark[] {
  const budget = MAX_INK_POINTS - inkPointCount(draft);
  const kept = stroke.slice(0, Math.max(0, budget) * 2);
  if (kept.length < 4) return [...draft];
  const i = draft.findIndex((m) => m.type === 'ink' && m.fileId === at.fileId && m.page === at.page);
  if (i < 0) return [...draft, { type: 'ink', ...at, strokes: [kept] }];
  return draft.map((m, j) => (j === i && m.type === 'ink' ? { ...m, strokes: [...m.strokes, kept] } : m));
}

export function clearInk(draft: readonly SarabanMark[]): SarabanMark[] {
  return draft.filter((m) => m.type !== 'ink');
}
```

- [ ] **Step 4: รันเทสต์**

Run: `npx vitest run src/lib/saraban-viewer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-viewer.ts src/lib/saraban-viewer.test.ts
git commit -m "feat(saraban): พิกัดและร่างตรา/ลายมือของตัวดูเอกสาร"
```

---

### Task 9: `PdfPage` และ `DocViewer`

**Files:**
- Create: `src/components/saraban/PdfPage.tsx`
- Create: `src/components/saraban/DocViewer.tsx`

ไม่มีเทสต์หน่วย (DOM/canvas) — ตรวจด้วย tsc, lint และในเบราว์เซอร์ที่ Task 13

- [ ] **Step 1: สร้าง `src/components/saraban/PdfPage.tsx`**

ปรับชื่อไฟล์ worker และพารามิเตอร์ `render` ตามที่จดไว้ใน Task 7 Step 3 (โค้ดนี้เขียนสำหรับ pdfjs ≥ 5: `render({ canvas, viewport })`)

```tsx
// pdf.js หนึ่งหน้าลง canvas (สเปกรอบ 4 ข้อ 4) — import ผ่าน next/dynamic({ ssr: false }) เท่านั้น
// เพราะ pdfjs-dist แตะ DOM/worker ตั้งแต่ตอนโหลดโมดูล · ไฟล์มาจาก ?raw=1 ของเราเอง (same-origin, cookie ติดไปเอง)
import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export type PdfInfo = { pages: number; aspect: number }; // aspect = สูง/กว้าง ของหน้าปัจจุบัน

export default function PdfPage({
  url,
  page,
  width,
  onInfo,
  onError,
}: {
  url: string;
  page: number;
  width: number; // px ของกล่องกระดาษ — 0 = ยังวัดไม่ได้
  onInfo: (info: PdfInfo) => void;
  onError: (status?: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  // callback ล่าสุดโดยไม่ต้องใส่ใน deps — กันโหลด PDF ใหม่ทุกครั้งที่ผู้เรียก re-render
  const cb = useRef({ onInfo, onError });
  useEffect(() => {
    cb.current = { onInfo, onError };
  });

  useEffect(() => {
    let alive = true;
    // route ไม่รองรับ Range — โหลดทั้งไฟล์ครั้งเดียว (≤ 10MB)
    const task = getDocument({ url, disableRange: true, disableStream: true });
    task.promise.then(
      (doc) => alive && setPdf(doc),
      (err: { status?: number }) => alive && cb.current.onError(err?.status)
    );
    return () => {
      alive = false;
      setPdf(null);
      void task.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!pdf || width <= 0) return;
    let alive = true;
    let render: RenderTask | undefined;
    pdf.getPage(page).then(
      (p) => {
        const el = canvas.current;
        if (!alive || !el) return;
        const base = p.getViewport({ scale: 1 });
        cb.current.onInfo({ pages: pdf.numPages, aspect: base.height / base.width });
        const dpr = window.devicePixelRatio || 1;
        const viewport = p.getViewport({ scale: (width / base.width) * dpr });
        el.width = Math.floor(viewport.width);
        el.height = Math.floor(viewport.height);
        render = p.render({ canvas: el, viewport });
        render.promise.catch(() => {}); // ถูกยกเลิกตอนเปลี่ยนหน้า/ขนาด — ไม่ใช่ error
      },
      () => alive && cb.current.onError()
    );
    return () => {
      alive = false;
      render?.cancel();
    };
  }, [pdf, page, width]);

  return <canvas ref={canvas} className="absolute inset-0 block h-full w-full" />;
}
```

- [ ] **Step 2: สร้าง `src/components/saraban/DocViewer.tsx`**

```tsx
// ตัวดูเอกสาร (สเปกรอบ 4 ข้อ 4 · ต้นแบบจอ 5 / B) — เลือกไฟล์ · หน้า · ชั้นตรา/ลายมือ
// ชั้นล่าง: ของทุกการเกษียนที่ผ่านมา (อ่านอย่างเดียว) · ชั้นบน: ร่างของผู้ใช้ตอนนี้ (draft — หน้าเป็นเจ้าของ state)
// พิกัดเป็นสัดส่วน 0–1 ของกล่องกระดาษ กล่องสูงตามสัดส่วนหน้าจริง ตรา/ลายมือจึงอยู่ที่เดิมทุกขนาดจอ
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Icon from '@/components/Icon';
import type { PdfInfo } from '@/components/saraban/PdfPage';
import { STAMP_COLORS, STAMP_LABELS } from '@/lib/saraban-labels';
import { marksOn, maxPageOf } from '@/lib/saraban-mark';
import { addStamp, appendStroke, canAddStamp, clearInk, moveStamp, removeMark, strokePoints, toUnit } from '@/lib/saraban-viewer';
import { errorMessage } from '@/lib/saraban-view';
import { STAMP_KINDS, type SarabanEvent, type SarabanFile, type SarabanMark, type StampMark } from '@/types/saraban';

const PdfPage = dynamic(() => import('@/components/saraban/PdfPage'), {
  ssr: false,
  loading: () => <p className="absolute inset-0 flex items-center justify-center text-[13px] text-sb-muted">กำลังเปิดเอกสาร…</p>,
});

export type ViewerTools = 'none' | 'stamp' | 'stamp+ink';

const A4 = 297 / 210;

export default function DocViewer({
  files,
  events,
  rawUrl,
  openUrl,
  tools,
  draft,
  onDraftChange,
}: {
  files: SarabanFile[];
  events: SarabanEvent[];
  rawUrl: (fileId: string) => string; // ?raw=1 (same-origin)
  openUrl: (fileId: string) => string; // 302 เปิดแท็บใหม่
  tools: ViewerTools;
  draft: SarabanMark[];
  onDraftChange: (draft: SarabanMark[]) => void;
}) {
  const [rawFileId, setFileId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [info, setInfo] = useState<PdfInfo | null>(null);
  const [imgAspect, setImgAspect] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pen, setPen] = useState(false);
  const [stroke, setStroke] = useState<number[] | null>(null);
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);

  const file = files.find((f) => f.id === rawFileId) ?? files[0];

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [file?.id]);

  if (!file) {
    return <div className="flex min-h-[200px] items-center justify-center text-[13px] text-sb-muted">ไม่มีไฟล์แนบ</div>;
  }

  const isPdf = file.format === 'pdf';
  const pages = isPdf ? (info?.pages ?? (file.pages || 1)) : 1;
  const aspect = (isPdf ? info?.aspect : imgAspect) ?? A4;
  const at = { fileId: file.id, page };
  const past = marksOn(events, file.id, page);
  const mine = draft.map((m, index) => ({ m, index })).filter(({ m }) => m.fileId === file.id && m.page === page);
  const canStamp = tools !== 'none';
  const canInk = tools === 'stamp+ink';

  function pick(id: string) {
    setFileId(id);
    setPage(1);
    setInfo(null);
    setImgAspect(null);
    setFailed(null);
  }

  function unitOf(e: ReactPointerEvent) {
    return toUnit(e.clientX, e.clientY, box.current!.getBoundingClientRect());
  }

  // ---- ปากกา ----
  function penDown(e: ReactPointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = unitOf(e);
    setStroke([p.x, p.y]);
  }
  function penMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!stroke) return;
    const p = unitOf(e);
    const lx = stroke[stroke.length - 2];
    const ly = stroke[stroke.length - 1];
    // ข้ามจุดที่ชิดกันเกินไป — ประหยัดงบ 5,000 จุด
    if (Math.hypot(p.x - lx, p.y - ly) < 0.002) return;
    setStroke([...stroke, p.x, p.y]);
  }
  function penUp() {
    if (stroke) onDraftChange(appendStroke(draft, at, stroke));
    setStroke(null);
  }

  // ---- ลากตราในร่าง ----
  function stampDown(e: ReactPointerEvent<HTMLDivElement>, index: number) {
    if (pen) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = index;
  }
  function stampMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current === null) return;
    onDraftChange(moveStamp(draft, drag.current, unitOf(e)));
  }

  const chipOn = 'bg-sb-accent text-white';
  const chipOff = 'bg-white hover:bg-sb-hover';

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-sb-line bg-sb-panel px-4 py-2.5">
        <Icon name="description" size={18} className="text-sb-muted" />
        {files.length > 1
          ? files.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => pick(f.id)}
                aria-pressed={f.id === file.id}
                title={f.name}
                className={`max-w-[200px] truncate rounded-lg px-2.5 py-1 text-xs ${f.id === file.id ? chipOn : chipOff}`}
              >
                {f.name}
              </button>
            ))
          : <span className="max-w-[240px] truncate text-xs">{file.name}</span>}
        {pages > 1 ? (
          <span className="flex items-center gap-1 text-xs">
            <button type="button" aria-label="หน้าก่อน" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded p-1 hover:bg-sb-hover disabled:opacity-40">
              <Icon name="chevron_left" size={18} />
            </button>
            หน้า {page}/{pages}
            <button type="button" aria-label="หน้าถัดไป" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded p-1 hover:bg-sb-hover disabled:opacity-40">
              <Icon name="chevron_right" size={18} />
            </button>
          </span>
        ) : null}
        <a href={openUrl(file.id)} target="_blank" rel="noopener" className="ml-auto flex items-center gap-1 text-xs text-sb-accent hover:underline">
          <Icon name="open_in_new" size={16} />
          เปิดในแท็บใหม่
        </a>
      </div>

      {canStamp ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-sb-line px-4 py-2" role="toolbar" aria-label="เครื่องมือตรา/ลายมือ">
          {STAMP_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              disabled={!canAddStamp(draft) || page > maxPageOf(file)}
              onClick={() => onDraftChange(addStamp(draft, at, k))}
              className="h-9 rounded-lg border-2 bg-white px-3 text-xs font-bold disabled:opacity-40"
              style={{ color: STAMP_COLORS[k], borderColor: STAMP_COLORS[k] }}
            >
              {STAMP_LABELS[k]}
            </button>
          ))}
          {canInk ? (
            <>
              <span className="mx-1 h-6 w-px bg-sb-line" aria-hidden />
              <button type="button" aria-pressed={pen} onClick={() => setPen(!pen)} className={`flex h-9 items-center gap-1 rounded-lg px-3 text-xs ${pen ? chipOn : `border border-sb-line ${chipOff}`}`}>
                <Icon name="edit" size={16} />
                ปากกา
              </button>
              <button type="button" disabled={!draft.some((m) => m.type === 'ink')} onClick={() => onDraftChange(clearInk(draft))} className="flex h-9 items-center gap-1 rounded-lg border border-sb-line bg-white px-3 text-xs disabled:opacity-40">
                <Icon name="delete" size={16} />
                ล้างลายมือ
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="bg-[#E9EDF2] p-3">
        <div
          ref={box}
          className="relative w-full overflow-hidden bg-white shadow-sm [container-type:inline-size]"
          style={{ aspectRatio: `1 / ${aspect}` }}
        >
          {failed ? (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-[13px] text-sb-muted">{failed}</p>
          ) : isPdf ? (
            <PdfPage
              url={rawUrl(file.id)}
              page={page}
              width={width}
              onInfo={setInfo}
              onError={(status) => setFailed(status === 503 ? errorMessage('storage_not_configured') : 'เปิดไฟล์ไม่ได้ ลองเปิดในแท็บใหม่')}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- ไฟล์ราชการผ่าน route ตรวจสิทธิ์ ไม่ผ่าน next/image
            <img
              src={rawUrl(file.id)}
              alt={file.name}
              onLoad={(e) => setImgAspect(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth)}
              onError={() => setFailed('เปิดไฟล์ไม่ได้ ลองเปิดในแท็บใหม่')}
              className="absolute inset-0 h-full w-full"
            />
          )}

          <svg
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            style={{ pointerEvents: pen ? 'auto' : 'none', touchAction: pen ? 'none' : 'auto', cursor: pen ? 'crosshair' : undefined }}
            onPointerDown={pen ? penDown : undefined}
            onPointerMove={pen ? penMove : undefined}
            onPointerUp={pen ? penUp : undefined}
            onPointerCancel={pen ? penUp : undefined}
          >
            {[...past, ...mine.map(({ m }) => m)].flatMap((m, i) =>
              m.type === 'ink'
                ? m.strokes.map((s, j) => <Line key={`${i}-${j}`} points={strokePoints(s)} />)
                : []
            )}
            {stroke ? <Line points={strokePoints(stroke)} /> : null}
          </svg>

          {past.map((m, i) => (m.type === 'stamp' ? <Stamp key={`p${i}`} mark={m} /> : null))}
          {mine.map(({ m, index }) =>
            m.type === 'stamp' ? (
              <Stamp
                key={`d${index}`}
                mark={m}
                draft={{
                  pen,
                  onPointerDown: (e) => stampDown(e, index),
                  onPointerMove: stampMove,
                  onPointerUp: () => (drag.current = null),
                  onRemove: () => onDraftChange(removeMark(draft, index)),
                }}
              />
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

function Line({ points }: { points: string }) {
  return (
    <polyline
      points={points}
      fill="none"
      stroke="#1E2A4A"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function Stamp({
  mark,
  draft,
}: {
  mark: StampMark;
  draft?: {
    pen: boolean;
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: () => void;
    onRemove: () => void;
  };
}) {
  const color = STAMP_COLORS[mark.stamp];
  return (
    <div
      className={`absolute select-none whitespace-nowrap rounded-md border-2 bg-white/60 px-[0.6em] py-[0.15em] font-bold ${draft && !draft.pen ? 'cursor-move touch-none ring-2 ring-sb-accent/40' : 'pointer-events-none'}`}
      style={{
        left: `${mark.x * 100}%`,
        top: `${mark.y * 100}%`,
        transform: `translate(-50%, -50%) rotate(${mark.rot}deg)`,
        color,
        borderColor: color,
        fontSize: 'clamp(10px, 3.2cqw, 22px)',
      }}
      onPointerDown={draft?.onPointerDown}
      onPointerMove={draft?.onPointerMove}
      onPointerUp={draft?.onPointerUp}
    >
      {STAMP_LABELS[mark.stamp]}
      {draft && !draft.pen ? (
        <button
          type="button"
          aria-label={`เอาตรา ${STAMP_LABELS[mark.stamp]} ออก`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={draft.onRemove}
          className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-sb-danger text-white"
        >
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: ตรวจชนิดและ lint**

Run: `npx tsc --noEmit && npx eslint src/components/saraban/DocViewer.tsx src/components/saraban/PdfPage.tsx`
Expected: ผ่าน · ถ้า `react-hooks` บ่นเรื่อง ref/setState ใน effect ให้แก้ตามกฎ (เช่นย้าย `setPdf(null)` ออกจาก cleanup ไปใส่ `key={url}` ที่ผู้เรียกแทน) ห้ามปิดกฎทั้งไฟล์ · ถ้า `sb-danger`/`sb-hover` ไม่มีใน token ให้ดู `src/styles` หรือ `globals.css` แล้วใช้ token ที่มีจริง

- [ ] **Step 4: Commit**

```bash
git add src/components/saraban/PdfPage.tsx src/components/saraban/DocViewer.tsx
git commit -m "feat(saraban): ตัวดูเอกสาร pdf.js พร้อมชั้นตรา ลายมือ และเครื่องมือ"
```

---

### Task 10: หน้าเกษียนโหมดเต็ม

**Files:**
- Modify: `src/pages/saraban/annotate/[id].tsx`

- [ ] **Step 1: แก้ import**

คง `fileUrl` ใน import ของ `@/lib/saraban-api` ไว้ (ใช้เป็น `openUrl` และฐานของ `rawUrl`) · เพิ่ม:

```tsx
import DocViewer from '@/components/saraban/DocViewer';
import { withRaw } from '@/lib/saraban-view';
import type { SarabanDoc, SarabanMark, SarabanUnit } from '@/types/saraban';
```

(รวม `thaiDateTime` กับ `withRaw` ในบรรทัด import `@/lib/saraban-view` เดียวกัน · แทนบรรทัด import type เดิม)

- [ ] **Step 2: state ร่าง แทน `fileId`**

แทน `const [fileId, setFileId] = useState<string | null>(null);` ด้วย:

```tsx
  // ร่างตราอยู่ที่หน้า (ไม่อยู่ใน viewer) — 409 stale แล้ว refetch ตราที่วางไว้ต้องไม่หาย เหมือน note
  const [marks, setMarks] = useState<SarabanMark[]>([]);
```

ลบบรรทัด `const file = doc.files.find((f) => f.id === fileId) ?? doc.files[0];`

- [ ] **Step 3: ส่งตราไปกับการเกษียน**

ใน `submit` เปลี่ยน `const updated = await annotateDoc(doc, body);` เป็น:

```tsx
      const updated = await annotateDoc(doc, { ...body, marks });
      setMarks([]);
```

- [ ] **Step 4: แทน section ซ้ายทั้งก้อน** (ตั้งแต่ `<section className={`${card} overflow-hidden`}>` ถึง `</section>` แรก) ด้วย:

```tsx
        <section className={`${card} overflow-hidden`}>
          <DocViewer
            files={doc.files}
            events={doc.events}
            rawUrl={(fileId) => withRaw(fileUrl(doc.id, fileId))}
            openUrl={(fileId) => fileUrl(doc.id, fileId)}
            tools={canAnnotate(doc) ? 'stamp' : 'none'}
            draft={marks}
            onDraftChange={setMarks}
          />
        </section>
```

- [ ] **Step 5: แก้คอมเมนต์หัวไฟล์**

```tsx
// หน้าเกษียน (สเปกรอบ 2 ข้อ 5 · ต้นแบบจอ 5) — ซ้าย "เอกสาร": DocViewer วางตราได้ (สเปกรอบ 4 — ลายมือ/
// ลงนามต้องเป็นเจ้าตัวในงานของฉัน ธุรการทำแทนได้แค่ตรา) · ขวา: ประวัติเกษียน + ฟอร์มสั่งการ
```

- [ ] **Step 6: ตรวจ**

Run: `npx tsc --noEmit && npx eslint 'src/pages/saraban/annotate/[id].tsx'`
Expected: ผ่าน

- [ ] **Step 7: Commit**

```bash
git add 'src/pages/saraban/annotate/[id].tsx'
git commit -m "feat(saraban): หน้าเกษียนใช้ตัวดูเอกสารและวางตราไปกับการเกษียน"
```

---

### Task 11: หน้าหนังสือโหมดเจ้าหน้าที่ + ช่อง "ลงนามในระบบ"

**Files:**
- Modify: `src/components/saraban/AnnotateForm.tsx` (ชนิด `AnnotateSubmit`)
- Modify: `src/components/saraban/MemberActionForm.tsx`
- Modify: `src/pages/saraban/me/doc/[id].tsx`

- [ ] **Step 1: `AnnotateSubmit` รับ `sign`** — ใน `src/components/saraban/AnnotateForm.tsx`:

```tsx
// sign: เฉพาะโหมดงานของฉัน (MemberActionForm) — ฟอร์มโหมดเต็มไม่ส่ง
export type AnnotateSubmit = { note: string; route: AnnotateRoute; circulateTo: string[]; sign?: boolean };
```

- [ ] **Step 2: ช่องติ๊กใน `MemberActionForm.tsx`**

เพิ่ม state ใต้ `const [note, setNote] = useState('');`:

```tsx
  const [sign, setSign] = useState(false);
```

ใน `submit()` เพิ่มคีย์ใน object ที่ส่ง `onSubmit`:

```tsx
      // ลงนามได้เฉพาะ ทราบ·จบเรื่อง / ส่งต่อ (สเปกรอบ 4 ข้อ 4) — แจ้งเวียนไม่ใช่การสั่งการ
      sign: choice !== 'circulate' && sign,
```

วางก่อน `<p aria-live="polite" …>{summary}</p>`:

```tsx
      {choice !== 'circulate' ? (
        <label className="flex items-start gap-2.5 rounded-xl border border-sb-line px-3 py-2.5">
          <input type="checkbox" checked={sign} onChange={(e) => setSign(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none" />
          <span>
            <span className="block text-sm font-semibold">ลงนามในระบบ</span>
            <span className="block text-xs text-sb-muted">บันทึกชื่อ เวลา IP และรหัสตรวจสอบไฟล์ (sha256) ของหนังสือนี้</span>
          </span>
        </label>
      ) : null}
```

`summary` ของ close ("เปิดกลับไม่ได้") คงเดิม — การดึงเรื่องกลับเป็นของผู้จัดการ สำหรับเจ้าหน้าที่ข้อความนี้ยังจริง

- [ ] **Step 3: หน้า `src/pages/saraban/me/doc/[id].tsx`**

import เพิ่ม:

```tsx
import DocViewer from '@/components/saraban/DocViewer';
import type { SarabanMark } from '@/types/saraban';
```

และเพิ่ม `withRaw` ใน import ของ `@/lib/saraban-view`

state ใต้ `const [busy, setBusy] = useState(false);`:

```tsx
  // ร่างตรา/ลายมืออยู่ที่หน้า — stale/not_holder แล้ว refetch ของที่วาดไว้ไม่หาย
  const [marks, setMarks] = useState<SarabanMark[]>([]);
```

แทนบล็อก `{doc.files.length ? ( <div className="mt-3 flex flex-col gap-1.5"> … </div> ) : null}` ด้วย `null` (ลบทิ้ง) แล้ววาง section ใหม่ระหว่าง `</section>` ของการ์ดหัวเรื่องกับ section "ที่ผ่านมา":

```tsx
      {doc.files.length ? (
        <section className="overflow-hidden rounded-2xl border border-sb-line bg-white" aria-label="เอกสาร">
          <DocViewer
            files={doc.files}
            events={doc.events}
            rawUrl={(fileId) => withRaw(memberFileUrl(doc.id, fileId, as))}
            openUrl={(fileId) => memberFileUrl(doc.id, fileId, as)}
            tools={actions.annotateAs ? 'stamp+ink' : 'none'}
            draft={marks}
            onDraftChange={setMarks}
          />
        </section>
      ) : null}
```

ใน `onSubmit` ของ `MemberActionForm` เปลี่ยน `memberAnnotate(doc, body, as)` เป็น:

```tsx
              () => memberAnnotate(doc, { ...body, marks }, as),
```

และข้อความ toast:

```tsx
              `${body.route.kind === 'close' ? 'จบเรื่องแล้ว' : body.route.kind === 'forward' ? 'ส่งต่อแล้ว' : 'แจ้งเวียนแล้ว'}${body.sign ? ' · ลงนามในระบบแล้ว' : ''}`
```

(`run()` พาออกจากหน้าเมื่อสำเร็จ ร่างจึงไม่ต้องล้างเอง)

- [ ] **Step 4: ตรวจ**

Run: `npx tsc --noEmit && npx eslint src/components/saraban/MemberActionForm.tsx src/components/saraban/AnnotateForm.tsx 'src/pages/saraban/me/doc/[id].tsx'`
Expected: ผ่าน

- [ ] **Step 5: Commit**

```bash
git add src/components/saraban/AnnotateForm.tsx src/components/saraban/MemberActionForm.tsx 'src/pages/saraban/me/doc/[id].tsx'
git commit -m "feat(saraban): งานของฉันดูเอกสาร วางตรา เขียนลายมือ และติ๊กลงนามในระบบ"
```

---

### Task 12: ไทม์ไลน์ (`EventDetail`) และซ่อนปุ่มลบไฟล์ที่ถูกอ้าง

**Files:**
- Modify: `src/components/saraban/EventDetail.tsx`
- Modify: `src/pages/saraban/track/[id].tsx:320`

- [ ] **Step 1: เขียน `EventDetail.tsx` ใหม่ทั้งไฟล์**

```tsx
// บรรทัดรายละเอียดของ event บนไทม์ไลน์ (หน้าติดตาม หน้าเกษียน งานของฉันใช้ร่วม) — แสดงจากชื่อที่เก็บ
// ใน event ณ เวลาที่ทำ ไม่ค้นสมุดใหม่ (สเปกแม่ข้อ 3) · รอบ 4: ตรา · ลายมือ · ลงนามในระบบ
import Icon from '@/components/Icon';
import { STAMP_COLORS, STAMP_LABELS } from '@/lib/saraban-labels';
import { inkPageCount } from '@/lib/saraban-mark';
import { thaiDateTime } from '@/lib/saraban-view';
import { STAMP_KINDS, type SarabanEvent } from '@/types/saraban';

export default function EventDetail({ event }: { event: SarabanEvent }) {
  if (event.kind === 'acknowledged') {
    return <p className="mt-0.5 text-[13px]">{event.unitName} ทราบแล้ว</p>;
  }
  if (event.kind !== 'annotated') return null;
  const marks = event.marks ?? [];
  // ชนิดตราที่ใช้ เรียงตาม STAMP_KINDS ไม่ซ้ำ
  const stamps = STAMP_KINDS.filter((k) => marks.some((m) => m.type === 'stamp' && m.stamp === k));
  const inkPages = inkPageCount(marks);
  const routeLine = event.route === 'forward' || event.route === 'close';
  if (!routeLine && !event.circulateTo?.length && !stamps.length && !inkPages && !event.signature) return null;
  return (
    <div className="mt-1 flex flex-col gap-0.5 text-[13px]">
      {event.route === 'forward' ? <p className="font-medium text-sb-accent"><span aria-hidden>→</span> ส่งต่อ {event.toUnitName}</p> : null}
      {event.route === 'close' ? <p className="font-medium text-sb-success"><span aria-hidden>→</span> ส่งคืนสารบรรณ (จบเรื่อง)</p> : null}
      {event.circulateTo?.length ? (
        <p className="text-sb-warning-ink">เวียนให้ทราบ: {event.circulateTo.map((c) => c.unitName).join(' · ')}</p>
      ) : null}
      {stamps.length ? (
        <p>
          ตรา:{' '}
          {stamps.map((k, i) => (
            <span key={k} className="font-semibold" style={{ color: STAMP_COLORS[k] }}>
              {i > 0 ? ', ' : ''}
              {STAMP_LABELS[k]}
            </span>
          ))}
        </p>
      ) : null}
      {inkPages ? <p className="text-sb-muted">มีลายมือ {inkPages} หน้า</p> : null}
      {event.signature ? (
        <div className="mt-0.5 rounded-lg border border-sb-line px-2.5 py-1.5">
          <p className="flex items-center gap-1 font-medium">
            <Icon name="check_circle" size={16} className="text-sb-success" />
            ลงนามในระบบ · {event.byName} · {thaiDateTime(event.at)}
          </p>
          {event.signature.files.length === 0 ? (
            <p className="text-xs text-sb-muted">ลงนามข้อความเกษียน (ไม่มีไฟล์แนบ)</p>
          ) : (
            event.signature.files.map((f) => (
              <details key={f.fileId} className="text-xs text-sb-muted">
                <summary className="cursor-pointer">
                  {f.name} · <code>{f.sha256.slice(0, 8)}</code>
                </summary>
                <code className="block break-all">{f.sha256}</code>
              </details>
            ))
          )}
        </div>
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

- [ ] **Step 2: หน้าติดตามซ่อนปุ่มลบ**

ใน `src/pages/saraban/track/[id].tsx` import `isFileReferenced` จาก `@/lib/saraban-mark` แล้วแก้บรรทัด ~320:

```tsx
                      {canRemoveFile(doc) && !isFileReferenced(doc, f.id) ? (
```

- [ ] **Step 3: ตรวจ**

Run: `npx tsc --noEmit && npx eslint src/components/saraban/EventDetail.tsx 'src/pages/saraban/track/[id].tsx'`
Expected: ผ่าน

- [ ] **Step 4: Commit**

```bash
git add src/components/saraban/EventDetail.tsx 'src/pages/saraban/track/[id].tsx'
git commit -m "feat(saraban): ไทม์ไลน์แสดงตรา ลายมือ และการลงนามในระบบ · ซ่อนปุ่มลบไฟล์ที่ถูกอ้าง"
```

---

### Task 13: ตรวจทั้งชุด + smoke บน dev server (ไม่มี bucket)

**Files:**
- Create (scratchpad เท่านั้น ไม่ commit): `/private/tmp/claude-501/-Users-thanawatsodsri-Fullstack-namphrae-portal/9477396c-17b0-4b58-a8f8-79a6ed856c9e/scratchpad/smoke-r4.py`

- [ ] **Step 1: ทั้งชุด**

Run: `npm test && npm run lint && npx tsc --noEmit && npx next build`
Expected: ผ่านทั้งหมด · build ไม่มี error เรื่อง pdfjs worker (ถ้า Turbopack แก้ `new URL('pdfjs-dist/build/…', import.meta.url)` ไม่ได้ ให้คัด worker ไป `public/pdf.worker.min.mjs` ด้วยสคริปต์ `postinstall` แล้วตั้ง `workerSrc = '/pdf.worker.min.mjs'` — แจ้งผู้ใช้ก่อนเพิ่มไฟล์ใน public)

- [ ] **Step 2: worktree ไม่มี `.env.local` (dev-open + file backend + ไม่มี bucket) port 3100**

```bash
git worktree add /private/tmp/claude-501/-Users-thanawatsodsri-Fullstack-namphrae-portal/9477396c-17b0-4b58-a8f8-79a6ed856c9e/scratchpad/r4wt HEAD
cd /private/tmp/claude-501/-Users-thanawatsodsri-Fullstack-namphrae-portal/9477396c-17b0-4b58-a8f8-79a6ed856c9e/scratchpad/r4wt && ln -s /Users/thanawatsodsri/Fullstack/namphrae-portal/node_modules node_modules && npx next dev -p 3100
```

(รันแบบ background · ตรวจว่าไม่มี `.env.local` ใน worktree ก่อนรัน)

- [ ] **Step 3: สคริปต์ smoke** — เขียน `smoke-r4.py` ใน scratchpad (แบบ `smoke4.py` เดิม: `req()`/`check()`) ให้ครอบ:

```python
import json, uuid, urllib.request, urllib.error, pathlib
B='http://localhost:3100'
DATA=pathlib.Path('/private/tmp/claude-501/-Users-thanawatsodsri-Fullstack-namphrae-portal/9477396c-17b0-4b58-a8f8-79a6ed856c9e/scratchpad/r4wt/data/saraban-docs.json')
def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(B+path, data=data, method=method, headers={'content-type':'application/json'})
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, json.loads(resp.read() or b'null')
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read())
        except Exception: return e.code, None
def check(label, got, want):
    print(('PASS' if got==want else 'FAIL'), label, '->', got, '' if got==want else f'(want {want})')
def receive(subject):
    s, d = req('POST','/api/admin/saraban/docs?kind=receive', {'id':str(uuid.uuid4()),'ref':'ชม 4/1','docDate':'2026-11-05','party':'อำเภอ','subject':subject,'holderUnitId':'palad','files':[]})
    assert s in (200,201), (s,d); return d
def add_fake_file(did, pages=2):
    docs = json.loads(DATA.read_text())
    for d in docs:
        if d['id']==did:
            d['files'].append({'id':'fake1','key':'saraban/fake1.pdf','name':'fake.pdf','format':'pdf','bytes':10,'pages':pages,'uploadedAt':d['updatedAt'],'uploadedBy':'dev-open'})
            d['updatedAt']=d['updatedAt']  # คงเวอร์ชันเดิม
    DATA.write_text(json.dumps(docs, ensure_ascii=False, indent=2))
STAMP={'type':'stamp','fileId':'fake1','page':2,'stamp':'approve','x':0.5,'y':0.3,'rot':-4}
INK={'type':'ink','fileId':'fake1','page':1,'strokes':[[0.1,0.1,0.2,0.2]]}
A=lambda upd, **kw: {'action':'annotate','updatedAt':upd,'note':'ทดสอบ','route':{'kind':'stay'}, **kw}

d = receive('รอบ4 มีไฟล์'); did=d['id']; add_fake_file(did)
s,b=req('PATCH',f'/api/admin/saraban/docs/{did}', A(d['updatedAt'], marks=[INK]))
check('1 โหมดเต็ม ink -> 400 self_only', (s,b.get('error')), (400,'self_only'))
s,b=req('PATCH',f'/api/admin/saraban/docs/{did}', A(d['updatedAt'], sign=True))
check('2 โหมดเต็ม sign -> 400 self_only', (s,b.get('error')), (400,'self_only'))
s,b=req('PATCH',f'/api/admin/saraban/docs/{did}', A(d['updatedAt'], marks=[{**STAMP,'page':3}]))
check('3 หน้าเกิน -> 400 invalid_mark', (s,b.get('error')), (400,'invalid_mark'))
s,b=req('PATCH',f'/api/admin/saraban/docs/{did}', A(d['updatedAt'], marks=[{**STAMP,'fileId':'nope'}]))
check('4 ไฟล์ผิด -> 400 invalid_mark', (s,b.get('error')), (400,'invalid_mark'))
s,b=req('PATCH',f'/api/admin/saraban/docs/{did}', A(d['updatedAt'], marks=[STAMP]))
check('5 โหมดเต็มวางตรา', (s, b['events'][-1].get('marks')), (200,[STAMP])); upd=b['updatedAt']
check('5b ไม่มี signature', 'signature' in b['events'][-1], False)
s,b=req('PATCH',f'/api/admin/saraban/me/docs/{did}?as=palad', A(upd, marks=[INK], sign=True))
check('6 มีไฟล์ ลงนาม ไม่มี bucket -> 503', (s,b.get('error')), (503,'storage_not_configured'))
s,b=req('PATCH',f'/api/admin/saraban/me/docs/{did}?as=palad', A(upd, marks=[INK]))
check('7 เจ้าตัวเขียนลายมือ', (s, b['events'][-1]['marks'][0]['type']), (200,'ink'))
s,_=req('GET',f'/api/admin/saraban/docs/{did}/files/fake1?raw=1')
check('8 raw ไม่มี bucket -> 503', s, 503)

e = receive('รอบ4 ไม่มีไฟล์'); eid=e['id']
s,b=req('PATCH',f'/api/admin/saraban/me/docs/{eid}?as=palad', {'action':'annotate','updatedAt':e['updatedAt'],'note':'ทราบ','route':{'kind':'close'},'sign':True})
sig=b.get('events',[{}])[-1].get('signature') if s==200 else None
check('9 ลงนามไม่มีไฟล์ -> files: []', (s, sig and sig['files']), (200, []))
check('9b มี ip', isinstance(sig and sig.get('ip'), str), True)
for p in [f'/saraban/annotate/{did}', f'/saraban/me/doc/{did}?as=palad', f'/saraban/track/{did}']:
    print('PAGE', urllib.request.urlopen(B+p).status, p)
```

Run: `python3 -I /private/tmp/claude-501/-Users-thanawatsodsri-Fullstack-namphrae-portal/9477396c-17b0-4b58-a8f8-79a6ed856c9e/scratchpad/smoke-r4.py`
Expected: PASS ทุกบรรทัด · PAGE 200 สามหน้า (ถ้า `palad` ไม่ใช่ unit id ใน seed ของ file backend ให้ดูจาก `GET /api/admin/saraban/units` แล้วเปลี่ยน)

- [ ] **Step 4: ดูในเบราว์เซอร์ (หน้าที่ไม่มีไฟล์จริง)** — เปิด `http://localhost:3100/saraban/me/doc/<did>?as=palad` ตรวจด้วยตา: แถบเครื่องมือขึ้น · ข้อความ "ยังไม่ได้ตั้งค่าที่เก็บไฟล์" ในกล่องกระดาษ · ช่องติ๊กลงนามขึ้นเมื่อเลือก ทราบ·จบเรื่อง/ส่งต่อ และหายเมื่อแจ้งเวียน · ไทม์ไลน์มี "ตรา: เห็นชอบ" และ "มีลายมือ 1 หน้า" · หน้าเลขที่ไม่มีไฟล์แสดง "ลงนามในระบบ · … · ลงนามข้อความเกษียน"

- [ ] **Step 5: เก็บกวาด** — หยุด dev 3100 · `git worktree remove --force <r4wt>` · ถ้าแก้อะไรระหว่าง smoke ให้ commit แยกพร้อมข้อความบอกสิ่งที่แก้

---

### Task 14: กรณีที่ต้องมีไฟล์จริง (ต้องถามผู้ใช้ก่อน)

- [ ] **Step 1: ถามผู้ใช้** ว่ามี bucket **ทดสอบ** ให้ใช้หรือไม่ (`.env.local` ตอนนี้เป็น bucket + Mongo ของจริง — ห้ามใช้) · ถ้าไม่มี ข้ามงานนี้แล้วบันทึกใน PR ว่ายังไม่ได้ทดสอบ: เรนเดอร์ PDF จริง, raw 200 + header, sha256 ตรงกับ `shasum -a 256`, DELETE ไฟล์ที่ถูกอ้าง → 409 `file_referenced`
- [ ] **Step 2: ถ้ามี bucket ทดสอบ** — ใน worktree ใส่ `.env.local` ที่มีแค่ `BUCKET_*` ของ bucket ทดสอบ (ไม่มี Mongo/Clerk) · อัป PDF 2 หน้าผ่านหน้าลงรับ · ตรวจ 4 ข้อข้างบน · ตรวจด้วยตาบนมือถือ (DevTools) ว่าลากตราและเขียนลายมือแล้วหน้าไม่เลื่อน
