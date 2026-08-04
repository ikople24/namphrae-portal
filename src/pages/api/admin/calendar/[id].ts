import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { canTransition } from '@/lib/job-status';
import { deleteJob, getJob, setJobStatus, updateJob } from '@/lib/jobs-store';
import { jobInputSchema, jobStatusSchema } from '@/lib/schema';
import type { JobStatus } from '@/types/portal';

// PATCH  /api/admin/calendar/[id]  body { job?: JobInput, status?: JobStatus }
// `job` คือชุดฟิลด์ที่แก้ได้ "ทั้งชุด" ไม่ใช่เฉพาะที่เปลี่ยน — jobInputSchema เติม
// ฟิลด์ที่ไม่ได้ส่งมาเป็น '' ให้เอง ถ้าส่งมาแค่บางฟิลด์ ฟิลด์ที่เหลือจะถูกล้างทิ้ง
// ฟอร์มจึงต้องส่งค่าปัจจุบันมาครบเสมอ
// DELETE /api/admin/calendar/[id]
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method === 'DELETE') {
    try {
      const removed = await deleteJob(id);
      return removed
        ? res.status(204).end()
        : res.status(404).json({ error: 'not_found' });
    } catch (err) {
      console.error('DELETE /api/admin/calendar/[id] failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const current = await getJob(id);
      if (!current) return res.status(404).json({ error: 'not_found' });

      const body = (req.body ?? {}) as { job?: unknown; status?: unknown };
      if (body.job === undefined && body.status === undefined) {
        return res.status(400).json({ error: 'empty_body' });
      }

      // ตรวจการเปลี่ยนสถานะให้จบก่อนแตะข้อมูล — transition ที่ไม่ถูกต้องต้อง
      // ไม่ทิ้งการแก้ไขบางส่วนไว้เบื้องหลัง
      let nextStatus: JobStatus | undefined;
      if (body.status !== undefined) {
        const parsed = jobStatusSchema.safeParse(body.status);
        if (!parsed.success) return res.status(400).json({ error: 'invalid_status' });

        // เปลี่ยนเป็นสถานะเดิม = สำเร็จแบบไม่ต้องทำอะไร (idempotent) ไม่ใช่ 409
        // เจ้าหน้าที่สองคนเปิดตารางพร้อมกัน A กดอนุมัติไปแล้ว แถวของ B ยังเป็นข้อมูล
        // เก่าจาก SWR cache แล้ว B กดตาม — ผลลัพธ์ที่ต้องการเกิดขึ้นแล้ว การตอบ
        // "เปลี่ยนสถานะไม่ได้" จึงผิดความจริง และไม่ต้องประทับ decidedAt ใหม่ด้วย
        if (parsed.data !== current.status) {
          if (!canTransition(current.status, parsed.data)) {
            return res.status(409).json({
              error: 'invalid_transition',
              from: current.status,
              to: parsed.data,
            });
          }
          nextStatus = parsed.data;
        }
      }

      if (body.job !== undefined) {
        const parsed = jobInputSchema.safeParse(body.job);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: 'invalid_job', issues: parsed.error.issues });
        }
        await updateJob(id, parsed.data);
      }

      if (nextStatus) {
        const updated = await setJobStatus(
          id,
          nextStatus,
          admin.email ?? admin.userId
        );
        // แถวหายไประหว่าง getJob() กับตรงนี้ (มีคนลบพร้อมกัน) — ต้องตอบ 404 ไม่ใช่
        // 200 body null เพราะ client ประกาศ type ไว้ว่าได้ CalendarJob แน่ ๆ แล้ว
        // จะพังตอนอ่าน property ตัวแรก ไม่ใช่ตอนรับคำตอบ
        if (!updated) return res.status(404).json({ error: 'not_found' });
        return res.status(200).json(updated);
      }
      const after = await getJob(id);
      if (!after) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(after);
    } catch (err) {
      console.error('PATCH /api/admin/calendar/[id] failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
