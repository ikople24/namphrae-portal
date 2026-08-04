import { describe, expect, it } from 'vitest';
import { bySchedule, matches } from '@/lib/jobs-store';
import type { CalendarJob } from '@/types/portal';

// เทสต์นี้ครอบเฉพาะ matches() และ bySchedule() — ฟังก์ชันบริสุทธิ์ล้วน ๆ
// ไม่แตะ DB/filesystem เลย จุดที่ต้องระวังคือ matches() พูดกฎกรองเดียวกับ
// query object ของ Mongo ใน listJobs() แต่เขียนแยกกันคนละที่ (ดูคอมเมนต์บน
// matches() ใน jobs-store.ts) เทสต์เหล่านี้ตรึงพฤติกรรมของ matches() ไว้เป็น
// สเปกอ้างอิง ถ้า query ฝั่ง Mongo เพี้ยนไปจากนี้ ต้องจับได้จากการรีวิวโค้ด
// ทั้งสองจุดคู่กัน เพราะเทสต์ mock DB จริงไม่ได้ (ห้ามใช้ test container)

function makeJob(overrides: Partial<CalendarJob> = {}): CalendarJob {
  return {
    id: 'job-1',
    kind: 'ems',
    status: 'pending',
    date: '2026-08-15',
    time: '09:00',
    title: 'ผู้ป่วยทดสอบ',
    createdAt: '2026-08-01T00:00:00.000Z',
    createdBy: 'tester@example.com',
    ...overrides,
  };
}

describe('matches', () => {
  it('filter ว่างเปล่า — ผ่านทุกงานไม่ว่าสถานะหรือวันที่ใด', () => {
    expect(matches(makeJob(), {})).toBe(true);
    expect(
      matches(makeJob({ status: 'cancelled', date: '2020-01-01' }), {})
    ).toBe(true);
  });

  describe('month filter', () => {
    it('วันแรกของเดือนตรงกับ filter เดือนนั้น', () => {
      const job = makeJob({ date: '2026-08-01' });
      expect(matches(job, { month: '2026-08' })).toBe(true);
    });

    it('วันสุดท้ายของเดือน (31) ตรงกับ filter เดือนนั้น', () => {
      const job = makeJob({ date: '2026-08-31' });
      expect(matches(job, { month: '2026-08' })).toBe(true);
    });

    it('วันแรกของเดือนถัดไปไม่ตรงกับ filter เดือนก่อนหน้า — กันความเพี้ยนข้ามเดือน', () => {
      const job = makeJob({ date: '2026-09-01' });
      expect(matches(job, { month: '2026-08' })).toBe(false);
    });

    it('เดือนเดียวกันแต่คนละปีไม่ตรงกัน', () => {
      const job = makeJob({ date: '2025-08-15' });
      expect(matches(job, { month: '2026-08' })).toBe(false);
    });
  });

  describe('status filter', () => {
    it('สถานะตรงกัน — ผ่าน', () => {
      const job = makeJob({ status: 'approved' });
      expect(matches(job, { status: 'approved' })).toBe(true);
    });

    it('สถานะไม่ตรงกัน — ไม่ผ่าน', () => {
      const job = makeJob({ status: 'approved' });
      expect(matches(job, { status: 'pending' })).toBe(false);
    });
  });

  describe('month + status ผสมกัน', () => {
    const job = makeJob({ date: '2026-08-15', status: 'approved' });

    it('ผ่านทั้งสองเงื่อนไข — ผ่าน', () => {
      expect(matches(job, { month: '2026-08', status: 'approved' })).toBe(
        true
      );
    });

    it('เดือนตรงแต่สถานะไม่ตรง — ไม่ผ่าน', () => {
      expect(matches(job, { month: '2026-08', status: 'pending' })).toBe(
        false
      );
    });

    it('สถานะตรงแต่เดือนไม่ตรง — ไม่ผ่าน', () => {
      expect(matches(job, { month: '2026-09', status: 'approved' })).toBe(
        false
      );
    });
  });
});

describe('bySchedule', () => {
  it('วันที่ต่างกัน — เรียงตามวันที่ก่อนเวลา', () => {
    const early = makeJob({ id: 'a', date: '2026-08-01', time: '23:00' });
    const late = makeJob({ id: 'b', date: '2026-08-02', time: '00:00' });
    expect(bySchedule(early, late)).toBeLessThan(0);
    expect(bySchedule(late, early)).toBeGreaterThan(0);
  });

  it('วันที่เดียวกัน — เรียงตามเวลา', () => {
    const morning = makeJob({ id: 'a', date: '2026-08-01', time: '08:00' });
    const evening = makeJob({ id: 'b', date: '2026-08-01', time: '18:00' });
    expect(bySchedule(morning, evening)).toBeLessThan(0);
    expect(bySchedule(evening, morning)).toBeGreaterThan(0);
  });

  it('วัน+เวลาเท่ากันทุกด้าน — คืนค่า 0', () => {
    const a = makeJob({ id: 'a', date: '2026-08-01', time: '08:00' });
    const b = makeJob({ id: 'b', date: '2026-08-01', time: '08:00' });
    expect(bySchedule(a, b)).toBe(0);
  });

  it('เรียง list ที่สลับลำดับแบบสมจริงได้ ascending ถูกต้องและเสถียรเมื่อวัน+เวลาเท่ากัน', () => {
    const jobs = [
      makeJob({ id: '5', date: '2026-08-20', time: '10:00' }),
      makeJob({ id: '1', date: '2026-08-05', time: '09:00' }),
      makeJob({ id: '4', date: '2026-08-05', time: '23:30' }),
      makeJob({ id: '2', date: '2026-08-05', time: '09:00' }), // เวลาเดียวกับ '1' — มาทีหลังใน input
      makeJob({ id: '3', date: '2026-08-05', time: '14:00' }),
      makeJob({ id: '6', date: '2026-09-01', time: '00:00' }),
    ];
    const sorted = [...jobs].sort(bySchedule);
    expect(sorted.map((j) => j.id)).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});

// ---- สมมติฐานของ -31 upper bound ที่ query ฝั่ง Mongo ใน listJobs() พึ่งพา ----
//
// `query.date = { $gte: `${month}-01`, $lte: `${month}-31` }` ใช้ได้เพราะ
// สตริง 'YYYY-MM-DD' เทียบแบบ lexicographic แล้วให้ผลตรงกับการเทียบวันที่จริง
// ทุกเดือน (แม้เดือนนั้นมีแค่ 28/29/30 วัน) เทสต์นี้ตรึงสมมติฐานนั้นไว้
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month เป็น 1-indexed
}

describe('สมมติฐาน -31 upper bound (ที่ query ของ Mongo ใน listJobs พึ่งพา)', () => {
  // ครอบเดือน 31 วัน, 30 วัน, ก.พ.ปีปกติ (28 วัน) และ ก.พ.ปีอธิกสุรทิน (29 วัน)
  const months = ['2026-01', '2026-04', '2026-02', '2024-02'];

  it.each(months)(
    'ทุกวันจริงในเดือน %s อยู่ระหว่าง `${month}-01` ถึง `${month}-31` เมื่อเทียบแบบสตริง',
    (month) => {
      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr);
      const mon = Number(monthStr);
      const lower = `${month}-01`;
      const upper = `${month}-31`;
      const total = daysInMonth(year, mon);

      for (let d = 1; d <= total; d++) {
        const date = `${month}-${String(d).padStart(2, '0')}`;
        expect(date >= lower).toBe(true);
        expect(date <= upper).toBe(true);
      }
    }
  );
});
