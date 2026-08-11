import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { mutateConfig } from '@/lib/config-store';
import { revalidateHome } from '@/lib/revalidate';
import { siteSettingsSchema } from '@/lib/schema';

// PATCH site settings (org name, logo, contact, hero media, manuals).
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireFeature(req, res, 'settings');
  if (!admin) return;

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const parsed = siteSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'invalid_site', issues: parsed.error.issues });
  }

  const saved = await mutateConfig((draft) => {
    draft.site = parsed.data;
  }, admin.email ?? admin.userId);

  await revalidateHome(res);
  return res.status(200).json(saved.site);
}
