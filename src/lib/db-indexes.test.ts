import { describe, expect, it } from 'vitest';
import { MIGRATED_INDEXES } from '@/lib/db-indexes';

describe('MIGRATED_INDEXES', () => {
  it('ครอบ collection ที่ย้ายมาครบทั้งสี่', () => {
    expect(Object.keys(MIGRATED_INDEXES).sort()).toEqual([
      'chikunMooYears',
      'diseaseCases',
      'diseaseYearStats',
      'incidents',
    ]);
  });

  it('ดัชนีกันเคสซ้ำของทะเบียนต้องเป็น unique', () => {
    const seq = MIGRATED_INDEXES.diseaseCases.find(
      (i) => JSON.stringify(i.key) === JSON.stringify({ disease: 1, yearBE: 1, seq: 1 })
    );
    expect(seq?.unique).toBe(true);
  });

  it('ประชากรรายปีและชิคุนรายหมู่ต้อง unique เหมือนต้นทาง', () => {
    expect(MIGRATED_INDEXES.diseaseYearStats[0].unique).toBe(true);
    expect(MIGRATED_INDEXES.chikunMooYears[0].unique).toBe(true);
  });

  it('incidents ต้องมีดัชนี 2dsphere ไว้ค้นเชิงพื้นที่', () => {
    const geo = MIGRATED_INDEXES.incidents.find((i) => i.key.location === '2dsphere');
    expect(geo).toBeTruthy();
    expect(geo?.unique).toBeUndefined();
  });
});
