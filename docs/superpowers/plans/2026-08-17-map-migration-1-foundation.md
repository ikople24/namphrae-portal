# ย้าย namphrae-map รอบที่ 1: ฐานร่วม — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** วางฐานทุกอย่างที่รอบ 2–5 ต้องใช้ — dependency, ยูทิลตรรกะบริสุทธิ์พร้อมเทสต์เดิม, feature key ใหม่, ตัวเชื่อม db รายงาน, ดัชนี และสคริปต์คัดลอกข้อมูล — โดยที่ portal ที่รันอยู่ยังทำงานเหมือนเดิมทุกประการ

**Architecture:** ยกตรรกะบริสุทธิ์ 19 ไฟล์จาก `namphrae-map/lib/` มาไว้ใต้ `src/lib/` พร้อมเทสต์ของมันเอง เปลี่ยนแค่ชื่อไฟล์เป็น kebab-case และ import เป็น alias `@/` ตามที่ portal ใช้ ไม่แก้ตรรกะแม้แต่บรรทัดเดียว — เทสต์ที่ยกมาคือหลักฐานว่าไม่ได้แก้ รอบนี้ยังไม่มีหน้าใหม่และยังไม่มี store ที่แตะ MongoDB

**Tech Stack:** Next 16.2.11 (Pages Router) · TypeScript · vitest 3 · MongoDB driver 7 · zod 4.4.3 · react-leaflet 5 · recharts · xlsx

**Spec:** [../specs/2026-08-17-namphrae-map-migration-design.md](../specs/2026-08-17-namphrae-map-migration-design.md)

---

## บริบทที่ต้องรู้ก่อนเริ่ม

**ต้นทางอยู่คนละ repo** — `/Users/thanawatsodsri/Fullstack/namphrae-map` เป็นโปรเจกต์แยก ไม่ใช่ submodule
ทุกคำสั่ง `cp` ในแผนนี้อ้างพาธเต็มของต้นทาง และรันจากรากของ `namphrae-portal`

**สาขานี้แตกจาก `main`** ไม่ได้แตกจาก `feature/community-forest-layers` ที่ยังไม่ merge
แปลว่าสิ่งเหล่านี้ **ไม่มี** บนสาขานี้ อย่าเรียกใช้:
- `closeDb()` ใน `src/lib/mongodb.ts` (มีเฉพาะสาขา forest)
- `proj4`, `scripts/import-community-forest.mts`, `src/lib/map-area.ts`, `src/lib/map-forest-prep.ts`

สคริปต์คัดลอกใน Task 10 จึงเปิด `MongoClient` ของตัวเองและปิดเอง ไม่พึ่ง `closeDb()` — ทำให้ merge
กับสาขา forest ได้โดยไม่ชน

**เทสต์อยู่ข้างไฟล์ต้นฉบับ** — `vitest.config.ts` ตั้ง `include: ['src/**/*.test.ts?(x)']`
ไฟล์เทสต์ที่ยกมาจึงไปอยู่ `src/lib/<ชื่อ>.test.ts` **ห้าม**สร้างโฟลเดอร์ `tests/` และ
**ห้าม**วางไฟล์เทสต์ใต้ `src/pages/**` (Next จะนับเป็น route จริง — มีคอมเมนต์เตือนไว้ใน `vitest.config.ts`)

**ตารางชื่อไฟล์ — ใช้ตารางนี้เป็นแหล่งความจริงเดียวตลอดแผน**

| ต้นทาง `namphrae-map/lib/` | ปลายทาง | export ที่ต้องได้ |
|---|---|---|
| `thaiDate.ts` | `src/lib/thai-date.ts` | `parseThaiDate` |
| `isoDate.ts` | `src/lib/iso-date.ts` | `isoDateOrNull` |
| `thaiCalendar.ts` | `src/lib/thai-calendar.ts` | `THAI_MONTH_NAMES`, `THAI_WEEKDAY_HEADERS`, `formatThaiDate`, `monthMatrix` |
| `geo.ts` | `src/lib/village-geo.ts` | `pointInRing`, `villageOf`, `haversineMeters`, `VillageProps`, `VillageFeature`, `VillageCollection` |
| `urlState.ts` | `src/lib/url-state.ts` | `pickOne`, `readYear` |
| `imageResize.ts` | `src/lib/image-resize.ts` | `fitDimensions` |
| `mapScales.ts` | `src/lib/color-scales.ts` | `DENGUE_SCALE`, `DISASTER_SCALE` |
| `disasterTypes.ts` | `src/lib/disaster-types.ts` | `DISASTER_TYPES`, `DISASTER_LABELS`, `DISASTER_COLORS`, `DisasterType` |
| `types.ts` (ส่วนภัยพิบัติ) | `src/types/disaster.ts` | `IncidentItem`, `YearStat` |
| `types.ts` (ส่วนสาธารณสุข) | `src/types/health.ts` | `DengueCase` |
| `types.ts` (ฟังก์ชัน) | `src/lib/disaster-image.ts` | `imageUrl` |
| `stats.ts` | `src/lib/disaster-stats.ts` | `computeKpis`, `countByVillage`, `Kpis` |
| `adminView.ts` | `src/lib/disaster-admin-view.ts` | `filterIncidents`, `paginate`, `summaryByType`, `TypeFilter` |
| `incidentOptions.ts` | `src/lib/disaster-options.ts` | `METHOD_OPTIONS`, `AREA_TYPE_OPTIONS`, `isCustomValue` |
| `validation.ts` | `src/lib/disaster-schema.ts` | `incidentInputSchema`, `IncidentInput` |
| `dengueStats.ts` | `src/lib/health-report-stats.ts` | `dengueByMonth`, `dengueKpis`, `recentCases`, `classifyCases` |
| `dengueRegistryDates.ts` | `src/lib/health-registry-dates.ts` | `excelSerialToUTC`, `normalizeRegistryDate` |
| `dengueRegistryParse.ts` | `src/lib/health-registry-parse.ts` | `sheetYearBE`, `parseRegistrySheet`, `parsePopulationSheet`, `parseChikunMooYear` |
| `dengueRegistryStats.ts` | `src/lib/health-registry-stats.ts` | `registryByYear`, `registryByMonth`, `registryByMoo`, `ipdShare`, `mooTitle`, `mooCountsToVillageCounts`, `median`, `yearlyComparison`, `mooYearByYear`, `mooYearToByMoo`, `monthlyByYear`, `RegistryCase`, `YearStat`, `MooYearRow`, `MonthlyMultiYearRow`, `YearComparisonRow` |
| `dengueExport.ts` | `src/lib/health-export.ts` | `statsWorkbookBuffer`, `registryWorkbookBuffer`, `RegistryExportRow` |
| `dengueRegistryInput.ts` | `src/lib/health-case-schema.ts` | `registryCaseInputSchema`, `toRegistryDocFields`, `RegistryCaseInput`, `RegistryDocFields` |

