// src/lib/saraban-viewer.test.ts
import { describe, expect, it } from 'vitest';
import {
  addStamp,
  appendStroke,
  canAddStamp,
  clearInk,
  moveStamp,
  removeMark,
  round4,
  strokePoints,
  toUnit,
} from '@/lib/saraban-viewer';
import type { SarabanMark } from '@/types/saraban';

const at = { fileId: 'f1', page: 1 };
const rect = { left: 100, top: 50, width: 400, height: 800 };

describe('พิกัด', () => {
  it('round4 / toUnit ปัดทศนิยม 4 ตำแหน่ง และหนีบ 0–1', () => {
    expect(round4(0.123456)).toBe(0.1235);
    expect(toUnit(300, 450, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(toUnit(0, 2000, rect)).toEqual({ x: 0, y: 1 });
    expect(toUnit(100 + 400 / 3, 50, rect)).toEqual({ x: 0.3333, y: 0 });
  });
  it('strokePoints เป็นรูป polyline ของ SVG', () => {
    expect(strokePoints([0.1, 0.2, 0.3, 0.4])).toBe('0.1,0.2 0.3,0.4');
  });
});

describe('ร่างตรา', () => {
  it('addStamp วางกลางหน้า เอียงต่างกันเล็กน้อย', () => {
    const a = addStamp([], at, 'ack');
    expect(a[0]).toMatchObject({ type: 'stamp', fileId: 'f1', page: 1, stamp: 'ack', x: 0.5, y: 0.5 });
    const b = addStamp(a, at, 'approve');
    expect(b).toHaveLength(2);
    expect(Math.abs((b[1] as { rot: number }).rot)).toBeLessThanOrEqual(15);
    expect((b[1] as { rot: number }).rot).not.toBe((b[0] as { rot: number }).rot);
  });
  it('moveStamp / removeMark ไม่แก้ของเดิม', () => {
    const a = addStamp([], at, 'ack');
    const m = moveStamp(a, 0, { x: 0.1, y: 0.9 });
    expect(m[0]).toMatchObject({ x: 0.1, y: 0.9 });
    expect(a[0]).toMatchObject({ x: 0.5 });
    expect(removeMark(m, 0)).toEqual([]);
  });
  it('canAddStamp หยุดที่ 20', () => {
    let d: SarabanMark[] = [];
    for (let i = 0; i < 20; i++) d = addStamp(d, at, 'ack');
    expect(canAddStamp(d)).toBe(false);
  });
});

describe('ร่างลายมือ', () => {
  it('หน้าเดียวกันรวมเป็น InkMark เดียว · หน้าอื่นแยก', () => {
    let d = appendStroke([], at, [0.1, 0.1, 0.2, 0.2]);
    d = appendStroke(d, at, [0.3, 0.3, 0.4, 0.4]);
    d = appendStroke(d, { fileId: 'f1', page: 2 }, [0.1, 0.1, 0.2, 0.2]);
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ type: 'ink', page: 1, strokes: [[0.1, 0.1, 0.2, 0.2], [0.3, 0.3, 0.4, 0.4]] });
  });
  it('เส้นที่สั้นกว่า 2 จุดทิ้ง · ตัดให้อยู่ในงบ 5000 จุด', () => {
    expect(appendStroke([], at, [0.1, 0.1])).toEqual([]);
    const big = Array.from({ length: 4999 * 2 }, () => 0.5);
    const d = appendStroke(appendStroke([], at, big), at, [0.1, 0.1, 0.2, 0.2, 0.3, 0.3]);
    // เหลืองบ 1 จุด = เส้นใหม่สั้นกว่า 2 จุด → ทิ้ง
    expect((d[0] as { strokes: number[][] }).strokes).toHaveLength(1);
  });
  it('clearInk เอาลายมือออก ตราคงไว้', () => {
    const d = appendStroke(addStamp([], at, 'ack'), at, [0.1, 0.1, 0.2, 0.2]);
    expect(clearInk(d)).toHaveLength(1);
    expect(clearInk(d)[0].type).toBe('stamp');
  });
});
