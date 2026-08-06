import type { Feature, FeatureCollection, Geometry } from '@/types/map';

// หาสิ่งที่อยู่ใต้จุดที่คลิก — เรขาคณิตล้วน ไม่มี I/O ไม่พึ่ง Leaflet
//
// ทำไมไม่ใช้ระบบคลิกของ Leaflet: มันเลือกเลเยอร์ที่อยู่บนสุดตาม z-index ตัวเดียว
// แล้วจบ ซึ่งชนกับสิ่งที่หน้าแผนที่ต้องการโดยตรง — ขอบเขตหมู่ต้องวาดอยู่บนสุดเพื่อ
// ให้เห็นกรอบอ้างอิงตลอด แต่มันคือรูปทรงที่คลุมทั้งตำบล ต่อให้ตั้ง fillOpacity: 0
// Leaflet ก็ยังนับว่าคลิกโดนมันอยู่ดี (Polygon._containsPoint ไม่ได้ดู fill) ผลคือ
// คลิกตรงไหนก็ได้ข้อมูลหมู่บ้านเสมอ ไม่มีทางคลิกดูแปลงที่ดินได้เลย
//
// ที่นี่จึงแยกสองเรื่องออกจากกัน: ลำดับการ "วาด" ยังเป็น order มาก = อยู่บน ส่วน
// ลำดับการ "ตอบคลิก" กลับด้าน order น้อย = ละเอียดกว่า = ถูกถามก่อน แล้วคืนทุก
// อย่างที่โดน ไม่ใช่แค่อันแรก เหมือนเครื่องมือ identify ของ QGIS

export type Bbox = [number, number, number, number]; // [minX, minY, maxX, maxY]

/** feature พร้อมกรอบล้อมที่คำนวณไว้ล่วงหน้า — คิดครั้งเดียวตอนโหลดเลเยอร์ */
export type IndexedFeature = { feature: Feature; bbox: Bbox };

export type HitLayer = {
  layerId: string;
  title: string;
  /** order จาก map-style — น้อย = ละเอียดกว่า = ถูกถามก่อน */
  order: number;
  features: IndexedFeature[];
};

export type Hit = { layerId: string; title: string; feature: Feature };

/** คำนวณกรอบล้อมของทุก feature ครั้งเดียว — คลิกทีหลังจะได้ตัดตัวที่ไม่เกี่ยวทิ้งเร็ว */
export function indexFeatures(fc: FeatureCollection): IndexedFeature[] {
  const out: IndexedFeature[] = [];
  for (const feature of fc.features) {
    if (!feature.geometry) continue;
    const bbox = bboxOf(feature.geometry);
    if (bbox) out.push({ feature, bbox });
  }
  return out;
}

export function bboxOf(geometry: Geometry): Bbox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  walk(geometry.coordinates, (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

/**
 * ทุก feature ที่อยู่ใต้จุด (x, y) เรียงจากเลเยอร์ที่ละเอียดที่สุดก่อน
 *
 * `tolerance` เป็นหน่วยองศาเท่ากับพิกัด ใช้กับเส้นและจุดเท่านั้น (รูปปิดใช้การ
 * ทดสอบว่าอยู่ข้างในจริง) ผู้เรียกคำนวณมาจากขนาดพิกเซลบนหน้าจอ ณ ระดับซูมนั้น
 * เพื่อให้ "แตะโดน" รู้สึกเท่ากันทุกระดับซูม
 */
export function findHits(
  layers: HitLayer[],
  x: number,
  y: number,
  tolerance: number,
  limitPerLayer = 4
): Hit[] {
  const hits: Hit[] = [];
  for (const layer of [...layers].sort((a, b) => a.order - b.order)) {
    let taken = 0;
    for (const { feature, bbox } of layer.features) {
      if (taken >= limitPerLayer) break;
      if (!bboxHit(bbox, x, y, tolerance)) continue;
      if (!containsPoint(feature.geometry!, x, y, tolerance)) continue;
      hits.push({ layerId: layer.layerId, title: layer.title, feature });
      taken += 1;
    }
  }
  return hits;
}

function bboxHit(b: Bbox, x: number, y: number, tol: number): boolean {
  return x >= b[0] - tol && x <= b[2] + tol && y >= b[1] - tol && y <= b[3] + tol;
}

export function containsPoint(
  geometry: Geometry,
  x: number,
  y: number,
  tolerance: number
): boolean {
  const c = geometry.coordinates;
  switch (geometry.type) {
    case 'Polygon':
      return polygonHit(c as number[][][], x, y);
    case 'MultiPolygon':
      return (c as number[][][][]).some((poly) => polygonHit(poly, x, y));
    case 'LineString':
      return lineHit(c as number[][], x, y, tolerance);
    case 'MultiLineString':
      return (c as number[][][]).some((line) => lineHit(line, x, y, tolerance));
    case 'Point': {
      const [px, py] = c as number[];
      return Math.hypot(px - x, py - y) <= tolerance;
    }
    case 'MultiPoint':
      return (c as number[][]).some(
        ([px, py]) => Math.hypot(px - x, py - y) <= tolerance
      );
    default:
      return false;
  }
}

/**
 * รูปปิดหนึ่งรูป: วงแรกคือขอบนอก วงที่เหลือคือรู — อยู่ในขอบนอกแต่ตกอยู่ในรู
 * ถือว่าไม่โดน (แปลงที่ดินที่มีที่ดินคนอื่นคร่อมอยู่ตรงกลางมีจริงในข้อมูลชุดนี้)
 */
function polygonHit(rings: number[][][], x: number, y: number): boolean {
  if (rings.length === 0 || !inRing(rings[0], x, y)) return false;
  for (let i = 1; i < rings.length; i += 1) {
    if (inRing(rings[i], x, y)) return false;
  }
  return true;
}

// ray casting มาตรฐาน — ยิงรังสีไปทางขวาแล้วนับจำนวนครั้งที่ตัดขอบ คี่ = อยู่ข้างใน
function inRing(ring: number[][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > y !== yj > y;
    if (straddles && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function lineHit(line: number[][], x: number, y: number, tol: number): boolean {
  for (let i = 1; i < line.length; i += 1) {
    if (distToSegment(x, y, line[i - 1], line[i]) <= tol) return true;
  }
  return false;
}

function distToSegment(x: number, y: number, a: number[], b: number[]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  // จุดสองจุดทับกัน (เกิดได้ในข้อมูลจริง) — ระยะถึง "เส้น" คือระยะถึงจุดนั้น
  if (lenSq === 0) return Math.hypot(x - a[0], y - a[1]);
  let t = ((x - a[0]) * dx + (y - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

function walk(node: unknown, visit: (x: number, y: number) => void): void {
  if (!Array.isArray(node)) return;
  if (typeof node[0] === 'number' && typeof node[1] === 'number') {
    visit(node[0], node[1]);
    return;
  }
  for (const child of node) walk(child, visit);
}
