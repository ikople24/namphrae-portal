# แผนลงมือรอบ 1C — หน้าหลังบ้านของป่าไม้

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปิดหน้า `/admin/forest` ให้เจ้าหน้าที่ลากไฟล์วาง ตรวจ และกดเผยแพร่ชั้นข้อมูล
ป่าไม้ได้ครบวงจร โดยใช้คอมโพเนนต์และตัวเรียก API ชุดเดียวกับหน้าแผนที่

**Architecture:** ทำกับฝั่งเบราว์เซอร์แบบเดียวกับที่รอบ 1B ทำกับฝั่งเซิร์ฟเวอร์ — ดึง
`map-api.ts` ออกเป็นโรงงาน `createLayerApi()` ที่รับ path ฐาน แล้วทั้งสองโดเมนผูกเข้ากับมัน
ส่วน `MapLayerCard` รับตัวเรียก API เป็น prop แทนการ import ตรง

**Tech Stack:** TypeScript · Next.js Pages Router · SWR · Vitest

**สเปก:** [2026-08-26-forest-data-page-design.md](../specs/2026-08-26-forest-data-page-design.md)
· **ต่อจาก:** [รอบ 1B](2026-08-27-forest-1b-routes.md)

---

## โครงไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/layer-api.ts` | โรงงาน `createLayerApi()` — ตัวเรียก API ฝั่งเบราว์เซอร์ |
| `src/lib/map-api.ts` | **แก้** — เหลือแค่ผูกโรงงานกับ `/api/admin/map` แล้ว re-export |
| `src/lib/forest-api.ts` | ใหม่ — ผูกโรงงานกับ `/api/admin/forest` |
| `src/components/admin/MapLayerCard.tsx` | **แก้** — รับ `api` เป็น prop |
| `src/pages/admin/map/{index,[layerId],viewer}.tsx` | **แก้** — ส่ง `api` ให้การ์ด |
| `src/pages/admin/forest/{index,[layerId],viewer}.tsx` | ใหม่ |
| `src/components/admin/AdminLayout.tsx` | **แก้** — เพิ่มเมนู |

`PublicFieldPicker.tsx` ไม่ต้องแตะ — ตรวจแล้วว่าไม่ผูกกับโดเมนเลย รับ `FieldStat[]` กับ
callback เท่านั้น

**เงื่อนไขที่ตรึงไว้ทั้งรอบ:** หน้าแผนที่ต้องทำงานเหมือนเดิมทุกประการ ทั้งการลากไฟล์วาง
การกดเผยแพร่ การทิ้งร่าง การตั้งค่าฟิลด์ และลิงก์ทุกอัน

---

## Task 1: `layer-api.ts` — โรงงานฝั่งเบราว์เซอร์

**Files:**
- Create: `src/lib/layer-api.ts`
- Modify: `src/lib/map-api.ts`

- [ ] **Step 1: อ่านของเดิมให้จบก่อน**

```bash
cat -n src/lib/map-api.ts
```

สังเกตว่ามี path ของ `/api/admin/map` ฝังอยู่ 7 จุด และมีของที่ **ไม่** ผูกกับโดเมนเลยคือ
`UploadRejectedError`, `jsonOrThrow`, `AdminLayerRow`, `UploadStage` และตรรกะแปลง shapefile

- [ ] **Step 2: สร้าง `layer-api.ts`**

ย้ายทุกอย่างจาก `map-api.ts` มาที่นี่ โดยของที่ไม่ผูกโดเมนอยู่ระดับโมดูลตามเดิม ส่วน
ฟังก์ชันที่ยิง API ย้ายเข้าไปอยู่ในโรงงาน:

