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
    // ไม่ใช้ Number.isFinite เพราะ Number(null) เป็น 0 ซึ่งผ่านด่านนั้นได้ แล้ว 0 <= 41
    // ทำให้แถวทะเบียนฝายที่ fid ว่างไหลไปอยู่ฝั่งจุดสำรวจ แล้วชื่อฝายถูกตัดทิ้งเงียบ ๆ
    // — และ null คือรูปแบบที่ไฟล์ชุดนี้ใช้เขียนช่องว่างจริง ๆ (Name/cause/loss เป็น null
    // กันทั้งไฟล์) ส่วนสตริงตัวเลขอย่าง "42" ยังผ่านได้ตามเดิม
    if (!Number.isInteger(fid) || fid < 1) {
      throw new Error(`แถวฝาย fid ใช้ไม่ได้: ${JSON.stringify(f.properties)}`);
    }
    (fid <= SURVEY_MAX_FID ? surveyRows : weirRows).push(f);
  }

  // ชื่อฝายคือคีย์ประจำรายการของชั้นนี้ ไม่มีชื่อ = ไม่มีตัวตนให้เทียบระหว่างเวอร์ชัน
  // ด่าน duplicate-key เตือนแค่ระดับ warning จึงต้องหยุดตั้งแต่ที่นี่ หลักเดียวกับที่
  // mooFromName โยน error แทนที่จะเดาเลขหมู่
  for (const f of weirRows) {
    if (!f.properties?.loss) {
      throw new Error(`แถวฝายไม่มีชื่อ (คอลัมน์ loss): ${JSON.stringify(f.properties)}`);
    }
  }

  const surveyedAt = (f: Feature) => {
    try {
      return { surveyed_at: toIsoDate(f.properties?.Date) };
    } catch (err) {
      // toIsoDate รู้แค่ค่าที่อ่านไม่ออก ไม่รู้ว่ามาจากแถวไหน — บนไฟล์ 54 แถวข้อความ
      // เปล่า ๆ ไม่ช่วยใครหาต้นตอ
      throw new Error(
        `${(err as Error).message} (แถว ${JSON.stringify(f.properties)})`
      );
    }
  };

  return {
    // LAT/LON ทิ้งเพราะซ้ำกับ geometry อยู่แล้ว เก็บไว้ก็มีแต่จะขัดกันเองเมื่อหมุด
    // ถูกย้าย — เหตุผลเดียวกับที่เคยทิ้ง E/N ของหมุดรังวัดป่าชุมชน
    survey: pick(surveyRows, { Name: 'photo', Altitude: 'elevation_m' }, surveyedAt),
    weir: pick(weirRows, { loss: 'name', cause: 'note' }, surveyedAt),
  };
}

// ── ชั้นอ้างอิงของกรมป่าไม้ ──────────────────────────────────────────────────

/**
 * ป่าสงวนแห่งชาติ 26 ป่า
 *
 * คีย์เป็น nrf_code ไม่ใช่ชื่อ เพราะ "ป่าแม่ยวมฝั่งซ้าย" มีสองแถวในไฟล์ ถ้าใช้ชื่อ
 * จะติดด่าน duplicate-key ทันที (เหตุผลเดียวกับที่ถนนต้องใช้คีย์ประกอบ)
 *
 * ทิ้ง Xmin/Xmax/Ymin/Ymax เพราะเป็น bbox ที่ซ้ำกับ geometry อยู่แล้ว ส่วน ภาค กับ
 * Typ เป็นค่าเดียวกันทุกแถว จึงไม่ได้บอกอะไรที่ชื่อเลเยอร์ไม่ได้บอก
 */
export function prepReserve(fc: FeatureCollection): FeatureCollection {
  return pick(fc.features, {
    NRF_CODE: 'nrf_code',
    FR_NAME: 'name',
    Province: 'province',
    AREA_RAI: 'rai_gazette',
    rai_GIS: 'rai_rfd',
    'สจป': 'office',
  });
}

/**
 * ป่าไม้ถาวร 29 แปลง
 *
 * ทิ้ง objectid ด้วยเหตุผลเดียวกับที่ชั้นอาคารไม่ตั้งคีย์: ArcGIS แจกใหม่ทุกรอบ export
 * ส่วน per_id (pf00330) เป็นรหัสจริงที่คงที่ และ name_en/mod_date ว่างทั้งคอลัมน์
 * (0 จาก 29 แถว) ส่วน area_pres เป็น 0 ทุกแถว
 *
 * แปลง area_gis จากตารางเมตรเป็นไร่เพื่อให้หน่วยตรงกับชั้นอื่น ปัดสองตำแหน่งตายตัว
 * ด้วยเหตุผลเดียวกับ area_rai — ทศนิยม float เต็มความละเอียดทำให้ sha256 ของไฟล์เดิม
 * เปลี่ยนทุกครั้งที่อัปซ้ำ แล้วตรรกะ "ข้ามถ้า sha ตรง" ใช้ไม่ได้อีกเลย
 */
const SQM_PER_RAI = 1600;

export function prepPermanent(fc: FeatureCollection): FeatureCollection {
  return pick(fc.features, { per_id: 'per_id', name_th: 'name' }, (f) => {
    const sqm = num(f.properties?.area_gis);
    if (!Number.isFinite(sqm)) return {};
    return { rai_rfd: Math.round((sqm / SQM_PER_RAI) * 100) / 100 };
  });
}

/**
 * วงรอบ คทช. ป่าแม่ท่าช้าง–ป่าแม่ขนิน 1 วง
 *
 * ไฟล์มีเนื้อที่สองชุดในแถวเดียวกัน: Rai/Ngan/wa = 5,935 ไร่ 1 งาน 36 วา (ตรงกับ
 * Shape_Area) กับ R/Ng/Twa/RA = 5,746 ไร่ 1 งาน 58 วา (ตรงกับ A) ต่างกัน 189 ไร่
 * น่าจะเป็นวงรอบทั้งหมด vs พื้นที่จัดสรรจริง แต่ยังไม่มีใครยืนยัน
 *
 * เก็บชุดใหญ่ไว้ชุดเดียวก่อน และห้ามเปิดสาธารณะจนกว่าจะถามเจ้าของข้อมูลได้ว่าชุดไหน
 * คืออะไร — ตัวเลขเนื้อที่ผิดบนพอร์ทัลราชการคือสิ่งที่คนเอาไปอ้างต่อ
 */
export function prepKortorchor(fc: FeatureCollection): FeatureCollection {
  return pick(fc.features, { Rai: 'rai', Ngan: 'ngan', wa: 'wa' });
}

/**
 * แหล่งน้ำ 327 เส้น
 *
 * ทิ้งฟิลด์ name ของต้นทางเพราะเป็นสองฟิลด์เชื่อมด้วย " / " ที่ซ้ำกับ STRM_TH และ
 * ST_CL_T อยู่แล้ว ส่วนฟิลด์อังกฤษไม่มีที่ใช้บนหน้าเว็บภาษาไทย
 *
 * เก็บทั้งรหัสชั้นคุณภาพ (1–6) และคำอธิบายไทย: รหัสใช้กำหนดสีเส้นใน map-style
 * ส่วนคำอธิบายใช้ในป๊อปอัป ทั้งคู่จับคู่กัน 1:1 ในไฟล์
 */
export function prepStream(fc: FeatureCollection): FeatureCollection {
  return pick(fc.features, {
    STRM_TH: 'name',
    ST_CLASS: 'class',
    ST_CL_T: 'class_th',
  });
}
