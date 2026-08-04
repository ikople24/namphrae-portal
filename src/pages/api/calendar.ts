import type { NextApiRequest, NextApiResponse } from 'next';
import { currentMonthInBangkok, parseMonth } from '@/lib/calendar-grid';
import { toPublicJobs } from '@/lib/job-public';
import { listJobs } from '@/lib/jobs-store';
import { clientIp, rateLimit } from '@/lib/rate-limit';

// GET /api/calendar?month=YYYY-MM — ปฏิทินสาธารณะ
//
// เส้นทางนี้ไม่มี auth จึงต้องผ่าน toPublicJobs() เสมอ: มันคัดเหลือเฉพาะงานที่
// อนุมัติแล้วและตัดชื่อ/เบอร์/ต้นทาง/ปลายทางทิ้ง การกรองเกิดที่นี่ ไม่ใช่ที่ client
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!rateLimit(`calendar:${clientIp(req)}`, 60, 60_000)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const month =
    typeof req.query.month === 'string' ? req.query.month : currentMonthInBangkok();
  // parseMonth() เช็คช่วงเดือน 1-12 ด้วย ต่างจาก regex เปล่า ๆ ที่ปล่อย '2026-13'
  // ผ่านไปคิวรีช่วงที่ไม่มีทางตรงกับอะไร แล้วคืนปฏิทินว่างแทนที่จะบอกว่าอินพุตผิด
  if (!parseMonth(month)) {
    return res.status(400).json({ error: 'invalid_month' });
  }

  try {
    const jobs = await listJobs({ month });
    return res.status(200).json({ month, jobs: toPublicJobs(jobs) });
  } catch (err) {
    console.error('GET /api/calendar failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
