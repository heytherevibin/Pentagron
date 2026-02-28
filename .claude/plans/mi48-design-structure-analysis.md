# MI48 → Pentagron Design Structure: Deep Analysis & Implementation Plan

**Created**: 2026-02-26  
**Purpose**: Align Pentagron frontend with mi48’s exact design structure (layout, grids, padding, skeletons, components). Only context (copy, routes, domain) changes; visual structure and patterns stay identical to mi48.

**Reference**: mi48 lives at `../mi48` (sibling of Pentagron in `code/`).

---

## 1. MI48 Design Structure (Reference)

### 1.1 Root & layout shell

- **Root layout** (`mi48/src/app/layout.tsx`): Loads `globals.css`, `grid-overrides.css`, JetBrains Mono, `LayoutShell` wraps all children.
- **LayoutShell** (`layout-shell.tsx`):
  - Auth routes (`/sign-in`, `/sign-up`): render children only (no sidebar).
  - Dashboard: `ProtectedLayout` → shows `PageShellSkeleton` while auth loading; then Sidebar + main.
  - **Main**: `marginLeft: sidebarWidth`, `minWidth: 0`, `paddingTop: 56` on mobile when sidebar closed, `transition: margin-left 0.25s ease-in-out`.
  - Mobile: hamburger to open sidebar overlay; no sidebar strip when closed.

### 1.2 Page shell (content area) — **critical pattern**

Every dashboard content page in mi48 uses the same two-level wrapper:

1. **Outer**: full-height + dot grid (and optional flex/background)
   - `min-h-screen dot-grid`
   - Optional: `flex flex-col`, `bg-surface-1`, `bg-background`, `flex items-center justify-center` (for empty/centered pages).
2. **Inner**: constrained width, horizontal padding, vertical rhythm
   - `w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6 box-border`
   - Analyze page uses `max-w-[1600px]` and `flex-1 min-h-0` for its flex layout.

**Examples (from mi48):**

- History: `<div className="min-h-screen dot-grid"><div className="w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6 box-border">`
- Settings: `<div className="min-h-screen dot-grid bg-surface-1"><div className="w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6 box-border">`
- Home: `<div className="min-h-screen dot-grid flex flex-col items-center justify-center p-8">` with inner `max-w-xl text-center space-y-8`.

So: **dot-grid on the outer wrapper**, **max-width + padding + space-y-6 on the inner container** on every list/detail/settings page.

### 1.3 Grid system

- **grid-overrides.css**: Loaded **after** Tailwind. Defines `.grid`, `.grid-cols-1` through `.grid-cols-5`, responsive `md:grid-cols-*`, `lg:grid-cols-*`, `.gap-1`–`.gap-6` with `!important` so layout never breaks when Tailwind JIT misses a class.
- **globals.css**: Additional grid/utility fallbacks (e.g. `grid-cols-6`, `md:grid-cols-3`, `md:grid-cols-6`) and theme-aware surface/border classes so panels and cards look correct everywhere.

### 1.4 Skeleton structure

- **PageShellSkeleton**: Full-page loading for auth/shell. Sidebar strip (skeleton) + main area with a few blocks (`h-8 w-48`, `h-32 w-full`, `h-24 w-full`). Used in `layout-shell.tsx` when `loading` is true.
- **Page-specific skeletons**: Match the real page layout.
  - **HistoryPageSkeleton**: Same outer/inner as History page (`min-h-screen dot-grid` → `w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6 box-border`), then header row, stat cards grid, filter bar, table rows. So loading state has **same structure and spacing** as the final page.
  - Similarly: `MentionListSkeleton`, `AnalyzerSidebarSkeleton`, `PlaygroundResultSkeleton`, `CrawlResultSkeleton`.
- **Base**: `Skeleton` (shimmer block), `SkeletonText` (multiple lines). All use `skeleton-shimmer` and optional `rounded`.

### 1.5 Components & typography

- **Panel**: `.panel` (surface-1, border, no radius). Header: `border-b border-border`, `px-4 py-3` (or `px-5 py-*` where used). Content: `p-4` (or `p-3`/`px-5` where used).
- **Typography**: `.page-title`, `.page-subtitle`, `.section-label`, `.panel-header-text` in globals; consistent `text-[10px]`/`text-[11px]` for labels and metadata.
- **Buttons**: `.btn-primary` and inline `px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs` (or `text-sm`) with `transition-colors`.
- **Background**: Optional `BackgroundGrid` (fixed grid + top glow); most pages rely on `dot-grid` on the page wrapper.

### 1.6 Auth pages

- Split layout: `auth-auth` grid `1fr` on small screens, `65fr 1px 35fr` on lg (brand | divider | form).
- Left: `auth-brand` (waves, logo, title, description, footer).
- Right: `auth-main` (centered form), `auth-form-wrap` `max-width: 420px`, `auth-status` with dot.
- Pentagron already uses `auth-layout` / `auth-brand` / `auth-main` in globals; class names differ slightly from mi48 (`auth-auth` vs `auth-layout`).

### 1.7 Sidebar

