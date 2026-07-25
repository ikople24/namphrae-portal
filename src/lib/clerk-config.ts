// Client-safe Clerk config checks. Contains NO imports from @clerk/nextjs/server
// so it is safe to import from client components (e.g. _app.tsx).

export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY
  );
}

// Only the public key is inlined into the browser bundle, so this is the value
// both server and client agree on for rendering decisions (avoids hydration
// mismatch on the Clerk provider / auth UI).
export function isClerkPublicConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}
