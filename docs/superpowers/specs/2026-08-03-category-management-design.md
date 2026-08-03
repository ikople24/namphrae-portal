# Admin Category Management

**Date:** 2026-08-03
**Status:** Approved by user (approach A)

## Goal

Let admins create, rename, recolor, reorder, and delete service categories from
the back office — no more JSON import round-trips. The public filter pills and
the link form already render categories dynamically, so they pick changes up
with no further work.

## Decisions (confirmed with user)

1. **Placement:** a new "หมวดหมู่" tab in the admin sidebar → page
   `/admin/categories`.
2. **Delete rule:** a category that still has links cannot be deleted — the
   button is disabled with a "มี N ลิงก์" hint client-side, and the server
   rejects with 409 regardless.
3. **Colors:** picked from a curated 6-swatch palette (no free hex):
   `#17a34a` เขียวสด · `#0f7a37` เขียวเข้ม · `#32523d` เขียวป่า ·
   `#1e88a8` ฟ้าน้ำ · `#b8862b` ทอง · `#d4512c` ชาด.

## Design

### Data

- `Category` gains optional `color?: string` (`src/types/portal.ts`);
  `categorySchema` gains `color: z.enum([...6 hexes]).optional()`
  (`src/lib/schema.ts`). Existing categories have no `color` and keep their
  current hue via the fallback map — no data migration.

### Color resolution

- `src/lib/category-accent.ts` gains
  `accentOf(category: { id: string; color?: string } | undefined, id: string)`:
  `category?.color || ACCENTS[id] || '#17a34a'`. Consumers that have the
  category list (ServicesGrid cells' focus outline, admin table dot/tile,
  LinkForm preview context) switch to it; `accentFor(id)` stays for callers
  without category objects.
- The public filter pills keep the uniform green active state (1c design) —
  category colors do not change pill styling.

### API — `PUT /api/admin/categories`

- Guarded by `requireAdmin` like every admin route.
- Body: the complete category array `{ categories: Category[] }` (create /
  rename / recolor / reorder / delete are all expressed by submitting the new
  full list; `order` is the array index + 1, normalized server-side).
- Validation (400): every entry passes `categorySchema`; ids unique.
- Referential guard (409): any category id present in the stored config but
  missing from the submitted list while `links.some(l => l.categoryId === id)`
  → `{ error: 'category_in_use', categoryId, count }` and nothing is saved.
- On success: persist via the config store's existing save path (bumps
  version/updatedAt/updatedBy like other admin writes) and trigger the same
  on-demand revalidation the link routes use so the public page updates.

### UI — `/admin/categories`

- New sidebar NAV item "หมวดหมู่" (icon `category` — added to `ICON_NAMES` so
  the subset font includes it). Guarded like other admin pages
  (`getMemberSsrProps` + `withMemberGuard`).
- Page loads config via SWR (`/api/admin/config`) like `/admin`:
  - Rows in `order`: ↑/↓ buttons for reorder (few categories — no dnd),
    inline label input, 6 color swatches (selected = ring), link count,
    delete button (disabled + "มี N ลิงก์" when count > 0; confirm() dialog
    when enabled).
  - "เพิ่มหมวดหมู่" row at the bottom: label input with auto-slug id (same
    slugify as LinkForm), duplicate-id guard client-side.
  - Single "บันทึก" button submits the whole list to the new API; success →
    SWR mutate + message, error → show server message (including the 409
    category-in-use case).
- Unsaved-changes hint when the local list differs from the server copy.

### Out of scope (YAGNI)

- Renaming a category **id** (would touch every link).
- Free-form hex colors; per-category public pill colors.
- Limits on category count; drag-and-drop reorder.

## Error handling

- Server is the source of truth for the delete rule — the client hint is
  convenience only.
- Concurrent edits: last-write-wins on the categories array (same model as
  the rest of the admin); link edits are unaffected because the endpoint only
  writes `categories`.

## Testing

No test runner (project convention). Gates: `npx tsc --noEmit`,
`npm run lint`, `npm run build`, plus curl smoke of the new API's 401 path and
a user visual pass on `/admin/categories` (add → recolor → reorder → save →
check public pills; delete guard on a category with links).
