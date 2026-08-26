// src/lib/iso-date.ts

// แปลงวันที่ที่เขียนแบบไทยให้เป็น ISO (YYYY-MM-DD)
//
// ทะเบียนฝายบนแผนที่ป่าไม้เขียนวันที่ไว้สี่แบบในคอลัมน์เดียวกัน — ISO ค.ศ.,
// พ.ศ.สองหลัก + เดือนย่อไทยเลขอารบิก, และแบบเดียวกันนั้นด้วยเลขไทย
//
// แปลงไม่ได้ = โยน error ไม่คืนค่าเดิม ผู้เรียกทุกคนเป็นสคริปต์นำเข้าที่ควรหยุดทั้งงาน
// ไม่ใช่ปล่อยแถวเสียผ่านไปแถวเดียว — ปีที่อ่านผิดบนทะเบียนราชการคือความเสียหายที่ไม่มี
// ใครสังเกตจนสายเกินไป

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** เลขไทย → เลขอารบิก อักขระอื่นปล่อยผ่านตามเดิม */
export function arabicDigits(s: string): string {
  return s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const THAI_SHORT = /^(\d{1,2})-(.+?)-(\d{2})$/;

export function toIsoDate(raw: string): string {
  const s = arabicDigits(String(raw ?? '').trim());

  if (ISO.test(s)) {
    assertRealDate(s, raw);
    return s;
  }

  const m = THAI_SHORT.exec(s);
  if (m) {
    const monthIndex = THAI_MONTHS.indexOf(m[2]);
    if (monthIndex !== -1) {
      // ปี พ.ศ. สองหลัก: 68 คือ 2568 ไม่ใช่ 68 หรือ 2068 — ข้อมูลชุดนี้ครอบ 2564–2568
      const be = 2500 + Number(m[3]);
      const iso = `${be - 543}-${pad(monthIndex + 1)}-${pad(Number(m[1]))}`;
      assertRealDate(iso, raw);
      return iso;
    }
  }

  throw new Error(`อ่านวันที่ไม่ออก: ${JSON.stringify(raw)}`);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ตรวจว่ามีวันนั้นอยู่จริง ไม่ใช่แค่รูปแบบถูก — 31-ก.พ.-68 ผ่าน regex ได้ แต่ Date
// จะเลื่อนไปเป็น 3 มี.ค. เงียบ ๆ ซึ่งแย่กว่าการโยน error เพราะไม่มีใครเห็น
function assertRealDate(iso: string, raw: string): void {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) {
    throw new Error(`วันที่ไม่มีอยู่จริง: ${JSON.stringify(raw)} → ${iso}`);
  }
}
