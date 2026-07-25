import type { NextApiRequest } from 'next';

// Tiny in-memory fixed-window limiter. Good enough to blunt casual bots on the
// public track/visit endpoints. Note: per-instance only — on multi-instance
// serverless it limits per warm instance, not globally. For hard guarantees use
// a shared store (e.g. Upstash Ratelimit); see PLAN §8.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function clientIp(req: NextApiRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0];
  return req.socket?.remoteAddress ?? 'unknown';
}

/**
 * @returns true if the request is allowed, false if it should be throttled.
 */
export function rateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
