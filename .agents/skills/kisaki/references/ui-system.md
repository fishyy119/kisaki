# UI Design System

## Key Files

- `apps/desktop/src/renderer/src/styles/globals.css` - Theme tokens and base styles
- `apps/desktop/src/shared/window.ts` - Viewport contract: window floors, interface scale steps
- `apps/desktop/src/renderer/src/core/interface-scale/` - Root font size from the interface scale, `remToPx`
- `apps/desktop/src/main/services/window/geometry.ts` - Window floors, default size, pinned zoom
- `apps/desktop/src/renderer/src/components/ui/` - UI component library
- `apps/desktop/src/renderer/src/components/ui/button.vue` - Button variants
- `apps/desktop/src/renderer/src/components/ui/input.vue` - Input component
- `apps/desktop/src/renderer/src/components/ui/form.vue` - Form wrapper
- `apps/desktop/src/renderer/src/components/ui/field/` - Field layout components; `FieldGroup`
  owns the app-wide form texture
- `apps/desktop/src/renderer/src/components/ui/dialog/` - Dialog components
- `apps/desktop/src/renderer/src/components/ui/table/` - Column-driven table: header, widths,
  alignment, reflow and horizontal-scroll fallbacks from one `columns` definition
- `apps/desktop/src/renderer/src/components/ui/container/` - `ContainerStep` vocabulary shared by
  every `collapseBelow` / `reflowBelow` prop
- `extensions/bangumi/src/ui/settings/app.vue` - Integration control panel (rail shell)
  reference implementation
- `apps/desktop/src/renderer/src/components/ui/icon.vue` - Icon component
- `apps/desktop/src/renderer/src/components/ui/back-to-top/` - Back-to-top scroll aid (overlay
  component + the `useBackToTop` calibration its footer home shares)
- `apps/desktop/src/renderer/src/components/shared/game/game-forms/game-characters-form-dialog/` - ListForm pattern reference

## Viewport Contract

The UI is designed against a floor, not a target monitor. The contract lives in
`src/shared/window.ts` and both processes derive from it. Window limits are fixed
CSS pixels; design tiers are rem, because the layout only ever sees rem:

| Contract              | Value                                                                               |
| --------------------- | ----------------------------------------------------------------------------------- |
| Main window minimum   | 960×560 CSS px (`MAIN_WINDOW_MIN_CONTENT_SIZE`), independent of the interface scale |
| Main window default   | 1400×850, capped at 90% of the primary work area, never below the minimum           |
| Reader window minimum | 480×360 CSS px                                                                      |
| Interface scale       | `settings.ui_scale`: 70–130% in 10% steps, default 100%, no step ever disabled      |
| Supported displays    | 1366×768 @125% (work area ≈ 1092×576), 1280×720 @100%, and everything larger        |

Three design tiers, in rem of main-area width (window minus the 3.25rem sidebar):

| Tier            | Main area | Reached by                | Promise                                                                                   |
| --------------- | --------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| **Comfortable** | ≥ 88rem   | 1280px @100%              | Every surface at its intended layout; multi-column bands side by side                     |
| **Correct**     | ≥ 65rem   | 960px @100%, 1092px @110% | No overflow, clipping, or stray scrollbar; single-column bands, full tables, docked rails |
| **Usable**      | ≥ 49rem   | 960px @130%               | Everything reachable and readable: tables reflow, header navigation folds                 |

The floor and the scale are decoupled on purpose: a large scale in a small window
shows less and degrades through the fluid rules below, instead of the window
refusing to fit the screen or a scale step being greyed out. The scale is a
density preference, ±30% around the design size (70% for dense displays at 100%
OS scaling, where `text-xs` is 7.35px - the smallest role the system carries);
accessibility magnification is the operating system's display scaling, which the
app inherits, so no step above 130% exists to stand in for it.

The interface scale is the single lever of the rem scale: the main `WindowService`
is its only writer (the settings surface calls `window:set-interface-scale`;
`Ctrl+=` / `Ctrl+-` step through the presets and `Ctrl+0` resets, in every window),
it pushes `window:interface-scale-changed`, and each renderer sets
`--text-base-size = 14px × scale` on its root (`core/interface-scale`). The webview
bridge mirrors the resolved size into extension documents. Layout code that must
speak pixels (virtualizer row estimates, canvases, tick budgets) uses `remToPx()`
from `core/interface-scale` inside a computed, never a literal pixel constant.

Page zoom is pinned: there is no application menu (macOS keeps app + edit roles),
`zoomFactor` is reset to 1 on every load, and pinch zoom stays disabled.
Development builds cycle the main window through the probe stops (floor, laptop
work area, comfortable tier) with `Ctrl+Shift+M`; combined with the scale steps
this reaches every tier.

## Units

A dimension is either a content size or a region clamp, and each has one unit:

| Quantity                                         | Unit                           | Why                                                                       |
| ------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------- |
| Content sizes (widths, heights, gaps, type)      | `rem` (Tailwind steps)         | Encode content - characters per line, lines - and follow the scale        |
| Region clamps (`w-full`, `max-h-full`, `h-full`) | `%` of the containing region   | The region is what is actually available; it is never the viewport        |
| Layout switches                                  | container queries (`@<step>:`) | Lay out against the width a surface actually gets                         |
| `vh` / `vw`                                      | root layout `h-screen` only    | Wrong reference (window chrome), blind to the scale, tied to aspect ratio |

Never write pixel or viewport lengths in classes (`w-[400px]`, `max-h-[60vh]`),
arbitrary type sizes (`text-[11px]`), `text-xl` / `text-3xl`, viewport breakpoints
(`md:`), or named containers and container queries (`@container/region`,
`@md/region:`); the `kisaki/layout-discipline` ESLint rule rejects them in
templates and in `cn()` / `cva()` strings. The kit carries its own copy of the
same rule (`packages/extension-ui-vue/eslint.config.ts`); the two configs are
independent, and a change in one is not owed to the other. Extension webviews are
not linted by it; they inherit the discipline through the kit's components and
this reference. Two responsive axes exist on a desktop - window size and text scale -
and this vocabulary covers both without viewport units.

## Modal Region and Layering

Every document that hosts app dialogs declares one `#modal-layer`
(`MODAL_LAYER_ID` / `MODAL_LAYER_CLASS` from `components/ui/dialog`). It is the
region modals are confined to and centered in:

- Main window: the `absolute inset-0` first child of the area below the titlebar
  (`root-layout.vue`). A modal covers sidebar and content, never the window chrome,
  so the window stays draggable and its controls stay operable while a dialog is
  open. No constant encodes the titlebar height - the structure does.
- Reader window: the whole document (native frame).
- Extension webview documents: no layer; the kit's positioner is `fixed inset-0`.

Stacking has two levels and no tokens: the layer is `z-40` (above in-page `z-10`
overlays; it never overlaps the titlebar), floating layers stay `z-50`.

## Design Language

**Professional desktop software style**:

- High information density, restrained interface
- Neutral colors as base, blue as accent/focus color
- Structure expressed through background layers, not card stacking
- One form texture: a form is a plain stack of fields (`FieldGroup`), each a label above
  its full-width control, bound by proximity. Every form in the app reads the same way,
  from a one-field rename dialog to the scanner editor.
