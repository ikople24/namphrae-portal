# ปฏิทินปฏิบัติงาน (Calendar Jobs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แทนหน้า Google Calendar embed เดิมด้วยระบบปฏิทินปฏิบัติงานในพอร์ทัล — เจ้าหน้าที่กรอกฟอร์ม → แจ้ง LINE เข้ากลุ่ม → อนุมัติแล้วขึ้นปฏิทิน → ปิดงานเป็น "ดำเนินการแล้ว" โดยหน้าสาธารณะเห็นเฉพาะข้อมูลที่ไม่ใช่ PII

**Architecture:** MongoDB collection ใหม่ `calendarJobs` เป็นแหล่งข้อมูลจริง (ไม่ใช่ `portalConfig` เพราะงานโตไม่จำกัด) มี file-store fallback ให้ dev รันแบบ zero-config เหมือนเดิม · logic บริสุทธิ์แยกเป็นโมดูลของตัวเอง (`job-status`, `job-public`, `calendar-grid`, `line-message`, `line-signature`) เพื่อเทสต์ได้โดยไม่ลาก `mongodb`/network เข้ามา · การกรอง PII เกิดที่ server ผ่าน `toPublicJob()` ที่ประกอบ object ทีละฟิลด์

**Tech Stack:** Next.js 16 (Pages Router), TypeScript strict, Tailwind v4, MongoDB driver 7, Zod 4, SWR 2, Clerk, vitest (เพิ่มใหม่ — เป็น test suite ชุดแรกของโปรเจ็ก)

**Spec:** [`docs/superpowers/specs/2026-08-04-calendar-jobs-design.md`](../specs/2026-08-04-calendar-jobs-design.md)

---

## File Structure

**สร้างใหม่**

| ไฟล์ | หน้าที่ | บริสุทธิ์? |
|---|---|---|
| `src/lib/job-status.ts` | `canTransition(from, to)` | ✅ |
| `src/lib/job-public.ts` | `toPublicJob`, `toPublicJobs` | ✅ |
| `src/lib/calendar-grid.ts` | `buildMonthGrid`, `thaiMonthLabel`, `thaiShortDate`, `shiftMonth`, `todayInBangkok` | ✅ |
| `src/lib/line-message.ts` | `formatNewJobMessage` | ✅ |
| `src/lib/line-signature.ts` | `verifyLineSignature` | ✅ |
| `src/lib/jobs-store.ts` | CRUD (Mongo \| file) | I/O |
| `src/lib/line.ts` | `pushNewJobNotice`, `get/setLineGroupId` | I/O |
| `src/components/MonthGrid.tsx` | ปฏิทินเดือน ใช้ร่วม 2 หน้า — generic ไม่รู้จัก PII | — |
| `src/components/admin/JobForm.tsx` | ฟอร์มงาน | — |
| `src/pages/calendar.tsx` | หน้าสาธารณะ | — |
| `src/pages/admin/calendar/index.tsx` | คิวรออนุมัติ + ปฏิทิน + ตาราง | — |
| `src/pages/admin/calendar/new.tsx` · `[id].tsx` | ฟอร์มเพิ่ม/แก้ | — |
| `src/pages/api/calendar.ts` | GET สาธารณะ (mask แล้ว) | — |
| `src/pages/api/admin/calendar/index.ts` · `[id].ts` | CRUD หลังบ้าน | — |
| `src/pages/api/admin/line-group.ts` | PATCH groupId ด้วยมือ | — |
| `src/pages/api/line/webhook.ts` | รับ join/leave เก็บ groupId | — |
| `vitest.config.ts` | ตั้ง alias `@` | — |

**แก้ไข:** `src/types/portal.ts` · `src/lib/schema.ts` · `src/lib/config-store.ts` (⚠️ `normalise`) · `src/lib/admin-api.ts` · `src/components/admin/AdminLayout.tsx` · `src/lib/icons.ts` · `src/pages/admin/settings.tsx` · `package.json` · `.gitignore` · `.env.example` · `README.md`

> **`calendar_month` มีอยู่ใน `ICON_NAMES` แล้ว** (ใช้โดยบริการ `npdrh-calendar`) — ต้องเพิ่มเฉพาะ `check_circle`, `cancel`, `schedule`

---

## Task 1: Types + Zod schema + ปิดรูรั่ว `normalise()`

**Files:**
- Modify: `src/types/portal.ts`
- Modify: `src/lib/schema.ts`
- Modify: `src/lib/config-store.ts:159-176` (ฟังก์ชัน `normalise`)

- [ ] **Step 1: เพิ่ม types ท้ายไฟล์ `src/types/portal.ts` (ก่อนบรรทัด `export const CONFIG_ID`)**

```ts
// ── ปฏิทินปฏิบัติงาน ────────────────────────────────────────────────────────
// งานปฏิทินอยู่คนละ collection กับ PortalConfig (ดู src/lib/jobs-store.ts):
// config เป็นเอกสารก้อนเดียวที่เขียนทับทั้งก้อนทุกครั้ง ส่วนงานโตไม่จำกัด

export type JobKind = 'ems' | 'rescue'; // กู้ชีพ (รับ-ส่งผู้ป่วย) | กู้ภัย (งานป้องกัน)
export type JobStatus = 'pending' | 'approved' | 'done' | 'cancelled';

export type CalendarJob = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  date: string; // 'YYYY-MM-DD' ตามเวลาไทยตรง ๆ — ไม่แปลง UTC จึงไม่มีวันเพี้ยน
  time: string; // 'HH:mm' 24 ชม.
  title: string; // ชื่อผู้ป่วย / ชื่องาน            ← PII
  village?: string; // 'ม.3 ต.น้ำแพร่'
  origin?: string; // ต้นทาง                       ← PII
  destination?: string; // ปลายทาง                 ← PII
  phone?: string; //                               ← PII
  note?: string;
  createdAt: string;
  createdBy: string;
  decidedAt?: string; // ตอนอนุมัติ / ยกเลิก
  decidedBy?: string;
  doneAt?: string; // ตอนปิดงาน
  doneBy?: string;
};

// สิ่งที่หลุดออกสู่สาธารณะได้เท่านั้น — ดู src/lib/job-public.ts
export type PublicJob = Pick<
  CalendarJob,
  'id' | 'kind' | 'date' | 'time' | 'status'
> & { village?: string };

export const JOB_KIND_LABEL: Record<JobKind, string> = {
  ems: 'รับ-ส่งผู้ป่วย',
  rescue: 'งานป้องกัน',
};

// สีเดิมจาก legend ของปฏิทินที่ระบบนี้มาแทน
export const JOB_KIND_COLOR: Record<JobKind, string> = {
  ems: '#0b8043',
  rescue: '#d81b60',
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  done: 'ดำเนินการแล้ว',
  cancelled: 'ยกเลิก',
};
```

- [ ] **Step 2: เพิ่ม `lineGroupId` เข้า `PortalConfig` ใน `src/types/portal.ts`**

หา `export type PortalConfig` แล้วเพิ่มบรรทัดสุดท้ายก่อนปิดปีกกา:

```ts
export type PortalConfig = {
  _id?: string; // always "portalConfig"
  version: number;
  updatedAt: string; // ISO string
  updatedBy?: string; // Clerk user id / email
  visitorCount: number; // continues from the legacy counter
  site: SiteSettings;
  categories: Category[];
  links: ServiceLink[];
  // LINE group ที่บอท OA ถูกเชิญเข้าไป — เก็บที่ระดับบนสุด ไม่ใช่ใน `site`
  // เพราะ toPublicConfig() คืน `site` ทั้งก้อนสู่สาธารณะ
  lineGroupId?: string;
};
```

- [ ] **Step 3: ⚠️ เพิ่ม `lineGroupId` เข้า `normalise()` ใน `src/lib/config-store.ts`**

`normalise()` ประกอบ object ใหม่ทีละฟิลด์ ฟิลด์ที่ไม่ได้ระบุจะ**หายทุกครั้งที่อ่าน config** — ข้ามขั้นนี้แล้ว groupId ที่ webhook เก็บมาจะโดนลบทิ้งทันที

```ts
function normalise(config: PortalConfig): PortalConfig {
  return {
    _id: CONFIG_ID,
    version: config.version ?? 1,
    updatedAt: config.updatedAt ?? new Date(0).toISOString(),
    updatedBy: config.updatedBy,
    visitorCount: config.visitorCount ?? 0,
    site: config.site,
    categories: config.categories ?? [],
    lineGroupId: config.lineGroupId,
    links: (config.links ?? []).map((l) => ({
      ...l,
      clickCount: l.clickCount ?? 0,
      openInNewTab: l.openInNewTab ?? true,
      isActive: l.isActive ?? true,
      isFeatured: l.isFeatured ?? false,
    })),
  };
}
```

- [ ] **Step 4: เพิ่ม schema ท้าย `src/lib/schema.ts`**

```ts
// ── ปฏิทินปฏิบัติงาน ────────────────────────────────────────────────────────

export const jobKindSchema = z.enum(['ems', 'rescue']);
export const jobStatusSchema = z.enum([
  'pending',
  'approved',
  'done',
  'cancelled',
]);

// ฟอร์มเดียวชุดฟิลด์เดียวใช้ทั้งงานกู้ชีพและกู้ภัย — งานกู้ภัยเว้นฟิลด์ที่ไม่ใช้ว่างไว้
export const jobInputSchema = z.object({
  kind: jobKindSchema,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD'),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'เวลาต้องเป็นรูปแบบ HH:mm'),
  title: z.string().min(1, 'ต้องระบุชื่อผู้ป่วย/ชื่องาน'),
  village: z.string().optional().default(''),
  origin: z.string().optional().default(''),
  destination: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  note: z.string().optional().default(''),
});

export type JobInput = z.infer<typeof jobInputSchema>;
```

- [ ] **Step 5: เพิ่ม `lineGroupId` เข้า `portalConfigSchema` ใน `src/lib/schema.ts`**

```ts
export const portalConfigSchema = z.object({
  _id: z.string().default(CONFIG_ID),
  version: z.number().int().nonnegative(),
  updatedAt: z.string(),
  updatedBy: z.string().optional(),
  visitorCount: z.number().int().nonnegative().default(0),
  site: siteSettingsSchema,
  categories: z.array(categorySchema),
  links: z.array(serviceLinkSchema),
  lineGroupId: z.string().optional(),
});
```

- [ ] **Step 6: ตรวจว่า type ผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี output (exit 0)

- [ ] **Step 7: Commit**

```bash
git add src/types/portal.ts src/lib/schema.ts src/lib/config-store.ts
git commit -m "feat(calendar): add CalendarJob types, job schema, lineGroupId

normalise() rebuilds the config object field by field, so lineGroupId has
to be listed there or every read would silently drop it."
```

---

## Task 2: ตั้ง vitest + `job-status.ts` (TDD)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/job-status.ts`
- Test: `src/lib/job-status.test.ts`
- Modify: `package.json`

- [ ] **Step 1: ติดตั้ง vitest**

```bash
npm install -D vitest
```

Expected: `added N packages` และ `vitest` โผล่ใน `devDependencies`

- [ ] **Step 2: สร้าง `vitest.config.ts`**

`path.resolve(process.cwd(), 'src')` ใช้ได้ทั้งโหมด CJS และ ESM ต่างจาก `__dirname`/`import.meta.url` ที่ใช้ได้อย่างละโหมด — vitest รันจาก project root เสมอ

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// เทสต์ครอบเฉพาะ logic บริสุทธิ์ (ไม่มี DB/network) จึงใช้ environment 'node'
// alias ต้องตรงกับ paths ใน tsconfig.json
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
});
```

- [ ] **Step 3: เพิ่ม script ใน `package.json`**

ในบล็อก `"scripts"` เพิ่มต่อจาก `"lint"`:

```json
    "lint": "eslint",
    "test": "vitest run"