- Fixed, left, full height; width from constants (expanded 230 / collapsed 56 in mi48).
- Brand block with logo + optional “Pro” pill + settings gear; collapsible sections with labels (e.g. “Scraping”, “Data”); active state: accent color + right edge bar (3px).
- Footer: user block (avatar, name, role), collapse toggle, sign out. Optional “System Online” dot.
- Mobile: overlay + close on route change; main gets `paddingTop: 56` when sidebar closed.

---

## 2. Pentagron Gaps (What’s Missing or Wrong)

### 2.1 No consistent page shell

- **Current**: Pages use ad-hoc wrappers, e.g. `p-6 space-y-6` or `p-6 animate-fade-in` with **no** `min-h-screen`, **no** `dot-grid`, **no** inner `max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6 box-border`.
- **Result**: Content is not centered in a max-width column; no shared vertical rhythm; no dot-grid background; layout feels “broken” and inconsistent.

### 2.2 No dot-grid on content pages

- `globals.css` defines `.dot-grid`, but **no authenticated page** uses it. Only auth/setup use full-screen centering; dashboard, project detail, flow detail, settings, new project do not use dot-grid.

### 2.3 No grid-overrides.css

- Pentagron does not have an equivalent of mi48’s `grid-overrides.css`. If Tailwind ever fails to generate a grid or gap class (e.g. in production build or with certain content paths), grids can collapse or not apply. mi48 guarantees layout with `!important` overrides.

### 2.4 Skeleton structure

- **Current**: `Skeleton` has only `line` / `card` / `stat` variants. No:
  - **PageShellSkeleton** for initial app/shell load (sidebar + main blocks).
  - **Page-specific skeletons** that mirror the real page (e.g. Dashboard skeleton with same outer `min-h-screen dot-grid` and inner `max-w-[1400px] ...` and stat grid + panel placeholders).
- Loading states are minimal and don’t match the final layout, so the jump from skeleton to content feels disjointed.

### 2.5 Layout shell behavior

- **Current**: Authenticated layout only sets `main` with `marginLeft` and `min-h-screen`. Missing:
  - `minWidth: 0` on main (for flex/grid children that need to shrink).
  - Optional loading state that shows PageShellSkeleton before rendering children.
  - Mobile: no hamburger, no overlay sidebar, no `paddingTop` when menu is closed.

### 2.6 Alignments and padding

- **mi48**: Inner container always `px-4 py-6 sm:px-6`, `space-y-6` between sections; panel headers `px-4 py-3` or `px-5 py-*`; table cells `px-4 py-3`.
- **Pentagron**: Mixed: `p-6` on whole page, then `px-4 py-3` in Panel. No `sm:px-6`; no guarantee that every page uses the same inner container, so alignment and padding are inconsistent across pages.

### 2.7 Settings page

- Uses `p-6 space-y-0 max-w-7xl mx-auto` in one place; rest of the page is not wrapped in the same mi48-style shell. So settings doesn’t follow the same “outer dot-grid + inner max-w + padding” pattern.

### 2.8 New project / other forms

- New project: `p-6 animate-fade-in` and `max-w-xl` for the form only. No `min-h-screen dot-grid` or inner `max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6`. Centering and background differ from mi48.

---

## 3. Implementation Plan (MI48-Exact Structure, Pentagron Context)

Apply in order so layout and loading are consistent first, then per-page shells and skeletons.

### Phase A: Global foundation

1. **grid-overrides.css**
   - Add `frontend/src/styles/grid-overrides.css` (or equivalent) with the same rules as mi48: `.grid`, `.grid-cols-1`–`.grid-cols-5`, responsive `md`/`lg` column variants, `.gap-1`–`.gap-6`, and any flex/space utilities used by mi48, with `!important`.
   - Import it in root layout **after** Tailwind/globals so it wins.

2. **globals.css**
   - Add any missing theme-aware utilities mi48 has that Pentagron uses (e.g. surface, border, grid-cols-6, line-clamp, overflow, transitions). Keep existing Pentagron tokens; only add classes needed for the mi48 layout/skeleton patterns.

3. **Page content wrapper component (optional but recommended)**
   - Add `PageContentShell` (or use a shared wrapper): outer `min-h-screen dot-grid` (and optional class for centered/empty pages), inner `w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6 box-border`.
   - Use it on every authenticated content page so structure is identical to mi48.

### Phase B: Layout shell

4. **Authenticated layout**
   - Set `main` to `minWidth: 0` (and keep `min-h-screen`, `transition`).
   - If you add an auth/loading check, show a `PageShellSkeleton` while loading (same structure as mi48: sidebar strip + main blocks).

5. **Mobile (optional for this pass)**
   - If you want parity with mi48: add hamburger, overlay sidebar, and `paddingTop: 56` on main when sidebar is closed. Can be a follow-up.

### Phase C: Skeletons

6. **PageShellSkeleton**
   - Implement as in mi48: full-page flex, narrow sidebar skeleton, main area with title block + two content blocks. Use in authenticated layout when `loading === true` (if you introduce that).

