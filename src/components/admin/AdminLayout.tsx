import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import useSWR from 'swr';
import { UserButton } from '@clerk/nextjs';
import Icon from '@/components/Icon';
import { isClerkPublicConfigured } from '@/lib/clerk-config';
import {
  adminCalendarKey,
  adminFetcher,
  type JobCountResponse,
} from '@/lib/admin-api';

const NAV = [
  { href: '/admin', label: 'ลิงก์บริการ', icon: 'link', exact: true },
  { href: '/admin/calendar', label: 'ปฏิทินปฏิบัติงาน', icon: 'calendar_month', exact: false },
  { href: '/admin/categories', label: 'หมวดหมู่', icon: 'category', exact: false },
  { href: '/admin/map', label: 'ไฟล์แผนที่', icon: 'layers', exact: false },
  { href: '/admin/settings', label: 'ตั้งค่าเว็บไซต์', icon: 'tune', exact: false },
  { href: '/admin/users', label: 'จัดการผู้ใช้', icon: 'group', exact: false },
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

  // Badge: จำนวนผู้สมัครที่รออนุมัติ. Refresh ทุกนาที; ถ้า endpoint พัง
  // (เช่น Mongo ไม่พร้อม) ก็แค่ไม่แสดง badge — ไม่ retry รัว ๆ
  const { data: signupCount } = useSWR<{ pendingCount: number }>(
    '/api/admin/signups?countOnly=1',
    adminFetcher,
    { refreshInterval: 60_000, shouldRetryOnError: false }
  );

  // Badge: จำนวนงานปฏิทินที่รออนุมัติ — สรุปรายวันทาง LINE ส่งเฉพาะงานที่อนุมัติ
  // แล้ว (กลุ่มนั้นมีไว้ให้เจ้าหน้าที่หน้างานรู้ว่าพรุ่งนี้ต้องไปไหน ไม่ใช่ที่ทวง
  // งานค้าง) การทวงจึงมาอยู่ตรงนี้แทน ต้องเห็นจากทุกหน้าหลังบ้าน ไม่ใช่เห็นต่อ
  // เมื่อเปิดหน้าปฏิทินซึ่งเป็นหน้าที่ "รู้อยู่แล้ว" ว่ามีงานค้าง
  const { data: jobCount } = useSWR<JobCountResponse>(
    adminCalendarKey({ status: 'pending', countOnly: true }),
    adminFetcher,
    { refreshInterval: 60_000, shouldRetryOnError: false }
  );

  // ค่าเดียวกับตัวเลขบนหัวข้อ "รออนุมัติ" ในหน้าปฏิทิน (คิวรีเดียวกัน ไม่จำกัด
  // เดือน) — สองที่นี้ต้องไม่ขัดกันเอง ไม่งั้นคนใช้ไม่รู้ว่าจะเชื่ออันไหน
  const badgeCount: Record<string, number> = {
    '/admin/users': signupCount?.pendingCount ?? 0,
    '/admin/calendar': jobCount?.count ?? 0,
  };

  // User chip: ชื่อ-ตำแหน่งของคนที่ล็อกอินอยู่ จากทะเบียนสมาชิก (ไม่ใช่ชื่อใน
  // บัญชี Clerk ซึ่งมักว่าง) — โหลดครั้งเดียวพอ ไม่ต้อง revalidate
  const { data: me } = useSWR<{
    name: string | null;
    position: string | null;
    email: string | null;
  }>(clerkOn ? '/api/admin/me' : null, adminFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

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
                  {badgeCount[item.href] > 0 ? (
                    <span
                      title="รออนุมัติ"
                      className="ml-auto rounded-full bg-amber-500 px-1.5 py-px text-[10px] font-semibold text-white"
                    >
                      {badgeCount[item.href]}
                    </span>
                  ) : null}
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
              <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-black/[0.07] bg-white px-3 py-2.5">
                <ClerkUserButton />
                <div className="min-w-0 leading-tight">
                  <p className="truncate font-display text-[12.5px] font-semibold text-ink">
                    {me?.name ?? me?.email ?? 'ผู้ใช้งาน'}
                  </p>
                  {me?.position ? (
                    <p className="truncate text-[10.5px] text-ink-mute">
                      {me.position}
                    </p>
                  ) : null}
                </div>
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
