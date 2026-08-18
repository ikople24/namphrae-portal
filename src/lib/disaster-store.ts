import { ObjectId, type Filter } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type { DisasterType } from '@/lib/disaster-types';
import type { IncidentInput } from '@/lib/disaster-schema';
import { parseThaiDate } from '@/lib/thai-date';
import type { IncidentItem, YearStat } from '@/types/disaster';

// ทะเบียนเหตุสาธารณภัย — ย้ายมาจาก namphrae-map/models/Incident.ts ซึ่งเป็น mongoose
//
// portal ใช้ driver ดิบทั้งระบบ การพา mongoose เข้ามาเพื่อ collection เดียวจะได้ ODM
// สองตัวในโปรเจกต์เดียวและ connection pool คนละชุด — โครง document ไม่เปลี่ยนแม้แต่
// ฟิลด์เดียวเพราะข้อมูลถูกคัดลอกมาทั้งก้อนโดยไม่แปลงรูป (scripts/copy-map-data.ts)
//
// แยกฟังก์ชันบริสุทธิ์ไว้ข้างบนให้เทสต์เรียกตรงได้โดยไม่ต้องแตะ Mongo ด้วยเหตุผล
// เดียวกับ map-store.ts และรับ now/actor เป็นพารามิเตอร์แทนที่จะเรียกเองข้างใน
// เพื่อให้ตรึงค่าที่เขียนลง document ได้จริง ไม่ใช่ได้แค่ตรวจว่า "มีฟิลด์นั้นอยู่"

const COLLECTION = 'incidents';

