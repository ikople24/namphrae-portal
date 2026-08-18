// Pure helpers for a Thai Buddhist-era calendar UI (ThaiDatePicker — ย้ายมาในรอบ 2).
export const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const;

// Sunday-first (index 0 = อาทิตย์, matches Date.getDay()).
export const THAI_WEEKDAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

/** "21 มกราคม 2564" — monthIdx is 0-based, yearBE is พ.ศ. */
export function formatThaiDate(yearBE: number, monthIdx: number, day: number): string {
  return `${day} ${THAI_MONTH_NAMES[monthIdx]} ${yearBE}`;
}

/** Weeks (rows of 7) for a BE month; leading/trailing blanks are null. Sunday-first. */
export function monthMatrix(yearBE: number, monthIdx: number): (number | null)[][] {
  const yearCE = yearBE - 543;
  const firstDow = new Date(yearCE, monthIdx, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(yearCE, monthIdx + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