> `health-registry-stats.ts` ส่งออกชนิดชื่อ `YearStat` เหมือนกับที่ `src/types/disaster.ts` ส่งออก
> แต่**คนละความหมาย** (ฝั่งสาธารณสุข = ประชากรรายปี, ฝั่งภัยพิบัติ = จำนวนเหตุรายปี) อยู่คนละไฟล์
> จึงไม่ชนกัน ห้ามรวมเป็นตัวเดียว

---

### Task 1: ติดตั้ง dependency และพิสูจน์ว่าเข้ากับ Next 16 ได้

รอบ 2–4 ทั้งหมดตั้งอยู่บนสมมติฐานว่า react-leaflet 5 กับ recharts build ผ่านบน Next 16 ถ้าผิด
ต้องรู้เดี๋ยวนี้ ไม่ใช่ตอนรอบ 3

**Files:**
- Modify: `package.json`
- Create แล้วลบทิ้งในงานเดียวกัน: `src/pages/smoke-check.tsx`

- [ ] **Step 1: อ่านคู่มือ Next ก่อนแตะโค้ดหน้าเว็บ**

`AGENTS.md` สั่งไว้ว่า Next เวอร์ชันนี้ไม่เหมือนที่เคยรู้ ต้องอ่านคู่มือในโปรเจกต์ก่อน

Run: `ls node_modules/next/dist/docs/`
อ่านหัวข้อที่เกี่ยวกับ Pages Router และ dynamic import ก่อนเขียน `smoke-check.tsx`

- [ ] **Step 2: ติดตั้ง dependency**

```bash
npm install react-leaflet leaflet.heat leaflet.markercluster recharts xlsx csv-parse
npm install -D @types/leaflet.heat @types/leaflet.markercluster @types/geojson
```

`@types/geojson` วันนี้ติดมาทาง `@types/leaflet` แบบอ้อม ๆ แต่โค้ดที่กำลังจะยกมา `import type { Feature } from 'geojson'` ตรง ๆ จึงต้องประกาศเป็น dependency ของเราเอง ไม่ใช่พึ่งของคนอื่น

- [ ] **Step 3: เขียนหน้า smoke ชั่วคราว**

Create `src/pages/smoke-check.tsx`:

```tsx
import dynamic from 'next/dynamic';
import { LineChart, Line, XAxis, YAxis } from 'recharts';

// หน้าชั่วคราวสำหรับพิสูจน์ว่า react-leaflet + recharts build ผ่านบน Next 16
// ลบทิ้งทันทีที่ build ผ่าน — ห้าม commit
const Map = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);

export default function SmokeCheck() {
  return (
    <div>
      <Map center={[18.7, 98.9]} zoom={13} style={{ height: 200 }} />
      <LineChart width={200} height={100} data={[{ x: 1, y: 2 }]}>
        <XAxis dataKey="x" />
        <YAxis />
        <Line dataKey="y" />
      </LineChart>
    </div>
  );
}
```

- [ ] **Step 4: build เพื่อพิสูจน์**

Run: `npm run build`
Expected: build สำเร็จ และมี `/smoke-check` อยู่ในรายการ route ที่พิมพ์ออกมา

ถ้าล้มเหลว: **หยุดทั้งแผน** แล้วรายงานข้อความ error กลับมา ทางเลือกข้อ ค ในสเปกตั้งอยู่บนสมมติฐานนี้ ถ้าพังต้องกลับไปทบทวนสเปก ไม่ใช่ดันต่อ

- [ ] **Step 5: ลบหน้า smoke ทิ้ง**

```bash
rm src/pages/smoke-check.tsx
npm run build
```
Expected: build สำเร็จ และ **ไม่มี** `/smoke-check` ในรายการ route แล้ว

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): react-leaflet, recharts, xlsx สำหรับย้ายงาน namphrae-map"
```

---

### Task 2: ยูทิลวันที่ — thai-date, iso-date, thai-calendar

**Files:**
- Create: `src/lib/thai-date.ts`, `src/lib/iso-date.ts`, `src/lib/thai-calendar.ts`
- Test: `src/lib/thai-date.test.ts`, `src/lib/thai-calendar.test.ts`

`iso-date.ts` เป็นฟังก์ชันบรรทัดเดียวที่ไม่มีเทสต์ในต้นทาง — ยกมาเฉย ๆ ไม่ต้องแต่งเทสต์เพิ่ม

- [ ] **Step 1: คัดลอกเทสต์มาก่อน (ยังไม่คัดลอกไฟล์ต้นฉบับ)**

```bash
MAP=/Users/thanawatsodsri/Fullstack/namphrae-map
cp "$MAP/tests/thaiDate.test.ts"     src/lib/thai-date.test.ts
cp "$MAP/tests/thaiCalendar.test.ts" src/lib/thai-calendar.test.ts
```

- [ ] **Step 2: แก้ import ในไฟล์เทสต์**

ใน `src/lib/thai-date.test.ts` เปลี่ยน:
```ts
import { parseThaiDate } from '../lib/thaiDate';
```
เป็น:
```ts
import { parseThaiDate } from '@/lib/thai-date';
```

ใน `src/lib/thai-calendar.test.ts` เปลี่ยนสองบรรทัด:
```ts
import { formatThaiDate, monthMatrix, THAI_MONTH_NAMES, THAI_WEEKDAY_HEADERS } from '../lib/thaiCalendar';
import { parseThaiDate } from '../lib/thaiDate';
```
เป็น:
```ts
import { formatThaiDate, monthMatrix, THAI_MONTH_NAMES, THAI_WEEKDAY_HEADERS } from '@/lib/thai-calendar';
import { parseThaiDate } from '@/lib/thai-date';
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run src/lib/thai-date.test.ts src/lib/thai-calendar.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/thai-date"`

- [ ] **Step 4: คัดลอกไฟล์ต้นฉบับ**

```bash
MAP=/Users/thanawatsodsri/Fullstack/namphrae-map
cp "$MAP/lib/thaiDate.ts"     src/lib/thai-date.ts
cp "$MAP/lib/isoDate.ts"      src/lib/iso-date.ts
cp "$MAP/lib/thaiCalendar.ts" src/lib/thai-calendar.ts
```

- [ ] **Step 5: แก้ import ภายในไฟล์ต้นฉบับ**

`thai-date.ts` และ `iso-date.ts` ไม่ import อะไรเลย — ไม่ต้องแก้

`thai-calendar.ts` ไม่ import อะไรเลยเช่นกัน — ไม่ต้องแก้ แต่แก้คอมเมนต์บรรทัดที่ 2 ที่ยังชี้พาธเก่า:
```ts
// Pure helpers for a Thai Buddhist-era calendar UI (see components/ui/ThaiDatePicker.tsx).
```
เป็น:
```ts
// Pure helpers for a Thai Buddhist-era calendar UI (ThaiDatePicker — ย้ายมาในรอบ 2).
```

ลบคอมเมนต์บรรทัดแรกที่เป็นพาธเดิม (`// lib/thaiCalendar.ts`, `// lib/isoDate.ts`) ออกจากทั้งสองไฟล์ — พาธเปลี่ยนแล้ว คอมเมนต์ที่โกหกแย่กว่าไม่มีคอมเมนต์

