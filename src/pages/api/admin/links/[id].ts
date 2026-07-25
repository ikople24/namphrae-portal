import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { getConfig, mutateConfig } from '@/lib/config-store';
import { revalidateHome } from '@/lib/revalidate';
import { linkInputSchema } from '@/lib/schema';

// PUT /api/admin/links/[id]  — update a link
// DELETE /api/admin/links/[id] — remove a link
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = String(req.query.id ?? '');
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method === 'PUT') {
    const parsed = linkInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_link', issues: parsed.error.issues });
    }
    const input = parsed.data;

    const current = await getConfig();
    const existing = current.links.find((l) => l.id === id);
    if (!existing) return res.status(404).json({ error: 'not_found' });
    // If the slug changed, the new one must not collide.
    if (
      input.id !== id &&
      current.links.some((l) => l.id === input.id)
    ) {
      return res.status(409).json({ error: 'duplicate_id' });
    }

    const saved = await mutateConfig((draft) => {
      const link = draft.links.find((l) => l.id === id);
      if (!link) return;
      Object.assign(link, input); // clickCount is preserved (not in input)
    }, admin.email ?? admin.userId);

    await revalidateHome(res);
    return res.status(200).json(saved.links.find((l) => l.id === input.id));
  }

  if (req.method === 'DELETE') {
    const current = await getConfig();
    if (!current.links.some((l) => l.id === id)) {
      return res.status(404).json({ error: 'not_found' });
    }
    await mutateConfig((draft) => {
      draft.links = draft.links.filter((l) => l.id !== id);
    }, admin.email ?? admin.userId);

    await revalidateHome(res);
    return res.status(204).end();
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
