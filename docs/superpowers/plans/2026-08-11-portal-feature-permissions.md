# Portal Feature Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มชั้นสิทธิ์รายฟีเจอร์ + ผู้จัดการ Portal ทับ binary member gate เดิม บังคับใช้จริงทั้ง SSR และ API

**Architecture:** Collection ใหม่ `namphrae_portal.userAccess` (ไม่แตะ registry ที่แชร์) → pure function `resolveAccess` ตัดสินสิทธิ์ → `checkAdmin` คืน identity พร้อม `features`/`isManager` → guards ใหม่ `requireFeature`/`requireManager` (API) และ `getFeatureSsrProps`/`getManagerSsrProps` (หน้า) → sidebar กรองเมนูจาก `/api/admin/me`

**Tech Stack:** Next.js 16 Pages Router, Clerk, MongoDB driver, zod 4, vitest, SWR

**Spec:** `docs/superpowers/specs/2026-08-11-portal-feature-permissions-design.md`

**Feature → route mapping (จากการอ่านโค้ดจริง):**

| feature | หน้า | API |
|---|---|---|
| `links` | `/admin`, `/admin/links/new`, `/admin/links/[id]` | `links/index.ts`, `links/[id].ts`, `links/reorder.ts` |
| `categories` | `/admin/categories` | `categories.ts` |
| `calendar` | `/admin/calendar{,/new,/[id]}` | `calendar/index.ts`, `calendar/[id].ts` |
| `map` | `/admin/map{,/viewer,/[layerId]}` | `map/**` ทั้ง 9 ไฟล์ |
| `data` | `/admin/data` | `config.ts` เฉพาะ **PUT** (full import) |
| `settings` | `/admin/settings` | `site.ts`, `line-group.ts`, `upload.ts` |
| ผู้จัดการเท่านั้น | `/admin/users` | `users/index.ts`, `users/[id].ts`, `users/[id]/access.ts` (ใหม่), `signups/index.ts`, `signups/[id]/approve.ts`, `signups/[id]/reject.ts` |
| สมาชิกทุกคน | — | `me.ts`, `config.ts` เฉพาะ **GET** (หน้า links/categories/data/settings อ่านร่วมกัน) |

---

### Task 1: Pure access model (`user-access.ts`)

**Files:**
- Create: `src/lib/user-access.ts`
- Test: `src/lib/user-access.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/user-access.test.ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FEATURES,
  FEATURES,
  firstAllowedPath,
  hasFeature,
  isEnvManager,
  resolveAccess,
} from '@/lib/user-access';

describe('resolveAccess', () => {
  it('ไม่มี doc → ชุดเริ่มต้น calendar+data ไม่ใช่ผู้จัดการ', () => {
    const r = resolveAccess({ doc: null, clerkId: 'user_a', managerEnvId: undefined });
    expect(r).toEqual({ isManager: false, features: ['calendar', 'data'] });
    expect(r.features).toEqual([...DEFAULT_FEATURES]);
  });

  it('clerkId ตรงกับ env → ผู้จัดการเสมอ เห็นครบ แม้ doc บอกไม่ใช่', () => {
    const r = resolveAccess({
      doc: { features: [], isManager: false },
      clerkId: 'user_mgr',
      managerEnvId: 'user_mgr',
    });
    expect(r.isManager).toBe(true);
    expect(r.features).toEqual([...FEATURES]);
  });

  it('doc.isManager → เห็นทุกฟีเจอร์', () => {
    const r = resolveAccess({ doc: { features: ['map'], isManager: true }, clerkId: 'user_b', managerEnvId: undefined });
    expect(r.isManager).toBe(true);
    expect(r.features).toEqual([...FEATURES]);
  });

  it('doc มี features [] → ไม่เห็นอะไรเลย (ไม่ fallback เป็น default)', () => {
    const r = resolveAccess({ doc: { features: [], isManager: false }, clerkId: 'user_c', managerEnvId: undefined });
    expect(r.features).toEqual([]);
  });

  it('กรอง key แปลกทิ้ง และคืนตามลำดับ canonical', () => {
    const r = resolveAccess({
      doc: { features: ['settings', 'hack', 'links'], isManager: false },
      clerkId: 'user_d',
      managerEnvId: undefined,
    });
    expect(r.features).toEqual(['links', 'settings']);
  });

  it('env ว่าง ("" หรือ undefined) ไม่ทำให้ใครเป็นผู้จัดการ', () => {
    expect(resolveAccess({ doc: null, clerkId: '', managerEnvId: '' }).isManager).toBe(false);
    expect(isEnvManager('', '')).toBe(false);
    expect(isEnvManager(null, undefined)).toBe(false);
  });
});

describe('hasFeature / firstAllowedPath', () => {
  it('ผู้จัดการมีทุกฟีเจอร์ และหน้าแรกคือ /admin', () => {
    const mgr = { isManager: true, features: [...FEATURES] };
    expect(hasFeature(mgr, 'settings')).toBe(true);
    expect(firstAllowedPath(mgr)).toBe('/admin');
  });

  it('สมาชิก default → หน้าแรกคือ /admin/calendar', () => {
    const r = resolveAccess({ doc: null, clerkId: 'u', managerEnvId: undefined });
    expect(hasFeature(r, 'links')).toBe(false);
    expect(firstAllowedPath(r)).toBe('/admin/calendar');
  });

  it('ไม่มีสิทธิ์เลย → null', () => {
    expect(firstAllowedPath({ isManager: false, features: [] })).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/user-access.test.ts`
