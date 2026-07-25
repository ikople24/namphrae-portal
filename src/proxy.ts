import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js Proxy (formerly "middleware"). Protects /admin and /api/admin with
// Clerk — but only when Clerk is configured. With no keys the portal runs in
// dev-open mode and this is a no-op, so the app boots and is testable with zero
// configuration.
const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

async function noopProxy() {
  return NextResponse.next();
}

// Lazily build the Clerk proxy only when enabled, so the edge bundle stays clean
// in dev-open mode.
function buildClerkProxy() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { clerkMiddleware, createRouteMatcher } = require('@clerk/nextjs/server');
  const isProtected = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);
  return clerkMiddleware(
    async (auth: { protect: () => Promise<unknown> }, req: NextRequest) => {
      if (isProtected(req)) await auth.protect();
    }
  );
}

const proxy = clerkEnabled ? buildClerkProxy() : noopProxy;
export default proxy;

export const config = {
  matcher: [
    // Run on admin routes only; skip static assets and the public site.
    '/admin/:path*',
    '/api/admin/:path*',
  ],
};
