import proj4 from 'proj4';
import type { FeatureCollection, Geometry } from '@/types/map';

// พื้นที่ของรูปปิด — คิดบนพิกัด UTM zone 47N ไม่ใช่บน lon/lat โดยตรง
//
// ทำไมไม่ใช้สูตร spherical excess ที่ไม่ต้องแปลงพิกัด: มันคิดบนทรงกลมรัศมี
// ศูนย์สูตร ซึ่งเกินจริงที่ละติจูด 18.7°N อยู่ราว 0.5% — บนป่าหมู่ 11 คือ ~10 ไร่
// มากพอที่จะไม่ควรปัดทิ้งบนพอร์ทัลราชการ ส่วน UTM 47N เป็นระบบพิกัดต้นฉบับที่
// รังวัดมาจริง เป็น conformal projection และตำบลน้ำแพร่อยู่แทบตรงเมริเดียนกลาง
// ของโซนพอดี (98.89°E เทียบกับ 99°E) ความผิดเพี้ยนจึงเหลือแค่ scale factor
// ตัวเดียวที่ถอดออกได้ตรง ๆ
//
// ตัวเลขที่ได้คือ "พื้นที่จากรูปทรงที่วาดไว้" ไม่ใช่เนื้อที่ตามทะเบียนของกรมป่าไม้
// ป้ายกำกับที่หน้าเว็บจึงต้องเขียนว่า "โดยประมาณ" เสมอ (ดู FIELD_LABELS — เพิ่มใน map-style.ts)

const UTM47N = '+proj=utm +zone=47 +datum=WGS84 +units=m +no_defs';

// สร้าง converter ครั้งเดียวตอนโหลดโมดูล — proj4(from, to, coord) แบบ 3 อาร์กิวเมนต์
// จะ parse string โปรเจกชันและคำนวณค่าคงที่ของ datum ใหม่ทุกครั้งที่เรียก ซึ่งช้ากว่า
// แบบ .forward() ที่ build ครั้งเดียวราว 10 เท่า — เลเยอร์ใหญ่สุดในพอร์ทัลตอนนี้มี
// เกือบ 8,000 polygon ต่อไฟล์ ความต่างนี้จะมีผลทันทีที่เลเยอร์ขนาดนั้นเปิด computeArea
const TO_UTM47N = proj4('EPSG:4326', UTM47N);

/** scale factor ที่เมริเดียนกลางของ UTM ทุกโซน — พื้นที่ย่อลงตามกำลังสองของมัน */
const K0 = 0.9996;

const SQM_PER_RAI = 1600;

/**
 * shoelace บนพิกัดเมตร แล้วถอด scale factor ออก — คืนหน่วยตารางเมตร
 *
 * ใช้ `% length` ปิดวงเอง จึงรับได้ทั้งวงเปิดและวงปิด (จุดแรก = จุดสุดท้าย) โดยได้
 * ค่าเท่ากัน — ส่วนที่วนกลับจากจุดสุดท้ายมาจุดแรกของวงปิดคือจุดเดียวกัน พจน์นั้น
 * จึงเป็นศูนย์พอดี ไม่ต้องเดาว่าไฟล์ที่รับมาปิดวงมาให้หรือยัง
 */
export function ringAreaUtm(ringUtm: number[][]): number {
  let sum = 0;
  for (let i = 0; i < ringUtm.length; i += 1) {
    const [x1, y1] = ringUtm[i];
    const [x2, y2] = ringUtm[(i + 1) % ringUtm.length];
    sum += x1 * y2 - x2 * y1;
  }
  // ค่าสัมบูรณ์เพราะเครื่องหมายบอกแค่ทิศทางการวนของวง ไม่ใช่ขนาด
  return Math.abs(sum / 2) / (K0 * K0);
}