Expected: FAIL — Cannot find module '@/lib/user-access'

- [ ] **Step 3: Write implementation**

```ts
// src/lib/user-access.ts
// Pure model ของชั้นสิทธิ์รายฟีเจอร์ (namphrae_portal.userAccess) — client-safe,
// ห้าม import mongo/clerk. กฎทั้งหมดตรึงด้วย user-access.test.ts
// (แพทเทิร์นเดียวกับ admin-registry-gate.ts)

export const FEATURES = ['links', 'categories', 'calendar', 'map', 'data', 'settings'] as const;
export type FeatureKey = (typeof FEATURES)[number];

// สมาชิกที่ผู้จัดการยังไม่เคยตั้งค่า (รวมสมาชิกเก่าทุกคน ณ วัน deploy)
export const DEFAULT_FEATURES: readonly FeatureKey[] = ['calendar', 'data'];

// หน้าแรกของแต่ละฟีเจอร์ — ใช้เป็นปลายทาง redirect เมื่อเข้าหน้าที่ไม่มีสิทธิ์
// ลำดับความสำคัญ = ลำดับใน FEATURES
export const FEATURE_HOME: Record<FeatureKey, string> = {
  links: '/admin',
  categories: '/admin/categories',
  calendar: '/admin/calendar',
  map: '/admin/map',
  data: '/admin/data',
  settings: '/admin/settings',
};

export const FEATURE_LABELS: { key: FeatureKey; label: string }[] = [
  { key: 'links', label: 'ลิงก์บริการ' },
  { key: 'categories', label: 'หมวดหมู่' },
  { key: 'calendar', label: 'ปฏิทิน' },
  { key: 'map', label: 'แผนที่' },
  { key: 'data', label: 'นำเข้า/ส่งออก' },
  { key: 'settings', label: 'ตั้งค่าเว็บ' },
];

export type ResolvedAccess = { features: FeatureKey[]; isManager: boolean };

export function isEnvManager(
  clerkId: string | null | undefined,
  managerEnvId: string | undefined
): boolean {
  return Boolean(managerEnvId) && clerkId === managerEnvId;
}

// doc ไม่มี = ใช้ default; doc มีแต่ features ว่าง = ไม่เห็นอะไรเลย (ตั้งใจ —
// ผู้จัดการถอดหมดแล้ว ต้องไม่เด้งกลับเป็น default เอง)
export function resolveAccess(args: {
  doc: { features?: unknown; isManager?: unknown } | null;
  clerkId: string;
  managerEnvId: string | undefined;
}): ResolvedAccess {
  const isManager =
    isEnvManager(args.clerkId, args.managerEnvId) || args.doc?.isManager === true;
  if (isManager) return { isManager: true, features: [...FEATURES] };
  if (!args.doc) return { isManager: false, features: [...DEFAULT_FEATURES] };
  const stored = Array.isArray(args.doc.features) ? args.doc.features : [];
  return { isManager: false, features: FEATURES.filter((f) => stored.includes(f)) };
}

export function hasFeature(
  access: { features: FeatureKey[]; isManager: boolean },
  feature: FeatureKey
): boolean {
  return access.isManager || access.features.includes(feature);
}

export function firstAllowedPath(access: ResolvedAccess): string | null {
  if (access.isManager) return '/admin';
  const first = FEATURES.find((f) => access.features.includes(f));
  return first ? FEATURE_HOME[first] : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/user-access.test.ts`
Expected: PASS ทุกข้อ

- [ ] **Step 5: Commit**

```bash
git add src/lib/user-access.ts src/lib/user-access.test.ts
git commit -m "feat(access): pure model สิทธิ์รายฟีเจอร์ + ผู้จัดการ"
```

---

### Task 2: zod schema ของ PATCH access

**Files:**
- Modify: `src/lib/user-schema.ts` (ท้ายไฟล์)
- Test: `src/lib/user-schema.test.ts` (เพิ่ม describe ใหม่)

- [ ] **Step 1: Write the failing test** — เพิ่มท้าย `src/lib/user-schema.test.ts`

```ts
import { accessPatchSchema } from '@/lib/user-schema';

describe('accessPatchSchema', () => {
  it('รับ features อย่างเดียว หรือ isManager อย่างเดียว', () => {
    expect(accessPatchSchema.safeParse({ features: ['calendar', 'map'] }).success).toBe(true);
    expect(accessPatchSchema.safeParse({ isManager: true }).success).toBe(true);
    expect(accessPatchSchema.safeParse({ features: [] }).success).toBe(true);
  });

  it('ปฏิเสธ object ว่าง และ feature key ที่ไม่รู้จัก', () => {
    expect(accessPatchSchema.safeParse({}).success).toBe(false);
    expect(accessPatchSchema.safeParse({ features: ['hack'] }).success).toBe(false);
    expect(accessPatchSchema.safeParse({ isManager: 'yes' }).success).toBe(false);
  });
});
```

(ไฟล์ test เดิม import `describe/expect/it` จาก vitest อยู่แล้ว — เพิ่มเฉพาะ import `accessPatchSchema` เข้า import block เดิม)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/user-schema.test.ts`
Expected: FAIL — accessPatchSchema is not exported

- [ ] **Step 3: Implement** — เพิ่มท้าย `src/lib/user-schema.ts`

```ts
import { FEATURES } from '@/lib/user-access'; // ← ย้ายไป import block บนสุดของไฟล์

