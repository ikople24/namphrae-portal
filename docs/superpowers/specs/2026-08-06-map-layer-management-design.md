# คลังไฟล์แผนที่ (Map Layer Management)

**Date:** 2026-08-06
**Status:** Approved by user (approach A — Cloudinary raw สองไฟล์ต่อเวอร์ชัน + ทะเบียนใน MongoDB)
**Branch:** `feat/map-layers`

## Goal

ย้ายข้อมูลเชิงพื้นที่ทั้งหมดที่วันนี้กระจัดกระจายอยู่ในไฟล์ static ของ
`namphraesmartcity.ai/map/` มาเป็นคลังที่พอร์ทัลเป็นเจ้าของ โดยเจ้าหน้าที่
**อัปโหลดไฟล์แทนที่ได้เองโดยไม่ต้องพึ่งใคร** และพอร์ทัลเปิด API ให้ระบบอื่นดึงไปใช้

ของเดิมไม่มีทะเบียน ไม่มีเวอร์ชัน ไม่มีด่านตรวจ และไม่มีการกันข้อมูลส่วนบุคคล — การอัปเดต
แผนที่หนึ่งครั้งคือการให้คนที่มีสิทธิ์ FTP เอาไฟล์ไปทับของเดิม ถ้าไฟล์ผิดก็ไม่มีอะไรบอก และ
ไม่มีทางย้อนกลับ

พอร์ทัล **ไม่** render แผนที่เอง (ดู Out of scope) — หน้าที่ของมันคือเป็นแหล่งความจริงเดียว
ของ "ไฟล์แผนที่ชุดล่าสุดคืออันไหน"

## Context — สำรวจต้นทางแล้วพบอะไร

`namphraesmartcity.ai/map/` เป็น **qgis2web export** (หน้า Leaflet static ที่ QGIS ปั๊มออกมา)
ไม่ใช่ GeoServer/WMS ข้อมูลทุกเลเยอร์เป็น GeoJSON ห่อด้วย `var json_XXX = {...}` วางไว้ใน
`data/` CRS เป็น CRS84 (lon/lat) เรียบร้อยแล้ว ดึงมาได้ตรง ๆ ทั้งหมด

| ไฟล์ต้นทาง | เลเยอร์ | ชนิด | จำนวน | ขนาด |
|---|---|---|---|---|
| `data/ZoneMoobang_2.js` | โซนหมู่บ้าน | MultiPolygon | 11 | 96 KB |
| `data/Parcel_3.js` | แปลงที่ดิน | MultiPolygon | 7,970 | 7.8 MB |
| `data/buildingnew_4.js` | อาคาร | MultiPolygon | 5,460 | 2.1 MB |
| `data/Rordmoobang_5.js` | ถนน | MultiLineString | 1,475 | 871 KB |

รวม ~10.9 MB อัปเดตล่าสุด 30 เม.ย. 2026 · basemap อีกสองตัว (OSM, Google Satellite) เป็น
tile URL ไม่ใช่ไฟล์ จึงไม่อยู่ในขอบเขตของคลังนี้

### ข้อเท็จจริงจากข้อมูลจริงที่บังคับรูปร่างของดีไซน์

ทั้งหมดนี้ตรวจกับไฟล์จริงแล้ว ไม่ใช่การคาดเดา — และหลายข้อทำให้ดีไซน์รอบแรกต้องถูกแก้

1. **`Parcel_3` มีข้อมูลส่วนบุคคล** — `own_Hse_no` (บ้านเลขที่เจ้าของ), `own_moo`,
   `own_soi`, `own_villag`, `own_road`, `own_tambol`, `own_amphur`, `own_provin`,
   `own_line_n` (9 ฟิลด์) บวก `Id_Chanod` (เลขโฉนด), `parcel_no`, `survey_no`, `land_no`
   วันนี้ทั้งหมดนี้เปิดให้ทุกคนโหลดได้จากหน้า static เดิม

2. **`parcel_cod` ไม่ unique จริง** — 7,958 ค่า แต่ไม่ซ้ำจริงแค่ 7,862 (ซ้ำ 96 แถว, ว่าง 12
   แถว) ตัวที่ซ้ำหนักสุดคือ `02I085/003` โผล่ 17 ครั้ง ส่วน `Id_Chanod` แย่กว่า (ซ้ำ 87 แถว
   ว่าง 1,098 แถว) จึงยืนยันว่า **`parcel_cod` คือคีย์ที่ถูกต้องแล้ว แต่ต้องยอมรับว่ามัน
   ยังไม่สะอาด ณ วันเริ่มใช้ระบบ**

3. **`Parcel_3` คือข้อมูลสองชุดที่ถูกรวมกัน** แยกออกจากกันได้ 100% ด้วยความยาว `block_id`

   | แบบ | จำนวน | `block_id` | สูตร `parcel_cod` | ตัวอย่าง |
   |---|---|---|---|---|
   | A | 3,921 | ยาว 1 (`B`) | `zone_id + block_id + lot` | `04` + `B` + `066` = `04B066` |
   | B | 3,808 | ยาว 3 (`02S`) | `block_id + lot` | `02S` + `015/004` = `02S015/004` |
   | — | 88 | — | เข้าไม่ได้ทั้งสองแบบ | `zone=01 block=01C lot=003` แต่ `parcel_cod=01F095/003` |

   (อีก 153 แถวมีฟิลด์ประกอบไม่ครบ จึงตัดสินไม่ได้)

4. **`zone_id` ในเลเยอร์แปลงที่ดินมีอย่างน้อยสองระบบเลขปนกัน** — ในแบบ A สะอาดหมด
   (`01`–`06` เติมศูนย์ครบ) เพราะมันถูกใช้ประกอบ `parcel_cod` จึงถูกตรวจโดยปริยาย
   ส่วนในแบบ B มันเป็นฟิลด์ลอยที่ไม่มีอะไรตรวจ และ **ขัดกับโซนที่ฝังอยู่ใน `block_id`
   ถึง 3,286 จาก 3,808 แถว (86%) อย่างมีระบบ**

   ```
   zone_id 4, 5, 6, 9         → block_id ขึ้นต้น '01'
   zone_id 12, 13, 14, 15, 16 → block_id ขึ้นต้น '02'
   zone_id 10, 11             → block_id ขึ้นต้น '03'
   ```

   ความสม่ำเสมอระดับนี้แปลว่ามันคือระบบเลขโซนคนละชุด ไม่ใช่ค่าที่กรอกผิด **โซนไม่ใช่หมู่**
   (ยืนยันโดยผู้ใช้) จึงไม่มีทางอนุมานได้ว่ามีกี่โซนหรือโซนไหนถูกต้อง
   → ระบบต้องไม่แก้ `zone_id` ให้เอง และด่านตรวจต้องไม่มีรายการ "ค่าที่ถูกต้อง" ตายตัว
   → **ข้อเสนอ "ตัวช่วยเติมศูนย์ `4` → `04`" ถูกถอนออก** เพราะโซน `4` (แบบ B, แปลงอยู่ใน
     บล็อกขึ้นต้น `01`) ไม่ใช่โซน `04` (แบบ A, แปลงอยู่ในบล็อกขึ้นต้น `04`) การเติมศูนย์จะยุบ
     สองโซนที่ไม่เกี่ยวกันเข้าเป็นโซนเดียว

