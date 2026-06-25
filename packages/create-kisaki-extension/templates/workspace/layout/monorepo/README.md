# **REGISTRY_NAME**

Kisaki extension registry repository.

## Development

Install all extension dependencies from the repository root and run the same
checks as CI:

```bash
pnpm install
pnpm run check
```

The root workspace owns the shared `pnpm-lock.yaml`. Each extension remains an
independent project under `extensions/<extension-id>`.

## Extensions

<!-- extensions:start -->

- `__EXTENSION_ID__` — **EXTENSION_NAME** (`extensions/__EXTENSION_ID__`)
<!-- extensions:end -->

## Add Extensions

Run the scaffold from the repository root. It generates the extension,
refreshes this list, installs the shared lockfile, and leaves the changes ready
for review:

```bash
pnpm create kisaki-extension add
```

## Publish

**WORKSPACE_PUBLISH_SECTION**
