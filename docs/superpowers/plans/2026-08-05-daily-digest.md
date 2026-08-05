# Daily LINE Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ส่งสรุปตารางงานของวันพรุ่งนี้เข้ากลุ่ม LINE เจ้าหน้าที่ทุก 17:00 เวลาไทย โดย n8n เป็นตัวตั้งเวลายิง HTTP มาที่ endpoint ใหม่

**Architecture:** endpoint `POST /api/cron/daily-digest` (secret header) ดึงงานพรุ่งนี้จาก jobs store → จัดข้อความด้วย pure formatter ใหม่ใน `line-message.ts` → ส่งผ่าน `pushGroupText` ที่ refactor จาก `pushNewJobNotice` เดิม ฝั่ง n8n มีแค่ Schedule Trigger → HTTP Request

**Tech Stack:** Next.js (pages router), vitest, LINE Messaging API, n8n (ผ่าน MCP)

**Spec:** `docs/superpowers/specs/2026-08-05-daily-digest-design.md`

ข้อเท็จจริงของโค้ดที่ plan นี้อิง (ตรวจแล้ววันที่เขียน):

- `listJobs(filter)` ใน `src/lib/jobs-store.ts:146` **คืนงานเรียงตาม (date, time, createdAt, id) แล้วเสมอ** ทั้ง backend ไฟล์และ Mongo — ผู้เรียกไม่ต้อง sort ซ้ำ
- `JobFilter` (`src/lib/jobs-store.ts:38`) กรองได้แค่ `month` + `status` เดียว — การกรอง date/สองสถานะทำที่ endpoint
- `thaiShortDate('2026-08-06')` → `'6 ส.ค. 69'` (ไม่มีวันในสัปดาห์)
- `KIND_EMOJI` เป็น const ภายใน `src/lib/line-message.ts` (ems 🚑, rescue 🚨, fallback 🔔)
- `pad()` เป็น helper ภายใน `src/lib/calendar-grid.ts` ใช้ได้จากฟังก์ชันใหม่ในไฟล์เดียวกัน
- แนว timing-safe เทียบ secret: ดู `src/lib/line-signature.ts` (timingSafeEqual โยนเมื่อความยาวไม่เท่ากัน ต้องกันก่อน)

---

### Task 1: `nextDate` + `tomorrowInBangkok` ใน calendar-grid

**Files:**
- Modify: `src/lib/calendar-grid.ts` (ต่อท้ายไฟล์ ใต้ `currentMonthInBangkok`)
- Test: `src/lib/calendar-grid.test.ts` (ต่อท้ายไฟล์)

- [ ] **Step 1: เขียนเทสต์ที่ fail**

ต่อท้าย `src/lib/calendar-grid.test.ts` (เพิ่ม `nextDate` เข้า import เดิมจาก `@/lib/calendar-grid`):

```ts
describe('nextDate — บวกหนึ่งวันบน UTC ล้วน ไม่ผ่าน timezone ของเครื่อง', () => {
  it('กลางเดือน', () => {
    expect(nextDate('2026-08-05')).toBe('2026-08-06');
  });

  it('ข้ามสิ้นเดือน', () => {
    expect(nextDate('2026-08-31')).toBe('2026-09-01');
  });

  it('ข้ามสิ้นปี', () => {
    expect(nextDate('2026-12-31')).toBe('2027-01-01');
  });

  it('ปีอธิกสุรทิน — 28 ก.พ. ไป 29 ก.พ.', () => {
    expect(nextDate('2028-02-28')).toBe('2028-02-29');
  });

  it('ปีปกติ — 28 ก.พ. ไป 1 มี.ค.', () => {
    expect(nextDate('2026-02-28')).toBe('2026-03-01');
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/calendar-grid.test.ts`
Expected: FAIL — `nextDate` is not exported

- [ ] **Step 3: implement**

ต่อท้าย `src/lib/calendar-grid.ts`:

