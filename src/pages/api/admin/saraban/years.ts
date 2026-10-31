import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { resolveActor } from '@/lib/saraban-actor';
import { bangkokDateOf, fiscalYearOf } from '@/lib/saraban-number';
import { yearQuerySchema, yearStartSchema } from '@/lib/saraban-schema';
import { getYearInfo, setStartNo } from '@/lib/saraban-store';

// GET /api/admin/saraban/years?register=in[&year=2570] — จำนวนหนังสือ เลขเริ่มต้น และเลขถัดไปของปี
//   (หน้าลงรับใช้แสดง "เลขรับถัดไป" และตัดสินว่าจะโชว์ลิงก์ตั้งเลขเริ่มต้นไหม)
// PUT /api/admin/saraban/years — ตั้งเลขเริ่มต้น ได้เฉพาะปีที่ยังไม่มีหนังสือ (สเปกข้อ 4)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  if (req.method === 'GET') {
    const parsed = yearQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    }
    try {
      const year = parsed.data.year ?? fiscalYearOf(bangkokDateOf(new Date()));
      return res.status(200).json(await getYearInfo(parsed.data.register, year));
    } catch (err) {
      console.error('GET /api/admin/saraban/years failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (req.method === 'PUT') {
    const parsed = yearStartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    }
    try {
      const { register, fiscalYear, startNo } = parsed.data;
      const result = await setStartNo(register, fiscalYear, startNo, await resolveActor(admin));
      if (result === 'year_in_use') return res.status(409).json({ error: 'year_in_use' });
      return res.status(200).json(await getYearInfo(register, fiscalYear));
    } catch (err) {
      console.error('PUT /api/admin/saraban/years failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'method_not_allowed' });
}
