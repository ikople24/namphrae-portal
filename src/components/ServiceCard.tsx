import type { PublicLink } from '@/types/portal';
import ServiceThumb from '@/components/ServiceThumb';

// One service tile. Records a click (best-effort, non-blocking) then follows the
// link. Disabled gracefully when the URL is empty (placeholder services).
export default function ServiceCard({
  link,
  accent,
}: {
  link: PublicLink;
  accent: string;
}) {
  const hasUrl = Boolean(link.url);

  function track() {
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon(`/api/track/${encodeURIComponent(link.id)}`);
    }
  }

  const inner = (
    <>
      <ServiceThumb src={link.imageUrl} title={link.title} accent={accent} />
      <div className="mt-3 flex-1">
        <h3 className="font-display text-[15px] font-semibold leading-snug text-ink">
          {link.title}
        </h3>
        {link.subtitle ? (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-ink-soft">
            {link.subtitle}
          </p>
        ) : null}
      </div>
    </>
  );

  const cardStyle = { '--card-accent': accent } as React.CSSProperties;
  const base =
    'service-card group flex flex-col rounded-[var(--radius-card)] border border-black/[0.06] bg-surface p-3 text-left';

  if (!hasUrl) {
    return (
      <div
        className={`${base} cursor-default opacity-70`}
        style={cardStyle}
        aria-disabled="true"
      >
        {inner}
      </div>
    );
  }

  return (
    <a
      href={link.url}
      target={link.openInNewTab ? '_blank' : undefined}
      rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
      onClick={track}
      onAuxClick={track}
      className={base}
      style={cardStyle}
    >
      {inner}
    </a>
  );
}
