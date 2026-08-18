# ย้าย namphrae-map รอบที่ 2B: หน้าเว็บและ component ภัยพิบัติ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้หน้า `/disaster`, `/disaster/insights` และ `/admin/disaster` ทำงานบน portal โดยใช้ API ที่ 2A ทำไว้ และใช้ chrome ของ portal แทนของ map

**Architecture:** ยก component แผนที่/กราฟ/ฟอร์มมาเกือบตรง ๆ เปลี่ยนแค่ import path กับสี ส่วนหน้าเว็บเขียนใหม่เพราะต้องทิ้ง `TopNav`/`SubTabs`/`AccessDenied` ของ map ไปใช้ `SiteHeader`/`AdminLayout`/`MemberGuard` ของ portal — ทุกอย่างที่แตะ leaflet ต้อง `dynamic({ ssr: false })` เพราะ leaflet พังตั้งแต่ตอนโหลดโมดูลบน Node

**Tech Stack:** Next.js 16 (Pages Router) · react-leaflet 5 · recharts 3 · leaflet.markercluster · leaflet.heat · TypeScript · vitest

**Spec:** [2026-08-17-namphrae-map-migration-design.md](../specs/2026-08-17-namphrae-map-migration-design.md) — รอบ 2 ข้อ "ภัยพิบัติ"
**แผนก่อนหน้า:** [2026-08-18-map-migration-2a-disaster-data.md](2026-08-18-map-migration-2a-disaster-data.md) (เสร็จแล้ว)

**ต้นทาง:** `/Users/thanawatsodsri/Fullstack/namphrae-map` — repo แยก อ่านอย่างเดียว ห้ามแก้

---

## สถานะตั้งต้น

รอบ 1 + 2A เสร็จแล้ว — **412 เทสต์ 39 ไฟล์** บน `feature/map-migration`

พร้อมใช้แล้วทั้งหมด: ตรรกะบริสุทธิ์ (`disaster-stats`, `disaster-admin-view`, `disaster-options`,
`village-geo`, `url-state`, `color-scales`, `image-resize`, `thai-date`, `disaster-image`,
`disaster-types`, `src/types/disaster.ts`) · API 4 เส้น · ข้อมูลจริง 374 เหตุใน `namphrae_portal`
· `public/cmu_namphare.geojson` · feature key `disaster` · เมนู sidebar (ตอนนี้ชี้ไปหน้า 404)

dependency ครบแล้วตั้งแต่รอบ 1 Task 1: `react-leaflet@^5`, `leaflet@^1.9.4`,
`leaflet.markercluster@^1.5.3`, `leaflet.heat@^0.2.0`, `recharts@^3.10.1` พร้อม `@types/*`

**API ที่หน้าเว็บจะเรียก** (จาก 2A):
```
GET /api/disaster/incidents?type=&year=   → { incidents: IncidentItem[] }
GET /api/disaster/stats                   → { stats: YearStat[] }
GET  /api/admin/disaster/incidents        → { incidents }
POST /api/admin/disaster/incidents        → { incident }        201
PUT  /api/admin/disaster/incidents/[id]   → { incident }
DELETE /api/admin/disaster/incidents/[id] → { id }
```
**ไม่ใช่** ซอง `{ success, data }` แบบต้นทาง — หน้าเว็บต้องอ่านคีย์ใหม่

---

## สามเรื่องที่ต้องออกแบบ ไม่ใช่ยกมา

### 1. อัปโหลดรูป — คนละสัญญากันคนละแบบ

ต้นทาง `IncidentForm.tsx:91` ย่อรูปด้วย canvas แล้ว POST **data URI** ไป `/api/upload` ของตัวเอง
ซึ่งอัปเข้า Cloudinary ฝั่งเซิร์ฟเวอร์แล้วคืน `{ url }`

portal ไม่มี endpoint แบบนั้น — `/api/admin/upload` คืนแค่**ลายเซ็น**
(`{ signature, timestamp, apiKey, cloudName, folder, resourceType }`) แล้วให้เบราว์เซอร์ยิงไฟล์ตรง
ไป Cloudinary เอง คอมเมนต์ใน `src/lib/admin-api.ts` อธิบายว่าทำแบบนี้เพื่อไม่ให้ไฟล์ใหญ่วิ่งผ่าน
serverless function ที่จำกัด body ~4.5MB

**ทางที่เลือก:** เก็บการย่อรูปไว้ (ต้นทางย่อเป็น 1920px คุณภาพ 0.85 เพดาน 5MB) แล้วแปลงผลลัพธ์
จาก data URI เป็น `File` ก่อนส่งเข้า `uploadMedia(file, 'image')` ของ portal

