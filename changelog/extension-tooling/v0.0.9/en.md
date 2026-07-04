# Kisaki Extension Tooling v0.0.9

## Breaking Changes

- Changed `createExtensionRegistryManifest` so it no longer writes a remote registry schema URL by default; callers must pass `$schema` when they want an editor hint

## Migration Notes

- Required existing registry repositories to update `registry/manifest.json` `$schema` to the local `@kisaki3/extension-registry` package schema and install the matching `@kisaki3/extension-registry` version

## Improvements

- Improved `kisx registry init` to generate a local registry schema reference relative to the manifest path by default
- Improved scaffolded workspaces to install `@kisaki3/extension-registry` and write a local package schema reference for registry manifests
- Improved extension and registry schema metadata so packaged schemas no longer declare remote canonical URLs
