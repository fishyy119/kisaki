# @kisaki3/extension-cli

`kisx` command line tools for Kisaki extension development, built on an
embedded Vite orchestrator.

The CLI expects an extension project with three source sides mirroring the
runtime topology:

- `src/host/index.ts` — the Node host entry, bundled to `manifest.entry`
- `src/ui/<view>/index.html` — webview documents, bundled to `dist/ui` and
  declared as `"ui": "./dist/ui"` in the manifest
- `src/shared/` — RPC contracts and DTOs imported by both sides (never imports
  from `host` or `ui`)

An optional `kisx.config.ts` exports `{ entry?, ui? }` Vite user configs merged
over the kisx defaults (for example to add `@vitejs/plugin-vue` and
`@tailwindcss/vite` for the `ui` build). `README.md` and the manifest icon are
copied into package output when present.

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

- `kisx validate` checks the manifest, required project files, and
  `engines.kisaki` Extension API compatibility range.
- `kisx build` validates, builds the host entry and webview documents with
  Vite, and verifies the built entry.
- `kisx output` publishes immutable unpacked package versions under
  `out/extensions/<extension-id>/versions/<build-id>` and atomically updates
  `out/extensions/<extension-id>/current.json`. Use `--watch` for synchronized
  output driven by Vite watch builds; `dev-output` is an alias.
- `kisx pack` writes a `.kisx` archive and prints size plus sha256.
- `kisx key generate` creates an Ed25519 author signing key.
- `kisx registry init|validate|add-release|digest|sign` manages static registry
  manifests and release artifacts.
- `kisx dev` runs the two-track development loop and launches Kisaki with
  `--dev-extension`: webview documents serve from a Vite dev server with full
  HMR (published as `ui.mode = "dev-server"` in `current.json`), while host
  entry changes republish the package and recycle the extension host.

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
`engines.kisaki` is an Extension API version range, not a desktop app version.

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
The registry release `engines.kisaki` range is copied from the packaged
manifest and must match it exactly.

For local testing only, `registry validate` and `registry add-release` accept
`--allow-insecure-local-urls` for `file:` and localhost artifact URLs.
