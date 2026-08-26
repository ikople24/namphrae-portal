# แผนลงมือรอบ 1A — ชั้นข้อมูลป่าไม้และสคริปต์นำเข้า

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** นำชั้นข้อมูลป่าไม้ 7 ชั้นจากแผนที่ป่าไม้เข้าโดเมน `forestLayers` ใหม่ ผ่าน pipeline
เดียวกับแผนที่ พร้อมเลิกใช้ชั้นป่าชุมชนชุดเก่าในโดเมนแผนที่

**Architecture:** ดึงส่วนที่คุยกับ Mongo ออกจาก `map-store.ts` เป็นโรงงาน `createLayerStore()`
ที่รับชื่อ collection แล้วผูกสองโดเมนเข้ากับมัน — ตรรกะบริสุทธิ์ (ด่านตรวจ สถิติ diff พื้นที่)
ใช้ร่วมกันทั้งหมดโดยไม่คัดลอก เพิ่ม `coordinatePrecision` เข้า pipeline คู่ขนานกับ `computeArea`
และล้างฟิลด์รายชั้นด้วยฟังก์ชันบริสุทธิ์ที่เทสต์ได้ตรง ๆ

**Tech Stack:** TypeScript · Next.js Pages Router · MongoDB driver 7 · Cloudinary · Vitest · tsx

**สเปก:** [2026-08-26-forest-data-page-design.md](../specs/2026-08-26-forest-data-page-design.md)
(รอบ 1A ครอบข้อ 4–8 ของสเปก ส่วนสิทธิ์ `forest` / route / `/admin/forest` อยู่ในรอบ 1B)

---

## โครงไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/iso-date.ts` | แปลงวันที่ไทย/พ.ศ./เลขไทย → ISO · บริสุทธิ์ |
| `src/lib/map-precision.ts` | ปัดทศนิยมพิกัด · บริสุทธิ์ |
| `src/lib/layer-store.ts` | ฟังก์ชันบริสุทธิ์ของทะเบียน + โรงงาน store ที่รับชื่อ collection |
| `src/lib/map-store.ts` | **แก้** — เหลือแค่ผูก `createLayerStore` กับ `mapLayers` แล้ว re-export |
| `src/types/forest.ts` | `ForestLayer` |
| `src/lib/forest-store.ts` | ผูก `createLayerStore` กับ `forestLayers` |
| `src/lib/forest-prep.ts` | ล้างฟิลด์รายชั้นทั้ง 7 ชั้น · บริสุทธิ์ |
| `src/lib/forest-registry.ts` | เมล็ดพันธุ์ 7 ชั้นสำหรับสคริปต์นำเข้า |
| `scripts/import-forest-map.mts` | ดึงจากแผนที่ป่าไม้ → ตรวจยัน → ingest → Cloudinary → ร่าง |
| `src/lib/map-ingest.ts` | **แก้** — แทรกการปัดพิกัดก่อนเติมพื้นที่ |
| `src/types/map.ts` | **แก้** — เพิ่ม `coordinatePrecision` บน `MapLayer` |

**ลบ:** `scripts/import-community-forest.mts` · `src/lib/map-forest-prep.ts` +
`src/lib/map-forest-prep.test.ts`

---

## Task 1: `iso-date.ts` — วันที่ 3 รูปแบบ

ทะเบียนฝายเขียนวันที่ไว้สามแบบในคอลัมน์เดียวกัน: ISO ค.ศ., พ.ศ.สองหลัก+เดือนย่อไทยเลขอารบิก,
แบบเดียวกันด้วยเลขไทย

> **หมายเหตุจากรีวิว:** โค้ดจริงที่ลงไปมีมากกว่าบล็อกด้านล่างสองอย่าง — ด่านตรวจปีนอกช่วง
> ค.ศ. 1900–2100 (กัน `2568-06-18` ที่เป็น ISO ปี พ.ศ.) และลายเซ็นเป็น `raw: unknown`
> ไม่ใช่ `string` ดู commit ที่สองของ Task นี้

**Files:**
- Create: `src/lib/iso-date.ts`
- Test: `src/lib/iso-date.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
// src/lib/iso-date.test.ts
import { describe, expect, it } from 'vitest';
import { arabicDigits, toIsoDate } from '@/lib/iso-date';

describe('arabicDigits', () => {
  it('แปลงเลขไทยเป็นอารบิก ตัวอักษรอื่นไม่แตะ', () => {
    expect(arabicDigits('๑๒-มิ.ย.-๖๖')).toBe('12-มิ.ย.-66');
  });
});

describe('toIsoDate', () => {
  it('ISO ค.ศ. ผ่านตรง ๆ', () => {
    expect(toIsoDate('2025-06-18')).toBe('2025-06-18');
  });

  it('พ.ศ. สองหลัก + เดือนย่อไทย', () => {
    expect(toIsoDate('18-มิ.ย.-68')).toBe('2025-06-18');
    expect(toIsoDate('24-ส.ค.-67')).toBe('2024-08-24');
  });

  it('เลขไทย + พ.ศ. สองหลัก', () => {
    expect(toIsoDate('๑๒-มิ.ย.-๖๖')).toBe('2023-06-12');
    expect(toIsoDate('๒๐-ก.ย.-๖๔')).toBe('2021-09-20');
    expect(toIsoDate('๒๓-ก.ย.-๖๕')).toBe('2022-09-23');
  });

  it('ตัดช่องว่างหัวท้าย', () => {
    expect(toIsoDate('  18-มิ.ย.-68  ')).toBe('2025-06-18');
  });

  it('รูปแบบที่ไม่รู้จัก → โยน error ไม่คืนค่าเดิม', () => {
    expect(() => toIsoDate('18/06/2025')).toThrow(/อ่านวันที่ไม่ออก/);
    expect(() => toIsoDate('')).toThrow(/อ่านวันที่ไม่ออก/);
    expect(() => toIsoDate('18-มิถุนายน-68')).toThrow(/อ่านวันที่ไม่ออก/);
  });

  it('วันที่ที่ไม่มีอยู่จริง → โยน error ไม่เลื่อนเงียบ ๆ', () => {
    expect(() => toIsoDate('31-ก.พ.-68')).toThrow(/ไม่มีอยู่จริง/);
    expect(() => toIsoDate('2025-02-30')).toThrow(/ไม่มีอยู่จริง/);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/iso-date.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/iso-date"`

- [ ] **Step 3: เขียนโค้ดให้ผ่าน**

```ts
// src/lib/iso-date.ts

// แปลงวันที่ที่เขียนแบบไทยให้เป็น ISO (YYYY-MM-DD)
//
// ทะเบียนฝายบนแผนที่ป่าไม้เขียนวันที่ไว้สามแบบในคอลัมน์เดียวกัน — ISO ค.ศ.,
// พ.ศ.สองหลัก + เดือนย่อไทยเลขอารบิก, และแบบเดียวกันนั้นด้วยเลขไทย
//
// แปลงไม่ได้ = โยน error ไม่คืนค่าเดิม ผู้เรียกทุกคนเป็นสคริปต์นำเข้าที่ควรหยุดทั้งงาน
// ไม่ใช่ปล่อยแถวเสียผ่านไปแถวเดียว — ปีที่อ่านผิดบนทะเบียนราชการคือความเสียหายที่ไม่มี
// ใครสังเกตจนสายเกินไป

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** เลขไทย → เลขอารบิก อักขระอื่นปล่อยผ่านตามเดิม */
export function arabicDigits(s: string): string {
  return s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const THAI_SHORT = /^(\d{1,2})-(.+?)-(\d{2})$/;

export function toIsoDate(raw: string): string {
  const s = arabicDigits(String(raw ?? '').trim());

  if (ISO.test(s)) {
    assertRealDate(s, raw);
    return s;
  }

  const m = THAI_SHORT.exec(s);
  if (m) {
    const monthIndex = THAI_MONTHS.indexOf(m[2]);
    if (monthIndex !== -1) {
      // ปี พ.ศ. สองหลัก: 68 คือ 2568 ไม่ใช่ 68 หรือ 2068 — ข้อมูลชุดนี้ครอบ 2564–2568
      const be = 2500 + Number(m[3]);
      const iso = `${be - 543}-${pad(monthIndex + 1)}-${pad(Number(m[1]))}`;
      assertRealDate(iso, raw);
      return iso;
    }
  }

  throw new Error(`อ่านวันที่ไม่ออก: ${JSON.stringify(raw)}`);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ตรวจว่ามีวันนั้นอยู่จริง ไม่ใช่แค่รูปแบบถูก — 31-ก.พ.-68 ผ่าน regex ได้ แต่ Date
// จะเลื่อนไปเป็น 3 มี.ค. เงียบ ๆ ซึ่งแย่กว่าการโยน error เพราะไม่มีใครเห็น
function assertRealDate(iso: string, raw: string): void {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) {
    throw new Error(`วันที่ไม่มีอยู่จริง: ${JSON.stringify(raw)} → ${iso}`);
  }
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/iso-date.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: commit**

```bash
git add src/lib/iso-date.ts src/lib/iso-date.test.ts
git commit -m "feat(forest): แปลงวันที่ไทย/พ.ศ./เลขไทย เป็น ISO"
```

---

## Task 2: `coordinatePrecision` — ปัดทศนิยมพิกัดใน pipeline

พิกัดจากแผนที่ป่าไม้พกทศนิยมมา 14 ตำแหน่ง ปัดเหลือ 6 (= 11 ซม. ที่ละติจูดนี้) ลดป่าสงวน
จาก 6.34 เหลือ 3.60 MB

**Files:**
- Create: `src/lib/map-precision.ts`
- Test: `src/lib/map-precision.test.ts`
- Modify: `src/types/map.ts` (เพิ่มฟิลด์บน `MapLayer` ถัดจาก `computeArea`)
- Modify: `src/lib/map-ingest.ts:48`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
// src/lib/map-precision.test.ts
import { describe, expect, it } from 'vitest';
import { withPrecision } from '@/lib/map-precision';
import type { FeatureCollection } from '@/types/map';

const fc = (geometry: unknown): FeatureCollection => ({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: geometry as never, properties: { moo: 10 } },
  ],
});

describe('withPrecision', () => {
  it('ปัดพิกัดของ Point', () => {
    const out = withPrecision(
      fc({ type: 'Point', coordinates: [98.89409123456789, 18.71541987654321] }),
      6
    );
    expect(out.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [98.894091, 18.71542],
    });
  });

  it('ปัดพิกัดที่ซ้อนลึกของ MultiPolygon', () => {
    const out = withPrecision(
      fc({
        type: 'MultiPolygon',
        coordinates: [[[[98.8678206123, 18.6831098234], [98.8665583456, 18.6843742567]]]],
      }),
      6
    );
    expect(out.features[0].geometry).toEqual({
      type: 'MultiPolygon',
      coordinates: [[[[98.867821, 18.68311], [98.866558, 18.684374]]]],
    });
  });

  it('ไม่แตะ properties และไม่แตะ feature อื่น ๆ ในก้อน', () => {
    const out = withPrecision(fc({ type: 'Point', coordinates: [98.1234567, 18.1] }), 3);
    expect(out.features[0].properties).toEqual({ moo: 10 });
    expect(out.type).toBe('FeatureCollection');
  });

  it('geometry เป็น null → ปล่อยผ่าน ไม่พัง', () => {
    const out = withPrecision(fc(null), 6);
    expect(out.features[0].geometry).toBeNull();
  });

  it('พิกัดที่ไม่ใช่ตัวเลข ปล่อยผ่านให้ด่านตรวจเป็นคนรายงาน', () => {
    const out = withPrecision(fc({ type: 'Point', coordinates: [null, 'x'] }), 6);
    expect(out.features[0].geometry).toEqual({ type: 'Point', coordinates: [null, 'x'] });
  });

  it('ปัดซ้ำได้ผลเท่าเดิม — เงื่อนไขที่ทำให้ sha256 คงที่เมื่ออัปไฟล์เดิมซ้ำ', () => {
    const once = withPrecision(fc({ type: 'Point', coordinates: [98.1234567891, 18.9] }), 6);
    const twice = withPrecision(once, 6);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/map-precision.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/map-precision"`

