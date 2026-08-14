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
