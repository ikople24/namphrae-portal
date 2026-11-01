# คลังไฟล์ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้า `/admin/files` ให้เจ้าหน้าที่ที่ล็อกอินดูรายการไฟล์ภายใน (ค้นหา ลำดับ ชื่อเป็นลิงก์ แบ่งหน้าละ 20) และให้ผู้มีสิทธิ์ `files` อัปโหลด แก้ชื่อ ลบได้

**Architecture:** ฟีเจอร์ใหม่แยกจากสารบรรณ ใช้ชั้นเก็บไฟล์ใน Railway bucket ร่วมกัน (`saraban-storage.ts`) แต่อยู่ใต้ prefix `files/` · ตรรกะบริสุทธิ์อยู่ใน `src/lib/file-library.ts` (เทสต์ได้) · store รองรับ Mongo + ไฟล์ dev fallback · route ดูใช้ `requireAdmin` (สมาชิกทุกคน) route เขียนเช็คสิทธิ์ `files`

**Tech Stack:** Next.js 16 Pages Router · React 19 · MongoDB driver v7 · AWS SDK v3 (S3) · zod v4 · SWR · Tailwind v4 · vitest

**สเปก:** [docs/superpowers/specs/2026-10-31-file-library-design.md](../specs/2026-10-31-file-library-design.md)

---

## โครงไฟล์

| ไฟล์ | สร้าง/แก้ | หน้าที่ |
|---|---|---|
| `src/types/file-library.ts` | สร้าง | `LibraryFile`, `LibraryListItem`, `LibraryPage` |
| `src/lib/file-library.ts` | สร้าง | pure client-safe: ค่าคงที่ schema แปลง query เลขหน้า ป้ายวันที่ ข้อความ error |
| `src/lib/file-library.test.ts` | สร้าง | เทสต์ของข้างบน |
| `src/lib/file-library-store.ts` | สร้าง | SERVER ONLY: Mongo `fileLibrary` / `data/file-library.json` |
| `src/lib/file-library-api.ts` | สร้าง | client wrapper ของ API พร้อม `LibraryApiError` (มี code) |
| `src/pages/api/admin/files/index.ts` | สร้าง | GET รายการ · POST อัปโหลด |
| `src/pages/api/admin/files/[id]/index.ts` | สร้าง | PATCH แก้ชื่อ · DELETE |
| `src/pages/api/admin/files/[id]/view.ts` | สร้าง | GET redirect ไปลิงก์ชั่วคราว |
| `src/pages/admin/files.tsx` | สร้าง | หน้ารายการ + กล่องอัปโหลด + แก้ชื่อในแถว |
| `src/lib/user-access.ts` | แก้ | เพิ่มฟีเจอร์ `files` ต่อท้าย |
| `src/lib/user-access.test.ts` | แก้ | เทสต์ `files` + ปรับเทสต์ "saraban ต่อท้ายสุด" |
| `src/lib/auth-server.ts` | แก้ | `getMemberSsrProps` |
| `src/lib/api-guard-coverage.test.ts` | แก้ | allowlist route ดูของคลังไฟล์ + เทสต์ว่า POST เช็คสิทธิ์ |
| `src/lib/icons.ts` | แก้ | เพิ่ม `folder` เข้า subset ฟอนต์ |
| `src/components/admin/AdminLayout.tsx` | แก้ | เมนู "คลังไฟล์" `feature: 'member'` |

หมายเหตุสำหรับผู้ลงมือ:
- vitest ครอบเฉพาะ logic บริสุทธิ์ (`src/**/*.test.ts`) ห้ามวางไฟล์เทสต์ใต้ `src/pages/**` (จะกลายเป็น route)
- `.ts` ใต้ `src/pages/api/admin/**` ทุกไฟล์ต้องผ่าน `api-guard-coverage.test.ts`
- ไฟล์ฝั่ง client ห้าม import `file-library-store.ts`, `saraban-storage.ts`, `auth-server.ts` (ยกเว้น `getServerSideProps` ที่ Next ตัดออกจาก bundle เอง)
- คอมเมนต์ในโค้ดเป็นภาษาไทยตามแนวของ repo
- ทำงานบน branch `feat/file-library` (สเปก commit ไว้แล้ว) · ทุก commit ต่อท้ายข้อความด้วยบรรทัด
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` (เว้นบรรทัดก่อน)

---

### Task 1: ตรรกะบริสุทธิ์ของคลังไฟล์ (`file-library.ts`)

**Files:**
- Create: `src/types/file-library.ts`
- Create: `src/lib/file-library.ts`
- Test: `src/lib/file-library.test.ts`

- [ ] **Step 1: สร้าง types**

`src/types/file-library.ts`:

```ts
// src/types/file-library.ts
// โดเมนของคลังไฟล์ (สเปก 2026-10-31) — หนึ่งรายการ = หนึ่งไฟล์ใน bucket ใต้ prefix files/

import type { SarabanFileFormat } from '@/types/saraban';

export type LibraryFile = {
  id: string; // uuid
  title: string; // ชื่อเรื่องที่แสดง 1–300 ตัวอักษร
  fileName: string; // ชื่อไฟล์เดิม — ใช้ตั้ง Content-Disposition ตอนเปิด
  key: string; // `files/<uuid>.<format>` — ไม่ส่งออกไปหน้าเว็บ
  format: SarabanFileFormat;
  bytes: number;
  uploadedAt: string; // ISO
};

/** ส่วนที่ส่งให้หน้าเว็บ — ไม่มี key/fileName ทางเดียวที่เปิดไฟล์ได้คือ route view ที่ตรวจสิทธิ์ */
export type LibraryListItem = Pick<LibraryFile, 'id' | 'title' | 'format' | 'bytes' | 'uploadedAt'>;

export type LibraryPage = {
  items: LibraryListItem[];
  total: number;
  page: number;
  pageSize: number;
};
```

- [ ] **Step 2: เขียนเทสต์ที่ล้ม**

`src/lib/file-library.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  escapeRegex,
  libraryErrorMessage,
  libraryKey,
  libraryListKey,
  matchesQuery,
  MAX_QUERY_LENGTH,
  newestFirst,
  pageWindow,
  parseListQuery,
  rowNumber,
  titleFromFileName,
  titleSchema,
  toListItem,
  totalPages,
  uploadedDateLabel,
} from '@/lib/file-library';
import type { LibraryFile } from '@/types/file-library';

const file = (over: Partial<LibraryFile> = {}): LibraryFile => ({
  id: 'a',
  title: 'รายงาน',
  fileName: 'รายงาน.pdf',
  key: 'files/a.pdf',
  format: 'pdf',
  bytes: 10,
  uploadedAt: '2026-10-31T03:00:00.000Z',
  ...over,
});

describe('libraryKey', () => {
  it('อยู่ใต้ files/ ไม่ซ้อนกับ saraban/ ที่สคริปต์ smoke ลบทิ้งทั้ง prefix', () => {
    expect(libraryKey('abc', 'pdf')).toBe('files/abc.pdf');
    expect(libraryKey('abc', 'pdf').startsWith('saraban/')).toBe(false);
  });
});

describe('titleFromFileName', () => {
  it('ตัดนามสกุลออก', () => {
    expect(titleFromFileName('รายงาน 2568.pdf')).toBe('รายงาน 2568');
  });
  it('ไม่มีนามสกุล → คืนทั้งชื่อ', () => {
    expect(titleFromFileName('รายงาน')).toBe('รายงาน');
  });
  it('มีหลายจุด → ตัดเฉพาะนามสกุลท้ายสุด', () => {
    expect(titleFromFileName('a.b.pdf')).toBe('a.b');
  });
  it('ขึ้นต้นด้วยจุด → ไม่ตัดจนว่าง', () => {
    expect(titleFromFileName('.pdf')).toBe('.pdf');
  });
  it('ตัดช่องว่างหัวท้าย', () => {
    expect(titleFromFileName('  คำสั่ง .png ')).toBe('คำสั่ง');
  });
});

