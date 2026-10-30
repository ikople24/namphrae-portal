# แผนลงมือรอบ 1B — API ของระบบสารบรรณ + Railway bucket

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปิด API ใต้ `/api/admin/saraban/*` ครบทุกงานของรอบ 1 (ลงรับ ออกเลขส่ง/เวียน ทะเบียน แก้ไข/ยกเลิก/
ส่งแล้ว ไฟล์แนบ สมุดผู้รับ เลขเริ่มต้น) บนชั้นข้อมูลของรอบ 1A โดยไฟล์แนบอยู่ใน Railway Storage Bucket

**Architecture:** route บาง ๆ แบบ `api/admin/calendar` — ตรวจสิทธิ์ (`requireFeature(…, 'saraban')`) → zod →
ฟังก์ชันบริสุทธิ์ของ 1A ตัดสิน → store เขียน · ส่วนที่ตัดสินอะไรได้และยังไม่มีใน 1A เพิ่มเป็นฟังก์ชันบริสุทธิ์
พร้อมเทสต์ก่อน · การคุยกับ bucket อยู่ใน `saraban-storage.ts` ไฟล์เดียว พิสูจน์ด้วย smoke บน bucket
ทดสอบ · route พิสูจน์ด้วย smoke ผ่าน dev server จริง (repo ไม่มีเทสต์ของ route)

**Tech Stack:** Next.js 16 Pages Router API routes · `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` ·
`pdf-lib` · zod 4 · Vitest 3 · tsx

**สเปก:** [2026-09-13-saraban-design.md](../specs/2026-09-13-saraban-design.md) ข้อ 2, 4, 5 (ฉบับ 2026-10-30),
6 "กฎการแก้ไข", 8, 12 · **ต่อจาก:** [แผน 1A](2026-09-13-saraban-1a-data-layer.md) ทั้ง 14 task และหัวข้อ
"ส่งต่อรอบ 1B"

---

## โครงไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/raw-body.ts` | อ่าน body ดิบพร้อมเพดาน — บริสุทธิ์ (รับ AsyncIterable) |
| `src/lib/saraban-pdf.ts` | นับหน้า PDF ด้วย pdf-lib — server only |
| `src/lib/saraban-attachment.ts` | **แก้** + `inlineDisposition` · `looseKeysOf` |
| `src/lib/saraban-doc.ts` | **แก้** + `pickActorName` · `nameUnitChanges` |
| `src/lib/saraban-schema.ts` | **แก้** + `yearQuerySchema` · `docKindSchema` |
| `src/lib/saraban-actor.ts` | `resolveActor()` ชื่อผู้ทำจากทะเบียนสมาชิก — server only |
| `src/lib/saraban-storage.ts` | S3 client ของ Railway bucket: put · head · ลิงก์ชั่วคราว · ลบ · กวาดไฟล์ของคำขอที่ล้ม · list/get (สำรอง) |
| `src/pages/api/admin/saraban/units/index.ts` · `units/[id].ts` | สมุดผู้รับ |
| `src/pages/api/admin/saraban/years.ts` | สถานะปี + เลขเริ่มต้น |
| `src/pages/api/admin/saraban/summary.ts` | ตัวเลขบน sidebar (หนังสือรับรอเกษียน) — เพิ่มจากรายการไฟล์ในสเปกข้อ 2 |
| `src/pages/api/admin/saraban/uploads.ts` | อัปไฟล์หนึ่งไฟล์เข้า bucket |
| `src/pages/api/admin/saraban/docs/index.ts` | ทะเบียน · ลงรับ/ออกเลข |
| `src/pages/api/admin/saraban/docs/[id]/index.ts` | หนังสือหนึ่งเรื่อง · แก้ไข/ยกเลิก/ส่งแล้ว |
| `src/pages/api/admin/saraban/docs/[id]/files/index.ts` · `files/[fileId].ts` | เพิ่ม · เปิดดู · ลบไฟล์แนบ |
| `scripts/smoke-saraban-storage.mts` | smoke ของ bucket (ห้ามรันกับ bucket จริง) |
| `scripts/smoke-saraban-api.mts` | smoke ของ API ผ่าน dev server |
| `scripts/saraban-backup.mts` | สำรองไฟล์ทั้ง bucket ลงโฟลเดอร์ + รายงานไฟล์กำพร้า |
| `next.config.ts` · `src/proxy.ts` · `.env.example` · `package.json` | **แก้** |

**ทำไมมี `summary.ts`:** สเปกข้อ 2 ไม่ได้ระบุ แต่ sidebar ของรอบ 1C ต้องโชว์จำนวนหนังสือรับที่รอเกษียนทุกหน้า
(handoff "ส่งต่อรอบ 1B": badge = `countDocs({ register: 'in', statusIn: ['pending'] })`) ถ้าไม่มี route นี้
ทุกหน้าต้องดึงทะเบียนทั้งหน้ามาเพื่อเลขตัวเดียว

## ข้อตกลงของรอบนี้

- baseline ก่อนเริ่ม: `npm test` ผ่าน **34 ไฟล์ 500 เทสต์** · tsc และ `npm run lint` สะอาด
- เทสต์เดิมผ่านโดยไม่แก้ · `api-guard-coverage.test.ts` ครอบ route ใหม่เองเพราะทุกไฟล์เรียก `requireFeature(`
- คอมเมนต์ภาษาไทยอธิบาย "ทำไม" · commit `feat(saraban): …` ทีละ task
- ไฟล์ client-safe (`saraban-{number,labels,doc,attachment,schema}.ts`) ห้าม import `mongodb`/`@aws-sdk/*`/
  `pdf-lib`/`fs`/`node:*` — `raw-body.ts` รับ AsyncIterable จึงไม่ต้อง import stream
- **smoke ทุกตัวใช้ bucket ทดสอบ `saraban-files-dev` จาก `.env.local` เท่านั้น** — สคริปต์ปฏิเสธเองถ้า
  `BUCKET_NAME` ไม่มีคำว่า `-dev`
- รหัสข้อผิดพลาดตามสเปกข้อ 8 · เพิ่ม `409 stale` (แก้ทับคนอื่น) · `409 field_locked` (แก้ช่องที่ล็อก) ·
  `409 too_many_files` · `400 invalid_input` (body/query ไม่ผ่าน zod)

---

## Task 1: dependency · next.config · proxy · .env.example

**Files:**
- Modify: `package.json` (npm install) · `next.config.ts` · `src/proxy.ts` · `.env.example`

- [ ] **Step 1: ติดตั้ง dependency**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner pdf-lib
```

- [ ] **Step 2: แทน `next.config.ts` ทั้งไฟล์**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // ไฟล์แนบสารบรรณอัปผ่าน /api/admin/saraban/uploads ได้ไม่เกิน 10MB และ route นั้นผ่าน proxy
    // ค่าเริ่มต้นของ proxy คือ 10MB พอดี body ที่ยาวกว่าจะถูกตัดเงียบ ๆ แล้ว route เห็นไฟล์ครึ่งเดียว
    // (docs: proxyClientMaxBodySize) จึงเผื่อไว้ 1MB แล้วให้ route ตัดที่ 10MB เองพร้อมตอบ 413
    proxyClientMaxBodySize: '11mb',
  },
};

export default nextConfig;
```

- [ ] **Step 3: `src/proxy.ts` — ป้องกัน `/saraban` แบบเดียวกับ `/admin`**

แทนบรรทัด `const isProtected = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);` ด้วย:

```ts
  // /saraban มี shell ของตัวเองนอก /admin (สเปกข้อ 1.3) แต่ต้องล็อกอินเหมือนกัน — ไม่งั้นคน
  // ยังไม่ล็อกอินเห็นการ์ด AccessDenied แทนที่จะถูกพาไป /sign-in
  const isProtected = createRouteMatcher(['/admin(.*)', '/api/admin(.*)', '/saraban(.*)']);
```

และใน `matcher` เพิ่มบรรทัดต่อจาก `'/api/admin/:path*',`:

```ts
    '/saraban/:path*',
```

- [ ] **Step 4: `.env.example` — เพิ่มต่อจากบล็อก Cloudinary (ก่อนบล็อก LINE)**

```bash
# ระบบสารบรรณ — ไฟล์แนบอยู่ใน Railway Storage Bucket (ไม่ใช้ Cloudinary) ดูสเปก saraban ข้อ 5
# production: ตั้งเป็น variable reference ไปที่ bucket saraban-files ในหน้า Railway
# localhost: คัดลอกจากแท็บ Credentials ของ bucket ทดสอบ saraban-files-dev เท่านั้น
# ไม่ตั้ง = ลงรับได้ปกติแต่แนบไฟล์ไม่ได้ (503 storage_not_configured)
BUCKET_NAME=
BUCKET_ENDPOINT=
BUCKET_REGION=
BUCKET_ACCESS_KEY_ID=
BUCKET_SECRET_ACCESS_KEY=
```

- [ ] **Step 5: ตรวจ**

Run: `npx tsc --noEmit -p . && npm test && npm run lint`
Expected: tsc ไม่มี output · `Test Files  34 passed` · `Tests  500 passed` · eslint สะอาด

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json next.config.ts src/proxy.ts .env.example
git commit -m "feat(saraban): ตั้งค่า bucket proxy และเพดาน body สำหรับไฟล์แนบ"
```

---

## Task 2: `raw-body.ts` — อ่าน body ดิบพร้อมเพดาน

`uploads.ts` ปิด bodyParser เพื่อรับเนื้อไฟล์ดิบ — Next ปิด bodyParser แล้วไม่มีเพดานให้ และ Railway ไม่มี
ตัวกั้นที่ขอบ (คอมเมนต์ใน `api/line/webhook.ts`) ไม่แตะ webhook เดิม

**Files:**
- Create: `src/lib/raw-body.ts` · Test: `src/lib/raw-body.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
// src/lib/raw-body.test.ts
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readRawBody } from '@/lib/raw-body';

