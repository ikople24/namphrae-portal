import crypto from 'node:crypto';
import {
  CATEGORICAL_MAX,
  type FeatureCollection,
  type FieldStat,
  type MapStats,
} from '@/types/map';

// สถิติของไฟล์หนึ่งเวอร์ชัน — ถูกเก็บลงเอกสารเวอร์ชันแล้วถูกอ่านซ้ำโดยด่านตรวจ
// ของเวอร์ชันถัดไป (new-value / field-removed / count-jump เทียบกับสถิติ ไม่ใช่
// กับตัวไฟล์) การเก็บ FieldStat.values ไว้ด้วยจึงทำให้ไม่ต้องดึงไฟล์เก่าทั้งก้อน
// มาเทียบทุกครั้ง — จำกัดที่ CATEGORICAL_MAX เพื่อไม่ให้เอกสารบวมจากฟิลด์ที่เป็น
// รหัสประจำตัว (parcel_cod มี 7,862 ค่าไม่ซ้ำ ไม่มีประโยชน์ที่จะเก็บทั้งหมด)

export function computeStats(fc: FeatureCollection): MapStats {
  const geometryTypes = new Set<string>();
  const filled = new Map<string, number>();
  const values = new Map<string, Set<string>>();
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const f of fc.features) {
    if (f.geometry?.type) geometryTypes.add(f.geometry.type);
    if (f.geometry) {
      walkCoords(f.geometry.coordinates, (lon, lat) => {
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      });
    }
    for (const [key, raw] of Object.entries(f.properties ?? {})) {
      if (!filled.has(key)) filled.set(key, 0);
      if (!values.has(key)) values.set(key, new Set());
      // สตริงว่างและ null คือ "ไม่ได้กรอก" เหมือนกัน — ข้อมูลจริงใช้ปนกันทั้งสองแบบ
      if (raw === null || raw === undefined || raw === '') continue;
      filled.set(key, filled.get(key)! + 1);
      const set = values.get(key)!;
      // หยุดสะสมเมื่อเกินเพดาน แต่ยังปล่อยให้ size โตอีกหนึ่งเพื่อให้รู้ว่า "เกิน"
      if (set.size <= CATEGORICAL_MAX) set.add(String(raw));
    }
  }

  const fields: FieldStat[] = [...filled.keys()].sort().map((name) => {
    const set = values.get(name)!;
    const over = set.size > CATEGORICAL_MAX;
    const stat: FieldStat = { name, filled: filled.get(name)!, distinct: set.size };
    if (!over) stat.values = [...set].sort();
    return stat;
  });

  return {
    featureCount: fc.features.length,
    geometryTypes: [...geometryTypes].sort(),
    bbox: Number.isFinite(minLon) ? [minLon, minLat, maxLon, maxLat] : [0, 0, 0, 0],
    fields,
  };
}

// เดินลงไปหาคู่ [lon, lat] ทุกจุดโดยไม่สนใจว่าเป็น Point หรือ MultiPolygon —
// GeoJSON ซ้อนอาเรย์ลึกไม่เท่ากันตามชนิดรูปทรง การเขียนแยกตามชนิดจะพลาดชนิดใหม่
function walkCoords(node: unknown, visit: (lon: number, lat: number) => void): void {
  if (!Array.isArray(node)) return;
  if (typeof node[0] === 'number' && typeof node[1] === 'number') {
    visit(node[0], node[1]);
    return;
  }
  for (const child of node) walkCoords(child, visit);
}

/**
 * ลายนิ้วมือของ "เนื้อข้อมูล" ไม่ใช่ของไฟล์ที่อัปขึ้นมา — shapefile zip ที่บีบอัด
 * ใหม่จากข้อมูลชุดเดิมได้ไบต์คนละชุดทุกครั้ง การเตือนว่า "ไฟล์นี้เหมือนเวอร์ชันที่
 * เผยแพร่อยู่ทุกประการ" จึงต้องดูที่เนื้อข้อมูลเท่านั้น การอัปไฟล์เดิมซ้ำโดยไม่รู้ตัว
 * เป็นความผิดพลาดที่พบบ่อยที่สุดในงานแบบนี้ และจับไม่ได้จากจำนวน feature ซึ่งเท่ากันเป๊ะ
 *
 * เรียงคีย์ก่อน stringify เพราะลำดับคีย์ใน JSON ไม่มีความหมายเชิงข้อมูล แต่ทำให้
 * hash เปลี่ยนได้ (QGIS เรียงฟิลด์ไม่เหมือนกันระหว่างรุ่น)
 */
export function sha256OfFeatureCollection(fc: FeatureCollection): string {
  return crypto.createHash('sha256').update(stableStringify(fc)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (k) =>
        `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`
    );
  return `{${entries.join(',')}}`;
}
