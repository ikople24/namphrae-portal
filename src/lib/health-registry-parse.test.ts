import { describe, it, expect } from 'vitest';
import { sheetYearBE, parseRegistrySheet, parsePopulationSheet, parseChikunMooYear } from '@/lib/health-registry-parse';

describe('sheetYearBE', () => {
  it('ชีตรายเคส → ปี พ.ศ.', () => {
    expect(sheetYearBE('63เคสรับแจ้ง')).toBe(2563);
    expect(sheetYearBE('67เคสรับแจ้ง ')).toBe(2567); // มี space ท้ายชื่อจริง
    expect(sheetYearBE('68เคสDF')).toBe(2568);
    expect(sheetYearBE('68เคสชิคุน')).toBe(2568);
  });
  it('ชีตชิคุนกุนยา/ชีตสรุป → null', () => {
    expect(sheetYearBE('แยกรายหมู่บ้าน )')).toBeNull();
    expect(sheetYearBE('อัตราป่วยไทย ย้อนหลัง 5 ปี')).toBeNull();
  });
});

// โครงแถวตามไฟล์จริง: แถว 0 = หัวเรื่อง, แถว 1 = header, จากนั้นข้อมูล
const HEADER = ['ลำดับ', 'ชื่อ-สกุล', 'อายุ', 'ที่อยู่', 'หมู่', 'เริ่มป่วย', 'รักษา', 'รับแจ้ง', 'วินิจฉัย', 'ประเภท', 'รับการรักษาที่', 'หมายเหตุ'];
const SHEET: unknown[][] = [
  ['ทะเบียนรายชื่อผู้ป่วยไข้เลือดออก/ชิคุนกุนยา 2563 ตำบลน้ำแพร่', '', '', '', '', '', '', '', '', '', '', ''],
  HEADER,
  [1, 'นายทดสอบ หนึ่ง', 33, 'บ้านสวนไม่มีเลขที่', 7, '25 มิถุนายน 2563', '28 มิถุนายน 2563', '29 มิถุนายน 2563', 'DSS', 'IPD', 'นครพิงค์', 'ญาติบอกว่าไม่ได้ไปไหน'],
  [2, 'นางทดสอบ สอง', 34, '200', '', '30', '1', '2', 'DF', 'OPD', 'หางดง', ''],
  [3, 'นายชิคุน สาม', 40, '11', 4, '1 กรกฎาคม 2563', '', '', 'ชิคุนกุนยา', 'OPD', 'หางดง', ''],
  ['', '', '', '', '', '', '', '', '', '', '', ''],
  ['รวม', 3, '', '', '', '', '', '', '', '', '', ''],
];