เหตุผลที่ไม่ทิ้งการย่อ: เจ้าหน้าที่ถ่ายจากมือถือ ไฟล์ 8–12MB ต่อรูป การอัปตรงโดยไม่ย่อทำให้
พื้นที่ Cloudinary หมดเร็วขึ้นหลายเท่าและหน้าเว็บสาธารณะโหลดช้าลง — และ `image-resize.ts`
ที่รอบ 1 ยกมาแล้วจะไม่มีใครใช้เลยถ้าทิ้ง

### 2. `Icon` สองตัวเข้ากันไม่ได้

| | ของ map | ของ portal |
|---|---|---|
| รับ | `name: IconName` (17 ชื่อตายตัว) | `name: string` (ligature ของ Material Symbols) |
| วาดด้วย | SVG path ในไฟล์ | ฟอนต์ ligature |

ฝั่งภัยพิบัติเรียก 11 ชื่อ **ทิ้ง `ui/Icon.tsx` ของ map ใช้ของ portal แล้วแมปชื่อ** ตามตารางใน Task 5

10 ชื่ออยู่ใน `ICON_NAMES` แล้ว ขาดตัวเดียวคือ `image` ต้องเพิ่ม — `src/lib/icons.ts` เตือนไว้เองว่า
*"a glyph not listed there renders as its ligature text, so ADD THE NAME HERE FIRST"*

### 3. chrome ของ map ต้องทิ้งทั้งหมด

| ของ map | ใช้อะไรแทน |
|---|---|
| `TopNav` (แถบ disaster/health) | `SiteHeader` ของ portal สำหรับหน้าสาธารณะ |
| `SubTabs` (dashboard/insights/admin) | ลิงก์ธรรมดาในหน้า — portal ไม่มีแนวคิด sub-tab |
| `AccessDenied` | `withMemberGuard` + `AdminLayout` ของ portal |
| `UserName` | `AdminLayout` แสดงชื่อผู้ใช้ให้อยู่แล้ว |

`AccessDenied.tsx` ของต้นทาง hard-code `<TopNav active="health" />` ไว้ ทั้งที่หน้า admin
ภัยพิบัติก็เรียกมัน — คนที่ไม่มีสิทธิ์จึงเห็นแท็บ "สาธารณสุข" สว่างอยู่ทั้งที่กำลังจะเข้าหน้าภัยพิบัติ
การทิ้งไปใช้ guard ของ portal ทำให้บั๊กนี้หายไปเอง

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `src/components/disaster/mapBase.tsx` | ฐานแผนที่ร่วม — `CENTER`, `BaseTileLayer`, `FitBounds`, ชนิด `BaseLayer` |
| `src/components/disaster/MapLayers.tsx` | `ClusterLayer`, `HeatLayer` (ปลั๊กอิน leaflet) |
| `src/components/disaster/MapView.tsx` | แผนที่หมุด/กระจุก/ความหนาแน่น + ตัวเลือกพิกัด |
| `src/components/disaster/ChoroplethMap.tsx` | แผนที่ไล่เฉดรายหมู่ (หน้า insights) |
| `src/components/disaster/IncidentTable.tsx` | ตารางเหตุในหลังบ้าน |
| `src/components/disaster/IncidentForm.tsx` | ฟอร์มเพิ่ม/แก้เหตุ + อัปรูป |
| `src/components/disaster/TypeYearChart.tsx` | กราฟแท่งรายปีต่อประเภท |
| `src/components/disaster/SeasonalChart.tsx` | กราฟรายเดือน |
| `src/components/disaster/ui.tsx` | `GlassPanel`, `CommandBar`, `Segmented`, `Badge` รวมไฟล์เดียว |
| `src/components/disaster/SelectOrCustom.tsx` | dropdown ที่พิมพ์ค่าเองได้ |
| `src/components/disaster/ThaiDatePicker.tsx` | ตัวเลือกวันที่ พ.ศ. |
| `src/hooks/use-villages.ts` | โหลด `cmu_namphare.geojson` ครั้งเดียว ใช้ร่วมสามหน้า |
| `src/pages/disaster/index.tsx` | หน้าแผนที่สาธารณะ |
| `src/pages/disaster/insights.tsx` | หน้าสถิติสาธารณะ |
| `src/pages/admin/disaster.tsx` | หลังบ้าน CRUD |
| `src/lib/icons.ts` (แก้) | เพิ่ม `image` |

รวม `GlassPanel`/`CommandBar`/`Segmented`/`Badge` เป็นไฟล์เดียวเพราะทั้งสี่ตัวรวมกันแค่ ~85 บรรทัด
และเปลี่ยนพร้อมกันเสมอเวลาปรับสี — แยกสี่ไฟล์คือ ceremony ที่ไม่ได้อะไรกลับมา

---

## Task 1: hook โหลดขอบเขตหมู่บ้าน

**Files:** Create `src/hooks/use-villages.ts`

