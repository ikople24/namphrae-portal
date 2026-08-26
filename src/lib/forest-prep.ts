// src/lib/forest-prep.ts
import { arabicDigits, toIsoDate } from '@/lib/iso-date';
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
  const m = MOO.exec(arabicDigits(String(name ?? '')));
  if (!m) throw new Error(`หาเลขหมู่จากชื่อไม่เจอ: ${JSON.stringify(name)}`);
  return Number(m[1]);
}

/**
 * ตัวเลขจากค่าที่มาในถุง properties — `null`, `undefined` และสตริงว่าง คืน NaN ไม่ใช่ 0
 *
 * `Number(null)` เป็น 0 ซึ่งที่นี่อันตราย: ช่องทะเบียนที่ว่างจะกลายเป็นเนื้อที่ 0 ไร่
 * แล้วด่านตรวจของสคริปต์นำเข้าจะรายงานว่าการแปลงพิกัดเพี้ยน ทั้งที่สาเหตุจริงคือ
 * ช่องเดียวในไฟล์ที่ไม่ได้กรอก — คนอ่านจะไล่ผิดทางทั้งวัน
 */
function num(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'string' && v.trim() === '') return NaN;
  return Number(v);
}

const WA_EXACT = 'ตารางวา';

/**
 * หาคอลัมน์ตารางวา — คืน null ถ้าไม่มี
 *
 * ชื่อคอลัมน์ถูกตัดตอน export เป็น shapefile เพราะชื่อฟิลด์ DBF ยาวได้ 10 ไบต์ แล้ว
 * ไบต์สุดท้ายขาดกลางตัวอักษรจนกลายเป็น U+FFFD จึงต้องรับทั้งชื่อเต็มและชื่อที่ถูกตัด
 *
 * แต่จะดูแค่ว่าขึ้นต้นด้วย "ตาร" ไม่ได้ — อักษรไทยตัวละ 3 ไบต์ใน UTF-8 "ตารางวา" กับ
 * "ตารางเมตร" จึงถูกตัดเหลือชื่อ DBF เดียวกันเป๊ะ และไฟล์ GeoJSON ที่ export ตรงจาก
 * QGIS มีทั้งสองคอลัมน์อยู่ด้วยกันได้ ("ตารางเมตร" คือชื่อที่คนตั้งให้คอลัมน์ $area)
 * หยิบผิดคอลัมน์แล้วได้เนื้อที่ผิดไปคนละเรื่อง
 *
 * เกณฑ์ความยาวคือสิ่งที่แยกสองชื่อนี้ออกจากกัน: ชื่อที่ถูกตัดเหลือ 10 ไบต์ คือ "ตาร"
 * (9 ไบต์) บวกเศษอีกตัว จึงยาวไม่เกิน 4 อักขระ ส่วน "ตารางเมตร" ยาว 9
 */
function waKeyOf(p: Record<string, unknown>): string | null {
  if (WA_EXACT in p) return WA_EXACT;
  const hits = Object.keys(p).filter((k) => k.startsWith('ตาร') && k.length <= 4);
  // สองคอลัมน์ที่ถูกตัดชื่อจนเหมือนกัน = ไฟล์กำกวม คนต้องมาดู ไม่ใช่ให้เครื่องเดา
  if (hits.length > 1) {
    throw new Error(`มีคอลัมน์ตารางวาที่ถูกตัดชื่อมากกว่าหนึ่ง: ${hits.join(', ')}`);
  }
  return hits[0] ?? null;
}

/**
 * เนื้อที่ตามทะเบียนที่ติดมาในไฟล์ (ไร่) — null ถ้าฟิลด์ไม่ครบ
 *
 * ใช้ตรวจยันค่าที่ computeArea คำนวณเท่านั้น ไม่ได้เก็บลงชั้นข้อมูล
 */
export function registryRai(f: Feature): number | null {
  const p = f.properties ?? {};
  const rai = num(p['ไร่']);
  const ngan = num(p['งาน']);
  const waKey = waKeyOf(p);
  const wa = waKey ? num(p[waKey]) : NaN;
  if (!Number.isFinite(rai) || !Number.isFinite(ngan) || !Number.isFinite(wa)) return null;
  return rai + ngan / 4 + wa / 400;
}

/** ป่าชุมชน 4 แปลง — เหลือแค่ moo ส่วน area_rai/area_km2 ให้ computeArea เติม */
export function prepCommunityForest(fc: FeatureCollection): FeatureCollection {
  return pick(fc.features, {}, (f) => ({ moo: mooFromName(f.properties?.name) }));
}

// ── ฝาย ──────────────────────────────────────────────────────────────────────

// fid แบ่งตัวเองอยู่แล้ว: 1–41 คือการเดินสำรวจถ่ายรูปสองวันในมิถุนายน 2568
// (มีรูปกับระดับความสูง ไม่มีชื่อ) ส่วน 42–54 คือทะเบียนฝายที่สร้างจริงย้อนหลัง 5 ปี
// (มีชื่อกับสาเหตุความเสียหาย ไม่มีรูป) ทั้งสองชุดไม่มีแถวไหนคาบเกี่ยวกันเลย
//
// สคริปต์นำเข้าตรวจยันช่วง fid นี้อีกชั้นก่อนเขียนลงฐาน — ถ้าวันไหนต้นทางแก้ไฟล์
// จนช่วงเปลี่ยน การแยกสองชั้นอาจไม่ตรงอีกต่อไปและต้องมีคนมาดูด้วยตา
const SURVEY_MAX_FID = 41;

export function splitWeir(fc: FeatureCollection): {
  weir: FeatureCollection;
  survey: FeatureCollection;
} {
  const surveyRows: Feature[] = [];
  const weirRows: Feature[] = [];

  for (const f of fc.features) {
    const fid = Number(f.properties?.fid);
    if (!Number.isFinite(fid)) {
      throw new Error(`แถวฝายไม่มี fid: ${JSON.stringify(f.properties)}`);
    }
    (fid <= SURVEY_MAX_FID ? surveyRows : weirRows).push(f);
  }

  const surveyedAt = (f: Feature) => ({
    surveyed_at: toIsoDate(f.properties?.Date),
  });

  return {
    // LAT/LON ทิ้งเพราะซ้ำกับ geometry อยู่แล้ว เก็บไว้ก็มีแต่จะขัดกันเองเมื่อหมุด
    // ถูกย้าย — เหตุผลเดียวกับที่เคยทิ้ง E/N ของหมุดรังวัดป่าชุมชน
    survey: pick(surveyRows, { Name: 'photo', Altitude: 'elevation_m' }, surveyedAt),
    weir: pick(weirRows, { loss: 'name', cause: 'note' }, surveyedAt),
  };
}
