# แจ้งสรุปตารางงานพรุ่งนี้เข้ากลุ่ม LINE ทุก 17:00 (Daily Digest)

**Date:** 2026-08-05
**Status:** Approved by user (approach A — endpoint ในแอป, n8n เป็นตัวตั้งเวลา)

## Goal

ทุกวันเวลา 17:00 (เวลาไทย) ส่งข้อความสรุป**ตารางงานของวันพรุ่งนี้**เข้ากลุ่ม LINE
เจ้าหน้าที่ เพื่อให้เห็นงานล่วงหน้าก่อนเลิกงาน ปัจจุบันระบบ push เฉพาะตอนสร้างงานใหม่
(ครั้งเดียวจบ) ไม่มีการแจ้งเตือนตามเวลาใด ๆ

ผู้ใช้ deploy แอปบน Railway และ**ไม่ต้องการตั้ง cron ที่ Railway** — ใช้ n8n
(เชื่อมต่อผ่าน Claude MCP อยู่แล้ว) เป็นตัวตั้งเวลา ยิง HTTP มาที่ endpoint ใหม่ของแอป

## Decisions (confirmed with user)

1. **ช่วงเวลา:** สรุปงานของ "วันพรุ่งนี้" (ตามเวลา Asia/Bangkok) เท่านั้น
2. **สถานะที่รวม:** `approved` + `pending` — งานอนุมัติแล้วอยู่บนสุด งานรออนุมัติแยก
   section ล่างพร้อมข้อความเตือนให้รีบอนุมัติ + ลิงก์หน้า admin (ไม่รวม `done`/`cancelled`)
3. **วันว่าง:** ส่งข้อความ "พรุ่งนี้ไม่มีงานในตาราง" ทุกวันเสมอ — เงียบ = ผิดปกติ ไม่ใช่ไม่มีงาน
4. **ฝั่ง n8n:** สร้าง workflow ให้ผ่าน MCP (Schedule Trigger → HTTP Request)

### เหตุผลที่ไม่เลือกทางอื่น

- **n8n ต่อ Mongo + ยิง LINE API เอง:** ต้องฝาก connection string และ LINE token ไว้ที่
  n8n, ก๊อป logic รูปแบบข้อความ/สถานะไปอยู่สองที่ — schema เปลี่ยนแล้วเพี้ยนเงียบ ๆ
- **n8n ดึง feed สาธารณะ `/api/calendar`:** feed นั้น mask PII — สรุปสำหรับเจ้าหน้าที่
  จะขาดข้อมูล และ logic จัดข้อความไปกองที่ n8n เหมือนกัน

## Design

### 1. ภาพรวม

```
n8n (cron 0 17 * * *, Asia/Bangkok)
  → POST {SITE_URL}/api/cron/daily-digest   header: x-cron-secret
    → tomorrowInBangkok()
    → listJobs({ month: พรุ่งนี้.slice(0,7) })
        กรองในตัว endpoint: date === พรุ่งนี้ && status ∈ {approved, pending}
        (JobFilter เดิมกรองได้แค่ month + status เดียว — งานต่อเดือนมีน้อย
         ไม่คุ้มแก้ store สอง backend)
    → formatDailyDigestMessage(jobs, date, siteUrl)   ← pure, มีเทสต์
    → pushGroupText(text)                              ← I/O เดิม refactor มาใช้ร่วม
```

### 2. Formatter — `formatDailyDigestMessage(jobs, dateISO, adminUrl?)` ใน `src/lib/line-message.ts`

Pure function แบบเดียวกับ `formatNewJobMessage` (ไม่อ่าน env, ไม่ทำ I/O)
ผู้เรียกส่งเฉพาะงานที่กรองแล้ว (approved + pending ของวันพรุ่งนี้) เรียงด้วย `bySchedule`

รูปแบบเมื่อมีงาน (section รออนุมัติโผล่เฉพาะเมื่อมีงาน pending):

```
📋 ตารางงานพรุ่งนี้ — อ. 6 ส.ค.
🚑 06:00 ส่งผู้ป่วยฟอกไต (บ้านแม่ขนิลเหนือ)
🚨 14:00 ตัดต้นไม้ล้ม (บ้านน้ำแพร่)

⏳ รออนุมัติ 1 งาน — รีบอนุมัติก่อนถึงวันงาน
🚑 09:00 รับผู้ป่วยกลับบ้าน (บ้านท่าไม้ลุง)
👉 {adminUrl}/admin/calendar
```

- บรรทัดงาน: `{KIND_EMOJI} {time} {title}` + ` ({village})` ถ้ามี — ใช้ `KIND_EMOJI`
  ตัวเดิม (fallback 🔔 เมื่อ kind นอกตาราง เหมือน `formatNewJobMessage`)
- **ไม่ใส่** เบอร์โทร / ต้นทาง-ปลายทาง / note — กันข้อความยาว รายละเอียดดูในลิงก์
- หัวข้อความใช้ `thaiShortDate(dateISO)` เดิม
- ลิงก์ admin ต่อท้าย section รออนุมัติเท่านั้น (ถ้าไม่มี `adminUrl` ก็ไม่มีบรรทัดลิงก์
  แต่ section รออนุมัติยังขึ้น)