```ts
/**
 * '2026-08-31' → '2026-09-01' — เลขคณิตบน Date.UTC ล้วน ไม่แตะ local timezone
 * ของเครื่อง (server อาจไม่ได้ตั้ง TZ เป็นไทย) Date.UTC จัดการข้ามเดือน/ปี/
 * อธิกสุรทินให้เอง
 */
export function nextDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** วันพรุ่งนี้ตามเวลาไทย — ใช้ตัดสินว่า digest 17:00 ต้องสรุปงานของวันไหน */
export function tomorrowInBangkok(): string {
  return nextDate(todayInBangkok());
}
```

(`tomorrowInBangkok` เป็นแค่ composition ของสองฟังก์ชันที่มีเทสต์/พฤติกรรมนิ่งแล้ว — ไม่เทสต์แยกเพราะผูกกับนาฬิกาจริง)

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run src/lib/calendar-grid.test.ts`
Expected: PASS ทุกข้อ

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar-grid.ts src/lib/calendar-grid.test.ts
git commit -m "feat(calendar): nextDate + tomorrowInBangkok for the daily digest"
```

---

### Task 2: formatter `formatDailyDigestMessage`

**Files:**
- Modify: `src/lib/line-message.ts` (ต่อท้ายไฟล์)
- Test: `src/lib/line-message.test.ts` (ต่อท้ายไฟล์)

สัญญาของฟังก์ชัน: ผู้เรียกส่ง**เฉพาะงานของวันพรุ่งนี้สถานะ approved + pending
ที่เรียงลำดับแล้ว** (`listJobs` เรียงมาให้อยู่แล้ว) formatter ไม่ sort เอง ไม่กรองเอง —
แบบเดียวกับ `formatNewJobMessage` ที่รับข้อมูลพร้อมใช้

- [ ] **Step 1: เขียนเทสต์ที่ fail**

ต่อท้าย `src/lib/line-message.test.ts` (เพิ่ม `formatDailyDigestMessage` เข้า import เดิม — ไฟล์นี้มี fixture `BASE: CalendarJob` อยู่แล้ว status `pending`):