ต้นทางเขียน `fetch('/cmu_namphare.geojson')` ซ้ำเหมือนกันเป๊ะสามที่ (`pages/index.tsx:53`,
`pages/insights.tsx:40`, `pages/admin/index.tsx:34`) พร้อม `useState` และ `.catch(() => setVillages(null))`
เดียวกัน — รวมเป็น hook เดียวตั้งแต่แรกดีกว่ายกความซ้ำมาด้วย

- [ ] **Step 1: เขียน hook**

```ts
import { useEffect, useState } from 'react';
import type { VillageCollection } from '@/lib/village-geo';

// ขอบเขตหมู่บ้านเป็นไฟล์ static ก้อนเดียว (~70 KB) ที่ทั้งสามหน้าของภัยพิบัติต้องใช้
// เหมือนกัน — ต้นทางเขียน fetch เดียวกันซ้ำสามที่ รวมไว้ที่เดียวตั้งแต่แรกดีกว่า
//
// พังแล้วคืน null ไม่ throw: หน้าแผนที่ยังแสดงหมุดได้โดยไม่มีเส้นขอบหมู่ ส่วนสถิติ
// รายหมู่จะว่าง ซึ่งแย่กว่าแต่ยังดีกว่าทั้งหน้าล่ม
export function useVillages(): VillageCollection | null {
  const [villages, setVillages] = useState<VillageCollection | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/cmu_namphare.geojson')
      .then((r) => r.json())
      .then((v: VillageCollection) => alive && setVillages(v))
      .catch(() => alive && setVillages(null));
    return () => {
      alive = false;
    };
  }, []);
  return villages;
}
```

`alive` guard ไม่ได้มีในต้นทาง — เพิ่มเพราะ React 18+ ใน dev เรียก effect สองรอบ การ setState
หลัง unmount จะขึ้น warning ที่ไล่ต้นตอยาก

- [ ] **Step 2: ตรวจ**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: สะอาด 412/39 (ไม่เพิ่มเทสต์ — hook ต้องมี DOM ถึงจะทดสอบได้ ซึ่งเกินกติกา
"เทสต์เฉพาะตรรกะบริสุทธิ์" ของ repo นี้)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-villages.ts
git commit -m "feat(disaster): hook โหลดขอบเขตหมู่บ้านใช้ร่วมสามหน้า"
```

---

## Task 2: ฐานแผนที่และปลั๊กอิน leaflet

**Files:** Create `src/components/disaster/mapBase.tsx`, `src/components/disaster/MapLayers.tsx`

- [ ] **Step 1: คัดลอก**

```bash
MAP=/Users/thanawatsodsri/Fullstack/namphrae-map
mkdir -p src/components/disaster
cp "$MAP/components/mapBase.tsx"   src/components/disaster/mapBase.tsx
cp "$MAP/components/MapLayers.tsx" src/components/disaster/MapLayers.tsx
```

- [ ] **Step 2: แก้ import**

`mapBase.tsx` — เปลี่ยน `from '../lib/geo'` เป็น `from '@/lib/village-geo'`
`MapLayers.tsx` — เปลี่ยน:
```ts
import type { IncidentItem } from '@/types/disaster';
import { imageUrl } from '@/lib/disaster-image';
```
(ต้นทาง import ทั้งสองจาก `'../lib/types'` ซึ่งรอบ 1 แยกออกเป็นสองที่)

ลบคอมเมนต์พาธเก่าบรรทัดแรกของทั้งสองไฟล์ถ้ามี **ห้ามแก้ตรรกะ**

- [ ] **Step 3: ตรวจว่าไม่มีใคร import แบบ static**

```bash
npx tsc --noEmit && npm run lint && npm run build
```
Expected: build ผ่าน — ตอนนี้ยังไม่มีใคร import สองไฟล์นี้ จึงยังไม่มีทางพัง

**leaflet พังตั้งแต่ตอนโหลดโมดูลบน Node** (`leaflet-src.js` เรียก `document.documentElement.style`
ที่ระดับบนสุด) ทดสอบยืนยันแล้ว ทุกไฟล์ที่ import มันจึงต้องถูกเรียกผ่าน
`dynamic(() => import(...), { ssr: false })` เท่านั้น — Task 9–11 เป็นคนบังคับข้อนี้

- [ ] **Step 4: Commit**

```bash
git add src/components/disaster/mapBase.tsx src/components/disaster/MapLayers.tsx
git commit -m "feat(disaster): ฐานแผนที่และเลเยอร์กระจุก/ความหนาแน่น"
```

---

## Task 3: MapView และ ChoroplethMap

**Files:** Create `src/components/disaster/MapView.tsx`, `src/components/disaster/ChoroplethMap.tsx`

- [ ] **Step 1: คัดลอก**

```bash
MAP=/Users/thanawatsodsri/Fullstack/namphrae-map
cp "$MAP/components/MapView.tsx"       src/components/disaster/MapView.tsx
cp "$MAP/components/ChoroplethMap.tsx" src/components/disaster/ChoroplethMap.tsx
```

- [ ] **Step 2: แก้ import ของ `MapView.tsx`**

```ts
import type { IncidentItem } from '@/types/disaster';
import { imageUrl } from '@/lib/disaster-image';
import { DISASTER_COLORS, DISASTER_LABELS } from '@/lib/disaster-types';
import type { VillageCollection } from '@/lib/village-geo';
import { ClusterLayer, HeatLayer } from '@/components/disaster/MapLayers';
import { BaseTileLayer, CENTER, FitBounds, type BaseLayer } from '@/components/disaster/mapBase';
```
(ปรับตามที่ไฟล์จริง import มา — ตัวที่มาจาก `'../lib/types'` แยกเป็น `@/types/disaster` กับ
`@/lib/disaster-image` ตัวที่มาจาก `'../lib/disasterTypes'` ไปที่ `@/lib/disaster-types`)

- [ ] **Step 3: แก้ import ของ `ChoroplethMap.tsx`**

```ts
import { DENGUE_SCALE } from '@/lib/color-scales';
import type { VillageCollection } from '@/lib/village-geo';
import { BaseTileLayer, CENTER, FitBounds, type BaseLayer } from '@/components/disaster/mapBase';
```

- [ ] **Step 4: ตรวจ**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/disaster/MapView.tsx src/components/disaster/ChoroplethMap.tsx
git commit -m "feat(disaster): แผนที่หมุดและแผนที่ไล่เฉดรายหมู่"
```

