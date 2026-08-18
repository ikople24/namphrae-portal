import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { incidentInputSchema } from '@/lib/disaster-schema';
import { buildIncidentFilter, insertIncident, listIncidents } from '@/lib/disaster-store';

// จัดการเหตุสาธารณภัย — ต้องมีสิทธิ์ disaster
//
// ต้นทางยามด้วย requireDbUser คือ "อยู่ในทะเบียนผู้ใช้ไหม" เฉย ๆ ที่นี่เข้มขึ้นเป็น
// สิทธิ์รายฟีเจอร์ตามระบบของ portal — สมาชิกที่ผู้จัดการยังไม่เปิด disaster ให้
// จะแก้ข้อมูลภัยพิบัติไม่ได้ เป็นการหดสิทธิ์ให้แคบลงตามที่สเปกข้อ 1 ระบุไว้
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'disaster');
  if (!admin) return;

  if (req.method === 'GET') {
    const incidents = await listIncidents(
      buildIncidentFilter({
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
        year: typeof req.query.year === 'string' ? req.query.year : undefined,
      })
    );
    return res.status(200).json({ incidents });
  }

  if (req.method === 'POST') {
    const parsed = incidentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_body', detail: parsed.error.issues });
    }
    const incident = await insertIncident(parsed.data, admin.userId, new Date());
    return res.status(201).json({ incident });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
