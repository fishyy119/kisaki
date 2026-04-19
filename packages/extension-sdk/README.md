# `@kisaki/extension-sdk`

Authoring SDK for Kisaki extensions.

Public entry points:

- `defineExtension(...)`
- `kisaki`
- all public contract types re-exported from `@kisaki/extension-api`
- `createDisposableStore()` for author-side lifecycle grouping

## Architecture

`kisaki` is a thin view over the host-provided `KisakiApi`.
Capability access stays direct and lazy: each property getter reads from the configured runtime bridge when the extension actually uses it.

The SDK's non-trivial authoring/runtime helpers are intentionally concentrated around extension points, because those flows need extra coordination for:

- registration and unregistration
- lifecycle disposal
- extension-aware path resolution
- composition of the `ExtensionContext`

That logic lives in `bridge.ts` and `src/contributions/*`.
The SDK does not add a second abstraction layer for capabilities like `network` or `notify`; those are exposed directly from the runtime bridge.

Host-runtime bootstrap helpers are intentionally separated behind explicit subpaths:

```ts
import { configureExtensionSdkBridge, createExtensionContext } from '@kisaki/extension-sdk/bridge'
```
