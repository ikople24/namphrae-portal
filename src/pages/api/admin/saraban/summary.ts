import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { bangkokDateOf } from '@/lib/saraban-number';
import { countDocs } from '@/lib/saraban-store';
import { isStorageConfigured } from '@/lib/saraban-storage';

// GET /api/admin/saraban/summary — ตัวเลขบน sidebar ทุกหน้า: หนังสือรับที่รอเกษียน (ทุกปีงบ —
// เรื่องค้างข้ามปียังต้องนับ) และสถานะที่เก็บไฟล์ให้หน้าจอซ่อนช่องแนบไฟล์ได้ตั้งแต่โหลดหน้า
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const today = bangkokDateOf(new Date());
    return res.status(200).json({
      inboxPending: await countDocs({ register: 'in', statusIn: ['pending'] }, today),
      storageConfigured: isStorageConfigured(),
      today,
    });
  } catch (err) {
    console.error('GET /api/admin/saraban/summary failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
