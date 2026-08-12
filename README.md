# Namphrae Portal

Landing page รวมบริการ Smart City ของ **เทศบาลตำบลน้ำแพร่พัฒนา** (อ.หางดง จ.เชียงใหม่) พร้อมระบบหลังบ้านให้เจ้าหน้าที่เพิ่ม/แก้/ลบ/จัดลำดับลิงก์บริการได้เอง โดยไม่ต้องแก้โค้ดหรือทำรูปใหม่

แทนที่หน้า static เดิม (ปุ่มเป็นรูปภาพล้วน) ด้วย Next.js app ที่ข้อความบนการ์ดเป็น **text จริง** → ดีต่อ SEO, screen reader และแก้ชื่อได้ทันที เก็บ config ทั้งหมดเป็น **JSON ก้อนเดียว** (export/import/backup ง่าย) และเก็บสถิติการคลิกต่อบริการ

---

## Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Framework | Next.js 16 (Pages Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | MongoDB — เอกสารเดียว `portalConfig` + collection `calendarJobs` (โตไม่จำกัด) — มี **local JSON fallback** สำหรับ dev ทั้งคู่ |
| Auth | Clerk (optional — ถ้าไม่ตั้งค่าจะเป็นโหมด dev-open) |
| Media | Cloudinary (signed direct upload) |
| แจ้งเตือน | LINE Messaging API (optional — ไม่ตั้งก็ใช้งานได้ปกติ แค่ไม่ส่งแจ้งเตือน) |
| เทสต์ | vitest (เฉพาะ logic บริสุทธิ์ — ไม่มี DB/network) |
| Deploy | Vercel |

> โครงตั้งเป้าตามแผนที่ Next.js 15 — สร้างจริงด้วย Next 16 (เวอร์ชันล่าสุดของ `create-next-app`) ซึ่ง Pages Router / `getStaticProps` / ISR ยังใช้ได้เหมือนเดิม

---

## เริ่มใช้งาน (zero-config)

รันได้ทันทีโดย **ไม่ต้องตั้งค่าอะไรเลย** — จะใช้ไฟล์ JSON ในเครื่องเป็นฐานข้อมูล และเปิดหลังบ้านแบบไม่ต้องล็อกอิน (dev-open)

```bash
npm install
npm run dev
# เปิด http://localhost:3000        (หน้าเว็บ)
#     http://localhost:3000/admin   (หลังบ้าน)
```

ข้อมูลเริ่มต้นมาจาก [`data/portal-config.seed.json`](data/portal-config.seed.json) (บริการ 18 รายการ + ตัวนับผู้เข้าชมต่อจากของเดิม 51,051) ครั้งแรกที่รัน ระบบจะคัดลอกไปเป็น `data/portal-config.json` (ถูก gitignore ไว้) แล้วอ่าน/เขียนไฟล์นั้น

---

## ตั้งค่าสำหรับ production

คัดลอก `.env.example` เป็น `.env.local` แล้วกรอกค่า (ดูคำอธิบายแต่ละตัวในไฟล์)

### 1. MongoDB (จำเป็นบน Vercel)
filesystem บน Vercel เป็น read-only ตอน runtime — หลังบ้านเขียนทับไฟล์ไม่ได้ จึงต้องใช้ Mongo

```bash
MONGODB_URI=mongodb+srv://...
MONGODB_DB=namphrae_portal
```

Seed ข้อมูลเข้า Mongo (ครั้งเดียว):
```bash
npm run seed            # insert ถ้ายังไม่มี
npm run seed -- --force # เขียนทับของเดิม
```
> ถ้าไม่ seed ก็ได้ — แอปจะ auto-seed จาก `data/portal-config.seed.json` ครั้งแรกที่มีการอ่าน config