- วันว่าง: `📋 พรุ่งนี้ (อ. 6 ส.ค.) ไม่มีงานในตาราง`
- เพดาน LINE 5,000 ตัวอักษร: ถ้าเกิน ตัดรายการงานท้าย ๆ ออกแล้วปิดด้วย
  `…และอีก N งาน ดูทั้งหมดที่ {adminUrl}/admin/calendar` — ตัดทีละงานจนกว่าจะไม่เกิน
  (ไม่มี `adminUrl` ก็ปิดแค่ `…และอีก N งาน`)

### 3. Endpoint — `src/pages/api/cron/daily-digest.ts` (`POST` เท่านั้น)

| เงื่อนไข | ตอบ |
|---|---|
| method อื่น | 405 |
| ไม่ได้ตั้ง env `CRON_SECRET` | 503 (feature ปิดอยู่ — จงใจ ไม่ใช่พัง) |
| header `x-cron-secret` ไม่ตรง | 401 |
| ส่ง LINE ไม่ออก (token/groupId หาย, LINE ล่ม/timeout) | 502 — ให้ run ใน n8n ขึ้น fail มองเห็นได้ |
| สำเร็จ | 200 `{ sent: true, date, jobs: N }` |

- เทียบ secret แบบ timing-safe (`crypto.timingSafeEqual` — เทียบ hash กัน length ต่างกัน
  throw, แนวเดียวกับที่ `line-signature.ts` ทำ)
- endpoint บางที่สุด: คำนวณวัน → query → กรอง → format → push — logic ทั้งหมดอยู่ใน
  pure function ที่มีเทสต์ (โปรเจกต์ไม่มี API test harness)

### 4. helper ใหม่

- `tomorrowInBangkok(): string` ใน `src/lib/calendar-grid.ts` — ต่อยอด
  `todayInBangkok()` เดิม: parse `YYYY-MM-DD` → `Date.UTC` + 1 วัน → format กลับ
  (เลขคณิตบน UTC ล้วน ไม่ผ่าน local timezone ของเครื่อง) เทสต์เคสข้ามเดือน/ข้ามปี/ปีอธิกสุรทิน
- `pushGroupText(text: string): Promise<boolean>` ใน `src/lib/line.ts` — ดึงส่วน
  token/groupId/fetch/timeout 5s ของ `pushNewJobNotice` ออกมาเป็นทางส่งข้อความ text
  ใด ๆ เข้ากลุ่ม แล้วให้ `pushNewJobNotice` เรียกผ่านตัวนี้ (พฤติกรรมเดิมไม่เปลี่ยน:
  best-effort คืน boolean ไม่ throw)

### 5. n8n workflow — "แจ้งตารางงานพรุ่งนี้เข้ากลุ่ม LINE"

2 โหนด สร้างผ่าน MCP:

1. **Schedule Trigger** — cron `0 17 * * *`, timezone `Asia/Bangkok`
2. **HTTP Request** — `POST {URL แอปที่ใช้งานจริง}/api/cron/daily-digest`,
   header `x-cron-secret: {ค่าเดียวกับ CRON_SECRET}`

URL ใช้ของจริงตอนสร้าง (ถ้าโดเมน `namphrae-portal.app` ยังไม่ online ใช้ URL Railway
ปัจจุบันก่อน แล้วแก้ที่โหนดเดียวเมื่อย้ายโดเมน) ตรวจงานสร้างด้วยการกด execute ทดสอบจริง 1 ครั้ง

### 6. Env + เอกสาร

- `CRON_SECRET` — เพิ่มใน `.env.example` (พร้อมคอมเมนต์วิธี generate เช่น
  `openssl rand -hex 32`) และ README (ต้องตั้งค่าเดียวกันสองที่: Railway + n8n)
- `/admin/settings` ไม่แตะรอบนี้ (YAGNI — readiness ของ LINE แสดงอยู่แล้ว)

### 7. การเทสต์

- `line-message.test.ts` เพิ่ม describe ของ digest: วันว่าง / เรียงตาม `bySchedule` /
  แยก section approved–pending / ไม่มี pending ก็ไม่มี section / ไม่มี adminUrl /
  kind นอกตาราง / ตัดข้อความเกิน 5,000
- `calendar-grid.test.ts` เพิ่ม `tomorrowInBangkok` (mock `todayInBangkok` หรือแยก
  pure `nextDate(dateISO)` ให้เทสต์ตรง ๆ): กลางเดือน, สิ้นเดือน, สิ้นปี, 28 ก.พ. ปีอธิกสุรทิน
- ก่อนจบ: `npx tsc --noEmit`, `npm test`, ยิงจริงผ่าน n8n 1 ครั้งแล้วเช็คข้อความในกลุ่ม

## Scope

**ทำ:** formatter + เทสต์, `tomorrowInBangkok` + เทสต์, `pushGroupText` refactor,
endpoint, env/README, n8n workflow, ทดสอบยิงจริง

**ไม่ทำ:** แจ้งเตือนซ้ำ/เวลาอื่น, digest รายสัปดาห์, retry อัตโนมัติฝั่งแอป (n8n เห็น
fail แล้วตั้ง retry ได้เองภายหลัง), UI ตั้งค่าเวลาใน admin, การแจ้งเตือน error เข้า LINE
