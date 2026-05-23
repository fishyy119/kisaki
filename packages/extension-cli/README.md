# @kisaki/extension-cli

`kisx` command line tools for Kisaki extension development.

The CLI expects an extension project with `manifest.json`, `src/index.ts`, and
`tsdown.config.ts`. `README.md` and the manifest icon are copied into package output
when present.

## Commands

```bash
kisx validate
kisx build
kisx output
kisx pack
kisx key generate --out .keys/author.ed25519.json
kisx registry init
kisx registry add-release artifacts/example-0.0.1.kisx \
  --manifest registry/manifest.json \
  --url https://example.com/extensions/example-0.0.1.kisx
kisx registry validate registry/manifest.json
kisx dev
```

- `kisx validate` checks the manifest and required project files.
- `kisx build` validates, runs tsdown, and verifies the built entry.
- `kisx output` writes an unpacked package to `out/extensions/<extension-id>`.
  Use `--watch` for synchronized output; `dev-output` is an alias.
- `kisx pack` writes a `.kisx` archive and prints size plus sha256.
- `kisx key generate` creates an Ed25519 author signing key.
- `kisx registry init|validate|add-release|digest|sign` manages static registry
  manifests and release artifacts.
- `kisx dev` watch-builds package output and launches Kisaki with
  `--dev-extension`.

## Packaging

```bash
kisx pack --out-dir artifacts
kisx pack --out-dir artifacts --no-build
```

To create an author signature beside the package:

```bash
kisx key generate --out .keys/author.ed25519.json
kisx pack --out-dir artifacts --sign --key .keys/author.ed25519.json --target any
```

The signature covers extension id, version, `engines.kisaki`, artifact target,
size, and sha256. Artifact URLs are not signed so mirrors can change.

## Registry Flow

```bash
kisx registry init --out registry/manifest.json --id example.extensions --name "Example Extensions"
kisx registry add-release artifacts/example-0.0.1.kisx \
  --manifest registry/manifest.json \
  --url https://example.com/extensions/example-0.0.1.kisx
kisx registry validate registry/manifest.json
```

`add-release` reads the `.kisx` manifest, copies package metadata, records artifact
size and sha256, creates or updates the release, and prints the release digest.
Use `--signature <sig-file>` to attach a signature created by `kisx pack --sign` or
`kisx registry sign`.

Stable releases use plain semver versions. Preview releases use semver prerelease
prefixes such as `alpha`, `beta`, `rc`, or `nightly`. Platform builds are separate
artifact targets under the same release version.

For local testing only, `registry validate` and `registry add-release` accept
`--allow-insecure-local-urls` for `file:` and localhost artifact URLs.