---

## Task 4: กราฟ recharts

**Files:** Create `src/components/disaster/TypeYearChart.tsx`, `src/components/disaster/SeasonalChart.tsx`

- [ ] **Step 1: คัดลอกแล้วแก้ import**

```bash
MAP=/Users/thanawatsodsri/Fullstack/namphrae-map
cp "$MAP/components/TypeYearChart.tsx" src/components/disaster/TypeYearChart.tsx
cp "$MAP/components/SeasonalChart.tsx" src/components/disaster/SeasonalChart.tsx
```

ทั้งสองไฟล์เปลี่ยน `'../lib/disasterTypes'` → `'@/lib/disaster-types'` และ `'../lib/stats'`
→ `'@/lib/disaster-stats'` ลบคอมเมนต์พาธเก่าบรรทัดแรก

- [ ] **Step 2: ตรวจ**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

**recharts ไม่พังบน Node** (ทดสอบด้วย `require()` แล้ว ต่างจาก leaflet) จึงไม่จำเป็นต้อง
`dynamic({ ssr: false })` ต้นทางทำไว้ด้วยความเคยชิน ที่นี่ import ตรง ๆ ได้ — ได้ HTML
ฝั่งเซิร์ฟเวอร์ที่ดีกว่าและโค้ดง่ายกว่า ถ้า build พังค่อยเปลี่ยนไป dynamic แล้วรายงาน

- [ ] **Step 3: Commit**

```bash
git add src/components/disaster/TypeYearChart.tsx src/components/disaster/SeasonalChart.tsx
git commit -m "feat(disaster): กราฟรายปีต่อประเภทและกราฟรายเดือน"
```

---

## Task 5: ui primitives และการแมปไอคอน

**Files:**
- Create: `src/components/disaster/ui.tsx`, `src/components/disaster/SelectOrCustom.tsx`, `src/components/disaster/ThaiDatePicker.tsx`
- Modify: `src/lib/icons.ts`

- [ ] **Step 1: เพิ่ม `image` ลง `ICON_NAMES`**

ใน `src/lib/icons.ts` แทรก `'image',` ใน `ICON_NAMES` ให้เรียงตามตัวอักษร — ระหว่าง `'home'`
กับ `'layers'`

อีก 10 ชื่อที่ต้องใช้มีอยู่แล้ว ตรวจได้ด้วย:
```bash
for n in warning add delete edit search check_circle image location_on notifications chevron_left chevron_right; do
  printf "  %-16s %s\n" "$n" "$(grep -q \"'$n',\" src/lib/icons.ts && echo มี || echo ขาด)"
done
```
Expected: มีครบทั้ง 11

- [ ] **Step 2: รวม 4 primitive เป็นไฟล์เดียว**

สร้าง `src/components/disaster/ui.tsx` โดยคัดลอกเนื้อฟังก์ชันจาก
`$MAP/components/ui/GlassPanel.tsx`, `CommandBar.tsx`, `Segmented.tsx`, `Badge.tsx`
มาต่อกันในไฟล์เดียว (ทั้งสี่รวมกัน ~85 บรรทัด) แล้ว:

