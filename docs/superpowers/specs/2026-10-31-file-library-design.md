# คลังไฟล์ — ฝากไฟล์ภายในให้เจ้าหน้าที่ แสดงเป็นรายการค้นหาได้

**วันที่:** 2026-10-31
**ต่อยอดจาก:** [2026-09-13-saraban-design.md](2026-09-13-saraban-design.md) (ชั้นเก็บไฟล์ใน bucket) ·
[2026-08-11-portal-feature-permissions-design.md](2026-08-11-portal-feature-permissions-design.md) (สิทธิ์รายฟีเจอร์)

---

## คำถามตั้งต้น

> "ฉันจะทำฝากไฟล์เพื่อแสดงผลเป็นรายการสำหรับเจ้าหน้าที่แบบหน้านี้ ได้มั้ย"

ภาพตัวอย่างคือหน้า "ฐานข้อมูลประชากร" ของเว็บเทศบาล: หัวข้อ · "คุณกำลังอยู่หน้า N" · ช่องค้นหา ·
ตาราง ลำดับ/ชื่อ (ชื่อเป็นลิงก์ไปไฟล์) · แบ่งหน้าละ 20 รายการ `<< < 1 2 > >>`

## ข้อสรุปจากการคุย

| เรื่อง | ตัดสิน |
|---|---|
| ใครดู | เฉพาะเจ้าหน้าที่ที่ล็อกอิน (สมาชิกที่ผ่านทะเบียน) — เป็นคลังเอกสารภายใน ไม่ใช่หน้าสาธารณะ |
| หมวดหมู่ | ไม่แบ่ง — รายการเดียว เรียงตามวันที่อัปโหลด (ใหม่ก่อน) ค้นหาจากชื่อเรื่อง |
| สิทธิ์ | สมาชิกทุกคนดู/เปิดไฟล์ได้ · ผู้มีสิทธิ์ `files` อัปโหลด แก้ชื่อ ลบได้ |
| ชนิดไฟล์ | PDF / JPG / PNG ไม่เกิน 10 MB (ตัวตรวจชุดเดียวกับสารบรรณ) |
| ข้อมูลต่อรายการ | ชื่อเรื่อง · ไฟล์ (1 ไฟล์ต่อรายการ) · วันที่อัปโหลด — **ไม่เก็บชื่อผู้อัปโหลด** |
| แนวทาง | ฟีเจอร์ใหม่แยกจากสารบรรณ ใช้ชั้นเก็บไฟล์ใน bucket ร่วมกัน |

แนวทางที่ตัดทิ้ง:
- **ใส่เป็นเมนูในระบบสารบรรณ** — shell ของสารบรรณล็อกด้วยสิทธิ์ `saraban` ขัดกับ "สมาชิกทุกคนดูได้"
- **เก็บบน Cloudinary** — ได้ URL สาธารณะถาวร ใครได้ลิงก์ก็เปิดได้ ขัดกับเอกสารภายใน

---

## 1. ข้อมูล

Mongo collection `fileLibrary` (ฐานเดียวกับ `getDb()`) — type อยู่ใน `src/types/file-library.ts`

```ts
type LibraryFile = {
  id: string;          // uuid
  title: string;       // ชื่อเรื่องที่แสดง 1–300 ตัวอักษร (trim แล้ว)
  fileName: string;    // ชื่อไฟล์เดิม ใช้ตั้งชื่อตอนเปิด/ดาวน์โหลด (Content-Disposition)
  key: string;         // object key ใน bucket: `files/<uuid>.<format>`
  format: 'pdf' | 'jpg' | 'png';
  bytes: number;
  uploadedAt: string;  // ISO
};
```

- index: `{ uploadedAt: -1 }` สำหรับการเรียง · `{ id: 1 }` unique
- ไม่มี Mongo (dev): เก็บอาเรย์ลง `data/file-library.json` ผ่าน `readJsonArray`/`writeJsonArray`
  และ production ที่ไม่มี `MONGODB_URI` ต้องโยน error เหมือน `assertSarabanFileBackendAllowed`

## 2. ที่เก็บไฟล์

- bucket เดียวกับสารบรรณ (env `BUCKET_*` ชุดเดิม) แต่ prefix `files/` แยกจาก `saraban/`
- **ต้องแยก prefix**: `scripts/smoke-saraban-api.mts` ลบทุก key ที่ `listKeys()` คืน (ใต้ `saraban/`)
  ถ้าใช้ prefix ร่วม ไฟล์คลังจะถูกลบด้วย · สคริปต์สำรอง `backup:saraban` ก็ไม่ควรกวาดไฟล์คลังไปด้วย
