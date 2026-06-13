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
npm i -D @iconify/tailwind4 @iconify-json/mdi
```

The kit relies on the semantic tokens (`--kisaki-*`) that the webview client
mirrors onto the document root, and on `base.css` for the shared base layer
(typography, colors, scrollbars). It works inside any webview opened through
`kisaki.webviews.open()`. Without the iconify plugin the components render but
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
