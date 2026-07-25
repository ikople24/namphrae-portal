import type { NextApiRequest, NextApiResponse } from 'next';
import { incrementClick } from '@/lib/config-store';
import { clientIp, rateLimit } from '@/lib/rate-limit';

// Best-effort click counter. Called via navigator.sendBeacon on card click.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const id = String(req.query.id ?? '');
  if (!id) return res.status(400).json({ error: 'missing_id' });

  // Throttle per IP+link to keep bots from inflating a single service.
  if (!rateLimit(`track:${clientIp(req)}:${id}`, 20, 60_000)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  try {
    const ok = await incrementClick(id);
    // 204 either way — tracking failures must never surface to the visitor.
    return res.status(ok ? 204 : 204).end();
  } catch (err) {
    console.error('POST /api/track failed', err);
    return res.status(204).end();
  }
}