```ts
describe('formatDailyDigestMessage', () => {
  const APPROVED: CalendarJob = { ...BASE, id: 'a1', status: 'approved' };

  it('มีทั้งอนุมัติแล้วและรออนุมัติ — สองส่วน มีลิงก์ท้ายส่วนรออนุมัติ', () => {
    const jobs: CalendarJob[] = [
      { ...APPROVED, time: '06:00', title: 'ส่งผู้ป่วยฟอกไต' },
      {
        ...APPROVED,
        id: 'a2',
        kind: 'rescue',
        time: '14:00',
        title: 'ตัดต้นไม้ล้ม',
        village: 'ม.5 ต.น้ำแพร่',
      },
      { ...BASE, id: 'p1', time: '09:00', title: 'รับผู้ป่วยกลับบ้าน' },
    ];
    expect(
      formatDailyDigestMessage(jobs, '2026-08-06', 'https://namphrae-portal.app')
    ).toBe(
      [
        '📋 ตารางงานพรุ่งนี้ — 6 ส.ค. 69',
        '🚑 06:00 ส่งผู้ป่วยฟอกไต (ม.3 ต.น้ำแพร่)',
        '🚨 14:00 ตัดต้นไม้ล้ม (ม.5 ต.น้ำแพร่)',
        '',
        '⏳ รออนุมัติ 1 งาน — รีบอนุมัติก่อนถึงวันงาน',
        '🚑 09:00 รับผู้ป่วยกลับบ้าน (ม.3 ต.น้ำแพร่)',
        '👉 https://namphrae-portal.app/admin/calendar',
      ].join('\n')
    );
  });

  it('วันว่าง — ข้อความบรรทัดเดียว', () => {
    expect(formatDailyDigestMessage([], '2026-08-06')).toBe(
      '📋 พรุ่งนี้ (6 ส.ค. 69) ไม่มีงานในตาราง'
    );
  });

  it('ไม่มีงานรออนุมัติ — ไม่มีส่วนรออนุมัติและไม่มีลิงก์', () => {
    const msg = formatDailyDigestMessage(
      [APPROVED],
      '2026-08-06',
      'https://namphrae-portal.app'
    );
    expect(msg).not.toContain('รออนุมัติ');
    expect(msg).not.toContain('👉');
  });

  it('ไม่มี adminUrl — ส่วนรออนุมัติยังขึ้น แค่ไม่มีบรรทัดลิงก์', () => {
    const msg = formatDailyDigestMessage([{ ...BASE, id: 'p1' }], '2026-08-06');
    expect(msg).toContain('⏳ รออนุมัติ 1 งาน');
    expect(msg).not.toContain('👉');
  });

  it('ไม่มีหมู่บ้าน — ไม่มีวงเล็บว่าง', () => {
    const msg = formatDailyDigestMessage(
      [{ ...APPROVED, village: '' }],
      '2026-08-06'
    );
    expect(msg).not.toContain('()');
  });

  it('kind นอกตาราง (ข้อมูลเสียจาก storage) — fallback 🔔 ไม่ใช่ undefined', () => {
    const msg = formatDailyDigestMessage(
      [{ ...APPROVED, kind: 'flood' as CalendarJob['kind'] }],
      '2026-08-06'
    );
    expect(msg).toContain('🔔');
    expect(msg).not.toContain('undefined');
  });

  it('ข้อความเกินเพดาน LINE — ตัดงานท้าย ๆ แล้วปิดด้วยจำนวนที่เหลือ', () => {
    const many: CalendarJob[] = Array.from({ length: 300 }, (_, i) => ({
      ...APPROVED,
      id: `a${i}`,
      title: `งานทดสอบข้อความยาวลำดับที่ ${i} ของวันพรุ่งนี้`,
    }));
    const msg = formatDailyDigestMessage(
      many,
      '2026-08-06',
      'https://namphrae-portal.app'
    );
    expect(msg.length).toBeLessThanOrEqual(5000);
    expect(msg).toMatch(/…และอีก \d+ งาน ดูทั้งหมดที่ https:\/\/namphrae-portal\.app\/admin\/calendar$/);
  });

  it('ข้อความเกินเพดานและไม่มี adminUrl — บรรทัดปิดไม่มีลิงก์', () => {
    const many: CalendarJob[] = Array.from({ length: 300 }, (_, i) => ({
      ...APPROVED,
      id: `a${i}`,
      title: `งานทดสอบข้อความยาวลำดับที่ ${i} ของวันพรุ่งนี้`,
    }));
    const msg = formatDailyDigestMessage(many, '2026-08-06');
    expect(msg.length).toBeLessThanOrEqual(5000);
    expect(msg).toMatch(/…และอีก \d+ งาน$/);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่า fail**

Run: `npx vitest run src/lib/line-message.test.ts`
Expected: FAIL — `formatDailyDigestMessage` is not exported

- [ ] **Step 3: implement**

ต่อท้าย `src/lib/line-message.ts`:

```ts
// เพดานข้อความ text ของ LINE Messaging API — เกินแล้ว push ทั้งก้อนโดน 400
const LINE_TEXT_LIMIT = 5000;

function digestJobLine(job: CalendarJob): string {
  const head = `${KIND_EMOJI[job.kind] ?? '🔔'} ${job.time} ${job.title}`;
  return job.village ? `${head} (${job.village})` : head;
}

/** สรุปตารางงานพรุ่งนี้ ส่งเข้ากลุ่มทุก 17:00 (ดู /api/cron/daily-digest)
 *
 * @param jobs งานของวันนั้นสถานะ approved + pending เรียงลำดับแล้ว (listJobs
 * เรียง (date, time, createdAt, id) มาให้อยู่แล้ว) — ฟังก์ชันนี้ไม่กรอง/ไม่ sort
 * @param adminUrl origin ของพอร์ทัล — ไม่ใส่ก็ไม่มีบรรทัดลิงก์ (แนวเดียวกับ
 * formatNewJobMessage)
 */
