# ป่าชุมชน — เลเยอร์ใหม่บนคลังไฟล์แผนที่

**วันที่:** 2026-08-14
**ต่อยอดจาก:** [2026-08-06-map-layer-management-design.md](2026-08-06-map-layer-management-design.md)

---

## คำถามตั้งต้น

> "มี shapefile ป่าชุมชน ต้องสร้าง endpoint ใหม่มารับหรือไม่"

**ไม่ต้องสร้าง endpoint รับไฟล์ใหม่** — `POST /api/admin/map/layers/[id]/versions` รับ shapefile
`.zip` อยู่แล้ว (แปลงเป็น GeoJSON ที่เบราว์เซอร์ด้วย `shpjs` ก่อนอัป)

**แต่ต้องสร้าง endpoint ใหม่จริง** คนละตัวกับที่คิด: `POST /api/admin/map/layers` สำหรับ
**สร้างเลเยอร์** — วันนี้ `upsertLayer()` ถูกเรียกจาก `scripts/import-map-layers.ts` ที่เดียว
`src/pages/api/admin/map/layers/index.ts` มีแค่ `GET` ผลคือเลเยอร์ใหม่ทุกชนิดต้องให้ dev รัน
สคริปต์จากเครื่องตัวเอง เจ้าหน้าที่ทำเองไม่ได้เลย

---

## สิ่งที่อยู่ในไฟล์ (แกะแล้ว ไม่ใช่คาดเดา)

`public/Shapefiles ป่าชุมชน.zip` — 7.9 MB, 45 ไฟล์, ชื่อไฟล์ภาษาไทยเข้ารหัส UTF-8 (flag bit 0x800)

| shapefile | รูปทรง | records | ฟิลด์ | ใช้ไหม |
|---|---|---|---|---|
| `พิกัดป่าชุมชนหมู่ 10` | Point | 59 | `point_n`, `E`, `N` | ✅ หมุด |
| `พิกัดป่าชุมชนหมู่ 10_polygon` | PolyLine | 1 | `begin`, `end` | ❌ ซ้ำกับ `_polygon1` |
| `พิกัดป่าชุมชนหมู่ 10_polygon1` | Polygon | 1 | `begin`, `end` | ✅ ขอบเขต |
| `พิกัดป่าชุมชนหมู่ 11` | Point | **0** | `point_n`, `E`, `N` | ❌ ว่างเปล่า |
| `พิกัดป่าชุมชนหมู่ 11_line` | PolyLine | 1 | `id` | ❌ ซ้ำกับ `_polygon` |
| `พิกัดป่าชุมชนหมู่ 11_point` | Point | 117 | `point_n`, `E`, `N` | ✅ หมุด (**.prj ผิด**) |
| `พิกัดป่าชุมชนหมู่ 11_polygon` | Polygon | 1 | `id` | ✅ ขอบเขต |
| `แผนที่ป่าชุมชนหมู่ที่ 102_modified.tif` | raster 46 MB | — | + `.points` | ❌ นอกขอบเขตรอบนี้ |

### สามปัญหาที่ทำให้อัปทั้ง zip ตรง ๆ ไม่ได้

1. **`shpjs` รวมทุก sub-layer ใน zip เป็นก้อนเดียว** (`map-shapefile-client.ts` — `parts.flatMap`)
   → Point + PolyLine + Polygon ปนกัน → ติดด่าน `geometry-type-mismatch` (error)

2. **`พิกัดป่าชุมชนหมู่ 11_point.prj` ประกาศระบบพิกัดผิด** — เขียนเป็น `GEOGCS["GCS_WGS_1984"]`
   (lat/lon) แต่พิกัดข้างในเป็น UTM zone 47N จริง `shpjs` จึงไม่แปลงให้ ทดสอบแล้วได้
   `[489711, 2069101]` ออกมาดิบ ๆ → ติดด่าน `outside-thailand` (error) แล้วลากทั้งไฟล์ตกไปด้วย
   ทั้งที่อีก 6 ไฟล์ .prj ถูกต้อง

3. **polygon ไม่มีฟิลด์บอกว่าเป็นหมู่ไหน** — หมู่ 10 มี `begin`/`end` (ค่าขยะจาก QGIS) หมู่ 11 มี
   `id` → ตั้ง `keyFields` ไม่ได้ และคนคลิกดูก็ไม่รู้ว่าป่าของหมู่ไหน

**ข้อดีคือด่านตรวจที่มีอยู่จับได้ครบตั้งแต่ก่อนเผยแพร่** ไม่ใช่ไปพังตอนขึ้นหน้าเว็บ

---

## ขอบเขตที่ตกลง

