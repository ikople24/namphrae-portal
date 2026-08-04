import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { createJob, listJobs } from '@/lib/jobs-store';
import { pushNewJobNotice } from '@/lib/line';
import { jobInputSchema, jobStatusSchema } from '@/lib/schema';
import { parseMonth } from '@/lib/calendar-grid';
import type { JobStatus } from '@/types/portal';

// GET  /api/admin/calendar?month=YYYY-MM&status=pending — ข้อมูลเต็ม ทุกสถานะ
// POST /api/admin/calendar                              — สร้างงานใหม่ + แจ้ง LINE
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    // month ไม่บังคับ: หน้าหลังบ้านเรียกแบบไม่ใส่ month พร้อม status=pending
    // เพื่อดูคิวรออนุมัติทั้งหมด ไม่ใช่เฉพาะเดือนที่กำลังเปิดดู
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    // ใช้ parseMonth() ไม่ใช่ regex ซ้ำ — regex เปล่า ๆ ปล่อย '2026-13' ผ่าน แล้วไป
    // คิวรีช่วง '2026-13-01'..'2026-13-31' ที่ไม่มีทางตรงกับอะไร ได้ผลว่างเปล่า
    // แทนที่จะเป็น 400 ที่บอกสาเหตุ (parseMonth เช็คช่วง 1-12 ให้ด้วย)
    if (month !== undefined && !parseMonth(month)) {
      return res.status(400).json({ error: 'invalid_month' });
    }

    let status: JobStatus | undefined;
    if (typeof req.query.status === 'string') {
      const parsed = jobStatusSchema.safeParse(req.query.status);
      if (!parsed.success) return res.status(400).json({ error: 'invalid_status' });
      status = parsed.data;
    }

    try {
      const jobs = await listJobs({ month, status });
      return res.status(200).json({ month: month ?? null, jobs });
    } catch (err) {
      console.error('GET /api/admin/calendar failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (req.method === 'POST') {
    const parsed = jobInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_job', issues: parsed.error.issues });
    }

    const job = await createJob(parsed.data, admin.email ?? admin.userId);
    // บันทึกก่อน แจ้งทีหลัง และไม่ให้ผลของ LINE ย้อนกลับมาทำให้งานหาย
    const lineNotified = await pushNewJobNotice(job);
    return res.status(201).json({ job, lineNotified });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
