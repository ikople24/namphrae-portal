import Head from 'next/head';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { SignOutButton, useAuth } from '@clerk/nextjs';
import { isClerkPublicConfigured } from '@/lib/clerk-config';

// Shown on /admin pages when the visitor is signed out or signed in but not in
// the shared user registry (db_namphrae.users). Pairs with the SSR guards
// (getFeatureSsrProps / getManagerSsrProps)
// in src/lib/auth-server.ts.
export function AccessDenied() {
  return (
    <>
      <Head>
        <title>ไม่มีสิทธิ์เข้าถึง · Namphrae Portal</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-5 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">
          ไม่มีสิทธิ์เข้าถึงหลังบ้าน
        </h1>
        <p className="max-w-md text-sm text-ink-soft">
          ต้องเข้าสู่ระบบด้วยบัญชีที่ได้รับสิทธิ์เท่านั้น
          หากต้องการสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ
        </p>
        <div className="flex gap-3">
          {isClerkPublicConfigured() ? <AuthAction /> : null}
          <Link
            href="/"
            className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:bg-black/[0.04]"
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </>
  );
}

const pillClass =
  'rounded-full bg-emerald-deep px-4 py-2 text-sm font-medium text-white';

// A signed-in-but-unregistered visitor (this screen's usual audience — the
// proxy redirects signed-out visitors to /sign-in before they get here) is
// stuck on their account, so offer sign-out to switch accounts. Kept in its
// own component so Clerk hooks only run when ClerkProvider exists.
function AuthAction() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) {
    return (
      <SignOutButton redirectUrl="/sign-in">
        <button className={pillClass}>ออกจากระบบ / เปลี่ยนบัญชี</button>
      </SignOutButton>
    );
  }
  return (
    <Link href="/sign-in" className={pillClass}>
      เข้าสู่ระบบ
    </Link>
  );
}

// การ์ดสำหรับสมาชิกที่ยังไม่ได้รับสิทธิ์ฟีเจอร์ใดเลย (getFeatureSsrProps ส่ง
// forbidden: true มาแทนการ redirect — คนไม่มีสิทธิ์สักหน้าไม่มีที่ให้เด้งไป)
export function FeatureDenied() {
  return (
    <>
      <Head>
        <title>ยังไม่ได้รับสิทธิ์ · Namphrae Portal</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-5 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">
          ยังไม่ได้รับสิทธิ์ใช้งาน
        </h1>
        <p className="max-w-md text-sm text-ink-soft">
          บัญชีของคุณเป็นสมาชิกแล้ว แต่ยังไม่ได้รับสิทธิ์ใช้งานส่วนใดของหลังบ้าน
          กรุณาติดต่อผู้จัดการระบบเพื่อขอเปิดสิทธิ์
        </p>
        <Link
          href="/"
          className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:bg-black/[0.04]"
        >
          กลับหน้าหลัก
        </Link>
      </div>
    </>
  );
}

// Wraps an admin page component: AccessDenied เมื่อไม่ใช่สมาชิก,
// FeatureDenied เมื่อเป็นสมาชิกที่ไม่มีสิทธิ์ฟีเจอร์ใดเลย
export function withMemberGuard<P extends object>(Page: ComponentType<P>) {
  function Guarded({
    member,
    forbidden,
    ...rest
  }: P & { member: boolean; forbidden?: boolean }) {
    if (!member) return <AccessDenied />;
    if (forbidden) return <FeatureDenied />;
    return <Page {...(rest as P)} />;
  }
  return Guarded;
}
