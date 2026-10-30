# แผนลงมือรอบ 1C — หน้าจอระบบสารบรรณ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้าจอรอบ 1 ครบตามสเปกข้อ 6–7 — shell `/saraban` · ทะเบียนรับ/ส่ง/เวียน · ลงรับ · ออกเลขส่ง ·
หน้าหนังสือ (แก้ไข/ยกเลิก/ส่งแล้ว/ไฟล์แนบ/ไทม์ไลน์) · สมุดผู้รับ — บน API ของรอบ 1B

**Architecture:** Pages Router แบบหน้าหลังบ้านเดิม (`getFeatureSsrProps('saraban')` + `withMemberGuard` +
SWR) แต่ใช้ shell ของตัวเอง `SarabanLayout` (สเปกข้อ 1.3) · ตรรกะของหน้าจอที่ตัดสินอะไรได้อยู่ใน
`saraban-view.ts` (บริสุทธิ์ มีเทสต์) · component เป็นตัววาดบาง ๆ · ตัวเรียก API อยู่ใน `saraban-api.ts`

**Tech Stack:** Next.js 16 Pages Router · React 19 · Tailwind v4 (`@theme`) · SWR 2 · `next/font/google`
IBM Plex Sans Thai · Material Symbols (ชุดเดียวกับพอร์ทัล)

**สเปก:** ข้อ 2 (ไฟล์) · 6 (หน้าจอ) · 7 (หน้าตา) · **API:** [แผน 1B](2026-10-30-saraban-1b-api.md) หัวข้อ
"ส่งต่อรอบ 1C" · **แบบ:** `docs/design_handoff_esaraban/` (high-fidelity)

---

## โครงไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/styles/globals.css` | **แก้** — โทเคน `--color-sb-*` + focus ring ภายใน `.saraban` |
| `src/lib/saraban-font.ts` | IBM Plex Sans Thai — มีแค่ `SarabanLayout` import (สเปกข้อ 7) |
| `public/saraban/logo.jpeg` | ตราเทศบาล (จาก handoff/assets) |
| `src/lib/icons.ts` | **แก้** — ชื่อไอคอนที่สารบรรณใช้ |
| `src/components/admin/AdminLayout.tsx` | **แก้** — เมนู "ระบบสารบรรณ" |
| `src/lib/saraban-view.ts` (+test) | ตรรกะหน้าจอบริสุทธิ์: ปุ่มกรอง · วันที่ไทย · ข้อความผิดพลาด · key ของ SWR · ตรวจไฟล์ก่อนอัป |
| `src/lib/saraban-api.ts` | ตัวเรียก API ฝั่งเบราว์เซอร์ + ชนิดของคำตอบ |
| `src/components/saraban/toast.tsx` | toast + ส่งข้อความข้ามหน้า (`flashToast`) |
| `src/components/saraban/SarabanLayout.tsx` | shell: sidebar · header · toast |
| `src/components/saraban/bits.tsx` | StatusPill · LevelText · DateField · FilePicker · ปุ่ม/ช่องกรอกมาตรฐาน |
| `src/components/saraban/RegisterPage.tsx` | ทะเบียน (ใช้ร่วม inbox/outbox) |
| `src/pages/saraban/index.tsx` · `inbox.tsx` · `outbox.tsx` · `receive.tsx` · `send.tsx` · `track/[id].tsx` · `units.tsx` | หน้าจอ |

## ข้อตกลงของรอบนี้

- baseline: `npm test` **36 ไฟล์ 526 เทสต์** · tsc · lint สะอาด
- component ไม่มีเทสต์หน่วย (repo เทสต์ตรรกะบริสุทธิ์) — ทุกการตัดสินในหน้าจอต้องอยู่ใน
  `saraban-view.ts` หรือฟังก์ชันของ 1A ที่มีเทสต์แล้ว · ตรวจหน้าจอด้วย `next build` + smoke ผ่าน dev server
- ไฟล์ฝั่งหน้าจอ import ได้เฉพาะไฟล์ client-safe (`saraban-{number,labels,doc,attachment,schema,view,api}`)
  · จาก store/storage ใช้ได้แค่ `import type`
- ไอคอนทุกชื่อต้องอยู่ใน `ICON_NAMES` ไม่งั้นแสดงเป็นตัวหนังสือ

---

## Task 1: โทเคน · ฟอนต์ · ตรา · ไอคอน · เมนูในหลังบ้าน

**Files:** Modify `src/styles/globals.css` · `src/lib/icons.ts` · `src/components/admin/AdminLayout.tsx`
· Create `src/lib/saraban-font.ts` · `public/saraban/logo.jpeg`

- [ ] **Step 1: `globals.css` — เพิ่มใน `@theme` ต่อจาก `--radius-card: 18px;`**

```css

  /* ── ระบบสารบรรณ (/saraban) — สเปก saraban ข้อ 7 · ใช้เฉพาะใต้ .saraban ── */
  --color-sb-accent: #1e4d8c;
  --color-sb-accent-hover: #173d70;
  --color-sb-accent-light: #e8eff8;
  --color-sb-bar-2: #9db7da;
  --color-sb-ink: #1b2430;
  --color-sb-ink-2: #3a4555;
  --color-sb-muted: #66758a;
  --color-sb-page: #eef2f6;
  --color-sb-panel: #f8fafc;
  --color-sb-line: #e3e8ef;
  --color-sb-line-input: #d5dce5;
  --color-sb-subtle: #f1f5fa;
  --color-sb-hover: #f5f7fa;
  --color-sb-success: #1c7c54;
  --color-sb-success-bg: #e6f4ee;
  --color-sb-success-ink: #14532d;
  --color-sb-warning: #b7791f;
  --color-sb-warning-ink: #8a5a00;
  --color-sb-warning-bg: #fdf3e1;
  --color-sb-danger: #b3261e;
  --color-sb-danger-bg: #fdecea;
  --color-sb-purple: #5b3a8c;
  --color-sb-brown: #7a5c1e;
  --color-sb-urgent-row: #fffbf2;
```

และเพิ่มท้ายไฟล์:

```css

/* ระบบสารบรรณ: focus ring ตามแบบ (accent 2px ชิดขอบ) แทนวงเขียว 3px ของพอร์ทัล — สเปก saraban ข้อ 7 */
.saraban a:focus-visible,
.saraban button:focus-visible,
.saraban input:focus-visible,
.saraban select:focus-visible,
.saraban textarea:focus-visible {
  outline: 2px solid var(--color-sb-accent);
  outline-offset: -1px;
}
```

- [ ] **Step 2: `src/lib/saraban-font.ts`**

```ts
// src/lib/saraban-font.ts
// ฟอนต์ของระบบสารบรรณตามแบบ — แยกจาก fonts.ts โดยตั้งใจ (สเปกข้อ 7): fonts.ts ถูก _app.tsx import
// ถ้าวางที่นั่น CSS ของฟอนต์นี้จะติดไปทุกหน้าของพอร์ทัล · มีแค่ SarabanLayout ที่ import ไฟล์นี้
import { IBM_Plex_Sans_Thai } from 'next/font/google';

export const sarabanFont = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
```

- [ ] **Step 3: ตรา + ไอคอน**

```bash
mkdir -p public/saraban && cp docs/design_handoff_esaraban/assets/logo.jpeg public/saraban/logo.jpeg
```

ใน `ICON_NAMES` ของ `src/lib/icons.ts` เพิ่มชื่อเหล่านี้ (คงการเรียงตามตัวอักษร): `apartment` ·
`attach_file` · `block` · `check` · `close` · `content_copy` · `history` · `mail` · `move_to_inbox` ·
`outbox` · `send` · `tag` · `upload_file`

- [ ] **Step 4: เมนูในหลังบ้าน — `AdminLayout.tsx`**

ใน `NAV` เพิ่มรายการต่อจาก `ข้อมูลป่าไม้`:

```ts
  { href: '/saraban', label: 'ระบบสารบรรณ', icon: 'mail', exact: false, feature: 'saraban' },
```

- [ ] **Step 5: ตรวจ**

Run: `npx tsc --noEmit -p . && npm test && npm run lint`
Expected: ผ่านทั้งหมด (`36 passed` · `526 passed`)

- [ ] **Step 6: Commit**

```bash
git add src/styles/globals.css src/lib/saraban-font.ts public/saraban/logo.jpeg src/lib/icons.ts src/components/admin/AdminLayout.tsx
git commit -m "feat(saraban): โทเคนสี ฟอนต์ ตรา และเมนูระบบสารบรรณในหลังบ้าน"
```

---

## Task 2: `saraban-view.ts` — ตรรกะของหน้าจอ

