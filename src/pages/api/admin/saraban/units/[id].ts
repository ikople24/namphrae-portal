import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { unitPatchSchema } from '@/lib/saraban-schema';
import { updateUnit } from '@/lib/saraban-units-store';

// PATCH /api/admin/saraban/units/[id] — แก้ชื่อ สังกัด รหัสส่วนราชการ ลำดับ หรือปิด/เปิด
// ไม่มี DELETE โดยตั้งใจ: หนังสืออ้าง holderUnitId อยู่ ปิดด้วย isActive แทน
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const parsed = unitPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  }
  try {
    const unit = await updateUnit(id, parsed.data);
    return unit ? res.status(200).json(unit) : res.status(404).json({ error: 'not_found' });
  } catch (err) {
    console.error('PATCH /api/admin/saraban/units/[id] failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