- [ ] **Step 6: รันเทสต์ให้เขียว**

Run: `npx vitest run src/lib/thai-date.test.ts src/lib/thai-calendar.test.ts`
Expected: PASS ทั้งหมด (thai-date 1 ไฟล์, thai-calendar 1 ไฟล์)

- [ ] **Step 7: Commit**

```bash
git add src/lib/thai-date.ts src/lib/iso-date.ts src/lib/thai-calendar.ts \
        src/lib/thai-date.test.ts src/lib/thai-calendar.test.ts
git commit -m "feat(lib): ยกยูทิลวันที่ไทยจาก namphrae-map พร้อมเทสต์"
```

---

### Task 3: ยูทิลพื้นที่และ UI — village-geo, url-state, image-resize, color-scales

**Files:**
- Create: `src/lib/village-geo.ts`, `src/lib/url-state.ts`, `src/lib/image-resize.ts`, `src/lib/color-scales.ts`
- Test: `src/lib/village-geo.test.ts`, `src/lib/url-state.test.ts`, `src/lib/image-resize.test.ts`

`color-scales.ts` เป็น const 2 บรรทัด ไม่มีเทสต์ในต้นทาง — ยกมาเฉย ๆ

- [ ] **Step 1: คัดลอกเทสต์**

```bash
MAP=/Users/thanawatsodsri/Fullstack/namphrae-map
cp "$MAP/tests/geo.test.ts"         src/lib/village-geo.test.ts
cp "$MAP/tests/urlState.test.ts"    src/lib/url-state.test.ts
cp "$MAP/tests/imageResize.test.ts" src/lib/image-resize.test.ts
```

- [ ] **Step 2: แก้ import ในไฟล์เทสต์**

`src/lib/village-geo.test.ts`:
```ts
import { haversineMeters, pointInRing, villageOf, type VillageFeature } from '@/lib/village-geo';
```
`src/lib/url-state.test.ts`:
```ts
import { pickOne, readYear } from '@/lib/url-state';
```
`src/lib/image-resize.test.ts`:
```ts
import { fitDimensions } from '@/lib/image-resize';
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run src/lib/village-geo.test.ts src/lib/url-state.test.ts src/lib/image-resize.test.ts`
Expected: FAIL — resolve import ไม่ได้ทั้งสามไฟล์

- [ ] **Step 4: คัดลอกไฟล์ต้นฉบับ**

```bash
MAP=/Users/thanawatsodsri/Fullstack/namphrae-map
cp "$MAP/lib/geo.ts"         src/lib/village-geo.ts
cp "$MAP/lib/urlState.ts"    src/lib/url-state.ts
cp "$MAP/lib/imageResize.ts" src/lib/image-resize.ts
cp "$MAP/lib/mapScales.ts"   src/lib/color-scales.ts
```

- [ ] **Step 5: ลบคอมเมนต์พาธเก่า**

ลบบรรทัดแรกของ `village-geo.ts` (`// lib/geo.ts`), `url-state.ts` (`// lib/urlState.ts`) และ
`image-resize.ts` (`// lib/imageResize.ts`)

ใน `color-scales.ts` แก้คอมเมนต์ที่อ้าง `ChoroplethMap` ให้ตรงความจริงใหม่:
```ts
// Sequential color scales for choropleth maps.
// Kept leaflet-free so pages can import these without pulling react-leaflet
// into the server bundle (importing from ChoroplethMap breaks `next build`).
```
เป็น:
```ts
// สเกลสีไล่เฉดสำหรับแผนที่ choropleth
// ตั้งใจไม่ import leaflet เพื่อให้หน้าเว็บ import ได้โดยไม่ลาก react-leaflet เข้า
// server bundle — import จาก component แผนที่ตรง ๆ จะทำให้ `next build` พัง
```

ไม่ต้องแก้ import ในไฟล์ไหนเลย — `village-geo.ts` import จาก `'geojson'` ซึ่งติดตั้งไปแล้วใน Task 1 ที่เหลือไม่ import อะไร

- [ ] **Step 6: รันเทสต์ให้เขียว**

Run: `npx vitest run src/lib/village-geo.test.ts src/lib/url-state.test.ts src/lib/image-resize.test.ts`
Expected: PASS ทั้งหมด

- [ ] **Step 7: Commit**

```bash
git add src/lib/village-geo.ts src/lib/url-state.ts src/lib/image-resize.ts src/lib/color-scales.ts \
        src/lib/village-geo.test.ts src/lib/url-state.test.ts src/lib/image-resize.test.ts
git commit -m "feat(lib): ยกยูทิลพื้นที่หมู่บ้าน สเกลสี และ url state จาก namphrae-map"
```

---

### Task 4: ชนิดข้อมูลและยูทิลภัยพิบัติ

**Files:**
- Create: `src/types/disaster.ts`, `src/lib/disaster-types.ts`, `src/lib/disaster-image.ts`, `src/lib/disaster-stats.ts`, `src/lib/disaster-admin-view.ts`, `src/lib/disaster-options.ts`, `src/lib/disaster-schema.ts`
- Test: `src/lib/disaster-stats.test.ts`, `src/lib/disaster-admin-view.test.ts`, `src/lib/disaster-options.test.ts`, `src/lib/disaster-schema.test.ts`
- Modify: `.env.example`

`lib/types.ts` ของต้นทางปนสามอย่างไว้ด้วยกัน — ชนิดภัยพิบัติ ชนิดสาธารณสุข และฟังก์ชัน `imageUrl`
รอบนี้แยกออกเป็นสามที่ตามตารางชื่อไฟล์

- [ ] **Step 1: คัดลอกเทสต์**

```bash
MAP=/Users/thanawatsodsri/Fullstack/namphrae-map
cp "$MAP/tests/stats.test.ts"           src/lib/disaster-stats.test.ts
cp "$MAP/tests/adminView.test.ts"       src/lib/disaster-admin-view.test.ts
cp "$MAP/tests/incidentOptions.test.ts" src/lib/disaster-options.test.ts
cp "$MAP/tests/validation.test.ts"      src/lib/disaster-schema.test.ts
```

- [ ] **Step 2: แก้ import ในไฟล์เทสต์**

`src/lib/disaster-stats.test.ts`:
```ts
import { computeKpis } from '@/lib/disaster-stats';
import type { IncidentItem } from '@/types/disaster';
```
`src/lib/disaster-admin-view.test.ts`:
```ts
import { filterIncidents, paginate, summaryByType } from '@/lib/disaster-admin-view';
import type { IncidentItem } from '@/types/disaster';
```
`src/lib/disaster-options.test.ts`:
```ts
import { METHOD_OPTIONS, AREA_TYPE_OPTIONS, isCustomValue } from '@/lib/disaster-options';
import { DISASTER_TYPES } from '@/lib/disaster-types';
```
`src/lib/disaster-schema.test.ts`:
```ts
import { incidentInputSchema } from '@/lib/disaster-schema';
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run src/lib/disaster-`
Expected: FAIL ทั้ง 4 ไฟล์ — resolve import ไม่ได้

