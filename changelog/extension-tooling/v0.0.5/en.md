# Kisaki Extension Tooling v0.0.5

## Breaking Changes

- Changed Scaffold `init` to create only the extension workspace and registry
- Changed Scaffold `add` to use a positional extension ID and remove `--extension-id`
- Changed Scaffold workspace configuration from `provider` to `publishProvider`

## Migration Notes

- Required creating a workspace with `pnpm create kisaki-extension init`, then running `pnpm create kisaki-extension add <extension-id>` inside it
- Required changing `provider` to `publishProvider` in `kisaki-extension-workspace.json`

## Improvements

- Improved Scaffold usage without a subcommand to default to `add` inside valid workspaces
- Improved Scaffold invalid workspace errors so configuration issues no longer fall back to `init`
- Improved Scaffold prompt grouping across workspace, registry, and extension information
