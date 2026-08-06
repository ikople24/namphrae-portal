import { describe, expect, it } from 'vitest';
import {
  runChecks,
  featureKey,
  KEY_SEPARATOR,
  type CheckInput,
} from '@/lib/map-checks';
import { computeStats } from '@/lib/map-stats';
import type { Feature, FeatureCollection, MapLayer } from '@/types/map';

const layer: MapLayer = {
  id: 'parcel',
  title: 'แปลงที่ดิน',
  geometryType: 'MultiPolygon',
  keyFields: ['parcel_cod'],
  keyComposition: [
    ['zone_id', 'block_id', 'lot'],
    ['block_id', 'lot'],
  ],
  visibility: 'public',
  publicFields: ['parcel_cod'],
  currentVersionNo: null,
  order: 0,
  updatedAt: '',
  updatedBy: '',
};

function poly(props: Record<string, unknown>, lon = 98.8, lat = 18.7): Feature {
  return {
    type: 'Feature',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[[[lon, lat], [lon + 0.01, lat], [lon, lat + 0.01], [lon, lat]]]],
    },
    properties: props,
  };
}
const fcOf = (features: Feature[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});

function check(fc: FeatureCollection, opts: Partial<CheckInput> = {}) {
  return runChecks({
    fc,
    stats: computeStats(fc),
    sha256: 'aaa',
    layer,
    previous: null,
    ...opts,
  });
}
const codes = (fc: FeatureCollection, o: Partial<CheckInput> = {}) =>
  check(fc, o).map((c) => c.code);

describe('featureKey', () => {
  it('คีย์เดี่ยว', () => {
    expect(featureKey(poly({ parcel_cod: '04B066' }), ['parcel_cod'])).toBe('04B066');
  });
  it('คีย์ประกอบต่อกันด้วยตัวคั่นที่ไม่ปนกับค่า', () => {
    expect(
      featureKey(poly({ full_id: 'w1', zone_id: 'Moo 4' }), ['full_id', 'zone_id'])
    ).toBe(`w1${KEY_SEPARATOR}Moo 4`);
  });

  // ค่าจริงมีช่องว่างอยู่แล้ว (zone_id = 'Moo 4') ตัวคั่นจึงห้ามเป็นช่องว่าง ไม่งั้น
  // สองรายการที่ต่างกันจะได้คีย์เดียวกันแล้วถูกนับเป็นรายการเดียวกันเงียบ ๆ
  it('คีย์ประกอบที่ตัดคำคนละจุดต้องไม่ชนกัน', () => {
    const a = featureKey(poly({ full_id: 'w1', zone_id: 'Moo 4' }), [
      'full_id',
      'zone_id',
    ]);
    const b = featureKey(poly({ full_id: 'w1 Moo', zone_id: '4' }), [
      'full_id',
      'zone_id',
    ]);
    expect(a).not.toBe(b);
  });

  it('คืน null เมื่อไม่มีคีย์หรือค่าว่าง', () => {
    expect(featureKey(poly({}), [])).toBeNull();
    expect(featureKey(poly({ parcel_cod: '' }), ['parcel_cod'])).toBeNull();
  });
});

describe('runChecks — error', () => {
  it('ไฟล์ว่าง', () => {
    expect(codes(fcOf([]))).toContain('empty');
  });

  it('พิกัด UTM ที่ลืมแปลงถูกจับที่ outside-thailand', () => {
    const utm = fcOf([poly({ parcel_cod: 'a' }, 485894, 2070600)]);
    expect(codes(utm)).toContain('outside-thailand');
  });

  it('พิกัดในไทยไม่ถูกจับ', () => {
    expect(codes(fcOf([poly({ parcel_cod: 'a' })]))).not.toContain('outside-thailand');
  });

  it('ชนิดรูปทรงไม่ตรงกับที่เลเยอร์ตรึงไว้', () => {
    const line = fcOf([
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[98.8, 18.7], [98.9, 18.8]] },
        properties: { parcel_cod: 'a' },
      },
    ]);
    expect(codes(line)).toContain('geometry-type-mismatch');
  });

  it('feature ที่ไม่มี geometry', () => {
    const bad = fcOf([
      { type: 'Feature', geometry: null, properties: { parcel_cod: 'a' } },
    ]);
    expect(codes(bad)).toContain('bad-geometry');
  });
});

