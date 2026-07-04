# @kisaki3/extension-registry

Distributed registry contracts and validation helpers for Kisaki extension
repositories.

Use the package root for browser-safe registry types and helpers. Use
`@kisaki3/extension-registry/node` for helpers that require Node built-ins.

## Root Export

- Registry manifest, package, release, artifact, signing key, and schema constants.
- `parseExtensionRegistryManifest(...)` and validation helpers.
- Artifact target helpers such as `selectExtensionRegistryArtifact(...)` and
  `isExtensionRegistryArtifactTargetCompatible(...)`.
- Release helpers such as `getExtensionRegistryReleaseKind(...)` and preview
  prerelease prefix checks.
- Artifact signature payload helpers.

Release `engines.kisakiExtensionApi` values are Kisaki Extension API version ranges. Registry
catalog compatibility must compare the current `@kisaki3/extension-api` version
against that range, not the desktop application product version.

The registry schema is exported at:

```json
"./schemas/extension-registry.schema.json"
```

## Node Export

`@kisaki3/extension-registry/node` exports sha256 release digest helpers, canonical
JSON stringification, and signer fingerprint helpers used by the CLI and desktop
installer.
