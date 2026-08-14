# ป่าชุมชน — เลเยอร์ใหม่บนคลังไฟล์แผนที่ (PR 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** นำขอบเขตป่าชุมชนหมู่ 10 และ 11 พร้อมหมุดพิกัดรังวัด 176 จุด ขึ้นแผนที่สาธารณะของพอร์ทัล และทำให้เจ้าหน้าที่อัปเดตเองด้วยการลากไฟล์วางได้เหมือนแผนที่ภาษี

**Architecture:** เพิ่มสองเลเยอร์เข้าคลังไฟล์แผนที่ที่มีอยู่ ไม่สร้างท่อใหม่ — ซิปต้นทางมี shapefile 7 ชั้นปนสามรูปทรงและมี `.prj` หนึ่งไฟล์ประกาศระบบพิกัดผิด จึงต้องมีสคริปต์นำเข้าครั้งเดียวเพื่อแกะ/ซ่อม/แยกเป็นสองเลเยอร์ แล้วเดินผ่าน `ingestMapFile()` ตัวเดียวกับ API route ส่วนการคำนวณพื้นที่ไร่ย้ายเข้าไปอยู่ใน pipeline (ไม่ใช่ในสคริปต์) เพื่อให้ทางลากไฟล์วางได้ผลเท่ากัน

**Tech Stack:** Next.js 16 (Pages Router) · TypeScript · vitest · `shpjs` (ESM บน Node) · `proj4` · Leaflet · MongoDB · Cloudinary

**Spec:** [2026-08-14-community-forest-layers-design.md](../specs/2026-08-14-community-forest-layers-design.md)

> **โค้ดใน Task 2 และ Task 4 ถูกรันจริงกับ `public/Shapefiles ป่าชุมชน.zip` แล้วก่อนเขียนแผนนี้**
> ผลที่ได้: ขอบเขต 2 รายการ · หมุด 176 รายการ · คีย์ `(moo, point_n)` ไม่ซ้ำ 176/176 ·
> พื้นที่ `10:50.02` `11:1941.21` ไร่ · `withArea` เรียกซ้ำได้ค่าเดิมทุกบิต · ฟิลด์ขยะเหลือ 0 ·
> หมุดทุกจุดอยู่ในช่วง lon 98.865–98.905 (ในเขตตำบล)
> ตัวเลขที่เป็น expected ในเทสต์และใน Task 8 จึงเป็นค่าที่วัดมาแล้ว ไม่ใช่ค่าที่คาดเดา

---

## บริบทที่ต้องรู้ก่อนเริ่ม

**ข้อมูลจริงในซิป** (`public/Shapefiles ป่าชุมชน.zip` — แกะตรวจแล้ว):

| shapefile (ต่อท้าย `Shapefiles/`) | รูปทรงที่ shpjs คืน | records | ใช้เป็น |
|---|---|---|---|
| `พิกัดป่าชุมชนหมู่ 10` | Point | 59 | หมุด หมู่ 10 |
| `พิกัดป่าชุมชนหมู่ 10_polygon1` | Polygon | 1 | ขอบเขต หมู่ 10 |
| `พิกัดป่าชุมชนหมู่ 11_point` | Point | 117 | หมุด หมู่ 11 — **พิกัดไม่ถูกแปลง** |
| `พิกัดป่าชุมชนหมู่ 11_polygon` | Polygon | 1 | ขอบเขต หมู่ 11 |
| `พิกัดป่าชุมชนหมู่ 10_polygon` | LineString | 1 | ไม่ใช้ (ซ้ำ) |
| `พิกัดป่าชุมชนหมู่ 11_line` | LineString | 1 | ไม่ใช้ (ซ้ำ) |
| `พิกัดป่าชุมชนหมู่ 11` | — | 0 | ไม่ใช้ (ว่าง) |

`พิกัดป่าชุมชนหมู่ 11_point.prj` เขียนว่า `GEOGCS["GCS_WGS_1984"]` แต่พิกัดข้างในเป็น UTM zone 47N จริง `shpjs` จึงคืนค่าดิบ `[489711, 2069101]` ออกมา ต้องแปลงเองด้วย proj4 → `[98.902408, 18.713236]`

