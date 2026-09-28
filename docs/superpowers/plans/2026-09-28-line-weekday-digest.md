# LINE Weekday Digest (จันทร์-ศุกร์) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** จำกัดให้ endpoint `/api/cron/daily-digest` ทำงานแบบพิเศษเฉพาะวันศุกร์ — สรุปงานเสาร์+อาทิตย์+จันทร์รวมข้อความเดียว แทนที่จะสรุปแค่ "พรุ่งนี้" วันเดียวเหมือนวันอื่น — เพื่อให้ n8n หยุดยิงมาวันเสาร์-อาทิตย์ได้ (ประหยัดโควตาข้อความ LINE OA) โดยไม่มีวันจันทร์ที่ขาดการแจ้งเตือนล่วงหน้า

**Architecture:** เพิ่มฟังก์ชัน pure ใหม่สองตัว (`weekdayMonFirst` ใน `calendar-grid.ts`, `formatWeekendBridgeDigestMessage` ใน `line-message.ts`) แล้ว branch ต้น handler ของ endpoint ตาม "วันนี้เป็นศุกร์หรือไม่" — เส้นทางจันทร์-พฤหัสของเดิมไม่ถูกแก้เลยแม้แต่บรรทัดเดียว (ย้ายแค่ 1 บรรทัดตำแหน่ง `siteUrl` ขึ้นไปใช้ร่วมกันสองเส้นทาง)

**Tech Stack:** Next.js API route (Pages Router), TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-09-28-line-weekday-digest-design.md`

---

## File Structure

- Modify: `src/lib/calendar-grid.ts` — เพิ่ม `weekdayMonFirst(date): number`
- Modify: `src/lib/calendar-grid.test.ts` — เทสต์ของฟังก์ชันข้างบน
- Modify: `src/lib/line-message.ts` — เพิ่ม `formatWeekendBridgeDigestMessage(days, adminUrl?)` และ type `DailyDigestDay`
- Modify: `src/lib/line-message.test.ts` — เทสต์ของฟังก์ชันข้างบน
- Modify: `src/pages/api/cron/daily-digest.ts` — branch ตามวันศุกร์
- Modify: `README.md` — อัปเดตคำอธิบายหัวข้อ "ปฏิทินปฏิบัติงาน" ส่วนสรุปประจำวัน 17:00

---

### Task 1: `weekdayMonFirst` ใน calendar-grid.ts

**Files:**
- Modify: `src/lib/calendar-grid.test.ts`
- Modify: `src/lib/calendar-grid.ts`

- [ ] **Step 1: เพิ่มเทสต์ที่ล้มเหลว**

เปิด `src/lib/calendar-grid.test.ts` แก้บรรทัด import ด้านบนสุด จาก:

```ts
import {
  buildMonthGrid,
  currentMonthInBangkok,
  nextDate,
  parseMonth,
  shiftMonth,
  thaiMonthLabel,
  thaiShortDate,
  THAI_DOW,
  todayInBangkok,
  tomorrowInBangkok,
} from '@/lib/calendar-grid';
```

เป็น:

```ts
import {
  buildMonthGrid,
  currentMonthInBangkok,
  nextDate,
  parseMonth,
  shiftMonth,
  thaiMonthLabel,
  thaiShortDate,
  THAI_DOW,
  todayInBangkok,
  tomorrowInBangkok,
  weekdayMonFirst,
} from '@/lib/calendar-grid';
```

แล้วเพิ่ม describe block ใหม่ต่อท้ายไฟล์ (ก่อนวงเล็บปิดสุดท้ายของไฟล์ หรือแทรกเป็น
describe block แยกต่างหากที่ท้ายไฟล์เลยก็ได้):

```ts
describe('weekdayMonFirst', () => {
  // 2026-08-01 เป็นวันเสาร์ (ดูคอมเมนต์ buildMonthGrid ด้านบน) → 2026-08-03 คือจันทร์
  it('วันจันทร์คืน 0 (ตรงกับ THAI_DOW[0] = "จ")', () => {
    expect(weekdayMonFirst('2026-08-03')).toBe(0);
  });

  it('วันศุกร์คืน 4 (ตรงกับ THAI_DOW[4] = "ศ")', () => {
    expect(weekdayMonFirst('2026-08-07')).toBe(4);
  });

  it('วันอาทิตย์คืน 6 (ตรงกับ THAI_DOW[6] = "อา")', () => {
    expect(weekdayMonFirst('2026-08-02')).toBe(6);
  });
});
```

- [ ] **Step 2: รันเทสต์ยืนยันว่าล้มเหลว**

Run: `npm test -- calendar-grid`
Expected: FAIL — `weekdayMonFirst is not a function` หรือ import error ทำนองนี้

- [ ] **Step 3: เขียน implementation**

เปิด `src/lib/calendar-grid.ts` เพิ่มฟังก์ชันนี้ต่อท้ายไฟล์ (หลัง `tomorrowInBangkok`):

```ts
/** ลำดับวันในสัปดาห์แบบเริ่มจันทร์ (0=จ..6=อา) ให้ตรงกับ THAI_DOW — สูตรเดียวกับที่
 * buildMonthGrid ใช้ภายใน ดึงออกมาแยกเพราะตอนนี้มีผู้ใช้คนที่สอง (endpoint digest
 * ที่ต้องเช็คว่า "วันนี้" เป็นวันศุกร์หรือเปล่า — ดู daily-digest.ts)
 */
