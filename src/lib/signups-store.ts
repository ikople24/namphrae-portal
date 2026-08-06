// src/lib/signups-store.ts
// SERVER ONLY — Mongo access for the signup queue. The queue lives in the
// portal's OWN db (namphrae_portal.pendingSignups), never in the shared
// db_namphrae.users: แอปอีกสองตัวถือว่า "มี users doc" = เป็นสมาชิกทันที
// ใบสมัครที่ยังไม่อนุมัติจึงห้ามไปโผล่ที่นั่นเด็ดขาด — เฉพาะตอนอนุมัติเท่านั้น
// ที่เขียนลง registry
import { ObjectId, type Collection } from 'mongodb';
import { getDb, getUsersDb } from '@/lib/mongodb';
import { buildRegistryUserDoc } from '@/lib/registry-user';
import {
  planApproval,
  type SignupApplication,
  type SignupStatus,
} from '@/lib/signups';
import type { ApplyInput } from '@/lib/user-schema';

type SignupDoc = {
  _id: ObjectId;
  clerkId: string;
  email: string | null;
  name: string;
  position: string;
  department: string;
  phone: string;
  status: SignupStatus;
  rejectNote: string | null;
  appliedAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
};

async function signupsCollection(): Promise<Collection<SignupDoc>> {
  const db = await getDb();
  return db.collection<SignupDoc>('pendingSignups');
}

// Thrown by createSignup when the unique partial index (below) rejects a
// second concurrent pending application for the same clerkId — the
// find-then-insert check in the /apply handler has a race window between two
// rapid POSTs, so the index is the actual guarantee and this error is how a
// rejected insert gets turned back into the same already_pending response the
// upfront check would have produced. Pattern precedent: CategoryInUseError in
// src/pages/api/admin/categories.ts.
export class DuplicatePendingSignupError extends Error {
  constructor(public clerkId: string) {
    super('duplicate_pending_signup');
    this.name = 'DuplicatePendingSignupError';
  }
}

let indexesEnsured = false;
let indexAttempts = 0;
// See jobs-store.ts's ensureIndexes for why this caps retries instead of
// retrying forever: transient failures deserve a retry, permanent ones
// (missing Atlas createIndex privilege, a colliding index name) don't.
const MAX_INDEX_ATTEMPTS = 3;

// createIndex is a no-op once the index exists, so calling this once per
// process (cold start on serverless) is enough — no separate migration step.
async function ensureIndexes(): Promise<void> {
  if (indexesEnsured || indexAttempts >= MAX_INDEX_ATTEMPTS) return;
  indexAttempts += 1;
  indexesEnsured = true;
  try {
    const col = await signupsCollection();
    await col.createIndexes([
      {
        key: { clerkId: 1 },
        unique: true,
        partialFilterExpression: { status: 'pending' },
      },
    ]);
  } catch (err) {
    indexesEnsured = false; // let the next call retry (up to the cap)
    console.warn(
      `pendingSignups: createIndexes failed (attempt ${indexAttempts}/${MAX_INDEX_ATTEMPTS})`,
      err
    );
  }
}

function serialize(doc: SignupDoc): SignupApplication {
  return {
    id: doc._id.toString(),
    clerkId: doc.clerkId,
    email: doc.email,
    name: doc.name,
    position: doc.position,
    department: doc.department,
    phone: doc.phone,
    status: doc.status,
    rejectNote: doc.rejectNote,
    appliedAt: doc.appliedAt.toISOString(),
    decidedAt: doc.decidedAt ? doc.decidedAt.toISOString() : null,
    decidedBy: doc.decidedBy,
  };
}

export async function getLatestSignupByClerkId(
  clerkId: string
): Promise<SignupApplication | null> {
  const col = await signupsCollection();
  const doc = await col.find({ clerkId }).sort({ appliedAt: -1 }).limit(1).next();
  return doc ? serialize(doc) : null;
}

