# {{REGISTRY_NAME}}

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

- `{{EXTENSION_ID}}` — {{EXTENSION_NAME}} (`extensions/{{EXTENSION_ID}}`)
<!-- extensions:end -->

## Add Extensions

Run the scaffold from the repository root. It generates the extension,
refreshes this list, installs the shared lockfile, and leaves the changes ready
for review:

```bash
pnpm create kisaki-extension add
```

## Publish

Publish an extension by updating its `manifest.json` and pushing a scoped
release commit from the repository root:

```bash
git commit -m "release({{EXTENSION_ID}}): v0.0.1"
git push origin main
```

The workflow validates the commit scope and manifest version, creates tag
`{{EXTENSION_ID}}-v0.0.1`, packages only the scoped extension, uploads the
signed `.kisx` package, and updates `registry/manifest.json` without removing
other extension packages.

If a release job fails, rerun the same job. The workflow reuses the existing
GitHub Release, replaces its assets, and updates the registry from the latest
`main`.

The workflow commits the updated registry manifest back to `main`. After a
successful release, pull or rebase before continuing local work:

```bash
git pull --rebase
```

Registry URL:

```text
https://raw.githubusercontent.com/<owner>/<repo>/main/registry/manifest.json
```

Generate a signing key with `kisx key generate` and store the entire key file
JSON in the required `KISAKI_EXTENSION_SIGNING_KEY` repository secret.