- **vector อย่างเดียว** — TIFF 46 MB เก็บไว้ก่อน ไม่ทำ raster overlay รอบนี้
- **เปิดสาธารณะทั้งขอบเขตและหมุด**
- **ทำ A ก่อน แล้วค่อย B** — สคริปต์นำเข้าครั้งเดียวให้ข้อมูลขึ้นแผนที่ แล้วค่อยทำ
  endpoint สร้างเลเยอร์เป็น PR แยก

---

## 1. เลเยอร์ใหม่ 2 ตัว

`MapLayer.geometryType` เป็นค่าเดียวต่อเลเยอร์ → Polygon กับ Point อยู่เลเยอร์เดียวกันไม่ได้

| | `community-forest` | `community-forest-point` |
|---|---|---|
| `title` | ป่าชุมชน | หมุดพิกัดป่าชุมชน |
| `description` | ขอบเขตป่าชุมชนหมู่ 10 และหมู่ 11 | หมุดพิกัดที่รังวัดขอบเขตป่าชุมชน |
| `geometryType` | `Polygon` | `Point` |
| featureCount | 2 | 176 (59 + 117) |
| ที่มา | `หมู่ 10_polygon1` + `หมู่ 11_polygon` | `หมู่ 10` + `หมู่ 11_point` |
| `keyFields` | `['moo']` | `['moo', 'point_n']` |
| `keyComposition` | `[]` | `[]` |
| `visibility` | `public` | `public` |
| `publicFields` | `['moo', 'area_rai', 'area_km2']` | `['moo', 'point_n']` |
| `computeArea` | `true` (ฟิลด์ใหม่) | — |
| `MapLayer.order` | 5 | 6 |

`geometryType` เป็น `Polygon` ไม่ใช่ `MultiPolygon` แบบเลเยอร์เดิม — ยืนยันจาก `shpjs` แล้วว่า
ไฟล์นี้ให้ `Polygon` วงเดียว ถ้าตั้งเป็น `MultiPolygon` จะติด `geometry-type-mismatch` ทันที

### ทำไม `keyFields` ของหมุดต้องเป็นคีย์ประกอบ

`point_n` เป็น 1–59 ในหมู่ 10 และ 1–117 ในหมู่ 11 → **ซ้ำข้ามหมู่ 59 ค่า** ถ้าใช้ `point_n`
อย่างเดียวจะติดด่าน `duplicate-key` เหตุผลเดียวกับที่ `road` ต้องใช้ `['full_id','zone_id']`

### ฟิลด์ที่ตัดทิ้ง

`begin`, `end`, `id` — ค่าที่ QGIS แจกเองตอนสร้างชั้นข้อมูล ไม่มีความหมายกับใคร
`E`, `N` — พิกัด UTM ที่ซ้ำกับ geometry อยู่แล้ว เก็บไว้ก็มีแต่จะขัดกันเองเมื่อขอบเขตถูกแก้

---

## 2. พื้นที่ป่า — คำนวณใน pipeline ไม่ใช่ในสคริปต์

เพิ่มฟิลด์ `area_rai` และ `area_km2` ให้ทุก feature ของเลเยอร์ที่ตั้ง `computeArea: true`

**ต้องอยู่ใน `ingestMapFile()` ไม่ใช่ในสคริปต์นำเข้า** เพราะถ้าสคริปต์เป็นคนเติม วันที่เจ้าหน้าที่
export จาก QGIS มาใหม่แล้วลากวางที่ `/admin/map` ไฟล์นั้นจะไม่มี `area_rai` → ด่าน
`field-removed` เตือนแค่ระดับ warning (ไม่บล็อก) → กดเผยแพร่ต่อได้ แล้ว**ตัวเลขไร่หายจาก
หน้าเว็บสาธารณะเงียบ ๆ** การวางไว้ใน pipeline ทำให้ทั้งสองทางเข้า (สคริปต์กับลากวาง) ได้ผลเท่ากัน
ซึ่งเป็นเหตุผลเดียวกับที่ `ingestMapFile` มีอยู่ตั้งแต่แรก

**วิธีคำนวณ: shoelace บนพิกัด UTM zone 47N แล้วหารด้วย k0² (0.9996²)**

แปลงพิกัดกลับเป็น UTM 47N ด้วย proj4 → shoelace → หารด้วย `0.9996²` เพื่อถอด scale factor
ของ UTM ออก → หารด้วย 1600 ได้ไร่

| | shoelace บน UTM ÷ k0² | spherical excess (R=6378137) | ต่าง |
|---|---|---|---|
| ป่าชุมชนหมู่ 10 | **50.02 ไร่** (0.0800 ตร.กม.) | 50.29 ไร่ | 0.5% |
| ป่าชุมชนหมู่ 11 | **1,941.21 ไร่** (3.1059 ตร.กม.) | 1,951.59 ไร่ | 0.5% |

