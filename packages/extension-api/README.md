# @kisaki3/extension-api

Public contracts for the Kisaki extension system.

This package is shared by the desktop host, extension host, SDK, CLI tooling, and
extension projects. It owns stable runtime types and validation helpers; distributed
registry metadata lives in `@kisaki3/extension-registry`.

## Contents

- Extension manifests, parser helpers, and the manifest JSON Schema.
- `ExtensionContext`, `KisakiApi`, runtime metadata, logger, storage, secrets, and
  disposables.
- Host capabilities: library, network, notify, events, runtime, scrapers, ingest,
  commands, and background tasks.
- Contributions: entity menus, settings panels, scraper providers, deeplink routes,
  themes, and commands.
- RPC contracts for lifecycle, runtime context services, host capabilities, and
  contribution callbacks.
- Shared DTOs, value objects, serialization helpers, and validation issues.

## Manifest Schema

```json
"$schema": "./node_modules/@kisaki3/extension-api/schemas/extension-manifest.schema.json"
```

A minimal runtime manifest:

```json
{
  "$schema": "./node_modules/@kisaki3/extension-api/schemas/extension-manifest.schema.json",
  "id": "example-extension",
  "name": "Example Extension",
  "version": "0.0.1",
  "categories": ["tool"],
  "entry": "./dist/index.mjs",
  "description": "Adds an example command.",
  "engines": {
    "kisaki": "=0.0.1"
  }
}
```

Manifest rules:

- `id` must be a valid Kisaki extension identifier.
- `version` must be semver.
- `categories` must use `scraper`, `tool`, `theme`, or `integration`.
- `entry` and optional `icon` are package-relative paths inside the package root.
- `engines.kisaki` is the Kisaki Extension API version range required by the
  extension. Registry publishing requires it.
- Unknown manifest fields are rejected.

For API `0.y.z`, alpha, and beta versions, the recommended range is an exact
match such as `=0.0.1`. Stable API versions use caret ranges such as `^2.0.0`.

Recommended `engines.kisaki` ranges:

| Extension API version | Recommended range     |
| --------------------- | --------------------- |
| `0.y.z`               | `=0.y.z`              |
| `N.M.P-alpha.n`       | `=N.M.P-alpha.n`      |
| `N.M.P-beta.n`        | `=N.M.P-beta.n`       |
| `N.M.P-rc.n`          | `>=N.M.P-rc.1 <N.M.P` |
| `N.M.P`               | `^N.M.P`              |

## Boundary

`.kisx` packages use this package for the runtime manifest and extension code
contracts. Static extension repositories use `@kisaki3/extension-registry` for
installable releases, artifact URLs, sha256 digests, platform targets, changelogs,
and optional Ed25519 signatures.
