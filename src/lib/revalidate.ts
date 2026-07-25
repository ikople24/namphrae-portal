import type { NextApiResponse } from 'next';

// Re-render the ISR home page after an admin mutation, so changes appear on the
// public site within moments instead of waiting for the 60s revalidate window.
export async function revalidateHome(res: NextApiResponse): Promise<void> {
  try {
    await res.revalidate('/');
  } catch (err) {
    // Non-fatal: the page will still refresh on its next timed revalidation.
    console.warn('revalidate("/") failed', err);
  }
}
