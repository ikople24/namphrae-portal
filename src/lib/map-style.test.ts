import { describe, expect, it } from 'vitest';
import {
  buildColorGroups,
  COLOR_BY,
  GROUP_PALETTE,
  LAYER_STYLES,
  VERIFIED_GROUP_SLOTS,
} from '@/lib/map-style';

// เทสต์กลุ่ม GROUP_PALETTE/COLOR_BY ตรึง "ผลการตรวจ" ไม่ใช่ตรวจซ้ำ — สูตร ΔE ใน
// OKLab พร้อมการจำลองตาบอดสีอยู่ในสคริปต์ของสกิล dataviz ไม่ได้อยู่ใน repo นี้
// การก๊อบสูตรมาไว้ที่นี่จะกลายเป็นสำเนาที่ไม่มีใครดูแลและเพี้ยนจากต้นฉบับเงียบ ๆ
//
// สิ่งที่ตรึงได้จริงคือ **ค่าสี** ถ้ามีคนมาแก้เพราะคิดว่าไม่สวย เทสต์จะแตกทันที
// พร้อมคำสั่งที่ต้องรันก่อนเปลี่ยน:
//
//   node scripts/validate_palette.js "<สีที่จะใช้>" --mode light --pairs all
//
// (สคริปต์อยู่ในสกิล dataviz — path เต็มขึ้นกับเวอร์ชันของสกิลที่ติดตั้งอยู่)
const VERIFIED_HEAD = [
  '#E69F00',
  '#56B4E9',
  '#009E73',
  '#0072B2',
  '#D55E00',
  '#AA3377',
  '#8b5cf6',
];

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

describe('GROUP_PALETTE', () => {
  it('เจ็ดสีแรกเป็นชุดที่ผ่านการตรวจ ΔE แล้ว ห้ามแก้โดยไม่รันตัวตรวจซ้ำ', () => {
    expect(GROUP_PALETTE.slice(0, VERIFIED_GROUP_SLOTS)).toEqual(VERIFIED_HEAD);
  });

  it('VERIFIED_GROUP_SLOTS ตรงกับความยาวของหัวที่ตรวจแล้วจริง', () => {
    expect(VERIFIED_GROUP_SLOTS).toBe(VERIFIED_HEAD.length);
  });

  it('ไม่มีสีซ้ำ — สีซ้ำแปลว่าสองกลุ่มได้สีเดียวกันทั้งที่จานยังไม่หมด', () => {
    expect(new Set(GROUP_PALETTE).size).toBe(GROUP_PALETTE.length);
  });

  it('ทุกช่องเป็นรหัสสีหกหลัก — สามหลักย่อจะทำให้เทียบกับผลตรวจไม่ตรง', () => {
    for (const c of GROUP_PALETTE) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('COLOR_BY', () => {
  it('ทุกเลเยอร์ที่แยกสีตามกลุ่มมีสไตล์ประจำตัว', () => {
    // เลเยอร์ที่ไม่มีสไตล์จะตกไปใช้ FALLBACK_STYLE ซึ่งไม่มี pane เป็นของตัวเอง
    // ลำดับซ้อนจึงกลายเป็นเรื่องบังเอิญ
    for (const layerId of Object.keys(COLOR_BY)) {
      expect(LAYER_STYLES[layerId], `${layerId} ไม่มีใน LAYER_STYLES`).toBeDefined();
    }
  });

  it('ชั้นป่าไม้แยกสีตามฟิลด์ที่เปิดเป็นสาธารณะจริง', () => {
    // ฟิลด์ที่ใช้แบ่งกลุ่มต้องอยู่ในรายการฟิลด์สาธารณะของชั้นนั้น ไม่งั้นไฟล์ที่
    // หน้าสาธารณะได้จะไม่มีฟิลด์นั้นเลย แล้วทุกรูปทรงตกไปอยู่กลุ่มเดียวกันหมด
    // (ตรวจกับค่าที่ /api/forest/layers คืนจริงเมื่อ 2026-08-28)
    expect(COLOR_BY['forest-stream']).toBe('class_th');
    expect(COLOR_BY['forest-reserve']).toBe('province');
  });
});

describe('buildColorGroups กับข้อมูลป่าไม้จริง', () => {
  it('หกชั้นคุณภาพของแหล่งน้ำได้สีคนละสี และอยู่ในหัวที่ตรวจแล้วทั้งหมด', () => {
    // ค่าตามที่มีอยู่จริงในไฟล์สาธารณะ — 6 ≤ 7 จึงไม่แตะส่วนหางที่รับประกันไม่ได้
    const groups = buildColorGroups([
      'พื้นที่แหล่งน้ำ',
      'แม่น้ำที่มีน้ำไหลตลอดปี',
      'แม่น้ำที่มีน้ำไหลไม่ตลอดปี',
      'อ่างเก็บน้ำ ฝาย',
      'ทะเลสาบ บ่อเลี้ยงปลา',
      'ลำธารที่มีน้ำไหลลงดิน',
    ]);
    expect(groups.size).toBe(6);
    expect(new Set(groups.values()).size).toBe(6);
    for (const color of groups.values()) expect(VERIFIED_HEAD).toContain(color);
  });

  it('สามจังหวัดของป่าสงวนใช้สามสีแรกของจาน', () => {
    const groups = buildColorGroups(['เชียงใหม่', 'ลำพูน', 'แม่ฮ่องสอน']);
    expect([...groups.values()]).toEqual(VERIFIED_HEAD.slice(0, 3));
  });

  it('เกินขนาดจานแล้ววนกลับมาใช้สีเดิม — คนอ่านต้องพึ่งรายการค่า ไม่ใช่สี', () => {
    // ข้อความเตือนใต้สวิตช์ "แยกสีตามกลุ่ม" ใน MapViewer พูดจากข้อเท็จจริงข้อนี้
    const many = Array.from({ length: GROUP_PALETTE.length + 1 }, (_, i) => `ค่า ${i}`);
    const groups = buildColorGroups(many);
    expect(groups.size).toBe(GROUP_PALETTE.length + 1);
    expect(new Set(groups.values()).size).toBe(GROUP_PALETTE.length);
  });
});
