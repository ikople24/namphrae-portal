import type { CSSProperties } from 'react';

// Material Symbols Rounded ligature glyph. Decorative by default (aria-hidden)
// — pair with visible text or an aria-label on the interactive parent.
// The name must exist in ICON_NAMES (src/lib/icons.ts) or it renders as text.
export default function Icon({
  name,
  size = 24,
  className = '',
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-rounded select-none ${className}`}
      style={{ fontSize: size, ...style }}
    >
      {name}
    </span>
  );
}
