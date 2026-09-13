# แผนลงมือรอบ 1A — ชั้นข้อมูลระบบสารบรรณ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** วางชั้นข้อมูลของระบบสารบรรณ — ชนิดข้อมูล ตรรกะบริสุทธิ์ (ปีงบ เลขทะเบียน สถานะ ตัวกรอง
การแก้ไข ไฟล์แนบ) schema สิทธิ์ `saraban` และ store สองตัว — ให้ API ของรอบ 1B เรียกใช้ได้ทันที

**Architecture:** ทุกอย่างที่ "ตัดสิน" อะไรได้เป็นฟังก์ชันบริสุทธิ์ในไฟล์ที่ไม่ import อะไรฝั่งเซิร์ฟเวอร์
(หน้าจอรอบ 1C ใช้ไฟล์เดียวกันวาดป้ายและปุ่ม) store บาง ๆ แค่อ่าน/เขียน Mongo | ไฟล์ตามแพทเทิร์น
`jobs-store.ts` ยกเว้นเรื่องเดียวที่ตั้งใจต่าง: unique index ที่กันเลขซ้ำต้องสร้างสำเร็จก่อนออกเลข
ไม่งั้นล้มดัง ๆ

**Tech Stack:** TypeScript (strict) · MongoDB driver 7 · zod 4 · Vitest 3 · tsx

**สเปก:** [2026-09-13-saraban-design.md](../specs/2026-09-13-saraban-design.md) — รอบ 1A ครอบ
ข้อ 3 (โมเดล) ข้อ 4 (เลขทะเบียน) ส่วนตรวจไฟล์ของข้อ 5 และเทสต์ของข้อ 8 · API/Cloudinary/proxy
อยู่ในรอบ 1B · หน้าจออยู่ในรอบ 1C

---

## โครงไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/types/saraban.ts` | ชนิดข้อมูล + อาเรย์ `as const` ที่เป็นแหล่งความจริงของ union |
| `src/lib/saraban-number.ts` | ปีงบ · วันที่กรุงเทพฯ · เลขถัดไป · รูปแบบเลข · ประกอบ "ที่" — บริสุทธิ์ |
| `src/lib/saraban-labels.ts` | ป้ายภาษาไทยของคีย์ทั้งหมด — บริสุทธิ์ |
| `src/lib/saraban-doc.ts` | สร้างหนังสือ · event · เกินกำหนด · ตัวกรอง (ไฟล์ + Mongo) · กฎแก้ไข/ยกเลิก/ส่งแล้ว — บริสุทธิ์ |
| `src/lib/saraban-attachment.ts` | ตรวจไฟล์แนบจากข้อมูลที่ Cloudinary คืนมา — บริสุทธิ์ |
| `src/lib/saraban-schema.ts` | zod ของทุกคำขอในรอบ 1 |
| `src/lib/saraban-file.ts` | แบ็กเอนด์ไฟล์ของสารบรรณ (dev fallback) ใช้ร่วมสอง store |
| `src/lib/saraban-units-store.ts` | สมุดผู้รับ `sarabanUnits` + auto-seed |
| `src/lib/saraban-store.ts` | หนังสือ `sarabanDocs` + เลขเริ่มต้น `sarabanYears` |
| `data/saraban-units.seed.json` | สมุดตั้งต้น 14 รายการ (commit) |
| `src/lib/user-access.ts` | **แก้** — คีย์สิทธิ์ `saraban` |
| `.gitignore` | **แก้** — ไฟล์ runtime ของแบ็กเอนด์ไฟล์ |

ไฟล์เทสต์วางข้างซอร์สใน `src/lib/` เท่านั้น — **ห้ามวางใต้ `src/pages/**`** (Pages Router จะทำให้
กลายเป็น route จริง ดู `vitest.config.ts`)

## ข้อตกลงของรอบนี้

- baseline ก่อนเริ่ม: `npm test` ผ่าน **28 ไฟล์ 368 เทสต์** · `npx tsc --noEmit -p .` ไม่มี error
- เทสต์เดิมทั้งหมดต้องผ่านโดยไม่แก้ ยกเว้น `src/lib/user-access.test.ts` (เพิ่มเทสต์ได้)
- คอมเมนต์ในโค้ดเป็นภาษาไทย อธิบาย "ทำไม" แบบเดียวกับไฟล์ข้างเคียง
- commit message ภาษาไทยรูปแบบ `feat(saraban): …`
- ไฟล์ใน `src/lib/saraban-{number,labels,doc,attachment,schema}.ts` **ห้าม import** `mongodb`,
  `cloudinary`, `fs`, `node:*` — หน้าจอรอบ 1C import ไฟล์เหล่านี้ตรง ๆ

---

## Task 1: `types/saraban.ts` — ชนิดข้อมูล

**Files:**
- Create: `src/types/saraban.ts`

- [ ] **Step 1: สร้างไฟล์ชนิดข้อมูล**

```ts
// src/types/saraban.ts
// ชนิดข้อมูลของระบบสารบรรณ — ดู docs/superpowers/specs/2026-09-13-saraban-design.md ข้อ 3
//
// อาเรย์ `as const` เป็นแหล่งความจริงเดียวของ union แต่ละตัว (แนวเดียวกับ JOB_STATUSES
// ใน portal.ts) — ที่ใดต้องเช็คค่าตอนรัน (z.enum ใน saraban-schema.ts, ปุ่มกรองใน
// saraban-doc.ts) ให้สร้างจากอาเรย์เหล่านี้ ไม่พิมพ์รายการซ้ำเอง
//
// คีย์เป็นภาษาอังกฤษ ป้ายภาษาไทยอยู่ใน saraban-labels.ts — ป้ายสถานะของหนังสือส่งต่างจาก
// หนังสือรับ (รอส่ง/ส่งแล้ว vs ดำเนินการ/เสร็จสิ้น) คีย์เดียวจึงมีสองป้าย

export const SARABAN_REGISTERS = ['in', 'out', 'circular'] as const; // รับ | ส่ง | เวียน
export type SarabanRegister = (typeof SARABAN_REGISTERS)[number];

export const SARABAN_LEVELS = ['normal', 'urgent', 'very-urgent', 'most-urgent'] as const;
export type SarabanLevel = (typeof SARABAN_LEVELS)[number];

export const SARABAN_STATUSES = ['pending', 'in-progress', 'done', 'void'] as const;
export type SarabanStatus = (typeof SARABAN_STATUSES)[number];

// สถานะที่แสดงบนจอ — "เกินกำหนด" คำนวณจาก dueDate ไม่ได้เก็บ (สเปกข้อ 3)
// ปุ่มกรองของทะเบียน (REGISTER_VIEWS ใน saraban-doc.ts) สร้างจากอาเรย์นี้ เพิ่มสถานะ
// ใหม่ใน SARABAN_STATUSES แล้วปุ่มกรองกับ schema ของ query ตามมาเอง
export const DISPLAY_STATUSES = [...SARABAN_STATUSES, 'overdue'] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

export const SEND_METHODS = ['system', 'post', 'hand'] as const; // ระบบ | ไปรษณีย์ | นำส่งเอง
export type SendMethod = (typeof SEND_METHODS)[number];

export const SARABAN_FILE_FORMATS = ['pdf', 'jpg', 'png'] as const;
export type SarabanFileFormat = (typeof SARABAN_FILE_FORMATS)[number];

// ชนิด resource ของ Cloudinary ที่รับ — PDF อัปเป็น image (ได้จำนวนหน้า) ถอยไป raw ได้
// ถ้าบัญชีส่ง PDF แบบ image ไม่ได้ (สเปกข้อ 12)
export const SARABAN_RESOURCE_TYPES = ['image', 'raw'] as const;
export type SarabanResourceType = (typeof SARABAN_RESOURCE_TYPES)[number];

export const SARABAN_EVENT_KINDS = [
  'received', // ลงรับ
  'issued', // ออกเลขส่ง/เวียน
  'edited',
  'file-added',
  'file-removed',
  'sent',
  'voided',
] as const;
export type SarabanEventKind = (typeof SARABAN_EVENT_KINDS)[number];

export type SarabanFile = {
  id: string; // uuid — ใช้ใน URL แทน publicId ที่มี '/'
  publicId: string;
  resourceType: SarabanResourceType;
  name: string; // ชื่อไฟล์เดิมจากเครื่องผู้ใช้
  format: SarabanFileFormat;
  bytes: number; // อ่านจาก Cloudinary ไม่ใช่จาก client
  pages: number; // อ่านจาก Cloudinary · รูปภาพ = 1 · 0 = ไม่รู้ (PDF ที่อัปแบบ raw)
  uploadedAt: string; // ISO
  uploadedBy: string; // clerkId หรือ 'dev-open'
};

export type SarabanFieldChange = { field: string; from: string; to: string };

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
};

export type SarabanDoc = {
  id: string; // uuid ที่ client สร้าง — เป็น idempotency key ของการออกเลขด้วย
  register: SarabanRegister;
  fiscalYear: number; // ปีงบ พ.ศ. ของวันที่ลงรับ/ออกเลข (ไม่ใช่ของ docDate)
  no: number; // ต่อ (register, fiscalYear) — เริ่มที่ 1 หรือที่เลขเริ่มต้นที่ตั้งไว้
  ref: string; // ที่หนังสือ — รับ: พิมพ์เอง · ส่ง/เวียน: composeRef()
  docDate: string; // ลงวันที่ 'YYYY-MM-DD' ปี ค.ศ. (ต่างจาก fiscalYear ที่เป็น พ.ศ.)
  party: string; // รับ: จาก · ส่ง/เวียน: ถึง
  subject: string;
  level: SarabanLevel;
  dueDate: string; // 'YYYY-MM-DD' ปี ค.ศ. · '' = ไม่กำหนด · ส่ง/เวียนเป็น '' เสมอ
  holderUnitId: string; // รับ: อยู่กับตำแหน่งไหน · ส่ง/เวียน: ส่วนราชการเจ้าของเรื่อง
  status: SarabanStatus;
  sendMethod: SendMethod | ''; // '' จนกว่าจะบันทึกว่าส่งแล้ว
  voidReason: string; // '' ถ้าไม่ได้ยกเลิก
  files: SarabanFile[];
  events: SarabanEvent[];
  registeredAt: string; // ISO
  registeredBy: string; // clerkId หรือ 'dev-open' — ค่าเดียวกับ by ของ event แรก
  updatedAt: string; // ISO — เป็นเวอร์ชันกันการเขียนทับกันด้วย (ดู applyPatch)
};

export type SarabanUnit = {
  id: string; // seed: slug อ่านง่าย · สร้างจากหน้าเว็บ: uuid
  name: string;
  dept: string;
  refCode: string; // 'ชม 55201' — '' = ออกหนังสือส่งไม่ได้
  order: number;
  isActive: boolean; // ปิดแทนการลบ — หนังสืออ้าง id อยู่
  memberClerkIds: string[]; // เริ่มใช้ในรอบ 3
};

// เลขเริ่มต้นของ (ทะเบียน, ปีงบ) — Mongo เก็บด้วย _id = `${register}-${fiscalYear}`
export type SarabanYear = {
  register: SarabanRegister;
  fiscalYear: number; // พ.ศ.
  startNo: number;
  setAt: string; // ISO
  setBy: string; // clerkId หรือ 'dev-open'
};
```

- [ ] **Step 2: ตรวจชนิด**

Run: `npx tsc --noEmit -p .`
Expected: ไม่มี output, exit 0

- [ ] **Step 3: Commit**

```bash
git add src/types/saraban.ts
git commit -m "feat(saraban): ชนิดข้อมูลของหนังสือ สมุดผู้รับ และเลขเริ่มต้น"
```

---

## Task 2: `saraban-number.ts` — ปีงบและเลขทะเบียน

สเปกข้อ 4 · ขอบปีงบอยู่ใน `fiscalYearOf` ที่เดียว · วันที่ต้องคิดตามเวลากรุงเทพฯ ไม่ใช่ UTC

**Files:**
- Create: `src/lib/saraban-number.ts`
- Test: `src/lib/saraban-number.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
// src/lib/saraban-number.test.ts
import { describe, expect, it } from 'vitest';
import {
  bangkokDateOf,
  composeRef,
  fiscalYearOf,
  formatNo,
  nextNo,
} from '@/lib/saraban-number';

describe('fiscalYearOf — ปีงบเริ่ม 1 ต.ค.', () => {
  it('30 ก.ย. ยังเป็นปีงบเดิม', () => {
    expect(fiscalYearOf('2026-09-30')).toBe(2569);
  });

  it('1 ต.ค. ขึ้นปีงบใหม่', () => {
    expect(fiscalYearOf('2026-10-01')).toBe(2570);
  });

  it('ต้นปีปฏิทินอยู่ในปีงบที่เริ่มเมื่อ ต.ค. ปีก่อน', () => {
    expect(fiscalYearOf('2027-01-15')).toBe(2570);
  });

  it('31 ธ.ค. กับ 1 ม.ค. อยู่ปีงบเดียวกัน — ปีปฏิทินไม่ใช่ขอบ', () => {
    expect(fiscalYearOf('2026-12-31')).toBe(fiscalYearOf('2027-01-01'));
  });
});

describe('bangkokDateOf — วันที่ต้องคิดตามเวลากรุงเทพฯ ไม่ใช่ UTC', () => {
  it('00:30 ของ 1 ต.ค. ที่กรุงเทพฯ คือ 17:30 UTC ของ 30 ก.ย. — ต้องได้ 1 ต.ค.', () => {
    expect(bangkokDateOf(new Date('2026-09-30T17:30:00Z'))).toBe('2026-10-01');
  });

  it('ปีงบของเวลานั้นจึงเป็นปีใหม่ — ถ้าตัดวันที่จาก UTC จะได้เลขของปีงบเก่า', () => {
    const at = new Date('2026-09-30T17:30:00Z');
    expect(fiscalYearOf(bangkokDateOf(at))).toBe(2570);
    // บั๊กที่ฟังก์ชันนี้มีไว้กัน:
    expect(fiscalYearOf(at.toISOString().slice(0, 10))).toBe(2569);
  });

  it('23:59 ที่กรุงเทพฯ ยังเป็นวันเดิม', () => {
    expect(bangkokDateOf(new Date('2026-09-30T16:59:00Z'))).toBe('2026-09-30');
  });
});

describe('nextNo', () => {
  it('ปีที่ยังไม่มีหนังสือและไม่ได้ตั้งเลขเริ่มต้น → 1', () => {
    expect(nextNo(null, null)).toBe(1);
  });

  it('ปีที่ยังไม่มีหนังสือแต่ตั้งเลขเริ่มต้นไว้ → เลขเริ่มต้น', () => {
    expect(nextNo(null, 422)).toBe(422);
  });

  it('มีหนังสือแล้ว → max + 1 และเลขเริ่มต้นไม่มีผลอีก', () => {
    expect(nextNo(421, null)).toBe(422);
    expect(nextNo(421, 5)).toBe(422);
  });
});

describe('formatNo — เลขในทะเบียน', () => {
  it('รับ/ส่งเติมศูนย์ 4 หลัก', () => {
    expect(formatNo('in', 421)).toBe('0421');
    expect(formatNo('out', 7)).toBe('0007');
  });

  it('เวียนมี ว นำหน้า', () => {
    expect(formatNo('circular', 12)).toBe('ว 0012');
  });

  it('เกิน 9999 แสดงตามจริง ไม่ตัด', () => {
    expect(formatNo('in', 12345)).toBe('12345');
  });
});

describe('composeRef — "ที่" ไม่เติมศูนย์ ตามรูปแบบหนังสือราชการ', () => {
  it('หนังสือส่ง', () => {
    expect(composeRef('ชม 55201', 'out', 388)).toBe('ชม 55201/388');
  });

  it('หนังสือเวียน', () => {
    expect(composeRef('ชม 55201', 'circular', 12)).toBe('ชม 55201/ว 12');
  });
});
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/saraban-number.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/saraban-number"`

- [ ] **Step 3: เขียนโค้ด**

