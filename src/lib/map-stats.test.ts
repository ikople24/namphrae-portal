import { describe, expect, it } from 'vitest';
import { computeStats, sha256OfFeatureCollection } from '@/lib/map-stats';
import type { FeatureCollection } from '@/types/map';

function pt(lon: number, lat: number, props: Record<string, unknown>) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: props,
  };
}

const fc: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    pt(98.0, 18.0, { zone: '01', rai: '1' }),
    pt(99.0, 19.0, { zone: '01', rai: '' }),
    pt(98.5, 18.5, { zone: '02' }),
  ],
};

describe('computeStats', () => {
  it('นับ feature และชนิดรูปทรง', () => {
    const s = computeStats(fc);
    expect(s.featureCount).toBe(3);
    expect(s.geometryTypes).toEqual(['Point']);
  });

  it('คำนวณ bbox จากทุกพิกัดไม่ว่าซ้อนลึกแค่ไหน', () => {
    const poly: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'MultiPolygon',
            coordinates: [[[[98.1, 18.1], [98.9, 18.9], [98.1, 18.1]]]],
          },
          properties: {},
        },
      ],
    };
    expect(computeStats(poly).bbox).toEqual([98.1, 18.1, 98.9, 18.9]);
  });

  it('นับ filled โดยถือว่าสตริงว่างและ null คือไม่กรอก', () => {
    const rai = computeStats(fc).fields.find((f) => f.name === 'rai')!;
    expect(rai.filled).toBe(1);
  });

  it('ฟิลด์ที่ไม่มีในบาง feature ยังถูกนับเป็นฟิลด์', () => {
    expect(computeStats(fc).fields.map((f) => f.name).sort()).toEqual([
      'rai',
      'zone',
    ]);
  });

  it('เก็บรายการค่าเมื่อเป็นฟิลด์ประเภทหมวดหมู่', () => {
    const zone = computeStats(fc).fields.find((f) => f.name === 'zone')!;
    expect(zone.distinct).toBe(2);
    expect(zone.values).toEqual(['01', '02']);
  });

  it('ไม่เก็บรายการค่าเมื่อ distinct เกิน CATEGORICAL_MAX', () => {
    const many: FeatureCollection = {
      type: 'FeatureCollection',
      features: Array.from({ length: 60 }, (_, i) => pt(98, 18, { id: `x${i}` })),
    };
    expect(computeStats(many).fields[0].values).toBeUndefined();
  });

  it('ไฟล์ว่างไม่พัง', () => {
    const s = computeStats({ type: 'FeatureCollection', features: [] });
    expect(s.featureCount).toBe(0);
    expect(s.bbox).toEqual([0, 0, 0, 0]);
  });
});

describe('sha256OfFeatureCollection', () => {
  it('ข้อมูลเดียวกันได้ค่าเดียวกันแม้ลำดับคีย์ต่างกัน', () => {
    const a: FeatureCollection = {
      type: 'FeatureCollection',
      features: [pt(98, 18, { a: 1, b: 2 })],
    };
    const b: FeatureCollection = {
      type: 'FeatureCollection',
      features: [pt(98, 18, { b: 2, a: 1 })],
    };
    expect(sha256OfFeatureCollection(a)).toBe(sha256OfFeatureCollection(b));
  });

  it('ข้อมูลต่างกันได้คนละค่า', () => {
    const a: FeatureCollection = {
      type: 'FeatureCollection',
      features: [pt(98, 18, { a: 1 })],
    };
    const b: FeatureCollection = {
      type: 'FeatureCollection',
      features: [pt(98, 18, { a: 2 })],
    };
    expect(sha256OfFeatureCollection(a)).not.toBe(sha256OfFeatureCollection(b));
  });
});