เลือก UTM shoelace เพราะเป็นระบบพิกัดต้นฉบับที่รังวัดมาจริง เป็น conformal projection และ
พื้นที่นี้อยู่แทบตรงเมริเดียนกลางของโซน 47 พอดี (98.89°E เทียบกับ 99°E) ส่วนสูตร spherical
excess ใช้รัศมีศูนย์สูตรซึ่งเกินจริงที่ละติจูด 18.7°N — 0.5% ของ 1,941 ไร่ คือ ~10 ไร่
ซึ่งมากพอที่จะไม่ควรปัดทิ้งบนพอร์ทัลราชการ

**ตรวจความสมเหตุสมผลได้:** polygon หมู่ 10 มี 59 จุดยอด = จำนวนหมุด GPS 59 จุดพอดี →
ขอบเขตลากจากหมุดที่รังวัดมาโดยตรง

**Label ต้องเขียนว่า "พื้นที่โดยประมาณ (ไร่)"** — เป็นค่าที่คำนวณจากรูปทรง ไม่ใช่เนื้อที่ตาม
ทะเบียนของกรมป่าไม้ พอร์ทัลราชการไม่ควรทำให้สองอย่างนี้ปนกันจนคนเอาไปอ้างผิด

**ผลข้างเคียงที่ตั้งใจ:** `computeStats` จะเห็น `area_rai` เป็นฟิลด์หมวดหมู่ (distinct = 2 ≤
`CATEGORICAL_MAX`) แล้วเก็บ `values` ไว้ → เวอร์ชันหน้าที่พื้นที่เปลี่ยนจะติดด่าน `new-value`
เป็น warning ซึ่งเป็นสัญญาณที่ถูกต้อง: พื้นที่เปลี่ยน = ขอบเขตถูกแก้

### จุดที่แทรกใน pipeline และเรื่องความคงที่ของ sha256

```
parseMapFile → [เติม area ถ้า layer.computeArea] → computeStats → sha256 → runChecks → computeDiff
```

ต้องแทรก **ก่อน** `computeStats` และ `sha256OfFeatureCollection` เพื่อให้ฟิลด์ใหม่เข้าไปอยู่ใน
สถิติ ในด่านตรวจ และในไฟล์ที่ `ingestMapFile` คืนออกไปให้ผู้เรียกอัปขึ้น Cloudinary

**ต้องปัดเศษเป็นทศนิยมตายตัว** — `area_rai` 2 ตำแหน่ง `area_km2` 4 ตำแหน่ง ไม่งั้นค่า float
ที่ต่างกันในหลักท้าย ๆ จะทำให้ sha256 ของไฟล์เดิมเปลี่ยนทุกครั้งที่อัปซ้ำ แล้วตรรกะ "ข้ามถ้า
sha ตรง" ของสคริปต์กับด่าน `identical` จะใช้ไม่ได้อีกเลย

ข้ามเมื่อ `geometry` เป็น `null` หรือไม่ใช่ `Polygon`/`MultiPolygon` — ไม่ throw เพราะด่าน
`geometry-type-mismatch` เป็นคนรายงานเรื่องนั้นอยู่แล้ว

ถ้าไฟล์ต้นทางมี `area_rai` ติดมาอยู่แล้ว (เช่นอัปไฟล์ที่เคยเผยแพร่กลับเข้าไป) ให้**เขียนทับ**
ด้วยค่าที่คำนวณจาก geometry — ผลลัพธ์เท่าเดิมเพราะรูปทรงเดียวกัน และกันไม่ให้ตัวเลขที่แก้ด้วยมือ
หลุดขึ้นเว็บโดยไม่ตรงกับรูปทรงที่วาดอยู่

### `proj4` กลายเป็น runtime dependency

`map-ingest.ts` ถูก import จาก `pages/api/admin/map/layers/[id]/versions.ts` → proj4 ต้องเป็น
`dependencies` ไม่ใช่ `devDependencies`

ตรวจแล้วว่าปลอดภัยทั้งสองด้าน: `require('proj4')` ทำงานได้บน Node (ต่างจาก shpjs) และ
`map-ingest.ts` **ไม่เคยถูก import จากโค้ดฝั่ง client เลย** (ผู้เรียกมีแค่ API route กับสคริปต์)
→ proj4 อยู่ฝั่งเซิร์ฟเวอร์อย่างเดียว ไม่บวมเข้าบันเดิลเบราว์เซอร์

