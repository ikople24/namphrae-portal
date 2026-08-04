import { describe, expect, it } from 'vitest';
import {
  buildMonthGrid,
  currentMonthInBangkok,
  parseMonth,
  shiftMonth,
  thaiMonthLabel,
  thaiShortDate,
  todayInBangkok,
} from '@/lib/calendar-grid';

describe('buildMonthGrid', () => {
  // ส.ค. 2026 ขึ้นต้นวันเสาร์ สัปดาห์เริ่มวันจันทร์จึงมีวันของเดือนก่อน 5 วัน
  it('เดือนที่ขึ้นต้นเสาร์ ได้ 6 สัปดาห์และเติมวันเดือนก่อนหน้า', () => {
    const weeks = buildMonthGrid(2026, 8);
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0]).toEqual({ date: '2026-07-27', inMonth: false });
    expect(weeks[0][5]).toEqual({ date: '2026-08-01', inMonth: true });
    expect(weeks[5][0]).toEqual({ date: '2026-08-31', inMonth: true });
    expect(weeks[5][1]).toEqual({ date: '2026-09-01', inMonth: false });
  });

  it('ทุกแถวมี 7 ช่องเสมอ', () => {
    for (const [y, m] of [
      [2026, 8],
      [2024, 2],
      [2026, 6],
      [2026, 12],
    ] as const) {
      for (const week of buildMonthGrid(y, m)) {
        expect(week).toHaveLength(7);
      }
    }
  });

  // มิ.ย. 2026 ขึ้นต้นวันจันทร์พอดี ไม่ต้องเติมวันข้างหน้า
  it('เดือนที่ขึ้นต้นวันจันทร์ ไม่มีวันเดือนก่อนนำหน้า', () => {
    const weeks = buildMonthGrid(2026, 6);
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toEqual({ date: '2026-06-01', inMonth: true });
  });

  it('ก.พ. ปีอธิกสุรทินมีวันที่ 29 และอยู่ในเดือน', () => {
    const cells = buildMonthGrid(2024, 2).flat();
    expect(cells.find((c) => c.date === '2024-02-29')).toEqual({
      date: '2024-02-29',
      inMonth: true,
    });
    expect(cells.some((c) => c.date === '2024-03-01' && c.inMonth)).toBe(false);
  });

  it('สัปดาห์คาบเกี่ยวข้ามปีถูกทำเครื่องหมายว่านอกเดือน', () => {
    const weeks = buildMonthGrid(2026, 12);
    expect(weeks[4][4]).toEqual({ date: '2027-01-01', inMonth: false });
  });

  it('วันที่ในแต่ละสัปดาห์เรียงต่อเนื่องไม่ข้ามไม่ซ้ำ', () => {
    const dates = buildMonthGrid(2026, 8).flat().map((c) => c.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
  });

  // ก.พ. 2027 ไม่ใช่ปีอธิกสุรทิน (28 วัน) และขึ้นต้นวันจันทร์พอดี — กรณีเดียวที่
  // ได้ 4 สัปดาห์ล้วน ไม่มีวันของเดือนก่อนหรือเดือนถัดไปแทรกเลย
  it('เดือนที่ขึ้นต้นจันทร์และมี 28 วันพอดี ได้ 4 สัปดาห์ล้วน ๆ ไม่เติมวันข้างเคียง', () => {
    const weeks = buildMonthGrid(2027, 2);
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((c) => c.inMonth)).toBe(true);
    expect(weeks[0][0]).toEqual({ date: '2027-02-01', inMonth: true });
    expect(weeks[3][6]).toEqual({ date: '2027-02-28', inMonth: true });
  });
});

describe('thaiMonthLabel', () => {
  it('แปลงเป็นชื่อเดือนไทยและ พ.ศ.', () => {
    expect(thaiMonthLabel(2026, 8)).toBe('สิงหาคม 2569');
    expect(thaiMonthLabel(2026, 1)).toBe('มกราคม 2569');
    expect(thaiMonthLabel(2026, 12)).toBe('ธันวาคม 2569');
  });
});

describe('thaiShortDate', () => {
  it('ย่อวันที่เป็นรูปแบบที่ใช้ในข้อความ LINE', () => {
    expect(thaiShortDate('2026-08-05')).toBe('5 ส.ค. 69');
    expect(thaiShortDate('2026-12-31')).toBe('31 ธ.ค. 69');
    expect(thaiShortDate('2027-01-01')).toBe('1 ม.ค. 70');
  });

  // ค.ศ. 2056→2057 คือ พ.ศ. 2599→2600 — เลขท้ายสองหลักไหลจาก 99 กลับไป 00
  it('ข้ามศตวรรษ พ.ศ. (2599 → 2600) เลขสองหลักท้ายวนกลับเป็น 00', () => {
    expect(thaiShortDate('2056-12-31')).toBe('31 ธ.ค. 99');
    expect(thaiShortDate('2057-01-01')).toBe('1 ม.ค. 00');
  });
});

describe('shiftMonth', () => {
  it('เลื่อนข้ามปีได้ทั้งสองทาง', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-08', 0)).toBe('2026-08');
    expect(shiftMonth('2026-08', 5)).toBe('2027-01');
  });

  it('เลื่อนย้อนหลังข้ามหลายปีด้วย delta ติดลบมาก ๆ ยังคำนวณถูก', () => {
    expect(shiftMonth('2026-08', -30)).toBe('2024-02');
    expect(shiftMonth('2020-01', -25)).toBe('2017-12');
  });

  it('เลื่อนไปข้างหน้าข้ามหลายปีด้วย delta บวกมาก ๆ ยังคำนวณถูก', () => {
    expect(shiftMonth('2020-01', 37)).toBe('2023-02');
  });
});

describe('parseMonth', () => {
  it('แยกปีกับเดือนจากสตริงที่ถูกต้อง', () => {
    expect(parseMonth('2026-08')).toEqual({ year: 2026, month: 8 });
  });

  it('คืน null เมื่อรูปแบบผิด', () => {
    for (const bad of ['2026-8', '2026', 'x', '2026-13', '2026-00', '']) {
      expect(parseMonth(bad), bad).toBeNull();
    }
  });

  // ปีเกิน 4 หลักไม่ควรผ่าน regex ที่ยึด ^\d{4}-\d{2}$ อยู่แล้ว — เทสต์นี้ยืนยันไว้
  it('ปี 5 หลักไม่ผ่าน', () => {
    expect(parseMonth('20260-01')).toBeNull();
  });
});

describe('todayInBangkok / currentMonthInBangkok', () => {
  // ค่าขึ้นกับเวลาจริง จึงตรวจได้แค่รูปแบบ
  it('ให้รูปแบบ YYYY-MM-DD และ YYYY-MM ที่สอดคล้องกัน', () => {
    const today = todayInBangkok();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(currentMonthInBangkok()).toBe(today.slice(0, 7));
  });
});
