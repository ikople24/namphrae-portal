# ย้าย namphrae-map เข้ามาเป็นงานย่อยของ Portal

**วันที่:** 2026-08-17
**เกี่ยวข้อง:** [2026-08-11-portal-feature-permissions-design.md](2026-08-11-portal-feature-permissions-design.md) ·
[2026-08-06-admin-user-management-design.md](2026-08-06-admin-user-management-design.md)

---

## คำถามตั้งต้น

> "ต้องการย้ายงานของ namphrae-map มาเป็นงานย่อยของ portal"

ย้าย **ทั้งหมด** แล้วเจ้าของระบบจะปิด namphrae-map เอง เมื่อพิสูจน์ได้ว่าทำงานได้ตรงและ
เหมือนกันทุกจุด — **เกณฑ์รับงานคือ parity ไม่ใช่ feature ใหม่**

---

## สิ่งที่ต้องย้าย (สำรวจแล้ว ไม่ใช่คาดเดา)

namphrae-map เป็น Next.js Pages Router แยกโปรเจกต์ ประกอบด้วยสองโดเมนที่ไม่เกี่ยวกันเลย:

| โดเมน | หน้า | API | models |
|---|---|---|---|
| **ภัยพิบัติ** | `/` แผนที่, `/insights` สถิติ, `/admin` ตาราง+ฟอร์ม | `incidents/*` (3) | `Incident` |
| **สาธารณสุข** | `/dengue` แผนที่, `/dengue-insights` สถิติ, `/admin/dengue` ทะเบียน | `dengue*`, `dengue-registry/*` (6) | `DengueRegistryCase`, `DengueYearStat`, `ChikunMooYear`, `SubmittedReport` |

รวม 23 ไฟล์ใน `lib/`, 27 component, 30 ไฟล์เทสต์, 3 สคริปต์นำเข้า

### ช่องว่างทางเทคโนโลยี

| | namphrae-map | namphrae-portal |
|---|---|---|
| Next | 15.1.6 | **16.2.11** |
| Clerk | 6 | **7** |
| MongoDB | mongoose 8 (models) | **driver 7 ดิบ** |
| zod | 3 | **4** (ตรวจแล้ว API ที่ใช้จริงเข้ากันได้หมด) |
| Tailwind | 3 (`tailwind.config.ts`) | **4** (CSS-first, `@theme`) |
| Leaflet | react-leaflet 5 + heat + markercluster | **leaflet ดิบ** (`MapViewer.tsx`) |
| กราฟ | recharts | **ไม่มีเลย** |

---

## ข้อตกลงที่ปิดแล้ว

1. **ย้ายครบทุกอย่าง** เจ้าของระบบปิด namphrae-map เองเมื่อพอใจ
2. **ระบบสิทธิ์ใช้ของ portal** — `user-access.ts` + `auth-server.ts` ทิ้ง `requireDbUser.ts` ของ map
3. **ข้อมูลคัดลอกเข้า `namphrae_portal`** สคริปต์รันซ้ำได้ เทียบให้พอใจก่อน แล้วค่อยลบของเดิมทีหลัง
4. **สิทธิ์การเข้าถึงคงเดิมทุกประการ** — หน้าดูข้อมูลยังเปิดสาธารณะ งานกรอก/แก้ไขอยู่หลังบ้าน
5. **แนวทางเทคโนโลยีแบบลูกผสม** — ชั้นข้อมูลเขียนใหม่ ชั้นแผนที่/กราฟยกมาทั้งดุ้น เปลือกใช้ของ portal

---

## 1. เส้นทางและสิทธิ์

เพิ่ม feature key ใหม่สองตัวใน `src/lib/user-access.ts` — `disaster` และ `health` แยกจากกัน
เพื่อให้ผู้จัดการติ๊กให้เจ้าหน้าที่สาธารณสุขเห็นแค่ทะเบียนโรค และงานป้องกันฯ เห็นแค่ภัยพิบัติ

```
FEATURES = ['links', 'categories', 'calendar', 'map', 'disaster', 'health', 'data', 'settings']
```

