// src/lib/forest-prep.test.ts
import { describe, expect, it } from 'vitest';
import { mooFromName, prepCommunityForest, registryRai, splitWeir } from '@/lib/forest-prep';
import type { Feature, FeatureCollection } from '@/types/map';

const feat = (properties: Record<string, unknown>): Feature => ({
  type: 'Feature',
  geometry: { type: 'MultiPolygon', coordinates: [] },
  properties,
});
const coll = (features: Feature[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});

describe('mooFromName', () => {
  it('อ่านเลขหมู่ได้จากทั้งสองรูปแบบที่ปนกันในไฟล์เดียว', () => {
    expect(mooFromName('เขตป่าชุมชน หมู่ 7')).toBe(7);
    expect(mooFromName('เขตป่าชุมชน หมู่ 9')).toBe(9);
    expect(mooFromName('พิกัดป่าชุมชนหมู่ 10')).toBe(10);
    expect(mooFromName('พิกัดป่าชุมชนหมู่ 11')).toBe(11);
  });

  it('รองรับ "หมู่ที่ N" ด้วย', () => {
    expect(mooFromName('แผนที่ป่าชุมชนหมู่ที่ 10')).toBe(10);
  });

  it('หาไม่เจอ → โยน error ไม่เดาเป็น 0', () => {
    expect(() => mooFromName('ป่าชุมชน')).toThrow(/หาเลขหมู่/);
    expect(() => mooFromName(null)).toThrow(/หาเลขหมู่/);
  });
});

describe('registryRai', () => {
  it('รวม ไร่ + งาน + ตารางวา เป็นไร่ทศนิยม', () => {
    // หมู่ 11 ในไฟล์จริง: 1941 ไร่ 0 งาน 81.59 วา
    expect(registryRai(feat({ 'ไร่': 1941, 'งาน': 0, 'ตาร\uFFFD': 81.59 }))).toBeCloseTo(
      1941.204,
      3
    );
    // หมู่ 9: 707 ไร่ 2 งาน 44.15 วา
    expect(registryRai(feat({ 'ไร่': 707, 'งาน': 2, 'ตาร\uFFFD': 44.15 }))).toBeCloseTo(
      707.61,
      2
    );
  });

  it('คีย์ตารางวาถูกตัดกลางคำต่างกันก็ยังหาเจอ', () => {
    expect(registryRai(feat({ 'ไร่': 50, 'งาน': 0, 'ตารางวา': 8.41 }))).toBeCloseTo(50.02, 2);
  });

  it('ฟิลด์ไม่ครบ → null ไม่ใช่ NaN', () => {
    expect(registryRai(feat({ 'ไร่': 50 }))).toBeNull();
  });

  it('ช่องว่างในทะเบียน → null ไม่ใช่ 0 — 0 จะทำให้ด่านตรวจรายงานผิดสาเหตุ', () => {
    expect(registryRai(feat({ 'ไร่': null, 'งาน': 0, 'ตาร\uFFFD': 0 }))).toBeNull();
    expect(registryRai(feat({ 'ไร่': '', 'งาน': 0, 'ตาร\uFFFD': 0 }))).toBeNull();
  });

  it('เลขที่มาเป็นสตริงก็อ่านได้ — ถุง properties ไม่รับประกันชนิด', () => {
    expect(registryRai(feat({ 'ไร่': '463', 'งาน': '0', 'ตาร\uFFFD': '36.76' }))).toBeCloseTo(
      463.0919,
      4
    );
  });

  it('ไม่หยิบคอลัมน์ ตารางเมตร มาใช้แทน — สองชื่อนี้ถูกตัดเหลือชื่อ DBF เดียวกัน', () => {
    expect(
      registryRai(feat({ 'ไร่': 50, 'งาน': 0, 'ตารางเมตร': 20000, 'ตาร\uFFFD': 8.41 }))
    ).toBeCloseTo(50.021, 3);
    expect(registryRai(feat({ 'ไร่': 50, 'งาน': 0, 'ตารางเมตร': 20000 }))).toBeNull();
  });
});

describe('prepCommunityForest', () => {
  it('เหลือแค่ moo — ฟิลด์ขยะจาก QGIS หายหมด', () => {
    const out = prepCommunityForest(
      coll([
        feat({
          id: 1,
          name: 'เขตป่าชุมชน หมู่ 7',
          Area: 740947.05,
          path: 'D:/Qgis/ป่าไม้/ป่าชุมชน/เขตป่าชุมชน หมู่',
          'ไร่': 463,
          'งาน': 0,
          'ตาร\uFFFD': 36.76,
        }),
      ])
    );
    expect(out.features[0].properties).toStrictEqual({ moo: 7 });
  });

  it('ไม่แตะ geometry', () => {
    const g = { type: 'MultiPolygon', coordinates: [[[[98.1, 18.1]]]] };
    const out = prepCommunityForest(
      coll([{ type: 'Feature', geometry: g, properties: { name: 'หมู่ 10' } }])
    );
    expect(out.features[0].geometry).toEqual(g);
  });

  it('ทิ้ง crs ระดับบน — ป้าย UTM ที่ค้างมาจะทำให้ parseMapFile ปฏิเสธไฟล์ที่ประกอบใหม่', () => {
    const out = prepCommunityForest({
      type: 'FeatureCollection',
      crs: { properties: { name: 'urn:ogc:def:crs:EPSG::32647' } },
      features: [feat({ name: 'หมู่ 7' })],
    });
    expect(Object.keys(out)).toEqual(['type', 'features']);
  });

  it('ชื่อแปลงเดียวที่อ่านไม่ออกทำให้ทั้งก้อนล้ม ไม่ใช่นำเข้าครึ่ง ๆ กลาง ๆ', () => {
    expect(() =>
      prepCommunityForest(
        coll([feat({ name: 'เขตป่าชุมชน หมู่ 7' }), feat({ name: 'ป่าชุมชน' })])
      )
    ).toThrow(/หาเลขหมู่/);
  });
});