- [ ] **Step 3: เขียนโมดูล**

```ts
// src/lib/map-precision.ts
import type { FeatureCollection, Geometry } from '@/types/map';

// ปัดทศนิยมของพิกัดให้เหลือตามที่เลเยอร์กำหนด
//
// ไฟล์ที่ export จาก QGIS พกทศนิยมมาถึง 14 ตำแหน่ง ซึ่งเป็นขยะทศนิยมลอยตัวจากการ
// แปลงพิกัด ไม่ใช่ความแม่นยำจริง — ที่ละติจูด 18.7°N ตำแหน่งที่ 6 คือ 11 เซนติเมตร
// ละเอียดกว่าเครื่องรังวัดที่เก็บข้อมูลชุดนี้หลายเท่า
//
// อยู่ที่นี่ไม่ใช่ในสคริปต์นำเข้า ด้วยเหตุผลเดียวกับ withArea: ไฟล์ที่เจ้าหน้าที่
// export จาก QGIS มาลากวางเองต้องได้ผลเท่ากัน ไม่งั้นไฟล์จะกลับไปบวมเงียบ ๆ โดยไม่มี
// ด่านไหนเตือน (ด่านที่มีอยู่ดูจำนวนแถวกับรายชื่อฟิลด์ ไม่ได้ดูขนาดไฟล์)

export function roundCoord(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function withPrecision(fc: FeatureCollection, digits: number): FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => ({ ...f, geometry: roundGeometry(f.geometry, digits) })),
  };
}

function roundGeometry(geometry: Geometry | null, digits: number): Geometry | null {
  if (!geometry || !Array.isArray(geometry.coordinates)) return geometry;
  return { ...geometry, coordinates: walk(geometry.coordinates, digits) };
}

// เดินลึกเท่าไหร่ก็ได้ — Point เป็น number[] ส่วน MultiPolygon เป็น number[][][][]
// ค่าที่ไม่ใช่ number (null หรือ "x" ที่หลุดมาจาก JSON.parse) ปล่อยผ่านตามเดิม ให้
// ด่าน bad-geometry กับ outside-thailand เป็นคนรายงาน เหตุผลเดียวกับที่
// polygonAreaRai เลือกคืน null แทนการ throw
function walk(node: unknown, digits: number): unknown {
  if (typeof node === 'number') return roundCoord(node, digits);
  if (Array.isArray(node)) return node.map((n) => walk(n, digits));
  return node;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/map-precision.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: เพิ่มฟิลด์บน `MapLayer`**

ใน `src/types/map.ts` ใส่ต่อจากบล็อกคอมเมนต์ของ `computeArea?: boolean;`:

```ts
  /**
   * ปัดพิกัดให้เหลือทศนิยมกี่ตำแหน่งตอน ingest — `undefined` = ไม่ปัด
   *
   * อยู่ที่ pipeline ด้วยเหตุผลเดียวกับ computeArea: ถ้าให้สคริปต์นำเข้าเป็นคนปัด
   * ไฟล์ที่เจ้าหน้าที่ export จาก QGIS มาลากวางเองจะกลับไปพกทศนิยม 14 ตำแหน่ง
   * แล้วไฟล์สาธารณะบวมขึ้นเท่าตัวโดยไม่มีด่านไหนเตือน
   *
   * 6 ตำแหน่ง = 11 ซม. ที่ละติจูดของน้ำแพร่ ชั้นแผนที่เดิมทั้งสี่ไม่ตั้งค่านี้
   * พฤติกรรมของมันจึงไม่เปลี่ยน
   */
  coordinatePrecision?: number;
```

- [ ] **Step 6: แทรกเข้า pipeline**

ใน `src/lib/map-ingest.ts` เพิ่ม import:

```ts
import { withPrecision } from '@/lib/map-precision';
```

แล้วแทนที่บรรทัด 48 (`const fc = args.layer.computeArea ? withArea(parsed.fc) : parsed.fc;`) ด้วย:

```ts
  // ปัดพิกัดก่อนเติมพื้นที่ เพื่อให้ตัวเลขไร่ตรงกับรูปทรงที่เผยแพร่จริง ไม่ใช่ตรงกับ
  // รูปทรงก่อนปัดที่ไม่มีใครได้เห็น
  const rounded =
    args.layer.coordinatePrecision === undefined
      ? parsed.fc
      : withPrecision(parsed.fc, args.layer.coordinatePrecision);
  const fc = args.layer.computeArea ? withArea(rounded) : rounded;
```

- [ ] **Step 7: รันเทสต์ทั้งชุดให้ผ่านโดยไม่แก้เทสต์เดิม**

Run: `npm test`
Expected: PASS ทั้งหมด — เลเยอร์เดิมไม่ตั้ง `coordinatePrecision` เส้นทางจึงเหมือนเดิมเป๊ะ

- [ ] **Step 8: commit**

```bash
git add src/lib/map-precision.ts src/lib/map-precision.test.ts src/types/map.ts src/lib/map-ingest.ts
git commit -m "feat(map): ปัดทศนิยมพิกัดตาม coordinatePrecision ของเลเยอร์"
```

---

## Task 3: ดึง `layer-store.ts` ออกมาให้สองโดเมนใช้ร่วม

ย้ายฟังก์ชันบริสุทธิ์กับส่วนที่คุยกับ Mongo ออกจาก `map-store.ts` แล้วห่อส่วนหลังเป็นโรงงาน
ที่รับชื่อ collection

**เงื่อนไขของงานนี้: ห้ามแก้ `src/lib/map-store.test.ts` แม้บรรทัดเดียว** ถ้าต้องแก้ แปลว่า
พฤติกรรมเปลี่ยนไปแล้ว

**Files:**
- Create: `src/lib/layer-store.ts`
- Modify: `src/lib/map-store.ts` (เขียนใหม่ทั้งไฟล์)

- [ ] **Step 1: สร้าง `layer-store.ts`**

คัดลอกบรรทัด 41–152 ของ `map-store.ts` (ฟังก์ชันบริสุทธิ์ `nextVersionNo`, `buildNewVersion`,
`VERSION_EDITABLE_BY_PUBLISH`, `buildPublishPatch`, `assetsToPrune` **พร้อม JSDoc เดิมทุกตัว**)
มาไว้ในไฟล์ใหม่โดยไม่แก้เนื้อ แล้วต่อท้ายด้วยโรงงาน:

```ts
// src/lib/layer-store.ts
import { promises as fs } from 'fs';
import path from 'path';
import { getDb, isMongoConfigured } from '@/lib/mongodb';
import type {
  MapAsset,
  MapCheck,
  MapDiff,
  MapLayer,
  MapLayerVersion,
  MapPublicAsset,
  MapStats,
  SourceFormat,
} from '@/types/map';

// ทะเบียนคลังไฟล์ภูมิสารสนเทศ — geometry ไม่แตะที่นี่เลย ตัวไฟล์อยู่บน Cloudinary
// สองสำเนาต่อเวอร์ชัน (เต็มแบบ authenticated กับสาธารณะที่กรองฟิลด์แล้วบน CDN)
// ที่นี่เก็บแต่ metadata จึงไม่มีวันชนเพดาน 16MB ต่อ document
//
// ไฟล์นี้ไม่รู้จักคำว่า "แผนที่" หรือ "ป่าไม้" — ผู้เรียกส่งชื่อ collection เข้ามาเอง
// เพื่อให้สองโดเมนแยกที่เก็บกันได้โดยไม่ต้องคัดลอกตรรกะ ถ้าคัดลอก วันที่แก้บั๊กที่นี่
// อีกโดเมนจะไม่ได้รับการแก้นั้นและไม่มีใครรู้จนกว่าจะมีคนบ่น

// ── ฟังก์ชันบริสุทธิ์ ────────────────────────────────────────────────────────
// (ย้ายมาจาก map-store.ts ทั้งบล็อกโดยไม่แก้เนื้อ — map-store.ts re-export ต่อ
// เพื่อให้ผู้เรียกเดิมทั้งหมดและ map-store.test.ts ทำงานเหมือนเดิม)

/* ...วาง nextVersionNo / buildNewVersion / VERSION_EDITABLE_BY_PUBLISH /
   buildPublishPatch / assetsToPrune จากบรรทัด 41–152 ของ map-store.ts ที่นี่... */

// ── โรงงาน store ─────────────────────────────────────────────────────────────

export type LayerStoreConfig = {
  /** ใช้ในข้อความ error ตอนปฏิเสธแบ็กเอนด์ไฟล์บน production */
  label: string;
  layersCollection: string;
  versionsCollection: string;
  layersFile: string;
  versionsFile: string;
};

export type LayerStore<L extends MapLayer> = {
  listLayers: () => Promise<L[]>;
  getLayer: (id: string) => Promise<L | null>;
  upsertLayer: (layer: L) => Promise<L>;
  patchLayer: (id: string, patch: Partial<L>) => Promise<L | null>;
  deleteLayer: (id: string) => Promise<void>;
  listVersions: (layerId: string) => Promise<MapLayerVersion[]>;
  getVersion: (id: string) => Promise<MapLayerVersion | null>;
  getPublishedVersion: (layerId: string) => Promise<MapLayerVersion | null>;
  insertVersion: (version: MapLayerVersion) => Promise<MapLayerVersion>;
  patchVersion: (
    id: string,
    patch: Partial<MapLayerVersion>
  ) => Promise<MapLayerVersion | null>;
  deleteVersions: (layerId: string) => Promise<void>;
};

