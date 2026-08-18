// parse แถวชีตทะเบียน (array-of-arrays จาก xlsx) — pure, ไม่แตะ IO/DB
// เก็บครบทุกฟิลด์รวม PII (หลังบ้านต้องใช้) — จุดกั้น PII อยู่ที่ API สาธารณะ
import { normalizeRegistryDate } from '@/lib/health-registry-dates';

export interface RegistryCaseRow {
  disease: 'dengue' | 'chikungunya';
  yearBE: number;
  seq: number;
  fullName: string;
  ageYears: number | null;
  address: string;
  moo: number | null;
  onsetDate: Date | null;
  treatDate: Date | null;
  notifyDate: Date | null;
  diagnosis: string;
  careType: string;
  hospital: string;
  note: string;
}

export interface ParseResult {
  cases: RegistryCaseRow[];
  anomalies: string[];
  duplicateSeqs: number[]; // ลำดับที่พบซ้ำ (เรียงตามลำดับที่เจอ) — ใช้ให้ผู้เรียกตัดสินใจข้าม import ทั้งปี
}

/** ชื่อชีตรายเคส เช่น "63เคสรับแจ้ง", "68เคสDF", "68เคสชิคุน" → ปี พ.ศ. (null = ไม่ใช่ชีตรายเคส) */
export function sheetYearBE(name: string): number | null {
  const m = name.trim().match(/^(\d{2})เคส/);
  return m ? 2500 + Number(m[1]) : null;
}

const isChikun = (diagnosis: string) => /ชิคุน|chikun/i.test(diagnosis);

