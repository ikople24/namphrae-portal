// ─── MOCK DATA — ยังไม่ใช้ค่าจริง ───────────────────────────────────────────
// The PM2.5 series, ticker values, and sensor positions below are sample
// numbers from the design handoff, approved for display until a real feed
// lands. Replace by wiring /api/air (planned: Air4Thai or the municipality
// sensor page) and real counters — see spec 2026-07-29-ui-redesign-1c.
// ต่อข้อมูลจริงก่อนประชาสัมพันธ์วงกว้าง.

export type TickerItem = {
  icon: string;
  label: string;
  value?: string; // undefined = live PM value is substituted at render
  unit: string;
  color: string;
  isPm?: boolean;
};

export const TICKER_SAMPLE: TickerItem[] = [
  { icon: 'air', label: 'PM2.5 บ้านน้ำแพร่ ', unit: 'µg/m³', color: '#17a34a', isPm: true },
  { icon: 'videocam', label: 'CCTV ออนไลน์ ', value: '24/24', unit: 'ตัว', color: '#17a34a' },
  { icon: 'lightbulb', label: 'ไฟส่องสว่างติดปกติ ', value: '312', unit: 'จุด', color: '#34b863' },
  { icon: 'assignment_turned_in', label: 'คำร้องที่ปิดเรื่องแล้ววันนี้ ', value: '7', unit: 'เรื่อง', color: '#17a34a' },
  { icon: 'water_drop', label: 'ระดับน้ำลำเหมือง ', value: '0.82', unit: 'ม.', color: '#0f7a37' },
  { icon: 'compost', label: 'จุดเผาที่ตรวจพบ ', value: '0', unit: 'จุด', color: '#17a34a' },
];

// 12-point PM2.5 series for the sparkline (handoff sample data).
export const PM_SERIES = [22, 26, 24, 31, 38, 44, 41, 36, 33, 29, 31, 34];

// Bar colour by value — thresholds/hexes from the 1c prototype file.
export function pmColor(v: number): string {
  return v < 26 ? '#34b863' : v < 38 ? '#8c8a2f' : '#8a4a2a';
}

// Hero decorative sensor-node positions (percent of hero box) + ripple delays.
export const SENSOR_NODES = [
  { x: '61%', y: '62%', delay: '0s' },
  { x: '72%', y: '74%', delay: '.7s' },
  { x: '83%', y: '58%', delay: '1.4s' },
  { x: '54%', y: '81%', delay: '2.1s' },
  { x: '90%', y: '78%', delay: '2.8s' },
];

// Hero shortcut row: preferred link ids, in display order.
export const HERO_SHORTCUT_IDS = ['paytax', 'map-main', 'line-oa'];
