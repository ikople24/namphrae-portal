import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { unitInputSchema } from '@/lib/saraban-schema';
import { createUnit, listUnits } from '@/lib/saraban-units-store';

// GET  /api/admin/saraban/units — สมุดผู้รับทั้งหมด รวมที่ปิดอยู่ (หนังสือเก่ายังอ้างถึง หน้าจอกรองเอง)
// POST /api/admin/saraban/units — เพิ่มตำแหน่ง/หน่วยงาน · ผู้มีสิทธิ์ saraban ทำได้ (สเปกข้อ 2 "สิทธิ์")
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  if (req.method === 'GET') {
    try {
      return res.status(200).json(await listUnits());
    } catch (err) {
      console.error('GET /api/admin/saraban/units failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (req.method === 'POST') {
    const parsed = unitInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    }
    try {
      return res.status(201).json(await createUnit(parsed.data));
    } catch (err) {
      console.error('POST /api/admin/saraban/units failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