function num(v: unknown): number | null {
  // Number('') === 0 in JS — treat blank/whitespace-only cells as "no value", not zero,
  // otherwise an empty spacer row (seq === '') would be mistaken for a valid case.
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

const str = (v: unknown): string => String(v ?? '').trim();

/**
 * แปลงแถวทั้งชีต (รวมแถวหัวเรื่อง) เป็นรายเคส — หา header จากแถวที่มี "ลำดับ"
 * แล้ว map คอลัมน์ตามชื่อ; แถวที่ลำดับไม่ใช่ตัวเลข (ว่าง/สรุปท้ายตาราง) ถูกข้าม
 */
export function parseRegistrySheet(rows: unknown[][], yearBE: number): ParseResult {
  const anomalies: string[] = [];
  const headerIdx = rows.findIndex((r) => r.some((c) => typeof c === 'string' && c.trim() === 'ลำดับ'));
  if (headerIdx === -1) {
    return { cases: [], anomalies: [`ปี ${yearBE}: ไม่พบแถวหัวตาราง (ลำดับ)`], duplicateSeqs: [] };
  }
  const header = rows[headerIdx].map((c) => str(c));
  const col = (name: string) => header.indexOf(name);
  const ci = {
    seq: col('ลำดับ'), fullName: col('ชื่อ-สกุล'), age: col('อายุ'), address: col('ที่อยู่'), moo: col('หมู่'),
    onset: col('เริ่มป่วย'), treat: col('รักษา'), notify: col('รับแจ้ง'),
    diagnosis: col('วินิจฉัย'), careType: col('ประเภท'), hospital: col('รับการรักษาที่'), note: col('หมายเหตุ'),
  };
  const ciLabel: Record<keyof typeof ci, string> = {
    seq: 'ลำดับ', fullName: 'ชื่อ-สกุล', age: 'อายุ', address: 'ที่อยู่', moo: 'หมู่',
    onset: 'เริ่มป่วย', treat: 'รักษา', notify: 'รับแจ้ง',
    diagnosis: 'วินิจฉัย', careType: 'ประเภท', hospital: 'รับการรักษาที่', note: 'หมายเหตุ',
  };
  // คอลัมน์ที่คาดไว้แต่หาไม่เจอ (พิมพ์ผิด/สลับคอลัมน์ในไฟล์จริง) — ต้องเตือนไว้ก่อน เพราะ index
  // ที่หายไปจะกลายเป็น -1 แล้วทำให้ mapping ฟิลด์อื่นเพี้ยนแบบเงียบ ๆ (เช่น เช็คชิคุนกุนยาทำงานไม่ได้)
  for (const [key, idx] of Object.entries(ci) as [keyof typeof ci, number][]) {
    if (idx === -1) anomalies.push(`ปี ${yearBE}: ไม่พบคอลัมน์ ${ciLabel[key]}`);
  }
  const cases: RegistryCaseRow[] = [];
  const seenSeq = new Set<number>();
  const duplicateSeqs: number[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const seq = num(row[ci.seq]);
    if (seq === null) continue;
    const diagnosis = str(row[ci.diagnosis]);
    const disease: 'dengue' | 'chikungunya' = isChikun(diagnosis) ? 'chikungunya' : 'dengue';
    // ลำดับซ้ำ (เช่น เลขลำดับพิมพ์ผิดในไฟล์จริง) จะชน unique index {yearBE, seq} ตอน insertMany
    // เตือนไว้ก่อนแต่ยังเก็บทั้งสองแถว — ให้คนตรวจสอบเอง ไม่ตัดสินใจทิ้งแทน
    if (seenSeq.has(seq)) { anomalies.push(`ปี ${yearBE} ลำดับ ${seq} ซ้ำ`); duplicateSeqs.push(seq); }
    else seenSeq.add(seq);
    const moo = num(row[ci.moo]);
    if (moo === null) anomalies.push(`ปี ${yearBE} ลำดับ ${seq}: ไม่มีเลขหมู่`);
    const onsetDate = normalizeRegistryDate(row[ci.onset], yearBE);
    const notifyDate = normalizeRegistryDate(row[ci.notify], yearBE);
    if (!onsetDate && !notifyDate) {
      anomalies.push(`ปี ${yearBE} ลำดับ ${seq}: วันที่ parse ไม่ได้ (เริ่มป่วย="${str(row[ci.onset])}", รับแจ้ง="${str(row[ci.notify])}")`);
    }
    cases.push({
      disease, yearBE, seq, fullName: str(row[ci.fullName]), ageYears: num(row[ci.age]), address: str(row[ci.address]), moo,
      onsetDate, treatDate: normalizeRegistryDate(row[ci.treat], yearBE), notifyDate,
      diagnosis, careType: str(row[ci.careType]), hospital: str(row[ci.hospital]), note: str(row[ci.note]),
    });
  }
  return { cases, anomalies, duplicateSeqs };
}

/** ชีต "อัตราป่วยไทย ย้อนหลัง 5 ปี" → [{yearBE, population}] — ข้ามแถวปี/ปชก. ไม่ถูกต้อง */
export function parsePopulationSheet(rows: unknown[][]): { yearBE: number; population: number; thaiCases: number }[] {
  const out: { yearBE: number; population: number; thaiCases: number }[] = [];
  for (const row of rows) {
    const yearBE = num(row[0]);
    const population = num(row[1]);
    if (yearBE !== null && yearBE >= 2400 && yearBE <= 2700 && population !== null && population > 0) {
      out.push({ yearBE, population, thaiCases: num(row[2]) ?? 0 });
    }
  }
  return out;
}

/** ชีต "ชิคุน ย้อนหลัง 5 ป" (หัวคอลัมน์เป็นปี, แต่ละแถว "หมู่ N") → [{yearBE, moo, count}] รวม count 0 */
export function parseChikunMooYear(rows: unknown[][]): { yearBE: number; moo: number; count: number }[] {
  const out: { yearBE: number; moo: number; count: number }[] = [];
  let headerIdx = -1;
  let yearCols: { col: number; yearBE: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const yc = rows[i]
      .map((c, idx) => ({ idx, y: num(c) }))
      .filter((o) => o.y !== null && o.y >= 2500 && o.y <= 2600);
    if (yc.length >= 3) { headerIdx = i; yearCols = yc.map((o) => ({ col: o.idx, yearBE: o.y as number })); break; }
  }
  if (headerIdx === -1) return out;
  for (const row of rows.slice(headerIdx + 1)) {
    const m = str(row[0]).match(/หมู่\s*(\d+)/);
    if (!m) continue;
    const moo = Number(m[1]);
    for (const { col, yearBE } of yearCols) out.push({ yearBE, moo, count: num(row[col]) ?? 0 });
  }
  return out;
}
