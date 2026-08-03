# Admin Category Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins manage categories (create / rename / recolor / reorder / delete-with-guard) at `/admin/categories`; public pills and link form pick changes up automatically.

**Architecture:** `Category` gains an optional `color` restricted to a curated 6-hex palette (source of truth in `category-accent.ts`, imported by the zod schema). A new `PUT /api/admin/categories` writes the full category array through `mutateConfig` after a referential in-use guard. The page follows `/admin`'s SWR pattern with a local editable copy and one save button. Accent resolution moves to `accentOf(category, id)` with the old per-id map as fallback, wired into the grid + admin table.

**Tech Stack:** Existing zod/SWR/config-store patterns; Phase-1 `Icon` subset (3 new glyph names).

**Spec:** `docs/superpowers/specs/2026-08-03-category-management-design.md`

**Testing note:** No test runner. Gates: `npx tsc --noEmit`, `npm run lint`, `npm run build`, curl smoke (Task 6). Do NOT start a dev server — the user runs one on :3000 (curl it read-only).

---

### Task 1: Palette + `accentOf` + schema/type `color`

**Files:**
- Modify: `src/lib/category-accent.ts` (full replacement)
- Modify: `src/lib/schema.ts` (categorySchema)
- Modify: `src/types/portal.ts` (Category)

- [ ] **Step 1: Replace `src/lib/category-accent.ts` with:**

```ts
// Category accent colours. Custom categories store an explicit `color` picked
// from CATEGORY_COLORS; the legacy trio falls back to ACCENTS by id so no data
// migration is needed. Keep the three legacy hexes in sync with the --cat-*
// vars in src/styles/globals.css.

export const CATEGORY_COLOR_VALUES = [
  '#17a34a',
  '#0f7a37',
  '#32523d',
  '#1e88a8',
  '#b8862b',
  '#d4512c',
] as const;

export const CATEGORY_COLORS: { value: string; label: string }[] = [
  { value: '#17a34a', label: 'เขียวสด' },
  { value: '#0f7a37', label: 'เขียวเข้ม' },
  { value: '#32523d', label: 'เขียวป่า' },
  { value: '#1e88a8', label: 'ฟ้าน้ำ' },
  { value: '#b8862b', label: 'ทอง' },
  { value: '#d4512c', label: 'ชาด' },
];

const ACCENTS: Record<string, string> = {
  service: '#17a34a', // บริการประชาชน — เขียวสด
  map: '#0f7a37', // แผนที่และข้อมูลพื้นที่ — เขียวเข้ม
  info: '#d4512c', // ข้อมูลข่าวสารและติดต่อ — ชาด
};

// Preferred resolver: explicit colour, else legacy per-id hue, else primary.
export function accentOf(
  category: { color?: string } | undefined,
  id: string
): string {
  return category?.color || ACCENTS[id] || '#17a34a';
}

// Id-only fallback for callers without the category object.
export function accentFor(categoryId: string): string {
  return ACCENTS[categoryId] ?? '#17a34a';
}
```

- [ ] **Step 2:** In `src/lib/schema.ts`, add the import and extend `categorySchema`. Change

```ts
import { z } from 'zod';
import { CONFIG_ID } from '@/types/portal';
```

to

```ts
import { z } from 'zod';
import { CONFIG_ID } from '@/types/portal';
import { CATEGORY_COLOR_VALUES } from '@/lib/category-accent';
```

and change the `categorySchema` object to

```ts
export const categorySchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'slug ใช้ a-z, 0-9, - เท่านั้น'),
  label: z.string().min(1, 'ต้องระบุชื่อหมวด'),
  order: z.number().int(),
  // Curated palette only (see CATEGORY_COLORS); absent = legacy per-id hue.
  color: z.enum(CATEGORY_COLOR_VALUES).optional(),
});
```

- [ ] **Step 3:** In `src/types/portal.ts`, extend the `Category` type:

```ts
export type Category = {
  id: string; // slug e.g. "service"
  label: string;
  order: number;
  color?: string; // curated palette hex (see src/lib/category-accent.ts)
};
```