**กติกาของ repo นี้:**
- vitest ทดสอบเฉพาะ logic บริสุทธิ์ — ห้ามแตะ DB/network ในเทสต์
- `npm test` รันทั้งหมด, `npx vitest run <path>` รันไฟล์เดียว
- คอมเมนต์ในซอร์สเป็นภาษาไทย อธิบาย **เหตุผล** ไม่ใช่อธิบายว่าโค้ดทำอะไร (ดูสไตล์ใน `src/lib/map-store.ts`)
- `src/pages/api/admin/**` ทุกไฟล์ต้องมี guard ไม่งั้นตก `api-guard-coverage.test.ts`

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/map-area.ts` (สร้าง) | คำนวณพื้นที่ไร่/ตร.กม. จาก geometry — อยู่ในเส้นทางถาวรของทุกเลเยอร์ที่ตั้ง `computeArea` |
| `src/lib/map-area.test.ts` (สร้าง) | เทสต์ของข้างบน |
| `src/types/map.ts` (แก้) | เพิ่ม `computeArea?: boolean` เข้า `MapLayer` |
| `src/lib/map-ingest.ts` (แก้) | เรียก `withArea()` ก่อน `computeStats` |
| `src/lib/map-ingest.test.ts` (สร้าง) | ตรึงว่า pipeline เติม area ตาม flag |
| `src/lib/map-forest-prep.ts` (สร้าง) | แกะ/ซ่อม/แยกซิปชุดนี้ — งานเฉพาะกิจ ไม่มีใครเรียกหลังนำเข้าเสร็จ |
| `src/lib/map-forest-prep.test.ts` (สร้าง) | เทสต์ของข้างบน |
| `scripts/import-community-forest.mts` (สร้าง) | I/O ล้วน: อ่านซิป → อัป Cloudinary → เขียนทะเบียน |
| `src/lib/map-style.ts` (แก้) | สี/ลำดับซ้อน/ชื่อฟิลด์ของสองเลเยอร์ใหม่ |
| `src/components/MapViewer.tsx` (แก้) | `pointToLayer` ให้เลเยอร์ Point วาดได้ |
| `package.json` (แก้) | `proj4`, `@types/proj4`, `npm run import:forest` |
| `README.md` (แก้) | เอกสารสองเลเยอร์ใหม่ + ข้อกำหนดฟิลด์ `moo` |

แยก `map-area.ts` ออกจาก `map-forest-prep.ts` เพราะคนละอายุการใช้งาน — ตัวแรกถูก API route โหลดทุกครั้งที่มีคนอัปไฟล์ ตัวหลังตายหลังนำเข้าครั้งแรก

---

## Task 1: เพิ่ม dependency และฟิลด์ `computeArea`

**Files:**
- Modify: `package.json`
- Modify: `src/types/map.ts:96-110`

- [ ] **Step 1: ติดตั้ง proj4**

```bash
npm install proj4 && npm install --save-dev @types/proj4
```

`proj4` เข้า `dependencies` ไม่ใช่ `devDependencies` เพราะ `map-ingest.ts` จะเรียกใช้ และไฟล์นั้นถูก import จาก `src/pages/api/admin/map/layers/[id]/versions.ts` คือรันบนเซิร์ฟเวอร์ตอน production จริง

- [ ] **Step 2: ยืนยันว่า proj4 ใช้ได้ทั้ง CJS และ ESM**

```bash
node -e "const p=require('proj4'); console.log(p('EPSG:4326','+proj=utm +zone=47 +datum=WGS84 +units=m +no_defs',[98.902408,18.713236]).map(n=>n.toFixed(0)))"
```

Expected: `[ '489711', '2069101' ]`

Pages Router คอมไพล์ API route เป็น CJS จึงต้องผ่านทาง `require()` ได้ (นี่คือจุดที่ `shpjs` พังและเป็นเหตุผลที่ห้ามเอา shpjs เข้ามาในเส้นทางนี้)

- [ ] **Step 3: เพิ่มฟิลด์ลง `MapLayer`**

ใน `src/types/map.ts` หา `export type MapLayer = {` แล้วเพิ่มบรรทัดต่อจาก `publicFields`:

```ts
export type MapLayer = {
  id: string;
  title: string;
  description?: string;
  geometryType: GeometryKind;
  keyFields: string[];
  keyComposition: string[][]; // ตั้งได้เมื่อ keyFields.length === 1 เท่านั้น
  visibility: 'public' | 'staff';
  publicFields: string[]; // [] = เปิดแค่รูปทรง ไม่เปิด properties เลย
  /**
   * เติม area_rai/area_km2 ให้ทุก feature ตอน ingest — ตั้งได้เฉพาะเลเยอร์รูปปิด
   *
   * อยู่ที่ pipeline ไม่ใช่ที่สคริปต์นำเข้า เพราะไฟล์ที่เจ้าหน้าที่ export จาก QGIS
   * มาลากวางเองจะไม่มีฟิลด์นี้ ถ้าให้สคริปต์เป็นคนเติม การอัปเดตครั้งถัดไปจะทำให้
   * ตัวเลขไร่หายจากหน้าเว็บเงียบ ๆ (field-removed เป็นแค่ warning ไม่บล็อกการเผยแพร่)
   */
  computeArea?: boolean;
  currentVersionNo: number | null;
  order: number;
  updatedAt: string;
  updatedBy: string;
};
```

- [ ] **Step 4: ยืนยันว่าไม่มีอะไรพัง**

```bash
npx tsc --noEmit && npm test
```

Expected: ไม่มี error, เทสต์เดิมผ่านทั้งหมด (ฟิลด์เป็น optional จึงไม่กระทบเลเยอร์เดิม)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/types/map.ts
git commit -m "feat(map): เพิ่ม proj4 และฟิลด์ computeArea บน MapLayer"
```

---

## Task 2: `map-area.ts` — คำนวณพื้นที่

**Files:**
- Create: `src/lib/map-area.ts`
- Test: `src/lib/map-area.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/map-area.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { polygonAreaRai, ringAreaUtm, withArea } from '@/lib/map-area';
import type { Feature, FeatureCollection, Geometry } from '@/types/map';

// สี่เหลี่ยม 40×40 เมตรในพิกัด UTM = 1,600 ตร.ม. = 1 ไร่ ก่อนถอด scale factor
const SQUARE_40M_UTM = [
  [500000, 2000000],
  [500040, 2000000],
  [500040, 2000040],
  [500000, 2000040],
];

// ขอบเขตป่าชุมชนหมู่ 10 (ตัดมาบางส่วน) — พิกัด lon/lat จริงจากไฟล์
const forestRing = (): number[][] => [
  [98.8678206, 18.68310982],
  [98.86655833, 18.68437425],
  [98.86800000, 18.68500000],
];

const fc = (features: Feature[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});
const poly = (geometry: Geometry | null, props: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  geometry,
  properties: props,
});

describe('ringAreaUtm', () => {
  it('ถอด scale factor ของ UTM ออก — 1,600 ตร.ม. บนกระดาษคือ 1,601.2808 ตร.ม. บนพื้นโลก', () => {
    expect(ringAreaUtm(SQUARE_40M_UTM)).toBeCloseTo(1601.2808, 4);
  });

  it('วงเปิดกับวงปิดให้ค่าเท่ากันเป๊ะ', () => {
    const closed = [...SQUARE_40M_UTM, SQUARE_40M_UTM[0]];
    expect(ringAreaUtm(closed)).toBe(ringAreaUtm(SQUARE_40M_UTM));
  });

  it('ทิศทางการวนของวง (ตามเข็ม/ทวนเข็ม) ไม่ทำให้พื้นที่ติดลบ', () => {
    expect(ringAreaUtm([...SQUARE_40M_UTM].reverse())).toBeCloseTo(1601.2808, 4);
  });
});

describe('polygonAreaRai', () => {
  it('คืน null เมื่อไม่มีรูปทรงหรือรูปทรงไม่ใช่รูปปิด', () => {
    expect(polygonAreaRai(null)).toBeNull();
    expect(polygonAreaRai({ type: 'Point', coordinates: [98.8, 18.7] })).toBeNull();
    expect(
      polygonAreaRai({ type: 'LineString', coordinates: [[98.8, 18.7], [98.9, 18.8]] })
    ).toBeNull();
  });

  it('MultiPolygon = ผลรวมของทุกวง', () => {
    const one = polygonAreaRai({ type: 'Polygon', coordinates: [forestRing()] })!;
    const two = polygonAreaRai({
      type: 'MultiPolygon',
      coordinates: [[forestRing()], [forestRing()]],
    })!;
    expect(two.rai).toBeCloseTo(one.rai * 2, 1);
  });

  it('วงในถูกหักออกจากวงนอก ไม่ใช่บวกเพิ่ม', () => {
    const outer = [
      [98.86, 18.68],
      [98.87, 18.68],
      [98.87, 18.69],
      [98.86, 18.69],
    ];
    const hole = [
      [98.862, 18.682],
      [98.864, 18.682],
      [98.864, 18.684],
      [98.862, 18.684],
    ];
    const solid = polygonAreaRai({ type: 'Polygon', coordinates: [outer] })!;
    const holed = polygonAreaRai({ type: 'Polygon', coordinates: [outer, hole] })!;
    expect(holed.rai).toBeLessThan(solid.rai);
  });

  it('ปัดเศษตายตัว — ไร่ 2 ตำแหน่ง ตร.กม. 4 ตำแหน่ง', () => {
    const a = polygonAreaRai({ type: 'Polygon', coordinates: [forestRing()] })!;
    expect(a.rai).toBe(Number(a.rai.toFixed(2)));
    expect(a.km2).toBe(Number(a.km2.toFixed(4)));
  });
});

describe('withArea', () => {
  it('เติม area_rai/area_km2 ให้ทุก feature ที่เป็นรูปปิด', () => {
    const out = withArea(fc([poly({ type: 'Polygon', coordinates: [forestRing()] })]));
    expect(out.features[0].properties).toMatchObject({
      area_rai: expect.any(Number),
      area_km2: expect.any(Number),
    });
  });

  it('ไม่แตะ feature ที่ไม่ใช่รูปปิด — ไม่ใส่ฟิลด์ ไม่ throw', () => {
    const out = withArea(fc([poly({ type: 'Point', coordinates: [98.8, 18.7] }, { a: 1 })]));
    expect(out.features[0].properties).toEqual({ a: 1 });
  });

  it('เขียนทับค่าที่ติดมากับไฟล์ ไม่ปล่อยของเดิมไว้', () => {
    const out = withArea(
      fc([poly({ type: 'Polygon', coordinates: [forestRing()] }, { area_rai: 99999 })])
    );
    expect(out.features[0].properties!.area_rai).not.toBe(99999);
  });

  it('เรียกซ้ำได้ค่าเดิมทุกบิต — คือหลักฐานว่า sha256 จะคงที่', () => {
    const once = withArea(fc([poly({ type: 'Polygon', coordinates: [forestRing()] })]));
    expect(JSON.stringify(withArea(once))).toBe(JSON.stringify(once));
  });

  it('ไม่แก้ของเดิม คืนก้อนใหม่', () => {
    const input = fc([poly({ type: 'Polygon', coordinates: [forestRing()] })]);
    withArea(input);
    expect(input.features[0].properties).toEqual({});
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/map-area.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/map-area"`

- [ ] **Step 3: เขียนโค้ดให้ผ่าน**

สร้าง `src/lib/map-area.ts`:

```ts
import proj4 from 'proj4';
import type { FeatureCollection, Geometry } from '@/types/map';

// พื้นที่ของรูปปิด — คิดบนพิกัด UTM zone 47N ไม่ใช่บน lon/lat โดยตรง
//
// ทำไมไม่ใช้สูตร spherical excess ที่ไม่ต้องแปลงพิกัด: มันคิดบนทรงกลมรัศมี
// ศูนย์สูตร ซึ่งเกินจริงที่ละติจูด 18.7°N อยู่ราว 0.5% — บนป่าหมู่ 11 คือ ~10 ไร่
// มากพอที่จะไม่ควรปัดทิ้งบนพอร์ทัลราชการ ส่วน UTM 47N เป็นระบบพิกัดต้นฉบับที่
// รังวัดมาจริง เป็น conformal projection และตำบลน้ำแพร่อยู่แทบตรงเมริเดียนกลาง
// ของโซนพอดี (98.89°E เทียบกับ 99°E) ความผิดเพี้ยนจึงเหลือแค่ scale factor
// ตัวเดียวที่ถอดออกได้ตรง ๆ
//
// ตัวเลขที่ได้คือ "พื้นที่จากรูปทรงที่วาดไว้" ไม่ใช่เนื้อที่ตามทะเบียนของกรมป่าไม้
// ป้ายกำกับที่หน้าเว็บจึงต้องเขียนว่า "โดยประมาณ" เสมอ (ดู FIELD_LABELS)

const UTM47N = '+proj=utm +zone=47 +datum=WGS84 +units=m +no_defs';

/** scale factor ที่เมริเดียนกลางของ UTM ทุกโซน — พื้นที่ย่อลงตามกำลังสองของมัน */
const K0 = 0.9996;

const SQM_PER_RAI = 1600;

/**
 * shoelace บนพิกัดเมตร แล้วถอด scale factor ออก — คืนหน่วยตารางเมตร
 *
 * ใช้ `% length` ปิดวงเอง จึงรับได้ทั้งวงเปิดและวงปิด (จุดแรก = จุดสุดท้าย) โดยได้
 * ค่าเท่ากัน — ส่วนที่วนกลับจากจุดสุดท้ายมาจุดแรกของวงปิดคือจุดเดียวกัน พจน์นั้น
 * จึงเป็นศูนย์พอดี ไม่ต้องเดาว่าไฟล์ที่รับมาปิดวงมาให้หรือยัง
 */
export function ringAreaUtm(ringUtm: number[][]): number {
  let sum = 0;
  for (let i = 0; i < ringUtm.length; i += 1) {
    const [x1, y1] = ringUtm[i];
    const [x2, y2] = ringUtm[(i + 1) % ringUtm.length];
    sum += x1 * y2 - x2 * y1;
  }
  // ค่าสัมบูรณ์เพราะเครื่องหมายบอกแค่ทิศทางการวนของวง ไม่ใช่ขนาด
  return Math.abs(sum / 2) / (K0 * K0);
}

/**
 * พื้นที่ของรูปปิดหนึ่ง feature — คืน null ถ้าไม่ใช่รูปปิด
 *
 * ไม่ throw เมื่อเจอรูปทรงผิดชนิด เพราะด่าน geometry-type-mismatch เป็นคนรายงาน
 * เรื่องนั้นอยู่แล้ว การ throw ที่นี่จะทำให้ทั้งไฟล์อัปไม่ได้ด้วยข้อความที่ชี้ผิดที่
 */
export function polygonAreaRai(
  geometry: Geometry | null
): { rai: number; km2: number } | null {
  const polygons = ringsOf(geometry);
  if (!polygons) return null;

  const sqm = polygons.reduce(
    (total, rings) =>
      total +
      rings.reduce((sum, ring, i) => {
        const utm = ring.map((c) => proj4('EPSG:4326', UTM47N, c));
        // วงแรกคือขอบนอก วงที่เหลือคือรู ต้องหักออกไม่ใช่บวกเพิ่ม
        return i === 0 ? sum + ringAreaUtm(utm) : sum - ringAreaUtm(utm);
      }, 0),
    0
  );

  // ปัดเศษตายตัว ไม่ใช่เพื่อความสวย — ถ้าปล่อยทศนิยม float เต็มความละเอียด
  // sha256 ของไฟล์เดิมจะเปลี่ยนทุกครั้งที่อัปซ้ำ แล้วตรรกะ "ข้ามถ้า sha ตรง"
  // กับด่าน identical จะใช้ไม่ได้อีกเลย
  return {
    rai: round(sqm / SQM_PER_RAI, 2),
    km2: round(sqm / 1_000_000, 4),
  };
}

/** เติม area_rai/area_km2 ให้ทุก feature ที่เป็นรูปปิด — ไม่แก้ของเดิม */
export function withArea(fc: FeatureCollection): FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => {
      const area = polygonAreaRai(f.geometry);
      if (!area) return f;
      return {
        ...f,
        // เขียนทับของที่ติดมากับไฟล์เสมอ — ตัวเลขที่ใครแก้ด้วยมือแล้วไม่ตรงกับ
        // รูปทรงที่วาดอยู่ ไม่ควรหลุดขึ้นเว็บ
        properties: { ...f.properties, area_rai: area.rai, area_km2: area.km2 },
      };
    }),
  };
}

/** วงพิกัดของรูปปิด — null ถ้า geometry ไม่ใช่ Polygon/MultiPolygon */
function ringsOf(geometry: Geometry | null): number[][][][] | null {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') return [geometry.coordinates as number[][][]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as number[][][][];
  return null;
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/map-area.test.ts`
Expected: PASS ทั้ง 12 เทสต์

- [ ] **Step 5: Commit**

```bash
git add src/lib/map-area.ts src/lib/map-area.test.ts
git commit -m "feat(map): คำนวณพื้นที่ไร่/ตร.กม. จากรูปปิดบนพิกัด UTM 47N"
```

---

## Task 3: ต่อ `withArea` เข้า pipeline

**Files:**
- Modify: `src/lib/map-ingest.ts:41-55`
- Test: `src/lib/map-ingest.test.ts` (สร้าง)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/map-ingest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ingestMapFile } from '@/lib/map-ingest';
import type { MapLayer } from '@/types/map';

