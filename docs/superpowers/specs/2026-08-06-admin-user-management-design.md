# Admin User Management + Self-Signup — Design

**Date:** 2026-08-06
**Status:** Approved

## Problem

Adding a new member today requires two manual steps outside this portal: the person
creates a Clerk account, then an operator inserts a matching document into
`db_namphrae.users` via the smart-namphrae app (which writes through an external
backend). There is no applicant queue, no way to manage members from the portal, and
the portal's auth gate ignores `isActive`/`isArchived` — offboarded staff can still
access `/admin`.

## Goals

1. New members self-register from the portal and land in an approval queue.
2. Admins approve/reject applicants and manage all members (edit profile fields,
   deactivate) entirely from the portal — no round-trip to smart-namphrae.
3. Close the `isActive`/`isArchived` gap in the portal's auth gate.

Non-goals: LINE notification for new applicants (a sidebar badge suffices); role-based
permission tiers (the portal's binary member-or-not model stays); any change to
namphrae-map or smart-namphrae.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Signup flow | Self-signup + admin approval | No one slips in unreviewed; admins keep control |
| Write path on approval | Portal writes `db_namphrae.users` directly | Portal already holds a connection (`getUsersDb`); the smart-namphrae backend API is not reachable from this repo. Portal becomes a second writer — document shape must match the smart-namphrae schema exactly |
| Pending-application storage | New `pendingSignups` collection in the portal's own DB (`namphrae_portal`) | The other two apps treat mere existence of a `users` document as membership; a `status: 'pending'` doc in the shared collection would leak access. Portal-local storage keeps unapproved applicants invisible to all apps |
| Auth gate fix | Ship in this feature | The members tab gets a deactivate toggle; without the gate fix the toggle would be a no-op for this portal |

## Design

### 1. Applicant flow

- **`/sign-up`** — new page rendering Clerk `<SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />`.
  Update `/sign-in` (`src/pages/sign-in/[[...index]].tsx`) so `signUpUrl` points to
  `/sign-up` instead of back at sign-in.
- **`/apply`** — form for a signed-in, non-member user: ชื่อ (name), ตำแหน่ง
  (position), แผนก (department), เบอร์โทร (phone). Role is **not** self-selected;
  admin assigns it at approval. Submit → `POST /api/apply` → insert into
  `namphrae_portal.pendingSignups`:

  ```ts
  {
    clerkId: string,          // from session — never from the request body
    email: string | null,     // from Clerk session
    name: string,
    position: string,
    department: string,
    phone: string,
    status: 'pending' | 'approved' | 'rejected',
    rejectNote: string | null,
    appliedAt: Date,
    decidedAt: Date | null,
    decidedBy: string | null, // admin email ?? userId, same audit convention as CalendarJob
  }
  ```

- **`MemberGuard` / `getMemberSsrProps`** — a signed-in non-member is redirected to
  `/apply` instead of seeing `AccessDenied`. On `/apply`, state resolution:
  - no application or last one `rejected` → show the form (rejected: show
    `rejectNote`, allow re-apply — new pending doc)
  - `pending` → "รอการอนุมัติ" status screen
  - `approved` (edge: registry doc later deleted) → treat as no application
- Zod validation on the API; one live `pending` application per `clerkId`
  (re-submission while pending is a 409).

### 2. Admin — `/admin/users`

New sidebar entry **"จัดการผู้ใช้"** in `AdminLayout` with a badge showing the pending
count. Page has two tabs, guarded like every other admin page.

**Tab 1 — คิวผู้สมัคร (queue):** pending applications, newest first.
- **อนุมัติ:** admin picks a `role` (free-text with suggestions from existing member
  roles), then confirm. Server: if no `users` doc exists for that `clerkId`, insert
  one matching the smart-namphrae schema — `{ name, position, department, role,
  phone, profileImage: '', assignedTask: '', clerkId, isActive: true,
  isArchived: false, exitDate: null, exitNote: '', createdAt, updatedAt }` — then
  mark the application `approved`. If a `users` doc already exists (retry after a
  partial failure, or the person was meanwhile added via smart-namphrae), skip the
  insert and just mark the application `approved` — approve is idempotent, never a
  conflict.
- **ปฏิเสธ:** optional note, mark `rejected`.

**Tab 2 — สมาชิก (members):** all docs from `db_namphrae.users`.
- Edit: name, position, department, role, phone.
- Toggle **เปิด/ปิดการใช้งาน** (`isActive`); deactivating also stamps `exitDate`
  (reactivating clears it). `isArchived` is left to smart-namphrae.
- Self-lockout guard: an admin cannot deactivate their own account (server-enforced).
- Every write stamps `updatedAt`; portal never deletes `users` documents.

**APIs** (all behind `requireAdmin`):
- `GET /api/admin/signups` — list pending (+ count for the badge)
- `POST /api/admin/signups/[id]/approve` — body `{ role }`
- `POST /api/admin/signups/[id]/reject` — body `{ note? }`
- `GET /api/admin/users` / `PATCH /api/admin/users/[id]` — list / edit + isActive toggle

Client wrappers follow the existing `src/lib/admin-api.ts` pattern; UI uses SWR like
the other admin pages.

### 3. Auth gate fix (`src/lib/auth-server.ts`)

`checkAdmin`'s lookup changes from `findOne({ clerkId })` to:

```ts
findOne({ clerkId, isActive: { $ne: false }, isArchived: { $ne: true } })
```

`$ne` (not equality with `true`/`false`) because pre-schema documents may lack these
fields — absent means active, matching the schema defaults. Deactivated or archived
users now fail the portal gate (401/403 path unchanged, still fail-closed). This
changes only the portal; namphrae-map and smart-namphrae keep their own gates.

### 4. Error handling

- All admin mutations: Zod-validated bodies, 404 on unknown ids, 409 on duplicate
  pending applications (approve itself is idempotent — see queue tab).
- `POST /api/apply` requires a Clerk session (401 otherwise); `clerkId`/`email` come
  from the session, never the body.
- Mongo unavailable → same fail-closed behavior as the existing gate.
- Dev without Mongo: `pendingSignups` requires Mongo — `/apply` and `/admin/users`
  return a clear "requires MONGODB_URI" error in dev rather than adding a file
  backend (unlike jobs-store; user management data should never live in a local file).

### 5. Testing (vitest, unit)

- Gate: active member passes; `isActive: false` fails; `isArchived: true` fails;
  legacy doc without either field passes.
- Apply: Zod rejects missing/oversized fields; duplicate pending → 409; clerkId taken
  from session.
- Approve: inserted document shape matches the smart-namphrae schema exactly;
  member-already-exists skips insert and still marks approved (idempotent retry).
- Members: self-deactivation rejected; deactivate stamps `exitDate`, reactivate
  clears it.

## Ops notes

- Enable sign-up in the **Clerk dashboard** (currently only disabled via routing).
  Outsiders can then create Clerk accounts, but reach nothing until approved — the
  same exposure as today, since Clerk self-registration was already technically
  possible.
- No schema/env changes for the other two apps; no new env vars.