```ts
// src/lib/layer-api.ts

// ตัวห่อบาง ๆ รอบ API ของคลังไฟล์ภูมิสารสนเทศ สำหรับหน้าหลังบ้าน
//
// โดเมนแผนที่กับโดเมนป่าไม้ใช้ชุดเดียวกัน ต่างกันแค่ path ฐาน — เหตุผลเดียวกับ
// layer-routes.ts ฝั่งเซิร์ฟเวอร์ ถ้าคัดลอกไปวางอีกชุด วันที่แก้การจัดการ error
// ของการอัปไฟล์ อีกโดเมนจะไม่ได้รับการแก้นั้น

export type LayerApiConfig = {
  /** เช่น '/api/admin/map' — ไม่มีทับปิดท้าย */
  apiBase: string;
  /** เช่น '/admin/map' — ใช้ประกอบลิงก์ในหน้าเว็บ ไม่มีทับปิดท้าย */
  pageBase: string;
};

export type LayerApi = {
  /** คีย์ SWR ของรายการเลเยอร์ทั้งหมด */
  layersKey: string;
  layerKey: (layerId: string) => string;
  fetcher: <T = unknown>(url: string) => Promise<T>;
  uploadLayerFile: (
    layerId: string,
    file: File,
    onStage?: (stage: UploadStage) => void
  ) => Promise<MapLayerVersion>;
  publishVersion: (versionId: string) => Promise<MapLayerVersion>;
  discardVersion: (versionId: string) => Promise<void>;
  patchLayer: (
    layerId: string,
    patch: LayerPatchInput
  ) => Promise<{ layer: MapLayer; republishNeeded: boolean }>;
  issuesCsvUrl: (versionId: string, code: string) => string;
  downloadUrl: (versionId: string) => string;
  adminGeojsonUrl: (layerId: string) => string;
  /** ลิงก์หน้าตั้งค่าของเลเยอร์ */
  settingsHref: (layerId: string) => string;
  /** ลิงก์หน้ารายการ */
  indexHref: string;
  /** ลิงก์หน้าดูแผนที่ */
  viewerHref: string;
};

export function createLayerApi(cfg: LayerApiConfig): LayerApi { … }
```

ข้างในโรงงานคือเนื้อเดิมของทุกฟังก์ชัน โดยเปลี่ยนเฉพาะ path ที่ฝังไว้ให้ประกอบจาก
`cfg.apiBase` / `cfg.pageBase` เช่น

```ts
    publishVersion: async (versionId) => {
      const { version } = await jsonOrThrow<{ version: MapLayerVersion }>(
        await fetch(`${cfg.apiBase}/versions/${encodeURIComponent(versionId)}/publish`, {
          method: 'POST',
        })
      );
      return version;
    },
```

**ห้ามเปลี่ยนข้อความภาษาไทย ลำดับขั้นของการอัป หรือรูปแบบ FormData ที่ส่งเข้า Cloudinary
แม้ตัวอักษรเดียว** — `jsonOrThrow` ที่แกะ `checks` ออกมาใส่ `UploadRejectedError` เป็นสิ่งที่
ทำให้การ์ดบอกได้ว่า "ผิดตรงไหนและต้องแก้อะไรใน QGIS" ไม่ใช่แค่ "อัปไม่สำเร็จ"

- [ ] **Step 3: เขียน `map-api.ts` ใหม่ให้เหลือแค่การผูก**

```ts
// src/lib/map-api.ts
import { createLayerApi } from '@/lib/layer-api';

// ตัวเรียก API ของคลังไฟล์แผนที่ — ตรรกะทั้งหมดอยู่ใน layer-api.ts ซึ่งโดเมนป่าไม้ใช้ร่วม
export { UploadRejectedError } from '@/lib/layer-api';
export type { AdminLayerRow, LayerApi, UploadStage } from '@/lib/layer-api';

export const MAP_API = createLayerApi({
  apiBase: '/api/admin/map',
  pageBase: '/admin/map',
});
```

**ไม่ต้อง re-export ฟังก์ชันเดิมทีละตัว** — Task 3 แก้ผู้เรียกทั้งหมดให้ใช้ `MAP_API.<เมธอด>`
แทน การทิ้ง shim ไว้จะกลายเป็นทางให้โค้ดใหม่เผลอ import ฟังก์ชันที่ผูกกับแผนที่ไปใช้ใน
หน้าป่าไม้ ซึ่งเป็นบั๊กที่ `tsc` จับไม่ได้

- [ ] **Step 4: ตรวจไทป์**

```bash
npx tsc --noEmit
```

Expected: **มี error** ที่ `MapLayerCard.tsx` และหน้า `/admin/map/*` เพราะยัง import ฟังก์ชัน
เดิมอยู่ — นี่คือสิ่งที่ต้องการ Task 2 กับ 3 เป็นคนแก้ ให้บันทึกรายการ error ไว้ในรายงาน
แล้วไปต่อ อย่าพยายามแก้ที่นี่

- [ ] **Step 5: commit**

```bash
git add src/lib/layer-api.ts src/lib/map-api.ts
git commit -m "refactor(map): ดึงตัวเรียก API ฝั่งเบราว์เซอร์ออกเป็นโรงงาน"
```

