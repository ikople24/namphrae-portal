// src/lib/saraban-mark.test.ts
import { describe, expect, it } from 'vitest';
import { STAMP_COLORS, STAMP_LABELS } from '@/lib/saraban-labels';
import { errorMessage } from '@/lib/saraban-view';
import { STAMP_KINDS } from '@/types/saraban';
import {
  hasSelfOnlyMarks,
  inkPageCount,
  inkPointCount,
  isFileReferenced,
  marksOn,
  maxPageOf,
  validateMarks,
} from '@/lib/saraban-mark';
import type { SarabanEvent, SarabanFile, SarabanMark } from '@/types/saraban';

describe('ป้ายและสีตรา', () => {
  it('ครบทุกชนิดตรา ตามต้นแบบ', () => {
    expect(STAMP_KINDS.map((k) => STAMP_LABELS[k])).toEqual(['ทราบ', 'ดำเนินการ', 'แจ้งเวียน', 'เห็นชอบ']);
    expect(STAMP_KINDS.map((k) => STAMP_COLORS[k])).toEqual(['#1E4D8C', '#1C7C54', '#8A5A00', '#5B3A8C']);
  });

  it('มีข้อความของ error ใหม่', () => {
    for (const code of ['self_only', 'invalid_mark', 'file_referenced']) {
      expect(errorMessage(code)).not.toBe('เกิดข้อผิดพลาด ลองอีกครั้ง');
    }
  });
});

const file = (over: Partial<SarabanFile>): SarabanFile => ({
  id: 'f1', key: 'saraban/f1.pdf', name: 'a.pdf', format: 'pdf', bytes: 10, pages: 3,
  uploadedAt: '2026-11-05T00:00:00.000Z', uploadedBy: 'dev-open', ...over,
});
const stamp = (over: Partial<Extract<SarabanMark, { type: 'stamp' }>> = {}): SarabanMark => ({
  type: 'stamp', fileId: 'f1', page: 1, stamp: 'ack', x: 0.5, y: 0.5, rot: 0, ...over,
});
const ink = (over: Partial<Extract<SarabanMark, { type: 'ink' }>> = {}): SarabanMark => ({
  type: 'ink', fileId: 'f1', page: 1, strokes: [[0.1, 0.1, 0.2, 0.2]], ...over,
});
const ev = (over: Partial<SarabanEvent>): SarabanEvent => ({
  id: 'e1', at: '2026-11-05T00:00:00.000Z', by: 'u', byName: 'ก', kind: 'annotated', note: 'x', ...over,
});

describe('maxPageOf', () => {
  it('PDF ใช้จำนวนหน้าจริง · อ่านไม่ได้ (0) ยอม 500 · รูป = 1', () => {
    expect(maxPageOf(file({ pages: 3 }))).toBe(3);
    expect(maxPageOf(file({ pages: 0 }))).toBe(500);
    expect(maxPageOf(file({ format: 'jpg', pages: 1 }))).toBe(1);
    expect(maxPageOf(file({ format: 'png', pages: 0 }))).toBe(1);
  });
});

describe('validateMarks', () => {
  const doc = { files: [file({}), file({ id: 'img', format: 'png', pages: 1 })] };
  it('ว่าง/ถูกต้อง ผ่าน', () => {
    expect(validateMarks(doc, [])).toEqual({ ok: true });
    expect(validateMarks(doc, [stamp({ page: 3 }), ink({ fileId: 'img' })])).toEqual({ ok: true });
  });
  it('ไฟล์ไม่อยู่ในหนังสือ → invalid_mark พร้อม index', () => {
    expect(validateMarks(doc, [stamp(), stamp({ fileId: 'other' })])).toEqual({ ok: false, error: 'invalid_mark', index: 1 });
  });
  it('หน้าเกิน → invalid_mark', () => {
    expect(validateMarks(doc, [stamp({ page: 4 })])).toEqual({ ok: false, error: 'invalid_mark', index: 0 });
    expect(validateMarks(doc, [ink({ fileId: 'img', page: 2 })])).toEqual({ ok: false, error: 'invalid_mark', index: 0 });
  });
});

describe('isFileReferenced', () => {
  it('อ้างด้วย mark หรือ signature', () => {
    expect(isFileReferenced({ events: [ev({})] }, 'f1')).toBe(false);
    expect(isFileReferenced({ events: [ev({ marks: [stamp()] })] }, 'f1')).toBe(true);
    expect(isFileReferenced({ events: [ev({ marks: [stamp()] })] }, 'f2')).toBe(false);
    expect(
      isFileReferenced({ events: [ev({ signature: { ip: '', files: [{ fileId: 'f2', name: 'b', sha256: 'x' }] } })] }, 'f2')
    ).toBe(true);
  });
});

describe('นับลายมือ / self-only / marksOn', () => {
  it('นับจุด (คู่ x,y) และหน้า', () => {
    const ms = [ink({ strokes: [[0, 0, 1, 1], [0, 0, 0.5, 0.5, 1, 1]] }), ink({ page: 2 }), stamp()];
    expect(inkPointCount(ms)).toBe(7);
    expect(inkPageCount(ms)).toBe(2);
  });
  it('ลายมือหรือ sign = ต้องเป็นเจ้าตัว', () => {
    expect(hasSelfOnlyMarks({ marks: [stamp()], sign: false })).toBe(false);
    expect(hasSelfOnlyMarks({ marks: [ink()], sign: false })).toBe(true);
    expect(hasSelfOnlyMarks({ marks: [], sign: true })).toBe(true);
  });
  it('marksOn เอาเฉพาะ annotated ของไฟล์/หน้านั้น', () => {
    const events = [ev({ marks: [stamp(), stamp({ page: 2 })] }), ev({ kind: 'edited', marks: [stamp()] }), ev({ marks: [ink({ fileId: 'f2' })] })];
    expect(marksOn(events, 'f1', 1)).toHaveLength(1);
    expect(marksOn(events, 'f2', 1)).toHaveLength(1);
  });
});