### 2. Clerk (ป้องกันหลังบ้าน)
ถ้าไม่ตั้งค่า `/admin` จะเปิดให้ทุกคนเข้า (มี banner เตือน) — **ห้ามขึ้น production โดยไม่ตั้งค่า**

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
```

> สิทธิ์เข้าหลังบ้าน: ล็อกอิน Clerk อย่างเดียวไม่พอ — ต้องมี record ใน MongoDB
> db `db_namphrae` collection `users` (จับคู่ด้วย `clerkId`) ซึ่งเป็นทะเบียนผู้ใช้
> ชุดเดียวกับ namphrae-map (เพิ่มผู้ใช้ที่เดียว ใช้ได้ทั้งสองแอป)
>
> **สิทธิ์รายฟีเจอร์:** สมาชิกเห็นเฉพาะฟีเจอร์ที่ได้รับ (ค่าเริ่มต้น: ปฏิทิน +
> นำเข้า/ส่งออก) เก็บใน `namphrae_portal.userAccess` — ของพอร์ทัลเอง ไม่แตะ
> ทะเบียนที่แชร์ **ผู้จัดการ** (`isManager` ใน userAccess หรือ clerkId ตรงกับ
> `PORTAL_MANAGER_CLERK_ID`) เห็นครบทุกฟีเจอร์และเป็นคนเดียวที่เข้าหน้า
> จัดการผู้ใช้ได้ (อนุมัติผู้สมัคร เปิด-ปิดการใช้งาน กำหนดสิทธิ์ ตั้ง/ถอดผู้จัดการ)
> — ตั้ง `PORTAL_MANAGER_CLERK_ID` บน production ก่อน deploy ไม่งั้นไม่มีใคร
> เข้าหน้าจัดการผู้ใช้ได้
>
> ⚠️ **ทะเบียนนี้อยู่คนละ db กับ config ของพอร์ทัล** — `MONGODB_USERS_DB`
> (ค่าเริ่มต้น `db_namphrae`) คือทะเบียนผู้ใช้ ส่วน `MONGODB_DB`
> (ค่าเริ่มต้น `namphrae_portal`) คือ config กับปฏิทินปฏิบัติงาน **อย่าตั้ง
> `MONGODB_DB=db_namphrae`** ไม่งั้นข้อมูลพอร์ทัลจะไปปนอยู่ในฐานของ smart-namphrae
>
> **บน production ถ้าตั้ง Clerk แต่ไม่ได้ตั้ง `MONGODB_URI` หลังบ้านจะถูกล็อกทั้งหมด
> (403)** ไม่ใช่เปิดให้ทุกคนที่ล็อกอินได้ — เพราะไม่มีทะเบียนก็ตัดสินไม่ได้ว่าใครเป็น
> เจ้าหน้าที่ ส่วนหน้าเว็บสาธารณะยังทำงานต่อได้ (อ่านจากไฟล์ seed) ใน dev ยังปล่อยผ่าน
> ตามเดิมเพื่อให้รันได้โดยไม่ต้องตั้งค่าอะไร

### 3. Cloudinary (อัปโหลดรูป/วิดีโอ)
ถ้าไม่ตั้งค่า ปุ่มอัปโหลดจะแจ้งเตือน แต่ยัง **วาง URL รูปเองได้**
```bash
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## โครงสร้าง