/** โครง document จริงใน collection — ตรงกับ schema เดิมของ mongoose ทุกฟิลด์ */
export type IncidentDoc = {
  _id: ObjectId;
  disasterType: DisasterType;
  year: number;
  date: Date;
  dateText: string;
  method?: string;
  areaType?: string;
  location: { type: 'Point'; coordinates: [number, number] };
  imageFile?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

// ── ฟังก์ชันบริสุทธิ์ ────────────────────────────────────────────────────────

/**
 * ตัวกรองจาก query string
 *
 * `Number(year)` ให้ NaN เมื่อค่าไม่ใช่ตัวเลข ซึ่ง Mongo จะไม่ match อะไรเลย =
 * คืนรายการว่าง ตรงกับพฤติกรรมเดิมของ namphrae-map และเป็นผลที่ถูกต้องกว่าการ
 * ข้ามตัวกรองทิ้ง — ผู้ใช้ขอปีเจาะจงแล้วได้ข้อมูลทุกปีกลับไปโดยไม่รู้ตัวแย่กว่า
 */
export function buildIncidentFilter(q: {
  type?: string;
  year?: string;
}): Filter<IncidentDoc> {
  const filter: Filter<IncidentDoc> = {};
  if (q.type) filter.disasterType = q.type as DisasterType;
  if (q.year) filter.year = Number(q.year);
  return filter;
}

/**
 * document → รูปที่หน้าเว็บใช้
 *
 * นี่คือจุดเดียวที่กัน createdBy (Clerk user ID ของเจ้าหน้าที่) createdAt/updatedAt
 * ไม่ให้หลุดออก API สาธารณะ — ต้นทางคืนทั้ง document ผ่าน .lean() จึงส่งรหัสผู้ใช้
 * ออกไปให้คนทั้งอินเทอร์เน็ตทุกครั้งที่มีคนเปิดหน้าแผนที่
 *
 * ประกาศฟิลด์ทีละตัวแทนการ destructure ส่วนที่ไม่เอาออก เพราะฟิลด์ใหม่ที่ใครเพิ่มลง
 * document วันหน้าจะได้ไม่ไหลออกไปเองโดยอัตโนมัติ
 */
export function toIncidentItem(doc: IncidentDoc): IncidentItem {
  return {
    _id: doc._id.toString(),
    disasterType: doc.disasterType,
    year: doc.year,
    date: doc.date.toISOString(),
    dateText: doc.dateText,
    method: doc.method ?? '',
    areaType: doc.areaType ?? '',
    location: doc.location,
    imageFile: doc.imageFile ?? '',
  };
}

/**
 * input จากฟอร์ม → ฟิลด์ที่เขียนลง document
 *
 * `date` มาจากการอ่าน `dateText` ภาษาไทย ถ้าอ่านไม่ออกให้ถอยไป 1 ม.ค. ของปีนั้น
 * (พ.ศ. − 543) — ตรงกับต้นทาง เพราะกราฟรายเดือนต้องมีวันที่เสมอ ปล่อยว่างไม่ได้
 */
export function buildIncidentFields(input: IncidentInput): Omit<IncidentDoc, '_id'> {
  const { lat, lng, ...rest } = input;
  return {
    ...rest,
    date: parseThaiDate(input.dateText) ?? new Date(Date.UTC(input.year - 543, 0, 1)),
    location: { type: 'Point', coordinates: [lng, lat] },
  };
}

// ── I/O ──────────────────────────────────────────────────────────────────────

async function col() {
  return (await getDb()).collection<IncidentDoc>(COLLECTION);
}

export async function listIncidents(filter: Filter<IncidentDoc>): Promise<IncidentItem[]> {
  const rows = await (await col()).find(filter).sort({ date: 1 }).toArray();
  return rows.map(toIncidentItem);
}

/** null เมื่อ id ไม่ใช่ ObjectId ที่ถูกรูป ผู้เรียกจึงตอบ 404 ได้โดยไม่ต้องเช็คเอง */
export async function getIncident(id: string): Promise<IncidentItem | null> {
  if (!ObjectId.isValid(id)) return null;
  const row = await (await col()).findOne({ _id: new ObjectId(id) });
  return row ? toIncidentItem(row) : null;
}

export async function insertIncident(
  input: IncidentInput,
  actor: string,
  now: Date
): Promise<IncidentItem> {
  // สร้าง ObjectId เอง แทนที่จะปล่อยให้ driver แปะให้หลัง insert: IncidentDoc
  // ประกาศ `_id: ObjectId` เป็นฟิลด์บังคับ (ตรงกับ document ที่มีอยู่จริง) ซึ่งทำให้
  // OptionalUnlessRequiredId<IncidentDoc> ของ driver คงให้ _id เป็นฟิลด์บังคับต่อ
  // ไม่ได้ทำให้ optional อัตโนมัติแบบที่คอลเลกชันไม่ประกาศ _id ไว้เอง — จึงต้องมี
  // ค่าให้ครบตั้งแต่ก่อนเรียก insertOne ไม่ใช่ค่อยเติมจาก insertedId ทีหลัง
  const doc: IncidentDoc = {
    _id: new ObjectId(),
    ...buildIncidentFields(input),
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  };
  await (await col()).insertOne(doc);
  return toIncidentItem(doc);
}

/**
 * ไม่แตะ createdBy/createdAt — คนแก้ทีหลังไม่ควรกลายเป็นคนสร้าง ประวัติจะโกหก
 */
export async function updateIncident(
  id: string,
  input: IncidentInput,
  now: Date
): Promise<IncidentItem | null> {
  if (!ObjectId.isValid(id)) return null;
  const row = await (await col()).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...buildIncidentFields(input), updatedAt: now } },
    { returnDocument: 'after' }
  );
  return row ? toIncidentItem(row) : null;
}

export async function deleteIncident(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const res = await (await col()).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}

/** สถิติรายปีต่อประเภท — pipeline เดียวกับ pages/api/incidents/stats.ts ของต้นทาง */
export async function incidentYearStats(): Promise<YearStat[]> {
  return (await col())
    .aggregate<YearStat>([
      { $group: { _id: { year: '$year', disasterType: '$disasterType' }, count: { $sum: 1 } } },
      { $project: { _id: 0, year: '$_id.year', disasterType: '$_id.disasterType', count: 1 } },
      { $sort: { year: 1 } },
    ])
    .toArray();
}
