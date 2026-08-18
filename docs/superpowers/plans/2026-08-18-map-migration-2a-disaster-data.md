# ย้าย namphrae-map รอบที่ 2A: ชั้นข้อมูลและ API ภัยพิบัติ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ข้อมูลเหตุสาธารณภัยอ่าน/เขียนได้ผ่าน API ของ portal เอง โดยไม่มีหน้าเว็บใหม่และไม่แตะ mongoose

**Architecture:** แทน `models/Incident.ts` (mongoose) ด้วย `src/lib/disaster-store.ts` ที่ใช้ driver ดิบเหมือน `map-store.ts`/`jobs-store.ts` ของ portal — แยกฟังก์ชันบริสุทธิ์ (สร้าง filter, แปลง document, ประกอบฟิลด์) ออกมาให้ vitest ยิงตรงได้ ส่วน I/O เป็นเปลือกบาง ๆ แล้ววาง API 4 เส้นบนนั้น: สาธารณะสองเส้นอ่านอย่างเดียว หลังบ้านสองเส้นยาม `requireFeature('disaster')`

**Tech Stack:** Next.js 16 (Pages Router) · TypeScript · MongoDB driver ดิบ · zod · vitest

**Spec:** [2026-08-17-namphrae-map-migration-design.md](../specs/2026-08-17-namphrae-map-migration-design.md) — รอบ 2 ข้อ "ภัยพิบัติ"

**แผนก่อนหน้า:** [2026-08-17-map-migration-1-foundation.md](2026-08-17-map-migration-1-foundation.md) (รอบ 1 เสร็จแล้ว)

---

## ขอบเขต: ทำไมแยกเป็น 2A

สเปกวางรอบ 2 ไว้เป็นก้อนเดียว (store + API + 3 หน้า + component แผนที่/กราฟ) ซึ่งเป็น ~18 ไฟล์
แผนนี้ตัดเอาเฉพาะ **ชั้นข้อมูลกับ API** เพราะมันเป็นซอฟต์แวร์ที่ทำงานได้และตรวจสอบได้ด้วยตัวเอง
(ยิง `curl` ดูได้) merge เข้า main ได้โดยไม่เปลี่ยนอะไรที่ผู้ใช้เห็น และเป็นฐานที่ 2B ต้องใช้

**2B (แผนถัดไป)** คือ component แผนที่/กราฟ กับหน้า `/disaster`, `/disaster/insights`, `/admin/disaster`

---

## ต้องรู้ก่อนเริ่ม

**สถานะปัจจุบัน:** รอบ 1 เสร็จแล้ว 15 commits บน `feature/map-migration` — **394 เทสต์ 38 ไฟล์**
ตรรกะบริสุทธิ์ทั้งหมดยกมาแล้ว: `disaster-types`, `disaster-stats`, `disaster-admin-view`,
`disaster-options`, `disaster-schema`, `disaster-image`, `village-geo` และ `src/types/disaster.ts`
รวมทั้ง `db-indexes.ts` ที่ประกาศดัชนีของ `incidents` ไว้แล้ว

**⚠️ collection `incidents` ใน `namphrae_portal` ยังว่างเปล่า** — สคริปต์คัดลอกเขียนเสร็จและ
dry-run ผ่านแล้ว (626 รายการ) แต่ยังไม่ได้รันจริง ดู Task 0

**ต้นทางที่แทนที่:** `namphrae-map/models/Incident.ts` + `pages/api/incidents/{index,[id],stats}.ts`
โครงสร้าง document ต้องตรงกันเป๊ะเพราะข้อมูลถูกคัดลอกมาทั้งก้อนโดยไม่แปลงรูป

```ts
// models/Incident.ts ของต้นทาง — โครงที่ document จริงใน db มีอยู่
{
  disasterType: String (enum DISASTER_TYPES, required),
  year: Number (พ.ศ., required),
  date: Date (required),
  dateText: String (required),
  method: String (default ''),
  areaType: String (default ''),
  location: { type: 'Point', coordinates: [lng, lat] },
  imageFile: String (default ''),
  createdBy: String,
  createdAt / updatedAt   // จาก timestamps: true
}
```

**กติกาของ repo:**
- `@/` map ไป `src/`
- คอมเมนต์ภาษาไทย อธิบาย **ทำไม** ไม่ใช่ทำอะไร
- vitest ทดสอบเฉพาะตรรกะบริสุทธิ์ **ห้ามแตะ DB/network ในเทสต์**
- `api-guard-coverage.test.ts` บังคับให้ทุกไฟล์ใต้ `src/pages/api/admin/` เรียก `requireFeature()`
  หรือ `requireManager()` — route ใหม่ที่ลืมจะตกเทสต์ทันที ไม่ต้องเพิ่ม allowlist
- route ของ portal คืน object เปล่า (`{ layers: [...] }`) และใช้คีย์ `error` ตอนพลาด
  **ไม่ใช่** ซอง `{ success, data }` แบบ namphrae-map — สเปกข้อ 6 พิสูจน์ parity ด้วยเทสต์ตรรกะ
  กับการเทียบด้วยตา ไม่ได้บังคับรูปแบบ response และหน้าเว็บถูกเขียนใหม่อยู่แล้วใน 2B

