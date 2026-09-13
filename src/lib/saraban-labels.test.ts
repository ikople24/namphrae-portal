// src/lib/saraban-labels.test.ts
import { describe, expect, it } from 'vitest';
import {
  EVENT_KIND_LABELS,
  fieldLabel,
  LEVEL_LABELS,
  REGISTER_LABELS,
  SEND_METHOD_LABELS,
  statusLabel,
} from '@/lib/saraban-labels';
import {
  SARABAN_EVENT_KINDS,
  SARABAN_LEVELS,
  SARABAN_REGISTERS,
  SEND_METHODS,
} from '@/types/saraban';

describe('statusLabel', () => {
  it('หนังสือรับใช้ป้ายตามต้นแบบ', () => {
    expect(statusLabel('in', 'pending')).toBe('รอเกษียน');
    expect(statusLabel('in', 'in-progress')).toBe('ดำเนินการ');
    expect(statusLabel('in', 'done')).toBe('เสร็จสิ้น');
  });

  it('ส่ง/เวียนใช้ รอส่ง/ส่งแล้ว — ต้นแบบไม่เคยนิยามว่าดำเนินการ/เสร็จสิ้นของหนังสือส่งคืออะไร', () => {
    expect(statusLabel('out', 'in-progress')).toBe('รอส่ง');
    expect(statusLabel('out', 'done')).toBe('ส่งแล้ว');
    expect(statusLabel('circular', 'in-progress')).toBe('รอส่ง');
    expect(statusLabel('circular', 'done')).toBe('ส่งแล้ว');
  });

  it('ยกเลิกเหมือนกันทุกทะเบียน · เกินกำหนดเกิดกับหนังสือรับเท่านั้น แต่ส่ง/เวียนมีป้ายสำรองให้ Record ครบ', () => {
    for (const register of SARABAN_REGISTERS) {
      expect(statusLabel(register, 'void')).toBe('ยกเลิก');
      expect(statusLabel(register, 'overdue')).toBe('เกินกำหนด');
    }
  });
});

describe('ป้ายครบทุกค่า', () => {
  it('ทะเบียน · ชั้นความเร็ว · วิธีส่ง', () => {
    for (const r of SARABAN_REGISTERS) expect(REGISTER_LABELS[r]).toBeTruthy();
    for (const l of SARABAN_LEVELS) expect(LEVEL_LABELS[l]).toBeTruthy();
    for (const m of SEND_METHODS) expect(SEND_METHOD_LABELS[m]).toBeTruthy();
  });

  it('ชื่อเหตุการณ์บนไทม์ไลน์ครบทุกชนิด', () => {
    for (const k of SARABAN_EVENT_KINDS) expect(EVENT_KIND_LABELS[k]).toBeTruthy();
  });
});

describe('fieldLabel — ชื่อช่องในประวัติการแก้ไข', () => {
  it('"จาก/ถึง" และ "เสนอถึง/เจ้าของเรื่อง" ขึ้นกับทะเบียน', () => {
    expect(fieldLabel('in', 'party')).toBe('จาก');
    expect(fieldLabel('out', 'party')).toBe('ถึง');
    expect(fieldLabel('in', 'holderUnitId')).toBe('เสนอถึง');
    expect(fieldLabel('circular', 'holderUnitId')).toBe('ส่วนราชการเจ้าของเรื่อง');
  });

  it('ช่องที่ไม่รู้จักคืนชื่อเดิม — รวมชื่อที่ชนกับ property ของ Object', () => {
    expect(fieldLabel('in', 'mystery')).toBe('mystery');
    expect(fieldLabel('in', 'constructor')).toBe('constructor');
  });
});
