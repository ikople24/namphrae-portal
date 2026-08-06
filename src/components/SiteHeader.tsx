import Link from 'next/link';
import type { SiteSettings } from '@/types/portal';

// 1c topbar: round logo tile, org name, nav (desktop), phone pill, login.
export default function SiteHeader({ site }: { site: SiteSettings }) {
  const nav = [
    { href: '/#services', label: 'บริการ' },
    { href: '/map', label: 'แผนที่' },
    { href: '/#services', label: 'ข่าวสาร' },
    { href: '/#contact', label: 'ติดต่อ' },
  ];
  return (
    <header className="border-b border-line bg-white">
      <div className="flex items-center gap-3 px-5 py-4 sm:gap-4 sm:px-11 sm:py-5">
        {site.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={site.logoUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-black/10"
          />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-green font-display text-[15px] font-bold text-white">
            {site.orgName.trim().charAt(0)}
          </div>
        )}
        <p className="min-w-0 flex-1 truncate font-display text-[13.5px] font-semibold tracking-[.02em] text-ink sm:flex-none">
          {site.orgName}
        </p>
        <nav className="ml-auto hidden gap-[26px] font-display text-[13px] font-medium md:flex">
          {nav.map((n, i) => (
            <a key={n.label} href={n.href} className={i === 0 ? 'text-green-deep' : 'text-ink-faint hover:text-green-deep'}>
              {n.label}
            </a>
          ))}
        </nav>
        {site.contact?.phone ? (
          <a
            href={`tel:${site.contact.phone.replace(/[^0-9+]/g, '')}`}
            className="hidden rounded-full border border-black/35 px-4 py-2 font-display text-[13px] font-semibold text-green-deep transition hover:bg-green hover:text-white sm:inline-block md:ml-0 ml-auto"
          >
            โทร {site.contact.phone}
          </a>
        ) : null}
        <Link
          href="/admin"
          className="rounded-full border border-black/10 px-4 py-2 font-display text-[13px] font-medium text-ink-soft transition hover:bg-green-025 hover:text-green-deep max-sm:ml-auto"
        >
          เข้าสู่ระบบ
        </Link>
      </div>
    </header>
  );
}