const stream = (...chunks: (string | Uint8Array)[]) => Readable.from(chunks);

describe('readRawBody', () => {
  it('ต่อ chunk ทั้งหมดเป็น Buffer เดียว — รับทั้ง string และ bytes', async () => {
    const body = await readRawBody(stream('ab', new Uint8Array([0x63])), 10);
    expect(body?.toString()).toBe('abc');
  });

  it('ยาวเท่าเพดานพอดีผ่าน', async () => {
    expect((await readRawBody(stream('12345'), 5))?.length).toBe(5);
  });

  it('เกินเพดานหนึ่งไบต์ → null และไม่อ่านต่อ', async () => {
    let pulled = 0;
    async function* chunks() {
      for (const c of ['123', '456', '789']) {
        pulled += 1;
        yield c;
      }
    }
    expect(await readRawBody(chunks(), 5)).toBeNull();
    expect(pulled).toBe(2);
  });

  it('body ว่าง → Buffer ยาว 0 (ผู้เรียกตัดสินเองว่าว่างผิดไหม)', async () => {
    expect((await readRawBody(stream(), 5))?.length).toBe(0);
  });
});
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/raw-body.test.ts`
Expected: FAIL — `Cannot find module '@/lib/raw-body'`

- [ ] **Step 3: เขียนโค้ด**

```ts
// src/lib/raw-body.ts
// อ่าน body ดิบของคำขอโดยมีเพดาน — สำหรับ route ที่ปิด bodyParser (Next ไม่กันขนาดให้แล้ว และ
// Railway ไม่มีตัวกั้นที่ขอบแบบ Vercel) · รับ AsyncIterable ไม่ใช่ IncomingMessage เพื่อให้เทสต์
// ส่ง generator เข้ามาได้ตรง ๆ

/** เกิน max → null ทันทีโดยไม่อ่าน chunk ถัดไป (ไม่ปล่อยให้คนยิงไฟล์ใหญ่มาค้างหน่วยความจำ) */
export async function readRawBody(
  chunks: AsyncIterable<unknown>,
  max: number
): Promise<Buffer | null> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of chunks) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array);
    size += buf.length;
    if (size > max) return null;
    parts.push(buf);
  }
  return Buffer.concat(parts);
}
```

- [ ] **Step 4: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/raw-body.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/raw-body.ts src/lib/raw-body.test.ts
git commit -m "feat(saraban): อ่าน body ดิบพร้อมเพดานขนาด"
```

---

## Task 3: `saraban-pdf.ts` — นับหน้า PDF

**Files:**
- Create: `src/lib/saraban-pdf.ts` · Test: `src/lib/saraban-pdf.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
// src/lib/saraban-pdf.test.ts
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { countPdfPages } from '@/lib/saraban-pdf';

async function pdfWithPages(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i += 1) doc.addPage();
  return doc.save();
}

describe('countPdfPages', () => {
  it('นับหน้าจริงของ PDF', async () => {
    expect(await countPdfPages(await pdfWithPages(3))).toBe(3);
    expect(await countPdfPages(await pdfWithPages(1))).toBe(1);
  });

  it('เปิดไม่ได้ → 0 (ไม่รู้) ไม่โยน — ยังรับไฟล์ได้ (สเปกข้อ 5)', async () => {
    expect(await countPdfPages(new TextEncoder().encode('%PDF-1.7 garbage'))).toBe(0);
    expect(await countPdfPages(new Uint8Array())).toBe(0);
  });
});
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/saraban-pdf.test.ts`
Expected: FAIL — `Cannot find module '@/lib/saraban-pdf'`

- [ ] **Step 3: เขียนโค้ด**

```ts
// src/lib/saraban-pdf.ts
// นับหน้า PDF ตอนอัป (สเปกข้อ 5) — SERVER ONLY: pdf-lib ใหญ่ ไม่ให้หลุดเข้า bundle ของหน้าจอ
// จำนวนหน้าเก็บตั้งแต่วันแรกเพื่อสถิติกระดาษรอบ 6 และการวางตรา/ลายมือรายหน้ารอบ 4

import { PDFDocument } from 'pdf-lib';

/** 0 = เปิดไม่ได้ (ไฟล์เสีย หรือโครงสร้างแปลก) — ไม่ใช่เหตุให้ปฏิเสธไฟล์ที่ผู้ใช้เปิดดูได้ในเครื่องตัวเอง */
export async function countPdfPages(data: Uint8Array): Promise<number> {
  try {
    // ignoreEncryption: PDF ที่ล็อกการแก้ไขยังนับหน้าได้ · updateMetadata: เราไม่ save กลับ
    const doc = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
    return doc.getPageCount();
  } catch {
    return 0;
  }
}
```

- [ ] **Step 4: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/saraban-pdf.test.ts`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-pdf.ts src/lib/saraban-pdf.test.ts
git commit -m "feat(saraban): นับหน้า PDF ตอนอัปไฟล์แนบ"
```

---

## Task 4: `saraban-attachment.ts` — Content-Disposition และ key จาก body ที่ยังไม่ผ่าน zod

**Files:**
- Modify: `src/lib/saraban-attachment.ts` (เพิ่มท้ายไฟล์) · `src/lib/saraban-attachment.test.ts` (import + ท้ายไฟล์)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ใน import ของ `@/lib/saraban-attachment` บนสุดของไฟล์เทสต์ เพิ่ม `inlineDisposition,` และ `looseKeysOf,`
และ `MAX_FILES_PER_DOC,` (เรียงตามตัวอักษร) แล้วเพิ่มท้ายไฟล์:

```ts
describe('inlineDisposition — ลิงก์ชั่วคราวเปิด PDF ในแท็บพร้อมชื่อเดิม', () => {
  it('ชื่อ ASCII: filename ตรงตัว และ filename* เข้ารหัส', () => {
    expect(inlineDisposition("it's a.pdf")).toBe(
      `inline; filename="it's a.pdf"; filename*=UTF-8''it%27s%20a.pdf`
    );
  });

  it('ชื่อไทย: filename สำรองเป็น ASCII ล้วน ส่วน filename* เก็บชื่อจริง', () => {
    const header = inlineDisposition('หนังสือ.pdf');
    expect(header).toBe(
      `inline; filename="_______.pdf"; filename*=UTF-8''${encodeURIComponent('หนังสือ.pdf')}`
    );
  });

  it('" และ \\ ในชื่อไม่หลุดออกนอกเครื่องหมายคำพูด', () => {
    expect(inlineDisposition('a"b\\c.pdf')).toContain('filename="a_b_c.pdf"');
  });
});

describe('looseKeysOf — key ของไฟล์จาก body ที่ยังไม่ผ่าน zod (ใช้กวาดไฟล์เมื่อบันทึกล้ม)', () => {
  it('ดึงเฉพาะ key ใต้ prefix ตัดซ้ำ', () => {
    const body = {
      files: [
        { key: `${SARABAN_PREFIX}a.pdf` },
        { key: `${SARABAN_PREFIX}a.pdf` },
        { key: 'other/b.pdf' },
        { key: 42 },
        null,
        'x',
      ],
    };
    expect(looseKeysOf(body)).toEqual([`${SARABAN_PREFIX}a.pdf`]);
  });

  it('body ผิดรูปทุกแบบ → []', () => {
    expect(looseKeysOf(null)).toEqual([]);
    expect(looseKeysOf('x')).toEqual([]);
    expect(looseKeysOf({ files: 'x' })).toEqual([]);
  });

  it('ไม่เกิน MAX_FILES_PER_DOC — body ปลอมที่ใส่ key เป็นพันไม่ทำให้เราไล่ลบเป็นพัน', () => {
    const files = Array.from({ length: 50 }, (_, i) => ({ key: `${SARABAN_PREFIX}${i}.pdf` }));
    expect(looseKeysOf({ files })).toHaveLength(MAX_FILES_PER_DOC);
  });
});
```

- [ ] **Step 2: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/saraban-attachment.test.ts`
Expected: FAIL — `inlineDisposition is not a function`

- [ ] **Step 3: เพิ่มท้าย `src/lib/saraban-attachment.ts`**

```ts
/**
 * Content-Disposition ของลิงก์ชั่วคราว — inline ให้ PDF เปิดในแท็บ · filename* (RFC 5987) เก็บชื่อไทย
 * · filename สำรองเป็น ASCII ล้วนสำหรับเบราว์เซอร์ที่ไม่รู้จัก filename* (ตัวนอก ASCII และ " \ เป็น _)
 */
export function inlineDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  // encodeURIComponent ไม่เข้ารหัส ' ( ) * แต่ RFC 5987 ต้องการ — ' ปิด value ของ filename* ได้
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * key ของไฟล์ใน body ที่ยังไม่ผ่าน zod — route ใช้กวาดไฟล์ทิ้งเมื่อบันทึกล้มตั้งแต่ด่าน validation
 * (สเปกข้อ 5 "บันทึกล้มแล้วลบ") · ผู้เรียกต้องกรองด้วย attachedKeys() ก่อนลบเสมอ
 * ตัดที่ MAX_FILES_PER_DOC: body ปลอมที่ใส่ key เป็นพันต้องไม่ทำให้เราไล่ลบเป็นพัน
 */
