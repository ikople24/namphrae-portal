import type { NextApiRequest, NextApiResponse } from 'next';
import { incidentYearStats } from '@/lib/disaster-store';

// สถิติจำนวนเหตุรายปีต่อประเภท — สาธารณะ (เดิมคือ GET /api/incidents/stats)
// นับด้วย aggregation ที่ฝั่ง Mongo ไม่ใช่ดึงทุกเหตุมานับที่นี่ เพราะหน้าแรกเรียก
// เส้นนี้ทุกครั้งที่เปิด และจำนวนเหตุโตขึ้นเรื่อย ๆ ตามปีที่ผ่านไป
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const stats = await incidentYearStats();
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ stats });
}
