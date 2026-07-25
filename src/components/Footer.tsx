import type { SiteSettings } from '@/types/portal';
import VisitorCounter from '@/components/VisitorCounter';

export default function Footer({
  site,
  visitorCount,
}: {
  site: SiteSettings;
  visitorCount: number;
}) {
  const { contact } = site;
  return (
    <footer className="mt-4 bg-emerald-deep text-white">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="font-display text-lg font-semibold">{site.orgName}</p>
            {site.orgSubName ? (
              <p className="mt-1 text-sm text-white/70">{site.orgSubName}</p>
            ) : null}
            {contact?.address ? (
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
                {contact.address}
              </p>
            ) : null}
          </div>
          <dl className="space-y-3 text-sm">
            {contact?.phone ? (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-white/60">โทร</dt>
                <dd>
                  <a
                    href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}
                    className="hover:underline"
                  >
                    {contact.phone}
                  </a>
                </dd>
              </div>
            ) : null}
            {contact?.email ? (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-white/60">อีเมล</dt>
                <dd className="break-all">
                  <a href={`mailto:${contact.email}`} className="hover:underline">
                    {contact.email}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/15 pt-5 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.orgName}
          </p>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
            <span aria-hidden="true">👁</span>
            ผู้เข้าชม{' '}
            <span className="rounded bg-white px-1.5 py-0.5">
              <VisitorCounter initial={visitorCount} />
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
