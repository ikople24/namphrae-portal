# UI Redesign Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the design foundation to the "น้ำแพร่ Bold" white–green system: new fonts, new tokens + the 8 `np-*` keyframes, new category accents, an `icon` field on `ServiceLink`, and a subset Material Symbols icon pipeline — with every existing page still rendering.

**Architecture:** Tokens live in Tailwind v4 `@theme` in `src/styles/globals.css`; old `emerald-*`/`gold`/`aqua` names stay as legacy aliases so pre-redesign components keep working until Phases 2–4 replace them. Icons are ligature glyphs from a Google-Fonts-subset Material Symbols font declared once in `_document.tsx`; the name list and per-service map live in `src/lib/icons.ts`.

**Tech Stack:** Next.js 16 pages router, Tailwind CSS v4 (`@theme`), `next/font/google`, zod.

**Spec:** `docs/superpowers/specs/2026-07-29-ui-redesign-1c-design.md` · **Design source:** `public/design_handoff_namphrae_ui/README.md` (update note บนสุดคือ palette จริง)

**Testing note:** No test runner in this project. Verification = `npx tsc --noEmit`, `npm run lint`, `npm run build`, and a rendered-page smoke check in Task 6. Do not add a test framework.

---

### Task 1: Font swap in `src/lib/fonts.ts`

**Files:**
- Modify: `src/lib/fonts.ts` (full replacement)

- [ ] **Step 1: Replace the file contents with:**

```ts
import { Anuphan, Noto_Sans_Thai_Looped } from 'next/font/google';

// Display / UI face — per the 1c handoff: headings, buttons, nav, numbers.
export const display = Anuphan({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

// Body face — long-form Thai civic content.
export const body = Noto_Sans_Thai_Looped({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});
```