การแปลงกลับไป-กลับมาคลาดเคลื่อนราว 2 ซม. (`489711` → lon/lat → `489710.98`) ไม่มีผลกับตัวเลขไร่

---

## 3. `scripts/import-community-forest.mts`

### `shpjs` รันบน Node ได้ — แต่เฉพาะทาง ESM

`node_modules/shpjs/package.json` มี `exports.import` → `./lib/index.js` (ESM ใช้ได้บน Node)
และ `exports.require` → `./dist/shp.js` (บันเดิลเบราว์เซอร์ที่อ้าง `self` แล้วพังทันที)

คอมเมนต์ใน `map-shapefile-client.ts` ที่บอกว่า shpjs รันบน Node ไม่ได้ **ถูกต้องสำหรับ API route**
— Pages Router คอมไพล์เป็น CJS จึงไปทาง `require()` เสมอ แต่ **สคริปต์ `tsx` เป็น ESM จึงใช้ได้**
ทดสอบกับไฟล์จริงแล้ว: อ่านครบทั้ง 7 sub-layer พร้อมแปลงพิกัดตาม `.prj` ให้ 6 ไฟล์ที่ .prj ถูก

→ ไม่ต้องพึ่ง GDAL/ogr2ogr/QGIS ซึ่งไม่มีในเครื่อง dev และไม่ควรกลายเป็นข้อกำหนดของ repo

### ขั้นตอน

```
1. อ่าน public/Shapefiles ป่าชุมชน.zip → shp(buffer) → sub-layer พร้อม fileName
2. เลือก sub-layer จาก allow-list ชื่อไฟล์ตายตัว 4 ชื่อ
   → ไม่เจอชื่อใดชื่อหนึ่ง = throw ทันที ไม่ import ครึ่ง ๆ กลาง ๆ
3. ซ่อมพิกัด: ถ้า |lon| > 180 → แปลง EPSG:32647 → EPSG:4326 ด้วย proj4
4. เติม moo (10/11) ทุก feature, ตัดฟิลด์ขยะ
5. รวมเป็น 2 FeatureCollection
6. ingestMapFile()  ← ฟังก์ชันเดียวกับ API route และเป็นคนเติม area_rai/area_km2 เอง
7. upsertLayer + uploadRawText ขึ้น Cloudinary + insertVersion เป็น draft
```

สคริปต์**ไม่คำนวณพื้นที่เอง** — ปล่อยให้ `ingestMapFile` ทำ เพื่อให้ทางเข้าทั้งสองทางได้ผลเท่ากัน
(ดูหัวข้อ 2) สิ่งเดียวที่สคริปต์ทำแล้วทางลากวางไม่ทำคือแกะ zip หลายชั้นกับซ่อม `.prj` ที่โกหก
ซึ่งเป็นงานเฉพาะกิจของไฟล์ชุดนี้ ไม่ใช่ความสามารถที่ระบบควรมีถาวร

### ตรวจก่อนแปลง ไม่ใช่แปลงทื่อ ๆ

เงื่อนไข `|lon| > 180` สำคัญกว่าที่เห็น: มัน**ตรวจแล้วค่อยแปลง** ถ้าวันหน้าเขา export
`หมู่ 11_point` มาใหม่โดย `.prj` ถูกต้อง สคริปต์จะไม่แปลงซ้ำจนพิกัดหลุดออกนอกทวีป
การแปลงทื่อ ๆ ตามชื่อไฟล์จะพังเงียบ ๆ ในวันที่ต้นทางแก้ไฟล์ให้ถูกแล้ว

นี่ไม่ได้ขัดกับหลักใน `map-parse.ts` ที่ว่า *"ไม่แปลงพิกัดให้เอง เพราะการเดา CRS ผิดทำให้ข้อมูล
ไปโผล่ผิดที่โดยไม่มีอะไรเตือน"* — หลักนั้นคุมทางเข้าที่รับไฟล์จากใครก็ได้ ส่วนนี่คือสคริปต์
นำเข้าครั้งเดียวสำหรับไฟล์ชุดที่รู้ที่มาแน่ชัดและตรวจด้วยตาแล้วว่า .prj ตัวไหนโกหก
**ทางเข้าปกติที่ `/admin/map` ยังปฏิเสธไฟล์ CRS ผิดเหมือนเดิม ไม่แก้**

### ปล่อยไว้เป็นร่างเสมอ

ไม่เผยแพร่ให้อัตโนมัติ — เจ้าหน้าที่ต้องเข้า `/admin/map` เลือกฟิลด์สาธารณะแล้วกดเผยแพร่เอง
ตามหลักที่ `import-map-layers.ts` ตั้งไว้: การเปิดข้อมูลสู่สาธารณะไม่ควรเป็นผลข้างเคียงของ
การรันสคริปต์ และ `publicFields` ที่สคริปต์ตั้งให้เป็นแค่ข้อเสนอ

