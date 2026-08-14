import { describe, expect, it } from 'vitest';
import {
  buildForestLayers,
  needsUtmFix,
  pickSubLayer,
  reprojectUtm47N,
  tagAndClean,
} from '@/lib/map-forest-prep';
import type { Feature, FeatureCollection } from '@/types/map';

const named = (fileName: string, features: Feature[]): FeatureCollection & {
  fileName: string;
} => ({ type: 'FeatureCollection', fileName, features });

const pt = (coords: number[], props: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: coords },
  properties: props,
});
const ring = (): number[][] => [
  [98.86, 18.68],
  [98.87, 18.68],
  [98.87, 18.69],
];
const pg = (props: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [ring()] },
  properties: props,
});

describe('pickSubLayer', () => {
  // ลำดับตั้งใจ: ชื่อยาว (_polygon1) ต้องมาก่อนชื่อสั้นในอาร์เรย์นี้ ไม่ใช่เรียง
  // ตามตัวอักษรหรือเรียงตามซิปจริง — find() คืนตัวที่เจอ "ตัวแรก" ในลำดับอาร์เรย์
  // ถ้าชื่อสั้นอยู่ก่อน includes() จะเจอมันตั้งแต่ index 0 และผ่านเทสต์ไปโดยไม่ทัน
  // ไปถึงตัวที่ควรพิสูจน์ว่าเป็นบั๊ก ทำให้เทสต์ด้านล่างไม่มีความหมาย (สมมติฐานนี้
  // ยืนยันแล้วโดยสลับไปใช้ includes() จริง ๆ แล้วดูว่าเทสต์พังหรือไม่) ใครมาจัด
  // อาร์เรย์นี้ใหม่ให้ "เรียบร้อย" กลับไปตามตัวอักษร จะปลดชนวนกับดักนี้เงียบ ๆ
  const parts = [
    named('Shapefiles/พิกัดป่าชุมชนหมู่ 10_polygon1', [pg({ begin: 1 })]),
    named('Shapefiles/พิกัดป่าชุมชนหมู่ 10', [pt([98.86, 18.68], { point_n: 1 })]),
  ];

  it('เลือกไฟล์ตามชื่อเต็มท้ายเส้นทาง', () => {
    expect(pickSubLayer(parts, 'พิกัดป่าชุมชนหมู่ 10_polygon1').features).toHaveLength(1);
  });

  // กับดักตัวจริง: "…หมู่ 10" เป็นสตริงนำหน้าของ "…หมู่ 10_polygon1" พอดี และไฟล์
  // ชื่อยาวถูกจงใจวางไว้ก่อนในอาร์เรย์ (ดูคอมเมนต์ข้างบน) ดังนั้นถ้าใครเปลี่ยนไปใช้
  // includes() เทสต์นี้จะจับได้ทันที เพราะ find() จะเจอ _polygon1 (Polygon) ก่อน
  // แทนที่จะเป็นไฟล์ point ที่ถูกต้อง
  it('ไม่คว้าไฟล์ที่ชื่อขึ้นต้นเหมือนกันแต่ยาวกว่า', () => {
    const got = pickSubLayer(parts, 'พิกัดป่าชุมชนหมู่ 10');
    expect(got.features[0].geometry!.type).toBe('Point');
  });

  it('throw เมื่อไม่เจอ ไม่ใช่คืนค่าว่างเงียบ ๆ', () => {
    expect(() => pickSubLayer(parts, 'ไม่มีไฟล์นี้')).toThrow(/ไม่พบ/);
  });
});

describe('needsUtmFix', () => {
  it('จับได้ว่าพิกัดเป็น UTM ดิบ', () => {
    expect(needsUtmFix(named('x', [pt([489711, 2069101])]))).toBe(true);
  });

  it('ไฟล์ที่แปลงมาถูกแล้วต้องไม่ถูกแตะ', () => {
    expect(needsUtmFix(named('x', [pt([98.902408, 18.713236])]))).toBe(false);
  });

  it('ไฟล์ว่างไม่ถือว่าต้องซ่อม', () => {
    expect(needsUtmFix(named('x', []))).toBe(false);
  });
});