- [ ] **Step 2:** Run `npx tsc --noEmit` — expect exit 0. (`_app.tsx` consumes `display.variable`/`body.variable`, names unchanged.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/fonts.ts
git commit -m "feat(ui): swap fonts to Anuphan + Noto Sans Thai Looped"
```

### Task 2: New tokens + np-* keyframes in `src/styles/globals.css`

**Files:**
- Modify: `src/styles/globals.css` (full replacement)

- [ ] **Step 1: Replace the entire file with:**

```css
@import 'tailwindcss';

/* ── "น้ำแพร่ Bold" design tokens — white–green palette ─────────────────────
   Per public/design_handoff_namphrae_ui/README.md update note (29 ก.ค. 2569):
   white base + fresh civic greens (อ้างอิงเทศบาลนครลำปาง). The emerald-* /
   gold / aqua names are LEGACY ALIASES so pre-redesign components keep
   rendering — new components use the green-* scale; remove aliases after
   Phases 2–4.                                                                */
@theme {
  --color-paper: #ffffff;
  --color-paper-deep: #f7fbf8;
  --color-surface: #ffffff;
  --color-surface-sunken: #fafbf9;

  --color-ink: #141414;
  --color-ink-soft: #4b5563;
  --color-ink-faint: #6b7280;
  --color-ink-mute: #9ca3af;

  --color-green: #17a34a;
  --color-green-deep: #0f7a37;
  --color-green-forest: #32523d;
  --color-green-mid: #34b863;
  --color-green-100: #cde9d6;
  --color-green-050: #eaf7ef;
  --color-green-025: #f7fbf8;
  --color-green-hover: #a8ddbe;

  --color-danger: #c2503a;
  --color-line: rgba(17, 24, 39, 0.12);

  /* Legacy aliases (pre-redesign components only). */
  --color-emerald: #17a34a;
  --color-emerald-deep: #0f7a37;
  --color-emerald-050: #eaf7ef;
  --color-gold: #a9791f;
  --color-aqua: #24809e;

  --font-display: var(--font-display), ui-sans-serif, system-ui, sans-serif;
  --font-body: var(--font-body), ui-sans-serif, system-ui, sans-serif;

  --radius-card: 18px;

  /* ── Smart-city animation layer (handoff §Animations) ──
     Durations here are the defaults; per-use overrides go through
     [animation-duration:2.4s]-style arbitrary utilities. */
  --animate-np-rise: np-rise 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  --animate-np-ripple: np-ripple 3.2s ease-out infinite;
  --animate-np-drift: np-drift 26s ease-in-out infinite alternate;
  --animate-np-marquee: np-marquee 34s linear infinite;
  --animate-np-scan: np-scan 7s linear infinite;
  --animate-np-blink: np-blink 1.4s ease-in-out infinite;
  --animate-np-grow: np-grow 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  --animate-np-trace: np-trace 9s ease-out infinite alternate;

  @keyframes np-rise {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes np-ripple {
    from { transform: scale(0.6); opacity: 0.5; }
    to { transform: scale(1.9); opacity: 0; }
  }
  @keyframes np-drift {
    from { transform: translate3d(0, 0, 0) scale(1); }
    to { transform: translate3d(-3%, -2%, 0) scale(1.08); }
  }
  @keyframes np-marquee {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  @keyframes np-scan {
    0% { transform: translateY(-40px); opacity: 0; }
    12% { opacity: 0.9; }
    88% { opacity: 0.9; }
    100% { transform: translateY(520px); opacity: 0; }
  }
  @keyframes np-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
  }
  @keyframes np-grow {
    from { transform: scaleY(0.08); }
    to { transform: scaleY(1); }
  }
  @keyframes np-trace {
    from { stroke-dashoffset: 1400; }
    to { stroke-dashoffset: 0; }
  }
}

:root {
  /* Per-category accent, referenced from JSX via inline vars.
     (Same values as src/lib/category-accent.ts.) */
  --cat-service: #17a34a;
  --cat-map: #0f7a37;
  --cat-info: #d4512c;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background-color: var(--color-paper);
  color: var(--color-ink);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.font-display {
  font-family: var(--font-display);
}

/* Material Symbols base (font-face + subset loaded in _document.tsx). */
.material-symbols-rounded {
  font-family: 'Material Symbols Rounded';
  font-weight: normal;
  font-style: normal;
  display: inline-block;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  font-variation-settings: 'opsz' 24, 'wght' 300, 'FILL' 0, 'GRAD' 0;
}

/* ── Legacy pre-redesign styles (used by current Hero/cards; Phase 2 removes) */
.contour-drift {
  animation: contour-drift 26s ease-in-out infinite alternate;
  transform-origin: center;
}
@keyframes contour-drift {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(-2%, -1.5%, 0) scale(1.06); }
}

.service-card {
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}
.service-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 30px -18px color-mix(in srgb, var(--card-accent) 60%, #000);
  border-color: color-mix(in srgb, var(--card-accent) 45%, transparent);
}
.service-card:focus-visible {
  outline: 3px solid var(--card-accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: no-preference) {
  .rise {
    animation: rise 0.6s both;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: none; }
  }
}

/* ── Reduced motion: kill every decorative animation. Entrance animations
   (np-rise/np-grow) fall back to their natural (final) layout state. ──── */
@media (prefers-reduced-motion: reduce) {
  .contour-drift,
  .animate-np-rise,
  .animate-np-ripple,
  .animate-np-drift,
  .animate-np-marquee,
  .animate-np-scan,
  .animate-np-blink,
  .animate-np-grow,
  .animate-np-trace {
    animation: none;
  }
}

/* Focus visibility floor for keyboard users. */
a:focus-visible,
button:focus-visible {
  outline: 3px solid var(--color-green);
  outline-offset: 2px;
  border-radius: 6px;
}
```

- [ ] **Step 2:** Run `npm run build` — expect success (all existing `bg-emerald`/`text-ink-soft`/etc. classes resolve via aliases; colors change, classes don't).

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat(ui): white-green palette tokens + np-* animation layer"
```

### Task 3: Category accents in `src/lib/category-accent.ts`

**Files:**
- Modify: `src/lib/category-accent.ts` (full replacement)

- [ ] **Step 1: Replace the file contents with:**

```ts
// Maps a category id to its accent colour (handoff update note: greens ไล่ระดับ
// + ชาดเป็นสีตัดจุดเดียว). Any custom category falls back to the primary green.
// Keep in sync with the --cat-* vars in src/styles/globals.css.
const ACCENTS: Record<string, string> = {
  service: '#17a34a', // บริการประชาชน — เขียวสด
  map: '#0f7a37', // แผนที่และข้อมูลพื้นที่ — เขียวเข้ม
  info: '#d4512c', // ข้อมูลข่าวสารและติดต่อ — ชาด
};

export function accentFor(categoryId: string): string {
  return ACCENTS[categoryId] ?? '#17a34a';
}
```

- [ ] **Step 2:** Run `npx tsc --noEmit` — expect exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/category-accent.ts
git commit -m "feat(ui): category accents per 1c palette"
```

### Task 4: `icon` field on ServiceLink (schema, types, seed)

**Files:**
- Modify: `src/lib/schema.ts:41-55` (linkInputSchema)
- Modify: `src/types/portal.ts:43-55` (ServiceLink)
- Modify: `data/portal-config.seed.json` (18 links)

- [ ] **Step 1: Add `icon` to `linkInputSchema`** — in `src/lib/schema.ts`, insert after the `imageUrl` line (line 49):

```ts
  // Material Symbols name (see src/lib/icons.ts). Empty = fall back by id.
  icon: z
    .string()
    .regex(/^[a-z0-9_]*$/, 'ชื่อไอคอนใช้ a-z, 0-9, _ เท่านั้น')
    .optional()
    .default(''),
```

- [ ] **Step 2: Add `icon` to the `ServiceLink` type** — in `src/types/portal.ts`, insert after the `imageUrl` line (line 48):

```ts
  icon?: string; // Material Symbols name (see src/lib/icons.ts)
```

- [ ] **Step 3: Seed the icon map** — run this script from the repo root:

```bash
python3 - <<'EOF'
import json
ICONS = {
  'petition': 'description', 'paytax': 'payments', 'air-quality': 'air',
  'agnos-health': 'health_and_safety', 'smart-namphrae': 'dashboard',
  'baimai': 'compost', 'map-main': 'map', 'google-maps': 'location_on',
  'maplight': 'lightbulb', 'cctv': 'videocam', 'forest-map': 'forest',
  'google-earth': 'public', 'announcements': 'campaign',
  'looker-dashboard': 'monitoring', 'otop': 'storefront', 'line-oa': 'chat',
  'npdrh-calendar': 'calendar_month', 'placeholder-15': 'help',
}
p = 'data/portal-config.seed.json'
d = json.load(open(p, encoding='utf-8'))
for link in d['links']:
    link['icon'] = ICONS[link['id']]
json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('ok', len(d['links']))
EOF
```

Expected output: `ok 18`. (The script KeyErrors if a link id is missing from the map — that's intentional; every link must get an icon.)

- [ ] **Step 4:** Run `npx tsc --noEmit` — expect exit 0. Note: the live Mongo config has no `icon` values yet; zod defaults it to `''` and Phase 2 components will fall back to `SERVICE_ICONS[link.id]` (Task 5). The admin form doesn't send `icon` yet (Phase 4) so a link saved through admin today gets `icon: ''` — harmless because of that fallback.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts src/types/portal.ts data/portal-config.seed.json
git commit -m "feat: icon field on ServiceLink + seed icon map"
```

### Task 5: Icon pipeline — `src/lib/icons.ts`, `Icon` component, `_document` font link

**Files:**
- Create: `src/lib/icons.ts`
- Create: `src/components/Icon.tsx`
- Modify: `src/pages/_document.tsx` (full replacement)

- [ ] **Step 1: Create `src/lib/icons.ts`:**

```ts
// Material Symbols Rounded, subset by name (handoff §Assets, option A).
// ICON_NAMES drives the Google Fonts subset URL in _document.tsx — a glyph
// not listed there renders as its ligature text, so ADD THE NAME HERE FIRST.

// Per-service icon, keyed by ServiceLink.id (fallback when link.icon is '').
export const SERVICE_ICONS: Record<string, string> = {
  petition: 'description',
  paytax: 'payments',
  'air-quality': 'air',
  'agnos-health': 'health_and_safety',
  'smart-namphrae': 'dashboard',
  baimai: 'compost',
  'map-main': 'map',
  'google-maps': 'location_on',
  maplight: 'lightbulb',
  cctv: 'videocam',
  'forest-map': 'forest',
  'google-earth': 'public',
  announcements: 'campaign',
  'looker-dashboard': 'monitoring',
  otop: 'storefront',
  'line-oa': 'chat',
  'npdrh-calendar': 'calendar_month',
  'placeholder-15': 'help',
};

export function iconForService(id: string, icon?: string): string {
  return icon || SERVICE_ICONS[id] || 'apps';
}

// Every glyph the UI uses (services + chrome), sorted, deduped.
export const ICON_NAMES = [
  'add',
  'air',
  'apps',
  'arrow_back',
  'arrow_forward',
  'arrow_outward',
  'assignment',
  'assignment_turned_in',
  'calendar_month',
  'call',
  'campaign',
  'chat',
  'chevron_right',
  'compost',
  'dashboard',
  'delete',
  'description',
  'drag_indicator',
  'edit',
  'forest',
  'health_and_safety',
  'help',
  'home',
  'lightbulb',
  'link',
  'location_on',
  'map',
  'menu',
  'menu_book',
  'monitoring',
  'notifications',
  'open_in_new',
  'payments',
  'person',
  'picture_as_pdf',
  'public',
  'search',
  'storefront',
  'swap_vert',
  'tune',
  'videocam',
  'warning',
  'water_drop',
] as const;

// display=block: hide until loaded so ligature text never flashes.
export const ICON_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,300,0,0' +
  `&icon_names=${ICON_NAMES.join(',')}&display=block`;
```

- [ ] **Step 2: Create `src/components/Icon.tsx`:**

```tsx
import type { CSSProperties } from 'react';

// Material Symbols Rounded ligature glyph. Decorative by default (aria-hidden)
// — pair with visible text or an aria-label on the interactive parent.
// The name must exist in ICON_NAMES (src/lib/icons.ts) or it renders as text.
export default function Icon({
  name,
  size = 24,
  className = '',
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-rounded select-none ${className}`}
      style={{ fontSize: size, ...style }}
    >
      {name}
    </span>
  );
}
```

- [ ] **Step 3: Replace `src/pages/_document.tsx` with:**

```tsx
import { Html, Head, Main, NextScript } from 'next/document';
import { ICON_FONT_HREF } from '@/lib/icons';

