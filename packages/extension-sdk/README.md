# `@kisaki/extension-sdk`

Authoring SDK for Kisaki extensions.

Public entry points:

- `defineExtension(...)`
- `kisaki`
- all public contract types re-exported from `@kisaki/extension-api`
- `createDisposableStore()` for author-side lifecycle grouping

Host-runtime bootstrap helpers are intentionally separated behind explicit subpaths:

```ts
import { configureExtensionSdkBridge, createExtensionContext } from '@kisaki/extension-sdk/bridge'
```
