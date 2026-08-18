// pages/disaster/insights.tsx — พอร์ตจาก namphrae-map/pages/insights.tsx (134 บรรทัด)
// ยกตรรกะสถิติ/choropleth มาเกือบทั้งหมด แต่เปลี่ยน chrome: TopNav/SubTabs
// ของ map ทิ้งไป ใช้ SiteHeader ของพอร์ทัล + ลิงก์กลับ /disaster แทน
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import SiteHeader from '@/components/SiteHeader';
import { getConfig, toPublicConfig } from '@/lib/config-store';
import { DISASTER_TYPES, DISASTER_LABELS } from '@/lib/disaster-types';
import type { IncidentItem } from '@/types/disaster';
import { villageOf } from '@/lib/village-geo';
import { countByYearType, countByMonth, countByVillage } from '@/lib/disaster-stats';
import { pickOne, readYear } from '@/lib/url-state';
import { useVillages } from '@/hooks/use-villages';
import { DISASTER_SCALE } from '@/lib/color-scales';
import SeasonalChart from '@/components/disaster/SeasonalChart';
import TypeYearChart from '@/components/disaster/TypeYearChart';
import type { PublicConfig } from '@/types/portal';

// leaflet แตะ window ตั้งแต่ตอนโหลดโมดูล จึงต้องกัน SSR ไว้ — recharts (สองกราฟ
// ด้านล่าง) ไม่แตะ leaflet เลยยังคง import ตรงได้
const ChoroplethMap = dynamic(() => import('@/components/disaster/ChoroplethMap'), { ssr: false });

const CHORO_FILTERS = ['ALL', ...DISASTER_TYPES] as const;
type ChoroFilter = (typeof CHORO_FILTERS)[number];

