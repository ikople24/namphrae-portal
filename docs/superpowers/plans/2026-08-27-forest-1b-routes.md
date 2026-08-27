# แผนลงมือรอบ 1B — สิทธิ์ป่าไม้และชั้น API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปิด API ครบชุดของโดเมนป่าไม้ที่ `/api/admin/forest/**` และ `/api/forest/**`
พร้อมสิทธิ์ `forest` แยกของตัวเอง โดยไม่คัดลอกตรรกะจากฝั่งแผนที่แม้บรรทัดเดียว

**Architecture:** ดึงเนื้อในของ route ทั้ง 11 ตัวออกมาเป็นโรงงานใน `layer-routes.ts` ที่รับ
`LayerDomain` (สิทธิ์ + store + สองโฟลเดอร์ Cloudinary) แล้วทั้งสองโดเมนผูกเข้ากับมัน —
รูปแบบเดียวกับ `createLayerStore` ที่รอบ 1A ทำไว้ ไฟล์ route จริงเหลือ 3 บรรทัด

**Tech Stack:** TypeScript · Next.js Pages Router · MongoDB · Cloudinary · Vitest

**สเปก:** [2026-08-26-forest-data-page-design.md](../specs/2026-08-26-forest-data-page-design.md)
รอบนี้ครอบข้อ 4 (route) กับสิทธิ์ · หน้า `/admin/forest` อยู่รอบ 1C

---

## ทำไมแบ่ง 1B/1C

ฝั่งเซิร์ฟเวอร์กับฝั่งหน้าเว็บทดสอบแยกกันได้ชัด รอบนี้จบที่ "ยิง API ป่าไม้ได้ครบและ
สิทธิ์ทำงานถูก" ซึ่งพิสูจน์ด้วยเทสต์กับ `curl` ได้โดยไม่ต้องมีหน้าเว็บ ส่วนรอบ 1C
(`layer-api.ts`, การ์ด, หน้า `/admin/forest`, nav) ต่อยอดจากสิ่งที่รอบนี้เปิดไว้

---

## โครงไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/layer-domains.ts` | `LayerDomain` + `MAP_DOMAIN` + `FOREST_DOMAIN` |
| `src/lib/layer-routes.ts` | โรงงานตัวจัดการคำขอทั้ง 11 ตัว รับ `LayerDomain` |
| `src/lib/user-access.ts` | **แก้** — เพิ่ม `forest` เป็นคีย์ที่ 7 |
| `src/lib/cloudinary.ts` | **แก้** — `signRawUpload(folder)` รับโฟลเดอร์ |
| `src/lib/api-guard-coverage.test.ts` | **แก้** — รู้จักรูปแบบ route ที่มอบงานให้โรงงาน |
| `src/pages/api/admin/map/**` (9 ไฟล์) | **แก้** — เหลือบรรทัดเดียวผูกกับโรงงาน |
| `src/pages/api/map/**` (2 ไฟล์) | **แก้** — เช่นกัน |
| `src/pages/api/admin/forest/**` (9 ไฟล์) | ใหม่ — ผูกโรงงานเข้ากับ `FOREST_DOMAIN` |
| `src/pages/api/forest/**` (2 ไฟล์) | ใหม่ — เช่นกัน |

**เงื่อนไขที่ตรึงไว้ทั้งรอบ:** พฤติกรรมของ API ฝั่งแผนที่ต้องไม่เปลี่ยนแม้จุดเดียว —
สถานะ HTTP ทุกตัว ข้อความ error ภาษาไทยทุกข้อความ หัว `Cache-Control` ทุกอัน และลำดับ
การเขียนใน `publish` ต้องเหมือนเดิมเป๊ะ ถ้าต้องแก้เทสต์เดิมเพื่อให้ผ่าน แปลว่าทำผิด

---

## Task 1: สิทธิ์ `forest`

**Files:**
- Modify: `src/lib/user-access.ts`
- Modify: `src/lib/user-access.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ต่อท้าย `src/lib/user-access.test.ts`:

```ts
describe('สิทธิ์ forest', () => {
  it('อยู่ใน FEATURES แต่ไม่อยู่ในชุดเริ่มต้น — ผู้จัดการต้องติ๊กเปิดเอง', () => {
    expect(FEATURES).toContain('forest');
    expect(DEFAULT_FEATURES).not.toContain('forest');
  });

  it('สมาชิกเดิมที่ยังไม่เคยถูกตั้งค่า ไม่ได้สิทธิ์นี้ติดมาเงียบ ๆ', () => {
    const r = resolveAccess({ doc: null, clerkId: 'user_a', managerEnvId: undefined });
    expect(hasFeature({ features: r.features, isManager: false }, 'forest')).toBe(false);
  });

  it('ผู้จัดการเห็นทุกฟีเจอร์รวม forest', () => {
    const r = resolveAccess({ doc: null, clerkId: 'mgr', managerEnvId: 'mgr' });
    expect(hasFeature({ features: r.features, isManager: r.isManager }, 'forest')).toBe(true);
  });

  it('มีหน้าแรกและป้ายภาษาไทยครบเหมือนฟีเจอร์อื่น', () => {
    expect(FEATURE_HOME.forest).toBe('/admin/forest');
    expect(FEATURE_LABELS.map((f) => f.key)).toContain('forest');
  });
});
```

เพิ่ม `FEATURE_HOME`, `FEATURE_LABELS`, `hasFeature` เข้าบรรทัด import ที่มีอยู่แล้วบนสุดของไฟล์
(อย่าเพิ่ม import statement ใบที่สองจากโมดูลเดียวกัน)

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/user-access.test.ts`
Expected: FAIL — `expected [ 'links', … ] to contain 'forest'`

