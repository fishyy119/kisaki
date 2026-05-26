# create-kisaki-extension

Scaffold a Kisaki extension project.

## Usage

```bash
npm create kisaki-extension my-extension
```

The CLI prompts for extension id, display name, category, description, author,
publish workflow, registry metadata, and git initialization. Pass `--git` or
`--no-git` to skip the git prompt. Pass `--github-single`,
`--github-monorepo`, or `--manual` to skip the publish workflow prompt.

Generated projects include `manifest.json`, `src/index.ts`, `tsdown.config.ts`,
`README.md`, `.gitignore`, and npm scripts backed by the `kisx` CLI:

```bash
npm run build
npm run validate
npm run pack
npm run dev
```

The generated `engines.kisaki` value is the recommended Kisaki Extension API
range for the scaffolded tooling version.

## Template Layers

Scaffolding is composed from small template layers instead of one mixed
template:

- `templates/workspace/base`
- `templates/workspace/publish/<workflow>`
- `templates/extension/base`
- `templates/extension/categories/<category>`
- `templates/extension/publish/<workflow>`

For example, choosing `theme` and `GitHub single extension` combines the
workspace base, GitHub single workflow, extension base, theme files, and GitHub
publish README section. Choosing `GitHub extension monorepo` writes the
extension under `extensions/<extension-id>` and keeps the registry workflow at
the repository root.

When the GitHub publish workflow is selected, the project also includes
`.github/workflows/publish.yml`.

Single-extension repositories use root project files and release commits such
as `release: v0.0.1`.

Extension monorepositories place the initial extension under
`extensions/<extension-id>` and use scoped release commits such as
`release(example.extension): v0.0.1`; tags are written as
`example.extension-v0.0.1`.

Both GitHub workflows package the selected extension, upload a GitHub Release
asset, and update `registry/manifest.json`. The workflow commits the updated
registry manifest back to `main`, so authors should pull or rebase after a
successful release.

GitHub release jobs are designed to be rerun safely: an existing tag for the
same release commit is reused, release assets are uploaded with replacement,
and registry updates are applied from the latest `main`.