```
src/
  pages/
    index.tsx                     หน้า public (SSG + ISR revalidate 60)
    calendar.tsx                  ปฏิทินปฏิบัติงานสาธารณะ (PII มาส์กแล้ว)
    admin/                        หลังบ้าน (CSR)
      index.tsx                   ตารางลิงก์ + ลากจัดลำดับ + toggle + ลบ + ยอดคลิก
      links/new.tsx, [id].tsx     ฟอร์มเพิ่ม/แก้ลิงก์
      settings.tsx                ตั้งค่าเว็บ + hero media + คู่มือ + กลุ่ม LINE
      data.tsx                    export / import (มี dry-run)
      calendar/index.tsx          คิวรออนุมัติ + ปฏิทิน + ตารางงานทั้งหมด
      calendar/new.tsx, [id].tsx  ฟอร์มเพิ่ม/แก้งาน
    sign-in/[[...index]].tsx      Clerk sign-in
    api/
      config.ts                   GET public config (เฉพาะ isActive)
      calendar.ts                 GET ปฏิทินสาธารณะ (PII มาส์กแล้ว)
      track/[id].ts               POST +1 clickCount (rate-limited)
      visit.ts                    GET/POST ตัวนับผู้เข้าชม
      line/webhook.ts             POST รับ event join/leave จาก LINE
      cron/daily-digest.ts        POST สรุปตารางงานพรุ่งนี้เข้ากลุ่ม LINE (n8n ยิงทุก 17:00)
      admin/                      CRUD หลังบ้าน (ต้องเป็น admin) รวม calendar/, line-group.ts
  components/                     Hero, ServiceCard, CategorySection, Footer, admin/*
    MonthGrid.tsx                 ปฏิทินเดือน ใช้ร่วม `/calendar` และ `/admin/calendar` — ไม่รู้จัก PII
    admin/JobForm.tsx             ฟอร์มงานปฏิบัติงาน (กู้ชีพ/กู้ภัย)
  lib/
    config-store.ts               ตัวกลาง Mongo | file store (เอกสาร portalConfig)
    jobs-store.ts                 ตัวกลาง Mongo | file store (collection calendarJobs)
    schema.ts                     Zod schema ใช้ร่วมทั้ง API และฟอร์ม
    auth-server.ts / clerk-config.ts   auth (server) / env check (client-safe)
    cloudinary.ts, rate-limit.ts, revalidate.ts, category-accent.ts, fonts.ts
    job-status.ts, job-public.ts, calendar-grid.ts   logic บริสุทธิ์ มีเทสต์ (ดู Scripts)
    line.ts, line-message.ts, line-signature.ts      ยิงข้อความ / จัดรูปแบบ / ตรวจลายเซ็น webhook
  types/portal.ts                 TypeScript types
data/portal-config.seed.json      ข้อมูลตั้งต้น (committed)
scripts/seed.ts                   seed เข้า Mongo
vitest.config.ts                  ตั้ง alias `@` ให้ vitest (ต้องตรงกับ tsconfig paths)
```

**การ revalidate:** ทุก mutation หลังบ้าน bump `version` + set `updatedAt/updatedBy` แล้วเรียก `res.revalidate('/')` ให้หน้า public อัปเดตภายในไม่กี่วินาที (ไม่ต้องรอ 60s หรือ deploy ใหม่) — ทำจาก API ที่ auth แล้ว จึงไม่ต้องใช้ `REVALIDATE_SECRET` แยก

**Hero media:** `site.hero.mediaType` = `none` (ไล่สี + ลายเส้น contour), `image`, หรือ `video` (autoplay/muted/loop + poster, เคารพ `prefers-reduced-motion`) อัปโหลดวิดีโอใหม่ได้ทีหลังผ่าน `/admin/settings` โดยไม่ต้อง deploy — ข้อกำหนด ≤ 1080p, 10–20 วินาที, ไม่มีเสียง, ต้องมี poster คู่กัน

---

## ปฏิทินปฏิบัติงาน

แทนหน้า Google Calendar embed เดิม — เจ้าหน้าที่กรอกฟอร์มที่ `/admin/calendar/new`
→ เจ้าหน้าที่คนใดก็ได้กดอนุมัติให้ขึ้นปฏิทิน (คิวรออนุมัติดูจาก badge ข้าง
"ปฏิทินปฏิบัติงาน" หลังบ้าน) → ปิดงานเป็น "ดำเนินการแล้ว" เมื่อทำเสร็จ

ระบบ**ไม่**แจ้ง LINE รายงานใหม่ — เคยแจ้งทุกงานตอนบันทึก แต่กินโควตาข้อความ
รายเดือนของ LINE OA เร็วเกินไป จึงเหลือแจ้งเตือนช่องทางเดียวคือสรุปประจำวัน 17:00

| หน้า | ใคร | เห็นอะไร |
|---|---|---|
| `/calendar` | ทุกคน | เวลา + ประเภทงาน + หมู่บ้าน เท่านั้น |
| `/admin/calendar` | เจ้าหน้าที่ | ครบทุกฟิลด์ + คิวรออนุมัติ + ปุ่มเปลี่ยนสถานะ |