```

- [ ] **Step 4: เขียนเทสต์ที่ยังไม่ผ่าน — `src/lib/job-status.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { canTransition } from '@/lib/job-status';
import type { JobStatus } from '@/types/portal';

const ALL: JobStatus[] = ['pending', 'approved', 'done', 'cancelled'];

// คู่ที่อนุญาต — นอกจากนี้ต้องถูกปฏิเสธทั้งหมด
const ALLOWED: Array<[JobStatus, JobStatus]> = [
  ['pending', 'approved'],
  ['pending', 'cancelled'],
  ['approved', 'done'],
  ['approved', 'cancelled'],
  ['approved', 'pending'], // ถอนอนุมัติเมื่อกดพลาด
  ['done', 'approved'], // เผลอกดปิดงาน
  ['cancelled', 'pending'], // กู้งานที่ยกเลิกผิด
];

describe('canTransition', () => {
  it.each(ALLOWED)('อนุญาต %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it('ปฏิเสธคู่อื่นทั้งหมด รวมถึงเปลี่ยนเป็นสถานะเดิม', () => {
    const denied: Array<[JobStatus, JobStatus]> = [];
    for (const from of ALL) {
      for (const to of ALL) {
        const ok = ALLOWED.some(([f, t]) => f === from && t === to);
        if (!ok) denied.push([from, to]);
      }
    }
    // 4x4 = 16 คู่ทั้งหมด อนุญาต 7 จึงต้องถูกปฏิเสธ 9
    expect(denied).toHaveLength(9);
    for (const [from, to] of denied) {
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(false);
    }
  });
});
```

- [ ] **Step 5: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "@/lib/job-status"`

- [ ] **Step 6: เขียน implementation — `src/lib/job-status.ts`**

```ts
import type { JobStatus } from '@/types/portal';

// ตารางเดียวที่ตัดสินว่าเปลี่ยนสถานะไหนได้ ใช้ร่วมทั้ง API และปุ่มบนหน้าจอ
// (หน้าจอซ่อนปุ่มที่ทำไม่ได้ ส่วน API ปฏิเสธด้วย 409 ไม่ว่าอย่างไร)
//
// ที่ให้ย้อนกลับได้ เพราะงานจริงมีการกดพลาด: ถอนอนุมัติ, เปิดงานที่เผลอปิด,
// กู้งานที่ยกเลิกผิด — ไม่ใช่เพื่อความยืดหยุ่นลอย ๆ
const ALLOWED: Record<JobStatus, readonly JobStatus[]> = {
  pending: ['approved', 'cancelled'],
  approved: ['done', 'cancelled', 'pending'],
  done: ['approved'],
  cancelled: ['pending'],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED[from].includes(to);
}

// สถานะที่กดต่อได้จากสถานะปัจจุบัน — ใช้วาดปุ่มในตารางหลังบ้าน
export function nextStatuses(from: JobStatus): readonly JobStatus[] {
  return ALLOWED[from];
}
```

- [ ] **Step 7: รันเทสต์ให้ผ่าน**

Run: `npm test`
Expected: PASS — `Test Files 1 passed`, `Tests 8 passed`

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/job-status.ts src/lib/job-status.test.ts
git commit -m "feat(calendar): status transition table, with vitest as the first test setup"
```

---

## Task 3: `job-public.ts` — กันข้อมูลผู้ป่วยรั่ว (TDD)

**Files:**
- Create: `src/lib/job-public.ts`
- Test: `src/lib/job-public.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน — `src/lib/job-public.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { toPublicJob, toPublicJobs } from '@/lib/job-public';
import type { CalendarJob } from '@/types/portal';

const FULL: CalendarJob = {
  id: 'job-1',
  kind: 'ems',
  status: 'approved',
  date: '2026-08-05',
  time: '06:00',
  title: 'สมชาย ใจดี',
  village: 'ม.3 ต.น้ำแพร่',
  origin: 'บ้านที่อาศัย',
  destination: 'รพ.สวนดอก',
  phone: '0812345678',
  note: 'ใช้รถเข็น',
  createdAt: '2026-08-04T11:00:00.000Z',
  createdBy: 'staff@example.com',
  decidedAt: '2026-08-04T12:00:00.000Z',
  decidedBy: 'staff@example.com',
};

describe('toPublicJob', () => {
  it('ส่งออกเฉพาะคีย์ที่อนุญาต ไม่มีคีย์อื่นเล็ดลอด', () => {
    expect(Object.keys(toPublicJob(FULL)).sort()).toEqual([
      'date',
      'id',
      'kind',
      'status',
      'time',
      'village',
    ]);
  });

  it('ไม่มีข้อมูลส่วนบุคคลติดไปแม้แต่ฟิลด์เดียว', () => {
    const pub = toPublicJob(FULL) as Record<string, unknown>;
    for (const key of ['title', 'phone', 'origin', 'destination', 'note']) {
      expect(pub[key], key).toBeUndefined();
    }
  });

  it('ค่าที่ยอมให้ผ่านต้องตรงกับต้นฉบับ', () => {
    expect(toPublicJob(FULL)).toEqual({
      id: 'job-1',
      kind: 'ems',
      status: 'approved',
      date: '2026-08-05',
      time: '06:00',
      village: 'ม.3 ต.น้ำแพร่',
    });
  });

  it('ไม่ใส่คีย์ village เมื่อไม่มีข้อมูล', () => {
    const { village: _village, ...noVillage } = FULL;
    expect('village' in toPublicJob(noVillage)).toBe(false);
  });

  it('ค่าที่ไม่ใช่ชื่อจริงก็ยังต้องไม่หลุด — สตริงว่างก็ถือว่าไม่มี', () => {
    expect('village' in toPublicJob({ ...FULL, village: '' })).toBe(false);
  });
});

describe('toPublicJobs', () => {
  const make = (id: string, status: CalendarJob['status']): CalendarJob => ({
    ...FULL,
    id,
    status,
  });

  it('คัดเหลือเฉพาะ approved กับ done', () => {
    const out = toPublicJobs([
      make('a', 'pending'),
      make('b', 'approved'),
      make('c', 'done'),
      make('d', 'cancelled'),
    ]);
    expect(out.map((j) => j.id)).toEqual(['b', 'c']);
  });

  it('งานที่รออนุมัติไม่หลุดออกสู่สาธารณะ', () => {
    expect(toPublicJobs([make('a', 'pending')])).toEqual([]);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npm test -- job-public`
Expected: FAIL — `Failed to resolve import "@/lib/job-public"`

- [ ] **Step 3: เขียน implementation — `src/lib/job-public.ts`**

```ts
import type { CalendarJob, JobStatus, PublicJob } from '@/types/portal';

// โมดูลนี้ตั้งใจไม่ import อะไรนอกจาก type — เทสต์จึงเรียกได้ตรง ๆ โดยไม่ลาก
// mongodb เข้ามาด้วย ซึ่งจะเกิดขึ้นถ้าฟังก์ชันนี้ไปอยู่ใน jobs-store.ts

// สถานะที่ยอมให้คนทั่วไปเห็น: งานที่ยังรออนุมัติหรือถูกยกเลิกไม่ขึ้นปฏิทินสาธารณะ
export const PUBLIC_JOB_STATUSES: readonly JobStatus[] = ['approved', 'done'];

/**
 * ตัดข้อมูลส่วนบุคคลออกก่อนส่งสู่สาธารณะ
 *
 * ประกอบ object ใหม่ทีละฟิลด์โดยเจตนา — ถ้าใช้ rest-spread หรือ delete
 * ฟิลด์ PII ที่เพิ่มเข้า CalendarJob ทีหลังจะรั่วออกไปเองโดยอัตโนมัติ
 * แบบนี้การเพิ่มฟิลด์สาธารณะต้องเป็นการตัดสินใจที่ตั้งใจเสมอ
 */
export function toPublicJob(job: CalendarJob): PublicJob {
  const out: PublicJob = {
    id: job.id,
    kind: job.kind,
    date: job.date,
    time: job.time,
    status: job.status,
  };
  if (job.village) out.village = job.village;
  return out;
}

export function toPublicJobs(jobs: CalendarJob[]): PublicJob[] {
  return jobs
    .filter((job) => PUBLIC_JOB_STATUSES.includes(job.status))
    .map(toPublicJob);
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npm test`
Expected: PASS — `Test Files 2 passed`, `Tests 15 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/job-public.ts src/lib/job-public.test.ts
git commit -m "feat(calendar): mask PII for the public feed

Builds the payload field by field so a PII field added to CalendarJob
later cannot leak through a spread."
```

---

## Task 4: `calendar-grid.ts` — ตารางเดือนและวันที่ไทย (TDD)

**Files:**
- Create: `src/lib/calendar-grid.ts`
- Test: `src/lib/calendar-grid.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน — `src/lib/calendar-grid.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildMonthGrid,
  currentMonthInBangkok,
  parseMonth,
  shiftMonth,
  thaiMonthLabel,
  thaiShortDate,
  todayInBangkok,
} from '@/lib/calendar-grid';