describe('titleSchema', () => {
  it('trim แล้วผ่าน', () => {
    expect(titleSchema.parse('  ชื่อ  ')).toBe('ชื่อ');
  });
  it('ว่าง / ช่องว่างล้วน / ยาวเกิน 300 ไม่ผ่าน', () => {
    expect(titleSchema.safeParse('').success).toBe(false);
    expect(titleSchema.safeParse('   ').success).toBe(false);
    expect(titleSchema.safeParse('ก'.repeat(301)).success).toBe(false);
    expect(titleSchema.safeParse('ก'.repeat(300)).success).toBe(true);
  });
  it('ไม่ใช่ string (query ซ้ำเป็นอาเรย์) ไม่ผ่าน', () => {
    expect(titleSchema.safeParse(['a', 'b']).success).toBe(false);
  });
});

describe('parseListQuery', () => {
  it('ไม่มีอะไร → q ว่าง หน้า 1', () => {
    expect(parseListQuery({})).toEqual({ q: '', page: 1 });
  });
  it('page ไม่ใช่จำนวนเต็มบวก → 1', () => {
    for (const page of ['abc', '0', '-2', '1.5', '', '1e3']) {
      expect(parseListQuery({ page }).page).toBe(1);
    }
  });
  it('page ปกติ', () => {
    expect(parseListQuery({ page: '3' }).page).toBe(3);
  });
  it('ค่าซ้ำเป็นอาเรย์ → ใช้ตัวแรก', () => {
    expect(parseListQuery({ q: ['ก', 'ข'], page: ['2', '5'] })).toEqual({ q: 'ก', page: 2 });
  });
  it('q ถูก trim และตัดที่ MAX_QUERY_LENGTH', () => {
    expect(parseListQuery({ q: '  ผู้สูงอายุ ' }).q).toBe('ผู้สูงอายุ');
    expect(parseListQuery({ q: 'x'.repeat(500) }).q).toHaveLength(MAX_QUERY_LENGTH);
  });
});

describe('escapeRegex / matchesQuery', () => {
  it('วงเล็บและ .* ไม่กลายเป็น pattern', () => {
    expect(new RegExp(escapeRegex('(2567)')).test('รายงาน (2567)')).toBe(true);
    expect(new RegExp(escapeRegex('.*')).test('อะไรก็ได้')).toBe(false);
  });
  it('matchesQuery เป็น substring ไม่สนตัวพิมพ์ · q ว่าง = ตรงทั้งหมด', () => {
    expect(matchesQuery('รายงาน OTOP 2568', 'otop')).toBe(true);
    expect(matchesQuery('รายงาน', 'คนพิการ')).toBe(false);
    expect(matchesQuery('อะไรก็ได้', '')).toBe(true);
  });
});

