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
- Ambient light: a soft gradient glow painted under the whole UI (`ambient-light.vue`);
  layer colors are slightly translucent so the glow bleeds through, floating layers
  add glass blur on top
- Shadows come in exactly three semantic tiers (raised/overlay/modal); borders stay subtle
- Short animations (100-150ms) for popovers

## Semantic Tokens

### Background Layers

```css
bg-background    /* App main background (RootLayout, main content) */
bg-surface       /* Structural containers (Titlebar, Sidebar) */
bg-popover       /* Popover/Dropdown/Tooltip/Toast backgrounds */
bg-card          /* Content block containers (use sparingly) */
```

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

### Glass & Light (theme-driven)

Raw tokens live in theme presets (`core/theme/presets/*/theme.css`, `:root` + `.dark`);
`globals.css` composes them into utilities. The default preset is Kisaki's own
oklch system: one cool neutral hue anchor (~256deg) with disciplined chroma,
per-mode calibrated primary/semantic colors, and a categorical chart ramp.

```css
/* Depth-plane alpha (composed into layer colors). Three planes matching the
 * shadow tiers; themes opt out with 100%. Control fills
 * (primary/secondary/accent/input/muted) stay OUTSIDE the alpha system;
 * neutral fills are themselves relative alpha tints (ink on light, white on
 * dark) so controls keep the same relationship on base and elevated planes. */
--alpha-base     /* bg-background / bg-surface / bg-card */
--alpha-overlay  /* bg-popover (popover/dropdown/tooltip/toast) */
--alpha-modal    /* bg-dialog */

/* Thick glass recipe for floating layers (custom utility in globals.css):
 * backdrop-filter: blur(--glass-blur) saturate(--glass-saturate) */
glass

/* Elevation shadows - the ONLY legal shadow utilities (Tailwind scale is
 * disabled via --shadow-*: initial; shadow-none stays as reset).
 * Floating tiers lead with an inset top highlight = specular glass edge. */
shadow-raised   /* small elements, thumbnails, active states */
shadow-overlay  /* floating layers: popover/dropdown/tooltip/toast */
shadow-modal    /* dialogs */

/* Ambient light (bottom layer glow, rendered by layout/ambient-light.vue) */
--light-1 / --light-2 / --light-3 / --light-strength

/* Material grain (full-window noise layer above all surfaces) */
--grain-opacity
```

Dark elevation ladder: higher planes are lighter (base < card < popover < dialog);
light mode inverts (elevated planes step toward white).

Ambient light source: cover-driven detail pages call `useAmbientLight(coverUrl)`
(extraction in `core/theme/light/`); other pages fall back to theme `--light-*` tokens.

**One paint per region rule**: every screen region (titlebar, sidebar, page header
strips, page body/scroll containers) paints exactly ONE base-plane color
(`bg-surface` or `bg-background`) directly over the ambient light; layout containers
in between stay transparent. This keeps glow transmission uniform window-wide.
Local tints (`bg-background/50` toolbars, `bg-muted` chips, sticky table headers)
sit on top of the region's paint as before.

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

- `bg-dialog` + `border` + `rounded-md` + `shadow-modal backdrop-blur-glass`
- No visual overlay/scrim: separation comes from shadow-modal + glass blur
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

- Theme tokens: `@theme inline`, `--color-*`, `--radius`, `--alpha-base/overlay/modal`, `--light-*`
- Background: `bg-background`, `bg-surface`, `bg-popover`, `bg-card`
- Glass/shadow: `shadow-raised`, `shadow-overlay`, `shadow-modal`, `glass`
- Ambient light: `lightController`, `useAmbientLight`, `ambient-light`
- Text: `text-foreground`, `text-muted-foreground`
- Icon: `@iconify/tailwind4`, `icon-[mdi--...]`, `Icon`
- UI wrapper: `useForwardPropsEmits`, `inheritAttrs: false`, `data-slot`
- Animation: `data-[state=open]:animate-in`, `fade-in`, `zoom-in`
- Form: `FieldGroup`, `FieldLabel`, `FieldContent`

## Constraints

- Use semantic tokens, not hardcoded colors
- Shadows: only `shadow-raised` / `shadow-overlay` / `shadow-modal` (plus `shadow-none`).
  The Tailwind size scale (`shadow-sm/md/lg/...`) is disabled and has no effect
- Layer alpha is baked into layer colors; do not add per-component translucency to
  layer backgrounds (use `/NN` modifiers only for interaction states on control fills)
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
