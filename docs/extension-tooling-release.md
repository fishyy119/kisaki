# Extension Tooling Release

Kisaki extension tooling is released as one lockstep version. The desktop app keeps its own
independent version.

## Version Boundary

These packages always share the same version and are released together:

- `@kisaki3/extension-api`
- `@kisaki3/extension-registry`
- `@kisaki3/extension-sdk`
- `@kisaki3/extension-ui-vue`
- `@kisaki3/extension-cli`
- `create-kisaki-extension`

Do not create package-specific release targets for these packages. The reader-facing unit is the
extension tooling suite, not each package in isolation.

Every release assigns the new tooling version to all packages, builds every package, creates one
canonical set of tarballs, verifies the uploaded artifact checksums, runs `npm publish --dry-run`
inside the publish command, publishes the same tarballs with one derived npm dist-tag, and only then
creates the GitHub Release.

## Commands

```bash
pnpm version:extension-tooling 0.0.4
pnpm check:extension-tooling 0.0.4
pnpm build:extension-tooling
pnpm verify:extension-tooling
pnpm pack:extension-tooling --out-dir .tmp/release/extension-tooling/v0.0.4
pnpm publish:extension-tooling --dir .tmp/release/extension-tooling/v0.0.4 --provenance
```

`packages/extension-tooling-manifest.json` is the source of truth for package list, dependency
order, build groups, and required outputs. `tools/extension-tooling/` keeps command routing,
contract checks, build, packing, publish dry-run, and publishing in separate modules. The
side-effecting `publish:extension-tooling` command always runs `npm publish --dry-run` before
mutating npm.

The contract verifies:

- every tooling package has the same `package.json` version
- internal workspace dependencies use `workspace:*`
- `EXTENSION_API_VERSION` matches the tooling version
- scaffold packages receive tooling dependencies through `__TOOLING_VERSION__`
- extension scaffold manifests derive their `engines.kisaki` default from the current Extension API
  version

## Canonical Tarballs

`pnpm pack:extension-tooling` is the only step allowed to create release tarballs. After each
`pnpm pack`, the tooling rewrites the packed `package/package.json` and sorts dependency map keys
before checksums are generated. This prevents meaningless SHA changes from package manager key-order
differences, especially after `workspace:*` dependencies are rewritten to the release version.

The workflow uploads this canonical `.tgz` set as `release-extension-tooling-packages`. Every later
step downloads and verifies the same artifact with `SHA256SUMS`; retrying publish or GitHub Release
steps must never rebuild or repack the packages.

## Release Commit

```text
release(extension-tooling): v0.0.4
```

The GitHub workflow validates the committed version and changelogs, builds canonical artifacts,
publishes those artifacts through a command that first runs `npm publish --dry-run`, and creates one
Git tag:

```text
extension-tooling-v0.0.4
```

The npm dist-tag is derived from the SemVer version itself: plain versions, including `0.x`, publish
to `latest`; prereleases publish to `alpha`, `beta`, or `rc` when the prerelease identifier starts
with that stage. Other prerelease identifiers publish to `experimental`.

GitHub Release prerelease status follows the same SemVer prerelease rule as the desktop app. Only
stable desktop releases are marked as the repository's latest GitHub Release.

## Release Pipeline

An extension tooling release runs in this order:

1. A push to `main` whose first commit-message line is
   `release(extension-tooling): vX.Y.Z` selects the extension tooling target.
2. The target tag must be unused or already point at the same release commit; a conflicting tag
   stops the workflow before npm is touched.
3. The workflow requires non-empty `zh-Hans.md`, `en.md`, and `ja.md` changelogs under
   `changelog/extension-tooling/vX.Y.Z/`.
4. The committed package versions and `EXTENSION_API_VERSION` must equal `X.Y.Z`.
5. All tooling packages are built, their declared outputs are verified, and canonical tarballs are
   created once.
6. The build job uploads the canonical tarballs, `SHA256SUMS`, and `PACKAGES.md` as one release
   artifact.
7. The publish job downloads the original artifact, verifies `SHA256SUMS`, checks existing npm
   versions for matching SHA-512 integrity, runs `npm publish --dry-run` for every missing package
   version, then runs `npm publish --provenance`.
8. Already-published package versions are skipped only when npm reports the same SHA-512 integrity;
   a different integrity stops the release and requires a new tooling version.
9. After npm publishing succeeds, the workflow creates or reuses the Git tag and creates or updates
   the GitHub Release with the same artifacts.

The workflow serializes release runs on `main` and queues pending pushes instead of replacing them;
a later push cannot cancel an active or already queued release.

## npm Authentication

The publish dry-run uses `npm publish --dry-run` only. It does not mutate the registry and the
workflow does not call `npm stage publish` or `npm stage approve`.

`npm stage approve` is intentionally not part of this automated pipeline: npm requires maintainer
proof-of-presence and 2FA for staged package approval. For this repository, direct publish dry-run is
the validation surface because it matches the final publish command without creating staged package
state.

Publishing uses npm trusted publishing through GitHub Actions OIDC. Each package must trust
`.github/workflows/release.yml` and grant `npm publish`. The automated release workflow does not use
long-lived npm access tokens; temporary tokens are reserved for explicit manual recovery work.

Trusted publishing requires a current npm CLI and Node runtime. The release workflow pins npm to a
compatible version.

## Retry And Collision Rules

npm package versions are immutable. The release process is repeatable by reusing canonical artifacts,
not by rebuilding tarballs.

| State                                       | Result                                                               |
| ------------------------------------------- | -------------------------------------------------------------------- |
| Version is missing                          | Dry-run with `npm publish --dry-run`, then publish tarball.          |
| Version exists and SHA-512 matches artifact | Skip publish and continue GitHub Release steps.                      |
| Version exists but SHA-512 differs          | Stop; choose a new tooling version.                                  |
| Publish fails after some packages succeed   | Rerun; matching package versions are skipped and missing ones retry. |

## GitHub Release Retry Rules

The GitHub tag and Release are downstream of npm publish.

| GitHub state                             | Result                                                |
| ---------------------------------------- | ----------------------------------------------------- |
| Tag is missing                           | Create it at the release commit.                      |
| Tag already points at the release commit | Reuse it.                                             |
| Tag points at another commit             | Fail without moving the tag.                          |
| Release is missing                       | Create it from the validated changelog and artifacts. |
| Release already exists                   | Update its body and overwrite same-named assets.      |

If npm publish succeeds but Git tag or GitHub Release creation fails, rerun the same workflow. The
publish job verifies matching npm versions, skips already-published tarballs, and the Release job
reuses the original uploaded artifacts.

## Adding A Tooling Package

Before its first lockstep release:

1. Add it to `packages/extension-tooling-manifest.json` in dependency-safe publish order.
2. Add its internal workspace dependencies, build group, and required output paths.
3. Give it the current development version and include any scaffold version-token contracts.
4. Confirm `npm publish --dry-run` passes for the new package.
5. Configure `.github/workflows/release.yml` as the package trusted publisher with permission for
   `npm publish`.
6. Run build, output verification, and pack locally.
7. Bump every tooling package and `EXTENSION_API_VERSION` to the next suite version.

All GitHub Actions used by CI and release workflows are pinned to immutable commit SHAs. Dependabot
checks those pins weekly and proposes reviewed updates.
