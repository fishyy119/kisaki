## Publish With GitHub

This extension lives in `extensions/{{EXTENSION_ID}}` and is published by the
repository root workflow. Commit the manifest update, then push a publish tag:

```bash
git push origin main
git tag {{EXTENSION_ID}}-v0.0.1
git push origin {{EXTENSION_ID}}-v0.0.1
```

The workflow parses the tag, validates this extension's manifest id and
version, packages only the tagged source, updates and validates the shared
`registry/manifest.json`, and uploads the signed `.kisx` package to the
GitHub Release for `{{EXTENSION_ID}}-v0.0.1`.

If a publish job fails, fix the issue, move the same tag to the corrected
commit, and push the tag again:

```bash
git tag -f {{EXTENSION_ID}}-v0.0.1
git push --force origin {{EXTENSION_ID}}-v0.0.1
```

The workflow reuses the existing release, replaces its assets, and updates the
registry from the latest `main`. You can also run the workflow manually and
enter the publish tag.

The workflow requires the repository signing-key secret. Generate it from the
workspace root with `pnpm run key:generate`, then store the entire
`.keys/author.ed25519.json` file JSON in `KISAKI_EXTENSION_SIGNING_KEY`.

The workflow commits the updated registry manifest back to `main`. After a
successful publish, pull or rebase before continuing local work:

```bash
git pull --rebase
```