```ts
// src/lib/saraban-number.ts
// ปีงบและเลขทะเบียนของสารบรรณ — ฟังก์ชันบริสุทธิ์ทั้งหมด (สเปกข้อ 4)
// client-safe: หน้าจอใช้ fiscalYearOf/formatNo ด้วย ห้าม import อะไรฝั่งเซิร์ฟเวอร์

import type { SarabanRegister } from '@/types/saraban';

// 'en-CA' ให้รูปแบบ YYYY-MM-DD พอดี (แนวเดียวกับ todayInBangkok ใน calendar-grid.ts)
const BANGKOK_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * วันที่ตามเวลากรุงเทพฯ ของเวลาจริงขณะหนึ่ง — รับ Date เข้ามาแทนที่จะเรียก new Date()
 * เอง เพื่อให้เทสต์ส่งเวลาข้ามเที่ยงคืนได้ (todayInBangkok() ของปฏิทินทำแบบนั้นไม่ได้)
 */
export function bangkokDateOf(at: Date): string {
  return BANGKOK_DATE.format(at);
}

/**
 * ปีงบประมาณ พ.ศ. ของวันที่ 'YYYY-MM-DD' — ปีงบเริ่ม 1 ต.ค.
 *   '2026-09-30' → 2569 · '2026-10-01' → 2570
 *
 * ขอบปีอยู่ที่นี่ที่เดียว (สเปกข้อ 1.6) — ระเบียบงานสารบรรณ ข้อ 38.1/40.1 เขียนว่า
 * "จนสิ้นปีปฏิทิน" ถ้าวันหนึ่งเทศบาลเปลี่ยนไปใช้ปีปฏิทิน แก้ฟังก์ชันนี้ฟังก์ชันเดียว
 */
export function fiscalYearOf(date: string): number {
  const [year, month] = date.split('-').map(Number);
  return (month >= 10 ? year + 1 : year) + 543;
}

/**
 * เลขถัดไปของ (ทะเบียน, ปีงบ)
 * @param maxNo เลขมากสุดที่มีอยู่ รวมแถวที่ยกเลิกแล้ว (เลขไม่ถูกใช้ซ้ำ) · null = ยังไม่มีหนังสือ
 * @param startNo เลขเริ่มต้นที่ตั้งไว้ของปีนั้น · null = ไม่ได้ตั้ง
 *
 * startNo มีผลเฉพาะตอนปีนั้นยังว่าง — พอมีหนังสือแล้วใช้ max + 1 เสมอ ข้อนี้คือเหตุผลที่
 * setStartNo() ใน saraban-store.ts ไม่ต้อง atomic
 */
export function nextNo(maxNo: number | null, startNo: number | null): number {
  if (maxNo !== null) return maxNo + 1;
  return startNo ?? 1;
}

/** เลขในทะเบียน — รับ/ส่ง '0421' · เวียน 'ว 0012' (เกิน 9999 แสดงตามจริง) */
export function formatNo(register: SarabanRegister, no: number): string {
  const padded = String(no).padStart(4, '0');
  return register === 'circular' ? `ว ${padded}` : padded;
}

/**
 * "ที่" ของหนังสือส่ง/เวียน — ไม่เติมศูนย์ ตามรูปแบบหนังสือราชการ
 *   ('ชม 55201', 'out', 388) → 'ชม 55201/388' · ('ชม 55201', 'circular', 12) → 'ชม 55201/ว 12'
 */
export function composeRef(
  refCode: string,
  register: 'out' | 'circular',
  no: number
): string {
  return register === 'circular' ? `${refCode}/ว ${no}` : `${refCode}/${no}`;
}
```

- [ ] **Step 4: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/saraban-number.test.ts`
Expected: PASS — 15 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-number.ts src/lib/saraban-number.test.ts
git commit -m "feat(saraban): ปีงบตามเวลากรุงเทพฯ และรูปแบบเลขทะเบียน"
```

---

## Task 3: `saraban-labels.ts` — ป้ายภาษาไทย

ป้ายสถานะของส่ง/เวียนเป็น "รอส่ง/ส่งแล้ว" ไม่ใช่ "ดำเนินการ/เสร็จสิ้น" แบบต้นแบบ — จงใจเบี่ยงจาก
แบบ (สเปกข้อ 3) · `SEND_METHOD_LABELS` ถูกใช้เป็นข้อความใน event "ส่งแล้ว" ด้วย (Task 6)

**Files:**
- Create: `src/lib/saraban-labels.ts`
- Test: `src/lib/saraban-labels.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
// src/lib/saraban-labels.test.ts
import { describe, expect, it } from 'vitest';
import {
  fieldLabel,
  LEVEL_LABELS,
  REGISTER_LABELS,
  SEND_METHOD_LABELS,
  statusLabel,
} from '@/lib/saraban-labels';
import { SARABAN_LEVELS, SARABAN_REGISTERS, SEND_METHODS } from '@/types/saraban';

describe('statusLabel', () => {
  it('หนังสือรับใช้ป้ายตามต้นแบบ', () => {
    expect(statusLabel('in', 'pending')).toBe('รอเกษียน');
    expect(statusLabel('in', 'in-progress')).toBe('ดำเนินการ');
    expect(statusLabel('in', 'done')).toBe('เสร็จสิ้น');
  });

  it('ส่ง/เวียนใช้ รอส่ง/ส่งแล้ว — ต้นแบบไม่เคยนิยามว่าดำเนินการ/เสร็จสิ้นของหนังสือส่งคืออะไร', () => {
    expect(statusLabel('out', 'in-progress')).toBe('รอส่ง');
    expect(statusLabel('out', 'done')).toBe('ส่งแล้ว');
    expect(statusLabel('circular', 'in-progress')).toBe('รอส่ง');
    expect(statusLabel('circular', 'done')).toBe('ส่งแล้ว');
  });

  it('ยกเลิกและเกินกำหนดเหมือนกันทุกทะเบียน', () => {
    for (const register of SARABAN_REGISTERS) {
      expect(statusLabel(register, 'void')).toBe('ยกเลิก');
      expect(statusLabel(register, 'overdue')).toBe('เกินกำหนด');
    }
  });
});

describe('ป้ายครบทุกค่า', () => {
  it('ทะเบียน · ชั้นความเร็ว · วิธีส่ง', () => {
    for (const r of SARABAN_REGISTERS) expect(REGISTER_LABELS[r]).toBeTruthy();
    for (const l of SARABAN_LEVELS) expect(LEVEL_LABELS[l]).toBeTruthy();
    for (const m of SEND_METHODS) expect(SEND_METHOD_LABELS[m]).toBeTruthy();
  });
});

describe('fieldLabel — ชื่อช่องในประวัติการแก้ไข', () => {
  it('"จาก" กับ "ถึง" ขึ้นกับทะเบียน', () => {
    expect(fieldLabel('in', 'party')).toBe('จาก');
    expect(fieldLabel('out', 'party')).toBe('ถึง');
  });

  it('ช่องที่ไม่รู้จักคืนชื่อเดิม — รวมชื่อที่ชนกับ property ของ Object', () => {
    expect(fieldLabel('in', 'mystery')).toBe('mystery');
    expect(fieldLabel('in', 'constructor')).toBe('constructor');
  });
});
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/saraban-labels.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/saraban-labels"`

- [ ] **Step 3: เขียนโค้ด**

```ts
// src/lib/saraban-labels.ts
// ป้ายภาษาไทยของคีย์ในโดเมนสารบรรณ — client-safe ใช้ทั้งหน้าจอและข้อความใน event

import type {
  DisplayStatus,
  SarabanLevel,
  SarabanRegister,
  SendMethod,
} from '@/types/saraban';

export const REGISTER_LABELS: Record<SarabanRegister, string> = {
  in: 'ทะเบียนหนังสือรับ',
  out: 'ทะเบียนหนังสือส่ง',
  circular: 'ทะเบียนหนังสือเวียน',
};

export const LEVEL_LABELS: Record<SarabanLevel, string> = {
  normal: 'ปกติ',
  urgent: 'ด่วน',
  'very-urgent': 'ด่วนมาก',
  'most-urgent': 'ด่วนที่สุด',
};

// ข้อความเต็มประโยค เพราะใช้เป็น note ของ event "ส่งแล้ว" ตรง ๆ และตรงกับคอลัมน์
// "การปฏิบัติ" ของรายงานทะเบียนส่งในต้นแบบ
export const SEND_METHOD_LABELS: Record<SendMethod, string> = {
  system: 'ส่งทางระบบสารบรรณอิเล็กทรอนิกส์',
  post: 'ส่งทางไปรษณีย์',
  hand: 'นำส่งเอง',
};

const IN_STATUS_LABELS: Record<DisplayStatus, string> = {
  pending: 'รอเกษียน',
  'in-progress': 'ดำเนินการ',
  done: 'เสร็จสิ้น',
  void: 'ยกเลิก',
  overdue: 'เกินกำหนด',
};

// ส่ง/เวียนเริ่มที่ in-progress เสมอ ('pending' ไม่เกิดจริง ใส่ไว้ให้ Record ครบ)
// จงใจเบี่ยงจากต้นแบบ — วงจรของหนังสือส่งคือ "ออกเลข → ส่ง" ป้ายควรบอกตรง ๆ (สเปกข้อ 3)
const OUTGOING_STATUS_LABELS: Record<DisplayStatus, string> = {
  pending: 'รอส่ง',
  'in-progress': 'รอส่ง',
  done: 'ส่งแล้ว',
  void: 'ยกเลิก',
  overdue: 'เกินกำหนด',
};

export function statusLabel(register: SarabanRegister, status: DisplayStatus): string {
  return (register === 'in' ? IN_STATUS_LABELS : OUTGOING_STATUS_LABELS)[status];
}

/**
 * ชื่อช่องที่แสดงในประวัติการแก้ไข — `field` มาจาก event ที่เก็บไว้ จึงเป็น string อิสระ
 * ใช้ Object.hasOwn ไม่ใช่ `labels[field] ?? field` เพราะ 'constructor' จะได้ฟังก์ชันของ
 * Object.prototype กลับมาแทน
 */
export function fieldLabel(register: SarabanRegister, field: string): string {
  const labels: Record<string, string> = {
    ref: 'ที่หนังสือ',
    docDate: 'ลงวันที่',
    party: register === 'in' ? 'จาก' : 'ถึง',
    subject: 'เรื่อง',
    level: 'ชั้นความเร็ว',
    dueDate: 'กำหนดแล้วเสร็จ',
    holderUnitId: register === 'in' ? 'เสนอถึง' : 'ส่วนราชการเจ้าของเรื่อง',
  };
  return Object.hasOwn(labels, field) ? labels[field] : field;
}
```

- [ ] **Step 4: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/saraban-labels.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-labels.ts src/lib/saraban-labels.test.ts
git commit -m "feat(saraban): ป้ายภาษาไทย แยกป้ายสถานะของหนังสือส่งจากหนังสือรับ"
```

---

## Task 4: `saraban-doc.ts` (ส่วนที่ 1) — สร้างหนังสือ · event · เกินกำหนด

**Files:**
- Create: `src/lib/saraban-doc.ts`
- Test: `src/lib/saraban-doc.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
// src/lib/saraban-doc.test.ts
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  buildNewDoc,
  displayStatus,
  isOverdue,
  makeEvent,
  type NewDocFields,
} from '@/lib/saraban-doc';
import type { SarabanDoc } from '@/types/saraban';

const ACTOR = { id: 'user_clerk_1', name: 'สมหญิง ใจดี' };
const NOW = '2026-10-02T02:30:00.000Z';
const TODAY = '2026-10-15';

function fields(overrides: Partial<NewDocFields> = {}): NewDocFields {
  return {
    register: 'in',
    ref: 'ชม 0023.1/ว 1245',
    docDate: '2026-09-28',
    party: 'ที่ทำการปกครองอำเภอหางดง',
    subject: 'ขอเชิญประชุมหัวหน้าส่วนราชการ',
    level: 'urgent',
    dueDate: '2026-10-10',
    holderUnitId: 'palad',
    ...overrides,
  };
}

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
    expect(doc.dueDate).toBe('2026-10-10');
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
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/saraban-doc.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/saraban-doc"`

- [ ] **Step 3: เขียนโค้ด**

```ts
// src/lib/saraban-doc.ts
// ตรรกะบริสุทธิ์ของหนังสือหนึ่งเรื่อง — client-safe: ห้าม import mongodb/cloudinary/fs/node:*
// หน้าจอใช้ displayStatus/canVoid วาดป้ายและปุ่ม ส่วน API ใช้ฟังก์ชันเดียวกันตัดสินจริง
//
// id และเวลารับเป็นพารามิเตอร์ ไม่สร้างเองข้างใน — store เป็นคนสร้าง (node:crypto)
// และเทสต์ส่งค่าคงที่ได้

import type {
  DisplayStatus,
  SarabanDoc,
  SarabanEvent,
  SarabanEventKind,
  SarabanFieldChange,
  SarabanFile,
  SarabanLevel,
  SarabanRegister,
} from '@/types/saraban';

export type Actor = { id: string; name: string };

export function makeEvent(args: {
  id: string;
  at: string;
  actor: Actor;
  kind: SarabanEventKind;
  note?: string;
  changes?: SarabanFieldChange[];
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
  return event;
}

// ช่องที่มาจากฟอร์ม (ผ่าน zod แล้ว) — ส่วนที่ระบบกำหนดเองอยู่ใน NewDocMeta
export type NewDocFields = {
  register: SarabanRegister;
  ref: string;
  docDate: string;
  party: string;
  subject: string;
  level: SarabanLevel;
  dueDate: string;
  holderUnitId: string;
};

export type NewDocMeta = {
  id: string;
  fiscalYear: number;
  no: number;
  files: SarabanFile[];
  actor: Actor;
  now: string;
  eventId: string;
  eventNote: string;
};

/**
 * ประกอบหนังสือใหม่ — เขียนทุกคีย์เสมอแม้ค่าว่าง (sendMethod/voidReason = '')
 * เหตุผลเดียวกับ buildNewJob ใน jobs-store.ts: หนังสือที่ไม่เคยยกเลิกกับที่ยกเลิกแล้วต้องมี
 * รูปร่างเดียวกัน ไม่งั้นโค้ดที่เช็ค `'voidReason' in doc` จะแสดงผลสองแบบ
 *
 * สถานะเริ่มต้นตามทะเบียน: รับ → รอเกษียน · ส่ง/เวียน → รอส่ง (ออกเลขแล้วแต่ยังไม่ส่ง)
 * dueDate ของส่ง/เวียนถูกบังคับเป็น '' ที่นี่ — toMongoQuery() พึ่งข้อนี้อยู่ (ดูที่นั่น)
 */
export function buildNewDoc(fields: NewDocFields, meta: NewDocMeta): SarabanDoc {
  const isIn = fields.register === 'in';
  return {
    id: meta.id,
    register: fields.register,
    fiscalYear: meta.fiscalYear,
    no: meta.no,
    ref: fields.ref,
    docDate: fields.docDate,
    party: fields.party,
    subject: fields.subject,
    level: fields.level,
    dueDate: isIn ? fields.dueDate : '',
    holderUnitId: fields.holderUnitId,
    status: isIn ? 'pending' : 'in-progress',
    sendMethod: '',
    voidReason: '',
    files: meta.files,
    events: [
      makeEvent({
        id: meta.eventId,
        at: meta.now,
        actor: meta.actor,
        kind: isIn ? 'received' : 'issued',
        note: meta.eventNote,
      }),
    ],
    registeredAt: meta.now,
    registeredBy: meta.actor.id,
    updatedAt: meta.now,
  };
}

type OverdueInput = Pick<SarabanDoc, 'register' | 'dueDate' | 'status'>;

/**
 * เกินกำหนด = หนังสือรับที่ยังเปิดอยู่และกำหนดแล้วเสร็จผ่านไปแล้ว — วันกำหนดพอดียังไม่เกิน
 * คำนวณทุกครั้ง ไม่เก็บเป็นสถานะ: ถ้าเก็บต้องมี cron คอยเปลี่ยน วันที่ cron ไม่ทำงาน
 * สถานะจะผิดเงียบ ๆ
 */
export function isOverdue(doc: OverdueInput, today: string): boolean {
  return (
    doc.register === 'in' &&
    doc.dueDate !== '' &&
    doc.dueDate < today &&
    (doc.status === 'pending' || doc.status === 'in-progress')
  );
}

/** สถานะที่แสดงบนจอ — เกินกำหนดแสดงแทนสถานะจริง */
export function displayStatus(doc: OverdueInput, today: string): DisplayStatus {
  return isOverdue(doc, today) ? 'overdue' : doc.status;
}
```

