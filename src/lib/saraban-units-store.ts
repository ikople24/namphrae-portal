// src/lib/saraban-units-store.ts
// สมุดผู้รับของสารบรรณ (ตำแหน่ง/หน่วยงาน) — Mongo `sarabanUnits` | ไฟล์ data/saraban-units.json
//
// seed ใช้ครั้งแรกเท่านั้น (ยังว่าง) หลังจากนั้นฐานข้อมูลคือความจริง — บทเรียนเดียวกับ
// forest-registry.ts: ถ้าให้ seed เป็นความจริง วันที่เจ้าหน้าที่แก้ชื่อหรือรหัสส่วนราชการ
// ผ่านหน้าเว็บแล้วมีคนรัน seed ซ้ำ ของที่แก้จะหาย
//
// ไม่มีฟังก์ชันลบโดยตั้งใจ — หนังสืออ้าง holderUnitId อยู่ ปิดด้วย isActive แทน

import crypto from 'node:crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { Collection } from 'mongodb';
import { getDb, isMongoConfigured } from '@/lib/mongodb';
import { cacheUntilRejected } from '@/lib/promise-cache';
import { DATA_DIR, readJsonArray, writeJsonArray } from '@/lib/saraban-file';
import type { UnitInput, UnitPatch } from '@/lib/saraban-schema';
import type { SarabanUnit } from '@/types/saraban';

const COLLECTION = 'sarabanUnits';
const RUNTIME_FILE = 'saraban-units.json';
const SEED_FILE = path.join(DATA_DIR, 'saraban-units.seed.json');

async function readSeed(): Promise<SarabanUnit[]> {
  return JSON.parse(await fs.readFile(SEED_FILE, 'utf8')) as SarabanUnit[];
}

/** เรียงตามลำดับที่ตั้ง → ชื่อ → id — ไล่ถึง id ให้สองแบ็กเอนด์เรียงเหมือนกันเสมอ */
export function byUnitOrder(a: SarabanUnit, b: SarabanUnit): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'th') || a.id.localeCompare(b.id);
}

// zod .partial() ไม่ใส่คีย์ที่ไม่ได้ส่งมาอยู่แล้ว แต่กันอีกชั้น: Mongo driver serialize
// undefined ใน $set เป็น null ไม่ใช่ข้ามคีย์ (ดูคอมเมนต์ normalise() ใน config-store.ts)
function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

// ---- mongo ---------------------------------------------------------------

async function unitsCollection(): Promise<Collection<SarabanUnit>> {
  return (await getDb()).collection<SarabanUnit>(COLLECTION);
}

let seeded: Promise<void> | undefined;

/**
 * seed ครั้งเดียวต่อ process เมื่อ collection ว่าง — upsert ทีละตัวด้วย $setOnInsert บน
 * unique index ของ id สอง request แรกที่มาพร้อมกันจึงไม่ได้สมุดซ้ำสองชุด
 *
 * createUnit/updateUnit เรียกตัวนี้ก่อนด้วย: ถ้าหน่วยแรกถูกสร้างก่อนมีใครอ่านสมุด collection
 * จะไม่ว่างแล้ว seed จะไม่มีวันถูกใส่
 */
function ensureSeeded(): Promise<void> {
  return cacheUntilRejected(
    () => seeded,
    (value) => {
      seeded = value;
    },
    async () => {
      const col = await unitsCollection();
      await col.createIndex({ id: 1 }, { unique: true });
      if ((await col.countDocuments({}, { limit: 1 })) > 0) return;
      const seed = await readSeed();
      await col.bulkWrite(
        seed.map(({ id, ...rest }) => ({
          updateOne: { filter: { id }, update: { $setOnInsert: rest }, upsert: true },
        })),
        { ordered: false }
      );
    }
  );
}

// ---- file ----------------------------------------------------------------

async function fileRead(): Promise<SarabanUnit[]> {
  return readJsonArray<SarabanUnit>(RUNTIME_FILE, async () => {
    const seed = await readSeed();
    await writeJsonArray(RUNTIME_FILE, seed);
    return seed;
  });
}

// ---- public API ----------------------------------------------------------

export async function listUnits(): Promise<SarabanUnit[]> {
  if (isMongoConfigured()) {
    await ensureSeeded();
    const col = await unitsCollection();
    const units = await col.find({}, { projection: { _id: 0 } }).toArray();
    return units.sort(byUnitOrder);
  }
  return (await fileRead()).sort(byUnitOrder);
}

/** สมุดมีหลักสิบรายการ — อ่านทั้งหมดแล้วหาเอา ง่ายกว่าและได้ seed ทางเดียวกับ listUnits */
export async function getUnit(id: string): Promise<SarabanUnit | null> {
  return (await listUnits()).find((unit) => unit.id === id) ?? null;
}

export async function createUnit(input: UnitInput): Promise<SarabanUnit> {
  const unit: SarabanUnit = {
    id: crypto.randomUUID(),
    name: input.name,
    dept: input.dept,
    refCode: input.refCode,
    order: input.order,
    isActive: input.isActive,
    memberClerkIds: [],
  };
  if (isMongoConfigured()) {
    await ensureSeeded();
    // spread เพื่อไม่ให้ driver แปะ _id ลงบน object ที่คืนกลับไป (แนวเดียวกับ jobs-store)
    await (await unitsCollection()).insertOne({ ...unit });
  } else {
    const units = await fileRead();
    units.push(unit);
    await writeJsonArray(RUNTIME_FILE, units);
  }
  return unit;
}

export async function updateUnit(id: string, patch: UnitPatch): Promise<SarabanUnit | null> {
  const set = definedOnly(patch);
  if (isMongoConfigured()) {
    await ensureSeeded();
    return (await unitsCollection()).findOneAndUpdate(
      { id },
      { $set: set },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  }
  const units = await fileRead();
  const index = units.findIndex((unit) => unit.id === id);
  if (index === -1) return null;
  units[index] = { ...units[index], ...set };
  await writeJsonArray(RUNTIME_FILE, units);
  return units[index];
}
