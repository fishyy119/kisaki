## Publish From The Monorepo

This extension lives in `extensions/__EXTENSION_ID__` and is published by the
repository root workflow. Publish by pushing a scoped release commit to `main`:

```bash
git commit --allow-empty -m "release(__EXTENSION_ID__): v0.0.1"
git push origin main
```

The workflow validates this extension's manifest id and version, packages only
this extension, creates tag `__EXTENSION_ID__-v0.0.1`, uploads the `.kisx`
package to a GitHub Release, and updates the shared `registry/manifest.json`.

If a release job fails after creating the tag or release, rerun the same job.
The workflow reuses the tag when it points to the same release commit, replaces
release assets, and updates the registry from the latest `main`.

The workflow commits the updated registry manifest back to `main`. After a
successful release, pull or rebase before continuing local work:

```bash
git pull --rebase
```
