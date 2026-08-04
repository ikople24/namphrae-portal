import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { canTransition } from '@/lib/job-status';
import { deleteJob, getJob, setJobStatus, updateJob } from '@/lib/jobs-store';
import { jobInputSchema, jobStatusSchema } from '@/lib/schema';
import type { JobStatus } from '@/types/portal';

// PATCH  /api/admin/calendar/[id]  body { patch?: JobInput, status?: JobStatus }
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
    const removed = await deleteJob(id);
    return removed
      ? res.status(204).end()
      : res.status(404).json({ error: 'not_found' });
  }

  if (req.method === 'PATCH') {
    const current = await getJob(id);
    if (!current) return res.status(404).json({ error: 'not_found' });

    const body = (req.body ?? {}) as { patch?: unknown; status?: unknown };
    if (body.patch === undefined && body.status === undefined) {
      return res.status(400).json({ error: 'empty_patch' });
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

    if (body.patch !== undefined) {
      const parsed = jobInputSchema.safeParse(body.patch);
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
      return res.status(200).json(updated);
    }
    return res.status(200).json(await getJob(id));
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