export async function listPendingSignups(): Promise<SignupApplication[]> {
  const col = await signupsCollection();
  const docs = await col.find({ status: 'pending' }).sort({ appliedAt: -1 }).toArray();
  return docs.map(serialize);
}

export async function countPendingSignups(): Promise<number> {
  const col = await signupsCollection();
  return col.countDocuments({ status: 'pending' });
}

export async function createSignup(
  clerkId: string,
  email: string | null,
  input: ApplyInput
): Promise<SignupApplication> {
  const col = await signupsCollection();
  await ensureIndexes();
  const doc: SignupDoc = {
    _id: new ObjectId(),
    clerkId,
    email,
    name: input.name,
    position: input.position,
    department: input.department,
    phone: input.phone,
    status: 'pending',
    rejectNote: null,
    appliedAt: new Date(),
    decidedAt: null,
    decidedBy: null,
  };
  try {
    await col.insertOne(doc);
  } catch (err) {
    // 11000 = duplicate key — the partial unique index caught two rapid
    // POSTs racing past the pending check above.
    if ((err as { code?: number }).code === 11000) {
      throw new DuplicatePendingSignupError(clerkId);
    }
    throw err;
  }
  return serialize(doc);
}

export type DecisionResult =
  | { ok: true; signup: SignupApplication }
  | { ok: false; error: 'not_found' | 'invalid_state' };

// Insert-first + planApproval (src/lib/signups.ts) make sequential retries
// safe — see the tests there for the full decision table. The registry write
// is an upsert on clerkId so a concurrent double-approve cannot create
// duplicate docs in the shared users collection (which smart-namphrae owns).
export async function approveSignup(
  id: string,
  role: string,
  decidedBy: string
): Promise<DecisionResult> {
  if (!ObjectId.isValid(id)) return { ok: false, error: 'not_found' };
  const col = await signupsCollection();
  const app = await col.findOne({ _id: new ObjectId(id) });
  if (!app) return { ok: false, error: 'not_found' };

  const users = (await getUsersDb()).collection('users');
  const existing = await users.findOne(
    { clerkId: app.clerkId },
    { projection: { _id: 1 } }
  );

  const plan = planApproval(app.status, Boolean(existing));
  if (plan.action === 'invalid') return { ok: false, error: 'invalid_state' };

  const now = new Date();
  if (plan.action === 'insert_and_mark') {
    await users.updateOne(
      { clerkId: app.clerkId },
      { $setOnInsert: buildRegistryUserDoc(app, role, now) },
      { upsert: true }
    );
  }
  if (plan.action !== 'noop') {
    await col.updateOne(
      { _id: app._id },
      { $set: { status: 'approved', decidedAt: now, decidedBy, rejectNote: null } }
    );
  }
  const updated = await col.findOne({ _id: app._id });
  return { ok: true, signup: serialize(updated ?? app) };
}

export async function rejectSignup(
  id: string,
  note: string,
  decidedBy: string
): Promise<DecisionResult> {
  if (!ObjectId.isValid(id)) return { ok: false, error: 'not_found' };
  const col = await signupsCollection();
  const app = await col.findOne({ _id: new ObjectId(id) });
  if (!app) return { ok: false, error: 'not_found' };
  if (app.status !== 'pending') return { ok: false, error: 'invalid_state' };
  const now = new Date();
  await col.updateOne(
    { _id: app._id },
    { $set: { status: 'rejected', rejectNote: note || null, decidedAt: now, decidedBy } }
  );
  const updated = await col.findOne({ _id: app._id });
  return { ok: true, signup: serialize(updated ?? app) };
}

// Registry lookup WITHOUT the active filter — /apply uses this to tell a
// deactivated ex-member apart from a stranger.
export async function findRegistryUserByClerkId(clerkId: string) {
  const users = (await getUsersDb()).collection('users');
  return users.findOne(
    { clerkId },
    { projection: { _id: 1, isActive: 1, isArchived: 1 } }
  );
}