- [ ] **Step 3: เพิ่มคีย์**

ใน `src/lib/user-access.ts` แก้สามที่:

```ts
export const FEATURES = ['links', 'categories', 'calendar', 'map', 'forest', 'data', 'settings'] as const;
```

ใน `FEATURE_HOME` ใส่ต่อจากบรรทัด `map`:

```ts
  forest: '/admin/forest',
```

ใน `FEATURE_LABELS` ใส่ต่อจากบรรทัด `map`:

```ts
  { key: 'forest', label: 'ข้อมูลป่าไม้' },
```

**ห้ามแตะ `DEFAULT_FEATURES`** — สมาชิกเดิมทุกคนต้องไม่ได้สิทธิ์นี้ติดมาเอง ผู้จัดการ
ต้องเข้าไปติ๊กเปิดที่หน้าจัดการผู้ใช้อย่างตั้งใจ

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/user-access.test.ts`
Expected: PASS — 9 เดิม + 4 ใหม่ = 13

- [ ] **Step 5: ตรวจทั้งชุด**

```bash
npm test          # 344 → 348
npx tsc --noEmit
```

ถ้ามีเทสต์อื่นแดงเพราะจำนวนฟีเจอร์เปลี่ยน ให้รายงาน BLOCKED อย่าไปแก้เทสต์นั้น

- [ ] **Step 6: commit**

```bash
git add src/lib/user-access.ts src/lib/user-access.test.ts
git commit -m "feat(forest): เพิ่มสิทธิ์ forest แยกจากสิทธิ์แผนที่"
```

---

## Task 2: `signRawUpload` ต้องรับโฟลเดอร์

วันนี้ฟังก์ชันนี้ฝัง `MAP_FOLDER_FULL` ไว้ตายตัว ถ้าปล่อยไว้ ไฟล์ที่เจ้าหน้าที่ลากวางบน
หน้าป่าไม้จะวิ่งตรงจากเบราว์เซอร์ไปตกในโฟลเดอร์ของแผนที่ — ซ้ำรอยบั๊กที่รอบ 1A เจอว่า
`publicId` ของสองโดเมนชนกันจนไฟล์ที่เผยแพร่อยู่ถูกเขียนทับ

**Files:**
- Modify: `src/lib/cloudinary.ts`
- Modify: `src/pages/api/admin/map/upload-signature.ts`

- [ ] **Step 1: เปลี่ยนลายเซ็น**

ใน `src/lib/cloudinary.ts` แก้ `signRawUpload` ให้รับโฟลเดอร์ ไม่ใช่อ่านค่าคงที่เอง:

```ts
/**
 * ลายเซ็นให้เบราว์เซอร์อัปไฟล์ตรงเข้า Cloudinary — ข้ามเพดาน body 1MB ของ API route
 *
 * รับโฟลเดอร์เป็นพารามิเตอร์ ไม่ใช่ฝัง MAP_FOLDER_FULL ไว้ข้างใน — สองโดเมนมี
 * layerId ชนกันได้ (community-forest อยู่ทั้งสองฝั่ง) ถ้าโฟลเดอร์ไม่แยก ไฟล์ของโดเมน
 * หนึ่งจะเขียนทับอีกโดเมนหนึ่งเพราะ publicId คำนวณจาก layerId อย่างเดียว
 */
