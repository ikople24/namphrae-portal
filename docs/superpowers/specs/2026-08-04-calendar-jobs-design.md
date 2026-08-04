# ปฏิทินปฏิบัติงาน (Calendar Jobs)

**Date:** 2026-08-04
**Status:** Approved by user (approach A — own calendar, MongoDB as source of truth)
**Branch:** `feat/calendar-jobs`

## Goal

แทนหน้า `namphraesmartcity.ai/calendar/index.html` เดิม (HTML ธรรมดาที่ฝัง Google
Calendar 2 ปฏิทินผ่าน iframe) ด้วยระบบในพอร์ทัลที่ครบ workflow: เจ้าหน้าที่กรอกฟอร์มขอ
→ แจ้งเตือนเข้ากลุ่ม LINE ทันที → อนุมัติแล้วขึ้นปฏิทิน → ปิดงานเป็น "ดำเนินการแล้ว"

ของเดิมไม่มีฟอร์ม ไม่มีสถานะ ไม่มีการอนุมัติ — เจ้าหน้าที่พิมพ์ event ลง Google Calendar
เองและพิมพ์การ์ดแจ้งเตือน LINE เองทุกครั้ง

**ปฏิทินเดิมที่ถูกแทนที่** (เก็บไว้อ้างอิงตอนย้ายข้อมูล):

| Google Calendar ID | สี | ความหมาย |
|---|---|---|
| `b2534846b68e6283cf8d66115da2f27ad2bd45da6c82cb697cf5e445a4830b67@group.calendar.google.com` | `#d81b60` | งานป้องกัน (กู้ภัย) |
| `fce10da151b4d123bb36b1def1f4bdac93bfb5612ce9f472dba35f7444c3cead@group.calendar.google.com` | `#0b8043` | รับ-ส่งผู้ป่วย (กู้ชีพ) |

## Decisions (confirmed with user)

1. **สิทธิ์:** เจ้าหน้าที่ที่ล็อกอินมีสิทธิ์เท่ากันหมด — กรอกได้ อนุมัติได้ ปิดงานได้ ใช้
   `requireAdmin()` เดิม ไม่เพิ่ม role ใน `users` collection
2. **การมองเห็น:** ปฏิทินเปิดสาธารณะ แต่**ซ่อนข้อมูลส่วนบุคคล** — คนทั่วไปเห็นแค่ เวลา +
   ประเภทงาน + หมู่บ้าน
3. **ฟอร์ม:** ฟอร์มเดียว ฟิลด์ชุดเดียว ใช้ทั้งงานกู้ชีพและกู้ภัย (งานกู้ภัยเว้นฟิลด์ที่ไม่ใช้)
4. **LINE:** ผู้ใช้จะสร้าง LINE OA ใหม่แล้วเชิญเข้ากลุ่มเจ้าหน้าที่ ระบบ push เข้ากลุ่มนั้น
   ตอนมีงาน submit ใหม่เท่านั้น
5. **สถาปัตยกรรม:** ทำปฏิทินเองใน MongoDB เลิกใช้ Google Calendar (ไม่ sync กลับ)
6. **เทสต์:** เพิ่ม `vitest` เป็นชุดแรกของโปรเจ็ก ครอบเฉพาะ logic บริสุทธิ์

### เหตุผลที่ไม่เลือกทางอื่น

- **คง Google Calendar เป็นหลัก:** ชนกับข้อ 2 โดยตรง — iframe ฝังแสดงตามที่อยู่ใน event
  จะซ่อนเฉพาะคนนอกไม่ได้ และยังต้องมี DB เก็บสถานะอยู่ดี กลายเป็นสองแหล่งข้อมูล
- **ไฮบริด (DB + sync ขึ้น Google):** ได้ผลดีแต่งานเยอะสุด ต้องตั้ง service account และดูแล
  failure mode ของ sync — เพิ่มทีหลังได้ถ้าเจ้าหน้าที่คิดถึงการดูงานผ่านแอปมือถือจริง ๆ

## Design

### Data — collection ใหม่ `calendarJobs`