- [ ] **Step 4: สร้าง `src/types/disaster.ts`**

```ts
// ชนิดข้อมูลเหตุสาธารณภัย — ยกจาก namphrae-map/lib/types.ts (ส่วนภัยพิบัติ)
import type { DisasterType } from '@/lib/disaster-types';

export interface IncidentItem {
  _id: string;
  disasterType: DisasterType;
  year: number;
  date: string;
  dateText: string;
  method: string;
  areaType: string;
  location: { type: 'Point'; coordinates: [number, number] }; // [lng, lat]
  imageFile: string;
}

export interface YearStat { year: number; disasterType: DisasterType; count: number }
```

- [ ] **Step 5: สร้าง `src/lib/disaster-image.ts`**

```ts
// รูปเหตุการณ์รุ่นเก่าเก็บเป็นชื่อไฟล์เปล่า ๆ ต้องเติม base URL ให้ ส่วนรุ่นใหม่เก็บเป็น
// URL เต็มของ Cloudinary อยู่แล้ว — ยกจาก namphrae-map/lib/types.ts
export function imageUrl(file: string): string {
  if (!file) return '';
  if (file.startsWith('http')) return file;
  return `${process.env.NEXT_PUBLIC_IMAGE_BASE_URL ?? ''}/${file}`;
}
```

- [ ] **Step 6: คัดลอกไฟล์ที่เหลือแล้วแก้ import**

```bash
MAP=/Users/thanawatsodsri/Fullstack/namphrae-map
cp "$MAP/lib/disasterTypes.ts"    src/lib/disaster-types.ts
cp "$MAP/lib/stats.ts"            src/lib/disaster-stats.ts
cp "$MAP/lib/adminView.ts"        src/lib/disaster-admin-view.ts
cp "$MAP/lib/incidentOptions.ts"  src/lib/disaster-options.ts
cp "$MAP/lib/validation.ts"       src/lib/disaster-schema.ts
```

แก้ import (ลบคอมเมนต์พาธเก่าบรรทัดแรกของทุกไฟล์ด้วย):

`src/lib/disaster-stats.ts`:
```ts
import type { IncidentItem } from '@/types/disaster';
import { DISASTER_TYPES, type DisasterType } from '@/lib/disaster-types';
```
`src/lib/disaster-admin-view.ts`:
```ts
import type { IncidentItem } from '@/types/disaster';
import type { DisasterType } from '@/lib/disaster-types';
```
`src/lib/disaster-options.ts`:
```ts
import type { DisasterType } from '@/lib/disaster-types';
```
`src/lib/disaster-schema.ts`:
```ts
import { z } from 'zod';
import { DISASTER_TYPES } from '@/lib/disaster-types';
```

`src/lib/disaster-types.ts` ไม่ import อะไร — แก้แค่คอมเมนต์หัวไฟล์ที่พูดถึง mongoose ให้ตรงความจริงใหม่:
```ts
// Client-safe disaster-type constants — NO mongoose / server-only imports here.
// Both the browser bundle and the Mongoose model import from this module, so client
// pages can use the labels/enums without dragging the DB model into the browser.
```
เป็น:
```ts
// ค่าคงที่ประเภทภัย — client-safe ห้าม import mongo/clerk ที่นี่
// ทั้งหน้าเว็บและ store ฝั่งเซิร์ฟเวอร์ import จากไฟล์นี้ตัวเดียวกัน
```

- [ ] **Step 7: รันเทสต์ให้เขียว**

Run: `npx vitest run src/lib/disaster-`
Expected: PASS ทั้ง 4 ไฟล์

zod 4.4.3 ที่ portal ใช้อยู่รองรับ `z.enum(DISASTER_TYPES)` กับ `.default('')` เหมือน zod 3 ทุกประการ (ตรวจกับตัวที่ติดตั้งจริงแล้ว) ถ้า `disaster-schema.test.ts` แดง แปลว่ามีอย่างอื่นผิด ไม่ใช่เรื่องเวอร์ชัน zod

- [ ] **Step 8: เพิ่ม env ที่ `imageUrl` ต้องใช้**

Modify `.env.example` — เพิ่มต่อท้ายบล็อก Cloudinary:

```
# base URL ของรูปเหตุสาธารณภัยรุ่นเก่าที่เก็บเป็น "ชื่อไฟล์" ไม่ใช่ URL เต็ม
# (รุ่นใหม่อัปเข้า Cloudinary เป็น URL เต็มอยู่แล้ว ไม่ผ่านค่านี้)
# ไม่ตั้ง = รูปเก่าเสีย รูปใหม่ปกติ — ค่าที่ namphrae-map ใช้อยู่คือ
# https://namphraesmartcity.ai/calendar/NPDRH/images
NEXT_PUBLIC_IMAGE_BASE_URL=
```

- [ ] **Step 9: Commit**

```bash
git add src/types/disaster.ts src/lib/disaster-*.ts .env.example
git commit -m "feat(lib): ยกชนิดข้อมูลและยูทิลภัยพิบัติจาก namphrae-map พร้อมเทสต์"
```

---

### Task 5: ยูทิลสาธารณสุข

**Files:**
- Create: `src/types/health.ts`, `src/lib/health-report-stats.ts`, `src/lib/health-registry-dates.ts`, `src/lib/health-registry-parse.ts`, `src/lib/health-registry-stats.ts`, `src/lib/health-export.ts`, `src/lib/health-case-schema.ts`
- Test: `src/lib/health-report-stats.test.ts`, `src/lib/health-registry-dates.test.ts`, `src/lib/health-registry-parse.test.ts`, `src/lib/health-registry-stats.test.ts`, `src/lib/health-export.test.ts`, `src/lib/health-case-schema.test.ts`

- [ ] **Step 1: คัดลอกเทสต์**

```bash
MAP=/Users/thanawatsodsri/Fullstack/namphrae-map
cp "$MAP/tests/dengueStats.test.ts"          src/lib/health-report-stats.test.ts
cp "$MAP/tests/dengueRegistryDates.test.ts"  src/lib/health-registry-dates.test.ts
cp "$MAP/tests/dengueRegistryParse.test.ts"  src/lib/health-registry-parse.test.ts
cp "$MAP/tests/dengueRegistryStats.test.ts"  src/lib/health-registry-stats.test.ts
cp "$MAP/tests/dengueExport.test.ts"         src/lib/health-export.test.ts
cp "$MAP/tests/dengueRegistryInput.test.ts"  src/lib/health-case-schema.test.ts
```

- [ ] **Step 2: แก้ import ในไฟล์เทสต์**

