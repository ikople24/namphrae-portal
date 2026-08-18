import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { incidentInputSchema } from '@/lib/disaster-schema';
import { deleteIncident, getIncident, updateIncident } from '@/lib/disaster-store';

// อ่าน/แก้/ลบเหตุรายตัว — ต้องมีสิทธิ์ disaster ทุกเมธอด
//
// ต่างจากต้นทางตรงที่ GET ก็ต้องมีสิทธิ์ด้วย ต้นทางเปิด GET /api/incidents/[id]
// ให้สาธารณะ แต่ที่นี่ไม่ต้องเปิด เพราะหน้าเว็บสาธารณะดึงทั้งรายการจาก
// /api/disaster/incidents อยู่แล้ว ไม่เคยเรียกรายตัว — ไม่มีใครเสียอะไร
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'disaster');
  if (!admin) return;

  const id = String(req.query.id);

  if (req.method === 'GET') {
    const incident = await getIncident(id);
    if (!incident) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ incident });
  }

  if (req.method === 'PUT') {
    const parsed = incidentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_body', detail: parsed.error.issues });
    }
    const incident = await updateIncident(id, parsed.data, new Date());
    if (!incident) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ incident });
  }

  if (req.method === 'DELETE') {
    const ok = await deleteIncident(id);
    if (!ok) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ id });
  }

  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
