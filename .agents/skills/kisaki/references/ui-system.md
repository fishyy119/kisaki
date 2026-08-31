# UI Design System

## Key Files

- `apps/desktop/src/renderer/src/styles/globals.css` - Theme tokens and base styles
- `apps/desktop/src/renderer/src/components/ui/` - UI component library
- `apps/desktop/src/renderer/src/components/ui/button.vue` - Button variants
- `apps/desktop/src/renderer/src/components/ui/input.vue` - Input component
- `apps/desktop/src/renderer/src/components/ui/form.vue` - Form wrapper
- `apps/desktop/src/renderer/src/components/ui/field/` - Field layout components; `FieldGroup`
  owns the app-wide form texture
- `apps/desktop/src/renderer/src/components/ui/dialog/` - Dialog components
- `@kisaki3/extension-ui-vue` `SettingsSection` - Multi-section settings recipe; the app has
  no surface of that type yet, so it has no counterpart component
- `apps/desktop/src/renderer/src/components/ui/icon.vue` - Icon component
- `apps/desktop/src/renderer/src/components/shared/game/game-forms/game-characters-form-dialog/` - ListForm pattern reference

## Design Language

**Professional desktop software style**:

- High information density, restrained interface
- Neutral colors as base, blue as accent/focus color
- Structure expressed through background layers, not card stacking
- One form texture: a form is a plain stack of fields (`FieldGroup`), each a label above
  its full-width control, bound by proximity. Every form in the app reads the same way,
  from a one-field rename dialog to the settings dialog.
- Frames and dividers are a grouping device, so they are spent only where there are
  groups to tell apart: a multi-section settings surface. They do not belong to forms -
  around a single field a frame states a grouping that does not exist.
- Row lists and divider-based grids, not repeated cards: use borders, aligned columns,
  and compact row rhythm to make related controls scannable.
- Lightbox base: the app shell is a backlit panel of three layers (`ambient-light.vue`) -
  light (soft gradient lamp, the only dynamic layer), diffuser (grain sheet texturing
  the lamp), and glass (translucent base panes). Floating layers (popover/dialog) are
  opaque slabs with no alpha, blur, or light
- Shadows come in exactly three semantic tiers (raised/overlay/modal); borders stay subtle
- Short animations (100-150ms) for popovers

## Surface Types

Layout is unified per surface type, not per owner. The system keeps a finite
vocabulary of surface types, each with exactly one canonical recipe; implementers
(app pages and extension webviews alike) classify the surface they are building
and apply that recipe. Do not design layouts per page, and do not copy the layout
of the nearest existing screen when it is a different surface type. When a new
surface type genuinely has no recipe, define the recipe once (document it here,
add shared components where needed), then build the surface; whichever side meets
the need first proposes, but the recipe belongs to the system and both sides use it.

| Surface type              | Test                                                                                             | Recipe                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Form                      | Fields to fill and submit, whatever the dialog's size                                            | Plain `FieldGroup`, no frame                            |
| Multi-section settings    | Several titled groups of pure configuration on one resident surface                              | `SettingsSection` per group with the `rows` surface     |
| Integration control panel | Account-backed integration surface mixing status, operations, and configuration                  | Left tab rail + fixed tab vocabulary (see below)        |
| Data row list             | Entity rows with inline actions                                                                  | `border` + `divide-y` rows                              |
| Section navigation        | Non-settings surfaces: up to 3 sections top horizontal `TabsList`, 5+ in a large dialog left rail | Category first; thresholds only where no category fits |
| Detail page content       | Content-first sections                                                                           | `Section` with de-emphasized xs heading                 |
| Report surface            | Data-dense read-only bands                                                                       | Full-bleed bands + `divide-y` (see Report surfaces)     |

The line between a form and a multi-section settings surface is the presence of
several groups, not the owner and not the surface's size. A dialog holding one flat
set of settings (the app settings dialog) is a form. Extension settings webviews carry
three to six titled groups each and are multi-section settings surfaces; the app has no
instance of that type today and adopts the same recipe when it grows one.

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
   constant on every plane. Toolbars/filter bars `bg-muted/30` + border. Table
   headers are `bg-muted/30` (footers `bg-muted/20`) and always OUTSIDE the
   scroll container - nothing is ever pinned over scrolling content. Band
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
| Page title | `text-base` | `PageHeaderTitle` only - one per screen                                                 |
| Content    | `text-sm`   | Control values, options, buttons, menu items, dialog titles, list titles, body copy     |
| Meta       | `text-xs`   | Field/dialog descriptions, subtitles, badges, shortcuts, group labels, tabs, table text |

Above the roles sit display sizes for figures that are read as data, not as
prose: `text-lg` for stat values, `text-2xl` for the report hero figure (the
app-wide ceiling; `text-3xl` is never used). A number is a figure only when it
is the point of its cell - counts inside a label stay at the label's size.

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
- Structure: `DialogHeader` → `DialogBody` → `DialogFooter`
- Header/footer are apparatus strips and carry the band fill (header `bg-muted/30`,
  footer `bg-muted/20`, rounded to the slab corners); the body stays bare. This is
  fill, not a plane: apparatus is ink-shaded in light mode and lit in dark mode,
  same as toolbar bands. Never fake slab chrome with `bg-surface`.
- Scope maps to region in a tool dialog. Header: identity only (title + the
  top-right close; action buttons would sit awkwardly beside it). Band strip:
  tab-scoped controls - the scope switch plus the active tab's filters, with a
  constant footprint so nothing shifts on tab switch. Footer: dialog-global
  operations (refresh, bulk maintenance) as labeled buttons - the footer is the
  dialog-level action zone and never varies with tabs.

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

### Multi-Section Settings (SettingsSection)

For a resident surface carrying several titled groups of settings - today the
extension settings webviews:

```vue
<div class="space-y-4">
  <SettingsSection :title="t" :description="d" surface="rows">
    <FieldGroup>
      <Field orientation="horizontal">...</Field>
    </FieldGroup>
  </SettingsSection>
</div>
```

- `SettingsSection` owns the heading: `text-sm font-medium` title, optional xs
  muted description, and an `#actions` slot at the heading's right edge.
- `surface="rows"` restyles the section's `FieldGroup` into one bordered
  `rounded-md` column of `divide-y` rows (`px-3 py-2.5`). That frame is what
  keeps one group distinct from the next; it is the reason the recipe exists and
  the reason a plain form does not use it.
- Plain sections (no `surface`) carry content that frames itself: data lists,
  action button rows, documentation blocks.
- The component lives in `@kisaki3/extension-ui-vue`. When the app grows a
  surface of this type, mirror it into `components/ui/` rather than inventing a
  second recipe.

### ListForm with Sub-Form Pattern

For editing lists of items (e.g., game characters, tags, related sites), use a parent-child dialog pattern:

**Parent Dialog** (list management):

- Fetches data with `useAsyncData(..., { enabled: () => open.value })`
- Uses `watch(data, ...)` to initialize local array (avoid binding DB result directly)
- Body: `max-h-[60vh] overflow-auto scrollbar-thin`
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
  editingItem.value = { id: nanoid() /* defaults */ }
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
    <DialogContent>
      <DialogHeader><DialogTitle>Edit Items</DialogTitle></DialogHeader>
      <DialogBody class="max-h-[60vh] overflow-auto scrollbar-thin">
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
    <DialogContent>
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
