# Admin User Management + Self-Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New members self-register from the portal into an approval queue; admins approve/reject and manage all members from `/admin/users`; the auth gate starts honoring `isActive`/`isArchived`.

**Architecture:** Pending applications live in the portal's own DB (`namphrae_portal.pendingSignups`) so unapproved applicants stay invisible to the other two apps that treat existence of a `db_namphrae.users` doc as membership. Approval inserts a registry doc matching the smart-namphrae schema exactly (insert-first, idempotent). Pure decision logic (query filters, doc builders, state machines) lives in small lib files under TDD; Mongo access is thin wrappers; pages/APIs follow the existing Pages Router + `requireAdmin` + Zod + SWR patterns.

**Tech Stack:** Next.js 16 Pages Router, Clerk v7, MongoDB driver v7, Zod v4, SWR, vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-08-06-admin-user-management-design.md`

**⚠️ Before writing any Next.js or Clerk code:** per `AGENTS.md`, this Next version has breaking changes — check `node_modules/next/dist/docs/` for Pages Router conventions if unsure. For Clerk component props (`<SignUp>`, `clerkClient()`), verify against `node_modules/@clerk/nextjs` types — do not guess from training data.

**Conventions used throughout** (copy the existing codebase style):
- API error shape: `res.status(N).json({ error: 'snake_case_code' })`
- Audit identity string: `admin.email ?? admin.userId`
- Comments: Thai for domain rationale, English for mechanics (match surrounding files)
- Run a single test file: `npx vitest run src/lib/<file>.test.ts`

---

### Task 1: Registry helpers (pure) + tests

Pure logic for the shared user registry (`db_namphrae.users`): the auth-gate filter, the document builder used at approval, the PATCH builder for member edits, and the client serializer.

**Files:**
- Create: `src/lib/registry-user.ts`
- Test: `src/lib/registry-user.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/registry-user.test.ts
import { describe, expect, it } from 'vitest';
import {
  activeRegistryFilter,
  buildMemberPatch,
  buildRegistryUserDoc,
  serializeMember,
} from '@/lib/registry-user';

// ตัวกรองนี้คือประตูหลังบ้านทั้งบาน — ใช้ $ne ไม่ใช่ equality เพราะ document
// รุ่นเก่าอาจไม่มีฟิลด์ isActive/isArchived เลย (ไม่มีฟิลด์ = ยัง active
// ตาม default ของ schema ฝั่ง smart-namphrae)
describe('activeRegistryFilter', () => {
  it('matches by clerkId and excludes deactivated/archived', () => {
    expect(activeRegistryFilter('user_1')).toEqual({
      clerkId: 'user_1',
      isActive: { $ne: false },
      isArchived: { $ne: true },
    });
  });
});

describe('buildRegistryUserDoc', () => {
  const now = new Date('2026-08-06T10:00:00Z');
  const app = {
    clerkId: 'user_1',
    name: 'สมชาย ใจดี',
    position: 'นักวิชาการ',
    department: 'สาธารณสุข',
    phone: '0812345678',
  };

  it('produces the exact smart-namphrae schema shape', () => {
    expect(buildRegistryUserDoc(app, 'staff', now)).toEqual({
      name: 'สมชาย ใจดี',
      position: 'นักวิชาการ',
      department: 'สาธารณสุข',
      role: 'staff',
      phone: '0812345678',
      profileImage: '',
      assignedTask: '',
      clerkId: 'user_1',
      isActive: true,
      isArchived: false,
      exitDate: null,
      exitNote: '',
      createdAt: now,
      updatedAt: now,
    });
  });
});

describe('buildMemberPatch', () => {
  const now = new Date('2026-08-06T10:00:00Z');

  it('copies only provided profile fields and always stamps updatedAt', () => {
    expect(buildMemberPatch({ name: 'ใหม่', role: 'lead' }, now)).toEqual({
      name: 'ใหม่',
      role: 'lead',
      updatedAt: now,
    });
  });

  it('deactivation stamps exitDate', () => {
    expect(buildMemberPatch({ isActive: false }, now)).toEqual({
      isActive: false,
      exitDate: now,
      updatedAt: now,
    });
  });

  it('reactivation clears exitDate', () => {
    expect(buildMemberPatch({ isActive: true }, now)).toEqual({
      isActive: true,
      exitDate: null,
      updatedAt: now,
    });
  });
});