- [ ] **Step 4:** `npx tsc --noEmit` && `npm run lint` — clean.
- [ ] **Step 5: Commit** — `git add src/lib/category-accent.ts src/lib/schema.ts src/types/portal.ts && git commit -m "feat: category color field with curated palette + accentOf resolver"`

### Task 2: `PUT /api/admin/categories`

**Files:**
- Create: `src/pages/api/admin/categories.ts`

- [ ] **Step 1: Create the file:**

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth-server';
import { getConfig, mutateConfig } from '@/lib/config-store';
import { revalidateHome } from '@/lib/revalidate';
import { categorySchema } from '@/lib/schema';

// PUT /api/admin/categories — replace the whole category list (create/rename/
// recolor/reorder/delete in one request). Deleting a category that still has
// links is rejected with 409 so links can never point at a missing category.
const bodySchema = z.object({ categories: z.array(categorySchema).min(1) });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'invalid_categories', issues: parsed.error.issues });
  }

  // Order is the submitted position, normalized server-side.
  const next = parsed.data.categories.map((c, i) => ({ ...c, order: i + 1 }));
  const ids = new Set(next.map((c) => c.id));
  if (ids.size !== next.length) {
    return res.status(400).json({ error: 'duplicate_id' });
  }

  const current = await getConfig();
  for (const cat of current.categories) {
    if (!ids.has(cat.id)) {
      const count = current.links.filter((l) => l.categoryId === cat.id).length;
      if (count > 0) {
        return res
          .status(409)
          .json({ error: 'category_in_use', categoryId: cat.id, count });
      }
    }
  }

  const saved = await mutateConfig((draft) => {
    draft.categories = next;
  }, admin.email ?? admin.userId);

  await revalidateHome(res);
  return res.status(200).json(saved.categories);
}
```

- [ ] **Step 2:** `npx tsc --noEmit` && `npm run lint` — clean.
- [ ] **Step 3: Commit** — `git add src/pages/api/admin/categories.ts && git commit -m "feat: PUT /api/admin/categories with in-use delete guard"`

### Task 3: Client helper, shared slugify, sidebar nav, icon subset

**Files:**
- Create: `src/lib/slugify.ts`
- Modify: `src/lib/admin-api.ts` (add `updateCategories`)
- Modify: `src/components/admin/LinkForm.tsx` (use shared slugify)
- Modify: `src/lib/icons.ts` (3 new names)
- Modify: `src/components/admin/AdminLayout.tsx` (nav item)

- [ ] **Step 1: Create `src/lib/slugify.ts`** (moved verbatim from LinkForm so the categories page can share it):

```ts
// Lowercase ascii slug for ids (links and categories share the same rule).
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}
```

- [ ] **Step 2:** In `src/components/admin/LinkForm.tsx`: add `import { slugify } from '@/lib/slugify';` next to the other `@/lib` imports and DELETE the local `function slugify(...)` at the bottom of the file (verify with `grep -c "function slugify" src/components/admin/LinkForm.tsx` → 0).

- [ ] **Step 3:** In `src/lib/admin-api.ts`: extend the type import and add the helper. Change the first import to

```ts
import type {
  Category,
  PortalConfig,
  ServiceLink,
  SiteSettings,
} from '@/types/portal';
```

and add after `reorderLinks`:

```ts
export async function updateCategories(
  categories: Category[]
): Promise<Category[]> {
  return jsonOrThrow(
    await fetch('/api/admin/categories', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categories }),
    })
  );
}
```

- [ ] **Step 4:** In `src/lib/icons.ts`, add three names to `ICON_NAMES` keeping alphabetical order: `'arrow_downward'` and `'arrow_upward'` after `'arrow_back'`, and `'category'` after `'campaign'`. (The subset URL updates automatically since it joins `ICON_NAMES`.)

- [ ] **Step 5:** In `src/components/admin/AdminLayout.tsx`, add the nav item to `NAV` between ลิงก์บริการ and ตั้งค่าเว็บไซต์:

```ts
  { href: '/admin/categories', label: 'หมวดหมู่', icon: 'category', exact: false },