`src/lib/health-report-stats.test.ts`:
```ts
import { dengueByMonth, dengueKpis, recentCases, classifyCases } from '@/lib/health-report-stats';
import type { DengueCase } from '@/types/health';
```
`src/lib/health-registry-dates.test.ts`:
```ts
import { excelSerialToUTC, normalizeRegistryDate } from '@/lib/health-registry-dates';
```
`src/lib/health-registry-parse.test.ts`:
```ts
import { sheetYearBE, parseRegistrySheet, parsePopulationSheet, parseChikunMooYear } from '@/lib/health-registry-parse';
```
`src/lib/health-registry-stats.test.ts` — ต้นทางมี import สี่ก้อน แทนที่ทั้งบล็อกบรรทัดที่ 1–8 ด้วย:
```ts
import { describe, it, expect } from 'vitest';
import {
  registryByYear, registryByMonth, registryByMoo, ipdShare, mooTitle, mooCountsToVillageCounts,
  type RegistryCase,
} from '@/lib/health-registry-stats';
import { median, yearlyComparison, mooYearByYear, mooYearToByMoo, type YearStat, type MooYearRow } from '@/lib/health-registry-stats';
import { monthlyByYear, type MonthlyMultiYearRow } from '@/lib/health-registry-stats';
import type { VillageFeature } from '@/lib/village-geo';
```
`src/lib/health-export.test.ts`:
```ts
import * as XLSX from 'xlsx';
import { statsWorkbookBuffer, registryWorkbookBuffer } from '@/lib/health-export';
```
`src/lib/health-case-schema.test.ts`:
```ts
import { registryCaseInputSchema, toRegistryDocFields } from '@/lib/health-case-schema';
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run src/lib/health-`
Expected: FAIL ทั้ง 6 ไฟล์ — resolve import ไม่ได้

- [ ] **Step 4: สร้าง `src/types/health.ts`**

```ts
// ชนิดข้อมูลรายงานจากชาวบ้าน — ยกจาก namphrae-map/lib/types.ts (ส่วนสาธารณสุข)
// ต้นทางคือ collection submittedreports ของระบบแจ้งเรื่อง LINE ไม่ใช่ของ portal
export interface DengueCase {
  _id: string;
  complaintId: string;
  community: string;
  status: string;
  date: string; // ISO (จาก createdAt)
  location: { lat: number; lng: number };
}
```

- [ ] **Step 5: คัดลอกไฟล์ต้นฉบับ**

```bash
MAP=/Users/thanawatsodsri/Fullstack/namphrae-map
cp "$MAP/lib/dengueStats.ts"          src/lib/health-report-stats.ts
cp "$MAP/lib/dengueRegistryDates.ts"  src/lib/health-registry-dates.ts
cp "$MAP/lib/dengueRegistryParse.ts"  src/lib/health-registry-parse.ts
cp "$MAP/lib/dengueRegistryStats.ts"  src/lib/health-registry-stats.ts
cp "$MAP/lib/dengueExport.ts"         src/lib/health-export.ts
cp "$MAP/lib/dengueRegistryInput.ts"  src/lib/health-case-schema.ts
```

- [ ] **Step 6: แก้ import ในไฟล์ต้นฉบับ (ลบคอมเมนต์พาธเก่าบรรทัดแรกด้วย)**

`src/lib/health-report-stats.ts`:
```ts
import type { DengueCase } from '@/types/health';
import { haversineMeters } from '@/lib/village-geo';
```
`src/lib/health-registry-dates.ts`:
```ts
import { parseThaiDate } from '@/lib/thai-date';
```
`src/lib/health-registry-parse.ts`:
```ts
import { normalizeRegistryDate } from '@/lib/health-registry-dates';
```
`src/lib/health-registry-stats.ts`:
```ts
import type { VillageFeature } from '@/lib/village-geo';
```
`src/lib/health-export.ts`:
```ts
import * as XLSX from 'xlsx';
import type { YearComparisonRow } from '@/lib/health-registry-stats';
```
`src/lib/health-case-schema.ts` — import แค่ `zod` ไม่ต้องแก้

- [ ] **Step 7: รันเทสต์ให้เขียว**

Run: `npx vitest run src/lib/health-`
Expected: PASS ทั้ง 6 ไฟล์

- [ ] **Step 8: รันเทสต์ทั้งโปรเจกต์ ยืนยันว่าไม่ไปทำของเดิมพัง**

Run: `npm test`
Expected: PASS ทั้งหมด — 25 ไฟล์เดิมของ portal บวกที่ยกมาใหม่

- [ ] **Step 9: Commit**

```bash
git add src/types/health.ts src/lib/health-*.ts
git commit -m "feat(lib): ยกยูทิลสาธารณสุขจาก namphrae-map พร้อมเทสต์"
```

---

### Task 6: feature key `disaster` และ `health`

**Files:**
- Modify: `src/lib/user-access.ts:5-30`
- Test: `src/lib/user-access.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

เพิ่มลงท้าย `src/lib/user-access.test.ts`:

```ts
describe('feature key ใหม่จากการย้าย namphrae-map', () => {
  it('มี disaster และ health อยู่ใน FEATURES', () => {
    expect(FEATURES).toContain('disaster');
    expect(FEATURES).toContain('health');
  });

  it('ไม่หลุดเข้า DEFAULT_FEATURES — สมาชิกเดิมต้องไม่เห็นเมนูใหม่เอง', () => {
    expect(DEFAULT_FEATURES).not.toContain('disaster');
    expect(DEFAULT_FEATURES).not.toContain('health');
  });

  it('ทุก key มีหน้าแรกและป้ายชื่อครบ', () => {
    for (const key of FEATURES) {
      expect(FEATURE_HOME[key]).toBeTruthy();
      expect(FEATURE_LABELS.find((l) => l.key === key)).toBeTruthy();
    }
  });

  it('ผู้จัดการได้สิทธิ์ใหม่ทั้งสองตัวโดยอัตโนมัติ', () => {
    const access = resolveAccess({ doc: null, clerkId: 'u1', managerEnvId: 'u1' });
    expect(hasFeature(access, 'disaster')).toBe(true);
    expect(hasFeature(access, 'health')).toBe(true);
  });

  it('สมาชิกที่ได้ health ไม่ได้ disaster ตามไปด้วย', () => {
    const access = resolveAccess({
      doc: { features: ['health'] },
      clerkId: 'u2',
      managerEnvId: 'u1',
    });
    expect(hasFeature(access, 'health')).toBe(true);
    expect(hasFeature(access, 'disaster')).toBe(false);
  });
});
```

ตรวจว่าบรรทัด import บนสุดของไฟล์มี `DEFAULT_FEATURES`, `FEATURE_HOME`, `FEATURE_LABELS`, `hasFeature`, `resolveAccess` ครบ ถ้าขาดตัวไหนให้เพิ่มเข้าไป

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run src/lib/user-access.test.ts`
Expected: FAIL — `expected [ 'links', … ] to contain 'disaster'`

- [ ] **Step 3: เพิ่ม key ลง `src/lib/user-access.ts`**

แก้บรรทัดที่ 5:
```ts
export const FEATURES = ['links', 'categories', 'calendar', 'map', 'data', 'settings'] as const;
```
เป็น:
```ts
export const FEATURES = ['links', 'categories', 'calendar', 'map', 'disaster', 'health', 'data', 'settings'] as const;
```

