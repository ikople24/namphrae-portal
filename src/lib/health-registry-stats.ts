// สถิติจากทะเบียนสาธารณสุข (pure)
import type { VillageFeature } from '@/lib/village-geo';

export interface RegistryCase {
  yearBE: number;
  moo: number | null;
  date: string | null; // ISO (onsetDate ?? notifyDate จาก API)
  diagnosis: string;
  careType: string;
}
export interface YearPop { yearBE: number; population: number }

export interface YearCount { yearBE: number; count: number; ratePer100k: number | null }

/** นับเคสต่อปี เรียงปี + อัตราป่วยต่อแสน (null ถ้าไม่มีข้อมูลประชากรปีนั้น) */
export function registryByYear(cases: RegistryCase[], pops: YearPop[]): YearCount[] {
  const popMap = new Map(pops.map((p) => [p.yearBE, p.population]));
  const map = new Map<number, number>();
  for (const c of cases) map.set(c.yearBE, (map.get(c.yearBE) ?? 0) + 1);
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([yearBE, count]) => {
      const pop = popMap.get(yearBE);
      return { yearBE, count, ratePer100k: pop ? Math.round((count * 1000000) / pop) / 10 : null };
    });
}

const THAI_MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export interface RegistryMonthRow { month: number; label: string; count: number }

/** นับต่อเดือน (รวมทุกเคสที่ส่งเข้า) — คืน 12 แถวเสมอ + จำนวนเคสไม่มีวันที่ */
export function registryByMonth(cases: RegistryCase[]): { months: RegistryMonthRow[]; noDate: number } {
  const months: RegistryMonthRow[] = THAI_MONTH_ABBR.map((label, i) => ({ month: i + 1, label, count: 0 }));
  let noDate = 0;
  for (const c of cases) {
    if (!c.date) { noDate++; continue; }
    const m = new Date(c.date).getUTCMonth();
    if (Number.isNaN(m)) { noDate++; continue; }
    months[m].count++;
  }
  return { months, noDate };
}

/** นับต่อหมู่ (key = เลขหมู่) — ข้ามเคสไม่มีหมู่ */
export function registryByMoo(cases: RegistryCase[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const c of cases) {
    if (c.moo === null) continue;
    out[c.moo] = (out[c.moo] ?? 0) + 1;
  }
  return out;
}

/** สัดส่วนเคสนอน รพ. (IPD) จากเคสที่ระบุ OPD/IPD — null ถ้าไม่มีเคสระบุ */
export function ipdShare(cases: RegistryCase[]): number | null {
  let ipd = 0;
  let known = 0;
  for (const c of cases) {
    const t = c.careType.toUpperCase();
    if (t.includes('IPD')) { ipd++; known++; }
    else if (t.includes('OPD')) known++;
  }
  return known ? ipd / known : null;
}

/** เลขหมู่ → title ใน geojson เช่น "หมู่8-บ้านแม่ขนิลใต้" (null = ไม่พบ) */
export function mooTitle(moo: number, features: VillageFeature[]): string | null {
  return features.find((f) => f.properties.title.startsWith(`หมู่${moo}-`))?.properties.title ?? null;
}

/** counts รายหมู่ → counts key ตาม title (รูปแบบที่ ChoroplethMap ใช้) — หมู่ที่ไม่มีใน geojson ถูกตัด */
export function mooCountsToVillageCounts(byMoo: Record<number, number>, features: VillageFeature[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [moo, n] of Object.entries(byMoo)) {
    const t = mooTitle(Number(moo), features);
    if (t) out[t] = (out[t] ?? 0) + n;
  }
  return out;
}

/** มัธยฐาน — n คู่ = เฉลี่ยสองค่ากลาง; อาเรย์ว่าง = null */
export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface YearStat { yearBE: number; population: number; thaiCases: number }

export interface YearComparisonRow {
  yearBE: number;
  total: number;
  thai: number | null;
  foreign: number | null;
  population: number | null;
  ratePer100kThai: number | null;
  medianRatePrev5: number | null;
  hasRegistry: boolean;
}