- `Badge` — เปลี่ยน `'../../lib/disasterTypes'` → `'@/lib/disaster-types'`
- แก้สี: ทุกที่ที่เป็น `#0e7c66` (brand ของ map) เปลี่ยนเป็น token เขียวของ portal
  ตรวจว่า portal ใช้ชื่ออะไรด้วย `grep -n "green-deep\|0f7a37" src/app/globals.css src/styles/*.css 2>/dev/null`
  แล้วใช้ชื่อนั้น **ห้ามเพิ่ม token ชุดใหม่เป็น alias** — `globals.css` เขียนไว้เองว่ากำลังถอด
  alias เดิมทิ้งอยู่

- [ ] **Step 3: คัดลอกอีกสองตัว**

```bash
MAP=/Users/thanawatsodsri/Fullstack/namphrae-map
cp "$MAP/components/ui/SelectOrCustom.tsx" src/components/disaster/SelectOrCustom.tsx
cp "$MAP/components/ui/ThaiDatePicker.tsx" src/components/disaster/ThaiDatePicker.tsx
```

`ThaiDatePicker` import `'../../lib/thaiCalendar'` → `'@/lib/thai-calendar'` และ
`'../../lib/thaiDate'` → `'@/lib/thai-date'`
`SelectOrCustom` ไม่ import อะไรจาก lib

ทั้งสองตัวถ้าเรียก `<Icon name="..."/>` ของ map ให้เปลี่ยนไปใช้ของ portal ตามตาราง Step 4

- [ ] **Step 4: ตารางแมปชื่อไอคอน — ใช้ทุกที่ในรอบนี้**

| ของ map | ของ portal |
|---|---|
| `alert` | `warning` |
| `plus` | `add` |
| `trash` | `delete` |
| `edit` | `edit` |
| `search` | `search` |
| `check` | `check_circle` |
| `image` | `image` |
| `map-pin` | `location_on` |
| `bell` | `notifications` |
| `chevron-left` | `chevron_left` |
| `chevron-right` | `chevron_right` |

import จาก `@/components/Icon` (default export) ซึ่งรับ `name: string` ตรง ๆ
**อย่าคัดลอก `ui/Icon.tsx` ของ map มา** — มันวาด SVG เอง ส่วน portal ใช้ฟอนต์ ligature
การมีสองระบบไอคอนในโปรเจกต์เดียวคือหนี้ที่ไม่ได้อะไรกลับมา

- [ ] **Step 5: ตรวจและ commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add src/components/disaster/ui.tsx src/components/disaster/SelectOrCustom.tsx src/components/disaster/ThaiDatePicker.tsx src/lib/icons.ts
git commit -m "feat(disaster): ui primitives และแมปไอคอนเข้าชุดของ portal"
```

---

## Task 6: ตารางเหตุ

**Files:** Create `src/components/disaster/IncidentTable.tsx`

- [ ] **Step 1: คัดลอกแล้วแก้**

```bash
cp /Users/thanawatsodsri/Fullstack/namphrae-map/components/IncidentTable.tsx src/components/disaster/IncidentTable.tsx
```

แก้ import:
```ts
import type { IncidentItem } from '@/types/disaster';
import { imageUrl } from '@/lib/disaster-image';
import { DISASTER_LABELS } from '@/lib/disaster-types';
import Icon from '@/components/Icon';
import { Badge } from '@/components/disaster/ui';
```
แล้วแมปชื่อไอคอนตามตาราง Task 5 Step 4 (ไฟล์นี้ใช้ `edit` กับ `trash`)

- [ ] **Step 2: ตรวจและ commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add src/components/disaster/IncidentTable.tsx
git commit -m "feat(disaster): ตารางเหตุในหลังบ้าน"
```

---

## Task 7: ฟอร์มเหตุ + ต่อการอัปรูปเข้ากับ portal

**Files:** Create `src/components/disaster/IncidentForm.tsx`

นี่คือไฟล์ที่ต้องแก้มากที่สุดในรอบนี้ (ต้นทาง 223 บรรทัด)

- [ ] **Step 1: คัดลอก**

```bash
cp /Users/thanawatsodsri/Fullstack/namphrae-map/components/IncidentForm.tsx src/components/disaster/IncidentForm.tsx
```

- [ ] **Step 2: แก้ import ทั้งหมด**

```ts
import dynamic from 'next/dynamic';
import type { IncidentItem } from '@/types/disaster';
import { imageUrl } from '@/lib/disaster-image';
import { DISASTER_TYPES, DISASTER_LABELS, type DisasterType } from '@/lib/disaster-types';
import { villageOf, type VillageCollection } from '@/lib/village-geo';
import { fitDimensions } from '@/lib/image-resize';
import { METHOD_OPTIONS, AREA_TYPE_OPTIONS } from '@/lib/disaster-options';
import { uploadMedia } from '@/lib/admin-api';
import Icon from '@/components/Icon';
import SelectOrCustom from '@/components/disaster/SelectOrCustom';
import ThaiDatePicker from '@/components/disaster/ThaiDatePicker';
```
และ dynamic import ของแผนที่เปลี่ยนเป็น:
```ts
const MapView = dynamic(() => import('@/components/disaster/MapView'), { ssr: false });
```

