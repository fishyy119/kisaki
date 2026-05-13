# {{EXTENSION_NAME}}

{{DESCRIPTION}}

## Scripts

```bash
npm run build
npm run validate
npm run pack
npm run dev
```

## Publish

```bash
kisx pack
kisx registry init --out registry/manifest.json --id example.extensions --name "Example Extensions"
kisx registry add-release artifacts/{{EXTENSION_ID}}-0.0.1.kisx --manifest registry/manifest.json --url https://example.com/extensions/{{EXTENSION_ID}}-0.0.1.kisx
kisx registry validate registry/manifest.json
```

Use semver prerelease versions for beta or nightly releases, such as `0.0.2-beta.1`.
`channel` is only an update track label; the registry keeps one release per package version.

For signed releases:

```bash
kisx key generate --out .keys/author.ed25519.json
kisx pack --sign --key .keys/author.ed25519.json
kisx registry add-release artifacts/{{EXTENSION_ID}}-0.0.1.kisx --manifest registry/manifest.json --url https://example.com/extensions/{{EXTENSION_ID}}-0.0.1.kisx --signature artifacts/{{EXTENSION_ID}}-0.0.1.sig
```
