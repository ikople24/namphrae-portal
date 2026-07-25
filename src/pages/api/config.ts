import type { NextApiRequest, NextApiResponse } from 'next';
import { getConfig, toPublicConfig } from '@/lib/config-store';

// Public config: active links only, admin-only fields stripped.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const config = toPublicConfig(await getConfig());
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    );
    return res.status(200).json(config);
  } catch (err) {
    console.error('GET /api/config failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
