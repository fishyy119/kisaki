Each extension is packaged from its own directory. Upload the `.kisx` package
to your hosting provider, then add the published artifact URL to the shared
registry manifest:

```bash
pnpm --dir extensions/__EXTENSION_ID__ run pack
pnpm --dir extensions/__EXTENSION_ID__ exec kisx registry add-release \
  artifacts/__EXTENSION_ID__-0.0.1.kisx \
  --manifest ../../registry/manifest.json \
  --url https://example.com/extensions/__EXTENSION_ID__-0.0.1.kisx
pnpm --dir extensions/__EXTENSION_ID__ exec kisx registry validate ../../registry/manifest.json
```

The registry manifest is shared by every extension in this repository. Commit
`registry/manifest.json` after adding or replacing release artifacts.
