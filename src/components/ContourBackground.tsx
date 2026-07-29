import { SENSOR_NODES } from '@/lib/live-sample';

// 1c hero decoration: 4 traced contour lines (np-trace, staggered), a scan
// beam sweeping down, and 5 rippling sensor dots. Purely decorative.
export default function ContourBackground() {
  const paths = [
    { d: 'M-40 380 C 240 300 460 470 720 370 S 1100 460 1330 340', o: 0.3, delay: '0s' },
    { d: 'M-40 430 C 240 350 460 520 720 420 S 1100 510 1330 390', o: 0.22, delay: '.7s' },
    { d: 'M-40 480 C 240 400 460 570 720 470 S 1100 560 1330 440', o: 0.16, delay: '1.4s' },
    { d: 'M-40 530 C 240 450 460 620 720 520 S 1100 610 1330 490', o: 0.1, delay: '2.1s' },
  ];

  return (
    <>
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full opacity-40 animate-np-drift"
        viewBox="0 0 1280 560"
        preserveAspectRatio="none"
        fill="none"
        stroke="#34b863"
        strokeWidth="1.4"
      >
        {paths.map((p) => (
          <path
            key={p.d}
            d={p.d}
            strokeOpacity={p.o}
            strokeDasharray={1400}
            className="animate-np-trace"
            style={{ animationDelay: p.delay }}
          />
        ))}
      </svg>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[120px] animate-np-scan"
        style={{
          background:
            'linear-gradient(180deg, rgba(102,187,106,0) 0%, rgba(102,187,106,.12) 70%, rgba(102,187,106,.55) 100%)',
        }}
      />
      {SENSOR_NODES.map((n) => (
        <span
          key={n.x + n.y}
          aria-hidden="true"
          className="absolute grid h-3 w-3 place-items-center"
          style={{ left: n.x, top: n.y }}
        >
          <span
            className="absolute inset-0 rounded-full bg-green-mid animate-np-ripple"
            style={{ animationDelay: n.delay }}
          />
          <span className="h-[5px] w-[5px] rounded-full bg-green-mid shadow-[0_0_10px_rgba(102,187,106,.7)]" />
        </span>
      ))}
    </>
  );
}
