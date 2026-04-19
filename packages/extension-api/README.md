# `@kisaki/extension-api`

Public contracts for the Kisaki extension system.

This package defines the stable surface shared by:

- the Kisaki desktop host
- the extension host runtime
- `@kisaki/extension-sdk`
- extension projects

It contains:

- `ExtensionManifest` and the official manifest JSON Schema
- `ExtensionContext` and `KisakiApi` contracts
- capability contracts for host APIs such as library, network, notify, events, and runtime
- library DTOs and relation command/query contracts
- controlled contribution models for menus, settings panels, scrapers, deeplinks, and themes
- `rpc.ts` with transport envelopes, handshake types, structured-clone-safe values, and direction-aware bridge request/event maps shared by main and the extension host

Package boundary:

- `@kisaki/extension-api` defines the stable contracts for both capabilities and contributions.
- `@kisaki/extension-sdk` keeps capability access lightweight and direct.
- The SDK/runtime-specific complexity is reserved for extension-point registration and `ExtensionContext` composition.

Manifest schema path:

```json
"$schema": "./node_modules/@kisaki/extension-api/schemas/extension-manifest.schema.json"
```