- ปรับ `src/lib/saraban-storage.ts` เท่าที่จำเป็นให้ใช้ร่วมได้:
  - `putObject` / `deleteObject` / `viewUrl` ใช้ได้กับ key ใดก็ได้อยู่แล้ว — ใช้ตรง ๆ
  - `putObject` รับ `pages` — คลังส่ง `1` เสมอ (ไม่นับหน้า PDF ไม่ได้ใช้)
  - `listKeys()` และ `discardUnattached()` คงผูกกับ `SARABAN_PREFIX` เหมือนเดิม ไม่แตะ
- ใช้ `sniffFormat`, `CONTENT_TYPES`, `MAX_FILE_BYTES` (10 MB) จาก `saraban-attachment.ts`
  และ `readRawBody` จาก `raw-body.ts`
- เปิดไฟล์ผ่านลิงก์ชั่วคราว 5 นาที (`VIEW_URL_TTL_SECONDS`) เท่านั้น bucket เป็น private เสมอ

## 3. สิทธิ์

- เพิ่ม `'files'` **ต่อท้าย** `FEATURES` ใน `src/lib/user-access.ts` (ลำดับมีผลกับ `firstAllowedPath`)
  - `FEATURE_HOME.files = '/admin/files'`
  - `FEATURE_LABELS` เพิ่ม `{ key: 'files', label: 'คลังไฟล์ (อัปโหลด/ลบ)' }`
  - ไม่เพิ่มเข้า `DEFAULT_FEATURES`
- **ดู** = สมาชิกทุกคน:
  - SSR guard ใหม่ `getMemberSsrProps` ใน `auth-server.ts` = `buildSsrGuard(() => true)`
  - เมนู sidebar ใหม่ที่ `feature: 'member'` → แสดงให้ทุกคนที่ล็อกอินเป็นสมาชิก
  - route ดูใช้ `requireAdmin` และเพิ่มชื่อไฟล์ route เข้า `BARE_REQUIRE_ADMIN_OK`
    ใน `api-guard-coverage.test.ts` พร้อมคอมเมนต์เหตุผล
- **เขียน** = `files`:
  - route ที่รวม GET กับ POST ไว้ในไฟล์เดียว (`files/index.ts`) ใช้ `requireAdmin` แล้วเช็ค
    `hasFeature(admin, 'files')` ในไฟล์ก่อนเขียน — แพทเทิร์นเดียวกับ `config.ts`
  - route ที่เขียนอย่างเดียวใช้ `requireFeature(req, res, 'files')`
- หน้าเว็บรู้สิทธิ์เขียนจาก `/api/admin/me` (`features` / `isManager`) ที่มีอยู่แล้ว
  การซ่อนปุ่มเป็นแค่ UX — สิทธิ์จริงตัดสินที่ API

## 4. API

| Route | Guard | หน้าที่ |
|---|---|---|
| `GET /api/admin/files?q=&page=` | `requireAdmin` | คืน `{ items, total, page, pageSize }` · `pageSize = 20` |
| `POST /api/admin/files?title=&name=` | `requireAdmin` + `hasFeature('files')` | body = เนื้อไฟล์ดิบ (bodyParser ปิด) |
| `PATCH /api/admin/files/[id]` | `requireFeature('files')` | body `{ title }` แก้ชื่อเรื่อง |
| `DELETE /api/admin/files/[id]` | `requireFeature('files')` | ลบรายการ + object |
| `GET /api/admin/files/[id]/view` | `requireAdmin` | 302 ไปลิงก์ชั่วคราว · `Cache-Control: no-store` |

**GET รายการ**
- `q` trim แล้ว ว่าง = ทั้งหมด · ไม่ว่าง = `title` ตรงแบบ substring (regex ที่ escape อักขระพิเศษแล้ว
  flag `i`) · ตัด `q` ที่ยาวเกิน 100 ตัวอักษร
- `page` ไม่ใช่จำนวนเต็มบวก = 1 · เกินหน้าสุดท้าย = คืน items ว่างพร้อม `total` จริง
  (หน้าเว็บพาไปหน้าสุดท้ายเอง)
- sort `uploadedAt` desc แล้ว `id` desc (ให้ลำดับนิ่งเมื่อเวลาเท่ากัน) · skip/limit
- คืนเฉพาะ `id, title, format, bytes, uploadedAt` — ไม่คืน `key`