describe('serializeMember', () => {
  it('legacy doc without lifecycle fields counts as active', () => {
    const m = serializeMember({ _id: { toString: () => 'abc' }, name: 'ก' });
    expect(m).toEqual({
      id: 'abc',
      clerkId: null,
      name: 'ก',
      position: '',
      department: '',
      role: '',
      phone: '',
      isActive: true,
      isArchived: false,
    });
  });

  it('isActive false / isArchived true survive serialization', () => {
    const m = serializeMember({
      _id: { toString: () => 'abc' },
      clerkId: 'user_1',
      isActive: false,
      isArchived: true,
    });
    expect(m.isActive).toBe(false);
    expect(m.isArchived).toBe(true);
    expect(m.clerkId).toBe('user_1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/registry-user.test.ts`
Expected: FAIL — cannot resolve `@/lib/registry-user`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/registry-user.ts
// Pure helpers for the shared user registry (db_namphrae.users) — the
// collection smart-namphrae owns and namphrae-map reads. Kept pure so the
// document shape and gate rules stay unit-testable; Mongo access lives in the
// callers (auth-server.ts, signups-store.ts, api/admin/users).

export type RegistryUserDoc = {
  name: string;
  position: string;
  department: string;
  role: string;
  phone: string;
  profileImage: string;
  assignedTask: string;
  clerkId: string;
  isActive: boolean;
  isArchived: boolean;
  exitDate: Date | null;
  exitNote: string;
  createdAt: Date;
  updatedAt: Date;
};

// ตัวกรองสมาชิกของ auth gate — ใช้ $ne ไม่ใช่ equality เพราะ document รุ่นเก่า
// อาจไม่มีฟิลด์เหล่านี้ (ไม่มีฟิลด์ = active ตาม default ของ smart-namphrae)
export function activeRegistryFilter(clerkId: string) {
  return {
    clerkId,
    isActive: { $ne: false },
    isArchived: { $ne: true },
  } as const;
}

export function buildRegistryUserDoc(
  app: {
    clerkId: string;
    name: string;
    position: string;
    department: string;
    phone: string;
  },
  role: string,
  now: Date
): RegistryUserDoc {
  return {
    name: app.name,
    position: app.position,
    department: app.department,
    role,
    phone: app.phone,
    profileImage: '',
    assignedTask: '',
    clerkId: app.clerkId,
    isActive: true,
    isArchived: false,
    exitDate: null,
    exitNote: '',
    createdAt: now,
    updatedAt: now,
  };
}

export type MemberPatchInput = {
  name?: string;
  position?: string;
  department?: string;
  role?: string;
  phone?: string;
  isActive?: boolean;
};

// $set document for PATCH /api/admin/users/[id]. Deactivation stamps exitDate,
// reactivation clears it; updatedAt always moves. isArchived is deliberately
// untouchable from the portal — that lifecycle belongs to smart-namphrae.
export function buildMemberPatch(
  patch: MemberPatchInput,
  now: Date
): Record<string, unknown> {
  const set: Record<string, unknown> = { updatedAt: now };
  for (const key of ['name', 'position', 'department', 'role', 'phone'] as const) {
    if (patch[key] !== undefined) set[key] = patch[key];
  }
  if (patch.isActive !== undefined) {
    set.isActive = patch.isActive;
    set.exitDate = patch.isActive ? null : now;
  }
  return set;
}

// Registry doc -> client shape for the members tab.
export type RegistryMember = {
  id: string;
  clerkId: string | null;
  name: string;
  position: string;
  department: string;
  role: string;
  phone: string;
  isActive: boolean;
  isArchived: boolean;
};

export function serializeMember(doc: {
  _id: { toString(): string };
  clerkId?: unknown;
  name?: unknown;
  position?: unknown;
  department?: unknown;
  role?: unknown;
  phone?: unknown;
  isActive?: unknown;
  isArchived?: unknown;
}): RegistryMember {
  return {
    id: doc._id.toString(),
    clerkId: typeof doc.clerkId === 'string' ? doc.clerkId : null,
    name: typeof doc.name === 'string' ? doc.name : '',
    position: typeof doc.position === 'string' ? doc.position : '',
    department: typeof doc.department === 'string' ? doc.department : '',
    role: typeof doc.role === 'string' ? doc.role : '',
    phone: typeof doc.phone === 'string' ? doc.phone : '',
    isActive: doc.isActive !== false,
    isArchived: doc.isArchived === true,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/registry-user.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/registry-user.ts src/lib/registry-user.test.ts
git commit -m "feat(users): registry helpers — gate filter, doc builder, member patch"
```

---

### Task 2: Zod schemas + tests

**Files:**
- Create: `src/lib/user-schema.ts`
- Test: `src/lib/user-schema.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/user-schema.test.ts
import { describe, expect, it } from 'vitest';
import {
  applyInputSchema,
  approveBodySchema,
  memberPatchSchema,
  rejectBodySchema,
} from '@/lib/user-schema';

describe('applyInputSchema', () => {
  const valid = {
    name: 'สมชาย ใจดี',
    position: 'นักวิชาการ',
    department: 'สาธารณสุข',
    phone: '081-234-5678',
  };

  it('accepts a normal application and trims whitespace', () => {
    const parsed = applyInputSchema.parse({ ...valid, name: '  สมชาย ใจดี  ' });
    expect(parsed.name).toBe('สมชาย ใจดี');
  });

  it('rejects missing fields', () => {
    expect(applyInputSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
    expect(applyInputSchema.safeParse({}).success).toBe(false);
  });

  it('rejects oversized fields', () => {
    expect(
      applyInputSchema.safeParse({ ...valid, name: 'ก'.repeat(201) }).success
    ).toBe(false);
  });

  it('has no role field — role is admin-assigned at approval', () => {
    const parsed = applyInputSchema.parse({ ...valid, role: 'admin' });
    expect('role' in parsed).toBe(false);
  });
});

describe('approveBodySchema', () => {
  it('requires a non-empty role', () => {
    expect(approveBodySchema.safeParse({ role: 'staff' }).success).toBe(true);
    expect(approveBodySchema.safeParse({ role: '  ' }).success).toBe(false);
    expect(approveBodySchema.safeParse({}).success).toBe(false);
  });
});

describe('rejectBodySchema', () => {
  it('note is optional and defaults to empty string', () => {
    expect(rejectBodySchema.parse({}).note).toBe('');
    expect(rejectBodySchema.parse({ note: 'ข้อมูลไม่ครบ' }).note).toBe('ข้อมูลไม่ครบ');
  });
});

describe('memberPatchSchema', () => {
  it('accepts partial updates', () => {
    expect(memberPatchSchema.safeParse({ role: 'lead' }).success).toBe(true);
    expect(memberPatchSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('rejects an empty patch', () => {
    expect(memberPatchSchema.safeParse({}).success).toBe(false);
  });

  it('rejects unknown-typed values', () => {
    expect(memberPatchSchema.safeParse({ isActive: 'no' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/user-schema.test.ts`
Expected: FAIL — cannot resolve `@/lib/user-schema`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/user-schema.ts
import { z } from 'zod';

// Zod source of truth for the signup/user-management endpoints, reused by the
// admin forms (same pattern as src/lib/schema.ts).

// ฟอร์มสมัครสมาชิก (/apply). ตั้งใจไม่มีฟิลด์ role — ผู้ดูแลเป็นคนกำหนดตอน
// อนุมัติ ผู้สมัครเลือกเองไม่ได้
export const applyInputSchema = z.object({
  name: z.string().trim().min(1, 'ต้องระบุชื่อ-นามสกุล').max(200),
  position: z.string().trim().min(1, 'ต้องระบุตำแหน่ง').max(200),
  department: z.string().trim().min(1, 'ต้องระบุแผนก/กลุ่มงาน').max(200),
  phone: z.string().trim().min(1, 'ต้องระบุเบอร์โทร').max(50),
});
export type ApplyInput = z.infer<typeof applyInputSchema>;

export const approveBodySchema = z.object({
  role: z.string().trim().min(1, 'ต้องระบุ role').max(100),
});

export const rejectBodySchema = z.object({
  note: z.string().trim().max(500).optional().default(''),
});

export const memberPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    position: z.string().trim().max(200).optional(),
    department: z.string().trim().max(200).optional(),
    role: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(50).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'ต้องมีอย่างน้อยหนึ่งฟิลด์',
  });
export type MemberPatchBody = z.infer<typeof memberPatchSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/user-schema.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/user-schema.ts src/lib/user-schema.test.ts
git commit -m "feat(users): zod schemas for apply/approve/reject/member-patch"
```

---

### Task 3: Signup pure logic (state machine) + tests

**Files:**
- Create: `src/lib/signups.ts`
- Test: `src/lib/signups.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/signups.test.ts
import { describe, expect, it } from 'vitest';
import { planApproval, resolveApplyState } from '@/lib/signups';

describe('resolveApplyState', () => {
  it('no application → form', () => {
    expect(resolveApplyState(null)).toEqual({ state: 'form' });
  });

  it('pending → pending', () => {
    expect(resolveApplyState({ status: 'pending' })).toEqual({ state: 'pending' });
  });

  it('rejected → rejected with note', () => {
    expect(resolveApplyState({ status: 'rejected', rejectNote: 'ข้อมูลไม่ครบ' })).toEqual({
      state: 'rejected',
      rejectNote: 'ข้อมูลไม่ครบ',
    });
    expect(resolveApplyState({ status: 'rejected' })).toEqual({
      state: 'rejected',
      rejectNote: null,
    });
  });

  // approved แต่ไม่มี doc ใน registry แล้ว (โดน smart-namphrae ลบทีหลัง) —
  // ถือเป็นการเริ่มใหม่ ไม่ใช่ทางตัน
  it('stale approved → form', () => {
    expect(resolveApplyState({ status: 'approved' })).toEqual({ state: 'form' });
  });
});

// approve ต้อง idempotent: retry หลัง insert สำเร็จแต่ mark ล้มเหลว
// ต้องจบงานได้โดยไม่เกิด registry doc ซ้ำ
describe('planApproval', () => {
  it('pending + no registry doc → insert and mark', () => {
    expect(planApproval('pending', false)).toEqual({ action: 'insert_and_mark' });
  });

  it('pending + registry doc exists (retry / added via smart-namphrae) → mark only', () => {
    expect(planApproval('pending', true)).toEqual({ action: 'mark_only' });
  });

  it('approved + registry doc exists → noop', () => {
    expect(planApproval('approved', true)).toEqual({ action: 'noop' });
  });

  it('approved + registry doc later deleted → insert and mark again', () => {
    expect(planApproval('approved', false)).toEqual({ action: 'insert_and_mark' });
  });

  it('rejected → invalid (must not resurrect a rejected application)', () => {
    expect(planApproval('rejected', false)).toEqual({ action: 'invalid' });
    expect(planApproval('rejected', true)).toEqual({ action: 'invalid' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/signups.test.ts`
Expected: FAIL — cannot resolve `@/lib/signups`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/signups.ts
// Pure signup-queue logic + client-safe types. Mongo access lives in
// src/lib/signups-store.ts.

export type SignupStatus = 'pending' | 'approved' | 'rejected';

export type SignupApplication = {
  id: string;
  clerkId: string;
  email: string | null;
  name: string;
  position: string;
  department: string;
  phone: string;
  status: SignupStatus;
  rejectNote: string | null;
  appliedAt: string; // ISO
  decidedAt: string | null;
  decidedBy: string | null;
};

export type ApplyState =
  | { state: 'form' }
  | { state: 'pending' }
  | { state: 'rejected'; rejectNote: string | null }
  | { state: 'deactivated' }; // registry doc exists but inactive — resolved by the caller

// approved แต่ registry doc หายไปแล้ว = เริ่มใหม่ได้ ไม่ใช่ทางตัน
export function resolveApplyState(
  latest: { status: SignupStatus; rejectNote?: string | null } | null
): ApplyState {
  if (!latest || latest.status === 'approved') return { state: 'form' };
  if (latest.status === 'pending') return { state: 'pending' };
  return { state: 'rejected', rejectNote: latest.rejectNote ?? null };
}

// Approve is idempotent: insert-first ordering means a retry after a partial
// failure (registry insert landed, mark did not) resolves to mark_only and
// completes cleanly — never a duplicate registry doc, never a dead end.
export type ApprovalPlan =
  | { action: 'insert_and_mark' }
  | { action: 'mark_only' }
  | { action: 'noop' }
  | { action: 'invalid' };

export function planApproval(
  status: SignupStatus,
  userExists: boolean
): ApprovalPlan {
  if (status === 'rejected') return { action: 'invalid' };
  if (status === 'approved' && userExists) return { action: 'noop' };
  if (userExists) return { action: 'mark_only' };
  return { action: 'insert_and_mark' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/signups.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/signups.ts src/lib/signups.test.ts
git commit -m "feat(users): signup state machine — apply state + idempotent approval plan"
```

---

### Task 4: Auth gate fix (`isActive`/`isArchived`)

Wire `activeRegistryFilter` into `checkAdmin`, export `checkAdmin` for reuse by `/apply`, and make `getMemberSsrProps` redirect signed-in non-members to `/apply` (the page arrives in Task 8; until then the redirect 404s, which is fine mid-branch).

**Files:**
- Modify: `src/lib/auth-server.ts:23-62` (checkAdmin) and `:90-95` (getMemberSsrProps)

- [ ] **Step 1: Update the registry lookup**

In `src/lib/auth-server.ts`, add the import:

```ts
import { activeRegistryFilter } from '@/lib/registry-user';
```

Change `async function checkAdmin(` to `export async function checkAdmin(` and update its doc comment block (lines 9-13) to mention the active check:

```ts
// Clerk is optional. When configured, /admin (pages and APIs) requires a
// signed-in user who ALSO exists as an ACTIVE, non-archived entry in the
// shared user registry (db_namphrae.users, keyed by clerkId — the same
// registry namphrae-map uses). When Clerk is unset the app runs in "dev-open"
// mode so it boots and is fully testable with zero external services.
// NEVER deploy to production without Clerk.
```

Replace the `findOne` call (line 54):

```ts
    const user = await db
      .collection('users')
      .findOne(activeRegistryFilter(userId), { projection: { email: 1, name: 1 } });
```

- [ ] **Step 2: Redirect signed-in non-members to /apply**

Replace `getMemberSsrProps` (lines 90-95) with:

```ts
/**
 * SSR guard for /admin pages. Pages export this as getServerSideProps and wrap
 * their component in withMemberGuard (src/components/admin/MemberGuard.tsx),
 * which renders an access-denied screen when `member` is false.
 *
 * A signed-in visitor who is not (or no longer) an active member is redirected
 * to /apply — the application flow — instead of a dead-end screen. 401 keeps
 * the AccessDenied fallback (the proxy normally redirects signed-out visitors
 * to /sign-in before they reach here).
 */
export const getMemberSsrProps: GetServerSideProps<{ member: boolean }> = async (
  ctx
) => {
  const check = await checkAdmin(ctx.req);
  if (!check.ok && check.status === 403 && isClerkConfigured()) {
    return { redirect: { destination: '/apply', permanent: false } };
  }
  return { props: { member: check.ok } };
};
```

Note: `isClerkConfigured` is already imported at the top of the file (line 2).

- [ ] **Step 3: Verify types and existing tests**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth-server.ts
git commit -m "fix(auth): gate now excludes deactivated/archived registry users; 403 redirects to /apply"
```

---

### Task 5: Signups store (Mongo layer)

Thin DB wrappers around `pendingSignups` (portal DB) plus the approval orchestration. Decision logic was already TDD'd in Task 3; this layer stays mechanical.

**Files:**
- Create: `src/lib/signups-store.ts`

- [ ] **Step 1: Write the store**

```ts
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
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/signups-store.ts
git commit -m "feat(users): pendingSignups store with idempotent approval orchestration"
```

---

### Task 6: `POST /api/apply`

**Files:**
- Create: `src/pages/api/apply.ts`

- [ ] **Step 1: Write the handler**

```ts
// src/pages/api/apply.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { isClerkConfigured } from '@/lib/clerk-config';
import { isMongoConfigured } from '@/lib/mongodb';
import { applyInputSchema } from '@/lib/user-schema';
import {
  createSignup,
  findRegistryUserByClerkId,
  getLatestSignupByClerkId,
} from '@/lib/signups-store';

// POST /api/apply — submit a membership application. Identity (clerkId, email)
// comes from the Clerk session, NEVER from the body — ไม่งั้นใครก็ยื่นสมัคร
// แทนคนอื่นได้. Not under /api/admin: applicants are by definition not members.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  // dev-open mode has no signup concept — everyone is already "in".
  if (!isClerkConfigured()) {
    return res.status(400).json({ error: 'clerk_not_configured' });
  }
  // ใบสมัครเป็นข้อมูลบุคคล ต้องลง Mongo เท่านั้น — ไม่มี file fallback แบบ
  // jobs-store โดยตั้งใจ
  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'mongo_required' });
  }

  const { getAuth, clerkClient } = await import('@clerk/nextjs/server');
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const parsed = applyInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'invalid_input', issues: parsed.error.issues });
  }

  const registry = await findRegistryUserByClerkId(userId);
  if (registry) {
    const active = registry.isActive !== false && registry.isArchived !== true;
    return res
      .status(active ? 409 : 403)
      .json({ error: active ? 'already_member' : 'deactivated' });
  }

  const latest = await getLatestSignupByClerkId(userId);
  if (latest?.status === 'pending') {
    return res.status(409).json({ error: 'already_pending' });
  }

  // email is best-effort display data for the queue — the application stands
  // without it.
  let email: string | null = null;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    email = user.primaryEmailAddress?.emailAddress ?? null;
  } catch (err) {
    console.warn('apply: could not fetch email from Clerk', err);
  }

  const signup = await createSignup(userId, email, parsed.data);
  return res.status(201).json(signup);
}
```

Note: verify `clerkClient()` call shape against `node_modules/@clerk/nextjs` types (v7). If it is not callable-async in this version, use the exported singleton per the package's own `.d.ts`.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/apply.ts
git commit -m "feat(users): POST /api/apply — membership application endpoint"
```

---

### Task 7: Admin APIs — signups queue + members

**Files:**
- Create: `src/pages/api/admin/signups/index.ts`
- Create: `src/pages/api/admin/signups/[id]/approve.ts`
- Create: `src/pages/api/admin/signups/[id]/reject.ts`
- Create: `src/pages/api/admin/users/index.ts`
- Create: `src/pages/api/admin/users/[id].ts`

- [ ] **Step 1: Queue list endpoint**

```ts
// src/pages/api/admin/signups/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { isMongoConfigured } from '@/lib/mongodb';
import { countPendingSignups, listPendingSignups } from '@/lib/signups-store';

// GET /api/admin/signups             → { signups, pendingCount }
// GET /api/admin/signups?countOnly=1 → { pendingCount }  (sidebar badge — cheap)
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'mongo_required' });
  }

  if (req.query.countOnly) {
    return res.status(200).json({ pendingCount: await countPendingSignups() });
  }
  const signups = await listPendingSignups();
  return res.status(200).json({ signups, pendingCount: signups.length });
}
```

- [ ] **Step 2: Approve endpoint**

```ts
// src/pages/api/admin/signups/[id]/approve.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { isMongoConfigured } from '@/lib/mongodb';
import { approveBodySchema } from '@/lib/user-schema';
import { approveSignup } from '@/lib/signups-store';

// POST /api/admin/signups/[id]/approve — body { role }. Inserts the registry
// doc (db_namphrae.users) and marks the application approved. Idempotent: see
// planApproval in src/lib/signups.ts.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'mongo_required' });
  }

  const parsed = approveBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'invalid_input', issues: parsed.error.issues });
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const result = await approveSignup(
    id,
    parsed.data.role,
    admin.email ?? admin.userId
  );
  if (!result.ok) {
    return res
      .status(result.error === 'not_found' ? 404 : 409)
      .json({ error: result.error });
  }
  return res.status(200).json(result.signup);
}
```

- [ ] **Step 3: Reject endpoint**

```ts
// src/pages/api/admin/signups/[id]/reject.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { isMongoConfigured } from '@/lib/mongodb';
import { rejectBodySchema } from '@/lib/user-schema';
import { rejectSignup } from '@/lib/signups-store';

// POST /api/admin/signups/[id]/reject — body { note? }. Only a pending
// application can be rejected; the applicant sees the note and may re-apply.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'mongo_required' });
  }

  const parsed = rejectBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'invalid_input', issues: parsed.error.issues });
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const result = await rejectSignup(
    id,
    parsed.data.note,
    admin.email ?? admin.userId
  );
  if (!result.ok) {
    return res
      .status(result.error === 'not_found' ? 404 : 409)
      .json({ error: result.error });
  }
  return res.status(200).json(result.signup);
}
```

- [ ] **Step 4: Members list endpoint**

```ts
// src/pages/api/admin/users/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { serializeMember } from '@/lib/registry-user';

// GET /api/admin/users — every registry member (db_namphrae.users), including
// deactivated ones. The portal never deletes registry docs.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'mongo_required' });
  }

  const docs = await (await getUsersDb())
    .collection('users')
    .find({})
    .sort({ name: 1 })
    .toArray();
  return res.status(200).json({ members: docs.map(serializeMember) });
}
```

- [ ] **Step 5: Member patch endpoint (with self-lockout guard)**

```ts
// src/pages/api/admin/users/[id].ts
import { ObjectId } from 'mongodb';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { buildMemberPatch, serializeMember } from '@/lib/registry-user';
import { memberPatchSchema } from '@/lib/user-schema';

// PATCH /api/admin/users/[id] — edit profile fields and/or toggle isActive.
// กันล็อกตัวเองออก: ปิดการใช้งานบัญชีของตัวเองไม่ได้ (ไม่งั้นแอดมินคนสุดท้าย
// กดพลาดทีเดียว ทั้งหลังบ้านไม่เหลือใครเข้าได้)
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'mongo_required' });
  }

  const parsed = memberPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'invalid_input', issues: parsed.error.issues });
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'not_found' });

  const users = (await getUsersDb()).collection('users');
  const existing = await users.findOne({ _id: new ObjectId(id) });
  if (!existing) return res.status(404).json({ error: 'not_found' });

  if (parsed.data.isActive === false && existing.clerkId === admin.userId) {
    return res.status(400).json({ error: 'cannot_deactivate_self' });
  }

  await users.updateOne(
    { _id: existing._id },
    { $set: buildMemberPatch(parsed.data, new Date()) }
  );
  const updated = await users.findOne({ _id: existing._id });
  return res.status(200).json(serializeMember(updated ?? existing));
}
```

- [ ] **Step 6: Verify types and run all tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean

- [ ] **Step 7: Commit**

```bash
git add src/pages/api/admin/signups src/pages/api/admin/users
git commit -m "feat(users): admin APIs — signup queue (list/approve/reject), member list/patch"
```

---

### Task 8: Applicant pages — `/sign-up`, `/apply`, sign-in link

**Files:**
- Create: `src/pages/sign-up/[[...index]].tsx`
- Create: `src/pages/apply.tsx`
- Modify: `src/pages/sign-in/[[...index]].tsx:44` (signUpUrl)

- [ ] **Step 1: Sign-up page**

Mirror of the sign-in page. Verify `<SignUp>` prop names against `node_modules/@clerk/nextjs` types before writing (v7 — `forceRedirectUrl` expected).

```tsx
// src/pages/sign-up/[[...index]].tsx
import Head from 'next/head';
import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { isClerkPublicConfigured } from '@/lib/clerk-config';

