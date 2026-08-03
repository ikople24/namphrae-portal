import { useEffect, useState } from 'react';
import type { HeroMedia as HeroMediaType } from '@/types/portal';

// Full-bleed hero backdrop (video or image) + darkening overlay. Rendered by
// Hero only when media is configured; video autoplays muted/looped and falls
// back to the poster image when the viewer prefers reduced motion.
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
          color-mix(in srgb, var(--color-green-deep) 82%, transparent),
          color-mix(in srgb, var(--color-green-deep) ${Math.round(
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

  // Video configured but no poster and motion is reduced: plain deep green.
  if (hero.mediaType === 'video' && hero.videoUrl) {
    return <div className="absolute inset-0 bg-green-deep" aria-hidden="true" />;
  }

  return null;
}
