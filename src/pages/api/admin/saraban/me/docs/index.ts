import type { NextApiRequest, NextApiResponse } from 'next';
import { MEMBER_PAGE_SIZE, pageMemberDocs } from '@/lib/saraban-member';
import { requireSarabanMember } from '@/lib/saraban-member-guard';
import { memberDocsQuerySchema } from '@/lib/saraban-schema';
import { listMemberCandidates } from '@/lib/saraban-store';

// GET /api/admin/saraban/me/docs?tab=todo|forwarded|done&page= — หน้าละ 20 แก้ล่าสุดก่อน
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const member = await requireSarabanMember(req, res);
  if (!member) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const parsed = memberDocsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  }
  const { tab, page } = parsed.data;
  try {
    const docs = await listMemberCandidates(member.unitIds);
    const { items, total } = pageMemberDocs(docs, member.unitIds, tab, page);
    return res.status(200).json({ items, total, page, pageSize: MEMBER_PAGE_SIZE });
  } catch (err) {
    console.error('GET /api/admin/saraban/me/docs failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