/** เปรียบเทียบรายปี: เคสรวม/ไทย/ต่างด้าว/อัตราป่วยไทย/มัธยฐานอัตรา5ปี */
export function yearlyComparison(cases: RegistryCase[], yearStats: YearStat[]): YearComparisonRow[] {
  const countByYear = new Map<number, number>();
  for (const c of cases) countByYear.set(c.yearBE, (countByYear.get(c.yearBE) ?? 0) + 1);
  const statByYear = new Map<number, YearStat>();
  for (const s of yearStats) statByYear.set(s.yearBE, s);
  const years = [...new Set([...countByYear.keys(), ...statByYear.keys()])].sort((a, b) => a - b);
  // อัตราต่อแสน (2 ตำแหน่ง) เฉพาะปีที่ประชากร > 0 — ให้ตรงเลขทางการ (เช่น 734.16)
  const rateByYear = new Map<number, number>();
  for (const s of yearStats) if (s.population) rateByYear.set(s.yearBE, Math.round((s.thaiCases * 1e7) / s.population) / 100);
  return years.map((y) => {
    const total = countByYear.get(y) ?? 0;
    const stat = statByYear.get(y);
    const thai = stat ? stat.thaiCases : null;
    const population = stat ? stat.population : null;
    const hasRegistry = countByYear.has(y);
    const foreign = thai !== null && hasRegistry ? Math.max(0, total - thai) : null;
    const ratePer100kThai = rateByYear.get(y) ?? null;
    const priorRates = years
      .filter((yy) => yy < y && rateByYear.has(yy))
      .slice(-5)
      .map((yy) => rateByYear.get(yy)!);
    const medianRatePrev5 = priorRates.length ? median(priorRates) : null;
    return { yearBE: y, total, thai, foreign, population, ratePer100kThai, medianRatePrev5, hasRegistry };
  });
}

export interface MooYearRow { yearBE: number; moo: number; count: number }

/** รวม count ต่อปี เรียงปี — รูป YearCount (ratePer100k null) ใช้กับ RegistryYearChart ได้ */
export function mooYearByYear(rows: MooYearRow[]): { yearBE: number; count: number; ratePer100k: number | null }[] {
  const byYear = new Map<number, number>();
  for (const r of rows) byYear.set(r.yearBE, (byYear.get(r.yearBE) ?? 0) + r.count);
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([yearBE, count]) => ({ yearBE, count, ratePer100k: null }));
}

/** รวม count ต่อหมู่ กรองปี (null = ทุกปี) */
export function mooYearToByMoo(rows: MooYearRow[], year: number | null): Record<number, number> {
  const out: Record<number, number> = {};
  for (const r of rows) {
    if (year !== null && r.yearBE !== year) continue;
    out[r.moo] = (out[r.moo] ?? 0) + r.count;
  }
  return out;
}

const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export interface MonthlyMultiYearRow { month: number; label: string; median: number; [year: string]: number | string }

/** เคสรายเดือนต่อปี (จำนวนเคสรวม) + มัธยฐานรายเดือนของปีที่ระบุ — 12 แถว */
export function monthlyByYear(cases: RegistryCase[], years: number[]): MonthlyMultiYearRow[] {
  const yearSet = new Set(years);
  const counts = new Map<number, number[]>();
  for (const y of years) counts.set(y, new Array(12).fill(0));
  for (const c of cases) {
    if (!yearSet.has(c.yearBE) || !c.date) continue;
    const d = new Date(c.date);
    if (Number.isNaN(d.getTime())) continue;
    counts.get(c.yearBE)![d.getMonth()] += 1;
  }
  const rows: MonthlyMultiYearRow[] = [];
  for (let m = 0; m < 12; m++) {
    const row: MonthlyMultiYearRow = { month: m + 1, label: MONTH_TH[m], median: 0 };
    const vals: number[] = [];
    for (const y of years) { const v = counts.get(y)![m]; row[String(y)] = v; vals.push(v); }
    row.median = median(vals) ?? 0;
    rows.push(row);
  }
  return rows;
}
