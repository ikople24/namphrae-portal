import { describe, expect, it } from 'vitest';
import {
  bboxOf,
  containsPoint,
  findHits,
  indexFeatures,
  type HitLayer,
} from '@/lib/map-hit';
import type { Feature, FeatureCollection, Geometry } from '@/types/map';

const square = (x: number, y: number, size: number): Geometry => ({
  type: 'Polygon',
  coordinates: [
    [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y],
    ],
  ],
});

const feat = (geometry: Geometry, props: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  geometry,
  properties: props,
});

const fcOf = (features: Feature[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});

describe('bboxOf', () => {
  it('ครอบทุกจุดไม่ว่าซ้อนลึกแค่ไหน', () => {
    expect(bboxOf(square(98, 18, 1))).toEqual([98, 18, 99, 19]);
  });

  it('MultiPolygon รวมทุกก้อน', () => {
    const multi: Geometry = {
      type: 'MultiPolygon',
      coordinates: [square(98, 18, 1).coordinates, square(100, 20, 1).coordinates],
    };
    expect(bboxOf(multi)).toEqual([98, 18, 101, 21]);
  });
});

describe('containsPoint — รูปปิด', () => {
  it('จุดข้างในโดน', () => {
    expect(containsPoint(square(0, 0, 10), 5, 5, 0)).toBe(true);
  });

  it('จุดข้างนอกไม่โดน', () => {
    expect(containsPoint(square(0, 0, 10), 15, 5, 0)).toBe(false);
  });

  // แปลงที่ดินที่มีที่ดินคนอื่นคร่อมอยู่ตรงกลางมีจริงในข้อมูลชุดนี้
  it('จุดที่ตกในรูของรูปปิดไม่โดน', () => {
    const withHole: Geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
          [4, 4],
        ],
      ],
    };
    expect(containsPoint(withHole, 1, 1, 0)).toBe(true);
    expect(containsPoint(withHole, 5, 5, 0)).toBe(false);
  });

  it('MultiPolygon โดนถ้าอยู่ในก้อนใดก้อนหนึ่ง', () => {
    const multi: Geometry = {
      type: 'MultiPolygon',
      coordinates: [square(0, 0, 2).coordinates, square(10, 10, 2).coordinates],
    };
    expect(containsPoint(multi, 11, 11, 0)).toBe(true);
    expect(containsPoint(multi, 5, 5, 0)).toBe(false);
  });
});

describe('containsPoint — เส้น', () => {
  const line: Geometry = {
    type: 'LineString',
    coordinates: [
      [0, 0],
      [10, 0],
    ],
  };

  it('อยู่บนเส้นพอดี', () => {
    expect(containsPoint(line, 5, 0, 0.001)).toBe(true);
  });

  it('อยู่ห่างแต่ยังในระยะเผื่อ', () => {
    expect(containsPoint(line, 5, 0.4, 0.5)).toBe(true);
  });

  it('อยู่ไกลเกินระยะเผื่อ', () => {
    expect(containsPoint(line, 5, 2, 0.5)).toBe(false);
  });

  it('เลยปลายเส้นไปไม่โดน แม้จะอยู่บนแนวเดียวกัน', () => {
    expect(containsPoint(line, 20, 0, 0.5)).toBe(false);
  });

  // เกิดจริงในข้อมูล OSM ที่ถูก clip — สองจุดติดกันซ้ำพิกัดเดียวกัน
  it('เส้นที่มีจุดซ้ำกันไม่ทำให้หารด้วยศูนย์', () => {
    const degenerate: Geometry = {
      type: 'LineString',
      coordinates: [
        [1, 1],
        [1, 1],
      ],
    };
    expect(containsPoint(degenerate, 1, 1, 0.1)).toBe(true);
    expect(containsPoint(degenerate, 5, 5, 0.1)).toBe(false);
  });
});

describe('findHits', () => {
  // order น้อย = ละเอียดกว่า = ต้องถูกถามก่อน (แปลงที่ดิน 10, โซนหมู่บ้าน 40)
  const parcel: HitLayer = {
    layerId: 'parcel',
    title: 'แปลงที่ดิน',
    order: 10,
    features: indexFeatures(fcOf([feat(square(4, 4, 2), { parcel_cod: '04B066' })])),
  };
  const zone: HitLayer = {
    layerId: 'zone-moobang',
    title: 'โซนหมู่บ้าน',
    order: 40,
    features: indexFeatures(fcOf([feat(square(0, 0, 20), { zone_id: 'Moo 4' })])),
  };

  it('คืนเลเยอร์ที่ละเอียดที่สุดก่อน ไม่ใช่เลเยอร์ที่วาดอยู่บนสุด', () => {
    const hits = findHits([zone, parcel], 5, 5, 0);
    expect(hits.map((h) => h.layerId)).toEqual(['parcel', 'zone-moobang']);
  });

  it('คืนทุกอย่างที่โดน ไม่ใช่แค่อันแรก', () => {
    expect(findHits([zone, parcel], 5, 5, 0)).toHaveLength(2);
  });

  it('จุดที่อยู่นอกแปลงได้เฉพาะโซน', () => {
    const hits = findHits([zone, parcel], 15, 15, 0);
    expect(hits.map((h) => h.layerId)).toEqual(['zone-moobang']);
  });

  it('คลิกที่ว่างไม่ได้อะไรเลย', () => {
    expect(findHits([zone, parcel], 100, 100, 0)).toEqual([]);
  });

  it('จำกัดจำนวนต่อเลเยอร์ ไม่ให้ป๊อปอัปยาวเป็นหางว่าว', () => {
    const stacked: HitLayer = {
      layerId: 'parcel',
      title: 'แปลงที่ดิน',
      order: 10,
      features: indexFeatures(
        fcOf(Array.from({ length: 10 }, (_, i) => feat(square(0, 0, 20), { n: i })))
      ),
    };
    expect(findHits([stacked], 5, 5, 0, 3)).toHaveLength(3);
  });

  it('ข้าม feature ที่ไม่มีรูปทรงโดยไม่พัง', () => {
    const broken = indexFeatures(
      fcOf([{ type: 'Feature', geometry: null, properties: {} }, feat(square(0, 0, 4))])
    );
    expect(broken).toHaveLength(1);
    expect(
      findHits([{ layerId: 'x', title: 'x', order: 1, features: broken }], 2, 2, 0)
    ).toHaveLength(1);
  });
});
