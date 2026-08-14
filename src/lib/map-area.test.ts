import { describe, expect, it } from 'vitest';
import { polygonAreaRai, ringAreaUtm, withArea } from '@/lib/map-area';
import type { Feature, FeatureCollection, Geometry } from '@/types/map';

// สี่เหลี่ยม 40×40 เมตรในพิกัด UTM = 1,600 ตร.ม. = 1 ไร่ ก่อนถอด scale factor
const SQUARE_40M_UTM = [
  [500000, 2000000],
  [500040, 2000000],
  [500040, 2000040],
  [500000, 2000040],
];

// ขอบเขตป่าชุมชนหมู่ 10 (ตัดมาบางส่วน) — พิกัด lon/lat จริงจากไฟล์
const forestRing = (): number[][] => [
  [98.8678206, 18.68310982],
  [98.86655833, 18.68437425],
  [98.86800000, 18.68500000],
];

const fc = (features: Feature[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});
const poly = (geometry: Geometry | null, props: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  geometry,
  properties: props,
});

describe('ringAreaUtm', () => {
  it('ถอด scale factor ของ UTM ออก — 1,600 ตร.ม. บนกระดาษคือ 1,601.2808 ตร.ม. บนพื้นโลก', () => {
    expect(ringAreaUtm(SQUARE_40M_UTM)).toBeCloseTo(1601.2808, 4);
  });

  it('วงเปิดกับวงปิดให้ค่าเท่ากันเป๊ะ', () => {
    const closed = [...SQUARE_40M_UTM, SQUARE_40M_UTM[0]];
    expect(ringAreaUtm(closed)).toBe(ringAreaUtm(SQUARE_40M_UTM));
  });

  it('ทิศทางการวนของวง (ตามเข็ม/ทวนเข็ม) ไม่ทำให้พื้นที่ติดลบ', () => {
    expect(ringAreaUtm([...SQUARE_40M_UTM].reverse())).toBeCloseTo(1601.2808, 4);
  });
});

describe('polygonAreaRai', () => {
  it('คืน null เมื่อไม่มีรูปทรงหรือรูปทรงไม่ใช่รูปปิด', () => {
    expect(polygonAreaRai(null)).toBeNull();
    expect(polygonAreaRai({ type: 'Point', coordinates: [98.8, 18.7] })).toBeNull();
    expect(
      polygonAreaRai({ type: 'LineString', coordinates: [[98.8, 18.7], [98.9, 18.8]] })
    ).toBeNull();
  });

  it('MultiPolygon = ผลรวมของทุกวง', () => {
    const one = polygonAreaRai({ type: 'Polygon', coordinates: [forestRing()] })!;
    const two = polygonAreaRai({
      type: 'MultiPolygon',
      coordinates: [[forestRing()], [forestRing()]],
    })!;
    expect(two.rai).toBeCloseTo(one.rai * 2, 1);
  });

  it('วงในถูกหักออกจากวงนอก ไม่ใช่บวกเพิ่ม', () => {
    const outer = [
      [98.86, 18.68],
      [98.87, 18.68],
      [98.87, 18.69],
      [98.86, 18.69],
    ];
    const hole = [
      [98.862, 18.682],
      [98.864, 18.682],
      [98.864, 18.684],
      [98.862, 18.684],
    ];
    const solid = polygonAreaRai({ type: 'Polygon', coordinates: [outer] })!;
    const holed = polygonAreaRai({ type: 'Polygon', coordinates: [outer, hole] })!;
    expect(holed.rai).toBeLessThan(solid.rai);
  });

  it('ปัดเศษตายตัว — ไร่ 2 ตำแหน่ง ตร.กม. 4 ตำแหน่ง', () => {
    const a = polygonAreaRai({ type: 'Polygon', coordinates: [forestRing()] })!;
    expect(a.rai).toBe(Number(a.rai.toFixed(2)));
    expect(a.km2).toBe(Number(a.km2.toFixed(4)));
  });

  it('พิกัดเสียไม่ทำให้ทั้งไฟล์พัง — คืน null ให้ด่านตรวจเป็นคนรายงานแทน', () => {
    expect(
      polygonAreaRai({
        type: 'Polygon',
        coordinates: [[[98.8, 18.7], [98.8, null], [98.9, 18.8]]],
      })
    ).toBeNull();
  });
});

describe('withArea', () => {
  it('เติม area_rai/area_km2 ให้ทุก feature ที่เป็นรูปปิด', () => {
    const out = withArea(fc([poly({ type: 'Polygon', coordinates: [forestRing()] })]));
    expect(out.features[0].properties).toMatchObject({
      area_rai: expect.any(Number),
      area_km2: expect.any(Number),
    });
  });

  it('ไม่แตะ feature ที่ไม่ใช่รูปปิด — ไม่ใส่ฟิลด์ ไม่ throw', () => {
    const out = withArea(fc([poly({ type: 'Point', coordinates: [98.8, 18.7] }, { a: 1 })]));
    expect(out.features[0].properties).toEqual({ a: 1 });
  });

  it('เขียนทับค่าที่ติดมากับไฟล์ ไม่ปล่อยของเดิมไว้', () => {
    const out = withArea(
      fc([poly({ type: 'Polygon', coordinates: [forestRing()] }, { area_rai: 99999 })])
    );
    expect(out.features[0].properties!.area_rai).not.toBe(99999);
  });

  it('เรียกซ้ำได้ค่าเดิมทุกบิต — คือหลักฐานว่า sha256 จะคงที่', () => {
    const once = withArea(fc([poly({ type: 'Polygon', coordinates: [forestRing()] })]));
    expect(JSON.stringify(withArea(once))).toBe(JSON.stringify(once));
  });

  it('ไม่แก้ของเดิม คืนก้อนใหม่', () => {
    const input = fc([poly({ type: 'Polygon', coordinates: [forestRing()] })]);
    withArea(input);
    expect(input.features[0].properties).toEqual({});
  });
});