```

- [ ] **Step 6:** `npx tsc --noEmit` && `npm run lint` — clean. Verify the subset URL still resolves: build the URL and curl it —

```bash
node -e "const {ICON_FONT_HREF}=require('./src/lib/icons.ts')" 2>/dev/null || true
python3 - <<'EOF'
import re
s = open('src/lib/icons.ts').read()
names = re.findall(r"'([a-z0-9_]+)',", s.split('ICON_NAMES')[1].split('] as const')[0])
url = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,300,0,0&icon_names=' + ','.join(names) + '&display=block'
import urllib.request
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
print('status', urllib.request.urlopen(req).status)
EOF
```

Expected: `status 200`. If 400, a name is invalid — report BLOCKED.

- [ ] **Step 7: Commit** — `git add src/lib/slugify.ts src/lib/admin-api.ts src/components/admin/LinkForm.tsx src/lib/icons.ts src/components/admin/AdminLayout.tsx && git commit -m "feat(admin): categories client helper, nav item, shared slugify, icon glyphs"`

### Task 4: Page `/admin/categories`

**Files:**
- Create: `src/pages/admin/categories.tsx`

- [ ] **Step 1: Create the file:**

```tsx
import { useState } from 'react';
import useSWR from 'swr';
import AdminLayout from '@/components/admin/AdminLayout';
import Icon from '@/components/Icon';
import { withMemberGuard } from '@/components/admin/MemberGuard';
import { getMemberSsrProps } from '@/lib/auth-server';
import { adminFetcher, updateCategories } from '@/lib/admin-api';
import { CATEGORY_COLORS, accentOf } from '@/lib/category-accent';
import { slugify } from '@/lib/slugify';
import type { Category, PortalConfig } from '@/types/portal';

// Category management: rename / recolor / reorder / add / delete-with-guard.
// Edits live in a local copy; one "บันทึก" submits the whole list to
// PUT /api/admin/categories (server re-checks the delete guard).