---

## Task 2: `MapLayerCard` รับตัวเรียก API เป็น prop

**Files:**
- Modify: `src/components/admin/MapLayerCard.tsx`

- [ ] **Step 1: เปลี่ยน import กับ props**

ลบ import ของฟังก์ชันจาก `@/lib/map-api` ทิ้ง เหลือเฉพาะไทป์:

```ts
import {
  UploadRejectedError,
  type AdminLayerRow,
  type LayerApi,
  type UploadStage,
} from '@/lib/map-api';
```

แล้วเพิ่ม `api` เข้า props:

```ts
export default function MapLayerCard({
  row,
  api,
  onChanged,
}: {
  row: AdminLayerRow;
  api: LayerApi;
  onChanged: () => void;
}) {
```

- [ ] **Step 2: เปลี่ยนผู้เรียกทุกจุดในไฟล์**

`uploadLayerFile(` → `api.uploadLayerFile(` · `publishVersion(` → `api.publishVersion(` ·
`discardVersion(` → `api.discardVersion(` · `issuesCsvUrl(` → `api.issuesCsvUrl(` ·
`downloadUrl(` → `api.downloadUrl(`

และลิงก์หน้าตั้งค่าที่ฝัง path ไว้:

```ts
          href={api.settingsHref(layer.id)}
```

- [ ] **Step 3: ตรวจ**

```bash
grep -n "from '@/lib/map-api'" src/components/admin/MapLayerCard.tsx
grep -c "api\." src/components/admin/MapLayerCard.tsx
npx tsc --noEmit
```

Expected: import เหลือบรรทัดเดียวและมีแต่ไทป์ · `tsc` ยังฟ้องที่หน้า `/admin/map/*` เท่านั้น
(Task 3 แก้) การ์ดเองต้องไม่มี error แล้ว

- [ ] **Step 4: commit**

```bash
git add src/components/admin/MapLayerCard.tsx
git commit -m "refactor(map): การ์ดเลเยอร์รับตัวเรียก API เป็น prop"
```

---

## Task 3: หน้าแผนที่ทั้งสามใช้ `MAP_API`

**Files:**
- Modify: `src/pages/admin/map/index.tsx`
- Modify: `src/pages/admin/map/[layerId].tsx`
- Modify: `src/pages/admin/map/viewer.tsx`

- [ ] **Step 1: แก้ทั้งสามหน้า**

เปลี่ยน import จาก `mapFetcher`/`patchMapLayer` เป็น `MAP_API` แล้วแทนที่ทุกจุด:

| เดิม | ใหม่ |
|---|---|
| `mapFetcher` | `MAP_API.fetcher` |
| `patchMapLayer(` | `MAP_API.patchLayer(` |
| `'/api/admin/map/layers'` | `MAP_API.layersKey` |
| `` `/api/admin/map/layers/${encodeURIComponent(layerId)}` `` | `MAP_API.layerKey(layerId)` |
| `` `/api/admin/map/layers/${encodeURIComponent(row.layer.id)}/geojson` `` | `MAP_API.adminGeojsonUrl(row.layer.id)` |
| `href="/admin/map"` | `href={MAP_API.indexHref}` |
| `href="/admin/map/viewer"` | `href={MAP_API.viewerHref}` |

ใน `index.tsx` ส่ง `api` ให้การ์ดด้วย:

```tsx
          <MapLayerCard key={row.layer.id} row={row} api={MAP_API} onChanged={() => void mutate()} />
```

**ห้ามแตะข้อความภาษาไทยบนหน้าจอ** — คำอธิบายเรื่องการลากไฟล์วาง ข้อความตอนโหลดไม่สำเร็จ
และคำแนะนำให้รัน `npm run import:map` ยังเป็นของหน้าแผนที่ตามเดิม

- [ ] **Step 2: ตรวจว่าไม่เหลือ path ฝังในหน้า**

```bash
grep -rn "'/api/admin/map\|\"/admin/map" src/pages/admin/map/ || echo "  ไม่เหลือ"
npx tsc --noEmit
npm run lint
npm test
```

Expected: ไม่เหลือ path ฝัง (ยกเว้นคอมเมนต์) · `tsc` สะอาดแล้วทั้งโปรเจกต์ · เทสต์ผ่าน

- [ ] **Step 3: ยิงหน้าจริง**

