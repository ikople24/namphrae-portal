// src/lib/saraban-store.ts
// หนังสือของสารบรรณ — Mongo `sarabanDocs` + `sarabanYears` | ไฟล์ใน data/ (สเปกข้อ 3–4)
//
// ส่วนบนเป็นฟังก์ชันบริสุทธิ์ของการออกเลข แยกไว้ให้เทสต์ได้โดยไม่ต้องมี Mongo (repo ไม่มี DB
// ในเทสต์) ส่วน I/O อยู่ถัดลงไป

import crypto from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { getDb, isMongoConfigured } from '@/lib/mongodb';
import { cacheUntilRejected } from '@/lib/promise-cache';
import { MAX_FILES_PER_DOC } from '@/lib/saraban-attachment';
import {
  buildNewDoc,
  canAddFile,
  canRemoveFile,
  matches,
  OPEN_STATUSES,
  REGISTER_VIEWS,
  toMongoQuery,
  type Actor,
  type DocFilter,
  type EditableField,
  type NewDocFields,
  type RegisterView,
} from '@/lib/saraban-doc';
import { readJsonArray, writeJsonArray } from '@/lib/saraban-file';
import { bangkokDateOf, fiscalYearOf, nextNo } from '@/lib/saraban-number';
import type {
  SarabanDoc,
  SarabanEvent,
  SarabanFile,
  SarabanRegister,
  SarabanYear,
} from '@/types/saraban';

export const MAX_NUMBER_ATTEMPTS = 5;

/** ออกเลขชนครบเพดาน — route ตอบ 503 number_busy ให้ผู้ใช้กดใหม่ */
export class NumberBusyError extends Error {
  constructor() {
    super('number_busy');
    this.name = 'NumberBusyError';
  }
}

/**
 * index ไหนทำให้ insert ชน
 *   'no'  = เลขทะเบียนชน (อีกคนได้เลขนี้ไปก่อน) → ลองเลขถัดไป
 *   'id'  = id ชน (คำขอเดิมถูกส่งซ้ำ) → idempotency ไม่ใช่ออกเลขใหม่
 *   null  = ไม่ใช่ duplicate key หรือบอกไม่ได้ว่าชนตัวไหน → ผู้เรียกโยนต่อ (500 ดัง ๆ)
 */
export function duplicateKeyOf(err: unknown): 'no' | 'id' | null {
  const e = err as { code?: unknown; keyPattern?: Record<string, unknown> } | null;
  if (e?.code !== 11000 || !e.keyPattern) return null;
  if ('no' in e.keyPattern) return 'no';
  if ('id' in e.keyPattern) return 'id';
  return null;
}

/**
 * ลอง attempt จนสำเร็จ ลองใหม่เฉพาะเมื่อ isCollision บอกว่าชน ครบ max ครั้งแล้วโยน
 * NumberBusyError — attempt ต้องอ่าน max(no) ใหม่ทุกครั้ง ไม่งั้นลองกี่รอบก็ชนเลขเดิม
 *
 * ทำไมไม่ใช้ตัวนับ $inc: ถ้า $inc สำเร็จแต่ insert ล้ม เลขหายหนึ่งเลข ทะเบียนมีรูที่ดูเหมือน
 * หนังสือถูกลบ และ repo ไม่มี transaction — แบบนี้ถ้า insert ล้ม เลขนั้นยังไม่เคยถูกใช้
 */
export async function issueWithRetry<T>(
  attempt: () => Promise<T>,
  isCollision: (err: unknown) => boolean,
  max: number = MAX_NUMBER_ATTEMPTS
): Promise<T> {
  for (let tries = 1; ; tries += 1) {
    try {
      return await attempt();
    } catch (err) {
      if (!isCollision(err)) throw err;
      if (tries >= max) throw new NumberBusyError();
    }
  }
}

// ---- ที่เก็บ --------------------------------------------------------------

const DOCS = 'sarabanDocs';
const YEARS = 'sarabanYears';
const DOCS_FILE = 'saraban-docs.json';
const YEARS_FILE = 'saraban-years.json';
export const PAGE_SIZE = 50;

type YearRow = SarabanYear & { _id: string };

function yearKey(register: SarabanRegister, fiscalYear: number): string {
  return `${register}-${fiscalYear}`;
}

async function docsCollection(): Promise<Collection<SarabanDoc>> {
  return (await getDb()).collection<SarabanDoc>(DOCS);
}

