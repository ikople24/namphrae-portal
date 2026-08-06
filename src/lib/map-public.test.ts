import { describe, expect, it } from 'vitest';
import { toPublicFeatureCollection } from '@/lib/map-public';
import type { FeatureCollection } from '@/types/map';

const fc: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [98.8, 18.7] },
      properties: {
        parcel_cod: '04B066',
        rai: '1',
        own_Hse_no: '177',
        Id_Chanod: '76007',
      },
    },
  ],
};

describe('toPublicFeatureCollection', () => {
  it('เก็บเฉพาะฟิลด์ใน whitelist', () => {
    const out = toPublicFeatureCollection(fc, ['parcel_cod', 'rai']);
    expect(out.features[0].properties).toEqual({ parcel_cod: '04B066', rai: '1' });
  });

  it('ฟิลด์ที่ไม่อยู่ใน whitelist ต้องหายไปทั้งหมด', () => {
    const out = toPublicFeatureCollection(fc, ['parcel_cod']);
    const json = JSON.stringify(out);
    expect(json).not.toContain('own_Hse_no');
    expect(json).not.toContain('177');
    expect(json).not.toContain('76007');
  });

  it('whitelist ว่าง = properties ว่าง ไม่ใช่เปิดหมด', () => {
    const out = toPublicFeatureCollection(fc, []);
    expect(out.features[0].properties).toEqual({});
  });

  it('geometry ไม่ถูกแตะ', () => {
    const out = toPublicFeatureCollection(fc, []);
    expect(out.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [98.8, 18.7],
    });
  });

  // ข้อสอบสำคัญ: ฟิลด์ที่เพิ่งโผล่มาในไฟล์เวอร์ชันใหม่ต้องถูกกันไว้เอง ไม่ใช่หลุด
  // ออกไปเอง — เหตุผลเดียวกับ PUBLIC_JOB_FIELDS ใน src/types/portal.ts
  it('ฟิลด์ใหม่ที่ไม่เคยประกาศต้องไม่หลุดออกไปเอง', () => {
    const withNew: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [98.8, 18.7] },
          properties: { parcel_cod: '04B066', owner_phone_2569: '0812345678' },
        },
      ],
    };
    const out = toPublicFeatureCollection(withNew, ['parcel_cod', 'rai']);
    expect(out.features[0].properties).toEqual({ parcel_cod: '04B066' });
  });

  it('properties ที่เป็น null กลายเป็น {} ไม่ใช่ null', () => {
    const nullProps: FeatureCollection = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: null, properties: null }],
    };
    expect(
      toPublicFeatureCollection(nullProps, ['a']).features[0].properties
    ).toEqual({});
  });

  it('ไม่ติด crs/name ของไฟล์ต้นทางไปด้วย', () => {
    const withMeta: FeatureCollection = {
      ...fc,
      name: 'Parcel_3',
      crs: { type: 'name' },
    };
    const out = toPublicFeatureCollection(withMeta, []);
    expect(out.name).toBeUndefined();
    expect(out.crs).toBeUndefined();
  });
});