export function createLayerStore<L extends MapLayer>(
  cfg: LayerStoreConfig
): LayerStore<L> {
  const usingMongo = (): boolean => isMongoConfigured();

  // แบ็กเอนด์ไฟล์มีไว้ให้รันในเครื่องโดยไม่ต้องมี Mongo — แต่ปฏิเสธตอน production
  // เพราะ filesystem ของ hosting ส่วนใหญ่ (เช่น Railway) เขียนได้จริงแต่ไม่คงอยู่ข้าม
  // deploy ทะเบียนที่หายไปไม่ได้ทำให้แค่ข้อมูลหาย แต่ทำให้ไฟล์ทุกเวอร์ชันบน Cloudinary
  // กลายเป็นขยะกำพร้าที่ไม่มีอะไรอ้างถึงและไม่มีใครรู้ว่าอันไหนคือของจริง
  function assertFileBackendAllowed(): void {
    if (process.env.NODE_ENV === 'production' && !isMongoConfigured()) {
      throw new Error(
        `ไม่ได้ตั้งค่า MONGODB_URI — ปฏิเสธการบันทึก${cfg.label}ลงไฟล์ในเครื่องตอน ` +
          'production เพราะ filesystem ของ hosting ส่วนใหญ่ (เช่น Railway) เขียนได้จริง ' +
          'แต่ไม่คงอยู่ข้าม deploy ทะเบียนจะหายเงียบ ๆ แล้วไฟล์ทุกเวอร์ชันบน Cloudinary ' +
          'จะกลายเป็นขยะกำพร้าที่ไม่มีอะไรอ้างถึง ตั้ง MONGODB_URI ก่อนใช้งานจริง'
      );
    }
  }

  async function fileRead<T>(file: string): Promise<T[]> {
    assertFileBackendAllowed();
    try {
      return JSON.parse(await fs.readFile(file, 'utf8')) as T[];
    } catch (err) {
      // ENOENT คือยังไม่เคยมีข้อมูล ต้องแยกจาก error อื่นทุกแบบ เช่นไฟล์ถูกตัดกลางคัน
      // เพราะโปรเซสถูก kill ระหว่างเขียน — ถ้ากลืนเป็น [] เหมือนกัน การเขียนครั้งถัดไป
      // จะทับทะเบียนเดิมทั้งก้อนโดยไม่มีสัญญาณเตือน
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async function fileWrite<T>(file: string, rows: T[]): Promise<void> {
    assertFileBackendAllowed();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(rows, null, 2) + '\n', 'utf8');
  }

  // สถานะของ index อยู่ในคลอเชอร์ ไม่ใช่ระดับโมดูล — สอง store ต้องนับความพยายาม
  // ของตัวเองแยกกัน ไม่งั้นโดเมนที่สร้าง index สำเร็จจะทำให้อีกโดเมนไม่เคยลองเลย
  let indexesEnsured = false;
  let indexAttempts = 0;
  const MAX_INDEX_ATTEMPTS = 3;

  async function ensureIndexes(): Promise<void> {
    if (indexesEnsured || indexAttempts >= MAX_INDEX_ATTEMPTS) return;
    indexAttempts += 1;
    indexesEnsured = true;
    try {
      const db = await getDb();
      await db
        .collection(cfg.layersCollection)
        .createIndexes([{ key: { id: 1 }, unique: true }]);
      await db.collection(cfg.versionsCollection).createIndexes([
        { key: { id: 1 }, unique: true },
        { key: { layerId: 1, versionNo: -1 } },
        { key: { layerId: 1, status: 1 } },
      ]);
    } catch (err) {
      indexesEnsured = false; // ให้ลองใหม่ครั้งหน้า (จนกว่าจะครบเพดาน)
      console.warn(
        `${cfg.layersCollection}: createIndexes failed ` +
          `(attempt ${indexAttempts}/${MAX_INDEX_ATTEMPTS})`,
        err
      );
    }
  }

  return {
    async listLayers() {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<L>(cfg.layersCollection)
          .find({}, { projection: { _id: 0 } })
          .sort({ order: 1, id: 1 })
          .toArray() as Promise<L[]>;
      }
      return (await fileRead<L>(cfg.layersFile)).sort(
        (a, b) => a.order - b.order || a.id.localeCompare(b.id)
      );
    },

    async getLayer(id) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<L>(cfg.layersCollection)
          .findOne({ id }, { projection: { _id: 0 } }) as Promise<L | null>;
      }
      return (await fileRead<L>(cfg.layersFile)).find((l) => l.id === id) ?? null;
    },

    async upsertLayer(layer) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        await db
          .collection<L>(cfg.layersCollection)
          .updateOne({ id: layer.id }, { $set: { ...layer } }, { upsert: true });
        return layer;
      }
      const rows = await fileRead<L>(cfg.layersFile);
      const i = rows.findIndex((l) => l.id === layer.id);
      if (i === -1) rows.push(layer);
      else rows[i] = layer;
      await fileWrite(cfg.layersFile, rows);
      return layer;
    },

    async patchLayer(id, patch) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<L>(cfg.layersCollection)
          .findOneAndUpdate(
            { id },
            { $set: patch },
            { returnDocument: 'after', projection: { _id: 0 } }
          ) as Promise<L | null>;
      }
      const rows = await fileRead<L>(cfg.layersFile);
      const i = rows.findIndex((l) => l.id === id);
      if (i === -1) return null;
      rows[i] = { ...rows[i], ...patch };
      await fileWrite(cfg.layersFile, rows);
      return rows[i];
    },

    // ลบเฉพาะทะเบียน — ไฟล์บน Cloudinary เป็นหน้าที่ของผู้เรียก เพราะ store ไม่รู้จัก
    // Cloudinary และไม่ควรรู้ ผู้เรียกต้องอ่าน listVersions() เก็บ asset ไว้ก่อนลบ
    async deleteLayer(id) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        await db.collection(cfg.layersCollection).deleteOne({ id });
        return;
      }
      const rows = await fileRead<L>(cfg.layersFile);
      await fileWrite(cfg.layersFile, rows.filter((l) => l.id !== id));
    },

    async listVersions(layerId) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<MapLayerVersion>(cfg.versionsCollection)
          .find({ layerId }, { projection: { _id: 0 } })
          .sort({ versionNo: -1 })
          .toArray();
      }
      return (await fileRead<MapLayerVersion>(cfg.versionsFile))
        .filter((v) => v.layerId === layerId)
        .sort((a, b) => b.versionNo - a.versionNo);
    },

    async getVersion(id) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<MapLayerVersion>(cfg.versionsCollection)
          .findOne({ id }, { projection: { _id: 0 } });
      }
      return (
        (await fileRead<MapLayerVersion>(cfg.versionsFile)).find((v) => v.id === id) ?? null
      );
    },

    async getPublishedVersion(layerId) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<MapLayerVersion>(cfg.versionsCollection)
          .findOne({ layerId, status: 'published' }, { projection: { _id: 0 } });
      }
      return (
        (await fileRead<MapLayerVersion>(cfg.versionsFile)).find(
          (v) => v.layerId === layerId && v.status === 'published'
        ) ?? null
      );
    },

    async insertVersion(version) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        // spread เพื่อไม่ให้ driver แปะ _id ลงบน object ที่เรากำลังจะคืนกลับไป
        await db.collection<MapLayerVersion>(cfg.versionsCollection).insertOne({ ...version });
      } else {
        const rows = await fileRead<MapLayerVersion>(cfg.versionsFile);
        rows.push(version);
        await fileWrite(cfg.versionsFile, rows);
      }
      return version;
    },

    async patchVersion(id, patch) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<MapLayerVersion>(cfg.versionsCollection)
          .findOneAndUpdate(
            { id },
            { $set: patch },
            { returnDocument: 'after', projection: { _id: 0 } }
          );
      }
      const rows = await fileRead<MapLayerVersion>(cfg.versionsFile);
      const i = rows.findIndex((v) => v.id === id);
      if (i === -1) return null;
      rows[i] = { ...rows[i], ...patch };
      await fileWrite(cfg.versionsFile, rows);
      return rows[i];
    },

    async deleteVersions(layerId) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        await db.collection(cfg.versionsCollection).deleteMany({ layerId });
        return;
      }
      const rows = await fileRead<MapLayerVersion>(cfg.versionsFile);
      await fileWrite(cfg.versionsFile, rows.filter((v) => v.layerId !== layerId));
    },
  };
}
```

> **`Filter<L>` ต้อง cast** — บล็อกด้านบนคอมไพล์ไม่ผ่านตามที่เขียนไว้ `Filter<L>` กางเป็น
> mapped type บน `keyof WithId<L>` ซึ่ง TypeScript ยังกางไม่ออกตอน `L` เป็นตัวแปรชนิด
> `{ id }` จึงไม่ผ่าน ทั้งที่ `L extends MapLayer` การันตี `id: string` อยู่แล้ว
>
> เพิ่ม `import type { Filter } from 'mongodb';` แล้วใส่ `as Filter<L>` ที่ตัวกรองของ
> `getLayer`, `upsertLayer`, `patchLayer` สามจุด — แก้ระดับชนิดล้วน ไม่กระทบ runtime
> ส่วน `deleteLayer`/`deleteVersions` ไม่ต้องแก้ เพราะเรียกผ่าน `db.collection(...)` ที่ไม่ระบุชนิด

- [ ] **Step 2: เขียน `map-store.ts` ใหม่ให้เหลือแค่การผูก**

แทนที่เนื้อไฟล์ `src/lib/map-store.ts` ทั้งหมดด้วย:

```ts
// src/lib/map-store.ts
import path from 'path';
import { createLayerStore } from '@/lib/layer-store';
import type { MapLayer } from '@/types/map';

// ทะเบียนคลังไฟล์แผนที่ — ตรรกะทั้งหมดอยู่ใน layer-store.ts ซึ่งโดเมนป่าไม้ใช้ร่วม
// ไฟล์นี้เหลือแค่ผูกชื่อ collection กับที่เก็บไฟล์สำรอง แล้ว re-export ให้ผู้เรียกเดิม
// (route 11 ไฟล์ สคริปต์นำเข้า และ map-store.test.ts) ทำงานต่อได้โดยไม่ต้องแก้อะไร

export {
  assetsToPrune,
  buildNewVersion,
  buildPublishPatch,
  nextVersionNo,
  VERSION_EDITABLE_BY_PUBLISH,
} from '@/lib/layer-store';

const DATA_DIR = path.join(process.cwd(), 'data');

const store = createLayerStore<MapLayer>({
  label: 'ทะเบียนไฟล์แผนที่',
  layersCollection: 'mapLayers',
  versionsCollection: 'mapLayerVersions',
  layersFile: path.join(DATA_DIR, 'map-layers.json'),
  versionsFile: path.join(DATA_DIR, 'map-layer-versions.json'),
});