**POST อัปโหลด** (คำขอเดียว ไม่แยกสองขั้นแบบสารบรรณ — หนึ่งรายการมีไฟล์เดียว
และไม่ทิ้งไฟล์กำพร้าเมื่อผู้ใช้อัปแล้วปิดฟอร์ม)
1. ไม่มีสิทธิ์ `files` → 403 `feature_denied`
2. storage ไม่ครบ → 503 `storage_not_configured`
3. ตรวจ `title` (zod: trim, 1–300) และ `name` (trim, 1–255) จาก query → 400 `invalid_title` / `invalid_name`
4. `Content-Length` เกิน → 413 ทันที · อ่าน body ด้วย `readRawBody(req, MAX_FILE_BYTES)` → null = 413 `file_too_large`
5. `sniffFormat` → null = 400 `bad_format`
6. `putObject('files/<uuid>.<format>', body, CONTENT_TYPES[format], 1)`
7. insert รายการ — ล้มเมื่อไหร่ `deleteObject(key)` (catch แล้ว warn) แล้วตอบ 500
8. ตอบ 201 พร้อมรายการที่สร้าง

**DELETE**: ลบรายการใน DB ก่อน แล้วค่อย `deleteObject` — ลบ object พลาด = warn ไฟล์กำพร้าหนึ่งไฟล์
ไม่ใช่รายการที่ชี้ไปไฟล์ที่หายไป (แพทเทิร์นเดียวกับ `saraban/docs/[id]/files/[fileId].ts`) · ไม่พบ = 404

**view**: ไม่พบ = 404 · `viewUrl(key, fileName, CONTENT_TYPES[format])` แล้ว `res.redirect(302, …)`
ไม่ return ค่าของ redirect

route ทุกตัวห่อ try/catch → `console.error` + 500 `server_error` เหมือน route สารบรรณ

## 5. หน้าจอ `/admin/files`

ใน `AdminLayout` · `getServerSideProps = getMemberSsrProps` · ห่อด้วย `withMemberGuard`

**sidebar**: เพิ่ม `{ href: '/admin/files', label: 'คลังไฟล์', icon: 'folder', exact: false, feature: 'member' }`

**หน้ารายการ**
- หัวข้อ "คลังไฟล์" · บรรทัดรอง "คุณกำลังอยู่หน้า N"
- ช่องค้นหาเต็มกว้าง placeholder "ค้นหาชื่อไฟล์…" · debounce 300ms · เปลี่ยนคำค้น = กลับหน้า 1
- `q` และ `page` อยู่ใน URL (`router.replace` แบบ shallow) — back ได้ ส่งลิงก์ต่อได้
- ดึงข้อมูลด้วย SWR จาก `GET /api/admin/files`
- ตาราง:
  - **ลำดับ** = `(page - 1) * 20 + i + 1`
  - **ชื่อ** = ลิงก์ไป `/api/admin/files/[id]/view` เปิดแท็บใหม่ (`target="_blank" rel="noopener"`)
  - **วันที่อัปโหลด** = วันที่ไทยย่อ เช่น "31 ต.ค. 2569" · ซ่อนบนจอเล็ก
- แบ่งหน้า `<< < [หมายเลข] > >>` แสดงหมายเลขรอบหน้าปัจจุบันไม่เกิน 5 ปุ่ม · ปุ่มที่กดไม่ได้ disabled
  · ซ่อนแถบเมื่อมีหน้าเดียว
- ว่าง: "ยังไม่มีไฟล์" (ไม่มีคำค้น) / "ไม่พบไฟล์ที่ตรงกับ “…”" (มีคำค้น)
- กำลังโหลด / โหลดล้ม: ข้อความในตารางพร้อมปุ่มลองใหม่

**ผู้มีสิทธิ์ `files` เห็นเพิ่ม**
- ปุ่ม **อัปโหลดไฟล์** มุมขวาบน → กล่อง: เลือกไฟล์ 1 ไฟล์ (`accept=".pdf,.jpg,.jpeg,.png"`) ·
  ช่องชื่อเรื่องเติมจากชื่อไฟล์ตัดนามสกุล แก้ได้ · ตรวจขนาดฝั่ง client ก่อนส่ง (> 10 MB ห้ามส่ง) ·
  ระหว่างส่ง ปุ่ม disabled · สำเร็จ = ปิดกล่อง กลับหน้า 1 ล้างคำค้น revalidate
