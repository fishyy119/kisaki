# @kisaki3/extension-ui-vue

Vue UI kit for Kisaki extension webview documents. Implements the Kisaki
design language on top of the mirrored app theme, so extension UI stays
visually consistent with the app without copying app code.

## Setup

Install the SDK and the kit, plus the iconify Tailwind plugin and an icon-set
data package (the kit renders icons via iconify mask classes; `mdi` covers the
built-in glyphs). Then assemble the webview document stylesheet:

```css
@import 'tailwindcss';
@import '@kisaki3/extension-sdk/base.css'; /* shared base layer (framework-agnostic) */
@import '@kisaki3/extension-sdk/tailwind.css'; /* Tailwind token mapping */
@import '@kisaki3/extension-ui-vue/style.css'; /* kit component layer */
@plugin "@iconify/tailwind4"; /* required: renders the kit's icon classes */
```

```bash
pnpm add -D @iconify/tailwind4 @iconify-json/mdi
```

The kit relies on the semantic tokens (`--kisaki-*`) that the webview client
mirrors onto the document root, and on `base.css` for the shared base layer
(typography, colors, scrollbars). It works inside any session of a declared
webview page or dialog. Without the iconify plugin the components render but
their icons (dialog close, select chevron, checkbox tick, spinner) are blank.

## Usage

```vue
<script setup lang="ts">
import { Button, Field, FieldGroup, Input, Switch } from '@kisaki3/extension-ui-vue'
</script>

<template>
  <FieldGroup>
    <Field
      label="API token"
      description="Stored in extension storage."
    >
      <Input v-model="token" />
    </Field>
    <Field
      orientation="horizontal"
      label="Enable sync"
    >
      <Switch v-model="enabled" />
    </Field>
    <Button>Save</Button>
  </FieldGroup>
</template>
```

## Components

Alert, AlertDialog, Badge, Button, Checkbox, Dialog, Field, Form, Icon, Input,
Label, Progress, RadioGroup, Select, Separator, Spinner, Switch, Table, Tabs,
Textarea, Tooltip, plus the `cn` class utility.

`Icon` mirrors the app's API — `<Icon icon="icon-[mdi--home]" class="size-4" />`
— and works with any iconify set installed in the consuming project.

The kit exists so extensions can build webviews in the app's style. That likeness
is the kit's goal, not a coupling: the kit and the app evolve independently, and
a style or technique is carried across when it serves. The one shared contract is
the dialog size vocabulary of `@kisaki3/extension-api`, which tells the host how
large a dialog to allocate.

`Dialog` geometry: `DialogContent` takes a `size` step (`sm` prompts, `md` forms -
the default, `lg` list editing, `xl` detail views and tables, `2xl` editors) and
an optional `fill` for tool dialogs that need a definite height; callers never
pass width or height classes, and `DialogBody` is the only part that scrolls.
The same steps name the `size` of a declared webview dialog contribution.

Layout discipline: sizes are `rem` steps, never pixel or viewport lengths, and a
layout that changes with width uses an unnamed container query against the
nearest container (`@sm:grid-cols-2`, `@xl:grid-cols-3`), with the grid's frame
declared as that container (`class="@container ..."`). Viewport breakpoints
(`sm:`, `lg:`) measure the webview document's initial 16px rem and never the
interface scale, and named containers reach past the width a block actually
gets; the kit's ESLint config carries a `layout-discipline` rule for both.

## Document shells

The host renders webview surfaces as pure containers — the document owns all
chrome. Two scaffolds provide the app anatomy for each surface:

- `WebviewDialogShell` for `dialog` surfaces: app dialog chrome (header with
  title and a close button wired to `webview.close()`, scrollable body,
  optional `footer` slot).
- `WebviewPageShell` for `page` surfaces: the app page-header strip (title,
  `actions` slot) over a scrollable content region, painting one translucent
  pane per region so light transmission matches native app pages.

```vue
<WebviewDialogShell title="Settings">
  <SettingsForm />
  <template #footer>
    <Button>Save</Button>
  </template>
</WebviewDialogShell>
```

These are the only session-bound components in the kit; everything else is
pure UI. Both accept `contentClass` (e.g. `p-0`) for full-bleed layouts.

## Standalone preview

The kit reads the `--kisaki-*` tokens the host injects at runtime, so it has no
colors of its own. To preview components outside the host (Storybook, a gallery),
import the SDK's default-token sheet to supply a neutral light/dark default:

```css
@import 'tailwindcss';
@import '@kisaki3/extension-sdk/preview.css'; /* preview-only default tokens */
@import '@kisaki3/extension-sdk/base.css';
@import '@kisaki3/extension-sdk/tailwind.css';
@import '@kisaki3/extension-ui-vue/style.css';
@plugin "@iconify/tailwind4";
```

Toggle dark with `data-kisaki-theme="dark"` on `<html>`. Don't ship `preview.css`
in a published extension — the host owns the real values at runtime.