`DEFAULT_FEATURES` **ไม่เปลี่ยน** (`['calendar', 'data']`) — สมาชิกเดิมทุกคนจะยังไม่เห็นเมนูใหม่
จนกว่าผู้จัดการจะเปิดให้ ซึ่งถูกต้องตามหลัก fail-closed ที่ระบบสิทธิ์วางไว้

| หน้าใหม่ | เข้าถึง | มาจาก |
|---|---|---|
| `/disaster` แผนที่ภัยพิบัติ (หมุด/กระจุก/ความหนาแน่น + ไทม์ไลน์ปี) | สาธารณะ | `/` |
| `/disaster/insights` สถิติภัยพิบัติ | สาธารณะ | `/insights` |
| `/health` แผนที่ไข้เลือดออก/ชิคุนกุนยา | สาธารณะ | `/dengue` |
| `/health/insights` สถิติสาธารณสุข | สาธารณะ | `/dengue-insights` |
| `/admin/disaster` เพิ่ม/แก้/ลบเหตุการณ์ + อัปรูป | `disaster` | `/admin` |
| `/admin/health` ทะเบียนเคส CRUD + export + นำเข้า Excel | `health` | `/admin/dengue` |

ไม่ชนกับของเดิม: `/map` (แผนที่เลเยอร์สาธารณะ) และ `/admin/map` (คลังไฟล์แผนที่) ยังอยู่ที่เดิม

### API

| ใหม่ | เมธอด | สิทธิ์ | เดิม |
|---|---|---|---|
| `/api/disaster/incidents` | GET | สาธารณะ | `GET /api/incidents` |
| `/api/disaster/stats` | GET | สาธารณะ | `GET /api/incidents/stats` |
| `/api/health/cases` | GET | สาธารณะ (กรองฟิลด์) | `GET /api/dengue-registry` |
| `/api/health/reports` | GET | สาธารณะ | `GET /api/dengue` |
| `/api/admin/disaster/incidents` | GET, POST | `disaster` | `GET/POST /api/incidents` |
| `/api/admin/disaster/incidents/[id]` | GET, PUT, DELETE | `disaster` | `/api/incidents/[id]` |
| `/api/admin/health/cases` | GET, POST | `health` | `/api/dengue-registry/admin` |
| `/api/admin/health/cases/[id]` | PUT, DELETE | `health` | `/api/dengue-registry/case/[id]` |
| `/api/admin/health/export` | GET | `health` | `/api/dengue-registry/admin-export` (มี PII) |
| `/api/admin/health/stats-export` | GET | `health` | `/api/dengue-registry/export` (aggregate) |
| `/api/admin/health/report-images` | GET | `health` | `/api/dengue/staff-images` |
| — | — | — | `/api/upload` → ใช้ `/api/admin/upload` ของ portal |
| — | — | — | `/api/me` → ใช้ `/api/admin/me` ของ portal |

`api-guard-coverage.test.ts` บังคับอยู่แล้วว่าทุกไฟล์ใต้ `src/pages/api/admin/` ต้องเรียก
`requireFeature()` หรือ `requireManager()` route ใหม่ที่ลืมใส่ guard จะตกเทสต์ทันที ไม่ต้องเพิ่ม
allowlist ให้ไฟล์ใดในงานนี้

### จุดเดียวที่สิทธิ์ "ไม่เหมือนเดิม" — และเป็นความตั้งใจ

`/api/dengue/staff-images` เดิมขอแค่ **เป็นสมาชิกในทะเบียน** (`requireDbUser`) ใครล็อกอินแล้วอยู่ใน
ทะเบียนก็เห็นรูปจากรายงานของชาวบ้านบนหน้า `/dengue` ได้ พอย้ายมาเป็น `/api/admin/health/report-images`
ที่ยาม `requireFeature('health')` สมาชิกที่ผู้จัดการยังไม่เปิดสิทธิ์ `health` ให้ จะไม่เห็นรูปอีกต่อไป