```bash
npm run dev &
until curl -sf -o /dev/null http://localhost:3000/api/map/layers; do sleep 1; done
curl -s -o /dev/null -w "หน้าแผนที่: %{http_code}\n" http://localhost:3000/admin/map
kill %1
```

Expected: `200` หรือ `307` (เด้งไปหน้าล็อกอิน) — ไม่ใช่ `500`

- [ ] **Step 4: commit**

```bash
git add src/pages/admin/map
git commit -m "refactor(map): หน้าแผนที่เรียก API ผ่าน MAP_API"
```

---

## Task 4: `forest-api.ts` และหน้ารายการ

**Files:**
- Create: `src/lib/forest-api.ts`
- Create: `src/pages/admin/forest/index.tsx`

- [ ] **Step 1: ผูกโรงงานกับป่าไม้**

```ts
// src/lib/forest-api.ts
import { createLayerApi } from '@/lib/layer-api';

// ตัวเรียก API ของคลังไฟล์ป่าไม้ — ตรรกะเดียวกับแผนที่ ต่างแค่ path ฐาน
export const FOREST_API = createLayerApi({
  apiBase: '/api/admin/forest',
  pageBase: '/admin/forest',
});
```

- [ ] **Step 2: หน้ารายการ**

```tsx
// src/pages/admin/forest/index.tsx
import Link from 'next/link';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import Icon from '@/components/Icon';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import MapLayerCard from '@/components/admin/MapLayerCard';
import { getFeatureSsrProps } from '@/lib/auth-server';
import { FOREST_API } from '@/lib/forest-api';
import type { AdminLayerRow } from '@/lib/map-api';

export const getServerSideProps = getFeatureSsrProps('forest');

function ForestLayersPage() {
  const { data, error, isLoading, mutate } = useSWR<{ layers: AdminLayerRow[] }>(
    FOREST_API.layersKey,
    FOREST_API.fetcher,
    { revalidateOnFocus: false }
  );

  return (
    <AdminLayout
      title="ข้อมูลป่าไม้"
      actions={
        <Link
          href={FOREST_API.viewerHref}
          className="flex items-center gap-1 rounded-lg border border-black/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition hover:bg-black/[0.04]"
        >
          <Icon name="map" size={16} />
          เปิดแผนที่
        </Link>
      }
    >
      <p className="mb-4 max-w-2xl text-[12.5px] leading-relaxed text-ink-soft">
        ลากไฟล์มาวางบนการ์ดของชั้นที่ต้องการแทนที่ ระบบจะตรวจไฟล์ให้ก่อนแล้วสรุปว่า
        อะไรเปลี่ยนไปบ้าง ไฟล์ใหม่จะยังไม่ขึ้นใช้งานจนกว่าจะกดเผยแพร่
      </p>

      {isLoading ? <p className="text-[13px] text-ink-mute">กำลังโหลด…</p> : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-display text-[13px] font-semibold text-red-800">
            โหลดรายการชั้นข้อมูลไม่สำเร็จ
          </p>
          <p className="mt-1 text-[12px] text-red-700">{(error as Error).message}</p>
        </div>
      ) : null}

      {data && data.layers.length === 0 ? (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4">
          <p className="font-display text-[13px] font-semibold text-amber-800">
            ยังไม่มีชั้นข้อมูลในคลัง
          </p>
          <p className="mt-1 text-[12px] leading-normal text-amber-800">
            รัน <code className="rounded bg-amber-100 px-1">npm run import:forest</code>{' '}
            เพื่อนำเข้าทั้งเจ็ดชั้นจาก forest-map.namphraesmartcity.ai เป็นครั้งแรก
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.layers.map((row) => (
          <MapLayerCard
            key={row.layer.id}
            row={row}
            api={FOREST_API}
            onChanged={() => void mutate()}
          />
        ))}
      </div>
    </AdminLayout>
  );
}

export default withMemberGuard(ForestLayersPage);
```

- [ ] **Step 3: ตรวจ**

```bash
npx tsc --noEmit
npm run lint
npm test
```

Expected: ผ่านทั้งหมด

- [ ] **Step 4: commit**

```bash
git add src/lib/forest-api.ts src/pages/admin/forest/index.tsx
git commit -m "feat(forest): หน้ารายการชั้นข้อมูลป่าไม้"
```

---

## Task 5: หน้าตั้งค่าชั้นข้อมูล

**Files:**
- Create: `src/pages/admin/forest/[layerId].tsx`

