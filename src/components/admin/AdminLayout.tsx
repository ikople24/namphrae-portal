import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { UserButton } from '@clerk/nextjs';
import { isClerkPublicConfigured } from '@/lib/clerk-config';

const NAV = [
  { href: '/admin', label: 'ลิงก์บริการ', exact: true },
  { href: '/admin/settings', label: 'ตั้งค่าเว็บไซต์' },
  { href: '/admin/data', label: 'นำเข้า/ส่งออก' },
];

// Shared chrome for every admin page: title bar, nav, dev-open warning, and the
// Clerk user button when auth is configured.
export default function AdminLayout({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const router = useRouter();
  const clerkOn = isClerkPublicConfigured();

  return (
    <>
      <Head>
        <title>{`${title} · หลังบ้าน Namphrae Portal`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-paper">
        <header className="border-b border-black/[0.07] bg-surface">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">
            <Link
              href="/admin"
              className="font-display text-sm font-semibold text-emerald-deep"
            >
              Namphrae Portal · หลังบ้าน
            </Link>
            <nav className="ml-2 flex flex-1 items-center gap-1">
              {NAV.map((item) => {
                const active = item.exact
                  ? router.pathname === item.href
                  : router.pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? 'bg-emerald-050 text-emerald-deep'
                        : 'text-ink-soft hover:bg-black/[0.04]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Link
              href="/"
              target="_blank"
              className="text-sm text-ink-soft hover:text-ink"
            >
              ดูหน้าเว็บ ↗
            </Link>
            {clerkOn ? <ClerkUserButton /> : null}
          </div>
        </header>

        {!clerkOn ? (
          <div className="border-b border-amber-300/60 bg-amber-50 px-5 py-2 text-center text-sm text-amber-800">
            โหมดทดสอบ (dev-open): ยังไม่ได้ตั้งค่า Clerk — ใครก็เข้าหลังบ้านได้
            ห้ามใช้บน production ก่อนตั้งค่า authentication
          </div>
        ) : null}

        <main className="mx-auto max-w-5xl px-5 py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-semibold text-ink">
              {title}
            </h1>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </>
  );
}

// Rendered only when Clerk is configured. Must use a static ESM import: a CJS
// require() loads a second instance of @clerk/nextjs whose React context
// differs from the ClerkProvider in _app, so the button would crash with
// "useSession can only be used within ClerkProvider".
function ClerkUserButton() {
  // Sign-out redirect is configured on ClerkProvider in _app.tsx
  // (afterSignOutUrl moved off UserButton in @clerk/nextjs v7).
  return <UserButton />;
}