export default function Document() {
  return (
    <Html lang="th">
      <Head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={ICON_FONT_HREF} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

- [ ] **Step 4:** Run `npx tsc --noEmit` && `npm run lint` — expect both clean. (`Icon` has no consumer yet — Phases 2–4 use it; that is expected, do not delete it.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/icons.ts src/components/Icon.tsx src/pages/_document.tsx
git commit -m "feat(ui): Material Symbols subset icon pipeline"
```

### Task 6: Build + rendered smoke check

- [ ] **Step 1:** Run `npm run build` — expect success, same route table as before (`/` SSG ●, `/admin/*` ƒ, `/sign-in` ○).

- [ ] **Step 2: Rendered smoke check** — the palette swap touches every page; confirm nothing broke structurally:

```bash
npm run dev -- -p 3791 &
sleep 8
curl -s http://localhost:3791/ | grep -c "font-display"            # expect ≥ 1
curl -s http://localhost:3791/ -o /dev/null -w "home=%{http_code}\n"      # 200
curl -s http://localhost:3791/sign-in -o /dev/null -w "signin=%{http_code}\n"  # 200
curl -s "http://localhost:3791/_next/static/development/_devMiddlewareManifest.json" -o /dev/null
curl -s http://localhost:3791/ | grep -o "fonts.googleapis.com/css2?family=Material+Symbols" | head -1
kill %1
```

Expected: HTTP 200s and the Material Symbols stylesheet link present in the HTML head.

- [ ] **Step 3:** Report to the user that Phase 1 is done and the site now renders with the new palette/fonts (old layouts, new skin) — recommend they eyeball `/` and `/admin` in a browser before Phase 2 starts.