**ยอมรับการเปลี่ยนนี้** เพราะข้อตกลงข้อ 2 ระบุให้ใช้ระบบสิทธิ์ของ portal และการหดสิทธิ์ให้แคบลง
เป็นทิศทางที่ถูก — รูปจากรายงานผู้ป่วยไม่ควรเปิดให้เจ้าหน้าที่ทุกแผนกดู นี่คือ **จุดเดียว** ในงานทั้งหมด
ที่พฤติกรรมต่างจากเดิมโดยเจตนา ทุกจุดที่เหลือต้องเหมือนเดิมเป๊ะ

---

## 2. ชั้นข้อมูล

### collection ใน `namphrae_portal`

| เดิม (`db_namphrae`) | ใหม่ | หมายเหตุ |
|---|---|---|
| `incidents` | `incidents` | ชื่อเดิมชัดอยู่แล้ว |
| `dengueregistrycases` | `diseaseCases` | เก็บทั้งไข้เลือดออกและชิคุนกุนยา (ฟิลด์ `disease`) ชื่อเดิมชวนเข้าใจผิด |
| `dengueyearstats` | `diseaseYearStats` | ประชากร/เคสไทยรายปี |
| `chikunmooyears` | `chikunMooYears` | |
| `submittedreports` | **ไม่ย้าย** | ดูหัวข้อถัดไป |

### `submittedreports` ต้องอ่านที่เดิมตลอดไป

collection นี้เขียนโดย **ระบบแจ้งเรื่องอีกตัว** ไม่ใช่ของ namphrae-map — โค้ดเดิมทั้งสองจุด
(`api/dengue.ts`, `api/dengue/staff-images.ts`) แค่อ่านผ่าน schema แบบ `strict: false`

ถ้าคัดลอกมา ข้อมูลจะแช่แข็งทันที รายงานใหม่จากชาวบ้านจะไม่ขึ้นบนแผนที่อีกเลย และจะไม่มี
อะไรพังให้เห็น — เป็นความเสียหายชนิดที่รู้ตัวช้าที่สุด จึงต้องอ่านข้าม db เสมอ

เพิ่มใน `src/lib/mongodb.ts` คู่กับ `getUsersDb()` ที่มีอยู่:

```ts
// submittedreports อยู่ db เดียวกับทะเบียนผู้ใช้ — ของระบบแจ้งเรื่อง LINE ไม่ใช่ของ portal
// แยกฟังก์ชันไว้เพื่อให้จุดเรียกบอกเจตนาชัด และถ้าวันหนึ่งย้าย db ก็แก้ที่เดียว
export async function getReportsDb(): Promise<Db> {
  return getUsersDb();
}
```

**ไม่เพิ่ม env var ใหม่** — `db_namphrae` ที่ `MONGODB_USERS_DB` ชี้อยู่แล้วคือ db เดียวกัน
การเพิ่มปุ่มที่ไม่มีใครหมุนมีแต่ต้นทุนคำอธิบายใน `.env.example` ที่ยาวอยู่แล้ว ใช้ `MongoClient`
ตัวเดียวกับ `getDb()`/`getUsersDb()` ไม่เปิดการเชื่อมต่อเพิ่ม

### ดัชนีต้องสร้างเอง

mongoose สร้างดัชนีให้อัตโนมัติ driver ดิบไม่สร้าง ถ้าลืมจะไม่มีอะไรพังทันที แต่ทะเบียนจะ
รับเคสเลขลำดับซ้ำได้เงียบ ๆ — `ensureIndexes()` ใน store แต่ละตัว เรียกตอนเข้าถึงครั้งแรก
พร้อมเทสต์ยืนยันว่าประกาศครบ:

```
incidents         { location: '2dsphere' } · { disasterType: 1, year: 1 }
diseaseCases      { disease: 1, yearBE: 1, seq: 1 } UNIQUE
diseaseYearStats  { yearBE: 1 } UNIQUE
chikunMooYears    { yearBE: 1, moo: 1 } UNIQUE
```

### สามพฤติกรรมที่ mongoose เคยทำให้ และ store ต้องรับช่วง

1. **`timestamps: true`** — `Incident`, `DengueRegistryCase`, `DengueYearStat` ตั้ง
   `createdAt`/`updatedAt` ให้เอง store ต้องเซ็ตเองทุกครั้งที่เขียน
   (`chikunMooYears` ไม่มี timestamps — คงไว้ตามเดิม อย่าเพิ่มให้)
