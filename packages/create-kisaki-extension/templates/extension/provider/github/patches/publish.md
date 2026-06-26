## Publish With GitHub

This extension lives in `extensions/{{EXTENSION_ID}}` and is published by the
repository root workflow. Push a scoped release commit:

```bash
git commit -m "release({{EXTENSION_ID}}): v0.0.1"
git push origin main
```

The workflow validates this extension's manifest id and version, packages only
this extension, creates tag `{{EXTENSION_ID}}-v0.0.1` and its GitHub Release,
uploads the signed `.kisx` package, and updates the shared
`registry/manifest.json`.

If a release job fails, rerun the same job. The workflow reuses the existing
GitHub Release, replaces its assets, and updates the registry from the latest
`main`.

The workflow requires the repository signing-key secret and commits the updated
registry manifest back to `main`. After a
successful release, pull or rebase before continuing local work:

```bash
git pull --rebase
```