5. **`full_id` ของเลเยอร์ถนนไม่ unique** — ซ้ำ 138 แถว เพราะถนน OSM เส้นเดียวที่พาดผ่าน
   สองหมู่ถูกตัดเป็นคนละแถวตอน clip (เช่น `w144429585` อยู่ทั้ง Moo 4 และ Moo 7)
   แต่ **`full_id` + `zone_id` คู่กัน unique ครบ 1,475/1,475**
   → คีย์ต้องเป็น *อาเรย์* ของชื่อฟิลด์ ไม่ใช่ชื่อฟิลด์เดี่ยว

6. **มีข้อความไทยที่ encoding พังตอน export** — `Id_Chanod` 55 แถวเป็น `*เน€เธ??...`
   กระจายไป `own_tambol` 8, `own_road` 5, `own_villag` 3, `land_type` 2, `own_amphur` 1

7. **`zone_id` เป็นชื่อฟิลด์เดียวกันแต่คนละความหมายข้ามเลเยอร์** — `ZoneMoobang` กับ
   `Rordmoobang` ใช้ `'Moo 4'` (คือ *หมู่*) ส่วน `Parcel` ใช้ `'04'` (คือ *โซน* งานรังวัด)
   → ระบบต้องไม่พยายาม join สองอย่างนี้เข้าหากันไม่ว่ากรณีใด

8. **`OBJECTID` ของเลเยอร์อาคาร unique ครบ 5,460/5,460** ในไฟล์ชุดนี้ แต่เป็นเลขที่ ArcGIS
   แจกใหม่ทุกรอบ export — ความคงที่ข้าม export ยืนยันจากไฟล์ snapshot เดียวไม่ได้

### ข้อจำกัดทางเทคนิคที่บังคับสถาปัตยกรรม

จาก `node_modules/next/dist/docs/02-pages/03-building-your-application/01-routing/07-api-routes.md`:
API route ของ Pages Router มี `bodyParser.sizeLimit` ค่าเริ่มต้น **1 MB** และเตือนเมื่อ
response body เกิน **4 MB** (`responseLimit`)

→ ไฟล์แปลงที่ดิน 7.8 MB **วิ่งผ่าน API route ของเราเองไม่ได้ทั้งขาขึ้นและขาลง**
ขาขึ้นต้องอัปตรงจากเบราว์เซอร์เข้า Cloudinary ขาลงต้อง redirect ไป CDN

## Decisions (confirmed with user)

1. **ขอบเขต:** คลังไฟล์ + API — พอร์ทัลเป็นแหล่งความจริงเดียว แต่ไม่ render แผนที่เอง
2. **การเข้าถึง:** สองชั้น + ตั้งค่ารายเลเยอร์ — แต่ละเลเยอร์ตั้งได้ว่าสาธารณะหรือเฉพาะ
   เจ้าหน้าที่ และถ้าสาธารณะให้ติ๊กเลือกทีละฟิลด์ว่าฟิลด์ไหนเปิดได้ **ค่าเริ่มต้นคือปิดทุกฟิลด์**
3. **กระบวนการแทนที่:** ขึ้นร่าง → ดูส่วนต่าง → เผยแพร่ (คนเดียวกดได้ทั้งสองปุ่ม ไม่ต้องรอ
   ใครอนุมัติ)
4. **การยอมรับคำเตือน:** **ปุ่มยืนยันปุ่มเดียว ไม่ติ๊กทีละข้อ** — ร่องรอยครบอยู่แล้วจาก
   `checks` + `publishedBy` + `publishedAt` จึงไม่มีฟิลด์ `acknowledged`
5. **ชนิดไฟล์ที่รับ:** qgis2web `.js` และ shapefile `.zip` — บวก `.geojson`/`.json` ที่แถมมา
   ฟรีเพราะเป็นรูปแบบที่ระบบเก็บอยู่แล้ว (แปลงศูนย์บรรทัด)
6. **`parcel_cod` ซ้ำ:** เตือน ไม่บล็อก — บล็อกแข็งจะทำให้ import ข้อมูลจริงวันนี้ไม่ได้เลย
7. **ที่เก็บไฟล์:** Cloudinary raw สองไฟล์ต่อเวอร์ชัน + metadata ใน MongoDB
8. **`keyComposition`:** เอา — จับ 88 แถวที่ผิดจริงได้
9. **เก็บย้อนหลัง:** ไฟล์เต็ม 5 เวอร์ชันล่าสุด metadata เก็บตลอด

### เหตุผลที่ไม่เลือกทางอื่น

- **GridFS ใน MongoDB:** ทุก byte วิ่งผ่านเซิร์ฟเวอร์ Next.js ชนเพดาน response 4 MB เต็ม ๆ
  ต้อง stream เองและปิด `responseLimit` ไม่มี CDN (คนเปิดพร้อมกัน 20 คน = 7.8 MB × 20
  ผ่านเครื่องเดียว) และถ้า Atlas เป็น M0 (512 MB) การเก็บ 10.9 MB × สองสำเนา × 5 เวอร์ชัน
  กินไปราว 20% ของโควตาทั้งก้อน
- **แตกเป็นราย feature ใน collection:** ~15,000 document ต่อเวอร์ชัน คูณเวอร์ชันที่เก็บ
  ย้อนหลัง และการเสิร์ฟทั้งเลเยอร์ต้องประกอบ GeoJSON ใหม่ทุกครั้ง — เป็นสถาปัตยกรรมของ
  "แก้ไขรายแปลงได้" ซึ่งอยู่นอกขอบเขตที่ผู้ใช้เลือก
- **บล็อกแข็งเมื่อ `parcel_cod` ซ้ำ:** ต้องเคลียร์ 163 แถวใน QGIS ให้เสร็จก่อนถึงจะเริ่มใช้
  คลังได้เลย และคำเตือนที่มองเห็นทุกครั้งพร้อม CSV ให้ไล่แก้ ได้ผลจริงมากกว่าประตูที่ล็อกอยู่

## Design

### Data — collection ใหม่สองตัว

แยกตามแพตเทิร์นเดิมของโปรเจกต์ที่กันของก้อนเดียวออกจากของที่โตไม่จำกัด (`config` vs
`calendarJobs` — ดู `src/lib/jobs-store.ts` หัวไฟล์) **geometry ไม่แตะ MongoDB เลย**
ทั้งสอง collection เก็บแต่ metadata จึงไม่มีวันชนเพดาน 16 MB ต่อ document

`src/types/map.ts` (ไฟล์ใหม่ — ไม่ยัดรวม `portal.ts` ที่ดูแลคนละโดเมน):

