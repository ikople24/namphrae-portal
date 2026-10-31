// src/lib/file-library-store.ts
// รายการของคลังไฟล์ — Mongo `fileLibrary` | ไฟล์ data/file-library.json (dev fallback) — SERVER ONLY
// แบ็กเอนด์ไฟล์ใช้ readJsonArray/writeJsonArray ของสารบรรณ ซึ่งปฏิเสธตัวเองตอน production ที่ไม่มี
// MONGODB_URI (filesystem ของ Railway ไม่คงอยู่ข้าม deploy) — ไม่มี lock เหมือน saraban-file.ts

import type { Collection, Filter } from 'mongodb';
import { getDb, isMongoConfigured } from '@/lib/mongodb';
import { cacheUntilRejected } from '@/lib/promise-cache';
import { escapeRegex, matchesQuery, newestFirst, PAGE_SIZE, toListItem } from '@/lib/file-library';
import { readJsonArray, writeJsonArray } from '@/lib/saraban-file';
import type { LibraryFile, LibraryListItem } from '@/types/file-library';

const COLLECTION = 'fileLibrary';
const RUNTIME_FILE = 'file-library.json';

// ---- mongo ---------------------------------------------------------------

let indexed: Promise<void> | undefined;

async function filesCollection(): Promise<Collection<LibraryFile>> {
  const col = (await getDb()).collection<LibraryFile>(COLLECTION);
  await cacheUntilRejected(
    () => indexed,
    (value) => {
      indexed = value;
    },
    async () => {
      await col.createIndex({ id: 1 }, { unique: true });
      await col.createIndex({ uploadedAt: -1, id: -1 });
    }
  );
  return col;
}

// ---- file ----------------------------------------------------------------

function fileRead(): Promise<LibraryFile[]> {
  return readJsonArray<LibraryFile>(RUNTIME_FILE);
}

// ---- public API ----------------------------------------------------------

export async function listFiles(
  q: string,
  page: number
): Promise<{ items: LibraryListItem[]; total: number }> {
  const skip = (page - 1) * PAGE_SIZE;
  if (isMongoConfigured()) {
    const col = await filesCollection();
    const filter: Filter<LibraryFile> = q
      ? { title: { $regex: escapeRegex(q), $options: 'i' } }
      : {};
    const [docs, total] = await Promise.all([
      col
        .find(filter, { projection: { _id: 0 } })
        .sort({ uploadedAt: -1, id: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .toArray(),
      col.countDocuments(filter),
    ]);
    return { items: docs.map(toListItem), total };
  }
  const matched = (await fileRead()).filter((f) => matchesQuery(f.title, q)).sort(newestFirst);
  return { items: matched.slice(skip, skip + PAGE_SIZE).map(toListItem), total: matched.length };
}

export async function getFile(id: string): Promise<LibraryFile | null> {
  if (isMongoConfigured()) {
    return (await filesCollection()).findOne({ id }, { projection: { _id: 0 } });
  }
  return (await fileRead()).find((f) => f.id === id) ?? null;
}

export async function insertFile(file: LibraryFile): Promise<void> {
  if (isMongoConfigured()) {
    // spread เพื่อไม่ให้ driver แปะ _id ลงบน object ของผู้เรียก (แนวเดียวกับ saraban-units-store)
    await (await filesCollection()).insertOne({ ...file });
    return;
  }
  const rows = await fileRead();
  rows.push(file);
  await writeJsonArray(RUNTIME_FILE, rows);
}

/** null = ไม่พบ */
export async function renameFile(id: string, title: string): Promise<LibraryFile | null> {
  if (isMongoConfigured()) {
    return (await filesCollection()).findOneAndUpdate(
      { id },
      { $set: { title } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  }
  const rows = await fileRead();
  const row = rows.find((f) => f.id === id);
  if (!row) return null;
  row.title = title;
  await writeJsonArray(RUNTIME_FILE, rows);
  return row;
}

/** คืนรายการที่ลบ (route ใช้ key ไปลบ object ต่อ) · null = ไม่พบ */
export async function removeFile(id: string): Promise<LibraryFile | null> {
  if (isMongoConfigured()) {
    return (await filesCollection()).findOneAndDelete({ id }, { projection: { _id: 0 } });
  }
  const rows = await fileRead();
  const index = rows.findIndex((f) => f.id === id);
  if (index === -1) return null;
  const [removed] = rows.splice(index, 1);
  await writeJsonArray(RUNTIME_FILE, rows);
  return removed;
}