- Frames and dividers are a grouping device, so they are spent only where there are
  groups to tell apart: a multi-section settings surface such as the app settings
  dialog. They do not belong to forms - around a single field a frame states a
  grouping that does not exist.
- Two apply models and never a mix: records are drafts committed by Save (forms);
  independent settings apply the moment they change (preferences).
- Row lists and divider-based grids, not repeated cards: use borders, aligned columns,
  and compact row rhythm to make related controls scannable.
- Lightbox base: the app shell is a backlit panel of three layers (`ambient-light.vue`) -
  light (soft gradient lamp, the only dynamic layer), diffuser (grain sheet texturing
  the lamp), and glass (translucent base panes). Floating layers (popover/dialog) are
  opaque slabs with no alpha, blur, or light
- Shadows come in exactly three semantic tiers (raised/overlay/modal); borders stay subtle
- Short animations (100-150ms) for popovers

## Surface Types

Layout is unified per surface type, not per page. The app keeps a finite
vocabulary of surface types, each with exactly one canonical recipe; a page
classifies the surface it is building and applies that recipe. Do not design
layouts per page, and do not copy the layout of the nearest existing screen when
it is a different surface type. When a new surface type genuinely has no recipe,
define the recipe once (document it here, add shared components where needed),
then build the surface.

The extension UI kit (`@kisaki3/extension-ui-vue`) exists so extensions can build
webviews in the app's style; that likeness is the kit's product goal, not an
obligation either side owes the other. The app and the kit evolve independently:
neither mirrors the other's components, a recipe here binds app surfaces only,
and the kit's recipes (the integration control panel, its settings sections) are
the kit's own. Syncing a style or a technique across the boundary is allowed when
it serves, never required. The one shared thing is a contract, not a design: the
webview dialog size vocabulary of `@kisaki3/extension-api`, which tells the host how
large a dialog to allocate.

| Surface type              | Test                                                                                              | Recipe                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Form                      | One record, valid only as a whole, submitted at once                                              | Plain `FieldGroup`, no frame; Save / Cancel footer; edits are a draft    |
| Preferences               | Independent settings, each valid on its own                                                       | Every control applies and persists on change; no Save, Cancel, or draft  |
| Multi-section settings    | Several titled groups of preferences on one surface                                               | Preferences apply model; a `Section` heading over each `FieldGroup`      |
| Integration control panel | Account-backed integration surface mixing status, operations, and configuration                   | Left tab rail + fixed tab vocabulary (see below)                         |
| Data row list             | Entity rows with inline actions                                                                   | `border` + `divide-y` rows                                               |
| Data table                | Uniform records compared across named columns                                                     | `Table` with column definitions (see Table)                              |
| Section navigation        | Non-settings surfaces: up to 3 sections top horizontal `TabsList`, 5+ in a large dialog left rail | Category first; thresholds only where no category fits                   |
| Detail page content       | Content-first sections                                                                            | `Section` with de-emphasized xs heading                                  |
| Report surface            | Data-dense read-only bands                                                                        | Full-bleed bands + `divide-y` (see Report surfaces)                      |
| Finder                    | Type, see hits, pick one (the library search)                                                     | `2xl` `fill` dialog: query row, scope switch, grouped fluid grid of hits |

Form versus preferences is the apply model, and it is decided by the data, not by
the owner or the surface's size. A record (a scanner, a game, a launch config) is
valid only as a whole, so it is edited as a draft and committed by Save; a set of
independent switches (the app settings dialog, the scanner settings dialog) has no
whole to validate, so each control writes its own setting the moment it changes -
selects and switches on change, text and numbers on blur or Enter - and a failed
write reverts the control and reports through `notify`. The two models never mix
on one surface: a dialog with a Save button applies nothing early, and a
preferences surface has no Save. Extension settings webviews hold records
(credentials, endpoints) and stay forms.

Multi-section settings is a preferences surface with several titled groups; the app
settings dialog (Appearance / Startup and window / Updates) is its reference. It
uses the app's own grouping - the same `Section` heading as a detail page over a
plain `FieldGroup` of horizontal fields - with no frame or dividers: two to four
rows under a heading read by proximity, as every form in the app does. A settings
surface that grows past five groups moves to a left rail, the same as any other
5+ section navigation; top tabs stay content navigation.

## Semantic Tokens

### Background Layers

```css
bg-background    /* App main background (page body regions) */
bg-surface       /* Structural containers (Titlebar, Sidebar, page headers) */
bg-popover       /* Popover/Dropdown/Tooltip/Toast backgrounds */
bg-dialog        /* Modal surfaces */
```

There is no card plane or card token: object cards are transparent, defined by
border + `shadow-raised`.

### Text & Information

```css
text-foreground         /* Primary text */
text-muted-foreground   /* Secondary text, descriptions, placeholders */
text-surface-foreground /* Text on surface background */
text-popover-foreground /* Text on popover background */
```

### State Colors (use sparingly)

```css
primary      /* Main actions, focus ring, primary buttons */
destructive  /* Dangerous actions (delete, close) */
success      /* Success notifications */
warning      /* Warning notifications */
info         /* Info notifications */
```

### Borders & Input

```css
border-border  /* Dividers, outlines */
bg-input       /* Input background (currently transparent) */
bg-muted       /* Disabled input background */
```

### Lightbox & Light (theme-driven)

Raw tokens live in theme presets (`core/theme/presets/*/theme.css`, `:root` + `.dark`);
`globals.css` composes them into utilities ("Lightbox recipes"). The default preset is
Kisaki's own oklch system: one cool neutral hue anchor (~256deg) with disciplined
chroma, per-mode calibrated primary/semantic colors, and a single chart ink token.
The default lamp is near-monochrome cool light (hues within ~15deg of the anchor,
low chroma, lightness near the base plane in each mode); color in the lamp is
reserved for cover-derived page palettes.

The base is a lightbox of three layers, bottom to top: **light** (`.glow`, the lamp -
the only dynamic layer), **diffuser** (`.grain`, static noise sheet texturing the lamp
and dithering its gradients), and **glass** (translucent base panes). Content sits on
the glass and stays untextured; floating layers (popover/dialog) are opaque slabs.