export function looseKeysOf(body: unknown): string[] {
  const files = (body as { files?: unknown } | null)?.files;
  if (!Array.isArray(files)) return [];
  const keys = files
    .map((f) => (f as { key?: unknown } | null)?.key)
    .filter((k): k is string => typeof k === 'string' && k.startsWith(SARABAN_PREFIX));
  return [...new Set(keys)].slice(0, MAX_FILES_PER_DOC);
}
```

- [ ] **Step 4: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/saraban-attachment.test.ts`
Expected: PASS — 19 tests (13 เดิม + 6)

- [ ] **Step 5: Commit**

```bash
git add src/lib/saraban-attachment.ts src/lib/saraban-attachment.test.ts
git commit -m "feat(saraban): ชื่อไฟล์บนลิงก์ชั่วคราวและ key สำหรับกวาดไฟล์ของคำขอที่ล้ม"
```

---

## Task 5: ชื่อผู้ทำ · ชื่อหน่วยในประวัติ · schema ของ query

**Files:**
- Modify: `src/lib/saraban-doc.ts` · `src/lib/saraban-doc.test.ts` (import + ท้ายไฟล์)
- Modify: `src/lib/saraban-schema.ts` · `src/lib/saraban-schema.test.ts` (import + ท้ายไฟล์)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน — `saraban-doc.test.ts`**

ใน import ของ `@/lib/saraban-doc` เพิ่ม `nameUnitChanges,` และ `pickActorName,` (เรียงตามตัวอักษร) แล้วเพิ่ม
ท้ายไฟล์:

```ts
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
```

- [ ] **Step 2: เขียนเทสต์ที่ยังไม่ผ่าน — `saraban-schema.test.ts`**

ใน import ของ `@/lib/saraban-schema` เพิ่ม `docKindSchema,` และ `yearQuerySchema,` แล้วเพิ่มท้ายไฟล์:

```ts
describe('yearQuerySchema / docKindSchema', () => {
  it('ปีจาก query string แปลงเป็นตัวเลข เว้นได้', () => {
    expect(yearQuerySchema.parse({ register: 'in', year: '2570' })).toEqual({ register: 'in', year: 2570 });
    expect(yearQuerySchema.parse({ register: 'out' })).toEqual({ register: 'out' });
    expect(yearQuerySchema.safeParse({ register: 'x' }).success).toBe(false);
  });

  it('kind ของ POST /docs มีแค่ลงรับกับออกเลข', () => {
    expect(docKindSchema.parse('receive')).toBe('receive');
    expect(docKindSchema.parse('send')).toBe('send');
    expect(docKindSchema.safeParse('delete').success).toBe(false);
  });
});
```

- [ ] **Step 3: รันเทสต์ ต้องไม่ผ่าน**

Run: `npx vitest run src/lib/saraban-doc.test.ts src/lib/saraban-schema.test.ts`
Expected: FAIL — `pickActorName is not a function` · `yearQuerySchema` undefined

- [ ] **Step 4: เพิ่มท้าย `src/lib/saraban-doc.ts`**

```ts
// ---- ผู้ทำและประวัติ -------------------------------------------------------

/**
 * ชื่อที่ประทับใน event (สเปกข้อ 3 "ประวัติเก็บชื่อ ณ เวลาที่ทำ") — ชื่อจริงจากทะเบียนสมาชิกก่อน
 * เพราะชื่อในบัญชี Clerk มักว่างหรือเป็นอีเมล แล้วอีเมล แล้ว clerkId (ลำดับเดียวกับ /api/admin/me)
 */
export function pickActorName(
  registryName: unknown,
  email: string | undefined,
  userId: string
): string {
  if (typeof registryName === 'string' && registryName.trim()) return registryName.trim();
  return email || userId;
}

/**
 * buildEdit() คืน from/to ของ "เสนอถึง" เป็น id ของหน่วย — แปลงเป็นชื่อ ณ ขณะนี้ก่อนเก็บลง event
 * ไม่งั้นวันที่หน่วยเปลี่ยนชื่อ ประวัติที่แสดงจะเปลี่ยนตาม (audit trail ต้องไม่ถูกแก้ย้อนหลัง สเปกข้อ 3)
 */
export function nameUnitChanges(
  changes: SarabanFieldChange[],
  nameOf: (unitId: string) => string
): SarabanFieldChange[] {
  return changes.map((c) =>
    c.field === 'holderUnitId' ? { ...c, from: nameOf(c.from), to: nameOf(c.to) } : c
  );
}
```

- [ ] **Step 5: เพิ่มท้าย `src/lib/saraban-schema.ts`**

```ts
// GET /api/admin/saraban/years — ไม่ใส่ปี = ปีงบปัจจุบัน (route คำนวณ)
export const yearQuerySchema = z.object({
  register: z.enum(SARABAN_REGISTERS),
  year: z.coerce.number().int().min(2500).max(2700).optional(),
});

// POST /api/admin/saraban/docs?kind=… — ลงรับกับออกเลขใช้ schema คนละตัว
export const docKindSchema = z.enum(['receive', 'send']);
export type DocKind = z.infer<typeof docKindSchema>;
```

- [ ] **Step 6: รันเทสต์ ต้องผ่าน**

Run: `npx vitest run src/lib/saraban-doc.test.ts src/lib/saraban-schema.test.ts && npx tsc --noEmit -p .`
Expected: PASS — doc 63 tests · schema 24 tests · tsc ไม่มี output

- [ ] **Step 7: Commit**

```bash
git add src/lib/saraban-doc.ts src/lib/saraban-doc.test.ts src/lib/saraban-schema.ts src/lib/saraban-schema.test.ts
git commit -m "feat(saraban): ชื่อผู้ทำ ชื่อหน่วยในประวัติ และ schema ของ query"
```

---

## Task 6: `saraban-actor.ts` + `saraban-storage.ts` + smoke บน bucket ทดสอบ

ตรวจสองข้อแรกของสเปกข้อ 12 ไปพร้อมกัน: bucket ใช้งานได้จริง และลิงก์ชั่วคราวหมดอายุจริง

**Files:**
- Create: `src/lib/saraban-actor.ts` · `src/lib/saraban-storage.ts` · `scripts/smoke-saraban-storage.mts`

- [ ] **Step 1: `src/lib/saraban-actor.ts`**

```ts
// src/lib/saraban-actor.ts
// ผู้ทำของ event — SERVER ONLY (อ่านทะเบียนสมาชิก) · ตัดสินชื่อด้วย pickActorName ที่เทสต์แล้ว

import type { AdminIdentity } from '@/lib/auth-server';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { activeRegistryFilter } from '@/lib/registry-user';
import { pickActorName, type Actor } from '@/lib/saraban-doc';

export async function resolveActor(admin: AdminIdentity): Promise<Actor> {
  let registryName: unknown;
  if (isMongoConfigured()) {
    try {
      const doc = await (await getUsersDb())
        .collection('users')
        .findOne(activeRegistryFilter(admin.userId), { projection: { name: 1 } });
      registryName = doc?.name;
    } catch (err) {
      // อ่านชื่อไม่ได้ไม่ใช่เหตุให้ลงรับไม่ได้ — ประวัติได้อีเมลแทนชื่อจริง ซึ่งยังระบุตัวคนได้
      console.warn('resolveActor: อ่านชื่อจากทะเบียนสมาชิกไม่ได้ ใช้อีเมลแทน', err);
    }
  }
  return { id: admin.userId, name: pickActorName(registryName, admin.email, admin.userId) };
}
```

- [ ] **Step 2: `src/lib/saraban-storage.ts`**

