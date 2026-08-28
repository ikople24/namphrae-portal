import { describe, expect, it } from 'vitest';
import { ingestMapFile } from '@/lib/map-ingest';
import type { MapLayer } from '@/types/map';

// รูปสามเหลี่ยมเล็ก ๆ ในเขตตำบลน้ำแพร่ — ต้องอยู่ในไทยไม่งั้นติดด่าน outside-thailand
const TRIANGLE = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [98.86, 18.68],
            [98.87, 18.68],
            [98.87, 18.69],
          ],
        ],
      },
      properties: { moo: '10' },
    },
  ],
});

// รูปเดียวกันแต่พิกัดพกทศนิยม 10 ตำแหน่ง และวางไว้ให้การปัดเหลือ 3 ตำแหน่งขยับ
// จุดยอดจริง ๆ — ด้านยาวขึ้นจาก 0.011° เป็น 0.012° พื้นที่จึงต่างกันราว 19%
// มากพอให้เทสต์เรื่องลำดับจับได้ว่าพื้นที่ถูกคิดบนรูปทรงที่ปัดแล้วหรือยัง
const TRIANGLE_LONG = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [98.8604999999, 18.6804999999],
            [98.8715000001, 18.6804999999],
            [98.8715000001, 18.6915000001],
          ],
        ],
      },
      properties: { moo: '10' },
    },
  ],
});

/** จำนวนตำแหน่งทศนิยมของตัวเลข — ใช้ยืนยันว่าปัดจริง ไม่ใช่แค่ค่าใกล้เคียง */
const decimals = (n: number): number => (String(n).split('.')[1] ?? '').length;

const layer = (over: Partial<MapLayer> = {}): MapLayer => ({
  id: 'community-forest',
  title: 'ป่าชุมชน',
  geometryType: 'Polygon',
  keyFields: ['moo'],
  keyComposition: [],
  visibility: 'public',
  publicFields: [],
  currentVersionNo: null,
  order: 5,
  updatedAt: '2026-08-14T00:00:00.000Z',
  updatedBy: 'test',
  ...over,
});

describe('ingestMapFile: computeArea', () => {
  it('เติม area_rai/area_km2 เมื่อเลเยอร์ตั้ง computeArea', () => {
    const r = ingestMapFile({
      text: TRIANGLE,
      fileName: 'forest.geojson',
      layer: layer({ computeArea: true }),
      previous: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fc.features[0].properties).toMatchObject({
      area_rai: expect.any(Number),
      area_km2: expect.any(Number),
    });
  });

  it('ไม่แตะ properties เลยเมื่อไม่ได้ตั้ง computeArea', () => {
    const r = ingestMapFile({
      text: TRIANGLE,
      fileName: 'forest.geojson',
      layer: layer(),
      previous: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fc.features[0].properties).toEqual({ moo: '10' });
  });

  it('area เข้าไปอยู่ใน stats ด้วย — คือหลักฐานว่าเติมก่อน computeStats', () => {
    const r = ingestMapFile({
      text: TRIANGLE,
      fileName: 'forest.geojson',
      layer: layer({ computeArea: true }),
      previous: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.fields.map((f) => f.name)).toContain('area_rai');
  });

  it('sha256 ต่างกันระหว่างเปิดกับปิด flag แต่คงที่เมื่อเรียกซ้ำด้วย flag เดิม', () => {
    const run = (computeArea: boolean) => {
      const r = ingestMapFile({
        text: TRIANGLE,
        fileName: 'forest.geojson',
        layer: layer({ computeArea }),
        previous: null,
      });
      if (!r.ok) throw new Error(r.message);
      return r.sha256;
    };
    expect(run(true)).not.toBe(run(false));
    expect(run(true)).toBe(run(true));
  });
});

describe('ingestMapFile: coordinatePrecision', () => {
  it('ปัดพิกัดเมื่อเลเยอร์ตั้งค่าไว้', () => {
    const r = ingestMapFile({
      text: TRIANGLE_LONG,
      fileName: 'forest.geojson',
      layer: layer({ coordinatePrecision: 6 }),
      previous: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ring = (r.fc.features[0].geometry as { coordinates: number[][][] }).coordinates[0];
    for (const [lon, lat] of ring) {
      expect(decimals(lon)).toBeLessThanOrEqual(6);
      expect(decimals(lat)).toBeLessThanOrEqual(6);
    }
  });

  it('ไม่แตะพิกัดเลยเมื่อไม่ได้ตั้งค่า — ทศนิยม 10 ตำแหน่งยังอยู่ครบ', () => {
    const r = ingestMapFile({
      text: TRIANGLE_LONG,
      fileName: 'forest.geojson',
      layer: layer(),
      previous: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ring = (r.fc.features[0].geometry as { coordinates: number[][][] }).coordinates[0];
    expect(ring[0]).toEqual([98.8604999999, 18.6804999999]);
  });

  it('พื้นที่ถูกคิดบนรูปทรงที่ปัดแล้ว — คือหลักฐานว่าปัดก่อน withArea', () => {
    const areaOf = (over: Partial<MapLayer>) => {
      const r = ingestMapFile({
        text: TRIANGLE_LONG,
        fileName: 'forest.geojson',
        layer: layer({ computeArea: true, ...over }),
        previous: null,
      });
      if (!r.ok) throw new Error(r.message);
      return r.fc.features[0].properties?.area_rai as number;
    };
    // ถ้าปัดหลัง withArea ตัวเลขสองอันนี้จะเท่ากัน เพราะพื้นที่จะถูกคิดบนรูปทรงเดิมทั้งคู่
    expect(areaOf({ coordinatePrecision: 3 })).not.toBe(areaOf({}));
  });

  it('sha256 ต่างกันระหว่างปัดกับไม่ปัด แต่คงที่เมื่อเรียกซ้ำ — เงื่อนไขของด่าน identical', () => {
    const run = (over: Partial<MapLayer>) => {
      const r = ingestMapFile({
        text: TRIANGLE_LONG,
        fileName: 'forest.geojson',
        layer: layer(over),
        previous: null,
      });
      if (!r.ok) throw new Error(r.message);
      return r.sha256;
    };
    expect(run({ coordinatePrecision: 6 })).not.toBe(run({}));
    expect(run({ coordinatePrecision: 6 })).toBe(run({ coordinatePrecision: 6 }));
  });
});
