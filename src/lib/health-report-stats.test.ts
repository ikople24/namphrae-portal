import { describe, it, expect } from 'vitest';
import { dengueByMonth, dengueKpis, recentCases, classifyCases } from '@/lib/health-report-stats';
import type { DengueCase } from '@/types/health';

function c(p: Partial<DengueCase>): DengueCase {
  return {
    _id: Math.random().toString(),
    complaintId: 'CMP-x',
    community: 'บ้านบ่อ',
    status: 'ดำเนินการเสร็จสิ้น',
    date: '2025-09-29T00:00:00.000Z',
    location: { lat: 18.7, lng: 98.9 },
    ...p,
  };
}

describe('dengueByMonth', () => {
  it('นับต่อเดือน-ปี เรียงตามเวลา + label เป็นเดือน พ.ศ.', () => {
    const rows = dengueByMonth([
      c({ date: '2025-11-17T00:00:00.000Z' }),
      c({ date: '2025-09-29T00:00:00.000Z' }),
      c({ date: '2025-11-30T00:00:00.000Z' }),
    ]);
    expect(rows.map((r) => r.key)).toEqual(['2025-09', '2025-11']);
    expect(rows[0]).toMatchObject({ label: 'ก.ย. 2568', count: 1 });
    expect(rows[1]).toMatchObject({ label: 'พ.ย. 2568', count: 2 });
  });
});

describe('dengueKpis', () => {
  it('total / เคสล่าสุด / ชุมชนพบมากสุด', () => {
    const k = dengueKpis([
      c({ community: 'บ้านเวียงด้ง', date: '2025-11-30T00:00:00.000Z' }),
      c({ community: 'บ้านเวียงด้ง', date: '2026-01-05T00:00:00.000Z' }),
      c({ community: 'บ้านบ่อ', date: '2025-09-29T00:00:00.000Z' }),
    ]);
    expect(k.total).toBe(3);
    expect(k.latestDate).toBe('2026-01-05T00:00:00.000Z');
    expect(k.topCommunity).toBe('บ้านเวียงด้ง');
  });
  it('ชุดว่างคืน 0/null', () => {
    expect(dengueKpis([])).toEqual({ total: 0, latestDate: null, topCommunity: null });
  });
});

describe('recentCases', () => {
  const now = new Date('2026-07-13T00:00:00.000Z');
  it('เก็บเคสภายใน 28 วัน (รวมตรงขอบพอดี) / ตัดเคสเก่ากว่า', () => {
    const inside = c({ date: '2026-07-01T00:00:00.000Z' });
    const boundary = c({ date: '2026-06-15T00:00:00.000Z' }); // 28 วันก่อน now พอดี
    const outside = c({ date: '2026-06-14T23:59:59.000Z' });
    expect(recentCases([inside, boundary, outside], now)).toEqual([inside, boundary]);
  });
  it('วันที่ parse ไม่ได้ถูกตัด / วันที่อนาคตยังนับ', () => {
    const bad = c({ date: 'ไม่ใช่วันที่' });
    const future = c({ date: '2026-07-20T00:00:00.000Z' });
    expect(recentCases([bad, future], now)).toEqual([future]);
  });
  it('windowDays กำหนดเองได้', () => {
    const fiveDaysAgo = c({ date: '2026-07-08T00:00:00.000Z' });
    expect(recentCases([fiveDaysAgo], now, 7)).toEqual([fiveDaysAgo]);
    expect(recentCases([fiveDaysAgo], now, 3)).toEqual([]);
  });
});

const NOW = new Date('2025-02-01T00:00:00.000Z');
const mk = (id: string, daysAgo: number, lat: number, lng: number): DengueCase => ({
  _id: id, complaintId: id, community: '', status: '',
  date: new Date(NOW.getTime() - daysAgo * 86400000).toISOString(),
  location: { lat, lng },
});

const M = 1 / 111195; // 1 เมตร ≈ องศาละติจูด (ระยะแนวเหนือ-ใต้)
const at = (id: string, daysAgo: number, meters: number): DengueCase => mk(id, daysAgo, 18.79 + meters * M, 98.93);

describe('classifyCases (รุ่นการระบาด)', () => {
  it('เคส active คงน้ำเงินเสมอ แม้ทับกัน', () => {
    const cls = classifyCases([at('a1', 5, 0), at('a2', 5, 40)], NOW);
    expect(cls.get('a1')).toBe('active');
    expect(cls.get('a2')).toBe('active');
  });
  it('เคสเก่าโดดเดี่ยว = gen1', () => {
    expect(classifyCases([at('p', 60, 0)], NOW).get('p')).toBe('gen1');
  });
  it('gen2 = เคสเก่าทับ active ≥1 (ไม่มีเพื่อน gen2)', () => {
    const cls = classifyCases([at('a', 5, 0), at('p', 60, 44)], NOW);
    expect(cls.get('a')).toBe('active');
    expect(cls.get('p')).toBe('gen2');
  });
  it('gen3 = ทับ gen2 ≥2 (ไม่ cascade เมื่อ gen2 อยู่โดด)', () => {
    const cls = classifyCases(
      [at('a1', 5, 0), at('g1', 60, 80), at('t', 60, 155), at('g2', 60, 230), at('a2', 5, 310)],
      NOW
    );
    expect(cls.get('a1')).toBe('active');
    expect(cls.get('a2')).toBe('active');
    expect(cls.get('g1')).toBe('gen2');
    expect(cls.get('g2')).toBe('gen2');
    expect(cls.get('t')).toBe('gen3');
  });
  it('gen4 = clique 1 active + 3 เก่า ทับกันหมด (≤90 ม.)', () => {
    const cls = classifyCases([at('a', 5, 0), at('p', 60, 30), at('q', 60, 60), at('r', 60, 90)], NOW);
    expect(cls.get('a')).toBe('active');
    expect(cls.get('p')).toBe('gen4');
    expect(cls.get('q')).toBe('gen4');
    expect(cls.get('r')).toBe('gen4');
  });
  it('ทับ gen2 เพียง 1 วง (ไม่ถึง 2) = gen1', () => {
    const cls = classifyCases([at('a', 5, 0), at('g', 60, 80), at('q', 60, 160)], NOW);
    expect(cls.get('g')).toBe('gen2');
    expect(cls.get('q')).toBe('gen1');
  });
  it('วันที่ parse ไม่ได้ + โดดเดี่ยว = gen1', () => {
    const bad: DengueCase = { _id: 'x', complaintId: '', community: '', status: '', date: 'ไม่ใช่วันที่', location: { lat: 18.79, lng: 98.93 } };
    expect(classifyCases([bad], NOW).get('x')).toBe('gen1');
  });
});
