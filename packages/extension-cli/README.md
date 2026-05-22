# @kisaki/extension-cli

Command line tools for building, validating, packaging, signing, and publishing Kisaki
extensions.

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

## Core Commands

- `kisx validate` checks the extension manifest and project files.
- `kisx build` builds the extension with tsdown.
- `kisx output` writes an unpacked package directory for desktop dev/build flows.
- `kisx pack` builds and writes a `.kisx` archive.
- `kisx key generate` creates an Ed25519 author signing key.
- `kisx registry *` creates and maintains static distributed registry manifests.
- `kisx dev` watch-builds the extension and launches Kisaki with `--dev-extension`.

## Packaging

`kisx pack` builds the extension, writes a `.kisx` archive, and prints its size and sha256 digest.

```bash
kisx pack
kisx pack --out-dir artifacts --no-build
```

To create an author signature for a registry release, pass the artifact target that should
be covered by the signature payload:

```bash
kisx key generate --out .keys/author.ed25519.json
kisx pack --out-dir artifacts --sign --key .keys/author.ed25519.json --target any
```

`kisx pack --sign` writes a `.sig` JSON file beside the package unless
`--signature-out <sig-file>` is supplied. The signature file signs the artifact identity
envelope: extension id, version, `engines.kisaki`, artifact target, size, and sha256
digest. The artifact URL is intentionally not signed so mirrors can change without
changing author identity.

Use semver prerelease versions for non-stable releases, such as `1.2.0-beta.1`. The
registry derives the release kind from the version itself; stable versions have no
prerelease suffix, and preview versions use `alpha`, `beta`, `rc`, or `nightly`.
Platform builds are added as artifact targets under the same release version.

## Registry Manifests

Kisaki extension discovery is based on user-configured repository manifest URLs. A
registry manifest is a static JSON document that lists packages, releases, artifacts,
sha256 digests, and optional author signatures.

Create and validate a manifest:

```bash
kisx registry init --out registry/manifest.json --id example.extensions --name "Example Extensions"
kisx registry validate registry/manifest.json
```

Append a packaged release:

```bash
kisx registry add-release artifacts/example-0.0.1.kisx --manifest registry/manifest.json --url https://example.com/extensions/example-0.0.1.kisx
```

This command reads `manifest.json` from the `.kisx`, copies package metadata into the
registry package, calculates artifact size and sha256, creates or updates the release,
and prints the release digest.

Append a signed release:

```bash
kisx registry add-release artifacts/example-0.0.1.kisx --manifest registry/manifest.json --url https://example.com/extensions/example-0.0.1.kisx --signature artifacts/example-0.0.1.sig
```

When `--signature` is supplied, the CLI verifies the `.sig` envelope against the package
metadata, artifact size, sha256, and target. The public key is added to `signingKeys`,
and the artifact signature is written into the release.

Useful release options:

```bash
kisx registry add-release artifacts/example-0.0.1.kisx \
  --manifest registry/manifest.json \
  --url https://example.com/extensions/example-0.0.1.kisx \
  --target win32-x64 \
  --changelog "Improve matching." \
  --changelog-url https://example.com/releases/example-0.0.1
```

If the same package version already exists, the CLI requires the same `engines.kisaki`
range. A second artifact target can be added to that release. Replacing an existing
target requires `--replace`.

Useful helpers:

```bash
kisx registry digest artifacts/example-0.0.1.kisx
kisx registry sign artifacts/example-0.0.1.kisx --key .keys/author.ed25519.json
```

For local testing only, `kisx registry validate` and `kisx registry add-release` accept
`--allow-insecure-local-urls` to allow `file:` and localhost URLs.

## Publishing Flow

Unsigned static repository:

```bash
kisx build
kisx pack --out-dir artifacts
kisx registry init --out registry/manifest.json --id example.extensions --name "Example Extensions"
kisx registry add-release artifacts/example-0.0.1.kisx --manifest registry/manifest.json --url https://example.com/extensions/example-0.0.1.kisx
kisx registry validate registry/manifest.json
```

Signed static repository:

```bash
kisx key generate --out .keys/author.ed25519.json
kisx pack --out-dir artifacts --sign --key .keys/author.ed25519.json
kisx registry add-release artifacts/example-0.0.1.kisx --manifest registry/manifest.json --url https://example.com/extensions/example-0.0.1.kisx --signature artifacts/example-0.0.1.sig
kisx registry validate registry/manifest.json
```

Publish `registry/manifest.json`, `artifacts/*.kisx`, and any referenced icon files to
static hosting. Users add the manifest URL in Kisaki's extension repository page.
