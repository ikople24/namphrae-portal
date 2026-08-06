import { describe, expect, it } from 'vitest';
import { buildColorGroups, GROUP_PALETTE } from '@/lib/map-style';

describe('buildColorGroups', () => {
  it('ค่าที่ไม่เกินขนาดจานสีได้สีคนละสีเสมอ', () => {
    const groups = buildColorGroups(['Moo 1', 'Moo 2', 'Moo 3', 'Moo 4']);
    expect(new Set(groups.values()).size).toBe(4);
  });

  it('ค่าซ้ำถูกยุบเหลือกลุ่มเดียว', () => {
    const groups = buildColorGroups(['04', '04', '04', '05']);
    expect(groups.size).toBe(2);
  });

  // ต้องได้สีเดิมทุกครั้งที่โหลดใหม่ ไม่งั้นแผนที่เปลี่ยนสีเองทุกรีเฟรช
  it('ลำดับข้อมูลขาเข้าไม่มีผลต่อสีที่ได้', () => {
    const a = buildColorGroups(['Moo 3', 'Moo 1', 'Moo 2']);
    const b = buildColorGroups(['Moo 2', 'Moo 3', 'Moo 1']);
    expect([...a]).toEqual([...b]);
  });

  it('เรียงแบบตัวเลขในสตริง ไม่ใช่เรียงตามรหัสอักขระ', () => {
    // 'Moo 10' ต้องมาหลัง 'Moo 9' ไม่ใช่หลัง 'Moo 1' แบบการเรียงสตริงล้วน
    const keys = [...buildColorGroups(['Moo 1', 'Moo 9', 'Moo 10', 'Moo 2']).keys()];
    expect(keys).toEqual(['Moo 1', 'Moo 2', 'Moo 9', 'Moo 10']);
  });

  it('ค่ามากกว่าจานสีก็ยังได้สีครบทุกค่า ไม่มีค่าไหนไม่มีสี', () => {
    const many = Array.from({ length: GROUP_PALETTE.length + 5 }, (_, i) => `z${i}`);
    const groups = buildColorGroups(many);
    expect(groups.size).toBe(many.length);
    expect([...groups.values()].every((c) => GROUP_PALETTE.includes(c))).toBe(true);
  });

  it('ไม่มีค่าเลยก็ไม่พัง', () => {
    expect(buildColorGroups([]).size).toBe(0);
  });
});