export function formatDailyDigestMessage(
  jobs: CalendarJob[],
  dateISO: string,
  adminUrl?: string
): string {
  const dateLabel = thaiShortDate(dateISO);
  // ส่งทุกวันแม้วันว่าง — เงียบ = ผิดปกติ ไม่ใช่ไม่มีงาน (ตัดสินใจใน spec)
  if (jobs.length === 0) return `📋 พรุ่งนี้ (${dateLabel}) ไม่มีงานในตาราง`;

  // ประกอบจากงาน count รายการแรก — ถ้ายาวเกินเพดาน ตัดงานท้าย ๆ ออกทีละงาน
  // แล้วปิดด้วยบรรทัด "…และอีก N งาน" แทนการปล่อยให้ LINE ปฏิเสธทั้งข้อความ
  const build = (count: number): string => {
    const shown = jobs.slice(0, count);
    const approved = shown.filter((j) => j.status !== 'pending');
    const pending = shown.filter((j) => j.status === 'pending');

    const sections: string[] = [
      [`📋 ตารางงานพรุ่งนี้ — ${dateLabel}`, ...approved.map(digestJobLine)].join('\n'),
    ];
    if (pending.length > 0) {
      const lines = [
        `⏳ รออนุมัติ ${pending.length} งาน — รีบอนุมัติก่อนถึงวันงาน`,
        ...pending.map(digestJobLine),
      ];
      if (adminUrl) lines.push(`👉 ${adminUrl}/admin/calendar`);
      sections.push(lines.join('\n'));
    }
    if (count < jobs.length) {
      const rest = jobs.length - count;
      sections.push(
        adminUrl
          ? `…และอีก ${rest} งาน ดูทั้งหมดที่ ${adminUrl}/admin/calendar`
          : `…และอีก ${rest} งาน`
      );
    }
    return sections.join('\n\n');
  };

  for (let count = jobs.length; count > 1; count--) {
    const msg = build(count);
    if (msg.length <= LINE_TEXT_LIMIT) return msg;
  }
  // เหลืองานเดียวก็ยังเกินได้ในทางทฤษฎี (title ยาวผิดปกติ) — ยอมส่งตามนั้น
  // ให้ pushGroupText รายงาน 400 ใน log ดีกว่าเงียบหาย
  return build(1);
}
```

หมายเหตุ: บรรทัดว่างคั่น section มาจาก `join('\n\n')` — เทสต์ข้อแรกจึงมี `''` ในอาเรย์

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run src/lib/line-message.test.ts`
Expected: PASS ทุกข้อ (ของเดิม `formatNewJobMessage` ต้องยังผ่านครบ)

- [ ] **Step 5: Commit**

```bash
git add src/lib/line-message.ts src/lib/line-message.test.ts
git commit -m "feat(calendar): daily digest message formatter"
```

---

### Task 3: refactor `pushNewJobNotice` → แยก `pushGroupText`

**Files:**
- Modify: `src/lib/line.ts:45-109` (docblock + ฟังก์ชัน `pushNewJobNotice` ทั้งก้อน)

ไม่มีเทสต์ใหม่ — เป็นการย้ายโค้ด I/O ที่พฤติกรรมเดิมต้องไม่เปลี่ยน (คอมเมนต์เดิมย้ายตามไปด้วย) ตัวยืนยันคือ tsc + เทสต์เดิมทั้งชุด

- [ ] **Step 1: แทนที่ `pushNewJobNotice` เดิมทั้งฟังก์ชัน (บรรทัด 45-109) ด้วยสองฟังก์ชันนี้**

