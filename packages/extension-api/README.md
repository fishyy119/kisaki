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
- generic protocol message envelopes and serializable transport primitives

Manifest schema path:

```json
"$schema": "./node_modules/@kisaki/extension-api/schemas/extension-manifest.schema.json"
```
