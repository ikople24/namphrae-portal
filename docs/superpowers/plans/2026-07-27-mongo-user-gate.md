# Mongo User Registry Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate namphrae-portal's `/admin` pages and `/api/admin/*` routes behind the shared MongoDB user registry (`db_namphrae.users`, keyed by `clerkId`) — the same registry namphrae-map uses — replacing the `ADMIN_EMAILS` allowlist.

**Architecture:** One Mongo connection already reaches both databases; add `getUsersDb()` to read the registry db. `requireAdmin` (API guard) and a new `getMemberSsrProps` (SSR page guard) share one `checkAdmin` helper: Clerk session → registry lookup → allow/deny. Admin pages get wrapped in a `withMemberGuard` HOC that renders an `AccessDenied` screen when the `member` prop is false.

**Tech Stack:** Next.js (pages router), @clerk/nextjs ^7.6.1, native `mongodb` driver, Tailwind (project tokens: `bg-paper`, `text-ink`, `text-ink-soft`, `emerald-deep`, `font-display`).

**Spec:** `docs/superpowers/specs/2026-07-27-mongo-user-gate-design.md`

**Testing note:** This project has no test runner (scripts: dev/build/start/lint only). Per the approved spec, verification is `npm run build` (includes type-check) + a manual QA checklist in Task 6. Do not add a test framework.

**Read first (per AGENTS.md):** `node_modules/next/dist/docs/02-pages/04-api-reference/03-functions/get-server-side-props.md` — confirms `getServerSideProps` shape used in Task 2/4.

---

### Task 1: `getUsersDb()` in mongodb.ts

**Files:**
- Modify: `src/lib/mongodb.ts`

- [ ] **Step 1: Add the users-db accessor**

Append to the end of `src/lib/mongodb.ts` (after `getDb`):

```ts
// Shared user registry lives in a different db on the same cluster
// (namphrae-map's db). Membership in its `users` collection grants admin
// access — see src/lib/auth-server.ts.
const usersDbName = process.env.MONGODB_USERS_DB || 'db_namphrae';

export async function getUsersDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(usersDbName);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mongodb.ts
git commit -m "feat: add getUsersDb() for shared user registry db"
```

### Task 2: Registry check in auth-server.ts

**Files:**
- Modify: `src/lib/auth-server.ts` (full rewrite below)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/lib/auth-server.ts` with:

```ts
import type { GetServerSideProps, GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';
import { isClerkConfigured } from '@/lib/clerk-config';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';

// SERVER ONLY. Import this only from API routes / getServerSideProps — it pulls
// in @clerk/nextjs/server. For client-safe env checks use '@/lib/clerk-config'.
//
// Clerk is optional. When configured, /admin (pages and APIs) requires a
// signed-in user who ALSO exists in the shared user registry
// (db_namphrae.users, keyed by clerkId — the same registry namphrae-map uses).
// When Clerk is unset the app runs in "dev-open" mode so it boots and is fully
// testable with zero external services. NEVER deploy to production without Clerk.

export { isClerkConfigured } from '@/lib/clerk-config';

export type AdminIdentity = { userId: string; email?: string };

type AuthCheck =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; status: 401 | 403 };

async function checkAdmin(
  req: NextApiRequest | GetServerSidePropsContext['req']
): Promise<AuthCheck> {
  if (!isClerkConfigured()) {
    return { ok: true, identity: { userId: 'dev-open', email: 'dev@local' } }; // dev-open mode
  }

  const { getAuth } = await import('@clerk/nextjs/server');
  const { userId } = getAuth(req);
  if (!userId) return { ok: false, status: 401 };

  // File-store dev mode has no registry to consult; Clerk sign-in suffices.
  if (!isMongoConfigured()) return { ok: true, identity: { userId } };

  try {
    const db = await getUsersDb();
    const user = await db
      .collection('users')
      .findOne({ clerkId: userId }, { projection: { email: 1, name: 1 } });
    if (!user) return { ok: false, status: 403 };
    const email = (user.email ?? user.name) as string | undefined;
    return { ok: true, identity: { userId, email } };
  } catch {
    return { ok: false, status: 403 }; // registry unreachable → fail closed
  }
}

/**
 * Guard an API route. Returns the admin identity, or null after having already
 * written a 401/403 response.
 *
 *   const admin = await requireAdmin(req, res);
 *   if (!admin) return; // response already sent
 */
