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
- library DTOs and relation command/query contracts
- controlled contribution models for menus, settings panels, scrapers, deeplinks, and themes
- `rpc.ts` with transport envelopes, handshake types, structured-clone-safe values, and direction-aware bridge request/event maps shared by main and the extension host

Manifest schema path:

```json
"$schema": "./node_modules/@kisaki/extension-api/schemas/extension-manifest.schema.json"
```