รันซ้ำได้: ถ้า sha256 ของเนื้อข้อมูลตรงกับเวอร์ชันที่มีอยู่แล้วก็ข้าม

### dependency

- `proj4` → **`dependencies`** (ไม่ใช่ dev) เพราะ `map-ingest.ts` ใช้ตอนคำนวณพื้นที่ — ดูเหตุผล
  และผลตรวจเรื่องบันเดิลในหัวข้อ 2
- `@types/proj4` → `devDependencies`

ตอนนี้ proj4 resolve ได้อยู่แล้วเพราะเป็น transitive ของ shpjs ซึ่งพึ่งพาตรง ๆ ไม่ได้
(shpjs เปลี่ยนเวอร์ชันเมื่อไหร่ก็หายได้) จึงต้องประกาศเอง

---

## 4. โมดูลตรรกะบริสุทธิ์ แยกออกมาให้เทสต์ได้

สคริปต์เหลือแค่ I/O (อ่าน zip, อัป Cloudinary, เขียน store) เหตุผลเดียวกับที่ `map-ingest.ts`
ไม่มี I/O และ `map-store.ts` แยกฟังก์ชันบริสุทธิ์ออกมา

**แยกเป็นสองไฟล์** เพราะคนละอายุการใช้งาน: `map-area.ts` อยู่ในเส้นทางหลักถาวรของทุกเลเยอร์ที่
ตั้ง `computeArea` ส่วน `map-forest-prep.ts` เป็นงานเฉพาะกิจของซิปชุดนี้ที่จะไม่ถูกเรียกอีกเลย
หลังนำเข้าครั้งแรก ถ้ารวมไฟล์เดียวกัน โค้ดที่ตายแล้วจะถ่วงโมดูลที่ API route ต้องโหลดทุกครั้ง

**`src/lib/map-area.ts`** — ใช้โดย `map-ingest.ts`
```ts
export function ringAreaUtm(ringUtm: number[][]): number  // shoelace ÷ k0², คืน ตร.ม.
export function polygonAreaRai(geometry): { rai: number; km2: number } | null
                    // รับ lon/lat แปลงเป็น UTM 47N เองแล้วเรียก ringAreaUtm
                    // คืน null ถ้า geometry เป็น null หรือไม่ใช่ Polygon/MultiPolygon
                    // ปัดเศษ rai 2 ตำแหน่ง km2 4 ตำแหน่ง (ดูเหตุผลเรื่อง sha256 ในหัวข้อ 2)
export function withArea(fc: FeatureCollection): FeatureCollection   // เขียนทับของเดิมเสมอ
```

**`src/lib/map-forest-prep.ts`** — ใช้โดยสคริปต์เท่านั้น
```ts
export const FOREST_SOURCES: ForestSource[]     // allow-list ชื่อไฟล์ + moo + บทบาท
export function pickSubLayer(parts, baseName): FeatureCollection   // ไม่เจอ → throw
export function needsUtmFix(fc): boolean                  // |lon| > 180
export function reprojectUtm47N(fc): FeatureCollection    // EPSG:32647 → 4326
export function tagAndClean(fc, moo, keep: string[]): FeatureCollection
export function buildForestLayers(parts): { boundary, points }
```

### `pickSubLayer` ต้องใช้ `endsWith` ห้ามใช้ `includes`

`shpjs` คืน `fileName` เต็มพร้อมโฟลเดอร์: `Shapefiles/พิกัดป่าชุมชนหมู่ 10_polygon1`
และ **`พิกัดป่าชุมชนหมู่ 10` เป็นสตริงนำหน้าของ `พิกัดป่าชุมชนหมู่ 10_polygon1` พอดี** →
`includes('พิกัดป่าชุมชนหมู่ 10')` จะคว้าไฟล์ polygon มาเป็นเลเยอร์หมุดโดยไม่มีอะไรเตือน
`endsWith` แยกได้ถูกต้อง (ตรวจกับไฟล์จริงทั้ง 7 รายการแล้ว)

ชื่อไฟล์ในซิปเป็น **NFC** ตรงกับ string literal ในซอร์ส และอักษรไทยไม่ decompose ตอน NFD
(`NFD(s).length === s.length`) → ไม่ต้องเรียก `normalize()` ก่อนเทียบ

---

## 5. อัปเดตครั้งต่อไป — ลากไฟล์วางเหมือนแผนที่ภาษี

