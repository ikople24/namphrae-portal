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
  const docs = await col.find({ status: 'pending' }).sort({ appliedAt: 1 }).toArray();
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
  await col.insertOne(doc);
  return serialize(doc);
}

export type DecisionResult =
  | { ok: true; signup: SignupApplication }
  | { ok: false; error: 'not_found' | 'invalid_state' };

// Insert-first + planApproval (src/lib/signups.ts) make retries safe — see the
// tests there for the full decision table.
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
    await users.insertOne(buildRegistryUserDoc(app, role, now));
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
