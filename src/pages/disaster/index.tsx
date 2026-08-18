// pages/disaster/index.tsx — พอร์ตจาก namphrae-map/pages/index.tsx (206 บรรทัด)
// ยกตรรกะ state/KPI/ไทม์ไลน์มาเกือบทั้งหมด แต่เปลี่ยน chrome: TopNav/SubTabs
// ของ map ทิ้งไป ใช้ SiteHeader ของพอร์ทัลแทน (ดู src/pages/map.tsx)
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import SiteHeader from '@/components/SiteHeader';
import { getConfig, toPublicConfig } from '@/lib/config-store';
import { DISASTER_TYPES, DISASTER_LABELS, DISASTER_COLORS, type DisasterType } from '@/lib/disaster-types';
import type { IncidentItem, YearStat } from '@/types/disaster';
import { villageOf } from '@/lib/village-geo';
import { computeKpis, countByVillage } from '@/lib/disaster-stats';
import { pickOne, readYear } from '@/lib/url-state';
import { useVillages } from '@/hooks/use-villages';
import { GlassPanel, CommandBar, Segmented } from '@/components/disaster/ui';
import type { DisplayMode, BaseLayer } from '@/components/disaster/MapView';
import type { PublicConfig } from '@/types/portal';

// leaflet แตะ window ตั้งแต่ตอนโหลดโมดูล จึงต้องกัน SSR ไว้ (เหมือน map.tsx)
const MapView = dynamic(() => import('@/components/disaster/MapView'), { ssr: false });
const MODES = ['markers', 'cluster', 'heat'] as const;
const MODE_OPTS: { value: DisplayMode; label: string }[] = [
  { value: 'markers', label: 'หมุด' }, { value: 'cluster', label: 'กระจุก' }, { value: 'heat', label: 'ความหนาแน่น' },
];
const BASE_OPTS: { value: BaseLayer; label: string }[] = [
  { value: 'road', label: 'ถนน' }, { value: 'satellite', label: 'ดาวเทียม' },
];