- [ ] **Step 1: คัดลอกจากหน้าแผนที่แล้วเปลี่ยนสี่จุด**

```bash
cp "src/pages/admin/map/[layerId].tsx" "src/pages/admin/forest/[layerId].tsx"
```

แล้วแก้ในไฟล์ใหม่:

1. `import { MAP_API } from '@/lib/map-api';` → `import { FOREST_API } from '@/lib/forest-api';`
2. `MAP_API.` ทุกจุด → `FOREST_API.`
3. `getFeatureSsrProps('map')` → `getFeatureSsrProps('forest')`
4. ชื่อฟังก์ชันคอมโพเนนต์ `LayerDetailPage` → `ForestLayerDetailPage` (สองที่ — ที่ประกาศ
   กับที่ส่งเข้า `withMemberGuard` บรรทัดสุดท้าย)

**ห้ามเปลี่ยนอย่างอื่น** — ข้อความภาษาไทยทุกคำ โครง JSX ทุกบรรทัด และตรรกะการยืนยัน
ฟิลด์ที่เข้าข่ายข้อมูลส่วนบุคคล ต้องเหมือนกันทุกตัวอักษร

- [ ] **Step 2: ตรวจว่าต่างกันเฉพาะสี่จุดนั้น**

```bash
diff "src/pages/admin/map/[layerId].tsx" "src/pages/admin/forest/[layerId].tsx"
```

Expected: เห็นเฉพาะบรรทัดที่เกี่ยวกับสี่ข้อข้างบน ถ้ามีบรรทัดอื่นโผล่มา แปลว่าแก้เกิน

```bash
npx tsc --noEmit && npm run lint && npm test
```

- [ ] **Step 3: commit**

```bash
git add "src/pages/admin/forest/[layerId].tsx"
git commit -m "feat(forest): หน้าตั้งค่าชั้นข้อมูลป่าไม้"
```

---

## Task 6: หน้าดูแผนที่

**Files:**
- Create: `src/pages/admin/forest/viewer.tsx`

- [ ] **Step 1: คัดลอกแล้วเปลี่ยนสี่จุดเดียวกัน**

```bash
cp src/pages/admin/map/viewer.tsx src/pages/admin/forest/viewer.tsx
```

แก้เหมือน Task 5: import, `MAP_API.` → `FOREST_API.`, `getFeatureSsrProps('forest')` และ
ชื่อคอมโพเนนต์ `AdminMapViewerPage` → `AdminForestViewerPage` (สองที่ — ที่ประกาศกับที่ส่งเข้า
`withMemberGuard`) ส่วนข้อความหัวข้อบนหน้า ถ้าเขียนว่า "แผนที่" เฉย ๆ ให้เป็น "แผนที่ป่าไม้"

- [ ] **Step 2: เพิ่มคำเตือนเรื่องร่าง**

หน้านี้ดึง GeoJSON ผ่าน `adminGeojsonUrl` ซึ่งเสิร์ฟเฉพาะเวอร์ชันที่**เผยแพร่แล้ว** ตอนนี้
ชั้นป่าไม้ทั้งเจ็ดยังเป็นร่างทั้งหมด หน้านี้จึงจะว่างจนกว่าจะมีคนกดเผยแพร่ ใส่คำอธิบายไว้
เหนือรายการเลเยอร์ เพื่อไม่ให้คนเปิดมาแล้วคิดว่าระบบพัง:

```tsx
      <p className="mb-3 text-[12px] leading-relaxed text-ink-mute">
        แผนที่นี้แสดงเฉพาะชั้นที่เผยแพร่แล้ว — ชั้นที่ยังเป็นร่างจะยังไม่ขึ้นที่นี่
        จนกว่าจะกดเผยแพร่ที่หน้ารายการ
      </p>
```

วางไว้ตรงไหนก็ได้ที่คนเห็นก่อนรายการเลเยอร์ ให้กลมกลืนกับโครงเดิมของหน้า

- [ ] **Step 3: ตรวจ**

```bash
npx tsc --noEmit && npm run lint && npm test
```

- [ ] **Step 4: commit**

```bash
git add src/pages/admin/forest/viewer.tsx
git commit -m "feat(forest): หน้าดูแผนที่ป่าไม้ฝั่งเจ้าหน้าที่"
```

---

## Task 7: เมนูในแถบข้าง

