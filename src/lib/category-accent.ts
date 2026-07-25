// Maps a category id to its accent colour. Known civic groups get fixed hues;
// any custom category falls back to emerald so new categories still look right.
const ACCENTS: Record<string, string> = {
  service: '#0e7a67', // บริการประชาชน — jade
  map: '#24809e', // แผนที่และข้อมูลพื้นที่ — water blue
  info: '#a9791f', // ข้อมูลข่าวสารและติดต่อ — Lanna gold
};

export function accentFor(categoryId: string): string {
  return ACCENTS[categoryId] ?? '#0e7a67';
}
