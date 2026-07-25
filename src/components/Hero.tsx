import type { PublicLink, SiteSettings } from '@/types/portal';
import HeroMedia from '@/components/HeroMedia';
import ServiceThumb from '@/components/ServiceThumb';

// Hero: the thesis of the page. States the service, then hands the visitor the
// single most-used action (the featured link) as a large card.
export default function Hero({
  site,
  featured,
}: {
  site: SiteSettings;
  featured: PublicLink[];
}) {
  return (
    <section className="relative isolate overflow-hidden text-white">
      <HeroMedia hero={site.hero} />

      <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-14 sm:px-8 sm:pt-20 md:pb-16">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
          {site.title}
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold leading-[1.12] sm:text-4xl md:text-[2.9rem]">
          {site.brandTitle || site.orgName}
        </h1>
        {site.tagline ? (
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/85 sm:text-base">
            {site.tagline}
          </p>
        ) : null}

        {featured.length > 0 ? (
          <div className="mt-8 grid gap-3 sm:max-w-2xl sm:grid-cols-1">
            {featured.map((link) => (
              <FeaturedCard key={link.id} link={link} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FeaturedCard({ link }: { link: PublicLink }) {
  function track() {
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon(`/api/track/${encodeURIComponent(link.id)}`);
    }
  }

  return (
    <a
      href={link.url || '#'}
      target={link.openInNewTab ? '_blank' : undefined}
      rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
      onClick={track}
      onAuxClick={track}
      className="group flex items-center gap-4 rounded-2xl border border-white/25 bg-white/10 p-3 backdrop-blur transition hover:bg-white/20 sm:p-4"
    >
      <div className="w-16 shrink-0 sm:w-20">
        <ServiceThumb src={link.imageUrl} title={link.title} accent="#a9791f" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-semibold leading-tight sm:text-xl">
          {link.title}
        </p>
        {link.subtitle ? (
          <p className="mt-1 text-sm text-white/80">{link.subtitle}</p>
        ) : null}
      </div>
      <span
        className="ml-1 shrink-0 text-2xl transition group-hover:translate-x-1"
        aria-hidden="true"
      >
        →
      </span>
    </a>
  );
}
