# create-kisaki-extension

Scaffold a Kisaki extension project.

## Usage

```bash
npm create kisaki-extension my-extension
```

The CLI prompts for extension id, display name, category, description, author, and
git initialization. Pass `--git` or `--no-git` to skip the git prompt.

Generated projects include `manifest.json`, `src/index.ts`, `tsdown.config.ts`,
`README.md`, and npm scripts backed by the `kisx` CLI:

```bash
npm run validate
npm run build
npm run pack
npm run dev
```