describe('runChecks — warning', () => {
  it('คีย์ซ้ำและคีย์ว่าง', () => {
    const fc = fcOf([
      poly({ parcel_cod: '01A001' }),
      poly({ parcel_cod: '01A001' }),
      poly({}),
    ]);
    const dup = check(fc).find((c) => c.code === 'duplicate-key')!;
    expect(dup.level).toBe('warning');
    expect(dup.count).toBe(3); // สองแถวที่ซ้ำ + หนึ่งแถวที่ว่าง
  });

  it('คีย์ไม่ซ้ำไม่ขึ้นคำเตือน', () => {
    expect(
      codes(fcOf([poly({ parcel_cod: 'a' }), poly({ parcel_cod: 'b' })]))
    ).not.toContain('duplicate-key');
  });

  it('key-composition ยอมรับสูตร zone+block+lot', () => {
    const fc = fcOf([
      poly({ parcel_cod: '04B066', zone_id: '04', block_id: 'B', lot: '066' }),
    ]);
    expect(codes(fc)).not.toContain('key-composition');
  });

  it('key-composition ยอมรับสูตร block+lot (ข้อมูลอีกชุดในไฟล์เดียวกัน)', () => {
    const fc = fcOf([
      poly({ parcel_cod: '02S015/004', zone_id: '16', block_id: '02S', lot: '015/004' }),
    ]);
    expect(codes(fc)).not.toContain('key-composition');
  });

  it('key-composition จับแถวที่ประกอบกลับไม่ได้เลย', () => {
    const fc = fcOf([
      poly({ parcel_cod: '01F095/003', zone_id: '01', block_id: '01C', lot: '003' }),
    ]);
    const c = check(fc).find((x) => x.code === 'key-composition')!;
    expect(c.count).toBe(1);
    expect(c.sample[0]).toContain('01F095/003');
  });

  it('null-literal จับสตริง None แต่ไม่แตะขีดกลาง', () => {
    const fc = fcOf([poly({ parcel_cod: 'a', zone_id: 'None', own_soi: '-' })]);
    const c = check(fc).find((x) => x.code === 'null-literal')!;
    expect(c.count).toBe(1);
    expect(c.sample.join()).toContain('zone_id');
    expect(c.sample.join()).not.toContain('own_soi');
  });

  it('mojibake จับข้อความไทยที่ encoding พัง', () => {
    const fc = fcOf([poly({ parcel_cod: 'a', Id_Chanod: '*เน€เธ??เน€เธ?เธ?' })]);
    expect(codes(fc)).toContain('mojibake');
  });

  it('mojibake ไม่จับข้อความไทยปกติ', () => {
    const fc = fcOf([poly({ parcel_cod: 'a', tambol: 'น้ำแพร่', amphur: 'หางดง' })]);
    expect(codes(fc)).not.toContain('mojibake');
  });

  it('new-value เงียบเมื่อไม่มีเวอร์ชันก่อนหน้า', () => {
    expect(
      codes(fcOf([poly({ parcel_cod: 'a', zone_id: 'ใหม่เอี่ยม' })]))
    ).not.toContain('new-value');
  });

  it('new-value จับค่าที่ไม่เคยมีในเวอร์ชันก่อน', () => {
    const before = computeStats(fcOf([poly({ parcel_cod: 'a', zone_id: '01' })]));
    const fc = fcOf([
      poly({ parcel_cod: 'a', zone_id: '01' }),
      poly({ parcel_cod: 'b', zone_id: '167' }),
    ]);
    const c = check(fc, {
      previous: { stats: before, sha256: 'zzz', versionNo: 1 },
    }).find((x) => x.code === 'new-value')!;
    expect(c.sample.join()).toContain('167');
  });

  it('identical เมื่อ sha256 ตรงกับเวอร์ชันที่เผยแพร่อยู่', () => {
    const fc = fcOf([poly({ parcel_cod: 'a' })]);
    const got = codes(fc, {
      previous: { stats: computeStats(fc), sha256: 'aaa', versionNo: 3 },
    });
    expect(got).toContain('identical');
  });

  it('count-jump เมื่อจำนวนเปลี่ยนเกิน 20%', () => {
    const before = computeStats(
      fcOf(Array.from({ length: 100 }, (_, i) => poly({ parcel_cod: `k${i}` })))
    );
    const fc = fcOf(Array.from({ length: 50 }, (_, i) => poly({ parcel_cod: `k${i}` })));
    expect(
      codes(fc, { previous: { stats: before, sha256: 'z', versionNo: 1 } })
    ).toContain('count-jump');
  });

  it('field-removed เมื่อฟิลด์เดิมหายไป', () => {
    const before = computeStats(fcOf([poly({ parcel_cod: 'a', rai: '1' })]));
    const fc = fcOf([poly({ parcel_cod: 'a' })]);
    const c = check(fc, {
      previous: { stats: before, sha256: 'z', versionNo: 1 },
    }).find((x) => x.code === 'field-removed')!;
    expect(c.sample).toContain('rai');
  });

  it('new-public-candidate เมื่อมีฟิลด์ใหม่ที่ยังไม่เปิดสาธารณะ', () => {
    const fc = fcOf([poly({ parcel_cod: 'a', ฟิลด์ใหม่: 'x' })]);
    expect(codes(fc)).toContain('new-public-candidate');
  });

  it('เจอ error แล้วไม่ต้องรายงาน warning ให้รก', () => {
    const utm = fcOf([
      poly({ parcel_cod: 'a' }, 485894, 2070600),
      poly({ parcel_cod: 'a' }, 485895, 2070601),
    ]);
    expect(check(utm).every((c) => c.level === 'error')).toBe(true);
  });
});
