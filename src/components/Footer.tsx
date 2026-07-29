import type { SiteSettings } from '@/types/portal';
import VisitorCounter from '@/components/VisitorCounter';

// 1c footer: solid green, org identity + manuals + visitor count.
export default function Footer({
  site,
  visitorCount,
}: {
  site: SiteSettings;
  visitorCount: number;
}) {
  const year = new Date().getFullYear() + 543;
  return (
    <footer id="contact" className="bg-green-deep px-5 py-12 text-white sm:px-11">
      <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-[26px] font-bold leading-tight tracking-[-.02em]">
            {site.orgName}
          </p>
          <p className="mt-3.5 text-[13.5px] leading-[1.75] text-white/70">
            {site.contact?.address ? (
              <>
                {site.contact.address}
                <br />
              </>
            ) : null}
            {site.contact?.phone ? (
              <>
                โทร{' '}
                <a
                  href={`tel:${site.contact.phone.replace(/[^0-9+]/g, '')}`}
                  className="hover:text-white"
                >
                  {site.contact.phone}
                </a>
                <br />
              </>
            ) : null}
            {site.contact?.email ? (
              <a href={`mailto:${site.contact.email}`} className="hover:text-white">
                {site.contact.email}
              </a>
            ) : null}
          </p>
        </div>
        <div>
          <p className="mb-3 font-display text-xs font-semibold tracking-[.16em] text-green-100">
            คู่มือ
          </p>
          <div className="flex flex-col gap-[9px] text-[13.5px]">
            {(site.manuals ?? []).map((m) => (
              <a
                key={m.url}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/80 hover:text-white"
              >
                {m.label}
              </a>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 font-display text-xs font-semibold tracking-[.16em] text-green-100">
            ผู้เข้าชม
          </p>
          <p className="font-display text-[34px] font-bold">
            <VisitorCounter initial={visitorCount} />
          </p>
          <p className="mt-5 text-xs text-white/55">
            © {year} {site.orgName}
          </p>
        </div>
      </div>
    </footer>
  );
}
