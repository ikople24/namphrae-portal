// tests/stats.test.ts
import { describe, it, expect } from 'vitest';
import { computeKpis } from '@/lib/disaster-stats';
import type { IncidentItem } from '@/types/disaster';

function inc(partial: Partial<IncidentItem>): IncidentItem {
  return {
    _id: Math.random().toString(),
    disasterType: 'WILDFIRE',
    year: 2564,
    date: '2021-01-01T00:00:00.000Z',
    dateText: '',
    method: '',
    areaType: '',
    location: { type: 'Point', coordinates: [98.8, 18.7] },
    imageFile: '',
    ...partial,
  };
}

describe('computeKpis', () => {
  it('นับ total/topType/peakYear ถูกต้อง', () => {
    const data = [
      inc({ disasterType: 'WILDFIRE', year: 2564 }),
      inc({ disasterType: 'WILDFIRE', year: 2565 }),
      inc({ disasterType: 'FLOOD', year: 2565 }),
    ];
    const k = computeKpis(data);
    expect(k.total).toBe(3);
    expect(k.topType).toBe('WILDFIRE');
    expect(k.peakYear).toBe(2565);
  });

  it('หา topVillage จากฟังก์ชัน villageFor', () => {
    const data = [inc({}), inc({}), inc({})];
    const k = computeKpis(data, (_it) => 'หมู่7');
    expect(k.topVillage).toBe('หมู่7');
  });

  it('ชุดว่างคืนค่า null/0', () => {
    const k = computeKpis([]);
    expect(k).toEqual({ total: 0, topType: null, peakYear: null, topVillage: null });
  });
});
