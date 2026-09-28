# จำกัดแจ้งเตือน LINE OA สรุปตารางงานให้ส่งเฉพาะจันทร์-ศุกร์ (ประหยัดโควตาข้อความ)

**Date:** 2026-09-28
**Status:** Approved by user

## Goal

ปัจจุบัน daily digest ([[namphrae-daily-digest]]) ส่งเข้ากลุ่ม LINE เจ้าหน้าที่**ทุกวัน**
17:00 (รวมเสาร์-อาทิตย์) แม้วันว่างก็ยังส่ง "ไม่มีงานในตาราง" เสมอ — 7 ข้อความ/สัปดาห์
กินโควตาข้อความรายเดือนของ LINE OA เร็วเกินไป ([[namphrae-daily-digest]] บันทึกไว้แล้วว่า
เคยตัดฟีเจอร์แจ้งงานใหม่ทิ้งด้วยเหตุผลเดียวกัน)

ผู้ใช้ต้องการส่งเฉพาะจันทร์-ศุกร์ (5 ข้อความ/สัปดาห์ ลดลง ~29%)

## Decisions (confirmed with user)

1. **ตัดวันเสาร์-อาทิตย์ออกจากตาราง n8n** — ไม่ยิง HTTP request มาที่ endpoint เลยในสอง
   วันนี้ (ประหยัดจริง ไม่ใช่แค่ endpoint ตอบเงียบ)
2. **ช่องโหว่ที่ต้องอุด:** ถ้าตัดอาทิตย์ทิ้งตรง ๆ งานของ**วันจันทร์**จะไม่มีใครถูกแจ้งเตือน
   ล่วงหน้าเลย (เดิม 17:00 อาทิตย์แจ้งงานจันทร์) — ผู้ใช้เลือกให้**ข้อความวันศุกร์ครอบคลุม
   เสาร์+อาทิตย์+จันทร์** (3 วัน) แทนที่จะครอบคลุมแค่เสาร์วันเดียว
3. **จันทร์-พฤหัส:** พฤติกรรมเดิมเป๊ะ ไม่แตะ (ยังคงสรุปแค่ "พรุ่งนี้" วันเดียว)
4. **ตัวตั้งเวลา:** ยังอยู่ที่ n8n เท่านั้น (ธรรมเนียมเดิม — ผู้ดูแลอยากเห็น/แก้ตารางเวลาที่
   เดียว) endpoint เองไม่รู้จัก cron schedule เลย ตัดสินใจแค่จาก "วันนี้เป็นวันอะไร"

## Design

### 1. ภาพรวม

```
n8n (cron 0 17 * * 1-5, Asia/Bangkok — เดิม * * * เปลี่ยนเป็น 1-5)
  → POST /api/cron/daily-digest   (เหมือนเดิมทุกวัน จ-ศ ตอนนี้)
    → todayInBangkok() → weekdayMonFirst(today)
    → ถ้าวันนี้ไม่ใช่ศุกร์ (จ-พฤ): เหมือนเดิมทุกอย่าง
        tomorrowInBangkok() → listJobs → formatDailyDigestMessage (ไม่แก้ฟังก์ชันนี้)
    → ถ้าวันนี้เป็นศุกร์: 3 วัน (เสาร์, อาทิตย์, จันทร์)
        แต่ละวัน listJobs แยก (คนละเดือนได้ถ้าคาบเกี่ยว) → formatWeekendBridgeDigestMessage (ใหม่)
```

### 2. `weekdayMonFirst(dateISO): number` — ใหม่ใน `src/lib/calendar-grid.ts`

Pure function คืนลำดับวัน 0=จ..6=อา ให้ตรงกับ `THAI_DOW` ที่มีอยู่แล้ว (สูตรเดียวกับที่
`buildMonthGrid` ใช้ภายใน: `(getUTCDay()+6)%7`) — ดึงออกมาเป็นฟังก์ชันแยกเพราะตอนนี้มีผู้ใช้
คนที่สองคือ endpoint (เดิมมีแค่ `buildMonthGrid` ใช้ inline)

### 3. `formatWeekendBridgeDigestMessage(days, adminUrl?)` — ใหม่ใน `src/lib/line-message.ts`

```ts
formatWeekendBridgeDigestMessage(
  days: { date: string; jobs: CalendarJob[] }[],  // เรียงเสาร์→อาทิตย์→จันทร์
  adminUrl?: string
): string
```

ไม่แก้ `formatDailyDigestMessage` เดิมเลย (เส้นทางจันทร์-พฤหัสยังเรียกฟังก์ชันเดิม ความเสี่ยง
ต่อพฤติกรรมเดิม = 0) — ฟังก์ชันใหม่ใช้ `digestJobBlock` internal ตัวเดียวกัน แยก section ต่อวัน:

```
📋 สรุปตารางงานเสาร์-จันทร์นี้ (ไม่มีข้อความแจ้งเตือนวันเสาร์-อาทิตย์)

📅 ส. 6 ก.ย. 69
🚑 ศรีพลอย ดวงแก้ว
🕐 เวลา: 06:00 น.
...

📅 อา. 7 ก.ย. 69
ไม่มีงาน

📅 จ. 8 ก.ย. 69
🚑 ...
```

วันไหนไม่มีงานขึ้น "ไม่มีงาน" เสมอ (แนวเดียวกับของเดิม — เงียบ = ผิดปกติ ไม่ใช่ไม่มีงาน)

