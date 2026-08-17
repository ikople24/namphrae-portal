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

// รายงานจากชาวบ้าน (collection submittedreports) อยู่ db เดียวกับทะเบียนผู้ใช้ แต่เป็นของ
// ระบบแจ้งเรื่อง LINE ไม่ใช่ของ portal — portal อ่านอย่างเดียว ห้ามเขียนและห้ามคัดลอกมา
// ไว้ที่ namphrae_portal เพราะข้อมูลจะแช่แข็งทันทีโดยไม่มีอะไรพังให้เห็น
//
// แยกฟังก์ชันไว้เพื่อให้จุดเรียกบอกเจตนาชัด และถ้าวันหนึ่งย้าย db ก็แก้ที่เดียว
export async function getReportsDb(): Promise<Db> {
  return getUsersDb();
}
