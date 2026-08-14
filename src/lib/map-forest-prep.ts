import proj4 from 'proj4';
import type { Feature, FeatureCollection } from '@/types/map';

// เตรียมไฟล์ป่าชุมชนจากซิปต้นทางให้พร้อมเข้า ingestMapFile
//
// งานเฉพาะกิจของไฟล์ชุดเดียว ไม่ใช่ความสามารถถาวรของระบบ — ทางเข้าปกติที่
// /admin/map ยังปฏิเสธไฟล์ที่ระบบพิกัดผิดเหมือนเดิม (ดู map-parse.ts) การเดา CRS
// แทนคนเป็นสิ่งที่ระบบไม่ควรทำ แต่ที่นี่เรารู้ที่มาของไฟล์แน่ชัดและตรวจด้วยตาแล้ว
// ว่า .prj ตัวไหนโกหก
//
// แยกจาก map-area.ts เพราะคนละอายุการใช้งาน: map-area อยู่ในเส้นทางที่ API route
// โหลดทุกครั้งที่มีคนอัปไฟล์ ส่วนไฟล์นี้ตายหลังนำเข้าครั้งแรกเสร็จ

const UTM47N = '+proj=utm +zone=47 +datum=WGS84 +units=m +no_defs';

/** ชื่อไฟล์ที่ shpjs แปะมาให้แต่ละ sub-layer (ไม่รวมโฟลเดอร์นำหน้า) */
export type NamedCollection = FeatureCollection & { fileName?: string };

type ForestSource = {
  baseName: string;
  moo: string;
  keep: string[];
};

/**
 * allow-list ตายตัว — ไม่ใช่การไล่หาเอาเองจากรูปทรง
 *
 * ซิปมี 7 sub-layer แต่ใช้จริง 4: อีกสามคือขอบเขตเดิมในรูปแบบเส้น (ซ้ำกับรูปปิด)
 * และไฟล์หมุดของหมู่ 11 ที่ว่างเปล่า 0 รายการ ถ้าปล่อยให้สคริปต์เดาเอาจากชนิด
 * รูปทรง วันที่ต้นทางส่งไฟล์ชุดใหม่มาโครงสร้างต่างไปนิดเดียวก็จะได้ข้อมูลผิดชุด
 * โดยไม่มีอะไรเตือน
 */
export const BOUNDARY_SOURCES: ForestSource[] = [
  { baseName: 'พิกัดป่าชุมชนหมู่ 10_polygon1', moo: '10', keep: [] },
  { baseName: 'พิกัดป่าชุมชนหมู่ 11_polygon', moo: '11', keep: [] },
];

export const POINT_SOURCES: ForestSource[] = [
  { baseName: 'พิกัดป่าชุมชนหมู่ 10', moo: '10', keep: ['point_n'] },
  { baseName: 'พิกัดป่าชุมชนหมู่ 11_point', moo: '11', keep: ['point_n'] },
];

/**
 * หา sub-layer จากชื่อไฟล์ — ต้องเทียบด้วย endsWith เท่านั้น
 *
 * "พิกัดป่าชุมชนหมู่ 10" เป็นสตริงนำหน้าของ "พิกัดป่าชุมชนหมู่ 10_polygon1" พอดี
 * includes() จึงคว้าไฟล์รูปปิดมาเป็นเลเยอร์หมุดโดยไม่มีอะไรเตือน
 *
 * ชื่อในซิปเป็น NFC ตรงกับ string literal ที่นี่ และอักษรไทยไม่ decompose ตอน NFD
 * จึงไม่ต้อง normalize ก่อนเทียบ
 */
export function pickSubLayer(
  parts: NamedCollection[],
  baseName: string
): FeatureCollection {
  const found = parts.find((p) => (p.fileName ?? '').endsWith(baseName));
  if (!found) {
    throw new Error(
      `ไม่พบ shapefile ชื่อ "${baseName}" ในซิป — มีอยู่: ` +
        parts.map((p) => p.fileName ?? '(ไม่มีชื่อ)').join(', ')
    );
  }
  return found;
}

