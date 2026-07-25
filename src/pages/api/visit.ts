import type { NextApiRequest, NextApiResponse } from 'next';
import { getConfig, incrementVisitor } from '@/lib/config-store';
import { clientIp, rateLimit } from '@/lib/rate-limit';

// Visitor counter. POST registers a new visit (once per session, enforced
// client-side) and returns the new total; GET just reads the current total.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === 'POST') {
      if (!rateLimit(`visit:${clientIp(req)}`, 10, 60_000)) {
        const config = await getConfig();
        return res.status(200).json({ visitorCount: config.visitorCount });
      }
      const visitorCount = await incrementVisitor();
      return res.status(200).json({ visitorCount });
    }
    if (req.method === 'GET') {
      const config = await getConfig();
      return res.status(200).json({ visitorCount: config.visitorCount });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (err) {
    console.error('/api/visit failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