---

## สองการเปลี่ยนพฤติกรรมที่ตั้งใจ — อ่านก่อนลงมือ

**1. `requireFeature('disaster')` แทน `requireDbUser`**
ต้นทางยาม POST/PUT/DELETE ด้วย "เป็นสมาชิกในทะเบียนไหม" เฉย ๆ พอมาที่ portal ต้องมีสิทธิ์
`disaster` ด้วย สมาชิกที่ผู้จัดการยังไม่เปิดให้จะแก้ข้อมูลภัยพิบัติไม่ได้อีกต่อไป — ตรงกับ
ข้อตกลงข้อ 2 ของสเปกที่ให้ใช้ระบบสิทธิ์ของ portal และเป็นการหดสิทธิ์ให้แคบลง

**2. API สาธารณะไม่คืน `createdBy` อีกต่อไป**
ต้นทางคืนทั้ง document ผ่าน `.lean()` จึงมี `createdBy` (Clerk user ID ของเจ้าหน้าที่)
`createdAt`/`updatedAt` และ `__v` ติดไปด้วยทุกครั้ง **บน endpoint สาธารณะที่ไม่ต้องล็อกอิน**
ชนิด `IncidentItem` ที่หน้าเว็บใช้ไม่มีฟิลด์พวกนี้อยู่แล้ว การตัดออกจึงไม่กระทบสิ่งที่ผู้ใช้เห็น
แต่หยุดการเปิดเผยรหัสผู้ใช้ของเจ้าหน้าที่ต่อสาธารณะ

`toIncidentItem()` เป็นตัวบังคับเรื่องนี้ที่จุดเดียว และมีเทสต์ตรึงไว้

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/disaster-store.ts` (สร้าง) | ทะเบียนเหตุภัยพิบัติ — ฟังก์ชันบริสุทธิ์ + I/O บาง ๆ บน driver ดิบ |
| `src/lib/disaster-store.test.ts` (สร้าง) | เทสต์เฉพาะส่วนบริสุทธิ์ |
| `src/pages/api/disaster/incidents.ts` (สร้าง) | GET สาธารณะ รายการเหตุ กรองด้วย type/year |
| `src/pages/api/disaster/stats.ts` (สร้าง) | GET สาธารณะ สถิติรายปีต่อประเภท |
| `src/pages/api/admin/disaster/incidents.ts` (สร้าง) | GET, POST — ยาม `disaster` |
| `src/pages/api/admin/disaster/incidents/[id].ts` (สร้าง) | GET, PUT, DELETE — ยาม `disaster` |

`disaster-store.ts` แยกฟังก์ชันบริสุทธิ์ออกจาก I/O ด้วยเหตุผลเดียวกับ `map-store.ts` ที่เขียน
กำกับไว้ในไฟล์นั้น: ให้เทสต์ยิงตรงได้โดยไม่ต้องแตะ Mongo และรับ `now`/`id` เป็นพารามิเตอร์แทนที่
จะเรียก `Date.now()`/`randomUUID()` ข้างใน เพื่อให้ตรึงค่าที่เขียนลง document ได้จริง

---

## Task 0: คัดลอกข้อมูลก่อน (ทำครั้งเดียว)

**ไม่มีไฟล์ให้แก้** — เป็นการรันสคริปต์ที่ Task 10 ของรอบ 1 เขียนไว้แล้ว

Task 1–5 เขียนโค้ดได้โดยไม่ต้องมีข้อมูล แต่ Task 6 (ตรวจด้วย `curl`) จะได้ `[]` เปล่าถ้าไม่รัน

- [ ] **Step 1: ซ้อมก่อน**

```bash
npm run copy:map -- --dry-run
```
Expected: `incidents` 374 · `diseaseCases` 176 · `diseaseYearStats` 10 · `chikunMooYears` 66 รวม 626
ทุกบรรทัดขึ้น "อัปเดต 0" (ถ้าเคยรันจริงมาแล้วจะกลับกัน — "เพิ่ม 0" แทน ซึ่งก็ถูก)

- [ ] **Step 2: คัดลอกจริง**

```bash
npm run copy:map
```
Expected: ตารางเดิม + บรรทัด `สร้างดัชนีครบแล้ว` และสคริปต์ออกเองภายในไม่กี่นาที

**เขียนลง production** — สร้าง 4 collection ใหม่ใน `namphrae_portal` ไม่ทับของเดิม
ต้นทาง `db_namphrae` ถูกอ่านอย่างเดียว ยกเลิกได้ด้วย `db.incidents.drop()` และอีกสามตัว

- [ ] **Step 3: รันซ้ำพิสูจน์ว่ารันซ้ำได้**

```bash
npm run copy:map
```
Expected: ทุก collection ขึ้น "เพิ่ม 0" และ "อัปเดต" เท่ากับจำนวนทั้งหมด

- [ ] **Step 4: ตรวจดัชนีขึ้นจริง**

```bash
node --env-file=.env.local -e '
const { MongoClient } = require("mongodb");
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db(process.env.MONGODB_DB || "namphrae_portal");
  const ix = await db.collection("incidents").indexes();
  console.log(ix.map(i => i.name).join(" | "));
  console.log("จำนวนเหตุ:", await db.collection("incidents").countDocuments());
  await c.close();
})();
'
```
Expected: มี `location_2dsphere` และ `disasterType_1_year_1` · จำนวนเหตุ 374

ไม่ต้อง commit อะไรใน Task นี้

---

## Task 1: `disaster-store.ts` — ฟังก์ชันบริสุทธิ์

**Files:**
- Create: `src/lib/disaster-store.ts`
- Test: `src/lib/disaster-store.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/disaster-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ObjectId } from 'mongodb';
import {
  buildIncidentFields,
  buildIncidentFilter,
  toIncidentItem,
  type IncidentDoc,
} from '@/lib/disaster-store';
import type { IncidentInput } from '@/lib/disaster-schema';

