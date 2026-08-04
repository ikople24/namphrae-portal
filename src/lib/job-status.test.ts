import { describe, expect, it } from 'vitest';
import { canTransition } from '@/lib/job-status';
import type { JobStatus } from '@/types/portal';

const ALL: JobStatus[] = ['pending', 'approved', 'done', 'cancelled'];

// คู่ที่อนุญาต — นอกจากนี้ต้องถูกปฏิเสธทั้งหมด
const ALLOWED: Array<[JobStatus, JobStatus]> = [
  ['pending', 'approved'],
  ['pending', 'cancelled'],
  ['approved', 'done'],
  ['approved', 'cancelled'],
  ['approved', 'pending'], // ถอนอนุมัติเมื่อกดพลาด
  ['done', 'approved'], // เผลอกดปิดงาน
  ['cancelled', 'pending'], // กู้งานที่ยกเลิกผิด
];

describe('canTransition', () => {
  it.each(ALLOWED)('อนุญาต %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it('ปฏิเสธคู่อื่นทั้งหมด รวมถึงเปลี่ยนเป็นสถานะเดิม', () => {
    const denied: Array<[JobStatus, JobStatus]> = [];
    for (const from of ALL) {
      for (const to of ALL) {
        const ok = ALLOWED.some(([f, t]) => f === from && t === to);
        if (!ok) denied.push([from, to]);
      }
    }
    // 4x4 = 16 คู่ทั้งหมด อนุญาต 7 จึงต้องถูกปฏิเสธ 9
    expect(denied).toHaveLength(9);
    for (const [from, to] of denied) {
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(false);
    }
  });
});
