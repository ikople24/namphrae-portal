# คลังไฟล์แผนที่ (Map Layer Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้เจ้าหน้าที่อัปโหลดไฟล์แผนที่แทนที่เลเยอร์เดิมได้เองจากหลังบ้าน ผ่านด่านตรวจ ดูส่วนต่าง แล้วกดเผยแพร่ พร้อมเปิด API สาธารณะที่กรองข้อมูลส่วนบุคคลออกแล้ว

**Architecture:** logic บริสุทธิ์ทั้งหมด (แกะไฟล์ · นับสถิติ · ด่านตรวจ · เทียบเวอร์ชัน · กรอง PII) อยู่ใน `src/lib/map-*.ts` ที่ไม่มี I/O เลยและมีเทสต์ครบ ส่วน I/O แยกไปอยู่ที่ store (MongoDB) กับ Cloudinary (ไฟล์ GeoJSON สองสำเนาต่อเวอร์ชัน: เต็มแบบ authenticated และสาธารณะที่กรองแล้วบน CDN) API สาธารณะเป็น 302 redirect ไป CDN ไม่มีไบต์ไหนวิ่งผ่านเซิร์ฟเวอร์

**Tech Stack:** Next.js 16 Pages Router · TypeScript strict · MongoDB · Cloudinary raw · Zod · SWR · Tailwind 4 · vitest · `shpjs` (เบราว์เซอร์เท่านั้น)

**Spec:** `docs/superpowers/specs/2026-08-06-map-layer-management-design.md`

**Branch:** `feat/map-layers`

---

## File Structure

| ไฟล์ | รับผิดชอบอะไร |
|---|---|
| `src/types/map.ts` | โดเมนไทป์ + ค่าคงที่ ไม่มี logic |
| `src/lib/map-parse.ts` | ข้อความ → FeatureCollection (`.js` qgis2web / `.geojson`) ไม่มี dependency |
| `src/lib/map-stats.ts` | FeatureCollection → `MapStats` (นับ feature, bbox, สถิติรายฟิลด์) |
| `src/lib/map-checks.ts` | `MapStats` + ก้อนข้อมูล → `MapCheck[]` |
| `src/lib/map-diff.ts` | สอง FeatureCollection → `MapDiff` |
| `src/lib/map-public.ts` | กรอง `properties` ตาม whitelist |
| `src/lib/map-store.ts` | ฟังก์ชันบริสุทธิ์ประกอบเอกสาร + I/O Mongo/ไฟล์ |
| `src/lib/map-shapefile-client.ts` | `.zip` → GeoJSON ด้วย `shpjs` — **เบราว์เซอร์เท่านั้น** |
| `src/lib/cloudinary.ts` *(แก้)* | เพิ่ม raw upload · signed URL · destroy |
| `src/lib/schema.ts` *(แก้)* | Zod ของ payload ใหม่ |
| `src/pages/api/map/**` | API สาธารณะ |
| `src/pages/api/admin/map/**` | API เจ้าหน้าที่ |
| `src/components/admin/MapLayerCard.tsx` | การ์ดเลเยอร์ + drop zone + แผงสรุป |
| `src/components/admin/PublicFieldPicker.tsx` | ตัวเลือกฟิลด์สาธารณะ |
| `src/pages/admin/map/**` | หน้าหลังบ้าน |
| `scripts/import-map-layers.ts` | นำเข้าครั้งแรกจาก namphraesmartcity.ai |

**เหตุผลที่แยก `map-stats` ออกจาก `map-checks`:** สถิติถูกเก็บลงเอกสารเวอร์ชันและถูกอ่านซ้ำโดยด่านตรวจรอบถัดไป (`new-value`, `field-removed`, `count-jump` เทียบกับสถิติของเวอร์ชันก่อน ไม่ใช่กับตัวไฟล์) ถ้ารวมสองอย่างไว้ที่เดียว ด่านตรวจจะต้องดึงไฟล์เก่ามาทั้งก้อนทุกครั้ง

---

## Task 1: โดเมนไทป์

**Files:**
- Create: `src/types/map.ts`

- [ ] **Step 1: เขียนไฟล์ไทป์**

```ts
// โดเมนคลังไฟล์แผนที่ — แยกจาก portal.ts เพราะคนละโดเมนกันสิ้นเชิง
//
// GeoJSON ไทป์ประกาศเองแทนการลง @types/geojson: เราใช้แค่สามชนิดนี้และต้องการ
// ให้ properties เป็น Record<string, unknown> ตรง ๆ (ไม่ใช่ GeoJsonProperties ที่
// เป็น any) เพื่อให้ tsc จับการอ่านฟิลด์แบบไม่ตรวจชนิดได้

export type Geometry = { type: string; coordinates: unknown };

export type Feature = {
  type: 'Feature';
  geometry: Geometry | null;
  properties: Record<string, unknown> | null;
};

export type FeatureCollection = {
  type: 'FeatureCollection';
  features: Feature[];
  name?: string;
  crs?: unknown;
};

export const GEOMETRY_KINDS = [
  'Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon',
] as const;
export type GeometryKind = (typeof GEOMETRY_KINDS)[number];

export const VERSION_STATUSES = ['draft', 'published', 'superseded', 'discarded'] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export const SOURCE_FORMATS = ['geojson', 'qgis2web-js', 'shapefile-zip'] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];

// รหัสด่านตรวจทั้งหมด — แหล่งความจริงเดียว ใช้เป็น union ของ MapCheck.code
export const CHECK_CODES = [
  'parse-failed', 'empty', 'bad-geometry', 'outside-thailand', 'geometry-type-mismatch',
  'duplicate-key', 'key-composition', 'null-literal', 'new-value',
  'count-jump', 'field-removed', 'mojibake', 'identical', 'new-public-candidate',
] as const;
export type CheckCode = (typeof CHECK_CODES)[number];

export type MapCheck = {
  code: CheckCode;
  level: 'error' | 'warning';
  message: string;
  count: number;
  sample: string[];      // ตัวอย่างไม่เกิน 5 ค่า สำหรับแสดงบนการ์ด
};

// `values` มีเฉพาะฟิลด์ประเภทหมวดหมู่ (distinct <= CATEGORICAL_MAX) — ด่าน
// new-value ของเวอร์ชันถัดไปเทียบกับอาเรย์นี้ จึงไม่ต้องดึงไฟล์เก่ามาทั้งก้อน
export type FieldStat = {
  name: string;
  filled: number;
  distinct: number;
  values?: string[];
};

export const CATEGORICAL_MAX = 50;

export type MapStats = {
  featureCount: number;
  geometryTypes: string[];
  bbox: [number, number, number, number];   // [minLon, minLat, maxLon, maxLat]
  fields: FieldStat[];
};

export type MapDiff = {
  comparedToVersionNo: number;
  added: number;
  removed: number;
  changed: number;
  fieldsAdded: string[];
  fieldsRemoved: string[];
};

export type MapAsset = { publicId: string; bytes: number };
export type MapPublicAsset = MapAsset & { url: string };

export type MapLayer = {
  id: string;
  title: string;
  description?: string;
  geometryType: GeometryKind;
  keyFields: string[];
  keyComposition: string[][];   // ตั้งได้เมื่อ keyFields.length === 1 เท่านั้น
  visibility: 'public' | 'staff';
  publicFields: string[];       // [] = เปิดแค่รูปทรง ไม่เปิด properties เลย
  currentVersionNo: number | null;
  order: number;
  updatedAt: string;
  updatedBy: string;
};

export type MapLayerVersion = {
  id: string;
  layerId: string;
  versionNo: number;
  status: VersionStatus;
  source: { format: SourceFormat; fileName: string; bytes: number; sha256: string };
  fullAsset: MapAsset;
  publicAsset: MapPublicAsset | null;
  stats: MapStats;
  checks: MapCheck[];
  diff: MapDiff | null;
  uploadedAt: string;
  uploadedBy: string;
  publishedAt?: string;
  publishedBy?: string;
  note?: string;
};

// ขอบเขตประเทศไทยแบบหลวม ๆ — ใช้ดักพิกัดที่ลืมแปลงจาก UTM (ค่าจะเป็นหลักแสน)
// ไม่ได้ใช้ตรวจว่าอยู่ในเขตเทศบาลจริงหรือไม่
export const THAILAND_BBOX: [number, number, number, number] = [97.3, 5.6, 105.7, 20.5];

export const LAYER_VERSIONS_KEPT = 5;
```