- ท้ายแถว: **แก้ชื่อ** (แก้ในแถว Enter บันทึก Esc ยกเลิก) · **ลบ** (กล่องยืนยันแสดงชื่อเรื่อง)
- ลบรายการสุดท้ายของหน้าที่ไม่ใช่หน้า 1 → ถอยไปหน้าก่อน

**ข้อความ error**
| error | ข้อความ |
|---|---|
| `storage_not_configured` | "ยังไม่ได้ตั้งค่าที่เก็บไฟล์ ติดต่อผู้ดูแลระบบ" (แถบบนหน้า + ซ่อนปุ่มอัปโหลด เมื่อได้จากการอัปโหลด) |
| `file_too_large` | "ไฟล์ใหญ่เกิน 10 MB" |
| `bad_format` | "รับเฉพาะไฟล์ PDF, JPG, PNG" |
| `invalid_title` | "กรุณาใส่ชื่อเรื่อง (ไม่เกิน 300 ตัวอักษร)" |
| `feature_denied` | "คุณไม่มีสิทธิ์จัดการคลังไฟล์" |
| อื่น ๆ | "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" |

## 6. โครงไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/types/file-library.ts` | `LibraryFile`, `LibraryListItem`, `LibraryPage` |
| `src/lib/file-library.ts` | pure (client-safe): `FILES_PREFIX`, `PAGE_SIZE`, `titleFromFileName`, `parseListQuery`, `escapeRegex`, `rowNumber`, `pageWindow`, schema ของ title/name |
| `src/lib/file-library.test.ts` | เทสต์ของข้างบน |
| `src/lib/file-library-store.ts` | SERVER ONLY: `listFiles`, `insertFile`, `renameFile`, `removeFile` (Mongo + dev fallback) |
| `src/pages/api/admin/files/index.ts` | GET รายการ · POST อัปโหลด |
| `src/pages/api/admin/files/[id]/index.ts` | PATCH · DELETE |
| `src/pages/api/admin/files/[id]/view.ts` | GET redirect |
| `src/pages/admin/files.tsx` | หน้ารายการ + กล่องอัปโหลด |
| แก้ `user-access.ts`, `auth-server.ts`, `AdminLayout.tsx`, `api-guard-coverage.test.ts`, `user-access.test.ts` | ตามข้อ 3 และ 5 |

## 7. การทดสอบ

- `file-library.test.ts`:
  - `titleFromFileName`: `"รายงาน 2568.pdf"` → `"รายงาน 2568"` · ไม่มีนามสกุล · หลายจุด `a.b.pdf` → `a.b` · ขึ้นต้นด้วยจุด
  - `parseListQuery`: page ไม่ใช่ตัวเลข/ติดลบ/ทศนิยม → 1 · q ถูก trim และตัดที่ 100
  - `escapeRegex`: `"(2567)"` และ `".*"` ไม่กลายเป็น pattern
  - `rowNumber`, `pageWindow` (หน้าแรก หน้ากลาง หน้าสุดท้าย หน้าเดียว)
  - schema title: ว่าง/ช่องว่างล้วน/301 ตัว ไม่ผ่าน
- `user-access.test.ts`: `files` อยู่ท้าย `FEATURES` · ไม่อยู่ใน default · ผู้จัดการได้ครบ
- `api-guard-coverage.test.ts` ผ่าน: route ดูอยู่ใน allowlist · route เขียนเรียก guard
- `npm test`, `npm run lint`, `npm run build` ผ่าน
- ทดสอบมือด้วย `npm run dev`: อัปโหลด PDF/JPG/PNG · อัปไฟล์ .txt ที่เปลี่ยนชื่อเป็น .pdf ต้องถูกปฏิเสธ ·
  ค้นหาภาษาไทยและวงเล็บ · แบ่งหน้าเมื่อเกิน 20 · แก้ชื่อ · ลบ · เปิดไฟล์ในแท็บใหม่

## นอกขอบเขต

หมวดหมู่ · หลายไฟล์ต่อรายการ · อัปโหลดหลายไฟล์พร้อมกัน · Word/Excel · ไฟล์ใหญ่เกิน 10 MB ·
หน้าสาธารณะ · ชื่อผู้อัปโหลด · ประวัติการแก้ไข · สำรองไฟล์คลัง (ทำแยกภายหลังได้ด้วย prefix `files/`)