- [ ] **Step 3: เปลี่ยนการอัปรูป**

หาโค้ดช่วงที่ยิง `/api/upload` (ราวบรรทัด 88–97 ของต้นทาง):
```ts
      const r = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUri }),
      });
      ...
      set('imageFile', j.url);
```

แทนที่ด้วยการแปลง data URI ที่ย่อแล้วกลับเป็น `File` แล้วส่งเข้า `uploadMedia`:
```ts
      // portal ไม่รับ data URI — /api/admin/upload คืนแค่ลายเซ็นแล้วให้เบราว์เซอร์
      // ยิงไฟล์ตรงไป Cloudinary เอง (เลี่ยงเพดาน body ~4.5MB ของ serverless)
      // ยังย่อรูปก่อนเหมือนเดิม เพราะเจ้าหน้าที่ถ่ายจากมือถือได้ไฟล์ 8–12MB ต่อรูป
      const blob = await (await fetch(dataUri)).blob();
      const resized = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
        type: 'image/jpeg',
      });
      const { url } = await uploadMedia(resized, 'image');
      set('imageFile', url);
```

`fetch(dataUri)` แปลง data URI เป็น Blob ได้โดยไม่ต้องถอด base64 เอง — รองรับในทุกเบราว์เซอร์
ที่ portal รองรับอยู่แล้ว

การย่อรูปด้วย canvas (`fitDimensions`, 1920px, คุณภาพ 0.85, เพดาน 5MB) **คงไว้ทั้งหมด**
ห้ามตัดออก

- [ ] **Step 4: แมปไอคอน** ตามตาราง Task 5 Step 4 (ไฟล์นี้ใช้ `image`, `map-pin`, `check`, `plus`)

- [ ] **Step 5: ตรวจและ commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add src/components/disaster/IncidentForm.tsx
git commit -m "feat(disaster): ฟอร์มเหตุ ต่ออัปรูปเข้าระบบลายเซ็นของ portal"
```

---

## Task 8: หน้าแผนที่สาธารณะ `/disaster`

**Files:** Create `src/pages/disaster/index.tsx`

อ้างอิงโครงจาก `$MAP/pages/index.tsx` (206 บรรทัด) แต่**เขียนใหม่ส่วน chrome**

- [ ] **Step 1: สร้างหน้า**

สิ่งที่ยกมาได้เกือบตรง: state `all`/`stats`/`baseLayer`/`playing`, การอ่าน `type`/`year`/`mode`
จาก `router.query` ด้วย `pickOne`/`readYear` จาก `@/lib/url-state`, การเขียนกลับด้วย
`router.replace(..., { shallow: true })`, การคำนวณ KPI ด้วย `computeKpis`/`countByVillage`
จาก `@/lib/disaster-stats`

สิ่งที่ต้องเปลี่ยน:
1. `villages` ใช้ `useVillages()` จาก `@/hooks/use-villages` แทน `useState`+`useEffect`
2. ดึงข้อมูลจาก endpoint ใหม่และอ่านคีย์ใหม่:
```ts
   fetch(`/api/disaster/incidents?type=${type}`)
     .then((r) => r.json())
     .then((j: { incidents: IncidentItem[] }) => setAll(j.incidents));

   fetch('/api/disaster/stats')
     .then((r) => r.json())
     .then((j: { stats: YearStat[] }) => setStats(j.stats));
```
   (ต้นทางอ่าน `j.data` — ซอง `{ success, data }` ไม่มีแล้ว)
3. ทิ้ง `<TopNav>` กับ `<SubTabs>` ใช้ `SiteHeader` ของ portal และลิงก์ธรรมดาไป
   `/disaster/insights`
4. ปุ่ม "+ บันทึก" เปลี่ยน `href` จาก `/admin` เป็น `/admin/disaster`
5. `MapView` import แบบ dynamic:
```ts
   const MapView = dynamic(() => import('@/components/disaster/MapView'), { ssr: false });