งานปฏิทิน **ไม่** เก็บใน `portalConfig` เพราะเอกสารนั้นเป็น config ก้อนเดียวที่ทุก mutation
เขียนทับทั้งก้อนแล้ว bump `version` ส่วนงานปฏิทินโตไม่จำกัดและแก้บ่อย จะชนเพดาน 16MB
ของ Mongo document และทำให้ `version` พุ่งโดยไม่จำเป็น

`src/types/portal.ts` เพิ่ม:

```ts
export type JobKind = 'ems' | 'rescue';   // กู้ชีพ (รับ-ส่งผู้ป่วย) | กู้ภัย (งานป้องกัน)
export type JobStatus = 'pending' | 'approved' | 'done' | 'cancelled';

export type CalendarJob = {
  id: string;              // crypto.randomUUID()
  kind: JobKind;
  status: JobStatus;
  date: string;            // 'YYYY-MM-DD' — วันที่ตามเวลาไทยตรง ๆ ไม่แปลง UTC
  time: string;            // 'HH:mm' 24 ชม.
  title: string;           // ชื่อผู้ป่วย / ชื่องาน                      ← PII
  village?: string;        // 'ม.3 ต.น้ำแพร่'
  origin?: string;         // ต้นทาง 'บ้านที่อาศัย'                     ← PII
  destination?: string;    // ปลายทาง 'รพ.สวนดอก'                      ← PII
  phone?: string;          //                                          ← PII
  note?: string;
  createdAt: string;  createdBy: string;   // ISO + clerk id/email
  decidedAt?: string; decidedBy?: string;  // ตอนอนุมัติ/ยกเลิก
  doneAt?: string;    doneBy?: string;     // ตอนปิดงาน
};

// สิ่งที่หลุดออกสู่สาธารณะได้เท่านั้น
export type PublicJob = Pick<CalendarJob, 'id' | 'kind' | 'date' | 'time' | 'status'> & {
  village?: string;
};
```

**เก็บ `date`/`time` เป็นสตริง ไม่ใช่ `Date`** — งานเป็นเวลาท้องถิ่นล้วน ("06:00 น. วันที่ 5")
ไม่มีความหมายข้ามโซนเวลา การเก็บเป็นสตริงตัดปัญหาวันเพี้ยนจากการแปลง UTC ทิ้งทั้งหมด และ
เรียงลำดับแบบ lexicographic ได้ตรงกับเรียงตามเวลาพอดี

Index: `{ date: 1 }` และ `{ status: 1, date: 1 }`

### Store — `src/lib/jobs-store.ts`

ลอกโครงจาก [`config-store.ts`](../../../src/lib/config-store.ts) ให้มีสอง backend:

- **Mongo** collection `calendarJobs` เมื่อ `MONGODB_URI` ถูกตั้ง
- **ไฟล์** `data/calendar-jobs.json` เมื่อไม่ตั้ง (zero-config dev เหมือนเดิม — ต้องเพิ่ม
  บรรทัดนี้ใน `.gitignore` คู่กับ `/data/portal-config.json` ที่มีอยู่)

ต่างจาก config-store ตรงที่ทำงานราย record ไม่ใช่ทั้งก้อน:

```ts
listJobs(filter: { month?: string; status?: JobStatus }): Promise<CalendarJob[]>
getJob(id: string): Promise<CalendarJob | null>
createJob(input: JobInput, createdBy: string): Promise<CalendarJob>
updateJob(id: string, patch: JobInput, actor: string): Promise<CalendarJob | null>
setJobStatus(id: string, next: JobStatus, actor: string): Promise<CalendarJob | null>
deleteJob(id: string): Promise<boolean>
```

`month` เป็น `'YYYY-MM'` แปลงเป็นช่วง `{ date: { $gte: 'YYYY-MM-01', $lte: 'YYYY-MM-31' } }`
— ใช้ `-31` เป็นขอบบนได้เสมอเพราะเทียบสตริง ไม่ต้องรู้ว่าเดือนนั้นมีกี่วัน

ไม่มี seed file — ระบบเริ่มจากศูนย์ (คนละเรื่องกับ `portal-config.seed.json`)

### สถานะและการเปลี่ยนสถานะ — `src/lib/job-status.ts`

```
[กรอกฟอร์ม] → pending ──อนุมัติ──→ approved ──ปิดงาน──→ done
                  │                    │                  │
                  └────ยกเลิก─────────┴──ยกเลิก───→ cancelled
```