// PATCH /api/admin/users/[id]/access — ผู้จัดการแก้สิทธิ์รายคน
export const accessPatchSchema = z
  .object({
    features: z.array(z.enum(FEATURES)).optional(),
    isManager: z.boolean().optional(),
  })
  .refine((v) => v.features !== undefined || v.isManager !== undefined, {
    message: 'ต้องมีอย่างน้อยหนึ่งฟิลด์',
  });
export type AccessPatchBody = z.infer<typeof accessPatchSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/user-schema.test.ts`
Expected: PASS (ของเดิม + ของใหม่)

- [ ] **Step 5: Commit**

```bash
git add src/lib/user-schema.ts src/lib/user-schema.test.ts
git commit -m "feat(access): schema PATCH สิทธิ์รายคน"
```

---

### Task 3: Mongo store ของ userAccess

**Files:**
- Create: `src/lib/user-access-store.ts`

โค้ดเป็น thin Mongo wrapper (logic จริงอยู่ใน pure function ที่มี test แล้ว) — codebase นี้ไม่ unit-test ชั้น store ตรง ๆ อยู่แล้ว

- [ ] **Step 1: Write the store**

```ts
// src/lib/user-access-store.ts
// SERVER ONLY — Mongo access ของชั้นสิทธิ์ Portal (namphrae_portal.userAccess)
// อยู่ใน db ของ Portal เอง ไม่แตะ db_namphrae.users ที่แชร์กับอีกสองแอป
import type { Collection } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { DEFAULT_FEATURES, type FeatureKey } from '@/lib/user-access';

export type UserAccessDoc = {
  clerkId: string;
  features: FeatureKey[];
  isManager: boolean;
  updatedAt: Date;
  updatedBy: string;
};

async function accessCollection(): Promise<Collection<UserAccessDoc>> {
  const db = await getDb();
  return db.collection<UserAccessDoc>('userAccess');
}

let indexesEnsured = false;
let indexAttempts = 0;
// เหตุผลเดียวกับ signups-store.ts: retry ชั่วคราวได้ แต่พังถาวรอย่า retry ไม่จบ
const MAX_INDEX_ATTEMPTS = 3;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured || indexAttempts >= MAX_INDEX_ATTEMPTS) return;
  indexAttempts += 1;
  indexesEnsured = true;
  try {
    const col = await accessCollection();
    await col.createIndexes([{ key: { clerkId: 1 }, unique: true }]);
  } catch (err) {
    indexesEnsured = false;
    console.warn(
      `userAccess: createIndexes failed (attempt ${indexAttempts}/${MAX_INDEX_ATTEMPTS})`,
      err
    );
  }
}

export async function getAccessDoc(
  clerkId: string
): Promise<{ features?: unknown; isManager?: unknown } | null> {
  const col = await accessCollection();
  return col.findOne({ clerkId }, { projection: { features: 1, isManager: 1 } });
}

export async function getAccessMap(
  clerkIds: string[]
): Promise<Map<string, { features?: unknown; isManager?: unknown }>> {
  if (clerkIds.length === 0) return new Map();
  const col = await accessCollection();
  const docs = await col
    .find(
      { clerkId: { $in: clerkIds } },
      { projection: { clerkId: 1, features: 1, isManager: 1 } }
    )
    .toArray();
  return new Map(docs.map((d) => [d.clerkId, d]));
}