```css
/* Pane alpha (composed into bg-background/bg-surface). What reaches the eye
 * through a pane is (1 - pane-alpha) times the light/diffuser underneath;
 * themes opt out with 100%. popover/dialog take NO alpha (opaque slabs).
 * Control fills (primary/secondary/accent/input/muted) stay OUTSIDE the
 * alpha system; neutral fills are themselves relative alpha tints (ink on
 * light, white on dark) so controls keep the same relationship on base and
 * elevated planes. */
--pane-alpha

/* Light tokens (theme-owned; page palettes land as sheet-scoped overrides
 * rendered by AmbientLight) */
--light-1..3 / --light-strength

/* Diffuser grain (raw value; calibrated against pane attenuation) */
--grain-opacity

/* Elevation shadows - the ONLY legal shadow utilities (Tailwind scale is
 * disabled via --shadow-*: initial; shadow-none stays as reset). Tiers are
 * elevation treatments, not sizes: raised is a pure cast shadow (transparent
 * cards have no lit face); overlay/modal bundle the slab rim light (inset
 * top highlight + shaded bottom edge) and apply to OPAQUE slabs only. If a
 * floating layer ever needs the cast shadow without the rim light (e.g.
 * image content), split the rim light into the Tailwind v4 inset-shadow-*
 * namespace locally (theme.css + globals.css + affected wrappers) instead
 * of adding a fourth tier. */
shadow-raised   /* small elements, thumbnails, active states */
shadow-overlay  /* floating layers: popover/dropdown/tooltip/toast */
shadow-modal    /* dialogs */

/* Charts: data ink discipline. All chart marks derive from the single
 * --chart token; instances of the same kind (top-N lists, rank ladders)
 * are coded by density steps, never by different hues. Density follows
 * mark area: thin marks (lines, strokes, crosshairs, peak heatmap cells)
 * use the full token, bars run at color-mix 70% toward transparent, large
 * area fills stay at or below ~20-40% (area opacity or ladder steps).
 * Chart ink is NOT --primary: primary is the interaction accent (actions,
 * focus, selection) at full chroma; chart ink is calibrated for large data
 * areas (lower chroma, mode-specific lightness) and must stay independent
 * so charts never compete with controls. Top-N entity rankings are not
 * charts: use RankingList (divider rows + share bars + cover imagery).
 * Registered as --color-chart so bg-chart utilities work. A categorical
 * ramp gets designed only when a true multi-series identity consumer
 * exists (e.g. media types); do not re-add it speculatively. */
--chart
```

Dark elevation ladder: higher planes are lighter (base < popover < dialog);
light mode inverts (elevated planes step toward white). Card is not a plane.
Slab depth comes entirely from the ladder + shadow tiers + border; there is
no backdrop-filter anywhere in the app.

**Light scoping**: ambient light has exactly ONE scope - the page. Detail
pages call `useAmbientLight(coverUrl)`; extraction yields a raw oklch palette
(hue anchors, `light/extraction.ts`), the controller holds it, and AmbientLight
converges it for the active mode (per-mode ambient bands + sRGB gamut cap,
`light/convergence.ts`) into sheet-scoped `--light-*` overrides - the light
layer (`.glow`) is the only consumer. Clearing has a short grace period so
detail-to-detail navigation cross-fades palettes directly instead of flashing
the theme light. No per-surface light overrides, no light on floating slabs.

**One paint per region rule**: every screen region (titlebar, sidebar, page header
strips, page body/scroll containers) paints exactly ONE base-plane color
(`bg-surface` or `bg-background`) directly over the light layers; layout containers
in between stay transparent. This keeps transmission uniform window-wide.

### Emphasis Fill Spec (three orthogonal axes)

1. **Plane** (which elevation am I on): `bg-background/surface/popover/dialog` -
   base panes compose `--pane-alpha`, floating slabs are opaque. Used ONLY to
   paint the region you are - exactly once; never as a fill inside another
   plane, and never repainted by children.
2. **Fill** (how far do I rise from my plane): relative tints only, direction
   constant on every plane. Toolbars/filter bars are the `Toolbar` component,
   which owns the band chrome (`bg-muted/30` + border) - see the Band recipe.
   Table headers and footers are `bg-muted/30` (band chrome is one calibrated
   value; near-equal tints read as mistakes, not hierarchy) and always OUTSIDE
   the scroll container - nothing is ever pinned over scrolling content. Band
   strength is calibrated with the light theme ladder (background 0.965 /
   bands ~0.95 / surface 0.935): stronger tints land below the surface chrome
   and the layers fuse. Every headered columnar list is a real `Table`; the
   component owns the mechanism: `fixed-header` + `columns` render
   header/rows/footer as separate tables sharing one colgroup, every region
   reserving the scrollbar gutter, with band chrome (fill + border) on the
   region wrappers so it covers the gutter strip. Content wells `bg-muted/50`,
   controls `bg-muted` / `bg-secondary` / `bg-input`, hover `bg-accent`
   (+ `/NN` for lighter states). Never use layer colors (`bg-background/NN`
   etc.) as fills.
3. **Emphasis** (what deserves attention): color only with meaning. `primary`
   for main actions/focus/selection, semantic colors for status, `--chart`
   for data; everything else stays neutral.

Object cards (media covers, extension entries, option rows) are transparent:
border + `shadow-raised` define them, imagery borders stay faint
(`border-border/40`). Page content partitioning uses Section + line frames
(`rounded-lg border p-4`), never filled cards.

**Report surfaces** (statistics pages): the page itself is the partitioned
object. Full-bleed horizontal bands separated by `divide-y`; inside a band,
equal-height cells split by `border-l` (asymmetric 2:1 only when content
richness differs, e.g. trend | distribution; peer content like rankings gets
equal columns). Cells pad themselves (`p-4`); the scroll container has no
padding so lines close against the viewport. Visual weight decreases down the
page: the hero band anchors its height with the period's most-played cover
(large, right side) and distributes three left-column layers across it -
the page's only 2xl figure with delta (2xl is the app-wide type ceiling; 3xl
is never used), a full-width composition strip (top
entities' share, chart ink density ladder by rank, residual segment
`--color-muted`), and a fact row spread by spacing alone. No rules inside a
band's content: all lines belong to the page grid. Chart bodies use fixed
heights (200px; heatmap 100px) so band bottoms align; the rankings band
sits last so uneven column ends fall off the page (full-width ranking bands
flow rows into two columns via RankingList `columns`). Embedded report
modules on mixed-content pages (e.g. detail activity tab) keep their line
frames; full-page reports never frame.

## Size & Typography

### The rem Scale

The root font size is `14px` (`--text-base-size` on `:root`, applied to `html`), so
the whole Tailwind rem scale renders at 87.5%. Effective pixels:

| Utility     | Nominal | Effective |
| ----------- | ------- | --------- |
| `text-base` | 16px    | 14px      |
| `text-sm`   | 14px    | 12.25px   |
| `text-xs`   | 12px    | 10.5px    |
| `text-lg`   | 18px    | 15.75px   |
| `text-2xl`  | 24px    | 21px      |

Never reason in nominal values, and never write an arbitrary size
(`text-[11px]`): pixels bypass the scale and, because the scale is compressed,
they land between steps and read as noise. `--text-base-size` is the single
lever a future interface-scale setting turns, so everything must stay in rem.
Base line height is `1.5` and base weight `450`.

### Type Roles

Size follows the role of the text, not the component that happens to own it.
Three roles carry all body copy:

| Role       | Utility     | What it covers                                                                          |
| ---------- | ----------- | --------------------------------------------------------------------------------------- |
| Hero title | `text-lg`   | The entity name in a detail hero (`font-semibold`) - one per detail surface             |
| Page title | `text-base` | `PageHeaderTitle` only - one per screen                                                 |
| Content    | `text-sm`   | Control values, options, buttons, menu items, dialog titles, list titles, body copy     |
| Meta       | `text-xs`   | Field/dialog descriptions, subtitles, badges, shortcuts, group labels, tabs, table text |

Above the roles sit display sizes for figures that are read as data, not as
prose: `text-lg` for stat values, `text-2xl` for the report hero figure (the
app-wide ceiling; `text-xl` and `text-3xl` are never used). A number is a
figure only when it is the point of its cell - counts inside a label stay at the
label's size.

