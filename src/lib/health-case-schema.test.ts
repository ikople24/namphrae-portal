import { describe, it, expect } from 'vitest';
import { registryCaseInputSchema, toRegistryDocFields } from '@/lib/health-case-schema';

describe('registryCaseInputSchema', () => {
  it('valid ขั้นต่ำ (disease+yearBE) + default', () => {
    const r = registryCaseInputSchema.safeParse({ disease: 'dengue', yearBE: 2568 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ disease: 'dengue', yearBE: 2568, fullName: '', ageYears: null, moo: null, onsetDate: null });
  });
  it('reject disease/ปี ผิด', () => {
    expect(registryCaseInputSchema.safeParse({ disease: 'flu', yearBE: 2568 }).success).toBe(false);
    expect(registryCaseInputSchema.safeParse({ disease: 'dengue', yearBE: 1000 }).success).toBe(false);
  });
});

describe('toRegistryDocFields', () => {
  it('ISO → Date, null/ว่าง → null, คงฟิลด์อื่น', () => {
    const input = registryCaseInputSchema.parse({
      disease: 'dengue', yearBE: 2568, onsetDate: '2025-01-07', treatDate: null,
      fullName: 'ด.ญ.ทดสอบ', ageYears: 14, moo: 11,
    });
    const f = toRegistryDocFields(input);
    expect(f.onsetDate?.toISOString()).toBe('2025-01-07T00:00:00.000Z');
    expect(f.treatDate).toBeNull();
    expect(f.fullName).toBe('ด.ญ.ทดสอบ');
    expect(f.ageYears).toBe(14);
    expect(f.moo).toBe(11);
    expect(f.disease).toBe('dengue');
  });
  it('วันที่พัง → null (ไม่ throw)', () => {
    const input = registryCaseInputSchema.parse({ disease: 'dengue', yearBE: 2568, onsetDate: 'ไม่ใช่วันที่' });
    expect(toRegistryDocFields(input).onsetDate).toBeNull();
  });
});