export const {
  deleteLayer,
  deleteVersions,
  getLayer,
  getPublishedVersion,
  getVersion,
  insertVersion,
  listLayers,
  listVersions,
  patchLayer,
  patchVersion,
  upsertLayer,
} = store;
```

- [ ] **Step 3: พิสูจน์ว่าบล็อกที่ย้ายมาเหมือนเดิมทุกตัวอักษร**

การย้ายโค้ดแบบคัดลอกเปิดช่องให้พิมพ์ตกหล่นโดยไม่มีใครเห็น ตรวจด้วยการดึงบล็อกเดิมจาก git
มาเทียบกับบล็อกใหม่ตรง ๆ:

```bash
git show HEAD:src/lib/map-store.ts | sed -n '41,152p' > /tmp/pure-before.ts
START=$(grep -n '^/\*\*$' src/lib/layer-store.ts | head -1 | cut -d: -f1)
sed -n "${START},$((START + 111))p" src/lib/layer-store.ts > /tmp/pure-after.ts
diff /tmp/pure-before.ts /tmp/pure-after.ts && echo "เหมือนกันทุกตัวอักษร"
```

> ตัดจากบรรทัดแรกที่เป็น `/**` แล้วนับไป 112 บรรทัด — **ห้ามใช้ช่วง sed แบบ
> `/^\/\*\*$/,/^}$/`** เพราะมันเริ่มช่วงใหม่ทุกครั้งที่เจอ `}` ปิดคอลัมน์แรก จึงเก็บเฉพาะบล็อก
> ที่มี JSDoc นำหน้าแล้ว**ทิ้ง `buildNewVersion` ทั้งฟังก์ชัน** (มันไม่มี JSDoc) — คำสั่งที่ควร
> จับการคัดลอกตกหล่น จะกลายเป็นตัวที่ปล่อยการตกหล่นนั้นผ่านไปเสียเอง

Expected: `เหมือนกันทุกตัวอักษร` — ถ้า diff มีบรรทัดออกมา แปลว่าตกหล่นระหว่างย้าย
ให้คัดลอกใหม่จาก `/tmp/pure-before.ts` แทนการพิมพ์เอง

- [ ] **Step 4: ตรวจว่าเทสต์เดิมผ่านโดยไม่แก้**

```bash
git diff --stat src/lib/map-store.test.ts   # ต้องว่างเปล่า
npm test
```

Expected: `git diff` ไม่มีบรรทัดใด และ `npm test` PASS ทั้งหมด

- [ ] **Step 5: ตรวจว่าไทป์ยังตรงทั้งโปรเจกต์**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 6: commit**

```bash
git add src/lib/layer-store.ts src/lib/map-store.ts
git commit -m "refactor(map): ดึงทะเบียนเลเยอร์ออกเป็น layer-store ที่รับชื่อ collection"
```

---

## Task 4: โดเมน `forestLayers`

**Files:**
- Create: `src/types/forest.ts`
- Create: `src/lib/forest-store.ts`

- [ ] **Step 1: เขียนไทป์**

```ts
// src/types/forest.ts
import type { MapLayer } from '@/types/map';

// ป่าไม้เป็นโดเมนแยก — คนละ collection คนละ URL คนละสิทธิ์ — แต่รูปร่างของชั้นข้อมูล
// เหมือนแผนที่ทุกประการ เพราะเดินผ่าน pipeline เดียวกัน ต่างกันแค่สองฟิลด์ที่มีความหมาย
// เฉพาะหน้าป่าไม้เท่านั้น
export type ForestLayer = MapLayer & {
  /**
   * ติดสวิตช์ไว้ตั้งแต่เปิดหน้า /forest — ชั้นหนัก (ป่าสงวน 3.6 MB, ป่าถาวร 2.4 MB)
   * ตั้งเป็น false เพราะคนเปิดหน้าป่าไม้ของน้ำแพร่มาดูป่าของน้ำแพร่ ไม่ได้มาดูป่าสงวน
   * ทั้งสามจังหวัด (ใช้จริงในรอบ 1B/2)
   */
  defaultOn?: boolean;
  /**
   * เติม photo_url ลงไฟล์สาธารณะตอนเผยแพร่ — ค่าเริ่มต้นปิด หลักเดียวกับ publicFields
   * เพราะรูปถ่ายภาคสนามอาจติดคนหรือติดบ้านคนมาโดยไม่มีใครตั้งใจ (ใช้จริงในรอบ 4)
   */
  publishPhotos?: boolean;
};
```

- [ ] **Step 2: เขียน store**

```ts
// src/lib/forest-store.ts
import path from 'path';
import { createLayerStore } from '@/lib/layer-store';
import type { ForestLayer } from '@/types/forest';

// ทะเบียนคลังไฟล์ป่าไม้ — collection แยกจากแผนที่ ตรรกะเดียวกันทั้งหมด
// (ดูเหตุผลของการแยกที่ docs/superpowers/specs/2026-08-26-forest-data-page-design.md ข้อ 4)

const DATA_DIR = path.join(process.cwd(), 'data');

const store = createLayerStore<ForestLayer>({
  label: 'ทะเบียนไฟล์ป่าไม้',
  layersCollection: 'forestLayers',
  versionsCollection: 'forestVersions',
  layersFile: path.join(DATA_DIR, 'forest-layers.json'),
  versionsFile: path.join(DATA_DIR, 'forest-layer-versions.json'),
});

export const {
  deleteLayer,
  deleteVersions,
  getLayer,
  getPublishedVersion,
  getVersion,
  insertVersion,
  listLayers,
  listVersions,
  patchLayer,
  patchVersion,
  upsertLayer,
} = store;
```

- [ ] **Step 3: ตรวจไทป์**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 4: commit**

```bash
git add src/types/forest.ts src/lib/forest-store.ts
git commit -m "feat(forest): โดเมน forestLayers แยก collection ใช้ layer-store ร่วม"
```

---

## Task 5: `forest-prep.ts` — ป่าชุมชนและตัวช่วยร่วม

**Files:**
- Create: `src/lib/forest-prep.ts`
- Test: `src/lib/forest-prep.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
// src/lib/forest-prep.test.ts
import { describe, expect, it } from 'vitest';
import { mooFromName, prepCommunityForest, registryRai } from '@/lib/forest-prep';
import type { Feature, FeatureCollection } from '@/types/map';

const feat = (properties: Record<string, unknown>): Feature => ({
  type: 'Feature',
  geometry: { type: 'MultiPolygon', coordinates: [] },
  properties,
});
const coll = (features: Feature[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});

describe('mooFromName', () => {
  it('อ่านเลขหมู่ได้จากทั้งสองรูปแบบที่ปนกันในไฟล์เดียว', () => {
    expect(mooFromName('เขตป่าชุมชน หมู่ 7')).toBe(7);
    expect(mooFromName('เขตป่าชุมชน หมู่ 9')).toBe(9);
    expect(mooFromName('พิกัดป่าชุมชนหมู่ 10')).toBe(10);
    expect(mooFromName('พิกัดป่าชุมชนหมู่ 11')).toBe(11);
  });

  it('รองรับ "หมู่ที่ N" ด้วย', () => {
    expect(mooFromName('แผนที่ป่าชุมชนหมู่ที่ 10')).toBe(10);
  });

  it('หาไม่เจอ → โยน error ไม่เดาเป็น 0', () => {
    expect(() => mooFromName('ป่าชุมชน')).toThrow(/หาเลขหมู่/);
    expect(() => mooFromName(null)).toThrow(/หาเลขหมู่/);
  });
});

describe('registryRai', () => {
  it('รวม ไร่ + งาน + ตารางวา เป็นไร่ทศนิยม', () => {
    // หมู่ 11 ในไฟล์จริง: 1941 ไร่ 0 งาน 81.59 วา
    expect(registryRai(feat({ 'ไร่': 1941, 'งาน': 0, 'ตาร\uFFFD': 81.59 }))).toBeCloseTo(
      1941.204,
      3
    );
    // หมู่ 9: 707 ไร่ 2 งาน 44.15 วา
    expect(registryRai(feat({ 'ไร่': 707, 'งาน': 2, 'ตาร\uFFFD': 44.15 }))).toBeCloseTo(
      707.61,
      2
    );
  });

  it('คีย์ตารางวาถูกตัดกลางคำต่างกันก็ยังหาเจอ', () => {
    expect(registryRai(feat({ 'ไร่': 50, 'งาน': 0, 'ตารางวา': 8.41 }))).toBeCloseTo(50.02, 2);
  });

  it('ฟิลด์ไม่ครบ → null ไม่ใช่ NaN', () => {
    expect(registryRai(feat({ 'ไร่': 50 }))).toBeNull();
  });
});

