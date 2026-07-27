import Head from 'next/head';
import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { isClerkPublicConfigured } from '@/lib/clerk-config';

// Clerk sign-in. When Clerk is not configured (dev-open mode) there is nothing
// to sign into, so we show a short note instead of a broken widget.
export default function SignInPage() {
  const clerkOn = isClerkPublicConfigured();
  return (
    <>
      <Head>
        <title>เข้าสู่ระบบ · Namphrae Portal</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="grid min-h-screen place-items-center bg-paper px-5">
        {clerkOn ? (
          <ClerkSignIn />
        ) : (
          <div className="max-w-md rounded-2xl border border-black/[0.07] bg-surface p-8 text-center">
            <h1 className="font-display text-xl font-semibold text-ink">
              โหมดทดสอบ (dev-open)
            </h1>
            <p className="mt-3 text-sm text-ink-soft">
              ยังไม่ได้ตั้งค่า Clerk จึงไม่มีระบบเข้าสู่ระบบ — เข้าหลังบ้านได้เลย
            </p>
            <Link
              href="/admin"
              className="mt-5 inline-block rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-deep"
            >
              ไปหน้าหลังบ้าน
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

// Must be a static ESM import: a CJS require() here loads a second instance of
// @clerk/nextjs whose React context differs from the ClerkProvider in _app,
// which breaks prerender with "useSession can only be used within ClerkProvider".
function ClerkSignIn() {
  return <SignIn routing="path" path="/sign-in" signUpUrl="/sign-in" />;
}
