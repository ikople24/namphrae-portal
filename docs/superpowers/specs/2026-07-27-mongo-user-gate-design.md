# Admin access gated by shared Mongo user registry

**Date:** 2026-07-27
**Status:** Approved by user (approach A)

## Goal

Make namphrae-portal's admin access work exactly like namphrae-map: a person can
use `/admin` (pages and APIs) only if they are signed in with Clerk **and** have
a record in the shared MongoDB user registry. Adding a user to that one registry
grants admin access to both apps.

## Context

- Both projects share the same `MONGODB_URI` (one Atlas cluster) and the same
  Clerk application, so `clerkId` values match across apps.
- namphrae-map keeps its registry in db `db_namphrae`, collection `users`,
  keyed by `clerkId` (see `namphrae-map/lib/requireDbUser.ts`).
- namphrae-portal stores its own data in a separate db `namphrae_portal`
  (native driver, `src/lib/mongodb.ts`). One Mongo connection can read both
  databases — no URI change and no new collection needed.
- Today the portal guards only `/api/admin/*` (Clerk + `ADMIN_EMAILS`
  allowlist); the `/admin` pages themselves have no server-side guard.

## Decisions (confirmed with user)

1. **Shared registry:** read `db_namphrae.users` directly — the same collection
   namphrae-map already uses. No portal-specific registry.
2. **Scope:** gate `/admin` pages and `/api/admin/*` only. The public portal
   page stays public.
3. **Remove `ADMIN_EMAILS`:** the Mongo registry becomes the single source of
   truth. Delete the allowlist logic and the env var from `.env.example`.

## Design

### 1. `src/lib/mongodb.ts` — access to the users db

Add `getUsersDb()` returning `client.db(process.env.MONGODB_USERS_DB || 'db_namphrae')`
on the existing cached client. `MONGODB_USERS_DB` is an optional escape hatch;
nothing needs to set it in practice.

### 2. `src/lib/auth-server.ts` — registry check in `requireAdmin`

Replace the `ADMIN_EMAILS` email-allowlist logic with a registry check:

- Clerk not configured → dev-open mode, unchanged (`{ userId: 'dev-open' }`).
- Clerk configured, no session → 401 (unchanged).
- Signed in → look up `users.findOne({ clerkId: userId })` in the users db.
  Missing → 403. Present → return `{ userId }`.
- Mongo not configured (file-store dev mode) → skip the registry check; Clerk
  sign-in alone suffices. Production always has Mongo, and Vercel cannot run
  the file store anyway, so this only affects local dev.
- The Clerk email lookup (`clerkClient.users.getUser`) is no longer needed and
  is removed.

### 3. Server-side guard for `/admin` pages

Port namphrae-map's `getMemberSsrProps` pattern:

- Add `getMemberSsrProps` to `auth-server.ts`: resolves `member: boolean` using
  the same rules as `requireAdmin` (dev-open → `true`).
- Each admin page (`admin/index.tsx`, `admin/data.tsx`, `admin/settings.tsx`,
  `admin/links/new.tsx`, `admin/links/[id].tsx`) exports
  `getServerSideProps = getMemberSsrProps` and renders a shared
  `<AccessDenied />` screen when `member` is false (signed out or not in the
  registry), instead of the admin UI.

### 4. Env cleanup

- `.env.example`: remove `ADMIN_EMAILS`; document the registry rule (user must
  exist in `db_namphrae.users`) in the Clerk section.
- `.env.local`: remove unused `NEXT_PUBLIC_IMAGE_BASE_URL` (leftover from
  namphrae-map); add `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` so Clerk uses the
  in-app sign-in page.

## Error handling

- Registry lookup failure (Mongo down) while Clerk is configured → treat as not
  a member (403 / access-denied screen). Fail closed.
- 401 vs 403 split matches namphrae-map: not signed in → 401, signed in but not
  registered → 403.

## Testing

The project has no test runner; verification is manual:

1. `npm run build` passes.
2. Dev-open mode (no Clerk/Mongo env) still opens `/admin` freely.
3. With real env: a Clerk user **in** `db_namphrae.users` can use `/admin` and
   the APIs; a signed-in user **not** in the registry gets the access-denied
   screen and 403 from `/api/admin/*`.

## Out of scope

- UI for managing the registry (users are added manually in Atlas, as with
  namphrae-map).
- Any change to namphrae-map.
- Gating the public portal page.