```ts
// src/lib/saraban-storage.ts
// ไฟล์แนบของสารบรรณใน Railway Storage Bucket (S3-compatible) — SERVER ONLY (สเปกข้อ 5)
// เซิร์ฟเวอร์เป็นผู้เดียวที่เขียนลง bucket: ContentType กับ metadata pages ที่ putObject ตั้งไว้
// จึงเป็นสิ่งที่ checkAttachment เชื่อได้ · bucket เป็น private เสมอ เปิดดูผ่านลิงก์ชั่วคราวเท่านั้น

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { inlineDisposition, SARABAN_PREFIX, type StoredObject } from '@/lib/saraban-attachment';
import { attachedKeys } from '@/lib/saraban-store';

const ENV_KEYS = [
  'BUCKET_NAME',
  'BUCKET_ENDPOINT',
  'BUCKET_REGION',
  'BUCKET_ACCESS_KEY_ID',
  'BUCKET_SECRET_ACCESS_KEY',
] as const;

/** ไม่ครบ = แนบไฟล์ไม่ได้ แต่ลงรับได้ตามปกติ (หลัก zero-config · route ตอบ 503 storage_not_configured) */
export function isStorageConfigured(): boolean {
  return ENV_KEYS.every((key) => Boolean(process.env[key]));
}

let client: S3Client | undefined;

function s3(): S3Client {
  client ??= new S3Client({
    region: process.env.BUCKET_REGION,
    endpoint: process.env.BUCKET_ENDPOINT,
    credentials: {
      accessKeyId: process.env.BUCKET_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.BUCKET_SECRET_ACCESS_KEY as string,
    },
    // Railway bucket ใหม่ใช้ virtual-hosted style (ชื่อ bucket เป็น subdomain)
    forcePathStyle: false,
    // SDK v3 รุ่นใหม่แนบ checksum CRC32 ทุกคำขอเป็นค่าเริ่มต้น บริการ S3-compatible บางเจ้ายังไม่รองรับ
    // แล้วปฏิเสธทั้งคำขอ — ส่งเฉพาะเมื่อ operation บังคับ
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return client;
}

function bucket(): string {
  return process.env.BUCKET_NAME as string;
}

export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
  pages: number
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
      Metadata: { pages: String(pages) },
    })
  );
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
}

/** null = ไม่มี object นี้ · error อื่น (bucket ล่ม สิทธิ์ผิด) โยนต่อให้ route ตอบ 500 */
export async function headObject(key: string): Promise<StoredObject | null> {
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { key, bytes: r.ContentLength ?? 0, contentType: r.ContentType, pages: r.Metadata?.pages };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export const VIEW_URL_TTL_SECONDS = 300;

/**
 * ลิงก์ชั่วคราวสำหรับเปิดดู (สเปกข้อ 5 "เปิดดู") — route redirect ไปที่นี่ ไม่ stream ผ่านแอป
 * ส่ง ContentType ซ้ำจาก object เพื่อให้เบราว์เซอร์ไม่ต้องเดาจากเนื้อไฟล์
 */
export async function viewUrl(
  key: string,
  name: string,
  contentType: string,
  ttlSeconds: number = VIEW_URL_TTL_SECONDS
): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: inlineDisposition(name),
      ResponseContentType: contentType,
    }),
    { expiresIn: ttlSeconds }
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/**
 * กวาดไฟล์ของคำขอที่บันทึกล้ม — ลบเฉพาะ key ใต้ prefix ที่ยังไม่ผูกกับหนังสือเรื่องใด
 * (สเปกข้อ 5: ไม่งั้นคนส่ง key ของหนังสือคนอื่นมาในคำขอที่ตั้งใจให้ล้ม แล้วไฟล์ราชการถูกลบ)
 * ไม่โยน: ลบไม่สำเร็จ = เหลือไฟล์กำพร้า ซึ่งต้องไม่กลบ error เดิมของคำขอ
 */
export async function discardUnattached(keys: readonly string[]): Promise<void> {
  const ours = keys.filter((key) => key.startsWith(SARABAN_PREFIX));
  if (ours.length === 0 || !isStorageConfigured()) return;
  try {
    const attached = await attachedKeys(ours);
    await Promise.all(
      ours
        .filter((key) => !attached.has(key))
        .map((key) =>
          deleteObject(key).catch((err) =>
            console.warn('discardUnattached: ลบไม่สำเร็จ เหลือไฟล์กำพร้า', key, err)
          )
        )
    );
  } catch (err) {
    console.warn('discardUnattached: ตรวจ key ไม่สำเร็จ ไม่ลบอะไร', ours, err);
  }
}

// ---- ใช้โดยสคริปต์สำรองไฟล์ ------------------------------------------------

/** key ทั้งหมดใต้ prefix ของสารบรรณ (ไล่ทุกหน้าของ ListObjectsV2) */
export async function listKeys(): Promise<{ key: string; bytes: number }[]> {
  const out: { key: string; bytes: number }[] = [];
  let token: string | undefined;
  do {
    const page = await s3().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: SARABAN_PREFIX, ContinuationToken: token })
    );
    for (const o of page.Contents ?? []) if (o.Key) out.push({ key: o.Key, bytes: o.Size ?? 0 });
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!r.Body) throw new Error(`object ว่าง: ${key}`);
  return r.Body.transformToByteArray();
}
```

- [ ] **Step 3: ตรวจชนิด**

Run: `npx tsc --noEmit -p . && npm run lint`
Expected: ไม่มี output · eslint สะอาด

- [ ] **Step 4: `scripts/smoke-saraban-storage.mts`**

```ts
// scripts/smoke-saraban-storage.mts
// smoke ของ Railway bucket (สเปกข้อ 12 ข้อ 1–2) — อัป · HeadObject · ลิงก์ชั่วคราว · หมดอายุ · ลบ
// รัน: npx tsx --env-file=.env.local scripts/smoke-saraban-storage.mts
// ใช้ bucket ทดสอบเท่านั้น: ปฏิเสธเองถ้า BUCKET_NAME ไม่มี '-dev' (bucket จริงไม่มี backup)

import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { checkAttachment, CONTENT_TYPES, keyFor } from '@/lib/saraban-attachment';
import { countPdfPages } from '@/lib/saraban-pdf';
import { deleteObject, headObject, isStorageConfigured, putObject, viewUrl } from '@/lib/saraban-storage';

function fail(message: string): never {
  console.error('FAIL', message);
  process.exit(1);
}

if (!isStorageConfigured()) fail('ไม่มี BUCKET_* ใน env');
if (!process.env.BUCKET_NAME?.includes('-dev')) fail(`ไม่ใช่ bucket ทดสอบ: ${process.env.BUCKET_NAME}`);

const pdf = await PDFDocument.create();
pdf.addPage();
pdf.addPage();
const bytes = await pdf.save();
const pages = await countPdfPages(bytes);
const key = keyFor(`smoke-${randomUUID()}`, 'pdf');

try {
  await putObject(key, bytes, CONTENT_TYPES.pdf, pages);
  const head = await headObject(key);
  if (!head) fail('HeadObject ไม่เจอ object ที่เพิ่งอัป');
  const check = checkAttachment(head);
  console.log('head', head.contentType, head.pages, 'check', check.ok && `${check.file.format}/${check.file.pages}`);

  const url = await viewUrl(key, 'หนังสือทดสอบ.pdf', CONTENT_TYPES.pdf);
  const res = await fetch(url);
  console.log('view', res.status, res.headers.get('content-type'), (res.headers.get('content-disposition') ?? '').includes("filename*=UTF-8''"));

  const shortUrl = await viewUrl(key, 'x.pdf', CONTENT_TYPES.pdf, 1);
  await new Promise((r) => setTimeout(r, 3000));
  console.log('expired', (await fetch(shortUrl)).status);

  console.log('missing', await headObject(keyFor(`missing-${randomUUID()}`, 'pdf')));
} finally {
  await deleteObject(key);
  console.log('deleted', (await headObject(key)) === null);
}
```

- [ ] **Step 5: รัน smoke**

Run: `npx tsx --env-file=.env.local scripts/smoke-saraban-storage.mts`
Expected:
```
head application/pdf 2 check pdf/2
view 200 application/pdf true
expired 403
missing null
deleted true
```
ถ้า `expired` ไม่ใช่ 403 — หยุด: ลิงก์ชั่วคราวไม่หมดอายุจริง ต้องแก้ก่อนทำ route เปิดดู (สเปกข้อ 12 ข้อ 2)

- [ ] **Step 6: Commit**

```bash
git add src/lib/saraban-actor.ts src/lib/saraban-storage.ts scripts/smoke-saraban-storage.mts
git commit -m "feat(saraban): ที่เก็บไฟล์แนบบน Railway bucket และชื่อผู้ทำจากทะเบียนสมาชิก"
```

---

## Task 7: route สมุดผู้รับ · ปี · summary

**Files:**
- Create: `src/pages/api/admin/saraban/units/index.ts` · `units/[id].ts` · `years.ts` · `summary.ts`

- [ ] **Step 1: `src/pages/api/admin/saraban/units/index.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { unitInputSchema } from '@/lib/saraban-schema';
import { createUnit, listUnits } from '@/lib/saraban-units-store';

// GET  /api/admin/saraban/units — สมุดผู้รับทั้งหมด รวมที่ปิดอยู่ (หนังสือเก่ายังอ้างถึง หน้าจอกรองเอง)
// POST /api/admin/saraban/units — เพิ่มตำแหน่ง/หน่วยงาน · ผู้มีสิทธิ์ saraban ทำได้ (สเปกข้อ 2 "สิทธิ์")
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  if (req.method === 'GET') {
    try {
      return res.status(200).json(await listUnits());
    } catch (err) {
      console.error('GET /api/admin/saraban/units failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (req.method === 'POST') {
    const parsed = unitInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    }
    try {
      return res.status(201).json(await createUnit(parsed.data));
    } catch (err) {
      console.error('POST /api/admin/saraban/units failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
```

- [ ] **Step 2: `src/pages/api/admin/saraban/units/[id].ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { unitPatchSchema } from '@/lib/saraban-schema';
import { updateUnit } from '@/lib/saraban-units-store';

// PATCH /api/admin/saraban/units/[id] — แก้ชื่อ สังกัด รหัสส่วนราชการ ลำดับ หรือปิด/เปิด
// ไม่มี DELETE โดยตั้งใจ: หนังสืออ้าง holderUnitId อยู่ ปิดด้วย isActive แทน
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const parsed = unitPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  }
  try {
    const unit = await updateUnit(id, parsed.data);
    return unit ? res.status(200).json(unit) : res.status(404).json({ error: 'not_found' });
  } catch (err) {
    console.error('PATCH /api/admin/saraban/units/[id] failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
```

- [ ] **Step 3: `src/pages/api/admin/saraban/years.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { resolveActor } from '@/lib/saraban-actor';
import { bangkokDateOf, fiscalYearOf } from '@/lib/saraban-number';
import { yearQuerySchema, yearStartSchema } from '@/lib/saraban-schema';
import { getYearInfo, setStartNo } from '@/lib/saraban-store';

// GET /api/admin/saraban/years?register=in[&year=2570] — จำนวนหนังสือ เลขเริ่มต้น และเลขถัดไปของปี
//   (หน้าลงรับใช้แสดง "เลขรับถัดไป" และตัดสินว่าจะโชว์ลิงก์ตั้งเลขเริ่มต้นไหม)
// PUT /api/admin/saraban/years — ตั้งเลขเริ่มต้น ได้เฉพาะปีที่ยังไม่มีหนังสือ (สเปกข้อ 4)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  if (req.method === 'GET') {
    const parsed = yearQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    }
    try {
      const year = parsed.data.year ?? fiscalYearOf(bangkokDateOf(new Date()));
      return res.status(200).json(await getYearInfo(parsed.data.register, year));
    } catch (err) {
      console.error('GET /api/admin/saraban/years failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (req.method === 'PUT') {
    const parsed = yearStartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    }
    try {
      const { register, fiscalYear, startNo } = parsed.data;
      const result = await setStartNo(register, fiscalYear, startNo, await resolveActor(admin));
      if (result === 'year_in_use') return res.status(409).json({ error: 'year_in_use' });
      return res.status(200).json(await getYearInfo(register, fiscalYear));
    } catch (err) {
      console.error('PUT /api/admin/saraban/years failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'method_not_allowed' });
}
```

