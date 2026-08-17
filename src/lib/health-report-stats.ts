import type { DengueCase } from '@/types/health';
import { haversineMeters } from '@/lib/village-geo';

const THAI_MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export interface MonthCount { key: string; label: string; count: number }

/** นับเคสต่อเดือน-ปี (key 'YYYY-MM') เรียงตามเวลา; label เป็น "เดือน พ.ศ." */
export function dengueByMonth(cases: DengueCase[]): MonthCount[] {
  const map = new Map<string, number>();
  for (const cs of cases) {
    const d = new Date(cs.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => {
      const [y, m] = key.split('-').map(Number);
      return { key, label: `${THAI_MONTH_ABBR[m - 1]} ${y + 543}`, count };
    });
}

export interface DengueKpis { total: number; latestDate: string | null; topCommunity: string | null }

export function dengueKpis(cases: DengueCase[]): DengueKpis {
  if (cases.length === 0) return { total: 0, latestDate: null, topCommunity: null };
  let latestDate = cases[0].date;
  const byCommunity = new Map<string, number>();
  for (const cs of cases) {
    if (cs.date > latestDate) latestDate = cs.date;
    if (cs.community) byCommunity.set(cs.community, (byCommunity.get(cs.community) ?? 0) + 1);
  }
  let topCommunity: string | null = null;
  let best = -1;
  for (const [k, v] of byCommunity) if (v > best) { topCommunity = k; best = v; }
  return { total: cases.length, latestDate, topCommunity };
}

/** เคสที่รายงานภายใน windowDays วันย้อนหลังจาก now (วันที่ parse ไม่ได้ = ตัดออก; วันที่อนาคตยังนับ) */
export function recentCases(cases: DengueCase[], now: Date, windowDays = 28): DengueCase[] {
  const cutoff = now.getTime() - windowDays * 86400000;
  return cases.filter((cs) => {
    const t = new Date(cs.date).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });
}

export type CaseClass = 'active' | 'gen1' | 'gen2' | 'gen3' | 'gen4';

/**
 * จัดกลุ่มเคสตาม "รุ่นการระบาด" เชิงพื้นที่ (key = _id):
 * - active: รับแจ้ง ≤ windowDays วัน → seed สีน้ำเงินเสมอ (ไม่เลื่อนขั้น)
 * - เฉพาะเคส > windowDays เท่านั้นที่เลื่อนขั้นตามการทับ (≤ radiusM เมตร):
 *   gen2 = ทับ active ≥1, gen3 = ทับสมาชิก gen2 ≥2, gen4 = ทับสมาชิก gen3 ≥2
 * - ที่เหลือ (โดดเดี่ยว) = gen1
 * คำนวณเป็นชั้น (S2→S3→S4) โดยนับจากการเป็นสมาชิกชั้นก่อนหน้า — deterministic
 */
export function classifyCases(
  cases: DengueCase[],
  now: Date,
  opts: { windowDays?: number; radiusM?: number } = {}
): Map<string, CaseClass> {
  const windowDays = opts.windowDays ?? 28;
  const radiusM = opts.radiusM ?? 100;
  const cutoff = now.getTime() - windowDays * 86400000;
  const isActive = (c: DengueCase) => {
    const t = new Date(c.date).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  };

  const active: DengueCase[] = [];
  const nonActive: DengueCase[] = [];
  for (const c of cases) (isActive(c) ? active : nonActive).push(c);

  // จำนวนเคสใน list ที่อยู่ ≤ radiusM เมตร (ไม่นับตัวเอง)
  const near = (c: DengueCase, list: DengueCase[]) =>
    list.reduce(
      (n, o) =>
        o._id !== c._id &&
        haversineMeters(c.location.lat, c.location.lng, o.location.lat, o.location.lng) <= radiusM
          ? n + 1
          : n,
      0
    );

  const s2 = nonActive.filter((c) => near(c, active) >= 1);
  const s3 = nonActive.filter((c) => near(c, s2) >= 2);
  const s4 = nonActive.filter((c) => near(c, s3) >= 2);
  const s2ids = new Set(s2.map((c) => c._id));
  const s3ids = new Set(s3.map((c) => c._id));
  const s4ids = new Set(s4.map((c) => c._id));

  const out = new Map<string, CaseClass>();
  for (const c of cases) {
    if (isActive(c)) out.set(c._id, 'active');
    else if (s4ids.has(c._id)) out.set(c._id, 'gen4');
    else if (s3ids.has(c._id)) out.set(c._id, 'gen3');
    else if (s2ids.has(c._id)) out.set(c._id, 'gen2');
    else out.set(c._id, 'gen1');
  }
  return out;
}
