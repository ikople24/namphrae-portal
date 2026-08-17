// tests/adminView.test.ts
import { describe, it, expect } from 'vitest';
import { filterIncidents, paginate, summaryByType } from '@/lib/disaster-admin-view';
import type { IncidentItem } from '@/types/disaster';

const mk = (o: Partial<IncidentItem>): IncidentItem => ({
  _id: o._id ?? '1', disasterType: o.disasterType ?? 'WILDFIRE', year: o.year ?? 2566,
  date: o.date ?? '2023-01-01', dateText: o.dateText ?? '1 มกราคม 2566', method: o.method ?? 'x',
  areaType: o.areaType ?? 'ป่า', location: o.location ?? { type: 'Point', coordinates: [98.8, 18.7] },
  imageFile: o.imageFile ?? 'A001.jpg',
});

describe('filterIncidents', () => {
  const data = [
    mk({ _id: '1', disasterType: 'WILDFIRE', areaType: 'ป่าสงวน', imageFile: 'A001.jpg' }),
    mk({ _id: '2', disasterType: 'FLOOD', areaType: 'ริมน้ำ', imageFile: 'F002.jpg' }),
  ];
  it('filters by type', () => {
    expect(filterIncidents(data, '', 'FLOOD').map((d) => d._id)).toEqual(['2']);
  });
  it('type ALL keeps all', () => {
    expect(filterIncidents(data, '', 'ALL')).toHaveLength(2);
  });
  it('searches areaType/imageFile/dateText case-insensitively', () => {
    expect(filterIncidents(data, 'f002', 'ALL').map((d) => d._id)).toEqual(['2']);
    expect(filterIncidents(data, 'ป่า', 'ALL').map((d) => d._id)).toEqual(['1']);
  });
});

describe('paginate', () => {
  const arr = Array.from({ length: 25 }, (_, i) => i);
  it('returns the right page slice', () => {
    expect(paginate(arr, 1, 10)).toEqual(arr.slice(0, 10));
    expect(paginate(arr, 3, 10)).toEqual(arr.slice(20, 25));
  });
  it('clamps out-of-range pages', () => {
    expect(paginate(arr, 99, 10)).toEqual(arr.slice(20, 25));
    expect(paginate(arr, 0, 10)).toEqual(arr.slice(0, 10));
  });
});

describe('summaryByType', () => {
  it('counts per disaster type', () => {
    const s = summaryByType([
      mk({ disasterType: 'WILDFIRE' }), mk({ disasterType: 'WILDFIRE' }), mk({ disasterType: 'DROUGHT' }),
    ]);
    expect(s.WILDFIRE).toBe(2);
    expect(s.DROUGHT).toBe(1);
    expect(s.FLOOD).toBe(0);
  });
});