function CategoriesPage() {
  const { data, error, isLoading, mutate } = useSWR<PortalConfig>(
    '/api/admin/config',
    adminFetcher
  );
  const [rows, setRows] = useState<Category[] | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const serverList = [...(data?.categories ?? [])].sort(
    (a, b) => a.order - b.order
  );
  const list = rows ?? serverList;
  const dirty = rows !== null;

  const linkCount = (id: string) =>
    data?.links.filter((l) => l.categoryId === id).length ?? 0;

  function edit(mutator: (draft: Category[]) => Category[]) {
    setMsg(null);
    setRows((current) => mutator([...(current ?? serverList)]));
  }

  function move(index: number, dir: -1 | 1) {
    edit((draft) => {
      const j = index + dir;
      if (j < 0 || j >= draft.length) return draft;
      [draft[index], draft[j]] = [draft[j], draft[index]];
      return draft;
    });
  }

  function setLabel(index: number, label: string) {
    edit((draft) => {
      draft[index] = { ...draft[index], label };
      return draft;
    });
  }

  function setColor(index: number, color: string) {
    edit((draft) => {
      draft[index] = { ...draft[index], color };
      return draft;
    });
  }

  function remove(index: number) {
    const cat = list[index];
    if (!confirm(`ลบหมวด “${cat.label}” ?`)) return;
    edit((draft) => {
      draft.splice(index, 1);
      return draft;
    });
  }

  function add() {
    const label = newLabel.trim();
    if (!label) return;
    const id = slugify(label) || `category-${list.length + 1}`;
    if (list.some((c) => c.id === id)) {
      setMsg(`มีหมวด id “${id}” อยู่แล้ว — เปลี่ยนชื่อเล็กน้อยเพื่อให้ id ไม่ซ้ำ`);
      return;
    }
    edit((draft) => {
      draft.push({ id, label, order: draft.length + 1 });
      return draft;
    });
    setNewLabel('');
  }

  async function save() {
    if (!list.length) {
      setMsg('ต้องมีอย่างน้อย 1 หมวด');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await updateCategories(list.map((c, i) => ({ ...c, order: i + 1 })));
      await mutate();
      setRows(null);
      setMsg('บันทึกแล้ว');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout
      title="หมวดหมู่"
      actions={
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-[10px] bg-green px-[17px] py-2.5 font-display text-[13.5px] font-semibold text-white transition hover:bg-green-deep disabled:opacity-40"
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      }
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          โหลดข้อมูลไม่สำเร็จ: {error.message}
        </p>
      ) : null}
      {msg ? (
        <p className="mb-4 rounded-lg bg-green-050 px-4 py-2 text-sm text-green-deep">
          {msg}
        </p>
      ) : null}
      {dirty ? (
        <p className="mb-4 text-xs text-amber-700">
          มีการแก้ไขที่ยังไม่บันทึก — กด “บันทึก” เพื่อยืนยัน
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-ink-soft">กำลังโหลด…</p>
      ) : (
        <div className="max-w-2xl space-y-2">
          {list.map((cat, i) => {
            const count = linkCount(cat.id);
            return (
              <div
                key={cat.id}
                className="flex items-center gap-3 rounded-[14px] border border-black/[0.08] bg-white px-4 py-3"
              >
                <div className="flex flex-col">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`เลื่อน ${cat.label} ขึ้น`}
                    className="grid h-6 w-6 place-items-center rounded text-ink-faint hover:bg-black/[0.05] disabled:opacity-20"
                  >
                    <Icon name="arrow_upward" size={16} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === list.length - 1}
                    aria-label={`เลื่อน ${cat.label} ลง`}
                    className="grid h-6 w-6 place-items-center rounded text-ink-faint hover:bg-black/[0.05] disabled:opacity-20"
                  >
                    <Icon name="arrow_downward" size={16} />
                  </button>
                </div>

                <span
                  className="h-3 w-3 flex-none rounded-full"
                  style={{ background: accentOf(cat, cat.id) }}
                />

                <div className="min-w-0 flex-1">
                  <input
                    value={cat.label}
                    onChange={(e) => setLabel(i, e.target.value)}
                    aria-label={`ชื่อหมวด ${cat.id}`}
                    className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-sm font-semibold text-ink outline-none focus:border-black/15 focus:bg-white"
                  />
                  <p className="px-2 text-[11px] text-ink-mute">
                    {cat.id} · {count} ลิงก์
                  </p>
                </div>

                <div className="flex gap-1.5">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setColor(i, c.value)}
                      title={c.label}
                      aria-label={`สี${c.label}`}
                      aria-pressed={accentOf(cat, cat.id) === c.value}
                      className={`h-6 w-6 rounded-full transition ${
                        accentOf(cat, cat.id) === c.value
                          ? 'ring-2 ring-ink ring-offset-2'
                          : 'hover:scale-110'
                      }`}
                      style={{ background: c.value }}
                    />
                  ))}
                </div>

                <button
                  onClick={() => remove(i)}
                  disabled={count > 0}
                  aria-label={`ลบหมวด ${cat.label}`}
                  title={count > 0 ? `ลบไม่ได้ — มี ${count} ลิงก์ในหมวดนี้` : 'ลบหมวด'}
                  className="grid h-8 w-8 place-items-center rounded-[9px] text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-25"
                >
                  <Icon name="delete" size={19} />
                </button>
              </div>
            );
          })}

          <div className="flex items-center gap-3 rounded-[14px] border border-dashed border-black/[0.16] px-4 py-3">
            <Icon name="add" size={20} className="text-ink-mute" />
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add();
              }}
              placeholder="ชื่อหมวดใหม่ เช่น กิจกรรมชุมชน"
              aria-label="ชื่อหมวดใหม่"
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-mute"
            />
            <button
              onClick={add}
              disabled={!newLabel.trim()}
              className="rounded-full border border-black/[0.18] px-4 py-1.5 font-display text-[12.5px] font-semibold text-green-deep transition hover:bg-green-025 disabled:opacity-40"
            >
              เพิ่มหมวด
            </button>
          </div>

          <p className="px-1 pt-2 text-[11.5px] leading-relaxed text-ink-mute">
            หมวดที่ยังมีลิงก์อยู่จะลบไม่ได้ — ย้ายลิงก์ไปหมวดอื่นก่อน (แก้ได้ในหน้า
            ลิงก์บริการ) · id ของหมวดตั้งอัตโนมัติจากชื่อและแก้ไม่ได้ภายหลัง
          </p>
        </div>
      )}
    </AdminLayout>
  );
}

