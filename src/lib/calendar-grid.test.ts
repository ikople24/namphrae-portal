import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildMonthGrid,
  currentMonthInBangkok,
  nextDate,
  parseMonth,
  shiftMonth,
  thaiMonthLabel,
  thaiShortDate,
  THAI_DOW,
  todayInBangkok,
  tomorrowInBangkok,
} from '@/lib/calendar-grid';

afterEach(() => {
  vi.useRealTimers();
});

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

  // THAI_DOW เริ่มจันทร์ตาม wkst=1 เดิม ไม่ใช่ธรรมเนียมปฏิทินไทยทั่วไปที่เริ่ม
  // อาทิตย์ — ผูกเทสต์นี้กับ buildMonthGrid โดยตรง ถ้าใครแก้ THAI_DOW ให้เริ่ม
  // อาทิตย์โดยไม่แก้ buildMonthGrid คู่กัน เทสต์นี้ต้องแดง
  it('THAI_DOW เรียงตรงกับคอลัมน์ของ buildMonthGrid — 1 ส.ค. 2026 เป็นวันเสาร์', () => {
    const week0 = buildMonthGrid(2026, 8)[0];
    const col = week0.findIndex((c) => c.date === '2026-08-01');
    expect(THAI_DOW[col]).toBe('ส');
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

  // ตารางแอดมิน (Task 13) เรียกฟังก์ชันนี้กับข้อมูลดิบจาก Mongo ที่ไม่ผ่าน
  // Zod — undefined/null ต้องไม่ throw จนพังทั้งตาราง ข้อความเพี้ยนได้แต่ต้อง
  // ไม่ล้ม
  it('ไม่ throw เมื่อค่าที่ได้เป็น undefined/null (ข้อมูลดิบที่ยังไม่ผ่าน Zod)', () => {
    expect(() => thaiShortDate(undefined as unknown as string)).not.toThrow();
    expect(typeof thaiShortDate(undefined as unknown as string)).toBe('string');
    expect(() => thaiShortDate(null as unknown as string)).not.toThrow();
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

  // ยึดเวลากรุงเทพจริง ไม่ใช่ UTC — 17:30 UTC คือ 00:30 ของวันถัดไปที่กรุงเทพ
  // (UTC+7) เทสต์รูปแบบด้านบนผ่านได้แม้สลับเป็น UTC เงียบ ๆ เทสต์นี้จับกรณีนั้น
  it('ยึดเวลาไทยจริง ไม่ใช่ UTC — 17:30 UTC คือเช้าวันถัดไปที่กรุงเทพ', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T17:30:00Z'));
    expect(todayInBangkok()).toBe('2026-08-05');
  });

  it('ข้ามเดือนตามเวลาไทย ไม่ใช่ UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T17:30:00Z'));
    expect(currentMonthInBangkok()).toBe('2026-08');
  });
});

describe('nextDate — บวกหนึ่งวันบน UTC ล้วน ไม่ผ่าน timezone ของเครื่อง', () => {
  it('กลางเดือน', () => {
    expect(nextDate('2026-08-05')).toBe('2026-08-06');
  });

  it('ข้ามสิ้นเดือน', () => {
    expect(nextDate('2026-08-31')).toBe('2026-09-01');
  });

  it('ข้ามสิ้นปี', () => {
    expect(nextDate('2026-12-31')).toBe('2027-01-01');
  });

  it('ปีอธิกสุรทิน — 28 ก.พ. ไป 29 ก.พ.', () => {
    expect(nextDate('2028-02-28')).toBe('2028-02-29');
  });

  it('ปีปกติ — 28 ก.พ. ไป 1 มี.ค.', () => {
    expect(nextDate('2026-02-28')).toBe('2026-03-01');
  });
});

describe('tomorrowInBangkok', () => {
  // ยึดเวลาไทยจริง ไม่ใช่ UTC — 17:30 UTC ของ 4 ส.ค. คือ 00:30 ของ 5 ส.ค. ที่
  // กรุงเทพแล้ว พรุ่งนี้จึงต้องเป็น 6 ส.ค. ถ้า logic เผลอคำนวณจาก UTC (ยังเป็น
  // 4 ส.ค.) จะได้ '2026-08-05' ผิด — เทสต์นี้จับกรณีนั้นได้จริง
  it('ยึดเวลาไทยจริง ไม่ใช่ UTC — 17:30 UTC คือพรุ่งนี้ของกรุงเทพไปอีกวัน', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T17:30:00Z'));
    expect(tomorrowInBangkok()).toBe('2026-08-06');
  });
});