describe('prepCommunityForest', () => {
  it('เหลือแค่ moo — ฟิลด์ขยะจาก QGIS หายหมด', () => {
    const out = prepCommunityForest(
      coll([
        feat({
          id: 1,
          name: 'เขตป่าชุมชน หมู่ 7',
          Area: 740947.05,
          path: 'D:/Qgis/ป่าไม้/ป่าชุมชน/เขตป่าชุมชน หมู่',
          'ไร่': 463,
          'งาน': 0,
          'ตาร\uFFFD': 36.76,
        }),
      ])
    );
    expect(out.features[0].properties).toEqual({ moo: 7 });
  });

  it('ไม่แตะ geometry', () => {
    const g = { type: 'MultiPolygon', coordinates: [[[[98.1, 18.1]]]] };
    const out = prepCommunityForest(
      coll([{ type: 'Feature', geometry: g, properties: { name: 'หมู่ 10' } }])
    );
    expect(out.features[0].geometry).toEqual(g);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/forest-prep.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/forest-prep"`

- [ ] **Step 3: เขียนโมดูล (ส่วนแรก)**

```ts
// src/lib/forest-prep.ts
import { toIsoDate } from '@/lib/iso-date';
import type { Feature, FeatureCollection } from '@/types/map';

// ล้างฟิลด์ของชั้นข้อมูลป่าไม้แต่ละชั้นก่อนเข้า ingestMapFile
//
// เป็นงานเฉพาะกิจของไฟล์ชุดที่ export มาจาก QGIS เครื่องเดียว ไม่ใช่ความสามารถถาวร
// ของระบบ — ทางเข้าปกติที่ /admin/forest ยังรับไฟล์ตามที่มันเป็น แล้วให้เจ้าหน้าที่
// ติ๊กเลือกฟิลด์สาธารณะเอง เหตุผลเดียวกับที่ map-forest-prep.ts เคยมีอยู่
//
// ทุกฟังก์ชันบริสุทธิ์ รับ FeatureCollection คืน FeatureCollection ใหม่

/**
 * เก็บเฉพาะฟิลด์ที่ระบุพร้อมเปลี่ยนชื่อ ฟิลด์อื่นหายหมด
 *
 * ตัดทิ้งเป็นค่าเริ่มต้น ไม่ใช่เก็บเป็นค่าเริ่มต้น — ไฟล์ต้นทางพก bbox, OBJECTID,
 * path บนไดรฟ์ D: และคอลัมน์ว่างทั้งคอลัมน์มาด้วย การเก็บทุกอย่างไว้ก่อนแล้วค่อยกรอง
 * ตอนเผยแพร่แปลว่าค่าพวกนั้นยังเดินทางไปถึงเซิร์ฟเวอร์และอยู่ในไฟล์เต็มตลอดไป
 */
function pick(
  features: Feature[],
  rename: Record<string, string>,
  extra?: (f: Feature) => Record<string, unknown>
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features.map((f) => {
      const src = f.properties ?? {};
      const out: Record<string, unknown> = {};
      for (const [from, to] of Object.entries(rename)) {
        if (src[from] !== undefined && src[from] !== null) out[to] = src[from];
      }
      return { ...f, properties: { ...out, ...(extra?.(f) ?? {}) } };
    }),
  };
}

// ── ป่าชุมชน ─────────────────────────────────────────────────────────────────

// ไฟล์เดียวมีชื่อสองแบบปนกัน ("เขตป่าชุมชน หมู่ 7" กับ "พิกัดป่าชุมชนหมู่ 10")
// เพราะสี่แปลงมาจากงาน QGIS คนละครั้ง
const MOO = /หมู่\s*(?:ที่\s*)?(\d+)/;

/** เลขหมู่จากชื่อแปลง — คือตัวตนที่ระบบใช้เทียบส่วนต่างระหว่างเวอร์ชัน */
export function mooFromName(name: unknown): number {
  const m = MOO.exec(String(name ?? ''));
  if (!m) throw new Error(`หาเลขหมู่จากชื่อไม่เจอ: ${JSON.stringify(name)}`);
  return Number(m[1]);
}

/**
 * เนื้อที่ตามทะเบียนที่ติดมาในไฟล์ (ไร่) — null ถ้าฟิลด์ไม่ครบ
 *
 * ใช้ตรวจยันค่าที่ computeArea คำนวณเท่านั้น ไม่ได้เก็บลงชั้นข้อมูล
 *
 * ชื่อคอลัมน์ "ตารางวา" ถูกตัดตอน export เป็น shapefile (ชื่อฟิลด์ DBF ยาวได้ 10 ไบต์)
 * แล้วไบต์สุดท้ายขาดกลางตัวอักษรจนกลายเป็น U+FFFD — จึงไล่หาคีย์ที่ขึ้นต้นด้วย "ตาร"
 * แทนการเทียบชื่อเป๊ะ ๆ ซึ่งจะพังทันทีที่ export ครั้งหน้าตัดคำที่ตำแหน่งอื่น
 */
export function registryRai(f: Feature): number | null {
  const p = f.properties ?? {};
  const rai = Number(p['ไร่']);
  const ngan = Number(p['งาน']);
  const waKey = Object.keys(p).find((k) => k.startsWith('ตาร'));
  const wa = waKey ? Number(p[waKey]) : NaN;
  if (!Number.isFinite(rai) || !Number.isFinite(ngan) || !Number.isFinite(wa)) return null;
  return rai + ngan / 4 + wa / 400;
}

/** ป่าชุมชน 4 แปลง — เหลือแค่ moo ส่วน area_rai/area_km2 ให้ computeArea เติม */
export function prepCommunityForest(fc: FeatureCollection): FeatureCollection {
  return pick(fc.features, {}, (f) => ({ moo: mooFromName(f.properties?.name) }));
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/forest-prep.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: commit**

```bash
git add src/lib/forest-prep.ts src/lib/forest-prep.test.ts
git commit -m "feat(forest): ล้างฟิลด์ป่าชุมชน 4 แปลง แปลงชื่อแปลงเป็น moo"
```

---

## Task 6: `splitWeir` — แยกฝายออกจากจุดสำรวจ

`fid` 1–41 เป็นการเดินสำรวจถ่ายรูปสองวันในมิถุนายน 2568 ส่วน `fid` 42–54 เป็นทะเบียนฝาย
ย้อนหลัง 5 ปี คอลัมน์ที่ชื่อ `loss` ที่จริงเก็บ *ชื่อฝาย*

**Files:**
- Modify: `src/lib/forest-prep.ts`
- Modify: `src/lib/forest-prep.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ต่อท้าย `src/lib/forest-prep.test.ts`:

```ts
import { splitWeir } from '@/lib/forest-prep';

const pt = (properties: Record<string, unknown>): Feature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [98.89, 18.71] },
  properties,
});

const RAW_WEIR = [
  pt({
    fid: 1,
    Name: 'Photo(1).jpg',
    Date: '2025-06-18',
    Altitude: 335,
    Path: 'D:/Qgis/ป่าไม้/ฝาย\\Photo(1).jpg',
    RelPath: 'ฝาย\\Photo(1).jpg',
    Images: '<img src = "ฝาย\\Photo(1).jpg" width="300" height="225"/>',
    Link: 'file:///D:/Qgis/ป่าไม้/ฝาย\\Photo(1).jpg',
    cause: null,
    loss: null,
    LAT: 18.71541,
    LON: 98.89409,
  }),
  pt({ fid: 41, Name: 'Photo(41).jpg', Date: '2025-06-20', Altitude: 356 }),
  pt({ fid: 42, Name: null, Date: '18-มิ.ย.-68', cause: 'ภัยแล้ง ไม่มีน้ำ', loss: 'ฝายม่อนหินขาว ม.7' }),
  pt({ fid: 54, Name: null, Date: '๒๐-ก.ย.-๖๔', cause: 'ภัยแล้ง ไม่มีน้ำ', loss: 'ฝายป็อกกลาง' }),
];

describe('splitWeir', () => {
  it('แบ่งที่ fid 41/42 — ไม่มีจุดไหนคาบเกี่ยว', () => {
    const { weir, survey } = splitWeir(coll(RAW_WEIR));
    expect(survey.features).toHaveLength(2);
    expect(weir.features).toHaveLength(2);
  });

  it('จุดสำรวจเหลือ photo/surveyed_at/elevation_m — path บนไดรฟ์ D: หายหมด', () => {
    const { survey } = splitWeir(coll(RAW_WEIR));
    expect(survey.features[0].properties).toEqual({
      photo: 'Photo(1).jpg',
      elevation_m: 335,
      surveyed_at: '2025-06-18',
    });
  });

  it('ฝายเหลือ name/note/surveyed_at โดย loss กลายเป็นชื่อฝาย', () => {
    const { weir } = splitWeir(coll(RAW_WEIR));
    expect(weir.features[0].properties).toEqual({
      name: 'ฝายม่อนหินขาว ม.7',
      note: 'ภัยแล้ง ไม่มีน้ำ',
      surveyed_at: '2025-06-18',
    });
  });

  it('แปลงวันที่เลขไทยของฝายเก่าให้เป็น ISO', () => {
    const { weir } = splitWeir(coll(RAW_WEIR));
    expect(weir.features[1].properties?.surveyed_at).toBe('2021-09-20');
  });

  it('แถวที่ไม่มี fid → โยน error ไม่เดาว่าอยู่ฝั่งไหน', () => {
    expect(() => splitWeir(coll([pt({ Name: 'x', Date: '2025-06-18' })]))).toThrow(/fid/);
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/forest-prep.test.ts`
Expected: FAIL — `splitWeir is not a function`

- [ ] **Step 3: เขียนโค้ด**

ต่อท้าย `src/lib/forest-prep.ts`:

```ts
// ── ฝาย ──────────────────────────────────────────────────────────────────────

// fid แบ่งตัวเองอยู่แล้ว: 1–41 คือการเดินสำรวจถ่ายรูปสองวันในมิถุนายน 2568
// (มีรูปกับระดับความสูง ไม่มีชื่อ) ส่วน 42–54 คือทะเบียนฝายที่สร้างจริงย้อนหลัง 5 ปี
// (มีชื่อกับสาเหตุความเสียหาย ไม่มีรูป) ทั้งสองชุดไม่มีแถวไหนคาบเกี่ยวกันเลย
//
// สคริปต์นำเข้าตรวจยันช่วง fid นี้อีกชั้นก่อนเขียนลงฐาน — ถ้าวันไหนต้นทางแก้ไฟล์
// จนช่วงเปลี่ยน การแยกสองชั้นอาจไม่ตรงอีกต่อไปและต้องมีคนมาดูด้วยตา
const SURVEY_MAX_FID = 41;

export function splitWeir(fc: FeatureCollection): {
  weir: FeatureCollection;
  survey: FeatureCollection;
} {
  const surveyRows: Feature[] = [];
  const weirRows: Feature[] = [];

  for (const f of fc.features) {
    const fid = Number(f.properties?.fid);
    if (!Number.isFinite(fid)) {
      throw new Error(`แถวฝายไม่มี fid: ${JSON.stringify(f.properties)}`);
    }
    (fid <= SURVEY_MAX_FID ? surveyRows : weirRows).push(f);
  }

  const surveyedAt = (f: Feature) => ({
    surveyed_at: toIsoDate(f.properties?.Date),
  });

  return {
    // LAT/LON ทิ้งเพราะซ้ำกับ geometry อยู่แล้ว เก็บไว้ก็มีแต่จะขัดกันเองเมื่อหมุด
    // ถูกย้าย — เหตุผลเดียวกับที่เคยทิ้ง E/N ของหมุดรังวัดป่าชุมชน
    survey: pick(surveyRows, { Name: 'photo', Altitude: 'elevation_m' }, surveyedAt),
    weir: pick(weirRows, { loss: 'name', cause: 'note' }, surveyedAt),
  };
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/forest-prep.test.ts`
Expected: PASS — 13 tests

- [ ] **Step 5: commit**

```bash
git add src/lib/forest-prep.ts src/lib/forest-prep.test.ts
git commit -m "feat(forest): แยกฝาย 13 จุดออกจากจุดสำรวจ 41 จุดด้วยช่วง fid"
```

---

## Task 7: ล้างฟิลด์อีกสี่ชั้น

**Files:**
- Modify: `src/lib/forest-prep.ts`
- Modify: `src/lib/forest-prep.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ต่อท้าย `src/lib/forest-prep.test.ts`:

```ts
import { prepKortorchor, prepPermanent, prepReserve, prepStream } from '@/lib/forest-prep';

describe('prepReserve', () => {
  it('เหลือหกฟิลด์ — bbox กับคอลัมน์ค่าเดียวหายหมด', () => {
    const out = prepReserve(
      coll([
        feat({
          NRF_CODE: 'K1.002',
          FR_NAME: 'ป่าอินทขิล',
          Province: 'เชียงใหม่',
          AREA_RAI: 7625,
          rai_GIS: 7646.4375,
          'สจป': 'สจป.ที่ 1 (เชียงใหม่)',
          'ภาค': '3',
          Typ: 'ป่าสงวนแห่งชาติ',
          Xmin: 494413.9307,
          Xmax: 499218.0433,
          Ymin: 2114252.8073,
          Ymax: 2118830.4627,
        }),
      ])
    );
    expect(out.features[0].properties).toEqual({
      nrf_code: 'K1.002',
      name: 'ป่าอินทขิล',
      province: 'เชียงใหม่',
      rai_gazette: 7625,
      rai_rfd: 7646.4375,
      office: 'สจป.ที่ 1 (เชียงใหม่)',
    });
  });
});

describe('prepPermanent', () => {
  it('แปลง area_gis จากตารางเมตรเป็นไร่ และทิ้งคอลัมน์ว่าง', () => {
    const out = prepPermanent(
      coll([
        feat({
          objectid: 366,
          name_th: 'ป่าชุมชน',
          per_id: 'pf00330',
          name_en: '',
          area_pres: 0,
          area_gis: 90022.744,
          mod_date: '',
          per_type: 'ป่าไม้ถาวร',
        }),
      ])
    );
    expect(out.features[0].properties).toEqual({
      per_id: 'pf00330',
      name: 'ป่าชุมชน',
      rai_rfd: 56.26,
    });
  });

  it('area_gis อ่านไม่ออก → ไม่มีฟิลด์ rai_rfd ไม่ใช่ NaN', () => {
    const out = prepPermanent(coll([feat({ per_id: 'pf1', name_th: 'ก', area_gis: 'x' })]));
    expect(out.features[0].properties).toEqual({ per_id: 'pf1', name: 'ก' });
  });
});

describe('prepKortorchor', () => {
  it('เก็บเนื้อที่ชุดที่ตรงกับ Shape_Area ทิ้งชุดที่สองไว้ก่อน', () => {
    const out = prepKortorchor(
      coll([
        feat({
          OBJECTID: 1,
          Shape_Leng: 158295.23207,
          Shape_Area: 9496546.25174,
          Rai: 5935,
          Ngan: 1,
          wa: 36,
          A: 9194232.40836,
          R: 5746,
          Ng: 1,
          Twa: 58,
          RA: 5746.39526,
        }),
      ])
    );
    expect(out.features[0].properties).toEqual({ rai: 5935, ngan: 1, wa: 36 });
  });
});

describe('prepStream', () => {
  it('เก็บชื่อไทยกับชั้นคุณภาพ ทิ้งฟิลด์ผสมและฟิลด์อังกฤษ', () => {
    const out = prepStream(
      coll([
        feat({
          STRM_TH: 'น้ำแม่ขนิล',
          STRM_ENG: 'Nam Mae Khanin',
          ST_CLASS: 2,
          ST_CL_T: 'แม่น้ำที่มีน้ำไหลตลอดปี',
          ST_CL_E: 'Perennial stream',
          name: 'น้ำแม่ขนิล / แม่น้ำที่มีน้ำไหลตลอดปี',
        }),
      ])
    );
    expect(out.features[0].properties).toEqual({
      name: 'น้ำแม่ขนิล',
      class: 2,
      class_th: 'แม่น้ำที่มีน้ำไหลตลอดปี',
    });
  });

  it('ลำน้ำไม่มีชื่อ (262 จาก 327 เส้น) ก็ยังได้ชั้นคุณภาพ', () => {
    const out = prepStream(
      coll([feat({ STRM_TH: null, ST_CLASS: 3, ST_CL_T: 'แม่น้ำที่มีน้ำไหลไม่ตลอดปี' })])
    );
    expect(out.features[0].properties).toEqual({
      class: 3,
      class_th: 'แม่น้ำที่มีน้ำไหลไม่ตลอดปี',
    });
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/forest-prep.test.ts`
Expected: FAIL — `prepReserve is not a function`

- [ ] **Step 3: เขียนโค้ด**

ต่อท้าย `src/lib/forest-prep.ts`:

```ts
// ── ชั้นอ้างอิงของกรมป่าไม้ ──────────────────────────────────────────────────

/**
 * ป่าสงวนแห่งชาติ 26 ป่า
 *
 * คีย์เป็น nrf_code ไม่ใช่ชื่อ เพราะ "ป่าแม่ยวมฝั่งซ้าย" มีสองแถวในไฟล์ ถ้าใช้ชื่อ
 * จะติดด่าน duplicate-key ทันที (เหตุผลเดียวกับที่ถนนต้องใช้คีย์ประกอบ)
 *
 * ทิ้ง Xmin/Xmax/Ymin/Ymax เพราะเป็น bbox ที่ซ้ำกับ geometry อยู่แล้ว ส่วน ภาค กับ
 * Typ เป็นค่าเดียวกันทุกแถว จึงไม่ได้บอกอะไรที่ชื่อเลเยอร์ไม่ได้บอก
 */
export function prepReserve(fc: FeatureCollection): FeatureCollection {
  return pick(fc.features, {
    NRF_CODE: 'nrf_code',
    FR_NAME: 'name',
    Province: 'province',
    AREA_RAI: 'rai_gazette',
    rai_GIS: 'rai_rfd',
    'สจป': 'office',
  });
}

/**
 * ป่าไม้ถาวร 29 แปลง
 *
 * ทิ้ง objectid ด้วยเหตุผลเดียวกับที่ชั้นอาคารไม่ตั้งคีย์: ArcGIS แจกใหม่ทุกรอบ export
 * ส่วน per_id (pf00330) เป็นรหัสจริงที่คงที่ และ name_en/mod_date ว่างทั้งคอลัมน์
 * (0 จาก 29 แถว) ส่วน area_pres เป็น 0 ทุกแถว
 *
 * แปลง area_gis จากตารางเมตรเป็นไร่เพื่อให้หน่วยตรงกับชั้นอื่น ปัดสองตำแหน่งตายตัว
 * ด้วยเหตุผลเดียวกับ area_rai — ทศนิยม float เต็มความละเอียดทำให้ sha256 ของไฟล์เดิม
 * เปลี่ยนทุกครั้งที่อัปซ้ำ แล้วตรรกะ "ข้ามถ้า sha ตรง" ใช้ไม่ได้อีกเลย
 */
const SQM_PER_RAI = 1600;

export function prepPermanent(fc: FeatureCollection): FeatureCollection {
  return pick(fc.features, { per_id: 'per_id', name_th: 'name' }, (f) => {
    const sqm = Number(f.properties?.area_gis);
    if (!Number.isFinite(sqm)) return {};
    return { rai_rfd: Math.round((sqm / SQM_PER_RAI) * 100) / 100 };
  });
}

/**
 * วงรอบ คทช. ป่าแม่ท่าช้าง–ป่าแม่ขนิน 1 วง
 *
 * ไฟล์มีเนื้อที่สองชุดในแถวเดียวกัน: Rai/Ngan/wa = 5,935 ไร่ 1 งาน 36 วา (ตรงกับ
 * Shape_Area) กับ R/Ng/Twa/RA = 5,746 ไร่ 1 งาน 58 วา (ตรงกับ A) ต่างกัน 189 ไร่
 * น่าจะเป็นวงรอบทั้งหมด vs พื้นที่จัดสรรจริง แต่ยังไม่มีใครยืนยัน
 *
 * เก็บชุดใหญ่ไว้ชุดเดียวก่อน และห้ามเปิดสาธารณะจนกว่าจะถามเจ้าของข้อมูลได้ว่าชุดไหน
 * คืออะไร — ตัวเลขเนื้อที่ผิดบนพอร์ทัลราชการคือสิ่งที่คนเอาไปอ้างต่อ
 */
export function prepKortorchor(fc: FeatureCollection): FeatureCollection {
  return pick(fc.features, { Rai: 'rai', Ngan: 'ngan', wa: 'wa' });
}

/**
 * แหล่งน้ำ 327 เส้น
 *
 * ทิ้งฟิลด์ name ของต้นทางเพราะเป็นสองฟิลด์เชื่อมด้วย " / " ที่ซ้ำกับ STRM_TH และ
 * ST_CL_T อยู่แล้ว ส่วนฟิลด์อังกฤษไม่มีที่ใช้บนหน้าเว็บภาษาไทย
 *
 * เก็บทั้งรหัสชั้นคุณภาพ (1–6) และคำอธิบายไทย: รหัสใช้กำหนดสีเส้นใน map-style
 * ส่วนคำอธิบายใช้ในป๊อปอัป ทั้งคู่จับคู่กัน 1:1 ในไฟล์
 */
export function prepStream(fc: FeatureCollection): FeatureCollection {
  return pick(fc.features, {
    STRM_TH: 'name',
    ST_CLASS: 'class',
    ST_CL_T: 'class_th',
  });
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/forest-prep.test.ts`
Expected: PASS — 19 tests

- [ ] **Step 5: commit**

```bash
git add src/lib/forest-prep.ts src/lib/forest-prep.test.ts
git commit -m "feat(forest): ล้างฟิลด์ป่าสงวน ป่าถาวร คทช. และแหล่งน้ำ"
```

---

## Task 8: `forest-registry.ts` — เมล็ดพันธุ์ 7 ชั้น

**Files:**
- Create: `src/lib/forest-registry.ts`

- [ ] **Step 1: เขียนไฟล์**

```ts
// src/lib/forest-registry.ts
import type { ForestLayer } from '@/types/forest';

// นิยามชั้นข้อมูลป่าไม้ตั้งต้น 7 ชั้น สำหรับ scripts/import-forest-map.mts เท่านั้น
//
// **ไฟล์นี้ไม่ใช่แหล่งความจริง** — ตั้งแต่รอบ 3 เจ้าหน้าที่สร้างชั้นเองได้ที่
// /admin/forest/new ฐานข้อมูลจึงเป็นความจริง ถ้าปล่อยให้ไฟล์นี้เป็นแหล่งความจริง
// วันที่มีคนรันสคริปต์ซ้ำ ชั้นที่เจ้าหน้าที่เพิ่มเองจะหายหรือถูกเขียนทับ
//
// ทุกชั้นตั้ง coordinatePrecision เป็น 6 (= 11 ซม. ที่ละติจูดของน้ำแพร่) เพราะไฟล์
// ต้นทางพกทศนิยมมา 14 ตำแหน่งทุกชั้น

export type ForestSeed = {
  /** ชื่อไฟล์ข้อมูลบนแผนที่ป่าไม้ที่เป็นต้นทางของชั้นนี้ */
  source: string;
  /** จำนวน feature ที่ต้องได้หลังล้างฟิลด์ — ไม่ตรง = หยุดนำเข้าทั้งงาน */
  expect: number;
  layer: Omit<ForestLayer, 'currentVersionNo' | 'updatedAt' | 'updatedBy'>;
};

const PRECISION = 6;

export const FOREST_SEEDS: ForestSeed[] = [
  {
    source: '_7.js',
    expect: 4,
    layer: {
      id: 'community-forest',
      title: 'ป่าชุมชน',
      description: 'ขอบเขตป่าชุมชนหมู่ 7, 9, 10 และ 11',
      geometryType: 'MultiPolygon',
      keyFields: ['moo'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['moo', 'area_rai', 'area_km2'],
      // ชั้นเดียวที่เปิด — อีกสามชั้นรูปปิดมีเนื้อที่ทางการติดมาในไฟล์แล้ว ถ้าเปิดจะได้
      // ตัวเลขที่สามที่ไม่ตรงกับอีกสอง แล้วคนเอาไปอ้างผิดบนพอร์ทัลราชการ
      computeArea: true,
      coordinatePrecision: PRECISION,
      defaultOn: true,
      order: 1,
    },
  },
  {
    source: '_8.js',
    expect: 13,
    layer: {
      id: 'forest-weir',
      title: 'ฝาย',
      description: 'ทะเบียนฝายที่สร้างในพื้นที่ป่า ปี 2564–2568',
      geometryType: 'Point',
      keyFields: ['name'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['name', 'surveyed_at', 'note'],
      coordinatePrecision: PRECISION,
      defaultOn: true,
      order: 2,
    },
  },
  {
    source: '_8.js',
    expect: 41,
    layer: {
      id: 'forest-weir-survey',
      title: 'จุดสำรวจฝาย มิ.ย. 2568',
      description: 'จุดที่เดินสำรวจและถ่ายรูปเมื่อ 18 และ 20 มิถุนายน 2568',
      geometryType: 'Point',
      // ชื่อไฟล์รูปเป็นทั้งตัวตนของหมุดและตัวชี้ไปที่รูป — รอบ 4 จับคู่รูปด้วยคีย์นี้ตรง ๆ
      keyFields: ['photo'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['surveyed_at', 'elevation_m'],
      coordinatePrecision: PRECISION,
      defaultOn: true,
      publishPhotos: false,
      order: 3,
    },
  },
  {
    source: '_4.js',
    expect: 1,
    layer: {
      id: 'forest-kortorchor',
      title: 'วงรอบ คทช. ป่าแม่ท่าช้าง–ป่าแม่ขนิน',
      description: 'วงรอบพื้นที่ คทช. เนื้อที่ 5,935 ไร่ 1 งาน 36 ตารางวา',
      geometryType: 'MultiPolygon',
      // แถวเดียว ไม่มีอะไรให้ชนกัน — ด่าน duplicate-key จึงไม่มีงานทำ
      keyFields: [],
      keyComposition: [],
      visibility: 'public',
      // เนื้อที่ยังไม่เปิดจนกว่าจะรู้ว่าชุดไหนคืออะไร (ดู prepKortorchor)
      publicFields: [],
      coordinatePrecision: PRECISION,
      defaultOn: true,
      order: 4,
    },
  },
  {
    source: '_5.js',
    expect: 327,
    layer: {
      id: 'forest-stream',
      title: 'แหล่งน้ำ',
      description: 'ลำน้ำและแหล่งน้ำจำแนกตามชั้นคุณภาพ 6 ประเภท',
      geometryType: 'MultiLineString',
      // ชื่อลำน้ำเติมแค่ 65 จาก 327 เส้น ตั้งเป็นคีย์ไม่ได้ — เทียบแค่จำนวนเหมือนชั้นอาคาร
      keyFields: [],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['name', 'class_th'],
      coordinatePrecision: PRECISION,
      defaultOn: false,
      order: 5,
    },
  },
  {
    source: '_2.js',
    expect: 26,
    layer: {
      id: 'forest-reserve',
      title: 'ป่าสงวนแห่งชาติ',
      description: 'ขอบเขตป่าสงวนแห่งชาติ เชียงใหม่ ลำพูน และแม่ฮ่องสอน',
      geometryType: 'MultiPolygon',
      keyFields: ['nrf_code'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['nrf_code', 'name', 'province', 'rai_gazette', 'rai_rfd', 'office'],
      coordinatePrecision: PRECISION,
      defaultOn: false,
      order: 6,
    },
  },
  {
    source: '_3.js',
    expect: 29,
    layer: {
      id: 'forest-permanent',
      title: 'ป่าไม้ถาวร',
      description: 'ขอบเขตป่าไม้ถาวรตามมติคณะรัฐมนตรี',
      geometryType: 'MultiPolygon',
      keyFields: ['per_id'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['per_id', 'name', 'rai_rfd'],
      coordinatePrecision: PRECISION,
      defaultOn: false,
      order: 7,
    },
  },
];
```

- [ ] **Step 2: ตรวจไทป์**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: commit**

```bash
git add src/lib/forest-registry.ts
git commit -m "feat(forest): นิยามชั้นข้อมูลป่าไม้ตั้งต้น 7 ชั้น"
```

---

## Task 9: `scripts/import-forest-map.mts`

**Files:**
- Create: `scripts/import-forest-map.mts`
- Modify: `package.json` (แทนที่ script `import:forest`)

- [ ] **Step 1: เขียนสคริปต์**

```ts
// scripts/import-forest-map.mts

// นำเข้าชั้นข้อมูลป่าไม้ 7 ชั้นจากแผนที่ป่าไม้ครั้งแรก
//
//   npm run import:forest
//
// สี่ข้อที่ตั้งใจ (สามข้อแรกเหมือน import-map-layers.ts):
//   1. ปล่อยทุกเวอร์ชันไว้เป็น "ร่าง" ไม่เผยแพร่อัตโนมัติ — publicFields ที่ registry
//      ตั้งให้เป็นแค่ข้อเสนอ การเปิดข้อมูลสู่สาธารณะไม่ควรเป็นผลข้างเคียงของการรันสคริปต์
//   2. รันซ้ำได้ — sha256 ตรงกับเวอร์ชันที่มีอยู่แล้วก็ข้าม
//   3. เดินผ่าน ingestMapFile ตัวเดียวกับ API route ไม่ให้สคริปต์กลายเป็นทางลัดที่ข้าม
//      ด่านตรวจไปโดยไม่มีใครรู้
//   4. ตรวจยันสามด่านก่อนเขียนลงฐาน ไม่ผ่าน = หยุดทั้งงาน ไม่นำเข้าครึ่ง ๆ กลาง ๆ
//
// สคริปต์ไม่ปัดพิกัดเองและไม่คำนวณพื้นที่เอง — ingestMapFile ทำให้ตาม
// coordinatePrecision/computeArea ของเลเยอร์ เพื่อให้ไฟล์ที่เจ้าหน้าที่ลากวางเองใน
// อนาคตได้ผลเท่ากันเป๊ะ

// ต้องเป็น import แรกสุด — ดูเหตุผลใน scripts/load-env.ts
import './load-env';
import crypto from 'node:crypto';
// path แบบ relative ไม่ใช่ alias @/ — tsx ไม่ resolve paths ใน tsconfig ให้
import {
  isCloudinaryConfigured,
  MAP_FOLDER_FULL,
  uploadRawText,
} from '../src/lib/cloudinary';
import {
  prepCommunityForest,
  prepKortorchor,
  prepPermanent,
  prepReserve,
  prepStream,
  registryRai,
  splitWeir,
} from '../src/lib/forest-prep';
import { FOREST_SEEDS } from '../src/lib/forest-registry';
import {
  buildNewVersion,
  getLayer,
  insertVersion,
  listVersions,
  nextVersionNo,
  upsertLayer,
} from '../src/lib/forest-store';
import { ingestMapFile } from '../src/lib/map-ingest';
import { parseMapFile } from '../src/lib/map-parse';
import { closeDb } from '../src/lib/mongodb';
import type { ForestLayer } from '../src/types/forest';
import type { FeatureCollection } from '../src/types/map';

const BASE = process.env.FOREST_MAP_BASE ?? 'https://forest-map.namphraesmartcity.ai';
const ACTOR = 'import-forest-map';

/** คลาดเคลื่อนสูงสุดที่ยอมให้ระหว่างพื้นที่ที่คำนวณกับทะเบียนในไฟล์ */
const AREA_TOLERANCE = 0.001; // 0.1%

async function fetchCollection(source: string): Promise<FeatureCollection> {
  const url = `${BASE}/data/${source}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ดึง ${url} ไม่สำเร็จ: HTTP ${res.status}`);
  const text = await res.text();
  // ไฟล์เป็น qgis2web (var json_x = {...}) ซึ่ง parseMapFile รองรับอยู่แล้ว
  const parsed = parseMapFile(text, source);
  if (!parsed.ok) throw new Error(`แกะ ${source} ไม่ออก: ${parsed.message}`);
  return parsed.fc;
}

type Built = {
  /** ทุกชั้นที่ล้างฟิลด์แล้ว คีย์ด้วย layerId */
  collections: Record<string, FeatureCollection>;
  /** เนื้อที่ตามทะเบียนของป่าชุมชนแต่ละแปลง เรียงตรงกับลำดับ feature */
  communityRegistry: (number | null)[];
};

async function buildAll(): Promise<Built> {
  const [community, weirRaw, kortorchor, stream, reserve, permanent] = await Promise.all([
    fetchCollection('_7.js'),
    fetchCollection('_8.js'),
    fetchCollection('_4.js'),
    fetchCollection('_5.js'),
    fetchCollection('_2.js'),
    fetchCollection('_3.js'),
  ]);

  // ด่านที่ 2: ช่วง fid ต้องแบ่งที่ 41/42 พอดี ไม่งั้นแปลว่าต้นทางแก้ไฟล์แล้ว
  const fids = weirRaw.features.map((f) => Number(f.properties?.fid));
  const survey = fids.filter((n) => n <= 41);
  const weirs = fids.filter((n) => n > 41);
  if (survey.length !== 41 || weirs.length !== 13) {
    throw new Error(
      `ช่วง fid ของชั้นฝายเปลี่ยนไป: ได้จุดสำรวจ ${survey.length} (คาด 41) ` +
        `และฝาย ${weirs.length} (คาด 13) — ต้องมีคนดูไฟล์ต้นทางด้วยตาก่อนนำเข้าต่อ`
    );
  }

  const { weir, survey: surveyFc } = splitWeir(weirRaw);

  return {
    collections: {
      'community-forest': prepCommunityForest(community),
      'forest-weir': weir,
      'forest-weir-survey': surveyFc,
      'forest-kortorchor': prepKortorchor(kortorchor),
      'forest-stream': prepStream(stream),
      'forest-reserve': prepReserve(reserve),
      'forest-permanent': prepPermanent(permanent),
    },
    // ด่านที่ 3 เก็บค่าไว้ตรงนี้เพราะ prepCommunityForest ตัดฟิลด์ทะเบียนทิ้งไปแล้ว
    // แล้วค่อยเทียบหลัง ingest ใน importSeed()
    communityRegistry: community.features.map((f) => registryRai(f)),
  };
}

/** เทียบพื้นที่ที่ computeArea คำนวณกับทะเบียนในไฟล์ — คลาดเกิน 0.1% = หยุด */
function assertCommunityArea(fc: FeatureCollection, registry: (number | null)[]): void {
  fc.features.forEach((f, i) => {
    const expected = registry[i];
    const got = Number(f.properties?.area_rai);
    if (expected === null || !Number.isFinite(got)) {
      throw new Error(`ป่าชุมชนแถวที่ ${i + 1}: เทียบพื้นที่ไม่ได้`);
    }
    const off = Math.abs(got - expected) / expected;
    if (off > AREA_TOLERANCE) {
      throw new Error(
        `ป่าชุมชนหมู่ ${f.properties?.moo}: คำนวณได้ ${got} ไร่ แต่ทะเบียนเขียน ` +
          `${expected.toFixed(2)} ไร่ (ต่างกัน ${(off * 100).toFixed(3)}%) — ` +
          'เกินเกณฑ์ 0.1% แปลว่าการแปลงพิกัดเพี้ยน ไม่ใช่ขอบเขตเปลี่ยน'
      );
    }
    process.stdout.write(
      `     หมู่ ${f.properties?.moo}: คำนวณ ${got} ไร่ · ทะเบียน ${expected.toFixed(2)} ไร่ ` +
        `(ต่าง ${(off * 100).toFixed(3)}%)\n`
    );
  });
}

async function importSeed(
  seed: (typeof FOREST_SEEDS)[number],
  fc: FeatureCollection,
  communityRegistry: (number | null)[]
): Promise<void> {
  process.stdout.write(`\n── ${seed.layer.title} (${seed.layer.id})\n`);

  // ด่านที่ 1: จำนวน feature ต้องตรงเป๊ะ
  if (fc.features.length !== seed.expect) {
    throw new Error(
      `${seed.layer.id}: ได้ ${fc.features.length} รายการ แต่คาด ${seed.expect} — ` +
        'ไฟล์ต้นทางเปลี่ยนไปแล้ว ต้องมีคนดูด้วยตาก่อนนำเข้าต่อ'
    );
  }

  const existing = await getLayer(seed.layer.id);
  const layer: ForestLayer = existing ?? {
    ...seed.layer,
    currentVersionNo: null,
    updatedAt: new Date().toISOString(),
    updatedBy: ACTOR,
  };
  if (!existing) await upsertLayer(layer);

  const text = JSON.stringify(fc);
  const fileName = `${seed.layer.id}.geojson`;
  const result = ingestMapFile({ text, fileName, layer, previous: null });
  if (!result.ok) throw new Error(`${seed.layer.id}: ${result.message}`);

  if (seed.layer.id === 'community-forest') assertCommunityArea(result.fc, communityRegistry);

  const versions = await listVersions(layer.id);
  if (versions.some((v) => v.source.sha256 === result.sha256)) {
    process.stdout.write('   – เนื้อข้อมูลตรงกับเวอร์ชันที่มีอยู่แล้ว ข้าม\n');
    return;
  }
  if (result.blocked) {
    for (const c of result.checks) {
      if (c.level === 'error') process.stdout.write(`   ✗ [error] ${c.message}\n`);
    }
    throw new Error(`${seed.layer.id}: ไม่ผ่านด่านตรวจ`);
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
      note: `นำเข้าครั้งแรกจาก ${BASE}/data/${seed.source}`,
    })
  );

  process.stdout.write(
    `   ✓ ร่าง v${versionNo} — ${result.stats.featureCount.toLocaleString('th-TH')} รายการ, ` +
      `${result.stats.fields.length} ฟิลด์, ${(uploaded.bytes / 1048576).toFixed(2)} MB\n`
  );
  for (const c of result.checks) {
    process.stdout.write(`     [${c.level}] ${c.code} ×${c.count}\n`);
  }
}

async function main(): Promise<void> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'ยังไม่ได้ตั้งค่า Cloudinary — คลังไฟล์ป่าไม้ต้องมีที่เก็บไฟล์ กรอก ' +
        'CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET ก่อน'
    );
  }

  process.stdout.write(`ดึงข้อมูลจาก ${BASE}\n`);
  const built = await buildAll();

  for (const seed of FOREST_SEEDS) {
    await importSeed(seed, built.collections[seed.layer.id], built.communityRegistry);
  }

  process.stdout.write(
    '\nเสร็จแล้ว — ทุกเวอร์ชันอยู่ในสถานะ "ร่าง"\n' +
      'เปิด /admin/forest เพื่อตรวจรายการฟิลด์ที่จะเปิดสาธารณะ แล้วกดเผยแพร่ทีละชั้น\n' +
      'อย่าเพิ่งเปิดเนื้อที่ของชั้น คทช. จนกว่าจะถามเจ้าของข้อมูลได้ว่าเนื้อที่สองชุด' +
      'ในไฟล์ต่างกันตรงไหน\n'
  );

  // ไม่ปิดด้วย process.exit() เฉย ๆ — MongoDB driver เปิด socket ค้างไว้ในพูลการ
  // เชื่อมต่อ ซึ่งกัน event loop ไม่ให้ออกเอง (ไม่ใช่แค่ตอนสำเร็จ — ดู catch ด้านล่าง)
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
```

- [ ] **Step 2: ชี้ npm script ไปที่ไฟล์ใหม่**

ใน `package.json` แทนที่บรรทัด
`"import:forest": "tsx scripts/import-community-forest.mts"` ด้วย:

```json
    "import:forest": "tsx scripts/import-forest-map.mts",
```

- [ ] **Step 3: ตรวจไทป์แล้วรันจริง**

ขั้นนี้ต้องมีของครบสามอย่าง ไม่งั้นจะหยุดตั้งแต่บรรทัดแรก: `MONGODB_URI`,
`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` ใน `.env.local`
และเน็ตที่เข้า `forest-map.namphraesmartcity.ai` ได้ (ดึงรวมกัน ~11 MB)

```bash
npx tsc --noEmit
npm run import:forest
```

Expected: พิมพ์ 7 บล็อก แต่ละบล็อกลงท้ายด้วย `✓ ร่าง v1` และบล็อกป่าชุมชนแสดงบรรทัดเทียบพื้นที่
สี่บรรทัดโดยทุกบรรทัดต่างกันไม่เกิน 0.1%

- [ ] **Step 4: commit**

```bash
git add scripts/import-forest-map.mts package.json
git commit -m "feat(forest): สคริปต์นำเข้า 7 ชั้นพร้อมด่านตรวจยันสามชั้น"
```

---

## Task 10: ย้ายชั้นป่าชุมชนออกจากโดเมนแผนที่

ชั้น `community-forest` (2 แปลง) และ `community-forest-point` (176 หมุด) ยังอยู่ในโดเมน
แผนที่ ถ้าปล่อยไว้ `/map` จะโชว์ป่าชุมชน 2 แปลงขณะที่ `/forest` โชว์ 4 แปลง

**Files:**
- Create: `scripts/drop-legacy-forest-layers.mts`
- Delete: `scripts/import-community-forest.mts`, `src/lib/map-forest-prep.ts`,
  `src/lib/map-forest-prep.test.ts`

- [ ] **Step 1: เขียนสคริปต์ย้ายข้อมูล**

```ts
// scripts/drop-legacy-forest-layers.mts

// ลบชั้นป่าชุมชนชุดเก่าออกจากโดเมนแผนที่ — รันครั้งเดียวหลัง import:forest สำเร็จ
//
//   npx tsx scripts/drop-legacy-forest-layers.mts
//
// community-forest      2 แปลง (หมู่ 10, 11) → ย้ายไปโดเมนป่าไม้แล้วเป็น 4 แปลง
// community-forest-point 176 หมุด            → หมุดรังวัดที่ใช้ลากขอบเขตเสร็จแล้ว
//                                              ขอบเขตอยู่ในชั้นป่าชุมชนเรียบร้อย
//
// ลบไฟล์บน Cloudinary ตามไปด้วย ไม่งั้นไฟล์กำพร้าจะกองอยู่โดยไม่มีอะไรอ้างถึงและ
// ไม่มีใครรู้ว่ามันคืออะไร — หลักเดียวกับที่ versions.ts ลบไฟล์ทิ้งทันทีเมื่อไม่ผ่านด่าน
//
// รันซ้ำได้: ชั้นที่ถูกลบไปแล้วจะรายงานว่าไม่มีแล้วข้ามไป

import './load-env';
import { destroyRawAsset } from '../src/lib/cloudinary';
import {
  deleteLayer,
  deleteVersions,
  getLayer,
  listVersions,
} from '../src/lib/map-store';
import { closeDb } from '../src/lib/mongodb';

const LEGACY = ['community-forest', 'community-forest-point'];

async function main(): Promise<void> {
  for (const id of LEGACY) {
    const layer = await getLayer(id);
    if (!layer) {
      process.stdout.write(`– ${id}: ไม่มีอยู่แล้ว ข้าม\n`);
      continue;
    }

    const versions = await listVersions(id);
    process.stdout.write(`── ${id} (${layer.title}) — ${versions.length} เวอร์ชัน\n`);

    for (const v of versions) {
      for (const asset of [v.fullAsset, v.publicAsset]) {
        if (!asset) continue;
        try {
          await destroyRawAsset(asset.publicId);
          process.stdout.write(`   ลบไฟล์ ${asset.publicId}\n`);
        } catch (err) {
          // ไฟล์ที่หายไปแล้วไม่ใช่เหตุให้หยุด — เป้าหมายคือไม่เหลือไฟล์กำพร้า
          process.stdout.write(`   ! ลบ ${asset.publicId} ไม่สำเร็จ: ${String(err)}\n`);
        }
      }
    }

    await deleteVersions(id);
    await deleteLayer(id);
    process.stdout.write(`   ✓ ลบทะเบียนแล้ว\n`);
  }

  process.stdout.write('\nเสร็จแล้ว — /map จะไม่มีชั้นป่าชุมชนอีกต่อไป\n');
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
```

- [ ] **Step 2: รันสคริปต์**

Run: `npx tsx scripts/drop-legacy-forest-layers.mts`
Expected: ลบทั้งสองชั้นพร้อมไฟล์ แล้วพิมพ์ `เสร็จแล้ว`

- [ ] **Step 3: ลบไฟล์ที่หมดอายุ**

```bash
git rm scripts/import-community-forest.mts src/lib/map-forest-prep.ts src/lib/map-forest-prep.test.ts
```

`map-forest-prep.ts` เขียนคำพยากรณ์ของตัวเองไว้ในหัวไฟล์ว่า *"ไฟล์นี้ตายหลังนำเข้าครั้งแรกเสร็จ"*
— รอบนี้คือรอบนั้น

- [ ] **Step 4: ตรวจว่าไม่มีใครอ้างถึงของที่ลบไป**

```bash
grep -rn "map-forest-prep\|import-community-forest" src scripts package.json README.md
npx tsc --noEmit
npm test
```

Expected: `grep` ไม่เจออะไร (ยกเว้นถ้ายังมีใน README — แก้ใน Task 11) · `tsc` และ `npm test` ผ่าน

- [ ] **Step 5: commit**

```bash
git add -A scripts src/lib
git commit -m "chore(forest): ย้ายป่าชุมชนออกจากโดเมนแผนที่ ลบสคริปต์นำเข้าชุดเก่า"
```

---

## Task 11: README

**Files:**
- Modify: `README.md:263-285` (ตารางเลเยอร์และหัวข้อ "ป่าชุมชน")

- [ ] **Step 1: แก้ตารางเลเยอร์**

ลบสองบรรทัดนี้ออกจากตาราง "เลเยอร์ที่นำเข้าไว้แล้ว":

```
| ป่าชุมชน `community-forest` | Polygon | 2 | `moo` |
| หมุดพิกัดป่าชุมชน `community-forest-point` | Point | 176 | `moo` + `point_n` |
```

- [ ] **Step 2: แทนที่หัวข้อ "### ป่าชุมชน" ทั้งหัวข้อ**

```markdown
### ข้อมูลป่าไม้

ข้อมูลป่าไม้อยู่คนละคลังกับแผนที่ — คนละ collection (`forestLayers` / `forestVersions`)
คนละหน้า และคนละสิทธิ์ แต่เดินผ่านด่านตรวจและระบบเวอร์ชันชุดเดียวกันทั้งหมด

| ชั้น | ชนิด | จำนวน | คีย์ประจำรายการ |
|---|---|---|---|
| ป่าชุมชน `community-forest` | MultiPolygon | 4 | `moo` |
| ฝาย `forest-weir` | Point | 13 | `name` |
| จุดสำรวจฝาย มิ.ย. 2568 `forest-weir-survey` | Point | 41 | `photo` |
| วงรอบ คทช. `forest-kortorchor` | MultiPolygon | 1 | (ไม่มี — แถวเดียว) |
| แหล่งน้ำ `forest-stream` | MultiLineString | 327 | (ไม่มี — ชื่อเติมแค่ 65/327) |
| ป่าสงวนแห่งชาติ `forest-reserve` | MultiPolygon | 26 | `nrf_code` |
| ป่าไม้ถาวร `forest-permanent` | MultiPolygon | 29 | `per_id` |

นำเข้าครั้งแรกด้วย `npm run import:forest` ซึ่งดึงจาก `forest-map.namphraesmartcity.ai`
แล้วล้างฟิลด์ให้ก่อน (ไฟล์ต้นทางพก bbox, path บนไดรฟ์ `D:`, คอลัมน์ว่างทั้งคอลัมน์ และ
ชื่อฟิลด์ที่ถูกตัดกลางคำจนอ่านไม่ออกมาด้วย)

**พื้นที่ไร่/ตร.กม. ระบบคำนวณให้เองเฉพาะชั้นป่าชุมชน** — อีกสามชั้นรูปปิดมีเนื้อที่ทางการ
ติดมาในไฟล์แล้ว ถ้าคำนวณให้ด้วยจะได้ตัวเลขที่สามที่ไม่ตรงกับอีกสอง ป้ายกำกับจึงต้องแยกกัน
ให้ชัด: `area_rai` คือ **"พื้นที่โดยประมาณ"** จากรูปทรง · `rai_gazette` คือ
**"เนื้อที่ตามกฎกระทรวง"** · `rai_rfd` คือ **"เนื้อที่ตาม GIS กรมป่าไม้"**

**พิกัดถูกปัดเหลือทศนิยม 6 ตำแหน่งตอนอัป** (= 11 ซม. ที่ละติจูดนี้) เป็นผลของ
`coordinatePrecision` บนชั้น ซึ่งทำงานทั้งทางสคริปต์และทางลากไฟล์วาง ไฟล์ต้นทางพก
ทศนิยมมา 14 ตำแหน่งซึ่งเป็นขยะจากการแปลงพิกัด ไม่ใช่ความแม่นยำจริง — ปัดแล้วป่าสงวน
กับป่าถาวรรวมกันเล็กลงจาก 11.1 เหลือ 6.4 MB

> ⚠️ **เนื้อที่ของชั้น คทช. ยังไม่เปิดสาธารณะ** ไฟล์ต้นทางมีเนื้อที่สองชุดในแถวเดียวกัน
> ต่างกัน 189 ไร่ ต้องถามเจ้าของข้อมูลก่อนว่าชุดไหนคือวงรอบทั้งหมดและชุดไหนคือพื้นที่
> จัดสรรจริง
```

- [ ] **Step 3: ตรวจว่าไม่มีร่องรอยของเดิมค้าง**

Run: `grep -n "community-forest-point\|Shapefiles ป่าชุมชน\|import-community-forest" README.md`
Expected: ไม่เจออะไร

- [ ] **Step 4: commit**

```bash
git add README.md
git commit -m "docs: อัปเดต README ให้ตรงกับคลังข้อมูลป่าไม้ 7 ชั้น"
```

---

## เสร็จรอบ 1A แล้วได้อะไร

- `forestLayers` มี 7 ชั้น ทุกชั้นมีเวอร์ชัน 1 สถานะ **ร่าง** ไฟล์เต็มอยู่บน Cloudinary
- โดเมนแผนที่ไม่มีชั้นป่าชุมชนอีกต่อไป
- `map-store.test.ts` ผ่านโดยไม่ถูกแก้แม้บรรทัดเดียว — พิสูจน์ว่าการดึงโค้ดออกมาใช้ร่วม
  ไม่เปลี่ยนพฤติกรรมของแผนที่

**ยังทำไม่ได้จนกว่าจะถึงรอบ 1B:** เปิด `/admin/forest` ดูการ์ด · กดเผยแพร่ · ตั้งค่าฟิลด์
สาธารณะ — ทุกอย่างที่ต้องใช้ route กับสิทธิ์ `forest`