- [ ] **Step 2: ตรวจว่า tsc ผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add src/types/map.ts
git commit -m "feat(map): โดเมนไทป์ของคลังไฟล์แผนที่"
```

---

## Task 2: แกะไฟล์ → FeatureCollection

**Files:**
- Create: `src/lib/map-parse.ts`
- Test: `src/lib/map-parse.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
import { describe, expect, it } from 'vitest';
import { parseMapFile } from '@/lib/map-parse';

const FC = '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[98.8,18.7]},"properties":{"a":1}}]}';

describe('parseMapFile', () => {
  it('อ่าน .geojson ตรง ๆ ได้', () => {
    const r = parseMapFile(FC, 'zone.geojson');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.format).toBe('geojson');
      expect(r.fc.features).toHaveLength(1);
    }
  });

  it('แกะหัว var ของ qgis2web ออก', () => {
    const r = parseMapFile(`var json_Parcel_3 = ${FC};`, 'Parcel_3.js');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.format).toBe('qgis2web-js');
      expect(r.fc.features).toHaveLength(1);
    }
  });

  it('แกะหัวที่มีช่องว่าง/ไม่มีอัฒภาคปิดได้', () => {
    // qgis2web แต่ละรุ่นเว้นวรรคไม่เหมือนกัน และไฟล์จริงบางไฟล์ไม่มี ; ปิดท้าย
    const r = parseMapFile(`var   json_x=${FC}`, 'x.js');
    expect(r.ok).toBe(true);
  });

  it('.js ที่ไม่มีหัว var ถือว่าอ่านไม่ออก', () => {
    const r = parseMapFile(FC, 'x.js');
    expect(r.ok).toBe(false);
  });

  it('JSON พังคืน ok:false ไม่ throw', () => {
    const r = parseMapFile('{"type":', 'x.geojson');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('อ่านไฟล์ไม่ออก');
  });

  it('ปฏิเสธเมื่อไม่ใช่ FeatureCollection', () => {
    const r = parseMapFile('{"type":"Feature","geometry":null,"properties":{}}', 'x.geojson');
    expect(r.ok).toBe(false);
  });

  it('ปฏิเสธ crs ที่ไม่ใช่ CRS84/EPSG:4326 แทนที่จะแปลงให้เงียบ ๆ', () => {
    const utm = '{"type":"FeatureCollection","crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:EPSG::32647"}},"features":[]}';
    const r = parseMapFile(utm, 'x.geojson');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('EPSG:4326');
  });

  it('ยอมรับ crs CRS84 ที่ qgis2web ใส่มา', () => {
    const ok = '{"type":"FeatureCollection","crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3:CRS84"}},"features":[]}';
    expect(parseMapFile(ok, 'x.geojson').ok).toBe(true);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/map-parse.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/map-parse"`

- [ ] **Step 3: เขียน implementation**

```ts
import type { FeatureCollection, SourceFormat } from '@/types/map';

// แกะข้อความไฟล์เป็น FeatureCollection — ไม่มี dependency และไม่มี I/O
//
// รองรับสองทางเข้าเท่านั้น: .geojson/.json ตรง ๆ กับไฟล์ qgis2web (.js) ที่ห่อ
// GeoJSON ไว้ด้วย `var json_ชื่อเลเยอร์ = {...}` ส่วน shapefile (.zip) ถูกแปลงที่
// เบราว์เซอร์ก่อนอัปขึ้นมา (ดูสเปกหัวข้อ "ทำไมแปลง shapefile ที่เบราว์เซอร์") —
// ห้ามเพิ่ม dependency อ่าน shapefile ที่ไฟล์นี้ มันจะถูก require() บน Node แล้วพัง

export type ParseResult =
  | { ok: true; fc: FeatureCollection; format: SourceFormat }
  | { ok: false; message: string };

// `var json_x = ` โดยจำนวนช่องว่างไม่แน่นอนตามรุ่นของ qgis2web
const QGIS2WEB_HEAD = /^\s*var\s+json_[A-Za-z0-9_]+\s*=\s*/;

// ชื่อ CRS ที่แปลว่า lon/lat องศาบน WGS84 — ตัวอื่นทั้งหมดปฏิเสธ ไม่แปลงให้เอง
// เพราะการเดา CRS ผิดทำให้ข้อมูลไปโผล่ผิดที่โดยไม่มีอะไรเตือน
const CRS84 = new Set([
  'urn:ogc:def:crs:ogc:1.3:crs84',
  'urn:ogc:def:crs:epsg::4326',
  'epsg:4326',
]);

export function parseMapFile(text: string, fileName: string): ParseResult {
  const isJs = fileName.toLowerCase().endsWith('.js');
  let body = text;
  let format: SourceFormat = 'geojson';

  if (isJs) {
    if (!QGIS2WEB_HEAD.test(text)) {
      return { ok: false, message: 'อ่านไฟล์ไม่ออก: ไฟล์ .js ต้องขึ้นต้นด้วย var json_… = ตามรูปแบบของ qgis2web' };
    }
    format = 'qgis2web-js';
    // ตัดหัวออก แล้วตัดอัฒภาค/ช่องว่างท้ายไฟล์ทิ้ง (บางไฟล์ไม่มี ; ปิด)
    body = text.replace(QGIS2WEB_HEAD, '').trim().replace(/;+\s*$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    return { ok: false, message: `อ่านไฟล์ไม่ออก: ${(err as Error).message}` };
  }

  const fc = parsed as FeatureCollection;
  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    return { ok: false, message: 'อ่านไฟล์ไม่ออก: เนื้อไฟล์ไม่ใช่ FeatureCollection' };
  }

  const crsName = readCrsName(fc.crs);
  if (crsName && !CRS84.has(crsName.toLowerCase())) {
    return {
      ok: false,
      message: `ไฟล์ระบุระบบพิกัดเป็น ${crsName} — ต้อง export เป็น EPSG:4326 (WGS 84 lon/lat) ก่อน ระบบไม่แปลงพิกัดให้เอง`,
    };
  }

  return { ok: true, fc, format };
}

function readCrsName(crs: unknown): string | null {
  if (!crs || typeof crs !== 'object') return null;
  const props = (crs as { properties?: { name?: unknown } }).properties;
  return typeof props?.name === 'string' ? props.name : null;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/map-parse.test.ts`
Expected: PASS ทั้ง 8 เทสต์

- [ ] **Step 5: ยืนยันกับไฟล์จริงจากเว็บต้นทาง**

Run:
```bash
curl -s https://namphraesmartcity.ai/map/data/ZoneMoobang_2.js -o /tmp/zone.js && \
npx tsx -e "
import { readFileSync } from 'fs';
import { parseMapFile } from './src/lib/map-parse';
const r = parseMapFile(readFileSync('/tmp/zone.js','utf8'), 'ZoneMoobang_2.js');
console.log(r.ok ? \`OK format=\${r.format} features=\${r.fc.features.length}\` : 'FAIL ' + r.message);
"
```
Expected: `OK format=qgis2web-js features=11`

- [ ] **Step 6: Commit**

```bash
git add src/lib/map-parse.ts src/lib/map-parse.test.ts
git commit -m "feat(map): แกะไฟล์ qgis2web .js และ .geojson เป็น FeatureCollection"
```

---

## Task 3: กรองข้อมูลส่วนบุคคล

**Files:**
- Create: `src/lib/map-public.ts`
- Test: `src/lib/map-public.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
import { describe, expect, it } from 'vitest';
import { toPublicFeatureCollection } from '@/lib/map-public';
import type { FeatureCollection } from '@/types/map';

const fc: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [98.8, 18.7] },
      properties: { parcel_cod: '04B066', rai: '1', own_Hse_no: '177', Id_Chanod: '76007' },
    },
  ],
};

describe('toPublicFeatureCollection', () => {
  it('เก็บเฉพาะฟิลด์ใน whitelist', () => {
    const out = toPublicFeatureCollection(fc, ['parcel_cod', 'rai']);
    expect(out.features[0].properties).toEqual({ parcel_cod: '04B066', rai: '1' });
  });

  it('ฟิลด์ที่ไม่อยู่ใน whitelist ต้องหายไปทั้งหมด', () => {
    const out = toPublicFeatureCollection(fc, ['parcel_cod']);
    const json = JSON.stringify(out);
    expect(json).not.toContain('own_Hse_no');
    expect(json).not.toContain('177');
    expect(json).not.toContain('76007');
  });

  it('whitelist ว่าง = properties ว่าง ไม่ใช่เปิดหมด', () => {
    const out = toPublicFeatureCollection(fc, []);
    expect(out.features[0].properties).toEqual({});
  });

  it('geometry ไม่ถูกแตะ', () => {
    const out = toPublicFeatureCollection(fc, []);
    expect(out.features[0].geometry).toEqual({ type: 'Point', coordinates: [98.8, 18.7] });
  });

  // ข้อสอบสำคัญ: ฟิลด์ที่เพิ่งโผล่มาในไฟล์เวอร์ชันใหม่ต้องถูกกันไว้เอง ไม่ใช่หลุด
  // ออกไปเอง — เหตุผลเดียวกับ PUBLIC_JOB_FIELDS ใน src/types/portal.ts
  it('ฟิลด์ใหม่ที่ไม่เคยประกาศต้องไม่หลุดออกไปเอง', () => {
    const withNew: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [98.8, 18.7] },
          properties: { parcel_cod: '04B066', owner_phone_2569: '0812345678' },
        },
      ],
    };
    const out = toPublicFeatureCollection(withNew, ['parcel_cod', 'rai']);
    expect(out.features[0].properties).toEqual({ parcel_cod: '04B066' });
  });

  it('properties ที่เป็น null กลายเป็น {} ไม่ใช่ null', () => {
    const nullProps: FeatureCollection = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: null, properties: null }],
    };
    expect(toPublicFeatureCollection(nullProps, ['a']).features[0].properties).toEqual({});
  });

  it('ไม่ติด crs/name ของไฟล์ต้นทางไปด้วย', () => {
    const withMeta: FeatureCollection = { ...fc, name: 'Parcel_3', crs: { type: 'name' } };
    const out = toPublicFeatureCollection(withMeta, []);
    expect(out.name).toBeUndefined();
    expect(out.crs).toBeUndefined();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/map-public.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/map-public"`

- [ ] **Step 3: เขียน implementation**

```ts
import type { FeatureCollection } from '@/types/map';

// กรอง properties ให้เหลือเฉพาะฟิลด์ที่ประกาศเปิดเผยไว้อย่างตั้งใจ
//
// ทิศทางของค่าเริ่มต้นคือหัวใจ: publicFields ว่าง = ไม่เปิดฟิลด์ใดเลย ไม่ใช่เปิดหมด
// ฟิลด์ใหม่ที่โผล่มาในไฟล์เวอร์ชันหน้าจึงถูกกันไว้เองโดยอัตโนมัติ ไม่ใช่หลุดออกไป
// เองโดยอัตโนมัติ — ดูเหตุผลเดียวกันที่ PUBLIC_JOB_FIELDS ใน src/types/portal.ts
//
// ฟังก์ชันนี้ถูกเรียกตอน "เผยแพร่" ครั้งเดียวต่อเวอร์ชัน ไม่ใช่ตอนเสิร์ฟทุก request
// ไฟล์ที่วางอยู่บน CDN สาธารณะจึงไม่เคยมีฟิลด์ PII อยู่ในนั้นตั้งแต่แรก
export function toPublicFeatureCollection(
  fc: FeatureCollection,
  publicFields: string[]
): FeatureCollection {
  const allow = new Set(publicFields);
  return {
    // ประกอบใหม่ทั้งก้อนแทนการ spread: `name` กับ `crs` ของไฟล์ต้นทางไม่ควรติดไป
    // ด้วย และการ spread จะพาฟิลด์ระดับบนสุดที่เพิ่มมาในอนาคตหลุดไปเงียบ ๆ
    type: 'FeatureCollection',
    features: fc.features.map((f) => {
      const props: Record<string, unknown> = {};
      for (const key of Object.keys(f.properties ?? {})) {
        if (allow.has(key)) props[key] = f.properties![key];
      }
      return { type: 'Feature' as const, geometry: f.geometry, properties: props };
    }),
  };
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/map-public.test.ts`
Expected: PASS ทั้ง 7 เทสต์

- [ ] **Step 5: Commit**

```bash
git add src/lib/map-public.ts src/lib/map-public.test.ts
git commit -m "feat(map): กรอง properties ตาม whitelist ก่อนเผยแพร่สู่สาธารณะ"
```

---

## Task 4: สถิติของไฟล์

**Files:**
- Create: `src/lib/map-stats.ts`
- Test: `src/lib/map-stats.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
import { describe, expect, it } from 'vitest';
import { computeStats, sha256OfFeatureCollection } from '@/lib/map-stats';
import type { FeatureCollection } from '@/types/map';

function pt(lon: number, lat: number, props: Record<string, unknown>) {
  return { type: 'Feature' as const, geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props };
}

const fc: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    pt(98.0, 18.0, { zone: '01', rai: '1' }),
    pt(99.0, 19.0, { zone: '01', rai: '' }),
    pt(98.5, 18.5, { zone: '02' }),
  ],
};

describe('computeStats', () => {
  it('นับ feature และชนิดรูปทรง', () => {
    const s = computeStats(fc);
    expect(s.featureCount).toBe(3);
    expect(s.geometryTypes).toEqual(['Point']);
  });

  it('คำนวณ bbox จากทุกพิกัดไม่ว่าซ้อนลึกแค่ไหน', () => {
    const poly: FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'MultiPolygon', coordinates: [[[[98.1, 18.1], [98.9, 18.9], [98.1, 18.1]]]] },
        properties: {},
      }],
    };
    expect(computeStats(poly).bbox).toEqual([98.1, 18.1, 98.9, 18.9]);
  });

  it('นับ filled โดยถือว่าสตริงว่างและ null คือไม่กรอก', () => {
    const rai = computeStats(fc).fields.find((f) => f.name === 'rai')!;
    expect(rai.filled).toBe(1);
  });

  it('ฟิลด์ที่ไม่มีในบาง feature ยังถูกนับเป็นฟิลด์', () => {
    expect(computeStats(fc).fields.map((f) => f.name).sort()).toEqual(['rai', 'zone']);
  });

  it('เก็บรายการค่าเมื่อเป็นฟิลด์ประเภทหมวดหมู่', () => {
    const zone = computeStats(fc).fields.find((f) => f.name === 'zone')!;
    expect(zone.distinct).toBe(2);
    expect(zone.values).toEqual(['01', '02']);
  });

  it('ไม่เก็บรายการค่าเมื่อ distinct เกิน CATEGORICAL_MAX', () => {
    const many: FeatureCollection = {
      type: 'FeatureCollection',
      features: Array.from({ length: 60 }, (_, i) => pt(98, 18, { id: `x${i}` })),
    };
    expect(computeStats(many).fields[0].values).toBeUndefined();
  });

  it('ไฟล์ว่างไม่พัง', () => {
    const s = computeStats({ type: 'FeatureCollection', features: [] });
    expect(s.featureCount).toBe(0);
    expect(s.bbox).toEqual([0, 0, 0, 0]);
  });
});

describe('sha256OfFeatureCollection', () => {
  it('ข้อมูลเดียวกันได้ค่าเดียวกันแม้ลำดับคีย์ต่างกัน', () => {
    const a: FeatureCollection = { type: 'FeatureCollection', features: [pt(98, 18, { a: 1, b: 2 })] };
    const b: FeatureCollection = { type: 'FeatureCollection', features: [pt(98, 18, { b: 2, a: 1 })] };
    expect(sha256OfFeatureCollection(a)).toBe(sha256OfFeatureCollection(b));
  });

  it('ข้อมูลต่างกันได้คนละค่า', () => {
    const a: FeatureCollection = { type: 'FeatureCollection', features: [pt(98, 18, { a: 1 })] };
    const b: FeatureCollection = { type: 'FeatureCollection', features: [pt(98, 18, { a: 2 })] };
    expect(sha256OfFeatureCollection(a)).not.toBe(sha256OfFeatureCollection(b));
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/map-stats.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/map-stats"`

- [ ] **Step 3: เขียน implementation**

```ts
import crypto from 'node:crypto';
import {
  CATEGORICAL_MAX,
  type FeatureCollection,
  type FieldStat,
  type MapStats,
} from '@/types/map';

// สถิติของไฟล์หนึ่งเวอร์ชัน — ถูกเก็บลงเอกสารเวอร์ชันแล้วถูกอ่านซ้ำโดยด่านตรวจ
// ของเวอร์ชันถัดไป (new-value / field-removed / count-jump เทียบกับสถิติ ไม่ใช่
// กับตัวไฟล์) การเก็บ FieldStat.values ไว้ด้วยจึงทำให้ไม่ต้องดึงไฟล์เก่าทั้งก้อน
// มาเทียบทุกครั้ง — จำกัดที่ CATEGORICAL_MAX เพื่อไม่ให้เอกสารบวมจากฟิลด์ที่เป็น
// รหัสประจำตัว (parcel_cod มี 7,862 ค่าไม่ซ้ำ ไม่มีประโยชน์ที่จะเก็บทั้งหมด)

export function computeStats(fc: FeatureCollection): MapStats {
  const geometryTypes = new Set<string>();
  const filled = new Map<string, number>();
  const values = new Map<string, Set<string>>();
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

  for (const f of fc.features) {
    if (f.geometry?.type) geometryTypes.add(f.geometry.type);
    if (f.geometry) {
      walkCoords(f.geometry.coordinates, (lon, lat) => {
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      });
    }
    for (const [key, raw] of Object.entries(f.properties ?? {})) {
      if (!filled.has(key)) filled.set(key, 0);
      if (!values.has(key)) values.set(key, new Set());
      // สตริงว่างและ null คือ "ไม่ได้กรอก" เหมือนกัน — ข้อมูลจริงใช้ปนกันทั้งสองแบบ
      if (raw === null || raw === undefined || raw === '') continue;
      filled.set(key, filled.get(key)! + 1);
      const set = values.get(key)!;
      // หยุดสะสมเมื่อเกินเพดาน แต่ยังนับ distinct ต่อผ่าน size ที่โตขึ้นอีกหนึ่ง
      if (set.size <= CATEGORICAL_MAX) set.add(String(raw));
    }
  }

  const fields: FieldStat[] = [...filled.keys()].sort().map((name) => {
    const set = values.get(name)!;
    const over = set.size > CATEGORICAL_MAX;
    const stat: FieldStat = { name, filled: filled.get(name)!, distinct: set.size };
    if (!over) stat.values = [...set].sort();
    return stat;
  });

  return {
    featureCount: fc.features.length,
    geometryTypes: [...geometryTypes].sort(),
    bbox: Number.isFinite(minLon) ? [minLon, minLat, maxLon, maxLat] : [0, 0, 0, 0],
    fields,
  };
}

// เดินลงไปหาคู่ [lon, lat] ทุกจุดโดยไม่สนใจว่าเป็น Point หรือ MultiPolygon —
// GeoJSON ซ้อนอาเรย์ลึกไม่เท่ากันตามชนิดรูปทรง การเขียนแยกตามชนิดจะพลาดชนิดใหม่
function walkCoords(node: unknown, visit: (lon: number, lat: number) => void): void {
  if (!Array.isArray(node)) return;
  if (typeof node[0] === 'number' && typeof node[1] === 'number') {
    visit(node[0], node[1]);
    return;
  }
  for (const child of node) walkCoords(child, visit);
}

/**
 * ลายนิ้วมือของ "เนื้อข้อมูล" ไม่ใช่ของไฟล์ที่อัปขึ้นมา — shapefile zip ที่บีบอัด
 * ใหม่จากข้อมูลชุดเดิมได้ไบต์คนละชุดทุกครั้ง การเตือนว่า "ไฟล์นี้เหมือนเวอร์ชันที่
 * เผยแพร่อยู่ทุกประการ" จึงต้องดูที่เนื้อข้อมูลเท่านั้น
 *
 * เรียงคีย์ก่อน stringify เพราะลำดับคีย์ใน JSON ไม่มีความหมายเชิงข้อมูล แต่ทำให้
 * hash เปลี่ยนได้ (QGIS เรียงฟิลด์ไม่เหมือนกันระหว่างรุ่น)
 */
export function sha256OfFeatureCollection(fc: FeatureCollection): string {
  return crypto.createHash('sha256').update(stableStringify(fc)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(',')}}`;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/map-stats.test.ts`
Expected: PASS ทั้ง 9 เทสต์

- [ ] **Step 5: ยืนยันตัวเลขกับไฟล์จริง**

Run:
```bash
npx tsx -e "
import { readFileSync } from 'fs';
import { parseMapFile } from './src/lib/map-parse';
import { computeStats } from './src/lib/map-stats';
const r = parseMapFile(readFileSync('/tmp/zone.js','utf8'), 'ZoneMoobang_2.js');
if (!r.ok) throw new Error(r.message);
const s = computeStats(r.fc);
console.log('features', s.featureCount, '| geom', s.geometryTypes, '| bbox', s.bbox.map(n => n.toFixed(3)).join(','));
console.log('fields', s.fields.map(f => f.name + ':' + f.filled).join(' '));
"
```
Expected: `features 11 | geom [ 'MultiPolygon' ]` และ bbox อยู่ราว ๆ `98.7…,18.6…,98.9…,18.8…` (อยู่ในน้ำแพร่)

- [ ] **Step 6: Commit**

```bash
git add src/lib/map-stats.ts src/lib/map-stats.test.ts
git commit -m "feat(map): สถิติรายฟิลด์ bbox และลายนิ้วมือเนื้อข้อมูล"
```

---

## Task 5: ด่านตรวจ

**Files:**
- Create: `src/lib/map-checks.ts`
- Test: `src/lib/map-checks.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
import { describe, expect, it } from 'vitest';
import { runChecks, featureKey } from '@/lib/map-checks';
import { computeStats } from '@/lib/map-stats';
import type { FeatureCollection, MapLayer } from '@/types/map';

const layer: MapLayer = {
  id: 'parcel', title: 'แปลงที่ดิน', geometryType: 'MultiPolygon',
  keyFields: ['parcel_cod'], keyComposition: [['zone_id', 'block_id', 'lot'], ['block_id', 'lot']],
  visibility: 'public', publicFields: ['parcel_cod'], currentVersionNo: null,
  order: 0, updatedAt: '', updatedBy: '',
};

function poly(props: Record<string, unknown>, lon = 98.8, lat = 18.7): FeatureCollection['features'][number] {
  return {
    type: 'Feature',
    geometry: { type: 'MultiPolygon', coordinates: [[[[lon, lat], [lon + 0.01, lat], [lon, lat + 0.01], [lon, lat]]]] },
    properties: props,
  };
}
const fcOf = (features: FeatureCollection['features']): FeatureCollection => ({ type: 'FeatureCollection', features });

function check(fc: FeatureCollection, opts: Partial<Parameters<typeof runChecks>[0]> = {}) {
  return runChecks({ fc, stats: computeStats(fc), sha256: 'aaa', layer, previous: null, ...opts });
}
const codes = (fc: FeatureCollection, o = {}) => check(fc, o).map((c) => c.code);

describe('featureKey', () => {
  it('คีย์เดี่ยว', () => {
    expect(featureKey(poly({ parcel_cod: '04B066' }), ['parcel_cod'])).toBe('04B066');
  });
  it('คีย์ประกอบต่อกันด้วยตัวคั่นที่ไม่ปนกับค่า', () => {
    expect(featureKey(poly({ full_id: 'w1', zone_id: 'Moo 4' }), ['full_id', 'zone_id'])).toBe('w1 Moo 4');
  });
  it('คืน null เมื่อไม่มีคีย์หรือค่าว่าง', () => {
    expect(featureKey(poly({}), [])).toBeNull();
    expect(featureKey(poly({ parcel_cod: '' }), ['parcel_cod'])).toBeNull();
  });
});

describe('runChecks — error', () => {
  it('ไฟล์ว่าง', () => {
    expect(codes(fcOf([]))).toContain('empty');
  });

  it('พิกัด UTM ที่ลืมแปลงถูกจับที่ outside-thailand', () => {
    const utm = fcOf([poly({ parcel_cod: 'a' }, 485894, 2070600)]);
    expect(codes(utm)).toContain('outside-thailand');
  });

  it('พิกัดในไทยไม่ถูกจับ', () => {
    expect(codes(fcOf([poly({ parcel_cod: 'a' })]))).not.toContain('outside-thailand');
  });

  it('ชนิดรูปทรงไม่ตรงกับที่เลเยอร์ตรึงไว้', () => {
    const line = fcOf([{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[98.8, 18.7], [98.9, 18.8]] }, properties: { parcel_cod: 'a' } }]);
    expect(codes(line)).toContain('geometry-type-mismatch');
  });

  it('feature ที่ไม่มี geometry', () => {
    const bad = fcOf([{ type: 'Feature', geometry: null, properties: { parcel_cod: 'a' } }]);
    expect(codes(bad)).toContain('bad-geometry');
  });
});

