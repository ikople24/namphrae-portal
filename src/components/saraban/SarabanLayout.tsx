// shell ของระบบสารบรรณ (สเปกข้อ 6 "shell") — แยกจาก AdminLayout เพราะสารบรรณมีเมนูและธีมของตัวเอง
// แต่ใช้ auth/สิทธิ์ชุดเดียวกับพอร์ทัล · เมนูแสดงเฉพาะจอที่สร้างแล้วในรอบ 1
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSyncExternalStore, type ReactNode } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import { Toaster } from '@/components/saraban/toast';
import { adminFetcher } from '@/lib/admin-api';
import { isClerkPublicConfigured } from '@/lib/clerk-config';
import { SUMMARY_KEY, sarabanFetcher, type SummaryResponse } from '@/lib/saraban-api';
import { sarabanFont } from '@/lib/saraban-font';
import { fiscalYearOf } from '@/lib/saraban-number';

const NAV = [
  { href: '/saraban/inbox', label: 'ทะเบียนหนังสือรับ', icon: 'move_to_inbox', badge: true },
  { href: '/saraban/outbox', label: 'ทะเบียนหนังสือส่ง', icon: 'outbox', badge: false },
  { href: '/saraban/receive', label: 'ลงรับหนังสือ', icon: 'add', badge: false },
  { href: '/saraban/send', label: 'ออกเลขหนังสือส่ง', icon: 'tag', badge: false },
  { href: '/saraban/units', label: 'สมุดผู้รับ', icon: 'apartment', badge: false },
] as const;

// สถานะย่อเมนูจำใน localStorage (สเปกข้อ 6) — อ่านผ่าน useSyncExternalStore: ตอน SSR ได้ "ไม่ย่อ"
// แล้วค่อยเป็นค่าจริงหลัง hydrate · localStorage โยนได้ในโหมดส่วนตัว จึงมีค่าในหน่วยความจำสำรอง
const COLLAPSE_KEY = 'saraban.navCollapsed';
const collapseListeners = new Set<() => void>();
let collapsedInMemory = false;

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return collapsedInMemory;
  }
}

function writeCollapsed(value: boolean) {
  collapsedInMemory = value;
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    // จำข้ามการเปิดหน้าไม่ได้ ใช้ค่าในหน่วยความจำไปก่อน
  }
  collapseListeners.forEach((listener) => listener());
}

function subscribeCollapsed(listener: () => void) {
  collapseListeners.add(listener);
  return () => {
    collapseListeners.delete(listener);
  };
}

