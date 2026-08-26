// src/lib/map-precision.test.ts
import { describe, expect, it } from 'vitest';
import { withPrecision } from '@/lib/map-precision';
import type { FeatureCollection } from '@/types/map';

const fc = (geometry: unknown): FeatureCollection => ({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: geometry as never, properties: { moo: 10 } },
  ],
});

describe('withPrecision', () => {
  it('ปัดพิกัดของ Point', () => {
    const out = withPrecision(
      fc({ type: 'Point', coordinates: [98.89409123456789, 18.71541987654321] }),
      6
    );
    expect(out.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [98.894091, 18.71542],
    });
  });

  it('ปัดพิกัดที่ซ้อนลึกของ MultiPolygon', () => {
    const out = withPrecision(
      fc({
        type: 'MultiPolygon',
        coordinates: [[[[98.8678206123, 18.6831098234], [98.8665583456, 18.6843742567]]]],
      }),
      6
    );
    expect(out.features[0].geometry).toEqual({
      type: 'MultiPolygon',
      coordinates: [[[[98.867821, 18.68311], [98.866558, 18.684374]]]],
    });
  });

  it('ไม่แตะ properties และไม่แตะ feature อื่น ๆ ในก้อน', () => {
    const out = withPrecision(fc({ type: 'Point', coordinates: [98.1234567, 18.1] }), 3);
    expect(out.features[0].properties).toEqual({ moo: 10 });
    expect(out.type).toBe('FeatureCollection');
  });

  it('geometry เป็น null → ปล่อยผ่าน ไม่พัง', () => {
    const out = withPrecision(fc(null), 6);
    expect(out.features[0].geometry).toBeNull();
  });

  it('พิกัดที่ไม่ใช่ตัวเลข ปล่อยผ่านให้ด่านตรวจเป็นคนรายงาน', () => {
    const out = withPrecision(fc({ type: 'Point', coordinates: [null, 'x'] }), 6);
    expect(out.features[0].geometry).toEqual({ type: 'Point', coordinates: [null, 'x'] });
  });

  it('ปัดซ้ำได้ผลเท่าเดิม — เงื่อนไขที่ทำให้ sha256 คงที่เมื่ออัปไฟล์เดิมซ้ำ', () => {
    const once = withPrecision(fc({ type: 'Point', coordinates: [98.1234567891, 18.9] }), 6);
    const twice = withPrecision(once, 6);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});
