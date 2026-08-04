import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { getDb, isMongoConfigured } from '@/lib/mongodb';
import type { JobInput } from '@/lib/schema';
import type { CalendarJob, JobStatus } from '@/types/portal';

// งานปฏิทินอยู่คนละที่กับ PortalConfig โดยตั้งใจ: config เป็นเอกสารก้อนเดียวที่
// ทุก mutation เขียนทับทั้งก้อนแล้ว bump version ส่วนงานโตไม่จำกัดและแก้บ่อย
// ถ้ายัดรวมจะชนเพดาน 16MB ของ Mongo document และทำ version พุ่งโดยเปล่าประโยชน์
//
// แบ็กเอนด์เหมือน config-store: Mongo เมื่อมี MONGODB_URI ไม่งั้นใช้ไฟล์ในเครื่อง
// (Vercel/Railway filesystem เป็น read-only ตอน runtime — production ต้องใช้ Mongo)

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
  } catch {
    return []; // ยังไม่เคยมีงาน — ต่างจาก config ตรงที่ไม่มี seed
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

export function bySchedule(a: CalendarJob, b: CalendarJob): number {
  return a.date === b.date
    ? a.time.localeCompare(b.time)
    : a.date.localeCompare(b.date);
}

// ---- mongo backend ---------------------------------------------------------

let indexesEnsured = false;

// createIndex เป็น no-op เมื่อ index มีอยู่แล้ว จึงเรียกครั้งเดียวต่อ process
// ก็พอ (serverless cold start ใหม่ก็เรียกใหม่ ราคาถูกกว่าการมี migration แยก)
async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    const db = await getDb();
    await db.collection(COLLECTION).createIndexes([
      { key: { date: 1 } },
      { key: { status: 1, date: 1 } },
      { key: { id: 1 }, unique: true },
    ]);
  } catch (err) {
    indexesEnsured = false; // ให้ลองใหม่ครั้งหน้า
    console.warn('calendarJobs: createIndexes failed', err);
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
      .sort({ date: 1, time: 1 })
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

export async function createJob(
  input: JobInput,
  createdBy: string
): Promise<CalendarJob> {
  const job: CalendarJob = {
    id: crypto.randomUUID(),
    kind: input.kind,
    status: 'pending', // งานใหม่รออนุมัติเสมอ ไม่ว่าใครกรอก
    date: input.date,
    time: input.time,
    title: input.title,
    ...(input.village ? { village: input.village } : {}),
    ...(input.origin ? { origin: input.origin } : {}),
    ...(input.destination ? { destination: input.destination } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.note ? { note: input.note } : {}),
    createdAt: new Date().toISOString(),
    createdBy,
  };

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

async function patchJob(
  id: string,
  patch: Partial<CalendarJob>
): Promise<CalendarJob | null> {
  if (usingMongo()) {
    const db = await getDb();
    const updated = await db
      .collection<CalendarJob>(COLLECTION)
      .findOneAndUpdate(
        { id },
        { $set: patch },
        { returnDocument: 'after', projection: { _id: 0 } }
      );
    return updated ?? null;
  }
  const jobs = await fileRead();
  const index = jobs.findIndex((j) => j.id === id);
  if (index === -1) return null;
  jobs[index] = { ...jobs[index], ...patch };
  await fileWrite(jobs);
  return jobs[index];
}

/** แก้เนื้อหางาน — ไม่แตะสถานะและไม่แตะ audit trail */
export async function updateJob(
  id: string,
  input: JobInput
): Promise<CalendarJob | null> {
  return patchJob(id, {
    kind: input.kind,
    date: input.date,
    time: input.time,
    title: input.title,
    village: input.village,
    origin: input.origin,
    destination: input.destination,
    phone: input.phone,
    note: input.note,
  });
}

/**
 * เปลี่ยนสถานะพร้อมประทับว่าใครทำเมื่อไร
 * ผู้เรียกต้องตรวจ canTransition() มาก่อน — ที่นี่ไม่ตัดสินใจแทน
 */
export async function setJobStatus(
  id: string,
  next: JobStatus,
  actor: string
): Promise<CalendarJob | null> {
  const now = new Date().toISOString();
  const patch: Partial<CalendarJob> = { status: next };
  if (next === 'approved' || next === 'cancelled') {
    patch.decidedAt = now;
    patch.decidedBy = actor;
  }
  if (next === 'done') {
    patch.doneAt = now;
    patch.doneBy = actor;
  }
  return patchJob(id, patch);
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
