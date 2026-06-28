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

An optional `kisx.config.ts` exports `{ host?, ui? }` Vite user configs for the
Node host and webview build targets. Each target config is merged over the kisx
defaults. For example, the `ui` config can add `@vitejs/plugin-vue` and
`@tailwindcss/vite`. `README.md` and the manifest icon are copied into package
output when present.

## Commands

```bash
kisx validate
kisx build
kisx --project extensions/example.extension build
kisx build --watch
kisx pack
kisx key generate --out .keys/author.ed25519.json
kisx registry init
kisx registry add-release artifacts/example-0.0.1.kisx \
  --manifest registry/manifest.json \
  --url https://example.com/extensions/example-0.0.1.kisx
kisx registry yank example.extension@0.0.1 --manifest registry/manifest.json --reason "Broken package"
kisx registry unyank example.extension@0.0.1 --manifest registry/manifest.json
kisx registry validate registry/manifest.json
kisx dev
```

- `kisx validate` checks the manifest, required project files, and
  `engines.kisaki` Extension API compatibility range.
- `--project <dir>` is a global option shared by every project-bound command.
- `kisx build` validates, builds the host entry and webview documents with
  Vite, and verifies the built entry.
- `kisx build --watch` keeps `dist/` up to date for direct development loading.
- `kisx pack` writes a `.kisx` archive and prints size plus sha256.
- `kisx key generate` creates an Ed25519 author signing key.
- `kisx registry init|validate|add-release|yank|unyank|digest|sign` manages
  static registry manifests and release artifacts.
- `kisx dev` watch-builds the extension, launches Kisaki with development
  extensions passed through `KISAKI_DEV_EXTENSIONS`, and serves webview sources
  from an OS-assigned loopback Vite server. Kisaki proxies those assets through
  its fixed extension UI protocol, so development and packaged webviews share
  one renderer security boundary while UI HMR remains available. Host changes
  stay pending until the developer uses Reload Process in Kisaki.

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
The host bundle includes `@kisaki3/extension-sdk` and
`@kisaki3/extension-api`; extension projects keep both packages in
`devDependencies`. Only genuine external runtime dependencies are copied into
the `.kisx` package.

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

For local testing only, registry commands that read artifact URLs accept
`--allow-insecure-local-urls` for `file:` and localhost artifact URLs.
Use `registry yank <extension-id>@<version>` to withdraw a broken release while
preserving registry history; `registry unyank` restores it.

## Command Architecture

The CLI has three explicit layers:

- `src/cli/commands/` contains only Commander declarations and argument-to-input
  adaptation. It has one file per top-level command.
- `src/cli/actions/` contains CLI workflows, lifecycle handling, and terminal
  reporting. Action files never import Commander.
- `src/build/`, `src/packaging/`, `src/project/`, and `src/registry/` own reusable
  capabilities and business rules. They never import the CLI layer.

`src/cli/program.ts` only configures the root program and composes command
factories. Dependencies point in one direction: commands to actions to domain.
