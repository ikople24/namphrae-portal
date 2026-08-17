import type { IncidentItem } from '@/types/disaster';
import { DISASTER_TYPES, type DisasterType } from '@/lib/disaster-types';

export interface Kpis {
  total: number;
  topType: DisasterType | null;
  peakYear: number | null;
  topVillage: string | null;
}

function topKey<K>(m: Map<K, number>): K | null {
  let best: K | null = null;
  let bestCount = -1;
  for (const [k, c] of m) {
    if (c > bestCount) { best = k; bestCount = c; }
  }
  return best;
}

export function computeKpis(
  incidents: IncidentItem[],
  villageFor?: (it: IncidentItem) => string | null
): Kpis {
  const byType = new Map<DisasterType, number>();
  const byYear = new Map<number, number>();
  const byVillage = new Map<string, number>();
  for (const it of incidents) {
    byType.set(it.disasterType, (byType.get(it.disasterType) ?? 0) + 1);
    byYear.set(it.year, (byYear.get(it.year) ?? 0) + 1);
    const v = villageFor?.(it) ?? null;
    if (v) byVillage.set(v, (byVillage.get(v) ?? 0) + 1);
  }
  return {
    total: incidents.length,
    topType: topKey(byType),
    peakYear: topKey(byYear),
    topVillage: topKey(byVillage),
  };
}

const THAI_MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export type YearTypeRow = { year: number } & Record<DisasterType, number>;

/** นับเหตุการณ์ต่อปี แยกตามภัย (เติม 0 ให้ภัยที่ไม่มี) เรียงปีจากน้อยไปมาก */
export function countByYearType(incidents: IncidentItem[]): YearTypeRow[] {
  const byYear = new Map<number, YearTypeRow>();
  for (const it of incidents) {
    let row = byYear.get(it.year);
    if (!row) {
      row = { year: it.year } as YearTypeRow;
      for (const t of DISASTER_TYPES) row[t] = 0;
      byYear.set(it.year, row);
    }
    row[it.disasterType] += 1;
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

export interface MonthRow {
  month: number; // 1..12
  monthLabel: string;
  WILDFIRE: number;
  FLOOD: number;
  LANDSLIDE: number;
}

/** นับเหตุการณ์ต่อเดือน (จากฟิลด์ date ISO) แยกภัย — ไม่รวมภัยแล้ง (ไม่มีวันที่จริง); คืน 12 แถวเสมอ */
export function countByMonth(incidents: IncidentItem[]): MonthRow[] {
  const rows: MonthRow[] = THAI_MONTH_ABBR.map((label, i) => ({
    month: i + 1, monthLabel: label, WILDFIRE: 0, FLOOD: 0, LANDSLIDE: 0,
  }));
  for (const it of incidents) {
    if (it.disasterType === 'DROUGHT') continue;
    const m = new Date(it.date).getUTCMonth(); // 0..11
    if (Number.isNaN(m)) continue;
    rows[m][it.disasterType as 'WILDFIRE' | 'FLOOD' | 'LANDSLIDE'] += 1;
  }
  return rows;
}

/** นับต่อหมู่บ้าน (คืน { ชื่อหมู่บ้าน: จำนวน }) — ข้ามรายการที่ villageFor คืน null; generic ใช้ได้ทั้ง incident/dengue */
export function countByVillage<T>(
  items: T[],
  villageFor: (it: T) => string | null
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const v = villageFor(it);
    if (v) out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}