ตารางที่อนุญาต (ฟังก์ชันบริสุทธิ์ `canTransition(from, to): boolean`):

| จาก | ไปได้ | เหตุผลที่ให้ย้อน |
|---|---|---|
| `pending` | `approved`, `cancelled` | — |
| `approved` | `done`, `cancelled`, `pending` | ถอนอนุมัติเมื่อกดพลาด |
| `done` | `approved` | เผลอกดปิดงาน |
| `cancelled` | `pending` | กู้งานที่ยกเลิกผิด |

การเปลี่ยนสถานะนอกตาราง → API ตอบ 409 `{ error: 'invalid_transition' }`

`cancelled` **ไม่ลบทิ้ง** เก็บเป็นประวัติแต่ไม่ขึ้นปฏิทินทั้งฝั่งสาธารณะและตารางปฏิทินหลังบ้าน
(ยังเห็นในตารางรายการเมื่อกรองสถานะ)

### การซ่อน PII — `toPublicJob()` ใน `src/lib/job-public.ts`

กรองที่ server เท่านั้น ไม่ใช่ซ่อนด้วย CSS:

| | สาธารณะ `/api/calendar` | เจ้าหน้าที่ `/api/admin/calendar` |
|---|---|---|
| สถานะที่เห็น | `approved`, `done` | ทุกสถานะ |
| ฟิลด์ | `id, kind, date, time, status, village` | ครบ |
| แสดงผล | `06:00 · รับ-ส่งผู้ป่วย · ม.3` | `06:00 สมชาย ใจดี → รพ.สวนดอก ☎ 081…` |

`toPublicJob()` **สร้าง object ใหม่โดยระบุฟิลด์ทีละตัว** ไม่ใช่ `delete` หรือ rest-spread
ออกจากของเดิม — ฟิลด์ใหม่ที่เพิ่มทีหลังจะไม่รั่วออกไปเองโดยอัตโนมัติ

อยู่ในโมดูลของตัวเอง (`job-public.ts`) ที่ไม่ import อะไรนอกจาก type — เทสต์จึงเรียกได้ตรง ๆ
โดยไม่ลาก `mongodb` เข้ามาด้วย ซึ่งจะเกิดขึ้นถ้าฟังก์ชันนี้อยู่ใน `jobs-store.ts`

### API routes

| Route | สิทธิ์ | หน้าที่ |
|---|---|---|
| `GET /api/calendar?month=YYYY-MM` | เปิด | `listJobs` → กรองเหลือ `approved`+`done` → `toPublicJob` · rate-limit 60/นาที/IP |
| `GET /api/admin/calendar?month=&status=` | staff | ข้อมูลเต็ม ทุกสถานะ |
| `POST /api/admin/calendar` | staff | สร้างงาน (`status: 'pending'`) → push LINE |
| `PATCH /api/admin/calendar/[id]` | staff | แก้ฟิลด์ และ/หรือ เปลี่ยนสถานะ |
| `DELETE /api/admin/calendar/[id]` | staff | ลบถาวร |
| `POST /api/line/webhook` | LINE | ตรวจลายเซ็น → เก็บ/ล้าง `groupId` |

- ทุก route หลังบ้านขึ้นต้นด้วย `const admin = await requireAdmin(req, res); if (!admin) return;`
  ตามแบบเดิมทุกประการ
- `month` ต้องตรง `/^\d{4}-\d{2}$/` ไม่ตรงตอบ 400 · ไม่ส่ง `month` มา = เดือนปัจจุบัน
- **body ของ `PATCH`** เป็น `{ patch?: JobInput; status?: JobStatus }` — ส่งมาอย่างใดอย่างหนึ่ง
  หรือทั้งคู่ก็ได้ ถ้ามี `status` จะตรวจ `canTransition()` ก่อนเสมอ และไม่ผ่านก็ไม่บันทึก `patch` ด้วย
- Validation ด้วย Zod ใน `src/lib/schema.ts` (`jobInputSchema`) ใช้ร่วมทั้ง API และฟอร์ม
  เหมือนที่ `linkInputSchema` ทำ