2. **เลขลำดับเคส `seq`** — ตรรกะเดิม: หา `seq` สูงสุดของคู่ (โรค, ปี) แล้ว +1 จากนั้นพึ่ง
   unique index ดักการชนกัน จับ error code `11000` ตอบ 409 `'ลำดับซ้ำ'` — ยกมาทั้งกลไก
   รวมทั้งการดักโค้ด 11000
3. **`__v`** — ขยะจาก mongoose ไม่ต้องคัดลอกและไม่ต้องเขียนใหม่

### สคริปต์คัดลอก

`scripts/copy-map-data.mts` — upsert ตาม `_id` เดิม (`replaceOne({_id}, doc, {upsert:true})`)
จึงรันซ้ำได้ไม่จำกัดและได้ผลเท่าเดิมเสมอ

- `--dry-run` รายงานว่าจะเพิ่ม/อัปเดตกี่รายการต่อ collection ก่อนลงมือจริง
- ตัด `__v` ออกระหว่างทาง
- จบด้วย `closeDb()` ไม่งั้นโปรเซสค้าง (บทเรียนจาก commit `e694711`)

**วิธีใช้:** รันครั้งแรกเพื่อเริ่มเทียบ → รันซ้ำอีกครั้งก่อนปิด namphrae-map เพื่อเก็บข้อมูลที่
เข้ามาระหว่างช่วงรันคู่ ตอนคัดลอกจริงข้อมูลมีไม่ถึงพันรายการ ใช้เวลาไม่กี่วินาที

### รูปภาพ

ไม่ต้องทำอะไร — URL ชี้ Cloudinary บัญชีเดียวกัน และ portal ตั้ง `CLOUDINARY_*` ไว้แล้ว

---

## 3. การวางไฟล์

สองโดเมนแยกขาดจากกัน แต่ละโดเมนแยกสามชั้นตามแพทเทิร์นที่ portal ใช้อยู่ — logic บริสุทธิ์
(client-safe ห้าม import mongo/clerk) / store (แตะ mongo) / หน้าเว็บ แบบเดียวกับคู่
`user-access.ts` ↔ `user-access-store.ts`

```
src/types/disaster.ts              src/types/health.ts
src/lib/disaster-*.ts              src/lib/health-*.ts        ← logic บริสุทธิ์ + เทสต์
src/lib/disaster-store.ts          src/lib/health-store.ts    ← driver ดิบ
                                   src/lib/health-reports.ts  ← อ่าน submittedreports ข้าม db
src/components/disaster/*          src/components/health/*
src/pages/disaster/                src/pages/health/          ← สาธารณะ
src/pages/admin/disaster/          src/pages/admin/health/    ← หลังบ้าน
src/pages/api/disaster/            src/pages/api/health/      ← สาธารณะ อ่านอย่างเดียว
src/pages/api/admin/disaster/      src/pages/api/admin/health/
public/cmu_namphare.geojson                                   ← ขอบเขตหมู่บ้าน 72 KB
```

### `lib/` ของ map — 16 จาก 23 ไฟล์ยกมาได้เกือบตรง ๆ

| กลุ่ม | ไฟล์ | ต้องทำอะไร |
|---|---|---|
| ยกมาพร้อมเทสต์ | `stats`, `dengueStats`, `dengueRegistryStats`, `dengueRegistryDates`, `dengueRegistryParse`, `dengueExport`, `geo`, `thaiDate`, `thaiCalendar`, `isoDate`, `urlState`, `disasterTypes`, `incidentOptions`, `mapScales`, `adminView`, `imageResize` | เปลี่ยน path import |
| ยกมาพร้อมเทสต์ (zod) | `validation`, `dengueRegistryInput` | ทดสอบกับ zod 4.4.3 ที่ติดตั้งจริงแล้ว — `z.enum(const array)`, `.default()`, `.nullable().default(null)` และ `.flatten()` ยังทำงานเหมือนเดิม ไม่ต้องแก้ |
| ทิ้ง ใช้ของ portal | `mongodb`, `requireDbUser`, `cloudinaryServer`, `cloudinaryMigration` | portal มีของเทียบเท่าครบ |
| ย้ายที่ | `types.ts` | → `src/types/` |

