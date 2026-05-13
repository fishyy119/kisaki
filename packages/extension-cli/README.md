# @kisaki/extension-cli

Command line tools for Kisaki extensions.

```bash
kisx validate
kisx build
kisx pack
kisx key generate --out .keys/author.ed25519.json
kisx registry init
kisx registry add-release artifacts/example-0.0.1.kisx --manifest registry/manifest.json --url https://example.com/extensions/example-0.0.1.kisx
kisx registry validate registry/manifest.json
kisx dev
```

The CLI expects a project root with `manifest.json`, `src/index.ts`, and `tsdown.config.ts`.

## Packaging

`kisx pack` builds the extension, writes a `.kisx` archive, and prints its size and sha256 digest.

```bash
kisx pack
```

To create an author signature for a registry release:

```bash
kisx key generate --out .keys/author.ed25519.json
kisx pack --sign --key .keys/author.ed25519.json
```

The signature file signs the artifact identity envelope: extension id, version, channel,
`engines.kisaki`, artifact target, size, and sha256 digest.

Use semver prerelease versions for non-stable releases, such as `1.2.0-beta.1`.
The registry keeps one release per package version; `channel` is an update track label, and
platform builds are added as artifact targets under that release.

## Registry Manifests

Create and validate a static distributed registry manifest:

```bash
kisx registry init --out registry/manifest.json --id example.extensions --name "Example Extensions"
kisx registry validate registry/manifest.json
```

Append a packaged release:

```bash
kisx registry add-release artifacts/example-0.0.1.kisx --manifest registry/manifest.json --url https://example.com/extensions/example-0.0.1.kisx
```

Append a signed release:

```bash
kisx registry add-release artifacts/example-0.0.1.kisx --manifest registry/manifest.json --url https://example.com/extensions/example-0.0.1.kisx --signature artifacts/example-0.0.1.sig
```

Useful helpers:

```bash
kisx registry digest artifacts/example-0.0.1.kisx
kisx registry sign artifacts/example-0.0.1.kisx --key .keys/author.ed25519.json
```