- **ไม่ต้อง revalidate** — หน้า `/calendar` ดึงข้อมูลฝั่ง client ไม่ใช่ ISR

### หน้า `/calendar` (สาธารณะ)

Static shell + ดึงข้อมูลรายเดือนด้วย SWR จาก `/api/calendar?month=`

ข้อมูลถูก mask แล้วจึงไม่มีค่าทาง SEO — ไม่ต้องทำ ISR/`getStaticProps` ให้ซับซ้อน และ
ได้ผลพลอยได้คือกดเปลี่ยนเดือนได้ทันทีโดยไม่ต้อง pre-render ทุกเดือน

### หน้าหลังบ้าน

- **`/admin/calendar`** — `<MonthGrid>` ด้านบน + ตารางรายการด้านล่าง กรองตามสถานะ
  ปุ่ม อนุมัติ / ปิดงาน / ยกเลิก ยิง `PATCH` ตรงจากแถว
- **`/admin/calendar/new`** และ **`/admin/calendar/[id]`** — ฟอร์ม ลอกโครงจาก
  [`links/new.tsx`](../../../src/pages/admin/links/new.tsx) + `<JobForm>` แบบเดียวกับ `<LinkForm>`
- ทุกหน้าใช้ `getMemberSsrProps` + `withMemberGuard` เหมือนหน้าหลังบ้านอื่น
- เพิ่มเมนู `{ href: '/admin/calendar', label: 'ปฏิทินปฏิบัติงาน', icon: 'calendar_month' }`
  ใน `NAV` ของ [`AdminLayout`](../../../src/components/admin/AdminLayout.tsx) และเพิ่ม
  `calendar_month` เข้า `ICON_NAMES` ใน `src/lib/icons.ts` (ฟอนต์เป็น subset — ไม่เพิ่มไอคอนจะไม่ขึ้น)

### ปฏิทิน — `src/lib/calendar-grid.ts` + `src/components/MonthGrid.tsx`

ฟังก์ชันบริสุทธิ์ ไม่มี dependency ใหม่:

```ts
buildMonthGrid(year: number, month: number): Array<Array<{ date: string; inMonth: boolean }>>
todayInBangkok(): string   // Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' })
thaiMonthLabel(year, month): string   // 'สิงหาคม 2569' — พ.ศ. = ค.ศ. + 543
```

- **สัปดาห์เริ่มวันจันทร์** ตาม `wkst=1` ของ embed เดิม
- ช่องวันแสดงงานเรียงตามเวลา แต่ละงานเป็นจุดสี + เวลา + ข้อความ
- **คงสีเดิมจาก legend:** 🔴 กู้ภัย/งานป้องกัน · 🟢 กู้ชีพ/รับ-ส่งผู้ป่วย
- `<MonthGrid>` ตัวเดียวใช้ร่วมทั้งสองหน้า รับ `jobs: PublicJob[] | CalendarJob[]` ผ่าน
  prop `renderLabel` ที่แต่ละหน้าส่งเข้ามา — component ไม่รู้จัก PII เลย จึงเผลอแสดงไม่ได้
- `done` แสดงจาง + ติ๊กถูก เพื่อแยกจาก `approved` ด้วยสายตา

### LINE — `line.ts` + `line-message.ts` + `line-signature.ts`

แยกเป็น 3 โมดูลเพราะ `line.ts` ต้อง import config-store (อ่าน `lineGroupId`) ซึ่งลาก
`mongodb` ตามมา ส่วนที่เป็น logic บริสุทธิ์จึงแยกออกให้เทสต์เรียกได้ตรง ๆ:

| ไฟล์ | หน้าที่ | import |
|---|---|---|
| `line-message.ts` | `formatNewJobMessage(job, adminUrl?): string` | `types/portal`, `calendar-grid` — ไม่มีตัวไหนทำ I/O |
| `line-signature.ts` | `verifyLineSignature(rawBody, header, secret): boolean` | `node:crypto` |
| `line.ts` | `pushNewJobNotice(job)` — อ่าน env + groupId แล้วยิง API | config-store, สองไฟล์บน |

`verifyLineSignature` รับ `secret` เป็นพารามิเตอร์ ไม่อ่าน `process.env` เอง — เทสต์จึงตั้ง
ค่าลายเซ็นเองได้โดยไม่ต้องยุ่งกับ env