export function signRawUpload(folder: string): {
```

แล้วในเนื้อฟังก์ชันเปลี่ยน `folder: MAP_FOLDER_FULL` ทั้งสองที่ (ใน `params` และใน object
ที่ return) ให้เป็น `folder` เฉย ๆ ไม่ต้องแก้อย่างอื่น

- [ ] **Step 2: แก้ผู้เรียก**

ใน `src/pages/api/admin/map/upload-signature.ts` เพิ่ม `MAP_FOLDER_FULL` เข้า import ที่มีอยู่
จาก `@/lib/cloudinary` แล้วเปลี่ยนบรรทัดสุดท้ายเป็น:

```ts
  return res.status(200).json(signRawUpload(MAP_FOLDER_FULL));
```

- [ ] **Step 3: ตรวจว่าไม่มีผู้เรียกอื่นค้าง**

```bash
grep -rn "signRawUpload" src scripts
npx tsc --noEmit
npm test
```

Expected: เจอแค่ประกาศใน `cloudinary.ts` กับผู้เรียกใน `upload-signature.ts` · tsc และ
เทสต์ผ่านทั้งหมด

- [ ] **Step 4: commit**

```bash
git add src/lib/cloudinary.ts src/pages/api/admin/map/upload-signature.ts
git commit -m "refactor(map): signRawUpload รับโฟลเดอร์แทนการฝังค่าคงที่"
```

---

## Task 3: `layer-domains.ts`

**Files:**
- Create: `src/lib/layer-domains.ts`

- [ ] **Step 1: เขียนไฟล์**

```ts
// src/lib/layer-domains.ts
import {
  FOREST_FOLDER_FULL,
  FOREST_FOLDER_PUBLIC,
  MAP_FOLDER_FULL,
  MAP_FOLDER_PUBLIC,
} from '@/lib/cloudinary';
import * as forestStore from '@/lib/forest-store';
import type { LayerStore } from '@/lib/layer-store';
import * as mapStore from '@/lib/map-store';
import type { FeatureKey } from '@/lib/user-access';
import type { MapLayer } from '@/types/map';

// ของสี่อย่างที่ต่างกันระหว่างโดเมนแผนที่กับโดเมนป่าไม้ — ทุกอย่างที่เหลือใน
// เส้นทางของ API ใช้ร่วมกันได้หมด ตั้งแต่ด่านตรวจไปจนถึงการกรองฟิลด์ตอนเผยแพร่
//
// ตัว store ประกาศเป็น LayerStore<MapLayer> ไม่ใช่ LayerStore<ForestLayer> เพราะ
// ตัวจัดการคำขออ่านเฉพาะฟิลด์ที่ MapLayer มี ส่วน defaultOn/publishPhotos ของ
// ForestLayer เดินทางผ่านไปกับเอกสารโดยไม่มีใครในชั้นนี้ต้องรู้จักมัน
export type LayerDomain = {
  /** สิทธิ์ที่ต้องมีถึงจะเรียก route ฝั่งหลังบ้านของโดเมนนี้ได้ */
  feature: FeatureKey;
  store: LayerStore<MapLayer>;
  /** โฟลเดอร์ไฟล์เต็ม (authenticated) — ต้องไม่ซ้ำกับโดเมนอื่น */
  folderFull: string;
  /** โฟลเดอร์ไฟล์สาธารณะที่กรองฟิลด์แล้ว (upload) */
  folderPublic: string;
  /**
   * path ฐานของ API สาธารณะ — ใช้ประกอบ geojsonUrl ที่ส่งออกไปให้ระบบอื่น
   *
   * ต้องเป็นค่าคงที่ ไม่ใช่คำนวณจาก feature เพราะสองอย่างนี้ไม่ได้ผูกกันเสมอไป
   * และ URL ที่ส่งออกไปแล้วมีคนเอาไปฝังต่อ เปลี่ยนทีหลังไม่ได้
   */
  publicApiBase: string;
};

export const MAP_DOMAIN: LayerDomain = {
  feature: 'map',
  store: mapStore,
  folderFull: MAP_FOLDER_FULL,
  folderPublic: MAP_FOLDER_PUBLIC,
  publicApiBase: '/api/map',
};

export const FOREST_DOMAIN: LayerDomain = {
  feature: 'forest',
  store: forestStore,
  folderFull: FOREST_FOLDER_FULL,
  folderPublic: FOREST_FOLDER_PUBLIC,
  publicApiBase: '/api/forest',
};
```

> `import * as mapStore` ใช้ได้เพราะ `map-store.ts` export ชื่อทั้งสิบเอ็ดตรงกับ
> `LayerStore` พอดี ถ้า tsc บ่นว่ารูปร่างไม่ตรง แปลว่ามีเมธอดไหนหายหรือเกิน — ให้
> รายงาน BLOCKED อย่าเติม `as unknown as` เพื่อกลบ

- [ ] **Step 2: ตรวจไทป์**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 3: commit**

```bash
git add src/lib/layer-domains.ts
git commit -m "feat(forest): นิยาม LayerDomain ของสองโดเมน"
```

---

## Task 4: `layer-routes.ts` — สามตัวแรก (เลเยอร์)

**Files:**
- Create: `src/lib/layer-routes.ts`

ย้ายเนื้อในของสาม route นี้มาเป็นโรงงาน **โดยไม่แก้ตรรกะแม้บรรทัดเดียว**:

| route เดิม | ชื่อโรงงาน |
|---|---|
| `src/pages/api/admin/map/layers/index.ts` | `makeAdminLayersHandler` |
| `src/pages/api/admin/map/layers/[id]/index.ts` | `makeAdminLayerHandler` |
| `src/pages/api/admin/map/layers/[id]/geojson.ts` | `makeAdminLayerGeojsonHandler` |

- [ ] **Step 1: สร้างไฟล์พร้อมหัวและตัวแรก**

```ts
// src/lib/layer-routes.ts
import type { NextApiHandler } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { isCloudinaryConfigured, signedRawUrl } from '@/lib/cloudinary';
import type { LayerDomain } from '@/lib/layer-domains';
import { layerPatchSchema } from '@/lib/schema';
import type { MapLayer, MapLayerVersion } from '@/types/map';

// ตัวจัดการคำขอของคลังไฟล์ภูมิสารสนเทศ — โดเมนแผนที่กับโดเมนป่าไม้ใช้ชุดเดียวกัน
//
// เหตุผลที่ไม่คัดลอก route ไปวางอีกชุด: วันที่แก้บั๊กในด่านตรวจหรือในลำดับการเผยแพร่
// อีกโดเมนจะไม่ได้รับการแก้นั้นและไม่มีใครรู้จนกว่าจะมีคนบ่น — เหตุผลเดียวกับที่
// layer-store.ts มีอยู่
//
// **ทุกตัวที่ขึ้นต้นด้วย makeAdmin* เรียก requireFeature(domain.feature) เป็นบรรทัดแรก
// เสมอ** ข้อกำหนดนี้ถูกตรึงด้วย layer-routes.test.ts และเป็นสิ่งที่ทำให้ไฟล์ route
// บาง ๆ ผ่าน api-guard-coverage.test.ts ได้ทั้งที่ไม่มีสตริง requireFeature อยู่ในไฟล์

export type AdminLayerRow = {
  layer: MapLayer;
  published: MapLayerVersion | null;
  draft: MapLayerVersion | null;
  versionCount: number;
};

/** ทุกเลเยอร์พร้อมเวอร์ชันที่เผยแพร่อยู่และร่างที่ค้าง — การ์ดหน้าหลังบ้านใช้ก้อนเดียวนี้ */
export function makeAdminLayersHandler(domain: LayerDomain): NextApiHandler {
  return async (req, res) => {
    const admin = await requireFeature(req, res, domain.feature);
    if (!admin) return;

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const layers = await domain.store.listLayers();
    const rows: AdminLayerRow[] = await Promise.all(
      layers.map(async (layer) => {
        const versions = await domain.store.listVersions(layer.id);
        return {
          layer,
          published: versions.find((v) => v.status === 'published') ?? null,
          // ร่างล่าสุดเท่านั้น — listVersions เรียงใหม่สุดขึ้นก่อนอยู่แล้ว
          draft: versions.find((v) => v.status === 'draft') ?? null,
          versionCount: versions.filter((v) => v.status !== 'discarded').length,
        };
      })
    );

    return res.status(200).json({ layers: rows });
  };
}
```

- [ ] **Step 2: ย้ายตัวที่สองและสาม**

ต่อท้ายไฟล์เดียวกัน คัดลอกเนื้อในของ `layers/[id]/index.ts` และ `layers/[id]/geojson.ts`
มาทั้งดุ้นพร้อมคอมเมนต์ภาษาไทยทุกบรรทัด แล้วเปลี่ยนเฉพาะสามอย่างนี้:

1. `requireFeature(req, res, 'map')` → `requireFeature(req, res, domain.feature)`
2. ชื่อฟังก์ชัน store ทุกตัว (`getLayer`, `listVersions`, `patchLayer`, `getPublishedVersion`)
   → `domain.store.<ชื่อเดิม>`
3. ห่อด้วย `export function makeAdminLayerHandler(domain: LayerDomain): NextApiHandler {
   return async (req, res) => { … }; }` และ `makeAdminLayerGeojsonHandler` ตามลำดับ

`const TTL_SECONDS = 600;` ของ geojson ย้ายมาไว้ระดับโมดูลของ `layer-routes.ts`

**ห้ามเปลี่ยนข้อความ error ภาษาไทย สถานะ HTTP หรือหัว `Cache-Control` แม้ตัวอักษรเดียว**

- [ ] **Step 3: ตรวจไทป์**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error (ยังไม่มีใครเรียกโรงงานพวกนี้ — ปกติ)

- [ ] **Step 4: commit**

```bash
git add src/lib/layer-routes.ts
git commit -m "refactor(map): ดึงตัวจัดการคำขอของเลเยอร์ออกเป็นโรงงาน"
```

---

## Task 5: `layer-routes.ts` — การอัปไฟล์

`src/pages/api/admin/map/layers/[id]/versions.ts` เป็นตัวยาวสุด (130 บรรทัด) และเป็นตัวที่
ตรรกะซับซ้อนสุด — ทำแยก task เพื่อให้รีวิวได้ทีละเรื่อง

**Files:**
- Modify: `src/lib/layer-routes.ts`

- [ ] **Step 1: อ่านไฟล์ต้นทางให้จบก่อน**

```bash
cat -n src/pages/api/admin/map/layers/\[id\]/versions.ts
```

สังเกตว่ามันลบไฟล์บน Cloudinary ทิ้งทันทีเมื่อไฟล์ไม่ผ่านด่าน error — ตรรกะนี้ต้องอยู่ครบ

- [ ] **Step 2: ย้ายมาเป็น `makeAdminVersionsHandler`**

คัดลอกเนื้อในมาทั้งดุ้นพร้อมคอมเมนต์ทุกบรรทัด แล้วเปลี่ยนเฉพาะ:

1. `requireFeature(req, res, 'map')` → `requireFeature(req, res, domain.feature)`
2. ฟังก์ชัน store ทุกตัว → `domain.store.<ชื่อเดิม>`
3. ห่อด้วย `export function makeAdminVersionsHandler(domain: LayerDomain): NextApiHandler`

เพิ่ม import ที่ต้องใช้เข้าไปในบรรทัด import ที่มีอยู่แล้วของ `layer-routes.ts`
(`destroyRawAsset`, `fetchRawAsset` จาก cloudinary · `ingestMapFile` · `buildNewVersion`,
`nextVersionNo` จาก `@/lib/layer-store` **ไม่ใช่จาก map-store** · `versionRegisterSchema`)

> `buildNewVersion` กับ `nextVersionNo` ต้อง import จาก `@/lib/layer-store` — ที่
> `map-store.ts` re-export ให้ด้วยเป็นข้อยกเว้นรองรับผู้เรียกเดิม ไม่ใช่แบบอย่างของโค้ดใหม่

- [ ] **Step 3: ตรวจไทป์**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 4: commit**

```bash
git add src/lib/layer-routes.ts
git commit -m "refactor(map): ดึงตัวจัดการคำขออัปไฟล์ออกเป็นโรงงาน"
```

---

## Task 6: `layer-routes.ts` — เวอร์ชันสี่ตัวที่เหลือ

**Files:**
- Modify: `src/lib/layer-routes.ts`

| route เดิม | ชื่อโรงงาน |
|---|---|
| `versions/[vid]/index.ts` | `makeAdminVersionHandler` |
| `versions/[vid]/publish.ts` | `makeAdminPublishHandler` |
| `versions/[vid]/issues.ts` | `makeAdminIssuesHandler` |
| `versions/[vid]/download.ts` | `makeAdminDownloadHandler` |

- [ ] **Step 1: ย้ายทั้งสี่ตัว**

คัดลอกเนื้อในมาทั้งดุ้นพร้อมคอมเมนต์ แล้วเปลี่ยนเฉพาะสี่อย่าง:

1. `requireFeature(req, res, 'map')` → `requireFeature(req, res, domain.feature)`
2. ฟังก์ชัน store → `domain.store.<ชื่อเดิม>`
3. **`MAP_FOLDER_PUBLIC` ใน `publish.ts` → `domain.folderPublic`** — จุดนี้สำคัญที่สุด
   ในทั้ง task ถ้าลืม ไฟล์สาธารณะของป่าไม้จะไปตกในโฟลเดอร์แผนที่แล้วเขียนทับของเดิม
   เพราะ `publicId` คำนวณจาก `layer.id` อย่างเดียวและ `community-forest` มีอยู่ทั้งสองโดเมน
4. ห่อด้วยโรงงานตามชื่อในตาราง

`buildPublishPatch` กับ `assetsToPrune` import จาก `@/lib/layer-store`

**ลำดับใน `publish` ห้ามสลับ** — อัปไฟล์สาธารณะให้เสร็จก่อนค่อยสลับสถานะใน DB คอมเมนต์
ที่อธิบายเรื่องนี้อยู่หัวฟังก์ชันเดิม ต้องย้ายมาด้วย

- [ ] **Step 2: ตรวจไทป์**

```bash
npx tsc --noEmit
grep -c "domain.folderPublic" src/lib/layer-routes.ts
```

Expected: ไม่มี error · `grep` ต้องได้ `1`

- [ ] **Step 3: commit**

```bash
git add src/lib/layer-routes.ts
git commit -m "refactor(map): ดึงตัวจัดการคำขอของเวอร์ชันออกเป็นโรงงาน"
```

---

## Task 7: `layer-routes.ts` — สาธารณะและลายเซ็นอัปไฟล์

**Files:**
- Modify: `src/lib/layer-routes.ts`

| route เดิม | ชื่อโรงงาน | หมายเหตุ |
|---|---|---|
| `api/map/layers/index.ts` | `makePublicLayersHandler` | ไม่มี guard — สาธารณะ |
| `api/map/layers/[id]/geojson.ts` | `makePublicLayerGeojsonHandler` | ไม่มี guard — สาธารณะ |
| `api/admin/map/upload-signature.ts` | `makeAdminUploadSignatureHandler` | มี guard |

- [ ] **Step 1: ย้ายทั้งสามตัว**

สองตัวแรกไม่เรียก `requireFeature` เลยตามเดิม — เป็น route สาธารณะ ไม่ต้องเพิ่มเข้าไป

`makePublicLayersHandler` มี `geojsonUrl` ที่ประกอบจาก path ตายตัว:

```ts
      geojsonUrl: `${base}/api/map/layers/${layer.id}/geojson`,
```

ต้องกลายเป็น path ของโดเมน โดยใช้ `publicApiBase` ที่ Task 3 ใส่ไว้ใน `LayerDomain` แล้ว:

```ts
      geojsonUrl: `${base}${domain.publicApiBase}/layers/${layer.id}/geojson`,
```

`makeAdminUploadSignatureHandler` ต้องส่งโฟลเดอร์ของโดเมน:

```ts
    return res.status(200).json(signRawUpload(domain.folderFull));
```

- [ ] **Step 2: ตรวจไทป์**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 3: commit**

```bash
git add src/lib/layer-routes.ts
git commit -m "refactor(map): ดึง route สาธารณะและลายเซ็นอัปไฟล์ออกเป็นโรงงาน"
```

---

## Task 8: เทสต์ตรึงว่าโรงงานฝั่งหลังบ้านมี guard ทุกตัว

นี่คือสิ่งที่ทำให้ไฟล์ route บาง ๆ ผ่าน `api-guard-coverage.test.ts` ได้อย่างสุจริต —
ข้อกำหนดย้ายจาก "ทุกไฟล์ต้องมีสตริง" เป็น "ทุกไฟล์ต้องมีสตริง **หรือ** มอบงานให้โมดูล
ที่พิสูจน์แล้วว่า guard ครบ"

**Files:**
- Create: `src/lib/layer-routes.test.ts`

- [ ] **Step 1: เขียนเทสต์**

```ts
// src/lib/layer-routes.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as routes from '@/lib/layer-routes';

// คู่กับ api-guard-coverage.test.ts — ที่นั่นตรวจว่าไฟล์ route มี guard หรือมอบงาน
// ให้โมดูลนี้ ส่วนที่นี่ตรวจว่าโมดูลนี้ guard จริงทุกตัว ถ้าขาดข้างใดข้างหนึ่ง
// ข้อกำหนดทั้งชุดจะกลายเป็นการอ้างวงกลมที่ไม่ได้พิสูจน์อะไรเลย
const SRC = readFileSync(join(process.cwd(), 'src', 'lib', 'layer-routes.ts'), 'utf8');

/** ตัวจัดการคำขอที่ตั้งใจให้เปิดสาธารณะ — ที่เหลือทั้งหมดต้องมี guard */
const PUBLIC_ON_PURPOSE = new Set([
  'makePublicLayersHandler',
  'makePublicLayerGeojsonHandler',
]);

const factories = Object.keys(routes).filter((k) => k.startsWith('make'));

describe('layer-routes: guard ครบทุกตัว', () => {
  it('มีโรงงานครบสิบเอ็ดตัว', () => {
    expect(factories).toHaveLength(11);
  });

  for (const name of factories) {
    if (PUBLIC_ON_PURPOSE.has(name)) continue;
    it(`${name} เรียก requireFeature(domain.feature)`, () => {
      // ตัดเอาเฉพาะเนื้อของฟังก์ชันนี้ — จากบรรทัดที่ประกาศ ไปจนถึงบรรทัดก่อน
      // ฟังก์ชันถัดไป (หรือท้ายไฟล์)
      const start = SRC.indexOf(`export function ${name}(`);
      expect(start, `หา ${name} ในไฟล์ไม่เจอ`).toBeGreaterThan(-1);
      const next = SRC.indexOf('\nexport function make', start + 1);
      const body = SRC.slice(start, next === -1 ? undefined : next);
      expect(body).toContain('requireFeature(req, res, domain.feature)');
    });
  }

  it('ตัวที่เปิดสาธารณะโดยตั้งใจ ไม่มี guard — และมีแค่สองตัวนั้น', () => {
    for (const name of PUBLIC_ON_PURPOSE) {
      expect(factories).toContain(name);
    }
    expect(PUBLIC_ON_PURPOSE.size).toBe(2);
  });
});
```

- [ ] **Step 2: รันให้ผ่าน**

Run: `npx vitest run src/lib/layer-routes.test.ts`
Expected: PASS — 11 เทสต์ (1 นับจำนวน + 9 guard + 1 สาธารณะ)

ถ้าตัวไหนแดง แปลว่าโรงงานตัวนั้นลืม guard จริง ๆ — แก้ที่โรงงาน อย่าแก้เทสต์

- [ ] **Step 3: commit**

```bash
git add src/lib/layer-routes.test.ts
git commit -m "test(map): ตรึงว่าโรงงาน route ฝั่งหลังบ้านเรียก guard ครบทุกตัว"
```

---

## Task 9: ผูก route ของแผนที่เข้ากับโรงงาน

**Files:**
- Modify: ทั้ง 11 ไฟล์ใต้ `src/pages/api/admin/map/**` และ `src/pages/api/map/**`
- Modify: `src/lib/api-guard-coverage.test.ts`

- [ ] **Step 1: เขียนไฟล์ route ใหม่ทั้ง 11 ไฟล์**

แต่ละไฟล์เหลือรูปแบบนี้ (ตัวอย่างคือ `src/pages/api/admin/map/layers/index.ts`):

```ts
import { MAP_DOMAIN } from '@/lib/layer-domains';
import { makeAdminLayersHandler } from '@/lib/layer-routes';

export default makeAdminLayersHandler(MAP_DOMAIN);
```

ทำแบบเดียวกันทั้ง 11 ไฟล์ จับคู่ชื่อโรงงานตามตารางใน Task 4, 5, 6, 7
สองไฟล์ใต้ `src/pages/api/map/**` ใช้ `makePublicLayersHandler` และ
`makePublicLayerGeojsonHandler`

> `AdminLayerRow` ที่เคย `export type` อยู่ใน `layers/index.ts` ย้ายไป `layer-routes.ts`
> แล้ว — ผู้เรียกฝั่งเบราว์เซอร์ import จาก `@/lib/map-api` ไม่ใช่จาก route จึงไม่กระทบ
> แต่ต้องตรวจด้วย `grep -rn "from '@/pages/api" src` ว่าไม่มีใคร import จาก route โดยตรง

- [ ] **Step 2: สอน `api-guard-coverage.test.ts` ให้รู้จักรูปแบบใหม่**

แก้เงื่อนไข `guarded` ใน `src/lib/api-guard-coverage.test.ts` ให้เป็น:

```ts
      const guarded =
        src.includes('requireFeature(') ||
        src.includes('requireManager(') ||
        // ไฟล์ที่มอบงานให้ layer-routes — ทุก export ของโมดูลนั้นที่ขึ้นต้นด้วย
        // makeAdmin* ถูกตรึงด้วย layer-routes.test.ts ว่าเรียก requireFeature เสมอ
        // ข้อกำหนดจึงยังครบ แค่ย้ายที่พิสูจน์ ไม่ได้ผ่อนลง
        src.includes("from '@/lib/layer-routes'") ||
        (BARE_REQUIRE_ADMIN_OK.has(rel) && src.includes('requireAdmin('));
```

แล้วแก้คอมเมนต์หัวไฟล์ให้ตรงกับความจริงใหม่:

```ts
// ทุกไฟล์ใต้ src/pages/api/admin ต้องเรียก guard สักตัว หรือมอบงานให้ layer-routes
// ซึ่ง layer-routes.test.ts ตรึงไว้ว่า guard ครบทุกตัว — requireAdmin เปล่า ๆ
// (สมาชิกทุกคนผ่าน) อนุญาตเฉพาะ allowlist ที่ตั้งใจไว้เท่านั้น route ใหม่ที่
// ลืมคิดเรื่องสิทธิ์จะตกเทสต์นี้ทันที
```

- [ ] **Step 3: ตรวจว่าพฤติกรรมไม่เปลี่ยน**

```bash
npx tsc --noEmit
npm test
npm run lint
```

Expected: ทุกอย่างผ่าน · `api-guard-coverage` ยังนับไฟล์เท่าเดิม

- [ ] **Step 4: ยิงจริงเทียบกับก่อนแก้**

```bash
npm run dev &
sleep 8
curl -s -o /dev/null -w "public layers: %{http_code}\n" http://localhost:3000/api/map/layers
curl -s http://localhost:3000/api/map/layers | head -c 400; echo
curl -s -o /dev/null -w "admin layers ไม่ล็อกอิน: %{http_code}\n" http://localhost:3000/api/admin/map/layers
kill %1
```

Expected: `public layers: 200` และคืนเลเยอร์สี่ตัวของแผนที่ · `admin layers ไม่ล็อกอิน`
ต้อง**ไม่ใช่ `200`** — ถ้าได้ `200` แปลว่า guard หลุด หยุดทันที

> ค่าที่ได้จริงคือ **404 ไม่ใช่ 401/403** เพราะ `src/proxy.ts` จับ `/api/admin(.*)` แล้วเรียก
> `auth.protect()` ของ Clerk ซึ่ง rewrite คำขอที่ยังไม่ล็อกอินไปหน้า 404 ตั้งแต่ก่อนถึง
> handler (ดูหัว `x-clerk-auth-reason: protect-rewrite`) เป็นพฤติกรรมเดิมของระบบ ไม่ใช่
> อาการผิดปกติ — `requireFeature` ในโรงงานเป็นด่านชั้นที่สองที่อยู่หลังจากนั้น

- [ ] **Step 5: commit**

```bash
git add src/pages/api/admin/map src/pages/api/map src/lib/api-guard-coverage.test.ts
git commit -m "refactor(map): route ของแผนที่ผูกกับโรงงานที่ใช้ร่วมกับป่าไม้"
```

---

## Task 10: route ของป่าไม้ 11 ไฟล์

**Files:**
- Create: `src/pages/api/admin/forest/layers/index.ts`
- Create: `src/pages/api/admin/forest/layers/[id]/index.ts`
- Create: `src/pages/api/admin/forest/layers/[id]/geojson.ts`
- Create: `src/pages/api/admin/forest/layers/[id]/versions.ts`
- Create: `src/pages/api/admin/forest/upload-signature.ts`
- Create: `src/pages/api/admin/forest/versions/[vid]/index.ts`
- Create: `src/pages/api/admin/forest/versions/[vid]/publish.ts`
- Create: `src/pages/api/admin/forest/versions/[vid]/issues.ts`
- Create: `src/pages/api/admin/forest/versions/[vid]/download.ts`
- Create: `src/pages/api/forest/layers/index.ts`
- Create: `src/pages/api/forest/layers/[id]/geojson.ts`

- [ ] **Step 1: สร้างทั้ง 11 ไฟล์**

โครงเหมือนฝั่งแผนที่ทุกประการ ต่างแค่ `FOREST_DOMAIN` เช่น
`src/pages/api/admin/forest/layers/index.ts`:

```ts
import { FOREST_DOMAIN } from '@/lib/layer-domains';
import { makeAdminLayersHandler } from '@/lib/layer-routes';

export default makeAdminLayersHandler(FOREST_DOMAIN);
```

- [ ] **Step 2: ตรวจ**

```bash
npx tsc --noEmit
npm test
```

Expected: ผ่านทั้งหมด · `api-guard-coverage` เพิ่มขึ้น 9 เทสต์ (ไฟล์ใหม่ใต้ `api/admin`)
และผ่านทุกตัวเพราะทุกไฟล์ import จาก `@/lib/layer-routes`

- [ ] **Step 3: ยิงจริง**

```bash
npm run dev &
sleep 8
echo "— สาธารณะ: ยังไม่มีชั้นไหนเผยแพร่ ต้องได้ layers ว่าง —"
curl -s http://localhost:3000/api/forest/layers; echo
echo "— หลังบ้านโดยไม่ล็อกอิน ต้องไม่ใช่ 200 —"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/forest/layers
echo "— แผนที่ต้องยังทำงานเหมือนเดิม —"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/map/layers
kill %1
```

Expected: `/api/forest/layers` คืน `{"layers":[]}` เพราะทั้งเจ็ดชั้นยังเป็นร่าง ไม่มีตัวไหน
เผยแพร่ — **นี่คือคำตอบที่ถูก ไม่ใช่ความผิดพลาด** · หลังบ้านต้องไม่ใช่ 200 (ได้ 404 จาก
Clerk proxy ตามที่อธิบายไว้ใน Task 9) · แผนที่ 200

- [ ] **Step 4: commit**

```bash
git add src/pages/api/admin/forest src/pages/api/forest
git commit -m "feat(forest): เปิด API ของโดเมนป่าไม้ครบสิบเอ็ด route"
```

---

## Task 11: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: เพิ่มหัวข้อสิทธิ์และ API ต่อจากตารางชั้นข้อมูลป่าไม้**

แทรกก่อนบรรทัด `> ⚠️ **เนื้อที่ของชั้น คทช. ยังไม่เปิดสาธารณะ**`:

```markdown
**สิทธิ์แยกจากแผนที่** — เจ้าหน้าที่ที่ดูแลข้อมูลป่าไม้เปิดสิทธิ์ `ข้อมูลป่าไม้` ได้
โดยไม่ต้องให้สิทธิ์ไฟล์แผนที่ทั้งก้อนไปด้วย สิทธิ์นี้ไม่อยู่ในชุดเริ่มต้น ผู้จัดการต้อง
เข้าไปติ๊กเปิดเองที่หน้าจัดการผู้ใช้

**API มีครบชุดเดียวกับแผนที่** ที่ `/api/admin/forest/**` และ `/api/forest/**` — ตัว
จัดการคำขอเป็นชุดเดียวกันจริง ๆ ไม่ใช่โค้ดที่คัดลอกไปวาง (ดู `src/lib/layer-routes.ts`)
บั๊กที่แก้ฝั่งหนึ่งจึงหายไปพร้อมกันทั้งสองฝั่งเสมอ

```

- [ ] **Step 2: ตรวจ**

```bash
grep -n "layer-routes\|/api/forest" README.md
```

Expected: เจอทั้งสองอย่าง

- [ ] **Step 3: commit**

```bash
git add README.md
git commit -m "docs: บันทึกสิทธิ์ forest และ API ของโดเมนป่าไม้"
```

---

## เสร็จรอบ 1B แล้วได้อะไร

- `/api/forest/layers` และ `/api/admin/forest/**` ใช้งานได้ครบ 11 route
- สิทธิ์ `forest` แยกของตัวเอง ไม่อยู่ในชุดเริ่มต้น
- ตัวจัดการคำขอชุดเดียวรับใช้สองโดเมน — บั๊กที่แก้ฝั่งหนึ่งหายทั้งสองฝั่ง
- `api-guard-coverage.test.ts` ยังคุ้มครองครบ โดยย้ายที่พิสูจน์ไปอยู่ที่
  `layer-routes.test.ts` แทนที่จะผ่อนข้อกำหนดลง

**ยังทำไม่ได้จนกว่าจะถึงรอบ 1C:** เปิดหน้า `/admin/forest` ดูการ์ด · ลากไฟล์วาง ·
กดเผยแพร่ · ตั้งค่าฟิลด์สาธารณะ — ทุกอย่างที่ต้องมีหน้าเว็บ
