// Category accent colours. Custom categories store an explicit `color` picked
// from CATEGORY_COLORS; the legacy trio falls back to ACCENTS by id so no data
// migration is needed. Keep the three legacy hexes in sync with the --cat-*
// vars in src/styles/globals.css.

export const CATEGORY_COLOR_VALUES = [
  '#17a34a',
  '#0f7a37',
  '#32523d',
  '#1e88a8',
  '#b8862b',
  '#d4512c',
] as const;

export const CATEGORY_COLORS: { value: string; label: string }[] = [
  { value: '#17a34a', label: 'เขียวสด' },
  { value: '#0f7a37', label: 'เขียวเข้ม' },
  { value: '#32523d', label: 'เขียวป่า' },
  { value: '#1e88a8', label: 'ฟ้าน้ำ' },
  { value: '#b8862b', label: 'ทอง' },
  { value: '#d4512c', label: 'ชาด' },
];

const ACCENTS: Record<string, string> = {
  service: '#17a34a', // บริการประชาชน — เขียวสด
  map: '#0f7a37', // แผนที่และข้อมูลพื้นที่ — เขียวเข้ม
  info: '#d4512c', // ข้อมูลข่าวสารและติดต่อ — ชาด
};

// Preferred resolver: explicit colour, else legacy per-id hue, else primary.
export function accentOf(
  category: { color?: string } | undefined,
  id: string
): string {
  return category?.color || ACCENTS[id] || '#17a34a';
}

// Id-only fallback for callers without the category object.
export function accentFor(categoryId: string): string {
  return ACCENTS[categoryId] ?? '#17a34a';
}