เพิ่มสองบรรทัดใน `FEATURE_HOME` (วางถัดจาก `map`):
```ts
  disaster: '/admin/disaster',
  health: '/admin/health',
```

เพิ่มสองบรรทัดใน `FEATURE_LABELS` (วางถัดจาก `map`):
```ts
  { key: 'disaster', label: 'ภัยพิบัติ' },
  { key: 'health', label: 'สาธารณสุข' },
```

**ห้ามแก้ `DEFAULT_FEATURES`** — ต้องคงเป็น `['calendar', 'data']` ตามสเปกข้อ 1

- [ ] **Step 4: รันเทสต์ให้เขียว**

Run: `npx vitest run src/lib/user-access.test.ts`
Expected: PASS ทั้งไฟล์ รวมเทสต์เดิมที่มีอยู่ก่อน

- [ ] **Step 5: Commit**

```bash
git add src/lib/user-access.ts src/lib/user-access.test.ts
git commit -m "feat(access): เพิ่ม feature key ภัยพิบัติและสาธารณสุข"
```

---

### Task 7: เมนู sidebar หลังบ้าน

**Files:**
- Modify: `src/components/admin/AdminLayout.tsx:16-23`

หน้าปลายทางยังไม่มีจนถึงรอบ 2–4 แต่เมนูถูกกรองด้วยสิทธิ์อยู่แล้ว และ `DEFAULT_FEATURES` ไม่มี key ใหม่
จึงยังไม่มีใครเห็นลิงก์ตายจนกว่าผู้จัดการจะเปิดสิทธิ์ให้ — ซึ่งจะเกิดหลังรอบ 4 เสร็จ

- [ ] **Step 1: เพิ่มรายการเมนู**

ใน `const NAV = [...]` เพิ่มสองบรรทัดถัดจากรายการ `/admin/map`:

```ts
  { href: '/admin/disaster', label: 'ภัยพิบัติ', icon: 'crisis_alert', exact: false, feature: 'disaster' },
  { href: '/admin/health', label: 'สาธารณสุข', icon: 'vaccines', exact: false, feature: 'health' },
```

- [ ] **Step 2: ตรวจว่าไอคอนสองตัวนี้มีจริง**

Run: `grep -n "crisis_alert\|vaccines" src/lib/icons.ts`
Expected: เจอทั้งสองชื่อ

ถ้าไม่เจอ: เปิด `src/lib/icons.ts` ดูว่าไอคอนถูกประกาศเป็นรายชื่อตายตัวหรือส่งชื่อไป Material Symbols ตรง ๆ ถ้าเป็นรายชื่อตายตัว ให้เพิ่มสองชื่อนี้เข้าไปตามรูปแบบที่ไฟล์นั้นใช้อยู่ ถ้าเลือกไอคอนอื่นแทน ต้องเป็นชื่อที่มีอยู่แล้วในไฟล์

- [ ] **Step 3: ตรวจว่า build ผ่านและเทสต์ยังเขียว**

Run: `npm run build && npm test`
Expected: build สำเร็จ เทสต์ผ่านทั้งหมด

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminLayout.tsx src/lib/icons.ts
git commit -m "feat(admin): เมนู sidebar ภัยพิบัติและสาธารณสุข"
```

---

### Task 8: `getReportsDb()`

**Files:**
- Modify: `src/lib/mongodb.ts:60-64`

- [ ] **Step 1: เพิ่มฟังก์ชันต่อจาก `getUsersDb()`**

```ts
// รายงานจากชาวบ้าน (collection submittedreports) อยู่ db เดียวกับทะเบียนผู้ใช้ แต่เป็นของ
// ระบบแจ้งเรื่อง LINE ไม่ใช่ของ portal — portal อ่านอย่างเดียว ห้ามเขียนและห้ามคัดลอกมา
// ไว้ที่ namphrae_portal เพราะข้อมูลจะแช่แข็งทันทีโดยไม่มีอะไรพังให้เห็น
//
// แยกฟังก์ชันไว้เพื่อให้จุดเรียกบอกเจตนาชัด และถ้าวันหนึ่งย้าย db ก็แก้ที่เดียว
export async function getReportsDb(): Promise<Db> {
  return getUsersDb();
}
```

- [ ] **Step 2: ตรวจว่า type ยังผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add src/lib/mongodb.ts
git commit -m "feat(db): getReportsDb สำหรับอ่าน submittedreports ข้าม db"
```

---

### Task 9: ดัชนีของ collection ที่ย้ายมา

**Files:**
- Create: `src/lib/db-indexes.ts`
- Test: `src/lib/db-indexes.test.ts`

mongoose สร้างดัชนีให้อัตโนมัติ driver ดิบไม่สร้าง ถ้าลืม ทะเบียนจะรับเคสเลขลำดับซ้ำได้เงียบ ๆ
รอบนี้ประกาศไว้เป็นข้อมูลบริสุทธิ์ + ฟังก์ชันสร้าง เพื่อให้ store ในรอบ 2–4 และสคริปต์คัดลอกใน
Task 10 เรียกใช้ตัวเดียวกัน

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

Create `src/lib/db-indexes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MIGRATED_INDEXES } from '@/lib/db-indexes';

describe('MIGRATED_INDEXES', () => {
  it('ครอบ collection ที่ย้ายมาครบทั้งสี่', () => {
    expect(Object.keys(MIGRATED_INDEXES).sort()).toEqual([
      'chikunMooYears',
      'diseaseCases',
      'diseaseYearStats',
      'incidents',
    ]);
  });

  it('ดัชนีกันเคสซ้ำของทะเบียนต้องเป็น unique', () => {
    const seq = MIGRATED_INDEXES.diseaseCases.find(
      (i) => JSON.stringify(i.key) === JSON.stringify({ disease: 1, yearBE: 1, seq: 1 })
    );
    expect(seq?.unique).toBe(true);
  });

  it('ประชากรรายปีและชิคุนรายหมู่ต้อง unique เหมือนต้นทาง', () => {
    expect(MIGRATED_INDEXES.diseaseYearStats[0].unique).toBe(true);
    expect(MIGRATED_INDEXES.chikunMooYears[0].unique).toBe(true);
  });

  it('incidents ต้องมีดัชนี 2dsphere ไว้ค้นเชิงพื้นที่', () => {
    const geo = MIGRATED_INDEXES.incidents.find((i) => i.key.location === '2dsphere');
    expect(geo).toBeTruthy();
    expect(geo?.unique).toBeUndefined();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run src/lib/db-indexes.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/db-indexes"`

- [ ] **Step 3: สร้าง `src/lib/db-indexes.ts`**