**Files:** Create `src/lib/saraban-view.ts` · Test `src/lib/saraban-view.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
// src/lib/saraban-view.test.ts
import { describe, expect, it } from 'vitest';
import {
  changeValue,
  dateHint,
  docsKey,
  errorMessage,
  fileSizeLabel,
  isUrgentOpen,
  precheckFile,
  thaiDate,
  thaiDateTime,
  viewsOf,
} from '@/lib/saraban-view';
import type { RegisterView } from '@/lib/saraban-doc';

const COUNTS: Record<RegisterView, number> = {
  all: 9,
  pending: 3,
  'in-progress': 2,
  done: 3,
  void: 0,
  overdue: 1,
};

describe('viewsOf — ปุ่มกรองแยกตามทะเบียน (สเปกข้อ 6)', () => {
  it('รับ: ทั้งหมด รอเกษียน ดำเนินการ เสร็จสิ้น เกินกำหนด พร้อมจำนวน', () => {
    expect(viewsOf('in', COUNTS)).toEqual([
      { view: 'all', label: 'ทั้งหมด', count: 9 },
      { view: 'pending', label: 'รอเกษียน', count: 3 },
      { view: 'in-progress', label: 'ดำเนินการ', count: 2 },
      { view: 'done', label: 'เสร็จสิ้น', count: 3 },
      { view: 'overdue', label: 'เกินกำหนด', count: 1 },
    ]);
  });

  it('ส่ง/เวียน: ทั้งหมด รอส่ง ส่งแล้ว — ไม่มี "รอส่ง" สองปุ่ม', () => {
    expect(viewsOf('out', COUNTS).map((b) => b.label)).toEqual(['ทั้งหมด', 'รอส่ง', 'ส่งแล้ว']);
    expect(viewsOf('circular', COUNTS).map((b) => b.view)).toEqual(['all', 'in-progress', 'done']);
  });

  it('"ยกเลิก" ต่อท้ายเมื่อมีอย่างน้อย 1', () => {
    expect(viewsOf('in', { ...COUNTS, void: 2 }).at(-1)).toEqual({ view: 'void', label: 'ยกเลิก', count: 2 });
  });
});

describe('วันที่ไทย', () => {
  it('thaiDate: ISO → วัน เดือนย่อ ปี พ.ศ. · ว่างหรือผิดรูป → ""', () => {
    expect(thaiDate('2026-09-13')).toBe('13 ก.ย. 2569');
    expect(thaiDate('')).toBe('');
    expect(thaiDate('2026-13-01')).toBe('');
  });

  it('thaiDateTime: เวลากรุงเทพฯ ไม่ขึ้นกับ timezone ของเครื่อง — ข้ามเที่ยงคืน UTC ได้วันถัดไป', () => {
    expect(thaiDateTime('2026-09-13T02:42:00.000Z')).toBe('13 ก.ย. 2569 09:42');
    expect(thaiDateTime('2026-09-30T17:30:00.000Z')).toBe('1 ต.ค. 2569 00:30');
    expect(thaiDateTime('nope')).toBe('');
  });

  it('dateHint: บอกวันที่ พ.ศ. ใต้ช่อง และเตือนปี พ.ศ. ที่พิมพ์ลงช่อง ค.ศ.', () => {
    expect(dateHint('')).toEqual({ text: '', warn: false });
    expect(dateHint('2026-09-13')).toEqual({ text: '= 13 ก.ย. 2569', warn: false });
    expect(dateHint('2569-09-13')).toEqual({
      text: 'ปี 2569 ดูเหมือนเป็น พ.ศ. — ช่องนี้ใช้ ค.ศ. (2026)',
      warn: true,
    });
    expect(dateHint('2026-02-30')).toEqual({ text: 'วันที่ไม่มีอยู่จริง', warn: true });
  });
});

describe('ตัวช่วยอื่น', () => {
  it('fileSizeLabel', () => {
    expect(fileSizeLabel(1_258_291)).toBe('1.2 MB');
    expect(fileSizeLabel(820 * 1024)).toBe('820 KB');
    expect(fileSizeLabel(10)).toBe('1 KB');
  });

  it('isUrgentOpen: ด่วนขึ้นไปและยังเปิดอยู่เท่านั้น (พื้นแถวสีอ่อน)', () => {
    expect(isUrgentOpen({ level: 'urgent', status: 'pending' })).toBe(true);
    expect(isUrgentOpen({ level: 'most-urgent', status: 'done' })).toBe(false);
    expect(isUrgentOpen({ level: 'normal', status: 'pending' })).toBe(false);
  });

  it('errorMessage: รหัสที่รู้จักเป็นภาษาไทย ที่ไม่รู้จักได้ข้อความกลาง (รวมชื่อที่ชน Object.prototype)', () => {
    expect(errorMessage('number_busy')).toBe('มีคนลงรับพร้อมกัน กดอีกครั้ง');
    expect(errorMessage('constructor')).toBe('เกิดข้อผิดพลาด ลองอีกครั้ง');
    expect(errorMessage(undefined)).toBe('เกิดข้อผิดพลาด ลองอีกครั้ง');
  });

  it('docsKey: ใส่เฉพาะค่าที่ไม่ใช่ค่าเริ่มต้น', () => {
    expect(docsKey({ register: 'in' })).toBe('/api/admin/saraban/docs?register=in');
    expect(docsKey({ register: 'out', year: 2569, view: 'done', page: 2 })).toBe(
      '/api/admin/saraban/docs?register=out&year=2569&view=done&page=2'
    );
    expect(docsKey({ register: 'in', view: 'all', page: 1 })).toBe('/api/admin/saraban/docs?register=in');
  });

  it('changeValue: แปลค่าดิบในประวัติการแก้ไข', () => {
    expect(changeValue('level', 'very-urgent')).toBe('ด่วนมาก');
    expect(changeValue('docDate', '2026-09-13')).toBe('13 ก.ย. 2569');
    expect(changeValue('dueDate', '')).toBe('—');
    expect(changeValue('subject', 'เรื่อง')).toBe('เรื่อง');
  });

  it('precheckFile: กันไฟล์ใหญ่และนามสกุลแปลกก่อนอัป (เซิร์ฟเวอร์ยังตรวจเนื้อไฟล์ซ้ำ)', () => {
    expect(precheckFile({ name: 'a.PDF', size: 100 })).toBeNull();
    expect(precheckFile({ name: 'a.jpeg', size: 100 })).toBeNull();
    expect(precheckFile({ name: 'a.docx', size: 100 })).toBe('a.docx: รับเฉพาะ PDF, JPG, PNG');
    expect(precheckFile({ name: 'big.pdf', size: 10 * 1024 * 1024 + 1 })).toBe('big.pdf: ใหญ่เกิน 10 MB');
  });
});
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/saraban-view.test.ts`
Expected: FAIL — `Cannot find module '@/lib/saraban-view'`

- [ ] **Step 3: เขียนโค้ด**

```ts
// src/lib/saraban-view.ts
// ตรรกะของหน้าจอสารบรรณ (รอบ 1C) — client-safe บริสุทธิ์ แยกจาก component เพื่อเทสต์ได้
// component วาดอย่างเดียว ทุกการตัดสิน (ปุ่มไหนโชว์ ข้อความไหน วันที่แบบไหน) อยู่ที่นี่

import { MAX_FILE_BYTES } from '@/lib/saraban-attachment';
import { isOpen, type RegisterView } from '@/lib/saraban-doc';
import { LEVEL_LABELS, statusLabel } from '@/lib/saraban-labels';
import type { SarabanDoc, SarabanLevel, SarabanRegister } from '@/types/saraban';

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ViewButton = { view: RegisterView; label: string; count: number };

/**
 * ปุ่มกรองของทะเบียน (สเปกข้อ 6) — REGISTER_VIEWS มีครบ 6 ค่าเพื่อ query แต่หน้าส่ง/เวียนห้ามวาด
 * "รอเกษียน/เกินกำหนด" (statusLabel('out', …) จะได้ "รอส่ง" สองปุ่ม) · "ยกเลิก" โชว์เมื่อมีอย่างน้อย 1
 */
export function viewsOf(
  register: SarabanRegister,
  counts: Record<RegisterView, number>
): ViewButton[] {
  const views: RegisterView[] =
    register === 'in'
      ? ['all', 'pending', 'in-progress', 'done', 'overdue']
      : ['all', 'in-progress', 'done'];
  if ((counts.void ?? 0) > 0) views.push('void');
  return views.map((view) => ({
    view,
    label: view === 'all' ? 'ทั้งหมด' : statusLabel(register, view),
    count: counts[view] ?? 0,
  }));
}

function isRealDate(date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** '2026-09-13' → '13 ก.ย. 2569' · ว่างหรือผิดรูป → '' */
export function thaiDate(date: string): string {
  const m = ISO_DATE.exec(date ?? '');
  if (!m) return '';
  const month = Number(m[2]);
  if (month < 1 || month > 12) return '';
  return `${Number(m[3])} ${THAI_MONTHS[month - 1]} ${Number(m[1]) + 543}`;
}

/** ISO timestamp → '13 ก.ย. 2569 09:42' เวลากรุงเทพฯ — คำนวณเอง ไม่พึ่ง timezone/ICU ของเครื่อง */
export function thaiDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + BANGKOK_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${thaiDate(d.toISOString().slice(0, 10))} ${hh}:${mm}`;
}

/**
 * คำอธิบายใต้ช่องวันที่ — ช่อง <input type="date"> รับปี 2569 ได้เงียบ ๆ (เป็นวันที่ที่มีจริงใน ค.ศ.)
 * ป้าย พ.ศ. ใต้ช่องทำให้เห็นความผิดตั้งแต่ก่อนกด (สเปกข้อ 6 หน้า /receive)
 */
export function dateHint(value: string): { text: string; warn: boolean } {
  if (!value) return { text: '', warn: false };
  const year = Number(value.slice(0, 4));
  if (year > 2100) {
    return { text: `ปี ${year} ดูเหมือนเป็น พ.ศ. — ช่องนี้ใช้ ค.ศ. (${year - 543})`, warn: true };
  }
  if (!ISO_DATE.test(value) || year < 1900 || !isRealDate(value)) {
    return { text: 'วันที่ไม่มีอยู่จริง', warn: true };
  }
  return { text: `= ${thaiDate(value)}`, warn: false };
}

export function fileSizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** แถวด่วนที่ยังไม่เสร็จได้พื้นสีอ่อน (handoff "highlightUrgent") */
export function isUrgentOpen(doc: Pick<SarabanDoc, 'level' | 'status'>): boolean {
  return doc.level !== 'normal' && isOpen(doc.status);
}

// ข้อความตามรหัสข้อผิดพลาดของ API (สเปกข้อ 8 + แผน 1B)
const ERROR_MESSAGES: Record<string, string> = {
  number_busy: 'มีคนลงรับพร้อมกัน กดอีกครั้ง',
  stale: 'มีคนแก้หนังสือนี้ไปก่อน โหลดใหม่แล้วลองอีกครั้ง',
  invalid_unit: 'ตำแหน่ง/หน่วยงานที่เลือกใช้ไม่ได้ (ถูกปิด หรือยังไม่มีรหัสส่วนราชการ)',
  invalid_file: 'ไฟล์แนบใช้ไม่ได้ ลองเลือกไฟล์ใหม่',
  file_too_large: 'ไฟล์ใหญ่เกิน 10 MB',
  bad_format: 'รับเฉพาะไฟล์ PDF, JPG, PNG',
  storage_not_configured: 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์ — แนบไฟล์ไม่ได้',
  id_conflict: 'คำขอซ้ำกับหนังสือของผู้อื่น โหลดหน้าใหม่แล้วลองอีกครั้ง',
  year_in_use: 'ปีนี้มีหนังสือแล้ว ตั้งเลขเริ่มต้นไม่ได้',
  invalid_transition: 'ทำรายการนี้กับหนังสือในสถานะนี้ไม่ได้',
  field_locked: 'มีช่องที่แก้ไม่ได้แล้วในสถานะปัจจุบัน',
  too_many_files: 'แนบได้ไม่เกิน 10 ไฟล์ต่อเรื่อง',
  invalid_input: 'ข้อมูลไม่ครบหรือไม่ถูกต้อง',
  not_found: 'ไม่พบหนังสือ',
  feature_denied: 'ไม่มีสิทธิ์ใช้ระบบสารบรรณ',
};

export function errorMessage(code: string | undefined): string {
  return code && Object.hasOwn(ERROR_MESSAGES, code)
    ? ERROR_MESSAGES[code]
    : 'เกิดข้อผิดพลาด ลองอีกครั้ง';
}

/** URL/คีย์ SWR ของทะเบียน — ใส่เฉพาะค่าที่ไม่ใช่ค่าเริ่มต้น หน้าเดียวกันจะได้ cache เดียวกัน */
export function docsKey(q: {
  register: SarabanRegister;
  year?: number;
  view?: RegisterView;
  page?: number;
}): string {
  const p = new URLSearchParams({ register: q.register });
  if (q.year) p.set('year', String(q.year));
  if (q.view && q.view !== 'all') p.set('view', q.view);
  if (q.page && q.page > 1) p.set('page', String(q.page));
  return `/api/admin/saraban/docs?${p}`;
}

/** ค่าในประวัติการแก้ไข — ชั้นความเร็วเก็บเป็นคีย์ วันที่เก็บ ISO ชื่อหน่วยเก็บเป็นชื่อแล้ว (1B) */
export function changeValue(field: string, value: string): string {
  if (!value) return '—';
  if (field === 'level' && Object.hasOwn(LEVEL_LABELS, value)) {
    return LEVEL_LABELS[value as SarabanLevel];
  }
  if (field === 'docDate' || field === 'dueDate') return thaiDate(value) || value;
  return value;
}

/** กันไฟล์ที่ไม่ผ่านแน่ ๆ ก่อนอัป ให้รู้ทันที — เซิร์ฟเวอร์ยังตรวจจากเนื้อไฟล์ซ้ำ (สเปกข้อ 5) */
export function precheckFile(file: { name: string; size: number }): string | null {
  if (file.size > MAX_FILE_BYTES) return `${file.name}: ใหญ่เกิน 10 MB`;
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return `${file.name}: รับเฉพาะ PDF, JPG, PNG`;
  return null;
}
```

- [ ] **Step 4: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/saraban-view.test.ts`
Expected: PASS — 12 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-view.ts src/lib/saraban-view.test.ts
git commit -m "feat(saraban): ตรรกะหน้าจอ ปุ่มกรอง วันที่ไทย และข้อความผิดพลาด"
```

---

## Task 3: ตัวเรียก API · toast · ชิ้นส่วนร่วม

**Files:** Create `src/lib/saraban-api.ts` · `src/components/saraban/toast.tsx` · `src/components/saraban/bits.tsx`

- [ ] **Step 1: `src/lib/saraban-api.ts`**

```ts
// src/lib/saraban-api.ts
// ตัวเรียก API สารบรรณฝั่งเบราว์เซอร์ — โยน SarabanApiError ที่มีรหัสจาก API และข้อความไทย
// (errorMessage) ให้หน้าจอเอาไปแสดงได้ทันที · ชนิดจาก store ใช้แค่ import type (ไม่ดึงโค้ดเซิร์ฟเวอร์)