```

- [ ] **Step 2: ตรวจ**

```bash
npx tsc --noEmit && npm run lint && npm run build
```
Expected: build ผ่าน และ route `/disaster` โผล่ในรายการ

- [ ] **Step 3: Commit**

```bash
git add src/pages/disaster/index.tsx
git commit -m "feat(disaster): หน้าแผนที่ภัยพิบัติสาธารณะ"
```

---

## Task 9: หน้าสถิติสาธารณะ `/disaster/insights`

**Files:** Create `src/pages/disaster/insights.tsx`

อ้างอิง `$MAP/pages/insights.tsx` (134 บรรทัด)

- [ ] **Step 1: สร้างหน้า**

ยกมาได้: การอ่าน `choroType`/`year` จาก `router.query`, การคำนวณ `yearData`/`monthData`/
`villageCounts` ด้วย `countByYearType`/`countByMonth`/`countByVillage` จาก `@/lib/disaster-stats`
และ `villageOf` จาก `@/lib/village-geo`

ต้องเปลี่ยน:
1. `useVillages()` แทน fetch เดิม
2. `fetch('/api/disaster/incidents')` แล้วอ่าน `j.incidents`
3. ทิ้ง `TopNav`/`SubTabs` → `SiteHeader` + ลิงก์กลับ `/disaster`
4. dynamic import เฉพาะ `ChoroplethMap` (แตะ leaflet) ส่วนกราฟสองตัว import ตรง ๆ ได้:
```ts
   const ChoroplethMap = dynamic(() => import('@/components/disaster/ChoroplethMap'), { ssr: false });
   import SeasonalChart from '@/components/disaster/SeasonalChart';
   import TypeYearChart from '@/components/disaster/TypeYearChart';
```
5. ส่ง `scale={DISASTER_SCALE}` จาก `@/lib/color-scales` ให้ `ChoroplethMap` เสมอ —
   ค่าปริยายของมันคือ `DENGUE_SCALE` ซึ่งเป็นของหน้าสาธารณสุข ไม่ใช่ของหน้านี้

- [ ] **Step 2: ตรวจและ commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add src/pages/disaster/insights.tsx
git commit -m "feat(disaster): หน้าสถิติภัยพิบัติสาธารณะ"
```

---

## Task 10: หลังบ้าน `/admin/disaster`

**Files:** Create `src/pages/admin/disaster.tsx`

อ้างอิง `$MAP/pages/admin/index.tsx` (135 บรรทัด)

- [ ] **Step 1: สร้างหน้า**

ยกมาได้: state `incidents`/`mode`/`submitting`/`error`/`query`/`typeFilter`/`page` และการใช้
`filterIncidents`/`paginate`/`summaryByType` จาก `@/lib/disaster-admin-view`

ต้องเปลี่ยน:
1. **ทิ้ง `getServerSideProps = getMemberSsrProps` และ `<AccessDenied/>` ทั้งหมด** ใช้
   `withMemberGuard` + `AdminLayout` ของ portal ตามแบบเดียวกับ `src/pages/admin/map/index.tsx`
   — อ่านไฟล์นั้นก่อนเขียน แล้วทำตามรูปแบบเดียวกันเป๊ะ
2. endpoint ใหม่ทั้งหมด และอ่านคีย์ใหม่:
```ts
   // อ่าน
   fetch('/api/admin/disaster/incidents').then(r => r.json())
     .then((j: { incidents: IncidentItem[] }) => setIncidents(j.incidents));
   // สร้าง
   fetch('/api/admin/disaster/incidents', {
     method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values),
   });
   // แก้
   fetch(`/api/admin/disaster/incidents/${id}`, {
     method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values),
   });
   // ลบ
   fetch(`/api/admin/disaster/incidents/${id}`, { method: 'DELETE' });
```
3. `useVillages()` แทน fetch เดิม
4. `IncidentForm`/`IncidentTable` import จาก `@/components/disaster/...`

