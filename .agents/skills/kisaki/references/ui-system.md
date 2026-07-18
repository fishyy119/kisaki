# UI Design System

## Key Files

- `apps/desktop/src/renderer/src/styles/globals.css` - Theme tokens and base styles
- `apps/desktop/src/renderer/src/components/ui/` - UI component library
- `apps/desktop/src/renderer/src/components/ui/button.vue` - Button variants
- `apps/desktop/src/renderer/src/components/ui/input.vue` - Input component
- `apps/desktop/src/renderer/src/components/ui/form.vue` - Form wrapper
- `apps/desktop/src/renderer/src/components/ui/field/` - Field layout components
- `apps/desktop/src/renderer/src/components/ui/dialog/` - Dialog components
- `apps/desktop/src/renderer/src/components/ui/icon.vue` - Icon component
- `apps/desktop/src/renderer/src/components/shared/game/game-forms/game-characters-form-dialog/` - ListForm pattern reference

## Design Language

**Professional desktop software style**:

- High information density, restrained interface
- Neutral colors as base, blue as accent/focus color
- Structure expressed through background layers, not card stacking
- Dense settings and workflow surfaces should prefer divider-based grids or row lists
  over repeated cards: use borders, aligned columns, and compact row rhythm to make
  related controls scannable.
- Lightbox base: the app shell is a backlit panel of three layers (`ambient-light.vue`) -
  light (soft gradient lamp, the only dynamic layer), diffuser (grain sheet texturing
  the lamp), and glass (translucent base panes). Floating layers (popover/dialog) are
  opaque slabs with no alpha, blur, or light
- Shadows come in exactly three semantic tiers (raised/overlay/modal); borders stay subtle
- Short animations (100-150ms) for popovers

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
chroma, per-mode calibrated primary/semantic colors, and a categorical chart ramp.

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

/* Light tokens (theme-owned; page-level dynamic colors override them on the
 * document root) */
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

/* Charts: categorical ramp under the canvas chroma discipline (tight
 * lightness band, capped chroma). Large fills (pie slices, bars) run at
 * color-mix 85% toward transparent; strokes/chips use full tokens. */
--chart-1..5
```

Dark elevation ladder: higher planes are lighter (base < popover < dialog);
light mode inverts (elevated planes step toward white). Card is not a plane.
Slab depth comes entirely from the ladder + shadow tiers + border; there is
no backdrop-filter anywhere in the app.

**Light scoping**: ambient light has exactly ONE scope - the page. Detail
pages call `useAmbientLight(coverUrl)`; extracted colors land on the document
root and the light layer (`.glow`) is the only consumer. No per-surface light
overrides, no light on floating slabs.

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
   constant on every plane. Toolbars/filter bars `bg-muted/50` + border. Table
   headers are `bg-muted/50` and always OUTSIDE the scroll container - nothing
   is ever pinned over scrolling content. Every headered columnar list is a
   real `Table`; the component owns the mechanism: `fixed-header` + `columns`
   render header/rows/footer as separate tables sharing one colgroup, every
   region reserving the scrollbar gutter, with band chrome (fill + border) on
   the region wrappers so it covers the gutter strip. Content wells
   `bg-muted/50`, controls `bg-muted` / `bg-secondary` / `bg-input`, hover
   `bg-accent` (+ `/NN` for lighter states). Never use layer colors
   (`bg-background/NN` etc.) as fills.
3. **Emphasis** (what deserves attention): color only with meaning. `primary`
   for main actions/focus/selection, semantic colors for status, `--chart-*`
   for data; everything else stays neutral.

Object cards (media covers, extension entries, option rows) are transparent:
border + `shadow-raised` define them, imagery borders stay faint
(`border-border/40`). Page content partitioning uses Section + line frames
(`rounded-lg border p-4`), never filled cards.

## Size & Typography

### Base Typography

- Font size: `14px` (text-sm)
- Line height: `1.5`
- Font weight: `450`
- Secondary text: `text-xs` (12px)

### Control Heights

- Button/Input default: `h-7`
- Small: `h-6`
- Compact (icon buttons): `h-5`
- Titlebar: `h-9`
- Sidebar buttons: `size-10`

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
- `company-related-sites-form-dialog/` - Array field editing

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
