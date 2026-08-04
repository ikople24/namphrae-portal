import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import type { UpdateFilter } from 'mongodb';
import { getDb, isMongoConfigured } from '@/lib/mongodb';
import type { JobInput } from '@/lib/schema';
import type { CalendarJob, JobStatus } from '@/types/portal';

// งานปฏิทินอยู่คนละที่กับ PortalConfig โดยตั้งใจ: config เป็นเอกสารก้อนเดียวที่
// ทุก mutation เขียนทับทั้งก้อนแล้ว bump version ส่วนงานโตไม่จำกัดและแก้บ่อย
// ถ้ายัดรวมจะชนเพดาน 16MB ของ Mongo document และทำ version พุ่งโดยเปล่าประโยชน์
//
// แบ็กเอนด์เหมือน config-store: Mongo เมื่อมี MONGODB_URI ไม่งั้นใช้ไฟล์ในเครื่อง
// (Vercel/Railway filesystem เป็น read-only ตอน runtime — production ต้องใช้ Mongo)
//
// แบ็กเอนด์ไฟล์ไม่มี lock: ทุกฟังก์ชันอ่าน-แก้-เขียนทั้งอาเรย์ สอง request ที่
// เขียนพร้อมกัน (next dev เสิร์ฟพร้อมกันได้จริง) แข่งกันได้ งานหนึ่งหายเงียบ ๆ
// ยอมรับได้เพราะเป็น dev fallback เจ้าเดียวแก้ ไม่ใช่โมเดลของ production
//
// ค่า date ที่เก็บไว้ (ทั้ง Mongo และไฟล์) เป็น 'YYYY-MM-DD' ที่มีอยู่จริงเสมอ
// เพราะทุกจุดที่เขียนงานผ่าน jobInputSchema ซึ่ง refine() ปฏิเสธวันที่ไม่มีจริง
// เช่น 2026-02-30 — matches() และ query ช่วง -31 ใน listJobs() พึ่งพาสมมติฐาน
// นี้อยู่ (ดูคอมเมนต์ตรงนั้น) ตัวเขียนงานใหม่ในอนาคต เช่น importer ย้ายข้อมูล
// จาก Google Calendar ต้องผ่าน schema เดียวกันนี้เสมอ ไม่งั้นวันที่เพี้ยนจะ
// มองไม่เห็นทั้งใน production และ dev เหมือนกัน สลับแบ็กเอนด์ก็ไม่ช่วยให้เจอบั๊ก

const COLLECTION = 'calendarJobs';
const DATA_DIR = path.join(process.cwd(), 'data');
const RUNTIME_FILE = path.join(DATA_DIR, 'calendar-jobs.json');

export type JobFilter = { month?: string; status?: JobStatus };

function usingMongo(): boolean {
  return isMongoConfigured();
}

// ---- file backend ----------------------------------------------------------