async function yearsCollection(): Promise<Collection<YearRow>> {
  return (await getDb()).collection<YearRow>(YEARS);
}

async function readDocs(): Promise<SarabanDoc[]> {
  return readJsonArray<SarabanDoc>(DOCS_FILE);
}

/** ใหม่สุดก่อน — ปีงบมากไปน้อย แล้วเลขมากไปน้อย (คู่นี้ไม่ซ้ำภายในทะเบียนเดียว = total order) */
export function byNewest(a: SarabanDoc, b: SarabanDoc): number {
  return b.fiscalYear - a.fiscalYear || b.no - a.no;
}

let indexes: Promise<void> | undefined;

/**
 * index ของหนังสือ — ต่างจาก jobs-store โดยตั้งใจ: ที่นั่นกลืน error ของ createIndexes แล้ว
 * ทำงานต่อ ที่นี่ห้าม เพราะ unique index บน (register, fiscalYear, no) คือสิ่งเดียวที่ทำให้
 * เลขทะเบียนซ้ำเป็นไปไม่ได้ ถ้าสร้างไม่สำเร็จแล้วยังออกเลขต่อ สองคนที่ลงรับพร้อมกันจะได้
 * เลขเดียวกันโดยไม่มีอะไรเตือน — createDoc จึง await ตัวนี้แล้วล้มตาม (500)
 *
 * cacheUntilRejected: สำเร็จแล้วไม่สร้างซ้ำ ล้มแล้วคำขอถัดไปลองใหม่ ไม่ค้าง rejected ไว้
 * ตลอดอายุ process · อ่านทะเบียนไม่ต้องรอ index (ดูทะเบียนได้แม้ออกเลขไม่ได้)
 */
function ensureIndexes(): Promise<void> {
  return cacheUntilRejected(
    () => indexes,
    (value) => {
      indexes = value;
    },
    async () => {
      const col = await docsCollection();
      await col.createIndexes([
        { key: { register: 1, fiscalYear: 1, no: 1 }, unique: true, name: 'register_year_no_unique' },
        { key: { id: 1 }, unique: true, name: 'id_unique' },
        { key: { register: 1, fiscalYear: 1, status: 1, dueDate: 1 } },
      ]);
    }
  );
}

// ---- อ่าน ------------------------------------------------------------------

export async function getDoc(id: string): Promise<SarabanDoc | null> {
  if (isMongoConfigured()) {
    return (await docsCollection()).findOne({ id }, { projection: { _id: 0 } });
  }
  return (await readDocs()).find((doc) => doc.id === id) ?? null;
}

