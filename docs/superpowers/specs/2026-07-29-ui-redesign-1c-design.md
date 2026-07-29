# UI Redesign — "น้ำแพร่ Bold" (1c) + Admin (1d)

**Date:** 2026-07-29
**Status:** Approved scope; awaiting spec review
**Source of truth:** `public/design_handoff_namphrae_ui/` — README.md (รวม update note 29 ก.ค. 2569 บนสุด ซึ่ง override ตาราง token เก่า) + `Namphrae UI ใหม่.dc.html` (จอ `1c Desktop`, `1c Mobile`, `1d Admin`)

This spec records the *decisions and scope*; visual values (สี ขนาด ระยะ) live in the
handoff and are not duplicated here. Where the README's update note and its older
sections conflict, **the update note wins** (เช่น hover เซลล์กริดใช้พื้น `#A8DDBE`
ตัวหนังสือสีเดิม — ไม่ใช่แบบกลับสีที่เขียนไว้ในหัวข้อ 1c เดิม).

## Decisions (confirmed with user)

1. **Direction: 1c "น้ำแพร่ Bold"** with the **white–green palette** from the
   README update note (อ้างอิงเว็บเทศบาลนครลำปาง). 1a/1b are not built.
2. **Scope this round (4 phases, each with its own implementation plan):**
   - Phase 1 — Foundation: fonts, tokens, category accents, `icon` schema field
   - Phase 2 — Public landing 1c (desktop + mobile)
   - Phase 3 — Service detail page `/service/[id]`
   - Phase 4 — Admin 1d (`/admin` index + AdminLayout sidebar)
   - **Not in scope:** real air-quality API (`/api/air`), Cloudinary asset
     migration, redesign of `/admin/settings|data|links/*` and `/sign-in`
     (keep current UI; they inherit the new fonts/tokens only).
3. **Live data shows sample numbers for now** (user decision): PM2.5 hero card
   and the LIVE SENSORS ticker render with the handoff's mock values behind a
   single `AIR_SAMPLE`/`TICKER_SAMPLE` constant module, clearly commented as
   mock with a pointer to the future `/api/air`. The handoff's caveat stands:
   ต่อข้อมูลจริงก่อนประชาสัมพันธ์วงกว้าง.
4. **Icons: Material Symbols Rounded, subset by name** (option A) — load via
   Google Fonts `css2?family=Material+Symbols+Rounded:...&icon_names=<all-used>`
   so only the ~40 used glyphs ship. Icon names are stored as strings; the
   `ServiceLink` schema gains an optional `icon` field and the admin link form
   gets a dropdown of the mapped names (per-service map in handoff §Assets).
   `ServiceThumb.tsx` (image thumbnails) is retired.
5. **Fonts:** Anuphan (display/UI) + Noto Sans Thai Looped (body) via
   `next/font/google`, replacing Bai Jamjuree + IBM Plex Sans Thai in
   `src/lib/fonts.ts`.
6. **Copy:** ship the handoff's Thai copy as-is, including strings the README
   marks as "ต้องให้เทศบาลอนุมัติ" — approval is the user's responsibility;
   list kept in handoff §Assets.

## Phase outlines

### Phase 1 — Foundation
- `src/lib/fonts.ts`: new font pair (subset thai+latin, weights per handoff).
- `src/styles/globals.css` `@theme`: replace palette with the update-note
  tokens (`white/green/green-deep/green-forest/green-mid/green-100/green-050/
  green-025/green-hover/ink/ink-soft/ink-faint/ink-mute/line/danger`), add the
  8 keyframes (`np-rise np-ripple np-drift np-marquee np-scan np-blink np-grow
  np-trace`) + `prefers-reduced-motion` handling for all of them.
- `src/lib/category-accent.ts`: `service #17A34A · map #0F7A37 · info #d4512c`.
- `src/lib/schema.ts` + `src/types/portal.ts`: optional `icon` on `ServiceLink`;
  seed `data/portal-config.seed.json` with the 17-service icon map.
- Icon plumbing: `<Icon name>` component + the subset font link in `_document`.
- Old tokens that survive by role (paper/surface/emerald…) are re-pointed or
  removed; every existing page must still render (admin pages not yet
  redesigned keep working with re-mapped tokens).

### Phase 2 — Public landing 1c
- **As built (documented deviations):** no search box — the chosen 1c screens
  have category pills only (search existed only in the unchosen 1a); mobile
  shows the full service list as stacked hairline cells (the 1c Mobile
  "บริการยอดนิยม" divider list is covered by the hero shortcut rows); the
  admin-editable `brandTitle`/`orgSubName` fields are dormant in 1c (as is
  hero media).
- Rebuild `SiteHeader` (topbar), `Hero` + air card, LIVE SENSORS ticker,
  category filter pills (client state `cat` over SSG data),
  hairline service grid (**use `border-right/bottom`, not gap-1px + filler**,
  per handoff note), footer + visitor counter, `ContourBackground` with
  `np-trace`/scan/sensor nodes. Mobile layout per `1c Mobile`.
- Keep: click tracking `navigator.sendBeacon('/api/track/<id>')` on
  click+auxclick, `openInNewTab` behavior, disabled cards (`aria-disabled`),
  `:focus-visible` outlines, ISR `getStaticProps` + `revalidate: 60`.
- `ManualsSection` content moves into the footer column.

### Phase 3 — `/service/[id]` detail page
- New route following the handoff's 1a-Detail layout re-skinned with the
  current palette (the only detail design in the handoff; update note's
  palette applies). Static paths from config; CTA = the service URL with
  tracking; steps/contact/manuals sidebar from config where available.

### Phase 4 — Admin 1d
- `AdminLayout`: left sidebar (nav + dev-open warning card) replacing topbar.
- `/admin` index: grid-style table per 1d (drag handle + dnd-kit as today,
  toggle, category dot, click count, edit/delete).
- Link form: `icon` dropdown (Phase 1 schema) replacing image-URL field for
  thumbnails (URL field stays for the link target itself).
- Other admin pages keep current structure, inheriting tokens.

## Constraints & invariants

- Tailwind v4 utilities + `@theme` tokens, following existing component
  patterns; no inline styles (prototype uses them only as a tool limitation).
- Data flow unchanged: `PublicConfig`/`PortalConfig` via `config-store`;
  admin auth/registry gate untouched.
- Hit targets ≥ 44px on mobile. Service grid per 1c: 3-column hairline grid on
  desktop; on mobile use the `1c Mobile` layout (divider list, not a grid).
- `npm run build` + `npm run lint` must pass at the end of every phase; visual
  check against the prototype file per phase before moving on.

## Risks

- Palette swap touches every existing page → Phase 1 ends with a full-app
  visual smoke test, not just the new pages.
- The `.dc.html` 1c markup is the pixel reference; where README text and the
  file's computed styles disagree, read values from the file.