export default function DisasterMapPage({ config }: { config: PublicConfig }) {
  const router = useRouter();
  const [all, setAll] = useState<IncidentItem[]>([]);
  const [stats, setStats] = useState<YearStat[]>([]);
  const villages = useVillages();
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('road');
  const [playing, setPlaying] = useState(false);

  const type = pickOne<DisasterType>(router.query.type, DISASTER_TYPES, 'WILDFIRE');
  const year = readYear(router.query.year);
  const mode = pickOne<DisplayMode>(router.query.mode, MODES, 'markers');

  function setQuery(patch: Record<string, string | null>) {
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(router.query)) if (typeof v === 'string') q[k] = v;
    for (const [k, v] of Object.entries(patch)) { if (v === null) delete q[k]; else q[k] = v; }
    router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true });
  }
  const setType = (t: DisasterType) => setQuery({ type: t, year: null });
  const setYear = (y: number | null) => setQuery({ year: y === null ? null : String(y) });
  const setMode = (m: DisplayMode) => setQuery({ mode: m });

  useEffect(() => {
    fetch('/api/disaster/stats')
      .then((r) => r.json())
      .then((j: { stats: YearStat[] }) => setStats(j.stats ?? []));
  }, []);
  useEffect(() => {
    if (!router.isReady) return;
    fetch(`/api/disaster/incidents?type=${type}`)
      .then((r) => r.json())
      .then((j: { incidents: IncidentItem[] }) => setAll(j.incidents ?? []));
  }, [router.isReady, type]);

  // ปีที่มีข้อมูลจริง (ตัดปีว่างออกจากไทม์ไลน์)
  const availableYears = useMemo(() => {
    const s = new Set<number>();
    for (const st of stats) if (st.count > 0) s.add(st.year);
    return [...s].sort((a, b) => a - b);
  }, [stats]);

  // ตัวเล่นไทม์ไลน์: เล่นไล่ปีอัตโนมัติ
  // เขียน ref ใน useEffect ไม่ใช่ตรง ๆ ตอน render — eslint-plugin-react-hooks รุ่นนี้
  // ห้าม assign ref.current ระหว่าง render (react-hooks/refs); effect ยังรันทัน
  // ก่อน interval tick ถัดไปเสมอ (1200ms) จึง ref อ่านค่าล่าสุดได้เหมือนเดิม
  const yearRef = useRef(year);
  const yearsRef = useRef(availableYears);
  useEffect(() => {
    yearRef.current = year;
  }, [year]);
  useEffect(() => {
    yearsRef.current = availableYears;
  }, [availableYears]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const years = yearsRef.current;
      if (years.length === 0) return;
      const cur = yearRef.current;
      const curIdx = cur === null ? -1 : years.indexOf(cur);
      setYear(years[(curIdx + 1) % years.length]);
    }, 1200);
    return () => clearInterval(id);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const yearIdx = year === null ? 0 : availableYears.indexOf(year) + 1;

  const filtered = useMemo(() => (year === null ? all : all.filter((it) => it.year === year)), [all, year]);
  const villageFor = villages
    ? (it: IncidentItem) => villageOf(it.location.coordinates[0], it.location.coordinates[1], villages.features)
    : undefined;
  const kpis = useMemo(() => computeKpis(filtered, villageFor), [filtered, villages]);
  const countsByType = useMemo(() => {
    const m: Record<string, number> = { WILDFIRE: 0, FLOOD: 0, LANDSLIDE: 0, DROUGHT: 0 };
    for (const s of stats) m[s.disasterType] += s.count;
    return m as Record<DisasterType, number>;
  }, [stats]);
  const topVillages = useMemo(() => {
    if (!villages) return [] as { name: string; n: number }[];
    const rec = countByVillage(filtered, (it) => villageOf(it.location.coordinates[0], it.location.coordinates[1], villages.features));
    return Object.entries(rec).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 4);
  }, [filtered, villages]);
  const maxVillage = topVillages[0]?.n ?? 1;

  return (
    <main className="flex h-screen flex-col bg-paper-deep">
      <SiteHeader site={config.site} />

      <div className="relative flex-1">
        <div className="absolute inset-0 z-0"><MapView incidents={filtered} villages={villages} displayMode={mode} baseLayer={baseLayer} /></div>

        {/* title chip */}
        <GlassPanel className="absolute left-4 top-4 z-[4] px-4 py-3">
          <div className="text-sm font-bold text-ink">แผนที่ภัยพิบัติ · ตำบลน้ำแพร่</div>
          <div className="mt-0.5 text-[11px] text-ink-faint">แสดง {filtered.length} เหตุการณ์ · 11 หมู่บ้าน</div>
        </GlassPanel>

        {/* KPI pills */}
        <div className="absolute left-1/2 top-4 z-[4] flex -translate-x-1/2 gap-2.5">
          {[
            { v: String(kpis.total), l: 'เหตุการณ์', mono: true },
            { v: kpis.topType ? DISASTER_LABELS[kpis.topType] : '—', l: 'ภัยเด่น', mono: false },
            { v: kpis.peakYear ? String(kpis.peakYear) : '—', l: 'ปีพีค', mono: true },
            { v: kpis.topVillage ?? '—', l: 'หมู่บ้านสูงสุด', mono: false },
          ].map((k) => (
            <GlassPanel key={k.l} className="px-4 py-2 text-center">
              <div className={`text-[19px] font-semibold text-ink ${k.mono ? 'font-mono' : ''}`}>{k.v}</div>
              <div className="text-[10px] text-ink-faint">{k.l}</div>
            </GlassPanel>
          ))}
        </div>

        {/* analytics drawer */}
        <GlassPanel className="absolute bottom-20 right-4 top-4 z-[4] flex w-[288px] flex-col overflow-hidden bg-white">
          <div className="border-b border-line px-4 pb-2.5 pt-3.5">
            <div className="text-[13px] font-bold text-ink">สรุปเชิงสถิติ</div>
            <div className="text-[10.5px] text-ink-mute">ตามตัวกรองปัจจุบัน</div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3.5">
            <div className="mb-2.5 text-[11.5px] font-semibold text-ink">สัดส่วนตามประเภทภัย</div>
            {DISASTER_TYPES.map((t) => {
              const total = Object.values(countsByType).reduce((a, b) => a + b, 0) || 1;
              const pct = Math.round(((countsByType[t] ?? 0) / total) * 100);
              return (
                <div key={t} className="mb-2">
                  <div className="mb-1 flex justify-between text-[11.5px]"><span>{DISASTER_LABELS[t]}</span><span className="font-mono">{countsByType[t] ?? 0}</span></div>
                  <div className="h-1.5 rounded bg-paper-deep"><div className="h-1.5 rounded" style={{ width: `${pct}%`, background: DISASTER_COLORS[t] }} /></div>
                </div>
              );
            })}
            <div className="my-4 h-px bg-line" />
            <div className="mb-2.5 text-[11.5px] font-semibold text-ink">หมู่บ้านกระทบสูงสุด</div>
            {topVillages.length === 0 && <div className="text-[11px] text-ink-mute">— ไม่มีข้อมูล —</div>}
            {topVillages.map((v) => (
              <div key={v.name} className="mb-2">
                <div className="mb-1 flex justify-between text-[11.5px]"><span className="truncate">{v.name}</span><span className="font-mono">{v.n}</span></div>
                <div className="h-1.5 rounded bg-paper-deep"><div className="h-1.5 rounded bg-green-deep" style={{ width: `${Math.round((v.n / maxVillage) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* command bar */}
        <CommandBar>
          {/* โหมดแผนที่ */}
          <Segmented options={MODE_OPTS} value={mode} onChange={setMode} />
          <span className="h-6 w-px bg-black/10" />
          {/* ตัวกรองประเภทภัย */}
          <div className="flex items-center gap-1">
            {DISASTER_TYPES.map((t) => {
              const on = type === t;
              return (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11.5px] transition ${on ? 'bg-green-deep font-semibold text-white' : 'text-ink-soft hover:bg-surface-sunken'}`}>
                  <span className="h-2 w-2 rounded-sm" style={{ background: on ? '#fff' : DISASTER_COLORS[t] }} />
                  {DISASTER_LABELS[t]}
                </button>
              );
            })}
          </div>
          <span className="h-6 w-px bg-black/10" />
          {/* ไทม์ไลน์ (สไลเดอร์ + เล่น) */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'หยุดไทม์ไลน์' : 'เล่นไทม์ไลน์'}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-green-deep text-[10px] text-white">
              {playing ? '❚❚' : '▶'}
            </button>
            {/* .tl-range ของ map เป็น global CSS (accent-color เขียว) ที่พอร์ทัลไม่มี
                ใช้ utility ของ Tailwind แทนเพื่อไม่ต้องแตะ globals.css */}
            <input type="range" min={0} max={availableYears.length} value={yearIdx}
              onChange={(e) => { const i = Number(e.target.value); setPlaying(false); setYear(i === 0 ? null : availableYears[i - 1]); }}
              className="w-[116px] cursor-pointer accent-green-deep" />
            <span className="w-[52px] whitespace-nowrap text-[11.5px] font-medium text-ink">{year === null ? 'ทุกปี' : `พ.ศ. ${year}`}</span>
          </div>
          <span className="h-6 w-px bg-black/10" />
          {/* แผนที่ฐาน */}
          <Segmented options={BASE_OPTS} value={baseLayer} onChange={setBaseLayer} />
          <Link href="/admin/disaster" className="rounded-full bg-green-deep px-4 py-2 text-xs font-semibold text-white">+ บันทึก</Link>
        </CommandBar>
      </div>
    </main>
  );
}

// ISR แบบเดียวกับ map.tsx — ที่นี่แค่หาหัวเว็บ (SiteHeader) มาใส่ให้เข้าชุดกับหน้าอื่น
export async function getStaticProps() {
  return { props: { config: toPublicConfig(await getConfig()) }, revalidate: 60 };
}
