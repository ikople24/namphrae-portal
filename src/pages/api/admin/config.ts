import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { getConfig, saveConfig } from '@/lib/config-store';
import { revalidateHome } from '@/lib/revalidate';
import { importConfigSchema } from '@/lib/schema';
import { CONFIG_ID, type PortalConfig } from '@/types/portal';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const config = await getConfig();
    return res.status(200).json(config);
  }

  // PUT = full import (overwrite the whole document).
  if (req.method === 'PUT') {
    const parsed = importConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_config', issues: parsed.error.issues });
    }
    const current = await getConfig();
    const next: PortalConfig = {
      _id: CONFIG_ID,
      version: current.version, // saveConfig bumps this
      updatedAt: current.updatedAt,
      visitorCount: parsed.data.visitorCount ?? current.visitorCount,
      site: parsed.data.site,
      categories: parsed.data.categories,
      links: parsed.data.links,
    };
    const saved = await saveConfig(next, admin.email ?? admin.userId);
    await revalidateHome(res);
    return res.status(200).json(saved);
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'method_not_allowed' });
}