// รูปสามเหลี่ยมเล็ก ๆ ในเขตตำบลน้ำแพร่ — ต้องอยู่ในไทยไม่งั้นติดด่าน outside-thailand
const TRIANGLE = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [98.86, 18.68],
            [98.87, 18.68],
            [98.87, 18.69],
          ],
        ],
      },
      properties: { moo: '10' },
    },
  ],
});

const layer = (over: Partial<MapLayer> = {}): MapLayer => ({
  id: 'community-forest',
  title: 'ป่าชุมชน',
  geometryType: 'Polygon',
  keyFields: ['moo'],
  keyComposition: [],
  visibility: 'public',
  publicFields: [],
  currentVersionNo: null,
  order: 5,
  updatedAt: '2026-08-14T00:00:00.000Z',
  updatedBy: 'test',
  ...over,
});

describe('ingestMapFile: computeArea', () => {
  it('เติม area_rai/area_km2 เมื่อเลเยอร์ตั้ง computeArea', () => {
    const r = ingestMapFile({
      text: TRIANGLE,
      fileName: 'forest.geojson',
      layer: layer({ computeArea: true }),
      previous: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fc.features[0].properties).toMatchObject({
      area_rai: expect.any(Number),
      area_km2: expect.any(Number),
    });
  });

  it('ไม่แตะ properties เลยเมื่อไม่ได้ตั้ง computeArea', () => {
    const r = ingestMapFile({
      text: TRIANGLE,
      fileName: 'forest.geojson',
      layer: layer(),
      previous: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fc.features[0].properties).toEqual({ moo: '10' });
  });

  it('area เข้าไปอยู่ใน stats ด้วย — คือหลักฐานว่าเติมก่อน computeStats', () => {
    const r = ingestMapFile({
      text: TRIANGLE,
      fileName: 'forest.geojson',
      layer: layer({ computeArea: true }),
      previous: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.fields.map((f) => f.name)).toContain('area_rai');
  });

  it('sha256 ต่างกันระหว่างเปิดกับปิด flag แต่คงที่เมื่อเรียกซ้ำด้วย flag เดิม', () => {
    const run = (computeArea: boolean) => {
      const r = ingestMapFile({
        text: TRIANGLE,
        fileName: 'forest.geojson',
        layer: layer({ computeArea }),
        previous: null,
      });
      if (!r.ok) throw new Error(r.message);
      return r.sha256;
    };
    expect(run(true)).not.toBe(run(false));
    expect(run(true)).toBe(run(true));
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/map-ingest.test.ts`
Expected: FAIL — เทสต์แรกฟ้องว่าไม่มี `area_rai` ใน properties

- [ ] **Step 3: แก้ `map-ingest.ts`**

เพิ่ม import ที่หัวไฟล์:

```ts
import { withArea } from '@/lib/map-area';
```

แล้วเปลี่ยนช่วงหลัง `parseMapFile` จากเดิม:

```ts
  const { fc } = parsed;
  const stats = computeStats(fc);
  const sha256 = sha256OfFeatureCollection(fc);
```

เป็น:

```ts
  // เติมพื้นที่ก่อนนับสถิติและก่อนคิด sha256 — ฟิลด์ที่เกิดทีหลังจะไม่เข้าไปอยู่ใน
  // stats (ด่าน field-removed/new-value ของเวอร์ชันหน้าเทียบกับ stats ไม่ใช่กับไฟล์)
  // และไฟล์ที่ผู้เรียกเอาไปอัปขึ้น Cloudinary คือ fc ก้อนนี้ ไม่ใช่ก้อนที่ parse มา
  const fc = args.layer.computeArea ? withArea(parsed.fc) : parsed.fc;
  const stats = computeStats(fc);
  const sha256 = sha256OfFeatureCollection(fc);
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/map-ingest.test.ts`
Expected: PASS ทั้ง 4 เทสต์

- [ ] **Step 5: ยืนยันว่าเลเยอร์เดิมไม่กระทบ**

Run: `npm test`
Expected: PASS ทั้งหมด — เลเยอร์เดิมไม่มี `computeArea` จึงเดินทางเดิมทุกประการ

- [ ] **Step 6: Commit**

```bash
git add src/lib/map-ingest.ts src/lib/map-ingest.test.ts
git commit -m "feat(map): pipeline เติมพื้นที่ให้เลเยอร์ที่ตั้ง computeArea"
```

---

## Task 4: `map-forest-prep.ts` — แกะและซ่อมซิป

**Files:**
- Create: `src/lib/map-forest-prep.ts`
- Test: `src/lib/map-forest-prep.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/map-forest-prep.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildForestLayers,
  needsUtmFix,
  pickSubLayer,
  reprojectUtm47N,
  tagAndClean,
} from '@/lib/map-forest-prep';
import type { Feature, FeatureCollection } from '@/types/map';

const named = (fileName: string, features: Feature[]): FeatureCollection & {
  fileName: string;
} => ({ type: 'FeatureCollection', fileName, features });

const pt = (coords: number[], props: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: coords },
  properties: props,
});
const ring = (): number[][] => [
  [98.86, 18.68],
  [98.87, 18.68],
  [98.87, 18.69],
];
const pg = (props: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [ring()] },
  properties: props,
});

describe('pickSubLayer', () => {
  const parts = [
    named('Shapefiles/พิกัดป่าชุมชนหมู่ 10', [pt([98.86, 18.68], { point_n: 1 })]),
    named('Shapefiles/พิกัดป่าชุมชนหมู่ 10_polygon1', [pg({ begin: 1 })]),
  ];

  it('เลือกไฟล์ตามชื่อเต็มท้ายเส้นทาง', () => {
    expect(pickSubLayer(parts, 'พิกัดป่าชุมชนหมู่ 10_polygon1').features).toHaveLength(1);
  });

  // กับดักตัวจริง: "…หมู่ 10" เป็นสตริงนำหน้าของ "…หมู่ 10_polygon1" พอดี
  // ถ้าใครเปลี่ยนไปใช้ includes() เทสต์นี้จะจับได้ทันที
  it('ไม่คว้าไฟล์ที่ชื่อขึ้นต้นเหมือนกันแต่ยาวกว่า', () => {
    const got = pickSubLayer(parts, 'พิกัดป่าชุมชนหมู่ 10');
    expect(got.features[0].geometry!.type).toBe('Point');
  });

  it('throw เมื่อไม่เจอ ไม่ใช่คืนค่าว่างเงียบ ๆ', () => {
    expect(() => pickSubLayer(parts, 'ไม่มีไฟล์นี้')).toThrow(/ไม่พบ/);
  });
});

describe('needsUtmFix', () => {
  it('จับได้ว่าพิกัดเป็น UTM ดิบ', () => {
    expect(needsUtmFix(named('x', [pt([489711, 2069101])]))).toBe(true);
  });

  it('ไฟล์ที่แปลงมาถูกแล้วต้องไม่ถูกแตะ', () => {
    expect(needsUtmFix(named('x', [pt([98.902408, 18.713236])]))).toBe(false);
  });

  it('ไฟล์ว่างไม่ถือว่าต้องซ่อม', () => {
    expect(needsUtmFix(named('x', []))).toBe(false);
  });
});

describe('reprojectUtm47N', () => {
  it('แปลง UTM 47N เป็น lon/lat ได้ค่าที่ตรวจกับไฟล์จริงแล้ว', () => {
    const out = reprojectUtm47N(named('x', [pt([489711, 2069101])]));
    const [lon, lat] = out.features[0].geometry!.coordinates as number[];
    expect(lon).toBeCloseTo(98.902408, 5);
    expect(lat).toBeCloseTo(18.713236, 5);
  });

  it('ไม่แก้ของเดิม คืนก้อนใหม่', () => {
    const input = named('x', [pt([489711, 2069101])]);
    reprojectUtm47N(input);
    expect(input.features[0].geometry!.coordinates).toEqual([489711, 2069101]);
  });
});

describe('tagAndClean', () => {
  it('เติม moo และเก็บเฉพาะฟิลด์ที่สั่งให้เก็บ', () => {
    const out = tagAndClean(
      named('x', [pt([98.86, 18.68], { point_n: 7, E: 489711, N: 2069101 })]),
      '10',
      ['point_n']
    );
    expect(out.features[0].properties).toEqual({ moo: '10', point_n: 7 });
  });

  it('moo เป็นสตริง ไม่ใช่ตัวเลข — คีย์ประกอบเทียบด้วยสตริง', () => {
    const out = tagAndClean(named('x', [pg({ begin: 1 })]), '11', []);
    expect(out.features[0].properties).toEqual({ moo: '11' });
  });
});

describe('buildForestLayers', () => {
  const parts = [
    named('Shapefiles/พิกัดป่าชุมชนหมู่ 10', [
      pt([98.86, 18.68], { point_n: 1, E: 1, N: 2 }),
      pt([98.87, 18.69], { point_n: 2, E: 1, N: 2 }),
    ]),
    named('Shapefiles/พิกัดป่าชุมชนหมู่ 10_polygon1', [pg({ begin: 1, end: 2 })]),
    named('Shapefiles/พิกัดป่าชุมชนหมู่ 11_point', [pt([489711, 2069101], { point_n: 1 })]),
    named('Shapefiles/พิกัดป่าชุมชนหมู่ 11_polygon', [pg({ id: 1 })]),
  ];

  it('แยกเป็นสองเลเยอร์ ขอบเขต 2 รายการ หมุด 3 รายการ', () => {
    const { boundary, points } = buildForestLayers(parts);
    expect(boundary.features).toHaveLength(2);
    expect(points.features).toHaveLength(3);
  });

  it('ขอบเขตมีแต่รูปปิด หมุดมีแต่จุด', () => {
    const { boundary, points } = buildForestLayers(parts);
    expect([...new Set(boundary.features.map((f) => f.geometry!.type))]).toEqual(['Polygon']);
    expect([...new Set(points.features.map((f) => f.geometry!.type))]).toEqual(['Point']);
  });

  it('ซ่อมพิกัดของหมู่ 11 ให้ตกในไทย', () => {
    const { points } = buildForestLayers(parts);
    for (const f of points.features) {
      const [lon, lat] = f.geometry!.coordinates as number[];
      expect(lon).toBeGreaterThan(97);
      expect(lon).toBeLessThan(101);
      expect(lat).toBeGreaterThan(5);
      expect(lat).toBeLessThan(21);
    }
  });

  it('คีย์ประกอบ (moo, point_n) ไม่ซ้ำกันสักคู่', () => {
    const { points } = buildForestLayers(parts);
    const keys = points.features.map(
      (f) => `${f.properties!.moo}|${f.properties!.point_n}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('ฟิลด์ขยะถูกตัดหมด', () => {
    const { boundary, points } = buildForestLayers(parts);
    for (const f of [...boundary.features, ...points.features]) {
      expect(Object.keys(f.properties!)).not.toContain('begin');
      expect(Object.keys(f.properties!)).not.toContain('end');
      expect(Object.keys(f.properties!)).not.toContain('id');
      expect(Object.keys(f.properties!)).not.toContain('E');
      expect(Object.keys(f.properties!)).not.toContain('N');
    }
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/map-forest-prep.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/map-forest-prep"`

- [ ] **Step 3: เขียนโค้ดให้ผ่าน**

สร้าง `src/lib/map-forest-prep.ts`:

```ts
import proj4 from 'proj4';
import type { Feature, FeatureCollection } from '@/types/map';

// เตรียมไฟล์ป่าชุมชนจากซิปต้นทางให้พร้อมเข้า ingestMapFile
//
// งานเฉพาะกิจของไฟล์ชุดเดียว ไม่ใช่ความสามารถถาวรของระบบ — ทางเข้าปกติที่
// /admin/map ยังปฏิเสธไฟล์ที่ระบบพิกัดผิดเหมือนเดิม (ดู map-parse.ts) การเดา CRS
// แทนคนเป็นสิ่งที่ระบบไม่ควรทำ แต่ที่นี่เรารู้ที่มาของไฟล์แน่ชัดและตรวจด้วยตาแล้ว
// ว่า .prj ตัวไหนโกหก
//
// แยกจาก map-area.ts เพราะคนละอายุการใช้งาน: map-area อยู่ในเส้นทางที่ API route
// โหลดทุกครั้งที่มีคนอัปไฟล์ ส่วนไฟล์นี้ตายหลังนำเข้าครั้งแรกเสร็จ

const UTM47N = '+proj=utm +zone=47 +datum=WGS84 +units=m +no_defs';

/** ชื่อไฟล์ที่ shpjs แปะมาให้แต่ละ sub-layer (ไม่รวมโฟลเดอร์นำหน้า) */
export type NamedCollection = FeatureCollection & { fileName?: string };

type ForestSource = {
  baseName: string;
  moo: string;
  keep: string[];
};

/**
 * allow-list ตายตัว — ไม่ใช่การไล่หาเอาเองจากรูปทรง
 *
 * ซิปมี 7 sub-layer แต่ใช้จริง 4: อีกสามคือขอบเขตเดิมในรูปแบบเส้น (ซ้ำกับรูปปิด)
 * และไฟล์หมุดของหมู่ 11 ที่ว่างเปล่า 0 รายการ ถ้าปล่อยให้สคริปต์เดาเอาจากชนิด
 * รูปทรง วันที่ต้นทางส่งไฟล์ชุดใหม่มาโครงสร้างต่างไปนิดเดียวก็จะได้ข้อมูลผิดชุด
 * โดยไม่มีอะไรเตือน
 */
export const BOUNDARY_SOURCES: ForestSource[] = [
  { baseName: 'พิกัดป่าชุมชนหมู่ 10_polygon1', moo: '10', keep: [] },
  { baseName: 'พิกัดป่าชุมชนหมู่ 11_polygon', moo: '11', keep: [] },
];

export const POINT_SOURCES: ForestSource[] = [
  { baseName: 'พิกัดป่าชุมชนหมู่ 10', moo: '10', keep: ['point_n'] },
  { baseName: 'พิกัดป่าชุมชนหมู่ 11_point', moo: '11', keep: ['point_n'] },
];

/**
 * หา sub-layer จากชื่อไฟล์ — ต้องเทียบด้วย endsWith เท่านั้น
 *
 * "พิกัดป่าชุมชนหมู่ 10" เป็นสตริงนำหน้าของ "พิกัดป่าชุมชนหมู่ 10_polygon1" พอดี
 * includes() จึงคว้าไฟล์รูปปิดมาเป็นเลเยอร์หมุดโดยไม่มีอะไรเตือน
 *
 * ชื่อในซิปเป็น NFC ตรงกับ string literal ที่นี่ และอักษรไทยไม่ decompose ตอน NFD
 * จึงไม่ต้อง normalize ก่อนเทียบ
 */
export function pickSubLayer(
  parts: NamedCollection[],
  baseName: string
): FeatureCollection {
  const found = parts.find((p) => (p.fileName ?? '').endsWith(baseName));
  if (!found) {
    throw new Error(
      `ไม่พบ shapefile ชื่อ "${baseName}" ในซิป — มีอยู่: ` +
        parts.map((p) => p.fileName ?? '(ไม่มีชื่อ)').join(', ')
    );
  }
  return found;
}

/**
 * ไฟล์นี้ยังเป็นพิกัด UTM ดิบอยู่ไหม
 *
 * ตรวจก่อนแปลง ไม่ใช่แปลงทื่อ ๆ ตามชื่อไฟล์ — วันหน้าถ้าต้นทาง export
 * "พิกัดป่าชุมชนหมู่ 11_point" มาใหม่โดย .prj ถูกต้อง สคริปต์จะต้องไม่แปลงซ้ำ
 * จนพิกัดหลุดออกนอกทวีป
 */
export function needsUtmFix(fc: FeatureCollection): boolean {
  const first = fc.features[0]?.geometry?.coordinates;
  const lon = firstLon(first);
  return lon !== null && Math.abs(lon) > 180;
}

/** แปลง EPSG:32647 (UTM 47N) เป็น lon/lat — คืนก้อนใหม่ ไม่แก้ของเดิม */
export function reprojectUtm47N(fc: FeatureCollection): FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => ({
      ...f,
      geometry: f.geometry
        ? {
            ...f.geometry,
            coordinates: mapCoords(f.geometry.coordinates, (c) =>
              proj4(UTM47N, 'EPSG:4326', c)
            ),
          }
        : null,
    })),
  };
}

/**
 * เติม moo แล้วเก็บเฉพาะฟิลด์ใน keep
 *
 * moo เก็บเป็นสตริงเพราะ featureKey() ประกอบคีย์ด้วยสตริง ถ้าปนตัวเลขกับสตริง
 * ระหว่างเวอร์ชัน การเทียบส่วนต่างจะมองเป็นคนละรายการทั้งที่เป็นอันเดียวกัน
 *
 * ตัด begin/end/id (ค่าที่ QGIS แจกเอง ไม่มีความหมายกับใคร) และ E/N (พิกัด UTM
 * ที่ซ้ำกับ geometry อยู่แล้ว เก็บไว้ก็มีแต่จะขัดกันเองเมื่อขอบเขตถูกแก้)
 */
export function tagAndClean(
  fc: FeatureCollection,
  moo: string,
  keep: string[]
): FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => {
      const props: Record<string, unknown> = { moo };
      for (const k of keep) {
        if (f.properties?.[k] !== undefined) props[k] = f.properties[k];
      }
      return { ...f, properties: props };
    }),
  };
}

/** ประกอบสองเลเยอร์จาก sub-layer ทั้งหมดในซิป */
export function buildForestLayers(parts: NamedCollection[]): {
  boundary: FeatureCollection;
  points: FeatureCollection;
} {
  return {
    boundary: collect(parts, BOUNDARY_SOURCES),
    points: collect(parts, POINT_SOURCES),
  };
}

function collect(
  parts: NamedCollection[],
  sources: ForestSource[]
): FeatureCollection {
  const features: Feature[] = [];
  for (const src of sources) {
    let fc = pickSubLayer(parts, src.baseName);
    if (needsUtmFix(fc)) fc = reprojectUtm47N(fc);
    features.push(...tagAndClean(fc, src.moo, src.keep).features);
  }
  return { type: 'FeatureCollection', features };
}

/** ลองจนเจอตัวเลขตัวแรกในโครงพิกัดที่ซ้อนกันกี่ชั้นก็ได้ */
function firstLon(coords: unknown): number | null {
  if (typeof coords === 'number') return coords;
  if (Array.isArray(coords)) {
    for (const c of coords) {
      const v = firstLon(c);
      if (v !== null) return v;
    }
  }
  return null;
}

/** เดินโครงพิกัดที่ซ้อนกันกี่ชั้นก็ได้ แล้วแทนที่คู่ [x, y] ทีละคู่ */
function mapCoords(coords: unknown, fn: (c: number[]) => number[]): unknown {
  if (Array.isArray(coords) && typeof coords[0] === 'number') {
    return fn(coords as number[]);
  }
  if (Array.isArray(coords)) return coords.map((c) => mapCoords(c, fn));
  return coords;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/map-forest-prep.test.ts`
Expected: PASS ทั้ง 14 เทสต์

- [ ] **Step 5: Commit**

```bash
git add src/lib/map-forest-prep.ts src/lib/map-forest-prep.test.ts
git commit -m "feat(map): แกะและซ่อมซิปป่าชุมชนเป็นสองเลเยอร์"
```

---

## Task 5: สคริปต์นำเข้า

**Files:**
- Create: `scripts/import-community-forest.mts` (**นามสกุล `.mts` ไม่ใช่ `.ts`** — ดูเหตุผลท้ายหัวข้อ)
- Modify: `package.json` (scripts)

- [ ] **Step 1: เขียนสคริปต์**

สร้าง `scripts/import-community-forest.mts`:

```ts
// ต้องเป็น import แรกสุด — ดูเหตุผลใน scripts/load-env.ts
import './load-env';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import shp from 'shpjs';
// path แบบ relative ไม่ใช่ alias @/ — tsx ไม่ resolve paths ใน tsconfig ให้
import {
  isCloudinaryConfigured,
  MAP_FOLDER_FULL,
  uploadRawText,
} from '../src/lib/cloudinary';
import { buildForestLayers, type NamedCollection } from '../src/lib/map-forest-prep';
import { ingestMapFile } from '../src/lib/map-ingest';
import {
  buildNewVersion,
  getLayer,
  insertVersion,
  listVersions,
  nextVersionNo,
  upsertLayer,
} from '../src/lib/map-store';
import type { FeatureCollection, MapLayer } from '../src/types/map';

// นำเข้าป่าชุมชนหมู่ 10 และ 11 จากซิป shapefile ครั้งแรก
//
//   npm run import:forest
//
// สามข้อที่ตั้งใจ เหมือน import-map-layers.ts:
//   1. ปล่อยทุกเวอร์ชันไว้เป็น "ร่าง" ไม่เผยแพร่ให้อัตโนมัติ — publicFields ที่
//      สคริปต์ตั้งให้เป็นแค่ข้อเสนอ การเปิดข้อมูลสู่สาธารณะไม่ควรเป็นผลข้างเคียง
//      ของการรันสคริปต์
//   2. รันซ้ำได้ — sha256 ตรงกับเวอร์ชันที่มีอยู่แล้วก็ข้าม
//   3. เดินผ่าน ingestMapFile ตัวเดียวกับ API route ไม่ให้สคริปต์กลายเป็นทางลัด
//      ที่ข้ามด่านตรวจไปโดยไม่มีใครรู้
//
// สคริปต์ไม่คำนวณพื้นที่เอง — ingestMapFile ทำให้ตาม flag computeArea ของเลเยอร์
// เพื่อให้ไฟล์ที่เจ้าหน้าที่ลากวางเองในอนาคตได้ผลเท่ากันเป๊ะ

const ZIP = path.join(process.cwd(), 'public', 'Shapefiles ป่าชุมชน.zip');
const ACTOR = 'import-community-forest';

type Seed = {
  key: 'boundary' | 'points';
  layer: Omit<MapLayer, 'updatedAt' | 'updatedBy' | 'currentVersionNo'>;
};

const SEEDS: Seed[] = [
  {
    key: 'boundary',
    layer: {
      id: 'community-forest',
      title: 'ป่าชุมชน',
      description: 'ขอบเขตป่าชุมชนหมู่ 10 และหมู่ 11',
      geometryType: 'Polygon',
      keyFields: ['moo'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['moo', 'area_rai', 'area_km2'],
      computeArea: true,
      order: 5,
    },
  },
  {
    key: 'points',
    layer: {
      id: 'community-forest-point',
      title: 'หมุดพิกัดป่าชุมชน',
      description: 'หมุดพิกัดที่รังวัดขอบเขตป่าชุมชน',
      geometryType: 'Point',
      // point_n เป็น 1–59 ในหมู่ 10 และ 1–117 ในหมู่ 11 → ซ้ำข้ามหมู่ 59 ค่า
      // ต้องคู่กับ moo ถึงจะเป็นตัวตนของแต่ละหมุดได้จริง
      keyFields: ['moo', 'point_n'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['moo', 'point_n'],
      order: 6,
    },
  },
];

async function main(): Promise<void> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'ยังไม่ได้ตั้งค่า Cloudinary — คลังไฟล์แผนที่ต้องมีที่เก็บไฟล์ กรอก CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET ก่อน'
    );
  }

  process.stdout.write(`อ่าน ${ZIP}\n`);
  const buf = readFileSync(ZIP);
  const raw = await shp(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const parts = (Array.isArray(raw) ? raw : [raw]) as NamedCollection[];
  process.stdout.write(`   พบ ${parts.length} ชั้นข้อมูลในซิป\n`);

  const built = buildForestLayers(parts);

  for (const seed of SEEDS) {
    const fc: FeatureCollection = built[seed.key];
    process.stdout.write(`\n── ${seed.layer.title} (${seed.layer.id})\n`);

    const existing = await getLayer(seed.layer.id);
    const layer: MapLayer = existing ?? {
      ...seed.layer,
      currentVersionNo: null,
      updatedAt: new Date().toISOString(),
      updatedBy: ACTOR,
    };
    if (!existing) await upsertLayer(layer);

    // ส่งเป็นข้อความ GeoJSON เข้า ingestMapFile เหมือนทางที่ API route เดิน
    const text = JSON.stringify(fc);
    const fileName = `${seed.layer.id}.geojson`;
    const result = ingestMapFile({ text, fileName, layer, previous: null });
    if (!result.ok) {
      process.stdout.write(`   ✗ ${result.message}\n`);
      continue;
    }

    const versions = await listVersions(layer.id);
    if (versions.some((v) => v.source.sha256 === result.sha256)) {
      process.stdout.write('   – เนื้อข้อมูลตรงกับเวอร์ชันที่มีอยู่แล้ว ข้าม\n');
      continue;
    }
    if (result.blocked) {
      for (const c of result.checks) {
        if (c.level === 'error') process.stdout.write(`   ✗ [error] ${c.message}\n`);
      }
      continue;
    }

    const versionNo = nextVersionNo(versions);
    const uploaded = await uploadRawText(JSON.stringify(result.fc), {
      folder: MAP_FOLDER_FULL,
      publicId: `${layer.id}-v${versionNo}-full.geojson`,
      type: 'authenticated',
    });

    await insertVersion(
      buildNewVersion({
        id: crypto.randomUUID(),
        layerId: layer.id,
        versionNo,
        source: {
          format: result.format,
          fileName,
          bytes: Buffer.byteLength(text, 'utf8'),
          sha256: result.sha256,
        },
        fullAsset: { publicId: uploaded.publicId, bytes: uploaded.bytes },
        stats: result.stats,
        checks: result.checks,
        diff: result.diff,
        uploadedBy: ACTOR,
        now: new Date().toISOString(),
        note: 'นำเข้าครั้งแรกจาก public/Shapefiles ป่าชุมชน.zip',
      })
    );

    process.stdout.write(
      `   ✓ ร่าง v${versionNo} — ${result.stats.featureCount.toLocaleString('th-TH')} รายการ, ` +
        `${result.stats.fields.length} ฟิลด์\n`
    );
    for (const f of result.stats.fields) {
      if (f.name.startsWith('area_')) {
        process.stdout.write(`     ${f.name}: ${(f.values ?? []).join(', ')}\n`);
      }
    }
    for (const c of result.checks) {
      process.stdout.write(`     [${c.level}] ${c.code} ×${c.count}\n`);
    }
  }

  process.stdout.write(
    '\nเสร็จแล้ว — ทุกเวอร์ชันอยู่ในสถานะ "ร่าง"\n' +
      'เปิด /admin/map เพื่อตรวจรายการฟิลด์ที่จะเปิดสาธารณะ แล้วกดเผยแพร่ทีละเลเยอร์\n'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: เพิ่มคำสั่งใน package.json**

ใน `"scripts"` เพิ่มบรรทัดต่อจาก `"import:map"`:

```json
    "import:forest": "tsx scripts/import-community-forest.mts"
```

- [ ] **Step 3: ตรวจว่าคอมไพล์ผ่านและเทสต์ยังเขียว**

```bash
npx tsc --noEmit && npm test && npm run lint
```

Expected: ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add scripts/import-community-forest.mts package.json
git commit -m "feat(map): สคริปต์นำเข้าป่าชุมชนจากซิป shapefile"
```

---

## Task 6: MapViewer วาดเลเยอร์ Point ได้

**Files:**
- Modify: `src/components/MapViewer.tsx:335-345`

- [ ] **Step 1: เพิ่ม `pointToLayer`**

ใน `src/components/MapViewer.tsx` หาบล็อก `const group = L.geoJSON(fc as never, {` แล้วเพิ่ม option ต่อจาก `interactive: false,`:

```ts
      const group = L.geoJSON(fc as never, {
        pane: m.getPane(pane) ? pane : undefined,
        interactive: false,
        style: (f) => styleFor(layer.id, f as Feature | undefined),
        // เลเยอร์รูปจุดต้องบอกวิธีวาดเอง ไม่งั้น Leaflet ตกไปใช้ L.marker ซึ่งเป็น
        // DOM ที่มันบังคับลง markerPane เสมอ — เข้า pane แบบ canvas ที่ตั้งไว้ข้างบน
        // ไม่ได้ แถวไอคอนปริยายยังชี้ไปไฟล์รูปที่ bundler ไม่ได้ copy มาให้ (404)
        // circleMarker เป็น Path จึงวาดด้วย renderer เดียวกับเลเยอร์อื่นทั้งหมด
        pointToLayer: (f, latlng) =>
          L.circleMarker(latlng, {
            radius: 4,
            ...styleFor(layer.id, f as Feature | undefined),
          }),
      });
```

- [ ] **Step 2: ตรวจว่าคอมไพล์ผ่าน**

```bash
npx tsc --noEmit && npm run lint
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add src/components/MapViewer.tsx
git commit -m "feat(map): วาดเลเยอร์รูปจุดด้วย circleMarker"
```

---

## Task 7: สีและป้ายชื่อฟิลด์

**Files:**
- Modify: `src/lib/map-style.ts:17-52` (LAYER_STYLES)
- Modify: `src/lib/map-style.ts` (FIELD_LABELS)

- [ ] **Step 1: เพิ่มสไตล์สองเลเยอร์**

ใน `LAYER_STYLES` เพิ่มต่อจากรายการ `parcel`:

```ts
  'community-forest': {
    color: '#16a34a',
    weight: 2,
    fillColor: '#22c55e',
    // โปร่งพอให้เห็นเรือนยอดไม้ในภาพดาวเทียมข้างใต้ ซึ่งเป็นสิ่งที่คนเปิดเลเยอร์นี้
    // มาเทียบว่าขอบเขตตรงกับป่าจริงไหม
    fillOpacity: 0.25,
    // ใต้ขอบเขตหมู่ (40) ที่ต้องเห็นกรอบเสมอ แต่เหนือถนน (30) — พื้นสีเขียวจะบัง
    // เส้นถนนทั้งเส้นถ้าอยู่ผิดลำดับ
    order: 35,
    defaultOn: true,
  },
  'community-forest-point': {
    color: '#15803d',
    weight: 1,
    fillColor: '#4ade80',
    // จุดต้องทึบถึงจะเห็นบนพื้นป่าที่มันอยู่ข้างใน
    fillOpacity: 0.9,
    order: 50,
    // 176 จุดรกถ้าเปิดมาพร้อมกันตั้งแต่แรก — คนที่ต้องใช้เปิดเองได้
    defaultOn: false,
  },
```

**ไม่เพิ่มลงใน `COLOR_BY`** — ป่ามีแค่สองผืน ถ้าไล่สีตาม `moo` จะได้สีจาก `GROUP_PALETTE` ที่ไม่ตรงกับสีของหมู่เดียวกันในเลเยอร์ `zone-moobang` (ซึ่งไล่จากชุดค่า `Moo 1`–`Moo 11` คนละชุดกัน) แล้วคนอ่านจะเข้าใจว่าเป็นคนละหมู่ — ปัญหาเดียวกับที่คอมเมนต์เหนือ `COLOR_BY` เตือนไว้เรื่อง `zone_id`

- [ ] **Step 2: เพิ่มป้ายชื่อฟิลด์**

ใน `FIELD_LABELS` เพิ่มต่อท้าย:

```ts
  moo: 'หมู่',
  point_n: 'ลำดับหมุด',
  // "โดยประมาณ" ไม่ใช่คำถ่อมตัว — ตัวเลขนี้คำนวณจากรูปทรงที่วาดไว้ ไม่ใช่เนื้อที่
  // ตามทะเบียนของกรมป่าไม้ ถ้าเขียนลอย ๆ ว่า "พื้นที่ (ไร่)" คนจะเอาไปอ้างผิด
  area_rai: 'พื้นที่โดยประมาณ (ไร่)',
  area_km2: 'พื้นที่โดยประมาณ (ตร.กม.)',
```

- [ ] **Step 3: รันเทสต์**

```bash
npx vitest run src/lib/map-style.test.ts && npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/map-style.ts
git commit -m "feat(map): สีและป้ายชื่อฟิลด์ของเลเยอร์ป่าชุมชน"
```

---

## Task 8: รันนำเข้าจริงและตรวจด้วยตา

ขั้นนี้ไม่มีเทสต์อัตโนมัติแทนได้ — สิ่งที่ต้องยืนยันคือข้อมูลไปโผล่ถูกที่บนแผนที่จริง

- [ ] **Step 1: ตรวจว่ามี env ครบ**

```bash
grep -c "MONGODB_URI\|CLOUDINARY_CLOUD_NAME" .env.local
```

Expected: `2` ขึ้นไป — ถ้าไม่มี ให้กรอกก่อน สคริปต์จะ throw ทันทีถ้าไม่มี Cloudinary

- [ ] **Step 2: รันสคริปต์**

```bash
npm run import:forest
```

Expected output ประมาณนี้:
```
อ่าน .../public/Shapefiles ป่าชุมชน.zip
   พบ 7 ชั้นข้อมูลในซิป

── ป่าชุมชน (community-forest)
   ✓ ร่าง v1 — 2 รายการ, 3 ฟิลด์
     area_km2: 0.08, 3.1059
     area_rai: 1941.21, 50.02

── หมุดพิกัดป่าชุมชน (community-forest-point)
   ✓ ร่าง v1 — 176 รายการ, 2 ฟิลด์

เสร็จแล้ว — ทุกเวอร์ชันอยู่ในสถานะ "ร่าง"
```

**ต้องไม่มีบรรทัด `[error]`** โดยเฉพาะ `outside-thailand` — ถ้ามี แปลว่าการซ่อมพิกัดหมู่ 11 ไม่ทำงาน ให้กลับไปดู `needsUtmFix`

ตัวเลขพื้นที่ต้องเป็น **50.02 กับ 1941.21 ไร่** เป๊ะ ๆ ถ้าไม่ตรงแปลว่า `ringAreaUtm` หรือการถอด k0² ผิด

- [ ] **Step 3: เปิดหลังบ้านตรวจ**

```bash
npm run dev
```

เปิด http://localhost:3000/admin/map แล้วตรวจ:
- มีการ์ด "ป่าชุมชน" และ "หมุดพิกัดป่าชุมชน" ขึ้นมาใหม่ สถานะ "ร่าง"
- กดเข้า `/admin/map/community-forest` เห็นฟิลด์ `moo`, `area_rai`, `area_km2`
- ติ๊กเปิดฟิลด์ทั้งสามให้เป็นฟิลด์สาธารณะ แล้วกดเผยแพร่
- ทำแบบเดียวกันกับ `community-forest-point` (เปิด `moo`, `point_n`)

- [ ] **Step 4: ตรวจบนแผนที่จริง**

เปิด http://localhost:3000/map แล้วยืนยันทีละข้อ:
- ป่าชุมชนขึ้นเป็นพื้นเขียวสองผืน อยู่ในเขตตำบล **ไม่ใช่กลางทะเลหรือนอกประเทศ**
- เปิดสวิตช์ "หมุดพิกัดป่าชุมชน" แล้วเห็นจุดเขียว 176 จุด
- **หมุดของหมู่ 11 ทั้ง 117 จุดต้องเรียงอยู่บนขอบของรูปป่าหมู่ 11** — นี่คือหลักฐานตาเปล่าว่าการซ่อม `.prj` ที่โกหกได้ผลจริง ถ้าหมุดกองอยู่คนละที่กับรูป แปลว่ายังผิด
- คลิกที่รูปป่า → ป๊อปอัปขึ้นและแสดง "พื้นที่โดยประมาณ (ไร่)"
- คลิกที่หมุด → ป๊อปอัปขึ้นและแสดง "หมู่" กับ "ลำดับหมุด" (ถ้าคลิกไม่โดน แปลว่า tolerance ใน `map-hit.ts` แคบไปสำหรับจุดรัศมี 4px — ให้รายงานไว้ ยังไม่ต้องแก้ในงานนี้)

- [ ] **Step 5: ยืนยันว่ารันซ้ำแล้วไม่สร้างเวอร์ชันซ้ำ**

```bash
npm run import:forest
```

Expected: `– เนื้อข้อมูลตรงกับเวอร์ชันที่มีอยู่แล้ว ข้าม` ทั้งสองเลเยอร์

ถ้าขึ้น `✓ ร่าง v2` แปลว่า sha256 ไม่คงที่ — สาเหตุที่เป็นไปได้มากที่สุดคือการปัดเศษใน `polygonAreaRai` ไม่ทำงาน

---

## Task 9: เอกสาร

**Files:**
- Modify: `README.md` (หัวข้อ "คลังไฟล์แผนที่")

- [ ] **Step 1: เพิ่มสองเลเยอร์ในตาราง**

ใน README หาตาราง "สี่เลเยอร์ที่นำเข้ามาจาก namphraesmartcity.ai" เปลี่ยนหัวข้อเป็น "เลเยอร์ที่นำเข้าไว้แล้ว" แล้วเพิ่มสองแถวท้ายตาราง:

```markdown
| ป่าชุมชน `community-forest` | Polygon | 2 | `moo` |
| หมุดพิกัดป่าชุมชน `community-forest-point` | Point | 176 | `moo` + `point_n` |
```

- [ ] **Step 2: เพิ่มหัวข้อป่าชุมชน**

เพิ่มต่อจากตาราง:

```markdown
### ป่าชุมชน

นำเข้าครั้งแรกด้วย `npm run import:forest` จาก `public/Shapefiles ป่าชุมชน.zip`
(ซิปนั้นมี shapefile 7 ชั้นปนสามรูปทรง และมีหนึ่งไฟล์ที่ `.prj` ประกาศระบบพิกัดผิด
สคริปต์จึงเลือกเฉพาะ 4 ชั้นที่ใช้จริงและซ่อมพิกัดให้)

**พื้นที่ไร่/ตร.กม. ระบบคำนวณให้เอง** จากรูปทรงที่วาดไว้ ไม่ต้องใส่มาในไฟล์ —
เป็นผลของ `computeArea` บนเลเยอร์ ซึ่งทำงานตอนอัปไฟล์ ไม่ว่าจะมาทางสคริปต์หรือทาง
ลากไฟล์วาง ตัวเลขนี้เป็น **ค่าประมาณจากรูปทรง ไม่ใช่เนื้อที่ตามทะเบียนของกรมป่าไม้**

**ไฟล์ที่อัปครั้งต่อไปต้องมีฟิลด์ `moo`** (ค่า `10` / `11`) — ไฟล์ต้นฉบับจาก QGIS
ไม่มีฟิลด์นี้ ต้องเพิ่มเองก่อน export เพราะมันคือตัวตนของแต่ละรายการที่ระบบใช้เทียบ
ส่วนต่างระหว่างเวอร์ชัน ถ้าลืม ด่านตรวจจะเตือนว่า "moo ว่าง N รายการ" ตอนอัป
```

- [ ] **Step 3: ตรวจว่า README ไม่ขัดกับของจริง**

```bash
grep -n "import:forest" package.json README.md
```

Expected: เจอทั้งสองไฟล์

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: เลเยอร์ป่าชุมชน + ข้อกำหนดฟิลด์ moo ตอนอัปไฟล์"
```

---

## Task 10: ตรวจงานทั้งก้อนก่อนปิด

- [ ] **Step 1: รันทุกอย่าง**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: ผ่านหมด ไม่มี warning ใหม่

- [ ] **Step 2: ยืนยันว่า proj4 ไม่หลุดเข้าบันเดิลฝั่ง client**

```bash
grep -rn "map-area\|map-ingest\|map-forest-prep" src/components src/pages --include='*.tsx'
```

(ต้องใส่ quote รอบ `*.tsx` — zsh จะพยายาม glob แล้วตายด้วย `no matches found` ถ้าไม่ใส่)

Expected: **ไม่มีผลลัพธ์** — สามโมดูลนี้ต้องถูกเรียกจาก API route กับสคริปต์เท่านั้น ถ้ามีหน้าไหน import เข้าไป proj4 จะถูกส่งไปให้เบราว์เซอร์โหลดโดยไม่จำเป็น

- [ ] **Step 3: ทบทวน diff ทั้งหมด**

```bash
git log --oneline main..HEAD
git diff main...HEAD --stat
```

ตรวจว่าไม่มีไฟล์แปลกปลอมติดมา โดยเฉพาะ `data/*.json` (ทะเบียนในเครื่อง) และไฟล์ในโฟลเดอร์ `public/design_handoff_namphrae_ui/`

---

## หมายเหตุการทำงาน

**ทำไมสคริปต์นำเข้าไม่มีเทสต์:** มันเป็น I/O ล้วน (อ่านไฟล์ อัป Cloudinary เขียน Mongo) ตรรกะทั้งหมดอยู่ใน `map-forest-prep.ts` กับ `map-area.ts` ที่เทสต์คลุมแล้ว การเทสต์สคริปต์จะต้อง mock ทั้ง Cloudinary และ Mongo ซึ่งได้ความมั่นใจน้อยกว่าการรันจริงหนึ่งครั้งใน Task 8

**ถ้าเจอ `outside-thailand` ตอนรันสคริปต์:** แปลว่า `needsUtmFix` ไม่คืน `true` สำหรับ `พิกัดป่าชุมชนหมู่ 11_point` ตรวจว่า `shpjs` ยังคืน `fileName` ให้แต่ละ sub-layer อยู่ไหมด้วย:

```bash
node --input-type=module -e "
import shp from 'shpjs'; import fs from 'node:fs';
const b=fs.readFileSync('public/Shapefiles ป่าชุมชน.zip');
const p=await shp(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
for(const x of p) console.log(x.fileName, x.features.length, x.features[0]?.geometry?.coordinates?.slice?.(0,2));
"
```

**ยังไม่ทำในงานนี้ (PR 2):** `POST /api/admin/map/layers` + ปุ่ม "เพิ่มเลเยอร์" ใน `/admin/map` เพื่อให้เจ้าหน้าที่สร้างเลเยอร์ใหม่เองได้โดยไม่ต้องให้ dev รันสคริปต์ — ดูหัวข้อ 8 ในสเปก