**ตรรกะคำนวณสถิติทั้งหมด — ส่วนที่ผิดแล้วเห็นยากที่สุด — ย้ายไปพร้อมเทสต์เดิม ไม่ได้เขียนใหม่**

### ชั้น UI

| ทำอย่างไร | อะไรบ้าง |
|---|---|
| ยกมาทั้งดุ้น | `MapView`, `DengueMap`, `ChoroplethMap`, `MapLayers`, `mapBase` (react-leaflet) และกราฟ recharts 7 ตัว |
| ยกมาแล้ว remap สี | `GlassPanel`, `Segmented`, `CommandBar`, `SelectOrCustom`, `ThaiDatePicker`, `Badge`, `Icon` |
| **ทิ้ง** ใช้ของ portal | `TopNav`, `SubTabs`, `HealthSubTabs`, `AccessDenied`, `UserName` → `SiteHeader`, `AdminLayout`, `MemberGuard` |

สี: `brand #0e7c66` ของ map ↔ `green-deep #0f7a37` ของ portal — เขียวใกล้กันมาก แมปได้
ตรง ๆ ห้ามเพิ่ม token ชุดใหม่เป็น legacy alias เพราะ `globals.css` ระบุไว้เองว่ากำลังจะถอด
alias เดิมทิ้งอยู่แล้ว

### dependency ที่ต้องเพิ่ม

`react-leaflet` · `leaflet.heat` · `leaflet.markercluster` · `recharts` · `xlsx` · `csv-parse`
(+ `@types/leaflet.heat`, `@types/leaflet.markercluster`)

**ราคาที่ยอมจ่าย:** portal จะมีสอง stack แผนที่จริง — leaflet ดิบสำหรับคลังเลเยอร์ และ
react-leaflet สำหรับภัยพิบัติ/สาธารณสุข รับได้เพราะสองงานนี้ไม่แตะกัน และการเขียนแผนที่ที่
ทำงานถูกอยู่แล้วขึ้นใหม่มีแต่ความเสี่ยง ไม่ได้อะไรกลับมา

---

## 4. ความเป็นส่วนตัว

`GET /api/dengue-registry` เดิมเปิดสาธารณะแต่ whitelist ฟิลด์ไว้แน่นหนา เพราะใน DB มี PII —
`fullName`, `address`, `note`, `hospital` โค้ดเดิมมีคอมเมนต์กำกับว่า *"ห้าม spread document"*

ฝั่ง portal ยกกติกานี้มาให้แข็งกว่าเดิม ตามแพทเทิร์น `map-public.ts` ที่ portal ใช้อยู่แล้ว:
ดึงการกรองฟิลด์ออกเป็นฟังก์ชันบริสุทธิ์ `toPublicCase()` ใน `src/lib/health-public.ts` แล้ว
เขียนเทสต์ยิงด้วย document ที่มี PII ครบทุกฟิลด์ ยืนยันว่าผลลัพธ์มีเฉพาะ
`yearBE`, `moo`, `date`, `diagnosis`, `careType` — route สาธารณะเป็นเปลือกบาง ๆ ที่เรียก
ฟังก์ชันนี้เท่านั้น

`/api/admin/health/export` (ทะเบียนเต็มรวม PII) กับ `/api/admin/health/stats-export`
(aggregate) **ต้องล็อกอินทั้งคู่** เหมือนเดิม — ของเดิมก็ต้องล็อกอินทั้งคู่อยู่แล้ว

---

## 5. การซอยงาน

แต่ละรอบ merge ได้เอง ไม่ทำให้ portal ที่รันอยู่พัง

