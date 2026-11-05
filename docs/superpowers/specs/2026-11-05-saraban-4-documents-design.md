# สารบรรณรอบ 4 — เอกสาร ตรา ลายมือ ลงนามในระบบ

วันที่ 2026-11-05 · branch `feat/saraban-4` (แตกจาก `feat/saraban-3` / PR #10) · สเปกแม่
[2026-09-13-saraban-design.md](2026-09-13-saraban-design.md) ข้อ 10 "รอบ 4" · ต้นแบบ
[design_handoff_esaraban](../../design_handoff_esaraban/README.md) จอ 5 และโหมดเจ้าหน้าที่ B

## 1. ตัดสินแล้ว (ผู้ใช้อนุมัติในแชต)

1. **ตรา/ลายมือบันทึกไปพร้อมการเกษียน** — ผูกกับ event `annotated` นั้น แก้/ลบทีหลังไม่ได้ (เหมือนหมึก)
   แต่ละการเกษียนเป็นชั้นของตัวเองซ้อนบนเอกสาร
2. **ลงนามในระบบเป็นทางเลือก** — ช่องติ๊กตอนเกษียน ติ๊กแล้วเท่านั้นจึงบันทึกการลงนาม
3. **ลายมือและการลงนามต้องเป็นเจ้าตัว** (โหมดงานของฉัน) · ตราธุรการวางแทนได้ในโหมดเต็ม
4. **ส่งไฟล์ให้ pdf.js ผ่านเซิร์ฟเวอร์ของเราเอง** (same-origin) ไม่ตั้ง CORS ที่ bucket
5. เพิ่ม dependency `pdfjs-dist` — commit `package.json` + `package-lock.json` (เฉพาะส่วนของ pdfjs-dist
   เท่าที่ทำได้ ส่วน `"peer": true` ที่ค้างในเครื่องไม่ใช่ของรอบนี้)
6. ป้ายเขียน **"ลงนามในระบบ"** เสมอ ห้ามใช้ "ลงนามดิจิทัล · ตรวจสอบแล้ว" (สเปกแม่ข้อ 10)

## 2. ข้อมูล

### ตรา

`STAMP_KINDS = ['ack', 'act', 'circ', 'approve']` — ป้าย ทราบ / ดำเนินการ / แจ้งเวียน / เห็นชอบ
สี `#1E4D8C` / `#1C7C54` / `#8A5A00` / `#5B3A8C` (ต้นแบบ) อยู่ใน `saraban-labels.ts`

### `SarabanMark` (ต่อท้าย event `annotated` เป็น `marks?: SarabanMark[]`)

```ts
type MarkBase = { fileId: string; page: number };          // page เริ่ม 1
type StampMark = MarkBase & { type: 'stamp'; stamp: StampKind; x: number; y: number; rot: number };
type InkMark   = MarkBase & { type: 'ink'; strokes: number[][] }; // แต่ละเส้น [x1,y1,x2,y2,…]
```

- พิกัดทุกตัวเป็นสัดส่วน 0–1 ของกรอบหน้า (x ซ้าย→ขวา, y บน→ล่าง) — ไม่ขึ้นกับขนาดจอ · ปัดทศนิยม 4 ตำแหน่ง
  ที่ client · `x,y` ของตรา = จุดกึ่งกลาง · `rot` องศา −15…15
- ขีดจำกัดต่อการเกษียนหนึ่งครั้ง: ตรา ≤ 20 · จุดลายมือรวม ≤ 5,000 (คู่ x,y = 1 จุด) · เส้นหนึ่ง ≥ 2 จุด ·
  เส้น ≤ 200 · กันเอกสาร Mongo บวม (หนังสือหนึ่งเรื่อง = เอกสารเดียว เพดาน 16 MB)
- ลายมือหนึ่งหน้า = InkMark เดียว (client รวมเส้นของหน้าเดียวกัน)
- เซิร์ฟเวอร์ตรวจ: `fileId` ต้องอยู่ใน `doc.files` · `page` ≤ `file.pages` เมื่อ pages > 0 · ไฟล์รูป page = 1
  · PDF ที่ pages = 0 (อ่านไม่ได้ตอนอัป) รับ page ≤ 500 → ผิด = 400 `invalid_mark`

### `SarabanSignature` (ต่อท้าย event `annotated` เป็น `signature?`)

```ts
type SarabanSignature = { ip: string; files: { fileId: string; name: string; sha256: string }[] };
```

- ผู้ลงนาม/เวลา = `by`/`byName`/`at` ของ event เดียวกัน (ไม่เก็บซ้ำ)
- `sha256` เซิร์ฟเวอร์คำนวณเองจาก `getObjectBytes` ของทุกไฟล์ในหนังสือ ณ ตอนลงนาม (ไม่รับจาก client)
- ไม่มีไฟล์แนบ → `files: []` (ลงนามข้อความเกษียน) · มีไฟล์แต่ไม่ได้ตั้ง bucket → 503 `storage_not_configured`
- `ip` = ค่าแรกของ `x-forwarded-for` (Railway อยู่หลัง proxy) ไม่มี → `req.socket.remoteAddress` → `''`

## 3. API

- **schema** `annotatePatchSchema` เพิ่ม `marks` (default `[]`) และ `sign` (default `false`) — ใช้ร่วมทั้งสอง route
  (`docPatchSchema` และ `memberPatchSchema` อ้างตัวเดียวกันอยู่แล้ว)
- **โหมดเต็ม** `PATCH /docs/[id]` annotate: มี mark ชนิด `ink` หรือ `sign: true` → 400 `self_only`
- **โหมดเจ้าหน้าที่** `PATCH /me/docs/[id]` annotate: รับครบ (ผ่าน `not_holder` ก่อนเหมือนเดิม)
- ทั้งสองทาง: ตรวจ marks กับไฟล์ของหนังสือ (`validateMarks` บริสุทธิ์) → ลงนามถ้าติ๊ก → `makeEvent` ใส่ `marks`
  (เฉพาะเมื่อไม่ว่าง) และ `signature`
- **ไฟล์ดิบสำหรับ pdf.js** — `GET …/files/[fileId]?raw=1` ทั้งโหมดเต็มและโหมดเจ้าหน้าที่: ตรวจสิทธิ์เดิม แล้วส่ง
  bytes จาก `getObjectBytes` พร้อม `Content-Type` ตามชนิด · `Cache-Control: private, max-age=300` ·
  ไม่มี `raw` = 302 แบบเดิม (เปิดแท็บใหม่)
- **ห้ามลบไฟล์ที่ถูกอ้าง** — `isFileReferenced(doc, fileId)` (มี mark หรือ signature อ้าง) → DELETE ตอบ 409
  `file_referenced` · หน้าจอซ่อนปุ่มลบของไฟล์นั้น

## 4. หน้าจอ

- **`DocViewer`** (component ใหม่ ใช้สองโหมด): เลือกไฟล์ (ถ้ามีหลายไฟล์) · "หน้า n/N" · PDF เรนเดอร์ด้วย
  pdf.js ลง canvas (โหลดแบบ dynamic import ฝั่ง client เท่านั้น) · JPG/PNG เป็น `<img>` · ชั้นบน: ตรา/ลายมือ
  ของทุกการเกษียนที่ผ่านมา (อ่านอย่างเดียว) + ชั้นร่างของผู้ใช้ตอนนี้ · กล่องกระดาษกว้างตามคอลัมน์ สูงตาม
  สัดส่วนหน้าจริง · ไม่มีไฟล์ = ข้อความ "ไม่มีไฟล์แนบ" · bucket ไม่ได้ตั้ง = ข้อความเดิม
- **เครื่องมือ** ตามโหมด: ตรา 4 ปุ่ม (กดแล้ววางกลางหน้า ลากย้ายได้ ตราในร่างมีปุ่ม × เอาออก) · ปากกา (toggle)
  + ล้างลายมือ เฉพาะโหมดงานของฉัน · canvas รับ pointer events (`touch-action: none` ขณะเปิดปากกา) เส้น 2px
- **หน้าเกษียนโหมดเต็ม** `/saraban/annotate/[id]`: แทนตัวอย่างไฟล์เดิมด้วย `DocViewer` (ตราอย่างเดียว) · ร่าง
  ส่งไปกับ `annotateDoc`
- **หน้าหนังสือโหมดเจ้าหน้าที่** `/saraban/me/doc/[id]`: `DocViewer` (ตรา + ปากกา) เหนือฟอร์ม · ช่องติ๊ก
  "ลงนามในระบบ" ในขั้นยืนยัน (เฉพาะเมื่อเลือก ทราบ·จบเรื่อง / ส่งต่อ) พร้อมบรรทัดย่อยว่าเก็บชื่อ เวลา IP
  และรหัสตรวจสอบไฟล์ · ปุ่มทราบ·จบเรื่องด่วนบนการ์ดไม่เปลี่ยน (ไม่มีตรา/ลงนาม)
- **ไทม์ไลน์** (`EventDetail`): "ตรา: ทราบ, เห็นชอบ" สีตรา · "มีลายมือ n หน้า" · "ลงนามในระบบ · ชื่อ · เวลา"
  + รายการไฟล์พร้อม sha256 8 ตัวแรก (กดดูเต็ม)

## 5. ไม่ทำในรอบนี้

ใบรับรองดิจิทัล (Thai Digital ID / CA) · พิมพ์ตราลงไฟล์ PDF จริง (ตราเป็นชั้นบนจอ ไฟล์ต้นฉบับคงเดิม hash จึง
ตรวจได้) · OCR · ตราลงรับอัตโนมัติมุมซ้ายบน · ยางลบ/undo ทีละเส้น (มีแค่ล้างลายมือทั้งหมด)

## 6. ทดสอบ

- บริสุทธิ์: `validateMarks` (fileId/page/ขีดจำกัด) · `isFileReferenced` · schema marks/sign (ช่วง 0–1, rot,
  ขีดจำกัดจำนวน) · `clientIp` · ฟังก์ชันพิกัดของ viewer (normalize/denormalize)
- source-scan ใน `api-guard-coverage.test.ts`: route โหมดเต็มมี `self_only` · route ไฟล์ทั้งสองรองรับ `raw`
- smoke บน dev server (file backend, ไม่มี bucket): ตราโหมดเต็มผ่าน · ink/sign โหมดเต็ม 400 · mark ผิดไฟล์/
  หน้า 400 · ลงนามโหมดเจ้าหน้าที่ไม่มีไฟล์ได้ `files: []` · หนังสือที่มีไฟล์ใส่ผ่าน file backend โดยตรง
  (ไม่มี bucket) → ลงนาม 503
- กรณีที่ต้องมีไฟล์จริง (raw, sha256, เรนเดอร์ PDF, ห้ามลบไฟล์ที่ถูกอ้าง) ใช้ bucket **ทดสอบ** เท่านั้น — ถาม
  ผู้ใช้ก่อนว่าค่า `BUCKET_*` ใน `.env.local` เป็น bucket ทดสอบหรือ bucket จริง (สเปกแม่ข้อ 5 ห้ามทดสอบบน
  bucket จริง)