หลัง PR 1 ป่าชุมชนจะมีการ์ดของตัวเองที่ `/admin/map` และใช้ `MapLayerCard` ตัวเดียวกับแผนที่ภาษี
(`parcel`) — `onDragOver`/`onDrop` และ `accept = '.geojson,.json,.js,.zip'` ลากวาง → ตรวจไฟล์ →
สรุปว่าอะไรเปลี่ยน → กดเผยแพร่ ไม่ต้องแก้ UI อะไรเพิ่ม

**สิ่งที่ไฟล์ที่ลากวางต้องมี:**

| ฟิลด์ | มาจากไหน |
|---|---|
| `moo` | **ต้องมีในไฟล์ต้นทาง** — เจ้าหน้าที่เพิ่มใน QGIS เอง (แค่ 2 แถว) |
| `point_n` | มีอยู่แล้วในไฟล์หมุด |
| `area_rai`, `area_km2` | ระบบเติมให้เอง ไม่ต้องทำอะไร |

ซิปที่ลากวางต้องมี shapefile **ชั้นเดียว** ตามปกติของการ export จาก QGIS — ซิปป่าชุมชนก้อนแรก
ที่มี 7 ชั้นปนกันเป็นข้อยกเว้นครั้งเดียวที่สคริปต์จัดการให้

**ถ้าลืมใส่ `moo` ระบบเตือน ไม่เงียบ** — `featureKey()` คืน `null` แล้วด่าน `duplicate-key`
รายงานว่า *"moo ซ้ำ 0 รายการ และว่าง 2 รายการ"* พร้อมกับ `field-removed` อีกตัว ขึ้นบนการ์ด
ก่อนกดเผยแพร่ ทั้งคู่เป็น **warning ไม่ใช่ error** จึงยังกดเผยแพร่ทับได้ถ้าตั้งใจ — ตรงกับ
ปรัชญาของระบบที่ให้คนตัดสินใจ ไม่ใช่ระบบบล็อก

ต้องเขียนเรื่อง `moo` ไว้ใน README หัวข้อ "คลังไฟล์แผนที่" ให้ชัด เพราะเป็นข้อกำหนดเดียวที่
เจ้าหน้าที่ต้องจำเองและไม่มีอะไรเตือนล่วงหน้าตอนอยู่ใน QGIS

---

## 6. MapViewer รองรับ Point

เลเยอร์ทั้งสี่ที่มีอยู่เป็น Polygon/LineString ล้วน **ยังไม่เคยมีเลเยอร์ Point**
`MapViewer.tsx` เรียก `L.geoJSON()` โดยไม่มี `pointToLayer` → Leaflet fallback ไป `L.marker`
ที่ไอคอนปริยาย 404 บน bundler และเป็น DOM ที่ Leaflet บังคับลง `markerPane` เสมอ ไม่เข้า
canvas pane ที่โค้ดตั้งไว้

```ts
pointToLayer: (_f, latlng) => L.circleMarker(latlng, { radius: 4, ...styleFor(...) })
```

`circleMarker` เป็น `Path` → เข้า pane ที่กำหนดได้และวาดด้วย canvas renderer เหมือนเลเยอร์อื่น

`map-hit.ts` รองรับ `Point`/`MultiPoint` อยู่แล้ว (`containsPoint` case `'Point'` ใช้ระยะ
tolerance) → คลิกดูรายละเอียดใช้ได้ทันที **ไม่ต้องแตะ** แต่ต้องลองจริงว่า tolerance ที่มีอยู่
กว้างพอให้คลิกโดนหมุดรัศมี 4px

---

## 7. `map-style.ts`

```ts
'community-forest':       { color: '#16a34a', weight: 2, fillColor: '#22c55e',
                            fillOpacity: 0.25, order: 35, defaultOn: true }
'community-forest-point': { color: '#15803d', weight: 1, fillColor: '#4ade80',
                            fillOpacity: 0.9,  order: 50, defaultOn: false }
```

`order` คือ z-index ของ `LAYER_STYLES` (คนละตัวกับ `MapLayer.order` ที่ใช้เรียงการ์ดในหลังบ้าน)

- ขอบเขตป่า **35** — ใต้ `zone-moobang` (40) ซึ่งคอมเมนต์ระบุว่าต้องอยู่บนสุดเพื่อให้เห็นกรอบหมู่
  เสมอ แต่เหนือถนน (30) เพราะพื้นสีเขียวจะบังเส้นถนนถ้าอยู่ผิดลำดับ
- หมุด **50** — จุดเล็กไม่บังอะไร และต้องเห็นเหนือพื้นป่าที่มันอยู่ข้างใน
- หมุด `defaultOn: false` — 176 จุดรกถ้าเปิดมาพร้อมกันตั้งแต่แรก

