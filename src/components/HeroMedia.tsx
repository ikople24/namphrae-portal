import { useEffect, useState } from 'react';
import type { HeroMedia as HeroMediaType } from '@/types/portal';
import ContourBackground from '@/components/ContourBackground';

// Renders the hero backdrop per hero.mediaType. Video autoplays muted/looped,
// but falls back to the poster image when the viewer prefers reduced motion.
export default function HeroMedia({ hero }: { hero: HeroMediaType }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const overlay = (
    <div
      className="absolute inset-0"
      style={{
        background: `linear-gradient(180deg,
          color-mix(in srgb, var(--color-emerald-deep) 82%, transparent),
          color-mix(in srgb, var(--color-emerald-deep) ${Math.round(
            hero.overlayOpacity * 100
          )}%, transparent))`,
      }}
      aria-hidden="true"
    />
  );

  if (hero.mediaType === 'video' && hero.videoUrl && !reduceMotion) {
    return (
      <>
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster={hero.posterUrl || undefined}
        >
          <source src={hero.videoUrl} />
        </video>
        {overlay}
      </>
    );
  }

  if (
    (hero.mediaType === 'image' || hero.mediaType === 'video') &&
    hero.posterUrl
  ) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero.posterUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        {overlay}
      </>
    );
  }

  // mediaType === 'none' (or missing media): gradient + contour signature.
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 130% at 78% 8%, var(--color-emerald) 0%, var(--color-emerald-deep) 58%, #073a32 100%)',
        }}
        aria-hidden="true"
      />
      <ContourBackground />
    </>
  );
}