// Clerk sign-up for new applicants. After creating an account they land on
// /apply to submit their membership application (they are NOT members yet —
// membership requires admin approval; see docs/superpowers/specs/
// 2026-08-06-admin-user-management-design.md).
export default function SignUpPage() {
  const clerkOn = isClerkPublicConfigured();
  return (
    <>
      <Head>
        <title>สมัครสมาชิก · Namphrae Portal</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="grid min-h-screen place-items-center bg-paper px-5">
        {clerkOn ? (
          <ClerkSignUp />
        ) : (
          <div className="max-w-md rounded-2xl border border-black/[0.07] bg-surface p-8 text-center">
            <h1 className="font-display text-xl font-semibold text-ink">
              โหมดทดสอบ (dev-open)
            </h1>
            <p className="mt-3 text-sm text-ink-soft">
              ยังไม่ได้ตั้งค่า Clerk จึงไม่มีระบบสมัครสมาชิก — เข้าหลังบ้านได้เลย
            </p>
            <Link
              href="/admin"
              className="mt-5 inline-block rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-deep"
            >
              ไปหน้าหลังบ้าน
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

// Static ESM import for the same reason as sign-in: a CJS require() loads a
// second @clerk/nextjs instance whose React context differs from ClerkProvider.
function ClerkSignUp() {
  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      forceRedirectUrl="/apply"
    />
  );
}
```

- [ ] **Step 2: Point sign-in at the new page**

In `src/pages/sign-in/[[...index]].tsx` line 44, change:

```tsx
  return <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />;
```

Also update the comment above `ClerkSignIn` if it mentions sign-up being disabled.

- [ ] **Step 3: Apply page**

```tsx
// src/pages/apply.tsx
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import type { GetServerSideProps } from 'next';
import { resolveApplyState, type ApplyState } from '@/lib/signups';
import { applyInputSchema } from '@/lib/user-schema';

// สมัครเข้าใช้งานหลังบ้าน: ผู้ที่ล็อกอิน Clerk แล้วแต่ยังไม่เป็นสมาชิก
// (getMemberSsrProps ส่งมาที่นี่แทน AccessDenied) กรอกข้อมูลเพื่อเข้าคิว
// รออนุมัติ — role ให้แอดมินกำหนดตอนอนุมัติ ผู้สมัครไม่ได้เลือกเอง
type Props = { apply: ApplyState };

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { isClerkConfigured } = await import('@/lib/clerk-config');
  if (!isClerkConfigured()) {
    // dev-open: no signup concept, admin is already open
    return { redirect: { destination: '/admin', permanent: false } };
  }
  const { getAuth } = await import('@clerk/nextjs/server');
  const { userId } = getAuth(ctx.req);
  if (!userId) {
    return { redirect: { destination: '/sign-in', permanent: false } };
  }
  const { isMongoConfigured } = await import('@/lib/mongodb');
  if (!isMongoConfigured()) {
    return { redirect: { destination: '/', permanent: false } };
  }
  const { findRegistryUserByClerkId, getLatestSignupByClerkId } = await import(
    '@/lib/signups-store'
  );
  const registry = await findRegistryUserByClerkId(userId);
  if (registry) {
    const active = registry.isActive !== false && registry.isArchived !== true;
    if (active) return { redirect: { destination: '/admin', permanent: false } };
    return { props: { apply: { state: 'deactivated' } } };
  }
  const latest = await getLatestSignupByClerkId(userId);
  return {
    props: {
      apply: resolveApplyState(
        latest ? { status: latest.status, rejectNote: latest.rejectNote } : null
      ),
    },
  };
};

export default function ApplyPage({ apply }: Props) {
  const [submitted, setSubmitted] = useState(false);
  let content;
  if (submitted || apply.state === 'pending') {
    content = (
      <StatusCard
        title="ส่งคำขอแล้ว — รอการอนุมัติ"
        body="ผู้ดูแลระบบจะตรวจสอบคำขอของคุณ เมื่ออนุมัติแล้วจะเข้าใช้งานหลังบ้านได้ทันที"
      />
    );
  } else if (apply.state === 'deactivated') {
    content = (
      <StatusCard
        title="บัญชีถูกปิดการใช้งาน"
        body="บัญชีนี้เคยเป็นสมาชิกแต่ถูกปิดการใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ"
      />
    );
  } else {
    content = (
      <ApplyForm
        rejectNote={apply.state === 'rejected' ? apply.rejectNote : null}
        onDone={() => setSubmitted(true)}
      />
    );
  }
  return (
    <>
      <Head>
        <title>สมัครเข้าใช้งาน · Namphrae Portal</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="grid min-h-screen place-items-center bg-paper px-5 py-10">
        {content}
      </div>
    </>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-md rounded-2xl border border-black/[0.07] bg-surface p-8 text-center">
      <h1 className="font-display text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-3 text-sm text-ink-soft">{body}</p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:bg-black/[0.04]"
      >
        กลับหน้าหลัก
      </Link>
    </div>
  );
}

const FIELDS = [
  { key: 'name', label: 'ชื่อ-นามสกุล' },
  { key: 'position', label: 'ตำแหน่ง' },
  { key: 'department', label: 'แผนก/กลุ่มงาน' },
  { key: 'phone', label: 'เบอร์โทรศัพท์' },
] as const;

function ApplyForm({
  rejectNote,
  onDone,
}: {
  rejectNote: string | null;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    position: '',
    department: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    const parsed = applyInputSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `ส่งคำขอไม่สำเร็จ (${res.status})`);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งคำขอไม่สำเร็จ');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-black/[0.07] bg-surface p-8">
      <h1 className="font-display text-xl font-semibold text-ink">
        สมัครเข้าใช้งานหลังบ้าน
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        กรอกข้อมูลเพื่อส่งคำขอ — ผู้ดูแลระบบจะตรวจสอบและอนุมัติ
      </p>
      {rejectNote !== null ? (
        <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800">
          คำขอก่อนหน้าถูกปฏิเสธ{rejectNote ? `: ${rejectNote}` : ''} —
          แก้ไขข้อมูลแล้วส่งใหม่ได้
        </div>
      ) : null}
      <div className="mt-5 flex flex-col gap-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              {f.label}
            </span>
            <input
              type="text"
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className="w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm text-ink outline-none focus:border-emerald"
            />
          </label>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={submit}
        disabled={sending}
        className="mt-5 w-full rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
      >
        {sending ? 'กำลังส่ง…' : 'ส่งคำขอสมัคร'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify types + build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/sign-up src/pages/apply.tsx src/pages/sign-in
git commit -m "feat(users): /sign-up + /apply application flow for new members"
```

---

### Task 9: Admin UI — client wrappers, sidebar badge, `/admin/users`

**Files:**
- Modify: `src/lib/admin-api.ts` (append wrappers)
- Modify: `src/components/admin/AdminLayout.tsx:9-15` (NAV) and the nav render
- Create: `src/pages/admin/users.tsx`

- [ ] **Step 1: Client wrappers**

Append to `src/lib/admin-api.ts` (imports go at the top of the file):

```ts
import type { SignupApplication } from '@/lib/signups';
import type { RegistryMember } from '@/lib/registry-user';
import type { MemberPatchBody } from '@/lib/user-schema';
```

```ts
export type SignupListResponse = {
  signups: SignupApplication[];
  pendingCount: number;
};

export async function approveSignupRequest(
  id: string,
  role: string
): Promise<SignupApplication> {
  return jsonOrThrow(
    await fetch(`/api/admin/signups/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role }),
    })
  );
}

export async function rejectSignupRequest(
  id: string,
  note: string
): Promise<SignupApplication> {
  return jsonOrThrow(
    await fetch(`/api/admin/signups/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note }),
    })
  );
}

export async function updateMember(
  id: string,
  patch: MemberPatchBody
): Promise<RegistryMember> {
  return jsonOrThrow(
    await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
  );
}
```

- [ ] **Step 2: Sidebar entry + pending badge**

In `src/components/admin/AdminLayout.tsx`:

Add to imports:

```tsx
import useSWR from 'swr';
import { adminFetcher } from '@/lib/admin-api';
```

Add to `NAV` (after the settings entry, before นำเข้า/ส่งออก):

```tsx
  { href: '/admin/users', label: 'จัดการผู้ใช้', icon: 'group', exact: false },
```

Inside `AdminLayout`, after `const clerkOn = ...`:

```tsx
  // Badge: จำนวนผู้สมัครที่รออนุมัติ. Refresh ทุกนาที; ถ้า endpoint พัง
  // (เช่น Mongo ไม่พร้อม) ก็แค่ไม่แสดง badge — ไม่ retry รัว ๆ
  const { data: signupCount } = useSWR<{ pendingCount: number }>(
    '/api/admin/signups?countOnly=1',
    adminFetcher,
    { refreshInterval: 60_000, shouldRetryOnError: false }
  );
  const pendingCount = signupCount?.pendingCount ?? 0;
```

In the nav `Link` render, after `{item.label}`:

```tsx
                  {item.href === '/admin/users' && pendingCount > 0 ? (
                    <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-px text-[10px] font-semibold text-white">
                      {pendingCount}
                    </span>
                  ) : null}
```

Check that `group` renders in `src/lib/icons.ts` conventions (Material Symbols name) — if the project keeps an icon allowlist there, add `group` to it.

- [ ] **Step 3: Admin users page**

```tsx
// src/pages/admin/users.tsx
import { useState } from 'react';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getMemberSsrProps } from '@/lib/auth-server';
import {
  adminFetcher,
  approveSignupRequest,
  rejectSignupRequest,
  updateMember,
  type SignupListResponse,
} from '@/lib/admin-api';
import type { RegistryMember } from '@/lib/registry-user';