- [ ] **Step 4: รันเทสต์ ต้องผ่าน และตรวจชนิด (expectTypeOf ตรวจจริงตอน tsc)**

Run: `npx vitest run src/lib/saraban-doc.test.ts && npx tsc --noEmit -p .`
Expected: PASS — 15 tests · tsc ไม่มี output

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-doc.ts src/lib/saraban-doc.test.ts
git commit -m "feat(saraban): สร้างหนังสือใหม่และกฎเกินกำหนดแบบคำนวณ"
```

---

## Task 5: `saraban-doc.ts` (ส่วนที่ 2) — ตัวกรองทะเบียน ฝั่งไฟล์และฝั่ง Mongo

กฎกรองต้องเขียนสองที่: `matches()` (แบ็กเอนด์ไฟล์) กับ `toMongoQuery()` (Mongo) — `jobs-store.ts`
ยอมรับไว้ว่าเทสต์เทียบสองฝั่งไม่ได้เพราะไม่มี Mongo ในเทสต์ รอบนี้ปิดช่องนั้นด้วยตัวประเมิน query
ขนาดเล็กในไฟล์เทสต์ ที่รู้จักเฉพาะ operator ที่ `toMongoQuery` ใช้ (เจอ operator อื่นจะ throw)
แล้วเทียบผลกับ `matches()` ทุกคู่ (หนังสือ × ตัวกรอง)

**Files:**
- Modify: `src/lib/saraban-doc.ts` (เพิ่มท้ายไฟล์)
- Test: `src/lib/saraban-doc.test.ts` (แก้ import + เพิ่มท้ายไฟล์)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

แก้ import ของ `@/lib/saraban-doc` บนสุดของ `src/lib/saraban-doc.test.ts` เป็น:

```ts
import {
  buildNewDoc,
  displayStatus,
  isOverdue,
  makeEvent,
  matches,
  REGISTER_VIEWS,
  toMongoQuery,
  type DocFilter,
  type NewDocFields,
} from '@/lib/saraban-doc';
```

แล้วเพิ่มท้ายไฟล์:

```ts
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
  makeDoc({ id: 'out-waiting', register: 'out', no: 1, status: 'in-progress', dueDate: '' }),
  makeDoc({ id: 'out-sent', register: 'out', no: 2, status: 'done', dueDate: '' }),
  makeDoc({ id: 'circ-waiting', register: 'circular', no: 1, status: 'in-progress', dueDate: '' }),
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
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/saraban-doc.test.ts`
Expected: FAIL — `matches` / `toMongoQuery` / `REGISTER_VIEWS` ไม่ถูก export (`is not a function` หรือ `undefined`)

- [ ] **Step 3: เขียนโค้ด — แก้ import บนสุดของ `src/lib/saraban-doc.ts` เป็น**

```ts
import {
  DISPLAY_STATUSES,
  type DisplayStatus,
  type SarabanDoc,
  type SarabanEvent,
  type SarabanEventKind,
  type SarabanFieldChange,
  type SarabanFile,
  type SarabanLevel,
  type SarabanRegister,
  type SarabanStatus,
} from '@/types/saraban';
```

แล้วเพิ่มท้ายไฟล์:

```ts
// ---- ตัวกรองทะเบียน -------------------------------------------------------

// ปุ่ม "ทั้งหมด" + ทุกสถานะที่แสดงบนจอ — สร้างจาก DISPLAY_STATUSES ไม่พิมพ์รายการซ้ำ
// เพิ่มสถานะใหม่ใน types/saraban.ts แล้วปุ่มกรองกับ docListQuerySchema ตามมาเอง
export const REGISTER_VIEWS = ['all', ...DISPLAY_STATUSES] as const;
export type RegisterView = (typeof REGISTER_VIEWS)[number];

/**
 * ตัวกรองของทะเบียน — ทุกช่องต่อกันแบบ AND
 * - view: ปุ่มกรองบนหน้าทะเบียน แยกขาดตาม "ป้ายที่เห็น" (displayStatus) — เรื่องที่เกิน
 *   กำหนดอยู่ใต้ปุ่มเกินกำหนดที่เดียว ไม่ซ้ำใต้รอเกษียน ตัวเลขบนปุ่มจึงรวมกันได้พอดี
 * - statusIn: สถานะดิบ ไม่สนเกินกำหนด — badge (รอเกษียนทุกเรื่อง) และแถบค้างข้ามปี
 */
export type DocFilter = {
  register: SarabanRegister;
  fiscalYear?: number;
  beforeFiscalYear?: number;
  view?: RegisterView;
  statusIn?: readonly SarabanStatus[];
};

/**
 * กฎกรองของแบ็กเอนด์ไฟล์ — toMongoQuery() ด้านล่างพูดกฎเดียวกันแยกคนละที่ ถ้าแก้ฝั่งหนึ่ง
 * ต้องแก้อีกฝั่ง saraban-doc.test.ts เทียบสองฝั่งให้ทุกคู่ (หนังสือ × ตัวกรอง)
 */
export function matches(doc: SarabanDoc, f: DocFilter, today: string): boolean {
  if (doc.register !== f.register) return false;
  if (f.fiscalYear !== undefined && doc.fiscalYear !== f.fiscalYear) return false;
  if (f.beforeFiscalYear !== undefined && doc.fiscalYear >= f.beforeFiscalYear) return false;
  if (f.statusIn && !f.statusIn.includes(doc.status)) return false;
  if (f.view && f.view !== 'all' && displayStatus(doc, today) !== f.view) return false;
  return true;
}

// 'YYYY-MM-DD' เทียบแบบสตริงได้ผลตรงกับเทียบวันที่ แต่ '' น้อยกว่าทุกวันที่ จึงต้องมี
// $ne: '' กำกับทุกครั้งที่ถาม "เลยกำหนดแล้ว"
//
// ไม่เช็ค register === 'in' ในเงื่อนไข "ไม่เกินกำหนด" ของปุ่มรอเกษียน/ดำเนินการ เพราะ
// buildNewDoc บังคับ dueDate ของส่ง/เวียนเป็น '' เสมอ และกฎแก้ไข (editableFieldsOf)
// ไม่ให้แก้ dueDate ของส่ง/เวียน — ถ้าวันหนึ่งสองข้อนี้เปลี่ยน ต้องกลับมาแก้ตรงนี้
function viewQuery(view: Exclude<RegisterView, 'all'>, today: string): Record<string, unknown> {
  const notOverdue = { $or: [{ dueDate: '' }, { dueDate: { $gte: today } }] };
  switch (view) {
    case 'pending':
    case 'in-progress':
      return { status: view, ...notOverdue };
    case 'done':
    case 'void':
      return { status: view };
    case 'overdue':
      return {
        register: 'in',
        status: { $in: ['pending', 'in-progress'] },
        dueDate: { $ne: '', $lt: today },
      };
  }
}

/** query ของ Mongo ที่ให้ผลเดียวกับ matches() — ตัวกรองทะเบียนอย่างเดียวได้ query แบน ๆ */
export function toMongoQuery(f: DocFilter, today: string): Record<string, unknown> {
  const and: Record<string, unknown>[] = [{ register: f.register }];
  if (f.fiscalYear !== undefined) and.push({ fiscalYear: f.fiscalYear });
  if (f.beforeFiscalYear !== undefined) and.push({ fiscalYear: { $lt: f.beforeFiscalYear } });
  if (f.statusIn) and.push({ status: { $in: [...f.statusIn] } });
  if (f.view && f.view !== 'all') and.push(viewQuery(f.view, today));
  return and.length === 1 ? and[0] : { $and: and };
}
```

- [ ] **Step 4: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/saraban-doc.test.ts && npx tsc --noEmit -p .`
Expected: PASS — 40 tests (15 เดิม + 7 matches + 17 ตัวกรองใน it.each + 1 query แบน) · tsc ไม่มี output

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-doc.ts src/lib/saraban-doc.test.ts
git commit -m "feat(saraban): ตัวกรองทะเบียนพร้อมเทสต์เทียบกฎฝั่งไฟล์กับ query ของ Mongo"
```

---

## Task 6: `saraban-doc.ts` (ส่วนที่ 3) — กฎแก้ไข · ยกเลิก · ส่งแล้ว · ไฟล์แนบ

สเปกข้อ 6 "กฎการแก้ไข" — เลขทะเบียน ทะเบียน ปีงบ แก้ไม่ได้ทุกกรณี · ลบหนังสือไม่ได้ (ยกเลิกแทน)
ฟังก์ชันที่นี่ตัดสินอย่างเดียว ไม่เขียนอะไร — route ของรอบ 1B เอาผลไปเรียก `applyPatch()` (Task 12)

**Files:**
- Modify: `src/lib/saraban-doc.ts` (แก้ import + เพิ่มท้ายไฟล์)
- Test: `src/lib/saraban-doc.test.ts` (แก้ import + เพิ่มท้ายไฟล์)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

แก้ import ของ `@/lib/saraban-doc` บนสุดของ `src/lib/saraban-doc.test.ts` เป็น:

```ts
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
  isOverdue,
  makeEvent,
  matches,
  REGISTER_VIEWS,
  sentTransition,
  toMongoQuery,
  voidTransition,
  type DocFilter,
  type NewDocFields,
} from '@/lib/saraban-doc';
```

แล้วเพิ่มท้ายไฟล์:

```ts
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
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/saraban-doc.test.ts`
Expected: FAIL — `editableFieldsOf is not a function` (และตัวอื่นที่ยังไม่มี)

- [ ] **Step 3: เขียนโค้ด — แก้ import บนสุดของ `src/lib/saraban-doc.ts` เป็น**

```ts
import { SEND_METHOD_LABELS } from '@/lib/saraban-labels';
import {
  DISPLAY_STATUSES,
  type DisplayStatus,
  type SarabanDoc,
  type SarabanEvent,
  type SarabanEventKind,
  type SarabanFieldChange,
  type SarabanFile,
  type SarabanLevel,
  type SarabanRegister,
  type SarabanStatus,
  type SendMethod,
} from '@/types/saraban';
```

แล้วเพิ่มท้ายไฟล์:

```ts
// ---- กฎแก้ไข ยกเลิก ส่งแล้ว ไฟล์แนบ (สเปกข้อ 6) -----------------------------