```ts
export const GEOMETRY_KINDS = [
  'Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon',
] as const;
export type GeometryKind = (typeof GEOMETRY_KINDS)[number];

export const VERSION_STATUSES = ['draft', 'published', 'superseded', 'discarded'] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export type MapLayer = {
  id: string;                 // slug: 'parcel' | 'building' | 'zone-moobang' | 'road'
  title: string;              // 'แปลงที่ดิน'
  description?: string;
  geometryType: GeometryKind; // ตรึงไว้ — กันอัปไฟล์ถนนทับเลเยอร์แปลงที่ดิน
  keyFields: string[];        // ตัวตนของ feature: ใช้ทั้งทำ diff และตรวจซ้ำ ([] = ไม่มีคีย์)
  keyComposition: string[][]; // สูตรประกอบ keyFields[0] กลับจากฟิลด์อื่น ([] = ไม่ตรวจ)
                              // ต้องมี keyFields.length === 1 ถึงจะตั้งค่านี้ได้ — คีย์ประกอบ
                              // (เช่นถนน) ไม่มี "ค่าเดียวให้ประกอบกลับ" ให้ตรวจ
  visibility: 'public' | 'staff';
  publicFields: string[];     // whitelist — [] แปลว่าเปิดแค่รูปทรง ไม่เปิดฟิลด์ใดเลย
  currentVersionNo: number | null;  // เวอร์ชันที่เผยแพร่อยู่ ณ ตอนนี้
  order: number;
  updatedAt: string;
  updatedBy: string;
};

export type MapCheck = {
  code: string;                       // 'duplicate-key' | 'mojibake' | ...
  level: 'error' | 'warning';
  message: string;                    // ข้อความภาษาไทยที่เจ้าหน้าที่อ่านรู้เรื่อง
  count: number;                      // จำนวนแถวที่เข้าข่าย
  sample: string[];                   // ตัวอย่างไม่เกิน 5 ค่า สำหรับแสดงบนการ์ด
};

export type MapDiff = {
  comparedToVersionNo: number;
  added: number;
  removed: number;
  changed: number;                    // คีย์เดิมแต่ properties/geometry ต่าง
  fieldsAdded: string[];
  fieldsRemoved: string[];
};

export type MapLayerVersion = {
  id: string;                         // crypto.randomUUID()
  layerId: string;
  versionNo: number;                  // 1, 2, 3… นับแยกต่อเลเยอร์
  status: VersionStatus;

  source: {
    format: 'geojson' | 'qgis2web-js' | 'shapefile-zip';
    fileName: string;
    bytes: number;
    sha256: string;                   // ของ GeoJSON ที่แปลงแล้ว ไม่ใช่ของไฟล์ที่อัป
  };

  fullAsset: { publicId: string; bytes: number };   // Cloudinary raw, type: authenticated
  publicAsset: { publicId: string; url: string; bytes: number } | null;  // เกิดตอนเผยแพร่

  stats: {
    featureCount: number;
    geometryTypes: string[];
    bbox: [number, number, number, number];         // [minLon, minLat, maxLon, maxLat]
    fields: { name: string; filled: number; distinct: number }[];
  };

  checks: MapCheck[];
  diff: MapDiff | null;                             // null = เวอร์ชันแรกของเลเยอร์

  uploadedAt: string;  uploadedBy: string;
  publishedAt?: string; publishedBy?: string;
  note?: string;
};
```

**ทำไม `keyFields` เป็นอาเรย์:** เลเยอร์ถนนต้องใช้ `['full_id','zone_id']` คู่กันถึงจะ unique
(ดู Context ข้อ 5) การออกแบบเป็นสตริงเดี่ยวจะทำให้เลเยอร์นั้นทำ diff ไม่ได้เลย

