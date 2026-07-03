# {{WORKSPACE_README_TITLE}}

{{WORKSPACE_README_DESCRIPTION}}

## Development

Install all extension dependencies from the repository root and run the project
checks:

```bash
pnpm install
pnpm run check
```

GitHub CI also typechecks workflow-owned scripts before running the project
checks.

The root workspace owns the shared `pnpm-lock.yaml`. Each extension remains an
independent project under `extensions/<extension-id>`.

## Extensions

<!-- extensions:start -->

<!-- extensions:end -->

## Add Extensions

Run the scaffold from the repository root. It generates the extension,
refreshes this list, installs the shared lockfile, and leaves the changes ready
for review:

```bash
pnpm create kisaki-extension add <extension-id>
```

## Publish

{{WORKSPACE_PUBLISH_SECTION}}
