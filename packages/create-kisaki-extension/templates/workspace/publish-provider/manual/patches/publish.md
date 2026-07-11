Package extensions from the repository root. Upload the `.kisx` package to
your hosting provider, then add the published artifact URL to the shared
registry manifest:

```bash
pnpm exec kisx --project extensions/<extension-id> pack --out-dir artifacts
pnpm exec kisx registry add-release \
  artifacts/<extension-id>-0.0.1.kisx \
  --manifest registry/manifest.json \
  --url https://example.com/extensions/<extension-id>-0.0.1.kisx
pnpm exec kisx registry validate registry/manifest.json
```

For signed manual releases, generate the repository key with
`pnpm run key:generate`, package with
`--sign --key .keys/author.ed25519.json`, and pass the generated `.sig` file to
`kisx registry add-release --signature`.

The registry manifest is shared by every extension in this repository. Commit
`registry/manifest.json` after adding or replacing release artifacts.
