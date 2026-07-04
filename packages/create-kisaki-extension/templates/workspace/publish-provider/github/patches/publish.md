Publish an extension by updating its `manifest.json` and pushing a scoped
publish commit from the repository root:

```bash
git commit -m "publish(<extension-id>): v0.0.1"
git push origin main
```

The workflow validates the commit scope and manifest version, packages only
the scoped extension, updates and validates `registry/manifest.json`, creates
the GitHub Release tag `<extension-id>-v0.0.1`, and uploads the signed `.kisx`
package without removing other extension packages.

Optional release changelogs live under the extension directory. The workflow
uses the default locale entry for GitHub Release notes and writes all locale
entries into the registry release:

```text
extensions/<extension-id>/changelogs/0.0.1/en.md
extensions/<extension-id>/changelogs/0.0.1/zh-Hans.md
```

The first non-empty line is the changelog summary. The remaining Markdown is
the changelog body.

If a publish job fails before the GitHub Release step, fix the issue and rerun
the job. If it fails after the GitHub Release step, rerun the same job; the
workflow reuses the existing release, replaces its assets, and updates the
registry from the latest `main`.

The workflow commits the updated registry manifest back to `main`. After a
successful publish, pull or rebase before continuing local work:

```bash
git pull --rebase
```

Registry URL:

```text
https://raw.githubusercontent.com/<owner>/<repo>/main/registry/manifest.json
```

Generate the repository signing key from the workspace root:

```bash
pnpm run key:generate
```

Store the entire `.keys/author.ed25519.json` file JSON in the required
`KISAKI_EXTENSION_SIGNING_KEY` repository secret.
