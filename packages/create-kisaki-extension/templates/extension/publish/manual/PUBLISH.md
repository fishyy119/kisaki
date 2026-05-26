## Publish

```bash
kisx registry init --out registry/manifest.json --id "__REGISTRY_ID__" --name "__REGISTRY_NAME__"
kisx registry add-release artifacts/__EXTENSION_ID__-0.0.1.kisx \
  --manifest registry/manifest.json \
  --url https://example.com/extensions/__EXTENSION_ID__-0.0.1.kisx
kisx registry validate registry/manifest.json
```

Upload the `.kisx` package first, then pass the published HTTPS artifact URL to
`kisx registry add-release`. The command creates the package entry on first
publish and appends later releases to the same registry package. Existing
registry packages are preserved, so the same manifest can host multiple
extensions.

Use semver prerelease versions for preview releases, such as `0.0.2-beta.1` or
`0.0.2-nightly.1`. Stable releases use plain semver versions.

For signed releases:

```bash
kisx key generate --out .keys/author.ed25519.json
kisx pack --sign --key .keys/author.ed25519.json
kisx registry add-release artifacts/__EXTENSION_ID__-0.0.1.kisx \
  --manifest registry/manifest.json \
  --url https://example.com/extensions/__EXTENSION_ID__-0.0.1.kisx \
  --signature artifacts/__EXTENSION_ID__-0.0.1.sig
```