env ใหม่ (เพิ่มใน `.env.example` พร้อมคำอธิบาย):

```bash
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
```

**ที่เก็บ `groupId`:** `portalConfig.lineGroupId` — วางที่ **ระดับบนสุด** ของ `PortalConfig`
ไม่ใช่ใน `site` เพราะ [`toPublicConfig()`](../../../src/lib/config-store.ts) คืน `site` ทั้งก้อน
สู่สาธารณะ ถ้าใส่ใน `site` จะรั่วทันที เพิ่มใน `portalConfigSchema` เป็น optional และเพิ่ม
ช่องแสดง/แก้ใน `/admin/settings` เผื่อกรอกเอง

**Webhook** `POST /api/line/webhook`:

- ต้อง `export const config = { api: { bodyParser: false } }` แล้วอ่าน raw body เอง เพราะ
  ลายเซ็นคำนวณจาก byte ดิบ — ถ้าให้ Next parse ก่อนจะตรวจไม่ผ่าน
- ตรวจ `x-line-signature` = base64(HMAC-SHA256(rawBody, channelSecret)) เทียบด้วย
  `crypto.timingSafeEqual` · ไม่ผ่าน → 401
- event `join` ที่ `source.type === 'group'` → บันทึก `source.groupId`
- event `leave` ที่ groupId ตรงกับที่เก็บไว้ → ล้างค่า
- ตอบ 200 เสมอหลังตรวจลายเซ็นผ่าน (LINE retry ถ้าไม่ใช่ 2xx)

**Push:** `POST https://api.line.me/v2/bot/message/push` body
`{ to: lineGroupId, messages: [{ type: 'text', text }] }` header `Authorization: Bearer <token>`

ใช้ **text ธรรมดา ไม่ใช่ Flex** — อ่านง่ายพอกันแต่ไม่ต้องดูแล JSON โครงใหญ่:

```
🔔 มีงานใหม่รออนุมัติ
🚑 รับ-ส่งผู้ป่วย · 5 ส.ค. 69 เวลา 06:00
👤 สมชาย ใจดี (ม.3 ต.น้ำแพร่)
➤ บ้านที่อาศัย → รพ.สวนดอก
☎ 081-716-9397
```

(งานกู้ภัยใช้ 🚨 และเว้นบรรทัดที่ไม่มีข้อมูล)

**Graceful degradation** ตามแบบที่ Cloudinary ทำอยู่: ถ้าไม่ตั้ง env หรือยังไม่มี `lineGroupId`
→ `pushNewJobNotice()` เป็น no-op + `console.warn` **การสร้างงานยังสำเร็จปกติ** dev จึงรันได้
โดยไม่ต้องมี LINE เลย

**LINE ล้มไม่ทำให้งานหาย:** push อยู่หลังการบันทึกและถูก `try/catch` ครอบ ผลลัพธ์ส่งกลับเป็น
`{ job, lineNotified: boolean }` ให้หน้าฟอร์มขึ้นเตือน "บันทึกแล้ว แต่ส่ง LINE ไม่สำเร็จ" ได้

ส่ง LINE **เฉพาะตอนสร้างงานใหม่** — แก้ไขหรือเปลี่ยนสถานะไม่ส่งซ้ำ

### เทสต์ — vitest

โปรเจ็กยังไม่มี test infra เลย ชุดนี้เป็นชุดแรก: เพิ่ม devDependency `vitest`,
script `"test": "vitest run"`, และ `vitest.config.ts` ที่ตั้ง alias `@` → `src` ให้ตรงกับ
`tsconfig.json`

ครอบเฉพาะ logic บริสุทธิ์ ไม่แตะ DB/network — ไฟล์วางคู่ซอร์ส (`src/lib/*.test.ts`):

1. **`job-public.test.ts`** — ยืนยันว่า payload สาธารณะ**ไม่มี**
   `title`/`phone`/`origin`/`destination` เด็ดขาด และเช็คด้วย `Object.keys()` ว่ามีเฉพาะ
   คีย์ที่อนุญาต (ข้อนี้สำคัญที่สุด — พลาดแล้วข้อมูลผู้ป่วยรั่วสู่อินเทอร์เน็ต)