async function fileRead(): Promise<CalendarJob[]> {
  try {
    return JSON.parse(await fs.readFile(RUNTIME_FILE, 'utf8')) as CalendarJob[];
  } catch (err) {
    // ENOENT คือยังไม่เคยมีงาน (ต่างจาก config ตรงที่ไม่มี seed) — ต้องแยกจาก
    // error อื่นทุกแบบ เช่นไฟล์ถูกตัดกลางคันเพราะ fs.writeFile ไม่ atomic แล้ว
    // โปรเซสถูก kill ระหว่างเขียน ถ้ากลืน error พวกนั้นเป็น [] เงียบ ๆ เหมือนกัน
    // createJob ครั้งถัดไปจะเขียนทับไฟล์เดิมด้วยอาเรย์ตัวเดียวโดยไม่มีสัญญาณเตือน
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function fileWrite(jobs: CalendarJob[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(RUNTIME_FILE, JSON.stringify(jobs, null, 2) + '\n', 'utf8');
}

// กฎกรองของ backend ไฟล์ — backend Mongo ใน listJobs() ประกอบ query object
// ที่ต้อง "พูดกฎเดียวกัน" นี้แยกกันคนละที่ (Mongo ใช้ $gte/$lte ระดับ query,
// ไม่เรียกฟังก์ชันนี้) สองจุดนี้จึงเพี้ยนกันได้เงียบ ๆ โดย tsc/lint จับไม่ได้
// — ดู jobs-store.test.ts ที่ตรึงพฤติกรรมของฟังก์ชันนี้ไว้เป็นข้อสอบเทียบ
export function matches(job: CalendarJob, filter: JobFilter): boolean {
  if (filter.status && job.status !== filter.status) return false;
  if (filter.month && !job.date.startsWith(filter.month)) return false;
  return true;
}

// ไล่เปรียบเทียบลงไปจนถึง id ซึ่งไม่ซ้ำกัน ทำให้ลำดับเป็น total order — Mongo
// ไม่รับประกันลำดับของเอกสารที่ sort key เท่ากันเป๊ะ (และลำดับนั้นเปลี่ยนได้
// ระหว่างการรัน query สองครั้ง เช่น plan เปลี่ยนหรือ storage ถูก compact) ส่วน
// Array.prototype.sort เสถียรมาตั้งแต่ ES2019 จึงคืนลำดับตามการสร้างเสมอ ถ้า
// เทียบไม่ครบถึง id งานสองงานเวลาเดียวกัน (เช่นรถส่งผู้ป่วย 06:00 สองคัน) จะ
// เรียงคงที่ตอน dev แต่เรียงไม่แน่นอนใน production — คนละพฤติกรรมที่ dev ทำซ้ำ
// ปัญหาไม่ได้เลย ต้องให้ Mongo sort ({ date: 1, time: 1, createdAt: 1, id: 1 })
// ใน listJobs() ไล่ถึงระดับเดียวกันนี้ด้วยเสมอ
export function bySchedule(a: CalendarJob, b: CalendarJob): number {
  return (
    a.date.localeCompare(b.date) ||
    a.time.localeCompare(b.time) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}

// ---- mongo backend ---------------------------------------------------------

let indexesEnsured = false;
let indexAttempts = 0;
// เพดานจำนวนครั้งที่ยอมลองใหม่ก่อนเลิกเงียบ ๆ — ความล้มเหลวชั่วคราว (เครือข่าย
// สะดุดตอน cold start) ควรลองใหม่ได้ แต่ความล้มเหลวถาวร (Atlas user ไม่มีสิทธิ์
// createIndex, หรือมี index ชื่อชนกันจากคนละ definition) ไม่มีทางหายเองด้วยการ
// retry เลย ถ้าไม่มีเพดาน ทุก listJobs/createJob จะเสีย round trip ที่ล้มเหลว
// และ log warning ไปตลอดอายุ process — นี่คือปัญหา deploy ที่ต้องแก้ที่ Atlas
// ไม่ใช่ retry แก้ได้
const MAX_INDEX_ATTEMPTS = 3;

// createIndex เป็น no-op เมื่อ index มีอยู่แล้ว จึงเรียกครั้งเดียวต่อ process
// ก็พอ (serverless cold start ใหม่ก็เรียกใหม่ ราคาถูกกว่าการมี migration แยก)
async function ensureIndexes(): Promise<void> {
  if (indexesEnsured || indexAttempts >= MAX_INDEX_ATTEMPTS) return;
  indexAttempts += 1;
  indexesEnsured = true;
  try {
    const db = await getDb();
    await db.collection(COLLECTION).createIndexes([
      { key: { date: 1 } },
      { key: { status: 1, date: 1 } },
      { key: { id: 1 }, unique: true },
    ]);
  } catch (err) {
    indexesEnsured = false; // ให้ลองใหม่ครั้งหน้า (จนกว่าจะครบเพดาน)
    console.warn(
      `calendarJobs: createIndexes failed (attempt ${indexAttempts}/${MAX_INDEX_ATTEMPTS})`,
      err
    );
  }
}

// ---- public API ------------------------------------------------------------

export async function listJobs(filter: JobFilter = {}): Promise<CalendarJob[]> {
  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;
    // เทียบสตริงได้ตรง ๆ เพราะ date เป็น 'YYYY-MM-DD' — ใช้ -31 เป็นขอบบนได้เสมอ
    // โดยไม่ต้องรู้ว่าเดือนนั้นมีกี่วัน
    if (filter.month) {
      query.date = { $gte: `${filter.month}-01`, $lte: `${filter.month}-31` };
    }
    return db
      .collection<CalendarJob>(COLLECTION)
      .find(query, { projection: { _id: 0 } })
      // ไล่ถึง id เพื่อให้เป็น total order เดียวกับ bySchedule() ของแบ็กเอนด์
      // ไฟล์ — ไม่งั้น Mongo จะคืนงานเวลาเดียวกันในลำดับที่ไม่แน่นอน
      .sort({ date: 1, time: 1, createdAt: 1, id: 1 })
      .toArray();
  }
  return (await fileRead()).filter((j) => matches(j, filter)).sort(bySchedule);
}

export async function getJob(id: string): Promise<CalendarJob | null> {
  if (usingMongo()) {
    const db = await getDb();
    return db
      .collection<CalendarJob>(COLLECTION)
      .findOne({ id }, { projection: { _id: 0 } });
  }
  return (await fileRead()).find((j) => j.id === id) ?? null;
}

/**
 * ประกอบงานใหม่จากอินพุตที่ผ่าน Zod แล้ว — แยกออกมาจาก createJob เพื่อให้เทสต์
 * ตรวจ "รูปร่างเอกสาร" ได้โดยไม่ต้องแตะ Mongo หรือไฟล์
 *
 * เขียนฟิลด์ที่ไม่บังคับทุกตัวเสมอ แม้เป็นสตริงว่าง — ห้ามตัดคีย์ทิ้ง เพราะ
 * updateJob เขียนครบทุกคีย์ผ่าน $set อยู่แล้ว ถ้าตรงนี้ตัดทิ้ง งานที่ไม่เคยมี
 * หมู่บ้านกับงานที่เคยมีแล้วลบออกจะมีรูปร่างต่างกันทั้งที่ความหมายเดียวกัน แล้ว
 * โค้ดที่ใช้ `??` หรือ `'village' in job` จะแสดงผลสองแบบ ('' คือค่า "ไม่มีข้อมูล"
 * — เดิมตามรอย lineGroupId ใน config-store.ts)
 */
export function buildNewJob(input: JobInput, createdBy: string): CalendarJob {
  return {
    id: crypto.randomUUID(),
    kind: input.kind,
    status: 'pending', // งานใหม่รออนุมัติเสมอ ไม่ว่าใครกรอก
    date: input.date,
    time: input.time,
    title: input.title,
    village: input.village,
    origin: input.origin,
    destination: input.destination,
    phone: input.phone,
    note: input.note,
    createdAt: new Date().toISOString(),
    createdBy,
  };
}

export async function createJob(
  input: JobInput,
  createdBy: string
): Promise<CalendarJob> {
  const job = buildNewJob(input, createdBy);

  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    // spread เพื่อไม่ให้ driver แปะ _id ลงบน object ที่เรากำลังจะคืนกลับไป
    await db.collection<CalendarJob>(COLLECTION).insertOne({ ...job });
  } else {
    const jobs = await fileRead();
    jobs.push(job);
    await fileWrite(jobs);
  }
  return job;
}

// ฟิลด์ audit ที่ตกยุคได้เมื่อ setJobStatus() เดินสถานะถอยหลัง (approved →
// pending, done → approved) — จำกัด union ให้เหลือแค่สี่ตัวนี้ (แทนที่จะเป็น
// keyof CalendarJob เฉย ๆ) เพื่อให้ `delete merged[key]` ใน patchJob() ผ่าน
// tsc strict: TypeScript ยอม delete เฉพาะ property ที่ optional เท่านั้น ฟิลด์
// บังคับอย่าง id/status/date จะหลุดเข้ามาไม่ได้แม้แต่ตอน type-check
type JobAuditField = 'decidedAt' | 'decidedBy' | 'doneAt' | 'doneBy';

async function patchJob(
  id: string,
  patch: Partial<CalendarJob>,
  clear: readonly JobAuditField[] = []
): Promise<CalendarJob | null> {
  if (usingMongo()) {
    const db = await getDb();
    // Mongo driver serialize ค่า undefined ใน $set เป็น BSON null เฉย ๆ
    // (ignoreUndefined ปิดอยู่โดยปริยาย — ดูคอมเมนต์เดียวกันใน config-store.ts
    // normalise()) ไม่ได้ลบคีย์ทิ้งเหมือนที่ optional string ของ CalendarJob
    // ควรจะเป็น จึงต้องใช้ $unset แยกต่างหากสำหรับฟิลด์ที่ต้องการ "ล้าง" จริง ๆ
    const update: UpdateFilter<CalendarJob> = {};
    if (Object.keys(patch).length > 0) update.$set = patch;
    if (clear.length > 0) {
      const unset: Partial<Record<JobAuditField, ''>> = {};
      for (const key of clear) unset[key] = '';
      update.$unset = unset;
    }
    const updated = await db
      .collection<CalendarJob>(COLLECTION)
      .findOneAndUpdate({ id }, update, {
        returnDocument: 'after',
        projection: { _id: 0 },
      });
    return updated ?? null;
  }
  const jobs = await fileRead();
  const index = jobs.findIndex((j) => j.id === id);
  if (index === -1) return null;
  const merged: CalendarJob = { ...jobs[index], ...patch };
  for (const key of clear) delete merged[key];
  jobs[index] = merged;
  await fileWrite(jobs);
  return jobs[index];
}

// ฟิลด์ที่ buildJobPatch เขียนทับ — ต้องเป็นชุดย่อยของคีย์ที่ buildNewJob สร้าง
// (มีเทสต์ผูกไว้ใน jobs-store.test.ts) เพื่อไม่ให้งานที่แก้แล้วมีรูปร่าง
// ต่างจากงานที่เพิ่งสร้าง
export const JOB_EDITABLE_FIELDS = [
  'kind',
  'date',
  'time',
  'title',
  'village',
  'origin',
  'destination',
  'phone',
  'note',
] as const satisfies readonly (keyof JobInput & keyof CalendarJob)[];

/**
 * ประกอบ patch ของ updateJob จากอินพุตที่ผ่าน Zod แล้ว — แยกออกมาเป็นฟังก์ชัน
 * บริสุทธิ์ด้วยเหตุผลเดียวกับ buildNewJob: ให้เทสต์เรียกตรง ๆ ได้โดยไม่ผ่าน
 * patchJob (ซึ่งมี I/O) จึงเทียบคีย์ที่เขียนจริงกับ JOB_EDITABLE_FIELDS และกับ
 * buildNewJob ได้โดยไม่ต้องแตะ Mongo หรือไฟล์
 *
 * เขียน object literal ตรง ๆ แทนที่จะวนลูปจาก JOB_EDITABLE_FIELDS: TypeScript
 * ตรวจ `patch[field] = input[field]` ในลูปไม่ผ่าน เพราะ field เป็น union ของ
 * คีย์หลายชนิด (เช่น 'kind': JobKind ปนกับ 'title': string) แล้ว TS เช็ค
 * ชนิดค่าแบบ union รวมทั้งก้อนแทนที่จะจับคู่ทีละคีย์
 */
export function buildJobPatch(input: JobInput): Partial<CalendarJob> {
  return {
    kind: input.kind,
    date: input.date,
    time: input.time,
    title: input.title,
    village: input.village,
    origin: input.origin,
    destination: input.destination,
    phone: input.phone,
    note: input.note,
  };
}

/** แก้เนื้อหางาน — ไม่แตะสถานะและไม่แตะ audit trail */
export async function updateJob(
  id: string,
  input: JobInput
): Promise<CalendarJob | null> {
  return patchJob(id, buildJobPatch(input));
}

/**
 * ประกอบ patch ของ setJobStatus จาก (from, to) ที่ผ่าน canTransition() แล้ว —
 * แยกออกมาเป็นฟังก์ชันบริสุทธิ์ด้วยเหตุผลเดียวกับ buildNewJob/buildJobPatch:
 * ให้เทสต์ครบทุกทรานซิชันที่อนุญาต (ดู ALLOWED ใน job-status.ts) ได้โดยไม่ต้อง
 * แตะ Mongo หรือไฟล์
 *
 * กติกา: สถานะปลายทาง (`next`) เป็นตัวกำหนดว่า stamp คู่ไหน "ยังใช้ได้จริง" —
 * เขียนทับคู่ที่ตรงกับปลายทางเสมอ (ประทับเวลา/ผู้ทำใหม่) ส่วนคู่ที่ไม่ตรงกับ
 * ปลายทางอีกต่อไปต้องถูกล้าง ไม่ใช่ปล่อยค้างจากทรานซิชันก่อนหน้า — เดิมโค้ด
 * ดูแค่ next แล้วเขียนคู่ที่ next ต้องการ แต่ไม่เคยล้างคู่ตรงข้ามเวลาทรานซิชัน
 * เดินถอยหลัง (approved → pending คือถอนอนุมัติ, done → approved คือเปิดงาน
 * ใหม่) ทำให้ audit trail โกหก: งานที่เพิ่งถอนอนุมัติยังโชว์ "ใครอนุมัติเมื่อไร"
 * งานที่เพิ่งเปิดใหม่ยังโชว์ "ใครปิดงานเมื่อไร" ทั้งที่ทั้งคู่ไม่จริงแล้ว (ดู I-3
 * ในรีวิวรอบสุดท้ายก่อน merge)
 *
 * รับ `from` เป็นพารามิเตอร์แทนที่จะอ่าน getJob(id) เองอีกรอบ เพราะผู้เรียก
 * เดียว (PATCH /api/admin/calendar/[id]) อ่านงานปัจจุบันมาเช็ค canTransition()
 * อยู่แล้วก่อนเรียกฟังก์ชันนี้ — อ่านซ้ำเสีย round trip เปล่า ๆ และเปิดช่องให้
 * สถานะที่ใช้ตัดสิน canTransition() กับสถานะที่ใช้ประทับ stamp ไม่ใช่ค่า
 * เดียวกันถ้ามีคำขออื่นแก้ job แทรกกลางระหว่างสองการอ่าน
 */
export function buildStatusPatch(
  from: JobStatus,
  next: JobStatus,
  actor: string,
  now: string
): { set: Partial<CalendarJob>; clear: readonly JobAuditField[] } {
  const set: Partial<CalendarJob> = { status: next };
  const clear: JobAuditField[] = [];

  // decidedAt/decidedBy คือ "การตัดสินใจล่าสุด" (อนุมัติหรือยกเลิก) — เขียนทับ
  // ทุกครั้งที่ลงเอยที่ approved หรือ cancelled ไม่ว่าจะมาจากไหน (แม้แต่
  // done → approved ก็นับเป็นการตัดสินใจใหม่ คือ "เปิดงานนี้กลับมา") ส่วน
  // ปลายทาง pending แปลว่า "ยังไม่เคยตัดสินใจ" เหมือนงานที่เพิ่งสร้างจาก
  // buildNewJob (ซึ่งไม่เคยเซ็ตสองฟิลด์นี้เลย) จึงต้องล้าง ไม่ว่าจะถอนอนุมัติ
  // (approved → pending) หรือกู้คืนงานที่ยกเลิกไปแล้ว (cancelled → pending) —
  // การตัดสินใจเดิมไม่มีผลกับสถานะ "รออนุมัติ" ใหม่นี้อีกต่อไป
  if (next === 'approved' || next === 'cancelled') {
    set.decidedAt = now;
    set.decidedBy = actor;
  } else if (next === 'pending') {
    clear.push('decidedAt', 'decidedBy');
  }

  // doneAt/doneBy มีความหมายเฉพาะตอนสถานะเป็น done เท่านั้น ทางเดียวที่จะออก
  // จาก done ได้คือ done → approved (เปิดงานใหม่) ต้องล้างสองฟิลด์นี้ ไม่งั้น
  // งานที่เพิ่งเปิดใหม่จะยังโชว์เวลา/คนปิดงานเดิมราวกับปิดไปแล้วจริง ๆ —
  // ทรานซิชันอื่นที่ไม่ได้มาจาก done ไม่ต้องแตะเพราะไม่มีทางมี doneAt ค้างอยู่
  // ตั้งแต่แรก (เข้า done ได้ทางเดียวคือ approved → done ซึ่งเซ็ตให้ตรงนี้เอง)
  if (next === 'done') {
    set.doneAt = now;
    set.doneBy = actor;
  } else if (from === 'done') {
    clear.push('doneAt', 'doneBy');
  }

  return { set, clear };
}

/**
 * เปลี่ยนสถานะพร้อมประทับว่าใครทำเมื่อไร และล้าง stamp ที่ตกยุคเมื่อทรานซิชัน
 * เดินถอยหลัง (ดู buildStatusPatch) — ผู้เรียกต้องตรวจ canTransition() มาก่อน
 * และรู้ค่า `from` อยู่แล้ว (เพราะต้องใช้เช็ค canTransition) ที่นี่ไม่ตัดสินใจ
 * แทน แค่ประกอบ patch จากคู่ (from, next) ที่ผู้เรียกยืนยันมาแล้วว่าอนุญาต
 */
export async function setJobStatus(
  id: string,
  from: JobStatus,
  next: JobStatus,
  actor: string
): Promise<CalendarJob | null> {
  const { set, clear } = buildStatusPatch(
    from,
    next,
    actor,
    new Date().toISOString()
  );
  return patchJob(id, set, clear);
}

export async function deleteJob(id: string): Promise<boolean> {
  if (usingMongo()) {
    const db = await getDb();
    const res = await db.collection<CalendarJob>(COLLECTION).deleteOne({ id });
    return res.deletedCount > 0;
  }
  const jobs = await fileRead();
  const remaining = jobs.filter((j) => j.id !== id);
  if (remaining.length === jobs.length) return false;
  await fileWrite(remaining);
  return true;
}