const OID = new ObjectId('64b7f0c2e1a2b3c4d5e6f700');

const doc = (over: Partial<IncidentDoc> = {}): IncidentDoc => ({
  _id: OID,
  disasterType: 'FLOOD',
  year: 2566,
  date: new Date('2023-08-14T00:00:00.000Z'),
  dateText: '14 ส.ค. 2566',
  method: 'สูบน้ำ',
  areaType: 'พื้นที่เกษตร',
  location: { type: 'Point', coordinates: [98.9, 18.7] },
  imageFile: 'flood.jpg',
  createdBy: 'user_secret123',
  createdAt: new Date('2023-08-15T00:00:00.000Z'),
  updatedAt: new Date('2023-08-16T00:00:00.000Z'),
  ...over,
});

const input = (over: Partial<IncidentInput> = {}): IncidentInput => ({
  disasterType: 'WILDFIRE',
  year: 2567,
  dateText: '3 มี.ค. 2567',
  method: '',
  areaType: '',
  lat: 18.68,
  lng: 98.86,
  imageFile: '',
  ...over,
});

describe('buildIncidentFilter', () => {
  it('ไม่ส่งอะไรมา = ไม่กรอง', () => {
    expect(buildIncidentFilter({})).toEqual({});
  });

  it('กรองตามประเภท', () => {
    expect(buildIncidentFilter({ type: 'FLOOD' })).toEqual({ disasterType: 'FLOOD' });
  });

  it('กรองตามปี — แปลงเป็นตัวเลข เพราะ query string เป็นข้อความเสมอ', () => {
    expect(buildIncidentFilter({ year: '2566' })).toEqual({ year: 2566 });
  });

  it('กรองพร้อมกันสองอย่าง', () => {
    expect(buildIncidentFilter({ type: 'DROUGHT', year: '2565' })).toEqual({
      disasterType: 'DROUGHT',
      year: 2565,
    });
  });

  it('ค่าว่างไม่นับเป็นตัวกรอง', () => {
    expect(buildIncidentFilter({ type: '', year: '' })).toEqual({});
  });

  // ตรึงพฤติกรรมเดิมของ namphrae-map ไว้ตามตรง: ปีที่ไม่ใช่ตัวเลขกลายเป็น NaN
  // ซึ่งไม่ match อะไรเลย = คืนรายการว่าง ไม่ใช่คืนทุกรายการ การ "แก้" ให้ข้ามตัวกรอง
  // ทิ้งจะแย่กว่า เพราะผู้ใช้ขอปีเจาะจงแล้วได้ข้อมูลทุกปีกลับไปโดยไม่รู้ตัว
  it('ปีที่ไม่ใช่ตัวเลขให้ NaN — กรองแล้วไม่เจออะไร ไม่ใช่เจอทุกอัน', () => {
    const f = buildIncidentFilter({ year: 'abc' }) as { year: number };
    expect(Number.isNaN(f.year)).toBe(true);
  });
});

