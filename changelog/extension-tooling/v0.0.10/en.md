# Kisaki Extension Tooling v0.0.10

## Breaking Changes

- Changed `kisx registry add-release --changelogs` to require each `<locale>.md` file to declare its summary in top front matter
- Changed GitHub publish scaffolds to read `extensions/<extension-id>/changelogs/v<version>` instead of unprefixed version directories

## Migration Notes

- Required repositories generated with the 0.0.9 scaffold to move extension changelog directories from `changelogs/<version>` to `changelogs/v<version>`
- Required existing extension changelog files to move their first-line summary into top front matter, such as `summary: ...`

## Improvements

- Improved scaffolded publishing docs to show v-prefixed changelog paths and summary front matter
- Improved `kisx registry add-release --help` and README copy to describe the summary front matter requirement