| รอบ | ได้อะไร | ใช้แทน map ได้แค่ไหน |
|---|---|---|
| **1 — ฐานร่วม** | เพิ่ม dep + smoke test, feature key `disaster`/`health`, เมนู sidebar, `getReportsDb()`, ยก lib บริสุทธิ์ 16 ไฟล์ + เทสต์, `public/cmu_namphare.geojson`, `ensureIndexes()`, `scripts/copy-map-data.mts` | ยัง |
| **2 — ภัยพิบัติ** | `disaster-store`, API สาธารณะ+หลังบ้าน, `/disaster`, `/disaster/insights`, `/admin/disaster` | ครึ่งหนึ่ง |
| **3 — สาธารณสุข (ดู)** | `health-store`, `health-reports`, API สาธารณะ, `/health` | เกือบครบ |
| **4 — ทะเบียนหลังบ้าน** | `/admin/health` CRUD + export ทั้งสองแบบ + `scripts/import-dengue-xlsx.mts` | ครบทุกฟังก์ชัน |
| **5 — เก็บงาน** | `scripts/import-csv.mts` + ไฟล์ตั้งต้น `data/npdrh-{flood,fire,drought,landslide}-data.csv`, README, คัดลอกข้อมูลรอบสุดท้าย, checklist parity | ปิด map ได้ |

**รอบ 1 ต้องเริ่มด้วยการติดตั้ง react-leaflet 5 + recharts แล้ว smoke test บน Next 16 ก่อนงานอื่น**
`AGENTS.md` เตือนไว้ว่า Next เวอร์ชันนี้ไม่เหมือนที่เคยรู้ ถ้าเข้ากันไม่ได้ต้องรู้ตั้งแต่วันแรก
ก่อนลงแรงที่เหลือ ไม่ใช่ไปเจอตอนรอบ 3

สคริปต์ที่ import ไลบรารีซึ่งมีแต่รูปแบบ ESM ต้องเป็น `.mts` ตามบทเรียนจาก commit `1488315`
(กรณีนั้นคือ `shpjs`) สคริปต์ที่ใช้แค่ `mongodb`/`xlsx` ใช้ `.ts` ตามธรรมเนียมเดิมของ
`scripts/import-map-layers.ts` ได้ — ตัดสินทีละสคริปต์ ไม่ใช่เหมารวม

---

## 6. วิธีพิสูจน์ parity

**ชั้นที่ 1 — ตรรกะ** เทสต์เดิมของ map ที่คุมสถิติ วันที่ไทย และการแปลง Excel ย้ายมาทั้งชุด
รันใน vitest ของ portal ตัวเลขเพี้ยนแม้แต่นิดเดียวเทสต์แดงทันที

**ชั้นที่ 2 — ความปลอดภัยและสิทธิ์**
- `health-public.test.ts` — PII ไม่หลุด API สาธารณะ
- `api-guard-coverage.test.ts` (มีอยู่แล้ว) — route หลังบ้านใหม่ทุกไฟล์ต้องมี guard
- `user-access.test.ts` (มีอยู่แล้ว) — เพิ่มเคสยืนยันว่า key ใหม่ไม่หลุดเข้า `DEFAULT_FEATURES`

**ชั้นที่ 3 — ตาเปล่า** checklist เทียบทีละหน้า เปิดสองเว็บคู่กัน ปีเดียวกัน ตัวกรองเดียวกัน:
จำนวนหมุด · ค่า KPI · รูปกราฟ · ลำดับแถวในตาราง · ไฟล์ Excel ที่ export ออกมา

---

## 7. ความเสี่ยงที่รับไว้อย่างรู้ตัว — `xlsx`

`xlsx@0.18.5` บน npm มีช่องโหว่ที่ **ไม่มีเวอร์ชันแก้บน registry** สองรายการ:
`GHSA-4r6h-8v6p-xvw6` (prototype pollution) และ `GHSA-5pgg-2g8v-p4x9` (ReDoS) — `npm audit`
รายงานว่า "No fix available" SheetJS ย้ายไปแจกผ่าน CDN ของตัวเองแล้ว npm จึงค้างอยู่ที่รุ่นเก่า

**ยังใช้ต่อ** เพราะ namphrae-map ใช้ตัวนี้อยู่แล้วและเกณฑ์รอบนี้คือ parity การเปลี่ยนไลบรารีแปลง
Excel ระหว่างย้ายจะทำให้พิสูจน์ไม่ได้ว่าผลลัพธ์เหมือนเดิม — เป็นการเปลี่ยนสองอย่างพร้อมกัน