```ts
/**
 * ส่งข้อความ text เข้ากลุ่มเจ้าหน้าที่ — best effort ไม่โยน error ออกไป
 *
 * ทางส่งข้อความเดียวของระบบ ใช้ทั้งแจ้งงานใหม่ (pushNewJobNotice) และสรุป
 * ประจำวัน (/api/cron/daily-digest) — token/groupId/timeout อยู่ที่นี่ที่เดียว
 *
 * @returns true เมื่อข้อความออกไปจริง
 */
export async function pushGroupText(text: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn('LINE push ข้าม: ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN');
    return false;
  }

  let to: string | undefined;
  try {
    to = await getLineGroupId();
  } catch (err) {
    console.warn('LINE push ข้าม: อ่าน config ไม่ได้', err);
    return false;
  }
  if (!to) {
    console.warn('LINE push ข้าม: ยังไม่มี groupId — เชิญบอท OA เข้ากลุ่มก่อน');
    return false;
  }

  try {
    const res = await fetch(PUSH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      // ไม่มีใครควรนั่งรอผลของ noti — ตั้ง timeout สั้น ๆ กัน LINE ค้างแล้วลาก
      // request ของผู้เรียก (บันทึกงาน / cron) ให้ค้างตาม
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text }],
      }),
    });
    if (!res.ok) {
      console.warn(`LINE push ล้มเหลว: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('LINE push ล้มเหลว', err);
    return false;
  }
}

/**
 * แจ้งกลุ่มเจ้าหน้าที่ว่ามีงานใหม่ — best effort เหมือน pushGroupText
 *
 * งานถูกบันทึกลงฐานข้อมูลไปแล้วก่อนถึงบรรทัดนี้ LINE ล่มจึงต้องไม่ทำให้คำขอ
 * ล้มเหลวและงานหาย ผู้เรียกเอาค่าที่คืนไปบอกผู้ใช้ว่าส่งแจ้งเตือนไม่สำเร็จ
 */
export async function pushNewJobNotice(job: CalendarJob): Promise<boolean> {
  // ตัด / ท้าย URL ทิ้ง — ค่าที่ก๊อปมาจากช่อง address bar มักติดมาด้วย แล้วจะได้
  // ลิงก์ //admin/calendar ที่บาง host ยอม บาง host ตอบ 404 พังไม่เหมือนกันทุกที่
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  // ส่ง base URL เข้าไปให้ formatter เติมลิงก์ท้ายข้อความ — ไม่ตั้ง env ก็แค่
  // ไม่มีบรรทัดลิงก์ ข้อความอื่นเหมือนเดิม ตัวแจ้งเตือนมีไว้ให้คนกดเข้าไปอนุมัติ
  return pushGroupText(formatNewJobMessage(job, siteUrl));
}
```

- [ ] **Step 2: ตรวจว่าไม่พังอะไร**

Run: `npx tsc --noEmit && npm test`
Expected: tsc เงียบ, เทสต์ 8 ไฟล์ผ่านครบ (103+ ข้อ)

- [ ] **Step 3: Commit**

```bash
git add src/lib/line.ts
git commit -m "refactor(calendar): extract pushGroupText from pushNewJobNotice"
```

---

### Task 4: endpoint `POST /api/cron/daily-digest`

**Files:**
- Create: `src/pages/api/cron/daily-digest.ts`

logic ทั้งหมดอยู่ใน pure function ที่มีเทสต์แล้ว (Task 1, 2) — endpoint เหลือแค่
auth + ต่อท่อ จึงไม่มี unit test (โปรเจกต์ไม่มี API test harness) ตรวจด้วย tsc +
manual curl ตอน dev

- [ ] **Step 1: สร้างไฟล์**

```ts
import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { tomorrowInBangkok } from '@/lib/calendar-grid';
import { listJobs } from '@/lib/jobs-store';
import { formatDailyDigestMessage } from '@/lib/line-message';
import { pushGroupText } from '@/lib/line';

