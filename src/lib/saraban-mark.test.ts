// src/lib/saraban-mark.test.ts
import { describe, expect, it } from 'vitest';
import { STAMP_COLORS, STAMP_LABELS } from '@/lib/saraban-labels';
import { errorMessage } from '@/lib/saraban-view';
import { STAMP_KINDS } from '@/types/saraban';

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