describe('reprojectUtm47N', () => {
  it('แปลง UTM 47N เป็น lon/lat ได้ค่าที่ตรวจกับไฟล์จริงแล้ว', () => {
    const out = reprojectUtm47N(named('x', [pt([489711, 2069101])]));
    const [lon, lat] = out.features[0].geometry!.coordinates as number[];
    expect(lon).toBeCloseTo(98.902408, 5);
    expect(lat).toBeCloseTo(18.713236, 5);
  });

  it('ไม่แก้ของเดิม คืนก้อนใหม่', () => {
    const input = named('x', [pt([489711, 2069101])]);
    reprojectUtm47N(input);
    expect(input.features[0].geometry!.coordinates).toEqual([489711, 2069101]);
  });
});

describe('tagAndClean', () => {
  it('เติม moo และเก็บเฉพาะฟิลด์ที่สั่งให้เก็บ', () => {
    const out = tagAndClean(
      named('x', [pt([98.86, 18.68], { point_n: 7, E: 489711, N: 2069101 })]),
      '10',
      ['point_n']
    );
    expect(out.features[0].properties).toEqual({ moo: '10', point_n: 7 });
  });

  it('moo เป็นสตริง ไม่ใช่ตัวเลข — คีย์ประกอบเทียบด้วยสตริง', () => {
    const out = tagAndClean(named('x', [pg({ begin: 1 })]), '11', []);
    expect(out.features[0].properties).toEqual({ moo: '11' });
  });
});

describe('buildForestLayers', () => {
  const parts = [
    named('Shapefiles/พิกัดป่าชุมชนหมู่ 10', [
      pt([98.86, 18.68], { point_n: 1, E: 1, N: 2 }),
      pt([98.87, 18.69], { point_n: 2, E: 1, N: 2 }),
    ]),
    named('Shapefiles/พิกัดป่าชุมชนหมู่ 10_polygon1', [pg({ begin: 1, end: 2 })]),
    named('Shapefiles/พิกัดป่าชุมชนหมู่ 11_point', [pt([489711, 2069101], { point_n: 1 })]),
    named('Shapefiles/พิกัดป่าชุมชนหมู่ 11_polygon', [pg({ id: 1 })]),
  ];

  it('แยกเป็นสองเลเยอร์ ขอบเขต 2 รายการ หมุด 3 รายการ', () => {
    const { boundary, points } = buildForestLayers(parts);
    expect(boundary.features).toHaveLength(2);
    expect(points.features).toHaveLength(3);
  });

  it('ขอบเขตมีแต่รูปปิด หมุดมีแต่จุด', () => {
    const { boundary, points } = buildForestLayers(parts);
    expect([...new Set(boundary.features.map((f) => f.geometry!.type))]).toEqual(['Polygon']);
    expect([...new Set(points.features.map((f) => f.geometry!.type))]).toEqual(['Point']);
  });

  it('ซ่อมพิกัดของหมู่ 11 ให้ตกในไทย', () => {
    const { points } = buildForestLayers(parts);
    for (const f of points.features) {
      const [lon, lat] = f.geometry!.coordinates as number[];
      expect(lon).toBeGreaterThan(97);
      expect(lon).toBeLessThan(101);
      expect(lat).toBeGreaterThan(5);
      expect(lat).toBeLessThan(21);
    }
  });

  it('คีย์ประกอบ (moo, point_n) ไม่ซ้ำกันสักคู่', () => {
    const { points } = buildForestLayers(parts);
    const keys = points.features.map(
      (f) => `${f.properties!.moo}|${f.properties!.point_n}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('ฟิลด์ขยะถูกตัดหมด', () => {
    const { boundary, points } = buildForestLayers(parts);
    for (const f of [...boundary.features, ...points.features]) {
      expect(Object.keys(f.properties!)).not.toContain('begin');
      expect(Object.keys(f.properties!)).not.toContain('end');
      expect(Object.keys(f.properties!)).not.toContain('id');
      expect(Object.keys(f.properties!)).not.toContain('E');
      expect(Object.keys(f.properties!)).not.toContain('N');
    }
  });
});
