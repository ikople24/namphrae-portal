import { MongoClient, type Db } from 'mongodb';

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
  if (process.env.NODE_ENV === 'development') {
    // Reuse across HMR reloads in dev.
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }
  if (!clientPromise) {
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}
