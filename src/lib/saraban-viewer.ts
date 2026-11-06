// src/lib/saraban-viewer.ts
// พิกัดและร่างตรา/ลายมือของ DocViewer — client-safe บริสุทธิ์ (เทสต์ได้โดยไม่มี DOM)
// ทุกฟังก์ชันคืนอาเรย์ใหม่ ไม่แก้ของเดิม (ใช้เป็น React state ตรง ๆ)

import { inkPointCount, MAX_INK_POINTS, MAX_STAMPS, MAX_STROKES } from '@/lib/saraban-mark';
import type { SarabanMark, StampKind } from '@/types/saraban';

type At = { fileId: string; page: number };
type Rect = { left: number; top: number; width: number; height: number };

export const round4 = (n: number): number => Math.round(n * 10000) / 10000;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** จุดบนจอ → สัดส่วน 0–1 ของกรอบหน้า (ไม่ขึ้นกับขนาดจอ — สเปกรอบ 4 ข้อ 2) */
export function toUnit(clientX: number, clientY: number, rect: Rect): { x: number; y: number } {
  return {
    x: round4(clamp01((clientX - rect.left) / rect.width)),
    y: round4(clamp01((clientY - rect.top) / rect.height)),
  };
}

/** [x1,y1,x2,y2,…] → "x1,y1 x2,y2" ของ <polyline points> ใน viewBox 0 0 1 1 */
export function strokePoints(stroke: readonly number[]): string {
  const out: string[] = [];
  for (let i = 0; i + 1 < stroke.length; i += 2) out.push(`${stroke[i]},${stroke[i + 1]}`);
  return out.join(' ');
}

export function canAddStamp(draft: readonly SarabanMark[]): boolean {
  return draft.filter((m) => m.type === 'stamp').length < MAX_STAMPS;
}

// เอียงเล็กน้อยแบบตรายางจริง วนตามลำดับ — คงที่ (ไม่สุ่ม) ให้เทสต์และ re-render ได้ค่าเดิม
const TILTS = [-4, 3, -2, 5, -5, 2];

export function addStamp(draft: readonly SarabanMark[], at: At, stamp: StampKind): SarabanMark[] {
  if (!canAddStamp(draft)) return [...draft];
  const n = draft.filter((m) => m.type === 'stamp').length;
  return [...draft, { type: 'stamp', ...at, stamp, x: 0.5, y: 0.5, rot: TILTS[n % TILTS.length] }];
}

export function moveStamp(draft: readonly SarabanMark[], index: number, p: { x: number; y: number }): SarabanMark[] {
  return draft.map((m, i) => (i === index && m.type === 'stamp' ? { ...m, x: p.x, y: p.y } : m));
}

/** ตำแหน่งกึ่งกลางตราขณะลาก = จุดชี้ − ระยะที่จับไว้ตอนกด (ตราไม่กระโดดมาที่นิ้ว) */
export function dragTo(pointer: { x: number; y: number }, grab: { x: number; y: number }): { x: number; y: number } {
  return { x: round4(clamp01(pointer.x - grab.x)), y: round4(clamp01(pointer.y - grab.y)) };
}

export function removeMark(draft: readonly SarabanMark[], index: number): SarabanMark[] {
  return draft.filter((_, i) => i !== index);
}

const strokeCount = (draft: readonly SarabanMark[]): number =>
  draft.reduce((n, m) => (m.type === 'ink' ? n + m.strokes.length : n), 0);

/** ต่อเส้นลงหน้านั้น (หนึ่งหน้า = InkMark เดียว) · ตัดให้อยู่ในงบจุดรวมและจำนวนเส้นรวม · สั้นกว่า 2 จุดทิ้ง */
export function appendStroke(draft: readonly SarabanMark[], at: At, stroke: readonly number[]): SarabanMark[] {
  if (strokeCount(draft) >= MAX_STROKES) return [...draft]; // เกินนี้ annotatePatchSchema ฝั่งเซิร์ฟเวอร์ก็ตีกลับอยู่ดี
  const budget = MAX_INK_POINTS - inkPointCount(draft);
  const kept = stroke.slice(0, Math.max(0, budget) * 2);
  if (kept.length < 4) return [...draft];
  const i = draft.findIndex((m) => m.type === 'ink' && m.fileId === at.fileId && m.page === at.page);
  if (i < 0) return [...draft, { type: 'ink', ...at, strokes: [kept] }];
  return draft.map((m, j) => (j === i && m.type === 'ink' ? { ...m, strokes: [...m.strokes, kept] } : m));
}

export function clearInk(draft: readonly SarabanMark[]): SarabanMark[] {
  return draft.filter((m) => m.type !== 'ink');
}
