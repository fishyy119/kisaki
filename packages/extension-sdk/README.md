# @kisaki3/extension-sdk

Authoring SDK for Kisaki extensions.

Use this package from extension code. It re-exports the public contracts from
`@kisaki3/extension-api` and adds the small authoring surface that extension entry
points use directly.

## Exports

- `defineExtension(definition)`.
- `kisaki`, a lazy bridge to host capabilities such as library, network, notify,
  events, runtime, scrapers, ingest, commands, background tasks, and webviews.
- `createWebviewRpc(transport, functions)`, a typed bidirectional RPC sugar over
  one webview session's `postMessage`/`onMessage`.
- All public types and validation helpers exported by `@kisaki3/extension-api`.

### `@kisaki3/extension-sdk/webview`

Browser-side entry imported by webview documents:

- `webview`, the in-document client: `params`, `theme`, `onThemeChange`,
  `postMessage`, `onMessage`, and `close`. The client also mirrors the active
  app theme as `--kisaki-*` CSS variables on the document root.
- `createWebviewRpc`, the same RPC sugar bound to the document side.

### `@kisaki3/extension-sdk/theme.css`

Tailwind v4 theme bridge for webview documents. It maps the mirrored
`--kisaki-*` variables onto Tailwind color tokens so documents use the same
semantic utilities as the app:

```css
@import 'tailwindcss';
@import '@kisaki3/extension-sdk/theme.css';
```

## Example

```ts
import { createWebviewRpc, defineExtension, kisaki } from '@kisaki3/extension-sdk'
import type { HostFunctions, UiFunctions } from '../shared/contract'

export default defineExtension({
  activate(context) {
    context.contributions.cardActions.register({
      id: 'open-settings',
      label: 'Settings',
      async run() {
        const webview = await kisaki.webviews.open({
          entry: 'main/index.html',
          title: 'Settings',
          surface: { kind: 'dialog', size: 'md' }
        })

        createWebviewRpc<UiFunctions, HostFunctions>(webview, {
          loadState: async () => ({
            enabled: (await context.storage.get<boolean>('enabled')) ?? true
          }),
          saveState: (state) => context.storage.set('enabled', state.enabled)
        })
      }
    })
  }
})
```

Inside the webview document:

```ts
import { createWebviewRpc, webview } from '@kisaki3/extension-sdk/webview'
import type { HostFunctions } from '../../shared/contract'

const host = createWebviewRpc<HostFunctions>(webview)
const state = await host.loadState()
```

## Boundary

The SDK does not assemble `ExtensionContext`, configure runtime bridges, or own
extension lifecycle cleanup. The shared extension host owns those runtime
responsibilities so extension code cannot forge another extension's identity.
Webview documents only ever talk to their own extension host code through the
message channel; host capabilities stay in the extension entry.