export function weekdayMonFirst(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}
```

- [ ] **Step 4: รันเทสต์ยืนยันว่าผ่าน**

Run: `npm test -- calendar-grid`
Expected: PASS ทุกเทสต์ในไฟล์ (ของเดิม + 3 เคสใหม่)

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar-grid.ts src/lib/calendar-grid.test.ts
git commit -m "feat(calendar): เพิ่ม weekdayMonFirst หาลำดับวันในสัปดาห์แบบเริ่มจันทร์"
```

---

### Task 2: `formatWeekendBridgeDigestMessage` ใน line-message.ts

**Files:**
- Modify: `src/lib/line-message.test.ts`
- Modify: `src/lib/line-message.ts`

- [ ] **Step 1: เพิ่มเทสต์ที่ล้มเหลว**

เปิด `src/lib/line-message.test.ts` แก้บรรทัด import แรกสุดจาก:

```ts
import { formatDailyDigestMessage } from '@/lib/line-message';
```

เป็น:

```ts
import {
  formatDailyDigestMessage,
  formatWeekendBridgeDigestMessage,
} from '@/lib/line-message';
```

แล้วเพิ่ม describe block ใหม่ต่อท้ายไฟล์ (หลัง describe('formatDailyDigestMessage', ...)
เดิมทั้งก้อน ก่อนวงเล็บปิดสุดท้าย ถ้ามี — เพิ่มเป็น top-level describe แยกก้อนใหม่):