### Control Sizes

A control's height and font size are one decision, made by the component:

| Size      | Height | Font      |
| --------- | ------ | --------- |
| `default` | `h-7`  | `text-sm` |
| `sm`      | `h-6`  | `text-xs` |
| `xs`      | `h-5`  | `text-xs` |
| `lg`      | `h-8`  | `text-sm` |

Call sites pick a size and never set a control's font: a control that needs to
look smaller than its neighbours is on the wrong step, not missing a class.
Tables are the one surface that sizes its contents: `Table` declares `text-xs`
once on the `<table>` and rows, heads, cells, and captions inherit it.

Other fixed heights: titlebar `h-9`, sidebar buttons `size-10`.

### Spacing

Use Tailwind spacing: `gap-1.5`, `px-2/3/4`, `p-3/4`

### Border Radius

- Default: `rounded-md`
- Large (thumbnails, cards): `rounded-lg`

## Interaction States

### Hover

```css
hover:bg-accent
hover:bg-accent/50
hover:text-accent-foreground
```

### Active

```css
active:bg-accent/80
active:bg-primary/80
```

### Focus

```css
/* Buttons/clickable */
focus-visible:ring-1 focus-visible:ring-primary

/* Inputs */
focus:border-primary focus:outline-none
```

### Disabled

```css
disabled:opacity-50 disabled:cursor-not-allowed
disabled:bg-muted  /* for inputs */
```

## Component Recipes

### Button

See `buttonVariants` in `components/ui/button.vue`:

- Flat style with subtle border
- Compact sizing (`h-7`)
- Variants: default, destructive, outline, ghost, link

### Input/Textarea

- `bg-input` + `border-border`
- `focus:border-primary`
- See `components/ui/input.vue`, `components/ui/textarea.vue`

### Dialog

- `bg-dialog` (opaque slab) + `border` + `rounded-md` + `shadow-modal`
- No visual overlay/scrim: separation comes from shadow-modal + the elevation ladder
- 100-150ms fade/zoom animation
- **Geometry is declared, never styled.** `DialogContent` is the only owner of
  dialog geometry: it portals into the modal region, brings its own positioner
  (region-filling, `p-4` inset, centered), and lays the slab out as a flex column.
  Call sites pass two things and no width or height classes:
  - `size` - the width step, a content class: `sm` 24rem (single-control prompts),
    `md` 32rem (single-column forms, the default), `lg` 42rem (list editing with row
    actions, two-column forms), `xl` 56rem (detail views, data tables, side-by-side
    comparison), `2xl` 72rem (editors, multi-column searchers). The positioner clamps
    every step at small windows.
  - `fill` - a definite height for tool dialogs whose content is unbounded or varies
    (tabs, tables, virtual lists, webview shells): the region height up to the dialog
    ceiling. Without it the slab is content-sized up to the same ceiling.
    The ceiling is 48rem - the region height at the comfortable tier - so it only binds
    on tall windows, where it keeps slab proportions stable. Both bounds are rem clamped
    by the region; no `vh`, no `min-h`, no per-dialog heights, no `max-h` on
    `DialogBody`. `DialogBody` is `min-h-0 grow` and the only part that scrolls;
    `Form` is a transparent flex column so the body keeps scrolling inside it.
- `DialogTitle` is one line that always fits: `icon` prop (muted identity icon),
  truncated text, `#trailing` slot for badges that keep their size. `DialogHeader`
  reserves the close button's corner (`pr-10`).
- `AlertDialog` takes no geometry props: always `sm`, content-sized; its
  description scrolls if it ever has to.
- Two roles, one unconditional look each:
  - `Dialog` is a workbench window (forms, toolbars, scrollable lists).
    Structure: `DialogHeader` → `DialogBody` → `DialogFooter`; header and
    footer are apparatus strips and carry the band fill (`bg-muted/30` +
    border, rounded to the slab corners); the body stays bare. The footer
    band does work here: it caps scrolled content and closes the frame.
    This is fill, not a plane: apparatus is ink-shaded in light mode and lit
    in dark mode, same as toolbar bands. Never fake slab chrome with
    `bg-surface`.
  - `AlertDialog` is a prompt (momentary, text-first, never scrolls, always
    small). Titlebar band only; the footer is a bare spacing row (no fill,
    no separator - `px-4 pb-4 pt-2`). Bottom apparatus inverts the
    band/body proportion on a small slab, and a separator above buttons
    only does work when content can scroll under it - a prompt's never
    does.
- Scope maps to region in a tool dialog. Header: identity only (title + the
  top-right close; action buttons would sit awkwardly beside it). Band: a
  `Toolbar` at the top of the body - the scope row above the active tab's
  query row (see the Band recipe), with a constant footprint so nothing
  shifts on tab switch. Footer: dialog-global operations (refresh, bulk
  maintenance) as labeled buttons - the footer is the dialog-level action
  zone and never varies with tabs.

### Band (Toolbar)

Every strip of query controls under a page or dialog header is the `Toolbar`
component (`components/ui/toolbar`): it owns the band chrome (`bg-muted/30` +
`border-b`) and stacks `ToolbarRow`s. No surface hand-builds the strip.

The band chrome is fill, not a plane: the host must paint the pane under the
band region (a page wraps band + body in one `bg-background` region, as the
automation page and `EntityBrowsePanel` hosts do; a dialog's band sits on the
opaque `bg-dialog` slab). A band over an unpainted container leaks the raw
lightbox layers through the fill.

- Row order: the scope row (which body of content - tabs with icon + label +
  count) sits above the query row (what to see inside it). A surface without
  a scope switch keeps only the query row.
- Query row anatomy is fixed: the leading part is `SearchInput`
  (`flex-1 max-w-xl`) followed by the match count (only while a query is
  active); everything fixed-size - enum filters, selects, `SortControl`,
  `FilterTrigger` - goes in the row's `#trailing` slot, in that order. No
  spacer elements: the trailing group is `ml-auto`.
- The row wraps, it never squeezes. Fixed controls keep their content width
  (a select is as wide as its longest option, a rem step chosen from that
  label); `SearchInput` yields down to its 9rem floor; when floor and trailing
  group no longer share a line, the group drops to a second line, right-aligned,
  and the search keeps the first line whole. Nothing on a band has a width that
  changes with the window except the search.
- `ToolbarRow` is a query container: tab labels collapse to icon + title below
  the step the call site declares (`collapseBelow`), the explorer rail being the
  consumer.
- A select trigger packs its content left (icon, value) and pushes only the
  chevron to the end; the value truncates rather than widening the trigger.
- Operations (check updates, refresh, clear) never enter the band - they
  belong to page `#actions` or the `DialogFooter`.
- `SearchInput` owns the search debounce (default 200ms; clearing commits at
  once; an outside model reset replaces the draft). `SortControl` is the one
  sort control - field select + direction toggle sharing one options list,
  `compact` folds both into an icon-triggered menu for narrow rails. An
  option that is an order of its own (membership, a manual arrangement)
  declares `directionFixed`: it sits first in its list, pins the direction
  to ascending, and disables the toggle. `FilterTrigger` opens the shared
  `FilterPanel` over a `FilterState` and is how entity lists filter; admin
  lists (status / source / category enums) keep their own enum controls.