export async function listDocs(
  filter: DocFilter,
  page: number,
  today: string
): Promise<{ docs: SarabanDoc[]; total: number }> {
  const skip = (page - 1) * PAGE_SIZE;
  if (isMongoConfigured()) {
    const col = await docsCollection();
    const query = toMongoQuery(filter, today) as Filter<SarabanDoc>;
    const [docs, total] = await Promise.all([
      col
        .find(query, { projection: { _id: 0 } })
        .sort({ fiscalYear: -1, no: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .toArray(),
      col.countDocuments(query),
    ]);
    return { docs, total };
  }
  const all = (await readDocs()).filter((doc) => matches(doc, filter, today)).sort(byNewest);
  return { docs: all.slice(skip, skip + PAGE_SIZE), total: all.length };
}

/** นับอย่างเดียว ไม่ดึงตัวหนังสือออกมา — badge เรียกจากทุกหน้า (แนว countJobs) */
export async function countDocs(filter: DocFilter, today: string): Promise<number> {
  if (isMongoConfigured()) {
    return (await docsCollection()).countDocuments(
      toMongoQuery(filter, today) as Filter<SarabanDoc>
    );
  }
  return (await readDocs()).filter((doc) => matches(doc, filter, today)).length;
}

/** ตัวเลขบนปุ่มกรองทุกปุ่มของทะเบียน + ปีงบหนึ่ง */
export async function registerCounts(
  register: SarabanRegister,
  fiscalYear: number,
  today: string
): Promise<Record<RegisterView, number>> {
  const counts = await Promise.all(
    REGISTER_VIEWS.map((view) => countDocs({ register, fiscalYear, view }, today))
  );
  return Object.fromEntries(REGISTER_VIEWS.map((view, i) => [view, counts[i]])) as Record<
    RegisterView,
    number
  >;
}

/** ปีงบที่มีหนังสือของทะเบียนนี้ + ปีปัจจุบันเสมอ (ปีใหม่ที่ยังว่างต้องเลือกได้) — มากไปน้อย */
export async function listFiscalYears(
  register: SarabanRegister,
  currentYear: number
): Promise<number[]> {
  const years = isMongoConfigured()
    ? await (await docsCollection()).distinct('fiscalYear', { register })
    : (await readDocs()).filter((doc) => doc.register === register).map((doc) => doc.fiscalYear);
  return [...new Set([...years, currentYear])].sort((a, b) => b - a);
}

// ---- เลขเริ่มต้นและข้อมูลของปี ---------------------------------------------

async function maxNoOf(register: SarabanRegister, fiscalYear: number): Promise<number | null> {
  if (isMongoConfigured()) {
    // ใช้ unique index (register, fiscalYear, no) ตัวเดียวกับที่กันเลขซ้ำ — ไม่ต้องสแกนทั้งปี
    const top = await (await docsCollection())
      .find({ register, fiscalYear }, { projection: { no: 1, _id: 0 } })
      .sort({ no: -1 })
      .limit(1)
      .next();
    return top?.no ?? null;
  }
  const nos = (await readDocs())
    .filter((doc) => doc.register === register && doc.fiscalYear === fiscalYear)
    .map((doc) => doc.no);
  return nos.length > 0 ? Math.max(...nos) : null;
}

async function startNoOf(register: SarabanRegister, fiscalYear: number): Promise<number | null> {
  if (isMongoConfigured()) {
    const row = await (await yearsCollection()).findOne({ _id: yearKey(register, fiscalYear) });
    return row?.startNo ?? null;
  }
  const rows = await readJsonArray<SarabanYear>(YEARS_FILE);
  return rows.find((r) => r.register === register && r.fiscalYear === fiscalYear)?.startNo ?? null;
}

export type YearInfo = {
  register: SarabanRegister;
  fiscalYear: number;
  count: number;
  startNo: number | null;
  nextNo: number;
};

/** สถานะของปี — หน้าลงรับใช้แสดง "เลขรับถัดไป" (เป็นการคาดเดา ดูสเปกข้อ 6) และตัดสินว่า
 *  จะแสดงลิงก์ตั้งเลขเริ่มต้นไหม (count === 0) */
export async function getYearInfo(register: SarabanRegister, fiscalYear: number): Promise<YearInfo> {
  const [count, max, startNo] = await Promise.all([
    countDocs({ register, fiscalYear }, bangkokDateOf(new Date())),
    maxNoOf(register, fiscalYear),
    startNoOf(register, fiscalYear),
  ]);
  return { register, fiscalYear, count, startNo, nextNo: nextNo(max, startNo) };
}

/**
 * ตั้งเลขเริ่มต้นของปี — ได้เฉพาะเมื่อปีนั้นยังไม่มีหนังสือเลย (สเปกข้อ 4)
 *
 * เช็คแล้วค่อยเขียน ไม่ atomic — ถ้ามีคนลงรับแทรกระหว่างสองขั้น เลขยังไม่ซ้ำและไม่มีรู
 * (nextNo() ใช้ startNo เฉพาะตอนปีนั้นยังว่าง มีหนังสือแล้วใช้ max+1) แต่หนังสือเรื่องแรกได้เลข 1
 * แทนเลขต่อจากทะเบียนกระดาษ ขณะที่หน้าจอยังได้ 'ok' — ยอมรับได้เพราะในทางปฏิบัติคนตั้งเลข
 * เริ่มต้นกับคนลงรับเรื่องแรกคือธุรการคนเดียวกัน และ "เลขรับถัดไป" บนหน้าลงรับเผยให้เห็นทันที
 */
export async function setStartNo(
  register: SarabanRegister,
  fiscalYear: number,
  startNo: number,
  actor: Actor
): Promise<'ok' | 'year_in_use'> {
  const info = await getYearInfo(register, fiscalYear);
  if (info.count > 0) return 'year_in_use';
  const row: SarabanYear = {
    register,
    fiscalYear,
    startNo,
    setAt: new Date().toISOString(),
    setBy: actor.id,
  };
  if (isMongoConfigured()) {
    await (await yearsCollection()).updateOne(
      { _id: yearKey(register, fiscalYear) },
      { $set: row },
      { upsert: true }
    );
  } else {
    const rows = (await readJsonArray<SarabanYear>(YEARS_FILE)).filter(
      (r) => !(r.register === register && r.fiscalYear === fiscalYear)
    );
    rows.push(row);
    await writeJsonArray(YEARS_FILE, rows);
  }
  return 'ok';
}

// ---- ลงรับ / ออกเลข --------------------------------------------------------

export type CreateDocArgs = {
  id: string; // uuid จาก client — idempotency key
  fields: NewDocFields;
  /** ส่ง/เวียน: ประกอบ "ที่" จากเลข ถูกเรียกใหม่ทุกครั้งที่ลองเลขใหม่ · รับ: ไม่ใส่ ใช้ fields.ref */
  refFor?: (no: number) => string;
  files: SarabanFile[]; // ผ่าน checkAttachment มาแล้ว
  actor: Actor;
  eventNote: string;
};

export type CreateDocResult =
  | { ok: true; doc: SarabanDoc; created: boolean }
  | { ok: false; error: 'id_conflict' | 'number_busy' };

/** id นี้เคยถูกใช้แล้ว: คนเดิม = คืนหนังสือเดิม · คนอื่น = id_conflict · ยังไม่มี = null */
async function replayOf(id: string, actor: Actor): Promise<CreateDocResult | null> {
  const existing = await getDoc(id);
  if (!existing) return null;
  return existing.registeredBy === actor.id
    ? { ok: true, doc: existing, created: false }
    : { ok: false, error: 'id_conflict' };
}

/**
 * ออกเลขและบันทึกหนังสือใหม่ (สเปกข้อ 4)
 * 1. idempotency: id เดิมของคนเดิม → คืนหนังสือเดิม ไม่ออกเลขที่สอง
 * 2. ปีงบคิดจากวันที่ลงรับตามเวลากรุงเทพฯ ไม่ใช่ docDate
 * 3. max+1 (หรือเลขเริ่มต้นถ้าปีนั้นยังว่าง) แล้ว insert — ชน unique index ก็ลองเลขถัดไป
 */
export async function createDoc(args: CreateDocArgs): Promise<CreateDocResult> {
  const replay = await replayOf(args.id, args.actor);
  if (replay) return replay;

  const now = new Date();
  const fiscalYear = fiscalYearOf(bangkokDateOf(now));
  const { register } = args.fields;

  const build = (no: number): SarabanDoc =>
    buildNewDoc(
      { ...args.fields, ref: args.refFor ? args.refFor(no) : args.fields.ref },
      {
        id: args.id,
        fiscalYear,
        no,
        files: args.files,
        actor: args.actor,
        now: now.toISOString(),
        eventId: crypto.randomUUID(),
        eventNote: args.eventNote,
      }
    );

  const pickNo = async (): Promise<number> => {
    const max = await maxNoOf(register, fiscalYear);
    return nextNo(max, max === null ? await startNoOf(register, fiscalYear) : null);
  };

  try {
    if (isMongoConfigured()) {
      await ensureIndexes(); // ล้ม = ไม่ออกเลข (ดูคอมเมนต์ ensureIndexes)
      const col = await docsCollection();
      const doc = await issueWithRetry(
        async () => {
          const candidate = build(await pickNo());
          // spread เพื่อไม่ให้ driver แปะ _id ลงบน object ที่คืนกลับไป
          await col.insertOne({ ...candidate });
          return candidate;
        },
        (err) => duplicateKeyOf(err) === 'no'
      );
      return { ok: true, doc, created: true };
    }
    // แบ็กเอนด์ไฟล์: อ่าน-แก้-เขียน ไม่มี lock (dev คนเดียว ดู saraban-file.ts)
    const doc = build(await pickNo());
    const docs = await readDocs();
    docs.push(doc);
    await writeJsonArray(DOCS_FILE, docs);
    return { ok: true, doc, created: true };
  } catch (err) {
    if (err instanceof NumberBusyError) return { ok: false, error: 'number_busy' };
    // สองคำขอของ id เดียวกันผ่าน replayOf มาพร้อมกัน — ตัวที่สองชน id_unique ตอน insert
    if (duplicateKeyOf(err) === 'id') {
      const late = await replayOf(args.id, args.actor);
      if (late) return late;
    }
    throw err;
  }
}

// ---- แก้ไข / เปลี่ยนสถานะ / ไฟล์แนบ ----------------------------------------

/** ช่องที่ applyPatch เขียนได้ — ผลของ buildEdit() หรือ Transition.set เท่านั้น */
export type DocSet = Partial<Pick<SarabanDoc, EditableField | 'status' | 'voidReason' | 'sendMethod'>>;

/**
 * เขียน set + ต่อ event หนึ่งตัว เฉพาะเมื่อ updatedAt ใน DB ยังตรงกับที่หน้าจอเห็น
 * (optimistic concurrency) — event.at กลายเป็น updatedAt ใหม่
 * คืน null เมื่อไม่พบหรือมีคนแก้ไปก่อน ผู้เรียกแยกสองกรณีด้วย getDoc (404 vs 409)
 */
export async function applyPatch(
  id: string,
  expectedUpdatedAt: string,
  set: DocSet,
  event: SarabanEvent
): Promise<SarabanDoc | null> {
  if (isMongoConfigured()) {
    return (await docsCollection()).findOneAndUpdate(
      { id, updatedAt: expectedUpdatedAt },
      { $set: { ...set, updatedAt: event.at }, $push: { events: event } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  }
  const docs = await readDocs();
  const index = docs.findIndex((doc) => doc.id === id && doc.updatedAt === expectedUpdatedAt);
  if (index === -1) return null;
  docs[index] = {
    ...docs[index],
    ...set,
    updatedAt: event.at,
    events: [...docs[index].events, event],
  };
  await writeJsonArray(DOCS_FILE, docs);
  return docs[index];
}

/**
 * ต่อไฟล์แนบ — เงื่อนไข "ยังไม่ยกเลิก" (canAddFile) และ "ยังไม่ครบเพดาน" อยู่ใน filter ของ
 * update เดียว ($expr นับขนาดอาร์เรย์) ไม่ใช่อ่านมานับแล้วค่อยเขียน สองคนแนบพร้อมกันจึงไม่
 * ทะลุเพดาน · คืน null = ไม่พบ ยกเลิกแล้ว หรือครบเพดาน
 */
export async function addFile(
  id: string,
  file: SarabanFile,
  event: SarabanEvent
): Promise<SarabanDoc | null> {
  if (isMongoConfigured()) {
    return (await docsCollection()).findOneAndUpdate(
      { id, status: { $ne: 'void' }, $expr: { $lt: [{ $size: '$files' }, MAX_FILES_PER_DOC] } },
      { $push: { files: file, events: event }, $set: { updatedAt: event.at } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  }
  const docs = await readDocs();
  const index = docs.findIndex(
    (doc) => doc.id === id && canAddFile(doc) && doc.files.length < MAX_FILES_PER_DOC
  );
  if (index === -1) return null;
  docs[index] = {
    ...docs[index],
    files: [...docs[index].files, file],
    events: [...docs[index].events, event],
    updatedAt: event.at,
  };
  await writeJsonArray(DOCS_FILE, docs);
  return docs[index];
}

/**
 * เอาไฟล์แนบออกจากหนังสือ — เฉพาะหนังสือที่ยังเปิดอยู่ (canRemoveFile)
 * การลบไฟล์บน Cloudinary เป็นหน้าที่ของ route **หลัง** คำสั่งนี้สำเร็จเท่านั้น: ถ้าลบบน
 * Cloudinary ก่อนแล้วตรงนี้ล้ม DB จะชี้ไปหาไฟล์ที่ไม่มีแล้ว (ลบทีหลังแล้วพลาด = ไฟล์กำพร้า
 * หนึ่งไฟล์ ซึ่งเสียหายน้อยกว่า)
 */
export async function removeFile(
  id: string,
  fileId: string,
  event: SarabanEvent
): Promise<SarabanDoc | null> {
  if (isMongoConfigured()) {
    return (await docsCollection()).findOneAndUpdate(
      { id, status: { $in: [...OPEN_STATUSES] }, 'files.id': fileId },
      { $pull: { files: { id: fileId } }, $push: { events: event }, $set: { updatedAt: event.at } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  }
  const docs = await readDocs();
  const index = docs.findIndex(
    (doc) => doc.id === id && canRemoveFile(doc) && doc.files.some((f) => f.id === fileId)
  );
  if (index === -1) return null;
  docs[index] = {
    ...docs[index],
    files: docs[index].files.filter((f) => f.id !== fileId),
    events: [...docs[index].events, event],
    updatedAt: event.at,
  };
  await writeJsonArray(DOCS_FILE, docs);
  return docs[index];
}
