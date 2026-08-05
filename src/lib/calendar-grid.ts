// ตารางปฏิทินและการจัดรูปแบบวันที่ไทย ทั้งหมดเป็นฟังก์ชันบริสุทธิ์ ไม่มี dependency
//
// คำนวณด้วย UTC ล้วน (Date.UTC / getUTC*) แม้จะเป็นปฏิทินไทย เพราะที่นี่ใช้ Date
// เป็นแค่เครื่องคิดเลขวันที่ ไม่ใช่เวลาจริง — การใช้ UTC ตัดปัญหา DST และ
// timezone ของเครื่องที่รันออกไปทั้งหมด ส่วนเวลาไทยจริง ๆ อยู่ในสตริง date/time

export type GridCell = { date: string; inMonth: boolean };

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

// ชื่อวันแบบสัปดาห์เริ่มวันจันทร์ ให้ตรงกับลำดับช่องใน buildMonthGrid
// ปฏิทินไทยตามธรรมเนียมทั่วไปเริ่มวันอาทิตย์ (อา จ อ พ พฤ ศ ส) — ที่นี่เริ่ม
// จันทร์เพราะสืบทอดมาจาก wkst=1 ของ Google Calendar embed เดิม เป็นการจงใจ
// เลือกให้ตรงกับ buildMonthGrid ไม่ใช่พลาด ถ้าจะแก้ให้เริ่มอาทิตย์ต้องแก้
// buildMonthGrid คู่กันด้วยเสมอ (มีเทสต์ผูกไว้ด้านล่าง)
export const THAI_DOW = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

const MONTH_RE = /^\d{4}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * ตารางเดือนเป็นสัปดาห์ ๆ ละ 7 ช่อง เริ่มวันจันทร์ตาม wkst=1 ของปฏิทินเดิม
 * เติมวันของเดือนข้างเคียงให้เต็มแถว (inMonth: false)
 *
 * @param month 1-12
 */
export function buildMonthGrid(year: number, month: number): GridCell[][] {
  // getUTCDay(): 0=อา..6=ส → แปลงเป็นออฟเซ็ตแบบจันทร์นำ 0=จ..6=อา
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cursor = new Date(Date.UTC(year, month - 1, 1 - lead));
  const weeks: GridCell[][] = [];

  // วนต่อตราบที่ต้นสัปดาห์ถัดไปยังอยู่ในเดือนเป้าหมาย — ได้ 4-6 แถวตามจริง
  // โดยไม่ต้องฮาร์ดโค้ด 6 แถวแล้วมาตัดทีหลัง
  do {
    const week: GridCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        date: ymd(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth() + 1,
          cursor.getUTCDate()
        ),
        inMonth:
          cursor.getUTCMonth() === month - 1 &&
          cursor.getUTCFullYear() === year,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (
    cursor.getUTCMonth() === month - 1 &&
    cursor.getUTCFullYear() === year
  );

  return weeks;
}

export function thaiMonthLabel(year: number, month: number): string {
  return `${THAI_MONTHS[month - 1]} ${year + 543}`;
}

/**
 * '2026-08-05' → '5 ส.ค. 69' (พ.ศ. สองหลักท้าย)
 *
 * กัน undefined/null ด้วย `?? ''` เพราะฟังก์ชันนี้ยังถูกเรียกกับข้อมูลดิบจาก
 * Mongo ที่ไม่ผ่าน Zod (ตารางแอดมิน Task 13) — พังแค่แถวเดียวด้วยข้อความ
 * เพี้ยนยังดีกว่า throw จน error boundary ดึงทั้งหน้าตารางหายไปด้วย
 */
export function thaiShortDate(date: string): string {
  const [year, month, day] = (date ?? '').split('-').map(Number);
  const be = (year + 543) % 100;
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${pad(be)}`;
}

/** '2026-12' + 1 → '2027-01' */
export function shiftMonth(month: string, delta: number): string {
  const parsed = parseMonth(month);
  if (!parsed) return month;
  const total = parsed.year * 12 + (parsed.month - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export function parseMonth(
  month: string
): { year: number; month: number } | null {
  if (!MONTH_RE.test(month)) return null;
  const [year, m] = month.split('-').map(Number);
  if (m < 1 || m > 12) return null;
  return { year, month: m };
}

/** วันนี้ตามเวลาไทย — 'en-CA' ให้รูปแบบ YYYY-MM-DD พอดี */
export function todayInBangkok(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function currentMonthInBangkok(): string {
  return todayInBangkok().slice(0, 7);
}

/**
 * '2026-08-31' → '2026-09-01' — เลขคณิตบน Date.UTC ล้วน ไม่แตะ local timezone
 * ของเครื่อง (server อาจไม่ได้ตั้ง TZ เป็นไทย) Date.UTC จัดการข้ามเดือน/ปี/
 * อธิกสุรทินให้เอง
 *
 * ไม่ validate input เพราะผู้เรียกเดียวในโค้ดเบสคือ tomorrowInBangkok() ซึ่งส่ง
 * ค่าจาก todayInBangkok() เสมอ (รูปแบบ YYYY-MM-DD ที่การันตีถูกต้อง) — อย่าส่ง
 * ค่าจาก user/ภายนอกเข้ามาโดยไม่ validate ที่ขอบก่อน ไม่งั้นได้ 'NaN-NaN-NaN' เงียบ ๆ
 */
export function nextDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return ymd(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/** วันพรุ่งนี้ตามเวลาไทย — ใช้ตัดสินว่า digest 17:00 ต้องสรุปงานของวันไหน */
export function tomorrowInBangkok(): string {
  return nextDate(todayInBangkok());
}