// ช่องที่ฟอร์มแก้ไขส่งมาได้ — เลขทะเบียน ทะเบียน ปีงบ แก้ไม่ได้ทุกกรณี จึงไม่อยู่ในรายการเลย
export const EDITABLE_FIELDS = [
  'ref',
  'docDate',
  'party',
  'subject',
  'level',
  'dueDate',
  'holderUnitId',
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type DocEdit = Partial<Pick<SarabanDoc, EditableField>>;

/**
 * ช่องที่แก้ได้ของหนังสือเรื่องนี้ในสถานะนี้
 * - ยกเลิกแล้วแก้อะไรไม่ได้
 * - ส่ง/เวียน: "ที่" ประกอบจากรหัสส่วนราชการกับเลข และอาจถูกพิมพ์ลงหนังสือจริงไปแล้ว
 *   เจ้าของเรื่องเป็นคนกำหนดรหัสใน "ที่" · ไม่มีกำหนดแล้วเสร็จ → ถ้าผิดให้ยกเลิกแล้วออกเลขใหม่
 * - รับ: เปลี่ยน "เสนอถึง" ได้เฉพาะตอนรอเกษียน — หลังจากนั้นหนังสือเดินตามการเกษียน (รอบ 2)
 *   ถ้าแก้ตรงนี้ได้ จะเป็นทางลัดข้ามการเกษียนที่ไม่ทิ้งร่องรอยว่าใครส่งต่อ
 */
export function editableFieldsOf(
  doc: Pick<SarabanDoc, 'register' | 'status'>
): readonly EditableField[] {
  if (doc.status === 'void') return [];
  if (doc.register !== 'in') return ['docDate', 'party', 'subject', 'level'];
  const base: EditableField[] = ['ref', 'docDate', 'party', 'subject', 'level', 'dueDate'];
  return doc.status === 'pending' ? [...base, 'holderUnitId'] : base;
}

export type EditResult =
  | { ok: true; set: DocEdit; changes: SarabanFieldChange[] }
  | { ok: false; field: EditableField };

/**
 * เทียบของที่ส่งมากับของเดิม เก็บเฉพาะช่องที่เปลี่ยนจริง — ฟอร์มส่งค่าปัจจุบันมาครบทุกช่อง
 * ช่องที่ส่งค่าเดิมมาจึงต้องไม่นับ (ทั้งเป็นการแก้และเป็นการชนช่องที่ล็อก)
 * ช่องที่ล็อกแต่ส่งค่าใหม่มา → ปฏิเสธทั้งคำขอ ไม่แก้ครึ่ง ๆ แล้วเงียบ
 *
 * set เป็น Record<string, string> ระหว่างประกอบ: TypeScript ตรวจ `set[field] = next`
 * ในลูปไม่ผ่าน เพราะ field เป็น union ของคีย์ต่างชนิด (level เป็น SarabanLevel) — เหตุผล
 * เดียวกับคอมเมนต์บน buildJobPatch ใน jobs-store.ts
 */
export function buildEdit(doc: SarabanDoc, edit: DocEdit): EditResult {
  const allowed = new Set<EditableField>(editableFieldsOf(doc));
  const set: Record<string, string> = {};
  const changes: SarabanFieldChange[] = [];
  for (const field of EDITABLE_FIELDS) {
    const next = edit[field];
    if (next === undefined || next === doc[field]) continue;
    if (!allowed.has(field)) return { ok: false, field };
    set[field] = next;
    changes.push({ field, from: doc[field], to: next });
  }
  return { ok: true, set: set as DocEdit, changes };
}

export function canVoid(doc: Pick<SarabanDoc, 'status'>): boolean {
  return doc.status === 'pending' || doc.status === 'in-progress';
}

export function canMarkSent(doc: Pick<SarabanDoc, 'register' | 'status'>): boolean {
  return doc.register !== 'in' && doc.status === 'in-progress';
}

// ไฟล์สแกนมักตามมาทีหลัง จึงเพิ่มได้แม้เรื่องเสร็จแล้ว — แต่ลบได้เฉพาะเรื่องที่ยังเปิดอยู่
// (รอบ 4 ต้องห้ามลบไฟล์ที่มีตรา/ลายมือ/การลงนามอ้างอยู่ด้วย)
export function canAddFile(doc: Pick<SarabanDoc, 'status'>): boolean {
  return doc.status !== 'void';
}

export function canRemoveFile(doc: Pick<SarabanDoc, 'status'>): boolean {
  return doc.status === 'pending' || doc.status === 'in-progress';
}

/** ผลของการเปลี่ยนสถานะ — route เอา kind/note ไปสร้าง event แล้วเรียก applyPatch */
export type Transition = {
  set: Partial<Pick<SarabanDoc, 'status' | 'voidReason' | 'sendMethod'>>;
  kind: SarabanEventKind;
  note: string;
};

/** ยกเลิก — null = สถานะนี้ยกเลิกไม่ได้ (route ตอบ 409 invalid_transition) */
export function voidTransition(doc: Pick<SarabanDoc, 'status'>, reason: string): Transition | null {
  if (!canVoid(doc)) return null;
  return { set: { status: 'void', voidReason: reason }, kind: 'voided', note: reason };
}

/** บันทึกว่าส่งแล้ว — null = ไม่ใช่ส่ง/เวียนที่รอส่ง */
export function sentTransition(
  doc: Pick<SarabanDoc, 'register' | 'status'>,
  method: SendMethod
): Transition | null {
  if (!canMarkSent(doc)) return null;
  return {
    set: { status: 'done', sendMethod: method },
    kind: 'sent',
    note: SEND_METHOD_LABELS[method],
  };
}
```

- [ ] **Step 4: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/saraban-doc.test.ts && npx tsc --noEmit -p .`
Expected: PASS — 58 tests (40 เดิม + 5 editableFieldsOf + 6 buildEdit + 3 can* + 4 transition) · tsc ไม่มี output

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-doc.ts src/lib/saraban-doc.test.ts
git commit -m "feat(saraban): กฎแก้ไข ยกเลิก และบันทึกว่าส่งแล้ว"
```

---

## Task 7: `saraban-attachment.ts` — ตรวจไฟล์แนบ

สเปกข้อ 5 "เซิร์ฟเวอร์ไม่เชื่อข้อมูลไฟล์จาก client" — รอบ 1B ถาม Cloudinary Admin API แล้วส่งผลมา
ให้ `checkAttachment()` ตัดสิน ไฟล์นี้ไม่ import SDK จึงเทสต์ได้ตรง ๆ และ `SARABAN_FOLDER` อยู่ที่นี่
(`cloudinary.ts` ของรอบ 1B import ไปใช้ ไม่ประกาศซ้ำ)

**Files:**
- Create: `src/lib/saraban-attachment.ts`
- Test: `src/lib/saraban-attachment.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
// src/lib/saraban-attachment.test.ts
import { describe, expect, it } from 'vitest';
import {
  checkAttachment,
  MAX_FILE_BYTES,
  SARABAN_FOLDER,
  type CloudinaryResource,
} from '@/lib/saraban-attachment';
import { SARABAN_FILE_FORMATS } from '@/types/saraban';

function resource(overrides: Partial<CloudinaryResource> = {}): CloudinaryResource {
  return {
    public_id: `${SARABAN_FOLDER}/2570/abc123`,
    type: 'authenticated',
    resource_type: 'image',
    format: 'pdf',
    bytes: 1_200_000,
    pages: 2,
    ...overrides,
  };
}

describe('checkAttachment — เชื่อ Cloudinary ไม่เชื่อ client', () => {
  it('PDF แบบ image ผ่าน และขนาด/จำนวนหน้ามาจาก resource', () => {
    expect(checkAttachment(resource())).toEqual({
      ok: true,
      file: {
        publicId: `${SARABAN_FOLDER}/2570/abc123`,
        resourceType: 'image',
        format: 'pdf',
        bytes: 1_200_000,
        pages: 2,
      },
    });
  });

  it('ไฟล์เต็มของแผนที่ (มีข้อมูลส่วนบุคคล) แนบเป็นไฟล์ของสารบรรณไม่ได้', () => {
    const r = resource({ public_id: 'namphrae-portal/map/full/land-parcels' });
    expect(checkAttachment(r)).toEqual({ ok: false, error: 'wrong_folder' });
  });

  it('โฟลเดอร์ที่ชื่อขึ้นต้นเหมือนกันแต่ไม่ใช่ของเรา — ต้องเช็ค "/" ต่อท้ายด้วย', () => {
    const r = resource({ public_id: 'namphrae-portal/saraban-evil/x' });
    expect(checkAttachment(r)).toEqual({ ok: false, error: 'wrong_folder' });
  });

  it('ไฟล์ type upload (ใครรู้ URL ก็เปิดได้) ไม่รับ', () => {
    expect(checkAttachment(resource({ type: 'upload' }))).toEqual({
      ok: false,
      error: 'not_authenticated',
    });
  });

  it('resource_type อื่นนอกจาก image/raw ไม่รับ', () => {
    expect(checkAttachment(resource({ resource_type: 'video' }))).toEqual({
      ok: false,
      error: 'bad_resource_type',
    });
  });

  it('นามสกุลนอกรายการไม่รับ — รวมชื่อที่ชนกับ property ของ Object', () => {
    expect(checkAttachment(resource({ format: 'gif' }))).toEqual({ ok: false, error: 'bad_format' });
    expect(checkAttachment(resource({ format: 'constructor' }))).toEqual({
      ok: false,
      error: 'bad_format',
    });
  });

  it('jpeg เก็บเป็น jpg และรูปภาพนับเป็น 1 หน้า', () => {
    const result = checkAttachment(resource({ format: 'jpeg', pages: undefined }));
    expect(result.ok && result.file.format).toBe('jpg');
    expect(result.ok && result.file.pages).toBe(1);
  });

  it('PDF แบบ raw: นามสกุลมาจาก public_id และไม่รู้จำนวนหน้า = 0', () => {
    const result = checkAttachment(
      resource({
        public_id: `${SARABAN_FOLDER}/2570/scan.pdf`,
        resource_type: 'raw',
        format: undefined,
        pages: undefined,
      })
    );
    expect(result).toEqual({
      ok: true,
      file: {
        publicId: `${SARABAN_FOLDER}/2570/scan.pdf`,
        resourceType: 'raw',
        format: 'pdf',
        bytes: 1_200_000,
        pages: 0,
      },
    });
  });

  it('เพดาน 10MB พอดีผ่าน เกินหนึ่งไบต์ไม่ผ่าน', () => {
    expect(checkAttachment(resource({ bytes: MAX_FILE_BYTES })).ok).toBe(true);
    expect(checkAttachment(resource({ bytes: MAX_FILE_BYTES + 1 }))).toEqual({
      ok: false,
      error: 'too_large',
    });
  });

  it('ทุกนามสกุลใน SARABAN_FILE_FORMATS ผ่านและเก็บเป็นค่าเดิม — FORMATS ต้องครอบรายการกลางครบ', () => {
    for (const format of SARABAN_FILE_FORMATS) {
      const result = checkAttachment(resource({ format }));
      expect(result.ok && result.file.format, format).toBe(format);
    }
  });
});
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/saraban-attachment.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/saraban-attachment"`

- [ ] **Step 3: เขียนโค้ด**

```ts
// src/lib/saraban-attachment.ts
// ตรวจไฟล์แนบจากข้อมูลที่ Cloudinary Admin API คืนมา ไม่ใช่จากที่ client ส่ง (สเปกข้อ 5)
// client-safe ไม่ import SDK — cloudinary.ts เป็นคนเรียก API แล้วส่งผลมาให้ที่นี่ตัดสิน
//
// ทำไมต้องตรวจโฟลเดอร์: client ส่ง publicId มาเองได้ ถ้าไม่ตรวจ คนจะแนบ publicId ของไฟล์
// แผนที่ฉบับเต็ม (type authenticated เหมือนกัน และมีข้อมูลส่วนบุคคล) เข้ามาเป็นไฟล์แนบ
// แล้วเปิดผ่าน URL ชั่วคราวของสารบรรณได้ — ผู้มีสิทธิ์สารบรรณไม่จำเป็นต้องมีสิทธิ์แผนที่

import {
  SARABAN_RESOURCE_TYPES,
  type SarabanFile,
  type SarabanFileFormat,
} from '@/types/saraban';

// โฟลเดอร์แยกจากโดเมนอื่น — บทเรียนจากป่าไม้ที่เคยใช้โฟลเดอร์ร่วมกับแผนที่แล้วไฟล์ถูก
// เขียนทับ (ดูคอมเมนต์ FOREST_FOLDER_FULL ใน cloudinary.ts)
export const SARABAN_FOLDER = 'namphrae-portal/saraban';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_DOC = 10;

/** ส่วนที่ใช้ของผลลัพธ์ cloudinary.api.resource() */
export type CloudinaryResource = {
  public_id: string;
  type: string;
  resource_type: string;
  format?: string;
  bytes: number;
  pages?: number;
};

export type CheckedAttachment = Pick<
  SarabanFile,
  'publicId' | 'resourceType' | 'format' | 'bytes' | 'pages'
>;

export type AttachmentError =
  | 'wrong_folder'
  | 'not_authenticated'
  | 'bad_resource_type'
  | 'bad_format'
  | 'too_large';

export type AttachmentCheck =
  | { ok: true; file: CheckedAttachment }
  | { ok: false; error: AttachmentError };

// Map ไม่ใช่ object literal — FORMATS['constructor'] ของ object literal คืนฟังก์ชันของ
// Object.prototype ซึ่ง truthy แล้วหลุดด่านไป
const FORMATS = new Map<string, SarabanFileFormat>([
  ['pdf', 'pdf'],
  ['jpg', 'jpg'],
  ['jpeg', 'jpg'],
  ['png', 'png'],
]);

// ไฟล์ raw ไม่มีช่อง format แยก นามสกุลติดมากับ public_id
function extensionOf(r: CloudinaryResource): string {
  if (r.format) return r.format.toLowerCase();
  const dot = r.public_id.lastIndexOf('.');
  return dot === -1 ? '' : r.public_id.slice(dot + 1).toLowerCase();
}

export function checkAttachment(r: CloudinaryResource): AttachmentCheck {
  // ต้องมี '/' ต่อท้าย — 'namphrae-portal/saraban-evil/x' ขึ้นต้นด้วยชื่อโฟลเดอร์เราเหมือนกัน
  if (!r.public_id.startsWith(`${SARABAN_FOLDER}/`)) return { ok: false, error: 'wrong_folder' };
  if (r.type !== 'authenticated') return { ok: false, error: 'not_authenticated' };
  // find() บนอาเรย์กลางแทน ternary — ได้ชนิด SarabanResourceType กลับมาเลย และรายการไม่ถูก
  // พิมพ์ซ้ำ (หัวไฟล์ types/saraban.ts)
  const resourceType = SARABAN_RESOURCE_TYPES.find((t) => t === r.resource_type) ?? null;
  if (!resourceType) return { ok: false, error: 'bad_resource_type' };
  const format = FORMATS.get(extensionOf(r));
  if (!format) return { ok: false, error: 'bad_format' };
  if (r.bytes > MAX_FILE_BYTES) return { ok: false, error: 'too_large' };
  return {
    ok: true,
    file: {
      publicId: r.public_id,
      resourceType,
      format,
      bytes: r.bytes,
      // PDF แบบ image: Cloudinary นับหน้าให้ · รูปภาพ = 1 หน้า · PDF แบบ raw ไม่รู้ = 0
      pages: r.pages ?? (format === 'pdf' ? 0 : 1),
    },
  };
}
```

- [ ] **Step 4: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/saraban-attachment.test.ts`
Expected: PASS — 10 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-attachment.ts src/lib/saraban-attachment.test.ts
git commit -m "feat(saraban): ตรวจไฟล์แนบจากข้อมูลของ Cloudinary ไม่ใช่จาก client"
```

---

## Task 8: `saraban-schema.ts` — zod ของทุกคำขอในรอบ 1

**Files:**
- Create: `src/lib/saraban-schema.ts`
- Test: `src/lib/saraban-schema.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
// src/lib/saraban-schema.test.ts
import { describe, expect, it } from 'vitest';
import {
  docListQuerySchema,
  docPatchSchema,
  receiveInputSchema,
  sendInputSchema,
  unitInputSchema,
  unitPatchSchema,
  yearStartSchema,
} from '@/lib/saraban-schema';

const ID = '3f1c2a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f';

const RECEIVE = {
  id: ID,
  ref: 'ชม 0023.1/ว 1245',
  docDate: '2026-09-28',
  party: 'ที่ทำการปกครองอำเภอหางดง',
  subject: 'ขอเชิญประชุมหัวหน้าส่วนราชการ',
  holderUnitId: 'palad',
};

const FILE = { publicId: 'namphrae-portal/saraban/2570/a', resourceType: 'image', name: 'scan.pdf' };

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((i) => i.message) ?? [];
}

describe('receiveInputSchema', () => {
  it('ข้อมูลครบผ่าน และเติมค่าเริ่มต้น', () => {
    expect(receiveInputSchema.parse(RECEIVE)).toEqual({
      ...RECEIVE,
      level: 'normal',
      dueDate: '',
      files: [],
    });
  });

  it('ตัดช่องว่างหัวท้าย', () => {
    expect(receiveInputSchema.parse({ ...RECEIVE, subject: '  เรื่อง  ' }).subject).toBe('เรื่อง');
  });

  it('ช่องบังคับว่างได้ข้อความภาษาไทย', () => {
    expect(messages(receiveInputSchema.safeParse({ ...RECEIVE, ref: '   ' }))).toContain(
      'ต้องระบุที่หนังสือ'
    );
  });

  it('วันที่ที่ไม่มีจริงไม่ผ่าน', () => {
    expect(messages(receiveInputSchema.safeParse({ ...RECEIVE, docDate: '2026-02-30' }))).toContain(
      'วันที่ไม่มีอยู่จริง'
    );
  });

  it('ปี พ.ศ. ที่พิมพ์ลงช่อง ค.ศ. ไม่ผ่าน — ทั้งที่เป็นวันที่ที่มีจริง', () => {
    const result = receiveInputSchema.safeParse({ ...RECEIVE, docDate: '2569-09-28' });
    expect(result.success).toBe(false);
    expect(messages(result).join()).toContain('พ.ศ.');
  });

  it('กำหนดแล้วเสร็จเว้นว่างได้ แต่ถ้าใส่ต้องเป็นวันที่ที่ถูกต้อง', () => {
    expect(receiveInputSchema.safeParse({ ...RECEIVE, dueDate: '' }).success).toBe(true);
    expect(receiveInputSchema.safeParse({ ...RECEIVE, dueDate: '2569-10-10' }).success).toBe(false);
  });

  it('id ต้องเป็น uuid — เป็น idempotency key ของการออกเลข', () => {
    expect(receiveInputSchema.safeParse({ ...RECEIVE, id: 'abc' }).success).toBe(false);
  });

  it('แนบได้ไม่เกิน 10 ไฟล์', () => {
    expect(receiveInputSchema.safeParse({ ...RECEIVE, files: Array(10).fill(FILE) }).success).toBe(true);
    expect(receiveInputSchema.safeParse({ ...RECEIVE, files: Array(11).fill(FILE) }).success).toBe(false);
  });
});

describe('sendInputSchema', () => {
  const SEND = {
    id: ID,
    ownerUnitId: 'office',
    docDate: '2026-10-02',
    party: 'นายอำเภอหางดง',
    subject: 'รายงานผลการดำเนินโครงการ',
  };

  it('หนังสือเวียนเป็น false โดยปริยาย', () => {
    expect(sendInputSchema.parse(SEND).circular).toBe(false);
  });

  it('ต้องเลือกส่วนราชการเจ้าของเรื่อง', () => {
    expect(sendInputSchema.safeParse({ ...SEND, ownerUnitId: '' }).success).toBe(false);
  });
});

describe('docPatchSchema — แยกตาม action', () => {
  it('edit บางช่องผ่าน', () => {
    const r = docPatchSchema.parse({ action: 'edit', updatedAt: 't', edit: { subject: ' ใหม่ ' } });
    expect(r).toEqual({ action: 'edit', updatedAt: 't', edit: { subject: 'ใหม่' } });
  });

  it('edit ที่ไม่มีช่องไหนเลยไม่ผ่าน', () => {
    expect(docPatchSchema.safeParse({ action: 'edit', updatedAt: 't', edit: {} }).success).toBe(false);
  });

  it('ยกเลิกต้องมีเหตุผล', () => {
    expect(docPatchSchema.safeParse({ action: 'void', updatedAt: 't', reason: ' ' }).success).toBe(false);
    expect(docPatchSchema.safeParse({ action: 'void', updatedAt: 't', reason: 'ลงรับซ้ำ' }).success).toBe(true);
  });

  it('ส่งแล้วรับเฉพาะวิธีส่งที่รู้จัก', () => {
    expect(docPatchSchema.safeParse({ action: 'sent', updatedAt: 't', method: 'post' }).success).toBe(true);
    expect(docPatchSchema.safeParse({ action: 'sent', updatedAt: 't', method: 'fax' }).success).toBe(false);
  });

  it('action แปลกหรือไม่มี updatedAt ไม่ผ่าน', () => {
    expect(docPatchSchema.safeParse({ action: 'delete', updatedAt: 't' }).success).toBe(false);
    expect(docPatchSchema.safeParse({ action: 'void', reason: 'x' }).success).toBe(false);
  });
});

describe('unitInputSchema / unitPatchSchema', () => {
  it('ค่าเริ่มต้น', () => {
    expect(unitInputSchema.parse({ name: 'กองช่าง' })).toEqual({
      name: 'กองช่าง',
      dept: '',
      refCode: '',
      order: 0,
      isActive: true,
    });
  });

  it("รหัสส่วนราชการห้ามมี '/' — ระบบต่อ /เลข ให้เอง", () => {
    expect(unitInputSchema.safeParse({ name: 'กองช่าง', refCode: 'ชม 55203/' }).success).toBe(false);
  });

  it('patch ที่ไม่มีช่องไหนเลยไม่ผ่าน', () => {
    expect(unitPatchSchema.safeParse({}).success).toBe(false);
    expect(unitPatchSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });
});

describe('yearStartSchema', () => {
  it('เลขเริ่มต้นต้องไม่น้อยกว่า 1', () => {
    const base = { register: 'in', fiscalYear: 2570 };
    expect(yearStartSchema.safeParse({ ...base, startNo: 0 }).success).toBe(false);
    expect(yearStartSchema.safeParse({ ...base, startNo: 422 }).success).toBe(true);
  });
});

describe('docListQuerySchema — ค่าจาก query string เป็นสตริงทั้งหมด', () => {
  it('แปลงเป็นตัวเลขและเติมค่าเริ่มต้น', () => {
    expect(docListQuerySchema.parse({ register: 'in', year: '2570', page: '2' })).toEqual({
      register: 'in',
      year: 2570,
      view: 'all',
      page: 2,
    });
    expect(docListQuerySchema.parse({ register: 'out' })).toEqual({
      register: 'out',
      view: 'all',
      page: 1,
    });
  });

  it('ทะเบียนที่ไม่รู้จักไม่ผ่าน', () => {
    expect(docListQuerySchema.safeParse({ register: 'secret' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/saraban-schema.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/saraban-schema"`

- [ ] **Step 3: เขียนโค้ด**

```ts
// src/lib/saraban-schema.ts
// zod ของทุกคำขอในระบบสารบรรณรอบ 1 — ใช้ร่วมทั้ง API และฟอร์ม (แนวเดียวกับ schema.ts)

import { z } from 'zod';
import { MAX_FILES_PER_DOC } from '@/lib/saraban-attachment';
import { REGISTER_VIEWS } from '@/lib/saraban-doc';
import {
  SARABAN_LEVELS,
  SARABAN_REGISTERS,
  SARABAN_RESOURCE_TYPES,
  SEND_METHODS,
} from '@/types/saraban';

/**
 * วันที่ในฟอร์ม — round-trip จับวันที่ไม่มีจริง (2026-02-30) แบบ jobInputSchema บวกช่วงปี
 * ค.ศ. 1900–2100 แบบ iso-date.ts: ช่อง <input type="date"> รับปี 2569 ได้เงียบ ๆ ซึ่งเป็นวันที่
 * ที่มีจริง (ค.ศ. 2569) ผ่านการตรวจแรกไปสบาย แต่คลาดไป 543 ปี
 */
export const realDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องเป็นรูปแบบ YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'วันที่ไม่มีอยู่จริง')
  .refine((s) => {
    const year = Number(s.slice(0, 4));
    return year >= 1900 && year <= 2100;
  }, 'ปีต้องเป็น ค.ศ. — ดูเหมือนจะพิมพ์ปี พ.ศ. ลงไป');

const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);

// สิ่งที่เบราว์เซอร์ส่งมาหลังอัปตรงเข้า Cloudinary — ตัวชี้อย่างเดียว ขนาด/จำนวนหน้า
// เซิร์ฟเวอร์อ่านจาก Cloudinary เอง (checkAttachment) ไม่รับจากตรงนี้
export const fileRefSchema = z.object({
  publicId: z.string().min(1).max(300),
  resourceType: z.enum(SARABAN_RESOURCE_TYPES),
  name: z.string().trim().min(1).max(200),
});
export type FileRef = z.infer<typeof fileRefSchema>;

const filesSchema = z
  .array(fileRefSchema)
  .max(MAX_FILES_PER_DOC, `แนบได้ไม่เกิน ${MAX_FILES_PER_DOC} ไฟล์`)
  .default([]);

// id สร้างที่ client ครั้งเดียวต่อการเปิดฟอร์ม — กดซ้ำหรือเน็ตหลุดแล้วส่งใหม่ได้หนังสือเดิม
// ไม่ได้เลขที่สอง (สเปกข้อ 4 "idempotency")
export const receiveInputSchema = z.object({
  id: z.uuid(),
  ref: requiredText(100, 'ต้องระบุที่หนังสือ'),
  docDate: realDateSchema,
  party: requiredText(200, 'ต้องระบุหน่วยงานผู้ส่ง'),
  subject: requiredText(500, 'ต้องระบุเรื่อง'),
  level: z.enum(SARABAN_LEVELS).default('normal'),
  holderUnitId: z.string().min(1, 'ต้องเลือกผู้รับเสนอ').max(100),
  dueDate: realDateSchema.or(z.literal('')).default(''),
  files: filesSchema,
});
export type ReceiveInput = z.infer<typeof receiveInputSchema>;

// ไม่มีช่อง "ที่" — ระบบประกอบจาก refCode ของเจ้าของเรื่องกับเลขที่ออกให้ (composeRef)
export const sendInputSchema = z.object({
  id: z.uuid(),
  ownerUnitId: z.string().min(1, 'ต้องเลือกส่วนราชการเจ้าของเรื่อง').max(100),
  circular: z.boolean().default(false),
  docDate: realDateSchema,
  party: requiredText(200, 'ต้องระบุผู้รับหนังสือ'),
  subject: requiredText(500, 'ต้องระบุเรื่อง'),
  level: z.enum(SARABAN_LEVELS).default('normal'),
  files: filesSchema,
});
export type SendInput = z.infer<typeof sendInputSchema>;

// ช่องที่แก้ได้ทุกช่องเป็น optional — ช่องไหนแก้ได้จริงตัดสินที่ buildEdit() ตามสถานะ
const editSchema = z
  .object({
    ref: requiredText(100, 'ต้องระบุที่หนังสือ'),
    docDate: realDateSchema,
    party: requiredText(200, 'ต้องระบุหน่วยงาน'),
    subject: requiredText(500, 'ต้องระบุเรื่อง'),
    level: z.enum(SARABAN_LEVELS),
    dueDate: realDateSchema.or(z.literal('')),
    holderUnitId: z.string().min(1).max(100),
  })
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'ต้องมีอย่างน้อยหนึ่งช่อง',
  });

/**
 * PATCH /api/admin/saraban/docs/[id] — แยกตาม action (สเปกข้อ 6) แนวเดียวกับ PATCH ของ
 * ปฏิทินที่รวมการแก้กับการเปลี่ยนสถานะไว้ที่ route เดียว
 *
 * updatedAt = เวอร์ชันของหนังสือที่หน้าจอเห็นตอนกด — applyPatch เขียนได้เฉพาะเมื่อยังตรง
 * กับใน DB กันสองคนแก้/ยกเลิกเรื่องเดียวกันพร้อมกันแล้วคนหลังเขียนทับเงียบ ๆ
 */
export const docPatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('edit'), updatedAt: z.string().min(1), edit: editSchema }),
  z.object({
    action: z.literal('void'),
    updatedAt: z.string().min(1),
    reason: requiredText(500, 'ต้องระบุเหตุผลที่ยกเลิก'),
  }),
  z.object({ action: z.literal('sent'), updatedAt: z.string().min(1), method: z.enum(SEND_METHODS) }),
]);
export type DocPatch = z.infer<typeof docPatchSchema>;

// ระบบต่อ "/เลข" ท้ายรหัสเอง — รหัสที่มี '/' จะได้ "ที่" หน้าตาเพี้ยนอย่าง 'ชม 55201//388'
const refCodeSchema = z
  .string()
  .trim()
  .max(30)
  .refine((s) => !s.includes('/'), "รหัสส่วนราชการห้ามมี '/' — ระบบต่อ /เลข ให้เอง");

const unitFields = {
  name: requiredText(100, 'ต้องระบุชื่อตำแหน่ง/หน่วยงาน'),
  dept: z.string().trim().max(100),
  refCode: refCodeSchema,
  order: z.number().int(),
  isActive: z.boolean(),
};

export const unitInputSchema = z.object({
  ...unitFields,
  dept: unitFields.dept.default(''),
  refCode: unitFields.refCode.default(''),
  order: unitFields.order.default(0),
  isActive: unitFields.isActive.default(true),
});
export type UnitInput = z.infer<typeof unitInputSchema>;

export const unitPatchSchema = z
  .object(unitFields)
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'ต้องมีอย่างน้อยหนึ่งช่อง',
  });
export type UnitPatch = z.infer<typeof unitPatchSchema>;

export const yearStartSchema = z.object({
  register: z.enum(SARABAN_REGISTERS),
  fiscalYear: z.number().int().min(2500).max(2700),
  startNo: z.number().int().min(1, 'เลขเริ่มต้นต้องไม่น้อยกว่า 1').max(99999),
});
export type YearStartInput = z.infer<typeof yearStartSchema>;

// GET /api/admin/saraban/docs — ค่าจาก query string เป็นสตริงทั้งหมดจึงต้อง coerce
export const docListQuerySchema = z.object({
  register: z.enum(SARABAN_REGISTERS),
  year: z.coerce.number().int().min(2500).max(2700).optional(),
  view: z.enum(REGISTER_VIEWS).default('all'),
  page: z.coerce.number().int().min(1).default(1),
});
export type DocListQuery = z.infer<typeof docListQuerySchema>;
```

- [ ] **Step 4: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/saraban-schema.test.ts && npx tsc --noEmit -p .`
Expected: PASS — 21 tests · tsc ไม่มี output

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-schema.ts src/lib/saraban-schema.test.ts
git commit -m "feat(saraban): schema ของลงรับ ออกเลขส่ง แก้ไข สมุดผู้รับ และเลขเริ่มต้น"
```

---

## Task 9: สิทธิ์ `saraban`

**ไม่ใส่ใน `DEFAULT_FEATURES`** — สมาชิกเดิมไม่ได้สิทธิ์นี้ติดมาเงียบ ๆ (หลักเดียวกับ `forest`)
ต่อท้าย `FEATURES` สุด: `firstAllowedPath()` เลือกหน้าแรกตามลำดับนี้ ต่อท้ายไว้ สมาชิกเดิมที่ได้
สิทธิ์เพิ่มจะยังเข้าหน้าเดิมก่อน · `users.tsx` และ `user-schema.ts` อ่านจาก `FEATURES`/`FEATURE_LABELS`
อยู่แล้ว ช่องติ๊ก "ระบบสารบรรณ" ในหน้าจัดการผู้ใช้จึงขึ้นเองโดยไม่ต้องแก้

**Files:**
- Modify: `src/lib/user-access.ts:5-31`
- Test: `src/lib/user-access.test.ts` (เพิ่มท้ายไฟล์)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน — เพิ่มท้าย `src/lib/user-access.test.ts`**

```ts
describe('สิทธิ์ saraban', () => {
  it('อยู่ใน FEATURES แต่ไม่อยู่ในชุดเริ่มต้น — ผู้จัดการต้องติ๊กเปิดเอง', () => {
    expect(FEATURES).toContain('saraban');
    expect(DEFAULT_FEATURES).not.toContain('saraban');
  });

  it('สมาชิกเดิมที่ยังไม่เคยถูกตั้งค่า ไม่ได้สิทธิ์นี้ติดมาเงียบ ๆ', () => {
    const r = resolveAccess({ doc: null, clerkId: 'user_a', managerEnvId: undefined });
    expect(hasFeature({ features: r.features, isManager: false }, 'saraban')).toBe(false);
  });

  it('หน้าแรกอยู่นอก /admin เพราะสารบรรณมี shell ของตัวเอง', () => {
    expect(FEATURE_HOME.saraban).toBe('/saraban');
    expect(firstAllowedPath({ isManager: false, features: ['saraban'] })).toBe('/saraban');
  });

  it('ต่อท้ายสุด — สมาชิกที่มีทั้งปฏิทินและสารบรรณยังเข้าปฏิทินก่อนเหมือนเดิม', () => {
    expect(FEATURES.at(-1)).toBe('saraban');
    expect(firstAllowedPath({ isManager: false, features: ['calendar', 'saraban'] })).toBe(
      '/admin/calendar'
    );
  });

  it('มีป้ายภาษาไทยในหน้าจัดการผู้ใช้', () => {
    expect(FEATURE_LABELS.find((f) => f.key === 'saraban')?.label).toBe('ระบบสารบรรณ');
  });
});
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/user-access.test.ts`
Expected: FAIL — `expected [ 'links', …, 'settings' ] to include 'saraban'` (tsc ยังฟ้อง `'saraban'` ไม่อยู่ใน FeatureKey ด้วย — ปกติของขั้นนี้)

- [ ] **Step 3: แก้ `src/lib/user-access.ts`**

แทนบรรทัด `FEATURES` เดิม:

```ts
// ต่อท้ายสุดโดยตั้งใจ — firstAllowedPath() เลือกหน้าแรกตามลำดับนี้ ฟีเจอร์ใหม่ต่อท้ายไว้
// สมาชิกเดิมที่ได้สิทธิ์เพิ่มจะยังเข้าหน้าเดิมก่อนเหมือนเคย
export const FEATURES = [
  'links',
  'categories',
  'calendar',
  'map',
  'forest',
  'data',
  'settings',
  'saraban',
] as const;
```

ใน `FEATURE_HOME` เพิ่มบรรทัดสุดท้ายต่อจาก `settings: '/admin/settings',`:

```ts
  // นอก /admin — ระบบสารบรรณมี shell ของตัวเอง (สเปก 2026-09-13 ข้อ 1.3)
  saraban: '/saraban',
```

ใน `FEATURE_LABELS` เพิ่มรายการสุดท้ายต่อจาก `{ key: 'settings', label: 'ตั้งค่าเว็บ' },`:

```ts
  { key: 'saraban', label: 'ระบบสารบรรณ' },
```

- [ ] **Step 4: รันเทสต์ทั้งไฟล์ และตรวจชนิดทั้งโปรเจกต์**

Run: `npx vitest run src/lib/user-access.test.ts && npx tsc --noEmit -p .`
Expected: PASS — 18 tests (13 เดิม + 5 ใหม่) · tsc ไม่มี output (`Record<FeatureKey, string>` ของ
`FEATURE_HOME` บังคับให้ต้องเพิ่ม `saraban` ครบ ไม่งั้น tsc ฟ้อง)

- [ ] **Step 5: Commit**

```bash
git add src/lib/user-access.ts src/lib/user-access.test.ts
git commit -m "feat(saraban): สิทธิ์ saraban ที่ผู้จัดการต้องติ๊กเปิดเอง"
```

---

## Task 10: แบ็กเอนด์ไฟล์ร่วม + สมุดผู้รับ

store ไม่มีเทสต์หน่วย (repo เทสต์เฉพาะตรรกะบริสุทธิ์ ไม่มี DB ในเทสต์) — ตรวจด้วย tsc และ smoke
ผ่าน `tsx` บนแบ็กเอนด์ไฟล์ แล้วลบไฟล์ runtime ทิ้ง

**Files:**
- Create: `src/lib/saraban-file.ts`
- Create: `data/saraban-units.seed.json`
- Create: `src/lib/saraban-units-store.ts`
- Modify: `.gitignore`

- [ ] **Step 1: สร้าง `src/lib/saraban-file.ts`**

```ts
// src/lib/saraban-file.ts
// แบ็กเอนด์ไฟล์ของสารบรรณ (dev fallback เมื่อไม่มี MONGODB_URI) — ใช้ร่วมสอง store
//
// ปฏิเสธตัวเองตอน production ที่ไม่มี MONGODB_URI เหตุผลเดียวกับ jobs-store.ts:
// Railway เขียนไฟล์ได้จริงแต่ไม่คงอยู่ข้าม deploy — ทะเบียนราชการที่หายเงียบ ๆ ตอน deploy
// รอบถัดไปแย่กว่า 500 ดัง ๆ ทุกครั้งที่เรียกมาก
//
// ไม่มี lock: อ่าน-แก้-เขียนทั้งอาเรย์ สอง request ที่เขียนพร้อมกันแข่งกันได้ — ยอมรับได้
// เพราะเป็น dev fallback คนเดียวใช้ ไม่ใช่โมเดลของ production (เหมือน jobs-store)

import { promises as fs } from 'fs';
import path from 'path';
import { isMongoConfigured } from '@/lib/mongodb';

export const DATA_DIR = path.join(process.cwd(), 'data');

export function assertSarabanFileBackendAllowed(): void {
  if (process.env.NODE_ENV === 'production' && !isMongoConfigured()) {
    throw new Error(
      'ไม่ได้ตั้งค่า MONGODB_URI — ระบบสารบรรณปฏิเสธการเก็บทะเบียนลงไฟล์ในเครื่องตอน ' +
        'production เพราะ filesystem ของ hosting ส่วนใหญ่ไม่คงอยู่ข้าม deploy ' +
        'ตั้งค่า MONGODB_URI ก่อนใช้งานจริง'
    );
  }
}

/**
 * อ่านอาเรย์จากไฟล์ใน data/ — ไม่มีไฟล์ = ผลของ onMissing (ค่าเริ่มต้น [])
 * error อื่นโยนต่อเสมอ: ไฟล์ที่ถูกตัดกลางคัน (fs.writeFile ไม่ atomic) ต้องไม่กลายเป็น []
 * เงียบ ๆ แล้วถูกการเขียนครั้งถัดไปทับทั้งทะเบียน (บทเรียนเดียวกับ jobs-store fileRead)
 */
export async function readJsonArray<T>(
  file: string,
  onMissing: () => Promise<T[]> | T[] = () => []
): Promise<T[]> {
  assertSarabanFileBackendAllowed();
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), 'utf8')) as T[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return onMissing();
    throw err;
  }
}

export async function writeJsonArray<T>(file: string, rows: T[]): Promise<void> {
  assertSarabanFileBackendAllowed();
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(rows, null, 2) + '\n', 'utf8');
}
```

- [ ] **Step 2: สร้าง `data/saraban-units.seed.json`**

รายชื่อจากต้นแบบ · `refCode` ใส่เฉพาะสำนักปลัด (`ชม 55201` ปรากฏในต้นแบบสามครั้ง) กองอื่นเว้นว่าง
ไม่เดารหัสส่วนราชการ — ผังจริงรอเทศบาลยืนยัน (สเปกข้อ 12)

```json
[
  { "id": "mayor", "name": "นายกเทศมนตรี", "dept": "ผู้บริหาร", "refCode": "", "order": 10, "isActive": true, "memberClerkIds": [] },
  { "id": "palad", "name": "ปลัดเทศบาล", "dept": "ผู้บริหาร", "refCode": "", "order": 20, "isActive": true, "memberClerkIds": [] },
  { "id": "head-office", "name": "หัวหน้าสำนักปลัด", "dept": "สำนักปลัด", "refCode": "", "order": 30, "isActive": true, "memberClerkIds": [] },
  { "id": "dir-finance", "name": "ผอ.กองคลัง", "dept": "กองคลัง", "refCode": "", "order": 40, "isActive": true, "memberClerkIds": [] },
  { "id": "dir-works", "name": "ผอ.กองช่าง", "dept": "กองช่าง", "refCode": "", "order": 50, "isActive": true, "memberClerkIds": [] },
  { "id": "dir-education", "name": "ผอ.กองการศึกษา", "dept": "กองการศึกษา", "refCode": "", "order": 60, "isActive": true, "memberClerkIds": [] },
  { "id": "dir-health", "name": "ผอ.กองสาธารณสุขฯ", "dept": "กองสาธารณสุข", "refCode": "", "order": 70, "isActive": true, "memberClerkIds": [] },
  { "id": "legal", "name": "นิติกร", "dept": "สำนักปลัด", "refCode": "", "order": 80, "isActive": true, "memberClerkIds": [] },
  { "id": "head-disaster", "name": "หัวหน้าฝ่ายป้องกันฯ", "dept": "สำนักปลัด", "refCode": "", "order": 90, "isActive": true, "memberClerkIds": [] },
  { "id": "office", "name": "สำนักปลัด", "dept": "สำนักปลัด", "refCode": "ชม 55201", "order": 100, "isActive": true, "memberClerkIds": [] },
  { "id": "finance", "name": "กองคลัง", "dept": "กองคลัง", "refCode": "", "order": 110, "isActive": true, "memberClerkIds": [] },
  { "id": "works", "name": "กองช่าง", "dept": "กองช่าง", "refCode": "", "order": 120, "isActive": true, "memberClerkIds": [] },
  { "id": "education", "name": "กองการศึกษา", "dept": "กองการศึกษา", "refCode": "", "order": 130, "isActive": true, "memberClerkIds": [] },
  { "id": "health", "name": "กองสาธารณสุข", "dept": "กองสาธารณสุข", "refCode": "", "order": 140, "isActive": true, "memberClerkIds": [] }
]
```

- [ ] **Step 3: สร้าง `src/lib/saraban-units-store.ts`**

```ts
// src/lib/saraban-units-store.ts
// สมุดผู้รับของสารบรรณ (ตำแหน่ง/หน่วยงาน) — Mongo `sarabanUnits` | ไฟล์ data/saraban-units.json
//
// seed ใช้ครั้งแรกเท่านั้น (ยังว่าง) หลังจากนั้นฐานข้อมูลคือความจริง — บทเรียนเดียวกับ
// forest-registry.ts: ถ้าให้ seed เป็นความจริง วันที่เจ้าหน้าที่แก้ชื่อหรือรหัสส่วนราชการ
// ผ่านหน้าเว็บแล้วมีคนรัน seed ซ้ำ ของที่แก้จะหาย
//
// ไม่มีฟังก์ชันลบโดยตั้งใจ — หนังสืออ้าง holderUnitId อยู่ ปิดด้วย isActive แทน

import crypto from 'node:crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { Collection } from 'mongodb';
import { getDb, isMongoConfigured } from '@/lib/mongodb';
import { cacheUntilRejected } from '@/lib/promise-cache';
import { DATA_DIR, readJsonArray, writeJsonArray } from '@/lib/saraban-file';
import type { UnitInput, UnitPatch } from '@/lib/saraban-schema';
import type { SarabanUnit } from '@/types/saraban';

const COLLECTION = 'sarabanUnits';
const RUNTIME_FILE = 'saraban-units.json';
const SEED_FILE = path.join(DATA_DIR, 'saraban-units.seed.json');

async function readSeed(): Promise<SarabanUnit[]> {
  return JSON.parse(await fs.readFile(SEED_FILE, 'utf8')) as SarabanUnit[];
}

/** เรียงตามลำดับที่ตั้ง → ชื่อ → id — ไล่ถึง id ให้สองแบ็กเอนด์เรียงเหมือนกันเสมอ */
export function byUnitOrder(a: SarabanUnit, b: SarabanUnit): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'th') || a.id.localeCompare(b.id);
}

// zod .partial() ไม่ใส่คีย์ที่ไม่ได้ส่งมาอยู่แล้ว แต่กันอีกชั้น: Mongo driver serialize
// undefined ใน $set เป็น null ไม่ใช่ข้ามคีย์ (ดูคอมเมนต์ normalise() ใน config-store.ts)
function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

// ---- mongo ---------------------------------------------------------------

async function unitsCollection(): Promise<Collection<SarabanUnit>> {
  return (await getDb()).collection<SarabanUnit>(COLLECTION);
}

let seeded: Promise<void> | undefined;

/**
 * seed ครั้งเดียวต่อ process เมื่อ collection ว่าง — upsert ทีละตัวด้วย $setOnInsert บน
 * unique index ของ id สอง request แรกที่มาพร้อมกันจึงไม่ได้สมุดซ้ำสองชุด
 *
 * createUnit/updateUnit เรียกตัวนี้ก่อนด้วย: ถ้าหน่วยแรกถูกสร้างก่อนมีใครอ่านสมุด collection
 * จะไม่ว่างแล้ว seed จะไม่มีวันถูกใส่
 */
function ensureSeeded(): Promise<void> {
  return cacheUntilRejected(
    () => seeded,
    (value) => {
      seeded = value;
    },
    async () => {
      const col = await unitsCollection();
      await col.createIndex({ id: 1 }, { unique: true });
      if ((await col.countDocuments({}, { limit: 1 })) > 0) return;
      const seed = await readSeed();
      await col.bulkWrite(
        seed.map(({ id, ...rest }) => ({
          updateOne: { filter: { id }, update: { $setOnInsert: rest }, upsert: true },
        })),
        { ordered: false }
      );
    }
  );
}

// ---- file ----------------------------------------------------------------

async function fileRead(): Promise<SarabanUnit[]> {
  return readJsonArray<SarabanUnit>(RUNTIME_FILE, async () => {
    const seed = await readSeed();
    await writeJsonArray(RUNTIME_FILE, seed);
    return seed;
  });
}

// ---- public API ----------------------------------------------------------

export async function listUnits(): Promise<SarabanUnit[]> {
  if (isMongoConfigured()) {
    await ensureSeeded();
    const col = await unitsCollection();
    const units = await col.find({}, { projection: { _id: 0 } }).toArray();
    return units.sort(byUnitOrder);
  }
  return (await fileRead()).sort(byUnitOrder);
}

/** สมุดมีหลักสิบรายการ — อ่านทั้งหมดแล้วหาเอา ง่ายกว่าและได้ seed ทางเดียวกับ listUnits */
export async function getUnit(id: string): Promise<SarabanUnit | null> {
  return (await listUnits()).find((unit) => unit.id === id) ?? null;
}

export async function createUnit(input: UnitInput): Promise<SarabanUnit> {
  const unit: SarabanUnit = {
    id: crypto.randomUUID(),
    name: input.name,
    dept: input.dept,
    refCode: input.refCode,
    order: input.order,
    isActive: input.isActive,
    memberClerkIds: [],
  };
  if (isMongoConfigured()) {
    await ensureSeeded();
    // spread เพื่อไม่ให้ driver แปะ _id ลงบน object ที่คืนกลับไป (แนวเดียวกับ jobs-store)
    await (await unitsCollection()).insertOne({ ...unit });
  } else {
    const units = await fileRead();
    units.push(unit);
    await writeJsonArray(RUNTIME_FILE, units);
  }
  return unit;
}

export async function updateUnit(id: string, patch: UnitPatch): Promise<SarabanUnit | null> {
  const set = definedOnly(patch);
  if (isMongoConfigured()) {
    await ensureSeeded();
    return (await unitsCollection()).findOneAndUpdate(
      { id },
      { $set: set },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  }
  const units = await fileRead();
  const index = units.findIndex((unit) => unit.id === id);
  if (index === -1) return null;
  units[index] = { ...units[index], ...set };
  await writeJsonArray(RUNTIME_FILE, units);
  return units[index];
}
```

- [ ] **Step 4: เพิ่มท้าย `.gitignore` ต่อจากบรรทัด `/data/map-layer-versions.json`**

```gitignore
# ระบบสารบรรณ — dev fallback ของ Mongo · seed ของสมุดผู้รับ commit อยู่ที่
# data/saraban-units.seed.json
/data/saraban-docs.json
/data/saraban-units.json
/data/saraban-years.json
```

- [ ] **Step 5: ตรวจชนิด แล้ว smoke บนแบ็กเอนด์ไฟล์**

`MONGODB_URI=` (ค่าว่าง) บังคับให้ใช้แบ็กเอนด์ไฟล์ — ห้ามรัน smoke นี้กับ Mongo จริง

Run:
```bash
npx tsc --noEmit -p . && MONGODB_URI= npx tsx -e "
import { createUnit, listUnits, updateUnit } from '@/lib/saraban-units-store';
(async () => {
  const units = await listUnits();
  console.log('seeded', units.length, units[0].id, units.find((u) => u.id === 'office')?.refCode);
  const unit = await createUnit({ name: 'ทดสอบ', dept: 'สำนักปลัด', refCode: '', order: 999, isActive: true });
  const patched = await updateUnit(unit.id, { isActive: false });
  console.log('created', (await listUnits()).length, 'patched', patched?.isActive);
})();
"; rm -f data/saraban-units.json
```
Expected:
```
seeded 14 mayor ชม 55201
created 15 patched false
```

- [ ] **Step 6: ตรวจว่าไฟล์ runtime ไม่หลุดเข้า git แล้ว commit**

Run: `git status --short`
Expected: เห็นเฉพาะ `.gitignore`, `data/saraban-units.seed.json`, `src/lib/saraban-file.ts`,
`src/lib/saraban-units-store.ts` — ไม่มี `data/saraban-units.json`

```bash
git add .gitignore data/saraban-units.seed.json src/lib/saraban-file.ts src/lib/saraban-units-store.ts
git commit -m "feat(saraban): สมุดผู้รับพร้อม seed ครั้งแรก และแบ็กเอนด์ไฟล์ที่ปฏิเสธ production"
```

---

## Task 11: `saraban-store.ts` (ส่วนที่ 1) — ออกเลขแบบลองใหม่เมื่อชน

สเปกข้อ 4 "ออกเลข: max+1 ชน unique index" — แยกการลองใหม่เป็นฟังก์ชันที่รับ `attempt` เข้ามา
เพื่อพิสูจน์พฤติกรรมได้โดยไม่ต้องมี Mongo · ส่วน I/O ของไฟล์นี้เพิ่มใน Task 12

Mongo driver ใส่ `code: 11000` และ `keyPattern` (ชื่อฟิลด์ของ index ที่ชน) ไว้บน error ของ
duplicate key — ใช้แยกว่า "เลขชน" (ลองเลขถัดไป) กับ "id ชน" (ส่งซ้ำ → idempotency) ออกจากกัน
แบบเดียวกับที่ `signups-store.ts` เช็ค `code === 11000`

**Files:**
- Create: `src/lib/saraban-store.ts`
- Test: `src/lib/saraban-store.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
// src/lib/saraban-store.test.ts
import { describe, expect, it } from 'vitest';
import {
  duplicateKeyOf,
  issueWithRetry,
  MAX_NUMBER_ATTEMPTS,
  NumberBusyError,
} from '@/lib/saraban-store';

// หน้าตาของ error ที่ Mongo driver โยนเมื่อชน unique index
function dupError(keyPattern: Record<string, number>) {
  return Object.assign(new Error('E11000 duplicate key error'), { code: 11000, keyPattern });
}

const noClash = () => dupError({ register: 1, fiscalYear: 1, no: 1 });
const isNoClash = (err: unknown) => duplicateKeyOf(err) === 'no';

describe('duplicateKeyOf', () => {
  it('ชน index เลขทะเบียน → no', () => {
    expect(duplicateKeyOf(noClash())).toBe('no');
  });

  it('ชน index id → id (ส่งซ้ำ)', () => {
    expect(duplicateKeyOf(dupError({ id: 1 }))).toBe('id');
  });

  it('error อื่น หรือ duplicate key ที่ไม่บอก keyPattern → null ให้ผู้เรียกโยนต่อ', () => {
    expect(duplicateKeyOf(new Error('boom'))).toBeNull();
    expect(duplicateKeyOf({ code: 11000 })).toBeNull();
    expect(duplicateKeyOf(null)).toBeNull();
  });
});

describe('issueWithRetry', () => {
  it('สำเร็จครั้งแรกก็จบ', async () => {
    let calls = 0;
    const result = await issueWithRetry(async () => {
      calls += 1;
      return 'ok';
    }, isNoClash);
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('เลขชนสองครั้งแล้วสำเร็จ → ได้ผลของครั้งที่สาม', async () => {
    let calls = 0;
    const result = await issueWithRetry(async () => {
      calls += 1;
      if (calls < 3) throw noClash();
      return calls;
    }, isNoClash);
    expect(result).toBe(3);
  });

  it('error ที่ไม่ใช่เลขชนโยนต่อทันที ไม่ลองใหม่', async () => {
    let calls = 0;
    await expect(
      issueWithRetry(async () => {
        calls += 1;
        throw new Error('mongo down');
      }, isNoClash)
    ).rejects.toThrow('mongo down');
    expect(calls).toBe(1);
  });

  it('id ชน (ส่งซ้ำ) ไม่ใช่เลขชน — โยนต่อให้ผู้เรียกจัดการ idempotency ไม่ใช่ออกเลขใหม่', async () => {
    let calls = 0;
    await expect(
      issueWithRetry(async () => {
        calls += 1;
        throw dupError({ id: 1 });
      }, isNoClash)
    ).rejects.toMatchObject({ code: 11000 });
    expect(calls).toBe(1);
  });

  it('ชนครบเพดานแล้วยอมแพ้ด้วย NumberBusyError — ลอง 5 ครั้งพอดี ไม่ขาดไม่เกิน', async () => {
    let calls = 0;
    await expect(
      issueWithRetry(async () => {
        calls += 1;
        throw noClash();
      }, isNoClash)
    ).rejects.toBeInstanceOf(NumberBusyError);
    expect(MAX_NUMBER_ATTEMPTS).toBe(5);
    expect(calls).toBe(MAX_NUMBER_ATTEMPTS);
  });
});
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/saraban-store.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/saraban-store"`

- [ ] **Step 3: เขียนโค้ด**

```ts
// src/lib/saraban-store.ts
// หนังสือของสารบรรณ — Mongo `sarabanDocs` + `sarabanYears` | ไฟล์ใน data/ (สเปกข้อ 3–4)
//
// ส่วนบนเป็นฟังก์ชันบริสุทธิ์ของการออกเลข แยกไว้ให้เทสต์ได้โดยไม่ต้องมี Mongo (repo ไม่มี DB
// ในเทสต์) ส่วน I/O อยู่ถัดลงไป

export const MAX_NUMBER_ATTEMPTS = 5;

/** ออกเลขชนครบเพดาน — route ตอบ 503 number_busy ให้ผู้ใช้กดใหม่ */
export class NumberBusyError extends Error {
  constructor() {
    super('number_busy');
    this.name = 'NumberBusyError';
  }
}

/**
 * index ไหนทำให้ insert ชน
 *   'no'  = เลขทะเบียนชน (อีกคนได้เลขนี้ไปก่อน) → ลองเลขถัดไป
 *   'id'  = id ชน (คำขอเดิมถูกส่งซ้ำ) → idempotency ไม่ใช่ออกเลขใหม่
 *   null  = ไม่ใช่ duplicate key หรือบอกไม่ได้ว่าชนตัวไหน → ผู้เรียกโยนต่อ (500 ดัง ๆ)
 */
export function duplicateKeyOf(err: unknown): 'no' | 'id' | null {
  const e = err as { code?: unknown; keyPattern?: Record<string, unknown> } | null;
  if (e?.code !== 11000 || !e.keyPattern) return null;
  if ('no' in e.keyPattern) return 'no';
  if ('id' in e.keyPattern) return 'id';
  return null;
}

/**
 * ลอง attempt จนสำเร็จ ลองใหม่เฉพาะเมื่อ isCollision บอกว่าชน ครบ max ครั้งแล้วโยน
 * NumberBusyError — attempt ต้องอ่าน max(no) ใหม่ทุกครั้ง ไม่งั้นลองกี่รอบก็ชนเลขเดิม
 *
 * ทำไมไม่ใช้ตัวนับ $inc: ถ้า $inc สำเร็จแต่ insert ล้ม เลขหายหนึ่งเลข ทะเบียนมีรูที่ดูเหมือน
 * หนังสือถูกลบ และ repo ไม่มี transaction — แบบนี้ถ้า insert ล้ม เลขนั้นยังไม่เคยถูกใช้
 */
export async function issueWithRetry<T>(
  attempt: () => Promise<T>,
  isCollision: (err: unknown) => boolean,
  max: number = MAX_NUMBER_ATTEMPTS
): Promise<T> {
  for (let tries = 1; ; tries += 1) {
    try {
      return await attempt();
    } catch (err) {
      if (!isCollision(err)) throw err;
      if (tries >= max) throw new NumberBusyError();
    }
  }
}
```

- [ ] **Step 4: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/saraban-store.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-store.ts src/lib/saraban-store.test.ts
git commit -m "feat(saraban): ออกเลขแบบลองใหม่เมื่อชน แยกเลขชนจากการส่งซ้ำ"
```

---

## Task 12: `saraban-store.ts` (ส่วนที่ 2) — อ่าน/เขียนหนังสือและเลขเริ่มต้น

ทุกฟังก์ชันมีสองแบ็กเอนด์ (Mongo | ไฟล์) แบบ `jobs-store.ts` — **จุดเดียวที่ตั้งใจต่าง:**
`ensureIndexes()` ห้ามกลืน error เพราะ unique index บน `(register, fiscalYear, no)` คือสิ่งเดียว
ที่ทำให้เลขซ้ำเป็นไปไม่ได้ (สเปกข้อ 4)

ชนิดของ update ทุกตัวในไฟล์นี้ (`$push` สองฟิลด์ · `$pull` · `$expr` · `findOneAndUpdate` +
`projection`) ตรวจกับ Mongo driver 7 ของ repo แล้วว่า tsc ผ่านโดยไม่ต้อง cast

**Files:**
- Modify: `src/lib/saraban-store.ts` (เพิ่ม import ใต้คอมเมนต์หัวไฟล์ + เพิ่มท้ายไฟล์)

- [ ] **Step 1: เพิ่ม import ใต้คอมเมนต์หัวไฟล์ (ก่อน `export const MAX_NUMBER_ATTEMPTS`)**

```ts
import crypto from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { getDb, isMongoConfigured } from '@/lib/mongodb';
import { cacheUntilRejected } from '@/lib/promise-cache';
import { MAX_FILES_PER_DOC } from '@/lib/saraban-attachment';
import {
  buildNewDoc,
  canAddFile,
  canRemoveFile,
  matches,
  REGISTER_VIEWS,
  toMongoQuery,
  type Actor,
  type DocFilter,
  type EditableField,
  type NewDocFields,
  type RegisterView,
} from '@/lib/saraban-doc';
import { readJsonArray, writeJsonArray } from '@/lib/saraban-file';
import { bangkokDateOf, fiscalYearOf, nextNo } from '@/lib/saraban-number';
import type {
  SarabanDoc,
  SarabanEvent,
  SarabanFile,
  SarabanRegister,
  SarabanYear,
} from '@/types/saraban';
```

- [ ] **Step 2: เพิ่มท้ายไฟล์ — ที่เก็บ, index และการอ่าน**

```ts
// ---- ที่เก็บ --------------------------------------------------------------

const DOCS = 'sarabanDocs';
const YEARS = 'sarabanYears';
const DOCS_FILE = 'saraban-docs.json';
const YEARS_FILE = 'saraban-years.json';
export const PAGE_SIZE = 50;

type YearRow = SarabanYear & { _id: string };

function yearKey(register: SarabanRegister, fiscalYear: number): string {
  return `${register}-${fiscalYear}`;
}

async function docsCollection(): Promise<Collection<SarabanDoc>> {
  return (await getDb()).collection<SarabanDoc>(DOCS);
}

async function yearsCollection(): Promise<Collection<YearRow>> {
  return (await getDb()).collection<YearRow>(YEARS);
}

async function readDocs(): Promise<SarabanDoc[]> {
  return readJsonArray<SarabanDoc>(DOCS_FILE);
}

/** ใหม่สุดก่อน — ปีงบมากไปน้อย แล้วเลขมากไปน้อย (คู่นี้ไม่ซ้ำภายในทะเบียนเดียว = total order) */
export function byNewest(a: SarabanDoc, b: SarabanDoc): number {
  return b.fiscalYear - a.fiscalYear || b.no - a.no;
}

let indexes: Promise<void> | undefined;

/**
 * index ของหนังสือ — ต่างจาก jobs-store โดยตั้งใจ: ที่นั่นกลืน error ของ createIndexes แล้ว
 * ทำงานต่อ ที่นี่ห้าม เพราะ unique index บน (register, fiscalYear, no) คือสิ่งเดียวที่ทำให้
 * เลขทะเบียนซ้ำเป็นไปไม่ได้ ถ้าสร้างไม่สำเร็จแล้วยังออกเลขต่อ สองคนที่ลงรับพร้อมกันจะได้
 * เลขเดียวกันโดยไม่มีอะไรเตือน — createDoc จึง await ตัวนี้แล้วล้มตาม (500)
 *
 * cacheUntilRejected: สำเร็จแล้วไม่สร้างซ้ำ ล้มแล้วคำขอถัดไปลองใหม่ ไม่ค้าง rejected ไว้
 * ตลอดอายุ process · อ่านทะเบียนไม่ต้องรอ index (ดูทะเบียนได้แม้ออกเลขไม่ได้)
 */
function ensureIndexes(): Promise<void> {
  return cacheUntilRejected(
    () => indexes,
    (value) => {
      indexes = value;
    },
    async () => {
      const col = await docsCollection();
      await col.createIndexes([
        { key: { register: 1, fiscalYear: 1, no: 1 }, unique: true, name: 'register_year_no_unique' },
        { key: { id: 1 }, unique: true, name: 'id_unique' },
        { key: { register: 1, fiscalYear: 1, status: 1, dueDate: 1 } },
      ]);
    }
  );
}

// ---- อ่าน ------------------------------------------------------------------

export async function getDoc(id: string): Promise<SarabanDoc | null> {
  if (isMongoConfigured()) {
    return (await docsCollection()).findOne({ id }, { projection: { _id: 0 } });
  }
  return (await readDocs()).find((doc) => doc.id === id) ?? null;
}

export async function listDocs(
  filter: DocFilter,
  page: number,
  today: string
): Promise<{ docs: SarabanDoc[]; total: number }> {
  const skip = (page - 1) * PAGE_SIZE;
  if (isMongoConfigured()) {
    const col = await docsCollection();
    const query = toMongoQuery(filter, today) as Filter<SarabanDoc>;
    const [docs, total] = await Promise.all([
      col
        .find(query, { projection: { _id: 0 } })
        .sort({ fiscalYear: -1, no: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .toArray(),
      col.countDocuments(query),
    ]);
    return { docs, total };
  }
  const all = (await readDocs()).filter((doc) => matches(doc, filter, today)).sort(byNewest);
  return { docs: all.slice(skip, skip + PAGE_SIZE), total: all.length };
}

/** นับอย่างเดียว ไม่ดึงตัวหนังสือออกมา — badge เรียกจากทุกหน้า (แนว countJobs) */
export async function countDocs(filter: DocFilter, today: string): Promise<number> {
  if (isMongoConfigured()) {
    return (await docsCollection()).countDocuments(
      toMongoQuery(filter, today) as Filter<SarabanDoc>
    );
  }
  return (await readDocs()).filter((doc) => matches(doc, filter, today)).length;
}

/** ตัวเลขบนปุ่มกรองทุกปุ่มของทะเบียน + ปีงบหนึ่ง */
export async function registerCounts(
  register: SarabanRegister,
  fiscalYear: number,
  today: string
): Promise<Record<RegisterView, number>> {
  const counts = await Promise.all(
    REGISTER_VIEWS.map((view) => countDocs({ register, fiscalYear, view }, today))
  );
  return Object.fromEntries(REGISTER_VIEWS.map((view, i) => [view, counts[i]])) as Record<
    RegisterView,
    number
  >;
}

/** ปีงบที่มีหนังสือของทะเบียนนี้ + ปีปัจจุบันเสมอ (ปีใหม่ที่ยังว่างต้องเลือกได้) — มากไปน้อย */
export async function listFiscalYears(
  register: SarabanRegister,
  currentYear: number
): Promise<number[]> {
  const years = isMongoConfigured()
    ? await (await docsCollection()).distinct('fiscalYear', { register })
    : (await readDocs()).filter((doc) => doc.register === register).map((doc) => doc.fiscalYear);
  return [...new Set([...years, currentYear])].sort((a, b) => b - a);
}
```

- [ ] **Step 3: เพิ่มท้ายไฟล์ — เลขเริ่มต้นและข้อมูลของปี**

```ts
// ---- เลขเริ่มต้นและข้อมูลของปี ---------------------------------------------

async function maxNoOf(register: SarabanRegister, fiscalYear: number): Promise<number | null> {
  if (isMongoConfigured()) {
    // ใช้ unique index (register, fiscalYear, no) ตัวเดียวกับที่กันเลขซ้ำ — ไม่ต้องสแกนทั้งปี
    const top = await (await docsCollection())
      .find({ register, fiscalYear }, { projection: { no: 1, _id: 0 } })
      .sort({ no: -1 })
      .limit(1)
      .next();
    return top?.no ?? null;
  }
  const nos = (await readDocs())
    .filter((doc) => doc.register === register && doc.fiscalYear === fiscalYear)
    .map((doc) => doc.no);
  return nos.length > 0 ? Math.max(...nos) : null;
}

async function startNoOf(register: SarabanRegister, fiscalYear: number): Promise<number | null> {
  if (isMongoConfigured()) {
    const row = await (await yearsCollection()).findOne({ _id: yearKey(register, fiscalYear) });
    return row?.startNo ?? null;
  }
  const rows = await readJsonArray<SarabanYear>(YEARS_FILE);
  return rows.find((r) => r.register === register && r.fiscalYear === fiscalYear)?.startNo ?? null;
}

export type YearInfo = {
  register: SarabanRegister;
  fiscalYear: number;
  count: number;
  startNo: number | null;
  nextNo: number;
};

/** สถานะของปี — หน้าลงรับใช้แสดง "เลขรับถัดไป" (เป็นการคาดเดา ดูสเปกข้อ 6) และตัดสินว่า
 *  จะแสดงลิงก์ตั้งเลขเริ่มต้นไหม (count === 0) */
export async function getYearInfo(register: SarabanRegister, fiscalYear: number): Promise<YearInfo> {
  const [count, max, startNo] = await Promise.all([
    countDocs({ register, fiscalYear }, bangkokDateOf(new Date())),
    maxNoOf(register, fiscalYear),
    startNoOf(register, fiscalYear),
  ]);
  return { register, fiscalYear, count, startNo, nextNo: nextNo(max, startNo) };
}

/**
 * ตั้งเลขเริ่มต้นของปี — ได้เฉพาะเมื่อปีนั้นยังไม่มีหนังสือเลย (สเปกข้อ 4)
 *
 * เช็คแล้วค่อยเขียน ไม่ atomic — ถ้ามีคนลงรับแทรกระหว่างสองขั้น startNo จะถูกบันทึกหลังปีนั้น
 * มีหนังสือแล้ว แต่ไม่เสียหาย: nextNo() ใช้ startNo เฉพาะตอนปีนั้นยังว่าง มีหนังสือแล้วใช้ max+1
 */
export async function setStartNo(
  register: SarabanRegister,
  fiscalYear: number,
  startNo: number,
  actor: Actor
): Promise<'ok' | 'year_in_use'> {
  const info = await getYearInfo(register, fiscalYear);
  if (info.count > 0) return 'year_in_use';
  const row: SarabanYear = {
    register,
    fiscalYear,
    startNo,
    setAt: new Date().toISOString(),
    setBy: actor.id,
  };
  if (isMongoConfigured()) {
    await (await yearsCollection()).updateOne(
      { _id: yearKey(register, fiscalYear) },
      { $set: row },
      { upsert: true }
    );
  } else {
    const rows = (await readJsonArray<SarabanYear>(YEARS_FILE)).filter(
      (r) => !(r.register === register && r.fiscalYear === fiscalYear)
    );
    rows.push(row);
    await writeJsonArray(YEARS_FILE, rows);
  }
  return 'ok';
}
```

- [ ] **Step 4: เพิ่มท้ายไฟล์ — ลงรับ/ออกเลข**

```ts
// ---- ลงรับ / ออกเลข --------------------------------------------------------

export type CreateDocArgs = {
  id: string; // uuid จาก client — idempotency key
  fields: NewDocFields;
  /** ส่ง/เวียน: ประกอบ "ที่" จากเลข ถูกเรียกใหม่ทุกครั้งที่ลองเลขใหม่ · รับ: ไม่ใส่ ใช้ fields.ref */
  refFor?: (no: number) => string;
  files: SarabanFile[]; // ผ่าน checkAttachment มาแล้ว
  actor: Actor;
  eventNote: string;
};

export type CreateDocResult =
  | { ok: true; doc: SarabanDoc; created: boolean }
  | { ok: false; error: 'id_conflict' | 'number_busy' };

/** id นี้เคยถูกใช้แล้ว: คนเดิม = คืนหนังสือเดิม · คนอื่น = id_conflict · ยังไม่มี = null */
async function replayOf(id: string, actor: Actor): Promise<CreateDocResult | null> {
  const existing = await getDoc(id);
  if (!existing) return null;
  return existing.registeredBy === actor.id
    ? { ok: true, doc: existing, created: false }
    : { ok: false, error: 'id_conflict' };
}

/**
 * ออกเลขและบันทึกหนังสือใหม่ (สเปกข้อ 4)
 * 1. idempotency: id เดิมของคนเดิม → คืนหนังสือเดิม ไม่ออกเลขที่สอง
 * 2. ปีงบคิดจากวันที่ลงรับตามเวลากรุงเทพฯ ไม่ใช่ docDate
 * 3. max+1 (หรือเลขเริ่มต้นถ้าปีนั้นยังว่าง) แล้ว insert — ชน unique index ก็ลองเลขถัดไป
 */
export async function createDoc(args: CreateDocArgs): Promise<CreateDocResult> {
  const replay = await replayOf(args.id, args.actor);
  if (replay) return replay;

  const now = new Date();
  const fiscalYear = fiscalYearOf(bangkokDateOf(now));
  const { register } = args.fields;

  const build = (no: number): SarabanDoc =>
    buildNewDoc(
      { ...args.fields, ref: args.refFor ? args.refFor(no) : args.fields.ref },
      {
        id: args.id,
        fiscalYear,
        no,
        files: args.files,
        actor: args.actor,
        now: now.toISOString(),
        eventId: crypto.randomUUID(),
        eventNote: args.eventNote,
      }
    );

  const pickNo = async (): Promise<number> => {
    const max = await maxNoOf(register, fiscalYear);
    return nextNo(max, max === null ? await startNoOf(register, fiscalYear) : null);
  };

  try {
    if (isMongoConfigured()) {
      await ensureIndexes(); // ล้ม = ไม่ออกเลข (ดูคอมเมนต์ ensureIndexes)
      const col = await docsCollection();
      const doc = await issueWithRetry(
        async () => {
          const candidate = build(await pickNo());
          // spread เพื่อไม่ให้ driver แปะ _id ลงบน object ที่คืนกลับไป
          await col.insertOne({ ...candidate });
          return candidate;
        },
        (err) => duplicateKeyOf(err) === 'no'
      );
      return { ok: true, doc, created: true };
    }
    // แบ็กเอนด์ไฟล์: อ่าน-แก้-เขียน ไม่มี lock (dev คนเดียว ดู saraban-file.ts)
    const doc = build(await pickNo());
    const docs = await readDocs();
    docs.push(doc);
    await writeJsonArray(DOCS_FILE, docs);
    return { ok: true, doc, created: true };
  } catch (err) {
    if (err instanceof NumberBusyError) return { ok: false, error: 'number_busy' };
    // สองคำขอของ id เดียวกันผ่าน replayOf มาพร้อมกัน — ตัวที่สองชน id_unique ตอน insert
    if (duplicateKeyOf(err) === 'id') {
      const late = await replayOf(args.id, args.actor);
      if (late) return late;
    }
    throw err;
  }
}
```

- [ ] **Step 5: เพิ่มท้ายไฟล์ — แก้ไข/เปลี่ยนสถานะ และไฟล์แนบ**

```ts
// ---- แก้ไข / เปลี่ยนสถานะ / ไฟล์แนบ ----------------------------------------

/** ช่องที่ applyPatch เขียนได้ — ผลของ buildEdit() หรือ Transition.set เท่านั้น */
export type DocSet = Partial<Pick<SarabanDoc, EditableField | 'status' | 'voidReason' | 'sendMethod'>>;

/**
 * เขียน set + ต่อ event หนึ่งตัว เฉพาะเมื่อ updatedAt ใน DB ยังตรงกับที่หน้าจอเห็น
 * (optimistic concurrency) — event.at กลายเป็น updatedAt ใหม่
 * คืน null เมื่อไม่พบหรือมีคนแก้ไปก่อน ผู้เรียกแยกสองกรณีด้วย getDoc (404 vs 409)
 */
export async function applyPatch(
  id: string,
  expectedUpdatedAt: string,
  set: DocSet,
  event: SarabanEvent
): Promise<SarabanDoc | null> {
  if (isMongoConfigured()) {
    return (await docsCollection()).findOneAndUpdate(
      { id, updatedAt: expectedUpdatedAt },
      { $set: { ...set, updatedAt: event.at }, $push: { events: event } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  }
  const docs = await readDocs();
  const index = docs.findIndex((doc) => doc.id === id && doc.updatedAt === expectedUpdatedAt);
  if (index === -1) return null;
  docs[index] = {
    ...docs[index],
    ...set,
    updatedAt: event.at,
    events: [...docs[index].events, event],
  };
  await writeJsonArray(DOCS_FILE, docs);
  return docs[index];
}

/**
 * ต่อไฟล์แนบ — เงื่อนไข "ยังไม่ยกเลิก" (canAddFile) และ "ยังไม่ครบเพดาน" อยู่ใน filter ของ
 * update เดียว ($expr นับขนาดอาร์เรย์) ไม่ใช่อ่านมานับแล้วค่อยเขียน สองคนแนบพร้อมกันจึงไม่
 * ทะลุเพดาน · คืน null = ไม่พบ ยกเลิกแล้ว หรือครบเพดาน
 */
export async function addFile(
  id: string,
  file: SarabanFile,
  event: SarabanEvent
): Promise<SarabanDoc | null> {
  if (isMongoConfigured()) {
    return (await docsCollection()).findOneAndUpdate(
      { id, status: { $ne: 'void' }, $expr: { $lt: [{ $size: '$files' }, MAX_FILES_PER_DOC] } },
      { $push: { files: file, events: event }, $set: { updatedAt: event.at } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  }
  const docs = await readDocs();
  const index = docs.findIndex(
    (doc) => doc.id === id && canAddFile(doc) && doc.files.length < MAX_FILES_PER_DOC
  );
  if (index === -1) return null;
  docs[index] = {
    ...docs[index],
    files: [...docs[index].files, file],
    events: [...docs[index].events, event],
    updatedAt: event.at,
  };
  await writeJsonArray(DOCS_FILE, docs);
  return docs[index];
}

/**
 * เอาไฟล์แนบออกจากหนังสือ — เฉพาะหนังสือที่ยังเปิดอยู่ (canRemoveFile)
 * การลบไฟล์บน Cloudinary เป็นหน้าที่ของ route **หลัง** คำสั่งนี้สำเร็จเท่านั้น: ถ้าลบบน
 * Cloudinary ก่อนแล้วตรงนี้ล้ม DB จะชี้ไปหาไฟล์ที่ไม่มีแล้ว (ลบทีหลังแล้วพลาด = ไฟล์กำพร้า
 * หนึ่งไฟล์ ซึ่งเสียหายน้อยกว่า)
 */
export async function removeFile(
  id: string,
  fileId: string,
  event: SarabanEvent
): Promise<SarabanDoc | null> {
  if (isMongoConfigured()) {
    return (await docsCollection()).findOneAndUpdate(
      { id, status: { $in: ['pending', 'in-progress'] }, 'files.id': fileId },
      { $pull: { files: { id: fileId } }, $push: { events: event }, $set: { updatedAt: event.at } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  }
  const docs = await readDocs();
  const index = docs.findIndex(
    (doc) => doc.id === id && canRemoveFile(doc) && doc.files.some((f) => f.id === fileId)
  );
  if (index === -1) return null;
  docs[index] = {
    ...docs[index],
    files: docs[index].files.filter((f) => f.id !== fileId),
    events: [...docs[index].events, event],
    updatedAt: event.at,
  };
  await writeJsonArray(DOCS_FILE, docs);
  return docs[index];
}
```

- [ ] **Step 6: ตรวจชนิด และเทสต์เดิมของไฟล์นี้ยังผ่าน**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/saraban-store.test.ts`
Expected: tsc ไม่มี output · PASS — 8 tests

- [ ] **Step 7: Commit**

```bash
git add src/lib/saraban-store.ts
git commit -m "feat(saraban): store ของหนังสือ ออกเลขแบบ idempotent และกันการเขียนทับกัน"
```

---

## Task 13: smoke ของ store บนแบ็กเอนด์ไฟล์ + ตรวจทั้งโปรเจกต์

smoke ครอบทางที่เทสต์หน่วยแตะไม่ถึง: เลขรันต่อกัน · ส่งซ้ำได้หนังสือเดิม · คนอื่นใช้ id ซ้ำ ·
เลขเริ่มต้นตั้งได้เฉพาะปีว่าง · "ที่" ของหนังสือเวียน · กันการเขียนทับ · ตัวเลขบนปุ่มกรอง

ทางของ Mongo (E11000 → ลองใหม่, `$expr`, `$pull`) ถูกพิสูจน์ด้วยเทสต์หน่วยของ `issueWithRetry`/
`duplicateKeyOf` บวก tsc — **ห้ามรัน smoke นี้กับ Mongo จริง** (`MONGODB_URI=` ค่าว่างบังคับใช้ไฟล์)

**Files:** ไม่มีไฟล์ใหม่ — ไฟล์ runtime ที่ smoke สร้างถูกลบในคำสั่งเดียวกัน

- [ ] **Step 1: smoke**

Run:
```bash
rm -f data/saraban-docs.json data/saraban-years.json
MONGODB_URI= npx tsx -e "
import { randomUUID } from 'node:crypto';
import { makeEvent } from '@/lib/saraban-doc';
import { bangkokDateOf, composeRef, fiscalYearOf } from '@/lib/saraban-number';
import { applyPatch, createDoc, getYearInfo, listDocs, registerCounts, setStartNo } from '@/lib/saraban-store';
(async () => {
  const actor = { id: 'user_a', name: 'ทดสอบ' };
  const today = bangkokDateOf(new Date());
  const fy = fiscalYearOf(today);
  const fields = { register: 'in' as const, ref: 'ชม 1/1', docDate: '2026-09-01', party: 'อำเภอหางดง',
    subject: 'ทดสอบ', level: 'normal' as const, dueDate: '', holderUnitId: 'palad' };
  const idA = randomUUID();
  const a = await createDoc({ id: idA, fields, files: [], actor, eventNote: 'ลงรับ' });
  const b = await createDoc({ id: randomUUID(), fields, files: [], actor, eventNote: 'ลงรับ' });
  const again = await createDoc({ id: idA, fields, files: [], actor, eventNote: 'ลงรับ' });
  const stranger = await createDoc({ id: idA, fields, files: [], actor: { id: 'user_b', name: 'อื่น' }, eventNote: 'ลงรับ' });
  console.log('fy', fy);
  console.log('numbers', a.ok && a.doc.no, b.ok && b.doc.no, 'replay', again.ok && again.created, again.ok && again.doc.no, 'stranger', !stranger.ok && stranger.error);
  console.log('start on used year', await setStartNo('in', fy, 500, actor));
  console.log('start on empty year', await setStartNo('circular', fy, 12, actor));
  const circ = await createDoc({ id: randomUUID(), fields: { ...fields, register: 'circular', ref: '', holderUnitId: 'office' },
    refFor: (no) => composeRef('ชม 55201', 'circular', no), files: [], actor, eventNote: 'ออกเลข' });
  console.log('circular', circ.ok && circ.doc.no, circ.ok && circ.doc.ref, circ.ok && circ.doc.status);
  if (!a.ok) throw new Error('a failed');
  const edited = () => makeEvent({ id: randomUUID(), at: new Date().toISOString(), actor, kind: 'edited' });
  const stale = await applyPatch(a.doc.id, 'not-the-version', { subject: 'x' }, edited());
  const fresh = await applyPatch(a.doc.id, a.doc.updatedAt, { subject: 'แก้แล้ว' }, edited());
  console.log('stale', stale, 'fresh', fresh?.subject, fresh?.events.length);
  console.log('counts', JSON.stringify(await registerCounts('in', fy, today)));
  console.log('list', (await listDocs({ register: 'in', fiscalYear: fy }, 1, today)).docs.map((d) => d.no).join(','));
  const year = await getYearInfo('in', fy);
  console.log('year', year.count, year.startNo, year.nextNo);
})();
"; rm -f data/saraban-docs.json data/saraban-years.json data/saraban-units.json
```

Expected (บรรทัด `fy` เป็นปีงบ ณ วันที่รัน — 2569 ถ้ารันก่อน 1 ต.ค. 2569):
```
fy 2569
numbers 1 2 replay false 1 stranger id_conflict
start on used year year_in_use
start on empty year ok
circular 12 ชม 55201/ว 12 in-progress
stale null fresh แก้แล้ว 2
counts {"all":2,"pending":2,"in-progress":0,"done":0,"void":0,"overdue":0}
list 2,1
year 2 null 3
```

ถ้าบรรทัดไหนไม่ตรง — หยุด แก้ที่ store หรือฟังก์ชันบริสุทธิ์ที่เกี่ยวข้อง แล้วรันใหม่ อย่าแก้ค่าที่
คาดไว้ให้ตรงกับผลที่ได้

- [ ] **Step 2: เทสต์ทั้งหมด**

Run: `npm test`
Expected: `Test Files  34 passed (34)` · `Tests  491 passed (491)`
(baseline 28/368 + ไฟล์ใหม่ 6 ไฟล์: number 15 · labels 6 · doc 58 · attachment 10 · schema 21 ·
store 8 · และ user-access +5)

- [ ] **Step 3: ชนิดและ lint**

Run: `npx tsc --noEmit -p . && npm run lint`
Expected: tsc ไม่มี output · eslint ไม่มี problem (baseline หลัง `bfb6a0b` สะอาด 0 problem)

- [ ] **Step 4: ไม่มีไฟล์ค้าง**

Run: `git status --short`
Expected: ไม่มี output — ไม่มี `data/saraban-*.json` ค้าง และทุก Task commit ครบแล้ว

---

## ส่งต่อรอบ 1B

รอบ 1B (API + Cloudinary + proxy) ใช้ของจากรอบนี้ตามตาราง — ชื่อฟังก์ชันและชนิดข้างล่างคือสัญญา
ถ้ารอบนี้ต้องเปลี่ยนตอนรีวิว ให้แก้ตารางนี้ด้วย

| ใช้ทำอะไรใน 1B | จากรอบนี้ |
|---|---|
| ตรวจ body/query | `receiveInputSchema` · `sendInputSchema` · `docPatchSchema` · `docListQuerySchema` · `unitInputSchema` · `unitPatchSchema` · `yearStartSchema` |
| ทะเบียน + ปุ่มกรอง + badge + แถบค้างข้ามปี | `listDocs` · `registerCounts` · `countDocs({ statusIn })` · `listFiscalYears` · `PAGE_SIZE` |
| ลงรับ / ออกเลข | `createDoc` (+ `composeRef` สำหรับ `refFor`) → `CreateDocResult` แปลงเป็น 201 / 200 (ส่งซ้ำ) / 409 `id_conflict` / 503 `number_busy` |
| แก้ไข / ยกเลิก / ส่งแล้ว | `buildEdit` · `voidTransition` · `sentTransition` · `makeEvent` · `applyPatch` (null + `getDoc` เจอ = 409 `stale` · ไม่เจอ = 404) |
| ไฟล์แนบ | `checkAttachment` · `SARABAN_FOLDER` · `MAX_FILES_PER_DOC` · `addFile` · `removeFile` · `canAddFile` · `canRemoveFile` |
| เลขเริ่มต้น | `getYearInfo` · `setStartNo` |
| สมุดผู้รับ | `listUnits` · `getUnit` · `createUnit` · `updateUnit` |

**สิ่งที่ 1B ต้องทำเองเพราะรอบนี้ตั้งใจไม่ทำ**
- ชื่อผู้ทำ (`Actor.name`) — อ่านจากทะเบียนผู้ใช้แบบ `/api/admin/me` (ไม่มี → อีเมล → clerkId)
- ตรวจหน่วย: `holderUnitId` ต้องมีและ active · ออกเลขส่งต้องใช้หน่วยที่มี `refCode` → `400 invalid_unit`
- ถาม Cloudinary ก่อน `checkAttachment` และลบไฟล์ของ request ที่ล้ม · ลบไฟล์บน Cloudinary หลัง
  `removeFile` สำเร็จเท่านั้น
- **เรียก `cloudinary.api.resource()` ต้องส่ง `pages: true`** — Admin API คืนจำนวนหน้าเฉพาะเมื่อขอ
  (ตัวเลือก `pages?: boolean` ใน `node_modules/cloudinary/types/index.d.ts`) ถ้าลืม PDF ทุกไฟล์จะถูก
  บันทึกเป็น `pages: 0` (ไม่รู้) แยกไม่ออกจากไฟล์ raw และสถิติกระดาษรอบ 6 ไม่มีข้อมูลย้อนหลัง
  (พบตอนรีวิว Task 1)
- ฟิลด์ที่รอบหลังจะเพิ่มบน `SarabanDoc` (การรับทราบของรอบ 2, `folder` ของรอบ 5) จะไม่มีในหนังสือเก่า
  ทั้งที่กติกาคือ "เขียนทุกคีย์เสมอ" — รอบที่เพิ่มต้องมีขั้น normalise ตอนอ่านแบบ `normalise()` ของ
  `config-store.ts`
- ตรวจสองเรื่องที่สเปกข้อ 12 ให้เป็นงานแรกของแผน: Cloudinary ส่ง PDF ได้ไหม · URL ชั่วคราวหมดอายุจริงไหม
- เพิ่ม `/saraban` ใน `src/proxy.ts`
