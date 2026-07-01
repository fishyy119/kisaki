Publish an extension by updating its `manifest.json` and pushing a scoped
publish commit from the repository root:

```bash
git commit -m "publish(<extension-id>): v0.0.1"
git push origin main
```

The workflow validates the commit scope and manifest version, creates tag
`<extension-id>-v0.0.1`, packages only the scoped extension, uploads the
signed `.kisx` package, and updates `registry/manifest.json` without removing
other extension packages.

Optional release changelogs live under the extension directory. The workflow
uses the default locale entry for GitHub Release notes and writes all locale
entries into the registry release:

```text
extensions/<extension-id>/changelogs/0.0.1/en.md
extensions/<extension-id>/changelogs/0.0.1/zh-Hans.md
```

The first non-empty line is the changelog summary. The remaining Markdown is
the changelog body.

If a publish job fails, rerun the same job. The workflow reuses the existing
GitHub Release, replaces its assets, and updates the registry from the latest
`main`.

The workflow commits the updated registry manifest back to `main`. After a
successful publish, pull or rebase before continuing local work:

```bash
git pull --rebase
```

Registry URL:

```text
https://raw.githubusercontent.com/<owner>/<repo>/main/registry/manifest.json
```

Generate a signing key with `kisx key generate` and store the entire key file
JSON in the required `KISAKI_EXTENSION_SIGNING_KEY` repository secret.