// จัดการผู้ใช้: แท็บคิวผู้สมัคร (อนุมัติ/ปฏิเสธ) + แท็บสมาชิก (แก้ไข/
// เปิด-ปิดการใช้งาน). ทุก mutation จบด้วย mutate() ให้ SWR ดึงสถานะจริง
// จากเซิร์ฟเวอร์ ไม่เดา state เอง
export const getServerSideProps = getMemberSsrProps;

function UsersAdminPage() {
  const [tab, setTab] = useState<'queue' | 'members'>('queue');
  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 font-display text-[13px] font-medium transition ${
      active
        ? 'bg-green-050 text-green-deep'
        : 'text-ink-faint hover:bg-black/[0.04]'
    }`;
  return (
    <AdminLayout title="จัดการผู้ใช้">
      <div className="mb-5 flex gap-1">
        <button type="button" onClick={() => setTab('queue')} className={tabClass(tab === 'queue')}>
          คิวผู้สมัคร
        </button>
        <button type="button" onClick={() => setTab('members')} className={tabClass(tab === 'members')}>
          สมาชิก
        </button>
      </div>
      {tab === 'queue' ? <SignupQueue /> : <MembersTable />}
    </AdminLayout>
  );
}

export default withMemberGuard(UsersAdminPage);

function SignupQueue() {
  const { data, error, mutate } = useSWR<SignupListResponse>(
    '/api/admin/signups',
    adminFetcher
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setActionError('');
    try {
      await fn();
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return <p className="text-sm text-red-600">โหลดคิวผู้สมัครไม่สำเร็จ: {String(error.message ?? error)}</p>;
  }
  if (!data) return <p className="text-sm text-ink-faint">กำลังโหลด…</p>;
  if (data.signups.length === 0) {
    return <p className="text-sm text-ink-faint">ไม่มีผู้สมัครรออนุมัติ</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
      {data.signups.map((s) => (
        <div key={s.id} className="rounded-2xl border border-black/[0.07] bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-[15px] font-semibold text-ink">{s.name}</p>
            <p className="text-xs text-ink-mute">
              สมัครเมื่อ {new Date(s.appliedAt).toLocaleString('th-TH')}
            </p>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {s.position} · {s.department} · {s.phone}
            {s.email ? ` · ${s.email}` : ''}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="role (เช่น staff)"
              value={roles[s.id] ?? ''}
              onChange={(e) => setRoles({ ...roles, [s.id]: e.target.value })}
              className="w-40 rounded-xl border border-black/[0.12] px-3 py-1.5 text-sm outline-none focus:border-emerald"
            />
            <button
              type="button"
              disabled={busyId === s.id || !(roles[s.id] ?? '').trim()}
              onClick={() => run(s.id, () => approveSignupRequest(s.id, (roles[s.id] ?? '').trim()))}
              className="rounded-full bg-emerald px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
            >
              อนุมัติ
            </button>
            <input
              type="text"
              placeholder="เหตุผลที่ปฏิเสธ (ไม่บังคับ)"
              value={notes[s.id] ?? ''}
              onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })}
              className="w-52 rounded-xl border border-black/[0.12] px-3 py-1.5 text-sm outline-none focus:border-emerald"
            />
            <button
              type="button"
              disabled={busyId === s.id}
              onClick={() => run(s.id, () => rejectSignupRequest(s.id, notes[s.id] ?? ''))}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              ปฏิเสธ
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const EDIT_FIELDS = [
  { key: 'name', label: 'ชื่อ-นามสกุล' },
  { key: 'position', label: 'ตำแหน่ง' },
  { key: 'department', label: 'แผนก' },
  { key: 'role', label: 'role' },
  { key: 'phone', label: 'เบอร์โทร' },
] as const;

function MembersTable() {
  const { data, error, mutate } = useSWR<{ members: RegistryMember[] }>(
    '/api/admin/users',
    adminFetcher
  );
  const [editing, setEditing] = useState<RegistryMember | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setActionError('');
    try {
      await fn();
      await mutate();
      setEditing(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return <p className="text-sm text-red-600">โหลดรายชื่อสมาชิกไม่สำเร็จ: {String(error.message ?? error)}</p>;
  }
  if (!data) return <p className="text-sm text-ink-faint">กำลังโหลด…</p>;

  return (
    <div className="flex flex-col gap-3">
      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
      {data.members.map((m) => (
        <div
          key={m.id}
          className={`rounded-2xl border border-black/[0.07] bg-white p-5 ${
            m.isActive ? '' : 'opacity-60'
          }`}
        >
          {editing?.id === m.id ? (
            <div className="flex flex-col gap-3">
              {EDIT_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">{f.label}</span>
                  <input
                    type="text"
                    value={editing[f.key]}
                    onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                    className="w-full rounded-xl border border-black/[0.12] px-3 py-1.5 text-sm outline-none focus:border-emerald"
                  />
                </label>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() =>
                    run(m.id, () =>
                      updateMember(m.id, {
                        name: editing.name,
                        position: editing.position,
                        department: editing.department,
                        role: editing.role,
                        phone: editing.phone,
                      })
                    )
                  }
                  className="rounded-full bg-emerald px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-deep disabled:opacity-50"
                >
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-full px-4 py-1.5 text-sm font-medium text-ink-soft hover:bg-black/[0.04]"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-[15px] font-semibold text-ink">
                  {m.name || '(ไม่มีชื่อ)'}
                  {!m.isActive ? (
                    <span className="ml-2 rounded-full bg-black/[0.06] px-2 py-px text-[11px] font-medium text-ink-mute">
                      ปิดการใช้งาน
                    </span>
                  ) : null}
                  {m.isArchived ? (
                    <span className="ml-2 rounded-full bg-black/[0.06] px-2 py-px text-[11px] font-medium text-ink-mute">
                      archived
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {[m.position, m.department, m.role, m.phone].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(m)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-black/[0.04]"
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => {
                    const next = !m.isActive;
                    if (
                      !next &&
                      !window.confirm(`ปิดการใช้งานบัญชี "${m.name}" ?`)
                    ) {
                      return;
                    }
                    void run(m.id, () => updateMember(m.id, { isActive: next }));
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                    m.isActive
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-emerald-deep hover:bg-green-050'
                  }`}
                >
                  {m.isActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify types, lint, full test suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-api.ts src/components/admin/AdminLayout.tsx src/pages/admin/users.tsx
git commit -m "feat(users): /admin/users — signup queue + member management UI with sidebar badge"
```

---

### Task 10: Final verification

- [ ] **Step 1: Full suite**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean. If the build flags Next 16 API differences, consult `node_modules/next/dist/docs/` and fix.

- [ ] **Step 2: Manual smoke test (dev, no Clerk keys = dev-open)**

Run: `npm run dev`
- `/admin` → sidebar shows "จัดการผู้ใช้" (badge hidden if Mongo down — expected).
- `/admin/users` → page renders both tabs (data requires Mongo; error states must render readable Thai messages, not crash).
- `/apply` → redirects to `/admin` (dev-open).
- `/sign-up` → shows the dev-open note card.

- [ ] **Step 3: Manual smoke test with real env (if `.env.local` has Clerk + Mongo)**

- Sign in with a member account → `/admin/users` loads members from `db_namphrae.users`.
- Approve path needs a second (non-member) Clerk account: sign up → `/apply` → submit → queue shows it → approve with role → new account can enter `/admin`.
- Deactivate a test member → that account is redirected to `/apply` (deactivated card) on next `/admin` visit.
- Verify self-deactivation is blocked (button on own row returns "cannot_deactivate_self").

- [ ] **Step 4: Commit any fixes, then report**

Use superpowers:verification-before-completion before claiming done. Ops reminder for the user: **enable sign-up in the Clerk dashboard** — routing-side is now open, but the dashboard setting must allow registrations.
