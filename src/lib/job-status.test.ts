import { describe, expect, it } from 'vitest';
import { canTransition, nextStatuses } from '@/lib/job-status';
import { JOB_STATUSES, type JobStatus } from '@/types/portal';

// ผูกกับ JOB_STATUSES จริง ไม่ใช่ลิสต์ที่เขียนมือ — เพิ่มสถานะใหม่แล้วลูปนี้
// ต้องขยายตามเอง ไม่งั้นเทสต์เขียวทั้งที่คู่ใหม่ยังไม่เคยถูกตรวจเลย
const ALL: readonly JobStatus[] = JOB_STATUSES;

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
    // คู่ทั้งหมดคือ ALL x ALL อนุญาตตาม ALLOWED จึงต้องถูกปฏิเสธที่เหลือ
    expect(denied).toHaveLength(ALL.length * ALL.length - ALLOWED.length);
    for (const [from, to] of denied) {
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(false);
    }
  });

  it('nextStatuses ตรงกับ canTransition ทุกสถานะ — ปุ่มบนหน้าจอกับกฎ 409 ของ API จะแยกกันไม่ได้', () => {
    for (const from of ALL) {
      const next = nextStatuses(from);
      expect([...next].sort()).toEqual(
        ALL.filter((to) => canTransition(from, to)).sort()
      );
    }
  });

  it('สถานะนอกตาราง (ข้อมูลเสียจาก storage ที่ไม่ผ่าน validate) ถูกปฏิเสธ ไม่ throw', () => {
    const bogus = 'deferred' as JobStatus;
    expect(canTransition(bogus, 'pending')).toBe(false);
    expect(canTransition('pending', bogus)).toBe(false);
    expect(nextStatuses(bogus)).toEqual([]);
  });
});