**ทำไม `sha256` คำนวณจาก GeoJSON ที่แปลงแล้ว ไม่ใช่จากไฟล์ที่อัป:** เพื่อให้ตอบคำถามที่
เจ้าหน้าที่สนใจจริง ("เนื้อข้อมูลเหมือนเดิมไหม") ไม่ใช่คำถามที่ไม่มีใครสนใจ ("ไบต์ในไฟล์ zip
เหมือนเดิมไหม") — shapefile zip ที่บีบอัดใหม่จากข้อมูลชุดเดิมจะได้ hash คนละค่าทุกครั้ง
ทั้งที่ข้อมูลไม่เปลี่ยน การเตือน "ไฟล์นี้เหมือนเวอร์ชันที่เผยแพร่อยู่ทุกประการ" จึงต้องดูที่
เนื้อข้อมูล เพราะการอัปไฟล์เดิมซ้ำโดยไม่รู้ตัวเป็นความผิดพลาดที่พบบ่อยที่สุดในงานแบบนี้ และ
ไม่มีทางจับได้จากจำนวน feature ซึ่งเท่ากันเป๊ะ

**ทำไม `publicFields` อยู่ที่เลเยอร์ ไม่ใช่ที่เวอร์ชัน:** นโยบายความเป็นส่วนตัวเป็นเรื่องของ
*เลเยอร์* ไม่ใช่ของไฟล์ ถ้าเก็บไว้ที่เวอร์ชัน การอัปไฟล์ใหม่จะรีเซ็ตนโยบายกลับโดยไม่มีใคร
สังเกต ซึ่งเป็นวิธีที่ข้อมูลหลุดจริงในระบบแบบนี้

**ทำไมไม่มีฟิลด์ `acknowledged`:** `checks` เก็บคำเตือนทุกข้อที่เจอไว้แล้ว และ `publishedBy`
+ `publishedAt` บอกว่าใครกดยอมรับมันเมื่อไร ฟิลด์ที่สามไม่เพิ่มข้อมูลใด

### Store — `src/lib/map-store.ts`

ตามแบบ `jobs-store.ts`: Mongo เมื่อมี `MONGODB_URI` ไม่งั้นใช้ไฟล์ในเครื่อง และ **ต้องมี
`assertFileBackendAllowed()` แบบเดียวกัน** ปฏิเสธแบ็กเอนด์ไฟล์ตอน production ด้วยเหตุผล
เดิม (Railway เขียนไฟล์ได้จริงแต่ไม่คงอยู่ข้าม deploy — ทะเบียนจะหายเงียบ ๆ พร้อมกับลิงก์
ไปไฟล์บน Cloudinary ที่กลายเป็นขยะกำพร้าทันที)

Index ที่ `ensureIndexes()` สร้าง (เพดาน retry แบบเดียวกับ `jobs-store.ts`):

```
mapLayers         { id: 1 } unique
mapLayerVersions  { layerId: 1, versionNo: -1 }   ← ประวัติเวอร์ชันของเลเยอร์
                  { layerId: 1, status: 1 }        ← หา published/draft ปัจจุบัน
                  { id: 1 } unique
```

**Invariant:** หนึ่งเลเยอร์มี `status: 'published'` ได้ไม่เกินหนึ่งเวอร์ชัน และ
`layer.currentVersionNo` ต้องชี้ไปที่เวอร์ชันนั้นเสมอ

### กระบวนการอัปโหลด → เผยแพร่

สิ่งที่เจ้าหน้าที่เห็นมีสามจังหวะ: **ลากไฟล์วางบนการ์ดเลเยอร์ → อ่านการ์ดสรุป → กดเผยแพร่**

```
เจ้าหน้าที่ลากไฟล์วางบนการ์ด
    │
    ├─ 0. ถ้าเป็น .zip → เบราว์เซอร์แปลงเป็น GeoJSON ด้วย shpjs ก่อน (ดู "ทำไมแปลง
    │       shapefile ที่เบราว์เซอร์" ด้านล่าง) — .js/.geojson ส่งขึ้นตามเดิม
    ├─ 1. ขอลายเซ็นจากเซิร์ฟเวอร์ แล้วอัปตรงเข้า Cloudinary        ← ข้ามเพดาน 1 MB
    ├─ 2. เซิร์ฟเวอร์ดึงไฟล์มาแกะ:
    │       .js  → ตัดหัว `var json_X = ` แล้ว JSON.parse
    │       .geojson → JSON.parse
    ├─ 3. ตรวจ (checks) + นับสถิติ (stats) + เทียบส่วนต่างกับเวอร์ชันที่เผยแพร่อยู่ (diff)
    └─ 4. บันทึกเป็น draft
    │
    ▼
 ┌─ พบ error   → ปฏิเสธ ไม่เกิด draft ลบไฟล์บน Cloudinary ทิ้ง
 ├─ พบ warning → draft + ปุ่ม "ยืนยันและเผยแพร่" (สีเหลืองอำพัน)
 └─ สะอาด      → draft + ปุ่ม "เผยแพร่" (สีเขียว)
    │
    ▼  (กดเผยแพร่)
 กรอง properties ตาม publicFields → อัปไฟล์สาธารณะขึ้น Cloudinary (type: upload)
    → เวอร์ชันเดิม published → superseded
    → เวอร์ชันนี้ draft → published
    → layer.currentVersionNo = versionNo
```

**ลำดับของขั้นตอนเผยแพร่จงใจให้ล้มเหลวไปทางที่ปลอดภัย:** อัปไฟล์สาธารณะให้เสร็จก่อน
ค่อยสลับสถานะใน DB ถ้าพังหลังอัปไฟล์แต่ก่อนสลับสถานะ ผลคือมีไฟล์กำพร้าบน Cloudinary
(ขยะที่ไม่มีใครอ้างถึง) แต่เลเยอร์ยังชี้ไปเวอร์ชันเดิมที่ใช้งานได้ — ตรงข้ามกับการสลับสถานะ
ก่อนซึ่งจะทำให้เลเยอร์ชี้ไปไฟล์ที่ยังไม่มีอยู่จริง

**ย้อนเวอร์ชัน** = กด "เผยแพร่" ที่เวอร์ชัน `superseded` ตัวเก่า ทำงานทันทีเพราะ
`publicAsset` ของมันยังอยู่ ไม่ต้องประมวลผลไฟล์ใหม่

**เก็บย้อนหลัง 5 เวอร์ชัน:** หลังเผยแพร่สำเร็จ ลบ `fullAsset` ของเวอร์ชันที่เก่ากว่า 5 อันดับ
ล่าสุดออกจาก Cloudinary **ยกเว้นเวอร์ชันที่ `status === 'published'` ซึ่งห้ามลบเสมอ** ไม่ว่า
มันจะเก่าแค่ไหน (เกิดได้จริงเมื่อย้อนกลับไปใช้เวอร์ชันเก่ามากแล้วอัปเวอร์ชันใหม่ต่ออีกหลายรอบ)

**`publicAsset` ไม่ถูกลบตามนโยบายนี้** — มันคือสิ่งเดียวที่ทำให้ย้อนเวอร์ชันได้ทันทีโดยไม่ต้อง
ประมวลผลไฟล์ใหม่ และมันเล็กกว่า `fullAsset` เพราะฟิลด์ PII ถูกตัดออกไปแล้ว

**เก็บ document ไว้ตลอดทุกเวอร์ชัน** — ประวัติว่าใครอัปอะไรเมื่อไรและผลตรวจเป็นอย่างไรคือ
ร่องรอยของงานราชการ ห้ามหายไปพร้อมกับไฟล์ เวอร์ชันที่ `fullAsset` ถูกลบแล้วยังแสดงใน
ตารางประวัติ เพียงแต่ปุ่มดาวน์โหลดไฟล์เต็มถูกปิด

### ด่านตรวจ (`src/lib/map-checks.ts`)

| ระดับ | `code` | เงื่อนไข |
|---|---|---|
| 🔴 error | `parse-failed` | แกะไฟล์ไม่ออก / ไม่ใช่ GeoJSON ที่ถูกต้อง |
| 🔴 error | `empty` | 0 feature |
| 🔴 error | `bad-geometry` | feature ที่ไม่มี geometry หรือ geometry พัง |
| 🔴 error | `outside-thailand` | bbox อยู่นอก `[97.3, 5.6, 105.7, 20.5]` |
| 🔴 error | `geometry-type-mismatch` | ชนิดรูปทรงไม่ตรงกับ `layer.geometryType` |
| 🟡 warning | `duplicate-key` | ค่า `keyFields` ซ้ำหรือว่าง |
| 🟡 warning | `key-composition` | ประกอบ `keyFields[0]` กลับจากสูตรใดใน `keyComposition` ไม่ได้ |
| 🟡 warning | `null-literal` | ค่าที่เป็นสตริงแทนค่าว่าง (`'None'`, `'null'`, `'NaN'`, `'N/A'`, …) |
| 🟡 warning | `new-value` | ค่าใหม่ที่ไม่เคยมีในเวอร์ชันที่เผยแพร่อยู่ เฉพาะฟิลด์ประเภทหมวดหมู่ (`distinct ≤ 50`) |
| 🟡 warning | `count-jump` | จำนวน feature เปลี่ยนเกิน ±20% จากเวอร์ชันที่เผยแพร่อยู่ |
| 🟡 warning | `field-removed` | ฟิลด์ที่เคยมีหายไป |
| 🟡 warning | `mojibake` | พบอักขระที่บ่งชี้ encoding พัง |
| 🟡 warning | `identical` | `sha256` ตรงกับเวอร์ชันที่เผยแพร่อยู่ |
| 🟡 warning | `new-public-candidate` | มีฟิลด์ใหม่ที่ยังไม่อยู่ใน `publicFields` |

**หลักการแบ่งระดับ:** error คือ "ไฟล์นี้ใช้งานไม่ได้จริง ยืนยันไปก็ไม่ทำให้มันใช้ได้"
ส่วน warning คือ "ข้อมูลอาจถูกต้องตามความเป็นจริง คนตัดสินคือเจ้าหน้าที่ ไม่ใช่โปรแกรม"

**`outside-thailand` คือด่านที่คุ้มที่สุด** — ดักกรณี export shapefile จาก QGIS โดยลืมเปลี่ยน
CRS จาก UTM Zone 47N ค่าพิกัดจะเป็นหลักแสน (`503821, 2069434`) แทน `98.8, 18.7` ซึ่งเป็น
ความผิดพลาดที่พบบ่อยที่สุดในงาน GIS ไทยและมองไม่ออกจนกว่าจะเปิดแผนที่แล้วเจอว่าน้ำแพร่
ไปโผล่กลางมหาสมุทร

**`null-literal` + `new-value` แทนกฎ "ค่าต้องอยู่ในรายการที่กำหนด"** — ระบบไม่มีทางรู้ว่า
ตำบลน้ำแพร่มีกี่โซน จึงตั้งรายการค่าที่ถูกต้องไม่ได้ สองกฎนี้เลี่ยงการต้องรู้เรื่องนั้น

`null-literal` เป็นกฎที่แม่นสัมบูรณ์ (สตริง `'None'` ไม่มีทางเป็นค่าที่ตั้งใจ) กับข้อมูลวันนี้
มันจับ `zone_id = 'None'` ได้ 1 แถว และ **ไม่แตะค่า `'-'` ที่มี 155 แถวใน `own_soi`,
`own_road`, `own_villag`, `own_moo`** ซึ่งเป็นเครื่องหมาย "ไม่มี" ที่คนกรอกตั้งใจใส่

`new-value` เป็นกฎเชิงเวอร์ชัน จึง **ไม่ยิงเลยตอนนำเข้าครั้งแรก** ซึ่งถูกต้อง — จะตัดสินว่า
ค่าไหน "แปลกใหม่" ได้ต้องมีฐานเปรียบเทียบก่อน หลังจากนั้นมันจะจับค่าที่พิมพ์ผิดตอนที่มัน
เพิ่งถูกใส่เข้ามา ซึ่งเป็นจังหวะที่แก้ถูกที่สุด

> **เกณฑ์ที่ทดสอบแล้วปฏิเสธ:** เดิมกำหนด `rare-value` = ค่าที่พบ ≤ 2 แถวในฟิลด์ที่
> `distinct ≤ 50` และ `distinct / featureCount < 0.05` เอาไปรันกับข้อมูลจริงทั้งสี่เลเยอร์แล้ว
> **ยิงคำเตือน 18 ฟิลด์** ซึ่งเกือบทั้งหมดเป็นค่าที่ถูกต้อง (`rai = '17'` คือที่ดิน 17 ไร่จริง,
> `surface = 'metal'` คือค่ามาตรฐานของ OSM, `loc_name` คือชื่อเส้นทางเดินป่าจริง) — ได้ของ
> จริง 3 จาก 18 กฎนี้จึงถูกตัดทิ้ง ไม่ใช่ปรับตัวเลข เพราะ **ความถี่ไม่ใช่สัญญาณของความผิด**
> ค่าที่ถูกต้องจำนวนมากก็พบแค่แถวเดียวเหมือนกัน

**ทุกคำเตือนมีปุ่มดาวน์โหลด CSV** เฉพาะแถวที่เข้าข่ายพร้อมคอลัมน์ที่เกี่ยวข้อง เอาไปเปิดใน
QGIS แล้วไล่แก้ที่ต้นทางได้ทันที — นี่คือสิ่งที่ทำให้คำเตือนเป็นงานที่ทำต่อได้ แทนที่จะเป็น
ตัวเลขน่ารำคาญที่ทุกคนเรียนรู้ที่จะกดข้าม

### การกรองข้อมูลส่วนบุคคล — `src/lib/map-public.ts`

หัวใจของการกันข้อมูลหลุดคือฟังก์ชันบริสุทธิ์ตัวเดียว ไม่มี I/O เทสต์ได้ตรง ๆ ทำนองเดียวกับ
`src/lib/job-public.ts` ที่มีอยู่แล้ว

```ts
export function toPublicFeatureCollection(
  fc: FeatureCollection,
  publicFields: string[]
): FeatureCollection;
```

รูปทรงผ่านไปทั้งดุ้น ส่วน `properties` เก็บเฉพาะคีย์ที่อยู่ใน whitelist —
**`publicFields` ว่าง = `properties: {}` ไม่ใช่ "เปิดหมด"** ทิศทางของค่าเริ่มต้นสำคัญตรงนี้
เพราะฟิลด์ใหม่ที่โผล่มาในไฟล์เวอร์ชันหน้าจะถูกกันไว้เองโดยอัตโนมัติ ไม่ใช่หลุดออกไปเอง
โดยอัตโนมัติ (เหตุผลเดียวกับที่ `PUBLIC_JOB_FIELDS` ใน `src/types/portal.ts` เลือกทำเป็น
whitelist หลังจากเคยตกหล่นไปสามฟิลด์)

และเพราะการกรองเกิด **ตอนเผยแพร่ ไม่ใช่ตอนเสิร์ฟ** ไฟล์ที่วางอยู่บน CDN สาธารณะจึงไม่เคย
มีฟิลด์ PII อยู่ในนั้นตั้งแต่แรก ต่อให้โค้ดฝั่ง API พังหรือมีคนเดา URL เจอ ก็ไม่มีอะไรให้หลุด

### ค่าเริ่มต้นของทั้งสี่เลเยอร์ (สคริปต์นำเข้าครั้งแรกตั้งให้)

| เลเยอร์ | `geometryType` | `keyFields` | `visibility` | `publicFields` |
|---|---|---|---|---|
| `zone-moobang` โซนหมู่บ้าน | MultiPolygon | `['zone_id']` | public | `zone_id`, `Area Km2`, `Area Ria` (ทั้งหมด) |
| `road` ถนน | MultiLineString | `['full_id','zone_id']` | public | `name`, `name_en`, `alt_name_e`, `ref`, `highway`, `surface`, `lanes`, `maxspeed`, `zone_id` |
| `building` อาคาร | MultiPolygon | `[]` | public | `[]` (เหลือแค่รูปทรง) |
| `parcel` แปลงที่ดิน | MultiPolygon | `['parcel_cod']` | public | 11 ฟิลด์ ดูด้านล่าง |

`parcel.keyComposition = [['zone_id','block_id','lot'], ['block_id','lot']]` (สองสูตรตาม
Context ข้อ 3) — เลเยอร์อื่นเป็น `[]`

**แปลงที่ดิน — เปิด 11 ฟิลด์:** `parcel_cod`, `zone_id`, `block_id`, `lot`, `rai`, `ngan`,
`wa`, `subwa`, `province`, `amphur`, `tambol` (รหัสแปลง เนื้อที่ และตำแหน่งเชิงปกครองของ
*ตัวแปลง*)

**ปิด 22 ฟิลด์:** `own_line_n`, `own_Hse_no`, `own_moo`, `own_soi`, `own_villag`,
`own_road`, `own_tambol`, `own_amphur`, `own_provin` (ที่อยู่ของ *เจ้าของ*), `Id_Chanod`,
`parcel_no`, `survey_no`, `land_no`, `survey`, `mapsheet`, `land_type`, `scale`,
`utm_map1`–`utm_map4`, `utm_scale`

`Id_Chanod` ถูกปิดทั้งที่ดูเป็นข้อมูลกลาง ๆ เพราะเลขโฉนดบวกรูปแปลงบนแผนที่สาธารณะ =
ใครก็เอาไปขอคัดสำเนาที่สำนักงานที่ดินเพื่อดูชื่อเจ้าของได้

`building.publicFields = []` เพราะฟิลด์ที่มีทั้งหมด (`OBJECTID`, `FID_1`, `Shape_Leng`,
`Shape_Area`) ไม่มีความหมายต่อคนนอก — เปิดไปก็เปลืองขนาดไฟล์เปล่า ๆ

`building.keyFields = []` เพราะ `OBJECTID` unique จริงในไฟล์ชุดนี้ แต่ยืนยันความคงที่ข้าม
export จาก snapshot เดียวไม่ได้ (Context ข้อ 8) — เลเยอร์ที่ไม่มีคีย์จะเทียบส่วนต่างแค่ระดับ
จำนวนกับขอบเขต ไม่แกล้งบอกว่าอาคารไหนหายไป เจ้าหน้าที่เปลี่ยนทีหลังได้ในหน้าตั้งค่า

### API

**สาธารณะ (ไม่ต้องล็อกอิน)**

| Endpoint | ทำอะไร |
|---|---|
| `GET /api/map/layers` | รายชื่อเลเยอร์ที่ `visibility === 'public'` และมี `currentVersionNo` |
| `GET /api/map/layers/[id].geojson` | **302 redirect ไป `publicAsset.url`** บน Cloudinary CDN |

302 ไม่ใช่ proxy โดยตั้งใจ — ไม่มีไบต์ไหนวิ่งผ่านเซิร์ฟเวอร์เรา จึงไม่ชนเพดาน response
4 MB และรับคนพร้อมกันเท่าไรก็ได้โดยไม่กระทบพอร์ทัลส่วนอื่น

**เจ้าหน้าที่ (ผ่าน `checkAdmin()` เดิมใน `src/lib/auth-server.ts`)**

| Endpoint | ทำอะไร |
|---|---|
| `POST /api/admin/map/upload-signature` | ขอลายเซ็นอัปตรงเข้า Cloudinary (`resource_type: 'raw'`) |
| `POST /api/admin/map/layers/[id]/versions` | ลงทะเบียนไฟล์ที่อัปแล้ว → แกะ ตรวจ diff → draft |
| `POST /api/admin/map/versions/[vid]/publish` | กรองฟิลด์ → อัปไฟล์สาธารณะ → สลับสถานะ |
| `DELETE /api/admin/map/versions/[vid]` | ทิ้งร่าง (`discarded`) + ลบไฟล์บน Cloudinary |
| `GET /api/admin/map/versions/[vid]/download` | 302 ไป signed URL ของไฟล์เต็ม อายุ 5 นาที |
| `GET /api/admin/map/versions/[vid]/issues.csv?code=` | CSV แถวที่เข้าข่ายคำเตือนนั้น |
| `GET /api/admin/map/layers` | ทุกเลเยอร์ + ร่างที่ค้างอยู่ |
| `PATCH /api/admin/map/layers/[id]` | ตั้งค่า `keyFields` / `keyComposition` / `visibility` / `publicFields` |

ทุก payload ผ่าน Zod ใน `src/lib/schema.ts` ตามแพตเทิร์นเดิม

**ไฟล์เต็มใช้ Cloudinary `type: 'authenticated'`** เข้าถึงได้เฉพาะผ่าน signed URL ที่
เซิร์ฟเวอร์ออกให้เจ้าหน้าที่ที่ล็อกอินแล้ว — ไม่ใช่ public URL ที่เดาได้

### หน้าจอ

เพิ่ม `{ href: '/admin/map', label: 'ไฟล์แผนที่', icon: 'layers', exact: false }` ใน `NAV`
ของ `src/components/admin/AdminLayout.tsx`

**`/admin/map`** — การ์ดหนึ่งใบต่อเลเยอร์ ทั้งใบเป็นพื้นที่วางไฟล์ (ไม่ต้องเล็งปุ่ม) แสดง
ชื่อ ป้ายสถานะสาธารณะ/เฉพาะเจ้าหน้าที่ เวอร์ชันปัจจุบัน จำนวน feature ขนาด และใครอัปล่าสุด
พอวางไฟล์ การ์ดขยายลงมาเป็นแผงสรุปในที่เดิม (ไม่เด้ง modal ไม่เปลี่ยนหน้า) แสดงความคืบหน้า
ทีละขั้น → ผลตรวจ → ปุ่มคู่ `ทิ้งร่างนี้` / `ยืนยันและเผยแพร่`

ถ้าเจอ error ไม่มีปุ่มเผยแพร่ มีแต่คำอธิบายว่าไฟล์ผิดตรงไหนและต้องแก้อะไรใน QGIS

**`/admin/map/[layerId]`** — ตารางประวัติเวอร์ชัน (เวอร์ชัน · สถานะ · จำนวน feature ·
ส่วนต่าง · ใครอัป · ใครเผยแพร่ · เมื่อไร) พร้อมปุ่ม `ย้อนกลับมาใช้เวอร์ชันนี้` ที่แถว
`superseded` และแผงตั้งค่าใต้ตาราง

แผงตั้งค่าที่สำคัญที่สุดคือ **ตัวเลือกฟิลด์สาธารณะ** ซึ่งสร้างรายการจากฟิลด์ที่มีอยู่จริงใน
`stats.fields` ของเวอร์ชันปัจจุบัน ไม่ใช่รายการที่ hardcode ไว้ — แสดงอัตราการกรอกข้อมูล
ต่อฟิลด์ และฟิลด์ที่ชื่อเข้าข่าย PII (`own_*`, `Id_Chanod`, `parcel_no`, `survey_no`, `phone`)
ขึ้นป้ายเตือนอัตโนมัติ การติ๊กเปิดฟิลด์เหล่านี้ต้องยืนยันอีกครั้ง ป้ายนี้เป็นตัวช่วยเตือน
ไม่ใช่ตัวบังคับ — คนตัดสินยังเป็นเจ้าหน้าที่

### การนำเข้าครั้งแรก — `scripts/import-map-layers.ts`

ตามแบบ `scripts/import-google-calendar.ts` ที่มีอยู่ ดึงทั้งสี่ไฟล์จาก
`namphraesmartcity.ai/map/data/` แกะหัว `var json_X =` อัปขึ้น Cloudinary เป็นเวอร์ชัน 1
ของแต่ละเลเยอร์ พร้อมสร้าง `mapLayers` ตามค่าเริ่มต้นในตารางข้างบน แล้วพิมพ์รายงานผลตรวจ
ออกทาง console

**ปล่อยไว้เป็น `draft` ไม่เผยแพร่ให้อัตโนมัติ** เพราะ `publicFields` ที่สคริปต์ตั้งให้เป็นแค่
ข้อเสนอ เจ้าหน้าที่ต้องเข้าไปดูแล้วกดเผยแพร่เองครั้งเดียวต่อเลเยอร์ — การเปิดข้อมูลสู่
สาธารณะไม่ควรเป็นผลข้างเคียงของการรันสคริปต์

**รันซ้ำได้:** ถ้า `sha256` ตรงกับเวอร์ชันที่มีอยู่แล้วให้ข้าม ไม่สร้างเวอร์ชันซ้ำ

## Error handling

| สถานการณ์ | พฤติกรรม |
|---|---|
| ไม่ได้ตั้ง Cloudinary | หน้า `/admin/map` แสดงการ์ดอธิบายว่าต้องตั้ง env อะไร ไม่ crash (ตามแบบ `src/lib/cloudinary.ts` เดิม) |
| ไม่ได้ตั้ง `MONGODB_URI` ตอน production | `assertFileBackendAllowed()` โยน error ดัง ๆ ทุกครั้งที่เรียก store |
| อัปขึ้น Cloudinary สำเร็จแต่ลงทะเบียนไม่สำเร็จ | ไฟล์กำพร้าบน Cloudinary — สคริปต์ทำความสะอาดเก็บทีหลังได้ ไม่กระทบข้อมูลที่ใช้งานอยู่ |
| กดเผยแพร่ซ้ำสองครั้งพร้อมกัน | ตรวจ `status === 'draft'` ก่อนเสมอ ครั้งที่สองได้ 409 |
| ย้อนไปเวอร์ชันที่ไฟล์ถูกลบตามนโยบาย 5 เวอร์ชัน | `publicAsset` ยังอยู่ (ลบเฉพาะ `fullAsset`) จึงย้อนได้ปกติ ปุ่มดาวน์โหลดไฟล์เต็มเท่านั้นที่ปิด |
| shapefile zip ไม่มี `.prj` | เบราว์เซอร์แปลงไม่สำเร็จ ขึ้นข้อความบนการ์ดว่าต้อง export ให้มี `.prj` ด้วย ไม่มีอะไรถูกอัปขึ้น — เดา CRS แทนผู้ใช้ไม่ได้ |
| shapefile zip ที่แปลงแล้วพิกัดยังเป็นเมตร | ผ่านขึ้นไปตามปกติ แล้วโดนด่าน `outside-thailand` ฝั่งเซิร์ฟเวอร์จับ — เบราว์เซอร์เป็นแค่ตัวแปลง ไม่ใช่ด่านตรวจ |
| ไฟล์ zip ใหญ่จนเบราว์เซอร์แปลงไม่ไหว | จำกัดที่ 100 MB ก่อนเริ่มแปลง พร้อมข้อความบอกให้แบ่งไฟล์หรือส่ง GeoJSON มาแทน |
| GeoJSON มี `crs` ที่ไม่ใช่ CRS84/EPSG:4326 | error `parse-failed` — ไม่แปลงให้เงียบ ๆ |

## Testing

vitest ตามแพตเทิร์นเดิม (ไฟล์ `*.test.ts` วางข้างไฟล์จริง ครอบเฉพาะ logic บริสุทธิ์)

| ไฟล์ | ตรึงอะไรไว้ |
|---|---|
| `src/lib/map-public.test.ts` | ฟิลด์นอก whitelist หาย · `publicFields` ว่าง = `properties` ว่าง · geometry ไม่ถูกแตะ · **ฟิลด์ที่เพิ่งโผล่มาใหม่ต้องไม่หลุดเอง** |
| `src/lib/map-parse.test.ts` | `.js` (qgis2web) กับ `.geojson` สองทางเข้าได้ FeatureCollection หน้าตาเดียวกัน · หัว `var json_X = ` หลายรูปแบบ · JSON พังต้องได้ `parse-failed` ไม่ใช่ throw ดิบ |
| `src/lib/map-checks.test.ts` | ด่านตรวจทีละข้อ · `outside-thailand` ต้องจับพิกัด UTM 47N ที่ลืมแปลง · `null-literal` ต้องจับ `'None'` แต่**ไม่แตะ `'-'`** · `new-value` ต้องเงียบเมื่อไม่มีเวอร์ชันก่อนหน้า |
| `src/lib/map-diff.test.ts` | คีย์เดี่ยว / คีย์ประกอบ / ไม่มีคีย์ · คีย์ซ้ำต้องไม่ทำให้ diff พัง |
| `src/lib/map-store.test.ts` | ฟังก์ชันบริสุทธิ์ที่แยกออกมาจาก store ตามแบบ `buildNewJob`/`buildStatusPatch` ใน `jobs-store.ts`: `buildNewVersion()` · `buildPublishPatch()` (สลับสถานะคู่เก่า/ใหม่) · `assetsToPrune()` (นโยบาย 5 เวอร์ชัน ต้องไม่คืนเวอร์ชันที่ published) — ไม่แตะ Mongo หรือไฟล์ |

**Fixture ทั้งหมดเป็นข้อมูลสังเคราะห์** ที่จำลองปัญหาจริงที่พบ (คีย์ซ้ำ, encoding พัง,
พิกัด UTM ที่ลืมแปลง, คีย์ประกอบกลับไม่ได้, ค่าที่พบแถวเดียว) แต่ **ไม่มีเลขโฉนดหรือบ้านเลขที่
จริงของชาวบ้านอยู่ใน git**

## Out of scope

- **หน้าแสดงแผนที่ในพอร์ทัล** — ผู้ใช้เลือก "คลังไฟล์ + API" ชัดเจน หน้า qgis2web เดิมยัง
  ทำหน้าที่แสดงผลต่อไป โดยเปลี่ยนไปดึง GeoJSON จาก `/api/map/layers/[id].geojson` แทน
- **แก้ไข attribute/geometry รายแปลงในพอร์ทัล** — เป็นสถาปัตยกรรมคนละแบบ (ดู "เหตุผลที่
  ไม่เลือกทางอื่น")
- **แก้ `zone_id` ให้อัตโนมัติ** — ตัดสินใจแล้วว่าระบบต้องไม่ทำ (Context ข้อ 4)
- **basemap** — Google Satellite ที่หน้าเดิมดึงจาก `mt1.google.com/vt` ผิด ToS ของ Google
  แต่เป็นเรื่องของหน้าแสดงผล ไม่ใช่ของคลังไฟล์ บันทึกไว้ให้แก้ตอนแตะหน้านั้น
  (ทางเลือกที่ถูกลิขสิทธิ์: Esri World Imagery หรือ Google Maps API ที่มีสัญญา)
- **KML/KMZ** — ผู้ใช้ไม่ได้เลือก เพิ่มทีหลังได้ที่ `map-parse.ts` จุดเดียว

## Files

**ใหม่**

```
src/types/map.ts                             โดเมนไทป์
src/lib/map-store.ts                         Mongo/file backend + invariant สถานะ
src/lib/map-parse.ts                         .js / .geojson → FeatureCollection (เซิร์ฟเวอร์, ไม่มี dep)
src/lib/map-shapefile-client.ts              .zip → GeoJSON ด้วย dynamic import('shpjs') (เบราว์เซอร์เท่านั้น)
src/lib/map-checks.ts                        ด่านตรวจ
src/lib/map-diff.ts                          เทียบสองเวอร์ชัน
src/lib/map-public.ts                        กรอง properties ตาม whitelist
src/pages/admin/map/index.tsx                การ์ดเลเยอร์ + วางไฟล์
src/pages/admin/map/[layerId].tsx            ประวัติ + ตั้งค่า
src/components/admin/MapLayerCard.tsx        การ์ดหนึ่งใบ + drop zone + แผงสรุป
src/components/admin/PublicFieldPicker.tsx   ตัวเลือกฟิลด์สาธารณะ
src/pages/api/map/layers/index.ts                       สาธารณะ
src/pages/api/map/layers/[id].geojson.ts                สาธารณะ (302 → CDN)
src/pages/api/admin/map/upload-signature.ts
src/pages/api/admin/map/layers/index.ts
src/pages/api/admin/map/layers/[id].ts                  PATCH ตั้งค่า
src/pages/api/admin/map/layers/[id]/versions.ts         POST ลงทะเบียนไฟล์ที่อัปแล้ว
src/pages/api/admin/map/versions/[vid]/index.ts         DELETE ทิ้งร่าง
src/pages/api/admin/map/versions/[vid]/publish.ts
src/pages/api/admin/map/versions/[vid]/download.ts
src/pages/api/admin/map/versions/[vid]/issues.csv.ts
scripts/import-map-layers.ts                            นำเข้าครั้งแรก
```

**แก้**

```
src/components/admin/AdminLayout.tsx   เพิ่มเมนู 'ไฟล์แผนที่'
src/lib/schema.ts                      Zod ของ payload ใหม่
src/lib/cloudinary.ts                  รองรับ resource_type 'raw' + type 'authenticated' + signed URL
README.md                              หัวข้อ 'คลังไฟล์แผนที่'
package.json                           dependency ใหม่ (ดูด้านล่าง)
```

ไม่มี env ใหม่ — ใช้ `CLOUDINARY_*` กับ `MONGODB_URI` ชุดเดิมทั้งหมด `.env.example` จึงไม่ต้องแก้

**Dependency ใหม่**

| แพ็กเกจ | ใช้ทำอะไร | ทำงานที่ไหน |
|---|---|---|
| `shpjs` | shapefile `.zip` → GeoJSON พร้อมแปลงพิกัดตาม `.prj` (บันเดิล proj4 มาให้) | **เบราว์เซอร์เท่านั้น** |

### ทำไมแปลง shapefile ที่เบราว์เซอร์ ไม่ใช่ที่เซิร์ฟเวอร์

ทดสอบ `shpjs@6.2.0` จริงก่อนตัดสินใจ ผลคือมันแปลง UTM Zone 47N ได้ถูกต้อง
(`485894, 2070600` → `98.86619, 18.72676`) **แต่พังบน Node เมื่อโหลดผ่าน `require()`**
ด้วย `ReferenceError: self is not defined`

ต้นเหตุอยู่ใน `package.json` ของมันเอง:

```
"exports": { "import": "./lib/index.js",   ← ESM สะอาด ใช้บน Node ได้
             "require": "./dist/shp.js" }  ← บันเดิลสำหรับเบราว์เซอร์ อ้าง self
```

Pages Router ของ Next คอมไพล์ API route เป็น CJS และ **ไม่ bundle dependency โดยปริยาย**
(`bundlePagesRouterDependencies` ต้องเปิดเอง — ยืนยันจาก
`node_modules/next/dist/docs/02-pages/04-api-reference/04-config/01-next-config-js/bundlePagesRouterDependencies.md`)
dependency ที่ไม่ถูก bundle จะถูกเรียกด้วย `require` ของ Node → ได้บันเดิลเบราว์เซอร์ → พัง

ทางแก้ที่พิจารณาแล้วไม่เลือก:

- **เปิด `bundlePagesRouterDependencies: true`** — แก้ได้จริงแต่เปลี่ยนพฤติกรรม bundling ของ
  *ทุก* dependency ฝั่งเซิร์ฟเวอร์พร้อมกัน รวมถึง `mongodb`, `@clerk/nextjs`, `cloudinary`
  ที่วันนี้ทำงานดีอยู่ — รัศมีความเสียหายกว้างเกินกว่าเหตุ และทดสอบยากถ้าไม่ build เต็ม
- **ใช้ `shapefile` + `proj4` + unzip เองบนเซิร์ฟเวอร์** — สาม dependency แทนหนึ่ง และต้อง
  เขียนโค้ดอ่าน `.prj` (WKT) เองซึ่งเป็นส่วนที่พลาดง่ายที่สุด

**ทางที่เลือก:** เบราว์เซอร์แปลง `.zip` → GeoJSON ด้วย dynamic `import('shpjs')` (โหลดเฉพาะ
ตอนมีคนวางไฟล์ zip จริง ~100 KB minified ไม่กระทบขนาดหน้าตอนเปิดปกติ) แล้วอัป GeoJSON
ขึ้น Cloudinary ตามเส้นทางเดียวกับไฟล์ชนิดอื่น

เหตุผลที่ทางนี้ไม่ใช่การลดความปลอดภัย: **เซิร์ฟเวอร์ไม่เคยเชื่อไฟล์ที่รับมาอยู่แล้ว** ด่านตรวจ
ทั้งหมดรันฝั่งเซิร์ฟเวอร์กับ GeoJSON ที่ได้รับ ไม่ว่ามันจะถูกแปลงมาจากไหน — ผู้ใช้ที่ประสงค์ร้าย
อัป GeoJSON อะไรก็ได้อยู่แล้วโดยไม่ต้องผ่าน shpjs (แค่เลือกอัปไฟล์ `.geojson` ตรง ๆ) การแปลง
ที่เบราว์เซอร์จึงเป็นแค่ความสะดวก ไม่ใช่เส้นแบ่งความไว้ใจ

และ **ไม่มีจุดไหนบนเซิร์ฟเวอร์ที่ต้องอ่าน shapefile เลย** — สคริปต์นำเข้าครั้งแรกอ่านไฟล์
qgis2web `.js` จากเว็บเดิมเท่านั้น ส่วน `issues.csv` กับการย้อนเวอร์ชันอ่าน GeoJSON ที่เก็บไว้แล้ว

`source.format` ยังบันทึกเป็น `'shapefile-zip'` และ `source.fileName` เก็บชื่อ `.zip` เดิมไว้
เพื่อให้ประวัติบอกที่มาได้ถูกต้อง แม้สิ่งที่อัปขึ้นจริงจะเป็น GeoJSON ที่แปลงแล้ว