import type { z } from 'zod';
import type { RegisterView } from '@/lib/saraban-doc';
import type {
  DocKind,
  DocPatch,
  FileRef,
  receiveInputSchema,
  sendInputSchema,
  UnitInput,
  UnitPatch,
  YearStartInput,
} from '@/lib/saraban-schema';
import type { YearInfo } from '@/lib/saraban-store';
import { errorMessage } from '@/lib/saraban-view';
import type { SarabanDoc, SarabanUnit } from '@/types/saraban';

export class SarabanApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(errorMessage(code));
    this.name = 'SarabanApiError';
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let code = '';
    try {
      code = (await res.json())?.error ?? '';
    } catch {
      // body ไม่ใช่ JSON — ใช้ข้อความกลาง
    }
    throw new SarabanApiError(code, res.status);
  }
  return res.json() as Promise<T>;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const sarabanFetcher = <T>(url: string): Promise<T> => call<T>(url);

export const SUMMARY_KEY = '/api/admin/saraban/summary';
export const UNITS_KEY = '/api/admin/saraban/units';
export const yearKey = (register: string) => `/api/admin/saraban/years?register=${register}`;
export const docKey = (id: string) => `/api/admin/saraban/docs/${encodeURIComponent(id)}`;

export type SummaryResponse = { inboxPending: number; storageConfigured: boolean; today: string };
export type DocListResponse = {
  docs: SarabanDoc[];
  total: number;
  page: number;
  pageSize: number;
  fiscalYear: number;
  years: number[];
  counts: Record<RegisterView, number>;
  carryOver: number;
  today: string;
};
export type { YearInfo };

export type ReceiveBody = z.input<typeof receiveInputSchema>;
export type SendBody = z.input<typeof sendInputSchema>;

/** อัปไฟล์หนึ่งไฟล์ — body เป็นตัวไฟล์ดิบ เบราว์เซอร์ใส่ Content-Length ให้เอง */
export function uploadFile(file: File): Promise<{ key: string; bytes: number; pages: number }> {
  return call('/api/admin/saraban/uploads', { method: 'POST', body: file });
}

/** อัปทีละไฟล์ตามลำดับ (เซิร์ฟเวอร์รับไฟล์ละคำขอ) แล้วคืนตัวชี้สำหรับบันทึกหนังสือ */
export async function uploadAll(
  files: File[],
  onProgress?: (done: number) => void
): Promise<FileRef[]> {
  const refs: FileRef[] = [];
  for (const file of files) {
    const { key } = await uploadFile(file);
    refs.push({ key, name: file.name });
    onProgress?.(refs.length);
  }
  return refs;
}

export function createDoc(kind: DocKind, body: ReceiveBody | SendBody): Promise<SarabanDoc> {
  return call(`/api/admin/saraban/docs?kind=${kind}`, jsonInit('POST', body));
}

export function patchDoc(id: string, body: DocPatch): Promise<SarabanDoc> {
  return call(docKey(id), jsonInit('PATCH', body));
}

export function addDocFile(id: string, file: FileRef): Promise<SarabanDoc> {
  return call(`${docKey(id)}/files`, jsonInit('POST', { file }));
}

export function removeDocFile(id: string, fileId: string): Promise<SarabanDoc> {
  return call(fileUrl(id, fileId), { method: 'DELETE' });
}

/** ลิงก์เปิดไฟล์ — route ตรวจสิทธิ์แล้ว 302 ไปลิงก์ชั่วคราว ใช้เป็น href ของ <a target="_blank"> ตรง ๆ */
export function fileUrl(id: string, fileId: string): string {
  return `${docKey(id)}/files/${encodeURIComponent(fileId)}`;
}

export function createUnit(input: Partial<UnitInput> & { name: string }): Promise<SarabanUnit> {
  return call(UNITS_KEY, jsonInit('POST', input));
}

export function updateUnit(id: string, patch: UnitPatch): Promise<SarabanUnit> {
  return call(`${UNITS_KEY}/${encodeURIComponent(id)}`, jsonInit('PATCH', patch));
}

export function setStartNo(body: YearStartInput): Promise<YearInfo> {
  return call('/api/admin/saraban/years', jsonInit('PUT', body));
}

/** ข้อความของ error ใด ๆ สำหรับ toast */
export function messageOf(err: unknown): string {
  return err instanceof SarabanApiError ? err.message : 'เชื่อมต่อไม่ได้ ลองอีกครั้ง';
}
```

- [ ] **Step 2: `src/components/saraban/toast.tsx`**

```tsx
// toast ของระบบสารบรรณ (handoff: ล่างกลาง หายใน 2.6 วินาที)
// flashToast(): ข้อความที่ต้องโชว์ "หลังเปลี่ยนหน้า" (ลงรับเสร็จ → ไปทะเบียน) — Pages Router remount
// layout ทุกหน้า state ใน component จึงหาย ตัวแปรระดับโมดูลอยู่รอดการเปลี่ยนหน้าฝั่งเบราว์เซอร์
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

let pendingFlash: string | null = null;

export function flashToast(message: string): void {
  pendingFlash = message;
}

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((next: string) => {
    setMessage(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2600);
  }, []);

  useEffect(() => {
    if (pendingFlash) {
      show(pendingFlash);
      pendingFlash = null;
    }
    return () => clearTimeout(timer.current);
  }, [show]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <div
          role="status"
          className="fixed bottom-7 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-sb-ink px-[18px] py-3 text-sm text-white shadow-[0_8px_24px_rgba(0,0,0,.2)]"
        >
          {message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 3: `src/components/saraban/bits.tsx`**

```tsx
// ชิ้นส่วนร่วมของหน้าจอสารบรรณ — ค่าสี/ขนาดตาม handoff § Design Tokens
import { useRef, useState, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import { MAX_FILES_PER_DOC } from '@/lib/saraban-attachment';
import { LEVEL_LABELS, statusLabel } from '@/lib/saraban-labels';
import { dateHint, fileSizeLabel, precheckFile } from '@/lib/saraban-view';
import type { DisplayStatus, SarabanLevel, SarabanRegister } from '@/types/saraban';

const STATUS_TONE: Record<DisplayStatus, string> = {
  pending: 'bg-sb-warning-bg text-sb-warning-ink',
  'in-progress': 'bg-sb-accent-light text-sb-accent',
  done: 'bg-sb-success-bg text-sb-success',
  void: 'bg-sb-subtle text-sb-muted',
  overdue: 'bg-sb-danger-bg text-sb-danger',
};

export function StatusPill({ register, status }: { register: SarabanRegister; status: DisplayStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold ${STATUS_TONE[status]}`}>
      {statusLabel(register, status)}
    </span>
  );
}

const LEVEL_TONE: Record<SarabanLevel, string> = {
  normal: 'text-sb-muted',
  urgent: 'text-sb-warning',
  'very-urgent': 'text-sb-danger',
  'most-urgent': 'text-sb-danger',
};

export function LevelText({ level }: { level: SarabanLevel }) {
  return <span className={`text-xs font-semibold ${LEVEL_TONE[level]}`}>{LEVEL_LABELS[level]}</span>;
}

export const inputClass =
  'w-full rounded-[10px] border border-sb-line-input bg-white px-3 py-2.5 text-sm text-sb-ink disabled:bg-sb-panel disabled:text-sb-muted';
export const primaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-sb-accent px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-sb-accent-hover disabled:opacity-60';
export const outlineButton =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-sb-line bg-white px-[18px] py-2.5 text-sm text-sb-ink hover:bg-sb-hover disabled:opacity-60';
export const card = 'rounded-2xl border border-sb-line bg-white';

