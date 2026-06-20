# Extension Tooling Release

Kisaki extension tooling is released as one lockstep version. The desktop app keeps its
own independent version.

## Version Boundary

These packages always share the same version and are published together:

- `@kisaki3/extension-api`
- `@kisaki3/extension-registry`
- `@kisaki3/extension-sdk`
- `@kisaki3/extension-ui-vue`
- `@kisaki3/extension-cli`
- `create-kisaki-extension`

Do not create package-specific release targets for these packages. The user-facing unit is
the extension tooling suite, not each package in isolation.

Every release assigns the new tooling version to all packages and publishes every package
whose exact tarball is not already present on npm. A change that primarily affects one package,
including adding a new package, does not create a package-specific release.

## Commands

```bash
pnpm version:extension-tooling 0.0.2
pnpm check:extension-tooling 0.0.2
pnpm build:extension-tooling
pnpm publish:extension-tooling --dry-run
```

`scripts/extension-tooling.ts` owns the package list, version checks, version bumping, and
npm publish order. It verifies:

- every tooling package has the same `package.json` version
- internal workspace dependencies use `workspace:*`
- `EXTENSION_API_VERSION` matches the tooling version
- extension scaffold dependencies are injected with `__TOOLING_VERSION__`
- the Vue UI kit scaffold dependency is injected with `__TOOLING_VERSION__`
- extension scaffold manifests derive their `engines.kisaki` default from the
  current Extension API version

`publish:extension-tooling --dry-run` runs npm's package-content checks for every tarball without
changing the registry. It forces past existing-version protection only inside npm's dry-run mode so
all lockstep packages are checked. A real publish performs registry preflight and verification as
described below.

## Release Commit

```text
release(extension-tooling): v0.0.2
```

The GitHub workflow validates the committed version, builds all tooling packages, publishes
them in dependency order, and creates one tag:

```text
extension-tooling-v0.0.2
```

The publish script derives the npm dist-tag from the Extension API version stage:
`0.y.z` uses `experimental`, prereleases use `alpha`, `beta`, or `rc`, and stable
versions use `latest`.

## Release Pipeline

An extension tooling release runs in this order:

1. A push to `main` whose first commit-message line is
   `release(extension-tooling): vX.Y.Z` selects the extension tooling target.
2. The target tag must be unused or already point at the same release commit; a conflicting tag
   stops the workflow before npm can be changed.
3. The workflow requires non-empty `zh-Hans.md`, `en.md`, and `ja.md` changelogs under
   `changelog/extension-tooling/vX.Y.Z/`.
4. The manifest must define each package exactly once, keep dependency-safe publish/build order,
   cover every package with a build group and output path, and match workspace dependencies.
5. The committed package versions and `EXTENSION_API_VERSION` must equal `X.Y.Z`.
6. All tooling packages are built, their declared outputs are verified, and all tarballs are
   created before npm is mutated.
7. Every tarball passes an npm publish dry-run before the tarballs, `SHA256SUMS`, and `PACKAGES.md`
   are saved as an overwrite-safe GitHub Actions artifact.
8. npm preflight checks every `package@version` before the first missing package is published.
9. Missing packages are published in manifest dependency order and read back from npm to verify
   their SHA-512 integrity.
10. Only after npm publishing succeeds does the workflow download the release artifacts, verify
    `SHA256SUMS`, create or reuse the Git tag, and create or update the GitHub Release.

The workflow serializes release runs on `main` and queues pending pushes instead of replacing them;
a later push cannot cancel an active or already queued release.

## npm Authentication

The release job always enables both authentication paths:

- Trusted Publishing through GitHub Actions OIDC is the normal path for packages that already
  trust `.github/workflows/release.yml`.
- The `NPM_TOKEN` repository secret is a permanent fallback. It must be a granular token with
  publish access to the `@kisaki3` scope and bypass-2FA permission appropriate for CI.

