// src/lib/map-precision.ts
import type { FeatureCollection, Geometry } from '@/types/map';

// ปัดทศนิยมของพิกัดให้เหลือตามที่เลเยอร์กำหนด
//
// ไฟล์ที่ export จาก QGIS พกทศนิยมมาถึง 14 ตำแหน่ง ซึ่งเป็นขยะทศนิยมลอยตัวจากการ
// แปลงพิกัด ไม่ใช่ความแม่นยำจริง — ที่ละติจูด 18.7°N ตำแหน่งที่ 6 คือ 11 เซนติเมตร
// ละเอียดกว่าเครื่องรังวัดที่เก็บข้อมูลชุดนี้หลายเท่า
//
// อยู่ที่นี่ไม่ใช่ในสคริปต์นำเข้า ด้วยเหตุผลเดียวกับ withArea: ไฟล์ที่เจ้าหน้าที่
// export จาก QGIS มาลากวางเองต้องได้ผลเท่ากัน ไม่งั้นไฟล์จะกลับไปบวมเงียบ ๆ โดยไม่มี
// ด่านไหนเตือน (ด่านที่มีอยู่ดูจำนวนแถวกับรายชื่อฟิลด์ ไม่ได้ดูขนาดไฟล์)

export function roundCoord(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function withPrecision(fc: FeatureCollection, digits: number): FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => ({ ...f, geometry: roundGeometry(f.geometry, digits) })),
  };
}

function roundGeometry(geometry: Geometry | null, digits: number): Geometry | null {
  if (!geometry || !Array.isArray(geometry.coordinates)) return geometry;
  return { ...geometry, coordinates: walk(geometry.coordinates, digits) };
}

// เดินลึกเท่าไหร่ก็ได้ — Point เป็น number[] ส่วน MultiPolygon เป็น number[][][][]
// ค่าที่ไม่ใช่ number (null หรือ "x" ที่หลุดมาจาก JSON.parse) ปล่อยผ่านตามเดิม ให้
// ด่าน bad-geometry กับ outside-thailand เป็นคนรายงาน เหตุผลเดียวกับที่
// polygonAreaRai เลือกคืน null แทนการ throw
function walk(node: unknown, digits: number): unknown {
  if (typeof node === 'number') return roundCoord(node, digits);
  if (Array.isArray(node)) return node.map((n) => walk(n, digits));
  return node;
}