const pt = (properties: Record<string, unknown>): Feature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [98.89, 18.71] },
  properties,
});

const RAW_WEIR = [
  pt({
    fid: 1,
    Name: 'Photo(1).jpg',
    Date: '2025-06-18',
    Altitude: 335,
    Path: 'D:/Qgis/ป่าไม้/ฝาย\\Photo(1).jpg',
    RelPath: 'ฝาย\\Photo(1).jpg',
    Images: '<img src = "ฝาย\\Photo(1).jpg" width="300" height="225"/>',
    Link: 'file:///D:/Qgis/ป่าไม้/ฝาย\\Photo(1).jpg',
    cause: null,
    loss: null,
    LAT: 18.71541,
    LON: 98.89409,
  }),
  pt({ fid: 41, Name: 'Photo(41).jpg', Date: '2025-06-20', Altitude: 356 }),
  pt({ fid: 42, Name: null, Date: '18-มิ.ย.-68', cause: 'ภัยแล้ง ไม่มีน้ำ', loss: 'ฝายม่อนหินขาว ม.7' }),
  pt({ fid: 54, Name: null, Date: '๒๐-ก.ย.-๖๔', cause: 'ภัยแล้ง ไม่มีน้ำ', loss: 'ฝายป็อกกลาง' }),
];

describe('splitWeir', () => {
  it('แบ่งที่ fid 41/42 — ไม่มีจุดไหนคาบเกี่ยว', () => {
    const { weir, survey } = splitWeir(coll(RAW_WEIR));
    expect(survey.features).toHaveLength(2);
    expect(weir.features).toHaveLength(2);
  });

  it('จุดสำรวจเหลือ photo/surveyed_at/elevation_m — path บนไดรฟ์ D: หายหมด', () => {
    const { survey } = splitWeir(coll(RAW_WEIR));
    expect(survey.features[0].properties).toEqual({
      photo: 'Photo(1).jpg',
      elevation_m: 335,
      surveyed_at: '2025-06-18',
    });
  });

  it('ฝายเหลือ name/note/surveyed_at โดย loss กลายเป็นชื่อฝาย', () => {
    const { weir } = splitWeir(coll(RAW_WEIR));
    expect(weir.features[0].properties).toEqual({
      name: 'ฝายม่อนหินขาว ม.7',
      note: 'ภัยแล้ง ไม่มีน้ำ',
      surveyed_at: '2025-06-18',
    });
  });

  it('แปลงวันที่เลขไทยของฝายเก่าให้เป็น ISO', () => {
    const { weir } = splitWeir(coll(RAW_WEIR));
    expect(weir.features[1].properties?.surveyed_at).toBe('2021-09-20');
  });

  it('แถวที่ไม่มี fid → โยน error ไม่เดาว่าอยู่ฝั่งไหน', () => {
    expect(() => splitWeir(coll([pt({ Name: 'x', Date: '2025-06-18' })]))).toThrow(/fid/);
  });

  it('fid เป็น null → โยน error ไม่ไหลไปอยู่ฝั่งจุดสำรวจ', () => {
    // null คือรูปแบบที่ไฟล์ชุดนี้ใช้เขียนช่องว่างจริง ๆ ไม่ใช่การละคีย์ทิ้ง
    expect(() =>
      splitWeir(
        coll([pt({ fid: null, Date: '18-มิ.ย.-68', cause: 'ภัยแล้ง ไม่มีน้ำ', loss: 'ฝายสภาเด็ก' })])
      )
    ).toThrow(/fid/);
    expect(() => splitWeir(coll([pt({ fid: 0, Date: '2025-06-18' })]))).toThrow(/fid/);
    expect(() => splitWeir(coll([pt({ fid: 54.7, Date: '2025-06-18' })]))).toThrow(/fid/);
  });

  it('fid ที่เป็นสตริงตัวเลขยังใช้ได้', () => {
    const { weir } = splitWeir(coll([pt({ fid: '42', Date: '2025-06-18', loss: 'ฝายทดสอบ' })]));
    expect(weir.features).toHaveLength(1);
  });

  it('แถวฝายที่ไม่มีชื่อ → โยน error เพราะชื่อคือคีย์ประจำรายการ', () => {
    expect(() =>
      splitWeir(coll([pt({ fid: 42, Date: '2025-06-18', cause: 'ภัยแล้ง ไม่มีน้ำ' })]))
    ).toThrow(/ไม่มีชื่อ/);
  });

  it('วันที่อ่านไม่ออกต้องบอกด้วยว่าแถวไหน', () => {
    expect(() =>
      splitWeir(coll([pt({ fid: 42, Date: '12/06/2566', loss: 'ฝายทดสอบ' })]))
    ).toThrow(/ฝายทดสอบ/);
  });
});
