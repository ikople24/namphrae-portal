// shell ของโหมดเจ้าหน้าที่ (ต้นแบบ "โหมดเจ้าหน้าที่") — จอเดียวกว้างไม่เกิน 720px ไม่มี sidebar
// ปุ่มหลักอยู่ bottom bar ของแต่ละหน้า (ส่งเข้ามาทาง bottom)
import Head from 'next/head';
import Link from 'next/link';
import type { ReactNode } from 'react';
import useSWR from 'swr';
import Icon from '@/components/Icon';
import { Toaster } from '@/components/saraban/toast';
import { adminFetcher } from '@/lib/admin-api';
import { isClerkPublicConfigured } from '@/lib/clerk-config';
import { sarabanFont } from '@/lib/saraban-font';

export default function MemberShell({
  title,
  subtitle,
  canFull,
  back,
  bottom,
  children,
}: {
  title: string;
  subtitle?: string; // ชื่อตำแหน่ง
  canFull: boolean; // มีสิทธิ์ saraban → โชว์ปุ่ม "โหมดเต็ม"
  back?: string; // href ปุ่มย้อน (หน้าหนังสือ)
  bottom?: ReactNode;
  children: ReactNode;
}) {
  const clerkOn = isClerkPublicConfigured();
  const { data: me } = useSWR<{ name: string | null; email: string | null }>(
    clerkOn ? '/api/admin/me' : null,
    adminFetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const who = me?.name ?? me?.email ?? (clerkOn ? '' : 'โหมดทดสอบ (dev-open)');

  return (
    <>
      <Head>
        <title>{`${title} · ระบบสารบรรณ`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className={`saraban ${sarabanFont.className} min-h-screen bg-[#F7F9FB] text-sb-ink antialiased`}>
        <div className="mx-auto flex min-h-screen max-w-[720px] flex-col">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-sb-line bg-white px-4 py-3">
            {back ? (
              <Link href={back} aria-label="ย้อนกลับ" className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-sb-muted hover:bg-sb-hover">
                <Icon name="arrow_back" size={22} />
              </Link>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- ตราเล็กไฟล์เดียว
              <img src="/saraban/logo.jpeg" alt="ตราเทศบาล" className="h-9 w-9 flex-none rounded-full object-cover" />
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <h1 className="truncate text-base font-bold">{title}</h1>
              <p className="truncate text-xs text-sb-muted">{[who, subtitle].filter(Boolean).join(' · ')}</p>
            </div>
            {canFull ? (
              <Link href="/saraban/inbox" className="inline-flex h-11 flex-none items-center rounded-xl border border-sb-line px-3 text-sm font-semibold text-sb-ink-2 hover:bg-sb-hover">
                โหมดเต็ม
              </Link>
            ) : null}
          </header>
          <main className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-4">{children}</main>
          {bottom ? (
            <div className="sticky bottom-0 border-t border-sb-line bg-white/85 px-4 py-3 backdrop-blur">{bottom}</div>
          ) : null}
        </div>
      </div>
      <Toaster />
    </>
  );
}
