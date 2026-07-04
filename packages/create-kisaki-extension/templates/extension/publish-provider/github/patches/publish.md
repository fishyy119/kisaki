## Publish With GitHub

This extension lives in `extensions/{{EXTENSION_ID}}` and is published by the
repository root workflow. Push a scoped publish commit:

```bash
git commit -m "publish({{EXTENSION_ID}}): v0.0.1"
git push origin main
```

The workflow validates this extension's manifest id and version, packages only
this extension, updates and validates the shared `registry/manifest.json`,
creates tag `{{EXTENSION_ID}}-v0.0.1` with its GitHub Release, and uploads the
signed `.kisx` package.

Optional release changelogs live in this extension directory:

```text
extensions/{{EXTENSION_ID}}/changelogs/0.0.1/en.md
extensions/{{EXTENSION_ID}}/changelogs/0.0.1/zh-Hans.md
```

The first non-empty line is the changelog summary. The remaining Markdown is
the changelog body.

If a publish job fails before the GitHub Release step, fix the issue and rerun
the job. If it fails after the GitHub Release step, rerun the same job; the
workflow reuses the existing release, replaces its assets, and updates the
registry from the latest `main`.

The workflow requires the repository signing-key secret. Generate it from the
workspace root with `pnpm run key:generate`, then store the entire
`.keys/author.ed25519.json` file JSON in `KISAKI_EXTENSION_SIGNING_KEY`.

The workflow commits the updated registry manifest back to `main`. After a
successful publish, pull or rebase before continuing local work:

```bash
git pull --rebase
```
