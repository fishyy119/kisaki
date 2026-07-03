# Kisaki Extension Tooling v0.0.4

## Breaking Changes

- Changed `kisx.config.ts`; the Node host target is now configured with `host` instead of `entry`
- Changed registry package descriptions to localized `description` documents, replacing `summary`
- Changed release metadata from `changelog.text` and `changelog.url` to localized `changelog` and `releasePage`
- Changed `yanked` to an object with withdrawal time and optional reason
- Removed scaffold `--layout` and `--package-name`; generated repositories now use one workspace shape and derive package names from stable IDs

## Migration Notes

- Changed existing `kisx.config.ts` files by renaming `entry` to `host`
- Update registry manifest description, changelog, and yanked fields before publishing or validating

## Features

- Added localized registry descriptions and release changelogs
- Added `kisx registry add-release --changelogs <dir> --default-locale <locale>`
- Added `kisx registry yank` and `kisx registry unyank` for withdrawing or restoring published releases
- Added scaffold `--webview-addon` support for layering `kisaki-ui-vue` over webview frameworks

## Improvements

- Improved `create-kisaki-extension` prompts to add extensions by default inside generated workspaces
- Improved scaffold metadata flow across registry, workspace, and extension fields
- Improved `kisx dev` webview serving so development and packaged webviews share one security boundary while keeping HMR
- Improved GitHub publish templates to verify artifacts, create tags and releases, and update registry manifests