export default function SarabanLayout({
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
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const toggle = () => writeCollapsed(!collapsed);

  const { data: summary } = useSWR<SummaryResponse>(SUMMARY_KEY, sarabanFetcher, {
    refreshInterval: 60_000,
    shouldRetryOnError: false,
  });
  const { data: me } = useSWR<{ name: string | null; position: string | null; email: string | null }>(
    clerkOn ? '/api/admin/me' : null,
    adminFetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  // ปีงบจาก today ของเซิร์ฟเวอร์ (เวลากรุงเทพฯ) — ไม่ใช้นาฬิกาเครื่องผู้ใช้ และไม่คำนวณตอน SSR
  const fiscalYear = summary ? fiscalYearOf(summary.today) : null;
  // ย่อ = ซ่อนป้ายทุกขนาดจอ · ไม่ย่อ = ซ่อนป้ายเฉพาะจอแคบกว่า md (สเปกข้อ 6)
  const labelClass = collapsed ? 'hidden' : 'hidden md:inline';
  const displayName = me?.name ?? me?.email ?? (clerkOn ? 'ผู้ใช้งาน' : 'โหมดทดสอบ (dev-open)');

  return (
    <>
      <Head>
        <title>{`${title} · ระบบสารบรรณ`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className={`saraban ${sarabanFont.className} flex min-h-screen bg-sb-page text-sb-ink antialiased`}>
        <aside
          className={`sticky top-0 flex h-screen flex-none flex-col gap-1.5 border-r border-sb-line bg-white px-3 py-5 ${
            collapsed ? 'w-[72px]' : 'w-[72px] md:w-[236px] md:px-3.5'
          }`}
        >
          <div className="flex items-center gap-2.5 px-1.5 pb-[18px] pt-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- ตราเล็กไฟล์เดียว ไม่ต้องผ่าน next/image */}
            <img src="/saraban/logo.jpeg" alt="ตราเทศบาล" className="h-10 w-10 flex-none rounded-full object-cover" />
            <div className={`leading-tight ${labelClass}`}>
              <p className="text-sm font-bold">ระบบสารบรรณอิเล็กทรอนิกส์</p>
              <p className="text-xs text-sb-muted">เทศบาลตำบลน้ำแพร่พัฒนา</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = router.pathname.startsWith(item.href);
              const badge = item.badge ? summary?.inboxPending ?? 0 : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-sm ${
                    active ? 'bg-sb-accent-light font-semibold text-sb-accent' : 'font-medium text-sb-ink-2 hover:bg-sb-subtle'
                  }`}
                >
                  <span
                    className={`relative inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] ${
                      active ? 'bg-sb-accent text-white' : 'bg-sb-subtle text-sb-muted'
                    }`}
                  >
                    <Icon name={item.icon} size={18} />
                    {/* จุดแดงบนไอคอน — แทนตัวเลขตอนป้ายถูกซ่อน (ย่อเมนู หรือจอแคบกว่า md) */}
                    {badge > 0 ? (
                      <span className={`absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-sb-danger ${collapsed ? '' : 'md:hidden'}`} />
                    ) : null}
                  </span>
                  <span className={`flex-1 ${labelClass}`}>{item.label}</span>
                  {badge > 0 ? (
                    <span title="รอเกษียน" className={`rounded-full bg-sb-danger px-[7px] py-px text-[11px] font-bold text-white ${labelClass}`}>
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          <Link
            href="/admin"
            title="กลับหลังบ้าน"
            className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] text-sb-muted hover:bg-sb-subtle"
          >
            <Icon name="arrow_back" size={18} />
            <span className={labelClass}>กลับหลังบ้าน</span>
          </Link>
          <div className="flex items-center gap-2.5 border-t border-sb-line px-1.5 pt-2.5">
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-sb-accent-light text-[13px] font-bold text-sb-accent">
              <Icon name="person" size={18} />
            </div>
            <div className={`min-w-0 text-[13px] leading-snug ${labelClass}`}>
              <p className={`truncate font-semibold ${clerkOn ? '' : 'text-sb-warning-ink'}`}>{displayName}</p>
              {me?.position ? <p className="truncate text-xs text-sb-muted">{me.position}</p> : null}
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[60px] flex-none items-center gap-3.5 border-b border-sb-line bg-white px-4 md:px-7">
            <button
              type="button"
              onClick={toggle}
              title="ย่อ/ขยายเมนู"
              className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg border border-sb-line text-sb-muted hover:bg-sb-hover"
            >
              <Icon name="menu" size={18} />
            </button>
            <h1 className="truncate text-base font-semibold">{title}</h1>
            <div className="flex-1" />
            {fiscalYear ? (
              <span className="hidden whitespace-nowrap text-[13px] text-sb-muted sm:inline">ปีงบประมาณ {fiscalYear}</span>
            ) : null}
            <Link
              href="/saraban/receive"
              className="inline-flex h-9 flex-none items-center gap-1 whitespace-nowrap rounded-[10px] bg-sb-accent px-4 text-sm font-semibold text-white hover:bg-sb-accent-hover"
            >
              <Icon name="add" size={18} />
              <span className="hidden sm:inline">ลงรับหนังสือ</span>
            </Link>
          </header>
          <div className="flex flex-col gap-5 px-4 pb-10 pt-6 md:px-7">
            {actions ? <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div> : null}
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </>
  );
}