- [ ] **Step 4: `src/pages/api/admin/saraban/summary.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { bangkokDateOf } from '@/lib/saraban-number';
import { countDocs } from '@/lib/saraban-store';
import { isStorageConfigured } from '@/lib/saraban-storage';

// GET /api/admin/saraban/summary — ตัวเลขบน sidebar ทุกหน้า: หนังสือรับที่รอเกษียน (ทุกปีงบ —
// เรื่องค้างข้ามปียังต้องนับ) และสถานะที่เก็บไฟล์ให้หน้าจอซ่อนช่องแนบไฟล์ได้ตั้งแต่โหลดหน้า
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const today = bangkokDateOf(new Date());
    return res.status(200).json({
      inboxPending: await countDocs({ register: 'in', statusIn: ['pending'] }, today),
      storageConfigured: isStorageConfigured(),
      today,
    });
  } catch (err) {
    console.error('GET /api/admin/saraban/summary failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
```

- [ ] **Step 5: ตรวจ**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/api-guard-coverage.test.ts && npm run lint`
Expected: tsc ไม่มี output · guard coverage ผ่านรวม 4 ไฟล์ใหม่ · eslint สะอาด

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/admin/saraban
git commit -m "feat(saraban): API สมุดผู้รับ เลขเริ่มต้น และตัวเลขบน sidebar"
```

---

## Task 8: route อัปไฟล์

**Files:**
- Create: `src/pages/api/admin/saraban/uploads.ts`

- [ ] **Step 1: เขียน route**

```ts
import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { readRawBody } from '@/lib/raw-body';
import { CONTENT_TYPES, keyFor, MAX_FILE_BYTES, sniffFormat } from '@/lib/saraban-attachment';
import { countPdfPages } from '@/lib/saraban-pdf';
import { isStorageConfigured, putObject } from '@/lib/saraban-storage';

// body เป็นเนื้อไฟล์ดิบ — ปิด bodyParser แล้วอ่านเองพร้อมเพดาน (raw-body.ts)
export const config = { api: { bodyParser: false } };

// POST /api/admin/saraban/uploads — อัปไฟล์หนึ่งไฟล์ผ่านแอปเข้า bucket (สเปกข้อ 5)
// ตอบ { key, format, bytes, pages } — ฟอร์มส่งแค่ { key, name } ต่อไปกับคำขอบันทึกหนังสือ แล้ว
// เซิร์ฟเวอร์ตรวจ object ซ้ำอีกรอบ (checkAttachment) ไม่เชื่อค่าที่ตอบกลับไปตรงนี้
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isStorageConfigured()) {
    return res.status(503).json({ error: 'storage_not_configured' });
  }

  // บอกขนาดมาเกินตั้งแต่ header → ตอบเลยโดยไม่อ่าน body (fetch ที่ส่ง File ใส่ Content-Length เสมอ)
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_FILE_BYTES) {
    return res.status(413).json({ error: 'file_too_large' });
  }

  try {
    const body = await readRawBody(req, MAX_FILE_BYTES);
    if (body === null) return res.status(413).json({ error: 'file_too_large' });
    const format = sniffFormat(body);
    if (!format) return res.status(400).json({ error: 'bad_format' });

    const pages = format === 'pdf' ? await countPdfPages(body) : 1;
    const key = keyFor(crypto.randomUUID(), format);
    await putObject(key, body, CONTENT_TYPES[format], pages);
    return res.status(201).json({ key, format, bytes: body.length, pages });
  } catch (err) {
    console.error('POST /api/admin/saraban/uploads failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
```

- [ ] **Step 2: ตรวจ**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/api-guard-coverage.test.ts && npm run lint`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/saraban/uploads.ts
git commit -m "feat(saraban): API อัปไฟล์แนบ ตรวจชนิดจากเนื้อไฟล์และนับหน้า"
```

---

## Task 9: route ทะเบียน · ลงรับ · ออกเลข

**Files:**
- Create: `src/pages/api/admin/saraban/docs/index.ts`

ลำดับใน POST (สเปกข้อ 4–5): zod → ส่งซ้ำ (คืนเรื่องเดิมก่อนตรวจไฟล์ ไม่งั้น key ของเรื่องเดิมถูกนับว่า
"แนบแล้ว" แล้วการส่งซ้ำล้ม) → หน่วย → ไฟล์ → ออกเลข · ล้มที่ขั้นไหนก็ตามหลัง zod → กวาดไฟล์ของคำขอ

- [ ] **Step 1: เขียน route**

```ts
import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature, type AdminIdentity } from '@/lib/auth-server';
import { resolveActor } from '@/lib/saraban-actor';
import { checkAttachment, looseKeysOf } from '@/lib/saraban-attachment';
import { OPEN_STATUSES, type NewDocFields } from '@/lib/saraban-doc';
import { bangkokDateOf, composeRef, fiscalYearOf } from '@/lib/saraban-number';
import {
  docKindSchema,
  docListQuerySchema,
  receiveInputSchema,
  sendInputSchema,
  type FileRef,
  type ReceiveInput,
} from '@/lib/saraban-schema';
import { discardUnattached, headObject, isStorageConfigured } from '@/lib/saraban-storage';
import {
  attachedKeys,
  countDocs,
  createDoc,
  getDoc,
  listDocs,
  listFiscalYears,
  PAGE_SIZE,
  registerCounts,
} from '@/lib/saraban-store';
import { getUnit } from '@/lib/saraban-units-store';
import type { SarabanFile } from '@/types/saraban';

// GET  /api/admin/saraban/docs?register=in[&year=2570][&view=pending][&page=2]
//      ทะเบียนหนึ่งหน้า + ตัวเลขบนปุ่มกรอง + ปีที่เลือกได้ + เรื่องค้างข้ามปี + today
//      (หน้าจอต้องส่ง today ตัวนี้เข้า displayStatus ป้ายบนแถวกับตัวเลขบนปุ่มจะได้ไม่ขัดกัน)
// POST /api/admin/saraban/docs?kind=receive|send — ลงรับ / ออกเลขส่งหรือเวียน
//      201 = ออกเลขใหม่ · 200 = ส่งซ้ำ ได้เรื่องเดิม (idempotency สเปกข้อ 4)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  if (req.method === 'GET') return list(req, res);
  if (req.method === 'POST') return create(req, res, admin);

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}

async function list(req: NextApiRequest, res: NextApiResponse) {
  const parsed = docListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  }
  try {
    const { register, view, page } = parsed.data;
    const today = bangkokDateOf(new Date());
    const currentYear = fiscalYearOf(today);
    const fiscalYear = parsed.data.year ?? currentYear;
    const [result, counts, years, carryOver] = await Promise.all([
      listDocs({ register, fiscalYear, view }, page, today),
      registerCounts(register, fiscalYear, today),
      listFiscalYears(register, currentYear),
      countDocs({ register, beforeFiscalYear: fiscalYear, statusIn: OPEN_STATUSES }, today),
    ]);
    return res.status(200).json({
      ...result,
      page,
      pageSize: PAGE_SIZE,
      fiscalYear,
      years,
      counts,
      carryOver,
      today,
    });
  } catch (err) {
    console.error('GET /api/admin/saraban/docs failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function create(req: NextApiRequest, res: NextApiResponse, admin: AdminIdentity) {
  const kind = docKindSchema.safeParse(req.query.kind);
  const input = kind.success
    ? (kind.data === 'receive' ? receiveInputSchema : sendInputSchema).safeParse(req.body)
    : null;
  if (!kind.success || !input?.success) {
    await discardUnattached(looseKeysOf(req.body));
    return res
      .status(400)
      .json({ error: 'invalid_input', issues: input && !input.success ? input.error.issues : [] });
  }
  const data = input.data;
  const fileKeys = data.files.map((f) => f.key);
  const reject = async (status: number, body: object) => {
    await discardUnattached(fileKeys);
    return res.status(status).json(body);
  };

  try {
    // ส่งซ้ำ — ตอบเรื่องเดิมก่อนตรวจไฟล์ (key ของเรื่องเดิมนับเป็น "แนบแล้ว" จะทำให้การส่งซ้ำล้ม)
    const existing = await getDoc(data.id);
    if (existing) {
      return existing.registeredBy === admin.userId
        ? res.status(200).json(existing)
        : res.status(409).json({ error: 'id_conflict' });
    }

    // หน่วย: รับ = "เสนอถึง" ต้องมีและเปิดอยู่ · ส่ง/เวียน = เจ้าของเรื่องต้องมีรหัสส่วนราชการ
    const unitId = 'holderUnitId' in data ? data.holderUnitId : data.ownerUnitId;
    const unit = await getUnit(unitId);
    if (!unit || !unit.isActive || (kind.data === 'send' && !unit.refCode)) {
      return reject(400, { error: 'invalid_unit' });
    }

    const files = await checkFiles(data.files, admin.userId);
    if (files === 'storage_not_configured') return reject(503, { error: 'storage_not_configured' });
    if (files === 'invalid_file') return reject(400, { error: 'invalid_file' });

    const actor = await resolveActor(admin);
    const result =
      'holderUnitId' in data
        ? await createDoc({
            id: data.id,
            fields: receiveFields(data),
            files,
            actor,
            eventNote: `ลงรับ เสนอ${unit.name}`,
          })
        : await createDoc({
            id: data.id,
            fields: {
              register: data.circular ? 'circular' : 'out',
              ref: '',
              docDate: data.docDate,
              party: data.party,
              subject: data.subject,
              level: data.level,
              dueDate: '',
              holderUnitId: unit.id,
            },
            refFor: (no) => composeRef(unit.refCode, data.circular ? 'circular' : 'out', no),
            files,
            actor,
            eventNote: `ออกเลข${data.circular ? 'หนังสือเวียน' : 'หนังสือส่ง'} ${unit.name}`,
          });

    if (!result.ok) {
      return reject(result.error === 'number_busy' ? 503 : 409, { error: result.error });
    }
    return res.status(result.created ? 201 : 200).json(result.doc);
  } catch (err) {
    console.error('POST /api/admin/saraban/docs failed', err);
    return reject(500, { error: 'server_error' });
  }
}

function receiveFields(data: ReceiveInput): NewDocFields {
  return {
    register: 'in',
    ref: data.ref,
    docDate: data.docDate,
    party: data.party,
    subject: data.subject,
    level: data.level,
    dueDate: data.dueDate,
    holderUnitId: data.holderUnitId,
  };
}

/**
 * ตรวจไฟล์ที่ฟอร์มอ้างถึงกับ object จริงใน bucket (สเปกข้อ 5) — key ซ้ำในคำขอเดียว · แนบกับ
 * เรื่องอื่นแล้ว · ไม่มี object · ไม่ผ่าน checkAttachment → invalid_file ทั้งคำขอ ไม่แนบครึ่ง ๆ
 */
async function checkFiles(
  refs: FileRef[],
  userId: string
): Promise<SarabanFile[] | 'invalid_file' | 'storage_not_configured'> {
  if (refs.length === 0) return [];
  if (!isStorageConfigured()) return 'storage_not_configured';
  const keys = refs.map((f) => f.key);
  if (new Set(keys).size !== keys.length) return 'invalid_file';
  if ((await attachedKeys(keys)).size > 0) return 'invalid_file';

  const now = new Date().toISOString();
  const files: SarabanFile[] = [];
  for (const ref of refs) {
    const head = await headObject(ref.key);
    const check = head ? checkAttachment(head) : null;
    if (!check?.ok) return 'invalid_file';
    files.push({ id: crypto.randomUUID(), name: ref.name, ...check.file, uploadedAt: now, uploadedBy: userId });
  }
  return files;
}
```