/**
 * ไฟล์นี้ยังเป็นพิกัด UTM ดิบอยู่ไหม
 *
 * ตรวจก่อนแปลง ไม่ใช่แปลงทื่อ ๆ ตามชื่อไฟล์ — วันหน้าถ้าต้นทาง export
 * "พิกัดป่าชุมชนหมู่ 11_point" มาใหม่โดย .prj ถูกต้อง สคริปต์จะต้องไม่แปลงซ้ำ
 * จนพิกัดหลุดออกนอกทวีป
 */
export function needsUtmFix(fc: FeatureCollection): boolean {
  const first = fc.features[0]?.geometry?.coordinates;
  const lon = firstLon(first);
  return lon !== null && Math.abs(lon) > 180;
}

/** แปลง EPSG:32647 (UTM 47N) เป็น lon/lat — คืนก้อนใหม่ ไม่แก้ของเดิม */
export function reprojectUtm47N(fc: FeatureCollection): FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => ({
      ...f,
      geometry: f.geometry
        ? {
            ...f.geometry,
            coordinates: mapCoords(f.geometry.coordinates, (c) =>
              proj4(UTM47N, 'EPSG:4326', c)
            ),
          }
        : null,
    })),
  };
}

/**
 * เติม moo แล้วเก็บเฉพาะฟิลด์ใน keep
 *
 * moo เก็บเป็นสตริงเพราะ featureKey() ประกอบคีย์ด้วยสตริง ถ้าปนตัวเลขกับสตริง
 * ระหว่างเวอร์ชัน การเทียบส่วนต่างจะมองเป็นคนละรายการทั้งที่เป็นอันเดียวกัน
 *
 * ตัด begin/end/id (ค่าที่ QGIS แจกเอง ไม่มีความหมายกับใคร) และ E/N (พิกัด UTM
 * ที่ซ้ำกับ geometry อยู่แล้ว เก็บไว้ก็มีแต่จะขัดกันเองเมื่อขอบเขตถูกแก้)
 */
export function tagAndClean(
  fc: FeatureCollection,
  moo: string,
  keep: string[]
): FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => {
      const props: Record<string, unknown> = { moo };
      for (const k of keep) {
        if (f.properties?.[k] !== undefined) props[k] = f.properties[k];
      }
      return { ...f, properties: props };
    }),
  };
}

/** ประกอบสองเลเยอร์จาก sub-layer ทั้งหมดในซิป */
export function buildForestLayers(parts: NamedCollection[]): {
  boundary: FeatureCollection;
  points: FeatureCollection;
} {
  return {
    boundary: collect(parts, BOUNDARY_SOURCES),
    points: collect(parts, POINT_SOURCES),
  };
}

function collect(
  parts: NamedCollection[],
  sources: ForestSource[]
): FeatureCollection {
  const features: Feature[] = [];
  for (const src of sources) {
    let fc = pickSubLayer(parts, src.baseName);
    if (needsUtmFix(fc)) fc = reprojectUtm47N(fc);
    features.push(...tagAndClean(fc, src.moo, src.keep).features);
  }
  return { type: 'FeatureCollection', features };
}

/** ลองจนเจอตัวเลขตัวแรกในโครงพิกัดที่ซ้อนกันกี่ชั้นก็ได้ */
function firstLon(coords: unknown): number | null {
  if (typeof coords === 'number') return coords;
  if (Array.isArray(coords)) {
    for (const c of coords) {
      const v = firstLon(c);
      if (v !== null) return v;
    }
  }
  return null;
}

/** เดินโครงพิกัดที่ซ้อนกันกี่ชั้นก็ได้ แล้วแทนที่คู่ [x, y] ทีละคู่ */
function mapCoords(coords: unknown, fn: (c: number[]) => number[]): unknown {
  if (Array.isArray(coords) && typeof coords[0] === 'number') {
    return fn(coords as number[]);
  }
  if (Array.isArray(coords)) return coords.map((c) => mapCoords(c, fn));
  return coords;
}