**ไม่ใส่ `COLOR_BY`** — ป่ามีแค่ 2 ผืน ถ้าไล่สีตาม `moo` จะได้สีจาก `GROUP_PALETTE` ที่ไม่ตรงกับ
สีของหมู่เดียวกันใน `zone-moobang` (ซึ่งไล่จากชุดค่า `Moo 1`–`Moo 11` คนละชุด) แล้วคนอ่านจะ
เข้าใจว่าเป็นคนละหมู่กัน — ปัญหาเดียวกับที่คอมเมนต์ใน `COLOR_BY` เตือนไว้เรื่อง `zone_id`

**`FIELD_LABELS` เพิ่ม:**
```ts
moo: 'หมู่',
point_n: 'ลำดับหมุด',
area_rai: 'พื้นที่โดยประมาณ (ไร่)',
area_km2: 'พื้นที่โดยประมาณ (ตร.กม.)',
```

---

## 8. Phase 2 — `POST /api/admin/map/layers`

```
POST /api/admin/map/layers
body { id, title, description?, geometryType, keyFields[], visibility, computeArea? }
→ 201 { layer }
→ 409 ถ้า id ซ้ำ
```

- `requireFeature(req, res, 'map')` — `api-guard-coverage.test.ts` บังคับให้ทุก route ใต้
  `api/admin/` มี guard อยู่แล้ว route ที่ลืมจะตกเทสต์ทันที
- **เช็ค `getLayer()` ก่อนแล้วปฏิเสธด้วย 409 — ห้ามเรียก `upsertLayer()` ตรง ๆ** upsert จะ
  เขียนทับทะเบียนที่มีเวอร์ชันผูกอยู่แบบเงียบ ๆ แล้วไฟล์ทุกเวอร์ชันบน Cloudinary กลายเป็น
  ขยะกำพร้าที่ไม่มีอะไรอ้างถึง ตามที่หัวไฟล์ `map-store.ts` เตือนไว้ตรง ๆ
- สร้างมาด้วย `publicFields: []`, `currentVersionNo: null`, `keyComposition: []` เสมอ —
  ตามหลัก "ค่าเริ่มต้นคือปิดทุกฟิลด์" ที่ระบบใช้อยู่
- `order` = max ของที่มีอยู่ + 1 ไม่ให้ผู้ใช้กรอกเอง
- zod schema ใน `schema.ts`: `id` บังคับ slug (`slugify()` มีอยู่แล้ว), `geometryType` ∈
  `GEOMETRY_KINDS`, `visibility` ∈ `public|staff`, `keyFields` เป็นอาเรย์ string ว่างได้
- `computeArea` ตั้งได้เฉพาะเมื่อ `geometryType` เป็น `Polygon`/`MultiPolygon` — schema ปฏิเสธ
  ถ้าตั้งคู่กับ Point/LineString เพราะมันจะไม่มีผลอะไรเลยแล้วคนตั้งจะเข้าใจผิดว่าตั้งสำเร็จ
- UI: ปุ่ม "เพิ่มเลเยอร์" ใน `/admin/map` (ตอนนี้ยังไม่มีปุ่มใด ๆ) เปิด dialog กรอกฟอร์ม

**ไม่ทำในรอบนี้:** ลบเลเยอร์ และแก้ `geometryType`/`keyFields` ของเลเยอร์ที่มีเวอร์ชันแล้ว —
ทั้งสองอย่างทำให้ประวัติที่บันทึกไว้ขัดกับทะเบียนปัจจุบัน ต้องออกแบบแยก

---

## 9. เทสต์

vitest เฉพาะ logic บริสุทธิ์ ไม่แตะ DB/network ตามกติกาใน README

**`src/lib/map-forest-prep.test.ts`**
- `pickSubLayer` เจอไฟล์ตามชื่อ / **throw เมื่อไม่เจอ** (ไม่ใช่คืน null เงียบ ๆ)
- `pickSubLayer('…หมู่ 10')` ต้องได้ไฟล์หมุด **ไม่ใช่** `…หมู่ 10_polygon1` — ตรึงกับดัก
  prefix ไว้ ไม่ให้ใครเปลี่ยนกลับไปใช้ `includes` ภายหลัง
- `needsUtmFix` — true กับพิกัด `[489711, 2069101]`, false กับ `[98.90, 18.71]`
- `reprojectUtm47N` — `[489711, 2069101]` → `[98.902408, 18.713236]` (ตรึงค่าที่ตรวจแล้ว)
- **ไม่แปลงซ้ำ** — เรียกกับ FeatureCollection ที่เป็น lon/lat แล้วต้องได้ค่าเดิม
- `tagAndClean` — เติม `moo`, ตัด `begin`/`end`/`id`/`E`/`N`, ไม่แตะ geometry
- `buildForestLayers` — ได้ 2 เลเยอร์, boundary 2 features, points 176 features,
  `(moo, point_n)` ไม่ซ้ำกันสักคู่

