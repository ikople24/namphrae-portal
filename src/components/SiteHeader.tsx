import type { SiteSettings } from '@/types/portal';

// Slim, quiet header. The hero carries the brand; this just anchors identity and
// the one-tap phone number for residents who want to call.
export default function SiteHeader({ site }: { site: SiteSettings }) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-paper/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-2.5 sm:px-8">
        {site.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={site.logoUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-black/10"
          />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald text-sm font-semibold text-white">
            {site.orgName.trim().charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-display text-sm font-semibold text-ink">
            {site.orgName}
          </p>
          {site.orgSubName ? (
            <p className="truncate text-[11px] text-ink-soft">
              {site.orgSubName}
            </p>
          ) : null}
        </div>
        {site.contact?.phone ? (
          <a
            href={`tel:${site.contact.phone.replace(/[^0-9+]/g, '')}`}
            className="hidden shrink-0 rounded-full border border-emerald/30 px-3 py-1.5 text-sm font-medium text-emerald-deep transition hover:bg-emerald-050 sm:inline-block"
          >
            โทร {site.contact.phone}
          </a>
        ) : null}
      </div>
    </header>
  );
}