- [ ] **Step 2: ตรวจ**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/api-guard-coverage.test.ts && npm run lint`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/saraban/docs/index.ts
git commit -m "feat(saraban): API ทะเบียน ลงรับ และออกเลขส่ง/เวียน"
```

---

## Task 10: route หนังสือหนึ่งเรื่อง — แก้ไข · ยกเลิก · ส่งแล้ว

**Files:**
- Create: `src/pages/api/admin/saraban/docs/[id]/index.ts`

- [ ] **Step 1: เขียน route**

```ts
import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { resolveActor } from '@/lib/saraban-actor';
import {
  buildEdit,
  makeEvent,
  nameUnitChanges,
  sentTransition,
  voidTransition,
  type DocEdit,
} from '@/lib/saraban-doc';
import { docPatchSchema } from '@/lib/saraban-schema';
import { applyPatch, getDoc, type DocSet } from '@/lib/saraban-store';
import { listUnits } from '@/lib/saraban-units-store';
import type { SarabanEventKind, SarabanFieldChange } from '@/types/saraban';

// GET   /api/admin/saraban/docs/[id]
// PATCH /api/admin/saraban/docs/[id]  body { action: 'edit' | 'void' | 'sent', updatedAt, … }
//   updatedAt = เวอร์ชันที่หน้าจอเห็น — ไม่ตรงกับใน DB = มีคนแก้ไปก่อน → 409 stale ให้โหลดใหม่
//   ไม่มี DELETE โดยตั้งใจ: เลขทะเบียนเป็นหลักฐานทางราชการ ใช้ยกเลิกแทน (สเปกข้อ 6)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method === 'GET') {
    try {
      const doc = await getDoc(id);
      return doc ? res.status(200).json(doc) : res.status(404).json({ error: 'not_found' });
    } catch (err) {
      console.error('GET /api/admin/saraban/docs/[id] failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const parsed = docPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  }
  const patch = parsed.data;

  try {
    const current = await getDoc(id);
    if (!current) return res.status(404).json({ error: 'not_found' });
    if (current.updatedAt !== patch.updatedAt) return res.status(409).json({ error: 'stale' });

    let set: DocSet;
    let kind: SarabanEventKind;
    let note = '';
    let changes: SarabanFieldChange[] | undefined;

    if (patch.action === 'edit') {
      const result = buildEdit(current, patch.edit as DocEdit);
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

    const event = makeEvent({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actor: await resolveActor(admin),
      kind,
      note,
      changes,
    });
    const updated = await applyPatch(id, patch.updatedAt, set, event);
    if (updated) return res.status(200).json(updated);
    // null: ถูกแก้แทรกระหว่าง getDoc กับตรงนี้ หรือหายไป
    return (await getDoc(id))
      ? res.status(409).json({ error: 'stale' })
      : res.status(404).json({ error: 'not_found' });
  } catch (err) {
    console.error('PATCH /api/admin/saraban/docs/[id] failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
```

- [ ] **Step 2: ตรวจ**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/api-guard-coverage.test.ts && npm run lint`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add "src/pages/api/admin/saraban/docs/[id]/index.ts"
git commit -m "feat(saraban): API แก้ไข ยกเลิก และบันทึกว่าส่งแล้ว"
```

---

## Task 11: route ไฟล์แนบของหนังสือ — เพิ่ม · เปิดดู · ลบ

**Files:**
- Create: `src/pages/api/admin/saraban/docs/[id]/files/index.ts` · `files/[fileId].ts`

- [ ] **Step 1: `docs/[id]/files/index.ts`**

```ts
import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { requireFeature } from '@/lib/auth-server';
import { resolveActor } from '@/lib/saraban-actor';
import { checkAttachment, MAX_FILES_PER_DOC } from '@/lib/saraban-attachment';
import { canAddFile, makeEvent } from '@/lib/saraban-doc';
import { fileRefSchema } from '@/lib/saraban-schema';
import { discardUnattached, headObject, isStorageConfigured } from '@/lib/saraban-storage';
import { addFile, attachedKeys, getDoc } from '@/lib/saraban-store';

const bodySchema = z.object({ file: fileRefSchema });

// POST /api/admin/saraban/docs/[id]/files  body { file: { key, name } } — แนบไฟล์เพิ่มกับเรื่องที่มีอยู่
// (ไฟล์สแกนมักตามมาทีหลัง เพิ่มได้แม้เรื่องเสร็จแล้ว ยกเว้นยกเลิก — canAddFile)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isStorageConfigured()) return res.status(503).json({ error: 'storage_not_configured' });

  const parsed = bodySchema.safeParse(req.body);
  const key = parsed.success ? parsed.data.file.key : '';
  const reject = async (status: number, body: object) => {
    if (key) await discardUnattached([key]);
    return res.status(status).json(body);
  };
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  }

  try {
    const doc = await getDoc(id);
    if (!doc) return reject(404, { error: 'not_found' });
    if (!canAddFile(doc)) return reject(409, { error: 'invalid_transition', status: doc.status });
    if (doc.files.length >= MAX_FILES_PER_DOC) return reject(409, { error: 'too_many_files' });
    if ((await attachedKeys([key])).size > 0) return reject(400, { error: 'invalid_file' });
    const head = await headObject(key);
    const check = head ? checkAttachment(head) : null;
    if (!check?.ok) return reject(400, { error: 'invalid_file' });

    const actor = await resolveActor(admin);
    const at = new Date().toISOString();
    const file = {
      id: crypto.randomUUID(),
      name: parsed.data.file.name,
      ...check.file,
      uploadedAt: at,
      uploadedBy: admin.userId,
    };
    const event = makeEvent({ id: crypto.randomUUID(), at, actor, kind: 'file-added', note: file.name });
    const updated = await addFile(id, file, event);
    if (updated) return res.status(201).json(updated);
    // null: ถูกยกเลิกหรือแนบครบเพดานแทรกเข้ามา (addFile ตรวจซ้ำใน update เดียว)
    return reject(409, { error: 'too_many_files' });
  } catch (err) {
    console.error('POST /api/admin/saraban/docs/[id]/files failed', err);
    return reject(500, { error: 'server_error' });
  }
}
```

- [ ] **Step 2: `docs/[id]/files/[fileId].ts`**

