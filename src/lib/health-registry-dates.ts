// normalize วันที่จากทะเบียน xlsx — มีทั้งข้อความไทย, ตัวเลข D/M/YYYY (พ.ศ.) แบบ slash,
// Excel serial ค.ศ. ปกติ, serial ที่พิมพ์ปี พ.ศ. ลงช่องปี ค.ศ. และ serial ปี 19xx จากการพิมพ์ปี 2 หลัก
import { parseThaiDate } from '@/lib/thai-date';

const MS_PER_DAY = 86400000;
// Excel epoch 1899-12-30 (ชดเชย leap-year bug ปี 1900 ของ Excel แล้ว)
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

/** แปลง Excel serial → Date UTC เที่ยงคืน (ตัดเศษเวลาในวัน) */
export function excelSerialToUTC(serial: number): Date {
  return new Date(EXCEL_EPOCH_UTC + Math.floor(serial) * MS_PER_DAY);
}

function shiftYears(d: Date, years: number): Date | null {
  const s = new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate()));
  // 29 ก.พ. เลื่อนไปปีที่ไม่ใช่ leap year → ล้นเป็น 1 มี.ค. — ถือว่าเพี้ยน ให้ผู้เรียกตีเป็น null
  return s.getUTCMonth() === d.getUTCMonth() ? s : null;
}

/** ปี ค.ศ. ของผลลัพธ์ต้องอยู่ในช่วงทะเบียน ± 1 ปี — กันวันเพี้ยนหลุดข้ามทะเบียน */
function inWindow(d: Date, yearBE: number): boolean {
  const ce = d.getUTCFullYear();
  const target = yearBE - 543;
  return ce >= target - 1 && ce <= target + 1;
}

/**
 * แปลงค่าเซลล์วันที่ (string ไทย พ.ศ. หรือ Excel serial) เป็น Date UTC
 * คืน null ถ้า parse ไม่ได้ หรือผลอยู่นอกช่วง yearBE ± 1 ปี
 * รับเฉพาะเซลล์ที่เป็น string หรือ number เท่านั้น (ถ้า xlsx parser เปิด cellDates:true
 * ในอนาคตแล้วส่ง native Date object เข้ามา ฟังก์ชันนี้จะคืน null เสมอ — ไม่รองรับ)
 */
export function normalizeRegistryDate(value: unknown, yearBE: number): Date | null {
  if (typeof value === 'string') {
    const slash = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
      const [, ddStr, mmStr, yyStr] = slash;
      const dd = Number(ddStr);
      const mm = Number(mmStr);
      const yy = Number(yyStr);
      const ce = yy >= 2400 && yy <= 2700 ? yy - 543 : yy; // ปี พ.ศ. → ค.ศ., เผื่อกรณีพิมพ์ ค.ศ. มาตรง ๆ
      const d = new Date(Date.UTC(ce, mm - 1, dd));
      // กันวันเกินจริง เช่น 31/02 (Date จะ overflow ไปเดือนถัดไป) — idiom เดียวกับ parseThaiDate
      if (d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null;
      return inWindow(d, yearBE) ? d : null;
    }
    const d = parseThaiDate(value);
    return d && inWindow(d, yearBE) ? d : null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  let d: Date | null = excelSerialToUTC(value);
  const y = d.getUTCFullYear();
  if (y >= 2400) d = shiftYears(d, -543); // พิมพ์ปี พ.ศ. ลงช่องปี ค.ศ.
  else if (y >= 1950 && y < 2000) d = shiftYears(d, 57); // "68" → 1968 → พ.ศ. 2568
  return d && inWindow(d, yearBE) ? d : null;
}
