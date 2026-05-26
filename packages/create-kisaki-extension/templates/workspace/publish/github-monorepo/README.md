# {{REGISTRY_NAME}}

Kisaki extension registry repository.

## Extensions

- `{{EXTENSION_ID}}` - `extensions/{{EXTENSION_ID}}`

## Add Extensions

Create each extension as its own project under `extensions/<extension-id>`.
Every extension keeps its own `manifest.json`, `package.json`, source files,
and dependencies.

## Publish

Publish an extension by updating that extension's `manifest.json` version and
pushing a scoped release commit from the repository root:

```bash
git commit --allow-empty -m "release({{EXTENSION_ID}}): v0.0.1"
git push origin main
```

The workflow packages only the scoped extension, creates tag
`{{EXTENSION_ID}}-v0.0.1`, uploads the `.kisx` package to a GitHub Release, and
updates `registry/manifest.json` without removing other extension packages.

If a release job fails after creating the tag or release, rerun the same job.
The workflow reuses the tag when it points to the same release commit, replaces
release assets, and updates the registry from the latest `main`.

The workflow commits the updated registry manifest back to `main`. After a
successful release, pull or rebase before continuing local work:

```bash
git pull --rebase
```

Registry URL:

```text
https://raw.githubusercontent.com/<owner>/<repo>/main/registry/manifest.json
```

For signed releases, create a local key with `kisx key generate` and store the
entire key file JSON in the `KISAKI_EXTENSION_SIGNING_KEY` repository secret.