```ts
import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { resolveActor } from '@/lib/saraban-actor';
import { CONTENT_TYPES } from '@/lib/saraban-attachment';
import { canRemoveFile, makeEvent } from '@/lib/saraban-doc';
import { deleteObject, isStorageConfigured, viewUrl } from '@/lib/saraban-storage';
import { getDoc, removeFile } from '@/lib/saraban-store';

// GET    /api/admin/saraban/docs/[id]/files/[fileId] — ตรวจสิทธิ์แล้ว 302 ไปลิงก์ชั่วคราว 5 นาที
//        (ไม่ stream ผ่านแอป) · ลิงก์นี้คือทางเดียวที่เปิดไฟล์ได้ เพราะ bucket เป็น private
// DELETE /api/admin/saraban/docs/[id]/files/[fileId] — เอาออกจากหนังสือก่อน แล้วค่อยลบ object
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const fileId = typeof req.query.fileId === 'string' ? req.query.fileId : '';
  if (!id || !fileId) return res.status(400).json({ error: 'missing_id' });
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'GET, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isStorageConfigured()) return res.status(503).json({ error: 'storage_not_configured' });

  try {
    const doc = await getDoc(id);
    const file = doc?.files.find((f) => f.id === fileId);
    if (!doc || !file) return res.status(404).json({ error: 'not_found' });

    if (req.method === 'GET') {
      // ลิงก์มีอายุ — ห้าม cache การ redirect ไม่งั้นเบราว์เซอร์พาไปลิงก์ที่หมดอายุแล้ว
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, await viewUrl(file.key, file.name, CONTENT_TYPES[file.format]));
    }

    if (!canRemoveFile(doc)) {
      return res.status(409).json({ error: 'invalid_transition', status: doc.status });
    }
    const event = makeEvent({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actor: await resolveActor(admin),
      kind: 'file-removed',
      note: file.name,
    });
    const updated = await removeFile(id, fileId, event);
    if (!updated) return res.status(409).json({ error: 'invalid_transition' });
    // ลบ object หลัง DB สำเร็จเท่านั้น — พลาดตรงนี้ = ไฟล์กำพร้าหนึ่งไฟล์ ไม่ใช่ DB ชี้ไฟล์ที่หายไป
    await deleteObject(file.key).catch((err) =>
      console.warn('DELETE file: ลบ object ไม่สำเร็จ เหลือไฟล์กำพร้า', file.key, err)
    );
    return res.status(200).json(updated);
  } catch (err) {
    console.error(`${req.method} /api/admin/saraban/docs/[id]/files/[fileId] failed`, err);
    return res.status(500).json({ error: 'server_error' });
  }
}
```

- [ ] **Step 3: ตรวจ**

Run: `npx tsc --noEmit -p . && npm test && npm run lint`
Expected: tsc ไม่มี output · เทสต์ผ่านทั้งหมด (guard coverage รวม route ใหม่ 10 ไฟล์) · eslint สะอาด

- [ ] **Step 4: Commit**

```bash
git add "src/pages/api/admin/saraban/docs/[id]/files"
git commit -m "feat(saraban): API เพิ่ม เปิดดู และลบไฟล์แนบ"
```

---

## Task 12: smoke ของ API ผ่าน dev server

รัน dev server แบบ dev-open (ไม่มี Clerk) + แบ็กเอนด์ไฟล์ (ไม่มี Mongo) + bucket ทดสอบ แล้วยิงคำขอจริง
**ห้ามรันกับ Mongo หรือ bucket จริง**

**Files:**
- Create: `scripts/smoke-saraban-api.mts`

- [ ] **Step 1: เขียนสคริปต์**

```ts
// scripts/smoke-saraban-api.mts
// smoke ของ API สารบรรณผ่าน dev server จริง — ครอบทางที่เทสต์หน่วยแตะไม่ถึง: ลำดับของ route
// การกวาดไฟล์ ลิงก์ชั่วคราว และรหัสข้อผิดพลาดของสเปกข้อ 8
//
// รัน (สองเทอร์มินัล หรือ server เป็น background):
//   rm -f data/saraban-*.json; MONGODB_URI= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= \
//     npx next dev -p 3123
//   SMOKE_BASE=http://localhost:3123 npx tsx --env-file=.env.local scripts/smoke-saraban-api.mts
// ปฏิเสธเองถ้า BUCKET_NAME ไม่มี '-dev'

import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { deleteObject, headObject, listKeys } from '@/lib/saraban-storage';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3123';
if (!process.env.BUCKET_NAME?.includes('-dev')) {
  console.error('FAIL ไม่ใช่ bucket ทดสอบ:', process.env.BUCKET_NAME);
  process.exit(1);
}

const results: string[] = [];
function check(label: string, ok: boolean, detail: unknown = '') {
  results.push(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` → ${JSON.stringify(detail)}`}`);
}

async function call(method: string, path: string, body?: unknown, raw?: Uint8Array) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers: raw ? { 'content-type': 'application/octet-stream' } : body ? { 'content-type': 'application/json' } : {},
    body: raw ? Buffer.from(raw) : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, location: res.headers.get('location') };
}

async function pdf(pages: number) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage();
  return doc.save();
}

const created: string[] = [];
const receive = (id: string, files: { key: string; name: string }[] = []) => ({
  id,
  ref: 'ชม 0023.1/ว 1245',
  docDate: '2026-09-28',
  party: 'ที่ทำการปกครองอำเภอหางดง',
  subject: 'ขอเชิญประชุม',
  holderUnitId: 'palad',
  files,
});

