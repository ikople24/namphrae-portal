import type { NextApiRequest, NextApiResponse } from 'next';
import { countMemberTabs } from '@/lib/saraban-member';
import { requireSarabanMember } from '@/lib/saraban-member-guard';
import { listMemberCandidates } from '@/lib/saraban-store';

// GET /api/admin/saraban/me — ตำแหน่งที่ผูก · จำนวนต่อแท็บ · ลงรับได้ไหม (สเปกรอบ 3 ข้อ 3)
// ไม่ได้ผูก → 403 not_member (shell โหมดเต็มใช้ตัวนี้ตัดสินว่าโชว์ปุ่ม "งานของฉัน" ไหม)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const member = await requireSarabanMember(req, res);
  if (!member) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const docs = await listMemberCandidates(member.unitIds);
    return res.status(200).json({
      units: member.units
        .filter((u) => member.unitIds.includes(u.id))
        .map(({ id, name }) => ({ id, name })),
      canReceive: member.canReceive,
      counts: countMemberTabs(docs, member.unitIds),
    });
  } catch (err) {
    console.error('GET /api/admin/saraban/me failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