- [ ] **Step 2: ตรวจและ commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add src/pages/admin/disaster.tsx
git commit -m "feat(disaster): หน้าหลังบ้านจัดการเหตุภัยพิบัติ"
```

---

## Task 11: ตรวจด้วยของจริง

ขั้นนี้ต้องใช้ตาคน เทสต์อัตโนมัติแทนไม่ได้

- [ ] **Step 1: `npm run dev` แล้วเปิดทีละหน้า**

| หน้า | ต้องเห็น |
|---|---|
| `/disaster` | แผนที่ + หมุดเหตุ **374 จุดเมื่อไม่กรอง** · เส้นขอบหมู่บ้าน · KPI |
| `/disaster` เลือก "ไฟป่า" | เหลือ **89** จุด |
| `/disaster` โหมด cluster / heat | สลับได้ ไม่มี error ใน console |
| `/disaster/insights` | แผนที่ไล่เฉด + กราฟรายปี + กราฟรายเดือน |
| `/admin/disaster` | ตารางเหตุ + ปุ่มเพิ่ม (ต้องล็อกอินและมีสิทธิ์ `disaster`) |

- [ ] **Step 2: ตัวเลขต้องตรงกับ API**

```bash
curl -s 'http://localhost:3000/api/disaster/incidents' | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["incidents"]))'
```
Expected: `374` — ต้องเท่ากับจำนวนหมุดที่เห็นบนแผนที่

- [ ] **Step 3: เทียบกับเว็บเดิมทีละหน้า** (ชั้นที่ 3 ของสเปกข้อ 6)

เปิด namphrae-map คู่กัน ปีเดียวกัน ตัวกรองเดียวกัน แล้วเทียบ: จำนวนหมุด · ค่า KPI · รูปกราฟ ·
ลำดับแถวในตาราง

- [ ] **Step 4: ทดสอบเขียนจริงหนึ่งรอบ**

ที่ `/admin/disaster` กดเพิ่มเหตุใหม่ ใส่รูป เลือกพิกัดบนแผนที่ บันทึก แล้ว:
- ตรวจว่าขึ้นในตาราง
- ตรวจว่ารูปขึ้นจริง (พิสูจน์ว่าการต่อ `uploadMedia` ทำงาน)
- แก้แล้วบันทึกซ้ำ
- ลบทิ้ง

**เขียนลง production** — ทำกับเหตุทดสอบที่ลบทิ้งได้เท่านั้น

- [ ] **Step 5: หมู่ 9 หายไปจากสถิติรายหมู่ — ยืนยันว่ายังเป็นแบบนั้น**

หนี้ข้อ 5 ในสเปกระบุว่า `cmu_namphare.geojson` ขาดหมู่ 9 ที่หน้า `/disaster/insights`
ให้ดูว่าแผนที่ไล่เฉดมีพื้นที่ที่ไม่มีสีจริงไหม และบันทึกจำนวนเหตุที่ `villageOf()` คืน `null`
ลงในรายงาน — ตัวเลขนี้คือขนาดของปัญหาที่ต้องแก้ก่อนเอาสถิติรายหมู่ไปใช้จริง

---

## Task 12: ปิดรอบ

- [ ] **Step 1: ครบทุกอย่าง**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```
Expected: 412 เทสต์ 39 ไฟล์ (รอบนี้ไม่เพิ่มเทสต์ — เป็น component กับหน้าเว็บล้วน ซึ่งอยู่นอก
กติกา "เทสต์เฉพาะตรรกะบริสุทธิ์" ตรรกะที่คำนวณอะไรจริงถูกเทสต์ไปแล้วตั้งแต่รอบ 1)

- [ ] **Step 2: route ใหม่ครบ 3 หน้า**

```bash
npm run build 2>&1 | grep -E "/disaster|/admin/disaster"
```
Expected: `/disaster`, `/disaster/insights`, `/admin/disaster` และ API 4 เส้นจาก 2A

- [ ] **Step 3: leaflet ไม่หลุดเข้า server bundle**

```bash
grep -rn "from '@/components/disaster/\(MapView\|MapLayers\|mapBase\|ChoroplethMap\)'" src/pages --include='*.tsx'
```
Expected: **ไม่มีผลลัพธ์** — ทั้งสี่ต้องถูกเรียกผ่าน `dynamic(() => import(...), { ssr: false })`
เท่านั้น ถ้าเจอ static import แปลว่า build จะพังบน production ที่ prerender

- [ ] **Step 4: ไม่มีระบบไอคอนซ้อน**

```bash
ls src/components/disaster/Icon.tsx 2>/dev/null && echo "ผิด — ต้องใช้ Icon ของ portal" || echo "ถูกต้อง"
```

---

## หนี้ที่รอบนี้อาจสร้าง (บันทึกลงสเปกตอนปิด)

| # | เรื่อง | ควรสะสางเมื่อ |
|---|---|---|
| 8 | หน้าเว็บและ component ของรอบนี้ไม่มีเทสต์เลย ตรรกะที่คำนวณจริงถูกคุมไว้แล้วตั้งแต่รอบ 1 แต่การต่อสาย (อ่านคีย์ผิด ส่ง prop ผิด) ไม่มีอะไรจับ | รอบที่ portal เริ่มมีเครื่องมือทดสอบ component |
| 9 | `/disaster` ดึงเหตุทั้ง 374 รายการมาที่เบราว์เซอร์ทุกครั้งที่เปิดหน้า แล้วกรองปีฝั่ง client | ต่อจากหนี้ข้อ 7 — เมื่อจำนวนเหตุโตจนหน้าแรกช้า |

---

## ยังไม่ทำในรอบนี้

- **หน้าสาธารณสุข** (`/health`, `/health/insights`, `/admin/health`) → รอบ 3–4
- **แก้หมู่ 9 ที่หายจาก `cmu_namphare.geojson`** → ต้องขอไฟล์ที่ครบจากต้นทาง ห้ามปั้นขอบเขตเอง
- **ปิด namphrae-map** → รอบ 5 หลังเทียบ parity ครบ