describe('newestFirst', () => {
  it('ใหม่ก่อน เวลาเท่ากันเรียงตาม id มากไปน้อย (ให้ตรงกับ sort ของ Mongo)', () => {
    const rows = [
      file({ id: 'a', uploadedAt: '2026-10-01T00:00:00.000Z' }),
      file({ id: 'b', uploadedAt: '2026-10-31T00:00:00.000Z' }),
      file({ id: 'c', uploadedAt: '2026-10-31T00:00:00.000Z' }),
    ];
    expect(rows.sort(newestFirst).map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('toListItem', () => {
  it('ไม่ส่ง key และ fileName ออกไป', () => {
    const item = toListItem(file());
    expect(item).toEqual({
      id: 'a',
      title: 'รายงาน',
      format: 'pdf',
      bytes: 10,
      uploadedAt: '2026-10-31T03:00:00.000Z',
    });
    expect('key' in item).toBe(false);
  });
});

describe('เลขหน้า', () => {
  it('totalPages อย่างน้อย 1', () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(20)).toBe(1);
    expect(totalPages(21)).toBe(2);
  });
  it('rowNumber นับต่อเนื่องข้ามหน้า', () => {
    expect(rowNumber(1, 0)).toBe(1);
    expect(rowNumber(2, 0)).toBe(21);
    expect(rowNumber(3, 4)).toBe(45);
  });
  it('pageWindow ไม่เกิน 5 ปุ่ม ชิดขอบเมื่อใกล้หน้าแรก/สุดท้าย', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 2)).toEqual([1, 2]);
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(5, 10)).toEqual([3, 4, 5, 6, 7]);
    expect(pageWindow(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });
});

describe('libraryListKey', () => {
  it('ไม่ใส่พารามิเตอร์ที่เป็นค่าเริ่มต้น', () => {
    expect(libraryListKey('', 1)).toBe('/api/admin/files');
    expect(libraryListKey('', 2)).toBe('/api/admin/files?page=2');
  });
  it('เข้ารหัสคำค้นภาษาไทย', () => {
    expect(libraryListKey('คนพิการ', 1)).toBe(
      `/api/admin/files?q=${encodeURIComponent('คนพิการ')}`
    );
  });
});

describe('uploadedDateLabel', () => {
  it('วันที่ไทยย่อ ปี พ.ศ.', () => {
    expect(uploadedDateLabel('2026-10-31T03:00:00.000Z')).toBe('31 ต.ค. 2569');
  });
  it('ใช้วันที่ของกรุงเทพฯ ไม่ใช่ UTC', () => {
    expect(uploadedDateLabel('2026-10-31T18:00:00.000Z')).toBe('1 พ.ย. 2569');
  });
  it('ผิดรูป → ว่าง', () => {
    expect(uploadedDateLabel('ไม่ใช่วันที่')).toBe('');
  });
});

describe('libraryErrorMessage', () => {
  it('code ที่รู้จัก → ข้อความไทย', () => {
    expect(libraryErrorMessage('file_too_large')).toBe('ไฟล์ใหญ่เกิน 10 MB');
    expect(libraryErrorMessage('bad_format')).toBe('รับเฉพาะไฟล์ PDF, JPG, PNG');
  });
  it('ไม่รู้จัก / ไม่มี / ชื่อ property ของ Object → ข้อความกลาง', () => {
    expect(libraryErrorMessage('อะไร')).toBe('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    expect(libraryErrorMessage(undefined)).toBe('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    expect(libraryErrorMessage('constructor')).toBe('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
  });
});
```

- [ ] **Step 3: รันเทสต์ ต้องล้ม**

Run: `npx vitest run src/lib/file-library.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/file-library"`

- [ ] **Step 4: เขียนโมดูล**

`src/lib/file-library.ts`:

```ts
// src/lib/file-library.ts
// ตรรกะของคลังไฟล์ (สเปก 2026-10-31) — client-safe บริสุทธิ์ ไม่ import mongo/SDK
// ใช้ร่วมทั้ง API, store และหน้าจอ ตรึงด้วย file-library.test.ts

import { z } from 'zod';
import { thaiDate } from '@/lib/saraban-view';
import type { SarabanFileFormat } from '@/types/saraban';
import type { LibraryFile, LibraryListItem } from '@/types/file-library';

// ต้องไม่ซ้อนกับ 'saraban/' — scripts/smoke-saraban-api.mts ลบทุก key ใต้ saraban/ ตอนเก็บกวาด
// และ backup:saraban กวาดเฉพาะ prefix นั้น
export const FILES_PREFIX = 'files/';
export const PAGE_SIZE = 20;
export const MAX_QUERY_LENGTH = 100;
export const MAX_TITLE_LENGTH = 300;

export const titleSchema = z.string().trim().min(1).max(MAX_TITLE_LENGTH);
export const fileNameSchema = z.string().trim().min(1).max(255);
export const renameBodySchema = z.object({ title: titleSchema });

/** key ของไฟล์ใหม่ — id เป็น uuid ไม่ใช้ชื่อไฟล์ของผู้ใช้ (ภาษาไทย ช่องว่าง ชื่อซ้ำ) */
export function libraryKey(id: string, format: SarabanFileFormat): string {
  return `${FILES_PREFIX}${id}.${format}`;
}

/** 'รายงาน 2568.pdf' → 'รายงาน 2568' · ไม่มีนามสกุลหรือขึ้นต้นด้วยจุด → คืนทั้งชื่อ */
export function titleFromFileName(name: string): string {
  const trimmed = name.trim();
  const dot = trimmed.lastIndexOf('.');
  return dot > 0 ? trimmed.slice(0, dot).trim() : trimmed;
}

type QueryValue = string | string[] | undefined;

function firstValue(value: QueryValue): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/** req.query / router.query → { q, page } ที่ใช้ได้เสมอ — ค่าแปลกตกเป็นค่าเริ่มต้น ไม่โยน */
export function parseListQuery(query: { q?: QueryValue; page?: QueryValue }): {
  q: string;
  page: number;
} {
  const q = firstValue(query.q).trim().slice(0, MAX_QUERY_LENGTH);
  const raw = firstValue(query.page);
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
  return { q, page: Number.isSafeInteger(n) && n >= 1 ? n : 1 };
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** คู่ของ $regex แบบ escape + flag i ฝั่ง Mongo — ใช้ในแบ็กเอนด์ไฟล์ให้ผลเหมือนกัน */
export function matchesQuery(title: string, q: string): boolean {
  return q === '' || title.toLowerCase().includes(q.toLowerCase());
}

/** uploadedAt ใหม่ก่อน แล้ว id มากไปน้อย — เทียบแบบไบต์ให้ตรงกับ sort({ uploadedAt: -1, id: -1 }) ของ Mongo */
export function newestFirst(a: LibraryFile, b: LibraryFile): number {
  if (a.uploadedAt !== b.uploadedAt) return a.uploadedAt < b.uploadedAt ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

export function toListItem(file: LibraryFile): LibraryListItem {
  return {
    id: file.id,
    title: file.title,
    format: file.format,
    bytes: file.bytes,
    uploadedAt: file.uploadedAt,
  };
}

export function totalPages(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export function rowNumber(page: number, index: number): number {
  return (page - 1) * PAGE_SIZE + index + 1;
}

/** หมายเลขหน้ารอบหน้าปัจจุบัน ไม่เกิน size ปุ่ม — ชิดขอบเมื่ออยู่ใกล้หน้าแรก/สุดท้าย */
export function pageWindow(page: number, pages: number, size = 5): number[] {
  const count = Math.min(size, pages);
  const start = Math.min(Math.max(1, page - Math.floor(size / 2)), pages - count + 1);
  return Array.from({ length: count }, (_, i) => start + i);
}

/** key ของ SWR = URL ของ GET รายการ · ไม่ใส่ค่าเริ่มต้นลง URL */
export function libraryListKey(q: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const search = params.toString();
  return search ? `/api/admin/files?${search}` : '/api/admin/files';
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** ISO timestamp → '31 ต.ค. 2569' ตามวันที่กรุงเทพฯ · ผิดรูป → '' */
export function uploadedDateLabel(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return thaiDate(new Date(t + BANGKOK_OFFSET_MS).toISOString().slice(0, 10));
}

// Map ไม่ใช่ object literal — ERROR_MESSAGES['constructor'] ของ object literal คืนฟังก์ชันของ
// Object.prototype (บทเรียนเดียวกับ FORMAT_OF ใน saraban-attachment.ts)
const ERROR_MESSAGES = new Map<string, string>([
  ['storage_not_configured', 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์ ติดต่อผู้ดูแลระบบ'],
  ['file_too_large', 'ไฟล์ใหญ่เกิน 10 MB'],
  ['bad_format', 'รับเฉพาะไฟล์ PDF, JPG, PNG'],
  ['invalid_title', 'กรุณาใส่ชื่อเรื่อง (ไม่เกิน 300 ตัวอักษร)'],
  ['feature_denied', 'คุณไม่มีสิทธิ์จัดการคลังไฟล์'],
  ['not_found', 'ไม่พบไฟล์นี้ อาจถูกลบไปแล้ว'],
]);

export function libraryErrorMessage(code: string | undefined): string {
  return (code && ERROR_MESSAGES.get(code)) || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
}
```

- [ ] **Step 5: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/file-library.test.ts`
Expected: PASS ทุกเคส

- [ ] **Step 6: Commit**

```bash
git add src/types/file-library.ts src/lib/file-library.ts src/lib/file-library.test.ts
git commit -m "feat(files): ตรรกะบริสุทธิ์ของคลังไฟล์ (query เลขหน้า วันที่ ข้อความ error)"
```

---

### Task 2: สิทธิ์ `files` และ SSR guard สำหรับสมาชิกทุกคน

**Files:**
- Modify: `src/lib/user-access.ts:7-46`
- Modify: `src/lib/user-access.test.ts:104-124` (describe 'สิทธิ์ saraban') + ต่อท้ายไฟล์
- Modify: `src/lib/auth-server.ts` (ท้ายไฟล์ ต่อจาก `getManagerSsrProps`)

- [ ] **Step 1: แก้เทสต์ให้ล้ม**

ใน `src/lib/user-access.test.ts` แทนที่เทสต์ 'ต่อท้ายสุด' ของ describe 'สิทธิ์ saraban':

```ts
  it('ต่อท้ายสุด — สมาชิกที่มีทั้งปฏิทินและสารบรรณยังเข้าปฏิทินก่อนเหมือนเดิม', () => {
    expect(FEATURES.at(-1)).toBe('saraban');
    expect(firstAllowedPath({ isManager: false, features: ['calendar', 'saraban'] })).toBe(
      '/admin/calendar'
    );
  });
```

ด้วย:

```ts
  it('ต่อท้ายฟีเจอร์เดิม — สมาชิกที่มีทั้งปฏิทินและสารบรรณยังเข้าปฏิทินก่อนเหมือนเดิม', () => {
    expect(FEATURES.slice(-2)).toEqual(['saraban', 'files']);
    expect(firstAllowedPath({ isManager: false, features: ['calendar', 'saraban'] })).toBe(
      '/admin/calendar'
    );
  });
```

แล้วต่อท้ายไฟล์:

```ts
describe('สิทธิ์ files (คลังไฟล์)', () => {
  it('อยู่ท้ายสุดของ FEATURES แต่ไม่อยู่ในชุดเริ่มต้น — ผู้จัดการต้องติ๊กเปิดเอง', () => {
    expect(FEATURES.at(-1)).toBe('files');
    expect(DEFAULT_FEATURES).not.toContain('files');
  });

  it('สมาชิกเดิมที่ยังไม่เคยถูกตั้งค่า ไม่ได้สิทธิ์อัปโหลด/ลบติดมาเงียบ ๆ', () => {
    const r = resolveAccess({ doc: null, clerkId: 'user_a', managerEnvId: undefined });
    expect(hasFeature({ features: r.features, isManager: false }, 'files')).toBe(false);
  });

  it('ผู้จัดการได้สิทธิ์ files', () => {
    const r = resolveAccess({ doc: null, clerkId: 'mgr', managerEnvId: 'mgr' });
    expect(hasFeature(r, 'files')).toBe(true);
  });

  it('มีหน้าแรกและป้ายภาษาไทยในหน้าจัดการผู้ใช้', () => {
    expect(FEATURE_HOME.files).toBe('/admin/files');
    expect(firstAllowedPath({ isManager: false, features: ['files'] })).toBe('/admin/files');
    expect(FEATURE_LABELS.find((f) => f.key === 'files')?.label).toBe('คลังไฟล์ (อัปโหลด/ลบ)');
  });
});
```

- [ ] **Step 2: รันเทสต์ ต้องล้ม**

Run: `npx vitest run src/lib/user-access.test.ts`
Expected: FAIL — `expected [ 'settings', 'saraban' ] to deeply equal [ 'saraban', 'files' ]` และเทสต์ใน describe 'สิทธิ์ files'

- [ ] **Step 3: เพิ่มฟีเจอร์ใน `user-access.ts`**

ใน `FEATURES` เพิ่ม `'files'` ต่อจาก `'saraban'`:

```ts
export const FEATURES = [
  'links',
  'categories',
  'calendar',
  'map',
  'forest',
  'data',
  'settings',
  'saraban',
  'files',
] as const;
```

ใน `FEATURE_HOME` ต่อจาก `saraban: '/saraban',`:

```ts
  // สิทธิ์ files คือสิทธิ์ "จัดการ" (อัปโหลด/แก้ชื่อ/ลบ) — การดูคลังไฟล์เปิดให้สมาชิกทุกคน
  // (สเปก 2026-10-31 ข้อ 3) แต่หน้าแรกของคนที่มีสิทธิ์นี้อย่างเดียวก็คือคลังไฟล์
  files: '/admin/files',
```

ใน `FEATURE_LABELS` ต่อจากแถว saraban:

```ts
  { key: 'files', label: 'คลังไฟล์ (อัปโหลด/ลบ)' },
```

- [ ] **Step 4: เพิ่ม `getMemberSsrProps` ใน `auth-server.ts`**

ต่อท้ายไฟล์ ถัดจาก `getManagerSsrProps`:

```ts
/**
 * หน้าที่สมาชิกทุกคนเข้าได้ (คลังไฟล์ — สเปก 2026-10-31 ข้อ 3) · มาถึง allowed ได้แปลว่าผ่าน
 * ทะเบียนแล้ว จึงคืน true เสมอ ส่วนคนนอกทะเบียนยังถูก buildSsrGuard เด้งไป /apply เหมือนหน้าอื่น
 */
export const getMemberSsrProps: GetServerSideProps<AdminPageProps> = buildSsrGuard(() => true);
```

- [ ] **Step 5: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/user-access.test.ts && npx tsc --noEmit`
Expected: PASS ทุกเคส · tsc ไม่มี error (ถ้า `src/pages/admin/users.tsx` หรือที่อื่น error เพราะ `Record<FeatureKey, …>` ขาดคีย์ `files` ให้เพิ่มคีย์นั้นตามบริบทของไฟล์)

- [ ] **Step 6: Commit**

```bash
git add src/lib/user-access.ts src/lib/user-access.test.ts src/lib/auth-server.ts
git commit -m "feat(files): สิทธิ์ files และ SSR guard สำหรับหน้าที่สมาชิกทุกคนเข้าได้"
```

---

### Task 3: store ของคลังไฟล์

**Files:**
- Create: `src/lib/file-library-store.ts`

ไม่มีเทสต์หน่วย (repo เทสต์เฉพาะ logic บริสุทธิ์ ส่วนที่ตัดสินอะไรอยู่ใน `file-library.ts` แล้ว) ตรวจด้วย tsc และทดสอบมือใน Task 7

- [ ] **Step 1: เขียน store**

`src/lib/file-library-store.ts`:

```ts
// src/lib/file-library-store.ts
// รายการของคลังไฟล์ — Mongo `fileLibrary` | ไฟล์ data/file-library.json (dev fallback) — SERVER ONLY
// แบ็กเอนด์ไฟล์ใช้ readJsonArray/writeJsonArray ของสารบรรณ ซึ่งปฏิเสธตัวเองตอน production ที่ไม่มี
// MONGODB_URI (filesystem ของ Railway ไม่คงอยู่ข้าม deploy) — ไม่มี lock เหมือน saraban-file.ts

import type { Collection, Filter } from 'mongodb';
import { getDb, isMongoConfigured } from '@/lib/mongodb';
import { cacheUntilRejected } from '@/lib/promise-cache';
import { escapeRegex, matchesQuery, newestFirst, PAGE_SIZE, toListItem } from '@/lib/file-library';
import { readJsonArray, writeJsonArray } from '@/lib/saraban-file';
import type { LibraryFile, LibraryListItem } from '@/types/file-library';

const COLLECTION = 'fileLibrary';
const RUNTIME_FILE = 'file-library.json';

// ---- mongo ---------------------------------------------------------------

let indexed: Promise<void> | undefined;

async function filesCollection(): Promise<Collection<LibraryFile>> {
  const col = (await getDb()).collection<LibraryFile>(COLLECTION);
  await cacheUntilRejected(
    () => indexed,
    (value) => {
      indexed = value;
    },
    async () => {
      await col.createIndex({ id: 1 }, { unique: true });
      await col.createIndex({ uploadedAt: -1, id: -1 });
    }
  );
  return col;
}

// ---- file ----------------------------------------------------------------

function fileRead(): Promise<LibraryFile[]> {
  return readJsonArray<LibraryFile>(RUNTIME_FILE);
}

// ---- public API ----------------------------------------------------------

export async function listFiles(
  q: string,
  page: number
): Promise<{ items: LibraryListItem[]; total: number }> {
  const skip = (page - 1) * PAGE_SIZE;
  if (isMongoConfigured()) {
    const col = await filesCollection();
    const filter: Filter<LibraryFile> = q
      ? { title: { $regex: escapeRegex(q), $options: 'i' } }
      : {};
    const [docs, total] = await Promise.all([
      col
        .find(filter, { projection: { _id: 0 } })
        .sort({ uploadedAt: -1, id: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .toArray(),
      col.countDocuments(filter),
    ]);
    return { items: docs.map(toListItem), total };
  }
  const matched = (await fileRead()).filter((f) => matchesQuery(f.title, q)).sort(newestFirst);
  return { items: matched.slice(skip, skip + PAGE_SIZE).map(toListItem), total: matched.length };
}

export async function getFile(id: string): Promise<LibraryFile | null> {
  if (isMongoConfigured()) {
    return (await filesCollection()).findOne({ id }, { projection: { _id: 0 } });
  }
  return (await fileRead()).find((f) => f.id === id) ?? null;
}

export async function insertFile(file: LibraryFile): Promise<void> {
  if (isMongoConfigured()) {
    // spread เพื่อไม่ให้ driver แปะ _id ลงบน object ของผู้เรียก (แนวเดียวกับ saraban-units-store)
    await (await filesCollection()).insertOne({ ...file });
    return;
  }
  const rows = await fileRead();
  rows.push(file);
  await writeJsonArray(RUNTIME_FILE, rows);
}

/** null = ไม่พบ */
export async function renameFile(id: string, title: string): Promise<LibraryFile | null> {
  if (isMongoConfigured()) {
    return (await filesCollection()).findOneAndUpdate(
      { id },
      { $set: { title } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  }
  const rows = await fileRead();
  const row = rows.find((f) => f.id === id);
  if (!row) return null;
  row.title = title;
  await writeJsonArray(RUNTIME_FILE, rows);
  return row;
}

/** คืนรายการที่ลบ (route ใช้ key ไปลบ object ต่อ) · null = ไม่พบ */
export async function removeFile(id: string): Promise<LibraryFile | null> {
  if (isMongoConfigured()) {
    return (await filesCollection()).findOneAndDelete({ id }, { projection: { _id: 0 } });
  }
  const rows = await fileRead();
  const index = rows.findIndex((f) => f.id === id);
  if (index === -1) return null;
  const [removed] = rows.splice(index, 1);
  await writeJsonArray(RUNTIME_FILE, rows);
  return removed;
}
```

- [ ] **Step 2: ตรวจ type**

Run: `npx tsc --noEmit`
Expected: ไม่มี error · ถ้า driver v7 ฟ้องชนิดคืนของ `findOne`/`findOneAndUpdate` (เป็น `WithId<LibraryFile>`) ให้คงไว้แบบนี้ — `WithId<T>` assign ให้ `T` ได้ ถ้ายังฟ้องจริง ให้ดูชนิดที่ driver ประกาศใน `node_modules/mongodb/mongodb.d.ts` แล้วปรับเฉพาะชนิดคืน

- [ ] **Step 3: Commit**

```bash
git add src/lib/file-library-store.ts
git commit -m "feat(files): store รายการคลังไฟล์ (Mongo + ไฟล์ dev fallback)"
```

---

### Task 4: API routes + guard coverage

**Files:**
- Modify: `src/lib/api-guard-coverage.test.ts:11-13` และท้ายไฟล์
- Create: `src/pages/api/admin/files/index.ts`
- Create: `src/pages/api/admin/files/[id]/index.ts`
- Create: `src/pages/api/admin/files/[id]/view.ts`

- [ ] **Step 1: แก้เทสต์ guard ให้ล้ม**

ใน `src/lib/api-guard-coverage.test.ts` แทนที่:

```ts
// me.ts: identity ของ sidebar ต้องเปิดให้สมาชิกทุกคน
// config.ts: GET ใช้ร่วมหลายฟีเจอร์ ส่วน PUT เช็ค hasFeature('data') ในไฟล์เอง
const BARE_REQUIRE_ADMIN_OK = new Set(['me.ts', 'config.ts']);
```

ด้วย:

```ts
// me.ts: identity ของ sidebar ต้องเปิดให้สมาชิกทุกคน
// config.ts: GET ใช้ร่วมหลายฟีเจอร์ ส่วน PUT เช็ค hasFeature('data') ในไฟล์เอง
// files/index.ts: GET รายการคลังไฟล์เปิดให้สมาชิกทุกคน ส่วน POST เช็ค hasFeature('files') ในไฟล์เอง
//   (ตรึงด้วยเทสต์ท้ายไฟล์นี้)
// files/[id]/view.ts: เปิดไฟล์ในคลัง สมาชิกทุกคนดูได้ (สเปก 2026-10-31 ข้อ 3)
const BARE_REQUIRE_ADMIN_OK = new Set([
  'me.ts',
  'config.ts',
  'files/index.ts',
  'files/[id]/view.ts',
]);
```

แล้วต่อท้ายไฟล์:

```ts
describe('คลังไฟล์: route ที่เปิดให้สมาชิกทุกคนยังกันการเขียน', () => {
  it('files/index.ts: POST เช็คสิทธิ์ files ในไฟล์เอง', () => {
    const src = readFileSync(join(API_DIR, 'files', 'index.ts'), 'utf8');
    expect(src).toContain("hasFeature(admin, 'files')");
  });

  it('files/[id]/view.ts: รับเฉพาะ GET', () => {
    const src = readFileSync(join(API_DIR, 'files', '[id]', 'view.ts'), 'utf8');
    expect(src).toContain("req.method !== 'GET'");
  });
});
```

- [ ] **Step 2: รันเทสต์ ต้องล้ม**

Run: `npx vitest run src/lib/api-guard-coverage.test.ts`
Expected: FAIL — `ENOENT: no such file or directory ... files/index.ts`

- [ ] **Step 3: route รายการ + อัปโหลด**

`src/pages/api/admin/files/index.ts`:

```ts
import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import {
  fileNameSchema,
  libraryKey,
  PAGE_SIZE,
  parseListQuery,
  titleSchema,
  toListItem,
} from '@/lib/file-library';
import { insertFile, listFiles } from '@/lib/file-library-store';
import { readRawBody } from '@/lib/raw-body';
import { CONTENT_TYPES, MAX_FILE_BYTES, sniffFormat } from '@/lib/saraban-attachment';
import { deleteObject, isStorageConfigured, putObject } from '@/lib/saraban-storage';
import { hasFeature } from '@/lib/user-access';
import type { LibraryFile, LibraryPage } from '@/types/file-library';

// POST ส่งเนื้อไฟล์ดิบ — ปิด bodyParser แล้วอ่านเองพร้อมเพดาน (raw-body.ts) · GET ไม่มี body ไม่กระทบ
export const config = { api: { bodyParser: false } };

// GET  /api/admin/files?q=&page= — รายการคลังไฟล์ สมาชิกทุกคน (สเปก 2026-10-31 ข้อ 4)
// POST /api/admin/files?title=&name= — อัปโหลดหนึ่งไฟล์ = หนึ่งรายการ เฉพาะผู้มีสิทธิ์ files
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') return list(req, res);
  if (req.method === 'POST') {
    if (!hasFeature(admin, 'files')) return res.status(403).json({ error: 'feature_denied' });
    return upload(req, res);
  }
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}

async function list(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { q, page } = parseListQuery(req.query);
    const { items, total } = await listFiles(q, page);
    const body: LibraryPage = { items, total, page, pageSize: PAGE_SIZE };
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (err) {
    console.error('GET /api/admin/files failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function upload(req: NextApiRequest, res: NextApiResponse) {
  if (!isStorageConfigured()) return res.status(503).json({ error: 'storage_not_configured' });

  const title = titleSchema.safeParse(req.query.title);
  if (!title.success) return res.status(400).json({ error: 'invalid_title' });
  const name = fileNameSchema.safeParse(req.query.name);
  if (!name.success) return res.status(400).json({ error: 'invalid_name' });

  // บอกขนาดมาเกินตั้งแต่ header → ตอบเลยโดยไม่อ่าน body (แนวเดียวกับ saraban/uploads.ts)
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_FILE_BYTES) {
    return res.status(413).json({ error: 'file_too_large' });
  }

  let key: string | undefined;
  try {
    const body = await readRawBody(req, MAX_FILE_BYTES);
    if (body === null) return res.status(413).json({ error: 'file_too_large' });
    // ชนิดจากเนื้อไฟล์ ไม่เชื่อนามสกุลหรือ Content-Type (กัน .html ปลอมเป็น .pdf)
    const format = sniffFormat(body);
    if (!format) return res.status(400).json({ error: 'bad_format' });

    const id = crypto.randomUUID();
    key = libraryKey(id, format);
    await putObject(key, body, CONTENT_TYPES[format], 1);
    const file: LibraryFile = {
      id,
      title: title.data,
      fileName: name.data,
      key,
      format,
      bytes: body.length,
      uploadedAt: new Date().toISOString(),
    };
    await insertFile(file);
    return res.status(201).json(toListItem(file));
  } catch (err) {
    console.error('POST /api/admin/files failed', err);
    // บันทึกรายการล้มหลัง put แล้ว = object ไม่มีใครอ้าง — ลบทิ้ง ไม่ให้ค้างใน bucket
    if (key) {
      const orphan = key;
      await deleteObject(orphan).catch((e) =>
        console.warn('POST /api/admin/files: ลบ object ไม่สำเร็จ เหลือไฟล์กำพร้า', orphan, e)
      );
    }
    return res.status(500).json({ error: 'server_error' });
  }
}
```

- [ ] **Step 4: route แก้ชื่อ + ลบ**

`src/pages/api/admin/files/[id]/index.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { renameBodySchema, toListItem } from '@/lib/file-library';
import { removeFile, renameFile } from '@/lib/file-library-store';
import { deleteObject, isStorageConfigured } from '@/lib/saraban-storage';

// PATCH  /api/admin/files/[id] { title } — แก้ชื่อเรื่อง
// DELETE /api/admin/files/[id] — ลบรายการก่อน แล้วค่อยลบ object
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'files');
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method === 'PATCH') {
    const parsed = renameBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_title' });
    try {
      const updated = await renameFile(id, parsed.data.title);
      if (!updated) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(toListItem(updated));
    } catch (err) {
      console.error('PATCH /api/admin/files/[id] failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const removed = await removeFile(id);
      if (!removed) return res.status(404).json({ error: 'not_found' });
      // ลบ object หลัง DB สำเร็จเท่านั้น — พลาดตรงนี้ = ไฟล์กำพร้าหนึ่งไฟล์ ไม่ใช่รายการที่ชี้ไฟล์ที่หายไป
      if (isStorageConfigured()) {
        await deleteObject(removed.key).catch((err) =>
          console.warn('DELETE /api/admin/files/[id]: ลบ object ไม่สำเร็จ เหลือไฟล์กำพร้า', removed.key, err)
        );
      }
      return res.status(204).end();
    } catch (err) {
      console.error('DELETE /api/admin/files/[id] failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
```

- [ ] **Step 5: route เปิดไฟล์**

`src/pages/api/admin/files/[id]/view.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { getFile } from '@/lib/file-library-store';
import { CONTENT_TYPES } from '@/lib/saraban-attachment';
import { isStorageConfigured, viewUrl } from '@/lib/saraban-storage';

// GET /api/admin/files/[id]/view — สมาชิกทุกคน · 302 ไปลิงก์ชั่วคราว 5 นาที (ไม่ stream ผ่านแอป)
// ลิงก์นี้คือทางเดียวที่เปิดไฟล์ได้ เพราะ bucket เป็น private
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });
  if (!isStorageConfigured()) return res.status(503).json({ error: 'storage_not_configured' });

  try {
    const file = await getFile(id);
    if (!file) return res.status(404).json({ error: 'not_found' });
    // ลิงก์มีอายุ — ห้าม cache การ redirect ไม่งั้นเบราว์เซอร์พาไปลิงก์ที่หมดอายุแล้ว
    res.setHeader('Cache-Control', 'no-store');
    // ไม่ return ค่าของ res.redirect — Next เตือน "API handler should not return a value"
    res.redirect(302, await viewUrl(file.key, file.fileName, CONTENT_TYPES[file.format]));
    return;
  } catch (err) {
    console.error('GET /api/admin/files/[id]/view failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
```

- [ ] **Step 6: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/api-guard-coverage.test.ts && npx tsc --noEmit`
Expected: PASS รวมแถว `files/index.ts`, `files/[id]/index.ts`, `files/[id]/view.ts` · tsc ไม่มี error

- [ ] **Step 7: Commit**

```bash
git add src/lib/api-guard-coverage.test.ts src/pages/api/admin/files
git commit -m "feat(files): API รายการ อัปโหลด แก้ชื่อ ลบ และเปิดไฟล์คลัง"
```

---

### Task 5: client API wrapper + เมนู sidebar + ไอคอน

**Files:**
- Create: `src/lib/file-library-api.ts`
- Modify: `src/lib/icons.ts` (ICON_NAMES)
- Modify: `src/components/admin/AdminLayout.tsx:15-25` (NAV) และ `:55-63` (filter)

- [ ] **Step 1: เขียน client wrapper**

`src/lib/file-library-api.ts`:

```ts
// src/lib/file-library-api.ts
// client wrapper ของ /api/admin/files — โยน LibraryApiError ที่มี code ให้หน้าจอเลือกข้อความ/พฤติกรรม
// (admin-api.ts รวม code ไว้ใน message ซึ่งหน้าคลังไฟล์ต้องแยก storage_not_configured ออกมา)

import { libraryErrorMessage } from '@/lib/file-library';
import type { LibraryListItem } from '@/types/file-library';

export class LibraryApiError extends Error {
  readonly code: string | undefined;

  constructor(code: string | undefined) {
    super(libraryErrorMessage(code));
    this.code = code;
  }
}

async function okOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  let code: string | undefined;
  try {
    const body = (await res.json()) as { error?: unknown };
    code = typeof body?.error === 'string' ? body.error : undefined;
  } catch {
    // body ไม่ใช่ JSON (เช่น 413 จาก proxy หน้าเว็บ) — ใช้ status แทน
  }
  throw new LibraryApiError(code ?? (res.status === 413 ? 'file_too_large' : undefined));
}

export async function uploadLibraryFile(file: File, title: string): Promise<LibraryListItem> {
  const params = new URLSearchParams({ title, name: file.name });
  return okOrThrow(
    await fetch(`/api/admin/files?${params}`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    })
  );
}

export async function renameLibraryFile(id: string, title: string): Promise<LibraryListItem> {
  return okOrThrow(
    await fetch(`/api/admin/files/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    })
  );
}

export async function deleteLibraryFile(id: string): Promise<void> {
  return okOrThrow(
    await fetch(`/api/admin/files/${encodeURIComponent(id)}`, { method: 'DELETE' })
  );
}

export function libraryViewUrl(id: string): string {
  return `/api/admin/files/${encodeURIComponent(id)}/view`;
}
```

- [ ] **Step 2: เพิ่มไอคอน `folder`**

ใน `src/lib/icons.ts` ใน `ICON_NAMES` เพิ่ม `'folder',` ระหว่าง `'edit',` กับ `'forest',` (รายการเรียงตามตัวอักษร):

```ts
  'edit',
  'folder',
  'forest',
```

- [ ] **Step 3: เพิ่มเมนูใน AdminLayout**

ใน `src/components/admin/AdminLayout.tsx` เพิ่มแถวใน `NAV` ระหว่าง forest กับ saraban:

```ts
  { href: '/admin/forest', label: 'ข้อมูลป่าไม้', icon: 'forest', exact: false, feature: 'forest' },
  { href: '/admin/files', label: 'คลังไฟล์', icon: 'folder', exact: false, feature: 'member' },
  { href: '/saraban', label: 'ระบบสารบรรณ', icon: 'mail', exact: false, feature: 'saraban' },
```

แล้วแทนที่ filter:

```ts
      : NAV.filter((item) =>
          item.feature === 'manager'
            ? me.isManager === true
            : me.isManager === true || (me.features ?? []).includes(item.feature)
        );
```

ด้วย:

```ts
      : NAV.filter((item) =>
          item.feature === 'manager'
            ? me.isManager === true
            : // 'member' = สมาชิกทุกคน (คลังไฟล์ — การดูไม่ผูกฟีเจอร์ สเปก 2026-10-31 ข้อ 3)
              item.feature === 'member' ||
              me.isManager === true ||
              (me.features ?? []).includes(item.feature)
        );
```

- [ ] **Step 4: ตรวจ type และ lint**

Run: `npx tsc --noEmit && npx eslint src/lib/file-library-api.ts src/components/admin/AdminLayout.tsx src/lib/icons.ts`
Expected: ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add src/lib/file-library-api.ts src/lib/icons.ts src/components/admin/AdminLayout.tsx
git commit -m "feat(files): client API และเมนูคลังไฟล์ที่สมาชิกทุกคนเห็น"
```

---

### Task 6: หน้า `/admin/files`

**Files:**
- Create: `src/pages/admin/files.tsx`

พฤติกรรมที่หน้านี้ต้องมี (จากสเปกข้อ 5):
- `q`/`page` อยู่ใน URL · คำค้น debounce 300ms แล้ว `router.replace` (ไม่เพิ่ม history ต่อการพิมพ์) · เปลี่ยนหน้าใช้ `router.push` (back ย้อนหน้าได้) · ทั้งคู่ `shallow: true` ไม่รัน `getServerSideProps` ซ้ำ
- ช่องค้นหา sync กลับเมื่อ URL เปลี่ยนจาก back/forward ด้วยแพทเทิร์น "ปรับ state ระหว่าง render" (ไม่ใช้ setState ใน effect)
- ลำดับและ "คุณกำลังอยู่หน้า N" ใช้ `data.page` ไม่ใช่ `page` จาก URL — ระหว่างโหลดหน้าใหม่ `keepPreviousData` ยังโชว์ข้อมูลหน้าเดิม
- ได้ผลว่างแต่ `total > 0` (หน้าเกิน เช่นลบรายการสุดท้ายของหน้าท้าย) → `router.replace` ไปหน้าสุดท้ายเอง ครอบเคส "ลบรายการสุดท้ายของหน้า → ถอยไปหน้าก่อน" โดยไม่ต้องมีโค้ดเฉพาะ
- สิทธิ์จัดการอ่านจาก `/api/admin/me` (key เดียวกับ AdminLayout SWR จึง dedupe) · dev-open ได้ครบทุกสิทธิ์จาก route เอง

- [ ] **Step 1: เขียนหน้า**

`src/pages/admin/files.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import Icon from '@/components/Icon';
import { adminFetcher } from '@/lib/admin-api';
import { getMemberSsrProps } from '@/lib/auth-server';
import {
  libraryErrorMessage,
  libraryListKey,
  MAX_TITLE_LENGTH,
  pageWindow,
  parseListQuery,
  rowNumber,
  titleFromFileName,
  totalPages,
  uploadedDateLabel,
} from '@/lib/file-library';
import {
  deleteLibraryFile,
  LibraryApiError,
  libraryViewUrl,
  renameLibraryFile,
  uploadLibraryFile,
} from '@/lib/file-library-api';
import { MAX_FILE_BYTES } from '@/lib/saraban-attachment';
import type { LibraryListItem, LibraryPage } from '@/types/file-library';

type Me = { features?: string[]; isManager?: boolean };

function errorText(err: unknown): string {
  return err instanceof LibraryApiError ? err.message : libraryErrorMessage(undefined);
}

/** query ของ URL หน้า — ไม่ใส่ค่าเริ่มต้น (หน้า 1 / คำค้นว่าง) */
function listQuery(q: string, page: number): Record<string, string> {
  const query: Record<string, string> = {};
  if (q) query.q = q;
  if (page > 1) query.page = String(page);
  return query;
}

function FilesPage() {
  const router = useRouter();
  const { q, page } = parseListQuery(router.query);

  // ช่องค้นหา: พิมพ์อิสระ แล้ว debounce ไปเขียน URL · URL เปลี่ยนจาก back/forward → sync กลับ
  const [draft, setDraft] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setDraft(q);
  }

  const [uploadOpen, setUploadOpen] = useState(false);
  const [storageMissing, setStorageMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: me } = useSWR<Me>('/api/admin/me', adminFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const canManage = me?.isManager === true || (me?.features ?? []).includes('files');

  const { data, error, mutate } = useSWR<LibraryPage>(
    libraryListKey(q, page),
    adminFetcher,
    { keepPreviousData: true }
  );

  useEffect(() => {
    const trimmed = draft.trim();
    if (trimmed === q) return;
    const timer = setTimeout(() => {
      void router.replace(
        { pathname: router.pathname, query: listQuery(trimmed, 1) },
        undefined,
        { shallow: true }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, q, router]);

  // หน้าเกินจำนวนจริง (ลบรายการสุดท้ายของหน้าท้าย / ลิงก์เก่า) → ไปหน้าสุดท้าย
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && data.page > 1) {
      void router.replace(
        { pathname: router.pathname, query: listQuery(q, totalPages(data.total)) },
        undefined,
        { shallow: true }
      );
    }
  }, [data, q, router]);

  function goToPage(next: number) {
    void router.push({ pathname: router.pathname, query: listQuery(q, next) }, undefined, {
      shallow: true,
    });
  }

  async function onRename(item: LibraryListItem, title: string) {
    await renameLibraryFile(item.id, title);
    await mutate();
  }

  async function onDelete(item: LibraryListItem) {
    if (!confirm(`ลบ “${item.title}” ?\nไฟล์จะถูกลบถาวร กู้คืนไม่ได้`)) return;
    setNotice(null);
    try {
      await deleteLibraryFile(item.id);
      await mutate();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  async function onUploaded() {
    setUploadOpen(false);
    setNotice(null);
    // ไฟล์ใหม่อยู่บนสุดของหน้า 1 ที่ไม่มีคำค้น
    if (q || page > 1) {
      setDraft('');
      await router.push({ pathname: router.pathname, query: {} }, undefined, { shallow: true });
    } else {
      await mutate();
    }
  }

  const pages = data ? totalPages(data.total) : 1;
  const colSpan = canManage ? 4 : 3;

  let rows;
  if (!data && error) {
    rows = (
      <tr>
        <td colSpan={colSpan} className="px-4 py-8 text-center text-ink-soft">
          โหลดรายการไม่สำเร็จ{' '}
          <button onClick={() => void mutate()} className="font-semibold text-emerald-deep underline">
            ลองใหม่
          </button>
        </td>
      </tr>
    );
  } else if (!data) {
    rows = (
      <tr>
        <td colSpan={colSpan} className="px-4 py-8 text-center text-ink-mute">
          กำลังโหลด…
        </td>
      </tr>
    );
  } else if (data.items.length === 0) {
    rows = (
      <tr>
        <td colSpan={colSpan} className="px-4 py-8 text-center text-ink-mute">
          {q ? `ไม่พบไฟล์ที่ตรงกับ “${q}”` : 'ยังไม่มีไฟล์'}
        </td>
      </tr>
    );
  } else {
    rows = data.items.map((item, i) => (
      <FileRow
        key={item.id}
        item={item}
        number={rowNumber(data.page, i)}
        canManage={canManage}
        onRename={onRename}
        onDelete={onDelete}
      />
    ));
  }

  return (
    <AdminLayout
      title="คลังไฟล์"
      actions={
        canManage && !storageMissing ? (
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-deep"
          >
            <Icon name="upload_file" size={18} />
            อัปโหลดไฟล์
          </button>
        ) : null
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">คุณกำลังอยู่หน้า {data?.page ?? page}</p>

        {storageMissing ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {libraryErrorMessage('storage_not_configured')}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{notice}</p>
        ) : null}

        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="ค้นหาชื่อไฟล์…"
          aria-label="ค้นหาชื่อไฟล์"
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-emerald"
        />

        <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.07] font-display text-[13px] text-ink-soft">
                <th className="w-16 px-4 py-3 text-center font-semibold">ลำดับ</th>
                <th className="px-4 py-3 text-left font-semibold">ชื่อ</th>
                <th className="hidden w-36 px-4 py-3 text-left font-semibold sm:table-cell">
                  วันที่อัปโหลด
                </th>
                {canManage ? (
                  <th className="w-24 px-4 py-3">
                    <span className="sr-only">จัดการ</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>

        {data && pages > 1 ? <Pager page={data.page} pages={pages} onGo={goToPage} /> : null}
      </div>

      {uploadOpen ? (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onUploaded={() => void onUploaded()}
          onStorageMissing={() => {
            setUploadOpen(false);
            setStorageMissing(true);
          }}
        />
      ) : null}
    </AdminLayout>
  );
}

function FileRow({
  item,
  number,
  canManage,
  onRename,
  onDelete,
}: {
  item: LibraryListItem;
  number: number;
  canManage: boolean;
  onRename: (item: LibraryListItem, title: string) => Promise<void>;
  onDelete: (item: LibraryListItem) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit() {
    setTitle(item.title);
    setErr(null);
    setEditing(true);
  }

  async function save() {
    const next = title.trim();
    if (next === item.title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onRename(item, next);
      setEditing(false);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b border-black/5 last:border-b-0">
      <td className="px-4 py-2.5 text-center align-top text-ink-soft">{number}</td>
      <td className="px-4 py-2.5 align-top">
        {editing ? (
          <div className="space-y-1">
            <input
              autoFocus
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              disabled={saving}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save();
                if (e.key === 'Escape') setEditing(false);
              }}
              aria-label="ชื่อเรื่อง"
              className="w-full rounded-lg border border-emerald px-3 py-1.5 text-sm text-ink outline-none"
            />
            <p className="text-xs text-ink-mute">Enter บันทึก · Esc ยกเลิก</p>
            {err ? <p className="text-xs text-red-700">{err}</p> : null}
          </div>
        ) : (
          <a
            href={libraryViewUrl(item.id)}
            target="_blank"
            rel="noopener"
            className="text-ink underline decoration-black/30 underline-offset-2 transition hover:text-emerald-deep hover:decoration-emerald"
          >
            {item.title}
          </a>
        )}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-2.5 align-top text-ink-soft sm:table-cell">
        {uploadedDateLabel(item.uploadedAt)}
      </td>
      {canManage ? (
        <td className="whitespace-nowrap px-4 py-2.5 text-right align-top">
          {editing ? null : (
            <>
              <button
                onClick={startEdit}
                aria-label={`แก้ชื่อ ${item.title}`}
                title="แก้ชื่อ"
                className="rounded-lg p-1.5 text-ink-faint transition hover:bg-black/5 hover:text-ink"
              >
                <Icon name="edit" size={18} />
              </button>
              <button
                onClick={() => void onDelete(item)}
                aria-label={`ลบ ${item.title}`}
                title="ลบ"
                className="rounded-lg p-1.5 text-ink-faint transition hover:bg-red-50 hover:text-red-700"
              >
                <Icon name="delete" size={18} />
              </button>
            </>
          )}
        </td>
      ) : null}
    </tr>
  );
}

function Pager({
  page,
  pages,
  onGo,
}: {
  page: number;
  pages: number;
  onGo: (page: number) => void;
}) {
  const base =
    'min-w-9 border-l border-black/10 px-3 py-1.5 text-sm transition first:border-l-0 disabled:cursor-default disabled:bg-black/[0.03] disabled:text-ink-mute';
  const idle = 'text-emerald-deep hover:bg-emerald-050';
  return (
    <nav
      aria-label="แบ่งหน้า"
      className="inline-flex overflow-hidden rounded-lg border border-black/10 bg-white"
    >
      <button className={`${base} ${idle}`} disabled={page === 1} onClick={() => onGo(1)} aria-label="หน้าแรก">
        {'<<'}
      </button>
      <button className={`${base} ${idle}`} disabled={page === 1} onClick={() => onGo(page - 1)} aria-label="หน้าก่อน">
        {'<'}
      </button>
      {pageWindow(page, pages).map((n) => (
        <button
          key={n}
          className={`${base} ${n === page ? 'bg-emerald font-semibold text-white' : idle}`}
          aria-current={n === page ? 'page' : undefined}
          onClick={() => onGo(n)}
        >
          {n}
        </button>
      ))}
      <button className={`${base} ${idle}`} disabled={page === pages} onClick={() => onGo(page + 1)} aria-label="หน้าถัดไป">
        {'>'}
      </button>
      <button className={`${base} ${idle}`} disabled={page === pages} onClick={() => onGo(pages)} aria-label="หน้าสุดท้าย">
        {'>>'}
      </button>
    </nav>
  );
}

function UploadDialog({
  onClose,
  onUploaded,
  onStorageMissing,
}: {
  onClose: () => void;
  onUploaded: () => void;
  onStorageMissing: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function pick(picked: File | undefined) {
    setErr(null);
    if (!picked) {
      setFile(null);
      return;
    }
    // ตรวจก่อนส่ง ไม่ให้รอส่งไฟล์ใหญ่จนจบแล้วค่อยโดน 413 — เซิร์ฟเวอร์ยังตรวจซ้ำเสมอ
    if (picked.size > MAX_FILE_BYTES) {
      setFile(null);
      setErr(libraryErrorMessage('file_too_large'));
      return;
    }
    setFile(picked);
    setTitle(titleFromFileName(picked.name));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      await uploadLibraryFile(file, title.trim());
      onUploaded();
    } catch (error) {
      if (error instanceof LibraryApiError && error.code === 'storage_not_configured') {
        onStorageMissing();
        return;
      }
      setErr(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) onClose();
      }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
    >
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="upload-title" className="font-display text-lg font-semibold text-ink">
          อัปโหลดไฟล์
        </h2>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">ไฟล์ (PDF, JPG, PNG ไม่เกิน 10 MB)</span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            disabled={busy}
            onChange={(e) => pick(e.target.files?.[0])}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-emerald-050 file:px-4 file:py-2 file:text-sm file:font-medium file:text-emerald-deep"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">ชื่อเรื่อง</span>
          <input
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เลือกไฟล์แล้วจะเติมจากชื่อไฟล์ให้"
            className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-ink outline-none transition focus:border-emerald"
          />
        </label>

        {err ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-black/5 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!file || !title.trim() || busy}
            className="rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-deep disabled:opacity-50"
          >
            {busy ? 'กำลังอัปโหลด…' : 'บันทึก'}
          </button>
        </div>
      </form>
    </div>
  );
}

export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(FilesPage);
```

- [ ] **Step 2: ตรวจ type และ lint**

Run: `npx tsc --noEmit && npx eslint src/pages/admin/files.tsx`
Expected: ไม่มี error · ถ้า react-hooks ฟ้องการ setState ระหว่าง render ใน `if (q !== syncedQ)` — แพทเทิร์นนี้ React รับรอง ("adjusting state when a prop changes") ให้ตรวจว่า rule ที่ฟ้องคือตัวไหนแล้วแก้ตามที่ rule แนะนำ ห้ามย้ายไปไว้ใน `useEffect`

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/files.tsx
git commit -m "feat(files): หน้าคลังไฟล์ ค้นหา แบ่งหน้า อัปโหลด แก้ชื่อ ลบ"
```

---

### Task 7: ตรวจทั้งระบบ

**Files:** ไม่มีไฟล์ใหม่ (แก้เฉพาะถ้าเจอปัญหา)

- [ ] **Step 1: เทสต์ lint build**

Run: `npm test && npm run lint && npm run build`
Expected: เทสต์ผ่านทั้งหมด · lint ไม่มี error · build สำเร็จ และในตาราง route ของ build มี `/admin/files`, `/api/admin/files`, `/api/admin/files/[id]`, `/api/admin/files/[id]/view`

- [ ] **Step 2: ทดสอบมือ — โหมดเปิด (ไม่ตั้ง Clerk) และไม่มี bucket**

ถ้า `.env.local` ไม่มี `BUCKET_*` ครบ:
Run: `npm run dev` แล้วเปิด `http://localhost:3000/admin/files`
Expected:
- เมนู "คลังไฟล์" มีไอคอนโฟลเดอร์ (ไม่ใช่ข้อความ "folder")
- หน้าแสดง "ยังไม่มีไฟล์"
- กดอัปโหลด เลือก PDF แล้วกดบันทึก → กล่องปิด และมีแถบ "ยังไม่ได้ตั้งค่าที่เก็บไฟล์ ติดต่อผู้ดูแลระบบ" ปุ่มอัปโหลดหายไป

- [ ] **Step 3: ทดสอบมือ — มี bucket**

ตั้ง `BUCKET_*` ใน `.env.local` (ค่าเดียวกับที่สารบรรณใช้) แล้วรีสตาร์ท `npm run dev`
ตรวจทีละข้อ:
1. อัปโหลด PDF ชื่อไทย เช่น `รายงานผู้สูงอายุ (2568).pdf` → ช่องชื่อเติม `รายงานผู้สูงอายุ (2568)` · บันทึกแล้วขึ้นแถวบนสุด ลำดับ 1 วันที่วันนี้แบบไทย
2. คลิกชื่อ → เปิดแท็บใหม่ แสดง PDF ได้ ชื่อไฟล์ตอนกดดาวน์โหลดในตัวดู PDF เป็นชื่อเดิม
3. อัปโหลด JPG และ PNG ได้
4. สร้างไฟล์ปลอม: `printf '<html><script>alert(1)</script></html>' > /tmp/fake.pdf` แล้วอัปโหลด → "รับเฉพาะไฟล์ PDF, JPG, PNG"
5. เลือกไฟล์ใหญ่กว่า 10 MB → ขึ้น "ไฟล์ใหญ่เกิน 10 MB" ทันทีโดยไม่ส่ง
6. ค้นหา `(2568)` → เจอไฟล์ข้อ 1 · ค้นหา `.*` → ไม่พบ · URL มี `?q=`
7. อัปโหลดให้เกิน 20 ไฟล์ (หรือแก้ `PAGE_SIZE` ชั่วคราวเป็น 2 แล้วคืนค่าก่อน commit) → มีแถบแบ่งหน้า หน้า 2 ลำดับเริ่มที่ 21 · กด back ของเบราว์เซอร์กลับหน้า 1
8. แก้ชื่อ → Enter บันทึก · Esc ยกเลิก · ลบชื่อจนว่างแล้ว Enter → "กรุณาใส่ชื่อเรื่อง (ไม่เกิน 300 ตัวอักษร)"
9. อยู่หน้าสุดท้ายที่มี 1 รายการ แล้วลบ → ถอยไปหน้าก่อนเอง
10. ลบไฟล์ → หายจากรายการ · เปิดลิงก์ view ของไฟล์นั้นซ้ำ (จากแท็บเก่า) → 404

- [ ] **Step 4: ทดสอบสิทธิ์ (ถ้ามี Clerk + Mongo ใน dev)**

1. ล็อกอินด้วยสมาชิกที่ไม่มีสิทธิ์ `files` → เห็นเมนูคลังไฟล์ ดูและเปิดไฟล์ได้ ไม่มีปุ่มอัปโหลด/แก้/ลบ
2. ใน DevTools console ของหน้าเดียวกัน:
   ```js
   await fetch('/api/admin/files?title=x&name=x.pdf', { method: 'POST', body: new Blob(['%PDF-1.4']) }).then(r => r.status)
   ```
   Expected: `403`
3. ผู้จัดการติ๊ก "คลังไฟล์ (อัปโหลด/ลบ)" ให้สมาชิกนั้นในหน้าจัดการผู้ใช้ → รีเฟรชแล้วเห็นปุ่มจัดการ

- [ ] **Step 5: Commit การแก้ (ถ้ามี)**

```bash
git status
git add <ไฟล์ที่แก้จากการตรวจ>
git commit -m "fix(files): <สิ่งที่แก้จากการทดสอบ>"
```

---

## นอกขอบเขตของแผนนี้

- สมาชิกที่ไม่มีสิทธิ์ฟีเจอร์ใดเลยยังเห็นการ์ด "ไม่มีสิทธิ์" เมื่อเข้า `/admin` (เพราะ `firstAllowedPath` คืน null) แม้จะเปิด `/admin/files` ตรง ๆ ได้ — ถ้าต้องการให้เด้งไปคลังไฟล์ ต้องแก้ `firstAllowedPath` และเทสต์ของมัน เป็นงานแยก
- สำรองไฟล์คลัง (`backup:saraban` กวาดเฉพาะ `saraban/`)
- รายการอื่นในข้อ "นอกขอบเขต" ของสเปก
