import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { statsWorkbookBuffer, registryWorkbookBuffer } from '@/lib/health-export';

describe('statsWorkbookBuffer', () => {
  it('สร้าง 2 ชีต รายปี/รายหมู่ พร้อมค่า', () => {
    const buf = statsWorkbookBuffer(
      [{ yearBE: 2568, total: 69, thai: 57, foreign: 12, population: 7764, ratePer100kThai: 734.1, medianRatePrev5: 15, hasRegistry: true }],
      [{ moo: 7, count: 5 }]
    );
    const wb = XLSX.read(buf, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['รายปี', 'รายหมู่']);
    const yr = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['รายปี'], { header: 1 });
    expect(yr[0]).toContain('มัธยฐานอัตรา 5 ปี');
    expect(yr[1]).toEqual([2568, 69, 57, 12, 7764, 734.1, 15]);
    const mo = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['รายหมู่'], { header: 1 });
    expect(mo[1]).toEqual([7, 5]);
  });
});

describe('registryWorkbookBuffer', () => {
  it('สร้างชีตทะเบียน มีชื่อ-สกุล (PII สำหรับ export หลังบ้าน)', () => {
    const buf = registryWorkbookBuffer([{
      yearBE: 2568, seq: 1, fullName: 'ด.ญ.ทดสอบ', ageYears: 14, address: '52', moo: 11,
      onsetDate: '2025-01-07T00:00:00.000Z', treatDate: null, notifyDate: null,
      diagnosis: 'DF', careType: 'OPD', hospital: 'รพ.หางดง', note: 'x',
    }]);
    const wb = XLSX.read(buf, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['ทะเบียน']);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['ทะเบียน'], { header: 1 });
    expect(rows[0][2]).toBe('ชื่อ-สกุล');
    expect(rows[1][2]).toBe('ด.ญ.ทดสอบ');
  });
});
