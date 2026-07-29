import Icon from '@/components/Icon';
import { TICKER_SAMPLE } from '@/lib/live-sample';

// LIVE SENSORS bar under the topbar (1c). Marquee = one track, two copies of
// the list, translateX(-50%) loop. Hidden on mobile (1c Mobile has no ticker).
// Values are handoff samples — see src/lib/live-sample.ts.
export default function LiveTicker({ pm }: { pm: number }) {
  const items = TICKER_SAMPLE.map((t) => ({
    ...t,
    value: t.isPm ? String(pm) : t.value ?? '',
  }));
  const loop = [...items, ...items];

  return (
    <div className="hidden items-center overflow-hidden border-b border-line bg-white sm:flex">
      <span className="flex flex-none items-center gap-2 bg-green-forest px-[18px] py-[9px] font-display text-[10.5px] font-bold tracking-[.18em] text-white">
        <span className="h-[7px] w-[7px] rounded-full bg-white animate-np-blink" />
        LIVE SENSORS
      </span>
      <div className="relative h-9 min-w-0 flex-1 overflow-hidden">
        <div className="absolute left-0 top-0 flex h-9 w-[200%] items-center animate-np-marquee">
          {loop.map((t, i) => (
            <span
              key={i}
              className="flex flex-none items-center gap-2 whitespace-nowrap px-[26px] font-display text-xs font-medium text-ink-soft"
            >
              <Icon name={t.icon} size={17} style={{ color: t.color }} />
              {t.label}
              <strong className="text-green-deep [font-variant-numeric:tabular-nums]">
                {t.value}
              </strong>
              <span className="text-ink-mute">{t.unit}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