**Files:**
- Modify: `src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: เพิ่มรายการ**

ใน `NAV` ใส่ต่อจากบรรทัดของ `map`:

```ts
  { href: '/admin/forest', label: 'ข้อมูลป่าไม้', icon: 'forest', exact: false, feature: 'forest' },
```

- [ ] **Step 2: ยืนยันว่าไอคอนมีจริง**

```bash
grep -n "'forest'" src/lib/icons.ts
```

Expected: เจอ — ตรวจแล้วว่ามีอยู่ในรายการไอคอนที่อนุญาต **ไม่ต้องแก้ `icons.ts`** ถ้า
`grep` ไม่เจอ ให้หยุดแล้วรายงาน อย่าเดาชื่อไอคอนอื่นมาใส่

- [ ] **Step 3: ตรวจ**

```bash
npx tsc --noEmit && npm run lint && npm test
```

- [ ] **Step 4: ยิงหน้าจริงทั้งสองโดเมน**

```bash
npm run dev &
until curl -sf -o /dev/null http://localhost:3000/api/map/layers; do sleep 1; done
for p in /admin/map /admin/forest /admin/forest/viewer; do
  curl -s -o /dev/null -w "$p: %{http_code}\n" "http://localhost:3000$p"
done
kill %1
```

Expected: ทุกหน้าไม่ใช่ `500` (`200` หรือ `307` แล้วแต่สถานะล็อกอิน)

- [ ] **Step 5: commit**

```bash
git add src/components/admin/AdminLayout.tsx
git commit -m "feat(forest): เพิ่มเมนูข้อมูลป่าไม้ในแถบข้าง"
```

---

## Task 8: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: เพิ่มย่อหน้าต่อจากหัวข้อสิทธิ์ที่รอบ 1B เขียนไว้**

แทรกก่อนบรรทัด `> ⚠️ **เนื้อที่ของชั้น คทช. ยังไม่เปิดสาธารณะ**`:

```markdown
เจ้าหน้าที่จัดการข้อมูลป่าไม้เองได้ที่ **หลังบ้าน → ข้อมูลป่าไม้** (`/admin/forest`) โดย
ลากไฟล์มาวางบนการ์ดของชั้นที่ต้องการแทนที่ ระบบตรวจไฟล์ให้ก่อน สรุปว่าอะไรเปลี่ยนไป
แล้วไฟล์ใหม่จะยังไม่ขึ้นใช้งานจนกว่าจะกดเผยแพร่ — เหมือนหน้าไฟล์แผนที่ทุกประการ เพราะ
เป็นคอมโพเนนต์และตัวเรียก API ชุดเดียวกัน ต่างกันแค่ path ฐาน (`src/lib/layer-api.ts`)

> ตอนนี้ทั้งเจ็ดชั้นยังเป็นร่าง ยังไม่มีชั้นไหนถูกเผยแพร่ — `/api/forest/layers` จึงคืน
> รายการว่าง และหน้าดูแผนที่ฝั่งเจ้าหน้าที่ก็ยังไม่แสดงอะไร ตั้งใจให้เป็นแบบนั้น
> การเปิดข้อมูลสู่สาธารณะต้องเป็นการตัดสินใจของคน ไม่ใช่ผลข้างเคียงของการนำเข้า

```

- [ ] **Step 2: ตรวจ**

```bash
grep -n "/admin/forest\|layer-api" README.md
```

Expected: เจอทั้งสองอย่าง

- [ ] **Step 3: commit**

```bash
git add README.md
git commit -m "docs: บันทึกหน้าจัดการข้อมูลป่าไม้"
```

---

## เสร็จรอบ 1C แล้วได้อะไร

- `/admin/forest` ใช้งานได้ครบวงจร — ลากไฟล์วาง ตรวจ ดูส่วนต่าง ตั้งค่าฟิลด์สาธารณะ
  กดเผยแพร่ ทิ้งร่าง ดาวน์โหลดไฟล์เต็ม โหลด CSV ของแถวที่มีปัญหา
- คอมโพเนนต์การ์ดตัวเดียวรับใช้สองโดเมน — บั๊กที่แก้ฝั่งหนึ่งหายทั้งสองฝั่ง
- เมนูโผล่เฉพาะคนที่มีสิทธิ์ `forest`

**รอบ 1 จบทั้งหมดตรงนี้** — เหลือรอบ 2 (`/forest` สาธารณะ) รอบ 3 (สร้าง/ลบชั้นเอง)
และรอบ 4 (รูปฝาย)
