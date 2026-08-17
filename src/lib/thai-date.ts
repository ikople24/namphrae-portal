const THAI_MONTHS: Record<string, number> = {
  'มกราคม': 0, 'กุมภาพันธ์': 1, 'มีนาคม': 2, 'เมษายน': 3,
  'พฤษภาคม': 4, 'มิถุนายน': 5, 'กรกฎาคม': 6, 'สิงหาคม': 7,
  'กันยายน': 8, 'ตุลาคม': 9, 'พฤศจิกายน': 10, 'ธันวาคม': 11,
};
// เดือนแบบย่อ (พบในชีตน้ำท่วม เช่น "16 ต.ค. 2566")
const THAI_MONTHS_ABBR: Record<string, number> = {
  'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3,
  'พ.ค.': 4, 'มิ.ย.': 5, 'ก.ค.': 6, 'ส.ค.': 7,
  'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11,
};

/**
 * แปลงวันที่ไทย (พ.ศ.) เป็น Date (UTC) — คืน null ถ้าไม่พบวัน/เดือน/ปีที่ถูกต้อง
 * รองรับ: เดือนเต็ม "21 มกราคม 2564", เดือนย่อ "16 ต.ค. 2566",
 * และช่วงวัน "3, 4 ต.ค. 2567" (ใช้วันแรก). สตริงที่เป็นที่อยู่ เช่น "5/1 ม.7" คืน null
 */
export function parseThaiDate(text: string): Date | null {
  const s = text.trim();
  if (!s) return null;

  // ปี = เลข 4 หลักท้ายสตริง (พ.ศ.)
  const yearMatch = s.match(/(\d{4})\s*$/);
  if (!yearMatch) return null;
  const yearBE = Number(yearMatch[1]);
  if (yearBE < 2400 || yearBE > 2700) return null;

  // เดือน = ชื่อเดือนแบบย่อก่อน แล้วค่อยแบบเต็ม
  let month: number | undefined;
  for (const [name, idx] of Object.entries(THAI_MONTHS_ABBR)) {
    if (s.includes(name)) { month = idx; break; }
  }
  if (month === undefined) {
    for (const [name, idx] of Object.entries(THAI_MONTHS)) {
      if (s.includes(name)) { month = idx; break; }
    }
  }
  if (month === undefined) return null;

  // วัน = เลข 1–2 หลักตัวแรก (ช่วงวัน "3, 4 ..." → เอาวันแรก)
  const dayMatch = s.match(/(?:^|\D)(\d{1,2})\b/);
  if (!dayMatch) return null;
  const day = Number(dayMatch[1]);
  if (day < 1 || day > 31) return null;

  const d = new Date(Date.UTC(yearBE - 543, month, day));
  // ป้องกันวันเกินจริง เช่น 31 กุมภาพันธ์ (Date จะ overflow ไปเดือนถัดไป)
  if (d.getUTCMonth() !== month || d.getUTCDate() !== day) return null;
  return d;
}
