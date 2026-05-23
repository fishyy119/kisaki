# Extension Tooling Release

Kisaki extension tooling is released as one lockstep version. The desktop app keeps its
own independent version.

## Version Boundary

These packages always share the same version and are published together:

- `@kisaki/extension-api`
- `@kisaki/extension-registry`
- `@kisaki/extension-sdk`
- `@kisaki/extension-cli`
- `create-kisaki-extension`

Do not create package-specific release targets for these packages. The user-facing unit is
the extension tooling suite, not each package in isolation.

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

## Release Commit

```text
release(extension-tooling): v0.0.2
```

The GitHub workflow validates the committed version, builds all tooling packages, publishes
them in dependency order, and creates one tag:

```text
extension-tooling-v0.0.2
```

For prerelease versions, the publish script uses the `next` npm dist-tag by default.
Stable versions use `latest`.