try {
  const units = await call('GET', '/api/admin/saraban/units');
  check('units seeded 14', units.status === 200 && units.json.length === 14, units.status);

  const summary0 = await call('GET', '/api/admin/saraban/summary');
  check('summary storageConfigured', summary0.json?.storageConfigured === true, summary0.json);

  const up = await call('POST', '/api/admin/saraban/uploads', undefined, await pdf(2));
  check('upload pdf 201 pages 2', up.status === 201 && up.json.pages === 2 && up.json.format === 'pdf', up);
  created.push(up.json?.key);

  const gif = await call('POST', '/api/admin/saraban/uploads', undefined, new TextEncoder().encode('GIF89a....'));
  check('upload gif → 400 bad_format', gif.status === 400 && gif.json.error === 'bad_format', gif);

  const big = await call('POST', '/api/admin/saraban/uploads', undefined, new Uint8Array(10 * 1024 * 1024 + 1));
  check('upload 10MB+1 → 413', big.status === 413, big.status);

  const docId = randomUUID();
  const files = [{ key: up.json.key, name: 'หนังสือเชิญ.pdf' }];
  const r1 = await call('POST', '/api/admin/saraban/docs?kind=receive', receive(docId, files));
  check('receive 201 no 1 with file', r1.status === 201 && r1.json.no === 1 && r1.json.files[0]?.pages === 2, r1);
  const r2 = await call('POST', '/api/admin/saraban/docs?kind=receive', receive(docId, files));
  check('resend → 200 same no', r2.status === 200 && r2.json.no === 1, r2.status);

  const steal = await call('POST', '/api/admin/saraban/docs?kind=receive', receive(randomUUID(), files));
  check('reuse attached key → 400 invalid_file', steal.status === 400 && steal.json.error === 'invalid_file', steal);
  check('attached file survives failed request', (await headObject(up.json.key)) !== null);

  const orphan = await call('POST', '/api/admin/saraban/uploads', undefined, await pdf(1));
  const bad = await call('POST', '/api/admin/saraban/docs?kind=receive', {
    ...receive(randomUUID(), [{ key: orphan.json.key, name: 'x.pdf' }]),
    docDate: '2569-09-28',
  });
  check('invalid input → 400', bad.status === 400 && bad.json.error === 'invalid_input', bad.status);
  check('unattached file discarded on failure', (await headObject(orphan.json.key)) === null);

  const badUnit = await call('POST', '/api/admin/saraban/docs?kind=receive', { ...receive(randomUUID()), holderUnitId: 'nope' });
  check('unknown unit → 400 invalid_unit', badUnit.status === 400 && badUnit.json.error === 'invalid_unit', badUnit);

  const list = await call('GET', '/api/admin/saraban/docs?register=in');
  check('list total 1 · counts.pending 1 · today', list.json?.total === 1 && list.json.counts.pending === 1 && Boolean(list.json.today), list.json);

  const fileId = r1.json.files[0].id;
  const view = await call('GET', `/api/admin/saraban/docs/${docId}/files/${fileId}`);
  check('view → 302 to bucket', view.status === 302 && Boolean(view.location?.includes('storageapi')), view.status);
  const fetched = await fetch(view.location!);
  check('presigned link serves pdf', fetched.status === 200 && fetched.headers.get('content-type') === 'application/pdf', fetched.status);

  const v1 = r1.json.updatedAt;
  const edit = await call('PATCH', `/api/admin/saraban/docs/${docId}`, { action: 'edit', updatedAt: v1, edit: { subject: 'แก้เรื่อง', holderUnitId: 'mayor' } });
  const change = edit.json?.events?.at(-1)?.changes?.find((c: any) => c.field === 'holderUnitId');
  check('edit 200 · holder change stored as names', edit.status === 200 && change?.from === 'ปลัดเทศบาล' && change?.to === 'นายกเทศมนตรี', edit.json?.events?.at(-1));
  const stale = await call('PATCH', `/api/admin/saraban/docs/${docId}`, { action: 'edit', updatedAt: v1, edit: { subject: 'ทับ' } });
  check('stale version → 409 stale', stale.status === 409 && stale.json.error === 'stale', stale);
  const noop = await call('PATCH', `/api/admin/saraban/docs/${docId}`, { action: 'edit', updatedAt: edit.json.updatedAt, edit: { subject: 'แก้เรื่อง' } });
  check('no-op edit → 200 no new event', noop.status === 200 && noop.json.events.length === edit.json.events.length, noop.json?.events?.length);

  const up2 = await call('POST', '/api/admin/saraban/uploads', undefined, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
  created.push(up2.json?.key);
  const add = await call('POST', `/api/admin/saraban/docs/${docId}/files`, { file: { key: up2.json.key, name: 'รูป.jpg' } });
  check('add jpg 201 · 2 files', add.status === 201 && add.json.files.length === 2, add);
  const del = await call('DELETE', `/api/admin/saraban/docs/${docId}/files/${fileId}`);
  check('delete file 200 · 1 file left', del.status === 200 && del.json.files.length === 1, del);
  check('deleted object gone from bucket', (await headObject(up.json.key)) === null);
  const gone = await call('GET', `/api/admin/saraban/docs/${docId}/files/${fileId}`);
  check('view deleted file → 404', gone.status === 404, gone.status);

  const sendBody = { id: randomUUID(), ownerUnitId: 'office', docDate: '2026-10-02', party: 'นายอำเภอหางดง', subject: 'รายงาน' };
  const out = await call('POST', '/api/admin/saraban/docs?kind=send', sendBody);
  check('send 201 ref ชม 55201/1', out.status === 201 && out.json.ref === 'ชม 55201/1' && out.json.status === 'in-progress', out.json?.ref);
  const noRef = await call('POST', '/api/admin/saraban/docs?kind=send', { ...sendBody, id: randomUUID(), ownerUnitId: 'finance' });
  check('send from unit without refCode → 400 invalid_unit', noRef.status === 400 && noRef.json.error === 'invalid_unit', noRef);

  const sent = await call('PATCH', `/api/admin/saraban/docs/${out.json.id}`, { action: 'sent', updatedAt: out.json.updatedAt, method: 'post' });
  check('sent → done', sent.status === 200 && sent.json.status === 'done' && sent.json.sendMethod === 'post', sent.json?.status);
  const voidDone = await call('PATCH', `/api/admin/saraban/docs/${out.json.id}`, { action: 'void', updatedAt: sent.json.updatedAt, reason: 'x' });
  check('void done doc → 409 invalid_transition', voidDone.status === 409 && voidDone.json.error === 'invalid_transition', voidDone);

  const year = await call('GET', '/api/admin/saraban/years?register=circular');
  const start = await call('PUT', '/api/admin/saraban/years', { register: 'circular', fiscalYear: year.json.fiscalYear, startNo: 12 });
  check('set circular start 12', start.status === 200 && start.json.nextNo === 12, start.json);
  const circ = await call('POST', '/api/admin/saraban/docs?kind=send', { ...sendBody, id: randomUUID(), circular: true });
  check('circular gets no 12 ref ชม 55201/ว 12', circ.json?.no === 12 && circ.json.ref === 'ชม 55201/ว 12', circ.json?.ref);
  const inUse = await call('PUT', '/api/admin/saraban/years', { register: 'in', fiscalYear: year.json.fiscalYear, startNo: 5 });
  check('start on used year → 409 year_in_use', inUse.status === 409, inUse.status);

  const summary = await call('GET', '/api/admin/saraban/summary');
  check('summary inboxPending 1', summary.json?.inboxPending === 1, summary.json);
} finally {
  // เก็บกวาด bucket ทดสอบ: ทุก object ใต้ saraban/ ที่ smoke นี้อาจสร้าง
  for (const { key } of await listKeys()) await deleteObject(key);
  console.log(results.join('\n'));
  console.log(results.some((r) => r.startsWith('FAIL')) ? '\nSMOKE FAILED' : '\nSMOKE OK');
}
```

- [ ] **Step 2: รัน dev server (background) แล้วรัน smoke**

```bash
rm -f data/saraban-docs.json data/saraban-years.json data/saraban-units.json
MONGODB_URI= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= npx next dev -p 3123   # background
SMOKE_BASE=http://localhost:3123 npx tsx --env-file=.env.local scripts/smoke-saraban-api.mts
```
Expected: ทุกบรรทัดขึ้นต้นด้วย `ok` แล้วจบด้วย `SMOKE OK`
ถ้ามี `FAIL` — หยุด แก้ที่ route หรือฟังก์ชันที่เกี่ยวข้อง ห้ามแก้ค่าที่คาดไว้ให้ตรงผล

- [ ] **Step 3: ปิด dev server เก็บกวาด และตรวจทั้งโปรเจกต์**

```bash
rm -f data/saraban-docs.json data/saraban-years.json data/saraban-units.json
npx tsc --noEmit -p . && npm test && npm run lint && git status --short
```
Expected: ทุกอย่างผ่าน · `git status` เห็นเฉพาะ `scripts/smoke-saraban-api.mts`

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-saraban-api.mts
git commit -m "test(saraban): smoke ของ API ผ่าน dev server บน bucket ทดสอบ"
```

---

## Task 13: สคริปต์สำรองไฟล์ + รายงานไฟล์กำพร้า

สเปกข้อ 12 ข้อ 3 — Railway bucket ไม่มี backup อัตโนมัติ · ปลายทางจริงให้เทศบาลเลือก สคริปต์นี้คัดลอกลง
โฟลเดอร์ในเครื่อง (ฐานที่ใช้ได้ทันที ปลายทางอื่นเอาโฟลเดอร์นี้ไป sync ต่อได้) · ไม่ลบอะไรเลย

**Files:**
- Create: `scripts/saraban-backup.mts` · Modify: `package.json` (script `backup:saraban`)

- [ ] **Step 1: `scripts/saraban-backup.mts`**

```ts
// scripts/saraban-backup.mts
// สำรองไฟล์แนบสารบรรณทั้ง bucket ลงโฟลเดอร์ในเครื่อง + รายงานไฟล์กำพร้า (สเปกข้อ 12 ข้อ 3)
// รัน: npm run backup:saraban -- <โฟลเดอร์ปลายทาง>
// env: BUCKET_* ของ bucket ที่จะสำรอง · MONGODB_URI ถ้าต้องการรายงานไฟล์กำพร้าของ production
// ไม่ลบอะไรเลย: ไฟล์ที่มีอยู่แล้วขนาดเท่าเดิมข้าม (รันซ้ำได้) · ไฟล์กำพร้าแค่รายงาน

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getObjectBytes, isStorageConfigured, listKeys } from '@/lib/saraban-storage';
import { attachedKeys } from '@/lib/saraban-store';

const dest = process.argv[2];
if (!dest) {
  console.error('ใช้: npm run backup:saraban -- <โฟลเดอร์ปลายทาง>');
  process.exit(1);
}
if (!isStorageConfigured()) {
  console.error('ไม่มี BUCKET_* ใน env');
  process.exit(1);
}

const objects = await listKeys();
let copied = 0;
let skipped = 0;
for (const { key, bytes } of objects) {
  const target = path.join(dest, key);
  const existing = await fs.stat(target).catch(() => null);
  if (existing?.size === bytes) {
    skipped += 1;
    continue;
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, await getObjectBytes(key));
  copied += 1;
}
console.log(`สำรอง ${objects.length} ไฟล์ → ${dest} (คัดลอก ${copied} · มีอยู่แล้ว ${skipped})`);

const attached = await attachedKeys(objects.map((o) => o.key));
const orphans = objects.filter((o) => !attached.has(o.key));
console.log(`ไฟล์กำพร้า (ไม่ผูกกับหนังสือเรื่องใด) ${orphans.length} ไฟล์`);
for (const o of orphans) console.log(`  ${o.key} (${o.bytes} bytes)`);
```

- [ ] **Step 2: `package.json` — เพิ่มใน `scripts` ต่อจาก `"import:forest"`**

```json
    "backup:saraban": "tsx --env-file-if-exists=.env.local scripts/saraban-backup.mts"
```

- [ ] **Step 3: รันกับ bucket ทดสอบ**

```bash
rm -rf /tmp/saraban-backup-smoke && MONGODB_URI= npm run backup:saraban -- /tmp/saraban-backup-smoke
```
Expected: `สำรอง 0 ไฟล์ …` และ `ไฟล์กำพร้า … 0 ไฟล์` (smoke ของ Task 12 เก็บกวาด bucket แล้ว) — ไม่มี error

- [ ] **Step 4: ตรวจและ Commit**

```bash
npx tsc --noEmit -p . && npm run lint
git add scripts/saraban-backup.mts package.json
git commit -m "feat(saraban): สคริปต์สำรองไฟล์แนบและรายงานไฟล์กำพร้า"
```

---

## ส่งต่อรอบ 1C (หน้าจอ)

| ใช้ทำอะไรใน 1C | API |
|---|---|
| sidebar badge + ซ่อนช่องแนบไฟล์ | `GET /api/admin/saraban/summary` → `{ inboxPending, storageConfigured, today }` |
| ทะเบียน | `GET /docs?register=&year=&view=&page=` → `{ docs, total, page, pageSize, fiscalYear, years, counts, carryOver, today }` |
| ลงรับ / ออกเลข | อัปทีละไฟล์ `POST /uploads` (body = File ดิบ) → `{ key }` แล้ว `POST /docs?kind=receive|send` พร้อม `files: [{ key, name }]` · `id` สร้างครั้งเดียวต่อการเปิดฟอร์ม (`crypto.randomUUID()`) |
| หน้าหนังสือ | `GET /docs/[id]` · `PATCH` edit/void/sent ส่ง `updatedAt` ที่เห็น · `409 stale` = โหลดใหม่ |
| ไฟล์แนบ | ลิงก์เปิดดู = `/api/admin/saraban/docs/[id]/files/[fileId]` ตรง ๆ (`<a target="_blank">`) · เพิ่ม `POST /docs/[id]/files` · ลบ `DELETE` |
| สมุดผู้รับ / เลขเริ่มต้น | `GET/POST /units` · `PATCH /units/[id]` · `GET/PUT /years` |

- ข้อความผิดพลาดภาษาไทยตามรหัส: `number_busy` "มีคนลงรับพร้อมกัน กดอีกครั้ง" · `stale` "มีคนแก้หนังสือนี้ไปก่อน
  โหลดใหม่แล้วลองอีกครั้ง" · `invalid_unit` · `invalid_file` · `file_too_large` · `bad_format` ·
  `storage_not_configured`
- ปุ่มกรองแยกตามทะเบียน (`viewsOf(register)` บริสุทธิ์) — บันทึกในหัวข้อ "บันทึกไว้ให้รอบ 1C" ของแผน 1A
