import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { UserButton } from '@clerk/nextjs';
import Icon from '@/components/Icon';
import { isClerkPublicConfigured } from '@/lib/clerk-config';

const NAV = [
  { href: '/admin', label: 'ลิงก์บริการ', icon: 'link', exact: true },
  { href: '/admin/settings', label: 'ตั้งค่าเว็บไซต์', icon: 'tune', exact: false },
  { href: '/admin/data', label: 'นำเข้า/ส่งออก', icon: 'swap_vert', exact: false },
];

// 1d admin chrome: left sidebar (brand, icon nav, dev-open warning card) with
// the content pane alongside. Same props API as before so every admin page
// keeps working: title bar + actions render at the top of the content pane.
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
      <div className="min-h-screen bg-paper md:grid md:grid-cols-[212px_1fr]">
        <aside className="flex flex-col gap-[18px] border-b border-black/[0.07] bg-white px-4 py-4 md:gap-[22px] md:border-b-0 md:border-r md:py-[22px]">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-green font-display text-[13px] font-semibold text-white">
              น
            </div>
            <div className="leading-tight">
              <p className="font-display text-[12.5px] font-semibold text-ink">หลังบ้าน</p>
              <p className="text-[10px] text-ink-mute">Namphrae Portal</p>
            </div>
          </div>

          <nav className="flex gap-0.5 overflow-x-auto md:flex-col">
            {NAV.map((item) => {
              const active = item.exact
                ? router.pathname === item.href
                : router.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2.5 font-display text-[13px] font-medium transition ${
                    active
                      ? 'bg-green-050 text-green-deep'
                      : 'text-ink-faint hover:bg-black/[0.04]'
                  }`}
                >
                  <Icon name={item.icon} size={20} />
                  {item.label}
                </Link>
              );
            })}
            <a
              href="/"
              target="_blank"
              className="flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2.5 font-display text-[13px] font-medium text-ink-faint transition hover:bg-black/[0.04]"
            >
              <Icon name="open_in_new" size={20} />
              ดูหน้าเว็บ
            </a>
          </nav>

          <div className="md:mt-auto">
            {clerkOn ? (
              <div className="mb-3 px-1">
                <ClerkUserButton />
              </div>
            ) : (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-[13px]">
                <p className="flex items-center gap-1.5 font-display text-[11.5px] font-semibold text-amber-800">
                  <Icon name="warning" size={17} />
                  โหมดทดสอบ (dev-open)
                </p>
                <p className="mt-[5px] text-[11px] leading-normal text-amber-800">
                  ยังไม่ได้ตั้งค่า Clerk — ใครก็เข้าหลังบ้านได้ ห้ามใช้บน production
                </p>
              </div>
            )}
          </div>
        </aside>

        <main className="px-5 py-6 md:px-7 md:pb-[34px]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-[22px] font-bold text-ink">{title}</h1>
            {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
          </div>
          {children}
        </main>
      </div>
    </>
  );
}

// Kept as its own component so the ESM import stays the single Clerk touch
// point in this file (see the dual-instance fix note in git history).
function ClerkUserButton() {
  return <UserButton />;
}
