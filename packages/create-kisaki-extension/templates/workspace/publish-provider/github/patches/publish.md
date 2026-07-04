Publish an extension by updating its `manifest.json`, committing the change,
and pushing a scoped publish tag from the repository root:

```bash
git push origin main
git tag <extension-id>-v0.0.1
git push origin <extension-id>-v0.0.1
```

The workflow parses the tag, validates the matching manifest id and version,
packages only the tagged extension source, updates and validates
`registry/manifest.json`, and uploads the signed `.kisx` package to the
GitHub Release for `<extension-id>-v0.0.1` without removing other extension
packages.

Optional release changelogs live under the extension directory. The workflow
uses the default locale entry for GitHub Release notes and writes all locale
entries into the registry release:

```text
extensions/<extension-id>/changelogs/0.0.1/en.md
extensions/<extension-id>/changelogs/0.0.1/zh-Hans.md
```

The first non-empty line is the changelog summary. The remaining Markdown is
the changelog body.

If a publish job fails, fix the issue, move the same tag to the corrected
commit, and push the tag again:

```bash
git tag -f <extension-id>-v0.0.1
git push --force origin <extension-id>-v0.0.1
```

The workflow reuses the existing release, replaces its assets, and updates the
registry from the latest `main`. You can also run the workflow manually and
enter the publish tag.

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