describe('toIncidentItem', () => {
  it('แปลง _id และ date เป็นข้อความให้ตรงกับชนิด IncidentItem', () => {
    const item = toIncidentItem(doc());
    expect(item._id).toBe('64b7f0c2e1a2b3c4d5e6f700');
    expect(item.date).toBe('2023-08-14T00:00:00.000Z');
  });

  // เหตุผลอยู่ในหัวข้อ "สองการเปลี่ยนพฤติกรรมที่ตั้งใจ" ของแผน — endpoint สาธารณะ
  // ของต้นทางคืน createdBy ซึ่งเป็น Clerk user ID ของเจ้าหน้าที่ออกไปด้วย
  it('ไม่คืน createdBy / createdAt / updatedAt ออกไปเด็ดขาด', () => {
    const item = toIncidentItem(doc()) as Record<string, unknown>;
    expect(item.createdBy).toBeUndefined();
    expect(item.createdAt).toBeUndefined();
    expect(item.updatedAt).toBeUndefined();
    expect(JSON.stringify(item)).not.toContain('user_secret123');
  });

  it('คืนคีย์ครบตามที่หน้าเว็บใช้ ไม่ขาดไม่เกิน', () => {
    expect(Object.keys(toIncidentItem(doc())).sort()).toEqual([
      '_id', 'areaType', 'date', 'dateText', 'disasterType',
      'imageFile', 'location', 'method', 'year',
    ]);
  });

  it('พิกัดคงลำดับ [lng, lat] ไว้เหมือนเดิม', () => {
    expect(toIncidentItem(doc()).location.coordinates).toEqual([98.9, 18.7]);
  });

  it('ฟิลด์ที่ document เก่าไม่มี กลายเป็นค่าว่าง ไม่ใช่ undefined', () => {
    const bare = doc();
    delete (bare as Record<string, unknown>).method;
    delete (bare as Record<string, unknown>).areaType;
    delete (bare as Record<string, unknown>).imageFile;
    const item = toIncidentItem(bare);
    expect(item.method).toBe('');
    expect(item.areaType).toBe('');
    expect(item.imageFile).toBe('');
  });
});