The pinned npm CLI tries OIDC first and can fall back to `NPM_TOKEN`. When a new tooling package is
added, update or replace `NPM_TOKEN` so it can create that package. After its first publication,
configure the same GitHub workflow as the package's Trusted Publisher. The token fallback remains
configured for future packages.

The npm CLI is pinned in the release workflow because Trusted Publishing requires npm 11.5.1 or
newer. Scoped packages are always published with `--access public`, and CI requests npm provenance
attestations for the GitHub-built artifacts.

## npm Retry And Collision Rules

npm does not provide an atomic transaction spanning several packages. The publish script makes the
multi-package operation safely repeatable:

| Registry state for `package@version`                                    | Result                                                            |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Version is missing                                                      | Publish it, then verify its registry integrity.                   |
| Version exists and SHA-512 matches the local tarball                    | Skip it as an already completed step.                             |
| Version exists but SHA-512 differs                                      | Stop before publishing any missing package; choose a new version. |
| Publish command fails but the matching tarball reached npm              | Treat the package as published and continue.                      |
| Publish or registry verification fails and the version is still missing | Fail the job; fix the cause and rerun the same workflow.          |

This means an expired or under-scoped token can fail when the first new package is reached without
making the release unrecoverable. Packages published earlier in the run remain immutable; after the
token is updated, rerunning the failed workflow skips their identical versions and resumes with the
missing packages.

## GitHub Release Retry Rules

The GitHub tag and Release are downstream of a successful target build. For extension tooling, npm
must be complete before either is created.

| GitHub state                             | Result                                                |
| ---------------------------------------- | ----------------------------------------------------- |
| Tag is missing                           | Create it at the release commit.                      |
| Tag already points at the release commit | Reuse it.                                             |
| Tag points at another commit             | Fail without moving the tag.                          |
| Release is missing                       | Create it from the validated changelog and artifacts. |
| Release already exists                   | Update its body and overwrite same-named assets.      |

If npm succeeds but Git tag or GitHub Release creation fails, rerun the same workflow. npm preflight
skips the matching packages, the tag step safely creates or reuses the tag, and the Release action
replaces incomplete assets.

## Common Cases

| Case                                    | npm result                                                              | GitHub result                                                         |
| --------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Ordinary non-release push               | No npm work.                                                            | No tag or Release.                                                    |
| Normal tooling release                  | Publish every tooling package at the new version in dependency order.   | Create one `extension-tooling-vX.Y.Z` tag and Release.                |
| First release containing a new package  | Existing packages use OIDC; the new package can use `NPM_TOKEN`.        | Same single tooling tag and Release after every package succeeds.     |
| Retry after partial npm publication     | Verify and skip identical versions, then publish the missing remainder. | Created only after npm becomes complete.                              |
| Existing version has different contents | Abort preflight; npm versions are immutable.                            | No tag or Release.                                                    |
| Retry after GitHub Release failure      | Skip all matching npm versions.                                         | Reuse the tag and update the Release/assets.                          |
| Prerelease version                      | Publish using the derived prerelease/experimental npm dist-tag.         | Mark the GitHub Release as a prerelease.                              |
| Desktop release commit                  | No extension tooling npm work.                                          | Build desktop artifacts and use the independent `desktop-vX.Y.Z` tag. |

## Adding A Tooling Package

Before its first lockstep release:

1. Add it to `packages/extension-tooling-manifest.json` in dependency-safe publish order.
2. Add its internal workspace dependencies, build group, and required output paths.
3. Give it the current development version and include any scaffold version-token contracts.
4. Ensure the `NPM_TOKEN` secret can create and publish the new scoped package.
5. Run build, output verification, pack, and publish dry-run locally.
6. Bump every tooling package and `EXTENSION_API_VERSION` to the next new suite version; adding a
   package never backfills or mutates the previous GitHub Release.
7. After the first npm publication, configure `release.yml` as the new package's Trusted Publisher.

All GitHub Actions used by CI and release workflows are pinned to immutable commit SHAs.
Dependabot checks those pins weekly and proposes reviewed updates.