export async function upsertAccess(
  clerkId: string,
  patch: { features?: FeatureKey[]; isManager?: boolean },
  updatedBy: string
): Promise<void> {
  await ensureIndexes();
  const col = await accessCollection();
  const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy };
  if (patch.features !== undefined) set.features = [...new Set(patch.features)];
  if (patch.isManager !== undefined) set.isManager = patch.isManager;
  // upsert ครั้งแรกที่ส่งมาแค่บาง field: field ที่เหลือต้องได้ค่า default
  // ไม่ใช่หายไปเฉย ๆ (doc ที่มี features แต่ไม่มี isManager อ่านแล้วกำกวม)
  const onInsert: Record<string, unknown> = {};
  if (patch.features === undefined) onInsert.features = [...DEFAULT_FEATURES];
  if (patch.isManager === undefined) onInsert.isManager = false;
  const update: Record<string, unknown> = { $set: set };
  if (Object.keys(onInsert).length > 0) update.$setOnInsert = onInsert;
  await col.updateOne({ clerkId }, update, { upsert: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add src/lib/user-access-store.ts
git commit -m "feat(access): store userAccess ใน db ของ portal เอง"
```

---

### Task 4: ขยาย auth-server — identity มี features/isManager + guards ใหม่

**Files:**
- Modify: `src/lib/auth-server.ts`

- [ ] **Step 1: Rewrite** — แก้ตามนี้ (โครงไฟล์เดิม บรรทัดอ้างอิงจากไฟล์ปัจจุบัน):

เพิ่ม imports:

```ts
import {
  FEATURES,
  firstAllowedPath,
  hasFeature,
  resolveAccess,
  type FeatureKey,
} from '@/lib/user-access';
import { getAccessDoc } from '@/lib/user-access-store';
```

แทนที่ `AdminIdentity` (บรรทัด 19):

```ts
export type AdminIdentity = {
  userId: string;
  email?: string;
  features: FeatureKey[];
  isManager: boolean;
};
```

ใน `checkAdmin`:
- dev-open (บรรทัด 29) →
  `return { ok: true, identity: { userId: 'dev-open', email: 'dev@local', features: [...FEATURES], isManager: true } };`
- Clerk-แต่ไม่มี-Mongo ฝั่ง dev (บรรทัด 49) →
  `return { ok: true, identity: { userId, features: [...FEATURES], isManager: true } };`
- ใน try block หลัง registry lookup สำเร็จ (แทนบรรทัด 58-59):

```ts
    const email = (user.email ?? user.name) as string | undefined;
    const access = resolveAccess({
      doc: await getAccessDoc(userId),
      clerkId: userId,
      managerEnvId: process.env.PORTAL_MANAGER_CLERK_ID,
    });
    return { ok: true, identity: { userId, email, ...access } };
```

(อยู่ใน try เดิม → อ่าน userAccess พลาด = 403 fail-closed อัตโนมัติ)

เพิ่ม guards ใหม่หลัง `requireAdmin`:

```ts
/** Guard API ตามฟีเจอร์: สมาชิกที่ไม่ได้รับฟีเจอร์นั้น → 403 feature_denied */
export async function requireFeature(
  req: NextApiRequest,
  res: NextApiResponse,
  feature: FeatureKey
): Promise<AdminIdentity | null> {
  const admin = await requireAdmin(req, res);
  if (!admin) return null;
  if (!hasFeature(admin, feature)) {
    res.status(403).json({ error: 'feature_denied' });
    return null;
  }
  return admin;
}

/** Guard API เฉพาะผู้จัดการ (จัดการสมาชิก/สิทธิ์) */
export async function requireManager(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AdminIdentity | null> {
  const admin = await requireAdmin(req, res);
  if (!admin) return null;
  if (!admin.isManager) {
    res.status(403).json({ error: 'manager_only' });
    return null;
  }
  return admin;
}
```

แทนที่ `getMemberSsrProps` (บรรทัด 97-105) ด้วย:

```ts
export type AdminPageProps = { member: boolean; forbidden?: boolean };

// SSR guard ราย feature: ไม่ใช่สมาชิก → /apply (เหมือนเดิม); เป็นสมาชิกแต่ไม่มี
// สิทธิ์หน้านี้ → เด้งไปหน้าแรกที่มีสิทธิ์; ไม่มีสิทธิ์อะไรเลย → การ์ด forbidden
// (ห้าม redirect ไม่งั้นวนลูป). ปลายทาง redirect ผ่าน guard ของตัวเองเสมอ
// เพราะ firstAllowedPath เลือกจาก features ของคนนั้นเอง — ไม่มีลูป
function buildSsrGuard(
  allowed: (identity: AdminIdentity) => boolean
): GetServerSideProps<AdminPageProps> {
  return async (ctx) => {
    const check = await checkAdmin(ctx.req);
    if (!check.ok) {
      if (check.status === 403 && isClerkConfigured()) {
        return { redirect: { destination: '/apply', permanent: false } };
      }
      return { props: { member: false } };
    }
    if (allowed(check.identity)) return { props: { member: true } };
    const destination = firstAllowedPath(check.identity);
    if (destination) return { redirect: { destination, permanent: false } };
    return { props: { member: true, forbidden: true } };
  };
}

export function getFeatureSsrProps(feature: FeatureKey): GetServerSideProps<AdminPageProps> {
  return buildSsrGuard((identity) => hasFeature(identity, feature));
}

export const getManagerSsrProps: GetServerSideProps<AdminPageProps> = buildSsrGuard(
  (identity) => identity.isManager
);
```

หมายเหตุ: ลบ `getMemberSsrProps` ทิ้ง — Task 6 จะเปลี่ยนทุกหน้าไปใช้ตัวใหม่ (typecheck จะบังคับให้ไม่มีหน้าไหนหลุด)

- [ ] **Step 2: Typecheck (คาดว่า fail ที่ pages ที่ยังอ้าง getMemberSsrProps)**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: error เฉพาะ `getMemberSsrProps` ที่หายไป (13 หน้า) — เป็น checklist ของ Task 6

- [ ] **Step 3: Commit ร่วมกับ Task 5-6** (ยัง build ไม่ผ่าน อย่าเพิ่ง commit)

---

### Task 5: MemberGuard — รองรับ forbidden

**Files:**
- Modify: `src/components/admin/MemberGuard.tsx`

- [ ] **Step 1: เพิ่ม FeatureDenied + แก้ HOC** — แทนที่ `withMemberGuard` (บรรทัด 62-70):

```tsx
// การ์ดสำหรับสมาชิกที่ยังไม่ได้รับสิทธิ์ฟีเจอร์ใดเลย (getFeatureSsrProps ส่ง
// forbidden: true มาแทนการ redirect — คนไม่มีสิทธิ์สักหน้าไม่มีที่ให้เด้งไป)
export function FeatureDenied() {
  return (
    <>
      <Head>
        <title>ยังไม่ได้รับสิทธิ์ · Namphrae Portal</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-5 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">
          ยังไม่ได้รับสิทธิ์ใช้งาน
        </h1>
        <p className="max-w-md text-sm text-ink-soft">
          บัญชีของคุณเป็นสมาชิกแล้ว แต่ยังไม่ได้รับสิทธิ์ใช้งานส่วนใดของหลังบ้าน
          กรุณาติดต่อผู้จัดการระบบเพื่อขอเปิดสิทธิ์
        </p>
        <Link
          href="/"
          className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:bg-black/[0.04]"
        >
          กลับหน้าหลัก
        </Link>
      </div>
    </>
  );
}

// Wraps an admin page component: AccessDenied เมื่อไม่ใช่สมาชิก,
// FeatureDenied เมื่อเป็นสมาชิกที่ไม่มีสิทธิ์ฟีเจอร์ใดเลย
export function withMemberGuard<P extends object>(Page: ComponentType<P>) {
  function Guarded({
    member,
    forbidden,
    ...rest
  }: P & { member: boolean; forbidden?: boolean }) {
    if (!member) return <AccessDenied />;
    if (forbidden) return <FeatureDenied />;
    return <Page {...(rest as P)} />;
  }
  return Guarded;
}
```

---

### Task 6: สลับ SSR guard ทั้ง 13 หน้า

**Files (Modify ทั้งหมด — เปลี่ยนเฉพาะ import + บรรทัด getServerSideProps):**

| ไฟล์ | เปลี่ยนเป็น |
|---|---|
| `src/pages/admin/index.tsx` | `getFeatureSsrProps('links')` |
| `src/pages/admin/links/new.tsx` | `getFeatureSsrProps('links')` |
| `src/pages/admin/links/[id].tsx` | `getFeatureSsrProps('links')` |
| `src/pages/admin/categories.tsx` | `getFeatureSsrProps('categories')` |
| `src/pages/admin/calendar/index.tsx` | `getFeatureSsrProps('calendar')` |
| `src/pages/admin/calendar/new.tsx` | `getFeatureSsrProps('calendar')` |
| `src/pages/admin/calendar/[id].tsx` | `getFeatureSsrProps('calendar')` |
| `src/pages/admin/map/index.tsx` | `getFeatureSsrProps('map')` |
| `src/pages/admin/map/viewer.tsx` | `getFeatureSsrProps('map')` |
| `src/pages/admin/map/[layerId].tsx` | `getFeatureSsrProps('map')` |
| `src/pages/admin/data.tsx` | `getFeatureSsrProps('data')` |
| `src/pages/admin/settings.tsx` | `getFeatureSsrProps('settings')` |
| `src/pages/admin/users.tsx` | `getManagerSsrProps` |

- [ ] **Step 1: แก้ทุกไฟล์** — แพทเทิร์นเดียวกันทุกไฟล์ ตัวอย่าง `users.tsx`:

```ts
// เดิม
import { getMemberSsrProps } from '@/lib/auth-server';
export const getServerSideProps = getMemberSsrProps;
// ใหม่
import { getManagerSsrProps } from '@/lib/auth-server';
export const getServerSideProps = getManagerSsrProps;
```

และตัวอย่าง `map/index.tsx`:

```ts
import { getFeatureSsrProps } from '@/lib/auth-server';
export const getServerSideProps = getFeatureSsrProps('map');
```

- [ ] **Step 2: ยืนยันไม่เหลือใครใช้ตัวเก่า**

Run: `grep -rn "getMemberSsrProps" src/ ; npx tsc --noEmit`
Expected: grep ว่าง, tsc ผ่าน

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS ทั้งหมด

- [ ] **Step 4: Commit (Task 4+5+6 ด้วยกัน — เป็นหน่วย compile เดียว)**

```bash
git add src/lib/auth-server.ts src/components/admin/MemberGuard.tsx src/pages/admin
git commit -m "feat(access): บังคับสิทธิ์รายฟีเจอร์ระดับ SSR ทั้ง 13 หน้า"
```

---

### Task 7: สลับ API guards ทั้ง 25 routes

**Files (Modify — เปลี่ยน import + บรรทัดแรกใน handler):**

- `requireFeature(req, res, 'links')`: `links/index.ts`, `links/[id].ts`, `links/reorder.ts`
- `requireFeature(req, res, 'categories')`: `categories.ts`
- `requireFeature(req, res, 'calendar')`: `calendar/index.ts`, `calendar/[id].ts`
- `requireFeature(req, res, 'map')`: `map/layers/index.ts`, `map/layers/[id]/index.ts`, `map/layers/[id]/versions.ts`, `map/layers/[id]/geojson.ts`, `map/upload-signature.ts`, `map/versions/[vid]/index.ts`, `map/versions/[vid]/download.ts`, `map/versions/[vid]/issues.ts`, `map/versions/[vid]/publish.ts`
- `requireFeature(req, res, 'settings')`: `site.ts`, `line-group.ts`, `upload.ts`
- `requireManager(req, res)`: `signups/index.ts`, `signups/[id]/approve.ts`, `signups/[id]/reject.ts`, `users/index.ts`, `users/[id].ts`
- คง `requireAdmin`: `me.ts` (+ เพิ่ม payload), `config.ts` (+ เช็ค PUT)

- [ ] **Step 1: แก้กลุ่ม requireFeature/requireManager** — แพทเทิร์นเดียวกันทุกไฟล์ ตัวอย่าง `site.ts`:

```ts
// เดิม
import { requireAdmin } from '@/lib/auth-server';
  const admin = await requireAdmin(req, res);
// ใหม่
import { requireFeature } from '@/lib/auth-server';
  const admin = await requireFeature(req, res, 'settings');
```

(ตัวแปร `admin` ที่เหลือในไฟล์ใช้ต่อได้เลย — type เดิม + field ใหม่)

- [ ] **Step 2: `config.ts`** — คง `requireAdmin` (GET เปิดให้สมาชิกทุกคน — หน้า links/categories/data/settings อ่านร่วมกัน) แต่ PUT (full import) เป็นของฟีเจอร์ data:

```ts
import { hasFeature } from '@/lib/user-access';
// ใน branch PUT ก่อน parse body:
  if (req.method === 'PUT') {
    if (!hasFeature(admin, 'data')) {
      return res.status(403).json({ error: 'feature_denied' });
    }
    const parsed = importConfigSchema.safeParse(req.body);
    ...
```

- [ ] **Step 3: `me.ts`** — เพิ่ม `features`/`isManager` ใน response ทั้งสองทาง:

```ts
    if (!isMongoConfigured()) {
      return res.status(200).json({
        name: null,
        position: null,
        email: admin.email ?? null,
        features: admin.features,
        isManager: admin.isManager,
      });
    }
    ...
    return res.status(200).json({
      name: typeof doc?.name === 'string' && doc.name ? doc.name : null,
      position:
        typeof doc?.position === 'string' && doc.position ? doc.position : null,
      email: admin.email ?? null,
      features: admin.features,
      isManager: admin.isManager,
    });
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test && grep -rln "requireAdmin(req" src/pages/api/admin`
Expected: tsc/test ผ่าน; grep เหลือแค่ `me.ts` กับ `config.ts`

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/admin
git commit -m "feat(access): บังคับสิทธิ์รายฟีเจอร์/ผู้จัดการทุก API หลังบ้าน"
```

---

### Task 8: Guard-coverage test (กัน route ใหม่หลุด)

**Files:**
- Create: `src/lib/api-guard-coverage.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/lib/api-guard-coverage.test.ts
// ทุกไฟล์ใต้ src/pages/api/admin ต้องเรียก guard สักตัว — requireAdmin เปล่า ๆ
// (สมาชิกทุกคนผ่าน) อนุญาตเฉพาะ allowlist ที่ตั้งใจไว้เท่านั้น route ใหม่ที่
// ลืมคิดเรื่องสิทธิ์จะตกเทสต์นี้ทันที
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_DIR = join(process.cwd(), 'src', 'pages', 'api', 'admin');
const BARE_REQUIRE_ADMIN_OK = new Set(['me.ts', 'config.ts']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('guard coverage: /api/admin/**', () => {
  for (const file of walk(API_DIR)) {
    const rel = relative(API_DIR, file);
    it(rel, () => {
      const src = readFileSync(file, 'utf8');
      const guarded =
        src.includes('requireFeature(') ||
        src.includes('requireManager(') ||
        (BARE_REQUIRE_ADMIN_OK.has(rel) && src.includes('requireAdmin('));
      expect(guarded, `${rel} ไม่มี guard หรือใช้ requireAdmin นอก allowlist`).toBe(true);
    });
  }
});
```

- [ ] **Step 2: Run — ต้องผ่านเลย (Task 7 ทำไว้แล้ว) และลองพิสูจน์ว่าเทสต์จับจริง**

Run: `npx vitest run src/lib/api-guard-coverage.test.ts`
Expected: PASS 25 ข้อ — จากนั้นลองแก้ `site.ts` กลับเป็น `requireAdmin` ชั่วคราว รัน expect FAIL แล้ว revert

- [ ] **Step 3: Commit**

```bash
git add src/lib/api-guard-coverage.test.ts
git commit -m "test(access): ตรึง guard ครบทุก route หลังบ้าน"
```

---

### Task 9: API กำหนดสิทธิ์รายคน + list สมาชิกพร้อมสิทธิ์

**Files:**
- Create: `src/pages/api/admin/users/[id]/access.ts`
- Modify: `src/pages/api/admin/users/index.ts`

- [ ] **Step 1: endpoint ใหม่**

```ts
// src/pages/api/admin/users/[id]/access.ts
import { ObjectId } from 'mongodb';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireManager } from '@/lib/auth-server';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { isEnvManager } from '@/lib/user-access';
import { upsertAccess } from '@/lib/user-access-store';
import { accessPatchSchema } from '@/lib/user-schema';

// PATCH /api/admin/users/[id]/access — ผู้จัดการแก้สิทธิ์ฟีเจอร์/สถานะผู้จัดการ
// รายคน ([id] = _id ของ registry doc เหมือน users/[id].ts) กันล็อกเอาต์สองชั้น:
// ถอดผู้จัดการตัวเองไม่ได้ และถอด env manager ไม่ได้
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireManager(req, res);
  if (!admin) return;

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    if (!isMongoConfigured()) {
      return res.status(503).json({ error: 'mongo_required' });
    }

    const parsed = accessPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_input', issues: parsed.error.issues });
    }

    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'not_found' });

    const target = await (await getUsersDb())
      .collection('users')
      .findOne({ _id: new ObjectId(id) }, { projection: { clerkId: 1 } });
    if (!target) return res.status(404).json({ error: 'not_found' });

    const clerkId = typeof target.clerkId === 'string' ? target.clerkId : '';
    if (!clerkId) return res.status(400).json({ error: 'no_clerk_id' });

    if (parsed.data.isManager === false) {
      if (clerkId === admin.userId) {
        return res.status(400).json({ error: 'cannot_demote_self' });
      }
      if (isEnvManager(clerkId, process.env.PORTAL_MANAGER_CLERK_ID)) {
        return res.status(400).json({ error: 'cannot_demote_env_manager' });
      }
    }

    await upsertAccess(clerkId, parsed.data, admin.email ?? admin.userId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/users/[id]/access failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
```

- [ ] **Step 2: enrich GET /api/admin/users** — ใน `users/index.ts` (guard เปลี่ยนเป็น requireManager แล้วจาก Task 7) แทนที่ block query (บรรทัด 25-30 เดิม):

```ts
import { isEnvManager, resolveAccess } from '@/lib/user-access';
import { getAccessMap } from '@/lib/user-access-store';

    const docs = await (await getUsersDb())
      .collection('users')
      .find({})
      .sort({ name: 1 })
      .toArray();
    const members = docs.map(serializeMember);
    const managerEnvId = process.env.PORTAL_MANAGER_CLERK_ID;
    const accessMap = await getAccessMap(
      members.map((m) => m.clerkId).filter((c): c is string => Boolean(c))
    );
    return res.status(200).json({
      members: members.map((m) => ({
        ...m,
        access: m.clerkId
          ? resolveAccess({
              doc: accessMap.get(m.clerkId) ?? null,
              clerkId: m.clerkId,
              managerEnvId,
            })
          : null, // registry doc รุ่นเก่าที่ไม่มี clerkId — กำหนดสิทธิ์ไม่ได้
        isEnvManager: isEnvManager(m.clerkId, managerEnvId),
      })),
    });
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: ผ่าน (guard-coverage เห็นไฟล์ใหม่ใช้ requireManager → ผ่าน)

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/users
git commit -m "feat(access): API กำหนดสิทธิ์รายคน + list สมาชิกพร้อมสิทธิ์"
```

---

### Task 10: UI — sidebar กรองเมนู + ตารางสมาชิกแก้สิทธิ์ได้

**Files:**
- Modify: `src/lib/admin-api.ts` (เพิ่ม type + client fn)
- Modify: `src/components/admin/AdminLayout.tsx`
- Modify: `src/pages/admin/users.tsx`

- [ ] **Step 1: client API** — เพิ่มใน `src/lib/admin-api.ts` (ตามแพทเทิร์น `updateMember` ที่มีอยู่ ใช้ `jsonOrThrow` + fetch เดียวกัน):

```ts
import type { FeatureKey, ResolvedAccess } from '@/lib/user-access';
import type { RegistryMember } from '@/lib/registry-user';

export type MemberWithAccess = RegistryMember & {
  access: ResolvedAccess | null;
  isEnvManager: boolean;
};

export async function updateMemberAccess(
  id: string,
  patch: { features?: FeatureKey[]; isManager?: boolean }
): Promise<{ ok: boolean }> {
  return jsonOrThrow(
    await fetch(`/api/admin/users/${id}/access`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
  );
}
```

(ถ้า `RegistryMember` ถูก import ในไฟล์นี้อยู่แล้ว ไม่ต้องเพิ่มซ้ำ — ดู import block จริงตอนแก้)

- [ ] **Step 2: AdminLayout** — 3 จุด:

(a) เพิ่ม `feature` ให้ NAV (บรรทัด 15-23):

```ts
const NAV = [
  { href: '/admin', label: 'ลิงก์บริการ', icon: 'link', exact: true, feature: 'links' },
  { href: '/admin/calendar', label: 'ปฏิทินปฏิบัติงาน', icon: 'calendar_month', exact: false, feature: 'calendar' },
  { href: '/admin/categories', label: 'หมวดหมู่', icon: 'category', exact: false, feature: 'categories' },
  { href: '/admin/map', label: 'ไฟล์แผนที่', icon: 'layers', exact: false, feature: 'map' },
  { href: '/admin/settings', label: 'ตั้งค่าเว็บไซต์', icon: 'tune', exact: false, feature: 'settings' },
  { href: '/admin/users', label: 'จัดการผู้ใช้', icon: 'group', exact: false, feature: 'manager' },
  { href: '/admin/data', label: 'นำเข้า/ส่งออก', icon: 'swap_vert', exact: false, feature: 'data' },
] as const;
```

(b) ขยาย type ของ `me` SWR (บรรทัด 67-74) แล้วคำนวณเมนูที่เห็นได้ + ย้าย badge SWR สองตัวไปอยู่หลัง `me` และเปิดเฉพาะคนมีสิทธิ์ (กัน 403 ยิงซ้ำทุกนาที):

```ts
  const { data: me } = useSWR<{
    name: string | null;
    position: string | null;
    email: string | null;
    features?: string[];
    isManager?: boolean;
  }>(clerkOn ? '/api/admin/me' : null, adminFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  // dev-open เห็นครบ; Clerk on: รอ me ก่อนค่อยวาดเมนู (กันเมนูต้องห้ามแวบ)
  const nav = !clerkOn
    ? NAV
    : !me
      ? []
      : NAV.filter((item) =>
          item.feature === 'manager'
            ? me.isManager === true
            : me.isManager === true || (me.features ?? []).includes(item.feature)
        );

  const { data: signupCount } = useSWR<{ pendingCount: number }>(
    !clerkOn || me?.isManager ? '/api/admin/signups?countOnly=1' : null,
    adminFetcher,
    { refreshInterval: 60_000, shouldRetryOnError: false }
  );

  const { data: jobCount } = useSWR<JobCountResponse>(
    !clerkOn || me?.isManager || me?.features?.includes('calendar')
      ? adminCalendarKey({ status: 'pending', countOnly: true })
      : null,
    adminFetcher,
    { refreshInterval: 60_000, shouldRetryOnError: false }
  );
```

(หมายเหตุลำดับ: ประกาศ `me` ก่อน badge SWR สองตัว — ย้าย block เดิมขึ้น/ลงตาม)

(c) ใน JSX เปลี่ยน `NAV.map(...)` → `nav.map(...)` (บรรทัด 95)

- [ ] **Step 3: users.tsx — ส่วนสิทธิ์ในแถวสมาชิก**

เปลี่ยน import/type:

```ts
import {
  adminFetcher,
  approveSignupRequest,
  rejectSignupRequest,
  updateMember,
  updateMemberAccess,
  type MemberWithAccess,
  type SignupListResponse,
} from '@/lib/admin-api';
import { FEATURE_LABELS } from '@/lib/user-access';
import { getManagerSsrProps } from '@/lib/auth-server';

export const getServerSideProps = getManagerSsrProps;
```

ใน `MembersTable` เปลี่ยน SWR type เป็น `{ members: MemberWithAccess[] }` (ทั้งใน SignupQueue ที่ดึง role suggestions ด้วย — field เพิ่มไม่กระทบของเดิม) แล้วเพิ่ม block สิทธิ์ท้าย card สมาชิก (หลัง div `flex flex-wrap items-center justify-between gap-3` ปิด — อยู่ใน branch ไม่ได้กำลังแก้ไข):

```tsx
          {!editing || editing.id !== m.id ? (
            m.access ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-black/[0.06] pt-3">
                <span className="text-xs font-semibold text-ink-soft">สิทธิ์เข้าใช้:</span>
                {FEATURE_LABELS.map(({ key, label }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-1.5 text-xs ${
                      m.access!.isManager ? 'text-ink-mute' : 'text-ink-soft'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={m.access!.isManager || busyId === m.id}
                      checked={m.access!.isManager || m.access!.features.includes(key)}
                      onChange={(e) =>
                        void run(m.id, () =>
                          updateMemberAccess(m.id, {
                            features: e.target.checked
                              ? [...m.access!.features, key]
                              : m.access!.features.filter((f) => f !== key),
                          })
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
                <label className="ml-auto flex items-center gap-1.5 text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    disabled={m.isEnvManager || busyId === m.id}
                    checked={m.access!.isManager}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (
                        !next &&
                        !window.confirm(`ถอดสถานะผู้จัดการของ "${m.name}" ?`)
                      ) {
                        return;
                      }
                      void run(m.id, () =>
                        updateMemberAccess(m.id, { isManager: next })
                      );
                    }}
                  />
                  ผู้จัดการ
                  {m.isEnvManager ? (
                    <span
                      title="ผู้จัดการหลัก กำหนดจากตัวแปรระบบ ถอดจากหน้านี้ไม่ได้"
                      className="rounded-full bg-green-050 px-2 py-px text-[10px] font-medium text-green-deep"
                    >
                      หลัก
                    </span>
                  ) : null}
                </label>
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink-mute">
                บัญชีนี้ไม่มี clerkId — กำหนดสิทธิ์จากพอร์ทัลไม่ได้
              </p>
            )
          ) : null}
```

(การ save ใช้ `run()` เดิม → `mutate()` ดึงสถานะจริงกลับมา ตามแพทเทิร์นของหน้า)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: ผ่านทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-api.ts src/components/admin/AdminLayout.tsx src/pages/admin/users.tsx
git commit -m "feat(access): UI ผู้จัดการกำหนดสิทธิ์รายคน + sidebar กรองตามสิทธิ์"
```

---

### Task 11: env, docs, verify รวม

**Files:**
- Modify: `.env.example` (ถ้าไม่มีไฟล์นี้ ให้เพิ่มใน `README.md` อย่างเดียว)
- Modify: `README.md` (ส่วน access-control ราวบรรทัด 69-78)

- [ ] **Step 1: เพิ่ม env**

```bash
# .env.example — เพิ่มบรรทัด
# clerkId ของผู้จัดการ Portal หลัก (เป็นผู้จัดการเสมอ ถอดไม่ได้ — กันระบบไร้ผู้จัดการ)
PORTAL_MANAGER_CLERK_ID=
```

- [ ] **Step 2: README** — อัปเดตย่อหน้า access ให้ตรงความจริงใหม่: สมาชิก registry = เข้าหลังบ้านได้ แต่เห็นเฉพาะฟีเจอร์ที่ได้รับ (default: ปฏิทิน + นำเข้า/ส่งออก); ผู้จัดการ (`namphrae_portal.userAccess.isManager` หรือ `PORTAL_MANAGER_CLERK_ID`) เห็นครบ + จัดการสมาชิก/สิทธิ์

- [ ] **Step 3: Full verify**

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build`
Expected: ผ่านทั้งหมด

- [ ] **Step 4: Commit**

```bash
git add .env.example README.md
git commit -m "docs(access): env ผู้จัดการหลัก + อัปเดตกติกาสิทธิ์ใน README"
```

---

## Manual deployment steps (นอก scope โค้ด)

1. ตั้ง `PORTAL_MANAGER_CLERK_ID=user_2xzFppRzzgHlqfnuTatBJBAAzmF` ใน Railway (service `namphrae-portal`) **ก่อน** deploy
2. หลัง deploy: ผู้จัดการเข้าหน้า /admin/users แล้วเปิดสิทธิ์เพิ่มให้สมาชิกที่ต้องใช้ links/categories/map/settings (ทุกคนจะเหลือ calendar+data โดยอัตโนมัติ)
