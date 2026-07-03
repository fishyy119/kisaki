## Publish Manually

Package this extension from the repository root or from its extension
directory, upload the `.kisx` package to your hosting provider, then add the
published artifact URL to the shared registry manifest:

```bash
pnpm --dir extensions/{{EXTENSION_ID}} run pack
pnpm --dir extensions/{{EXTENSION_ID}} exec kisx registry add-release \
  artifacts/{{EXTENSION_ID}}-0.0.1.kisx \
  --manifest ../../registry/manifest.json \
  --url https://example.com/extensions/{{EXTENSION_ID}}-0.0.1.kisx \
  --release-page https://example.com/extensions/{{EXTENSION_ID}}/releases/0.0.1 \
  --changelogs changelogs/0.0.1 \
  --default-locale en
```

Release changelogs are localized Markdown files under this extension directory:

```text
extensions/{{EXTENSION_ID}}/changelogs/0.0.1/en.md
extensions/{{EXTENSION_ID}}/changelogs/0.0.1/zh-Hans.md
```

The first non-empty line is the changelog summary. The remaining Markdown is
the changelog body.
