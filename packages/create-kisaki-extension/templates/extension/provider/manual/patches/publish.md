## Publish Manually

Package this extension from the repository root or from its extension
directory, upload the `.kisx` package to your hosting provider, then add the
published artifact URL to the shared registry manifest:

```bash
pnpm --dir extensions/{{EXTENSION_ID}} run pack
pnpm --dir extensions/{{EXTENSION_ID}} exec kisx registry add-release \
  artifacts/{{EXTENSION_ID}}-0.0.1.kisx \
  --manifest ../../registry/manifest.json \
  --url https://example.com/extensions/{{EXTENSION_ID}}-0.0.1.kisx
```