```ts
describe('formatWeekendBridgeDigestMessage', () => {
  // 2026-09-05 เสาร์, 2026-09-06 อาทิตย์, 2026-09-07 จันทร์ (ต่อเนื่องจาก 2026-08-01
  // ที่เป็นวันเสาร์ — ดูคอมเมนต์ buildMonthGrid ในไฟล์ calendar-grid.test.ts)
  const BRIDGE_BASE: CalendarJob = {
    id: 'job-1',
    kind: 'ems',
    status: 'approved',
    date: '2026-09-05',
    time: '06:00',
    title: 'สมชาย ใจดี',
    village: 'ม.3 ต.น้ำแพร่',
    origin: 'บ้านที่อาศัย',
    destination: 'รพ.สวนดอก',
    phone: '0812345678',
    createdAt: '2026-09-04T11:00:00.000Z',
    createdBy: 'staff@example.com',
  };

  it('สามวันมีงานครบ — ขึ้นหัวข้อ 📅 ต่อวันตามลำดับเสาร์→อาทิตย์→จันทร์', () => {
    const days = [
      { date: '2026-09-05', jobs: [{ ...BRIDGE_BASE, id: 'sat', title: 'งานวันเสาร์' }] },
      { date: '2026-09-06', jobs: [{ ...BRIDGE_BASE, id: 'sun', title: 'งานวันอาทิตย์' }] },
      { date: '2026-09-07', jobs: [{ ...BRIDGE_BASE, id: 'mon', title: 'งานวันจันทร์' }] },
    ];
    const msg = formatWeekendBridgeDigestMessage(days, 'https://namphrae-portal.app');
    expect(msg).toContain('📅 ส. 5 ก.ย. 69');
    expect(msg).toContain('📅 อา. 6 ก.ย. 69');
    expect(msg).toContain('📅 จ. 7 ก.ย. 69');
    expect(msg.indexOf('งานวันเสาร์')).toBeLessThan(msg.indexOf('งานวันอาทิตย์'));
    expect(msg.indexOf('งานวันอาทิตย์')).toBeLessThan(msg.indexOf('งานวันจันทร์'));
    expect(msg).toContain('ไม่มีข้อความแจ้งเตือนวันเสาร์-อาทิตย์');
  });

  it('วันอาทิตย์ไม่มีงาน — ขึ้น "ไม่มีงาน" เฉพาะวันนั้น วันอื่นไม่กระทบ', () => {
    const days = [
      { date: '2026-09-05', jobs: [{ ...BRIDGE_BASE, id: 'sat' }] },
      { date: '2026-09-06', jobs: [] },
      { date: '2026-09-07', jobs: [{ ...BRIDGE_BASE, id: 'mon' }] },
    ];
    const msg = formatWeekendBridgeDigestMessage(days);
    expect(msg).toContain('📅 อา. 6 ก.ย. 69\nไม่มีงาน');
    expect(msg).toContain('🚑 สมชาย ใจดี');
  });

  it('ทุกวันว่าง — ยังส่งข้อความครบสามวัน (เงียบ = ผิดปกติ)', () => {
    const days = [
      { date: '2026-09-05', jobs: [] },
      { date: '2026-09-06', jobs: [] },
      { date: '2026-09-07', jobs: [] },
    ];
    const msg = formatWeekendBridgeDigestMessage(days);
    expect(msg).toBe(
      [
        '📋 สรุปตารางงานเสาร์-จันทร์นี้ (ไม่มีข้อความแจ้งเตือนวันเสาร์-อาทิตย์)',
        '📅 ส. 5 ก.ย. 69\nไม่มีงาน',
        '📅 อา. 6 ก.ย. 69\nไม่มีงาน',
        '📅 จ. 7 ก.ย. 69\nไม่มีงาน',
      ].join('\n\n')
    );
  });

  it('งานกระจุกวันจันทร์จนเกินเพดาน — เสาร์และอาทิตย์เห็นครบ จันทร์ถูกตัดพร้อมลิงก์', () => {
    const monMany: CalendarJob[] = Array.from({ length: 300 }, (_, i) => ({
      ...BRIDGE_BASE,
      id: `mon-${i}`,
      title: `งานทดสอบข้อความยาวลำดับที่ ${i} ของวันจันทร์`,
    }));
    const days = [
      { date: '2026-09-05', jobs: [{ ...BRIDGE_BASE, id: 'sat', title: 'งานวันเสาร์' }] },
      { date: '2026-09-06', jobs: [{ ...BRIDGE_BASE, id: 'sun', title: 'งานวันอาทิตย์' }] },
      { date: '2026-09-07', jobs: monMany },
    ];
    const msg = formatWeekendBridgeDigestMessage(days, 'https://namphrae-portal.app');
    expect(msg.length).toBeLessThanOrEqual(5000);
    expect(msg).toContain('งานวันเสาร์');
    expect(msg).toContain('งานวันอาทิตย์');
    expect(msg).toMatch(
      /📅 จ\. 7 ก\.ย\. 69\n\n🚑[\s\S]*…และอีก \d+ งาน ดูทั้งหมดที่ https:\/\/namphrae-portal\.app\/admin\/calendar$/
    );
  });
});
```

- [ ] **Step 2: รันเทสต์ยืนยันว่าล้มเหลว**

