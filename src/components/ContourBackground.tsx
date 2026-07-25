// Signature motif: layered topographic contour lines that drift slowly, evoking
// spreading water (น้ำแพร่) and the area's maps. Purely decorative.
export default function ContourBackground() {
  // Nested rolling curves across a wide viewBox; each is offset vertically.
  const lines = Array.from({ length: 9 }, (_, i) => {
    const y = 90 + i * 52;
    const amp = 26 + (i % 3) * 10;
    const d = `M -50 ${y}
      C 180 ${y - amp}, 320 ${y + amp}, 520 ${y - amp * 0.5}
      S 900 ${y + amp}, 1080 ${y - amp * 0.8}
      S 1360 ${y + amp * 0.6}, 1450 ${y}`;
    return { d, o: 0.05 + (i % 4) * 0.045 };
  });

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1400 600"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <g className="contour-drift" stroke="#ffffff" strokeWidth="1.5">
        {lines.map((l, i) => (
          <path key={i} d={l.d} strokeOpacity={l.o} />
        ))}
      </g>
      {/* Faint "source" ripple, off to one side. */}
      <g className="contour-drift" stroke="#ffffff" fill="none">
        {[70, 130, 200, 280].map((r, i) => (
          <circle
            key={r}
            cx="1180"
            cy="150"
            r={r}
            strokeOpacity={0.12 - i * 0.02}
            strokeWidth="1.5"
          />
        ))}
      </g>
    </svg>
  );
}