**ข้อมูลส่วนบุคคล:** ชื่อผู้รับบริการ เบอร์โทร ต้นทาง-ปลายทาง ไม่ออกจาก API
สาธารณะเลย — `toPublicJob()` ใน `src/lib/job-public.ts` ประกอบ payload ทีละฟิลด์
และมีเทสต์ยืนยันว่าไม่มีฟิลด์อื่นเล็ดลอด งานที่ยังรออนุมัติหรือถูกยกเลิกก็ไม่ขึ้นปฏิทินสาธารณะ

**เก็บที่ไหน:** collection `calendarJobs` แยกจาก `portalConfig` (มี file fallback
`data/calendar-jobs.json` สำหรับ dev เหมือน config, gitignored) — เอกสาร config
ถูกเขียนทับทั้งก้อนทุก mutation ส่วนงานปฏิทินโตไม่จำกัด จึงต้องแยก

> ⚠️ **ต้องตั้ง `MONGODB_URI` ก่อนใช้งานจริง ไม่ว่าจะ deploy บน host ไหนก็ตาม**
> ไม่ใช่แค่ Vercel — filesystem ของ Vercel read-only ตอน runtime จึงพังทันทีด้วย
> `EROFS` ถ้าลืมตั้ง (เห็นชัดเจน) แต่ host แบบ Railway เขียนไฟล์ได้จริง เพียงแต่
> ไม่คงอยู่ข้าม deploy — ถ้าลืมตั้ง `MONGODB_URI` บน Railway ทุกอย่างจะ "ใช้งาน
> ได้" ปกติ (บันทึกงาน ปฏิทินขึ้น) จนกว่าจะ deploy รอบถัดไป
> แล้วข้อมูลผู้ป่วยทั้งหมดหายไปเงียบ ๆ โดยไม่มีอะไรเตือน — jobs-store จึงปฏิเสธ
> การใช้แบ็กเอนด์ไฟล์เองเมื่อ `NODE_ENV=production` ไม่มี `MONGODB_URI` (โยน
> error ให้ทุกคำขอ API ของปฏิทินตอบ 500 ดัง ๆ แทน) ดูรายละเอียดใน
> `assertFileBackendAllowed()` ที่ `src/lib/jobs-store.ts`

**ไม่ได้อยู่ในไฟล์ backup:** หน้า `/admin/data` ("ส่งออก (Backup)") export เฉพาะ
`portalConfig` (บริการ/หมวดหมู่/ตั้งค่าเว็บ) เท่านั้น — **`calendarJobs` ไม่ถูก
export ไปด้วย** ยังไม่มีทาง backup/restore งานปฏิทินผ่านหน้านี้ ถ้าต้องสำรอง
ข้อมูลงานปฏิทินต้องทำผ่าน Mongo โดยตรง (เช่น `mongodump` ที่ collection
`calendarJobs`) — และปุ่ม **ลบ (DELETE)** ในตารางงานเป็นการลบถาวรจริง ต่างจาก
**ยกเลิก** (เปลี่ยนสถานะเป็น `cancelled`) ซึ่งยังเก็บระเบียนไว้ ลบไปแล้วกู้คืนไม่ได้

### ตั้งค่า LINE

ถ้าไม่ตั้งเลย ระบบยังใช้งานได้ครบทุกอย่างตามปกติ เพียงแต่ไม่ส่งแจ้งเตือนเข้ากลุ่ม
(หน้า `/admin/settings` จะมีกล่องบอกสถานะนี้ให้เห็นตลอด) — ทำตามลำดับนี้เพื่อเปิดใช้งาน:

