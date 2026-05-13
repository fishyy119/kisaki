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
- `@kisaki/extension-registry` owns distributed registry manifests, release artifacts, repository validation, and signing/digest helpers. Registry protocol types are intentionally not exported from this package.
- Runtime context services such as logger, storage, and secrets are separate from both capabilities and contributions.

Manifest schema path:

```json
"$schema": "./node_modules/@kisaki/extension-api/schemas/extension-manifest.schema.json"
```

## Extension Manifest

Every extension package contains one `manifest.json` at the package root. The manifest
describes the runtime extension itself; repository release metadata lives in
`@kisaki/extension-registry` manifests instead.

```json
{
  "$schema": "./node_modules/@kisaki/extension-api/schemas/extension-manifest.schema.json",
  "id": "example-extension",
  "name": "Example Extension",
  "version": "0.0.1",
  "categories": ["tool"],
  "entry": "dist/index.js",
  "description": "Adds an example command.",
  "author": "Example Author",
  "homepage": "https://example.com",
  "icon": "icon.png",
  "keywords": ["example"],
  "engines": {
    "kisaki": ">=0.0.3 <0.1.0"
  }
}
```

Rules enforced by the parser and schema:

- `id` must be a valid Kisaki extension identifier.
- `version` must be semver.
- `categories` must use the official extension categories: `scraper`, `tool`, `theme`, or `integration`.
- `entry` and optional `icon` are package-relative paths and must stay inside the package root.
- `engines.kisaki`, when provided, must be a semver range. Registry publishing requires it.
- Unknown manifest fields are rejected.

## Runtime Surface

Extensions activate through `activate(context)` and use the contracts exported by this
package through `@kisaki/extension-sdk`.

Capabilities are host-owned services exposed through `kisaki.*`, such as library access,
network requests, notifications, app events, commands, runtime information, and background
tasks.

Contributions are extension-owned registrations that the host and renderer consume as
structured data: entity menus, settings panels, scraper providers, deeplink routes,
commands, and themes. UI contributions must remain serializable; callback execution is
routed through typed RPC.

## Distribution Boundary

The `.kisx` package uses `@kisaki/extension-api` for its internal runtime manifest and
extension code contracts. A distributed repository uses `@kisaki/extension-registry` to
describe installable releases, artifact URLs, sha256 digests, artifact targets, channels,
changelogs, and optional Ed25519 signatures.

Kisaki verifies a downloaded `.kisx` by comparing the registry release to the package
manifest: extension id, version, categories, `engines.kisaki`, entry file, and optional
icon must match the package contents.
