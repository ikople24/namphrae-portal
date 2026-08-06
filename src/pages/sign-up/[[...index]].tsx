import Head from 'next/head';
import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { isClerkPublicConfigured } from '@/lib/clerk-config';

// Clerk sign-up for new applicants. After creating an account they land on
// /apply to submit their membership application (they are NOT members yet —
// membership requires admin approval; see docs/superpowers/specs/
// 2026-08-06-admin-user-management-design.md).
export default function SignUpPage() {
  const clerkOn = isClerkPublicConfigured();
  return (
    <>
      <Head>
        <title>สมัครสมาชิก · Namphrae Portal</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="grid min-h-screen place-items-center bg-paper px-5">
        {clerkOn ? (
          <ClerkSignUp />
        ) : (
          <div className="max-w-md rounded-2xl border border-black/[0.07] bg-surface p-8 text-center">
            <h1 className="font-display text-xl font-semibold text-ink">
              โหมดทดสอบ (dev-open)
            </h1>
            <p className="mt-3 text-sm text-ink-soft">
              ยังไม่ได้ตั้งค่า Clerk จึงไม่มีระบบสมัครสมาชิก — เข้าหลังบ้านได้เลย
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

// Static ESM import for the same reason as sign-in: a CJS require() loads a
// second @clerk/nextjs instance whose React context differs from ClerkProvider.
function ClerkSignUp() {
  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      forceRedirectUrl="/apply"
    />
  );
}
