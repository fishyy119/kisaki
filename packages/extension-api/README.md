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
- capability contracts for host APIs such as library, network, notify, events, commands, and runtime
- library DTOs and relation command/query contracts
- controlled contribution models for entity menus, settings panels, scraper providers, deeplink routes, commands, and themes
- RPC contracts split by runtime context services, host capabilities, extension contributions, and lifecycle transport

Package boundary:

- `@kisaki/extension-api` defines the stable contracts for both capabilities and contributions.
- `@kisaki/extension-sdk` keeps capability access lightweight and direct.
- Runtime context services such as logger, storage, and secrets are separate from both capabilities and contributions.

Manifest schema path:

```json
"$schema": "./node_modules/@kisaki/extension-api/schemas/extension-manifest.schema.json"
```