export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AdminIdentity | null> {
  const check = await checkAdmin(req);
  if (!check.ok) {
    res
      .status(check.status)
      .json({ error: check.status === 401 ? 'unauthorized' : 'forbidden' });
    return null;
  }
  return check.identity;
}

/**
 * SSR guard for /admin pages. Pages export this as getServerSideProps and wrap
 * their component in withMemberGuard (src/components/admin/MemberGuard.tsx),
 * which renders an access-denied screen when `member` is false.
 */
export const getMemberSsrProps: GetServerSideProps<{ member: boolean }> = async (
  ctx
) => {
  const check = await checkAdmin(ctx.req);
  return { props: { member: check.ok } };
};
```

Notes for the implementer:
- `ADMIN_EMAILS` logic and the `clerkClient.users.getUser` email lookup are gone on purpose. The audit-trail email now comes from the registry doc (`email` falling back to `name` — namphrae-map's docs carry `name`/`role`); API routes keep using `admin.email ?? admin.userId` unchanged.
- `getAuth` accepts both API-route requests and `ctx.req` from getServerSideProps (namphrae-map calls it the same way). If the union type is rejected by Clerk's `RequestLike`, narrow with `getAuth(req as NextApiRequest)` — do not change the callers.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit 0. (All existing `/api/admin/*` callers use only `requireAdmin` and `admin.email ?? admin.userId`, which are unchanged.)

- [ ] **Step 3: Confirm no ADMIN_EMAILS reference remains in src/**

Run: `grep -rn ADMIN_EMAILS src/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth-server.ts
git commit -m "feat: require registry membership (db_namphrae.users) for admin, drop ADMIN_EMAILS"
```

### Task 3: AccessDenied screen + withMemberGuard HOC

**Files:**
- Create: `src/components/admin/MemberGuard.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import Head from 'next/head';
import Link from 'next/link';
import type { ComponentType } from 'react';

// Shown on /admin pages when the visitor is signed out or signed in but not in
// the shared user registry (db_namphrae.users). Pairs with getMemberSsrProps
// in src/lib/auth-server.ts.
export function AccessDenied() {
  return (
    <>
      <Head>
        <title>ไม่มีสิทธิ์เข้าถึง · Namphrae Portal</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-5 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">
          ไม่มีสิทธิ์เข้าถึงหลังบ้าน
        </h1>
        <p className="max-w-md text-sm text-ink-soft">
          ต้องเข้าสู่ระบบด้วยบัญชีที่ได้รับสิทธิ์เท่านั้น
          หากต้องการสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ
        </p>
        <div className="flex gap-3">
          <Link
            href="/sign-in"
            className="rounded-full bg-emerald-deep px-4 py-2 text-sm font-medium text-white"
          >
            เข้าสู่ระบบ
          </Link>
          <Link
            href="/"
            className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:bg-black/[0.04]"
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </>
  );
}

// Wraps an admin page component: renders AccessDenied unless the `member`
// prop (from getMemberSsrProps) is true.
export function withMemberGuard<P extends object>(Page: ComponentType<P>) {
  function Guarded({ member, ...rest }: P & { member: boolean }) {
    if (!member) return <AccessDenied />;
    return <Page {...(rest as P)} />;
  }
  return Guarded;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/MemberGuard.tsx
git commit -m "feat: add AccessDenied screen and withMemberGuard HOC"
```

### Task 4: Wire the guard into all 5 admin pages

**Files:**
- Modify: `src/pages/admin/index.tsx`
- Modify: `src/pages/admin/data.tsx`
- Modify: `src/pages/admin/settings.tsx`
- Modify: `src/pages/admin/links/new.tsx`
- Modify: `src/pages/admin/links/[id].tsx`

Every page gets the same three edits. Component names per file: `AdminDashboard` (index), `DataPage` (data), `SettingsPage` (settings), `NewLinkPage` (links/new), `EditLinkPage` (links/[id]).

- [ ] **Step 1: Apply the three edits to each of the 5 pages**

(a) Add imports next to the existing `AdminLayout` import:

```tsx
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getMemberSsrProps } from '@/lib/auth-server';
```

(b) Demote the default export — e.g. in `src/pages/admin/index.tsx` change:

```tsx
export default function AdminDashboard() {
```

to:

```tsx
function AdminDashboard() {
```

(same one-line change in the other four files, with that file's component name).

(c) Append at the very end of each file:

```tsx
export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(AdminDashboard);
```

(substitute the file's component name in the `withMemberGuard(...)` call).

Note: importing `getMemberSsrProps` at page top level is safe — Next strips imports referenced only by `getServerSideProps` from the client bundle (namphrae-map uses this exact pattern in `pages/admin/index.tsx`).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Confirm every admin page is guarded**

Run: `grep -rln "getServerSideProps = getMemberSsrProps" src/pages/admin/`
Expected output — all five files:

```
src/pages/admin/index.tsx
src/pages/admin/data.tsx
src/pages/admin/settings.tsx
src/pages/admin/links/new.tsx
src/pages/admin/links/[id].tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin
git commit -m "feat: SSR-guard all admin pages with registry membership"
```

### Task 5: Env and docs cleanup

**Files:**
- Modify: `.env.example`
- Modify: `.env.local` (gitignored — edit but never commit)
- Modify: `README.md:58-65`

- [ ] **Step 1: Update `.env.example` Clerk section**

Replace lines 12–19 (the Clerk block, including the `ADMIN_EMAILS` comment and line) with:

```bash
# Clerk — admin authentication. Without both keys, /admin runs in dev-open mode
# (no login required). Set both to protect the admin in production.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
# Admin membership: a signed-in user must ALSO have a record in the shared user
# registry — MongoDB db "db_namphrae", collection "users", matched by clerkId
# (the same registry namphrae-map uses). Optional override:
# MONGODB_USERS_DB=db_namphrae
```

- [ ] **Step 2: Update `.env.local`**

Two edits (values of other lines stay untouched):
- Delete the `NEXT_PUBLIC_IMAGE_BASE_URL=...` line (leftover from namphrae-map, unused here).
- Add `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` after `CLERK_SECRET_KEY=...`.

- [ ] **Step 3: Update README.md section 2 (Clerk)**

Replace the block at README.md:58-65 with:

````markdown
### 2. Clerk (ป้องกันหลังบ้าน)
ถ้าไม่ตั้งค่า `/admin` จะเปิดให้ทุกคนเข้า (มี banner เตือน) — **ห้ามขึ้น production โดยไม่ตั้งค่า**

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
```

> สิทธิ์เข้าหลังบ้าน: ล็อกอิน Clerk อย่างเดียวไม่พอ — ต้องมี record ใน MongoDB
> db `db_namphrae` collection `users` (จับคู่ด้วย `clerkId`) ซึ่งเป็นทะเบียนผู้ใช้
> ชุดเดียวกับ namphrae-map (เพิ่มผู้ใช้ที่เดียว ใช้ได้ทั้งสองแอป)
````

- [ ] **Step 4: Confirm ADMIN_EMAILS is fully gone**

Run: `grep -rn ADMIN_EMAILS . --include="*.ts" --include="*.tsx" --include="*.md" --include=".env*" | grep -v node_modules | grep -v docs/superpowers`
Expected: no output.

- [ ] **Step 5: Commit (never add .env.local)**

```bash
git add .env.example README.md
git commit -m "docs: registry-based admin access; drop ADMIN_EMAILS from env docs"
```

### Task 6: Build + manual verification

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds; `/admin/*` pages are listed as server-rendered (ƒ) instead of static, because they now have `getServerSideProps`.

- [ ] **Step 2: Manual QA (requires the real `.env.local`)**

Run `npm run dev`, then verify:

1. `/admin` while signed out → AccessDenied screen (not the admin UI).
2. Sign in at `/sign-in` with a Clerk account that **exists** in `db_namphrae.users` → `/admin` works; saving a change in `/admin/settings` succeeds (API 200).
3. (If a second, unregistered Clerk account is available) sign in with it → AccessDenied screen, and `curl` or devtools shows `/api/admin/config` PUT → 403.
4. Dev-open check: `mv .env.local /tmp/env.bak && npm run dev` → `/admin` opens freely with the amber dev-open banner; then `mv /tmp/env.bak .env.local`.

- [ ] **Step 3: Report results to the user before merging/pushing**

State plainly which QA items passed and which were skipped (e.g. no second Clerk account available).