```ts
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';

// ดัชนีของ collection ที่ย้ายมาจาก namphrae-map — ต้นทางเป็น mongoose ซึ่งสร้างดัชนีให้เอง
// driver ดิบไม่สร้าง ถ้าลืมจะไม่มีอะไรพังทันที แต่ทะเบียนจะรับเคสเลขลำดับซ้ำได้เงียบ ๆ
// ค่าทั้งหมดอ่านมาจากดัชนีจริงบน db_namphrae ไม่ได้ออกแบบใหม่
export type IndexDef = { key: Record<string, 1 | -1 | '2dsphere'>; unique?: true };

export const MIGRATED_INDEXES: Record<string, IndexDef[]> = {
  incidents: [
    { key: { location: '2dsphere' } },
    { key: { disasterType: 1, year: 1 } },
  ],
  diseaseCases: [{ key: { disease: 1, yearBE: 1, seq: 1 }, unique: true }],
  diseaseYearStats: [{ key: { yearBE: 1 }, unique: true }],
  chikunMooYears: [{ key: { yearBE: 1, moo: 1 }, unique: true }],
};

/** สร้างดัชนีให้ครบ — createIndex ซ้ำได้ ไม่ทำอะไรถ้ามีอยู่แล้ว */
export async function ensureMigratedIndexes(db?: Db): Promise<void> {
  const target = db ?? (await getDb());
  for (const [name, defs] of Object.entries(MIGRATED_INDEXES)) {
    for (const def of defs) {
      await target.collection(name).createIndex(def.key, def.unique ? { unique: true } : {});
    }
  }
}
```

- [ ] **Step 4: รันเทสต์ให้เขียว**

Run: `npx vitest run src/lib/db-indexes.test.ts`
Expected: PASS ทั้ง 4 เคส

เทสต์แตะเฉพาะ `MIGRATED_INDEXES` ซึ่งเป็นข้อมูลบริสุทธิ์ ไม่เรียก `ensureMigratedIndexes()` จึงไม่ต่อ MongoDB — ตรงกับที่ `vitest.config.ts` ตั้งไว้ว่าเทสต์ครอบเฉพาะ logic บริสุทธิ์

- [ ] **Step 5: Commit**

```bash
git add src/lib/db-indexes.ts src/lib/db-indexes.test.ts
git commit -m "feat(db): ประกาศดัชนีของ collection ที่ย้ายมาจาก namphrae-map"
```

---

### Task 10: สคริปต์คัดลอกข้อมูล

**Files:**
- Create: `scripts/copy-map-data.ts`
- Modify: `package.json` (เพิ่ม script `copy:map`)

สคริปต์นี้เปิด `MongoClient` ของตัวเองและปิดเอง ไม่เรียก `getDb()` จาก `src/lib/mongodb.ts`
เพราะต้องอ่านสอง db พร้อมกันและต้องออกจากโปรเซสให้ได้เอง — driver เปิด socket ค้างในพูล ทำให้
สคริปต์ที่ไม่ปิด client ค้างจนโดน kill (`closeDb()` ที่แก้ปัญหานี้อยู่บนสาขา forest ที่ยังไม่ merge
จึงเรียกไม่ได้ — ดูหัวข้อบริบทด้านบน)

เป็น `.ts` ไม่ใช่ `.mts` — บทเรียน `.mts` จาก commit `1488315` เกิดจาก `shpjs` ที่โหลดผ่าน ESM
เท่านั้น สคริปต์นี้ใช้แค่ `mongodb` จึงตามธรรมเนียมเดิมของ `scripts/import-map-layers.ts` ได้

- [ ] **Step 1: เขียนสคริปต์**

Create `scripts/copy-map-data.ts`:

```ts
// คัดลอก collection ของ namphrae-map จาก db_namphrae → namphrae_portal
// upsert ตาม _id เดิม จึงรันซ้ำได้ไม่จำกัดและได้ผลเท่าเดิมเสมอ
//
// ใช้สองรอบตามแผนย้าย: รอบแรกเพื่อเริ่มเทียบสองเว็บ รอบสองก่อนปิด namphrae-map
// เพื่อเก็บข้อมูลที่เข้ามาระหว่างช่วงรันคู่
//
//   npm run copy:map -- --dry-run   ดูว่าจะเพิ่ม/อัปเดตกี่รายการ ไม่เขียนจริง
//   npm run copy:map                คัดลอกจริง
//
// submittedreports ไม่อยู่ในรายการนี้โดยเจตนา — เป็นของระบบแจ้งเรื่อง LINE
// portal อ่านข้าม db ผ่าน getReportsDb() ถ้าคัดลอกมา ข้อมูลจะแช่แข็งทันที
import './load-env';
import { MongoClient } from 'mongodb';
import { ensureMigratedIndexes } from '../src/lib/db-indexes';

const SOURCE_DB = 'db_namphrae';
const TARGET_DB = process.env.MONGODB_DB || 'namphrae_portal';

const COLLECTIONS: { from: string; to: string }[] = [
  { from: 'incidents', to: 'incidents' },
  { from: 'dengueregistrycases', to: 'diseaseCases' },
  { from: 'dengueyearstats', to: 'diseaseYearStats' },
  { from: 'chikunmooyears', to: 'chikunMooYears' },
];

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ตั้ง MONGODB_URI ใน .env.local ก่อน');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const source = client.db(SOURCE_DB);
    const target = client.db(TARGET_DB);
    console.log(`${SOURCE_DB} → ${TARGET_DB}${dryRun ? '  (ซ้อมอย่างเดียว ไม่เขียนจริง)' : ''}\n`);

    let grandTotal = 0;
    for (const { from, to } of COLLECTIONS) {
      const docs = await source.collection(from).find({}).toArray();
      let added = 0;
      let updated = 0;

      for (const doc of docs) {
        // __v เป็นขยะจาก mongoose ไม่ต้องพามาด้วย
        const { __v, ...rest } = doc as Record<string, unknown>;
        const exists = await target.collection(to).countDocuments({ _id: doc._id }, { limit: 1 });
        if (exists) updated++;
        else added++;
        if (!dryRun) {
          await target.collection(to).replaceOne({ _id: doc._id }, rest, { upsert: true });
        }
      }

      grandTotal += docs.length;
      console.log(
        `${to.padEnd(18)} อ่าน ${String(docs.length).padStart(5)}` +
          `  เพิ่ม ${String(added).padStart(5)}  อัปเดต ${String(updated).padStart(5)}`
      );
    }

    console.log(`\nรวม ${grandTotal} รายการ`);

    if (!dryRun) {
      await ensureMigratedIndexes(target);
      console.log('สร้างดัชนีครบแล้ว');
    }
  } finally {
    // driver เปิด socket ค้างในพูลการเชื่อมต่อ ซึ่งกัน event loop ของ Node ไม่ให้ออกเอง
    // ไม่ปิด client = สคริปต์ค้างจนกว่าจะถูก kill
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

`import './load-env';` **ต้องเป็นบรรทัด import แรก** — `src/lib/mongodb.ts` อ่าน
`process.env.MONGODB_URI` ที่ระดับโมดูล ถ้า env ยังไม่โหลดตอนนั้น store จะเงียบ ๆ ไปเขียนไฟล์
ใน `data/` แทน Mongo แล้วสคริปต์รายงานว่าสำเร็จทั้งที่ข้อมูลไม่ได้อยู่ในที่ที่แอปอ่าน
(เหตุผลเต็มอยู่ในคอมเมนต์ของ `scripts/load-env.ts`)

- [ ] **Step 2: เพิ่ม npm script**

Modify `package.json` — เพิ่มต่อจาก `"import:map"`:

```json
    "copy:map": "tsx scripts/copy-map-data.ts"