describe('buildIncidentFields', () => {
  it('แปลง lat/lng เป็น GeoJSON Point ลำดับ [lng, lat]', () => {
    const f = buildIncidentFields(input({ lat: 18.68, lng: 98.86 }));
    expect(f.location).toEqual({ type: 'Point', coordinates: [98.86, 18.68] });
  });

  it('อ่านวันที่จากข้อความไทยได้', () => {
    const f = buildIncidentFields(input({ dateText: '3 มี.ค. 2567', year: 2567 }));
    expect(f.date.getUTCFullYear()).toBe(2024);
    expect(f.date.getUTCMonth()).toBe(2);
    expect(f.date.getUTCDate()).toBe(3);
  });

  // ตรงกับต้นทาง: parseThaiDate(dateText) ?? new Date(Date.UTC(year - 543, 0, 1))
  it('อ่านข้อความไม่ออกให้ถอยไปเป็น 1 ม.ค. ของปีนั้น ไม่ใช่ปล่อยว่าง', () => {
    const f = buildIncidentFields(input({ dateText: 'เมื่อวานซืน', year: 2566 }));
    expect(f.date.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('ไม่พา lat/lng ดิบติดไปกับ document', () => {
    const f = buildIncidentFields(input()) as Record<string, unknown>;
    expect(f.lat).toBeUndefined();
    expect(f.lng).toBeUndefined();
  });

  it('เก็บฟิลด์เนื้อหาไว้ครบ', () => {
    const f = buildIncidentFields(input({ method: 'ดับไฟ', areaType: 'ป่า', imageFile: 'a.jpg' }));
    expect(f.disasterType).toBe('WILDFIRE');
    expect(f.year).toBe(2567);
    expect(f.dateText).toBe('3 มี.ค. 2567');
    expect(f.method).toBe('ดับไฟ');
    expect(f.areaType).toBe('ป่า');
    expect(f.imageFile).toBe('a.jpg');
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run src/lib/disaster-store.test.ts`
Expected: FAIL — resolve `@/lib/disaster-store` ไม่ได้

- [ ] **Step 3: เขียน `src/lib/disaster-store.ts`**

```ts
import { ObjectId, type Filter } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type { DisasterType } from '@/lib/disaster-types';
import type { IncidentInput } from '@/lib/disaster-schema';
import { parseThaiDate } from '@/lib/thai-date';
import type { IncidentItem, YearStat } from '@/types/disaster';

// ทะเบียนเหตุสาธารณภัย — ย้ายมาจาก namphrae-map/models/Incident.ts ซึ่งเป็น mongoose
//
// portal ใช้ driver ดิบทั้งระบบ การพา mongoose เข้ามาเพื่อ collection เดียวจะได้ ODM
// สองตัวในโปรเจกต์เดียวและ connection pool คนละชุด — โครง document ไม่เปลี่ยนแม้แต่
// ฟิลด์เดียวเพราะข้อมูลถูกคัดลอกมาทั้งก้อนโดยไม่แปลงรูป (scripts/copy-map-data.ts)
//
// แยกฟังก์ชันบริสุทธิ์ไว้ข้างบนให้เทสต์เรียกตรงได้โดยไม่ต้องแตะ Mongo ด้วยเหตุผล
// เดียวกับ map-store.ts และรับ now/actor เป็นพารามิเตอร์แทนที่จะเรียกเองข้างใน
// เพื่อให้ตรึงค่าที่เขียนลง document ได้จริง ไม่ใช่ได้แค่ตรวจว่า "มีฟิลด์นั้นอยู่"

const COLLECTION = 'incidents';

/** โครง document จริงใน collection — ตรงกับ schema เดิมของ mongoose ทุกฟิลด์ */
export type IncidentDoc = {
  _id: ObjectId;
  disasterType: DisasterType;
  year: number;
  date: Date;
  dateText: string;
  method?: string;
  areaType?: string;
  location: { type: 'Point'; coordinates: [number, number] };
  imageFile?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

// ── ฟังก์ชันบริสุทธิ์ ────────────────────────────────────────────────────────

/**
 * ตัวกรองจาก query string
 *
 * `Number(year)` ให้ NaN เมื่อค่าไม่ใช่ตัวเลข ซึ่ง Mongo จะไม่ match อะไรเลย =
 * คืนรายการว่าง ตรงกับพฤติกรรมเดิมของ namphrae-map และเป็นผลที่ถูกต้องกว่าการ
 * ข้ามตัวกรองทิ้ง — ผู้ใช้ขอปีเจาะจงแล้วได้ข้อมูลทุกปีกลับไปโดยไม่รู้ตัวแย่กว่า
 */
export function buildIncidentFilter(q: {
  type?: string;
  year?: string;
}): Filter<IncidentDoc> {
  const filter: Filter<IncidentDoc> = {};
  if (q.type) filter.disasterType = q.type as DisasterType;
  if (q.year) filter.year = Number(q.year);
  return filter;
}

/**
 * document → รูปที่หน้าเว็บใช้
 *
 * นี่คือจุดเดียวที่กัน createdBy (Clerk user ID ของเจ้าหน้าที่) createdAt/updatedAt
 * ไม่ให้หลุดออก API สาธารณะ — ต้นทางคืนทั้ง document ผ่าน .lean() จึงส่งรหัสผู้ใช้
 * ออกไปให้คนทั้งอินเทอร์เน็ตทุกครั้งที่มีคนเปิดหน้าแผนที่
 *
 * ประกาศฟิลด์ทีละตัวแทนการ destructure ส่วนที่ไม่เอาออก เพราะฟิลด์ใหม่ที่ใครเพิ่มลง
 * document วันหน้าจะได้ไม่ไหลออกไปเองโดยอัตโนมัติ
 */
export function toIncidentItem(doc: IncidentDoc): IncidentItem {
  return {
    _id: doc._id.toString(),
    disasterType: doc.disasterType,
    year: doc.year,
    date: doc.date.toISOString(),
    dateText: doc.dateText,
    method: doc.method ?? '',
    areaType: doc.areaType ?? '',
    location: doc.location,
    imageFile: doc.imageFile ?? '',
  };
}

/**
 * input จากฟอร์ม → ฟิลด์ที่เขียนลง document
 *
 * `date` มาจากการอ่าน `dateText` ภาษาไทย ถ้าอ่านไม่ออกให้ถอยไป 1 ม.ค. ของปีนั้น
 * (พ.ศ. − 543) — ตรงกับต้นทาง เพราะกราฟรายเดือนต้องมีวันที่เสมอ ปล่อยว่างไม่ได้
 */
export function buildIncidentFields(input: IncidentInput): Omit<IncidentDoc, '_id'> {
  const { lat, lng, ...rest } = input;
  return {
    ...rest,
    date: parseThaiDate(input.dateText) ?? new Date(Date.UTC(input.year - 543, 0, 1)),
    location: { type: 'Point', coordinates: [lng, lat] },
  };
}

// ── I/O ──────────────────────────────────────────────────────────────────────

async function col() {
  return (await getDb()).collection<IncidentDoc>(COLLECTION);
}

export async function listIncidents(filter: Filter<IncidentDoc>): Promise<IncidentItem[]> {
  const rows = await (await col()).find(filter).sort({ date: 1 }).toArray();
  return rows.map(toIncidentItem);
}

/** null เมื่อ id ไม่ใช่ ObjectId ที่ถูกรูป ผู้เรียกจึงตอบ 404 ได้โดยไม่ต้องเช็คเอง */
export async function getIncident(id: string): Promise<IncidentItem | null> {
  if (!ObjectId.isValid(id)) return null;
  const row = await (await col()).findOne({ _id: new ObjectId(id) });
  return row ? toIncidentItem(row) : null;
}

export async function insertIncident(
  input: IncidentInput,
  actor: string,
  now: Date
): Promise<IncidentItem> {
  // ไม่ต้อง cast: driver ทำให้ _id เป็น optional ให้เองตอน insert
  // (OptionalUnlessRequiredId) เพราะมันเป็นคนสร้าง ObjectId ให้
  const doc = {
    ...buildIncidentFields(input),
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  };
  const res = await (await col()).insertOne(doc);
  return toIncidentItem({ ...doc, _id: res.insertedId });
}

/**
 * ไม่แตะ createdBy/createdAt — คนแก้ทีหลังไม่ควรกลายเป็นคนสร้าง ประวัติจะโกหก
 */
export async function updateIncident(
  id: string,
  input: IncidentInput,
  now: Date
): Promise<IncidentItem | null> {
  if (!ObjectId.isValid(id)) return null;
  const row = await (await col()).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...buildIncidentFields(input), updatedAt: now } },
    { returnDocument: 'after' }
  );
  return row ? toIncidentItem(row) : null;
}

export async function deleteIncident(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const res = await (await col()).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}

/** สถิติรายปีต่อประเภท — pipeline เดียวกับ pages/api/incidents/stats.ts ของต้นทาง */
export async function incidentYearStats(): Promise<YearStat[]> {
  return (await col())
    .aggregate<YearStat>([
      { $group: { _id: { year: '$year', disasterType: '$disasterType' }, count: { $sum: 1 } } },
      { $project: { _id: 0, year: '$_id.year', disasterType: '$_id.disasterType', count: 1 } },
      { $sort: { year: 1 } },
    ])
    .toArray();
}
```

- [ ] **Step 4: รันเทสต์ให้เขียว**

Run: `npx vitest run src/lib/disaster-store.test.ts`
Expected: PASS ทั้ง 16 เคส

Run: `npx tsc --noEmit && npm test`
Expected: สะอาด — จาก 394/38 เป็น 410/39

- [ ] **Step 5: Commit**

```bash
git add src/lib/disaster-store.ts src/lib/disaster-store.test.ts
git commit -m "feat(disaster): ทะเบียนเหตุภัยพิบัติบน driver ดิบแทน mongoose"
```

---

## Task 2: API สาธารณะ — รายการเหตุ

**Files:**
- Create: `src/pages/api/disaster/incidents.ts`

- [ ] **Step 1: เขียน route**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { buildIncidentFilter, listIncidents } from '@/lib/disaster-store';

// รายการเหตุสาธารณภัย — สาธารณะ ไม่ต้องล็อกอิน (เดิมคือ GET /api/incidents)
//
// ฟิลด์ที่คืนถูกจำกัดด้วย toIncidentItem() ใน store ไม่ใช่ที่นี่ — createdBy ซึ่งเป็น
// รหัสผู้ใช้ของเจ้าหน้าที่จึงไม่มีทางหลุดออกไปแม้จะมีคนแก้ route นี้ทีหลัง
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const incidents = await listIncidents(
    buildIncidentFilter({
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      year: typeof req.query.year === 'string' ? req.query.year : undefined,
    })
  );

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ incidents });
}
```

`typeof … === 'string'` ไม่ใช่พิธีกรรม — Next คืนอาเรย์เมื่อ query key ซ้ำ (`?type=A&type=B`)
ถ้าส่งอาเรย์เข้า `buildIncidentFilter` ตรง ๆ จะได้ตัวกรองที่ Mongo ตีความคนละแบบ

- [ ] **Step 2: ตรวจว่าคอมไพล์และเทสต์ยังเขียว**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: สะอาด จำนวนเทสต์ไม่เปลี่ยน (410/39)

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/disaster/incidents.ts
git commit -m "feat(disaster): API สาธารณะรายการเหตุภัยพิบัติ"
```

---

## Task 3: API สาธารณะ — สถิติรายปี

**Files:**
- Create: `src/pages/api/disaster/stats.ts`

- [ ] **Step 1: เขียน route**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { incidentYearStats } from '@/lib/disaster-store';

// สถิติจำนวนเหตุรายปีต่อประเภท — สาธารณะ (เดิมคือ GET /api/incidents/stats)
// นับด้วย aggregation ที่ฝั่ง Mongo ไม่ใช่ดึงทุกเหตุมานับที่นี่ เพราะหน้าแรกเรียก
// เส้นนี้ทุกครั้งที่เปิด และจำนวนเหตุโตขึ้นเรื่อย ๆ ตามปีที่ผ่านไป
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const stats = await incidentYearStats();
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ stats });
}
```

- [ ] **Step 2: ตรวจ**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: สะอาด 410/39

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/disaster/stats.ts
git commit -m "feat(disaster): API สาธารณะสถิติเหตุรายปี"
```

---

## Task 4: API หลังบ้าน — สร้างและรายการ

**Files:**
- Create: `src/pages/api/admin/disaster/incidents.ts`

- [ ] **Step 1: เขียน route**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { incidentInputSchema } from '@/lib/disaster-schema';
import { buildIncidentFilter, insertIncident, listIncidents } from '@/lib/disaster-store';

// จัดการเหตุสาธารณภัย — ต้องมีสิทธิ์ disaster
//
// ต้นทางยามด้วย requireDbUser คือ "อยู่ในทะเบียนผู้ใช้ไหม" เฉย ๆ ที่นี่เข้มขึ้นเป็น
// สิทธิ์รายฟีเจอร์ตามระบบของ portal — สมาชิกที่ผู้จัดการยังไม่เปิด disaster ให้
// จะแก้ข้อมูลภัยพิบัติไม่ได้ เป็นการหดสิทธิ์ให้แคบลงตามที่สเปกข้อ 1 ระบุไว้
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'disaster');
  if (!admin) return;

  if (req.method === 'GET') {
    const incidents = await listIncidents(
      buildIncidentFilter({
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
        year: typeof req.query.year === 'string' ? req.query.year : undefined,
      })
    );
    return res.status(200).json({ incidents });
  }

  if (req.method === 'POST') {
    const parsed = incidentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_body', detail: parsed.error.issues });
    }
    const incident = await insertIncident(parsed.data, admin.userId, new Date());
    return res.status(201).json({ incident });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
```

- [ ] **Step 2: ตรวจว่า guard coverage ผ่าน**

Run: `npx vitest run src/lib/api-guard-coverage.test.ts`
Expected: PASS และรายชื่อไฟล์ที่ทดสอบมี `disaster/incidents.ts` โผล่ขึ้นมา

เทสต์นี้เดินทุกไฟล์ใต้ `src/pages/api/admin/` เอง ไม่ต้องเพิ่มอะไรให้มัน

- [ ] **Step 3: ตรวจทั้งหมด**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: สะอาด — จำนวนไฟล์เทสต์เท่าเดิม แต่เคสใน `api-guard-coverage` เพิ่มขึ้น 1

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/disaster/incidents.ts
git commit -m "feat(disaster): API หลังบ้านสร้างและอ่านรายการเหตุ"
```

---

## Task 5: API หลังบ้าน — แก้และลบรายตัว

**Files:**
- Create: `src/pages/api/admin/disaster/incidents/[id].ts`

- [ ] **Step 1: เขียน route**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { incidentInputSchema } from '@/lib/disaster-schema';
import { deleteIncident, getIncident, updateIncident } from '@/lib/disaster-store';

// อ่าน/แก้/ลบเหตุรายตัว — ต้องมีสิทธิ์ disaster ทุกเมธอด
//
// ต่างจากต้นทางตรงที่ GET ก็ต้องมีสิทธิ์ด้วย ต้นทางเปิด GET /api/incidents/[id]
// ให้สาธารณะ แต่ที่นี่ไม่ต้องเปิด เพราะหน้าเว็บสาธารณะดึงทั้งรายการจาก
// /api/disaster/incidents อยู่แล้ว ไม่เคยเรียกรายตัว — ไม่มีใครเสียอะไร
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'disaster');
  if (!admin) return;

  const id = String(req.query.id);

  if (req.method === 'GET') {
    const incident = await getIncident(id);
    if (!incident) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ incident });
  }

  if (req.method === 'PUT') {
    const parsed = incidentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_body', detail: parsed.error.issues });
    }
    const incident = await updateIncident(id, parsed.data, new Date());
    if (!incident) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ incident });
  }

  if (req.method === 'DELETE') {
    const ok = await deleteIncident(id);
    if (!ok) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ id });
  }

  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
```

`id` ที่ไม่ใช่ ObjectId ที่ถูกรูปไม่ต้องเช็คที่นี่ — store คืน `null`/`false` ให้เอง แล้วกลายเป็น
404 ซึ่งเป็นคำตอบที่ถูกอยู่แล้ว (ต้นทางตอบ 400 แยกไว้ ซึ่งบอกใบ้ว่า id นั้นมีรูปแบบถูกหรือผิด
โดยไม่จำเป็น)

- [ ] **Step 2: ตรวจทั้งหมด**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: สะอาด เคสใน `api-guard-coverage` เพิ่มอีก 1

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/disaster/incidents/\[id\].ts
git commit -m "feat(disaster): API หลังบ้านแก้และลบเหตุรายตัว"
```

---

## Task 6: ตรวจด้วยของจริง

ขั้นนี้ไม่มีเทสต์อัตโนมัติแทนได้ — ต้องยิงจริงกับข้อมูลจริง

- [ ] **Step 1: เปิด dev server**

```bash
npm run dev
```

- [ ] **Step 2: API สาธารณะต้องเปิดได้โดยไม่ล็อกอิน**

```bash
curl -s 'http://localhost:3000/api/disaster/incidents' | head -c 400; echo
curl -s 'http://localhost:3000/api/disaster/incidents' | python3 -c 'import json,sys; d=json.load(sys.stdin); print("จำนวน:", len(d["incidents"]))'
```
Expected: จำนวน **374**

```bash
curl -s 'http://localhost:3000/api/disaster/stats' | python3 -c '
import json,sys
d=json.load(sys.stdin)["stats"]
print("แถวสถิติ:", len(d), "| รวมนับได้:", sum(r["count"] for r in d))
print("ปีที่มี:", sorted({r["year"] for r in d}))
'
```
Expected: ผลรวม `count` = **374** เท่ากับจำนวนเหตุทั้งหมด — ถ้าไม่เท่า แปลว่า aggregation
ตกบางรายการ (เช่น document ที่ไม่มี `year`)

- [ ] **Step 3: ยืนยันว่ารหัสผู้ใช้ไม่หลุด**

```bash
curl -s 'http://localhost:3000/api/disaster/incidents' | python3 -c '
import json,sys
rows = json.load(sys.stdin)["incidents"]
leaked = sorted({k for r in rows for k in r if k in ("createdBy","createdAt","updatedAt","__v")})
print("ฟิลด์ที่ไม่ควรหลุด:", leaked or "ไม่มี")
print("คีย์ที่คืนจริง:", sorted(rows[0].keys()) if rows else "ไม่มีข้อมูล")
'
```
Expected:
```
ฟิลด์ที่ไม่ควรหลุด: ไม่มี
คีย์ที่คืนจริง: ['_id', 'areaType', 'date', 'dateText', 'disasterType', 'imageFile', 'location', 'method', 'year']
```

**นี่คือขั้นตอนที่สำคัญที่สุดใน Task นี้** ถ้าเจอ `createdBy` แปลว่า `toIncidentItem` ถูกข้ามไป
ที่ไหนสักแห่ง

- [ ] **Step 4: ตัวกรองทำงาน**

```bash
for t in WILDFIRE FLOOD LANDSLIDE DROUGHT; do
  n=$(curl -s "http://localhost:3000/api/disaster/incidents?type=$t" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["incidents"]))')
  echo "$t = $n"
done
```
Expected: ผลรวมทั้งสี่ = 374

- [ ] **Step 5: API หลังบ้านต้องกันคนไม่มีสิทธิ์**

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/admin/disaster/incidents'
```
Expected: **401** (ไม่ได้ล็อกอิน) — ถ้าได้ 200 แปลว่า guard ไม่ทำงาน หยุดทันที

จากนั้นเปิด `http://localhost:3000/api/admin/disaster/incidents` ในเบราว์เซอร์ที่ล็อกอินอยู่
Expected: ได้ JSON รายการเหตุ (บัญชีที่ใช้ต้องมีสิทธิ์ `disaster` — ผู้จัดการได้ครบทุกสิทธิ์อยู่แล้ว)

- [ ] **Step 6: ไม่ต้อง commit** ถ้า `git status` สะอาด

---

## Task 7: ปิดแผน — ตรวจทั้งระบบ

- [ ] **Step 1: ครบทุกอย่าง**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```
Expected: ผ่านหมด **410 เทสต์ 39 ไฟล์**

- [ ] **Step 2: ตรวจว่า route ใหม่ขึ้นครบ 4 เส้น และไม่มีหน้าใหม่**

```bash
npm run build 2>&1 | grep -E "api/disaster|api/admin/disaster|/disaster$"
```
Expected: เห็นสี่บรรทัด — `/api/disaster/incidents`, `/api/disaster/stats`,
`/api/admin/disaster/incidents`, `/api/admin/disaster/incidents/[id]`
**ต้องไม่มี** `/disaster` หรือ `/admin/disaster` (หน้าเว็บมาใน 2B)

- [ ] **Step 3: ตรวจว่า mongoose ไม่หลุดเข้ามา**

```bash
grep -rn "mongoose" src/ package.json | grep -v node_modules || echo "ไม่มี mongoose — ถูกต้อง"
```
Expected: `ไม่มี mongoose — ถูกต้อง`

- [ ] **Step 4: ตรวจว่า store ไม่ถูก import จากฝั่ง client**

```bash
grep -rn "disaster-store" src/components src/pages --include='*.tsx' || echo "ไม่มี — ถูกต้อง"
```
Expected: `ไม่มี — ถูกต้อง` — `disaster-store` แตะ Mongo จึงต้องอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น
(ต้นทางมีเทสต์ `client-server-boundary.test.ts` คุมเรื่องนี้ ที่ portal ยังไม่มี — ดูหนี้ข้อ 6)

---

## หนี้ที่แผนนี้สร้างขึ้น (บันทึกลงสเปกตอนปิดแผน)

| # | เรื่อง | ควรสะสางเมื่อ |
|---|---|---|
| 6 | portal ไม่มีเทสต์กัน client import โมดูลฝั่งเซิร์ฟเวอร์แบบ `client-server-boundary.test.ts` ของ namphrae-map ซึ่งเขียนขึ้นหลังเคยพังจริง ตอนนี้ Task 7 Step 4 ตรวจด้วยมือแทน | 2B ที่เริ่มมี component จริง — เขียนเป็นเทสต์อัตโนมัติ |
| 7 | `GET /api/disaster/incidents` ไม่มีเพดานจำนวน คืนทั้ง 374 รายการทุกครั้ง วันนี้ไหว แต่โตขึ้นทุกปี | รอบที่จำนวนเหตุเกินราวสองพัน หรือเมื่อหน้าแรกเริ่มช้า |

---

## ยังไม่ทำในแผนนี้

- **หน้าเว็บทั้งสาม** (`/disaster`, `/disaster/insights`, `/admin/disaster`) และ component
  แผนที่/กราฟ/ฟอร์ม → แผน 2B
- **อัปโหลดรูป** — ต้นทางยิง `POST /api/upload` ของตัวเอง 2B จะชี้ไป `/api/admin/upload`
  ของ portal ที่มีอยู่แล้วแทน
- **`/api/disaster/incidents/[id]` สาธารณะ** — ไม่ทำ เพราะไม่มีใครเรียก