- A band row is one size step: every control on it takes `size="sm"`
  (`SearchInput`, `SortControl`, selects, `icon-sm` buttons). The same
  components at their default size serve forms - the form sort field is the
  default-size `SortControl`.
- Content entity surfaces do not assemble the band by hand either:
  `EntityBrowsePanel` / `EntityBrowseToolbar` compose it over one
  `EntityListQuery` (tabs with counts, search, hit count, membership-first
  sort, filter).

### Responsive Layout (container queries)

Surfaces lay out against the width they actually get, never against the
window: a detail overview lives in a resizable pane and in an `xl` dialog, a
toolbar row lives in the explorer rail and in a full-width band. Queries are
unnamed and resolve against the **nearest** container (`@3xl:grid-cols-[3fr_1fr]`,
`@max-2xl:hidden`).

The one invariant: **the nearest container is the subject's width-giver** - the
ancestor whose inline size is the space the subject lays out in. A name is a
routing key for skipping a nearer container; nothing in this tree needs to skip
one, so containers are never named. Named queries fail silently (they measure a
distant root when the component lands in a narrower column, and never match
when that root is absent), unnamed ones fail visibly and locally, and the fix
is always the same one-class change on the width-giver. Two placement rules
keep the invariant:

| Case                                                                               | Who declares `@container`                                                       | Why                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The component's **internal layout** depends on its own width                       | The component, on a wrapper one level above the grid                            | A query cannot style its own container. Detail overview, hero info column, `StatsGrid` frame, `ActivityPanel`, `Table` scroller                                                                                          |
| The component's **mode** depends on the parent's width; its own width is intrinsic | The parent width-giver: `ToolbarRow`, `PageHeader`, `Tabs` root, the reader row | `container-type: inline-size` is size containment - the element's inline size can no longer come from its content, so a shrink-to-fit control that declared its own container would collapse to zero width in a flex row |
| `Field orientation="responsive"`                                                   | `FieldGroup`                                                                    | The group is the field's width-giver                                                                                                                                                                                     |
| Page and dialog bodies written in place (report bands, card grids)                 | `ScrollRegion` viewport                                                         | The baseline width-giver of in-place content                                                                                                                                                                             |

Containment is therefore only ever placed on elements whose inline size is
imposed from outside (block stretch, `flex-1 min-w-0`, a grid track, `absolute
inset`, an explicit width) - never on a shrink-to-fit element. Container queries
measure the content box, so a threshold on a padded container (`PageHeader
px-4`) is compared against the width minus that padding; the derivation rule
below includes the padding term for this reason.

Steps are Tailwind's container scale at the 14px root: `@lg` 32rem, `@2xl` 42rem,
`@3xl` 48rem, `@4xl` 56rem, `@5xl` 64rem, `@6xl` 72rem, `@7xl` 80rem; media-query
`rem` resolves at 16px, so the two scales never mix. Components that take a step
as a prop (`collapseBelow`, `reflowBelow`) type it as `ContainerStep` and keep a
static class map so Tailwind sees every class.

**Thresholds are derived, not chosen by eye.** A layout switches to n columns only
when each cell keeps its comfortable width - the width at which its own content
reads without truncation or label collision:

```
threshold(n) = n × comfortable cell width + gaps + surface padding, rounded up to a step
```

then verified to sit at least 2rem away from every host's floor content width, so
the switch never flickers around a tier boundary. The check runs against the
narrowest host at the largest scale (the usable tier), not only at 100%. References:
extension cards (24rem comfortable, 2 cols `@2xl`, 3 cols `@7xl`); report charts
band (a monthly trend chart keeps its labels at 40rem: side by side `@7xl`, ranking
pair `@4xl`); detail overview two columns `@3xl`; hero stats (icon 1 + label 4 +
value 7 = 12rem a cell, two cells plus the 2rem gap = 26rem) two columns `@md` of
the info column, which is about 38rem at 130% on the floor. Fluid content inside a cell
scales continuously instead: a chart's tick count is the measured plot width
divided by one label's rem budget (`TrendChart`), never a fixed number.

**Usable-tier devices.** Below the correct tier a surface degrades through a fixed
vocabulary, never through hiding content:

| Device                | Owner                                         | Rule                                                                                                                 |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Label collapse        | `TabsList` / `SegmentedControl collapseBelow` | Labels hide, icons and counts stay, label moves into the title                                                       |
| Navigation fold       | `PageHeaderNav collapseBelow`                 | Route pills become one dropdown showing the active route; both renderings are in the markup, the container picks one |
| Panel float           | Reader `NavPanel`                             | Below `@2xl` of the reader row the panel is absolute over the page; the shell renders the click-catcher              |
| Table reflow / scroll | `Table reflowBelow` / `minWidth`              | See Table                                                                                                            |
| Band wrap             | `ToolbarRow`                                  | The trailing group drops to a second line before the search yields below its floor (see Band)                        |

A device exists only where the contract reaches the width that triggers it. The
library rail has none: its pane minimums (16rem rail, 30rem content, the handle)
fit the narrowest main area the contract produces (49rem at 130% on the floor),
so `ResizableLayout` clamps and never floats - a float mode there would be
unreachable, untestable code. The reader panel floats because the reader floor
(480px, 26rem at 130%) cannot hold the 18rem panel beside a readable page. When
the contract or a minimum changes, re-derive before adding a device.

A floated panel is a floating layer, not a pane: an opaque `bg-popover` slab with
`shadow-overlay`, the same as every popover. The docked form keeps its translucent
`bg-surface`. The click-catcher behind it is transparent, as the dialog overlay
is - a tinted layer color there would be a layer used as a fill.

### Tabs and segmented controls

`TabsTrigger` (and `SegmentedControlItem`) declare `icon` and `label` as props;
the slot carries extras (counts) that stay visible. `TabsList` / `SegmentedControl`
take `collapseBelow="<step>"`: below that step of the nearest container the labels
hide, the icon and count stay, and the label moves into the trigger title. A row
that is still too wide scrolls inside the list rather than overflowing the surface.
The call site picks the step because it knows what shares the container with the
list: entity detail tabs and browse / filter tabs collapse below `2xl`, the
statistics header scope switch below `6xl` (it shares the header with a title, a
period navigator, and route navigation).

### Table

`Table` is driven by `columns: TableColumn[]` - label, width, alignment, tone, and
reflow role in one place. The component renders the header row from it (`inset`
pads the first and last column to the surface edge for page-wide tables), the
colgroup widths come from it, and each `TableCell` claims its column from its row
in template order, taking the column's alignment and tone and carrying its label.
Call sites write body rows only and never color a cell for its column: a
secondary column is `tone: 'muted'` on the definition, so the emphasis is one
decision, applies to every cell, and is dropped by the card, where the label
carries the hierarchy and every value reads in the foreground (an empty-value
placeholder stays muted - that is value semantics, not column tone). A row's cells
are static (toggle content inside a cell, never the cell), and conditional columns
are built with the same condition as the cells.

Type in the card is the card's, not the table's: the label takes the header's
role (`text-xs` muted), every value steps down to the meta role (`text-xs`,
foreground - a `text-sm` a cell uses in table mode is neutralized by the reflow
CSS), and only the headline keeps the content size, so the record's identity is
the one thing read at `text-sm`. Table mode keeps the sizes the rows author.