export const getServerSideProps = getMemberSsrProps;

export default withMemberGuard(CategoriesPage);
```

- [ ] **Step 2:** `npx tsc --noEmit` && `npm run lint` — clean.
- [ ] **Step 3: Guard-parity grep:** `grep -c "getMemberSsrProps" src/pages/admin/categories.tsx` → 2 (import + export).
- [ ] **Step 4: Commit** — `git add src/pages/admin/categories.tsx && git commit -m "feat(admin): category management page"`

### Task 5: Wire `accentOf` into the grid + admin table

**Files:**
- Modify: `src/components/ServicesGrid.tsx`
- Modify: `src/pages/admin/index.tsx`

- [ ] **Step 1: `src/components/ServicesGrid.tsx`** — three edits:

(a) Change the accent import: `import { accentOf } from '@/lib/category-accent';` (replacing the `accentFor` import).

(b) In the `ServicesGrid` component body, before `return`, add:

```tsx
  const catById = new Map(categories.map((c) => [c.id, c]));
```

(c) `Cell` gains an `accent` prop. Change its signature line to

```tsx
function Cell({ link, index, accent }: { link: PublicLink; index: number; accent: string }) {
```

change its `style` to `style={{ animationDelay: `${index * 55}ms`, outlineColor: accent }}` and the call site to

```tsx
            <Cell
              key={link.id}
              link={link}
              index={i}
              accent={accentOf(catById.get(link.categoryId), link.categoryId)}
            />
```

- [ ] **Step 2: `src/pages/admin/index.tsx`** — three edits:

(a) Change the accent import: `import { accentOf } from '@/lib/category-accent';` (replacing `accentFor`).

(b) In `AdminDashboard`, next to the existing `categoryLabel` memo, add:

```tsx
  const categoryById = useMemo(() => {
    const m = new Map<string, PortalConfig['categories'][number]>();
    data?.categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [data]);
```

(c) `LinkRow` gains an `accent: string` prop: add it to the props type and destructuring, delete the line `const accent = accentFor(link.categoryId);`, and pass it at the call site:

```tsx
                    accent={accentOf(categoryById.get(link.categoryId), link.categoryId)}
```

- [ ] **Step 3:** `npx tsc --noEmit` && `npm run lint` — clean. Then `grep -rn "accentFor(" src --include="*.tsx"` → no matches (all TSX callers migrated; the function stays exported for future use).
- [ ] **Step 4: Commit** — `git add src/components/ServicesGrid.tsx src/pages/admin/index.tsx && git commit -m "feat: resolve category accents from stored color with legacy fallback"`

### Task 6: Build + smoke

- [ ] **Step 1:** `npm run build` — success; route table gains `ƒ /admin/categories` and `ƒ /api/admin/categories`.
- [ ] **Step 2:** Smoke via the user's dev server (read-only):

```bash
curl -s -o /dev/null -w "page=%{http_code}\n" -H "Accept: text/html" -H "Sec-Fetch-Dest: document" http://localhost:3000/admin/categories   # 307 (Clerk proxy)
curl -s -X PUT -H "content-type: application/json" -d '{"categories":[]}' -o /dev/null -w "api=%{http_code}\n" http://localhost:3000/api/admin/categories   # 404 (Clerk protect, non-document) — NOT 200
curl -s http://localhost:3000/ -o /dev/null -w "home=%{http_code}\n"   # 200 (public unaffected)
```

- [ ] **Step 3:** Report done + list the visual checks the user must do signed-in (add category → recolor → reorder → save → pill appears on home; delete guard shows on a category with links).
