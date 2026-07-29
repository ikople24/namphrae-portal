// Maps a category id to its accent colour (handoff update note: greens ไล่ระดับ
// + ชาดเป็นสีตัดจุดเดียว). Any custom category falls back to the primary green.
// Keep in sync with the --cat-* vars in src/styles/globals.css.
const ACCENTS: Record<string, string> = {
  service: '#17a34a', // บริการประชาชน — เขียวสด
  map: '#0f7a37', // แผนที่และข้อมูลพื้นที่ — เขียวเข้ม
  info: '#d4512c', // ข้อมูลข่าวสารและติดต่อ — ชาด
};

export function accentFor(categoryId: string): string {
  return ACCENTS[categoryId] ?? '#17a34a';
}