Run: `npm test -- line-message`
Expected: FAIL — `formatWeekendBridgeDigestMessage is not a function` หรือ import error

- [ ] **Step 3: เขียน implementation**

เปิด `src/lib/line-message.ts` แก้บรรทัด import แรกสุดจาก:

```ts
import { thaiShortDate } from '@/lib/calendar-grid';
```

เป็น:

```ts
import { thaiShortDate, THAI_DOW, weekdayMonFirst } from '@/lib/calendar-grid';
```

แล้วเพิ่มโค้ดนี้ต่อท้ายไฟล์ทั้งหมด (หลัง `formatDailyDigestMessage`):

```ts
export type DailyDigestDay = { date: string; jobs: CalendarJob[] };

/** สรุปตารางงานเสาร์+อาทิตย์+จันทร์ ส่งแทนที่ formatDailyDigestMessage เฉพาะตอน
 * "วันนี้" เป็นศุกร์ — n8n ไม่ยิงมาวันเสาร์-อาทิตย์แล้ว (ประหยัดโควตา LINE OA) ข้อความ
 * ศุกร์จึงต้องครอบคลุมงานวันจันทร์ไว้ด้วย ไม่งั้นงานจันทร์จะไม่มีใครถูกแจ้งเตือนล่วงหน้าเลย
 * (ดู docs/superpowers/specs/2026-09-28-line-weekday-digest-design.md)
 *
 * @param days เรียงเสาร์→อาทิตย์→จันทร์เสมอ (ผู้เรียกรับผิดชอบลำดับ ฟังก์ชันนี้ไม่ sort)
 * งานในแต่ละวันกรองสถานะ/เรียงมาแล้วเหมือน formatDailyDigestMessage
 */
export function formatWeekendBridgeDigestMessage(
  days: DailyDigestDay[],
  adminUrl?: string
): string {
  const intro =
    '📋 สรุปตารางงานเสาร์-จันทร์นี้ (ไม่มีข้อความแจ้งเตือนวันเสาร์-อาทิตย์)';

  const dayHeader = (date: string): string =>
    `📅 ${THAI_DOW[weekdayMonFirst(date)]}. ${thaiShortDate(date)}`;

  // count = งบจำนวนงานที่ยังแสดงได้รวมทุกวัน ไล่จ่ายตามลำดับ days (เสาร์ก่อน) — วัน
  // ท้าย ๆ (จันทร์) จึงโดนตัดก่อนเสมอเมื่องบไม่พอ เพราะใกล้ตัวกว่าควรเห็นครบก่อน (แนว
  // เดียวกับ build(count) ของ formatDailyDigestMessage แต่ขยายให้จ่ายงบข้ามวันได้)
  const build = (count: number): string => {
    let remaining = count;
    const sections: string[] = [intro];

    for (const day of days) {
      const header = dayHeader(day.date);
      if (day.jobs.length === 0) {
        sections.push(`${header}\nไม่มีงาน`);
        continue;
      }

      const take = Math.max(0, Math.min(day.jobs.length, remaining));
      remaining -= take;

      if (take === 0) {
        sections.push(
          adminUrl
            ? `${header}\n…และอีก ${day.jobs.length} งาน ดูทั้งหมดที่ ${adminUrl}/admin/calendar`
            : `${header}\n…และอีก ${day.jobs.length} งาน`
        );
        continue;
      }

      const blocks = day.jobs.slice(0, take).map(digestJobBlock).join('\n\n');
      let section = `${header}\n\n${blocks}`;
      if (take < day.jobs.length) {
        const rest = day.jobs.length - take;
        section += adminUrl
          ? `\n\n…และอีก ${rest} งาน ดูทั้งหมดที่ ${adminUrl}/admin/calendar`
          : `\n\n…และอีก ${rest} งาน`;
      }
      sections.push(section);
    }

    return sections.join('\n\n');
  };

  const totalJobs = days.reduce((n, d) => n + d.jobs.length, 0);
  if (totalJobs === 0) return build(0);

  for (let count = totalJobs; count > 1; count--) {
    const msg = build(count);
    if (msg.length <= LINE_TEXT_LIMIT) return msg;
  }
  // เหลืองานเดียวก็ยังเกินได้ในทางทฤษฎี (title ยาวผิดปกติ) — ยอมส่งตามนั้นเหมือน
  // formatDailyDigestMessage
  return build(1);
}
```