describe('buildMonthGrid', () => {
  // ส.ค. 2026 ขึ้นต้นวันเสาร์ สัปดาห์เริ่มวันจันทร์จึงมีวันของเดือนก่อน 5 วัน
  it('เดือนที่ขึ้นต้นเสาร์ ได้ 6 สัปดาห์และเติมวันเดือนก่อนหน้า', () => {
    const weeks = buildMonthGrid(2026, 8);
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0]).toEqual({ date: '2026-07-27', inMonth: false });
    expect(weeks[0][5]).toEqual({ date: '2026-08-01', inMonth: true });
    expect(weeks[5][0]).toEqual({ date: '2026-08-31', inMonth: true });
    expect(weeks[5][1]).toEqual({ date: '2026-09-01', inMonth: false });
  });

  it('ทุกแถวมี 7 ช่องเสมอ', () => {
    for (const [y, m] of [
      [2026, 8],
      [2024, 2],
      [2026, 6],
      [2026, 12],
    ] as const) {
      for (const week of buildMonthGrid(y, m)) {
        expect(week).toHaveLength(7);
      }
    }
  });

  // มิ.ย. 2026 ขึ้นต้นวันจันทร์พอดี ไม่ต้องเติมวันข้างหน้า
  it('เดือนที่ขึ้นต้นวันจันทร์ ไม่มีวันเดือนก่อนนำหน้า', () => {
    const weeks = buildMonthGrid(2026, 6);
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toEqual({ date: '2026-06-01', inMonth: true });
  });

  it('ก.พ. ปีอธิกสุรทินมีวันที่ 29 และอยู่ในเดือน', () => {
    const cells = buildMonthGrid(2024, 2).flat();
    expect(cells.find((c) => c.date === '2024-02-29')).toEqual({
      date: '2024-02-29',
      inMonth: true,
    });
    expect(cells.some((c) => c.date === '2024-03-01' && c.inMonth)).toBe(false);
  });

  it('สัปดาห์คาบเกี่ยวข้ามปีถูกทำเครื่องหมายว่านอกเดือน', () => {
    const weeks = buildMonthGrid(2026, 12);
    expect(weeks[4][4]).toEqual({ date: '2027-01-01', inMonth: false });
  });

  it('วันที่ในแต่ละสัปดาห์เรียงต่อเนื่องไม่ข้ามไม่ซ้ำ', () => {
    const dates = buildMonthGrid(2026, 8).flat().map((c) => c.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe('thaiMonthLabel', () => {
  it('แปลงเป็นชื่อเดือนไทยและ พ.ศ.', () => {
    expect(thaiMonthLabel(2026, 8)).toBe('สิงหาคม 2569');
    expect(thaiMonthLabel(2026, 1)).toBe('มกราคม 2569');
    expect(thaiMonthLabel(2026, 12)).toBe('ธันวาคม 2569');
  });
});

describe('thaiShortDate', () => {
  it('ย่อวันที่เป็นรูปแบบที่ใช้ในข้อความ LINE', () => {
    expect(thaiShortDate('2026-08-05')).toBe('5 ส.ค. 69');
    expect(thaiShortDate('2026-12-31')).toBe('31 ธ.ค. 69');
    expect(thaiShortDate('2027-01-01')).toBe('1 ม.ค. 70');
  });
});

describe('shiftMonth', () => {
  it('เลื่อนข้ามปีได้ทั้งสองทาง', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-08', 0)).toBe('2026-08');
    expect(shiftMonth('2026-08', 5)).toBe('2027-01');
  });
});

describe('parseMonth', () => {
  it('แยกปีกับเดือนจากสตริงที่ถูกต้อง', () => {
    expect(parseMonth('2026-08')).toEqual({ year: 2026, month: 8 });
  });

  it('คืน null เมื่อรูปแบบผิด', () => {
    for (const bad of ['2026-8', '2026', 'x', '2026-13', '2026-00', '']) {
      expect(parseMonth(bad), bad).toBeNull();
    }
  });
});

describe('todayInBangkok / currentMonthInBangkok', () => {
  // ค่าขึ้นกับเวลาจริง จึงตรวจได้แค่รูปแบบ
  it('ให้รูปแบบ YYYY-MM-DD และ YYYY-MM ที่สอดคล้องกัน', () => {
    const today = todayInBangkok();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(currentMonthInBangkok()).toBe(today.slice(0, 7));
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npm test -- calendar-grid`
Expected: FAIL — `Failed to resolve import "@/lib/calendar-grid"`

- [ ] **Step 3: เขียน implementation — `src/lib/calendar-grid.ts`**

```ts
// ตารางปฏิทินและการจัดรูปแบบวันที่ไทย ทั้งหมดเป็นฟังก์ชันบริสุทธิ์ ไม่มี dependency
//
// คำนวณด้วย UTC ล้วน (Date.UTC / getUTC*) แม้จะเป็นปฏิทินไทย เพราะที่นี่ใช้ Date
// เป็นแค่เครื่องคิดเลขวันที่ ไม่ใช่เวลาจริง — การใช้ UTC ตัดปัญหา DST และ
// timezone ของเครื่องที่รันออกไปทั้งหมด ส่วนเวลาไทยจริง ๆ อยู่ในสตริง date/time

export type GridCell = { date: string; inMonth: boolean };

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

// ชื่อวันแบบสัปดาห์เริ่มวันจันทร์ ให้ตรงกับลำดับช่องใน buildMonthGrid
export const THAI_DOW = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

const MONTH_RE = /^\d{4}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * ตารางเดือนเป็นสัปดาห์ ๆ ละ 7 ช่อง เริ่มวันจันทร์ตาม wkst=1 ของปฏิทินเดิม
 * เติมวันของเดือนข้างเคียงให้เต็มแถว (inMonth: false)
 *
 * @param month 1-12
 */
export function buildMonthGrid(year: number, month: number): GridCell[][] {
  // getUTCDay(): 0=อา..6=ส → แปลงเป็นออฟเซ็ตแบบจันทร์นำ 0=จ..6=อา
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cursor = new Date(Date.UTC(year, month - 1, 1 - lead));
  const weeks: GridCell[][] = [];

  // วนต่อตราบที่ต้นสัปดาห์ถัดไปยังอยู่ในเดือนเป้าหมาย — ได้ 4-6 แถวตามจริง
  // โดยไม่ต้องฮาร์ดโค้ด 6 แถวแล้วมาตัดทีหลัง
  do {
    const week: GridCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        date: ymd(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth() + 1,
          cursor.getUTCDate()
        ),
        inMonth:
          cursor.getUTCMonth() === month - 1 &&
          cursor.getUTCFullYear() === year,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (
    cursor.getUTCMonth() === month - 1 &&
    cursor.getUTCFullYear() === year
  );

  return weeks;
}

export function thaiMonthLabel(year: number, month: number): string {
  return `${THAI_MONTHS[month - 1]} ${year + 543}`;
}

/** '2026-08-05' → '5 ส.ค. 69' (พ.ศ. สองหลักท้าย) */
export function thaiShortDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const be = (year + 543) % 100;
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${pad(be)}`;
}

/** '2026-12' + 1 → '2027-01' */
export function shiftMonth(month: string, delta: number): string {
  const parsed = parseMonth(month);
  if (!parsed) return month;
  const total = parsed.year * 12 + (parsed.month - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export function parseMonth(
  month: string
): { year: number; month: number } | null {
  if (!MONTH_RE.test(month)) return null;
  const [year, m] = month.split('-').map(Number);
  if (m < 1 || m > 12) return null;
  return { year, month: m };
}

/** วันนี้ตามเวลาไทย — 'en-CA' ให้รูปแบบ YYYY-MM-DD พอดี */
export function todayInBangkok(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function currentMonthInBangkok(): string {
  return todayInBangkok().slice(0, 7);
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npm test`
Expected: PASS — `Test Files 3 passed`, `Tests 28 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar-grid.ts src/lib/calendar-grid.test.ts
git commit -m "feat(calendar): month grid + Thai date helpers

Grid math runs in UTC on purpose: Date is only a day counter here, so
UTC sidesteps DST and the host timezone entirely. Real Thai time lives
in the date/time strings."
```

---

## Task 5: `line-message.ts` + `line-signature.ts` (TDD)

**Files:**
- Create: `src/lib/line-message.ts`, `src/lib/line-signature.ts`
- Test: `src/lib/line-message.test.ts`, `src/lib/line-signature.test.ts`

- [ ] **Step 1: เขียนเทสต์ข้อความ — `src/lib/line-message.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatNewJobMessage } from '@/lib/line-message';
import type { CalendarJob } from '@/types/portal';

const BASE: CalendarJob = {
  id: 'job-1',
  kind: 'ems',
  status: 'pending',
  date: '2026-08-05',
  time: '06:00',
  title: 'สมชาย ใจดี',
  village: 'ม.3 ต.น้ำแพร่',
  origin: 'บ้านที่อาศัย',
  destination: 'รพ.สวนดอก',
  phone: '0812345678',
  createdAt: '2026-08-04T11:00:00.000Z',
  createdBy: 'staff@example.com',
};

describe('formatNewJobMessage', () => {
  it('งานกู้ชีพที่กรอกครบ', () => {
    expect(formatNewJobMessage(BASE)).toBe(
      [
        '🔔 มีงานใหม่รออนุมัติ',
        '🚑 รับ-ส่งผู้ป่วย · 5 ส.ค. 69 เวลา 06:00',
        '👤 สมชาย ใจดี (ม.3 ต.น้ำแพร่)',
        '➤ บ้านที่อาศัย → รพ.สวนดอก',
        '☎ 0812345678',
      ].join('\n')
    );
  });

  it('งานกู้ภัยที่เว้นฟิลด์ว่าง — ไม่มีบรรทัดเปล่าและใช้ไอคอนคนละตัว', () => {
    const msg = formatNewJobMessage({
      ...BASE,
      kind: 'rescue',
      title: 'ตัดต้นไม้ล้มขวางถนน',
      origin: '',
      destination: '',
      phone: '',
    });
    expect(msg).toBe(
      [
        '🔔 มีงานใหม่รออนุมัติ',
        '🚨 งานป้องกัน · 5 ส.ค. 69 เวลา 06:00',
        '👤 ตัดต้นไม้ล้มขวางถนน (ม.3 ต.น้ำแพร่)',
      ].join('\n')
    );
    expect(msg.split('\n').every((line) => line.trim().length > 0)).toBe(true);
  });

  it('ไม่มีหมู่บ้านก็ไม่ขึ้นวงเล็บว่าง', () => {
    const msg = formatNewJobMessage({ ...BASE, village: '' });
    expect(msg).toContain('👤 สมชาย ใจดี\n');
    expect(msg).not.toContain('()');
  });

  it('ต้นทางหรือปลายทางมีอย่างเดียวก็ยังขึ้นบรรทัดเส้นทาง', () => {
    expect(formatNewJobMessage({ ...BASE, origin: '' })).toContain(
      '➤ - → รพ.สวนดอก'
    );
  });

  it('หมายเหตุขึ้นบรรทัดสุดท้ายเมื่อมี', () => {
    expect(formatNewJobMessage({ ...BASE, note: 'ใช้รถเข็น' })).toContain(
      '\n📝 ใช้รถเข็น'
    );
  });
});
```

- [ ] **Step 2: เขียนเทสต์ลายเซ็น — `src/lib/line-signature.test.ts`**

```ts
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyLineSignature } from '@/lib/line-signature';

const SECRET = 'test-channel-secret';
const BODY = JSON.stringify({ events: [] });

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64');
}

describe('verifyLineSignature', () => {
  it('ผ่านเมื่อลายเซ็นถูกต้อง', () => {
    expect(verifyLineSignature(BODY, sign(BODY), SECRET)).toBe(true);
  });

  it('ผ่านเมื่อ body มาเป็น Buffer', () => {
    expect(
      verifyLineSignature(Buffer.from(BODY, 'utf8'), sign(BODY), SECRET)
    ).toBe(true);
  });

  it('ไม่ผ่านเมื่อ body ถูกแก้แม้ตัวอักษรเดียว', () => {
    expect(verifyLineSignature(BODY + ' ', sign(BODY), SECRET)).toBe(false);
  });

  it('ไม่ผ่านเมื่อเซ็นด้วย secret คนละตัว', () => {
    expect(verifyLineSignature(BODY, sign(BODY, 'other'), SECRET)).toBe(false);
  });

  it('ไม่ผ่านเมื่อไม่มี header หรือ header ว่าง', () => {
    expect(verifyLineSignature(BODY, undefined, SECRET)).toBe(false);
    expect(verifyLineSignature(BODY, '', SECRET)).toBe(false);
  });

  it('ไม่ผ่านเมื่อความยาวลายเซ็นไม่เท่ากัน (ต้องไม่ throw)', () => {
    expect(verifyLineSignature(BODY, 'สั้นเกิน', SECRET)).toBe(false);
  });

  it('ไม่ผ่านเมื่อยังไม่ได้ตั้ง secret', () => {
    expect(verifyLineSignature(BODY, sign(BODY), '')).toBe(false);
  });
});
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npm test -- line-`
Expected: FAIL — resolve import ไม่เจอทั้ง `@/lib/line-message` และ `@/lib/line-signature`

- [ ] **Step 4: เขียน `src/lib/line-message.ts`**

```ts
import { thaiShortDate } from '@/lib/calendar-grid';
import type { CalendarJob } from '@/types/portal';

// ใช้ข้อความ text ธรรมดา ไม่ใช่ Flex — อ่านง่ายพอกันในกลุ่ม LINE แต่ไม่ต้อง
// ดูแลโครง JSON ก้อนใหญ่ และไม่พังเงียบ ๆ เมื่อสเปค Flex เปลี่ยน

const HEAD: Record<CalendarJob['kind'], string> = {
  ems: '🚑 รับ-ส่งผู้ป่วย',
  rescue: '🚨 งานป้องกัน',
};

/** ข้อความแจ้งกลุ่มเจ้าหน้าที่ตอนมีงานใหม่เข้ามารออนุมัติ */
export function formatNewJobMessage(job: CalendarJob): string {
  const lines = [
    '🔔 มีงานใหม่รออนุมัติ',
    `${HEAD[job.kind]} · ${thaiShortDate(job.date)} เวลา ${job.time}`,
    job.village ? `👤 ${job.title} (${job.village})` : `👤 ${job.title}`,
  ];

  // ฟิลด์ที่เว้นว่างถูกข้ามทั้งบรรทัด ไม่ทิ้งบรรทัดเปล่าไว้ในข้อความ
  if (job.origin || job.destination) {
    lines.push(`➤ ${job.origin || '-'} → ${job.destination || '-'}`);
  }
  if (job.phone) lines.push(`☎ ${job.phone}`);
  if (job.note) lines.push(`📝 ${job.note}`);

  return lines.join('\n');
}
```

- [ ] **Step 5: เขียน `src/lib/line-signature.ts`**

```ts
import crypto from 'node:crypto';

/**
 * ตรวจลายเซ็น webhook ของ LINE: base64(HMAC-SHA256(rawBody, channelSecret))
 * เทียบกับ header `x-line-signature`
 *
 * รับ secret เป็นพารามิเตอร์ ไม่อ่าน process.env เอง — เทสต์จึงตั้งค่าเองได้
 * และ handler เป็นที่เดียวที่ตัดสินใจเรื่อง env
 *
 * @param rawBody body ดิบก่อนถูก parse — ลายเซ็นคำนวณจาก byte จริง
 */
export function verifyLineSignature(
  rawBody: Buffer | string,
  header: string | undefined,
  secret: string
): boolean {
  if (!header || !secret) return false;

  const expected = Buffer.from(
    crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  );
  const received = Buffer.from(header);

  // timingSafeEqual โยน error ถ้าความยาวไม่เท่ากัน จึงต้องกันไว้ก่อน
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}
```

- [ ] **Step 6: รันเทสต์ให้ผ่าน**

Run: `npm test`
Expected: PASS — `Test Files 5 passed`, `Tests 40 passed`

- [ ] **Step 7: Commit**

```bash
git add src/lib/line-message.ts src/lib/line-signature.ts src/lib/line-message.test.ts src/lib/line-signature.test.ts
git commit -m "feat(calendar): LINE message format + webhook signature check

Both kept free of env and I/O so they are testable on their own; the
route decides what the secret is."
```

---

## Task 6: `jobs-store.ts` — CRUD สองแบ็กเอนด์

**Files:**
- Create: `src/lib/jobs-store.ts`
- Modify: `.gitignore`

- [ ] **Step 1: เพิ่มไฟล์ข้อมูล dev เข้า `.gitignore`**

หาบรรทัด `/data/portal-config.json` (บรรทัด 39) แล้วเพิ่มต่อท้าย:

```
# The committed seed lives at data/portal-config.seed.json.
/data/portal-config.json
# ปฏิทินปฏิบัติงานเริ่มจากศูนย์ ไม่มี seed — ไฟล์นี้คือ dev fallback ของ Mongo
/data/calendar-jobs.json
```

- [ ] **Step 2: เขียน `src/lib/jobs-store.ts`**

```ts
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { getDb, isMongoConfigured } from '@/lib/mongodb';
import type { JobInput } from '@/lib/schema';
import type { CalendarJob, JobStatus } from '@/types/portal';

// งานปฏิทินอยู่คนละที่กับ PortalConfig โดยตั้งใจ: config เป็นเอกสารก้อนเดียวที่
// ทุก mutation เขียนทับทั้งก้อนแล้ว bump version ส่วนงานโตไม่จำกัดและแก้บ่อย
// ถ้ายัดรวมจะชนเพดาน 16MB ของ Mongo document และทำ version พุ่งโดยเปล่าประโยชน์
//
// แบ็กเอนด์เหมือน config-store: Mongo เมื่อมี MONGODB_URI ไม่งั้นใช้ไฟล์ในเครื่อง
// (Vercel/Railway filesystem เป็น read-only ตอน runtime — production ต้องใช้ Mongo)

const COLLECTION = 'calendarJobs';
const DATA_DIR = path.join(process.cwd(), 'data');
const RUNTIME_FILE = path.join(DATA_DIR, 'calendar-jobs.json');

export type JobFilter = { month?: string; status?: JobStatus };

function usingMongo(): boolean {
  return isMongoConfigured();
}

// ---- file backend ----------------------------------------------------------

async function fileRead(): Promise<CalendarJob[]> {
  try {
    return JSON.parse(await fs.readFile(RUNTIME_FILE, 'utf8')) as CalendarJob[];
  } catch {
    return []; // ยังไม่เคยมีงาน — ต่างจาก config ตรงที่ไม่มี seed
  }
}

async function fileWrite(jobs: CalendarJob[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(RUNTIME_FILE, JSON.stringify(jobs, null, 2) + '\n', 'utf8');
}

function matches(job: CalendarJob, filter: JobFilter): boolean {
  if (filter.status && job.status !== filter.status) return false;
  if (filter.month && !job.date.startsWith(filter.month)) return false;
  return true;
}

function bySchedule(a: CalendarJob, b: CalendarJob): number {
  return a.date === b.date
    ? a.time.localeCompare(b.time)
    : a.date.localeCompare(b.date);
}

// ---- mongo backend ---------------------------------------------------------

let indexesEnsured = false;

// createIndex เป็น no-op เมื่อ index มีอยู่แล้ว จึงเรียกครั้งเดียวต่อ process
// ก็พอ (serverless cold start ใหม่ก็เรียกใหม่ ราคาถูกกว่าการมี migration แยก)
async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    const db = await getDb();
    await db.collection(COLLECTION).createIndexes([
      { key: { date: 1 } },
      { key: { status: 1, date: 1 } },
      { key: { id: 1 }, unique: true },
    ]);
  } catch (err) {
    indexesEnsured = false; // ให้ลองใหม่ครั้งหน้า
    console.warn('calendarJobs: createIndexes failed', err);
  }
}

// ---- public API ------------------------------------------------------------

export async function listJobs(filter: JobFilter = {}): Promise<CalendarJob[]> {
  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;
    // เทียบสตริงได้ตรง ๆ เพราะ date เป็น 'YYYY-MM-DD' — ใช้ -31 เป็นขอบบนได้เสมอ
    // โดยไม่ต้องรู้ว่าเดือนนั้นมีกี่วัน
    if (filter.month) {
      query.date = { $gte: `${filter.month}-01`, $lte: `${filter.month}-31` };
    }
    return db
      .collection<CalendarJob>(COLLECTION)
      .find(query, { projection: { _id: 0 } })
      .sort({ date: 1, time: 1 })
      .toArray();
  }
  return (await fileRead()).filter((j) => matches(j, filter)).sort(bySchedule);
}

export async function getJob(id: string): Promise<CalendarJob | null> {
  if (usingMongo()) {
    const db = await getDb();
    return db
      .collection<CalendarJob>(COLLECTION)
      .findOne({ id }, { projection: { _id: 0 } });
  }
  return (await fileRead()).find((j) => j.id === id) ?? null;
}

export async function createJob(
  input: JobInput,
  createdBy: string
): Promise<CalendarJob> {
  const job: CalendarJob = {
    id: crypto.randomUUID(),
    kind: input.kind,
    status: 'pending', // งานใหม่รออนุมัติเสมอ ไม่ว่าใครกรอก
    date: input.date,
    time: input.time,
    title: input.title,
    ...(input.village ? { village: input.village } : {}),
    ...(input.origin ? { origin: input.origin } : {}),
    ...(input.destination ? { destination: input.destination } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.note ? { note: input.note } : {}),
    createdAt: new Date().toISOString(),
    createdBy,
  };

  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    // spread เพื่อไม่ให้ driver แปะ _id ลงบน object ที่เรากำลังจะคืนกลับไป
    await db.collection<CalendarJob>(COLLECTION).insertOne({ ...job });
  } else {
    const jobs = await fileRead();
    jobs.push(job);
    await fileWrite(jobs);
  }
  return job;
}

async function patchJob(
  id: string,
  patch: Partial<CalendarJob>
): Promise<CalendarJob | null> {
  if (usingMongo()) {
    const db = await getDb();
    const updated = await db
      .collection<CalendarJob>(COLLECTION)
      .findOneAndUpdate(
        { id },
        { $set: patch },
        { returnDocument: 'after', projection: { _id: 0 } }
      );
    return updated ?? null;
  }
  const jobs = await fileRead();
  const index = jobs.findIndex((j) => j.id === id);
  if (index === -1) return null;
  jobs[index] = { ...jobs[index], ...patch };
  await fileWrite(jobs);
  return jobs[index];
}

/** แก้เนื้อหางาน — ไม่แตะสถานะและไม่แตะ audit trail */
export async function updateJob(
  id: string,
  input: JobInput
): Promise<CalendarJob | null> {
  return patchJob(id, {
    kind: input.kind,
    date: input.date,
    time: input.time,
    title: input.title,
    village: input.village,
    origin: input.origin,
    destination: input.destination,
    phone: input.phone,
    note: input.note,
  });
}

/**
 * เปลี่ยนสถานะพร้อมประทับว่าใครทำเมื่อไร
 * ผู้เรียกต้องตรวจ canTransition() มาก่อน — ที่นี่ไม่ตัดสินใจแทน
 */
export async function setJobStatus(
  id: string,
  next: JobStatus,
  actor: string
): Promise<CalendarJob | null> {
  const now = new Date().toISOString();
  const patch: Partial<CalendarJob> = { status: next };
  if (next === 'approved' || next === 'cancelled') {
    patch.decidedAt = now;
    patch.decidedBy = actor;
  }
  if (next === 'done') {
    patch.doneAt = now;
    patch.doneBy = actor;
  }
  return patchJob(id, patch);
}

export async function deleteJob(id: string): Promise<boolean> {
  if (usingMongo()) {
    const db = await getDb();
    const res = await db.collection<CalendarJob>(COLLECTION).deleteOne({ id });
    return res.deletedCount > 0;
  }
  const jobs = await fileRead();
  const remaining = jobs.filter((j) => j.id !== id);
  if (remaining.length === jobs.length) return false;
  await fileWrite(remaining);
  return true;
}
```

- [ ] **Step 3: ตรวจ type และ lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: ไม่มี output ทั้งคู่

- [ ] **Step 4: Commit**

```bash
git add src/lib/jobs-store.ts .gitignore
git commit -m "feat(calendar): calendarJobs store with Mongo and file backends

Its own collection rather than a slot in portalConfig: that document is
rewritten whole on every mutation, and jobs grow without bound."
```

---

## Task 7: `line.ts` — ยิงข้อความและจำ groupId

**Files:**
- Create: `src/lib/line.ts`

- [ ] **Step 1: เขียน `src/lib/line.ts`**

```ts
import { getConfig, mutateConfig } from '@/lib/config-store';
import { formatNewJobMessage } from '@/lib/line-message';
import type { CalendarJob } from '@/types/portal';

// ฝั่ง I/O ของ LINE — แยกจาก line-message.ts / line-signature.ts เพราะไฟล์นี้
// import config-store ซึ่งลาก mongodb ตามมา ทำให้เทสต์ตรง ๆ ไม่ได้
//
// LINE Notify ปิดบริการไปแล้ว (31 มี.ค. 2025) จึงใช้ Messaging API อย่างเดียว

const PUSH_URL = 'https://api.line.me/v2/bot/message/push';

export function isLineConfigured(): boolean {
  return Boolean(
    process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET
  );
}

/** กลุ่มที่บอทถูกเชิญเข้าไป — webhook เป็นคนเก็บค่านี้ให้ตอน event `join` */
export async function getLineGroupId(): Promise<string | undefined> {
  return (await getConfig()).lineGroupId || undefined;
}

export async function setLineGroupId(
  groupId: string | undefined,
  actor: string
): Promise<void> {
  await mutateConfig((draft) => {
    draft.lineGroupId = groupId;
  }, actor);
}

/**
 * แจ้งกลุ่มเจ้าหน้าที่ว่ามีงานใหม่ — best effort ไม่โยน error ออกไป
 *
 * งานถูกบันทึกลงฐานข้อมูลไปแล้วก่อนถึงบรรทัดนี้ LINE ล่มจึงต้องไม่ทำให้คำขอ
 * ล้มเหลวและงานหาย ผู้เรียกเอาค่าที่คืนไปบอกผู้ใช้ว่าส่งแจ้งเตือนไม่สำเร็จ
 *
 * @returns true เมื่อข้อความออกไปจริง
 */
export async function pushNewJobNotice(job: CalendarJob): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn('LINE push ข้าม: ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN');
    return false;
  }

  let to: string | undefined;
  try {
    to = await getLineGroupId();
  } catch (err) {
    console.warn('LINE push ข้าม: อ่าน config ไม่ได้', err);
    return false;
  }
  if (!to) {
    console.warn('LINE push ข้าม: ยังไม่มี groupId — เชิญบอท OA เข้ากลุ่มก่อน');
    return false;
  }

  try {
    const res = await fetch(PUSH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text: formatNewJobMessage(job) }],
      }),
    });
    if (!res.ok) {
      console.warn(`LINE push ล้มเหลว: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('LINE push ล้มเหลว', err);
    return false;
  }
}
```

- [ ] **Step 2: ตรวจ type และ lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: ไม่มี output ทั้งคู่

- [ ] **Step 3: Commit**

```bash
git add src/lib/line.ts
git commit -m "feat(calendar): push new-job notices to the LINE group

Never throws: the job is already saved by the time this runs, so a LINE
outage must not fail the request. Callers surface the boolean instead."
```

---

## Task 8: API หลังบ้าน — list / create / patch / delete

**Files:**
- Create: `src/pages/api/admin/calendar/index.ts`
- Create: `src/pages/api/admin/calendar/[id].ts`
- Modify: `src/lib/admin-api.ts`

- [ ] **Step 1: เขียน `src/pages/api/admin/calendar/index.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { createJob, listJobs } from '@/lib/jobs-store';
import { pushNewJobNotice } from '@/lib/line';
import { jobInputSchema, jobStatusSchema } from '@/lib/schema';
import type { JobStatus } from '@/types/portal';

const MONTH_RE = /^\d{4}-\d{2}$/;

// GET  /api/admin/calendar?month=YYYY-MM&status=pending — ข้อมูลเต็ม ทุกสถานะ
// POST /api/admin/calendar                              — สร้างงานใหม่ + แจ้ง LINE
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    // month ไม่บังคับ: หน้าหลังบ้านเรียกแบบไม่ใส่ month พร้อม status=pending
    // เพื่อดูคิวรออนุมัติทั้งหมด ไม่ใช่เฉพาะเดือนที่กำลังเปิดดู
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    if (month !== undefined && !MONTH_RE.test(month)) {
      return res.status(400).json({ error: 'invalid_month' });
    }

    let status: JobStatus | undefined;
    if (typeof req.query.status === 'string') {
      const parsed = jobStatusSchema.safeParse(req.query.status);
      if (!parsed.success) return res.status(400).json({ error: 'invalid_status' });
      status = parsed.data;
    }

    try {
      const jobs = await listJobs({ month, status });
      return res.status(200).json({ month: month ?? null, jobs });
    } catch (err) {
      console.error('GET /api/admin/calendar failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (req.method === 'POST') {
    const parsed = jobInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_job', issues: parsed.error.issues });
    }

    const job = await createJob(parsed.data, admin.email ?? admin.userId);
    // บันทึกก่อน แจ้งทีหลัง และไม่ให้ผลของ LINE ย้อนกลับมาทำให้งานหาย
    const lineNotified = await pushNewJobNotice(job);
    return res.status(201).json({ job, lineNotified });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
```

- [ ] **Step 2: เขียน `src/pages/api/admin/calendar/[id].ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { canTransition } from '@/lib/job-status';
import { deleteJob, getJob, setJobStatus, updateJob } from '@/lib/jobs-store';
import { jobInputSchema, jobStatusSchema } from '@/lib/schema';

// PATCH  /api/admin/calendar/[id]  body { patch?: JobInput, status?: JobStatus }
// DELETE /api/admin/calendar/[id]
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method === 'DELETE') {
    const removed = await deleteJob(id);
    return removed
      ? res.status(204).end()
      : res.status(404).json({ error: 'not_found' });
  }

  if (req.method === 'PATCH') {
    const current = await getJob(id);
    if (!current) return res.status(404).json({ error: 'not_found' });

    const body = (req.body ?? {}) as { patch?: unknown; status?: unknown };
    if (body.patch === undefined && body.status === undefined) {
      return res.status(400).json({ error: 'empty_patch' });
    }

    // ตรวจการเปลี่ยนสถานะให้จบก่อนแตะข้อมูล — transition ที่ไม่ถูกต้องต้อง
    // ไม่ทิ้งการแก้ไขบางส่วนไว้เบื้องหลัง
    let nextStatus: ReturnType<typeof jobStatusSchema.parse> | undefined;
    if (body.status !== undefined) {
      const parsed = jobStatusSchema.safeParse(body.status);
      if (!parsed.success) return res.status(400).json({ error: 'invalid_status' });
      if (!canTransition(current.status, parsed.data)) {
        return res.status(409).json({
          error: 'invalid_transition',
          from: current.status,
          to: parsed.data,
        });
      }
      nextStatus = parsed.data;
    }

    if (body.patch !== undefined) {
      const parsed = jobInputSchema.safeParse(body.patch);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: 'invalid_job', issues: parsed.error.issues });
      }
      await updateJob(id, parsed.data);
    }

    if (nextStatus) {
      const updated = await setJobStatus(
        id,
        nextStatus,
        admin.email ?? admin.userId
      );
      return res.status(200).json(updated);
    }
    return res.status(200).json(await getJob(id));
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
```

- [ ] **Step 3: เพิ่ม client wrappers ท้าย `src/lib/admin-api.ts`**

```ts
// ── ปฏิทินปฏิบัติงาน ────────────────────────────────────────────────────────

import type { CalendarJob, JobStatus } from '@/types/portal';
import type { JobInput } from '@/lib/schema';

export type JobListResponse = { month: string | null; jobs: CalendarJob[] };

/** สร้าง query string ของหน้าปฏิทินหลังบ้าน — ไม่ใส่คีย์ที่ไม่มีค่า */
export function adminCalendarKey(params: {
  month?: string;
  status?: JobStatus;
}): string {
  const qs = new URLSearchParams();
  if (params.month) qs.set('month', params.month);
  if (params.status) qs.set('status', params.status);
  const query = qs.toString();
  return `/api/admin/calendar${query ? `?${query}` : ''}`;
}

export async function createJob(
  input: JobInput
): Promise<{ job: CalendarJob; lineNotified: boolean }> {
  return jsonOrThrow(
    await fetch('/api/admin/calendar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  );
}

export async function updateJob(
  id: string,
  patch: JobInput
): Promise<CalendarJob> {
  return jsonOrThrow(
    await fetch(`/api/admin/calendar/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patch }),
    })
  );
}

export async function setJobStatus(
  id: string,
  status: JobStatus
): Promise<CalendarJob> {
  return jsonOrThrow(
    await fetch(`/api/admin/calendar/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  );
}

export async function deleteJob(id: string): Promise<void> {
  return jsonOrThrow(
    await fetch(`/api/admin/calendar/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  );
}

export async function updateLineGroupId(lineGroupId: string): Promise<void> {
  return jsonOrThrow(
    await fetch('/api/admin/line-group', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lineGroupId }),
    })
  );
}
```

> ย้าย `import type { CalendarJob, JobStatus }` ขึ้นไปรวมกับ import เดิมด้านบนไฟล์ (บรรทัด 1-7) แทนการ import กลางไฟล์ — ไม่งั้น eslint จะร้อง

- [ ] **Step 4: ตรวจ type และ lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: ไม่มี output ทั้งคู่

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/admin/calendar src/lib/admin-api.ts
git commit -m "feat(calendar): admin CRUD API for jobs

An invalid status transition is rejected before any field edit is
written, so a 409 never leaves the job half-updated."
```

---

## Task 9: API สาธารณะ — `/api/calendar`

**Files:**
- Create: `src/pages/api/calendar.ts`

- [ ] **Step 1: เขียน `src/pages/api/calendar.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { currentMonthInBangkok } from '@/lib/calendar-grid';
import { toPublicJobs } from '@/lib/job-public';
import { listJobs } from '@/lib/jobs-store';
import { clientIp, rateLimit } from '@/lib/rate-limit';

const MONTH_RE = /^\d{4}-\d{2}$/;

// GET /api/calendar?month=YYYY-MM — ปฏิทินสาธารณะ
//
// เส้นทางนี้ไม่มี auth จึงต้องผ่าน toPublicJobs() เสมอ: มันคัดเหลือเฉพาะงานที่
// อนุมัติแล้วและตัดชื่อ/เบอร์/ต้นทาง/ปลายทางทิ้ง การกรองเกิดที่นี่ ไม่ใช่ที่ client
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!rateLimit(`calendar:${clientIp(req)}`, 60, 60_000)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const month =
    typeof req.query.month === 'string' ? req.query.month : currentMonthInBangkok();
  if (!MONTH_RE.test(month)) {
    return res.status(400).json({ error: 'invalid_month' });
  }

  try {
    const jobs = await listJobs({ month });
    return res.status(200).json({ month, jobs: toPublicJobs(jobs) });
  } catch (err) {
    console.error('GET /api/calendar failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
```

- [ ] **Step 2: ตรวจ type และ lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: ไม่มี output ทั้งคู่

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/calendar.ts
git commit -m "feat(calendar): public month feed, masked server-side"
```

---

## Task 10: LINE webhook + แก้ groupId ด้วยมือ

**Files:**
- Create: `src/pages/api/line/webhook.ts`
- Create: `src/pages/api/admin/line-group.ts`

- [ ] **Step 1: เขียน `src/pages/api/line/webhook.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyLineSignature } from '@/lib/line-signature';
import { getLineGroupId, setLineGroupId } from '@/lib/line';

// ลายเซ็นคำนวณจาก byte ดิบของ body — ถ้าปล่อยให้ Next parse ก่อน จะตรวจไม่ผ่าน
export const config = { api: { bodyParser: false } };

type LineEvent = {
  type: string;
  source?: { type?: string; groupId?: string };
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// POST /api/line/webhook
//
// หน้าที่เดียวคือจำว่าบอทอยู่กลุ่มไหน เจ้าหน้าที่จึงไม่ต้องไปหา groupId เอง:
// เชิญบอท OA เข้ากลุ่ม → LINE ส่ง event `join` มาที่นี่ → เก็บลง config
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    console.warn('LINE webhook ถูกเรียกแต่ยังไม่ได้ตั้ง LINE_CHANNEL_SECRET');
    return res.status(503).end();
  }

  const raw = await readRawBody(req);
  const signature = req.headers['x-line-signature'];
  if (
    !verifyLineSignature(
      raw,
      typeof signature === 'string' ? signature : undefined,
      secret
    )
  ) {
    return res.status(401).end();
  }

  let body: { events?: LineEvent[] };
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).end();
  }

  // ปุ่ม Verify ในคอนโซล LINE ส่ง events ว่างมา — ต้องตอบ 200 ให้ผ่าน
  for (const event of body.events ?? []) {
    const groupId =
      event.source?.type === 'group' ? event.source.groupId : undefined;
    if (!groupId) continue;

    try {
      if (event.type === 'join') {
        await setLineGroupId(groupId, 'line-webhook');
        console.log(`LINE webhook: เข้ากลุ่ม ${groupId} — ตั้งเป็นปลายทางแจ้งเตือน`);
      } else if (event.type === 'leave') {
        if ((await getLineGroupId()) === groupId) {
          await setLineGroupId(undefined, 'line-webhook');
          console.log(`LINE webhook: ออกจากกลุ่ม ${groupId} — ล้างปลายทางแล้ว`);
        }
      }
    } catch (err) {
      // ตอบ 200 ต่อไป ไม่งั้น LINE จะ retry ซ้ำ ๆ ด้วย event เดิม
      console.error('LINE webhook: บันทึก groupId ไม่สำเร็จ', err);
    }
  }

  return res.status(200).end();
}
```

- [ ] **Step 2: เขียน `src/pages/api/admin/line-group.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { setLineGroupId } from '@/lib/line';

// PATCH /api/admin/line-group  body { lineGroupId: string }
//
// ปกติ webhook เก็บให้เองตอนบอทถูกเชิญเข้ากลุ่ม เส้นทางนี้ไว้กรอกเองเมื่อ
// webhook ยังไม่ได้ตั้ง หรือต้องย้ายไปกลุ่มอื่นโดยไม่เชิญบอทใหม่
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const value = (req.body as { lineGroupId?: unknown })?.lineGroupId;
  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'invalid_group_id' });
  }

  const trimmed = value.trim();
  await setLineGroupId(trimmed || undefined, admin.email ?? admin.userId);
  return res.status(200).json({ lineGroupId: trimmed || null });
}
```

- [ ] **Step 3: ตรวจ type และ lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: ไม่มี output ทั้งคู่

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/line src/pages/api/admin/line-group.ts
git commit -m "feat(calendar): LINE webhook captures the group id on join

Saves staff from digging the group id out of a webhook log; the manual
PATCH route stays as a fallback."
```

---

## Task 11: `MonthGrid.tsx` — ปฏิทินที่ไม่รู้จัก PII

**Files:**
- Create: `src/components/MonthGrid.tsx`

- [ ] **Step 1: เขียน `src/components/MonthGrid.tsx`**

```tsx
import {
  THAI_DOW,
  buildMonthGrid,
  shiftMonth,
  thaiMonthLabel,
  todayInBangkok,
} from '@/lib/calendar-grid';
import Icon from '@/components/Icon';
import {
  JOB_KIND_COLOR,
  JOB_KIND_LABEL,
  type JobKind,
  type JobStatus,
} from '@/types/portal';

// ส่วนของงานที่ปฏิทินต้องใช้จริง — ไม่มีฟิลด์ PII อยู่ในสัญญานี้เลย component
// จึงเผลอแสดงชื่อผู้ป่วยไม่ได้แม้หน้าหลังบ้านจะส่ง CalendarJob เต็ม ๆ เข้ามา
// ข้อความบนช่องมาจาก renderLabel ที่แต่ละหน้าตัดสินใจเอง
export type CalendarEntry = {
  id: string;
  kind: JobKind;
  date: string;
  time: string;
  status: JobStatus;
};

export default function MonthGrid<T extends CalendarEntry>({
  month,
  jobs,
  renderLabel,
  onMonthChange,
  onSelect,
}: {
  month: string; // 'YYYY-MM'
  jobs: T[];
  renderLabel: (job: T) => string;
  onMonthChange: (month: string) => void;
  onSelect?: (job: T) => void;
}) {
  const [year, monthNo] = month.split('-').map(Number);
  const weeks = buildMonthGrid(year, monthNo);
  const today = todayInBangkok();

  const byDate = new Map<string, T[]>();
  for (const job of jobs) {
    const list = byDate.get(job.date);
    if (list) list.push(job);
    else byDate.set(job.date, [job]);
  }

  return (
    <div className="rounded-2xl border border-black/[0.07] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.07] px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            aria-label="เดือนก่อนหน้า"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition hover:bg-black/[0.04]"
          >
            <Icon name="chevron_left" size={20} />
          </button>
          <p className="min-w-[9.5rem] text-center font-display text-[15px] font-semibold text-ink">
            {thaiMonthLabel(year, monthNo)}
          </p>
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            aria-label="เดือนถัดไป"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition hover:bg-black/[0.04]"
          >
            <Icon name="chevron_right" size={20} />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(today.slice(0, 7))}
            className="ml-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-ink-faint transition hover:bg-black/[0.04]"
          >
            วันนี้
          </button>
        </div>

        <div className="flex items-center gap-4 text-[12px] text-ink-soft">
          {(Object.keys(JOB_KIND_LABEL) as JobKind[]).map((kind) => (
            <span key={kind} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: JOB_KIND_COLOR[kind] }}
              />
              {JOB_KIND_LABEL[kind]}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-black/[0.07]">
        {THAI_DOW.map((dow) => (
          <div
            key={dow}
            className="px-2 py-2 text-center text-[11.5px] font-medium text-ink-faint"
          >
            {dow}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((cell) => {
          const entries = byDate.get(cell.date) ?? [];
          return (
            <div
              key={cell.date}
              className={`min-h-[86px] border-b border-r border-black/[0.05] p-1.5 last:border-r-0 ${
                cell.inMonth ? '' : 'bg-black/[0.015]'
              }`}
            >
              <div
                className={`mb-1 text-[11.5px] ${
                  cell.date === today
                    ? 'inline-grid h-5 w-5 place-items-center rounded-full bg-green font-semibold text-white'
                    : cell.inMonth
                      ? 'text-ink-soft'
                      : 'text-ink-faint/50'
                }`}
              >
                {Number(cell.date.slice(8))}
              </div>

              <div className="flex flex-col gap-0.5">
                {entries.map((job) => {
                  const label = `${job.time} ${renderLabel(job)}`;
                  const body = (
                    <>
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: JOB_KIND_COLOR[job.kind] }}
                      />
                      <span className="truncate">{label}</span>
                    </>
                  );
                  const cls = `flex items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight ${
                    job.status === 'done'
                      ? 'text-ink-faint line-through'
                      : 'text-ink-soft'
                  }`;

                  return onSelect ? (
                    <button
                      key={job.id}
                      type="button"
                      title={label}
                      onClick={() => onSelect(job)}
                      className={`${cls} transition hover:bg-black/[0.04]`}
                    >
                      {body}
                    </button>
                  ) : (
                    <span key={job.id} title={label} className={cls}>
                      {body}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: เพิ่มไอคอนที่ยังไม่มีใน `src/lib/icons.ts`**

`calendar_month` มีอยู่แล้ว (บริการ `npdrh-calendar` ใช้อยู่) และ `chevron_right` ก็มีแล้ว — ขาดอยู่ 2 ตัว

เพิ่ม `'chevron_left'` (ปุ่มเดือนก่อนหน้าใน MonthGrid) ก่อน `'chevron_right'`:

```ts
  'chat',
  'chevron_left',
  'chevron_right',
  'compost',
```

แล้วเพิ่ม `'schedule'` (หัวข้อคิวรออนุมัติใน Task 13) ระหว่าง `'public'` กับ `'search'`:

```ts
  'public',
  'schedule',
  'search',
```

> ฟอนต์เป็น subset ตาม `ICON_NAMES` — ไอคอนที่ไม่ได้ลงทะเบียนจะขึ้นเป็นข้อความ ligature แทนรูป

- [ ] **Step 3: ตรวจ type และ lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: ไม่มี output ทั้งคู่

- [ ] **Step 4: Commit**

```bash
git add src/components/MonthGrid.tsx src/lib/icons.ts
git commit -m "feat(calendar): shared month grid

Typed against a PII-free entry shape, so the component cannot render a
patient name even when the admin page hands it full job records."
```

---

## Task 12: `JobForm.tsx` + หน้าเพิ่ม/แก้งาน

**Files:**
- Create: `src/components/admin/JobForm.tsx`
- Create: `src/pages/admin/calendar/new.tsx`
- Create: `src/pages/admin/calendar/[id].tsx`

- [ ] **Step 1: เขียน `src/components/admin/JobForm.tsx`**

```tsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import { createJob, updateJob } from '@/lib/admin-api';
import { jobInputSchema, type JobInput } from '@/lib/schema';
import { todayInBangkok } from '@/lib/calendar-grid';
import { JOB_KIND_COLOR, JOB_KIND_LABEL, type JobKind } from '@/types/portal';

const EMPTY: JobInput = {
  kind: 'ems',
  date: '',
  time: '',
  title: '',
  village: '',
  origin: '',
  destination: '',
  phone: '',
  note: '',
};

export default function JobForm({
  mode,
  jobId,
  initial,
}: {
  mode: 'new' | 'edit';
  jobId?: string;
  initial?: JobInput;
}) {
  const router = useRouter();
  const [form, setForm] = useState<JobInput>({
    ...EMPTY,
    date: todayInBangkok(),
    ...initial,
  });
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof JobInput>(key: K, value: JobInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);

    const parsed = jobInputSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'new') {
        const { lineNotified } = await createJob(parsed.data);
        if (!lineNotified) {
          // งานถูกบันทึกแล้ว บอกตรง ๆ ว่าอะไรสำเร็จอะไรไม่สำเร็จ
          setWarning('บันทึกงานแล้ว แต่ส่งแจ้งเตือน LINE ไม่สำเร็จ');
          setSaving(false);
          return;
        }
      } else if (jobId) {
        await updateJob(jobId, parsed.data);
      }
      router.push('/admin/calendar');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      {error ? (
        <p className="mb-4 rounded-xl border border-red-300/60 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
          {warning}{' '}
          <button
            type="button"
            onClick={() => router.push('/admin/calendar')}
            className="font-semibold underline"
          >
            ไปหน้ารายการ
          </button>
        </p>
      ) : null}

      <fieldset className="mb-4">
        <legend className="mb-1.5 block font-display text-[13px] font-medium text-ink-soft">
          ประเภทงาน
        </legend>
        <div className="flex gap-2">
          {(Object.keys(JOB_KIND_LABEL) as JobKind[]).map((kind) => (
            <label
              key={kind}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] transition ${
                form.kind === kind
                  ? 'border-green bg-green-050 font-medium text-green-deep'
                  : 'border-black/[0.12] text-ink-soft hover:bg-black/[0.03]'
              }`}
            >
              <input
                type="radio"
                name="kind"
                className="sr-only"
                checked={form.kind === kind}
                onChange={() => set('kind', kind)}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: JOB_KIND_COLOR[kind] }}
              />
              {JOB_KIND_LABEL[kind]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Field label="วันที่ *">
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="เวลา *">
          <input
            type="time"
            required
            value={form.time}
            onChange={(e) => set('time', e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>

      <div className="mb-4">
        <Field label={form.kind === 'ems' ? 'ชื่อผู้ป่วย *' : 'ชื่องาน *'}>
          <input
            required
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={
              form.kind === 'ems' ? 'สมชาย ใจดี' : 'ตัดต้นไม้ล้มขวางถนน'
            }
            className={INPUT}
          />
        </Field>
      </div>

      <div className="mb-4">
        <Field label="หมู่บ้าน / พื้นที่">
          <input
            value={form.village}
            onChange={(e) => set('village', e.target.value)}
            placeholder="ม.3 ต.น้ำแพร่"
            className={INPUT}
          />
          <p className="mt-1 text-[11.5px] text-ink-faint">
            ช่องนี้แสดงบนปฏิทินสาธารณะ — ช่องอื่นที่เหลือเห็นเฉพาะเจ้าหน้าที่
          </p>
        </Field>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Field label="ต้นทาง">
          <input
            value={form.origin}
            onChange={(e) => set('origin', e.target.value)}
            placeholder="บ้านที่อาศัย"
            className={INPUT}
          />
        </Field>
        <Field label="ปลายทาง">
          <input
            value={form.destination}
            onChange={(e) => set('destination', e.target.value)}
            placeholder="รพ.สวนดอก"
            className={INPUT}
          />
        </Field>
      </div>

      <div className="mb-4">
        <Field label="เบอร์โทรติดต่อ">
          <input
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="0812345678"
            className={INPUT}
          />
        </Field>
      </div>

      <div className="mb-6">
        <Field label="หมายเหตุ">
          <textarea
            rows={3}
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-green px-5 py-2.5 font-display text-[14px] font-semibold text-white transition hover:bg-green-deep disabled:opacity-50"
      >
        {saving ? 'กำลังบันทึก…' : mode === 'new' ? 'บันทึกและแจ้งกลุ่ม' : 'บันทึกการแก้ไข'}
      </button>
    </form>
  );
}

const INPUT =
  'w-full rounded-xl border border-black/[0.12] px-3.5 py-2.5 text-[14px] text-ink outline-none transition focus:border-green';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-display text-[13px] font-medium text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}
```

- [ ] **Step 2: เขียน `src/pages/admin/calendar/new.tsx`**

```tsx
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import JobForm from '@/components/admin/JobForm';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getMemberSsrProps } from '@/lib/auth-server';

function NewJobPage() {
  return (
    <AdminLayout title="เพิ่มงานปฏิบัติงาน">
      <Link
        href="/admin/calendar"
        className="mb-4 inline-block text-sm text-ink-soft hover:text-ink"
      >
        ← กลับไปหน้าปฏิทิน
      </Link>
      <JobForm mode="new" />
    </AdminLayout>
  );
}

export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(NewJobPage);
```

- [ ] **Step 3: เขียน `src/pages/admin/calendar/[id].tsx`**

```tsx
import Link from 'next/link';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import JobForm from '@/components/admin/JobForm';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getMemberSsrProps } from '@/lib/auth-server';
import { adminFetcher } from '@/lib/admin-api';
import type { JobInput } from '@/lib/schema';
import type { CalendarJob } from '@/types/portal';

// CalendarJob -> JobInput ที่ฟอร์มใช้ได้ (ตัดฟิลด์ที่ server เป็นเจ้าของ และ
// เติมค่าว่างให้ optional field เพื่อให้ตรงกับ shape ที่ input ต้องการ)
function toJobInput(job: CalendarJob): JobInput {
  return {
    kind: job.kind,
    date: job.date,
    time: job.time,
    title: job.title,
    village: job.village ?? '',
    origin: job.origin ?? '',
    destination: job.destination ?? '',
    phone: job.phone ?? '',
    note: job.note ?? '',
  };
}

function EditJobPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { data, error, isLoading } = useSWR<{ jobs: CalendarJob[] }>(
    id ? '/api/admin/calendar' : null,
    adminFetcher
  );
  const job = data?.jobs.find((j) => j.id === id);

  return (
    <AdminLayout title="แก้ไขงานปฏิบัติงาน">
      <Link
        href="/admin/calendar"
        className="mb-4 inline-block text-sm text-ink-soft hover:text-ink"
      >
        ← กลับไปหน้าปฏิทิน
      </Link>
      {error ? (
        <p className="text-red-700">โหลดข้อมูลไม่สำเร็จ</p>
      ) : isLoading || !data ? (
        <p className="text-ink-soft">กำลังโหลด…</p>
      ) : !job ? (
        <p className="text-ink-soft">ไม่พบงานนี้</p>
      ) : (
        <JobForm mode="edit" jobId={job.id} initial={toJobInput(job)} />
      )}
    </AdminLayout>
  );
}

export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(EditJobPage);
```

- [ ] **Step 4: ตรวจ type และ lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: ไม่มี output ทั้งคู่

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/JobForm.tsx src/pages/admin/calendar/new.tsx "src/pages/admin/calendar/[id].tsx"
git commit -m "feat(calendar): job form and add/edit pages

Says which single field reaches the public calendar, right next to it."
```

---

## Task 13: หน้าหลังบ้าน `/admin/calendar` + เมนู

**Files:**
- Create: `src/pages/admin/calendar/index.tsx`
- Modify: `src/components/admin/AdminLayout.tsx:9-14`

- [ ] **Step 1: เพิ่มเมนูใน `src/components/admin/AdminLayout.tsx`**

```ts
const NAV = [
  { href: '/admin', label: 'ลิงก์บริการ', icon: 'link', exact: true },
  { href: '/admin/calendar', label: 'ปฏิทินปฏิบัติงาน', icon: 'calendar_month', exact: false },
  { href: '/admin/categories', label: 'หมวดหมู่', icon: 'category', exact: false },
  { href: '/admin/settings', label: 'ตั้งค่าเว็บไซต์', icon: 'tune', exact: false },
  { href: '/admin/data', label: 'นำเข้า/ส่งออก', icon: 'swap_vert', exact: false },
];
```

- [ ] **Step 2: เขียน `src/pages/admin/calendar/index.tsx`**

```tsx
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import MonthGrid from '@/components/MonthGrid';
import Icon from '@/components/Icon';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getMemberSsrProps } from '@/lib/auth-server';
import {
  adminCalendarKey,
  adminFetcher,
  deleteJob,
  setJobStatus,
  type JobListResponse,
} from '@/lib/admin-api';
import { currentMonthInBangkok, thaiShortDate } from '@/lib/calendar-grid';
import { nextStatuses } from '@/lib/job-status';
import {
  JOB_KIND_COLOR,
  JOB_KIND_LABEL,
  JOB_STATUS_LABEL,
  type CalendarJob,
  type JobStatus,
} from '@/types/portal';

const STATUS_STYLE: Record<JobStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-050 text-green-deep',
  done: 'bg-black/[0.06] text-ink-faint',
  cancelled: 'bg-red-100 text-red-800',
};

const ACTION_LABEL: Record<JobStatus, string> = {
  pending: 'ถอนอนุมัติ',
  approved: 'อนุมัติ',
  done: 'ปิดงาน',
  cancelled: 'ยกเลิก',
};

function AdminCalendarPage() {
  const [month, setMonth] = useState(currentMonthInBangkok());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // สองคำขอแยกกันโดยตั้งใจ: ปฏิทินดูทีละเดือน แต่คิวรออนุมัติต้องเห็นทุกงาน
  // ไม่งั้นงานที่ขอไว้เดือนหน้าจะหายไปจากสายตาจนกว่าจะเลื่อนเดือนไปเจอ
  const monthQuery = useSWR<JobListResponse>(
    adminCalendarKey({ month }),
    adminFetcher
  );
  const pendingQuery = useSWR<JobListResponse>(
    adminCalendarKey({ status: 'pending' }),
    adminFetcher
  );

  const jobs = monthQuery.data?.jobs ?? [];
  const pending = pendingQuery.data?.jobs ?? [];

  async function refresh() {
    await Promise.all([monthQuery.mutate(), pendingQuery.mutate()]);
  }

  async function changeStatus(job: CalendarJob, next: JobStatus) {
    setBusy(job.id);
    setMsg(null);
    try {
      await setJobStatus(job.id, next);
      await refresh();
      setMsg(`${job.title}: ${JOB_STATUS_LABEL[next]}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'เปลี่ยนสถานะไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  }

  async function remove(job: CalendarJob) {
    if (!confirm(`ลบงาน "${job.title}" ถาวร?`)) return;
    setBusy(job.id);
    setMsg(null);
    try {
      await deleteJob(job.id);
      await refresh();
      setMsg('ลบงานแล้ว');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminLayout
      title="ปฏิทินปฏิบัติงาน"
      actions={
        <Link
          href="/admin/calendar/new"
          className="flex items-center gap-1.5 rounded-xl bg-green px-4 py-2 font-display text-[13.5px] font-semibold text-white transition hover:bg-green-deep"
        >
          <Icon name="add" size={19} />
          เพิ่มงาน
        </Link>
      }
    >
      {msg ? (
        <p className="mb-4 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-[13px] text-ink-soft">
          {msg}
        </p>
      ) : null}

      <section className="mb-6">
        <h2 className="mb-2 flex items-center gap-1.5 font-display text-[15px] font-semibold text-ink">
          <Icon name="schedule" size={19} />
          รออนุมัติ
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-medium text-amber-800">
            {pending.length}
          </span>
        </h2>
        {pendingQuery.isLoading ? (
          <p className="text-[13px] text-ink-soft">กำลังโหลด…</p>
        ) : pending.length === 0 ? (
          <p className="text-[13px] text-ink-faint">ไม่มีงานรออนุมัติ</p>
        ) : (
          <JobTable
            jobs={pending}
            busy={busy}
            onStatus={changeStatus}
            onDelete={remove}
          />
        )}
      </section>

      <section className="mb-6">
        <MonthGrid
          month={month}
          jobs={jobs.filter((j) => j.status !== 'cancelled')}
          onMonthChange={setMonth}
          renderLabel={(job) => job.title}
        />
      </section>

      <section>
        <h2 className="mb-2 font-display text-[15px] font-semibold text-ink">
          งานทั้งหมดในเดือนนี้
        </h2>
        {monthQuery.isLoading ? (
          <p className="text-[13px] text-ink-soft">กำลังโหลด…</p>
        ) : jobs.length === 0 ? (
          <p className="text-[13px] text-ink-faint">ยังไม่มีงานในเดือนนี้</p>
        ) : (
          <JobTable
            jobs={jobs}
            busy={busy}
            onStatus={changeStatus}
            onDelete={remove}
          />
        )}
      </section>
    </AdminLayout>
  );
}

function JobTable({
  jobs,
  busy,
  onStatus,
  onDelete,
}: {
  jobs: CalendarJob[];
  busy: string | null;
  onStatus: (job: CalendarJob, next: JobStatus) => void;
  onDelete: (job: CalendarJob) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/[0.07] bg-white">
      <table className="w-full min-w-[760px] text-left text-[13px]">
        <thead className="border-b border-black/[0.07] text-[12px] text-ink-faint">
          <tr>
            <th className="px-3 py-2.5 font-medium">วันเวลา</th>
            <th className="px-3 py-2.5 font-medium">งาน</th>
            <th className="px-3 py-2.5 font-medium">เส้นทาง</th>
            <th className="px-3 py-2.5 font-medium">สถานะ</th>
            <th className="px-3 py-2.5 text-right font-medium">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b border-black/[0.05] last:border-b-0">
              <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">
                {thaiShortDate(job.date)} {job.time}
              </td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: JOB_KIND_COLOR[job.kind] }}
                    title={JOB_KIND_LABEL[job.kind]}
                  />
                  {job.title}
                </span>
                {job.village || job.phone ? (
                  <span className="mt-0.5 block text-[11.5px] text-ink-faint">
                    {[job.village, job.phone].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2.5 text-ink-soft">
                {job.origin || job.destination
                  ? `${job.origin || '-'} → ${job.destination || '-'}`
                  : '—'}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${STATUS_STYLE[job.status]}`}
                >
                  {JOB_STATUS_LABEL[job.status]}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {nextStatuses(job.status).map((next) => (
                    <button
                      key={next}
                      type="button"
                      disabled={busy === job.id}
                      onClick={() => onStatus(job, next)}
                      className="rounded-lg border border-black/[0.12] px-2.5 py-1 text-[12px] text-ink-soft transition hover:bg-black/[0.04] disabled:opacity-40"
                    >
                      {ACTION_LABEL[next]}
                    </button>
                  ))}
                  <Link
                    href={`/admin/calendar/${job.id}`}
                    className="grid h-7 w-7 place-items-center rounded-lg text-ink-faint transition hover:bg-black/[0.04]"
                    aria-label="แก้ไข"
                  >
                    <Icon name="edit" size={17} />
                  </Link>
                  <button
                    type="button"
                    disabled={busy === job.id}
                    onClick={() => onDelete(job)}
                    aria-label="ลบ"
                    className="grid h-7 w-7 place-items-center rounded-lg text-ink-faint transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                  >
                    <Icon name="delete" size={17} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(AdminCalendarPage);
```

- [ ] **Step 3: ตรวจ type และ lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: ไม่มี output ทั้งคู่

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/calendar/index.tsx src/components/admin/AdminLayout.tsx
git commit -m "feat(calendar): admin calendar page with an approval queue

The queue is its own unfiltered request: a job booked for next month
would otherwise sit unseen until someone paged forward to it.

Action buttons come from nextStatuses(), so the UI and the API's 409
rule can't drift apart."
```

---

## Task 14: หน้าสาธารณะ `/calendar`

**Files:**
- Create: `src/pages/calendar.tsx`

- [ ] **Step 1: เขียน `src/pages/calendar.tsx`**

```tsx
import { useState } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import MonthGrid from '@/components/MonthGrid';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import { currentMonthInBangkok } from '@/lib/calendar-grid';
import { getConfig, toPublicConfig } from '@/lib/config-store';
import { JOB_KIND_LABEL, type PublicConfig, type PublicJob } from '@/types/portal';

type Feed = { month: string; jobs: PublicJob[] };

const fetcher = (url: string): Promise<Feed> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`โหลดปฏิทินไม่สำเร็จ (${r.status})`);
    return r.json();
  });

// ข้อมูลถูก mask แล้วจึงไม่มีค่าทาง SEO — ดึงฝั่ง client ตรง ๆ ได้ ไม่ต้องทำ ISR
// ให้ครบทุกเดือน และเปลี่ยนเดือนได้ทันทีโดยไม่ต้อง pre-render ล่วงหน้า
export default function CalendarPage({ config }: { config: PublicConfig }) {
  const [month, setMonth] = useState(currentMonthInBangkok());
  const { data, error, isLoading } = useSWR<Feed>(
    `/api/calendar?month=${month}`,
    fetcher,
    { keepPreviousData: true }
  );

  return (
    <>
      <Head>
        <title>{`ปฏิทินปฏิบัติงาน · ${config.site.orgName}`}</title>
        <meta
          name="description"
          content="ตารางงานกู้ชีพและงานป้องกันของเทศบาลตำบลน้ำแพร่พัฒนา"
        />
      </Head>

      <SiteHeader site={config.site} />

      <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-11">
        <h1 className="font-display text-[22px] font-bold text-ink">
          ปฏิทินปฏิบัติงาน
        </h1>
        <p className="mb-5 mt-1 text-[13.5px] text-ink-soft">
          ตารางงาน{JOB_KIND_LABEL.ems}และ{JOB_KIND_LABEL.rescue}ที่ได้รับอนุมัติแล้ว
          — แสดงเฉพาะเวลา ประเภทงาน และพื้นที่ ไม่เปิดเผยข้อมูลส่วนบุคคลของผู้รับบริการ
        </p>

        {error ? (
          <p className="rounded-xl border border-red-300/60 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">
            {error instanceof Error ? error.message : 'โหลดปฏิทินไม่สำเร็จ'}
          </p>
        ) : (
          <>
            <MonthGrid
              month={month}
              jobs={data?.jobs ?? []}
              onMonthChange={setMonth}
              renderLabel={(job) => JOB_KIND_LABEL[job.kind]}
            />
            {isLoading && !data ? (
              <p className="mt-3 text-[13px] text-ink-soft">กำลังโหลด…</p>
            ) : null}
          </>
        )}
      </main>

      <Footer site={config.site} />
    </>
  );
}

// หน้าเปลือกเป็น static ส่วนงานในปฏิทินมาทีหลังจาก /api/calendar
export async function getStaticProps() {
  return {
    props: { config: toPublicConfig(await getConfig()) },
    revalidate: 60,
  };
}
```

- [ ] **Step 2: ตรวจ props ที่ `SiteHeader` และ `Footer` รับจริง**

Run: `grep -n "export default function" -A 6 src/components/SiteHeader.tsx src/components/Footer.tsx`
Expected: เห็น signature ของทั้งสอง — ถ้า prop ไม่ใช่ `site` ให้แก้การเรียกใน Step 1 ให้ตรง (เช่นบางตัวอาจรับ `config` ทั้งก้อน)

- [ ] **Step 3: ตรวจ type, lint และ build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: ไม่มี error · ใน route list ต้องเห็น `/calendar`, `/api/calendar`, `/admin/calendar`

- [ ] **Step 4: Commit**

```bash
git add src/pages/calendar.tsx
git commit -m "feat(calendar): public calendar page

Renders the kind label, never the title — the page has no access to a
patient name because the API never sends one."
```

---

## Task 15: ช่อง LINE group ในหน้าตั้งค่า + เอกสาร

**Files:**
- Modify: `src/pages/admin/settings.tsx`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: เพิ่มส่วน LINE ในหน้า `/admin/settings`**

ใน `SettingsForm` เพิ่ม state และ handler ต่อจาก `const [saving, setSaving] = useState(false);`

```tsx
  const [lineGroupId, setLineGroupId] = useState(initialLineGroupId ?? '');
  const [lineMsg, setLineMsg] = useState<string | null>(null);

  async function onSaveLineGroup() {
    setLineMsg(null);
    try {
      await updateLineGroupId(lineGroupId.trim());
      setLineMsg('บันทึกกลุ่ม LINE แล้ว');
    } catch (err) {
      setLineMsg(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    }
  }
```

เพิ่ม prop `initialLineGroupId` เข้า signature ของ `SettingsForm` และส่งค่า `data.lineGroupId` มาจาก `SettingsPage` แล้วเพิ่ม section ท้ายฟอร์ม (ก่อนปุ่มบันทึกรวม):

```tsx
        <section className="mb-6">
          <h2 className="mb-2 font-display text-[15px] font-semibold text-ink">
            แจ้งเตือน LINE
          </h2>
          <p className="mb-3 text-[12.5px] text-ink-soft">
            ปกติช่องนี้ถูกกรอกให้อัตโนมัติเมื่อเชิญบอท OA เข้ากลุ่มเจ้าหน้าที่
            (ต้องตั้ง Webhook URL เป็น <code>/api/line/webhook</code> ในคอนโซล LINE)
            กรอกเองเมื่อต้องการย้ายกลุ่มโดยไม่เชิญบอทใหม่
          </p>
          <Field label="LINE group id">
            <input
              value={lineGroupId}
              onChange={(e) => setLineGroupId(e.target.value)}
              placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-xl border border-black/[0.12] px-3.5 py-2.5 text-[14px] text-ink outline-none transition focus:border-green"
            />
          </Field>
          <button
            type="button"
            onClick={onSaveLineGroup}
            className="mt-2 rounded-xl border border-black/[0.12] px-4 py-2 font-display text-[13px] font-medium text-ink-soft transition hover:bg-black/[0.04]"
          >
            บันทึกกลุ่ม LINE
          </button>
          {lineMsg ? (
            <p className="mt-2 text-[12.5px] text-ink-soft">{lineMsg}</p>
          ) : null}
        </section>
```

เพิ่ม `updateLineGroupId` เข้า import จาก `@/lib/admin-api` ที่บรรทัด 7

- [ ] **Step 2: เพิ่ม env ท้าย `.env.example`**

```bash
# LINE Messaging API — แจ้งเตือนกลุ่มเจ้าหน้าที่เมื่อมีงานปฏิทินใหม่เข้ามา
# ถ้าไม่ตั้ง ระบบยังใช้งานได้ปกติ เพียงแต่ไม่ส่งแจ้งเตือน (ขึ้น warning ใน log)
# LINE Notify ปิดบริการแล้ว (31 มี.ค. 2025) จึงต้องใช้ Messaging API เท่านั้น
#
# วิธีตั้ง: สร้าง Messaging API channel ใน LINE Developers Console → คัดลอก
# ค่าสองตัวนี้มา → ตั้ง Webhook URL เป็น https://<โดเมน>/api/line/webhook
# → เชิญบอท OA เข้ากลุ่มเจ้าหน้าที่ (ระบบจะจำ groupId ให้เองตอนบอทเข้ากลุ่ม)
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
```

- [ ] **Step 3: เพิ่มหัวข้อใน `README.md`**

ใส่ก่อนหัวข้อ `## Scripts`:

```markdown
## ปฏิทินปฏิบัติงาน

แทนหน้า Google Calendar embed เดิม — เจ้าหน้าที่กรอกฟอร์มที่ `/admin/calendar/new`
→ ระบบแจ้งกลุ่ม LINE ทันที → เจ้าหน้าที่คนใดก็ได้กดอนุมัติให้ขึ้นปฏิทิน → ปิดงาน
เป็น "ดำเนินการแล้ว" เมื่อทำเสร็จ

| หน้า | ใคร | เห็นอะไร |
|---|---|---|
| `/calendar` | ทุกคน | เวลา + ประเภทงาน + หมู่บ้าน เท่านั้น |
| `/admin/calendar` | เจ้าหน้าที่ | ครบทุกฟิลด์ + คิวรออนุมัติ + ปุ่มเปลี่ยนสถานะ |

**ข้อมูลส่วนบุคคล:** ชื่อผู้รับบริการ เบอร์โทร ต้นทาง-ปลายทาง ไม่ออกจาก API
สาธารณะเลย — `toPublicJob()` ใน `src/lib/job-public.ts` ประกอบ payload ทีละฟิลด์
และมีเทสต์ยืนยันว่าไม่มีฟิลด์อื่นเล็ดลอด งานที่ยังรออนุมัติหรือถูกยกเลิกก็ไม่ขึ้นปฏิทินสาธารณะ

**เก็บที่ไหน:** collection `calendarJobs` แยกจาก `portalConfig` (มี file fallback
`data/calendar-jobs.json` สำหรับ dev เหมือน config) — เอกสาร config ถูกเขียนทับทั้งก้อน
ทุก mutation ส่วนงานปฏิทินโตไม่จำกัด จึงต้องแยก

**ตั้งค่า LINE:** ดู `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` ใน
`.env.example` — ถ้าไม่ตั้ง ระบบยังใช้งานได้ครบ เพียงแต่ไม่ส่งแจ้งเตือน
```

แก้บรรทัด Scripts ให้มี `npm test` ด้วย:

```bash
npm run dev     # dev server
npm run build   # production build
npm run start   # รัน production build
npm run seed    # seed Mongo จาก seed.json
npm run lint    # eslint
npm test        # vitest (logic บริสุทธิ์: PII masking, สถานะ, ปฏิทิน, LINE)
```

- [ ] **Step 4: ตรวจครบทุกอย่าง**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: เทสต์ผ่านทั้งหมด · ไม่มี type error · ไม่มี lint error · build สำเร็จ

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/settings.tsx .env.example README.md
git commit -m "feat(calendar): LINE group field in settings, docs"
```

---

## Verification

รันทั้งหมดนี้ก่อนถือว่าเสร็จ — และ**ต้องเห็นผลจริงก่อนพูดว่าผ่าน**:

```bash
npm test                 # เทสต์ 5 ไฟล์ผ่านทั้งหมด
npx tsc --noEmit         # ไม่มี type error
npm run lint             # ไม่มี lint error
npm run build            # build สำเร็จ เห็น /calendar และ /admin/calendar ใน route list
```

ทดสอบด้วยมือแบบ zero-config (ไม่ต้องมี Mongo/Clerk/LINE — `npm run dev`):

1. `/admin/calendar/new` → กรอกงานกู้ชีพ → บันทึก → ขึ้นเตือนว่าส่ง LINE ไม่สำเร็จ (ถูกต้อง เพราะยังไม่ตั้ง env) และงานถูกบันทึกแล้ว
2. `/admin/calendar` → งานอยู่ในคิว "รออนุมัติ" → กด **อนุมัติ** → ป้ายเปลี่ยนเป็น "อนุมัติแล้ว" และงานโผล่บนปฏิทิน
3. `/calendar` → เห็นงานเป็น `06:00 รับ-ส่งผู้ป่วย` **ไม่มีชื่อคน**
4. `curl -s 'http://localhost:3000/api/calendar?month=<เดือนของงาน>' | grep -c 'สมชาย'` → ต้องได้ **0**
5. กด **ปิดงาน** → ขึ้น "ดำเนินการแล้ว" และแสดงจางบนปฏิทิน
6. สร้างงานใหม่แล้วกด **ยกเลิก** → หายจากปฏิทินทั้งสองหน้า แต่ยังอยู่ในตาราง
7. `curl -s -X PATCH localhost:3000/api/admin/calendar/<id> -H 'content-type: application/json' -d '{"status":"done"}'` บนงานที่สถานะ `pending` → ต้องได้ **409 invalid_transition**
