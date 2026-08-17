import { describe, it, expect } from 'vitest';
import {
  registryByYear, registryByMonth, registryByMoo, ipdShare, mooTitle, mooCountsToVillageCounts,
  type RegistryCase,
} from '@/lib/health-registry-stats';
import { median, yearlyComparison, mooYearByYear, mooYearToByMoo, type YearStat, type MooYearRow } from '@/lib/health-registry-stats';
import { monthlyByYear, type MonthlyMultiYearRow } from '@/lib/health-registry-stats';
import type { VillageFeature } from '@/lib/village-geo';

const C = (yearBE: number, extra: Partial<RegistryCase> = {}): RegistryCase =>
  ({ yearBE, moo: 1, date: null, diagnosis: 'DF', careType: 'OPD', ...extra });

const FEATURES = [
  { properties: { title: 'หมู่1-บ้านบ่อ' } },
  { properties: { title: 'หมู่10-บ้านน้ำบุ่น' } },
  { properties: { title: 'หมู่11-บ้านเวียงด้ง' } },
] as VillageFeature[];

describe('registryByYear', () => {
  it('นับต่อปี เรียงปี + อัตราป่วยต่อแสน (ทศนิยม 1 ตำแหน่ง)', () => {
    const cases = [...Array(17)].map(() => C(2563)).concat([C(2565)]);
    const rows = registryByYear(cases, [{ yearBE: 2563, population: 6756 }]);
    expect(rows).toEqual([
      { yearBE: 2563, count: 17, ratePer100k: 251.6 }, // 17/6756*100000 = 251.628…
      { yearBE: 2565, count: 1, ratePer100k: null }, // ไม่มี ปชก. ปีนั้น
    ]);
  });

  it('ปัดเศษถูกต้องที่ขอบ .5 (integer-first) แม้ input ปีไม่เรียง', () => {
    // 23/640*100000 = 3593.75 พอดี — ต้องปัดเป็น 3593.8 ไม่ใช่ 3593.7 (float error จาก *10 ก่อนหาร)
    const cases = [C(2565)].concat([...Array(23)].map(() => C(2563))).concat([C(2565)]);
    const rows = registryByYear(cases, [{ yearBE: 2563, population: 640 }]);
    expect(rows).toEqual([
      { yearBE: 2563, count: 23, ratePer100k: 3593.8 },
      { yearBE: 2565, count: 2, ratePer100k: null },
    ]);
  });
});

describe('registryByMonth', () => {
  it('คืน 12 แถวเสมอ + นับเคสไม่มีวันที่แยก', () => {
    const { months, noDate } = registryByMonth([
      C(2568, { date: '2025-01-07T00:00:00.000Z' }),
      C(2568, { date: '2025-01-20T00:00:00.000Z' }),
      C(2568, { date: '2025-06-05T00:00:00.000Z' }),
      C(2568, { date: null }),
      C(2568, { date: 'garbage' }),
    ]);
    expect(months).toHaveLength(12);
    expect(months[0]).toMatchObject({ month: 1, label: 'ม.ค.', count: 2 });
    expect(months[5]).toMatchObject({ month: 6, label: 'มิ.ย.', count: 1 });
    expect(noDate).toBe(2);
  });
});

describe('registryByMoo', () => {
  it('นับต่อหมู่ ข้ามเคสไม่มีหมู่', () => {
    expect(registryByMoo([C(2568, { moo: 7 }), C(2568, { moo: 7 }), C(2568, { moo: null })]))
      .toEqual({ 7: 2 });
  });
});

describe('ipdShare', () => {
  it('สัดส่วน IPD จากเคสที่ระบุประเภท; ไม่มีข้อมูล → null', () => {
    expect(ipdShare([C(2568, { careType: 'IPD' }), C(2568, { careType: 'OPD' })])).toBe(0.5);
    expect(ipdShare([C(2568, { careType: '' })])).toBeNull();
    expect(ipdShare([])).toBeNull();
  });
});

describe('mooTitle', () => {
  it('จับคู่เลขหมู่กับ title — หมู่ 1 ต้องไม่ชนหมู่ 10/11', () => {
    expect(mooTitle(1, FEATURES)).toBe('หมู่1-บ้านบ่อ');
    expect(mooTitle(10, FEATURES)).toBe('หมู่10-บ้านน้ำบุ่น');
    expect(mooTitle(99, FEATURES)).toBeNull();
  });
});

describe('mooCountsToVillageCounts', () => {
  it('แปลง key เลขหมู่ → title; หมู่ที่ไม่มีใน geojson ถูกตัด', () => {
    expect(mooCountsToVillageCounts({ 1: 3, 10: 2, 99: 5 }, FEATURES))
      .toEqual({ 'หมู่1-บ้านบ่อ': 3, 'หมู่10-บ้านน้ำบุ่น': 2 });
  });
});