- [ ] **Step 4: รันเทสต์ยืนยันว่าผ่าน**

Run: `npm test -- line-message`
Expected: PASS ทุกเทสต์ในไฟล์ (ของเดิมทั้งหมด + 4 เคสใหม่) — เทสต์เดิมของ
`formatDailyDigestMessage` ต้องผ่านเหมือนเดิมทุกตัว (ยืนยันว่าไม่ถูกแก้กระทบ)

- [ ] **Step 5: Commit**

```bash
git add src/lib/line-message.ts src/lib/line-message.test.ts
git commit -m "feat(line): เพิ่ม formatWeekendBridgeDigestMessage สรุปเสาร์-จันทร์เป็นข้อความเดียว"
```

---

### Task 3: ต่อสายเข้า endpoint `/api/cron/daily-digest`

**Files:**
- Modify: `src/pages/api/cron/daily-digest.ts`

- [ ] **Step 1: แก้ไฟล์ทั้งไฟล์**

แทนที่เนื้อหาทั้งไฟล์ `src/pages/api/cron/daily-digest.ts` ด้วยโค้ดนี้ (เหมือนเดิมทุก
บรรทัดในส่วน auth/rate-limit และเส้นทางจันทร์-พฤหัส ย้ายแค่บรรทัด `siteUrl` ขึ้นมาก่อน
branch ใหม่เพื่อใช้ร่วมกันสองเส้นทาง):

