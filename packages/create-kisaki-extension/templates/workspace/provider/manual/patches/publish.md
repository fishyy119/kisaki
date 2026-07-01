Each extension is packaged from its own directory. Upload the `.kisx` package
to your hosting provider, then add the published artifact URL to the shared
registry manifest:

```bash
pnpm --dir extensions/<extension-id> run pack
pnpm --dir extensions/<extension-id> exec kisx registry add-release \
  artifacts/<extension-id>-0.0.1.kisx \
  --manifest ../../registry/manifest.json \
  --url https://example.com/extensions/<extension-id>-0.0.1.kisx \
  --release-page https://example.com/extensions/<extension-id>/releases/0.0.1 \
  --changelogs changelogs/0.0.1 \
  --default-locale en
pnpm --dir extensions/<extension-id> exec kisx registry validate ../../registry/manifest.json
```

Release changelogs are localized Markdown files under the extension directory:

```text
extensions/<extension-id>/changelogs/0.0.1/en.md
extensions/<extension-id>/changelogs/0.0.1/zh-Hans.md
```

The first non-empty line is the changelog summary. The remaining Markdown is
the changelog body.

The registry manifest is shared by every extension in this repository. Commit
`registry/manifest.json` after adding or replacing release artifacts.
