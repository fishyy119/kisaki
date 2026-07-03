## Publish Manually

Package this extension from the repository root, upload the `.kisx` package to
your hosting provider, then add the published artifact URL to the shared
registry manifest:

```bash
pnpm exec kisx --project extensions/{{EXTENSION_ID}} pack --out-dir artifacts
pnpm exec kisx registry add-release \
  artifacts/{{EXTENSION_ID}}-0.0.1.kisx \
  --manifest registry/manifest.json \
  --url https://example.com/extensions/{{EXTENSION_ID}}-0.0.1.kisx \
  --release-page https://example.com/extensions/{{EXTENSION_ID}}/releases/0.0.1 \
  --changelogs extensions/{{EXTENSION_ID}}/changelogs/0.0.1 \
  --default-locale en
```

For signed manual releases, generate the repository key with
`pnpm run key:generate`, package with
`--sign --key .keys/author.ed25519.json`, and pass the generated `.sig` file to
`kisx registry add-release --signature`.

Release changelogs are localized Markdown files under this extension directory:

```text
extensions/{{EXTENSION_ID}}/changelogs/0.0.1/en.md
extensions/{{EXTENSION_ID}}/changelogs/0.0.1/zh-Hans.md
```

The first non-empty line is the changelog summary. The remaining Markdown is
the changelog body.
