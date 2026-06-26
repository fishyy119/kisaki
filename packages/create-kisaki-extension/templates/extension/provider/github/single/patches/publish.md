## Publish With GitHub

This project includes a release-commit-driven GitHub Actions workflow. Update
`manifest.json`, then push a scoped release commit:

```bash
git commit -m "release({{EXTENSION_ID}}): v0.0.1"
git push origin main
```

The workflow validates the commit scope and manifest version, creates tag
`{{EXTENSION_ID}}-v0.0.1`, packages the extension, uploads the signed `.kisx`
package to a GitHub Release, and updates `registry/manifest.json`. Existing
registry packages are preserved, so the same manifest can host multiple
extensions.

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

Create a local key with `kisx key generate` and store the entire key file JSON
in the required `KISAKI_EXTENSION_SIGNING_KEY` repository secret.

Preview releases use semver prerelease versions such as `0.0.2-beta.1` or
`0.0.2-nightly.1`.
