import { MongoClient, type Db } from 'mongodb';
import { cacheUntilRejected } from '@/lib/promise-cache';

// Serverless-safe MongoDB client. On Vercel each function invocation can spin up
// a fresh module scope, so we cache the client on globalThis to avoid exhausting
// the connection pool during frequent cold starts.

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'namphrae_portal';

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

export function isMongoConfigured(): boolean {
  return Boolean(uri);
}

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  const connect = () => new MongoClient(uri).connect();

  // cacheUntilRejected, not a bare `if (!cached)`: a rejected promise is truthy,
  // so caching it means one failed connect at start-up is never retried and the
  // process stays broken until it is replaced. Long-lived hosts (Railway) do not
  // replace it per request the way Vercel does — see src/lib/promise-cache.ts.
  if (process.env.NODE_ENV === 'development') {
    // Reuse across HMR reloads in dev.
    return cacheUntilRejected(
      () => global._mongoClientPromise,
      (v) => {
        global._mongoClientPromise = v;
      },
      connect
    );
  }
  return cacheUntilRejected(
    () => clientPromise,
    (v) => {
      clientPromise = v;
    },
    connect
  );
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}

// Shared user registry lives in a different db on the same cluster
// (namphrae-map's db). Membership in its `users` collection grants admin
// access — see src/lib/auth-server.ts.
const usersDbName = process.env.MONGODB_USERS_DB || 'db_namphrae';

export async function getUsersDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(usersDbName);
}

// ใช้เฉพาะในสคริปต์ (scripts/*.mts) ตอนจบงานเท่านั้น — ห้ามเรียกจากโค้ดฝั่งเว็บ
// เซิร์ฟเวอร์ตั้งใจแคช client ไว้ตลอดอายุโปรเซสเพื่อลดการเปิดการเชื่อมต่อซ้ำ
// (ดูคอมเมนต์บนสุดของไฟล์) เรียก closeDb() จากฝั่งเว็บจะทำให้คำขอถัดไปเจอ client
// ที่ปิดไปแล้ว
//
// เหตุผลที่ต้องมีฟังก์ชันนี้: MongoDB driver เปิด socket ค้างไว้ในพูลการเชื่อมต่อ
// ซึ่งกัน event loop ของ Node ไม่ให้ออกเอง สคริปต์ที่จบงานแล้วจึงค้างอยู่จนกว่าจะ
// ถูก kill — ต้องปิด client explicit ถึงจะออกได้เอง
export async function closeDb(): Promise<void> {
  const pending = process.env.NODE_ENV === 'development' ? global._mongoClientPromise : clientPromise;

  // ไม่เคยเรียก getDb()/getClientPromise() มาก่อน (เช่นสคริปต์รันฝั่งไฟล์เพราะไม่ได้
  // ตั้ง MONGODB_URI) — ไม่มีอะไรให้ปิด
  if (!pending) return;

  // เคลียร์ทั้งสองแคชก่อน await เพื่อให้ getDb() รอบถัดไปในโปรเซสเดียวกัน (ถ้ามี)
  // เชื่อมต่อใหม่แทนที่จะได้ client ที่กำลังจะถูกปิด
  clientPromise = undefined;
  global._mongoClientPromise = undefined;

  try {
    const client = await pending;
    await client.close();
  } catch {
    // promise เดิม reject ไปแล้ว (เชื่อมต่อไม่สำเร็จตั้งแต่แรก) — ไม่มี client จริง
    // ให้ปิด ไม่ต้องโยน error ซ้ำตอนจบโปรแกรม
  }
}
