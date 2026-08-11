import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { requireFeature } from '@/lib/auth-server';
import { mutateConfig } from '@/lib/config-store';
import { revalidateHome } from '@/lib/revalidate';

// PATCH /api/admin/links/reorder — persist a new link order.
// Body: { order: string[] } — link ids in the desired order.
const bodySchema = z.object({ order: z.array(z.string()).min(1) });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireFeature(req, res, 'links');
  if (!admin) return;

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_order' });
  }

  const rank = new Map(parsed.data.order.map((id, i) => [id, i + 1]));

  const saved = await mutateConfig((draft) => {
    for (const link of draft.links) {
      const r = rank.get(link.id);
      if (r != null) link.order = r;
    }
  }, admin.email ?? admin.userId);

  await revalidateHome(res);
  return res.status(200).json({ ok: true, version: saved.version });
}
