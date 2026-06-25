## Publish Manually

Package this extension from the repository root or from its extension
directory, upload the `.kisx` package to your hosting provider, then add the
published artifact URL to the shared registry manifest:

```bash
pnpm --dir extensions/__EXTENSION_ID__ run pack
pnpm --dir extensions/__EXTENSION_ID__ exec kisx registry add-release \
  artifacts/__EXTENSION_ID__-0.0.1.kisx \
  --manifest ../../registry/manifest.json \
  --url https://example.com/extensions/__EXTENSION_ID__-0.0.1.kisx
```