describe('runChecks — warning', () => {
  it('คีย์ซ้ำและคีย์ว่าง', () => {
    const fc = fcOf([poly({ parcel_cod: '01A001' }), poly({ parcel_cod: '01A001' }), poly({})]);
    const dup = check(fc).find((c) => c.code === 'duplicate-key')!;
    expect(dup.level).toBe('warning');
    expect(dup.count).toBe(3); // สองแถวที่ซ้ำ + หนึ่งแถวที่ว่าง
  });

  it('คีย์ไม่ซ้ำไม่ขึ้นคำเตือน', () => {
    expect(codes(fcOf([poly({ parcel_cod: 'a' }), poly({ parcel_cod: 'b' })]))).not.toContain('duplicate-key');
  });

  it('key-composition ยอมรับสูตร zone+block+lot', () => {
    const fc = fcOf([poly({ parcel_cod: '04B066', zone_id: '04', block_id: 'B', lot: '066' })]);
    expect(codes(fc)).not.toContain('key-composition');
  });

  it('key-composition ยอมรับสูตร block+lot (ข้อมูลอีกชุดในไฟล์เดียวกัน)', () => {
    const fc = fcOf([poly({ parcel_cod: '02S015/004', zone_id: '16', block_id: '02S', lot: '015/004' })]);
    expect(codes(fc)).not.toContain('key-composition');
  });

  it('key-composition จับแถวที่ประกอบกลับไม่ได้เลย', () => {
    const fc = fcOf([poly({ parcel_cod: '01F095/003', zone_id: '01', block_id: '01C', lot: '003' })]);
    const c = check(fc).find((x) => x.code === 'key-composition')!;
    expect(c.count).toBe(1);
    expect(c.sample[0]).toContain('01F095/003');
  });

  it('null-literal จับสตริง None แต่ไม่แตะขีดกลาง', () => {
    const fc = fcOf([poly({ parcel_cod: 'a', zone_id: 'None', own_soi: '-' })]);
    const c = check(fc).find((x) => x.code === 'null-literal')!;
    expect(c.count).toBe(1);
    expect(c.sample.join()).toContain('zone_id');
    expect(c.sample.join()).not.toContain('own_soi');
  });

  it('mojibake จับข้อความไทยที่ encoding พัง', () => {
    const fc = fcOf([poly({ parcel_cod: 'a', Id_Chanod: '*เน€เธ??เน€เธ?เธ?' })]);
    expect(codes(fc)).toContain('mojibake');
  });

  it('mojibake ไม่จับข้อความไทยปกติ', () => {
    const fc = fcOf([poly({ parcel_cod: 'a', tambol: 'น้ำแพร่', amphur: 'หางดง' })]);
    expect(codes(fc)).not.toContain('mojibake');
  });

  it('new-value เงียบเมื่อไม่มีเวอร์ชันก่อนหน้า', () => {
    expect(codes(fcOf([poly({ parcel_cod: 'a', zone_id: 'ใหม่เอี่ยม' })]))).not.toContain('new-value');
  });

  it('new-value จับค่าที่ไม่เคยมีในเวอร์ชันก่อน', () => {
    const before = computeStats(fcOf([poly({ parcel_cod: 'a', zone_id: '01' })]));
    const fc = fcOf([poly({ parcel_cod: 'a', zone_id: '01' }), poly({ parcel_cod: 'b', zone_id: '167' })]);
    const c = check(fc, { previous: { stats: before, sha256: 'zzz', versionNo: 1 } })
      .find((x) => x.code === 'new-value')!;
    expect(c.sample.join()).toContain('167');
  });

  it('identical เมื่อ sha256 ตรงกับเวอร์ชันที่เผยแพร่อยู่', () => {
    const fc = fcOf([poly({ parcel_cod: 'a' })]);
    const got = codes(fc, { previous: { stats: computeStats(fc), sha256: 'aaa', versionNo: 3 } });
    expect(got).toContain('identical');
  });

  it('count-jump เมื่อจำนวนเปลี่ยนเกิน 20%', () => {
    const before = computeStats(fcOf(Array.from({ length: 100 }, (_, i) => poly({ parcel_cod: `k${i}` }))));
    const fc = fcOf(Array.from({ length: 50 }, (_, i) => poly({ parcel_cod: `k${i}` })));
    expect(codes(fc, { previous: { stats: before, sha256: 'z', versionNo: 1 } })).toContain('count-jump');
  });

  it('field-removed เมื่อฟิลด์เดิมหายไป', () => {
    const before = computeStats(fcOf([poly({ parcel_cod: 'a', rai: '1' })]));
    const fc = fcOf([poly({ parcel_cod: 'a' })]);
    const c = check(fc, { previous: { stats: before, sha256: 'z', versionNo: 1 } })
      .find((x) => x.code === 'field-removed')!;
    expect(c.sample).toContain('rai');
  });

  it('new-public-candidate เมื่อมีฟิลด์ใหม่ที่ยังไม่เปิดสาธารณะ', () => {
    const fc = fcOf([poly({ parcel_cod: 'a', ฟิลด์ใหม่: 'x' })]);
    expect(codes(fc)).toContain('new-public-candidate');
  });

  it('เจอ error แล้วไม่ต้องรายงาน warning ให้รก', () => {
    const utm = fcOf([poly({ parcel_cod: 'a' }, 485894, 2070600), poly({ parcel_cod: 'a' }, 485895, 2070601)]);
    expect(check(utm).every((c) => c.level === 'error')).toBe(true);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/map-checks.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/map-checks"`

- [ ] **Step 3: เขียน implementation**

```ts
import {
  CATEGORICAL_MAX,
  THAILAND_BBOX,
  type Feature,
  type FeatureCollection,
  type MapCheck,
  type MapLayer,
  type MapStats,
} from '@/types/map';

// ด่านตรวจ — ฟังก์ชันบริสุทธิ์ ไม่มี I/O
//
// หลักการแบ่งระดับ:
//   error   = "ไฟล์นี้ใช้งานไม่ได้จริง" ยืนยันไปก็ไม่ทำให้มันใช้ได้ → ไม่เกิด draft
//   warning = "ข้อมูลอาจถูกต้องตามความเป็นจริง" คนตัดสินคือเจ้าหน้าที่ ไม่ใช่โปรแกรม
//
// ห้ามเพิ่มกฎที่ต้องรู้ว่า "ค่าที่ถูกต้องมีอะไรบ้าง" (เช่น รายชื่อโซนของน้ำแพร่)
// ระบบไม่มีทางรู้ และการเดาแทนเจ้าหน้าที่คือการสร้างข้อมูลปลอมที่ดูน่าเชื่อถือ —
// ดูสเปกหัวข้อ zone_id ว่าทำไมกฎ rare-value รุ่นแรกถึงถูกตัดทิ้งทั้งข้อ

export const KEY_SEPARATOR = ' ';   // ไม่มีทางปนกับค่าในข้อมูลจริง
const COUNT_JUMP_RATIO = 0.2;
const SAMPLE_MAX = 5;

const NULL_LITERALS = new Set([
  'none', 'null', 'nan', 'nil', 'n/a', 'na', '#n/a', '<null>', 'undefined',
]);

// ลำดับไบต์ที่โผล่เมื่อข้อความ UTF-8 ภาษาไทยถูกอ่านเป็น cp874/latin1 แล้วเข้ารหัส
// กลับเป็น UTF-8 — 'เธ'/'เน' ตามด้วยอักขระที่ไม่ใช่สระ/พยัญชนะไทย คือรอยนิ้วมือ
const MOJIBAKE = /(เธ|เน)[^฀-๿]/;

export type PreviousVersion = { stats: MapStats; sha256: string; versionNo: number };

export type CheckInput = {
  fc: FeatureCollection;
  stats: MapStats;
  sha256: string;
  layer: MapLayer;
  previous: PreviousVersion | null;
};

/** ตัวตนของ feature ตาม keyFields — null แปลว่าไม่มีคีย์ให้ใช้ */
export function featureKey(f: Feature, keyFields: string[]): string | null {
  if (keyFields.length === 0) return null;
  const parts: string[] = [];
  for (const name of keyFields) {
    const v = f.properties?.[name];
    if (v === null || v === undefined || v === '') return null;
    parts.push(String(v));
  }
  return parts.join(KEY_SEPARATOR);
}

export function runChecks(input: CheckInput): MapCheck[] {
  const errors = collectErrors(input);
  // มี error แล้วไม่ต้องรายงาน warning — ไฟล์ยังไม่ถูกรับเข้าระบบอยู่ดี การแสดง
  // คำเตือนอีกสิบข้อพร้อมกันทำให้ข้อความที่ต้องลงมือแก้จริงจมหาย
  if (errors.length > 0) return errors;
  return collectWarnings(input);
}

function collectErrors({ fc, stats, layer }: CheckInput): MapCheck[] {
  const out: MapCheck[] = [];

  if (fc.features.length === 0) {
    out.push(mk('empty', 'error', 'ไฟล์ไม่มีข้อมูลสักรายการ', 0, []));
    return out;   // ตรวจต่อไม่ได้ถ้าไม่มีอะไรให้ตรวจ
  }

  const noGeom = fc.features.filter((f) => !f.geometry || !Array.isArray(f.geometry.coordinates));
  if (noGeom.length > 0) {
    out.push(mk('bad-geometry', 'error', `มี ${noGeom.length} รายการที่ไม่มีรูปทรงหรือรูปทรงเสียหาย`,
      noGeom.length, noGeom.slice(0, SAMPLE_MAX).map((_, i) => `แถวที่ ${i + 1}`)));
  }

  const [minLon, minLat, maxLon, maxLat] = stats.bbox;
  const [tMinLon, tMinLat, tMaxLon, tMaxLat] = THAILAND_BBOX;
  if (minLon < tMinLon || minLat < tMinLat || maxLon > tMaxLon || maxLat > tMaxLat) {
    out.push(mk('outside-thailand', 'error',
      `พิกัดอยู่นอกขอบเขตประเทศไทย (${minLon.toFixed(0)}, ${minLat.toFixed(0)}) — ` +
      'มักเกิดจากการ export โดยลืมเปลี่ยนระบบพิกัดจาก UTM เป็น EPSG:4326 ให้ตั้ง CRS ใน QGIS เป็น WGS 84 แล้ว export ใหม่',
      fc.features.length, []));
  }

  const wrong = stats.geometryTypes.filter((t) => t !== layer.geometryType);
  if (wrong.length > 0) {
    out.push(mk('geometry-type-mismatch', 'error',
      `เลเยอร์นี้เก็บรูปทรงแบบ ${layer.geometryType} แต่ไฟล์มี ${wrong.join(', ')} — น่าจะอัปผิดเลเยอร์`,
      fc.features.length, wrong));
  }

  return out;
}

function collectWarnings({ fc, stats, sha256, layer, previous }: CheckInput): MapCheck[] {
  const out: MapCheck[] = [];

  if (previous && previous.sha256 === sha256) {
    out.push(mk('identical', 'warning',
      `เนื้อข้อมูลเหมือนเวอร์ชัน ${previous.versionNo} ที่เผยแพร่อยู่ทุกประการ — อาจอัปไฟล์เดิมซ้ำโดยไม่ตั้งใจ`,
      stats.featureCount, []));
  }

  // ── คีย์ซ้ำ/ว่าง ────────────────────────────────────────────────────────
  if (layer.keyFields.length > 0) {
    const seen = new Map<string, number>();
    let missing = 0;
    for (const f of fc.features) {
      const key = featureKey(f, layer.keyFields);
      if (key === null) missing += 1;
      else seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const dupKeys = [...seen.entries()].filter(([, n]) => n > 1);
    const dupRows = dupKeys.reduce((sum, [, n]) => sum + n, 0);
    if (dupRows + missing > 0) {
      out.push(mk('duplicate-key', 'warning',
        `${layer.keyFields.join(' + ')} ซ้ำ ${dupRows} รายการ และว่าง ${missing} รายการ — ` +
        'ค่านี้ใช้เป็นตัวตนของแต่ละรายการในการเทียบส่วนต่าง ถ้าซ้ำจะบอกไม่ได้ว่ารายการไหนถูกแก้',
        dupRows + missing,
        dupKeys.slice(0, SAMPLE_MAX).map(([k, n]) => `${k.split(KEY_SEPARATOR).join(' + ')} (${n} รายการ)`)));
    }
  }

  // ── ประกอบคีย์กลับจากฟิลด์อื่นไม่ได้ ────────────────────────────────────
  if (layer.keyFields.length === 1 && layer.keyComposition.length > 0) {
    const bad: string[] = [];
    for (const f of fc.features) {
      const key = f.properties?.[layer.keyFields[0]];
      if (key === null || key === undefined || key === '') continue;
      const target = String(key);
      const usable = layer.keyComposition.filter((recipe) =>
        recipe.every((name) => {
          const v = f.properties?.[name];
          return v !== null && v !== undefined && v !== '';
        })
      );
      if (usable.length === 0) continue;   // ฟิลด์ประกอบไม่ครบ ตัดสินไม่ได้ ไม่ใช่ความผิด
      const matched = usable.some((recipe) => recipe.map((n) => String(f.properties![n])).join('') === target);
      if (!matched) bad.push(target);
    }
    if (bad.length > 0) {
      out.push(mk('key-composition', 'warning',
        `มี ${bad.length} รายการที่ ${layer.keyFields[0]} ประกอบกลับจากฟิลด์ย่อยไม่ได้ — ` +
        'มักแปลว่ากรอกเลขบล็อกหรือเลขล็อตผิด',
        bad.length, bad.slice(0, SAMPLE_MAX)));
    }
  }

  // ── สตริงที่ใช้แทนค่าว่าง ───────────────────────────────────────────────
  const nullish: string[] = [];
  let nullishCount = 0;
  for (const f of fc.features) {
    for (const [key, v] of Object.entries(f.properties ?? {})) {
      if (typeof v === 'string' && NULL_LITERALS.has(v.trim().toLowerCase())) {
        nullishCount += 1;
        if (nullish.length < SAMPLE_MAX) nullish.push(`${key} = "${v}"`);
      }
    }
  }
  if (nullishCount > 0) {
    out.push(mk('null-literal', 'warning',
      `มี ${nullishCount} ช่องที่เก็บคำว่า "None"/"null" เป็นข้อความแทนที่จะเว้นว่าง`,
      nullishCount, nullish));
  }

  // ── encoding พัง ────────────────────────────────────────────────────────
  const moji = new Map<string, number>();
  for (const f of fc.features) {
    for (const [key, v] of Object.entries(f.properties ?? {})) {
      if (typeof v === 'string' && MOJIBAKE.test(v)) moji.set(key, (moji.get(key) ?? 0) + 1);
    }
  }
  if (moji.size > 0) {
    const total = [...moji.values()].reduce((a, b) => a + b, 0);
    out.push(mk('mojibake', 'warning',
      `พบข้อความภาษาไทยที่อ่านไม่ออก ${total} ช่อง — เกิดตอน export ด้วยรหัสอักขระผิด ให้ตั้ง encoding เป็น UTF-8 แล้ว export ใหม่`,
      total, [...moji.entries()].slice(0, SAMPLE_MAX).map(([k, n]) => `${k} (${n} ช่อง)`)));
  }

  // ── ฟิลด์ใหม่ที่ยังไม่เปิดสาธารณะ ───────────────────────────────────────
  if (layer.visibility === 'public') {
    const known = new Set(layer.publicFields);
    const fresh = stats.fields.map((f) => f.name).filter((n) => !known.has(n));
    if (fresh.length > 0) {
      out.push(mk('new-public-candidate', 'warning',
        `มี ${fresh.length} ฟิลด์ที่ยังไม่ได้เปิดเผยต่อสาธารณะ — ถ้าต้องการเปิด ให้ไปติ๊กในหน้าตั้งค่าเลเยอร์`,
        fresh.length, fresh.slice(0, SAMPLE_MAX)));
    }
  }

  if (!previous) return out;

  // ── เทียบกับเวอร์ชันที่เผยแพร่อยู่ ──────────────────────────────────────
  const before = previous.stats.featureCount;
  const now = stats.featureCount;
  if (before > 0 && Math.abs(now - before) / before > COUNT_JUMP_RATIO) {
    out.push(mk('count-jump', 'warning',
      `จำนวนรายการเปลี่ยนจาก ${before} เป็น ${now} (${now > before ? '+' : ''}${now - before})`,
      Math.abs(now - before), []));
  }

  const nowFields = new Set(stats.fields.map((f) => f.name));
  const gone = previous.stats.fields.map((f) => f.name).filter((n) => !nowFields.has(n));
  if (gone.length > 0) {
    out.push(mk('field-removed', 'warning',
      `ฟิลด์ที่เคยมีหายไป ${gone.length} ฟิลด์ — ระบบอื่นที่ดึงข้อมูลไปใช้อาจพัง`,
      gone.length, gone.slice(0, SAMPLE_MAX)));
  }

  const fresh: string[] = [];
  let freshCount = 0;
  for (const field of stats.fields) {
    if (!field.values || field.distinct > CATEGORICAL_MAX) continue;
    const old = previous.stats.fields.find((f) => f.name === field.name);
    if (!old?.values) continue;   // เวอร์ชันก่อนไม่ได้เก็บรายการค่า เทียบไม่ได้
    const known = new Set(old.values);
    for (const v of field.values) {
      if (known.has(v)) continue;
      freshCount += 1;
      if (fresh.length < SAMPLE_MAX) fresh.push(`${field.name} = "${v}"`);
    }
  }
  if (freshCount > 0) {
    out.push(mk('new-value', 'warning',
      `มีค่าที่ไม่เคยปรากฏในเวอร์ชัน ${previous.versionNo} จำนวน ${freshCount} ค่า — ถ้าไม่ได้ตั้งใจเพิ่ม อาจเป็นการพิมพ์ผิด`,
      freshCount, fresh));
  }

  return out;
}

function mk(
  code: MapCheck['code'], level: MapCheck['level'], message: string, count: number, sample: string[]
): MapCheck {
  return { code, level, message, count, sample };
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/map-checks.test.ts`
Expected: PASS ทั้ง 22 เทสต์

- [ ] **Step 5: ยืนยันกับไฟล์แปลงที่ดินจริง — ตัวเลขต้องตรงกับที่สเปกบันทึกไว้**

Run:
```bash
curl -s https://namphraesmartcity.ai/map/data/Parcel_3.js -o /tmp/parcel.js && \
npx tsx -e "
import { readFileSync } from 'fs';
import { parseMapFile } from './src/lib/map-parse';
import { computeStats, sha256OfFeatureCollection } from './src/lib/map-stats';
import { runChecks } from './src/lib/map-checks';
import type { MapLayer } from './src/types/map';
const layer: MapLayer = { id:'parcel', title:'แปลงที่ดิน', geometryType:'MultiPolygon',
  keyFields:['parcel_cod'], keyComposition:[['zone_id','block_id','lot'],['block_id','lot']],
  visibility:'public', publicFields:['parcel_cod','zone_id','block_id','lot','rai','ngan','wa','subwa','province','amphur','tambol'],
  currentVersionNo:null, order:0, updatedAt:'', updatedBy:'' };
const r = parseMapFile(readFileSync('/tmp/parcel.js','utf8'), 'Parcel_3.js');
if (!r.ok) throw new Error(r.message);
const stats = computeStats(r.fc);
for (const c of runChecks({ fc:r.fc, stats, sha256: sha256OfFeatureCollection(r.fc), layer, previous:null }))
  console.log(\`[\${c.level}] \${c.code} x\${c.count}\`);
"
```
Expected: ไม่มี error เลย และเห็น warning เหล่านี้ (ตัวเลขตรงกับที่สเปกบันทึกจากการสำรวจ)
```
[warning] duplicate-key x108      ← ซ้ำ 96 + ว่าง 12
[warning] key-composition x88
[warning] null-literal x1
[warning] mojibake x74
```

ถ้าตัวเลขไม่ตรง **ห้ามแก้เทสต์ให้ผ่าน** — ให้กลับไปหาสาเหตุว่าโค้ดนับต่างจากที่สำรวจไว้ตรงไหน

- [ ] **Step 6: Commit**

```bash
git add src/lib/map-checks.ts src/lib/map-checks.test.ts
git commit -m "feat(map): ด่านตรวจไฟล์แผนที่ 14 กฎ แยก error ที่บล็อกกับ warning ที่ยืนยันผ่านได้"
```

---

## Task 6: เทียบส่วนต่างระหว่างเวอร์ชัน

**Files:**
- Create: `src/lib/map-diff.ts`
- Test: `src/lib/map-diff.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
import { describe, expect, it } from 'vitest';
import { computeDiff } from '@/lib/map-diff';
import type { FeatureCollection } from '@/types/map';

const f = (props: Record<string, unknown>, lon = 98.8) => ({
  type: 'Feature' as const,
  geometry: { type: 'Point', coordinates: [lon, 18.7] },
  properties: props,
});
const fc = (features: FeatureCollection['features']): FeatureCollection => ({ type: 'FeatureCollection', features });

describe('computeDiff', () => {
  it('นับเพิ่ม ลบ แก้ไข ด้วยคีย์เดี่ยว', () => {
    const before = fc([f({ k: 'a', v: '1' }), f({ k: 'b', v: '1' }), f({ k: 'c', v: '1' })]);
    const after = fc([f({ k: 'a', v: '1' }), f({ k: 'b', v: '2' }), f({ k: 'd', v: '1' })]);
    const d = computeDiff(after, before, ['k'], 3);
    expect(d).toMatchObject({ comparedToVersionNo: 3, added: 1, removed: 1, changed: 1 });
  });

  it('geometry เปลี่ยนก็นับว่าแก้ไข', () => {
    const before = fc([f({ k: 'a' }, 98.8)]);
    const after = fc([f({ k: 'a' }, 99.9)]);
    expect(computeDiff(after, before, ['k'], 1).changed).toBe(1);
  });

  it('ลำดับคีย์ใน properties ต่างกันไม่นับว่าแก้ไข', () => {
    const before = fc([{ ...f({}), properties: { k: 'a', x: 1, y: 2 } }]);
    const after = fc([{ ...f({}), properties: { k: 'a', y: 2, x: 1 } }]);
    expect(computeDiff(after, before, ['k'], 1).changed).toBe(0);
  });

  it('คีย์ประกอบ', () => {
    const before = fc([f({ id: 'w1', zone: 'Moo 4' }), f({ id: 'w1', zone: 'Moo 7' })]);
    const after = fc([f({ id: 'w1', zone: 'Moo 4' })]);
    expect(computeDiff(after, before, ['id', 'zone'], 1)).toMatchObject({ added: 0, removed: 1 });
  });

  it('ไม่มีคีย์ = เทียบได้แค่จำนวน ไม่แกล้งบอกว่ารายการไหนหาย', () => {
    const before = fc([f({ a: 1 }), f({ a: 2 })]);
    const after = fc([f({ a: 1 })]);
    const d = computeDiff(after, before, [], 1);
    expect(d).toMatchObject({ added: 0, removed: 1, changed: 0 });
  });

  it('ไม่มีคีย์และจำนวนเพิ่ม', () => {
    const d = computeDiff(fc([f({}), f({}), f({})]), fc([f({})]), [], 1);
    expect(d).toMatchObject({ added: 2, removed: 0 });
  });

  it('รายงานฟิลด์ที่เพิ่มและหาย', () => {
    const before = fc([f({ k: 'a', old: 1 })]);
    const after = fc([f({ k: 'a', fresh: 1 })]);
    const d = computeDiff(after, before, ['k'], 1);
    expect(d.fieldsAdded).toEqual(['fresh']);
    expect(d.fieldsRemoved).toEqual(['old']);
  });

  it('คีย์ซ้ำไม่ทำให้พัง — นับตามจำนวนที่ปรากฏ', () => {
    const before = fc([f({ k: 'a' }), f({ k: 'a' })]);
    const after = fc([f({ k: 'a' })]);
    expect(computeDiff(after, before, ['k'], 1).removed).toBe(1);
  });

  it('รายการที่ไม่มีคีย์ถูกนับรวมแบบไม่ระบุตัวตน', () => {
    const before = fc([f({ k: 'a' }), f({ k: '' })]);
    const after = fc([f({ k: 'a' })]);
    expect(computeDiff(after, before, ['k'], 1).removed).toBe(1);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/map-diff.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/map-diff"`

- [ ] **Step 3: เขียน implementation**

```ts
import { featureKey } from '@/lib/map-checks';
import type { Feature, FeatureCollection, MapDiff } from '@/types/map';

// เทียบสองเวอร์ชัน — ฟังก์ชันบริสุทธิ์
//
// เลเยอร์ที่ไม่มี keyFields (เช่นอาคาร ซึ่ง OBJECTID ถูกแจกใหม่ทุกรอบ export)
// เทียบได้แค่ระดับจำนวน จงใจไม่พยายามจับคู่ด้วย geometry เพราะการขยับพิกัดเพียง
// ทศนิยมหลักที่หกจะทำให้ทุกรายการกลายเป็น "ลบทิ้งแล้วเพิ่มใหม่" ซึ่งเป็นตัวเลขที่
// ดูน่าตกใจแต่ไม่มีความหมาย

export function computeDiff(
  current: FeatureCollection,
  previous: FeatureCollection,
  keyFields: string[],
  comparedToVersionNo: number
): MapDiff {
  const fieldsNow = new Set(current.features.flatMap((f) => Object.keys(f.properties ?? {})));
  const fieldsBefore = new Set(previous.features.flatMap((f) => Object.keys(f.properties ?? {})));

  const base: MapDiff = {
    comparedToVersionNo,
    added: 0,
    removed: 0,
    changed: 0,
    fieldsAdded: [...fieldsNow].filter((n) => !fieldsBefore.has(n)).sort(),
    fieldsRemoved: [...fieldsBefore].filter((n) => !fieldsNow.has(n)).sort(),
  };

  if (keyFields.length === 0) {
    const delta = current.features.length - previous.features.length;
    return { ...base, added: Math.max(0, delta), removed: Math.max(0, -delta) };
  }

  // นับจำนวนต่อคีย์ (ไม่ใช่ Set) เพราะข้อมูลจริงมีคีย์ซ้ำ — ดูสเปก Context ข้อ 2
  const before = groupByKey(previous.features, keyFields);
  const after = groupByKey(current.features, keyFields);

  let added = 0, removed = 0, changed = 0;

  for (const [key, nowRows] of after) {
    const beforeRows = before.get(key);
    if (!beforeRows) { added += nowRows.length; continue; }
    const common = Math.min(nowRows.length, beforeRows.length);
    for (let i = 0; i < common; i += 1) {
      if (fingerprint(nowRows[i]) !== fingerprint(beforeRows[i])) changed += 1;
    }
    added += Math.max(0, nowRows.length - beforeRows.length);
    removed += Math.max(0, beforeRows.length - nowRows.length);
  }
  for (const [key, beforeRows] of before) {
    if (!after.has(key)) removed += beforeRows.length;
  }

  return { ...base, added, removed, changed };
}

// รายการที่ไม่มีคีย์ (คีย์ว่าง) กองรวมกันใต้คีย์พิเศษตัวเดียว — นับจำนวนได้ถูกต้อง
// โดยไม่แกล้งอ้างว่ารู้ว่ารายการไหนเป็นรายการไหน
const NO_KEY = '  ไม่มีคีย์';

function groupByKey(features: Feature[], keyFields: string[]): Map<string, Feature[]> {
  const out = new Map<string, Feature[]>();
  for (const f of features) {
    const key = featureKey(f, keyFields) ?? NO_KEY;
    const list = out.get(key);
    if (list) list.push(f);
    else out.set(key, [f]);
  }
  return out;
}

// ลายนิ้วมือของหนึ่งรายการ — เรียงคีย์ก่อนเสมอ ลำดับฟิลด์ที่ QGIS เขียนออกมา
// ต่างกันระหว่างรุ่นไม่ใช่การแก้ไขข้อมูล
function fingerprint(f: Feature): string {
  const props = Object.keys(f.properties ?? {})
    .sort()
    .map((k) => `${k}=${String(f.properties![k])}`)
    .join('|');
  return `${JSON.stringify(f.geometry)}#${props}`;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/map-diff.test.ts`
Expected: PASS ทั้ง 9 เทสต์

- [ ] **Step 5: รันเทสต์ทั้งชุดให้แน่ใจว่าไม่มีอะไรพัง**

Run: `npm test`
Expected: เทสต์เดิมทั้งหมดของโปรเจกต์ + ของใหม่ผ่านหมด

- [ ] **Step 6: Commit**

```bash
git add src/lib/map-diff.ts src/lib/map-diff.test.ts
git commit -m "feat(map): เทียบส่วนต่างระหว่างเวอร์ชันด้วยคีย์เดี่ยว คีย์ประกอบ และแบบไม่มีคีย์"
```

---

## หมายเหตุสำหรับผู้ลงมือ — งานที่เหลือ

Task 1–6 ครอบ logic บริสุทธิ์ทั้งหมดและมีเทสต์ครบ **หยุดตรวจงานที่นี่ก่อนไปต่อ** เพราะทุก task ถัดไปเรียกใช้ฟังก์ชันเหล่านี้ ถ้าลายเซ็นเปลี่ยนทีหลังจะลามทั้งแผน

ลายเซ็นที่ task ถัดไปพึ่งพา (ห้ามเปลี่ยนโดยไม่แก้แผน):

```ts
parseMapFile(text: string, fileName: string): ParseResult
computeStats(fc: FeatureCollection): MapStats
sha256OfFeatureCollection(fc: FeatureCollection): string
runChecks(input: CheckInput): MapCheck[]
featureKey(f: Feature, keyFields: string[]): string | null
computeDiff(current, previous, keyFields, comparedToVersionNo): MapDiff
toPublicFeatureCollection(fc, publicFields): FeatureCollection
```

Task ที่เหลือจะถูกเขียนต่อในไฟล์นี้หลัง Task 1–6 ผ่านการตรวจ:

| Task | ขอบเขต |
|---|---|
| 7 | `map-store.ts` ฟังก์ชันบริสุทธิ์ (`buildNewVersion`, `buildPublishPatch`, `assetsToPrune`) + เทสต์ |
| 8 | `map-store.ts` I/O — Mongo + แบ็กเอนด์ไฟล์ + `assertFileBackendAllowed` + `ensureIndexes` |
| 9 | `cloudinary.ts` — ลายเซ็น raw · อัปจาก buffer · signed URL · destroy |
| 10 | `schema.ts` — Zod ของ payload ใหม่ |
| 11 | API ลงทะเบียนเวอร์ชัน (แกะ ตรวจ diff → draft) + ขอลายเซ็น |
| 12 | API เผยแพร่ + ทิ้งร่าง + ตัดไฟล์เก่าตามนโยบาย 5 เวอร์ชัน |
| 13 | API ดาวน์โหลดไฟล์เต็ม + `issues.csv` |
| 14 | API รายการเลเยอร์ · ตั้งค่า · endpoint สาธารณะ (302 → CDN) |
| 15 | `map-shapefile-client.ts` — `.zip` → GeoJSON ในเบราว์เซอร์ |
| 16 | `admin-api.ts` — ฟังก์ชันฝั่ง client |
| 17 | `MapLayerCard.tsx` — การ์ด + drop zone + แผงสรุป |
| 18 | `/admin/map` + เมนูใน `AdminLayout` |
| 19 | `PublicFieldPicker.tsx` + `/admin/map/[layerId]` |
| 20 | `scripts/import-map-layers.ts` — นำเข้าครั้งแรก |
| 21 | README |
