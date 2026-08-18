import type { NextApiRequest, NextApiResponse } from 'next';
import { buildIncidentFilter, listIncidents } from '@/lib/disaster-store';

// รายการเหตุสาธารณภัย — สาธารณะ ไม่ต้องล็อกอิน (เดิมคือ GET /api/incidents)
//
// ฟิลด์ที่คืนถูกจำกัดด้วย toIncidentItem() ใน store ไม่ใช่ที่นี่ — createdBy ซึ่งเป็น
// รหัสผู้ใช้ของเจ้าหน้าที่จึงไม่มีทางหลุดออกไปแม้จะมีคนแก้ route นี้ทีหลัง
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const incidents = await listIncidents(
    buildIncidentFilter({
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      year: typeof req.query.year === 'string' ? req.query.year : undefined,
    })
  );

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ incidents });
}
