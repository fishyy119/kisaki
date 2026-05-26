## Publish With GitHub

This project includes a commit-triggered GitHub Actions workflow. Publish by
pushing a release commit to `main`. The first release can use an empty commit;
later releases should update `manifest.json` first:

```bash
git add manifest.json
git commit --allow-empty -m "release: v0.0.1"
git push origin main
```

The workflow validates the manifest version, packages the extension, creates
tag `v0.0.1`, uploads the `.kisx` package to a GitHub Release, and updates
`registry/manifest.json`. Existing registry packages are preserved, so the
same manifest can host multiple extensions.

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

Preview releases use semver prerelease versions such as `0.0.2-beta.1` or
`0.0.2-nightly.1`.