```ts
import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  nextDate,
  todayInBangkok,
  tomorrowInBangkok,
  weekdayMonFirst,
} from '@/lib/calendar-grid';
import { listJobs } from '@/lib/jobs-store';
import {
  formatDailyDigestMessage,
  formatWeekendBridgeDigestMessage,
} from '@/lib/line-message';
import { pushGroupText } from '@/lib/line';
import { clientIp, rateLimit } from '@/lib/rate-limit';

// POST /api/cron/daily-digest — n8n ยิง จ-ศ 17:00 ไทย (Schedule Trigger →
// HTTP Request) สรุปตารางงานเข้ากลุ่ม LINE เจ้าหน้าที่ — ศุกร์สรุปเสาร์+อาทิตย์+
// จันทร์รวมข้อความเดียว (n8n ไม่ยิงมาวันเสาร์-อาทิตย์ ประหยัดโควตา LINE OA)
//
// จงใจไม่ตั้ง cron ที่ Railway — ผู้ดูแลอยากเห็น/แก้ตารางเวลาที่ n8n ที่เดียว
// และ n8n เห็นประวัติ run สำเร็จ/ล้มเหลวเป็น dashboard ในตัว

// เทียบผ่าน hash ก่อนเพราะ timingSafeEqual โยนเมื่อความยาวไม่เท่ากัน (แนว
// เดียวกับ line-signature.ts ที่กันด้วยเช็ค length — ที่นี่ hash ให้เท่ากันเสมอ
// แทน จะได้ไม่มี early return ตามความยาวของ secret)
function secretMatches(header: unknown, secret: string): boolean {
  if (typeof header !== 'string' || !header) return false;
  const a = crypto.createHash('sha256').update(header).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  // ตัวกันหยาบ ๆ กัน brute-force secret — in-memory ต่อ instance เหมือนกับ
  // rate-limit ใน webhook.ts ไม่ใช่การรับประกันแบบแข็ง แต่ดีกว่าไม่มีเลย
  if (!rateLimit(`cron-digest:${clientIp(req)}`, 30, 60_000)) {
    return res.status(429).end();
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // ไม่ตั้ง env = feature ปิดอยู่โดยเจตนา — 503 แยกจาก 401 (secret ผิด)
    // แนวเดียวกับ webhook LINE ที่แยกสองกรณีนี้ให้ debug ได้
    console.warn('daily-digest ถูกเรียกแต่ยังไม่ได้ตั้ง CRON_SECRET');
    return res.status(503).end();
  }
  if (!secretMatches(req.headers['x-cron-secret'], secret)) {
    return res.status(401).end();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');

  // ศุกร์: n8n ไม่ยิงมาวันเสาร์-อาทิตย์แล้ว ข้อความศุกร์จึงต้องครอบคลุมเสาร์+
  // อาทิตย์+จันทร์ ไม่งั้นงานวันจันทร์จะไม่มีใครถูกแจ้งเตือนล่วงหน้าเลย (ดู spec
  // docs/superpowers/specs/2026-09-28-line-weekday-digest-design.md)
  if (weekdayMonFirst(todayInBangkok()) === 4) {
    const sat = tomorrowInBangkok();
    const sun = nextDate(sat);
    const mon = nextDate(sun);
    const dates = [sat, sun, mon];
    const days = await Promise.all(
      dates.map(async (date) => ({
        date,
        jobs: (await listJobs({ month: date.slice(0, 7) })).filter(
          (j) => j.date === date && j.status === 'approved'
        ),
      }))
    );
    const jobCount = days.reduce((n, d) => n + d.jobs.length, 0);
    const sent = await pushGroupText(
      formatWeekendBridgeDigestMessage(days, siteUrl)
    );
    if (!sent) {
      return res.status(502).json({ sent: false, dates, jobs: jobCount });
    }
    return res.status(200).json({ sent: true, dates, jobs: jobCount });
  }

  const date = tomorrowInBangkok();
  // JobFilter กรองได้แค่ month — กรอง date/สถานะที่นี่ (งานต่อเดือนมีน้อย)
  // listJobs เรียง (date, time, createdAt, id) มาแล้ว formatter ใช้ลำดับนั้นตรง ๆ
  //
  // เฉพาะงานที่อนุมัติแล้ว: กลุ่ม LINE คือเจ้าหน้าที่หน้างานที่ต้องรู้ว่าพรุ่งนี้
  // ต้องไปไหน ไม่ใช่ที่ทวงงานค้างของแอดมิน — งานรออนุมัติเตือนที่หน้าจอหลังบ้าน
  // แทน (badge ข้าง "ปฏิทินปฏิบัติงาน") ไม่ปนเข้ามาในตารางที่คนหน้างานอ่าน
  const jobs = (await listJobs({ month: date.slice(0, 7) })).filter(
    (j) => j.date === date && j.status === 'approved'
  );

  const sent = await pushGroupText(formatDailyDigestMessage(jobs, date, siteUrl));

  // ส่งไม่ออก → 502 ให้ run ใน n8n ขึ้น fail มองเห็นได้ ไม่เงียบหาย (สาเหตุจริง
  // อยู่ใน log: token หาย / groupId หาย / LINE ล่ม / ยังไม่ได้ตั้งค่า LINE เลย —
  // ทั้งหมดนี้ pushGroupText กลืนแล้วคืน false เหมือนกัน จึงแยกจาก 503 ของ
  // endpoint นี้เองไม่ได้ เห็น 502 ต้องไปเช็ค log) ส่วน listJobs โยน (เช่น
  // Mongo ล่ม) ปล่อยให้ Next ตอบ 500 — n8n เห็น fail เหมือนกัน
  if (!sent) return res.status(502).json({ sent: false, date, jobs: jobs.length });
  return res.status(200).json({ sent: true, date, jobs: jobs.length });
}
```

- [ ] **Step 2: รันเทสต์ทั้งหมดและ type-check**

Run: `npm test`
Expected: PASS ทุกไฟล์ (ไม่มีเทสต์อัตโนมัติสำหรับ endpoint นี้โดยตรงตามธรรมเนียมเดิม —
รันเพื่อยืนยันว่าไฟล์อื่นไม่พังจากการแก้ import)

