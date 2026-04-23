# `@kisaki/extension-sdk`

Authoring SDK for Kisaki extensions.

Public entry points:

- `defineExtension(...)`
- `kisaki`
- all public contract types re-exported from `@kisaki/extension-api`

## Architecture

`kisaki` is a thin view over the host-provided `KisakiApi`.
Capability access stays direct and lazy: each property getter reads from the configured runtime bridge when the extension actually uses it.

The runtime bridge store lives in the SDK internals and is configured only by the shared extension host.
The SDK does not assemble `ExtensionContext`, register contributions, or own lifecycle helpers like disposable stores; those runtime responsibilities stay entirely in the host.
The SDK does not add a second abstraction layer for capabilities like `network` or `notify`; those are exposed directly from the runtime bridge.

Host-runtime bootstrap is intentionally not a public package entry point. The host owns bridge
configuration and extension context creation so extension code cannot forge another extension's
identity or bypass runtime lifecycle cleanup.