describe('parseRegistrySheet', () => {
  it('parse เคสครบทุกฟิลด์รวม PII (สำหรับหลังบ้าน)', () => {
    const { cases } = parseRegistrySheet(SHEET, 2563);
    expect(cases[0]).toMatchObject({
      yearBE: 2563, seq: 1, fullName: 'นายทดสอบ หนึ่ง', ageYears: 33,
      address: 'บ้านสวนไม่มีเลขที่', moo: 7,
      diagnosis: 'DSS', careType: 'IPD', hospital: 'นครพิงค์', note: 'ญาติบอกว่าไม่ได้ไปไหน',
    });
    expect(cases[0].onsetDate?.toISOString()).toBe('2020-06-25T00:00:00.000Z');
    expect(cases[0].notifyDate?.toISOString()).toBe('2020-06-29T00:00:00.000Z');
  });
  it('แถววันที่/หมู่เสีย → เก็บเคสไว้ (ค่า null) + รายงาน anomaly', () => {
    const { cases, anomalies } = parseRegistrySheet(SHEET, 2563);
    const c2 = cases.find((c) => c.seq === 2)!;
    expect(c2.moo).toBeNull();
    expect(c2.onsetDate).toBeNull();
    expect(c2.notifyDate).toBeNull();
    expect(anomalies.some((a) => a.includes('ลำดับ 2') && a.includes('หมู่'))).toBe(true);
    expect(anomalies.some((a) => a.includes('ลำดับ 2') && a.includes('วันที่'))).toBe(true);
  });
  it('แท็ก disease ต่อแถว — ชิคุนไม่ถูกข้าม + ข้ามแถวว่าง/แถวสรุป', () => {
    const { cases, duplicateSeqs } = parseRegistrySheet(SHEET, 2563);
    expect(cases).toHaveLength(3); // dengue 2 (seq 1,2) + chikun 1 (seq 3)
    expect(cases.find((c) => c.seq === 1)!.disease).toBe('dengue');
    expect(cases.find((c) => c.seq === 3)!.disease).toBe('chikungunya');
    expect(duplicateSeqs).toEqual([]);
  });
  it('ไม่พบ header → คืน anomaly ไม่ throw', () => {
    const { cases, anomalies } = parseRegistrySheet([['ไม่มีหัวตาราง']], 2563);
    expect(cases).toHaveLength(0);
    expect(anomalies).toHaveLength(1);
  });
  it('anomaly ข้อความวันที่ parse ไม่ได้ ต้องไม่มีคำว่า "undefined" ปนอยู่', () => {
    const { anomalies } = parseRegistrySheet(SHEET, 2563);
    const dateAnomaly = anomalies.find((a) => a.includes('ลำดับ 2') && a.includes('วันที่'));
    expect(dateAnomaly).toBeDefined();
    expect(dateAnomaly).not.toMatch(/undefined/);
  });
  it('header ขาดคอลัมน์ "วินิจฉัย" (พิมพ์ผิดเป็น "วินิจฉัยย") → anomaly เตือนคอลัมน์หาย', () => {
    const badHeader = HEADER.map((h) => (h === 'วินิจฉัย' ? 'วินิจฉัยย' : h));
    const sheet: unknown[][] = [
      ['หัวเรื่อง', '', '', '', '', '', '', '', '', '', '', ''],
      badHeader,
      [1, 'นายชิคุน สาม', 40, '11', 4, '1 กรกฎาคม 2563', '', '', 'ชิคุนกุนยา', 'OPD', 'หางดง', ''],
    ];
    const { cases, anomalies } = parseRegistrySheet(sheet, 2563);
    expect(anomalies.some((a) => a.includes('วินิจฉัย'))).toBe(true);
    // คอลัมน์วินิจฉัยหาย → เช็คชิคุนกุนยาทำงานไม่ได้ → แถวไม่ถูกข้าม (คือความล้มเหลวที่ anomaly ต้องเตือนไว้ก่อน)
    expect(cases).toHaveLength(1);
  });
  it('คอลัมน์วันที่หายทั้งคู่ (เริ่มป่วย/รับแจ้ง ไม่มีในหัวตาราง) → anomaly ต้องไม่มีคำว่า "undefined"', () => {
    const headerNoDates = ['ลำดับ', 'ชื่อ-สกุล', 'อายุ', 'ที่อยู่', 'หมู่', 'รักษา', 'วินิจฉัย', 'ประเภท', 'รับการรักษาที่', 'หมายเหตุ'];
    const sheet: unknown[][] = [
      ['หัวเรื่อง'],
      headerNoDates,
      [1, 'นายทดสอบ หนึ่ง', 33, 'บ้านสวนไม่มีเลขที่', 7, '28 มิถุนายน 2563', 'DSS', 'IPD', 'นครพิงค์', ''],
    ];
    const { anomalies } = parseRegistrySheet(sheet, 2563);
    const dateAnomaly = anomalies.find((a) => a.includes('วันที่ parse ไม่ได้'));
    expect(dateAnomaly).toBeDefined();
    expect(dateAnomaly).not.toMatch(/undefined/);
  });
  it('ลำดับซ้ำในชีตเดียวกัน → anomaly "ซ้ำ" แต่เก็บทั้งสองแถวไว้ (ไม่ทิ้งแถว)', () => {
    const sheet: unknown[][] = [
      ['หัวเรื่อง', '', '', '', '', '', '', '', '', '', '', ''],
      HEADER,
      [1, 'นายทดสอบ หนึ่ง', 33, 'บ้านสวนไม่มีเลขที่', 7, '25 มิถุนายน 2563', '28 มิถุนายน 2563', '29 มิถุนายน 2563', 'DSS', 'IPD', 'นครพิงค์', ''],
      [1, 'นายทดสอบ ซ้ำ', 30, 'ที่อยู่อื่น', 8, '26 มิถุนายน 2563', '', '30 มิถุนายน 2563', 'DF', 'OPD', 'หางดง', ''],
    ];
    const { cases, anomalies, duplicateSeqs } = parseRegistrySheet(sheet, 2563);
    expect(cases).toHaveLength(2);
    expect(anomalies.some((a) => a.includes('ซ้ำ'))).toBe(true);
    expect(duplicateSeqs).toEqual([1]);
  });
});

describe('parsePopulationSheet', () => {
  it('อ่าน ปี+ปชก. ข้าม header และแถวเสีย', () => {
    const rows: unknown[][] = [
      ['ปี', 'ปชก', 'ป่วย', 'อัตราป่วย'],
      [2559, 7025, 60, 854.09],
      [2563, 6756, 17, 251.62],
      ['', '', '', ''],
    ];
    expect(parsePopulationSheet(rows)).toEqual([
      { yearBE: 2559, population: 7025, thaiCases: 60 },
      { yearBE: 2563, population: 6756, thaiCases: 17 },
    ]);
  });
});

describe('parseChikunMooYear', () => {
  it('อ่านตารางรายหมู่รายปี (รวม count 0, ข้ามแถวสรุป)', () => {
    const rows: unknown[][] = [
      ['', 2563, 2564, 2565, 2566, 2567, 2568, ''],
      ['หมู่ 1', 0, 0, 0, 0, 0, 0, ''],
      ['หมู่ 5', 1, 0, 0, 1, 0, 1, ''],
      ['', '', '', '', '', '', '', ''],
      ['', 1, 0, 0, 1, 0, 10, ''], // แถวสรุป (ไม่มี "หมู่") ต้องถูกข้าม
    ];
    const out = parseChikunMooYear(rows);
    expect(out).toHaveLength(12); // 2 หมู่ × 6 ปี
    expect(out).toContainEqual({ yearBE: 2563, moo: 5, count: 1 });
    expect(out).toContainEqual({ yearBE: 2568, moo: 5, count: 1 });
    expect(out).toContainEqual({ yearBE: 2564, moo: 1, count: 0 });
    expect(out.every((r) => r.moo === 1 || r.moo === 5)).toBe(true);
  });
});
