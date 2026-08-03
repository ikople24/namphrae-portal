import { useEffect, useState } from 'react';
import type { PublicLink, SiteSettings } from '@/types/portal';
import Icon from '@/components/Icon';
import ContourBackground from '@/components/ContourBackground';
import HeroMedia from '@/components/HeroMedia';
import { HERO_SHORTCUT_IDS, PM_SERIES, pmColor } from '@/lib/live-sample';
import { iconForService } from '@/lib/icons';

// 1c hero: big type, CTAs, count-up stats, air card with sparkline, shortcut
// rows. PM2.5 is MOCK (drifts to feel live) — see src/lib/live-sample.ts.

// 0→1 progress over `ms` with cubic ease-out; jumps to 1 for reduced motion.
function useCountUp(ms = 1600): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - t0) / ms);
      setP(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms]);
  return p;
}

function track(id: string) {
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    navigator.sendBeacon(`/api/track/${encodeURIComponent(id)}`);
  }
}

function AirCard({ pm }: { pm: number }) {
  const ease = useCountUp();
  return (
    <div className="rounded-[20px] border border-line bg-green-025 p-5 text-ink max-sm:px-4 max-sm:py-3.5">
      <div className="flex items-center justify-between">
        <p className="font-display text-xs font-semibold tracking-[.16em] text-green-deep max-sm:text-[11px]">
          อากาศวันนี้ · PM2.5
        </p>
        <span className="relative grid h-3 w-3 place-items-center">
          <span className="absolute inset-0 rounded-full bg-green animate-np-ripple [animation-duration:2.6s]" />
          <span className="h-[7px] w-[7px] rounded-full bg-green" />
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-4">
        <p className="font-display text-[56px] font-bold leading-[.85] tracking-[-.04em] text-green-deep [font-variant-numeric:tabular-nums] max-sm:text-[44px]">
          {Math.round(pm * ease)}
        </p>
        <div className="flex h-[48px] items-end gap-1 max-sm:h-10">
          {PM_SERIES.map((v, i) => (
            <span
              key={i}
              className="w-2 origin-bottom rounded-[3px] animate-np-grow max-sm:w-[7px]"
              style={{
                height: `${Math.round((v / 50) * 100)}%`,
                backgroundColor: pmColor(v),
                animationDelay: `${i * 60}ms`,
              }}
            />
          ))}
        </div>
      </div>
      <p className="mt-1.5 font-display text-[13px] font-semibold text-green-deep">
        µg/m³ · PM2.5 ปานกลาง
      </p>
    </div>
  );
}

