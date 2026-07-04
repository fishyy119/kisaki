# Kisaki Extension Tooling v0.0.8

## Highlights

- Changed extension compatibility declarations from `engines.kisaki` to `engines.kisakiExtensionApi`
- Required extension authors to update manifests, rebuild packages, resign artifacts, and republish registry releases
- Improved extension compatibility documentation and scaffold templates to clarify that compatibility is based on the Extension API version, not the desktop app version

## Breaking Changes

- Changed extension manifest and registry release compatibility fields so the old `engines.kisaki` field is no longer accepted by schemas, CLI validation, host install checks, or catalog compatibility checks
- Changed package signature payloads and release digests so `engines.kisakiExtensionApi` now participates in signature verification and release digest calculation

## Migration Notes

- Required extension authors to rename `engines.kisaki` to `engines.kisakiExtensionApi` in `manifest.json`
- Required published extensions to rerun `kisx pack`, resign artifacts, and update discovery catalogs with new registry releases
- Required maintainers of hand-written registry manifests to rename release `engines.kisaki` fields to `engines.kisakiExtensionApi`

## Improvements

- Improved `kisx validate`, packaging, signing, publishing, and host install validation messages to use the Extension API compatibility field consistently
- Improved generated manifest templates so new extensions use `engines.kisakiExtensionApi` by default
- Improved discovery catalog and installed extension details to show extension API ranges from the new registry release field

## Documentation

- Changed extension API versioning, distributed registry design, and tooling release documentation to describe `engines.kisakiExtensionApi` as the Extension API compatibility range
