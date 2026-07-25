import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { getConfig, mutateConfig } from '@/lib/config-store';
import { revalidateHome } from '@/lib/revalidate';
import { linkInputSchema } from '@/lib/schema';
import type { ServiceLink } from '@/types/portal';

// POST /api/admin/links — create a new service link.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const parsed = linkInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'invalid_link', issues: parsed.error.issues });
  }
  const input = parsed.data;

  const current = await getConfig();
  if (current.links.some((l) => l.id === input.id)) {
    return res.status(409).json({ error: 'duplicate_id' });
  }

  const saved = await mutateConfig((draft) => {
    const maxOrder = draft.links.reduce((m, l) => Math.max(m, l.order), 0);
    const link: ServiceLink = {
      ...input,
      order: input.order || maxOrder + 1,
      clickCount: 0,
    };
    draft.links.push(link);
  }, admin.email ?? admin.userId);

  await revalidateHome(res);
  const created = saved.links.find((l) => l.id === input.id);
  return res.status(201).json(created);
}