// POST /api/cron/daily-digest — n8n ยิงทุก 17:00 ไทย (Schedule Trigger →
// HTTP Request) สรุปตารางงานพรุ่งนี้เข้ากลุ่ม LINE เจ้าหน้าที่
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

  const date = tomorrowInBangkok();
  // JobFilter กรองได้แค่ month — กรอง date/สถานะที่นี่ (งานต่อเดือนมีน้อย)
  // listJobs เรียง (date, time, createdAt, id) มาแล้ว formatter ใช้ลำดับนั้นตรง ๆ
  const jobs = (await listJobs({ month: date.slice(0, 7) })).filter(
    (j) => j.date === date && (j.status === 'approved' || j.status === 'pending')
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  const sent = await pushGroupText(formatDailyDigestMessage(jobs, date, siteUrl));

  // ส่งไม่ออก → 502 ให้ run ใน n8n ขึ้น fail มองเห็นได้ ไม่เงียบหาย (สาเหตุจริง
  // อยู่ใน log: token หาย / groupId หาย / LINE ล่ม) ส่วน listJobs โยน (เช่น
  // Mongo ล่ม) ปล่อยให้ Next ตอบ 500 — n8n เห็น fail เหมือนกัน
  if (!sent) return res.status(502).json({ sent: false, date, jobs: jobs.length });
  return res.status(200).json({ sent: true, date, jobs: jobs.length });
}
```

- [ ] **Step 2: ตรวจ type + เทสต์เดิม**

Run: `npx tsc --noEmit && npm test`
Expected: ผ่านหมด

- [ ] **Step 3: ทดสอบ auth ตอน dev (ยังไม่ส่งจริง)**

```bash
# terminal 1
npm run dev
# terminal 2 — ยังไม่ตั้ง CRON_SECRET ใน .env.local → ต้องได้ 503
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/cron/daily-digest
# → 503
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/cron/daily-digest
# (GET) → 405
```

จากนั้นเพิ่ม `CRON_SECRET=test-secret` ใน `.env.local` → restart dev →

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'x-cron-secret: wrong' http://localhost:3000/api/cron/daily-digest
# → 401
```

**อย่ายิงด้วย secret ถูกในขั้นนี้** — จะส่งข้อความจริงเข้ากลุ่ม การส่งจริงทำครั้งเดียวตอนทดสอบ n8n (Task 7)

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/cron/daily-digest.ts
git commit -m "feat(calendar): daily digest cron endpoint for n8n"
```

---

### Task 5: env + เอกสาร

**Files:**
- Modify: `.env.example` (ต่อท้ายไฟล์ ใต้ block `NEXT_PUBLIC_SITE_URL`)
- Modify: `README.md` (ต่อท้าย section `### ตั้งค่า LINE` ราวบรรทัด 213 ก่อน `## Scripts`)

- [ ] **Step 1: ต่อท้าย `.env.example`**

```
# secret ของ endpoint สรุปตารางงานประจำวัน (POST /api/cron/daily-digest) —
# n8n ยิงมาทุก 17:00 พร้อม header `x-cron-secret` ค่าเดียวกันนี้
# ต้องตั้ง "สองที่ให้ตรงกัน": ที่นี่ (Railway) และใน HTTP Request node ของ n8n
# ไม่ตั้ง = ปิด feature นี้ (endpoint ตอบ 503) ระบบอื่นทำงานปกติ
# วิธี generate: openssl rand -hex 32
CRON_SECRET=
```

- [ ] **Step 2: เพิ่มหัวข้อใน README ต่อจาก section ตั้งค่า LINE (ก่อน `## Scripts`)**

