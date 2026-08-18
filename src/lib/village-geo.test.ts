// tests/geo.test.ts
import { describe, it, expect } from 'vitest';
import { haversineMeters, pointInRing, villageOf, type VillageFeature } from '@/lib/village-geo';

const square = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]];

const villageA: VillageFeature = {
  type: 'Feature',
  properties: { title: 'หมู่1' },
  geometry: { type: 'Polygon', coordinates: [square] },
};
const villageB: VillageFeature = {
  type: 'Feature',
  properties: { title: 'หมู่2' },
  geometry: { type: 'Polygon', coordinates: [[[20, 20], [20, 30], [30, 30], [30, 20], [20, 20]]] },
};

describe('pointInRing', () => {
  it('จุดในสี่เหลี่ยมคืน true', () => {
    expect(pointInRing(5, 5, square)).toBe(true);
  });
  it('จุดนอกสี่เหลี่ยมคืน false', () => {
    expect(pointInRing(15, 5, square)).toBe(false);
  });
});

describe('villageOf', () => {
  it('คืนชื่อหมู่บ้านที่จุดตกอยู่', () => {
    expect(villageOf(5, 5, [villageA, villageB])).toBe('หมู่1');
    expect(villageOf(25, 25, [villageA, villageB])).toBe('หมู่2');
  });
  it('จุดนอกทุกหมู่บ้านคืน null', () => {
    expect(villageOf(100, 100, [villageA, villageB])).toBeNull();
  });
});

describe('haversineMeters', () => {
  it('จุดเดียวกัน = 0', () => {
    expect(haversineMeters(18.79, 98.93, 18.79, 98.93)).toBe(0);
  });
  it('ต่างละติจูด 0.0009 องศา ≈ 100 เมตร (±2 ม.)', () => {
    expect(Math.abs(haversineMeters(18.79, 98.93, 18.7909, 98.93) - 100)).toBeLessThan(2);
  });
  it('ต่างละติจูด 0.0018 องศา ≈ 200 เมตร (±3 ม.)', () => {
    expect(Math.abs(haversineMeters(18.79, 98.93, 18.7918, 98.93) - 200)).toBeLessThan(3);
  });
});
