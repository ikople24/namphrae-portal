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