export function Field({
  label,
  required,
  children,
  hint,
  warn,
  wide,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
  warn?: boolean;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 text-[13px] font-medium text-sb-ink ${wide ? 'sm:col-span-2' : ''}`}>
      <span>
        {label}
        {required ? <span className="text-sb-danger"> *</span> : null}
      </span>
      {children}
      {hint ? <span className={`text-xs font-normal ${warn ? 'text-sb-danger' : 'text-sb-muted'}`}>{hint}</span> : null}
    </label>
  );
}

/** ช่องวันที่พร้อมป้าย พ.ศ. ใต้ช่อง (dateHint) */
export function DateField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const hint = dateHint(value);
  return (
    <Field label={label} required={required} hint={hint.text} warn={hint.warn}>
      <input type="date" className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/**
 * เลือกไฟล์แนบ: ลากวาง หรือกดเลือกหลายไฟล์ · ไฟล์อยู่ในเบราว์เซอร์จนกว่าจะกดบันทึก (สเปกข้อ 5)
 * precheckFile กันไฟล์ที่ไม่ผ่านแน่ ๆ ตั้งแต่ตอนเลือก
 */
export function FilePicker({
  files,
  onChange,
  max = MAX_FILES_PER_DOC,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [over, setOver] = useState(false);

  function add(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    const bad = picked.map(precheckFile).filter((p): p is string => p !== null);
    const good = picked.filter((f) => precheckFile(f) === null);
    const next = [...files, ...good].slice(0, max);
    if (files.length + good.length > max) bad.push(`แนบได้ไม่เกิน ${max} ไฟล์`);
    setProblems(bad);
    onChange(next);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) add(e.dataTransfer.files);
      }}
      className={`rounded-xl border-[1.5px] border-dashed px-5 py-[22px] text-center text-[13px] text-sb-muted ${
        over ? 'border-sb-accent bg-sb-accent-light' : 'border-[#C4CDD8] bg-[#FAFBFD]'
      }`}
    >
      <p className="font-semibold text-sb-ink">แนบไฟล์หนังสือ (PDF / สแกน)</p>
      <p>
        ลากไฟล์มาวาง หรือ{' '}
        <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="font-medium text-sb-accent hover:underline">
          เลือกไฟล์
        </button>{' '}
        · PDF, JPG, PNG ไม่เกิน 10 MB · สูงสุด {max} ไฟล์
      </p>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
      {files.length > 0 ? (
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex items-center gap-2 rounded-lg border border-sb-line bg-white px-2.5 py-1.5 text-sb-ink">
              <Icon name="attach_file" size={16} />
              {f.name}
              <span className="text-sb-muted">{fileSizeLabel(f.size)}</span>
              <button
                type="button"
                aria-label={`เอา ${f.name} ออก`}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="text-sb-muted hover:text-sb-danger"
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {problems.length > 0 ? (
        <ul className="mt-2 text-xs text-sb-danger">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="rounded-[10px] bg-sb-danger-bg px-3.5 py-2.5 text-[13px] text-sb-danger">{children}</div>;
}
```

- [ ] **Step 4: ตรวจ**

Run: `npx tsc --noEmit -p . && npm run lint`
Expected: ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-api.ts src/components/saraban/toast.tsx src/components/saraban/bits.tsx
git commit -m "feat(saraban): ตัวเรียก API toast และชิ้นส่วนร่วมของหน้าจอ"
```

---

## Task 4: `SarabanLayout` + `/saraban`

**Files:** Create `src/components/saraban/SarabanLayout.tsx` · `src/pages/saraban/index.tsx`

- [ ] **Step 1: `SarabanLayout.tsx`**

```tsx
// shell ของระบบสารบรรณ (สเปกข้อ 6 "shell") — แยกจาก AdminLayout เพราะสารบรรณมีเมนูและธีมของตัวเอง
// แต่ใช้ auth/สิทธิ์ชุดเดียวกับพอร์ทัล · เมนูแสดงเฉพาะจอที่สร้างแล้วในรอบ 1
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import { ToastProvider } from '@/components/saraban/toast';
import { adminFetcher } from '@/lib/admin-api';
import { isClerkPublicConfigured } from '@/lib/clerk-config';
import { SUMMARY_KEY, sarabanFetcher, type SummaryResponse } from '@/lib/saraban-api';
import { sarabanFont } from '@/lib/saraban-font';
import { fiscalYearOf } from '@/lib/saraban-number';

const NAV = [
  { href: '/saraban/inbox', label: 'ทะเบียนหนังสือรับ', icon: 'move_to_inbox', badge: true },
  { href: '/saraban/outbox', label: 'ทะเบียนหนังสือส่ง', icon: 'outbox', badge: false },
  { href: '/saraban/receive', label: 'ลงรับหนังสือ', icon: 'add', badge: false },
  { href: '/saraban/send', label: 'ออกเลขหนังสือส่ง', icon: 'tag', badge: false },
  { href: '/saraban/units', label: 'สมุดผู้รับ', icon: 'apartment', badge: false },
] as const;

const COLLAPSE_KEY = 'saraban.navCollapsed';

export default function SarabanLayout({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const router = useRouter();
  const clerkOn = isClerkPublicConfigured();
  const [collapsed, setCollapsed] = useState(false);

  // อ่านค่าที่จำไว้หลัง mount (localStorage ไม่มีตอน SSR) · เปิดในโหมดส่วนตัวแล้วโยนได้ จึง try
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // ใช้ค่าเริ่มต้น
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, prev ? '0' : '1');
      } catch {
        // จำไม่ได้ก็ไม่เป็นไร
      }
      return !prev;
    });
  }

  const { data: summary } = useSWR<SummaryResponse>(SUMMARY_KEY, sarabanFetcher, {
    refreshInterval: 60_000,
    shouldRetryOnError: false,
  });
  const { data: me } = useSWR<{ name: string | null; position: string | null; email: string | null }>(
    clerkOn ? '/api/admin/me' : null,
    adminFetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  // ปีงบจาก today ของเซิร์ฟเวอร์ (เวลากรุงเทพฯ) — ไม่ใช้นาฬิกาเครื่องผู้ใช้ และไม่คำนวณตอน SSR
  const fiscalYear = summary ? fiscalYearOf(summary.today) : null;
  // ย่อ = ซ่อนป้ายทุกขนาดจอ · ไม่ย่อ = ซ่อนป้ายเฉพาะจอแคบกว่า md (สเปกข้อ 6)
  const labelClass = collapsed ? 'hidden' : 'hidden md:inline';
  const displayName = me?.name ?? me?.email ?? (clerkOn ? 'ผู้ใช้งาน' : 'โหมดทดสอบ (dev-open)');

  return (
    <ToastProvider>
      <Head>
        <title>{`${title} · ระบบสารบรรณ`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className={`saraban ${sarabanFont.className} flex min-h-screen bg-sb-page text-sb-ink antialiased`}>
        <aside
          className={`sticky top-0 flex h-screen flex-none flex-col gap-1.5 border-r border-sb-line bg-white px-3 py-5 ${
            collapsed ? 'w-[72px]' : 'w-[72px] md:w-[236px] md:px-3.5'
          }`}
        >
          <div className="flex items-center gap-2.5 px-1.5 pb-[18px] pt-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- ตราเล็กไฟล์เดียว ไม่ต้องผ่าน next/image */}
            <img src="/saraban/logo.jpeg" alt="ตราเทศบาล" className="h-10 w-10 flex-none rounded-full object-cover" />
            <div className={`leading-tight ${labelClass}`}>
              <p className="text-sm font-bold">ระบบสารบรรณอิเล็กทรอนิกส์</p>
              <p className="text-xs text-sb-muted">เทศบาลตำบลน้ำแพร่พัฒนา</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = router.pathname.startsWith(item.href);
              const badge = item.badge ? summary?.inboxPending ?? 0 : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-sm ${
                    active ? 'bg-sb-accent-light font-semibold text-sb-accent' : 'font-medium text-sb-ink-2 hover:bg-sb-subtle'
                  }`}
                >
                  <span
                    className={`relative inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] ${
                      active ? 'bg-sb-accent text-white' : 'bg-sb-subtle text-sb-muted'
                    }`}
                  >
                    <Icon name={item.icon} size={18} />
                    {/* จุดแดงบนไอคอน — แทนตัวเลขตอนป้ายถูกซ่อน (ย่อเมนู หรือจอแคบกว่า md) */}
                    {badge > 0 ? (
                      <span className={`absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-sb-danger ${collapsed ? '' : 'md:hidden'}`} />
                    ) : null}
                  </span>
                  <span className={`flex-1 ${labelClass}`}>{item.label}</span>
                  {badge > 0 ? (
                    <span title="รอเกษียน" className={`rounded-full bg-sb-danger px-[7px] py-px text-[11px] font-bold text-white ${labelClass}`}>
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          <Link
            href="/admin"
            title="กลับหลังบ้าน"
            className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] text-sb-muted hover:bg-sb-subtle"
          >
            <Icon name="arrow_back" size={18} />
            <span className={labelClass}>กลับหลังบ้าน</span>
          </Link>
          <div className="flex items-center gap-2.5 border-t border-sb-line px-1.5 pt-2.5">
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-sb-accent-light text-[13px] font-bold text-sb-accent">
              <Icon name="person" size={18} />
            </div>
            <div className={`min-w-0 text-[13px] leading-snug ${labelClass}`}>
              <p className={`truncate font-semibold ${clerkOn ? '' : 'text-sb-warning-ink'}`}>{displayName}</p>
              {me?.position ? <p className="truncate text-xs text-sb-muted">{me.position}</p> : null}
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[60px] flex-none items-center gap-3.5 border-b border-sb-line bg-white px-4 md:px-7">
            <button
              type="button"
              onClick={toggle}
              title="ย่อ/ขยายเมนู"
              className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg border border-sb-line text-sb-muted hover:bg-sb-hover"
            >
              <Icon name="menu" size={18} />
            </button>
            <h1 className="truncate text-base font-semibold">{title}</h1>
            <div className="flex-1" />
            {fiscalYear ? (
              <span className="hidden whitespace-nowrap text-[13px] text-sb-muted sm:inline">ปีงบประมาณ {fiscalYear}</span>
            ) : null}
            <Link
              href="/saraban/receive"
              className="inline-flex h-9 flex-none items-center gap-1 whitespace-nowrap rounded-[10px] bg-sb-accent px-4 text-sm font-semibold text-white hover:bg-sb-accent-hover"
            >
              <Icon name="add" size={18} />
              <span className="hidden sm:inline">ลงรับหนังสือ</span>
            </Link>
          </header>
          <div className="flex flex-col gap-5 px-4 pb-10 pt-6 md:px-7">
            {actions ? <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div> : null}
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
```

- [ ] **Step 2: `src/pages/saraban/index.tsx`**

```tsx
import type { GetServerSideProps } from 'next';

// /saraban → ทะเบียนรับ (รอบ 6 กลายเป็นแดชบอร์ด) · ปลายทางมี guard ของตัวเอง
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/saraban/inbox', permanent: false },
});

export default function SarabanIndex() {
  return null;
}
```

- [ ] **Step 3: ตรวจและ Commit**

Run: `npx tsc --noEmit -p . && npm run lint`

```bash
git add src/components/saraban/SarabanLayout.tsx src/pages/saraban/index.tsx
git commit -m "feat(saraban): shell ของระบบสารบรรณ"
```

---

## Task 5: ทะเบียนรับ/ส่ง/เวียน

**Files:** Create `src/components/saraban/RegisterPage.tsx` · `src/pages/saraban/inbox.tsx` · `outbox.tsx`

- [ ] **Step 1: `RegisterPage.tsx`**

```tsx
// ทะเบียนหนังสือ (สเปกข้อ 6 "/saraban/inbox · /saraban/outbox") — ใช้ร่วมสองหน้า
// outbox มีแท็บหนังสือส่ง/เวียนเพราะคนละชุดเลข
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import SarabanLayout from '@/components/saraban/SarabanLayout';
import { LevelText, StatusPill, card } from '@/components/saraban/bits';
import { sarabanFetcher, type DocListResponse } from '@/lib/saraban-api';
import { displayStatus, type RegisterView } from '@/lib/saraban-doc';
import { fiscalYearOf, formatNo } from '@/lib/saraban-number';
import { docsKey, isUrgentOpen, thaiDate, viewsOf } from '@/lib/saraban-view';
import type { SarabanRegister } from '@/types/saraban';

const TAB_LABELS: Record<SarabanRegister, string> = { in: 'หนังสือรับ', out: 'หนังสือส่ง', circular: 'หนังสือเวียน' };

export default function RegisterPage({ registers, title }: { registers: SarabanRegister[]; title: string }) {
  const [register, setRegister] = useState<SarabanRegister>(registers[0]);
  const [year, setYear] = useState<number | undefined>();
  const [view, setView] = useState<RegisterView>('all');
  const [page, setPage] = useState(1);

  const { data, error, isLoading } = useSWR<DocListResponse>(
    docsKey({ register, year, view, page }),
    sarabanFetcher,
    { keepPreviousData: true }
  );

  const reset = (patch: { register?: SarabanRegister; year?: number; view?: RegisterView }) => {
    if (patch.register) setRegister(patch.register);
    if ('year' in patch) setYear(patch.year);
    setView(patch.view ?? 'all');
    setPage(1);
  };

  const currentYear = data ? fiscalYearOf(data.today) : undefined;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const isIn = register === 'in';

  return (
    <SarabanLayout
      title={title}
      actions={
        !isIn ? (
          <Link href="/saraban/send" className="inline-flex items-center gap-1 rounded-[10px] border border-sb-line bg-white px-3.5 py-2 text-[13px] font-medium hover:bg-sb-hover">
            <Icon name="tag" size={16} />
            ออกเลขหนังสือส่ง
          </Link>
        ) : undefined
      }
    >
      {registers.length > 1 ? (
        <div className="flex gap-1 self-start rounded-[10px] bg-sb-subtle p-[3px]">
          {registers.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => reset({ register: r, year })}
              className={`rounded-lg px-4 py-1.5 text-[13px] ${
                r === register ? 'bg-white font-semibold text-sb-accent shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-sb-muted'
              }`}
            >
              {TAB_LABELS[r]}
            </button>
          ))}
        </div>
      ) : null}

      {data && currentYear && data.fiscalYear === currentYear && data.carryOver > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-sb-warning-bg px-4 py-3 text-[13px] text-sb-warning-ink">
          <Icon name="warning" size={18} />
          มีหนังสือค้างจากปีงบก่อนหน้าอีก {data.carryOver} เรื่อง
          <button type="button" onClick={() => reset({ year: currentYear - 1 })} className="font-semibold underline">
            ดูปีงบ {currentYear - 1}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        {data
          ? viewsOf(register, data.counts).map((b) => (
              <button
                key={b.view}
                type="button"
                onClick={() => reset({ year, view: b.view })}
                className={`rounded-full border border-sb-line px-3.5 py-1.5 text-[13px] ${
                  b.view === view ? 'bg-sb-ink font-semibold text-white' : 'bg-white text-sb-ink hover:bg-sb-hover'
                }`}
              >
                {b.label} <span className="opacity-60">{b.count}</span>
              </button>
            ))
          : null}
        <div className="flex-1" />
        {data ? (
          <label className="flex items-center gap-2 text-[13px] text-sb-muted">
            ปีงบ
            <select
              value={data.fiscalYear}
              onChange={(e) => reset({ year: Number(e.target.value) })}
              className="rounded-[10px] border border-sb-line-input bg-white px-3 py-2 text-[13px] text-sb-ink"
            >
              {data.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-sb-panel text-left text-xs text-sb-muted">
                <th className="px-4 py-3 font-semibold">{isIn ? 'เลขรับ' : 'เลขส่ง'}</th>
                <th className="px-2.5 py-3 font-semibold">ลงวันที่</th>
                <th className="px-2.5 py-3 font-semibold">ที่หนังสือ</th>
                <th className="px-2.5 py-3 font-semibold">{isIn ? 'จาก' : 'ถึง'}</th>
                <th className="w-[34%] px-2.5 py-3 font-semibold">เรื่อง</th>
                <th className="px-2.5 py-3 font-semibold">ชั้นความเร็ว</th>
                <th className="px-2.5 py-3 font-semibold">สถานะ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.docs.map((doc) => (
                <tr
                  key={doc.id}
                  className={`border-t border-sb-page hover:bg-sb-panel ${isUrgentOpen(doc) ? 'bg-sb-urgent-row' : ''}`}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-sb-accent">{formatNo(doc.register, doc.no)}</td>
                  <td className="whitespace-nowrap px-2.5 py-3 text-sb-muted">{thaiDate(doc.docDate)}</td>
                  <td className="whitespace-nowrap px-2.5 py-3">{doc.ref}</td>
                  <td className="px-2.5 py-3">{doc.party}</td>
                  <td className="px-2.5 py-3 leading-snug">
                    {doc.subject}
                    {doc.files.length > 0 ? (
                      <span className="ml-2 whitespace-nowrap rounded-full bg-sb-success-bg px-[7px] py-px text-[11px] text-sb-success">ไร้กระดาษ</span>
                    ) : null}
                  </td>
                  <td className="px-2.5 py-3">
                    <LevelText level={doc.level} />
                  </td>
                  <td className="px-2.5 py-3">
                    <StatusPill register={doc.register} status={displayStatus(doc, data.today)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/saraban/track/${doc.id}`}
                      className="rounded-lg border border-sb-line bg-white px-2.5 py-[5px] text-xs hover:bg-sb-hover"
                    >
                      ติดตาม
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error ? (
          <p className="border-t border-sb-page px-4 py-6 text-center text-[13px] text-sb-danger">โหลดทะเบียนไม่สำเร็จ ลองรีเฟรชหน้า</p>
        ) : isLoading && !data ? (
          <p className="border-t border-sb-page px-4 py-6 text-center text-[13px] text-sb-muted">กำลังโหลด…</p>
        ) : data && data.docs.length === 0 ? (
          <p className="border-t border-sb-page px-4 py-6 text-center text-[13px] text-sb-muted">ยังไม่มีหนังสือในมุมมองนี้</p>
        ) : null}
        {data && data.total > 0 ? (
          <div className="flex items-center justify-between border-t border-sb-page px-4 py-3 text-[13px] text-sb-muted">
            <span>
              แสดง {(data.page - 1) * data.pageSize + 1}–{(data.page - 1) * data.pageSize + data.docs.length} จาก {data.total} รายการ
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-md border border-sb-line bg-white px-2.5 py-1 text-xs disabled:opacity-40"
              >
                ‹
              </button>
              <span className="px-1 text-xs">
                หน้า {page}/{pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
                className="rounded-md border border-sb-line bg-white px-2.5 py-1 text-xs disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </SarabanLayout>
  );
}
```

- [ ] **Step 2: `inbox.tsx` · `outbox.tsx`**

```tsx
import RegisterPage from '@/components/saraban/RegisterPage';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';

function InboxPage() {
  return <RegisterPage registers={['in']} title="ทะเบียนหนังสือรับ" />;
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(InboxPage);
```

```tsx
import RegisterPage from '@/components/saraban/RegisterPage';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';

function OutboxPage() {
  return <RegisterPage registers={['out', 'circular']} title="ทะเบียนหนังสือส่ง" />;
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(OutboxPage);
```

- [ ] **Step 3: ตรวจและ Commit**

Run: `npx tsc --noEmit -p . && npm run lint`

```bash
git add src/components/saraban/RegisterPage.tsx src/pages/saraban/inbox.tsx src/pages/saraban/outbox.tsx
git commit -m "feat(saraban): หน้าทะเบียนหนังสือรับ ส่ง และเวียน"
```

---

## Task 6: `/saraban/receive` — ลงรับหนังสือ

**Files:** Create `src/pages/saraban/receive.tsx`

- [ ] **Step 1: เขียนหน้า**

```tsx
// ลงรับหนังสือ (สเปกข้อ 6 "/saraban/receive") — ฟอร์มถือไฟล์ไว้จนกดบันทึก แล้วอัปทีละไฟล์ก่อนส่งข้อมูล
// id สร้างครั้งเดียวต่อฟอร์ม (idempotency key): เน็ตหลุดแล้วกดซ้ำได้หนังสือเดิม ไม่ได้เลขที่สอง
import { useRouter } from 'next/router';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import SarabanLayout from '@/components/saraban/SarabanLayout';
import { DateField, ErrorBox, Field, FilePicker, card, inputClass, outlineButton, primaryButton } from '@/components/saraban/bits';
import { flashToast, useToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import {
  createDoc,
  messageOf,
  sarabanFetcher,
  setStartNo,
  SUMMARY_KEY,
  UNITS_KEY,
  uploadAll,
  yearKey,
  type SummaryResponse,
  type YearInfo,
} from '@/lib/saraban-api';
import { LEVEL_LABELS } from '@/lib/saraban-labels';
import { formatNo } from '@/lib/saraban-number';
import { thaiDateTime } from '@/lib/saraban-view';
import { SARABAN_LEVELS, type SarabanLevel, type SarabanUnit } from '@/types/saraban';

const EMPTY = { ref: '', docDate: '', party: '', subject: '', level: 'normal' as SarabanLevel, holderUnitId: '', dueDate: '' };

function ReceivePage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [now, setNow] = useState('');
  const [startNo, setStart] = useState('');
  const id = useRef<string | null>(null);

  const { data: units } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  const { data: year, mutate: reloadYear } = useSWR<YearInfo>(yearKey('in'), sarabanFetcher);
  const { data: summary } = useSWR<SummaryResponse>(SUMMARY_KEY, sarabanFetcher);
  const active = (units ?? []).filter((u) => u.isActive);
  const holder = active.find((u) => u.id === form.holderUnitId);

  // เสนอถึงปลัดเป็นค่าเริ่มต้น (สเปกข้อ 6) — ถ้าปลัดถูกปิดใช้หน่วยแรกที่เปิดอยู่
  useEffect(() => {
    if (!form.holderUnitId && active.length > 0) {
      setForm((f) => ({ ...f, holderUnitId: (active.find((u) => u.id === 'palad') ?? active[0]).id }));
    }
  }, [active, form.holderUnitId]);

  // เวลาบนตราตัวอย่าง — ตั้งหลัง mount (ไม่ให้ SSR กับเบราว์เซอร์วาดเวลาต่างกัน)
  useEffect(() => {
    const tick = () => setNow(thaiDateTime(new Date().toISOString()));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const missing = [
      !form.ref.trim() && 'ที่หนังสือ',
      !form.docDate && 'ลงวันที่',
      !form.party.trim() && 'จาก',
      !form.subject.trim() && 'เรื่อง',
      !form.holderUnitId && 'เสนอถึง',
    ].filter(Boolean);
    if (missing.length > 0) return setError(`กรุณากรอก ${missing.join(' · ')}`);
    setError('');
    id.current ??= crypto.randomUUID();
    try {
      setBusy(files.length > 0 ? `กำลังอัปไฟล์ 0/${files.length}` : 'กำลังบันทึก…');
      const refs = await uploadAll(files, (done) => setBusy(`กำลังอัปไฟล์ ${done}/${files.length}`));
      setBusy('กำลังบันทึก…');
      const doc = await createDoc('receive', { id: id.current, ...form, files: refs });
      flashToast(`ลงรับที่ ${formatNo('in', doc.no)} แล้ว · เสนอ${holder?.name ?? ''}`);
      await router.push('/saraban/inbox');
    } catch (err) {
      setError(messageOf(err));
      setBusy('');
    }
  }

  async function saveStartNo() {
    if (!year) return;
    try {
      await setStartNo({ register: 'in', fiscalYear: year.fiscalYear, startNo: Number(startNo) });
      await reloadYear();
      setStart('');
      toast(`ตั้งเลขเริ่มต้นปีงบ ${year.fiscalYear} แล้ว`);
    } catch (err) {
      toast(messageOf(err));
    }
  }

  const nextNo = year ? formatNo('in', year.nextNo) : '—';

  return (
    <SarabanLayout title="ลงรับหนังสือ">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <form onSubmit={submit} className={`${card} flex flex-col gap-4 p-6`}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">ลงรับหนังสือใหม่</h2>
            <p className="text-[13px] text-sb-muted">
              เลขรับถัดไป <b className="text-sb-accent">{nextNo}</b>
            </p>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="ที่หนังสือ" required>
              <input className={inputClass} maxLength={100} placeholder="เช่น ชม 0023.1/ว 1245" value={form.ref} onChange={(e) => set('ref')(e.target.value)} />
            </Field>
            <DateField label="ลงวันที่" required value={form.docDate} onChange={set('docDate')} />
            <Field label="จาก (หน่วยงาน)" required wide>
              <input className={inputClass} maxLength={200} placeholder="ชื่อหน่วยงานผู้ส่ง" value={form.party} onChange={(e) => set('party')(e.target.value)} />
            </Field>
            <Field label="เรื่อง" required wide>
              <input className={inputClass} maxLength={500} placeholder="ชื่อเรื่องตามหนังสือ" value={form.subject} onChange={(e) => set('subject')(e.target.value)} />
            </Field>
            <Field label="ชั้นความเร็ว">
              <select className={inputClass} value={form.level} onChange={(e) => set('level')(e.target.value)}>
                {SARABAN_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABELS[l]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="เสนอถึง" required>
              <select className={inputClass} value={form.holderUnitId} onChange={(e) => set('holderUnitId')(e.target.value)}>
                {active.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <DateField label="กำหนดแล้วเสร็จ (ถ้ามี)" value={form.dueDate} onChange={set('dueDate')} />
          </div>
          <p className="text-xs text-sb-muted">
            หนังสือชั้นลับขึ้นไปให้ดำเนินการนอกระบบตามระเบียบว่าด้วยการรักษาความลับของทางราชการ
          </p>
          {summary?.storageConfigured === false ? (
            <p className="rounded-xl bg-sb-subtle px-4 py-3 text-[13px] text-sb-muted">ยังไม่ได้ตั้งค่าที่เก็บไฟล์ — แนบไฟล์ไม่ได้ (ลงรับได้ตามปกติ)</p>
          ) : (
            <FilePicker files={files} onChange={setFiles} disabled={Boolean(busy)} />
          )}
          {error ? <ErrorBox>{error}</ErrorBox> : null}
          <div className="flex items-center justify-end gap-2.5">
            {busy ? <span className="mr-auto text-[13px] text-sb-muted">{busy}</span> : null}
            <button type="button" className={outlineButton} disabled={Boolean(busy)} onClick={() => router.push('/saraban/inbox')}>
              ยกเลิก
            </button>
            <button type="submit" className={primaryButton} disabled={Boolean(busy)}>
              ลงรับและเสนอ
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-3.5">
          <div className={`${card} p-5`}>
            <h3 className="mb-2.5 font-semibold">ตัวอย่างตราลงรับ</h3>
            <div className="max-w-[280px] rounded-lg border-2 border-sb-accent px-3.5 py-3 text-[13px] font-medium leading-relaxed text-sb-accent">
              <p className="font-bold">เทศบาลตำบลน้ำแพร่พัฒนา</p>
              <p>
                เลขรับ <b>{nextNo}</b>
              </p>
              <p>วันที่ {now || '—'}</p>
              <p>เสนอ {holder?.name ?? '—'}</p>
            </div>
            <p className="mt-2.5 text-xs text-sb-muted">
              เลขรับเป็นการคาดเดา — ถ้ามีคนลงรับตัดหน้า เลขจริงคือเลขที่แจ้งหลังบันทึก
            </p>
          </div>
          <div className="rounded-2xl bg-sb-success-bg px-5 py-[18px] text-[13px] leading-relaxed text-sb-success-ink">
            <p className="text-sm font-bold">ลงรับแบบไร้กระดาษ</p>
            หนังสือที่แนบไฟล์และเสนอผ่านระบบไม่ต้องพิมพ์สำเนา และจะเข้าสถิติลดกระดาษจากจำนวนหน้าจริงของไฟล์
          </div>
          {year && year.count === 0 ? (
            <div className={`${card} flex flex-col gap-2.5 p-5`}>
              <h3 className="flex items-center gap-1.5 font-semibold">
                <Icon name="tag" size={18} />
                ตั้งเลขเริ่มต้นปีงบ {year.fiscalYear}
              </h3>
              <p className="text-xs text-sb-muted">
                ใช้เมื่อเริ่มใช้ระบบกลางปี — ใส่เลขถัดจากเลขล่าสุดของทะเบียนกระดาษ ตั้งได้เฉพาะตอนปีนี้ยังไม่มีหนังสือ
              </p>
              <div className="flex gap-2">
                <input type="number" min={1} className={inputClass} placeholder="เช่น 422" value={startNo} onChange={(e) => setStart(e.target.value)} />
                <button type="button" className={outlineButton} disabled={!startNo || Number(startNo) < 1} onClick={saveStartNo}>
                  ตั้งค่า
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </SarabanLayout>
  );
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(ReceivePage);
```

- [ ] **Step 2: ตรวจและ Commit**

Run: `npx tsc --noEmit -p . && npm run lint`

```bash
git add src/pages/saraban/receive.tsx
git commit -m "feat(saraban): หน้าลงรับหนังสือ"
```

---

## Task 7: `/saraban/send` — ออกเลขหนังสือส่ง/เวียน

**Files:** Create `src/pages/saraban/send.tsx`

- [ ] **Step 1: เขียนหน้า**

```tsx
// ออกเลขหนังสือส่ง/เวียน (สเปกข้อ 6 "/saraban/send" — handoff ไม่มีจอนี้) — จบที่ "ที่ …" ตัวใหญ่
// เพราะเจ้าหน้าที่ต้องได้เลขก่อนถึงจะพิมพ์ลงหนังสือได้ ไม่ใช่จบที่ทะเบียน
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import SarabanLayout from '@/components/saraban/SarabanLayout';
import { DateField, ErrorBox, Field, FilePicker, card, inputClass, outlineButton, primaryButton } from '@/components/saraban/bits';
import { useToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import { createDoc, messageOf, sarabanFetcher, SUMMARY_KEY, UNITS_KEY, uploadAll, type SummaryResponse } from '@/lib/saraban-api';
import { LEVEL_LABELS } from '@/lib/saraban-labels';
import { formatNo } from '@/lib/saraban-number';
import { SARABAN_LEVELS, type SarabanDoc, type SarabanLevel, type SarabanUnit } from '@/types/saraban';

const EMPTY = { ownerUnitId: '', circular: false, docDate: '', party: '', subject: '', level: 'normal' as SarabanLevel };

function SendPage() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [issued, setIssued] = useState<SarabanDoc | null>(null);
  const id = useRef<string | null>(null);

  const { data: units } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  const { data: summary } = useSWR<SummaryResponse>(SUMMARY_KEY, sarabanFetcher);
  // ออกเลขได้เฉพาะหน่วยที่มีรหัสส่วนราชการ — ระบบประกอบ "ที่" จากรหัสนี้ (composeRef)
  const owners = (units ?? []).filter((u) => u.isActive && u.refCode);

  useEffect(() => {
    if (!form.ownerUnitId && owners.length > 0) setForm((f) => ({ ...f, ownerUnitId: owners[0].id }));
  }, [owners, form.ownerUnitId]);

  // ลงวันที่ = วันนี้เป็นค่าเริ่มต้น (หนังสือส่งลงวันที่วันที่ออกเลข) · ตั้งหลัง mount จาก today ของเซิร์ฟเวอร์
  useEffect(() => {
    if (summary && !form.docDate) setForm((f) => ({ ...f, docDate: summary.today }));
  }, [summary, form.docDate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const missing = [
      !form.ownerUnitId && 'ส่วนราชการเจ้าของเรื่อง',
      !form.docDate && 'ลงวันที่',
      !form.party.trim() && 'ถึง',
      !form.subject.trim() && 'เรื่อง',
    ].filter(Boolean);
    if (missing.length > 0) return setError(`กรุณากรอก ${missing.join(' · ')}`);
    setError('');
    id.current ??= crypto.randomUUID();
    try {
      setBusy(files.length > 0 ? `กำลังอัปไฟล์ 0/${files.length}` : 'กำลังออกเลข…');
      const refs = await uploadAll(files, (done) => setBusy(`กำลังอัปไฟล์ ${done}/${files.length}`));
      setBusy('กำลังออกเลข…');
      setIssued(await createDoc('send', { id: id.current, ...form, files: refs }));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy('');
    }
  }

  function again() {
    id.current = null;
    setIssued(null);
    setFiles([]);
    setForm({ ...EMPTY, ownerUnitId: form.ownerUnitId, circular: form.circular, docDate: summary?.today ?? '' });
  }

  if (issued) {
    return (
      <SarabanLayout title="ออกเลขหนังสือส่ง">
        <div className={`${card} mx-auto flex w-full max-w-xl flex-col items-center gap-4 p-8 text-center`}>
          <p className="text-[13px] text-sb-muted">
            ออกเลข{issued.register === 'circular' ? 'หนังสือเวียน' : 'หนังสือส่ง'}แล้ว · เลขทะเบียน {formatNo(issued.register, issued.no)}
          </p>
          <p className="text-4xl font-bold text-sb-accent">ที่ {issued.ref}</p>
          <p className="text-sm">{issued.subject}</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              className={outlineButton}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(issued.ref);
                  toast('คัดลอกเลขที่หนังสือแล้ว');
                } catch {
                  toast('คัดลอกไม่ได้ — เลือกข้อความแล้วคัดลอกเอง');
                }
              }}
            >
              <Icon name="content_copy" size={18} />
              คัดลอก
            </button>
            <Link href="/saraban/outbox" className={outlineButton}>
              ไปทะเบียนส่ง
            </Link>
            <button type="button" className={primaryButton} onClick={again}>
              ออกเลขอีกฉบับ
            </button>
          </div>
        </div>
      </SarabanLayout>
    );
  }

  return (
    <SarabanLayout title="ออกเลขหนังสือส่ง">
      <form onSubmit={submit} className={`${card} flex max-w-3xl flex-col gap-4 p-6`}>
        <h2 className="text-base font-semibold">ออกเลขหนังสือส่ง / หนังสือเวียน</h2>
        {units && owners.length === 0 ? (
          <ErrorBox>ยังไม่มีส่วนราชการที่มีรหัสส่วนราชการ — ตั้งรหัสที่หน้า “สมุดผู้รับ” ก่อน</ErrorBox>
        ) : null}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="ส่วนราชการเจ้าของเรื่อง" required>
            <select className={inputClass} value={form.ownerUnitId} onChange={(e) => setForm({ ...form, ownerUnitId: e.target.value })}>
              {owners.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.refCode})
                </option>
              ))}
            </select>
          </Field>
          <DateField label="ลงวันที่" required value={form.docDate} onChange={(docDate) => setForm({ ...form, docDate })} />
          <label className="flex items-center gap-2 text-[13px] font-medium sm:col-span-2">
            <input type="checkbox" checked={form.circular} onChange={(e) => setForm({ ...form, circular: e.target.checked })} />
            หนังสือเวียน (ใช้ชุดเลข “ว” แยกจากหนังสือส่ง)
          </label>
          <Field label="ถึง" required wide>
            <input className={inputClass} maxLength={200} placeholder="ผู้รับหนังสือ" value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} />
          </Field>
          <Field label="เรื่อง" required wide>
            <input className={inputClass} maxLength={500} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </Field>
          <Field label="ชั้นความเร็ว">
            <select className={inputClass} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as SarabanLevel })}>
              {SARABAN_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {summary?.storageConfigured === false ? null : <FilePicker files={files} onChange={setFiles} disabled={Boolean(busy)} />}
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <div className="flex items-center justify-end gap-2.5">
          {busy ? <span className="mr-auto text-[13px] text-sb-muted">{busy}</span> : null}
          <button type="submit" className={primaryButton} disabled={Boolean(busy) || owners.length === 0}>
            <Icon name="tag" size={18} />
            ออกเลข
          </button>
        </div>
      </form>
    </SarabanLayout>
  );
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(SendPage);
```

- [ ] **Step 2: ตรวจและ Commit**

Run: `npx tsc --noEmit -p . && npm run lint`

```bash
git add src/pages/saraban/send.tsx
git commit -m "feat(saraban): หน้าออกเลขหนังสือส่งและเวียน"
```

---

## Task 8: `/saraban/track/[id]` — หน้าหนังสือ

**Files:** Create `src/pages/saraban/track/[id].tsx`

- [ ] **Step 1: เขียนหน้า**

```tsx
// หน้าหนังสือฉบับรอบ 1 (สเปกข้อ 6 "/saraban/track/[id]") — ข้อมูล · ไฟล์แนบ · แก้ไข/ยกเลิก/ส่งแล้ว ·
// เส้นทางหนังสือจาก events · ทุกปุ่มโชว์ตามฟังก์ชันของ 1A (editableFieldsOf / canVoid / canMarkSent /
// canAddFile / canRemoveFile) ที่ API ใช้ตัดสินจริง หน้าจอกับเซิร์ฟเวอร์จึงเห็นตรงกัน
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import SarabanLayout from '@/components/saraban/SarabanLayout';
import { DateField, ErrorBox, Field, LevelText, StatusPill, card, inputClass, outlineButton, primaryButton } from '@/components/saraban/bits';
import { useToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import {
  addDocFile,
  docKey,
  fileUrl,
  messageOf,
  patchDoc,
  removeDocFile,
  sarabanFetcher,
  SarabanApiError,
  SUMMARY_KEY,
  UNITS_KEY,
  uploadFile,
  type SummaryResponse,
} from '@/lib/saraban-api';
import { MAX_FILES_PER_DOC } from '@/lib/saraban-attachment';
import { canAddFile, canMarkSent, canRemoveFile, canVoid, displayStatus, editableFieldsOf, type DocEdit, type EditableField } from '@/lib/saraban-doc';
import { EVENT_KIND_LABELS, fieldLabel, LEVEL_LABELS, SEND_METHOD_LABELS } from '@/lib/saraban-labels';
import { formatNo } from '@/lib/saraban-number';
import { changeValue, fileSizeLabel, precheckFile, thaiDate, thaiDateTime } from '@/lib/saraban-view';
import { SARABAN_LEVELS, SEND_METHODS, type SarabanDoc, type SarabanUnit, type SendMethod } from '@/types/saraban';

const NO_PREFIX = { in: 'รับที่', out: 'ส่งที่', circular: 'เวียนที่' } as const;
type Panel = 'none' | 'edit' | 'void' | 'sent';

function TrackPage() {
  const router = useRouter();
  const toast = useToast();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { data: doc, error, mutate } = useSWR<SarabanDoc>(id ? docKey(id) : null, sarabanFetcher);
  const { data: units } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  const { data: summary } = useSWR<SummaryResponse>(SUMMARY_KEY, sarabanFetcher);
  const [panel, setPanel] = useState<Panel>('none');
  const [busy, setBusy] = useState(false);

  const unitName = (unitId: string) => units?.find((u) => u.id === unitId)?.name ?? unitId;

  // stale = มีคนแก้ไปก่อน — โหลดฉบับล่าสุดให้เลย ผู้ใช้จะได้เห็นว่าเปลี่ยนอะไร
  async function run(action: () => Promise<SarabanDoc>, done: string) {
    setBusy(true);
    try {
      await mutate(await action(), { revalidate: false });
      setPanel('none');
      toast(done);
    } catch (err) {
      toast(messageOf(err));
      if (err instanceof SarabanApiError && err.code === 'stale') await mutate();
    } finally {
      setBusy(false);
    }
  }

  async function addFiles(list: FileList | null) {
    if (!doc || !list) return;
    const picked = Array.from(list).slice(0, MAX_FILES_PER_DOC - doc.files.length);
    const bad = picked.map(precheckFile).find((p) => p !== null);
    if (bad) return toast(bad);
    setBusy(true);
    try {
      for (const file of picked) {
        const { key } = await uploadFile(file);
        await mutate(await addDocFile(doc.id, { key, name: file.name }), { revalidate: false });
      }
      toast(`แนบไฟล์แล้ว ${picked.length} ไฟล์`);
    } catch (err) {
      toast(messageOf(err));
      await mutate();
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <SarabanLayout title="หนังสือ">
        <ErrorBox>{messageOf(error)}</ErrorBox>
      </SarabanLayout>
    );
  }
  if (!doc) {
    return (
      <SarabanLayout title="หนังสือ">
        <p className="text-[13px] text-sb-muted">กำลังโหลด…</p>
      </SarabanLayout>
    );
  }

  const today = summary?.today;
  const status = today ? displayStatus(doc, today) : doc.status;
  const editable = editableFieldsOf(doc);
  const storageOn = summary?.storageConfigured !== false;
  const back = doc.register === 'in' ? '/saraban/inbox' : '/saraban/outbox';

  return (
    <SarabanLayout title={`${NO_PREFIX[doc.register]} ${formatNo(doc.register, doc.no)}`}>
      <Link href={back} className="self-start text-[13px] text-sb-muted hover:text-sb-accent">
        ‹ กลับทะเบียน
      </Link>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3.5">
          <section className={`${card} p-[22px]`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-sb-muted">
                  {NO_PREFIX[doc.register]} {formatNo(doc.register, doc.no)} · ปีงบ {doc.fiscalYear} · ที่ {doc.ref || '—'}
                </p>
                <h2 className="mt-0.5 text-[17px] font-bold">{doc.subject}</h2>
                <p className="mt-0.5 text-[13px] text-sb-muted">
                  {doc.register === 'in' ? 'จาก' : 'ถึง'} {doc.party} · ลงวันที่ {thaiDate(doc.docDate)}
                </p>
              </div>
              <StatusPill register={doc.register} status={status} />
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-sb-muted">ชั้นความเร็ว</dt>
                <dd>
                  <LevelText level={doc.level} />
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-sb-muted">{doc.register === 'in' ? 'อยู่กับ' : 'เจ้าของเรื่อง'}</dt>
                <dd>{unitName(doc.holderUnitId)}</dd>
              </div>
              {doc.register === 'in' ? (
                <div className="flex gap-2">
                  <dt className="text-sb-muted">กำหนดแล้วเสร็จ</dt>
                  <dd>{doc.dueDate ? thaiDate(doc.dueDate) : 'ไม่กำหนด'}</dd>
                </div>
              ) : null}
              {doc.sendMethod ? (
                <div className="flex gap-2">
                  <dt className="text-sb-muted">วิธีส่ง</dt>
                  <dd>{SEND_METHOD_LABELS[doc.sendMethod]}</dd>
                </div>
              ) : null}
              {doc.voidReason ? (
                <div className="flex gap-2 sm:col-span-2">
                  <dt className="text-sb-muted">เหตุที่ยกเลิก</dt>
                  <dd className="text-sb-danger">{doc.voidReason}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {editable.length > 0 ? (
                <button type="button" className={outlineButton} disabled={busy} onClick={() => setPanel(panel === 'edit' ? 'none' : 'edit')}>
                  <Icon name="edit" size={18} />
                  แก้ไข
                </button>
              ) : null}
              {canMarkSent(doc) ? (
                <button type="button" className={outlineButton} disabled={busy} onClick={() => setPanel(panel === 'sent' ? 'none' : 'sent')}>
                  <Icon name="send" size={18} />
                  บันทึกว่าส่งแล้ว
                </button>
              ) : null}
              {canVoid(doc) ? (
                <button
                  type="button"
                  className={`${outlineButton} text-sb-danger`}
                  disabled={busy}
                  onClick={() => setPanel(panel === 'void' ? 'none' : 'void')}
                >
                  <Icon name="block" size={18} />
                  ยกเลิกเลขทะเบียน
                </button>
              ) : null}
            </div>
          </section>

          {panel === 'edit' ? (
            <EditPanel
              doc={doc}
              fields={editable}
              units={(units ?? []).filter((u) => u.isActive || u.id === doc.holderUnitId)}
              busy={busy}
              onCancel={() => setPanel('none')}
              onSave={(edit) => run(() => patchDoc(doc.id, { action: 'edit', updatedAt: doc.updatedAt, edit }), 'บันทึกการแก้ไขแล้ว')}
            />
          ) : null}
          {panel === 'void' ? (
            <VoidPanel busy={busy} onCancel={() => setPanel('none')} onSave={(reason) => run(() => patchDoc(doc.id, { action: 'void', updatedAt: doc.updatedAt, reason }), 'ยกเลิกเลขทะเบียนแล้ว')} />
          ) : null}
          {panel === 'sent' ? (
            <SentPanel busy={busy} onCancel={() => setPanel('none')} onSave={(method) => run(() => patchDoc(doc.id, { action: 'sent', updatedAt: doc.updatedAt, method }), 'บันทึกว่าส่งแล้ว')} />
          ) : null}

          <section className={`${card} p-[22px]`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">ไฟล์แนบ ({doc.files.length})</h3>
              {storageOn && canAddFile(doc) && doc.files.length < MAX_FILES_PER_DOC ? (
                <label className={`${outlineButton} cursor-pointer px-3 py-1.5 text-[13px]`}>
                  <Icon name="upload_file" size={18} />
                  เพิ่มไฟล์
                  <input
                    type="file"
                    multiple
                    hidden
                    disabled={busy}
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(e) => {
                      void addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              ) : null}
            </div>
            {doc.files.length === 0 ? (
              <p className="text-[13px] text-sb-muted">ยังไม่มีไฟล์แนบ</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {doc.files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-[10px] border border-sb-line px-3 py-2 text-[13px]">
                    <Icon name="attach_file" size={18} className="text-sb-muted" />
                    <a href={fileUrl(doc.id, f.id)} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate font-medium text-sb-accent hover:underline">
                      {f.name}
                    </a>
                    <span className="whitespace-nowrap text-xs text-sb-muted">
                      {f.format.toUpperCase()} · {fileSizeLabel(f.bytes)}
                      {f.format === 'pdf' && f.pages > 0 ? ` · ${f.pages} หน้า` : ''}
                    </span>
                    {canRemoveFile(doc) ? (
                      <button
                        type="button"
                        aria-label={`ลบ ${f.name}`}
                        disabled={busy}
                        className="text-sb-muted hover:text-sb-danger"
                        onClick={() => {
                          if (confirm(`ลบไฟล์ “${f.name}” ออกจากหนังสือนี้?`)) {
                            void run(() => removeDocFile(doc.id, f.id), 'ลบไฟล์แนบแล้ว');
                          }
                        }}
                      >
                        <Icon name="delete" size={18} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className={`${card} p-[22px]`}>
          <h3 className="mb-3.5 flex items-center gap-1.5 font-semibold">
            <Icon name="history" size={18} />
            เส้นทางหนังสือ
          </h3>
          {doc.events.map((ev, i) => (
            <div key={ev.id} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <div
                  className={`mt-[3px] h-3.5 w-3.5 flex-none rounded-full border-[3px] bg-white ${
                    i === doc.events.length - 1 ? 'border-sb-accent' : 'border-sb-success'
                  }`}
                />
                {i < doc.events.length - 1 ? <div className="w-0.5 flex-1 bg-[#C9E3D5]" /> : null}
              </div>
              <div className="flex-1 pb-[18px]">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-semibold">{EVENT_KIND_LABELS[ev.kind]}</p>
                  <p className="text-xs text-sb-muted">{thaiDateTime(ev.at)}</p>
                </div>
                <p className="mt-0.5 text-[13px] text-sb-muted">{ev.byName}</p>
                {ev.note ? <p className="mt-1.5 rounded-lg bg-sb-panel px-3 py-2 text-[13px] leading-normal">{ev.note}</p> : null}
                {ev.changes?.length ? (
                  <ul className="mt-1.5 flex flex-col gap-0.5 rounded-lg bg-sb-panel px-3 py-2 text-[13px]">
                    {ev.changes.map((c) => (
                      <li key={c.field}>
                        <span className="text-sb-muted">{fieldLabel(doc.register, c.field)}:</span> {changeValue(c.field, c.from)} → {changeValue(c.field, c.to)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      </div>
    </SarabanLayout>
  );
}

function EditPanel({
  doc,
  fields,
  units,
  busy,
  onCancel,
  onSave,
}: {
  doc: SarabanDoc;
  fields: readonly EditableField[];
  units: SarabanUnit[];
  busy: boolean;
  onCancel: () => void;
  onSave: (edit: DocEdit) => void;
}) {
  const [values, setValues] = useState<Record<EditableField, string>>({
    ref: doc.ref,
    docDate: doc.docDate,
    party: doc.party,
    subject: doc.subject,
    level: doc.level,
    dueDate: doc.dueDate,
    holderUnitId: doc.holderUnitId,
  });
  const has = (f: EditableField) => fields.includes(f);
  const set = (f: EditableField) => (v: string) => setValues({ ...values, [f]: v });

  function submit(e: FormEvent) {
    e.preventDefault();
    // ส่งเฉพาะช่องที่แก้ได้ในสถานะนี้ — buildEdit ฝั่งเซิร์ฟเวอร์ข้ามช่องที่ค่าไม่เปลี่ยนเอง
    const edit = Object.fromEntries(fields.map((f) => [f, values[f].trim()])) as DocEdit;
    onSave(edit);
  }

  return (
    <form onSubmit={submit} className={`${card} flex flex-col gap-3.5 p-[22px]`}>
      <h3 className="font-semibold">แก้ไขข้อมูลหนังสือ</h3>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {has('ref') ? (
          <Field label={fieldLabel(doc.register, 'ref')}>
            <input className={inputClass} maxLength={100} value={values.ref} onChange={(e) => set('ref')(e.target.value)} />
          </Field>
        ) : null}
        {has('docDate') ? <DateField label="ลงวันที่" value={values.docDate} onChange={set('docDate')} /> : null}
        {has('party') ? (
          <Field label={fieldLabel(doc.register, 'party')} wide>
            <input className={inputClass} maxLength={200} value={values.party} onChange={(e) => set('party')(e.target.value)} />
          </Field>
        ) : null}
        {has('subject') ? (
          <Field label="เรื่อง" wide>
            <input className={inputClass} maxLength={500} value={values.subject} onChange={(e) => set('subject')(e.target.value)} />
          </Field>
        ) : null}
        {has('level') ? (
          <Field label="ชั้นความเร็ว">
            <select className={inputClass} value={values.level} onChange={(e) => set('level')(e.target.value)}>
              {SARABAN_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {has('holderUnitId') ? (
          <Field label="เสนอถึง">
            <select className={inputClass} value={values.holderUnitId} onChange={(e) => set('holderUnitId')(e.target.value)}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {has('dueDate') ? <DateField label="กำหนดแล้วเสร็จ (ว่าง = ไม่กำหนด)" value={values.dueDate} onChange={set('dueDate')} /> : null}
      </div>
      <p className="text-xs text-sb-muted">เลขทะเบียน ทะเบียน และปีงบแก้ไม่ได้ทุกกรณี · ถ้าเลขผิดให้ยกเลิกแล้วลงทะเบียนใหม่</p>
      <div className="flex justify-end gap-2.5">
        <button type="button" className={outlineButton} disabled={busy} onClick={onCancel}>
          ยกเลิก
        </button>
        <button type="submit" className={primaryButton} disabled={busy}>
          บันทึก
        </button>
      </div>
    </form>
  );
}

function VoidPanel({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className={`${card} flex flex-col gap-3 border-sb-danger/30 p-[22px]`}>
      <h3 className="font-semibold text-sb-danger">ยกเลิกเลขทะเบียน</h3>
      <p className="text-[13px] text-sb-muted">เลขที่ยกเลิกแล้วไม่ถูกนำกลับมาใช้ และหนังสือยังอยู่ในทะเบียนพร้อมเหตุผล — ย้อนกลับไม่ได้</p>
      <Field label="เหตุผล" required>
        <textarea className={inputClass} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2.5">
        <button type="button" className={outlineButton} disabled={busy} onClick={onCancel}>
          ไม่ยกเลิก
        </button>
        <button
          type="button"
          className="rounded-[10px] bg-sb-danger px-[18px] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={busy || !reason.trim()}
          onClick={() => onSave(reason.trim())}
        >
          ยืนยันยกเลิก
        </button>
      </div>
    </div>
  );
}

function SentPanel({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (method: SendMethod) => void }) {
  const [method, setMethod] = useState<SendMethod>('system');
  return (
    <div className={`${card} flex flex-col gap-3 p-[22px]`}>
      <h3 className="font-semibold">บันทึกว่าส่งแล้ว</h3>
      <Field label="วิธีส่ง">
        <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as SendMethod)}>
          {SEND_METHODS.map((m) => (
            <option key={m} value={m}>
              {SEND_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex justify-end gap-2.5">
        <button type="button" className={outlineButton} disabled={busy} onClick={onCancel}>
          ยกเลิก
        </button>
        <button type="button" className={primaryButton} disabled={busy} onClick={() => onSave(method)}>
          <Icon name="check" size={18} />
          บันทึก
        </button>
      </div>
    </div>
  );
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(TrackPage);
```

- [ ] **Step 2: ตรวจและ Commit**

Run: `npx tsc --noEmit -p . && npm run lint`

```bash
git add "src/pages/saraban/track/[id].tsx"
git commit -m "feat(saraban): หน้าหนังสือ แก้ไข ยกเลิก ส่งแล้ว ไฟล์แนบ และเส้นทางหนังสือ"
```

---

## Task 9: `/saraban/units` — สมุดผู้รับ

**Files:** Create `src/pages/saraban/units.tsx`

- [ ] **Step 1: เขียนหน้า**

```tsx
// สมุดผู้รับ (สเปกข้อ 6 "/saraban/units") — เพิ่มได้ แก้ได้ ลบไม่ได้ (ปิดแทน) เพราะหนังสืออ้าง id อยู่
// รหัสส่วนราชการจำเป็นต่อการออกเลขหนังสือส่ง: ระบบต่อ "/เลข" ท้ายรหัสเอง รหัสจึงห้ามมี '/'
import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import SarabanLayout from '@/components/saraban/SarabanLayout';
import { ErrorBox, card, inputClass, outlineButton, primaryButton } from '@/components/saraban/bits';
import { useToast } from '@/components/saraban/toast';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import { createUnit, messageOf, sarabanFetcher, UNITS_KEY, updateUnit } from '@/lib/saraban-api';
import type { SarabanUnit } from '@/types/saraban';

type Draft = { name: string; dept: string; refCode: string; order: string };
const BLANK: Draft = { name: '', dept: '', refCode: '', order: '' };

function draftProblem(d: Draft): string | null {
  if (!d.name.trim()) return 'ต้องระบุชื่อตำแหน่ง/หน่วยงาน';
  if (d.refCode.includes('/')) return "รหัสส่วนราชการห้ามมี '/' — ระบบต่อ /เลข ให้เอง";
  if (d.refCode.trim().length > 30) return 'รหัสส่วนราชการยาวเกิน 30 ตัว';
  if (d.order && !Number.isInteger(Number(d.order))) return 'ลำดับต้องเป็นจำนวนเต็ม';
  return null;
}

function toInput(d: Draft) {
  return { name: d.name.trim(), dept: d.dept.trim(), refCode: d.refCode.trim(), order: Number(d.order || 0) };
}

function UnitsPage() {
  const toast = useToast();
  const { data: units, error, mutate } = useSWR<SarabanUnit[]>(UNITS_KEY, sarabanFetcher);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    const p = draftProblem(draft);
    if (p) return setProblem(p);
    setProblem('');
    setBusy(true);
    try {
      await createUnit({ ...toInput(draft), isActive: true });
      await mutate();
      setDraft(BLANK);
      toast('เพิ่มในสมุดผู้รับแล้ว');
    } catch (err) {
      setProblem(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SarabanLayout title="สมุดผู้รับ">
      <form onSubmit={add} className={`${card} flex flex-col gap-3 p-5`}>
        <h2 className="font-semibold">เพิ่มตำแหน่ง / หน่วยงาน</h2>
        <div className="grid gap-2.5 sm:grid-cols-[2fr_1.4fr_1.2fr_0.6fr_auto]">
          <input className={inputClass} placeholder="ชื่อ เช่น ผอ.กองช่าง" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className={inputClass} placeholder="สังกัด" value={draft.dept} onChange={(e) => setDraft({ ...draft, dept: e.target.value })} />
          <input className={inputClass} placeholder="รหัสส่วนราชการ (ถ้ามี)" value={draft.refCode} onChange={(e) => setDraft({ ...draft, refCode: e.target.value })} />
          <input className={inputClass} placeholder="ลำดับ" inputMode="numeric" value={draft.order} onChange={(e) => setDraft({ ...draft, order: e.target.value })} />
          <button type="submit" className={primaryButton} disabled={busy}>
            เพิ่ม
          </button>
        </div>
        {problem ? <ErrorBox>{problem}</ErrorBox> : null}
        <p className="text-xs text-sb-muted">รหัสส่วนราชการ เช่น “ชม 55201” — หน่วยที่ไม่มีรหัสออกเลขหนังสือส่งไม่ได้ · ลบไม่ได้ ให้ปิดแทน</p>
      </form>

      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-sb-panel text-left text-xs text-sb-muted">
                <th className="px-4 py-3 font-semibold">ชื่อ</th>
                <th className="px-2.5 py-3 font-semibold">สังกัด</th>
                <th className="px-2.5 py-3 font-semibold">รหัสส่วนราชการ</th>
                <th className="px-2.5 py-3 font-semibold">ลำดับ</th>
                <th className="px-2.5 py-3 font-semibold">สถานะ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(units ?? []).map((u) => (
                <UnitRow key={u.id} unit={u} onSaved={() => mutate()} />
              ))}
            </tbody>
          </table>
        </div>
        {error ? <p className="px-4 py-6 text-center text-[13px] text-sb-danger">โหลดสมุดผู้รับไม่สำเร็จ</p> : null}
      </div>
    </SarabanLayout>
  );
}

function UnitRow({ unit, onSaved }: { unit: SarabanUnit; onSaved: () => void }) {
  const toast = useToast();
  const initial: Draft = { name: unit.name, dept: unit.dept, refCode: unit.refCode, order: String(unit.order) };
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);

  async function save(patch: Parameters<typeof updateUnit>[1], done: string) {
    setBusy(true);
    try {
      await updateUnit(unit.id, patch);
      onSaved();
      toast(done);
    } catch (err) {
      toast(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  const cell = 'w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 hover:border-sb-line-input focus:border-sb-line-input';
  return (
    <tr className={`border-t border-sb-page ${unit.isActive ? '' : 'text-sb-muted'}`}>
      <td className="px-3 py-1.5">
        <input className={cell} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      </td>
      <td className="px-1 py-1.5">
        <input className={cell} value={d.dept} onChange={(e) => setD({ ...d, dept: e.target.value })} />
      </td>
      <td className="px-1 py-1.5">
        <input className={cell} placeholder="—" value={d.refCode} onChange={(e) => setD({ ...d, refCode: e.target.value })} />
      </td>
      <td className="w-20 px-1 py-1.5">
        <input className={cell} inputMode="numeric" value={d.order} onChange={(e) => setD({ ...d, order: e.target.value })} />
      </td>
      <td className="px-2.5 py-1.5">
        <span className={`rounded-full px-2.5 py-[3px] text-xs font-semibold ${unit.isActive ? 'bg-sb-success-bg text-sb-success' : 'bg-sb-subtle text-sb-muted'}`}>
          {unit.isActive ? 'ใช้งาน' : 'ปิดแล้ว'}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-1.5 text-right">
        {dirty ? (
          <button
            type="button"
            className={`${primaryButton} mr-1.5 px-3 py-1.5 text-xs`}
            disabled={busy}
            onClick={() => {
              const p = draftProblem(d);
              if (p) return toast(p);
              void save(toInput(d), 'บันทึกแล้ว');
            }}
          >
            บันทึก
          </button>
        ) : null}
        <button
          type="button"
          className={`${outlineButton} px-3 py-1.5 text-xs`}
          disabled={busy}
          onClick={() => save({ isActive: !unit.isActive }, unit.isActive ? 'ปิดการใช้งานแล้ว' : 'เปิดใช้งานแล้ว')}
        >
          {unit.isActive ? 'ปิด' : 'เปิด'}
        </button>
      </td>
    </tr>
  );
}

export const getServerSideProps = getFeatureSsrProps('saraban');
export default withMemberGuard(UnitsPage);
```

- [ ] **Step 2: ตรวจและ Commit**

Run: `npx tsc --noEmit -p . && npm run lint`

```bash
git add src/pages/saraban/units.tsx
git commit -m "feat(saraban): หน้าสมุดผู้รับ"
```

---

## Task 10: ตรวจทั้งระบบ — build + smoke หน้าจอผ่าน dev server

- [ ] **Step 1: tsc · test · lint · build**

Run: `npx tsc --noEmit -p . && npm test && npm run lint && npx next build`
Expected: ผ่านทั้งหมด · build แสดง route `/saraban/*` ครบ 7 หน้า

- [ ] **Step 2: smoke หน้าจอ (dev-open + แบ็กเอนด์ไฟล์ + bucket ทดสอบ)**

```bash
rm -f data/saraban-docs.json data/saraban-years.json data/saraban-units.json
MONGODB_URI= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= npx next dev -p 3123   # background
```

ยิงทุกหน้า ต้องได้ 200 และมีข้อความหลักของหน้า (`/saraban` ได้ 307 ไป `/saraban/inbox`):

```bash
for p in inbox outbox receive send units; do
  printf "%s " $p; curl -s -o /tmp/sb.html -w '%{http_code} ' http://localhost:3123/saraban/$p; grep -c 'ระบบสารบรรณอิเล็กทรอนิกส์' /tmp/sb.html
done
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3123/saraban
```

แล้วรัน smoke ของ API (สร้างข้อมูลจริง) และเปิดหน้าหนังสือหนึ่งเรื่อง:

```bash
SMOKE_BASE=http://localhost:3123 MONGODB_URI= npx tsx --env-file=.env.local scripts/smoke-saraban-api.mts
id=$(node -e "console.log(require('./data/saraban-docs.json')[0].id)")
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3123/saraban/track/$id
```
Expected: `SMOKE OK` · หน้าหนังสือ 200

- [ ] **Step 3: เก็บกวาด**

```bash
rm -f data/saraban-docs.json data/saraban-years.json data/saraban-units.json
git status --short
```
Expected: ไม่มีไฟล์ค้าง

---

## หลังจบรอบ 1C

- ทดสอบด้วยมือบนเบราว์เซอร์ (localhost) — ลำดับแนะนำ: สมุดผู้รับ → ลงรับพร้อมไฟล์ → ทะเบียนรับ → หน้าหนังสือ
  (เปิดไฟล์ · แก้ไข · เพิ่ม/ลบไฟล์) → ออกเลขส่ง/เวียน → บันทึกว่าส่งแล้ว → ยกเลิก
- ก่อน deploy: ที่สำรองไฟล์ (สเปกข้อ 12) · `PORTAL_MANAGER_CLERK_ID` เปิดสิทธิ์ `saraban` ให้ผู้ใช้ที่หน้าจัดการผู้ใช้