**ตัดท้ายเมื่อเกินเพดาน 5,000 ตัวอักษร:** ใช้ตรรกะเดิม (`build(count)` วนลด `count` จากผล
รวมทุกวันแล้วเช็คความยาว) แต่ตัดจาก**วันจันทร์ก่อน** (ไล่ตามลำดับ array เสาร์→อาทิตย์→จันทร์ —
จงใจให้วันใกล้ตัวสุด/เสาร์เห็นครบก่อน) วันที่ถูกตัดจนเหลือ 0 งานที่แสดง ขึ้น "…และอีก N งาน"
แทนบล็อกงาน เหมือนบรรทัดปิดของฟังก์ชันเดิม ถ้าตัดจนหมดทุกวันแล้วยังไม่พอ (ทางทฤษฎีเท่านั้น)
ยอมส่ง 1 งานแรกแม้เกินเพดาน (เหตุผลเดียวกับฟังก์ชันเดิม — ส่งดีกว่าเงียบหาย)

### 4. `src/pages/api/cron/daily-digest.ts`

เพิ่ม branch ต้นฟังก์ชัน หลัง auth check เดิมทั้งหมด (ไม่แตะ secret/rate-limit check):

```ts
const today = todayInBangkok();
if (weekdayMonFirst(today) === 4) {          // ศุกร์
  const sat = tomorrowInBangkok();
  const sun = nextDate(sat);
  const mon = nextDate(sun);
  const days = await Promise.all([sat, sun, mon].map(async (date) => ({
    date,
    jobs: (await listJobs({ month: date.slice(0, 7) }))
      .filter((j) => j.date === date && j.status === 'approved'),
  })));
  const sent = await pushGroupText(formatWeekendBridgeDigestMessage(days, siteUrl));
  const jobCount = days.reduce((n, d) => n + d.jobs.length, 0);
  if (!sent) return res.status(502).json({ sent: false, dates: [sat, sun, mon], jobs: jobCount });
  return res.status(200).json({ sent: true, dates: [sat, sun, mon], jobs: jobCount });
}
// จันทร์-พฤหัส: โค้ดเดิมทั้งหมด ไม่แก้
```

Response shape ของ branch ใหม่ใช้ `dates` (array) แทน `date` (string เดียว) — ไม่มีอะไรใน
โค้ดเบสอ่าน response body นี้นอกจาก n8n (ดู log เฉย ๆ) จึงเปลี่ยนได้โดยไม่กระทบ

### 5. n8n

Workflow `IUVpQvZsVanXHTXV` ("แจ้งตารางงานพรุ่งนี้เข้ากลุ่ม LINE") → node Schedule Trigger →
เปลี่ยน cron จาก `0 17 * * *` เป็น `0 17 * * 1-5` (หรือติ๊กเฉพาะ Mon-Fri ถ้า UI เป็นแบบ
เลือกวัน) — endpoint ไม่ validate ว่าถูกยิงมาวันไหน (เหมือนเดิม) เปลี่ยนที่ n8n อย่างเดียวพอ

### 6. เอกสาร

อัปเดต README หัวข้อ "ปฏิทินปฏิบัติงาน" ส่วนสรุปประจำวัน 17:00: บอกว่าไม่ส่งเสาร์-อาทิตย์
และศุกร์ครอบคลุมถึงจันทร์

## Testing

- `calendar-grid.test.ts`: `weekdayMonFirst` คืนค่าถูกต้องสำหรับวันจันทร์และวันอาทิตย์
  (ปลายทั้งสองข้างของ array THAI_DOW) อย่างน้อย
- `line-message.test.ts` (เคสใหม่สำหรับ `formatWeekendBridgeDigestMessage`):
  - 3 วันมีงานครบ → ขึ้นหัวข้อ 📅 ต่อวันถูกต้องตามลำดับ
  - วันใดวันหนึ่งว่าง → ขึ้น "ไม่มีงาน" เฉพาะวันนั้น วันอื่นไม่กระทบ
  - ทุกวันว่าง → ยังส่ง (เงียบ = ผิดปกติ เหมือนเดิม)
  - เกินเพดาน 5,000 ตัวอักษร → ความยาว ≤ 5000 และวันจันทร์ถูกตัดก่อนวันเสาร์
- `formatDailyDigestMessage` (ฟังก์ชันเดิม): ไม่แก้โค้ด ไม่ต้องเพิ่มเทสต์ เทสต์เดิมต้องผ่านเหมือนเดิม
  ทุกตัว (ยืนยันว่า path จันทร์-พฤหัสไม่กระทบ)
- endpoint `daily-digest.ts` เอง: ตามธรรมเนียมเดิมของไฟล์นี้ไม่มีเทสต์อัตโนมัติ (ต้องมี env/secret
  จริง) — ตรวจด้วยมือผ่าน n8n manual execution หรือปุ่มทดสอบใน `/admin/settings` ถ้ามี

## Out of scope

- ไม่เปลี่ยน logic การกรองสถานะงาน (`approved` เท่านั้น เหมือนเดิม)
- ไม่เปลี่ยน `CRON_SECRET`/rate-limit/auth ของ endpoint
- ไม่เพิ่ม timezone-aware cron ฝั่งแอป — schedule ยังอยู่ที่ n8n ที่เดียวตามเดิม