export default function DisasterInsightsPage({ config }: { config: PublicConfig }) {
  const router = useRouter();
  const [all, setAll] = useState<IncidentItem[]>([]);
  const villages = useVillages();
  const choroType = pickOne<ChoroFilter>(router.query.type, CHORO_FILTERS, 'ALL');
  const year = readYear(router.query.year);

  function setQuery(patch: Record<string, string | null>) {
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(router.query)) if (typeof v === 'string') q[k] = v;
    for (const [k, v] of Object.entries(patch)) { if (v === null) delete q[k]; else q[k] = v; }
    router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true });
  }
  const setChoroType = (t: ChoroFilter) => setQuery({ type: t });
  const setYear = (y: number | null) => setQuery({ year: y === null ? null : String(y) });

  useEffect(() => {
    fetch('/api/disaster/incidents')
      .then((r) => r.json())
      .then((j: { incidents: IncidentItem[] }) => setAll(j.incidents ?? []));
  }, []);

  const filteredForYear = useMemo(() => (year === null ? all : all.filter((it) => it.year === year)), [all, year]);
  const yearData = useMemo(() => countByYearType(all), [all]);
  const monthData = useMemo(() => countByMonth(filteredForYear), [filteredForYear]);
  const villageCounts = useMemo(() => {
    if (!villages) return {};
    const subset = choroType === 'ALL' ? filteredForYear : filteredForYear.filter((it) => it.disasterType === choroType);
    return countByVillage(subset, (it) => villageOf(it.location.coordinates[0], it.location.coordinates[1], villages.features));
  }, [filteredForYear, villages, choroType]);

  const peakYear = useMemo(() => yearData.reduce<{ y: number; n: number }>((best, r) => {
    const n = DISASTER_TYPES.reduce((a, t) => a + r[t], 0);
    return n > best.n ? { y: r.year, n } : best;
  }, { y: 0, n: -1 }).y, [yearData]);
  const peakMonth = useMemo(() => monthData.reduce<{ m: string; n: number }>((best, r) => {
    const n = r.WILDFIRE + r.FLOOD + r.LANDSLIDE;
    return n > best.n ? { m: r.monthLabel, n } : best;
  }, { m: '—', n: -1 }).m, [monthData]);
  const topVillage = useMemo(() => Object.entries(villageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—', [villageCounts]);

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs ${active ? 'bg-green-deep font-semibold text-white' : 'border border-line bg-white text-ink-soft'}`}>
      {label}
    </button>
  );

  return (
    <main className="flex min-h-screen flex-col bg-paper-deep">
      <SiteHeader site={config.site} />
      <div className="flex-1 space-y-3.5 p-[18px]">
        <div className="flex items-center gap-3.5">
          <div>
            <div className="text-[17px] font-bold text-ink">สถิติเชิงลึก · ตำบลน้ำแพร่</div>
            <div className="text-[11.5px] text-ink-faint">ความหนาแน่นรายหมู่บ้าน · ฤดูกาล · แนวโน้มรายปี ({all.length} เหตุการณ์)</div>
          </div>
          {year !== null && <span className="rounded-md bg-green-deep/10 px-2 py-0.5 text-xs text-green-forest">กรองปี {year}</span>}
          <div className="flex-1" />
          <Link href="/disaster" className="text-[12.5px] font-medium text-green-deep hover:underline">← กลับแผนที่</Link>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { l: 'เหตุการณ์รวม', v: String(all.length) },
            { l: 'ปีพีค', v: peakYear ? `พ.ศ. ${peakYear}` : '—' },
            { l: 'เดือนเสี่ยงสูงสุด', v: peakMonth },
            { l: 'หมู่บ้านกระทบสูงสุด', v: topVillage },
          ].map((k) => (
            <div key={k.l} className="rounded-card border border-line bg-white px-3.5 py-3">
              <div className="text-[10.5px] text-ink-faint">{k.l}</div>
              <div className="mt-1 text-[15px] font-bold text-ink">{k.v}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1.5fr_1fr] gap-3.5">
          <div className="rounded-card border border-line bg-white p-4">
            <div className="mb-2.5 text-[13px] font-bold text-ink">ความหนาแน่นรายหมู่บ้าน (Choropleth)</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {chip('ทั้งหมด', choroType === 'ALL', () => setChoroType('ALL'))}
              {DISASTER_TYPES.map((t) => chip(DISASTER_LABELS[t], choroType === t, () => setChoroType(t)))}
            </div>
            <div className="h-[360px] overflow-hidden rounded-xl">
              {villages ? <ChoroplethMap villages={villages} counts={villageCounts} scale={DISASTER_SCALE} />
                : <p className="text-sm text-ink-mute">กำลังโหลดขอบเขตหมู่บ้าน…</p>}
            </div>
            <div className="mt-2.5 flex items-center gap-2 text-[11px] text-ink-faint">
              <span>น้อย</span>
              <span className="h-2 flex-1 rounded" style={{ background: `linear-gradient(to right, ${DISASTER_SCALE.join(', ')})` }} />
              <span>มาก</span>
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="rounded-card border border-line bg-white p-4">
              <div className="mb-1 text-[13px] font-bold text-ink">ปฏิทินฤดูกาล (แยกตามเดือน)</div>
              <SeasonalChart data={monthData} />
              <p className="mt-1 text-[10px] text-ink-mute">* ไม่รวมภัยแล้ง (ข้อมูลต้นทางมีแต่ปี)</p>
            </div>
            <div className="rounded-card border border-line bg-white p-4">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-[13px] font-bold text-ink">เหตุการณ์รายปี แยกตามภัย</div>
                {year !== null && <button onClick={() => setYear(null)} className="text-[11px] text-green-deep">ล้างปี ({year})</button>}
              </div>
              <TypeYearChart data={yearData} selectedYear={year} onSelectYear={(y) => setYear(y === year ? null : y)} />
              <p className="mt-1 text-[10px] text-ink-mute">คลิกปีในกราฟเพื่อกรอง choropleth + ฤดูกาล</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ISR แบบเดียวกับ map.tsx / disaster/index.tsx
export async function getStaticProps() {
  return { props: { config: toPublicConfig(await getConfig()) }, revalidate: 60 };
}
