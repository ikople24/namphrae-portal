// src/lib/forest-prep.ts
import { toIsoDate } from '@/lib/iso-date';
import type { Feature, FeatureCollection } from '@/types/map';

// ล้างฟิลด์ของชั้นข้อมูลป่าไม้แต่ละชั้นก่อนเข้า ingestMapFile
//
// เป็นงานเฉพาะกิจของไฟล์ชุดที่ export มาจาก QGIS เครื่องเดียว ไม่ใช่ความสามารถถาวร
// ของระบบ — ทางเข้าปกติที่ /admin/forest ยังรับไฟล์ตามที่มันเป็น แล้วให้เจ้าหน้าที่
// ติ๊กเลือกฟิลด์สาธารณะเอง เหตุผลเดียวกับที่ map-forest-prep.ts เคยมีอยู่
//
// ทุกฟังก์ชันบริสุทธิ์ รับ FeatureCollection คืน FeatureCollection ใหม่

/**
 * เก็บเฉพาะฟิลด์ที่ระบุพร้อมเปลี่ยนชื่อ ฟิลด์อื่นหายหมด
 *
 * ตัดทิ้งเป็นค่าเริ่มต้น ไม่ใช่เก็บเป็นค่าเริ่มต้น — ไฟล์ต้นทางพก bbox, OBJECTID,
 * path บนไดรฟ์ D: และคอลัมน์ว่างทั้งคอลัมน์มาด้วย การเก็บทุกอย่างไว้ก่อนแล้วค่อยกรอง
 * ตอนเผยแพร่แปลว่าค่าพวกนั้นยังเดินทางไปถึงเซิร์ฟเวอร์และอยู่ในไฟล์เต็มตลอดไป
 */
function pick(
  features: Feature[],
  rename: Record<string, string>,
  extra?: (f: Feature) => Record<string, unknown>
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features.map((f) => {
      const src = f.properties ?? {};
      const out: Record<string, unknown> = {};
      for (const [from, to] of Object.entries(rename)) {
        if (src[from] !== undefined && src[from] !== null) out[to] = src[from];
      }
      return { ...f, properties: { ...out, ...(extra?.(f) ?? {}) } };
    }),
  };
}

// ── ป่าชุมชน ─────────────────────────────────────────────────────────────────

// ไฟล์เดียวมีชื่อสองแบบปนกัน ("เขตป่าชุมชน หมู่ 7" กับ "พิกัดป่าชุมชนหมู่ 10")
// เพราะสี่แปลงมาจากงาน QGIS คนละครั้ง
const MOO = /หมู่\s*(?:ที่\s*)?(\d+)/;

/** เลขหมู่จากชื่อแปลง — คือตัวตนที่ระบบใช้เทียบส่วนต่างระหว่างเวอร์ชัน */
export function mooFromName(name: unknown): number {
  const m = MOO.exec(String(name ?? ''));
  if (!m) throw new Error(`หาเลขหมู่จากชื่อไม่เจอ: ${JSON.stringify(name)}`);
  return Number(m[1]);
}

/**
 * เนื้อที่ตามทะเบียนที่ติดมาในไฟล์ (ไร่) — null ถ้าฟิลด์ไม่ครบ
 *
 * ใช้ตรวจยันค่าที่ computeArea คำนวณเท่านั้น ไม่ได้เก็บลงชั้นข้อมูล
 *
 * ชื่อคอลัมน์ "ตารางวา" ถูกตัดตอน export เป็น shapefile (ชื่อฟิลด์ DBF ยาวได้ 10 ไบต์)
 * แล้วไบต์สุดท้ายขาดกลางตัวอักษรจนกลายเป็น U+FFFD — จึงไล่หาคีย์ที่ขึ้นต้นด้วย "ตาร"
 * แทนการเทียบชื่อเป๊ะ ๆ ซึ่งจะพังทันทีที่ export ครั้งหน้าตัดคำที่ตำแหน่งอื่น
 */
export function registryRai(f: Feature): number | null {
  const p = f.properties ?? {};
  const rai = Number(p['ไร่']);
  const ngan = Number(p['งาน']);
  const waKey = Object.keys(p).find((k) => k.startsWith('ตาร'));
  const wa = waKey ? Number(p[waKey]) : NaN;
  if (!Number.isFinite(rai) || !Number.isFinite(ngan) || !Number.isFinite(wa)) return null;
  return rai + ngan / 4 + wa / 400;
}

/** ป่าชุมชน 4 แปลง — เหลือแค่ moo ส่วน area_rai/area_km2 ให้ computeArea เติม */
export function prepCommunityForest(fc: FeatureCollection): FeatureCollection {
  return pick(fc.features, {}, (f) => ({ moo: mooFromName(f.properties?.name) }));
}