1. เข้า [LINE Developers Console](https://developers.line.biz/console/) → สร้าง
   Provider ใหม่ (ถ้ายังไม่มี) → ในนั้นสร้างช่องทางชนิด **Messaging API** ตั้งชื่อ
   บอทตามที่จะใช้จริง (เช่น "น้ำแพร่พัฒนา แจ้งเตือน")
2. คัดลอกค่ามาใส่ `.env.local` (หรือ environment ของ hosting):
   - แท็บ **Messaging API** ของช่องทางที่สร้าง → เลื่อนลงไปกด "Issue" ที่ช่อง
     "Channel access token (long-lived)" → คัดลอกมาเป็น `LINE_CHANNEL_ACCESS_TOKEN`
   - แท็บ **Basic settings** → "Channel secret" → คัดลอกมาเป็น `LINE_CHANNEL_SECRET`
   ```bash
   LINE_CHANNEL_ACCESS_TOKEN=...
   LINE_CHANNEL_SECRET=...
   NEXT_PUBLIC_SITE_URL=https://<โดเมนจริง>   # ห้ามใส่ / ปิดท้าย
   ```
3. deploy (หรือรัน dev ผ่าน tunnel ที่มี HTTPS) แล้วกลับไปแท็บ **Messaging API**
   → ตั้ง **Webhook URL** เป็น `https://<โดเมนจริง>/api/line/webhook` → กด
   **Verify** ต้องขึ้น **Success** — ถ้าไม่ผ่าน ตรวจว่าตั้ง `LINE_CHANNEL_SECRET`
   ถูกตัวแล้วหรือยัง (ลายเซ็นของ webhook คำนวณจากค่านี้) → เปิดสวิตช์
   **Use webhook** เป็น ON
4. ในแท็บเดียวกัน ปิด **Auto-reply messages** และ **Greeting messages** เป็น
   OFF — กันบอทตอบแชทอัตโนมัติในกลุ่มเจ้าหน้าที่ (ค่าเริ่มต้นของ LINE เปิดไว้)
5. เพิ่มบอท OA เป็นเพื่อน (สแกน QR หรือค้นด้วย Basic ID จากแท็บ Messaging API)
   แล้ว **เชิญบอทเข้ากลุ่มเจ้าหน้าที่** — ระบบจะจำ `groupId` ให้เองตอนบอทเข้ากลุ่ม
   ผ่าน webhook (event `join`) ไม่ต้องกรอกที่ไหนอีก
6. **ยืนยันว่าใช้ได้จริง:** เปิด `/admin/settings` → กล่อง "แจ้งเตือน LINE" ต้อง
   ขึ้น "ตั้งค่า LINE ครบแล้ว" และแถว "กลุ่มปัจจุบัน" ต้องมีค่า (ไม่ใช่ "ยังไม่มี")
   จากนั้นลองสร้างงานทดสอบที่ `/admin/calendar/new` แล้วดูว่ามีข้อความเข้ากลุ่มจริง

**ย้ายกลุ่ม LINE:** ระบบ**ไม่**เปลี่ยนกลุ่มให้อัตโนมัติเมื่อบอทถูกเชิญเข้ากลุ่มใหม่
ทั้งที่มีกลุ่มเดิมอยู่แล้ว (ป้องกันข้อมูลผู้ป่วยไหลไปกลุ่มอื่นโดยไม่มีใครรู้) — ต้องไป
เปลี่ยนเองที่ `/admin/settings` (ช่อง "LINE group id") · กรณีที่ต้องระวัง: ถ้า
**ลบกลุ่มทิ้ง**แทนที่จะเตะบอทออกก่อน LINE อาจไม่ส่ง event `leave` มา ระบบจึงยังจำ
กลุ่มที่ไม่มีอยู่แล้วอยู่ดี การเชิญเข้ากลุ่มใหม่จะถูกปฏิเสธเงียบ ๆ (เพราะระบบเห็นว่ามี
กลุ่มอยู่แล้วจึงไม่เขียนทับให้) **วิธีแก้: ลบค่าในช่อง LINE group id ที่ `/admin/settings`
ให้ว่าง แล้วกดบันทึก จากนั้นเชิญบอทเข้ากลุ่มใหม่อีกครั้ง**

> ⚠️ **ข้อความแจ้งเตือน LINE มีข้อมูลส่วนบุคคลครบชุด** — ชื่อผู้ป่วย เบอร์โทร ต้นทาง
> ปลายทาง สิ่งเดียวที่คุมว่าใครเห็นคือ "บอทอยู่กลุ่มไหน" ซึ่งระบบจำจาก event `join`
> อัตโนมัติ ถ้าบอทถูกเชิญเข้ากลุ่มผิด ข้อมูลจะไหลไปที่นั่นทันทีโดยไม่มีอะไรเตือน
> **กล่องสถานะที่ `/admin/settings` จึงต้องแสดงค่าปัจจุบันให้เห็นเสมอ** ไม่ใช่แค่
> ช่องว่างให้กรอก — มันเป็นทางเดียวที่เจ้าหน้าที่จะสังเกตได้ว่ากลุ่มเปลี่ยนไป

### สรุปตารางงานประจำวัน (17:00)

ทุกวัน 17:00 ระบบส่งสรุป**งานของวันพรุ่งนี้** (อนุมัติแล้ว + รออนุมัติ) เข้ากลุ่ม LINE
— วันว่างก็ส่ง "ไม่มีงานในตาราง" เสมอ (เงียบ = ผิดปกติ) นี่คือแจ้งเตือน LINE
ช่องทางเดียวของระบบ (นอกจากปุ่มส่งข้อความทดสอบที่ `/admin/settings`)

ตัวตั้งเวลาอยู่ที่ **n8n** (workflow "แจ้งตารางงานพรุ่งนี้เข้ากลุ่ม LINE") ไม่ใช่ cron
ของ Railway — n8n ยิง `POST /api/cron/daily-digest` พร้อม header `x-cron-secret`
ทุกวัน จะแก้เวลา/หยุดชั่วคราว ทำที่ n8n ที่เดียว

ตั้งค่า: generate secret (`openssl rand -hex 32`) → ใส่ `CRON_SECRET` ใน Railway
และใน header `x-cron-secret` ของ HTTP Request node ที่ n8n ให้ตรงกัน · ถ้า run ใน n8n ขึ้น fail:
502 = LINE ส่งไม่ออก (ดู log ที่ Railway — token/groupId หาย หรือยังไม่ตั้งค่า LINE),
401 = secret สองที่ไม่ตรงกัน, 503 = ยังไม่ได้ตั้ง `CRON_SECRET` ที่ Railway

---

## คลังไฟล์แผนที่

เจ้าหน้าที่จัดการไฟล์แผนที่เองได้ที่ **หลังบ้าน → ไฟล์แผนที่** (`/admin/map`) โดยลากไฟล์
มาวางบนการ์ดของเลเยอร์ที่ต้องการแทนที่ ระบบตรวจไฟล์ให้ก่อน สรุปว่าอะไรเปลี่ยนไป
แล้วไฟล์ใหม่จะยังไม่ขึ้นใช้งานจนกว่าจะกดเผยแพร่

**ชนิดไฟล์ที่รับ:** `.geojson` · `.js` (qgis2web) · `.zip` (shapefile — แปลงที่เบราว์เซอร์
พร้อมแปลงพิกัดตาม `.prj` ให้อัตโนมัติ)

### สี่เลเยอร์ที่นำเข้ามาจาก namphraesmartcity.ai

| เลเยอร์ | ชนิด | จำนวน | คีย์ประจำรายการ |
|---|---|---|---|
| โซนหมู่บ้าน `zone-moobang` | MultiPolygon | 11 | `zone_id` |
| ถนน `road` | MultiLineString | 1,475 | `full_id` + `zone_id` |
| อาคาร `building` | MultiPolygon | 5,460 | (ไม่มี — เทียบแค่จำนวน) |
| แปลงที่ดิน `parcel` | MultiPolygon | 7,970 | `parcel_cod` |

ถนนต้องใช้คีย์ประกอบเพราะถนนเส้นเดียวที่พาดผ่านสองหมู่ถูกตัดเป็นคนละแถวตอน clip
(`full_id` อย่างเดียวซ้ำ 138 แถว) ส่วนอาคารไม่ตั้งคีย์เพราะ `OBJECTID` ถูก ArcGIS
แจกใหม่ทุกรอบ export

### ข้อมูลส่วนบุคคล

เลเยอร์แปลงที่ดินมีที่อยู่เจ้าของและเลขโฉนดปนอยู่ **ไฟล์สาธารณะจึงถูกกรองฟิลด์ตั้งแต่
ตอนกดเผยแพร่ ไม่ใช่ตอนเสิร์ฟ** — ไฟล์ที่วางอยู่บน CDN ไม่เคยมีฟิลด์เหล่านั้นอยู่ในนั้น
ตั้งแต่แรก ต่อให้โค้ดฝั่ง API พังก็ไม่มีอะไรให้หลุด

ค่าเริ่มต้นคือ **ปิดทุกฟิลด์** ฟิลด์ใหม่ที่โผล่มาในไฟล์เวอร์ชันหน้าจึงถูกกันไว้เอง
โดยอัตโนมัติ ต้องเข้าไปติ๊กเปิดที่ `/admin/map/<layerId>` อย่างตั้งใจเท่านั้น
(ฟิลด์ที่ชื่อเข้าข่ายข้อมูลส่วนบุคคลต้องยืนยันซ้ำอีกครั้งก่อนเปิด)

> เปลี่ยนรายการฟิลด์แล้ว **ต้องกดเผยแพร่ใหม่** ไฟล์ที่เสิร์ฟอยู่จึงจะเปลี่ยนตาม —
> หน้าตั้งค่าจะเตือนให้เองเมื่อจำเป็น

### API สำหรับระบบอื่น

```
GET /api/map/layers                  รายชื่อเลเยอร์ที่เผยแพร่แล้ว
GET /api/map/layers/{id}/geojson     302 → ไฟล์ GeoJSON บน CDN
```

เปิดสาธารณะ ไม่ต้องล็อกอิน เอา URL ไปใส่ QGIS หรือ Leaflet ได้ตรง ๆ — endpoint เป็น
redirect ไม่ใช่ proxy ตัวไฟล์จึงไม่วิ่งผ่านเซิร์ฟเวอร์พอร์ทัลเลย (Pages Router เตือน
เมื่อ response เกิน 4 MB ส่วนไฟล์แปลงที่ดินหนักกว่านั้น)

### เวอร์ชันและการย้อนกลับ

ทุกการอัปโหลดเป็นเวอร์ชันใหม่ เก็บประวัติไว้ตลอด (ใครอัป ใครเผยแพร่ ผลตรวจเป็นอย่างไร)
กดย้อนกลับไปใช้เวอร์ชันเก่าได้ทันทีจากหน้าประวัติ **ไฟล์เต็ม** เก็บย้อนหลัง 5 เวอร์ชัน
ล่าสุด (บวกเวอร์ชันที่เผยแพร่อยู่เสมอ) ส่วนไฟล์สาธารณะไม่ถูกลบเพราะมันคือสิ่งที่ทำให้
ย้อนเวอร์ชันได้ทันทีโดยไม่ต้องประมวลผลใหม่

### นำเข้าครั้งแรก

```bash
npm run import:map
```

ดึงทั้งสี่ไฟล์จาก `namphraesmartcity.ai/map/data/` ขึ้นเป็น **ร่าง** ไม่เผยแพร่ให้อัตโนมัติ
(การเปิดข้อมูลสู่สาธารณะไม่ควรเป็นผลข้างเคียงของการรันสคริปต์) รันซ้ำได้ ถ้าเนื้อข้อมูล
ตรงกับเวอร์ชันที่มีอยู่แล้วจะข้าม ต้องตั้ง `CLOUDINARY_*` และ `MONGODB_URI` ก่อน

---

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm run start   # รัน production build
npm run seed    # seed Mongo จาก seed.json
npm run import:map  # นำเข้าเลเยอร์แผนที่ทั้งสี่จาก namphraesmartcity.ai (รันซ้ำได้)
npm run lint    # eslint
npm test        # vitest (logic บริสุทธิ์: PII masking, สถานะ, ปฏิทิน, LINE)
```

> **ไฟล์เทสต์ห้ามอยู่ใต้ `src/pages/**`** — Pages Router ใช้ `pageExtensions` ค่าเริ่มต้น
> `['tsx','ts','jsx','js']` ไฟล์ `*.test.ts` ในนั้นจะกลายเป็น **route จริง** (เช่น
> `/admin/calendar/index.test` หรือ endpoint สาธารณะใต้ `/api/`) และถูก bundle เข้า production
> วางไว้ข้างซอร์สใน `src/lib/` หรือ `src/components/` เท่านั้น
>
> `tsconfig.json` include `**/*.ts` ไฟล์เทสต์จึงถูก typecheck ตอน `next build` ด้วย —
> แปลว่า **`vitest` ต้องถูกติดตั้งตอน build** ห้ามใช้ `npm ci --omit=dev` ก่อน build บน
> Railway/Vercel ไม่งั้น build พัง (ค่าเริ่มต้นของทั้งสองเจ้าติดตั้ง devDependencies อยู่แล้ว)

---

## ⚠️ รอยืนยันจากเทศบาลก่อน go-live

จาก `namphrae-portal-PLAN.md` §8–§9 — ข้อมูล seed บางส่วนมาจากการเดา (ของเดิมเป็นรูปภาพล้วนไม่มี alt text):

- [ ] **ยืนยันชื่อบริการทั้ง 18 รายการ** โดยเฉพาะ `baimai`, `npdrh-calendar`, `smart-namphrae`
- [ ] `placeholder-15` (เดิมลิงก์ไป `#`) ตั้ง `isActive: false` ไว้ — รอยืนยันว่าคือบริการอะไร
- [ ] **รูปการ์ดยัง hotlink จากโดเมนเก่า** — ควรย้ายขึ้น Cloudinary ให้ครบก่อนปิดเซิร์ฟเวอร์เดิม (การ์ดมี fallback เป็นตัวอักษรย่อถ้ารูปโหลดไม่ขึ้น)
- [ ] ชื่อ repo / โดเมนที่จะใช้จริง
- [ ] **ลิงก์บริการ `npdrh-calendar`** ชี้ไปหน้า Google-Calendar-style เดิม
      (`namphraesmartcity.ai/calendar/NPDRH/NPDRH.html`) ซึ่งเป็น "ปฏิทินกิจกรรม"
      ทั่วไป — ตอนนี้พอร์ทัลมี **ปฏิทินปฏิบัติงาน** ของตัวเองแล้วที่ `/calendar`
      (ดูหัวข้อด้านบน) แต่เป็นคนละเรื่องกัน (งาน EMS/กู้ภัยที่อนุมัติผ่านระบบ vs
      ปฏิทินกิจกรรมทั่วไปของเทศบาล) — รอเทศบาลตัดสินใจว่าจะเก็บลิงก์เดิมไว้คู่กัน,
      เปลี่ยนให้ชี้มา `/calendar` แทน, หรือเลิกใช้ไปเลย
- [ ] **ยังไม่มีลิงก์ไหนพาไปหน้า `/calendar` เลย** — หน้าปฏิทินสาธารณะสร้างเสร็จ
      แล้วและใช้งานได้ แต่ไม่มีการ์ดบริการใบไหนชี้มาที่นี่ ประชาชนจะหาไม่เจอจนกว่า
      เจ้าหน้าที่จะเพิ่มการ์ดบริการใหม่ผ่าน `/admin/links` เอง (หรือแก้ลิงก์
      `npdrh-calendar` ข้อบนให้ชี้มาที่นี่แทน — ดูข้อก่อนหน้า)
- ตัวนับผู้เข้าชมเริ่มต่อจาก 51,051 ตามที่ตกลง / ไม่ทำ popup โปรโมชัน