7. **Dashboard (home) page skeleton**
   - Same outer/inner as dashboard: `min-h-screen dot-grid` → `max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6`.
   - Inside: page title/subtitle placeholders, grid of 4 stat skeletons, panel skeleton for “Active engagements”, panel for “Recent activity”. Reuse existing `Skeleton` variants where possible.

8. **Other page skeletons (project detail, flow detail, settings)**
   - Each should use the **same** outer/inner shell as the real page and approximate the real layout (header, panels, tables/lists) so loading and loaded states match.

### Phase D: Apply page shell to every authenticated page

9. **Dashboard** (`(authenticated)/page.tsx`)
   - Wrap in: outer `min-h-screen dot-grid`, inner `w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6 box-border`. Move current content inside inner. Use new dashboard skeleton when `loading`.

10. **Project list/detail** (`projects/[id]/page.tsx`)
    - Same outer + inner. Loading: skeleton that mirrors project header + panels.

11. **New project** (`projects/new/page.tsx`)
    - Same outer + inner. Form stays `max-w-xl` inside the inner container; page still has dot-grid and consistent padding.

12. **Flow detail** (`flows/[id]/page.tsx`)
    - Same outer + inner (flow page may use full height for graph; inner can be `flex flex-col flex-1 min-h-0` where needed, like mi48 analyze).

13. **Settings** (`settings/page.tsx`)
    - Replace current wrapper with outer `min-h-screen dot-grid bg-surface-1` and inner `w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6 box-border`. Tabs and content inside inner.

### Phase E: Components and polish

14. **Panel**
    - Already has border and header; align header padding with mi48 (`px-4 py-3` or `px-5` where used). Ensure content area uses `p-4` (or same as mi48 where you use `p-3`).

15. **Buttons / typography**
    - Use existing `.page-title`, `.page-subtitle`, `.panel-header-text`; ensure primary actions use the same padding and hover as mi48 (`px-4 py-2` / `px-5 py-2`, `bg-blue-600`, `hover:bg-blue-500`, `text-xs` or `text-sm`).

16. **Auth pages (login/setup)**
    - Already use split layout in globals. Ensure class names and structure match mi48 (e.g. `auth-layout` vs `auth-auth`); if you want pixel-perfect parity, align padding and `auth-form-wrap` max-width (420px) and status dot.

---

## 4. Summary Table

| Area              | MI48 pattern                                               | Pentagron current                    | Action                                      |
|-------------------|------------------------------------------------------------|--------------------------------------|---------------------------------------------|
| Page outer        | `min-h-screen dot-grid` (+ optional flex/bg)              | No dot-grid; ad-hoc wrappers         | Add outer wrapper to every content page     |
| Page inner        | `max-w-[1400px] mx-auto px-4 py-6 sm:px-6 space-y-6`       | `p-6 space-y-6` only; no max-width   | Add inner container (or PageContentShell)    |
| Grid reliability  | grid-overrides.css with !important                         | None                                 | Add grid-overrides.css, import after Tailwind|
| Shell loading     | PageShellSkeleton (sidebar + main blocks)                  | None                                 | Add PageShellSkeleton; use in layout if needed |
| Page loading      | Page-specific skeletons with same shell as content        | Generic Skeleton line/card/stat      | Add dashboard (and optionally project/flow/settings) skeletons |
| Main layout       | main: minWidth 0, optional paddingTop mobile              | main: marginLeft, min-h-screen       | Add minWidth: 0; optional mobile padding     |
| Panel             | .panel, header px-4 py-3, content p-4                    | Same idea; align padding             | Align header/content padding with mi48      |
| Auth              | Split 65/35, auth-brand, auth-main, form max 420px         | auth-layout; similar                 | Align class names and form width if desired  |

---

## 5. File-Level Checklist

- [ ] `frontend/src/styles/grid-overrides.css` — create and import in layout.
- [ ] `frontend/src/app/globals.css` — add any missing utilities (grid, surface, spacing) used by the new shells/skeletons.
- [ ] `frontend/src/app/(authenticated)/layout.tsx` — main `minWidth: 0`; optional PageShellSkeleton when loading.
- [ ] `frontend/src/components/ui/Skeleton.tsx` — add `PageShellSkeleton`; add `DashboardPageSkeleton` (and optionally others).
- [ ] `frontend/src/app/(authenticated)/page.tsx` — wrap with dot-grid + inner container; use dashboard skeleton when loading.
- [ ] `frontend/src/app/(authenticated)/projects/[id]/page.tsx` — same shell; optional project-detail skeleton.
- [ ] `frontend/src/app/(authenticated)/projects/new/page.tsx` — same shell.
- [ ] `frontend/src/app/(authenticated)/flows/[id]/page.tsx` — same shell (with flex/min-h-0 if needed).
- [ ] `frontend/src/app/(authenticated)/settings/page.tsx` — same shell (`min-h-screen dot-grid bg-surface-1` + inner).
- [ ] Optional: shared `PageContentShell` component used by all of the above.
- [ ] Optional: mobile sidebar (hamburger, overlay, paddingTop) in layout/sidebar.

Once this is done, Pentagron will follow mi48’s exact design structure (page shell, grids, padding, skeletons), with only the context (product name, routes, copy) differing.