Columns are never hidden at narrow widths - a hidden column is missing
information the user cannot recover. Two fallbacks exist, and a table declares
one:

- `reflowBelow="<step>"` for tables whose row still reads as a list item: below
  the step of the table's own container the same rows reflow into record cards.
  The card has three tracks - label, value, actions: the `primary` cell is the
  headline across label and value; the `actions` cell sits beside it on the
  first row; each `meta` cell is a definition entry (`td::before` prints the
  column label in the header's type role) that subgrids into the label and value
  tracks, so labels align down the whole card. The reflow never rearranges what
  is inside a cell: a value with its qualifier line stays two lines, a badge
  stays a badge. Scanner and automation lists reflow below `4xl`.

A cell is one datum: a value, optionally with one qualifier line beneath it in
the muted xs role (a subtitle, an id, a source, the next occurrence). Two peer
facts never share a cell - that is a missing column, and it reads wrong in both
the table and the card. Cell content is always wrapped in an element (never bare
text in the `td`), so the card can place it.

- `minWidth="<rem>"` for tables whose rows must stay uniform (virtualized lists,
  dense record grids): the table keeps its width and the surface scrolls it
  sideways. Scanner issues (`48rem`) and automation run history (`40rem`).

The threshold follows the derivation rule above: the sum of the fixed columns plus
the comfortable width of the flexible one, rounded up to a step.

### Overflow and text

- Data text on one line (names, file names, paths, ids in rows) is `truncate`; the
  flex or grid cell around it is `min-w-0`, and a `title` carries the full value
  where it matters.
- Multi-line user text (descriptions, notes, error messages) is `wrap-break-word`;
  the body already sets `overflow-wrap: break-word`, cells still need `min-w-0`.
- Unbreakable tokens (paths, URLs, fingerprints, ids) in a wrapping block are
  `wrap-anywhere`.
- `whitespace-nowrap` belongs to controls (`Button`, `Badge`, `TabsTrigger`,
  `SelectTrigger`), never to data text. `SelectTrigger` truncates its value; the
  caller sizes the trigger.
- Every floating layer binds its size to what reka leaves it:
  `max-h-(--reka-<kind>-content-available-height)` with `overflow-y-auto` on menus and
  sub-menus, height and width on popovers and hover cards, `max-w-xs wrap-break-word`
  on tooltips. No hand-built `max-h` + `overflow-auto` inside a menu.
- Rails that can outgrow a short window (the sidebar navigation) scroll with a
  hidden scrollbar. `ResizableLayout` speaks rem (pane bounds encode content, the
  stored pane width follows the interface scale; pixels exist only at the DOM
  edge), keeps the content pane at `minRightWidth`, and clamps a stored width the
  container can no longer honor. The explorer rail floor (16rem) is what its
  seven-type scope row needs.

### Finder (library search)

A finder shows the name being matched at a readable width at every tier; the
type grouping is a secondary axis. It is a `2xl` `fill` dialog whose hits fill a
fluid grid - `repeat(auto-fill, minmax(16rem, 1fr))`, a cell being thumbnail 2 +
gap + a readable name - so a narrower dialog holds fewer cells per row, never
narrower cells. A fixed split into per-type columns is not an option: seven
columns at 14rem need 98rem, more than any dialog step, so that layout fails the
threshold rule at every width.

- Query row: magnifier, borderless `Input`, spinner while loading, `ESC` kbd.
- Scope row: `SegmentedControl` - all types plus one item per content type, with
  counts; labels fold to icons below `3xl` of the row.
- Results: one `ScrollRegion`, every hit the query matches (no cap). In the
  all-types scope, a section per type under a sticky `bg-dialog` header of one
  fixed height (`h-7` - the sticky handover between sections must not move the
  content beneath) with icon, label, count, and "show all N" while the section
  shows its preview of eight; in a type scope, that type's full grid. Thumbnails
  load lazily. Empty states through `StateView`.
- Keys: ↑↓ move by row (the column count is read from the grid; crossing into the
  neighbouring section keeps the column; ↑ from the first row returns to the
  query), ←→ move by cell once a hit is focused (in the query they move the
  caret), Tab reaches the scope switch (arrows then step it), Enter opens, Esc
  closes. The footer lists them.
- The trigger in the page header is a plain `secondary` `sm` action - magnifier,
  label, shortcut kbd - the same at every width: a content-sized button has
  nothing to yield, and hiding its shortcut by header width only made it
  smaller than it reads.

### Empty / Loading / Error (StateView)

`StateView` is the only block-level placeholder in the app. Every region that can
render nothing goes through it - loading spinner, empty, not-found, and error all
come from the same component, so a placeholder never gets hand-built out of a
centered div, an icon, and a muted paragraph:

```vue
<StateView
  v-if="items.length === 0"
  state="empty"
  icon="icon-[mdi--puzzle-outline]"
  :title="m.x.emptyTitle"
  :description="m.x.emptyHint"
  class="py-8"
>
  <template #actions><Button>…</Button></template>
</StateView>
```

- The caller owns only the region's box (`py-8`, `h-40`, `h-full`, a frame); the
  component owns icon opacity, type sizes, and spacing.
- `size` defaults to `md`; use `sm` inside compact panes (popover lists, table
  `state` slots, sidebar lists, chart cells).
- Title is optional. A one-line placeholder passes `description` alone.
- The `error` state has a fixed presentation (alert icon + the app's error title +
  the error message); pass `:error` and do not invent a per-surface error title.
- Inline busy indicators (inside a button, a row, a toolbar) keep using `Spinner`
  directly - `StateView` is for regions, not for widgets.
- Inline placeholders inside a detail-page section are a different device:
  `Section` / `SectionScroll` render `emptyText` as an italic xs line.

### Back To Top (scroll aid)

Scroll aids are transient controls that answer one question about a scroll
region and exist only while the answer is useful: the explorer's locate button
("where is the current entry") and `BackToTop` ("back to the start"). They are
not band chrome - the "nothing is pinned over scrolling content" rule governs
strips (headers, toolbars, table heads), not these - and they carry no
entrance animation: they appear and disappear by `v-if`, the way locate always
has.

`components/ui/back-to-top` is one device with one calibration
(`useBackToTop`) and two homes:

- **Footer home.** A surface that already owns a footer strip (today only the
  library explorer, whose footer exists for its count) renders the button in
  that strip, at the right edge beside locate, through `useBackToTop`.
- **Overlay home.** Every other qualifying surface mounts `BackToTop`: one
  `size-7` button styled as an opaque slab (`bg-popover` + `border` +
  `shadow-overlay`) in the bottom-right corner of the scroll viewport. It has
  no hover state - a hover fill would either replace the slab plane with an
  alpha tint or need a nested element; the control is a static fixture while it
  exists and keeps only the mandatory `focus-visible` ring.
- **Never build a footer for it.** Chrome must earn its place with resident
  content; a strip that only carries a transient control is an empty line and a
  permanent 32px tax on surfaces whose vertical space is the content. Should a
  surface grow a footer for real resident content, the button moves in.

The device is calibrated once and exposes no options: it shows once the region
is scrolled past two viewport heights (short content never shows it), and the
jump is instant (a desktop control jumps; virtualized rows are estimates and a
long smooth scroll through unmeasured rows judders). Both homes share the
glyph (`BACK_TO_TOP_ICON`).

Overlay host contract - a positioned flex column that exactly frames the
scroll viewport, the scroll container inside it as its flex item, the overlay
as the sibling. Nested flex, not a percentage height: a column flex item under
an auto-height container (a `max-h` dialog) is not a definite size for
percentages, so `h-full` there would stop the body scrolling. The box is layout
only; the scroll container still paints its plane:

```vue
<div class="relative flex min-h-0 flex-1 flex-col">
  <div ref="scrollRef" class="min-h-0 flex-1 overflow-auto bg-background p-4">…</div>
  <BackToTop :target="scrollRef" />
</div>
```

In a detail dialog the box wraps `DialogBody` (bound through its exposed
`$el`) so the overlay stays inside the body region and never sits on the
`DialogFooter`.

Where it belongs is decided by surface type, not per page. It serves unbounded
library content regions - regions whose length grows with the collection:
content browse grids (`EntityBrowsePanel`, so favorites, uncategorized,
collection and tag detail on both surfaces), the collections and showcase
pages, the explorer list, and every entity detail body (page and dialog
alike). It is excluded from:

- **Readers** - scroll position is reading position; the reader's own chrome
  (page, chapter, progress) navigates.
- **Report surfaces** - bounded compositions whose page grid owns every line;
  a floating slab would sit on the data bands.
- **Admin lists and tool dialogs** (extensions, scanner, automation, task
  center, settings) - bounded working sets with their own filters.
- **Forms and list-editing dialogs** - bounded (`max-h`), and a form should be
  short.
- **Widget-scale scrolling** (`SectionScroll`, popovers, selects, command
  lists) - not a region.

### Form

Standard dialog form structure:

```vue
<DialogHeader>Title</DialogHeader>
<Form @submit="handleSubmit">
  <DialogBody>
    <FieldGroup>
      <Field>
        <FieldLabel>Label</FieldLabel>
        <FieldContent><Input v-model="value" /></FieldContent>
      </Field>
    </FieldGroup>
  </DialogBody>
  <DialogFooter>
    <Button type="button" variant="outline">Cancel</Button>
    <Button type="submit">Save</Button>
  </DialogFooter>
</Form>
```

`FieldGroup` is the form texture and has no variants: a plain `gap-5` column, no
frame and no dividers. It holds for a single field as much as for twenty, so
every form in the app reads the same. Notes:

- Fields carry their own label; wrap them in a `FieldGroup` even when there is
  only one, so form markup is uniform.
- A lone `Field` outside a group is for labelled content regions that frame
  themselves (e.g. the updater's changelog viewer), not for inputs.
- Use `orientation="horizontal"` when the value is compact enough to sit beside
  its label (switches, selects); the default vertical field gives the control
  the full width, which free-text inputs need.

### Multi-Section Settings

Two recipes, one per side, because the app and the kit evolve independently.

In the app, several titled groups of preferences are the app's own grouping - the
`Section` heading a detail page uses, over a plain `FieldGroup` of horizontal
fields, no frame and no dividers:

```vue
<DialogBody class="space-y-5 py-4">
  <Section :title="m.settings.sections.appearance">
    <FieldGroup>
      <Field orientation="horizontal">...</Field>
    </FieldGroup>
  </Section>
</DialogBody>
```

Two to four rows under a heading read by proximity, as every form in the app
does; a frame would state a grouping the heading already states. The app settings
dialog is the reference.

In the kit, extension settings webviews (TMDB, IGDB, YMGal, SteamGridDB) use the
kit's `SettingsSection`: a `text-sm font-medium` heading with an optional xs
description and `#actions` slot, and `surface="rows"` restyling the group into one
bordered `rounded-md` column of `divide-y` rows. That is the kit's recipe for its
consumers; the app does not carry it. Apply model follows the data on both sides
(see Surface Types): app preferences apply on change with no footer; extension
settings that hold credentials or endpoints are records and keep Save.

### Integration Control Panel (rail shell)

For account-backed integration extensions that mix status, operations, and
configuration (Bangumi, AniList, MyAnimeList, MangaDex, NeoDB, VNDB, Steam,
Google Books). The reference implementation is the Bangumi settings webview
(`extensions/bangumi/src/ui/settings/app.vue`); each extension copies the recipe
composition - the shell is ~40 lines of shared primitives and is deliberately
not a package component.

Shell composition:

```vue
<WebviewDialogShell :title="t" content-class="p-0 overflow-hidden">
  <Tabs v-model="activeTab" orientation="vertical" class="h-full min-h-0 flex-row gap-0">
    <aside class="flex w-40 shrink-0 flex-col border-r border-border p-2">
      <TabsList class="h-auto w-full flex-col items-stretch">
        <TabsTrigger class="h-8 justify-start px-2"><Icon />{{ label }}</TabsTrigger>
      </TabsList>
    </aside>
    <main class="min-w-0 flex-1 overflow-y-auto">
      <div class="mx-auto max-w-4xl space-y-4 px-4 py-4">
        <TabsContent value="..." class="mt-0">...</TabsContent>
      </div>
    </main>
  </Tabs>
</WebviewDialogShell>
```

Fixed tab vocabulary, fixed order; a tab the extension has no capability for is
simply not rendered:

1. **overview** - status cards (account health, sync switches, automation
   completeness, running jobs) plus quick navigation. Exists because tabs hide
   state; it is the landing page.
2. **account** - sign-in / token lifecycle, including expiry display.
3. **sync** - automatic push configuration plus the manual full-push flow
   (only for extensions that can write back).
4. **import** - import options and execution flows.
5. **automation** - recommended automation templates (status badge + one-click
   create through `kisaki.automations`).
6. **maintenance** - endpoints, client preferences (timeout, retries, naming),
   and destructive actions behind a confirm dialog (clear sync state, reset).

Content rules:

- Operations (import, full push, other task runs) live in tab bodies as flow
  areas with progress and preview dialogs. They never sit in a
  `SettingsSection` header `#actions` slot; header actions are reserved for
  light actions (test connection, restore defaults, external links).
- The draft/save lifecycle keeps the `WebviewDialogShell` footer recipe:
  dirty hint left, discard + save right.
- Preference edits save through the footer; long-running operations report
  through task runs. Action failures stay inline in the dialog's root alert and
  successes read from the refreshed UI state; detached outcomes (deeplink
  sign-in settling, background jobs) arrive as host notifications plus a
  `refreshRequested` push into the open document.

### ListForm with Sub-Form Pattern

For editing lists of items (e.g., game characters, tags, related sites), use a parent-child dialog pattern:

**Parent Dialog** (list management):

- Fetches data with `useAsyncData(..., { enabled: () => open.value })`
- Uses `watch(data, ...)` to initialize local array (avoid binding DB result directly)
- `DialogContent size="lg"`; the body scrolls on its own, no height classes
- Footer: Left side "Add" button (outline + `Icon mdi--plus`), right side "Cancel/Save"
- Manages `isSaving` state to disable save button during submission
- Handles reordering (move up/down) and deletion with confirmation dialog

```vue
<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const items = ref<Item[]>([])
const itemFormOpen = ref(false)
const editingItem = ref<Item | null>(null)
const isAddMode = ref(false)
const isSaving = ref(false)

const { data } = useAsyncData(fetchItems, { enabled: () => open.value })

// Initialize local copy
watch(data, (d) => {
  if (d) items.value = [...d]
})

function handleAddNew() {
  editingItem.value = { id: newId() /* defaults */ }
  isAddMode.value = true
  itemFormOpen.value = true
}

function handleEdit(item: Item) {
  editingItem.value = { ...item }
  isAddMode.value = false
  itemFormOpen.value = true
}

function handleItemSubmit(data: ItemData) {
  if (isAddMode.value) {
    items.value.push({ ...data, id: editingItem.value!.id })
  } else {
    const idx = items.value.findIndex((i) => i.id === editingItem.value!.id)
    if (idx !== -1) items.value[idx] = { ...data, id: editingItem.value!.id }
  }
  itemFormOpen.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="lg">
      <DialogHeader><DialogTitle>Edit Items</DialogTitle></DialogHeader>
      <DialogBody>
        <!-- List items with edit/delete/reorder buttons -->
      </DialogBody>
      <DialogFooter class="flex justify-between">
        <Button
          variant="outline"
          @click="handleAddNew"
        >
          <Icon
            icon="icon-[mdi--plus]"
            class="size-4 mr-1.5"
          />Add
        </Button>
        <div class="flex gap-2">
          <Button
            variant="outline"
            @click="open = false"
            >Cancel</Button
          >
          <Button
            :disabled="isSaving"
            @click="handleSave"
            >Save</Button
          >
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Sub-form dialog -->
  <ItemFormDialog
    v-if="itemFormOpen"
    v-model:open="itemFormOpen"
    :initial-data="isAddMode ? undefined : editingItem"
    @submit="handleItemSubmit"
  />
</template>
```

**Child Dialog** (single item form):

- Uses `Form` + `FieldGroup` for editing
- Distinguishes add/edit via `initialData?: T` prop (undefined = add mode)
- Uses `watch(() => open.value, ...)` to initialize/reset form on open
- Emits `submit` event with data, then closes

```vue
<script setup lang="ts">
interface Props {
  initialData?: ItemData // undefined = add mode
}
const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ submit: [data: ItemData] }>()

const formData = ref<ItemData>({/* defaults */})
const isAddMode = computed(() => !props.initialData)

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      formData.value = props.initialData ? { ...props.initialData } : {/* defaults */}
    }
  },
  { immediate: true }
)

function handleSubmit() {
  // Validate custom fields if needed
  emit('submit', { ...formData.value })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="sm">
      <DialogHeader>
        <DialogTitle>{{ isAddMode ? 'Add Item' : 'Edit Item' }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <!-- Form fields -->
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="open = false"
            >Cancel</Button
          >
          <Button type="submit">Save</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
```

**Reference implementations:**

- `game-characters-form-dialog/` - Grouped list with type categories + reordering
- `game-tags-form-dialog/` - Simple list with reordering
- `company-external-sites-form-dialog/` - Array field editing

### List Item Hover

```css
transition-colors hover:bg-accent/30
group-hover:opacity-100  /* for action buttons */
```

### Icon

Use `Icon` component with Iconify classes:

```vue
<Icon class="icon-[mdi--plus]" />
```

Zero JS runtime, CSS mask-based.

## Search Patterns

- Theme tokens: `@theme inline`, `--color-*`, `--radius`, `--pane-alpha`, `--light-*`
- Background: `bg-background`, `bg-surface`, `bg-popover`, `bg-dialog`
- Shadows: `shadow-raised`, `shadow-overlay`, `shadow-modal`
- Ambient light: `lightController`, `useAmbientLight`, `ambient-light`, `glow`, `grain`
- Text: `text-foreground`, `text-muted-foreground`
- Icon: `@iconify/tailwind4`, `icon-[mdi--...]`, `Icon`
- UI wrapper: `useForwardPropsEmits`, `inheritAttrs: false`, `data-slot`
- Animation: `data-[state=open]:animate-in`, `fade-in`, `zoom-in`
- Form: `FieldGroup`, `FieldLabel`, `FieldContent`
- Scroll aids: `BackToTop`, `useBackToTop`, `BACK_TO_TOP_ICON`, `showLocateButton`
- Viewport contract: `MAIN_WINDOW_MIN_CONTENT_SIZE`, `UI_SCALE_VALUES`, `stepUiScale`, `uiScale`,
  `remToPx`, `--text-base-size`, `window:set-interface-scale`, `window:interface-scale-changed`,
  `watchInterfaceScaleShortcuts`
- Modal region: `MODAL_LAYER_ID`, `MODAL_LAYER_SELECTOR`, `dialog-positioner`
- Dialog geometry: `size="`, `fill`, `DialogSize`, `min(100%,48rem)`
- Container queries: `@container`, `ContainerStep`, `collapse-below="`, `reflow-below="`,
  `:min-width="`, `data-role`, `data-label`
- Preferences: `Section` + `FieldGroup`, `applyRow`, `setInterfaceScale`

## Constraints

- Use semantic tokens, not hardcoded colors
- Shadows: only `shadow-raised` / `shadow-overlay` / `shadow-modal` (plus `shadow-none`).
  The Tailwind size scale (`shadow-sm/md/lg/...`) is disabled and has no effect
- `shadow-overlay` / `shadow-modal` bundle the slab rim light (inset top highlight);
  apply them to opaque slabs (`bg-popover` / `bg-dialog`) only
- Pane alpha is baked into the base layer colors; do not add per-component
  translucency to layer backgrounds (use `/NN` modifiers only for interaction
  states on control fills)
- Use `Icon` component for icons (CSS mask, tree-shakeable)
- No viewport breakpoints (`sm:`…`2xl:`), no named containers or named container queries,
  no pixel or viewport lengths in classes, no arbitrary type sizes:
  `kisaki/layout-discipline` enforces the Units section
- Layout thresholds are derived from comfortable cell widths and land at least 2rem
  from every host's floor; a fixed count where the width varies (chart ticks) is a bug
- Columns are never hidden: a table reflows (`reflowBelow`) or scrolls (`minWidth`)
- Dialog call sites never write width or height classes; geometry is `size` + `fill`
- A surface with a Save button applies nothing early; a preferences surface has no Save
- `components/ui/*` contains no business logic
- All interactive elements must have `focus-visible` state
- Reuse existing UI components; don't duplicate styles in business components
- Extension UI contributions must use the structured contribution registry

## UI Component Wrapper Pattern

`components/ui/*` wraps third-party components:

```vue
<script setup lang="ts">
import { useForwardPropsEmits, reactiveOmit } from '@vueuse/core'

defineOptions({ inheritAttrs: false })

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const forwarded = useForwardPropsEmits(reactiveOmit(props, 'class'), emit)
</script>

<template>
  <ThirdPartyComponent
    v-bind="{ ...$attrs, ...forwarded }"
    :class="cn(baseClass, props.class)"
  >
    <slot />
  </ThirdPartyComponent>
</template>
```

## Related

- [Renderer Patterns](renderer.md) - Vue component patterns
- [Extension System](extension-system.md) - UI contribution points