Run: `npx tsc --noEmit`
Expected: ไม่มี type error

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/cron/daily-digest.ts
git commit -m "feat(cron): ศุกร์สรุปเสาร์+อาทิตย์+จันทร์รวมข้อความเดียว"
```

---

### Task 4: อัปเดต README

**Files:**
- Modify: `README.md:231-239`

- [ ] **Step 1: แก้ข้อความ**

แทนที่บล็อกนี้ในไฟล์ `README.md` (บรรทัด 231-239) จาก:

```markdown
### สรุปตารางงานประจำวัน (17:00)

ทุกวัน 17:00 ระบบส่งสรุป**งานของวันพรุ่งนี้** (อนุมัติแล้ว + รออนุมัติ) เข้ากลุ่ม LINE
— วันว่างก็ส่ง "ไม่มีงานในตาราง" เสมอ (เงียบ = ผิดปกติ) นี่คือแจ้งเตือน LINE
ช่องทางเดียวของระบบ (นอกจากปุ่มส่งข้อความทดสอบที่ `/admin/settings`)

ตัวตั้งเวลาอยู่ที่ **n8n** (workflow "แจ้งตารางงานพรุ่งนี้เข้ากลุ่ม LINE") ไม่ใช่ cron
ของ Railway — n8n ยิง `POST /api/cron/daily-digest` พร้อม header `x-cron-secret`
ทุกวัน จะแก้เวลา/หยุดชั่วคราว ทำที่ n8n ที่เดียว
```

เป็น:

```markdown
### สรุปตารางงานประจำวัน (17:00)

จันทร์-ศุกร์ 17:00 ระบบส่งสรุป**งานของวันพรุ่งนี้** (เฉพาะที่อนุมัติแล้ว) เข้ากลุ่ม LINE
— วันว่างก็ส่ง "ไม่มีงานในตาราง" เสมอ (เงียบ = ผิดปกติ) นี่คือแจ้งเตือน LINE
ช่องทางเดียวของระบบ (นอกจากปุ่มส่งข้อความทดสอบที่ `/admin/settings`)

เสาร์-อาทิตย์ไม่มีข้อความ (ประหยัดโควตา LINE OA) แต่ข้อความ**ศุกร์**สรุปรวมเสาร์+อาทิตย์+
จันทร์ไว้ในข้อความเดียว แยกส่วนตามวัน เพื่อให้งานวันจันทร์ยังมีคนเห็นล่วงหน้า

ตัวตั้งเวลาอยู่ที่ **n8n** (workflow "แจ้งตารางงานพรุ่งนี้เข้ากลุ่ม LINE") ไม่ใช่ cron
ของ Railway — n8n ยิง `POST /api/cron/daily-digest` พร้อม header `x-cron-secret`
จันทร์-ศุกร์ จะแก้เวลา/หยุดชั่วคราว ทำที่ n8n ที่เดียว
```

หมายเหตุ: บรรทัด "(อนุมัติแล้ว + รออนุมัติ)" เดิมผิดอยู่แล้วก่อนหน้านี้ — โค้ดปัจจุบันกรอง
เฉพาะ `status === 'approved'` เท่านั้น (งานรออนุมัติถูกถอดออกจาก LINE digest ไปแจ้งที่
badge ในหน้าแอดมินแทนตั้งแต่ 2026-08-12) แก้ให้ตรงกับพฤติกรรมจริงไปพร้อมกันในนี้เลย

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: อัปเดตคำอธิบาย daily digest เป็นจันทร์-ศุกร์"
```

---

## Manual follow-up (นอกแผนนี้ — ไม่มอบให้ subagent)

หลังโค้ดทุก Task ผ่านและ merge แล้ว ต้องแก้ **n8n workflow `IUVpQvZsVanXHTXV`**
("แจ้งตารางงานพรุ่งนี้เข้ากลุ่ม LINE") เอง — เปลี่ยน Schedule Trigger จาก `0 17 * * *`
เป็น `0 17 * * 1-5` (หรือติ๊กเฉพาะ Mon-Fri ถ้า UI เป็นแบบเลือกวัน) นี่คือการแก้ระบบ
production ที่มีผลจริงกับผู้ใช้งาน จึงทำเองพร้อมยืนยันกับผู้ใช้ ไม่ผ่าน subagent
