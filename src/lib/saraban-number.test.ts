// src/lib/saraban-number.test.ts
import { describe, expect, it } from 'vitest';
import {
  bangkokDateOf,
  composeRef,
  fiscalYearOf,
  formatNo,
  nextNo,
} from '@/lib/saraban-number';

describe('fiscalYearOf — ปีงบเริ่ม 1 ต.ค.', () => {
  it('30 ก.ย. ยังเป็นปีงบเดิม', () => {
    expect(fiscalYearOf('2026-09-30')).toBe(2569);
  });

  it('1 ต.ค. ขึ้นปีงบใหม่', () => {
    expect(fiscalYearOf('2026-10-01')).toBe(2570);
  });

  it('ต้นปีปฏิทินอยู่ในปีงบที่เริ่มเมื่อ ต.ค. ปีก่อน', () => {
    expect(fiscalYearOf('2027-01-15')).toBe(2570);
  });

  it('31 ธ.ค. กับ 1 ม.ค. อยู่ปีงบเดียวกัน — ปีปฏิทินไม่ใช่ขอบ', () => {
    expect(fiscalYearOf('2026-12-31')).toBe(fiscalYearOf('2027-01-01'));
  });
});

describe('bangkokDateOf — วันที่ต้องคิดตามเวลากรุงเทพฯ ไม่ใช่ UTC', () => {
  it('00:30 ของ 1 ต.ค. ที่กรุงเทพฯ คือ 17:30 UTC ของ 30 ก.ย. — ต้องได้ 1 ต.ค.', () => {
    expect(bangkokDateOf(new Date('2026-09-30T17:30:00Z'))).toBe('2026-10-01');
  });

  it('ปีงบของเวลานั้นจึงเป็นปีใหม่ — ถ้าตัดวันที่จาก UTC จะได้เลขของปีงบเก่า', () => {
    const at = new Date('2026-09-30T17:30:00Z');
    expect(fiscalYearOf(bangkokDateOf(at))).toBe(2570);
    // บั๊กที่ฟังก์ชันนี้มีไว้กัน:
    expect(fiscalYearOf(at.toISOString().slice(0, 10))).toBe(2569);
  });

  it('23:59 ที่กรุงเทพฯ ยังเป็นวันเดิม', () => {
    expect(bangkokDateOf(new Date('2026-09-30T16:59:00Z'))).toBe('2026-09-30');
  });
});

describe('nextNo', () => {
  it('ปีที่ยังไม่มีหนังสือและไม่ได้ตั้งเลขเริ่มต้น → 1', () => {
    expect(nextNo(null, null)).toBe(1);
  });

  it('ปีที่ยังไม่มีหนังสือแต่ตั้งเลขเริ่มต้นไว้ → เลขเริ่มต้น', () => {
    expect(nextNo(null, 422)).toBe(422);
  });

  it('มีหนังสือแล้ว → max + 1 และเลขเริ่มต้นไม่มีผลอีก', () => {
    expect(nextNo(421, null)).toBe(422);
    expect(nextNo(421, 5)).toBe(422);
  });
});

describe('formatNo — เลขในทะเบียน', () => {
  it('รับ/ส่งเติมศูนย์ 4 หลัก', () => {
    expect(formatNo('in', 421)).toBe('0421');
    expect(formatNo('out', 7)).toBe('0007');
  });

  it('เวียนมี ว นำหน้า', () => {
    expect(formatNo('circular', 12)).toBe('ว 0012');
  });

  it('เกิน 9999 แสดงตามจริง ไม่ตัด', () => {
    expect(formatNo('in', 12345)).toBe('12345');
  });
});

describe('composeRef — "ที่" ไม่เติมศูนย์ ตามรูปแบบหนังสือราชการ', () => {
  it('หนังสือส่ง', () => {
    expect(composeRef('ชม 55201', 'out', 388)).toBe('ชม 55201/388');
  });

  it('หนังสือเวียน', () => {
    expect(composeRef('ชม 55201', 'circular', 12)).toBe('ชม 55201/ว 12');
  });
});