```markdown
### สรุปตารางงานประจำวัน (17:00)

ทุกวัน 17:00 ระบบส่งสรุป**งานของวันพรุ่งนี้** (อนุมัติแล้ว + รออนุมัติ) เข้ากลุ่ม LINE
เดียวกับแจ้งเตือนงานใหม่ — วันว่างก็ส่ง "ไม่มีงานในตาราง" เสมอ (เงียบ = ผิดปกติ)

ตัวตั้งเวลาอยู่ที่ **n8n** (workflow "แจ้งตารางงานพรุ่งนี้เข้ากลุ่ม LINE") ไม่ใช่ cron
ของ Railway — n8n ยิง `POST /api/cron/daily-digest` พร้อม header `x-cron-secret`
ทุกวัน จะแก้เวลา/หยุดชั่วคราว ทำที่ n8n ที่เดียว

ตั้งค่า: generate secret (`openssl rand -hex 32`) → ใส่ `CRON_SECRET` ใน Railway
และใน header ของ HTTP Request node ที่ n8n ให้ตรงกัน · ถ้า run ใน n8n ขึ้น fail:
502 = LINE ส่งไม่ออก (ดู log ที่ Railway — token/groupId หาย), 401 = secret สองที่
ไม่ตรงกัน, 503 = ยังไม่ได้ตั้ง `CRON_SECRET` ที่ Railway
```

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: CRON_SECRET + daily digest runbook"
```

---

### Task 6: push + ตั้ง secret ฝั่ง Railway

**Files:** ไม่มีไฟล์ในโปรเจกต์ — งาน ops

- [ ] **Step 1: generate secret แล้วเก็บไว้ใช้ทั้ง Task นี้และ Task 7**

```bash
openssl rand -hex 32
```

เพิ่มลง `.env.local` (สำหรับ dev) ด้วย: `CRON_SECRET=<ค่าที่ได้>`

- [ ] **Step 2: ตั้งค่าใน Railway**

ลอง CLI ก่อน: `railway variables --set "CRON_SECRET=<ค่าที่ได้>"` — ถ้าไม่มี CLI
หรือยังไม่ login **หยุดถามผู้ใช้** ให้เพิ่ม `CRON_SECRET` ใน Railway dashboard
(Variables ของ service) แล้วยืนยันก่อนไปต่อ

- [ ] **Step 3: push ให้ Railway deploy**

```bash
git push origin main
```

รอ deploy เสร็จ แล้วยืนยันว่า endpoint ขึ้นแล้วและ secret ทำงาน:

```bash
# หา URL production จริงจากค่า NEXT_PUBLIC_SITE_URL ที่ตั้งใน Railway
# (ตอนเขียน plan โดเมน namphrae-portal.app ยังไม่ online — ใช้ URL Railway ไปก่อน)
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'x-cron-secret: wrong' https://<URL-production>/api/cron/daily-digest
# → 401 (แปลว่า endpoint ขึ้นแล้ว + CRON_SECRET ตั้งแล้ว — ถ้าได้ 503 คือยังไม่ตั้ง, 404 คือยังไม่ deploy)
```

---

### Task 7: n8n workflow + ทดสอบส่งจริง 1 ครั้ง

**Files:** ไม่มีไฟล์ในโปรเจกต์ — สร้างผ่าน n8n MCP tools

- [ ] **Step 1: ทำตามลำดับของ n8n MCP** — `get_sdk_reference` → `get_suggested_nodes` → `search_nodes` (["schedule trigger", "http request"]) → `get_node_types` ด้วย id + discriminator ที่ได้

- [ ] **Step 2: เขียน workflow** — 2 โหนด:
  - **Schedule Trigger**: cron `0 17 * * *`, timezone `Asia/Bangkok`
  - **HTTP Request**: `POST https://<URL-production>/api/cron/daily-digest`, header `x-cron-secret: <ค่าจาก Task 6>` — ตั้ง option ให้ถือ non-2xx เป็น error (ค่า default ของโหนด) เพื่อให้ 401/502/503 ทำ run เป็น fail
  - ชื่อ workflow: `แจ้งตารางงานพรุ่งนี้เข้ากลุ่ม LINE`

- [ ] **Step 3: `validate_node_config` ทีละโหนด → `validate_workflow` → `create_workflow_from_code`**

- [ ] **Step 4: ทดสอบส่งจริง 1 ครั้ง** — execute workflow ผ่าน MCP (`test_workflow` หรือ `execute_workflow`) → ต้องได้ HTTP 200 `{ sent: true, ... }` → **ถามผู้ใช้ยืนยันว่าข้อความขึ้นในกลุ่ม LINE จริง**

- [ ] **Step 5: publish workflow** (`publish_workflow`) ให้ schedule ทำงานจริง

- [ ] **Step 6: จบงาน** — รัน `npx tsc --noEmit && npm test` รอบสุดท้าย รายงานผลผู้ใช้ (มีอะไรถูกสร้าง/ตั้งค่าที่ไหนบ้าง + วิธีย้ายไปโดเมน `namphrae-portal.app` ภายหลัง: แก้ URL ในโหนด HTTP Request โหนดเดียว)