export default function Hero({
  site,
  links,
  visitorCount,
  pm,
}: {
  site: SiteSettings;
  links: PublicLink[];
  visitorCount: number;
  pm: number;
}) {
  const ease = useCountUp();
  const featured = links.find((l) => l.isFeatured && l.url);
  const shortcuts = HERO_SHORTCUT_IDS.map((id) => links.find((l) => l.id === id))
    .filter((l): l is PublicLink => Boolean(l && l.url))
    .slice(0, 3);
  const fallback = links.filter((l) => l.url && !l.isFeatured).slice(0, 3);
  const rows = shortcuts.length === 3 ? shortcuts : fallback;
  // Only services with a working URL count as "ready to use".
  const activeCount = links.filter((l) => l.url).length;

  // Hero background: configured media (video/poster + overlay, per admin
  // settings) replaces the contour layer, and the text flips light-on-dark.
  const hero = site.hero;
  const hasMedia =
    hero.mediaType === 'video'
      ? Boolean(hero.videoUrl || hero.posterUrl)
      : hero.mediaType === 'image'
        ? Boolean(hero.posterUrl)
        : false;

  return (
    <section className="relative overflow-hidden px-5 pb-[52px] pt-10 sm:px-11 sm:pt-[60px]">
      {hasMedia ? <HeroMedia hero={hero} /> : <ContourBackground />}
      <div className="relative mx-auto grid max-w-[1440px] items-start gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
        <div>
          <p
            className={`font-display text-xs font-semibold tracking-[.32em] ${
              hasMedia ? 'text-green-hover' : 'text-green'
            }`}
          >
            NAMPHRAE SMART SERVICE
          </p>
          <h1
            className={`mt-[30px] font-display text-[44px] font-bold leading-[.98] tracking-[-.03em] sm:text-[92px] sm:leading-[.94] sm:tracking-[-.035em] ${
              hasMedia ? 'text-white' : 'text-green-deep'
            }`}
          >
            น้ำแพร่
            <br />
            <span className={hasMedia ? 'text-green-hover' : 'text-green-forest'}>
              ทั้งตำบล
            </span>
          </h1>
          <p
            className={`mt-[26px] max-w-[440px] text-base leading-[1.75] ${
              hasMedia ? 'text-white/85' : 'text-ink-soft'
            }`}
          >
            {site.tagline ||
              `${activeCount} บริการออนไลน์ ตั้งแต่ยื่นคำร้องถึงดูค่าฝุ่นรายชั่วโมง เปิดตลอด 24 ชั่วโมง ไม่ต้องเดินทาง`}
          </p>
          <div className="mt-[34px] flex flex-wrap gap-3">
            {featured ? (
              <a
                href={featured.url}
                target={featured.openInNewTab ? '_blank' : undefined}
                rel={featured.openInNewTab ? 'noopener noreferrer' : undefined}
                onClick={() => track(featured.id)}
                onAuxClick={() => track(featured.id)}
                className="inline-flex items-center gap-[9px] rounded-full bg-green px-[30px] py-4 font-display text-[15.5px] font-bold text-white transition hover:bg-green-deep"
              >
                {featured.title}
                <Icon name="arrow_forward" size={21} />
              </a>
            ) : null}
            <a
              href="#services"
              className={`inline-flex items-center gap-[9px] rounded-full border px-[30px] py-4 font-display text-[15.5px] font-semibold transition ${
                hasMedia
                  ? 'border-white/40 text-white hover:bg-white/10'
                  : 'border-black/25 text-green-deep hover:bg-green-025'
              }`}
            >
              ดูบริการทั้งหมด
            </a>
          </div>
          <div className="mt-[46px] flex gap-8 sm:gap-11">
            <div>
              <p
                className={`font-display text-[40px] font-bold leading-none [font-variant-numeric:tabular-nums] ${
                  hasMedia ? 'text-white' : 'text-green-deep'
                }`}
              >
                {Math.round(visitorCount * ease).toLocaleString('th-TH')}
              </p>
              <p className={`mt-1.5 text-xs ${hasMedia ? 'text-white/60' : 'text-ink-faint'}`}>ครั้งที่ประชาชนเข้าใช้</p>
            </div>
            <div>
              <p
                className={`font-display text-[40px] font-bold leading-none ${
                  hasMedia ? 'text-white' : 'text-green-deep'
                }`}
              >
                24 ชม.
              </p>
              <p className={`mt-1.5 text-xs ${hasMedia ? 'text-white/60' : 'text-ink-faint'}`}>เปิดบริการทุกวัน</p>
            </div>
            <div>
              <p
                className={`font-display text-[40px] font-bold leading-none [font-variant-numeric:tabular-nums] ${
                  hasMedia ? 'text-white' : 'text-green-deep'
                }`}
              >
                {Math.round(activeCount * ease)}
              </p>
              <p className={`mt-1.5 text-xs ${hasMedia ? 'text-white/60' : 'text-ink-faint'}`}>ระบบดิจิทัลที่ใช้งานได้</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          <AirCard pm={pm} />
          {rows.map((s) => (
            <a
              key={s.id}
              href={s.url}
              target={s.openInNewTab ? '_blank' : undefined}
              rel={s.openInNewTab ? 'noopener noreferrer' : undefined}
              onClick={() => track(s.id)}
              onAuxClick={() => track(s.id)}
              className={`flex items-center gap-4 rounded-[20px] border px-5 py-[18px] text-ink transition hover:border-green ${
                hasMedia
                  ? 'border-transparent bg-white/95 hover:bg-white'
                  : 'border-black/[0.14] hover:bg-green-025'
              }`}
            >
              <Icon name={iconForService(s.id, s.icon)} size={28} className="text-green" />
              <span className="flex-1 font-display text-base font-semibold">{s.title}</span>
              <Icon name="arrow_outward" size={22} className="text-ink-mute" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