**`src/lib/map-area.test.ts`**
- `ringAreaUtm` — สี่เหลี่ยม 40×40 เมตรในพิกัด UTM = 1,600 ตร.ม. ก่อนหาร k0² และ
  **1,601.2808 ตร.ม. (1.0008 ไร่)** หลังหาร — ตรึงว่าการถอด scale factor ทำจริงและทำถูกทาง
- วงเปิดกับวงปิด (จุดแรก = จุดสุดท้าย) ต้องได้ค่าเท่ากันเป๊ะ
- `polygonAreaRai` คืน `null` เมื่อ geometry เป็น `null` / Point / LineString
- **เรียกซ้ำแล้วได้ค่าเดิมเป๊ะ** — `withArea(withArea(fc))` ต้องเท่ากับ `withArea(fc)` ทุกบิต
  คือหลักฐานว่าการปัดเศษทำให้ sha256 คงที่จริง (ดูหัวข้อ 2)
- `withArea` เขียนทับ `area_rai` ที่ติดมากับไฟล์ ไม่ใช่ปล่อยของเดิมไว้
- MultiPolygon สองวง = ผลรวมของสองวง และวงในหักออกจากวงนอก

**`src/lib/schema.test.ts`** (phase 2) — createLayer input: ปฏิเสธ id ที่ไม่ใช่ slug,
ปฏิเสธ `geometryType` นอก `GEOMETRY_KINDS`

**ตรวจด้วยตาหลังรันสคริปต์** — เทสต์ยืนยันแทนไม่ได้:
- หมุดหมู่ 11 ทั้ง 117 จุดตกอยู่ใน polygon หมู่ 11 (คือหลักฐานว่าซ่อม .prj ถูก)
- คลิกหมุดแล้วป๊อปอัปขึ้น (tolerance ของ `map-hit` กว้างพอ)
- ด่านตรวจไม่ขึ้น error ทั้งสองเลเยอร์

---

## ลำดับงาน

**PR 1 — ข้อมูลขึ้นแผนที่**
1. `proj4` เข้า `dependencies`, `@types/proj4` เข้า `devDependencies`
2. `computeArea?: boolean` เข้า `MapLayer` ใน `types/map.ts`
3. `src/lib/map-area.ts` + เทสต์
4. เรียก `withArea()` ใน `map-ingest.ts` ก่อน `computeStats` (เมื่อ `layer.computeArea`)
5. `src/lib/map-forest-prep.ts` + เทสต์
6. `scripts/import-community-forest.mts` + `npm run import:forest`
7. `pointToLayer` ใน `MapViewer.tsx`
8. `LAYER_STYLES` + `FIELD_LABELS` ใน `map-style.ts`
9. รันสคริปต์ → ตรวจด้วยตา → เผยแพร่จาก `/admin/map`
10. README หัวข้อ "คลังไฟล์แผนที่": สองเลเยอร์ใหม่ + พื้นที่เป็นค่าประมาณ +
    **ไฟล์ที่อัปครั้งหน้าต้องมีฟิลด์ `moo`**

**PR 2 — สร้างเลเยอร์เองได้**
11. zod schema + `POST /api/admin/map/layers`
12. ปุ่ม/ฟอร์ม "เพิ่มเลเยอร์" ใน `/admin/map`
13. README

---

## ไม่ทำในรอบนี้

- **raster overlay (TIFF 46 MB)** — ต้องแปลงเป็น tiles/COG, หา storage (Cloudinary ไม่เหมาะกับ
  raster ขนาดนี้), เพิ่มชนิด asset ใหม่ในทะเบียน และ `MapViewer` ต้องรองรับ image overlay
  ทั้งหมดเป็นโดเมนใหม่ที่ไม่ทับกับท่อ GeoJSON เดิมเลย → ต้อง spec ของตัวเอง
- **แกะ zip หลาย sub-layer ผ่าน UI** — ทางเข้าปกติควรปฏิเสธไฟล์ที่ CRS ผิดต่อไป ระบบเดาแทนคน
  ไม่ได้ในกรณีที่ `.prj` โกหก ซึ่งเป็นกรณีของไฟล์ชุดนี้พอดี
- **ลบเลเยอร์ / แก้ `geometryType` ของเลเยอร์ที่มีเวอร์ชันแล้ว**