describe('median', () => {
  it('คี่ = ค่ากลาง, คู่ = เฉลี่ยสองค่ากลาง, ว่าง = null', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('yearlyComparison', () => {
  const cases = [C(2566), C(2566), C(2566), C(2567)];
  const stats: YearStat[] = [
    { yearBE: 2564, population: 1000, thaiCases: 2 },
    { yearBE: 2565, population: 1000, thaiCases: 4 },
    { yearBE: 2566, population: 1000, thaiCases: 2 },
    { yearBE: 2567, population: 1000, thaiCases: 1 },
  ];
  const rows = yearlyComparison(cases, stats);
  const byYear = (y: number) => rows.find((r) => r.yearBE === y)!;

  it('รวมทุกปีจาก union ทะเบียน+สถิติ เรียงปี', () => {
    expect(rows.map((r) => r.yearBE)).toEqual([2564, 2565, 2566, 2567]);
  });
  it('ปีที่ทะเบียนไม่มีข้อมูล → foreign null (แต่ยังมีไทย/อัตราป่วย)', () => {
    expect(byYear(2564)).toMatchObject({ total: 0, thai: 2, foreign: null, hasRegistry: false, ratePer100kThai: 200 });
  });
  it('ต่างด้าว = เคสรวม − ไทย (เฉพาะปีที่ทะเบียนมีข้อมูล)', () => {
    expect(byYear(2566)).toMatchObject({ total: 3, thai: 2, foreign: 1, hasRegistry: true });
    expect(byYear(2567)).toMatchObject({ total: 1, thai: 1, foreign: 0 });
  });
  it('อัตราป่วยไทยต่อแสน = ไทย/ปชก×1e5 (คนไทยเท่านั้น)', () => {
    expect(byYear(2566).ratePer100kThai).toBe(200);
  });
  it('medianRatePrev5 = มัธยฐานอัตราของปีก่อนหน้า (ไม่เกิน 5 ปี)', () => {
    // อัตราปี 2564–2567 = 200/400/200/100 (thai/pop×1e5)
    expect(byYear(2564).medianRatePrev5).toBeNull();
    expect(byYear(2565).medianRatePrev5).toBe(200);   // median([200])
    expect(byYear(2566).medianRatePrev5).toBe(300);   // median([200,400])
    expect(byYear(2567).medianRatePrev5).toBe(200);   // median([200,400,200])
  });
});

describe('mooYearByYear / mooYearToByMoo', () => {
  const rows: MooYearRow[] = [
    { yearBE: 2566, moo: 5, count: 1 },
    { yearBE: 2568, moo: 5, count: 1 },
    { yearBE: 2568, moo: 6, count: 3 },
    { yearBE: 2567, moo: 5, count: 0 },
  ];
  it('mooYearByYear รวม count ต่อปี เรียงปี (ratePer100k null)', () => {
    expect(mooYearByYear(rows)).toEqual([
      { yearBE: 2566, count: 1, ratePer100k: null },
      { yearBE: 2567, count: 0, ratePer100k: null },
      { yearBE: 2568, count: 4, ratePer100k: null },
    ]);
  });
  it('mooYearToByMoo รวม count ต่อหมู่ กรองปี', () => {
    expect(mooYearToByMoo(rows, 2568)).toEqual({ 5: 1, 6: 3 });
  });
  it('mooYearToByMoo year=null รวมทุกปี', () => {
    expect(mooYearToByMoo(rows, null)).toEqual({ 5: 2, 6: 3 });
  });
});

describe('monthlyByYear', () => {
  const rows: MonthlyMultiYearRow[] = monthlyByYear([
    C(2568, { date: '2025-06-15T00:00:00.000Z' }),
    C(2568, { date: '2025-06-20T00:00:00.000Z' }),
    C(2567, { date: '2024-06-15T00:00:00.000Z' }),
    C(2568, { date: '2025-01-15T00:00:00.000Z' }),
    C(2566, { date: null }),                          // ไม่ระบุวันที่ → ข้าม
    C(2563, { date: '2020-06-15T00:00:00.000Z' }),    // ปีนอก list → ข้าม
  ], [2564, 2565, 2566, 2567, 2568]);

  it('12 แถว (รายเดือน)', () => {
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  it('นับ count ต่อปีต่อเดือน + median รายเดือน', () => {
    const jun = rows.find((r) => r.month === 6)!;
    expect(jun['2568']).toBe(2);
    expect(jun['2567']).toBe(1);
    expect(jun['2564']).toBe(0);
    expect(jun.median).toBe(0); // median([0,0,0,1,2]) = 0
    const jan = rows.find((r) => r.month === 1)!;
    expect(jan['2568']).toBe(1);
  });
});