/**
 * พื้นที่ของรูปปิดหนึ่ง feature — คืน null ถ้าไม่ใช่รูปปิด
 *
 * ไม่ throw เมื่อเจอรูปทรงผิดชนิด เพราะด่าน geometry-type-mismatch เป็นคนรายงาน
 * เรื่องนั้นอยู่แล้ว การ throw ที่นี่จะทำให้ทั้งไฟล์อัปไม่ได้ด้วยข้อความที่ชี้ผิดที่
 */
export function polygonAreaRai(
  geometry: Geometry | null
): { rai: number; km2: number } | null {
  const polygons = ringsOf(geometry);
  if (!polygons) return null;

  // พิกัดที่หลุดมาจาก JSON.parse ตรง ๆ (null, "x", Infinity จาก 1e400) ไม่ผ่านการ
  // ตรวจใด ๆ ก่อนถึงตรงนี้ — map-parse.ts เช็กแค่โครงสร้างระดับบน และด่าน
  // bad-geometry เช็กแค่ Array.isArray(coordinates) โมดูลนี้จึงเป็นจุดแรกที่แตะ
  // ค่าพิกัดจริง และ proj4 throw ใส่ค่าพวกนี้
  //
  // ปลายทางไม่เหมือนกันทุกเคส: Infinity ทำให้ bbox หลุดขอบแล้วด่าน outside-thailand
  // ปฏิเสธไฟล์ให้ แต่ null เดี่ยว ๆ ถูก walkCoords ของ computeStats ข้ามไปเงียบ ๆ
  // (typeof null === 'object' จึงไม่ผ่าน guard) bbox ไม่กระทบ ไฟล์ผ่านทุกด่าน แล้ว
  // feature นั้นก็ไม่มี area เฉย ๆ
  //
  // ยอมรับผลนั้นได้ เพราะทางเลือกอีกทางแย่กว่า: ปล่อย throw ออกไปจะทำให้
  // ingestMapFile() พังกลางทางและข้าม discard() ทิ้งไฟล์กำพร้าไว้บน Cloudinary
  try {
    const sqm = polygons.reduce(
      (total, rings) =>
        total +
        rings.reduce((sum, ring, i) => {
          const utm = ring.map((c) => TO_UTM47N.forward(c));
          // วงแรกคือขอบนอก วงที่เหลือคือรู ต้องหักออกไม่ใช่บวกเพิ่ม
          return i === 0 ? sum + ringAreaUtm(utm) : sum - ringAreaUtm(utm);
        }, 0),
      0
    );

    // ปัดเศษตายตัว ไม่ใช่เพื่อความสวย — ถ้าปล่อยทศนิยม float เต็มความละเอียด
    // sha256 ของไฟล์เดิมจะเปลี่ยนทุกครั้งที่อัปซ้ำ แล้วตรรกะ "ข้ามถ้า sha ตรง"
    // กับด่าน identical จะใช้ไม่ได้อีกเลย
    return {
      rai: round(sqm / SQM_PER_RAI, 2),
      km2: round(sqm / 1_000_000, 4),
    };
  } catch {
    return null;
  }
}

/** เติม area_rai/area_km2 ให้ทุก feature ที่เป็นรูปปิด — ไม่แก้ของเดิม */
export function withArea(fc: FeatureCollection): FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => {
      const area = polygonAreaRai(f.geometry);
      if (!area) return f;
      return {
        ...f,
        // เขียนทับของที่ติดมากับไฟล์เสมอ — ตัวเลขที่ใครแก้ด้วยมือแล้วไม่ตรงกับ
        // รูปทรงที่วาดอยู่ ไม่ควรหลุดขึ้นเว็บ
        properties: { ...f.properties, area_rai: area.rai, area_km2: area.km2 },
      };
    }),
  };
}

/** วงพิกัดของรูปปิด — null ถ้า geometry ไม่ใช่ Polygon/MultiPolygon */
function ringsOf(geometry: Geometry | null): number[][][][] | null {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') return [geometry.coordinates as number[][][]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as number[][][][];
  return null;
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