```

- [ ] **Step 3: ซ้อมก่อนของจริง**

Run: `npm run copy:map -- --dry-run`
Expected: พิมพ์ตารางที่ทุก collection มี "อัปเดต 0" และตัวเลข "เพิ่ม" ตรงกับต้นทาง —
`incidents` 374, `diseaseCases` 176, `diseaseYearStats` 10, `chikunMooYears` 66 รวม 626

(ตัวเลขนับไว้เมื่อ 2026-08-17 ถ้าไม่ตรงเป๊ะแต่ใกล้เคียง แปลว่ามีข้อมูลเข้าใหม่ — ปกติ ไม่ใช่ปัญหา)

**สคริปต์ต้องออกเอง ไม่ค้าง** ถ้าค้าง แปลว่า `client.close()` ไม่ได้ถูกเรียก

- [ ] **Step 4: คัดลอกจริง**

Run: `npm run copy:map`
Expected: ตารางเดิม บวกบรรทัด "สร้างดัชนีครบแล้ว"

- [ ] **Step 5: รันซ้ำเพื่อพิสูจน์ว่ารันซ้ำได้**

Run: `npm run copy:map`
Expected: ทุก collection ขึ้น "เพิ่ม 0" และ "อัปเดต" เท่ากับจำนวนทั้งหมด — นี่คือหลักฐานว่ารันซ้ำแล้วไม่เกิดของซ้ำ ซึ่งเป็นข้อกำหนดหลักของสคริปต์นี้

- [ ] **Step 6: ตรวจว่าดัชนีขึ้นจริงบนปลายทาง**

```bash
node --env-file=.env.local -e '
const { MongoClient } = require("mongodb");
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db(process.env.MONGODB_DB || "namphrae_portal");
  for (const n of ["incidents","diseaseCases","diseaseYearStats","chikunMooYears"]) {
    const ix = await db.collection(n).indexes();
    console.log(n, ix.map(i => i.name + (i.unique ? " UNIQUE" : "")).join(" | "));
  }
  await c.close();
})();
'
```
Expected: `diseaseCases` มี `disease_1_yearBE_1_seq_1 UNIQUE`, `incidents` มี `location_2dsphere`, อีกสองตัวมีดัชนี unique ของตัวเอง

- [ ] **Step 7: Commit**

```bash
git add scripts/copy-map-data.ts package.json
git commit -m "feat(scripts): คัดลอกข้อมูล namphrae-map เข้า namphrae_portal แบบรันซ้ำได้"
```

---

### Task 11: ขอบเขตหมู่บ้าน

**Files:**
- Create: `public/cmu_namphare.geojson`

- [ ] **Step 1: คัดลอกไฟล์**

```bash
cp /Users/thanawatsodsri/Fullstack/namphrae-map/public/cmu_namphare.geojson public/
```

- [ ] **Step 2: ตรวจว่าไฟล์ใช้ได้จริง ไม่ใช่แค่มีอยู่**

```bash
node -e '
const fc = require("./public/cmu_namphare.geojson");
console.log("type:", fc.type, "features:", fc.features.length);
console.log("ตัวอย่าง props:", JSON.stringify(fc.features[0].properties));
console.log("geometry:", fc.features[0].geometry.type);
'
```
Expected: `type: FeatureCollection`, จำนวน feature มากกว่า 0, `geometry: Polygon` และ properties มีคีย์ `title` — ตรงกับชนิด `VillageProps` ใน `src/lib/village-geo.ts`

ถ้า properties ไม่มี `title` ให้หยุดและรายงาน — `villageOf()` จะคืนชื่อหมู่บ้านไม่ได้ และสถิติรายหมู่ในรอบ 2–3 จะว่างทั้งหมด

- [ ] **Step 3: Commit**

```bash
git add public/cmu_namphare.geojson
git commit -m "feat(map): ขอบเขตหมู่บ้านตำบลน้ำแพร่สำหรับสถิติรายหมู่"
```

---

### Task 12: ปิดรอบ — ตรวจทั้งระบบ

- [ ] **Step 1: เทสต์ทั้งหมด**

Run: `npm test`
Expected: PASS ทั้งหมด — 25 ไฟล์เดิมของ portal + 15 ไฟล์เทสต์ที่ยกมา + `db-indexes.test.ts` = 41 ไฟล์

- [ ] **Step 2: type check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: lint**

Run: `npm run lint`
Expected: ไม่มี error

- [ ] **Step 4: build**

Run: `npm run build`
Expected: build สำเร็จ และรายการ route **เหมือนเดิมทุกบรรทัด** — รอบนี้ไม่เพิ่มหน้าใหม่แม้แต่หน้าเดียว ถ้ามี route โผล่มา แปลว่ามีไฟล์เทสต์หลงไปอยู่ใต้ `src/pages/**` หรือลืมลบ `smoke-check.tsx`

- [ ] **Step 5: ยืนยันว่าหน้าเดิมยังทำงาน**

```bash
npm run dev
```
เปิด `/`, `/map`, `/admin` แล้วยืนยันว่าทั้งสามหน้าโหลดได้ปกติ และเมนู sidebar ของ `/admin`
**ยังไม่มี** "ภัยพิบัติ"/"สาธารณสุข" โผล่มาให้สมาชิกทั่วไปเห็น (เห็นได้เฉพาะผู้จัดการ เพราะ
`resolveAccess` ให้ผู้จัดการครบทุก key)

- [ ] **Step 6: Commit ถ้ามีอะไรค้าง**

```bash
git status
```
ถ้าสะอาดแล้วไม่ต้อง commit อะไรเพิ่ม

---

## เสร็จรอบ 1 แล้วได้อะไร

- ตรรกะคำนวณสถิติ วันที่ไทย และการแปลง Excel ทั้งหมดอยู่ใน portal แล้ว **พร้อมเทสต์เดิมที่พิสูจน์ว่าไม่ได้แก้**
- ข้อมูล 626 รายการอยู่ใน `namphrae_portal` พร้อมดัชนีครบ และคัดลอกซ้ำได้ทุกเมื่อ
- ระบบสิทธิ์รู้จัก `disaster`/`health` แล้ว แต่ยังไม่เปิดให้ใครโดยอัตโนมัติ
- **หน้าเว็บยังไม่มีอะไรเปลี่ยน** — ผู้ใช้จริงไม่รู้สึกอะไรเลย ซึ่งถูกต้องสำหรับรอบฐานราก

รอบ 2 (ภัยพิบัติ) จะเริ่มจาก `disaster-store.ts` ที่อ่าน `incidents` ด้วยดัชนีที่สร้างไว้แล้ว
