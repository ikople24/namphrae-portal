import { useState } from 'react';

// Square thumbnail for a service. Shows the link image when it loads; otherwise
// falls back to a category-tinted tile with the title's first glyph — so the
// grid stays uniform even when a legacy hotlinked image is missing or slow.
export default function ServiceThumb({
  src,
  title,
  accent,
}: {
  src?: string;
  title: string;
  accent: string;
}) {
  const [broken, setBroken] = useState(false);
  const glyph = firstGlyph(title);

  const showImage = src && !broken;

  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-[14px]"
      style={{
        background: `color-mix(in srgb, ${accent} 12%, var(--color-surface))`,
      }}
    >
      {showImage ? (
        // Plain <img>: sources are legacy hotlinks / Cloudinary of unknown size.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span
            className="font-display text-4xl font-semibold leading-none"
            style={{ color: accent }}
          >
            {glyph}
          </span>
        </div>
      )}
    </div>
  );
}

function firstGlyph(title: string): string {
  const trimmed = title.trim();
  // Prefer the first non-space character; works for Thai and Latin.
  return trimmed ? Array.from(trimmed)[0] : '•';
}