**สิ่งที่ลดความเสี่ยงจริง:** ไฟล์ที่ป้อนเข้า `xlsx` มาจากเจ้าหน้าที่ที่ล็อกอินและมีสิทธิ์ `health`
เท่านั้น (`/admin/health` ในรอบ 4) ไม่ใช่ช่องทางสาธารณะ ผู้โจมตีต้องมีบัญชีในทะเบียนก่อน

**ข้อบังคับสำหรับรอบ 4:** ไฟล์ที่ import `xlsx` — `src/lib/health-registry-parse.ts` และ
`src/lib/health-export.ts` — ต้องมีคอมเมนต์หัวไฟล์อ้างถึงหัวข้อนี้ ไม่ให้คนถัดไปมาค้นพบใหม่แล้ว
เดาว่าลืม และถ้า SheetJS ปล่อยรุ่นแก้บน npm เมื่อไหร่ ให้อัปทันที

---

## 8. หนี้ที่บันทึกไว้ระหว่างย้าย

รายการที่รีวิวเจอระหว่างทาง แต่**จงใจไม่แก้ในรอบที่พบ** เพราะขัดกับกติกา "ยกมาโดยไม่แก้ตรรกะ"
ซึ่งเป็นสิ่งเดียวที่ทำให้พิสูจน์ parity ได้ บันทึกไว้ตรงนี้เพื่อให้รอบที่แตะไฟล์นั้นจริงเป็นคนสะสาง

| # | เรื่อง | เจอตอน | ควรสะสางเมื่อ |
|---|---|---|---|
| 1 | ชื่อเดือนไทยซ้ำสองที่ — `THAI_MONTH_NAMES` ใน `thai-calendar.ts` ตรงกันอักขระต่ออักขระกับ `THAI_MONTHS` ใน `calendar-grid.ts` และชื่อย่อใน `thai-date.ts` ก็ซ้ำกับ `THAI_MONTHS_SHORT` ไม่มีอะไรบังคับให้สองที่ตรงกัน | รอบ 1 Task 2 | รอบที่เอา `ThaiDatePicker` เข้ามาจริง (รอบ 4) — รวมเป็นแหล่งเดียว |
| 2 | `parseThaiDate` มีโค้ดกันวันเกินจริง (เช่น 31 กุมภาพันธ์) พร้อมคอมเมนต์กำกับ แต่ไม่มีเทสต์ยิงกิ่งนั้นเลย — ต้นทางก็ไม่มี | รอบ 1 Task 2 | รอบถัดไปที่แตะ `thai-date.ts` — เพิ่มเทสต์ ไม่ใช่แก้ตรรกะ |
| 3 | `iso-date.ts` มี 4 กิ่งแต่ไม่มีเทสต์ (ต้นทางก็ไม่มี) ตอนนี้ยังไม่มีใครเรียกใช้ | รอบ 1 Task 2 | รอบที่มีผู้เรียกใช้จริงตัวแรก (รอบ 3–4) |
| 4 | `THAI_WEEKDAY_HEADERS` เริ่มวันอาทิตย์ ส่วน `THAI_DOW` ใน `calendar-grid.ts` เริ่มวันจันทร์ ทั้งคู่ถูกต้องสำหรับผู้ใช้ของตัวเอง แต่ไม่มีคอมเมนต์ชี้ถึงกัน คนถัดไปอาจ "แก้" ให้ตรงกันแล้วพังฝั่งหนึ่ง | รอบ 1 Task 2 | พร้อมข้อ 1 |

---

## นอกขอบเขตรอบนี้

- **ลบ collection เดิมใน `db_namphrae`** — เจ้าของระบบทำเองหลังพอใจแล้ว
- **ปิด/ถอน deploy ของ namphrae-map** — เจ้าของระบบทำเอง
- **ปรับปรุงหน้าตาหรือเพิ่มความสามารถ** — งานนี้คือ parity ล้วน ของที่อยากได้เพิ่มเก็บเป็นงานถัดไป
- **รวม stack แผนที่สองตัวให้เหลือตัวเดียว** — ถ้าจะทำคือ refactor รอบใหม่หลังปิด map แล้ว