2. **`job-status.test.ts`** — `canTransition` ครบทั้ง 16 คู่ ทั้งที่อนุญาตและที่ต้องปฏิเสธ
3. **`calendar-grid.test.ts`** — `buildMonthGrid`: เดือนที่ขึ้นต้นวันอาทิตย์, ก.พ. ปีอธิกสุรทิน,
   สัปดาห์คาบเกี่ยวข้ามปี, ทุกแถวมี 7 ช่องเสมอ · `thaiMonthLabel`: แปลง พ.ศ. ถูกต้อง ·
   `todayInBangkok`: ตรวจแค่รูปแบบ `YYYY-MM-DD` (ค่าขึ้นกับเวลาจริง จึง assert ค่าตรง ๆ ไม่ได้)
4. **`line-message.test.ts`** — งานกู้ชีพครบฟิลด์, งานกู้ภัยที่เว้นฟิลด์ว่าง (ต้องไม่มีบรรทัดเปล่า)
5. **`line-signature.test.ts`** — ลายเซ็นถูก / ผิด / หายไป / ความยาวไม่เท่ากัน

## Out of scope

ทำทีหลังได้ ไม่อยู่ในรอบนี้:

- การ์ดสรุป "รับส่งผู้ป่วยวันพรุ่งนี้" ส่งอัตโนมัติทุกเย็น (ต้องมี cron + Flex message)
- Sync ขึ้น Google Calendar เพื่อให้เจ้าหน้าที่ดูผ่านแอปมือถือ
- ย้ายงานเก่าจาก Google Calendar ทั้งสองปฏิทินเข้าระบบ
- ฟอร์มสาธารณะให้ชาวบ้านขอรถเอง
- เพิ่มการ์ดลิงก์ "ปฏิทินปฏิบัติงาน" บนหน้าแรก — ทำผ่านหลังบ้านได้เลย ไม่ต้องแก้โค้ด

## Files

**ใหม่**

```
src/lib/jobs-store.ts              store (Mongo | file) — I/O
src/lib/job-public.ts              toPublicJob                       [pure]
src/lib/job-status.ts              canTransition                     [pure]
src/lib/calendar-grid.ts           buildMonthGrid, todayInBangkok, thaiMonthLabel  [pure]
src/lib/line-message.ts            formatNewJobMessage               [pure]
src/lib/line-signature.ts          verifyLineSignature               [pure]
src/lib/line.ts                    pushNewJobNotice — I/O
src/components/MonthGrid.tsx       ปฏิทินเดือน ใช้ร่วม 2 หน้า
src/components/admin/JobForm.tsx   ฟอร์มงาน
src/pages/calendar.tsx             หน้าสาธารณะ
src/pages/admin/calendar/index.tsx ตาราง + ปฏิทินหลังบ้าน
src/pages/admin/calendar/new.tsx
src/pages/admin/calendar/[id].tsx
src/pages/api/calendar.ts
src/pages/api/admin/calendar/index.ts
src/pages/api/admin/calendar/[id].ts
src/pages/api/line/webhook.ts
vitest.config.ts
src/lib/{job-public,job-status,calendar-grid,line-message,line-signature}.test.ts
```

หน้าหลังบ้านใช้ `calendar/index.tsx` ไม่ใช่ `calendar.tsx` เพื่อเลี่ยงการมีทั้งไฟล์และโฟลเดอร์
ชื่อเดียวกัน — ตรงกับที่ `admin/links/` ทำอยู่

**แก้**

```
src/types/portal.ts       + JobKind, JobStatus, CalendarJob, PublicJob, lineGroupId
src/lib/schema.ts         + jobInputSchema, lineGroupId ใน portalConfigSchema
src/lib/admin-api.ts      + client wrappers ของ calendar API
src/lib/icons.ts          + 'calendar_month'
src/components/admin/AdminLayout.tsx   + NAV item
src/pages/admin/settings.tsx           + ช่อง LINE group id
package.json              + vitest, script "test"
.gitignore                + /data/calendar-jobs.json
.env.example              + LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET
README.md                 + หัวข้อปฏิทินปฏิบัติงาน + การตั้งค่า LINE
```
