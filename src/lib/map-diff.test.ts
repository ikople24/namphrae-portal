import { describe, expect, it } from 'vitest';
import { computeDiff } from '@/lib/map-diff';
import type { Feature, FeatureCollection } from '@/types/map';

const f = (props: Record<string, unknown>, lon = 98.8): Feature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, 18.7] },
  properties: props,
});
const fc = (features: Feature[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});

describe('computeDiff', () => {
  it('นับเพิ่ม ลบ แก้ไข ด้วยคีย์เดี่ยว', () => {
    const before = fc([f({ k: 'a', v: '1' }), f({ k: 'b', v: '1' }), f({ k: 'c', v: '1' })]);
    const after = fc([f({ k: 'a', v: '1' }), f({ k: 'b', v: '2' }), f({ k: 'd', v: '1' })]);
    const d = computeDiff(after, before, ['k'], 3);
    expect(d).toMatchObject({ comparedToVersionNo: 3, added: 1, removed: 1, changed: 1 });
  });

  it('geometry เปลี่ยนก็นับว่าแก้ไข', () => {
    const before = fc([f({ k: 'a' }, 98.8)]);
    const after = fc([f({ k: 'a' }, 99.9)]);
    expect(computeDiff(after, before, ['k'], 1).changed).toBe(1);
  });

  it('ลำดับคีย์ใน properties ต่างกันไม่นับว่าแก้ไข', () => {
    const before = fc([{ ...f({}), properties: { k: 'a', x: 1, y: 2 } }]);
    const after = fc([{ ...f({}), properties: { k: 'a', y: 2, x: 1 } }]);
    expect(computeDiff(after, before, ['k'], 1).changed).toBe(0);
  });

  it('คีย์ประกอบ', () => {
    const before = fc([f({ id: 'w1', zone: 'Moo 4' }), f({ id: 'w1', zone: 'Moo 7' })]);
    const after = fc([f({ id: 'w1', zone: 'Moo 4' })]);
    expect(computeDiff(after, before, ['id', 'zone'], 1)).toMatchObject({
      added: 0,
      removed: 1,
    });
  });

  it('ไม่มีคีย์ = เทียบได้แค่จำนวน ไม่แกล้งบอกว่ารายการไหนหาย', () => {
    const before = fc([f({ a: 1 }), f({ a: 2 })]);
    const after = fc([f({ a: 1 })]);
    const d = computeDiff(after, before, [], 1);
    expect(d).toMatchObject({ added: 0, removed: 1, changed: 0 });
  });

  it('ไม่มีคีย์และจำนวนเพิ่ม', () => {
    const d = computeDiff(fc([f({}), f({}), f({})]), fc([f({})]), [], 1);
    expect(d).toMatchObject({ added: 2, removed: 0 });
  });

  it('รายงานฟิลด์ที่เพิ่มและหาย', () => {
    const before = fc([f({ k: 'a', old: 1 })]);
    const after = fc([f({ k: 'a', fresh: 1 })]);
    const d = computeDiff(after, before, ['k'], 1);
    expect(d.fieldsAdded).toEqual(['fresh']);
    expect(d.fieldsRemoved).toEqual(['old']);
  });

  it('คีย์ซ้ำไม่ทำให้พัง — นับตามจำนวนที่ปรากฏ', () => {
    const before = fc([f({ k: 'a' }), f({ k: 'a' })]);
    const after = fc([f({ k: 'a' })]);
    expect(computeDiff(after, before, ['k'], 1).removed).toBe(1);
  });

  it('รายการที่ไม่มีคีย์ถูกนับรวมแบบไม่ระบุตัวตน', () => {
    const before = fc([f({ k: 'a' }), f({ k: '' })]);
    const after = fc([f({ k: 'a' })]);
    expect(computeDiff(after, before, ['k'], 1).removed).toBe(1);
  });

  it('ไฟล์เหมือนเดิมทุกอย่าง = ไม่มีอะไรเปลี่ยน', () => {
    const same = fc([f({ k: 'a', v: '1' }), f({ k: 'b', v: '2' })]);
    expect(computeDiff(same, same, ['k'], 2)).toMatchObject({
      added: 0,
      removed: 0,
      changed: 0,
      fieldsAdded: [],
      fieldsRemoved: [],
    });
  });
});
